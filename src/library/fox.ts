import type { CharacterInput } from '../engine/types.js';

/**
 * A fox: dark socks on slim legs, a big bushy tail with a white tip that grows out of the
 * rump, tall pointed ears with dark backs, a long white-cheeked snout.
 */
export const FOX: CharacterInput = {
  id: 'fox',
  name: 'Fox',
  description: 'Red fox with a bushy white-tipped tail (quadruped rig): sly trot, quick gallop.',
  rig: 'quadruped',
  height: 110,
  colors: {
    fur: '#e8702a',
    furDark: '#c4561a',
    furLight: '#ffffff',
    sock: '#3b2a2f',
    earIn: '#3b2a2f',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M66 175 L66 191' stroke='{sock}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='69.5' cy='193' rx='10' ry='7' fill='{sock}'/>`,
    legFL: `<path d='M178 132 L178 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M178 175 L178 191' stroke='{sock}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='181.5' cy='193' rx='10' ry='7' fill='{sock}'/>`,
    tail: `<path d='M74 114 Q36 130 14 108 Q0 90 10 66 Q30 70 40 88 Q52 102 74 102 Z' fill='{fur}'/><path d='M14 108 Q0 90 10 66 Q20 66 26 76 Q18 92 26 108 Q20 112 14 108 Z' fill='{furLight}'/>`,
    body: `<ellipse cx='80' cy='122' rx='30' ry='26' fill='{fur}'/><ellipse cx='176' cy='121' rx='31' ry='29' fill='{fur}'/><rect x='80' y='96' width='96' height='52' fill='{fur}'/><path d='M150 140 Q170 152 196 132 Q194 148 172 150 Q156 150 150 140 Z' fill='{furLight}'/>`,
    legBR: `<path d='M82 132 L82 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M82 175 L82 191' stroke='{sock}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='85.5' cy='193' rx='10' ry='7' fill='{sock}'/>`,
    legFR: `<path d='M194 132 L194 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M194 175 L194 191' stroke='{sock}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='197.5' cy='193' rx='10' ry='7' fill='{sock}'/>`,
    earL: `<path d='M188 66 L192 12 L222 56 Z' fill='{sock}'/>`,
    head: `<path d='M184 124 L204 94' stroke='{fur}' stroke-width='30' stroke-linecap='round' fill='none'/><circle cx='210' cy='72' r='28' fill='{fur}'/><path d='M214 62 Q238 64 256 80 Q250 92 230 94 Q212 94 204 84 Z' fill='{fur}'/><path d='M206 84 Q222 96 244 92 Q252 90 256 82 Q246 98 226 100 Q208 98 206 84 Z' fill='{furLight}'/><ellipse cx='253' cy='80' rx='5' ry='4.5' fill='{nose}'/>`,
    earR: `<path d='M204 62 L214 10 L240 58 Z' fill='{fur}'/><path d='M209 30 L214 10 L222 20 Z' fill='{sock}'/><path d='M214 46 L217 28 L229 46 Z' fill='{furLight}'/>`,
    eyes: {
      open: `<ellipse cx='222' cy='66' rx='6' ry='6.8' fill='#fff'/><circle cx='223.7' cy='66.8' r='3.8' fill='{line}'/><circle cx='225' cy='64.7' r='1.4' fill='#fff'/>`,
      closed: `<path d='M216.1 66.8 Q222 72 227.9 66.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='222' cy='65.2' rx='7.6' ry='8.5' fill='#fff'/><circle cx='222.8' cy='66' r='3' fill='{line}'/><circle cx='224.1' cy='63.9' r='1.1' fill='#fff'/>`,
      happy: `<path d='M216.1 68.5 Q222 60.9 227.9 68.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='222' cy='66.8' rx='6' ry='6' fill='#fff'/><circle cx='222.8' cy='68.5' r='3.8' fill='{line}'/><path d='M214.3 59.2 L227.9 55.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='222' cy='66.8' rx='6' ry='5.5' fill='#fff'/><circle cx='223.7' cy='67.7' r='3.8' fill='{line}'/><path d='M214.3 55.8 L228.8 61.8' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M232.4 95.3 Q238 98.8 243.6 94.6' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M229.6 93.2 Q238 104.4 246.4 92.5 Q238 96.7 229.6 93.2 Z' fill='{mouth}'/><path d='M233.8 98.1 Q238 96 242.2 98.1 Q238 100.9 233.8 98.1 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='238' cy='97.4' rx='5.6' ry='4.9' fill='{mouth}'/><ellipse cx='238' cy='100.2' rx='3.5' ry='2.1' fill='{tongue}'/>`,
      sad: `<path d='M231.7 98.1 Q238 92.5 244.3 97.4' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M231 97.4 Q238 93.9 245 96.7' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M230.3 97.4 Q233.8 93.9 237.3 97.4 Q240.8 100.9 245 96.7' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    },
  },
};
