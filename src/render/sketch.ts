import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { composeFrame, type ComposeOptions } from '../engine/compose.js';
import { resolveCamera } from '../engine/timeline.js';
import type { Project, Shot, SketchFile } from '../engine/types.js';
import { Sketch, type SketchCamera, type SketchView } from '../sketch/p5.js';

/**
 * Sketches in frames: a shot's `sketch` (sketches/<id>.js, drawn with the API in
 * sketch/p5.ts) run frame by frame and handed to the engine as a picture on the stage
 * (compose.ts `canvas`), so everything that draws a frame (the film, previews, sheets, the
 * review app, covers) shows it.
 *
 * A sketch has state (a fluid, particles, a trail left on its canvas), so frame n is what
 * draw() leaves after its (n+1)th call: a frame is still a pure function of (project, shot,
 * t), but reached by running from the start. A run is kept and carried forward, so frames
 * asked for in order cost one draw() each; asking for an earlier one starts it again. A
 * sketch that splits `update` from `draw` is only drawn at the frames asked for.
 */

type SketchMain = (p: Sketch) => void;

/** Imported modules, by file and version: an edited sketch is imported afresh. */
const modules = new Map<string, SketchMain>();
const moduleKey = (f: SketchFile) => `${pathToFileURL(f.file).href}?v=${f.version}`;

/** The project's `sketches/` files as loaded: what store.ts records for each. */
export async function sketchFile(file: string): Promise<SketchFile> {
  return { file, version: Math.round((await stat(file)).mtimeMs) };
}

/**
 * Import the project's sketches, so frames can be drawn synchronously. Done when a project
 * is loaded, and by each render worker for its own copy.
 */
export async function loadSketches(project: Project): Promise<void> {
  for (const [id, f] of Object.entries(project.sketches ?? {})) {
    const key = moduleKey(f);
    if (modules.has(key)) continue;
    const mod = (await import(key)) as { default?: unknown };
    if (typeof mod.default !== 'function')
      throw new Error(
        `sketches/${id}.js: its default export must be a function, (p) => { p.setup = …; p.draw = … }`
      );
    modules.set(key, mod.default as SketchMain);
  }
}

interface Run {
  sketch: Sketch;
  frame: number;
  /** Names its pictures: a run started afresh (other params, another camera) never reuses one. */
  id: number;
  /** The shot's camera moves, once the code has read the camera: its pictures depend on them. */
  saw?: string;
  /** Where the camera is read from: the latest call's project and shot. */
  from: { project: Project; shot: Shot };
}

/** Kept runs, most recent last; few, as a fluid's fields at full size take ~100 MB. */
const runs = new Map<string, Run>();
const KEEP_RUNS = 3;
let started = 0;

/**
 * What the shot's camera depends on. A camera that follows someone goes where they walk, so
 * then the whole shot and its scene; otherwise only its moves.
 */
function cameraKey(project: Project, shot: Shot): string {
  const moves = [shot.camera, ...shot.actions.flatMap((a) => (a.camera ? [a] : []))];
  const follows = [shot.camera, ...shot.actions.map((a) => a.camera)].some((c) => c?.follow);
  return JSON.stringify(follows ? [shot, project.scenes[shot.scene]] : moves);
}

/**
 * The run's `camera` and `view`, worked out when the code reads them (a following camera
 * resolves the actor's path many times) and noted, so a camera edit starts the run afresh.
 */
function watchCamera(run: Run): void {
  let at: { time: number; camera: SketchCamera; view: SketchView } | undefined;
  const now = () => {
    const { time } = run.sketch;
    if (at?.time === time) return at;
    const { project, shot } = run.from;
    const { width: W, height: H } = project.meta;
    run.saw ??= cameraKey(project, shot);
    const scene = project.scenes[shot.scene];
    const c = scene ? resolveCamera(project, scene, shot, time) : { x: W / 2, y: H / 2, zoom: 1 };
    const camera = { x: c.x, y: c.y, zoom: c.zoom };
    const view = {
      x: c.x - W / 2 / c.zoom,
      y: c.y - H / 2 / c.zoom,
      width: W / c.zoom,
      height: H / c.zoom,
    };
    at = { time, camera, view };
    return at;
  };
  Object.defineProperty(run.sketch, 'camera', { get: () => now().camera });
  Object.defineProperty(run.sketch, 'view', { get: () => now().view });
}

