import type { CharacterInput } from '../engine/types.js';

/**
 * An Indian house crow on the `simple` rig, laid out like `bird`: 200×200 box, base on y=200,
 * faces right. Slimmer and longer than the songbird, standing taller on its legs. One `body`
 * part in depth order: sturdy dark legs with three toes reaching the base line, a long wedge of
 * a tail angled down behind, a glossy black body under a long, flat-crowned head on a thick
 * neck, the grey collar of a house crow over the nape, neck and upper breast (face and throat
 * stay black), a long folded wing with blue-black sheen lines down the flight feathers. The eye
 * is pale with a dark pupil so it reads on black, and the closed and happy eyes are drawn in
 * the same pale grey. The heavy beak is the `mouth`, so talking opens it into a caw: slate grey
 * so it parts from the black face, the upper mandible curving down to the tip, with a light
 * ridge along the top and a dark gape line where the mandibles meet.
 */
export const CROW: CharacterInput = {
  id: 'crow',
  name: 'Crow',
  description: 'House crow, black with a grey collar (simple rig): hops, flies, caws to talk.',
  rig: 'simple',
  height: 75,
  colors: {
    feather: '#2c2c36',
    featherDark: '#1d1d25',
    sheen: '#4f6190',
    collar: '#7f818b',
    collarLight: '#9c9ea7',
    beak: '#4a4d5a',
    beakLight: '#7c808e',
    beakDark: '#2a2c34',
    eye: '#e4e2d8',
    legs: '#3b3b42',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body: `<path d='M98 150 L95 194 M95 194 L84 197 M95 194 L104 198 M95 194 L90 199' stroke='{legs}' stroke-width='5.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M120 152 L120 194 M120 194 L109 197 M120 194 L129 198 M120 194 L115 199' stroke='{legs}' stroke-width='5.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M84 124 L12 142 C4 144 1 156 7 161 L22 177 C27 183 34 182 38 177 L94 148 Z' fill='{featherDark}'/><path d='M70 136 L16 152' stroke='{sheen}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M72 146 L28 172' stroke='{sheen}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M134 58 C150 56 162 60 168 70 C172 78 172 90 170 100 C168 108 166 114 164 118 C162 140 154 156 118 158 C92 160 72 152 64 138 C58 126 66 110 82 102 C94 96 100 86 104 76 C110 64 120 58 134 58 Z' fill='{feather}'/><path d='M126 60 C122 72 124 86 132 96 C140 104 150 108 166 110 C167 118 165 126 160 130 C128 126 100 114 86 102 C96 92 102 82 106 72 C112 63 118 60 126 60 Z' fill='{collar}'/><path d='M108 74 C104 84 98 92 92 98 C102 102 110 102 116 98 C112 90 110 82 108 74 Z' fill='{collarLight}'/><path d='M132 106 C146 122 138 146 112 152 L36 158 C64 146 92 120 132 108 Z' fill='{featherDark}'/><path d='M118 128 Q86 140 54 154' stroke='{sheen}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M124 140 Q92 152 62 158' stroke='{sheen}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M112 120 Q118 116 126 116' stroke='{sheen}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
    eyes: {
      open: `<circle cx='141' cy='82' r='8' fill='{eye}'/><circle cx='143' cy='82.5' r='4.5' fill='{line}'/><circle cx='144.5' cy='80.5' r='1.6' fill='#fff'/>`,
      closed: `<path d='M133 83 Q141 89 149 83' stroke='{eye}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<circle cx='141' cy='81' r='10' fill='{eye}'/><circle cx='142' cy='82' r='3.6' fill='{line}'/><circle cx='143.4' cy='80' r='1.3' fill='#fff'/>`,
      happy: `<path d='M133 86 Q141 77 149 86' stroke='{eye}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='141' cy='84' r='7.5' fill='{eye}'/><circle cx='142' cy='86' r='4.2' fill='{line}'/><circle cx='143.4' cy='84' r='1.4' fill='#fff'/><path d='M131 74 L149 70' stroke='{collarLight}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<circle cx='141' cy='84' r='7.5' fill='{eye}'/><circle cx='143' cy='85' r='4.2' fill='{line}'/><circle cx='144.4' cy='83' r='1.4' fill='#fff'/><path d='M130 70 L151 78' stroke='{collarLight}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M154 71 C172 70 190 78 199 94 C192 96 176 96 156 97 Z' fill='{beak}'/><path d='M156 97 C174 97 188 97 196 96 C186 103 170 107 156 107 Z' fill='{beak}'/><path d='M156 97 L195 95.5' stroke='{beakDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M158 75 C174 74 186 80 194 89' stroke='{beakLight}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
      open: `<path d='M156 91 L190 82 L192 118 L156 105 Z' fill='{mouth}'/><path d='M154 69 C172 64 190 66 199 76 C190 82 174 88 156 92 Z' fill='{beak}'/><path d='M156 104 C172 108 186 114 194 120 C182 121 168 118 156 112 Z' fill='{beak}'/><path d='M158 72 C174 68 186 69 194 74' stroke='{beakLight}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
    },
  },
};
