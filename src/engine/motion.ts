import { clamp01, easeInOut, hash01, TAU } from './easing.js';
import { plantFeet, stride, type Travel } from './gait.js';
import { QUADRUPED, type Rig } from './rigs.js';
import type { Emotion, Verb } from './types.js';

/** Everything the composer needs to draw one actor at one instant. */
export interface Pose {
  /** Degrees per part, applied around the rig pivot. */
  rot: Record<string, number>;
  /** Pixel offsets per part in canonical units. */
  off: Record<string, [number, number]>;
  /** Whole-body offset and scale (about the feet). */
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  /** Whole-body rotation about the box centre (spin). */
  spin: number;
  /** Chosen variant per multi-variant part. */
  face: Record<string, string>;
}

export type Locomotion = 'idle' | 'walk' | 'run' | 'move' | 'fly';

export function emptyPose(): Pose {
  return { rot: {}, off: {}, dx: 0, dy: 0, sx: 1, sy: 1, spin: 0, face: {} };
}

const MOVE_VERBS: ReadonlySet<Verb> = new Set(['walk', 'run', 'move', 'fly', 'jump']);
export const isMoveVerb = (v: Verb): boolean => MOVE_VERBS.has(v);

/** Pixels per second in scene space for locomotion verbs. */
export const SPEED: Record<string, number> = {
  walk: 220,
  run: 420,
  move: 300,
  fly: 260,
  jump: 300,
};

/** Default seconds for timed verbs. */
export const VERB_DURATION: Partial<Record<Verb, number>> = {
  jump: 0.8,
  wave: 1.5,
  nod: 0.8,
  shake: 0.8,
  point: 1.5,
  tremble: 1.2,
  bounce: 1.0,
  spin: 0.8,
  appear: 0.4,
  disappear: 0.4,
};

/** Resting face for an emotion, in order of preference per part. */
export const EMOTION_FACE: Record<Emotion, Record<string, string[]>> = {
  neutral: { mouth: ['closed', 'smile'], eyes: ['open'] },
  happy: { mouth: ['smile', 'closed'], eyes: ['happy', 'open'] },
  sad: { mouth: ['sad', 'closed'], eyes: ['sad', 'open'] },
  surprised: { mouth: ['open', 'closed'], eyes: ['wide', 'open'] },
  angry: { mouth: ['angry', 'sad', 'closed'], eyes: ['angry', 'open'] },
  scared: { mouth: ['scared', 'open', 'closed'], eyes: ['wide', 'open'] },
};

/**
 * Breathing: a slow stretch about the feet, so the chest rises and the feet stay on the
 * line (moving the whole body would lift them).
 */
function breathe(p: Pose, t: number, phase: number, depth: number): void {
  p.sy *= 1 + depth * Math.sin((TAU * (t + phase * 3.6)) / 3.6);
}

/**
 * Quadruped cycles. Walk and run plant their feet (see gait.ts); this adds what rides on
 * top: the head rising as the body dips, the tail and ears swinging, the gallop's
 * reach and tuck of the head.
 */
function quadrupedBase(p: Pose, loco: Locomotion, t: number, phase: number, travel?: Travel): void {
  switch (loco) {
    case 'idle':
      breathe(p, t, phase, 0.012);
      p.rot.tail = 7 * Math.sin((TAU * (t + phase * 2.6)) / 2.6);
      p.rot.head = 2 * Math.sin((TAU * (t + phase * 5)) / 5);
      break;
    case 'walk': {
      const phi = stride(QUADRUPED, p, 'walk', t, travel);
      p.rot.head = 2.5 * Math.cos(2 * phi);
      p.rot.tail = 9 * Math.sin(phi);
      p.rot.earL = p.rot.earR = 3 * Math.cos(2 * phi);
      break;
    }
    case 'run': {
      const phi = stride(QUADRUPED, p, 'run', t, travel);
      const g = Math.sin(phi);
      p.rot.head = -5 * g;
      p.rot.tail = -18 + 8 * g;
      p.rot.earL = p.rot.earR = -14 + 4 * g;
      break;
    }
    case 'move':
      break;
    case 'fly':
      p.dy = 6 * Math.sin(TAU * t * 1.2);
      p.rot.body = 3 * Math.sin(TAU * t * 0.8);
      p.rot.legFL = p.rot.legFR = -32;
      p.rot.legBL = p.rot.legBR = 32;
      p.rot.tail = -20;
      p.rot.earL = p.rot.earR = -16;
      break;
  }
}

/**
 * Base locomotion cycle. `t` is seconds since the actor started this locomotion; `travel`
 * is how far the current move has got, which drives the leg cycle so feet do not slide.
 * Without it (sheets, tests) a walk or run cycles at its own cadence.
 */
