import { poseFor } from './actor.js';
import { toRoot } from './gait.js';
import type { Pose } from './motion.js';
import { rigPart, RIGS, type Rig } from './rigs.js';
import { resolveActor, type ActorState } from './timeline.js';
import type { Character, Project, Shot } from './types.js';

/**
 * Follow-through. Each spring part is a damped spring about its rest pose, pushed by the
 * acceleration of the point it hangs from: a tail trails when a walk starts, flicks past
 * on the stop, bounces with a landing. Integrated at a fixed step from the start of the
 * shot, so the same frame always renders the same, whatever order frames are asked for.
 * Parts the rig places turn about their pivot; parts it does not know sway in place.
 */

const STEP = 1 / 120;
/** Natural frequency (Hz), damping ratio, and how far a part may be thrown. */
const HZ = 2.2;
const DAMPING = 0.24;
const MAX_TURN = 28;
const MAX_SWAY = 6;
/** Canonical units per step beyond which a move is a cut or a teleport, not motion. */
const JUMP_CUT = 30;
/** Lever length (canonical units) for turning the push into an angular one. */
const LEVER = 40;
const RAD = Math.PI / 180;

type Pt = [number, number];

/** Rough middle of an SVG fragment from its absolute coordinates; enough to aim a lever. */
function roughCentre(svg: string): Pt | undefined {
  const pts: Pt[] = [];
  for (const [, tag, attrs] of svg.matchAll(/<(\w+)([^>]*)>/g)) {
    const a: Record<string, number> = {};
    for (const [, k, v] of attrs.matchAll(/([\w-]+)='([^']*)'/g)) a[k] = parseFloat(v);
    const d = attrs.match(/\bd='([^']*)'/)?.[1];
    if (tag === 'circle' || tag === 'ellipse') pts.push([a.cx, a.cy]);
    else if (tag === 'rect') pts.push([a.x + a.width / 2, a.y + a.height / 2]);
    else if (tag === 'line') pts.push([a.x1, a.y1], [a.x2, a.y2]);
    else if (tag === 'path' && d && /^[MLQCTSZ\d\s.,-]+$/.test(d)) {
      // Absolute commands only (the house style); a relative path is skipped.
      const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    }
  }
  const ok = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!ok.length) return undefined;
  return [
    ok.reduce((s, p) => s + p[0], 0) / ok.length,
    ok.reduce((s, p) => s + p[1], 0) / ok.length,
  ];
}

export function springParts(character: Character): string[] {
  const names = character.springs ?? RIGS[character.rig].springs;
  return names.filter((n) => character.parts[n] !== undefined);
}

interface Spring {
  part: string;
  /** Turning (a part the rig places) or swaying (one it does not). */
  turns: boolean;
  /** Unit vector from the pivot toward the part's mass, in the part's own frame. */
  lever: Pt;
  /** Angle (degrees) or sway (x, y) per step. */
  values: Pt[];
  v: Pt;
  x: Pt;
}

interface Sim {
  project: Project;
  springs: Spring[];
  /** The last three driver samples: pivot positions and parent angles per spring. */
  samples: { pos: Pt[]; turn: number[] }[];
  /** Steps integrated so far. */
  done: number;
}

const CACHE = new WeakMap<Shot, Map<string, Sim>>();

function leverOf(rig: Rig, character: Character, part: string): Pt {
  const p = character.parts[part];
  const svg = typeof p === 'string' ? p : (Object.values(p)[0] ?? '');
  const c = roughCentre(svg);
  const [px, py] = rigPart(rig, part).pivot;
  if (c) {
    const dx = c[0] - px;
    const dy = c[1] - py;
    const len = Math.hypot(dx, dy);
    if (len > 4) return [dx / len, dy / len];
  }
  return [0, -1];
}

/** Summed rotation of what a part hangs from, its own turn included. */
function turnOf(rig: Rig, pose: Pose, part: string, own: boolean): number {
  let r = own ? (pose.rot[part] ?? 0) : 0;
  for (let cur = rigPart(rig, part).parent; cur; cur = rigPart(rig, cur).parent)
    r += pose.rot[cur] ?? 0;
  return r;
}

/** Where each spring's pivot is, in canonical units in the actor's own facing frame. */
function sample(project: Project, shot: Shot, id: string, springs: Spring[], t: number) {
  const scene = project.scenes[shot.scene];
  const actor: ActorState = resolveActor(project, scene, shot, id, t);
  const rig = RIGS[actor.character.rig];
  const pose = poseFor(actor, t);
  const k = (actor.character.height / rig.height) * actor.scale;
  const side = actor.facing === 'left' ? -1 : 1;
  const pos: Pt[] = [];
  const turn: number[] = [];
  for (const s of springs) {
    const [x, y] = toRoot(rig, pose, s.part, rigPart(rig, s.part).pivot);
    // The pose's own motion (scaled about the feet, as the composer draws it), plus the
    // actor's travel turned into its facing frame.
    const px = rig.width / 2 + pose.sx * (x - rig.width / 2) + pose.dx;
    const py = rig.height + pose.sy * (y - rig.height) + pose.dy;
    pos.push([(actor.x * side) / k + px, actor.y / k + py]);
    turn.push(turnOf(rig, pose, s.part, s.turns));
  }
  return { pos, turn };
}

