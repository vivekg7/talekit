import { clamp01, easeInOut, hash01, lerp, TAU } from './easing.js';
import { n } from './svg.js';
import type { Camera, Scene, Shot, Weather } from './types.js';

/**
 * Weather the engine animates, as functions of shot time: nothing is stored between frames,
 * so any frame renders on its own and every value comes from `hash01`, never randomness.
 *
 * Falling things (rain, snow) live in depth bands. A band at factor p moves and grows with
 * the camera like a scene layer at that depth, so a pan slides the near drops past faster
 * than the far ones; within its band a drop wraps round the frame, so the frame is always
 * evenly full whatever the camera does.
 */

interface Band {
  p: number;
  /** At amount 0.5 on a 16:9 frame. */
  count: number;
  /** Rain: streak length; snow: flake radius. At 720p and a 1× camera. */
  size: [number, number];
  /** Rain: streak width. */
  width: number;
  /** Screen pixels a second. */
  speed: number;
  opacity: [number, number];
}

type BandName = 'far' | 'back' | 'front';

const RAIN: Record<BandName, Band> = {
  /** Behind the stage: a fine haze that shows only where `svg` leaves the sky out. */
  far: { p: 0.5, count: 110, size: [10, 16], width: 1.2, speed: 700, opacity: [0.2, 0.32] },
  /** Over the scenery, behind the actors. */
  back: { p: 0.9, count: 90, size: [20, 30], width: 1.8, speed: 1150, opacity: [0.3, 0.45] },
  /** In front of the actors: few, so faces read through them. */
  front: { p: 1.5, count: 22, size: [44, 64], width: 2.8, speed: 1750, opacity: [0.32, 0.48] },
};

const SNOW: Record<BandName, Band> = {
  far: { p: 0.5, count: 130, size: [1.6, 2.6], width: 0, speed: 38, opacity: [0.55, 0.75] },
  back: { p: 0.9, count: 100, size: [3, 4.4], width: 0, speed: 62, opacity: [0.8, 0.95] },
  front: { p: 1.5, count: 24, size: [6, 8.5], width: 0, speed: 100, opacity: [0.9, 1] },
};

const RAIN_COLOR = '#e6edf6';
const SNOW_COLOR = '#ffffff';
const LEAF_COLORS = ['#d9822b', '#e8b33a', '#b5542c', '#8fb34a'];
const LINE = '#2e2633';
/** How far a raindrop moves sideways for each pixel it falls, at wind 1. */
const SLANT = 0.5;
/** Rain with no wind given still leans a little; dead-straight rain looks ruled. */
const STILL_SLANT = 0.08;
/** A splash lasts this long, at a random point on the ground, then waits for the next. */
const SPLASH_LIFE = 0.28;
/** Seconds a lightning strike lights the frame. */
const STRIKE_LIFE = 0.6;

export interface WeatherView {
  /** In the far layer's coordinates, over `far`: the clouds and lightning bolts. */
  sky: string;
  /** Screen space, drawn over the far layer: the haze of distant drops. */
  far: string;
  /** World space, over the stage's `svg`: splashes and the drops behind the actors. */
  stage: string;
  /** Screen space, over the actors and under `near`: near drops, gusts, leaves. */
  front: string;
  /** Screen space, over everything but text: the storm's dimming. */
  light: string;
  /** How bright a lightning flash makes the frame now, 0 when there is none. */
  flash: number;
  /** Heat haze: a filter for the far layer, and how far its noise has scrolled. */
  haze?: { defs: string; id: string; scroll: number };
  /** The clouds' grey over the far layer: a filter with id `tk-sky`, absent in fair weather. */
  grade?: string;
}

interface Ctx {
  c: Required<Camera>;
  W: number;
  H: number;
  t: number;
  wind: number;
  k: number;
  /** Shelters on screen, which the drops behind and in front of the actors stop at. */
  cover: Span[];
}

/** A shelter: nothing falls through the span from x0 to x1 at height y. */
export interface Span {
  x0: number;
  x1: number;
  y: number;
  /** Names the shelter from frame to frame, so a drop can find where it let go of it. */
  key?: string;
}

/** The shelters as they stood at an earlier time of the shot, in the scene. */
export type SheltersAt = (t: number) => Span[];

/** Seconds a `weather` action takes to turn the weather when it gives no duration. */
export const WEATHER_TURN = 2;

