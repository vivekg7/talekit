import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cueSheet, shotStarts } from '../engine/sound.js';
import { assScript, subtitleLanguages, subtitles } from '../engine/subtitles.js';
import type { Project, Shot } from '../engine/types.js';
import { mixAudio, RATE } from './audio.js';
import { checkLength, runFfmpeg } from './video.js';

const FONT = fileURLToPath(new URL('../../fonts/Baloo2.ttf', import.meta.url));

/** Matroska names languages in ISO 639-2 (the bibliographic codes). */
const ISO639_2: Record<string, string> = {
  en: 'eng',
  hi: 'hin',
  bn: 'ben',
  gu: 'guj',
  kn: 'kan',
  ml: 'mal',
  mr: 'mar',
  ne: 'nep',
  pa: 'pan',
  sa: 'san',
  ta: 'tam',
  te: 'tel',
  ur: 'urd',
  es: 'spa',
  fr: 'fre',
  de: 'ger',
  it: 'ita',
  pt: 'por',
  ru: 'rus',
  ja: 'jpn',
  zh: 'chi',
  ar: 'ara',
};
const iso = (lang: string) => ISO639_2[lang] ?? lang;
const english = new Intl.DisplayNames(['en'], { type: 'language' });
const languageName = (lang: string) => english.of(lang) ?? lang;

export interface MkvOptions {
  shots?: Shot[];
  ffmpegPath?: string;
  /** The film was rendered without sound. */
  silent?: boolean;
}

/**
 * Build the .mkv of a film already rendered to mp4, without drawing a frame again: its
 * picture and full mix, then the same sound without the dialogue (music and effects, for
 * telling the story yourself) and with only the narrator, a subtitle track per language
 * (the film's own and each `translation`'s), the font they are drawn in, and a chapter per
 * shot. The full mix plays by default and the subtitles are off until chosen.
 */
export async function writeMkv(
  project: Project,
  mp4: string,
  file: string,
  opts: MkvOptions = {}
): Promise<{ audio: string[]; subtitles: string[] }> {
  const bin = opts.ffmpegPath ?? 'ffmpeg';
  const shots = opts.shots ?? project.shots;
  const seconds = await checkLength(project, shots, mp4, bin);
  const own = subtitleLanguages(project, shots)[0];
  const temp: string[] = [];
  const inputs: string[][] = [['-i', mp4]];
  const out: string[] = ['-map', '0:v', '-c:v', 'copy'];
  const audio: string[] = [];
  const addAudio = (title: string, lang: string, input?: number) => {
    const n = audio.length;
    out.push('-map', input === undefined ? '0:a' : `${input}:a`);
    out.push(`-c:a:${n}`, input === undefined ? 'copy' : 'aac');
    if (input !== undefined) out.push(`-b:a:${n}`, '160k');
    out.push(`-metadata:s:a:${n}`, `title=${title}`, `-metadata:s:a:${n}`, `language=${iso(lang)}`);
    out.push(`-disposition:a:${n}`, n ? '0' : 'default');
    audio.push(title);
  };

  try {
    if (!opts.silent && cueSheet(project, shots).length) {
      addAudio('Full mix', own);
      const voices = cueSheet(project, shots).filter((c) => c.bus === 'voice');
      // A film with no spoken lines sounds the same without them; and the same with only
      // its narrator as with no one, when it has none.
      const takes: ['none' | 'narrator', string, string][] = [];
      if (voices.length) takes.push(['none', 'Music and effects', 'zxx']);
      if (voices.some((c) => c.narrator) && voices.some((c) => !c.narrator))
        takes.push(['narrator', 'Music, effects and narrator', own]);
      for (const [voicesKept, title, lang] of takes) {
        const mix = await mixAudio(project, shots, {
          ffmpegPath: bin,
          seconds,
          voices: voicesKept,
        });
        if (!mix) continue;
        const raw = `${file}.${voicesKept}.f32`;
        temp.push(raw);
        await writeFile(raw, new Uint8Array(mix.buffer));
        inputs.push(['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', raw]);
        addAudio(title, lang, inputs.length - 1);
      }
    }

    const subs: string[] = [];
    for (const lang of subtitleLanguages(project, shots)) {
      const lines = subtitles(project, lang, shots);
      if (!lines.length) continue;
      const ass = `${file}.${lang}.ass`;
      temp.push(ass);
      await writeFile(ass, assScript(project, lines));
      inputs.push(['-i', ass]);
      const n = subs.length;
      out.push('-map', `${inputs.length - 1}:s`, `-c:s:${n}`, 'copy');
      out.push(`-metadata:s:s:${n}`, `title=${languageName(lang)}`);
      out.push(`-metadata:s:s:${n}`, `language=${iso(lang)}`, `-disposition:s:${n}`, '0');
      subs.push(languageName(lang));
    }
    if (subs.length)
      out.push(
        '-attach',
        FONT,
        '-metadata:s:t:0',
        'mimetype=application/x-truetype-font',
        '-metadata:s:t:0',
        'filename=Baloo2.ttf'
      );

    // A chapter per shot, named by its id, for skipping to a scene.
    const starts = shotStarts(shots);
    const chapters = `${file}.chapters.txt`;
    temp.push(chapters);
    await writeFile(
      chapters,
      [
        ';FFMETADATA1',
        `title=${project.meta.title.replace(/[=;#\\\n]/g, ' ')}`,
        ...shots.flatMap((s, i) => [
          '[CHAPTER]',
          'TIMEBASE=1/1000',
          `START=${Math.round(starts[i] * 1000)}`,
          `END=${Math.round(Math.min(seconds, starts[i] + s.duration) * 1000)}`,
          `title=${s.id}`,
        ]),
        '',
      ].join('\n')
    );
    inputs.push(['-f', 'ffmetadata', '-i', chapters]);
    out.push(
      '-map_metadata',
      String(inputs.length - 1),
      '-map_chapters',
      String(inputs.length - 1)
    );

    const r = await runFfmpeg(bin, [
      '-y',
      '-loglevel',
      'error',
      ...inputs.flat(),
      ...out,
      // The dispositions above say which tracks play first; ffmpeg is not to guess.
      '-default_mode',
      'passthrough',
      file,
    ]);
    if (r.code !== 0) throw new Error(`ffmpeg exited with ${r.code}: ${r.stderr}`);
    return { audio, subtitles: subs };
  } finally {
    await Promise.all(temp.map((f) => rm(f, { force: true })));
  }
}
