import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/mcp/server.js';
import { createProject, loadProject } from '../src/project/store.js';
import { hasErrors, validateProject } from '../src/project/validate.js';

describe('copy_from_library', () => {
  let root: string;
  let client: Client;
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'talekit-mcp-'));
    await createProject(root, { title: 'Copy' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await buildServer().connect(a);
    client = new Client({ name: 'test', version: '0' });
    await client.connect(b);
  });
  afterAll(async () => {
    await client.close();
    await rm(root, { recursive: true, force: true });
  });
  const copy = (args: object) =>
    client.callTool({ name: 'copy_from_library', arguments: { path: root, ...args } }) as Promise<{
      content: { type: string; text?: string }[];
      isError?: boolean;
    }>;

  it('saves a scene with a world finding, as write_scene does, and the render stays blocked', async () => {
    const r = await copy({ libraryId: 'park', anchors: { kite: { x: 640, y: 100 } } });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toMatch(/world\.anchor.*'kite'/);
    expect(r.content.some((c) => c.type === 'image')).toBe(true);
    expect(existsSync(path.join(root, 'scenes/park.json'))).toBe(true);
    expect(hasErrors(validateProject(await loadProject(root)))).toBe(true);
  });

  it('still refuses a scene that is invalid', async () => {
    const r = await copy({ libraryId: 'park', asId: 'Bad Id' });
    expect(r.isError).toBe(true);
    expect(existsSync(path.join(root, 'scenes/Bad Id.json'))).toBe(false);
  });
});
