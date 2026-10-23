import { describe, expect, it } from 'vitest';
import { actorHeadTop, characterBody, poseFor, sideOf } from '../src/engine/actor.js';
import { bubblePop } from '../src/engine/bubble.js';
import { composeFrame } from '../src/engine/compose.js';
import { footPoint } from '../src/engine/gait.js';
import { applyVerb, emptyPose, resolveFace } from '../src/engine/motion.js';
import { RIGS } from '../src/engine/rigs.js';
import { applySprings } from '../src/engine/springs.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

function project(actions: unknown[], cast: Record<string, unknown> = {}): Project {
  const shot = ShotSchema.parse({
    id: 's',
    scene: 'park',
    duration: 8,
    cast: {
      kid: { at: { x: 200, y: 640 } },
      dog: { at: { x: 200, y: 660 } },
      ...cast,
    },
    actions,
  });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, dog: LIBRARY.characters.dog },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

const actorAt = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;

/** Each foot's position in the scene, as the composer would draw it. */
function worldFeet(a: ActorState, t: number): Record<string, [number, number]> {
  const rig = RIGS[a.character.rig];
  const pose = poseFor(a, t);
  const s = (a.character.height / rig.height) * a.scale;
  const out: Record<string, [number, number]> = {};
  for (const leg of rig.feet) {
    const [x, y] = footPoint(rig, pose, leg);
    out[leg] = [a.x + s * sideOf(a) * (x - rig.width / 2), a.y + s * (y - rig.height)];
  }
  return out;
}

describe('planted feet', () => {
  const cases = [
    ['kid', 'walk'],
    ['kid', 'run'],
    ['dog', 'walk'],
    ['dog', 'run'],
  ] as const;
  for (const [id, verb] of cases) {
    it(`${id} ${verb}: a foot on the ground does not slide`, () => {
      const p = project([{ t: 0.5, actor: id, do: verb, to: { x: 1000, y: 650 }, duration: 3 }], {
        [id]: { at: { x: 200, y: 650 } },
      });
      const ground = 650;
      let planted = 0;
      let prev = worldFeet(actorAt(p, id, 0.5), 0.5);
      for (let t = 0.5; t <= 3.5; t += 1 / 96) {
        const feet = worldFeet(actorAt(p, id, t), t);
        for (const [leg, [x, y]] of Object.entries(feet)) {
          // Never through the floor, and still while down.
          expect(y).toBeLessThanOrEqual(ground + 0.01);
          const [px, py] = prev[leg];
          if (Math.abs(y - ground) < 0.01 && Math.abs(py - ground) < 0.01) {
            planted++;
            // At the very start and end the stride is settling in: a swinging foot may
            // skim the ground for a frame while the body is barely moving.
            const settling = t < 0.65 || t > 3.35;
            expect(Math.abs(x - px)).toBeLessThan(settling ? 0.5 : 0.005);
          }
        }
        prev = feet;
      }
      expect(planted).toBeGreaterThan(100);
    });
  }

  it('starts and stops with the legs together, easing in and out', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'walk', to: { x: 900, y: 640 }, duration: 3 }]);
    for (const t of [1.001, 3.999]) {
      const pose = poseFor(actorAt(p, 'kid', t), t);
      expect(Math.abs(pose.rot.legL! - pose.rot.legR!)).toBeLessThan(1);
    }
    const x = (t: number) => actorAt(p, 'kid', t).x;
    const average = (900 - 200) / 3;
    expect((x(1.05) - x(1)) / 0.05).toBeLessThan(average / 2);
    expect((x(2.55) - x(2.5)) / 0.05).toBeGreaterThan(average);
    expect((x(4) - x(3.95)) / 0.05).toBeLessThan(average / 2);
  });

  it('crouches in place before a jump and lands where it was sent', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'jump', to: { x: 400, y: 640 } }]);
    expect(actorAt(p, 'kid', 1.1).x).toBe(200);
    const crouch = poseFor(actorAt(p, 'kid', 1.08), 1.08);
    expect(crouch.dy).toBeGreaterThan(10);
    expect(actorAt(p, 'kid', 2).x).toBe(400);
  });
});

