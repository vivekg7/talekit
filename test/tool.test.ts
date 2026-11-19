import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { resolveFrame, touchPoint, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Character, type Project } from '../src/engine/types.js';
import { shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';

/** A ladle: the handle's end in the hand, the bowl (`tip`) out in front and down. */
const LADLE = CharacterSchema.parse({
  id: 'ladle',
  name: 'Ladle',
  rig: 'simple',
  height: 150,
  grip: [30, 100],
  tip: [164, 188],
  parts: { body: `<path d='M30 100 L164 188' stroke='brown' stroke-width='8'/>` },
});
/** The same ladle drawn without saying where its working end is. */
const PLAIN = CharacterSchema.parse({ ...LADLE, tip: undefined });
/** A long pole hung from its top end, its far end (`tip`) well below the holder's feet. */
const POLE = CharacterSchema.parse({
  id: 'ladle',
  name: 'Pole',
  rig: 'simple',
  height: 400,
  grip: [100, 4],
  tip: [100, 196],
  parts: { body: `<rect x='96' y='0' width='8' height='200' fill='brown'/>` },
});

/** The grown-up at x 450 facing right, the kid in front, the grown-up carrying `prop`. */
function project(prop: Character, actions: unknown[]): Project {
  const shot = ShotSchema.parse({
    id: 's',
    scene: 'park',
    duration: 4,
    cast: {
      grownup: { at: { x: 450, y: 640 }, facing: 'right' },
      kid: { at: { x: 560, y: 640 }, facing: 'left' },
      ladle: { at: { x: 450, y: 640 } },
    },
    actions: [{ t: 0, actor: 'ladle', attach: 'grownup' }, ...actions],
  });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      grownup: LIBRARY.characters.grownup,
      ladle: prop,
    },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
const touch = (p: Project, t: number) => touchPoint(p, p.scenes.park, p.shots[0], 'grownup', t);
const handOf = (p: Project, t: number) => {
  const g = at(p, 'grownup', t);
  return holdPoint(g, poseFor(g, t));
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const reach = (p: Project) => shotFindings(p, p.shots[0]).filter((f) => f.code === 'contact.reach');

describe('a tool put to something with a hold or a wipe', () => {
  const hold = (to: unknown, prop = LADLE) =>
    project(prop, [{ t: 1, actor: 'grownup', do: 'hold', to, duration: 1 }]);

  it('puts the working end there, the hand stopping a tool length short', () => {
    const spot = { x: 600, y: 520 };
    const p = hold(spot);
    expect(dist(touch(p, 1.5), spot)).toBeLessThan(3);
    const hand = handOf(p, 1.5);
    expect(dist(hand, spot)).toBeGreaterThan(80);
    expect(hand.x).toBeLessThan(spot.x);
    expect(reach(p)).toEqual([]);
    // Before it and after, the tool is back at rest, away from the spot.
    expect(dist(touch(p, 0.5), spot)).toBeGreaterThan(40);
    expect(dist(touch(p, 2.5), spot)).toBeGreaterThan(40);
  });

  it('dips into something low beside its holder from above', () => {
    const bowl = { x: 520, y: 636 };
    const p = hold(bowl);
    expect(dist(touch(p, 1.5), bowl)).toBeLessThan(3);
    expect(handOf(p, 1.5).y).toBeLessThan(bowl.y - 60);
    expect(reach(p)).toEqual([]);
  });

  it('wipes with the working end', () => {
    const spot = { x: 610, y: 540 };
    const p = project(LADLE, [{ t: 1, actor: 'grownup', do: 'wipe', to: spot, duration: 2 }]);
    // Round in small circles on it: within the circle's size of it.
    expect(dist(touch(p, 2), spot)).toBeLessThan(10);
    expect(dist(handOf(p, 2), spot)).toBeGreaterThan(80);
    expect(reach(p)).toEqual([]);
  });

  it('says it lands short when the tool cannot get there', () => {
    const [far] = reach(hold({ x: 900, y: 520 }));
    expect(far.message).toMatch(/holds at \(900, 520\).*short of it/);
  });

  it('leaves the hand to do it with a prop that has no tip', () => {
    const spot = { x: 560, y: 520 };
    expect(dist(handOf(hold(spot, PLAIN), 1.5), spot)).toBeLessThan(10);
  });

  it('keeps a hand on a shoulder, whatever the hand carries', () => {
    const p = hold('kid');
    expect(Math.abs(handOf(p, 1.5).x - at(p, 'kid', 1.5).x)).toBeLessThan(30);
  });
});

describe('a tool carried at rest', () => {
  it('rests its end on the floor rather than going into it', () => {
    const p = project(POLE, []);
    const end = touch(p, 1);
    expect(end.y).toBeCloseTo(640, 0);
    // Swung up toward the facing, about the hand.
    expect(end.x).toBeGreaterThan(handOf(p, 1).x + 20);
  });

  it('is propped up across the lap by someone sat down', () => {
    const p = project(LADLE, [{ t: 0, actor: 'grownup', do: 'sit', duration: 0.05 }]);
    const end = touch(p, 1);
    const hand = handOf(p, 1);
    // Forward and up, 30° above level.
    const deg = (Math.atan2(hand.y - end.y, end.x - hand.x) * 180) / Math.PI;
    expect(deg).toBeCloseTo(30, 0);
  });

  it('is held as drawn by someone standing when it does not reach the floor', () => {
    const p = project(LADLE, []);
    const end = touch(p, 1);
    const hand = handOf(p, 1);
    expect(dist(end, hand)).toBeCloseTo((150 / 200) * Math.hypot(134, 88), 0);
    // Pointing down and forward, as drawn, above the floor.
    expect(end.y).toBeGreaterThan(hand.y);
    expect(end.y).toBeLessThan(640);
  });
});
