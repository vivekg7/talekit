import { composeFrame } from '../engine/compose.js';
import { shapedText, shapedWidth } from '../engine/glyphs.js';
import type { Project, Shot } from '../engine/types.js';

export interface CoverText {
  title: string;
  /** A small line above the title ("पंचतंत्र की कहानी"). */
  sub?: string;
  /** The moral or hook, on a red tag below the title. */
  tag?: string;
  /** Push in on the action: scale by `zoom` about the scene point `focus`. */
  zoom?: number;
  focus?: { x: number; y: number };
}

const INK = '#2e2633';

/**
 * A thumbnail: one frame of a shot with the title set over it. A film's sits on the left
 * third, leaving the action on the right; a reel's is centred near the top, inside the
 * 3:4 crop a profile grid shows. Text is drawn as outlines, so Devanagari is shaped.
 */
export function coverSvg(project: Project, shot: Shot, t: number, o: CoverText): string {
  const { width: W, height: H } = project.meta;
  const tall = H > W;
  const frame = composeFrame(project, shot, t);
  const inner = frame.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // Scaling about a point inside the frame by 1 or more never uncovers an edge.
  const z = Math.max(1, o.zoom ?? 1);
  const f = o.focus ?? { x: W / 2, y: H / 2 };
  const push =
    z === 1 ? '' : ` transform='translate(${f.x * (1 - z)} ${f.y * (1 - z)}) scale(${z})'`;

  const fit = (text: string, max: number, want: number) =>
    Math.min(want, (want * max) / shapedWidth(text, want, true));
  const tsize = fit(o.title, W * (tall ? 0.86 : 0.6), tall ? 110 : 96);
  const cx = tall ? W / 2 : W * 0.34;
  const ty = tall ? 300 : 190;
  let over = '';
  // A dark wash behind the words, fading down into the picture.
  over += `<defs><linearGradient id='tk-wash' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1d1424' stop-opacity='.75'/><stop offset='.7' stop-color='#1d1424' stop-opacity='.35'/><stop offset='1' stop-color='#1d1424' stop-opacity='0'/></linearGradient></defs>`;
  over += `<rect width='${W}' height='${tall ? 470 : 260}' fill='url(#tk-wash)'/>`;
  if (o.sub) {
    const ssize = fit(o.sub, W * 0.8, tall ? 46 : 40);
    over += shapedText(o.sub, {
      x: cx,
      y: ty - tsize,
      fontSize: ssize,
      fill: '#ffe9b0',
      bold: true,
      stroke: { color: INK, width: 8 },
    });
  }
  over += shapedText(o.title, {
    x: cx,
    y: ty,
    fontSize: tsize,
    fill: '#ffd23f',
    bold: true,
    stroke: { color: INK, width: tsize * 0.16 },
  });
  if (o.tag) {
    const size = fit(o.tag, W * 0.75, tall ? 44 : 36);
    const w = shapedWidth(o.tag, size, true) + size * 1.2;
    const y = ty + tsize * 0.55;
    const tilt = `rotate(-3 ${cx} ${y})`;
    over += `<rect x='${cx - w / 2}' y='${y}' width='${w}' height='${size * 1.5}' rx='${size * 0.4}' fill='#c8342b' stroke='${INK}' stroke-width='5' transform='${tilt}'/>`;
    over += `<g transform='${tilt}'>${shapedText(o.tag, { x: cx, y: y + size * 1.08, fontSize: size, fill: '#fff', bold: true })}</g>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><g${push}>${inner}</g>${over}</svg>`;
}

/** The pixel width a cover is drawn at: 1080 × 1920 for a reel, 1280 × 720 for a film. */
export const coverWidth = (project: Project) =>
  project.meta.height > project.meta.width ? 1080 : 1280;