/**
 * The weather in force at shot time t: the shot's own or the scene's, turned by each
 * `weather` action as it plays. A turn blends every amount from what was there to what is
 * asked (rain absent is rain at 0), so rain thins out drop by drop and clouds roll in.
 */
export function weatherAt(scene: Scene, shot: Shot, t: number): Weather {
  let w: Weather = shot.weather ?? scene.weather ?? {};
  for (const a of shot.actions.filter((a) => a.weather && a.t <= t).sort((a, b) => a.t - b.t)) {
    const u = easeInOut(clamp01((t - a.t) / (a.duration ?? WEATHER_TURN)));
    w = blendWeather(w, a.weather!, u);
  }
  return w;
}

function blendWeather(a: Weather, b: Weather, u: number): Weather {
  if (u >= 1) return b;
  if (u <= 0) return a;
  const num = (x: number | undefined, y: number | undefined) =>
    x === undefined && y === undefined ? undefined : lerp(x ?? 0, y ?? 0, u);
  const fall = <T extends { amount: number }>(x: T | undefined, y: T | undefined): T | undefined =>
    x || y ? ({ ...x, ...y, amount: lerp(x?.amount ?? 0, y?.amount ?? 0, u) } as T) : undefined;
  return {
    rain: fall(a.rain, b.rain),
    snow: fall(a.snow, b.snow),
    leaves: fall(a.leaves, b.leaves),
    clouds:
      a.clouds || b.clouds
        ? {
            low: b.clouds?.low ?? a.clouds?.low,
            amount: lerp(a.clouds?.amount ?? 0, b.clouds?.amount ?? 0, u),
            dark: lerp(a.clouds?.dark ?? b.clouds!.dark, b.clouds?.dark ?? a.clouds!.dark, u),
          }
        : undefined,
    light:
      a.light || b.light
        ? {
            color: mix(a.light?.color ?? b.light!.color, b.light?.color ?? a.light!.color, u),
            amount: lerp(a.light?.amount ?? 0, b.light?.amount ?? 0, u),
          }
        : undefined,
    wind: num(a.wind, b.wind),
    heat: num(a.heat, b.heat),
    scale: b.scale ?? a.scale,
    // A storm's strikes start or stop halfway through the turn.
    lightning: u < 0.5 ? a.lightning : b.lightning,
  };
}

const wrap = (v: number, span: number) => ((v % span) + span) % span;

/** The weather at shot time t, seen through camera c. `ground` is the scene's floor y. */
export function weatherView(
  w: Weather,
  shot: Shot,
  c: Required<Camera>,
  W: number,
  H: number,
  t: number,
  ground: number,
  shelters: Span[] = [],
  sheltersAt?: SheltersAt
): WeatherView {
  const wind = w.wind ?? 0;
  const toScreen = (s: Span): Span => ({
    x0: (s.x0 - c.x) * c.zoom + W / 2,
    x1: (s.x1 - c.x) * c.zoom + W / 2,
    y: (s.y - c.y) * c.zoom + H / 2,
  });
  // A close-up scene drawn large has its rain, snow and leaves drawn large too.
  const ctx: Ctx = {
    c,
    W,
    H,
    t,
    wind,
    k: (H / 720) * (w.scale ?? 1),
    cover: shelters.map(toScreen),
  };
  // A shelter overhead (a bench seat, an awning) stops what falls behind and in front of
  // the actors; the far haze is behind the stage, which hides it there anyway.
  const shelter = (top?: number) => (top === undefined ? -Infinity : (top - c.y) * c.zoom + H / 2);
  let far = '';
  let back = '';
  let front = '';
  let stage = '';
  if (w.rain) {
    const top = shelter(w.rain.top);
    far += rain('far', w.rain.amount, ctx, -Infinity);
    back += rain('back', w.rain.amount, ctx, top);
    front += rain('front', w.rain.amount, ctx, top);
    stage += splashes(w.rain.amount, ctx, ground, shelters);
    stage += drips(w.rain.amount, ctx, shelters, ground, sheltersAt);
  }
  if (w.snow) {
    const top = shelter(w.snow.top);
    far += snow('far', w.snow.amount, ctx, -Infinity);
    back += snow('back', w.snow.amount, ctx, top);
    front += snow('front', w.snow.amount, ctx, top);
  }
  if (w.leaves) front += leaves(w.leaves.amount, w.leaves.colors ?? LEAF_COLORS, ctx);
  if (Math.abs(wind) >= 0.3) front += gusts(ctx);
  // Screen space inside the world group: undo the stage's camera transform.
  const unCamera = `translate(${n(c.x)} ${n(c.y)}) scale(${n(1 / c.zoom)}) translate(${n(-W / 2)} ${n(-H / 2)})`;
  if (back) stage += `<g transform='${unCamera}'>${back}</g>`;

  let sky = '';
  let light = '';
  const low = w.clouds?.low ?? 0.32 * H;
  if (w.clouds) {
    const dark = w.clouds.dark;
    sky += clouds(w.clouds.amount, dark, low, ctx);
    const dim = 0.3 * dark * (0.4 + 0.6 * w.clouds.amount) * clamp01(w.clouds.amount / 0.1);
    if (dim > 0.01)
      light += `<rect width='${W}' height='${H}' fill='#1c2333' opacity='${n(dim)}'/>`;
  }
  let lit = 0;
  for (const ts of strikeTimes(w, shot, t)) {
    const age = t - ts;
    sky += bolt(`${shot.id}:${ts.toFixed(3)}`, age, low, ground, ctx);
    lit = Math.max(lit, flash(age));
  }
  const haze = w.heat ? { ...heatHaze(w.heat, ctx), scroll: 40 * ctx.k * t } : undefined;
  const grade = w.clouds ? skyGrade(w.clouds.amount, w.clouds.dark, W, H) : undefined;
  return { sky, far, stage, front, light, flash: lit > 0.01 ? lit : 0, haze, grade };
}

