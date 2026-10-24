import { clamp01, hash01 } from './easing.js';
import { footfalls, gaitPhase } from './gait.js';
import { rigOf } from './rigs.js';
import {
  actionDuration,
  attachTime,
  resolveActor,
  resolveCamera,
  resolvePosition,
} from './timeline.js';
import type {
  Character,
  Effect,
  Mix,
  Music,
  Project,
  Scene,
  Shot,
  Verb,
  Weather,
} from './types.js';
import { actionSalt, resolveSound, soundLength, type Source } from './sources.js';
import { strikeAt, WEATHER_TURN, weatherAt } from './weather.js';
import { voiceLines, type Line } from './voice.js';

/**
 * What a film sounds like, as a list of cues: which clip plays when, how loud and from
 * where. Pure, like the rest of the engine; src/render/audio.ts decodes and sums them.
 */

export type Bus = 'music' | 'ambience' | 'sfx' | 'voice';

export interface Cue {
  bus: Bus;
  src: Source;
  /** Film seconds it starts at. */
  at: number;
  /** A bed loops until this film time; a one-shot plays once, to its end. */
  until?: number;
  /** Seconds a bed takes to come in and to go out (it ends at `until`). */
  fadeIn?: number;
  fadeOut?: number;
  gain: number;
  /** A bed's loudness over film time, as [seconds, multiplier] points joined by straight lines. */
  level?: [number, number][];
  /** -1 (left) to 1 (right); a stereo bed leans that way. */
  pan: number;
  /** Seconds a one-shot plays, when known without decoding it. */
  length?: number;
  /** Treatment as it is decoded: a thought is heard as an inner voice. */
  fx?: 'thought';
  /** What it is, for the audio lane: a sound's name, a speaker. */
  label: string;
  /** The shot it starts in. */
  shot: string;
}

/**
 * Each bus's level, so a cue's own volume of 1 means "as loud as that kind of thing is".
 * Sources come in at known loudness (spoken lines at -20 LUFS, bundled music -18, ambience
 * -23, effects peaking at -1 dBFS), which puts dialogue near -17 LUFS, the music about 13 dB
 * under it and the ambience 16 dB under, before they duck under each line. Heard on a phone,
 * music 9 dB under the voices was too loud between the lines (2026-10-24).
 */
const LEVEL: Record<Bus, number> = { music: 0.24, ambience: 0.32, sfx: 0.8, voice: 1.5 };
/** The project's `mix` field names each bus. */
const MIX_KEY: Record<Bus, keyof Mix> = {
  music: 'music',
  ambience: 'ambience',
  sfx: 'effects',
  voice: 'voices',
};
/** Seconds a new track takes to come in, and the old one to go out after the cut. */
const MUSIC_IN = 0.4;
const MUSIC_OUT = 1.2;
const BED_FADE = 0.4;
/** Seconds everything takes to go at the end of the film, unless the last shot fades for longer. */
const END_FADE = 1.5;
/** How loud each kind of line is against plain speech. */
const STYLE_GAIN: Record<Line['style'], number> = {
  speech: 1,
  shout: 1.3,
  thought: 0.8,
  narration: 0.95,
  title: 0.95,
};
/** How far a sound at the frame's edge sits toward that side. */
const PAN_WIDTH = 0.6;

/** Film seconds each shot starts at. A crossfade overlaps nothing: the old shot's end shows under the new one's start. */
export function shotStarts(shots: Shot[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const s of shots) {
    out.push(at);
    at += s.duration;
  }
  return out;
}

function musicOf(project: Project, shot: Shot): { track: string; volume: number } | undefined {
  const m: Music | undefined = shot.music ?? project.meta.music;
  if (!m) return undefined;
  return typeof m === 'string' ? { track: m, volume: 1 } : m;
}

/** A stage x heard from the screen: left of frame is left. */
function panAt(project: Project, scene: Scene, shot: Shot, x: number, t: number): number {
  const cam = resolveCamera(project, scene, shot, t);
  const { width } = project.meta;
  const screen = (x - cam.x) * cam.zoom + width / 2;
  return Math.max(-1, Math.min(1, (screen / width - 0.5) * 2)) * PAN_WIDTH;
}

/** Where an actor is heard from at shot time t: its x on screen, as a pan. */
function panOf(project: Project, shot: Shot, actor: string | undefined, t: number): number {
  const scene = project.scenes[shot.scene];
  if (!actor || !shot.cast[actor] || !scene || !project.characters[actor]) return 0;
  const a = resolveActor(project, scene, shot, actor, t, 1);
  return panAt(project, scene, shot, a.x, t);
}

