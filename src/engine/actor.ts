import { clamp01, easeInOut } from './easing.js';
import { bodyWidth, footPoint, partOffset, swingOf, toRoot } from './gait.js';
import {
  applyTake,
  applyVerb,
  basePose,
  emptyPose,
  quadrupedTurn,
  resolveFace,
  type Pose,
} from './motion.js';
import { rigPart, rigOf, type Rig } from './rigs.js';
import { DEFAULT_LINE_COLOR, limbWidth, OUTLINE_PX, outlineFor } from './outline.js';
import { DAYLIGHT, shadePart, silhouette, type Light } from './shade.js';
import { applyColors, n, topLevelPieces, verticalExtent } from './svg.js';
import type { ActorState } from './timeline.js';
import type { Character, Facing } from './types.js';

/**
 * Full pose for an actor at this instant, without its springs (those need the whole shot;
 * see springs.ts).
 */
export function poseFor(actor: ActorState, t: number): Pose {
  const rig = rigOf(actor.character);
  const sat = actor.sit > 0 || actor.lie > 0;
  const loco = sat ? 'idle' : actor.locomotion;
  const pose = basePose(rig, loco, actor.locoT, actor.phase, actor.travel);
  // The floor under the seat, in the character's own units.
  const seat = actor.seat / ((actor.character.height / rig.height) * actor.scale);
  // A person on a raised seat even before sitting has begun: the pose puts the feet on the
  // floor. An animal stands on the seat itself, having hopped up.
  if (sat || (seat > 0 && rig.name === 'humanoid')) applyVerb(rig, pose, 'sit', actor.sit, seat);
  if (actor.lie > 0) applyVerb(rig, pose, 'lie', actor.lie, seat);
  // Carrying: the near arm hangs a little forward and swings less, under the weight.
  if (actor.holding && rig.name === 'humanoid') {
    pose.rot.armR = 0.35 * (pose.rot.armR ?? 0) - 12;
    pose.bend.armR = -20;
  }
  const head = rig.name === 'simple' ? 'body' : 'head';
  if (actor.look) pose.rot[head] = (pose.rot[head] ?? 0) + actor.look;
  if (actor.take) applyTake(rig, pose, actor.take.emotion, actor.take.u);
  for (const v of actor.verbs) applyVerb(rig, pose, v.verb, v.u);
  // Turning round: the body narrows through the mirror and stretches a touch as it does,
  // and the face comes round through front-on.
  if (actor.turn) {
    pose.sy *= 1 + 0.04 * Math.sin(Math.PI * actor.turn.u);
    if (actor.turn.from !== actor.facing) pose.yaw *= Math.abs(Math.cos(Math.PI * actor.turn.u));
    if (rig.name === 'quadruped' && actor.turn.from !== actor.facing)
      quadrupedTurn(pose, actor.turn.u, loco !== 'idle' || sat);
  }
  // Going into the screen the face turns on round to side-on and then away; coming out of
  // it, round to the viewer.
  if (rig.turn && actor.view > 0) pose.yaw *= 1 - actor.view;
  // What hangs down the back goes behind the body over the middle of the turn, rather than
  // all at once.
  if (rig.turn && actor.view > TOWARD[0])
    pose.toward = easeInOut(clamp01((actor.view - TOWARD[0]) / (TOWARD[1] - TOWARD[0])));
  // A limb swinging toward or away from the viewer is foreshortened. A bent leg comes out
  // a little shorter than it was, so the body comes down by as much as its lowest foot rose.
  if (rig.turn && actor.view) {
    const lowest = () => Math.max(...rig.feet.map((leg) => footPoint(rig, pose, leg)[1]));
    const before = lowest();
    pose.depth = 0.75 * Math.abs(actor.view);
    pose.dy += before - lowest();
  }
  if (rig.turn && actor.view < 0) {
    const away = -actor.view;
    if (away < 0.5) pose.yaw += (2 - pose.yaw) * 2 * away;
    else pose.back = true;
  }
  pose.face = resolveFace(actor.character.parts, {
    back: pose.back,
    emotion: actor.emotion,
    overrides: actor.face,
    talking: actor.talking,
    mouth: actor.mouth,
    t,
    phase: actor.phase,
    // A take starts with a blink.
    blink: !!actor.take && actor.take.u > 0.04 && actor.take.u < 0.22,
  });
  return pose;
}