/**
 * How the clouds grey the sky: a filter over the far layer that washes the colour out as
 * they cover it and darkens it under storm clouds. The scene paints a fair sky, and a
 * `weather` turn that clears the clouds brings its blue back. Screen space.
 */
export function skyGrade(amount: number, dark: number, W: number, H: number): string | undefined {
  // Below the least the schema allows, a turn is clearing the sky.
  const fade = clamp01(amount / 0.1);
  const cover = clamp01((amount - 0.3) / 0.6) * fade;
  const storm = dark * fade;
  const saturate = 1 - 0.75 * cover - 0.2 * storm;
  const gain = 1 - 0.06 * cover - 0.22 * storm;
  if (saturate > 0.98 && gain > 0.98) return undefined;
  const fn = (c: string) => `<feFunc${c} type='linear' slope='${n(gain)}'/>`;
  return (
    `<filter id='tk-sky' filterUnits='userSpaceOnUse' x='0' y='0' width='${W}' height='${H}' color-interpolation-filters='sRGB'>` +
    `<feColorMatrix type='saturate' values='${n(Math.max(0, saturate))}'/>` +
    `<feComponentTransfer>${fn('R')}${fn('G')}${fn('B')}</feComponentTransfer></filter>`
  );
}

/** Where drop `i` of a band is on screen (the lower end of a streak), and its size. */
function place(name: string, b: Band, i: number, ctx: Ctx, slant: number) {
  const { c, W, H, t, k } = ctx;
  const h = (key: string) => hash01(`${name}:${i}:${key}`);
  const zp = Math.pow(c.zoom, b.p);
  const grow = Math.min(zp, 2.2) * k;
  const size = lerp(b.size[0], b.size[1], h('l')) * grow;
  const speed = b.speed * (0.85 + 0.3 * h('s')) * grow;
  const reach = Math.max(size, 8 * k);
  const spanY = H + reach * 2;
  const margin = Math.abs(slant) * spanY + reach + 40 * k;
  const spanX = W + 2 * margin;
  // The band's drift with the camera, as a layer at depth p sees it.
  const fall = h('y') * spanY + speed * t - b.p * (c.y - H / 2) * zp;
  const y = wrap(fall, spanY) - reach;
  const x = wrap(h('x') * spanX + slant * fall - b.p * (c.x - W / 2) * zp, spanX) - margin;
  return { x, y, size, grow, h };
}

const rainSlant = (ctx: Ctx) => (ctx.wind ? ctx.wind * SLANT : STILL_SLANT);

/**
 * Where a falling streak ending at (x, y) and `len` long stops, given shelters: wholly under
 * one (below it, where its slanted path crosses the span) it is gone; crossing one, it ends
 * on it. Undefined when it is gone.
 */
