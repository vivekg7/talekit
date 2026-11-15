import { parentPort } from 'node:worker_threads';
import { composeFrame } from '../engine/compose.js';
import type { Project } from '../engine/types.js';
import { loadProject } from '../project/store.js';
import { characterSheetSvg, constructionSheetSvg, sceneSheetSvg } from '../render/sheets.js';

/**
 * The review app's pictures (a shot's frame, a pose, construction or anchor sheet) as SVG.
 * They are drawn here rather than in the server so that a change to the engine shows up
 * without restarting the app: the server starts a fresh worker, which imports the code as
 * it now is, whenever a source file changes (see `drawSvg` in server.ts).
 */
export type DrawRequest = { root: string; /** option choices laid over it */ over: string[] } & (
  | { kind: 'frame'; shot: string; t: number; debug: boolean }
  | { kind: 'sheet'; id: string; construction: boolean }
);
/** `version`: the project's files as they now are (`projectVersion` in server.ts). */
type DrawJob = DrawRequest & { version: number; seq: number };

/**
 * The project as loaded, kept until its files change. The engine keeps the work it does
 * once per shot (springs integrated over the whole shot, the staging it adds, where each
 * bubble goes, landings and wakes) in caches keyed by the project and its shots, so a
 * project read afresh for every frame starts each from nothing: a live frame of a busy
 * shot took 0.3 to 1.2 s that way, and takes 25 to 85 ms from the kept one.
 */
const KEPT = new Map<string, { version: number; project: Promise<Project> }>();
function projectOf(job: DrawJob): Promise<Project> {
  const key = job.root + '\0' + job.over.join('\0');
  const kept = KEPT.get(key);
  if (kept?.version === job.version) return kept.project;
  const project = loadProject(job.root, job.over);
  KEPT.set(key, { version: job.version, project });
  // One that failed to load (a file half written) is read again by the next picture.
  project.catch(() => KEPT.get(key)?.project === project && KEPT.delete(key));
  return project;
}

async function draw(job: DrawJob): Promise<string> {
  const project = await projectOf(job);
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
