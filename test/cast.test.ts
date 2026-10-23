import { describe, expect, it } from 'vitest';
import { castLights, throwOf, type CastLight } from '../src/engine/cast.js';
import { composeFrame } from '../src/engine/compose.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const sky = (x: number, y: number): CastLight => ({ kind: 'sky', x, y, strength: 1, reach: 0 });
const lamp = (x: number, y: number): CastLight => ({ kind: 'lamp', x, y, strength: 1, reach: 700 });
const throwAt = (l: CastLight, x: number, w = {}) => throwOf(l, x, 640, 220, 1280, 720, w)!;

describe('cast shadows', () => {
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
    const shot = ShotSchema.parse({
      id: 's',
      scene: 'park',
      duration: 2,
      cast: { kid: { at: { x: 400, y: 640 } }, dog: { at: { x: 700, y: 640 } } },
    });
    const park = LIBRARY.scenes.park;
    const project = (scene: typeof park): Project => ({
      meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
      characters: { kid: LIBRARY.characters.kid, dog: LIBRARY.characters.dog },
      scenes: { park: scene },
      shots: [shot],
    });
    const dark = composeFrame(project({ ...park, lights: [], effects: [] }), shot, 1);
    expect(dark).not.toContain("class='cast'");
    const lit = composeFrame(
      project({ ...park, effects: [], lights: [{ kind: 'sun', x: 200, y: 100 }] }),
      shot,
      1
    );
    expect(lit.match(/class='cast'/g)).toHaveLength(2);
    // The shadow is a copy, not the actor: lookups by the actor's class find it once.
    expect(lit.split("actor-kid'")).toHaveLength(2);
  });
});
