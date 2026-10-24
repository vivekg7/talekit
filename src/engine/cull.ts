import { topLevelPieces } from './svg.js';

/**
 * Dropping what a layer draws far outside the frame.
 *
 * resvg 2.6 gives every group that needs its own canvas (an `opacity`, a filter, a mask, a
 * clip) a layer cut to four times the frame, centred on it, and panics when that group lies
 * wholly outside: it aborts the whole render, with no error to catch. A close camera puts
 * the far side of the scene there (past about zoom 3 on the stage, and much sooner on a
 * `near` layer, which zooms faster), and so does an actor parked well off-screen. So every
 * camera layer is culled before it is drawn: a shape whose box, mapped to the frame, lies
 * wholly more than one frame away is left out. Nothing that far can show, and anything kept
 * reaches inside resvg's bounds.
 *
 * Boxes are conservative (curve control points, arc diameters, the stroke), and a shape that
 * cannot be measured is kept. So is anything carrying an `id`, which may be drawn elsewhere
 * by reference, and everything inside definitions.
 */

/** An affine map, as SVG's matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f. */
export type Affine = [number, number, number, number, number, number];

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

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

function attrsOf(tag: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const [, k, , v] of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(['"])(.*?)\2/g)) a[k] = v;
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

/** A drawn shape's box in its own coordinates, stroke included, or undefined. */
function shapeBox(tag: string, a: Record<string, string>): Box | undefined {
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
  const s = a.stroke && a.stroke !== 'none' ? Number(a['stroke-width'] ?? 1) / 2 : 0;
  if (!Number.isFinite(s)) return undefined;
  return [b[0] - s, b[1] - s, b[2] + s, b[3] + s];
}

const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);

/** Leaves repeat frame after frame (the scene's every shape), so their boxes are kept. */
const boxes = new Map<string, Box | null>();

/**
 * `svg` with the shapes that `m` (its coordinates to the frame's) puts wholly more than one
 * frame outside the W×H frame left out.
 */
export function cullOffFrame(svg: string, m: Affine, W: number, H: number): string {
  const out = (b: Box, t: Affine) => {
    const xs = [
      b[0] * t[0] + b[1] * t[2],
      b[2] * t[0] + b[1] * t[2],
      b[0] * t[0] + b[3] * t[2],
      b[2] * t[0] + b[3] * t[2],
    ];
    const ys = [
      b[0] * t[1] + b[1] * t[3],
      b[2] * t[1] + b[1] * t[3],
      b[0] * t[1] + b[3] * t[3],
      b[2] * t[1] + b[3] * t[3],
    ];
    return (
      Math.max(...xs) + t[4] < -W ||
      Math.min(...xs) + t[4] > 2 * W ||
      Math.max(...ys) + t[5] < -H ||
      Math.min(...ys) + t[5] > 2 * H
    );
  };
  const walk = (frag: string, t: Affine): string => {
    let kept = '';
    for (const piece of topLevelPieces(frag)) {
      const open = piece.match(/^<([a-zA-Z]+)\b[^>]*?>/);
      const tag = open?.[1] ?? '';
      if (tag !== 'g' && !SHAPES.has(tag)) {
        kept += piece;
        continue;
      }
      const a = attrsOf(open![0]);
      const own = a.transform ? parseTransform(a.transform) : IDENTITY;
      if (a.id !== undefined || !own) {
        kept += piece;
        continue;
      }
      const tt = own === IDENTITY ? t : mul(t, own);
      if (tag === 'g') {
        if (piece.endsWith('/>')) continue;
        const inner = walk(piece.slice(open![0].length, -'</g>'.length), tt);
        if (inner) kept += open![0] + inner + '</g>';
        continue;
      }
      const key = open![0];
      let b = boxes.get(key);
      if (b === undefined) {
        if (boxes.size > 50000) boxes.clear();
        b = shapeBox(tag, a) ?? null;
        boxes.set(key, b);
      }
      if (!b || !out(b, tt)) kept += piece;
    }
    return kept;
  };
  return walk(svg, m);
}
