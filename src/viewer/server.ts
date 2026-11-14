import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import { cueSheet, type Bus } from '../engine/sound.js';
import { movieDuration } from '../engine/timeline.js';
import { MixSchema, type Project } from '../engine/types.js';
import {
  addNote,
  checkNote,
  deleteNote,
  loadNotes,
  NOTES_FILE,
  NoteTargetSchema,
  pickNote,
  type NoteTarget,
  reopenNote,
  setNoteStatus,
} from '../project/notes.js';
import { choiceDirs, listOptions, OPTIONS_DIR, parsePicks } from '../project/options.js';
import { isProject, loadProject, projectPaths, saveMeta } from '../project/store.js';
import { formatProblems, validateProject } from '../project/validate.js';
import { mixAudio, RATE } from '../render/audio.js';
import { writeMkv } from '../render/mkv.js';
import { isPortrait, safeInsets } from '../engine/format.js';
import { lineDuration, shownText } from '../engine/voice.js';
import { remixVideo } from '../render/video.js';
import type { DrawRequest } from './draw-worker.js';
import { BOARD } from './board-page.js';
import { PAGE } from './page.js';

/** The source tree this file runs from: src/ under tsx, dist/ once built. */
const CODE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXT = path.extname(fileURLToPath(import.meta.url));
/** The drawing worker beside this file, as .ts under tsx and .js once built. */
const DRAW_WORKER = new URL(`./draw-worker${EXT}`, import.meta.url);

/**
 * Run from source, the worker needs tsx to resolve the engine's `.js` imports to `.ts`. A
 * process started by tsx passes it on; one that was not (vitest) is given it here.
 */
function workerArgs(): string[] {
  const args = process.execArgv;
  if (EXT !== '.ts' || args.some((a) => a.includes('tsx'))) return args;
  return [...args, '--import', 'tsx'];
}

let code = { at: 0, version: 0 };
/**
 * Newest mtime across the engine's own source (or build), looked at once a second at most:
 * when it moves, the pictures are drawn by a fresh worker with the code as it now is, and
 * the page, which counts it in the project's version, reloads.
 */
async function codeVersion(): Promise<number> {
  if (Date.now() - code.at < 1000) return code.version;
  let latest = 0;
  for (const f of await readdir(CODE, { recursive: true })) {
    if (!f.endsWith(EXT)) continue;
    try {
      latest = Math.max(latest, (await stat(path.join(CODE, f))).mtimeMs);
    } catch {
      /* deleted between readdir and stat */
    }
  }
  code = { at: Date.now(), version: Math.round(latest) };
  return code.version;
}

interface Drawer {
  worker: Worker;
  version: number;
  pending: Map<number, { resolve: (svg: string) => void; reject: (e: Error) => void }>;
  retired: boolean;
}
let drawer: Drawer | undefined;
let drawSeq = 0;

/**
 * A picture drawn in the worker (draw-worker.ts). A worker serves until the code changes;
 * then the next picture starts a new one, which imports the new code, and the old one is
 * let go once it has answered what it was asked. One that dies (a half-saved source file)
 * fails what it held, and the next picture tries again.
 */
async function drawSvg(job: DrawRequest): Promise<string> {
  const version = await codeVersion();
  if (!drawer || drawer.version !== version) {
    const old = drawer;
    if (old) {
      old.retired = true;
      if (!old.pending.size) void old.worker.terminate();
    }
    const fresh: Drawer = {
      worker: new Worker(DRAW_WORKER, { execArgv: workerArgs() }),
      version,
      pending: new Map(),
      retired: false,
    };
    fresh.worker.on('message', (m: { seq: number; svg?: string; error?: string }) => {
      const wait = fresh.pending.get(m.seq);
      fresh.pending.delete(m.seq);
      if (m.error !== undefined) wait?.reject(new Error(m.error));
      else wait?.resolve(m.svg!);
      if (fresh.retired && !fresh.pending.size) void fresh.worker.terminate();
    });
    fresh.worker.on('error', (e: Error) => {
      for (const wait of fresh.pending.values()) wait.reject(e);
      fresh.pending.clear();
      if (drawer === fresh) drawer = undefined;
    });
    fresh.worker.unref();
    drawer = fresh;
  }
  const d = drawer;
  const seq = ++drawSeq;
  return new Promise((resolve, reject) => {
    d.pending.set(seq, { resolve, reject });
    d.worker.postMessage({ ...job, seq });
  });
}

