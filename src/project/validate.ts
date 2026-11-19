import { missingColorTokens } from '../engine/svg.js';
import { lintCharacter } from './construction.js';
import { sightFindings } from './sight.js';
import { follows } from '../engine/stage.js';
import { effectLayer } from '../engine/effects.js';
import { SWAY_FAR, swayBox, swayMissing, swayMost, swayReach } from '../engine/sway.js';
import { RIGS, rigOf } from '../engine/rigs.js';
import { holdPoint, poseFor } from '../engine/actor.js';
import {
  actionDuration,
  attachTime,
  gripAt,
  holderAt,
  movieDuration,
  releases,
  resolveActor,
  resolvePosition,
  STAGE_SHORTCUTS,
} from '../engine/timeline.js';
import { isPortrait, REEL_SECONDS } from '../engine/format.js';
import { resolveSound } from '../engine/sources.js';
import { lineEnd, spokenText, voiceLines, voiceSpec } from '../engine/voice.js';
import { hasDevanagari } from '../engine/glyphs.js';
import { VOICES } from '../library/voices.js';
import type {
  Action,
  Allow,
  Character,
  Effect,
  Music,
  Project,
  Scene,
  Shot,
  Verb,
  Voice,
  Weather,
} from '../engine/types.js';
import { isMoveVerb } from '../engine/types.js';
import { sketchAt } from '../render/sketch.js';
import { SOUNDS } from '../library/sounds.js';
import { waived } from '../engine/allow.js';
import {
  CODES,
  sceneFindings,
  shotFindings,
  unknownWaivers,
  type Finding,
} from '../engine/world.js';

export interface Problem {
  level: 'error' | 'warning';
  where: string;
  message: string;
  /** A world finding's code (`support.air`), which an `allow` waiver names. */
  code?: string;
  /** A world finding in a shot: the shot, its time span, who, where, and a fix. */
  finding?: Finding;
}

/** Adders for a list of problems, by level. */
function report(out: Problem[]) {
  return {
    error: (where: string, message: string) => void out.push({ level: 'error', where, message }),
    warn: (where: string, message: string) => void out.push({ level: 'warning', where, message }),
  };
}

/** A world finding as a problem: always an error, until fixed or waived. */
function findingProblem(f: Finding): Problem {
  const span = f.t[0] === f.t[1] ? `t=${f.t[0]}` : `t=${f.t[0]}-${f.t[1]}`;
  return {
    level: 'error',
    where: `shot '${f.shot}' (${span})`,
    message:
      f.message + (f.fix ? ` Fix: set ${f.fix.path} to ${JSON.stringify(f.fix.value)}.` : ''),
    code: f.code,
    finding: f,
  };
}

/** Waiver keys that name no check, an error: a typo would waive nothing and hide nothing. */
function waiverProblems(where: string, allow: Allow): Problem[] {
  return unknownWaivers(allow).map((k) => ({
    level: 'error' as const,
    where,
    message: `allow names '${k}', which is no check; the codes are ${Object.keys(CODES).join(', ')}`,
  }));
}

/**
 * The world checks of every shot: each actor held up by what it can rest on, and so on
 * (src/engine/world.ts), and what must or must not show (sight.ts). Run once the project
 * is otherwise valid, since they play it.
 */
export function worldProblems(project: Project, shots: Shot[] = project.shots): Problem[] {
  return shots.flatMap((shot) =>
    project.scenes[shot.scene]
      ? [...shotFindings(project, shot), ...sightFindings(project, shot)].map(findingProblem)
      : []
  );
}

/**
 * Takes that do not say their line: no take of it, heard by speech recognition, came close
 * enough (project/voices.ts). Errors, until the line is reworded and spoken again, or the
 * take is listened to and waived (`speech.mismatch`, or `speech.mismatch:<actor>`, the
 * narrator's as `narrator`).
 */
export function speechProblems(project: Project, shots: Shot[] = project.shots): Problem[] {
  const out: Problem[] = [];
  for (const shot of shots) {
    const allow = [shot.allow, project.scenes[shot.scene]?.allow];
    for (const line of voiceLines(project, [shot])) {
      const doubt = project.audio?.voices[line.key]?.doubt;
      const who = line.actor ?? 'narrator';
      if (!doubt || waived(allow, 'speech.mismatch', who)) continue;
      out.push({
        level: 'error',
        where: `shot '${shot.id}'`,
        code: 'speech.mismatch',
        message: `action ${line.action}: no take of ${line.actor ? `${who}'s` : "the narrator's"} line '${line.text}' says it; the best was heard as '${doubt.heard}'. Reword what the voice stumbles on (spell a word as it is said; split a long line) so it is spoken again, or listen to the take and, if it is right, allow { 'speech.mismatch:${who}': reason }`,
      });
    }
  }
  return out;
}

