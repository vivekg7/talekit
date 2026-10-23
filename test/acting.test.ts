import { describe, expect, it } from 'vitest';
import { characterBody, holdPoint, poseFor } from '../src/engine/actor.js';
import { RIGS } from '../src/engine/rigs.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
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
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 10, cast, actions });
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

describe('looking', () => {
  const cast = {
    kid: { at: { x: 300, y: 640 }, facing: 'right' },
    dog: { at: { x: 450, y: 640 }, facing: 'left' },
    grownup: { at: { x: 650, y: 640 }, facing: 'left' },
  };

  it('looks up at a taller speaker and down at a shorter one, easing over', () => {
    const p = project(cast, [
      { t: 1, actor: 'grownup', say: 'Hello down there.' },
      { t: 4, actor: 'dog', say: 'Woof.' },
    ]);
    expect(at(p, 'kid', 0.5).look).toBe(0);
    expect(at(p, 'kid', 2).look).toBeLessThan(-2); // up at the grown-up
    expect(at(p, 'kid', 5).look).toBeGreaterThan(1); // down at the dog
    const mid = at(p, 'kid', 4.15).look;
    expect(mid).toBeGreaterThan(at(p, 'kid', 3.9).look);
    expect(mid).toBeLessThan(at(p, 'kid', 5).look);
  });

  it('a speaker looks at whoever `to` names, else the nearest actor in front', () => {
    const named = project(cast, [{ t: 1, actor: 'kid', say: 'Can we go?', to: 'grownup' }]);
    expect(at(named, 'kid', 2).look).toBeLessThan(-2);
    const guessed = project(cast, [{ t: 1, actor: 'kid', say: 'Can we go?' }]);
    expect(at(guessed, 'kid', 2).look).toBeGreaterThan(1);
  });

  it('never looks behind, walking looks ahead, and a prop looks at nobody', () => {
    const p = project({ ...cast, kid: { at: { x: 300, y: 640 }, facing: 'left' } }, [
      { t: 1, actor: 'grownup', say: 'Over here.' },
      { t: 3, actor: 'dog', do: 'walk', to: { x: 900, y: 640 }, duration: 2 },
    ]);
    expect(at(p, 'kid', 2).look).toBe(0);
    expect(at(p, 'dog', 4).look).toBe(0);
    const prop = project({ ...cast, lantern: { at: { x: 500, y: 640 } } }, [
      { t: 1, actor: 'grownup', say: 'Over here.' },
    ]);
    expect(at(prop, 'lantern', 2).look).toBe(0);
  });

  it('gives an emotion change a take that starts with a blink', () => {
    const p = project(cast, [{ t: 1, actor: 'kid', emotion: 'surprised' }]);
    expect(at(p, 'kid', 0.9).take).toBeUndefined();
    const take = at(p, 'kid', 1.08);
    expect(take.take?.emotion).toBe('surprised');
    expect(poseFor(take, 1.08).face.eyes).toBe('closed');
    expect(at(p, 'kid', 2).take).toBeUndefined();
  });
});

