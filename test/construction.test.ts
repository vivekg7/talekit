import { describe, expect, it } from 'vitest';
import { characterBody } from '../src/engine/actor.js';
import { emptyPose } from '../src/engine/motion.js';
import { outlineUnderlay } from '../src/engine/outline.js';
import { CharacterSchema } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { lintCharacter, topLevelPieces } from '../src/project/construction.js';
import { validateCharacter } from '../src/project/validate.js';
import { constructionSheetSvg } from '../src/render/sheets.js';
import { rasterize } from '../src/render/raster.js';

const blob = (parts: Record<string, string>, rig: 'simple' | 'humanoid' = 'simple') =>
  CharacterSchema.parse({ id: 'x', name: 'X', rig, parts });

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
    const under = outlineUnderlay(svg, '#111', 4);
    expect(under).toBe(
      `<g transform='rotate(10 100 100)'><circle cx='100' cy='100' r='20' fill='#111' stroke='#111' stroke-width='8' stroke-linejoin='round' stroke-linecap='round'/></g>`
    );
  });

  it('is drawn under each part unless the character turns it off', () => {
    const c = blob({ body: `<circle cx='100' cy='150' r='50' fill='#c84'/>` });
    const on = characterBody(c, emptyPose());
    expect(on.indexOf(`fill='#2e2633'`)).toBeLessThan(on.indexOf(`fill='#c84'`));
    const off = characterBody({ ...c, outline: false }, emptyPose());
    expect(off).not.toContain('#2e2633');
  });
});

describe('construction linter', () => {
  it('splits a fragment into its top-level pieces', () => {
    expect(
      topLevelPieces(
        `<circle r='1'/><g fill='red'><rect width='2'/><path d='M0 0'></path></g><ellipse/>`
      )
    ).toEqual([
      `<circle r='1'/>`,
      `<g fill='red'><rect width='2'/><path d='M0 0'></path></g>`,
      `<ellipse/>`,
    ]);
  });

  it('is an error to draw outside the box', () => {
    const c = blob({
      body: `<circle cx='100' cy='170' r='30' fill='#c84'/><rect x='150' y='150' width='70' height='50' fill='#c84'/>`,
    });
    const errors = validateCharacter(c).filter((p) => p.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/sticks out of the 200×200 box \(20 units right\)/);
  });

  it('finds the leg that only touches the body, and the one that floats', () => {
    const c = blob({
      body:
        `<ellipse cx='100' cy='120' rx='70' ry='40' fill='#c84'/>` +
        `<rect x='50' y='130' width='16' height='70' fill='#c84'/>` + // sunk 26 in: fine
        `<rect x='120' y='157' width='16' height='43' fill='#c84'/>` + // grazes the edge
        `<rect x='176' y='170' width='14' height='30' fill='#c84'/>`, // misses the body
    });
    const { problems, marks } = lintCharacter(c);
    const messages = problems.map((p) => p.message);
    expect(
      messages.some((m) => m.includes(`x='120'`) && m.includes('overlaps the rest by only'))
    ).toBe(true);
    expect(messages.some((m) => m.includes(`x='176'`) && m.includes('does not touch'))).toBe(true);
    expect(messages.some((m) => m.includes(`x='50'`))).toBe(false);
    expect(marks).toHaveLength(2);
  });

  it('checks humanoid joints and feet', () => {
    const c = blob(
      {
        torso: `<rect x='70' y='150' width='60' height='130' fill='#48c'/>`,
        head: `<circle cx='100' cy='100' r='50' fill='#fc9'/>`, // ends at 150: neck not inside
        legL: `<path d='M86 290 L86 360' stroke='#333' stroke-width='20' stroke-linecap='round'/>`,
        legR: `<path d='M114 272 L114 392' stroke='#333' stroke-width='20' stroke-linecap='round'/>`,
      },
      'humanoid'
    );
    const messages = lintCharacter(c)
      .problems.map((p) => p.message)
      .join('\n');
    expect(messages).toMatch(/the neck reaches only \d+ units into the head/);
    expect(messages).toMatch(/'legL' does not start at its pivot \(86,272\)/);
    expect(messages).toMatch(/'legL' ends at y=370/);
    expect(messages).not.toMatch(/legR/);
  });

  it('asks for a nose or cheeks drawn in the head to move into the turning face', () => {
    const c = blob(
      {
        torso: `<rect x='70' y='130' width='60' height='160' fill='#48c'/>`,
        head: `<circle cx='100' cy='96' r='54' fill='#fc9'/><circle cx='72' cy='114' r='9' fill='#f88' opacity='0.5'/><path d='M102 99 Q108 105 101 108' stroke='#333' stroke-width='3' fill='none'/><path d='M60 60 Q100 30 140 60' stroke='#531' stroke-width='4' fill='none'/>`,
      },
      'humanoid'
    );
    const turning = lintCharacter(c)
      .problems.map((p) => p.message)
      .filter((m) => m.includes('will not turn'));
    // The cheek and the nose; the hair line is not on the face.
    expect(turning).toHaveLength(2);
    expect(turning[0]).toMatch(/move it into the 'face' part/);
  });

  it('passes the library characters and draws their construction sheets', () => {
    for (const c of Object.values(LIBRARY.characters)) {
      expect(lintCharacter(c).problems.map((p) => p.message)).toEqual([]);
      const png = rasterize(constructionSheetSvg(c), 600);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
    }
  });
});
