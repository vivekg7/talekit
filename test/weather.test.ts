import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import { strikeAt } from '../src/engine/weather.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { sceneSheetSvg } from '../src/render/sheets.js';
import { validateScene, validateShot } from '../src/project/validate.js';

const W = 1280;
const H = 720;
const park = SceneSchema.parse(LIBRARY.scenes.park);

/** A 200-wide canopy on a pole, as tall as a person: it shelters the span at its top. */
const BROLLY = CharacterSchema.parse({
  id: 'brolly',
  name: 'Brolly',
  rig: 'simple',
  height: 200,
  shelter: { x: 0, y: 20, width: 200, when: 'open' },
  parts: {
    body: {
      open: `<path d='M0 20 Q100 -20 200 20 Z' fill='red'/><path d='M100 20 L100 200' stroke='#333' stroke-width='6'/>`,
      shut: `<path d='M100 0 L100 200' stroke='red' stroke-width='12'/>`,
    },
  },
});

function project(scene: unknown, shot: Record<string, unknown> = {}): Project {
  const s = SceneSchema.parse({ ...park, id: 'wet', ...(scene as object) });
  return {
    meta: { title: 't', width: W, height: H, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, brolly: BROLLY },
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
  const g = svg.match(new RegExp(`<g class='${cls}'.*?</g>(</g>)+`))?.[0] ?? '';
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

describe('shelter', () => {
  // The canopy spans x 540..740 at y 380 + 20 = 400 (feet at 580, 200 tall). A drop is
  // under it when its path, slanting 0.08 in still air, crossed that span on the way down;
  // drops stopping on the canopy end on it, which bobs a little with the idle pose.
  const under = (lines: number[][]) =>
    lines.filter(([, , x2, y2]) => {
      const cross = x2 - 0.08 * (y2 - 400);
      return y2 > 406 && cross > 541 && cross < 739;
    });

  it('keeps the rain off the ground under an open umbrella, and lets it drip', () => {
    const p = project(
      { weather: { rain: { amount: 1 } } },
      { cast: { brolly: { at: { x: 640, y: 580 } } } }
    );
    for (const t of [0.5, 1, 1.5, 2]) {
      const svg = composeFrame(p, p.shots[0], t);
      expect(under(lines(svg, 'rain-back'))).toEqual([]);
      expect(under(lines(svg, 'rain-front'))).toEqual([]);
      expect(svg).toContain("class='rain-drips'");
    }
  });

  it('lets a drip fall free of an umbrella walking on', () => {
    const p = project(
      { weather: { rain: { amount: 1 } } },
      {
        cast: { brolly: { at: { x: 300, y: 580 } } },
        actions: [{ t: 0, actor: 'brolly', do: 'walk', to: { x: 1000, y: 580 }, duration: 4 }],
      }
    );
    // Over one frame the umbrella moves on some 7px; a drop already falling stays where it
    // let go, so the same x turns up in both frames.
    const xs = (t: number) => lines(composeFrame(p, p.shots[0], t), 'rain-drips').map((l) => l[2]);
    let kept = 0;
    for (const t of [1, 1.5, 2, 2.5, 3]) {
      const next = xs(t + 1 / 24);
      kept += xs(t).filter((x) => next.some((y) => Math.abs(x - y) < 0.01)).length;
    }
    expect(kept).toBeGreaterThan(0);
  });

  it('shelters only in the variant it names', () => {
    const p = project(
      { weather: { rain: { amount: 1 } } },
      {
        cast: { brolly: { at: { x: 640, y: 580 } } },
        actions: [{ t: 0, actor: 'brolly', face: { body: 'shut' } }],
      }
    );
    const svg = composeFrame(p, p.shots[0], 1);
    expect(under(lines(svg, 'rain-back')).length).toBeGreaterThan(0);
    expect(svg).not.toContain("class='rain-drips'");
  });

  it('takes shelters drawn into the scene', () => {
    const p = project({
      weather: { rain: { amount: 1 } },
      shelters: [{ x: 540, y: 400, width: 200 }],
    });
    expect(under(lines(composeFrame(p, p.shots[0], 1), 'rain-back'))).toEqual([]);
  });
});

describe('weather turning within a shot', () => {
  it('eases the rain off over the action and keeps the clouds where they are', () => {
    const p = project(
      { weather: { rain: { amount: 1 }, clouds: { amount: 1, dark: 1 } } },
      { actions: [{ t: 1, weather: { clouds: { amount: 0.3 } }, duration: 2 }] }
    );
    const at = (t: number) => composeFrame(p, p.shots[0], t);
    const count = (t: number) => lines(at(t), 'rain-back').length;
    expect(count(2)).toBeLessThan(count(0.5));
    expect(count(2)).toBeGreaterThan(0);
    expect(count(3.5)).toBe(0);
    // A cloud on screen before the turn is in the same place, give or take its drift.
    const firstCloud = (t: number) =>
      Number(at(t).match(/<g class='clouds'>.*?<circle cx='([-\d.]+)'/)![1]);
    expect(Math.abs(firstCloud(3.5) - firstCloud(0.5))).toBeLessThan(60);
  });
});

describe('light', () => {
  /** Each actor's red gain, from the light filter wrapped round it. */
  const redOf = (svg: string) =>
    Object.fromEntries(
      [
        ...svg.matchAll(
          /<feFuncR type='linear' slope='([\d.]+)'\/>.*?<g filter='url\(#tk-lit-\d+\)'><g class='actor actor-(\w+)'/g
        ),
      ].map((m) => [m[2], Number(m[1])])
    );

  it('tints the characters at night and warms one beside a fire', () => {
    const p = project(
      {
        weather: { light: { color: '#4a5a8f', amount: 0.7 } },
        effects: [{ kind: 'fire', x: 300, y: 620 }],
      },
      { cast: { kid: { at: { x: 360, y: 620 } }, brolly: { at: { x: 1100, y: 620 } } } }
    );
    const svg = composeFrame(p, p.shots[0], 1);
    const red = redOf(svg);
    expect(red.brolly).toBeLessThan(0.75);
    expect(red.kid).toBeGreaterThan(red.brolly + 0.2);
    expect(svg).toContain("class='firelight'");
  });

  it('leaves daylight characters untouched', () => {
    const p = project({});
    expect(composeFrame(p, p.shots[0], 1)).not.toContain('tk-lit-');
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
    const sheltered = project({ shelters: [{ x: 100, y: 400, width: 200 }] });
    expect(sceneSheetSvg(sheltered, sheltered.scenes.wet)).toContain('blue = shelters');
  });
});
