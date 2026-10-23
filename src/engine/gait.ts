import { clamp01, TAU } from './easing.js';
import type { Pose } from './motion.js';
import { rigPart, type Rig } from './rigs.js';

/** How far a move has got, in canonical units of the actor's own rig (see timeline). */
export interface Travel {
  /** Distance covered since the move began. */
  dist: number;
  /** Length of the whole move. */
  total: number;
  /** Seconds the whole move takes. */
  time: number;
}

/**
 * A leg cycle. Each foot spends `duty` of the cycle on the ground and the rest swinging
 * forward; while it is down, the leg's angle is chosen so the foot stays where it landed
 * as the body travels over it. Cycle length comes from the distance covered, not from the
 * clock, so the feet hold still at any speed and slow down with the body.
 */
interface Gait {
  /** Fraction of the cycle each foot is on the ground; under 0.5 leaves a flight phase. */
  duty: number;
  /** When each leg lands, as a fraction of the cycle. */
  legs: Record<string, number>;
  /** Cycles per second the gait prefers, and the leg swing (degrees) it may use. */
  cadence: number;
  minSwing: number;
  maxSwing: number;
  /** Share of the rigid-leg rise and fall the body shows; the legs give the rest. */
  bob: number;
  /** Canonical units: swing foot lift, hop height in a flight phase, give after contact. */
  lift: number;
  hop: number;
  dip: number;
  /** Body pitch (degrees) over the cycle, and its lag. */
  rock?: [number, number];
}

const GAITS: Partial<Record<Rig['name'], Partial<Record<'walk' | 'run', Gait>>>> = {
  humanoid: {
    walk: {
      duty: 0.5,
      legs: { legL: 0, legR: 0.5 },
      cadence: 1.6,
      minSwing: 8,
      maxSwing: 30,
      bob: 0.6,
      lift: 12,
      hop: 0,
      dip: 4,
    },
    run: {
      duty: 0.36,
      legs: { legL: 0, legR: 0.5 },
      cadence: 2.2,
      minSwing: 12,
      maxSwing: 40,
      bob: 0.7,
      lift: 30,
      hop: 16,
      dip: 7,
    },
  },
  // Walk in diagonal pairs (near front with far hind); gallop with the hind pair landing
  // just apart, then the front pair half a cycle later, with a flight after each.
  quadruped: {
    walk: {
      duty: 0.5,
      legs: { legFR: 0, legBL: 0, legFL: 0.5, legBR: 0.5 },
      cadence: 1.5,
      minSwing: 8,
      maxSwing: 28,
      bob: 0.7,
      lift: 6,
      hop: 0,
      dip: 2,
    },
    run: {
      duty: 0.32,
      legs: { legBL: 0, legBR: 0.08, legFL: 0.5, legFR: 0.58 },
      cadence: 2.2,
      minSwing: 14,
      maxSwing: 38,
      bob: 0.8,
      lift: 10,
      hop: 12,
      dip: 3,
      rock: [4, 0.8],
    },
  },
};

const RAD = Math.PI / 180;
const frac = (v: number): number => v - Math.floor(v);

type Pt = [number, number];
const rotate = ([x, y]: Pt, deg: number, [cx, cy]: Pt): Pt => {
  const a = deg * RAD;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};

/** A point drawn in `part`'s coordinates, carried through the pose to the root (before dx, dy). */
export function toRoot(rig: Rig, pose: Pose, part: string, point: Pt): Pt {
  let p = point;
  const knee = rig.knees[part];
  if (knee && pose.bend[part] && point[1] > knee[1]) p = rotate(p, pose.bend[part], knee);
  const seen = new Set<string>();
  for (let cur: string | undefined = part; cur && !seen.has(cur); cur = rigPart(rig, cur).parent) {
    seen.add(cur);
    p = rotate(p, pose.rot[cur] ?? 0, rigPart(rig, cur).pivot);
    const off = pose.off[cur];
    if (off) p = [p[0] + off[0], p[1] + off[1]];
  }
  return p;
}

