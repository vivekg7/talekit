import { applyVerb, basePose, resolveFace, type Pose } from './motion.js';
import { rigPart, RIGS, type Rig } from './rigs.js';
import { DEFAULT_LINE_COLOR, OUTLINE_PX, outlineFor } from './outline.js';
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
  if (sat) applyVerb(rig, pose, 'sit', actor.sit);
  for (const v of actor.verbs) applyVerb(rig, pose, v.verb, v.u);
  // Turning round: the body narrows through the mirror and stretches a touch as it does.
  if (actor.turn) pose.sy *= 1 + 0.04 * Math.sin(Math.PI * actor.turn.u);
  pose.face = resolveFace(actor.character.parts, {
    emotion: actor.emotion,
    overrides: actor.face,
    talking: actor.talking,
    t,
    phase: actor.phase,
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

/** Draw the character's parts in canonical coordinates with the given pose. */
export function characterBody(character: Character, pose: Pose): string {
  const rig = RIGS[character.rig];
  const names = Object.keys(character.parts).sort((a, b) => rigPart(rig, a).z - rigPart(rig, b).z);
  const line = character.colors.line ?? DEFAULT_LINE_COLOR;
  const width = outlineWidth(character);
  let out = '';
  for (const name of names) {
    const part = character.parts[name];
    const svg = typeof part === 'string' ? part : part[pose.face[name] ?? Object.keys(part)[0]];
    if (!svg) continue;
    const tf = transformChain(rig, pose, name);
    const drawn = applyColors(svg, character.colors);
    // Eyes and mouth are detail on top of the head: a lighter line, or they look stamped on.
    const under = character.outline
      ? outlineFor(drawn, line, FACE_PARTS.has(name) ? width / 2 : width)
      : '';
    out += `<g class='part-${name}'${tf ? ` transform='${tf}'` : ''}>${under}${drawn}</g>`;
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
