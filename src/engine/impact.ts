import { groundOf, inArea, type Ground } from './area.js';
import { easeOut, hash01 } from './easing.js';
import { n } from './svg.js';
import { resolveActor, type ActorState } from './timeline.js';
import type { Project, Scene, Shot } from './types.js';

/**
 * What coming down makes: dust where a jump or a drop lands on the ground, a splash where
 * it lands in water or where someone walks into it, and rings spreading round whatever
 * moves in the water (a swimmer, a wader, a duck gliding). Read off how each actor moves,
 * so a shot has them without asking for them; drawn at the actor's feet (`renderImpacts`),
 * the far half of a ring behind it and the near half in front.
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

/** Dust off a path or a floor, and the paler, thinner dust off grass. */
const DUST = { hard: ['#b99a72', 1], grass: ['#d6cca0', 0.85] } as const;
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
  surface: 'hard' | 'grass' = 'hard'
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
 * The surface part of impacts on waterlines, drawn over the scene's foreground: each kept
 * to its own water's outline, so none of it shows over the bank, or over someone on it.
 */
export function overForeground(scene: Scene, impacts: Impact[], id: string): string {
  let out = '';
  for (const [i, w] of (scene.water ?? []).entries()) {
    const on = impacts.filter((b) => b.water === i);
    const svg = renderImpacts(on, 'surface');
    if (!svg) continue;
    const d = 'M' + w.area.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
    out +=
      `<clipPath id='tk-water-${id}-${i}'><path d='${d}'/></clipPath>` +
      `<g clip-path='url(#tk-water-${id}-${i})'>${svg}</g>`;
  }
  return out;
}
