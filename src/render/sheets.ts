import {
  castsShadow,
  characterBody,
  placeCharacter,
  SHADOW_DEFS,
  shadowSvg,
} from '../engine/actor.js';
import { springParts } from '../engine/springs.js';
import { LOOK_LIMIT } from '../engine/timeline.js';
import { composeFrame, layerTransform, PARALLAX } from '../engine/compose.js';
import { CAST_DEFS, castLights, floorMap, throwOf } from '../engine/cast.js';
import { effectsSvg, fireLights, type EffectLayer } from '../engine/effects.js';
import { strikeAt } from '../engine/weather.js';
import { cueSheet, shotStarts, type Bus, type Cue } from '../engine/sound.js';
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
import {
  ShotSchema,
  type Character,
  type Emotion,
  type Project,
  type Scene,
  type Shot,
} from '../engine/types.js';
import { lintCharacter, partBox } from '../project/construction.js';

const LABEL_FONT = 'Helvetica, Arial, sans-serif';

interface Cell {
  label: string;
  pose: Pose;
  /** Vertical shift of the feet line, for poses that hang below it (sit). */
  lift?: number;
  /** Horizontal shift back, for poses that reach forward out of the cell (legs out). */
  shift?: number;
  /** Drawn smaller, for a pose wider than the cell (a person lying down). */
  zoom?: number;
}

