/**
 * Cast shadows: every person, animal and grounded prop throws its own silhouette across the
 * floor, away from each light in the scene. The ground shadow under the feet (actor.ts) is
 * the soft dark where the body meets the floor; this is the shape the light makes of it,
 * so a sun low in the sky stretches everyone's shadow long and a lamp throws them away
 * from itself, each by how far off it stands.
 *
 * Lights are the scene's `sun` and `fire` effects, which the engine draws, and its `lights`
 * for sources painted into the art (a moon, a hanging bulb, a lantern on a post). A sky
 * light is far away: its rays are parallel and only its place in the sky matters, high for
 * short shadows and low for long ones. Being in the picture, it is behind the stage, so the
 * shadows come forward, toward the viewer. A lamp stands on the stage among the actors and
 * throws them sideways along the floor, longer the lower it hangs and the further off the
 * actor is, and fainter with distance.
 *
 * How: the actor is drawn again, unshaded, flattened onto the floor by an affine map that
 * keeps the line where it stands and moves each point by its height above it, then painted
 * one dark colour, softened and faded toward its far end.
 */
import { castsShadow, characterBody, placeCharacter, sideOf } from './actor.js';
import { clamp01 } from './easing.js';
import { effectLayer, type FireLight } from './effects.js';
import type { Pose } from './motion.js';
import { n } from './svg.js';
import type { ActorState } from './timeline.js';
import type { Scene, Weather } from './types.js';

/** A light that casts shadows, in stage coordinates. */
export interface CastLight {
  kind: 'sky' | 'lamp';
  x: number;
  y: number;
  /** 0..1: how dark a shadow it throws at full strength. */
  strength: number;
  /** lamp: how far its light reaches, scene pixels. */
  reach: number;
}

/** How dark a shadow is at strength 1, from a sky light and from a lamp. */
const SKY_DARK = 0.4;
const LAMP_DARK = 0.6;
/** A lamp in daylight hardly shows; how much of its shadow is left when nothing is dark. */
const LAMP_BY_DAY = 0.3;
/** How flat the floor is seen: one pixel toward the viewer on the floor is this on screen. */
const FLOOR_DEPTH = 0.4;
/** Longest shadow, in heights of what casts it, however low the light. */
const LONGEST = 2.4;
/** How soft the edge is, scene pixels, and how faint the far end gets (0 not at all). */
const BLUR = 1.6;
const FADE = 0.6;
/** The shadow's colour: a cool dark, as the shaded side is. */
const SHADOW_RGB = [0.1, 0.07, 0.17];

/**
 * The lights that cast shadows in this frame: the scene's own `lights`, its sun, and its
 * fires on the stage (flickering, so the shadows waver with the flames).
 */
export function castLights(scene: Scene, fires: FireLight[]): CastLight[] {
  const out: CastLight[] = [];
  for (const l of scene.lights)
    out.push({
      kind: l.kind === 'lamp' ? 'lamp' : 'sky',
      x: l.x,
      y: l.y,
      strength: l.strength ?? (l.kind === 'moon' ? 0.55 : 1),
      reach: l.reach ?? 700,
    });
  // A sun drawn by the engine is a light too, unless the scene already placed one.
  if (!scene.lights.some((l) => l.kind === 'sun'))
    for (const e of scene.effects)
      if (e.kind === 'sun' && effectLayer(e) === 'far')
        out.push({ kind: 'sky', x: e.x ?? 0, y: e.y, strength: 1, reach: 0 });
  for (const f of fires)
    out.push({ kind: 'lamp', x: f.x, y: f.y, strength: f.strength, reach: f.radius * 1.6 });
  return out;
}

/** How much clouds and rain dim the sun's shadows: 1 clear, toward 0 overcast. */
function skyClear(w: Weather): number {
  const cover =
    clamp01(((w.clouds?.amount ?? 0) - 0.2) / 0.6) * (0.6 + 0.4 * (w.clouds?.dark ?? 0));
  const rain = clamp01((w.rain?.amount ?? 0) * 1.5);
  return (1 - cover) * (1 - 0.8 * rain);
}

/**
 * The floor map for one actor and one light: a point `h` above the floor at `gy` moves
 * `along` × h sideways and `up` × h up the screen (negative: down it, toward the viewer).
 */
export interface Throw {
  along: number;
  up: number;
  opacity: number;
}

