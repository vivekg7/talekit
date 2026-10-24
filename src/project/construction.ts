import { Resvg } from '@resvg/resvg-js';
import { rigOf, type Rig } from '../engine/rigs.js';
import { applyColors, topLevelPieces } from '../engine/svg.js';

export { topLevelPieces };
import type { Character } from '../engine/types.js';
import type { Problem } from './validate.js';

/**
 * The construction linter: checks a character the way an animation lead would before it
 * goes on a rig. It works on pixels, not on SVG maths: each part (and each top-level shape
 * in it) is rasterised at one pixel per canonical unit, so strokes, caps, arcs and transforms
 * count exactly as drawn.
 */

/** Margin around the canonical box, so overflow is measurable. */
const M = 60;
/** Overlap, in canonical units, below which a joint shows a gap once the part moves. */
export const MIN_OVERLAP = 12;
const FACE = new Set(['eyes', 'mouth', 'face']);

interface Mask {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface Mark {
  x: number;
  y: number;
  w: number;
  h: number;
  n: number;
}

export interface Construction {
  problems: Problem[];
  /** Boxes in canonical coordinates for the numbered warnings that have a place. */
  marks: Mark[];
}

function maskOf(svg: string, rig: Rig): Mask {
  const w = rig.width + 2 * M;
  const h = rig.height + 2 * M;
  const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='${-M} ${-M} ${w} ${h}'>${svg}</svg>`;
  // No text in parts, so skip loading system fonts: that alone costs ~50 ms per render.
  const img = new Resvg(doc, { font: { loadSystemFonts: false } }).render();
  const px = img.pixels;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3] > 110 ? 1 : 0;
  return { w, h, data };
}

const and = (a: Mask, b: Mask): Mask => ({
  ...a,
  data: a.data.map((v, i) => v & b.data[i]),
});

function union(masks: Mask[], like: Mask): Mask {
  const data = new Uint8Array(like.w * like.h);
  for (const m of masks) for (let i = 0; i < data.length; i++) data[i] |= m.data[i];
  return { ...like, data };
}

/** Chamfer (3,4) distance to the nearest empty pixel, in canonical units; max over the mask. */
function maxDepth(m: Mask): number {
  const { w, h, data } = m;
  const d = new Uint16Array(w * h);
  const BIG = 60000;
  for (let i = 0; i < d.length; i++) d[i] = data[i] ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x - 1, y) + 3,
        at(x, y - 1) + 3,
        at(x - 1, y - 1) + 4,
        at(x + 1, y - 1) + 4
      );
    }
  let best = 0;
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x + 1, y) + 3,
        at(x, y + 1) + 3,
        at(x + 1, y + 1) + 4,
        at(x - 1, y + 1) + 4
      );
      if (d[i] > best) best = d[i];
    }
  return best / 3;
}

/** Thickness of the thickest spot of a region: how solid a joint is. */
const thickness = (m: Mask): number => 2 * maxDepth(m);

/** Pixel bounds in canonical coordinates, or undefined for an empty mask. */
function bounds(m: Mask): { x0: number; y0: number; x1: number; y1: number } | undefined {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (m.data[y * m.w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x0 === Infinity) return undefined;
  return { x0: x0 - M, y0: y0 - M, x1: x1 + 1 - M, y1: y1 + 1 - M };
}

/** The mask's bounding box grown by `pad`, as a mask. */
function near(m: Mask, pad: number): Mask {
  const data = new Uint8Array(m.w * m.h);
  const b = bounds(m);
  if (b)
    for (let y = Math.max(0, b.y0 + M - pad); y < Math.min(m.h, b.y1 + M + pad); y++)
      for (let x = Math.max(0, b.x0 + M - pad); x < Math.min(m.w, b.x1 + M + pad); x++)
        data[y * m.w + x] = 1;
  return { ...m, data };
}

const area = (m: Mask): number => m.data.reduce((s, v) => s + v, 0);

function covers(m: Mask, x: number, y: number, r: number): boolean {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.round(x) + dx + M;
      const py = Math.round(y) + dy + M;
      if (px >= 0 && py >= 0 && px < m.w && py < m.h && m.data[py * m.w + px]) return true;
    }
  return false;
}

const firstVariant = (part: Character['parts'][string]): string =>
  typeof part === 'string' ? part : (Object.values(part).find((v) => v.trim()) ?? '');

function short(piece: string): string {
  const s = piece.replace(/\s+/g, ' ');
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

/** Box of a part's first drawable variant in canonical coordinates, for the sheet. */
export function partBox(
  c: Character,
  name: string
): { x: number; y: number; w: number; h: number } | undefined {
  const svg = firstVariant(c.parts[name]);
  const b = svg.trim() ? bounds(maskOf(applyColors(svg, c.colors), rigOf(c))) : undefined;
  return b && { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
}

const cache = new Map<string, Construction>();

/** Construction problems of a character at rest. Errors only for drawing outside the box. */
export function lintCharacter(c: Character): Construction {
  const key = JSON.stringify([c.rig, c.colors, c.parts]);
  const hit = cache.get(key);
  if (hit) return hit;
  const rig = rigOf(c);
  const where = `character '${c.id}'`;
  const problems: Problem[] = [];
  const marks: Mark[] = [];
  const warn = (message: string, box?: ReturnType<typeof bounds>) => {
    let msg = message;
    if (box) {
      const n = marks.length + 1;
      marks.push({ x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0, n });
      msg = `[${n}] ${message}`;
    }
    problems.push({ level: 'warning', where, message: msg });
  };
  const draw = (svg: string) => maskOf(applyColors(svg, c.colors), rig);

  // 1. Everything inside the box, every variant: the box is what the engine scales and
  // places, and bubbles hang from its top edge.
  for (const [name, part] of Object.entries(c.parts)) {
    const variants = typeof part === 'string' ? { '': part } : part;
    for (const [variant, svg] of Object.entries(variants)) {
      if (!svg.trim()) continue;
      const b = bounds(draw(svg));
      if (!b) continue;
      const sides = [
        ['left', -b.x0],
        ['top', -b.y0],
        ['right', b.x1 - rig.width],
        ['bottom', b.y1 - rig.height],
      ].filter(([, over]) => (over as number) > 2) as [string, number][];
      if (sides.length)
        problems.push({
          level: 'error',
          where,
          message: `part '${name}'${variant ? ` variant '${variant}'` : ''} sticks out of the ${rig.width}×${rig.height} box (${sides.map(([s, o]) => `${Math.round(o)} units ${s}`).join(', ')}); everything must fit inside x 0–${rig.width}, y 0–${rig.height}`,
        });
    }
  }

  const parts = new Map<string, Mask>();
  for (const [name, part] of Object.entries(c.parts)) {
    const svg = firstVariant(part);
    if (svg.trim()) parts.set(name, draw(svg));
  }
  const anyMask = [...parts.values()][0];
  if (!anyMask) return { problems, marks };
  const body = [...parts.entries()].filter(([name]) => !FACE.has(name));

  // 2. Standing on the line.
  if (rig.feet.length) {
    for (const leg of rig.feet) {
      const m = parts.get(leg);
      const b = m && bounds(m);
      if (b && rig.height - b.y1 > 4)
        warn(
          `'${leg}' ends at y=${b.y1}, ${rig.height - b.y1} units above the feet line y=${rig.height}: the character will float`,
          b
        );
    }
  } else {
    const b = bounds(
      union(
        body.map(([, m]) => m),
        anyMask
      )
    );
    if (b && rig.height - b.y1 > 4)
      warn(
        `the lowest point is y=${b.y1}, ${rig.height - b.y1} units above the base line y=${rig.height}: it will hover over its anchor (right only for something that flies)`
      );
  }

  // 3. Joints: a limb hangs from its pivot and sinks into what it hangs from, the neck into
  // the head. A thin limb (a mouse leg, a tail) sinks three quarters of its own width.
  for (const { part: limb, into, pivot } of rig.joints) {
    const m = parts.get(limb);
    const parent = parts.get(into);
    if (!m || !parent) continue;
    const [px, py] = rig.parts[limb].pivot;
    if (pivot && !covers(m, px, py, 4))
      warn(
        `'${limb}' does not start at its pivot (${px},${py}); the engine rotates it around that point, so draw it hanging from there`,
        bounds(m)
      );
    const joint = and(m, parent);
    const t = thickness(joint);
    // Judged by the limb's width where it joins: a lion's tail is thin at the rump even
    // though its tuft is fat.
    const at = t > 0 ? and(m, near(joint, 6)) : m;
    const need = Math.min(MIN_OVERLAP, Math.floor(thickness(at) * 0.75));
    if (t < need)
      warn(
        limb === 'head' && into === 'torso'
          ? `the neck reaches only ${Math.round(t)} units into the head; overlap at least ${need} so the head does not look stuck on when it turns`
          : limb === 'head'
            ? `the head overlaps the ${into} by only ${Math.round(t)} units; draw the neck in the head part and sink it at least ${need} into the ${into}`
            : `'${limb}' overlaps the ${into} by only ${Math.round(t)} units; sink it at least ${need} in so no gap opens when it swings`,
        bounds(m)
      );
  }

  // 4. Pieces that only touch the rest: the leg that reads as a separate stick.
  const pieces: { part: string; svg: string; mask: Mask }[] = [];
  for (const [name] of body)
    for (const svg of topLevelPieces(firstVariant(c.parts[name])))
      pieces.push({ part: name, svg, mask: draw(svg) });
  if (pieces.length > 1) {
    pieces.forEach((p, i) => {
      if (area(p.mask) < 30) return;
      const own = thickness(p.mask);
      if (own < 6) return; // line work: whiskers, creases, strings
      const rest = union(
        pieces.filter((_, j) => j !== i).map((q) => q.mask),
        p.mask
      );
      const joint = and(p.mask, rest);
      const overlap = thickness(joint);
      // Judge at the joint, against both sides as they are there: a bow tied on a thin string
      // cannot sink 12 units into it, an antler 8 wide cannot overlap by more than 8.
      const zone = near(joint, 6);
      const need = Math.min(
        MIN_OVERLAP,
        thickness(and(p.mask, zone)) * 0.75,
        thickness(and(rest, zone)) * 0.75
      );
      if (overlap > 0 && overlap >= need) return;
      warn(
        overlap === 0
          ? `in '${p.part}', ${short(p.svg)} does not touch the rest of the character`
          : `in '${p.part}', ${short(p.svg)} overlaps the rest by only ${Math.round(overlap)} units; sink it at least ${Math.round(need)} in so it reads as attached`,
        bounds(p.mask)
      );
    });
  }

  // 5. Detail on a face that turns: the engine slides the eyes, mouth and `face` toward the
  // way the character faces, so a nose or cheeks drawn in the head would stay behind.
  if (rig.turn) {
    const [x0, x1] = [rig.turn.centre - 36, rig.turn.centre + 36];
    const variants = c.parts.head;
    // The back of the head has no face on it.
    const all =
      typeof variants === 'string'
        ? [variants]
        : Object.entries(variants ?? {})
            .filter(([k]) => k !== 'back')
            .map(([, v]) => v);
    // Every variant of the head, each piece once.
    for (const piece of new Set(all.flatMap(topLevelPieces))) {
      const width = /stroke-width='([\d.]+)'/.exec(piece);
      const opacity = /\bopacity='([\d.]+)'/.exec(piece);
      const detail =
        (/stroke='(?!none)/.test(piece) && width && +width[1] < 8) ||
        (opacity && +opacity[1] < 0.95);
      const b = detail ? bounds(draw(piece)) : undefined;
      if (!b) continue;
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      if (cx > x0 && cx < x1 && cy > rig.eye[1] - 30 && cy < rig.parts.head.pivot[1] - 10)
        warn(
          `in 'head', ${short(piece)} is drawn on the face but will not turn with it: move it into the 'face' part, which the engine turns with the eyes and mouth`,
          b
        );
    }
  }

  const result = { problems, marks };
  if (cache.size > 200) cache.clear();
  cache.set(key, result);
  return result;
}
