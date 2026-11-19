/**
 * A fluid for sketches: a CPU port of Pavel Dobryakov's WebGL Fluid Simulation, the look of
 * ink swirling in water or glowing smoke. Velocity lives on a coarse grid; the dye lives at
 * the canvas's own resolution, so stretched, folded dye shows fine filaments, and the light
 * comes from the dye's gradient. Pure and deterministic.
 *
 * Each step: vorticity confinement (keeps small swirls alive), divergence, a pressure solve
 * (red-black SOR, warm-started from the last step's), projection, then advection of the
 * velocity and of the dye (MacCormack, so filaments stay crisp). Drawn: shading from the dye
 * gradient, bloom, sun rays, then `c + bg·(1 − max(c))`, which reads as glowing dye on a
 * dark background and as ink (pale where thin, deep where dense) on a light one.
 */

export type RGB = [number, number, number];

export interface FluidOptions {
  /** Velocity cells across the frame's short side (default 256). */
  resolution: number;
  /** Vorticity confinement: 10-20 for coherent jets and round eddies, 30+ for turbulence. */
  curl: number;
  /** How fast motion dies away, per second. */
  velocityDissipation: number;
  /** How fast dye fades, per second: ~0.2 on a light page, ~1 on a dark one so it never floods. */
  dyeDissipation: number;
  pressureIterations: number;
  /** The share of last step's pressure the solve starts from. */
  pressureKeep: number;
  /** MacCormack dye advection: crisper filaments for about twice the cost. */
  sharp: boolean;
}

export interface FluidLook {
  /** The page under the dye, 0..1 per channel: dark for glow, white for ink. */
  background: RGB;
  /** Light from the dye's gradient: ridges and folds read as relief. */
  shading: boolean;
  /** Glow around bright dye; 0 is none. */
  bloom: number;
  bloomThreshold: number;
  bloomKnee: number;
  /** Light shafts from the centre through gaps in the dye; 0 is none, 1 strong. */
  sunrays: number;
  /** Multiplies the dye before it is drawn. */
  exposure: number;
}

const DEFAULTS: FluidOptions = {
  resolution: 256,
  curl: 30,
  velocityDissipation: 0.2,
  dyeDissipation: 0.15,
  pressureIterations: 30,
  pressureKeep: 0.8,
  sharp: true,
};

const LOOK: FluidLook = {
  background: [0, 0, 0],
  shading: true,
  bloom: 0.8,
  bloomThreshold: 0.6,
  bloomKnee: 0.7,
  sunrays: 0.8,
  exposure: 1,
};

