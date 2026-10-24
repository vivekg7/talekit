import type { Action, Project, Shot, Voice, VoiceClip } from './types.js';

/** Samples per second of a clip's loudness envelope. */
export const ENVELOPE_RATE = 50;
/** Seconds a bubble or caption stays up after its line is spoken. */
export const LINGER = 0.5;
/** A mouth opens above this share of the line's loudest moment. */
const OPEN_AT = 0.22;

export interface VoiceSpec {
  engine: string;
  name: string;
  speed: number;
  pitch: number;
}

export function voiceSpec(v: Voice): VoiceSpec {
  const { id, speed = 1, pitch = 0 } = typeof v === 'string' ? { id: v } : v;
  const [engine, name] = id.split(':');
  return { engine, name, speed, pitch };
}

/** One spoken line: who says it, in what voice, and where it falls. */
export interface Line {
  key: string;
  voice: VoiceSpec;
  text: string;
  shot: string;
  /** Index of the action in the shot. */
  action: number;
  /** The speaker; none for the narrator. */
  actor?: string;
  style: 'speech' | 'thought' | 'shout' | 'narration' | 'title';
}

/** FNV-1a, twice with different seeds: a short, stable name for a line's audio. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193 + 2);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** The cache key of a line: the same voice saying the same words is the same audio. */
export function lineKey(voice: VoiceSpec, text: string): string {
  return hash(`${voice.engine}:${voice.name}|${voice.speed}|${voice.pitch}|${text.trim()}`);
}

/** Who speaks an action's line, if anyone does. */
function lineOf(project: Project, a: Action): Omit<Line, 'shot' | 'action'> | undefined {
  if (a.say && a.actor) {
    const v = project.characters[a.actor]?.voice;
    if (!v) return undefined;
    const voice = voiceSpec(v);
    return {
      key: lineKey(voice, a.say),
      voice,
      text: a.say,
      actor: a.actor,
      style: a.bubble ?? 'speech',
    };
  }
  if (a.caption && project.meta.narrator) {
    const voice = voiceSpec(project.meta.narrator);
    return {
      key: lineKey(voice, a.caption),
      voice,
      text: a.caption,
      style: a.captionStyle ?? 'narration',
    };
  }
  return undefined;
}

/** Every voiced line in these shots, in order. */
export function voiceLines(project: Project, shots: Shot[] = project.shots): Line[] {
  const out: Line[] = [];
  for (const shot of shots)
    shot.actions.forEach((a, action) => {
      const line = lineOf(project, a);
      if (line) out.push({ ...line, shot: shot.id, action });
    });
  return out;
}

/** The audio made for an action's line, once it has been. */
export function clipFor(project: Project, a: Action): VoiceClip | undefined {
  const line = lineOf(project, a);
  return line && project.audio?.voices[line.key];
}

/** Estimated seconds a line is up when it has no audio: about 0.4 s a word. */
export function sayDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.8, 1.0 + words * 0.4);
}

/**
 * How long a `say` bubble or a caption stays up: what the action says, else as long as its
 * audio plays and a beat more, else an estimate from the words (a caption, 3 s).
 */
export function lineDuration(project: Project | undefined, a: Action): number {
  if (a.duration) return a.duration;
  const clip = project && clipFor(project, a);
  if (clip) return clip.duration + LINGER;
  return a.say ? sayDuration(a.say) : 3;
}

/** Whether a voiced mouth is open `u` seconds into its line. */
export function mouthOpen(clip: VoiceClip, u: number): boolean {
  const i = Math.floor(u * ENVELOPE_RATE);
  if (i < 0 || i >= clip.envelope.length) return false;
  return clip.envelope[i] > OPEN_AT;
}
