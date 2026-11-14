/**
 * Hearing voiced takes: speech recognition with whisper.cpp (`whisper-cli`, brew install
 * whisper-cpp) and its large-v3-turbo model, fetched once into ~/.cache/talekit/asr. What
 * is heard is compared with the line by engine/speech.ts.
 *
 * Whisper leaves out a word said on its own before a pause ("परछाईं...? शेर को..."), so a
 * take that seems to skip one is heard again in pieces, cut at its pauses, and the better
 * of the two hearings counts.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { decode, RATE } from '../render/audio.js';

/** A take to hear: the audio file and the language it speaks. */
export interface Take {
  file: string;
  lang: string;
}

/**
 * Hears takes: the text of each, in order. `pieces` hears each cut at its pauses and joins
 * what the pieces say.
 */
export type Hearer = (takes: Take[], pieces?: boolean) => Promise<string[]>;

const MODEL_NAME = 'ggml-large-v3-turbo-q5_0.bin';
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`;

/** Where the model is: TALEKIT_ASR_MODEL, else the cache. */
export const modelPath = (): string =>
  process.env.TALEKIT_ASR_MODEL ?? path.join(os.homedir(), '.cache', 'talekit', 'asr', MODEL_NAME);

/** Fetch the model (about 570 MB) the first time it is needed. */
async function ensureModel(): Promise<string> {
  const file = modelPath();
  if (existsSync(file)) return file;
  await mkdir(path.dirname(file), { recursive: true });
  process.stderr.write(`hearing: fetching the speech model (570 MB) into ${file}\n`);
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`could not fetch ${MODEL_URL}: ${res.status}`);
  const part = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(part));
  await rename(part, file);
  return file;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
    p.on('error', (e) => reject(new Error(`${cmd} did not start: ${e.message}`)));
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${err.trim()}`))
    );
  });
}

/** Whether whisper-cli is installed. */
function installed(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn('whisper-cli', ['--help'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('close', () => resolve(true));
  });
}

/** A stretch of the take as 16 kHz mono WAV, which is what whisper reads. */
const toWav = (file: string, out: string, from?: number, to?: number) =>
  run('ffmpeg', [
    '-v',
    'error',
    '-y',
    ...(from !== undefined ? ['-ss', String(from)] : []),
    ...(to !== undefined ? ['-to', String(to)] : []),
    '-i',
    file,
    '-ar',
    '16000',
    '-ac',
    '1',
    out,
  ]);

/** Pauses this long or longer, 30 dB under the loudest of the take, split it. */
const PAUSE = 0.2;

/** Where to cut a take into pieces: the middle of each pause, in seconds. */
export async function pauses(file: string): Promise<number[]> {
  const samples = await decode(file, 1);
  const step = Math.round(RATE * 0.02);
  const blocks: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j++) sum += samples[j] * samples[j];
    blocks.push(sum / step);
  }
  const quiet = Math.max(1e-12, ...blocks) * 1e-3;
  const cuts: number[] = [];
  let start = -1;
  blocks.forEach((b, i) => {
    if (b < quiet && start < 0) start = i;
    if ((b >= quiet || i === blocks.length - 1) && start >= 0) {
      // Not the quiet before the first word or after the last.
      if (start > 0 && b >= quiet && (i - start) * 0.02 >= PAUSE)
        cuts.push(((start + i) / 2) * 0.02);
      start = -1;
    }
  });
  return cuts;
}

/** whisper-cli over WAV files, one run per language: the text of each. */
async function transcribe(model: string, wavs: { wav: string; lang: string }[]): Promise<string[]> {
  for (const lang of new Set(wavs.map((w) => w.lang))) {
    const files = wavs.filter((w) => w.lang === lang).map((w) => w.wav);
    const threads = String(Math.max(2, Math.min(8, os.cpus().length - 2)));
    await run('whisper-cli', [
      '-m',
      model,
      '-l',
      lang,
      '-nt',
      '-np',
      '-otxt',
      '-t',
      threads,
      ...files,
    ]);
  }
  return Promise.all(wavs.map(async (w) => (await readFile(`${w.wav}.txt`, 'utf8')).trim()));
}

/**
 * The hearer this machine has: whisper.cpp, or undefined without whisper-cli (the takes
 * then go unheard, and the voicing report says so). TALEKIT_HEAR=off turns it off.
 */
export async function whisperHearer(): Promise<Hearer | undefined> {
  if (process.env.TALEKIT_HEAR === 'off' || !(await installed())) return undefined;
  return async (takes, pieces = false) => {
    if (!takes.length) return [];
    const model = await ensureModel();
    const dir = await mkdtemp(path.join(os.tmpdir(), 'talekit-hear-'));
    try {
      const wavs: { wav: string; lang: string; take: number }[] = [];
      for (const [i, t] of takes.entries()) {
        const cuts = pieces ? await pauses(t.file) : [];
        const ends = [undefined, ...cuts, undefined];
        for (let k = 0; k + 1 < ends.length; k++) {
          const wav = path.join(dir, `${i}-${k}.wav`);
          await toWav(t.file, wav, ends[k], ends[k + 1]);
          wavs.push({ wav, lang: t.lang, take: i });
        }
      }
      const heard = await transcribe(model, wavs);
      return takes.map((_, i) =>
        heard
          .filter((_, k) => wavs[k].take === i)
          .join(' ')
          .trim()
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
