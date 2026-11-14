/**
 * The world model: what the stage is (where the ground and the water are) and what each
 * actor is (where it can be on its own), and the rules a shot is held to as it plays.
 *
 * A rule runs on the actors' states sampled through the shot (the timeline is a pure
 * function of time) and reports findings: what is wrong, when, who, where, and a fix
 * when the fix is mechanical. Findings are errors that block the render until the shot is
 * fixed or the finding is waived with a reason (`allow`). See docs/PLAN.md, phase 8.
 */
import { waived } from './allow.js';
import { groundOf, habitatOf, inArea, nearestIn, type Ground, type XY } from './area.js';
import {
  BUSY,
  carriesOn,
  CONTACT,
  directs,
  FOCUSED,
  follows,
  leftAs,
  shotBefore,
  sideOf,
} from './stage.js';
import { holdPoint, poseFor } from './actor.js';
import {
  actionDuration,
  attachTime,
  giveParties,
  resolveActor,
  resolveCamera,
  touchPoint,
  wipeSpot,
  type ActorState,
} from './timeline.js';
import { STRIKE_HIT } from './motion.js';
import { lineEnd } from './voice.js';

export { waived };
import type { Allow, Area, Character, Habitat, Project, Scene, Shot, View } from './types.js';

export { groundOf, habitatOf, inArea, nearestIn };
export type { Ground };
export type { XY };

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
  'support.climb': 'a climb goes up nothing that can be climbed',
  'attention.listener': 'someone spoken to faces away from the speaker',
  'attention.speaker': 'a speaker faces away from who the line is said to',
  'attention.reacts': 'someone reacts to what they face away from',
  'continuity.jump': 'something jumps across the stage between frames, in sight',
  'continuity.cut':
    'across a cut that carries straight on in the same place, someone is not as the last shot left them',
  'continuity.direction':
    'someone goes off one side and comes on in the next place moving back the way they came',
  'continuity.line':
    'across a cut to a closer or other view of the same moment, two swap sides (the 180° rule)',
  'contact.reach':
    'a blow, a wipe or a hold at something stands too far off (or too close) to land on it',
  'give.reach': 'the two in a give stand too far apart, or face away, for their hands to meet',
  'speech.mismatch': 'no voiced take of a line, heard by speech recognition, says it',
};

/** Moving at least this far, scene pixels, over a shot's first seconds is going somewhere. */
export const TRAVEL_MIN = 60;

/** Closer than this across, scene pixels, two stand one behind the other: neither side. */
const LINE_GAP = 30;

/** A blow, wipe or hold landing further than this from its target, of its doer's height, misses. */
export const CONTACT_MISS = 0.12;

/** Further than this from where the last shot left it, scene pixels, reads as a jump cut. */
export const CUT_SHIFT = 12;
/** A size this much off the last shot's (as a share) reads as a jump. */
const CUT_SIZE = 0.06;

/** Faster than this across the stage (scene pixels a second) reads as a jump cut. */
export const JUMP_SPEED = 1500;
/** Seconds into a line before who is spoken to must face the speaker: time to turn. */
export const LOOK_GRACE = 0.7;

/** How far off an area's edge feet may be and still stand on it, in scene pixels. */
export const EDGE_TOLERANCE = 6;
/** Seconds between the samples a rule sees. */
export const SAMPLE_STEP = 0.1;

// ---------------------------------------------------------------------------------------
// Geometry

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
  if (a.heldBy || a.on || a.falling) return true;
  if (a.verbs.some((v) => v.verb === 'jump')) return true;
  return a.x < 0 || a.x > width;
}

// ---------------------------------------------------------------------------------------
// Waivers

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
    let run: Run | undefined;
    const close = () => {
      if (!run) return;
      if (!waived(allow, run.code, id)) out.push(supportFinding(shot, id, run, ground));
      run = undefined;
    };
    for (const s of samples) {
      const a = s.actors.find((x) => x.id === id)!;
      const p = restingPoint(a);
      const code = heldUp(a, W)
        ? undefined
        : a.locomotion === 'climb'
          ? within(ground.climb, p)
            ? undefined
            : 'support.climb'
          : supportAt(ground, habitat, p);
      if (run && code === run.code) {
        run.t1 = s.t;
        if (dist(p, run.at) > 1) run.still = false;
        if (a.locomotion === 'move') run.slides = true;
        continue;
      }
      close();
      if (code)
        run = { code, t0: s.t, t1: s.t, at: p, still: true, slides: a.locomotion === 'move' };
    }
    close();
  }
  return out;
}

