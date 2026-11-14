import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { Project, Shot } from '../engine/types.js';
import { ENVELOPE_RATE, timeActions, voiceLines, type Line } from '../engine/voice.js';
import { badTake, matchTake, speechLanguage, takeScore } from '../engine/speech.js';
import { decode, RATE } from '../render/audio.js';
import { whisperHearer, type Hearer } from './hear.js';
import {
  loadAudio,
  projectPaths,
  readVoiceIndex,
  voiceIndexPath,
  type VoiceEntry,
} from './store.js';

/** The sidecar that speaks: tools/tts at the package root, run in its own uv environment. */
const TTS_DIR = fileURLToPath(new URL('../../tools/tts/', import.meta.url));

/**
 * The command that runs the sidecar. TALEKIT_TTS replaces it (a shell command reading the
 * same JSON lines), for another machine's setup or a test.
 */
function ttsCommand(): { cmd: string; args: string[]; shell: boolean } {
  const custom = process.env.TALEKIT_TTS;
  if (custom) return { cmd: custom, args: [], shell: true };
  return {
    cmd: 'uv',
    args: ['run', '-q', '--project', TTS_DIR, 'python', path.join(TTS_DIR, 'speak.py')],
    shell: false,
  };
}

export interface VoiceReport {
  /** Lines spoken now. */
  made: number;
  /** Lines that already had their audio. */
  kept: number;
  failed: { line: Line; error: string }[];
  /** Takes heard and compared with their lines. */
  heard: number;
  /** Lines said again because the take did not say them, and a later take did better. */
  redone: number;
  /**
   * Lines no take said: what the best of them was heard to say, after how many takes, and
   * whether the take was kept as made by hand (see VoiceEntry.bytes) rather than said again.
   */
  doubtful: { line: Line; heard: string; takes: number; byHand: boolean }[];
  /** Nothing could hear the takes (no whisper-cli, or `hearError`): they were not checked. */
  unheard?: boolean;
  /** Why hearing failed when whisper is there (no model download, whisper-cli failing). */
  hearError?: string;
}

/** Semitones as a ffmpeg chain: shift the pitch, keep the length. */
function pitchChain(semitones: number): string[] {
  if (!semitones) return [];
  const r = 2 ** (semitones / 12);
  return [`aresample=${RATE}`, `asetrate=${RATE * r}`, `aresample=${RATE}`, `atempo=${1 / r}`];
}

/** The quiet the model leaves at each end, trimmed so a line's timing is its words. */
const TRIM = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
  'areverse',
];

/** Loudness of speech while it sounds (dBFS RMS over the 20 ms stretches that are not pauses). */
const SPEECH_LEVEL = -20;

/**
 * Bring a line to the same speaking level as every other, whatever the model or voice gave
 * (they differ by several dB), short of clipping its loudest peak.
 */
function level(samples: Float32Array): Float32Array {
  const step = RATE / ENVELOPE_RATE;
  const blocks: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0;
    for (let j = i; j < i + step; j++) sum += samples[j] * samples[j];
    blocks.push(sum / step);
  }
  const loudest = Math.max(1e-12, ...blocks);
  // Pauses and breaths (30 dB under the loudest stretch) do not count.
  const voiced = blocks.filter((b) => b > loudest * 1e-3);
  const rms = Math.sqrt(voiced.reduce((a, b) => a + b, 0) / Math.max(1, voiced.length));
  let peak = 1e-9;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(10 ** (SPEECH_LEVEL / 20) / Math.max(1e-9, rms), 0.95 / peak);
  return samples.map((v) => v * gain);
}

/** Write mono samples at RATE as Opus: small enough to keep a film's lines in its repo. */
function encode(samples: Float32Array, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-f',
        'f32le',
        '-ar',
        String(RATE),
        '-ac',
        '1',
        '-i',
        '-',
        '-c:a',
        'libopus',
        '-b:a',
        '64k',
        out,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] }
    );
    let err = '';
    ff.stderr.on('data', (d) => (err += d));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim()))));
    ff.stdin.end(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  });
}

