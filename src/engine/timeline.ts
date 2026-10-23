import { clamp01, easeInOut, easeOut, hash01, lerp, ramp } from './easing.js';
import { holdPoint, poseFor } from './actor.js';
import type { Travel } from './gait.js';
import { isMoveVerb, JUMP, SPEED, VERB_DURATION, type Locomotion } from './motion.js';
import { RIGS } from './rigs.js';
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

export interface Point {
  x: number;
  y: number;
  scale: number;
}

export interface ActiveVerb {
  verb: Verb;
  /** Progress 0..1. */
  u: number;
}

export interface Bubble {
  text: string;
  style: 'speech' | 'thought' | 'shout';
  /** Seconds since it appeared and until it goes, for the pop in and out. */
  age: number;
  left: number;
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
  /** 0 up, 1 lying down (from sitting); in between while lying back or sitting up. */
  lie: number;
  /** The anchor's perspective scale under the actor (already folded into `scale`). */
  perspective: number;
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
  phase: number;
}

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
  const ground = scene.ground ?? height * 0.9;
  if (typeof pos !== 'string') return { x: pos.x, y: pos.y, scale: pos.scale ?? 1 };
  const a = scene.anchors[pos];
  if (a) return { x: a.x, y: a.y, scale: a.scale };
  switch (pos) {
    case 'left':
      return { x: width * 0.22, y: ground, scale: 1 };
    case 'center':
      return { x: width * 0.5, y: ground, scale: 1 };
    case 'right':
      return { x: width * 0.78, y: ground, scale: 1 };
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

export function sayDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.8, 1.0 + words * 0.4);
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

