import { describe, expect, it } from 'vitest';
import { resolveSound, soundTraits } from '../src/engine/sources.js';
import { stagedWhat, staging } from '../src/engine/stage.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
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
