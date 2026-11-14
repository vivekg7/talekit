/**
 * The world model: what the stage is (where the ground and the water are) and what each
 * actor is (where it can be on its own), and the rules a shot is held to as it plays.
 *
 * A rule runs on the actors' states sampled through the shot (the timeline is a pure
 * function of time) and reports findings: what is wrong, when, who, where, and a fix
 * when the fix is mechanical. Findings are errors that block the render until the shot is
 * fixed or the finding is waived with a reason (`allow`). See docs/PLAN.md, phase 8.
 */
import { resolveActor, type ActorState } from './timeline.js';
import type { Allow, Area, Character, Habitat, Project, Scene, Shot } from './types.js';

export type XY = { x: number; y: number };

export interface Finding {
  /** What kind of mistake, `support.air`: the key a waiver names. */
  code: string;
  shot: string;
  /** Seconds into the shot it starts and stops being true. */
  t: [number, number];
  actors: string[];
  message: string;
  /** Where on the stage, in scene pixels: the spot a picture of it rings. */
  at?: XY;
  /** A mechanical fix: set this JSON pointer in the shot file to this value. */
  fix?: { path: string; value: unknown };
}

/** Every finding code a waiver may name, and what it means. */
export const CODES: Record<string, string> = {
  'world.walk': 'the scene has no walk areas',
  'world.anchor': 'an anchor is on no walk or water area',
  'support.air': 'an actor that cannot fly is held up by nothing',
  'support.water': 'an actor that cannot swim is in deep water',
  'support.dry': 'an actor that lives in water is out of it',
};

/** How far off an area's edge feet may be and still stand on it, in scene pixels. */
export const EDGE_TOLERANCE = 6;
/** Seconds between the samples a rule sees. */
export const SAMPLE_STEP = 0.1;

// ---------------------------------------------------------------------------------------
// Geometry

