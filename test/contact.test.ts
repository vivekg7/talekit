import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { STRIKE_HIT } from '../src/engine/motion.js';
import { staging } from '../src/engine/stage.js';
import { resolveFrame, touchPoint, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { CONTACT_MISS, shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';
import { validateShot } from '../src/project/validate.js';

const STICK = CharacterSchema.parse({
  id: 'stick',
  name: 'Stick',
  rig: 'simple',
  height: 150,
  grip: [100, 185],
  tip: [100, 5],
  parts: { body: `<rect x='92' y='0' width='16' height='200' fill='brown'/>` },
});

function project(cast: Record<string, unknown>, actions: unknown[]): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 3, cast, actions });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      grownup: LIBRARY.characters.grownup,
      stick: STICK,
    },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

const HIT = 1 + 0.7 * STRIKE_HIT;
const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
const touch = (p: Project, t = HIT) => touchPoint(p, p.scenes.park, p.shots[0], 'grownup', t);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const reach = (p: Project) => shotFindings(p, p.shots[0]).filter((f) => f.code === 'contact.reach');

/** The grown-up, a stick in hand, strikes at `to` from x 450. */
const blow = (to: unknown, kidAt = 620, facing = 'right') =>
  project(
    {
      grownup: { at: { x: 450, y: 640 }, facing },
      kid: { at: { x: kidAt, y: 640 }, facing: 'left' },
      stick: { at: { x: 450, y: 640 } },
    },
    [
      { t: 0, actor: 'stick', attach: 'grownup' },
      { t: 1, actor: 'grownup', do: 'strike', to },
    ]
  );

describe('strike at something', () => {
  it('brings the stick down onto someone, its end on their shoulders', () => {
    const p = blow('kid');
    const kid = at(p, 'kid', HIT);
    const spot = { x: kid.x, y: kid.y - kid.character.height * kid.scale * 0.7 };
    const tall = at(p, 'grownup', HIT).character.height;
    expect(dist(touch(p), spot)).toBeLessThan(CONTACT_MISS * tall);
    // From above: the hand is up over the spot it comes down on.
    const g = at(p, 'grownup', HIT);
    expect(holdPoint(g, poseFor(g, HIT)).y).toBeLessThan(spot.y - 20);
    // Before and after the blow the stick is nowhere near.
    expect(dist(touch(p, 1.1), spot)).toBeGreaterThan(60);
    expect(reach(p)).toEqual([]);
  });

  it('reaches down to a spot low in front, as on a washing stone', () => {
    const p = blow({ x: 600, y: 600 });
    expect(dist(touch(p), { x: 600, y: 600 })).toBeLessThan(10);
    expect(reach(p)).toEqual([]);
  });

  it('turns the striker to what it strikes first', () => {
    const p = blow('kid', 620, 'left');
    expect(staging(p, p.scenes.park, p.shots[0]).map((a) => a.staged)).toEqual(['strikes kid']);
    expect(at(p, 'grownup', HIT).facing).toBe('right');
  });

  it('says how close to stand when the blow falls short, or a long stick passes over', () => {
    const [far] = reach(blow('kid', 950));
    expect(far.actors).toEqual(['grownup']);
    expect(far.message).toMatch(
      /strikes at 'kid' from 500 px away, but it lands \d+ px short of it/
    );
    expect(far.message).toMatch(/Stand 'grownup' closer, about \d+ px from it/);
    const [near] = reach(blow({ x: 470, y: 560 }));
    expect(near.message).toMatch(/past it.*further back/);
  });

  it('takes an actor in the cast as its target', () => {
    const p = blow('kid');
    expect(validateShot(p.shots[0], p).map((x) => x.message)).toEqual([]);
  });
});
