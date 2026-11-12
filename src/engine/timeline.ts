import { clamp01, easeInOut, easeOut, hash01, lerp, ramp } from './easing.js';
import {
  actorHeadTop,
  bowFlex,
  holdPoint,
  partToScene,
  poseFor,
  sceneToPart,
  sideOf,
} from './actor.js';
import type { Pt, Travel } from './gait.js';
import {
  AIM,
  digHits,
  JUMP,
  SOIL_TIME,
  SPEED,
  STOOP,
  VERB_DURATION,
  type Locomotion,
  type Pose,
} from './motion.js';
import { defaultGround, stageSides } from './format.js';
import { rigOf } from './rigs.js';
import { clipFor, lineDuration, lineLead, mouthOpen, sayDuration, shownText } from './voice.js';
import type {
  Action,
  Camera,
  Character,
  Emotion,
  Facing,
  Position,
  Project,
  Scene,
  Shot,
  Verb,
  View,
} from './types.js';
import { isMoveVerb } from './types.js';

export interface Point {
  x: number;
  y: number;
  scale: number;
  /** A spot on another actor (`on`), given as that actor stood at time `at`. */
  rides?: { base: string; at: number };
}

export interface ActiveVerb {
  verb: Verb;
  /** Progress 0..1. */
  u: number;
  /** How long it lasts, seconds. */
  span?: number;
  /**
   * Where the near hand goes, in the actor's box (as it faces): what a `wipe` wipes, or the
   * grip of a prop a `pickup` takes off a table (from the floor it stoops, without one).
   */
  to?: Pt;
  /** An `aim`: seconds into it at which the arrow was loosed, if it was. */
  loose?: number;
  /** An `aim`, the first in the shot: the bow is taken from the near hand as it comes up. */
  handOver?: boolean;
}

export interface Bubble {
  text: string;
  style: 'speech' | 'thought' | 'shout';
  /** Seconds since it appeared and until it goes, for the pop in and out. */
  age: number;
  left: number;
}

/** One blow of a `dig` into the soil, as `ActorState.soil` keeps it. */
export interface SoilBurst {
  x: number;
  y: number;
  /** Seconds since the blade went in. */
  age: number;
  /** World scale of the clods (the digger's perspective and size). */
  scale: number;
  /** Which way the digger faces, the clods mostly thrown back toward them. */
  side: number;
  salt: string;
}

export interface ActorState {
  id: string;
  character: Character;
  x: number;
  y: number;
  /** Final scale: character.height is multiplied by this. */
  scale: number;
  facing: Facing;
  visible: boolean;
  opacity: number;
  locomotion: Locomotion;
  /** Seconds since the current locomotion began (drives idle and the sheets' cycles). */
  locoT: number;
  /** How far the current walk or run has got, which drives the legs. */
  travel?: Travel;
  /** A carried prop swung by its holder's hand: degrees clockwise about (x, y), its grip. */
  tilt?: { deg: number; x: number; y: number };
  /**
   * Clods of earth thrown up where a tool this actor is (a carried hoe) bit the soil in a
   * `dig`: where (on the floor), how long ago, at what size; drawn over the actor.
   */
  soil?: SoilBurst[];
  /** An archer whose lowered bow still has this arrow on its string. */
  nocked?: string;
  /**
   * Carried in its holder's far hand (a bow), or this far handed to it from the near one,
   * 0..1: drawn just behind the holder, not in front (see compose.ts).
   */
  behind?: number;
  /** Has begun an `aim` this shot: a bow it carries is in its far hand from then on. */
  aimed?: boolean;
  /** A bow: how far its limbs are bent back by the draw, 0..1. */
  flex?: number;
  /** A bow's string in the scene: tied at a and b, pulled to apex; its width in pixels. */
  bowstring?: { a: XY; apex: XY; b: XY; width: number };
  /** An arrow on the string of this archer's bow: drawn just in front of the bow. */
  nockedOn?: string;
  /** An arrow stuck in something: box units of it, from the head back, gone in. */
  bury?: number;
  /** An arrow in flight: the streak behind it, from its tail back, and its width. */
  streak?: { x1: number; y1: number; x2: number; y2: number; w: number };
  /** Mid-turn after a facing change: the old facing and progress 0..1. */
  turn?: { from: Facing; u: number };
  /**
   * Which way a move goes: -1 straight into the screen (seen from behind), 1 straight out
   * of it (face to the viewer), 0 across or standing.
   */
  view: number;
  /** 0 standing, 1 sat; in between while sitting down or getting up. */
  sit: number;
  /** How far below the seat (the actor's point) the floor is, scene pixels: 0 on the ground. */
  seat: number;
  /**
   * A person on a raised seat who stood on the seat itself (jumped up onto a branch, or
   * was cast there), not on the floor below it: they sit down from it and get up on it.
   */
  perched: boolean;
  /** 0 up, 1 lying down (from sitting); in between while lying back or sitting up. */
  lie: number;
  /** The anchor's perspective scale under the actor (already folded into `scale`). */
  perspective: number;
  /** Standing on this actor (`on`): drawn just in front of it. */
  on?: string;
  /** Carried by this actor (`attach`), and whether this actor is carrying something. */
  heldBy?: string;
  holding: boolean;
  /** Head tilt toward whoever the actor is attending to, degrees (down is positive). */
  look: number;
  /** A short take after an emotion change: progress 0..1 and the new emotion. */
  take?: { u: number; emotion: Emotion };
  emotion: Emotion;
  face: Record<string, string>;
  verbs: ActiveVerb[];
  bubble?: Bubble;
  talking: boolean;
  /** Saying a voiced line: whether its audio is loud enough now to open the mouth. */
  mouth?: boolean;
  phase: number;
}

type XY = { x: number; y: number };

export interface CaptionState {
  text: string;
  style: 'title' | 'narration';
  opacity: number;
  /** 0 in place; positive while it slides up into place or drifts down on the way out. */
  slide: number;
}

export interface FrameState {
  t: number;
  shot: Shot;
  scene: Scene;
  actors: ActorState[];
  camera: View;
  captions: CaptionState[];
  /** 0 = clear, 1 = fully black. */
  fade: number;
}

export const STAGE_SHORTCUTS = ['left', 'center', 'right', 'offLeft', 'offRight'] as const;

/** Resolve an anchor name, stage shortcut or explicit point into scene coordinates. */
export function resolvePosition(project: Project, scene: Scene, pos: Position): Point {
  const { width, height } = project.meta;
  const ground = scene.ground ?? defaultGround(project.meta);
  const [left, right] = stageSides(project.meta);
  if (typeof pos !== 'string') return { x: pos.x, y: pos.y, scale: pos.scale ?? 1 };
  const a = scene.anchors[pos];
  if (a) return { x: a.x, y: a.y, scale: a.scale };
  switch (pos) {
    case 'left':
      return { x: width * left, y: ground, scale: 1 };
    case 'center':
      return { x: width * 0.5, y: ground, scale: 1 };
    case 'right':
      return { x: width * right, y: ground, scale: 1 };
    case 'offLeft':
      return { x: -width * 0.15, y: ground, scale: 1 };
    case 'offRight':
      return { x: width * 1.15, y: ground, scale: 1 };
    default:
      throw new Error(`unknown position '${pos}' in scene '${scene.id}'`);
  }
}

/**
 * How far below a seat the floor is: what the seat's anchor says (`floor`), else where the
 * actor stood before sitting down onto it; sitting down where it stands is on the ground.
 */
function seatHeight(scene: Scene, from: Point, at: Point): number {
  for (const a of Object.values(scene.anchors))
    if (a.floor !== undefined && Math.abs(a.x - at.x) < 1 && Math.abs(a.y - at.y) < 1)
      return Math.max(0, a.floor - a.y);
  return Math.max(0, from.y - at.y);
}

/** How high a bed is: an anchor with a `floor` under it (a cot); 0 for a spot on the floor. */
function bedHeight(scene: Scene, at: Point): number {
  for (const a of Object.values(scene.anchors))
    if (a.floor !== undefined && Math.abs(a.x - at.x) < 1 && Math.abs(a.y - at.y) < 1)
      return Math.max(0, a.floor - a.y);
  return 0;
}

export function moveDuration(verb: Verb, from: Point, to: Point, explicit?: number): number {
  if (explicit) return explicit;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const speed = SPEED[verb] ?? 300;
  return Math.max(verb === 'jump' ? VERB_DURATION.jump! : 0.4, dist / speed);
}

export function actionDuration(a: Action, from?: Point, to?: Point): number {
  if (a.duration) return a.duration;
  if (a.say) return sayDuration(a.say);
  if (a.caption) return 3;
  if (a.camera) return 1;
  if (a.do && isMoveVerb(a.do) && from && to) return moveDuration(a.do, from, to);
  if (a.do && VERB_DURATION[a.do]) return VERB_DURATION[a.do]!;
  return 0;
}

interface Move {
  verb: Verb;
  from: Point;
  to: Point;
  t0: number;
  t1: number;
  /** When the actor last stood still, for its idle until t0 (while it gets up). */
  rest: number;
}

/** Seconds a walk or run takes to get up to speed, and to stop. */
const RAMP = 0.3;
/** Seconds for a facing flip, and for sitting down or getting up. */
const TURN_TIME = 0.2;
/**
 * A four-legged animal turns round more slowly: it is long, so it brings its head round
 * first and steps its body after, where a person swivels on the spot.
 */
