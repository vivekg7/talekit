import { actorHeadTop, poseFor, renderActor, renderShadow, sideOf, SHADOW_DEFS } from './actor.js';
import { DAYLIGHT, type Light } from './shade.js';
import { applySprings } from './springs.js';
import { bubbleSvg, wrapText, textWidth } from './bubble.js';
import { clamp01, easeInOut } from './easing.js';
import { escapeXml, n } from './svg.js';
import { resolveFrame, type FrameState } from './timeline.js';
import type { Camera, Project, Shot, Weather } from './types.js';
import { effectsSvg, fireLights, type EffectLayer, type FireLight } from './effects.js';
import type { Pose } from './motion.js';
import { RIGS } from './rigs.js';
import type { ActorState } from './timeline.js';
import { flashFilter, mix, weatherAt, weatherView, type Span } from './weather.js';

export interface ComposeOptions {
  /** Draw anchor markers and actor feet points. */
  debug?: boolean;
}

/** How fast the far and near layers move with the camera, the stage being 1. */
export const PARALLAX = { far: 0.5, near: 1.4 };
/** Past this zoom the frame's edges darken, more as it closes in, to hold the eye. */
const VIGNETTE_FROM = 1.3;
const VIGNETTE_FULL = 1.9;

const FRAME_DEFS =
  SHADOW_DEFS +
  "<radialGradient id='tk-vignette' cx='0.5' cy='0.5' r='0.72'>" +
  "<stop offset='0.55' stop-color='#000' stop-opacity='0'/>" +
  "<stop offset='1' stop-color='#000' stop-opacity='0.5'/></radialGradient>";

/**
 * The camera as seen from a layer at depth factor `p`: the stage is 1 and moves with the
 * camera exactly, 0 does not move at all. Zoom scales geometrically (zoom^p), so a far
 * layer behind a clamped stage view always covers the frame too.
 */
export function layerTransform(c: Required<Camera>, W: number, H: number, p: number): string {
  const zoom = Math.pow(c.zoom, p);
  const x = W / 2 + p * (c.x - W / 2);
  const y = H / 2 + p * (c.y - H / 2);
  return `translate(${W / 2} ${H / 2}) scale(${n(zoom)}) translate(${n(-x)} ${n(-y)})`;
}

function worldToScreen(frame: FrameState, W: number, H: number, x: number, y: number) {
  const c = frame.camera;
  return { x: (x - c.x) * c.zoom + W / 2, y: (y - c.y) * c.zoom + H / 2 };
}

function captionSvg(
  text: string,
  style: 'title' | 'narration',
  opacity: number,
  slide: number,
  W: number,
  H: number,
  font: string,
  k: number
): string {
  const fontSize = (style === 'title' ? 54 : 28) * k;
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(text, W * 0.8, fontSize);
  const blockH = lines.length * lineHeight;
  const cy = style === 'title' ? H / 2 : H - 28 * k - blockH / 2;
  const w = Math.max(...lines.map((l) => textWidth(l, fontSize))) + 40 * k;
  const bg =
    style === 'narration'
      ? `<rect x='${n(W / 2 - w / 2)}' y='${n(cy - blockH / 2 - 10 * k)}' width='${n(w)}' height='${n(blockH + 20 * k)}' rx='${12 * k}' fill='#000' fill-opacity='0.55'/>`
      : '';
  const fill = '#fff';
  const stroke =
    style === 'title'
      ? ` stroke='#222' stroke-width='${n(fontSize * 0.08)}' paint-order='stroke'`
      : '';
  const texts = lines
    .map(
      (l, i) =>
        `<text x='${W / 2}' y='${n(cy - blockH / 2 + lineHeight * (i + 0.8))}' text-anchor='middle' font-family="${escapeXml(font)}" font-size='${fontSize}' font-weight='bold' fill='${fill}'${stroke}>${escapeXml(l)}</text>`
    )
    .join('');
  // Narration rises into place from just below; a title drifts up less.
  const dy = slide * (style === 'title' ? 10 : 18) * k;
  const tf = dy ? ` transform='translate(0 ${n(dy)})'` : '';
  return `<g opacity='${n(opacity)}'${tf}>${bg}${texts}</g>`;
}

