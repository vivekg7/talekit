import { describe, expect, it } from 'vitest';
import { bubbleSvg, textWidth, wrapText } from '../src/engine/bubble.js';
import { needsShaping, shapedText, shapedWidth } from '../src/engine/glyphs.js';

const spec = (text: string) => ({
  text,
  style: 'speech' as const,
  headX: 400,
  headTop: 400,
  frameW: 1280,
  frameH: 720,
  font: 'Chalkboard SE',
  uiScale: 1,
});

describe('Devanagari text', () => {
  it('is shaped here; Latin text is left to the rasteriser', () => {
    expect(needsShaping('अरे कछुए')).toBe(true);
    expect(needsShaping('Hello, rabbit!')).toBe(false);
    expect(bubbleSvg(spec('Hello, rabbit!'))).toContain('<text');
    const hindi = bubbleSvg(spec('अरे कछुए, तुम कितने धीमे हो!'));
    expect(hindi).not.toContain('<text');
    expect(hindi.match(/<path transform='translate/g)!.length).toBeGreaterThan(10);
  });

  it('measures by its shaped advances, so wrapping fits the drawn width', () => {
    const w = shapedWidth('कछुआ', 26);
    expect(w).toBeGreaterThan(40);
    expect(w).toBeLessThan(90);
    expect(textWidth('कछुआ', 26)).toBe(w);
    expect(shapedWidth('कछुआ', 26, true)).toBeGreaterThan(w);
    const lines = wrapText('धीरे धीरे चलने वाला कछुआ दौड़ जीत गया', 200, 26);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 26)).toBeLessThanOrEqual(200);
  });

  it('draws the same outlines every time, centred on x', () => {
    const a = shapedText('खरगोश', { x: 300, y: 100, fontSize: 26, fill: '#111' });
    expect(a).toBe(shapedText('खरगोश', { x: 300, y: 100, fontSize: 26, fill: '#111' }));
    const x0 = 300 - shapedWidth('खरगोश', 26) / 2;
    expect(a.startsWith(`<g transform='translate(${Math.round(x0 * 100) / 100} 100) scale(`)).toBe(
      true
    );
  });
});

describe('a cover', () => {
  it('sets the title over a frame, pushed in about the focus', async () => {
    const { loadProject } = await import('../src/project/store.js');
    const { coverSvg } = await import('../src/render/cover.js');
    const p = await loadProject('examples/lost-kite');
    const svg = coverSvg(p, p.shots[0], 1, {
      title: 'पतंग',
      tag: 'Never give up!',
      zoom: 1.5,
      focus: { x: 400, y: 300 },
    });
    expect(svg).toContain(`translate(${400 * -0.5} ${300 * -0.5}) scale(1.5)`);
    expect(svg).toContain(
      shapedText('पतंग', {
        x: 1280 * 0.34,
        y: 190,
        fontSize: 96,
        fill: '#ffd23f',
        bold: true,
        stroke: { color: '#2e2633', width: 96 * 0.16 },
      })
    );
    expect(svg).toContain("fill='#c8342b'");
  });

  it('leaves out what the push carries far off the frame, which resvg would panic on', async () => {
    const { loadProject } = await import('../src/project/store.js');
    const { coverSvg } = await import('../src/render/cover.js');
    const p = await loadProject('examples/lost-kite');
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

  it('draws a banner from a film with the words in the middle every device shows', async () => {
    const { loadProject } = await import('../src/project/store.js');
    const { coverSvg, coverWidth, BANNER } = await import('../src/render/cover.js');
    const p = await loadProject('examples/lost-kite');
    expect(coverWidth(p, true)).toBe(BANNER.width);
    const svg = coverSvg(p, p.shots[0], 1, {
      title: 'पतंग',
      sub: 'कहानी',
      tag: 'Hi',
      banner: true,
    });
    // Every word drawn over the picture (sub, title, tag) sits in the band all devices show.
    const over = svg.slice(svg.indexOf("fill='url(#tk-wash)'"));
    const ys = [...over.matchAll(/translate\(([\d.]+) ([\d.]+)\) scale\(/g)].map((m) =>
      Number(m[2])
    );
    const safeH = (720 * BANNER.safeHeight) / BANNER.height;
    expect(ys.length).toBe(3);
    for (const y of ys) {
      expect(y).toBeGreaterThan(360 - safeH / 2);
      expect(y).toBeLessThan(360 + safeH / 2);
    }
    const reel = { ...p, meta: { ...p.meta, width: 720, height: 1280 } };
    expect(() => coverSvg(reel, p.shots[0], 1, { title: 'x', banner: true })).toThrow(/reel/);
  });

  it('leaves the words out of a quiet frame', async () => {
    const { loadProject } = await import('../src/project/store.js');
    const { composeFrame } = await import('../src/engine/compose.js');
    const p = await loadProject('examples/lost-kite');
    const differ = p.shots.some((s) =>
      [0.3, 0.5, 0.7].some(
        (f) =>
          composeFrame(p, s, s.duration * f, { quiet: true }) !== composeFrame(p, s, s.duration * f)
      )
    );
    expect(differ).toBe(true);
  });
});
