import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import type { Project } from '../src/engine/types.js';
import { loadProject, saveSketch } from '../src/project/store.js';
import { validateProject } from '../src/project/validate.js';
import { rasterizePixels } from '../src/render/raster.js';
import { frameSvg, inlinePictures, sketchAt, tunedShot } from '../src/render/sketch.js';
import { sketchLanes } from '../src/render/video.js';
import { Fluid } from '../src/sketch/fluid.js';
import { Sketch } from '../src/sketch/p5.js';

/** A one-shot reel project whose shot draws `code` as its sketch. */
async function sketchProject(code: string, shot: object = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'talekit-sketch-'));
  for (const d of ['scenes', 'shots', 'sketches']) await mkdir(path.join(root, d));
  const json = (f: string, v: object) => writeFile(path.join(root, f), JSON.stringify(v));
  await json('talekit.json', { title: 'Sketch', width: 200, height: 400, fps: 10 });
  await json('scenes/blank.json', {
    id: 'blank',
    name: 'Blank',
    svg: '',
    allow: { 'world.walk': 'a sketch, nobody stands' },
  });
  await json('shots/01-s.json', { id: 's', scene: 'blank', duration: 2, sketch: 'art', ...shot });
  await writeFile(path.join(root, 'sketches/art.js'), code);
  return root;
}

/** One pixel of an RGBA buffer `w` wide. */
const px = (pixels: Uint8Array | Uint8ClampedArray, w: number, x: number, y: number) => [
  ...pixels.slice((y * w + x) * 4, (y * w + x) * 4 + 3),
];

/** A square that walks right 10 px a frame over a red page. */
const WALKER = `export default function (p) {
  p.setup = () => p.background(255, 0, 0);
  p.draw = () => { p.noStroke(); p.fill(0, 0, 255); p.rect(p.frameCount * 10, 100, 10, 10); };
}`;

describe('the sketch API', () => {
  const sketch = () => new Sketch({ width: 100, height: 100, density: 1, fps: 10, duration: 1 });

  it('draws with p5 state: fill, HSB colour and push/pop', () => {
    const p = sketch();
    p.background(0);
    p.colorMode('hsb', 360, 100, 100, 1);
    p.noStroke();
    p.push();
    p.fill(120, 100, 100);
    p.translate(50, 50);
    p.circle(0, 0, 20);
    p.pop();
    p.rect(0, 0, 10, 10); // white: the fill pushed inside push/pop is gone
    p.loadPixels();
    expect(px(p.pixels, 100, 50, 50)).toEqual([0, 255, 0]);
    expect(px(p.pixels, 100, 5, 5)).toEqual([255, 255, 255]);
    expect(px(p.pixels, 100, 80, 80)).toEqual([0, 0, 0]);
  });

  it('is seeded: the same random and noise every run', () => {
    const a = sketch();
    const b = sketch();
    const draws = (p: Sketch) => [
      p.random(),
      p.random(5, 6),
      p.noise(1.3, 2.7),
      p.randomGaussian(),
    ];
    expect(draws(a)).toEqual(draws(b));
    a.randomSeed(7);
    b.randomSeed(8);
    expect(a.random()).not.toBe(b.random());
    for (let i = 0; i < 50; i++) expect(a.noise(i * 0.37)).toBeGreaterThanOrEqual(0);
  });

  it('draws in design pixels at any density', () => {
    const p = new Sketch({ width: 100, height: 100, density: 0.5, fps: 10, duration: 1 });
    p.background(0);
    p.noStroke();
    p.fill(255);
    p.rect(50, 50, 50, 50);
    p.loadPixels();
    expect(p.pixels.length).toBe(50 * 50 * 4);
    expect(px(p.pixels, 50, 40, 40)).toEqual([255, 255, 255]);
    expect(px(p.pixels, 50, 10, 10)).toEqual([0, 0, 0]);
  });

  it('gives a sized layer exactly its pixels at any density, scaled up smooth or crisp', () => {
    const p = new Sketch({ width: 100, height: 100, density: 0.5, fps: 10, duration: 1 });
    expect(p.createGraphics().canvas.width).toBe(50);
    const g = p.createGraphics(2, 1);
    g.loadPixels();
    expect(g.pixels.length).toBe(2 * 1 * 4);
    g.pixels.set([255, 0, 0, 255, 0, 0, 255, 255]);
    g.updatePixels();
    expect(g.get(1, 0)).toEqual([0, 0, 255, 255]);
    g.filter('invert');
    expect(g.get(0, 0)).toEqual([0, 255, 255, 255]);
    g.filter('invert');
    const across = () => {
      p.image(g, 0, 0, p.width, p.height);
      p.loadPixels();
      return [0, 20, 25, 30, 49].map((x) => px(p.pixels, 50, x, 25));
    };
    p.noSmooth();
    expect(across()).toEqual([
      [255, 0, 0],
      [255, 0, 0],
      [0, 0, 255],
      [0, 0, 255],
      [0, 0, 255],
    ]);
    p.smooth();
    const [left, , mid, , right] = across();
    expect(left).toEqual([255, 0, 0]);
    expect(right).toEqual([0, 0, 255]);
    expect(mid[0]).toBeGreaterThan(60);
    expect(mid[2]).toBeGreaterThan(60);
  });

  it('blooms bright shapes into the dark around them, above a threshold', () => {
    const p = sketch();
    const scene = () => {
      p.background(0);
      p.noStroke();
      p.fill(255);
      p.rect(20, 45, 10, 10);
      p.fill(90);
      p.rect(70, 45, 10, 10);
    };
    const near = () => {
      p.loadPixels();
      return { white: px(p.pixels, 100, 35, 50)[0], grey: px(p.pixels, 100, 85, 50)[0] };
    };
    scene();
    p.bloom(1, 8);
    const glow = near();
    expect(glow.white).toBeGreaterThan(8);
    expect(glow.grey).toBeGreaterThan(2);
    expect(px(p.pixels, 100, 50, 95)).toEqual([0, 0, 0]);
    const first = [...p.pixels];
    scene();
    p.bloom(1, 8);
    p.loadPixels();
    expect([...p.pixels]).toEqual(first);
    scene();
    p.bloom(1, 8, 0.5);
    expect(near().grey).toBe(0);
    expect(near().white).toBeGreaterThan(4);
  });

  it('fills and strokes Path2D and SVG path data', () => {
    const p = sketch();
    p.background(0);
    p.drawingContext.fillStyle = 'rgb(255,0,0)';
    p.drawingContext.fill(new p.Path2D('M0 0 H20 V20 H0 Z'));
    p.noStroke();
    p.fill(0, 255, 0);
    p.path('M40 40 H60 V60 H40 Z');
    p.noFill();
    p.stroke(0, 0, 255);
    p.strokeWeight(4);
    p.path(new p.Path2D('M70 70 H90 V90 H70 Z'));
    p.loadPixels();
    expect(px(p.pixels, 100, 10, 10)).toEqual([255, 0, 0]);
    expect(px(p.pixels, 100, 50, 50)).toEqual([0, 255, 0]);
    expect(px(p.pixels, 100, 70, 80)).toEqual([0, 0, 255]);
    expect(px(p.pixels, 100, 80, 80)).toEqual([0, 0, 0]);
  });
});

