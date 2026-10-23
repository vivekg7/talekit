import type { CharacterInput } from '../engine/types.js';

/**
 * A sly red fox on the quadruped rig: a slim bean of a body with a dipped back and a deep
 * chest under a white bib, a slim haunch on the near hind leg, black socks on every leg, a
 * huge brush of a tail that swells from the rump and narrows to a white tip, tall pointed
 * ears with dark backs and black tips, a long narrow muzzle with a white jaw that ends in a
 * cheek ruff, and almond amber eyes. Tapered shapes (the tail) are filled paths along a curve.
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
    furLight: '#fff8ef',
    sock: '#3b2a2f',
    earIn: '#fde3cc',
    iris: '#e0a020',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 130 L67 191' stroke='{furDark}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M66.5 168 L67 191' stroke='{sock}' stroke-width='12' stroke-linecap='butt' fill='none'/><path d='M67 191 L67 192' stroke='{sock}' stroke-width='12' stroke-linecap='round' fill='none'/><ellipse cx='69' cy='193.5' rx='9' ry='6.5' fill='{sock}'/>`,
    legFL: `<path d='M178 130 L179 191' stroke='{furDark}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M178.5 168 L179 191' stroke='{sock}' stroke-width='12' stroke-linecap='butt' fill='none'/><path d='M179 191 L179 192' stroke='{sock}' stroke-width='12' stroke-linecap='round' fill='none'/><ellipse cx='181' cy='193.5' rx='9' ry='6.5' fill='{sock}'/>`,
    tail: `<path d='M59.2 109.6 L53.5 108.3 L48.8 107.2 L44.9 105.7 L41.8 104.0 L39.6 102.2 L38.3 100.3 L37.6 98.6 L37.5 97.2 L37.5 96.0 L37.6 94.8 L37.5 93.5 L37.3 91.8 L36.9 89.7 L36.3 86.8 L35.8 83.3 L35.3 79.0 L34.9 74.0 L34.7 68.1 L34.6 61.5 L34.6 53.9 L34.5 45.5 L32.3 35.0 A2.5 2.5 0 0 1 27.7 33.0 L18.5 39.0 L12.5 46.3 L7.7 53.6 L4.0 61.0 L1.1 68.4 L-0.9 75.7 L-2.0 82.8 L-2.2 89.9 L-1.5 96.7 L0.2 103.3 L3.0 109.5 L6.7 115.1 L11.4 119.9 L16.8 123.6 L22.7 126.1 L28.8 127.4 L34.8 127.6 L40.6 126.7 L46.2 124.9 L51.4 122.3 L56.4 119.0 L60.8 114.4 A2.5 2.5 0 0 1 59.2 109.6 Z' fill='{fur}'/><path d='M35.8 79.8 L35.4 76.1 L35.2 71.9 L35.0 67.3 L34.9 62.1 L34.9 56.5 L34.9 50.3 L34.8 43.5 L32.6 35.2 A2.9 2.9 0 0 1 27.4 32.8 L19.7 37.3 L14.7 42.8 L10.5 48.4 L7.0 54.1 L4.1 59.8 L1.7 65.5 L-0.2 71.2 L-1.6 76.8 A18.7 18.7 0 0 1 35.8 79.8 Z' fill='{furLight}'/>`,
    body: `<path d='M60 98 C84 90 118 97 148 96 C170 94 196 88 209 104 C219 118 215 144 199 151 C181 157 158 144 136 144 C112 144 96 154 72 151 C50 148 38 132 40 116 C42 105 50 100 60 98 Z' fill='{fur}'/><path d='M210 112 C215 118 217 126 213 138 C209 147 201 151 193 152 C189 140 194 124 210 112 Z' fill='{furLight}'/><path d='M108 145 C122 147 140 145 154 146 C144 151 120 152 108 145 Z' fill='{furLight}'/>`,
    legBR: `<path d='M72 104 C94 100 106 118 102 138 C99 150 93 157 89 166 L77 166 C71 156 60 146 60 128 C60 116 64 106 72 104 Z' fill='{fur}'/><path d='M83 156 L84 191' stroke='{fur}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M83.6 168 L84 191' stroke='{sock}' stroke-width='12' stroke-linecap='butt' fill='none'/><path d='M84 191 L84 192' stroke='{sock}' stroke-width='12' stroke-linecap='round' fill='none'/><ellipse cx='87' cy='193.5' rx='9' ry='6.5' fill='{sock}'/>`,
    legFR: `<path d='M194 130 L195 191' stroke='{fur}' stroke-width='12' stroke-linecap='round' fill='none'/><path d='M194.5 168 L195 191' stroke='{sock}' stroke-width='12' stroke-linecap='butt' fill='none'/><path d='M195 191 L195 192' stroke='{sock}' stroke-width='12' stroke-linecap='round' fill='none'/><ellipse cx='197' cy='193.5' rx='9' ry='6.5' fill='{sock}'/>`,
    earL: `<path d='M186 68 Q188 36 195 10 Q212 30 225 58 Z' fill='{sock}'/>`,
    head: `<path d='M184 124 L204 94' stroke='{fur}' stroke-width='28' stroke-linecap='round' fill='none'/><circle cx='209' cy='71' r='26' fill='{fur}'/><path d='M214 55 C232 60 248 70 258 79 C255 87 240 92 222 93 L212 90 Z' fill='{fur}'/><path d='M258 82 C248 92 230 97 214 97 C206 97 198 96 192 92 C194 87 202 80 214 80 C230 83 246 83 258 82 Z' fill='{furLight}'/><path d='M207 94 C215 100 215 112 210 120 L201 118 C204 110 204 102 207 94 Z' fill='{furLight}'/><ellipse cx='254' cy='79.5' rx='5' ry='4.2' fill='{nose}'/>`,
    earR: `<path d='M202 64 Q205 34 215 6 Q234 28 243 60 Z' fill='{fur}'/><path d='M212 54 Q214 36 218 22 Q228 36 234 54 Z' fill='{earIn}'/><path d='M210 24 Q212 15 215 6 Q222 14 228 24 Q219 20 210 24 Z' fill='{sock}'/>`,
    eyes: {
      open: `<path d='M216.5 66.5 Q222 57.2 229.5 64.5 Q224 72.05 216.5 66.5 Z' fill='#fff'/><circle cx='224.5' cy='66' r='3.6' fill='{iris}'/><ellipse cx='224.5' cy='66' rx='1.5' ry='3' fill='{line}'/><circle cx='226' cy='64' r='1.2' fill='#fff'/>`,
      closed: `<path d='M216.5 67 Q223 72 229.5 66' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='223' cy='65' rx='7.6' ry='8.5' fill='#fff'/><circle cx='224' cy='66' r='3.4' fill='{iris}'/><ellipse cx='224' cy='66' rx='1.3' ry='2.8' fill='{line}'/><circle cx='225.5' cy='63.5' r='1.1' fill='#fff'/>`,
      happy: `<path d='M216.5 68.5 Q223 60.5 229.5 68' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<path d='M216.5 67.5 Q222 58.2 229.5 65.5 Q224 73.05 216.5 67.5 Z' fill='#fff'/><circle cx='224.5' cy='67' r='3.6' fill='{iris}'/><ellipse cx='224.5' cy='67' rx='1.5' ry='3' fill='{line}'/><circle cx='226' cy='65' r='1.2' fill='#fff'/><path d='M215 58 L229 54.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M216.5 67.5 Q222 58.2 229.5 65.5 Q224 73.05 216.5 67.5 Z' fill='#fff'/><circle cx='224.5' cy='67' r='3.6' fill='{iris}'/><ellipse cx='224.5' cy='67' rx='1.5' ry='3' fill='{line}'/><circle cx='226' cy='65' r='1.2' fill='#fff'/><path d='M215 55 L230 61' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M234 90 Q242 92 250 87' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M230 89 Q241 101 252 86 Q241 92 230 89 Z' fill='{mouth}'/><path d='M235 93.5 Q240.5 91.5 246 93 Q240.5 97 235 93.5 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='242' cy='92' rx='5.6' ry='4.9' fill='{mouth}'/><ellipse cx='242' cy='94.8' rx='3.5' ry='2.1' fill='{tongue}'/>`,
      sad: `<path d='M234 93 Q242 87 250 92' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M233 92 Q242 88.5 251 90.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M233 92 Q236.5 88.5 240 92 Q243.5 95.5 251 90' stroke='{line}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    },
  },
};