/** Loudness every 1/ENVELOPE_RATE s, scaled so the loudest moment is 255. */
function envelope(samples: Float32Array): Buffer {
  const step = RATE / ENVELOPE_RATE;
  const n = Math.ceil(samples.length / step);
  const rms = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = Math.min(samples.length, (i + 1) * step);
    for (let j = i * step; j < end; j++) sum += samples[j] * samples[j];
    rms[i] = Math.sqrt(sum / Math.max(1, end - i * step));
  }
  const peak = Math.max(1e-9, ...rms);
  return Buffer.from(Array.from(rms, (v) => Math.round((v / peak) * 255)));
}

/** What the speech check did, in lines for a report; empty when it heard nothing. */
export function hearingLines(r: VoiceReport): string[] {
  const out: string[] = [];
  if (r.hearError) out.push(`  takes not heard: ${r.hearError}`);
  else if (r.unheard && r.made)
    out.push(
      '  takes not heard: install whisper.cpp (brew install whisper-cpp) and each take is checked against its line'
    );
  if (r.heard)
    out.push(
      `  heard ${r.heard} take${r.heard === 1 ? '' : 's'}${r.redone ? `; ${r.redone} said again, better` : ''}`
    );
  for (const d of r.doubtful)
    out.push(
      `  speech.mismatch: ${d.line.shot} action ${d.line.action}: '${d.line.text}' was heard as '${d.heard}' (${d.byHand ? 'a take made or changed by hand, kept: delete it to have it said again' : `best of ${d.takes} take${d.takes === 1 ? '' : 's'}`})`
    );
  return out;
}

/** Takes made of a line before the best of them is kept, however it sounds. */
const MAX_TAKES = 3;
/** Engines that sample, so a second take of a line is said differently (Kokoro is not). */
const SAMPLED = new Set(['chatterbox']);

/**
 * Speak every line in these shots that has no audio yet, into audio/voices/, and record it
 * in the index. Then hear every take not heard yet (`hearer`; whisper.cpp when installed,
 * `null` for none) and say again, up to MAX_TAKES, a line whose take does not say it,
 * keeping the best. The project's `audio` is refreshed, and the actions placed `after` a
 * line timed again, so timings read the new lines at once.
 * Throws when the sidecar cannot start; a line the model fails on is reported, not thrown.
 */
export async function makeVoices(
  root: string,
  project: Project,
  shots: Shot[] = project.shots,
  onLine?: (done: number, total: number) => void,
  hearer?: Hearer | null
): Promise<VoiceReport> {
  const report: VoiceReport = { made: 0, kept: 0, failed: [], heard: 0, redone: 0, doubtful: [] };
  const tts = new Sidecar();
  try {
    // A line placed `after` another moves once that one has its voice, and may then fall
    // after an emotion it fell before: speak again what that leaves without audio.
    for (let pass = 0; pass < 3; pass++) {
      const skip = new Set(report.failed.map((f) => f.line.key));
      const r = await speak(tts, root, project, shots, skip, onLine);
      if (pass === 0) report.kept = r.kept;
      report.made += r.made;
      report.failed.push(...r.failed);
      if (!r.made) break;
    }
    // The lines are spoken and saved by now: hearing that fails costs the check, not them.
    try {
      const hear = hearer === undefined ? await whisperHearer() : (hearer ?? undefined);
      if (hear) await listen(tts, hear, root, project, shots, report);
      else report.unheard = true;
    } catch (e) {
      report.unheard = true;
      report.hearError = (e as Error).message;
    }
  } finally {
    tts.close();
  }
  return report;
}

/** The voice sidecar, started on the first line it is asked for. */
class Sidecar {
  private proc?: ChildProcessWithoutNullStreams;
  private answers?: AsyncIterator<string>;
  private stderr = '';

