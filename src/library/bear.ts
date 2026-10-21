import type { CharacterInput } from '../engine/types.js';

/**
 * A big round bear: thick legs sunk deep into a heavy body, a stub tail, round ears with a
 * lighter inside, a pale muzzle.
 */
export const BEAR: CharacterInput = {
  id: 'bear',
  name: 'Bear',
  description: 'Big round brown bear (quadruped rig): lumbers, sits back on its haunches.',
  rig: 'quadruped',
  height: 180,
  colors: {
    fur: '#8d5a3b',
    furDark: '#6f4329',
    furLight: '#d9b48f',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 186' stroke='{furDark}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='71' cy='193' rx='16.8' ry='7' fill='{furDark}'/>`,
    legFL: `<path d='M178 132 L178 186' stroke='{furDark}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='183' cy='193' rx='16.8' ry='7' fill='{furDark}'/>`,
    tail: `<circle cx='50' cy='106' r='11' fill='{furDark}'/>`,
    body: `<ellipse cx='84' cy='116' rx='40' ry='38' fill='{fur}'/><ellipse cx='168' cy='116' rx='40' ry='40' fill='{fur}'/><rect x='84' y='78' width='84' height='78' fill='{fur}'/>`,
    legBR: `<path d='M82 132 L82 186' stroke='{fur}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='87' cy='193' rx='16.8' ry='7' fill='{fur}'/>`,
    legFR: `<path d='M194 132 L194 186' stroke='{fur}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='199' cy='193' rx='16.8' ry='7' fill='{fur}'/>`,
    earL: `<circle cx='201' cy='50' r='12' fill='{furDark}'/>`,
    head: `<path d='M182 116 L204 92' stroke='{fur}' stroke-width='40' stroke-linecap='round' fill='none'/><circle cx='214' cy='78' r='32' fill='{fur}'/><ellipse cx='238' cy='90' rx='18' ry='13' fill='{furLight}'/><ellipse cx='250' cy='84' rx='7' ry='6' fill='{nose}'/>`,
    earR: `<circle cx='223' cy='49' r='12' fill='{fur}'/><circle cx='223' cy='47' r='6' fill='{furLight}'/>`,
    eyes: {
      open: `<ellipse cx='228' cy='70' rx='6' ry='6.8' fill='#fff'/><circle cx='229.7' cy='70.8' r='3.8' fill='{line}'/><circle cx='231' cy='68.7' r='1.4' fill='#fff'/>`,
      closed: `<path d='M222.1 70.8 Q228 76 233.9 70.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='228' cy='69.2' rx='7.6' ry='8.5' fill='#fff'/><circle cx='228.8' cy='70' r='3' fill='{line}'/><circle cx='230.1' cy='67.9' r='1.1' fill='#fff'/>`,
      happy: `<path d='M222.1 72.5 Q228 64.9 233.9 72.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='228' cy='70.8' rx='6' ry='6' fill='#fff'/><circle cx='228.8' cy='72.5' r='3.8' fill='{line}'/><path d='M220.3 63.2 L233.9 59.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='228' cy='70.8' rx='6' ry='5.5' fill='#fff'/><circle cx='229.7' cy='71.7' r='3.8' fill='{line}'/><path d='M220.3 59.8 L234.8 65.8' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M236 97.2 Q242 101 248 96.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M233 95 Q242 107 251 94.2 Q242 98.8 233 95 Z' fill='{mouth}'/><path d='M237.5 100.2 Q242 98 246.5 100.2 Q242 103.2 237.5 100.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='242' cy='99.5' rx='6' ry='5.2' fill='{mouth}'/><ellipse cx='242' cy='102.5' rx='3.8' ry='2.2' fill='{tongue}'/>`,
      sad: `<path d='M235.2 100.2 Q242 94.2 248.8 99.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M234.5 99.5 Q242 95.8 249.5 98.8' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M233.8 99.5 Q237.5 95.8 241.2 99.5 Q245 103.2 249.5 98.8' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
    },
  },
};