/**
 * Newest mtime across everything that changes what the page shows, the engine's code
 * included. The page polls this and reloads when it moves, so an agent writing through the
 * MCP shows up within a second or two without a file watcher (which would need a native
 * dependency or a recursive fs.watch).
 */
async function projectVersion(root: string): Promise<number> {
  const p = projectPaths(root);
  let latest = 0;
  const touch = async (file: string) => {
    try {
      latest = Math.max(latest, (await stat(file)).mtimeMs);
    } catch {
      /* deleted between readdir and stat */
    }
  };
  await touch(p.meta);
  await touch(path.join(p.root, NOTES_FILE));
  await touch(path.join(p.out, 'movie.mp4'));
  latest = Math.max(latest, await codeVersion());
  for (const dir of [p.characters, p.scenes, p.shots]) {
    if (!existsSync(dir)) continue;
    await touch(dir);
    for (const f of await readdir(dir)) await touch(path.join(dir, f));
  }
  // Options are folders of folders: a choice written, changed or deleted moves it too.
  const options = path.join(p.root, OPTIONS_DIR);
  if (existsSync(options)) {
    await touch(options);
    for (const f of await readdir(options, { recursive: true })) await touch(path.join(options, f));
  }
  return Math.round(latest);
}

/**
 * The checks' report, worked out again only when the project changed. The page asks for the
 * project after every agent write and every note, and the world and sight checks take most
 * of a second on a film; frames wait behind them. The checks read nothing but the project,
 * so its JSON is the key.
 */
const PROBLEMS = new Map<string, { key: string; report: string }>();
function problemsOf(root: string, project: Project, opt = ''): string {
  const key = createHash('sha1').update(JSON.stringify(project)).digest('hex');
  const known = PROBLEMS.get(root + opt);
  if (known?.key === key) return known.report;
  const report = formatProblems(validateProject(project));
  PROBLEMS.set(root + opt, { key, report });
  return report;
}

async function movieInfo(root: string): Promise<{ mtime: number; stale: boolean } | null> {
  const p = projectPaths(root);
  const file = path.join(p.out, 'movie.mp4');
  if (!existsSync(file)) return null;
  const mtime = (await stat(file)).mtimeMs;
  // Stale when any shot (or scene or character) was written after the render.
  let newest = 0;
  for (const dir of [p.characters, p.scenes, p.shots]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir))
      newest = Math.max(newest, (await stat(path.join(dir, f))).mtimeMs);
  }
  return { mtime: Math.round(mtime), stale: newest > mtime };
}

/**
 * The film's sound as the page plays it: each bus mixed on its own, at the engine's levels
 * and without the project's `mix`, so the sliders can set that live over them. Mixing is
 * linear, so the four played together at the mix's gains are the film's sound (short of the
 * soft clip on the loudest peaks). Keyed by the cue sheet: the same sound is mixed once.
 */
const STEMS: Bus[] = ['voice', 'music', 'ambience', 'sfx'];
function stemsOf(project: Project): { key: string; buses: Bus[]; bare: Project } | undefined {
  const bare = { ...project, meta: { ...project.meta, mix: undefined } };
  const cues = cueSheet(bare);
  if (!cues.length) return undefined;
  const key = createHash('sha1').update(JSON.stringify(cues)).digest('hex').slice(0, 16);
  return { key, buses: STEMS.filter((b) => cues.some((c) => c.bus === b)), bare };
}
const making = new Map<string, Promise<void>>();
async function makeStem(root: string, project: Project, bus: Bus): Promise<string> {
  const stems = stemsOf(project);
  if (!stems) throw new Error('nothing sounds in this film');
  const dir = path.join(projectPaths(root).out, 'stems');
  const file = path.join(dir, `${stems.key}-${bus}.m4a`);
  if (existsSync(file)) return file;
  if (!making.has(file))
    making.set(
      file,
      (async () => {
        const samples = (await mixAudio(stems.bare, stems.bare.shots, { buses: [bus] }))!;
        await mkdir(dir, { recursive: true });
        const tmp = `${file}.tmp.m4a`;
        await new Promise<void>((resolve, reject) => {
          const ff = spawn(
            'ffmpeg',
            [
              ...['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-'],
              ...['-c:a', 'aac', '-b:a', '160k', tmp],
            ],
            { stdio: ['pipe', 'ignore', 'pipe'] }
          );
          let err = '';
          ff.stderr.on('data', (d) => (err += d));
          ff.on('error', reject);
          ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim()))));
          ff.stdin.end(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
        });
        await rename(tmp, file);
      })().finally(() => making.delete(file))
    );
  await making.get(file);
  return file;
}

