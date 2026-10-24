import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cueSheet } from '../src/engine/sound.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { clipFor, lineDuration, LINGER, mouthOpen } from '../src/engine/voice.js';
import { validateProject, validateShot } from '../src/project/validate.js';
import { makeVoices } from '../src/project/voices.js';
import { mixAudio, RATE } from '../src/render/audio.js';

/** A project with a few clips of its own in audio/, made with ffmpeg. */
const dir = mkdtempSync(path.join(os.tmpdir(), 'talekit-sound-'));
const make = (name: string, args: string[]) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, path.join(dir, name)]);
make('tune.wav', ['-f', 'lavfi', '-i', 'sine=f=220:d=2', '-ac', '2']);
make('birds.wav', ['-f', 'lavfi', '-i', 'sine=f=440:d=1', '-ac', '2']);
make('ping.wav', ['-f', 'lavfi', '-i', 'sine=f=880:d=0.2']);
const audio = {
  dir,
  files: { tune: 'tune.wav', birds: 'birds.wav', ping: 'ping.wav' },
  voices: {},
};

function project(shots: unknown[], music?: unknown): Project {
  const park = SceneSchema.parse({ ...LIBRARY.scenes.park, ambience: ['birds'] });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif', music } as never,
    characters: { kid: LIBRARY.characters.kid },
    // Home is quiet here, so a shot in it has nothing to hear unless asked.
    scenes: { park, home: SceneSchema.parse({ ...LIBRARY.scenes.home, ambience: [] }) },
    shots: shots.map((s) => ShotSchema.parse(s)),
    audio,
  };
}

const shot = (id: string, extra: object = {}) => ({ id, scene: 'park', duration: 2, ...extra });

describe('cue sheet', () => {
  it('plays one track across the cuts until a shot changes it', () => {
    const p = project(
      [shot('a'), shot('b'), shot('c', { music: false }), shot('d', { music: 'ping' })],
      'tune'
    );
    const music = cueSheet(p).filter((c) => c.bus === 'music');
    expect(music.map((c) => [c.label, c.at])).toEqual([
      ['tune', 0],
      ['ping', 6],
    ]);
    // The old track goes out after the cut, not before it.
    expect(music[0].until).toBeGreaterThan(4);
    expect(music[1].until).toBe(8);
  });

  it("carries a scene's ambience across cuts between shots in it", () => {
    const p = project([shot('a'), shot('b'), shot('c', { scene: 'home' }), shot('d')]);
    const beds = cueSheet(p).filter((c) => c.label === 'birds');
    expect(beds.map((c) => c.at)).toEqual([0, 6]);
  });

  it('hears a sound from where its actor stands', () => {
    const p = project([
      shot('a', {
        cast: { kid: { at: { x: 150, y: 650 } } },
        actions: [
          { t: 0.5, actor: 'kid', sound: 'ping' },
          { t: 1, sound: 'ping', volume: 0.5 },
        ],
      }),
    ]);
    const [left, centre] = cueSheet(p).filter((c) => c.bus === 'sfx');
    expect(left.pan).toBeLessThan(-0.3);
    expect(centre.pan).toBe(0);
    expect(centre.gain).toBeCloseTo(left.gain / 2);
  });

  it('hears footsteps as feet land, rain as hard as it falls and thunder after a strike', () => {
    const p = project([
      shot('a', {
        duration: 6,
        weather: { rain: { amount: 1 } },
        cast: { kid: { at: { x: 200, y: 650 } } },
        actions: [
          { t: 0.5, actor: 'kid', do: 'walk', to: { x: 900, y: 650 } },
          { t: 3, weather: { rain: { amount: 0.2 } }, duration: 2 },
          { t: 4, lightning: true },
        ],
      }),
    ]);
    p.audio = {
      ...audio,
      files: {
        ...audio.files,
        'step-grass': 'ping.wav',
        'rain-light': 'birds.wav',
        'rain-heavy': 'birds.wav',
        'thunder-near': 'ping.wav',
      },
    };
    const cues = cueSheet(p);
    // The park is grass underfoot.
    const steps = cues.filter((c) => c.label === 'step-grass');
    expect(steps.length).toBeGreaterThan(4);
    // Evenly paced, and heard moving from left to right with the walker.
    const gaps = steps.slice(1).map((c, i) => c.at - steps[i].at);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.15);
    expect(steps.at(-1)!.pan).toBeGreaterThan(steps[0].pan);
    // The downpour eases off as the weather turns, and the light rain takes over.
    const level = (name: string, t: number) => {
      const pts = cues.find((c) => c.label === name)!.level!;
      return pts.filter(([at]) => at <= t).at(-1)![1];
    };
    expect(level('rain-heavy', 1)).toBeGreaterThan(0.9);
    expect(level('rain-heavy', 5.5)).toBe(0);
    expect(level('rain-light', 5.5)).toBeGreaterThan(0.3);
    expect(cues.find((c) => c.label === 'thunder-near')!.at).toBeCloseTo(4.25);
  });

  it('reports a sound it cannot find', () => {
    const p = project([shot('a', { actions: [{ t: 0, sound: 'nope' }], music: 'gone' })]);
    const messages = validateProject(p).map((m) => m.message);
    expect(messages.join('\n')).toMatch(/unknown sound 'nope'/);
    expect(messages.join('\n')).toMatch(/music: unknown sound 'gone'/);
  });
});