/** A looping bed in one shot, with its loudness over the shot's clock (a multiplier). */
interface Bed {
  name: string;
  pan: number;
  level: [number, number][];
}

/** Rain heard as a patter up to a steady rain, then a downpour, each fading into the other. */
const rainLight = (a: number) => (a < 0.45 ? a / 0.45 : Math.max(0, 1 - (a - 0.45) / 0.3));
const rainHeavy = (a: number) => clamp01((a - 0.3) / 0.6);
const windLevel = (w: number) => clamp01((Math.abs(w) - 0.15) / 0.75);

/** Beds an effect is heard as, and how loud; smoke and the sun are silent. */
const EFFECT_BED: Partial<Record<Effect['kind'], (e: Effect) => [string, number]>> = {
  fire: (e) => ['fire', Math.min(1.3, 0.6 + 0.4 * e.size)],
  waterfall: () => ['waterfall', 1],
  waves: () => ['sea', 1],
};

/**
 * What a shot's place sounds like: the scene's ambience, its weather (rain, wind, changing
 * as the weather turns) and its effects (a fire crackling where it burns).
 */
function bedsOf(project: Project, shot: Shot): Bed[] {
  const scene = project.scenes[shot.scene];
  if (!scene) return [];
  const out: Bed[] = [];
  for (const b of scene.ambience)
    typeof b === 'string'
      ? out.push({ name: b, pan: 0, level: [[0, 1]] })
      : out.push({ name: b.sound, pan: 0, level: [[0, b.volume]] });

  // The weather where it changes: before, through and after each turn.
  const times = new Set([0, shot.duration]);
  for (const a of shot.actions.filter((a) => a.weather)) {
    const d = a.duration ?? WEATHER_TURN;
    for (let k = 0; k <= 4; k++) times.add(Math.min(shot.duration, a.t + (k / 4) * d));
  }
  const at = [...times].sort((a, b) => a - b).map((t) => [t, weatherAt(scene, shot, t)] as const);
  const weatherBed = (name: string, level: (w: Weather) => number) => {
    const points = at.map(([t, w]) => [t, level(w)] as [number, number]);
    if (points.some(([, g]) => g > 0.01)) out.push({ name, pan: 0, level: points });
  };
  weatherBed('rain-light', (w) => (w.rain ? rainLight(w.rain.amount) : 0));
  weatherBed('rain-heavy', (w) => (w.rain ? rainHeavy(w.rain.amount) : 0));
  weatherBed('wind', (w) => windLevel(w.wind ?? 0));

  const { width } = project.meta;
  for (const e of scene.effects) {
    const bed = EFFECT_BED[e.kind]?.(e);
    if (!bed) continue;
    const x = e.x ?? width / 2;
    out.push({ name: bed[0], pan: ((x / width - 0.5) * 2 * PAN_WIDTH) / 2, level: [[0, bed[1]]] });
  }
  return out;
}

/** The step a rig's feet make (a person's on grass is softer); a simple-rig thing hops or flies and is not heard. */
const STEP: Partial<Record<Character['rig'], string>> = {
  humanoid: 'step-shoe',
  quadruped: 'step-paw',
};
/** Footsteps sit under everything else: a person of the default height walking at 1. */
const STEP_GAIN = 0.3;
/** Samples a second when finding where feet land. */
const STEP_RATE = 60;

/** A footstep each time a walking or running foot comes down, from the gait itself. */
function footsteps(project: Project, shot: Shot, at0: number): Cue[] {
  const scene = project.scenes[shot.scene];
  if (!scene) return [];
  const out: Cue[] = [];
  for (const id of Object.keys(shot.cast)) {
    const ch = project.characters[id];
    const name =
      ch && (ch.rig === 'humanoid' && scene.surface === 'grass' ? 'step-grass' : STEP[ch.rig]);
    if (!name) continue;
    if (!shot.actions.some((a) => a.actor === id && (a.do === 'walk' || a.do === 'run'))) continue;
    const rig = rigOf(ch);
    let prev: { loco: string; phase: number; t: number } | undefined;
    let n = 0;
    for (let f = 0; f <= shot.duration * STEP_RATE; f++) {
      const t = f / STEP_RATE;
      const s = resolveActor(project, scene, shot, id, t, 1);
      const loco = s.locomotion;
      const phase =
        (loco === 'walk' || loco === 'run') && s.travel && s.visible
          ? gaitPhase(rig, loco, s.travel)
          : undefined;
      if (phase === undefined || loco === 'idle') {
        prev = undefined;
        continue;
      }
      if (prev && prev.loco === loco && phase > prev.phase)
        for (const land of footfalls(rig, loco as 'walk' | 'run'))
          for (let c = Math.ceil(prev.phase - land); c + land <= phase; c++) {
            if (c + land <= prev.phase) continue;
            const tt = prev.t + ((c + land - prev.phase) / (phase - prev.phase)) * (t - prev.t);
            const src = resolveSound(project, name, `${shot.id}:${id}:${n++}`);
            if (!src) continue;
            const size = Math.max(0.3, Math.min(1.3, (ch.height * s.scale) / 220));
            out.push({
              bus: 'sfx',
              src,
              at: at0 + tt,
              length: soundLength(src),
              gain: LEVEL.sfx * STEP_GAIN * size * (loco === 'run' ? 1.4 : 1),
              pan: panAt(project, scene, shot, s.x, tt),
              label: name,
              shot: shot.id,
            });
          }
      prev = { loco, phase, t };
    }
  }
  return out;
}

