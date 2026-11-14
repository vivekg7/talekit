import { describe, expect, it } from 'vitest';
import { impactsAt, landingsOf, overForeground, renderImpacts } from '../src/engine/impact.js';
import { cueSheet } from '../src/engine/sound.js';
import { CharacterSchema, ShotSchema, type Project, type Scene } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const STICK = CharacterSchema.parse({
  id: 'stick',
  name: 'Stick',
  rig: 'simple',
  height: 150,
  parts: { body: `<rect x='92' y='0' width='16' height='200' fill='brown'/>` },
});

type Raw = Record<string, unknown>;

function film(scene: string, cast: Raw, actions: unknown[], more: Raw = {}, scenes = {}): Project {
  const shot = ShotSchema.parse({ id: 's', scene, duration: 4, cast, actions, ...more });
  const c = LIBRARY.characters;
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: c.kid,
      woman: c.woman,
      frog: c.frog,
      swan: c.swan,
      grownup: c.grownup,
      stick: STICK,
    },
    scenes: { park: LIBRARY.scenes.park, pond: LIBRARY.scenes.pond, ...scenes },
    shots: [shot],
  };
}
const shot = (p: Project) => p.shots[0];

describe('what coming down makes', () => {
  it('raises dust where a jump or a drop lands on the ground', () => {
    const p = film(
      'park',
      {
        kid: { at: { x: 420, y: 640 } },
        grownup: { at: { x: 820, y: 640 }, facing: 'left' },
        stick: { at: { x: 820, y: 640 } },
      },
      [
        { t: 0, actor: 'stick', attach: 'grownup' },
        { t: 0.4, actor: 'kid', do: 'jump' },
        { t: 0.6, actor: 'stick', attach: false },
      ]
    );
    const [jump] = landingsOf(p, shot(p), 'kid');
    expect(jump).toMatchObject({ kind: 'dust', how: 'jump', x: 420, y: 640 });
    expect(jump.at).toBeGreaterThan(0.4);
    const [drop] = landingsOf(p, shot(p), 'stick');
    expect(drop).toMatchObject({ kind: 'dust', how: 'fall' });
    // It shows for a moment after, not before; and is drawn in front, as a puff.
    expect(impactsAt(p, shot(p), 'kid', jump.at - 0.05)).toEqual([]);
    const now = impactsAt(p, shot(p), 'kid', jump.at + 0.2);
    expect(now).toHaveLength(1);
    expect(renderImpacts(now, 'front')).toContain('<ellipse');
    expect(renderImpacts(now, 'back')).toBe('');
    expect(impactsAt(p, shot(p), 'kid', jump.at + 1)).toEqual([]);
    // Each jump still lands with its thud.
    expect(cueSheet(p).filter((c) => c.label === 'land')).toHaveLength(1);
  });

  it('splashes where a jump comes down in water, on its waterline, and rings round a swimmer', () => {
    const p = film(
      'pond',
      {
        frog: { at: 'bank-edge', facing: 'right' },
        swan: { at: { x: 1150, y: 625 }, facing: 'left' },
      },
      [
        { t: 0.4, actor: 'frog', do: 'jump', to: 'shore' },
        { t: 0, actor: 'swan', do: 'walk', to: 'swim-right', duration: 4 },
      ]
    );
    const [splash] = landingsOf(p, shot(p), 'frog');
    // On the pond's waterline (590), not down at the frog's feet (625).
    expect(splash).toMatchObject({ kind: 'splash', how: 'jump', x: 490, y: 590, water: 0 });
    const rings = landingsOf(p, shot(p), 'swan');
    expect(rings.length).toBeGreaterThan(5);
    expect(rings.every((r) => r.kind === 'ring' && r.y === 590)).toBe(true);
    // The far side behind the swimmer, the near side over the water's band, kept to the
    // pond; the spray in front.
    const now = impactsAt(p, shot(p), 'frog', splash.at + 0.15);
    expect(renderImpacts(now, 'back')).toContain('<path');
    expect(renderImpacts(now, 'front')).toContain('<circle');
    expect(overForeground(p.scenes.pond, now, 'frog')).toContain(
      "clip-path='url(#tk-water-frog-0)'"
    );
    // It is heard as a splash, not a landing on the ground.
    const cues = cueSheet(p).map((c) => c.label);
    expect(cues).toContain('splash');
    expect(cues).not.toContain('land');
  });

  it('splashes softly where someone walks into shallow water, and not when already in it', () => {
    const ford: Scene = {
      ...LIBRARY.scenes.pond,
      water: LIBRARY.scenes.pond.water!.map((w) => ({ ...w, wade: true })),
    };
    const p = film(
      'ford',
      { kid: { at: 'bank', facing: 'right' } },
      [{ t: 0.2, actor: 'kid', do: 'walk', to: 'swim' }],
      {},
      { ford }
    );
    const wade = landingsOf(p, shot(p), 'kid');
    const splash = wade.filter((l) => l.kind === 'splash');
    expect(splash).toHaveLength(1);
    expect(splash[0].how).toBe('wade');
    expect(splash[0].y).toBe(590);
    expect(wade.some((l) => l.kind === 'ring' && l.at > splash[0].at)).toBe(true);
    // A soft splash heard, unless the shot puts a sound there itself.
    expect(cueSheet(p).filter((c) => c.label === 'splash')).toHaveLength(1);
    const own = film(
      'ford',
      { kid: { at: 'bank', facing: 'right' } },
      [
        { t: 0.2, actor: 'kid', do: 'walk', to: 'swim' },
        { t: splash[0].at, sound: 'splash' },
      ],
      {},
      { ford }
    );
    expect(cueSheet(own).filter((c) => c.label === 'splash')).toHaveLength(1);
    // Standing in it from the start: no splash, and no rings while it stands still.
    const still = film('ford', { kid: { at: 'swim' } }, [], {}, { ford });
    expect(landingsOf(still, shot(still), 'kid')).toEqual([]);
  });
});
