import { describe, expect, it } from 'vitest';
import { actorHeadTop } from '../src/engine/actor.js';
import { footPoint } from '../src/engine/gait.js';
import { applyVerb, basePose, emptyPose, type Pose } from '../src/engine/motion.js';
import { QUADRUPED } from '../src/engine/rigs.js';
import { CharacterSchema } from '../src/engine/types.js';
import type { ActorState } from '../src/engine/timeline.js';
import { LIBRARY } from '../src/library/index.js';
import { lintCharacter } from '../src/project/construction.js';
import { validateCharacter } from '../src/project/validate.js';

const LEGS = ['legFL', 'legFR', 'legBL', 'legBR'] as const;

const foot = (pose: Pose, leg: string) => footPoint(QUADRUPED, pose, leg);

describe('quadruped motion', () => {
  it('walks in diagonal pairs with the feet on the ground staying on the line', () => {
    for (let t = 0; t < 0.7; t += 0.05) {
      const pose = basePose(QUADRUPED, 'walk', t, 0);
      expect(pose.rot.legFR).toBeCloseTo(pose.rot.legBL!);
      expect(pose.rot.legFL).toBeCloseTo(pose.rot.legBR!);
      const ys = LEGS.map((leg) => foot(pose, leg)[1]);
      // Every foot is on or above the line, and the pair carrying the body is on it.
      for (const y of ys) expect(y).toBeLessThanOrEqual(200.01);
      expect(Math.max(...ys)).toBeCloseTo(200, 1);
    }
  });

  it('sits back on its haunches with the front paws planted all the way down', () => {
    for (const k of [0.25, 0.5, 0.75, 1]) {
      const pose = emptyPose();
      applyVerb(QUADRUPED, pose, 'sit', k);
      for (const leg of ['legFL', 'legFR'])
        expect(Math.abs(foot(pose, leg)[1] - 200)).toBeLessThan(k === 1 ? 4 : 0.01);
    }
    // Sat, the hind legs fold forward along the floor instead of standing.
    const pose = emptyPose();
    applyVerb(QUADRUPED, pose, 'sit', 1);
    for (const leg of ['legBL', 'legBR']) {
      const [x, y] = foot(pose, leg);
      expect(x).toBeGreaterThan(QUADRUPED.parts[leg].pivot[0] + 40);
      expect(y).toBeGreaterThan(180);
    }
  });

  it('stays sat through a shiver, a nod or a head shake', () => {
    for (const verb of ['tremble', 'nod', 'shake'] as const) {
      const pose = emptyPose();
      applyVerb(QUADRUPED, pose, 'sit', 1);
      applyVerb(QUADRUPED, pose, verb, 0.3);
      expect(pose.off.body[1]).toBeCloseTo(46);
    }
  });

  it('lifts the near front paw to wave and point, and leaves the far one down', () => {
    for (const verb of ['wave', 'point'] as const) {
      const pose = basePose(QUADRUPED, 'idle', 0, 0);
      applyVerb(QUADRUPED, pose, verb, 0.5);
      expect(foot(pose, 'legFR')[1]).toBeLessThan(180);
      expect(foot(pose, 'legFL')[1]).toBeGreaterThan(198);
    }
  });

  it('gathers on planted feet before the leap and is off the ground in the middle of it', () => {
    const gather = emptyPose();
    applyVerb(QUADRUPED, gather, 'jump', 0.1);
    expect(gather.dy).toBeGreaterThan(8); // the body comes down onto the legs
    for (const leg of LEGS) expect(foot(gather, leg)[1]).toBeCloseTo(200, 3);
    const leap = emptyPose();
    applyVerb(QUADRUPED, leap, 'jump', 0.51);
    for (const leg of LEGS) expect(foot(leap, leg)[1]).toBeLessThan(150);
  });

  it('points speech bubbles at the head, mirrored when facing left', () => {
    const character = LIBRARY.characters.dog;
    const actor = { character, x: 500, y: 600, scale: 1, facing: 'right' } as ActorState;
    const right = actorHeadTop(actor, emptyPose());
    const left = actorHeadTop({ ...actor, facing: 'left' }, emptyPose());
    expect(right.x).toBeGreaterThan(500);
    expect(left.x).toBeCloseTo(1000 - right.x);
  });
});

describe('quadruped construction', () => {
  const leg = (x: number, bottom = 192) =>
    `<path d='M${x} 132 L${x} ${bottom}' stroke='#a63' stroke-width='18' stroke-linecap='round'/>`;
  const animal = (parts: Record<string, string>) =>
    CharacterSchema.parse({
      id: 'x',
      name: 'X',
      rig: 'quadruped',
      parts: {
        body: `<rect x='40' y='92' width='170' height='60' rx='30' fill='#c84'/>`,
        head: `<circle cx='210' cy='76' r='32' fill='#c84'/><path d='M190 120 L204 96' stroke='#c84' stroke-width='30' stroke-linecap='round'/>`,
        legFL: leg(178),
        legFR: leg(194),
        legBL: leg(66),
        legBR: leg(82),
        ...parts,
      },
    });

  it('accepts a well-built animal', () => {
    expect(lintCharacter(animal({})).problems).toEqual([]);
  });

  it('finds the short leg, the tail off its pivot and the floating ear', () => {
    const messages = lintCharacter(
      animal({
        legBR: leg(82, 170),
        tail: `<path d='M30 60 L10 40' stroke='#c84' stroke-width='12' stroke-linecap='round'/>`,
        earR: `<circle cx='220' cy='30' r='10' fill='#c84'/>`,
      })
    ).problems.map((p) => p.message);
    expect(messages.join('\n')).toMatch(/'legBR' ends at y=179/);
    expect(messages.join('\n')).toMatch(/'tail' does not start at its pivot \(44,110\)/);
    expect(messages.join('\n')).toMatch(/'earR' does not start at its pivot \(220,46\)/);
  });

  it('warns about missing legs', () => {
    const c = CharacterSchema.parse({
      id: 'x',
      name: 'X',
      rig: 'quadruped',
      parts: { body: `<rect x='40' y='92' width='170' height='108' rx='30' fill='#c84'/>` },
    });
    const messages = validateCharacter(c).map((p) => p.message);
    expect(messages).toContain(`quadruped without 'legFL' will not animate it`);
  });
});
