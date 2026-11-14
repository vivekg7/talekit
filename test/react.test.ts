import { describe, expect, it } from 'vitest';
import { STRIKE_HIT } from '../src/engine/motion.js';
import { cueSheet } from '../src/engine/sound.js';
import { resolveSound, soundTraits } from '../src/engine/sources.js';
import { stagedWhat, staging } from '../src/engine/stage.js';
import { KNOCK_TIME, resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { MOUTH_SOUNDS, STARTLES } from '../src/library/sounds.js';

const STICK = CharacterSchema.parse({
  id: 'stick',
  name: 'Stick',
  rig: 'simple',
  height: 150,
  grip: [100, 185],
  tip: [100, 5],
  parts: { body: `<rect x='92' y='0' width='16' height='200' fill='brown'/>` },
});

type Raw = Record<string, unknown>;

function film(cast: Raw, actions: unknown[], scene = 'jungle'): Project {
  const shot = ShotSchema.parse({ id: 's', scene, duration: 4, cast, actions });
  const c = LIBRARY.characters;
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { lion: c.lion, deer: c.deer, kid: c.kid, grownup: c.grownup, stick: STICK },
    scenes: { jungle: LIBRARY.scenes.jungle, park: LIBRARY.scenes.park },
    shots: [shot],
  };
}
const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[0], t).actors.find((a) => a.id === id)!;
const added = (p: Project) =>
  staging(p, p.scenes[p.shots[0].scene], p.shots[0]).map((a) => `${stagedWhat(a)}: ${a.staged}`);

/** The lion at the left roars at 1; the deer stands facing away from it, the kid toward it. */
const roar = (sound: Raw = {}, more: unknown[] = [], cast: Raw = {}) =>
  film(
    {
      lion: { at: { x: 260, y: 640 } },
      deer: { at: { x: 640, y: 640 }, facing: 'right' },
      kid: { at: { x: 900, y: 640 }, facing: 'left' },
      ...cast,
    },
    [{ t: 1, actor: 'lion', sound: 'lion-roar', ...sound }, ...more]
  );

describe('a sound that startles', () => {
  it('frightens everyone else, and turns whoever faces away to it', () => {
    const p = roar();
    expect(added(p)).toEqual(
      expect.arrayContaining([
        'deer looks scared: startled by lion-roar',
        'kid looks scared: startled by lion-roar',
        'deer turns left: startled by lion-roar',
      ])
    );
    expect(added(p).some((a) => a.startsWith('lion'))).toBe(false);
    // At once, each a moment apart, with the take that comes of a change of face.
    const deer = at(p, 'deer', 1.4);
    expect(deer.emotion).toBe('scared');
    expect(deer.take).toBeDefined();
    expect(at(p, 'deer', 1.05).emotion).toBe('neutral');
    expect(at(p, 'deer', 2.5).facing).toBe('left');
    // A jump at a noise, not a change of heart: the face settles back as it was.
    expect(at(p, 'deer', 3.5).emotion).toBe('neutral');
    expect(at(p, 'deer', 3.5).facing).toBe('left');
    expect(at(p, 'kid', 2.5).facing).toBe('left');
  });

  it('leaves the far off, the waived, the asleep, and whoever the shot directs then', () => {
    expect(added(roar({ volume: 0.5 }))).toEqual([]);
    expect(added(roar({ startles: false }))).toEqual([]);
    // The shot gives the deer a face of its own just then, and turns the kid itself.
    const own = roar({}, [
      { t: 1.2, actor: 'deer', emotion: 'angry' },
      { t: 1.1, actor: 'kid', set: { facing: 'right' } },
    ]);
    expect(added(own).filter((a) => a.startsWith('deer looks'))).toEqual([]);
    expect(added(own).filter((a) => a.startsWith('kid turns'))).toEqual([]);
    // A face the shot gives it before the startle settles is kept: no settling over it.
    const happyAfter = roar({}, [{ t: 2.2, actor: 'kid', emotion: 'happy' }]);
    expect(added(happyAfter).some((a) => a.startsWith('kid looks neutral'))).toBe(false);
    expect(at(happyAfter, 'kid', 3.5).emotion).toBe('happy');
    const asleep = roar({}, [
      { t: 0, actor: 'kid', do: 'lie' },
      { t: 0, actor: 'kid', face: { eyes: 'closed' } },
    ]);
    expect(added(asleep).some((a) => a.startsWith('kid'))).toBe(false);
  });

  it('frightens only the one a roar is said to, and never the angry', () => {
    // "Catch him!" roared at the deer: it alone is startled; the kid is left be.
    const aimed = roar({}, [{ t: 1, actor: 'lion', say: 'Catch him!', to: 'deer' }]);
    expect(added(aimed).filter((a) => a.includes(' looks ') && a.includes('startled'))).toEqual([
      'deer looks scared: startled by lion-roar',
    ]);
    // The kid is angry with the deer from before: it stays angry.
    const angry = roar({}, [{ t: 0, actor: 'kid', emotion: 'angry' }]);
    expect(added(angry).some((a) => a.startsWith('kid looks'))).toBe(false);
    expect(at(angry, 'kid', 2).emotion).toBe('angry');
    // A growl is a threat said low, not a sudden noise.
    expect(added(roar({ sound: 'lion-growl' }))).toEqual([]);
  });

  it('startles with a sound the shot says startles, and with none that comes from nowhere', () => {
    // A knock startles nobody, unless the shot says it does: then they jump, surprised.
    expect(added(roar({ sound: 'knock' }))).toEqual([]);
    expect(added(roar({ sound: 'knock', startles: true }))).toContain(
      'kid looks surprised: startled by knock'
    );
    // A crash off screen: faces, but nobody knows which way to turn.
    const crash = film({ deer: { at: { x: 640, y: 640 }, facing: 'right' } }, [
      { t: 1, sound: 'shatter' },
    ]);
    expect(added(crash)).toEqual([
      'deer looks surprised: startled by shatter',
      'deer looks neutral: settles after shatter',
    ]);
  });

  it('opens the mouth that makes a roar while it sounds', () => {
    const p = roar();
    expect(at(p, 'lion', 0.9).mouth).toBeUndefined();
    expect(at(p, 'lion', 1.5).mouth).toBe(true);
    expect(at(p, 'lion', 4).mouth).toBeUndefined();
    // A knock is not made with the mouth.
    expect(at(roar({ sound: 'knock' }), 'lion', 1.2).mouth).toBeUndefined();
  });

  it('knows each sound it marks', () => {
    const p = film({}, []);
    for (const name of [...Object.keys(STARTLES), ...MOUTH_SOUNDS])
      expect(resolveSound(p, name), name).toBeDefined();
    expect(soundTraits('lion-roar-2')).toEqual({ startles: 'scared', mouth: true });
    expect(soundTraits('thud')).toEqual({ startles: undefined, mouth: false });
  });
});

