import { beforeEach, describe, expect, it } from 'vitest';
import { composeFrame } from '../src/engine/compose.js';
import { shapedWidth } from '../src/engine/glyphs.js';
import type { Project } from '../src/engine/types.js';
import { loadProject } from '../src/project/store.js';
import { BANNER, coverSvg, coverWidth } from '../src/render/cover.js';

let p: Project;
beforeEach(async () => {
  p = await loadProject('examples/lost-kite');
});

const asReel = (film: Project): Project => ({
  ...film,
  meta: { ...film.meta, width: 720, height: 1280 },
});

/** Where each run of words over the picture starts: its left end and baseline. */
const words = (svg: string) =>
  [
    ...svg
      .slice(svg.indexOf("fill='url(#tk-wash)'"))
      .matchAll(/translate\(([\d.]+) ([\d.]+)\) scale\(/g),
  ].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

describe('a cover', () => {
  it("sets a film's title on its left third, over the frame pushed in about the focus", () => {
    const svg = coverSvg(p, p.shots[0], 1, {
      title: 'पतंग',
      tag: 'Never give up!',
      zoom: 1.5,
      focus: { x: 400, y: 300 },
    });
    expect(svg).toContain(`translate(${400 * -0.5} ${300 * -0.5}) scale(1.5)`);
    const [title] = words(svg);
    expect(title.x + shapedWidth('पतंग', 96, true) / 2).toBeCloseTo(1280 * 0.34, 0);
  });

  it("centres a reel's title inside the 3:4 crop a profile grid shows", () => {
    const reel = asReel(p);
    expect(coverWidth(reel)).toBe(1080);
    const [title] = words(coverSvg(reel, p.shots[0], 1, { title: 'पतंग' }));
    expect(title.x + shapedWidth('पतंग', 110, true) / 2).toBeCloseTo(360, 0);
    const crop = (1280 - (720 * 4) / 3) / 2;
    expect(title.y).toBeGreaterThan(crop);
    expect(title.y).toBeLessThan(1280 - crop);
  });

  it('leaves out what the push carries far off the frame, which resvg would panic on', () => {
    // Within a frame of the left edge, so the frame keeps it; pushed in 1.5 times about a
    // point on the right, it lands nearly two frames out.
    const mark = "<rect x='-1200' y='300' width='10' height='10' fill='#0badc0'/>";
    const scene = p.scenes[p.shots[0].scene];
    p.scenes[p.shots[0].scene] = { ...scene, svg: scene.svg + mark };
    const at = (zoom: number) =>
      coverSvg(p, p.shots[0], 1, { title: 'पतंग', zoom, focus: { x: 900, y: 360 } });
    expect(at(1)).toContain('#0badc0');
    expect(at(1.5)).not.toContain('#0badc0');
  });

  it('draws a banner from a film only, its words in the band every device shows', () => {
    expect(coverWidth(p, true)).toBe(BANNER.width);
    const svg = coverSvg(p, p.shots[0], 1, {
      title: 'पतंग',
      sub: 'कहानी',
      tag: 'Hi',
      banner: true,
    });
    const safeH = (720 * BANNER.safeHeight) / BANNER.height;
    const ys = words(svg).map((w) => w.y);
    expect(ys).toHaveLength(3);
    for (const y of ys) expect(Math.abs(y - 360)).toBeLessThan(safeH / 2);
    expect(() => coverSvg(asReel(p), p.shots[0], 1, { title: 'x', banner: true })).toThrow(/reel/);
  });

  it('leaves the bubbles and captions out of a quiet frame', () => {
    const differ = p.shots.some((s) =>
      [0.3, 0.5, 0.7].some(
        (f) =>
          composeFrame(p, s, s.duration * f, { quiet: true }) !== composeFrame(p, s, s.duration * f)
      )
    );
    expect(differ).toBe(true);
  });
});