/** Sounds some verbs make on their own: a whoosh into a jump, a sparkle as something appears. */
const VERB_SOUND: Partial<Record<Verb, [string, number]>> = {
  jump: ['whoosh', 0.3],
  spin: ['whoosh', 0.35],
  appear: ['sparkle', 0.5],
  disappear: ['sparkle', 0.5],
};

function verbSounds(project: Project, shot: Shot, at0: number): Cue[] {
  const scene = project.scenes[shot.scene];
  if (!scene) return [];
  const out: Cue[] = [];
  const push = (name: string, t: number, gain: number, actor: string | undefined, salt: string) => {
    const src = resolveSound(project, name, `${shot.id}:${salt}`);
    if (!src || t > shot.duration) return;
    out.push({
      bus: 'sfx',
      src,
      at: at0 + t,
      length: soundLength(src),
      gain: LEVEL.sfx * gain,
      pan: panOf(project, shot, actor, t),
      label: name,
      shot: shot.id,
    });
  };
  shot.actions.forEach((a, k) => {
    if (!a.actor || !shot.cast[a.actor] || !project.characters[a.actor]) return;
    if (
      a.do &&
      VERB_SOUND[a.do] &&
      !(a.do === 'jump' && project.characters[a.actor].rig === 'simple')
    ) {
      const [name, gain] = VERB_SOUND[a.do]!;
      push(name, a.t, gain, a.actor, `${k}`);
    }
    if (a.do === 'jump') {
      // The landing, where the jump comes down.
      const from = resolveActor(project, scene, shot, a.actor, a.t, 1);
      const to = a.to ? resolvePosition(project, scene, a.to) : from;
      const size = (project.characters[a.actor].height * from.scale) / 220;
      push(
        'land',
        a.t + actionDuration(a, from, to),
        0.5 * Math.min(1.3, size),
        a.actor,
        `${k}:land`
      );
    }
    // A prop picked up or set down: a tap as it leaves or meets the floor.
    if ((a.do === 'pickup' || a.do === 'putdown') && a.attach !== undefined)
      push('tap', attachTime(a), 0.45, a.actor, `${k}:tap`);
  });
  return out;
}

/** Thunder after each strike: close behind a `lightning` action, further off for the weather's own. */
function thunder(project: Project, shot: Shot, at0: number): Cue[] {
  const scene = project.scenes[shot.scene];
  if (!scene) return [];
  const strikes: { t: number; near: boolean; salt: string }[] = shot.actions
    .filter((a) => a.lightning)
    .map((a, k) => ({ t: a.t + 0.25, near: true, salt: `a${k}` }));
  for (let i = 0; ; i++) {
    const every = weatherAt(scene, shot, i * 8).lightning?.every ?? 8;
    const ts = strikeAt(shot.id, every, i);
    if (ts >= shot.duration) break;
    if (weatherAt(scene, shot, ts).lightning)
      strikes.push({
        t: ts + 0.6 + 1.4 * hash01(`${shot.id}:thunder:${i}`),
        near: false,
        salt: `w${i}`,
      });
  }
  const out: Cue[] = [];
  for (const s of strikes) {
    const name = s.near ? 'thunder-near' : 'thunder-far';
    const src = resolveSound(project, name, `${shot.id}:${s.salt}`);
    if (src)
      out.push({
        bus: 'sfx',
        src,
        at: at0 + s.t,
        length: soundLength(src),
        gain: LEVEL.sfx * (s.near ? 1 : 0.7),
        pan: 0,
        label: name,
        shot: shot.id,
      });
  }
  return out;
}