const FACE_PARTS = new Set(['face', 'eyes', 'mouth']);

/**
 * Outline width in canonical units: the same line on screen for every character at scale 1,
 * so a 90px mouse and a 300px giant look drawn with the same pen. Perspective scale thins it.
 */
export function outlineWidth(character: Character): number {
  const rig = rigOf(character);
  return OUTLINE_PX / (character.height / rig.height);
}

/** A part and its parents, root first. */
function chainOf(rig: Rig, name: string): string[] {
  const chain: string[] = [];
  let cur: string | undefined = name;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(cur);
    cur = rigPart(rig, cur).parent;
  }
  return chain;
}

/**
 * Undo one part's own move off its parent (its offset and turn about its pivot): what is
 * drawn in the parent's frame, seen from the part's. Foreshortening is left out.
 */
function unLink(rig: Rig, pose: Pose, name: string): string {
  const [px, py] = rigPart(rig, name).pivot;
  const [ox, oy] = partOffset(rig, pose, name);
  const [rot] = swingOf(rig, pose, name);
  return `rotate(${n(-rot)} ${px} ${py}) translate(${n(-ox)} ${n(-oy)})`;
}

/** How far the pose has turned a part, in degrees, its parents' turns included. */
function turnOf(rig: Rig, pose: Pose, name: string): number {
  return chainOf(rig, name).reduce((sum, p) => sum + swingOf(rig, pose, p)[0], pose.spin);
}

function transformChain(rig: Rig, pose: Pose, name: string): string {
  let out = '';
  for (const p of chainOf(rig, name)) {
    const rp = rigPart(rig, p);
    const off = partOffset(rig, pose, p);
    const [rot, len] = swingOf(rig, pose, p);
    if (off[0] || off[1]) out += `translate(${n(off[0])} ${n(off[1])}) `;
    if (rot) out += `rotate(${n(rot)} ${rp.pivot[0]} ${rp.pivot[1]}) `;
    if (len !== 1) out += `translate(0 ${n(rp.pivot[1] * (1 - len))}) scale(1 ${n(len)}) `;
  }
  return out.trim();
}

/**
 * The turn (`Rig.turn`) of one part as a transform in its own frame: the face narrowed
 * about the centre line and slid toward the way the character faces, the body narrowed.
 */
function turnPart(rig: Rig, pose: Pose, name: string): string {
  const turn = rig.turn;
  if (!turn) return '';
  const narrow = (k: number, dx = 0) =>
    k === 1 && !dx ? '' : `translate(${n(turn.centre * (1 - k) + dx)} 0) scale(${n(k)} 1)`;
  if (turn.body.includes(name)) return narrow(bodyWidth(rig, pose));
  if (!turn.parts.includes(name)) return '';
  return narrow(1 - (1 - turn.narrow) * pose.yaw, turn.shift * pose.yaw);
}

/**
 * A limb bent at the knee or elbow: the part drawn twice, cut across the joint, the lower
 * half turned by `bend`. Each half keeps a disc as wide as the limb round the joint, so the
 * turn opens no gap and the joint is round; both outlines go down before either fill, so no
 * line crosses where the halves meet and the limb reads as one shape.
 */
