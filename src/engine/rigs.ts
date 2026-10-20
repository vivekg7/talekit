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
    eyes: { parent: 'head', pivot: [100, 152], z: 6 },
    mouth: { parent: 'head', pivot: [100, 152], z: 7 },
    armR: { parent: 'torso', pivot: [124, 170], z: 8 }, // near arm, drawn in front
  },
  unknown: { parent: 'torso', pivot: [100, 272], z: 4 },
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
};

export const RIGS: Record<RigName, Rig> = { humanoid: HUMANOID, simple: SIMPLE };

export function rigPart(rig: Rig, name: string): RigPart {
  return rig.parts[name] ?? rig.unknown;
}
