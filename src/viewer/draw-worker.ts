import { parentPort } from 'node:worker_threads';
import { composeFrame } from '../engine/compose.js';
import { loadProject } from '../project/store.js';
import { characterSheetSvg, constructionSheetSvg, sceneSheetSvg } from '../render/sheets.js';

/**
 * The review app's pictures (a shot's frame, a pose, construction or anchor sheet) as SVG.
 * They are drawn here rather than in the server so that a change to the engine shows up
 * without restarting the app: the server starts a fresh worker, which imports the code as
 * it now is, whenever a source file changes (see `drawSvg` in server.ts).
 */
export type DrawRequest = { root: string } & (
  | { kind: 'frame'; shot: string; t: number; debug: boolean }
  | { kind: 'sheet'; id: string; construction: boolean }
);
type DrawJob = DrawRequest & { seq: number };

async function draw(job: DrawJob): Promise<string> {
  const project = await loadProject(job.root);
  if (job.kind === 'frame') {
    const shot = project.shots.find((s) => s.id === job.shot);
    if (!shot) throw new Error('unknown shot');
    return composeFrame(project, shot, job.t, { debug: job.debug });
  }
  const character = project.characters[job.id];
  if (character)
    return job.construction ? constructionSheetSvg(character) : characterSheetSvg(character);
  const scene = project.scenes[job.id];
  if (scene) return sceneSheetSvg(project, scene);
  throw new Error('unknown id');
}

parentPort!.on('message', (job: DrawJob) => {
  draw(job).then(
    (svg) => parentPort!.postMessage({ seq: job.seq, svg }),
    (e: Error) => parentPort!.postMessage({ seq: job.seq, error: e.message })
  );
});