/** Compose one frame of a shot as a complete SVG document. */
export function composeFrame(
  project: Project,
  shot: Shot,
  t: number,
  opts: ComposeOptions = {}
): string {
  const frame = resolveFrame(project, shot, t);
  const dissolve = Math.min(shot.crossfade, shot.duration);
  const prev = t < dissolve ? previousShot(project, shot) : undefined;
  if (!prev) return composeFrameState(project, frame, opts);
  // A dissolve: the previous shot carries on past its end underneath while this one fades up.
  const under = frameBody(project, resolveFrame(project, prev, prev.duration + t), opts);
  const { width: W, height: H } = project.meta;
  // Faded with a filter over the frame, not group opacity: resvg 2.6 panics on an opacity
  // group that holds another one (a translucent cloud) beside a layer pushed wholly off
  // the frame (the near layer of a close-up).
  const fade =
    `<filter id='tk-dissolve' filterUnits='userSpaceOnUse' x='0' y='0' width='${W}' height='${H}' color-interpolation-filters='sRGB'>` +
    `<feComponentTransfer><feFuncA type='linear' slope='${n(easeInOut(t / dissolve))}'/></feComponentTransfer></filter>`;
  return frameDocument(
    project,
    under +
      `<defs>${fade}</defs><g filter='url(#tk-dissolve)'>${frameBody(project, frame, opts)}</g>`
  );
}

/** Where a character with a `shelter` keeps the rain off, in the scene, as it is now. */
function actorShelter(actor: ActorState, pose: Pose): Span[] {
  const spans = actor.character.shelter;
  if (!spans || !actor.visible || actor.opacity <= 0) return [];
  const rig = RIGS[actor.character.rig];
  const s = (actor.character.height / rig.height) * actor.scale;
  const side = sideOf(actor);
  const at = (bx: number) => actor.x + s * side * (pose.sx * (bx - rig.width / 2) + pose.dx);
  const variants = Object.values(pose.face);
  return (Array.isArray(spans) ? spans : [spans]).flatMap((sh, i) => {
    if (sh.when && !variants.includes(sh.when)) return [];
    const [a, b] = [at(sh.x), at(sh.x + sh.width)];
    return [
      {
        x0: Math.min(a, b),
        x1: Math.max(a, b),
        y: actor.y + s * (pose.sy * (sh.y - rig.height) + pose.dy),
        key: `${actor.id}:${i}`,
      },
    ];
  });
}

/** The warm colour a fire throws, per channel, and its glow. */
const FIRE_RGB = [1, 0.72, 0.42];
const FIRE_GLOW = '#ff9a3c';

/**
 * How much firelight reaches a point, 0..~1, falling off to nothing at each fire's reach,
 * and the way to it: the unit vector toward the fires, each weighted by what it gives.
 */
function fireAt(
  fires: FireLight[],
  x: number,
  y: number
): { warm: number; toward: [number, number] } {
  let sum = 0;
  let vx = 0;
  let vy = 0;
  for (const f of fires) {
    const len = Math.hypot(x - f.x, y - f.y);
    const d = len / f.radius;
    if (d >= 1) continue;
    const g = f.strength * (1 - d) * (1 - d);
    sum += g;
    vx += (g * (f.x - x)) / (len || 1);
    vy += (g * (f.y - y)) / (len || 1);
  }
  const v = Math.hypot(vx, vy) || 1;
  return { warm: Math.min(1, sum), toward: [vx / v, vy / v] };
}

/** The lit side of an actor by a fire: its rim colour. */
const FIRE_RIM = '#ffb45a';

/**
 * The light an actor stands in, and its colour. Its shading (shade.ts) is lit by day from
 * high to the left; by a fire, lit on the side toward the fire with a warm rim, its shadow
 * swung round to the far side the more the fire outshines the scene. Its colours are
 * tinted toward `weather.light` (characters are drawn in daylight; a night scene is not)
 * and warmed by the fire, through a filter that scales each colour channel. A fire matters
 * more the darker it is around it.
 */