/** Every cue in these shots, played one after another. Names that resolve to nothing are left out (the validator reports them). */
export function cueSheet(project: Project, shots: Shot[] = project.shots): Cue[] {
  const starts = shotStarts(shots);
  const end = starts.length ? starts.at(-1)! + shots.at(-1)!.duration : 0;
  const endFade = Math.max(END_FADE, shots.at(-1)?.fadeOut ?? 0);
  const cues: Cue[] = [];

  // Music: a run of shots with the same track is one cue, so it plays on across the cuts.
  for (let i = 0; i < shots.length;) {
    const m = musicOf(project, shots[i]);
    let j = i + 1;
    while (
      j < shots.length &&
      musicOf(project, shots[j])?.track === m?.track &&
      musicOf(project, shots[j])?.volume === m?.volume
    )
      j++;
    const src = m && resolveSound(project, m.track, shots[i].id);
    if (m && src) {
      const last = j === shots.length;
      cues.push({
        bus: 'music',
        src,
        at: starts[i],
        until: last ? end : starts[j] + MUSIC_OUT,
        fadeIn: MUSIC_IN,
        fadeOut: last ? endFade : MUSIC_OUT,
        gain: LEVEL.music * m.volume,
        pan: 0,
        label: m.track,
        shot: shots[i].id,
      });
    }
    i = j;
  }

  // Beds: each plays on across the run of shots that have it, its level following the
  // weather inside each.
  const open = new Map<string, { i: number; bed: Bed; level: [number, number][] }>();
  const close = (key: string, j: number) => {
    const { i, bed, level } = open.get(key)!;
    open.delete(key);
    const src = resolveSound(project, bed.name, shots[i].id);
    if (!src) return;
    const last = j === shots.length;
    cues.push({
      bus: 'ambience',
      src,
      at: starts[i],
      until: last ? end : starts[j] + BED_FADE,
      fadeIn: BED_FADE,
      fadeOut: last ? endFade : BED_FADE,
      gain: LEVEL.ambience,
      level,
      pan: bed.pan,
      label: bed.name,
      shot: shots[i].id,
    });
  };
  shots.forEach((shot, i) => {
    const beds = new Map(bedsOf(project, shot).map((b) => [`${b.name}@${b.pan.toFixed(2)}`, b]));
    for (const key of [...open.keys()]) if (!beds.has(key)) close(key, i);
    for (const [key, bed] of beds) {
      const points = bed.level.map(([t, g]) => [starts[i] + t, g] as [number, number]);
      const run = open.get(key);
      if (run) run.level.push(...points);
      else open.set(key, { i, bed, level: points });
    }
  });
  for (const key of [...open.keys()]) close(key, shots.length);

  shots.forEach((shot, i) => {
    // One-off sounds from actions.
    shot.actions.forEach((a) => {
      if (!a.sound) return;
      const src = resolveSound(project, a.sound, actionSalt(shot, a));
      if (!src) return;
      cues.push({
        bus: 'sfx',
        src,
        at: starts[i] + a.t,
        length: soundLength(src),
        gain: LEVEL.sfx * (a.volume ?? 1),
        pan: panOf(project, shot, a.actor, a.t),
        label: a.sound,
        shot: shot.id,
      });
    });
    cues.push(
      ...footsteps(project, shot, starts[i]),
      ...verbSounds(project, shot, starts[i]),
      ...thunder(project, shot, starts[i])
    );
  });

  // Spoken lines that have their audio; a thought is heard from inside, not from a place.
  const index = new Map(shots.map((s, i) => [s.id, i]));
  for (const line of voiceLines(project, shots)) {
    const clip = project.audio?.voices[line.key];
    if (!clip) continue;
    const i = index.get(line.shot)!;
    const a = shots[i].actions[line.action];
    cues.push({
      bus: 'voice',
      src: { voice: clip.file },
      at: starts[i] + a.t + line.lead,
      length: clip.duration,
      fx: line.style === 'thought' ? 'thought' : undefined,
      gain: LEVEL.voice * STYLE_GAIN[line.style],
      pan: line.style === 'thought' ? 0 : panOf(project, shots[i], line.actor, a.t),
      label: line.actor ?? 'narrator',
      shot: line.shot,
    });
  }

  // The project's own balance, on top of the levels above.
  const mix = project.meta.mix;
  if (mix) for (const c of cues) c.gain *= mix[MIX_KEY[c.bus]] ?? 1;

  return cues.sort((x, y) => x.at - y.at);
}
