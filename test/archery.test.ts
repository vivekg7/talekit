import { describe, expect, it } from 'vitest';
import { holdPoint, poseFor } from '../src/engine/actor.js';
import { composeFrame } from '../src/engine/compose.js';
import { toRoot } from '../src/engine/gait.js';
import { ANCHOR } from '../src/engine/motion.js';
import { RIGS } from '../src/engine/rigs.js';
import { cueSheet } from '../src/engine/sound.js';
import { ARROW_SPEED, resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { characterSheetSvg } from '../src/render/sheets.js';
import { validateShot } from '../src/project/validate.js';

// A bow drawn upright, string side left, held at the middle; an arrow level, pointing right.
const BOW = CharacterSchema.parse({
  id: 'bow',
  name: 'Bow',
  rig: 'simple',
  height: 150,
  grip: [110, 100],
  bowstring: [
    [78, 10],
    [78, 190],
  ],
  parts: { body: `<path d='M78 10 Q130 100 78 190' stroke='brown' stroke-width='8' fill='none'/>` },
});
const ARROW = CharacterSchema.parse({
  id: 'arrow',
  name: 'Arrow',
  rig: 'simple',
  height: 88,
  grip: [6, 180],
  tip: [198, 180],
  parts: { body: `<rect x='6' y='178' width='192' height='4' fill='tan'/>` },
});
const BIRD = CharacterSchema.parse({
  ...LIBRARY.characters.bird,
  id: 'bird',
  mark: [160, 70],
});

function project(cast: Record<string, unknown>, actions: unknown[]): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 12, cast, actions });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, bow: BOW, arrow: ARROW, bird: BIRD },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;

/** Where an arrow's nock and head are, and the way it points, as it is drawn. */
function ends(a: ActorState) {
  const rig = RIGS.simple;
  const k = (a.character.height / rig.height) * a.scale;
  const side = a.facing === 'left' ? -1 : 1;
  const place = ([bx, by]: [number, number]) => ({
    x: a.x + k * side * (bx - rig.width / 2),
    y: a.y + k * (by - rig.height),
  });
  const turn = (p: { x: number; y: number }) => {
    if (!a.tilt) return p;
    const r = (a.tilt.deg * Math.PI) / 180;
    const [dx, dy] = [p.x - a.tilt.x, p.y - a.tilt.y];
    return {
      x: a.tilt.x + dx * Math.cos(r) - dy * Math.sin(r),
      y: a.tilt.y + dx * Math.sin(r) + dy * Math.cos(r),
    };
  };
  const nock = turn(place(a.character.grip!));
  const head = turn(place(a.character.tip!));
  return { nock, head, deg: (Math.atan2(-(head.y - nock.y), head.x - nock.x) * 180) / Math.PI };
}

/** The drawing hand (the near one) and the bow hand (the far one), in the scene. */
const near = (a: ActorState, t: number) => holdPoint(a, poseFor(a, t));
const far = (a: ActorState, t: number) => holdPoint(a, poseFor(a, t), true);

