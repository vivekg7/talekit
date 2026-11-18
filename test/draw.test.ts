import { describe, expect, it } from 'vitest';
import { colorAlong, effectsSvg } from '../src/engine/effects.js';
import { EffectSchema } from '../src/engine/types.js';

const line = (extra: Record<string, unknown> = {}) =>
  EffectSchema.parse({
    kind: 'draw',
    points: Array.from({ length: 11 }, (_, i) => [i * 10, 0]),
    start: 1,
    duration: 2,
    ...extra,
  });
const svg = (e = line(), t = 2, zoom = 1) => effectsSvg([e], 'stage', t, 0, 1280, 720, { zoom });
/** The x of every point drawn, in order. */
const xs = (s: string) =>
  [...s.matchAll(/points='([^']*)'/g)].flatMap((m) =>
    m[1].split(' ').map((p) => Number(p.split(',')[0]))
  );

describe('draw effect', () => {
  it('needs points and no x or y', () => {
    expect(EffectSchema.safeParse({ kind: 'draw' }).success).toBe(false);
    expect(line().start).toBe(1);
  });
  it('draws nothing before the pen starts, half halfway, and all of it after', () => {
    expect(svg(line(), 0.5)).toBe('');
    expect(Math.max(...xs(svg(line(), 2)))).toBeCloseTo(50, 6);
    expect(Math.max(...xs(svg(line(), 2.3)))).toBeCloseTo(65, 6);
    expect(Math.max(...xs(svg(line(), 9)))).toBe(100);
  });
  it('glows at the tip while drawing and the glow fades once it is done', () => {
    expect(svg(line(), 2)).toContain("<circle cx='50'");
    expect(svg(line(), 9)).not.toContain('<circle');
    expect(svg(line({ pen: false }), 2)).not.toContain('<circle');
  });
  it('keeps what it drew in the colour it was drawn in', () => {
    const e = line({ colors: ['#ff0000', '#0000ff'] });
    const early = svg(e, 2).match(/stroke='(#[0-9a-f]{6})'/)![1];
    const late = svg(e, 9).match(/stroke='(#[0-9a-f]{6})'/)![1];
    expect(late).toBe(early);
    expect(colorAlong(['#ff0000', '#0000ff'], 0.5)).toBe('#800080');
    expect(colorAlong(['#ff0000', '#0000ff'], 1)).toBe('#0000ff');
  });
  it('keeps a fixed width on screen at any zoom', () => {
    const w = (s: string) => Number(s.match(/stroke-width='([\d.]+)'/)![1]);
    const fixed = line({ fixedWidth: true, width: 2 });
    expect(w(svg(fixed, 2, 4))).toBeCloseTo(0.5, 6);
    expect(w(svg(line({ width: 2 }), 2, 4))).toBeCloseTo(2, 6);
  });
  it('shows whole on the scene sheet', () => {
    const s = effectsSvg([line()], 'stage', 0, 0, 1280, 720, { finished: true });
    expect(Math.max(...xs(s))).toBe(100);
  });
});