function bentLimb(
  id: string,
  joint: [number, number],
  bend: number,
  svg: string,
  under: string,
  line: number,
  shade: (frag: string, extra?: number) => string,
  draw: 'all' | 'lines' | 'fills' = 'all'
): string {
  const [kx, ky] = joint;
  // A limb drawn as a filled shape has no stroke to measure: assume a typical one.
  const r = (limbWidth(svg) / 2 || 9) + 1.5;
  const clip = (key: string, lower: boolean, radius: number) =>
    `<clipPath id='${id}-${key}'><rect x='-1000' y='${lower ? ky : -1000}' width='3000' height='${lower ? 2000 : ky + 1000}'/><circle cx='${kx}' cy='${ky}' r='${n(radius)}'/></clipPath>`;
  const half = (key: string, inner: string) => `<g clip-path='url(#${id}-${key})'>${inner}</g>`;
  const turned = (inner: string) => `<g transform='rotate(${n(bend)} ${kx} ${ky})'>${inner}</g>`;
  // A shape wholly below the joint (a paw, a shoe) stays out of the upper half, and one
  // wholly above it out of the lower: the disc round the joint would otherwise catch its
  // edge and draw that sliver unturned, a spike beside the knee.
  const side = (frag: string, lower: boolean) =>
    topLevelPieces(frag)
      .filter((p) => {
        const e = verticalExtent(p);
        return !e || (lower ? e[1] > ky : e[0] < ky);
      })
      .join('');
  // Each half is shaded as it lies: the lower one turned by the bend as well.
  const upper = side(svg, false);
  const lower = side(svg, true);
  const lines =
    `<defs>${clip('ul', false, r + line)}${clip('ll', true, r + line)}</defs>` +
    half('ul', side(under, false)) +
    turned(half('ll', side(under, true)));
  const fills =
    `<defs>${clip('uf', false, r)}${clip('lf', true, r)}</defs>` +
    half('uf', upper + shade(upper)) +
    turned(half('lf', lower + shade(lower, bend)));
  if (draw === 'lines') return under ? lines : '';
  if (draw === 'fills') return fills;
  return (under ? lines : '') + fills;
}

/** Over this stretch of a turn toward the viewer, what hangs down the back goes behind. */
const TOWARD = [0.2, 0.8];

/** A part hung behind the head: a plait, down the back. */
function hungBehind(rig: Rig, name: string): boolean {
  const part = rigPart(rig, name);
  const { head, torso } = rig.parts;
  return !!torso && !!head && part.parent === 'head' && part.z < head.z;
}

/**
 * Where a part is drawn, back to front. Facing the viewer, a part hung behind the head goes
 * just behind the torso: a plait down the back is hidden by the body, not laid over it.
 */
function zOf(rig: Rig, pose: Pose, name: string): number {
  if (pose.toward && hungBehind(rig, name)) return rig.parts.torso.z - 0.05;
  return rigPart(rig, name).z;
}

/**
 * Draw the character's parts in canonical coordinates with the given pose, shaded by
 * `light` (none for `null`) as seen from `side` (1 facing right, -1 mirrored to the left).
 */
