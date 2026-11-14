import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { STRIKE_HIT } from '../src/engine/motion.js';
import { staging } from '../src/engine/stage.js';
import { resolveFrame, touchPoint, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { CONTACT_MISS, shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';
import { validateScene, validateShot } from '../src/project/validate.js';

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

/** The park with a washing stone used sitting, facing right, the cloth landing at `use`. */
const STONE = { x: 450, y: 640, use: { pose: 'sit', facing: 'right', at: [560, 610] } };
const washer = (fromX: number, t: number, more: unknown[] = [], at = STONE.use.at) => {
  const p = project(
    { grownup: { at: { x: fromX, y: 640 }, facing: 'left' }, stick: { at: { x: fromX, y: 640 } } },
    [
      { t: 0, actor: 'stick', attach: 'grownup' },
      ...more,
      { t, actor: 'grownup', do: 'strike', to: 'stone' },
    ]
  );
  p.shots[0].duration = 5;
  const park = LIBRARY.scenes.park;
  p.scenes.park = SceneSchema.parse({
    ...park,
    anchors: { ...park.anchors, stone: { ...STONE, use: { ...STONE.use, at } } },
  });
  return p;
};
const hitAt = (t: number) => t + 0.7 * STRIKE_HIT;

describe('a place that says how it is used', () => {
  it('opens the shot sat at it, facing its way, when the work starts at once', () => {
    const p = washer(450, 0.2);
    const added = staging(p, p.scenes.park, p.shots[0]);
    expect(added.map((a) => [a.do ?? a.set?.facing, a.t, a.staged])).toEqual([
      ['sit', 0, 'sits at stone to strike'],
      ['right', 0, 'strikes stone'],
    ]);
    const g = at(p, 'grownup', 0);
    expect(g.sit).toBe(1);
    // The blow lands on the work point, not on the anchor where the washer sits.
    expect(dist(touch(p, hitAt(0.2)), { x: 560, y: 610 })).toBeLessThan(
      CONTACT_MISS * g.character.height
    );
    expect(reach(p)).toEqual([]);
  });

  it('walks its doer over and sits it down in time for the work', () => {
    const p = washer(150, 3);
    const [go] = staging(p, p.scenes.park, p.shots[0]);
    expect(go).toMatchObject({ do: 'sit', to: 'stone', staged: 'sits at stone to strike' });
    const g = at(p, 'grownup', 3);
    expect([g.x, g.y, g.sit, g.facing]).toEqual([450, 640, 1, 'right']);
    expect(reach(p)).toEqual([]);
  });

  it('leaves a doer busy elsewhere, and says it never got there', () => {
    const p = washer(150, 3, [{ t: 1, actor: 'grownup', do: 'wave', duration: 1.8 }]);
    expect(staging(p, p.scenes.park, p.shots[0]).filter((a) => a.do)).toEqual([]);
    const [f] = reach(p);
    expect(f.message).toMatch(/from 300 px away: it had no time to go there first, or was busy/);
    expect(f.message).toMatch(/Give it a `sit` to 'stone'/);
  });

  it('says where to put a work point out of reach', () => {
    const [f] = reach(washer(450, 0.2, [], [900, 610]));
    expect(f.message).toMatch(/its `use.at` is out of reach.*about \[\d+, \d+\]/);
  });

  it('warns of a place that faces away from its own work point', () => {
    const scene = SceneSchema.parse({
      ...LIBRARY.scenes.park,
      anchors: { stone: { ...STONE, use: { ...STONE.use, facing: 'left' } } },
    });
    expect(validateScene(scene, 1280, 720).map((x) => x.message)).toContain(
      "anchor 'stone' faces left, away from its use.at [560, 610]"
    );
  });
});