describe('a fluid', () => {
  it('carries dye along the way it is pushed', () => {
    const f = new Fluid(100, 100, 100, 100, { resolution: 32 });
    f.splat(30, 50, 600, 0, 8, [1, 1, 1]);
    for (let i = 0; i < 10; i++) f.step(1 / 60);
    const at = (x: number) => f.dye[0][50 * 100 + x];
    expect(at(40)).toBeGreaterThan(at(20));
    const out = new Uint8ClampedArray(100 * 100 * 4);
    f.render(out, { background: [0, 0, 0], bloom: 0, sunrays: 0 });
    expect(out[(50 * 100 + 40) * 4]).toBeGreaterThan(out[(10 * 100 + 10) * 4] + 50);
  });

  it('renders a frame the same however many frames were rendered before it', () => {
    const shown = (every: boolean) => {
      const f = new Fluid(60, 60, 60, 60, { resolution: 16 });
      const out = new Uint8ClampedArray(60 * 60 * 4);
      f.splat(20, 30, 300, 0, 6, [0.02, 0.01, 0]);
      for (let i = 0; i < 5; i++) {
        f.step(1 / 30);
        if (every) f.render(out);
      }
      f.render(out);
      return [...out];
    };
    expect(shown(false)).toEqual(shown(true));
  });
});