export function characterBody(
  character: Character,
  pose: Pose,
  light: Light | null = DAYLIGHT,
  side = 1
): string {
  const rig = rigOf(character);
  // Part way round to the viewer, a plait is drawn behind the body and, fading, where it was.
  const fading = (name: string) => pose.toward! < 1 && hungBehind(rig, name);
  const names = [
    ...Object.keys(character.parts).map((name) => ({ name, z: zOf(rig, pose, name), fade: 0 })),
    ...(pose.toward
      ? Object.keys(character.parts)
          .filter(fading)
          .map((name) => ({ name, z: rigPart(rig, name).z, fade: pose.toward! }))
      : []),
  ].sort((a, b) => a.z - b.z);
  const line = character.colors.line ?? DEFAULT_LINE_COLOR;
  const width = outlineWidth(character);
  const drawn: {
    name: string;
    tf: string;
    svg: string;
    under: string;
    /** The shading of (a piece of) this part, turned `extra` degrees further. */
    shade: (frag: string, extra?: number) => string;
    /** A copy fading out where it was (see `Pose.toward`): how far gone. */
    fade: number;
  }[] = [];
  for (const { name, fade } of names) {
    const part = character.parts[name];
    const svg = typeof part === 'string' ? part : part[pose.face[name] ?? Object.keys(part)[0]];
    if (!svg) continue;
    const coloured = applyColors(svg, character.colors);
    // The face is detail on top of the head: a lighter line, or it looks stamped on.
    const under = character.outline
      ? outlineFor(coloured, line, FACE_PARTS.has(name) ? width / 2 : width)
      : '';
    // Seen from behind there is no face.
    if (pose.back && rig.turn?.parts.includes(name)) continue;
    const tf = [transformChain(rig, pose, name), turnPart(rig, pose, name)]
      .filter(Boolean)
      .join(' ');
    // A part fused into its parent (a quadruped's head into its body) shades with it.
    const into = rig.fuse[name];
    const parent = into && character.parts[into];
    const joined =
      typeof parent === 'string' && rigPart(rig, name).parent === into
        ? `<g transform='${unLink(rig, pose, name)}'>${silhouette(applyColors(parent, character.colors), line)}</g>`
        : '';
    const rot = turnOf(rig, pose, name);
    const shade = (frag: string, extra = 0) =>
      light && character.shade && !FACE_PARTS.has(name)
        ? shadePart(frag, rot + extra, side, light, rig, line, joined, name in rig.bends)
        : '';
    drawn.push({ name, tf, svg: coloured, under, shade, fade });
  }
  const group = (name: string, tf: string, inner: string, fade = 0) =>
    `<g class='part-${name}'${tf ? ` transform='${tf}'` : ''}${fade ? ` opacity='${n(1 - fade)}'` : ''}>${inner}</g>`;
  // A fused part's outline goes down just before the part it joins, so that part's fill
  // covers the line where they overlap; the fused part's own fill still draws in its turn.
  const joined = new Set(drawn.map((d) => d.name));
  let out = '';
  for (const d of drawn) {
    const limb = (f: (typeof drawn)[number], draw: 'all' | 'lines' | 'fills') => {
      const joint = rig.bends[f.name];
      const bend = pose.bend[f.name];
      if (!joint || !bend) return '';
      const id = `tk-bend-${character.id}-${f.name}`;
      return bentLimb(id, joint, bend, f.svg, f.under, width, f.shade, draw);
    };
    for (const f of drawn)
      if (f.under && rig.fuse[f.name] === d.name)
        out += group(`${f.name}-line`, f.tf, limb(f, 'lines') || f.under);
    const fused = rig.fuse[d.name] && joined.has(rig.fuse[d.name]);
    const inner =
      limb(d, fused ? 'fills' : 'all') || (fused ? '' : d.under) + d.svg + d.shade(d.svg);
    out += group(d.name, d.tf, inner, d.fade);
  }
  let body = out;
  if (pose.spin) {
    body = `<g transform='rotate(${n(pose.spin)} ${rig.width / 2} ${rig.height / 2})'>${body}</g>`;
  }
  const root: string[] = [];
  if (pose.dx || pose.dy) root.push(`translate(${n(pose.dx)} ${n(pose.dy)})`);
  if (pose.sx !== 1 || pose.sy !== 1)
    root.push(
      `translate(${rig.width / 2} ${rig.height}) scale(${n(pose.sx)} ${n(pose.sy)}) translate(${-rig.width / 2} ${-rig.height})`
    );
  return root.length ? `<g transform='${root.join(' ')}'>${body}</g>` : body;
}

/**
 * The mirror as a signed horizontal scale: 1 facing right, -1 facing left, and through a
 * turn a squash from one to the other (never quite flat, so the actor does not vanish).
 * A character whose face turns (`Rig.turn`) squashes far less: its face, front-on at
 * the mirror, carries the turn, so the body need only hide the swap of its near and far
 * sides.
 */
