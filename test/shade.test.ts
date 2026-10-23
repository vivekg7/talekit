import { describe, expect, it } from 'vitest';
import { characterBody } from '../src/engine/actor.js';
import { emptyPose } from '../src/engine/motion.js';
import { DAYLIGHT } from '../src/engine/shade.js';
import { CharacterSchema } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const blob = CharacterSchema.parse({
  id: 'x',
  name: 'X',
  rig: 'simple',
  parts: {
    body: `<circle cx='100' cy='120' r='60' fill='#c84'/><path d='M70 110 L90 112' stroke='#2e2633' stroke-width='3' fill='none'/>`,
    eyes: `<circle cx='120' cy='100' r='8' fill='#fff'/>`,
  },
});

/** The nudge of each shade mask's lit copy, in the part's frame. */
const nudges = (svg: string) =>
  [
    ...svg.matchAll(
      /<mask id='tk-shade-[^']+'[^>]*><rect[^>]*\/><g transform='translate\(([-\d.]+) ([-\d.]+)\)'>/g
    ),
  ].map((m) => [Number(m[1]), Number(m[2])]);

describe('shading', () => {
  it('shades each solid part away from the light, and leaves the face and line work alone', () => {
    const svg = characterBody(blob, emptyPose());
    const [[x, y]] = nudges(svg);
    // The lit copy moves toward the light (up and left by day), so the shade is down and right.
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    // One mask: the body. The eyes are face, the stroke is line work.
    expect(nudges(svg)).toHaveLength(1);
    expect(svg.match(/<mask id='tk-shade-[^']+'.*?<\/mask>/)![0]).not.toContain('M70 110');
  });

  it('keeps the light in the world when the actor is mirrored or a part turns', () => {
    const [[right]] = nudges(characterBody(blob, emptyPose(), DAYLIGHT, 1));
    const [[left]] = nudges(characterBody(blob, emptyPose(), DAYLIGHT, -1));
    expect(left).toBeCloseTo(-right);
    // A body turned upside down (a spin) has its light from below in its own frame.
    const spun = { ...emptyPose(), spin: 180 };
    const [[, y]] = nudges(characterBody(blob, spun));
    expect(y).toBeGreaterThan(0);
  });

  it('can be turned off, and draws nothing with no light', () => {
    expect(characterBody({ ...blob, shade: false }, emptyPose())).not.toContain('tk-shade-');
    expect(characterBody(blob, emptyPose(), null)).not.toContain('tk-shade-');
  });

  it("shades a quadruped's head and body as one shape", () => {
    const cat = LIBRARY.characters.cat;
    const svg = characterBody(cat, emptyPose());
    const head = svg.split("class='part-head'")[1];
    const mask = head.match(/<mask id='tk-shade-[^']+'.*?<\/mask>/)![0];
    // The body's silhouette, carried into the head's frame, is in the head's mask.
    expect(mask).toContain("<g transform='rotate(");
  });
});
