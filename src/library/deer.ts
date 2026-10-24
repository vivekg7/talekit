import type { CharacterInput } from '../engine/types.js';

/**
 * A graceful spotted deer (a chital): a bean of a body with a deep chest and a slim waist, a
 * lean round haunch on the near hind leg, slender legs that taper below the knee to small dark
 * hooves, a long tapered neck drawn in the head part so a nod lowers the whole neck, large
 * ears, a short tail with a white underside, faint white spots, and small antlers made of
 * tapered filled shapes behind the head. The face is gentle: a big dark eye with a lash, a pale
 * chin and a dark nose.
 */
export const DEER: CharacterInput = {
  id: 'deer',
  name: 'Deer',
  description:
    'Slim spotted deer with small antlers (quadruped rig): long legs, a long neck that nods.',
  rig: 'quadruped',
  height: 190,
  belly: 140, // a slender belly, drawn high: where `lie` puts it on the floor
  colors: {
    fur: '#c98a4b',
    furDark: '#a86d35',
    furLight: '#f6e2c4',
    hoof: '#4a3426',
    antler: '#e8d3a8',
    spot: '#fbf0dc',
    tailWhite: '#fbf4e8',
    earIn: '#f3cdb0',
    iris: '#3a2618',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    legBL: `<path d='M59.5 132.0 L59.9 139.0 L60.2 146.0 L60.5 153.0 L60.9 160.0 L61.2 167.0 L61.9 169.4 L63.6 171.1 L66.0 171.8 L68.4 171.1 L70.1 169.4 L70.8 167.0 L71.1 160.0 L71.5 153.0 L71.8 146.0 L72.2 139.0 L72.5 132.0 L71.6 128.7 L69.2 126.4 L66.0 125.5 L62.7 126.4 L60.4 128.8 Z' fill='{furDark}'/><path d='M66 164 L66.5 191' stroke='{furDark}' stroke-width='9' stroke-linecap='round' fill='none'/><path d='M61.0 188 L71.5 188 Q74.5 193 76.5 200 L59.5 200 Q59.5 193 61.0 188 Z' fill='{hoof}'/>`,
    legFL: `<path d='M171.5 132.0 L171.9 139.0 L172.2 146.0 L172.6 153.0 L172.9 160.0 L173.2 167.0 L173.9 169.4 L175.6 171.1 L178.0 171.8 L180.4 171.1 L182.1 169.4 L182.8 167.0 L183.1 160.0 L183.4 153.0 L183.8 146.0 L184.2 139.0 L184.5 132.0 L183.6 128.7 L181.2 126.4 L178.0 125.5 L174.7 126.4 L172.4 128.8 Z' fill='{furDark}'/><path d='M178 164 L178.5 191' stroke='{furDark}' stroke-width='9' stroke-linecap='round' fill='none'/><path d='M173.0 188 L183.5 188 Q186.5 193 188.5 200 L171.5 200 Q171.5 193 173.0 188 Z' fill='{hoof}'/>`,
    tail: `<path d='M64 104 C54 98 42 90 36 82 C30 88 30 100 38 110 C44 116 56 118 64 116 Z' fill='{fur}'/><path d='M33.5 92 C34 100 38 108 46 112 C52 114.5 58 115 62 114 C52 110 42 104 33.5 92 Z' fill='{tailWhite}'/>`,
    body: `<path d='M58 100 C90 94 140 98 172 90 C198 84 217 104 214 126 C212 142 202 150 186 150 C166 150 152 137 128 136 C110 135 100 147 84 150 C58 154 40 140 40 120 C40 108 46 102 58 100 Z' fill='{fur}'/><path d='M196 150 C206 146 212 136 213.5 124 C216 136 212 148 202 151 C200 151 198 151 196 150 Z' fill='{furLight}'/><path d='M134 137 C150 139 160 147 176 149 C160 152 146 144 134 137 Z' fill='{furLight}'/><circle cx='96' cy='104' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='114' cy='102' r='4.2' fill='{spot}' opacity='0.9'/><circle cx='132' cy='102' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='150' cy='99' r='4.2' fill='{spot}' opacity='0.9'/><circle cx='167' cy='96' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='105' cy='114' r='3.4' fill='{spot}' opacity='0.9'/><circle cx='124' cy='113' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='142' cy='111' r='3.4' fill='{spot}' opacity='0.9'/><circle cx='160' cy='108' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='178' cy='103' r='3.4' fill='{spot}' opacity='0.9'/>`,
    legBR: `<path d='M76 102 C98 98 112 116 106 136 C103 148 94 156 88.5 164 L79.5 164 C72 156 60 146 60 130 C60 116 64 104 76 102 Z' fill='{fur}'/><path d='M82 146 C76 152 74 158 75 162 C76 165 81 165 84 164 Z' fill='{fur}'/><path d='M96 108 Q108.7 127.9 92 154 Q111.3 128.1 96 108 Z' fill='{line}'/><circle cx='75' cy='118' r='3.4' fill='{spot}' opacity='0.9'/><circle cx='89' cy='113' r='3.8' fill='{spot}' opacity='0.9'/><circle cx='84' cy='127' r='3.4' fill='{spot}' opacity='0.9'/><path d='M84 160 L84.5 191' stroke='{fur}' stroke-width='9' stroke-linecap='round' fill='none'/><path d='M83.5 149 Q77.5 157.9 82.5 165 Q79.5 158.1 83.5 149 Z' fill='{line}'/><path d='M79.0 188 L89.5 188 Q92.5 193 94.5 200 L77.5 200 Q77.5 193 79.0 188 Z' fill='{hoof}'/>`,
    legFR: `<path d='M187.5 132.0 L187.9 139.0 L188.2 146.0 L188.6 153.0 L188.9 160.0 L189.2 167.0 L189.9 169.4 L191.6 171.1 L194.0 171.8 L196.4 171.1 L198.1 169.4 L198.8 167.0 L199.1 160.0 L199.4 153.0 L199.8 146.0 L200.2 139.0 L200.5 132.0 L199.6 128.7 L197.2 126.4 L194.0 125.5 L190.7 126.4 L188.4 128.8 Z' fill='{fur}'/><path d='M194 164 L194.5 191' stroke='{fur}' stroke-width='9' stroke-linecap='round' fill='none'/><path d='M191.8 140.6 C187.6 143 184.6 146.6 185.2 149.6 C186.4 152.6 190.6 153.2 194.2 152 L194.2 140.6 Z' fill='{fur}'/><path d='M194.8 137 Q189 144.1 193 151 Q191 144.3 194.8 137 Z' fill='{line}'/><path d='M189.0 188 L199.5 188 Q202.5 193 204.5 200 L187.5 200 Q187.5 193 189.0 188 Z' fill='{hoof}'/>`,
    earL: `<path d='M214 46 C206 36 198 26 190 18 C186 26 190 40 204 50 Z' fill='{furDark}'/>`,
    head: `<path d='M214.7 38.4 L212.6 34.0 L210.5 29.8 L208.5 25.7 L206.7 21.6 L205.1 17.5 L203.8 13.3 L202.9 8.8 L202.5 3.9 L202.1 2.6 L201.1 1.8 L199.9 1.5 L198.6 1.9 L197.8 2.9 L197.5 4.1 L197.6 9.4 L198.2 14.4 L199.2 19.2 L200.6 23.9 L202.1 28.3 L203.9 32.7 L205.6 37.1 L207.3 41.6 L208.6 43.2 L210.5 44.0 L212.6 43.7 L214.2 42.4 L215.0 40.5 Z' fill='{antler}'/><path d='M206.2 24.0 L208.3 21.4 L210.5 18.8 L212.6 16.1 L214.7 13.5 L215.2 12.5 L215.1 11.3 L214.5 10.3 L213.5 9.8 L212.3 9.9 L211.3 10.5 L208.9 12.9 L206.5 15.2 L204.2 17.6 L201.8 20.0 L201.1 21.4 L201.1 22.9 L202.0 24.2 L203.4 24.9 L204.9 24.9 Z' fill='{antler}'/><path d='M226.0 38.2 L226.0 33.9 L226.3 29.9 L226.9 25.9 L227.8 22.0 L229.1 18.0 L230.5 13.8 L232.3 9.6 L234.2 5.1 L234.5 3.8 L234.1 2.6 L233.1 1.8 L231.8 1.5 L230.6 1.9 L229.8 2.9 L227.4 7.3 L225.3 11.5 L223.3 15.8 L221.7 20.0 L220.2 24.3 L219.1 28.7 L218.4 33.3 L218.0 37.8 L218.5 39.9 L219.9 41.4 L221.8 42.0 L223.9 41.5 L225.4 40.1 Z' fill='{antler}'/><path d='M224.4 26.6 L227.1 25.0 L229.8 23.3 L232.4 21.6 L235.1 20.0 L235.9 19.2 L236.2 18.1 L236.0 16.9 L235.2 16.1 L234.1 15.8 L232.9 16.0 L230.1 17.4 L227.2 18.7 L224.4 20.0 L221.6 21.4 L220.4 22.4 L220.0 23.9 L220.4 25.4 L221.4 26.6 L222.9 27.0 Z' fill='{antler}'/><path d='M199.8 132.6 L201.5 125.7 L203.3 118.8 L205.1 111.7 L207.1 104.4 L209.0 97.1 L211.0 89.7 L212.9 82.2 L214.8 74.7 L216.7 67.1 L218.4 59.6 L218.8 53.9 L216.3 48.8 L211.6 45.6 L205.9 45.2 L200.8 47.7 L197.6 52.4 L194.4 59.3 L191.1 66.1 L187.8 72.9 L184.4 79.7 L181.0 86.4 L177.6 93.1 L174.1 99.8 L170.7 106.4 L167.4 113.0 L164.2 119.4 L163.3 129.2 L167.4 138.1 L175.4 143.8 L185.2 144.7 L194.1 140.6 Z' fill='{fur}'/><circle cx='219' cy='49' r='21' fill='{fur}'/><path d='M215.8 68.0 L220.7 67.3 L225.1 66.7 L229.4 66.2 L233.5 65.9 L237.4 65.7 L241.2 65.5 L244.9 65.4 L248.4 65.3 L252.3 65.1 L255.6 63.0 L257.3 59.6 L257.1 55.7 L255.0 52.4 L251.6 50.7 L248.2 49.1 L244.5 47.6 L240.6 46.0 L236.3 44.6 L231.7 43.2 L226.8 42.0 L221.6 40.9 L216.2 40.0 L209.2 41.8 L204.0 46.8 L202.0 53.8 L203.8 60.8 L208.8 66.0 Z' fill='{fur}'/><path d='M236 64 C242 67 248 66 253 62 C254 66 249 69 243 69 C239 69 237 67 236 64 Z' fill='{furLight}'/><ellipse cx='252.5' cy='56' rx='5' ry='4.2' fill='{nose}'/>`,
    earR: `<path d='M226 48 C214 36 198 30 180 31 C186 42 202 52 220 56 Z' fill='{fur}'/><path d='M216 46 C207 39 196 35 186 34.5 C190 42 200 48 212 51 Z' fill='{earIn}'/>`,
    eyes: {
      open: `<ellipse cx='227' cy='46' rx='6.5' ry='7.5' fill='#fff'/><circle cx='228.5' cy='47' r='4.8' fill='{iris}'/><circle cx='230' cy='44.5' r='1.7' fill='#fff'/>`,
      closed: `<path d='M220.5 47 Q227 52.5 233.5 47' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='227' cy='45' rx='8' ry='9' fill='#fff'/><circle cx='227.8' cy='46' r='3.6' fill='{iris}'/><circle cx='229' cy='43.8' r='1.3' fill='#fff'/>`,
      happy: `<path d='M220.5 48.5 Q227 40.5 233.5 48.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='227' cy='47' rx='6.5' ry='6.5' fill='#fff'/><circle cx='227.8' cy='48.5' r='4.5' fill='{iris}'/><circle cx='229.2' cy='46.5' r='1.5' fill='#fff'/><path d='M219 39 L233 35.5' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<ellipse cx='227' cy='47' rx='6.5' ry='5.8' fill='#fff'/><circle cx='228.5' cy='48' r='4.5' fill='{iris}'/><circle cx='229.8' cy='46.2' r='1.4' fill='#fff'/><path d='M219 35.5 L234 41.5' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M240 64.5 Q245 67.2 250 63.8' stroke='{line}' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M237.5 63 Q245 72.6 252 62.4 Q245 66 237.5 63 Z' fill='{mouth}'/><path d='M241.2 67.2 Q245 65.4 248.6 67.2 Q245 69.6 241.2 67.2 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='245' cy='66.6' rx='4.8' ry='4.2' fill='{mouth}'/><ellipse cx='245' cy='69' rx='3' ry='1.8' fill='{tongue}'/>`,
      sad: `<path d='M239.4 67.2 Q245 62.4 250.4 66.6' stroke='{line}' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M238.8 66.6 Q245 63.6 251 66' stroke='{line}' stroke-width='2.8' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M238.2 66.6 Q241.2 63.6 244.2 66.6 Q247.2 69.6 250.8 66' stroke='{line}' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
    },
  },
};
