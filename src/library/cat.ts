import type { CharacterInput } from '../engine/types.js';

/**
 * A slim tabby cat: pointed ears sunk into the head, an S-curve tail from inside the rump,
 * whiskers as thin line work (no outline), slit pupils in green eyes.
 */
export const CAT: CharacterInput = {
  id: 'cat',
  name: 'Cat',
  description: 'Slim tabby cat (quadruped rig): prowls, gallops, sits upright, lifts a paw.',
  rig: 'quadruped',
  height: 90,
  colors: {
    fur: '#f0a04b',
    furDark: '#c97b2c',
    furLight: '#fde3c2',
    stripe: '#c26b1d',
    nose: '#e8758a',
    earIn: '#f6b6a8',
    iris: '#7cb342',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='69.5' cy='193' rx='10' ry='7' fill='{furDark}'/>`,
    legFL: `<path d='M178 132 L178 191' stroke='{furDark}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='181.5' cy='193' rx='10' ry='7' fill='{furDark}'/>`,
    tail: `<path d='M60 120 Q22 124 24 88 Q26 58 10 44' stroke='{fur}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M22 70 Q24 62 20 54' stroke='{stripe}' stroke-width='12' stroke-linecap='butt' fill='none'/>`,
    body: `<ellipse cx='80' cy='124' rx='32' ry='26' fill='{fur}'/><ellipse cx='172' cy='122' rx='30' ry='28' fill='{fur}'/><rect x='80' y='98' width='92' height='52' fill='{fur}'/><path d='M84 140 Q126 154 170 140 Q164 150 126 151 Q92 150 84 140 Z' fill='{furLight}'/><path d='M110 99 L114 112' stroke='{stripe}' stroke-width='6' stroke-linecap='round' fill='none'/><path d='M128 98 L130 112' stroke='{stripe}' stroke-width='6' stroke-linecap='round' fill='none'/><path d='M146 99 L146 112' stroke='{stripe}' stroke-width='6' stroke-linecap='round' fill='none'/>`,
    legBR: `<path d='M82 132 L82 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='85.5' cy='193' rx='10' ry='7' fill='{fur}'/>`,
    legFR: `<path d='M194 132 L194 191' stroke='{fur}' stroke-width='14' stroke-linecap='round' fill='none'/><ellipse cx='197.5' cy='193' rx='10' ry='7' fill='{fur}'/>`,
    earL: `<path d='M190 66 L194 18 L222 56 Z' fill='{furDark}'/>`,
    head: `<path d='M184 124 L204 94' stroke='{fur}' stroke-width='30' stroke-linecap='round' fill='none'/><circle cx='212' cy='72' r='30' fill='{fur}'/><ellipse cx='230' cy='86' rx='14' ry='10' fill='{furLight}'/><path d='M198 46 L202 56' stroke='{stripe}' stroke-width='5' stroke-linecap='round' fill='none'/><path d='M210 43 L211 54' stroke='{stripe}' stroke-width='5' stroke-linecap='round' fill='none'/><path d='M236 76 L248 76 L242 83 Z' fill='{nose}'/><path d='M236 86 L260 82' stroke='{line}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M236 89 L259 92' stroke='{line}' stroke-width='1.6' stroke-linecap='round' fill='none'/>`,
    earR: `<path d='M206 60 L218 14 L240 58 Z' fill='{fur}'/><path d='M214 46 L219 26 L230 46 Z' fill='{earIn}'/>`,
    eyes: {
      open: `<ellipse cx='224' cy='66' rx='7' ry='8' fill='#fff'/><circle cx='226' cy='67' r='4.5' fill='{iris}'/><ellipse cx='226' cy='67' rx='1.7' ry='3.8' fill='{line}'/><circle cx='227.5' cy='64.5' r='1.6' fill='#fff'/>`,
      closed: `<path d='M217 67 Q224 73 231 67' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='224' cy='65' rx='9' ry='10' fill='#fff'/><circle cx='225' cy='66' r='3.5' fill='{iris}'/><ellipse cx='225' cy='66' rx='1.3' ry='3' fill='{line}'/><circle cx='226.5' cy='63.5' r='1.3' fill='#fff'/>`,
      happy: `<path d='M217 69 Q224 60 231 69' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='224' cy='67' rx='7' ry='7' fill='#fff'/><circle cx='225' cy='69' r='4.5' fill='{iris}'/><ellipse cx='225' cy='69' rx='1.7' ry='3.8' fill='{line}'/><path d='M215 58 L231 54' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='224' cy='67' rx='7' ry='6.5' fill='#fff'/><circle cx='226' cy='68' r='4.5' fill='{iris}'/><ellipse cx='226' cy='68' rx='1.7' ry='3.8' fill='{line}'/><path d='M215 54 L232 61' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M229.2 92.2 Q236 96.4 242.8 91.3' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M225.8 89.6 Q236 103.2 246.2 88.8 Q236 93.8 225.8 89.6 Z' fill='{mouth}'/><path d='M230.9 95.5 Q236 93 241.1 95.5 Q236 99 230.9 95.5 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='236' cy='94.7' rx='6.8' ry='6' fill='{mouth}'/><ellipse cx='236' cy='98.1' rx='4.2' ry='2.5' fill='{tongue}'/>`,
      sad: `<path d='M228.3 95.5 Q236 88.8 243.7 94.7' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M227.5 94.7 Q236 90.5 244.5 93.8' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M226.7 94.7 Q230.9 90.5 235.2 94.7 Q239.4 99 244.5 93.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    },
  },
};
