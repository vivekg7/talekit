import { cp, mkdtemp, rm, stat, utimes } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTES_FILE } from '../src/project/notes.js';
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
    const a = await serve(root, 4860);
    const b = await serve('examples/lighthouse', 4860);
    const call = (url: string, method = 'GET', body?: unknown) =>
      fetch(new URL(url, a.url), {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then((r) => r.json());
    try {
      const info = await call('api/project');
      expect(info.apps.map((x: { here: boolean }) => x.here)).toEqual([true, false]);
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
      a.close();
      b.close();
      await rm(root, { recursive: true, force: true });
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