describe('a sketch in a shot', () => {
  it('is drawn under the frame, as its code left the canvas by then', async () => {
    const p = await loadProject(await sketchProject(WALKER));
    const { pixels, width } = rasterizePixels(frameSvg(p, p.shots[0], 0.5, { density: 1 }));
    // Frame 5: squares at 10..60 px, one per draw so far.
    expect(px(pixels, width, 55, 105)).toEqual([0, 0, 255]);
    expect(px(pixels, width, 75, 105)).toEqual([255, 0, 0]);
  });

  it('gives the same frame asked for out of order, later or earlier', async () => {
    const p = await loadProject(await sketchProject(WALKER));
    const shot = p.shots[0];
    const at = (t: number) => {
      const s = sketchAt(p, shot, t, 1);
      return px(s.drawingContext.getImageData(0, 0, 200, 400).data, 200, 75, 105);
    };
    const fresh = at(0.7);
    at(0.2);
    expect(at(0.7)).toEqual(fresh);
    expect(at(0.2)).toEqual([255, 0, 0]);
  });

  it('moves with the camera like the stage', async () => {
    const root = await sketchProject(WALKER, { camera: { zoom: 2, x: 50, y: 100 } });
    const p = await loadProject(root);
    const { pixels, width } = rasterizePixels(frameSvg(p, p.shots[0], 0.1, { density: 1 }));
    // Frame 1's first square, 10..20 × 100..110, doubled about (50, 100) at the frame's centre.
    expect(px(pixels, width, 100 + (15 - 50) * 2, 200 + (105 - 100) * 2)).toEqual([0, 0, 255]);
    expect(px(pixels, width, 100 + (45 - 50) * 2, 200 + (105 - 100) * 2)).toEqual([255, 0, 0]);
  });

  it('draws nothing without a canvas, as the engine never runs code', async () => {
    const p = await loadProject(await sketchProject(WALKER));
    expect(composeFrame(p, p.shots[0], 0.5)).not.toContain('<image');
  });

  it('goes inline for a page that cannot ask for it', async () => {
    const p = await loadProject(await sketchProject(WALKER));
    const svg = inlinePictures(frameSvg(p, p.shots[0], 0.5));
    expect(svg).toContain('data:image/png;base64,');
    const img = new Resvg(svg).render();
    expect(px(img.pixels, img.width, 55, 105)).toEqual([0, 0, 255]);
  });

  it('is a check error when missing, or when it throws', async () => {
    const root = await sketchProject(WALKER, { sketch: 'nope' });
    const problems = (p: Project) =>
      validateProject(p)
        .map((x) => x.message)
        .join('\n');
    expect(problems(await loadProject(root))).toContain("unknown sketch 'nope'");
    const bad = await sketchProject('export default (p) => { p.setup = () => p.nothing(); }');
    expect(problems(await loadProject(bad))).toMatch(
      /sketches\/art\.js.*p\.nothing is not a function/
    );
  });

  it('is saved only when it draws its first frame', async () => {
    const root = await sketchProject(WALKER);
    await expect(
      saveSketch(
        root,
        'broken',
        'export default (p) => { p.draw = () => { throw new Error("oops"); }; }'
      )
    ).rejects.toThrow(/^sketches\/broken\.js, .*: oops/);
    expect(await readdir(path.join(root, 'sketches'))).toEqual(['art.js']);
    await saveSketch(root, 'fine', WALKER);
    expect((await loadProject(root)).sketches?.fine).toBeDefined();
  });
});

describe('render lanes', () => {
  const shot = (sketch?: string, crossfade = 0) => ({ sketch, crossfade }) as never;
  it('keeps a sketch, and a dissolve into or out of it, on one worker', () => {
    expect(sketchLanes([shot(), shot('a'), shot(undefined, 1), shot(), shot('b')], 4)).toEqual([
      undefined,
      0,
      0,
      undefined,
      1,
    ]);
    expect(sketchLanes([shot(), shot('a', 1)], 4)).toEqual([0, 0]);
  });
});

