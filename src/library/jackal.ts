import type { CharacterInput } from '../engine/types.js';

/**
 * A golden jackal, the fox's lean cousin: a slim bean of a body that leaves more leg showing,
 * tan above and cream below, with a dark grizzled saddle along the back whose lower edge is
 * ragged; thin legs that turn rufous toward small paws; a bushy tail carried low that swells
 * from the rump, darkens along the top and ends in a black tip; big pointed ears with a pale
 * inside and a rufous rim; a long narrow muzzle, darker on the bridge, with a cream jaw and
 * cheek ruff and a black nose; a pale brow over half-lidded amber eyes that give it its
 * sly look. Tapered shapes are filled paths along a curve.
 */
export const JACKAL: CharacterInput = {
  id: 'jackal',
  name: 'Jackal',
  description:
    'Lean golden jackal with a dark saddle (quadruped rig): sly trot, slinks, quick gallop.',
  rig: 'quadruped',
  height: 112,
  colors: {
    fur: '#d2a263',
    furDark: '#ad7f48',
    furLight: '#f4e8d3',
    saddle: '#5f5049',
    leg: '#c98a4e',
    legDark: '#a86c38',
    earIn: '#f7ead6',
    tip: '#2e2626',
    iris: '#dba532',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M66 130 L67 191' stroke='{furDark}' stroke-width='11' stroke-linecap='round' fill='none'/><path d='M66.6 166 L67 191' stroke='{legDark}' stroke-width='11' stroke-linecap='round' fill='none'/><ellipse cx='69' cy='193.5' rx='9' ry='6.5' fill='{legDark}'/>`,
    legFL: `<path d='M178 130 L179 191' stroke='{furDark}' stroke-width='11' stroke-linecap='round' fill='none'/><path d='M178.6 166 L179 191' stroke='{legDark}' stroke-width='11' stroke-linecap='round' fill='none'/><ellipse cx='181' cy='193.5' rx='9' ry='6.5' fill='{legDark}'/>`,
    tail: `<path d='M68.7 104.1 L66.3 103.3 L63.9 102.7 L61.5 102.2 L59.1 101.8 L56.7 101.5 L54.3 101.4 L51.9 101.4 L49.5 101.5 L47.1 101.8 L44.7 102.2 L42.4 102.7 L40.1 103.4 L37.8 104.2 L35.6 105.1 L33.4 106.2 L31.3 107.4 L29.2 108.7 L27.2 110.1 L25.3 111.6 L23.5 113.2 L21.8 114.9 L20.1 116.8 L18.5 118.7 L17.1 120.7 L15.7 122.7 L14.4 124.9 L13.2 127.1 L12.2 129.3 L11.2 131.7 L10.3 134 L9.6 136.5 L8.9 138.9 L8.4 141.4 L7.9 144 L7.5 146.5 L7.3 149.1 L7.1 151.7 L7.1 154.3 L7.1 156.9 L7.3 159.6 A6.7 6.7 0 0 1 20.7 160.4 L21.2 158.3 L21.8 156.2 L22.4 154.1 L23.1 152.2 L23.8 150.2 L24.5 148.3 L25.3 146.5 L26.1 144.7 L26.9 143 L27.8 141.3 L28.7 139.7 L29.6 138.1 L30.5 136.5 L31.4 135.1 L32.4 133.6 L33.4 132.2 L34.4 130.9 L35.4 129.5 L36.4 128.3 L37.5 127 L38.6 125.8 L39.7 124.7 L40.8 123.6 L42 122.5 L43.1 121.4 L44.4 120.4 L45.6 119.5 L46.9 118.5 L48.3 117.7 L49.7 116.8 L51.1 116 L52.6 115.3 L54.2 114.6 L55.9 114 L57.6 113.4 L59.4 113 L61.3 112.6 L63.2 112.3 L65.2 112.1 L67.3 111.9 Z' fill='{fur}'/><path d='M63.7 105.6 L60.8 105.2 L57.9 105.1 L55 105.2 L52.1 105.4 L49.4 105.9 L46.6 106.5 L43.9 107.3 L41.3 108.3 L38.8 109.4 L36.3 110.8 L33.9 112.3 L31.6 113.9 L29.5 115.7 L27.4 117.7 L25.4 119.8 L23.6 122 L21.8 124.3 L20.2 126.8 L18.7 129.3 L17.4 132 L24.4 135.5 L25.6 133.2 L27 131 L28.4 128.9 L29.9 126.9 L31.4 125 L33 123.2 L34.7 121.4 L36.5 119.8 L38.3 118.3 L40.2 116.9 L42.2 115.6 L44.2 114.4 L46.3 113.3 L48.5 112.3 L50.8 111.5 L53.2 110.7 L55.6 110.2 L58.1 109.8 L60.7 109.5 L63.4 109.4 Z' fill='{saddle}' opacity='0.55'/><path d='M9.3 136.9 L8.8 139.1 L8.3 141.3 L7.9 143.5 L7.5 145.8 L7.3 148 L7.1 150.3 L7 152.6 L7 154.9 L7.1 157.3 L7.2 159.6 A6.8 6.8 0 0 1 20.8 160.4 L21.3 158.5 L21.8 156.7 L22.3 154.9 L22.9 153.1 L23.5 151.4 L24.1 149.7 L24.7 148.1 L25.4 146.5 L26.1 144.9 L26.9 143.4 Z' fill='{tip}'/>`,
    body: `<path d='M62 100 C86 93 118 99 148 98 C170 96 194 90 207 104 C216 117 213 140 198 147 C181 152 158 141 136 141 C112 141 96 150 72 147 C52 144 42 130 44 116 C46 106 52 102 62 100 Z' fill='{fur}'/><path d='M104 144.5 L107.1 143.9 L110.1 143.4 L113.2 142.8 L116.3 142.2 L119.3 141.7 L122.4 141.3 L125.5 141 L128.5 140.7 L131.6 140.5 L134.7 140.4 L137.7 140.4 L140.8 140.6 L143.9 140.8 L146.9 141.2 L150 141.6 L153.1 142.1 L156.1 142.7 L159.2 143.3 L162.3 143.9 L165.3 144.6 L168.4 145.2 L171.5 145.8 L174.5 146.3 L177.6 146.8 L180.7 147.2 L183.7 147.5 L186.8 147.7 L189.9 147.7 L192.9 147.4 L196 146.9 L196 146.9 L192.9 144.8 L189.9 144 L186.8 143.2 L183.7 142.4 L180.7 141.6 L177.6 140.7 L174.5 139.8 L171.5 138.9 L168.4 138 L165.3 137.1 L162.3 136.3 L159.2 135.5 L156.1 134.8 L153.1 134.1 L150 133.6 L146.9 133.2 L143.9 132.9 L140.8 132.8 L137.7 132.8 L134.7 133 L131.6 133.3 L128.5 133.8 L125.5 134.4 L122.4 135.2 L119.3 136.1 L116.3 137.1 L113.2 138.3 L110.1 139.7 L107.1 141.4 L104 144.5 Z' fill='{furLight}'/><path d='M206 110 C212 118 213 128 210 136 C206 144 199 148 192 148 C189 136 193 122 206 110 Z' fill='{furLight}'/><path d='M64 100.1 L66 99.6 L68 99.1 L70 98.8 L72 98.4 L74 98.2 L76 97.9 L78 97.7 L80 97.6 L82 97.4 L84 97.3 L86 97.3 L88 97.2 L90 97.2 L92 97.2 L94 97.2 L96 97.2 L98 97.2 L100 97.3 L102 97.3 L104 97.4 L106 97.5 L108 97.6 L110 97.6 L112 97.7 L114 97.8 L116 97.9 L118 98 L120 98.1 L122 98.2 L124 98.3 L126 98.4 L128 98.5 L130 98.5 L132 98.6 L134 98.6 L136 98.7 L138 98.7 L140 98.7 L142 98.7 L144 98.7 L146 98.7 L148 98.6 L150 98.4 L152 98.2 L154 98 L156 97.7 L158 97.5 L160 97.3 L162 97 L164 96.8 L166 96.6 L168 96.4 L170 96.2 L172 96 L174 95.9 L176 95.7 L178 95.6 L180 95.6 L182 95.6 L184 95.7 L186 95.8 L188 96 L190 96.2 L192 96.6 L192 96.6 L190 98.9 L188 100.5 L186 101.5 L184 101.8 L182 101.7 L180 101.3 L178 101.1 L176 101.4 L174 102.3 L172 103.7 L170 105.3 L168 106.8 L166 107.7 L164 108 L162 107.8 L160 107.4 L158 107.1 L156 107.3 L154 108 L152 109.2 L150 110.7 L148 111.9 L146 112.5 L144 112.5 L142 111.9 L140 111 L138 110.3 L136 109.9 L134 110.2 L132 110.9 L130 111.9 L128 112.6 L126 113 L124 112.6 L122 111.8 L120 110.6 L118 109.6 L116 109 L114 109 L112 109.4 L110 110.2 L108 110.8 L106 110.9 L104 110.4 L102 109.4 L100 108.1 L98 106.9 L96 106.2 L94 106 L92 106.3 L90 106.9 L88 107.5 L86 107.6 L84 107 L82 106 L80 104.7 L78 103.4 L76 102.5 L74 102.3 L72 102.5 L70 103.1 L68 103.4 L66 103.3 L64 101.5 Z' fill='{saddle}'/>`,
    legBR: `<path d='M73 104 C93 100 104 117 100 136 C97 148 92 156 88 166 L77 166 C71 156 61 146 61 128 C61 116 65 106 73 104 Z' fill='{fur}'/><path d='M80 150 C75 154 72 158 73 161 C74 164 79 164 82 163 Z' fill='{fur}'/><path d='M92 110 Q104.7 131.9 89 158 Q107.3 132.1 92 110 Z' fill='{line}'/><path d='M83 156 L84 191' stroke='{fur}' stroke-width='11' stroke-linecap='round' fill='none'/><path d='M83.6 166 L84 191' stroke='{leg}' stroke-width='11' stroke-linecap='round' fill='none'/><ellipse cx='86' cy='193.5' rx='9' ry='6.5' fill='{leg}'/><path d='M81 152 Q75 158.9 80 164 Q77 159.1 81 152 Z' fill='{line}'/>`,
    legFR: `<path d='M194 130 L195 191' stroke='{fur}' stroke-width='11' stroke-linecap='round' fill='none'/><path d='M194.6 166 L195 191' stroke='{leg}' stroke-width='11' stroke-linecap='round' fill='none'/><ellipse cx='197' cy='193.5' rx='9' ry='6.5' fill='{leg}'/><path d='M191.6 142.7 C187 145.3 184.3 149.2 184.9 152.4 C186.2 155.7 190.3 156.3 196 155 L196 142.7 Z' fill='{fur}'/><path d='M194.8 138.8 Q188.6 146.4 192.9 154 Q190.7 146.7 194.8 138.8 Z' fill='{line}'/>`,
    earL: `<path d='M185 68 Q187 34 195 4 Q214 28 226 58 Z' fill='{furDark}'/>`,
    head: `<path d='M184 124 L204 94' stroke='{fur}' stroke-width='28' stroke-linecap='round' fill='none'/><circle cx='209' cy='71' r='26' fill='{fur}'/><path d='M214 57 C232 62 249 72 259 80 C256 87 240 91 222 92 L212 90 Z' fill='{fur}'/><path d='M216 58 C230 61 244 68 255 77 C244 72 230 68 216 66 Z' fill='{furDark}' opacity='0.6'/><path d='M258 83 C248 91 230 96 214 96 C206 96 198 95 192 92 C194 87 202 80 214 80 C230 83 246 83 258 82 Z' fill='{furLight}'/><path d='M207 94 C215 100 215 112 210 120 L201 118 C204 110 204 102 207 94 Z' fill='{furLight}'/><ellipse cx='220' cy='57' rx='6' ry='2.6' fill='{furLight}' transform='rotate(-12 220 57)'/><ellipse cx='255' cy='80' rx='4.6' ry='3.9' fill='{nose}'/>`,
    earR: `<path d='M199 64 Q201 30 212 0 Q236 24 245 60 Z' fill='{fur}'/><path d='M209 56 Q211 34 215 16 Q230 32 237 56 Z' fill='{earIn}'/><path d='M199 64 Q201 30 212 0 Q205 30 205 64 Z' fill='{legDark}'/>`,
    eyes: {
      open: `<path d='M216.5 66.5 Q222 59 229.5 64.5 Q224 72 216.5 66.5 Z' fill='#fff'/><circle cx='224' cy='66.6' r='3.5' fill='{iris}'/><ellipse cx='224' cy='66.6' rx='1.4' ry='2.8' fill='{line}'/><circle cx='225.4' cy='65.6' r='1.1' fill='#fff'/><path d='M215.5 66 Q222 57.5 230.5 63.5 Q223 62.5 215.5 66 Z' fill='{furDark}'/><path d='M215.5 66.4 Q223 62 230.5 64' stroke='{line}' stroke-width='2.6' fill='none' stroke-linecap='round'/>`,
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
