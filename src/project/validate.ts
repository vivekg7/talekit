import { missingColorTokens } from '../engine/svg.js';
import { lintCharacter } from './construction.js';
import { effectLayer } from '../engine/effects.js';
import { RIGS, rigOf } from '../engine/rigs.js';
import { holdPoint, poseFor } from '../engine/actor.js';
import { attachTime, holderAt, resolveActor, STAGE_SHORTCUTS } from '../engine/timeline.js';
import { resolveSound } from '../engine/sources.js';
import {
  clipFor,
  lineDuration,
  lineLead,
  spokenText,
  voiceLines,
  voiceSpec,
} from '../engine/voice.js';
import { needsShaping } from '../engine/glyphs.js';
import { VOICES } from '../library/voices.js';
import type {
  Character,
  Effect,
  Music,
  Project,
  Scene,
  Shot,
  Voice,
  Weather,
} from '../engine/types.js';
import { SOUNDS } from '../library/sounds.js';

export interface Problem {
  level: 'error' | 'warning';
  where: string;
  message: string;
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
  const rig = rigOf(c);
  const where = `character '${c.id}'`;
  out.push(...voiceProblems(where, c.voice));
  if (!c.parts[rig.required])
    out.push({ level: 'error', where, message: `rig '${c.rig}' needs a '${rig.required}' part` });
  for (const [name, part] of Object.entries(c.parts)) {
    const fragments = typeof part === 'string' ? [part] : Object.values(part);
    // A single-string part must draw something. In a variant map an empty string is a
    // legitimate "draw nothing" variant (a beak's closed mouth, a hat that is off), as long
    // as at least one variant draws.
    if (typeof part === 'string' && !part.trim())
      out.push({ level: 'error', where, message: `part '${name}' is empty` });
    else if (typeof part !== 'string' && !fragments.some((f) => f.trim()))
      out.push({
        level: 'error',
        where,
        message: fragments.length
          ? `part '${name}': every variant is empty`
          : `part '${name}' has no variants`,
      });
    for (const f of fragments) {
      const bad = forbiddenMarkup(f);
      if (bad) out.push({ level: 'error', where, message: `part '${name}' ${bad}` });
      const missing = missingColorTokens(f, c.colors);
      if (missing.length)
        out.push({
          level: 'error',
          where,
          message: `part '${name}' uses undefined colour tokens: ${missing.join(', ')}`,
        });
    }
  }
  for (const name of c.springs ?? [])
    if (!c.parts[name])
      out.push({ level: 'warning', where, message: `springs names '${name}', which has no part` });
  const base = RIGS[c.rig];
  for (const [name, h] of Object.entries(c.hangs ?? {})) {
    if (base.parts[name])
      out.push({
        level: 'error',
        where,
        message: `hangs places '${name}', which the ${c.rig} rig already places`,
      });
    else if (!rig.parts[name])
      out.push({
        level: 'error',
        where,
        message: `hangs '${name}' from '${h.from}', which is neither a ${c.rig} part nor hung itself, or hangs from '${name}' again`,
      });
    if (!c.parts[name])
      out.push({ level: 'warning', where, message: `hangs names '${name}', which has no part` });
  }
  if (rig.expected.length) {
    for (const p of rig.expected)
      if (!c.parts[p])
        out.push({
          level: 'warning',
          where,
          message: `${c.rig} without '${p}' will not animate it`,
        });
    const mouth = c.parts.mouth;
    if (mouth && typeof mouth !== 'string' && !mouth.open)
      out.push({
        level: 'warning',
        where,
        message: `mouth has no 'open' variant, so talking will not flap`,
      });
    const eyes = c.parts.eyes;
    if (eyes && typeof eyes !== 'string' && !eyes.closed)
      out.push({
        level: 'warning',
        where,
        message: `eyes have no 'closed' variant, so there is no blinking`,
      });
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
  const where = `scene '${s.id}'`;
  for (const [field, svg] of [
    ['svg', s.svg],
    ['foreground', s.foreground],
    ['far', s.far],
    ['near', s.near],
  ] as const) {
    const bad = svg && forbiddenMarkup(svg);
    if (bad) out.push({ level: 'error', where, message: `${field} ${bad}` });
  }
  // The usual mistake when splitting a scene into layers: the sky left in svg hides `far`.
  if (s.far && coversFrame(s.svg, width, height))
    out.push({
      level: 'warning',
      where,
      message:
        'svg paints a rect over the whole frame, which hides far; move the sky into far and leave svg transparent above the ground',
    });
  if (!s.far) out.push(...needsFar(where, s.weather, s.effects));
  for (const [name, a] of Object.entries(s.anchors)) {
    if ((STAGE_SHORTCUTS as readonly string[]).includes(name))
      out.push({ level: 'warning', where, message: `anchor '${name}' shadows a stage shortcut` });
    if (a.x < -width * 0.5 || a.x > width * 1.5 || a.y < 0 || a.y > height * 1.2)
      out.push({
        level: 'warning',
        where,
        message: `anchor '${name}' at (${a.x}, ${a.y}) is far outside the frame`,
      });
  }
  if (Object.keys(s.anchors).length === 0)
    out.push({
      level: 'warning',
      where,
      message: 'no anchors; only the stage shortcuts left/center/right are available',
    });
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
    if (info && info.language !== 'hi' && needsShaping(line.text))
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

export function validateShot(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const where = `shot '${shot.id}'`;
  out.push(...musicProblems(where, shot.music, project));
  shot.actions.forEach((a, i) => {
    const err = a.sound && unknownSound(project, a.sound);
    if (err) out.push({ level: 'error', where, message: `action ${i}: ${err}` });
    if (a.volume !== undefined && !a.sound)
      out.push({ level: 'warning', where, message: `action ${i}: volume only applies to a sound` });
  });
  out.push(...lineProblems(shot, project));
  const scene = project.scenes[shot.scene];
  if (!scene) {
    out.push({ level: 'error', where, message: `unknown scene '${shot.scene}'` });
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
  for (const [id, member] of Object.entries(shot.cast)) {
    if (!project.characters[id])
      out.push({ level: 'error', where, message: `cast member '${id}' is not a character` });
    const err = positionOk(member.at);
    if (err) out.push({ level: 'error', where, message: `cast '${id}': ${err}` });
  }
  if (shot.crossfade > 0) {
    const i = project.shots.findIndex((s) => s.id === shot.id);
    const prev = i > 0 ? project.shots[i - 1] : undefined;
    if (i === 0)
      out.push({
        level: 'warning',
        where,
        message: 'crossfade on the first shot has nothing to dissolve from; it starts as a cut',
      });
    else if (prev && prev.fadeOut > 0)
      out.push({
        level: 'warning',
        where,
        message: `crossfade after '${prev.id}', which fades out, dissolves from black; drop its fadeOut`,
      });
    if (shot.crossfade > shot.duration)
      out.push({
        level: 'warning',
        where,
        message: `crossfade (${shot.crossfade}s) is longer than the shot (${shot.duration}s)`,
      });
  }
  const follows = (camera: { follow?: string } | undefined, w: string) => {
    if (camera?.follow && !shot.cast[camera.follow])
      out.push({
        level: 'error',
        where: w,
        message: `camera follows '${camera.follow}', who is not in the cast`,
      });
  };
  follows(shot.camera, where);
  shot.actions.forEach((a, i) => {
    const w = `${where} action[${i}] (t=${a.t})`;
    follows(a.camera, w);
    if (a.actor && !shot.cast[a.actor])
      out.push({ level: 'error', where: w, message: `actor '${a.actor}' is not in the cast` });
    // On a line with no move, `to` names who is spoken to.
    const listener = a.say && !a.do && typeof a.to === 'string';
    if (listener && !shot.cast[a.to as string])
      out.push({
        level: 'error',
        where: w,
        message: `'to' on a line names who is spoken to, and '${a.to}' is not in the cast`,
      });
    else if (listener && a.to === a.actor)
      out.push({ level: 'warning', where: w, message: `'${a.actor}' is speaking to itself` });
    else if (a.to && !listener) {
      const err = positionOk(a.to);
      if (err) out.push({ level: 'error', where: w, message: err });
    }
    if (a.attach) {
      if (!shot.cast[a.attach])
        out.push({
          level: 'error',
          where: w,
          message: `attach: '${a.attach}' is not in the cast`,
        });
      else if (a.attach === a.actor)
        out.push({ level: 'error', where: w, message: `attach: '${a.actor}' cannot carry itself` });
      else if (shot.actions.some((b) => b.actor === a.attach && b.attach))
        out.push({
          level: 'warning',
          where: w,
          message: `attach: '${a.attach}' is itself carried in this shot; carry one thing at a time`,
        });
    }
    if (a.do === 'pickup' && !a.attach)
      out.push({
        level: 'error',
        where: w,
        message: `pickup needs attach: the id of who picks '${a.actor}' up`,
      });
    if (a.do === 'putdown' && a.attach !== false)
      out.push({
        level: 'error',
        where: w,
        message: `putdown needs attach: false (the carrier sets '${a.actor}' down)`,
      });
    if (
      a.attach &&
      a.do &&
      a.do !== 'appear' &&
      a.do !== 'disappear' &&
      a.do !== 'pickup' &&
      a.do !== 'putdown'
    )
      out.push({
        level: 'warning',
        where: w,
        message: `'${a.do}' in the same action as attach is ignored while it is carried`,
      });
    if (a.set?.at) {
      const err = positionOk(a.set.at);
      if (err) out.push({ level: 'error', where: w, message: err });
    }
    if (a.t >= shot.duration)
      out.push({
        level: 'warning',
        where: w,
        message: `starts at or after the shot ends (${shot.duration}s)`,
      });
    if (
      a.to &&
      a.do &&
      !['walk', 'run', 'move', 'fly', 'jump', 'sit', 'lie', 'putdown'].includes(a.do)
    )
      out.push({ level: 'warning', where: w, message: `'to' is ignored for '${a.do}'` });
    if (a.face && a.actor && shot.cast[a.actor] && project.characters[a.actor]) {
      const parts = project.characters[a.actor].parts;
      for (const [part, variant] of Object.entries(a.face)) {
        const p = parts[part];
        // '' clears an earlier override, so it needs the part but no such variant.
        if (!p || typeof p === 'string' || (variant !== '' && !(variant in p)))
          out.push({
            level: 'error',
            where: w,
            message: `face: '${a.actor}' has no variant '${variant}' for part '${part}'`,
          });
      }
    }
  });
  // Two people talking at once is nearly always a pacing slip: the bubbles collide and the
  // default `say` duration is longer than it looks. Warn, because it can be intended. A
  // voiced line is talking until its voice stops; its bubble staying up after that (a beat,
  // or a longer `duration`) may overlap the next one, as bubbles do in a comic.
  const bubbles = shot.actions
    .filter((a) => a.say && a.actor)
    .map((a) => {
      const clip = clipFor(project, shot, a);
      const to = clip
        ? a.t + lineLead(project, shot, a) + clip.duration
        : a.t + lineDuration(project, shot, a);
      return { actor: a.actor!, from: a.t, to };
    })
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
      out.push({
        level: 'warning',
        where,
        message: `'${cur.actor}' starts speaking at ${cur.from}s while '${clash.actor}' is still talking until ${clash.to.toFixed(1)}s; the bubbles will overlap`,
      });
  }
  out.push(...pickupReach(shot, project));
  if (shot.actions.length === 0 && Object.keys(shot.cast).length === 0)
    out.push({ level: 'warning', where, message: 'empty shot: no cast and no actions' });
  return out;
}

/**
 * A pickup the hand cannot reach: where the stooping carrier's hand comes down, against
 * where the prop's grip lies. The engine eases the prop into the hand whatever the gap,
 * but a wide one shows as the prop sliding across the floor to it.
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
    const rig = rigOf(prop.character);
    const k = (prop.character.height / rig.height) * prop.scale;
    const [gx, gy] = prop.character.grip ?? [rig.width / 2, rig.height / 2];
    const side = prop.facing === 'left' ? -1 : 1;
    const grip = { x: prop.x + k * side * (gx - rig.width / 2), y: prop.y + k * (gy - rig.height) };
    const gap = Math.hypot(grip.x - hand.x, grip.y - hand.y);
    if (gap > 0.25 * carrier.character.height * carrier.scale) {
      const x = Math.round(carrier.x + grip.x - hand.x);
      out.push({
        level: 'warning',
        where: `shot '${shot.id}' action[${i}] (t=${a.t})`,
        message: `'${a.attach}' reaches down ${Math.round(gap)}px from where '${a.actor}' lies; stand them at x ≈ ${x}, facing it, before the pickup`,
      });
    }
  });
  return out;
}

/**
 * Continuity between shots: whoever ends a shot carrying something should start the next
 * one with it in hand, or the audience sees it vanish at the cut.
 */
function carriedAcrossCuts(project: Project): Problem[] {
  const out: Problem[] = [];
  for (let i = 1; i < project.shots.length; i++) {
    const [prev, next] = [project.shots[i - 1], project.shots[i]];
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
  if (project.shots.length === 0)
    out.push({ level: 'warning', where: 'project', message: 'no shots yet' });
  return out;
}

export function formatProblems(problems: Problem[]): string {
  if (!problems.length) return 'OK';
  return problems.map((p) => `${p.level.toUpperCase()}: ${p.where}: ${p.message}`).join('\n');
}

export const hasErrors = (problems: Problem[]): boolean =>
  problems.some((p) => p.level === 'error');
