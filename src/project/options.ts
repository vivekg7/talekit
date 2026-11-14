import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Project } from '../engine/types.js';
import { META_FILE, projectPaths } from './store.js';

/**
 * Options: the few places in a film where the agent could not tell which of two ways the
 * person wants, written both ways for them to pick in the review app. One question is a
 * folder `options/<question>/`, and each of its choices a folder beside the others, laid
 * out like the project (`characters/`, `scenes/`, `shots/`, a partial `talekit.json`,
 * `audio/`) with only what that choice changes. The project as it is stays the first
 * choice; loadProject(root, dirs) lays the chosen folders over it. Nothing renders an
 * option: the person picks, the agent writes the pick into the film and deletes the folder.
 */
export const OPTIONS_DIR = 'options';

/** `options/<question>/question.json`: what is being asked, all of it optional. */
const QuestionFileSchema = z.object({
  ask: z.string().optional(),
  /** A line on each choice, by its folder name. */
  choices: z.record(z.string(), z.string()).optional(),
  /** Where to look first: the shot (and second) that shows the difference best. */
  shot: z.string().optional(),
  t: z.number().min(0).optional(),
});

export interface Choice {
  id: string;
  label?: string;
  dir: string;
  /** The ids of what it replaces or adds, and whether it changes the meta or the sounds. */
  characters: string[];
  scenes: string[];
  shots: string[];
  meta: boolean;
  audio: boolean;
}

export interface Question {
  id: string;
  ask?: string;
  shot?: string;
  t?: number;
  choices: Choice[];
  /** The shots any choice shows up in, in the film's order. */
  touches: string[];
}

const visible = (name: string) => !name.startsWith('.') && !name.startsWith('_');

async function dirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && visible(d.name))
    .map((d) => d.name)
    .sort();
}

async function ids(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
    try {
      const id = (JSON.parse(await readFile(path.join(dir, f), 'utf8')) as { id?: unknown }).id;
      if (typeof id === 'string') out.push(id);
    } catch {
      /* loadProject reports a file that does not parse */
    }
  }
  return out;
}

/** Every open question in the project, with what each choice changes and where it shows. */
export async function listOptions(root: string, project: Project): Promise<Question[]> {
  const base = path.join(projectPaths(root).root, OPTIONS_DIR);
  const out: Question[] = [];
  for (const q of await dirs(base)) {
    const qdir = path.join(base, q);
    const file = path.join(qdir, 'question.json');
    const about = existsSync(file)
      ? QuestionFileSchema.parse(JSON.parse(await readFile(file, 'utf8')))
      : {};
    const choices: Choice[] = [];
    for (const c of await dirs(qdir)) {
      const dir = path.join(qdir, c);
      choices.push({
        id: c,
        label: about.choices?.[c],
        dir,
        characters: await ids(path.join(dir, 'characters')),
        scenes: await ids(path.join(dir, 'scenes')),
        shots: await ids(path.join(dir, 'shots')),
        meta: existsSync(path.join(dir, META_FILE)),
        audio: existsSync(path.join(dir, 'audio')),
      });
    }
    if (!choices.length) continue;
    const touches = project.shots
      .filter((s) =>
        choices.some(
          (c) =>
            c.meta ||
            c.audio ||
            c.shots.includes(s.id) ||
            c.scenes.includes(s.scene) ||
            Object.keys(s.cast).some((id) => c.characters.includes(id))
        )
      )
      .map((s) => s.id);
    // A shot only a choice has is not in the film yet; it shows where that choice puts it.
    for (const c of choices) for (const s of c.shots) if (!touches.includes(s)) touches.push(s);
    out.push({ id: q, ask: about.ask, shot: about.shot, t: about.t, choices, touches });
  }
  return out;
}

/**
 * The folders to lay over the project for these picks ({ question: choice }). One no
 * longer there is left out: the agent deletes a question once it has written the pick
 * into the film, and a page still looking at it then shows the film as it now is.
 */
export function choiceDirs(root: string, picks: Record<string, string>): string[] {
  const base = path.join(projectPaths(root).root, OPTIONS_DIR);
  return Object.entries(picks)
    .filter(([q, c]) => visible(q) && visible(c) && !/[\\/]|\.\./.test(q + c))
    .map(([q, c]) => path.join(base, q, c))
    .filter((dir) => existsSync(dir));
}

/** `tail:b,chase:a` → { tail: 'b', chase: 'a' }; empty or missing → {}. */
export function parsePicks(s: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (s ?? '').split(',')) {
    const [q, c] = part.split(':');
    if (q && c) out[q] = c;
  }
  return out;
}
