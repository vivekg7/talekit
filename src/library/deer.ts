import type { CharacterInput } from '../engine/types.js';

/**
 * A slim spotted deer: long legs with dark hooves, the neck drawn in the head part so a nod
 * lowers the whole neck, small antlers behind the head (thick enough to take the outline).
 */
export const DEER: CharacterInput = {
  id: 'deer',
  name: 'Deer',
  description:
    'Slim spotted deer with small antlers (quadruped rig): long legs, a long neck that nods.',
  rig: 'quadruped',
  height: 190,
  colors: {
    fur: '#c98a4b',
    furDark: '#a86d35',
    furLight: '#f6e2c4',
    hoof: '#4a3426',
    antler: '#e8d3a8',
    spot: '#f6e2c4',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 190' stroke='{furDark}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M59 184 L73 184 L74 200 L58 200 Z' fill='{hoof}'/>`,
    legFL: `<path d='M178 132 L178 190' stroke='{furDark}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M171 184 L185 184 L186 200 L170 200 Z' fill='{hoof}'/>`,
    tail: `<path d='M68 104 Q40 90 36 110 Q38 126 68 122 Z' fill='{fur}'/><ellipse cx='43' cy='111' rx='6' ry='8' fill='{furLight}'/>`,
    body: `<ellipse cx='80' cy='118' rx='30' ry='26' fill='{fur}'/><ellipse cx='178' cy='120' rx='32' ry='30' fill='{fur}'/><rect x='80' y='92' width='98' height='52' fill='{fur}'/><path d='M86 134 Q128 150 168 134 Q164 144 128 145 Q94 144 86 134 Z' fill='{furLight}'/><circle cx='104' cy='104' r='4' fill='{spot}' opacity='0.9'/><circle cx='122' cy='100' r='3.5' fill='{spot}' opacity='0.9'/><circle cx='140' cy='104' r='4' fill='{spot}' opacity='0.9'/><circle cx='114' cy='114' r='3' fill='{spot}' opacity='0.9'/><circle cx='132' cy='114' r='3.5' fill='{spot}' opacity='0.9'/>`,
    legBR: `<path d='M82 132 L82 190' stroke='{fur}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M75 184 L89 184 L90 200 L74 200 Z' fill='{hoof}'/>`,
    legFR: `<path d='M194 132 L194 190' stroke='{fur}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M187 184 L201 184 L202 200 L186 200 Z' fill='{hoof}'/>`,
    earL: `<path d='M210 52 Q192 44 184 30 Q202 28 214 42 Z' fill='{furDark}'/>`,
    head: `<path d='M208 12 L215 42' stroke='{antler}' stroke-width='7' stroke-linecap='round' fill='none'/><path d='M210 22 L198 12' stroke='{antler}' stroke-width='6' stroke-linecap='round' fill='none'/><path d='M224 10 L219 42' stroke='{antler}' stroke-width='7' stroke-linecap='round' fill='none'/><path d='M221 20 L232 11' stroke='{antler}' stroke-width='6' stroke-linecap='round' fill='none'/><path d='M182 122 L212 62' stroke='{fur}' stroke-width='26' stroke-linecap='round' fill='none'/><ellipse cx='218' cy='50' rx='22' ry='18' fill='{fur}'/><ellipse cx='240' cy='58' rx='15' ry='10' fill='{furLight}'/><ellipse cx='252' cy='55' rx='5' ry='4' fill='{nose}'/>`,
    earR: `<path d='M224 52 Q202 46 192 28 Q214 26 228 42 Z' fill='{fur}'/><path d='M218 44 Q206 40 200 32 Q212 32 220 40 Z' fill='{furLight}'/>`,
    eyes: {
      open: `<ellipse cx='226' cy='46' rx='6' ry='6.8' fill='#fff'/><circle cx='227.7' cy='46.9' r='3.8' fill='{line}'/><circle cx='229' cy='44.7' r='1.4' fill='#fff'/>`,
      closed: `<path d='M220.1 46.9 Q226 52 231.9 46.9' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='226' cy='45.1' rx='7.6' ry='8.5' fill='#fff'/><circle cx='226.8' cy='46' r='3' fill='{line}'/><circle cx='228.1' cy='43.9' r='1.1' fill='#fff'/>`,
      happy: `<path d='M220.1 48.5 Q226 40.9 231.9 48.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='226' cy='46.9' rx='6' ry='6' fill='#fff'/><circle cx='226.8' cy='48.5' r='3.8' fill='{line}'/><path d='M218.3 39.2 L231.9 35.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='226' cy='46.9' rx='6' ry='5.5' fill='#fff'/><circle cx='227.7' cy='47.7' r='3.8' fill='{line}'/><path d='M218.3 35.8 L232.8 41.8' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M238.2 65.4 Q243 68.4 247.8 64.8' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M235.8 63.6 Q243 73.2 250.2 63 Q243 66.6 235.8 63.6 Z' fill='{mouth}'/><path d='M239.4 67.8 Q243 66 246.6 67.8 Q243 70.2 239.4 67.8 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='243' cy='67.2' rx='4.8' ry='4.2' fill='{mouth}'/><ellipse cx='243' cy='69.6' rx='3' ry='1.8' fill='{tongue}'/>`,
      sad: `<path d='M237.6 67.8 Q243 63 248.4 67.2' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M237 67.2 Q243 64.2 249 66.6' stroke='{line}' stroke-width='2.6' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M236.4 67.2 Q239.4 64.2 242.4 67.2 Q245.4 70.2 249 66.6' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
    },
  },
};
