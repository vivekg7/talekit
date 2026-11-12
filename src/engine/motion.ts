import { clamp01, easeInOut, easeOut, hash01, TAU } from './easing.js';
import { parentTurn, plantFeet, raiseFoot, stride, toRoot, type Pt, type Travel } from './gait.js';
import { HUMANOID, QUADRUPED, type Rig } from './rigs.js';
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
  /**
   * Degrees per link of a chain part (`Rig.links`), root first, on top of each link's share
   * of the part's turn: the follow-through running down a tail.
   */
  curl?: Record<string, number[]>;
  /** Lying down, 0..1 (`lie`): what is done lying (eating off the floor) reaches less far. */
  lying?: number;
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
  /**
   * Parts drawn with their whole outline though the rig fuses them (`Rig.fuse`): a lying
   * animal's near hind leg, folded against its side, never leaves the body, so a line only
   * where it does would leave none and the leg would vanish into the flank.
   */
  loose?: string[];
  /**
   * How far what the near hand carries is swung from upright, in degrees, its top toward
   * the way the actor faces (a stick brought down in a `strike`); 0 or unset, it is held
   * as drawn.
   */
  wield?: number;
  /**
   * How far what the near hand carries is brought down onto the floor in front, 0..1 (a
   * `dig`): at 1 its working end (`Character.tip`) touches the floor, whatever the arm and
   * the tool's length; the swing (`wield`) is solved for it where the prop is placed.
   */
  bite?: number;
  /**
   * Drawing a bow (`aim`), for the bow and arrow the hands hold: `deg` the line of the aim,
   * degrees above level toward the facing; `turn` how far the bow is turned from as drawn to
   * stand across that line, 0..1; `draw` how far the string is pulled back to the near hand,
   * 0..1; `twang` seconds since the string was loosed, while it still shivers; `raise` how
   * far the bow is up from the archer's side, 0..1; `hand` how far it has been handed from
   * the near hand, which carries it, to the far one, which holds it to shoot, 0..1.
   */
  bow?: { deg: number; turn: number; draw: number; twang?: number; raise: number; hand: number };
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
  wipe: 2.4,
  kick: 0.9,
  eat: 1.6,
  strike: 0.7,
  swim: 3,
  dig: 2.5,
  hold: 2,
  aim: 3,
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
function quadrupedBase(
  rig: Rig,
  p: Pose,
  loco: Locomotion,
  t: number,
  phase: number,
  travel?: Travel
): void {
  switch (loco) {
    case 'idle':
      breathe(p, t, phase, 0.012);
      p.rot.tail = 7 * Math.sin((TAU * (t + phase * 2.6)) / 2.6);
      p.rot.head = 2 * Math.sin((TAU * (t + phase * 5)) / 5);
      break;
    case 'walk': {
      const { phi } = stride(rig, p, 'walk', t, travel);
      p.rot.head = 2.5 * Math.cos(2 * phi);
      p.rot.tail = 9 * Math.sin(phi);
      p.rot.earL = p.rot.earR = 3 * Math.cos(2 * phi);
      break;
    }
    case 'run': {
      const { phi } = stride(rig, p, 'run', t, travel);
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
    quadrupedBase(rig, p, loco, t, phase, travel);
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
/** How far a lying animal's head sinks into its shoulders. */
const LIE_HEAD = 10;
/** How steeply a lying animal's forearm comes down to the paw, at most, degrees. */
const LIE_PAW = 40;

/**
 * A front leg stretched out in front of a lying animal, its shoulder `h` above the floor:
 * the upper leg reaches forward and down, no lower than will let the forearm come down at
 * `LIE_PAW` (less steeply, when the shoulder is lower than that), and the forearm reaches
 * on to the paw on the floor. Returns the turn and the elbow's bend, as foldLeg.
 */
function reachOut(rig: Rig, leg: string, h: number): [number, number] {
  const upper = rig.bends[leg][1] - rig.parts[leg].pivot[1];
  const forearm = rig.height - rig.bends[leg][1];
  const elbow = Math.max(0, Math.min(h, forearm * Math.sin(LIE_PAW / DEG)));
  const turn = -Math.acos(Math.min(1, (h - elbow) / upper)) * DEG;
  return [turn, -90 + Math.asin(elbow / forearm) * DEG - turn];
}

/**
 * A hooved front leg folded under a lying animal, its shoulder `h` above the floor: the
 * upper leg forward to a knee on the floor in front of the chest, the cannon folded back
 * under it, the hoof tucked beneath the chest. Returns the turn and the bend, as foldLeg.
 */
function tuckUnder(rig: Rig, leg: string, h: number): [number, number] {
  const upper = rig.bends[leg][1] - rig.parts[leg].pivot[1];
  const turn = -90 + Math.asin(Math.min(1, Math.max(0, h / upper))) * DEG;
  return [turn, 80 - turn];
}
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
 * A sprawling reptile letting its belly down onto the floor, `k` of the way (0 standing):
 * the body comes straight down, level, and the feet stay where they stand, so the knees
 * and elbows rise out at its sides.
 */
function sprawlDown(rig: Rig, pose: Pose, k: number): void {
  const [ox, oy] = pose.off.body ?? [0, 0];
  pose.off.body = [ox, oy + (rig.height - (rig.belly ?? rig.height)) * k];
  plantFeet(rig, pose, QUAD_LEGS);
}

/**
 * A four-legged animal turning round to face the other way; the mirror flips halfway
 * (`sideOf`). The head leads, lifting and swinging back toward where it is going before
 * the body follows; the body dips as it brings its weight round; the tail swings wide and
 * lags. Standing, the feet step round in diagonal pairs, so it turns on its feet instead
 * of spinning on them; `busy` (walking, sitting) leaves the legs to what they are doing.
 */
export function quadrupedTurn(rig: Rig, pose: Pose, u: number, busy: boolean): void {
  const add = (part: string, deg: number) => (pose.rot[part] = (pose.rot[part] ?? 0) + deg);
  const lead = Math.sin(Math.PI * clamp01(u / 0.6));
  add('head', -16 * lead);
  nudge(pose, 'head', -3 * lead, -2 * lead);
  // A sprawling reptile's tail sweeps round along the ground, not up off it.
  if (!rig.sprawl) add('tail', 28 * Math.sin(Math.PI * u));
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
    if (lift > 0.01) raiseFoot(rig, pose, leg, lift);
}

/**
 * The beats of a kick: `draw` (0..1) pulls the leg back with the knee bent, then `out`
 * snaps it out straight past where it ends, holds and brings it home.
 */
function kickBeats(u: number): { draw: number; out: number } {
  if (u < 0.3) return { draw: easeInOut(u / 0.3), out: 0 };
  if (u < 0.45)
    return { draw: 1 - easeInOut((u - 0.3) / 0.15), out: backOut((u - 0.3) / 0.15, 1.4) };
  if (u < 0.7) return { draw: 0, out: 1 };
  return { draw: 0, out: 1 - easeInOut((u - 0.7) / 0.3) };
}

/** A `strike`: the share of it at which the blow lands (where to put the thud). */
export const STRIKE_HIT = 0.55;

/**
 * The beats of a `strike`: `up` winds the arm up and back over the head, `down` chops it
 * forward through the blow, fast, which lands at STRIKE_HIT; a beat there, then back.
 */
function strikeBeats(u: number): { up: number; down: number } {
  if (u < 0.4) return { up: easeInOut(u / 0.4), down: 0 };
  if (u < STRIKE_HIT) {
    const s = Math.pow((u - 0.4) / (STRIKE_HIT - 0.4), 1.6);
    return { up: 1 - s, down: s };
  }
  if (u < 0.75) return { up: 0, down: 1 };
  return { up: 0, down: 1 - easeInOut((u - 0.75) / 0.25) };
}

/** Seconds a stroke of a `dig` takes, about: a `dig` is as many whole strokes as fit. */
export const DIG_STROKE = 1.25;
/** A `dig` stroke: the share of it at which the blade bites the soil. */
export const DIG_HIT = 0.5;

/** How long a `dig`'s clods fly and settle after each blow, seconds. */
export const SOIL_TIME = 0.75;

/** How many strokes a `dig` of `span` seconds makes. */
export function digStrokes(span: number): number {
  return Math.max(1, Math.round(span / DIG_STROKE));
}

/** When each stroke of a `dig` of `span` seconds bites, in seconds from its start. */
export function digHits(span: number): number[] {
  const n = digStrokes(span);
  return Array.from({ length: n }, (_, i) => ((i + DIG_HIT) * span) / n);
}

/**
 * The beats of a `dig`, at u of a span of `span` seconds: `k` how far into the digging
 * stance it is (eased in over the first stroke's wind-up, out over the last one's recovery),
 * and within each stroke `up` the tool raised over the shoulder, `bite` its blade down in the
 * soil (from the blow to the end of the pull) and `pull` the draw back through it toward
 * the feet. The blow is fast; the pull and the lift are heavy.
 */
function digBeats(u: number, span: number): { k: number; up: number; bite: number; pull: number } {
  const n = digStrokes(span);
  const p = (u * n) % 1;
  const first = u * n < 1;
  const ramp = Math.min(0.4, 0.4 / n);
  const k = settle(u, ramp, ramp);
  const LIFT = 0.38;
  if (p < LIFT) {
    // Up out of the soil (where the last stroke left it) and over the shoulder.
    const up = easeInOut(p / LIFT);
    if (first) return { k, up, bite: 0, pull: 0 };
    return { k, up, bite: 1 - easeInOut(Math.min(1, p / 0.14)), pull: 1 - up };
  }
  if (p < DIG_HIT) {
    // The blow: fast, the blade arriving at the soil as the arm comes down.
    const s = (p - LIFT) / (DIG_HIT - LIFT);
    return { k, up: 1 - Math.pow(s, 1.7), bite: Math.pow(s, 3), pull: 0 };
  }
  // In the soil: drawn back toward the feet, then a beat before the next lift.
  return { k, up: 0, bite: 1, pull: easeInOut(Math.min(1, (p - DIG_HIT) / 0.35)) };
}

/**
 * The timing of an `aim`, seconds: the bow comes up and the string is drawn over `draw`; a
 * shot is followed through for `follow` before the bow comes down, which takes `lower`.
 */
export const AIM = { draw: 0.6, follow: 0.45, lower: 0.5 };

/** How an arrow at rest on a lowered bow points: this many degrees below level. */
export const NOCKED_DOWN = -25;

/**
 * Where the drawing hand comes to on the face, in the head's frame as drawn (a person facing
 * right): the near jaw, under the cheekbone, behind the mouth the turn slides forward.
 */
export const ANCHOR: Pt = [94, 141];
/** The far hand, at the end of the far arm hanging straight: the bow hand (`Rig.farHold`). */
export const FAR_HAND: Pt = HUMANOID.farHold!.point;
/**
 * How far the near shoulder comes back and up as the string is drawn (box units): the
 * shoulder blade pulled in behind the draw, so the folded arm's elbow goes back past the
 * head instead of dropping under the chin.
 */
const DRAW_SHOULDER: Pt = [-34, -10];
/**
 * How far the far shoulder comes forward and up behind the bow (box units): side-on, it
 * lies behind the near one, and pushing the bow out it puts the bow hand clear of the face.
 */
const BOW_SHOULDER: Pt = [14, -4];
/**
 * The hand-over of a carried bow as an aim begins, seconds in: the near hand, carrying it,
 * brings it out in front to meet the far hand coming up, where that is at `meet`; it
 * passes to the far hand from `pass`, over `passing`, both hands on it; the near hand
 * leaves it from `leave` and is on the string `toString` later.
 */
const HAND_OVER = { meet: 0.26, pass: 0.21, passing: 0.08, leave: 0.28, toString: 0.14 };
/** Box units from the bow hand back to the string at rest, about: where the draw starts. */
const BRACE = 30;
/** How far the drawing hand flicks back past the anchor as it lets go (box units). */
const FLICK = 16;

/**
 * The beats of an `aim` at `e` seconds into one of `span` seconds, loosed `loose` seconds in
 * (if it is): `raise` the bow arm up to the line and the drawing arm up to the string,
 * `pull` the string back from rest to the cheek, `flick` the hand thrown back as it lets
 * go, `down` the bow coming down at the end.
 */
export function aimBeats(
  e: number,
  span: number,
  loose?: number
): { raise: number; pull: number; flick: number; down: number } {
  const down = easeInOut(clamp01((e - (span - AIM.lower)) / AIM.lower));
  let raise = easeInOut(clamp01(e / (0.75 * AIM.draw)));
  let pull = easeInOut(clamp01((e - 0.3 * AIM.draw) / (0.7 * AIM.draw)));
  let flick = 0;
  if (loose !== undefined && e >= loose) {
    pull = 0;
    flick = easeOut(clamp01((e - loose) / 0.1));
  } else pull *= 1 - easeInOut(clamp01((e - (span - AIM.lower)) / (0.5 * AIM.lower)));
  raise *= 1 - down;
  return { raise, pull, flick, down };
}

/**
 * Put the hand at the end of `arm` on `target` (box units in the root frame, before the
 * body offset): the upper arm swings from the shoulder and the forearm folds at the elbow,
 * the elbow below the line from shoulder to hand (`up` false) or above it. Out of reach
 * the hand gets as near as it can, the arm straight. Mixed in by `k`, the short way round
 * from where the arm is, or (`forward`) swung up in front of the body; the elbow's bend by
 * `fold`, if that is to go at its own pace.
 */
function armTo(
  rig: Rig,
  pose: Pose,
  arm: string,
  hand: Pt,
  target: Pt,
  up: boolean,
  k: number,
  forward = false,
  fold = k
) {
  const part = rig.parts[arm];
  const elbow = rig.bends[arm];
  if (!part || !elbow || k <= 0) return;
  const upper = Math.hypot(elbow[0] - part.pivot[0], elbow[1] - part.pivot[1]);
  const fore = Math.hypot(hand[0] - elbow[0], hand[1] - elbow[1]);
  const [sx, sy] = toRoot(rig, pose, arm, part.pivot);
  const gx = target[0] - sx;
  const gy = target[1] - sy;
  const d = Math.min(
    Math.max(Math.hypot(gx, gy), Math.abs(upper - fore) + 1),
    0.999 * (upper + fore)
  );
  const side = up ? -1 : 1;
  const spread = Math.acos(clampCos((upper ** 2 + d ** 2 - fore ** 2) / (2 * upper * d)));
  const folded =
    Math.PI - Math.acos(clampCos((upper ** 2 + fore ** 2 - d ** 2) / (2 * upper * fore)));
  const ua = Math.atan2(gy, gx) + side * spread;
  const fa = ua - side * folded;
  const swing = (ua - Math.atan2(elbow[1] - part.pivot[1], elbow[0] - part.pivot[0])) * DEG;
  const forearm = (fa - Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0])) * DEG;
  const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
  const rot = wrap(swing - parentTurn(rig, pose, arm));
  const bend = wrap(forearm - swing);
  // Mixed from the arm as it is, the short way round; or `forward`, swung up in front of
  // the body rather than back behind it, however far round that is.
  const from = pose.rot[arm] ?? 0;
  let turn = wrap(rot - from);
  if (forward && turn > 90) turn -= 360;
  pose.rot[arm] = from + turn * k;
  pose.bend[arm] = mix(pose.bend[arm] ?? 0, bend, fold);
}

const clampCos = (c: number) => Math.max(-1, Math.min(1, c));

/**
 * Drawing a bow at `to` (box units with the body offset), a right-handed archer seen from
 * his right: standing side-on and upright, the feet set apart, the head tipped up along the
 * line; the far arm (the bow hand, `Rig.farHold`) straight out from the far shoulder to put
 * the bow on the line, out from behind the chest; the near arm folded with the elbow up and
 * back behind the head, its hand on the string at the near jaw (the arrow's nock), on that
 * line too. `e` seconds into an aim of `span`, loosed `loose` seconds in. With `handOver`,
 * the bow is still in the near hand, as it is carried: both hands come to it as it comes up,
 * the far one takes it, and the near one goes back to the string.
 */
function aimPose(
  rig: Rig,
  pose: Pose,
  to: Pt,
  e: number,
  span: number,
  loose?: number,
  handOver = false
): void {
  const { raise, pull, flick, down } = aimBeats(e, span, loose);
  const k = raise;
  if (rig.name !== 'humanoid') {
    // No arms: lean toward it a little.
    pose.rot.body = (pose.rot.body ?? 0) - 8 * k;
    return;
  }
  // The line of the aim, worked out again as the head tips up along it.
  let deg = 0;
  const arm = rig.parts.armL;
  const reach =
    Math.hypot(rig.bends.armL[0] - arm.pivot[0], rig.bends.armL[1] - arm.pivot[1]) +
    Math.hypot(FAR_HAND[0] - rig.bends.armL[0], FAR_HAND[1] - rig.bends.armL[1]);
  const torso0 = pose.rot.torso ?? 0;
  const head0 = pose.rot.head ?? 0;
  const yaw0 = pose.yaw;
  let anchor: Pt = [0, 0];
  for (let i = 0; i < 4; i++) {
    const lift = Math.max(-25, Math.min(65, deg));
    // Up, the body leans back from the hips and the head tips back further; down, it is
    // more the body that bends over, so the face stays clear of the string.
    pose.rot.torso = mix(torso0, -(lift > 0 ? 0.3 : 0.45) * lift, k);
    pose.rot.head = mix(head0, -(lift > 0 ? 0.62 : 0.3) * lift, k);
    pose.yaw = mix(yaw0, 1.45, k);
    anchor = toRoot(rig, pose, 'head', ANCHOR);
    const gx = to[0] - pose.dx - anchor[0];
    const gy = to[1] - pose.dy - anchor[1];
    deg = Math.max(-30, Math.min(70, (-Math.atan2(gy, Math.max(1, gx)) * 180) / Math.PI));
  }
  const rad = (deg * Math.PI) / 180;
  const u: Pt = [Math.cos(rad), -Math.sin(rad)];
  // Feet set apart and planted, the near foot forward.
  pose.rot.legR = mix(pose.rot.legR ?? 0, -6, k);
  pose.rot.legL = mix(pose.rot.legL ?? 0, 6, k);
  pose.bend.legR = mix(pose.bend.legR ?? 0, 0, k);
  pose.bend.legL = mix(pose.bend.legL ?? 0, 0, k);
  plantFeet(rig, pose, ['legL', 'legR']);
  // The bow hand: on the line from the anchor, an arm's length (just short of straight)
  // from the far shoulder.
  const [fx, fy] = pose.off.armL ?? [0, 0];
  pose.off.armL = [fx + BOW_SHOULDER[0] * k, fy + BOW_SHOULDER[1] * k];
  const [sx, sy] = toRoot(rig, pose, 'armL', arm.pivot);
  const ax = anchor[0] - sx;
  const ay = anchor[1] - sy;
  const b = u[0] * ax + u[1] * ay;
  const c = ax * ax + ay * ay - (0.985 * reach) ** 2;
  const s = -b + Math.sqrt(Math.max(0, b * b - c));
  const bowHand: Pt = [anchor[0] + s * u[0], anchor[1] + s * u[1]];
  const farFrom = { rot: pose.rot.armL, bend: pose.bend.armL };
  armTo(rig, pose, 'armL', FAR_HAND, bowHand, false, k);
  // The drawing hand: on the string by the bow, pulled back to the anchor; let go, thrown
  // back a little past it and open. The near shoulder comes back for the draw.
  const [ox, oy] = pose.off.armR ?? [0, 0];
  pose.off.armR = [ox + DRAW_SHOULDER[0] * k, oy + DRAW_SHOULDER[1] * k];
  const rest: Pt = [bowHand[0] - BRACE * u[0], bowHand[1] - BRACE * u[1]];
  let hand: Pt = [mix(rest[0], anchor[0], pull), mix(rest[1], anchor[1], pull)];
  if (flick > 0)
    hand = [anchor[0] - FLICK * flick * u[0], anchor[1] - FLICK * flick * u[1] - 4 * flick];
  // Handed over: the near hand, carrying the bow, goes with the far one as it comes up,
  // passes the bow to it, and only then leaves it for the string.
  let kNear = k;
  let onString = 1;
  let held = 1;
  if (handOver && down === 0) {
    // Where they meet: the far hand as it will be then, out in front of the chest, clear of
    // the body and the face; once there, the far hand itself, going on up with the bow.
    const ghost: Pose = { ...pose, rot: { ...pose.rot }, bend: { ...pose.bend } };
    ghost.rot.armL = farFrom.rot ?? 0;
    ghost.bend.armL = farFrom.bend ?? 0;
    armTo(rig, ghost, 'armL', FAR_HAND, bowHand, false, aimBeats(HAND_OVER.meet, span).raise);
    const meet = toRoot(rig, ghost, 'armL', FAR_HAND);
    const far = toRoot(rig, pose, 'armL', FAR_HAND);
    const there = easeInOut(clamp01((e - HAND_OVER.pass) / HAND_OVER.passing));
    const grip: Pt = [mix(meet[0], far[0], there), mix(meet[1], far[1], there)];
    onString = easeInOut(clamp01((e - HAND_OVER.leave) / HAND_OVER.toString));
    hand = [mix(grip[0], hand[0], onString), mix(grip[1], hand[1], onString)];
    kNear = easeInOut(clamp01(e / HAND_OVER.meet));
    held = easeInOut(clamp01((e - HAND_OVER.pass) / HAND_OVER.passing));
  }
  // The elbow always on the side of the line from shoulder to hand that puts it up and
  // back once the hand is at the face, so it never flips over as the hand comes back; the
  // arm comes up in front to the string, not round behind, and goes down the short way.
  // Coming down, the elbow drops first, the arm still folded, so the hand goes down by the
  // neck and not across the face; then it straightens.
  const fold = down > 0 ? Math.min(1, 2 * kNear) : kNear;
  armTo(rig, pose, 'armR', rig.hold.point, hand, true, kNear, down === 0, fold);
  const loosed = loose !== undefined && e >= loose;
  pose.bow = {
    // Lowered with the arrow still on the string, it comes to point at the floor in front.
    deg: loosed ? deg : mix(deg, NOCKED_DOWN, down),
    // Turned as it comes up; lowered unloosed, it stays turned to point down.
    turn: loosed || down === 0 ? raise : 1,
    draw: pull * k * onString,
    twang: loosed ? e - loose! : undefined,
    raise,
    hand: handOver && down === 0 ? held : 1,
  };
}

/** Strokes a second of a `swim`: the quick churn of a paddle, not a stride. */
const SWIM_HZ = 2.2;

/**
 * A `swim`, at u of a span of `span` seconds: how far it has come in (eased in and out over
 * a third of a second, so it does not pop) and the stroke phase in radians.
 */
function swimBeats(u: number, span: number): { k: number; phi: number } {
  const ramp = Math.min(0.45, 0.3 / Math.max(span, 0.3));
  return { k: settle(u, ramp, ramp), phi: TAU * SWIM_HZ * u * span };
}

/** An `eat`: the share of it at which the food reaches the mouth, the bites a second. */
const EAT = { at: 0.22, hz: 4 };

/**
 * The beats of an `eat`: `k` (0..1) brings the food to the mouth (or the head down to it)
 * and away again, and `chew` is a bob, -1..1, four a second from when it gets there.
 */
function eatBeats(u: number, span: number): { k: number; chew: number } {
  const k = u < EAT.at ? easeInOut(u / EAT.at) : u > 0.8 ? 1 - easeInOut((u - 0.8) / 0.2) : 1;
  const chew = u < EAT.at ? 0 : Math.sin((u - EAT.at) * span * TAU * EAT.hz) * k;
  return { k, chew };
}

/**
 * Whether an `eat` under way has the mouth open now, chewing open and shut from when the
 * food reaches it to just before the end; undefined when nobody is eating.
 */
export function chewing(verbs: { verb: Verb; u: number; span?: number }[]): boolean | undefined {
  const eat = verbs.find((v) => v.verb === 'eat' && v.u >= EAT.at && v.u < 0.95);
  if (!eat) return undefined;
  return Math.sin((eat.u - EAT.at) * (eat.span ?? 1) * TAU * EAT.hz) > 0;
}

/** How far an animal eating off the floor tips its body forward, and its head at least. */
const EAT_DIP = 6;
const EAT_BOW = 44;
/**
 * How far a head too short to reach the floor bows (a crocodile's, low on a short neck):
 * a nod down toward it, not a snout turned straight down off the neck.
 */
const SHORT_BOW = 22;

/**
 * Where an eating animal's neck pivot comes to as its body tips forward, and the mouth
 * (`hold`, a `muzzle`) as a reach `r` at angle `alpha` from it.
 */
function eatNeck(rig: Rig): { neck: number; r: number; alpha: number } {
  const [hx, hy] = rig.parts.body.pivot;
  const [nx, ny] = rig.parts.head.pivot;
  const [mx, my] = rig.hold.point;
  const d = (EAT_DIP * Math.PI) / 180;
  const neck = hy + (nx - hx) * Math.sin(d) + (ny - hy) * Math.cos(d) + 14;
  return { neck, r: Math.hypot(mx - nx, my - ny), alpha: Math.atan2(my - ny, mx - nx) };
}

/**
 * Where an animal drawn with its own `muzzle` (a camel's, far up a long neck) brings its
 * mouth down to: just above the floor, so the lips reach the grass. The library's animals
 * keep their usual bow, which puts the underside of their round heads on the floor.
 */
const EAT_MOUTH = 184;

/**
 * How far the head bows to eat: further for a mouth up a long neck, down to EAT_MOUTH; a
 * nod for a mouth that is low already or that no bow would bring down there.
 */
function eatBow(rig: Rig): number {
  const [mx, my] = rig.hold.point;
  if (mx === QUADRUPED.hold.point[0] && my === QUADRUPED.hold.point[1]) return EAT_BOW;
  const { neck, r, alpha } = eatNeck(rig);
  if (EAT_MOUTH - neck > r) return SHORT_BOW;
  const turn = (Math.asin((EAT_MOUTH - neck) / r) - alpha) * (180 / Math.PI) - EAT_DIP;
  // A mouth low already (a crocodile's long jaw, close over the ground) only nods.
  if (turn < EAT_BOW) return SHORT_BOW;
  return Math.min(130, turn);
}

/** Quadruped verbs: the near front paw does what the humanoid's near arm does. */
function quadrupedVerb(rig: Rig, pose: Pose, verb: Verb, u: number, span: number): boolean {
  const add = (part: string, deg: number) => (pose.rot[part] = (pose.rot[part] ?? 0) + deg);
  switch (verb) {
    case 'wave': {
      const k = settle(u, 0.18, 0.18);
      pose.rot.legFR = k * (-78 + 16 * Math.sin(u * TAU * 2.5));
      add('head', -4 * k);
      return true;
    }
    case 'strike': {
      // A butt: the head drawn back and up, then thrust forward and down with the body.
      const { up, down } = strikeBeats(u);
      add('head', -14 * up + 22 * down);
      add('body', -3 * up + 5 * down);
      pose.dx += 12 * down - 4 * up;
      return true;
    }
    case 'swim': {
      // A paddle: the forelegs churn in turn, reaching out in front and pulling down, the hind
      // legs pushing back, all under a body held still, low at the rump and nose up, the head
      // straining up out of the water. Nothing bobs: the legs work, the body goes nowhere
      // (a `move` carries it, a river sweeps it along).
      const { k, phi } = swimBeats(u, span);
      const s = Math.sin(phi);
      const c = Math.sin(phi + Math.PI);
      pose.rot.legFR = (pose.rot.legFR ?? 0) + k * (-40 + 32 * s);
      pose.rot.legFL = (pose.rot.legFL ?? 0) + k * (-40 + 32 * c);
      pose.rot.legBR = (pose.rot.legBR ?? 0) + k * (22 + 20 * c);
      pose.rot.legBL = (pose.rot.legBL ?? 0) + k * (22 + 20 * s);
      add('body', -12 * k);
      add('head', -14 * k);
      add('tail', 10 * k + 4 * k * Math.sin(phi * 0.5));
      return true;
    }
    case 'kick': {
      // A buck: weight onto the front legs, both hind legs lash out behind.
      const { draw, out } = kickBeats(u);
      add('legBL', -12 * draw + 55 * out);
      add('legBR', -12 * draw + 62 * out);
      add('body', 4 * draw - 10 * out);
      add('head', 6 * out);
      return true;
    }
    case 'eat': {
      // Eating off the floor: the head goes down in front of the forepaws, as for a pickup,
      // and stays there chewing, then comes back up.
      // Lying, the mouth is down there already: a much smaller nod.
      const { k, chew } = eatBeats(u, span);
      const low = k * (1 - 0.75 * (pose.lying ?? 0));
      add('body', EAT_DIP * low);
      add('head', eatBow(rig) * low + 5 * chew);
      nudge(pose, 'head', 6 * low, 14 * low + 2 * chew);
      add('tail', -8 * k);
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
      // A profile head cannot turn away from the camera, so the "no" is a wide swing in the
      // plane with the ears flung after it and the shoulders answering; smaller reads as a
      // twitch at reel size.
      const n = Math.sin(u * TAU * 3) * Math.min(1, u * 8, (1 - u) * 8);
      add('head', 16 * n);
      nudge(pose, 'head', 6 * n, 0);
      add('body', -3 * n);
      add('earL', -16 * n);
      add('earR', -16 * n);
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
      if (!air) plantFeet(rig, pose, QUAD_LEGS);
      pose.sy *= 1 - 0.1 * squash;
      pose.sx *= 1 + 0.08 * squash;
      return true;
    }
    case 'sit': {
      // The body tips back about the hips and drops until the rump meets the floor; the
      // hind legs fold at the knee with the paws forward on the floor, the front legs stay
      // straight and keep their paws planted on the way down. `u` is how far down (0
      // standing, 1 sat). A sprawling reptile only lets its belly down.
      const k = easeInOut(u);
      if (rig.sprawl) {
        sprawlDown(rig, pose, k);
        return true;
      }
      pose.off.body = [0, 46 * k];
      pose.rot.body = -24 * k;
      for (const leg of ['legBL', 'legBR']) {
        // Folded for how high the hip is now, so the paw stays on the floor all the way down.
        const hip = toRoot(rig, pose, 'body', rig.parts[leg].pivot);
        const h = rig.height - hip[1];
        const [turn, bend] = foldLeg(rig, leg, h, 0, -90 * (1 - k));
        pose.rot[leg] = turn - pose.rot.body;
        pose.bend[leg] = bend;
      }
      pose.rot.legFL = pose.rot.legFR = 24 * k;
      add('head', 18 * k);
      add('tail', -40 * k);
      if (k < 1) plantFeet(rig, pose, ['legFL', 'legFR']);
      return true;
    }
    case 'lie': {
      // From sitting: the body comes level and down onto its belly, the front legs fold
      // forward along the floor, the hind legs stay folded, and the head goes down onto the
      // paws. `u` is how far down (0 sitting, 1 lying).
      const l = easeInOut(u);
      if (rig.sprawl) {
        // Down on its belly already (`sit` comes first): the chin comes down too.
        add('head', 6 * l);
        pose.lying = Math.max(pose.lying ?? 0, l);
        return true;
      }
      const [ox, oy] = pose.off.body ?? [0, 0];
      pose.off.body = [ox, mix(oy, rig.height - (rig.belly ?? rig.height), l)];
      pose.rot.body = (pose.rot.body ?? 0) * (1 - l);
      for (const leg of QUAD_LEGS) {
        const hip = toRoot(rig, pose, 'body', rig.parts[leg].pivot);
        // Folded to a floor a little higher than the real one: a hoof across the end of a
        // slanted shin would reach below the belly with its corner.
        const floor = rig.height - hip[1] - LIE_TUCK * l;
        const hind = leg.startsWith('legB');
        // The hind legs are already folded: hooves tucked under, paws on the real floor as
        // when sitting, the haunch drawn whole on the flank (`loose`) and the foot showing
        // flat along the floor beneath it. The front ones go from planted to stretched out
        // in front, the upper leg down to the floor and the paw on it ahead of the chest,
        // where it shows (folded under, it would be lost in the body). Hooves fold back
        // under the chest, knees forward.
        const [turn, bend] = hind
          ? foldLeg(rig, leg, rig.hooves ? floor : floor + LIE_TUCK * l, 0, -90)
          : rig.hooves
            ? tuckUnder(rig, leg, floor)
            : reachOut(rig, leg, floor + LIE_TUCK * l);
        pose.rot[leg] = hind
          ? turn - pose.rot.body
          : mix(pose.rot[leg] ?? 0, turn - pose.rot.body, l);
        pose.bend[leg] = hind ? bend : mix(pose.bend[leg] ?? 0, bend, l);
      }
      if (!rig.hooves && l > 0) pose.loose = ['legBR'];
      // The neck sinks into the shoulders rather than the head tipping onto its face, and
      // the chin stays up off the paws.
      add('head', 8 * l);
      nudge(pose, 'head', 4 * l, LIE_HEAD * l);
      add('tail', 30 * l);
      pose.lying = Math.max(pose.lying ?? 0, l);
      return true;
    }
    case 'pickup':
    case 'putdown': {
      // The head goes down to the floor in front, where the mouth takes or leaves it.
      const k = stoopDepth(u);
      add('body', 6 * k);
      add('head', Math.min(EAT_BOW, eatBow(rig)) * k);
      nudge(pose, 'head', 6 * k, 14 * k);
      add('tail', -10 * k);
      return true;
    }
    default:
      return false;
  }
}

/**
 * The stoop's lean, by `l` (0 upright, 1 with the near hand down at the floor): the knees
 * bend with the feet planted, the back leans over from the hips and the head keeps half an
 * eye on what is down there.
 */
function lean(rig: Rig, pose: Pose, l: number): void {
  pose.dy += 58 * l;
  pose.rot.torso = (pose.rot.torso ?? 0) + 44 * l;
  pose.rot.head = (pose.rot.head ?? 0) - 16 * l;
  plantFeet(rig, pose, ['legL', 'legR']);
}

/**
 * Where `eat` puts the near hand, in the head's frame: just in front of and under the
 * mouth of a face turned the way the character faces, so what it holds is at the lips.
 */
const EAT_AT: Pt = [136, 132];

/** Where a `wipe` with nothing named goes: in front of the chest (box units). */
const WIPE_AT: Pt = [206, 214];

/**
 * The near hand out to `to` (box units with the body offset, the actor facing right) by
 * `k`, 0 at rest and 1 there. The body leans over as for a stoop, but only as far as it
 * must to bring the shoulder within an arm's length of it; then the arm swings from the
 * shoulder and folds forward at the elbow to put the hand on it. Out of reach, the hand
 * gets as near as it can.
 */
export function reachTo(rig: Rig, pose: Pose, to: Pt, k: number): void {
  const arm = rig.parts.armR;
  const elbow = rig.bends.armR;
  if (!arm || !elbow) return;
  const hand = rig.hold.point;
  const upper = Math.hypot(elbow[0] - arm.pivot[0], elbow[1] - arm.pivot[1]);
  const fore = Math.hypot(hand[0] - elbow[0], hand[1] - elbow[1]);
  const leaned = (l: number): Pose => {
    const p = { ...pose, rot: { ...pose.rot }, bend: { ...pose.bend }, off: { ...pose.off } };
    lean(rig, p, l);
    return p;
  };
  const gap = (p: Pose): [number, number] => {
    const [x, y] = toRoot(rig, p, 'armR', arm.pivot);
    return [to[0] - x - p.dx, to[1] - y - p.dy];
  };
  // The first lean in reach; out of reach, the one that comes nearest (none, for a shelf
  // above the shoulder).
  let l = 0;
  let best = Infinity;
  for (let step = 0; step <= 20; step++) {
    const miss = Math.hypot(...gap(leaned(step / 20))) - 0.96 * (upper + fore);
    if (miss < best) [l, best] = [step / 20, miss];
    if (miss <= 0) break;
  }
  const [gx, gy] = gap(leaned(l));
  const d = Math.min(
    Math.max(Math.hypot(gx, gy), Math.abs(upper - fore) + 1),
    0.999 * (upper + fore)
  );
  // The upper arm turns past the line to the target, so the elbow drops under it, and the
  // forearm folds back up to it (law of cosines).
  const up = Math.atan2(gy, gx) + Math.acos((upper ** 2 + d ** 2 - fore ** 2) / (2 * upper * d));
  const folded = Math.PI - Math.acos((upper ** 2 + fore ** 2 - d ** 2) / (2 * upper * fore));
  const swing = (up - Math.atan2(elbow[1] - arm.pivot[1], elbow[0] - arm.pivot[0])) * DEG;
  const forearm = (up - folded - Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0])) * DEG;
  const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
  const rot = wrap(swing - parentTurn(rig, leaned(l), 'armR'));
  const bend = wrap(forearm - swing);
  lean(rig, pose, l * k);
  pose.rot.armR = mix(pose.rot.armR ?? 0, rot, k);
  pose.bend.armR = mix(pose.bend.armR ?? 0, bend, k);
}

