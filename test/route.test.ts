import { describe, expect, it } from 'vitest';
import { inArea } from '../src/engine/area.js';
import { routeOf, solidBlock } from '../src/engine/route.js';
import { actionDuration, resolveActor } from '../src/engine/timeline.js';
import {
  ShotSchema,
  type Action,
  type Area,
  type Project,
  type Scene,
} from '../src/engine/types.js';
import { shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';

const FLOOR: Area = [
  [-400, 560],
  [1680, 560],
  [1680, 720],
  [-400, 720],
];
/** A well's footprint in the middle of the floor. */
const WELL: Area = [
  [560, 600],
  [720, 600],
  [730, 640],
  [550, 640],
];

function project(
  scene: Partial<Scene>,
  cast: Record<string, unknown>,
  actions: unknown[]
): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 8, cast, actions });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid },
    scenes: { park: { ...LIBRARY.scenes.park, walk: [FLOOR], ...scene } as Scene },
    shots: [shot],
  };
}

/** Where the kid's feet are through the shot, every 0.05 s. */
function feet(p: Project) {
  const shot = p.shots[0];
  const out: { x: number; y: number }[] = [];
  for (let t = 0; t < shot.duration; t += 0.05) {
    const a = resolveActor(p, p.scenes.park, shot, 'kid', t);
    out.push({ x: a.x, y: a.y });
  }
  return out;
}

const across = (scene: Partial<Scene>) =>
  project(scene, { kid: { at: { x: 300, y: 620 } } }, [
    { t: 0.5, actor: 'kid', do: 'walk', to: { x: 1000, y: 620 } },
  ]);

