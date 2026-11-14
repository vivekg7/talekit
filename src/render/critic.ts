import { composeFrame } from '../engine/compose.js';
import { shotBefore, staged } from '../engine/stage.js';
import { needsShaping, shapedText } from '../engine/glyphs.js';
import { escapeXml } from '../engine/svg.js';
import {
  actionDuration,
  resolveActor,
  resolvePosition,
  type ActorState,
} from '../engine/timeline.js';
import { isMoveVerb, type Action, type Project, type Shot, type Verb } from '../engine/types.js';
import { lineDuration, shorten, shownText } from '../engine/voice.js';

/**
 * What the critic looks at (docs/PLAN.md, phase 8.4): a shot's frames at its beats, each
 * captioned with what the shot says is happening then, so a picture that does not match
 * what was meant can be told from one that does. The checks catch what has one right
 * answer; this is for the rest (a tail come loose, a moon in front of the trees, a man
 * meant asleep in a hut that shows empty, a moral said in a hurry), seen by eye.
 */

/** A moment worth a look, and what is meant to be happening then. */
export interface Beat {
  t: number;
  /** Why this moment: `start`, `end`, a line, a verb arriving or at its work. */
  why: string[];
  /** The actors it is about, whose state the caption gives. */
  who: string[];
}

/** Verbs whose moment is their middle, the hand on the work; the rest are looked at done. */
const AT_WORK: ReadonlySet<Verb> = new Set([
  'strike',
  'wipe',
  'dig',
  'eat',
  'hold',
  'give',
  'pickup',
  'putdown',
  'kick',
  'point',
  'wave',
  'aim',
  'shoot',
  'swim',
  'tremble',
]);

/** Beats closer than this, seconds, are one look. */
const MERGE = 0.5;

/** When an action of the shot (as the engine plays it) starts and ends. */
function spanOf(project: Project, shot: Shot, a: Action): [number, number] {
  if (a.say || a.caption) return [a.t, a.t + lineDuration(project, shot, a)];
  const scene = project.scenes[shot.scene];
  if (a.do && isMoveVerb(a.do) && a.actor && a.to !== undefined && shot.cast[a.actor]) {
    const from = resolveActor(project, scene, shot, a.actor, a.t);
    const to = resolvePosition(project, scene, a.to);
    return [a.t, a.t + actionDuration(a, from, to, scene)];
  }
  return [a.t, a.t + actionDuration(a)];
}

/** The words of a line as the critic reads them: in English when the film gives that. */
const words = (a: Action, n: number) =>
  `"${shorten(shownText(a.translation?.en ?? a.say ?? a.caption ?? ''), n)}"`;

/** One action in words: "dhobi shouts "Come on…" to gadha", "ramu walk to well". */
function said(a: Action & { staged?: string }): string {
  const who = a.actor ?? 'narrator';
  const to = typeof a.to === 'string' ? a.to : a.to && 'x' in a.to ? `${a.to.x},${a.to.y}` : '';
  if (a.caption) return `${a.captionStyle === 'title' ? 'title' : 'narrator'}: ${words(a, 70)}`;
  if (a.say) {
    const how = a.bubble === 'thought' ? 'thinks' : a.bubble === 'shout' ? 'shouts' : 'says';
    return `${who} ${how} ${words(a, 60)}${to ? ` to ${to}` : ''}`;
  }
  const parts: string[] = [];
  if (a.do) parts.push(`${a.do}${to ? ` ${isMoveVerb(a.do) ? 'to' : 'at'} ${to}` : ''}`);
  if (a.attach !== undefined) parts.push(a.attach === false ? 'let go' : `held by ${a.attach}`);
  if (!parts.length) return '';
  return `${who} ${parts.join(', ')}${a.staged ? ` (engine: ${a.staged})` : ''}`;
}

/** Who an action is about: its actor, and whom it is said to or done at. */
function whoOf(a: Action): string[] {
  return [
    a.actor,
    typeof a.to === 'string' ? a.to : undefined,
    typeof a.attach === 'string' ? a.attach : undefined,
  ].filter((x): x is string => !!x);
}

/** A shot has a frame at most this many beats; more are thinned, the lines kept first. */
const MAX_BEATS = 11;

/**
 * The moments of a shot worth a look: its first and last frame, the middle of every line
 * (who speaks, who listens, the bubble), every verb at its work or done, merged when they
 * are close. A verb an actor does over and over (a blow every second) is looked at once.
 */