function stopAt(cover: Span[], x: number, y: number, len: number, slant: number) {
  let end = { x, y };
  for (const s of cover) {
    if (end.y <= s.y) continue;
    const cross = end.x - slant * (end.y - s.y);
    if (cross < s.x0 || cross > s.x1) continue;
    if (end.y - len >= s.y) return undefined;
    end = { x: cross, y: s.y };
  }
  return end;
}

/**
 * Water running off the ends of each shelter: a drop gathers at the edge, lets go and falls,
 * speeding up, until it reaches the floor; then the next one gathers. A falling drop is free
 * of its shelter: it falls from where the edge was when it let go, so one off a moving
 * umbrella stays behind rather than keeping up with it.
 */
function drips(
  amount: number,
  ctx: Ctx,
  shelters: Span[],
  ground: number,
  sheltersAt?: SheltersAt
): string {
  const { t, k, H } = ctx;
  const floor = Math.min(ground + 0.04 * H, H);
  const then = new Map<number, Span[]>();
  const heldAt = (key: string, tr: number) => {
    if (!then.has(tr)) then.set(tr, sheltersAt!(tr));
    return then.get(tr)!.find((s) => s.key === key);
  };
  let out = '';
  let edge = '';
  shelters.forEach((s, i) => {
    const id = s.key ?? String(i);
    for (const end of ['l', 'r'] as const) {
      const h = (key: string) => hash01(`drip:${id}:${end}:${key}`);
      const period = (0.9 - 0.4 * amount) * (0.8 + 0.4 * h('T'));
      const age = ((t / period + h('p')) % 1) * period;
      const gather = period * 0.45;
      if (age < gather) {
        // Swelling on the edge.
        const x = end === 'l' ? s.x0 : s.x1;
        const r = (1.5 + 2.5 * (age / gather)) * k;
        out += `<circle cx='${n(x)}' cy='${n(s.y + r)}' r='${n(r)}' stroke='none' fill-opacity='0.9'/>`;
        edge += `<circle cx='${n(x)}' cy='${n(s.y + r)}' r='${n(r + 0.8 * k)}'/>`;
        continue;
      }
      const a = age - gather;
      // Where it let go. A shelter that was not there then (an umbrella just opened) has
      // no drop falling from it yet.
      const from = s.key && sheltersAt ? heldAt(s.key, t - a) : s;
      if (!from) continue;
      const x = end === 'l' ? from.x0 : from.x1;
      const fall = 0.5 * 2600 * k * a * a;
      const y = from.y + 4 * k + fall;
      if (y > floor) continue;
      const len = Math.min(24 * k, 5 * k + fall * 0.3);
      const dx = ctx.wind * fall * 0.3;
      const line = `<line x1='${n(x + dx * 0.9)}' y1='${n(y - len)}' x2='${n(x + dx)}' y2='${n(y)}'`;
      out += `${line} stroke-opacity='0.9'/>`;
      edge += `${line}/>`;
    }
  });
  if (!out) return '';
  return (
    `<g class='rain-drips' stroke-linecap='round'>` +
    `<g stroke='#3d4c60' stroke-opacity='0.25' fill='#3d4c60' fill-opacity='0.25' stroke-width='${n(4.6 * k)}'>${edge}</g>` +
    `<g stroke='${RAIN_COLOR}' fill='${RAIN_COLOR}' stroke-width='${n(3 * k)}'>${out}</g></g>`
  );
}

const bandCount = (b: Band, amount: number, ctx: Ctx) =>
  Math.round(b.count * (amount / 0.5) * (ctx.W / ctx.H / (16 / 9)));

function rain(name: BandName, amount: number, ctx: Ctx, top: number): string {
  const b = RAIN[name];
  const slant = rainSlant(ctx);
  let out = '';
  let edge = '';
  let width = 0;
  for (let i = 0, count = bandCount(b, amount, ctx); i < count; i++) {
    const { x, y, size: len, grow, h } = place(`rain:${name}`, b, i, ctx, slant);
    width = b.width * grow;
    if (y <= top) continue;
    const end = name === 'far' ? { x, y } : stopAt(ctx.cover, x, y, len, slant);
    if (!end) continue;
    const y0 = Math.max(y - len, top);
    const x0 = x - slant * (y - y0);
    const o = lerp(b.opacity[0], b.opacity[1], h('o'));
    const line = `<line x1='${n(x0)}' y1='${n(y0)}' x2='${n(end.x)}' y2='${n(end.y)}'`;
    out += `${line} stroke-opacity='${n(o)}'/>`;
    edge += `${line}/>`;
  }
  if (!out) return '';
  // A faint dark edge under each streak, so rain still reads against a pale wall or sky.
  const under =
    name === 'far'
      ? ''
      : `<g stroke='#3d4c60' stroke-opacity='0.16' stroke-width='${n(width + 1.6 * ctx.k)}'>${edge}</g>`;
  return `<g class='rain-${name}' stroke-linecap='round'>${under}<g stroke='${RAIN_COLOR}' stroke-width='${n(width)}'>${out}</g></g>`;
}

