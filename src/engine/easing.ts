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