/** A stretch of samples with the same support mistake. */
interface Run {
  code: string;
  t0: number;
  t1: number;
  /** Where it starts. */
  at: XY;
  /** It stays put the whole time. */
  still: boolean;
  /** Some of it is a `move`: standing, gliding there. */
  slides: boolean;
}

function supportFinding(shot: Shot, id: string, run: Run, ground: Ground): Finding {
  const { code, at } = run;
  const span = run.t0 === run.t1 ? `at ${r1(run.t0)}s` : `from ${r1(run.t0)}s to ${r1(run.t1)}s`;
  const target =
    code === 'support.dry'
      ? [...ground.deep, ...ground.shallow]
      : code === 'support.climb'
        ? ground.climb
        : ground.walk;
  const near = nearestOf(target, at);
  const where = `(${r(at.x)}, ${r(at.y)})`;
  const what =
    code === 'support.air'
      ? `stands on nothing at ${where} ${span}: it is on no walk area and cannot fly, so it shows floating`
      : code === 'support.climb'
        ? `climbs nothing at ${where} ${span}: it is in no \`climb\` area of the scene`
        : code === 'support.water'
          ? `is in deep water at ${where} ${span} and cannot swim`
          : `is out of the water at ${where} ${span}, and lives in it`;
  const kind =
    code === 'support.dry' ? 'water' : code === 'support.climb' ? 'climb area' : 'ground';
  const nearText = near ? ` The nearest ${kind} is (${r(near.point.x)}, ${r(near.point.y)}).` : '';
  const how =
    code === 'support.air' && run.slides
      ? " It glides there standing, with `move`: go up or down a ladder or a tree with `climb` (inside one of the scene's `climb` areas), up onto something with `jump`, or off it with `fall`."
      : code === 'support.climb'
        ? ' Climb straight up or down the ladder, trunk or wall, and give the scene a `climb` area round it, from the ground it stands on to the top it reaches.'
        : code === 'support.water'
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

/**
 * Who a line is said to faces the speaker, the speaker faces them, and a reaction faces
 * its cause. The engine turns whoever is free to (stage.ts); this finds the ones it could
 * not, because they were walking, busy with their hands, or turned away by the shot itself.
 */
function attentionRule(project: Project, shot: Shot): Finding[] {
  const scene = project.scenes[shot.scene];
  const allow = [shot.allow, scene.allow];
  const W = project.meta.width;
  const at = (id: string, t: number) => resolveActor(project, scene, shot, id, t);
  const out: Finding[] = [];
  /** Whether `id` faces away from `other` at t, when that matters; the state if so. */
  const away = (id: string, other: string, t: number) => {
    const me = at(id, t);
    const them = at(other, t);
    if (!watches(me, W) || !them.visible) return undefined;
    // Eyes on the mark (an archer's aim), or turned away by the shot itself: meant.
    if (me.verbs.some((v) => FOCUSED.has(v.verb))) return undefined;
    if (directs(shot, id, t - 3, t)) return undefined;
    const want = sideOf(me, them);
    return want && want !== me.facing ? me : undefined;
  };
  const report = (
    code: string,
    id: string,
    other: string,
    t: number,
    me: ActorState,
    what: string
  ) =>
    out.push({
      code,
      shot: shot.id,
      t: [r1(t), r1(t)],
      actors: [id, other],
      at: { x: me.x, y: me.y },
      message: `'${id}' faces ${me.facing}, away from '${other}', ${what} at ${r1(t)}s, because ${whyNot(me)}. Let it finish before the line (or start the line after), turn it with set.facing, or allow { '${code}:${id}': reason } if it means to look away.`,
    });
  /**
   * Through a line, once there has been time to turn (LOOK_GRACE): facing away for more
   * than half of it is a finding, reported where it first shows.
   */
  const during = (
    code: string,
    id: string,
    other: string,
    from: number,
    to: number,
    what: string
  ) => {
    if (waived(allow, code, id)) return;
    let first: { t: number; me: ActorState } | undefined;
    let n = 0;
    let bad = 0;
    for (let t = from + LOOK_GRACE; t < Math.min(to, shot.duration); t += SAMPLE_STEP) {
      n++;
      const me = away(id, other, t);
      if (!me) continue;
      bad++;
      first ??= { t, me };
    }
    if (first && bad * 2 > n) report(code, id, other, first.t, first.me, what);
  };
  for (const a of shot.actions) {
    if (!a.actor || !shot.cast[a.actor]) continue;
    if (a.say && a.bubble !== 'thought' && typeof a.to === 'string' && shot.cast[a.to]) {
      const end = lineEnd(project, shot, a);
      during('attention.listener', a.to, a.actor, a.t, end, `while '${a.actor}' speaks to it`);
      during('attention.speaker', a.actor, a.to, a.t, end, 'while it speaks to it');
    }
    if (
      a.reacts &&
      shot.cast[a.reacts] &&
      a.reacts !== a.actor &&
      !waived(allow, 'attention.reacts', a.actor)
    ) {
      const me = away(a.actor, a.reacts, a.t);
      if (me) report('attention.reacts', a.actor, a.reacts, a.t, me, 'as it reacts to it');
    }
  }
  return out;
}

/** Someone whose facing matters: in sight, awake, with eyes, on its own feet. */
function watches(a: ActorState, width: number): boolean {
  return (
    a.visible &&
    a.opacity > 0.01 &&
    !a.heldBy &&
    !!a.character.parts.eyes &&
    a.lie < 0.5 &&
    a.x >= 0 &&
    a.x <= width
  );
}

function whyNot(a: ActorState): string {
  if (a.locomotion !== 'idle') return `it is on the move (${a.locomotion})`;
  const busy = a.verbs.find((v) => BUSY.has(v.verb));
  if (busy) return `its hands are busy (${busy.verb})`;
  if (a.turn) return 'it is still turning';
  return 'it was not free to turn while the line lasted';
}

/**
 * Nothing in sight jumps from one place to another between frames: a roti passed between
 * two who stand far apart, a bundle put elsewhere with set.at while it shows. A cut, an
 * arrow, a fall and coming into or out of sight are not jumps.
 */
function jumpRule(project: Project, shot: Shot, samples: Sample[]): Finding[] {
  const scene = project.scenes[shot.scene];
  const allow = [shot.allow, scene.allow];
  const W = project.meta.width;
  const out: Finding[] = [];
  const seen = (a: ActorState) => a.visible && a.opacity > 0.01 && a.x >= -40 && a.x <= W + 40;
  for (const id of Object.keys(shot.cast)) {
    if (waived(allow, 'continuity.jump', id)) continue;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1].actors.find((x) => x.id === id)!;
      const b = samples[i].actors.find((x) => x.id === id)!;
      if (!seen(a) || !seen(b) || a.streak || b.streak || a.falling || b.falling) continue;
      // Carried through its carrier's turn or swung in a blow, it goes where the drawing
      // goes; so does an arrow on the string of a bow through its archer's turn.
      const archer = (s: Sample, x: ActorState) =>
        x.nockedOn ? s.actors.find((o) => o.id === x.nockedOn) : undefined;
      const turning = (s: Sample, x: ActorState) => !!archer(s, x)?.turn;
      if (
        (a.heldBy && a.heldBy === b.heldBy && (a.turn || b.turn || a.tilt || b.tilt)) ||
        (a.nockedOn &&
          a.nockedOn === b.nockedOn &&
          (turning(samples[i - 1], a) || turning(samples[i], b)))
      )
        continue;
      const dt = samples[i].t - samples[i - 1].t;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (dt <= 0 || d / dt < JUMP_SPEED) continue;
      const t0 = samples[i - 1].t;
      const t1 = samples[i].t;
      const placed = shot.actions.some((x) => x.actor === id && x.set?.at && x.t > t0 && x.t <= t1);
      const why =
        a.heldBy !== b.heldBy && b.heldBy
          ? `passes ${a.heldBy ? `from '${a.heldBy}'` : 'from where it was'} to '${b.heldBy}' from too far away, so it jumps rather than being handed over. ${a.heldBy ? `Stand them close and hand it over with do: 'give'` : `Have '${b.heldBy}' walk over and pickup`}`
          : placed
            ? 'is put somewhere else with set.at while in sight. Hide it first (set.visible false), move it with a verb, or cut'
            : b.locomotion === 'move' || a.locomotion === 'move'
              ? `moves faster than anything can (${Math.round(d / dt)} px a second) in a \`move\`. If it drops, use \`fall\`; otherwise give the move more time`
              : 'jumps across the stage between two frames. Move it with a verb, or cut';
      out.push({
        code: 'continuity.jump',
        shot: shot.id,
        t: [r1(t0), r1(t1)],
        actors: [id],
        at: { x: b.x, y: b.y },
        message: `'${id}' ${why} (${Math.round(d)} px between ${r1(t0)}s and ${r1(t1)}s).`,
      });
    }
  }
  return out;
}

