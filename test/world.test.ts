import { describe, expect, it } from 'vitest';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { groundOf, habitatOf } from '../src/engine/area.js';
import { sceneFindings, shotFindings, supportAt } from '../src/engine/world.js';
import { validateProject, validateScene, validateShot } from '../src/project/validate.js';
import { findingFrameSvg } from '../src/render/sheets.js';
import { resolveActor } from '../src/engine/timeline.js';
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
  // A trunk from the floor up to the branch.
  climb: [
    [
      [580, 320],
      [620, 320],
      [620, 566],
      [580, 566],
    ],
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
  it("is waived by code or by code and actor, in the shot or for all the scene's shots", () => {
    const cast = { kid: { at: { x: 300, y: 450 } } };
    const left = (shot: Record<string, unknown>, scene: Record<string, string> = {}) => {
      const p = project(cast, [], shot);
      p.scenes.stage = { ...STAGE, allow: scene };
      return shotFindings(p, p.shots[0]).length;
    };
    const waivers: Record<string, string>[] = [
      { 'support.air': 'a dream' },
      { 'support.air:kid': 'a dream' },
    ];
    for (const allow of waivers) {
      expect(left({ allow })).toBe(0);
      expect(left({}, allow)).toBe(0);
    }
    expect(left({ allow: { 'support.air:crow': 'a dream' } })).toBe(1);
    expect(left({ allow: { 'support.water': 'a dream' } })).toBe(1);
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

describe('gravity', () => {
  const pos = (p: Project, id: string, t: number) =>
    resolveActor(p, p.scenes.stage, p.shots[0], id, t);
  it('drops a prop let go of straight down to the floor its carrier stands on', () => {
    const p = project({ kid: { at: 'floor' }, pot: { at: { x: 330, y: 640 } } }, [
      { t: 0, actor: 'pot', attach: 'kid' },
      { t: 1, actor: 'pot', attach: false },
    ]);
    const held = pos(p, 'pot', 0.99);
    const mid = pos(p, 'pot', 1.1);
    const after = pos(p, 'pot', 2);
    expect(held.y).toBeLessThan(620);
    expect(mid.falling).toBe(true);
    expect(mid.y).toBeGreaterThan(held.y);
    expect(after.y).toBeCloseTo(640, 0);
    expect(after.x).toBeCloseTo(held.x, 0);
    expect(shotFindings(p, p.shots[0])).toEqual([]);
  });
  it('drops faster and faster, then bounces once', () => {
    const p = project({ pot: { at: { x: 700, y: 330 } } }, [{ t: 1, actor: 'pot', do: 'fall' }]);
    const ys = [1, 1.1, 1.2, 1.3].map((t) => pos(p, 'pot', t).y);
    expect(ys[2] - ys[1]).toBeGreaterThan(ys[1] - ys[0]);
    expect(pos(p, 'pot', 3).y).toBeGreaterThan(559);
    expect(pos(p, 'pot', 3).y).toBeLessThan(570);
  });
  it('does not drop what stands on the floor already', () => {
    const p = project({ pot: { at: { x: 300, y: 640 } } }, [{ t: 1, actor: 'pot', do: 'fall' }]);
    expect(pos(p, 'pot', 2).y).toBe(640);
  });
});

describe('feet put on the ground', () => {
  const pos = (p: Project, id: string, t: number) =>
    resolveActor(p, p.scenes.stage, p.shots[0], id, t);
  it('puts feet a few pixels above the floor on it, and leaves a real float to the check', () => {
    const near = project({ kid: { at: { x: 300, y: 552 } } });
    expect(pos(near, 'kid', 1).y).toBe(560);
    expect(shotFindings(near, near.shots[0])).toEqual([]);
    const far = project({ kid: { at: { x: 300, y: 540 } } });
    expect(pos(far, 'kid', 1).y).toBe(540);
    expect(shotFindings(far, far.shots[0]).map((f) => f.code)).toEqual(['support.air']);
  });
  it('leaves a bird in the air alone', () => {
    const p = project({ crow: { at: { x: 300, y: 552 } } });
    expect(pos(p, 'crow', 1).y).toBe(552);
  });
});

describe('climbing', () => {
  const up = (verb: string, extra: Record<string, unknown> = {}) =>
    project(
      { kid: { at: { x: 600, y: 560 }, facing: 'right' } },
      [{ t: 0.2, actor: 'kid', do: verb, to: { x: 600, y: 330 }, duration: 3 }],
      extra
    );
  const at = (p: Project, t: number) => resolveActor(p, p.scenes.stage, p.shots[0], 'kid', t);
  it('climbs a trunk hand over hand with its back to the viewer, and stands at the top', () => {
    const p = up('climb');
    const mid = at(p, 1.7);
    expect(mid.locomotion).toBe('climb');
    expect(mid.view).toBe(-1);
    expect(mid.ascent).toBeCloseTo(90, 0);
    expect(mid.y).toBeGreaterThan(330);
    expect(mid.y).toBeLessThan(560);
    expect(at(p, 3.5).y).toBe(330);
    expect(at(p, 3.5).locomotion).toBe('idle');
    expect(shotFindings(p, p.shots[0])).toEqual([]);
  });
  it('takes its time by default: a ladder is slow', () => {
    const p = project({ kid: { at: { x: 600, y: 560 } } }, [
      { t: 0, actor: 'kid', do: 'climb', to: { x: 600, y: 330 } },
    ]);
    expect(at(p, 2.5).locomotion).toBe('climb');
  });
  it('finds a climb up nothing that can be climbed', () => {
    const p = up('climb');
    p.scenes.stage = { ...STAGE, climb: undefined };
    const [f] = shotFindings(p, p.shots[0]);
    expect(f.code).toBe('support.climb');
    expect(f.message).toMatch(/climbs nothing/);
  });
  it('finds a walker glided up it with move, and says to climb', () => {
    const p = up('move');
    const [f] = shotFindings(p, p.shots[0]);
    expect(f.code).toBe('support.air');
    expect(f.message).toMatch(/glides there standing, with `move`.*`climb`/);
  });
});

describe('the jump rule', () => {
  const codes = (p: Project) => shotFindings(p, p.shots[0]).map((f) => f.code);
  it('finds a prop passed between two who stand too far apart, and says why', () => {
    const p = project(
      {
        kid: { at: { x: 200, y: 640 } },
        crow: { at: { x: 900, y: 640 } },
        pot: { at: { x: 230, y: 640 } },
      },
      [
        { t: 0, actor: 'pot', attach: 'kid' },
        { t: 1, actor: 'pot', attach: 'crow' },
      ]
    );
    const [f] = shotFindings(p, p.shots[0]).filter((x) => x.code === 'continuity.jump');
    expect(f.actors).toEqual(['pot']);
    expect(f.message).toMatch(/from 'kid' to 'crow'/);
  });
  it('finds a set.at in sight, and a move too fast to be one', () => {
    const placed = project({ pot: { at: { x: 200, y: 640 } } }, [
      { t: 1, actor: 'pot', set: { at: { x: 900, y: 640 } } },
    ]);
    expect(shotFindings(placed, placed.shots[0])[0].message).toMatch(/set\.at while in sight/);
    const fast = project({ pot: { at: { x: 200, y: 640 } } }, [
      { t: 1, actor: 'pot', do: 'move', to: { x: 900, y: 640 }, duration: 0.3 },
    ]);
    expect(shotFindings(fast, fast.shots[0])[0].message).toMatch(/faster than anything/);
  });
  it('leaves runs, and moves made out of sight, alone', () => {
    const walk = project({ kid: { at: { x: 100, y: 640 } } }, [
      { t: 0.5, actor: 'kid', do: 'run', to: { x: 900, y: 640 } },
    ]);
    expect(codes(walk)).toEqual([]);
    const hidden = project({ pot: { at: { x: 200, y: 640 } } }, [
      { t: 0.5, actor: 'pot', set: { visible: false } },
      { t: 1, actor: 'pot', set: { at: { x: 900, y: 640 } } },
      { t: 1.5, actor: 'pot', set: { visible: true } },
    ]);
    expect(codes(hidden)).toEqual([]);
  });
});