export function inArea(area: Area, p: XY): boolean {
  let inside = false;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [xi, yi] = area[i];
    const [xj, yj] = area[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The nearest point of an area to p: p itself if it is inside. */
export function nearestIn(area: Area, p: XY): XY {
  if (inArea(area, p)) return p;
  let best: XY = p;
  let bestD = Infinity;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [ax, ay] = area[j];
    const [bx, by] = area[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const u = len ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / len)) : 0;
    const q = { x: ax + u * dx, y: ay + u * dy };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

/** The nearest point of any of the areas to p, and how far it is. */
function nearestOf(areas: Area[], p: XY): { point: XY; d: number } | undefined {
  let out: { point: XY; d: number } | undefined;
  for (const a of areas) {
    const q = nearestIn(a, p);
    const d = dist(q, p);
    if (!out || d < out.d) out = { point: q, d };
  }
  return out;
}

const within = (areas: Area[], p: XY) => (nearestOf(areas, p)?.d ?? Infinity) <= EDGE_TOLERANCE;

// ---------------------------------------------------------------------------------------
// What the stage is, and what an actor is

export interface Ground {
  walk: Area[];
  deep: Area[];
  shallow: Area[];
}

/** The scene's walk and water areas; a `river` effect's outline is deep water too. */
export function groundOf(scene: Scene): Ground {
  const deep: Area[] = [];
  const shallow: Area[] = [];
  for (const w of scene.water ?? []) (w.wade ? shallow : deep).push(w.area);
  for (const e of scene.effects ?? [])
    if (e.kind === 'river' && e.points && !scene.water?.length) deep.push(e.points as Area);
  return { walk: scene.walk ?? [], deep, shallow };
}

export function habitatOf(character: Character): Habitat[] {
  if (character.habitat) return character.habitat;
  return character.flaps?.length ? ['land', 'air'] : ['land'];
}

/**
 * What holds a character up at p, or the code of the mistake if nothing it can rest on
 * does: the ground or shallow water a walker, the water a swimmer, the air a flier. A walk
 * area wins over water under it: a stone in the river, a jetty or a boat's deck is a walk
 * area drawn on top of the water.
 */
export function supportAt(ground: Ground, habitat: Habitat[], p: XY): string | undefined {
  if (habitat.includes('air')) return undefined;
  const land = habitat.includes('land');
  const water = habitat.includes('water');
  const wet = within(ground.shallow, p) || within(ground.deep, p);
  if (land && (within(ground.walk, p) || within(ground.shallow, p))) return undefined;
  if (water && wet) return undefined;
  if (inAny(ground.deep, p)) return 'support.water';
  return land ? 'support.air' : 'support.dry';
}

const inAny = (areas: Area[], p: XY) => areas.some((a) => inArea(a, p));

/** The point an actor rests on: its feet, or the floor under a raised seat it sits on. */
function restingPoint(a: ActorState): XY {
  if (a.seat > 0 && a.sit > 0 && !a.perched) return { x: a.x, y: a.y + a.seat };
  return { x: a.x, y: a.y };
}

/** Held up by something the engine itself places it on, or out of sight: no check. */
function heldUp(a: ActorState, width: number): boolean {
  if (!a.visible || a.opacity <= 0.01) return true;
  if (a.heldBy || a.on) return true;
  if (a.verbs.some((v) => v.verb === 'jump')) return true;
  return a.x < 0 || a.x > width;
}

// ---------------------------------------------------------------------------------------
// Waivers

/** Whether the shot or its scene waives this code, for every actor or for this one. */
export function waived(allow: Allow[], code: string, actor?: string): boolean {
  return allow.some((a) => a && (a[code] !== undefined || (actor && a[`${code}:${actor}`])));
}

/** A waiver key that names no check: a typo that would waive nothing. */
export function unknownWaivers(allow: Allow): string[] {
  return Object.keys(allow ?? {}).filter((k) => !CODES[k.split(':')[0]]);
}

// ---------------------------------------------------------------------------------------
// The scene on its own

export function sceneFindings(scene: Scene, width: number): Omit<Finding, 'shot' | 't'>[] {
  const out: Omit<Finding, 'shot' | 't'>[] = [];
  const allow = [scene.allow];
  const ground = groundOf(scene);
  if (!ground.walk.length) {
    if (!waived(allow, 'world.walk'))
      out.push({
        code: 'world.walk',
        actors: [],
        message:
          "has no walk areas, so nothing in it can be checked for standing on air. Add `walk`: a polygon round each thing the art lets feet stand on (the floor, a stair, a branch), or allow { 'world.walk': reason } for a scene with nothing to stand on",
      });
    return out;
  }
  for (const [name, a] of Object.entries(scene.anchors)) {
    if (a.x < 0 || a.x > width) continue;
    const p = { x: a.x, y: a.floor ?? a.y };
    if (within(ground.walk, p) || within(ground.deep, p) || within(ground.shallow, p)) continue;
    if (waived(allow, 'world.anchor', name)) continue;
    const near = nearestOf(ground.walk, p);
    out.push({
      code: 'world.anchor',
      actors: [],
      at: p,
      message:
        `anchor '${name}' (${r(p.x)}, ${r(p.y)})${a.floor !== undefined ? ', the floor under the seat,' : ''} is on no walk or water area` +
        (near ? `; the nearest ground is (${r(near.point.x)}, ${r(near.point.y)})` : '') +
        `. Move it onto what it stands on, add that surface to \`walk\`, or allow { 'world.anchor:${name}': reason } for a spot in the air (a bird's flight)`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The shot as it plays

export interface Sample {
  t: number;
  actors: ActorState[];
}

/** The shot's actors every SAMPLE_STEP seconds, the last moment included. */
export function sampleShot(project: Project, shot: Shot): Sample[] {
  const scene = project.scenes[shot.scene];
  const ids = Object.keys(shot.cast);
  const times: number[] = [];
  for (let i = 0; i * SAMPLE_STEP < shot.duration; i++) times.push(r2(i * SAMPLE_STEP));
  times.push(Math.max(0, shot.duration - 1e-3));
  return times.map((t) => ({
    t,
    actors: ids.map((id) => resolveActor(project, scene, shot, id, t)),
  }));
}

/** Each actor held up by something it can rest on, through the whole shot. */
function supportRule(project: Project, shot: Shot, samples: Sample[]): Finding[] {
  const scene = project.scenes[shot.scene];
  const ground = groundOf(scene);
  if (!ground.walk.length) return [];
  const allow = [shot.allow, scene.allow];
  const W = project.meta.width;
  const out: Finding[] = [];
  for (const id of Object.keys(shot.cast)) {
    const habitat = habitatOf(project.characters[id]);
    let run: { code: string; t0: number; t1: number; at: XY; still: boolean } | undefined;
    const close = () => {
      if (!run) return;
      if (!waived(allow, run.code, id)) out.push(supportFinding(shot, id, run, ground));
      run = undefined;
    };
    for (const s of samples) {
      const a = s.actors.find((x) => x.id === id)!;
      const p = restingPoint(a);
      const code = heldUp(a, W) ? undefined : supportAt(ground, habitat, p);
      if (run && code === run.code) {
        run.t1 = s.t;
        if (dist(p, run.at) > 1) run.still = false;
        continue;
      }
      close();
      if (code) run = { code, t0: s.t, t1: s.t, at: p, still: true };
    }
    close();
  }
  return out;
}

function supportFinding(
  shot: Shot,
  id: string,
  run: { code: string; t0: number; t1: number; at: XY; still: boolean },
  ground: Ground
): Finding {
  const { code, at } = run;
  const span = run.t0 === run.t1 ? `at ${r1(run.t0)}s` : `from ${r1(run.t0)}s to ${r1(run.t1)}s`;
  const target = code === 'support.dry' ? [...ground.deep, ...ground.shallow] : ground.walk;
  const near = nearestOf(target, at);
  const where = `(${r(at.x)}, ${r(at.y)})`;
  const what =
    code === 'support.air'
      ? `stands on nothing at ${where} ${span}: it is on no walk area and cannot fly, so it shows floating`
      : code === 'support.water'
        ? `is in deep water at ${where} ${span} and cannot swim`
        : `is out of the water at ${where} ${span}, and lives in it`;
  const nearText = near
    ? ` The nearest ${code === 'support.dry' ? 'water' : 'ground'} is (${r(near.point.x)}, ${r(near.point.y)}).`
    : '';
  const how =
    code === 'support.water'
      ? ' Keep it on the bank, mark the water `wade: true` if it is shallow there, or give the character habitat water.'
      : code === 'support.dry'
        ? ' Put it in the water, or give the character habitat land if it walks.'
        : " Put it on the ground, add what it stands on to the scene's `walk`, or give the character habitat air if it flies.";
  const cast = shot.cast[id];
  const fix =
    near && run.t0 === 0 && run.still && typeof cast.at === 'object'
      ? { path: `/cast/${id}/at`, value: { ...cast.at, x: r(near.point.x), y: r(near.point.y) } }
      : undefined;
  return {
    code,
    shot: shot.id,
    t: [r1(run.t0), r1(run.t1)],
    actors: [id],
    at,
    message: `'${id}' ${what}.${nearText}${how}`,
    ...(fix ? { fix } : {}),
  };
}

const RULES = [supportRule];

/** Every finding in a shot, waivers applied. */
export function shotFindings(project: Project, shot: Shot): Finding[] {
  const samples = sampleShot(project, shot);
  return RULES.flatMap((rule) => rule(project, shot, samples));
}

const r = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
