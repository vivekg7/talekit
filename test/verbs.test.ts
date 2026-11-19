import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { composeFrame } from '../src/engine/compose.js';
import { toRoot } from '../src/engine/gait.js';
import { applyVerb, basePose, chewing, emptyPose } from '../src/engine/motion.js';
import { RIGS, rigOf, type Rig } from '../src/engine/rigs.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { timeActions } from '../src/engine/voice.js';
import { LIBRARY } from '../src/library/index.js';

const PLATE = CharacterSchema.parse({
  id: 'plate',
  name: 'Plate',
  rig: 'simple',
  height: 16,
  parts: { body: `<ellipse cx='100' cy='180' rx='90' ry='20' fill='white'/>` },
});

function project(cast: Record<string, unknown>, actions: unknown[]): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 8, cast, actions });
  const c = LIBRARY.characters;
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: c.kid, dog: c.dog, bird: c.bird, plate: PLATE },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}
const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
const pose = (p: Project, id: string, t: number) => poseFor(at(p, id, t), t);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
/** One actor alone in the park, doing `actions`. */
const solo = (id: string, actions: unknown[]) =>
  project({ [id]: { at: { x: 400, y: 640 } } }, actions);
/** A verb's pose at `u` of it, on top of standing still. */
const posed = (rig: Rig, verb: Parameters<typeof applyVerb>[2], u: number, span = 1) => {
  const p = basePose(rig, 'idle', 0, 0);
  applyVerb(rig, p, verb, u, 0, undefined, span);
  return p;
};

describe('appear and disappear', () => {
  it('pops in past full size from hidden, and shrinks away to undrawn', () => {
    const p = project(
      { kid: { at: { x: 400, y: 640 } }, bird: { at: { x: 700, y: 640 }, visible: false } },
      [
        { t: 1, actor: 'bird', do: 'appear' },
        { t: 1, actor: 'kid', do: 'disappear' },
      ]
    );
    const drawn = (id: string, t: number) => composeFrame(p, p.shots[0], t).includes(`actor-${id}`);
    expect(drawn('bird', 0.5)).toBe(false);
    expect(pose(p, 'bird', 1.05).sx).toBeLessThan(0.8);
    expect(pose(p, 'bird', 1.2).sx).toBeGreaterThan(1);
    expect(at(p, 'bird', 2)).toMatchObject({ visible: true, opacity: 1 });
    expect(drawn('bird', 2)).toBe(true);

    expect(drawn('kid', 0.5)).toBe(true);
    expect(pose(p, 'kid', 1.3).sx).toBeLessThan(0.8);
    expect(at(p, 'kid', 1.3).opacity).toBeLessThan(1);
    expect(at(p, 'kid', 2).visible).toBe(false);
    expect(drawn('kid', 2)).toBe(false);
  });
});

describe('move', () => {
  it('glides to `to` with the legs still', () => {
    const p = solo('kid', [
      { t: 1, actor: 'kid', do: 'move', to: { x: 800, y: 640 }, duration: 2 },
    ]);
    for (const t of [1.5, 2, 2.5]) {
      const legs = pose(p, 'kid', t).rot;
      expect(at(p, 'kid', t).locomotion).toBe('move');
      expect(Math.abs((legs.legL ?? 0) - (legs.legR ?? 0))).toBeLessThan(1);
    }
    expect(at(p, 'kid', 2).x).toBeCloseTo(600, 0);
    expect(at(p, 'kid', 3).x).toBe(800);
  });
});

describe('simple-rig verbs', () => {
  it('bounces up and lands where it was, squashed as it touches down', () => {
    const p = solo('bird', [{ t: 1, actor: 'bird', do: 'bounce' }]);
    const lift = Math.min(...[1.1, 1.2, 1.25, 1.3].map((t) => pose(p, 'bird', t).dy));
    expect(lift).toBeLessThan(-30);
    expect(pose(p, 'bird', 1.01).sy).toBeLessThan(0.95);
    expect(pose(p, 'bird', 2.5).dy).toBe(0);
    expect([at(p, 'bird', 2.5).x, at(p, 'bird', 2.5).y]).toEqual([400, 640]);
  });

  it('spins a full turn and ends facing the way it started', () => {
    const p = solo('bird', [{ t: 1, actor: 'bird', do: 'spin' }]);
    const turns = [1.3, 1.4, 1.5].map((t) => pose(p, 'bird', t).spin);
    expect(Math.max(...turns)).toBeGreaterThan(180);
    expect(pose(p, 'bird', 2).spin).toBe(0);
    expect(at(p, 'bird', 2).facing).toBe('right');
  });

  it('leans to point and shivers to tremble, settling after', () => {
    const rig = RIGS.simple;
    const still = basePose(rig, 'idle', 0, 0);
    const lean = posed(rig, 'point', 0.5);
    expect(lean.rot.body).toBeLessThan(-15);
    expect(lean.dx).toBeGreaterThan(still.dx);
    expect(posed(rig, 'tremble', 0.27).dx).not.toBe(still.dx);
    expect(Math.abs(posed(rig, 'tremble', 1).dx - still.dx)).toBeLessThan(0.01);
  });
});