/** A stable per-pixel jitter for the dither, so gradients do not band. */
function hash01(n: number, salt: number): number {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ Math.imul(salt | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function sample(f: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  let i = x | 0;
  let j = y | 0;
  if (i > w - 2) i = w - 2;
  if (j > h - 2) j = h - 2;
  const ax = x - i;
  const ay = y - j;
  const r = j * w + i;
  return (
    (f[r] * (1 - ax) + f[r + 1] * ax) * (1 - ay) + (f[r + w] * (1 - ax) + f[r + w + 1] * ax) * ay
  );
}

export class Fluid {
  /** Velocity grid size. */
  readonly SW: number;
  readonly SH: number;
  /** Dye size: the canvas's pixels. */
  readonly DW: number;
  readonly DH: number;
  /** Design px -> dye px. */
  private readonly k: number;
  /** Design px -> velocity cells. */
  private readonly s: number;
  /** Change them between steps to change the flow (dye that fades faster at the end, say). */
  readonly options: FluidOptions;
  private vx: Float32Array;
  private vy: Float32Array;
  private tx: Float32Array;
  private ty: Float32Array;
  private readonly curlF: Float32Array;
  private readonly div: Float32Array;
  private readonly pr: Float32Array;
  /** The dye, one field per channel, 0 = none; above 1 is dense (white-hot, deep ink). */
  dye: Float32Array[];
  private tmp: Float32Array[];
  private readonly back: Float32Array[];
  private frame = 0;

  /** `width`×`height` design px, drawn at `pixelWidth`×`pixelHeight`. */
  constructor(
    width: number,
    height: number,
    pixelWidth: number,
    pixelHeight: number,
    options: Partial<FluidOptions> = {}
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.DW = pixelWidth;
    this.DH = pixelHeight;
    this.k = pixelWidth / width;
    const short = Math.min(width, height);
    this.SW = Math.round((this.options.resolution * width) / short);
    this.SH = Math.round((this.options.resolution * height) / short);
    this.s = this.SW / width;
    const cells = () => new Float32Array(this.SW * this.SH);
    const pixels = () => [0, 1, 2].map(() => new Float32Array(this.DW * this.DH));
    this.vx = cells();
    this.vy = cells();
    this.tx = cells();
    this.ty = cells();
    this.curlF = cells();
    this.div = cells();
    this.pr = cells();
    this.dye = pixels();
    this.tmp = pixels();
    this.back = pixels();
  }

  /**
   * A gaussian puff at (x, y) of radius r (design px): adds velocity (vx, vy, px/s) and dye
   * `color` (added as given; times dt for a steady stream). An impulse.
   */
  splat(x: number, y: number, vx: number, vy: number, r: number, color?: RGB | null): void {
    if (vx || vy)
      this.forceBlob(x, y, r, (w, i) => {
        this.vx[i] += vx * this.s * w;
        this.vy[i] += vy * this.s * w;
      });
    if (color) this.dyeBlob(x, y, r, color);
  }

  /**
   * A steady nozzle: relaxes the velocity inside the puff toward (vx, vy) by `grip` (0..1)
   * each call, so calling it every step holds a jet at that speed instead of piling it up.
   */
  jet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    color?: RGB | null,
    grip = 0.5
  ): void {
    const tx = vx * this.s;
    const ty = vy * this.s;
    this.forceBlob(x, y, r, (w, i) => {
      const a = w * grip;
      this.vx[i] += (tx - this.vx[i]) * a;
      this.vy[i] += (ty - this.vy[i]) * a;
    });
    if (color) this.dyeBlob(x, y, r, color);
  }

  /** A whirl of `spin` px/s at radius r, clockwise on screen if positive. */
  swirl(x: number, y: number, r: number, spin: number): void {
    const s = this.s;
    const rr = r * s;
    this.eachCell(x * s - 0.5, y * s - 0.5, rr, (i, dx, dy, w) => {
      const d = Math.hypot(dx, dy) / rr + 1e-6;
      const g = (spin * s * w * Math.min(d, 1)) / d / rr;
      this.vx[i] -= dy * g;
      this.vy[i] += dx * g;
    });
  }

  private eachCell(
    cx: number,
    cy: number,
    rr: number,
    fn: (i: number, dx: number, dy: number, w: number) => void
  ): void {
    const { SW, SH } = this;
    const R = Math.ceil(rr * 3);
    const i0 = Math.max(0, Math.floor(cx - R));
    const i1 = Math.min(SW - 1, Math.ceil(cx + R));
    const j0 = Math.max(0, Math.floor(cy - R));
    const j1 = Math.min(SH - 1, Math.ceil(cy + R));
    const inv = 1 / (rr * rr);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx;
        const dy = j - cy;
        const w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w > 1e-4) fn(j * SW + i, dx, dy, w);
      }
  }

  private forceBlob(x: number, y: number, r: number, fn: (w: number, i: number) => void): void {
    const s = this.s;
    this.eachCell(x * s - 0.5, y * s - 0.5, Math.max(r * s, 0.7), (i, _dx, _dy, w) => fn(w, i));
  }

  private dyeBlob(x: number, y: number, r: number, c: RGB): void {
    const { k, DW, DH } = this;
    const cx = x * k - 0.5;
    const cy = y * k - 0.5;
    const rr = Math.max(r * k, 0.7);
    const R = Math.ceil(rr * 3);
    const i0 = Math.max(0, Math.floor(cx - R));
    const i1 = Math.min(DW - 1, Math.ceil(cx + R));
    const j0 = Math.max(0, Math.floor(cy - R));
    const j1 = Math.min(DH - 1, Math.ceil(cy + R));
    const inv = 1 / (rr * rr);
    const [d0, d1, d2] = this.dye;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx;
        const dy = j - cy;
        const w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w < 1e-4) continue;
        const n = j * DW + i;
        d0[n] += c[0] * w;
        d1[n] += c[1] * w;
        d2[n] += c[2] * w;
      }
  }

  /** Move the fluid on by dt seconds. Steps of a frame or less; two a frame for fast jets. */
  step(dt: number): void {
    const { SW, SH, vx, vy, div, pr } = this;
    const curl = this.curlF;
    const P = this.options;
    for (let j = 0; j < SH; j++)
      for (let i = 0; i < SW; i++) {
        const L = i > 0 ? i - 1 : i;
        const R = i < SW - 1 ? i + 1 : i;
        const T = j > 0 ? j - 1 : j;
        const B = j < SH - 1 ? j + 1 : j;
        curl[j * SW + i] =
          0.5 * (vy[j * SW + R] - vy[j * SW + L] - (vx[B * SW + i] - vx[T * SW + i]));
      }
    // Confinement pushes along N × ω, N the gradient of |ω|.
    for (let j = 1; j < SH - 1; j++)
      for (let i = 1; i < SW - 1; i++) {
        const n = j * SW + i;
        let fx = 0.5 * (Math.abs(curl[n + SW]) - Math.abs(curl[n - SW]));
        let fy = 0.5 * (Math.abs(curl[n + 1]) - Math.abs(curl[n - 1]));
        const c = (curl[n] * P.curl) / (Math.hypot(fx, fy) + 1e-4);
        fx *= c;
        fy *= c;
        vx[n] += fx * dt;
        vy[n] -= fy * dt;
      }
    // Divergence, with walls that reflect.
    for (let j = 0; j < SH; j++)
      for (let i = 0; i < SW; i++) {
        const n = j * SW + i;
        const L = i > 0 ? vx[n - 1] : -vx[n];
        const R = i < SW - 1 ? vx[n + 1] : -vx[n];
        const T = j > 0 ? vy[n - SW] : -vy[n];
        const B = j < SH - 1 ? vy[n + SW] : -vy[n];
        div[n] = 0.5 * (R - L + B - T);
      }
    for (let n = 0; n < pr.length; n++) pr[n] *= P.pressureKeep;
    const om = 1.7;
    for (let it = 0; it < P.pressureIterations; it++)
      for (let parity = 0; parity < 2; parity++)
        for (let j = 0; j < SH; j++) {
          const row = j * SW;
          for (let i = (j + parity) & 1; i < SW; i += 2) {
            const n = row + i;
            const c = pr[n];
            const L = i > 0 ? pr[n - 1] : c;
            const R = i < SW - 1 ? pr[n + 1] : c;
            const T = j > 0 ? pr[n - SW] : c;
            const B = j < SH - 1 ? pr[n + SW] : c;
            pr[n] = c + om * ((L + R + T + B - div[n]) * 0.25 - c);
          }
        }
    for (let j = 0; j < SH; j++)
      for (let i = 0; i < SW; i++) {
        const n = j * SW + i;
        const c = pr[n];
        const L = i > 0 ? pr[n - 1] : c;
        const R = i < SW - 1 ? pr[n + 1] : c;
        const T = j > 0 ? pr[n - SW] : c;
        const B = j < SH - 1 ? pr[n + SW] : c;
        vx[n] -= 0.5 * (R - L);
        vy[n] -= 0.5 * (B - T);
      }
    const { tx, ty } = this;
    const vd = 1 / (1 + P.velocityDissipation * dt);
    for (let j = 0; j < SH; j++)
      for (let i = 0; i < SW; i++) {
        const n = j * SW + i;
        const x = i - dt * vx[n];
        const y = j - dt * vy[n];
        tx[n] = sample(vx, SW, SH, x, y) * vd;
        ty[n] = sample(vy, SW, SH, x, y) * vd;
      }
    this.vx = tx;
    this.tx = vx;
    this.vy = ty;
    this.ty = vy;
    this.advectDye(dt);
  }

  private advectDye(dt: number): void {
    const { DW, DH, SW, SH, vx, vy, dye, tmp, back } = this;
    const q = SW / DW;
    const iq = DW / SW;
    const dd = 1 / (1 + this.options.dyeDissipation * dt);
    // Back-trace each dye pixel through the coarse velocity.
    for (let j = 0; j < DH; j++) {
      const sy = (j + 0.5) * q - 0.5;
      for (let i = 0; i < DW; i++) {
        const sx = (i + 0.5) * q - 0.5;
        const ux = sample(vx, SW, SH, sx, sy);
        const uy = sample(vy, SW, SH, sx, sy);
        const X = (sx - dt * ux + 0.5) * iq - 0.5;
        const Y = (sy - dt * uy + 0.5) * iq - 0.5;
        const n = j * DW + i;
        for (let c = 0; c < 3; c++) tmp[c][n] = sample(dye[c], DW, DH, X, Y);
      }
    }
    if (!this.options.sharp) {
      for (const t of tmp) for (let n = 0; n < t.length; n++) t[n] *= dd;
      this.dye = tmp;
      this.tmp = dye;
      return;
    }
    // MacCormack: trace the result forward again, take half the round trip's error off,
    // clamped to the four source pixels so it never rings.
    for (let j = 0; j < DH; j++) {
      const sy = (j + 0.5) * q - 0.5;
      for (let i = 0; i < DW; i++) {
        const sx = (i + 0.5) * q - 0.5;
        const ux = sample(vx, SW, SH, sx, sy);
        const uy = sample(vy, SW, SH, sx, sy);
        const fX = (sx + dt * ux + 0.5) * iq - 0.5;
        const fY = (sy + dt * uy + 0.5) * iq - 0.5;
        const n = j * DW + i;
        for (let c = 0; c < 3; c++) back[c][n] = sample(tmp[c], DW, DH, fX, fY);
      }
    }
    for (let j = 0; j < DH; j++) {
      const sy = (j + 0.5) * q - 0.5;
      for (let i = 0; i < DW; i++) {
        const sx = (i + 0.5) * q - 0.5;
        const ux = sample(vx, SW, SH, sx, sy);
        const uy = sample(vy, SW, SH, sx, sy);
        let X = (sx - dt * ux + 0.5) * iq - 0.5;
        let Y = (sy - dt * uy + 0.5) * iq - 0.5;
        if (X < 0) X = 0;
        else if (X > DW - 1) X = DW - 1;
        if (Y < 0) Y = 0;
        else if (Y > DH - 1) Y = DH - 1;
        let a = X | 0;
        let b = Y | 0;
        if (a > DW - 2) a = DW - 2;
        if (b > DH - 2) b = DH - 2;
        const r = b * DW + a;
        const n = j * DW + i;
        for (let c = 0; c < 3; c++) {
          const d = dye[c];
          const p0 = d[r];
          const p1 = d[r + 1];
          const p2 = d[r + DW];
          const p3 = d[r + DW + 1];
          let v = tmp[c][n] + 0.5 * (d[n] - back[c][n]);
          const lo = Math.min(p0, p1, p2, p3);
          const hi = Math.max(p0, p1, p2, p3);
          if (v < lo) v = lo;
          else if (v > hi) v = hi;
          tmp[c][n] = v * dd;
        }
      }
    }
    this.dye = tmp;
    this.tmp = dye;
  }

  /** The dye as a picture, into `out` (RGBA, the dye's size), every pixel opaque. */
  render(out: Uint8ClampedArray, look: Partial<FluidLook> = {}): void {
    display(this, { ...LOOK, ...look }, out, this.frame++);
  }
}

