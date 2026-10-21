import { clamp01, TAU } from './easing.js';
import type { Rig } from './rigs.js';
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
  appear: 0.3,
  disappear: 0.3,
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

/** Quadruped leg length: shoulder and hip pivots at y=132, feet on y=200. */
const QUAD_LEG = 68;
const RAD = Math.PI / 180;
/** How far the body must drop for a leg swung `deg` off vertical to still reach the line. */
const legDrop = (deg: number): number => QUAD_LEG * (1 - Math.cos(deg * RAD));

/**
 * Quadruped cycles. Walk moves the legs in diagonal pairs (near front with far hind), the
 * pair swinging forward lifts its feet, and the body drops by exactly what the angled legs
 * lose so the feet on the ground stay on the line. Run is a gallop: a gathered pose (feet
 * bunched under the body) and a stretched one (reaching out, off the ground).
 */
function quadrupedBase(p: Pose, loco: Locomotion, t: number, phase: number): void {
  switch (loco) {
    case 'idle':
      p.dy = 1.2 * Math.sin((TAU * (t + phase * 3)) / 3);
      p.rot.tail = 7 * Math.sin((TAU * (t + phase * 2.6)) / 2.6);
      p.rot.head = 2 * Math.sin((TAU * (t + phase * 5)) / 5);
      break;
    case 'walk': {
      const phi = (TAU * t) / 0.7;
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      const a = 22 * s;
      p.rot.legFR = a;
      p.rot.legBL = a;
      p.rot.legFL = -a;
      p.rot.legBR = -a;
      // A positive angle swings the foot back, so a pair moves forward while its angle falls.
      const liftA = 7 * Math.max(0, -c);
      const liftB = 7 * Math.max(0, c);
      p.off.legFR = [0, -liftA];
      p.off.legBL = [0, -liftA];
      p.off.legFL = [0, -liftB];
      p.off.legBR = [0, -liftB];
      p.dy = legDrop(a);
      // The head rises as the body dips, twice a cycle; the tail swings once.
      p.rot.head = 2.5 * Math.cos(2 * phi);
      p.rot.tail = 9 * s;
      p.rot.earL = p.rot.earR = 3 * Math.cos(2 * phi);
      break;
    }
    case 'run': {
      const phi = (TAU * t) / 0.48;
      const g = Math.sin(phi); // 1 stretched, -1 gathered
      p.rot.legFR = -34 * g;
      p.rot.legFL = -34 * Math.sin(phi - 0.5);
      p.rot.legBR = 34 * Math.sin(phi - 0.3);
      p.rot.legBL = 34 * Math.sin(phi - 0.8);
      p.rot.body = -4 * Math.sin(phi + 0.8);
      p.dy = g > 0 ? -14 * g : legDrop(34 * g);
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

/** Base locomotion cycle. `t` is seconds since the actor started this locomotion. */
export function basePose(rig: Rig, loco: Locomotion, t: number, phase: number): Pose {
  const p = emptyPose();
  if (rig.name === 'quadruped') {
    quadrupedBase(p, loco, t, phase);
    return p;
  }
  const humanoid = rig.name === 'humanoid';
  switch (loco) {
    case 'idle': {
      p.dy = 1.5 * Math.sin((TAU * (t + phase * 3)) / 3);
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
      const period = run ? 0.42 : 0.62;
      const phi = (TAU * t) / period;
      const s = Math.sin(phi);
      if (humanoid) {
        const leg = run ? 42 : 28;
        const arm = run ? 38 : 24;
        p.rot.legL = leg * s;
        p.rot.legR = -leg * s;
        p.rot.armL = -arm * s;
        p.rot.armR = arm * s;
        p.rot.torso = run ? 9 : 3;
        p.dy = -(run ? 8 : 4) * Math.abs(s);
      } else {
        p.dy = -(run ? 10 : 6) * Math.abs(s);
        p.rot.body = (run ? 6 : 4) * s;
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

/** Quadruped verbs: the near front paw does what the humanoid's near arm does. */
function quadrupedVerb(pose: Pose, verb: Verb, u: number): boolean {
  const add = (part: string, deg: number) => (pose.rot[part] = (pose.rot[part] ?? 0) + deg);
  switch (verb) {
    case 'wave':
      pose.rot.legFR = hold(u, 6) * (-78 + 16 * Math.sin(u * TAU * 2.5));
      add('head', -4 * hold(u, 6));
      return true;
    case 'point': {
      const k = hold(u);
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
      // Gather (a crouch with the feet bunched under), then a stretched leap and a squash.
      const launch = 0.18;
      if (u < launch) {
        const k = Math.sin((u / launch) * Math.PI);
        pose.dy += 10 * k;
        pose.rot.legFL = pose.rot.legFR = 16 * k;
        pose.rot.legBL = pose.rot.legBR = -16 * k;
        add('tail', 10 * k);
      } else {
        const v = (u - launch) / (1 - launch);
        pose.dy += -90 * 4 * v * (1 - v);
        const k = Math.sin(v * Math.PI);
        pose.rot.legFL = pose.rot.legFR = -38 * k;
        pose.rot.legBL = pose.rot.legBR = 38 * k;
        pose.rot.body = -7 * Math.cos(v * Math.PI) * hold(v, 5);
        add('tail', -22 * k);
        add('earL', -16 * k);
        add('earR', -16 * k);
        if (v > 0.85) {
          const q = Math.sin(((v - 0.85) / 0.15) * Math.PI);
          pose.sy *= 1 - 0.1 * q;
          pose.sx *= 1 + 0.08 * q;
        }
      }
      return true;
    }
    case 'sit':
      // The body tips back about the hips and drops until the rump meets the floor; the
      // hind legs fold forward along it, the front legs stay straight and plant again.
      pose.off.body = [0, 46];
      pose.rot.body = -24;
      pose.rot.legBL = pose.rot.legBR = -58;
      pose.rot.legFL = pose.rot.legFR = 24;
      add('head', 18);
      add('tail', -40);
      return true;
    default:
      return false;
  }
}

/** Layer a timed verb over the base pose. `u` is progress 0..1 through the action. */
export function applyVerb(rig: Rig, pose: Pose, verb: Verb, u: number): void {
  const humanoid = rig.name === 'humanoid';
  u = clamp01(u);
  if (rig.name === 'quadruped' && quadrupedVerb(pose, verb, u)) return;
  switch (verb) {
    case 'wave':
      if (humanoid) pose.rot.armR = -135 + 22 * Math.sin(u * TAU * 2.5);
      else pose.rot.body = 8 * Math.sin(u * TAU * 2.5);
      break;
    case 'point':
      if (humanoid) pose.rot.armR = -95;
      else {
        // No arm to raise: lean the whole body toward the thing, held for the duration,
        // easing in and out so it neither pops in nor snaps back.
        const k = Math.min(1, u * 4, (1 - u) * 4);
        pose.rot.body = -24 * k;
        pose.dx += 18 * k;
      }
      break;
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
      const h = 90;
      pose.dy += -h * 4 * u * (1 - u);
      if (humanoid) {
        pose.rot.armL = -140;
        pose.rot.armR = -140;
        pose.rot.legL = -12;
        pose.rot.legR = 12;
      }
      // squash on landing
      if (u > 0.88) {
        const k = Math.sin(((u - 0.88) / 0.12) * Math.PI);
        pose.sy *= 1 - 0.1 * k;
        pose.sx *= 1 + 0.08 * k;
      }
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
      pose.spin = 360 * u;
      break;
    case 'sit':
      if (humanoid) {
        // hips land on the anchor, legs forward, feet hanging just below the seat
        pose.rot.legL = -60;
        pose.rot.legR = -60;
        pose.rot.armL = -25;
        pose.rot.armR = -25;
        pose.dy += 128;
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
      const inCycle = (ctx.t + ctx.phase * cycle) % cycle;
      if (inCycle < 0.13) wanted = ['closed', ...wanted];
    }
    out[name] = pickVariant(part, name, wanted);
  }
  return out;
}
