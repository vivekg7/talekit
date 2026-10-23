import { describe, expect, it } from 'vitest';
import { ShotSchema } from '../src/engine/types.js';
import { listActions, patchShot } from '../src/project/patch.js';

const shot = ShotSchema.parse({
  id: 's',
  scene: 'park',
  duration: 10,
  cast: { kid: { at: 'left' }, dog: { at: 'right' } },
  actions: [
    { t: 0.5, actor: 'kid', do: 'walk', to: 'center' },
    { t: 3, actor: 'kid', say: 'Hello, dog!' },
    { t: 6, actor: 'dog', do: 'jump' },
  ],
});

describe('patch_shot', () => {
  it('edits, removes and adds by the indices the shot had, keeping time order', () => {
    const { shot: out } = patchShot(shot, {
      edit: [{ index: 1, fields: { say: 'Hi!', t: 7 } }],
      remove: [2],
      add: [{ t: 2, actor: 'dog', do: 'wave' }],
    });
    expect(out.actions.map((a) => [a.t, a.actor, a.do ?? a.say])).toEqual([
      [0.5, 'kid', 'walk'],
      [2, 'dog', 'wave'],
      [7, 'kid', 'Hi!'],
    ]);
    // The original is untouched.
    expect(shot.actions).toHaveLength(3);
  });

  it('removes a field set to null, and replaces top-level fields and cast members', () => {
    const {
      shot: out,
      from,
      to,
    } = patchShot(shot, {
      edit: [{ index: 0, fields: { to: null, duration: 2 } }],
      set: { duration: 12, camera: { zoom: 1.5, x: 640, y: 500 } },
      cast: { dog: null },
    });
    expect(out.actions[0].to).toBeUndefined();
    expect(out.duration).toBe(12);
    expect(out.camera.zoom).toBe(1.5);
    expect(Object.keys(out.cast)).toEqual(['kid']);
    // A change to the shot as a whole shows the whole shot.
    expect([from, to]).toEqual([0, 12]);
  });

  it('shows the stretch around the actions it touched', () => {
    const { from, to } = patchShot(shot, { edit: [{ index: 2, fields: { t: 6.5 } }] });
    expect(from).toBeGreaterThan(5);
    expect(from).toBeLessThan(6.5);
    expect(to).toBeGreaterThan(7);
    expect(to).toBeLessThanOrEqual(10);
  });

  it('refuses an index the shot does not have and an invalid result, saying why', () => {
    expect(() => patchShot(shot, { remove: [3] })).toThrow(/no action 3.*0 to 2/);
    expect(() => patchShot(shot, { edit: [{ index: 0, fields: { t: -1 } }] })).toThrow(/t/);
    expect(() => patchShot(shot, { set: { id: 'x' } as never })).toThrow(/cannot be set/);
  });

  it('lists actions one per line with their index', () => {
    expect(listActions(shot).split('\n')).toEqual([
      '0: t=0.5 kid walk → center',
      '1: t=3 kid say "Hello, dog!"',
      '2: t=6 dog jump',
    ]);
  });
});