/**
 * A give whose hands do not meet: the two stand too far apart (or one is turned away), so
 * the prop floats across the gap between them. Measured at the hand-over, hand to hand.
 */
function giveRule(project: Project, shot: Shot): Finding[] {
  const scene = project.scenes[shot.scene];
  const allow = [shot.allow, scene.allow];
  const out: Finding[] = [];
  for (const a of shot.actions) {
    const who = giveParties(shot, a);
    if (!who || !project.characters[who.giver] || !project.characters[who.taker]) continue;
    if ([a.actor!, who.giver, who.taker].some((id) => waived(allow, 'give.reach', id))) continue;
    const t = attachTime(a);
    const g = resolveActor(project, scene, shot, who.giver, t);
    const k = resolveActor(project, scene, shot, who.taker, t);
    const hg = holdPoint(g, poseFor(g, t));
    const hk = holdPoint(k, poseFor(k, t));
    const gap = Math.hypot(hg.x - hk.x, hg.y - hk.y);
    const small = Math.min(g.character.height * g.scale, k.character.height * k.scale);
    // Turned away, a hand can still get there, behind the back: that is no hand-over.
    const faces = (me: ActorState, them: ActorState) => {
      const side = sideOf(me, them);
      return !side || side === me.facing;
    };
    const facing = faces(g, k) && faces(k, g);
    if (facing && gap <= Math.max(6, 0.06 * small)) continue;
    const apart = Math.abs(g.x - k.x);
    out.push({
      code: 'give.reach',
      shot: shot.id,
      t: [r1(a.t), r1(t)],
      actors: [who.giver, who.taker],
      at: { x: (hg.x + hk.x) / 2, y: (hg.y + hk.y) / 2 },
      message: facing
        ? `'${who.giver}' hands '${a.actor}' to '${who.taker}', but their hands stay ${r(gap)} px apart, so it floats across. They stand ${r(apart)} px apart: bring them to about ${r(Math.max(0, apart - gap))} px (walk one over first).`
        : `'${who.giver}' hands '${a.actor}' to '${who.taker}', but they are not facing each other, so it cannot pass from hand to hand. Turn them to each other before the give (the engine turns them only when they are idle then).`,
    });
  }
  return out;
}

