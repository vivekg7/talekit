import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { staging } from '../src/engine/stage.js';
import { gripAt, resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { JUMP_SPEED, shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';
import { characterSheetSvg } from '../src/render/sheets.js';
import { validateShot } from '../src/project/validate.js';

const LANTERN = CharacterSchema.parse({
  id: 'lantern',
  name: 'Lantern',
  rig: 'simple',
  height: 60,
  grip: [100, 20],
  parts: { body: `<rect x='60' y='20' width='80' height='180' fill='gold'/>` },
});

function project(cast: Record<string, unknown>, actions: unknown[]): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 6, cast, actions });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      grownup: LIBRARY.characters.grownup,
      dog: LIBRARY.characters.dog,
      lantern: LANTERN,
    },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
const hand = (p: Project, id: string, t: number) => {
  const a = at(p, id, t);
  return holdPoint(a, poseFor(a, t));
};
const grip = (p: Project, t: number) => {
  const l = at(p, 'lantern', t);
  return gripAt(l.character, l, l.scale, l.facing);
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** The grown-up hands the lantern to the kid at t 1 (a give of 1.4 s: the hands meet at 1.7). */
const handOver = (kidAt = 560, facing: Record<string, unknown> = {}) =>
  project(
    {
      grownup: { at: { x: 400, y: 640 }, facing: 'left' },
      kid: { at: { x: kidAt, y: 640 }, facing: 'right', ...facing },
      lantern: { at: { x: 400, y: 640 } },
    },
    [
      { t: 0, actor: 'lantern', attach: 'grownup' },
      { t: 1, actor: 'lantern', attach: 'kid', do: 'give' },
    ]
  );

const CAST = {
  kid: { at: { x: 560, y: 640 } },
  grownup: { at: { x: 400, y: 640 } },
  lantern: { at: { x: 400, y: 640 } },
};

describe('give', () => {
  it('turns the two to each other, and both reach to where their hands meet', () => {
    const p = handOver();
    // Both started facing away; the engine turns them before the give.
    expect(staging(p, p.scenes.park, p.shots[0]).map((a) => a.staged)).toEqual(
      expect.arrayContaining(['gives lantern', 'takes lantern'])
    );
    expect(at(p, 'grownup', 1).facing).toBe('right');
    expect(at(p, 'kid', 1).facing).toBe('left');
    // At the hand-over the two hands are together, out between them, the lantern in both.
    const meet = 1.7;
    const g = hand(p, 'grownup', meet);
    const k = hand(p, 'kid', meet);
    expect(dist(g, k)).toBeLessThan(3);
    expect(g.x).toBeGreaterThan(at(p, 'grownup', meet).x + 30);
    expect(k.x).toBeLessThan(at(p, 'kid', meet).x - 20);
    expect(dist(grip(p, meet - 0.01), g)).toBeLessThan(3);
    expect(dist(grip(p, meet + 0.01), k)).toBeLessThan(3);
    // Held by the giver before, by the taker after; both arms back by the end.
    expect(at(p, 'lantern', 1.5).heldBy).toBe('grownup');
    expect(at(p, 'lantern', 2).heldBy).toBe('kid');
    expect(at(p, 'grownup', 3).verbs).toEqual([]);
    // It goes from hand to hand without a jump, and the world check finds nothing.
    for (let t = 1; t < 2.4; t += 1 / 48)
      expect(dist(grip(p, t), grip(p, t + 1 / 48)) * 48).toBeLessThan(JUMP_SPEED / 3);
    expect(shotFindings(p, p.shots[0]).filter((f) => !f.code.startsWith('support'))).toEqual([]);
  });

  it('says when the two stand too far apart for their hands to meet', () => {
    const p = handOver(900);
    const [f] = shotFindings(p, p.shots[0]).filter((x) => x.code === 'give.reach');
    expect(f.actors).toEqual(['grownup', 'kid']);
    expect(f.message).toMatch(/stand 500 px apart: bring them to about \d+ px/);
  });

  it('says so when they are kept facing away', () => {
    const p = handOver(560);
    p.shots[0].actions.push({ t: 0.8, actor: 'kid', set: { facing: 'right' } } as never);
    const [f] = shotFindings(p, p.shots[0]).filter((x) => x.code === 'give.reach');
    expect(f.message).toMatch(/not facing each other/);
  });

  it('gives to an animal at its mouth', () => {
    const p = project(
      {
        kid: { at: { x: 400, y: 640 }, facing: 'right' },
        dog: { at: { x: 520, y: 640 }, facing: 'left' },
        lantern: { at: { x: 400, y: 640 } },
      },
      [
        { t: 0, actor: 'lantern', attach: 'kid' },
        { t: 1, actor: 'lantern', attach: 'dog', do: 'give' },
      ]
    );
    expect(dist(hand(p, 'kid', 1.7), hand(p, 'dog', 1.7))).toBeLessThan(3);
    expect(at(p, 'lantern', 2.5).heldBy).toBe('dog');
  });

  it('needs someone to take it and something in hand to give', () => {
    const msgs = (actions: unknown[]) =>
      validateShot(project(CAST, actions).shots[0], {
        ...project({}, []),
      })
        .filter((x) => x.level === 'error')
        .map((x) => x.message);
    expect(msgs([{ t: 1, actor: 'lantern', do: 'give' }]).join()).toMatch(/give needs attach/);
    expect(msgs([{ t: 1, actor: 'lantern', attach: 'kid', do: 'give' }]).join()).toMatch(
      /no one holds 'lantern'/
    );
    expect(
      msgs([
        { t: 0, actor: 'lantern', attach: 'kid' },
        { t: 1, actor: 'lantern', attach: 'kid', do: 'give' },
      ]).join()
    ).toMatch(/already holds/);
  });

  it('shows on the pose sheet', () => {
    expect(characterSheetSvg(LIBRARY.characters.kid)).toContain('>give<');
  });
});