function snow(name: BandName, amount: number, ctx: Ctx, top: number): string {
  const b = SNOW[name];
  // Snow is light: the wind carries it much further than it slants rain.
  const slant = ctx.wind * 1.6;
  let out = '';
  for (let i = 0, count = bandCount(b, amount, ctx); i < count; i++) {
    const { x, y, size: r, grow, h } = place(`snow:${name}`, b, i, ctx, slant);
    if (y <= top) continue;
    // Each flake sways on its own rhythm as it falls.
    const sway =
      (8 + 10 * h('a')) * grow * Math.sin(TAU * (0.35 + 0.4 * h('f')) * ctx.t + TAU * h('p'));
    if (name !== 'far' && !stopAt(ctx.cover, x + sway, y, 0, slant)) continue;
    const o = lerp(b.opacity[0], b.opacity[1], h('o'));
    out += `<circle cx='${n(x + sway)}' cy='${n(y)}' r='${n(r)}' fill-opacity='${n(o)}'/>`;
  }
  if (!out) return '';
  return `<g class='snow-${name}' fill='${SNOW_COLOR}'>${out}</g>`;
}

/**
 * Rings on the ground where drops land, each slot firing at its own rate at a new spot,
 * on the floor band around `ground`: nearer the camera (lower) is bigger.
 */
function splashes(amount: number, ctx: Ctx, ground: number, shelters: Span[]): string {
  const { W, H, t, k } = ctx;
  const slots = Math.round(30 * (amount / 0.5) * (W / H / (16 / 9)));
  let out = '';
  for (let i = 0; i < slots; i++) {
    const period = 0.45 + 0.35 * hash01(`splash:${i}:T`);
    const cycle = t / period + hash01(`splash:${i}:p`);
    const at = Math.floor(cycle);
    const u = ((cycle - at) * period) / SPLASH_LIFE;
    if (u >= 1) continue;
    const d = hash01(`splash:${i}:${at}:y`);
    const x = hash01(`splash:${i}:${at}:x`) * (W + 80) - 40;
    const y = Math.min(ground - 0.03 * H + d * 0.11 * H, H - 4 * k);
    // Dry ground under a shelter.
    if (!stopAt(shelters, x, y, 0, rainSlant(ctx))) continue;
    const s = (0.8 + 0.7 * d) * k;
    const rx = s * (4 + 11 * u);
    const lift = 14 * s * 4 * u * (1 - u);
    const o = 0.9 * (1 - u);
    out +=
      `<ellipse fill='none' cx='${n(x)}' cy='${n(y)}' rx='${n(rx)}' ry='${n(rx * 0.3)}' stroke-width='${n(2 * s)}' stroke-opacity='${n(o)}'/>` +
      `<circle stroke='none' cx='${n(x - 6 * s * u)}' cy='${n(y - lift)}' r='${n(1.8 * s)}' fill-opacity='${n(o)}'/>` +
      `<circle stroke='none' cx='${n(x + 7 * s * u)}' cy='${n(y - lift * 0.8)}' r='${n(1.5 * s)}' fill-opacity='${n(o)}'/>`;
  }
  if (!out) return '';
  // Per-element opacity rather than a group's: resvg 2.6 can panic on nested opacity groups.
  return `<g class='rain-splash' fill='${RAIN_COLOR}' stroke='${RAIN_COLOR}'>${out}</g>`;
}

