import { groundOf, inArea, type Ground } from './area.js';
import { poseFor, sideOf } from './actor.js';
import { easeOut, hash01 } from './easing.js';
import { footPoint, gaitPhase, legFalls } from './gait.js';
import { rigOf } from './rigs.js';
import { staged } from './stage.js';
import { n } from './svg.js';
import { resolveActor, type ActorState } from './timeline.js';
import type { Project, Scene, Shot } from './types.js';

/**
 * What coming down makes: dust where a jump or a drop lands on the ground, a splash where
 * it lands in water or where someone walks into it, and rings spreading round whatever
 * moves in the water (a swimmer, a wader, a duck gliding). Read off how each actor moves,
 * so a shot has them without asking for them; drawn at the actor's feet (`renderImpacts`),
 * the far half of a ring behind it and the near half in front. And what moving leaves
 * behind: the V of a wake trailing a swimmer (`wakeAt`), and footprints in sand and snow
 * (`printsOf`).
 */

export type ImpactKind = 'dust' | 'splash' | 'ring';

/** Where and when something came down, or a ring left the one in the water. */
export interface Landing {
  at: number;
  x: number;
  y: number;
  /** How big to draw it: 1 for a grown-up at full size, less for smaller (as a root). */
  scale: number;
  kind: ImpactKind;
  /** A jump's landing, a drop's, or a walk into the water (a smaller splash). */
  how: 'jump' | 'fall' | 'wade';
  /**
   * On the waterline of this water (its index in the scene's `water`), which the scene
   * draws a foreground band down from: its surface part is drawn over that band.
   */
  water?: number;
}

export interface Impact extends Landing {
  /** Seconds since it came down. */
  age: number;
  salt: string;
}

/** Seconds each lasts. */
export const IMPACT_LIFE: Record<ImpactKind, number> = { dust: 0.7, splash: 0.9, ring: 1.6 };
/** Samples a second when finding where a jump or a drop comes down. */
const RATE = 60;
/** Seconds after a jump or drop begins in which it is looked for: it has landed by then. */
const WINDOW = 4;
/** Seconds between the rings round one moving in the water. */
const RING_EVERY = 0.5;
/** Pixels it must have gone in the last LOOK_BACK seconds to be moving. */
const MOVED = 1;
const LOOK_BACK = 0.12;
/** Pixels tall below which a landing raises nothing: a coin, a pebble. */
const SMALL = 40;
/** A grown-up's height in canonical units, the size the drawings are made at. */
const FULL = 250;

type Where = 'ground' | 'water' | undefined;

/** What a foot at p is on: a walk area wins over water under it (a stone in the river). */
function whereAt(ground: Ground, p: { x: number; y: number }): Where {
  if (ground.walk.some((a) => inArea(a, p))) return 'ground';
  if ([...ground.deep, ...ground.shallow].some((a) => inArea(a, p))) return 'water';
  // A scene that marks no walk areas is floor wherever it is stood on.
  return ground.walk.length ? undefined : 'ground';
}

/** The water at p with a waterline, if the scene draws one: its index and its line. */
function waterlineAt(scene: Scene, p: { x: number; y: number }) {
  const i = (scene.water ?? []).findIndex((w) => w.waterline !== undefined && inArea(w.area, p));
  return i < 0 ? undefined : { water: i, y: scene.water![i].waterline! };
}

/**
 * In the water with nothing holding it up out of it, and in the picture: not over it in the
 * air (flying, or in the middle of a jump or a drop, the feet up where the far water is).
 */
function wet(ground: Ground, s: ActorState): boolean {
  return (
    s.visible &&
    !s.heldBy &&
    !s.on &&
    !s.falling &&
    s.locomotion !== 'fly' &&
    !s.verbs.some((v) => v.verb === 'jump') &&
    whereAt(ground, s) === 'water'
  );
}

const MEMO = new WeakMap<Shot, Map<string, { project: Project; landings: Landing[] }>>();

