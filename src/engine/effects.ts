import { clamp01, hash01, TAU } from './easing.js';
import { n } from './svg.js';
import type { Effect } from './types.js';
import { mix } from './weather.js';

/**
 * Moving things placed in a scene (fire, smoke, a waterfall, the sea, the sun), drawn by
 * the engine as functions of shot time in the coordinates of the plane they belong to.
 * Like the weather, every value comes from time and `hash01`, so any frame stands alone.
 */

export type EffectLayer = 'far' | 'stage' | 'front' | 'near';

const LINE = '#2e2633';

export const effectLayer = (e: Effect): EffectLayer =>
  e.layer ?? (e.kind === 'sun' ? 'far' : 'stage');

/**
 * Every effect of the scene on one plane at time t. `wind` (-1..1) leans flames and carries
 * smoke and sparks; `W` is the frame width, for waves that span it.
 */
export function effectsSvg(
  effects: Effect[],
  layer: EffectLayer,
  t: number,
  wind: number,
  W: number,
  H: number
): string {
  const k = H / 720;
  return effects
    .map((e, i) => {
      if (effectLayer(e) !== layer) return '';
      const id = `tk-fx-${layer}-${i}`;
      switch (e.kind) {
        case 'fire':
          return fire(e, id, t, wind, k);
        case 'smoke':
          return smoke(e, id, t, wind, k);
        case 'waterfall':
          return waterfall(e, id, t, k);
        case 'waves':
          return waves(e, id, t, W, k);
        case 'sun':
          return sun(e, id, t, k);
      }
    })
    .join('');
}

/** Sum of sines at unrelated rates: a wobble that never visibly repeats. */
const wobble = (t: number, seed: string) =>
  0.5 * Math.sin(TAU * (1.3 + 0.4 * hash01(seed + 'a')) * t + TAU * hash01(seed + 'p')) +
  0.3 * Math.sin(TAU * (2.9 + 0.6 * hash01(seed + 'b')) * t + TAU * hash01(seed + 'q')) +
  0.2 * Math.sin(TAU * (5.3 + 0.9 * hash01(seed + 'c')) * t + TAU * hash01(seed + 'r'));

/** A flame tongue standing on (x, y), `w` wide and `h` tall, its tip pushed sideways by `lean`. */
function tongue(x: number, y: number, w: number, h: number, lean: number): string {
  const tx = x + lean;
  const ty = y - h;
  return (
    `M${n(x - w / 2)} ${n(y)}` +
    ` C${n(x - w / 2)} ${n(y - h * 0.45)} ${n(tx - w * 0.38 + lean * 0.2)} ${n(y - h * 0.62)} ${n(tx)} ${n(ty)}` +
    ` C${n(tx + w * 0.38 + lean * 0.2)} ${n(y - h * 0.62)} ${n(x + w / 2)} ${n(y - h * 0.45)} ${n(x + w / 2)} ${n(y)}` +
    ` Q${n(x)} ${n(y + w * 0.22)} ${n(x - w / 2)} ${n(y)} Z`
  );
}

/**
 * A campfire: crossed logs, a glow on the ground, three nested flames (red, orange,
 * yellow) and a couple of side tongues, each flickering on its own, and sparks rising.
 */
