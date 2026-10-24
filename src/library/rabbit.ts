import type { CharacterInput } from '../engine/types.js';

/**
 * A soft round rabbit: a pear of a body with a high round rump and a white chest ruff, a big
 * round haunch over a long hind foot, small front paws, a cotton-ball tail puffed out of the
 * rump, long round-tipped ears leaning back (bases sunk into the head), full cheeks, white
 * whisker pads round a pink split-lip nose, and a big dark eye with two highlights.
 */
export const RABBIT: CharacterInput = {
  id: 'rabbit',
  name: 'Rabbit',
  description: 'Round rabbit with tall ears (quadruped rig): hops, sits up, twitches its nose.',
  rig: 'quadruped',
  height: 100,
  colors: {
    fur: '#d8cbbc',
    furDark: '#b3a493',
    furLight: '#ffffff',
    earIn: '#f4b6c2',
    nose: '#e8758a',
    iris: '#3b2a26',
    mouth: '#7a2a32',
    tongue: '#f08080',
    tooth: '#ffffff',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M55.0 120.0 L55.9 130.0 L56.8 140.0 L57.6 150.0 L58.5 160.0 A7.5 7.5 0 0 1 73.5 160.0 L74.4 150.0 L75.2 140.0 L76.1 130.0 L77.0 120.0 A11.0 11.0 0 0 1 55.0 120.0 Z' fill='{furDark}'/><path d='M66 154 L66.5 188' stroke='{furDark}' stroke-width='15' stroke-linecap='round' fill='none'/><path d='M57 190 C57 184 65 183 72 185 L81 187 C91 187 95 192 93 196 C92 199 89 200 83 200 L63 200 C58 200 57 196 57 190 Z' fill='{furDark}'/>`,
    legFL: `<path d='M178 132 L179 192.5' stroke='{furDark}' stroke-width='11' stroke-linecap='round' fill='none'/><ellipse cx='182' cy='193.5' rx='9' ry='6.5' fill='{furDark}'/>`,
    tail: `<path d='M54.4 108.1 A7.0 7.0 0 0 1 47.5 116.4 A7.0 7.0 0 0 1 36.9 117.4 A7.0 7.0 0 0 1 28.6 110.5 A7.0 7.0 0 0 1 27.6 99.9 A7.0 7.0 0 0 1 34.5 91.6 A7.0 7.0 0 0 1 45.1 90.6 A7.0 7.0 0 0 1 53.4 97.5 A7.0 7.0 0 0 1 54.4 108.1 Z' fill='{furLight}'/>`,
    body: `<path d='M188 100 C168 84 136 74 104 76 C70 78 42 96 38 122 C35 146 50 162 78 164 C112 167 150 166 178 161 C200 157 214 146 214 128 C214 113 205 104 188 100 Z' fill='{fur}'/><path d='M198 112 C212 120 216 140 206 154 C196 160 186 160 178 158 C194 150 202 132 198 112 Z' fill='{furLight}'/><path d='M104 155 C132 161 164 160 188 151 C182 158 162 163 136 163 C120 163 110 160 104 155 Z' fill='{furLight}'/>`,
    legBR: `<path d='M80 94 C106 92 122 110 120 132 C119 146 104 154 90 160 L74 160 C60 154 50 146 50 128 C50 108 60 96 80 94 Z' fill='{fur}'/><path d='M104 100 Q122.4 124.1 106 152 Q125.6 123.9 104 100 Z' fill='{line}'/><path d='M62 112 C56 124 58 142 70 154 C62 140 62 126 66 116 Z' fill='{furDark}' opacity='0.5'/><path d='M82 150 L82.5 188' stroke='{fur}' stroke-width='15' stroke-linecap='round' fill='none'/><path d='M73 190 C73 184 81 183 88 185 L97 187 C107 187 111 192 109 196 C108 199 105 200 99 200 L79 200 C74 200 73 196 73 190 Z' fill='{fur}'/><path d='M100 193 L101 199' stroke='{furDark}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M105 192 L106 198' stroke='{furDark}' stroke-width='1.6' stroke-linecap='round' fill='none'/>`,
    legFR: `<path d='M194 132 L195 192.5' stroke='{fur}' stroke-width='11' stroke-linecap='round' fill='none'/><path d='M191.5 151.6 C187.7 153.8 184.9 157.1 185.5 159.8 C186.6 162.6 190.4 163.1 193.7 162 L193.7 151.6 Z' fill='{fur}'/><path d='M194.3 148.3 Q188.8 154.7 192.6 161 Q190.9 155 194.3 148.3 Z' fill='{line}'/><ellipse cx='198' cy='193.5' rx='9' ry='6.5' fill='{fur}'/><path d='M202 192 L202.5 198' stroke='{furDark}' stroke-width='1.4' stroke-linecap='round' fill='none'/>`,
    earL: `<path d='M196 66 C188 44 186 18 194 6 C204 12 214 36 214 62 Z' fill='{furDark}'/>`,
    earR: `<path d='M210 66 C204 42 206 14 218 3 C232 12 238 40 232 66 Z' fill='{fur}'/><path d='M216 56 C212 40 214 20 219 12 C227 20 230 40 227 56 Z' fill='{earIn}'/>`,
    head: `<path d='M184 128 L200 98' stroke='{fur}' stroke-width='32' stroke-linecap='round' fill='none'/><circle cx='208' cy='71' r='32' fill='{fur}'/><ellipse cx='203' cy='89' rx='24' ry='16' fill='{fur}'/><path d='M184 80 C180 88 182 96 188 102 C186 94 188 88 192 84 Z' fill='{fur}'/><ellipse cx='229' cy='86' rx='15' ry='12' fill='{fur}'/><ellipse cx='233' cy='90' rx='7' ry='5.8' fill='{furLight}'/><ellipse cx='240' cy='89' rx='6.5' ry='5.6' fill='{furLight}'/><ellipse cx='236' cy='95' rx='5' ry='3.5' fill='{furLight}'/><ellipse cx='216' cy='86' rx='6' ry='4' fill='{nose}' opacity='0.35'/><path d='M236 82 Q236.5 78.5 240 79.5 Q243.5 78.5 244 82 Q242 85.5 240 86.5 Q238 85.5 236 82 Z' fill='{nose}'/><path d='M240 86 L240 91' stroke='{line}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M243 88 L258 84' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/><path d='M243 91 L257 93' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/><path d='M242 93.5 L254 99' stroke='{line}' stroke-width='1.3' stroke-linecap='round' fill='none'/>`,
    eyes: {
      open: `<ellipse cx='222' cy='68' rx='7.5' ry='8.5' fill='#fff'/><circle cx='223' cy='68.5' r='6' fill='{iris}'/><circle cx='224.8' cy='66.1' r='2.2' fill='#fff'/><circle cx='221.2' cy='70.7' r='1.0' fill='#fff'/>`,
      closed: `<path d='M215 69 Q222 75 229 69' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='222' cy='67' rx='9' ry='10' fill='#fff'/><circle cx='223' cy='67.5' r='4.5' fill='{iris}'/><circle cx='224.8' cy='65.1' r='1.7600000000000002' fill='#fff'/><circle cx='221.2' cy='69.7' r='0.8' fill='#fff'/>`,
      happy: `<path d='M215 71 Q222 62 229 71' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='222' cy='69' rx='7.5' ry='7.5' fill='#fff'/><circle cx='223' cy='70.5' r='5.5' fill='{iris}'/><circle cx='224.8' cy='68.1' r='2.2' fill='#fff'/><circle cx='221.2' cy='72.7' r='1.0' fill='#fff'/><path d='M213 59 L229 55' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='222' cy='69' rx='7.5' ry='6.8' fill='#fff'/><circle cx='223.5' cy='70' r='5.5' fill='{iris}'/><circle cx='225.3' cy='67.6' r='2.2' fill='#fff'/><circle cx='221.7' cy='72.2' r='1.0' fill='#fff'/><path d='M213 56 L230 63' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M234 95 Q237 98 240 95.5 Q243 98 246 95' stroke='{line}' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M231 94 Q240 106 249 93.5 Q240 98 231 94 Z' fill='{mouth}'/><path d='M235.5 99.5 Q240 97.5 244.5 99.5 Q240 102.5 235.5 99.5 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='240' cy='98.5' rx='5.5' ry='5' fill='{mouth}'/><rect x='237' y='93.5' width='6' height='3.5' rx='1' fill='{tooth}'/><ellipse cx='240' cy='101.5' rx='3.5' ry='1.8' fill='{tongue}'/>`,
      sad: `<path d='M233.5 99 Q240 94 246.5 98.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M233 98.5 Q240 95 247 98' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M232 98.5 Q235.5 95 239 98.5 Q242.5 102 247 97.8' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
    },
  },
};