describe('weight and follow-through', () => {
  it('turns through a squash instead of mirroring in one frame', () => {
    const p = project([
      { t: 1, actor: 'dog', do: 'walk', to: { x: 600, y: 660 }, duration: 2 },
      { t: 4, actor: 'dog', do: 'walk', to: { x: 300, y: 660 }, duration: 2 },
    ]);
    const sides = [4, 4.05, 4.1, 4.15, 4.25].map((t) => sideOf(actorAt(p, 'dog', t)));
    expect(sides[0]).toBeGreaterThan(0.9);
    expect(Math.abs(sides[2])).toBeLessThan(0.2);
    expect(sides[4]).toBe(-1);
  });

  it('turns a person round with the face, coming through front-on', () => {
    const p = project([
      { t: 1, actor: 'kid', do: 'walk', to: { x: 600, y: 640 }, duration: 2 },
      { t: 4, actor: 'kid', do: 'walk', to: { x: 300, y: 640 }, duration: 2 },
    ]);
    const at = (t: number) => actorAt(p, 'kid', t);
    expect(poseFor(at(3.5), 3.5).yaw).toBe(1);
    // Mid-turn the body only narrows; the face looks out of the screen.
    expect(Math.abs(sideOf(at(4.1)))).toBeGreaterThan(0.7);
    expect(poseFor(at(4.1), 4.1).yaw).toBeLessThan(0.2);
    expect(poseFor(at(4.25), 4.25).yaw).toBe(1);
  });

  it('pops in past full size, and bubbles do the same', () => {
    const pose = emptyPose();
    applyVerb(RIGS.humanoid, pose, 'appear', 0.5);
    expect(pose.sx).toBeGreaterThan(1);
    const early = emptyPose();
    applyVerb(RIGS.humanoid, early, 'appear', 0.05);
    expect(early.sx).toBeLessThan(0.8);
    expect(bubblePop(0.03).scale).toBeLessThan(0.7);
    expect(bubblePop(0.2).scale).toBeGreaterThan(1);
    expect(bubblePop(1, 0.05).scale).toBeLessThan(1);
    expect(bubblePop(1, 5)).toEqual({ scale: 1, opacity: 1 });
  });

  it('sits down over a moment rather than in one frame', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'sit' }]);
    expect(actorAt(p, 'kid', 1.2).sit).toBeGreaterThan(0.2);
    expect(actorAt(p, 'kid', 1.2).sit).toBeLessThan(0.8);
    expect(actorAt(p, 'kid', 2).sit).toBe(1);
  });

  it('swings a tail behind a start, and renders the same frame in any order', () => {
    const actions = [{ t: 1, actor: 'dog', do: 'walk', to: { x: 900, y: 660 }, duration: 3 }];
    const p = project(actions);
    const shot = p.shots[0];
    const tail = (t: number) => {
      const a = actorAt(p, 'dog', t);
      const pose = poseFor(a, t);
      const before = pose.rot.tail ?? 0;
      applySprings(p, shot, a, pose, t);
      return pose.rot.tail! - before;
    };
    expect(Math.abs(tail(0.9))).toBeLessThan(0.5); // standing still: at rest
    const swing = Math.max(...[1.1, 1.2, 1.3, 1.4].map((t) => Math.abs(tail(t))));
    expect(swing).toBeGreaterThan(2);

    // In order, frame by frame, versus one frame of a fresh copy.
    for (let t = 0; t < 3; t += 1 / 24) composeFrame(p, shot, t);
    const fresh = structuredClone(project(actions));
    expect(composeFrame(fresh, fresh.shots[0], 3)).toBe(composeFrame(p, shot, 3));
  });

  it('blinks twice now and then', () => {
    const parts = { eyes: { open: 'o', closed: 'c' } };
    let runs = 0;
    let doubles = 0;
    let last = -10;
    let wasClosed = false;
    for (let t = 0; t < 120; t += 0.01) {
      const closed =
        resolveFace(parts, { emotion: 'neutral', overrides: {}, talking: false, t, phase: 0.4 })
          .eyes === 'closed';
      if (closed && !wasClosed) {
        if (t - last < 0.5) doubles++;
        else runs++;
        last = t;
      }
      wasClosed = closed;
    }
    expect(doubles).toBeGreaterThan(2);
    expect(doubles).toBeLessThan(runs);
  });
});