export function beatsOf(project: Project, shot: Shot): Beat[] {
  const scene = project.scenes[shot.scene];
  const play = staged(project, scene, shot);
  const first = project.shots[0]?.id === shot.id;
  const start = Math.max(
    first ? 0.6 : 0.05,
    (shot.crossfade ?? 0) + 0.05,
    (shot.fadeIn ?? 0) + 0.05
  );
  type Raw = Beat & { rank: number };
  const raw: Raw[] = [{ t: start, why: ['start'], who: Object.keys(shot.cast), rank: 0 }];
  const lastEnd = new Map<string, number>();
  for (const a of play.actions) {
    const what = said(a);
    if (!what || a.camera) continue;
    const [t0, t1] = spanOf(project, play, a);
    const key = `${a.actor}:${a.do}`;
    const again = a.do && (lastEnd.get(key) ?? -Infinity) > t0 - 2;
    if (a.do) lastEnd.set(key, t1);
    if (again) continue;
    let t: number;
    let rank: number;
    if (a.say || a.caption) [t, rank] = [t0 + Math.min(0.5 * (t1 - t0), 2), 1];
    else if (a.do && AT_WORK.has(a.do)) [t, rank] = [0.5 * (t0 + t1), 3];
    else if (a.do) [t, rank] = [t1 + 0.1, 2];
    else [t, rank] = [t0 + 0.3, 3]; // a take or a let-go
    raw.push({ t, why: [what], who: whoOf(a), rank });
  }
  raw.push({
    t: shot.duration - (shot.fadeOut ?? 0) - 0.05,
    why: ['end'],
    who: Object.keys(shot.cast),
    rank: 0,
  });
  // Merged into one look at the later moment, so a walk is seen arrived; never further
  // than MERGE from the first moment of the group.
  let beats: (Raw & { first: number })[] = [];
  for (const b of raw
    // Nothing inside the dissolve or the fade in: the frame there is the shot before.
    .map((b) => ({
      ...b,
      t: Math.min(Math.max(b.t, start), Math.max(start, shot.duration - 0.05)),
    }))
    .sort((x, y) => x.t - y.t)) {
    const last = beats[beats.length - 1];
    if (last && b.t - last.first < MERGE) {
      last.t = b.t;
      last.why.push(...b.why);
      last.who = [...new Set([...last.who, ...b.who])];
      last.rank = Math.min(last.rank, b.rank);
    } else beats.push({ ...b, first: b.t, why: [...b.why] });
  }
  // Too many: the least telling go first, spread over the shot.
  for (let rank = 3; beats.length > MAX_BEATS && rank > 0; rank--) {
    const these = beats.filter((b) => b.rank === rank);
    const drop = new Set<Raw & { first: number }>();
    const over = beats.length - MAX_BEATS;
    for (let i = 0; i < Math.min(over, these.length); i++)
      drop.add(these[Math.floor(((i + 0.5) * these.length) / Math.min(over, these.length))]);
    beats = beats.filter((b) => !drop.has(b));
  }
  return beats.map(({ t, why, who }) => ({ t, why, who }));
}

/** How an actor is at t, in a few words: what a picture of it should show. */
function stateOf(a: ActorState): string {
  const s: string[] = [];
  if (!a.visible) return `${a.id} gone`;
  if (a.locomotion !== 'idle') s.push(a.locomotion);
  if (a.lie >= 0.5) s.push(a.face.eyes === 'closed' ? 'lying, asleep' : 'lying');
  else if (a.sit >= 0.5) s.push('sitting');
  if (a.hidden) s.push('hidden');
  if (a.heldBy) s.push(`held by ${a.heldBy}`);
  if (a.character.parts.eyes) s.push(`facing ${a.facing}`);
  return `${a.id} ${s.join(', ')}`;
}

/** The text under a frame: the time and what happens, then how the actors in it are. */
function captionOf(project: Project, shot: Shot, b: Beat): string[] {
  const scene = project.scenes[shot.scene];
  const play = staged(project, scene, shot);
  // Lines still being said at the beat, though they began before it.
  const ongoing = play.actions
    .filter((a) => (a.say || a.caption) && !b.why.includes(said(a)))
    .filter((a) => {
      const [t0, t1] = spanOf(project, play, a);
      return t0 <= b.t && b.t < t1;
    })
    .map((a) => `(still) ${said(a)}`);
  const states = b.who
    .filter((id) => shot.cast[id] && project.characters[id])
    .map((id) => stateOf(resolveActor(project, scene, shot, id, b.t)));
  return [`${b.t.toFixed(2)} s · ${[...b.why, ...ongoing].join(' · ')}`, states.join('; ')];
}

/** Wrap text to lines of about `width` characters. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && line.length + 1 + w.length > width) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

export interface CriticCell {
  title: string;
  lines: string[];
  svg: string;
}

/**
 * The cells a critic looks at for a shot: across the cut from the shot before (its last
 * frame, this one's first), then a frame at every beat.
 */
export function criticCells(project: Project, shot: Shot): CriticCell[] {
  const cells: CriticCell[] = [];
  const prev = shotBefore(project, shot);
  if (prev) {
    const how =
      prev.scene === shot.scene
        ? `same place, cut ${shot.cut ?? (shot.crossfade > 0 ? 'later' : 'next')}`
        : 'another place';
    cells.push({
      title: `end of ${prev.id} (the shot before; ${how})`,
      lines: [],
      svg: composeFrame(project, prev, Math.max(0, prev.duration - (prev.fadeOut ?? 0) - 0.05)),
    });
  }
  for (const b of beatsOf(project, shot)) {
    const [head, states] = captionOf(project, shot, b);
    cells.push({
      title: `${shot.id} ${head}`,
      lines: [states],
      svg: composeFrame(project, shot, b.t),
    });
  }
  return cells;
}

