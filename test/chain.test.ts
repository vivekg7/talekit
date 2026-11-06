import { describe, expect, it } from 'vitest';
import { characterBody, keepOffFloor } from '../src/engine/actor.js';
import { linkAngles, linkFor } from '../src/engine/chain.js';
import { toRoot } from '../src/engine/gait.js';
import { applyVerb, basePose, emptyPose } from '../src/engine/motion.js';
import { RIGS, rigOf } from '../src/engine/rigs.js';
import { CharacterSchema } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

const croc = () => CharacterSchema.parse(LIBRARY.characters.crocodile);

describe('chains', () => {
  it('cuts a part into links along it, the joints on its middle', () => {
    const xs = Array.from({ length: 11 }, (_, i) => 100 - 10 * i);
    const bar = `<path d='M${xs.map((x) => `${x} 90`).join(' L')} L${[...xs]
      .reverse()
      .map((x) => `${x} 110`)
      .join(' L')} Z' fill='#000'/>`;
    const link = linkFor(bar, [100, 100], 4)!;
    expect(link.joints).toHaveLength(3);
    for (const [, y] of link.joints) expect(y).toBeCloseTo(100, 0);
    expect(link.joints.map(([x]) => Math.round(x))).toEqual([75, 50, 25]);
    expect(link.shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    // The root takes more of a turn than the tip.
    expect(link.shares[0]).toBeGreaterThan(link.shares[3]);
    for (const r of link.radii) expect(r).toBeGreaterThan(8);
    expect(linkFor(bar, [100, 100], 1)).toBeUndefined();
  });

  it("turns a character's part about its own pivot and cuts its chains", () => {
    const rig = rigOf(croc());
    expect(rig.parts.tail.pivot).toEqual([84, 128]);
    expect(RIGS.quadruped.parts.tail.pivot).toEqual([44, 110]);
    expect(rig.links?.tail.joints).toHaveLength(3);
    expect(rig.links?.head.joints).toEqual([[201, 111]]);
    // Every quadruped's tail is a chain by default.
    expect(rigOf(CharacterSchema.parse(LIBRARY.characters.lion)).links?.tail).toBeDefined();
  });

  it('bends what lies past a joint, and carries what hangs from the last link', () => {
    const rig = rigOf(croc());
    const link = rig.links!.head;
    const pose = emptyPose();
    pose.rot.head = 30;
    const angles = linkAngles(link, pose, 'head');
    expect(angles[0] + angles[1]).toBeCloseTo(30);
    const snout: [number, number] = [255, 112];
    const nape: [number, number] = [185, 120];
    const turned = toRoot(rig, pose, 'head', snout);
    // The neck turns the nape by its share only; the snout by the whole turn.
    const stiff = emptyPose();
    stiff.rot.head = 30;
    stiff.curl = { head: [0, -angles[1]] };
    expect(toRoot(rig, pose, 'head', nape)).toEqual(toRoot(rig, stiff, 'head', nape));
    expect(turned[1]).toBeGreaterThan(toRoot(rig, stiff, 'head', snout)[1]);
    // The mouth (hung from the head) goes with the snout.
    const mouth = toRoot(rig, pose, 'mouth', snout);
    expect(mouth[0]).toBeCloseTo(turned[0]);
    expect(mouth[1]).toBeCloseTo(turned[1]);
  });

  it('draws a bent chain link by link', () => {
    const c = croc();
    const pose = emptyPose();
    pose.rot.tail = 20;
    expect(characterBody(c, pose)).toContain('tk-chain-crocodile-tail');
    expect(characterBody(c, emptyPose())).not.toContain('tk-chain-');
  });

  it('keeps a lying tail off the floor', () => {
    const c = croc();
    const rig = rigOf(c);
    const pose = basePose(rig, 'idle', 0, 0);
    applyVerb(rig, pose, 'sit', 1);
    applyVerb(rig, pose, 'lie', 1);
    const tipY = () => toRoot(rig, pose, 'tail', rig.links!.tail.tip)[1];
    expect(tipY()).toBeGreaterThan(rig.height);
    keepOffFloor(rig, pose, 'tail');
    expect(tipY()).toBeLessThanOrEqual(rig.height + 0.01);
  });

  it('nods a short head to eat, and less lying down', () => {
    const c = { ...croc(), muzzle: [236, 119] as [number, number] };
    const rig = rigOf(c);
    const standing = emptyPose();
    applyVerb(rig, standing, 'eat', 0.5, 0, undefined, 3);
    expect(standing.rot.head).toBeLessThan(30);
    const lying = emptyPose();
    applyVerb(rig, lying, 'lie', 1);
    const before = lying.rot.head ?? 0;
    applyVerb(rig, lying, 'eat', 0.5, 0, undefined, 3);
    expect(lying.rot.head! - before).toBeLessThan(standing.rot.head! / 2);
  });
});
