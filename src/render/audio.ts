import { spawn } from 'node:child_process';
import path from 'node:path';
import { cueSheet, type Bus, type Cue } from '../engine/sound.js';
import type { Source } from '../engine/sources.js';
import type { Project, Shot } from '../engine/types.js';
import { SOUNDS, SOUNDS_DIR } from '../library/sounds.js';

/** Samples per second of the mix (and of every clip, resampled by ffmpeg as it decodes). */
export const RATE = 48000;

/** Beds are stereo recordings and play as they are; a point source is mono and panned. */
const STEREO: Record<Bus, boolean> = { music: true, ambience: true, sfx: false, voice: false };
/** Seconds of crossfade where a bed loops back to its start. */
const LOOP_JOIN = 0.6;
/**
 * Music and ambience under a voice: how far down, how fast they go and come back, and the
 * longest gap between two lines they stay down through, so they do not swell up between
 * every line of a conversation.
 */
const DUCK = { music: 0.3, ambience: 0.5, attack: 0.25, release: 0.8, hold: 1.5 };

/** ffmpeg filters a cue's treatment adds as it is decoded. */
const FX: Record<NonNullable<Cue['fx']>, string> = {
  // An inner voice: a little room around it and the edges taken off.
  thought: 'highpass=f=140,lowpass=f=6500,aecho=0.85:0.6:45|75:0.28|0.16',
};

export function sourcePath(project: Project, src: Source): string {
  if ('lib' in src) return path.join(SOUNDS_DIR, SOUNDS[src.lib].file);
  if ('voice' in src) {
    if (!project.audio) throw new Error(`voice '${src.voice}' needs the project loaded from disk`);
    return path.join(project.audio.dir, 'voices', src.voice);
  }
  if (!project.audio)
    throw new Error(`sound file '${src.file}' needs the project loaded from disk`);
  return path.join(project.audio.dir, src.file);
}

/** Decode a clip to interleaved float samples at RATE. */
export function decode(
  file: string,
  channels: number,
  ffmpeg = 'ffmpeg',
  filters?: string
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const af = filters ? ['-af', filters] : [];
    const ff = spawn(
      ffmpeg,
      [
        '-v',
        'error',
        '-i',
        file,
        ...af,
        '-f',
        'f32le',
        '-ac',
        String(channels),
        '-ar',
        String(RATE),
        '-',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const chunks: Buffer[] = [];
    let stderr = '';
    ff.stdout.on('data', (d: Buffer) => chunks.push(d));
    ff.stderr.on('data', (d) => (stderr += d));
    ff.on('error', (e) => reject(new Error(`ffmpeg failed to start: ${e.message}`)));
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`could not decode ${file}: ${stderr.trim()}`));
      const all = Buffer.concat(chunks);
      // Copied out, as a Buffer from the pool need not be 4-byte aligned.
      resolve(new Float32Array(all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength)));
    });
  });
}

/** 0 to 1 and back over each end of a bed, on a quarter sine so the joins are smooth. */
function fadeGain(i: number, len: number, fadeIn: number, fadeOut: number): number {
  let g = 1;
  if (i < fadeIn) g *= Math.sin(((i / fadeIn) * Math.PI) / 2);
  if (i > len - fadeOut) g *= Math.sin((Math.max(0, len - i) / fadeOut) * (Math.PI / 2));
  return g;
}

/** How far music and ambience are pulled down at each sample, from when the voices play. */
function duckCurve(spans: [number, number][], total: number): Float32Array {
  const d = new Float32Array(total);
  const attack = DUCK.attack * RATE;
  const release = DUCK.release * RATE;
  const held: [number, number][] = [];
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    const last = held.at(-1);
    if (last && a - last[1] < DUCK.hold * RATE) last[1] = Math.max(last[1], b);
    else held.push([a, b]);
  }
  for (const [a, b] of held) {
    const from = Math.max(0, Math.floor(a - attack));
    const to = Math.min(total, Math.ceil(b + release));
    for (let i = from; i < to; i++) {
      const v = i < a ? 1 - (a - i) / attack : i > b ? 1 - (i - b) / release : 1;
      if (v > d[i]) d[i] = v;
    }
  }
  return d;
}

/** Above this the mix is rounded off rather than clipped. */
const KNEE = 0.85;
const soft = (x: number) => {
  const m = Math.abs(x);
  if (m <= KNEE) return x;
  return Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((m - KNEE) / (1 - KNEE)));
};

export interface MixOptions {
  ffmpegPath?: string;
  /** Length of the mix in seconds; default the shots' total. */
  seconds?: number;
  /** Mix only these buses (still ducked under every voice): one layer of the sound on its own. */
  buses?: Bus[];
  /**
   * Leave spoken lines out: 'none' every one, 'narrator' all but the narrator's. Unlike a
   * bus left out, a line left out does not duck the rest: there is nothing to make room for.
   */
  voices?: 'none' | 'narrator';
}