function lightOf(actor: ActorState, w: Weather, fires: FireLight[]) {
  const amount = w.light?.amount ?? 0;
  const tint = w.light ? mix('#ffffff', w.light.color, amount) : '#ffffff';
  const middle = actor.y - (actor.character.height * actor.scale) / 2;
  const fire = fireAt(fires, actor.x, middle);
  const warm = fire.warm * (0.3 + 0.7 * amount);
  const slopes = [1, 3, 5].map((i, ch) =>
    Math.min(1.12, parseInt(tint.slice(i, i + 2), 16) / 255 + warm * FIRE_RGB[ch] * 0.45)
  );
  const swing = clamp01(3 * warm);
  const [dx, dy] = DAYLIGHT.toward;
  const tx = dx + (fire.toward[0] - dx) * swing;
  const ty = dy + (fire.toward[1] - dy) * swing;
  const len = Math.hypot(tx, ty) || 1;
  const light: Light = {
    toward: [tx / len, ty / len],
    shade: DAYLIGHT.shade + 0.12 * swing,
    rim:
      warm > 0.03
        ? { toward: fire.toward, color: FIRE_RIM, amount: Math.min(0.85, 2.4 * warm) }
        : undefined,
  };
  return { light, slopes };
}

/** An actor through the channel filter of `lightOf`, or as it is when that does nothing. */
function lit(svg: string, id: string, slopes: number[]): string {
  if (!svg || slopes.every((v) => Math.abs(v - 1) < 0.01)) return svg;
  const fn = (c: string, v: number) => `<feFunc${c} type='linear' slope='${n(v)}'/>`;
  return (
    `<defs><filter id='${id}' color-interpolation-filters='sRGB'><feComponentTransfer>` +
    `${fn('R', slopes[0])}${fn('G', slopes[1])}${fn('B', slopes[2])}</feComponentTransfer></filter></defs>` +
    `<g filter='url(#${id})'>${svg}</g>`
  );
}

/**
 * The glow each fire spreads over what is around it, actors included: a warm pool blended
 * as light (screen), stronger the darker the scene, pulsing with the flames.
 */
function firelight(fires: FireLight[], w: Weather): string {
  if (!fires.length) return '';
  const amount = w.light?.amount ?? 0;
  const pools = fires
    .map(
      (f) =>
        `<circle cx='${n(f.x)}' cy='${n(f.y)}' r='${n(f.radius)}' fill='url(#tk-firelight)' fill-opacity='${n((0.2 + 0.5 * amount) * f.strength)}'/>`
    )
    .join('');
  return (
    `<defs><radialGradient id='tk-firelight'><stop offset='0' stop-color='${FIRE_GLOW}' stop-opacity='0.9'/>` +
    `<stop offset='0.5' stop-color='${FIRE_GLOW}' stop-opacity='0.35'/><stop offset='1' stop-color='${FIRE_GLOW}' stop-opacity='0'/></radialGradient></defs>` +
    `<g class='firelight' style='mix-blend-mode:screen'>${pools}</g>`
  );
}

function previousShot(project: Project, shot: Shot): Shot | undefined {
  const i = project.shots.findIndex((s) => s.id === shot.id);
  return i > 0 ? project.shots[i - 1] : undefined;
}

export function composeFrameState(
  project: Project,
  frame: FrameState,
  opts: ComposeOptions = {}
): string {
  return frameDocument(project, frameBody(project, frame, opts));
}

