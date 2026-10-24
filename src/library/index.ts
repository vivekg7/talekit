import type { Character, Scene } from '../engine/types.js';
import { CharacterSchema, SceneSchema } from '../engine/types.js';
import { saveCharacter, saveScene } from '../project/store.js';
import { KID } from './kid.js';
import { GROWNUP } from './grownup.js';
import { BOY } from './boy.js';
import { WOMAN } from './woman.js';
import { FARMER } from './farmer.js';
import { GRANDPA } from './grandpa.js';
import { GRANDMA } from './grandma.js';
import { PIRATE } from './pirate.js';
import { DOG } from './dog.js';
import { CAT } from './cat.js';
import { RABBIT } from './rabbit.js';
import { DEER } from './deer.js';
import { LION } from './lion.js';
import { TIGER } from './tiger.js';
import { BEAR } from './bear.js';
import { FOX } from './fox.js';
import { JACKAL } from './jackal.js';
import { CROCODILE } from './crocodile.js';
import { MOUSE } from './mouse.js';
import { BIRD } from './bird.js';
import { CROW } from './crow.js';
import { PARROT } from './parrot.js';
import { SWAN } from './swan.js';
import { FROG } from './frog.js';
import { FISH } from './fish.js';
import { COBRA } from './cobra.js';
import { PARK } from './park.js';
import { HOME } from './home.js';
import { STREET } from './street.js';
import { JUNGLE } from './jungle.js';
import { CAVE } from './cave.js';
import { HUT } from './hut.js';
import { POND } from './pond.js';

export const LIBRARY: { characters: Record<string, Character>; scenes: Record<string, Scene> } = {
  characters: Object.fromEntries(
    [
      KID,
      BOY,
      GROWNUP,
      WOMAN,
      FARMER,
      GRANDPA,
      GRANDMA,
      PIRATE,
      DOG,
      CAT,
      RABBIT,
      DEER,
      LION,
      TIGER,
      BEAR,
      FOX,
      JACKAL,
      CROCODILE,
      MOUSE,
      BIRD,
      CROW,
      PARROT,
      SWAN,
      FROG,
      FISH,
      COBRA,
    ].map((c) => [c.id, CharacterSchema.parse(c)])
  ),
  scenes: Object.fromEntries(
    [PARK, HOME, STREET, JUNGLE, CAVE, HUT, POND].map((s) => [s.id, SceneSchema.parse(s)])
  ),
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
