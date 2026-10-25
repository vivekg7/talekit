import net from 'node:net';
import { describe, expect, it } from 'vitest';
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
});