const QUAD_TURN_TIME = 0.7;
const SIT_TIME = 0.4;
/** Seconds to lie back from sitting, or sit up again. */
const LIE_TIME = 0.9;
/** Seconds to turn into or out of the screen as a move starts, and back as it ends. */
const VIEW_TIME = 0.25;

/**
 * How far a move turns its actor into the screen (negative) or out of it: none while it
 * goes more across than up or down the screen, all the way when it goes straight up or
 * down, turning at the start and turning back at the end.
 */
function moveView(m: Move, t: number): number {
  const dx = m.to.x - m.from.x;
  const dy = m.to.y - m.from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1 || t < m.t0) return 0;
  const steep = easeInOut(clamp01((Math.abs(dy) / len - 0.5) / 0.35));
  const k = t < m.t1 ? clamp01((t - m.t0) / VIEW_TIME) : clamp01(1 - (t - m.t1) / VIEW_TIME);
  return Math.sign(dy) * steep * easeInOut(k) || 0;
}

/**
 * Progress along a move: walks and runs speed up and slow down at either end, a jump
 * crosses the ground only while it is in the air, anything else eases in and out.
 */
function moveProgress(m: Move, t: number): number {
  const d = Math.max(1e-6, m.t1 - m.t0);
  const u = clamp01((t - m.t0) / d);
  if (m.verb === 'walk' || m.verb === 'run') return ramp(u, Math.min(0.3, RAMP / d));
  if (m.verb === 'jump') return clamp01((u - JUMP.launch) / (JUMP.land - JUMP.launch));
  return easeInOut(u);
}

/**
 * Distance along a move up to progress `e`, in canonical units of the actor's rig: scene
 * pixels divided by the drawing scale, which changes along the move when the two ends
 * have different perspective scales. This is what a planted foot has to slide past.
 */
function canonicalDistance(m: Move, e: number, k: number): number {
  const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
  const s0 = m.from.scale;
  const ds = m.to.scale - m.from.scale;
  const f = Math.abs(ds) < 1e-6 ? e / s0 : Math.log((s0 + ds * e) / s0) / ds;
  return (len * f) / k;
}

function movePoint(m: Move, t: number): Point {
  const e = moveProgress(m, t);
  // Not yet off, or there: the end itself, still on whoever it is on.
  if (e <= 0) return m.from;
  if (e >= 1) return m.to;
  return {
    x: lerp(m.from.x, m.to.x, e),
    y: lerp(m.from.y, m.to.y, e),
    scale: lerp(m.from.scale, m.to.scale, e),
  };
}

/** Seconds an emotion take lasts, and a look takes to settle on a new target. */
const TAKE_TIME = 0.6;
const LOOK_TIME = 0.35;
/** How deep holders and look targets are resolved: a prop's carrier, a listener's speaker. */
const MAX_DEPTH = 2;

/**
 * Where a spot on another actor is at time t: carried from how that actor stood at `rides.at`
 * through its moves, turns, lying down and getting up since, as a point on its body.
 */
function ridePoint(
  project: Project,
  scene: Scene,
  shot: Shot,
  p: Point,
  t: number,
  depth: number
): Point {
  const { rides, ...plain } = p;
  if (!rides || depth >= MAX_DEPTH || !shot.cast[rides.base]) return plain;
  const then = resolveActor(project, scene, shot, rides.base, rides.at, depth + 1);
  const now = resolveActor(project, scene, shot, rides.base, t, depth + 1);
  const spot = sceneToPart(then, poseFor(then, rides.at), p);
  const at = partToScene(now, poseFor(now, t), spot);
  return { x: at.x, y: at.y, scale: (p.scale * now.perspective) / then.perspective };
}

/** A prop taken from the floor or set down on it: the carrier stoops to do it. */
const isStoop = (a: Action): boolean => a.do === 'pickup' || a.do === 'putdown';

/**
 * When an `attach` takes effect: at once, or for a pickup or putdown when the stooping
 * hand reaches the floor.
 */
export const attachTime = (a: Action): number =>
  isStoop(a) ? a.t + STOOP.grab * actionDuration(a) : a.t;

/** Seconds a prop taken up (from the floor, or from another hand) takes to reach the hand. */
const LIFT_TIME = 0.35;
/** Seconds a prop let go at the bottom of a putdown takes to settle where it goes. */
const SETTLE_TIME = 0.25;
/**
 * Scene pixels from where it stands to the foot of a seat (or a bed) beyond which it walks
 * there first; nearer, it shifts across as it sits.
 */
const APPROACH = 24;
/** A sit or lie at a shot's start this quick is how the shot opens, not something seen. */
const OPENING = 0.05;
/** Verbs that sit, lie or stand: one of them cuts short a walk to a seat. */
const SETTLE_VERBS = new Set<Verb>(['sit', 'lie', 'stand']);

/** Who is carrying `prop` at time t, if anyone. */
export function holderAt(shot: Shot, prop: string, t: number): string | undefined {
  let holder: string | undefined;
  for (const a of shot.actions)
    if (a.actor === prop && a.attach !== undefined && attachTime(a) <= t)
      holder = a.attach || undefined;
  return holder;
}

/** Where a prop's grip is with its feet at `at`, at this (final) scale, facing this way. */
export function gripAt(
  prop: Character,
  at: { x: number; y: number },
  scale: number,
  facing: Facing
): { x: number; y: number } {
  const rig = rigOf(prop);
  const k = (prop.height / rig.height) * scale;
  const [gx, gy] = prop.grip ?? [rig.width / 2, rig.height / 2];
  const side = facing === 'left' ? -1 : 1;
  return { x: at.x + k * side * (gx - rig.width / 2), y: at.y + k * (gy - rig.height) };
}

/** Who stoops for a pickup or putdown: the one taking the prop, or the one holding it. */
export function stooper(shot: Shot, a: Action): string | undefined {
  if (!a.actor || !isStoop(a)) return undefined;
  return a.do === 'pickup' ? a.attach || undefined : holderAt(shot, a.actor, a.t);
}

/**
 * Where a prop's feet point goes so that its grip sits in its holder's hand (or mouth) at
 * time t, facing the way the holder faces.
 */
function heldPoint(
  project: Project,
  scene: Scene,
  shot: Shot,
  prop: Character,
  propScale: number,
  holderId: string,
  t: number,
  depth: number
): Held {
  const holder = resolveActor(project, scene, shot, holderId, t, depth + 1);
  return heldFrom(holder, poseFor(holder, t), prop, propScale);
}

/** Where a carried prop goes, as heldPoint, from its holder as it stands and is posed. */
interface Held {
  point: Point;
  facing: Facing;
  turn?: ActorState['turn'];
  tilt?: ActorState['tilt'];
  tip: { x: number; y: number };
  holder: ActorState;
  pose: Pose;
  /** How far it has passed to the far hand (a bow), 0..1: drawn behind its holder. */
  far: number;
}

function heldFrom(holder: ActorState, pose: Pose, prop: Character, propScale: number): Held {
  // A bow is carried in the near hand like anything else, until an aim hands it to the far
  // one, the bow hand, leaving the near hand to draw; it stays there after.
  const far =
    prop.bowstring && rigOf(holder.character).farHold
      ? (pose.bow?.hand ?? (holder.aimed ? 1 : 0))
      : 0;
  let hand = holdPoint(holder, pose);
  if (far > 0) {
    const f = holdPoint(holder, pose, true);
    hand = { x: lerp(hand.x, f.x, far), y: lerp(hand.y, f.y, far) };
  }
  const rig = rigOf(prop);
  const [gx, gy] = prop.grip ?? [rig.width / 2, rig.height / 2];
  const k = (prop.height / rig.height) * propScale * holder.perspective;
  const side = holder.facing === 'left' ? -1 : 1;
  // The working end, from the grip, in scene pixels as drawn upright (y down).
  const [tx, ty] = prop.tip ?? [gx, 0];
  const dx = k * (tx - gx);
  const dy = k * (ty - gy);
  let wield = pose.wield;
  if (pose.bite && pose.bite > 0) {
    // Brought down onto the floor: the swing that puts the tip at the holder's feet level.
    // Turned by w toward the facing, the tip sits dx sin w + dy cos w below the hand; of the
    // two swings that reach, the first one coming down from overhead. Out of reach, it
    // points as low as it can.
    const r = Math.hypot(dx, dy);
    const drop = holder.y - hand.y;
    const a = Math.atan2(dy, dx);
    const w = (Math.asin(Math.max(-1, Math.min(1, drop / (r || 1)))) - a) * (180 / Math.PI);
    wield = (wield ?? 0) + (w - (wield ?? 0)) * Math.min(1, pose.bite);
  }
  // A bow in an aim: turned to stand across the line of it.
  if (prop.bowstring && pose.bow)
    wield = (wield ?? 0) + pose.bow.turn * bowTurn(prop, pose.bow.deg);
  const rad = ((wield ?? 0) * Math.PI) / 180;
  return {
    point: {
      x: hand.x - k * side * (gx - rig.width / 2),
      y: hand.y + k * (rig.height - gy),
      scale: holder.perspective,
    },
    facing: holder.facing,
    turn: holder.turn,
    // Swung by the hand (a stick in a blow): turned about the grip, top toward the facing.
    tilt: wield ? { deg: side * wield, x: hand.x, y: hand.y } : undefined,
    tip: {
      x: hand.x + side * (dx * Math.cos(rad) - dy * Math.sin(rad)),
      y: hand.y + dx * Math.sin(rad) + dy * Math.cos(rad),
    },
    holder,
    pose,
    far,
  };
}