describe('knees', () => {
  const seated = (actions: unknown[], cast: Record<string, unknown>) => {
    const p = project(actions, cast);
    const park = SceneSchema.parse(LIBRARY.scenes.park);
    // A low stool: a kid's feet reach the floor from it.
    park.anchors.stool = { x: 600, y: 610, scale: 1, floor: 640 };
    return { ...p, scenes: { park } };
  };
  const feetY = (a: ActorState, t: number) => Object.values(worldFeet(a, t)).map(([, y]) => y);

  it('sits on the ground with bent knees and the feet on it all the way down', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'sit' }]);
    for (const t of [1.05, 1.15, 1.25, 1.35, 2])
      for (const y of feetY(actorAt(p, 'kid', t), t)) expect(Math.abs(y - 640)).toBeLessThan(1.5);
    const sat = actorAt(p, 'kid', 2);
    expect(sat.seat).toBe(0);
    expect(poseFor(sat, 2).bend.legR).toBeGreaterThan(20);
  });

  it("puts the feet on the floor under a seat: the anchor's floor, else where it stood", () => {
    const p = seated([{ t: 0, actor: 'kid', do: 'sit', to: 'stool' }], { kid: { at: 'stool' } });
    const a = actorAt(p, 'kid', 1);
    expect(a.seat).toBe(30);
    for (const y of feetY(a, 1)) expect(Math.abs(y - 640)).toBeLessThan(1.5);
    // Sat down onto a seat with no floor given: the floor is where the kid stood.
    const box = project([{ t: 0, actor: 'kid', do: 'sit', to: { x: 300, y: 600 } }], {
      kid: { at: { x: 280, y: 640 } },
    });
    expect(actorAt(box, 'kid', 1).seat).toBe(40);
  });

  it('draws a bent leg as one shape: both outlines before either fill', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'sit' }]);
    expect(composeFrame(p, p.shots[0], 0.5)).not.toContain('tk-bend-kid-legR');
    const svg = composeFrame(p, p.shots[0], 2);
    const leg = svg.slice(svg.indexOf("class='part-legR'"));
    const at = (k: string) => leg.indexOf(`url(#tk-bend-kid-legR-${k})`);
    expect(at('ul')).toBeGreaterThan(-1);
    expect(at('ul')).toBeLessThan(at('ll'));
    expect(at('ll')).toBeLessThan(at('uf'));
    expect(at('uf')).toBeLessThan(at('lf'));
  });

  it('lifts a swinging foot by bending the knee; only a person gives on a planted leg', () => {
    const p = project(
      [
        { t: 0.5, actor: 'kid', do: 'walk', to: { x: 1000, y: 640 }, duration: 3 },
        { t: 0.5, actor: 'dog', do: 'walk', to: { x: 1000, y: 660 }, duration: 3 },
      ],
      { kid: { at: { x: 200, y: 640 } } }
    );
    const most = (id: string, legs: string[]) => {
      let m = 0;
      for (let t = 0.6; t < 3.4; t += 0.05) {
        const pose = poseFor(actorAt(p, id, t), t);
        for (const leg of legs) m = Math.max(m, pose.bend[leg] ?? 0);
      }
      return m;
    };
    expect(most('kid', ['legL', 'legR'])).toBeGreaterThan(30);
    expect(most('dog', ['legFL', 'legFR', 'legBL', 'legBR'])).toBeGreaterThan(15);
    // A dog's planted legs stay straight: at mid-stance every foot on the line is unbent.
    for (let t = 0.6; t < 3.4; t += 0.05) {
      const a = actorAt(p, 'dog', t);
      const pose = poseFor(a, t);
      const feet = worldFeet(a, t);
      for (const [leg, [, y]] of Object.entries(feet))
        if (Math.abs(y - 660) < 0.01) expect(pose.bend[leg] ?? 0).toBe(0);
    }
  });

  it('crouches for a jump on bent knees with the feet planted', () => {
    const p = project([{ t: 1, actor: 'kid', do: 'jump' }]);
    const t = 1.1;
    const a = actorAt(p, 'kid', t);
    expect(poseFor(a, t).bend.legR).toBeGreaterThan(30);
    for (const y of Object.values(worldFeet(a, t)).map(([, y]) => y))
      expect(Math.abs(y - 640)).toBeLessThan(0.5);
  });
});