/** The bottom of a leg, a straight line down from its pivot to the base line, in the frame. */
export function footPoint(rig: Rig, pose: Pose, leg: string): Pt {
  const [x, y] = toRoot(rig, pose, leg, [rigPart(rig, leg).pivot[0], rig.height]);
  return [x + pose.dx, y + pose.dy];
}

/** Summed rotation of everything a part hangs from. */
function parentTurn(rig: Rig, pose: Pose, part: string): number {
  let r = 0;
  for (let cur = rigPart(rig, part).parent; cur; cur = rigPart(rig, cur).parent)
    r += pose.rot[cur] ?? 0;
  return r;
}

interface Plan {
  gait: Gait;
  /** Cycle length (canonical units of travel) and the leg swing that fits it. */
  cycle: number;
  sinA: number;
  /** Cycle phase now, and the 0..1 envelope that settles the feet at either end of a move. */
  phase: number;
  env: number;
}

/**
 * Fit the gait to the move: the swing the speed asks for (within the gait's range), then
 * a whole number of half cycles over the distance so the move starts and ends with the
 * legs together, which is where idle has them.
 */
function plan(rig: Rig, gait: Gait, t: number, travel?: Travel): Plan {
  const leg = Object.keys(gait.legs)[0];
  const L = rig.height - rigPart(rig, leg).pivot[1];
  const sinMin = Math.sin(gait.minSwing * RAD);
  const sinMax = Math.sin(gait.maxSwing * RAD);
  const start = gait.duty / 2;
  if (!travel) {
    // A sheet or a test: a steady cycle at the gait's own cadence.
    const sinA = Math.sin(0.8 * gait.maxSwing * RAD);
    const cycle = (2 * L * sinA) / gait.duty;
    return { gait, cycle, sinA, phase: start + t * gait.cadence, env: 1 };
  }
  const speed = travel.total / Math.max(1e-6, travel.time);
  const want = Math.min(sinMax, Math.max(sinMin, (speed * gait.duty) / (2 * L * gait.cadence)));
  const halves = Math.max(1, Math.ceil((2 * travel.total * gait.duty) / (2 * L * want)));
  const cycle = (2 * travel.total) / halves;
  const sinA = Math.min(sinMax, (cycle * gait.duty) / (2 * L));
  const edge = Math.min(travel.dist, travel.total - travel.dist) / (0.25 * cycle);
  return { gait, cycle, sinA, phase: start + travel.dist / cycle, env: clamp01(edge) };
}

interface Legs {
  rot: Record<string, number>;
  body: number;
  /** Per leg: on the ground, and how high a swinging foot should clear the line. */
  stance: Record<string, boolean>;
  clear: Record<string, number>;
  /** 0..1 through the current stance, for the give after contact. */
  contact: number;
}

/** Leg angles at a phase, each leg's absolute angle turned back into its parent's frame. */
function legsAt(rig: Rig, pl: Plan, phase: number): Legs {
  const { gait } = pl;
  const A = Math.asin(pl.sinA) / RAD;
  const body = gait.rock ? gait.rock[0] * Math.sin(TAU * phase + gait.rock[1]) : 0;
  const out: Legs = { rot: {}, body, stance: {}, clear: {}, contact: 1 };
  for (const [leg, landing] of Object.entries(gait.legs)) {
    const lp = frac(phase - landing);
    let abs: number;
    if (lp < gait.duty) {
      // Down: sin(angle) falls linearly with travel, so the foot keeps still.
      const s = lp / gait.duty;
      abs = Math.asin(pl.sinA * (2 * s - 1)) / RAD;
      out.stance[leg] = true;
      out.contact = Math.min(out.contact, s);
    } else {
      const q = (lp - gait.duty) / (1 - gait.duty);
      abs = A * Math.cos(Math.PI * q);
      out.stance[leg] = false;
      out.clear[leg] = gait.lift * Math.sin(Math.PI * q) * pl.env;
    }
    out.rot[leg] = abs - (rigPart(rig, leg).parent ? body : 0);
  }
  return out;
}

