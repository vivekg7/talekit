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
  /**
   * The spot the person clicked on the frame, in frame pixels (what preview_frame shows,
   * camera and all); only for shot notes.
   */
  at: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const NoteSchema = z.object({
  id: z.string().min(1),
  target: NoteTargetSchema,
  text: z.string().min(1),
  status: z.enum(['open', 'done']).default('open'),
  created: z.string(),
  /**
   * Done, and waiting for the person to look at the fix: set when a note is resolved,
   * cleared when they agree or reopen it. Notes done before this existed have none, and
   * count as checked.
   */
  toCheck: z.boolean().optional(),
  /** What the person added on reopening a note the fix did not settle, oldest first. */
  replies: z.array(z.object({ text: z.string().min(1), created: z.string() })).optional(),
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
  if (status === 'done' && note.status !== 'done') note.toCheck = true;
  if (status === 'open') delete note.toCheck;
  note.status = status;
  await saveNotes(root, notes);
  return note;
}

/** The person agrees a done note is fixed. */
export async function checkNote(root: string, id: string): Promise<Note> {
  const notes = await loadNotes(root);
  const note = notes.find((n) => n.id === id);
  if (!note) throw new Error(`no note '${id}'`);
  if (note.status !== 'done') throw new Error(`note '${id}' is not done yet`);
  delete note.toCheck;
  await saveNotes(root, notes);
  return note;
}

/**
 * Open a note again, with what is still wrong: the same id keeps the history together, so
 * the agent reads the first ask and what its fix missed in one place.
 */
export async function reopenNote(root: string, id: string, reply?: string): Promise<Note> {
  const notes = await loadNotes(root);
  const note = notes.find((n) => n.id === id);
  if (!note) throw new Error(`no note '${id}'`);
  note.status = 'open';
  delete note.toCheck;
  const text = reply?.trim();
  if (text) note.replies = [...(note.replies ?? []), { text, created: new Date().toISOString() }];
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

/**
 * One line per note, the way the agent sees it: `n3 · shot well @ 9.20s · the lion ...`,
 * with the clicked spot and what the person added when reopening it.
 */
export function describeNote(n: Note): string {
  const { kind, id, t, at } = n.target;
  let where =
    kind === 'shot' && t !== undefined ? `shot ${id} @ ${t.toFixed(2)}s` : `${kind} ${id}`;
  if (at) where += `, at (${Math.round(at.x)}, ${Math.round(at.y)})`;
  const replies = (n.replies ?? []).map((r) => ` · reopened: ${r.text}`).join('');
  return `${n.id} · ${where} · ${n.text}${replies}${n.status === 'done' ? ' (done)' : ''}`;
}

interface Size {
  width: number;
  height: number;
}

/**
 * The frame with a ring round the spot a note points at, so the agent sees what was meant
 * the way the person did: drawn over the composed SVG, sized by the frame's short side.
 */
export function markSpot(svg: string, at: { x: number; y: number }, size: Size): string {
  const r = Math.min(size.width, size.height) * 0.045;
  const ring = (stroke: string, w: number) =>
    `<circle cx='${at.x}' cy='${at.y}' r='${r}' fill='none' stroke='${stroke}' stroke-width='${w}'/>`;
  return svg.replace(/<\/svg>\s*$/, ring('#fff', r * 0.32) + ring('#e0245e', r * 0.16) + '</svg>');
}
