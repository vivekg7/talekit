import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import { swayAngle, swayLayer } from '../src/engine/sway.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { sceneSheetSvg } from '../src/render/sheets.js';
import { validateScene } from '../src/project/validate.js';

const ART =
  `<rect x='0' y='600' width='1280' height='120' fill='green'/>` +
  `<g id='crown'><circle cx='300' cy='300' r='150' fill='green'/></g>` +
  `<g id='tuft' transform='translate(5 0)'><path d='M800 660 L805 620 L810 660 Z' fill='green'/></g>`;
const SWAY = {
  crown: { at: [300, 440] as [number, number] },
  tuft: { at: [805, 660] as [number, number] },
};

const angle = (svg: string, id: string): number => {
  const m = svg.match(
    new RegExp(
      `<g transform='rotate\\((-?[\\d.]+) [\\d.]+ [\\d.]+\\)[^']*' id='${id}'|<g id='${id}' transform='rotate\\((-?[\\d.]+)`
    )
  );
  return Number(m?.[1] ?? m?.[2]);
};

describe('sway', () => {
  it('turns each swaying group about its pivot, gently, each in its own time', () => {
    const a = swayLayer(ART, SWAY, 1);
    expect(a).toMatch(/<g transform='rotate\(-?[\d.]+ 300 440\)' id='crown'>/);
    // A group with a transform of its own is turned before it, about the layer's point.
    expect(a).toMatch(/<g id='tuft' transform='rotate\(-?[\d.]+ 805 660\) translate\(5 0\)'>/);
    // Pure in time: the same frame twice is the same picture.
    expect(swayLayer(ART, SWAY, 1)).toBe(a);
    const crown = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map((t) =>
      angle(swayLayer(ART, SWAY, t), 'crown')
    );
    expect(Math.max(...crown) - Math.min(...crown)).toBeGreaterThan(1);
    expect(Math.max(...crown.map(Math.abs))).toBeLessThan(3);
    // Not in step with each other.
    expect(swayAngle('crown', 200, 1, 0)).not.toBeCloseTo(swayAngle('tuft', 200, 1, 0), 1);
  });

  it('moves a big crown less and slower than a tuft of grass, and more in the wind', () => {
    const swing = (reach: number, wind = 0) => {
      const v = Array.from({ length: 200 }, (_, i) => swayAngle('x', reach, 1, i * 0.05, wind));
      return {
        lo: Math.min(...v),
        hi: Math.max(...v),
        mean: v.reduce((s, x) => s + x, 0) / v.length,
      };
    };
    const crown = swing(300);
    const tuft = swing(40);
    expect(tuft.hi - tuft.lo).toBeGreaterThan(2 * (crown.hi - crown.lo));
    const windy = swing(300, 0.8);
    expect(windy.hi - windy.lo).toBeGreaterThan(2 * (crown.hi - crown.lo));
    // Leaning with it: to the right (clockwise) in a wind blowing right, left in one blowing left.
    expect(windy.mean).toBeGreaterThan(1);
    expect(swing(300, -0.8).mean).toBeLessThan(-1);
    // `amount` scales it.
    expect(swayAngle('x', 300, 2, 1.3)).toBeCloseTo(2 * swayAngle('x', 300, 1, 1.3), 6);
  });

  it('sways the library park in the film and checks a scene names real groups', () => {
    const park = SceneSchema.parse(LIBRARY.scenes.park);
    const project: Project = {
      meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
      characters: {},
      scenes: { park },
      shots: [ShotSchema.parse({ id: 's', scene: 'park', duration: 4 })],
    };
    expect(composeFrame(project, project.shots[0], 1)).toMatch(
      /rotate\(-?[\d.]+ 350 440\)' id='park-crown'/
    );
    expect(sceneSheetSvg(project, park)).toContain('~park-crown');
    const missing = SceneSchema.parse({
      ...LIBRARY.scenes.park,
      sway: { nowhere: { at: [0, 0] } },
    });
    expect(
      validateScene(missing, 1280, 720)
        .map((p) => p.message)
        .join()
    ).toMatch(/sway: no <g id='nowhere'>/);
    // A perch up in a swaying crown: whoever sits there would stay still while it moves.
    const perch = SceneSchema.parse({
      ...LIBRARY.scenes.park,
      anchors: { ...LIBRARY.scenes.park.anchors, branch: { x: 300, y: 330 } },
    });
    expect(
      validateScene(perch, 1280, 720)
        .map((p) => p.message)
        .join()
    ).toMatch(/anchor 'branch' is on swaying 'park-crown'/);
  });
});
