import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cueSheet } from '../src/engine/sound.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import {
  clipFor,
  lineDuration,
  LINGER,
  mouthOpen,
  shownText,
  spokenText,
  voiceLines,
} from '../src/engine/voice.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { SOUNDS } from '../src/library/sounds.js';
import { validateProject, validateShot, voiceProblems } from '../src/project/validate.js';
import { makeVoices } from '../src/project/voices.js';
import { mixAudio, RATE } from '../src/render/audio.js';
import { writeMkv } from '../src/render/mkv.js';
import { assScript, subtitleLanguages, subtitles } from '../src/engine/subtitles.js';

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

  it("sets each layer's volume by the project's mix, and only that layer's", () => {
    const shots = [shot('a', { actions: [{ t: 0.5, sound: 'ping' }] })];
    const plain = cueSheet(project(shots, 'tune'));
    const p = project(shots, 'tune');
    p.meta.mix = { music: 0.5, effects: 0 };
    const mixed = cueSheet(p);
    const gain = (cues: typeof plain, bus: string) => cues.find((c) => c.bus === bus)!.gain;
    expect(gain(mixed, 'music')).toBeCloseTo(gain(plain, 'music') / 2);
    expect(gain(mixed, 'sfx')).toBe(0);
    expect(gain(mixed, 'ambience')).toBe(gain(plain, 'ambience'));
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
      expect(clipFor(p, p.shots[0], say)!.duration).toBeCloseTo(2, 1);
      expect(lineDuration(p, p.shots[0], say)).toBeCloseTo(2 + LINGER, 1);
      expect(mouthOpen(clipFor(p, p.shots[0], say)!, 1)).toBe(true);
      expect(mouthOpen(clipFor(p, p.shots[0], say)!, 2.3)).toBe(false);
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

  it('knows every voice in both engines, and no other', () => {
    expect(voiceProblems('c', 'chatterbox:hm_omega')).toEqual([]);
    expect(voiceProblems('c', { id: 'kokoro:hm_omega', pitch: -3 })).toEqual([]);
    expect(voiceProblems('c', 'chatterbox:nobody')[0].message).toMatch(/not one list_voices/);
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

  it('speaks the words of a line and not the sounds marked in it, after the sound plays', async () => {
    expect(shownText('*Grrr!* Who is there?')).toBe('Grrr! Who is there?');
    expect(spokenText('*Grrr!* Who is there?')).toBe('Who is there?');
    expect(spokenText('*हि हि!*')).toBe('');
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = voiced(
        [
          shot('a', {
            duration: 9,
            cast: { kid: { at: 'center' } },
            actions: [
              { t: 1, actor: 'kid', say: '*Grrr!* who is there', sound: 'lion-growl' },
              { t: 8, actor: 'kid', say: '*hee hee*', sound: 'laugh-child' },
            ],
          }),
        ],
        path.join(r, 'audio')
      );
      const lines = voiceLines(p);
      // The giggle alone has no words, so it is heard only as its sound.
      expect(lines.map((l) => l.text)).toEqual(['who is there']);
      // A growl longer than two seconds rumbles on under the first words.
      expect(SOUNDS['lion-growl'].duration).toBeGreaterThan(2);
      const growl = 2;
      expect(lines[0].lead).toBeCloseTo(growl, 5);
      await makeVoices(r, p);
      const voice = cueSheet(p).find((c) => c.bus === 'voice')!;
      expect(voice.at).toBeCloseTo(1 + growl, 5);
      const say = p.shots[0].actions[0];
      expect(lineDuration(p, p.shots[0], say)).toBeCloseTo(growl + 1 + LINGER, 1);
      // A duration written for the bubble never cuts its voice short.
      expect(lineDuration(p, p.shots[0], { ...say, duration: 1 })).toBeCloseTo(
        growl + 1 + LINGER,
        1
      );
      // The bubble shows the growl, and the mouth is open through it.
      const kid = resolveFrame(p, p.shots[0], 1.5).actors.find((a) => a.id === 'kid')!;
      expect(kid.bubble?.text).toBe('Grrr! who is there');
      expect(kid.mouth).toBe(true);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });

  it('warns about sounds written out as words, and marked sounds nobody hears', () => {
    const p = voiced(
      [
        shot('a', {
          duration: 20,
          cast: { kid: { at: 'center' } },
          actions: [
            { t: 0, actor: 'kid', say: 'Grrr! Who is there?' },
            { t: 3, actor: 'kid', say: 'हा हा हा! तुम?' },
            { t: 6, actor: 'kid', say: 'जल्दी जल्दी चलो!' },
            { t: 9, actor: 'kid', say: '*हि हि!* चलो' },
          ],
        }),
      ],
      dir
    );
    const messages = validateShot(p.shots[0], p).map((m) => m.message);
    expect(messages.filter((m) => /is a sound/.test(m)).map((m) => m.slice(0, 9))).toEqual([
      'action 0:',
      'action 1:',
    ]);
    expect(messages.join('\n')).toMatch(/action 3: the marked sound .* nothing is heard/);
  });

  it('gives each line the emotion its speaker has as they say it', () => {
    const p = voiced(
      [
        shot('a', {
          duration: 8,
          cast: { kid: { at: 'center' } },
          actions: [
            { t: 0, actor: 'kid', say: 'hello' },
            { t: 2, actor: 'kid', emotion: 'angry', say: 'go away' },
            { t: 4, actor: 'kid', say: 'hello' },
          ],
        }),
      ],
      dir
    );
    const lines = voiceLines(p);
    expect(lines.map((l) => l.emotion)).toEqual(['neutral', 'angry', 'angry']);
    // The same words said angrily are another recording.
    expect(lines[0].key).not.toBe(lines[2].key);
  });

  it('warns when the narrator and a character talk over each other', async () => {
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = voiced(
        [
          shot('a', {
            duration: 6,
            cast: { kid: { at: 'center' } },
            actions: [
              { t: 0, caption: 'one two three four five six' },
              { t: 1, actor: 'kid', say: 'hello there' },
              { t: 4, actor: 'kid', say: 'bye' },
            ],
          }),
        ],
        path.join(r, 'audio')
      );
      await makeVoices(r, p);
      const over = validateShot(p.shots[0], p)
        .map((m) => m.message)
        .filter((m) => /talk over each other/.test(m));
      expect(over).toHaveLength(1);
      expect(over[0]).toMatch(/^action 1: kid starts speaking at 1\.0s while the narrator/);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });

  // A narrator's caption, then a line in Hindi with its English, and one without.
  const bilingual = (r: string) =>
    voiced(
      [
        shot('a', {
          duration: 6,
          cast: { kid: { at: 'center' } },
          actions: [
            { t: 0, caption: 'एक दिन', translation: { en: 'One day' } },
            {
              t: 2.5,
              actor: 'kid',
              say: '*हि हि!* चलो!',
              translation: { en: "*Hee hee!* Let's go!" },
            },
            { t: 4.5, actor: 'kid', say: 'अरे वाह, कितना सुंदर दिन है' },
          ],
        }),
      ],
      path.join(r, 'audio')
    );

  it('subtitles every line in its own language and in the ones it is translated into', async () => {
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = bilingual(r);
      await makeVoices(r, p);
      expect(subtitleLanguages(p)).toEqual(['hi', 'en']);
      const hi = subtitles(p, 'hi');
      expect(hi.map((s) => s.text)).toEqual([
        'एक दिन',
        'हि हि! चलो!',
        'अरे वाह, कितना सुंदर दिन है',
      ]);
      // Up as long as its bubble, and cut off with the shot.
      const [, line, last] = hi;
      expect(line.start).toBe(2.5);
      expect(line.end).toBeCloseTo(2.5 + lineDuration(p, p.shots[0], p.shots[0].actions[1]), 5);
      expect(last.end).toBe(6);
      // The narration's own subtitle sits at the top, over its caption, and so does a line
      // spoken while the caption is still up.
      const caption = 0 + lineDuration(p, p.shots[0], p.shots[0].actions[0]);
      expect(hi.map((s) => s.top)).toEqual([true, caption > 2.5, false]);
      expect(subtitles(p, 'en').map((s) => s.text)).toEqual(['One day', "Hee hee! Let's go!"]);
      // The untranslated line is a gap in the English, and the check says so.
      const gaps = validateProject(p).filter((m) => /translation/.test(m.message));
      expect(gaps.map((m) => m.message)).toEqual([
        "1 of 3 lines have no 'en' translation, so the en subtitles skip them: 'a' action 2",
      ]);
      const ass = assScript(p, subtitles(p, 'en'));
      expect(ass).toMatch(/PlayResY: 720/);
      expect(ass).toMatch(/^Dialogue: 0,0:00:00\.00,.*,Top,,0,0,0,,One\{\\fsp4\} \{\\fsp0\}day$/m);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });

  it('mixes the film again without the dialogue, and with only the narrator', async () => {
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = bilingual(r);
      await makeVoices(r, p);
      // Nothing else sounds in home: what is left is the voices.
      p.shots[0].scene = 'home';
      expect(await mixAudio(p, p.shots, { voices: 'none' })).toBeUndefined();
      const narrator = (await mixAudio(p, p.shots, { voices: 'narrator' }))!;
      const full = (await mixAudio(p, p.shots))!;
      const loud = (m: Float32Array, a: number, b: number) => {
        let peak = 0;
        for (let i = Math.round(a * RATE) * 2; i < Math.round(b * RATE) * 2; i++)
          peak = Math.max(peak, Math.abs(m[i]));
        return peak;
      };
      const caption = lineDuration(p, p.shots[0], p.shots[0].actions[0]) - LINGER;
      expect(loud(narrator, 0, caption)).toBeGreaterThan(0.01);
      expect(loud(narrator, 4.6, 6)).toBe(0);
      expect(loud(full, 4.6, 6)).toBeGreaterThan(0.01);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });

  it('writes an mkv with three sound tracks, subtitles off and a chapter per shot', async () => {
    process.env.TALEKIT_TTS = fake;
    try {
      const r = root();
      const p = bilingual(r);
      p.shots.push(ShotSchema.parse(shot('b', { duration: 1 })));
      p.meta.music = 'playful';
      await makeVoices(r, p);
      const mp4 = path.join(r, 'movie.mp4');
      const mkv = path.join(r, 'movie.mkv');
      // Seven seconds of film with a sound track, as the render would leave it.
      execFileSync('ffmpeg', [
        ...['-v', 'error', '-f', 'lavfi', '-i', 'color=size=320x180:rate=24:duration=7'],
        ...['-f', 'lavfi', '-i', 'sine=duration=7', '-shortest', mp4],
      ]);
      const made = await writeMkv(p, mp4, mkv);
      expect(made).toEqual({
        audio: ['Full mix', 'Music and effects', 'Music, effects and narrator'],
        subtitles: ['Hindi', 'English'],
      });
      const probe = JSON.parse(
        execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_streams', '-show_chapters', '-of', 'json', mkv],
          {
            encoding: 'utf8',
          }
        )
      );
      const streams = probe.streams.map(
        (s: {
          codec_type: string;
          tags: { language?: string };
          disposition: { default: number };
        }) => [s.codec_type, s.tags.language, s.disposition.default]
      );
      expect(streams).toEqual([
        ['video', undefined, 1],
        ['audio', 'hin', 1],
        ['audio', 'zxx', 0],
        ['audio', 'hin', 0],
        ['subtitle', 'hin', 0],
        ['subtitle', 'eng', 0],
        ['attachment', undefined, 0],
      ]);
      expect(probe.chapters.map((c: { tags: { title: string } }) => c.tags.title)).toEqual([
        'a',
        'b',
      ]);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  });
});
