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
  /** A YouTube channel banner (2560 × 1440) instead of a thumbnail: films only. */
  banner?: boolean;
  /** The frame without bubbles or captions (a banner always is). */
  quiet?: boolean;
}

/**
 * YouTube shows a banner whole only on a TV. A computer shows the full-width strip through
 * its middle, a phone only the centre of that strip (1546 × 423 of 2560 × 1440), so the
 * words go there and the picture is left to fill the rest.
 */
export const BANNER = { width: 2560, height: 1440, safeWidth: 1546, safeHeight: 423 };

const INK = '#2e2633';

/**
 * A thumbnail: one frame of a shot with the title set over it. A film's sits on the left
 * third, leaving the action on the right; a reel's is centred near the top, inside the
 * 3:4 crop a profile grid shows. Text is drawn as outlines, so Devanagari is shaped.
 */
export function coverSvg(project: Project, shot: Shot, t: number, o: CoverText): string {
  const { width: W, height: H } = project.meta;
  const tall = H > W;
  if (o.banner && tall) throw new Error('a banner is drawn from a film, not a reel');
  const frame = composeFrame(project, shot, t, { quiet: o.banner || o.quiet });
  const inner = frame.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // Scaling about a point inside the frame by 1 or more never uncovers an edge.
  const z = Math.max(1, o.zoom ?? 1);
  const f = o.focus ?? { x: W / 2, y: H / 2 };
  const push =
    z === 1 ? '' : ` transform='translate(${f.x * (1 - z)} ${f.y * (1 - z)}) scale(${z})'`;

  const fit = (text: string, max: number, want: number) =>
    Math.min(want, (want * max) / shapedWidth(text, want, true));
  // The banner's safe area, in frame units.
  const safeW = (W * BANNER.safeWidth) / BANNER.width;
  const safeH = (H * BANNER.safeHeight) / BANNER.height;
  const tsize = o.banner
    ? fit(o.title, safeW * 0.9, safeH * 0.36)
    : fit(o.title, W * (tall ? 0.86 : 0.6), tall ? 110 : 96);
  const ssize =
    o.sub && fit(o.sub, o.banner ? safeW * 0.8 : W * 0.8, o.banner ? tsize * 0.4 : tall ? 46 : 40);
  const gsize =
    o.tag &&
    fit(o.tag, o.banner ? safeW * 0.8 : W * 0.75, o.banner ? tsize * 0.38 : tall ? 44 : 36);
  const cx = tall || o.banner ? W / 2 : W * 0.34;
  // A banner's block of words is centred in the safe area: the sub's top to the tag's foot.
  const above = ssize ? tsize + ssize * 0.8 : tsize * 0.8;
  const below = gsize ? tsize * 0.55 + gsize * 1.6 : tsize * 0.25;
  const ty = o.banner ? H / 2 + (above - below) / 2 : tall ? 300 : 190;
  let over = '';
  if (o.banner) {
    // A dark band behind the words, fading out above and below into the picture.
    const top = H / 2 - safeH * 0.75;
    over += `<defs><linearGradient id='tk-wash' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1d1424' stop-opacity='0'/><stop offset='.5' stop-color='#1d1424' stop-opacity='.55'/><stop offset='1' stop-color='#1d1424' stop-opacity='0'/></linearGradient></defs>`;
    over += `<rect y='${top}' width='${W}' height='${safeH * 1.5}' fill='url(#tk-wash)'/>`;
  } else {
    // A dark wash behind the words, fading down into the picture.
    over += `<defs><linearGradient id='tk-wash' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1d1424' stop-opacity='.75'/><stop offset='.7' stop-color='#1d1424' stop-opacity='.35'/><stop offset='1' stop-color='#1d1424' stop-opacity='0'/></linearGradient></defs>`;
    over += `<rect width='${W}' height='${tall ? 470 : 260}' fill='url(#tk-wash)'/>`;
  }
  if (o.sub && ssize) {
    over += shapedText(o.sub, {
      x: cx,
      y: ty - tsize,
      fontSize: ssize,
      fill: '#ffe9b0',
      bold: true,
      stroke: { color: INK, width: o.banner ? ssize * 0.2 : 8 },
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
  if (o.tag && gsize) {
    const size = gsize;
    const w = shapedWidth(o.tag, size, true) + size * 1.2;
    const y = ty + tsize * 0.55;
    const tilt = `rotate(-3 ${cx} ${y})`;
    over += `<rect x='${cx - w / 2}' y='${y}' width='${w}' height='${size * 1.5}' rx='${size * 0.4}' fill='#c8342b' stroke='${INK}' stroke-width='5' transform='${tilt}'/>`;
    over += `<g transform='${tilt}'>${shapedText(o.tag, { x: cx, y: y + size * 1.08, fontSize: size, fill: '#fff', bold: true })}</g>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><g${push}>${inner}</g>${over}</svg>`;
}

/** The pixel width a cover is drawn at: 1080 × 1920 for a reel, 1280 × 720 for a film, 2560 × 1440 for a banner. */
export const coverWidth = (project: Project, banner = false) =>
  banner ? BANNER.width : project.meta.height > project.meta.width ? 1080 : 1280;
