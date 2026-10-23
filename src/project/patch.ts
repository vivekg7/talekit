import { actionDuration } from '../engine/timeline.js';
import { ActionSchema, ShotSchema, type Action, type Shot } from '../engine/types.js';
import { formatIssues } from './store.js';

/**
 * A change to a saved shot, so that fixing one action does not mean writing the whole
 * shot out again. Indices are the actions as the shot has them before the patch (the list
 * `patch_shot` and `get_item` show), whatever else the same patch removes or adds.
 */
export interface ShotPatch {
  /** Top-level fields replaced whole; `weather: null` drops the shot's own weather. */
  set?: Partial<Record<(typeof SETTABLE)[number], unknown>>;
  /** Cast members replaced whole, added, or (null) taken out. */
  cast?: Record<string, unknown>;
  /** Fields merged into an action; a field set to null is removed from it. */
  edit?: { index: number; fields: Record<string, unknown> }[];
  remove?: number[];
  add?: unknown[];
}

export const SETTABLE = [
  'scene',
  'description',
  'duration',
  'camera',
  'fadeIn',
  'fadeOut',
  'crossfade',
  'weather',
] as const;

export interface Patched {
  shot: Shot;
  /** The stretch of the shot the change shows in, for the picture: all of it for a change
   * to the shot as a whole (its scene, camera, cast, length). */
  from: number;
  to: number;
}

/** Seconds shown either side of the actions a patch touched. */
const BEFORE = 0.3;
const AFTER = 1;
/** The least span worth a picture. */
const MIN_SPAN = 2;

export function patchShot(shot: Shot, patch: ShotPatch): Patched {
  const n = shot.actions.length;
  const bad = (i: number) => !Number.isInteger(i) || i < 0 || i >= n;
  const errors: string[] = [];
  for (const e of patch.edit ?? [])
    if (bad(e.index)) errors.push(`edit: no action ${e.index} (the shot has ${n}, 0 to ${n - 1})`);
  for (const i of patch.remove ?? [])
    if (bad(i)) errors.push(`remove: no action ${i} (the shot has ${n}, 0 to ${n - 1})`);
  for (const e of patch.edit ?? [])
    if ((patch.remove ?? []).includes(e.index))
      errors.push(`action ${e.index} is both edited and removed`);
  for (const k of Object.keys(patch.set ?? {}))
    if (!(SETTABLE as readonly string[]).includes(k))
      errors.push(`set: '${k}' cannot be set here (${SETTABLE.join(', ')})`);
  if (errors.length) throw new Error(errors.join('\n'));

  const raw = JSON.parse(JSON.stringify(shot)) as Record<string, unknown> & {
    cast: Record<string, unknown>;
    actions: Record<string, unknown>[];
  };
  for (const [k, v] of Object.entries(patch.set ?? {})) {
    if (v === null) delete raw[k];
    else raw[k] = v;
  }
  for (const [id, member] of Object.entries(patch.cast ?? {})) {
    if (member === null) delete raw.cast[id];
    else raw.cast[id] = member;
  }
  const touched: Record<string, unknown>[] = [];
  for (const { index, fields } of patch.edit ?? []) {
    touched.push(raw.actions[index]);
    const a = { ...raw.actions[index] };
    for (const [k, v] of Object.entries(fields)) {
      if (v === null) delete a[k];
      else a[k] = v;
    }
    raw.actions[index] = a;
    touched.push(a);
  }
  for (const i of patch.remove ?? []) touched.push(raw.actions[i]);
  const removed = new Set(patch.remove ?? []);
  const added = (patch.add ?? []) as Record<string, unknown>[];
  touched.push(...added);
  // Kept in time order, as everything that reads a shot takes them; ties keep their order.
  raw.actions = [...raw.actions.filter((_, i) => !removed.has(i)), ...added].sort(
    (a, b) => Number(a.t) - Number(b.t)
  );

  const r = ShotSchema.safeParse(raw);
  if (!r.success) throw new Error(formatIssues(r.error));
  const out = r.data;
  if (out.id !== shot.id) throw new Error('a patch cannot change the shot id');

  const whole = !!patch.set || !!patch.cast || !touched.length;
  if (whole) return { shot: out, from: 0, to: out.duration };
  const spans = touched.map((a) => {
    const t = Number(a.t) || 0;
    const p = ActionSchema.safeParse(a);
    return [t, t + Math.max(p.success ? actionDuration(p.data) : 0, 0.5)];
  });
  let from = Math.max(0, Math.min(...spans.map((s) => s[0])) - BEFORE);
  let to = Math.min(out.duration, Math.max(...spans.map((s) => s[1])) + AFTER);
  if (to - from < MIN_SPAN) {
    const grow = (MIN_SPAN - (to - from)) / 2;
    from = Math.max(0, from - grow);
    to = Math.min(out.duration, to + grow);
  }
  return { shot: out, from, to };
}

/** One line per action, numbered as a patch addresses them. */
export function listActions(shot: Shot): string {
  return shot.actions.map((a, i) => `${i}: ${describeAction(a)}`).join('\n');
}

const clip = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function describeAction(a: Action): string {
  const where = (p: unknown) =>
    typeof p === 'string' ? p : p && typeof p === 'object' ? JSON.stringify(p) : '';
  const bits = [`t=${a.t}`];
  if (a.actor) bits.push(a.actor);
  if (a.do) bits.push(a.do);
  if (a.to !== undefined) bits.push(`→ ${where(a.to)}`);
  if (a.say) bits.push(`${a.bubble ?? 'say'} "${clip(a.say)}"`);
  if (a.emotion) bits.push(`emotion ${a.emotion}`);
  if (a.face) bits.push(`face ${JSON.stringify(a.face)}`);
  if (a.attach !== undefined) bits.push(`attach ${a.attach}`);
  if (a.set) bits.push(`set ${JSON.stringify(a.set)}`);
  if (a.camera) bits.push(`camera ${JSON.stringify(a.camera)}`);
  if (a.caption) bits.push(`caption "${clip(a.caption)}"`);
  if (a.weather) bits.push('weather');
  if (a.lightning) bits.push('lightning');
  if (a.duration) bits.push(`for ${a.duration}s`);
  return bits.join(' ');
}
