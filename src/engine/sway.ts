import { fragmentBox } from './cull.js';
import { hash01, TAU } from './easing.js';
import { n } from './svg.js';
import type { Scene } from './types.js';

/**
 * Scenery that sways: groups of a scene's SVG (`Scene.sway`, by their `<g id>`) turned a
 * little about a pivot every frame, a tree's crown about the top of its trunk, a clump of
 * grass about its foot. Pure in time, like the weather.
 */

export type Sway = NonNullable<Scene['sway']>;

/** A group found in a layer: where its opening tag is, and how far it reaches from its pivot. */
interface Found {
  start: number;
  end: number;
  tag: string;
  reach: number;
}

/** What each layer string holds, worked out once: the scene's art does not change per frame. */
const found = new Map<string, Map<string, Found>>();

/** The `<g>` with each id in a fragment: where its opening tag is. */
function locate(svg: string, ids: string[]): Map<string, Found> {
  const out = new Map<string, Found>();
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`<g\\b[^>]*?\\bid=(['"])${esc}\\1[^>]*?>`).exec(svg);
    if (m) out.set(id, { start: m.index, end: m.index + m[0].length, tag: m[0], reach: 0 });
  }
  return out;
}

/** How far the furthest corner of a box is from (px, py). */
const reachOf = ([x0, y0, x1, y1]: [number, number, number, number], px: number, py: number) =>
  Math.max(1, ...[x0, x1].flatMap((x) => [y0, y1].map((y) => Math.hypot(x - px, y - py))));

/** The groups of `sway` that a layer holds, with how far each reaches from its pivot. */
function groupsIn(svg: string, sway: Sway): Map<string, Found> {
  const key = JSON.stringify(sway) + '\u0000' + svg;
  let got = found.get(key);
  if (!got) {
    if (found.size > 64) found.clear();
    got = locate(svg, Object.keys(sway));
    for (const [id, f] of got) {
      const box = fragmentBox(svg.slice(f.end, closeOf(svg, f.end)));
      f.reach = box ? reachOf(box, ...sway[id].at) : 100;
    }
    found.set(key, got);
  }
  return got;
}

/** Where the `</g>` that closes a group opened just before `from` is. */
function closeOf(svg: string, from: number): number {
  let depth = 1;
  const re = /<(\/?)g\b[^>]*?(\/?)>/g;
  re.lastIndex = from;
  for (let t = re.exec(svg); t; t = re.exec(svg)) {
    if (t[2]) continue;
    depth += t[1] ? -1 : 1;
    if (depth === 0) return t.index;
  }
  return svg.length;
}

/**
 * How far a swaying group is turned at t, degrees clockwise: a slow sway either way, a
 * second, quicker one on top so it never looks like a pendulum, each group in its own
 * phase. The bigger it is (`reach`, scene pixels from its pivot to its far edge) the less
 * and the slower it moves: a crown a degree or two over about five seconds, a tuft of grass
 * a few degrees over three. Wind (-1..1, positive to the right) swings it further and
 * quicker and leans it the way the wind blows.
 */
export function swayAngle(id: string, reach: number, amount: number, t: number, wind = 0): number {
  const w = Math.min(1, Math.abs(wind));
  const amp = amount * Math.min(6, Math.max(0.5, 28 / Math.sqrt(reach))) * (1 + 2.5 * w);
  const period = (2.6 + 0.9 * Math.sqrt(reach / 50)) / (1 + 1.2 * w);
  const phi = hash01(`sway:${id}`);
  const lean = 0.8 * amp * Math.sign(wind) * w;
  return (
    lean +
    amp *
      (0.75 * Math.sin((TAU * t) / period + TAU * phi) +
        0.25 * Math.sin((TAU * t) / (0.57 * period) + 2 * TAU * phi))
  );
}

/** A layer of a scene with its swaying groups turned for time t. */
export function swayLayer(
  svg: string | undefined,
  sway: Sway | undefined,
  t: number,
  wind = 0
): string {
  if (!svg || !sway) return svg ?? '';
  const groups = groupsIn(svg, sway);
  if (!groups.size) return svg;
  // From the end back, so earlier positions stay good.
  let out = svg;
  for (const [id, f] of [...groups].sort((a, b) => b[1].start - a[1].start)) {
    const { at, amount } = sway[id];
    const deg = swayAngle(id, f.reach, amount ?? 1, t, wind);
    const rot = `rotate(${n(deg)} ${n(at[0])} ${n(at[1])})`;
    // Turned in the layer's own coordinates, before any transform of its own.
    const tag = /\btransform=(['"])/.test(f.tag)
      ? f.tag.replace(/\btransform=(['"])/, `transform=$1${rot} `)
      : f.tag.replace(/^<g\b/, `<g transform='${rot}'`);
    out = out.slice(0, f.start) + tag + out.slice(f.end);
  }
  return out;
}

/** The ids in `sway` that no layer of the scene has a `<g id>` for. */
export function swayMissing(scene: Scene): string[] {
  if (!scene.sway) return [];
  const layers = [scene.svg, scene.far, scene.near, scene.foreground].filter(Boolean) as string[];
  return Object.keys(scene.sway).filter((id) => !layers.some((l) => locate(l, [id]).has(id)));
}

/** Where a swaying group is, in its layer: its box, for the checks. */
export function swayBox(scene: Scene, id: string): [number, number, number, number] | undefined {
  for (const l of [scene.svg, scene.foreground, scene.far, scene.near]) {
    if (!l) continue;
    const f = locate(l, [id]).get(id);
    if (f) return fragmentBox(l.slice(f.end, closeOf(l, f.end)));
  }
  return undefined;
}
