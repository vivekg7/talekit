import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import { printsOf } from '../src/engine/impact.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { characterSheetSvg } from '../src/render/sheets.js';

const leg = (x: number) => `<rect x='${x}' y='150' width='20' height='50' fill='{fur}'/>`;
const body = `<ellipse cx='130' cy='140' rx='50' ry='45' fill='{fur}'/>`;
/** The library mouse, drawn from behind and from the front for a top-down maze. */
const MOUSE = CharacterSchema.parse({
  ...LIBRARY.characters.mouse,
  ends: {
    back: {
      parts: {
        legL: leg(100),
        legR: leg(140),
        body,
        tail: `<path d='M130 170 L130 198' stroke='{fur}' stroke-width='6'/>`,
      },
      pivots: { tail: [130, 172] },
    },
    front: {
      parts: {
        legL: leg(100),
        legR: leg(140),
        body,
        eyes: `<circle cx='130' cy='120' r='6' fill='#fff'/>`,
      },
    },
  },
});

/** The mouse walking from `from` to `to` on sand, over 4 s from t 0.2. */
function walk(from: [number, number], to: [number, number]): Project {
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { mouse: MOUSE },
    scenes: { park: { ...LIBRARY.scenes.park, surface: 'sand' } },
    shots: [
      ShotSchema.parse({
        id: 's',
        scene: 'park',
        duration: 5,
        cast: { mouse: { at: { x: from[0], y: from[1] } } },
        actions: [{ t: 0.2, actor: 'mouse', do: 'walk', to: { x: to[0], y: to[1] }, duration: 4 }],
      }),
    ],
  };
}
const UP = walk([640, 660], [640, 360]);
const DOWN = walk([640, 360], [640, 660]);
const ACROSS = walk([300, 660], [900, 660]);
/** Each end part drawn at t, with its transform. */
const drawn = (p: Project, t: number) =>
  Object.fromEntries(
    [
      ...composeFrame(p, p.shots[0], t).matchAll(
        /class='part-((?:back|front)-\w+)'(?: transform='([^']*)')?/g
      ),
    ].map((m) => [m[1], m[2] ?? ''])
  );

describe('end-on views', () => {
  it('draws the back walking up the screen and the front walking down, the side view otherwise', () => {
    expect(Object.keys(drawn(UP, 2))).toEqual(['back-legL', 'back-legR', 'back-body', 'back-tail']);
    expect(Object.keys(drawn(DOWN, 2))).toContain('front-eyes');
    for (const t of [0, 4.5]) expect(drawn(UP, t)).toEqual({});
    expect(drawn(ACROSS, 2)).toEqual({});
  });

  it("lifts the picture's legs in turn and sways the tail about its pivot", () => {
    const lifted = (t: number) =>
      (['back-legL', 'back-legR'] as const).filter((l) =>
        /translate\(0 -[1-9]/.test(drawn(UP, t)[l])
      );
    expect(lifted(1)).toEqual(['back-legL']);
    expect(lifted(2.1)).toEqual(['back-legR']);
    expect(drawn(UP, 1)['back-tail']).toMatch(/rotate\(-?[\d.]+ 130 172\)/);
  });

  it('leaves pawprints in two tracks, under the feet', () => {
    for (const p of [UP, DOWN]) {
      const xs = new Set(printsOf(p, p.shots[0], 'mouse').map((q) => Math.round(q.x)));
      expect(xs.size).toBe(2);
      for (const x of xs) expect(Math.abs(x - 640)).toBeLessThan(15);
    }
  });

  it('shows each view, standing and mid-stride, on the pose sheet', () => {
    const sheet = characterSheetSvg(MOUSE);
    for (const label of ['back view', 'back view: walk', 'front view', 'front view: walk'])
      expect(sheet).toContain(`>${label}<`);
  });
});
