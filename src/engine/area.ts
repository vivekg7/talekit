/** Areas on the stage (walk, water): polygons of [x, y] corners in scene pixels. */
import type { Area, Character, Habitat, Scene } from './types.js';

export type XY = { x: number; y: number };

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

/**
 * Where something dropped at p comes to rest: straight down onto the first walk area under
 * it at or below `floor` (the floor its carrier stood on), or on that floor when the scene
 * has no walk areas or none is under it. `leave`, a point on a perch the carrier stood on
 * (a branch), is stepped off first: what a monkey up a tree drops lands on the ground.
 */
export function landing(walk: Area[], p: XY, floor: number, leave?: XY): number {
  if (!walk.length) return Math.max(p.y, floor);
  const own = leave ? walk.filter((a) => inArea(a, leave)) : [];
  const others = walk.filter((a) => !own.includes(a));
  const from = Math.max(p.y, leave ? leave.y : floor);
  for (let y = from; y < from + 2000; y += 2)
    if (others.some((a) => inArea(a, { x: p.x, y }))) return y;
  return Math.max(p.y, floor);
}

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

/** How far above a walk area feet may be and be put down on it, in scene pixels. */
export const SNAP = 12;

/**
 * Feet a hair above the ground, put on it: the y of the walk area straight below p within
 * SNAP pixels, when p itself is on no walk or water area; undefined otherwise.
 */
export function snapDown(ground: Ground, p: XY): number | undefined {
  const on = (q: XY) =>
    [...ground.walk, ...ground.deep, ...ground.shallow].some((a) => inArea(a, q));
  if (!ground.walk.length || on(p)) return undefined;
  for (let dy = 1; dy <= SNAP; dy++)
    if (ground.walk.some((a) => inArea(a, { x: p.x, y: p.y + dy }))) return p.y + dy;
  return undefined;
}