/**
 * The clods still in the air from the blows a held tool has struck in its holder's `dig`s:
 * thrown up where its tip went into the soil, for SOIL_TIME after each blow.
 */
function soilBursts(
  project: Project,
  scene: Scene,
  shot: Shot,
  prop: Character,
  propId: string,
  propScale: number,
  holderId: string,
  t: number,
  depth: number
): SoilBurst[] {
  const out: SoilBurst[] = [];
  shot.actions.forEach((a, n) => {
    if (a.actor !== holderId || a.do !== 'dig' || a.t > t) return;
    const d = actionDuration(a);
    if (t > a.t + d + SOIL_TIME) return;
    digHits(d).forEach((h, i) => {
      const at = a.t + h;
      if (at > t || t - at >= SOIL_TIME || holderAt(shot, propId, at) !== holderId) return;
      const held = heldPoint(project, scene, shot, prop, propScale, holderId, at, depth);
      const holder = resolveActor(project, scene, shot, holderId, at, depth + 1);
      out.push({
        x: held.tip.x,
        y: held.tip.y,
        age: t - at,
        scale: holder.scale * (holder.character.height / 250),
        side: holder.facing === 'left' ? -1 : 1,
        salt: `${shot.id}:${n}:${i}`,
      });
    });
  });
  return out;
}

