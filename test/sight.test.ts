import { describe, expect, it } from 'vitest';
import { sightFindings } from '../src/project/sight.js';
import { ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

/** The park with something drawn in front of the actors at x 560 to 720, from y `top` down. */
function project(
  cast: Record<string, unknown>,
  actions: unknown[],
  { top = 300, opacity = 1, allow }: { top?: number; opacity?: number; allow?: object } = {}
): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 4, cast, actions, allow });
  const foreground = `<rect x='560' y='${top}' width='160' height='${720 - top}' fill='#4a5a3a' opacity='${opacity}'/>`;
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, grownup: LIBRARY.characters.grownup },
    scenes: { park: { ...LIBRARY.scenes.park, foreground } },
    shots: [shot],
  };
}

const found = (p: Project) => sightFindings(p, p.shots[0]);
const LINE = { t: 0.5, actor: 'kid', say: 'Is anybody there? I can hear you breathing.' };

describe("a speaker's face behind the art", () => {
  it('is found while it speaks behind the foreground', () => {
    const f = found(project({ kid: { at: { x: 640, y: 640 } } }, [LINE]));
    expect(f.map((x) => [x.code, x.actors[0]])).toEqual([['sight.face', 'kid']]);
    expect(f[0].at!.x).toBeGreaterThan(560);
    expect(f[0].at!.x).toBeLessThan(720);
  });

  it('is not, standing clear of it, or behind art that is faint, or waived', () => {
    expect(found(project({ kid: { at: { x: 400, y: 640 } } }, [LINE]))).toEqual([]);
    expect(found(project({ kid: { at: { x: 640, y: 640 } } }, [LINE], { opacity: 0.35 }))).toEqual(
      []
    );
    const allow = { 'sight.face:kid': 'a voice from behind the hedge' };
    expect(found(project({ kid: { at: { x: 640, y: 640 } } }, [LINE], { allow }))).toEqual([]);
  });

  it('is not looked for on someone meant to be hidden', () => {
    const p = project({ kid: { at: { x: 640, y: 640 }, hidden: true } }, [LINE]);
    expect(found(p).filter((x) => x.code === 'sight.face')).toEqual([]);
  });
});

describe('a hidden actor', () => {
  // A low wall from y 520: the kid, small, is behind it whole; the grown-up's head is over it.
  const wall = { top: 520 };

  it('covered whole is not found', () => {
    const p = project({ kid: { at: { x: 640, y: 640, scale: 0.5 }, hidden: true } }, [], wall);
    expect(found(p)).toEqual([]);
  });

  it('that shows is found, ringed where it shows', () => {
    const p = project({ grownup: { at: { x: 640, y: 640 }, hidden: true } }, [], wall);
    const f = found(p);
    expect(f.map((x) => [x.code, x.actors[0], x.t])).toEqual([
      ['sight.hidden', 'grownup', [0, 3.75]],
    ]);
    expect(f[0].at!.y).toBeLessThan(520);
  });

  it('is not, once the hiding ends (a peek, stepping out)', () => {
    const p = project(
      { kid: { at: { x: 640, y: 640, scale: 0.5 }, hidden: true } },
      [
        { t: 1, actor: 'kid', set: { hidden: false } },
        { t: 1, actor: 'kid', do: 'walk', to: { x: 400, y: 640, scale: 0.5 }, duration: 1.5 },
      ],
      wall
    );
    expect(found(p)).toEqual([]);
  });

  it('walking out still meant to be hidden is found from where it shows', () => {
    const p = project(
      { kid: { at: { x: 640, y: 640, scale: 0.5 }, hidden: true } },
      [{ t: 1, actor: 'kid', do: 'walk', to: { x: 400, y: 640, scale: 0.5 }, duration: 1.5 }],
      wall
    );
    const f = found(p);
    expect(f).toHaveLength(1);
    expect(f[0].t[0]).toBeGreaterThan(1);
    expect(f[0].t[1]).toBeCloseTo(3.75);
  });

  it('can be hidden behind someone nearer', () => {
    const p = project(
      {
        kid: { at: { x: 900, y: 600, scale: 0.5 }, hidden: true },
        grownup: { at: { x: 900, y: 640 }, facing: 'left' },
      },
      [],
      wall
    );
    expect(found(p)).toEqual([]);
  });
});