/**
 * Mix these shots' sound to interleaved stereo float samples at RATE, or undefined when
 * there is nothing to hear. Deterministic: the same clips give the same samples.
 */
export async function mixAudio(
  project: Project,
  shots: Shot[] = project.shots,
  opts: MixOptions = {}
): Promise<Float32Array | undefined> {
  const sheet = cueSheet(project, shots);
  const all =
    opts.voices === 'none'
      ? sheet.filter((c) => c.bus !== 'voice')
      : opts.voices === 'narrator'
        ? sheet.filter((c) => c.bus !== 'voice' || c.narrator)
        : sheet;
  if (!all.length) return undefined;
  const cues = opts.buses ? all.filter((c) => opts.buses!.includes(c.bus)) : all;
  const ffmpeg = opts.ffmpegPath ?? 'ffmpeg';
  const seconds = opts.seconds ?? shots.reduce((s, x) => s + x.duration, 0);
  const total = Math.round(seconds * RATE);

  const clips = new Map<string, Float32Array>();
  const key = (c: Cue) => `${STEREO[c.bus] ? 2 : 1}|${c.fx ?? ''}|${sourcePath(project, c.src)}`;
  await Promise.all(
    [...new Set(cues.map(key))].map(async (k) => {
      const [ch, fx, file] = k.split('|');
      const filters = fx ? FX[fx as keyof typeof FX] : undefined;
      clips.set(k, await decode(file, Number(ch), ffmpeg, filters));
    })
  );

  // A voice left out of this mix still ducks it, for as long as its clip is.
  const spans: [number, number][] = all
    .filter((c) => c.bus === 'voice')
    .map((c) => [c.at * RATE, c.at * RATE + (clips.get(key(c))?.length ?? c.length! * RATE)]);
  const duck = duckCurve(spans, total);

  const out = new Float32Array(total * 2);
  for (const c of cues) {
    const clip = clips.get(key(c))!;
    const stereo = STEREO[c.bus];
    const frames = stereo ? clip.length / 2 : clip.length;
    if (!frames) continue;
    const s0 = Math.round(c.at * RATE);
    const len = c.until !== undefined ? Math.round((c.until - c.at) * RATE) : frames;
    const fadeIn = (c.fadeIn ?? 0) * RATE;
    const fadeOut = (c.fadeOut ?? 0) * RATE;
    // Equal-power pan for a mono source.
    const angle = ((c.pan + 1) * Math.PI) / 4;
    // A stereo bed leans toward its side instead.
    const [pl, pr] = stereo
      ? [Math.min(1, 1 - c.pan), Math.min(1, 1 + c.pan)]
      : [Math.cos(angle), Math.sin(angle)];
    const level = c.level;
    let li = 0;
    const depth = c.bus === 'music' ? DUCK.music : c.bus === 'ambience' ? DUCK.ambience : 1;
    // A bed longer than its clip loops, each pass laid over the last one's tail.
    const join = Math.min(Math.round(LOOP_JOIN * RATE), Math.floor(frames / 4));
    const period = frames - join;
    const step = stereo ? 2 : 1;
    const right = stereo ? 1 : 0;
    const looped = c.until !== undefined && len > frames;
    for (let i = Math.max(0, -s0); i < len; i++) {
      const o = s0 + i;
      if (o >= total) break;
      let j = i;
      let w = 1;
      let tail = -1;
      if (looped) {
        const pass = Math.floor(i / period);
        j = i - pass * period;
        // Each pass fades in over the previous one's last `join` samples.
        if (pass > 0 && j < join) {
          w = j / join;
          tail = (j + period) * step;
        }
      } else if (i >= frames) break;
      const k = j * step;
      let l = clip[k] * w;
      let r = clip[k + right] * w;
      if (tail >= 0) {
        l += clip[tail] * (1 - w);
        r += clip[tail + right] * (1 - w);
      }
      let g = c.gain * fadeGain(i, len, fadeIn, fadeOut);
      if (level) {
        const t = o / RATE;
        while (li < level.length - 2 && level[li + 1][0] <= t) li++;
        const [t0, g0] = level[li];
        const [t1, g1] = level[Math.min(li + 1, level.length - 1)];
        g *= t1 > t0 ? g0 + (g1 - g0) * Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : g1;
      }
      if (depth < 1) g *= 1 - (1 - depth) * duck[o];
      out[2 * o] += l * g * pl;
      out[2 * o + 1] += r * g * pr;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = soft(out[i]);
  return out;
}