/**
 * A cut that carries straight on in the same place (`follows`): everyone in sight on
 * either side of it starts as the last shot left them, where they stood, sitting or lying,
 * asleep (lying, eyes shut) or awake, holding what they held, at the size they were, and nobody appears in a
 * spot that was in sight empty or vanishes from one still in sight. Facing is not checked:
 * the engine turns whoever the shot has facing the other way (stage.ts).
 */
function cutRule(project: Project, shot: Shot): Finding[] {
  const prev = follows(project, shot);
  if (!prev) return [];
  const scene = project.scenes[shot.scene];
  const allow = [shot.allow, scene.allow];
  const { width: W, height: H } = project.meta;
  const end = prev.duration - 1e-3;
  const viewA = resolveCamera(project, scene, prev, end);
  const viewB = resolveCamera(project, scene, shot, 0);
  const inView = (v: View, p: XY) =>
    Math.abs(p.x - v.x) <= W / 2 / v.zoom && Math.abs(p.y - v.y) <= H / 2 / v.zoom;
  const shows = (s: ActorState) => s.visible && s.opacity > 0.05;
  const seen = (s: ActorState) => shows(s) && (inView(viewA, s) || inView(viewB, s));
  // Lying with the eyes shut; shut eyes alone are a howl or a laugh as often as sleep.
  const asleep = (s: ActorState) => s.lie >= 0.5 && s.face.eyes === 'closed';
  const size = (s: ActorState) => s.scale / (s.perspective || 1);
  const ids = new Set([...Object.keys(prev.cast), ...Object.keys(shot.cast)]);
  const out: Finding[] = [];
  for (const id of ids) {
    if (!project.characters[id] || waived(allow, 'continuity.cut', id)) continue;
    const a = leftAs(project, shot, id);
    const b = shot.cast[id] ? resolveActor(project, scene, shot, id, 0) : undefined;
    const what: string[] = [];
    let fix: Finding['fix'];
    if (a && b) {
      if (shows(a) !== shows(b)) {
        if (seen(a) || seen(b))
          what.push(shows(a) ? 'is hidden at the start' : 'shows, though it was hidden');
      } else if (seen(a) || seen(b)) {
        // Carried or riding on the same one, it goes where they go: they answer for it.
        const along = (a.heldBy && a.heldBy === b.heldBy) || (a.on && a.on === b.on);
        const d = dist(a, b);
        if (d > CUT_SHIFT && !along) {
          what.push(`stands ${r(d)} px from where it was left, (${r(a.x)}, ${r(a.y)})`);
          const up = (s: ActorState) => s.sit < 0.5 && s.lie < 0.5;
          if (up(a) && up(b) && !shot.cast[id].on && !b.heldBy)
            fix = { path: `/cast/${id}/at`, value: { x: r(a.x), y: r(a.y) } };
        }
        if (a.lie >= 0.5 !== b.lie >= 0.5)
          what.push(a.lie >= 0.5 ? 'was lying down and is up' : 'is lying down, and was not');
        else if (a.sit >= 0.5 !== b.sit >= 0.5)
          what.push(a.sit >= 0.5 ? 'was sitting and stands' : 'sits, and was standing');
        if (asleep(a) !== asleep(b))
          what.push(asleep(a) ? 'was asleep and is awake' : 'is asleep, and was awake');
        if (a.heldBy !== b.heldBy)
          what.push(
            a.heldBy
              ? `was in '${a.heldBy}''s hand and ${b.heldBy ? `is in '${b.heldBy}''s` : 'is not'}`
              : `is in '${b.heldBy}''s hand, and was not`
          );
        if (Math.abs(size(b) / size(a) - 1) > CUT_SIZE)
          what.push(`is drawn at ${r2(size(b))} its size, and was at ${r2(size(a))}`);
      }
    } else if (a && shows(a) && inView(viewA, a) && inView(viewB, a)) {
      what.push(
        `was in sight at the end of '${prev.id}', where this shot looks, and is not in its cast: it vanishes`
      );
      fix = {
        path: `/cast/${id}`,
        value: { at: { x: r(a.x), y: r(a.y) }, facing: a.facing },
      };
    } else if (!a && b && shows(b) && inView(viewA, b) && inView(viewB, b)) {
      what.push(
        `was not in '${prev.id}', though its spot was in sight there: it appears from nowhere`
      );
    }
    if (!what.length) continue;
    out.push({
      code: 'continuity.cut',
      shot: shot.id,
      t: [0, 0],
      actors: [id],
      at: b ? { x: b.x, y: b.y } : a ? { x: a.x, y: a.y } : undefined,
      message: `'${id}' ${what.join('; ')}, across a cut that carries straight on from '${prev.id}'. Start it as '${prev.id}' left it, or set cut: 'later' on '${shot.id}' if time has passed.`,
      fix,
    });
  }
  return out;
}

