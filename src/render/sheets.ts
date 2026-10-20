import { characterBody, placeCharacter } from '../engine/actor.js';
import { composeFrame } from '../engine/compose.js';
import {
  applyVerb,
  basePose,
  EMOTION_FACE,
  pickVariant,
  resolveFace,
  type Pose,
} from '../engine/motion.js';
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
  // Label an emotion cell with any part that could not give the variant it wanted, so a
  // missing `eyes.angry` is visible on the sheet instead of silently rendering as open eyes.
  const emotionLabel = (emotion: Emotion): string => {
    const notes: string[] = [];
    for (const [name, wanted] of Object.entries(EMOTION_FACE[emotion])) {
      const part = character.parts[name];
      if (!part || typeof part === 'string') continue;
      const picked = pickVariant(part, name, wanted);
      if (picked !== wanted[0]) notes.push(`${name}→${picked}`);
    }
    return notes.length ? `${emotion} · ${notes.join(' ')}` : emotion;
  };
  const emotionCell = (emotion: Emotion) =>
    make(emotionLabel(emotion), () => base('idle', 0), emotion);
  const cells: Cell[] = [
    make('idle', () => base('idle', 0)),
    make('walk', () => base('walk', 0.16)),
    make('run', () => base('run', 0.1)),
    make('wave', withVerb('wave', 0.3)),
    make('point', withVerb('point', 0.5)),
    make('jump', withVerb('jump', 0.5)),
    make('tremble', withVerb('tremble', 0.3)),
    ...(rig.name === 'humanoid'
      ? [{ ...make('sit', withVerb('sit', 0)), lift: 70 }]
      : [make('bounce', withVerb('bounce', 0.25))]),
    make('talking', () => base('idle', 0), 'neutral', true),
    emotionCell('happy'),
    emotionCell('sad'),
    emotionCell('surprised'),
    emotionCell('angry'),
    emotionCell('scared'),
  ];
  // Variants of parts the emotions do not drive (a lantern's lit body, a tilted hat) are
  // only ever selected by a `face` action, so show each one or the agent cannot check it.
  for (const [name, part] of Object.entries(character.parts)) {
    if (typeof part === 'string' || name === 'eyes' || name === 'mouth') continue;
    for (const variant of Object.keys(part)) {
      const cell = make(`${name}: ${variant}`, () => base('idle', 0));
      cell.pose.face[name] = variant;
      cells.push(cell);
    }
  }

  const cols = 7;
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
    out += `<text x='${cx + cellW / 2}' y='${cy + cellH - 22}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='${cell.label.length > 18 ? 12 : 16}' fill='#555'>${escapeXml(cell.label)}</text>`;
  });
  return out + '</svg>';
}

/**
 * The scene with its anchors, the stage shortcuts, and a ghost for scale: the project's
 * tallest character once there is one (a cast of 100px animals needs a different floor
 * band than a 300px adult), otherwise a 220px humanoid.
 */
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
  const tallest = Object.values(project.characters).sort((a, b) => b.height - a.height)[0];
  const ghostH = tallest?.height ?? 220;
  const ghostW = tallest ? (ghostH * RIGS[tallest.rig].width) / RIGS[tallest.rig].height : 110;
  const ghostLabel = tallest ? `${tallest.id} (${ghostH}px, tallest)` : '220px character';
  const ghost = `<g opacity='0.35'><rect x='${n(ground.x - ghostW / 2)}' y='${n(ground.y - ghostH)}' width='${n(ghostW)}' height='${n(ghostH)}' rx='${n(Math.min(40, ghostW / 2))}' fill='#333'/><text x='${n(ground.x)}' y='${n(ground.y - ghostH - 8)}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='16' fill='#333'>${escapeXml(ghostLabel)}</text></g>`;
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<rect width='${W}' height='${H}' fill='#000'/><g>${scene.svg}</g>${ghost}` +
    (scene.foreground ? `<g>${scene.foreground}</g>` : '') +
    marks +
    `<text x='12' y='28' font-family='${LABEL_FONT}' font-size='20' fill='#fff' stroke='#000' stroke-width='4' paint-order='stroke'>${escapeXml(scene.name)} (${scene.id}) · green = anchors · yellow = stage shortcuts</text></svg>`
  );
}

/**
 * Tile labelled frames. Two columns of 630px: wide enough to tell a thought bubble from a
 * speech bubble and read its text, and the sheet stays under the size at which image
 * models downscale it.
 */
function tileFrames(
  project: Project,
  frames: { label: string; svg: string }[],
  cols = 2,
  cellW = 630
): string {
  const { width: W, height: H } = project.meta;
  const cellH = Math.round((cellW * H) / W);
  const gap = 10;
  const rows = Math.ceil(frames.length / cols);
  const SW = cols * (cellW + gap) + gap;
  const SH = rows * (cellH + gap + 22) + gap;
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${SW}' height='${SH}' viewBox='0 0 ${SW} ${SH}'><rect width='${SW}' height='${SH}' fill='#222'/>`;
  frames.forEach((f, i) => {
    const x = gap + (i % cols) * (cellW + gap);
    const y = gap + Math.floor(i / cols) * (cellH + gap + 22);
    out += `<svg x='${x}' y='${y}' width='${cellW}' height='${cellH}' viewBox='0 0 ${W} ${H}'>${f.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
    out += `<text x='${x + 4}' y='${y + cellH + 17}' font-family='${LABEL_FONT}' font-size='14' fill='#ddd'>${escapeXml(f.label)}</text>`;
  });
  return out + '</svg>';
}

/** Evenly spaced frames from a shot, tiled with time stamps. */
export function contactSheetSvg(project: Project, shot: Shot, count = 6, cols = 2): string {
  const frames = Array.from({ length: count }, (_, i) => {
    const t = ((i + 0.5) / count) * shot.duration;
    return { label: `${shot.id} · t=${t.toFixed(2)}s`, svg: composeFrame(project, shot, t) };
  });
  return tileFrames(project, frames, cols);
}

/** One frame from the middle of each shot: the whole film at a glance, returned by `render`. */
export function filmSheetSvg(project: Project, shots: Shot[]): string {
  const frames = shots.map((shot, i) => ({
    label: `${i + 1}. ${shot.id} · ${shot.duration}s`,
    svg: composeFrame(project, shot, shot.duration / 2),
  }));
  return tileFrames(project, frames, shots.length > 4 ? 3 : 2, shots.length > 4 ? 420 : 630);
}