describe('carrying', () => {
  const cast = {
    kid: { at: { x: 300, y: 640 } },
    lantern: { at: { x: 900, y: 640 } },
  };
  const grip = (p: Project, t: number) => {
    const l = at(p, 'lantern', t);
    const rig = RIGS.simple;
    const k = (LANTERN.height / rig.height) * l.scale;
    const side = l.facing === 'left' ? -1 : 1;
    return { x: l.x + k * side * (100 - rig.width / 2), y: l.y + k * (20 - rig.height) };
  };

  it('keeps the grip in the hand through a walk, then lets go where it is', () => {
    const p = project(cast, [
      { t: 1, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'walk', to: { x: 800, y: 640 }, duration: 3 },
      { t: 5, actor: 'lantern', attach: false },
      { t: 6, actor: 'lantern', do: 'move', to: { x: 1000, y: 640 }, duration: 1 },
    ]);
    expect(at(p, 'lantern', 0.5).x).toBe(900);
    for (const t of [1, 1.7, 2.6, 3.9, 4.5]) {
      const kid = at(p, 'kid', t);
      const hand = holdPoint(kid, poseFor(kid, t));
      const g = grip(p, t);
      expect(Math.hypot(g.x - hand.x, g.y - hand.y)).toBeLessThan(0.01);
    }
    expect(at(p, 'lantern', 3).heldBy).toBe('kid');
    expect(at(p, 'kid', 3).holding).toBe(true);
    const dropped = at(p, 'lantern', 5.5);
    expect(dropped.heldBy).toBeUndefined();
    expect(Math.abs(dropped.x - at(p, 'lantern', 4.99).x)).toBeLessThan(1);
    expect(at(p, 'lantern', 7.5).x).toBe(1000);
  });

  it('draws the carried prop just in front of its carrier', () => {
    const p = project({ ...cast, lantern: { at: { x: 300, y: 700 } } }, [
      { t: 0, actor: 'lantern', attach: 'kid' },
    ]);
    const ids = resolveFrame(p, p.shots[0], 1).actors.map((a) => a.id);
    expect(ids.indexOf('lantern')).toBe(ids.indexOf('kid') + 1);
  });

  it('checks who is spoken to, who carries what and whom the camera follows', () => {
    const p = project(cast, [
      { t: 1, actor: 'kid', say: 'Hi', to: 'nobody' },
      { t: 2, actor: 'lantern', attach: 'lantern' },
      { t: 3, actor: 'lantern', attach: 'ghost' },
      { t: 4, camera: { zoom: 1.5, follow: 'ghost' } },
    ]);
    const messages = validateShot(p.shots[0], p).map((m) => m.message);
    expect(messages.join('\n')).toMatch(/camera follows 'ghost', who is not in the cast/);
    expect(messages.join('\n')).toMatch(/'nobody' is not in the cast/);
    expect(messages.join('\n')).toMatch(/cannot carry itself/);
    expect(messages.join('\n')).toMatch(/attach: 'ghost' is not in the cast/);
    // A listener in the cast is not a position, so it is not checked against the anchors.
    const ok = project(cast, [{ t: 1, actor: 'kid', say: 'Hi', to: 'lantern' }]);
    expect(validateShot(ok.shots[0], ok)).toEqual([]);
  });
});

describe('four-film fixes', () => {
  const cast = {
    kid: { at: { x: 300, y: 640 }, facing: 'right' },
    grownup: { at: { x: 650, y: 640 }, facing: 'left' },
    lantern: { at: { x: 900, y: 640 } },
  };

  it('hands a forced face part back with an empty variant', () => {
    const p = project(cast, [
      { t: 1, actor: 'kid', face: { mouth: 'open', eyes: 'closed' } },
      { t: 2, actor: 'kid', face: { mouth: '' } },
    ]);
    expect(at(p, 'kid', 1.5).face).toEqual({ mouth: 'open', eyes: 'closed' });
    expect(at(p, 'kid', 2.5).face).toEqual({ eyes: 'closed' });
    expect(validateShot(p.shots[0], p)).toEqual([]);
  });

  it('keeps the mouth still on a thought, and nobody turns to the thinker', () => {
    const p = project(cast, [
      { t: 1, actor: 'grownup', say: 'Hmm, where is it?', bubble: 'thought' },
    ]);
    const grownup = at(p, 'grownup', 2);
    expect(grownup.bubble?.style).toBe('thought');
    expect(grownup.talking).toBe(false);
    expect(at(p, 'kid', 2).look).toBe(0);
  });

  it('puts a let-go prop where a set in the same action says', () => {
    const p = project(cast, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'lantern', attach: false, set: { at: { x: 500, y: 600 } } },
    ]);
    const l = at(p, 'lantern', 1.5);
    expect([l.x, l.y, l.heldBy]).toEqual([500, 600, undefined]);
  });

  it("draws a four-legged animal's head line under its body, a person's over the torso", () => {
    const order = (id: 'dog' | 'kid') => {
      const svg = characterBody(
        LIBRARY.characters[id],
        poseFor(at(project({ ...cast, dog: { at: { x: 450, y: 640 } } }, []), id, 0), 0)
      );
      return ['part-head-line', "part-body'", "part-torso'", "part-head'"].map((k) =>
        svg.indexOf(k)
      );
    };
    const [line, body, , head] = order('dog');
    expect(line).toBeGreaterThan(-1);
    expect(line).toBeLessThan(body);
    expect(head).toBeGreaterThan(body);
    expect(order('kid')[0]).toBe(-1);
  });
});
