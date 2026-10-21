import type { CharacterInput } from '../engine/types.js';

/**
 * A round rabbit: a big haunch over long hind feet, short front legs, a pom tail sunk into
 * the rump, and tall ears whose bases sink 14 units into the head.
 */
export const RABBIT: CharacterInput = {
  id: 'rabbit',
  name: 'Rabbit',
  description: 'Round rabbit with tall ears (quadruped rig): hops, sits up, twitches its nose.',
  rig: 'quadruped',
  height: 100,
  colors: {
    fur: '#d8cfc4',
    furDark: '#b3a698',
    furLight: '#ffffff',
    earIn: '#f4b6c2',
    nose: '#e8758a',
    mouth: '#7a2a32',
    tongue: '#f08080',
    tooth: '#ffffff',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 186' stroke='{furDark}' stroke-width='18' stroke-linecap='round' fill='none'/><ellipse cx='80' cy='193' rx='20' ry='7' fill='{furDark}'/>`,
    legFL: `<path d='M178 132 L178 191.5' stroke='{furDark}' stroke-width='13' stroke-linecap='round' fill='none'/><ellipse cx='181.2' cy='195' rx='10' ry='5' fill='{furDark}'/>`,
    tail: `<circle cx='48' cy='110' r='14' fill='{furLight}'/>`,
    body: `<ellipse cx='98' cy='128' rx='54' ry='44' fill='{fur}'/><ellipse cx='166' cy='132' rx='34' ry='34' fill='{fur}'/><path d='M110 156 Q150 174 186 152 Q178 166 150 168 Q120 168 110 156 Z' fill='{furLight}'/>`,
    legBR: `<path d='M82 132 L82 186' stroke='{fur}' stroke-width='18' stroke-linecap='round' fill='none'/><ellipse cx='96' cy='193' rx='20' ry='7' fill='{fur}'/>`,
    legFR: `<path d='M194 132 L194 191.5' stroke='{fur}' stroke-width='13' stroke-linecap='round' fill='none'/><ellipse cx='197.2' cy='195' rx='10' ry='5' fill='{fur}'/>`,
    earL: `<ellipse cx='200' cy='34' rx='10' ry='28' fill='{furDark}' transform='rotate(-14 204 46)'/>`,
    head: `<path d='M178 128 L198 100' stroke='{fur}' stroke-width='34' stroke-linecap='round' fill='none'/><circle cx='208' cy='76' r='32' fill='{fur}'/><ellipse cx='230' cy='88' rx='15' ry='11' fill='{furLight}'/><ellipse cx='240' cy='83' rx='5' ry='4' fill='{nose}'/>`,
    earR: `<g transform='rotate(-6 220 46)'><ellipse cx='222' cy='33' rx='11' ry='29' fill='{fur}'/><ellipse cx='222' cy='30' rx='5.5' ry='19' fill='{earIn}'/></g>`,
    eyes: {
      open: `<ellipse cx='222' cy='68' rx='7' ry='8' fill='#fff'/><circle cx='224' cy='69' r='4.5' fill='{line}'/><circle cx='225.5' cy='66.5' r='1.6' fill='#fff'/>`,
      closed: `<path d='M215 69 Q222 75 229 69' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='222' cy='67' rx='9' ry='10' fill='#fff'/><circle cx='223' cy='68' r='3.5' fill='{line}'/><circle cx='224.5' cy='65.5' r='1.3' fill='#fff'/>`,
      happy: `<path d='M215 71 Q222 62 229 71' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='222' cy='69' rx='7' ry='7' fill='#fff'/><circle cx='223' cy='71' r='4.5' fill='{line}'/><path d='M213 60 L229 56' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='222' cy='69' rx='7' ry='6.5' fill='#fff'/><circle cx='224' cy='70' r='4.5' fill='{line}'/><path d='M213 56 L230 63' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M230 94.2 Q236 98 242 93.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M227 92 Q236 104 245 91.2 Q236 95.8 227 92 Z' fill='{mouth}'/><path d='M231.5 97.2 Q236 95 240.5 97.2 Q236 100.2 231.5 97.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='236' cy='96.5' rx='6' ry='5.2' fill='{mouth}'/><ellipse cx='236' cy='99.5' rx='3.8' ry='2.2' fill='{tongue}'/>`,
      sad: `<path d='M229.2 97.2 Q236 91.2 242.8 96.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M228.5 96.5 Q236 92.8 243.5 95.8' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M227.8 96.5 Q231.5 92.8 235.2 96.5 Q239 100.2 243.5 95.8' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
    },
  },
};
