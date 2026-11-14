/**
 * Where each speech bubble goes (docs/PLAN.md, phase 8.3): off every face in the frame, not
 * only the speaker's. A line's bubble is placed once for the whole line, from frames sampled
 * through it, so it does not hop about as people move; it then follows the head as before.
 */
import { actorHeadTop, poseFor } from './actor.js';
import { bubbleBox, type BubblePlace, type BubbleSpec, type Box } from './bubble.js';
import { uiScale } from './format.js';
import { rigOf } from './rigs.js';
import { resolveFrame, type ActorState, type FrameState } from './timeline.js';
import type { Action, Project, Shot } from './types.js';
import { lineDuration } from './voice.js';

/** Where a bubble goes when nothing is in the way: above the head, centred. */
export const ABOVE: BubblePlace = { side: 'above', shift: 0, lift: 0 };

/**
 * The places tried, in order of preference, each with what it costs to use it over the
 * default (a share of a face covered costs 1): slid a little, then further, then raised,
 * then beside the head.
 */
const PLACES: [BubblePlace, number][] = [
  [ABOVE, 0],
  [{ side: 'above', shift: -0.5, lift: 0 }, 0.03],
  [{ side: 'above', shift: 0.5, lift: 0 }, 0.03],
  [{ side: 'above', shift: -1, lift: 0 }, 0.06],
  [{ side: 'above', shift: 1, lift: 0 }, 0.06],
  [{ side: 'above', shift: 0, lift: 0.6 }, 0.08],
  [{ side: 'above', shift: -1, lift: 0.6 }, 0.1],
  [{ side: 'above', shift: 1, lift: 0.6 }, 0.1],
  [{ side: 'left', shift: 0, lift: 0 }, 0.12],
  [{ side: 'right', shift: 0, lift: 0 }, 0.12],
];

/** Frames looked at through a line, as shares of its length. */
const SAMPLES = [0.1, 0.3, 0.5, 0.7, 0.9];
/** The speaker's own face counts this much more than another's. */
const OWN_FACE = 2;
/** What two bubbles touching costs, on top of how much they overlap (twice a face's share). */
const BUBBLE_TOUCH = 0.25;
/** A face drawn smaller than this on screen (a distant figure, a mouse) is not kept clear. */
const MIN_FACE = 10;

/** Half the head's height, scene pixels: the radius of the face kept clear. */
function headHalf(actor: ActorState): number {
  const rig = rigOf(actor.character);
  const s = (actor.character.height / rig.height) * actor.scale;
  const neck = rig.parts.head?.pivot[1] ?? rig.speaker[1] + 0.4 * rig.height;
  return (Math.min(neck - rig.speaker[1], 0.4 * rig.height) / 2) * s;
}

function worldToScreen(frame: FrameState, W: number, H: number, x: number, y: number) {
  const c = frame.camera;
  return { x: (x - c.x) * c.zoom + W / 2, y: (y - c.y) * c.zoom + H / 2 };
}

/** A bubble's spec for `actor` in this frame, but for its place: what compose draws. */
export function bubbleSpec(
  project: Project,
  frame: FrameState,
  actor: ActorState,
  text: string,
  style: BubbleSpec['style']
): BubbleSpec {
  const { width: W, height: H } = project.meta;
  const head = actorHeadTop(actor, poseFor(actor, frame.t));
  const s = worldToScreen(frame, W, H, head.x, head.y);
  return {
    text,
    style,
    headX: s.x,
    headTop: s.y,
    headR: headHalf(actor) * frame.camera.zoom,
    frameW: W,
    frameH: H,
    font: project.meta.font,
    uiScale: uiScale(project.meta),
  };
}

/**
 * The faces on screen in this frame: whoever has eyes, in sight (not `hidden` behind the
 * art), drawn big enough to matter.
 */
export function faceBoxes(project: Project, frame: FrameState): { id: string; box: Box }[] {
  const { width: W, height: H } = project.meta;
  const out: { id: string; box: Box }[] = [];
  for (const a of frame.actors) {
    if (!a.visible || a.hidden || a.opacity < 0.3 || !a.character.parts.eyes) continue;
    const r = headHalf(a) * frame.camera.zoom;
    if (2 * r < MIN_FACE) continue;
    const head = actorHeadTop(a, poseFor(a, frame.t));
    const s = worldToScreen(frame, W, H, head.x, head.y);
    out.push({ id: a.id, box: { x: s.x - 1.1 * r, y: s.y, w: 2.2 * r, h: 2 * r } });
  }
  return out;
}

