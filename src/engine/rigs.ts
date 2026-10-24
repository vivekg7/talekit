import type { RigName } from './types.js';

export interface RigPart {
  /** Parent part whose rotation this part inherits. */
  parent?: string;
  /** Rotation pivot in canonical coordinates. */
  pivot: [number, number];
  /** Draw order; lower is further back. */
  z: number;
}

export interface Rig {
  name: RigName;
  width: number;
  height: number;
  parts: Record<string, RigPart>;
  /** Used for parts the character defines that the rig does not know about. */
  unknown: RigPart;
  /** The part that must exist for the character to be drawable. */
  required: string;
  /** Parts that animate when present; missing ones are worth a warning. */
  expected: string[];
  /** Parts that must reach the base line: the feet. Empty means "the lowest point". */
  feet: string[];
  /**
   * Joints the construction linter checks: `part` must sink into `into`, and when `pivot`
   * is set, must also cover its own pivot (it hangs from there).
   */
  joints: { part: string; into: string; pivot: boolean }[];
  /** Where a speech bubble points, in canonical coordinates: just above the head. */
  speaker: [number, number];
  /** Follow-through parts that swing on a spring unless the character lists its own. */
  springs: string[];
  /** Between the eyes: where a look starts and where others look to. */
  eye: [number, number];
  /** Where a carried prop is held (`attach`): a point drawn in `part`, so it moves with it. */
  hold: { part: string; point: [number, number] };
  /** Width of the ground shadow, canonical units: about the span of the feet. */
  shadow: number;
  /**
   * Parts whose outline is drawn with another part's, under its fill: where the two
   * overlap there is no line between them, so a neck grows out of the shoulders instead
   * of being stuck on in front of them. Keyed by the part, valued by the one it joins.
   */
  fuse: Record<string, string>;
  /**
   * Where each limb bends, in the limb's own coordinates: the knee on a leg, the elbow on
   * an arm, a point on the line the limb hangs along. The composer cuts a bent limb here
   * with a round joint and turns the lower half (`Pose.bend`), so every limb drawn as one
   * straight stroke gets its joint for free.
   */
  bends: Record<string, [number, number]>;
  /**
   * The turn: `parts` (the face) are drawn front-on, centred on x = `centre`, and the
   * engine slides them `shift` units toward the way the character faces and narrows them to
   * `narrow`, which turns a round head to three-quarters (`Pose.yaw`); a turning character's
   * face passes through front-on. The body turns with it: `body` parts narrow to
   * `bodyNarrow` about the centre and the `limbs` hang that much closer in, so the far
   * shoulder and hip go behind the body.
   */
  turn?: {
    parts: string[];
    centre: number;
    shift: number;
    narrow: number;
    body: string[];
    limbs: string[];
    bodyNarrow: number;
  };
}

/**
 * Humanoid: 200×400 box, feet on y=400, centre x=100. Drawn facing slightly right.
 * The engine rotates parts around these pivots, so artwork should hang from them:
 * arms from the shoulders, legs from the hips, the head from the neck.
 */
export const HUMANOID: Rig = {
  name: 'humanoid',
  width: 200,
  height: 400,
  required: 'torso',
  parts: {
    armL: { parent: 'torso', pivot: [76, 170], z: 0 }, // far arm, drawn behind the torso
    legL: { pivot: [86, 272], z: 1 },
    legR: { pivot: [114, 272], z: 2 },
    torso: { pivot: [100, 272], z: 3 },
    head: { parent: 'torso', pivot: [100, 152], z: 5 },
    // Nose, cheeks, freckles, glasses: what is drawn on the face and turns with it.
    face: { parent: 'head', pivot: [100, 152], z: 5.5 },
    eyes: { parent: 'head', pivot: [100, 152], z: 6 },
    mouth: { parent: 'head', pivot: [100, 152], z: 7 },
    armR: { parent: 'torso', pivot: [124, 170], z: 8 }, // near arm, drawn in front
  },
  unknown: { parent: 'torso', pivot: [100, 272], z: 4 },
  expected: ['head', 'legL', 'legR', 'armL', 'armR'],
  feet: ['legL', 'legR'],
  joints: [
    { part: 'armL', into: 'torso', pivot: true },
    { part: 'armR', into: 'torso', pivot: true },
    { part: 'legL', into: 'torso', pivot: true },
    { part: 'legR', into: 'torso', pivot: true },
    { part: 'head', into: 'torso', pivot: false },
  ],
  speaker: [100, 8],
  springs: [],
  // Where the turned face puts them.
  eye: [122, 96],
  // The near hand, at the end of a hanging arm.
  hold: { part: 'armR', point: [129, 284] },
  shadow: 130,
  // The chin keeps its line against the chest: a person's head sits in front of the body.
  fuse: {},
  // Knees halfway from the hip to the top of the shoe; elbows halfway down the arm.
  bends: { legL: [86, 330], legR: [114, 330], armL: [73, 226], armR: [127, 226] },
  // A third of the way round a head about 110 across: far enough that the face looks the
  // way the body goes, near enough that both eyes stay on it.
  // The body, wider than it is deep, narrows less than the face moves.
  turn: {
    parts: ['face', 'eyes', 'mouth'],
    centre: 100,
    shift: 22,
    narrow: 0.8,
    body: ['torso'],
    limbs: ['armL', 'armR', 'legL', 'legR'],
    bodyNarrow: 0.88,
  },
};

