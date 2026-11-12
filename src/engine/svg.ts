export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Round for compact, stable SVG output. */
export const n = (v: number): string => (Math.round(v * 100) / 100).toString();

/** Substitute `{token}` colour placeholders. Unknown tokens are left as-is so they show up in validation. */
export function applyColors(svg: string, colors: Record<string, string>): string {
  return svg.replace(/\{([a-zA-Z0-9_-]+)\}/g, (m, key: string) => colors[key] ?? m);
}

/** Tokens referenced in a fragment that the palette does not define. */
export function missingColorTokens(svg: string, colors: Record<string, string>): string[] {
  const missing = new Set<string>();
  for (const m of svg.matchAll(/\{([a-zA-Z0-9_-]+)\}/g)) if (!(m[1] in colors)) missing.add(m[1]);
  return [...missing];
}

/** Top-level elements of a fragment: each shape or group the artist wrote at depth 0. */
export function topLevelPieces(svg: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [tag, closing, , selfClosing] = m;
    const i = m.index!;
    if (closing) {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(svg.slice(start, i + tag.length));
        start = -1;
      }
    } else if (selfClosing) {
      if (depth === 0) out.push(tag);
    } else {
      if (depth === 0) start = i;
      depth++;
    }
  }
  return out;
}

/**
 * How far down the page a top-level piece reaches, [top, bottom], stroke included, or
 * undefined when that cannot be told cheaply (a group, a transform, a path with relative
 * commands). Bezier control points and arc radii widen it, so it never comes out short.
 */
export function verticalExtent(piece: string): [number, number] | undefined {
  const m = piece.match(/^<([a-zA-Z]+)\b([^>]*?)\/?>$/);
  if (!m || / transform=/.test(m[2])) return undefined;
  const [, tag, attrs] = m;
  const a: Record<string, number> = {};
  for (const [, k, v] of attrs.matchAll(/([a-zA-Z-]+)='([^']*)'/g)) a[k] = Number(v);
  const stroke = /\bstroke='(?!none')/.test(attrs) ? (a['stroke-width'] || 1) / 2 : 0;
  let ys: number[];
  if (tag === 'circle') ys = [a.cy - a.r, a.cy + a.r];
  else if (tag === 'ellipse') ys = [a.cy - a.ry, a.cy + a.ry];
  else if (tag === 'rect') ys = [a.y, a.y + a.height];
  else if (tag === 'line') ys = [a.y1, a.y2];
  else if (tag === 'path') {
    const d = attrs.match(/\bd='([^']*)'/)?.[1] ?? '';
    if (/[a-y]/.test(d.replace(/[zZ]/g, ''))) return undefined;
    ys = [];
    for (const [, cmd, args] of d.matchAll(/([A-Z])([^A-Z]*)/g)) {
      const v = (args.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
      if (cmd === 'V') ys.push(...v);
      else if (cmd === 'H' || cmd === 'Z') continue;
      else if (cmd === 'A')
        for (let i = 0; i + 6 < v.length; i += 7) ys.push(v[i + 6] - v[i + 1], v[i + 6] + v[i + 1]);
      else for (let i = 1; i < v.length; i += 2) ys.push(v[i]);
    }
  } else return undefined;
  if (!ys.length || ys.some((y) => !Number.isFinite(y))) return undefined;
  return [Math.min(...ys) - stroke, Math.max(...ys) + stroke];
}

/**
 * Where a limb's drawing lies across the line y = `y`, as [left, right]: the run of filled
 * shapes (and strokes, at their width) crossing that line around `x`, or the nearest run
 * when none covers `x`. Undefined when nothing crosses it or the drawing cannot be read
 * cheaply (a group, a transform, a path with relative commands). Curves are followed
 * through a few points each, close enough to find a limb's middle and width at a joint.
 */
