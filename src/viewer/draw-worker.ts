import { createHash } from 'node:crypto';
import { setImmediate as turn } from 'node:timers/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import { parentPort } from 'node:worker_threads';
import { composeFrame } from '../engine/compose.js';
import { cueSheet, type Bus } from '../engine/sound.js';
import type { Project } from '../engine/types.js';
import { lintCharacter } from '../project/construction.js';
import { loadProject } from '../project/store.js';
import { formatProblems, validateProject } from '../project/validate.js';
import {
  characterSheetSvg,
  constructionSheetSvg,
  sceneSheetSvg,
  sheetTarget,
  type SheetKind,
} from '../render/sheets.js';

/**
 * The review app's pictures (frames, pose, construction and anchor sheets) and its slow
 * reads (the checks' report, the film's sounds). Done in a worker so an engine change shows
 * without a restart (a fresh worker imports the new code, see `ask` in server.ts), and so
 * the server keeps answering while a check takes seconds.
 */
export type DrawRequest = { root: string; /** option choices laid over it */ over: string[] } & (
  | { kind: 'frame'; shot: string; t: number; debug: boolean }
  | { kind: 'sheet'; id: string; of?: SheetKind; construction: boolean }
  | { kind: 'problems' }
  | { kind: 'stems' }
);
/** `version`: the project's files as they now are (`projectVersion` in server.ts). */
type DrawJob = DrawRequest & { version: number; seq: number };

/** The buses the film sounds on, mixed one by one for the page's sliders. */
export const STEMS: Bus[] = ['voice', 'music', 'ambience', 'sfx'];
export interface Stems {
  /** The cue sheet's hash: the same sound is mixed once (server.ts `makeStem`). */
  key: string;
  buses: Bus[];
}

/** A project's sound at the engine's levels, without its `mix`: the sliders set that live. */
export const bare = (project: Project): Project => ({
  ...project,
  meta: { ...project.meta, mix: undefined },
});

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

/**
 * The checking worker reads every film and reel served, one after another, so it keeps
 * only the last: the sound and the report are asked for together, and a film's engine
 * caches are let go with it.
 */
let last: { key: string; version: number; project: Promise<Project> } | undefined;
function checkedProject(job: DrawJob): Promise<Project> {
  const key = job.root + '\0' + job.over.join('\0');
  if (last?.key === key && last.version === job.version) return last.project;
  const project = loadProject(job.root, job.over);
  last = { key, version: job.version, project };
  project.catch(() => last?.project === project && (last = undefined));
  return project;
}

/**
 * The checks' report. The character linter rasterises every piece of every part, and
 * resvg's pictures live outside the JS heap, freed by finalisers that run only after V8
 * collects their small wrappers and the event loop turns; linted in one go, a reel's cast
 * held 3.5 GB at once. A character at a time, each followed by a young-generation sweep and
 * a turn (as frame-worker.ts does after each frame), holds about one's worth: 0.6 GB.
 */
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as (o: { type: 'minor' }) => void;
async function problemsOf(project: Project): Promise<string> {
  for (const c of Object.values(project.characters)) {
    lintCharacter(c);
    gc({ type: 'minor' });
    await turn();
  }
  return formatProblems(validateProject(project));
}

function stemsOf(project: Project): Stems {
  const cues = cueSheet(bare(project));
  if (!cues.length) return { key: '', buses: [] };
  const key = createHash('sha1').update(JSON.stringify(cues)).digest('hex').slice(0, 16);
  return { key, buses: STEMS.filter((b) => cues.some((c) => c.bus === b)) };
}

async function draw(job: DrawJob): Promise<string | Stems> {
  if (job.kind === 'problems') return problemsOf(await checkedProject(job));
  if (job.kind === 'stems') return stemsOf(await checkedProject(job));
  const project = await projectOf(job);
  if (job.kind === 'frame') {
    const shot = project.shots.find((s) => s.id === job.shot);
    if (!shot) throw new Error('unknown shot');
    return composeFrame(project, shot, job.t, { debug: job.debug });
  }
  const target = sheetTarget(project, job.id, job.of);
  if (target.kind === 'scene') return sceneSheetSvg(project, target.scene);
  const { character } = target;
  return job.construction ? constructionSheetSvg(character) : characterSheetSvg(character);
}

parentPort?.on('message', (job: DrawJob) => {
  draw(job).then(
    (result) => parentPort!.postMessage({ seq: job.seq, result }),
    (e: Error) => parentPort!.postMessage({ seq: job.seq, error: e.message })
  );
});