export function resolveActor(
  project: Project,
  scene: Scene,
  shot: Shot,
  id: string,
  t: number,
  depth = 0
): ActorState {
  const character = project.characters[id];
  const cast = shot.cast[id];
  const actions = shot.actions.filter((a) => a.actor === id).sort((a, b) => a.t - b.t);

  let point = resolvePosition(project, scene, cast.at);
  if (cast.on) point = { ...point, rides: { base: cast.on, at: 0 } };
  const ride = (p: Point, time: number) => ridePoint(project, scene, shot, p, time, depth);
  // Moving between two spots that may each be on someone, where both of them are at `time`.
  const along = (m: Move, time: number) =>
    movePoint({ ...m, from: ride(m.from, time), to: ride(m.to, time) }, time);
  let facing: Facing = cast.facing;
  let scale = cast.scale;
  let visible = cast.visible;
  let opacity = 1;
  let emotion: Emotion = cast.emotion;
  let face: Record<string, string> = {};
  let sitting = false;
  let seat = 0;
  let perched = false;
  // Lying on a raised bed (a cot with a `floor`): how high it is, so getting up off it steps
  // down to the floor in front, as off a seat. Lying is on the bed's surface, so `seat`
  // stays 0 while lying, and takes the bed's height as it gets up.
  let bed = 0;
  // Standing on another actor, and when a move that takes it off lands.
  let on = cast.on;
  let offAt = Infinity;
  // A person climbs onto a raised seat and off it on their legs (the pose does it); an
  // animal hops up and down.
  const hops = rigOf(character).name !== 'humanoid';
  const hop = (from: Point, to: Point, at: number): Move => ({
    verb: 'jump',
    from,
    to,
    t0: at,
    t1: at + VERB_DURATION.jump!,
    rest: at,
  });
  /**
   * Getting up off a raised seat: on it until `at`, then on the floor in front of it (an
   * animal hops down onto it). Gives when it is on the floor.
   */
  let rise: { at: number; seat: Point; hop?: Move } | undefined;
  const getUp = (at: number, seated: boolean): number => {
    const lift = seat > 0 ? seat : bed;
    bed = 0;
    if (!seated || lift <= 0) return at;
    // Stood on the seat to sit on it: stands up on it again.
    if (perched) {
      rise = { at, seat: point };
      return at;
    }
    // Off a cot, as off a chair: the legs come down to the floor as it sits up and rises.
    seat = lift;
    const floor = { ...point, y: point.y + lift };
    rise = { at, seat: point, hop: hops ? hop(point, floor, at) : undefined };
    point = floor;
    return rise.hop?.t1 ?? at;
  };
  /**
   * Going to sit or lie somewhere else: walking there (an animal then hopping up onto a
   * raised seat) until `at`, then on `point`. `undo` is how it stood before, to go back to
   * if something else comes first.
   */
  let perch: { at: number; point: Point; seat: number; hop?: Move; undo: () => void } | undefined;
  let sitAt = -Infinity;
  let sitFrom = 0;
  let lying = false;
  let lieAt = -Infinity;
  let lieFrom = 0;
  let turnAt = -Infinity;
  let turnFrom: Facing = facing;
  let holder: string | undefined;
  /** Taken up mid-shot: how far it was from the hand that took it, when it did. */
  let lift: { at: number; dx: number; dy: number } | undefined;
  let takeAt = -Infinity;
  /** An arrow left on the string of a bow lowered without a shot. */
  let nocked: string | undefined;
  let move: Move | undefined;
  let locoStart = 0;
  let locomotion: Locomotion = 'idle';
  const verbs: ActiveVerb[] = [];
  /**
   * Verbs whose hand goes somewhere in the scene, worked out into the box once it is known
   * where the actor stands. `stands` is where a prop taken or set down stands: the hand
   * goes to it only when that is up off the floor.
   */
  const aims: { v: ActiveVerb; spot: () => { x: number; y: number; stands?: number } }[] = [];
  let bubble: Bubble | undefined;
  let talking = false;
  let mouth: boolean | undefined;
  let sitTime = SIT_TIME;
  let lieTime = LIE_TIME;
  const sitAmount = (time: number) =>
    lerp(sitFrom, sitting ? 1 : 0, clamp01((time - sitAt) / sitTime));
  const turnTo = (to: Facing, at: number) => {
    if (to === facing) return;
    turnFrom = facing;
    turnAt = at;
    facing = to;
  };
  const sitTo = (down: boolean, at: number, time = SIT_TIME) => {
    if (down === sitting) return;
    sitFrom = sitAmount(at);
    sitAt = at;
    sitTime = time;
    sitting = down;
  };
  const lieAmount = (time: number) =>
    lerp(lieFrom, lying ? 1 : 0, clamp01((time - lieAt) / lieTime));
  const lieTo = (down: boolean, at: number, time = LIE_TIME) => {
    if (down === lying) return;
    lieFrom = lieAmount(at);
    lieAt = at;
    lieTime = time;
    lying = down;
  };
  // A `duration` on sit, lie or stand is the whole change; going between standing and
  // lying it is shared between the sitting and the lying part as the defaults are.
  const share = (a: Action, parts: number) => (a.duration ?? parts) / parts;
  // Sat or lying down, it gets up first (sitting up, then standing) and sets off once it is
  // up; setting off at once would slide it along the floor as it rose. Gives when it can.
  const setOff = (at: number): number => {
    const lie = lieAmount(at);
    lieTo(false, at, Math.max(1e-3, LIE_TIME * lie));
    const risen = lie > 0 ? lieAt + lieTime : at;
    const seated = sitting;
    sitTo(false, risen);
    return getUp(Math.max(risen, sitAmount(at) > 0 ? sitAt + sitTime : at), seated);
  };
  const stance = () => {
    const s = { sitting, sitFrom, sitAt, sitTime, lying, lieFrom, lieAt, lieTime };
    return () => ({ sitting, sitFrom, sitAt, sitTime, lying, lieFrom, lieAt, lieTime } = s);
  };

  for (const a of actions) {
    if (a.t > t) break;
    // Where is the actor when this action starts? Stopped part way, it is no longer on anyone.
    if (move) {
      const e = moveProgress(move, a.t);
      point = e <= 0 ? move.from : e >= 1 ? move.to : along(move, a.t);
    }
    if (rise && a.t >= (rise.hop?.t1 ?? rise.at)) {
      rise = undefined;
      seat = 0;
    }
    if (perch && a.t >= perch.at) {
      point = perch.point;
      seat = perch.seat;
      move = undefined;
      perch = undefined;
    }
    // Told to do something else before it got to its seat: it does not sit there after all.
    if (perch && (a.set?.at || (a.do && (isMoveVerb(a.do) || SETTLE_VERBS.has(a.do))))) {
      perch.undo();
      perch = undefined;
    }

    // Let go before `set`, so a `set.at` in the same action puts the prop down there.
    // A pickup takes hold, and a putdown lets go, only once the stooping hand is down.
    const at = attachTime(a);
    if (a.attach !== undefined && at <= t) {
      if (a.attach) {
        // Taken mid-shot, it travels from where it was (on the floor, in another hand) into
        // the hand, rather than jumping to it.
        if (at > 0 && depth < MAX_DEPTH) {
          const from = holder
            ? heldPoint(project, scene, shot, character, scale, holder, at - 1e-6, depth).point
            : point;
          const held = heldPoint(project, scene, shot, character, scale, a.attach, at, depth);
          const dx = from.x - held.point.x;
          const dy = from.y - held.point.y;
          // From across the stage it would fly: that is a cut in all but name, so it jumps.
          const far = Math.hypot(dx, dy) > project.characters[a.attach].height;
          lift = a.do === 'pickup' || !far ? { at, dx, dy } : undefined;
        } else lift = undefined;
        holder = a.attach;
      } else if (holder && depth < MAX_DEPTH) {
        // Let go: it stays where the hand was just before (the arm relaxes after).
        const before = Math.max(0, at - 1e-6);
        point = heldPoint(project, scene, shot, character, scale, holder, before, depth).point;
        if (a.do === 'putdown') {
          // Set down from the low hand: onto `to`, or the floor the carrier stands on.
          const carrier = resolveActor(project, scene, shot, holder, at, depth + 1);
          const to = a.to
            ? resolvePosition(project, scene, a.to)
            : { x: point.x, y: carrier.y, scale: carrier.perspective };
          move = { verb: 'move', from: point, to, t0: at, t1: at + SETTLE_TIME, rest: at };
        }
        holder = undefined;
        lift = undefined;
      } else holder = undefined;
      if (a.do !== 'putdown') move = undefined;
    }
    if (offAt <= a.t) {
      on = undefined;
      offAt = Infinity;
    }
    if (a.set) {
      if (a.set.at) {
        point = resolvePosition(project, scene, a.set.at);
        if (a.on) point = { ...point, rides: { base: a.on, at: a.t } };
        move = undefined;
        rise = undefined;
        on = a.on;
        offAt = Infinity;
      }
      if (a.set.facing) turnTo(a.set.facing, a.t);
      if (a.set.scale) scale = a.set.scale;
      if (a.set.visible !== undefined) visible = a.set.visible;
    }
    if (a.emotion) {
      if (a.emotion !== emotion) takeAt = a.t;
      emotion = a.emotion;
    }
    if (a.face) {
      face = { ...face, ...a.face };
      // An empty variant hands the part back to the emotion, blinking and talking.
      for (const [part, variant] of Object.entries(a.face)) if (!variant) delete face[part];
    }

    if (a.say) {
      const d = lineDuration(project, shot, a);
      if (t < a.t + d) {
        bubble = {
          text: shownText(a.say),
          style: a.bubble ?? 'speech',
          age: t - a.t,
          left: a.t + d - t,
        };
        // A thought is not said out loud: the mouth stays still.
        talking = a.bubble !== 'thought';
        // A voiced line moves the mouth with its sound, and closes it in the pauses; it is
        // open through a growl or a laugh the line starts with.
        const clip = clipFor(project, shot, a);
        const u = t - a.t - lineLead(project, shot, a);
        mouth = !talking ? undefined : u < 0 ? true : clip ? mouthOpen(clip, u) : undefined;
      }
    }

    // A pickup or putdown is the carrier's stoop, not something the prop does.
    if (a.do && !isStoop(a)) {
      const verb = a.do;
      if (isMoveVerb(verb)) {
        let to = a.to ? resolvePosition(project, scene, a.to) : point;
        const d = actionDuration(a, point, to);
        const t0 = setOff(a.t);
        // A spot on someone is read off them as they are when it lands there.
        if (a.on && to.rides?.base !== a.on) to = { ...to, rides: { base: a.on, at: t0 + d } };
        move = { verb, from: point, to, t0, t1: t0 + d, rest: locoStart };
        locoStart = t0;
        // Up onto someone from when it sets off; off them once it lands somewhere else.
        if (a.on) {
          on = a.on;
          offAt = Infinity;
        } else if (on && a.to) offAt = t0 + d;
        if (Math.abs(to.x - point.x) > 1) turnTo(to.x > point.x ? 'right' : 'left', a.t);
        if (verb === 'jump' && t >= t0 && t < t0 + d) verbs.push({ verb, u: (t - t0) / d });
      } else if (verb === 'sit' || verb === 'lie') {
        // Sitting again before it was up: still on the seat.
        const again = rise !== undefined;
        if (rise) {
          point = rise.seat;
          rise = undefined;
        }
        // Sitting down where it stands: a person standing on a raised seat (jumped up onto a
        // branch) sits from there, not from the floor below it.
        const fresh = !sitting && !again && !hops;
        if (fresh) perched = true;
        const from = point;
        // When it starts to sit: at once, or once it has got there.
        let at = a.t;
        if (a.to) {
          const to = resolvePosition(project, scene, a.to);
          // Where it stands now, and where it will stand to sit (or lie) there.
          const ground = sitting ? { ...point, y: point.y + seat } : point;
          // How far the floor is below it: a cot is lain on from the floor in front of it.
          const high = verb === 'sit' ? seatHeight(scene, ground, to) : bedHeight(scene, to);
          const foot = { ...to, y: to.y + high };
          // Already standing on the seat itself (cast there to open the shot sat on it): it
          // sits where it is, rather than walking down to the floor under a high seat (a
          // branch) and climbing back up.
          const there = Math.hypot(to.x - point.x, to.y - point.y) < 1;
          const far = !there && Math.hypot(foot.x - ground.x, foot.y - ground.y) > APPROACH;
          const up = hops && high > 0 && !there;
          if (fresh) perched = there;
          if (far || up) {
            // Up, across to the foot of it and (an animal) up onto it, then down.
            at = setOff(a.t);
            if (far) {
              const d = moveDuration('walk', point, foot);
              move = { verb: 'walk', from: point, to: foot, t0: at, t1: at + d, rest: locoStart };
              locoStart = at;
              if (Math.abs(foot.x - point.x) > 1) turnTo(foot.x > point.x ? 'right' : 'left', a.t);
              at += d;
            }
            const jump = up ? hop(foot, to, at) : undefined;
            perch = { at: jump?.t1 ?? at, point: to, seat: high, hop: jump, undo: stance() };
            at = perch.at;
          } else {
            point = to;
            move = undefined;
          }
          // After any getting up to go there, which leaves the bed it was on.
          bed = verb === 'lie' ? bedHeight(scene, to) : 0;
        }
        // Opening a shot already sat or lying (at 0, done in a blink): it is done by the first
        // frame, which would otherwise show it still standing for a frame at the cut.
        if (a.t === 0 && at === 0 && a.duration !== undefined && a.duration <= OPENING)
          at = -a.duration;
        if (verb === 'sit') {
          if (!sitting && !perch) seat = seatHeight(scene, from, point);
          // Already lying: sit back up.
          const k = share(a, lying ? LIE_TIME : SIT_TIME);
          sitTo(true, at, SIT_TIME * k);
          lieTo(false, at, LIE_TIME * k);
        } else {
          // Lying is on the surface itself: sit down on it first, then lie back.
          const k = share(a, (sitting ? 0 : SIT_TIME) + LIE_TIME);
          const down = sitting ? 0 : SIT_TIME * k;
          if (!sitting && !perch) seat = 0;
          sitTo(true, at, SIT_TIME * k);
          lieTo(true, at + down, LIE_TIME * k);
        }
      } else if (verb === 'stand') {
        // From lying, sit up first, then get up.
        const k = share(a, (lying ? LIE_TIME : 0) + SIT_TIME);
        const up = a.t + (lying ? LIE_TIME * k : 0);
        getUp(up + SIT_TIME * k, sitting);
        sitTo(false, up, SIT_TIME * k);
        lieTo(false, a.t, LIE_TIME * k);
      } else if (verb === 'appear' || verb === 'disappear') {
        const d = actionDuration(a);
        const u = clamp01((t - a.t) / d);
        visible = true;
        // The pop itself is a verb (scale with overshoot); the fade is quicker than it.
        opacity = verb === 'appear' ? clamp01(u * 3) : 1 - clamp01((u - 0.35) / 0.65);
        if (u < 1) verbs.push({ verb, u });
        else if (verb === 'disappear') visible = false;
      } else if (verb === 'aim') {
        // Drawing a bow at `to`, turned to face it; cut short by a shot, followed through.
        // The first takes the bow into the far hand, where it stays.
        const aimed = shot.actions.some(
          (o) => o !== a && o.actor === a.actor && o.do === 'aim' && o.t < a.t
        );
        const d = aimSpan(shot, a);
        const lo = looseOf(shot, a);
        const to = a.to;
        if (to && depth < MAX_DEPTH) {
          const at = aimSpot(project, scene, shot, to, a.t, depth);
          if (Math.abs(at.x - point.x) > 1) turnTo(at.x > point.x ? 'right' : 'left', a.t);
        }
        if (t < a.t + d) {
          const v: ActiveVerb = {
            verb,
            u: (t - a.t) / d,
            span: d,
            loose: lo === undefined ? undefined : lo - a.t,
            handOver: !aimed,
          };
          verbs.push(v);
          if (to && depth < MAX_DEPTH)
            aims.push({ v, spot: () => aimSpot(project, scene, shot, to, t, depth) });
          nocked = undefined;
        } else nocked = lo === undefined ? a.arrow : undefined;
      } else if (verb === 'shoot') {
        // The aim it looses does it all.
      } else {
        const d = actionDuration(a);
        if (t < a.t + d) {
          const v: ActiveVerb = { verb, u: (t - a.t) / d, span: d };
          verbs.push(v);
          const to = a.to;
          if ((verb === 'wipe' || verb === 'hold') && to && depth < MAX_DEPTH)
            aims.push({ v, spot: () => wipeSpot(project, scene, shot, to, t, depth, verb) });
        }
      }
    }
  }

  // Stooping for a prop someone else's action names: taking it up or setting it down.
  for (const a of shot.actions) {
    if (a.t > t || stooper(shot, a) !== id) continue;
    const d = actionDuration(a);
    if (t >= a.t + d) continue;
    const v: ActiveVerb = { verb: a.do!, u: (t - a.t) / d, span: d };
    verbs.push(v);
    // Off a table or into a hand the hand goes to the grip; onto a table, to where the grip
    // will be once it is set down there.
    const prop = a.actor!;
    const to = a.to;
    if (depth >= MAX_DEPTH) continue;
    if (a.do === 'pickup')
      aims.push({
        v,
        spot: () => {
          const p = resolveActor(project, scene, shot, prop, attachTime(a) - 1e-6, depth + 1);
          return { ...gripAt(p.character, p, p.scale, p.facing), stands: p.y };
        },
      });
    else if (to)
      aims.push({
        v,
        spot: () => {
          const p = resolveActor(project, scene, shot, prop, a.t, depth + 1);
          const at = resolvePosition(project, scene, to);
          const k = (p.scale / p.perspective) * at.scale;
          return { ...gripAt(p.character, at, k, p.facing), stands: at.y };
        },
      });
  }

  let travel: Travel | undefined;
  if (move) {
    point = along(move, t);
    if (t < move.t0) {
      locoStart = move.rest;
    } else if (t < move.t1) {
      if (move.verb === 'walk' || move.verb === 'run') {
        const k = (character.height / rigOf(character).height) * scale;
        const m = move;
        travel = {
          dist: canonicalDistance(m, moveProgress(m, t), k),
          total: canonicalDistance(m, 1, k),
          time: m.t1 - m.t0,
        };
      }
      locomotion =
        move.verb === 'walk' || move.verb === 'run' || move.verb === 'fly'
          ? move.verb
          : move.verb === 'jump'
            ? 'idle'
            : 'move';
    } else {
      locoStart = move.t1;
    }
  }

  const turnTime = character.rig === 'quadruped' ? QUAD_TURN_TIME : TURN_TIME;
  let turn = t - turnAt < turnTime ? { from: turnFrom, u: (t - turnAt) / turnTime } : undefined;
  const heldBy = holder && depth < MAX_DEPTH ? holder : undefined;
  let tilt: ActorState['tilt'];
  let soil: SoilBurst[] | undefined;
  let bowHeld: Held | undefined;
  if (heldBy) {
    const held = heldPoint(project, scene, shot, character, scale, heldBy, t, depth);
    bowHeld = held;
    point = held.point;
    if (lift && t < lift.at + LIFT_TIME) {
      const k = 1 - easeInOut((t - lift.at) / LIFT_TIME);
      point = { ...point, x: point.x + lift.dx * k, y: point.y + lift.dy * k };
    }
    facing = held.facing;
    tilt = held.tilt;
    const burst = soilBursts(project, scene, shot, character, id, scale, heldBy, t, depth);
    if (burst.length) soil = burst;
    turn = held.turn;
    locomotion = 'idle';
  }
  const hopping = (m: Move | undefined) => {
    if (!m || t < m.t0 || t >= m.t1 || heldBy) return false;
    point = movePoint(m, t);
    verbs.push({ verb: 'jump', u: (t - m.t0) / (m.t1 - m.t0) });
    return true;
  };
  // Still getting up off a raised seat: on the seat, which the pose lowers to the floor.
  const rising = rise && t < rise.at && !heldBy;
  if (rising) point = rise!.seat;
  else if (rise) {
    seat = 0;
    hopping(rise.hop);
  }
  // Got to the seat it was going to: on it.
  if (perch && !heldBy && !hopping(perch.hop) && t >= perch.at) {
    point = perch.point;
    seat = perch.seat;
  }
  // Standing still on someone: wherever that spot on them has got to.
  if (point.rides) point = ride(point, t);
  if (offAt <= t) on = undefined;
  const holding = Object.keys(shot.cast).some((other) => holderAt(shot, other, t) === id);
  const state: ActorState = {
    id,
    character,
    x: point.x,
    y: point.y,
    scale: scale * point.scale,
    facing,
    visible,
    opacity,
    locomotion,
    locoT: t - locoStart,
    travel,
    turn,
    view: move && !heldBy ? moveView(move, t) : 0,
    sit: sitAmount(t),
    seat,
    perched: perched && seat > 0,
    lie: lieAmount(t),
    perspective: point.scale,
    on: heldBy ? undefined : on,
    heldBy,
    tilt,
    soil,
    nocked: nocked && bowOf(project, shot, id, t) ? nocked : undefined,
    aimed: shot.actions.some((a) => a.actor === id && a.do === 'aim' && a.t <= t) || undefined,
    behind: bowHeld?.far || undefined,
    holding,
    look: 0,
    take: t - takeAt < TAKE_TIME ? { u: (t - takeAt) / TAKE_TIME, emotion } : undefined,
    emotion,
    face,
    verbs,
    bubble,
    talking,
    mouth,
    phase: hash01(id),
  };
  const rig = rigOf(character);
  const s = (character.height / rig.height) * state.scale;
  const side = facing === 'left' ? -1 : 1;
  for (const { v, spot } of aims) {
    const at = spot();
    // From the floor a person stoops for a prop; one standing knee high or more (on a
    // table, a shelf) is reached for.
    const knee = rig.bends.legR?.[1] ?? 0;
    if (at.stands !== undefined && rig.height + (at.stands - state.y) / s > knee) continue;
    v.to = [(at.x - state.x) / (s * side) + rig.width / 2, (at.y - state.y) / s + rig.height];
  }
  // Looks are worked out for the actors on screen, not for the ones resolved to find them.
  if (depth === 0 && !heldBy) state.look = lookPitch(project, scene, shot, state, t, depth);
  if (character.bowstring) {
    const bow = bowHeld?.pose.bow;
    if (bow?.draw) state.flex = bow.draw;
    state.bowstring = bowstringOf(state, t, bowHeld);
  }
  // An arrow on a bow, in flight or stuck in something: archery puts it there.
  if (!heldBy) {
    const arrow = arrowAt(project, scene, shot, id, t, depth);
    if (arrow) Object.assign(state, arrow, { turn: undefined, travel: undefined, view: 0 });
  }
  return state;
}

