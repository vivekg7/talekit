/**
 * The open canvas: what a sketch draws with. Modelled on p5.js in instance mode, which
 * agents already write fluently: a sketch module's default export is `(p) => { p.setup =
 * …; p.draw = … }`, and `p` has p5's names and behaviour (fill and stroke state, push/pop,
 * colorMode, noise, pixels, createGraphics) over a Skia 2D canvas. It is a subset: what
 * a frame needs, nothing that waits on a browser (no mouse, keys, DOM, loading files).
 *
 * Different from p5, for the engine: time is the film's (draw runs once per frame at the
 * project's fps, `p.time` is the shot's seconds), chance is seeded (the same frames every
 * run), the canvas is the project's size whatever createCanvas asks, and `p.fluid()` adds
 * a fluid simulation (fluid.ts). Coordinates are design pixels at any pixelDensity: a
 * preview draws the same picture smaller.
 */
import { createCanvas, type Canvas, type SKRSContext2D, type ImageData } from '@napi-rs/canvas';
import { Fluid, type FluidLook, type FluidOptions } from './fluid.js';
import { Noise, randomStream } from './noise.js';

type ColorArg = number | string | number[] | SketchColor;
type Mode = string;

/** p5's constants, as strings like p5's own so they read well when logged. */
const C = {
  RGB: 'rgb',
  HSB: 'hsb',
  HSL: 'hsl',
  CORNER: 'corner',
  CORNERS: 'corners',
  CENTER: 'center',
  RADIUS: 'radius',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
  BOTTOM: 'bottom',
  BASELINE: 'alphabetic',
  CLOSE: 'close',
  OPEN: 'open',
  CHORD: 'chord',
  PIE: 'pie',
  POINTS: 'points',
  LINES: 'lines',
  TRIANGLES: 'triangles',
  TRIANGLE_FAN: 'triangle_fan',
  TRIANGLE_STRIP: 'triangle_strip',
  QUADS: 'quads',
  ROUND: 'round',
  SQUARE: 'butt',
  PROJECT: 'square',
  MITER: 'miter',
  BEVEL: 'bevel',
  RADIANS: 'radians',
  DEGREES: 'degrees',
  BLEND: 'source-over',
  ADD: 'lighter',
  REMOVE: 'destination-out',
  MULTIPLY: 'multiply',
  SCREEN: 'screen',
  OVERLAY: 'overlay',
  DARKEST: 'darken',
  LIGHTEST: 'lighten',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HARD_LIGHT: 'hard-light',
  SOFT_LIGHT: 'soft-light',
  DODGE: 'color-dodge',
  BURN: 'color-burn',
  BLUR: 'blur',
  GRAY: 'gray',
  INVERT: 'invert',
  THRESHOLD: 'threshold',
  POSTERIZE: 'posterize',
  PI: Math.PI,
  TWO_PI: Math.PI * 2,
  TAU: Math.PI * 2,
  HALF_PI: Math.PI / 2,
  QUARTER_PI: Math.PI / 4,
} as const;

