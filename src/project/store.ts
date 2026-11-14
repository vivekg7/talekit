import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  CharacterSchema,
  ProjectMetaSchema,
  SceneSchema,
  ShotSchema,
  type Character,
  type Project,
  type ProjectAudio,
  type ProjectMeta,
  type Scene,
  type Shot,
  type VoiceClip,
} from '../engine/types.js';
import { badTake, matchTake, type TakeMatch } from '../engine/speech.js';
import { timeActions } from '../engine/voice.js';

export const META_FILE = 'talekit.json';

export interface ProjectPaths {
  root: string;
  meta: string;
  characters: string;
  scenes: string;
  shots: string;
  /** The project's own sounds and music, named by file name without the extension. */
  audio: string;
  out: string;
}

export function projectPaths(root: string): ProjectPaths {
  root = path.resolve(root);
  return {
    root,
    meta: path.join(root, META_FILE),
    characters: path.join(root, 'characters'),
    scenes: path.join(root, 'scenes'),
    shots: path.join(root, 'shots'),
    audio: path.join(root, 'audio'),
    out: path.join(root, 'out'),
  };
}

export function isProject(root: string): boolean {
  return existsSync(projectPaths(root).meta);
}

export async function createProject(
  root: string,
  meta: Partial<ProjectMeta> & { title: string }
): Promise<ProjectMeta> {
  const p = projectPaths(root);
  if (existsSync(p.meta)) throw new Error(`${p.root} is already a talekit project`);
  const parsed = ProjectMetaSchema.parse(meta);
  await mkdir(p.characters, { recursive: true });
  await mkdir(p.scenes, { recursive: true });
  await mkdir(p.shots, { recursive: true });
  await mkdir(p.out, { recursive: true });
  await writeFile(p.meta, JSON.stringify(parsed, null, 2) + '\n');
  await writeFile(path.join(p.root, '.gitignore'), 'out/\n');
  return parsed;
}

async function readJsonFiles(dir: string): Promise<{ file: string; data: unknown }[]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const out: { file: string; data: unknown }[] = [];
  for (const file of files) {
    const text = await readFile(path.join(dir, file), 'utf8');
    try {
      out.push({ file, data: JSON.parse(text) });
    } catch (e) {
      throw new Error(`${path.join(dir, file)}: invalid JSON (${(e as Error).message})`);
    }
  }
  return out;
}

export async function loadMeta(root: string): Promise<ProjectMeta> {
  const p = projectPaths(root);
  if (!existsSync(p.meta)) throw new Error(`${p.root} is not a talekit project (no ${META_FILE})`);
  return ProjectMetaSchema.parse(JSON.parse(await readFile(p.meta, 'utf8')));
}

export async function saveMeta(root: string, meta: ProjectMeta): Promise<string> {
  const p = projectPaths(root);
  await writeFile(p.meta, JSON.stringify(ProjectMetaSchema.parse(meta), null, 2) + '\n');
  return p.meta;
}

/**
 * Load every file. Schema errors are collected per file; cross-reference checks live in validate.ts.
 * `over` are option choices (options.ts), each a folder laid out like the project: an item
 * there replaces the project's one of the same id, a new id joins it (a shot in its file
 * name's place), its `talekit.json` is merged over the meta and its `audio/` files over the
 * project's. The project on disk is not touched.
 */
export async function loadProject(root: string, over: string[] = []): Promise<Project> {
  const p = projectPaths(root);
  let meta = await loadMeta(root);
  const errors: string[] = [];
  const characters: Record<string, Character> = {};
  const scenes: Record<string, Scene> = {};
  const shotFiles: { file: string; shot: Shot }[] = [];
  const layers = [p.root, ...over.map((o) => path.resolve(o))];

  for (const [i, dir] of layers.entries()) {
    const where = (sub: string, file: string) =>
      i ? `${path.relative(p.root, dir)}/${sub}/${file}` : `${sub}/${file}`;
    for (const { file, data } of await readJsonFiles(path.join(dir, 'characters'))) {
      const r = CharacterSchema.safeParse(data);
      if (!r.success) errors.push(`${where('characters', file)}: ${formatIssues(r.error)}`);
      else characters[r.data.id] = r.data;
    }
    for (const { file, data } of await readJsonFiles(path.join(dir, 'scenes'))) {
      const r = SceneSchema.safeParse(data);
      if (!r.success) errors.push(`${where('scenes', file)}: ${formatIssues(r.error)}`);
      else scenes[r.data.id] = r.data;
    }
    for (const { file, data } of await readJsonFiles(path.join(dir, 'shots'))) {
      const r = ShotSchema.safeParse(data);
      if (!r.success) errors.push(`${where('shots', file)}: ${formatIssues(r.error)}`);
      else {
        const known = shotFiles.findIndex((s) => s.shot.id === r.data.id);
        if (known >= 0) shotFiles[known].shot = r.data;
        else shotFiles.push({ file, shot: r.data });
      }
    }
    if (i && existsSync(path.join(dir, META_FILE))) {
      const extra = JSON.parse(await readFile(path.join(dir, META_FILE), 'utf8')) as object;
      meta = ProjectMetaSchema.parse({ ...meta, ...extra });
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  // Shots play in file name order; a new one from a choice takes its name's place.
  const shots = over.length
    ? shotFiles.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)).map((s) => s.shot)
    : shotFiles.map((s) => s.shot);
  let audio = await loadAudio(p.audio);
  for (const dir of layers.slice(1)) {
    const more = await loadAudio(path.join(dir, 'audio'));
    for (const [name, f] of Object.entries(more.files))
      audio = { ...audio, files: { ...audio.files, [name]: path.join(more.dir, f) } };
  }
  const project: Project = { meta, characters, scenes, shots, audio };
  for (const shot of shots) timeActions(project, shot);
  return project;
}

