import { describe, expect, it } from 'vitest';
import { bubbleSvg } from '../src/engine/bubble.js';
import { composeFrame } from '../src/engine/compose.js';
import { safeInsets, uiScale } from '../src/engine/format.js';
import { resolvePosition } from '../src/engine/timeline.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateProject } from '../src/project/validate.js';

const REEL = { width: 720, height: 1280 };
const FILM = { width: 1280, height: 720 };

function project(size: { width: number; height: number }, shots: unknown[]): Project {
  return {
    meta: { title: 't', ...size, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid },
    scenes: {
      bare: SceneSchema.parse({ id: 'bare', name: 'Bare', svg: "<rect width='10' height='10'/>" }),
    },
    shots: shots.map((s) => ShotSchema.parse(s)),
  };
}

describe('a portrait reel', () => {
  it('sizes its text by the short side, as a film does', () => {
    expect(uiScale(REEL)).toBe(1);
    expect(uiScale(FILM)).toBe(1);
    expect(uiScale({ width: 1080, height: 1920 })).toBe(1.5);
  });

  it('keeps a bubble clear of the buttons on the right and the icons at the top', () => {
    const svg = bubbleSvg({
      text: 'a long line that wants to be as wide as it can be',
      style: 'speech',
      headX: 700,
      headTop: 40,
      frameW: REEL.width,
      frameH: REEL.height,
      font: 'sans-serif',
      uiScale: 1,
    });
    const [, x, y, w] = svg.match(/<rect x='([\d.]+)' y='([\d.]+)' width='([\d.]+)'/)!.map(Number);
    const safe = safeInsets(REEL);
    expect(x + w).toBeLessThanOrEqual(REEL.width - safe.right);
    expect(y).toBeGreaterThanOrEqual(safe.top);
  });

  it('puts narration at the top, under the icons, clear of the cast and the caption', () => {
    const p = project(REEL, [
      { id: 's', scene: 'bare', duration: 4, actions: [{ t: 0, caption: 'Once upon a time' }] },
    ]);
    const svg = composeFrame(p, p.shots[0], 2);
    const [, y, h] = svg
      .match(/<rect x='[\d.]+' y='([\d.]+)' width='[\d.]+' height='([\d.]+)'/)!
      .map(Number);
    expect(y).toBeGreaterThanOrEqual(safeInsets(REEL).top);
    expect(y + h).toBeLessThan(REEL.height / 3);
  });

  it('stands the stage shortcuts in from the edges, feet on the edge of the caption', () => {
    const p = project(REEL, []);
    const right = resolvePosition(p, p.scenes.bare, 'right');
    expect(right.x).toBeLessThan(REEL.width - safeInsets(REEL).right);
    expect(right.y).toBeCloseTo(REEL.height - safeInsets(REEL).bottom);
    expect(resolvePosition(project(FILM, []), p.scenes.bare, 'right').x).toBeCloseTo(998.4);
  });

  it('warns when it runs over the three minutes the reel apps take', () => {
    const long = [100, 90].map((duration, i) => ({
      id: `s${i}`,
      scene: 'bare',
      duration,
      actions: [],
    }));
    const over = (size: typeof REEL) =>
      validateProject(project(size, long)).some((w) => w.message.includes('the reel runs'));
    expect(over(REEL)).toBe(true);
    expect(over(FILM)).toBe(false);
  });
});