/** Where the drawing hand anchors, on the near jaw, in the scene. */
const jaw = (a: ActorState, t: number) => {
  const pose = poseFor(a, t);
  const rig = RIGS.humanoid;
  const s = (a.character.height / rig.height) * a.scale;
  const [x, y] = toRoot(rig, pose, 'head', ANCHOR);
  const side = a.facing === 'left' ? -1 : 1;
  return {
    x: a.x + s * side * (pose.sx * (x - 100) + pose.dx),
    y: a.y + s * (pose.sy * (y - 400) + pose.dy),
  };
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const cast = {
  kid: { at: { x: 300, y: 640 } },
  bow: { at: { x: 250, y: 640 } },
  arrow: { at: { x: 250, y: 640 }, visible: false },
};

describe('archery', () => {
  it('draws the bow at the target and holds it: the arrow nocked at the cheek, on the line', () => {
    const target = { x: 1000, y: 300 };
    const p = project(cast, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'aim', to: target, arrow: 'arrow', duration: 6 },
    ]);
    // Not on the string before the aim; on it, and drawn, once it is under way.
    expect(at(p, 'arrow', 0.5).visible).toBe(false);
    for (const t of [2, 4, 6]) {
      const kid = at(p, 'kid', t);
      const arrow = at(p, 'arrow', t);
      expect(arrow.visible).toBe(true);
      const { nock, head } = ends(arrow);
      // The nock in the drawing hand, the near one, at the jaw.
      expect(dist(nock, near(kid, t))).toBeLessThan(3);
      expect(dist(near(kid, t), jaw(kid, t))).toBeLessThan(3);
      expect(nock.y).toBeLessThan(kid.y - 0.6 * kid.character.height);
      // Pointing at the target: the head on the line from the nock to it.
      const want = Math.atan2(target.y - nock.y, target.x - nock.x);
      const has = Math.atan2(head.y - nock.y, head.x - nock.x);
      expect(Math.abs(want - has)).toBeLessThan(0.02);
      // Over the bow hand, the bow standing across the line, its string pulled back to the nock.
      const bow = at(p, 'bow', t);
      const hand = far(kid, t);
      const dx = head.x - nock.x;
      const dy = head.y - nock.y;
      const off = Math.abs((hand.x - nock.x) * dy - (hand.y - nock.y) * dx) / Math.hypot(dx, dy);
      expect(off).toBeLessThan(4);
      expect(dist(bow.bowstring!.apex, nock)).toBeLessThan(1);
      expect(bow.flex).toBeCloseTo(1, 2);
      expect(Math.abs(bow.tilt!.deg + (Math.atan2(-dy, dx) * 180) / Math.PI)).toBeLessThan(1);
    }
    // Held still: the same line at 3 s as at 5 s.
    expect(Math.abs(ends(at(p, 'arrow', 3)).deg - ends(at(p, 'arrow', 5)).deg)).toBeLessThan(0.5);
    // The bow is in the far hand, drawn behind the archer; the string and arrow over him.
    expect(at(p, 'bow', 3).behind).toBe(1);
    expect(composeFrame(p, p.shots[0], 3)).toContain("<g class='archery'>");
  });

  it('lowers the bow without a shot, the arrow left on the string pointing at the floor', () => {
    const p = project(cast, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 0.5, actor: 'kid', do: 'aim', to: { x: 1000, y: 200 }, arrow: 'arrow', duration: 3 },
      { t: 5, actor: 'kid', do: 'walk', to: { x: 600, y: 640 }, duration: 2 },
    ]);
    for (const t of [4, 6]) {
      const arrow = at(p, 'arrow', t);
      expect(arrow.visible).toBe(true);
      expect(arrow.nockedOn).toBe('kid');
      expect(ends(arrow).deg).toBeLessThan(-10);
      // The string at rest again: straight from tip to tip.
      const s = at(p, 'bow', t).bowstring!;
      const off =
        Math.abs((s.apex.x - s.a.x) * (s.b.y - s.a.y) - (s.apex.y - s.a.y) * (s.b.x - s.a.x)) /
        dist(s.a, s.b);
      expect(off).toBeLessThan(0.5);
    }
    expect(at(p, 'kid', 4).nocked).toBe('arrow');
    expect(cueSheet(p).some((c) => c.label === 'bow-twang')).toBe(false);
  });

  it('looses the arrow at a spot: it flies head first, fast, and stays stuck there', () => {
    const spot = { x: 1100, y: 560 };
    const p = project(cast, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 0.5, actor: 'kid', do: 'aim', to: spot, arrow: 'arrow', duration: 8 },
      { t: 3, actor: 'kid', do: 'shoot' },
      { t: 6, actor: 'kid', do: 'walk', to: { x: 500, y: 640 }, duration: 2 },
    ]);
    const before = ends(at(p, 'arrow', 2.99));
    const flight = dist(before.nock, spot) / ARROW_SPEED;
    // In flight: further along the same line, head first.
    const mid = ends(at(p, 'arrow', 3 + flight / 2));
    expect(mid.nock.x).toBeGreaterThan(before.nock.x + 100);
    expect(Math.abs(mid.deg - before.deg)).toBeLessThan(1);
    expect(at(p, 'arrow', 3 + flight / 2).streak).toBeDefined();
    // Stuck: its head gone in at the spot, and still there after the archer walks off.
    for (const t of [3 + flight + 0.7, 9]) {
      const a = at(p, 'arrow', t);
      const { head } = ends(a);
      expect(a.bury).toBeGreaterThan(0);
      expect(dist(head, spot)).toBeLessThan(0.2 * a.character.height);
      expect(head.x).toBeGreaterThan(spot.x);
    }
    // The bow lowered after the follow-through, though the aim was meant to last 8 s.
    expect(poseFor(at(p, 'kid', 4.2), 4.2).bow).toBeUndefined();
    // A twang and a whoosh as it goes, a thunk as it goes in.
    const cues = cueSheet(p);
    expect(cues.find((c) => c.label === 'bow-twang')!.at).toBeCloseTo(3, 5);
    expect(cues.some((c) => c.label === 'whoosh')).toBe(true);
    expect(cues.find((c) => c.label === 'arrow-thunk')!.at).toBeCloseTo(3 + flight, 2);
  });

  it('sticks in an actor at its mark, and goes where it goes', () => {
    const p = project({ ...cast, bird: { at: { x: 1000, y: 380 }, facing: 'left' } }, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 0.5, actor: 'kid', do: 'aim', to: 'bird', arrow: 'arrow', duration: 6 },
      { t: 3, actor: 'kid', do: 'shoot' },
      { t: 4, actor: 'bird', do: 'move', to: { x: 990, y: 640 }, duration: 1 },
    ]);
    const markAt = (t: number) => {
      const b = at(p, 'bird', t);
      const k = (b.character.height / 200) * b.scale;
      return { x: b.x - k * (160 - 100), y: b.y + k * (70 - 200) };
    };
    const stuck = at(p, 'arrow', 3.8);
    expect(stuck.on).toBe('bird');
    const gap = (t: number) => {
      const { nock, head } = ends(at(p, 'arrow', t));
      const m = markAt(t);
      // The mark lies on the arrow's line, a little behind its head.
      const dx = head.x - nock.x;
      const dy = head.y - nock.y;
      return Math.abs((m.x - nock.x) * dy - (m.y - nock.y) * dx) / Math.hypot(dx, dy);
    };
    expect(gap(3.8)).toBeLessThan(2);
    // Fallen with the bird, still in it.
    expect(at(p, 'arrow', 5.5).y).toBeGreaterThan(stuck.y + 200);
    expect(gap(5.5)).toBeLessThan(2);
    expect(cueSheet(p).some((c) => c.label === 'arrow-thunk')).toBe(true);
  });

  it('turns to face a target behind, and mirrors the whole draw', () => {
    const p = project(cast, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 0.5, actor: 'kid', do: 'aim', to: { x: 0, y: 400 }, arrow: 'arrow', duration: 4 },
    ]);
    const kid = at(p, 'kid', 2);
    expect(kid.facing).toBe('left');
    const { nock, head } = ends(at(p, 'arrow', 2));
    expect(head.x).toBeLessThan(nock.x - 50);
    expect(dist(nock, near(kid, 2))).toBeLessThan(3);
    // The bow out in front of the face, on the far side of the drawing hand.
    expect(far(kid, 2).x).toBeLessThan(near(kid, 2).x - 20);
  });

  it('carries the bow in the near hand until an aim hands it to the far one', () => {
    const p = project(cast, [
      { t: 0, actor: 'bow', attach: 'kid' },
      { t: 1, actor: 'kid', do: 'aim', to: { x: 1000, y: 300 }, arrow: 'arrow', duration: 2 },
      { t: 1.8, actor: 'kid', do: 'shoot' },
    ]);
    const grip = (t: number) => {
      const b = at(p, 'bow', t);
      const k = (b.character.height / 200) * b.scale;
      const [gx, gy] = b.character.grip!;
      const g = { x: b.x + k * (gx - 100), y: b.y + k * (gy - 200) };
      if (!b.tilt) return g;
      const r = (b.tilt.deg * Math.PI) / 180;
      const [dx, dy] = [g.x - b.tilt.x, g.y - b.tilt.y];
      return {
        x: b.tilt.x + dx * Math.cos(r) - dy * Math.sin(r),
        y: b.tilt.y + dx * Math.sin(r) + dy * Math.cos(r),
      };
    };
    // Before: in the near hand, drawn in front.
    expect(at(p, 'bow', 0.5).behind).toBeUndefined();
    expect(dist(grip(0.5), near(at(p, 'kid', 0.5), 0.5))).toBeLessThan(1);
    // Never far from a hand on the way, frame by frame: both hands on it as it passes.
    for (let t = 1; t < 1.6; t += 1 / 24) {
      const kid = at(p, 'kid', t);
      const g = grip(t);
      expect(Math.min(dist(g, near(kid, t)), dist(g, far(kid, t)))).toBeLessThan(6);
    }
    // Drawing, and after it is lowered: in the far hand, behind him.
    for (const t of [1.7, 3.5]) {
      expect(at(p, 'bow', t).behind).toBe(1);
      expect(dist(grip(t), far(at(p, 'kid', t), t))).toBeLessThan(1);
    }
  });

  it('sends an arrow off no bow from where it is, with `to`', () => {
    const p = project(
      { arrow: { at: { x: -40, y: 700 } }, bird: { at: { x: 600, y: 300 }, facing: 'left' } },
      [{ t: 1, actor: 'arrow', do: 'shoot', to: 'bird', duration: 0.5 }]
    );
    const a = ends(at(p, 'arrow', 1.25));
    expect(a.deg).toBeGreaterThan(20);
    expect(at(p, 'arrow', 2).on).toBe('bird');
    // No bow was loosed, so no twang: only the flight and the hit.
    const cues = cueSheet(p).map((c) => c.label);
    expect(cues).not.toContain('bow-twang');
    expect(cues).toContain('whoosh');
    expect(cues).toContain('arrow-thunk');
  });

  it('checks the staging: a bow in hand, an arrow in the cast, an aim to loose', () => {
    const msgs = (actions: unknown[]) => {
      const p = project(cast, actions);
      return validateShot(p.shots[0], p).map((m) => `${m.level}: ${m.message}`);
    };
    expect(msgs([{ t: 1, actor: 'kid', do: 'shoot' }]).join()).toMatch(/error: shoot needs an aim/);
    expect(msgs([{ t: 1, actor: 'kid', do: 'aim', to: 'right', arrow: 'arrow' }]).join()).toMatch(
      /holds no bow/
    );
    expect(
      msgs([
        { t: 0, actor: 'bow', attach: 'kid' },
        { t: 1, actor: 'kid', do: 'aim', to: 'right', arrow: 'quiver' },
      ]).join()
    ).toMatch(/error: arrow: 'quiver' is not in the cast/);
    expect(
      msgs([
        { t: 0, actor: 'bow', attach: 'kid' },
        { t: 1, actor: 'kid', do: 'aim', to: 'right', arrow: 'arrow', duration: 3 },
        { t: 2, actor: 'kid', do: 'shoot' },
      ])
    ).toEqual([]);
  });

  it('shows the draw and the shot on the pose sheet, and the string on a bow', () => {
    const sheet = characterSheetSvg(LIBRARY.characters.kid);
    expect(sheet).toContain('>aim<');
    expect(sheet).toContain('>shoot: loosed<');
    expect(sheet).toContain("<g class='archery'>");
    expect(characterSheetSvg(BOW)).toContain('drawn (in an aim)');
  });
});
