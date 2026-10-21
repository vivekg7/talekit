import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addNote,
  deleteNote,
  describeNote,
  loadNotes,
  notesPath,
  setNoteStatus,
} from '../src/project/notes.js';
import { createProject } from '../src/project/store.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'talekit-notes-'));
  await createProject(root, { title: 't' });
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('review notes', () => {
  it('starts empty and numbers notes in order', async () => {
    expect(await loadNotes(root)).toEqual([]);
    const a = await addNote(
      root,
      { kind: 'shot', id: 'well', t: 9.2 },
      'the lion never looks down'
    );
    const b = await addNote(root, { kind: 'character', id: 'lion' }, '  mane too dark  ');
    expect(a.id).toBe('n1');
    expect(b.id).toBe('n2');
    expect(b.text).toBe('mane too dark');
    expect(a.status).toBe('open');
    const stored = JSON.parse(await readFile(notesPath(root), 'utf8'));
    expect(stored).toHaveLength(2);
  });

  it('numbers the next note from the highest id that still exists', async () => {
    await addNote(root, { kind: 'scene', id: 'well' }, 'a');
    const b = await addNote(root, { kind: 'scene', id: 'well' }, 'b');
    await deleteNote(root, b.id);
    const c = await addNote(root, { kind: 'scene', id: 'well' }, 'c');
    // n2 was deleted, so the next id is n2 again: an id only has to be unique among the
    // notes that exist at the same time, and short ids are what a person will type.
    expect(c.id).toBe('n2');
    expect((await loadNotes(root)).map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('resolves and reopens', async () => {
    const a = await addNote(root, { kind: 'shot', id: 'well', t: 1 }, 'x');
    expect((await setNoteStatus(root, a.id, 'done')).status).toBe('done');
    expect((await setNoteStatus(root, a.id, 'open')).status).toBe('open');
    await expect(setNoteStatus(root, 'n99', 'done')).rejects.toThrow("no note 'n99'");
  });

  it('rejects empty text and bad targets', async () => {
    await expect(addNote(root, { kind: 'shot', id: 'well' }, '   ')).rejects.toThrow('empty');
    await expect(addNote(root, { kind: 'prop' as 'shot', id: 'x' }, 'text')).rejects.toThrow();
  });

  it('describes a note the way the agent reads it', async () => {
    const a = await addNote(root, { kind: 'shot', id: 'well', t: 9.2 }, 'lion never looks down');
    expect(describeNote(a)).toBe('n1 · shot well @ 9.20s · lion never looks down');
    const b = await addNote(root, { kind: 'character', id: 'lion' }, 'mane');
    expect(describeNote({ ...b, status: 'done' })).toBe('n2 · character lion · mane (done)');
  });
});
