import { clamp01, easeInOut, hash01, TAU } from './easing.js';
import { plantFeet, raiseFoot, stride, toRoot, type Travel } from './gait.js';
import { QUADRUPED, type Rig } from './rigs.js';
import type { Emotion, Verb } from './types.js';

/** Everything the composer needs to draw one actor at one instant. */
export interface Pose {
  /** Degrees per part, applied around the rig pivot. */
  rot: Record<string, number>;
  /**
   * Degrees per limb at its knee or elbow (`Rig.bends`); positive folds the lower half
   * back, so a knee bends positive and an elbow, which folds the forearm forward, negative.
   */
  bend: Record<string, number>;
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
  /**
   * How far the face and body are turned toward the way the actor faces (`Rig.turn`): 1 is
   * the three-quarter view a character stands in, 0 looks straight out of the screen, 2 is
   * side-on.
   */
  yaw: number;
  /** Seen from behind: the face is hidden and parts with a `back` variant use it. */
  back: boolean;
  /**
   * Coming out of the screen, face to the viewer, 0..1: what hangs behind the head (a
   * plait) is drawn behind the body too, where it would otherwise lie across the chest.
   * Part way, it is behind the body and fading out in front of it.
   */
  toward?: number;
  /**
   * How much the limbs (`Rig.turn`) swing into and out of the screen rather than across it,
   * 0..1: their sideways swing about the shoulder or hip shrinks by this share.
   */
  depth: number;
  /**
   * The ground shadow when the body is not standing over its feet (lying down): its centre
   * moved by `dx` canonical units and its width times `scale`.
   */
  shadow?: { dx: number; scale: number };
}

export type Locomotion = 'idle' | 'walk' | 'run' | 'move' | 'fly';