/** Leaves tumbling down and across, turning over as they go. Screen space, in front. */
function leaves(amount: number, colors: string[], ctx: Ctx): string {
  const { W, H, t, k, wind } = ctx;
  const count = Math.round(14 * (amount / 0.5) * (W / H / (16 / 9)));
  const drift = (40 + 260 * Math.abs(wind)) * (wind < 0 ? -1 : 1);
  let out = '';
  for (let i = 0; i < count; i++) {
    const h = (key: string) => hash01(`leaf:${i}:${key}`);
    const grow = (1.3 + 1.1 * h('z')) * k;
    const spanY = H + 60 * k;
    const spanX = W + 120 * k;
    const y = wrap(h('y') * spanY + (45 + 40 * h('s')) * grow * t, spanY) - 30 * k;
    const sway = 30 * grow * Math.sin(TAU * (0.3 + 0.3 * h('f')) * t + TAU * h('p'));
    const x = wrap(h('x') * spanX + drift * grow * t + sway, spanX) - 60 * k;
    const spin = h('r') * 360 + (90 + 160 * h('w')) * t * (h('d') < 0.5 ? -1 : 1);
    // Turning over: the leaf narrows to its edge and back.
    const flip = 0.25 + 0.75 * Math.abs(Math.cos(TAU * (0.4 + 0.5 * h('q')) * t + TAU * h('e')));
    const color = colors[Math.floor(h('c') * colors.length)];
    out +=
      `<g transform='translate(${n(x)} ${n(y)}) rotate(${n(spin % 360)}) scale(${n(grow * flip)} ${n(grow)})'>` +
      `<path d='M0 -9 Q7 -2 0 9 Q-7 -2 0 -9 Z' fill='${color}' stroke='${LINE}' stroke-width='1.4' stroke-linejoin='round'/>` +
      `<path d='M0 -6 L0 7' stroke='${LINE}' stroke-width='0.9' stroke-opacity='0.6'/></g>`;
  }
  return `<g class='leaves'>${out}</g>`;
}

/**
 * Gusts: wavy white streaks blowing across the frame the way the wind goes, some curling
 * at the head, each fading in and out over its run. How many grows with the wind.
 */
function gusts(ctx: Ctx): string {
  const { W, H, t, k, wind } = ctx;
  const dir = wind < 0 ? -1 : 1;
  const strength = Math.abs(wind);
  const slots = Math.round(2 + 6 * strength);
  const speed = (380 + 520 * strength) * k;
  const life = 1.5;
  let out = '';
  for (let i = 0; i < slots; i++) {
    const period = 2.2 + 1.8 * hash01(`gust:${i}:T`);
    const cycle = t / period + hash01(`gust:${i}:p`);
    const at = Math.floor(cycle);
    const age = (cycle - at) * period;
    if (age >= life) continue;
    const g = (key: string) => hash01(`gust:${i}:${at}:${key}`);
    const len = (150 + 140 * g('l')) * k;
    const y0 = (0.12 + 0.62 * g('y')) * H;
    // Start anywhere over the upwind 70% of the frame, so the run ends inside it.
    const from = g('x') * W * 0.7;
    const head = (dir > 0 ? from : W - from) + dir * speed * age;
    const amp = (6 + 6 * g('a')) * k;
    const wl = (55 + 30 * g('w')) * k;
    const pts: [number, number][] = [];
    const steps = 14;
    for (let j = 0; j <= steps; j++) {
      const s = j / steps; // 0 at the tail, 1 at the head
      const x = head - dir * len * (1 - s);
      pts.push([x, y0 + amp * Math.sin(TAU * (x / wl) - 7 * t) * (0.4 + 0.6 * s)]);
    }
    let d = 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L');
    if (g('c') < 0.5) {
      // A curl at the head: up, round and back under itself.
      const [hx, hy] = pts[pts.length - 1];
      const r = 13 * k;
      d += ` C${n(hx + dir * r * 1.6)} ${n(hy)} ${n(hx + dir * r * 1.6)} ${n(hy - r * 2)} ${n(hx + dir * r * 0.4)} ${n(hy - r * 1.8)}`;
      d += ` C${n(hx - dir * r * 0.6)} ${n(hy - r * 1.6)} ${n(hx - dir * r * 0.2)} ${n(hy - r * 0.6)} ${n(hx + dir * r * 0.5)} ${n(hy - r * 0.8)}`;
    }
    out += `<path d='${d}' stroke-opacity='${n(0.55 * Math.sin((Math.PI * age) / life))}'/>`;
  }
  if (!out) return '';
  return `<g class='gusts' fill='none' stroke='#ffffff' stroke-width='${n(3 * k)}' stroke-linecap='round' stroke-linejoin='round'>${out}</g>`;
}