/**
 * Screen direction across a cut to another place. Someone who goes off one side of the
 * frame and is moving in the next shot keeps going the same way (off to the right, on
 * moving right), dissolve or not: coming on the other way reads as turning back. And
 * across a cut that carries straight on (an insert, a closer view of the same moment),
 * two in sight on both sides keep their sides: swapping crosses the line between them,
 * the 180° rule, and they seem to jump past each other. In the same place `cutRule`
 * holds everyone to where they were already.
 */
function axisRule(project: Project, shot: Shot): Finding[] {
  const prev = shotBefore(project, shot);
  const sceneA = prev && project.scenes[prev.scene];
  const sceneB = project.scenes[shot.scene];
  if (!prev || !sceneA || !sceneB || prev.scene === shot.scene) return [];
  const allow = [shot.allow, sceneB.allow];
  const { width: W, height: H } = project.meta;
  const end = prev.duration - 1e-3;
  const viewA = resolveCamera(project, sceneA, prev, end);
  const viewB = resolveCamera(project, sceneB, shot, 0);
  const inView = (v: View, s: ActorState) =>
    s.visible &&
    s.opacity > 0.05 &&
    Math.abs(s.x - v.x) <= W / 2 / v.zoom &&
    Math.abs(s.y - v.y) <= H / 2 / v.zoom;
  const A = (id: string, t: number) => resolveActor(project, sceneA, prev, id, t);
  const B = (id: string, t: number) =>
    resolveActor(project, sceneB, shot, id, Math.min(t, shot.duration - 1e-3));
  const both = Object.keys(shot.cast).filter((id) => prev.cast[id] && project.characters[id]);
  const side = (d: number) => (d > 0 ? 'right' : 'left');
  const out: Finding[] = [];

  for (const id of both) {
    if (waived(allow, 'continuity.direction', id)) continue;
    const a = A(id, end);
    // Carried or riding, it goes where its carrier goes: the carrier answers for it.
    if (a.heldBy || a.on || inView(viewA, a)) continue;
    // Gone off a side: seen in the shot before, and out past that side at its end.
    let seen = false;
    for (let t = end; t > 0 && !seen; t -= 0.25) seen = inView(viewA, A(id, t));
    const off = a.x - viewA.x;
    if (!seen || Math.abs(off) <= W / 2 / viewA.zoom) continue;
    const b0 = B(id, 0);
    const moved = B(id, 2).x - b0.x;
    if (b0.heldBy || b0.on || Math.abs(moved) < TRAVEL_MIN || Math.sign(moved) === Math.sign(off))
      continue;
    out.push({
      code: 'continuity.direction',
      shot: shot.id,
      t: [0, Math.min(2, shot.duration)],
      actors: [id],
      at: { x: b0.x, y: b0.y },
      message: `'${id}' goes off to the ${side(off)} at the end of '${prev.id}' and comes on moving ${side(moved)} in '${shot.id}', which reads as turning back. Keep the way it was going: bring it on from the ${side(-off)}, moving ${side(off)}. If it really is going back, waive this with allow.`,
    });
  }

  if (!carriesOn(shot)) return out;
  const animate = (id: string) => !!project.characters[id].parts.eyes;
  const ends = Object.fromEntries(both.map((id) => [id, A(id, end)]));
  const starts = Object.fromEntries(both.map((id) => [id, B(id, 0)]));
  const seenBoth = both.filter(
    (id) =>
      animate(id) &&
      !waived(allow, 'continuity.line', id) &&
      !ends[id].heldBy &&
      inView(viewA, ends[id]) &&
      inView(viewB, starts[id])
  );
  const swapped: [string, string][] = [];
  for (let i = 0; i < seenBoth.length; i++)
    for (let j = i + 1; j < seenBoth.length; j++) {
      const [x, y] = [seenBoth[i], seenBoth[j]];
      const was = ends[y].x - ends[x].x;
      const now = starts[y].x - starts[x].x;
      // Side by side on both sides of the cut, not one behind the other.
      if (Math.abs(was) > LINE_GAP && Math.abs(now) > LINE_GAP && Math.sign(was) !== Math.sign(now))
        swapped.push(was < 0 ? [y, x] : [x, y]);
    }
  if (!swapped.length) return out;
  const pairs = swapped.map(([l, rt]) => `'${l}' was left of '${rt}' and is right of it`);
  out.push({
    code: 'continuity.line',
    shot: shot.id,
    t: [0, 0],
    actors: [...new Set(swapped.flat())],
    message: `Across a cut that carries straight on from '${prev.id}', ${pairs.join('; ')}. That crosses the line between them (the 180° rule): they seem to jump past each other. Keep each on the side it was on, or set cut: 'later' on '${shot.id}' if time has passed.`,
  });
  return out;
}