/** A shot's params as one string, the same whatever order they were written in. */
const paramsKey = (shot: Shot) =>
  JSON.stringify(Object.entries(shot.sketchParams ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));

/** The frame of a shot a time falls in. */
export const sketchFrameAt = (project: Project, t: number): number =>
  Math.max(0, Math.floor(t * project.meta.fps + 1e-6));

/**
 * The shot's sketch as drawn at t (canvas pixels: `density` per design pixel). Throws with
 * the sketch's own stack when its code does.
 */
export function sketchAt(project: Project, shot: Shot, t: number, density: number): Sketch {
  return runTo(project, shot, t, density).sketch;
}

function runTo(project: Project, shot: Shot, t: number, density: number, lane = ''): Run {
  const id = shot.sketch!;
  const file = project.sketches?.[id];
  if (!file) throw new Error(`shot ${shot.id}: no sketch '${id}' in sketches/`);
  const main = modules.get(moduleKey(file));
  if (!main) throw new Error(`sketches/${id}.js was not loaded (loadSketches)`);
  const key = `${moduleKey(file)}\0${shot.id}\0${shot.duration}\0${density}\0${paramsKey(shot)}\0${lane}`;
  const want = sketchFrameAt(project, t);
  let run = runs.get(key);
  runs.delete(key);
  try {
    if (!run || run.frame > want || (run.saw && run.saw !== cameraKey(project, shot))) {
      const { width, height, fps } = project.meta;
      const sketch = new Sketch({
        width,
        height,
        fps,
        density,
        duration: shot.duration,
        params: shot.sketchParams,
      });
      run = { sketch, frame: -1, id: ++started, from: { project, shot } };
      watchCamera(run);
      main(sketch);
      sketch.setup?.();
    }
    run.from = { project, shot };
    const { sketch } = run;
    while (run.frame < want) {
      run.frame++;
      sketch.frameCount = run.frame + 1;
      sketch.time = run.frame / project.meta.fps;
      // The film asks for every frame, so draws every one; a preview skips to its frame.
      sketch.update?.();
      if (!sketch.update || run.frame === want) sketch.draw?.();
    }
  } catch (e) {
    throw new Error(
      `sketches/${id}.js, shot ${shot.id} at ${t.toFixed(2)}s: ${trace(e, id, file)}`
    );
  }
  runs.set(key, run);
  for (const k of runs.keys()) if (runs.size > KEEP_RUNS) runs.delete(k);
  return run;
}

/**
 * The shot, with `--param k=v` laid over its sketchParams for this picture (the CLI's
 * tuning, put in the project as loaded): a number or true/false reads as one, anything else
 * as text.
 */
export function tunedShot(project: Project, shotId: string, params: string[] = []): Shot {
  const i = project.shots.findIndex((s) => s.id === shotId);
  if (i < 0) throw new Error(`no shot '${shotId}'`);
  if (!params.length) return project.shots[i];
  if (!project.shots[i].sketch) throw new Error(`--param: shot '${shotId}' has no sketch`);
  const over = Object.fromEntries(
    params.map((kv) => {
      const at = kv.indexOf('=');
      if (at < 1) throw new Error(`--param takes key=value, not '${kv}'`);
      const v = kv.slice(at + 1);
      const value =
        v === 'true' ? true : v === 'false' ? false : v.trim() && Number.isFinite(+v) ? +v : v;
      return [kv.slice(0, at), value];
    })
  );
  const shot = { ...project.shots[i], sketchParams: { ...project.shots[i].sketchParams, ...over } };
  project.shots[i] = shot;
  return shot;
}