/** Every landing, splash and ring of one actor through a shot, in time order. */
export function landingsOf(project: Project, shot: Shot, id: string): Landing[] {
  let byActor = MEMO.get(shot);
  if (!byActor) MEMO.set(shot, (byActor = new Map()));
  const known = byActor.get(id);
  if (known && known.project === project) return known.landings;
  const scene = project.scenes[shot.scene];
  const character = project.characters[id];
  const landings = scene && character && shot.cast[id] ? find(project, scene, shot, id) : [];
  byActor.set(id, { project, landings });
  return landings;
}

function find(project: Project, scene: Scene, shot: Shot, id: string): Landing[] {
  const ground = groundOf(scene);
  const height = project.characters[id].height;
  const at = (t: number) => resolveActor(project, scene, shot, id, t, 1);
  const out: Landing[] = [];
  const add = (t: number, s: ActorState, how: Landing['how'], kind?: ImpactKind) => {
    // Onto someone's back, a branch or a seat: nothing on the floor to raise.
    if (s.on || s.heldBy || s.seat > 0 || height * s.scale < SMALL) return;
    const where = whereAt(ground, s);
    kind ??= where === 'water' ? 'splash' : where === 'ground' ? 'dust' : undefined;
    if (!kind || out.some((o) => o.kind === kind && Math.abs(o.at - t) < 0.05)) return;
    // Smaller things raise less, but not in proportion: a frog's splash still shows.
    const scale = Math.sqrt(s.scale * (height / FULL)) * (how === 'wade' ? 0.55 : 1);
    // In water with a waterline: on the surface there, not down at the swimmer's feet.
    const line = kind === 'dust' ? undefined : waterlineAt(scene, s);
    out.push({
      at: t,
      x: s.x,
      y: line?.y ?? s.y,
      scale,
      kind,
      how,
      ...(line ? { water: line.water } : {}),
    });
  };

  // Jumps and drops: each comes down when its jump ends, or where its fall stops falling
  // (before the little bounce).
  const starts = shot.actions
    .filter((a) => a.actor === id && (a.do === 'jump' || a.do === 'fall' || a.attach === false))
    .map((a) => a.t)
    .sort((a, b) => a - b);
  let sampled = -1;
  for (const t0 of starts) {
    let prev: ActorState | undefined;
    let down = false;
    const from = Math.max(0, t0 - 1 / RATE, sampled + 1 / RATE);
    const to = Math.min(shot.duration, t0 + WINDOW);
    for (let f = Math.ceil(from * RATE); f <= to * RATE; f++) {
      const t = f / RATE;
      const s = at(t);
      if (prev) {
        const jumping = (x: ActorState) => x.verbs.some((v) => v.verb === 'jump');
        if (jumping(prev) && !jumping(s)) add(t, s, 'jump');
        if (s.falling && !prev.falling) down = true;
        if (down && prev.falling && (!s.falling || s.y < prev.y - 0.01)) {
          add(t - 1 / RATE, prev, 'fall');
          down = false;
        }
      }
      prev = s;
      sampled = t;
    }
  }

  // In the water: a ring every so often while it moves, and a splash where it walks in.
  if (ground.deep.length || ground.shallow.length) {
    let was: boolean | undefined;
    for (let k = 0; k * RING_EVERY <= shot.duration; k++) {
      const t = k * RING_EVERY;
      const s = at(t);
      const now = wet(ground, s);
      if (now) {
        const before = at(Math.max(0, t - LOOK_BACK));
        const moving =
          Math.hypot(s.x - before.x, s.y - before.y) > MOVED ||
          s.verbs.some((v) => v.verb === 'swim');
        if (moving) add(t, s, 'wade', 'ring');
      }
      if (was === false && now) {
        // Where it crossed in, to the nearest few hundredths of a second.
        let lo = t - RING_EVERY;
        let hi = t;
        let hit = s;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const m = at(mid);
          if (wet(ground, m)) [hi, hit] = [mid, m];
          else lo = mid;
        }
        // A jump or a drop into it has made its own splash.
        if (!out.some((o) => o.kind === 'splash' && Math.abs(o.at - hi) < 0.3))
          add(hi, hit, 'wade', 'splash');
      }
      was = s.visible && !s.heldBy ? now : undefined;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** What one actor has raised that still shows at shot time t. */
export function impactsAt(project: Project, shot: Shot, id: string, t: number): Impact[] {
  return landingsOf(project, shot, id).flatMap((l, i) => {
    const age = t - l.at;
    return age >= 0 && age < IMPACT_LIFE[l.kind]
      ? [{ ...l, age, salt: `${shot.id}:${id}:${i}` }]
      : [];
  });
}

/** Dust off a path or a floor, the paler, thinner dust off grass, sand off sand, powder off snow. */
const DUST: Record<Surface, readonly [string, number]> = {
  hard: ['#b99a72', 1],
  grass: ['#d6cca0', 0.85],
  sand: ['#e2c992', 1],
  snow: ['#ffffff', 0.9],
};
const WATER = '#eef8ff';
const DROP_EDGE = '#9cc8e0';

/** The far (back) or near (front) half of a flat ring on the water. */
function half(cx: number, cy: number, rx: number, ry: number, back: boolean): string {
  const [x0, x1] = back ? [cx - rx, cx + rx] : [cx + rx, cx - rx];
  return `M${n(x0)} ${n(cy)}A${n(rx)} ${n(ry)} 0 0 1 ${n(x1)} ${n(cy)}`;
}

function ring(cx: number, cy: number, rx: number, op: number, w: number, back: boolean) {
  return `<path d='${half(cx, cy, rx, rx * 0.28, back)}' fill='none' stroke='${WATER}' stroke-width='${n(w)}' stroke-opacity='${n(op)}' stroke-linecap='round'/>`;
}

/**
 * One part of the dust, splashes and rings an actor has raised. `back`, drawn before the
 * actor: the far side of each ring. `surface`: the near side of each ring and the foam, on
 * the water (over the scene's foreground band where the water has a waterline). `front`,
 * drawn after the actor: the spray, all above the water, and the dust.
 * Per-element opacity rather than a group's: resvg 2.6 can panic on nested opacity groups.
 */
export function renderImpacts(
  impacts: Impact[],
  part: 'back' | 'surface' | 'front',
  surface: Surface = 'hard'
): string {
  let out = '';
  const back = part === 'back';
  for (const b of impacts) {
    const u = b.age / IMPACT_LIFE[b.kind];
    const s = b.scale;
    if (b.kind === 'ring') {
      if (part === 'front') continue;
      const op = 0.75 * (1 - u) * Math.min(1, u * 6);
      out += ring(b.x, b.y, (40 + 90 * easeOut(u)) * s, op, Math.max(1.6, 3 * s), back);
    } else if (b.kind === 'dust') {
      if (part !== 'front') continue;
      // A low puff off the feet, its two sides rolling out along the floor and thinning.
      const [color, strength] = DUST[surface];
      const spread = easeOut(u);
      for (const k of [-1, 0, 1]) {
        const r = (k === 0 ? 14 + 16 * spread : 11 + 20 * spread) * s;
        const cx = b.x + k * (10 + 38 * spread) * s;
        const cy = b.y - (3 + (k === 0 ? 8 : 5) * spread) * s;
        const op = strength * (k === 0 ? 0.6 : 0.7) * (1 - u) * Math.min(1, u * 10);
        out += `<ellipse cx='${n(cx)}' cy='${n(cy)}' rx='${n(r)}' ry='${n(r * 0.42)}' fill='${color}' opacity='${n(op)}'/>`;
      }
    } else if (part !== 'front') {
      // Two rings going out, the second a moment behind the first; foam where it went in.
      for (const lag of [0, 0.25]) {
        const v = (u - lag) / (1 - lag);
        if (v > 0)
          out += ring(
            b.x,
            b.y,
            (24 + 130 * easeOut(v)) * s,
            0.85 * (1 - v),
            Math.max(1.8, 3.5 * s),
            back
          );
      }
      if (back) continue;
      const foam = (22 + 40 * easeOut(u)) * s;
      out += `<ellipse cx='${n(b.x)}' cy='${n(b.y)}' rx='${n(foam)}' ry='${n(foam * 0.32)}' fill='${WATER}' opacity='${n(0.8 * (1 - u) ** 1.5)}'/>`;
    } else {
      // Drops flung up and out both ways, gone as they fall back into the water.
      const drops = b.how === 'wade' ? 8 : 16;
      for (let i = 0; i < drops; i++) {
        const h = (k: string) => hash01(`${b.salt}:drop:${i}:${k}`);
        const vx = (h('vx') * 2 - 1) * 220 * s;
        const vy = -(300 + 360 * h('vy')) * s;
        const g = 1400 * s;
        const dy = vy * b.age + 0.5 * g * b.age * b.age;
        if (dy > 0) continue;
        const r = Math.max(1.5, (3.5 + 3.5 * h('r')) * s);
        out += `<circle cx='${n(b.x + vx * b.age)}' cy='${n(b.y + dy)}' r='${n(r)}' fill='${WATER}' stroke='${DROP_EDGE}' stroke-width='${n(0.8 * s)}' opacity='${n(0.9 * (1 - u))}'/>`;
      }
    }
  }
  return out ? `<g class='impact-${part}'>${out}</g>` : '';
}

/**
 * The surface part of impacts on waterlines, and the near arm of a wake on one, drawn over
 * the scene's foreground: each kept to its own water's outline, so none of it shows over
 * the bank, or over someone on it.
 */
export function overForeground(scene: Scene, impacts: Impact[], id: string, wake?: Wake): string {
  let out = '';
  for (const [i, w] of (scene.water ?? []).entries()) {
    const on = impacts.filter((b) => b.water === i);
    const svg =
      renderImpacts(on, 'surface') + (wake?.water === i ? renderWake(wake, 'surface') : '');
    if (!svg) continue;
    const d = 'M' + w.area.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
    out +=
      `<clipPath id='tk-water-${id}-${i}'><path d='${d}'/></clipPath>` +
      `<g clip-path='url(#tk-water-${id}-${i})'>${svg}</g>`;
  }
  return out;
}

// A swimmer's bow wave.

/** Samples a second of where a swimmer is, for its wake. */
const WAKE_RATE = 12;
/** Seconds a crest of the wake lasts behind the swimmer: how long it trails on after a stop. */
export const WAKE_LIFE = 1.4;
/** Crests drawn along each arm of the wake. */
const WAKE_CRESTS = 14;
/** How far the floor is foreshortened: a circle on the water is drawn this many times as tall. */
const FLAT = 0.28;
/**
 * How fast each crest spreads out sideways, against the swimmer's speed (tan 19.5°, the
 * angle of a ship's wake), and at the least, in pixels a second at full size.
 */
const SPREAD = 0.5;
const SPREAD_MIN = 40;
/** Ripples in each arm of a wake, one behind the other, and pixels apart at full size. */
const RIPPLES = 3;
const RIPPLE_GAP = 26;
/** Speed (pixels a second at full size) from which a wake shows whole, and below which none. */
const WAKE_FULL = 70;
const WAKE_FROM = 6;
/** How far forward of where it stands the swimmer's front is, as a share of its rig's width. */
const FRONT: Record<string, number> = { humanoid: 0.2, quadruped: 0.42, simple: 0.3 };

/** Where a swimmer was at one sample: on its waterline if it has one, at its feet if not. */
interface Wet {
  x: number;
  y: number;
  /** As a landing's `scale`: 1 for a grown-up at full size, as a root for smaller. */
  size: number;
  /** Pixels from where it stands to its front, at the waterline. */
  front: number;
  water?: number;
  /** Its velocity on screen, pixels a second. */
  vx: number;
  vy: number;
}

interface Crest {
  /** On the arm. */
  x: number;
  y: number;
  op: number;
  /** Stroke width. */
  w: number;
  /** From the crest to the same one on the next ripple back. */
  bx: number;
  by: number;
}

/** The two arms of a wake, each its crests from the swimmer's front back. */
export interface Wake {
  far: Crest[];
  near: Crest[];
  water?: number;
}

const TRACKS = new WeakMap<Shot, Map<string, { project: Project; track: (Wet | undefined)[] }>>();

/** Where an actor is in the water through a shot, WAKE_RATE times a second. */
function trackOf(project: Project, shot: Shot, id: string): (Wet | undefined)[] {
  let byActor = TRACKS.get(shot);
  if (!byActor) TRACKS.set(shot, (byActor = new Map()));
  const known = byActor.get(id);
  if (known && known.project === project) return known.track;
  const scene = project.scenes[shot.scene];
  const character = project.characters[id];
  let track: (Wet | undefined)[] = [];
  const ground = scene && groundOf(scene);
  // A look a few times a second first: most of a shot's cast never sets foot in the water.
  const ever = (rate: number) => {
    for (let f = 0; f <= shot.duration * rate; f++)
      if (wet(ground!, resolveActor(project, scene!, shot, id, f / rate, 1))) return true;
    return false;
  };
  if (ground && character && shot.cast[id] && scene.water?.length && ever(WAKE_RATE / 3)) {
    const rig = rigOf(character);
    const pts: (Omit<Wet, 'vx' | 'vy'> | undefined)[] = [];
    for (let f = 0; f <= shot.duration * WAKE_RATE; f++) {
      const s = resolveActor(project, scene, shot, id, f / WAKE_RATE, 1);
      if (!wet(ground, s)) {
        pts.push(undefined);
        continue;
      }
      const line = waterlineAt(scene, s);
      const k = (character.height / rig.height) * s.scale;
      pts.push({
        x: s.x,
        y: line?.y ?? s.y,
        size: Math.sqrt(s.scale * (character.height / FULL)),
        front: (FRONT[rig.name] ?? 0.3) * rig.width * k,
        ...(line ? { water: line.water } : {}),
      });
    }
    // Velocity from the samples either side, or the one beside it at an end of the swim.
    if (pts.some(Boolean))
      track = pts.map((p, i) => {
        if (!p) return undefined;
        const a = pts[i - 1] ?? p;
        const b = pts[i + 1] ?? p;
        const span = ((pts[i - 1] ? 1 : 0) + (pts[i + 1] ? 1 : 0)) / WAKE_RATE;
        return span
          ? { ...p, vx: (b.x - a.x) / span, vy: (b.y - a.y) / span }
          : { ...p, vx: 0, vy: 0 };
      });
  }
  byActor.set(id, { project, track });
  return track;
}

/** A swimmer's place at time t, between the samples either side; none out of the water. */
function wetAt(track: (Wet | undefined)[], t: number): Wet | undefined {
  if (t < 0) return undefined;
  const f = t * WAKE_RATE;
  const i = Math.floor(f);
  const a = track[i];
  const b = track[i + 1];
  const u = f - i;
  if (!a || !b) return a && u < 1e-6 ? a : undefined;
  const mix = (p: number, q: number) => p + (q - p) * u;
  return {
    ...a,
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    size: mix(a.size, b.size),
    front: mix(a.front, b.front),
    vx: mix(a.vx, b.vx),
    vy: mix(a.vy, b.vy),
  };
}

/**
 * The V of ripples trailing whatever moves through the water at shot time t, or nothing.
 * Each crest left the swimmer's front a while back and has spread out sideways since, so
 * the two arms open back from its front, longer and wider the faster it goes, and fade as
 * they go; when it stops, no more crests leave it and those out there fade away. Its front
 * is the way it moves, whichever way it faces.
 */
export function wakeAt(project: Project, shot: Shot, id: string, t: number): Wake | undefined {
  const track = trackOf(project, shot, id);
  if (!track.length) return undefined;
  const far: Crest[] = [];
  const near: Crest[] = [];
  let water: number | undefined;
  let shown = false;
  for (let i = 0; i <= WAKE_CRESTS; i++) {
    const age = (i / WAKE_CRESTS) * WAKE_LIFE;
    const p = wetAt(track, t - age);
    // Out of the water now, but just in: the crests it left go on fading.
    if (!p && !far.length) continue;
    if (!p || (far.length && p.water !== water)) break;
    water = p.water;
    // Along the water and across it: up and down the screen is depth, foreshortened.
    const gx = p.vx;
    const gy = p.vy / FLAT;
    const speed = Math.hypot(gx, gy);
    const strength = Math.min(1, Math.max(0, (speed / p.size - WAKE_FROM) / WAKE_FULL));
    const [ux, uy] = speed > 1e-6 ? [gx / speed, gy / speed] : [1, 0];
    const fx = p.x + ux * p.front;
    const fy = p.y + uy * p.front * FLAT;
    const spread = (SPREAD * speed + SPREAD_MIN * p.size) * age;
    // Across the way it goes; the arm that goes up the screen is the far one.
    const [ax, ay] = [-uy * spread, ux * spread * FLAT];
    const side = ay <= 0 ? 1 : -1;
    const u = age / WAKE_LIFE;
    const op = 0.9 * strength * (1 - u) ** 1.3;
    const w = Math.max(1.6, 3.4 * p.size) * (1 - 0.4 * u);
    if (op > 0.01) shown = true;
    // The ripples behind the first, each that much further back along the way it went.
    const gap = RIPPLE_GAP * p.size;
    far.push({ x: fx + ax * side, y: fy + ay * side, op, w, bx: -ux * gap, by: -uy * gap * FLAT });
    near.push({ x: fx - ax * side, y: fy - ay * side, op, w, bx: -ux * gap, by: -uy * gap * FLAT });
  }
  if (!shown) return undefined;
  return { far, near, ...(water !== undefined ? { water } : {}) };
}

/**
 * One arm of a wake: the far one (`back`, drawn behind the swimmer) or the near one
 * (`surface`, on the water in front of it). Each stretch between crests is its own stroke
 * with its own opacity (resvg 2.6 can panic on nested opacity groups).
 */
export function renderWake(wake: Wake | undefined, part: 'back' | 'surface'): string {
  if (!wake) return '';
  const arm = part === 'back' ? wake.far : wake.near;
  let out = '';
  const line = (d: string, w: number, op: number) =>
    `<path d='${d}' stroke='${WATER}' stroke-width='${n(w)}' stroke-opacity='${n(op)}' stroke-linecap='round' fill='none'/>`;
  for (let r = 0; r < RIPPLES; r++) {
    const fade = 0.6 ** r;
    // A ripple further back starts that far down the arm.
    for (let i = 1 + 2 * r; i < arm.length; i++) {
      const a = arm[i - 1];
      const b = arm[i];
      const op = ((a.op + b.op) / 2) * fade;
      if (op < 0.01) continue;
      const d = `M${n(a.x + a.bx * r)} ${n(a.y + a.by * r)}L${n(b.x + b.bx * r)} ${n(b.y + b.by * r)}`;
      out += line(d, ((a.w + b.w) / 2) * (1 - 0.2 * r), op);
    }
  }
  return out ? `<g class='wake-${part}'>${out}</g>` : '';
}

// Footprints.

/** The surfaces that keep a print, and the colour a print is pressed in on each. */
const PRINTED: Partial<Record<Surface, { color: string; op: number }>> = {
  sand: { color: '#5a3a1c', op: 0.4 },
  snow: { color: '#5b7398', op: 0.42 },
};
/** Samples a second when finding where feet come down. */
const PRINT_RATE = 30;
/** Seconds a print takes to fade to PRINT_KEEP of its first strength; it stays at that. */
const PRINT_FADE = 6;
const PRINT_KEEP = 0.55;
/** Canonical units the near foot's print is in front of the far one's, on the floor. */
const PRINT_APART = 22;

type Surface = Scene['surface'];

/** Where a foot came down in soft ground. */
export interface Print {
  at: number;
  x: number;
  y: number;
  /** Screen pixels a canonical unit of the actor's rig. */
  k: number;
  /** The way the toes point. */
  dir: 1 | -1;
  /** A shoe's sole and heel, or a paw's or a hoof's round pad. */
  kind: 'foot' | 'pad';
}

const PRINTS = new WeakMap<Shot, Map<string, { project: Project; prints: Print[] }>>();

/**
 * Every print an actor's feet leave in a shot, in time order: one where each foot comes
 * down in a walk or a run, on a scene whose `surface` keeps them (sand, snow). Only feet
 * on a walk area, out of the water, standing on the floor (not sitting, lying, carried,
 * ridden or up on something).
 */
export function printsOf(project: Project, shot: Shot, id: string): Print[] {
  let byActor = PRINTS.get(shot);
  if (!byActor) PRINTS.set(shot, (byActor = new Map()));
  const known = byActor.get(id);
  if (known && known.project === project) return known.prints;
  const scene = project.scenes[shot.scene];
  const character = project.characters[id];
  const prints =
    scene && character && shot.cast[id] && PRINTED[scene.surface]
      ? findPrints(project, scene, shot, id)
      : [];
  byActor.set(id, { project, prints });
  return prints;
}

function findPrints(project: Project, scene: Scene, shot: Shot, id: string): Print[] {
  const character = project.characters[id];
  const rig = rigOf(character);
  if (!rig.feet.length) return [];
  const goes = (a: Shot['actions'][number]) =>
    a.actor === id &&
    (a.do === 'walk' || a.do === 'run' || ((a.do === 'sit' || a.do === 'lie') && !!a.to));
  if (!staged(project, scene, shot).actions.some(goes)) return [];
  const ground = groundOf(scene);
  const water = [...ground.deep, ...ground.shallow];
  const at = (t: number) => resolveActor(project, scene, shot, id, t, 1);
  const out: Print[] = [];
  const press = (t: number, leg: string) => {
    const s = at(t);
    if (!s.visible || s.on || s.heldBy || s.seat > 0 || s.sit > 0 || s.lie > 0 || s.falling) return;
    if (character.height * s.scale < SMALL) return;
    const k = (character.height / rig.height) * s.scale;
    const side = sideOf(s) < 0 ? -1 : 1;
    const [fx] = footPoint(rig, poseFor(s, t), leg);
    // The legs on the far side are the left ones (the rigs face right).
    const far = /L$/.test(leg);
    const p = {
      x: s.x + (fx - rig.width / 2) * k * side,
      y: s.y + (far ? -1 : 1) * PRINT_APART * k * FLAT,
    };
    if (ground.walk.length && !ground.walk.some((a) => inArea(a, p))) return;
    if (water.some((a) => inArea(a, p))) return;
    out.push({ at: t, ...p, k, dir: side, kind: rig.name === 'humanoid' ? 'foot' : 'pad' });
  };
  let prev: { loco: string; phase: number; t: number } | undefined;
  for (let f = 0; f <= shot.duration * PRINT_RATE; f++) {
    const t = f / PRINT_RATE;
    const s = at(t);
    const loco = s.locomotion;
    const phase =
      (loco === 'walk' || loco === 'run') && s.travel && s.visible
        ? gaitPhase(rig, loco, s.travel)
        : undefined;
    if (phase === undefined) {
      prev = undefined;
      continue;
    }
    // Each foot comes down as the cycle passes its landing, as the footsteps are heard.
    if (prev && prev.loco === loco && phase > prev.phase)
      for (const [leg, land] of Object.entries(legFalls(rig, loco as 'walk' | 'run')))
        for (let c = Math.ceil(prev.phase - land); c + land <= phase; c++) {
          if (c + land <= prev.phase) continue;
          press(prev.t + ((c + land - prev.phase) / (phase - prev.phase)) * (t - prev.t), leg);
        }
    prev = { loco, phase, t };
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The prints every actor in the shot has left by time t, drawn on the floor under all of
 * them (and their shadows): small flat ellipses in perspective, darker than the ground,
 * fading a little as they age.
 */
export function renderPrints(project: Project, shot: Shot, t: number): string {
  const scene = project.scenes[shot.scene];
  const look = scene && PRINTED[scene.surface];
  if (!look) return '';
  let out = '';
  // An ellipse flat on the floor, as a subpath: a sole and its heel are one path, so where
  // they overlap is no darker.
  const oval = (cx: number, cy: number, rx: number) => {
    const ry = rx * FLAT * 1.6;
    return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
  };
  for (const id of Object.keys(shot.cast))
    for (const p of printsOf(project, shot, id)) {
      const age = t - p.at;
      if (age < 0) break;
      const op =
        look.op * Math.min(1, age / 0.08) * (1 - (1 - PRINT_KEEP) * Math.min(1, age / PRINT_FADE));
      // A foot: the sole forward of the ankle, the heel under it. A paw or a hoof: its pad.
      const d =
        p.kind === 'foot'
          ? oval(p.x + p.dir * 18 * p.k, p.y, 18 * p.k) + oval(p.x - p.dir * 4 * p.k, p.y, 10 * p.k)
          : oval(p.x + p.dir * 4 * p.k, p.y, 13 * p.k);
      out += `<path d='${d}' fill='${look.color}' opacity='${n(op)}'/>`;
    }
  return out ? `<g class='prints'>${out}</g>` : '';
}
