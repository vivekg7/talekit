import { describe, expect, it } from 'vitest';
import { staging } from '../src/engine/stage.js';
import { resolveFrame, type ActorState } from '../src/engine/timeline.js';
import { CharacterSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { shotFindings } from '../src/engine/world.js';
import { LIBRARY } from '../src/library/index.js';

const POT = CharacterSchema.parse({
  id: 'pot',
  name: 'Pot',
  rig: 'simple',
  height: 50,
  grip: [100, 20],
  parts: { body: `<rect x='50' y='40' width='100' height='160' fill='brown'/>` },
});

type Raw = Record<string, unknown>;

/** Two shots in the park, the second after the first. */
function film(a: Raw, b: Raw, sceneB = 'park'): Project {
  const shot = (id: string, scene: string, s: Raw) =>
    ShotSchema.parse({ id, scene, duration: 4, actions: [], ...s });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, grownup: LIBRARY.characters.grownup, pot: POT },
    scenes: { park: LIBRARY.scenes.park, street: LIBRARY.scenes.street },
    shots: [shot('a', 'park', a), shot('b', sceneB, b)],
  };
}

const cuts = (p: Project) => shotFindings(p, p.shots[1]).filter((f) => f.code === 'continuity.cut');
const at = (p: Project, id: string, t: number): ActorState =>
  resolveFrame(p, p.shots[1], t).actors.find((a) => a.id === id)!;

const KID = { kid: { at: { x: 500, y: 640 } } };

describe('a cut that carries straight on', () => {
  it('holds someone to where the last shot left them, and gives the spot', () => {
    const p = film({ cast: KID }, { cast: { kid: { at: { x: 620, y: 640 } } } });
    const [f] = cuts(p);
    expect(f.actors).toEqual(['kid']);
    expect(f.message).toMatch(/stands 120 px from where it was left, \(500, 640\)/);
    expect(f.message).toMatch(/cut: 'later'/);
    expect(f.fix).toEqual({ path: '/cast/kid/at', value: { x: 500, y: 640 } });
    // Not when time has passed, which a crossfade says on its own, or in another place.
    const later = { cast: { kid: { at: { x: 620, y: 640 } } } };
    expect(cuts(film({ cast: KID }, { ...later, cut: 'later' }))).toEqual([]);
    expect(cuts(film({ cast: KID }, { ...later, crossfade: 1 }))).toEqual([]);
    expect(cuts(film({ cast: KID }, { ...later, crossfade: 1, cut: 'next' }))).toHaveLength(1);
    expect(cuts(film({ cast: KID }, later, 'street'))).toEqual([]);
    // After a title card the story starts.
    const title = { cast: KID, actions: [{ t: 0, caption: 'Once', captionStyle: 'title' }] };
    expect(cuts(film(title, later))).toEqual([]);
    // Waived for one actor.
    expect(
      cuts(film({ cast: KID }, { ...later, allow: { 'continuity.cut:kid': 'a test' } }))
    ).toEqual([]);
  });

  it('finds someone who sat up, woke, or let go between the shots', () => {
    const p = film(
      {
        cast: { ...KID, grownup: { at: { x: 800, y: 640 } }, pot: { at: { x: 800, y: 640 } } },
        actions: [
          { t: 0, actor: 'kid', do: 'lie' },
          { t: 0, actor: 'kid', face: { eyes: 'closed' } },
          { t: 0, actor: 'pot', attach: 'grownup' },
        ],
      },
      { cast: { ...KID, grownup: { at: { x: 800, y: 640 } }, pot: { at: { x: 860, y: 640 } } } }
    );
    const byId = Object.fromEntries(cuts(p).map((f) => [f.actors[0], f.message]));
    expect(byId.kid).toMatch(/was lying down and is up; was asleep and is awake/);
    expect(byId.pot).toMatch(/was in 'grownup''s hand and is not/);
    expect(byId.grownup).toBeUndefined();
  });

  it('finds someone who vanishes from a spot still in sight, or appears in one', () => {
    const both = { ...KID, grownup: { at: { x: 800, y: 640 } } };
    const [gone] = cuts(film({ cast: both }, { cast: KID }));
    expect(gone.actors).toEqual(['grownup']);
    expect(gone.message).toMatch(/is not in its cast: it vanishes/);
    expect(gone.fix).toMatchObject({ path: '/cast/grownup', value: { at: { x: 800, y: 640 } } });
    const [came] = cuts(film({ cast: KID }, { cast: both }));
    expect(came.message).toMatch(/appears from nowhere/);
    // Out of sight on both sides, nobody sees it go.
    const off = { ...KID, grownup: { at: { x: 1500, y: 640 } } };
    expect(cuts(film({ cast: off }, { cast: KID }))).toEqual([]);
  });

  it('turns whoever it has facing the other way at its start, and leaves a thing as it was', () => {
    const p = film(
      {
        cast: { kid: { at: { x: 500, y: 640 }, facing: 'left' }, pot: { at: { x: 700, y: 640 } } },
      },
      { cast: { kid: { at: { x: 500, y: 640 } }, pot: { at: { x: 700, y: 640 }, facing: 'left' } } }
    );
    expect(cuts(p)).toEqual([]);
    const added = staging(p, p.scenes.park, p.shots[1]);
    expect(added.map((a) => [a.actor, a.set?.facing, a.staged])).toEqual([
      ['kid', 'right', 'was facing left'],
      ['pot', 'right', 'left as it was'],
    ]);
    expect(at(p, 'kid', 0).facing).toBe('right');
    expect(at(p, 'kid', 0).turn?.from).toBe('left');
    expect(at(p, 'kid', 1).turn).toBeUndefined();
    expect(at(p, 'pot', 1).facing).toBe('right');
    // A shot that turns or moves them itself at the start is left to it.
    const own = film(
      { cast: { kid: { at: { x: 500, y: 640 }, facing: 'left' } } },
      {
        cast: { kid: { at: { x: 500, y: 640 } } },
        actions: [{ t: 0, actor: 'kid', do: 'walk', to: { x: 900, y: 640 } }],
      }
    );
    expect(staging(own, own.scenes.park, own.shots[1])).toEqual([]);
  });
});
