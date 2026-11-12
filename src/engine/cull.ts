import { topLevelPieces } from './svg.js';

/**
 * Dropping what a layer draws far outside the frame.
 *
 * resvg 2.6 gives every group that needs its own canvas (an `opacity`, a filter, a mask, a
 * clip; a lone shape with an `opacity` too) a layer cut to four times the frame, and panics
 * when that layer lies wholly outside those bounds: it aborts the whole render, with no
 * error to catch. The bounds are two frames either way of the corner of the canvas the
 * layer is drawn on. For the outermost that is the frame's corner, and a close camera puts
 * the far side of the scene outside (past about zoom 3 on the stage, and much sooner on a
 * `near` layer, which zooms faster), and so does an actor parked well off-screen. For a
 * layer inside another it is the outer one's corner, wherever that lies: a blurred crown
 * wider than the frame starts a frame or two left of it at a close camera, and a
 * see-through leaf of it a frame right of the frame is past its bounds (from zoom 1.4 on a
 * far layer drawn that way).
 *
 * So the whole frame is culled before it is drawn, in three steps. A shape whose box, mapped
 * to the frame, lies wholly more than one frame away is left out: nothing that far can show.
 * A lone shape's `opacity` goes into its paint where that draws the same, so it needs no
 * canvas of its own and has no bounds to keep to. And whatever canvas still lies wholly
 * outside the bounds of the one it is drawn on, worked out as resvg does, is left out; that
 * can only be something resvg would have cut off anyway.
 *
 * Boxes are conservative (curve control points, arc diameters, the stroke), and a shape that
 * cannot be measured is kept. So is anything another element points at by its `id` (a
 * `<use>`), and everything inside definitions. A group with an id nothing points at, such as
 * the swaying groups of a scene, is looked into like any other.
 */

/** An affine map, as SVG's matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f. */
export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

function mul(m: Affine, t: Affine): Affine {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5],
  ];
}

/** A `transform` attribute as one matrix, or undefined if any of it cannot be read. */
export function parseTransform(s: string): Affine | undefined {
  let m = IDENTITY;
  let rest = s;
  for (const [all, fn, args] of s.matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  )) {
    rest = rest.replace(all, '');
    const v = args
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (v.some((x) => !Number.isFinite(x))) return undefined;
    let t: Affine;
    if (fn === 'matrix' && v.length === 6) t = v as Affine;
    else if (fn === 'translate' && v.length >= 1) t = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (fn === 'scale' && v.length >= 1) t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (fn === 'rotate' && v.length >= 1) {
      const a = (v[0] * Math.PI) / 180;
      const [cos, sin] = [Math.cos(a), Math.sin(a)];
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0];
      t = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
    } else if (fn === 'skewX' && v.length === 1)
      t = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
    else if (fn === 'skewY' && v.length === 1)
      t = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
    else return undefined;
    m = mul(m, t);
  }
  return /[^\s,]/.test(rest) ? undefined : m;
}

type Box = [number, number, number, number]; // x0, y0, x1, y1

