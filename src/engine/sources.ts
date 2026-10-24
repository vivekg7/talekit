import { SOUNDS } from '../library/sounds.js';
import { hash01 } from './easing.js';
import type { Action, Project, Shot } from './types.js';

/** Where a cue's audio comes from: a bundled sound, a file in the project's audio/, or a spoken line in audio/voices/. */
export type Source = { lib: string } | { file: string } | { voice: string };

/**
 * Look up a sound by name: a file in the project's audio/ first (so a project can replace a
 * bundled sound), then a bundled one, then a bundled name with numbered variants, of which
 * `salt` picks one.
 */
export function resolveSound(project: Project, name: string, salt = ''): Source | undefined {
  if (project.audio?.files[name]) return { file: project.audio.files[name] };
  if (SOUNDS[name]) return { lib: name };
  const variants = Object.keys(SOUNDS)
    .filter((id) => id.startsWith(`${name}-`) && /^\d+$/.test(id.slice(name.length + 1)))
    .sort();
  if (!variants.length) return undefined;
  return { lib: variants[Math.floor(hash01(`${name}:${salt}`) * variants.length)] };
}

/** Seconds a sound plays, when it is a bundled one (a project's own file is not measured). */
export const soundLength = (src: Source) => ('lib' in src ? SOUNDS[src.lib].duration : undefined);

/** Which take of a sound an action plays: the same action always plays the same one. */
export const actionSalt = (shot: Shot, a: Action) => `${shot.id}:${a.actor ?? ''}@${a.t}`;