/** Every pose the engine can put a character in, so the agent sees the whole range at once. */
export function characterSheetSvg(character: Character): string {
  const rig = RIGS[character.rig];
  const face = (emotion: Emotion, talking = false, back = false) =>
    resolveFace(character.parts, { emotion, overrides: {}, talking, t: 0.06, phase: 0.2, back });
  const make = (
    label: string,
    build: () => Pose,
    emotion: Emotion = 'neutral',
    talking = false
  ): Cell => {
    const pose = build();
    pose.face = face(emotion, talking, pose.back);
    return { label, pose };
  };
  const base = (loco: Parameters<typeof basePose>[1], t: number) => basePose(rig, loco, t, 0);
  const withVerb =
    (
      verb: Parameters<typeof applyVerb>[2],
      u: number,
      loco: Parameters<typeof basePose>[1] = 'idle',
      seat = 0
    ) =>
    () => {
      const p = base(loco, 0);
      applyVerb(rig, p, verb, u, seat);
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
  const quad = rig.name === 'quadruped';
  const cells: Cell[] = [
    make('idle', () => base('idle', 0)),
    make('walk', () => base('walk', quad ? 0.175 : 0.16)),
    ...(quad
      ? [
          make('run: stretched', () => base('run', 0.12)),
          make('run: gathered', () => base('run', 0.36)),
        ]
      : [make('run', () => base('run', 0.1))]),
    make('wave', withVerb('wave', 0.3)),
    make('point', withVerb('point', 0.5)),
    make('jump: crouch', withVerb('jump', 0.1)),
    make('jump', withVerb('jump', 0.5)),
    make('tremble', withVerb('tremble', 0.3)),
    { ...make('pickup', withVerb('pickup', 0.5)), zoom: 0.8, shift: 30 },
    ...(rig.name === 'humanoid'
      ? [
          // On a seat as high as a shin, the dashed line, with the floor below it.
          { ...make('sit', withVerb('sit', 1, 'idle', 70)), lift: 70 },
          { ...make('sit: ground', withVerb('sit', 1)), shift: 55 },
        ]
      : quad
        ? [make('sit', withVerb('sit', 1))]
        : [make('bounce', withVerb('bounce', 0.25))]),
    // Lying is layered on sitting on the ground, as the timeline does it.
    {
      ...make('lie', () => {
        const p = base('idle', 0);
        applyVerb(rig, p, 'sit', 1);
        applyVerb(rig, p, 'lie', 1);
        return p;
      }),
      ...(rig.name === 'humanoid' ? { zoom: 0.5, shift: -40 } : {}),
    },
    make('talking', () => base('idle', 0), 'neutral', true),
    // Halfway through a turn the face looks straight out: check it is centred on the head.
    ...(rig.turn
      ? [
          make('turning', () => {
            const p = base('idle', 0);
            p.yaw = 0;
            return p;
          }),
          // Walking into the screen: the face hidden, the `back` variants drawn.
          make('from behind', () => {
            const p = base('idle', 0);
            p.back = true;
            return p;
          }),
        ]
      : []),
    ...(character.parts.eyes
      ? [
          make('looking up', () => {
            const p = base('idle', 0);
            const head = rig.name === 'simple' ? 'body' : 'head';
            p.rot[head] = (p.rot[head] ?? 0) - LOOK_LIMIT[rig.name];
            return p;
          }),
        ]
      : []),
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
      // `default` is the idle cell; `back` is on the from-behind cell.
      if (variant === 'default' || variant === 'back') continue;
      const cell = make(`${name}: ${variant}`, () => base('idle', 0));
      cell.pose.face[name] = variant;
      cells.push(cell);
    }
  }

  const cols = rig.width > 200 ? 6 : 7;
  const cellW = Math.max(230, rig.width + 30);
  const cellH = rig.height + 170;
  const rows = Math.ceil(cells.length / cols);
  const W = cols * cellW;
  const H = rows * cellH + 40;
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><defs>${SHADOW_DEFS}</defs><rect width='${W}' height='${H}' fill='#e9eef3'/>`;
  const shadow = castsShadow(character);
  out += `<text x='12' y='26' font-family='${LABEL_FONT}' font-size='18' fill='#333'>${escapeXml(character.name)} (${character.id}) · rig ${rig.name} · height ${character.height}px${shadow ? '' : ' · no ground shadow'}</text>`;
  cells.forEach((cell, i) => {
    const cx = (i % cols) * cellW;
    const cy = 40 + Math.floor(i / cols) * cellH;
    const feetY = cy + 110 + rig.height - (cell.lift ?? 0);
    out += `<rect x='${cx + 8}' y='${cy + 8}' width='${cellW - 16}' height='${cellH - 16}' rx='10' fill='#fff' stroke='#cfd6dd'/>`;
    out += `<line x1='${cx + 20}' y1='${feetY}' x2='${cx + cellW - 20}' y2='${feetY}' stroke='#bbb' stroke-dasharray='4 4'/>`;
    if (cell.lift)
      out += `<line x1='${cx + 20}' y1='${feetY + cell.lift}' x2='${cx + cellW - 20}' y2='${feetY + cell.lift}' stroke='#bbb'/>`;
    const body = characterBody(character, cell.pose);
    const x = cx + cellW / 2 - (cell.shift ?? 0);
    const scale = (rig.height / character.height) * (cell.zoom ?? 1);
    if (shadow) out += shadowSvg(character, cell.pose, x, feetY, scale, 1);
    out += placeCharacter(character, body, x, feetY, scale, 'right');
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
  for (const sh of scene.shelters)
    marks +=
      `<path d='M${n(sh.x)} ${n(sh.y)} L${n(sh.x + sh.width)} ${n(sh.y)}' stroke='#4ea8ff' stroke-width='5' stroke-dasharray='14 6'/>` +
      `<text x='${n(sh.x)}' y='${n(sh.y - 8)}' font-family='${LABEL_FONT}' font-size='18' font-weight='bold' fill='#4ea8ff' stroke='#000' stroke-width='4' paint-order='stroke'>shelter</text>`;
  const ground = resolvePosition(project, scene, 'center');
  const tallest = Object.values(project.characters).sort((a, b) => b.height - a.height)[0];
  const ghostH = tallest?.height ?? 220;
  const ghostW = tallest ? (ghostH * RIGS[tallest.rig].width) / RIGS[tallest.rig].height : 110;
  const ghostLabel = tallest ? `${tallest.id} (${ghostH}px, tallest)` : '220px character';
  const ghostBox = `<rect x='${n(ground.x - ghostW / 2)}' y='${n(ground.y - ghostH)}' width='${n(ghostW)}' height='${n(ghostH)}' rx='${n(Math.min(40, ghostW / 2))}'`;
  // Each light marked where it is, and the shadow it throws of the ghost.
  const lights = castLights(scene, fireLights(scene.effects, 1, H));
  let shadows = '';
  for (const l of lights) {
    const th = throwOf(l, ground.x, ground.y, ghostH, W, H, scene.weather ?? {});
    if (th)
      shadows += `<g opacity='${n(th.opacity)}' filter='url(#tk-cast)'>${ghostBox} transform='${floorMap(th, ground.y)}' fill='#000'/></g>`;
    marks +=
      `<g><circle cx='${n(l.x)}' cy='${n(l.y)}' r='13' fill='none' stroke='#ffe14d' stroke-width='4'/>` +
      `<text x='${n(l.x + 18)}' y='${n(l.y + 7)}' font-family='${LABEL_FONT}' font-size='18' font-weight='bold' fill='#ffe14d' stroke='#000' stroke-width='4' paint-order='stroke'>${l.kind === 'sky' ? 'light (sky)' : 'light (lamp)'}</text></g>`;
  }
  const ghost = `<defs>${CAST_DEFS}</defs>${shadows}<g opacity='0.35'>${ghostBox} fill='#333'/><text x='${n(ground.x)}' y='${n(ground.y - ghostH - 8)}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='16' fill='#333'>${escapeXml(ghostLabel)}</text></g>`;
  // Effects stand still at one moment here, where they are placed against the anchors; the
  // strip underneath shows them moving with the weather.
  const fx = (plane: EffectLayer) =>
    effectsSvg(scene.effects, plane, 1, scene.weather?.wind ?? 0, W, H);
  const strips = [
    scene.far || scene.near ? layerStrip(project, scene) : undefined,
    scene.weather || scene.effects.length ? motionStrip(project, scene) : undefined,
  ].filter((x) => x !== undefined);
  let y = H;
  let below = '';
  for (const st of strips) {
    below += `<g transform='translate(0 ${n(y)})'>${st.svg}</g>`;
    y += st.height;
  }
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${n(y)}' viewBox='0 0 ${W} ${n(y)}'>` +
    `<rect width='${W}' height='${n(y)}' fill='#000'/>` +
    (scene.far ? `<g>${scene.far}</g>` : '') +
    fx('far') +
    `<g>${scene.svg}</g>${fx('stage')}${ghost}` +
    (scene.foreground ? `<g>${scene.foreground}</g>` : '') +
    fx('front') +
    (scene.near ? `<g>${scene.near}</g>` : '') +
    fx('near') +
    marks +
    `<text x='12' y='28' font-family='${LABEL_FONT}' font-size='20' fill='#fff' stroke='#000' stroke-width='4' paint-order='stroke'>${escapeXml(scene.name)} (${scene.id}) · green = anchors · yellow = stage shortcuts${scene.shelters.length ? ' · blue = shelters' : ''}${lights.length ? ' · yellow rings = lights' : ''}</text>` +
    below +
    `</svg>`
  );
}

