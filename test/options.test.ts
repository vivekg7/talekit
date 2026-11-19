import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIBRARY } from '../src/library/index.js';
import { choiceDirs, listOptions } from '../src/project/options.js';
import { createProject, loadProject, saveCharacter, saveScene } from '../src/project/store.js';

const shot = (id: string, extra: object = {}) => ({
  id,
  scene: 'park',
  duration: 2,
  cast: { kid: { at: 'center' } },
  ...extra,
});

/** Write `files` ({ 'options/q/c/shots/x.json': data }) into the project, as JSON or bytes. */
async function put(root: string, files: Record<string, unknown>) {
  for (const [file, data] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data));
  }
}

describe('options', () => {
  let root: string;
  const red = () => path.join(root, 'options/look/red');
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'talekit-options-'));
    await createProject(root, { title: 'As it is' });
    await saveCharacter(root, LIBRARY.characters.kid);
    await saveScene(root, LIBRARY.scenes.park);
    const kid = LIBRARY.characters.kid;
    await put(root, {
      'shots/01-a.json': shot('a'),
      'shots/02-b.json': shot('b', { cast: {} }),
      'audio/tune.wav': 'RIFF',
      'options/look/question.json': { ask: 'Which dress?', choices: { red: 'stands out' } },
      'options/look/red/characters/kid.json': {
        ...kid,
        colors: { ...kid.colors, dress: '#d62828' },
      },
      'options/look/red/shots/01b-extra.json': shot('extra'),
      'options/look/red/talekit.json': { title: 'In red' },
      'options/look/red/audio/tune.wav': 'RIFF',
      'options/_draft/x/shots/c.json': shot('c'),
    });
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('lays a choice over the project: same id replaces, a new shot plays in its name’s place', async () => {
    const plain = await loadProject(root);
    const p = await loadProject(root, [red()]);
    expect(p.characters.kid.colors.dress).toBe('#d62828');
    expect(p.shots.map((s) => s.id)).toEqual(['a', 'extra', 'b']);
    expect(p.meta.title).toBe('In red');
    expect(p.audio!.files.tune).toBe(path.join(red(), 'audio/tune.wav'));
    // The project on disk is as it was.
    expect(plain.characters.kid.colors.dress).toBe(LIBRARY.characters.kid.colors.dress);
    expect(plain.shots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(JSON.parse(await readFile(path.join(root, 'talekit.json'), 'utf8')).title).toBe(
      'As it is'
    );
  });

  it('lists each question with what its choices change and the shots that show it', async () => {
    const [look, ...rest] = await listOptions(root, await loadProject(root));
    expect(rest).toEqual([]);
    expect(look).toMatchObject({ id: 'look', ask: 'Which dress?' });
    expect(look.choices).toEqual([
      expect.objectContaining({
        id: 'red',
        label: 'stands out',
        characters: ['kid'],
        shots: ['extra'],
        meta: true,
        audio: true,
      }),
    ]);
    expect(look.touches).toEqual(['a', 'b', 'extra']);
  });

  it('opens only choices still there, never a path out of options/', () => {
    expect(choiceDirs(root, { look: 'red', gone: 'x', '..': 'look', look2: '../../x' })).toEqual([
      red(),
    ]);
  });

  it('names the choice a broken file is in', async () => {
    const bad = path.join(root, 'options/look/bad');
    await put(root, { 'options/look/bad/shots/a.json': { id: 'a', scene: 'park', duration: -1 } });
    await expect(loadProject(root, [bad])).rejects.toThrow(/options\/look\/bad\/shots\/a\.json/);
    await rm(bad, { recursive: true });
  });
});