describe('a sketch told more', () => {
  /** Dots that drift right, each frame's picture painted whole from where they are. */
  const drift = (split: boolean) => `export default function (p) {
  let xs = [];
  p.setup = () => { for (let i = 0; i < 20; i++) xs.push(p.random(200)); };
  const step = () => { xs = xs.map((x, i) => (x + 3 + p.random(2) + i * 0.1) % 200); };
  const paint = () => {
    p.background(0);
    p.noStroke();
    p.fill(255, 200, 0);
    xs.forEach((x, i) => p.circle(x, 20 + i * 18, 9));
  };
  ${split ? 'p.update = step; p.draw = () => { globalThis.draws = (globalThis.draws ?? 0) + 1; paint(); };' : 'p.draw = () => { step(); paint(); };'}
}`;
  const canvasAt = async (code: string, times: number[]) => {
    const p = await loadProject(await sketchProject(code));
    let s: Sketch | undefined;
    for (const t of times) s = sketchAt(p, p.shots[0], t, 1);
    return [...s!.drawingContext.getImageData(0, 0, 200, 400).data];
  };

  it('with update split from draw, skips drawing on the way and leaves the same picture', async () => {
    const g = globalThis as { draws?: number };
    const plain = await canvasAt(drift(false), [1.5]);
    g.draws = 0;
    const jumped = await canvasAt(drift(true), [1.5]);
    expect(g.draws).toBe(1);
    const film = await canvasAt(
      drift(true),
      Array.from({ length: 16 }, (_, i) => i / 10)
    );
    expect(g.draws).toBe(17);
    expect(jumped).toEqual(plain);
    expect(film).toEqual(plain);
  });

  /** A hairline down the frame and a square, both placed in design pixels. */
  const LINE = (screen: boolean) => `export default function (p) {
  p.setup = () => { p.screen = ${screen}; };
  p.draw = () => {
    p.background(255);
    p.applyCamera();
    p.stroke(0);
    p.strokeWeight(1 / p.camera.zoom);
    p.line(80.25, 0, 80.25, 400);
    p.noStroke();
    p.fill(0, 0, 255);
    p.rect(110, 190, 10, 10);
  };
}`;
  const zoomed = async (screen: boolean) => {
    const root = await sketchProject(LINE(screen), { camera: { zoom: 2, x: 100, y: 200 } });
    const p = await loadProject(root);
    const s = sketchAt(p, p.shots[0], 0, 1);
    expect(s.view).toEqual({ x: 50, y: 100, width: 100, height: 200 });
    const { pixels, width } = rasterizePixels(frameSvg(p, p.shots[0], 0, { density: 1 }));
    const row = Array.from({ length: 40 }, (_, i) => px(pixels, width, 40 + i, 300)[0]);
    return { inked: row.filter((v) => v < 250).length, darkest: Math.min(...row), pixels, width };
  };

  it('can draw what the camera shows, so a zoom stays sharp', async () => {
    const world = await zoomed(false);
    const screen = await zoomed(true);
    // Design x 80.25 lands at 100 + 2 × (80.25 - 100) = 60.5 on screen: one pixel, black.
    expect(screen.inked).toBe(1);
    expect(screen.darkest).toBe(0);
    expect(world.inked).toBeGreaterThan(1);
    expect(world.darkest).toBeGreaterThan(40);
    // Either way the square is where the camera puts it: 120..140 × 180..200 on screen.
    for (const { pixels, width } of [world, screen]) {
      expect(px(pixels, width, 130, 190)).toEqual([0, 0, 255]);
      expect(px(pixels, width, 145, 190)).toEqual([255, 255, 255]);
    }
  });

  it('starts afresh when a camera it read has moved', async () => {
    const root = await sketchProject(LINE(true), { camera: { zoom: 2, x: 100, y: 200 } });
    const p = await loadProject(root);
    expect(sketchAt(p, p.shots[0], 0.5, 1).camera.x).toBe(100);
    p.shots[0] = { ...p.shots[0], camera: { zoom: 2, x: 90, y: 200 } };
    expect(sketchAt(p, p.shots[0], 0.5, 1).camera.x).toBe(90);
  });

  const SIZED = `export default function (p) {
  p.draw = () => {
    p.background(255, 0, 0);
    p.noStroke();
    p.fill(p.params.ink === 'green' ? [0, 255, 0] : [0, 0, 255]);
    if (p.params.on) p.rect(0, 0, p.params.size, 10);
  };
}`;

  it("hands the shot's params to its sketch, and a --param overrides one", async () => {
    const root = await sketchProject(SIZED, { sketchParams: { size: 50, on: true } });
    const p = await loadProject(root);
    const at = (x: number) => {
      const { pixels, width } = rasterizePixels(frameSvg(p, p.shots[0], 0, { density: 1 }));
      return px(pixels, width, x, 5);
    };
    expect(at(40)).toEqual([0, 0, 255]);
    expect(at(70)).toEqual([255, 0, 0]);
    tunedShot(p, 's', ['size=100', 'ink=green']);
    expect(p.shots[0].sketchParams).toEqual({ size: 100, on: true, ink: 'green' });
    expect(at(70)).toEqual([0, 255, 0]);
    expect(() => tunedShot(p, 's', ['size'])).toThrow(/key=value/);
  });

  it('draws several times in one run from the CLI, each with its --param', () => {
    return sketchProject(SIZED, { sketchParams: { size: 50, on: true } }).then(async (root) => {
      const r = spawnSync(
        'npx',
        ['tsx', 'src/cli.ts', 'frame', root, 's', '-t', '1,0.5', '--param', 'size=120', '--svg'],
        { encoding: 'utf8' }
      );
      expect(r.status, r.stderr).toBe(0);
      const files = r.stdout.trim().split('\n');
      expect(files.map((f) => path.basename(f))).toEqual(['frame-s-0.5.svg', 'frame-s-1.svg']);
      const img = new Resvg(await readFile(files[1], 'utf8')).render();
      expect(px(img.pixels, img.width, 110, 5)).toEqual([0, 0, 255]);
    });
  }, 30_000);
});