describe('gestures', () => {
  it('waves with the near arm and lowers it, points and holds it out', () => {
    const p = solo('kid', [
      { t: 1, actor: 'kid', do: 'wave' },
      { t: 4, actor: 'kid', do: 'point', duration: 2 },
    ]);
    const arm = (t: number) => pose(p, 'kid', t).rot.armR;
    expect(arm(1.75)).toBeLessThan(-60);
    expect(Math.abs(pose(p, 'kid', 1.75).rot.armL)).toBeLessThan(10);
    expect(arm(2.6)).toBeGreaterThan(-10);
    for (const t of [4.5, 5.5]) expect(arm(t)).toBeLessThan(-80);
    expect(arm(6.5)).toBeGreaterThan(-10);
  });

  it('nods the head up and down, and shakes it side to side', () => {
    const p = solo('kid', [
      { t: 1, actor: 'kid', do: 'nod' },
      { t: 3, actor: 'kid', do: 'shake' },
    ]);
    const span = (t0: number, f: (t: number) => number) => {
      const vs = Array.from({ length: 16 }, (_, i) => f(t0 + (i * 0.8) / 16));
      return Math.max(...vs) - Math.min(...vs);
    };
    const tilt = (t: number) => pose(p, 'kid', t).rot.head ?? 0;
    const sideways = (t: number) => pose(p, 'kid', t).off.head[0];
    expect(span(1, tilt)).toBeGreaterThan(8);
    expect(span(1, sideways)).toBeLessThan(0.5);
    expect(span(3, sideways)).toBeGreaterThan(12);
  });
});

describe('kick', () => {
  it('swings the near leg forward and up, then home; lying, up off the bed', () => {
    const rig = RIGS.humanoid;
    const still = basePose(rig, 'idle', 0, 0);
    const peak = posed(rig, 'kick', 0.55);
    expect(peak.rot.legR).toBeLessThan((still.rot.legR ?? 0) - 60);
    expect(peak.bend.legR ?? 0).toBeCloseTo(0);
    const lying = basePose(rig, 'idle', 0, 0);
    applyVerb(rig, lying, 'lie', 1);
    const before = lying.rot.legR ?? 0;
    applyVerb(rig, lying, 'kick', 0.55);
    expect(lying.rot.legR).toBeLessThan(before - 60);
    expect(Math.abs((posed(rig, 'kick', 1).rot.legR ?? 0) - (still.rot.legR ?? 0))).toBeLessThan(
      0.01
    );
  });

  it('bucks four legs: both hind legs lash out behind, the front ones stay', () => {
    const p = solo('dog', [{ t: 1, actor: 'dog', do: 'kick' }]);
    const buck = pose(p, 'dog', 1.5);
    expect(buck.rot.legBR).toBeGreaterThan(40);
    expect(buck.rot.legBL).toBeGreaterThan(40);
    expect(buck.rot.legFR ?? 0).toBe(0);
    expect(pose(p, 'dog', 2).rot.legBR ?? 0).toBe(0);
  });
});

describe('swim', () => {
  it('churns the legs under a body that does not bob', () => {
    const rig = RIGS.quadruped;
    const at = (u: number) => posed(rig, 'swim', u, 3);
    const still = basePose(rig, 'idle', 0, 0);
    // Under way, the forelegs reach out in front and work in turn, stroke after stroke.
    const legs = [0.3, 0.33, 0.36, 0.39, 0.42].map((u) => at(u).rot.legFR ?? 0);
    expect(Math.max(...legs) - Math.min(...legs)).toBeGreaterThan(30);
    expect(Math.min(...legs)).toBeLessThan(-40);
    const mid = at(0.4);
    expect(Math.sign(mid.rot.legFR! + 40)).toBe(-Math.sign(mid.rot.legFL! + 40));
    // Held nose up, and the body stays where it is: the current is a move's to give.
    for (const u of [0.3, 0.35, 0.4, 0.45]) {
      const p = at(u);
      expect(p.rot.body).toBeCloseTo(at(0.3).rot.body ?? 0);
      expect(p.rot.body).toBeLessThan(-8);
      expect([p.dx, p.dy]).toEqual([still.dx, still.dy]);
    }
    expect(at(0).rot.legFR ?? 0).toBeCloseTo(still.rot.legFR ?? 0);
    expect(at(1).rot.legFR ?? 0).toBeCloseTo(still.rot.legFR ?? 0);
    // A person treads water, the arms up by the head.
    const person = posed(RIGS.humanoid, 'swim', 0.5, 3);
    expect(person.rot.armR).toBeLessThan(-80);
    expect(person.rot.armL).toBeLessThan(-80);
  });
});