/** Formats ffmpeg decodes that a project's audio/ folder may hold. */
const AUDIO_EXT = new Set(['.ogg', '.opus', '.wav', '.mp3', '.flac', '.m4a', '.aac']);

export async function loadAudio(dir: string): Promise<ProjectAudio> {
  const files: Record<string, string> = {};
  if (existsSync(dir))
    for (const f of (await readdir(dir)).sort()) {
      const ext = path.extname(f).toLowerCase();
      if (AUDIO_EXT.has(ext)) files[path.basename(f, path.extname(f))] ??= f;
    }
  return { dir, files, voices: await loadVoiceIndex(dir) };
}

/** One spoken line's entry in audio/voices/index.json. */
export interface VoiceEntry {
  file: string;
  voice: string;
  speed: number;
  pitch: number;
  emotion: string;
  style: string;
  text: string;
  duration: number;
  /** Loudness at ENVELOPE_RATE, one byte (0 to 255) a sample, base64. */
  envelope: string;
  /** Which take this is, when not the first: the line was said again (see voices.ts). */
  take?: number;
  /**
   * The file's size as talekit wrote it. A file of another size (or an entry without one,
   * from before takes were checked) was made or changed by hand, and is never said again
   * over: a trembled line, a shout re-voiced by ear.
   */
  bytes?: number;
  /**
   * What speech recognition heard it say, and how that compared with the line then. Whether
   * it says the line is judged again from `heard` each time (engine/speech.ts).
   */
  heard?: string;
  match?: TakeMatch;
}

export const voiceIndexPath = (audioDir: string) => path.join(audioDir, 'voices', 'index.json');

export async function readVoiceIndex(audioDir: string): Promise<Record<string, VoiceEntry>> {
  const file = voiceIndexPath(audioDir);
  if (!existsSync(file)) return {};
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadVoiceIndex(audioDir: string): Promise<Record<string, VoiceClip>> {
  const out: Record<string, VoiceClip> = {};
  for (const [key, e] of Object.entries(await readVoiceIndex(audioDir)))
    if (existsSync(path.join(audioDir, 'voices', e.file)))
      out[key] = {
        file: e.file,
        duration: e.duration,
        envelope: [...Buffer.from(e.envelope, 'base64')].map((b) => b / 255),
        ...(e.heard !== undefined && badTake(e.text, matchTake(e.text, e.heard))
          ? { doubt: { heard: e.heard } }
          : {}),
      };
  return out;
}

export function formatIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((i) => `${i.path.length ? i.path.map(String).join('.') + ': ' : ''}${i.message}`)
    .join('; ');
}

export async function saveCharacter(root: string, c: Character): Promise<string> {
  const file = path.join(projectPaths(root).characters, `${c.id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(c, null, 2) + '\n');
  return file;
}

export async function saveScene(root: string, s: Scene): Promise<string> {
  const file = path.join(projectPaths(root).scenes, `${s.id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(s, null, 2) + '\n');
  return file;
}

/** The playback position in a saved shot's file name (`07-` is 7), if it has one. */
export async function shotOrder(root: string, id: string): Promise<number | undefined> {
  const dir = projectPaths(root).shots;
  for (const f of existsSync(dir) ? await readdir(dir) : []) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as { id?: string };
      if (data.id === id) {
        const m = f.match(/^(\d+)-/);
        return m ? Number(m[1]) : undefined;
      }
    } catch {
      /* unreadable files are loadProject's to report */
    }
  }
  return undefined;
}

/** Shots play in filename order, so the file name carries an optional numeric prefix. */
export async function saveShot(root: string, s: Shot, order?: number): Promise<string> {
  const dir = projectPaths(root).shots;
  await mkdir(dir, { recursive: true });
  // Replace an existing file for this id whatever its prefix, so re-ordering does not duplicate.
  for (const f of existsSync(dir) ? await readdir(dir) : []) {
    if (f.endsWith('.json')) {
      const text = await readFile(path.join(dir, f), 'utf8');
      try {
        if ((JSON.parse(text) as { id?: string }).id === s.id) await rm(path.join(dir, f));
      } catch {
        /* ignore unreadable files; loadProject reports them */
      }
    }
  }
  const prefix = order !== undefined ? String(order).padStart(2, '0') + '-' : '';
  const file = path.join(dir, `${prefix}${s.id}.json`);
  await writeFile(file, JSON.stringify(storedShot(s), null, 2) + '\n');
  return file;
}

/** A shot as its file has it: an action placed `after` a line keeps that, not the time it
 * last worked out to. */
export function storedShot(s: Shot): object {
  const actions = s.actions.map((a) => {
    if (a.after === undefined) return a;
    const { t: _, ...rest } = a;
    return rest;
  });
  return { ...s, actions };
}