describe('lying down', () => {
  it('sits first, then lies back; standing up sits up first', () => {
    const p = project([
      { t: 1, actor: 'kid', do: 'lie' },
      { t: 4, actor: 'kid', do: 'stand' },
    ]);
    const at = (t: number) => actorAt(p, 'kid', t);
    expect(at(1.3).lie).toBe(0);
    expect(at(1.3).sit).toBeGreaterThan(0.5);
    expect(at(2.5).lie).toBe(1);
    expect(poseFor(at(2.5), 2.5).rot.torso).toBeCloseTo(-90);
    // Getting up: lies less first, still sat, then stands.
    expect(at(4.5).lie).toBeLessThan(1);
    expect(at(4.5).sit).toBe(1);
    expect(at(5.6).lie).toBe(0);
    expect(at(5.6).sit).toBe(0);
  });

  it('takes its duration, so a shot can open with someone already lying or sat', () => {
    const p = project([
      { t: 0, actor: 'kid', do: 'lie', duration: 0.05 },
      { t: 0, actor: 'dog', do: 'sit', duration: 0.05 },
      { t: 2, actor: 'kid', do: 'stand', duration: 2.6 },
    ]);
    expect(actorAt(p, 'kid', 0.06).lie).toBe(1);
    expect(actorAt(p, 'dog', 0.06).sit).toBe(1);
    // Getting up over twice the default time: still lying a little after the default.
    expect(actorAt(p, 'kid', 3.3).lie).toBeGreaterThan(0);
    expect(actorAt(p, 'kid', 4.7).sit).toBe(0);
  });

  it('puts the bubble at the head and stretches the shadow along the body', () => {
    const p = project([{ t: 0, actor: 'kid', do: 'lie' }]);
    const standing = actorAt(p, 'kid', 0);
    const lying = actorAt(p, 'kid', 2);
    const up = actorHeadTop(standing, poseFor(standing, 0));
    const down = actorHeadTop(lying, poseFor(lying, 2));
    // Facing right, the head lies behind the hips, near the ground.
    expect(down.x).toBeLessThan(up.x - 80);
    expect(down.y).toBeGreaterThan(up.y + 120);
    expect(poseFor(lying, 2).shadow?.scale).toBeGreaterThan(2);
  });

  it('lays a four-legged animal on its belly with its head down', () => {
    const p = project([{ t: 0, actor: 'dog', do: 'lie' }]);
    const a = actorAt(p, 'dog', 2);
    const pose = poseFor(a, 2);
    expect(pose.rot.body ?? 0).toBeCloseTo(0);
    expect(pose.off.body[1]).toBeGreaterThan(40);
    for (const [, y] of Object.values(worldFeet(a, 2))) expect(y).toBeLessThan(662);
    // The head comes down on its neck rather than tipping onto its face.
    expect(pose.off.head[1]).toBeGreaterThan(20);
    expect(pose.rot.head).toBeLessThan(40);
  });
});

describe('people', () => {
  it('turns the face, nose and cheeks with it, the way the body faces', () => {
    const p = project([]);
    const a = actorAt(p, 'kid', 1);
    const pose = poseFor(a, 1);
    const svg = characterBody(a.character, pose);
    const tf = (part: string) => svg.match(new RegExp(`class='part-${part}' transform='([^']*)'`));
    for (const part of ['face', 'eyes', 'mouth'])
      expect(tf(part)?.[1]).toContain('translate(42 0) scale(0.8 1)');
    expect(tf('head')?.[1] ?? '').not.toContain('scale');
    pose.yaw = 0;
    expect(characterBody(a.character, pose)).not.toContain('scale(0.8 1)');
  });

  it('bends the elbows: more as an arm swings forward, held bent to run', () => {
    const p = project(
      [
        { t: 0.5, actor: 'kid', do: 'walk', to: { x: 900, y: 640 }, duration: 3 },
        { t: 4, actor: 'kid', do: 'run', to: { x: 300, y: 640 }, duration: 1.5 },
      ],
      { kid: { at: { x: 200, y: 640 } } }
    );
    let forward = 0;
    let back = 0;
    for (let t = 1; t < 3; t += 0.05) {
      const pose = poseFor(actorAt(p, 'kid', t), t);
      for (const arm of ['armL', 'armR']) {
        if (pose.rot[arm] < -10) forward = Math.min(forward, pose.bend[arm]);
        if (pose.rot[arm] > 10) back = Math.min(back, pose.bend[arm]);
      }
    }
    expect(forward).toBeLessThan(-20);
    expect(back).toBeGreaterThan(-15);
    const run = poseFor(actorAt(p, 'kid', 4.75), 4.75);
    expect(run.bend.armL).toBeLessThan(-60);
    expect(run.bend.armR).toBeLessThan(-60);
    // Standing still the arms hang, all but straight.
    expect(poseFor(actorAt(p, 'kid', 0.2), 0.2).bend.armR).toBeGreaterThan(-10);
  });
});