describe('a walk round what is in the way', () => {
  it('goes straight when nothing is', () => {
    const p = across({});
    expect(routeOf(p.scenes.park, { x: 300, y: 620 }, { x: 1000, y: 620 })).toEqual([]);
    for (const f of feet(p)) expect(f.y).toBeCloseTo(620);
  });

  it('round the front of a solid painted on the stage, never through or behind it', () => {
    const p = across({ solids: { well: { area: WELL, layer: 'svg' } } });
    const path = feet(p);
    for (const f of path)
      for (const a of solidBlock({ area: WELL })) expect(inArea(a, f)).toBe(false);
    expect(Math.max(...path.map((f) => f.y))).toBeGreaterThan(640);
    expect(path[path.length - 1].x).toBeCloseTo(1000);
    expect(shotFindings(p, p.shots[0])).toEqual([]);
  });

  it('round the back of one painted in the foreground', () => {
    const p = across({ solids: { well: { area: WELL, layer: 'foreground' } } });
    const path = feet(p);
    expect(Math.min(...path.map((f) => f.y))).toBeLessThan(600);
    expect(path[path.length - 1]).toEqual({ x: 1000, y: 620 });
  });

  it('takes longer to go round than straight, at the same pace', () => {
    const scene = {
      ...across({}).scenes.park,
      solids: { well: { area: WELL, layer: 'svg' as const } },
    };
    const from = { x: 300, y: 620, scale: 1 };
    const to = { x: 1000, y: 620, scale: 1 };
    const walk = { t: 0, do: 'walk' } as Action;
    expect(actionDuration(walk, from, to, scene)).toBeGreaterThan(actionDuration(walk, from, to));
  });

  it('keeps to the walk areas: over the bridge, not across the river', () => {
    const banks: Area[] = [
      [
        [-400, 560],
        [500, 560],
        [500, 720],
        [-400, 720],
      ],
      [
        [800, 560],
        [1680, 560],
        [1680, 720],
        [800, 720],
      ],
      // The bridge, at the back.
      [
        [480, 560],
        [820, 560],
        [820, 590],
        [480, 590],
      ],
    ];
    const p = project({ walk: banks }, { kid: { at: { x: 300, y: 690 } } }, [
      { t: 0.5, actor: 'kid', do: 'walk', to: { x: 1000, y: 690 } },
    ]);
    const path = feet(p);
    const mid = path.filter((f) => f.x > 520 && f.x < 780);
    expect(mid.length).toBeGreaterThan(0);
    for (const f of mid) expect(f.y).toBeLessThan(590);
    expect(shotFindings(p, p.shots[0]).filter((f) => f.code.startsWith('support'))).toEqual([]);
  });

  it('turns where the way doubles back, round to the bridge and along the far bank', () => {
    const banks: Area[] = [
      // The near bank, the far bank below it, and a bridge between them at the right.
      [
        [-400, 480],
        [1680, 480],
        [1680, 560],
        [-400, 560],
      ],
      [
        [-400, 640],
        [1680, 640],
        [1680, 720],
        [-400, 720],
      ],
      [
        [900, 540],
        [1000, 540],
        [1000, 660],
        [900, 660],
      ],
    ];
    const p = project({ walk: banks }, { kid: { at: { x: 300, y: 520 }, facing: 'left' } }, [
      { t: 0.5, actor: 'kid', do: 'walk', to: { x: 300, y: 690 } },
    ]);
    const shot = p.shots[0];
    const at = (t: number) => resolveActor(p, p.scenes.park, shot, 'kid', t);
    const path = Array.from({ length: 160 }, (_, i) => ({ t: i * 0.05, ...at(i * 0.05) }));
    const going = path.filter((s) => s.locomotion === 'walk');
    // Facing the way it goes on every leg: right to the bridge, left back along the far bank.
    for (let i = 1; i < going.length; i++) {
      const dx = going[i].x - going[i - 1].x;
      if (Math.abs(dx) > 2) expect(going[i].facing).toBe(dx > 0 ? 'right' : 'left');
    }
    expect(going.some((s) => s.facing === 'right')).toBe(true);
    expect(path[path.length - 1].facing).toBe('left');
  });

  it('turns through each corner in `via`, point or anchor, without stopping', () => {
    const p = project({}, { kid: { at: { x: 300, y: 620 } } }, [
      {
        t: 0.5,
        actor: 'kid',
        do: 'walk',
        to: { x: 1000, y: 620 },
        via: [{ x: 500, y: 700 }, 'bench'],
      },
    ]);
    const shot = p.shots[0];
    const path = Array.from({ length: 160 }, (_, i) =>
      resolveActor(p, p.scenes.park, shot, 'kid', i * 0.05)
    );
    const going = path.filter((a) => a.locomotion === 'walk');
    const bench = LIBRARY.scenes.park.anchors.bench;
    for (const corner of [{ x: 500, y: 700 }, bench])
      expect(
        Math.min(...going.map((a) => Math.hypot(a.x - corner.x, a.y - corner.y)))
      ).toBeLessThan(10);
    const first = path.indexOf(going[0]);
    expect(path.slice(first, first + going.length)).toEqual(going);
    expect(path.at(-1)).toMatchObject({ x: 1000, y: 620 });
  });

  it('walks straight in to a spot on the solid itself (a seat on the cot)', () => {
    const scene = { solids: { cot: { area: WELL, layer: 'svg' as const } } } as Partial<Scene>;
    const p = project(scene, {}, []);
    expect(routeOf(p.scenes.park, { x: 300, y: 620 }, { x: 640, y: 620 })).toEqual([]);
  });
});

describe('standing inside a solid', () => {
  const scene = { solids: { well: { area: WELL, layer: 'svg' as const } } };

  it('is found, with the nearest spot clear of it', () => {
    const p = project(scene, { kid: { at: { x: 640, y: 630 } } }, []);
    const f = shotFindings(p, p.shots[0]).filter((x) => x.code === 'support.solid');
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain("inside 'well'");
    const at = f[0].fix!.value as { x: number; y: number };
    expect(inArea(WELL, at)).toBe(false);
  });

  it('is not, sitting on it', () => {
    const p = project(scene, { kid: { at: { x: 640, y: 630 } } }, [
      { t: 0, actor: 'kid', do: 'sit', duration: 0.05 },
    ]);
    const f = shotFindings(p, p.shots[0]).filter((x) => x.code === 'support.solid');
    expect(f.every((x) => x.t[1] <= 0.3)).toBe(true);
  });
});