/** How a light throws the shadow of something `height` tall standing at (x, gy). */
export function throwOf(
  light: CastLight,
  x: number,
  gy: number,
  height: number,
  frameW: number,
  frameH: number,
  w: Weather
): Throw | undefined {
  const night = w.light?.amount ?? 0;
  if (light.kind === 'sky') {
    // Elevation from where it hangs in the sky: high up short shadows, near the horizon long.
    const high = clamp01((0.78 * frameH - light.y) / (0.7 * frameH));
    const elevation = ((14 + 50 * high) * Math.PI) / 180;
    const length = Math.min(LONGEST, 1 / Math.tan(elevation));
    // The light is far behind the stage: the shadow points away from it across the floor
    // and forward, toward the viewer, more forward the more nearly in line it is.
    const dx = x - light.x;
    const across = dx / Math.hypot(dx, 0.45 * frameW);
    const forward = Math.sqrt(1 - across * across);
    const opacity = SKY_DARK * light.strength * skyClear(w);
    if (opacity < 0.02) return undefined;
    return { along: length * across, up: -length * forward * FLOOR_DEPTH, opacity };
  }
  // A lamp on the stage: the shadow runs along the floor away from it, as long as the
  // middle of the body is from the floor over how far the lamp is above that.
  const above = gy - light.y;
  const dist = Math.hypot(x - light.x, above);
  const near = 1 - dist / light.reach;
  if (near <= 0) return undefined;
  const room = Math.max(above - 0.5 * height, 0.25 * Math.max(above, height));
  const along = Math.max(-LONGEST, Math.min(LONGEST, (x - light.x) / room));
  const opacity = LAMP_DARK * light.strength * near * (LAMP_BY_DAY + (1 - LAMP_BY_DAY) * night);
  if (opacity < 0.02) return undefined;
  // Along the floor, a little up the screen as the floor goes back.
  return { along, up: 0.16 + 0.06 * Math.abs(along), opacity };
}

/**
 * The affine map that lays a figure standing on `gy` down on the floor: x' = x + along ×
 * (gy - y), y' = gy - up × (gy - y). The floor line stays; height becomes reach.
 */
export function floorMap(th: Throw, gy: number): string {
  const { along: a, up: b } = th;
  return `matrix(1 0 ${n(-a)} ${n(b)} ${n(a * gy)} ${n(gy * (1 - b))})`;
}

/** Defined once per frame: the dark the silhouettes are painted. */
export const CAST_DEFS =
  `<filter id='tk-cast' x='-20%' y='-20%' width='140%' height='140%' color-interpolation-filters='sRGB'>` +
  `<feColorMatrix type='matrix' values='0 0 0 0 ${SHADOW_RGB[0]} 0 0 0 0 ${SHADOW_RGB[1]} 0 0 0 0 ${SHADOW_RGB[2]} 0 0 0 1 0'/>` +
  `<feGaussianBlur stdDeviation='${BLUR}'/></filter>`;

/**
 * Whether an actor throws a shadow, and the floor under it: its own for whatever stands,
 * sits or lies, its carrier's for a carried prop; nothing in flight or hidden.
 */
export function shadowFloor(actor: ActorState, carrier?: ActorState): number | undefined {
  if (!actor.visible || actor.opacity <= 0 || actor.locomotion === 'fly') return undefined;
  if (actor.heldBy) return carrier && castsShadow(carrier.character) ? carrier.y : undefined;
  if (!castsShadow(actor.character)) return undefined;
  return actor.y + actor.seat;
}

/** One actor's shadow from one light, on the floor at `gy`. */
export function castShadowSvg(
  actor: ActorState,
  pose: Pose,
  gy: number,
  th: Throw,
  id: string
): string {
  const side = sideOf(actor);
  const body = characterBody(actor.character, pose, null, Math.sign(side) || 1);
  const placed = placeCharacter(actor.character, body, actor.x, actor.y, actor.scale, side, 1);
  if (!placed) return '';
  // Not the actor itself: whatever looks actors up by class should not find the shadow.
  const shape = placed.replace(/class='actor actor-/, "class='cast-of-");
  const { along: a, up: b } = th;
  const map = floorMap(th, gy);
  // Fading from the feet to where the head's shadow falls.
  const h = actor.character.height * actor.scale;
  const tip = [actor.x + a * h, gy - b * h];
  const fade =
    `<linearGradient id='${id}-g' gradientUnits='userSpaceOnUse' x1='${n(actor.x)}' y1='${n(gy)}' x2='${n(tip[0])}' y2='${n(tip[1])}'>` +
    `<stop offset='0.15' stop-color='#fff'/><stop offset='1' stop-color='#fff' stop-opacity='${n(1 - FADE)}'/></linearGradient>` +
    `<mask id='${id}' maskUnits='userSpaceOnUse' x='-10000' y='-10000' width='20000' height='20000'>` +
    `<rect x='-10000' y='-10000' width='20000' height='20000' fill='url(#${id}-g)'/></mask>`;
  return (
    `<defs>${fade}</defs>` +
    `<g class='cast' mask='url(#${id})' opacity='${n(th.opacity * actor.opacity)}'>` +
    `<g filter='url(#tk-cast)'><g transform='${map}'>${shape}</g></g></g>`
  );
}
