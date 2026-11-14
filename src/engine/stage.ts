/**
 * The engine's own staging: what it adds to a shot before it plays, so the agent does not
 * have to stage what has one right answer (docs/PLAN.md, phase 8.1).
 *
 * Attention: who listens to a line turns to face the speaker, a moment after it starts and
 * each in their own time, and the speaker turns to whoever the line is said to. A reaction
 * (`reacts`) looks at its cause first. Only someone idle turns: walking, busy with their
 * hands, lying down, carried or without eyes, they stay as they are, and the world check
 * says so when it matters (world.ts). The shot file is never changed; the added actions are
 * marked `staged` and `talekit explain` lists them.
 */
import { waived } from './allow.js';
import { hash01 } from './easing.js';
import { giveParties, resolveActor, type ActorState } from './timeline.js';
import type { Action, Facing, Project, Scene, Shot, Verb } from './types.js';
import { isMoveVerb } from './types.js';
import { lineEnd } from './voice.js';

/** An action the engine added, and why. */
export type StagedAction = Action & { staged: string };

/** Verbs that keep the hands and eyes on the work: someone doing one does not turn. */
export const BUSY: ReadonlySet<Verb> = new Set([
  'strike',
  'dig',
  'eat',
  'wipe',
  'aim',
  'shoot',
  'swim',
  'kick',
  'pickup',
  'putdown',
  'give',
  'hold',
  'spin',
]);

/** Seconds after a line starts that its listeners begin to turn: this much, plus up to SPREAD. */
const LISTEN_DELAY = 0.15;
const LISTEN_SPREAD = 0.35;
/** Seconds before a reaction that its actor looks at the cause. */
const REACT_LEAD = 0.45;
/** Seconds between looks, through a line, at whether a listener has ended up facing away. */
const RECHECK = 0.5;
/** Seconds between tries at turning someone not yet free to. */
const STEP = 0.1;
/** Verbs that hold the eyes on something else: an archer's on the mark. */
export const FOCUSED: ReadonlySet<Verb> = new Set(['aim']);
/** Seconds before a give that the two turn to face each other, to be round when they reach. */
const GIVE_LEAD = 0.3;
/** Closer than this across the stage, which side the other is on does not read. */
const SIDE_MIN = 8;

const RAW = new WeakSet<Shot>();
const STAGED = new WeakSet<Shot>();
const MEMO = new WeakMap<Project, WeakMap<Shot, Shot>>();

/** A shot with its staging added (memoised per project and shot); as it is if done already. */
export function staged(project: Project, scene: Scene, shot: Shot): Shot {
  if (RAW.has(shot) || STAGED.has(shot)) return shot;
  let byShot = MEMO.get(project);
  if (!byShot) MEMO.set(project, (byShot = new WeakMap()));
  const hit = byShot.get(shot);
  if (hit) return hit;
  const extra = staging(project, scene, shot);
  const out: Shot = extra.length
    ? { ...shot, actions: sortByTime([...shot.actions, ...extra]) }
    : { ...shot };
  STAGED.add(out);
  byShot.set(shot, out);
  return out;
}

