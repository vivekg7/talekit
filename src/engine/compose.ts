import { actorHeadTop, poseFor, renderActor, renderShadow, SHADOW_DEFS } from './actor.js';
import { applySprings } from './springs.js';
import { bubbleSvg, wrapText, textWidth } from './bubble.js';
import { clamp01, easeInOut } from './easing.js';
import { escapeXml, n } from './svg.js';
import { resolveFrame, type FrameState } from './timeline.js';
import type { Camera, Project, Shot } from './types.js';

export interface ComposeOptions {
  /** Draw anchor markers and actor feet points. */
  debug?: boolean;
}

/** How fast the far and near layers move with the camera, the stage being 1. */
export const PARALLAX = { far: 0.5, near: 1.4 };
/** Past this zoom the frame's edges darken, more as it closes in, to hold the eye. */
const VIGNETTE_FROM = 1.3;
const VIGNETTE_FULL = 1.9;

const FRAME_DEFS =
  SHADOW_DEFS +
  "<radialGradient id='tk-vignette' cx='0.5' cy='0.5' r='0.72'>" +
  "<stop offset='0.55' stop-color='#000' stop-opacity='0'/>" +
  "<stop offset='1' stop-color='#000' stop-opacity='0.5'/></radialGradient>";

/**
 * The camera as seen from a layer at depth factor `p`: the stage is 1 and moves with the
 * camera exactly, 0 does not move at all. Zoom scales geometrically (zoom^p), so a far
 * layer behind a clamped stage view always covers the frame too.
 */
export function layerTransform(c: Required<Camera>, W: number, H: number, p: number): string {
  const zoom = Math.pow(c.zoom, p);
  const x = W / 2 + p * (c.x - W / 2);
  const y = H / 2 + p * (c.y - H / 2);
  return `translate(${W / 2} ${H / 2}) scale(${n(zoom)}) translate(${n(-x)} ${n(-y)})`;
}

function worldToScreen(frame: FrameState, W: number, H: number, x: number, y: number) {
  const c = frame.camera;
  return { x: (x - c.x) * c.zoom + W / 2, y: (y - c.y) * c.zoom + H / 2 };
}

function captionSvg(
  text: string,
  style: 'title' | 'narration',
  opacity: number,
  slide: number,
  W: number,
  H: number,
  font: string,
  k: number
): string {
  const fontSize = (style === 'title' ? 54 : 28) * k;
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(text, W * 0.8, fontSize);
  const blockH = lines.length * lineHeight;
  const cy = style === 'title' ? H / 2 : H - 28 * k - blockH / 2;
  const w = Math.max(...lines.map((l) => textWidth(l, fontSize))) + 40 * k;
  const bg =
    style === 'narration'
      ? `<rect x='${n(W / 2 - w / 2)}' y='${n(cy - blockH / 2 - 10 * k)}' width='${n(w)}' height='${n(blockH + 20 * k)}' rx='${12 * k}' fill='#000' fill-opacity='0.55'/>`
      : '';
  const fill = '#fff';
  const stroke =
    style === 'title'
      ? ` stroke='#222' stroke-width='${n(fontSize * 0.08)}' paint-order='stroke'`
      : '';
  const texts = lines
    .map(
      (l, i) =>
        `<text x='${W / 2}' y='${n(cy - blockH / 2 + lineHeight * (i + 0.8))}' text-anchor='middle' font-family="${escapeXml(font)}" font-size='${fontSize}' font-weight='bold' fill='${fill}'${stroke}>${escapeXml(l)}</text>`
    )
    .join('');
  // Narration rises into place from just below; a title drifts up less.
  const dy = slide * (style === 'title' ? 10 : 18) * k;
  const tf = dy ? ` transform='translate(0 ${n(dy)})'` : '';
  return `<g opacity='${n(opacity)}'${tf}>${bg}${texts}</g>`;
}