export function basePose(
  rig: Rig,
  loco: Locomotion,
  t: number,
  phase: number,
  travel?: Travel
): Pose {
  const p = emptyPose();
  if (rig.name === 'quadruped') {
    quadrupedBase(p, loco, t, phase, travel);
    return p;
  }
  const humanoid = rig.name === 'humanoid';
  switch (loco) {
    case 'idle': {
      breathe(p, t, phase, humanoid ? 0.008 : 0.015);
      if (humanoid) {
        const sway = 2 * Math.sin((TAU * (t + phase * 4)) / 4);
        p.rot.armL = sway;
        p.rot.armR = -sway;
        p.rot.head = 1.5 * Math.sin((TAU * (t + phase * 5)) / 5);
      }
      break;
    }
    case 'walk':
    case 'run': {
      const run = loco === 'run';
      if (humanoid) {
        const phi = stride(rig, p, loco, t, travel);
        // Each arm swings against the leg on its side.
        const k = run ? 1.1 : 0.85;
        p.rot.armL = -k * p.rot.legL! + (run ? -20 : 0);
        p.rot.armR = -k * p.rot.legR! + (run ? -20 : 0);
        p.rot.torso = (run ? 9 : 3) + (run ? 2 : 1) * Math.cos(2 * phi);
        p.rot.head = -(run ? 6 : 2) - (run ? 2 : 1) * Math.cos(2 * phi);
      } else {
        // No legs: a hop per stride, paced by the distance covered when there is one.
        const hop = 0.9 * rig.height;
        const u = travel ? travel.dist / hop : t / (run ? 0.21 : 0.31);
        const s = Math.sin(Math.PI * u);
        p.dy = -(run ? 10 : 6) * Math.abs(s);
        p.rot.body = (run ? 6 : 4) * Math.sin(TAU * u * 0.5);
      }
      break;
    }
    case 'move':
      break;
    case 'fly': {
      p.dy = 6 * Math.sin(TAU * t * 1.2);
      p.rot[humanoid ? 'torso' : 'body'] = 5 * Math.sin(TAU * t * 0.8);
      if (humanoid) {
        p.rot.armL = -140;
        p.rot.armR = -140;
      }
      break;
    }
  }
  return p;
}

/** Ease in and out of a held pose over the first and last `1/k` of the action. */
const hold = (u: number, k = 4): number => Math.min(1, u * k, (1 - u) * k);

/** 0 to 1, passing 1 by a few percent and settling back: a limb thrown to a pose. */
const backOut = (x: number, s = 1.2): number => {
  const y = clamp01(x) - 1;
  return 1 + y * y * ((s + 1) * y + s);
};

/** A held pose: in with overshoot over the first `a` of the action, eased out over the last `b`. */
function settle(u: number, a = 0.2, b = 0.2): number {
  if (u < a) return backOut(u / a);
  if (u > 1 - b) return 1 - easeInOut((u - (1 - b)) / b);
  return 1;
}

/**
 * The three beats of a jump as fractions of its duration: crouch, flight, landing. The
 * timeline moves the actor across the ground only during the flight.
 */
export const JUMP = { launch: 0.2, land: 0.82, height: 90 };

/** Where in the jump: crouch depth (0..1) before take-off and after landing, and the arc. */
function jumpBeats(u: number): { crouch: number; air: number; arc: number; squash: number } {
  const { launch, land } = JUMP;
  if (u < launch)
    return { crouch: Math.sin((u / launch) * Math.PI * 0.85), air: 0, arc: 0, squash: 0 };
  if (u < land) {
    const v = (u - launch) / (land - launch);
    return { crouch: 0, air: Math.sin(v * Math.PI), arc: 4 * v * (1 - v), squash: 0 };
  }
  // The give starts on contact: down fast, back up slowly.
  const w = (u - land) / (1 - land);
  const k = w < 0.3 ? Math.sin((w / 0.3) * Math.PI * 0.5) : 1 - easeInOut((w - 0.3) / 0.7);
  return { crouch: 0.8 * k, air: 0, arc: 0, squash: k };
}

const QUAD_LEGS = ['legFL', 'legFR', 'legBL', 'legBR'];