/**
 * A blow, a wipe or a hold at something (`to`) lands on it: at the moment of contact (a
 * strike's hit, half way through a wipe or a hold) the working end of what a blow swings,
 * or the hand of a wipe or a hold, is on the target. The engine bends the arm and swings the stick there, but only
 * as far as the arm and the stick reach: stood too far off it falls short, and too close
 * a long stick passes over it.
 */
function contactRule(project: Project, shot: Shot): Finding[] {
  const scene = project.scenes[shot.scene];
  const allow = [shot.allow, scene.allow];
  const out: Finding[] = [];
  for (const a of shot.actions) {
    const id = a.actor;
    if (!id || !a.do || !CONTACT.has(a.do) || !a.to || !shot.cast[id]) continue;
    if (!project.characters[id] || waived(allow, 'contact.reach', id)) continue;
    const t = a.t + actionDuration(a) * (a.do === 'strike' ? STRIKE_HIT : 0.5);
    if (t >= shot.duration) continue;
    const me = resolveActor(project, scene, shot, id, t);
    if (!me.visible || me.character.rig !== 'humanoid') continue;
    const target = wipeSpot(project, scene, shot, a.to, t, 0, a.do);
    // A blow lands with what it swings; a wipe or a hold with the hand, whatever it carries.
    const hand = holdPoint(me, poseFor(me, t));
    const end = a.do === 'strike' ? touchPoint(project, scene, shot, id, t) : hand;
    const miss = Math.hypot(end.x - target.x, end.y - target.y);
    const tall = me.character.height * me.scale;
    if (miss <= CONTACT_MISS * tall) continue;
    // Short of it, or past it: further from the hand than what it swings is long, or the
    // hand itself not out as far as the target.
    const short =
      end === hand
        ? Math.abs(hand.x - me.x) < Math.abs(target.x - me.x)
        : dist(hand, target) > dist(hand, end);
    const what = typeof a.to === 'string' ? `'${a.to}'` : `(${r(target.x)}, ${r(target.y)})`;
    const gap = r(Math.abs(target.x - me.x));
    out.push({
      code: 'contact.reach',
      shot: shot.id,
      t: [r1(t), r1(t)],
      actors: [id],
      at: { x: target.x, y: target.y },
      message: `'${id}' ${a.do}s at ${what} from ${gap} px away, but it lands ${r(miss)} px ${short ? 'short of it' : 'past it'}. Stand '${id}' ${short ? 'closer' : 'further back'}, about ${r(Math.max(0, short ? gap - miss : gap + miss))} px from it (walk it over first).`,
    });
  }
  return out;
}

const RULES = [supportRule, attentionRule, jumpRule];

/** Every finding in a shot, waivers applied. */
export function shotFindings(project: Project, shot: Shot): Finding[] {
  const samples = sampleShot(project, shot);
  return [
    ...RULES.flatMap((rule) => rule(project, shot, samples)),
    ...giveRule(project, shot),
    ...cutRule(project, shot),
    ...axisRule(project, shot),
    ...contactRule(project, shot),
  ];
}

const r = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