/** Compose one frame of a shot as a complete SVG document. */
export function composeFrame(
  project: Project,
  shot: Shot,
  t: number,
  opts: ComposeOptions = {}
): string {
  const frame = resolveFrame(project, shot, t);
  const dissolve = Math.min(shot.crossfade, shot.duration);
  const prev = t < dissolve ? previousShot(project, shot) : undefined;
  if (!prev) return composeFrameState(project, frame, opts);
  // A dissolve: the previous shot carries on past its end underneath while this one fades up.
  const under = frameBody(project, resolveFrame(project, prev, prev.duration + t), opts);
  const u = easeInOut(t / dissolve);
  return frameDocument(
    project,
    under + `<g opacity='${n(u)}'>${frameBody(project, frame, opts)}</g>`
  );
}

function previousShot(project: Project, shot: Shot): Shot | undefined {
  const i = project.shots.findIndex((s) => s.id === shot.id);
  return i > 0 ? project.shots[i - 1] : undefined;
}

export function composeFrameState(
  project: Project,
  frame: FrameState,
  opts: ComposeOptions = {}
): string {
  return frameDocument(project, frameBody(project, frame, opts));
}

function frameDocument(project: Project, body: string): string {
  const { width: W, height: H } = project.meta;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<defs>${FRAME_DEFS}</defs>` +
    body +
    `</svg>`
  );
}

/** Everything in one frame, back to front, without the document around it. */
function frameBody(project: Project, frame: FrameState, opts: ComposeOptions): string {
  const { width: W, height: H, font } = project.meta;
  const k = H / 720; // UI scale so text is the same relative size at any resolution
  const c = frame.camera;
  const scene = frame.scene;
  const layer = (cls: string, svg: string, p: number) =>
    `<g class='${cls}' transform='${layerTransform(c, W, H, p)}'>${svg}</g>`;

  // Poses first: the shadows all go down before any actor, so one never lies across another.
  const posed = frame.actors.map((actor) => {
    const pose = poseFor(actor, frame.t);
    applySprings(project, frame.shot, actor, pose, frame.t);
    return { actor, pose };
  });
  let world = `<g class='scene'>${scene.svg}</g>`;
  world += posed.map(({ actor, pose }) => renderShadow(actor, pose)).join('');
  const bubbles: string[] = [];
  for (const { actor, pose } of posed) {
    world += renderActor(actor, frame.t, pose);
    if (actor.bubble && actor.visible) {
      const head = actorHeadTop(actor, pose);
      const s = worldToScreen(frame, W, H, head.x, head.y);
      bubbles.push(
        bubbleSvg({
          text: actor.bubble.text,
          style: actor.bubble.style,
          headX: s.x,
          headTop: s.y,
          frameW: W,
          frameH: H,
          font,
          uiScale: k,
          age: actor.bubble.age,
          left: actor.bubble.left,
        })
      );
    }
    if (opts.debug) {
      world += `<circle cx='${n(actor.x)}' cy='${n(actor.y)}' r='5' fill='#f0f'/>`;
    }
  }
  if (scene.foreground) world += `<g class='foreground'>${scene.foreground}</g>`;
  if (opts.debug) {
    for (const [name, a] of Object.entries(scene.anchors)) {
      world += `<g><circle cx='${a.x}' cy='${a.y}' r='6' fill='#0af' stroke='#fff' stroke-width='2'/><text x='${a.x + 10}' y='${a.y - 8}' font-size='18' fill='#0af' font-family='sans-serif' stroke='#000' stroke-width='3' paint-order='stroke'>${escapeXml(name)}</text></g>`;
    }
  }

  const vignette = clamp01((c.zoom - VIGNETTE_FROM) / (VIGNETTE_FULL - VIGNETTE_FROM));
  const captions = frame.captions
    .map((cp) => captionSvg(cp.text, cp.style, cp.opacity, cp.slide, W, H, font, k))
    .join('');
  const fade =
    frame.fade > 0
      ? `<rect width='${W}' height='${H}' fill='#000' opacity='${n(frame.fade)}'/>`
      : '';

  return (
    `<rect width='${W}' height='${H}' fill='#000'/>` +
    (scene.far ? layer('far', scene.far, scene.parallax?.far ?? PARALLAX.far) : '') +
    layer('camera', world, 1) +
    (scene.near ? layer('near', scene.near, scene.parallax?.near ?? PARALLAX.near) : '') +
    (vignette > 0
      ? `<rect width='${W}' height='${H}' fill='url(#tk-vignette)' opacity='${n(vignette)}'/>`
      : '') +
    bubbles.join('') +
    captions +
    fade
  );
}
