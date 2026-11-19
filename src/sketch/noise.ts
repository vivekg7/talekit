/**
 * The sketch API's chance: a seeded random stream and p5's Perlin noise, so a sketch draws
 * the same frames on every run (rendering stays deterministic). Pure.
 */

/** mulberry32: a small, fast stream of floats in [0, 1) from a 32-bit seed. */
export function randomStream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const YWRAPB = 4;
const YWRAP = 1 << YWRAPB;
const ZWRAPB = 8;
const ZWRAP = 1 << ZWRAPB;
const SIZE = 4095;
const cosine = (i: number) => 0.5 * (1 - Math.cos(i * Math.PI));

/**
 * p5's `noise()`: smooth value noise over up to three dimensions, `octaves` layers each
 * `falloff` as strong as the one before, in [0, 1). Same algorithm, so a p5 sketch's noise
 * fields move the way they do in the browser (though not the same values: p5 fills its
 * table from an unseeded Math.random).
 */
export class Noise {
  private table = new Float64Array(SIZE + 1);
  octaves = 4;
  falloff = 0.5;

  constructor(seed = 0) {
    this.seed(seed);
  }

  seed(seed: number): void {
    const next = randomStream(seed ^ 0x9e3779b9);
    for (let i = 0; i <= SIZE; i++) this.table[i] = next();
  }

  at(x: number, y = 0, z = 0): number {
    const p = this.table;
    if (x < 0) x = -x;
    if (y < 0) y = -y;
    if (z < 0) z = -z;
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let zi = Math.floor(z);
    let xf = x - xi;
    let yf = y - yi;
    let zf = z - zi;
    let r = 0;
    let amp = 0.5;
    for (let o = 0; o < this.octaves; o++) {
      let of = xi + (yi << YWRAPB) + (zi << ZWRAPB);
      const rx = cosine(xf);
      const ry = cosine(yf);
      let n1 = p[of & SIZE];
      n1 += rx * (p[(of + 1) & SIZE] - n1);
      let n2 = p[(of + YWRAP) & SIZE];
      n2 += rx * (p[(of + YWRAP + 1) & SIZE] - n2);
      n1 += ry * (n2 - n1);
      of += ZWRAP;
      n2 = p[of & SIZE];
      n2 += rx * (p[(of + 1) & SIZE] - n2);
      let n3 = p[(of + YWRAP) & SIZE];
      n3 += rx * (p[(of + YWRAP + 1) & SIZE] - n3);
      n2 += ry * (n3 - n2);
      n1 += cosine(zf) * (n2 - n1);
      r += n1 * amp;
      amp *= this.falloff;
      xi <<= 1;
      xf *= 2;
      yi <<= 1;
      yf *= 2;
      zi <<= 1;
      zf *= 2;
      if (xf >= 1) {
        xi++;
        xf--;
      }
      if (yf >= 1) {
        yi++;
        yf--;
      }
      if (zf >= 1) {
        zi++;
        zf--;
      }
    }
    return r;
  }
}