/**
 * Layer a timed verb over the base pose. `u` is progress 0..1 through the action; for
 * `sit` it is how far down the actor is, so sitting and standing can ease, and `seat` is
 * how far below the hips the floor is (canonical units; 0 sits on the ground). An `aim` is
 * `span` seconds long, loosed `loose` seconds in, and with `handOver` takes the bow from the
 * near hand that carries it.
 */
export function applyVerb(
  rig: Rig,
  pose: Pose,
  verb: Verb,
  u: number,
  seat = 0,
  to?: Pt,
  span = 1,
  loose?: number,
  handOver = false
): void {
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
  if (rig.name === 'quadruped' && quadrupedVerb(rig, pose, verb, u, span)) return;
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
      // Off a table or a shelf (`to`, where the prop is held), the hand goes out to it and
      // the body leans over only as far as it must.
      const k = stoopDepth(u);
      if (humanoid && to) reachTo(rig, pose, to, k);
      else if (humanoid) {
        pose.rot.armR = mix(pose.rot.armR ?? 0, -54, k);
        pose.bend.armR = mix(pose.bend.armR ?? 0, -6, k);
        pose.rot.armL = mix(pose.rot.armL ?? 0, -34, k);
        pose.bend.armL = mix(pose.bend.armL ?? 0, -30, k);
        lean(rig, pose, k);
      } else {
        pose.rot.body = (pose.rot.body ?? 0) + 22 * k;
        pose.dx += 8 * k;
        pose.sy *= 1 - 0.08 * k;
      }
      break;
    }
    case 'wipe': {
      // The near hand out to what it wipes (`to`; else in front of the chest) and round in
      // small circles on it, two a second or so.
      const k = u < 0.2 ? easeInOut(u / 0.2) : u > 0.82 ? 1 - easeInOut((u - 0.82) / 0.18) : 1;
      const turns = Math.max(2, Math.round(span / 0.5)) * TAU * u;
      if (humanoid) {
        const [x, y] = to ?? WIPE_AT;
        reachTo(rig, pose, [x + 7 * Math.cos(turns), y + 5 * Math.sin(turns)], k);
      } else {
        // No arm: the body rubs back and forth against it.
        pose.rot.body = (pose.rot.body ?? 0) + k * (6 + 4 * Math.sin(turns));
        pose.dx += k * (6 + 4 * Math.cos(turns));
      }
      break;
    }
    case 'hold': {
      // The near hand out to `to` (else in front of the chest) and kept there: a hand on
      // someone's shoulder to steady them as they walk, on a door, on a cart's side. It goes
      // with whatever it rests on, so walk the two together.
      const ease = Math.min(0.3, 0.35 / Math.max(span, 0.35));
      const k = settle(u, ease, ease);
      if (humanoid) reachTo(rig, pose, to ?? WIPE_AT, k);
      else pose.dx += 4 * k;
      break;
    }
    case 'aim':
      // Drawing a bow at `to`, else straight ahead, level.
      aimPose(rig, pose, to ?? [600, 132], u * span, span, loose, handOver);
      break;
    case 'strike': {
      // A blow: the near arm winds up over the head, the elbow bent, the body leaning back;
      // then chops forward and down, straightening, the body following through. What the
      // hand carries swings with it: back over the shoulder, then forward onto the target.
      const { up, down } = strikeBeats(u);
      if (humanoid) {
        pose.rot.armR = (pose.rot.armR ?? 0) - 160 * up - 60 * down;
        pose.bend.armR = (pose.bend.armR ?? 0) - 35 * up - 10 * down;
        pose.rot.torso = (pose.rot.torso ?? 0) + 6 * up - 8 * down;
        pose.rot.head = (pose.rot.head ?? 0) + 3 * up - 5 * down;
        pose.wield = -55 * up + 105 * down;
      } else {
        pose.rot.body = (pose.rot.body ?? 0) + 8 * up - 16 * down;
        pose.dx += 12 * down - 4 * up;
      }
      break;
    }
    case 'dig': {
      // Digging with a hoe or spade: bent forward over the ground with the knees given, the
      // near arm lifts the tool up over the shoulder, brings it down hard in front so the
      // blade bites the soil, and draws it back toward the feet, the back bowing into the
      // pull; again and again. What it bites with is solved where the prop is placed.
      const { k, up, bite, pull } = digBeats(u, span);
      if (humanoid) {
        // Bent from the hips, the knees only given a little: more as the blow goes in and
        // the pull comes back, straighter with the tool up.
        const l = k * (0.55 - 0.25 * up + 0.2 * bite + 0.1 * pull);
        pose.rot.torso = (pose.rot.torso ?? 0) + 38 * l;
        pose.dy += 10 * l;
        plantFeet(rig, pose, ['legL', 'legR']);
        pose.rot.armR = (pose.rot.armR ?? 0) + k * (-28 - 132 * up + 18 * pull);
        pose.bend.armR = (pose.bend.armR ?? 0) + k * (-18 - 30 * up - 22 * pull);
        pose.rot.armL = (pose.rot.armL ?? 0) + k * (-34 - 70 * up + 12 * pull);
        pose.bend.armL = (pose.bend.armL ?? 0) + k * (-30 - 30 * up);
        // The head stays up off the chest, looking at the blade, as the back bends.
        pose.rot.head = (pose.rot.head ?? 0) - 14 * l + k * (4 - 4 * up);
        pose.wield = k * (-50 * up + 95 * (1 - up));
        pose.bite = k * bite;
      } else {
        pose.rot.body = (pose.rot.body ?? 0) + k * (6 * up - 12 * bite);
        pose.dx += k * (8 * bite - 3 * up);
      }
      break;
    }
    case 'swim': {
      // Treading water, struggling: the arms beat down in turn from up by the head, the legs
      // kick under, the body upright and still; other rigs rock a little from side to side.
      const { k, phi } = swimBeats(u, span);
      const s = Math.sin(phi);
      const c = Math.sin(phi + Math.PI);
      if (humanoid) {
        pose.rot.armR = mix(pose.rot.armR ?? 0, -130 + 45 * s, k);
        pose.rot.armL = mix(pose.rot.armL ?? 0, -130 + 45 * c, k);
        pose.bend.armR = mix(pose.bend.armR ?? 0, -30 + 20 * s, k);
        pose.bend.armL = mix(pose.bend.armL ?? 0, -30 + 20 * c, k);
        pose.rot.legR = (pose.rot.legR ?? 0) + k * 18 * s;
        pose.rot.legL = (pose.rot.legL ?? 0) + k * 18 * c;
        pose.rot.head = (pose.rot.head ?? 0) - 8 * k;
      } else pose.rot.body = (pose.rot.body ?? 0) + 6 * k * s;
      break;
    }
    case 'kick': {
      // The near leg draws back with the knee bent, snaps out straight, forward and up, holds
      // a beat and comes home; the arms fling out for balance. On top of a `lie` the same
      // swing lifts the foot up off the bed, the kick of someone lying on their back.
      const { draw, out } = kickBeats(u);
      if (humanoid) {
        pose.rot.legR = (pose.rot.legR ?? 0) + 18 * draw - 70 * out;
        pose.bend.legR = mix(mix(pose.bend.legR ?? 0, 70, draw), 0, Math.min(1, out));
        pose.rot.armL = (pose.rot.armL ?? 0) - 25 * out;
        pose.rot.armR = (pose.rot.armR ?? 0) + 20 * out;
      } else {
        pose.rot.body = (pose.rot.body ?? 0) + 6 * draw - 14 * out;
        pose.dx += 10 * out;
      }
      break;
    }
    case 'eat': {
      // The near hand comes up to the mouth with whatever it holds, stays there while the
      // head bobs with the chewing (the mouth flaps: `chewing`), and goes back down. The
      // head tips a little toward the hand.
      const { k, chew } = eatBeats(u, span);
      if (humanoid) {
        pose.rot.head = (pose.rot.head ?? 0) + 5 * k;
        const [x, y] = toRoot(rig, pose, 'head', EAT_AT);
        reachTo(rig, pose, [x + pose.dx, y + pose.dy], k);
        pose.rot.head += 2.5 * chew;
        nudge(pose, 'head', 0, 1.5 * Math.max(0, chew));
      } else {
        // No hands: a few small pecks forward.
        const peck = Math.max(0, Math.sin(u * TAU * 3)) * settle(u, 0.1, 0.1);
        pose.rot.body = (pose.rot.body ?? 0) + 14 * peck;
        pose.dx += 5 * peck;
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