/** Who is carrying `prop` at time t, if anyone. */
function holderAt(shot: Shot, prop: string, t: number): string | undefined {
  let holder: string | undefined;
  for (const a of shot.actions)
    if (a.actor === prop && a.attach !== undefined && a.t <= t) holder = a.attach || undefined;
  return holder;
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
): { point: Point; facing: Facing; turn?: ActorState['turn'] } {
  const holder = resolveActor(project, scene, shot, holderId, t, depth + 1);
  const hand = holdPoint(holder, poseFor(holder, t));
  const rig = RIGS[prop.rig];
  const [gx, gy] = prop.grip ?? [rig.width / 2, rig.height / 2];
  const k = (prop.height / rig.height) * propScale * holder.perspective;
  const side = holder.facing === 'left' ? -1 : 1;
  return {
    point: {
      x: hand.x - k * side * (gx - rig.width / 2),
      y: hand.y + k * (rig.height - gy),
      scale: holder.perspective,
    },
    facing: holder.facing,
    turn: holder.turn,
  };
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
  let facing: Facing = cast.facing;
  let scale = cast.scale;
  let visible = cast.visible;
  let opacity = 1;
  let emotion: Emotion = cast.emotion;
  let face: Record<string, string> = {};
  let sitting = false;
  let seat = 0;
  let sitAt = -Infinity;
  let sitFrom = 0;
  let lying = false;
  let lieAt = -Infinity;
  let lieFrom = 0;
  let turnAt = -Infinity;
  let turnFrom: Facing = facing;
  let holder: string | undefined;
  let takeAt = -Infinity;
  let move: Move | undefined;
  let locoStart = 0;
  let locomotion: Locomotion = 'idle';
  const verbs: ActiveVerb[] = [];
  let bubble: Bubble | undefined;
  let talking = false;
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

  for (const a of actions) {
    if (a.t > t) break;
    // Where is the actor when this action starts?
    if (move) point = movePoint(move, a.t);

    // Let go before `set`, so a `set.at` in the same action puts the prop down there.
    if (a.attach !== undefined) {
      if (a.attach) holder = a.attach;
      else if (holder && depth < MAX_DEPTH) {
        // Let go: it stays where the hand was just before (the arm relaxes after).
        const before = Math.max(0, a.t - 1e-6);
        point = heldPoint(project, scene, shot, character, scale, holder, before, depth).point;
        holder = undefined;
      } else holder = undefined;
      move = undefined;
    }
    if (a.set) {
      if (a.set.at) {
        point = resolvePosition(project, scene, a.set.at);
        move = undefined;
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
      const d = actionDuration(a);
      if (t < a.t + d) {
        bubble = { text: a.say, style: a.bubble ?? 'speech', age: t - a.t, left: a.t + d - t };
        // A thought is not said out loud: the mouth stays still.
        talking = a.bubble !== 'thought';
      }
    }

    if (a.do) {
      const verb = a.do;
      if (isMoveVerb(verb)) {
        const to = a.to ? resolvePosition(project, scene, a.to) : point;
        const d = actionDuration(a, point, to);
        // Sat or lying down, it gets up first (sitting up, then standing) and sets off once
        // it is up; setting off at once would slide it along the floor as it rose.
        const lie = lieAmount(a.t);
        lieTo(false, a.t, Math.max(1e-3, LIE_TIME * lie));
        const risen = lie > 0 ? lieAt + lieTime : a.t;
        sitTo(false, risen);
        const t0 = Math.max(risen, sitAmount(a.t) > 0 ? sitAt + sitTime : a.t);
        move = { verb, from: point, to, t0, t1: t0 + d, rest: locoStart };
        locoStart = t0;
        if (Math.abs(to.x - point.x) > 1) turnTo(to.x > point.x ? 'right' : 'left', a.t);
        if (verb === 'jump' && t >= t0 && t < t0 + d) verbs.push({ verb, u: (t - t0) / d });
      } else if (verb === 'sit' || verb === 'lie') {
        const from = point;
        if (a.to) {
          point = resolvePosition(project, scene, a.to);
          move = undefined;
        }
        if (verb === 'sit') {
          if (!sitting) seat = seatHeight(scene, from, point);
          // Already lying: sit back up.
          const k = share(a, lying ? LIE_TIME : SIT_TIME);
          sitTo(true, a.t, SIT_TIME * k);
          lieTo(false, a.t, LIE_TIME * k);
        } else {
          // Lying is on the surface itself: sit down on it first, then lie back.
          const k = share(a, (sitting ? 0 : SIT_TIME) + LIE_TIME);
          const down = sitting ? 0 : SIT_TIME * k;
          if (!sitting) seat = 0;
          sitTo(true, a.t, SIT_TIME * k);
          lieTo(true, a.t + down, LIE_TIME * k);
        }
      } else if (verb === 'stand') {
        // From lying, sit up first, then get up.
        const k = share(a, (lying ? LIE_TIME : 0) + SIT_TIME);
        sitTo(false, a.t + (lying ? LIE_TIME * k : 0), SIT_TIME * k);
        lieTo(false, a.t, LIE_TIME * k);
      } else if (verb === 'appear' || verb === 'disappear') {
        const d = actionDuration(a);
        const u = clamp01((t - a.t) / d);
        visible = true;
        // The pop itself is a verb (scale with overshoot); the fade is quicker than it.
        opacity = verb === 'appear' ? clamp01(u * 3) : 1 - clamp01((u - 0.35) / 0.65);
        if (u < 1) verbs.push({ verb, u });
        else if (verb === 'disappear') visible = false;
      } else {
        const d = actionDuration(a);
        if (t < a.t + d) verbs.push({ verb, u: (t - a.t) / d });
      }
    }
  }

  let travel: Travel | undefined;
  if (move) {
    point = movePoint(move, t);
    if (t < move.t0) {
      locoStart = move.rest;
    } else if (t < move.t1) {
      if (move.verb === 'walk' || move.verb === 'run') {
        const k = (character.height / RIGS[character.rig].height) * scale;
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

  let turn = t - turnAt < TURN_TIME ? { from: turnFrom, u: (t - turnAt) / TURN_TIME } : undefined;
  const heldBy = holder && depth < MAX_DEPTH ? holder : undefined;
  if (heldBy) {
    const held = heldPoint(project, scene, shot, character, scale, heldBy, t, depth);
    point = held.point;
    facing = held.facing;
    turn = held.turn;
    locomotion = 'idle';
  }
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
    lie: lieAmount(t),
    perspective: point.scale,
    heldBy,
    holding,
    look: 0,
    take: t - takeAt < TAKE_TIME ? { u: (t - takeAt) / TAKE_TIME, emotion } : undefined,
    emotion,
    face,
    verbs,
    bubble,
    talking,
    phase: hash01(id),
  };
  // Looks are worked out for the actors on screen, not for the ones resolved to find them.
  if (depth === 0 && !heldBy) state.look = lookPitch(project, scene, shot, state, t, depth);
  return state;
}

/** Between the eyes, in the scene, ignoring the pose: what others look toward. */
function eyePoint(a: ActorState): { x: number; y: number } {
  const rig = RIGS[a.character.rig];
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

function resolveCamera(project: Project, scene: Scene, shot: Shot, t: number): View {
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

function resolveCaptions(shot: Shot, t: number): CaptionState[] {
  const out: CaptionState[] = [];
  for (const a of shot.actions) {
    if (!a.caption) continue;
    const d = actionDuration(a);
    if (t < a.t || t >= a.t + d) continue;
    const fadeLen = Math.min(0.3, d / 3);
    const inU = clamp01((t - a.t) / (fadeLen * 1.5));
    const outU = clamp01((a.t + d - t) / fadeLen);
    const opacity = Math.min(1, (t - a.t) / fadeLen, outU);
    const slide = 1 - easeOut(inU) + 0.5 * (1 - outU);
    out.push({ text: a.caption, style: a.captionStyle ?? 'narration', opacity, slide });
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
  // Lower on screen = closer to camera = drawn later; a carried prop just after its carrier.
  const depthY = (a: ActorState) => {
    const h = a.heldBy && actors.find((o) => o.id === a.heldBy);
    return h ? h.y + 0.01 : a.y;
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
    captions: resolveCaptions(shot, t),
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

export function rigOf(character: Character) {
  return RIGS[character.rig];
}
