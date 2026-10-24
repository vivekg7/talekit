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
  /**
   * Whether a planted leg gives at the knee. A person's does; on four short legs a give
   * of a few units turns into a deep bend, so they stay straight and slide instead.
   */
  give: boolean;
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
      give: true,
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
      give: true,
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
      give: false,
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
      give: false,
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

/**
 * How narrow the body is drawn at this turn (`Rig.turn`): 1 front-on, `bodyNarrow` at
 * three-quarters and narrower toward side-on. Seen from behind it is three-quarters again.
 */
export function bodyWidth(rig: Rig, pose: Pose, most = 2): number {
  if (!rig.turn) return 1;
  const yaw = pose.back ? 1 : Math.min(most, pose.yaw);
  return 1 - (1 - rig.turn.bodyNarrow) * yaw;
}

/**
 * How far the body's turn (`Rig.turn`) steps a limb's shoulder or hip in toward the middle.
 * Only as far as three-quarters: past that (a walker turning further toward the way they
 * go) a hip moving under a planted foot would drag the foot along.
 */
export function limbStep(rig: Rig, pose: Pose, part: string): number {
  if (!rig.turn?.limbs.includes(part)) return 0;
  return (rigPart(rig, part).pivot[0] - rig.turn.centre) * (bodyWidth(rig, pose, 1) - 1);
}

/**
 * A part's turn about its pivot and its length along itself, as drawn. A limb swinging into
 * or out of the screen (`Pose.depth`) is foreshortened: it points where its end would be
 * with the sideways swing squeezed, and is shortened to reach just there, keeping its width.
 */
export function swingOf(rig: Rig, pose: Pose, part: string): [number, number] {
  const rot = pose.rot[part] ?? 0;
  if (!pose.depth || !rig.turn?.limbs.includes(part)) return [rot, 1];
  const x = (1 - pose.depth) * Math.sin(rot * RAD);
  const y = Math.cos(rot * RAD);
  return [Math.atan2(x, y) / RAD, Math.hypot(x, y)];
}

/** A part's offset: the pose's, plus a limb's step in with the body's turn. */
export function partOffset(rig: Rig, pose: Pose, part: string): Pt {
  const [x, y] = pose.off[part] ?? [0, 0];
  return [x + limbStep(rig, pose, part), y];
}