describe('mix', () => {
  it('is silent, with no track at all, when nothing sounds', async () => {
    const p = project([{ id: 'a', scene: 'home', duration: 2 }]);
    expect(await mixAudio(p)).toBeUndefined();
  });

  it('is exactly as long as the film, the same every time, and loops a bed without a jump', async () => {
    const p = project([shot('a', { actions: [{ t: 1, sound: 'ping' }] }), shot('b')], 'tune');
    const a = (await mixAudio(p, p.shots, { seconds: 4 }))!;
    const b = (await mixAudio(p, p.shots, { seconds: 4 }))!;
    expect(a.length).toBe(4 * RATE * 2);
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
    // The 1 s birds bed loops three times; a sine with a seam would step between samples.
    let jump = 0;
    for (let i = 2 * RATE; i < 3.5 * RATE; i++)
      jump = Math.max(jump, Math.abs(a[2 * i] - a[2 * i - 2]));
    expect(jump).toBeLessThan(0.05);
    // Faded in from nothing.
    expect(Math.abs(a[0])).toBeLessThan(1e-3);
  });
});

describe('voices', () => {
  const root = () => {
    const r = mkdtempSync(path.join(os.tmpdir(), 'talekit-voice-'));
    mkdirSync(path.join(r, 'audio'));
    return r;
  };
  const fake = `node ${path.resolve('test/fixtures/fake-tts.mjs')}`;
  const voiced = (shots: unknown[], audioDir: string): Project => ({
    ...project(shots),
    characters: { kid: { ...LIBRARY.characters.kid, voice: { id: 'kokoro:af_sky', pitch: 3 } } },
    meta: { ...project([]).meta, narrator: 'kokoro:bf_emma' },
    audio: { dir: audioDir, files: {}, voices: {} },
  });

  it('speaks each line once, times the bubble by it and opens the mouth on the sound', async () => {
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = voiced(
        [
          shot('a', {
            duration: 2.2,
            cast: { kid: { at: 'center' } },
            actions: [
              { t: 0, caption: 'Once upon a time' },
              { t: 0.5, actor: 'kid', say: 'one two three four five six' },
              { t: 2, actor: 'kid', say: 'please fail' },
            ],
          }),
        ],
        path.join(r, 'audio')
      );
      const report = await makeVoices(r, p);
      expect(report.made).toBe(2);
      expect(report.failed.map((f) => f.error)).toEqual(['could not say it']);
      // Six words at a third of a second each, and half a second more on screen.
      const say = p.shots[0].actions[1];
      expect(clipFor(p, say)!.duration).toBeCloseTo(2, 1);
      expect(lineDuration(p, say)).toBeCloseTo(2 + LINGER, 1);
      expect(mouthOpen(clipFor(p, say)!, 1)).toBe(true);
      expect(mouthOpen(clipFor(p, say)!, 2.3)).toBe(false);
      // Spoken again, nothing is made twice.
      expect((await makeVoices(r, p)).made).toBe(0);
      // The line runs past the shot's end.
      const messages = validateShot(p.shots[0], p).map((m) => m.message);
      expect(messages.join('\n')).toMatch(/cut off/);
      expect(
        cueSheet(p)
          .filter((c) => c.bus === 'voice')
          .map((c) => c.label)
      ).toEqual(['narrator', 'kid']);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });

  it('warns when an English voice would read Devanagari', () => {
    const p = voiced(
      [
        shot('a', {
          cast: { kid: { at: 'center' } },
          actions: [{ t: 0, actor: 'kid', say: 'नमस्ते' }],
        }),
      ],
      dir
    );
    expect(
      validateShot(p.shots[0], p)
        .map((m) => m.message)
        .join('\n')
    ).toMatch(/Hindi voice/);
  });
});
