import { describe, expect, it } from 'vitest';
import { composeFrame, layerTransform } from '../src/engine/compose.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateScene, validateShot } from '../src/project/validate.js';

const W = 1280;
const H = 720;
function project(shots: unknown[], characters = {}): Project {
  return {
    meta: { title: 't', width: W, height: H, fps: 24, font: 'sans-serif' },
    characters,
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
      // Its trees are gone with the svg, and so are the crowns that sway.
      sway: undefined,
    });
    expect(validateScene(tinted, W, H)).toEqual([]);
    expect(validateScene(SceneSchema.parse(LIBRARY.scenes.park), W, H)).toEqual([]);
  });

  it.each(Object.keys(LIBRARY.scenes))('passes library scene %s without a warning', (id) => {
    // The tall ones are drawn for a portrait reel.
    const [w, h] = id.endsWith('-tall') ? [H, W] : [W, H];
    expect(validateScene(LIBRARY.scenes[id], w, h)).toEqual([]);
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

describe('standing on someone', () => {
  const order = (p: Project, t: number) => resolveFrame(p, p.shots[0], t).actors.map((a) => a.id);
  const shot = (mouse: object, actions: unknown[]) =>
    project(
      [
        {
          id: 's',
          scene: 'park',
          duration: 6,
          cast: { lion: { at: { x: 600, y: 650 } }, mouse: { at: { x: 400, y: 660 }, ...mouse } },
          actions,
        },
      ],
      { lion: LIBRARY.characters.lion, mouse: LIBRARY.characters.mouse }
    );

  it('draws the one on top in front, though its feet are higher', () => {
    const up = { t: 0.5, actor: 'mouse', do: 'jump', to: { x: 590, y: 560 }, duration: 1 };
    // Without `on` its feet higher on the screen put it behind the lion once it is there.
    expect(order(shot({}, [up]), 3)).toEqual(['mouse', 'lion']);
    expect(order(shot({}, [{ ...up, on: 'lion' }]), 3)).toEqual(['lion', 'mouse']);
    // Starting the shot up there.
    expect(order(shot({ at: { x: 590, y: 560 }, on: 'lion' }, []), 0)).toEqual(['lion', 'mouse']);
  });

  it('is off once a move without it lands somewhere else, not when it sets off', () => {
    const p = shot({ at: { x: 590, y: 560 }, on: 'lion' }, [
      { t: 1, actor: 'mouse', do: 'jump', to: { x: 700, y: 600 }, duration: 1 },
    ]);
    expect(order(p, 1.5)).toEqual(['lion', 'mouse']);
    expect(order(p, 2.5)).toEqual(['mouse', 'lion']);
  });

  it('rides along as the one under it walks, lies down and gets up', () => {
    const at = (p: Project, id: string, t: number) =>
      resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
    const p = shot({ at: { x: 590, y: 560 }, on: 'lion' }, [
      { t: 1, actor: 'lion', do: 'walk', to: { x: 800, y: 650 } },
      { t: 4, actor: 'lion', do: 'lie', duration: 1 },
    ]);
    const before = at(p, 'mouse', 0);
    const walked = at(p, 'mouse', 3.9);
    // As far along as the lion went, and as high up its back.
    expect(walked.x - before.x).toBeCloseTo(at(p, 'lion', 3.9).x - 600, 0);
    expect(walked.y).toBeCloseTo(before.y, 0);
    // Down with its back as it lies.
    expect(at(p, 'mouse', 5.5).y).toBeGreaterThan(walked.y + 10);
    // A hop along the back without `on` gets a warning: it would be off the lion.
    const hop = shot({ at: { x: 590, y: 560 }, on: 'lion' }, [
      { t: 1, actor: 'mouse', do: 'jump', to: { x: 620, y: 560 }, duration: 0.5 },
    ]);
    const msgs = validateShot(hop.shots[0], hop).map((w) => w.message);
    expect(msgs.some((m) => m.includes(`lands on 'lion' again without on`))).toBe(true);
  });

  it('needs a way up and someone in the cast to stand on', () => {
    expect(() =>
      ShotSchema.parse({
        id: 's',
        scene: 'park',
        duration: 1,
        actions: [{ t: 0, actor: 'mouse', do: 'nod', on: 'lion' }],
      })
    ).toThrow(/on needs/);
    const p = shot({ on: 'tiger' }, [{ t: 0, actor: 'mouse', set: { at: 'center' }, on: 'mouse' }]);
    const msgs = validateShot(p.shots[0], p).map((w) => w.message);
    expect(msgs).toContain("cast 'mouse': on: 'tiger' is not in the cast");
    expect(msgs).toContain("on: 'mouse' cannot stand on itself");
  });
});
