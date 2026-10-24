import { shotStarts } from './sound.js';
import type { Project, Shot } from './types.js';
import { lineDuration, shownText } from './voice.js';

/**
 * The film's subtitles: every say and caption, in the language it is written in and in
 * each language its `translation` gives, timed to when its bubble or caption is up. Pure,
 * like the rest of the engine; src/render/mkv.ts muxes them.
 */

export interface Subtitle {
  /** Film seconds. */
  start: number;
  end: number;
  text: string;
  /**
   * Shown at the top, so as not to cover a narration caption: the narration's own, and a
   * line that starts while one is up. One that only runs into the next caption's fade-in
   * stays at the bottom.
   */
  top: boolean;
}

/** The language the lines are written in: Hindi when they are in Devanagari, else English. */
export function filmLanguage(project: Project): string {
  const written = project.shots.flatMap((s) => s.actions.map((a) => a.say ?? a.caption ?? ''));
  return written.some((t) => /\p{Script=Devanagari}/u.test(t)) ? 'hi' : 'en';
}

/** Every language the film can be subtitled in: its own first, then its translations'. */
export function subtitleLanguages(project: Project, shots: Shot[] = project.shots): string[] {
  const own = filmLanguage(project);
  const more = new Set(
    shots.flatMap((s) => s.actions.flatMap((a) => Object.keys(a.translation ?? {})))
  );
  more.delete(own);
  return [own, ...[...more].sort()];
}

/** The subtitles in one language, in film order; lines with nothing in it are left out. */
export function subtitles(
  project: Project,
  lang: string,
  shots: Shot[] = project.shots
): Subtitle[] {
  const own = filmLanguage(project) === lang;
  const starts = shotStarts(shots);
  const out: Subtitle[] = [];
  shots.forEach((shot, i) => {
    // Seconds of this shot that a narration caption is up.
    const narration = shot.actions
      .filter((a) => a.caption && (a.captionStyle ?? 'narration') === 'narration')
      .map((a) => [a.t, a.t + lineDuration(project, shot, a)]);
    for (const a of shot.actions) {
      const written = a.say ?? a.caption;
      const text = own ? written : a.translation?.[lang];
      if (!written || !text) continue;
      const from = a.t;
      // A bubble is cut off with its shot.
      const to = Math.min(shot.duration, a.t + lineDuration(project, shot, a));
      if (to <= from) continue;
      out.push({
        start: starts[i] + from,
        end: starts[i] + to,
        text: shownText(text).trim(),
        top: narration.some(([s, e]) => from >= s && from < e),
      });
    }
  });
  return out.sort((x, y) => x.start - y.start);
}

/** ASS time: h:mm:ss.cc. */
function assTime(s: number): string {
  const cs = Math.round(s * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const sec = Math.floor(cs / 100) % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(sec)}.${pad(cs % 100)}`;
}

/** The family name of the bundled font, which the .mkv carries. */
export const SUBTITLE_FONT = 'Baloo 2';

/**
 * A subtitle track as an Advanced SubStation script: white text with a dark outline in the
 * bundled font (Devanagari needs it, and a phone's player may have none), along the bottom,
 * or along the top over a narration caption. The player wraps long lines.
 */
export function assScript(project: Project, subs: Subtitle[]): string {
  const { width, height } = project.meta;
  const size = Math.round(height * 0.06);
  const outline = Math.max(1, Math.round(size / 20));
  // Baloo 2's space is a fifth of an em, which the outline round each word all but fills:
  // each space is drawn a tenth of an em wider.
  const gap = `{\\fsp${Math.round(size / 10)}} {\\fsp0}`;
  const margin = Math.round(height * 0.04);
  const style = (name: string, align: number) =>
    `Style: ${name},${SUBTITLE_FONT},${size},&H00FFFFFF,&H00FFFFFF,&H00202020,&H80000000,0,0,0,0,100,100,0,0,1,${outline},1,${align},${margin * 2},${margin * 2},${margin},1`;
  // Braces open an override block in ASS and a backslash starts a tag: neither is meant here.
  const clean = (t: string) =>
    t
      .replace(/[{}]/g, '')
      .replace(/\\/g, '/')
      .replace(/\s*\n\s*/g, '\\N')
      .replace(/ +/g, gap);
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style('Default', 2),
    style('Top', 8),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...subs.map(
      (s) =>
        `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},${s.top ? 'Top' : 'Default'},,0,0,0,,${clean(s.text)}`
    ),
    '',
  ].join('\n');
}
