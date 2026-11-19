import { describe, expect, it } from 'vitest';
import { poseFor, renderShadow } from '../src/engine/actor.js';
import { castLights, throwOf, type CastLight } from '../src/engine/cast.js';
import { composeFrame } from '../src/engine/compose.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const BOX = CharacterSchema.parse({
  id: 'box',
  name: 'Box',
  rig: 'simple',
  height: 60,
  parts: { body: `<rect x='60' y='60' width='80' height='140' fill='peru'/>` },
});

function project(
  cast: Record<string, unknown>,
  actions: unknown[] = [],
  { scene = LIBRARY.scenes.park, box = BOX } = {}
): Project {
  const c = LIBRARY.characters;
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: c.kid, dog: c.dog, bird: c.bird, box },
    scenes: { park: scene },
    shots: [ShotSchema.parse({ id: 's', scene: 'park', duration: 4, cast, actions })],
  };
}

describe('ground shadows', () => {
  const rx = (svg: string) => Number(svg.match(/rx='([\d.]+)'/)?.[1] ?? 0);
  const shadowAt = (p: Project, id: string, t: number) => {
    const a = resolveFrame(p, p.shots[0], t).actors.find((x) => x.id === id)!;
    return renderShadow(a, poseFor(a, t));
  };

  it('people cast one, props and birds only when asked, and a jump shrinks it', () => {
    const cast = {
      kid: { at: { x: 300, y: 650 } },
      bird: { at: { x: 600, y: 650 } },
      box: { at: { x: 900, y: 650 } },
    };
    const jump = [{ t: 1, actor: 'kid', do: 'jump', to: { x: 500, y: 650 } }];
    const p = project(cast, jump);
    expect(rx(shadowAt(p, 'kid', 0.5))).toBeGreaterThan(30);
    expect(shadowAt(p, 'bird', 0.5)).toBe('');
    expect(shadowAt(p, 'box', 0.5)).toBe('');
    expect(rx(shadowAt(p, 'kid', 1.5))).toBeLessThan(rx(shadowAt(p, 'kid', 0.5)) * 0.8);
    const grounded = project(cast, jump, { box: { ...BOX, shadow: true } });
    expect(rx(shadowAt(grounded, 'box', 0.5))).toBeGreaterThan(10);
  });

  it('has none while flying or carried', () => {
    const p = project(
      { kid: { at: { x: 300, y: 650 } }, box: { at: { x: 900, y: 650 } } },
      [
        { t: 0, actor: 'box', attach: 'kid' },
        { t: 1, actor: 'kid', do: 'fly', to: { x: 600, y: 300 }, duration: 2 },
      ],
      { box: { ...BOX, shadow: true } }
    );
    expect(shadowAt(p, 'box', 0.5)).toBe('');
    expect(shadowAt(p, 'kid', 0.5)).not.toBe('');
    expect(shadowAt(p, 'kid', 2)).toBe('');
  });
});

describe('cast shadows', () => {
  const sky = (x: number, y: number): CastLight => ({ kind: 'sky', x, y, strength: 1, reach: 0 });
  const lamp = (x: number, y: number): CastLight => ({
    kind: 'lamp',
    x,
    y,
    strength: 1,
    reach: 700,
  });
  const throwAt = (l: CastLight, x: number, w = {}) => throwOf(l, x, 640, 220, 1280, 720, w)!;

  it('falls away from a sun in the sky and toward the viewer, longer the lower it is', () => {
    const left = throwAt(sky(200, 100), 640);
    expect(left.along).toBeGreaterThan(0);
    expect(left.up).toBeLessThan(0);
    expect(throwAt(sky(1100, 100), 640).along).toBeLessThan(0);
    const high = throwAt(sky(200, 60), 640);
    const low = throwAt(sky(200, 480), 640);
    expect(Math.hypot(low.along, low.up)).toBeGreaterThan(2 * Math.hypot(high.along, high.up));
  });

  it('is dimmed by cloud and rain', () => {
    const clear = throwAt(sky(200, 100), 640).opacity;
    const grey = throwOf(sky(200, 100), 640, 640, 220, 1280, 720, {
      clouds: { amount: 0.9, dark: 0.5 },
      rain: { amount: 0.6 },
    });
    expect(grey?.opacity ?? 0).toBeLessThan(clear / 3);
  });

  it('runs along the floor away from a lamp, darker at night, gone past its reach', () => {
    const l = lamp(400, 380);
    expect(throwAt(l, 600).along).toBeGreaterThan(0);
    expect(throwAt(l, 200).along).toBeLessThan(0);
    expect(throwAt(l, 700).along).toBeGreaterThan(throwAt(l, 500).along);
    expect(throwAt(l, 600, { light: { color: '#4a5a8f', amount: 0.7 } }).opacity).toBeGreaterThan(
      throwAt(l, 600).opacity
    );
    expect(throwOf(l, 1250, 640, 220, 1280, 720, {})).toBeUndefined();
  });

  it("takes the scene's lights, its sun and its fires", () => {
    const scene = SceneSchema.parse({
      id: 'night',
      name: 'Night',
      svg: '',
      lights: [{ kind: 'moon', x: 1100, y: 80 }],
      effects: [{ kind: 'sun', x: 200, y: 100 }],
    });
    const lights = castLights(scene, [{ x: 640, y: 560, radius: 340, strength: 1 }]);
    expect(lights.map((l) => l.kind)).toEqual(['sky', 'sky', 'lamp']);
    expect(lights[0].strength).toBeLessThan(1);
  });

  it('draws a shadow per lit actor in the frame, and none without a light', () => {
    const park = LIBRARY.scenes.park;
    const frame = (scene: typeof park) => {
      const cast = { kid: { at: { x: 400, y: 640 } }, dog: { at: { x: 700, y: 640 } } };
      const p = project(cast, [], { scene });
      return composeFrame(p, p.shots[0], 1);
    };
    expect(frame({ ...park, lights: [], effects: [] })).not.toContain("class='cast'");
    const lit = frame({ ...park, effects: [], lights: [{ kind: 'sun', x: 200, y: 100 }] });
    expect(lit.match(/class='cast'/g)).toHaveLength(2);
    // The shadow is a copy, not the actor: lookups by the actor's class find it once.
    expect(lit.split("actor-kid'")).toHaveLength(2);
  });
});
