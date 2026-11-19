import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { composeFrame, type ComposeOptions } from '../engine/compose.js';
import type { Project, Shot, SketchFile } from '../engine/types.js';
import { Sketch } from '../sketch/p5.js';

/**
 * Sketches in frames: a shot's `sketch` (sketches/<id>.js, drawn with the API in
 * sketch/p5.ts) run frame by frame and handed to the engine as a picture on the stage
 * (compose.ts `canvas`), so everything that draws a frame (the film, previews, sheets, the
 * review app, covers) shows it.
 *
 * A sketch has state (a fluid, particles, a trail left on its canvas), so frame n is what
 * draw() leaves after its (n+1)th call: a frame is still a pure function of (project, shot,
 * t), but reached by running from the start. A run is kept and carried forward, so frames
 * asked for in order cost one draw() each; asking for an earlier one starts it again.
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
}

/** Kept runs, most recent last; few, as a fluid's fields at full size take ~100 MB. */
const runs = new Map<string, Run>();
const KEEP_RUNS = 3;

/** The frame of a shot a time falls in. */
export const sketchFrameAt = (project: Project, t: number): number =>
  Math.max(0, Math.floor(t * project.meta.fps + 1e-6));

/**
 * The shot's sketch as drawn at t (canvas pixels: `density` per design pixel). Throws with
 * the sketch's own stack when its code does.
 */
export function sketchAt(project: Project, shot: Shot, t: number, density: number): Sketch {
  const id = shot.sketch!;
  const file = project.sketches?.[id];
  if (!file) throw new Error(`shot ${shot.id}: no sketch '${id}' in sketches/`);
  const main = modules.get(moduleKey(file));
  if (!main) throw new Error(`sketches/${id}.js was not loaded (loadSketches)`);
  const key = `${moduleKey(file)}\0${shot.id}\0${shot.duration}\0${density}`;
  const want = sketchFrameAt(project, t);
  let run = runs.get(key);
  runs.delete(key);
  try {
    if (!run || run.frame > want) {
      const { width, height, fps } = project.meta;
      const sketch = new Sketch({ width, height, fps, density, duration: shot.duration });
      main(sketch);
      sketch.setup?.();
      run = { sketch, frame: -1 };
    }
    const { sketch } = run;
    while (run.frame < want) {
      run.frame++;
      sketch.frameCount = run.frame + 1;
      sketch.time = run.frame / project.meta.fps;
      sketch.draw?.();
    }
  } catch (e) {
    throw new Error(
      `sketches/${id}.js, shot ${shot.id} at ${t.toFixed(2)}s: ${trace(e, id, file)}`
    );
  }
  runs.set(key, run);
  for (const k of runs.keys()) if (runs.size > KEEP_RUNS) runs.delete(k);
  return run.sketch;
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

/** The canvas compose.ts asks for: each shot's sketch at t, as a picture href. */
export function sketchCanvas(project: Project, density: number): ComposeOptions['canvas'] {
  return (shot, t) => {
    if (!shot.sketch) return undefined;
    const sketch = sketchAt(project, shot, t, density);
    const v = project.sketches![shot.sketch].version;
    const href = `${PICTURE_HOST}${encodeURIComponent(shot.id)}/${shot.sketch}-${v}/${sketchFrameAt(project, t)}@${density}.png`;
    keepPicture(href, sketch);
    return href;
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
  opts: ComposeOptions & { density?: number } = {}
): string {
  const { density = PREVIEW_DENSITY, ...rest } = opts;
  return composeFrame(project, shot, t, { ...rest, canvas: sketchCanvas(project, density) });
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
