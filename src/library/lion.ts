import type { CharacterInput } from '../engine/types.js';

/**
 * A lion, majestic but friendly: a heavy bean of a body with a deep chest, a round haunch on
 * the near hind leg, a thick near foreleg, big paws with toe lines, and a long tail that
 * thins from the rump and ends in a dark tuft. The head carries a two-layer mane of pointed
 * tufts (dark behind, warm in front) round a face with a broad muzzle, cheek fluff and a
 * forelock; round ears poke out over the mane. Tapered shapes are filled paths, not strokes.
 */
export const LION: CharacterInput = {
  id: 'lion',
  name: 'Lion',
  description: 'Lion with a big layered mane (quadruped rig): prowls, roars, gallops, sits proud.',
  rig: 'quadruped',
  height: 170,
  colors: {
    fur: '#e8b04b',
    furDark: '#c48a2c',
    furLight: '#f8dc9a',
    mane: '#b5621f',
    maneDark: '#93491a',
    nose: '#6b3a2a',
    iris: '#a8701e',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 130 L67 186' stroke='{furDark}' stroke-width='21' stroke-linecap='round' fill='none'/><ellipse cx='70' cy='190.5' rx='15.5' ry='9.5' fill='{furDark}'/>`,
    legFL: `<path d='M178 130 L179 186' stroke='{furDark}' stroke-width='21' stroke-linecap='round' fill='none'/><ellipse cx='182' cy='190.5' rx='15.5' ry='9.5' fill='{furDark}'/>`,
    tail: `<path d='M57.1 106.1 L51.8 107.0 L47.2 107.4 L42.9 107.4 L38.9 107.0 L35.4 106.2 L32.1 105.1 L29.2 103.7 L26.5 102.0 L24.2 100.1 L22.2 97.9 L20.4 95.5 L18.9 92.9 L17.8 90.0 L16.9 87.0 L16.4 83.8 L16.1 80.5 L16.3 77.1 L16.8 73.7 L17.6 70.1 L18.9 66.6 L20.5 63.1 L22.5 59.6 A3.0 3.0 0 0 1 17.5 56.4 L15.0 60.1 L12.9 64.0 L11.2 68.0 L9.9 72.0 L9.0 76.2 L8.5 80.3 L8.5 84.4 L8.8 88.5 L9.7 92.4 L10.9 96.3 L12.6 100.0 L14.8 103.5 L17.4 106.8 L20.4 109.7 L23.9 112.3 L27.8 114.5 L32.1 116.3 L36.8 117.7 L41.9 118.5 L47.3 118.9 L53.1 118.7 L58.9 117.9 A6.0 6.0 0 0 1 57.1 106.1 Z' fill='{fur}'/><path d='M9.2 60.6 C11.4 51.9 17.1 45.6 23.2 42.2 C22.8 48.4 27.6 45.2 33.5 40.4 C29.2 50.2 34.2 48.6 32.9 54.1 C29 61.6 24.6 66.2 21 71.3 C12.9 68.3 8.9 63 9.2 60.6 Z' fill='{maneDark}'/>`,
    body: `<path d='M58 96 C82 86 118 94 148 92 C174 90 204 82 219 102 C231 121 225 152 203 159 C180 165 158 149 132 149 C110 150 94 160 68 158 C42 155 30 137 34 116 C37 103 46 98 58 96 Z' fill='{fur}'/><path d='M104 147 C120 150 142 148 160 147 C148 153 120 154 104 147 Z' fill='{furLight}'/><path d='M176 155 C190 158 206 155 214 144 C212 154 204 160 196 161 C188 162 180 160 176 155 Z' fill='{furLight}'/><path d='M164 112 Q170.8 128.1 166 142 Q173.2 127.9 164 112 Z' fill='{furDark}' opacity='0.45'/>`,
    legBR: `<path d='M70 98 C98 94 114 116 108 140 C105 151 98 158 94 164 L71 164 C66 156 54 148 54 128 C54 112 60 100 70 98 Z' fill='{fur}'/><path d='M76 148 C70 152 66 158 68 162 C70 165 76 165 80 164 Z' fill='{fur}'/><path d='M99 104 Q117 130.9 97 157 Q121 131.1 99 104 Z' fill='{line}'/><path d='M61.1 111.1 L59.8 116.6 L59.3 122.4 L59.8 128.2 L61.2 134.0 L63.6 139.5 L66.9 144.6 A1.2 1.2 0 0 1 69.1 143.4 L66.4 138.2 L64.7 133.0 L64.0 127.8 L64.1 122.6 L65.1 117.7 L66.9 112.9 A3.0 3.0 0 0 1 61.1 111.1 Z' fill='{furDark}' opacity='0.6'/><path d='M82 156 L83 186' stroke='{fur}' stroke-width='22' stroke-linecap='round' fill='none'/><path d='M75 151 Q68.8 158.9 74 165 Q71.2 159.1 75 151 Z' fill='{line}'/><ellipse cx='86' cy='190.5' rx='15.5' ry='9.5' fill='{fur}'/><path d='M90 188 L90.5 196' stroke='{furDark}' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M95.5 188.5 L96 195.5' stroke='{furDark}' stroke-width='2' stroke-linecap='round' fill='none'/>`,
    legFR: `<path d='M194 130 L195 186' stroke='{fur}' stroke-width='23' stroke-linecap='round' fill='none'/><path d='M188 146 C181 150 176 156 177 161 C179 166 186 167 192 165 L192 146 Z' fill='{fur}'/><path d='M193 140 Q183.7 151.8 190 164 Q186.3 152.2 193 140 Z' fill='{line}'/><ellipse cx='199' cy='190.5' rx='15.5' ry='9.5' fill='{fur}'/><path d='M203 188 L203.5 196' stroke='{furDark}' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M208.5 188.5 L209 195.5' stroke='{furDark}' stroke-width='2' stroke-linecap='round' fill='none'/>`,
    earL: `<path d='M196 58 C192 34 197 12 208 12 C219 12 222 34 217 58 Z' fill='{furDark}'/>`,
    head: `<path d='M184 126 L204 96' stroke='{fur}' stroke-width='36' stroke-linecap='round' fill='none'/><path d='M242 96.8 C248.1 103.7 243.7 111.9 237.7 117.2 C235.3 113.8 233 111.9 230.7 110.3 C233.1 120.1 223.9 123.4 216.6 125.9 C216.3 120.3 216.3 119.9 214.9 117.3 C212.8 128 202.7 134.7 194.1 134.1 C196.3 127.6 197.9 119.5 197.7 116.5 C191.1 126 181 124.5 174 120.9 C179.1 114.8 181.5 110.7 182.6 108 C172.5 114.4 161.3 111.8 156.1 105.6 C163.5 100.9 170.4 95.5 172.5 93.5 C160.6 95.5 155.4 88.5 153.3 81.7 C162.2 79.7 166.8 76.7 169.6 75.9 C157.8 73.1 150.7 64.6 151.7 57.3 C161 58 171.5 58.2 174.3 58.7 C164.7 51.7 164.4 44.6 167.9 39.4 C176.2 43 183.4 43.7 185.7 45.4 C179.9 35.5 181.6 28.9 187 26.3 C193.4 31.9 200.3 36 201.6 38.6 C200.3 27.9 204.4 26.7 209.8 27.3 C213.4 33.9 218.7 36.7 218.8 39.7 C222 30.2 227.7 28.5 232.7 32.4 C233.6 38.6 235 45.7 233.8 48.4 C240.4 42.1 243.9 46.2 246.5 52.2 C244.9 56.7 245.8 61.1 243.7 63 L208 78 Z' fill='{maneDark}'/><path d='M236.3 98.7 C240 105.7 233.8 111 227.7 114.6 C226 110.9 224.7 110.2 223 108.4 C222.9 117 215.1 122.3 207.6 122.9 C208 117.8 207.5 112.8 206.9 110.5 C202.6 118.5 194.2 116.9 187.7 114.4 C190.8 109.2 191.1 106.7 191.7 104.4 C184 109.9 173.9 108.4 168.9 102.9 C174.1 98.7 179.6 93.4 181.2 91.6 C171.8 93.3 166.3 87.3 164.5 80.8 C171.3 78.8 175.8 76 178 75.2 C168.8 72.7 165.3 65.3 166.7 59 C173.9 59.6 180.6 58.9 182.9 59.3 C175.8 53.1 177.5 47.5 181.4 43.2 C187.6 46.3 192.7 46.2 194.6 47.7 C191.1 39.4 194 32.9 199.7 31.2 C204.1 36 209.4 41 210.3 43.3 C211 34.8 215.9 33.7 221.3 35.4 C223.1 40.7 226.4 44.6 226.2 47 C230.6 40.6 236 41.9 240 46.6 C239.4 51.2 239.7 56.1 238.4 58.1 L211 77 Z' fill='{mane}'/><circle cx='226' cy='74' r='26' fill='{fur}'/><path d='M238.1 94.9 C239.4 100.1 235.1 101.7 231 102.7 C229.4 99.8 227.5 99.5 226.8 98.2 C225.6 103.3 220.5 105.8 216 104.6 C215.8 101.3 215.4 97.2 215.4 95.7 C211.9 99.7 207.6 97.8 204.3 94.8 C205.8 91.9 205.7 89.5 206.4 88.2 C201.5 90 197.7 86.7 196.2 82.5 C198.9 80.6 200.8 78.2 202.1 77.4 C196.8 76.7 196.6 72.1 197.2 67.8 C200.4 67.4 201.8 65.9 203.3 65.7 L226 74 Z' fill='{fur}'/><path d='M211.6 45.5 C218 45.5 223.3 48.2 226.8 51.9 C222.5 52.7 225.5 55.4 230 58.6 C222.4 57.4 224.5 60.6 220.4 60.7 C214.5 59.4 210.6 57.1 206.3 55.6 C206.9 49.5 209.9 45.7 211.6 45.5 Z' fill='{mane}'/><ellipse cx='238' cy='88' rx='13' ry='10' fill='{furLight}'/><ellipse cx='247' cy='86' rx='10' ry='9' fill='{furLight}'/><ellipse cx='240' cy='96' rx='8' ry='5.5' fill='{furLight}'/><path d='M239 76 Q247 72 256 76 Q253 84 248 85.5 Q243 84 239 76 Z' fill='{nose}'/><path d='M248 85 L248 90' stroke='{nose}' stroke-width='2.5' stroke-linecap='round' fill='none'/><circle cx='236' cy='87' r='1.3' fill='{furDark}'/><circle cx='241' cy='90' r='1.3' fill='{furDark}'/><circle cx='236' cy='92' r='1.3' fill='{furDark}'/>`,
    earR: `<path d='M211 58 C207 32 213 8 225 8 C237 8 240 32 234 58 Z' fill='{fur}'/><path d='M218 34 C216 24 219 15 225 15 C231 15 232 24 230 34 Z' fill='{furDark}'/>`,
    eyes: {
      open: `<ellipse cx='230' cy='67' rx='7.2' ry='8.2' fill='#fff'/><circle cx='231.7' cy='68' r='4.8' fill='{iris}'/><circle cx='231.8' cy='68.2' r='2.5' fill='{line}'/><circle cx='233.2' cy='65.4' r='1.7' fill='#fff'/>`,
      closed: `<path d='M223.5 68 Q230 73.5 236.5 68' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='230' cy='66' rx='8.5' ry='9.5' fill='#fff'/><circle cx='231' cy='67' r='3.6' fill='{iris}'/><circle cx='231' cy='67' r='1.9' fill='{line}'/><circle cx='232.2' cy='64.8' r='1.2' fill='#fff'/>`,
      happy: `<path d='M223.5 70 Q230 61.5 236.5 70' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='230' cy='68' rx='6.5' ry='6.5' fill='#fff'/><circle cx='231' cy='69.6' r='4.2' fill='{iris}'/><circle cx='231' cy='69.8' r='2.2' fill='{line}'/><path d='M221.5 59 L236.5 55' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='230' cy='68' rx='6.5' ry='6' fill='#fff'/><circle cx='231.6' cy='68.8' r='4.2' fill='{iris}'/><circle cx='231.8' cy='69' r='2.2' fill='{line}'/><path d='M221.5 55 L237.5 62' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M234 97 Q241 101 248 96.2' stroke='{line}' stroke-width='2.8' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M232 95 Q241 107 250 94.2 Q241 98.8 232 95 Z' fill='{mouth}'/><path d='M236.5 100.2 Q241 98 245.5 100.2 Q241 103.2 236.5 100.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='241' cy='99.5' rx='6.5' ry='5.8' fill='{mouth}'/><ellipse cx='241' cy='102.6' rx='4' ry='2.3' fill='{tongue}'/>`,
      sad: `<path d='M234 100 Q241 94 248 99.4' stroke='{line}' stroke-width='2.8' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M233.5 99.4 Q241 95.8 248.5 98.8' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M233 99.4 Q236.5 95.8 240 99.4 Q244 103 248.5 98.8' stroke='{line}' stroke-width='2.8' fill='none' stroke-linecap='round'/>`,
    },
  },
};
