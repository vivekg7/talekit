import type { CharacterInput } from '../engine/types.js';

/**
 * A small dog on the `simple` rig: 200×200 box, base on y=200, faces right. One `body`
 * part written in depth order (far legs, tail, body, neck, near legs, head, ear, muzzle),
 * every piece sunk at least 12 units into what it hangs from, so it reads as one animal.
 */
export const DOG: CharacterInput = {
  id: 'dog',
  name: 'Dog',
  description: 'Small floppy-eared dog (simple rig); bobs when walking, can talk and blink.',
  rig: 'simple',
  height: 110,
  colors: {
    fur: '#d9a066',
    furDark: '#b9823f',
    furLight: '#f3d9b1',
    collar: '#e63946',
    tag: '#f4c430',
    nose: '#2e2633',
    mouth: '#7a2a32',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    body: `<path d='M60 148 L60 191' stroke='{furDark}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M124 148 L126 191' stroke='{furDark}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M46 134 Q24 122 26 94' stroke='{fur}' stroke-width='13' stroke-linecap='round' fill='none'/><ellipse cx='90' cy='140' rx='58' ry='33' fill='{fur}'/><path d='M60 160 Q90 176 124 160 Q118 172 90 173 Q66 172 60 160 Z' fill='{furLight}'/><path d='M118 140 L140 108' stroke='{fur}' stroke-width='34' stroke-linecap='round' fill='none'/><path d='M74 150 L74 191' stroke='{fur}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M138 146 L140 191' stroke='{fur}' stroke-width='16' stroke-linecap='round' fill='none'/><circle cx='146' cy='96' r='32' fill='{fur}'/><ellipse cx='170' cy='112' rx='22' ry='15' fill='{furLight}'/><path d='M126 74 Q108 82 112 116 Q118 128 128 118 Q136 96 136 78 Z' fill='{furDark}'/><path d='M120 130 Q140 140 158 122' stroke='{collar}' stroke-width='8' fill='none' stroke-linecap='round'/><circle cx='142' cy='138' r='5' fill='{tag}'/><ellipse cx='186' cy='105' rx='7' ry='6' fill='{nose}'/>`,
    eyes: {
      open: `<ellipse cx='152' cy='88' rx='7' ry='8' fill='#fff'/><circle cx='154' cy='89' r='4.5' fill='{line}'/><circle cx='155.5' cy='86.5' r='1.6' fill='#fff'/>`,
      closed: `<path d='M145 89 Q152 95 159 89' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='152' cy='87' rx='9' ry='10' fill='#fff'/><circle cx='153' cy='88' r='3.5' fill='{line}'/><circle cx='154.5' cy='85.5' r='1.3' fill='#fff'/>`,
      happy: `<path d='M145 91 Q152 82 159 91' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='152' cy='89' rx='7' ry='7' fill='#fff'/><circle cx='153' cy='91' r='4.5' fill='{line}'/><path d='M143 80 L159 76' stroke='{line}' stroke-width='3' stroke-linecap='round'/>`,
      angry: `<ellipse cx='152' cy='89' rx='7' ry='6.5' fill='#fff'/><circle cx='154' cy='90' r='4.5' fill='{line}'/><path d='M143 76 L160 83' stroke='{line}' stroke-width='3.5' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M166 121 Q174 126 182 120' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M162 118 Q174 134 186 117 Q174 123 162 118 Z' fill='{mouth}'/><path d='M168 125 Q174 122 180 125 Q174 129 168 125 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='175' cy='124' rx='8' ry='7' fill='{mouth}'/><ellipse cx='175' cy='128' rx='5' ry='3' fill='{tongue}'/>`,
      sad: `<path d='M165 125 Q174 117 183 124' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M164 124 Q174 119 184 123' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M163 124 Q168 119 173 124 Q178 129 184 123' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    },
  },
};
