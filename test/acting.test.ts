import { describe, expect, it } from 'vitest';
import { characterBody, holdPoint, poseFor } from '../src/engine/actor.js';
import { composeFrame } from '../src/engine/compose.js';
import { cueSheet } from '../src/engine/sound.js';
import { RIGS } from '../src/engine/rigs.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateProject, validateShot } from '../src/project/validate.js';

const LANTERN = CharacterSchema.parse({
  id: 'lantern',
  name: 'Lantern',
  rig: 'simple',
  height: 60,
  grip: [100, 20],
  parts: { body: `<rect x='60' y='20' width='80' height='180' fill='gold'/>` },
});

// A hoe: the handle up from the grip near its foot, the blade's edge forward at the top.
const HOE = CharacterSchema.parse({
  id: 'hoe',
  name: 'Hoe',
  rig: 'simple',
  height: 120,
  grip: [100, 180],
  tip: [180, 50],
  parts: {
    body: `<rect x='95' y='10' width='10' height='190' fill='brown'/><path d='M105 12 L185 30 L180 60 L105 40 Z' fill='grey'/>`,
  },
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
      hoe: HOE,
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

  it('swings what it carries with a strike: back over the shoulder, then onto the blow', () => {
    const p = project(cast, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'strike' },
    ]);
    expect(at(p, 'lantern', 0.5).tilt).toBeUndefined();
    // Wound up, its top leans back, away from the way the kid faces (right); at the blow
    // it has come over and down in front.
    expect(at(p, 'lantern', 1 + 0.4 * 0.7).tilt!.deg).toBeLessThan(-40);
    const t = 1 + 0.6 * 0.7;
    const tilt = at(p, 'lantern', t).tilt!;
    expect(tilt.deg).toBeGreaterThan(90);
    // Turned about the hand that holds it, and drawn so.
    const kid = at(p, 'kid', t);
    const hand = holdPoint(kid, poseFor(kid, t));
    expect(Math.hypot(tilt.x - hand.x, tilt.y - hand.y)).toBeLessThan(0.01);
    expect(composeFrame(p, p.shots[0], t)).toMatch(
      /<g transform='rotate\([^)]*\)'><g class='actor actor-lantern'/
    );
    expect(at(p, 'lantern', 2).tilt).toBeUndefined();
    // Facing left, the same blow comes down the other way.
    const left = project({ ...cast, kid: { at: { x: 300, y: 640 }, facing: 'left' } }, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'strike' },
    ]);
    expect(at(left, 'lantern', t).tilt!.deg).toBeLessThan(-90);
  });

  it('digs: bent over, the blade biting the floor in front, clods thrown up there', () => {
    const p = project({ ...cast, hoe: { at: { x: 300, y: 640 } } }, [
      { t: 0, actor: 'hoe', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'dig', duration: 2.5 },
    ]);
    // Two strokes, each biting halfway through its 1.25 s.
    expect(at(p, 'hoe', 1.6).soil).toBeUndefined();
    const soil = at(p, 'hoe', 1.75).soil!;
    expect(soil).toHaveLength(1);
    const kid = at(p, 'kid', 1.75);
    // Where the blade went in: on the kid's floor, in front of the kid.
    expect(Math.abs(soil[0].y - kid.y)).toBeLessThan(1);
    expect(soil[0].x).toBeGreaterThan(kid.x + 20);
    expect(soil[0].age).toBeCloseTo(0.125, 2);
    // Still in the soil through the pull: the blade is held down there, not swung past it.
    const tilt = at(p, 'hoe', 1.9).tilt!;
    expect(tilt.deg).toBeGreaterThan(60);
    expect(composeFrame(p, p.shots[0], 1.75)).toContain("<g class='soil'>");
    // Bent forward over the work.
    expect(poseFor(kid, 1.75).rot.torso ?? 0).toBeGreaterThan(10);
    // The second blow, and then nothing after the clods settle.
    expect(at(p, 'hoe', 3.0).soil).toHaveLength(1);
    expect(at(p, 'hoe', 4.0).soil).toBeUndefined();
    // A thud at each blow.
    const thuds = cueSheet(p).filter((c) => c.label === 'land');
    expect(thuds.map((c) => Math.round(c.at * 1000) / 1000)).toEqual([1.625, 2.875]);
    // Facing left, the blade goes in on the left.
    const left = project(
      { ...cast, kid: { at: { x: 300, y: 640 }, facing: 'left' }, hoe: { at: { x: 300, y: 640 } } },
      [
        { t: 0, actor: 'hoe', attach: 'kid' },
        { t: 1, actor: 'kid', do: 'dig', duration: 2.5 },
      ]
    );
    expect(at(left, 'hoe', 1.75).soil![0].x).toBeLessThan(280);
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

describe('picking up and putting down', () => {
  const cast = {
    kid: { at: { x: 300, y: 640 }, facing: 'right' },
    grownup: { at: { x: 470, y: 640 }, facing: 'left' },
    lantern: { at: { x: 360, y: 640 } },
  };
  const hand = (p: Project, id: string, t: number) => {
    const a = at(p, id, t);
    return holdPoint(a, poseFor(a, t));
  };

  it('stoops, takes the prop from where it lies and rises with it', () => {
    const p = project(cast, [{ t: 1, actor: 'lantern', attach: 'kid', do: 'pickup' }]);
    // Lying there until the hand is down, halfway through the stoop.
    expect([at(p, 'lantern', 1.5).x, at(p, 'lantern', 1.5).y]).toEqual([360, 640]);
    expect(at(p, 'lantern', 1.5).heldBy).toBeUndefined();
    expect(at(p, 'kid', 1.3).verbs.map((v) => v.verb)).toEqual(['pickup']);
    expect(hand(p, 'kid', 1.6).y).toBeGreaterThan(hand(p, 'kid', 0.5).y + 30);
    // Taken where it lay: no jump at the grab.
    const before = at(p, 'lantern', 1.599);
    const after = at(p, 'lantern', 1.601);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(2);
    expect(after.heldBy).toBe('kid');
    // Settled in the hand once the stoop is over.
    const p0 = at(p, 'lantern', 3);
    const h = hand(p, 'kid', 3);
    expect(p0.y).toBeLessThan(640);
    expect(Math.abs(p0.x - h.x)).toBeLessThan(15);
    expect(validateShot(p.shots[0], p)).toEqual([]);
  });

  it('sets the prop down where `to` says, from the low hand', () => {
    const p = project(cast, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'lantern', attach: false, do: 'putdown', to: { x: 380, y: 650 } },
    ]);
    expect(at(p, 'lantern', 1.5).heldBy).toBe('kid');
    const l = at(p, 'lantern', 2.5);
    expect([l.x, l.y, l.heldBy]).toEqual([380, 650, undefined]);
    expect(at(p, 'kid', 2.5).holding).toBe(false);
  });

  it('passes a prop from hand to hand without a jump', () => {
    const p = project(cast, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 2, actor: 'lantern', attach: 'grownup' },
    ]);
    const a = at(p, 'lantern', 1.999);
    const b = at(p, 'lantern', 2.001);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(3);
    const h = hand(p, 'grownup', 3);
    expect(Math.abs(at(p, 'lantern', 3).x - h.x)).toBeLessThan(15);
  });

  it('checks a pickup has a carrier, and says where to stand when it is out of reach', () => {
    const p = project({ ...cast, lantern: { at: { x: 900, y: 640 } } }, [
      { t: 1, actor: 'lantern', do: 'pickup' },
      { t: 2, actor: 'lantern', attach: 'kid', do: 'pickup' },
      { t: 5, actor: 'lantern', attach: 'kid', do: 'putdown' },
    ]);
    const messages = validateShot(p.shots[0], p)
      .map((m) => m.message)
      .join('\n');
    expect(messages).toMatch(/pickup needs attach/);
    expect(messages).toMatch(/putdown needs attach: false/);
    expect(messages).toMatch(
      /'kid' reaches \d+px short of where 'lantern' is; stand them at x ≈ 8\d\d/
    );
  });

  // Up on a table, 90 px off the floor the kid stands on.
  const table = { ...cast, lantern: { at: { x: 345, y: 550 } } };
  const grip = (p: Project, t: number) => {
    const l = at(p, 'lantern', t);
    return { x: l.x, y: l.y - (LANTERN.height * l.scale * (200 - 20)) / 200 };
  };

  it('reaches out for a prop on a table rather than stooping to the floor', () => {
    const p = project(table, [{ t: 1, actor: 'lantern', attach: 'kid', do: 'pickup' }]);
    const g = grip(p, 1.5);
    const h = hand(p, 'kid', 1.6);
    expect(Math.hypot(h.x - g.x, h.y - g.y)).toBeLessThan(4);
    const before = at(p, 'lantern', 1.599);
    const after = at(p, 'lantern', 1.601);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(4);
    expect(validateShot(p.shots[0], p)).toEqual([]);
    // Onto the table again: the hand goes to where the grip will be, and lets go there.
    const back = project(table, [
      { t: 0, actor: 'lantern', attach: 'kid' },
      { t: 1, actor: 'lantern', attach: false, do: 'putdown', to: { x: 350, y: 550 } },
    ]);
    const down = hand(back, 'kid', 1.6);
    expect(Math.hypot(down.x - 350, down.y - (550 - (LANTERN.height * 180) / 200))).toBeLessThan(4);
  });

  it('wipes what `to` names, the hand going round on it', () => {
    const p = project(table, [{ t: 1, actor: 'kid', do: 'wipe', to: 'lantern', duration: 2 }]);
    const l = at(p, 'lantern', 2);
    const middle = { x: l.x, y: l.y - (LANTERN.height * l.scale) / 2 };
    const spots = [1.8, 2, 2.2].map((t) => hand(p, 'kid', t));
    for (const h of spots) expect(Math.hypot(h.x - middle.x, h.y - middle.y)).toBeLessThan(8);
    expect(Math.hypot(spots[0].x - spots[1].x, spots[0].y - spots[1].y)).toBeGreaterThan(1);
    expect(hand(p, 'kid', 3.5).y).toBeGreaterThan(middle.y + 20);
    expect(validateShot(p.shots[0], p)).toEqual([]);
  });

  it('warns when a carried prop vanishes at a cut', () => {
    const p = project(cast, [{ t: 0, actor: 'lantern', attach: 'kid' }]);
    const next = ShotSchema.parse({ id: 't', scene: 'park', duration: 5, cast: { kid: cast.kid } });
    const messages = validateProject({ ...p, shots: [p.shots[0], next] }).map((m) => m.message);
    expect(messages.join('\n')).toMatch(
      /'kid' ends 's' carrying 'lantern' but starts 't' empty-handed/
    );
    const carried = ShotSchema.parse({
      ...next,
      cast: cast,
      actions: [{ t: 0, actor: 'lantern', attach: 'kid' }],
    });
    const ok = validateProject({ ...p, shots: [p.shots[0], carried] }).map((m) => m.message);
    expect(ok.join('\n')).not.toMatch(/empty-handed/);
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
