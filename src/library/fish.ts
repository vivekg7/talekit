import type { CharacterInput } from '../engine/types.js';

/**
 * A round storybook goldfish on the `simple` rig: 200×200 box, faces right, the belly near
 * the base line. `body` in depth order: the dorsal fin and a small fin underneath behind the
 * body, one round body with a lighter belly, columns of scale arcs, the gill line behind the
 * head, a pectoral fin fanned back over the side, a faint blush. The forked tail is its own
 * part hung from the body at the tail root and listed in `springs`, so it swishes behind the
 * bob of a swim (a `walk`) and flicks on the stop. Swimming in water is the scene's job: a
 * pond's `foreground` laid over the fish.
 */
export const FISH: CharacterInput = {
  id: 'fish',
  name: 'Fish',
  description: 'Round orange goldfish (simple rig): swims with a walk, its tail swishing behind.',
  rig: 'simple',
  height: 50,
  colors: {
    scales: '#f39a2b',
    scalesDark: '#d9731a',
    belly: '#fcd27a',
    fin: '#f7b54e',
    finDark: '#df8226',
    eye: '#ffffff',
    cheek: '#f2788c',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  hangs: { tail: { from: 'body', at: [60, 128] } },
  springs: ['tail'],
  parts: {
    tail: `<path d='M76 114 C62 110 46 94 32 78 C22 68 8 72 9 86 C11 104 20 118 27 128 C20 138 11 152 9 170 C8 184 22 188 32 178 C46 162 62 146 76 142 Z' fill='{fin}'/><path d='M58 122 L24 90 M58 134 L24 166 M58 128 L32 128' stroke='{finDark}' stroke-width='3' stroke-linecap='round' fill='none'/>`,
    body: `<path d='M84 76 C90 46 116 28 148 32 C142 44 138 58 138 72 Z' fill='{fin}'/><path d='M100 46 L104 70 M118 38 L118 66 M134 35 L130 66' stroke='{finDark}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M92 184 C96 196 112 200 128 196 C122 192 118 188 116 182 Z' fill='{fin}'/><path d='M187 122 C185 84 152 62 116 62 C80 62 56 92 52 128 C56 164 80 194 116 194 C152 194 185 166 187 134 Z' fill='{scales}'/><path d='M66 150 C84 182 130 194 160 174 C170 166 178 156 182 144 C150 158 104 162 66 150 Z' fill='{belly}'/><path d='M80 92 Q72 101 80 110 M80 120 Q72 129 80 138 M100 80 Q92 89 100 98 M100 106 Q92 115 100 124 M100 132 Q92 141 100 150 M120 92 Q112 101 120 110 M120 120 Q112 129 120 138' stroke='{scalesDark}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M146 78 Q132 124 148 170' stroke='{scalesDark}' stroke-width='3.5' stroke-linecap='round' fill='none'/><path d='M136 134 C122 130 102 140 96 158 C110 162 126 158 138 146 Z' fill='{fin}'/><path d='M134 140 L106 154 M134 140 L112 144' stroke='{finDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/><circle cx='168' cy='134' r='7' fill='{cheek}' opacity='0.45'/>`,
    eyes: {
      open: `<circle cx='154' cy='104' r='12' fill='{eye}'/><circle cx='157' cy='105' r='7' fill='{line}'/><circle cx='159.4' cy='101.8' r='2.6' fill='#fff'/>`,
      closed: `<path d='M143 106 Q154 114 165 106' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      wide: `<circle cx='154' cy='102' r='14' fill='{eye}'/><circle cx='156' cy='103' r='4.6' fill='{line}'/><circle cx='157.6' cy='100.6' r='1.7' fill='#fff'/>`,
      happy: `<path d='M143 108 Q154 96 165 108' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='154' cy='106' r='11' fill='{eye}'/><circle cx='156' cy='109' r='6.4' fill='{line}'/><circle cx='158' cy='106' r='2.2' fill='#fff'/><path d='M140 90 L160 85' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<circle cx='154' cy='106' r='11' fill='{eye}'/><circle cx='157' cy='107' r='6.4' fill='{line}'/><circle cx='159' cy='104.4' r='2.2' fill='#fff'/><path d='M140 85 L164 94' stroke='{line}' stroke-width='4' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M174 132 Q181 137 187 131' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      open: `<ellipse cx='181' cy='132' rx='6.5' ry='8.5' fill='{mouth}' stroke='{line}' stroke-width='3'/>`,
      smile: `<path d='M168 128 Q178 141 187 128' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      sad: `<path d='M171 138 Q179 128 187 136' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M171 135 Q179 130 187 134' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M174 128 Q178 125 182 128 Q186 131 187 135 Q182 141 176 139 Q172 134 174 128 Z' fill='{mouth}' stroke='{line}' stroke-width='3'/>`,
    },
  },
};