const FONT = 'Helvetica, Arial, sans-serif';

/**
 * The critic's sheets for a shot: its cells tiled with their captions, a few to a sheet so
 * each frame is big enough to see a tail or a hand (six landscape frames of 630 px, or
 * four portrait ones of 375), and no sheet past what image models take without shrinking.
 */
export function criticSheetsSvg(project: Project, shot: Shot): string[] {
  const { width: W, height: H } = project.meta;
  const portrait = H > W;
  const cols = portrait ? 4 : 2;
  const per = portrait ? 4 : 6;
  const cellW = portrait ? 375 : 630;
  const cellH = Math.round((cellW * H) / W);
  const chars = Math.floor(cellW / 7.2);
  const lineH = 15;
  const cells = criticCells(project, shot);
  const sheets: string[] = [];
  for (let s = 0; s < cells.length; s += per) {
    const page = cells.slice(s, s + per);
    const texts = page.map((c) => [
      ...wrap(c.title, chars)
        .slice(0, 3)
        .map((l) => ({ l, bold: true })),
      ...c.lines
        .flatMap((l) => wrap(l, chars + 6))
        .slice(0, 3)
        .map((l) => ({ l, bold: false })),
    ]);
    const capH = Math.max(...texts.map((t) => t.length)) * lineH + 8;
    const gap = 10;
    const rows = Math.ceil(page.length / cols);
    const SW = cols * (cellW + gap) + gap;
    const SH = rows * (cellH + capH + gap) + gap;
    let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${SW}' height='${SH}' viewBox='0 0 ${SW} ${SH}'><rect width='${SW}' height='${SH}' fill='#222'/>`;
    page.forEach((c, i) => {
      const x = gap + (i % cols) * (cellW + gap);
      const y = gap + Math.floor(i / cols) * (cellH + capH + gap);
      out += `<svg x='${x}' y='${y}' width='${cellW}' height='${cellH}' viewBox='0 0 ${W} ${H}'>${c.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
      texts[i].forEach(({ l, bold }, k) => {
        const ty = y + cellH + 15 + k * lineH;
        const size = bold ? 13 : 11.5;
        const fill = bold ? '#eee' : '#aab';
        out += needsShaping(l)
          ? shapedText(l, { x: x + 3, y: ty, fontSize: size + 1, fill, bold, anchor: 'start' })
          : `<text x='${x + 3}' y='${ty}' font-family='${FONT}' font-size='${size}' font-weight='${bold ? 'bold' : 'normal'}' fill='${fill}'>${escapeXml(l)}</text>`;
      });
    });
    sheets.push(out + '</svg>');
  }
  return sheets;
}

/**
 * The film as it is told, for the story half of the critique: every shot's lines in the
 * order they are heard, who says them to whom, how long each is up, and the stretches
 * where nobody speaks.
 */
export function readThrough(project: Project): string {
  const out: string[] = [];
  let at = 0;
  for (const shot of project.shots) {
    const scene = project.scenes[shot.scene];
    out.push(
      `\n## ${shot.id} (${shot.scene}, ${shot.duration.toFixed(1)} s, film ${fmt(at)}–${fmt(at + shot.duration)})`
    );
    const cast = Object.keys(shot.cast).join(', ');
    if (cast) out.push(`cast: ${cast}`);
    const play = staged(project, scene, shot);
    const lines = play.actions.filter((a) => a.say || a.caption).sort((a, b) => a.t - b.t);
    let quiet = 0;
    for (const a of lines) {
      const [t0, t1] = spanOf(project, play, a);
      if (t0 - quiet >= 4) out.push(`  (${(t0 - quiet).toFixed(1)} s with no line)`);
      const who = a.caption ? (a.captionStyle === 'title' ? 'TITLE' : 'NARRATOR') : a.actor;
      const v = a.actor ? project.characters[a.actor]?.voice : project.meta.narrator;
      const voice = typeof v === 'string' ? v : v && `${v.id}${v.pitch ? ` pitch ${v.pitch}` : ''}`;
      const how = a.bubble === 'thought' ? ' (thinks)' : a.bubble === 'shout' ? ' (shouts)' : '';
      const to = a.say && typeof a.to === 'string' ? ` → ${a.to}` : '';
      const emo = a.emotion ? ` [${a.emotion}]` : '';
      const en = a.translation?.en ? `   (en: ${a.translation.en})` : '';
      out.push(
        `  ${t0.toFixed(1)}–${t1.toFixed(1)}  ${who}${voice ? ` {${voice}}` : ''}${to}${how}${emo}: ${shownText(a.say ?? a.caption ?? '')}${en}`
      );
      quiet = Math.max(quiet, t1);
    }
    if (shot.duration - quiet >= 4)
      out.push(`  (${(shot.duration - quiet).toFixed(1)} s with no line, to the end)`);
    at += shot.duration;
  }
  return `# ${project.meta.title}: read-through (${fmt(at)})\n` + out.join('\n') + '\n';
}

const fmt = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
};
