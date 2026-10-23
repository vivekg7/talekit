import v8 from 'node:v8';
import vm from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';
import { composeFrame } from '../engine/compose.js';
import type { Project } from '../engine/types.js';
import { rasterizePixels } from './raster.js';

/**
 * One of renderVideo's workers: it holds its own copy of the project and draws the frames
 * it is sent, composing and rasterising both, so neither waits on the main thread.
 */
const project = workerData.project as Project;

/**
 * resvg's frames live outside the JS heap, held by small wrappers, so V8 sees almost no
 * memory in use and seldom collects: unchecked, each worker keeps every frame it drew,
 * gigabytes over a film. So frames are drawn one at a time, and after each, once nothing
 * refers to it any more, a quick young-generation sweep lets it go; its finalisers run on
 * the turn before the next frame starts.
 */
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as (o: { type: 'minor' }) => void;

interface Job {
  seq: number;
  shot: number;
  t: number;
}

function draw({ seq, shot, t }: Job): void {
  try {
    const { pixels, width, height } = rasterizePixels(
      composeFrame(project, project.shots[shot], t)
    );
    if (width !== project.meta.width || height !== project.meta.height)
      throw new Error(
        `frame is ${width}x${height}, not ${project.meta.width}x${project.meta.height}`
      );
    // resvg's buffer lives outside the JS heap and cannot be handed over; copied, once.
    parentPort!.postMessage({ seq, pixels });
  } catch (e) {
    parentPort!.postMessage({ seq, error: (e as Error).stack ?? String(e) });
  }
}

const queue: Job[] = [];
let busy = false;

function next(): void {
  const job = queue.shift();
  busy = !!job;
  if (!job) return;
  draw(job);
  gc({ type: 'minor' });
  setImmediate(next);
}

parentPort!.on('message', (job: Job) => {
  queue.push(job);
  if (!busy) next();
});
