import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { composeFrame } from '../engine/compose.js';
import { movieDuration } from '../engine/timeline.js';
import { addNote, deleteNote, loadNotes, NOTES_FILE, setNoteStatus } from '../project/notes.js';
import { loadProject, projectPaths } from '../project/store.js';
import { formatProblems, validateProject } from '../project/validate.js';
import { characterSheetSvg, constructionSheetSvg, sceneSheetSvg } from '../render/sheets.js';
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

/** Serve the mp4 with Range support; without it the browser cannot seek the video. */
async function serveMovie(file: string, req: http.IncomingMessage, res: http.ServerResponse) {
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
    'content-type': 'video/mp4',
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
        await serveMovie(file, req, res);
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
