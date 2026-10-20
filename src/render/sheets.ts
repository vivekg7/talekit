import { characterBody, placeCharacter } from '../engine/actor.js';
import { composeFrame } from '../engine/compose.js';
import { applyVerb, basePose, resolveFace, type Pose } from '../engine/motion.js';
import { RIGS } from '../engine/rigs.js';
import { escapeXml, n } from '../engine/svg.js';
import { STAGE_SHORTCUTS, resolvePosition } from '../engine/timeline.js';
import type { Character, Emotion, Project, Scene, Shot } from '../engine/types.js';

const LABEL_FONT = 'Helvetica, Arial, sans-serif';

interface Cell {
  label: string;
  pose: Pose;
  /** Vertical shift of the feet line, for poses that hang below it (sit). */
  lift?: number;
}

/** Every pose the engine can put a character in, so the agent sees the whole range at once. */
export function characterSheetSvg(character: Character): string {
  const rig = RIGS[character.rig];
  const face = (emotion: Emotion, talking = false) =>
    resolveFace(character.parts, { emotion, overrides: {}, talking, t: 0.06, phase: 0.2 });
  const make = (
    label: string,
    build: () => Pose,
    emotion: Emotion = 'neutral',
    talking = false
  ): Cell => {
    const pose = build();
    pose.face = face(emotion, talking);
    return { label, pose };
  };
  const base = (loco: Parameters<typeof basePose>[1], t: number) => basePose(rig, loco, t, 0);
  const withVerb =
    (
      verb: Parameters<typeof applyVerb>[2],
      u: number,
      loco: Parameters<typeof basePose>[1] = 'idle'
    ) =>
    () => {
      const p = base(loco, 0);
      applyVerb(rig, p, verb, u);
      return p;
    };
  const cells: Cell[] = [
    make('idle', () => base('idle', 0)),
    make('walk', () => base('walk', 0.16)),
    make('run', () => base('run', 0.1)),
    make('wave', withVerb('wave', 0.3)),
    make('point', withVerb('point', 0.5)),
    make('jump', withVerb('jump', 0.5)),
    ...(rig.name === 'humanoid'
      ? [{ ...make('sit', withVerb('sit', 0)), lift: 70 }]
      : [make('bounce', withVerb('bounce', 0.25))]),
    make('talking', () => base('idle', 0), 'neutral', true),
    make('happy', () => base('idle', 0), 'happy'),
    make('sad', () => base('idle', 0), 'sad'),
    make('surprised', () => base('idle', 0), 'surprised'),
    make('angry', () => base('idle', 0), 'angry'),
  ];

  const cols = 6;
  const cellW = 230;
  const cellH = rig.height + 170;
  const rows = Math.ceil(cells.length / cols);
  const W = cols * cellW;
  const H = rows * cellH + 40;
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><rect width='${W}' height='${H}' fill='#e9eef3'/>`;
  out += `<text x='12' y='26' font-family='${LABEL_FONT}' font-size='18' fill='#333'>${escapeXml(character.name)} (${character.id}) · rig ${rig.name} · height ${character.height}px</text>`;
  cells.forEach((cell, i) => {
    const cx = (i % cols) * cellW;
    const cy = 40 + Math.floor(i / cols) * cellH;
    const feetY = cy + 110 + rig.height - (cell.lift ?? 0);
    out += `<rect x='${cx + 8}' y='${cy + 8}' width='${cellW - 16}' height='${cellH - 16}' rx='10' fill='#fff' stroke='#cfd6dd'/>`;
    out += `<line x1='${cx + 20}' y1='${feetY}' x2='${cx + cellW - 20}' y2='${feetY}' stroke='#bbb' stroke-dasharray='4 4'/>`;
    const body = characterBody(character, cell.pose);
    out += placeCharacter(
      character,
      body,
      cx + cellW / 2,
      feetY,
      rig.height / character.height,
      'right'
    );
    out += `<text x='${cx + cellW / 2}' y='${cy + cellH - 22}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='16' fill='#555'>${cell.label}</text>`;
  });
  return out + '</svg>';
}

/** The scene with its anchors, the stage shortcuts, and a ghost showing a 220px character for scale. */
export function sceneSheetSvg(project: Project, scene: Scene): string {
  const { width: W, height: H } = project.meta;
  const mark = (name: string, x: number, y: number, color: string) =>
    `<g><circle cx='${n(x)}' cy='${n(y)}' r='7' fill='${color}' stroke='#fff' stroke-width='2'/>` +
    `<text x='${n(x + 11)}' y='${n(y - 9)}' font-family='${LABEL_FONT}' font-size='20' font-weight='bold' fill='${color}' stroke='#000' stroke-width='4' paint-order='stroke'>${escapeXml(name)}</text></g>`;
  let marks = '';
  for (const s of STAGE_SHORTCUTS) {
    const p = resolvePosition(project, scene, s);
    if (p.x >= 0 && p.x <= W) marks += mark(s, p.x, p.y, '#ffd166');
  }
  for (const [name, a] of Object.entries(scene.anchors)) marks += mark(name, a.x, a.y, '#06d6a0');
  const ground = resolvePosition(project, scene, 'center');
  const ghostH = 220;
  const ghost = `<g opacity='0.35'><rect x='${n(ground.x - 55)}' y='${n(ground.y - ghostH)}' width='110' height='${ghostH}' rx='40' fill='#333'/><text x='${n(ground.x)}' y='${n(ground.y - ghostH - 8)}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='16' fill='#333'>220px character</text></g>`;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<rect width='${W}' height='${H}' fill='#000'/><g>${scene.svg}</g>${ghost}` +
    (scene.foreground ? `<g>${scene.foreground}</g>` : '') +
    marks +
    `<text x='12' y='28' font-family='${LABEL_FONT}' font-size='20' fill='#fff' stroke='#000' stroke-width='4' paint-order='stroke'>${escapeXml(scene.name)} (${scene.id}) · green = anchors · yellow = stage shortcuts</text></svg>`
  );
}

/** Evenly spaced frames from a shot, tiled with time stamps. */
export function contactSheetSvg(project: Project, shot: Shot, count = 6, cols = 3): string {
  const { width: W, height: H } = project.meta;
  const cellW = 426;
  const cellH = Math.round((cellW * H) / W);
  const gap = 10;
  const rows = Math.ceil(count / cols);
  const SW = cols * (cellW + gap) + gap;
  const SH = rows * (cellH + gap + 22) + gap;
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${SW}' height='${SH}' viewBox='0 0 ${SW} ${SH}'><rect width='${SW}' height='${SH}' fill='#222'/>`;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) / count) * shot.duration;
    const x = gap + (i % cols) * (cellW + gap);
    const y = gap + Math.floor(i / cols) * (cellH + gap + 22);
    const frame = composeFrame(project, shot, t);
    out += `<svg x='${x}' y='${y}' width='${cellW}' height='${cellH}' viewBox='0 0 ${W} ${H}'>${frame.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
    out += `<text x='${x + 4}' y='${y + cellH + 17}' font-family='${LABEL_FONT}' font-size='14' fill='#ddd'>${shot.id} · t=${t.toFixed(2)}s</text>`;
  }
  return out + '</svg>';
}
