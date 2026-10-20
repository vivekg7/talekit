import { missingColorTokens } from '../engine/svg.js';
import { RIGS } from '../engine/rigs.js';
import { STAGE_SHORTCUTS } from '../engine/timeline.js';
import type { Character, Project, Scene, Shot } from '../engine/types.js';

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
    if (typeof part !== 'string' && fragments.length === 0)
      out.push({ level: 'error', where, message: `part '${name}' has no variants` });
    for (const f of fragments) {
      if (!f.trim()) out.push({ level: 'error', where, message: `part '${name}' is empty` });
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
  if (c.rig === 'humanoid') {
    for (const p of ['head', 'legL', 'legR', 'armL', 'armR'])
      if (!c.parts[p])
        out.push({
          level: 'warning',
          where,
          message: `humanoid without '${p}' will not animate it`,
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
  return out;
}

export function validateScene(s: Scene, width: number, height: number): Problem[] {
  const out: Problem[] = [];
  const where = `scene '${s.id}'`;
  for (const [field, svg] of [
    ['svg', s.svg],
    ['foreground', s.foreground],
  ] as const) {
    const bad = svg && forbiddenMarkup(svg);
    if (bad) out.push({ level: 'error', where, message: `${field} ${bad}` });
  }
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
  for (const [id, member] of Object.entries(shot.cast)) {
    if (!project.characters[id])
      out.push({ level: 'error', where, message: `cast member '${id}' is not a character` });
    const err = positionOk(member.at);
    if (err) out.push({ level: 'error', where, message: `cast '${id}': ${err}` });
  }
  shot.actions.forEach((a, i) => {
    const w = `${where} action[${i}] (t=${a.t})`;
    if (a.actor && !shot.cast[a.actor])
      out.push({ level: 'error', where: w, message: `actor '${a.actor}' is not in the cast` });
    if (a.to) {
      const err = positionOk(a.to);
      if (err) out.push({ level: 'error', where: w, message: err });
    }
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
    if (a.to && a.do && !['walk', 'run', 'move', 'fly', 'jump', 'sit'].includes(a.do))
      out.push({ level: 'warning', where: w, message: `'to' is ignored for '${a.do}'` });
    if (a.face && a.actor && shot.cast[a.actor] && project.characters[a.actor]) {
      const parts = project.characters[a.actor].parts;
      for (const [part, variant] of Object.entries(a.face)) {
        const p = parts[part];
        if (!p || typeof p === 'string' || !p[variant])
          out.push({
            level: 'error',
            where: w,
            message: `face: '${a.actor}' has no variant '${variant}' for part '${part}'`,
          });
      }
    }
  });
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
