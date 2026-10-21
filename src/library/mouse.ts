import type { CharacterInput } from '../engine/types.js';

/**
 * A round little mouse: a ball of a body that hides most of the legs, big round ears that
 * sink well into the head, a long thin tail (thin enough to be line work, so no outline).
 */
export const MOUSE: CharacterInput = {
  id: 'mouse',
  name: 'Mouse',
  description: 'Little round grey mouse with big ears (quadruped rig): scurries, sits up, squeaks.',
  rig: 'quadruped',
  height: 56,
  colors: {
    fur: '#a7a3b4',
    furDark: '#86829a',
    furLight: '#e9e6f0',
    earIn: '#f4b6c2',
    feet: '#f4b6c2',
    tailPink: '#e597a8',
    nose: '#e8758a',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='69.5' cy='193' rx='10' ry='7' fill='{feet}'/>`,
    legFL: `<path d='M178 132 L178 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='181.5' cy='193' rx='10' ry='7' fill='{feet}'/>`,
    tail: `<path d='M74 128 Q50 104 34 112 Q12 124 6 98' stroke='{tailPink}' stroke-width='6' stroke-linecap='round' fill='none'/>`,
    body: `<ellipse cx='124' cy='140' rx='78' ry='48' fill='{fur}'/><path d='M70 166 Q124 196 186 164 Q172 186 124 188 Q86 188 70 166 Z' fill='{furLight}'/>`,
    legBR: `<path d='M82 132 L82 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='85.5' cy='193' rx='10' ry='7' fill='{feet}'/>`,
    legFR: `<path d='M194 132 L194 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='197.5' cy='193' rx='10' ry='7' fill='{feet}'/>`,
    earL: `<circle cx='196' cy='56' r='22' fill='{furDark}'/>`,
    head: `<path d='M180 132 L196 112' stroke='{fur}' stroke-width='36' stroke-linecap='round' fill='none'/><circle cx='206' cy='96' r='34' fill='{fur}'/><path d='M226 80 Q248 88 256 100 Q250 112 230 114 Z' fill='{fur}'/><circle cx='252' cy='99' r='5' fill='{nose}'/><path d='M240 104 L259 98' stroke='{line}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M240 108 L258 110' stroke='{line}' stroke-width='1.6' stroke-linecap='round' fill='none'/>`,
    earR: `<circle cx='224' cy='54' r='24' fill='{fur}'/><circle cx='225' cy='55' r='14' fill='{earIn}'/>`,
    eyes: {
      open: `<ellipse cx='226' cy='90' rx='5.6' ry='6.4' fill='#fff'/><circle cx='227.6' cy='90.8' r='3.6' fill='{line}'/><circle cx='228.8' cy='88.8' r='1.3' fill='#fff'/>`,
      closed: `<path d='M220.4 90.8 Q226 95.6 231.6 90.8' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='226' cy='89.2' rx='7.2' ry='8' fill='#fff'/><circle cx='226.8' cy='90' r='2.8' fill='{line}'/><circle cx='228' cy='88' r='1' fill='#fff'/>`,
      happy: `<path d='M220.4 92.4 Q226 85.2 231.6 92.4' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='226' cy='90.8' rx='5.6' ry='5.6' fill='#fff'/><circle cx='226.8' cy='92.4' r='3.6' fill='{line}'/><path d='M218.8 83.6 L231.6 80.4' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='226' cy='90.8' rx='5.6' ry='5.2' fill='#fff'/><circle cx='227.6' cy='91.6' r='3.6' fill='{line}'/><path d='M218.8 80.4 L232.4 86' stroke='{line}' stroke-width='3.3' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M235.2 113.4 Q240 116.4 244.8 112.8' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M232.8 111.6 Q240 121.2 247.2 111 Q240 114.6 232.8 111.6 Z' fill='{mouth}'/><path d='M236.4 115.8 Q240 114 243.6 115.8 Q240 118.2 236.4 115.8 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='240' cy='115.2' rx='4.8' ry='4.2' fill='{mouth}'/><ellipse cx='240' cy='117.6' rx='3' ry='1.8' fill='{tongue}'/>`,
      sad: `<path d='M234.6 115.8 Q240 111 245.4 115.2' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M234 115.2 Q240 112.2 246 114.6' stroke='{line}' stroke-width='2.6' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M233.4 115.2 Q236.4 112.2 239.4 115.2 Q242.4 118.2 246 114.6' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
    },
  },
};