function boxDown(
  src: Float32Array,
  w: number,
  h: number,
  f: number
): [Float32Array, number, number] {
  const W = Math.max(1, Math.floor(w / f));
  const H = Math.max(1, Math.floor(h / f));
  const out = new Float32Array(W * H);
  const inv = 1 / (f * f);
  for (let J = 0; J < H; J++)
    for (let I = 0; I < W; I++) {
      let s = 0;
      for (let y = 0; y < f; y++) {
        const row = (J * f + y) * w + I * f;
        for (let x = 0; x < f; x++) s += src[row + x];
      }
      out[J * W + I] = s * inv;
    }
  return [out, W, H];
}

function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const a = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const n = j * w + i;
      a[n] = 0.25 * src[n - (i > 0 ? 1 : 0)] + 0.5 * src[n] + 0.25 * src[n + (i < w - 1 ? 1 : 0)];
    }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const n = j * w + i;
      b[n] = 0.25 * a[n - (j > 0 ? w : 0)] + 0.5 * a[n] + 0.25 * a[n + (j < h - 1 ? w : 0)];
    }
  return b;
}

/** A wide soft glow: a pyramid of blurred half-size copies summed back up. */
function bloomChannel(src: Float32Array, w: number, h: number, levels: number): Float32Array {
  const pyr: [Float32Array, number, number][] = [[blur3(src, w, h), w, h]];
  for (let l = 1; l < levels; l++) {
    const [p, pw, ph] = pyr[l - 1];
    if (pw < 4 || ph < 4) break;
    const [d, dw, dh] = boxDown(p, pw, ph, 2);
    pyr.push([blur3(d, dw, dh), dw, dh]);
  }
  let [acc, aw, ah] = pyr[pyr.length - 1];
  for (let l = pyr.length - 2; l >= 0; l--) {
    const [p, pw, ph] = pyr[l];
    const up = new Float32Array(pw * ph);
    for (let j = 0; j < ph; j++)
      for (let i = 0; i < pw; i++)
        up[j * pw + i] =
          p[j * pw + i] +
          sample(acc, aw, ah, (i + 0.5) * (aw / pw) - 0.5, (j + 0.5) * (ah / ph) - 0.5);
    acc = up;
    aw = pw;
    ah = ph;
  }
  const inv = 1 / pyr.length;
  for (let n = 0; n < acc.length; n++) acc[n] *= inv;
  return acc;
}

