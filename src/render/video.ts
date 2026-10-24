import { spawn } from 'node:child_process';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { Project, Shot } from '../engine/types.js';
import { mixAudio, RATE } from './audio.js';

export interface RenderOptions {
  outPath: string;
  /** Render only these shots (in project order). Default: all. */
  shots?: Shot[];
  onProgress?: (done: number, total: number) => void;
  ffmpegPath?: string;
  /** Worker threads drawing frames. Default: all cores but two (ffmpeg needs them), up to 8, past which the encoder is the bottleneck. */
  workers?: number;
  /** Leave the sound out. */
  silent?: boolean;
}

/** The worker beside this file, as .ts under tsx and .js once built. */
const WORKER = new URL(
  `./frame-worker${path.extname(fileURLToPath(import.meta.url))}`,
  import.meta.url
);

/**
 * Render the shots to an H.264 mp4. Frames are drawn by a pool of worker threads, each
 * composing and rasterising whole frames, and streamed into ffmpeg in order as raw RGBA.
 * At most two frames per worker are in flight, which bounds memory however long the film.
 * The sound is mixed first, to the frames' exact length, and muxed as AAC; a film with
 * nothing to hear gets no audio track.
 */
export async function renderVideo(
  project: Project,
  opts: RenderOptions
): Promise<{ frames: number; seconds: number }> {
  const shots = opts.shots ?? project.shots;
  const { fps, width, height } = project.meta;
  const plan: { shot: number; t: number }[] = [];
  shots.forEach((shot, i) => {
    const count = Math.max(1, Math.round(shot.duration * fps));
    for (let f = 0; f < count; f++) plan.push({ shot: i, t: f / fps });
  });
  await mkdir(path.dirname(opts.outPath), { recursive: true });

  const audio = opts.silent
    ? undefined
    : await mixAudio(project, shots, { ffmpegPath: opts.ffmpegPath, seconds: plan.length / fps });
  const audioPath = `${opts.outPath}.audio.f32`;
  if (audio) await writeFile(audioPath, new Uint8Array(audio.buffer));
  const audioIn = audio ? ['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', audioPath] : [];
  const audioOut = audio ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : [];

  const ff = spawn(
    opts.ffmpegPath ?? 'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-framerate',
      String(fps),
      '-i',
      '-',
      ...audioIn,
      ...audioOut,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      opts.outPath,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let stderr = '';
  ff.stderr.on('data', (d) => (stderr += d));
  // The first failure wins: a spawn error (ffmpeg missing), an EPIPE on stdin (ffmpeg
  // died mid-stream), a worker's error or a non-zero exit. Everything waiting on frames
  // checks it, so a failure surfaces as a thrown error rather than an unhandled rejection.
  let failure: Error | undefined;
  let wake = () => {};
  const fail = (e: Error) => {
    failure ??= e;
    wake();
  };
  ff.stdin.on('error', fail);
  const done = new Promise<void>((resolve, reject) => {
    ff.on('error', (e) => {
      fail(
        new Error(`ffmpeg failed to start: ${e.message}. Install ffmpeg (brew install ffmpeg).`)
      );
      reject(failure);
    });
    ff.on('close', (code) => {
      if (code !== 0) fail(new Error(`ffmpeg exited with ${code}: ${stderr}`));
      failure ? reject(failure) : resolve();
    });
  });
  done.catch(() => {});

  const count = Math.max(
    1,
    Math.min(opts.workers ?? Math.min(8, os.availableParallelism() - 2), plan.length)
  );
  const data = { project: { ...project, shots } };
  const pool = Array.from({ length: count }, () => new Worker(WORKER, { workerData: data }));
  const ready = new Map<number, Buffer>();
  for (const w of pool) {
    w.on('message', (m: { seq: number; pixels?: Uint8Array; error?: string }) => {
      if (m.error) return fail(new Error(`frame ${m.seq}: ${m.error}`));
      const px = m.pixels!;
      ready.set(m.seq, Buffer.from(px.buffer, px.byteOffset, px.byteLength));
      wake();
    });
    w.on('error', fail);
  }

  try {
    let sent = 0;
    let written = 0;
    const send = () => {
      for (; sent < plan.length && sent < written + 2 * count; sent++)
        pool[sent % count].postMessage({ seq: sent, ...plan[sent] });
    };
    send();
    while (written < plan.length) {
      while (!ready.has(written) && !failure) await new Promise<void>((r) => (wake = r));
      if (failure) throw failure;
      const frame = ready.get(written)!;
      ready.delete(written);
      if (!ff.stdin.write(frame))
        await Promise.race([new Promise((r) => ff.stdin.once('drain', r)), done]);
      written++;
      send();
      if (written % 12 === 0 || written === plan.length) opts.onProgress?.(written, plan.length);
    }
  } catch (e) {
    // Not left waiting on a stream that will never end.
    ff.kill();
    throw e;
  } finally {
    await Promise.all(pool.map((w) => w.terminate()));
    if (failure && audio) await rm(audioPath, { force: true });
  }
  ff.stdin.end();
  try {
    await done;
  } finally {
    if (audio) await rm(audioPath, { force: true });
  }
  return { frames: plan.length, seconds: plan.length / fps };
}

/** Run ffmpeg to the end; resolves with what it printed, whatever its exit code. */
export function runFfmpeg(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ff = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (d) => (stderr += d));
    ff.on('error', (e) => reject(new Error(`ffmpeg failed to start: ${e.message}`)));
    ff.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/**
 * The seconds these shots last as frames, checked against a film already rendered from
 * them: anything built on that film (a new mix, the .mkv) must still be these shots.
 */
export async function checkLength(
  project: Project,
  shots: Shot[],
  file: string,
  bin: string
): Promise<number> {
  const { fps } = project.meta;
  const frames = shots.reduce((n, s) => n + Math.max(1, Math.round(s.duration * fps)), 0);
  const seconds = frames / fps;
  const probe = /Duration: (\d+):(\d+):([\d.]+)/.exec((await runFfmpeg(bin, ['-i', file])).stderr);
  if (!probe) throw new Error(`${file} is not a film ffmpeg can read`);
  const length = Number(probe[1]) * 3600 + Number(probe[2]) * 60 + Number(probe[3]);
  if (Math.abs(length - seconds) > 0.1)
    throw new Error(
      `${file} is ${length.toFixed(2)}s and the shots are ${seconds.toFixed(2)}s: render it again`
    );
  return seconds;
}

/**
 * Put a new mix under a film already rendered, without drawing a frame again: for a change
 * of balance (the project's `mix`), which only the ears can judge and so takes several goes.
 * The film must still be these shots: its length is checked against theirs.
 */
export async function remixVideo(
  project: Project,
  file: string,
  opts: { shots?: Shot[]; ffmpegPath?: string } = {}
): Promise<{ seconds: number }> {
  const bin = opts.ffmpegPath ?? 'ffmpeg';
  const shots = opts.shots ?? project.shots;
  const seconds = await checkLength(project, shots, file, bin);

  const audio = await mixAudio(project, shots, { ffmpegPath: bin, seconds });
  const audioPath = `${file}.audio.f32`;
  const tmp = `${file}.remix.mp4`;
  if (audio) await writeFile(audioPath, new Uint8Array(audio.buffer));
  try {
    const r = await runFfmpeg(bin, [
      '-y',
      '-loglevel',
      'error',
      '-i',
      file,
      ...(audio ? ['-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', audioPath] : []),
      '-map',
      '0:v',
      ...(audio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : []),
      '-c:v',
      'copy',
      '-movflags',
      '+faststart',
      tmp,
    ]);
    if (r.code !== 0) throw new Error(`ffmpeg exited with ${r.code}: ${r.stderr}`);
    await rename(tmp, file);
  } finally {
    await rm(audioPath, { force: true });
    await rm(tmp, { force: true });
  }
  return { seconds };
}
