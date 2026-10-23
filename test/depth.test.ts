import { describe, expect, it } from 'vitest';
import { poseFor, renderShadow } from '../src/engine/actor.js';
import { composeFrame, layerTransform } from '../src/engine/compose.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateScene, validateShot } from '../src/project/validate.js';

const W = 1280;
const H = 720;
const BOX = CharacterSchema.parse({
  id: 'box',
  name: 'Box',
  rig: 'simple',
  height: 60,
  parts: { body: `<rect x='60' y='60' width='80' height='140' fill='peru'/>` },
});

function project(shots: unknown[], characters = {}): Project {
  return {
    meta: { title: 't', width: W, height: H, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      bird: LIBRARY.characters.bird,
      box: BOX,
      ...characters,
    },
    scenes: {
      park: SceneSchema.parse(LIBRARY.scenes.park),
      home: SceneSchema.parse(LIBRARY.scenes.home),
    },
    shots: shots.map((s) => ShotSchema.parse(s)),
  };
}

/** Apply a `translate scale translate` transform string to a point. */
function apply(tf: string, x: number, y: number): [number, number] {
  const nums = tf.match(/-?\d*\.?\d+/g)!.map(Number);
  const [ax, ay, s, bx, by] = nums;
  return [(x + bx) * s + ax, (y + by) * s + ay];
}

describe('layers', () => {
  it('moves the stage with the camera, the far layer less and the near layer more', () => {
    const cam = { zoom: 1.5, x: 900, y: 500 };
    const stage = apply(layerTransform(cam, W, H, 1), 900, 500);
    expect(stage[0]).toBeCloseTo(W / 2);
    expect(stage[1]).toBeCloseTo(H / 2);
    // p = 0 does not move at all.
    expect(apply(layerTransform(cam, W, H, 0), 100, 200)).toEqual([100, 200]);
    // Relative to where it sits with the camera at rest, each layer shifts by its factor.
    const shift = (p: number) => apply(layerTransform(cam, W, H, p), W / 2, H / 2)[0] - W / 2;
    expect(shift(0.5)).toBeGreaterThan(shift(1));
    expect(shift(1)).toBeGreaterThan(shift(1.4));
  });

  it('keeps a frame-filling far layer covering the frame wherever the camera goes', () => {
    for (const zoom of [1, 1.3, 2, 3])
      for (const fx of [0, 1])
        for (const fy of [0, 1]) {
          // The stage camera clamped into the scene, at its most extreme.
          const hw = W / (2 * zoom);
          const hh = H / (2 * zoom);
          const cam = { zoom, x: fx ? W - hw : hw, y: fy ? H - hh : hh };
          for (const p of [0, 0.3, 0.5, 0.8]) {
            const tf = layerTransform(cam, W, H, p);
            const [x0, y0] = apply(tf, 0, 0);
            const [x1, y1] = apply(tf, W, H);
            expect(x0).toBeLessThanOrEqual(1e-6);
            expect(y0).toBeLessThanOrEqual(1e-6);
            expect(x1).toBeGreaterThanOrEqual(W - 1e-6);
            expect(y1).toBeGreaterThanOrEqual(H - 1e-6);
          }
        }
  });

  it('draws far behind the stage and darkens the edges only when zoomed in', () => {
    const shot = (zoom: number) => ({
      id: 's',
      scene: 'park',
      duration: 2,
      camera: { zoom, x: 640, y: 450 },
    });
    const svg = composeFrame(project([shot(1)]), project([shot(1)]).shots[0], 1);
    expect(svg.indexOf("class='far'")).toBeLessThan(svg.indexOf("class='camera'"));
    expect(svg).not.toContain('url(#tk-vignette)');
    const close = project([shot(1.6)]);
    expect(composeFrame(close, close.shots[0], 1)).toContain('url(#tk-vignette)');
  });

  it('warns when the stage paints over the far layer', () => {
    const scene = SceneSchema.parse({
      ...LIBRARY.scenes.park,
      svg: `<rect width='1280' height='720' fill='skyblue'/>`,
    });
    const messages = validateScene(scene, W, H).map((p) => p.message);
    expect(messages.join('\n')).toMatch(/hides far/);
    // A see-through tint over the whole stage leaves far showing.
    const tinted = SceneSchema.parse({
      ...LIBRARY.scenes.park,
      svg: `<rect width='1280' height='720' fill='#ff8c4a' opacity='0.2'/>`,
    });
    expect(validateScene(tinted, W, H)).toEqual([]);
    expect(validateScene(SceneSchema.parse(LIBRARY.scenes.park), W, H)).toEqual([]);
  });
});