export function sideOf(actor: Pick<ActorState, 'facing' | 'turn' | 'character'>): number {
  const to = actor.facing === 'left' ? -1 : 1;
  if (!actor.turn || actor.turn.from === actor.facing) return to;
  const rig = rigOf(actor.character);
  const quad = rig.name === 'quadruped';
  // An animal's body swings round eased, slow out of side-on and back into it, and seen
  // end-on it is still about a third as wide as it is long.
  const u = quad ? easeInOut(actor.turn.u) : actor.turn.u;
  const least = rig.turn ? 0.72 : quad ? 0.45 : 0.12;
  return (u < 0.5 ? -to : to) * Math.max(least, Math.abs(Math.cos(Math.PI * u)));
}

/** Place a posed character in the world at feet point (x, y). */
export function placeCharacter(
  character: Character,
  body: string,
  x: number,
  y: number,
  scale: number,
  facing: Facing | number,
  opacity = 1
): string {
  const rig = rigOf(character);
  const s = (character.height / rig.height) * scale;
  const side = typeof facing === 'number' ? facing : facing === 'left' ? -1 : 1;
  const flip = side !== 1 ? ` scale(${n(side)} 1)` : '';
  // translate so the feet point lands on (x, y); flip about the box centre line.
  const tf = `translate(${n(x)} ${n(y)}) scale(${n(s)})${flip} translate(${-rig.width / 2} ${-rig.height})`;
  const op = opacity < 1 ? ` opacity='${n(opacity)}'` : '';
  return `<g class='actor actor-${character.id}' transform='${tf}'${op}>${body}</g>`;
}

export function renderActor(
  actor: ActorState,
  t: number,
  pose = poseFor(actor, t),
  light: Light = DAYLIGHT
): string {
  if (!actor.visible || actor.opacity <= 0) return '';
  const side = sideOf(actor);
  const body = characterBody(actor.character, pose, light, Math.sign(side) || 1);
  return placeCharacter(actor.character, body, actor.x, actor.y, actor.scale, side, actor.opacity);
}

/** Whether a character casts a ground shadow (see `Character.shadow`). */
export function castsShadow(character: Character): boolean {
  return character.shadow ?? character.rig !== 'simple';
}

/** The soft fill every ground shadow uses; a frame defines it once. */
export const SHADOW_DEFS =
  "<radialGradient id='tk-shadow'><stop offset='0' stop-color='#000' stop-opacity='0.45'/>" +
  "<stop offset='0.6' stop-color='#000' stop-opacity='0.32'/>" +
  "<stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient>";

/**
 * A shadow on the ground under the feet point, as wide as the rig's stance. The higher the
 * pose lifts the body off the ground (a jump, a bounce), the smaller and fainter it gets,
 * which is what sells the height.
 */
export function shadowSvg(
  character: Character,
  pose: Pose,
  x: number,
  y: number,
  scale: number,
  side: number,
  opacity = 1
): string {
  const rig = rigOf(character);
  const s = (character.height / rig.height) * scale;
  const k = 1 / (1 + Math.max(0, -pose.dy) / 120);
  const rx = (rig.shadow / 2) * s * Math.abs(pose.sx) * k * (pose.shadow?.scale ?? 1);
  const o = opacity * k * k;
  if (rx <= 0 || o <= 0.01) return '';
  const op = o < 1 ? ` opacity='${n(o)}'` : '';
  const cx = x + s * side * (pose.dx + (pose.shadow?.dx ?? 0));
  return `<ellipse cx='${n(cx)}' cy='${n(y)}' rx='${n(rx)}' ry='${n(rx * 0.2)}' fill='url(#tk-shadow)'${op}/>`;
}

/** An actor's ground shadow: none while it flies, is carried, or is hidden. */
export function renderShadow(actor: ActorState, pose: Pose): string {
  if (!actor.visible || actor.opacity <= 0 || !castsShadow(actor.character)) return '';
  if (actor.heldBy || actor.locomotion === 'fly') return '';
  return shadowSvg(
    actor.character,
    pose,
    actor.x,
    // Under the feet: a person's on the floor below a raised seat until sat on it.
    actor.y + (rigOf(actor.character).name === 'humanoid' ? actor.seat * (1 - actor.sit) : 0),
    actor.scale,
    sideOf(actor),
    actor.opacity
  );
}

