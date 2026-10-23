/**
 * Text the rasteriser cannot set: Devanagari. resvg lays out `<text>` itself and puts
 * Devanagari vowel signs in the wrong place (a matra lands on the next letter, spaces
 * vanish), with the system fonts and with good open fonts alike. So a line in that script
 * is shaped here with HarfBuzz, in the bundled Baloo 2 (rounded, made for Hindi and Latin
 * both), and drawn as glyph outlines. Lines in Latin script keep the project font as
 * `<text>`, so films without Hindi render exactly as before.
 *
 * The font file is read once, the first time a Devanagari line is drawn.
 */
import * as hb from 'harfbuzzjs';
import { readFileSync } from 'node:fs';
import { n } from './svg.js';

const DEVANAGARI = /[ऀ-ॿ꣠-ꣿ]/;

/** Whether a line has to be shaped here rather than left to the rasteriser. */
export const needsShaping = (text: string): boolean => DEVANAGARI.test(text);

/** Weights used: regular text and bold (shouts, titles, captions). */
const WEIGHT = { regular: 600, bold: 800 };

let face: hb.Face | undefined;
const fonts = new Map<number, hb.Font>();
const outlines = new Map<string, string>();

function fontAt(weight: number): hb.Font {
  let font = fonts.get(weight);
  if (!font) {
    face ??= new hb.Face(
      new hb.Blob(readFileSync(new URL('../../fonts/Baloo2.ttf', import.meta.url)))
    );
    font = new hb.Font(face);
    font.setVariations([new hb.Variation('wght', weight)]);
    fonts.set(weight, font);
  }
  return font;
}

interface Glyph {
  id: number;
  x: number;
  y: number;
}

/** Glyphs and their positions in font units, and the line's advance. */
function shape(text: string, weight: number): { glyphs: Glyph[]; width: number } {
  const font = fontAt(weight);
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);
  const pos = buf.getGlyphPositions();
  const glyphs: Glyph[] = [];
  let x = 0;
  buf.getGlyphInfos().forEach((g, i) => {
    glyphs.push({ id: g.codepoint, x: x + pos[i].xOffset, y: pos[i].yOffset });
    x += pos[i].xAdvance;
  });
  return { glyphs, width: x };
}

const unitsPerEm = () => {
  fontAt(WEIGHT.regular);
  return face!.upem;
};

/** The width of a shaped line, in pixels. */
export function shapedWidth(text: string, fontSize: number, bold = false): number {
  return (shape(text, bold ? WEIGHT.bold : WEIGHT.regular).width * fontSize) / unitsPerEm();
}

/**
 * A shaped line as outlines, standing on the baseline `y`, centred on `x` (or starting at it).
 * `stroke` draws a halo under the fill, as `paint-order='stroke'` does on `<text>`.
 */
export function shapedText(
  text: string,
  o: {
    x: number;
    y: number;
    fontSize: number;
    fill: string;
    bold?: boolean;
    anchor?: 'start' | 'middle';
    stroke?: { color: string; width: number };
  }
): string {
  const weight = o.bold ? WEIGHT.bold : WEIGHT.regular;
  const font = fontAt(weight);
  const { glyphs, width } = shape(text, weight);
  const s = o.fontSize / unitsPerEm();
  const x0 = o.anchor === 'start' ? o.x : o.x - (width * s) / 2;
  let paths = '';
  for (const g of glyphs) {
    const key = `${weight}:${g.id}`;
    let d = outlines.get(key);
    if (d === undefined) outlines.set(key, (d = font.glyphToPath(g.id)));
    if (d) paths += `<path transform='translate(${g.x} ${g.y})' d='${d}'/>`;
  }
  const stroke = o.stroke
    ? ` stroke='${o.stroke.color}' stroke-width='${Math.round(o.stroke.width / s)}' stroke-linejoin='round' paint-order='stroke'`
    : '';
  // Font units point up; flip them into the frame's y-down. The scale is tiny (a 26px line
  // is 0.026), so it keeps its digits: n() would round it 15% too wide.
  const k = s.toPrecision(5);
  return `<g transform='translate(${n(x0)} ${n(o.y)}) scale(${k} -${k})' fill='${o.fill}'${stroke}>${paths}</g>`;
}