/** A colour: `levels` are r, g, b, a in 0..255, as p5's. */
export class SketchColor {
  constructor(public levels: [number, number, number, number]) {}
  toString(): string {
    const [r, g, b, a] = this.levels;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a / 255})`;
  }
  setAlpha(a: number): void {
    this.levels[3] = a;
  }
}

/** p5.Vector, the parts sketches use. */
export class Vector {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0
  ) {}
  static fromAngle(a: number, len = 1): Vector {
    return new Vector(Math.cos(a) * len, Math.sin(a) * len);
  }
  static add = (a: Vector, b: Vector) => a.copy().add(b);
  static sub = (a: Vector, b: Vector) => a.copy().sub(b);
  static mult = (a: Vector, k: number) => a.copy().mult(k);
  static dist = (a: Vector, b: Vector) => a.dist(b);
  static lerp = (a: Vector, b: Vector, t: number) => a.copy().lerp(b, t);
  set(x: number | Vector = 0, y = 0, z = 0): this {
    if (x instanceof Vector) return this.set(x.x, x.y, x.z);
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(): Vector {
    return new Vector(this.x, this.y, this.z);
  }
  add(x: number | Vector, y = 0, z = 0): this {
    if (x instanceof Vector) return this.add(x.x, x.y, x.z);
    this.x += x;
    this.y += y;
    this.z += z;
    return this;
  }
  sub(x: number | Vector, y = 0, z = 0): this {
    if (x instanceof Vector) return this.sub(x.x, x.y, x.z);
    this.x -= x;
    this.y -= y;
    this.z -= z;
    return this;
  }
  mult(k: number): this {
    this.x *= k;
    this.y *= k;
    this.z *= k;
    return this;
  }
  div(k: number): this {
    return this.mult(1 / k);
  }
  mag(): number {
    return Math.hypot(this.x, this.y, this.z);
  }
  magSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  setMag(len: number): this {
    return this.normalize().mult(len);
  }
  normalize(): this {
    const m = this.mag();
    return m > 0 ? this.div(m) : this;
  }
  limit(max: number): this {
    const m = this.mag();
    return m > max ? this.mult(max / m) : this;
  }
  heading(): number {
    return Math.atan2(this.y, this.x);
  }
  rotate(a: number): this {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return this.set(this.x * c - this.y * s, this.x * s + this.y * c, this.z);
  }
  dist(v: Vector): number {
    return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  dot(v: Vector): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  lerp(v: Vector, t: number): this {
    return this.set(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }
  array(): number[] {
    return [this.x, this.y, this.z];
  }
}

function hsbToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return (
    [
      [v, t, p],
      [q, v, p],
      [p, v, t],
      [p, q, v],
      [t, p, v],
      [v, p, q],
    ] as [number, number, number][]
  )[((i % 6) + 6) % 6];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const v = l + s * Math.min(l, 1 - l);
  return hsbToRgb(h, v === 0 ? 0 : 2 * (1 - l / v), v);
}

interface Style {
  fill: string | undefined;
  stroke: string | undefined;
  /** Text is outlined only once stroke() has been called, as in p5. */
  strokeSet: boolean;
  weight: number;
  rectMode: Mode;
  ellipseMode: Mode;
  colorMode: Mode;
  maxes: [number, number, number, number];
  textSize: number;
  textFont: string;
  textAlign: [Mode, Mode];
}

interface Vertex {
  kind: 'v' | 'curve' | 'bezier' | 'quadratic';
  pts: number[];
}

/** What a sketch is handed, and what it draws with. */
export interface SketchSettings {
  width: number;
  height: number;
  /** Canvas pixels per design pixel. */
  density: number;
  fps: number;
  /** The shot's length, seconds. */
  duration: number;
}

/**
 * The `p` a sketch is given (and `createGraphics` returns, for an offscreen layer). The
 * sketch sets `setup` and `draw`; the runner (render/sketch.ts) calls them.
 */
export class Sketch {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly duration: number;
  readonly canvas: Canvas;
  readonly drawingContext: SKRSContext2D;
  readonly Vector = Vector;
  /** Set by loadPixels: the canvas's RGBA bytes, pixelDensity() times the design size. */
  pixels: Uint8ClampedArray = new Uint8ClampedArray(0);
  frameCount = 0;
  /** Seconds since the shot began, at this frame. */
  time = 0;
  deltaTime: number;
  setup?: () => void;
  draw?: () => void;

  private readonly density: number;
  private readonly ctx: SKRSContext2D;
  private style: Style = {
    fill: 'rgba(255,255,255,1)',
    stroke: 'rgba(0,0,0,1)',
    strokeSet: false,
    weight: 1,
    rectMode: C.CORNER,
    ellipseMode: C.CENTER,
    colorMode: C.RGB,
    maxes: [255, 255, 255, 255],
    textSize: 12,
    textFont: 'sans-serif',
    textAlign: [C.LEFT, C.BASELINE],
  };
  private styles: Style[] = [];
  private angles: Mode = C.RADIANS;
  private shape: { mode: Mode | undefined; verts: Vertex[] } | undefined;
  private pixelData: ImageData | undefined;
  private rand: () => number;
  private gauss: number | undefined;
  private noiseField: Noise;

  constructor(s: SketchSettings) {
    this.width = s.width;
    this.height = s.height;
    this.fps = s.fps;
    this.duration = s.duration;
    this.deltaTime = 1000 / s.fps;
    this.density = s.density;
    this.canvas = createCanvas(
      Math.max(1, Math.round(s.width * s.density)),
      Math.max(1, Math.round(s.height * s.density))
    );
    this.ctx = this.drawingContext = this.canvas.getContext('2d');
    this.ctx.setTransform(s.density, 0, 0, s.density, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'miter';
    this.rand = randomStream(1);
    this.noiseField = new Noise(0);
    Object.assign(this, C);
  }

  // ---- setup and time ----

  /** Accepted for p5's sake; the canvas is the project's frame. */
  createCanvas(): this {
    return this;
  }
  pixelDensity(): number {
    return this.density;
  }
  frameRate(): number {
    return this.fps;
  }
  millis(): number {
    return this.time * 1000;
  }
  noLoop(): void {}
  loop(): void {}

  /** An offscreen layer of its own, the same size: draw on it, then `image(g, 0, 0)`. */
  createGraphics(): Sketch {
    return new Sketch({
      width: this.width,
      height: this.height,
      density: this.density,
      fps: this.fps,
      duration: this.duration,
    });
  }

  /** A fluid over the whole canvas (fluid.ts): splat, jet or swirl into it, step it, draw it. */
  fluid(options: Partial<FluidOptions> = {}): SketchFluid {
    return new SketchFluid(this, options);
  }

  // ---- colour ----

  colorMode(mode: Mode, a?: number, b?: number, c?: number, d?: number): void {
    this.style.colorMode = mode;
    const def: [number, number, number, number] =
      mode === C.RGB
        ? [255, 255, 255, 255]
        : mode === C.HSB
          ? [360, 100, 100, 1]
          : [360, 100, 100, 1];
    if (a === undefined) this.style.maxes = def;
    else if (b === undefined) this.style.maxes = [a, a, a, a];
    else this.style.maxes = [a, b!, c!, d ?? def[3]];
  }

  color(...args: ColorArg[]): SketchColor {
    if (args[0] instanceof SketchColor) return new SketchColor([...args[0].levels]);
    if (Array.isArray(args[0])) return this.color(...(args[0] as number[]));
    if (typeof args[0] === 'string') return parseCss(args[0]);
    const v = args as number[];
    const [m0, m1, m2, ma] = this.style.maxes;
    if (v.length <= 2) {
      const g = (v[0] / (this.style.colorMode === C.RGB ? m0 : m2)) * 255;
      return new SketchColor([g, g, g, v.length === 2 ? (v[1] / ma) * 255 : 255]);
    }
    const a = v.length > 3 ? (v[3] / ma) * 255 : 255;
    if (this.style.colorMode === C.RGB)
      return new SketchColor([(v[0] / m0) * 255, (v[1] / m1) * 255, (v[2] / m2) * 255, a]);
    const conv = this.style.colorMode === C.HSB ? hsbToRgb : hslToRgb;
    const h = (((v[0] / m0) % 1) + 1) % 1;
    const [r, g, b] = conv(h, clamp(v[1] / m1, 0, 1), clamp(v[2] / m2, 0, 1));
    return new SketchColor([r * 255, g * 255, b * 255, a]);
  }

  lerpColor(a: SketchColor, b: SketchColor, t: number): SketchColor {
    return new SketchColor(
      a.levels.map((v, i) => v + (b.levels[i] - v) * clamp(t, 0, 1)) as SketchColor['levels']
    );
  }
  red = (c: ColorArg) => this.color(c).levels[0];
  green = (c: ColorArg) => this.color(c).levels[1];
  blue = (c: ColorArg) => this.color(c).levels[2];
  alpha = (c: ColorArg) => this.color(c).levels[3];

  background(...args: ColorArg[]): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.color(...args).toString();
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
  clear(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
  fill(...args: ColorArg[]): void {
    this.style.fill = this.color(...args).toString();
  }
  noFill(): void {
    this.style.fill = undefined;
  }
  stroke(...args: ColorArg[]): void {
    this.style.stroke = this.color(...args).toString();
    this.style.strokeSet = true;
  }
  noStroke(): void {
    this.style.stroke = undefined;
  }
  strokeWeight(w: number): void {
    this.style.weight = w;
  }
  strokeCap(cap: Mode): void {
    this.ctx.lineCap = cap as CanvasLineCap;
  }
  strokeJoin(join: Mode): void {
    this.ctx.lineJoin = join as CanvasLineJoin;
  }
  blendMode(mode: Mode): void {
    this.ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
  }
  rectMode(m: Mode): void {
    this.style.rectMode = m;
  }
  ellipseMode(m: Mode): void {
    this.style.ellipseMode = m;
  }
  angleMode(m: Mode): void {
    this.angles = m;
  }

  // ---- transforms ----

  push(): void {
    this.ctx.save();
    this.styles.push({ ...this.style });
  }
  pop(): void {
    this.ctx.restore();
    this.style = this.styles.pop() ?? this.style;
  }
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }
  rotate(a: number): void {
    this.ctx.rotate(this.rad(a));
  }
  scale(x: number, y = x): void {
    this.ctx.scale(x, y);
  }
  resetMatrix(): void {
    this.ctx.setTransform(this.density, 0, 0, this.density, 0, 0);
  }

  // ---- shapes ----

  private paint(close = true): void {
    const ctx = this.ctx;
    if (this.style.fill && close) {
      ctx.fillStyle = this.style.fill;
      ctx.fill();
    }
    if (this.style.stroke && this.style.weight > 0) {
      ctx.strokeStyle = this.style.stroke;
      ctx.lineWidth = this.style.weight;
      ctx.stroke();
    }
  }

  point(x: number, y: number): void {
    if (!this.style.stroke) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(this.style.weight, 1) / 2, 0, C.TWO_PI);
    ctx.fillStyle = this.style.stroke;
    ctx.fill();
  }
  line(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.paint(false);
  }
  rect(x: number, y: number, w: number, h = w, r = 0): void {
    [x, y, w, h] = boxOf(this.style.rectMode, x, y, w, h);
    this.ctx.beginPath();
    if (r > 0) this.ctx.roundRect(x, y, w, h, r);
    else this.ctx.rect(x, y, w, h);
    this.paint();
  }
  square(x: number, y: number, s: number, r = 0): void {
    this.rect(x, y, s, s, r);
  }
  ellipse(x: number, y: number, w: number, h = w): void {
    const [bx, by, bw, bh] = boxOf(this.style.ellipseMode, x, y, w, h);
    this.ctx.beginPath();
    this.ctx.ellipse(bx + bw / 2, by + bh / 2, Math.abs(bw / 2), Math.abs(bh / 2), 0, 0, C.TWO_PI);
    this.paint();
  }
  circle(x: number, y: number, d: number): void {
    this.ellipse(x, y, d, d);
  }
  arc(
    x: number,
    y: number,
    w: number,
    h: number,
    start: number,
    stop: number,
    mode: Mode = C.OPEN
  ): void {
    const [bx, by, bw, bh] = boxOf(this.style.ellipseMode, x, y, w, h);
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const ctx = this.ctx;
    ctx.beginPath();
    if (mode === C.PIE) ctx.moveTo(cx, cy);
    ctx.ellipse(cx, cy, Math.abs(bw / 2), Math.abs(bh / 2), 0, this.rad(start), this.rad(stop));
    if (mode !== C.OPEN) ctx.closePath();
    this.paint();
  }
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.poly([x1, y1, x2, y2, x3, y3]);
  }
  quad(...p: number[]): void {
    this.poly(p);
  }
  private poly(p: number[]): void {
    this.ctx.beginPath();
    this.ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) this.ctx.lineTo(p[i], p[i + 1]);
    this.ctx.closePath();
    this.paint();
  }
  bezier(...p: number[]): void {
    this.ctx.beginPath();
    this.ctx.moveTo(p[0], p[1]);
    this.ctx.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
    this.paint(false);
  }

  beginShape(mode?: Mode): void {
    this.shape = { mode, verts: [] };
  }
  vertex(x: number, y: number): void {
    this.shape?.verts.push({ kind: 'v', pts: [x, y] });
  }
  curveVertex(x: number, y: number): void {
    this.shape?.verts.push({ kind: 'curve', pts: [x, y] });
  }
  bezierVertex(...p: number[]): void {
    this.shape?.verts.push({ kind: 'bezier', pts: p });
  }
  quadraticVertex(...p: number[]): void {
    this.shape?.verts.push({ kind: 'quadratic', pts: p });
  }
  endShape(mode?: Mode): void {
    const shape = this.shape;
    this.shape = undefined;
    if (!shape || !shape.verts.length) return;
    const ctx = this.ctx;
    const v = shape.verts;
    const at = (i: number) => v[i].pts;
    if (shape.mode === C.POINTS) return v.forEach((p) => this.point(p.pts[0], p.pts[1]));
    if (shape.mode === C.LINES) {
      for (let i = 0; i + 1 < v.length; i += 2)
        this.line(at(i)[0], at(i)[1], at(i + 1)[0], at(i + 1)[1]);
      return;
    }
    if (shape.mode === C.TRIANGLES || shape.mode === C.QUADS) {
      const n = shape.mode === C.TRIANGLES ? 3 : 4;
      for (let i = 0; i + n <= v.length; i += n) this.poly(v.slice(i, i + n).flatMap((p) => p.pts));
      return;
    }
    if (shape.mode === C.TRIANGLE_FAN || shape.mode === C.TRIANGLE_STRIP) {
      for (let i = 2; i < v.length; i++) {
        const a = shape.mode === C.TRIANGLE_FAN ? 0 : i - 2;
        this.poly([...at(a), ...at(i - 1), ...at(i)]);
      }
      return;
    }
    ctx.beginPath();
    if (v.every((p) => p.kind === 'curve')) {
      // Catmull-Rom through the inner points; the first and last steer the ends, as in p5.
      const p = v.map((x) => x.pts);
      if (p.length < 4) return;
      ctx.moveTo(p[1][0], p[1][1]);
      for (let i = 1; i + 2 < p.length; i++) {
        const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
        ctx.bezierCurveTo(
          b[0] + (c[0] - a[0]) / 6,
          b[1] + (c[1] - a[1]) / 6,
          c[0] - (d[0] - b[0]) / 6,
          c[1] - (d[1] - b[1]) / 6,
          c[0],
          c[1]
        );
      }
    } else
      v.forEach((p, i) => {
        const q = p.pts;
        if (i === 0 || p.kind === 'v' || p.kind === 'curve')
          i === 0 ? ctx.moveTo(q[q.length - 2], q[q.length - 1]) : ctx.lineTo(q[0], q[1]);
        else if (p.kind === 'bezier') ctx.bezierCurveTo(q[0], q[1], q[2], q[3], q[4], q[5]);
        else ctx.quadraticCurveTo(q[0], q[1], q[2], q[3]);
      });
    if (mode === C.CLOSE) ctx.closePath();
    this.paint();
  }

  // ---- text ----
  // System fonts: the words of a film belong in its captions; this is for a number or a mark.

  textSize(s: number): void {
    this.style.textSize = s;
  }
  textFont(f: string): void {
    this.style.textFont = f;
  }
  textAlign(h: Mode, v: Mode = C.BASELINE): void {
    this.style.textAlign = [h, v];
  }
  text(s: string | number, x: number, y: number): void {
    const ctx = this.ctx;
    const [h, v] = this.style.textAlign;
    ctx.font = `${this.style.textSize}px ${this.style.textFont}`;
    ctx.textAlign = h as CanvasTextAlign;
    ctx.textBaseline = (v === C.CENTER ? 'middle' : v) as CanvasTextBaseline;
    if (this.style.fill) {
      ctx.fillStyle = this.style.fill;
      ctx.fillText(String(s), x, y);
    }
    if (this.style.stroke && this.style.strokeSet && this.style.weight > 0) {
      ctx.strokeStyle = this.style.stroke;
      ctx.lineWidth = this.style.weight;
      ctx.strokeText(String(s), x, y);
    }
  }

  // ---- images and pixels ----

  /** Draws a createGraphics layer (or a canvas) at (x, y), optionally scaled to w×h. */
  image(g: Sketch | Canvas, x: number, y: number, w?: number, h?: number): void {
    const src = g instanceof Sketch ? g.canvas : g;
    const sw = g instanceof Sketch ? g.width : src.width;
    const sh = g instanceof Sketch ? g.height : src.height;
    this.ctx.drawImage(src, x, y, w ?? sw, h ?? sh);
  }

  loadPixels(): void {
    this.pixelData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.pixels = this.pixelData.data;
  }
  updatePixels(): void {
    if (this.pixelData) this.ctx.putImageData(this.pixelData, 0, 0);
  }
  /** The colour at a design pixel, as [r, g, b, a]. */
  get(x: number, y: number): number[] {
    const d = this.density;
    return [...this.ctx.getImageData(Math.floor(x * d), Math.floor(y * d), 1, 1).data];
  }

  /** BLUR (radius in design px), GRAY, INVERT, THRESHOLD (0..1) or POSTERIZE (levels). */
  filter(kind: Mode, value?: number): void {
    if (kind === C.BLUR) {
      const copy = createCanvas(this.canvas.width, this.canvas.height);
      copy.getContext('2d').drawImage(this.canvas, 0, 0);
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'copy';
      ctx.filter = `blur(${(value ?? 1) * this.density}px)`;
      ctx.drawImage(copy, 0, 0);
      ctx.restore();
      return;
    }
    this.loadPixels();
    const px = this.pixels;
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      if (kind === C.INVERT) {
        px[i] = 255 - r;
        px[i + 1] = 255 - g;
        px[i + 2] = 255 - b;
      } else if (kind === C.POSTERIZE) {
        const n = Math.max(2, value ?? 4) - 1;
        for (let c = 0; c < 3; c++) px[i + c] = Math.round((px[i + c] / 255) * n) * (255 / n);
      } else {
        let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (kind === C.THRESHOLD) l = l >= (value ?? 0.5) * 255 ? 255 : 0;
        px[i] = px[i + 1] = px[i + 2] = l;
      }
    }
    this.updatePixels();
  }

  // ---- chance ----

  randomSeed(seed: number): void {
    this.rand = randomStream(seed);
    this.gauss = undefined;
  }
  /** random() in [0, 1); random(max); random(min, max); random(array) for one of its items. */
  random<T>(a?: number | T[], b?: number): number | T {
    const r = this.rand();
    if (Array.isArray(a)) return a[Math.floor(r * a.length)];
    if (a === undefined) return r;
    if (b === undefined) return r * a;
    return a + r * (b - a);
  }
  randomGaussian(mean = 0, sd = 1): number {
    if (this.gauss !== undefined) {
      const g = this.gauss;
      this.gauss = undefined;
      return mean + g * sd;
    }
    let u = 0;
    while (u === 0) u = this.rand();
    const v = this.rand();
    const m = Math.sqrt(-2 * Math.log(u));
    this.gauss = m * Math.sin(C.TWO_PI * v);
    return mean + m * Math.cos(C.TWO_PI * v) * sd;
  }
  noise(x: number, y = 0, z = 0): number {
    return this.noiseField.at(x, y, z);
  }
  noiseSeed(seed: number): void {
    this.noiseField.seed(seed);
  }
  noiseDetail(octaves: number, falloff = 0.5): void {
    this.noiseField.octaves = octaves;
    this.noiseField.falloff = falloff;
  }
  createVector(x = 0, y = 0, z = 0): Vector {
    return new Vector(x, y, z);
  }

  // ---- maths ----

  private rad(a: number): number {
    return this.angles === C.DEGREES ? (a * Math.PI) / 180 : a;
  }
  private fromRad(a: number): number {
    return this.angles === C.DEGREES ? (a * 180) / Math.PI : a;
  }
  sin = (a: number) => Math.sin(this.rad(a));
  cos = (a: number) => Math.cos(this.rad(a));
  tan = (a: number) => Math.tan(this.rad(a));
  asin = (v: number) => this.fromRad(Math.asin(v));
  acos = (v: number) => this.fromRad(Math.acos(v));
  atan = (v: number) => this.fromRad(Math.atan(v));
  atan2 = (y: number, x: number) => this.fromRad(Math.atan2(y, x));
  radians = (d: number) => (d * Math.PI) / 180;
  degrees = (r: number) => (r * 180) / Math.PI;
  abs = Math.abs;
  ceil = Math.ceil;
  floor = Math.floor;
  round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits;
  sqrt = Math.sqrt;
  sq = (v: number) => v * v;
  pow = Math.pow;
  exp = Math.exp;
  log = Math.log;
  min = (...v: (number | number[])[]) => Math.min(...v.flat());
  max = (...v: (number | number[])[]) => Math.max(...v.flat());
  fract = (v: number) => v - Math.floor(v);
  lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  constrain = (v: number, lo: number, hi: number) => clamp(v, lo, hi);
  norm = (v: number, a: number, b: number) => (v - a) / (b - a);
  dist = (...p: number[]) =>
    p.length === 4
      ? Math.hypot(p[2] - p[0], p[3] - p[1])
      : Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]);
  mag = (...p: number[]) => Math.hypot(...p);
  map(v: number, a: number, b: number, c: number, d: number, within = false): number {
    const r = c + ((v - a) / (b - a)) * (d - c);
    return within ? clamp(r, Math.min(c, d), Math.max(c, d)) : r;
  }
}

/** A fluid that draws into its sketch's canvas. */
export class SketchFluid extends Fluid {
  constructor(
    private readonly p: Sketch,
    options: Partial<FluidOptions>
  ) {
    super(p.width, p.height, p.canvas.width, p.canvas.height, options);
  }
  /** Paints the dye over the whole canvas; draw anything else on top after. */
  draw(look: Partial<FluidLook> = {}): void {
    const ctx = this.p.drawingContext;
    const img = ctx.createImageData(this.DW, this.DH);
    this.render(img.data, look);
    ctx.putImageData(img, 0, 0);
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function boxOf(mode: Mode, x: number, y: number, w: number, h: number): number[] {
  if (mode === C.CENTER) return [x - w / 2, y - h / 2, w, h];
  if (mode === C.RADIUS) return [x - w, y - h, w * 2, h * 2];
  if (mode === C.CORNERS) return [x, y, w - x, h - y];
  return [x, y, w, h];
}

function parseCss(s: string): SketchColor {
  const c = createCanvas(1, 1).getContext('2d');
  c.fillStyle = s;
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return new SketchColor([d[0], d[1], d[2], d[3]]);
}
