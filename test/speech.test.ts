import { mkdirSync, mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { badTake, hindiNumber, matchTake, skeleton } from '../src/engine/speech.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { voiceLines } from '../src/engine/voice.js';
import { LIBRARY } from '../src/library/index.js';
import type { Hearer } from '../src/project/hear.js';
import { speechProblems } from '../src/project/validate.js';
import { hearingLines, makeVoices } from '../src/project/voices.js';

describe('the speech check', () => {
  // What whisper made of real takes from the released films, and of takes broken on purpose.
  it('lets through what recognition only spells differently', () => {
    const pairs = [
      ['अरे कछुए भाई! इतने धीरे-धीरे कहाँ चले?', 'अरे कच्छवे भाई, इतने दीरे दीरे कहा चले।'],
      ['और बेचारे ऊँट की ख़ूब पिटाई हुई।', 'और बेजारे उंट की हूब बटाई हुई।'],
      [
        'धोखेबाज़! तूने हम सबको मूर्ख बनाया! पकड़ो इसे!',
        'धोके बाज, तुने हम सबको मुल्क बनाया, पकड़ो इसे।',
      ],
      ['जी, गुरुदेव!', 'G. गुरुदेव'],
      ['हुंह!', 'हुग'],
      ['शाबाश, अर्जुन!', 'शबस्ट आरचुन'],
      ['पूरे सौ रुपये मिलेंगे, सौ रुपये!', 'पूरे 100 रुपए मिलेंगे, 100 रुपए.'],
      ['यहाँ से पचास कोस दूर एक बड़ी झील है', 'यहां से 50 कोज दूर एक बड़ी जील है'],
    ];
    for (const [line, heard] of pairs) expect(badTake(line, matchTake(line, heard))).toBe(false);
  });
  it('finds a skipped word, a take cut short, babble, and another line', () => {
    const line = 'परछाईं...? शेर को भी तो पानी में एक और शेर दिखेगा!';
    const skipped = matchTake(line, 'शेर को भी तो पानी में एक और शेर दिखेगा');
    expect(skipped.missing).toBeGreaterThanOrEqual(4);
    expect(badTake(line, skipped)).toBe(true);
    expect(badTake(line, matchTake(line, 'परछाईं शेर को भी तो'))).toBe(true);
    expect(badTake(line, matchTake(line, `${line} और फिर वो चला गया जंगल में`))).toBe(true);
    expect(badTake(line, matchTake(line, 'अब शेर किसी को नहीं सताएगा।'))).toBe(true);
  });
  it('finds a word said twice', () => {
    const line = 'बूढ़े महात्मा अपनी कुटिया के आगे क्यारियाँ खोद रहे थे।';
    const heard = 'बुड़े महात्मा अपनी कुटिया के आगे क्यारियां, ख्यारियां खूद रहे थे';
    expect(badTake(line, matchTake(line, heard))).toBe(true);
  });
  it('says numbers in Hindi', () => {
    expect(hindiNumber(50)).toBe('पचास');
    expect(hindiNumber(100)).toBe('सौ');
    expect(hindiNumber(500)).toBe('पाँच सौ');
    expect(hindiNumber(2000)).toBe('दो हज़ार');
    expect(hindiNumber(123)).toBe('123');
    expect(hindiNumber(0)).toBe('0');
  });
  it('hears हंस in the respelling the voice is given', () => {
    expect(skeleton('हन्स')).toBe(skeleton('हंस'));
  });
});

describe('hearing voiced takes', () => {
  const fake = `node ${path.resolve('test/fixtures/fake-tts.mjs')}`;
  const root = () => {
    const r = mkdtempSync(path.join(os.tmpdir(), 'talekit-hear-'));
    mkdirSync(path.join(r, 'audio'));
    return r;
  };
  const project = (lines: string[], allow?: Record<string, string>): Project => ({
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: { ...LIBRARY.characters.kid, voice: 'chatterbox:hf_alpha' } },
    scenes: {
      s: SceneSchema.parse({ id: 's', name: 'S', svg: '', allow: { 'world.walk': 'a test' } }),
    },
    shots: [
      ShotSchema.parse({
        id: 'a',
        scene: 's',
        duration: 20,
        cast: { kid: { at: 'center' } },
        actions: lines.map((say, i) => ({ t: i * 4, actor: 'kid', say })),
        allow,
      }),
    ],
  });
  /**
   * Hears each take as its line, but `wrong` as nonsense until its take `from` (never, with
   * Infinity); counts the takes it is asked to hear.
   */
  const hearer = (p: Project, wrong: string, from: number) => {
    const text = new Map(voiceLines(p).map((l) => [l.key, l.text]));
    const asked: string[] = [];
    const hear: Hearer = async (takes) =>
      takes.map(({ file }) => {
        asked.push(path.basename(file));
        const [key, take] = path.basename(file).split('.');
        const n = take.startsWith('take') ? Number(take.slice(4)) : 1;
        return text.get(key) === wrong && n < from ? 'gibberish quite unlike it' : text.get(key)!;
      });
    return { hear, asked };
  };
  const run = async (p: Project, r: string, hear: Hearer | null) => {
    process.env.TALEKIT_TTS = fake;
    try {
      return await makeVoices(r, p, p.shots, undefined, hear);
    } finally {
      delete process.env.TALEKIT_TTS;
    }
  };
  const index = (r: string) =>
    JSON.parse(readFileSync(path.join(r, 'audio', 'voices', 'index.json'), 'utf8'));

  it('hears each take once, and keeps what it heard', async () => {
    const r = root();
    const p = project(['one two three', 'four five six']);
    const { hear, asked } = hearer(p, '', 1);
    const report = await run(p, r, hear);
    expect(report).toMatchObject({ made: 2, heard: 2, redone: 0, doubtful: [] });
    expect(Object.values(index(r)).map((e) => (e as { heard: string }).heard)).toEqual(
      expect.arrayContaining(['one two three', 'four five six'])
    );
    expect((await run(p, r, hear)).heard).toBe(0);
    expect(asked).toHaveLength(2);
  });

  it('says a line again until a take says it, and keeps that one', async () => {
    const r = root();
    const p = project(['one two three', 'seven eight nine ten']);
    const { hear, asked } = hearer(p, 'seven eight nine ten', 3);
    const report = await run(p, r, hear);
    expect(report).toMatchObject({ heard: 2, redone: 1, doubtful: [] });
    const key = voiceLines(p).find((l) => l.text === 'seven eight nine ten')!.key;
    expect(index(r)[key]).toMatchObject({
      file: `${key}.ogg`,
      take: 3,
      heard: 'seven eight nine ten',
    });
    expect(existsSync(path.join(r, 'audio', 'voices', `${key}.take2.ogg`))).toBe(false);
    // Take 1 whole, then in pieces; take 2 the same; take 3 heard right at once.
    expect(asked.filter((f) => f.startsWith(key))).toHaveLength(5);
    expect(speechProblems(p)).toEqual([]);
  });

  it('marks a line no take says, which the check reports until it is waived', async () => {
    const r = root();
    const p = project(['one two three', 'seven eight nine ten']);
    const report = await run(p, r, hearer(p, 'seven eight nine ten', Infinity).hear);
    expect(report.doubtful.map((d) => d.heard)).toEqual(['gibberish quite unlike it']);
    const [problem] = speechProblems(p);
    expect(problem).toMatchObject({ level: 'error', code: 'speech.mismatch' });
    expect(problem.message).toMatch(/heard as 'gibberish/);
    const waived = project(['one two three', 'seven eight nine ten'], {
      'speech.mismatch:kid': 'listened: it is right',
    });
    waived.audio = p.audio;
    expect(speechProblems(waived)).toEqual([]);
  });

  it('never says again over a take changed by hand', async () => {
    const r = root();
    const p = project(['one two three', 'seven eight nine ten']);
    // The first voicing goes unheard; then the take is replaced by hand (a trembled line).
    await run(p, r, null);
    const key = voiceLines(p).find((l) => l.text === 'seven eight nine ten')!.key;
    const file = path.join(r, 'audio', 'voices', `${key}.ogg`);
    writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.alloc(64)]));
    const { hear, asked } = hearer(p, 'seven eight nine ten', Infinity);
    const report = await run(p, r, hear);
    expect(report.redone).toBe(0);
    expect(report.doubtful).toMatchObject([{ byHand: true, takes: 1 }]);
    expect(asked.some((f) => f.includes('.take'))).toBe(false);
  });

  it('keeps the voicing when hearing fails, and says why', async () => {
    const r = root();
    const failing: Hearer = async () => {
      throw new Error('no model');
    };
    const report = await run(project(['one two three']), r, failing);
    expect(report).toMatchObject({ made: 1, unheard: true, hearError: 'no model' });
    expect(hearingLines(report)).toEqual(['  takes not heard: no model']);
  });

  it('says so when nothing can hear the takes', async () => {
    const r = root();
    const report = await run(project(['one two three']), r, null);
    expect(report).toMatchObject({ made: 1, heard: 0, unheard: true });
  });
});
