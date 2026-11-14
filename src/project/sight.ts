/**
 * What shows (docs/PLAN.md, phase 8.3): the checks that need the pixels, so they render
 * masks of the frame with resvg rather than reason about boxes. A speaker's face must not
 * be behind the art drawn in front of the actors, and an actor meant to be out of sight
 * behind it (`hidden`) must be covered whole. Findings like the world model's: errors that
 * block the render until fixed or waived (`allow`).
 */
import { Resvg } from '@resvg/resvg-js';
import { waived } from '../engine/allow.js';
import { maskDocument } from '../engine/compose.js';
import { faceBoxes } from '../engine/place.js';
import { resolveFrame, type FrameState } from '../engine/timeline.js';
import type { Project, Shot } from '../engine/types.js';
import { lineDuration, shorten } from '../engine/voice.js';
import type { Finding, XY } from '../engine/world.js';

/**
 * A speaker's face covered more than this (a share of its box, over the line, each pixel by
 * how opaque the art over it is) is not seen. A peek round a pillar, eyes out, is about 0.4.
 */
const FACE_COVERED = 0.5;
/** Art over a hidden actor this opaque hides it; fainter (shallow water) shows it through. */
const HIDES = 0.7 * 255;
/** Of a hidden actor, this share of what is drawn of it, and this many frame pixels, shows. */
const HIDDEN_SHOWS = 0.03;
const HIDDEN_PX = 60;
/** Frames looked at through a line, as shares of its length. */
const LINE_SAMPLES = [0.2, 0.5, 0.8];
/** Seconds between the frames looked at while someone is hidden. */
const HIDDEN_STEP = 0.25;
/** A face's box is drawn this many pixels across to measure it. */
const FACE_PX = 32;
/** Masks of the whole frame are drawn at this many pixels along its longer side. */
const MASK_PX = 512;

const r = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The alpha of a mask (compose.ts `maskDocument`), one byte a pixel. */
function alpha(doc: string): { a: Uint8Array; w: number; h: number } {
  const img = new Resvg(doc, { font: { loadSystemFonts: false } }).render();
  const px = img.pixels;
  const a = new Uint8Array(img.width * img.height);
  for (let i = 0; i < a.length; i++) a[i] = px[4 * i + 3];
  return { a, w: img.width, h: img.height };
}

function toScene(frame: FrameState, W: number, H: number, x: number, y: number): XY {
  const c = frame.camera;
  return { x: r((x - W / 2) / c.zoom + c.x), y: r((y - H / 2) / c.zoom + c.y) };
}

const hasCover = (frame: FrameState) => !!(frame.scene.foreground || frame.scene.near);

/** Each speaker's face clear of the art in front of the actors, through each of its lines. */
function faceRule(project: Project, shot: Shot): Finding[] {
  const scene = project.scenes[shot.scene];
  if (!scene.foreground && !scene.near) return [];
  const { width: W, height: H } = project.meta;
  const allow = [shot.allow, scene.allow];
  const out: Finding[] = [];
  for (const line of shot.actions) {
    const id = line.actor;
    if (!line.say || !id || !shot.cast[id] || waived(allow, 'sight.face', id)) continue;
    const d = lineDuration(project, shot, line);
    let covered = 0;
    let looked = 0;
    let at: XY | undefined;
    for (const u of LINE_SAMPLES) {
      const t = line.t + u * d;
      if (t >= shot.duration) continue;
      const frame = resolveFrame(project, shot, t);
      const me = frame.actors.find((a) => a.id === id);
      // Meant to be out of sight, or not there: heard, not seen.
      if (!me || !me.visible || me.hidden || !hasCover(frame)) continue;
      const face = faceBoxes(project, frame).find((f) => f.id === id)?.box;
      looked++;
      if (!face || face.x + face.w < 0 || face.x > W || face.y + face.h < 0 || face.y > H) continue;
      const m = alpha(maskDocument(project, frame, {}, FACE_PX / face.w, face));
      let sum = 0;
      for (const v of m.a) sum += v;
      covered += sum / 255 / m.a.length;
      at ??= toScene(frame, W, H, face.x + face.w / 2, face.y + face.h / 2);
    }
    if (!looked || !at) continue;
    const share = covered / looked;
    if (share <= FACE_COVERED) continue;
    const words = shorten(line.say, 41);
    out.push({
      code: 'sight.face',
      shot: shot.id,
      t: [r2(line.t), r2(Math.min(shot.duration, line.t + d))],
      actors: [id],
      at,
      message:
        `'${id}''s face is ${r(share * 100)}% behind the scenery drawn in front of the actors (the scene's foreground or near layer) while it says "${words}": ` +
        `move it out from behind, or take that part of the art out of the way.`,
    });
  }
  return out;
}

/** Whoever is meant to be hidden behind what is in front of it, covered whole while it is. */
function hiddenRule(project: Project, shot: Shot): Finding[] {
  const ever =
    Object.values(shot.cast).some((c) => c.hidden) ||
    shot.actions.some((a) => a.set?.hidden !== undefined);
  if (!ever) return [];
  const scene = project.scenes[shot.scene];
  const { width: W, height: H } = project.meta;
  const allow = [shot.allow, scene.allow];
  const zoom = MASK_PX / Math.max(W, H);
  interface Run {
    t0: number;
    t1: number;
    share: number;
    px: number;
    at: XY;
  }
  const runs = new Map<string, Run[]>();
  for (let i = 0; i * HIDDEN_STEP < shot.duration; i++) {
    const t = r2(i * HIDDEN_STEP);
    const frame = resolveFrame(project, shot, t);
    for (const a of frame.actors) {
      if (!a.hidden || !a.visible || a.opacity <= 0.05 || waived(allow, 'sight.hidden', a.id))
        continue;
      const me = alpha(maskDocument(project, frame, { only: a.id }, zoom));
      let all = 0;
      for (const v of me.a) if (v > 127) all++;
      if (!all) continue; // off the frame
      const cover = alpha(maskDocument(project, frame, { over: a.id }, zoom));
      let shows = 0;
      let sx = 0;
      let sy = 0;
      for (let k = 0; k < me.a.length; k++) {
        if (me.a[k] > 127 && cover.a[k] < HIDES) {
          shows++;
          sx += k % me.w;
          sy += Math.floor(k / me.w);
        }
      }
      const px = shows / zoom / zoom;
      const list = runs.get(a.id) ?? [];
      const last = list[list.length - 1];
      if (shows / all < HIDDEN_SHOWS || px < HIDDEN_PX) continue;
      const share = shows / all;
      const at = toScene(frame, W, H, sx / shows / zoom, sy / shows / zoom);
      if (last && t - last.t1 <= HIDDEN_STEP + 1e-6) {
        last.t1 = t;
        if (share > last.share) Object.assign(last, { share, px, at });
      } else list.push({ t0: t, t1: t, share, px, at });
      runs.set(a.id, list);
    }
  }
  const out: Finding[] = [];
  for (const [id, list] of runs)
    for (const run of list)
      out.push({
        code: 'sight.hidden',
        shot: shot.id,
        t: [run.t0, run.t1],
        actors: [id],
        at: run.at,
        message:
          `'${id}' is meant to be out of sight (\`hidden\`), but ${r(run.share * 100)}% of it shows, about ${r(run.px)} px: ` +
          `move it further behind what hides it, make it smaller, or end the hiding there with set: { hidden: false } if it is meant to be seen.`,
      });
  return out;
}

/** Every sight finding in a shot, waivers applied. */
export function sightFindings(project: Project, shot: Shot): Finding[] {
  return [...faceRule(project, shot), ...hiddenRule(project, shot)];
}
