import { describe, expect, it } from 'vitest';
import { ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { guideSection } from '../src/project/guide.js';
import { beatsOf, criticCells, criticSheetsSvg, readThrough } from '../src/render/critic.js';

function project(): Project {
  const one = ShotSchema.parse({
    id: 'one',
    scene: 'park',
    duration: 12,
    cast: {
      kid: { at: { x: 300, y: 640 }, facing: 'right' },
      grownup: { at: { x: 800, y: 640 }, facing: 'left' },
    },
    actions: [
      { t: 0.5, caption: 'Once there was a kid.' },
      { t: 1, actor: 'kid', do: 'walk', to: { x: 600, y: 640 } },
      { t: 4, actor: 'grownup', say: 'Hello there!', to: 'kid' },
      // Waving over and over: one look, not four.
      { t: 7, actor: 'kid', do: 'wave', duration: 1 },
      { t: 8.2, actor: 'kid', do: 'wave', duration: 1 },
      { t: 9.4, actor: 'kid', do: 'wave', duration: 1 },
      { t: 10.6, actor: 'kid', do: 'wave', duration: 1 },
    ],
  });
  const two = ShotSchema.parse({
    id: 'two',
    scene: 'park',
    duration: 4,
    cast: { kid: { at: { x: 600, y: 640 }, facing: 'right' } },
    actions: [{ t: 0.5, actor: 'kid', say: 'Bye!', translation: { en: 'Goodbye!' } }],
  });
  return {
    meta: { title: 'Park', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, grownup: LIBRARY.characters.grownup },
    scenes: { park: LIBRARY.scenes.park },
    shots: [one, two],
  };
}

describe('the critic', () => {
  it('looks at a shot at its beats: start, every line, every verb, the end', () => {
    const p = project();
    const beats = beatsOf(p, p.shots[0]);
    const why = beats.flatMap((b) => b.why);
    expect(why[0]).toBe('start');
    expect(why.at(-1)).toBe('end');
    expect(why).toContain('narrator: "Once there was a kid."');
    expect(why).toContain('kid walk to 600,640');
    expect(why).toContain('grownup says "Hello there!" to kid');
    // A walk is looked at when it is done; a line in its middle.
    const walked = beats.find((b) => b.why.includes('kid walk to 600,640'))!;
    expect(walked.t).toBeGreaterThan(2);
    // The waves after the first are the same thing again.
    expect(why.filter((w) => w.startsWith('kid wave'))).toHaveLength(1);
    // Each beat says whose state its caption gives.
    expect(beats.find((b) => b.why.some((w) => w.startsWith('grownup says')))!.who).toEqual([
      'grownup',
      'kid',
    ]);
  });

  it('starts a shot with the last frame of the one before, and captions every frame', () => {
    const p = project();
    const cells = criticCells(p, p.shots[1]);
    expect(cells[0].title).toBe('end of one (the shot before; same place, cut next)');
    // English where the film has it, and how the actor is.
    expect(cells.some((c) => c.title.includes('kid says "Goodbye!"'))).toBe(true);
    expect(cells[1].lines[0]).toContain('kid facing right');
    const sheets = criticSheetsSvg(p, p.shots[0]);
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets[0]).toContain('grownup says');
  });

  it('reads the film through: the lines in order, the quiet stretches', () => {
    const text = readThrough(project());
    expect(text).toMatch(/^# Park: read-through \(0:16\)/);
    expect(text).toContain('## one (park, 12.0 s, film 0:00–0:12)');
    expect(text).toMatch(/0\.5–3\.5 {2}NARRATOR: Once there was a kid\./);
    expect(text).toMatch(/grownup → kid: Hello there!/);
    expect(text).toMatch(/s with no line, to the end\)/);
    expect(text).toContain('kid: Bye!   (en: Goodbye!)');
  });

  it('keeps its checklist in the guide', async () => {
    const section = await guideSection('The critic');
    expect(section).toMatch(/^## The critic\n/);
    expect(section).toContain('**In the pictures**');
    expect(section).toContain('**In the read-through**');
  });
});
