import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import { strikeAt } from '../src/engine/weather.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { sceneSheetSvg } from '../src/render/sheets.js';
import { validateScene, validateShot } from '../src/project/validate.js';

const W = 1280;
const H = 720;
const park = SceneSchema.parse(LIBRARY.scenes.park);

function project(scene: unknown, shot: Record<string, unknown> = {}): Project {
  const s = SceneSchema.parse({ ...park, id: 'wet', ...(scene as object) });
  return {
    meta: { title: 't', width: W, height: H, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid },
    scenes: { wet: s },
    shots: [
      ShotSchema.parse({
        id: 'a',
        scene: 'wet',
        duration: 4,
        cast: { kid: { at: 'center' } },
        ...shot,
      }),
    ],
  };
}

const lines = (svg: string, cls: string) => {
  const g = svg.match(new RegExp(`<g class='${cls}'.*?</g></g>`))?.[0] ?? '';
  return [
    ...g.matchAll(
      /<line x1='([-\d.]+)' y1='([-\d.]+)' x2='([-\d.]+)' y2='([-\d.]+)' stroke-opacity/g
    ),
  ].map((m) => m.slice(1).map(Number));
};

describe('weather', () => {
  it('makes the rain fall from frame to frame, the same way every time', () => {
    const p = project({ weather: { rain: {} } });
    const a = composeFrame(p, p.shots[0], 1);
    const b = composeFrame(p, p.shots[0], 1 + 1 / 24);
    expect(composeFrame(p, p.shots[0], 1)).toBe(a);
    expect(lines(a, 'rain-back').length).toBeGreaterThan(50);
    expect(lines(a, 'rain-back')).not.toEqual(lines(b, 'rain-back'));
    // Behind the actors in the world group, a few in front of them over it.
    expect(a.indexOf("class='rain-back'")).toBeLessThan(a.indexOf("class='actor"));
    expect(a.indexOf("class='rain-front'")).toBeGreaterThan(a.lastIndexOf("class='actor"));
    expect(a).toContain("class='rain-splash'");
  });

  it('keeps rain under a shelter out of the frame above it', () => {
    const p = project({ weather: { rain: { amount: 1, top: 300 } } });
    const svg = composeFrame(p, p.shots[0], 2);
    for (const cls of ['rain-back', 'rain-front'])
      for (const [, y1] of lines(svg, cls)) expect(y1).toBeGreaterThanOrEqual(300 - 0.01);
  });

  it("lets a shot's weather replace the scene's", () => {
    const p = project({ weather: { rain: {} } }, { weather: {} });
    expect(composeFrame(p, p.shots[0], 1)).not.toContain('rain-');
  });

  it('flashes the frame at a lightning action and only just after it', () => {
    const p = project({}, { actions: [{ t: 1, lightning: true }] });
    expect(composeFrame(p, p.shots[0], 0.9)).not.toContain('tk-flash');
    const lit = composeFrame(p, p.shots[0], 1.03);
    expect(lit).toContain("filter='url(#tk-flash)'");
    expect(lit).toContain("class='lightning'");
    expect(composeFrame(p, p.shots[0], 2)).not.toContain('tk-flash');
  });

  it('strikes on its own when the weather has lightning', () => {
    const p = project({ weather: { lightning: { every: 3 } } });
    const ts = strikeAt('a', 3, 0);
    expect(ts).toBeGreaterThan(0);
    expect(ts).toBeLessThan(3);
    expect(composeFrame(p, p.shots[0], ts + 0.02)).toContain('tk-flash');
  });

  it('dims the frame under dark clouds, drawn in the far layer', () => {
    const p = project({ weather: { clouds: { amount: 1, dark: 1 } } });
    const svg = composeFrame(p, p.shots[0], 1);
    expect(svg.indexOf("class='clouds'")).toBeGreaterThan(svg.indexOf("class='far'"));
    expect(svg.indexOf("class='clouds'")).toBeLessThan(svg.indexOf("class='camera'"));
    expect(svg).toContain("fill='#1c2333'");
  });

  it('warns when sky weather has no far layer to be drawn in', () => {
    const home = SceneSchema.parse({ ...LIBRARY.scenes.home, weather: { clouds: {} } });
    expect(validateScene(home, W, H).some((p) => p.message.includes('far layer'))).toBe(true);
    const p = project({ far: undefined }, { actions: [{ t: 1, lightning: true }] });
    expect(validateShot(p.shots[0], p).some((x) => x.message.includes('far layer'))).toBe(true);
  });
});

describe('effects', () => {
  const effects = [
    { kind: 'fire', x: 400, y: 600 },
    { kind: 'waves', y: 450, height: 100, layer: 'far' },
    { kind: 'sun', x: 1000, y: 120 },
    { kind: 'smoke', x: 900, y: 500, layer: 'front' },
    { kind: 'waterfall', x: 200, y: 200 },
  ];

  it('draws each effect on its plane: far, behind the actors, in front of them', () => {
    const p = project({ effects });
    const svg = composeFrame(p, p.shots[0], 1);
    const at = (cls: string) => svg.indexOf(`class='${cls}'`);
    const actor = svg.indexOf("class='actor ");
    expect(at('sun')).toBeLessThan(at('camera'));
    expect(at('waves')).toBeLessThan(at('camera'));
    expect(at('fire')).toBeGreaterThan(at('camera'));
    expect(at('fire')).toBeLessThan(actor);
    expect(at('waterfall')).toBeLessThan(actor);
    expect(at('smoke')).toBeGreaterThan(actor);
  });

  it('moves with time', () => {
    const p = project({ effects });
    const fire = (t: number) =>
      composeFrame(p, p.shots[0], t).match(/<g class='fire'>.*?<\/g>(?=<)/)?.[0];
    expect(fire(1)).not.toEqual(fire(1.1));
  });

  it('needs an x except for waves', () => {
    expect(() => SceneSchema.parse({ ...park, effects: [{ kind: 'fire', y: 600 }] })).toThrow();
    expect(() =>
      SceneSchema.parse({ ...park, effects: [{ kind: 'waves', y: 400 }] })
    ).not.toThrow();
  });

  it('shows the scene moving on its sheet', () => {
    const p = project({ effects, weather: { rain: {} } });
    const sheet = sceneSheetSvg(p, p.scenes.wet);
    expect(sheet).toContain('moving · t=0.4s');
    // Ids inside each moment are its own, so one moment's flash cannot light another.
    expect(sheet).toContain("id='tk-m1-fx-stage-0-glow'");
  });
});