export function spanAt(svg: string, y: number, x: number): [number, number] | undefined {
  const runs: [number, number][] = [];
  for (const piece of topLevelPieces(svg)) {
    const m = piece.match(/^<([a-zA-Z]+)\b([^>]*?)\/?>$/);
    if (!m || / transform=/.test(m[2])) continue;
    const [, tag, attrs] = m;
    const a: Record<string, number> = {};
    for (const [, k, v] of attrs.matchAll(/([a-zA-Z-]+)='([^']*)'/g)) a[k] = Number(v);
    const filled = !/\bfill='none'/.test(attrs);
    const stroked = /\bstroke='(?!none')/.test(attrs) ? a['stroke-width'] || 1 : 0;
    if (tag === 'circle' || tag === 'ellipse') {
      const rx = tag === 'circle' ? a.r : a.rx;
      const ry = tag === 'circle' ? a.r : a.ry;
      const t = (y - a.cy) / ry;
      if (Math.abs(t) < 1) {
        const h = rx * Math.sqrt(1 - t * t) + stroked / 2;
        runs.push([a.cx - h, a.cx + h]);
      }
    } else if (tag === 'rect') {
      if (y > a.y && y < a.y + a.height) runs.push([a.x, a.x + a.width]);
    } else if (tag === 'path') {
      const d = attrs.match(/\bd='([^']*)'/)?.[1] ?? '';
      const lines = flatten(d);
      if (!lines) continue;
      for (const pts of lines) {
        const xs: number[] = [];
        const ring = filled ? [...pts, pts[0]] : pts;
        for (let i = 1; i < ring.length; i++) {
          const [x0, y0] = ring[i - 1];
          const [x1, y1] = ring[i];
          if (y0 === y1 || (y - y0) * (y - y1) > 0) continue;
          const cx = x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
          if (filled) xs.push(cx);
          if (stroked) {
            // A stroke crossing at a slant is wider along the line than across itself.
            const len = Math.hypot(x1 - x0, y1 - y0);
            const h = Math.min(stroked, ((stroked / 2) * len) / Math.abs(y1 - y0));
            runs.push([cx - h, cx + h]);
          }
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) runs.push([xs[i], xs[i + 1]]);
      }
    }
  }
  if (!runs.length) return undefined;
  runs.sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const away = ([l, r]: [number, number]) => (x < l ? l - x : x > r ? x - r : 0);
  return merged.reduce((best, r) => (away(r) < away(best) ? r : best));
}

/** An absolute path as polylines, one per subpath, curves through a few points each. */
function flatten(d: string): [number, number][][] | undefined {
  if (/[a-y]/.test(d.replace(/[zZ]/g, '').replace(/e-?\d/g, ''))) return undefined;
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  let at: [number, number] = [0, 0];
  const STEPS = 8;
  for (const [, cmd, args] of d.matchAll(/([A-Z])([^A-Z]*)/g)) {
    const v = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (cmd === 'M') {
      if (cur.length) out.push(cur);
      cur = [];
      for (let i = 0; i + 1 < v.length; i += 2) cur.push((at = [v[i], v[i + 1]]));
    } else if (cmd === 'L' || cmd === 'T') {
      for (let i = 0; i + 1 < v.length; i += 2) cur.push((at = [v[i], v[i + 1]]));
    } else if (cmd === 'H') {
      for (const x of v) cur.push((at = [x, at[1]]));
    } else if (cmd === 'V') {
      for (const y of v) cur.push((at = [at[0], y]));
    } else if (cmd === 'Q' || cmd === 'S') {
      for (let i = 0; i + 3 < v.length; i += 4) {
        const [p0, c, p1] = [at, [v[i], v[i + 1]], [v[i + 2], v[i + 3]]];
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const u = 1 - t;
          cur.push([
            u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
          ]);
        }
        at = p1 as [number, number];
      }
    } else if (cmd === 'C') {
      for (let i = 0; i + 5 < v.length; i += 6) {
        const p0 = at;
        const [c1, c2, p1] = [
          [v[i], v[i + 1]],
          [v[i + 2], v[i + 3]],
          [v[i + 4], v[i + 5]],
        ];
        for (let s = 1; s <= STEPS; s++) {
          const t = s / STEPS;
          const u = 1 - t;
          cur.push([
            u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p1[0],
            u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p1[1],
          ]);
        }
        at = p1 as [number, number];
      }
    } else if (cmd === 'A') {
      for (let i = 0; i + 6 < v.length; i += 7) cur.push((at = [v[i + 5], v[i + 6]]));
    } else if (cmd === 'Z') {
      if (cur.length) out.push(cur);
      at = cur[0] ?? at;
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out.filter((pts) => pts.length > 1);
}