/** Where a `hold` rests on someone: this share of the way from their feet to the top of the head. */
const HOLD_AT = 0.62;

/**
 * What a `wipe` wipes or a `hold` rests on, in the scene: the middle of an actor named in
 * `to` (for a hold, its shoulder), or the spot.
 */
function wipeSpot(
  project: Project,
  scene: Scene,
  shot: Shot,
  to: Position,
  t: number,
  depth: number,
  verb: Verb = 'wipe'
): { x: number; y: number } {
  if (typeof to === 'string' && shot.cast[to] && project.characters[to]) {
    const o = resolveActor(project, scene, shot, to, t, depth + 1);
    if (verb === 'hold') {
      // The shoulder, along the body as it is now: sitting up off the floor, getting to its
      // feet, so a hand that holds someone helps them up.
      const head = actorHeadTop(o, poseFor(o, t));
      return { x: o.x + (head.x - o.x) * HOLD_AT, y: o.y + (head.y - o.y) * HOLD_AT };
    }
    return { x: o.x, y: o.y - (o.character.height * o.scale) / 2 };
  }
  return resolvePosition(project, scene, to);
}

/** Between the eyes, in the scene, ignoring the pose: what others look toward. */
function eyePoint(a: ActorState): { x: number; y: number } {
  const rig = rigOf(a.character);
  const k = (a.character.height / rig.height) * a.scale;
  const side = a.facing === 'left' ? -1 : 1;
  return {
    x: a.x + k * side * (rig.eye[0] - rig.width / 2),
    y: a.y + k * (rig.eye[1] - rig.height),
  };
}

const ATTENTION_VERBS: ReadonlySet<Verb> = new Set(['walk', 'run', 'move', 'fly', 'jump', 'point']);

/**
 * Who an actor is attending to at time t: whoever spoke last (a listener watches the
 * speaker), or, while speaking, the one spoken to (`to`, else whoever spoke before, else
 * the nearest actor in front). Walking, jumping and pointing look straight ahead.
 * Returns the last two targets and when the latest began, so the head can ease over.
 */
function attention(shot: Shot, a: ActorState, t: number) {
  type Target = string | undefined; // undefined: straight ahead
  const events: { at: number; target: Target }[] = [];
  let lastOther: string | undefined;
  for (const act of [...shot.actions].sort((x, y) => x.t - y.t)) {
    if (act.t > t || !act.actor) continue;
    if (act.actor === a.id) {
      if (act.do && ATTENTION_VERBS.has(act.do)) events.push({ at: act.t, target: undefined });
      else if (act.say) {
        const named = typeof act.to === 'string' && shot.cast[act.to] ? act.to : undefined;
        events.push({ at: act.t, target: named ?? lastOther ?? '' });
      }
    } else if (act.say && act.bubble !== 'thought' && shot.cast[act.actor]) {
      // Nobody hears a thought, so nobody turns to the thinker.
      events.push({ at: act.t, target: act.actor });
      lastOther = act.actor;
    }
  }
  const cur = events.at(-1);
  const prev = events.at(-2);
  return { cur: cur?.target, prev: prev?.target, since: cur ? t - cur.at : Infinity };
}

