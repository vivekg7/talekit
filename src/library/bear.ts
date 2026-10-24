import type { CharacterInput } from '../engine/types.js';

/**
 * A big, huggable brown bear: a heavy bean of a body that rises to a round hump over the
 * shoulders, a big round haunch on the near hind leg, thick legs sunk deep into the body ending
 * in big flat paws (toe creases and pale claws as thin line work), a stubby nub of a tail, small
 * round ears with a lighter inside, a cheek ruff, and a broad pale muzzle with a big dark nose.
 */
export const BEAR: CharacterInput = {
  id: 'bear',
  name: 'Bear',
  description: 'Big round brown bear (quadruped rig): lumbers, sits back on its haunches.',
  rig: 'quadruped',
  height: 180,
  belly: 160, // a heavy belly, drawn low: where `lie` puts it on the floor
  colors: {
    fur: '#8d5a3b',
    furDark: '#6f4329',
    furLight: '#d9b48f',
    claw: '#efe3cf',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M54.0 132.0 L54.0 139.0 L54.0 146.0 L54.0 153.0 L54.0 160.0 L54.0 167.0 L55.6 173.0 L60.0 177.4 L66.0 179.0 L72.0 177.4 L76.4 173.0 L78.0 167.0 L78.0 160.0 L78.0 153.0 L78.0 146.0 L78.0 139.0 L78.0 132.0 L76.4 126.0 L72.0 121.6 L66.0 120.0 L60.0 121.6 L55.6 126.0 Z' fill='{furDark}'/><path d='M66 164 L67 186' stroke='{furDark}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='72' cy='191.5' rx='17' ry='8.5' fill='{furDark}'/>`,
    legFL: `<path d='M166.0 132.0 L166.0 139.0 L166.0 146.0 L166.0 153.0 L166.0 160.0 L166.0 167.0 L167.6 173.0 L172.0 177.4 L178.0 179.0 L184.0 177.4 L188.4 173.0 L190.0 167.0 L190.0 160.0 L190.0 153.0 L190.0 146.0 L190.0 139.0 L190.0 132.0 L188.4 126.0 L184.0 121.6 L178.0 120.0 L172.0 121.6 L167.6 126.0 Z' fill='{furDark}'/><path d='M178 164 L179 186' stroke='{furDark}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='184' cy='191.5' rx='17' ry='8.5' fill='{furDark}'/>`,
    tail: `<path d='M60.0 100.0 L56.2 97.4 L52.8 95.1 L49.9 93.1 L47.3 91.3 L45.0 89.6 L42.9 87.9 L39.0 85.7 L34.6 85.8 L30.9 88.1 L28.7 92.0 L28.8 96.4 L31.1 100.1 L33.2 102.4 L35.5 104.9 L38.1 107.4 L41.1 110.1 L44.3 112.9 L48.0 116.0 L52.8 117.9 L57.9 117.2 L62.0 114.0 L63.9 109.2 L63.2 104.1 Z' fill='{furDark}'/>`,
    body: `<path d='M58 94 C82 86 106 90 126 80 C144 70 168 58 190 68 C210 80 222 112 214 138 C208 154 196 160 182 160 C160 160 150 156 130 158 C106 160 94 166 70 162 C44 158 32 138 34 118 C36 104 44 98 58 94 Z' fill='{fur}'/><path d='M112 154 Q122 157 126 161 Q130 157 138 156.5 Q146 158 150 162 Q154 157.5 162 156.5 Q168 158 172 160.5 Q174 156 180 154 Z' fill='{fur}'/><path d='M138 76 C152 66 170 62 186 68 C176 70 164 74 152 82 C147 85 140 82 138 76 Z' fill='{furLight}' opacity='0.45'/>`,
    legBR: `<path d='M76 94 C106 90 122 114 116 138 C112 152 104 158 96 164 L72 164 C62 156 48 146 48 124 C48 106 60 96 76 94 Z' fill='{fur}'/><path d='M106 104 Q122.2 129.9 104 158 Q125.8 130.1 106 104 Z' fill='{line}'/><path d='M84 158 L85 186' stroke='{fur}' stroke-width='24' stroke-linecap='round' fill='none'/><ellipse cx='90' cy='191.5' rx='17' ry='8.5' fill='{fur}'/><path d='M94 186.5 L94.5 192' stroke='{furDark}' stroke-width='1.8' stroke-linecap='round' fill='none'/><path d='M99.5 186.5 L100.0 192' stroke='{furDark}' stroke-width='1.8' stroke-linecap='round' fill='none'/><path d='M97 197 L100 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/><path d='M101.5 197 L104.5 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/><path d='M106 197 L109 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/>`,
    legFR: `<path d='M179.0 132.0 L179.6 139.0 L180.2 146.0 L180.8 153.0 L181.4 160.0 L182.0 167.0 L183.6 173.0 L188.0 177.4 L194.0 179.0 L200.0 177.4 L204.4 173.0 L206.0 167.0 L206.6 160.0 L207.2 153.0 L207.8 146.0 L208.4 139.0 L209.0 132.0 L207.0 124.5 L201.5 119.0 L194.0 117.0 L186.5 119.0 L181.0 124.5 Z' fill='{fur}'/><path d='M194 164 L195 186' stroke='{fur}' stroke-width='24' stroke-linecap='round' fill='none'/><path d='M186.5 144 C179.5 148 174.5 154 175.5 159 C177.5 164 184.5 165 190.5 163 L190.5 144 Z' fill='{fur}'/><path d='M191.5 138 Q182.2 149.8 188.5 162 Q184.8 150.2 191.5 138 Z' fill='{line}'/><ellipse cx='200' cy='191.5' rx='17' ry='8.5' fill='{fur}'/><path d='M204 186.5 L204.5 192' stroke='{furDark}' stroke-width='1.8' stroke-linecap='round' fill='none'/><path d='M209.5 186.5 L210.0 192' stroke='{furDark}' stroke-width='1.8' stroke-linecap='round' fill='none'/><path d='M207 197 L210 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/><path d='M211.5 197 L214.5 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/><path d='M216 197 L219 199' stroke='{claw}' stroke-width='2.4' stroke-linecap='round' fill='none'/>`,
    earL: `<circle cx='203' cy='52' r='12.5' fill='{furDark}'/>`,
    head: `<path d='M180 120 L202 94' stroke='{fur}' stroke-width='46' stroke-linecap='round' fill='none'/><path d='M188 84 L178 92 L189 96 L181 106 L196 104 L194 112 L206 104 Z' fill='{fur}'/><circle cx='214' cy='79' r='31' fill='{fur}'/><path d='M222 80 C232 72 250 74 256 82 C260 92 252 104 238 105 C226 105 218 98 222 80 Z' fill='{furLight}'/><path d='M245 78 C251 75 258 77 258.5 82 C258 87 252 89 248 87 C244 85 242 80 245 78 Z' fill='{nose}'/><path d='M251 88 L250 94' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
    earR: `<circle cx='223' cy='51' r='12.5' fill='{fur}'/><circle cx='224' cy='49.5' r='6.5' fill='{furLight}'/>`,
    eyes: {
      open: `<ellipse cx='229' cy='70' rx='5.5' ry='6.3' fill='#fff'/><circle cx='230.5' cy='70.8' r='3.8' fill='{line}'/><circle cx='231.7' cy='68.8' r='1.4' fill='#fff'/>`,
      closed: `<path d='M223.5 70.8 Q229 75.5 234.5 70.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='229' cy='69.2' rx='7.2' ry='8.2' fill='#fff'/><circle cx='229.8' cy='70' r='3' fill='{line}'/><circle cx='231.1' cy='67.9' r='1.1' fill='#fff'/>`,
      happy: `<path d='M223.5 72.5 Q229 64.9 234.5 72.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='229' cy='70.8' rx='5.5' ry='5.5' fill='#fff'/><circle cx='229.8' cy='72.3' r='3.6' fill='{line}'/><path d='M221.5 63.2 L234.5 59.8' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='229' cy='70.8' rx='5.5' ry='5' fill='#fff'/><circle cx='230.5' cy='71.7' r='3.6' fill='{line}'/><path d='M221.5 59.8 L235.5 65.8' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M241 95.5 Q246 99 251 94.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M237 94 Q245 106 253 93.2 Q245 97.8 237 94 Z' fill='{mouth}'/><path d='M241 99.2 Q245 97 249 99.2 Q245 102.2 241 99.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='245.5' cy='98.5' rx='6' ry='5.2' fill='{mouth}'/><ellipse cx='245.5' cy='101.5' rx='3.8' ry='2.2' fill='{tongue}'/>`,
      sad: `<path d='M239.2 99.2 Q245.5 93.2 251.8 98.5' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M238.5 98.5 Q245.5 94.8 252.5 97.8' stroke='{line}' stroke-width='3.1' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M237.8 98.5 Q241.5 94.8 245.2 98.5 Q249 102.2 253 97.8' stroke='{line}' stroke-width='2.7' fill='none' stroke-linecap='round'/>`,
    },
  },
};