const encode = (v: number) => Math.max(1.055 * Math.pow(Math.max(v, 0), 0.416666667) - 0.055, 0);

function display(f: Fluid, look: FluidLook, out: Uint8ClampedArray, frameNo: number): void {
  const { DW, DH } = f;
  const [d0, d1, d2] = f.dye;
  const ex = look.exposure;
  // Bloom and sun rays work on a quarter-size copy.
  const BF = 4;
  let bloom: Float32Array[] | undefined;
  let rays: Float32Array | undefined;
  let bw = 0;
  let bh = 0;
  if (look.bloom > 0 || look.sunrays > 0) {
    const pre = [0, 1, 2].map(() => new Float32Array(DW * DH));
    const mask = new Float32Array(DW * DH);
    const thr = look.bloomThreshold;
    const knee = look.bloomKnee;
    for (let n = 0; n < DW * DH; n++) {
      const r = d0[n] * ex;
      const g = d1[n] * ex;
      const b = d2[n] * ex;
      const br = Math.max(r, g, b);
      let rq = Math.min(Math.max(br - (thr - knee), 0), knee * 2);
      rq = (0.25 / knee) * rq * rq;
      const m = Math.max(rq, br - thr) / Math.max(br, 1e-4);
      pre[0][n] = r * m;
      pre[1][n] = g * m;
      pre[2][n] = b * m;
      mask[n] = 1 - Math.min(br, 1);
    }
    const small = pre.map((p) => boxDown(p, DW, DH, BF));
    bw = small[0][1];
    bh = small[0][2];
    if (look.bloom > 0) bloom = small.map(([p]) => bloomChannel(p, bw, bh, 8));
    if (look.sunrays > 0) {
      const [m] = boxDown(mask, DW, DH, BF);
      const rr = new Float32Array(bw * bh);
      const N = 16;
      const dens = 0.3;
      const decay = 0.95;
      let norm = 1;
      let dcy = 1;
      for (let s = 0; s < N; s++) {
        norm += dcy;
        dcy *= decay;
      }
      for (let j = 0; j < bh; j++)
        for (let i = 0; i < bw; i++) {
          let x = i;
          let y = j;
          const dx = ((i - bw / 2) / N) * dens;
          const dy = ((j - bh / 2) / N) * dens;
          let acc = sample(m, bw, bh, x, y);
          let ill = 1;
          for (let s = 0; s < N; s++) {
            x -= dx;
            y -= dy;
            acc += sample(m, bw, bh, x, y) * ill;
            ill *= decay;
          }
          rr[j * bw + i] = acc / norm;
        }
      rays = blur3(blur3(rr, bw, bh), bw, bh);
    }
  }
  const tl = Math.hypot(1 / DW, 1 / DH);
  const [br, bgc, bb] = look.background;
  const sr = look.sunrays;
  const bi = look.bloom;
  for (let j = 0; j < DH; j++)
    for (let i = 0; i < DW; i++) {
      const n = j * DW + i;
      let r = d0[n] * ex;
      let g = d1[n] * ex;
      let b = d2[n] * ex;
      if (look.shading) {
        const L = i > 0 ? n - 1 : n;
        const R = i < DW - 1 ? n + 1 : n;
        const T = j > 0 ? n - DW : n;
        const B = j < DH - 1 ? n + DW : n;
        const dx = (Math.hypot(d0[R], d1[R], d2[R]) - Math.hypot(d0[L], d1[L], d2[L])) * ex;
        const dy = (Math.hypot(d0[B], d1[B], d2[B]) - Math.hypot(d0[T], d1[T], d2[T])) * ex;
        const shade = Math.min(Math.max(tl / Math.hypot(dx, dy, tl) + 0.7, 0.7), 1);
        r *= shade;
        g *= shade;
        b *= shade;
      }
      const bx = (i + 0.5) / BF - 0.5;
      const by = (j + 0.5) / BF - 0.5;
      const sun = rays ? 1 - sr + sr * 1.6 * sample(rays, bw, bh, bx, by) : 1;
      if (bloom) {
        const nz = (hash01(i + j * 7919, frameNo) - 0.5) / 255;
        r = r * sun + encode(sample(bloom[0], bw, bh, bx, by) * bi * sun + nz);
        g = g * sun + encode(sample(bloom[1], bw, bh, bx, by) * bi * sun + nz);
        b = b * sun + encode(sample(bloom[2], bw, bh, bx, by) * bi * sun + nz);
      } else {
        r *= sun;
        g *= sun;
        b *= sun;
      }
      const k = 1 - Math.max(r, g, b);
      const dn = hash01(n, frameNo + 977) - 0.5;
      const o = n * 4;
      // Uint8ClampedArray rounds and clamps.
      out[o] = (r + br * k) * 255 + dn;
      out[o + 1] = (g + bgc * k) * 255 + dn;
      out[o + 2] = (b + bb * k) * 255 + dn;
      out[o + 3] = 255;
    }
}
