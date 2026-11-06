import { needsShaping, shapedText, shapedWidth } from './glyphs.js';
import { escapeXml, n } from './svg.js';
import { safeInsets } from './format.js';

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
  /**
   * Half the head's height on screen. With it, a bubble with no room above the head goes
   * beside it instead of down over the speaker; without it (sheets, tests) it is pushed
   * down inside the frame.
   */
  headR?: number;
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
  // Inside what a reel app leaves clear of its own buttons and captions.
  const safe = safeInsets({ width: spec.frameW, height: spec.frameH });
  const minX = margin + safe.left;
  const maxX = spec.frameW - margin - safe.right;
  const minY = margin + safe.top;
  const maxText = Math.min(380 * k, maxX - minX - 2 * padX);

  const bold = spec.style === 'shout';
  const lines = wrapText(spec.text, maxText, fontSize, bold);
  const textW = Math.max(...lines.map((l) => textWidth(l, fontSize, bold)), 40 * k);
  const w = textW + 2 * padX;
  const h = lines.length * lineHeight + 2 * padY;

  const maxY = spec.frameH - margin - safe.bottom;

  // Above the head, the tail pointing down at it.
  let x = Math.max(minX, Math.min(maxX - w, spec.headX - w / 2));
  let y = spec.headTop - tail - h;
  // Which edge the tail leaves from, and the point it reaches.
  let edge: 'bottom' | 'top' | 'left' | 'right' = 'bottom';
  let tipX = spec.headX;
  let tipY = spec.headTop + 6 * k;
  if (y < minY && spec.headR !== undefined) {
    // No room above (a speaker high in the frame): beside the head and level with it, on
    // the side with more room, so it never covers the speaker. A shout's spikes reach out
    // past its box, so it stands that much further off.
    const r = spec.headR;
    const gap = r + tail + (bold ? 0.14 * w : 0);
    const right = maxX - (spec.headX + gap) >= spec.headX - gap - minX;
    x = Math.max(minX, Math.min(maxX - w, right ? spec.headX + gap : spec.headX - gap - w));
    const mid = spec.headTop + r;
    y = Math.max(minY, Math.min(maxY - h, mid - h / 2));
    edge = right ? 'left' : 'right';
    tipX = spec.headX + (right ? 0.8 : -0.8) * r;
    tipY = mid;
  } else if (y < minY) {
    y = minY;
    if (spec.headTop < minY + h + tail) {
      edge = 'top';
      tipY = y - 4;
    }
  }
  const tailUp = edge === 'top';
  const side = edge === 'left' || edge === 'right';
  // The tail's root: on its edge, as near the tip as the rounded corners allow (a thought
  // bubble's ends are round all the way, so from the side it leaves at the middle).
  const clampTo = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  const along = side
    ? spec.style === 'thought'
      ? y + h / 2
      : clampTo(tipY, y + 24 * k, y + h - 24 * k)
    : clampTo(tipX, x + 28 * k, x + w - 28 * k);
  const at = { bottom: y + h, top: y, left: x, right: x + w }[edge];
  const out = edge === 'bottom' || edge === 'right' ? 1 : -1;
  // A point on the tail's edge `d` along it, `o` out from it.
  const onEdge = (d: number, o = 0): string =>
    side ? `${n(at + out * o)},${n(along + d)}` : `${n(along + d)},${n(at + out * o)}`;
  const tip = `${n(tipX)},${n(tipY)}`;
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
    const mid = side
      ? `${n(at + out * 22 * k)},${n((along + tipY) / 2)}`
      : `${n((along + tipX) / 2)},${n(at + out * 22 * k)}`;
    const [c2x, c2y] = mid.split(',');
    const [c1x, c1y] = onEdge(0, 10 * k).split(',');
    const c1 = `<circle cx='${c1x}' cy='${c1y}' r='${7 * k}' fill='#fff' ${stroke}/>`;
    const c2 = `<circle cx='${c2x}' cy='${c2y}' r='${4.5 * k}' fill='#fff' ${stroke}/>`;
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
    const tailPts = `${onEdge(-10 * k)} ${tip} ${onEdge(10 * k)}`;
    return `<g class='bubble'><polygon points='${tailPts}' fill='#fff' ${stroke} stroke-linejoin='round'/><polygon points='${pts.join(' ')}' fill='#fff' ${stroke} stroke-linejoin='round'/>${textEl}</g>`;
  }

  const tailPath = `M${onEdge(-12 * k)} L${tip} L${onEdge(12 * k)}`;
  // A white patch over the box's stroke where the tail joins it.
  const patch = side
    ? `x='${n(edge === 'left' ? x - 1 : x + w - 4 * k)}' y='${n(along - 11 * k)}' width='${5 * k}' height='${22 * k}'`
    : `x='${n(along - 11 * k)}' y='${n(tailUp ? y - 1 : y + h - 4 * k)}' width='${22 * k}' height='${5 * k}'`;
  return `<g class='bubble'><path d='${tailPath}' fill='#fff' ${stroke} stroke-linejoin='round'/><rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${r}' ry='${r}' fill='#fff' ${stroke}/><rect ${patch} fill='#fff'/>${textEl}</g>`;
}
