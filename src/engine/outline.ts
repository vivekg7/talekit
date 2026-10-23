/**
 * The house outline: every character part gets a dark line around its silhouette, drawn by
 * the engine rather than the artist. Agents forget strokes, use five different widths and
 * outline the wrong shapes; one rule applied here keeps a whole cast in the same style, the
 * same way the engine owns motion.
 *
 * How: before a part is drawn, a copy of it is drawn in the line colour with every filled
 * shape (and every thick stroke, which is how limbs are drawn) widened by the line width.
 * The copy sits under the part, so only the rim shows. Because the copy is per part, a near
 * arm gets a line where it crosses the torso, while shapes inside one part merge into one
 * silhouette. A rig can fuse a part into another (`Rig.fuse`: a quadruped's head and neck
 * into its body), and then its copy goes down under that part instead, with no line between.
 */

/** Line width on screen in pixels at scale 1, whatever the character's height. */
export const OUTLINE_PX = 3.4;
export const DEFAULT_LINE_COLOR = '#2e2633';
/**
 * Strokes at least this wide (canonical units), and at least twice the line width, are limbs
 * and get outlined; thinner ones are line work (a string, a handle, a whisker).
 */
const THICK_STROKE = 8;
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
/** Containers whose content is not drawn directly. */
const SKIP = new Set([
  'defs',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'symbol',
  'title',
  'desc',
  'text',
  'filter',
]);
const GEOMETRY = [
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'width',
  'height',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'stroke-linecap',
];

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
}

/** Attributes of one tag, with `style='a:b'` declarations folded in. */
export function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))
    out[m[1]] = m[2] ?? m[3];
  if (out.style)
    for (const decl of out.style.split(';')) {
      const [k, v] = decl.split(':').map((s) => s.trim());
      if (k && v) out[k] = v;
    }
  return out;
}

function inherit(parent: Paint, a: Record<string, string>): Paint {
  return {
    fill: a.fill ?? parent.fill,
    stroke: a.stroke ?? parent.stroke,
    strokeWidth: a['stroke-width'] !== undefined ? Number(a['stroke-width']) : parent.strokeWidth,
    opacity: parent.opacity * (a.opacity !== undefined ? Number(a.opacity) : 1),
    fillOpacity: a['fill-opacity'] !== undefined ? Number(a['fill-opacity']) : parent.fillOpacity,
  };
}

const ROOT_PAINT: Paint = {
  fill: '#000',
  stroke: 'none',
  strokeWidth: 1,
  opacity: 1,
  fillOpacity: 1,
};

/** Close a single-subpath fill so its outline also runs along the implied closing edge. */
function closePath(d: string): string {
  if (/[zZ]\s*$/.test(d) || /[mM]/.test(d.trim().slice(1))) return d;
  return `${d} Z`;
}

/**
 * The underlay for one part: the part's shapes in `color`, widened by `width` canonical
 * units. Faint shapes (blush, glow) and thin line work are left out, so they never grow a
 * rim; so is anything already drawn in the line colour.
 */
export function outlineUnderlay(svg: string, color: string, width: number, paint = color): string {
  let out = '';
  const stack: Paint[] = [ROOT_PAINT];
  let skipDepth = 0;
  const line = color.toLowerCase();
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, attrSrc, selfClosing] = m;
    if (SKIP.has(tag)) {
      if (!selfClosing) skipDepth += closing ? -1 : 1;
      continue;
    }
    if (skipDepth > 0) continue;
    if (tag === 'g') {
      if (closing) {
        stack.pop();
        out += '</g>';
      } else {
        const a = parseAttrs(attrSrc);
        stack.push(inherit(stack[stack.length - 1], a));
        out += a.transform ? `<g transform='${a.transform}'>` : '<g>';
        if (selfClosing) {
          stack.pop();
          out += '</g>';
        }
      }
      continue;
    }
    if (closing || !SHAPES.has(tag)) continue;
    const a = parseAttrs(attrSrc);
    const p = inherit(stack[stack.length - 1], a);
    const stroked = p.stroke !== 'none' && p.strokeWidth > 0;
    if (stroked && p.stroke.toLowerCase() === line) continue;
    const filled = p.fill !== 'none' && tag !== 'line' && tag !== 'polyline';
    const solid = p.opacity >= 0.95;
    const fillShows = filled && solid && p.fillOpacity >= 0.95;
    const limb = stroked && solid && p.strokeWidth >= Math.max(THICK_STROKE, 2 * width);
    if (!fillShows && !limb) continue;
    let geo = '';
    for (const k of GEOMETRY) {
      if (a[k] === undefined) continue;
      const v = k === 'd' && fillShows ? closePath(a[k]) : a[k];
      geo += ` ${k}='${v}'`;
    }
    const sw = (limb ? p.strokeWidth : 0) + 2 * width;
    const cap = a['stroke-linecap'] ? '' : ` stroke-linecap='round'`;
    const stroke =
      sw > 0
        ? ` stroke='${paint}' stroke-width='${+sw.toFixed(2)}' stroke-linejoin='round'${cap}`
        : '';
    out += `<${tag}${geo} fill='${fillShows ? paint : 'none'}'${stroke}/>`;
  }
  return out;
}

const cache = new Map<string, string>();

/**
 * Memoised `outlineUnderlay`: parts repeat every frame, so parse each one once. `paint`
 * draws the shapes in another colour than the line they are picked against (a silhouette).
 */
export function outlineFor(svg: string, color: string, width: number, paint = color): string {
  const key = `${color}|${paint}|${width}|${svg}`;
  let hit = cache.get(key);
  if (hit === undefined) {
    hit = outlineUnderlay(svg, color, width, paint);
    if (cache.size > 5000) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}

/**
 * Width of the thickest stroke in a part: a leg drawn as one round-capped stroke, as the
 * guide asks, is that wide. 0 when the part has no stroke.
 */
export function limbWidth(svg: string): number {
  let w = 0;
  for (const m of svg.matchAll(/<[a-zA-Z]+\b([^>]*?)\/?>/g)) {
    const a = parseAttrs(m[1]);
    if (a.stroke && a.stroke !== 'none' && a['stroke-width'])
      w = Math.max(w, Number(a['stroke-width']));
  }
  return w;
}