/**
 * Every line of the film, as the page shows it under the picture while it plays and lists
 * as each shot's script: who says it (a character's name, or the narrator for a caption),
 * and the seconds of its shot its bubble or caption is up.
 */
function linesOf(project: Project) {
  return project.shots.flatMap((shot) =>
    shot.actions
      .filter((a) => a.say || a.caption)
      .map((a) => ({
        shot: shot.id,
        t: a.t,
        end: Math.min(shot.duration, a.t + lineDuration(project, shot, a)),
        who: a.say
          ? (project.characters[a.actor ?? '']?.name ?? a.actor ?? '')
          : a.captionStyle === 'title'
            ? 'title'
            : 'narrator',
        text: shownText((a.say ?? a.caption)!).trim(),
      }))
  );
}

/** This machine's address on the local network, for a phone to reach a LAN review app. */
function lanAddress(): string {
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  throw new Error('no local network address to serve on');
}

/** Serve a file with Range support; without it the browser cannot seek the video. */
async function serveFile(
  file: string,
  type: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const size = (await stat(file)).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  let start = 0;
  let end = size - 1;
  if (range) {
    if (range[1]) start = Number(range[1]);
    if (range[2]) end = Number(range[2]);
    if (!range[1] && range[2]) start = Math.max(0, size - Number(range[2]));
    end = Math.min(end, size - 1);
    if (start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
      return;
    }
  }
  res.writeHead(range ? 206 : 200, {
    'content-type': type,
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
    ...(range ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
  });
  createReadStream(file, { start, end }).pipe(res);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c.toString()));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

type Res = http.ServerResponse;
const json = (res: Res, body: unknown, status = 200) =>
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));

/** One thing the review server shows: a film or reel, or a board of samples. */
interface Item {
  slug: string;
  root: string;
  kind: 'project' | 'board';
  title: string;
  portrait: boolean;
  /** The board a sample project was found on. */
  board?: string;
}

/**
 * The notes routes every item has, project or board: add, pick, reopen, close, delete.
 * True when the request was one of them.
 */
async function noteRoute(
  root: string,
  rel: string,
  method: string,
  req: http.IncomingMessage,
  res: Res,
  check: (target: NoteTarget) => void
): Promise<boolean> {
  if (rel === '/api/notes' && method === 'POST') {
    const body = (await readBody(req)) as { target: unknown; text: string };
    const target = NoteTargetSchema.parse(body.target);
    check(target);
    json(res, await addNote(root, target, body.text));
    return true;
  }
  if (rel === '/api/pick' && method === 'POST') {
    const body = (await readBody(req)) as { target: unknown; text?: string };
    const target = NoteTargetSchema.parse(body.target);
    check(target);
    json(res, await pickNote(root, target, body.text));
    return true;
  }
  const noteMatch = /^\/api\/notes\/([^/]+)$/.exec(rel);
  if (noteMatch && method === 'PATCH') {
    // The person reopens a note with what is still wrong (status open and a reply),
    // closes one (done), and agrees a fix (checked): closing their own note is both.
    const body = (await readBody(req)) as {
      status?: 'open' | 'done';
      checked?: boolean;
      reply?: string;
    };
    const id = noteMatch[1];
    let note =
      body.status === 'open'
        ? await reopenNote(root, id, body.reply)
        : body.status === 'done'
          ? await setNoteStatus(root, id, 'done')
          : undefined;
    if (body.checked) note = await checkNote(root, id);
    json(res, note ?? { error: 'nothing to change' }, note ? 200 : 400);
    return true;
  }
  if (noteMatch && method === 'DELETE') {
    await deleteNote(root, noteMatch[1]);
    json(res, { ok: true });
    return true;
  }
  return false;
}

