import { clamp01 } from './easing.js';
import type { Anchor, Scene, Weather } from './types.js';
import { mix } from './weather.js';

/**
 * Depth on a flat stage: how big things are drawn further back (the scene's `perspective`)
 * and how the air between fades them (aerial perspective, the haze on far actors).
 *
 * On flat ground, seen from a camera at eye height, something standing at floor y is drawn
 * in proportion to its distance below the horizon: scale ∝ (y − horizon). So two rows of the
 * floor, [y, scale] each, fix the whole line, run on past them both ways.
 */

/** Smaller than this, a spot is at or past the horizon: kept just visible. */
const SMALLEST = 0.05;

/** An anchor's scale off the scene's perspective by more than this share is a finding. */
const SCALE_OFF = 0.2;

/**
 * Aerial perspective: the farthest figures move this share of the way toward the air's
 * colour by default (`depth.haze`). Gentle: a face at the back of a yajna ground still reads.
 */
const HAZE = 0.35;
/**
 * The haze is full this many times further back than the nearest row (scale 1/HAZE_FAR of
 * it): distance ∝ 1/scale, so a figure two thirds the size of the front row is 1.5 times as
 * far, a third of the way to full haze.
 */
const HAZE_FAR = 2;
/** The pale air of a fair day, tinted by the scene's `weather.light` where it has none of its own. */
const DAY_AIR = '#dfe8f0';

/** The scene's perspective scale at floor depth y, or undefined when it declares none. */
export function perspectiveAt(scene: Pick<Scene, 'perspective'>, y: number): number | undefined {
  const p = scene.perspective;
  if (!p) return undefined;
  const [[y0, s0], [y1, s1]] = p;
  return Math.max(SMALLEST, s0 + ((y - y0) * (s1 - s0)) / (y1 - y0));
}

/** How far back an anchor or a spot is: where what it stands on meets the floor. */
export function depthOf(a: { y: number; floor?: number; ground?: number }): number {
  return a.ground ?? a.floor ?? a.y;
}

/** An anchor's scale: its own, else the scene's perspective at its depth, else 1. */
export function anchorScale(scene: Pick<Scene, 'perspective'>, a: Anchor): number {
  return a.scale ?? perspectiveAt(scene, depthOf(a)) ?? 1;
}

/**
 * A scale set by hand that disagrees with the scene's perspective by more than SCALE_OFF:
 * the scale it should be there. Undefined when the scene has no perspective or it agrees.
 */
export function offPerspective(
  scene: Pick<Scene, 'perspective'>,
  depth: number,
  scale: number | undefined
): number | undefined {
  if (scale === undefined) return undefined;
  const want = perspectiveAt(scene, depth);
  if (want === undefined) return undefined;
  return Math.abs(scale / want - 1) > SCALE_OFF ? want : undefined;
}

/** What the haze on a scene's actors is: the nearest row's scale, how strong, toward what. */
export interface Air {
  /** The scale of the scene's nearest row: no haze there or nearer. */
  near: number;
  /** The most it fades the farthest figures, 0..1. */
  amount: number;
  /** The air's colour, [r, g, b] 0..1. */
  rgb: [number, number, number];
}

const AIR = new WeakMap<Scene, { near: number; amount?: number; sky?: string }>();

/**
 * The haze on a scene's actors in this weather, or undefined when there is none: turned off
 * (`depth.haze: 0`), or nowhere for it to grow (no anchors to tell near from far).
 */
export function airOf(scene: Scene, w: Weather, ground: number): Air | undefined {
  let base = AIR.get(scene);
  if (!base) {
    base = {
      near: nearestRow(scene, ground),
      amount: scene.depth?.haze,
      sky: hex(scene.depth?.color) ?? skyColor(scene),
    };
    AIR.set(scene, base);
  }
  // By default less in the dark, where the faces have less light to read by already.
  const amount = base.amount ?? HAZE * (1 - 0.5 * (w.light?.amount ?? 0));
  if (amount <= 0 || !(base.near > 0)) return undefined;
  // A painted sky is already in the scene's light; the fallback daylight air is not.
  const color =
    base.sky ?? (w.light ? mix(DAY_AIR, w.light.color, (w.light.amount ?? 0.5) * 0.8) : DAY_AIR);
  return { near: base.near, amount, rgb: rgbOf(color) };
}

/** How much the haze fades an actor drawn at this perspective scale, 0..amount. */
export function hazeAt(air: Air | undefined, scale: number): number {
  if (!air || !(scale > 0)) return 0;
  return air.amount * clamp01((air.near / scale - 1) / (HAZE_FAR - 1));
}

/**
 * The scale of the scene's nearest row of figures: its biggest anchor (close-up anchors
 * drawn far bigger than the rest left out), else the perspective at the ground line.
 */
function nearestRow(scene: Scene, ground: number): number {
  const scales = Object.values(scene.anchors)
    .map((a) => anchorScale(scene, a))
    .sort((a, b) => a - b);
  if (!scales.length) return perspectiveAt(scene, ground) ?? 1;
  const median = scales[Math.floor(scales.length / 2)];
  return Math.max(...scales.filter((s) => s <= 1.6 * median));
}

/**
 * The horizon colour of a painted sky: the last stop of the first gradient in the far layer
 * (a sky is painted top to bottom, and its last stop is where it meets the land), else that
 * layer's first plain fill. Undefined without a far layer.
 */
export function skyColor(scene: Pick<Scene, 'far'>): string | undefined {
  const far = scene.far;
  if (!far) return undefined;
  const grad = /<linearGradient\b[\s\S]*?<\/linearGradient>/.exec(far);
  if (grad) {
    const stops = [...grad[0].matchAll(/stop-color\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const last = hex(stops[stops.length - 1]);
    if (last) return last;
  }
  const fill = /<(?:rect|path)\b[^>]*\bfill\s*=\s*['"](#[0-9a-fA-F]{3,6})['"]/.exec(far);
  return hex(fill?.[1]);
}

/** A colour as #rrggbb, or undefined when it is not a hex colour. */
function hex(c: string | undefined): string | undefined {
  if (!c) return undefined;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((d) => d + d).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

function rgbOf(c: string): [number, number, number] {
  const h = hex(c) ?? DAY_AIR;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
