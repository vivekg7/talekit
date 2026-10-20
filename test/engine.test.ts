import { describe, expect, it } from 'vitest';
import { wrapText } from '../src/engine/bubble.js';
import { composeFrame } from '../src/engine/compose.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { CharacterSchema, SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { validateCharacter, validateShot } from '../src/project/validate.js';
import { rasterize } from '../src/render/raster.js';
import { characterSheetSvg, filmSheetSvg } from '../src/render/sheets.js';
import { poseFor } from '../src/engine/actor.js';
import { applyVerb, basePose, faceFallbacks } from '../src/engine/motion.js';
import { RIGS } from '../src/engine/rigs.js';

function project(shotInput: unknown): Project {
  const shot = ShotSchema.parse(shotInput);
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, dog: LIBRARY.characters.dog },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

describe('wrapText', () => {
  it('wraps within the width', () => {
    const lines = wrapText('the quick brown fox jumps over the lazy dog', 200, 26);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.length).toBeLessThan(25);
  });
  it('splits an over-long word', () => {
    const lines = wrapText('supercalifragilisticexpialidocious', 120, 26);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('supercalifragilisticexpialidocious');
  });
});

describe('timeline', () => {
  const p = project({
    id: 's',
    scene: 'park',
    duration: 10,
    cast: { kid: { at: 'gate' }, dog: { at: 'bench', facing: 'left' } },
    actions: [
      { t: 1, actor: 'kid', do: 'walk', to: 'bench', duration: 4 },
      { t: 2, actor: 'kid', say: 'hello there friend', duration: 2 },
      { t: 6, actor: 'dog', do: 'run', to: 'gate', duration: 2 },
      { t: 3, camera: { zoom: 2 }, duration: 2 },
    ],
  });
  const shot = p.shots[0];
  const gate = p.scenes.park.anchors.gate;
  const bench = p.scenes.park.anchors.bench;

  it('starts at the cast position and ends at the target', () => {
    const start = resolveFrame(p, shot, 0).actors.find((a) => a.id === 'kid')!;
    expect(start.x).toBe(gate.x);
    expect(start.locomotion).toBe('idle');
    const end = resolveFrame(p, shot, 6).actors.find((a) => a.id === 'kid')!;
    expect(end.x).toBe(bench.x);
    expect(end.locomotion).toBe('idle');
  });
  it('walks linearly and faces the direction of travel', () => {
    const mid = resolveFrame(p, shot, 3).actors.find((a) => a.id === 'kid')!;
    expect(mid.x).toBeCloseTo((gate.x + bench.x) / 2, 5);
    expect(mid.locomotion).toBe('walk');
    expect(mid.facing).toBe('right');
    const dog = resolveFrame(p, shot, 7).actors.find((a) => a.id === 'dog')!;
    expect(dog.facing).toBe('left');
    expect(dog.locomotion).toBe('run');
  });
  it('shows the bubble only while speaking and flaps the mouth', () => {
    expect(resolveFrame(p, shot, 1.5).actors.find((a) => a.id === 'kid')!.bubble).toBeUndefined();
    const talking = resolveFrame(p, shot, 2.5).actors.find((a) => a.id === 'kid')!;
    expect(talking.bubble?.text).toBe('hello there friend');
    const mouths = new Set<string>();
    for (let t = 2; t < 4; t += 1 / 24) {
      const a = resolveFrame(p, shot, t).actors.find((x) => x.id === 'kid')!;
      mouths.add(poseFor(a, t).face.mouth);
    }
    expect(mouths.has('open')).toBe(true);
    expect(mouths.size).toBeGreaterThan(1);
    expect(resolveFrame(p, shot, 4.5).actors.find((a) => a.id === 'kid')!.bubble).toBeUndefined();
  });
  it('tweens the camera', () => {
    expect(resolveFrame(p, shot, 3).camera.zoom).toBe(1);
    expect(resolveFrame(p, shot, 4).camera.zoom).toBeCloseTo(1.5, 5);
    expect(resolveFrame(p, shot, 6).camera.zoom).toBe(2);
  });
  it('draws closer actors later', () => {
    const f = resolveFrame(p, shot, 0);
    expect(f.actors.map((a) => a.id)).toEqual(['dog', 'kid']); // bench y=655 is behind gate y=660
    expect(f.actors[0].y).toBeLessThanOrEqual(f.actors[1].y);
  });
});