function simFor(project: Project, shot: Shot, id: string): Sim {
  let byActor = CACHE.get(shot);
  if (!byActor) CACHE.set(shot, (byActor = new Map()));
  let sim = byActor.get(id);
  if (sim && sim.project === project) return sim;
  const character = project.characters[id];
  const rig = RIGS[character.rig];
  const springs: Spring[] = springParts(character).map((part) => ({
    part,
    turns: !!rig.parts[part],
    lever: leverOf(rig, character, part),
    values: [[0, 0]],
    v: [0, 0],
    x: [0, 0],
  }));
  sim = { project, springs, samples: [], done: 0 };
  byActor.set(id, sim);
  return sim;
}

/** Integrate one step: the push is the pivot's acceleration over the last two steps. */
function advance(sim: Sim, project: Project, shot: Shot, id: string): void {
  const n = sim.done;
  while (sim.samples.length < 3) {
    const i = n + sim.samples.length - 1;
    sim.samples.push(sample(project, shot, id, sim.springs, Math.max(0, i) * STEP));
  }
  const [a, b, c] = sim.samples;
  const w = 2 * Math.PI * HZ;
  sim.springs.forEach((s, j) => {
    let ax = (c.pos[j][0] - 2 * b.pos[j][0] + a.pos[j][0]) / (STEP * STEP);
    let ay = (c.pos[j][1] - 2 * b.pos[j][1] + a.pos[j][1]) / (STEP * STEP);
    const cut =
      Math.hypot(c.pos[j][0] - b.pos[j][0], c.pos[j][1] - b.pos[j][1]) > JUMP_CUT ||
      Math.hypot(b.pos[j][0] - a.pos[j][0], b.pos[j][1] - a.pos[j][1]) > JUMP_CUT;
    if (cut) ax = ay = 0;
    if (s.turns) {
      // The lever, turned with its parent, pushed sideways by the acceleration; and the
      // parent's own spin, which the part lags behind.
      const r = b.turn[j] * RAD;
      const lx = s.lever[0] * Math.cos(r) - s.lever[1] * Math.sin(r);
      const ly = s.lever[0] * Math.sin(r) + s.lever[1] * Math.cos(r);
      const spin = cut ? 0 : ((c.turn[j] - 2 * b.turn[j] + a.turn[j]) * RAD) / (STEP * STEP);
      const push = -(lx * ay - ly * ax) / LEVER - spin;
      s.v[0] += (push - w * w * s.x[0] - 2 * DAMPING * w * s.v[0]) * STEP;
      s.x[0] += s.v[0] * STEP;
      const lim = MAX_TURN * RAD;
      s.x[0] = Math.max(-lim, Math.min(lim, s.x[0]));
      s.values.push([s.x[0] / RAD, 0]);
    } else {
      for (const i of [0, 1]) {
        const acc = i === 0 ? ax : ay;
        s.v[i] += (-acc - w * w * s.x[i] - 2 * DAMPING * w * s.v[i]) * STEP;
        s.x[i] = Math.max(-MAX_SWAY, Math.min(MAX_SWAY, s.x[i] + s.v[i] * STEP));
      }
      s.values.push([s.x[0], s.x[1]]);
    }
  });
  sim.samples.shift();
  sim.done = n + 1;
}

/**
 * Add the springs to an actor's pose at shot time `t`. Steps are integrated once per shot
 * and actor and kept, so rendering a shot frame by frame costs one pass.
 */
export function applySprings(
  project: Project,
  shot: Shot,
  actor: ActorState,
  pose: Pose,
  t: number
): void {
  if (!springParts(actor.character).length) return;
  const sim = simFor(project, shot, actor.id);
  const at = Math.max(0, t) / STEP;
  const last = Math.floor(at) + 1;
  while (sim.done < last) advance(sim, project, shot, actor.id);
  const i = Math.floor(at);
  const f = at - i;
  for (const s of sim.springs) {
    const [x0, y0] = s.values[i];
    const [x1, y1] = s.values[i + 1] ?? s.values[i];
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    if (s.turns) pose.rot[s.part] = (pose.rot[s.part] ?? 0) + x;
    else {
      const [ox, oy] = pose.off[s.part] ?? [0, 0];
      pose.off[s.part] = [ox + x, oy + y];
    }
  }
}
