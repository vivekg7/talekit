import { Resvg, renderAsync } from '@resvg/resvg-js';

const FONT_OPTS = { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } as const;

export function rasterize(svg: string, width?: number): Buffer {
  const r = new Resvg(svg, {
    font: FONT_OPTS,
    ...(width ? { fitTo: { mode: 'width', value: width } } : {}),
  });
  return r.render().asPng();
}

export async function rasterizeAsync(svg: string, width?: number): Promise<Buffer> {
  const r = await renderAsync(svg, {
    font: FONT_OPTS,
    ...(width ? { fitTo: { mode: 'width', value: width } } : {}),
  });
  return r.asPng();
}
