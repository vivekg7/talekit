import { describe, expect, it } from 'vitest';
import { composeFrame, maskDocument } from '../src/engine/compose.js';
import { airOf, hazeAt, perspectiveAt, skyColor } from '../src/engine/depth.js';
import { resolveFrame, resolvePosition } from '../src/engine/timeline.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { sceneFindings, shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';
import { sceneSheetSvg } from '../src/render/sheets.js';

const park = SceneSchema.parse(LIBRARY.scenes.park);
const PERSPECTIVE: [[number, number], [number, number]] = [
  [500, 0.6],
  [660, 1],
];

function project(scene: Record<string, unknown> = {}, shot: Record<string, unknown> = {}): Project {
  const s = SceneSchema.parse({ ...park, id: 'yard', ...scene });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, cat: LIBRARY.characters.cat },
    scenes: { yard: s },
    shots: [
      ShotSchema.parse({
        id: 'a',
        scene: 'yard',
        duration: 2,
        cast: { kid: { at: { x: 300, y: 660 } }, cat: { at: { x: 900, y: 520 } } },
        ...shot,
      }),
    ],
  };
}

describe('scene perspective', () => {
  it('is a straight line in floor y through its two rows, run on past them', () => {
    const s = { perspective: PERSPECTIVE };
    expect(perspectiveAt(s, 500)).toBeCloseTo(0.6);
    expect(perspectiveAt(s, 580)).toBeCloseTo(0.8);
    expect(perspectiveAt(s, 700)).toBeCloseTo(1.1);
    expect(perspectiveAt(s, 100)).toBe(0.05); // past the horizon: kept just visible
    expect(perspectiveAt({}, 500)).toBeUndefined();
  });

  it('sizes unscaled anchors, spots and shortcuts by their depth, and leaves set ones alone', () => {
    const p = project({
      perspective: PERSPECTIVE,
      anchors: {
        far: { x: 600, y: 500 },
        dais: { x: 900, y: 420, ground: 580 },
        seat: { x: 1010, y: 619, floor: 660 },
        set: { x: 200, y: 500, scale: 0.9 },
      },
    });
    const scene = p.scenes.yard;
    const at = (pos: Parameters<typeof resolvePosition>[2]) => resolvePosition(p, scene, pos).scale;
    expect(at('far')).toBeCloseTo(0.6);
    expect(at('dais')).toBeCloseTo(0.8); // by the foot of the dais, not where its top is drawn
    expect(at('seat')).toBeCloseTo(1); // by the floor under the seat
    expect(at('set')).toBe(0.9);
    expect(at({ x: 10, y: 580 })).toBeCloseTo(0.8);
    expect(at({ x: 10, y: 400, ground: 660 })).toBeCloseTo(1);
    expect(at({ x: 10, y: 580, scale: 1.3 })).toBe(1.3);
    expect(at('center')).toBeCloseTo(perspectiveAt(scene, 650)!);
  });

  it('changes nothing in a scene without one', () => {
    const p = project();
    const scene = p.scenes.yard;
    expect(resolvePosition(p, scene, 'gate').scale).toBe(1);
    expect(resolvePosition(p, scene, 'path-far').scale).toBe(0.72);
    expect(resolvePosition(p, scene, { x: 10, y: 500 }).scale).toBe(1);
    expect(resolvePosition(p, scene, 'center').scale).toBe(1);
  });

  it("flags an anchor's or a cast spot's scale well off it, with the scale it should be", () => {
    const p = project(
      {
        perspective: PERSPECTIVE,
        anchors: {
          ok: { x: 600, y: 580, scale: 0.85 },
          throne: { x: 900, y: 500, scale: 0.95 },
          bird: { x: 600, y: 100, scale: 0.4 },
        },
        allow: { 'world.anchor:bird': 'in the sky' },
      },
      { cast: { kid: { at: { x: 300, y: 500, scale: 1 } }, cat: { at: { x: 900, y: 580 } } } }
    );
    const scene = sceneFindings(p.scenes.yard, 1280).filter((f) => f.code === 'world.scale');
    // Within a fifth is fine; a spot in the air has no floor to measure it by.
    expect(scene.map((f) => f.message.split(' ')[1])).toEqual(["'throne'"]);
    expect(scene[0].message).toContain('0.6 at its depth');
    const shot = shotFindings(p, p.shots[0]).filter((f) => f.code === 'world.scale');
    expect(shot.map((f) => f.actors)).toEqual([['kid']]);
    expect(shot[0].fix).toEqual({ path: '/cast/kid/at/scale', value: 0.6 });
  });

  it('waives the finding by name', () => {
    const p = project({
      perspective: PERSPECTIVE,
      anchors: { giant: { x: 900, y: 500, scale: 2 } },
      allow: { 'world.scale:giant': 'a giant' },
    });
    expect(sceneFindings(p.scenes.yard, 1280).filter((f) => f.code === 'world.scale')).toEqual([]);
  });

  it('draws the ghost at a few depths on the anchor sheet', () => {
    const p = project({ perspective: PERSPECTIVE });
    const svg = sceneSheetSvg(p, p.scenes.yard);
    expect(svg).toContain('cyan bars = perspective');
    expect((svg.match(/×\d\.\d\d/g) ?? []).length).toBe(5);
    expect(sceneSheetSvg(project(), project().scenes.yard)).not.toMatch(/×\d\.\d\d/);
  });
});

