import type { Character, Scene } from '../engine/types.js';
import { CharacterSchema, SceneSchema } from '../engine/types.js';
import { saveCharacter, saveScene } from '../project/store.js';
import { KID } from './kid.js';
import { GROWNUP } from './grownup.js';
import { DOG } from './dog.js';
import { CAT } from './cat.js';
import { RABBIT } from './rabbit.js';
import { DEER } from './deer.js';
import { LION } from './lion.js';
import { BEAR } from './bear.js';
import { FOX } from './fox.js';
import { MOUSE } from './mouse.js';
import { BIRD } from './bird.js';
import { PARK } from './park.js';
import { HOME } from './home.js';
import { STREET } from './street.js';

export const LIBRARY: { characters: Record<string, Character>; scenes: Record<string, Scene> } = {
  characters: Object.fromEntries(
    [KID, GROWNUP, DOG, CAT, RABBIT, DEER, LION, BEAR, FOX, MOUSE, BIRD].map((c) => [
      c.id,
      CharacterSchema.parse(c),
    ])
  ),
  scenes: Object.fromEntries([PARK, HOME, STREET].map((s) => [s.id, SceneSchema.parse(s)])),
};

/**
 * The display name a copy gets from its new id ('old-man' → 'Old man'): a kid copied as
 * 'ramu' is Ramu in the story, not 'Kid', and not the bare lowercase id either.
 */
export function nameFromId(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Copy a built-in into a project, optionally under a new id. Returns the file written. */
export async function copyFromLibrary(
  root: string,
  libraryId: string,
  asId?: string
): Promise<string> {
  const c = LIBRARY.characters[libraryId];
  if (c)
    return saveCharacter(root, { ...c, id: asId ?? c.id, name: asId ? nameFromId(asId) : c.name });
  const s = LIBRARY.scenes[libraryId];
  if (s) return saveScene(root, { ...s, id: asId ?? s.id });
  throw new Error(
    `no library item '${libraryId}'; available: ${[...Object.keys(LIBRARY.characters), ...Object.keys(LIBRARY.scenes)].join(', ')}`
  );
}