/** A point in the actor's box, through the pose's root (not its spin), in the scene. */
export function boxToScene(
  actor: ActorState,
  pose: Pose,
  [bx, by]: [number, number]
): { x: number; y: number } {
  const rig = rigOf(actor.character);
  const s = (actor.character.height / rig.height) * actor.scale;
  // The root transforms the composer applies: scale about the feet, then the body offset.
  const x = pose.sx * (bx - rig.width / 2) + pose.dx;
  const y = pose.sy * (by - rig.height) + pose.dy;
  return { x: actor.x + s * sideOf(actor) * x, y: actor.y + s * y };
}

/** Where a point in the scene is in the actor's box: boxToScene the other way. */
export function sceneToBox(
  actor: ActorState,
  pose: Pose,
  p: { x: number; y: number }
): [number, number] {
  const rig = rigOf(actor.character);
  const s = (actor.character.height / rig.height) * actor.scale;
  return [
    rig.width / 2 + ((p.x - actor.x) / (s * sideOf(actor)) - pose.dx) / pose.sx,
    rig.height + ((p.y - actor.y) / s - pose.dy) / pose.sy,
  ];
}

/**
 * Where a point in the scene lies on the part someone standing on this actor rides (its
 * rig's main one: a body, a torso), in that part's own coordinates, so it can be found again
 * once the actor has moved, turned, lain down or got up.
 */
export function sceneToPart(
  actor: ActorState,
  pose: Pose,
  p: { x: number; y: number }
): [number, number] {
  const rig = rigOf(actor.character);
  // For one pose the part is turned and shifted: undone from where three points land.
  const o = toRoot(rig, pose, rig.required, [0, 0]);
  const ex = toRoot(rig, pose, rig.required, [1, 0]);
  const ey = toRoot(rig, pose, rig.required, [0, 1]);
  const [a, c] = [ex[0] - o[0], ex[1] - o[1]];
  const [b, d] = [ey[0] - o[0], ey[1] - o[1]];
  const [bx, by] = sceneToBox(actor, pose, p);
  const [qx, qy] = [bx - o[0], by - o[1]];
  const det = a * d - b * c;
  return [(d * qx - b * qy) / det, (a * qy - c * qx) / det];
}

/** A point on the part someone rides (see sceneToPart), in the scene. */
export function partToScene(
  actor: ActorState,
  pose: Pose,
  point: [number, number]
): { x: number; y: number } {
  const rig = rigOf(actor.character);
  return boxToScene(actor, pose, toRoot(rig, pose, rig.required, point));
}

/** Where a carried prop is held (the rig's hold point, through the pose), in the scene. */
export function holdPoint(actor: ActorState, pose: Pose): { x: number; y: number } {
  const rig = rigOf(actor.character);
  return boxToScene(actor, pose, toRoot(rig, pose, rig.hold.part, rig.hold.point));
}

/**
 * Top of the head in world space (for bubbles): the rig's speaker point, mirrored, carried
 * through the posture (sitting, lying down) so a bubble comes from a head that has sat back
 * or lies on the floor. Passing moves (a nod, a look) are left out, or the bubble would bob.
 */
export function actorHeadTop(actor: ActorState, pose: Pose): { x: number; y: number } {
  const rig = rigOf(actor.character);
  const s = (actor.character.height / rig.height) * actor.scale;
  let [sx, sy] = rig.speaker;
  if (rig.parts.head && (actor.sit > 0 || actor.lie > 0)) {
    const held = emptyPose();
    applyVerb(rig, held, 'sit', actor.sit);
    if (actor.lie > 0) applyVerb(rig, held, 'lie', actor.lie);
    [sx, sy] = toRoot(rig, held, 'head', rig.speaker);
  }
  const side = sideOf(actor);
  return {
    x: actor.x + (pose.dx + (sx - rig.width / 2)) * s * side,
    y: actor.y - rig.height * s + (pose.dy + sy) * s,
  };
}