/** The film or reel's review app: live frames, sheets, the mix, options and notes. */
async function projectRoute(
  item: Item,
  items: Item[],
  rel: string,
  url: URL,
  req: http.IncomingMessage,
  res: Res
): Promise<void> {
  const root = item.root;
  const method = req.method ?? 'GET';
  // The options the page is looking at (`tail:b,chase:a`), laid over the project.
  const opt = url.searchParams.get('opt') ?? '';
  const over = () => choiceDirs(root, parsePicks(opt));
  const load = () => loadProject(root, over());
  if (rel === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
    return;
  }
  if (rel === '/api/version') {
    json(res, { version: await projectVersion(root) });
    return;
  }
  if (rel === '/movie.mp4') {
    const file = path.join(projectPaths(root).out, 'movie.mp4');
    if (!existsSync(file)) throw new Error('no rendered movie');
    await serveFile(file, 'video/mp4', req, res);
    return;
  }
  if (rel === '/api/stem') {
    const bus = url.searchParams.get('bus') as Bus;
    if (!STEMS.includes(bus)) throw new Error('unknown bus');
    await serveFile(await makeStem(root, await load(), bus), 'audio/mp4', req, res);
    return;
  }
  if (rel === '/api/mix' && method === 'POST') {
    // Layers at 1 are left out: a project at the engine's levels has no `mix` at all.
    const asked = MixSchema.parse(((await readBody(req)) as { mix: unknown }).mix);
    const mix = Object.fromEntries(Object.entries(asked).filter(([, v]) => v !== 1));
    const project = await loadProject(root);
    await saveMeta(root, { ...project.meta, mix: Object.keys(mix).length ? mix : undefined });
    json(res, { ok: true });
    return;
  }
  if (rel === '/api/remix' && method === 'POST') {
    const file = path.join(projectPaths(root).out, 'movie.mp4');
    if (!existsSync(file)) throw new Error('no rendered movie');
    const project = await loadProject(root);
    const r = await remixVideo(project, file);
    // The .mkv carries the same sound, and more of it: it is built again from the mp4.
    if (!isPortrait(project.meta)) await writeMkv(project, file, file.replace(/\.mp4$/, '.mkv'));
    json(res, r);
    return;
  }
  const projectNote = (t: NoteTarget) => {
    if (t.kind === 'file') throw new Error('a file note is for a board');
  };
  if (await noteRoute(root, rel, method, req, res, projectNote)) return;
  if (rel === '/api/project') {
    // A half-written file from the agent must not take the page down: report, keep polling.
    let project, base;
    let optError = '';
    try {
      base = await loadProject(root);
    } catch (e) {
      json(res, { error: (e as Error).message });
      return;
    }
    try {
      project = opt ? await load() : base;
    } catch (e) {
      // A choice that does not load says why, over the film as it is, and can be let go of.
      project = base;
      optError = `options: ${(e as Error).message}\n`;
    }
    json(res, {
      title: project.meta.title,
      fps: project.meta.fps,
      width: project.meta.width,
      height: project.meta.height,
      duration: movieDuration(project),
      shots: project.shots.map((s) => ({ id: s.id, duration: s.duration, scene: s.scene })),
      characters: Object.values(project.characters).map((c) => ({
        id: c.id,
        name: c.name,
        rig: c.rig,
        height: c.height,
      })),
      scenes: Object.values(project.scenes).map((s) => ({
        id: s.id,
        name: s.name,
        anchors: Object.keys(s.anchors),
      })),
      lines: linesOf(project),
      safe: safeInsets(project.meta),
      apps: switcher(items, item),
      options: (await listOptions(root, base)).map(({ choices, ...q }) => ({
        ...q,
        choices: choices.map(({ dir: _dir, ...c }) => c),
      })),
      problems: optError + problemsOf(root, project, opt),
      notes: await loadNotes(root),
      movie: await movieInfo(root),
      mix: project.meta.mix ?? {},
      stems: (({ key, buses }) => ({ key, buses }))(stemsOf(project) ?? { key: '', buses: [] }),
      version: await projectVersion(root),
    });
    return;
  }
  if (rel === '/api/frame') {
    const svg = await drawSvg({
      kind: 'frame',
      root,
      over: over(),
      shot: url.searchParams.get('shot') ?? '',
      t: Number(url.searchParams.get('t') ?? 0),
      debug: url.searchParams.has('debug'),
    });
    res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
    return;
  }
  if (rel === '/api/sheet') {
    const svg = await drawSvg({
      kind: 'sheet',
      root,
      over: over(),
      id: url.searchParams.get('id') ?? '',
      construction: url.searchParams.get('kind') === 'construction',
    });
    res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
    return;
  }
  res.writeHead(404).end('not found');
}

