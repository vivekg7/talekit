import { describe, expect, it } from 'vitest';
import { bubbleBox } from '../src/engine/bubble.js';
import { ABOVE, bubblePlace, bubbleSpec, covers, faceBoxes } from '../src/engine/place.js';
import { resolveFrame } from '../src/engine/timeline.js';
import { ShotSchema, type Project } from '../src/engine/types.js';
import { LIBRARY } from '../src/library/index.js';

function project(cast: Record<string, unknown>, actions: unknown[]): Project {
  const shot = ShotSchema.parse({ id: 's', scene: 'park', duration: 6, cast, actions });
  return {
    meta: { title: 't', width: 1280, height: 720, fps: 24, font: 'sans-serif' },
    characters: { kid: LIBRARY.characters.kid, grownup: LIBRARY.characters.grownup },
    scenes: { park: LIBRARY.scenes.park },
    shots: [shot],
  };
}

/** The bubble of `id`'s line at `start`, at t, where it is placed, and the faces then. */
function at(p: Project, id: string, start: number, t: number) {
  const shot = p.shots[0];
  const frame = resolveFrame(p, shot, t);
  const me = frame.actors.find((a) => a.id === id)!;
  const line = shot.actions.find((a) => a.actor === id && a.t === start)!;
  const place = bubblePlace(p, shot, id, start);
  const box = bubbleBox({ ...bubbleSpec(p, frame, me, line.say!, 'speech'), place });
  return { place, box, faces: faceBoxes(p, frame) };
}

const LINE = 'Look, there it is, right up in the tree!';

describe('where a bubble goes', () => {
  it('above the speaker, centred, with nothing in the way', () => {
    const p = project({ kid: { at: { x: 640, y: 640 } } }, [{ t: 0.5, actor: 'kid', say: LINE }]);
    expect(bubblePlace(p, p.shots[0], 'kid', 0.5)).toBe(ABOVE);
  });

  it('off a taller face beside the speaker, the same place all through the line', () => {
    // The kid talks up to the grown-up standing close: above her head is his face.
    const p = project(
      {
        kid: { at: { x: 600, y: 640 }, facing: 'right' },
        grownup: { at: { x: 690, y: 640 }, facing: 'left' },
      },
      [{ t: 0.5, actor: 'kid', say: LINE }]
    );
    const centred = (() => {
      const frame = resolveFrame(p, p.shots[0], 1.5);
      const me = frame.actors.find((a) => a.id === 'kid')!;
      return bubbleBox({ ...bubbleSpec(p, frame, me, LINE, 'speech'), place: ABOVE });
    })();
    const his = (faces: { id: string; box: Parameters<typeof covers>[1] }[]) =>
      faces.find((f) => f.id === 'grownup')!.box;
    const first = at(p, 'kid', 0.5, 1);
    expect(covers(centred, his(first.faces))).toBeGreaterThan(0.2);
    expect(first.place).not.toBe(ABOVE);
    for (const t of [1, 2, 3]) {
      const { place, box, faces } = at(p, 'kid', 0.5, t);
      expect(place).toBe(first.place);
      for (const f of faces) expect(covers(box, f.box)).toBeLessThan(0.05);
      expect(covers(box, his(faces))).toBe(0);
    }
  });

  it('clear of a bubble already up', () => {
    const p = project(
      {
        kid: { at: { x: 560, y: 640 }, facing: 'right' },
        grownup: { at: { x: 760, y: 640 }, facing: 'left' },
      },
      [
        { t: 0.5, actor: 'grownup', say: LINE },
        { t: 1, actor: 'kid', say: LINE },
      ]
    );
    const his = at(p, 'grownup', 0.5, 2).box;
    const hers = at(p, 'kid', 1, 2).box;
    expect(covers(his, hers) + covers(hers, his)).toBe(0);
  });
});
