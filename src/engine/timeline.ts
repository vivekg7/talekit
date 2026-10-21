import { clamp01, easeInOut, easeOut, hash01, lerp, ramp } from './easing.js';
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
  /** 0 standing, 1 sat; in between while sitting down or getting up. */
  sit: number;
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
  camera: Required<Camera>;
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
}

/** Seconds a walk or run takes to get up to speed, and to stop. */
const RAMP = 0.3;
/** Seconds for a facing flip, and for sitting down or getting up. */
const TURN_TIME = 0.2;
const SIT_TIME = 0.4;

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

export function resolveActor(
  project: Project,
  scene: Scene,
  shot: Shot,
  id: string,
  t: number
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
  let sitAt = -Infinity;
  let sitFrom = 0;
  let turnAt = -Infinity;
  let turnFrom: Facing = facing;
  let move: Move | undefined;
  let locoStart = 0;
  let locomotion: Locomotion = 'idle';
  const verbs: ActiveVerb[] = [];
  let bubble: Bubble | undefined;
  let talking = false;
  const sitAmount = (time: number) =>
    lerp(sitFrom, sitting ? 1 : 0, clamp01((time - sitAt) / SIT_TIME));
  const turnTo = (to: Facing, at: number) => {
    if (to === facing) return;
    turnFrom = facing;
    turnAt = at;
    facing = to;
  };
  const sitTo = (down: boolean, at: number) => {
    if (down === sitting) return;
    sitFrom = sitAmount(at);
    sitAt = at;
    sitting = down;
  };

  for (const a of actions) {
    if (a.t > t) break;
    // Where is the actor when this action starts?
    if (move) point = movePoint(move, a.t);

    if (a.set) {
      if (a.set.at) {
        point = resolvePosition(project, scene, a.set.at);
        move = undefined;
      }
      if (a.set.facing) turnTo(a.set.facing, a.t);
      if (a.set.scale) scale = a.set.scale;
      if (a.set.visible !== undefined) visible = a.set.visible;
    }
    if (a.emotion) emotion = a.emotion;
    if (a.face) face = { ...face, ...a.face };

    if (a.say) {
      const d = actionDuration(a);
      if (t < a.t + d) {
        bubble = { text: a.say, style: a.bubble ?? 'speech', age: t - a.t, left: a.t + d - t };
        talking = true;
      }
    }

    if (a.do) {
      const verb = a.do;
      if (isMoveVerb(verb)) {
        const to = a.to ? resolvePosition(project, scene, a.to) : point;
        const d = actionDuration(a, point, to);
        move = { verb, from: point, to, t0: a.t, t1: a.t + d };
        locoStart = a.t;
        if (Math.abs(to.x - point.x) > 1) turnTo(to.x > point.x ? 'right' : 'left', a.t);
        if (verb === 'jump' && t < a.t + d) verbs.push({ verb, u: (t - a.t) / d });
        sitTo(false, a.t);
      } else if (verb === 'sit') {
        if (a.to) {
          point = resolvePosition(project, scene, a.to);
          move = undefined;
        }
        sitTo(true, a.t);
      } else if (verb === 'stand') {
        sitTo(false, a.t);
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
    if (t < move.t1) {
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

  return {
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
    turn: t - turnAt < TURN_TIME ? { from: turnFrom, u: (t - turnAt) / TURN_TIME } : undefined,
    sit: sitAmount(t),
    emotion,
    face,
    verbs,
    bubble,
    talking,
    phase: hash01(id),
  };
}

function resolveCamera(project: Project, shot: Shot, t: number): Required<Camera> {
  const { width, height } = project.meta;
  const base = (c: Partial<Camera>, prev: Required<Camera>): Required<Camera> => ({
    zoom: c.zoom ?? prev.zoom,
    x: c.x ?? prev.x,
    y: c.y ?? prev.y,
  });
  let cam = base(shot.camera, { zoom: 1, x: width / 2, y: height / 2 });
  let tween: { from: Required<Camera>; to: Required<Camera>; t0: number; t1: number } | undefined;
  // Keep the view inside the scene so zooming never shows the black outside the artwork.
  const clampCam = (c: Required<Camera>): Required<Camera> => {
    const zoom = Math.max(1, c.zoom);
    const hw = width / (2 * zoom);
    const hh = height / (2 * zoom);
    return {
      zoom,
      x: Math.min(width - hw, Math.max(hw, c.x)),
      y: Math.min(height - hh, Math.max(hh, c.y)),
    };
  };
  const camAt = (time: number): Required<Camera> => {
    if (!tween) return clampCam(cam);
    const u = easeInOut(clamp01((time - tween.t0) / Math.max(1e-6, tween.t1 - tween.t0)));
    return clampCam({
      zoom: lerp(tween.from.zoom, tween.to.zoom, u),
      x: lerp(tween.from.x, tween.to.x, u),
      y: lerp(tween.from.y, tween.to.y, u),
    });
  };
  for (const a of shot.actions.filter((a) => a.camera).sort((a, b) => a.t - b.t)) {
    if (a.t > t) break;
    const from = camAt(a.t);
    const to = base(a.camera!, from);
    const d = a.duration ?? 1;
    cam = to;
    tween = d > 0 ? { from, to, t0: a.t, t1: a.t + d } : undefined;
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
  // Lower on screen = closer to camera = drawn later.
  actors.sort((a, b) => a.y - b.y);

  let fade = 0;
  if (shot.fadeIn > 0 && t < shot.fadeIn) fade = 1 - t / shot.fadeIn;
  if (shot.fadeOut > 0 && t > shot.duration - shot.fadeOut)
    fade = Math.max(fade, (t - (shot.duration - shot.fadeOut)) / shot.fadeOut);

  return {
    t,
    shot,
    scene,
    actors,
    camera: resolveCamera(project, shot, t),
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