/** Quadruped verbs: the near front paw does what the humanoid's near arm does. */
function quadrupedVerb(pose: Pose, verb: Verb, u: number): boolean {
  const add = (part: string, deg: number) => (pose.rot[part] = (pose.rot[part] ?? 0) + deg);
  switch (verb) {
    case 'wave': {
      const k = settle(u, 0.18, 0.18);
      pose.rot.legFR = k * (-78 + 16 * Math.sin(u * TAU * 2.5));
      add('head', -4 * k);
      return true;
    }
    case 'point': {
      const k = settle(u);
      pose.rot.legFR = -58 * k;
      add('head', -5 * k);
      add('tail', -10 * k);
      return true;
    }
    case 'tremble': {
      const j = Math.sin(u * TAU * 11) * 4 * Math.sin(u * Math.PI);
      pose.off.body = [j, 0];
      pose.off.head = [j * 0.5, 0];
      add('tail', 6 * Math.sin(u * TAU * 9));
      return true;
    }
    case 'nod': {
      const n = Math.sin(u * TAU * 2);
      add('head', 8 * n);
      return true;
    }
    case 'shake': {
      const n = Math.sin(u * TAU * 3);
      add('head', 9 * n);
      pose.off.head = [3 * n, 0];
      add('earL', -8 * n);
      add('earR', -8 * n);
      return true;
    }
    case 'jump': {
      // Gather on bent legs with the haunches low, a stretched leap, a squash on landing.
      const { crouch, air, arc, squash } = jumpBeats(u);
      pose.dy += 12 * crouch - JUMP.height * arc;
      add('body', -5 * crouch - 7 * air * Math.cos(Math.PI * arc));
      pose.rot.legFL = pose.rot.legFR = -38 * air;
      pose.rot.legBL = pose.rot.legBR = 38 * air;
      add('tail', 10 * crouch - 22 * air);
      add('earL', -16 * air);
      add('earR', -16 * air);
      if (!air) plantFeet(QUADRUPED, pose, QUAD_LEGS);
      pose.sy *= 1 - 0.1 * squash;
      pose.sx *= 1 + 0.08 * squash;
      return true;
    }
    case 'sit': {
      // The body tips back about the hips and drops until the rump meets the floor; the
      // hind legs fold forward along it, the front legs stay straight and keep their paws
      // planted on the way down. `u` is how far down (0 standing, 1 sat).
      const k = easeInOut(u);
      pose.off.body = [0, 46 * k];
      pose.rot.body = -24 * k;
      pose.rot.legBL = pose.rot.legBR = -58 * k;
      pose.rot.legFL = pose.rot.legFR = 24 * k;
      add('head', 18 * k);
      add('tail', -40 * k);
      if (k < 1) plantFeet(QUADRUPED, pose, ['legFL', 'legFR']);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Layer a timed verb over the base pose. `u` is progress 0..1 through the action; for
 * `sit` it is how far down the actor is, so sitting and standing can ease.
 */
export function applyVerb(rig: Rig, pose: Pose, verb: Verb, u: number): void {
  const humanoid = rig.name === 'humanoid';
  u = clamp01(u);
  if (verb === 'appear' || verb === 'disappear') {
    // Pop in past full size and settle; on the way out, swell a touch and shrink away.
    const k =
      verb === 'appear'
        ? 0.55 + 0.45 * backOut(u, 2.2)
        : u < 0.25
          ? 1 + 0.06 * Math.sin((u / 0.25) * Math.PI * 0.5)
          : 1.06 - 0.56 * easeInOut((u - 0.25) / 0.75);
    pose.sx *= k;
    pose.sy *= k;
    return;
  }
  if (rig.name === 'quadruped' && quadrupedVerb(pose, verb, u)) return;
  switch (verb) {
    case 'wave': {
      const k = settle(u, 0.18, 0.18);
      if (humanoid) pose.rot.armR = k * (-135 + 22 * Math.sin(u * TAU * 2.5));
      else pose.rot.body = 8 * Math.sin(u * TAU * 2.5) * k;
      break;
    }
    case 'point': {
      const k = settle(u);
      if (humanoid) {
        pose.rot.armR = -95 * k;
        pose.rot.torso = (pose.rot.torso ?? 0) - 3 * k;
      } else {
        // No arm to raise: lean the whole body toward the thing, held for the duration.
        pose.rot.body = -24 * k;
        pose.dx += 18 * k;
      }
      break;
    }
    case 'tremble': {
      // Fast small shiver, fading in and out so it does not pop.
      const env = Math.sin(u * Math.PI);
      const j = Math.sin(u * TAU * 11) * 5 * env;
      if (humanoid) {
        pose.off.head = [j, 0];
        pose.off.torso = [j * 0.6, 0];
      } else pose.dx += j;
      break;
    }
    case 'nod': {
      const n = Math.sin(u * TAU * 2);
      pose.rot.head = (pose.rot.head ?? 0) + 6 * n;
      pose.off.head = [0, 5 * Math.max(0, n)];
      if (!humanoid) pose.off.body = [0, 6 * Math.max(0, n)];
      break;
    }
    case 'shake': {
      const n = Math.sin(u * TAU * 3);
      pose.off.head = [9 * n, 0];
      if (!humanoid) pose.rot.body = 10 * n;
      break;
    }
    case 'jump': {
      const { crouch, air, arc, squash } = jumpBeats(u);
      if (humanoid) {
        // Knees bend (the legs slide up behind the torso), arms swing back, then throw up.
        pose.dy += 26 * crouch;
        pose.rot.torso = (pose.rot.torso ?? 0) + 10 * crouch;
        pose.rot.armL = 40 * crouch - 140 * air;
        pose.rot.armR = 40 * crouch - 140 * air;
        pose.rot.legL = -12 * air;
        pose.rot.legR = 12 * air;
        pose.off.legL = [0, -10 * air];
        pose.off.legR = [0, -10 * air];
        if (!air) plantFeet(rig, pose, ['legL', 'legR']);
      }
      pose.dy -= JUMP.height * arc;
      if (!humanoid) {
        pose.sy *= 1 - 0.12 * crouch;
        pose.sx *= 1 + 0.08 * crouch;
      }
      pose.sy *= 1 - 0.1 * squash;
      pose.sx *= 1 + 0.08 * squash;
      break;
    }
    case 'bounce': {
      const k = Math.abs(Math.sin(u * Math.PI * 2));
      pose.dy += -45 * k;
      const land = 1 - k;
      pose.sy *= 1 - 0.1 * land * land;
      pose.sx *= 1 + 0.08 * land * land;
      break;
    }
    case 'spin':
      // Wind back a little first, then round with a small overshoot.
      pose.spin =
        u < 0.2
          ? -18 * Math.sin((u / 0.2) * Math.PI * 0.5)
          : -18 + 378 * backOut((u - 0.2) / 0.8, 0.8);
      break;
    case 'sit':
      if (humanoid) {
        // hips land on the anchor, legs forward, feet hanging just below the seat
        const k = easeInOut(u);
        pose.rot.legL = -60 * k;
        pose.rot.legR = -60 * k;
        pose.rot.armL = -25 * k;
        pose.rot.armR = -25 * k;
        pose.dy += 128 * k;
        pose.rot.torso = 0;
      }
      break;
    default:
      break;
  }
}

/** Choose a variant for a multi-variant part, with graceful fallback. */
export function pickVariant(
  variants: Record<string, string>,
  part: string,
  wanted: string[]
): string {
  for (const w of wanted) if (variants[w] !== undefined) return w;
  if (variants.default !== undefined) return 'default';
  const first = Object.keys(variants)[0];
  return first ?? part;
}

/**
 * Where an emotion will not get the variant it prefers, in words the author can act on:
 * "angry: eyes → open (no 'angry')". Only parts with variants are reported.
 */
export function faceFallbacks(parts: Record<string, string | Record<string, string>>): string[] {
  const out: string[] = [];
  for (const [emotion, prefs] of Object.entries(EMOTION_FACE) as [
    Emotion,
    Record<string, string[]>,
  ][]) {
    for (const [name, wanted] of Object.entries(prefs)) {
      const part = parts[name];
      if (!part || typeof part === 'string') continue;
      const picked = pickVariant(part, name, wanted);
      if (picked !== wanted[0]) out.push(`${emotion}: ${name} → ${picked} (no '${wanted[0]}')`);
    }
  }
  return out;
}

export interface FaceContext {
  emotion: Emotion;
  /** Explicit overrides from a `face` action. */
  overrides: Record<string, string>;
  talking: boolean;
  /** Absolute shot time, for blink and mouth-flap timing. */
  t: number;
  phase: number;
}

/** Decide the variant of every multi-variant part. */
export function resolveFace(
  parts: Record<string, string | Record<string, string>>,
  ctx: FaceContext
): Record<string, string> {
  const out: Record<string, string> = {};
  const prefs = EMOTION_FACE[ctx.emotion];
  for (const [name, part] of Object.entries(parts)) {
    if (typeof part === 'string') continue;
    let wanted: string[] = [];
    if (ctx.overrides[name]) wanted = [ctx.overrides[name]];
    else if (prefs[name]) wanted = [...prefs[name]];

    if (name === 'mouth' && ctx.talking && !ctx.overrides.mouth) {
      const flap = Math.sin(ctx.t * TAU * 4.1) + 0.6 * Math.sin(ctx.t * TAU * 6.7) > 0.15;
      if (flap) wanted = ['open', ...wanted];
    }
    if (name === 'eyes' && !ctx.overrides.eyes) {
      const cycle = 3.4 + ctx.phase * 1.5;
      const at = ctx.t + ctx.phase * cycle;
      const inCycle = at % cycle;
      // Now and then (a fixed choice per cycle, so frames agree) a second quick blink.
      const twice = hash01(`${ctx.phase}:${Math.floor(at / cycle)}`) < 0.3;
      if (inCycle < 0.13 || (twice && inCycle > 0.3 && inCycle < 0.41))
        wanted = ['closed', ...wanted];
    }
    out[name] = pickVariant(part, name, wanted);
  }
  return out;
}
