import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { projectPaths } from './store.js';

/**
 * Review notes: what a person marked as wrong in the review app, for the agent to act on.
 * A note points at a character, a scene, or one moment of a shot. They live in
 * `<project>/notes.json` so the viewer (which writes them) and the MCP server (which reads
 * and resolves them) share nothing but the directory.
 */
export const NOTES_FILE = 'notes.json';

export const NoteTargetSchema = z.object({
  kind: z.enum(['character', 'scene', 'shot']),
  id: z.string().min(1),
  /** Seconds into the shot; only for shot notes. */
  t: z.number().min(0).optional(),
});

export const NoteSchema = z.object({
  id: z.string().min(1),
  target: NoteTargetSchema,
  text: z.string().min(1),
  status: z.enum(['open', 'done']).default('open'),
  created: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;
export type NoteTarget = z.infer<typeof NoteTargetSchema>;

export function notesPath(root: string): string {
  return path.join(projectPaths(root).root, NOTES_FILE);
}

export async function loadNotes(root: string): Promise<Note[]> {
  const file = notesPath(root);
  if (!existsSync(file)) return [];
  const data: unknown = JSON.parse(await readFile(file, 'utf8'));
  const r = z.array(NoteSchema).safeParse(data);
  if (!r.success) throw new Error(`${file}: ${r.error.issues.map((i) => i.message).join('; ')}`);
  return r.data;
}

export async function saveNotes(root: string, notes: Note[]): Promise<void> {
  await writeFile(notesPath(root), JSON.stringify(notes, null, 2) + '\n');
}

/** Ids are `n1`, `n2`, … so a person can say "fix n3" and the agent can resolve it by name. */
function nextId(notes: Note[]): string {
  const max = notes.reduce((m, n) => Math.max(m, Number(n.id.replace(/^n/, '')) || 0), 0);
  return `n${max + 1}`;
}

export async function addNote(root: string, target: NoteTarget, text: string): Promise<Note> {
  const notes = await loadNotes(root);
  const note: Note = {
    id: nextId(notes),
    target: NoteTargetSchema.parse(target),
    text: text.trim(),
    status: 'open',
    created: new Date().toISOString(),
  };
  if (!note.text) throw new Error('note text is empty');
  notes.push(note);
  await saveNotes(root, notes);
  return note;
}

export async function setNoteStatus(
  root: string,
  id: string,
  status: Note['status']
): Promise<Note> {
  const notes = await loadNotes(root);
  const note = notes.find((n) => n.id === id);
  if (!note) throw new Error(`no note '${id}'`);
  note.status = status;
  await saveNotes(root, notes);
  return note;
}

export async function deleteNote(root: string, id: string): Promise<void> {
  const notes = await loadNotes(root);
  if (!notes.some((n) => n.id === id)) throw new Error(`no note '${id}'`);
  await saveNotes(
    root,
    notes.filter((n) => n.id !== id)
  );
}

/** One line per note, the way the agent sees it: `n3 · shot well @ 9.20s · the lion ...`. */
export function describeNote(n: Note): string {
  const where =
    n.target.kind === 'shot' && n.target.t !== undefined
      ? `shot ${n.target.id} @ ${n.target.t.toFixed(2)}s`
      : `${n.target.kind} ${n.target.id}`;
  return `${n.id} · ${where} · ${n.text}${n.status === 'done' ? ' (done)' : ''}`;
}
