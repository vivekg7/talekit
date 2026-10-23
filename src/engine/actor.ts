import { toRoot } from './gait.js';
import { applyTake, applyVerb, basePose, resolveFace, type Pose } from './motion.js';
import { rigPart, RIGS, type Rig } from './rigs.js';
import { DEFAULT_LINE_COLOR, limbWidth, OUTLINE_PX, outlineFor } from './outline.js';
import { applyColors, n } from './svg.js';
import type { ActorState } from './timeline.js';
import type { Character, Facing } from './types.js';

/**
 * Full pose for an actor at this instant, without its springs (those need the whole shot;
 * see springs.ts).
 */
export function poseFor(actor: ActorState, t: number): Pose {
  const rig = RIGS[actor.character.rig];
  const sat = actor.sit > 0;
  const loco = sat ? 'idle' : actor.locomotion;
  const pose = basePose(rig, loco, actor.locoT, actor.phase, actor.travel);
  // The floor under the seat, in the character's own units.
  const seat = actor.seat / ((actor.character.height / rig.height) * actor.scale);
  if (sat) applyVerb(rig, pose, 'sit', actor.sit, seat);
  // Carrying: the near arm hangs a little forward and swings less, under the weight.
  if (actor.holding && rig.name === 'humanoid') pose.rot.armR = 0.35 * (pose.rot.armR ?? 0) - 12;
  const head = rig.name === 'simple' ? 'body' : 'head';
  if (actor.look) pose.rot[head] = (pose.rot[head] ?? 0) + actor.look;
  if (actor.take) applyTake(rig, pose, actor.take.emotion, actor.take.u);
  for (const v of actor.verbs) applyVerb(rig, pose, v.verb, v.u);
  // Turning round: the body narrows through the mirror and stretches a touch as it does.
  if (actor.turn) pose.sy *= 1 + 0.04 * Math.sin(Math.PI * actor.turn.u);
  pose.face = resolveFace(actor.character.parts, {
    emotion: actor.emotion,
    overrides: actor.face,
    talking: actor.talking,
    t,
    phase: actor.phase,
    // A take starts with a blink.
    blink: !!actor.take && actor.take.u > 0.04 && actor.take.u < 0.22,
  });
  return pose;
}

const FACE_PARTS = new Set(['eyes', 'mouth']);

/**
 * Outline width in canonical units: the same line on screen for every character at scale 1,
 * so a 90px mouse and a 300px giant look drawn with the same pen. Perspective scale thins it.
 */
export function outlineWidth(character: Character): number {
  const rig = RIGS[character.rig];
  return OUTLINE_PX / (character.height / rig.height);
}

function transformChain(rig: Rig, pose: Pose, name: string): string {
  const chain: string[] = [];
  let cur: string | undefined = name;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(cur);
    cur = rigPart(rig, cur).parent;
  }
  let out = '';
  for (const p of chain) {
    const rp = rigPart(rig, p);
    const off = pose.off[p];
    const rot = pose.rot[p];
    if (off && (off[0] || off[1])) out += `translate(${n(off[0])} ${n(off[1])}) `;
    if (rot) out += `rotate(${n(rot)} ${rp.pivot[0]} ${rp.pivot[1]}) `;
  }
  return out.trim();
}

/**
 * A leg bent at the knee: the part drawn twice, cut across the knee, the lower half turned
 * by `bend`. Each half keeps a disc as wide as the leg round the knee, so the turn opens no
 * gap and the joint is round; both outlines go down before either fill, so no line crosses
 * where the halves meet and the leg reads as one shape.
 */
function bentLeg(
  id: string,
  knee: [number, number],
  bend: number,
  svg: string,
  under: string,
  line: number
): string {
  const [kx, ky] = knee;
  // A leg drawn as a filled shape has no stroke to measure: assume a typical one.
  const r = limbWidth(svg) / 2 || 9;
  const clip = (key: string, lower: boolean, radius: number) =>
    `<clipPath id='${id}-${key}'><rect x='-1000' y='${lower ? ky : -1000}' width='3000' height='${lower ? 2000 : ky + 1000}'/><circle cx='${kx}' cy='${ky}' r='${n(radius)}'/></clipPath>`;
  const half = (key: string, inner: string) => `<g clip-path='url(#${id}-${key})'>${inner}</g>`;
  const turned = (inner: string) => `<g transform='rotate(${n(bend)} ${kx} ${ky})'>${inner}</g>`;
  return (
    `<defs>${clip('ul', false, r + line)}${clip('ll', true, r + line)}${clip('uf', false, r)}${clip('lf', true, r)}</defs>` +
    (under ? half('ul', under) + turned(half('ll', under)) : '') +
    half('uf', svg) +
    turned(half('lf', svg))
  );
}

