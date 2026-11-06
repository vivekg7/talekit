import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isPortrait } from '../engine/format.js';
import { movieDuration } from '../engine/timeline.js';
import type { Project } from '../engine/types.js';
import type { Problem } from './validate.js';

/**
 * The words a film or reel is posted with live in its `out/` as the exact text to paste:
 * `youtube.txt` (the title on its first line, a blank line, then the description) and, for a
 * reel, `instagram.txt` (the caption). These are checked as plain text because YouTube and
 * Instagram show Markdown markers literally and keep every line break, and because pasting
 * Devanagari has been seen to drop a line's first letter, leaving it starting on a vowel sign.
 */
export const POST_FILES = { youtube: 'youtube.txt', instagram: 'instagram.txt' } as const;

// The platforms' own limits, as their upload forms enforce them.
const YT_TITLE = 100;
const YT_DESCRIPTION = 5000;
const YT_HASHTAGS = 60; // past this YouTube ignores every hashtag on the video
const IG_CAPTION = 2200;
const IG_HASHTAGS = 30;

const CHAPTER = /^(?:(\d+):)?(\d{1,2}):(\d{2})\s+\S/;
const HASHTAG = /#[\p{L}\p{M}\p{N}_]+/gu;

const length = (s: string) => [...s].length;
const hashtags = (s: string) => s.match(HASHTAG) ?? [];
const isTagLine = (l: string) => l.trim() !== '' && l.replace(HASHTAG, '').trim() === '';

function chapterSeconds(line: string): number | undefined {
  const m = CHAPTER.exec(line.trim());
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
}

/** Problems any pasted post can have: Markdown, a lost first letter, hard wraps, repeated tags. */
function plainTextProblems(where: string, text: string, first = 1): Problem[] {
  const out: Problem[] = [];
  const warn = (message: string) => out.push({ level: 'warning', where, message });
  const lines = text.split('\n');

  if (/\*\*|__/.test(text))
    warn('has ** or __ bold markers, which are shown as typed: remove them');
  const heading = lines.findIndex((l) => /^#{1,6}\s/.test(l));
  if (heading >= 0)
    warn(
      `line ${heading + first} is a Markdown heading ("${lines[heading]}"): write it as plain text`
    );
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(text))
    warn('has a Markdown link [text](url): write the address itself');
  if (text.includes('`')) warn('has backticks, which are shown as typed');

  lines.forEach((l, i) => {
    if (/^\p{M}/u.test(l.trimStart()))
      warn(
        `line ${i + first} starts on a vowel sign or mark ("${l.trim().slice(0, 12)}…"): its first letter is missing`
      );
  });

  // A paragraph broken over several lines mid-sentence: the platforms keep each break.
  const wrapped: number[] = [];
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    if (next === undefined || next.trim() === '' || l.trim() === '') return;
    if (chapterSeconds(l) !== undefined || chapterSeconds(next) !== undefined) return;
    if (isTagLine(l) || isTagLine(next) || /^\s*([-–•*]|\d+[.)])\s/.test(next)) return;
    if (/[\p{L}\p{M}\p{N},;]$/u.test(l.trimEnd())) wrapped.push(i + first);
  });
  if (wrapped.length)
    warn(
      `line${wrapped.length > 1 ? 's' : ''} ${wrapped.join(', ')} break${wrapped.length > 1 ? '' : 's'} mid-sentence: every line break shows, so write each paragraph on one line`
    );

  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const tag of hashtags(text)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) repeated.add(tag);
    seen.add(key);
  }
  if (repeated.size) warn(`repeats ${[...repeated].join(' ')}`);
  return out;
}

