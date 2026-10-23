import { Resvg } from '@resvg/resvg-js';

const FONT_OPTS = { loadSystemFonts: true, defaultFontFamily: 'Helvetica' } as const;
const NO_FONTS = { loadSystemFonts: false } as const;

/**
 * Text set once, as outlines. resvg reads every system font each time it is handed SVG
 * with fonts on, which costs more than drawing the frame; a bubble's lines stay on screen
 * for seconds. So each `<text>` element is laid out by resvg itself, once, into the paths
 * it would have drawn, and frames carry those and render without fonts: the same pixels.
 * Only text that carries its own fill, size and family is taken (nothing it would inherit
 * from around it is lost by setting it apart), and none from a frame with a `<style>`.
 */
const TEXT = /<text\b[^>]*>[^<]*<\/text>/g;
const outlined = new Map<string, string>();

function selfStyled(el: string): boolean {
  const open = el.slice(0, el.indexOf('>'));
  return /\sfill=/.test(open) && /\sfont-size=/.test(open) && /\sfont-family=/.test(open);
}

export function outlineText(svg: string): string {
  const texts = svg.match(TEXT);
  if (!texts || svg.includes('<style')) return svg;
  const todo = [...new Set(texts)].filter((t) => !outlined.has(t) && selfStyled(t));
  if (todo.length) {
    const doc =
      `<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'>` +
      todo.map((t, i) => `<g id='tk-text-${i}'>${t}</g>`).join('') +
      `</svg>`;
    const out = new Resvg(doc, { font: FONT_OPTS }).toString();
    // One group per element, in order, each holding only what its text became (empty
    // when it drew nothing, as a blank line does).
    const parts = out.split(/<g id="tk-text-(\d+)">/);
    for (let i = 1; i < parts.length; i += 2) {
      const body = parts[i + 1].replace(/\s*<\/svg>\s*$/, '').replace(/\s*<\/g>\s*$/, '');
      outlined.set(todo[Number(parts[i])], body.trim());
    }
    if (outlined.size > 5000) outlined.clear();
  }
  return svg.replace(TEXT, (t) => outlined.get(t) ?? t);
}

/** Fonts only when some text is still left to set. */
function options(svg: string, width?: number) {
  return {
    font: svg.includes('<text') ? FONT_OPTS : NO_FONTS,
    ...(width ? { fitTo: { mode: 'width', value: width } as const } : {}),
  };
}

export function rasterize(svg: string, width?: number): Buffer {
  const s = outlineText(svg);
  return new Resvg(s, options(s, width)).render().asPng();
}

/** A frame as raw RGBA, for the encoder: no PNG to pack here and unpack in ffmpeg. */
export function rasterizePixels(svg: string): { pixels: Buffer; width: number; height: number } {
  const s = outlineText(svg);
  const img = new Resvg(s, options(s)).render();
  return { pixels: img.pixels, width: img.width, height: img.height };
}
