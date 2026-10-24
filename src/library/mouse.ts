import type { CharacterInput } from '../engine/types.js';

/**
 * A tiny round mouse: a pear of a body fat at the rump with a pale belly, a round haunch on
 * the near hind leg, short legs on little pink feet, big round ears with pink insides sunk
 * into the head, a pointy snout with a pink button nose and whiskers (thin line work, no
 * outline), a big dark eye, and a long tail that thins to a point (a filled path along a
 * curve, not a stroke).
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
    toe: '#d67f93',
    nose: '#e8758a',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 132 L66 194' stroke='{furDark}' stroke-width='10' stroke-linecap='round' fill='none'/><ellipse cx='72' cy='194' rx='11' ry='6' fill='{feet}'/>`,
    legFL: `<path d='M178 132 L178 194' stroke='{furDark}' stroke-width='10' stroke-linecap='round' fill='none'/><ellipse cx='181.5' cy='194' rx='8.5' ry='6' fill='{feet}'/>`,
    tail: `<path d='M63.0 122.7 L56.2 116.7 L48.5 112.2 L40.8 108.9 L33.4 106.3 L26.7 103.8 L21.0 100.9 L16.5 97.4 L13.2 92.6 L11.8 87.6 L12.5 83.3 L14.6 79.0 L17.9 74.3 L21.6 69.0 L24.9 63.0 L26.8 55.9 L26.5 47.7 L25.2 43.6 L23.4 40.2 L21.2 37.4 L18.7 35.1 L15.9 33.7 L12.9 33.0 L9.9 33.4 L7.4 34.6 A1.5 1.5 0 0 1 8.6 37.4 L10.7 36.5 L12.6 36.5 L14.5 37.1 L16.3 38.4 L18.0 40.1 L19.6 42.5 L20.8 45.3 L21.5 48.3 L21.6 55.3 L19.8 60.9 L16.8 65.9 L13.1 70.7 L9.3 75.7 L6.3 81.3 L5.1 87.9 L6.8 95.4 L11.1 102.2 L16.9 107.2 L23.5 110.8 L30.6 113.7 L37.7 116.5 L44.6 119.7 L51.0 123.7 L57.0 129.3 A4.5 4.5 0 0 1 63.0 122.7 Z' fill='{tailPink}'/>`,
    body: `<path d='M188 108 C168 86 138 74 104 76 C66 78 38 106 40 136 C42 156 64 167 100 167 C140 167 178 164 198 152 C212 144 208 122 188 108 Z' fill='{fur}'/><path d='M84 159 C118 164 158 162 192 149 C184 160 160 165 128 166 C108 167 94 165 84 159 Z' fill='{furLight}'/>`,
    legBR: `<path d='M80 112 C102 110 114 126 112 140 C110 148 100 153 88 155 L76 155 C62 152 52 144 54 132 C56 120 66 112 80 112 Z' fill='{fur}'/><path d='M98 116 Q112.8 132.1 100 152 Q115.2 131.9 98 116 Z' fill='{line}'/><path d='M82 132 L82 194' stroke='{fur}' stroke-width='10' stroke-linecap='round' fill='none'/><ellipse cx='88' cy='194' rx='11' ry='6' fill='{feet}'/><path d='M95 193 L95.5 198' stroke='{toe}' stroke-width='1.4' stroke-linecap='round' fill='none'/><path d='M99 192.5 L99.5 197.5' stroke='{toe}' stroke-width='1.4' stroke-linecap='round' fill='none'/>`,
    legFR: `<path d='M194 132 L194 194' stroke='{fur}' stroke-width='10' stroke-linecap='round' fill='none'/><path d='M191.8 154.5 C188.3 156.5 185.8 159.5 186.3 162 C187.3 164.5 190.8 165 193.8 164 L193.8 154.5 Z' fill='{fur}'/><path d='M194.3 151.5 Q189.2 157.4 192.8 163 Q191.3 157.6 194.3 151.5 Z' fill='{line}'/><ellipse cx='197.5' cy='194' rx='8.5' ry='6' fill='{feet}'/><path d='M202.0 193 L202.5 198' stroke='{toe}' stroke-width='1.4' stroke-linecap='round' fill='none'/><path d='M206.0 192.5 L206.5 197.5' stroke='{toe}' stroke-width='1.4' stroke-linecap='round' fill='none'/>`,
    earL: `<circle cx='196' cy='58' r='22' fill='{furDark}'/><circle cx='195' cy='57' r='12' fill='{earIn}' opacity='0.6'/>`,
    earR: `<circle cx='224' cy='56' r='25' fill='{fur}'/><circle cx='225' cy='56' r='16' fill='{earIn}'/>`,
    head: `<path d='M182 136 L198 112' stroke='{fur}' stroke-width='34' stroke-linecap='round' fill='none'/><circle cx='206' cy='96' r='30' fill='{fur}'/><path d='M214 74 C232 80 247 90 254 98 C259 104 256 110 248 113 C236 118 220 120 206 116 Z' fill='{fur}'/><path d='M222 112 C234 112 244 110 251 106 C249 112 240 116 230 117 C225 117 222 115 222 112 Z' fill='{furLight}'/><circle cx='253' cy='101' r='5.5' fill='{nose}'/><ellipse cx='220' cy='106' rx='6' ry='4' fill='{nose}' opacity='0.35'/><path d='M244 104 L259 96' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/><path d='M244 107 L259 106' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/><path d='M243 110 L257 115' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/>`,
    eyes: {
      open: `<ellipse cx='227' cy='90' rx='7' ry='8' fill='#fff'/><circle cx='227.8' cy='90.5' r='5.6' fill='{line}'/><circle cx='229.3' cy='88.5' r='1.8' fill='#fff'/>`,
      closed: `<path d='M221 91 Q227 96 233 91' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='227' cy='89' rx='8.5' ry='9.5' fill='#fff'/><circle cx='227.8' cy='89.5' r='4' fill='{line}'/><circle cx='229.3' cy='87.5' r='1.4400000000000002' fill='#fff'/>`,
      happy: `<path d='M221 92.5 Q227 85 233 92.5' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='227' cy='91' rx='7' ry='7' fill='#fff'/><circle cx='227.8' cy='92.2' r='5.2' fill='{line}'/><circle cx='229.3' cy='90.2' r='1.8' fill='#fff'/><path d='M219 83 L232 80' stroke='{line}' stroke-width='2.9' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='227' cy='91' rx='7' ry='6.2' fill='#fff'/><circle cx='228' cy='92' r='5' fill='{line}'/><circle cx='229.5' cy='90' r='1.8' fill='#fff'/><path d='M219 80 L234 86' stroke='{line}' stroke-width='3.3' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M236 113 Q240 116 244.5 112.5' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M233 111 Q240 120.5 247 110.5 Q240 114 233 111 Z' fill='{mouth}'/><path d='M236.5 115 Q240 113.5 243.5 115 Q240 117.4 236.5 115 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='240' cy='114.5' rx='4.6' ry='4.2' fill='{mouth}'/><ellipse cx='240' cy='116.8' rx='2.9' ry='1.7' fill='{tongue}'/>`,
      sad: `<path d='M235 115.5 Q240 111 245 115' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M234.5 115 Q240 112 245.5 114.5' stroke='{line}' stroke-width='2.6' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M234 115 Q237 112 240 115 Q243 118 246 114.5' stroke='{line}' stroke-width='2.2' fill='none' stroke-linecap='round'/>`,
    },
  },
};