/**
 * The head tilt (degrees, down positive) toward the actor's current target, eased from
 * the previous one. Only targets in front count: the engine never turns a body round to
 * look, so a target behind leaves the head level.
 */
function lookPitch(
  project: Project,
  scene: Scene,
  shot: Shot,
  a: ActorState,
  t: number,
  depth: number
): number {
  // Something without eyes (a kite, a lantern) attends to nobody.
  if (a.locomotion !== 'idle' || !a.visible || !a.character.parts.eyes) return 0;
  const { cur, prev, since } = attention(shot, a, t);
  const others = new Map<string, ActorState>();
  const other = (id: string) => {
    if (!others.has(id)) others.set(id, resolveActor(project, scene, shot, id, t, depth + 1));
    return others.get(id)!;
  };
  const me = eyePoint(a);
  const side = a.facing === 'left' ? -1 : 1;
  const inFront = (o: ActorState) => o.visible && (o.x - a.x) * side > 4;
  const pitchTo = (target: string | undefined): number => {
    if (target === undefined) return 0;
    let o: ActorState | undefined;
    if (target) o = other(target);
    else {
      // Speaking with no one named or heard yet: the nearest actor in front.
      let best = Infinity;
      for (const id of Object.keys(shot.cast)) {
        if (id === a.id) continue;
        const c = other(id);
        if (inFront(c) && Math.abs(c.x - a.x) < best) {
          best = Math.abs(c.x - a.x);
          o = c;
        }
      }
    }
    if (!o || !inFront(o)) return 0;
    const them = eyePoint(o);
    // The head goes half way; eyes would do the rest, and a full turn reads as a glare.
    const deg = (0.5 * Math.atan2(them.y - me.y, Math.abs(them.x - me.x)) * 180) / Math.PI;
    const limit = LOOK_LIMIT[a.character.rig];
    return Math.max(-limit, Math.min(limit, deg));
  };
  const now = pitchTo(cur);
  if (since >= LOOK_TIME) return now;
  return lerp(pitchTo(prev), now, easeInOut(since / LOOK_TIME));
}

/** How far a head tilts to look (the simple rig tips its whole body, so less). */
export const LOOK_LIMIT: Record<Character['rig'], number> = {
  humanoid: 10,
  quadruped: 8,
  simple: 5,
};

/** Seconds of an actor's path the camera averages when it follows: how far it trails. */
const FOLLOW_LAG = 0.9;
/** Room left ahead of a followed actor, as a share of the frame's width. */
const FOLLOW_LEAD = 0.12;

export function resolveCamera(project: Project, scene: Scene, shot: Shot, t: number): View {
  const { width, height } = project.meta;
  type Aim = View & { follow?: string };
  const base = (c: Partial<Camera>, prev: Aim): Aim => ({
    zoom: c.zoom ?? prev.zoom,
    x: c.x ?? prev.x,
    y: c.y ?? prev.y,
    // An explicit point lets go of whoever the camera was following.
    follow:
      c.follow !== undefined
        ? c.follow || undefined
        : c.x !== undefined || c.y !== undefined
          ? undefined
          : prev.follow,
  });
  // Keep the view inside the scene so zooming never shows the black outside the artwork.
  const clampCam = (c: View): View => {
    const zoom = Math.max(1, c.zoom);
    const hw = width / (2 * zoom);
    const hh = height / (2 * zoom);
    return {
      zoom,
      x: Math.min(width - hw, Math.max(hw, c.x)),
      y: Math.min(height - hh, Math.max(hh, c.y)),
    };
  };
  // Where following an actor puts the camera: the mean of where it has been over the last
  // moment, newer places weighing more, so the camera eases after a start and settles
  // after a stop instead of being nailed to the actor. Pure in t, as every frame must be.
  const followed = (id: string, zoom: number, time: number): View => {
    const n = 8;
    let x = 0;
    let y = 0;
    let sum = 0;
    for (let j = 0; j <= n; j++) {
      const a = resolveActor(project, scene, shot, id, Math.max(0, time - (FOLLOW_LAG * j) / n));
      const h = a.character.height * a.scale;
      const w = n + 1 - j;
      const ahead = (a.facing === 'left' ? -1 : 1) * ((FOLLOW_LEAD * width) / zoom);
      // Each place is kept inside the scene before the mean, so the camera eases to a stop
      // at the scene's edge rather than hitting it.
      const at = clampCam({ zoom, x: a.x + ahead, y: a.y - 0.45 * h });
      x += w * at.x;
      y += w * at.y;
      sum += w;
    }
    return { zoom, x: x / sum, y: y / sum };
  };
  const view = (c: Aim, time: number): View =>
    c.follow && shot.cast[c.follow] ? followed(c.follow, c.zoom, time) : c;
  let cam = base(shot.camera, { zoom: 1, x: width / 2, y: height / 2 });
  let tween: { from: View; t0: number; t1: number } | undefined;
  const camAt = (time: number): View => {
    const to = view(cam, time);
    if (!tween) return clampCam(to);
    const u = easeInOut(clamp01((time - tween.t0) / Math.max(1e-6, tween.t1 - tween.t0)));
    return clampCam({
      zoom: lerp(tween.from.zoom, to.zoom, u),
      x: lerp(tween.from.x, to.x, u),
      y: lerp(tween.from.y, to.y, u),
    });
  };
  for (const a of shot.actions.filter((a) => a.camera).sort((a, b) => a.t - b.t)) {
    if (a.t > t) break;
    const from = camAt(a.t);
    const d = a.duration ?? 1;
    cam = base(a.camera!, { ...cam, ...from });
    tween = d > 0 ? { from, t0: a.t, t1: a.t + d } : undefined;
  }
  return camAt(t);
}

function resolveCaptions(project: Project, shot: Shot, t: number): CaptionState[] {
  const out: CaptionState[] = [];
  for (const a of shot.actions) {
    if (!a.caption) continue;
    const d = lineDuration(project, shot, a);
    if (t < a.t || t >= a.t + d) continue;
    const fadeLen = Math.min(0.3, d / 3);
    const inU = clamp01((t - a.t) / (fadeLen * 1.5));
    const outU = clamp01((a.t + d - t) / fadeLen);
    const opacity = Math.min(1, (t - a.t) / fadeLen, outU);
    const slide = 1 - easeOut(inU) + 0.5 * (1 - outU);
    out.push({ text: shownText(a.caption), style: a.captionStyle ?? 'narration', opacity, slide });
  }
  return out;
}

/** The full state of a shot at time `t` (seconds from the start of the shot). */
export function resolveFrame(project: Project, shot: Shot, t: number): FrameState {
  const scene = project.scenes[shot.scene];
  if (!scene) throw new Error(`shot '${shot.id}' references unknown scene '${shot.scene}'`);
  const actors = Object.keys(shot.cast).map((id) => {
    if (!project.characters[id])
      throw new Error(`shot '${shot.id}' casts unknown character '${id}'`);
    return resolveActor(project, scene, shot, id, t);
  });
  // Lower on screen = closer to camera = drawn later; a carried prop just after its carrier,
  // and someone standing on another actor just after them (so before what they carry).
  const depthY = (a: ActorState, hops = 0): number => {
    const h = a.heldBy && actors.find((o) => o.id === a.heldBy);
    if (h && hops < MAX_DEPTH) return depthY(h, hops + 1) + (a.behind ? -0.01 : 0.01);
    // An arrow on the string: over the bow, which is over its archer, or behind him in his
    // far hand (and drawn over him too as it comes up, see compose.ts).
    const archer = a.nockedOn && actors.find((o) => o.id === a.nockedOn);
    if (archer && hops < MAX_DEPTH) {
      const behind = actors.some((o) => o.heldBy === archer.id && o.behind && o.bowstring);
      return depthY(archer, hops + 1) + (behind ? -0.005 : 0.02);
    }
    const under = a.on && actors.find((o) => o.id === a.on);
    if (under && hops < MAX_DEPTH) return depthY(under, hops + 1) + 0.005;
    return a.y;
  };
  actors.sort((a, b) => depthY(a) - depthY(b));

  let fade = 0;
  if (shot.fadeIn > 0 && t < shot.fadeIn) fade = 1 - t / shot.fadeIn;
  if (shot.fadeOut > 0 && t > shot.duration - shot.fadeOut)
    fade = Math.max(fade, (t - (shot.duration - shot.fadeOut)) / shot.fadeOut);

  return {
    t,
    shot,
    scene,
    actors,
    camera: resolveCamera(project, scene, shot, t),
    captions: resolveCaptions(project, shot, t),
    fade: clamp01(fade),
  };
}

/** Map movie time to (shot, local time). */
export function locateTime(
  project: Project,
  movieT: number
): { shot: Shot; t: number } | undefined {
  let acc = 0;
  for (const shot of project.shots) {
    if (movieT < acc + shot.duration) return { shot, t: movieT - acc };
    acc += shot.duration;
  }
  return undefined;
}

export function movieDuration(project: Project): number {
  return project.shots.reduce((s, sh) => s + sh.duration, 0);
}