describe('eat', () => {
  it('brings the near hand to the mouth, chews, and puts it back', () => {
    const rig = RIGS.humanoid;
    const hand = (u: number) => {
      const p = posed(rig, 'eat', u, 1.6);
      const [x, y] = toRoot(rig, p, rig.hold.part, rig.hold.point);
      return [x + p.dx, y + p.dy];
    };
    const still = hand(0);
    // At the mouth (the turned face's, about (124, 128)): just in front of and under it.
    const [x, y] = hand(0.5);
    expect(Math.hypot(x - 124, y - 128)).toBeLessThan(20);
    expect(Math.hypot(...hand(1).map((v, i) => v - still[i]))).toBeLessThan(0.01);
    const chews = (u: number) => chewing([{ verb: 'eat', u, span: 1.6 }]);
    expect(chews(0.1)).toBeUndefined();
    expect(new Set([0.3, 0.34, 0.38, 0.42, 0.46].map(chews))).toEqual(new Set([true, false]));
  });

  it('takes the bite off the plate `to` names first, then eats it at the mouth', () => {
    const cast = { kid: { at: { x: 400, y: 640 } }, plate: { at: { x: 470, y: 640 } } };
    const fromPlate = project(cast, [{ t: 1, actor: 'kid', do: 'eat', to: 'plate' }]);
    const plain = project(cast, [{ t: 1, actor: 'kid', do: 'eat' }]);
    const hand = (p: Project, t: number) => {
      const kid = at(p, 'kid', t);
      return holdPoint(kid, poseFor(kid, t));
    };
    // Eat lasts 1.6 s: on the plate at 0.2 of it, at the mouth by 0.4.
    const plate = at(fromPlate, 'plate', 1);
    expect(dist(hand(fromPlate, 1.32), { x: plate.x, y: plate.y - 8 })).toBeLessThan(12);
    for (const t of [1.7, 2]) expect(dist(hand(fromPlate, t), hand(plain, t))).toBeLessThan(8);
    const chews = (t: number) => chewing(at(fromPlate, 'kid', t).verbs);
    expect(chews(1.5)).toBeUndefined();
    expect(new Set([1.7, 1.76, 1.82, 1.88, 1.94].map(chews))).toEqual(new Set([true, false]));
  });

  it('dips a four-legged head to the floor and pecks on the simple rig', () => {
    expect(posed(RIGS.quadruped, 'eat', 0.5).rot.head).toBeGreaterThan(35);
    expect(posed(RIGS.simple, 'eat', 1 / 12).rot.body).toBeGreaterThan(5);
  });

  it("brings a mouth up a long neck (a camel's `muzzle`) down to the floor", () => {
    const eating = (muzzle?: [number, number]) => {
      const rig = rigOf({ rig: 'quadruped', muzzle });
      const pose = emptyPose();
      applyVerb(rig, pose, 'eat', 0.22, 0, undefined, 1.6);
      return { bow: pose.rot.head, mouth: toRoot(rig, pose, 'head', rig.hold.point)[1] };
    };
    expect(eating().bow).toBeCloseTo(44);
    expect(eating([240, 100]).bow).toBeCloseTo(44);
    const camel = eating([248, 47]);
    expect(camel.bow).toBeGreaterThan(70);
    expect(camel.mouth).toBeGreaterThan(178);
    expect(camel.mouth).toBeLessThan(195);
  });
});

describe('riding `on` someone', () => {
  it('keeps its spot on the back as the mount turns and walks, and its own facing', () => {
    const p = project(
      { dog: { at: { x: 600, y: 660 } }, bird: { at: { x: 590, y: 600 }, on: 'dog' } },
      [{ t: 1, actor: 'dog', do: 'walk', to: { x: 300, y: 660 }, duration: 3 }]
    );
    for (const t of [2, 4.5]) {
      const [dog, bird] = [at(p, 'dog', t), at(p, 'bird', t)];
      expect(dog.facing).toBe('left');
      expect(bird.x - dog.x).toBeCloseTo(10, 0);
      expect(Math.abs(bird.y - 600)).toBeLessThan(4);
      expect(bird.facing).toBe('right');
    }
  });
});

describe('`after`', () => {
  it('times any action from when the line or caption before it ends', () => {
    const p = solo('kid', [
      { after: 0.5, actor: 'kid', do: 'nod' },
      { t: 1, actor: 'kid', say: 'Look at that!' },
      { after: 0.5, actor: 'kid', do: 'jump' },
      { after: 0.2, caption: 'Later' },
      { after: 0.3, actor: 'kid', do: 'wave' },
    ]);
    timeActions(p, p.shots[0]);
    // Unvoiced, three words show 2.2 s; a caption, 3 s.
    expect(p.shots[0].actions.map((a) => a.t)).toEqual([0.5, 1, 3.7, 3.4, 6.7]);
  });
});