describe('a fire on the stage', () => {
  const fire = { kind: 'fire', x: 640, y: 600 };
  const order = (svg: string) => ({
    fire: svg.indexOf("<g class='fire'>"),
    glow: svg.indexOf("<g class='fire-glow'>"),
    kid: svg.indexOf("class='actor actor-kid'"),
    cat: svg.indexOf("class='actor actor-cat'"),
  });

  it('stands among the actors: behind whoever is in front of it, over whoever is behind', () => {
    const p = project(
      { effects: [fire] },
      { cast: { kid: { at: { x: 600, y: 660 } }, cat: { at: { x: 680, y: 540 } } } }
    );
    const o = order(composeFrame(p, p.shots[0], 1));
    expect(o.cat).toBeLessThan(o.fire);
    expect(o.fire).toBeLessThan(o.kid);
    // Its glow lies on the floor under everyone.
    expect(o.glow).toBeGreaterThan(-1);
    expect(o.glow).toBeLessThan(o.cat);
  });

  it('has what is cast at its own spot in front of it (a flare out of the fire)', () => {
    const p = project(
      { effects: [fire] },
      { cast: { kid: { at: { x: 300, y: 660 } }, cat: { at: { x: 640, y: 600 } } } }
    );
    const o = order(composeFrame(p, p.shots[0], 1));
    expect(o.fire).toBeLessThan(o.cat);
  });

  it('counts as cover over whoever is behind it, for the sight checks', () => {
    const p = project(
      { effects: [fire] },
      { cast: { kid: { at: { x: 600, y: 660 } }, cat: { at: { x: 680, y: 540 } } } }
    );
    const frame = resolveFrame(p, p.shots[0], 1);
    expect(maskDocument(p, frame, { front: 'cat' })).toContain("class='fire'");
    expect(maskDocument(p, frame, { front: 'kid' })).not.toContain("class='fire'");
    expect(maskDocument(p, frame, { over: 'cat' })).toContain("class='fire'");
  });
});

describe('aerial perspective', () => {
  const filterOf = (svg: string, id: string) => {
    const i = svg.indexOf(`class='actor actor-${id}'`);
    const start = svg.lastIndexOf('<filter', i);
    return svg.slice(start, svg.indexOf('</filter>', start));
  };

  it('fades a far actor toward the air, and leaves the nearest row alone', () => {
    const p = project({ perspective: PERSPECTIVE, anchors: { front: { x: 640, y: 660 } } });
    const svg = composeFrame(p, p.shots[0], 1);
    // The cat at the back, at 0.65 of the front row: lighter, toward the sky's horizon.
    expect(filterOf(svg, 'cat')).toMatch(/intercept='0\.\d+'/);
    expect(svg.slice(0, svg.indexOf("class='actor actor-kid'"))).not.toContain('tk-lit-1');
  });

  it('grows with distance up to `depth.haze`, toward the painted sky', () => {
    const p = project({ perspective: PERSPECTIVE });
    const air = airOf(p.scenes.yard, {}, 650)!;
    expect(skyColor(p.scenes.yard)).toBe('#cfeeff');
    expect(air.rgb[2]).toBeCloseTo(1);
    expect(hazeAt(air, air.near)).toBe(0);
    expect(hazeAt(air, air.near * 0.75)).toBeGreaterThan(0);
    expect(hazeAt(air, air.near * 0.75)).toBeLessThan(hazeAt(air, air.near * 0.5));
    expect(hazeAt(air, air.near * 0.2)).toBeCloseTo(air.amount);
    expect(air.amount).toBeLessThanOrEqual(0.35);
    // Less by default at night, where faces have less light to read by.
    expect(
      airOf(p.scenes.yard, { light: { color: '#4a5a8f', amount: 0.7 } }, 650)!.amount
    ).toBeLessThan(air.amount);
  });

  it('turns off with depth.haze 0', () => {
    const p = project({ perspective: PERSPECTIVE, depth: { haze: 0 } });
    expect(airOf(p.scenes.yard, {}, 650)).toBeUndefined();
    expect(composeFrame(p, p.shots[0], 1)).not.toContain('intercept=');
  });

  it('leaves a scene where everyone stands at the same scale as it was', () => {
    const p = project({}, { cast: { kid: { at: 'gate' }, cat: { at: 'bench' } } });
    expect(composeFrame(p, p.shots[0], 1)).not.toContain('intercept=');
  });
});