/* ---- boards: a folder of samples to listen to, watch and pick from ---- */

const MEDIA: Record<string, { kind: 'audio' | 'video' | 'image'; type: string }> = {
  '.wav': { kind: 'audio', type: 'audio/wav' },
  '.mp3': { kind: 'audio', type: 'audio/mpeg' },
  '.m4a': { kind: 'audio', type: 'audio/mp4' },
  '.aac': { kind: 'audio', type: 'audio/aac' },
  '.ogg': { kind: 'audio', type: 'audio/ogg' },
  '.opus': { kind: 'audio', type: 'audio/ogg' },
  '.flac': { kind: 'audio', type: 'audio/flac' },
  '.mp4': { kind: 'video', type: 'video/mp4' },
  '.webm': { kind: 'video', type: 'video/webm' },
  '.mov': { kind: 'video', type: 'video/quicktime' },
  '.png': { kind: 'image', type: 'image/png' },
  '.jpg': { kind: 'image', type: 'image/jpeg' },
  '.jpeg': { kind: 'image', type: 'image/jpeg' },
  '.gif': { kind: 'image', type: 'image/gif' },
  '.webp': { kind: 'image', type: 'image/webp' },
  '.svg': { kind: 'image', type: 'image/svg+xml' },
};
const BOARD_FILE = 'board.json';

/** `board.json`, all optional: a title, what to decide, and a line on any file or folder. */
const BoardFileSchema = z.object({
  title: z.string().optional(),
  ask: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

interface BoardEntry {
  path: string;
  name: string;
  kind: 'audio' | 'video' | 'image' | 'project';
  label?: string;
  /** A sample project's own review page, and its rendered video if it has one. */
  slug?: string;
  movie?: boolean;
  mtime: number;
}
interface BoardGroup {
  dir: string;
  label?: string;
  entries: BoardEntry[];
}

/**
 * The board's samples by folder, three deep: every sound, video and picture, and every
 * folder that is a talekit project (a sample animation), which gets its own review page.
 * Each folder with something in it is a group to pick one from.
 */
async function scanBoard(root: string): Promise<{ groups: BoardGroup[]; projects: string[] }> {
  const groups: BoardGroup[] = [];
  const projects: string[] = [];
  const walk = async (rel: string, depth: number) => {
    const dir = path.join(root, rel);
    const group: BoardGroup = { dir: rel, entries: [] };
    const subs: string[] = [];
    for (const d of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )) {
      if (d.name.startsWith('.') || d.name.startsWith('_')) continue;
      const p = rel ? `${rel}/${d.name}` : d.name;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (isProject(full)) {
          projects.push(full);
          group.entries.push({
            path: p,
            name: d.name,
            kind: 'project',
            movie: existsSync(path.join(full, 'out', 'movie.mp4')),
            mtime: Math.round((await stat(full)).mtimeMs),
          });
        } else if (depth < 3) subs.push(p);
        continue;
      }
      const media = MEDIA[path.extname(d.name).toLowerCase()];
      if (media)
        group.entries.push({
          path: p,
          name: d.name,
          kind: media.kind,
          mtime: Math.round((await stat(full)).mtimeMs),
        });
    }
    if (group.entries.length) groups.push(group);
    for (const sub of subs) await walk(sub, depth + 1);
  };
  await walk('', 0);
  return { groups, projects };
}

async function boardVersion(root: string): Promise<number> {
  let latest = 0;
  for (const f of [NOTES_FILE, BOARD_FILE, '.'])
    if (existsSync(path.join(root, f)))
      latest = Math.max(latest, (await stat(path.join(root, f))).mtimeMs);
  const { groups } = await scanBoard(root);
  for (const g of groups) for (const e of g.entries) latest = Math.max(latest, e.mtime);
  // A sample project's frames are drawn by the engine as it now is.
  latest = Math.max(latest, await codeVersion());
  return Math.round(latest);
}

