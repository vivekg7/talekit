import { needsShaping, shapedText, shapedWidth } from './glyphs.js';
import { escapeXml, n } from './svg.js';

/** Rough advance widths as a fraction of font size, tuned for rounded comic fonts. */
function charWidth(ch: string): number {
  if (ch === ' ') return 0.3;
  if ("iljtf.,'!|:;".includes(ch)) return 0.32;
  if ('mwMW'.includes(ch)) return 0.85;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  if (ch >= '0' && ch <= '9') return 0.56;
  return 0.54;
}

export function textWidth(text: string, fontSize: number, bold = false): number {
  if (needsShaping(text)) return shapedWidth(text, fontSize, bold);
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * fontSize;
}

/** Greedy word wrap. Words longer than the line are split by character. */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, fontSize, bold) <= maxWidth || !line) {
        if (textWidth(candidate, fontSize, bold) > maxWidth && !line) {
          // hard-split an over-long word
          let chunk = '';
          for (const ch of word) {
            if (textWidth(chunk + ch, fontSize, bold) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = '';
            }
            chunk += ch;
          }
          line = chunk;
        } else {
          line = candidate;
        }
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

export type BubbleStyle = 'speech' | 'thought' | 'shout';

export interface BubbleSpec {
  text: string;
  style: BubbleStyle;
  /** Screen-space point the tail points at (top of the head). */
  headX: number;
  headTop: number;
  frameW: number;
  frameH: number;
  font: string;
  /** Multiplier for font size and padding, for different frame sizes. */
  uiScale: number;
  /** Seconds since the bubble appeared and until it goes; it pops in and shrinks out. */
  age?: number;
  left?: number;
}

const POP_IN = 0.28;
const POP_OUT = 0.16;

/**
 * Scale and opacity of a bubble by its age: in from small past full size and back, out by
 * shrinking toward the speaker. Stays 1 when no timing is given (sheets, tests).
 */
export function bubblePop(age = Infinity, left = Infinity): { scale: number; opacity: number } {
  if (age < POP_IN) {
    const x = age / POP_IN;
    const y = x - 1;
    const s = 2.4;
    return { scale: 0.3 + 0.7 * (1 + y * y * ((s + 1) * y + s)), opacity: Math.min(1, x * 3) };
  }
  if (left < POP_OUT) {
    const x = Math.max(0, left / POP_OUT);
    return { scale: 0.6 + 0.4 * x, opacity: x };
  }
  return { scale: 1, opacity: 1 };
}

/** Speech bubble in screen space: readable at any zoom, clamped inside the frame. */
export function bubbleSvg(spec: BubbleSpec): string {
  const { scale, opacity } = bubblePop(spec.age, spec.left);
  const inner = bubbleShape(spec);
  if (scale === 1 && opacity === 1) return inner;
  // Grow from the tail's tip, so it comes out of the speaker's head.
  const x = spec.headX;
  const y = spec.headTop;
  return `<g opacity='${n(opacity)}' transform='translate(${n(x)} ${n(y)}) scale(${n(scale)}) translate(${n(-x)} ${n(-y)})'>${inner}</g>`;
}

function bubbleShape(spec: BubbleSpec): string {
  const k = spec.uiScale;
  const fontSize = 26 * k;
  const lineHeight = 32 * k;
  const padX = 20 * k;
  const padY = 14 * k;
  const margin = 16 * k;
  const tail = 26 * k;
  const maxText = Math.min(380 * k, spec.frameW - 2 * margin - 2 * padX);

  const bold = spec.style === 'shout';
  const lines = wrapText(spec.text, maxText, fontSize, bold);
  const textW = Math.max(...lines.map((l) => textWidth(l, fontSize, bold)), 40 * k);
  const w = textW + 2 * padX;
  const h = lines.length * lineHeight + 2 * padY;

  let x = spec.headX - w / 2;
  x = Math.max(margin, Math.min(spec.frameW - margin - w, x));
  let y = spec.headTop - tail - h;
  let tailUp = false; // bubble below the target
  if (y < margin) {
    y = margin;
    if (spec.headTop < margin + h + tail) tailUp = true;
  }

  const tailBaseX = Math.max(x + 28 * k, Math.min(x + w - 28 * k, spec.headX));
  const tipX = spec.headX;
  const tipY = tailUp ? y - 4 : spec.headTop + 6 * k;
  const r = 18 * k;
  const stroke = `stroke='#222' stroke-width='${3 * k}'`;
  const textX = x + w / 2;
  const firstBaseline = y + padY + lineHeight * 0.78;
  const textEl = lines
    .map((l, i) => {
      const y = firstBaseline + i * lineHeight;
      return needsShaping(l)
        ? shapedText(l, { x: textX, y, fontSize, fill: '#1a1a1a', bold })
        : `<text x='${textX}' y='${y}' text-anchor='middle' font-family="${escapeXml(spec.font)}" font-size='${fontSize}' fill='#1a1a1a'${bold ? " font-weight='bold'" : ''}>${escapeXml(l)}</text>`;
    })
    .join('');

  if (spec.style === 'thought') {
    const dir = tailUp ? -1 : 1;
    const c1 = `<circle cx='${tailBaseX}' cy='${tailUp ? y - 10 * k : y + h + 10 * k}' r='${7 * k}' fill='#fff' ${stroke}/>`;
    const c2 = `<circle cx='${(tailBaseX + tipX) / 2}' cy='${(tailUp ? y : y + h) + dir * 22 * k}' r='${4.5 * k}' fill='#fff' ${stroke}/>`;
    return `<g class='bubble'><rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${h / 2}' ry='${h / 2}' fill='#fff' ${stroke}/>${c1}${c2}${textEl}</g>`;
  }

  if (spec.style === 'shout') {
    // starburst around the text box
    const cx = x + w / 2;
    const cy = y + h / 2;
    const n = 18;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * 2 * i) / (n * 2) - Math.PI / 2;
      const spike = i % 2 === 0 ? 1.28 : 1.05;
      pts.push(`${cx + (Math.cos(a) * w * spike) / 2},${cy + (Math.sin(a) * h * spike) / 2}`);
    }
    const tailPts = `${tailBaseX - 10 * k},${tailUp ? y : y + h} ${tipX},${tipY} ${tailBaseX + 10 * k},${tailUp ? y : y + h}`;
    return `<g class='bubble'><polygon points='${tailPts}' fill='#fff' ${stroke} stroke-linejoin='round'/><polygon points='${pts.join(' ')}' fill='#fff' ${stroke} stroke-linejoin='round'/>${textEl}</g>`;
  }

  const baseY = tailUp ? y : y + h;
  const tailPath = `M${tailBaseX - 12 * k},${baseY} L${tipX},${tipY} L${tailBaseX + 12 * k},${baseY}`;
  return `<g class='bubble'><path d='${tailPath}' fill='#fff' ${stroke} stroke-linejoin='round'/><rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${r}' ry='${r}' fill='#fff' ${stroke}/><rect x='${tailBaseX - 11 * k}' y='${tailUp ? y - 1 : y + h - 4 * k}' width='${22 * k}' height='${5 * k}' fill='#fff'/>${textEl}</g>`;
}