/** A tag's attributes. Names may hold digits: a line's `x1`, `y2`. */
function attrsOf(tag: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const [, k, , v] of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(['"])(.*?)\2/g)) a[k] = v;
  return a;
}

/** The box round a path's points, control points and arcs included, or undefined. */
function pathBox(d: string): Box | undefined {
  const re = /[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
  const fl = /[\s,]*([01])/y;
  let i = 0;
  const num = () => {
    re.lastIndex = i;
    const m = re.exec(d);
    if (!m) return NaN;
    i = re.lastIndex;
    return Number(m[1]);
  };
  const flag = () => {
    fl.lastIndex = i;
    const m = fl.exec(d);
    if (!m) return NaN;
    i = fl.lastIndex;
    return Number(m[1]);
  };
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => (xs.push(x), ys.push(y));
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = '';
  for (;;) {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    else if (!cmd || /[zZ]/.test(cmd)) return undefined;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'Z':
        [x, y] = [sx, sy];
        continue;
      case 'M':
      case 'L':
      case 'T': {
        [x, y] = [ox + num(), oy + num()];
        if (/[mM]/.test(cmd)) {
          [sx, sy] = [x, y];
          cmd = rel ? 'l' : 'L'; // pairs after a move are lines
        }
        break;
      }
      case 'H':
        x = ox + num();
        break;
      case 'V':
        y = oy + num();
        break;
      case 'C':
        add(ox + num(), oy + num());
        add(ox + num(), oy + num());
        [x, y] = [ox + num(), oy + num()];
        break;
      case 'S':
      case 'Q':
        add(ox + num(), oy + num());
        [x, y] = [ox + num(), oy + num()];
        break;
      case 'A': {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        if (!Number.isFinite(rx + ry + num() + flag() + flag())) return undefined;
        const [x0, y0] = [x, y];
        [x, y] = [ox + num(), oy + num()];
        // Every point of the arc lies within its ellipse's diameter of the end.
        const r = 2 * Math.max(rx, ry, Math.hypot(x - x0, y - y0) / 2);
        add(x - r, y - r);
        add(x + r, y + r);
        break;
      }
      default:
        return undefined;
    }
    // A number that would not read leaves the cursor where it was: stop rather than loop.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    add(x, y);
  }
  if (!xs.length || xs.some((v) => !Number.isFinite(v)) || ys.some((v) => !Number.isFinite(v)))
    return undefined;
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** A drawn shape's box in its own coordinates, stroke included unless not `stroked`. */
function shapeBox(tag: string, a: Record<string, string>, stroked = true): Box | undefined {
  const v = (k: string) => Number(a[k] ?? 0);
  let b: Box | undefined;
  if (tag === 'circle')
    b = [v('cx') - v('r'), v('cy') - v('r'), v('cx') + v('r'), v('cy') + v('r')];
  else if (tag === 'ellipse')
    b = [v('cx') - v('rx'), v('cy') - v('ry'), v('cx') + v('rx'), v('cy') + v('ry')];
  else if (tag === 'rect') b = [v('x'), v('y'), v('x') + v('width'), v('y') + v('height')];
  else if (tag === 'line')
    b = [
      Math.min(v('x1'), v('x2')),
      Math.min(v('y1'), v('y2')),
      Math.max(v('x1'), v('x2')),
      Math.max(v('y1'), v('y2')),
    ];
  else if (tag === 'polyline' || tag === 'polygon') {
    const p = (a.points ?? '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const xs = p.filter((_, i) => i % 2 === 0);
    const ys = p.filter((_, i) => i % 2 === 1);
    if (xs.length) b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } else if (tag === 'path') b = pathBox(a.d ?? '');
  if (!b || b.some((x) => !Number.isFinite(x))) return undefined;
  if (!stroked) return b;
  const s = a.stroke && a.stroke !== 'none' ? Number(a['stroke-width'] ?? 1) / 2 : 0;
  if (!Number.isFinite(s)) return undefined;
  return [b[0] - s, b[1] - s, b[2] + s, b[3] + s];
}

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);

/** The box round a box's corners mapped by `t`. */
function mapBox(b: Box, t: Affine): Box {
  const xs = [b[0] * t[0] + b[1] * t[2], b[2] * t[0] + b[1] * t[2]];
  xs.push(b[0] * t[0] + b[3] * t[2], b[2] * t[0] + b[3] * t[2]);
  const ys = [b[0] * t[1] + b[1] * t[3], b[2] * t[1] + b[1] * t[3]];
  ys.push(b[0] * t[1] + b[3] * t[3], b[2] * t[1] + b[3] * t[3]);
  return [
    Math.min(...xs) + t[4],
    Math.min(...ys) + t[5],
    Math.max(...xs) + t[4],
    Math.max(...ys) + t[5],
  ];
}

function union(a: Box | undefined, b: Box | undefined): Box | undefined {
  if (!a || !b) return a ?? b;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/** A shape's two boxes in its own coordinates: as drawn (stroke too) and as an object (fill). */
interface Boxes {
  layer: Box;
  object: Box;
}

/** Leaves repeat frame after frame (the scene's every shape), so their boxes are kept. */
const boxes = new Map<string, Boxes | null>();

/** One element of a fragment as the culler sees it. */
interface Piece {
  raw: string;
  /** Not looked into: drawn as written, never measured (definitions, text, a referenced id). */
  opaque?: boolean;
  open?: string;
  a?: Record<string, string>;
  own?: Affine;
  /** A group's children. */
  kids?: Piece[];
  /** A shape's boxes, null when it cannot be measured. */
  shape?: Boxes | null;
  /** Its boxes inside its own transform, as resvg measures them; set by `measure`. */
  inner?: Partial<Boxes>;
}

/** The region a `<filter>` gives what it filters: `x y width height` and its units. */
interface Region {
  user: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The filters a fragment defines, by id. */
function filterRegions(svg: string, W: number, H: number): Map<string, Region> {
  const out = new Map<string, Region>();
  for (const [tag] of svg.matchAll(/<filter\b[^>]*>/g)) {
    const a = attrsOf(tag);
    if (!a.id) continue;
    const user = a.filterUnits === 'userSpaceOnUse';
    // A fraction of the box it filters; in user units, a percentage is of the frame.
    const v = (k: string, d: number, of: number) => {
      const s = a[k];
      if (s === undefined) return d * (user ? of : 1);
      const x = s.endsWith('%') ? (Number(s.slice(0, -1)) / 100) * (user ? of : 1) : Number(s);
      return Number.isFinite(x) ? x : d * (user ? of : 1);
    };
    out.set(a.id, {
      user,
      x: v('x', -0.1, W),
      y: v('y', -0.1, H),
      w: v('width', 1.2, W),
      h: v('height', 1.2, H),
    });
  }
  return out;
}

const filterId = (a: Record<string, string>) => a.filter?.match(/url\(\s*#([^)\s]+)\s*\)/)?.[1];

/** Whether resvg gives an element a canvas of its own. */
function layered(a: Record<string, string>): boolean {
  const op = a.opacity === undefined ? 1 : Number(a.opacity);
  const on = (k: string) => a[k] !== undefined && a[k] !== 'none';
  return (
    !(op >= 1) ||
    on('filter') ||
    on('mask') ||
    on('clip-path') ||
    on('mix-blend-mode') ||
    a.isolation === 'isolate' ||
    /(^|;)\s*(opacity|mix-blend-mode|isolation|filter|mask|clip-path)\s*:/.test(a.style ?? '')
  );
}

/** The ids something in `svg` points at (`href='#x'`, `url(#x)`): those are drawn whole. */
const referenced = (svg: string) =>
  new Set([...svg.matchAll(/#([A-Za-z_][\w.:-]*)\s*['")]/g)].map((m) => m[1]));

function parse(frag: string, refs: Set<string>): Piece[] {
  const out: Piece[] = [];
  for (const raw of topLevelPieces(frag)) {
    const open = raw.match(/^<([a-zA-Z]+)\b[^>]*?>/);
    const tag = open?.[1] ?? '';
    if (tag !== 'g' && !SHAPES.has(tag)) {
      out.push({ raw, opaque: true });
      continue;
    }
    const a = attrsOf(open![0]);
    const own = a.transform ? parseTransform(a.transform) : IDENTITY;
    if (!own || (a.id !== undefined && refs.has(a.id))) {
      out.push({ raw, opaque: true });
      continue;
    }
    if (tag === 'g') {
      if (raw.endsWith('/>')) continue;
      const kids = parse(raw.slice(open![0].length, -'</g>'.length), refs);
      out.push({ raw, open: open![0], a, own, kids });
      continue;
    }
    const key = open![0];
    let b = boxes.get(key);
    if (b === undefined) {
      if (boxes.size > 50000) boxes.clear();
      const layer = shapeBox(tag, a);
      const object = shapeBox(tag, a, false);
      b = layer && object ? { layer, object } : null;
      boxes.set(key, b);
    }
    out.push({ raw, open: open![0], a, own, shape: b });
  }
  return out;
}

const emit = (ps: Piece[]): string =>
  ps.map((p) => (p.kids ? p.open + emit(p.kids) + '</g>' : p.raw)).join('');

/** Paint the shapes of a fragment inherit from their groups, as far as attributes say. */
interface Paint {
  fill?: string;
  stroke?: string;
  'fill-opacity'?: string;
  'stroke-opacity'?: string;
  styled?: boolean;
}

/**
 * A lone shape's `opacity` moved into its paint, where that draws the same: a shape with a
 * fill and no stroke, or a stroke and no fill, is as see-through either way, and without the
 * `opacity` resvg draws it straight on its group's canvas instead of on one of its own.
 */
function foldOpacity(ps: Piece[], paint: Paint): void {
  for (const p of ps) {
    if (p.opaque || !p.a) continue;
    const a = p.a;
    if (p.kids) {
      const inner: Paint = { ...paint, styled: paint.styled || a.style !== undefined };
      for (const k of ['fill', 'stroke', 'fill-opacity', 'stroke-opacity'] as const)
        if (a[k] !== undefined) inner[k] = a[k];
      foldOpacity(p.kids, inner);
      continue;
    }
    if (a.opacity === undefined || paint.styled || a.style !== undefined) continue;
    if (!p.raw.endsWith('/>') || a.filter || a.mask || a['clip-path'] || a['mix-blend-mode'])
      continue;
    const alpha = Number(a.opacity);
    if (!Number.isFinite(alpha)) continue;
    const fill = (a.fill ?? paint.fill ?? '#000') !== 'none';
    const stroke = (a.stroke ?? paint.stroke ?? 'none') !== 'none';
    if (fill && stroke) continue;
    const key = fill ? 'fill-opacity' : 'stroke-opacity';
    const was = Number(a[key] ?? paint[key] ?? 1);
    if (!Number.isFinite(was)) continue;
    const v = Math.round(Math.max(0, Math.min(1, alpha)) * Math.max(0, Math.min(1, was)) * 1e4);
    let tag = p.raw
      .replace(/\sopacity\s*=\s*(['"])[^'"]*\1/, '')
      .replace(new RegExp(`\\s${key}\\s*=\\s*(['"])[^'"]*\\1`), '');
    if (fill || stroke) tag = tag.replace(/\s*\/>$/, ` ${key}='${v / 1e4}'/>`);
    p.raw = tag;
    const rest = { ...a };
    delete rest.opacity;
    p.a = rest;
  }
}

/** Each piece's boxes inside its own transform, as resvg works them out; the outer ones back. */
function measure(ps: Piece[], filters: Map<string, Region>): Partial<Boxes> {
  let layer: Box | undefined;
  let object: Box | undefined;
  for (const p of ps) {
    if (p.opaque) continue;
    let inner: Partial<Boxes> = p.kids ? measure(p.kids, filters) : (p.shape ?? {});
    const id = filterId(p.a!);
    // A filtered canvas is its filter region: by default a tenth of the box round its object
    // (the fill, no stroke) further each way.
    if (id) {
      const f = filters.get(id) ?? { user: false, x: -0.1, y: -0.1, w: 1.2, h: 1.2 };
      const o = inner.object;
      if (f.user) inner = { ...inner, layer: [f.x, f.y, f.x + f.w, f.y + f.h] };
      else if (o) {
        const [w, h] = [o[2] - o[0], o[3] - o[1]];
        const x = o[0] + f.x * w;
        const y = o[1] + f.y * h;
        inner = { ...inner, layer: [x, y, x + f.w * w, y + f.h * h] };
      } else inner = {}; // resvg does not draw it
    }
    p.inner = inner;
    if (inner.layer) layer = union(layer, mapBox(inner.layer, p.own!));
    if (inner.object) object = union(object, mapBox(inner.object, p.own!));
  }
  return { layer, object };
}

/**
 * The pieces whose canvas would lie wholly outside the bounds resvg cuts it to, left out.
 *
 * resvg cuts each canvas (see the top of this file) to two frames either way of the corner
 * of the canvas it is drawn on: the frame's for the outermost, but for one inside another
 * that one's top-left corner, wherever it lies (no further than its own bounds). A blurred
 * crown at a close camera has its filter region start a frame or two left of the frame, so a
 * see-through group of it a frame right of the frame is outside its bounds, though not the
 * frame's; that panics as surely. `win` is the bounds of the canvas `ps` is drawn on, in the
 * frame's coordinates, and `t` maps `ps`'s coordinates to the frame's.
 */
function fitCanvases(
  ps: Piece[],
  t: Affine,
  win: Box,
  W: number,
  H: number,
  dropped: { any: boolean }
): Piece[] {
  // A few pixels in from the bounds, for the pixel rounding resvg does and this does not.
  const M = 16;
  const kept: Piece[] = [];
  for (const p of ps) {
    if (p.opaque) {
      kept.push(p);
      continue;
    }
    const tt = mul(t, p.own!);
    let w = win;
    if (layered(p.a!) && p.inner?.layer) {
      const b = mapBox(p.inner.layer, tt);
      if (b[2] <= win[0] + M || b[0] >= win[2] - M || b[3] <= win[1] + M || b[1] >= win[3] - M) {
        dropped.any = true;
        continue;
      }
      const [x, y] = [Math.max(b[0], win[0]), Math.max(b[1], win[1])];
      w = [x - 2 * W, y - 2 * H, x + 2 * W, y + 2 * H];
    }
    if (p.kids) {
      p.kids = fitCanvases(p.kids, tt, w, W, H, dropped);
      if (!p.kids.length) {
        dropped.any = true;
        continue;
      }
    }
    kept.push(p);
  }
  return kept;
}

/**
 * `svg` drawn so that resvg can draw it: the shapes that `m` (its coordinates to the frame's)
 * puts wholly more than one frame outside the W×H frame left out, a lone shape's `opacity`
 * moved into its paint where that draws the same, and then whatever would still get a canvas
 * wholly outside the bounds resvg cuts it to left out too (see `fitCanvases`). `defs` holds
 * filters defined outside `svg` that it uses.
 */
export function cullOffFrame(svg: string, m: Affine, W: number, H: number, defs = ''): string {
  const out = (b: Box, t: Affine) => {
    const [x0, y0, x1, y1] = mapBox(b, t);
    return x1 < -W || x0 > 2 * W || y1 < -H || y0 > 2 * H;
  };
  const offFrame = (ps: Piece[], t: Affine): Piece[] => {
    const kept: Piece[] = [];
    for (const p of ps) {
      if (p.opaque) {
        kept.push(p);
        continue;
      }
      const tt = p.own === IDENTITY ? t : mul(t, p.own!);
      if (p.kids) {
        p.kids = offFrame(p.kids, tt);
        if (p.kids.length) kept.push(p);
      } else if (!p.shape || !out(p.shape.layer, tt)) kept.push(p);
    }
    return kept;
  };
  let ps = offFrame(parse(svg, referenced(svg)), m);
  if (!/<style[\s>]/.test(svg)) foldOpacity(ps, {});
  const filters = filterRegions(defs + svg, W, H);
  // Leaving a canvas out shrinks the ones around it, which moves the bounds of the others
  // drawn on them; so again, until nothing more goes (once, nearly always).
  for (let i = 0; i < 8; i++) {
    measure(ps, filters);
    const dropped = { any: false };
    ps = fitCanvases(ps, m, [-2 * W, -2 * H, 2 * W, 2 * H], W, H, dropped);
    if (!dropped.any) break;
  }
  return emit(ps);
}

/**
 * The box round everything drawn in a fragment, through the transforms of its groups and
 * shapes, [x0, y0, x1, y1]; undefined when nothing in it can be measured.
 */
export function fragmentBox(svg: string): [number, number, number, number] | undefined {
  let box: Box | undefined;
  const add = (b: Box, t: Affine) => {
    for (const [x, y] of [
      [b[0], b[1]],
      [b[2], b[1]],
      [b[0], b[3]],
      [b[2], b[3]],
    ]) {
      const X = t[0] * x + t[2] * y + t[4];
      const Y = t[1] * x + t[3] * y + t[5];
      box = box
        ? [Math.min(box[0], X), Math.min(box[1], Y), Math.max(box[2], X), Math.max(box[3], Y)]
        : [X, Y, X, Y];
    }
  };
  const walk = (frag: string, t: Affine) => {
    for (const piece of topLevelPieces(frag)) {
      const open = piece.match(/^<([a-zA-Z]+)\b[^>]*?>/);
      const tag = open?.[1] ?? '';
      if (tag !== 'g' && !SHAPES.has(tag)) continue;
      const a = attrsOf(open![0]);
      const own = a.transform ? parseTransform(a.transform) : IDENTITY;
      if (!own) continue;
      const tt = own === IDENTITY ? t : mul(t, own);
      if (tag === 'g') {
        if (!piece.endsWith('/>')) walk(piece.slice(open![0].length, -'</g>'.length), tt);
        continue;
      }
      const b = shapeBox(tag, a);
      if (b) add(b, tt);
    }
  };
  walk(svg, IDENTITY);
  return box;
}
