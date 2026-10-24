import { actionSalt, resolveSound, soundLength } from './sources.js';
import type { Action, Emotion, Project, Shot, Voice, VoiceClip } from './types.js';

/** Samples per second of a clip's loudness envelope. */
export const ENVELOPE_RATE = 50;
/** Seconds a bubble or caption stays up after its line is spoken. */
export const LINGER = 0.5;
/** A mouth opens above this share of the line's loudest moment. */
const OPEN_AT = 0.22;
/**
 * Longest a line's voice waits for the sound it opens with: a long recording (a growl that
 * rumbles on) tails off under the first words rather than holding them back.
 */
const MAX_LEAD = 2;

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

/**
 * A line as the bubble or caption shows it. Text between asterisks is a sound, not words
 * (`*गुर्रर!* कौन है?`): it is shown without the asterisks and never spoken.
 */
export function shownText(text: string): string {
  return text.replace(/\*([^*]*)\*/g, '$1');
}

/** What the voice says: the line without its *marked* sounds; empty when nothing is left to say. */
export function spokenText(text: string): string {
  const words = text
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s!?,.;:।…-]+/, '')
    .trim();
  return /\p{L}/u.test(words) ? words : '';
}

/** One spoken line: who says it, in what voice and mood, and where it falls. */
export interface Line {
  key: string;
  voice: VoiceSpec;
  /** The words, without the marked sounds. */
  text: string;
  shot: string;
  /** Index of the action in the shot. */
  action: number;
  /** The speaker; none for the narrator. */
  actor?: string;
  style: 'speech' | 'thought' | 'shout' | 'narration' | 'title';
  /** How the speaker feels as they say it: their emotion then, so face and voice agree. */
  emotion: Emotion;
  /** Seconds after the action's t that the voice starts (a growl first, then the words). */
  lead: number;
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

/**
 * The cache key of a line: the same voice saying the same words in the same way is the
 * same audio.
 */
export function lineKey(
  voice: VoiceSpec,
  text: string,
  style: Line['style'],
  emotion: Emotion
): string {
  return hash(
    `${voice.engine}:${voice.name}|${voice.speed}|${voice.pitch}|${style}|${emotion}|${text.trim()}`
  );
}

/** An actor's emotion at shot time t: the last one set by then, else the one it starts with. */
function emotionAt(shot: Shot, actor: string, t: number): Emotion {
  let at = -Infinity;
  let emotion = shot.cast[actor]?.emotion ?? 'neutral';
  for (const a of shot.actions)
    if (a.actor === actor && a.emotion && a.t <= t && a.t >= at) {
      at = a.t;
      emotion = a.emotion;
    }
  return emotion;
}

/**
 * Seconds a line's voice waits after its action's t: a line that opens with a marked sound
 * (`*गुर्रर!* …`) and plays a bundled `sound` speaks once the sound is over, or after
 * MAX_LEAD.
 */
export function lineLead(project: Project, shot: Shot, a: Action): number {
  const text = a.say ?? a.caption;
  if (!text || !a.sound || !/^\s*\*/.test(text)) return 0;
  const src = resolveSound(project, a.sound, actionSalt(shot, a));
  return Math.min(MAX_LEAD, (src && soundLength(src)) ?? 0);
}

/** Who speaks an action's line, if anyone does. */
function lineOf(
  project: Project,
  shot: Shot,
  a: Action
): Omit<Line, 'shot' | 'action'> | undefined {
  if (a.say && a.actor) {
    const v = project.characters[a.actor]?.voice;
    const text = spokenText(a.say);
    if (!v || !text) return undefined;
    const voice = voiceSpec(v);
    const style = a.bubble ?? 'speech';
    const emotion = emotionAt(shot, a.actor, a.t);
    return {
      key: lineKey(voice, text, style, emotion),
      voice,
      text,
      actor: a.actor,
      style,
      emotion,
      lead: lineLead(project, shot, a),
    };
  }
  if (a.caption && project.meta.narrator) {
    const voice = voiceSpec(project.meta.narrator);
    const text = spokenText(a.caption);
    if (!text) return undefined;
    const style = a.captionStyle ?? 'narration';
    return {
      key: lineKey(voice, text, style, 'neutral'),
      voice,
      text,
      style,
      emotion: 'neutral',
      lead: lineLead(project, shot, a),
    };
  }
  return undefined;
}

/** Every voiced line in these shots, in order. */
export function voiceLines(project: Project, shots: Shot[] = project.shots): Line[] {
  const out: Line[] = [];
  for (const shot of shots)
    shot.actions.forEach((a, action) => {
      const line = lineOf(project, shot, a);
      if (line) out.push({ ...line, shot: shot.id, action });
    });
  return out;
}

/** The audio made for an action's line, once it has been. */
export function clipFor(project: Project, shot: Shot, a: Action): VoiceClip | undefined {
  const line = lineOf(project, shot, a);
  return line && project.audio?.voices[line.key];
}

/** Estimated seconds a line is up when it has no audio: about 0.4 s a word. */
export function sayDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.8, 1.0 + words * 0.4);
}

/**
 * How long a `say` bubble or a caption stays up: as long as its sound and audio play and a
 * beat more (or the action's `duration`, if that is longer: a voice is never cut short),
 * else what the action says, else an estimate from the words (a caption, 3 s).
 */
export function lineDuration(project: Project, shot: Shot, a: Action): number {
  const lead = lineLead(project, shot, a);
  const clip = clipFor(project, shot, a);
  if (clip) return Math.max(a.duration ?? 0, lead + clip.duration + LINGER);
  if (a.duration) return a.duration;
  const text = a.say ?? a.caption ?? '';
  if (lead && !spokenText(text)) return lead + LINGER;
  return lead + (a.say ? sayDuration(shownText(a.say)) : 3);
}

/** Whether a voiced mouth is open `u` seconds into its line. */
export function mouthOpen(clip: VoiceClip, u: number): boolean {
  const i = Math.floor(u * ENVELOPE_RATE);
  if (i < 0 || i >= clip.envelope.length) return false;
  return clip.envelope[i] > OPEN_AT;
}