/**
 * Simple: 200×200 box, base on y=200. One `body` part plus optional face parts.
 * Good for animals, props and anything that moves by bobbing rather than walking.
 */
export const SIMPLE: Rig = {
  name: 'simple',
  width: 200,
  height: 200,
  required: 'body',
  parts: {
    body: { pivot: [100, 200], z: 1 },
    eyes: { parent: 'body', pivot: [100, 100], z: 2 },
    mouth: { parent: 'body', pivot: [100, 100], z: 3 },
  },
  unknown: { parent: 'body', pivot: [100, 100], z: 4 },
  expected: [],
  feet: [],
  joints: [],
  speaker: [100, 8],
  springs: [],
  eye: [130, 80],
  hold: { part: 'body', point: [150, 110] },
  shadow: 120,
  fuse: {},
  bends: {},
};

/**
 * Quadruped: 260×200 box, feet on y=200, facing right. Every leg, the tail and the head
 * hang from the body, so tilting the body (sit, the gallop's rock) carries them; the ears
 * and face hang from the head. The body turns about the hips, which is how an animal sits.
 * L is the far side, R the near side, as on the humanoid: far legs behind the body.
 */
export const QUADRUPED: Rig = {
  name: 'quadruped',
  width: 260,
  height: 200,
  required: 'body',
  parts: {
    legBL: { parent: 'body', pivot: [66, 132], z: 0 }, // far hind leg
    legFL: { parent: 'body', pivot: [178, 132], z: 1 }, // far front leg
    tail: { parent: 'body', pivot: [44, 110], z: 2 },
    body: { pivot: [72, 132], z: 3 },
    legBR: { parent: 'body', pivot: [82, 132], z: 5 }, // near hind leg
    legFR: { parent: 'body', pivot: [194, 132], z: 6 }, // near front leg: points, waves
    // Both ears sit behind the head, so the head's outline closes their base: an ear in
    // front would carry its own line across the forehead and look stuck on.
    earL: { parent: 'head', pivot: [204, 46], z: 7 }, // far ear
    earR: { parent: 'head', pivot: [220, 46], z: 7.5 },
    head: { parent: 'body', pivot: [196, 108], z: 8 },
    eyes: { parent: 'head', pivot: [196, 108], z: 10 },
    mouth: { parent: 'head', pivot: [196, 108], z: 11 },
  },
  unknown: { parent: 'body', pivot: [124, 120], z: 4 },
  expected: ['head', 'legFL', 'legFR', 'legBL', 'legBR'],
  feet: ['legFL', 'legFR', 'legBL', 'legBR'],
  joints: [
    { part: 'legBL', into: 'body', pivot: true },
    { part: 'legFL', into: 'body', pivot: true },
    { part: 'legBR', into: 'body', pivot: true },
    { part: 'legFR', into: 'body', pivot: true },
    { part: 'tail', into: 'body', pivot: true },
    { part: 'head', into: 'body', pivot: false },
    { part: 'earL', into: 'head', pivot: true },
    { part: 'earR', into: 'head', pivot: true },
  ],
  speaker: [214, 8],
  springs: ['tail', 'earL', 'earR'],
  eye: [226, 62],
  // In the mouth, under the muzzle.
  hold: { part: 'head', point: [240, 100] },
  shadow: 200,
  // The head is drawn with its neck, which sinks into the shoulders. The near legs grow out
  // of the body the same way: a haunch or a shoulder with a line all round it reads as a
  // drumstick stuck on the side, so the line shows only where the leg leaves the body.
  // The far legs are behind the body, which already hides their tops.
  fuse: { head: 'body', legBR: 'body', legFR: 'body' },
  // Stifle on the hind legs, elbow on the front ones: halfway down.
  bends: {
    legBL: [66, 166],
    legFL: [178, 166],
    legBR: [82, 166],
    legFR: [194, 166],
  },
};

export const RIGS: Record<RigName, Rig> = {
  humanoid: HUMANOID,
  simple: SIMPLE,
  quadruped: QUADRUPED,
};

export function rigPart(rig: Rig, name: string): RigPart {
  return rig.parts[name] ?? rig.unknown;
}
