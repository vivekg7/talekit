import { describe, expect, it } from 'vitest';
import { poseFor, renderShadow } from '../src/engine/actor.js';
import { composeFrame, layerTransform } from '../src/engine/compose.js';
import { cullOffFrame, parseTransform } from '../src/engine/cull.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateScene, validateShot } from '../src/project/validate.js';
import { rasterize } from '../src/render/raster.js';

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

describe('culling', () => {
  const far = `<circle cx='-3000' cy='100' r='20' fill='#363'/>`;
  const id = (s: string) => parseTransform(s)!;

  it('leaves out shapes a frame or more outside, through every transform', () => {
    const near = `<circle cx='100' cy='100' r='20' fill='#363'/>`;
    expect(cullOffFrame(near + far, id(''), W, H)).toBe(near);
    // Just under a frame out is kept: a blur or a shadow could still reach in.
    const edge = `<rect x='-1290' y='0' width='20' height='20'/>`;
    expect(cullOffFrame(edge, id(''), W, H)).toBe(edge);
    // A group moves its shapes, and empties out when they all go.
    const moved = `<g transform='translate(3100 0)'>${far}</g>`;
    expect(cullOffFrame(moved, id(''), W, H)).toBe(moved);
    expect(cullOffFrame(`<g opacity='.5'>${far}</g>`, id(''), W, H)).toBe('');
    // The camera's own transform counts: zoomed in, a shape at the scene's edge is far.
    const corner = `<path d='M1230 0 q 10 5 0 10 a5 5 0 1 1 -5 -5Z'/>`;
    expect(cullOffFrame(corner, id(''), W, H)).toBe(corner);
    expect(
      cullOffFrame(corner, id(layerTransform({ zoom: 4, x: 160, y: 630 }, W, H, 1)), W, H)
    ).toBe('');
  });

  it('keeps what it cannot measure, what is drawn by reference, and definitions', () => {
    const keep =
      `<defs><linearGradient id='g'/></defs>` +
      `<circle id='sun' cx='-3000' cy='0' r='9'/><use href='#sun' x='3100'/>` +
      `<text x='-3000' y='0'>far</text>` +
      `<path d='M-3000 0 L-2990 0 X'/>`;
    expect(cullOffFrame(keep, id(''), W, H)).toBe(keep);
  });

  it('measures a line by its ends', () => {
    const line = (y: number) => `<line x1='8' y1='${y}' x2='42' y2='${y - 27}' stroke='#000'/>`;
    expect(cullOffFrame(line(933), id(''), W, H)).toBe(line(933));
    expect(cullOffFrame(line(933), id('translate(0 -400) scale(2)'), W, H)).toBe(line(933));
    expect(cullOffFrame(line(933), id('translate(0 -100) scale(2)'), W, H)).toBe('');
  });

  it('looks inside a group with an id nothing points at: a swaying crown', () => {
    // Sway turns these groups every frame; kept whole, a close camera left their far
    // leaves for resvg to panic on.
    const crown = `<g transform='rotate(1.2 640 0)' id='crown'>${far}<circle cx='600' cy='100' r='20' fill='#363'/></g>`;
    expect(cullOffFrame(crown, id(''), W, H)).toBe(
      `<g transform='rotate(1.2 640 0)' id='crown'><circle cx='600' cy='100' r='20' fill='#363'/></g>`
    );
  });

  it("moves a lone shape's opacity into its paint where it draws the same", () => {
    const cull = (s: string) => cullOffFrame(s, id(''), W, H);
    expect(cull(`<circle cx='9' cy='9' r='5' fill='#fff' opacity='0.5'/>`)).toBe(
      `<circle cx='9' cy='9' r='5' fill='#fff' fill-opacity='0.5'/>`
    );
    expect(cull(`<path d='M0 0 L9 9' stroke='#fff' fill='none' opacity='0.5'/>`)).toBe(
      `<path d='M0 0 L9 9' stroke='#fff' fill='none' stroke-opacity='0.5'/>`
    );
    // Through what its group gives it: the group's stroke, the group's fill-opacity.
    expect(cull(`<g stroke='#000'><circle cx='9' cy='9' r='5' opacity='0.5'/></g>`)).toBe(
      `<g stroke='#000'><circle cx='9' cy='9' r='5' opacity='0.5'/></g>`
    );
    expect(
      cull(`<g fill-opacity='0.5'><circle cx='9' cy='9' r='5' fill='#fff' opacity='0.5'/></g>`)
    ).toBe(
      `<g fill-opacity='0.5'><circle cx='9' cy='9' r='5' fill='#fff' fill-opacity='0.25'/></g>`
    );
    // A fill and a stroke overlap, and a group's shapes may too: those keep their opacity.
    const both = `<circle cx='9' cy='9' r='5' fill='#fff' stroke='#000' opacity='0.5'/>`;
    expect(cull(both)).toBe(both);
    const group = `<g opacity='0.5'><circle cx='9' cy='9' r='5'/><circle cx='12' cy='9' r='5'/></g>`;
    expect(cull(group)).toBe(group);
  });

  it('leaves out a canvas outside the bounds of the blurred one it is drawn on', () => {
    // resvg bounds a canvas inside another by the outer one's corner, not the frame: zoomed
    // in twice, this blur starts some 1700 px left of the frame, so a see-through group of
    // two leaves 1860 px right of it lies outside, and resvg panicked on it.
    const blur = `<defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='20'/></filter></defs>`;
    const leaves = `<g opacity='0.8'><circle cx='1250' cy='400' r='10' fill='#fff'/><circle cx='1262' cy='400' r='10' fill='#ffe'/></g>`;
    const near = `<g opacity='0.8'><circle cx='700' cy='400' r='10' fill='#fff'/><circle cx='712' cy='400' r='10' fill='#ffe'/></g>`;
    const svg = (inner: string) =>
      `${blur}<g transform='translate(640 360) scale(2) translate(-640 -360)'><g filter='url(#b)'><rect x='-200' y='300' width='1500' height='200' fill='#9a8'/>${inner}</g></g>`;
    expect(cullOffFrame(svg(near + leaves), id(''), W, H)).toBe(svg(near));
    // Unzoomed, the same leaves lie within its bounds and stay.
    const flat = svg(near + leaves).replace(' scale(2)', '');
    expect(cullOffFrame(flat, id(''), W, H)).toBe(flat);
  });

  it('draws a close-up whose layered shapes lie far off the frame', () => {
    // Before culling, resvg aborted the whole process on this frame.
    const p = project([
      {
        id: 'z',
        scene: 'far-leaf',
        duration: 1,
        camera: { zoom: 4, x: 160, y: 630 },
      },
    ]);
    p.scenes['far-leaf'] = SceneSchema.parse({
      id: 'far-leaf',
      name: 'Far leaf',
      svg: `<rect width='1280' height='720' fill='#9c6'/><ellipse cx='1250' cy='10' rx='20' ry='9' fill='#585' opacity='0.8'/>`,
      near: `<circle cx='-200' cy='900' r='40' fill='#363' opacity='0.6'/>`,
    });
    const png = rasterize(composeFrame(p, p.shots[0], 0.5), 320);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  it('draws a close-up into a blurred, swaying crown with see-through leaves', () => {
    // A crown wider than the frame, blurred on the far layer, swaying, its leaves
    // see-through: a story's scene drawn this way had resvg panic past zoom 1.4.
    const leaves = Array.from(
      { length: 12 },
      (_, i) =>
        `<path d='M${i * 120 - 60} 220 q 20 -20 40 0 t 40 0' fill='#9b6' opacity='0.8'/>` +
        `<g opacity='0.7'><circle cx='${i * 120}' cy='300' r='14' fill='#7a4'/><circle cx='${i * 120 + 10}' cy='306' r='14' fill='#8b5'/></g>`
    ).join('');
    const scene = SceneSchema.parse({
      id: 'crown',
      name: 'Crown',
      far:
        `<defs><filter id='cb' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='22'/></filter></defs>` +
        `<rect width='1280' height='720' fill='#bcd'/>` +
        `<g filter='url(#cb)'><g id='crown'><path d='M-230 0 Q640 -200 1550 0 Q640 260 -230 0Z' fill='#ab8'/>${leaves}</g></g>`,
      svg: `<rect y='600' width='1280' height='120' fill='#9c6'/>`,
      sway: { crown: { at: [640, 0] } },
    });
    for (const [x, y] of [
      [640, 360],
      [100, 100],
      [1180, 620],
    ]) {
      const p = project([{ id: 'z', scene: 'crown', duration: 4, camera: { zoom: 2.5, x, y } }]);
      p.scenes.crown = scene;
      const png = rasterize(composeFrame(p, p.shots[0], 1.3), 320);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
    }
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
