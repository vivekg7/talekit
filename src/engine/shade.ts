/**
 * The house shading: every part gets a shaded side away from the light and, by a fire, a
 * warm rim on the side toward it, drawn by the engine rather than the artist, the same way
 * it draws the outline (outline.ts). Flat parts read as cut paper; a part with a dark side
 * reads as a round thing in a lit world, and because the light is one direction in the
 * world, a whole cast is lit alike, whoever drew it.
 *
 * How: a part's silhouette (its outline underlay with no widening) is drawn over the part in
 * the shade colour, masked by the same silhouette nudged toward the light, so only the far
 * side shows, a crescent on a round head and a strip down the back of a leg. The nudge is
 * turned into each part's own frame, so a swinging arm keeps its shade on the side away
 * from the light, and mirrored with the actor, so facing left does not flip the light.
 */
import { outlineFor } from './outline.js';
import { n } from './svg.js';

export interface Light {
  /** Unit vector toward the light, in the world (y down): from up and to the left by day. */
  toward: [number, number];
  /** Opacity of the shaded side, 0 for none. */
  shade: number;
  /** A coloured light on one side (a fire): a rim of `color` on the parts facing it. */
  rim?: { toward: [number, number]; color: string; amount: number };
}

/** Daylight from high up to the left, as the scenes are painted. */
export const DAYLIGHT: Light = { toward: [-0.5, -0.87], shade: 0.2 };

/** The shade's colour: a cool dark, so a shaded side reads as shadow and not as dirt. */
const SHADE_COLOR = '#24184a';

/** How far the lit copy is nudged, as a fraction of the rig's height: the shade's depth. */
const SHADE_DEPTH = 0.06;
const RIM_DEPTH = 0.035;

/** A short stable hash, so masks with the same content share an id and others never do. */
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** `v` turned by -deg, into the frame of a part that the pose has turned by deg. */
function unturn([x, y]: [number, number], deg: number): [number, number] {
  const r = (-deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}

/**
 * The silhouette of `svg` painted `color`, under the part where the light misses it: what
 * is left of it once a copy nudged `by` toward the light has been taken away.
 */
function crescent(
  sil: string,
  by: [number, number],
  color: string,
  opacity: number,
  box: Box,
  joined = ''
) {
  const id = `tk-shade-${hashId(`${sil}|${joined}|${n(by[0])}|${n(by[1])}`)}`;
  const region = `x='${box.x}' y='${box.y}' width='${box.w}' height='${box.h}'`;
  return (
    `<mask id='${id}' maskUnits='userSpaceOnUse' ${region}>` +
    `<rect ${region} fill='#fff'/><g transform='translate(${n(by[0])} ${n(by[1])})'>${paint(sil + joined, '#000')}</g></mask>` +
    `<g mask='url(#${id})' opacity='${n(opacity)}'>${paint(sil, color)}</g>`
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The silhouette was drawn in a placeholder colour; repaint it. */
const SIL_COLOR = '#010203';
const paint = (sil: string, color: string) => sil.replaceAll(SIL_COLOR, color);

/** A part's solid shapes as one silhouette; line work is left out, as the outline leaves it. */
export const silhouette = (svg: string, line: string): string =>
  outlineFor(svg, line, 0, SIL_COLOR);

/**
 * The shading drawn over one part (in the part's own frame), turned by `rot` degrees in the
 * world and mirrored when `side` is -1. Empty when the part has nothing solid to shade.
 * `joined` is the silhouette of the part this one is fused into (`Rig.fuse`), already in
 * this part's frame: the two shade as one shape, so no shaded edge runs where they meet.
 */
export function shadePart(
  svg: string,
  rot: number,
  side: number,
  light: Light,
  rig: { width: number; height: number },
  line: string,
  joined = ''
): string {
  if (light.shade <= 0 && !light.rim) return '';
  const sil = silhouette(svg, line);
  if (!sil) return '';
  const box = { x: -rig.width, y: -rig.height, w: 3 * rig.width, h: 3 * rig.height };
  const local = (v: [number, number], depth: number): [number, number] => {
    const [x, y] = unturn([v[0] * side, v[1]], rot);
    return [x * depth * rig.height, y * depth * rig.height];
  };
  let out = '';
  if (light.shade > 0)
    out += crescent(sil, local(light.toward, SHADE_DEPTH), SHADE_COLOR, light.shade, box, joined);
  if (light.rim && light.rim.amount > 0.02) {
    // The rim is the lit edge: what is left once a copy nudged away from the fire is taken.
    const [x, y] = local(light.rim.toward, RIM_DEPTH);
    out += crescent(sil, [-x, -y], light.rim.color, light.rim.amount, box, joined);
  }
  return out;
}