/** `youtube.txt`: the title, a blank line, then the description. `duration` is the video's, in seconds. */
export function youtubeProblems(
  text: string,
  duration: number,
  where = 'out/youtube.txt'
): Problem[] {
  const out: Problem[] = [];
  const add = (level: Problem['level'], message: string) => out.push({ level, where, message });
  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const title = lines[0]?.trim() ?? '';
  const description = lines.slice(2).join('\n');

  if (!title) add('error', 'the first line is the title, and it is empty');
  if (length(title) > YT_TITLE)
    add('error', `the title is ${length(title)} characters; YouTube allows ${YT_TITLE}`);
  if (lines.length > 1 && lines[1].trim() !== '')
    add('error', 'put a blank line after the title (line 1); the description starts on line 3');
  if (!description.trim()) add('warning', 'no description after the title');
  if (length(description) > YT_DESCRIPTION)
    add(
      'error',
      `the description is ${length(description)} characters; YouTube allows ${YT_DESCRIPTION}`
    );
  if (/[<>]/.test(text)) add('error', 'YouTube refuses < and > in a title or description');

  const marks = lines
    .map((l, i) => ({ line: i + 1, at: chapterSeconds(l) }))
    .filter((m): m is { line: number; at: number } => m.at !== undefined);
  // A bilingual description may list the chapters twice; each list starts again at 0:00.
  const lists: { line: number; at: number }[][] = [];
  for (const m of marks)
    if (m.at === 0 || !lists.length) lists.push([m]);
    else lists[lists.length - 1].push(m);
  const why = 'or YouTube shows no chapters';
  for (const list of lists) {
    if (list[0].at !== 0)
      add('warning', `the first chapter (line ${list[0].line}) must be 0:00, ${why}`);
    if (list.length < 3)
      add('warning', `chapters from line ${list[0].line}: at least 3 are needed, ${why}`);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i].at - list[i - 1].at;
      if (gap < 10)
        add(
          'warning',
          gap < 0
            ? `chapter on line ${list[i].line} is earlier than the one before, ${why}`
            : `chapter on line ${list[i].line} is ${gap} s after the one before; each needs 10 s, ${why}`
        );
    }
    const last = list[list.length - 1];
    if (last.at >= duration)
      add('warning', `chapter on line ${last.line} is past the end (${duration.toFixed(0)} s)`);
  }

  const tags = hashtags(text).length;
  if (tags > YT_HASHTAGS)
    add('error', `${tags} hashtags; past ${YT_HASHTAGS} YouTube ignores them all`);
  return [...out, ...plainTextProblems(where, title), ...plainTextProblems(where, description, 3)];
}

/** `instagram.txt`: the caption, as pasted. */
export function instagramProblems(text: string, where = 'out/instagram.txt'): Problem[] {
  const out: Problem[] = [];
  const add = (level: Problem['level'], message: string) => out.push({ level, where, message });
  const caption = text.replace(/\r\n/g, '\n').trimEnd();
  if (!caption.trim()) add('error', 'the caption is empty');
  if (length(caption) > IG_CAPTION)
    add('error', `the caption is ${length(caption)} characters; Instagram allows ${IG_CAPTION}`);
  const tags = hashtags(caption);
  if (tags.length > IG_HASHTAGS)
    add('error', `${tags.length} hashtags; Instagram allows ${IG_HASHTAGS}`);
  if (tags.some((t) => t.toLowerCase() === '#shorts'))
    add('warning', '#Shorts is YouTube’s tag; leave it out of the Instagram caption');
  if (caption.split('\n').some((l) => chapterSeconds(l) !== undefined))
    add('warning', 'has chapter timestamps, which a reel caption cannot use');
  return [...out, ...plainTextProblems(where, caption)];
}

/**
 * Check the post files in a project's `out/`, and say which are missing once the video has
 * been rendered or its cover drawn: a film needs `youtube.txt`, a reel also `instagram.txt`.
 */
export async function postProblems(root: string, project: Project): Promise<Problem[]> {
  const dir = path.join(root, 'out');
  const file = (name: string) => path.join(dir, name);
  const read = (name: string) => readFile(file(name), 'utf8');
  const out: Problem[] = [];
  const missing = (name: string, why: string) =>
    out.push({ level: 'warning', where: `out/${name}`, message: `missing: ${why}` });

  const released = existsSync(file('movie.mp4')) || existsSync(file('thumbnail.png'));
  const portrait = isPortrait(project.meta);

  if (existsSync(file(POST_FILES.youtube)))
    out.push(...youtubeProblems(await read(POST_FILES.youtube), movieDuration(project)));
  else if (released)
    missing(
      POST_FILES.youtube,
      existsSync(file('description.md'))
        ? 'description.md is replaced by youtube.txt (and instagram.txt for a reel), the exact text to paste'
        : 'the title and description to post the video with'
    );

  if (existsSync(file(POST_FILES.instagram)))
    out.push(...instagramProblems(await read(POST_FILES.instagram)));
  else if (released && portrait) missing(POST_FILES.instagram, 'the caption to post the reel with');
  return out;
}
