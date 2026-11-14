import { describe, expect, it } from 'vitest';
import { poseFor } from '../src/engine/actor.js';
import { applySprings } from '../src/engine/springs.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

type Raw = Record<string, unknown>;

function film(scene: string, cast: Raw, actions: unknown[], more: Raw = {}): Project {
  const shot = ShotSchema.parse({ id: 's', scene, duration: 4, cast, actions, ...more });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { woman: LIBRARY.characters.woman },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}
const shot = (p: Project) => p.shots[0];

describe('the wind on what hangs', () => {
  /** How far the woman's plait is turned at t, standing in a wind. */
  const plait = (wind: number, t: number, facing = 'right') => {
    const p = film('park', { woman: { at: { x: 640, y: 640 }, facing } }, [], {
      weather: { wind },
    });
    const actor = resolveFrame(p, shot(p), t).actors[0];
    const pose = poseFor(actor, t);
    applySprings(p, shot(p), actor, pose, t);
    return pose.rot.plait ?? 0;
  };

  it('blows it downwind from the first frame, and flutters it', () => {
    expect(Math.abs(plait(0, 0))).toBeLessThan(0.01);
    expect(Math.abs(plait(0, 2))).toBeLessThan(0.01);
    // Facing right, a wind to the right throws the hanging plait forward (turned back on
    // the clock), a wind to the left behind her; already so as the shot opens.
    expect(plait(1, 0)).toBeLessThan(-6);
    expect(plait(-1, 0)).toBeGreaterThan(6);
    // Facing the other way the same wind turns it the other way in her own frame.
    expect(plait(1, 0, 'left')).toBeGreaterThan(6);
    // A light wind less than a strong one; and the gusts move it.
    expect(Math.abs(plait(0.3, 1))).toBeLessThan(Math.abs(plait(1, 1)));
    const swings = [0.5, 1, 1.5, 2, 2.5, 3].map((t) => plait(1, t));
    expect(Math.max(...swings) - Math.min(...swings)).toBeGreaterThan(2);
    expect(Math.max(...swings.map(Math.abs))).toBeLessThanOrEqual(28);
  });
});