/**
 * Clouds drifting across the sky band (the top of the frame down to `low`), in the far
 * layer's coordinates. Each is a fixed lump of puffs over a flat, shaded base; they move
 * with the wind, or slowly right in still air, and wrap round past the frame's edges.
 */
function clouds(amount: number, dark: number, low: number, ctx: Ctx): string {
  const { W, t, k, wind } = ctx;
  // Below the least the schema allows, a turn is clearing the sky: the clouds fade out.
  const fade = clamp01(amount / 0.1);
  const speed = (wind ? wind * 40 : 6) * k;
  const span = W + 700 * k;
  const top = mix('#ffffff', '#6f7787', dark);
  const base = mix('#dfe5ee', '#4f5666', dark);
  let out = '';
  // A storm darkens the sky over the clouds as well as the clouds themselves.
  if (dark > 0.05)
    out +=
      `<defs><linearGradient id='tk-storm-sky' x1='0' y1='0' x2='0' y2='1'>` +
      `<stop offset='0' stop-color='#2a3040' stop-opacity='${n(0.75 * dark * fade)}'/>` +
      `<stop offset='1' stop-color='#2a3040' stop-opacity='0'/></linearGradient></defs>` +
      `<rect x='${n(-W)}' y='${n(-200 * k)}' width='${n(3 * W)}' height='${n(low + 320 * k)}' fill='url(#tk-storm-sky)'/>`;
  // Ten fixed slots along the band, so a cloud keeps its place as the sky fills or clears;
  // `amount` says how many show, taken in an order that keeps any number spread out, and
  // the last one in or out fades.
  const shown = 3 + 7 * amount;
  CLOUD_ORDER.forEach((i, rank) => {
    const vis = clamp01(shown - rank) * fade;
    if (vis <= 0.01) return;
    const h = (key: string) => hash01(`cloud:${i}:${key}`);
    const w = (170 + 170 * h('w')) * k * (0.8 + 0.4 * amount);
    const cx = wrap(((i + 0.6 * h('x')) / CLOUD_ORDER.length) * span + speed * t, span) - 350 * k;
    const cy = low - (20 * k + 0.55 * low * h('y'));
    const puffs = 4 + Math.floor(h('n') * 3);
    // The same lump twice: in the shade colour, then lit and nudged up, so the cloud's
    // underside is a darker rim rather than a separate plate.
    const lump = (dy: number, grow: number) => {
      let body = '';
      for (let j = 0; j < puffs; j++) {
        const g = (key: string) => hash01(`cloud:${i}:${j}:${key}`);
        const px = cx - w / 2 + (w * (j + 0.5)) / puffs + (g('x') - 0.5) * 20 * k;
        const r = w * (0.17 + 0.12 * g('r')) * (1 - 0.5 * Math.abs((j + 0.5) / puffs - 0.5));
        body += `<circle cx='${n(px)}' cy='${n(cy - r * 0.45 + dy)}' r='${n(r * grow)}'/>`;
      }
      return (
        body +
        `<ellipse cx='${n(cx)}' cy='${n(cy + dy)}' rx='${n((w / 2) * grow)}' ry='${n(w * 0.12 * grow)}'/>`
      );
    };
    const op = vis < 1 ? ` opacity='${n(vis)}'` : '';
    out += `<g${op}><g fill='${base}'>${lump(0, 1)}</g><g fill='${top}'>${lump(-w * 0.05, 0.94)}</g></g>`;
  });
  return `<g class='clouds'>${out}</g>`;
}

/** Cloud slots in the order they fill the sky: any first n of them are spread along it. */
const CLOUD_ORDER = [0, 5, 2, 7, 4, 9, 1, 6, 3, 8];

/** Hex colour a toward b by u. */
export function mix(a: string, b: string, u: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const hex = pa.map((v, i) =>
    Math.round(lerp(v, pb[i], clamp01(u)))
      .toString(16)
      .padStart(2, '0')
  );
  return '#' + hex.join('');
}

/** Strikes still lighting the frame at t: the shot's `lightning` actions and the weather's. */
export function strikeTimes(w: Weather | undefined, shot: Shot, t: number): number[] {
  const out = shot.actions
    .filter((a) => a.lightning && a.t <= t && t - a.t < STRIKE_LIFE)
    .map((a) => a.t);
  if (w?.lightning) {
    const every = w.lightning.every;
    for (let i = Math.max(0, Math.floor(t / every) - 1); i <= Math.floor(t / every); i++) {
      const ts = strikeAt(shot.id, every, i);
      if (ts <= t && t - ts < STRIKE_LIFE) out.push(ts);
    }
  }
  return out;
}