/** Draw the character's parts in canonical coordinates with the given pose. */
export function characterBody(character: Character, pose: Pose): string {
  const rig = RIGS[character.rig];
  const names = Object.keys(character.parts).sort((a, b) => rigPart(rig, a).z - rigPart(rig, b).z);
  const line = character.colors.line ?? DEFAULT_LINE_COLOR;
  const width = outlineWidth(character);
  const drawn: { name: string; tf: string; svg: string; under: string }[] = [];
  for (const name of names) {
    const part = character.parts[name];
    const svg = typeof part === 'string' ? part : part[pose.face[name] ?? Object.keys(part)[0]];
    if (!svg) continue;
    const coloured = applyColors(svg, character.colors);
    // Eyes and mouth are detail on top of the head: a lighter line, or they look stamped on.
    const under = character.outline
      ? outlineFor(coloured, line, FACE_PARTS.has(name) ? width / 2 : width)
      : '';
    drawn.push({ name, tf: transformChain(rig, pose, name), svg: coloured, under });
  }
  const group = (name: string, tf: string, inner: string) =>
    `<g class='part-${name}'${tf ? ` transform='${tf}'` : ''}>${inner}</g>`;
  // A fused part's outline goes down just before the part it joins, so that part's fill
  // covers the line where they overlap; the fused part's own fill still draws in its turn.
  const joined = new Set(drawn.map((d) => d.name));
  let out = '';
  for (const d of drawn) {
    for (const f of drawn)
      if (f.under && rig.fuse[f.name] === d.name) out += group(`${f.name}-line`, f.tf, f.under);
    const fused = rig.fuse[d.name] && joined.has(rig.fuse[d.name]);
    const knee = rig.knees[d.name];
    const bend = pose.bend[d.name];
    const inner =
      knee && bend
        ? bentLeg(`tk-knee-${character.id}-${d.name}`, knee, bend, d.svg, d.under, width)
        : (fused ? '' : d.under) + d.svg;
    out += group(d.name, d.tf, inner);
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
 */
export function sideOf(actor: Pick<ActorState, 'facing' | 'turn'>): number {
  const to = actor.facing === 'left' ? -1 : 1;
  if (!actor.turn || actor.turn.from === actor.facing) return to;
  const u = actor.turn.u;
  return (u < 0.5 ? -to : to) * Math.max(0.12, Math.abs(Math.cos(Math.PI * u)));
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
  const rig = RIGS[character.rig];
  const s = (character.height / rig.height) * scale;
  const side = typeof facing === 'number' ? facing : facing === 'left' ? -1 : 1;
  const flip = side !== 1 ? ` scale(${n(side)} 1)` : '';
  // translate so the feet point lands on (x, y); flip about the box centre line.
  const tf = `translate(${n(x)} ${n(y)}) scale(${n(s)})${flip} translate(${-rig.width / 2} ${-rig.height})`;
  const op = opacity < 1 ? ` opacity='${n(opacity)}'` : '';
  return `<g class='actor actor-${character.id}' transform='${tf}'${op}>${body}</g>`;
}

export function renderActor(actor: ActorState, t: number, pose = poseFor(actor, t)): string {
  if (!actor.visible || actor.opacity <= 0) return '';
  const body = characterBody(actor.character, pose);
  return placeCharacter(
    actor.character,
    body,
    actor.x,
    actor.y,
    actor.scale,
    sideOf(actor),
    actor.opacity
  );
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
  const rig = RIGS[character.rig];
  const s = (character.height / rig.height) * scale;
  const k = 1 / (1 + Math.max(0, -pose.dy) / 120);
  const rx = (rig.shadow / 2) * s * Math.abs(pose.sx) * k;
  const o = opacity * k * k;
  if (rx <= 0 || o <= 0.01) return '';
  const op = o < 1 ? ` opacity='${n(o)}'` : '';
  return `<ellipse cx='${n(x + s * side * pose.dx)}' cy='${n(y)}' rx='${n(rx)}' ry='${n(rx * 0.2)}' fill='url(#tk-shadow)'${op}/>`;
}

/** An actor's ground shadow: none while it flies, is carried, or is hidden. */
export function renderShadow(actor: ActorState, pose: Pose): string {
  if (!actor.visible || actor.opacity <= 0 || !castsShadow(actor.character)) return '';
  if (actor.heldBy || actor.locomotion === 'fly') return '';
  return shadowSvg(
    actor.character,
    pose,
    actor.x,
    actor.y,
    actor.scale,
    sideOf(actor),
    actor.opacity
  );
}

/** Where a carried prop is held (the rig's hold point, through the pose), in the scene. */
export function holdPoint(actor: ActorState, pose: Pose): { x: number; y: number } {
  const rig = RIGS[actor.character.rig];
  const s = (actor.character.height / rig.height) * actor.scale;
  const [hx, hy] = toRoot(rig, pose, rig.hold.part, rig.hold.point);
  // The root transforms the composer applies: scale about the feet, then the body offset.
  const x = rig.width / 2 + pose.sx * (hx - rig.width / 2) + pose.dx;
  const y = rig.height + pose.sy * (hy - rig.height) + pose.dy;
  return {
    x: actor.x + s * sideOf(actor) * (x - rig.width / 2),
    y: actor.y + s * (y - rig.height),
  };
}

/** Top of the head in world space (for bubbles): the rig's speaker point, mirrored. */
export function actorHeadTop(actor: ActorState, pose: Pose): { x: number; y: number } {
  const rig = RIGS[actor.character.rig];
  const s = (actor.character.height / rig.height) * actor.scale;
  const [sx, sy] = rig.speaker;
  const side = sideOf(actor);
  return {
    x: actor.x + (pose.dx + (sx - rig.width / 2)) * s * side,
    y: actor.y - rig.height * s + (pose.dy + sy) * s,
  };
}
