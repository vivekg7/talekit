import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import {
  impactsAt,
  landingsOf,
  overForeground,
  printsOf,
  renderImpacts,
  renderPrints,
  renderWake,
  WAKE_LIFE,
  wakeAt,
  type Wake,
} from '../src/engine/impact.js';
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

describe('what moving leaves behind', () => {
  const glide = (to: number, duration: number, facing = 'left') =>
    film('pond', { swan: { at: { x: 1150, y: 625 }, facing } }, [
      { t: 0, actor: 'swan', do: 'move', to: { x: to, y: 625 }, duration },
    ]);

  it('trails a V of ripples behind a swimmer, longer and wider the faster it goes', () => {
    const fast = glide(650, 2.5);
    const wake = wakeAt(fast, shot(fast), 'swan', 1.5)!;
    expect(wake.water).toBe(0);
    // Both arms start at its front, the way it moves, on the waterline, and open back from
    // it: the far one up the water, the near one down.
    const [f0, n0] = [wake.far[0], wake.near[0]];
    expect(f0.y).toBe(590);
    expect(f0.x).toBeCloseTo(n0.x);
    const [f1, n1] = [wake.far.at(-1)!, wake.near.at(-1)!];
    expect(f1.x).toBeGreaterThan(f0.x + 100);
    expect(f1.y).toBeLessThan(590);
    expect(n1.y).toBeGreaterThan(590);
    // The far arm behind the swan, the near one over the water's band, kept to the pond.
    expect(renderWake(wake, 'back')).toContain('<path');
    expect(overForeground(fast.scenes.pond, [], 'swan', wake)).toContain(
      "clip-path='url(#tk-water-swan-0)'"
    );
    // Per-element opacity only: resvg 2.6 can panic on a group's.
    expect(renderWake(wake, 'surface')).not.toMatch(/<g[^>]*opacity/);
    const slow = glide(1000, 2.5);
    const lazy = wakeAt(slow, shot(slow), 'swan', 1.5)!;
    const length = (w: Wake) => w.far.at(-1)!.x - w.far[0].x;
    const width = (w: Wake) => w.near.at(-1)!.y - w.far.at(-1)!.y;
    expect(length(lazy)).toBeLessThan(length(wake) / 2);
    expect(width(lazy)).toBeLessThan(width(wake));
  });

  it('takes its front from how it moves, and stops a moment after it does', () => {
    // Facing right but drifting left: the wake still opens to the right of it.
    const back = glide(650, 2.5, 'right');
    const wake = wakeAt(back, shot(back), 'swan', 1.5)!;
    expect(wake.far.at(-1)!.x).toBeGreaterThan(wake.far[0].x);
    expect(wakeAt(back, shot(back), 'swan', 2.6)).toBeDefined();
    expect(wakeAt(back, shot(back), 'swan', 2.5 + WAKE_LIFE + 0.1)).toBeUndefined();
    // Still in the water, or on dry ground: none.
    const still = film('pond', { swan: { at: 'swim' } }, []);
    expect(wakeAt(still, shot(still), 'swan', 1)).toBeUndefined();
    const dry = film('park', { kid: { at: { x: 300, y: 640 } } }, [
      { t: 0, actor: 'kid', do: 'walk', to: { x: 900, y: 640 }, duration: 3 },
    ]);
    expect(wakeAt(dry, shot(dry), 'kid', 1.5)).toBeUndefined();
  });

  it('leaves footprints where each foot comes down on sand or snow, and keeps them', () => {
    const beach: Scene = { ...LIBRARY.scenes.park, surface: 'sand' };
    const walk = (scene: string) =>
      film(
        scene,
        { kid: { at: { x: 300, y: 640 }, facing: 'right' } },
        [{ t: 0.5, actor: 'kid', do: 'walk', to: { x: 900, y: 640 }, duration: 3 }],
        {},
        { beach, snowy: { ...beach, surface: 'snow' } }
      );
    const p = walk('beach');
    const prints = printsOf(p, shot(p), 'kid');
    expect(prints.length).toBeGreaterThan(5);
    // In the walk, along it, toes forward; the far foot's a little up the floor from the near.
    expect(prints.every((q) => q.at >= 0.5 && q.at <= 3.5 && q.dir === 1)).toBe(true);
    expect(prints.every((q, i) => i === 0 || q.x > prints[i - 1].x)).toBe(true);
    expect(prints.every((q) => q.x >= 280 && q.x <= 940)).toBe(true);
    expect(new Set(prints.map((q) => Math.round(q.y))).size).toBe(2);
    expect(prints.every((q) => q.kind === 'foot')).toBe(true);
    // Drawn as they are made and kept to the end, on the floor, each with its own opacity.
    expect(renderPrints(p, shot(p), 0.4)).toBe('');
    const end = renderPrints(p, shot(p), 4);
    expect(end.match(/<path/g)).toHaveLength(prints.length);
    expect(end).not.toMatch(/<g[^>]*opacity/);
    expect(composeFrame(p, shot(p), 4)).toContain("class='prints'");
    // Snow keeps them too, and sand sounds soft underfoot; grass and floors keep none.
    const snow = walk('snowy');
    expect(printsOf(snow, shot(snow), 'kid')).toHaveLength(prints.length);
    expect(cueSheet(p).some((c) => c.label === 'step-grass')).toBe(true);
    const lawn = walk('park');
    expect(printsOf(lawn, shot(lawn), 'kid')).toEqual([]);
    expect(renderPrints(lawn, shot(lawn), 4)).toBe('');
  });

  it('leaves no prints in the water, or from what is carried', () => {
    const shore: Scene = {
      ...LIBRARY.scenes.pond,
      surface: 'sand',
      water: LIBRARY.scenes.pond.water!.map((w) => ({ ...w, wade: true })),
    };
    const wade = film(
      'shore',
      { kid: { at: 'bank-left', facing: 'right' } },
      [{ t: 0.2, actor: 'kid', do: 'walk', to: 'swim', duration: 3.5 }],
      {},
      { shore }
    );
    const prints = printsOf(wade, shot(wade), 'kid');
    expect(prints.length).toBeGreaterThan(0);
    // Only on the bank: none past where the water begins.
    expect(prints.every((q) => q.x < 420)).toBe(true);
    const beach: Scene = { ...LIBRARY.scenes.park, surface: 'sand' };
    const held = film(
      'beach',
      {
        grownup: { at: { x: 300, y: 640 }, facing: 'right' },
        stick: { at: { x: 300, y: 640 } },
      },
      [
        { t: 0, actor: 'stick', attach: 'grownup' },
        { t: 0.3, actor: 'grownup', do: 'walk', to: { x: 800, y: 640 }, duration: 3 },
      ],
      {},
      { beach }
    );
    expect(printsOf(held, shot(held), 'grownup').length).toBeGreaterThan(0);
    expect(printsOf(held, shot(held), 'stick')).toEqual([]);
  });
});
