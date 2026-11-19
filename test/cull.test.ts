import { describe, expect, it } from 'vitest';
import { composeFrame, layerTransform } from '../src/engine/compose.js';
import { cullOffFrame, parseTransform } from '../src/engine/cull.js';
import { SceneSchema, ShotSchema, type Project } from '../src/engine/types.js';
import { rasterize } from '../src/render/raster.js';

const W = 1280;
const H = 720;

/** One empty shot of `scene` under `camera`. */
function closeUp(scene: unknown, camera: object, duration = 1): Project {
  const s = SceneSchema.parse(scene);
  return {
    meta: { title: 't', width: W, height: H, fps: 24, font: 'sans-serif' },
    characters: {},
    scenes: { [s.id]: s },
    shots: [ShotSchema.parse({ id: 'z', scene: s.id, duration, camera })],
  };
}
const isPng = (png: Buffer) => png.subarray(1, 4).toString() === 'PNG';

describe('what is drawn far off the frame', () => {
  const far = `<circle cx='-3000' cy='100' r='20' fill='#363'/>`;
  const id = (s: string) => parseTransform(s)!;

  it('leaves out shapes a frame or more outside, through every transform', () => {
    const near = `<circle cx='100' cy='100' r='20' fill='#363'/>`;
    expect(cullOffFrame(near + far, id(''), W, H)).toBe(near);
    // Just under a frame out is kept: a blur or a shadow could still reach in.
    const edge = `<rect x='-1290' y='0' width='20' height='20'/>`;
    expect(cullOffFrame(edge, id(''), W, H)).toBe(edge);
    // A group moves its shapes, and empties out when they all go.
    const moved = `<g transform='translate(3100 0)'>${far}</g>`;
    expect(cullOffFrame(moved, id(''), W, H)).toBe(moved);
    expect(cullOffFrame(`<g opacity='.5'>${far}</g>`, id(''), W, H)).toBe('');
    // The camera's own transform counts: zoomed in, a shape at the scene's edge is far.
    const corner = `<path d='M1230 0 q 10 5 0 10 a5 5 0 1 1 -5 -5Z'/>`;
    expect(cullOffFrame(corner, id(''), W, H)).toBe(corner);
    expect(
      cullOffFrame(corner, id(layerTransform({ zoom: 4, x: 160, y: 630 }, W, H, 1)), W, H)
    ).toBe('');
  });

  it('keeps what it cannot measure, what is drawn by reference, and definitions', () => {
    const keep =
      `<defs><linearGradient id='g'/></defs>` +
      `<circle id='sun' cx='-3000' cy='0' r='9'/><use href='#sun' x='3100'/>` +
      `<text x='-3000' y='0'>far</text>` +
      `<path d='M-3000 0 L-2990 0 X'/>`;
    expect(cullOffFrame(keep, id(''), W, H)).toBe(keep);
  });

  it('measures a line by its ends', () => {
    const line = (y: number) => `<line x1='8' y1='${y}' x2='42' y2='${y - 27}' stroke='#000'/>`;
    expect(cullOffFrame(line(933), id(''), W, H)).toBe(line(933));
    expect(cullOffFrame(line(933), id('translate(0 -400) scale(2)'), W, H)).toBe(line(933));
    expect(cullOffFrame(line(933), id('translate(0 -100) scale(2)'), W, H)).toBe('');
  });

  it('looks inside a group with an id nothing points at: a swaying crown', () => {
    // Sway turns these groups every frame; kept whole, a close camera left their far
    // leaves for resvg to panic on.
    const crown = `<g transform='rotate(1.2 640 0)' id='crown'>${far}<circle cx='600' cy='100' r='20' fill='#363'/></g>`;
    expect(cullOffFrame(crown, id(''), W, H)).toBe(
      `<g transform='rotate(1.2 640 0)' id='crown'><circle cx='600' cy='100' r='20' fill='#363'/></g>`
    );
  });

  it("moves a lone shape's opacity into its paint where it draws the same", () => {
    const cull = (s: string) => cullOffFrame(s, id(''), W, H);
    expect(cull(`<circle cx='9' cy='9' r='5' fill='#fff' opacity='0.5'/>`)).toBe(
      `<circle cx='9' cy='9' r='5' fill='#fff' fill-opacity='0.5'/>`
    );
    expect(cull(`<path d='M0 0 L9 9' stroke='#fff' fill='none' opacity='0.5'/>`)).toBe(
      `<path d='M0 0 L9 9' stroke='#fff' fill='none' stroke-opacity='0.5'/>`
    );
    // Through what its group gives it: the group's stroke, the group's fill-opacity.
    expect(cull(`<g stroke='#000'><circle cx='9' cy='9' r='5' opacity='0.5'/></g>`)).toBe(
      `<g stroke='#000'><circle cx='9' cy='9' r='5' opacity='0.5'/></g>`
    );
    expect(
      cull(`<g fill-opacity='0.5'><circle cx='9' cy='9' r='5' fill='#fff' opacity='0.5'/></g>`)
    ).toBe(
      `<g fill-opacity='0.5'><circle cx='9' cy='9' r='5' fill='#fff' fill-opacity='0.25'/></g>`
    );
    // A fill and a stroke overlap, and a group's shapes may too: those keep their opacity.
    const both = `<circle cx='9' cy='9' r='5' fill='#fff' stroke='#000' opacity='0.5'/>`;
    expect(cull(both)).toBe(both);
    const group = `<g opacity='0.5'><circle cx='9' cy='9' r='5'/><circle cx='12' cy='9' r='5'/></g>`;
    expect(cull(group)).toBe(group);
  });

  it('leaves out a canvas outside the bounds of the blurred one it is drawn on', () => {
    // resvg bounds a canvas inside another by the outer one's corner, not the frame: zoomed
    // in twice, this blur starts some 1700 px left of the frame, so a see-through group of
    // two leaves 1860 px right of it lies outside, and resvg panicked on it.
    const blur = `<defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='20'/></filter></defs>`;
    const leaves = `<g opacity='0.8'><circle cx='1250' cy='400' r='10' fill='#fff'/><circle cx='1262' cy='400' r='10' fill='#ffe'/></g>`;
    const near = `<g opacity='0.8'><circle cx='700' cy='400' r='10' fill='#fff'/><circle cx='712' cy='400' r='10' fill='#ffe'/></g>`;
    const svg = (inner: string) =>
      `${blur}<g transform='translate(640 360) scale(2) translate(-640 -360)'><g filter='url(#b)'><rect x='-200' y='300' width='1500' height='200' fill='#9a8'/>${inner}</g></g>`;
    expect(cullOffFrame(svg(near + leaves), id(''), W, H)).toBe(svg(near));
    // Unzoomed, the same leaves lie within its bounds and stay.
    const flat = svg(near + leaves).replace(' scale(2)', '');
    expect(cullOffFrame(flat, id(''), W, H)).toBe(flat);
  });

  it('draws a close-up whose layered shapes lie far off the frame', () => {
    // Before culling, resvg aborted the whole process on this frame.
    const p = closeUp(
      {
        id: 'far-leaf',
        name: 'Far leaf',
        svg: `<rect width='1280' height='720' fill='#9c6'/><ellipse cx='1250' cy='10' rx='20' ry='9' fill='#585' opacity='0.8'/>`,
        near: `<circle cx='-200' cy='900' r='40' fill='#363' opacity='0.6'/>`,
      },
      { zoom: 4, x: 160, y: 630 }
    );
    expect(isPng(rasterize(composeFrame(p, p.shots[0], 0.5), 320))).toBe(true);
  });

  it('draws a close-up into a blurred, swaying crown with see-through leaves', () => {
    // A crown wider than the frame, blurred on the far layer, swaying, its leaves
    // see-through: a story's scene drawn this way had resvg panic past zoom 1.4.
    const leaves = Array.from(
      { length: 12 },
      (_, i) =>
        `<path d='M${i * 120 - 60} 220 q 20 -20 40 0 t 40 0' fill='#9b6' opacity='0.8'/>` +
        `<g opacity='0.7'><circle cx='${i * 120}' cy='300' r='14' fill='#7a4'/><circle cx='${i * 120 + 10}' cy='306' r='14' fill='#8b5'/></g>`
    ).join('');
    const scene = {
      id: 'crown',
      name: 'Crown',
      far:
        `<defs><filter id='cb' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='22'/></filter></defs>` +
        `<rect width='1280' height='720' fill='#bcd'/>` +
        `<g filter='url(#cb)'><g id='crown'><path d='M-230 0 Q640 -200 1550 0 Q640 260 -230 0Z' fill='#ab8'/>${leaves}</g></g>`,
      svg: `<rect y='600' width='1280' height='120' fill='#9c6'/>`,
      sway: { crown: { at: [640, 0] } },
    };
    for (const [x, y] of [
      [640, 360],
      [100, 100],
      [1180, 620],
    ]) {
      const p = closeUp(scene, { zoom: 2.5, x, y }, 4);
      expect(isPng(rasterize(composeFrame(p, p.shots[0], 1.3), 320))).toBe(true);
    }
  });
});
