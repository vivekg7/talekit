import { describe, expect, it } from 'vitest';
import { characterBody } from '../src/engine/actor.js';
import { emptyPose } from '../src/engine/motion.js';
import { outlineUnderlay } from '../src/engine/outline.js';
import { CharacterSchema } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const blob = (more: Record<string, unknown> = {}) =>
  CharacterSchema.parse({
    id: 'x',
    name: 'X',
    rig: 'simple',
    parts: {
      body: `<circle cx='100' cy='150' r='50' fill='#c84'/>`,
      eyes: `<circle cx='120' cy='100' r='8' fill='#fff'/>`,
    },
    ...more,
  });
const parts = (svg: string) => [...svg.matchAll(/class='part-([\w-]+)'/g)].map((m) => m[1]);
/** The outline's stroke width in each part, in the character's box units. */
const widths = (svg: string) =>
  Object.fromEntries(
    svg
      .split("<g class='part-")
      .slice(1)
      .map((g) => [g.split("'")[0], Number(g.match(/stroke-width='([\d.]+)'/)?.[1])])
  );

describe('outline underlay', () => {
  it('widens filled shapes and limb strokes, skips faint and thin ones', () => {
    const svg =
      `<ellipse cx='100' cy='150' rx='60' ry='40' fill='#c84'/>` +
      `<path d='M80 180 L80 200' stroke='#c84' stroke-width='14' stroke-linecap='round' fill='none'/>` +
      `<circle cx='70' cy='140' r='8' fill='#f99' opacity='0.5'/>` +
      `<path d='M120 120 L150 110' stroke='#333' stroke-width='2' fill='none'/>`;
    const under = outlineUnderlay(svg, '#111', 5);
    expect(under).toContain(
      `<ellipse cx='100' cy='150' rx='60' ry='40' fill='#111' stroke='#111' stroke-width='10'`
    );
    expect(under).toContain(`stroke-width='24'`); // 14 + 2 × 5
    expect(under.match(/<(ellipse|path|circle)/g)).toHaveLength(2);
  });

  it('inherits fill from groups, keeps transforms, ignores defs and line-coloured strokes', () => {
    const svg =
      `<defs><linearGradient id='g'><stop offset='0' stop-color='#fff'/></linearGradient></defs>` +
      `<g fill='{fur}' transform='rotate(10 100 100)'><circle cx='100' cy='100' r='20'/></g>` +
      `<path d='M0 0 L10 10' stroke='#111' stroke-width='12'/>`;
    expect(outlineUnderlay(svg, '#111', 4)).toBe(
      `<g transform='rotate(10 100 100)'><circle cx='100' cy='100' r='20' fill='#111' stroke='#111' stroke-width='8' stroke-linejoin='round' stroke-linecap='round'/></g>`
    );
  });
});

describe('the outline on a character', () => {
  it('is drawn under each part in the line colour, unless the character turns it off', () => {
    const on = characterBody(blob(), emptyPose());
    expect(on.indexOf(`fill='#2e2633'`)).toBeLessThan(on.indexOf(`fill='#c84'`));
    const own = characterBody(blob({ colors: { line: '#123456' } }), emptyPose());
    expect(own).toContain(`stroke='#123456'`);
    expect(own).not.toContain('#2e2633');
    expect(characterBody(blob({ outline: false }), emptyPose(), null)).not.toContain('stroke=');
  });

  it('is as wide on screen at any height, and half as wide on the eyes and mouth', () => {
    const small = widths(characterBody(blob({ height: 100 }), emptyPose(), null));
    const tall = widths(characterBody(blob({ height: 400 }), emptyPose(), null));
    expect(small.body * 100).toBeCloseTo(tall.body * 400);
    expect(small.eyes).toBeCloseTo(small.body / 2);
  });

  it("joins a quadruped's head and near legs to its body: their line goes under it", () => {
    const order = parts(characterBody(LIBRARY.characters.cat, emptyPose(), null));
    for (const fused of ['head', 'legBR', 'legFR'])
      expect(order.indexOf(`${fused}-line`)).toBeLessThan(order.indexOf('body'));
    expect(order.indexOf('head')).toBeGreaterThan(order.indexOf('body'));
  });
});
