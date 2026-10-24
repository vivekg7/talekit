import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { composeFrame } from '../engine/compose.js';
import { cueSheet, type Bus } from '../engine/sound.js';
import { movieDuration } from '../engine/timeline.js';
import { MixSchema, type Project } from '../engine/types.js';
import { addNote, deleteNote, loadNotes, NOTES_FILE, setNoteStatus } from '../project/notes.js';
import { loadProject, projectPaths, saveMeta } from '../project/store.js';
import { formatProblems, validateProject } from '../project/validate.js';
import { mixAudio, RATE } from '../render/audio.js';
import { characterSheetSvg, constructionSheetSvg, sceneSheetSvg } from '../render/sheets.js';
import { remixVideo } from '../render/video.js';
import { PAGE } from './page.js';

/**
 * Newest mtime across everything that changes what the page shows. The page polls this and
 * reloads when it moves, so an agent writing through the MCP shows up within a second or two
 * without a file watcher (which would need a native dependency or a recursive fs.watch).
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
  for (const dir of [p.characters, p.scenes, p.shots]) {
    if (!existsSync(dir)) continue;
    await touch(dir);
    for (const f of await readdir(dir)) await touch(path.join(dir, f));
  }
  return Math.round(latest);
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

/**
 * The review app: live frames of every shot, the assets as pose and anchor sheets, and notes
 * a person leaves on any of them for the agent to pick up with `list_notes`. The project is
 * reloaded on every request so edits show up immediately.
 */
export async function serve(root: string, port: number): Promise<void> {
  await loadProject(root); // fail fast if the directory is not a project
  const json = (res: http.ServerResponse, body: unknown, status = 200) =>
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    try {
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
        return;
      }
      if (url.pathname === '/api/version') {
        json(res, { version: await projectVersion(root) });
        return;
      }
      if (url.pathname === '/movie.mp4') {
        const file = path.join(projectPaths(root).out, 'movie.mp4');
        if (!existsSync(file)) throw new Error('no rendered movie');
        await serveFile(file, 'video/mp4', req, res);
        return;
      }
      if (url.pathname === '/api/stem') {
        const bus = url.searchParams.get('bus') as Bus;
        if (!STEMS.includes(bus)) throw new Error('unknown bus');
        await serveFile(await makeStem(root, await loadProject(root), bus), 'audio/mp4', req, res);
        return;
      }
      if (url.pathname === '/api/mix' && method === 'POST') {
        // Layers at 1 are left out: a project at the engine's levels has no `mix` at all.
        const asked = MixSchema.parse(((await readBody(req)) as { mix: unknown }).mix);
        const mix = Object.fromEntries(Object.entries(asked).filter(([, v]) => v !== 1));
        const project = await loadProject(root);
        await saveMeta(root, {
          ...project.meta,
          mix: Object.keys(mix).length ? mix : undefined,
        });
        json(res, { ok: true });
        return;
      }
      if (url.pathname === '/api/remix' && method === 'POST') {
        const file = path.join(projectPaths(root).out, 'movie.mp4');
        if (!existsSync(file)) throw new Error('no rendered movie');
        json(res, await remixVideo(await loadProject(root), file));
        return;
      }
      if (url.pathname === '/api/notes' && method === 'POST') {
        const body = (await readBody(req)) as { target: unknown; text: string };
        json(res, await addNote(root, body.target as Parameters<typeof addNote>[1], body.text));
        return;
      }
      const noteMatch = /^\/api\/notes\/([^/]+)$/.exec(url.pathname);
      if (noteMatch && method === 'PATCH') {
        const body = (await readBody(req)) as { status: 'open' | 'done' };
        json(res, await setNoteStatus(root, noteMatch[1], body.status));
        return;
      }
      if (noteMatch && method === 'DELETE') {
        await deleteNote(root, noteMatch[1]);
        json(res, { ok: true });
        return;
      }
      if (url.pathname === '/api/project') {
        // A half-written file from the agent must not take the page down: report, keep polling.
        let project;
        try {
          project = await loadProject(root);
        } catch (e) {
          json(res, { error: (e as Error).message });
          return;
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
          problems: formatProblems(validateProject(project)),
          notes: await loadNotes(root),
          movie: await movieInfo(root),
          mix: project.meta.mix ?? {},
          stems: (({ key, buses }) => ({ key, buses }))(stemsOf(project) ?? { key: '', buses: [] }),
          version: await projectVersion(root),
        });
        return;
      }
      const project = await loadProject(root);
      if (url.pathname === '/api/frame') {
        const shot = project.shots.find((s) => s.id === url.searchParams.get('shot'));
        if (!shot) throw new Error('unknown shot');
        const t = Number(url.searchParams.get('t') ?? 0);
        const svg = composeFrame(project, shot, t, { debug: url.searchParams.has('debug') });
        res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
        return;
      }
      if (url.pathname === '/api/sheet') {
        const id = url.searchParams.get('id') ?? '';
        const svg = project.characters[id]
          ? url.searchParams.get('kind') === 'construction'
            ? constructionSheetSvg(project.characters[id])
            : characterSheetSvg(project.characters[id])
          : project.scenes[id]
            ? sceneSheetSvg(project, project.scenes[id])
            : undefined;
        if (!svg) throw new Error('unknown id');
        res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
        return;
      }
      res.writeHead(404).end('not found');
    } catch (e) {
      if (url.pathname.startsWith('/api/')) json(res, { error: (e as Error).message }, 500);
      else res.writeHead(500, { 'content-type': 'text/plain' }).end((e as Error).message);
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`talekit review: http://127.0.0.1:${port}/  (${root})`);
}
