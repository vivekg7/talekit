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