/** The error and the lines of its stack in the sketch itself, named as in the project. */
function trace(e: unknown, id: string, f: SketchFile): string {
  const err = e as Error;
  const names = [pathToFileURL(f.file).href, f.file];
  const where = (err.stack ?? '')
    .split('\n')
    .filter((l) => names.some((n) => l.includes(n)))
    .map((l) => {
      for (const n of names) l = l.replaceAll(n, `sketches/${id}.js`);
      return l.trim().replace(/\?v=\d+/, '');
    });
  return [err.message ?? String(e), ...where.slice(0, 3)].join('\n  ');
}

/**
 * Pictures the frames refer to, by href: resvg is handed each one (rasterize resolves
 * them), and the review app gets them inline. The host can never resolve, so a picture
 * not handed over shows as missing rather than being fetched.
 */
export const PICTURE_HOST = 'https://sketch.talekit.invalid/';
const pictures = new Map<string, { pixels: Uint8ClampedArray; width: number; height: number }>();
/** Bytes of pictures kept: a dozen frames at full size, a contact sheet of previews. */
const KEEP_BYTES = 128 << 20;
let kept = 0;

function keepPicture(href: string, sketch: Sketch): void {
  if (pictures.has(href)) return;
  const { width, height } = sketch.canvas;
  const pixels = sketch.drawingContext.getImageData(0, 0, width, height).data;
  pictures.set(href, { pixels, width, height });
  kept += pixels.byteLength;
  for (const [k, p] of pictures) {
    if (kept <= KEEP_BYTES || k === href) break;
    pictures.delete(k);
    kept -= p.pixels.byteLength;
  }
}

/**
 * The canvas compose.ts asks for: each shot's sketch at t, as a picture href. A `lane` has
 * runs of its own: the review app's thumbnails, asked for mid-shot, would otherwise carry
 * the run past the frame on the stage, and the stage's next frame would start it again.
 */
export function sketchCanvas(
  project: Project,
  density: number,
  lane = ''
): ComposeOptions['canvas'] {
  return (shot, t) => {
    if (!shot.sketch) return undefined;
    const { sketch, id } = runTo(project, shot, t, density, lane);
    const href = `${PICTURE_HOST}${encodeURIComponent(shot.id)}/${shot.sketch}/${id}/${sketchFrameAt(project, t)}@${density}.png`;
    keepPicture(href, sketch);
    return { href, screen: sketch.screen };
  };
}

/**
 * How finely previews draw a sketch: half the film's pixels, a quarter of the work for a
 * fluid's dye, and the same picture for anything drawn with shapes.
 */
export const PREVIEW_DENSITY = 0.5;

/**
 * A frame as SVG with its sketch in it: composeFrame for everything outside the engine.
 * `density` is the sketch's pixels per design pixel (the film's 1, previews' less).
 */
export function frameSvg(
  project: Project,
  shot: Shot,
  t: number,
  opts: ComposeOptions & { density?: number; lane?: string } = {}
): string {
  const { density = PREVIEW_DENSITY, lane, ...rest } = opts;
  return composeFrame(project, shot, t, { ...rest, canvas: sketchCanvas(project, density, lane) });
}

/** A kept picture as PNG: stored, not squeezed, for resvg; level 1 for a browser. */
export function picturePng(href: string, level = 0): Buffer | undefined {
  const p = pictures.get(href);
  return p && png(p.pixels, p.width, p.height, level);
}

/** The frame with its pictures inline, for a page that cannot ask this process for them. */
export function inlinePictures(svg: string): string {
  return svg.replace(new RegExp(`${PICTURE_HOST}[^'"]+`, 'g'), (href) => {
    const data = picturePng(href, 1);
    return data ? `data:image/png;base64,${data.toString('base64')}` : href;
  });
}

function png(pixels: Uint8ClampedArray, w: number, h: number, level: number): Buffer {
  const stride = w * 4;
  const rows = Buffer.alloc((stride + 1) * h);
  const src = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let y = 0; y < h; y++) src.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bits per channel
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