/** A board path from the page, kept inside the board. */
function boardFile(root: string, rel: string): string {
  const file = path.resolve(root, rel);
  if (path.relative(root, file).startsWith('..') || path.isAbsolute(path.relative(root, file)))
    throw new Error('outside the board');
  return file;
}

async function boardRoute(
  item: Item,
  items: Item[],
  add: (root: string, board?: string) => Item,
  rel: string,
  url: URL,
  req: http.IncomingMessage,
  res: Res
): Promise<void> {
  const root = item.root;
  const method = req.method ?? 'GET';
  if (rel === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(BOARD);
    return;
  }
  if (rel === '/api/version') {
    json(res, { version: await boardVersion(root) });
    return;
  }
  if (rel === '/file') {
    const file = boardFile(root, url.searchParams.get('path') ?? '');
    const media = MEDIA[path.extname(file).toLowerCase()];
    if (!media || !existsSync(file)) throw new Error('no such sample');
    await serveFile(file, media.type, req, res);
    return;
  }
  // A board's notes are on its files and folders, and only those that are there.
  const boardNote = (t: NoteTarget) => {
    if (t.kind !== 'file' || !existsSync(boardFile(root, t.id)))
      throw new Error(`no '${t.id}' on this board`);
  };
  if (await noteRoute(root, rel, method, req, res, boardNote)) return;
  if (rel === '/api/board') {
    const file = path.join(root, BOARD_FILE);
    const about = existsSync(file)
      ? BoardFileSchema.parse(JSON.parse(await readFile(file, 'utf8')))
      : {};
    item.title = about.title ?? path.basename(root);
    const { groups, projects } = await scanBoard(root);
    // A sample animation is a project: served beside the board, under its own page.
    const slugs = new Map(projects.map((p) => [p, add(p, item.slug).slug]));
    for (const g of groups) {
      g.label = about.labels?.[g.dir || '.'];
      for (const e of g.entries) {
        e.label = about.labels?.[e.path];
        if (e.kind === 'project') e.slug = slugs.get(path.join(root, e.path));
      }
    }
    json(res, {
      title: about.title ?? item.title,
      ask: about.ask,
      groups,
      apps: switcher(items, item),
      notes: await loadNotes(root),
      version: await boardVersion(root),
    });
    return;
  }
  res.writeHead(404).end('not found');
}