describe('validation', () => {
  it('rejects unknown anchors and actors outside the cast', () => {
    const p = project({
      id: 's',
      scene: 'park',
      duration: 5,
      cast: { kid: { at: 'nowhere' } },
      actions: [{ t: 0, actor: 'dog', do: 'wave' }],
    });
    const problems = validateShot(p.shots[0], p);
    expect(
      problems
        .filter((x) => x.level === 'error')
        .map((x) => x.message)
        .join('\n')
    ).toMatch(/nowhere/);
    expect(problems.map((x) => x.message).join('\n')).toMatch(/not in the cast/);
  });
  it('rejects undefined colour tokens and <svg> wrappers', () => {
    const c = CharacterSchema.parse({
      id: 'x',
      name: 'x',
      parts: { torso: "<svg><rect fill='{nope}'/></svg>" },
    });
    const messages = validateCharacter(c)
      .map((x) => x.message)
      .join('\n');
    expect(messages).toMatch(/nope/);
    expect(messages).toMatch(/<svg>/);
  });
  it('rejects <image> elements and external references', () => {
    const c = CharacterSchema.parse({
      id: 'x',
      name: 'x',
      parts: {
        torso: "<image href='https://example.com/a.png'/>",
        head: "<use href='//cdn.example.com/x.svg#a'/>",
      },
    });
    const messages = validateCharacter(c)
      .map((x) => x.message)
      .join('\n');
    expect(messages).toMatch(/<image>/);
    expect(messages).toMatch(/external URL/);
  });
  it('allows an empty variant inside a map but not an empty part', () => {
    const bird = CharacterSchema.parse({
      id: 'b',
      name: 'b',
      rig: 'simple',
      parts: { body: "<circle r='9'/>", mouth: { closed: '', open: "<path d='M0 0h9'/>" } },
    });
    expect(validateCharacter(bird).filter((x) => x.level === 'error')).toEqual([]);
    const allEmpty = CharacterSchema.parse({
      ...bird,
      parts: { body: "<circle r='9'/>", mouth: { closed: '', open: ' ' } },
    });
    expect(
      validateCharacter(allEmpty)
        .map((x) => x.message)
        .join()
    ).toMatch(/every variant/);
    const emptyPart = CharacterSchema.parse({ ...bird, parts: { body: '' } });
    expect(
      validateCharacter(emptyPart)
        .map((x) => x.message)
        .join()
    ).toMatch(/is empty/);
    // and a face action may select the empty variant
    const p = project({
      id: 's',
      scene: 'park',
      duration: 2,
      cast: { b: { at: 'gate' } },
      actions: [{ t: 0, actor: 'b', face: { mouth: 'closed' } }],
    });
    p.characters.b = bird;
    expect(validateShot(p.shots[0], p).filter((x) => x.level === 'error')).toEqual([]);
  });
  it('warns when two actors speak at once', () => {
    const p = project({
      id: 's',
      scene: 'park',
      duration: 10,
      cast: { kid: { at: 'gate' }, dog: { at: 'bench' } },
      actions: [
        { t: 0.5, actor: 'kid', say: 'Where is it, Gus?' }, // 1 + 4 * 0.4 = 2.6s, until 3.1
        { t: 3, actor: 'dog', say: 'There!' },
        { t: 6, actor: 'kid', say: 'Found it!', duration: 1 },
        { t: 7.5, actor: 'dog', say: 'Squawk!' },
      ],
    });
    const warnings = validateShot(p.shots[0], p).filter((x) => x.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/'dog' starts speaking at 3s while 'kid'/);
    // a short line nested inside a long one must not hide the long one
    const nested = project({
      id: 's',
      scene: 'park',
      duration: 10,
      cast: { kid: { at: 'gate' }, dog: { at: 'bench' } },
      actions: [
        { t: 0.5, actor: 'kid', say: 'A long speech', duration: 8 },
        { t: 1, actor: 'dog', say: 'Woof', duration: 0.5 },
        { t: 3, actor: 'dog', say: 'Woof' },
      ],
    });
    const messages = validateShot(nested.shots[0], nested)
      .filter((x) => x.level === 'warning')
      .map((x) => x.message);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatch(
      /'dog' starts speaking at 3s while 'kid' is still talking until 8.5s/
    );
  });
  it('allows camera-only actions but needs an actor once set is present', () => {
    const base = { id: 's', scene: 'park', duration: 1 };
    expect(() =>
      ShotSchema.parse({ ...base, actions: [{ t: 0, camera: { zoom: 1.5 } }] })
    ).not.toThrow();
    expect(() =>
      ShotSchema.parse({
        ...base,
        actions: [{ t: 0, camera: { zoom: 1.5 }, set: { facing: 'left' } }],
      })
    ).toThrow(/actor is required/);
  });
  it('requires an actor for actor-bound actions', () => {
    expect(() =>
      ShotSchema.parse({ id: 's', scene: 'park', duration: 1, actions: [{ t: 0, do: 'wave' }] })
    ).toThrow();
    expect(SceneSchema.safeParse({ id: 'Bad Id', name: 'x', svg: '' }).success).toBe(false);
  });
});