function frameDocument(project: Project, body: string): string {
  const { width: W, height: H } = project.meta;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<defs>${FRAME_DEFS}</defs>` +
    body +
    `</svg>`
  );
}

/** Everything in one frame, back to front, without the document around it. */
function frameBody(project: Project, frame: FrameState, opts: ComposeOptions): string {
  const { width: W, height: H, font } = project.meta;
  const k = H / 720; // UI scale so text is the same relative size at any resolution
  const c = frame.camera;
  const scene = frame.scene;
  const layer = (cls: string, svg: string, p: number) =>
    `<g class='${cls}' transform='${layerTransform(c, W, H, p)}'>${svg}</g>`;

  // Poses first: the shadows all go down before any actor, so one never lies across another.
  const posed = frame.actors.map((actor) => {
    const pose = poseFor(actor, frame.t);
    applySprings(project, frame.shot, actor, pose, frame.t);
    return { actor, pose };
  });
  // The shot's weather or the scene's, as `weather` actions have turned it by now.
  const w = weatherAt(scene, frame.shot, frame.t);
  const shelters: Span[] = [
    ...scene.shelters.map((s) => ({ x0: s.x, x1: s.x + s.width, y: s.y })),
    ...posed.flatMap(({ actor, pose }) => actorShelter(actor, pose)),
  ];
  // Where the carried shelters were earlier in the shot, for the drops already falling.
  const sheltersAt = (t: number) => {
    const at = Math.max(0, t);
    return resolveFrame(project, frame.shot, at).actors.flatMap((a) =>
      actorShelter(a, poseFor(a, at))
    );
  };
  // Always asked, even in fair weather: a `lightning` action strikes in any sky.
  const sky = weatherView(
    w,
    frame.shot,
    c,
    W,
    H,
    frame.t,
    scene.ground ?? H * 0.9,
    shelters,
    sheltersAt
  );
  const fx = (plane: EffectLayer) => effectsSvg(scene.effects, plane, frame.t, w.wind ?? 0, W, H);
  const fires = fireLights(scene.effects, frame.t, H);
  let world = `<g class='scene'>${scene.svg}</g>` + fx('stage') + sky.stage;
  world += posed.map(({ actor, pose }) => renderShadow(actor, pose)).join('');
  const bubbles: string[] = [];
  for (const [i, { actor, pose }] of posed.entries()) {
    const { light, slopes } = lightOf(actor, w, fires);
    world += lit(renderActor(actor, frame.t, pose, light), `tk-lit-${i}`, slopes);
    if (actor.bubble && actor.visible) {
      const head = actorHeadTop(actor, pose);
      const s = worldToScreen(frame, W, H, head.x, head.y);
      bubbles.push(
        bubbleSvg({
          text: actor.bubble.text,
          style: actor.bubble.style,
          headX: s.x,
          headTop: s.y,
          frameW: W,
          frameH: H,
          font,
          uiScale: k,
          age: actor.bubble.age,
          left: actor.bubble.left,
        })
      );
    }
    if (opts.debug) {
      world += `<circle cx='${n(actor.x)}' cy='${n(actor.y)}' r='5' fill='#f0f'/>`;
    }
  }
  world += firelight(fires, w);
  if (scene.foreground) world += `<g class='foreground'>${scene.foreground}</g>`;
  world += fx('front');
  if (opts.debug) {
    for (const [name, a] of Object.entries(scene.anchors)) {
      world += `<g><circle cx='${a.x}' cy='${a.y}' r='6' fill='#0af' stroke='#fff' stroke-width='2'/><text x='${a.x + 10}' y='${a.y - 8}' font-size='18' fill='#0af' font-family='sans-serif' stroke='#000' stroke-width='3' paint-order='stroke'>${escapeXml(name)}</text></g>`;
    }
  }

  const vignette = clamp01((c.zoom - VIGNETTE_FROM) / (VIGNETTE_FULL - VIGNETTE_FROM));
  const captions = frame.captions
    .map((cp) => captionSvg(cp.text, cp.style, cp.opacity, cp.slide, W, H, font, k))
    .join('');
  const fade =
    frame.fade > 0
      ? `<rect width='${W}' height='${H}' fill='#000' opacity='${n(frame.fade)}'/>`
      : '';

  const farSvg = (scene.far ?? '') + fx('far') + sky.sky;
  let far = farSvg ? layer('far', farSvg, scene.parallax?.far ?? PARALLAX.far) : '';
  if (far && sky.haze) {
    // The haze's noise is fixed to the filtered group's coordinates: shift that group up by
    // the scroll and the layer back down inside it, and the noise rises through the scenery.
    const s = n(sky.haze.scroll);
    // The plain layer goes underneath, so the edges the shimmer pulls in from outside the
    // frame show the scenery rather than black.
    far += `<defs>${sky.haze.defs}</defs><g transform='translate(0 -${s})' filter='url(#${sky.haze.id})'><g transform='translate(0 ${s})'>${far}</g></g>`;
  }
  // Clouds grey the sky behind the stage (the far layer), however it was painted.
  if (far && sky.grade) far = `<defs>${sky.grade}</defs><g filter='url(#tk-sky)'>${far}</g>`;
  const nearSvg = (scene.near ?? '') + fx('near');
  let picture =
    far +
    sky.far +
    layer('camera', world, 1) +
    sky.front +
    (nearSvg ? layer('near', nearSvg, scene.parallax?.near ?? PARALLAX.near) : '') +
    sky.light;
  if (sky.flash)
    picture = `<defs>${flashFilter('tk-flash', sky.flash, W, H)}</defs><g filter='url(#tk-flash)'>${picture}</g>`;
  return (
    `<rect width='${W}' height='${H}' fill='#000'/>` +
    picture +
    (vignette > 0
      ? `<rect width='${W}' height='${H}' fill='url(#tk-vignette)' opacity='${n(vignette)}'/>`
      : '') +
    bubbles.join('') +
    captions +
    fade
  );
}
