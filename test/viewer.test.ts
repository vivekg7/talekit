import { cp, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadNotes, NOTES_FILE } from '../src/project/notes.js';
import { serve } from '../src/viewer/server.js';

describe('review app', () => {
  it('moves to the next port when one is taken and serves the project there', async () => {
    const taken = net.createServer();
    await new Promise<void>((r) => taken.listen(0, '127.0.0.1', r));
    const port = (taken.address() as net.AddressInfo).port;
    const app = await serve('examples/lost-kite', port);
    try {
      expect(new URL(app.url).port).not.toBe(String(port));
      const res = await fetch(new URL('api/project', app.url));
      expect(res.status).toBe(200);
    } finally {
      app.close();
      taken.close();
    }
  });

  it('lists the lines, the other apps and the safe area, and checks and reopens notes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'talekit-viewer-'));
    await cp('examples/lost-kite', root, { recursive: true });
    await rm(path.join(root, NOTES_FILE), { force: true });
    // The film and the other one on one port, each under its own path.
    const app = await serve([root, 'examples/lighthouse'], 4860);
    expect(app.urls.map((u) => new URL(u).port)).toEqual([
      new URL(app.url).port,
      new URL(app.url).port,
    ]);
    expect(new URL(app.urls[1]).pathname).toBe('/lighthouse/');
    const call = (url: string, method = 'GET', body?: unknown) =>
      fetch(new URL(url, app.url), {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then((r) => r.json());
    try {
      const info = await call('api/project');
      expect(info.apps.map((x: { here: boolean }) => x.here)).toEqual([true, false]);
      expect(info.apps[1].slug).toBe('lighthouse');
      expect(info.safe).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
      const line = info.lines[0];
      expect(line.end).toBeGreaterThan(line.t);
      expect(line.who && line.text).toBeTruthy();

      const n = await call('api/notes', 'POST', {
        target: { kind: 'shot', id: info.shots[0].id, t: 1, at: { x: 100, y: 200 } },
        text: 'here',
      });
      expect(n.target.at).toEqual({ x: 100, y: 200 });
      expect((await call(`api/notes/${n.id}`, 'PATCH', { status: 'done' })).toCheck).toBe(true);
      const back = await call(`api/notes/${n.id}`, 'PATCH', { status: 'open', reply: 'not yet' });
      expect(back.replies[0].text).toBe('not yet');
      // The person closing their own note leaves nothing to check.
      const closed = await call(`api/notes/${n.id}`, 'PATCH', { status: 'done', checked: true });
      expect([closed.status, closed.toCheck]).toEqual(['done', undefined]);
    } finally {
      app.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('lays a choice of an option over the film, and keeps only the last pick', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'talekit-options-'));
    await cp('examples/lost-kite', root, { recursive: true });
    await rm(path.join(root, NOTES_FILE), { force: true });
    const mia = JSON.parse(await readFile(path.join(root, 'characters/mia.json'), 'utf8'));
    mia.colors.dress = '#d62828';
    await mkdir(path.join(root, 'options/dress/red/characters'), { recursive: true });
    await writeFile(path.join(root, 'options/dress/red/characters/mia.json'), JSON.stringify(mia));
    await writeFile(
      path.join(root, 'options/dress/question.json'),
      JSON.stringify({ ask: 'Which dress?', choices: { red: 'stands out' } })
    );
    const shot = JSON.parse(await readFile(path.join(root, 'shots/03-flying.json'), 'utf8'));
    await mkdir(path.join(root, 'options/take/long/shots'), { recursive: true });
    await writeFile(
      path.join(root, 'options/take/long/shots/x.json'),
      JSON.stringify({ ...shot, duration: shot.duration + 5 })
    );
    const app = await serve(root, 4880);
    const get = (url: string) => fetch(new URL(url, app.url));
    const post = (url: string, body: unknown) =>
      fetch(new URL(url, app.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    try {
      const info = await (await get('api/project')).json();
      const dress = info.options.find((q: { id: string }) => q.id === 'dress');
      expect(dress.ask).toBe('Which dress?');
      expect(dress.choices).toEqual([
        expect.objectContaining({ id: 'red', label: 'stands out', characters: ['mia'] }),
      ]);
      // Mia is in every shot, so the dress shows in all of them; the take in its own.
      expect(dress.touches).toHaveLength(info.shots.length);
      expect(info.options.find((q: { id: string }) => q.id === 'take').touches).toEqual(['flying']);
      // The take replaces its shot in place, whatever its file is called.
      const long = await (await get('api/project?opt=take:long')).json();
      expect(long.shots.map((s: { id: string }) => s.id)).toEqual(
        info.shots.map((s: { id: string }) => s.id)
      );
      expect(long.duration).toBeCloseTo(info.duration + 5);
      const sheet = (q: string) => get(`api/sheet?id=mia${q}`).then((r) => r.text());
      expect(await sheet('&opt=dress:red')).toContain('#d62828');
      expect(await sheet('')).not.toContain('#d62828');
      // A choice that is gone (the agent wrote the pick in) is the film as it is.
      expect((await (await get('api/project?opt=dress:blue')).json()).duration).toBe(info.duration);

      await post('api/pick', { target: { kind: 'option', id: 'dress', choice: 'red' } });
      const last = await post('api/pick', {
        target: { kind: 'option', id: 'dress' },
        text: 'keep it',
      });
      const notes = await loadNotes(root);
      expect(notes.map((n) => n.id)).toEqual([last.id]);
      expect(last.id).toBe('n2');
      expect(
        (await post('api/notes', { target: { kind: 'file', id: 'a.wav' }, text: 'x' })).error
      ).toMatch(/board/);
    } finally {
      app.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serves a board of samples beside the film, and its sample projects', async () => {
    const board = await mkdtemp(path.join(os.tmpdir(), 'talekit-board-'));
    await mkdir(path.join(board, 'tunes'));
    await cp('sounds/music/calm.ogg', path.join(board, 'tunes/a.ogg'));
    await cp('sounds/music/chase.ogg', path.join(board, 'tunes/b.ogg'));
    await cp('examples/lighthouse', path.join(board, 'walk'), { recursive: true });
    await writeFile(
      path.join(board, 'board.json'),
      JSON.stringify({ title: 'Music', labels: { tunes: 'Which tune?' } })
    );
    const app = await serve(['examples/lost-kite', board], 4890);
    const at = app.urls[1];
    const get = (url: string) => fetch(new URL(url, at));
    const post = (url: string, body: unknown) =>
      fetch(new URL(url, at), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    try {
      expect(await (await get('')).text()).toContain('talekit samples');
      const info = await (await get('api/board')).json();
      expect(info.title).toBe('Music');
      const tunes = info.groups.find((g: { dir: string }) => g.dir === 'tunes');
      expect(tunes.label).toBe('Which tune?');
      expect(tunes.entries.map((e: { path: string }) => e.path)).toEqual([
        'tunes/a.ogg',
        'tunes/b.ogg',
      ]);
      const walk = info.groups[0].entries.find((e: { kind: string }) => e.kind === 'project');
      // The sample project has its own review page on the same server.
      const sample = await fetch(new URL(`/${walk.slug}/api/project`, app.url)).then((r) =>
        r.json()
      );
      expect(sample.shots.length).toBeGreaterThan(0);
      const file = await get('file?path=tunes/a.ogg');
      expect(file.headers.get('content-type')).toBe('audio/ogg');
      expect((await get('file?path=../board.json')).status).toBe(500);
      await post('api/pick', { target: { kind: 'file', id: 'tunes/a.ogg' } });
      const b = await post('api/pick', {
        target: { kind: 'file', id: 'tunes/b.ogg' },
        text: 'livelier',
      });
      expect((await loadNotes(board)).map((n) => n.id)).toEqual([b.id]);
      expect((await post('api/pick', { target: { kind: 'file', id: '../x' } })).error).toBeTruthy();
      // The index lists the film and the board, not the board's sample.
      const index = await fetch(app.url.replace(/[^/]+\/$/, '')).then((r) => r.text());
      expect(index).toContain('Music');
      expect(index).not.toContain(`/${walk.slug}/`);
    } finally {
      app.close();
      await rm(board, { recursive: true, force: true });
    }
  });

  it('sends an old address to what is served now, and checks the film apart from it', async () => {
    const app = await serve('examples/lost-kite', 4900);
    const base = app.url.replace(/[^/]+\/$/, '');
    const page = (url: string) =>
      fetch(new URL(url, base), { headers: { accept: 'text/html' }, redirect: 'manual' });
    try {
      // A reel reviewed before, refreshed after the server moved on.
      expect((await page('/gone-reel/')).headers.get('location')).toBe('/');
      // Its page, still open, is told so by its poll and goes too.
      const poll = await fetch(new URL('/gone-reel/api/version', base));
      expect([poll.status, (await poll.json()).gone]).toEqual([404, true]);
      expect((await page('/lost-kite/nowhere')).headers.get('location')).toBe('/lost-kite/');
      expect((await fetch(new URL('nowhere.svg', app.url))).status).toBe(404);

      const info = await (await fetch(new URL('api/project', app.url))).json();
      expect(info.problems).toBeUndefined();
      const { problems } = await (await fetch(new URL('api/problems', app.url))).json();
      expect(typeof problems).toBe('string');
      const sound = await (await fetch(new URL('api/sound', app.url))).json();
      expect(sound.key).toMatch(/^[0-9a-f]{16}$/);
      expect(sound.buses.length).toBeGreaterThan(0);

      // A picture of a version is kept by the browser; one asked for while playing is not.
      const shot = info.shots[0].id;
      const kept = await fetch(new URL(`api/frame?shot=${shot}&t=1&v=${info.version}`, app.url));
      expect(kept.headers.get('cache-control')).toContain('immutable');
      const once = await fetch(new URL(`api/frame?shot=${shot}&t=1`, app.url));
      expect(once.headers.get('cache-control')).toBe('no-store');
      expect(await once.text()).toBe(await kept.text());
    } finally {
      app.close();
    }
  });

  it('draws pictures with the engine as it is now, and reloads the page when it changes', async () => {
    const app = await serve('examples/lost-kite', 4870);
    const get = (url: string) => fetch(new URL(url, app.url));
    const file = 'src/engine/compose.ts';
    const was = await stat(file);
    try {
      const frame = await get('api/frame?shot=flying&t=1');
      expect(frame.headers.get('content-type')).toBe('image/svg+xml');
      expect(await frame.text()).toContain('<g');
      expect((await get('api/sheet?id=mia')).status).toBe(200);
      expect((await (await get('api/frame?shot=nope&t=1')).json()).error).toBe('unknown shot');
      const before = (await (await get('api/version')).json()).version;
      // An edit to the engine: the version moves (once its second's cache is out) and the
      // next picture comes from a fresh worker.
      const now = new Date(Math.max(Date.now(), before + 1000));
      await utimes(file, now, now);
      await new Promise((r) => setTimeout(r, 1100));
      expect((await (await get('api/version')).json()).version).toBeGreaterThan(before);
      expect(await (await get('api/frame?shot=flying&t=1')).text()).toContain('<g');
    } finally {
      await utimes(file, was.atime, was.mtime);
      app.close();
    }
  });
});
