import type { CharacterInput } from '../engine/types.js';

/**
 * A lion: heavy legs with big paws, a scalloped mane drawn first in the head part so the face
 * sits on it, a thin tail ending in a tuft, round ears on the mane.
 */
export const LION: CharacterInput = {
  id: 'lion',
  name: 'Lion',
  description:
    'Lion with a big scalloped mane (quadruped rig): prowls, roars, gallops, sits proud.',
  rig: 'quadruped',
  height: 170,
  colors: {
    fur: '#e8b04b',
    furDark: '#c48a2c',
    furLight: '#f8dc9a',
    mane: '#b5621f',
    maneDark: '#93491a',
    nose: '#6b3a2a',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 188' stroke='{furDark}' stroke-width='20' stroke-linecap='round' fill='none'/><ellipse cx='71' cy='193' rx='14' ry='7' fill='{furDark}'/>`,
    legFL: `<path d='M178 132 L178 188' stroke='{furDark}' stroke-width='20' stroke-linecap='round' fill='none'/><ellipse cx='183' cy='193' rx='14' ry='7' fill='{furDark}'/>`,
    tail: `<path d='M62 116 Q44 108 30 120 Q16 130 18 96' stroke='{fur}' stroke-width='9' stroke-linecap='round' fill='none'/><ellipse cx='18' cy='88' rx='9' ry='12' fill='{maneDark}'/>`,
    body: `<ellipse cx='80' cy='120' rx='34' ry='30' fill='{fur}'/><ellipse cx='170' cy='118' rx='36' ry='34' fill='{fur}'/><rect x='80' y='90' width='90' height='60' fill='{fur}'/><path d='M86 140 Q128 156 168 142 Q164 152 128 153 Q94 152 86 140 Z' fill='{furLight}'/>`,
    legBR: `<path d='M82 132 L82 188' stroke='{fur}' stroke-width='20' stroke-linecap='round' fill='none'/><ellipse cx='87' cy='193' rx='14' ry='7' fill='{fur}'/>`,
    legFR: `<path d='M194 132 L194 188' stroke='{fur}' stroke-width='20' stroke-linecap='round' fill='none'/><ellipse cx='199' cy='193' rx='14' ry='7' fill='{fur}'/>`,
    earL: `<circle cx='202' cy='50' r='10' fill='{furDark}'/>`,
    head: `<path d='M182 124 L204 96' stroke='{fur}' stroke-width='34' stroke-linecap='round' fill='none'/><path d='M250.2 64.2 Q260.9 73.1 251.3 83.3 Q256.6 96.2 243.4 100.7 Q242.1 114.6 228.3 112.5 Q220.7 124.2 209.5 115.9 Q197.3 122.8 191.2 110.2 Q177.3 110.6 177.7 96.6 Q165.2 90.5 172.1 78.3 Q163.8 67.1 175.6 59.5 Q173.5 45.7 187.4 44.5 Q192 31.3 204.9 36.6 Q215.1 27.1 224 37.8 Q237.4 34.1 240.3 47.8 Q254 50.7 250.2 64.2 Z' fill='{mane}'/><circle cx='218' cy='78' r='27' fill='{fur}'/><ellipse cx='236' cy='92' rx='16' ry='12' fill='{furLight}'/><path d='M242 80 L254 80 L248 88 Z' fill='{nose}'/>`,
    earR: `<circle cx='226' cy='50' r='11' fill='{fur}'/><circle cx='227' cy='49' r='5.5' fill='{furLight}'/>`,
    eyes: {
      open: `<ellipse cx='228' cy='72' rx='6.3' ry='7.2' fill='#fff'/><circle cx='229.8' cy='72.9' r='4' fill='{line}'/><circle cx='231.2' cy='70.7' r='1.4' fill='#fff'/>`,
      closed: `<path d='M221.7 72.9 Q228 78.3 234.3 72.9' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='228' cy='71.1' rx='8.1' ry='9' fill='#fff'/><circle cx='228.9' cy='72' r='3.1' fill='{line}'/><circle cx='230.2' cy='69.8' r='1.2' fill='#fff'/>`,
      happy: `<path d='M221.7 74.7 Q228 66.6 234.3 74.7' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='228' cy='72.9' rx='6.3' ry='6.3' fill='#fff'/><circle cx='228.9' cy='74.7' r='4' fill='{line}'/><path d='M219.9 64.8 L234.3 61.2' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='228' cy='72.9' rx='6.3' ry='5.9' fill='#fff'/><circle cx='229.8' cy='73.8' r='4' fill='{line}'/><path d='M219.9 61.2 L235.2 67.5' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M238 98.2 Q244 102 250 97.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M235 96 Q244 108 253 95.2 Q244 99.8 235 96 Z' fill='{mouth}'/><path d='M239.5 101.2 Q244 99 248.5 101.2 Q244 104.2 239.5 101.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='244' cy='100.5' rx='6' ry='5.2' fill='{mouth}'/><ellipse cx='244' cy='103.5' rx='3.8' ry='2.2' fill='{tongue}'/>`,
      sad: `<path d='M237.2 101.2 Q244 95.2 250.8 100.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M236.5 100.5 Q244 96.8 251.5 99.8' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M235.8 100.5 Q239.5 96.8 243.2 100.5 Q247 104.2 251.5 99.8' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
    },
  },
};
