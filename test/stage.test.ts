import { describe, expect, it } from 'vitest';
import { staging } from '../src/engine/stage.js';
import { resolveActor } from '../src/engine/timeline.js';
import { ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';
import { shotFindings } from '../src/engine/world.js';

// The kid on the left facing away (left), the grownup in the middle, the dog on the right.
const CAST = {
  kid: { at: { x: 300, y: 640 }, facing: 'left' },
  grownup: { at: { x: 640, y: 640 }, facing: 'left' },
  dog: { at: { x: 950, y: 640 }, facing: 'right' },
};

function project(actions: unknown[], extra: Record<string, unknown> = {}, cast = CAST): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 8, cast, actions, ...extra });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: {
      kid: LIBRARY.characters.kid,
      grownup: LIBRARY.characters.grownup,
      dog: LIBRARY.characters.dog,
    },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}
const facing = (p: Project, id: string, t: number) =>
  resolveActor(p, p.scenes.park, p.shots[0], id, t).facing;
const added = (p: Project) => staging(p, p.scenes.park, p.shots[0]);

describe('listeners turn to the speaker', () => {
  it('turns who a line is said to, a moment after it starts, and the speaker to them', () => {
    const p = project([{ t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' }]);
    expect(facing(p, 'dog', 0.9)).toBe('right');
    expect(facing(p, 'dog', 2.5)).toBe('left');
    expect(facing(p, 'grownup', 2.5)).toBe('right');
    const turn = added(p).find((a) => a.actor === 'dog')!;
    expect(turn.t).toBeGreaterThan(1.1);
    expect(turn.t).toBeLessThan(1.55);
    expect(turn.staged).toBe('listens to grownup');
  });
  it('leaves a bystander alone, unless the line names it in audience', () => {
    const line = { t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' };
    expect(facing(project([line]), 'kid', 3)).toBe('left');
    expect(facing(project([{ ...line, audience: ['kid'] }]), 'kid', 3)).toBe('right');
    expect(facing(project([{ ...line, audience: 'all' }]), 'kid', 3)).toBe('right');
  });
  it('turns everyone to the only speaker in the shot', () => {
    const p = project([{ t: 1, actor: 'grownup', say: 'Listen, all of you!' }]);
    expect(facing(p, 'kid', 3)).toBe('right');
    expect(facing(p, 'dog', 3)).toBe('left');
  });
  it('turns the one replied to in a conversation with no `to`', () => {
    const p = project([
      { t: 0.5, actor: 'dog', say: 'Woof?' },
      { t: 3, actor: 'kid', say: 'Good dog.' },
    ]);
    // The kid's reply is to the dog, who spoke last; the grownup is not in it.
    expect(facing(p, 'kid', 3.5)).toBe('right');
    expect(facing(p, 'dog', 4.5)).toBe('left');
  });
  it('does not turn someone walking, with eyes shut, or told not to', () => {
    const walking = project([
      { t: 0.5, actor: 'dog', do: 'walk', to: { x: 1150, y: 640 }, duration: 4 },
      { t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' },
    ]);
    expect(added(walking).some((a) => a.actor === 'dog')).toBe(false);
    const asleep = project([
      { t: 0, actor: 'dog', face: { eyes: 'closed' } },
      { t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' },
    ]);
    expect(facing(asleep, 'dog', 3)).toBe('right');
    const waived = project([{ t: 1, actor: 'grownup', say: 'Come here.', to: 'dog' }], {
      allow: { 'attention.listener:dog': 'it ignores her' },
    });
    expect(facing(waived, 'dog', 3)).toBe('right');
  });
});

describe('reactions', () => {
  it('looks at the cause just before reacting', () => {
    const p = project([{ t: 2, actor: 'kid', emotion: 'scared', reacts: 'dog' }]);
    const turn = added(p).find((a) => a.actor === 'kid')!;
    expect(turn.staged).toBe('sees dog');
    expect(turn.t).toBeCloseTo(1.55, 2);
    expect(facing(p, 'kid', 2)).toBe('right');
  });
  it('waits for the reaction when the listener only notices later', () => {
    const p = project([
      { t: 1, actor: 'grownup', say: 'There you are!', to: 'kid' },
      { t: 4, actor: 'kid', emotion: 'surprised', reacts: 'grownup' },
    ]);
    expect(facing(p, 'kid', 2.5)).toBe('left');
    expect(facing(p, 'kid', 4.2)).toBe('right');
  });
});

describe('attention findings', () => {
  it('finds who is spoken to facing away when it could not turn, and says why', () => {
    const p = project([
      { t: 0.5, actor: 'dog', do: 'walk', to: { x: 1150, y: 640 }, duration: 4 },
      { t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' },
    ]);
    const [f] = shotFindings(p, p.shots[0]).filter((x) => x.code === 'attention.listener');
    expect(f.actors).toEqual(['dog', 'grownup']);
    expect(f.message).toMatch(/on the move/);
  });
  it('finds a reaction to what is behind the reactor', () => {
    const p = project([
      { t: 0.2, actor: 'kid', do: 'walk', to: { x: 100, y: 640 }, duration: 3 },
      { t: 2, actor: 'kid', emotion: 'scared', reacts: 'dog' },
    ]);
    expect(shotFindings(p, p.shots[0]).map((f) => f.code)).toContain('attention.reacts');
  });
  it('is quiet when everyone faces who they should', () => {
    const p = project([{ t: 1, actor: 'grownup', say: 'Come here, please.', to: 'dog' }]);
    expect(shotFindings(p, p.shots[0])).toEqual([]);
  });
});