/** A point drawn in `part`'s coordinates, carried through the pose to the root (before dx, dy). */
export function toRoot(rig: Rig, pose: Pose, part: string, point: Pt): Pt {
  let p = point;
  const knee = rig.bends[part];
  if (knee && pose.bend[part] && point[1] > knee[1]) p = rotate(p, pose.bend[part], knee);
  const seen = new Set<string>();
  for (let cur: string | undefined = part; cur && !seen.has(cur); cur = rigPart(rig, cur).parent) {
    seen.add(cur);
    const pivot = rigPart(rig, cur).pivot;
    const [rot, len] = swingOf(rig, pose, cur);
    if (len !== 1) p = [p[0], pivot[1] + (p[1] - pivot[1]) * len];
    p = rotate(p, rot, pivot);
    const [ox, oy] = partOffset(rig, pose, cur);
    p = [p[0] + ox, p[1] + oy];
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

/**
 * Where a walk or run is in its leg cycle, counted in whole cycles from the start of the
 * move: a foot comes down each time it passes one of `footfalls`. Undefined for a rig with
 * no such gait (it bobs instead).
 */
export function gaitPhase(rig: Rig, loco: 'walk' | 'run', travel: Travel): number | undefined {
  const gait = GAITS[rig.name]?.[loco];
  return gait && plan(rig, gait, 0, travel).phase;
}

/** The points in a cycle where feet land, a pair landing together counted once. */
export function footfalls(rig: Rig, loco: 'walk' | 'run'): number[] {
  const gait = GAITS[rig.name]?.[loco];
  return gait ? [...new Set(Object.values(gait.legs))].sort((a, b) => a - b) : [];
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
    yaw: 1,
    back: false,
    depth: 0,
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
 * difference by bending at the knee, or by sliding up into the body (see `give`). Returns
 * the cycle phase in radians for the caller's secondary motion (arms, head, tail), and how
 * far into the stride the move is (0 with the legs together at either end, 1 in full
 * stride), so that motion can settle with the legs.
 */
export function stride(
  rig: Rig,
  pose: Pose,
  loco: 'walk' | 'run',
  t: number,
  travel?: Travel
): { phi: number; env: number } {
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
    const home = pivot[0] + limbStep(rig, pose, leg);
    const drift = legs.stance[leg] ? home - toRoot(rig, pose, leg, pivot)[0] : 0;
    // A swinging leg with a knee bends to lift its foot, and so does a planted one where
    // the gait gives; otherwise the leg slides up into the body.
    const bends = shift < 0 && !!rig.bends[leg] && (gait.give || !legs.stance[leg]);
    const slide = bends ? 0 : shift;
    // A shift on screen, written in the frame of whatever the leg hangs from.
    const r = parentTurn(rig, pose, leg) * RAD;
    pose.off[leg] = [
      drift * Math.cos(r) + slide * Math.sin(r),
      -drift * Math.sin(r) + slide * Math.cos(r),
    ];
    if (bends) raiseFoot(rig, pose, leg, -shift);
  }
  return { phi: TAU * pl.phase, env: pl.env };
}

/**
 * Raise a leg's foot straight up by `by` by bending the knee: the thigh comes forward and
 * the shin folds back, the way a leg gives under weight or lifts to clear the ground (on
 * a hock, `Rig.hocks`, the other way round). The foot ends exactly where sliding the leg
 * up would have put it.
 */
export function raiseFoot(rig: Rig, pose: Pose, leg: string, by: number): void {
  const knee = rig.bends[leg];
  const pivot = rigPart(rig, leg).pivot;
  const thigh = knee[1] - pivot[1];
  const shin = rig.height - knee[1];
  const hip = toRoot(rig, pose, leg, pivot);
  const foot = toRoot(rig, pose, leg, [pivot[0], rig.height]);
  const vx = foot[0] - hip[0];
  const vy = foot[1] - by - hip[1];
  const d = Math.min(
    thigh + shin - 1e-6,
    Math.max(Math.abs(thigh - shin) + 1e-6, Math.hypot(vx, vy))
  );
  // Angles from straight down, positive turning the foot back, as for `rot`.
  const toFoot = Math.atan2(-vx, vy);
  const open = Math.acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
  // A knee comes forward of the line to the foot; a hock goes behind it.
  const up = rig.hocks?.includes(leg) ? toFoot + open : toFoot - open;
  const kx = hip[0] - thigh * Math.sin(up);
  const ky = hip[1] + thigh * Math.cos(up);
  const down = Math.atan2(-(hip[0] + vx - kx), hip[1] + vy - ky);
  pose.rot[leg] = up / RAD - parentTurn(rig, pose, leg);
  pose.bend[leg] = (down - up) / RAD;
}

/**
 * Put these feet back on the base line after a verb has moved the body (a crouch, a
 * landing, sitting down): a leg the body has come down onto bends at the knee, or slides
 * up into the body when it has none; one the body has lifted slides down to the line.
 */
export function plantFeet(rig: Rig, pose: Pose, legs: string[]): void {
  for (const leg of legs) {
    if (!rig.parts[leg]) continue;
    const shift = rig.height - footPoint(rig, pose, leg)[1];
    if (shift < 0 && rig.bends[leg]) {
      raiseFoot(rig, pose, leg, -shift);
      continue;
    }
    const r = parentTurn(rig, pose, leg) * RAD;
    const [ox, oy] = pose.off[leg] ?? [0, 0];
    pose.off[leg] = [ox + shift * Math.sin(r), oy + shift * Math.cos(r)];
  }
}