/** The actions the engine adds to a shot, in time order. */
export function staging(project: Project, scene: Scene, shot: Shot): StagedAction[] {
  let work = raw({ ...shot, actions: [...shot.actions] });
  const added: StagedAction[] = [];
  const allow = [shot.allow, scene.allow];
  const at = (id: string, t: number) => resolveActor(project, scene, work, id, t);
  const add = (a: StagedAction) => {
    added.push(a);
    work = raw({ ...work, actions: sortByTime([...work.actions, a]) });
  };
  /**
   * Turn `id` to face `toward` at t, if it faces away; one still on the move or busy then
   * turns as soon as it is free, if that is before `until` (the line's end).
   */
  const turn = (
    id: string,
    toward: string,
    from: number,
    until: number,
    why: string,
    speaking = false
  ) => {
    let t = Math.max(0, from);
    let me = at(id, t);
    while (!free(me, speaking) && t + STEP < Math.min(until, shot.duration)) {
      t += STEP;
      me = at(id, t);
    }
    if (t >= shot.duration || !free(me, speaking)) return;
    const them = at(toward, t);
    if (!them.visible) return;
    const facing = sideOf(me, them);
    if (!facing || facing === me.facing) return;
    add({ t: round(t), actor: id, set: { facing }, staged: why } as StagedAction);
  };

  const lines = shot.actions
    .filter((a) => a.say && a.actor && shot.cast[a.actor] && a.bubble !== 'thought')
    .sort((a, b) => a.t - b.t);
  const speakers = new Set(lines.map((l) => l.actor!));
  const reactions = shot.actions.filter(
    (a) => a.reacts && a.actor && shot.cast[a.actor] && shot.cast[a.reacts]
  );
  type Beat = { t: number; run: () => void };
  const beats: Beat[] = [];

  lines.forEach((line, i) => {
    const speaker = line.actor!;
    const end = lineEnd(project, shot, line);
    const to = typeof line.to === 'string' && shot.cast[line.to] ? line.to : undefined;
    // Who it is said to: the one named, else the last other speaker (a reply).
    const before = lines
      .slice(0, i)
      .reverse()
      .find((l) => l.actor !== speaker)?.actor;
    const target = to ?? before;
    if (
      target &&
      !waived(allow, 'attention.speaker', speaker) &&
      !directs(shot, speaker, line.t, end)
    )
      beats.push({
        t: line.t,
        run: () => turn(speaker, target, line.t, end, `speaks to ${target}`, true),
      });
    // Who listens: the one it is said to, and whoever the line names in `audience`; with no
    // one named, the one replied to, or everyone when the speaker is the only one who talks
    // in the shot (a lion addressing the animals).
    const audience = new Set<string>();
    if (to) audience.add(to);
    else if (speakers.size === 1) Object.keys(shot.cast).forEach((id) => audience.add(id));
    else if (before) audience.add(before);
    if (line.audience === 'all') Object.keys(shot.cast).forEach((id) => audience.add(id));
    else for (const id of line.audience ?? []) if (shot.cast[id]) audience.add(id);
    audience.delete(speaker);
    for (const id of audience) {
      if (waived(allow, 'attention.listener', id) || directs(shot, id, line.t, end)) continue;
      // It notices later (a `reacts` to this speaker after the line starts): it turns then.
      if (reactions.some((r) => r.actor === id && r.reacts === speaker && r.t > line.t)) continue;
      const t = line.t + LISTEN_DELAY + LISTEN_SPREAD * hash01(`${shot.id}:${id}:${i}`);
      if (t >= end) continue;
      beats.push({ t, run: () => turn(id, speaker, t, end, `listens to ${speaker}`) });
      // Still listening after a move of its own that left it facing away: turns back.
      for (let p = t + RECHECK; p < end; p += RECHECK)
        beats.push({ t: p, run: () => turn(id, speaker, p, p, `listens to ${speaker}`) });
    }
  });
  for (const r of reactions) {
    const id = r.actor!;
    const t = r.t - REACT_LEAD;
    if (waived(allow, 'attention.reacts', id) || directs(shot, id, t, r.t - 0.01)) continue;
    beats.push({ t, run: () => turn(id, r.reacts!, t, r.t, `sees ${r.reacts}`) });
  }
  // A give: the two face each other to hand it over.
  for (const g of shot.actions) {
    const who = giveParties(shot, g);
    if (!who) continue;
    const t = Math.max(0, g.t - GIVE_LEAD);
    for (const [id, other] of [
      [who.giver, who.taker],
      [who.taker, who.giver],
    ])
      if (!directs(shot, id, t, g.t))
        beats.push({
          t,
          run: () =>
            turn(id, other, t, g.t, `${id === who.giver ? 'gives' : 'takes'} ${g.actor}`, true),
        });
  }
  // In time order, so each turn sees the facing the turns before it left.
  for (const b of beats.sort((x, y) => x.t - y.t)) b.run();
  return added;
}

/** Idle and awake, with eyes and its hands free: someone who can turn to look. */
export function free(a: ActorState, speaking = false): boolean {
  return (
    a.visible &&
    a.opacity > 0.01 &&
    !a.heldBy &&
    !!a.character.parts.eyes &&
    a.locomotion === 'idle' &&
    a.lie < 0.5 &&
    !a.turn &&
    a.face.eyes !== 'closed' &&
    (speaking || !a.talking) &&
    !a.verbs.some((v) => BUSY.has(v.verb) || isMoveVerb(v.verb))
  );
}

/** Which way `me` faces to look at `them`, or nothing when they are too close to tell. */
export function sideOf(me: ActorState, them: ActorState): Facing | undefined {
  const dx = them.x - me.x;
  if (Math.abs(dx) < SIDE_MIN) return undefined;
  return dx > 0 ? 'right' : 'left';
}

/**
 * Whether the shot itself turns `id` (a `set.facing`) from a little before `from` to `to`:
 * then the agent is directing it, and the engine leaves it alone. A move is not: where it
 * leaves someone facing is where it went, and the engine turns them once it ends.
 */
export function directs(shot: Shot, id: string, from: number, to: number): boolean {
  return shot.actions.some(
    (a) => a.actor === id && a.t >= from - 0.3 && a.t <= to && a.set?.facing !== undefined
  );
}

function raw(shot: Shot): Shot {
  RAW.add(shot);
  return shot;
}

/** Stable: actions at the same time keep the order they were written in. */
const sortByTime = (actions: Action[]) =>
  actions
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.t - y.a.t || x.i - y.i)
    .map((x) => x.a);

const round = (v: number) => Math.round(v * 100) / 100;
