import { actorHeadTop, poseFor, renderActor } from './actor.js';
import { applySprings } from './springs.js';
import { bubbleSvg, wrapText, textWidth } from './bubble.js';
import { escapeXml, n } from './svg.js';
import { resolveFrame, type FrameState } from './timeline.js';
import type { Project, Shot } from './types.js';

export interface ComposeOptions {
  /** Draw anchor markers and actor feet points. */
  debug?: boolean;
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
  return composeFrameState(project, frame, opts);
}

export function composeFrameState(
  project: Project,
  frame: FrameState,
  opts: ComposeOptions = {}
): string {
  const { width: W, height: H, font } = project.meta;
  const k = H / 720; // UI scale so text is the same relative size at any resolution
  const c = frame.camera;
  const camTf = `translate(${W / 2} ${H / 2}) scale(${n(c.zoom)}) translate(${n(-c.x)} ${n(-c.y)})`;

  let world = `<g class='scene'>${frame.scene.svg}</g>`;
  const bubbles: string[] = [];
  for (const actor of frame.actors) {
    const pose = poseFor(actor, frame.t);
    applySprings(project, frame.shot, actor, pose, frame.t);
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
  if (frame.scene.foreground) world += `<g class='foreground'>${frame.scene.foreground}</g>`;
  if (opts.debug) {
    for (const [name, a] of Object.entries(frame.scene.anchors)) {
      world += `<g><circle cx='${a.x}' cy='${a.y}' r='6' fill='#0af' stroke='#fff' stroke-width='2'/><text x='${a.x + 10}' y='${a.y - 8}' font-size='18' fill='#0af' font-family='sans-serif' stroke='#000' stroke-width='3' paint-order='stroke'>${escapeXml(name)}</text></g>`;
    }
  }

  const captions = frame.captions
    .map((cp) => captionSvg(cp.text, cp.style, cp.opacity, cp.slide, W, H, font, k))
    .join('');
  const fade =
    frame.fade > 0
      ? `<rect width='${W}' height='${H}' fill='#000' opacity='${n(frame.fade)}'/>`
      : '';

  return (
    `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<rect width='${W}' height='${H}' fill='#000'/>` +
    `<g class='camera' transform='${camTf}'>${world}</g>` +
    bubbles.join('') +
    captions +
    fade +
    `</svg>`
  );
}
