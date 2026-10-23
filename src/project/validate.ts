import { missingColorTokens } from '../engine/svg.js';
import { lintCharacter } from './construction.js';
import { effectLayer } from '../engine/effects.js';
import { RIGS } from '../engine/rigs.js';
import { sayDuration, STAGE_SHORTCUTS } from '../engine/timeline.js';
import type { Character, Effect, Project, Scene, Shot, Weather } from '../engine/types.js';

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

export function validateCharacter(c: Character): Problem[] {
  const out: Problem[] = [];
  const rig = RIGS[c.rig];
  const where = `character '${c.id}'`;
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

/** Whether a fragment has a rect at the origin at least the size of the frame. */
function coversFrame(svg: string, width: number, height: number): boolean {
  for (const [, attrs] of svg.matchAll(/<rect\b([^>]*)>/g)) {
    const num = (k: string) => parseFloat(attrs.match(new RegExp(`\\b${k}='([^']*)'`))?.[1] ?? '0');
    if (num('x') <= 0 && num('y') <= 0 && num('width') >= width && num('height') >= height)
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

export function validateShot(shot: Shot, project: Project): Problem[] {
  const out: Problem[] = [];
  const where = `shot '${shot.id}'`;
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
    if (a.attach && a.do && a.do !== 'appear' && a.do !== 'disappear')
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
    if (a.to && a.do && !['walk', 'run', 'move', 'fly', 'jump', 'sit', 'lie'].includes(a.do))
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
  // default `say` duration is longer than it looks. Warn, because it can be intended.
  const bubbles = shot.actions
    .filter((a) => a.say && a.actor)
    .map((a) => ({ actor: a.actor!, from: a.t, to: a.t + (a.duration ?? sayDuration(a.say!)) }))
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
  if (shot.actions.length === 0 && Object.keys(shot.cast).length === 0)
    out.push({ level: 'warning', where, message: 'empty shot: no cast and no actions' });
  return out;
}

export function validateProject(project: Project): Problem[] {
  const out: Problem[] = [];
  for (const c of Object.values(project.characters)) out.push(...validateCharacter(c));
  for (const s of Object.values(project.scenes))
    out.push(...validateScene(s, project.meta.width, project.meta.height));
  for (const shot of project.shots) out.push(...validateShot(shot, project));
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
