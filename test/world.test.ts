import { describe, expect, it } from 'vitest';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import {
  groundOf,
  habitatOf,
  inArea,
  nearestIn,
  sceneFindings,
  shotFindings,
  supportAt,
} from '../src/engine/world.js';
import { validateProject, validateScene, validateShot } from '../src/project/validate.js';
import { findingFrameSvg } from '../src/render/sheets.js';
import { rasterize } from '../src/render/raster.js';

// A floor from y 560 down, a branch top at y 330, deep water on the right, a wading strip.
const STAGE = SceneSchema.parse({
  id: 'stage',
  name: 'Stage',
  svg: `<rect width='1280' height='720' fill='#9c6'/>`,
  walk: [
    [
      [-300, 560],
      [1000, 560],
      [1000, 760],
      [-300, 760],
    ],
    [
      [600, 324],
      [800, 324],
      [800, 336],
      [600, 336],
    ],
  ],
  water: [
    {
      area: [
        [1000, 520],
        [1580, 520],
        [1580, 760],
        [1000, 760],
      ],
    },
    {
      area: [
        [900, 640],
        [1000, 640],
        [1000, 760],
        [900, 760],
      ],
      wade: true,
    },
  ],
  anchors: { branch: { x: 700, y: 330 }, floor: { x: 300, y: 640 } },
});

const FISH = CharacterSchema.parse({
  id: 'fish',
  name: 'Fish',
  rig: 'simple',
  habitat: ['water'],
  height: 40,
  parts: { body: `<ellipse cx='100' cy='150' rx='80' ry='40' fill='orange'/>` },
});
const POT = CharacterSchema.parse({
  id: 'pot',
  name: 'Pot',
  rig: 'simple',
  height: 50,
  grip: [100, 40],
  parts: { body: `<circle cx='100' cy='120' r='70' fill='brown'/>` },
});

function project(
  cast: Record<string, unknown>,
  actions: unknown[] = [],
  extra: Record<string, unknown> = {}
): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'stage', duration: 4, cast, actions, ...extra });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      crow: LIBRARY.characters.crow,
      fish: FISH,
      pot: POT,
    },
    scenes: { stage: STAGE },
    shots: [shot],
  };
}