// ---------------------------------------------------------------------------------------
// Archery: a bow drawn in an `aim`, the arrow on its string, loosed with a `shoot`.

/** Scene pixels a second an arrow flies, unless a shoot's `duration` says how long it takes. */
export const ARROW_SPEED = 2400;
/** The least time a flight takes, so even a close shot is seen leaving. */
const ARROW_MIN = 0.12;
/** The share of an arrow, from the head back, that goes into what it hits. */
const ARROW_BURY = 0.14;
/** Seconds an arrow that has just gone in shivers, and how far either way (degrees). */
const QUIVER = { time: 0.6, deg: 4.5, hz: 14, decay: 0.15 };
/** Seconds an arrow put on the string takes to fade in. */
const NOCK_FADE = 0.15;

/** A shot as the engine works it out: whose arrow, loosed when, from whose aim, at what. */
export interface Release {
  arrow: string;
  t: number;
  /** The archer whose aim it was on the string of, if it was. */
  archer?: string;
  aim?: Action;
  to?: Position;
  duration?: number;
}

const RELEASES = new WeakMap<Shot, Release[]>();

/** An aim in progress at t by `actor`, by its own (declared) length. */
function aimAt(shot: Shot, actor: string, t: number): Action | undefined {
  let found: Action | undefined;
  for (const a of shot.actions)
    if (a.actor === actor && a.do === 'aim' && a.t <= t && t <= a.t + actionDuration(a)) found = a;
  return found;
}

/** An aim in progress at t with `arrow` on its string. */
function aimWith(shot: Shot, arrow: string, t: number): Action | undefined {
  let found: Action | undefined;
  for (const a of shot.actions)
    if (a.do === 'aim' && a.arrow === arrow && a.t <= t && t <= a.t + actionDuration(a)) found = a;
  return found;
}

/**
 * Every arrow loosed in the shot: a `shoot` on an archer looses the arrow of the aim it is
 * in; one on an arrow looses it from the bow it is on, or sends it from where it is.
 */
export function releases(shot: Shot): Release[] {
  const known = RELEASES.get(shot);
  if (known) return known;
  const out: Release[] = [];
  for (const s of shot.actions) {
    if (s.do !== 'shoot' || !s.actor) continue;
    const own = aimAt(shot, s.actor, s.t);
    if (own) {
      if (own.arrow)
        out.push({
          arrow: own.arrow,
          t: s.t,
          archer: s.actor,
          aim: own,
          to: s.to ?? own.to,
          duration: s.duration,
        });
      continue;
    }
    const on = aimWith(shot, s.actor, s.t);
    const to = s.to ?? on?.to;
    if (to)
      out.push({ arrow: s.actor, t: s.t, archer: on?.actor, aim: on, to, duration: s.duration });
  }
  out.sort((a, b) => a.t - b.t);
  RELEASES.set(shot, out);
  return out;
}

/** When the arrow on an aim's string was loosed, if it was. */
export function looseOf(shot: Shot, aim: Action): number | undefined {
  return releases(shot).find((r) => r.aim === aim)?.t;
}

/** How long an aim lasts: as long as it says, or until a shot has been followed through and the bow lowered. */
export function aimSpan(shot: Shot, aim: Action): number {
  const lo = looseOf(shot, aim);
  return lo === undefined ? actionDuration(aim) : lo - aim.t + AIM.follow + AIM.lower;
}

/** Where on a character an arrow hits: its `mark`, else the middle of its box. */
function markPoint(o: ActorState, t: number): XY {
  const rig = rigOf(o.character);
  return partToScene(o, poseFor(o, t), o.character.mark ?? [rig.width / 2, rig.height / 2]);
}

/** What an aim or a shot is at, in the scene: an actor's mark, an anchor or a spot. */
function aimSpot(
  project: Project,
  scene: Scene,
  shot: Shot,
  to: Position,
  t: number,
  depth: number
): XY {
  if (typeof to === 'string' && shot.cast[to] && project.characters[to])
    return markPoint(resolveActor(project, scene, shot, to, t, depth + 1), t);
  return resolvePosition(project, scene, to);
}

/** The bow `archer` holds at t: a carried prop with a `bowstring`. */
export function bowOf(project: Project, shot: Shot, archer: string, t: number): string | undefined {
  return Object.keys(shot.cast).find(
    (id) => project.characters[id]?.bowstring && holderAt(shot, id, t) === archer
  );
}

/** How far a bow drawn as it is must turn (degrees, clockwise facing right) to stand across a line `deg` above level. */
function bowTurn(bow: Character, deg: number): number {
  const [[ax, ay], [bx, by]] = bow.bowstring!;
  const rad = (deg * Math.PI) / 180;
  // Across the line, the way the string runs: down and forward for a line going up.
  const dir = by >= ay ? 1 : -1;
  const want = Math.atan2(dir * Math.cos(rad), dir * Math.sin(rad));
  const has = Math.atan2(by - ay, bx - ax);
  const w = ((want - has) * 180) / Math.PI;
  return ((((w + 180) % 360) + 360) % 360) - 180;
}

/** A bow in the scene as it is held: its grip, the string's ends, where it is nocked at rest and where it is pulled to. */
interface BowAt {
  grip: XY;
  a: XY;
  b: XY;
  nock: XY;
  apex: XY;
  /** Scene pixels per unit of the bow's box. */
  k: number;
}

/** Where a point of an upright actor's box is in the scene, placed at (x, y), turned by tilt. */
function boxPoint(
  c: Character,
  at: XY,
  scale: number,
  side: number,
  tilt: ActorState['tilt'],
  [bx, by]: [number, number]
): XY {
  const rig = rigOf(c);
  const k = (c.height / rig.height) * scale;
  return turnBy(tilt, {
    x: at.x + k * side * (bx - rig.width / 2),
    y: at.y + k * (by - rig.height),
  });
}

/** A point of a carried prop turned as its holder's hand turns it (`ActorState.tilt`). */
function turnBy(tilt: ActorState['tilt'], p: XY): XY {
  if (!tilt) return p;
  const r = (tilt.deg * Math.PI) / 180;
  const dx = p.x - tilt.x;
  const dy = p.y - tilt.y;
  return {
    x: tilt.x + dx * Math.cos(r) - dy * Math.sin(r),
    y: tilt.y + dx * Math.sin(r) + dy * Math.cos(r),
  };
}

/** A bow held by `held.holder`, posed: its string, pulled to the near hand by the draw. */
function bowAt(bow: Character, scale: number, held: Held): BowAt {
  const { holder, pose } = held;
  const side = sideOf({ facing: held.facing, turn: held.turn, character: bow });
  const flex = bowFlex(bow, pose.bow?.draw ?? 0).map;
  const at = (p: [number, number]) => boxPoint(bow, held.point, scale, side, held.tilt, flex(p));
  const rig = rigOf(bow);
  const g = bow.grip ?? [rig.width / 2, rig.height / 2];
  const [e1, e2] = bow.bowstring!;
  const u = Math.abs(e2[1] - e1[1]) > 1e-6 ? (g[1] - e1[1]) / (e2[1] - e1[1]) : 0.5;
  const n0: [number, number] = bow.nock ?? [
    e1[0] + (e2[0] - e1[0]) * u,
    e1[1] + (e2[1] - e1[1]) * u,
  ];
  const nock = at(n0);
  const grip = at(g);
  let apex = nock;
  const draw = pose.bow?.draw ?? 0;
  if (draw > 0 && rigOf(holder.character).name === 'humanoid') {
    const hand = holdPoint(holder, pose);
    apex = { x: lerp(nock.x, hand.x, draw), y: lerp(nock.y, hand.y, draw) };
  }
  // Let go, the string snaps straight and shivers about where it rests.
  const tw = pose.bow?.twang;
  if (tw !== undefined && tw < 0.25) {
    const len = Math.hypot(grip.x - nock.x, grip.y - nock.y) || 1;
    const amp = 0.5 * len * Math.exp(-tw / 0.05) * Math.sin(2 * Math.PI * 22 * tw);
    apex = {
      x: nock.x + ((grip.x - nock.x) / len) * amp,
      y: nock.y + ((grip.y - nock.y) / len) * amp,
    };
  }
  return { grip, a: at(e1), b: at(e2), nock, apex, k: (bow.height / rig.height) * scale };
}

/** Where an arrow goes so its nock (`grip`) is at `g` and it points along `dir`. */
function placeArrow(
  arrow: Character,
  scale: number,
  g: XY,
  dir: XY
): { x: number; y: number; facing: Facing; tilt: ActorState['tilt'] } {
  const rig = rigOf(arrow);
  const [gx, gy] = arrow.grip ?? [rig.width / 2, rig.height / 2];
  const [tx, ty] = arrow.tip ?? [rig.width, gy];
  const facing: Facing = dir.x < 0 ? 'left' : 'right';
  const side = facing === 'left' ? -1 : 1;
  const k = (arrow.height / rig.height) * scale;
  const has = Math.atan2(k * (ty - gy), side * k * (tx - gx));
  const want = Math.atan2(dir.y, dir.x);
  let deg = ((want - has) * 180) / Math.PI;
  deg = ((((deg + 180) % 360) + 360) % 360) - 180;
  return {
    x: g.x - k * side * (gx - rig.width / 2),
    y: g.y - k * (gy - rig.height),
    facing,
    tilt: { deg, x: g.x, y: g.y },
  };
}