/** When the weather's i-th strike of a shot falls: once in each `every` seconds, at random. */
export const strikeAt = (shotId: string, every: number, i: number): number =>
  (i + 0.3 + 0.6 * hash01(`${shotId}:strike:${i}`)) * every;

/** The frame's brightening after a strike, 0..1: a hard flash, a dip, a second flicker. */
function flash(age: number): number {
  if (age < 0) return 0;
  const first = age < 0.03 ? age / 0.03 : Math.exp(-(age - 0.03) / 0.06);
  const second = Math.exp(-Math.pow((age - 0.16) / 0.04, 2));
  return Math.min(1, first + 0.6 * second);
}

/**
 * A flash brightens the frame rather than whitening it: every channel is multiplied up and
 * lifted a little, so the scene keeps its contrast and reads as lit by the bolt, where a
 * white sheet over it reads as fog.
 */
export function flashFilter(id: string, f: number, W: number, H: number): string {
  const fn = (c: string) =>
    `<feFunc${c} type='linear' slope='${n(1 + 0.8 * f)}' intercept='${n(0.12 * f)}'/>`;
  return (
    `<filter id='${id}' filterUnits='userSpaceOnUse' x='0' y='0' width='${W}' height='${H}' color-interpolation-filters='sRGB'>` +
    `<feComponentTransfer>${fn('R')}${fn('G')}${fn('B')}</feComponentTransfer></filter>`
  );
}

/**
 * A jagged bolt from under the clouds toward the ground, with a branch or two, drawn in
 * the far layer so the stage hides where it lands. It flickers: on, off, on again.
 */
function bolt(key: string, age: number, low: number, ground: number, ctx: Ctx): string {
  const visible = (age >= 0 && age < 0.09) || (age > 0.13 && age < 0.24);
  if (!visible) return '';
  const { W, k } = ctx;
  const h = (s: string) => hash01(`bolt:${key}:${s}`);
  const path = (sx: number, sy: number, ey: number, tag: string, lean: number) => {
    let x = sx;
    let y = sy;
    let d = `M${n(x)} ${n(y)}`;
    const forks: [number, number][] = [];
    for (let i = 0; y < ey; i++) {
      y += (26 + 26 * h(`${tag}:dy${i}`)) * k;
      x += ((h(`${tag}:dx${i}`) - 0.5) * 52 + lean) * k;
      d += ` L${n(x)} ${n(Math.min(y, ey))}`;
      if (i === 1 || i === 3) forks.push([x, y]);
    }
    return { d, forks };
  };
  const main = path((0.15 + 0.7 * h('x')) * W, low - 30 * k, ground, 'm', 0);
  let d = main.d;
  main.forks.forEach(([bx, by], i) => {
    const side = h(`side${i}`) < 0.5 ? -1 : 1;
    d += ' ' + path(bx, by, by + (60 + 50 * h(`blen${i}`)) * k, `b${i}`, side * 18).d;
  });
  return (
    `<g class='lightning' fill='none' stroke-linejoin='round' stroke-linecap='round'>` +
    `<path d='${d}' stroke='#cfe0ff' stroke-opacity='0.45' stroke-width='${n(12 * k)}'/>` +
    `<path d='${d}' stroke='#ffffff' stroke-width='${n(3.5 * k)}'/></g>`
  );
}

/**
 * Heat haze over the far layer: the scenery is pushed about by a noise that scrolls upward.
 * The noise is fixed to the filtered group's own coordinates, so the composer draws the far
 * layer inside a group shifted down by the scroll and puts the filter on one shifted back.
 */
function heatHaze(heat: number, ctx: Ctx): { defs: string; id: string } {
  const id = 'tk-heat';
  const defs =
    `<filter id='${id}' x='-5%' y='-5%' width='110%' height='110%' color-interpolation-filters='sRGB'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.004 0.045' numOctaves='2' seed='3' result='noise'/>` +
    `<feDisplacementMap in='SourceGraphic' in2='noise' scale='${n(12 * heat * ctx.k)}' xChannelSelector='R' yChannelSelector='G'/></filter>`;
  return { defs, id };
}