/** A row of small labelled pictures, each a whole frame, starting at y = 0. */
function strip(W: number, H: number, cells: [string, string][]): { svg: string; height: number } {
  const gap = 10;
  const cw = (W - gap * (cells.length + 1)) / cells.length;
  const ch = (cw * H) / W;
  let svg = `<rect width='${W}' height='${n(ch + 2 * gap + 24)}' fill='#222'/>`;
  cells.forEach(([label, inner], i) => {
    const x = gap + i * (cw + gap);
    svg += `<svg x='${n(x)}' y='${gap}' width='${n(cw)}' height='${n(ch)}' viewBox='0 0 ${W} ${H}'>${inner}</svg>`;
    svg += `<text x='${n(x + 4)}' y='${n(gap + ch + 18)}' font-family='${LABEL_FONT}' font-size='15' fill='#ddd'>${escapeXml(label)}</text>`;
  });
  return { svg, height: ch + 2 * gap + 24 };
}

/**
 * Under a scene with weather or effects: the empty scene as the film draws it at a few
 * moments, so falling rain, drifting clouds, flames and waves show that they move and
 * where they reach. Ids are renamed per cell: they are global to the sheet, and a flash
 * filter differs from one moment to the next.
 */
function motionStrip(project: Project, scene: Scene): { svg: string; height: number } {
  const { width: W, height: H } = project.meta;
  const withScene = { ...project, scenes: { ...project.scenes, [scene.id]: scene } };
  const shot = ShotSchema.parse({ id: `sheet-${scene.id}`, scene: scene.id, duration: 4 });
  const times = [0, 0.4, 0.8, 1.6];
  // Catch a strike just as it lights up, when there is lightning to see.
  const every = scene.weather?.lightning?.every;
  if (every) times[3] = Math.round((strikeAt(shot.id, every, 0) + 0.02) * 100) / 100;
  const cells: [string, string][] = times.map((t, i) => [
    `moving · t=${t}s`,
    composeFrame(withScene, shot, t)
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '')
      .replace(/(id='|url\(#)tk-/g, `$1tk-m${i}-`),
  ]);
  return strip(W, H, cells);
}

/**
 * Under a layered scene: each layer on its own (the far layer must fill the frame, the
 * near one should keep to the edges), and the camera zoomed into either side so the
 * parallax shows as the far layer sitting differently behind the stage.
 */
function layerStrip(project: Project, scene: Scene): { svg: string; height: number } {
  const { width: W, height: H } = project.meta;
  const zoom = 1.6;
  const view = (
    cam: { zoom: number; x: number; y: number },
    parts: ('far' | 'stage' | 'near')[]
  ) => {
    const at = (p: number) => layerTransform(cam, W, H, p);
    let out = `<rect width='${W}' height='${H}' fill='#000'/>`;
    if (parts.includes('far') && scene.far)
      out += `<g transform='${at(scene.parallax?.far ?? PARALLAX.far)}'>${scene.far}</g>`;
    if (parts.includes('stage'))
      out += `<g transform='${at(1)}'>${scene.svg}${scene.foreground ?? ''}</g>`;
    if (parts.includes('near') && scene.near)
      out += `<g transform='${at(scene.parallax?.near ?? PARALLAX.near)}'>${scene.near}</g>`;
    return out;
  };
  const still = { zoom: 1, x: W / 2, y: H / 2 };
  const y = H - H / (2 * zoom);
  const cells: [string, string][] = [
    ...(scene.far ? [['far layer alone', view(still, ['far'])] as [string, string]] : []),
    ...(scene.near ? [['near layer alone', view(still, ['near'])] as [string, string]] : []),
    [`camera ${zoom}× left`, view({ zoom, x: W / (2 * zoom), y }, ['far', 'stage', 'near'])],
    [`camera ${zoom}× right`, view({ zoom, x: W - W / (2 * zoom), y }, ['far', 'stage', 'near'])],
  ];
  return strip(W, H, cells);
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
  cellW = 630,
  footer?: (width: number) => { svg: string; height: number }
): string {
  const { width: W, height: H } = project.meta;
  const cellH = Math.round((cellW * H) / W);
  const gap = 10;
  const rows = Math.ceil(frames.length / cols);
  const SW = cols * (cellW + gap) + gap;
  const foot = footer?.(SW - 2 * gap);
  const top = rows * (cellH + gap + 22) + gap;
  const SH = top + (foot ? foot.height + gap : 0);
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${SW}' height='${SH}' viewBox='0 0 ${SW} ${SH}'><rect width='${SW}' height='${SH}' fill='#222'/>`;
  frames.forEach((f, i) => {
    const x = gap + (i % cols) * (cellW + gap);
    const y = gap + Math.floor(i / cols) * (cellH + gap + 22);
    out += `<svg x='${x}' y='${y}' width='${cellW}' height='${cellH}' viewBox='0 0 ${W} ${H}'>${f.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
    out += `<text x='${x + 4}' y='${y + cellH + 17}' font-family='${LABEL_FONT}' font-size='14' fill='#ddd'>${escapeXml(f.label)}</text>`;
  });
  if (foot) out += `<g transform='translate(${gap} ${top})'>${foot.svg}</g>`;
  return out + '</svg>';
}

const LANE_COLORS: Record<Bus, string> = {
  music: '#8338ec',
  ambience: '#2a9d8f',
  sfx: '#e9c46a',
  voice: '#3a86ff',
};

/**
 * What these shots sound like, against their clock: a row for each speaker, then the
 * effects, the ambience and the music. `marks` are dashed lines (the sampled frames, or the
 * cuts); `detail` writes each line's length and each sound's name, which a whole film has
 * no room for. Undefined when nothing sounds.
 */
function audioLane(
  project: Project,
  shots: Shot[],
  marks: { t: number; label?: string }[],
  from: number,
  to: number,
  detail: boolean
): ((width: number) => { svg: string; height: number }) | undefined {
  const cues = cueSheet(project, shots);
  if (!cues.length) return undefined;
  const ends = new Map<string, number>();
  shotStarts(shots).forEach((at, i) => ends.set(shots[i].id, at + shots[i].duration));
  const rows: { name: string; bus: Bus; cues: Cue[] }[] = [];
  // A row for each speaker, so who talks over whom shows.
  for (const name of [...new Set(cues.filter((c) => c.bus === 'voice').map((c) => c.label))])
    rows.push({
      name,
      bus: 'voice',
      cues: cues.filter((c) => c.bus === 'voice' && c.label === name),
    });
  for (const bus of ['sfx', 'ambience', 'music'] as Bus[]) {
    const mine = cues.filter((c) => c.bus === bus);
    if (mine.length) rows.push({ name: bus === 'sfx' ? 'sounds' : bus, bus, cues: mine });
  }
  return (width) => {
    const label = 90;
    const rowH = 24;
    const height = rows.length * rowH + 22;
    const span = Math.max(1e-6, to - from);
    const x = (t: number) => label + ((t - from) / span) * (width - label);
    let svg = `<rect width='${width}' height='${height}' rx='6' fill='#2c2c2c'/>`;
    for (const m of marks) {
      svg += `<path d='M${x(m.t)} 0 v${height}' stroke='#555' stroke-dasharray='3 3'/>`;
      if (m.label)
        svg += `<text x='${x(m.t) + 3}' y='14' font-family='${LABEL_FONT}' font-size='11' fill='#bbb'>${escapeXml(m.label)}</text>`;
    }
    if (detail)
      for (let s = Math.ceil(from); s <= to; s++)
        svg += `<text x='${x(s)}' y='14' font-family='${LABEL_FONT}' font-size='11' fill='#999' text-anchor='middle'>${s}s</text>`;
    rows.forEach((row, i) => {
      const y = 20 + i * rowH;
      const color = LANE_COLORS[row.bus];
      svg += `<text x='6' y='${y + 16}' font-family='${LABEL_FONT}' font-size='13' fill='#ccc'>${escapeXml(row.name)}</text>`;
      // Where the last label in this row ends: one that would run over it is left out (a walk's steps).
      let labelEnd = -Infinity;
      for (const c of row.cues) {
        if (c.at > to) continue;
        const a = Math.max(from, c.at);
        const length = c.until !== undefined ? c.until - c.at : (c.length ?? 0);
        const b = Math.min(to, c.at + length);
        // A line still speaking when its shot cuts is cut off with it: outlined in red.
        const over = c.bus === 'voice' && c.at + length > ends.get(c.shot)! + 0.01;
        const outline = over ? ` stroke='#ff4d4d' stroke-width='3'` : '';
        if (b - a > 0.05)
          svg += `<rect x='${x(a)}' y='${y + 3}' width='${x(b) - x(a)}' height='${rowH - 6}' rx='4' fill='${color}' opacity='0.55'${outline}/>`;
        else svg += `<path d='M${x(a)} ${y + 3} v${rowH - 6}' stroke='${color}' stroke-width='3'/>`;
        const text =
          c.bus === 'voice' ? `${length.toFixed(1)}s${over ? ' · cut off' : ''}` : c.label;
        if ((detail || c.bus === 'music' || c.bus === 'ambience') && x(a) >= labelEnd) {
          labelEnd = x(a) + 10 + text.length * 7;
          svg += `<text x='${x(a) + 5}' y='${y + 16}' font-family='${LABEL_FONT}' font-size='12' fill='#fff'>${escapeXml(text)}</text>`;
        }
      }
    });
    return { svg, height };
  };
}

/**
 * The whole film's sound on one clock, a row per speaker and per kind of sound, with the
 * cuts marked and numbered: returned by set_audio, where the music and narrator change.
 */
export function audioMapSvg(project: Project, shots: Shot[] = project.shots): string {
  const starts = shotStarts(shots);
  const total = shots.reduce((s, x) => s + x.duration, 0);
  const width = 1200;
  const marks = starts.map((t, i) => ({ t, label: String(i + 1) }));
  const lane = audioLane(project, shots, marks, 0, total, false)?.(width - 20);
  const body = lane
    ? `<g transform='translate(10 34)'>${lane.svg}</g>`
    : `<text x='20' y='60' font-family='${LABEL_FONT}' font-size='14' fill='#ccc'>Nothing sounds yet: no music, ambience, sounds or voiced lines.</text>`;
  const height = 44 + (lane?.height ?? 40);
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>` +
    `<rect width='${width}' height='${height}' fill='#222'/>` +
    `<text x='12' y='22' font-family='${LABEL_FONT}' font-size='15' fill='#eee'>${escapeXml(project.meta.title)} · ${total.toFixed(0)}s · ${shots.length} shots (numbered at each cut)</text>` +
    body +
    '</svg>'
  );
}

/** Evenly spaced frames from a shot (or from `from` to `to` in it), tiled with time stamps. */
export function contactSheetSvg(
  project: Project,
  shot: Shot,
  count = 6,
  cols = 2,
  from = 0,
  to = shot.duration
): string {
  const times = Array.from({ length: count }, (_, i) => from + ((i + 0.5) / count) * (to - from));
  const frames = times.map((t) => ({
    label: `${shot.id} · t=${t.toFixed(2)}s`,
    svg: composeFrame(project, shot, t),
  }));
  const marks = times.map((t) => ({ t }));
  return tileFrames(project, frames, cols, 630, audioLane(project, [shot], marks, from, to, true));
}

/** One frame from the middle of each shot: the whole film at a glance, returned by `render`. */
export function filmSheetSvg(project: Project, shots: Shot[]): string {
  const frames = shots.map((shot, i) => ({
    label: `${i + 1}. ${shot.id} · ${shot.duration}s`,
    svg: composeFrame(project, shot, shot.duration / 2),
  }));
  return tileFrames(project, frames, shots.length > 4 ? 3 : 2, shots.length > 4 ? 420 : 630);
}

const PART_COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0'];

/**
 * Joint stress test per rig: the limbs swung well past a walk, so any joint that is not
 * sunk deep enough opens up on the sheet. Multiplied by +1 and -1 for the two panels.
 */
const SWING: Partial<Record<Character['rig'], Record<string, number>>> = {
  humanoid: { armR: -100, armL: 60, legL: 32, legR: -32, head: 10 },
  quadruped: {
    legFR: 32,
    legBL: 32,
    legFL: -32,
    legBR: -32,
    head: 12,
    tail: -30,
    earL: -18,
    earR: -18,
  },
};

/**
 * What the construction linter sees, so the agent can match each numbered warning to a
 * place: part boxes and pivots over the drawing, the silhouette (does it read as one thing
 * in solid black?), and for the rigs with limbs two swing poses that open any gap at a joint.
 */
export function constructionSheetSvg(character: Character): string {
  const rig = RIGS[character.rig];
  const { problems, marks } = lintCharacter(character);
  const scale = rig.name === 'humanoid' ? 1 : rig.name === 'quadruped' ? 1.2 : 2;
  const pw = rig.width * scale + 60;
  const ph = rig.height * scale + 60;
  const restFace = resolveFace(character.parts, {
    emotion: 'neutral',
    overrides: {},
    talking: false,
    t: 0.06,
    phase: 0.2,
  });
  const rest = basePose(rig, 'move', 0, 0);
  rest.face = restFace;
  const drawn = (pose: Pose) => characterBody(character, pose, null);
  const swing = (sign: number): Pose => {
    const p = basePose(rig, 'move', 0, 0);
    p.face = restFace;
    p.rot = Object.fromEntries(
      Object.entries(SWING[rig.name] ?? {}).map(([part, deg]) => [part, deg * sign])
    );
    return p;
  };
  const panel = (i: number, label: string, inner: string) => {
    const x = 10 + i * (pw + 10);
    return (
      `<g transform='translate(${x} 40)'><rect width='${pw}' height='${ph + 30}' rx='10' fill='#fff' stroke='#cfd6dd'/>` +
      `<g transform='translate(30 30) scale(${scale})'>` +
      `<rect width='${rig.width}' height='${rig.height}' fill='none' stroke='#9aa5b1' stroke-dasharray='4 4' stroke-width='${1 / scale}'/>` +
      `<line x1='-20' y1='${rig.height}' x2='${rig.width + 20}' y2='${rig.height}' stroke='#e63946' stroke-width='${1.5 / scale}'/>` +
      `${inner}</g>` +
      `<text x='${pw / 2}' y='${ph + 20}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='15' fill='#555'>${escapeXml(label)}</text></g>`
    );
  };

  let parts = `<g opacity='0.45'>${drawn(rest)}</g>`;
  let pivots = '';
  const names = Object.keys(character.parts);
  // Spring parts are labelled with a ~: they swing behind the motion on their own.
  const springs = springParts(character);
  names.forEach((name, i) => {
    const color = PART_COLORS[i % PART_COLORS.length];
    const box = partBox(character, name);
    const label = springs.includes(name) ? `${name} ~` : name;
    if (box)
      parts += `<rect x='${box.x}' y='${box.y}' width='${box.w}' height='${box.h}' fill='none' stroke='${color}' stroke-width='${1.5 / scale}'/><text x='${box.x + 2}' y='${box.y - 3}' font-family='${LABEL_FONT}' font-size='${11 / scale}' fill='${color}'>${escapeXml(label)}</text>`;
    const rp = rig.parts[name];
    if (rp && !['eyes', 'mouth'].includes(name))
      pivots += `<circle cx='${rp.pivot[0]}' cy='${rp.pivot[1]}' r='${4 / scale}' fill='#fff' stroke='#111' stroke-width='${1.5 / scale}'/><circle cx='${rp.pivot[0]}' cy='${rp.pivot[1]}' r='${1.2 / scale}' fill='#111'/>`;
  });
  // Where a carried prop is held, and where this character is held when it is the prop.
  const marker = (x: number, y: number, label: string) =>
    `<path d='M${x - 6 / scale} ${y} L${x + 6 / scale} ${y} M${x} ${y - 6 / scale} L${x} ${y + 6 / scale}' stroke='#0a7' stroke-width='${2 / scale}'/><text x='${x + 7 / scale}' y='${y + 4 / scale}' font-family='${LABEL_FONT}' font-size='${11 / scale}' fill='#0a7'>${label}</text>`;
  if (character.parts[rig.hold.part] && character.parts.eyes)
    parts += marker(...rig.hold.point, 'hold');
  if (character.grip) parts += marker(...character.grip, 'grip');
  // What it keeps the rain off: a blue span with drops stopping on it.
  const shelters = character.shelter
    ? Array.isArray(character.shelter)
      ? character.shelter
      : [character.shelter]
    : [];
  for (const sh of shelters) {
    const w = 2.5 / scale;
    parts +=
      `<path d='M${sh.x} ${sh.y} L${sh.x + sh.width} ${sh.y}' stroke='#1d6fd8' stroke-width='${w}' stroke-dasharray='${6 / scale} ${3 / scale}'/>` +
      `<text x='${sh.x}' y='${sh.y - 4 / scale}' font-family='${LABEL_FONT}' font-size='${11 / scale}' fill='#1d6fd8'>shelter${sh.when ? ` (${escapeXml(sh.when)})` : ''}</text>`;
  }
  for (const m of marks)
    parts += `<rect x='${m.x - 2}' y='${m.y - 2}' width='${m.w + 4}' height='${m.h + 4}' fill='#e63946' fill-opacity='0.12' stroke='#e63946' stroke-width='${2.5 / scale}'/><circle cx='${m.x + m.w}' cy='${m.y}' r='${9 / scale}' fill='#e63946'/><text x='${m.x + m.w}' y='${m.y + 4 / scale}' text-anchor='middle' font-family='${LABEL_FONT}' font-size='${11 / scale}' font-weight='bold' fill='#fff'>${m.n}</text>`;
  parts += pivots;

  const silhouette = `<defs><filter id='tk-sil'><feFlood flood-color='#1d1b22'/><feComposite in2='SourceAlpha' operator='in'/></filter></defs><g filter='url(#tk-sil)'>${drawn(rest)}</g>`;
  const panels = [
    panel(0, 'parts, pivots, warnings', parts),
    panel(1, 'silhouette', silhouette),
    ...(SWING[rig.name]
      ? [
          panel(2, 'swing: joints stay closed?', drawn(swing(1))),
          panel(3, 'swing, other way', drawn(swing(-1))),
        ]
      : []),
  ];
  const lines = problems.length
    ? problems.map((p) => `${p.level === 'error' ? 'ERROR ' : ''}${p.message}`)
    : ['construction OK: inside the box, standing on the line, joints closed, nothing detached'];
  const W = Math.max(panels.length * (pw + 10) + 10, 900);
  const textTop = 40 + ph + 30 + 28;
  const H = textTop + lines.length * 20 + 10;
  let out = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><rect width='${W}' height='${H}' fill='#e9eef3'/>`;
  out += `<text x='12' y='26' font-family='${LABEL_FONT}' font-size='18' fill='#333'>${escapeXml(character.name)} (${character.id}) · construction · rig ${rig.name} ${rig.width}×${rig.height}${springs.length ? ` · springs ~ ${springs.join(', ')}` : ''}</text>`;
  out += panels.join('');
  lines.forEach((l, i) => {
    const text = l.length > 150 ? `${l.slice(0, 147)}…` : l;
    out += `<text x='12' y='${textTop + i * 20}' font-family='${LABEL_FONT}' font-size='13' fill='${l.startsWith('ERROR') ? '#c1121f' : '#333'}'>${escapeXml(text)}</text>`;
  });
  return out + '</svg>';
}
