/**
 * The way a walk goes (docs/PLAN.md, phase 8.3): straight when nothing is in the way, else
 * the shortest way round. In the way are solids (`scene.solids`: a well, a cot) and the edge
 * of the walk areas (water is in the way where no walk area covers it); a scene with no walk
 * areas only has its solids gone round. A solid is passed on one side only: the art is flat,
 * so a walker behind one painted in `svg` would show in front of it, and one in `foreground`
 * is drawn over everyone; the strip behind (or in front of) its footprint is in the way too.
 * Found on a visibility graph: every corner stood a step off, joined wherever the straight
 * line between two stays on the ground.
 */
import { dist, EDGE_TOLERANCE, groundOf, inArea, nearestIn, type XY } from './area.js';
import type { Area, Scene } from './types.js';

/** How far off a corner the way turns, scene pixels at scale 1: room for the feet. */
const CLEARANCE = 14;
/** Scene pixels between the points of a line looked at to see that it stays on the ground. */
const STEP = 5;

/** The solid whose footprint holds p, by name. */
export function solidAt(scene: Scene, p: XY): string | undefined {
  for (const [id, s] of Object.entries(scene.solids ?? {})) if (inArea(s.area, p)) return id;
  return undefined;
}

/** Whether a walker can put its feet down at p, solids in `block` in the way. */
function footing(scene: Scene, block: Area[]): (p: XY) => boolean {
  const g = groundOf(scene);
  const ground = [...g.walk, ...g.shallow];
  const near = (a: Area, p: XY) => inArea(a, p) || dist(nearestIn(a, p), p) <= EDGE_TOLERANCE;
  return (p) => {
    if (block.some((a) => inArea(a, p))) return false;
    return !g.walk.length || ground.some((a) => near(a, p));
  };
}

/** The corners where a way round can turn: each corner stood `off` out from its two sides. */
function corners(areas: Area[], off: number): XY[] {
  const out: XY[] = [];
  for (const a of areas) {
    for (let i = 0; i < a.length; i++) {
      const [vx, vy] = a[i];
      const [px, py] = a[(i + a.length - 1) % a.length];
      const [nx, ny] = a[(i + 1) % a.length];
      // Away from both neighbours: out of a convex corner, in from a hollow one.
      const ux =
        (vx - px) / Math.hypot(vx - px, vy - py) + (vx - nx) / Math.hypot(vx - nx, vy - ny);
      const uy =
        (vy - py) / Math.hypot(vx - px, vy - py) + (vy - ny) / Math.hypot(vx - nx, vy - ny);
      const len = Math.hypot(ux, uy);
      if (!Number.isFinite(len) || len < 0.2) continue; // a straight run: no corner
      out.push({ x: vx + (ux / len) * off, y: vy + (uy / len) * off });
    }
  }
  return out;
}

/** Further than any stage reaches, scene pixels: where the strip past a solid ends. */
const FAR = 1e4;

/**
 * What of a solid is in the way: its footprint, and the strip behind it (painted in `svg`)
 * or in front of it (in `foreground`), from the middle of the footprint on.
 */
export function solidBlock(solid: { area: Area; layer?: 'svg' | 'foreground' }): Area[] {
  const xs = solid.area.map((p) => p[0]);
  const ys = solid.area.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const end = solid.layer === 'foreground' ? FAR : -FAR;
  return [
    solid.area,
    [
      [x0, mid],
      [x1, mid],
      [x1, end],
      [x0, end],
    ],
  ];
}

/**
 * Where the edges of two areas cross, a step off each way on the diagonals: overlapping
 * walk areas (a bridge laid across two banks) turn there, at no corner of either.
 */
function crossings(areas: Area[], off: number): XY[] {
  const edges: [number, number, number, number][] = [];
  for (const a of areas)
    for (let i = 0; i < a.length; i++) {
      const [x1, y1] = a[i];
      const [x2, y2] = a[(i + 1) % a.length];
      edges.push([x1, y1, x2, y2]);
    }
  const out: XY[] = [];
  const d = off / Math.SQRT2;
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [ax, ay, bx, by] = edges[i];
      const [cx, cy, dx, dy] = edges[j];
      const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (Math.abs(den) < 1e-9) continue;
      const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
      const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
      // Strictly inside both edges: a corner shared by two is a corner already.
      if (u <= 1e-6 || u >= 1 - 1e-6 || v <= 1e-6 || v >= 1 - 1e-6) continue;
      const x = ax + u * (bx - ax);
      const y = ay + u * (by - ay);
      for (const [sx, sy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        out.push({ x: x + sx * d, y: y + sy * d });
    }
  return out;
}

const MEMO = new WeakMap<Scene, Map<string, XY[]>>();

/**
 * The turns of a walk from `from` to `to` (scene pixels, feet), not counting either end:
 * none when the straight line is clear, or when no way round is found (the world check then
 * says what it crosses). A solid either end is on (a seat on the cot) is no obstacle to it.
 * `scale` widens the room kept round corners for a bigger walker.
 */
export function routeOf(scene: Scene, from: XY, to: XY, scale = 1): XY[] {
  if (!Object.keys(scene.solids ?? {}).length && !groundOf(scene).walk.length) return [];
  if (dist(from, to) < 1) return [];
  let memo = MEMO.get(scene);
  if (!memo) MEMO.set(scene, (memo = new Map()));
  const key = [from.x, from.y, to.x, to.y, scale].map((v) => Math.round(v * 10)).join(',');
  const hit = memo.get(key);
  if (hit) return hit;
  const solids = Object.values(scene.solids ?? {}).map(solidBlock);
  const out = findRoute(scene, solids, from, to, scale);
  if (memo.size > 2000) memo.clear();
  memo.set(key, out);
  return out;
}

function findRoute(scene: Scene, solids: Area[][], from: XY, to: XY, scale: number): XY[] {
  // A solid either end is on, or past (cast behind the well), is not in this walk's way.
  const block = solids.filter((s) => !s.some((a) => inArea(a, from) || inArea(a, to))).flat();
  const ok = footing(scene, block);
  const clear = (a: XY, b: XY) => {
    const n = Math.ceil(dist(a, b) / STEP);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      if (!ok({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })) return false;
    }
    return true;
  };
  if (clear(from, to)) return [];
  // Where it stands, or is going, off the ground (a perch the walk areas miss): nothing to
  // route on; the world check says so.
  if (!ok(from) || !ok(to)) return [];
  const g = groundOf(scene);
  const off = CLEARANCE * Math.max(0.5, scale);
  const areas = [...block, ...g.walk, ...g.shallow];
  const nodes = [from, to, ...[...corners(areas, off), ...crossings(areas, off)].filter(ok)];
  // Dijkstra over the visibility graph, edges tried as they are reached.
  const n = nodes.length;
  const best = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  best[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v]) continue;
      const d = best[u] + dist(nodes[u], nodes[v]);
      if (d < best[v] && clear(nodes[u], nodes[v])) {
        best[v] = d;
        prev[v] = u;
      }
    }
  }
  if (best[1] === Infinity) return [];
  const way: XY[] = [];
  for (let v = prev[1]; v > 0; v = prev[v]) way.unshift({ x: nodes[v].x, y: nodes[v].y });
  return way;
}

/** The length of a walk through its turns. */
export function routeLength(from: XY, via: XY[], to: XY): number {
  let len = 0;
  let a = from;
  for (const p of [...via, to]) {
    len += dist(a, p);
    a = p;
  }
  return len;
}