function fire(e: Effect, id: string, t: number, wind: number, k: number): string {
  const s = e.size * k;
  const x = e.x ?? 0;
  const y = e.y;
  const seed = `${id}:`;
  const flick = wobble(t, seed + 'f');
  const lean = (wind * 26 + 9 * wobble(t, seed + 'l')) * s;
  let out =
    `<defs><radialGradient id='${id}-glow'><stop offset='0' stop-color='#ffb347' stop-opacity='0.55'/>` +
    `<stop offset='1' stop-color='#ffb347' stop-opacity='0'/></radialGradient></defs>` +
    `<ellipse cx='${n(x)}' cy='${n(y - 4 * s)}' rx='${n((120 + 8 * flick) * s)}' ry='${n((42 + 3 * flick) * s)}' fill='url(#${id}-glow)'/>`;
  const log = (angle: number, color: string) =>
    `<g transform='translate(${n(x)} ${n(y - 9 * s)}) rotate(${angle})'>` +
    `<rect x='${n(-50 * s)}' y='${n(-8 * s)}' width='${n(100 * s)}' height='${n(16 * s)}' rx='${n(8 * s)}' fill='${color}' stroke='${LINE}' stroke-width='${n(3 * k)}'/>` +
    `<ellipse cx='${n(44 * s)}' cy='0' rx='${n(5 * s)}' ry='${n(7 * s)}' fill='#c99a6b' stroke='${LINE}' stroke-width='${n(2 * k)}'/></g>`;
  if (e.logs) out += log(-14, '#6e4327');
  // Side tongues first, then the main flame outside in.
  const side = (dx: number, h: number, tag: string) => {
    const w = wobble(t, seed + tag);
    return `<path d='${tongue(x + dx * s, y - 10 * s, 26 * s, (h + 14 * w) * s, lean * 0.7 + 5 * w * s)}' fill='#e4572e'/>`;
  };
  out += side(-26, 60, 's1') + side(24, 52, 's2');
  const layers: [number, number, string, string][] = [
    [64, 112, '#e4572e', 'o'],
    [46, 82, '#f7931e', 'm'],
    [26, 52, '#ffd23f', 'i'],
  ];
  for (const [w, h, color, tag] of layers) {
    const f = wobble(t, seed + tag);
    out += `<path d='${tongue(x, y - 8 * s, (w + 4 * f) * s, (h + 12 * f) * s, lean * (h / 112))}' fill='${color}'/>`;
  }
  if (e.logs) out += log(16, '#7a4a2a');
  // Sparks: each rises, wobbling, carried by the wind, and fades.
  for (let i = 0; i < 7; i++) {
    const h = (key: string) => hash01(`${seed}spark:${i}:${key}`);
    const period = 1.1 + 0.8 * h('T');
    const u = (t / period + h('p')) % 1;
    const sx =
      x + (h('x') - 0.5) * 40 * s + (wind * 90 + 14 * Math.sin(TAU * (u * 2 + h('w')))) * u * s;
    const sy = y - (40 + 150 * u) * s;
    out += `<circle cx='${n(sx)}' cy='${n(sy)}' r='${n(2.4 * s * (1 - 0.5 * u))}' fill='#ffd23f' fill-opacity='${n(1 - u)}'/>`;
  }
  return `<g class='fire'>${out}</g>`;
}

/** Puffs that rise from (x, y), swelling, drifting with the wind and fading. */
function smoke(e: Effect, id: string, t: number, wind: number, k: number): string {
  const s = e.size * k;
  const x = e.x ?? 0;
  const color = e.color ?? '#a3a8b0';
  const count = 7;
  const period = 4.2;
  let out = '';
  // Oldest first, so a newer puff is drawn over the one above it.
  const puffs = Array.from({ length: count }, (_, i) => ({ i, u: (t / period + i / count) % 1 }));
  for (const { i, u } of puffs.sort((a, b) => b.u - a.u)) {
    const h = (key: string) => hash01(`${id}:puff:${i}:${key}`);
    // Each puff wanders off the column a little and swells as it thins out.
    const px =
      x +
      (wind * 200 * u * u + (h('x') - 0.5) * 30 * u + 16 * Math.sin(TAU * (u * 1.2 + h('w')))) * s;
    const py = e.y - 230 * u * s;
    const r = (8 + 46 * u) * s * (0.8 + 0.4 * h('r'));
    const o = 0.42 * clamp01(u * 5) * Math.pow(1 - u, 1.3);
    out += `<circle cx='${n(px)}' cy='${n(py)}' r='${n(r)}' fill-opacity='${n(o)}'/>`;
  }
  return `<g class='smoke' fill='${color}'>${out}</g>`;
}

/**
 * A waterfall from the lip at (x, y) down `height`: a sheet of water widening a little as it
 * falls, with streaks pouring down it (dashes scrolling along lines), a bright lip, and at
 * the foot churning foam, ripples and mist rising.
 */