export function emptyPose(): Pose {
  return {
    rot: {},
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
}

/** Add to a part's offset: a verb layered on a held one (a shiver while sat) keeps it. */
function nudge(pose: Pose, part: string, x: number, y: number): void {
  const [ox, oy] = pose.off[part] ?? [0, 0];
  pose.off[part] = [ox + x, oy + y];
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
  pickup: 1.2,
  putdown: 1.2,
};

/**
 * A stoop to the floor (`pickup`, `putdown`): down over the first part, a beat at the
 * bottom, back up. `grab` is the share of the action at which the hand is down: where a
 * pickup takes hold of the prop and a putdown lets go of it.
 */
export const STOOP = { down: 0.42, grab: 0.5, up: 0.58 };

/** How far down a stoop is at progress u: 0 standing, 1 with the hand at the floor. */
export function stoopDepth(u: number): number {
  if (u < STOOP.down) return easeInOut(u / STOOP.down);
  if (u < STOOP.up) return 1;
  return 1 - easeInOut((u - STOOP.up) / (1 - STOOP.up));
}

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
      const { phi } = stride(QUADRUPED, p, 'walk', t, travel);
      p.rot.head = 2.5 * Math.cos(2 * phi);
      p.rot.tail = 9 * Math.sin(phi);
      p.rot.earL = p.rot.earR = 3 * Math.cos(2 * phi);
      break;
    }
    case 'run': {
      const { phi } = stride(QUADRUPED, p, 'run', t, travel);
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
        // A hanging arm is never quite straight.
        p.bend.armL = p.bend.armR = -8;
        p.rot.head = 1.5 * Math.sin((TAU * (t + phase * 5)) / 5);
      }
      break;
    }
    case 'walk':
    case 'run': {
      const run = loco === 'run';
      if (humanoid) {
        const { phi, env } = stride(rig, p, loco, t, travel);
        // On the move a person turns further toward the way they go than standing.
        p.yaw = 1 + (run ? 0.5 : 0.35) * env;
        // Each arm swings against the leg on its side, from the shoulder, and bends at the
        // elbow as it comes forward; a runner holds the elbows bent and pumps them, from
        // the first stride to the last.
        for (const [arm, leg] of [
          ['armL', 'legL'],
          ['armR', 'legR'],
        ]) {
          const a = run ? 6 * env - p.rot[leg]! : -0.8 * p.rot[leg]!;
          p.rot[arm] = a;
          p.bend[arm] = run ? -8 + (-72 + 0.4 * a) * env : -10 - 0.9 * Math.max(0, -a);
        }
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
const DEG = 180 / Math.PI;
/** How far behind the hips a person's back is (the torso spans x 60..140): what lies on the floor. */
const BACK_DEPTH = 40;
/** How far short of the floor a lying animal's folded feet stop (see `lie`). */
const LIE_TUCK = 10;
const mix = (a: number, b: number, u: number): number => a + (b - a) * u;
/** How far below the hips a person sits: on the seat of the trousers. */
const SEAT_DEPTH = 12;
/**
 * How far above the seat a person's hips are, with the floor `seat` below it: on the seat
 * of their trousers, unless a kurta or a coat drawn longer (`Rig.hem`) would reach through
 * the floor. Then on that, as cloth bunched on the ground; over a seat it just hangs.
 */
const seatDepth = (rig: Rig, seat: number): number =>
  Math.max(SEAT_DEPTH, (rig.hem ?? 0) - rig.parts.legR.pivot[1] - seat);

/**
 * A leg folding to sit, with its foot on a floor `h` below the hip: the thigh comes
 * forward and up to `raise` degrees above level, never lower than `lowest` (a thigh on a
 * seat stays level, one on the way down can point at the floor), and the shin reaches
 * from the knee to the floor, or hangs straight down when it cannot. The thigh is the
 * leg's hip-to-knee length; the shin runs on to the base line. Returns the thigh's turn
 * and the knee's bend, in degrees.
 */
function foldLeg(
  rig: Rig,
  leg: string,
  h: number,
  raise: number,
  lowest: number
): [number, number] {
  const thigh = rig.bends[leg][1] - rig.parts[leg].pivot[1];
  const shin = rig.height - rig.bends[leg][1];
  // A knee raised too high would leave the foot in the air: lower it until the shin reaches.
  const fits = Math.asin(Math.max(-1, Math.min(1, (shin - h) / thigh))) * DEG;
  const e = Math.max(lowest, Math.min(raise, fits)) / DEG;
  const drop = h + thigh * Math.sin(e);
  const reach = Math.acos(Math.min(1, Math.max(0, drop) / shin));
  const turn = -90 - e * DEG;
  return [turn, -reach * DEG - turn];
}

/**
 * A four-legged animal turning round to face the other way; the mirror flips halfway
 * (`sideOf`). The head leads, lifting and swinging back toward where it is going before
 * the body follows; the body dips as it brings its weight round; the tail swings wide and
 * lags. Standing, the feet step round in diagonal pairs, so it turns on its feet instead
 * of spinning on them; `busy` (walking, sitting) leaves the legs to what they are doing.
 */
export function quadrupedTurn(pose: Pose, u: number, busy: boolean): void {
  const add = (part: string, deg: number) => (pose.rot[part] = (pose.rot[part] ?? 0) + deg);
  const lead = Math.sin(Math.PI * clamp01(u / 0.6));
  add('head', -16 * lead);
  nudge(pose, 'head', -3 * lead, -2 * lead);
  add('tail', 28 * Math.sin(Math.PI * u));
  add('earL', -10 * lead);
  add('earR', -10 * lead);
  pose.dy += 4 * Math.sin(Math.PI * u);
  if (busy) return;
  const step = (a: number, b: number) =>
    u > a && u < b ? 9 * Math.sin((Math.PI * (u - a)) / (b - a)) : 0;
  for (const [leg, lift] of [
    ['legFR', step(0.08, 0.5)],
    ['legBL', step(0.08, 0.5)],
    ['legFL', step(0.5, 0.92)],
    ['legBR', step(0.5, 0.92)],
  ] as const)
    if (lift > 0.01) raiseFoot(QUADRUPED, pose, leg, lift);
}

/** Quadruped verbs: the near front paw does what the humanoid's near arm does. */
function quadrupedVerb(rig: Rig, pose: Pose, verb: Verb, u: number): boolean {
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
      nudge(pose, 'body', j, 0);
      nudge(pose, 'head', j * 0.5, 0);
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
      nudge(pose, 'head', 3 * n, 0);
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
      // hind legs fold at the knee with the paws forward on the floor, the front legs stay
      // straight and keep their paws planted on the way down. `u` is how far down (0
      // standing, 1 sat).
      const k = easeInOut(u);
      pose.off.body = [0, 46 * k];
      pose.rot.body = -24 * k;
      for (const leg of ['legBL', 'legBR']) {
        // Folded for how high the hip is now, so the paw stays on the floor all the way down.
        const hip = toRoot(QUADRUPED, pose, 'body', QUADRUPED.parts[leg].pivot);
        const h = QUADRUPED.height - hip[1];
        const [turn, bend] = foldLeg(QUADRUPED, leg, h, 0, -90 * (1 - k));
        pose.rot[leg] = turn - pose.rot.body;
        pose.bend[leg] = bend;
      }
      pose.rot.legFL = pose.rot.legFR = 24 * k;
      add('head', 18 * k);
      add('tail', -40 * k);
      if (k < 1) plantFeet(QUADRUPED, pose, ['legFL', 'legFR']);
      return true;
    }
    case 'lie': {
      // From sitting: the body comes level and down onto its belly, the front legs fold
      // forward along the floor, the hind legs stay folded under, and the head goes down
      // onto the paws. `u` is how far down (0 sitting, 1 lying).
      const l = easeInOut(u);
      const [ox, oy] = pose.off.body ?? [0, 0];
      pose.off.body = [ox, mix(oy, rig.height - (rig.belly ?? rig.height), l)];
      pose.rot.body = (pose.rot.body ?? 0) * (1 - l);
      for (const leg of QUAD_LEGS) {
        const hip = toRoot(QUADRUPED, pose, 'body', QUADRUPED.parts[leg].pivot);
        // Folded to a floor a little higher than the real one: a hoof across the end of a
        // slanted shin would reach below the belly with its corner.
        const floor = QUADRUPED.height - hip[1] - LIE_TUCK * l;
        const [turn, bend] = foldLeg(QUADRUPED, leg, floor, 0, -90);
        const hind = leg.startsWith('legB');
        // The hind legs are already folded; the front ones go from planted to folded.
        pose.rot[leg] = hind
          ? turn - pose.rot.body
          : mix(pose.rot[leg] ?? 0, turn - pose.rot.body, l);
        pose.bend[leg] = hind ? bend : mix(pose.bend[leg] ?? 0, bend, l);
      }
      // The neck sinks into the shoulders rather than the head tipping onto its face.
      add('head', 12 * l);
      nudge(pose, 'head', 4 * l, 26 * l);
      add('tail', 30 * l);
      return true;
    }
    case 'pickup':
    case 'putdown': {
      // The head goes down to the floor in front, where the mouth takes or leaves it.
      const k = stoopDepth(u);
      add('body', 6 * k);
      add('head', 44 * k);
      nudge(pose, 'head', 6 * k, 14 * k);
      add('tail', -10 * k);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Layer a timed verb over the base pose. `u` is progress 0..1 through the action; for
 * `sit` it is how far down the actor is, so sitting and standing can ease, and `seat` is
 * how far below the hips the floor is (canonical units; 0 sits on the ground).
 */
export function applyVerb(rig: Rig, pose: Pose, verb: Verb, u: number, seat = 0): void {
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
  if (rig.name === 'quadruped' && quadrupedVerb(rig, pose, verb, u)) return;
  switch (verb) {
    case 'wave': {
      const k = settle(u, 0.18, 0.18);
      // The upper arm goes up and the hand waves from the elbow.
      if (humanoid) {
        const w = Math.sin(u * TAU * 2.5);
        pose.rot.armR = k * (-75 + 5 * w);
        pose.bend.armR = k * (-65 + 25 * w);
      } else pose.rot.body = 8 * Math.sin(u * TAU * 2.5) * k;
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
        nudge(pose, 'head', j, 0);
        nudge(pose, 'torso', j * 0.6, 0);
      } else pose.dx += j;
      break;
    }
    case 'nod': {
      const n = Math.sin(u * TAU * 2);
      pose.rot.head = (pose.rot.head ?? 0) + 6 * n;
      nudge(pose, 'head', 0, 5 * Math.max(0, n));
      if (!humanoid) nudge(pose, 'body', 0, 6 * Math.max(0, n));
      break;
    }
    case 'shake': {
      const n = Math.sin(u * TAU * 3);
      nudge(pose, 'head', 9 * n, 0);
      if (!humanoid) pose.rot.body = 10 * n;
      break;
    }
    case 'jump': {
      const { crouch, air, arc, squash } = jumpBeats(u);
      if (humanoid) {
        // Knees bend into a crouch, arms swing back, then throw up.
        pose.dy += 26 * crouch;
        pose.rot.torso = (pose.rot.torso ?? 0) + 10 * crouch;
        pose.rot.armL = 40 * crouch - 140 * air;
        pose.rot.armR = 40 * crouch - 140 * air;
        pose.bend.armL = pose.bend.armR = -20 * crouch - 8 * (1 - air);
        // In the air the knees bend and the feet tuck back under the body.
        pose.rot.legL = -24 * air;
        pose.rot.legR = 4 * air;
        pose.bend.legL = 50 * air;
        pose.bend.legR = 36 * air;
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
    case 'pickup':
    case 'putdown': {
      // A stoop: the knees bend with the feet planted, the back leans over from the hips and
      // the near arm hangs down from the shoulder to the floor in front, where the hand
      // takes the prop or leaves it; the head keeps half an eye on it.
      const k = stoopDepth(u);
      if (humanoid) {
        pose.dy += 58 * k;
        pose.rot.torso = (pose.rot.torso ?? 0) + 44 * k;
        pose.rot.head = (pose.rot.head ?? 0) - 16 * k;
        pose.rot.armR = mix(pose.rot.armR ?? 0, -54, k);
        pose.bend.armR = mix(pose.bend.armR ?? 0, -6, k);
        pose.rot.armL = mix(pose.rot.armL ?? 0, -34, k);
        pose.bend.armL = mix(pose.bend.armL ?? 0, -30, k);
        plantFeet(rig, pose, ['legL', 'legR']);
      } else {
        pose.rot.body = (pose.rot.body ?? 0) + 22 * k;
        pose.dx += 8 * k;
        pose.sy *= 1 - 0.08 * k;
      }
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
        // The seat of the trousers, just under the hips, lands on the anchor (on the ground,
        // a long kurta's hem does: see seatDepth); the knees bend so the feet reach the floor
        // `seat` below, or the legs stretch out on the ground with the knees up a little.
        const k = easeInOut(u);
        const depth = seatDepth(rig, seat);
        const fall = rig.height - rig.parts.legR.pivot[1] - depth;
        for (const leg of ['legL', 'legR']) {
          // Folded for how high the hips are now: on the way down the feet stay on the floor.
          const [turn, bend] = foldLeg(
            rig,
            leg,
            fall * (1 - k) + depth + seat * k,
            20,
            -90 * (1 - k)
          );
          pose.rot[leg] = turn;
          pose.bend[leg] = bend;
        }
        // Hands come to rest on the thighs.
        pose.rot.armL = -10 * k;
        pose.rot.armR = -10 * k;
        pose.bend.armL = pose.bend.armR = mix(-8, -25, k);
        // Standing, the feet are on the floor `seat` below the anchor; sat, the hips are on it.
        pose.dy += fall * k + seat * (1 - k);
        pose.rot.torso = 0;
      }
      break;
    case 'lie': {
      // From sitting on the ground: the torso turns back about the hips until the back is
      // on the floor, the hips come up to the back's depth, the head tips forward as on a
      // pillow, the arms rest along the body and the legs stretch out. `u` is how far
      // back (0 sitting, 1 lying).
      const l = easeInOut(u);
      if (humanoid) {
        pose.dy -= (BACK_DEPTH - seatDepth(rig, seat)) * l;
        pose.rot.torso = (pose.rot.torso ?? 0) - 90 * l;
        pose.rot.head = (pose.rot.head ?? 0) + 20 * l;
        pose.rot.armL = mix(pose.rot.armL ?? 0, 2, l);
        pose.rot.armR = mix(pose.rot.armR ?? 0, 4, l);
        pose.bend.armL = mix(pose.bend.armL ?? 0, -6, l);
        pose.bend.armR = mix(pose.bend.armR ?? 0, -6, l);
        for (const leg of ['legL', 'legR']) {
          const [turn, bend] = foldLeg(rig, leg, BACK_DEPTH, 5, 0);
          pose.rot[leg] = mix(pose.rot[leg] ?? 0, turn, l);
          pose.bend[leg] = mix(pose.bend[leg] ?? 0, bend, l);
        }
        // The shadow runs from the head, a whole torso behind the hips, to the feet.
        const hip = rig.parts.legR.pivot[1];
        pose.shadow = {
          dx: ((-hip + 0.85 * (rig.height - hip)) / 2) * l,
          scale: 1 + ((0.9 * rig.height) / rig.shadow - 1) * l,
        };
      } else {
        // Settle down, lower and wider.
        pose.sy *= 1 - 0.2 * l;
        pose.sx *= 1 + 0.12 * l;
      }
      break;
    }
    default:
      break;
  }
}

/**
 * The head's reaction to a change of emotion, as (tilt degrees, rise, stretch): surprise
 * and fear throw the head back and up, joy lifts it, sadness drops it, anger juts it down
 * and forward. Down and forward are positive tilts, as for a look.
 */
const TAKES: Record<Emotion, [number, number, number]> = {
  neutral: [3, 0, 0],
  happy: [-6, 5, 0.03],
  sad: [9, -3, -0.025],
  surprised: [-10, 8, 0.045],
  angry: [6, 2, 0.02],
  scared: [-8, 6, 0.04],
};

/** A take: a quick move into the reaction with a little overshoot, then easing back. */
export function applyTake(rig: Rig, pose: Pose, emotion: Emotion, u: number): void {
  const k = u < 0.25 ? backOut(u / 0.25, 1.6) : 1 - easeInOut((u - 0.25) / 0.75);
  const [tilt, rise, stretch] = TAKES[emotion];
  const head = rig.name === 'simple' ? 'body' : 'head';
  pose.rot[head] = (pose.rot[head] ?? 0) + tilt * k * (head === 'body' ? 0.5 : 1);
  if (head === 'head') {
    const [ox, oy] = pose.off.head ?? [0, 0];
    pose.off.head = [ox, oy - rise * k];
  }
  pose.sy *= 1 + stretch * k;
  pose.sx *= 1 - stretch * 0.5 * k;
}

/** Choose a variant for a multi-variant part, with graceful fallback. */
export function pickVariant(
  variants: Record<string, string>,
  part: string,
  wanted: string[]
): string {
  for (const w of wanted) if (variants[w] !== undefined) return w;
  if (variants.default !== undefined) return 'default';
  // The back is only for when the character is seen from behind.
  const first = Object.keys(variants).find((k) => k !== 'back');
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
  /** A voiced line's mouth, open or shut with its sound; else talking flaps on a rhythm. */
  mouth?: boolean;
  /** Absolute shot time, for blink and mouth-flap timing. */
  t: number;
  phase: number;
  /** Close the eyes now, whatever the blink cycle says (a take). */
  blink?: boolean;
  /** Seen from behind: every part with a `back` variant uses it. */
  back?: boolean;
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
    if (ctx.back && part.back !== undefined) {
      out[name] = 'back';
      continue;
    }
    if (ctx.overrides[name]) wanted = [ctx.overrides[name]];
    else if (prefs[name]) wanted = [...prefs[name]];

    if (name === 'mouth' && ctx.talking && !ctx.overrides.mouth) {
      const flap =
        ctx.mouth ?? Math.sin(ctx.t * TAU * 4.1) + 0.6 * Math.sin(ctx.t * TAU * 6.7) > 0.15;
      if (flap) wanted = ['open', ...wanted];
    }
    if (name === 'eyes' && !ctx.overrides.eyes) {
      const cycle = 3.4 + ctx.phase * 1.5;
      const at = ctx.t + ctx.phase * cycle;
      const inCycle = at % cycle;
      // Now and then (a fixed choice per cycle, so frames agree) a second quick blink.
      const twice = hash01(`${ctx.phase}:${Math.floor(at / cycle)}`) < 0.3;
      if (ctx.blink || inCycle < 0.13 || (twice && inCycle > 0.3 && inCycle < 0.41))
        wanted = ['closed', ...wanted];
    }
    out[name] = pickVariant(part, name, wanted);
  }
  return out;
}
