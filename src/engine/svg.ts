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