function waterfall(e: Effect, id: string, t: number, k: number): string {
  const x = e.x ?? 0;
  const y = e.y;
  const w = (e.width ?? 120) * k;
  const h = (e.height ?? 300) * k;
  const color = e.color ?? '#7cc6ec';
  const spread = 0.06 * h;
  const foot = y + h;
  let out =
    `<defs><linearGradient id='${id}-sheet' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${mix(color, '#ffffff', 0.35)}'/><stop offset='1' stop-color='${color}'/></linearGradient></defs>` +
    `<path d='M${n(x - w / 2)} ${n(y)} L${n(x + w / 2)} ${n(y)} L${n(x + w / 2 + spread)} ${n(foot)} L${n(x - w / 2 - spread)} ${n(foot)} Z' fill='url(#${id}-sheet)'/>`;
  // Streaks: each line pours its dashes down at its own speed.
  const lines = Math.max(3, Math.round(w / (13 * k)));
  let streaks = '';
  for (let i = 0; i < lines; i++) {
    const g = (key: string) => hash01(`${id}:line:${i}:${key}`);
    const u = (i + 0.2 + 0.6 * g('x')) / lines - 0.5;
    const dash = (34 + 50 * g('d')) * k;
    const gap = (22 + 46 * g('g')) * k;
    const speed = (300 + 140 * g('s')) * k;
    streaks +=
      `<line x1='${n(x + u * w)}' y1='${n(y)}' x2='${n(x + u * (w + 2 * spread))}' y2='${n(foot)}'` +
      ` stroke-dasharray='${n(dash)} ${n(gap)}' stroke-dashoffset='${n(-(speed * t + g('o') * (dash + gap)))}' stroke-opacity='${n(0.4 + 0.3 * g('a'))}'/>`;
  }
  out += `<g stroke='#ffffff' stroke-width='${n(3 * k)}' stroke-linecap='round'>${streaks}</g>`;
  out += `<ellipse cx='${n(x)}' cy='${n(y)}' rx='${n(w / 2 + 4 * k)}' ry='${n(7 * k)}' fill='${mix(color, '#ffffff', 0.6)}'/>`;
  // Ripples spreading on the pool.
  for (let i = 0; i < 3; i++) {
    const u = (t / 1.6 + i / 3) % 1;
    const rx = (w / 2 + spread) * (1 + 0.9 * u);
    out += `<ellipse cx='${n(x)}' cy='${n(foot + 6 * k)}' rx='${n(rx)}' ry='${n(rx * 0.16)}' fill='none' stroke='#ffffff' stroke-width='${n(2.5 * k)}' stroke-opacity='${n(0.7 * (1 - u))}'/>`;
  }
  // Mist rising and spreading from the foot.
  for (let i = 0; i < 6; i++) {
    const g = (key: string) => hash01(`${id}:mist:${i}:${key}`);
    const u = (t / 2.4 + i / 6) % 1;
    const mx = x + (g('x') - 0.5) * (w + 2 * spread) * (1 + u);
    const r = (16 + 26 * u) * k;
    out += `<circle cx='${n(mx)}' cy='${n(foot - 50 * u * k)}' r='${n(r)}' fill='#ffffff' fill-opacity='${n(0.4 * (1 - u))}'/>`;
  }
  // Foam churning across the foot.
  const foam = Math.max(5, Math.round((w + 2 * spread) / (15 * k)));
  let puffs = '';
  for (let i = 0; i < foam; i++) {
    const g = (key: string) => hash01(`${id}:foam:${i}:${key}`);
    const fx = x - w / 2 - spread + ((i + 0.2 + 0.6 * g('x')) / foam) * (w + 2 * spread);
    // Churning: each puff swells and bobs on its own beat, some higher in the spray.
    const beat = Math.sin(TAU * (1.6 + 0.8 * g('f')) * t + TAU * g('p'));
    const r = (9 + 11 * g('r')) * k * (1 + 0.25 * beat);
    const fy = foot - (2 + 14 * g('y') + 5 * beat) * k;
    puffs += `<circle cx='${n(fx)}' cy='${n(fy)}' r='${n(r)}'/>`;
  }
  out += `<g fill='#f4fbff'>${puffs}</g>`;
  return `<g class='waterfall'>${out}</g>`;
}

/**
 * The sea between y (the far edge of the band) and y + height (the shore line): rows of
 * small crests that bob and drift, larger and slower toward the shore; every few seconds
 * a long swell rolls in and breaks, and its foam washes up past the shore line and slides
 * back, leaving the sand wet behind it.
 */