describe('ground shadows', () => {
  const rx = (svg: string) => Number(svg.match(/rx='([\d.]+)'/)?.[1] ?? 0);
  const shadowAt = (p: Project, id: string, t: number) => {
    const a = resolveFrame(p, p.shots[0], t).actors.find((x) => x.id === id)!;
    return renderShadow(a, poseFor(a, t));
  };

  it('people cast one, props and birds only when asked, and a jump shrinks it', () => {
    const shot = {
      id: 's',
      scene: 'park',
      duration: 4,
      cast: {
        kid: { at: { x: 300, y: 650 } },
        bird: { at: { x: 600, y: 650 } },
        box: { at: { x: 900, y: 650 } },
      },
      actions: [{ t: 1, actor: 'kid', do: 'jump', to: { x: 500, y: 650 } }],
    };
    const p = project([shot]);
    expect(rx(shadowAt(p, 'kid', 0.5))).toBeGreaterThan(30);
    expect(shadowAt(p, 'bird', 0.5)).toBe('');
    expect(shadowAt(p, 'box', 0.5)).toBe('');
    expect(rx(shadowAt(p, 'kid', 1.5))).toBeLessThan(rx(shadowAt(p, 'kid', 0.5)) * 0.8);
    const lit = project([shot], { box: { ...BOX, shadow: true } });
    expect(rx(shadowAt(lit, 'box', 0.5))).toBeGreaterThan(10);
  });

  it('has none while flying or carried', () => {
    const p = project(
      [
        {
          id: 's',
          scene: 'park',
          duration: 4,
          cast: { kid: { at: { x: 300, y: 650 } }, box: { at: { x: 900, y: 650 } } },
          actions: [
            { t: 0, actor: 'box', attach: 'kid' },
            { t: 1, actor: 'kid', do: 'fly', to: { x: 600, y: 300 }, duration: 2 },
          ],
        },
      ],
      { box: { ...BOX, shadow: true } }
    );
    expect(shadowAt(p, 'box', 0.5)).toBe('');
    expect(shadowAt(p, 'kid', 0.5)).not.toBe('');
    expect(shadowAt(p, 'kid', 2)).toBe('');
  });
});

describe('cross-fade', () => {
  const shots = [
    { id: 'a', scene: 'home', duration: 3 },
    { id: 'b', scene: 'park', duration: 3, crossfade: 1 },
  ];

  it('dissolves from the previous shot, then is a plain frame', () => {
    const p = project(shots);
    const early = composeFrame(p, p.shots[1], 0.5);
    expect(early).toContain(LIBRARY.scenes.home.svg.slice(0, 80));
    expect(early).toContain("slope='0.5'");
    const late = composeFrame(p, p.shots[1], 1.5);
    expect(late).not.toContain(LIBRARY.scenes.home.svg.slice(0, 80));
    // The first shot has nothing to dissolve from.
    const first = project([{ ...shots[1], id: 'c' }]);
    expect(composeFrame(first, first.shots[0], 0.5)).not.toContain('tk-dissolve');
  });

  it('warns about a dissolve from black or from nothing', () => {
    const p = project([{ ...shots[0], fadeOut: 1 }, shots[1]]);
    expect(
      validateShot(p.shots[1], p)
        .map((m) => m.message)
        .join('\n')
    ).toMatch(/dissolves from black/);
    const q = project([shots[1]]);
    expect(
      validateShot(q.shots[0], q)
        .map((m) => m.message)
        .join('\n')
    ).toMatch(/nothing to dissolve from/);
  });
});