/** Feet height on a pose holding these legs, with no body offset yet. */
function feetY(rig: Rig, legs: Legs): Record<string, number> {
  const p: Pose = {
    rot: { ...legs.rot, body: legs.body },
    bend: {},
    off: {},
    dx: 0,
    dy: 0,
    sx: 1,
    sy: 1,
    spin: 0,
    face: {},
  };
  const out: Record<string, number> = {};
  for (const leg of Object.keys(legs.rot)) out[leg] = footPoint(rig, p, leg)[1];
  return out;
}

/** How far down the body must sit for the highest planted foot to reach the line. */
function stanceDrop(rig: Rig, pl: Plan, phase: number): number {
  const legs = legsAt(rig, pl, phase);
  const ys = feetY(rig, legs);
  const down = Object.keys(ys).filter((l) => legs.stance[l]);
  return down.length ? rig.height - Math.min(...down.map((l) => ys[l])) : 0;
}

/**
 * Pose the legs and body for a walk or run. Feet on the ground land exactly on the base
 * line and stay put; the others clear it. The body rises and falls with the legs (and
 * flies between contacts when the gait has a flight phase); the legs make up any
 * difference by giving at the knee, drawn as the leg sliding up into the body. Returns
 * the cycle phase in radians for the caller's secondary motion (arms, head, tail).
 */
export function stride(
  rig: Rig,
  pose: Pose,
  loco: 'walk' | 'run',
  t: number,
  travel?: Travel
): number {
  const gait = GAITS[rig.name]![loco]!;
  const pl = plan(rig, gait, t, travel);
  const legs = legsAt(rig, pl, pl.phase);
  const ys = feetY(rig, legs);
  const H = rig.height;
  const down = Object.keys(ys).filter((l) => legs.stance[l]);

  let dy: number;
  if (down.length) {
    const give = gait.dip * Math.sin(Math.PI * Math.min(1, legs.contact / 0.4)) * pl.env;
    dy = gait.bob * (H - Math.min(...down.map((l) => ys[l]))) + give;
  } else {
    // In the air: from the last take-off to the next landing on a hop.
    const since = Math.min(
      ...Object.entries(gait.legs).map(([, o]) => frac(pl.phase - o) - gait.duty)
    );
    const until = Math.min(...Object.entries(gait.legs).map(([, o]) => 1 - frac(pl.phase - o)));
    const g = since / (since + until);
    const a = gait.bob * stanceDrop(rig, pl, pl.phase - since - 1e-6);
    const b = gait.bob * stanceDrop(rig, pl, pl.phase + until + 1e-6);
    dy = a + (b - a) * g - gait.hop * 4 * g * (1 - g) * pl.env;
  }

  if (legs.body) pose.rot.body = (pose.rot.body ?? 0) + legs.body;
  pose.dy += dy;
  for (const [leg, rot] of Object.entries(legs.rot)) {
    pose.rot[leg] = rot;
    const y = ys[leg] + dy;
    const shift = legs.stance[leg] ? H - y : Math.min(0, H - legs.clear[leg] - y);
    // A planted leg also cancels the sideways drift of its hip or shoulder when the body
    // rocks, so the foot stays exactly where it landed.
    const pivot = rigPart(rig, leg).pivot;
    const drift = legs.stance[leg] ? pivot[0] - toRoot(rig, pose, leg, pivot)[0] : 0;
    // A shift on screen, written in the frame of whatever the leg hangs from.
    const r = parentTurn(rig, pose, leg) * RAD;
    pose.off[leg] = [
      drift * Math.cos(r) + shift * Math.sin(r),
      -drift * Math.sin(r) + shift * Math.cos(r),
    ];
  }
  return TAU * pl.phase;
}

/**
 * Put these feet back on the base line after a verb has moved the body (a crouch, a
 * landing, sitting down): each leg slides along the screen vertical, into the body when
 * the body has come down onto it.
 */
export function plantFeet(rig: Rig, pose: Pose, legs: string[]): void {
  for (const leg of legs) {
    if (!rig.parts[leg]) continue;
    const shift = rig.height - footPoint(rig, pose, leg)[1];
    const r = parentTurn(rig, pose, leg) * RAD;
    const [ox, oy] = pose.off[leg] ?? [0, 0];
    pose.off[leg] = [ox + shift * Math.sin(r), oy + shift * Math.cos(r)];
  }
}