function waves(e: Effect, id: string, t: number, W: number, k: number): string {
  const x0 = e.x ?? -40;
  const x1 = e.width !== undefined ? x0 + e.width * k : W + 40;
  const top = e.y;
  const depth = (e.height ?? 120) * k;
  const shore = top + depth;
  const color = e.color ?? '#ffffff';
  let out = '';
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const d = (r + 0.5) / rows; // 0 far, 1 near
    const ry = top + depth * Math.pow(d, 1.3) * 0.85;
    const len = (18 + 40 * d) * k;
    const amp = (2 + 6 * d) * k;
    const gap = (70 + 130 * d) * k;
    const drift = (r % 2 ? -1 : 1) * (6 + 10 * d) * k * t;
    const span = x1 - x0 + gap;
    const marks = Math.ceil(span / gap);
    let row = '';
    for (let i = 0; i < marks; i++) {
      const g = (key: string) => hash01(`${id}:crest:${r}:${i}:${key}`);
      const cx = x0 + ((((i * gap + g('x') * gap * 0.5 + drift) % span) + span) % span);
      // Each crest rises and sinks back in its own time.
      const life = Math.sin(TAU * (0.25 + 0.2 * g('f')) * t + TAU * g('p'));
      if (life <= 0) continue;
      const a = amp * life;
      row += `<path d='M${n(cx - len / 2)} ${n(ry)} Q${n(cx)} ${n(ry - a * 2)} ${n(cx + len / 2)} ${n(ry)}' stroke-opacity='${n(0.35 + 0.5 * life)}'/>`;
    }
    out += `<g stroke-width='${n((1.6 + 1.6 * d) * k)}'>${row}</g>`;
  }
  // The swell: a crest line rolling toward the shore, growing, then breaking into the wash.
  const period = 4.5;
  const u = (t / period) % 1;
  const roll = clamp01(u / 0.7);
  if (u < 0.7) {
    const sy = top + depth * (0.15 + 0.8 * roll);
    const amp = (3 + 9 * roll) * k;
    const wl = (90 + 60 * roll) * k;
    let d = '';
    for (let x = x0; x <= x1 + wl; x += wl / 6) {
      const yy = sy - amp * Math.max(0, Math.sin(TAU * (x / wl) + t));
      d += `${d ? ' L' : 'M'}${n(x)} ${n(yy)}`;
    }
    out += `<path d='${d}' stroke-width='${n((2 + 2.5 * roll) * k)}' stroke-opacity='${n(0.75 * Math.sin(Math.PI * roll))}'/>`;
  }
  // The wash: foam runs up past the shore line after the swell breaks, then slides back.
  const wash = u < 0.7 ? 0 : Math.sin((Math.PI * (u - 0.7)) / 0.3);
  const reach = 18 * k * Math.max(0.15, wash);
  const scallop = 26 * k;
  let edge = `M${n(x0)} ${n(shore)}`;
  for (let x = x0; x <= x1; x += scallop) {
    const bump = reach * (0.75 + 0.25 * Math.sin(x * 0.07 + 2 * t));
    edge += ` Q${n(x + scallop / 2)} ${n(shore + bump * 1.35)} ${n(x + scallop)} ${n(shore + bump * 0.8)}`;
  }
  out +=
    `<path d='M${n(x0)} ${n(shore)} L${n(x1)} ${n(shore)} L${n(x1)} ${n(shore + 22 * k)} L${n(x0)} ${n(shore + 22 * k)} Z' fill='#000000' fill-opacity='0.07' stroke='none'/>` +
    `<path d='${edge} L${n(x1 + scallop)} ${n(shore - 3 * k)} L${n(x0)} ${n(shore - 3 * k)} Z' fill='${color}' fill-opacity='${n(0.55 + 0.3 * wash)}' stroke='none'/>`;
  return `<g class='waves' fill='none' stroke='${color}' stroke-linecap='round'>${out}</g>`;
}

/** A sun: a soft halo that breathes, rays turning slowly and pulsing, and the disc. */
function sun(e: Effect, id: string, t: number, k: number): string {
  const x = e.x ?? 0;
  const y = e.y;
  const r = 55 * e.size * k;
  const disc = e.color ?? '#ffd23f';
  const pulse = Math.sin(TAU * 0.4 * t);
  let rays = '';
  const count = 12;
  for (let i = 0; i < count; i++) {
    const long = i % 2 === 0;
    const len = r * (long ? 0.55 : 0.35) * (1 + 0.12 * Math.sin(TAU * 0.5 * t + i));
    const inner = r * 1.2;
    const half = (TAU / count) * 0.16;
    const a = (TAU * i) / count;
    const p = (ang: number, rad: number) =>
      `${n(x + Math.cos(ang) * rad)} ${n(y + Math.sin(ang) * rad)}`;
    rays += `<path d='M${p(a - half, inner)} L${p(a, inner + len)} L${p(a + half, inner)} Z'/>`;
  }
  return (
    `<g class='sun'>` +
    `<defs><radialGradient id='${id}-halo'><stop offset='0.35' stop-color='#fff3b0' stop-opacity='0.7'/>` +
    `<stop offset='1' stop-color='#fff3b0' stop-opacity='0'/></radialGradient></defs>` +
    `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r * (2.7 + 0.12 * pulse))}' fill='url(#${id}-halo)'/>` +
    `<g transform='rotate(${n(6 * t)} ${n(x)} ${n(y)})' fill='${mix(disc, '#ffffff', 0.25)}' fill-opacity='0.9'>${rays}</g>` +
    `<circle cx='${n(x)}' cy='${n(y)}' r='${n(r)}' fill='${disc}' stroke='${mix(disc, '#e07a00', 0.5)}' stroke-width='${n(3 * k)}'/>` +
    `<circle cx='${n(x - r * 0.3)}' cy='${n(y - r * 0.3)}' r='${n(r * 0.28)}' fill='#ffffff' fill-opacity='0.35'/>` +
    `</g>`
  );
}