  private async start(): Promise<void> {
    const { cmd, args, shell } = ttsCommand();
    const proc = spawn(cmd, args, { shell, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.stderr.on('data', (d) => (this.stderr = (this.stderr + d).slice(-4000)));
    await new Promise<void>((resolve, reject) => {
      proc.on('spawn', resolve);
      proc.on('error', (e) =>
        reject(
          new Error(
            `the voice sidecar did not start (${e.message}). It needs uv (https://docs.astral.sh/uv/) and, for Hindi, espeak-ng (brew install espeak-ng)`
          )
        )
      );
    });
    this.proc = proc;
    this.answers = createInterface({ input: proc.stdout })[Symbol.asyncIterator]();
  }

  /** Ask for one line: the sidecar's answer. */
  async say(req: object): Promise<{ ok: boolean; error?: string; pitched?: boolean }> {
    if (!this.proc) await this.start();
    this.proc!.stdin.write(JSON.stringify(req) + '\n');
    const next = await this.answers!.next();
    if (next.done)
      throw new Error(
        `the voice sidecar stopped: ${this.stderr.trim().split('\n').slice(-5).join('\n')}`
      );
    return JSON.parse(next.value);
  }

  close(): void {
    this.proc?.stdin.end();
  }
}

/**
 * Say a line (take 1, or a later take, which the sidecar seeds differently) into
 * audio/voices/<file>: its index entry, or the error.
 */
async function sayLine(
  tts: Sidecar,
  voicesDir: string,
  line: Line,
  file: string,
  take: number
): Promise<VoiceEntry | { error: string }> {
  const raw = path.join(voicesDir, `${line.key}.raw.wav`);
  const answer = await tts.say({
    engine: line.voice.engine,
    voice: line.voice.name,
    text: line.text.trim(),
    speed: line.voice.speed,
    pitch: line.voice.pitch,
    emotion: line.emotion,
    style: line.style,
    out: raw,
    // The first take is seeded by the line alone, so it stays as it always was.
    ...(take > 1 ? { take } : {}),
  });
  if (!answer.ok) return { error: answer.error ?? 'failed' };
  // An engine that copies a voice from a recording has the pitch already.
  const chain = [...TRIM, ...(answer.pitched ? [] : pitchChain(line.voice.pitch))].join(',');
  const samples = level(await decode(raw, 1, 'ffmpeg', chain));
  await encode(samples, path.join(voicesDir, file));
  await rm(raw, { force: true });
  const bytes = (await stat(path.join(voicesDir, file))).size;
  return {
    file,
    voice: `${line.voice.engine}:${line.voice.name}`,
    speed: line.voice.speed,
    pitch: line.voice.pitch,
    emotion: line.emotion,
    style: line.style,
    text: line.text.trim(),
    duration: Math.round((samples.length / RATE) * 1000) / 1000,
    envelope: envelope(samples).toString('base64'),
    ...(take > 1 ? { take } : {}),
    bytes,
  };
}

async function speak(
  tts: Sidecar,
  root: string,
  project: Project,
  shots: Shot[],
  skip: Set<string>,
  onLine?: (done: number, total: number) => void
): Promise<Pick<VoiceReport, 'made' | 'kept' | 'failed'>> {
  const dir = projectPaths(root).audio;
  const voicesDir = path.join(dir, 'voices');
  const index = await readVoiceIndex(dir);
  const lines = voiceLines(project, shots);
  const todo = [...new Map(lines.map((l) => [l.key, l])).values()].filter(
    (l) =>
      !skip.has(l.key) && !(index[l.key] && existsSync(path.join(voicesDir, index[l.key].file)))
  );
  const report = { made: 0, kept: lines.length - todo.length, failed: [] as VoiceReport['failed'] };
  if (!todo.length) return report;
  await mkdir(voicesDir, { recursive: true });
  try {
    for (const [i, line] of todo.entries()) {
      const entry = await sayLine(tts, voicesDir, line, `${line.key}.ogg`, 1);
      if ('error' in entry) {
        report.failed.push({ line, error: entry.error });
        continue;
      }
      index[line.key] = entry;
      report.made++;
      onLine?.(i + 1, todo.length);
    }
  } finally {
    await writeFile(voiceIndexPath(dir), JSON.stringify(sortKeys(index), null, 1) + '\n');
  }
  await refresh(dir, project, shots);
  return report;
}

/** Read the lines again, and time again what follows them. */
async function refresh(dir: string, project: Project, shots: Shot[]): Promise<void> {
  project.audio = await loadAudio(dir);
  for (const shot of new Set([...project.shots, ...shots])) timeActions(project, shot);
}

/**
 * Hear every take in these shots not heard yet, and say again each line whose take does
 * not say it (a skipped word, babble, a garbled stretch: engine/speech.ts), up to
 * MAX_TAKES in all, keeping the best take. A line no take says is marked `doubt`, which
 * `talekit check` reports as `speech.mismatch`.
 */
async function listen(
  tts: Sidecar,
  hear: Hearer,
  root: string,
  project: Project,
  shots: Shot[],
  report: VoiceReport
): Promise<void> {
  const dir = projectPaths(root).audio;
  const voicesDir = path.join(dir, 'voices');
  const index = await readVoiceIndex(dir);
  const lines = [...new Map(voiceLines(project, shots).map((l) => [l.key, l])).values()].filter(
    (l) => index[l.key] && existsSync(path.join(voicesDir, index[l.key].file))
  );
  const fresh = lines.filter((l) => index[l.key].heard === undefined);
  const lang = (l: Line) => speechLanguage(l.voice.name);
  /** What each of these files says of its line: heard whole, then in pieces if it seems wrong. */
  const judge = async (items: { line: Line; file: string }[]) => {
    const takes = items.map((x) => ({ file: path.join(voicesDir, x.file), lang: lang(x.line) }));
    const heard = await hear(takes);
    const out = items.map((x, i) => ({ heard: heard[i], match: matchTake(x.line.text, heard[i]) }));
    const wrong = out.flatMap((o, i) => (badTake(items[i].line.text, o.match) ? [i] : []));
    if (wrong.length) {
      const again = await hear(
        wrong.map((i) => takes[i]),
        true
      );
      wrong.forEach((i, k) => {
        const match = matchTake(items[i].line.text, again[k]);
        if (takeScore(match) < takeScore(out[i].match)) out[i] = { heard: again[k], match };
      });
    }
    return out;
  };
  const wrong = (l: Line) => badTake(l.text, index[l.key].match!);
  /** A take as talekit made it, which it may say again over; one changed by hand it keeps. */
  const ours = (l: Line) => {
    const e = index[l.key];
    return e.bytes !== undefined && statSync(path.join(voicesDir, e.file)).size === e.bytes;
  };
  try {
    if (fresh.length) {
      const first = await judge(fresh.map((line) => ({ line, file: index[line.key].file })));
      report.heard += fresh.length;
      fresh.forEach((line, i) => Object.assign(index[line.key], first[i]));
    }
    // Every heard take judged again as the check is now, not as it was when it was heard.
    for (const l of lines) {
      const e = index[l.key];
      if (e.heard !== undefined) e.match = matchTake(l.text, e.heard);
    }
    let bad = lines.filter((l) => index[l.key].heard !== undefined && wrong(l));
    for (let round = 0; bad.length && round < MAX_TAKES; round++) {
      const tries: { line: Line; file: string; entry: VoiceEntry }[] = [];
      for (const line of bad) {
        const take = (index[line.key].take ?? 1) + 1;
        if (take > MAX_TAKES || !SAMPLED.has(line.voice.engine) || !ours(line)) continue;
        const file = `${line.key}.take${take}.ogg`;
        const entry = await sayLine(tts, voicesDir, line, file, take);
        if ('error' in entry) continue;
        // Counted as tried, whether or not it is kept.
        index[line.key].take = take;
        tries.push({ line, file, entry });
      }
      if (!tries.length) break;
      let heard: Awaited<ReturnType<typeof judge>>;
      try {
        heard = await judge(tries);
      } catch (e) {
        // Unheard, a retake is no take: its file goes and its turn is given back.
        for (const t of tries) {
          await rm(path.join(voicesDir, t.file), { force: true });
          index[t.line.key].take = t.entry.take! - 1 > 1 ? t.entry.take! - 1 : undefined;
        }
        throw e;
      }
      bad = [];
      for (const [i, t] of tries.entries()) {
        const best = index[t.line.key];
        if (takeScore(heard[i].match) < takeScore(best.match!)) {
          await rename(path.join(voicesDir, t.file), path.join(voicesDir, best.file));
          Object.assign(best, { ...t.entry, file: best.file, ...heard[i], take: t.entry.take });
          report.redone++;
        } else await rm(path.join(voicesDir, t.file), { force: true });
        if (wrong(t.line)) bad.push(t.line);
      }
    }
    for (const line of lines)
      if (index[line.key].heard !== undefined && wrong(line))
        report.doubtful.push({
          line,
          heard: index[line.key].heard!,
          takes: index[line.key].take ?? 1,
          byHand: SAMPLED.has(line.voice.engine) && !ours(line),
        });
  } finally {
    await writeFile(voiceIndexPath(dir), JSON.stringify(sortKeys(index), null, 1) + '\n');
  }
  await refresh(dir, project, shots);
}

const sortKeys = <T>(o: Record<string, T>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