/** How long an arrow is in the scene, nock to head, at this scale. */
function arrowLength(arrow: Character, scale: number): number {
  const rig = rigOf(arrow);
  const [gx, gy] = arrow.grip ?? [rig.width / 2, rig.height / 2];
  const [tx, ty] = arrow.tip ?? [rig.width, gy];
  return Math.hypot(tx - gx, ty - gy) * (arrow.height / rig.height) * scale;
}

const unit = (v: XY): XY => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** An arrow on the string of `archer`'s bow at t: its nock at the string, pointing past the grip. */
function onTheString(
  project: Project,
  scene: Scene,
  shot: Shot,
  archer: string,
  t: number,
  depth: number
): { g: XY; dir: XY; perspective: number } | undefined {
  const bowId = bowOf(project, shot, archer, t);
  if (!bowId) return undefined;
  const bow = project.characters[bowId];
  const holder = resolveActor(project, scene, shot, archer, t, depth + 1);
  const held = heldFrom(holder, poseFor(holder, t), bow, shot.cast[bowId].scale);
  const b = bowAt(bow, shot.cast[bowId].scale * holder.perspective, held);
  return {
    g: b.apex,
    dir: unit({ x: b.grip.x - b.apex.x, y: b.grip.y - b.apex.y }),
    perspective: holder.perspective,
  };
}

/** One arrow's flight: from where it was loosed to where it went in, and what it hit. */
export interface Flight {
  release: Release;
  /** Its nock where it was loosed and where it ends up, and the way it flies. */
  from: XY;
  end: XY;
  dir: XY;
  /** Where its head goes in: the mark or spot it was shot at, as it was when it got there. */
  hit: XY;
  /** When it went in, shot seconds. */
  at: number;
  scale: number;
  /** The actor it went into, if it hit one. */
  target?: string;
}

/** How an arrow loosed in `release` flies. */
export function flightOf(
  project: Project,
  scene: Scene,
  shot: Shot,
  release: Release,
  depth: number
): Flight | undefined {
  const arrow = project.characters[release.arrow];
  const cast = shot.cast[release.arrow];
  if (!arrow || !cast || !release.to) return undefined;
  const before = Math.max(0, release.t - 1e-4);
  let from: XY;
  let scale: number;
  const nocked = release.archer
    ? onTheString(project, scene, shot, release.archer, before, depth)
    : undefined;
  if (nocked) {
    from = nocked.g;
    scale = cast.scale * nocked.perspective;
  } else {
    // Sent from where it lies.
    const st = resolveActor(project, scene, shot, release.arrow, before, depth + 1);
    from = gripAt(arrow, st, st.scale, st.facing);
    scale = st.scale;
  }
  const to = release.to;
  const first = aimSpot(project, scene, shot, to, release.t, depth);
  const time =
    release.duration ??
    Math.max(ARROW_MIN, Math.hypot(first.x - from.x, first.y - from.y) / ARROW_SPEED);
  const at = release.t + time;
  // A target on the move is hit where it has got to.
  const hit = aimSpot(project, scene, shot, to, at, depth);
  const dir = unit({ x: hit.x - from.x, y: hit.y - from.y });
  const len = arrowLength(arrow, scale);
  const inside = ARROW_BURY * len;
  const end = { x: hit.x + dir.x * (inside - len), y: hit.y + dir.y * (inside - len) };
  const target = typeof to === 'string' && shot.cast[to] && project.characters[to] ? to : undefined;
  return { release, from, end, dir, hit, at, scale, target };
}

/**
 * Where an arrow is at t, when archery has it: on the string of a bow in an aim (or left on a
 * lowered one), in flight, or stuck in what it hit and going where that goes. Nothing when
 * something since (an attach, a set, a move of its own) has taken it.
 */
function arrowAt(
  project: Project,
  scene: Scene,
  shot: Shot,
  id: string,
  t: number,
  depth: number
): Partial<ActorState> | undefined {
  if (depth >= MAX_DEPTH) return undefined;
  const arrow = project.characters[id];
  const cast = shot.cast[id];
  let since = -Infinity;
  for (const a of shot.actions)
    if (
      a.actor === id &&
      (a.attach !== undefined || a.set?.at || (a.do && isMoveVerb(a.do))) &&
      attachTime(a) <= t
    )
      since = Math.max(since, attachTime(a));
  const nock = shot.actions
    .filter((a) => a.do === 'aim' && a.arrow === id && a.actor && a.t <= t)
    .sort((a, b) => a.t - b.t)
    .at(-1);
  const shotOff = releases(shot)
    .filter((r) => r.arrow === id && r.t <= t)
    .at(-1);
  if (shotOff && shotOff.t >= (nock?.t ?? -Infinity) && shotOff.t >= since) {
    const f = flightOf(project, scene, shot, shotOff, depth);
    if (!f) return undefined;
    const len = arrowLength(arrow, f.scale);
    if (t < f.at) {
      // In flight, head first, a streak behind it.
      const e = (t - f.release.t) / (f.at - f.release.t);
      const g = { x: lerp(f.from.x, f.end.x, e), y: lerp(f.from.y, f.end.y, e) };
      const back = Math.min(1.4 * len, Math.hypot(g.x - f.from.x, g.y - f.from.y));
      return {
        ...placeArrow(arrow, f.scale, g, f.dir),
        scale: f.scale,
        perspective: f.scale / cast.scale,
        visible: true,
        opacity: 1,
        locomotion: 'move',
        streak:
          back > 1
            ? {
                x1: g.x,
                y1: g.y,
                x2: g.x - f.dir.x * back,
                y2: g.y - f.dir.y * back,
                w: Math.max(1.5, 0.05 * len),
              }
            : undefined,
      };
    }
    // Stuck in it: in a spot of the scene, or in an actor, going where it goes.
    let hit = f.hit;
    let g = f.end;
    let scale = f.scale;
    let visible = true;
    if (f.target) {
      const then = resolveActor(project, scene, shot, f.target, f.at, depth + 1);
      const now = resolveActor(project, scene, shot, f.target, t, depth + 1);
      const p0 = poseFor(then, f.at);
      const p1 = poseFor(now, t);
      hit = partToScene(now, p1, sceneToPart(then, p0, f.hit));
      g = partToScene(now, p1, sceneToPart(then, p0, f.end));
      const was = Math.hypot(f.hit.x - f.end.x, f.hit.y - f.end.y) || 1;
      scale = (f.scale * Math.hypot(hit.x - g.x, hit.y - g.y)) / was;
      visible = now.visible;
    }
    let dir = unit({ x: hit.x - g.x, y: hit.y - g.y });
    // The shiver as it goes in, about where it went in.
    const age = t - f.at;
    if (age < QUIVER.time) {
      const q =
        (QUIVER.deg *
          Math.exp(-age / QUIVER.decay) *
          Math.sin(2 * Math.PI * QUIVER.hz * age) *
          Math.PI) /
        180;
      const rot = (v: XY): XY => ({
        x: v.x * Math.cos(q) - v.y * Math.sin(q),
        y: v.x * Math.sin(q) + v.y * Math.cos(q),
      });
      const r = rot({ x: g.x - hit.x, y: g.y - hit.y });
      g = { x: hit.x + r.x, y: hit.y + r.y };
      dir = rot(dir);
    }
    const rig = rigOf(arrow);
    const [gx, gy] = arrow.grip ?? [rig.width / 2, rig.height / 2];
    const [tx, ty] = arrow.tip ?? [rig.width, gy];
    return {
      ...placeArrow(arrow, scale, g, dir),
      scale,
      perspective: scale / cast.scale,
      visible,
      opacity: 1,
      locomotion: 'idle',
      bury: ARROW_BURY * Math.hypot(tx - gx, ty - gy),
      on: f.target,
    };
  }
  if (!nock || nock.t < since) return undefined;
  const archer = nock.actor!;
  // On the string: while the aim lasts, and after it on a lowered bow, while the archer
  // still holds one.
  const on = onTheString(project, scene, shot, archer, t, depth);
  if (!on) return undefined;
  const scale = cast.scale * on.perspective;
  return {
    ...placeArrow(arrow, scale, on.g, on.dir),
    scale,
    perspective: on.perspective,
    visible: true,
    opacity: clamp01((t - nock.t) / NOCK_FADE),
    locomotion: 'idle',
    nockedOn: archer,
  };
}

/** A bow's string, as the bow is drawn now: held (and pulled) or lying where it is. */
function bowstringOf(state: ActorState, t: number, held?: Held): ActorState['bowstring'] {
  const bow = state.character;
  const rig = rigOf(bow);
  const k = (bow.height / rig.height) * state.scale;
  if (held) {
    const b = bowAt(bow, state.scale, held);
    return { a: b.a, apex: b.apex, b: b.b, width: Math.max(0.8, 1.5 * k) };
  }
  const pose = poseFor(state, t);
  // Lying where it is, it moves as its main part does.
  const at = (p: [number, number]) => turnBy(state.tilt, partToScene(state, pose, p));
  const [e1, e2] = bow.bowstring!;
  const a = at(e1);
  const b = at(e2);
  return { a, apex: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b, width: Math.max(0.8, 1.5 * k) };
}