/** The header's switch: every film, reel and board served, this one marked. */
function switcher(items: Item[], here: Item) {
  return items
    .filter((i) => !i.board)
    .map((i) => ({
      slug: i.slug,
      title: i.title,
      kind: i.kind,
      portrait: i.portrait,
      here: i === here || here.board === i.slug,
    }));
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** `/` with more than one thing served: a list of them. */
function indexPage(items: Item[]): string {
  const rows = items
    .filter((i) => !i.board)
    .map(
      (i) =>
        `<li><a href='/${i.slug}/'>${escHtml(i.title)}</a> <span>${i.kind === 'board' ? 'samples' : i.portrait ? 'reel' : 'film'} · ${escHtml(i.root)}</span></li>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset='utf-8'><title>talekit review</title><meta name='viewport' content='width=device-width, initial-scale=1'><link rel='icon' href='data:,'><style>body{margin:0;padding:24px;font:15px system-ui,sans-serif;background:#1b1f24;color:#ddd}a{color:#ffd166;font-size:17px}li{margin:10px 0}span{color:#9aa3ad;font-size:12px;margin-left:8px}ul{list-style:none;padding:0}</style></head><body><strong>talekit review</strong><ul>${rows}</ul></body></html>`;
}

export interface Review {
  /** The server's own address; each item is at `<url><slug>/`. */
  url: string;
  lan: boolean;
  /** Serve one more film, reel or board, and resolve to its page. */
  add: (root: string) => Promise<string>;
  roots: () => string[];
  close: () => void;
}

/**
 * The review server: every film, reel and sample board in one place, each under its own
 * path (`/lost-kite/`), so the film and its reel, and whatever samples are waiting, are
 * one tab apart. A project gets the review app: live frames of every shot, the assets as
 * pose and anchor sheets, the options to pick from, and notes a person leaves on any of
 * them for the agent to pick up with `list_notes`; a board, each sample with a player.
 * Everything is read again on every request, so edits show up at once. A port already
 * taken (often an earlier review server) moves it to the next free one. With `lan` it
 * listens on every interface, at this machine's network address, for a phone on the same
 * Wi-Fi.
 */
export async function startReview(port: number, opts: { lan?: boolean } = {}): Promise<Review> {
  const items: Item[] = [];
  const slugOf = (root: string) => {
    const base =
      path
        .basename(root)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project';
    let slug = base;
    for (let n = 2; items.some((i) => i.slug === slug) || slug === 'api'; n++)
      slug = `${base}-${n}`;
    return slug;
  };
  /** Serve a project found on a board (no check: the board saw its talekit.json). */
  const addFound = (root: string, board?: string): Item => {
    const known = items.find((i) => i.root === root);
    if (known) return known;
    const item: Item = {
      slug: slugOf(root),
      root,
      kind: 'project',
      title: path.basename(root),
      portrait: false,
      board,
    };
    items.push(item);
    return item;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      const m = /^\/([^/]+)(\/.*)?$/.exec(url.pathname);
      if (!m) {
        const shown = items.filter((i) => !i.board);
        if (shown.length === 1) res.writeHead(302, { location: `/${shown[0].slug}/` }).end();
        else
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(indexPage(items));
        return;
      }
      const item = items.find((i) => i.slug === decodeURIComponent(m[1]));
      if (!item) {
        res.writeHead(404).end('not served here');
        return;
      }
      // The page's own links are relative, so it needs the slash.
      if (!m[2]) {
        res.writeHead(301, { location: `/${item.slug}/${url.search}` }).end();
        return;
      }
      if (item.kind === 'board') await boardRoute(item, items, addFound, m[2], url, req, res);
      else await projectRoute(item, items, m[2], url, req, res);
    } catch (e) {
      if (url.pathname.includes('/api/')) json(res, { error: (e as Error).message }, 500);
      else res.writeHead(500, { 'content-type': 'text/plain' }).end((e as Error).message);
    }
  });

  // On the local network only when asked: the app has no login, and it writes files.
  const host = opts.lan ? lanAddress() : '127.0.0.1';
  for (let p = port; ; p++) {
    const err = await new Promise<NodeJS.ErrnoException | undefined>((resolve) => {
      server.once('error', resolve);
      server.listen(p, opts.lan ? '0.0.0.0' : '127.0.0.1', () => resolve(undefined));
    });
    if (!err) {
      const url = `http://${host}:${p}/`;
      return {
        url,
        lan: !!opts.lan,
        roots: () => items.filter((i) => !i.board).map((i) => i.root),
        add: async (dir: string) => {
          const root = path.resolve(dir);
          let item = items.find((i) => i.root === root);
          if (item?.board) item.board = undefined; // asked for by name: in the switch too
          if (!item) {
            if (!existsSync(root)) throw new Error(`${root} does not exist`);
            // A project fails fast if it does not load; any other folder is a board.
            const project = isProject(root) ? await loadProject(root) : undefined;
            item = {
              slug: slugOf(root),
              root,
              kind: project ? 'project' : 'board',
              title: project?.meta.title ?? path.basename(root),
              portrait: project ? isPortrait(project.meta) : false,
            };
            items.push(item);
          }
          return `${url}${item.slug}/`;
        },
        close: () => server.close(),
      };
    }
    if (err.code !== 'EADDRINUSE' || p >= port + 20) throw err;
  }
}

/**
 * Serve these folders (a film, its reel, a board of samples) from one review server.
 * Resolves to the first one's page, every page, and the server.
 */
export async function serve(
  roots: string | string[],
  port: number,
  opts: { lan?: boolean } = {}
): Promise<{ url: string; urls: string[]; review: Review; close: () => void }> {
  const review = await startReview(port, opts);
  try {
    const urls: string[] = [];
    for (const root of Array.isArray(roots) ? roots : [roots]) urls.push(await review.add(root));
    return { url: urls[0], urls, review, close: review.close };
  } catch (e) {
    review.close();
    throw e;
  }
}
