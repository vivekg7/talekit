import type { CharacterInput } from '../engine/types.js';

/**
 * A child in a dress with pigtails: the humanoid bar for the house style. Canonical 200×400
 * box, feet on y=400. Pivots: neck (100,152), shoulders (76,170)/(124,170), hips
 * (86,272)/(114,272). No outlines drawn here: the engine adds them. Limbs are round-capped
 * strokes from their pivots, the neck reaches 24 units into the head, the hem hangs 20
 * below the hips, and the pigtails sink 20 into the head, so nothing opens up in motion.
 */
export const KID: CharacterInput = {
  id: 'kid',
  name: 'Kid',
  description: 'Child with pigtails and a dress; recolour hair/skin/dress via colors.',
  rig: 'humanoid',
  height: 220,
  colors: {
    skin: '#f6c9a5',
    hair: '#5a3420',
    dress: '#e63946',
    dressDark: '#b8283a',
    legs: '#f6c9a5',
    socks: '#ffffff',
    shoes: '#3d405b',
    cheek: '#f28b82',
    mouth: '#8c2f39',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    armL: `<path d='M76 172 L71 278' stroke='{skin}' stroke-width='17' stroke-linecap='round' fill='none'/><path d='M76 172 L73 204' stroke='{dress}' stroke-width='28' stroke-linecap='round' fill='none'/><path d='M59 205 A14 14 0 0 0 87 205' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><circle cx='71' cy='282' r='11' fill='{skin}'/>`,
    legL: `<path d='M86 274 L85 384' stroke='{legs}' stroke-width='19' stroke-linecap='round' fill='none'/><path d='M85 360 L85 384' stroke='{socks}' stroke-width='19' fill='none'/><path d='M74 388 Q76 377 89 377 Q102 377 107 389 Q109 400 98 400 L79 400 Q72 399 74 388 Z' fill='{shoes}'/>`,
    legR: `<path d='M114 274 L115 384' stroke='{legs}' stroke-width='19' stroke-linecap='round' fill='none'/><path d='M115 360 L115 384' stroke='{socks}' stroke-width='19' fill='none'/><path d='M104 388 Q106 377 119 377 Q132 377 137 389 Q139 400 128 400 L109 400 Q102 399 104 388 Z' fill='{shoes}'/>`,
    torso: `<rect x='89' y='126' width='22' height='44' rx='9' fill='{skin}'/><path d='M78 160 Q100 152 122 160 Q134 164 137 180 L150 288 Q100 302 50 288 L63 180 Q66 164 78 160 Z' fill='{dress}'/><path d='M53 268 L147 268 L150 288 Q100 302 50 288 Z' fill='{dressDark}'/><path d='M92 158 Q106 176 120 158 Q106 165 92 158 Z' fill='#fff'/>`,
    head: `<circle cx='42' cy='108' r='22' fill='{hair}'/><circle cx='150' cy='112' r='20' fill='{hair}'/><circle cx='100' cy='90' r='60' fill='{skin}'/><path d='M40 98 C36 46 70 22 100 22 C132 22 164 46 160 98 C152 78 140 66 124 63 Q112 74 92 70 Q72 66 58 76 C50 82 44 90 40 98 Z' fill='{hair}'/><circle cx='47' cy='96' r='7' fill='{dress}'/>`,
    face: `<circle cx='70' cy='114' r='9' fill='{cheek}' opacity='0.5'/><circle cx='132' cy='114' r='9' fill='{cheek}' opacity='0.5'/><path d='M102 99 Q108 105 101 108' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    eyes: {
      open: `<ellipse cx='82' cy='94' rx='10' ry='12' fill='#fff'/><ellipse cx='118' cy='94' rx='10' ry='12' fill='#fff'/><circle cx='85' cy='96' r='6' fill='{line}'/><circle cx='121' cy='96' r='6' fill='{line}'/><circle cx='87.5' cy='92.5' r='2.2' fill='#fff'/><circle cx='123.5' cy='92.5' r='2.2' fill='#fff'/>`,
      closed: `<path d='M72 95 Q82 103 92 95' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M108 95 Q118 103 128 95' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      happy: `<path d='M72 99 Q82 86 92 99' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M108 99 Q118 86 128 99' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='82' cy='93' rx='12' ry='15' fill='#fff'/><ellipse cx='118' cy='93' rx='12' ry='15' fill='#fff'/><circle cx='83' cy='94' r='4.5' fill='{line}'/><circle cx='119' cy='94' r='4.5' fill='{line}'/><circle cx='85' cy='91.5' r='1.8' fill='#fff'/><circle cx='121' cy='91.5' r='1.8' fill='#fff'/>`,
      sad: `<ellipse cx='82' cy='95' rx='10' ry='11' fill='#fff'/><ellipse cx='118' cy='95' rx='10' ry='11' fill='#fff'/><circle cx='84' cy='99' r='6' fill='{line}'/><circle cx='120' cy='99' r='6' fill='{line}'/><circle cx='86.5' cy='95.5' r='2.2' fill='#fff'/><circle cx='122.5' cy='95.5' r='2.2' fill='#fff'/><path d='M70 82 L91 75' stroke='{line}' stroke-width='3.5' stroke-linecap='round'/><path d='M130 82 L109 75' stroke='{line}' stroke-width='3.5' stroke-linecap='round'/>`,
      angry: `<ellipse cx='82' cy='96' rx='10' ry='10' fill='#fff'/><ellipse cx='118' cy='96' rx='10' ry='10' fill='#fff'/><circle cx='85' cy='97' r='6' fill='{line}'/><circle cx='121' cy='97' r='6' fill='{line}'/><circle cx='87.5' cy='94' r='2' fill='#fff'/><circle cx='123.5' cy='94' r='2' fill='#fff'/><path d='M70 76 L93 85' stroke='{line}' stroke-width='4' stroke-linecap='round'/><path d='M130 76 L107 85' stroke='{line}' stroke-width='4' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M93 123 Q102 130 111 123' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M87 119 Q102 142 117 119 Q102 125 87 119 Z' fill='{mouth}'/><path d='M95 131 Q102 127 109 131 Q102 135 95 131 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='102' cy='126' rx='10' ry='12' fill='{mouth}'/><ellipse cx='102' cy='132' rx='6' ry='4' fill='{tongue}'/>`,
      sad: `<path d='M92 130 Q102 120 112 130' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M91 128 Q102 122 113 128' stroke='{line}' stroke-width='4' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M89 127 Q95 120 101 127 Q107 134 113 127' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    armR: `<path d='M124 172 L129 278' stroke='{skin}' stroke-width='17' stroke-linecap='round' fill='none'/><path d='M124 172 L127 204' stroke='{dress}' stroke-width='28' stroke-linecap='round' fill='none'/><path d='M113 205 A14 14 0 0 0 141 205' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><circle cx='129' cy='282' r='11' fill='{skin}'/>`,
  },
};
