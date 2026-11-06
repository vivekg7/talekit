import type { Pose } from './motion.js';

/**
 * Chains: a part that bends along its length, the way a leg bends at the knee, rather than
 * swinging stiff about one hinge. A tail is cut into a few links; a turn of the tail is
 * shared out along them, so it curves, and its follow-through runs down it from the root
 * to the tip (see springs.ts). A head can be a chain of two, the neck and the head, so a
 * bow comes from both rather than snapping the head down off a stiff neck; what hangs from
 * a chain part (the eyes and mouth on a head) goes with its last link.
 */

export type Pt = [number, number];

/** A part's links, in its own coordinates. */
export interface Link {
  /** Where each link after the first turns: its joint with the one before. */
  joints: Pt[];
  /** Along the part at each joint, root to tip: the cut there is square to it. */
  dirs: Pt[];
  /** Half the part's width at each joint: the round joint drawn there. */
  radii: number[];
  /** What share of the part's turn each link takes, root first; they add up to 1. */
  shares: number[];
  /** The far end of the part. */
  tip: Pt;
}

/** The most links a part may be cut into, and how close together joints may sit. */
export const MAX_LINKS = 8;

const RAD = Math.PI / 180;

/**
 * The points an SVG fragment is drawn through, from its absolute coordinates: circle and
 * ellipse centres and extremes, rect corners, line ends, and every point of an absolute
 * path (an arc's end point). A relative path is skipped, as elsewhere (the house style).
 */
export function shapePoints(svg: string): Pt[] {
  const pts: Pt[] = [];
  for (const [, tag, attrs] of svg.matchAll(/<(\w+)([^>]*)>/g)) {
    const a: Record<string, number> = {};
    for (const [, k, v] of attrs.matchAll(/([\w-]+)='([^']*)'/g)) a[k] = parseFloat(v);
    if (tag === 'circle') {
      const r = a.r || 0;
      pts.push([a.cx - r, a.cy], [a.cx + r, a.cy], [a.cx, a.cy - r], [a.cx, a.cy + r]);
    } else if (tag === 'ellipse') {
      const [rx, ry] = [a.rx || 0, a.ry || 0];
      pts.push([a.cx - rx, a.cy], [a.cx + rx, a.cy], [a.cx, a.cy - ry], [a.cx, a.cy + ry]);
    } else if (tag === 'rect') {
      pts.push([a.x, a.y], [a.x + a.width, a.y + a.height]);
    } else if (tag === 'line') {
      pts.push([a.x1, a.y1], [a.x2, a.y2]);
    } else if (tag === 'path') {
      const d = attrs.match(/\bd='([^']*)'/)?.[1];
      if (d && !/[a-y]/.test(d.replace(/e-?\d/g, ''))) pts.push(...pathPoints(d));
    }
  }
  return pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

/** The points of an absolute path: every coordinate pair, an arc's end point only. */
function pathPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  for (const [, cmd, args] of d.matchAll(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/g)) {
    const nums = args.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
    if (cmd === 'A') {
      for (let i = 0; i + 6 < nums.length; i += 7) pts.push([nums[i + 5], nums[i + 6]]);
    } else if (cmd === 'H' || cmd === 'V') {
      const last = pts[pts.length - 1];
      if (last) for (const v of nums) pts.push(cmd === 'H' ? [v, last[1]] : [last[0], v]);
    } else {
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    }
  }
  return pts;
}

const unit = (x: number, y: number): Pt => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

/**
 * Each link's share of a turn: the root a little more than the tip, as a tail is stiffer
 * where it leaves the body.
 */
