import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { applySprings } from '../src/engine/springs.js';
import { gripAt, resolveFrame, turnBy } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

type Raw = Record<string, unknown>;

function film(scene: string, cast: Raw, actions: unknown[], more: Raw = {}): Project {
  const shot = ShotSchema.parse({ id: 's', scene, duration: 4, cast, actions, ...more });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { woman: LIBRARY.characters.woman },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}
const shot = (p: Project) => p.shots[0];

describe('the wind on what hangs', () => {
  /** How far the woman's plait is turned at t, standing in a wind. */
  const plait = (wind: number, t: number, facing = 'right') => {
    const p = film('park', { woman: { at: { x: 640, y: 640 }, facing } }, [], {
      weather: { wind },
    });
    const actor = resolveFrame(p, shot(p), t).actors[0];
    const pose = poseFor(actor, t);
    applySprings(p, shot(p), actor, pose, t);
    return pose.rot.plait ?? 0;
  };

  it('blows it downwind from the first frame, and flutters it', () => {
    expect(Math.abs(plait(0, 0))).toBeLessThan(0.01);
    expect(Math.abs(plait(0, 2))).toBeLessThan(0.01);
    // Facing right, a wind to the right throws the hanging plait forward (turned back on
    // the clock), a wind to the left behind her; already so as the shot opens.
    expect(plait(1, 0)).toBeLessThan(-6);
    expect(plait(-1, 0)).toBeGreaterThan(6);
    // Facing the other way the same wind turns it the other way in her own frame.
    expect(plait(1, 0, 'left')).toBeGreaterThan(6);
    // A light wind less than a strong one; and the gusts move it.
    expect(Math.abs(plait(0.3, 1))).toBeLessThan(Math.abs(plait(1, 1)));
    const swings = [0.5, 1, 1.5, 2, 2.5, 3].map((t) => plait(1, t));
    expect(Math.max(...swings) - Math.min(...swings)).toBeGreaterThan(2);
    expect(Math.max(...swings.map(Math.abs))).toBeLessThanOrEqual(28);
  });
});

describe('the wind on what is held', () => {
  /** A flag streaming right (or, at sail 1, as much a sail as an umbrella), gripped low. */
  const flag = (catches?: number) =>
    CharacterSchema.parse({
      id: 'flag',
      name: 'Flag',
      rig: 'simple',
      height: 220,
      ...(catches === undefined ? {} : { sail: catches }),
      grip: [40, 190],
      parts: {
        body: `<path d='M40 6 L40 198' stroke='#333' stroke-width='6'/><path d='M43 10 L170 18 L170 82 L43 76 Z' fill='orange'/>`,
      },
    });
  const held = (wind: number, facing = 'right', catches: number | null = 1) => {
    const cast = { woman: { at: { x: 640, y: 640 }, facing }, flag: { at: { x: 640, y: 640 } } };
    const p = film('park', cast, [{ t: 0, actor: 'flag', attach: 'woman' }], {
      weather: { wind },
    });
    p.characters.flag = flag(catches ?? undefined);
    return p;
  };
  const at = (p: Project, t: number) => {
    const f = resolveFrame(p, shot(p), t);
    const woman = f.actors.find((a) => a.id === 'woman')!;
    const prop = f.actors.find((a) => a.id === 'flag')!;
    const hand = holdPoint(woman, poseFor(woman, t));
    const grip = turnBy(prop.tilt, gripAt(prop.character, prop, prop.scale, prop.facing));
    return { prop, hand, gap: Math.hypot(grip.x - hand.x, grip.y - hand.y) };
  };
  const lean = (p: Project, t: number) => at(p, t).prop.tilt?.deg ?? 0;

  it('leans downwind about the hand, and gusts', () => {
    expect(lean(held(0), 1)).toBe(0);
    // Clockwise (its top to the right) in a wind to the right, whichever way she faces.
    expect(lean(held(1), 0)).toBeGreaterThan(5);
    expect(lean(held(-1), 0)).toBeLessThan(-5);
    expect(lean(held(1, 'left'), 0)).toBeGreaterThan(5);
    const swings = [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => lean(held(1), t));
    expect(Math.max(...swings) - Math.min(...swings)).toBeGreaterThan(5);
    expect(Math.max(...swings.map(Math.abs))).toBeLessThan(32);
    // A light wind or a smaller sail leans it less; a prop that is no sail not at all.
    expect(lean(held(0.3), 1)).toBeLessThan(lean(held(1), 1));
    expect(lean(held(1, 'right', 0.5), 1)).toBeLessThan(lean(held(1), 1));
    expect(lean(held(1, 'right', null), 1)).toBe(0);
  });

  it('keeps the grip in the hand, the arm giving downwind', () => {
    for (const [wind, facing] of [
      [1, 'right'],
      [1, 'left'],
      [-1, 'right'],
      [0.5, 'left'],
    ] as const)
      for (const t of [0, 0.7, 1.9, 3.2]) expect(at(held(wind, facing), t).gap).toBeLessThan(0.01);
    // The hand is carried the way the wind blows, by a share of the lean.
    const calm = at(held(0), 1).hand.x;
    expect(at(held(1), 1).hand.x).toBeGreaterThan(calm + 1);
    expect(at(held(-1), 1).hand.x).toBeLessThan(calm - 1);
  });

  it('turns a flag in the hand to stream downwind', () => {
    // Drawn streaming right: carried so by someone facing left in a wind to the right, and
    // turned round for someone facing right in a wind to the left. In still air it faces the
    // way its holder does.
    expect(at(held(1, 'left'), 1).prop.facing).toBe('right');
    expect(at(held(-1, 'right'), 1).prop.facing).toBe('left');
    expect(at(held(0, 'left'), 1).prop.facing).toBe('left');
  });
});
