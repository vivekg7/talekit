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

/** Load every file. Schema errors are collected per file; cross-reference checks live in validate.ts. */
export async function loadProject(root: string): Promise<Project> {
  const p = projectPaths(root);
  const meta = await loadMeta(root);
  const errors: string[] = [];
  const characters: Record<string, Character> = {};
  const scenes: Record<string, Scene> = {};
  const shots: Shot[] = [];

  for (const { file, data } of await readJsonFiles(p.characters)) {
    const r = CharacterSchema.safeParse(data);
    if (!r.success) errors.push(`characters/${file}: ${formatIssues(r.error)}`);
    else characters[r.data.id] = r.data;
  }
  for (const { file, data } of await readJsonFiles(p.scenes)) {
    const r = SceneSchema.safeParse(data);
    if (!r.success) errors.push(`scenes/${file}: ${formatIssues(r.error)}`);
    else scenes[r.data.id] = r.data;
  }
  for (const { file, data } of await readJsonFiles(p.shots)) {
    const r = ShotSchema.safeParse(data);
    if (!r.success) errors.push(`shots/${file}: ${formatIssues(r.error)}`);
    else shots.push(r.data);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const project: Project = { meta, characters, scenes, shots, audio: await loadAudio(p.audio) };
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
