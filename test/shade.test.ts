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

describe('bent limbs', () => {
  const cat = LIBRARY.characters.cat;
  const bent = (deg: number) => {
    const pose = emptyPose();
    pose.bend.legFR = deg;
    return characterBody(cat, pose).split("class='part-legFR'")[1].split("class='part-")[0];
  };
  /** The content of one clipped half, by its clip id suffix. */
  const half = (svg: string, key: string) =>
    svg.split(`clip-path='url(#tk-bend-cat-legFR-${key})'>`)[1].split('</g>')[0];
  const whole = (deg: number) => {
    const pose = emptyPose();
    pose.bend.legFR = deg;
    return characterBody(cat, pose);
  };

  it('keeps the paw out of the upper half, so no sliver of it shows by the knee', () => {
    const svg = whole(50);
    expect(half(svg, 'uf')).not.toContain('<ellipse');
    expect(half(svg, 'lf')).toContain('<ellipse');
    // Nor the paw's outline in the upper outline half.
    expect(half(svg, 'ul')).not.toContain('<ellipse');
  });

  it("bends a near leg's outline with it, drawn under the body it grows out of", () => {
    const svg = whole(50);
    const line = svg.indexOf("class='part-legFR-line'");
    expect(line).toBeGreaterThan(-1);
    expect(line).toBeLessThan(svg.indexOf("class='part-body'"));
    // The outline halves sit in the line group, the fills in the leg's own.
    expect(svg.slice(line, svg.indexOf("class='part-body'"))).toContain('tk-bend-cat-legFR-ll');
    expect(bent(50)).not.toContain('tk-bend-cat-legFR-ul');
  });

  it('shades the lower half as it lies, turned by the bend', () => {
    // One shade mask per half; the lower half's light is turned 60° round from the upper's.
    const [[ux, uy], [lx, ly]] = nudges(bent(60));
    const angle = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
    expect(Math.abs(angle(ux, uy) - angle(lx, ly) - 60)).toBeLessThan(0.5);
  });
});

describe('verticalExtent', () => {
  it('measures shapes with their stroke, and gives up on what it cannot read', async () => {
    const { verticalExtent } = await import('../src/engine/svg.js');
    expect(verticalExtent(`<ellipse cx='5' cy='190' rx='10' ry='8' fill='#000'/>`)).toEqual([
      182, 198,
    ]);
    expect(
      verticalExtent(`<path d='M10 130 L11 189' stroke='#000' stroke-width='14' fill='none'/>`)
    ).toEqual([123, 196]);
    expect(verticalExtent(`<path d='M10 130 l1 59' fill='#000'/>`)).toBeUndefined();
    expect(verticalExtent(`<g><circle cx='1' cy='1' r='1'/></g>`)).toBeUndefined();
  });
});