/** The grown-up, a stick in hand, strikes at `to` from x 450; the kid stands at 620. */
const blow = (to: unknown, more: unknown[] = [], kidFacing = 'left') =>
  film(
    {
      grownup: { at: { x: 450, y: 640 }, facing: 'right' },
      kid: { at: { x: 620, y: 640 }, facing: kidFacing },
      stick: { at: { x: 450, y: 640 } },
    },
    [
      { t: 0, actor: 'stick', attach: 'grownup' },
      { t: 1, actor: 'grownup', do: 'strike', to },
      ...more,
    ],
    'park'
  );
const HIT = 1 + 0.7 * STRIKE_HIT;

describe('a blow that lands', () => {
  it('knocks someone back from it, wincing, and lets them steady', () => {
    const p = blow('kid');
    expect(at(p, 'kid', HIT - 0.02).knock).toBeUndefined();
    const hit = at(p, 'kid', HIT + 0.05);
    // Struck from in front: thrown backward, eyes shut, the head going back.
    expect(hit.knock?.away).toBe(-1);
    expect(hit.face.eyes).toBe('closed');
    expect(hit.take?.emotion).toBe('scared');
    expect(at(p, 'kid', HIT + KNOCK_TIME + 0.01).knock).toBeUndefined();
    expect(at(p, 'kid', HIT + KNOCK_TIME + 0.01).face.eyes).toBeUndefined();
    // Where it stands does not move: the knock is in the pose.
    expect(hit.x).toBe(at(p, 'kid', HIT - 0.02).x);
    // From behind, thrown forward.
    expect(at(blow('kid', [], 'right'), 'kid', HIT + 0.05).knock?.away).toBe(1);
  });

  it('lands with a thud, unless the shot puts a sound there', () => {
    const thuds = (p: Project) => cueSheet(p).filter((c) => c.label === 'thud');
    expect(thuds(blow('kid'))).toHaveLength(1);
    expect(thuds(blow('kid'))[0].at).toBeCloseTo(HIT, 2);
    expect(thuds(blow({ x: 600, y: 650 }))).toHaveLength(1);
    expect(thuds(blow('kid', [{ t: HIT, actor: 'kid', sound: 'bonk' }]))).toEqual([]);
    // A blow at the air in front lands on nothing.
    expect(thuds(blow(undefined))).toEqual([]);
  });

  it('raises dust where it hits the ground, and none off someone', () => {
    const soil = (p: Project) => at(p, 'stick', HIT + 0.1).soil ?? [];
    const ground = soil(blow({ x: 600, y: 650 }));
    expect(ground).toHaveLength(1);
    expect(ground[0].clods).toBeLessThan(6);
    expect(Math.abs(ground[0].x - 600)).toBeLessThan(15);
    expect(soil(blow('kid'))).toEqual([]);
  });
});