function sharesFor(count: number): number[] {
  const w = Array.from({ length: count }, (_, i) => 1 - (0.3 * i) / Math.max(1, count - 1));
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

/**
 * A part's links, from how it is drawn. `spec` is how many links to cut it into, evenly
 * along it from the pivot to its far end, each joint on the middle of the part there; or
 * the joints themselves, root first. Undefined when there is nothing to cut.
 */
export function linkFor(svg: string, pivot: Pt, spec: number | Pt[]): Link | undefined {
  const pts = shapePoints(svg);
  if (!pts.length) return undefined;
  const [px, py] = pivot;
  let tip = pts[0];
  for (const p of pts)
    if (Math.hypot(p[0] - px, p[1] - py) > Math.hypot(tip[0] - px, tip[1] - py)) tip = p;
  const length = Math.hypot(tip[0] - px, tip[1] - py);
  if (length < 4) return undefined;
  let joints: Pt[];
  if (typeof spec === 'number') {
    const count = Math.min(MAX_LINKS, Math.round(spec));
    if (count < 2) return undefined;
    const [ux, uy] = unit(tip[0] - px, tip[1] - py);
    const slab = length / count / 2;
    joints = [];
    for (let k = 1; k < count; k++) {
      // The middle of the part across this point along it, so a curling tail's joints
      // follow its curve rather than the straight line to its tip.
      const at = (length * k) / count;
      const near = pts.filter((p) => Math.abs((p[0] - px) * ux + (p[1] - py) * uy - at) <= slab);
      joints.push(
        near.length
          ? [
              near.reduce((s, p) => s + p[0], 0) / near.length,
              near.reduce((s, p) => s + p[1], 0) / near.length,
            ]
          : [px + ux * at, py + uy * at]
      );
    }
  } else {
    joints = spec.slice(0, MAX_LINKS - 1);
    if (!joints.length) return undefined;
  }
  const along = [pivot, ...joints, tip];
  const dirs = joints.map((_, i) =>
    unit(along[i + 2][0] - along[i][0], along[i + 2][1] - along[i][1])
  );
  const radii = joints.map(([jx, jy], i) => {
    // Half the spread of the drawing across the part, near this joint.
    const [dx, dy] = dirs[i];
    const reach = Math.max(
      4,
      Math.hypot(along[i + 2][0] - along[i][0], along[i + 2][1] - along[i][1]) / 4
    );
    const across = pts
      .filter((p) => Math.abs((p[0] - jx) * dx + (p[1] - jy) * dy) <= reach)
      .map((p) => (p[0] - jx) * -dy + (p[1] - jy) * dx);
    if (!across.length) return 6;
    return Math.max(3, (Math.max(...across) - Math.min(...across)) / 2);
  });
  return { joints, dirs, radii, shares: sharesFor(joints.length + 1), tip };
}

/**
 * Each link's turn, root first: its share of the part's turn (`Pose.rot`), plus its own
 * follow-through (`Pose.curl`).
 */
export function linkAngles(link: Link, pose: Pose, part: string): number[] {
  const turn = pose.rot[part] ?? 0;
  const curl = pose.curl?.[part];
  return link.shares.map((s, i) => s * turn + (curl?.[i] ?? 0));
}

function rotate([x, y]: Pt, deg: number, [cx, cy]: Pt): Pt {
  const r = deg * RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/** Whether a point drawn in the part lies past joint `i`: on the tip's side of its cut. */
export function pastJoint(link: Link, i: number, [x, y]: Pt): boolean {
  const [jx, jy] = link.joints[i];
  const [dx, dy] = link.dirs[i];
  return (x - jx) * dx + (y - jy) * dy > 0;
}

/**
 * A point drawn in the part, carried through the turns of the joints it lies past (all of
 * them for a point on something hung from the part), not the root's.
 */
export function curlPoint(link: Link, angles: number[], p: Pt, hung: boolean): Pt {
  const past = link.joints.map((_, i) => hung || pastJoint(link, i, p));
  let out = p;
  for (let i = link.joints.length - 1; i >= 0; i--)
    if (past[i] && angles[i + 1]) out = rotate(out, angles[i + 1], link.joints[i]);
  return out;
}
