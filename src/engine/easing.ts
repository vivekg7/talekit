export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
export const easeInOut = (u: number): number =>
  u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
export const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);
export const TAU = Math.PI * 2;

/** Deterministic 0..1 value from a string, used for per-actor phase offsets. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Progress through a move that speeds up over the first `r` of it, holds its speed and
 * slows down over the last `r`: velocity is a trapezoid, so nothing starts or stops dead.
 */
export function ramp(u: number, r: number): number {
  u = clamp01(u);
  if (r <= 0) return u;
  const top = 1 / (1 - r);
  if (u < r) return (top * u * u) / (2 * r);
  if (u > 1 - r) return 1 - (top * (1 - u) * (1 - u)) / (2 * r);
  return top * (u - r / 2);
}