describe('geometry', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  it('tells inside from outside and finds the nearest point of an area', () => {
    expect(inArea(square, { x: 5, y: 5 })).toBe(true);
    expect(inArea(square, { x: 15, y: 5 })).toBe(false);
    expect(nearestIn(square, { x: 15, y: 5 })).toEqual({ x: 10, y: 5 });
    expect(nearestIn(square, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe('what holds an actor up', () => {
  const g = groundOf(STAGE);
  it('stands a walker on the floor and a branch, never on air or in deep water', () => {
    expect(supportAt(g, ['land'], { x: 300, y: 640 })).toBeUndefined();
    expect(supportAt(g, ['land'], { x: 700, y: 330 })).toBeUndefined();
    expect(supportAt(g, ['land'], { x: 300, y: 450 })).toBe('support.air');
    expect(supportAt(g, ['land'], { x: 1200, y: 640 })).toBe('support.water');
    expect(supportAt(g, ['land'], { x: 950, y: 700 })).toBeUndefined();
  });
  it('stands a walker on a stone drawn over the water: walk wins', () => {
    const stone = groundOf(
      SceneSchema.parse({
        ...STAGE,
        walk: [
          ...STAGE.walk!,
          [
            [1150, 600],
            [1250, 600],
            [1250, 614],
            [1150, 614],
          ],
        ],
      })
    );
    expect(supportAt(stone, ['land'], { x: 1200, y: 607 })).toBeUndefined();
    expect(supportAt(stone, ['land'], { x: 1100, y: 607 })).toBe('support.water');
  });
  it('keeps a swimmer in the water and lets a flier be anywhere', () => {
    expect(supportAt(g, ['water'], { x: 1200, y: 640 })).toBeUndefined();
    expect(supportAt(g, ['water'], { x: 300, y: 640 })).toBe('support.dry');
    expect(supportAt(g, ['land', 'air'], { x: 300, y: 100 })).toBeUndefined();
  });
  it('gives a flapping character the air by default', () => {
    const bird = CharacterSchema.parse({ ...LIBRARY.characters.crow, habitat: undefined });
    expect(habitatOf({ ...bird, flaps: ['wing'] })).toEqual(['land', 'air']);
    expect(habitatOf(LIBRARY.characters.kid)).toEqual(['land']);
  });
  it('counts a river effect as deep water when the scene names none', () => {
    const river = SceneSchema.parse({
      ...STAGE,
      water: undefined,
      effects: [
        {
          kind: 'river',
          points: [
            [0, 600],
            [400, 600],
            [400, 700],
            [0, 700],
          ],
        },
      ],
    });
    expect(groundOf(river).deep).toHaveLength(1);
  });
});

describe('the support rule', () => {
  it('finds a boy standing on air, with when, where and a fix', () => {
    const p = project({ kid: { at: { x: 300, y: 450 } } });
    const [f, ...rest] = shotFindings(p, p.shots[0]);
    expect(rest).toEqual([]);
    expect(f.code).toBe('support.air');
    expect(f.actors).toEqual(['kid']);
    expect(f.t[0]).toBe(0);
    expect(f.t[1]).toBeGreaterThan(3.9);
    expect(f.fix).toEqual({ path: '/cast/kid/at', value: { x: 300, y: 560 } });
  });
  it('finds only the stretch of a walk that leaves the ground', () => {
    const p = project({ kid: { at: 'floor' } }, [
      { t: 1, actor: 'kid', do: 'move', to: { x: 300, y: 450 }, duration: 1 },
    ]);
    const [f] = shotFindings(p, p.shots[0]);
    expect(f.code).toBe('support.air');
    expect(f.t[0]).toBeGreaterThan(1);
    expect(f.fix).toBeUndefined();
  });
  it('lets a carried pot, a jumper and a flier off', () => {
    const carried = project({ kid: { at: 'floor' }, pot: { at: { x: 330, y: 560 } } }, [
      { t: 0, actor: 'pot', attach: 'kid' },
    ]);
    expect(shotFindings(carried, carried.shots[0])).toEqual([]);
    const jump = project({ kid: { at: 'floor' } }, [
      { t: 0.5, actor: 'kid', do: 'jump', to: 'branch' },
    ]);
    expect(shotFindings(jump, jump.shots[0])).toEqual([]);
    const crow = project({ crow: { at: { x: 400, y: 200 } } });
    expect(shotFindings(crow, crow.shots[0])).toEqual([]);
  });
  it('finds a fish on the floor', () => {
    const p = project({ fish: { at: { x: 300, y: 640 } } });
    expect(shotFindings(p, p.shots[0]).map((f) => f.code)).toEqual(['support.dry']);
  });
  it('is waived by code or by code and actor, with a reason', () => {
    const cast = { kid: { at: { x: 300, y: 450 } } };
    for (const allow of [{ 'support.air': 'a dream' }, { 'support.air:kid': 'a dream' }]) {
      const p = project(cast, [], { allow });
      expect(shotFindings(p, p.shots[0])).toEqual([]);
    }
    const other = project(cast, [], { allow: { 'support.air:crow': 'a dream' } });
    expect(shotFindings(other, other.shots[0])).toHaveLength(1);
  });
  it('makes a finding a project error that blocks the render, and a typo in allow too', () => {
    const p = project({ kid: { at: { x: 300, y: 450 } } });
    expect(validateProject(p).filter((e) => e.code === 'support.air')).toHaveLength(1);
    const typo = project({ kid: { at: 'floor' } }, [], { allow: { 'suport.air': 'oops' } });
    expect(validateShot(typo.shots[0], typo).some((e) => /no check/.test(e.message))).toBe(true);
  });
  it('draws a finding as a frame with the spot ringed', () => {
    const p = project({ kid: { at: { x: 300, y: 450 } } });
    const [f] = shotFindings(p, p.shots[0]);
    const svg = findingFrameSvg(p, f);
    expect(svg).toContain('#ff2d2d');
    expect(rasterize(svg, 320).length).toBeGreaterThan(1000);
  });
});

describe('the scene on its own', () => {
  it('needs walk areas, unless it says why not', () => {
    const bare = SceneSchema.parse({ ...STAGE, walk: undefined });
    expect(sceneFindings(bare, 1280).map((f) => f.code)).toEqual(['world.walk']);
    const sky = SceneSchema.parse({ ...bare, allow: { 'world.walk': 'only sky here' } });
    expect(sceneFindings(sky, 1280)).toEqual([]);
  });
  it('puts every anchor on ground or water, or waives it by name', () => {
    const up = SceneSchema.parse({
      ...STAGE,
      anchors: { ...STAGE.anchors, sky: { x: 400, y: 200 } },
    });
    expect(validateScene(up, 1280, 720).filter((p) => p.code === 'world.anchor')).toHaveLength(1);
    const ok = SceneSchema.parse({ ...up, allow: { 'world.anchor:sky': 'the crow flies there' } });
    expect(validateScene(ok, 1280, 720)).toEqual([]);
  });
});
