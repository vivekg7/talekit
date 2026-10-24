import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { Project, Shot } from '../engine/types.js';
import { ENVELOPE_RATE, voiceLines, type Line } from '../engine/voice.js';
import { decode, RATE } from '../render/audio.js';
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

/**
 * Speak every line in these shots that has no audio yet, into audio/voices/, and record it
 * in the index. The project's `audio` is refreshed, so timings read the new lines at once.
 * Throws when the sidecar cannot start; a line the model fails on is reported, not thrown.
 */
export async function makeVoices(
  root: string,
  project: Project,
  shots: Shot[] = project.shots,
  onLine?: (done: number, total: number) => void
): Promise<VoiceReport> {
  const dir = projectPaths(root).audio;
  const voicesDir = path.join(dir, 'voices');
  const index = await readVoiceIndex(dir);
  const lines = voiceLines(project, shots);
  const todo = [...new Map(lines.map((l) => [l.key, l])).values()].filter(
    (l) => !(index[l.key] && existsSync(path.join(voicesDir, index[l.key].file)))
  );
  const report: VoiceReport = { made: 0, kept: lines.length - todo.length, failed: [] };
  if (!todo.length) return report;
  await mkdir(voicesDir, { recursive: true });

  const { cmd, args, shell } = ttsCommand();
  const tts = spawn(cmd, args, { shell, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  tts.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
  const started = new Promise<void>((resolve, reject) => {
    tts.on('spawn', resolve);
    tts.on('error', (e) =>
      reject(
        new Error(
          `the voice sidecar did not start (${e.message}). It needs uv (https://docs.astral.sh/uv/) and, for Hindi, espeak-ng (brew install espeak-ng)`
        )
      )
    );
  });
  await started;
  const answers = createInterface({ input: tts.stdout })[Symbol.asyncIterator]();
  const raw = (l: Line) => path.join(voicesDir, `${l.key}.raw.wav`);

  try {
    for (const [i, line] of todo.entries()) {
      tts.stdin.write(
        JSON.stringify({
          engine: line.voice.engine,
          voice: line.voice.name,
          text: line.text.trim(),
          speed: line.voice.speed,
          pitch: line.voice.pitch,
          emotion: line.emotion,
          style: line.style,
          out: raw(line),
        }) + '\n'
      );
      const next = await answers.next();
      if (next.done)
        throw new Error(
          `the voice sidecar stopped: ${stderr.trim().split('\n').slice(-5).join('\n')}`
        );
      const answer = JSON.parse(next.value) as { ok: boolean; error?: string; pitched?: boolean };
      if (!answer.ok) {
        report.failed.push({ line, error: answer.error ?? 'failed' });
        continue;
      }
      const file = `${line.key}.ogg`;
      // An engine that copies a voice from a recording has the pitch already.
      const chain = [...TRIM, ...(answer.pitched ? [] : pitchChain(line.voice.pitch))].join(',');
      const samples = level(await decode(raw(line), 1, 'ffmpeg', chain));
      await encode(samples, path.join(voicesDir, file));
      await rm(raw(line), { force: true });
      const entry: VoiceEntry = {
        file,
        voice: `${line.voice.engine}:${line.voice.name}`,
        speed: line.voice.speed,
        pitch: line.voice.pitch,
        emotion: line.emotion,
        style: line.style,
        text: line.text.trim(),
        duration: Math.round((samples.length / RATE) * 1000) / 1000,
        envelope: envelope(samples).toString('base64'),
      };
      index[line.key] = entry;
      report.made++;
      onLine?.(i + 1, todo.length);
    }
  } finally {
    tts.stdin.end();
    await writeFile(voiceIndexPath(dir), JSON.stringify(sortKeys(index), null, 1) + '\n');
  }
  project.audio = await loadAudio(dir);
  return report;
}

const sortKeys = <T>(o: Record<string, T>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