/** Inner SVG only: no <svg> wrapper, no <image>, nothing fetched from outside the file. */
function forbiddenMarkup(svg: string): string | undefined {
  if (/<svg[\s>]/i.test(svg))
    return 'contains an <svg> element; write inner elements only (paths, circles, groups)';
  if (/<image[\s>]/i.test(svg)) return 'contains an <image> element; draw with paths instead';
  if (/href=['"]\s*(https?:|file:|\/\/)/i.test(svg))
    return 'references an external URL; inner SVG must be self-contained';
  return undefined;
}

/** A voice the sidecar does not list: a warning, since a custom TALEKIT_TTS may have more. */
export function voiceProblems(where: string, voice: Voice | undefined): Problem[] {
  if (!voice) return [];
  const { engine, name } = voiceSpec(voice);
  if (VOICES[`${engine}:${name}`]) return [];
  return [
    {
      level: 'warning',
      where,
      message: `voice '${engine}:${name}' is not one list_voices knows; its lines may fail to speak`,
    },
  ];
}

export function validateCharacter(c: Character): Problem[] {
  const out: Problem[] = [];
  const { error, warn } = report(out);
  const rig = rigOf(c);
  const where = `character '${c.id}'`;
  out.push(...voiceProblems(where, c.voice));
  if (!c.parts[rig.required]) error(where, `rig '${c.rig}' needs a '${rig.required}' part`);
  for (const [name, part] of Object.entries(c.parts)) {
    const fragments = typeof part === 'string' ? [part] : Object.values(part);
    // A single-string part must draw something. In a variant map an empty string is a
    // legitimate "draw nothing" variant (a beak's closed mouth, a hat that is off), as long
    // as at least one variant draws.
    if (typeof part === 'string' && !part.trim()) error(where, `part '${name}' is empty`);
    else if (typeof part !== 'string' && !fragments.some((f) => f.trim()))
      error(
        where,
        fragments.length
          ? `part '${name}': every variant is empty`
          : `part '${name}' has no variants`
      );
    for (const f of fragments) {
      const bad = forbiddenMarkup(f);
      if (bad) error(where, `part '${name}' ${bad}`);
      const missing = missingColorTokens(f, c.colors);
      if (missing.length)
        error(where, `part '${name}' uses undefined colour tokens: ${missing.join(', ')}`);
    }
  }
  for (const name of c.springs ?? [])
    if (!c.parts[name]) warn(where, `springs names '${name}', which has no part`);
  for (const name of c.flaps ?? [])
    if (!c.parts[name]) warn(where, `flaps names '${name}', which has no part`);
  const base = RIGS[c.rig];
  for (const [name, h] of Object.entries(c.hangs ?? {})) {
    if (base.parts[name])
      error(where, `hangs places '${name}', which the ${c.rig} rig already places`);
    else if (!rig.parts[name])
      error(
        where,
        `hangs '${name}' from '${h.from}', which is neither a ${c.rig} part nor hung itself, or hangs from '${name}' again`
      );
    if (!c.parts[name]) warn(where, `hangs names '${name}', which has no part`);
  }
  if (rig.expected.length) {
    for (const p of rig.expected)
      if (!c.parts[p]) warn(where, `${c.rig} without '${p}' will not animate it`);
    const mouth = c.parts.mouth;
    if (mouth && typeof mouth !== 'string' && !mouth.open)
      warn(where, `mouth has no 'open' variant, so talking will not flap`);
    const eyes = c.parts.eyes;
    if (eyes && typeof eyes !== 'string' && !eyes.closed)
      warn(where, `eyes have no 'closed' variant, so there is no blinking`);
  }
  // Construction is checked on the drawing, so only once the parts are drawable at all.
  if (!out.some((p) => p.level === 'error')) out.push(...lintCharacter(c).problems);
  return out;
}

/**
 * Whether a fragment has an opaque rect at the origin at least the size of the frame. A
 * see-through one (a dusk tint over the whole stage) leaves far showing, so it does not count.
 */
function coversFrame(svg: string, width: number, height: number): boolean {
  for (const [, attrs] of svg.matchAll(/<rect\b([^>]*)>/g)) {
    const attr = (k: string) => attrs.match(new RegExp(`(?:^|\\s)${k}='([^']*)'`))?.[1];
    const num = (k: string, d: number) => parseFloat(attr(k) ?? String(d));
    if (attr('fill') === 'none' || num('opacity', 1) * num('fill-opacity', 1) < 0.95) continue;
    if (
      num('x', 0) <= 0 &&
      num('y', 0) <= 0 &&
      num('width', 0) >= width &&
      num('height', 0) >= height
    )
      return true;
  }
  return false;
}

/**
 * Clouds, bolts, heat haze and far effects are drawn in the far layer: in a scene without
 * one, the stage's own sky covers them.
 */
function needsFar(where: string, weather: Weather | undefined, effects: Effect[]): Problem[] {
  const what = [
    weather?.clouds && 'weather.clouds',
    weather?.lightning && 'the lightning bolt (the flash still works)',
    weather?.heat && 'weather.heat',
    ...effects.filter((e) => effectLayer(e) === 'far').map((e) => `a ${e.kind} in the far layer`),
  ].filter((x): x is string => !!x);
  if (!what.length) return [];
  return [
    {
      level: 'warning',
      where,
      message: `${what.join(', ')} ${what.length > 1 ? 'are' : 'is'} drawn in the far layer, which the scene does not have; move its sky into far`,
    },
  ];
}

export function validateScene(s: Scene, width: number, height: number): Problem[] {
  const out: Problem[] = [];
  const { error, warn } = report(out);
  const where = `scene '${s.id}'`;
  for (const [field, svg] of [
    ['svg', s.svg],
    ['foreground', s.foreground],
    ['far', s.far],
    ['near', s.near],
  ] as const) {
    const bad = svg && forbiddenMarkup(svg);
    if (bad) error(where, `${field} ${bad}`);
  }
  // The usual mistake when splitting a scene into layers: the sky left in svg hides `far`.
  if (s.far && coversFrame(s.svg, width, height))
    warn(
      where,
      'svg paints a rect over the whole frame, which hides far; move the sky into far and leave svg transparent above the ground'
    );
  if (!s.far) out.push(...needsFar(where, s.weather, s.effects));
  out.push(...waiverProblems(where, s.allow));
  for (const f of sceneFindings(s, width))
    out.push({ level: 'error', where, message: f.message, code: f.code });
  for (const [name, a] of Object.entries(s.anchors)) {
    if ((STAGE_SHORTCUTS as readonly string[]).includes(name))
      warn(where, `anchor '${name}' shadows a stage shortcut`);
    if (a.x < -width * 0.5 || a.x > width * 1.5 || a.y < 0 || a.y > height * 1.2)
      warn(where, `anchor '${name}' at (${a.x}, ${a.y}) is far outside the frame`);
    // Facing away from its own work point: the turn to `facing` would put the work behind.
    const u = a.use;
    if (
      u?.at &&
      u.facing &&
      Math.abs(u.at[0] - a.x) > 8 &&
      u.at[0] > a.x !== (u.facing === 'right')
    )
      warn(
        where,
        `anchor '${name}' faces ${u.facing}, away from its use.at [${u.at[0]}, ${u.at[1]}]`
      );
  }
  if (Object.keys(s.anchors).length === 0)
    warn(where, 'no anchors; only the stage shortcuts left/center/right are available');
  out.push(...swayProblems(s));
  return out;
}

/**
 * Every swaying group must be a `<g id>` in one of the layers; an anchor up on one (a
 * perch on a swaying branch) would leave whoever stands there still while it moves.
 */
function swayProblems(s: Scene): Problem[] {
  const out: Problem[] = [];
  const { error, warn } = report(out);
  const where = `scene '${s.id}'`;
  for (const id of swayMissing(s))
    error(where, `sway: no <g id='${id}'> in svg, far, near or foreground`);
  for (const [id, { at, amount }] of Object.entries(s.sway ?? {})) {
    const box = swayBox(s, id);
    if (!box) continue;
    // Its far end, at its furthest turn in the scene's own wind.
    const reach = swayReach(s, id) ?? 0;
    const far = (reach * swayMost(reach, amount ?? 1, s.weather?.wind ?? 0) * Math.PI) / 180;
    if (far > SWAY_FAR)
      warn(
        where,
        `sway '${id}' swings its far end about ${Math.round(far)} px (it reaches ${Math.round(reach)} px from its pivot ${at[0]},${at[1]}): ` +
          `more than ${SWAY_FAR} px reads as rubber, not a sway. Lower its amount, or sway it in smaller pieces, each from where it is held`
      );
    for (const [name, a] of Object.entries(s.anchors)) {
      const inside = a.x >= box[0] && a.x <= box[2] && a.y >= box[1] && a.y <= box[3];
      // Well above the pivot, not at its foot: a clump of grass at someone's feet is fine.
      if (inside && at[1] - a.y > 0.25 * (box[3] - box[1]))
        warn(
          where,
          `anchor '${name}' is on swaying '${id}': whoever stands or sits there stays still while it moves; take it out of the sway or move the anchor`
        );
    }
  }
  return out;
}

/** Why a sound name finds nothing, or undefined when it resolves. */
function unknownSound(project: Project, name: string): string | undefined {
  if (resolveSound(project, name)) return undefined;
  const word = name.split('-')[0];
  const near = Object.keys(SOUNDS)
    .filter((id) => id.includes(word))
    .map((id) => id.replace(/-\d+$/, ''))
    .filter((id, i, all) => all.indexOf(id) === i)
    .slice(0, 6);
  return `unknown sound '${name}': not a bundled sound (list_sounds) nor a file in the project's audio/ folder${near.length ? `; bundled names like it: ${near.join(', ')}` : ''}`;
}

/** A scene's ambience names, which need the project to resolve (its audio/ folder). */
export function sceneSoundProblems(s: Scene, project: Project): Problem[] {
  const out: Problem[] = [];
  for (const b of s.ambience) {
    const err = unknownSound(project, typeof b === 'string' ? b : b.sound);
    if (err) out.push({ level: 'error', where: `scene '${s.id}'`, message: `ambience: ${err}` });
  }
  return out;
}

export function musicProblems(
  where: string,
  music: Music | undefined,
  project: Project
): Problem[] {
  if (!music) return [];
  const err = unknownSound(project, typeof music === 'string' ? music : music.track);
  return err ? [{ level: 'error', where, message: `music: ${err}` }] : [];
}

/**
 * Words that are a sound, not speech: a growl, a snore, a laugh, a gnawing. A voice reads
 * them out as words, so they are marked `*…*` (shown, not spoken) and heard as a `sound`.
 */
const SOUND_WORDS = [
  /(?<![\p{L}\p{M}])(?:गु|घु|ग्)?र्र[\p{L}\p{M}]*/u,
  /(?<![\p{L}\p{M}])खर्र[\p{L}\p{M}]*/u,
  /(?<![\p{L}\p{M}])म्याऊ[\p{L}\p{M}]*/u,
  /(?<![\p{L}\p{M}])(हा|हि|ही|हे|हो|ची|चीं|चूँ|भौं|कुतर|टक)(?:[\s.,!…-]+\1)+(?![\p{L}\p{M}])/u,
  /\b(?:g?r{3,}h*|gr{2,}|z{3,}|brr+|achoo|(ha|he|hee|ho|hi)(?:[\s,!.-]+\1)+)\b/iu,
];

function soundWord(text: string): string | undefined {
  const plain = text.replace(/\*[^*]*\*/g, ' ');
  for (const re of SOUND_WORDS) {
    const m = plain.match(re);
    if (m) return m[0];
  }
  return undefined;
}

/**
 * Spoken lines that will not sound right: cut off by the end of the shot, talked over by
 * the narrator or run into the speaker's own next line, written in a script their voice
 * does not read, or with a growl or a laugh written out for the voice to read as words.
 */
function lineProblems(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const where = `shot '${shot.id}'`;
  const quote = (t: string) => `'${t.length > 30 ? t.slice(0, 29) + '…' : t}'`;

  shot.actions.forEach((a, i) => {
    const text = a.say ?? a.caption;
    if (!text) return;
    const word = soundWord(text);
    if (word)
      out.push({
        level: 'warning',
        where,
        message: `action ${i}: '${word}' is a sound, and a voice would read it out as a word: mark it *${word}* to keep it in the bubble only, and add a \`sound\` (list_sounds) for what is heard`,
      });
    if (a.say && /\*[^*]*\*/.test(a.say) && !a.sound && spokenText(a.say) !== a.say.trim())
      out.push({
        level: 'warning',
        where,
        message: `action ${i}: the marked sound in ${quote(a.say)} is shown but nothing is heard; add a \`sound\` (list_sounds) to the action`,
      });
  });

  const spans = voiceLines(project, [shot]).map((line) => {
    const a = shot.actions[line.action];
    const clip = project.audio?.voices[line.key];
    const from = a.t + line.lead;
    return { line, from, to: clip ? from + clip.duration : undefined };
  });
  for (const { line, from, to } of spans) {
    const who = line.actor ?? 'the narrator';
    const info = VOICES[`${line.voice.engine}:${line.voice.name}`];
    if (info && info.language !== 'hi' && hasDevanagari(line.text))
      out.push({
        level: 'warning',
        where,
        message: `action ${line.action}: ${who}'s voice reads English, but the line is in Devanagari; give ${line.actor ? 'the character' : 'the project'} a Hindi voice (list_voices)`,
      });
    if (to === undefined) continue;
    const over = to - shot.duration;
    if (over > 0.05)
      out.push({
        level: 'warning',
        where,
        message: `action ${line.action}: ${who}'s line ${quote(line.text)} takes ${(to - from).toFixed(1)}s to say and is cut off ${over.toFixed(1)}s before it ends; start it earlier or lengthen the shot`,
      });
    // A line starting while this one is still heard: the speaker's own next line, or any
    // line when the narrator is one of the two (two characters at once is the bubble check).
    for (const next of spans) {
      if (next.from <= from || next.from >= to - 0.05) continue;
      const same = next.line.actor === line.actor;
      if (!same && next.line.actor && line.actor) continue;
      out.push({
        level: 'warning',
        where,
        message: same
          ? `action ${next.line.action}: ${who} starts a line at ${next.from.toFixed(1)}s while still saying ${quote(line.text)} (until ${to.toFixed(1)}s)`
          : `action ${next.line.action}: ${next.line.actor ?? 'the narrator'} starts speaking at ${next.from.toFixed(1)}s while ${who} is still saying ${quote(line.text)} (until ${to.toFixed(1)}s); the voices talk over each other`,
      });
    }
  }
  return out;
}

/** Verbs whose `to` may name a cast member to work on or aim at, not only a place. */
const AT_ACTOR: ReadonlySet<Verb> = new Set(['wipe', 'hold', 'strike', 'aim', 'shoot']);
/** Verbs that read `to` at all. */
const TAKES_TO: ReadonlySet<Verb> = new Set<Verb>([
  ...AT_ACTOR,
  ...(['walk', 'run', 'move', 'fly', 'jump', 'climb', 'sit', 'lie', 'putdown', 'eat'] as const),
]);

export function validateShot(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const { error, warn } = report(out);
  const where = `shot '${shot.id}'`;
  out.push(...musicProblems(where, shot.music, project));
  out.push(...waiverProblems(where, shot.allow));
  shot.actions.forEach((a, i) => {
    const err = a.sound && unknownSound(project, a.sound);
    if (err) error(where, `action ${i}: ${err}`);
    if (a.volume !== undefined && !a.sound)
      warn(where, `action ${i}: volume only applies to a sound`);
  });
  out.push(...lineProblems(shot, project));
  if (shot.sketch) {
    const err = sketchProblem(project, shot);
    if (err) error(where, err);
  }
  const scene = project.scenes[shot.scene];
  if (!scene) {
    error(where, `unknown scene '${shot.scene}'`);
    return out;
  }
  const positionOk = (p: unknown): string | undefined => {
    if (typeof p !== 'string') return undefined;
    if (scene.anchors[p] || (STAGE_SHORTCUTS as readonly string[]).includes(p)) return undefined;
    return `unknown position '${p}' (scene '${scene.id}' has anchors: ${Object.keys(scene.anchors).join(', ') || 'none'}; shortcuts: ${STAGE_SHORTCUTS.join(', ')})`;
  };
  if (!scene.far)
    for (const w of [shot.weather, ...shot.actions.map((a) => a.weather)])
      if (w) out.push(...needsFar(where, w, []));
  if (!scene.far && shot.actions.some((a) => a.lightning))
    out.push(...needsFar(where, { lightning: { every: 8 } }, []));
  const onError = (id: string, on: string | undefined): string | undefined =>
    on === undefined
      ? undefined
      : !shot.cast[on]
        ? `on: '${on}' is not in the cast`
        : on === id
          ? `on: '${id}' cannot stand on itself`
          : undefined;
  for (const [id, member] of Object.entries(shot.cast)) {
    if (!project.characters[id]) error(where, `cast member '${id}' is not a character`);
    const err = positionOk(member.at);
    if (err) error(where, `cast '${id}': ${err}`);
    const on = onError(id, member.on);
    if (on) error(where, `cast '${id}': ${on}`);
  }
  if (shot.crossfade > 0) {
    const i = project.shots.findIndex((s) => s.id === shot.id);
    const prev = i > 0 ? project.shots[i - 1] : undefined;
    if (i === 0)
      warn(where, 'crossfade on the first shot has nothing to dissolve from; it starts as a cut');
    else if (prev && prev.fadeOut > 0)
      warn(
        where,
        `crossfade after '${prev.id}', which fades out, dissolves from black; drop its fadeOut`
      );
    if (shot.crossfade > shot.duration)
      warn(where, `crossfade (${shot.crossfade}s) is longer than the shot (${shot.duration}s)`);
  }
  const followed = (camera: { follow?: string } | undefined, w: string) => {
    if (camera?.follow && !shot.cast[camera.follow])
      error(w, `camera follows '${camera.follow}', who is not in the cast`);
  };
  followed(shot.camera, where);
  shot.actions.forEach((a, i) => {
    const w = `${where} action[${i}] (t=${a.t})`;
    followed(a.camera, w);
    if (a.actor && !shot.cast[a.actor]) error(w, `actor '${a.actor}' is not in the cast`);
    // On a line with no move, `to` names who is spoken to.
    const listener = a.say && !a.do && typeof a.to === 'string';
    if (listener && !shot.cast[a.to as string])
      error(w, `'to' on a line names who is spoken to, and '${a.to}' is not in the cast`);
    else if (listener && a.to === a.actor) warn(w, `'${a.actor}' is speaking to itself`);
    else if (
      a.to &&
      !listener &&
      !(a.do && AT_ACTOR.has(a.do) && typeof a.to === 'string' && shot.cast[a.to])
    ) {
      const err = positionOk(a.to);
      if (err) error(w, err);
    }
    if (Array.isArray(a.audience))
      for (const id of a.audience.filter((x) => !shot.cast[x]))
        error(w, `audience: '${id}' is not in the cast`);
    if (a.audience && !a.say) error(w, 'audience is only read on a line (say)');
    if (a.reacts && !shot.cast[a.reacts])
      error(w, `reacts: '${a.reacts}' is not in the cast; name the actor this reacts to`);
    else if (a.reacts && a.reacts === a.actor) error(w, `'${a.actor}' reacts to itself`);
    const on = a.actor && onError(a.actor, a.on);
    if (on) error(w, on);
    if (a.attach) {
      if (!shot.cast[a.attach]) error(w, `attach: '${a.attach}' is not in the cast`);
      else if (a.attach === a.actor) error(w, `attach: '${a.actor}' cannot carry itself`);
      else if (shot.actions.some((b) => b.actor === a.attach && b.attach))
        warn(w, `attach: '${a.attach}' is itself carried in this shot; carry one thing at a time`);
    }
    if (a.do === 'pickup' && !a.attach)
      error(w, `pickup needs attach: the id of who picks '${a.actor}' up`);
    if (a.do === 'give' && a.actor) {
      const holder = holderAt(shot, a.actor, a.t);
      if (!a.attach) error(w, `give needs attach: the id of who '${a.actor}' is handed to`);
      else if (!holder)
        error(
          w,
          `give: no one holds '${a.actor}' at ${a.t}s to hand it over; attach it to the giver first (or use pickup)`
        );
      else if (holder === a.attach) error(w, `give: '${a.attach}' already holds '${a.actor}'`);
    }
    if (a.do === 'putdown' && a.attach !== false)
      error(w, `putdown needs attach: false (the carrier sets '${a.actor}' down)`);
    if (
      a.attach &&
      a.do &&
      a.do !== 'appear' &&
      a.do !== 'disappear' &&
      a.do !== 'pickup' &&
      a.do !== 'putdown' &&
      a.do !== 'give'
    )
      warn(w, `'${a.do}' in the same action as attach is ignored while it is carried`);
    if (a.set?.at) {
      const err = positionOk(a.set.at);
      if (err) error(w, err);
    }
    if (a.t >= shot.duration) warn(w, `starts at or after the shot ends (${shot.duration}s)`);
    if (a.to && a.do && !TAKES_TO.has(a.do)) warn(w, `'to' is ignored for '${a.do}'`);
    out.push(...archery(shot, project, a, w));
    if (a.face && a.actor && shot.cast[a.actor] && project.characters[a.actor]) {
      const parts = project.characters[a.actor].parts;
      for (const [part, variant] of Object.entries(a.face)) {
        const p = parts[part];
        // '' clears an earlier override, so it needs the part but no such variant.
        if (!p || typeof p === 'string' || (variant !== '' && !(variant in p)))
          error(w, `face: '${a.actor}' has no variant '${variant}' for part '${part}'`);
      }
    }
  });
  // Two people talking at once is nearly always a pacing slip: the bubbles collide and the
  // default `say` duration is longer than it looks. Warn, because it can be intended. A
  // voiced line is talking until its voice stops; its bubble staying up after that (a beat,
  // or a longer `duration`) may overlap the next one, as bubbles do in a comic.
  const bubbles = shot.actions
    .filter((a) => a.say && a.actor)
    .map((a) => ({ actor: a.actor!, from: a.t, to: lineEnd(project, shot, a) }))
    .sort((a, b) => a.from - b.from);
  for (let i = 1; i < bubbles.length; i++) {
    const cur = bubbles[i];
    // Compare with every earlier line, not just the previous one: a short line nested inside
    // a long one must not hide the long one.
    const clash = bubbles
      .slice(0, i)
      .filter((b) => b.actor !== cur.actor && cur.from < b.to)
      .sort((a, b) => b.to - a.to)[0];
    if (clash)
      warn(
        where,
        `'${cur.actor}' starts speaking at ${cur.from}s while '${clash.actor}' is still talking until ${clash.to.toFixed(1)}s; the bubbles will overlap`
      );
  }
  out.push(...pickupReach(shot, project));
  out.push(...stepsOff(shot, project));
  if (shot.actions.length === 0 && Object.keys(shot.cast).length === 0)
    warn(where, 'empty shot: no cast and no actions');
  return out;
}

/**
 * An aim needs a bow in the hand and something to aim at; its arrow must be in the cast. A
 * shoot needs an aim to loose, or (on an arrow off any bow) somewhere to fly to.
 */
function archery(shot: Shot, project: Project, a: Action, w: string): Problem[] {
  const out: Problem[] = [];
  const err = (message: string) => out.push({ level: 'error', where: w, message });
  const warn = (message: string) => out.push({ level: 'warning', where: w, message });
  if (a.arrow !== undefined && a.do !== 'aim') warn(`'arrow' is only read on an aim`);
  if (!a.actor || !shot.cast[a.actor]) return out;
  if (a.do === 'aim') {
    if (!a.to) err(`aim needs 'to': what '${a.actor}' aims at (an actor, an anchor or a spot)`);
    else if (a.to === a.actor) err(`'${a.actor}' cannot aim at itself`);
    const bow = Object.keys(shot.cast).find(
      (id) => project.characters[id]?.bowstring && holderAt(shot, id, a.t) === a.actor
    );
    if (!bow)
      warn(
        `'${a.actor}' holds no bow when the aim begins: attach a prop with a 'bowstring' to them first`
      );
    if (project.characters[a.actor]?.rig !== 'humanoid')
      warn(`aim draws a bow with a person's arms; '${a.actor}' only leans`);
    if (a.arrow === undefined) warn(`aim has no 'arrow': the string is drawn with nothing on it`);
    else if (!shot.cast[a.arrow]) err(`arrow: '${a.arrow}' is not in the cast`);
    else if (a.arrow === bow || a.arrow === a.actor)
      err(`arrow: '${a.arrow}' is the bow or the archer, not an arrow`);
    else if (shot.actions.some((b) => b.actor === a.arrow && b.attach && b.t <= a.t))
      warn(`arrow: '${a.arrow}' is carried; let go of it before it goes on the string`);
  }
  if (a.do === 'shoot') {
    const mine = releases(shot).find(
      (r) => r.t === a.t && (r.archer === a.actor || r.arrow === a.actor)
    );
    if (!mine) {
      const aiming = shot.actions.some(
        (b) => b.actor === a.actor && b.do === 'aim' && b.t <= a.t && a.t <= b.t + actionDuration(b)
      );
      err(
        aiming
          ? `shoot: the aim '${a.actor}' is in has no 'arrow' to loose`
          : `shoot needs an aim in progress on '${a.actor}' (or, on an arrow off any bow, a 'to')`
      );
    }
  }
  return out;
}

/**
 * A pickup the hand cannot reach (stooping, or reaching out to a table). The engine eases
 * the prop into the hand whatever the gap, but a wide one shows it sliding across the floor.
 */
function pickupReach(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const scene = project.scenes[shot.scene];
  shot.actions.forEach((a, i) => {
    if (a.do !== 'pickup' || !a.attach || !a.actor) return;
    if (!shot.cast[a.attach] || !shot.cast[a.actor]) return;
    if (!project.characters[a.attach] || !project.characters[a.actor]) return;
    const at = attachTime(a);
    const carrier = resolveActor(project, scene, shot, a.attach, at);
    const prop = resolveActor(project, scene, shot, a.actor, at - 1e-3);
    const hand = holdPoint(carrier, poseFor(carrier, at));
    const grip = gripAt(prop.character, prop, prop.scale, prop.facing);
    const gap = Math.hypot(grip.x - hand.x, grip.y - hand.y);
    if (gap > 0.25 * carrier.character.height * carrier.scale) {
      const x = Math.round(carrier.x + grip.x - hand.x);
      out.push({
        level: 'warning',
        where: `shot '${shot.id}' action[${i}] (t=${a.t})`,
        message: `'${a.attach}' reaches ${Math.round(gap)}px short of where '${a.actor}' is; stand them at x ≈ ${x}, facing it, before the pickup`,
      });
    }
  });
  return out;
}

/**
 * A hop along someone's back without `on`: a move without it takes the actor off whoever it
 * stands on, so landing up there again it is drawn behind them (and no longer rides along).
 * Up there is over their box with the feet well above theirs.
 */
function stepsOff(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const scene = project.scenes[shot.scene];
  // Off after one such hop, it is still meant to be up there for the next.
  const meant: Record<string, string> = {};
  const inOrder = [...shot.actions.entries()].sort(([, x], [, y]) => x.t - y.t);
  for (const [i, a] of inOrder) {
    if (!a.actor || !a.do || !isMoveVerb(a.do) || !a.to || !shot.cast[a.actor]) continue;
    if (a.on || !project.characters[a.actor]) {
      delete meant[a.actor];
      continue;
    }
    const on = resolveActor(project, scene, shot, a.actor, a.t).on ?? meant[a.actor];
    delete meant[a.actor];
    if (!on || !project.characters[on]) continue;
    const base = resolveActor(project, scene, shot, on, a.t);
    const rig = rigOf(base.character);
    const s = (base.character.height / rig.height) * base.scale;
    const to = resolvePosition(project, scene, a.to);
    if (Math.abs(to.x - base.x) < (rig.width / 2) * s && to.y < base.y - 0.1 * rig.height * s) {
      out.push({
        level: 'warning',
        where: `shot '${shot.id}' action[${i}] (t=${a.t})`,
        message: `'${a.actor}' lands on '${on}' again without on, so it is drawn behind '${on}' from then; add "on": "${on}" to stay up there`,
      });
      meant[a.actor] = on;
    }
  }
  return out;
}

/**
 * Whoever ends a shot carrying something should start the next with it in hand, or it
 * vanishes at the cut.
 */
function carriedAcrossCuts(project: Project): Problem[] {
  const out: Problem[] = [];
  for (let i = 1; i < project.shots.length; i++) {
    const [prev, next] = [project.shots[i - 1], project.shots[i]];
    // Carrying straight on in the same place, the world check holds it (continuity.cut).
    if (follows(project, next)) continue;
    for (const prop of Object.keys(prev.cast)) {
      const carrier = holderAt(prev, prop, prev.duration);
      if (!carrier || !next.cast[carrier]) continue;
      const scene = project.scenes[prev.scene];
      if (!scene || !project.characters[prop] || !project.characters[carrier]) continue;
      if (!resolveActor(project, scene, prev, prop, prev.duration).visible) continue;
      const held = Object.keys(next.cast).some((p) => holderAt(next, p, 0) === carrier);
      if (!held)
        out.push({
          level: 'warning',
          where: `shot '${next.id}'`,
          message: `'${carrier}' ends '${prev.id}' carrying '${prop}' but starts '${next.id}' empty-handed; cast it and attach it at t 0, or put it down in '${prev.id}'`,
        });
    }
  }
  return out;
}

/** A language some lines are translated into and others are not: their subtitles have gaps. */
function translationGaps(project: Project): Problem[] {
  const lines = project.shots.flatMap((s) =>
    s.actions.flatMap((a, i) => (a.say || a.caption ? [{ shot: s.id, i, a }] : []))
  );
  const langs = new Set(lines.flatMap((l) => Object.keys(l.a.translation ?? {})));
  return [...langs].flatMap((lang) => {
    const missing = lines.filter((l) => !l.a.translation?.[lang]);
    if (!missing.length) return [];
    const some = missing
      .slice(0, 4)
      .map((l) => `'${l.shot}' action ${l.i}`)
      .join(', ');
    return [
      {
        level: 'warning' as const,
        where: 'project',
        message: `${missing.length} of ${lines.length} lines have no '${lang}' translation, so the ${lang} subtitles skip them: ${some}${missing.length > 4 ? ', …' : ''}`,
      },
    ];
  });
}

export function validateProject(project: Project): Problem[] {
  const out: Problem[] = [];
  for (const c of Object.values(project.characters)) out.push(...validateCharacter(c));
  for (const s of Object.values(project.scenes)) {
    out.push(...validateScene(s, project.meta.width, project.meta.height));
    out.push(...sceneSoundProblems(s, project));
  }
  out.push(...musicProblems('project', project.meta.music, project));
  out.push(...voiceProblems('project narrator', project.meta.narrator));
  for (const shot of project.shots) out.push(...validateShot(shot, project));
  if (!hasErrors(out)) out.push(...carriedAcrossCuts(project));
  if (!hasErrors(out)) out.push(...worldProblems(project));
  out.push(...speechProblems(project));
  out.push(...translationGaps(project));
  // Instagram and YouTube Shorts take a reel of up to three minutes.
  const seconds = movieDuration(project);
  if (isPortrait(project.meta) && seconds > REEL_SECONDS)
    out.push({
      level: 'warning',
      where: 'project',
      message: `the reel runs ${seconds.toFixed(1)}s, over the ${REEL_SECONDS}s the reel apps take; cut a scene or shorten shots`,
    });
  if (project.shots.length === 0)
    out.push({ level: 'warning', where: 'project', message: 'no shots yet' });
  return out;
}

export function formatProblems(problems: Problem[]): string {
  if (!problems.length) return 'OK';
  return problems
    .map((p) => `${p.level.toUpperCase()}${p.code ? ` [${p.code}]` : ''}: ${p.where}: ${p.message}`)
    .join('\n');
}

export const hasErrors = (problems: Problem[]): boolean =>
  problems.some((p) => p.level === 'error');

/**
 * A shot's sketch is in sketches/ and draws its first frame (small, to be quick). A later
 * frame that throws stops the render with the sketch's own stack.
 */
function sketchProblem(project: Project, shot: Shot): string | undefined {
  // Not loaded from disk (a test's project in memory): nothing to look in.
  if (!project.audio) return undefined;
  const id = shot.sketch!;
  if (!project.sketches?.[id]) {
    const have = Object.keys(project.sketches ?? {});
    return `unknown sketch '${id}': write sketches/${id}.js (have: ${have.join(', ') || 'none'})`;
  }
  try {
    sketchAt(project, shot, 0, 0.25);
  } catch (e) {
    return (e as Error).message;
  }
  return undefined;
}