describe('pose sheet', () => {
  it('shows a cell for every variant of a non-face part', () => {
    const lantern = CharacterSchema.parse({
      id: 'l',
      name: 'l',
      rig: 'simple',
      parts: { body: { dark: "<circle r='9'/>", lit: "<circle r='9' fill='gold'/>" } },
    });
    const svg = characterSheetSvg(lantern);
    expect(svg).toContain('body: dark');
    expect(svg).toContain('body: lit');
    expect(svg).toContain("fill='gold'");
  });
  it('labels emotion cells whose preferred variant is missing, and lists the fallbacks', () => {
    const monkey = CharacterSchema.parse({
      id: 'm',
      name: 'm',
      rig: 'simple',
      parts: {
        body: "<circle r='9'/>",
        eyes: { open: "<circle r='1'/>", closed: "<path d='M0 0h2'/>" },
        mouth: { closed: "<path d='M0 0h2'/>", open: "<circle r='2'/>", sad: "<path d='M0 0h3'/>" },
      },
    });
    const svg = characterSheetSvg(monkey);
    expect(svg).toContain('angry · mouth→sad eyes→open');
    expect(svg).toContain('happy · mouth→closed eyes→open');
    const list = faceFallbacks(monkey.parts);
    expect(list).toContain("angry: eyes → open (no 'angry')");
    expect(list).not.toContain(expect.stringMatching(/^neutral/));
    expect(faceFallbacks(LIBRARY.characters.kid.parts)).toEqual([]);
  });
  it('tiles one frame per shot on the film sheet', () => {
    const p = project({ id: 'a', scene: 'park', duration: 4, cast: { kid: { at: 'gate' } } });
    p.shots.push(ShotSchema.parse({ id: 'b', scene: 'park', duration: 6 }));
    const svg = filmSheetSvg(p, p.shots);
    expect(svg).toContain('1. a · 4s');
    expect(svg).toContain('2. b · 6s');
    expect(svg.match(/class='scene'/g)).toHaveLength(2);
  });
});

describe('simple-rig verbs', () => {
  it('point leans the body and tremble shakes it', () => {
    const rig = RIGS.simple;
    const still = basePose(rig, 'idle', 0, 0);
    const lean = basePose(rig, 'idle', 0, 0);
    applyVerb(rig, lean, 'point', 0.5);
    expect(lean.rot.body).toBeLessThan(-15);
    expect(lean.dx).toBeGreaterThan(still.dx);
    const shiver = basePose(rig, 'idle', 0, 0);
    applyVerb(rig, shiver, 'tremble', 0.27);
    expect(shiver.dx).not.toBe(still.dx);
    const settled = basePose(rig, 'idle', 0, 0);
    applyVerb(rig, settled, 'tremble', 1);
    expect(Math.abs(settled.dx - still.dx)).toBeLessThan(0.01);
  });
});

describe('compose + raster', () => {
  it('produces an SVG with the actors and rasterizes to PNG', () => {
    const p = project({
      id: 's',
      scene: 'park',
      duration: 5,
      cast: { kid: { at: 'center' } },
      actions: [{ t: 0, actor: 'kid', say: 'Hi!' }],
    });
    const svg = composeFrame(p, p.shots[0], 0.5);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain("class='actor actor-kid'");
    expect(svg).toContain("class='bubble'");
    const png = rasterize(svg);
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});
