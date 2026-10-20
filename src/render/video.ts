import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { composeFrame } from '../engine/compose.js';
import type { Project, Shot } from '../engine/types.js';
import { rasterizeAsync } from './raster.js';

export interface RenderOptions {
  outPath: string;
  /** Render only these shots (in project order). Default: all. */
  shots?: Shot[];
  onProgress?: (done: number, total: number) => void;
  ffmpegPath?: string;
}

/** Render the shots to an H.264 mp4 by streaming PNG frames into ffmpeg. */
export async function renderVideo(
  project: Project,
  opts: RenderOptions
): Promise<{ frames: number; seconds: number }> {
  const shots = opts.shots ?? project.shots;
  const { fps } = project.meta;
  const plan: { shot: Shot; t: number }[] = [];
  for (const shot of shots) {
    const count = Math.max(1, Math.round(shot.duration * fps));
    for (let i = 0; i < count; i++) plan.push({ shot, t: i / fps });
  }
  await mkdir(path.dirname(opts.outPath), { recursive: true });

  const ff = spawn(
    opts.ffmpegPath ?? 'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-i',
      '-',
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
  // The first failure wins: a spawn error (ffmpeg missing), an EPIPE on stdin
  // (ffmpeg died mid-stream) or a non-zero exit. The frame loop checks it so a
  // dead ffmpeg surfaces as a thrown error rather than an unhandled rejection.
  let failure: Error | undefined;
  const fail = (e: Error) => (failure ??= e);
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

  const batch = Math.max(2, Math.min(8, os.cpus().length));
  const write = (buf: Buffer) =>
    new Promise<void>((resolve, reject) => {
      if (failure) return reject(failure);
      if (!ff.stdin.write(buf)) ff.stdin.once('drain', resolve);
      else resolve();
    });

  let rendered = 0;
  for (let i = 0; i < plan.length; i += batch) {
    const slice = plan.slice(i, i + batch);
    const pngs = await Promise.all(
      slice.map(({ shot, t }) => rasterizeAsync(composeFrame(project, shot, t)))
    );
    for (const png of pngs) await Promise.race([write(png), done]);
    rendered += slice.length;
    opts.onProgress?.(rendered, plan.length);
  }
  ff.stdin.end();
  await done;
  return { frames: plan.length, seconds: plan.length / fps };
}
