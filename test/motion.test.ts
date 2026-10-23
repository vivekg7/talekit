import { describe, expect, it } from 'vitest';
import { poseFor, sideOf } from '../src/engine/actor.js';
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
      { t: 1, actor: 'kid', do: 'walk', to: { x: 600, y: 640 }, duration: 2 },
      { t: 4, actor: 'kid', do: 'walk', to: { x: 300, y: 640 }, duration: 2 },
    ]);
    const sides = [4, 4.05, 4.1, 4.15, 4.25].map((t) => sideOf(actorAt(p, 'kid', t)));
    expect(sides[0]).toBeGreaterThan(0.9);
    expect(Math.abs(sides[2])).toBeLessThan(0.2);
    expect(sides[4]).toBe(-1);
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
    expect(composeFrame(p, p.shots[0], 0.5)).not.toContain('tk-knee');
    const svg = composeFrame(p, p.shots[0], 2);
    const leg = svg.slice(svg.indexOf("class='part-legR'"));
    const at = (k: string) => leg.indexOf(`url(#tk-knee-kid-legR-${k})`);
    expect(at('ul')).toBeGreaterThan(-1);
    expect(at('ul')).toBeLessThan(at('ll'));
    expect(at('ll')).toBeLessThan(at('uf'));
    expect(at('uf')).toBeLessThan(at('lf'));
  });
});