/** How much of `b` the box `a` covers, 0 to 1. */
export function covers(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / (b.w * b.h) : 0;
}

const MEMO = new WeakMap<Project, WeakMap<Shot, Map<string, BubblePlace>>>();

/** The line `speaker` starts saying at `start`, and how long its bubble shows. */
function lineAt(project: Project, shot: Shot, speaker: string, start: number) {
  const a = shot.actions.find((x) => x.actor === speaker && x.say && Math.abs(x.t - start) < 1e-6);
  return a ? { a, d: lineDuration(project, shot, a) } : undefined;
}

/** Lines whose bubbles show, as (speaker, start, end): thoughts too, they are bubbles. */
function bubbleLines(project: Project, shot: Shot) {
  return shot.actions
    .filter((a): a is Action & { actor: string; say: string } => !!a.say && !!a.actor)
    .filter((a) => shot.cast[a.actor])
    .map((a) => ({ id: a.actor, t: a.t, end: a.t + lineDuration(project, shot, a), a }));
}

/**
 * Where the bubble of the line `speaker` starts at `start` goes: the place, of those tried,
 * that covers least of the faces on screen (the speaker's own most of all) and of the
 * bubbles placed before it, over the frames of the line.
 */
export function bubblePlace(
  project: Project,
  shot: Shot,
  speaker: string,
  start: number
): BubblePlace {
  let byShot = MEMO.get(project);
  if (!byShot) MEMO.set(project, (byShot = new WeakMap()));
  let byLine = byShot.get(shot);
  if (!byLine) byShot.set(shot, (byLine = new Map()));
  const key = `${speaker}@${Math.round(start * 1000)}`;
  const hit = byLine.get(key);
  if (hit) return hit;
  byLine.set(key, ABOVE);
  const line = lineAt(project, shot, speaker, start);
  if (!line) return ABOVE;
  const style = line.a.bubble ?? 'speech';
  // Bubbles placed before this one: lines started earlier (or at once, by a speaker first in
  // the cast), still showing in a frame looked at.
  const order = Object.keys(shot.cast);
  const before = bubbleLines(project, shot).filter(
    (l) =>
      l.t < start - 1e-6 ||
      (Math.abs(l.t - start) < 1e-6 && order.indexOf(l.id) < order.indexOf(speaker))
  );
  const cost = PLACES.map(([, c]) => c);
  let looked = 0;
  for (const u of SAMPLES) {
    const t = start + u * line.d;
    if (t >= shot.duration) continue;
    const frame = resolveFrame(project, shot, t);
    const me = frame.actors.find((a) => a.id === speaker);
    if (!me || !me.visible) continue;
    looked++;
    const spec = bubbleSpec(project, frame, me, line.a.say!, style);
    const faces = faceBoxes(project, frame);
    const others: Box[] = [];
    for (const l of before) {
      if (t < l.t || t >= l.end) continue;
      const them = frame.actors.find((a) => a.id === l.id);
      if (!them || !them.visible) continue;
      const theirs = bubbleSpec(project, frame, them, l.a.say, l.a.bubble ?? 'speech');
      others.push(bubbleBox({ ...theirs, place: bubblePlace(project, shot, l.id, l.t) }));
    }
    PLACES.forEach(([place], i) => {
      const box = bubbleBox({ ...spec, place });
      let c = 0;
      for (const f of faces) c += covers(box, f.box) * (f.id === speaker ? OWN_FACE : 1);
      // Two bubbles touching at all read as one tangle: any overlap costs more than moving.
      for (const o of others) {
        const both = Math.max(covers(box, o), covers(o, box));
        if (both > 0) c += BUBBLE_TOUCH + 2 * both;
      }
      cost[i] += c / SAMPLES.length;
    });
  }
  let best = 0;
  if (looked) cost.forEach((c, i) => c < cost[best] - 1e-9 && (best = i));
  const out = PLACES[best][0];
  byLine.set(key, out);
  return out;
}
