import type { CharacterInput } from '../engine/types.js';

/**
 * An elderly man in a kurta and a sadri, on the same box and pivots as `grownup`, a little
 * shorter. A bald crown with a shine and a white fringe round the back and over the far ear (a
 * tuft at the near temple); round wire glasses, forehead lines and a white bushy moustache in
 * `face`, so they turn with it, and white eyebrows over the eyes; the mouths sit lower than the
 * grown-up's so they show under the moustache. A neck in a band collar; a sleeveless sadri
 * buttoned down the front with welt pockets, over a cream kurta that hangs to mid-thigh with
 * side slits and a band at the hem (the hem stays above the knees, so they bend in the open);
 * full kurta sleeves with a cuff, mitten hands with the thumb forward and a line where the
 * fingers curl; loose pyjamas gathered at the ankle, with folds at the back of the knee, and
 * juttis with a pointed toe and a line of embroidery. Limbs are round-capped strokes from the
 * pivots, the neck reaches 30 units into the head.
 */
export const GRANDPA: CharacterInput = {
  id: 'grandpa',
  name: 'Grandpa',
  description:
    'Elderly man, bald with white hair and moustache, glasses, kurta and sadri; recolour via colors.',
  rig: 'humanoid',
  height: 285,
  hem: 324, // his knee-length kurta ends here: what `sit` rests on the seat
  colors: {
    skin: '#c98f62',
    skinDark: '#a8714a',
    skinLight: '#dca67b',
    hair: '#f3f1ec',
    hairDark: '#d3cec4',
    kurta: '#f4eedf',
    kurtaDark: '#d6ccb4',
    jacket: '#a3532e',
    jacketDark: '#7c3d20',
    button: '#e9c46a',
    pyjama: '#ece6d7',
    pyjamaDark: '#cdc4ae',
    shoes: '#7a4426',
    sole: '#d8c3a5',
    trim: '#e9c46a',
    glasses: '#5a4636',
    cheek: '#e07a6a',
    mouth: '#7a2a32',
    tongue: '#e07a7a',
    line: '#2e2633',
  },
  parts: {
    armL: `<path d='M70.9 270 L70 288' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M59 284 C57 295 62 304 70 304 C79 304 82 296 81 285 C79 277 61 276 59 284 Z' fill='{skin}'/><path d='M70 283 C80 275 87 280 86 287 C85 292 80 297 70 295 Z' fill='{skin}'/><path d='M76 178 L73 232' stroke='{kurta}' stroke-width='24' stroke-linecap='round' fill='none'/><path d='M74 210 L70.7 276' stroke='{kurta}' stroke-width='24' stroke-linecap='butt' fill='none'/><path d='M59 268 L83 269' stroke='{kurtaDark}' stroke-width='3' stroke-linecap='round' fill='none'/><circle cx='76' cy='173' r='15' fill='{kurta}'/><path d='M62 293 Q66.9 298.7 72 294 Q67.1 296.3 62 293 Z' fill='{line}'/>`,
    legL: `<path d='M70 392 C69 383 76 378 86 378 L94 378 C102 380 110 383 117 385 C122 386 126 384 128 382 C128 389 124 395 117 396 L70 396 Z' fill='{shoes}'/><path d='M68 393 L121 393 Q122 400 115 400 L73 400 Q68 400 68 393 Z' fill='{sole}'/><path d='M92 382 Q101 386 110 385' stroke='{trim}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M86 274 L85 330' stroke='{pyjama}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M85.5 300 L85.1 368' stroke='{pyjama}' stroke-width='30' stroke-linecap='butt' fill='none'/><path d='M85.1 360 L85 384' stroke='{pyjama}' stroke-width='20' stroke-linecap='butt' fill='none'/><path d='M71 364 Q85 372 99 364 L95 372 Q85 377 75 372 Z' fill='{pyjama}'/><path d='M72.5 341 Q77.4 345.5 82.5 342 Q77.6 342.5 72.5 341 Z' fill='{pyjamaDark}'/><path d='M76 376 L94 376' stroke='{pyjamaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    legR: `<path d='M100 392 C99 383 106 378 116 378 L124 378 C132 380 140 383 147 385 C152 386 156 384 158 382 C158 389 154 395 147 396 L100 396 Z' fill='{shoes}'/><path d='M98 393 L151 393 Q152 400 145 400 L103 400 Q98 400 98 393 Z' fill='{sole}'/><path d='M122 382 Q131 386 140 385' stroke='{trim}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M114 274 L115 330' stroke='{pyjama}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M114.5 300 L114.9 368' stroke='{pyjama}' stroke-width='30' stroke-linecap='butt' fill='none'/><path d='M114.9 360 L115 384' stroke='{pyjama}' stroke-width='20' stroke-linecap='butt' fill='none'/><path d='M101 364 Q115 372 129 364 L125 372 Q115 377 105 372 Z' fill='{pyjama}'/><path d='M102.5 341 Q107.4 345.5 112.5 342 Q107.6 342.5 102.5 341 Z' fill='{pyjamaDark}'/><path d='M106 376 L124 376' stroke='{pyjamaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    torso: {
      default: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M74 160 Q100 152 126 160 Q140 164 142 180 L144 300 Q146 312 148 318 Q124 326 100 324 Q76 326 52 318 Q54 312 56 300 L58 180 Q60 164 74 160 Z' fill='{kurta}'/><path d='M55 306 Q100 318 145 306' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M60 290 L56 318' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M140 290 L144 318' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M101 268 L101 296' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M70 162 Q100 154 130 162 Q138 166 139 180 L138 262 Q124 270 100 268 Q76 270 62 262 L61 180 Q62 166 70 162 Z' fill='{jacket}'/><path d='M87 150 Q100 146 113 150 L114 165 Q100 161 86 165 Z' fill='{jacketDark}'/><path d='M101 163 L101 268' stroke='{jacketDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='106' cy='178' r='2.8' fill='{button}'/><circle cx='106' cy='200' r='2.8' fill='{button}'/><circle cx='106' cy='222' r='2.8' fill='{button}'/><circle cx='106' cy='244' r='2.8' fill='{button}'/><path d='M114 192 L130 190' stroke='{jacketDark}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M70 238 L88 239' stroke='{jacketDark}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M114 239 L132 238' stroke='{jacketDark}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      back: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M74 160 Q100 152 126 160 Q140 164 142 180 L144 300 Q146 312 148 318 Q124 326 100 324 Q76 326 52 318 Q54 312 56 300 L58 180 Q60 164 74 160 Z' fill='{kurta}'/><path d='M55 306 Q100 318 145 306' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M60 290 L56 318' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M140 290 L144 318' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M70 162 Q100 154 130 162 Q138 166 139 180 L138 262 Q124 270 100 268 Q76 270 62 262 L61 180 Q62 166 70 162 Z' fill='{jacket}'/><path d='M87 150 Q100 146 113 150 L114 165 Q100 161 86 165 Z' fill='{jacketDark}'/><path d='M100 168 L100 266' stroke='{jacketDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    },
    head: {
      default: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><path d='M118 54 C130 56 140 64 142 74 C134 68 126 62 116 60 Z' fill='{skinLight}'/><path d='M60 76 C50 84 46 100 48 114 C50 128 58 140 72 148 C78 144 78 136 74 128 L70 90 C68 84 64 80 60 76 Z' fill='{hair}'/><path d='M146 84 C152 90 154 102 150 112 C148 106 146 100 144 96 Z' fill='{hair}'/><ellipse cx='60' cy='106' rx='11' ry='14' fill='{skin}'/><path d='M63 99 Q56 104 60 112' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      back: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><path d='M86 56 C96 52 110 52 118 56 C108 56 96 58 88 62 Z' fill='{skinLight}'/><path d='M52 90 C48 124 70 146 100 148 C130 146 152 124 148 90 C140 112 124 124 100 124 C76 124 60 112 52 90 Z' fill='{hair}'/><ellipse cx='56' cy='106' rx='10' ry='14' fill='{skin}'/><ellipse cx='144' cy='106' rx='10' ry='14' fill='{skin}'/>`,
    },
    face: `<path d='M86 66 Q100 62 114 66' stroke='{skinDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M89 73 Q100 70 111 73' stroke='{skinDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M103 104 Q115 113 104 119' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><circle cx='76' cy='121' r='7' fill='{cheek}' opacity='0.3'/><circle cx='124' cy='121' r='7' fill='{cheek}' opacity='0.3'/><path d='M70 112 Q72 122 78 128' stroke='{skinDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M130 112 Q128 122 122 128' stroke='{skinDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M102 120 C94 117 85 119 79 125 C76 129 79 133 84 131 C90 127 96 127 102 128 C108 127 114 127 120 131 C125 133 128 129 125 125 C119 119 110 117 102 120 Z' fill='{hair}'/><circle cx='84' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/><circle cx='116' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/><path d='M97 99 Q100 96 103 99' stroke='{glasses}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M71 98 L62 96' stroke='{glasses}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    eyes: {
      open: `<ellipse cx='84' cy='101' rx='7' ry='8.5' fill='#fff'/><circle cx='86' cy='102' r='5' fill='{line}'/><circle cx='87.8' cy='100' r='1.8' fill='#fff'/><ellipse cx='116' cy='101' rx='7' ry='8.5' fill='#fff'/><circle cx='118' cy='102' r='5' fill='{line}'/><circle cx='119.8' cy='100' r='1.8' fill='#fff'/><path d='M73 85 Q83 78 94 83' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M106 83 Q117 78 127 85' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
      closed: `<path d='M77 103 Q84 108 91 103' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M109 103 Q116 108 123 103' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M73 85 Q83 78 94 83' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M106 83 Q117 78 127 85' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
      happy: `<path d='M77 105 Q84 96 91 105' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M109 105 Q116 96 123 105' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M73 83 Q83 75 94 80' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M106 80 Q117 75 127 83' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='84' cy='100' rx='9' ry='11' fill='#fff'/><circle cx='85' cy='101' r='3.6' fill='{line}'/><circle cx='86.6' cy='99' r='1.4' fill='#fff'/><ellipse cx='116' cy='100' rx='9' ry='11' fill='#fff'/><circle cx='117' cy='101' r='3.6' fill='{line}'/><circle cx='118.6' cy='99' r='1.4' fill='#fff'/><path d='M73 81 Q83 73 94 78' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M106 78 Q117 73 127 81' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='84' cy='102' rx='7' ry='7.5' fill='#fff'/><circle cx='85' cy='104' r='4.8' fill='{line}'/><circle cx='86.6' cy='102' r='1.6' fill='#fff'/><ellipse cx='116' cy='102' rx='7' ry='7.5' fill='#fff'/><circle cx='117' cy='104' r='4.8' fill='{line}'/><circle cx='118.6' cy='102' r='1.6' fill='#fff'/><path d='M73 89 Q84 87 94 80' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M106 80 Q116 87 127 89' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M76 96 L92 100 C93 106 89 109 84 109 C79 109 76 105 76 96 Z' fill='#fff'/><path d='M124 96 L108 100 C107 106 111 109 116 109 C121 109 124 105 124 96 Z' fill='#fff'/><circle cx='86' cy='104' r='4.5' fill='{line}'/><circle cx='117' cy='104' r='4.5' fill='{line}'/><circle cx='87.6' cy='102' r='1.4' fill='#fff'/><circle cx='118.6' cy='102' r='1.4' fill='#fff'/><path d='M72 84 L94 93' stroke='{hair}' stroke-width='7.5' fill='none' stroke-linecap='round'/><path d='M128 84 L106 93' stroke='{hair}' stroke-width='7.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M94 136 Q102 140 110 135' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M89 131 Q102 150 115 131 Q102 135 89 131 Z' fill='{mouth}'/><path d='M96 140 Q102 136 108 140 Q102 144 96 140 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='102' cy='138' rx='8' ry='9' fill='{mouth}'/><ellipse cx='102' cy='142.5' rx='4.5' ry='3' fill='{tongue}'/>`,
      sad: `<path d='M93 141 Q102 134 111 141' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M92 139 Q102 134 112 139' stroke='{line}' stroke-width='4' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M91 139 Q96 134 102 139 Q108 144 113 139' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    armR: `<path d='M129.4 266 L130 283' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M119 279 C117 290 122 299 130 299 C139 299 142 291 141 280 C139 272 121 271 119 279 Z' fill='{skin}'/><path d='M130 278 C140 270 147 275 146 282 C145 287 140 292 130 290 Z' fill='{skin}'/><path d='M124 178 L127 232' stroke='{kurta}' stroke-width='24' stroke-linecap='round' fill='none'/><path d='M126 210 L129.3 271' stroke='{kurta}' stroke-width='24' stroke-linecap='butt' fill='none'/><path d='M117 264 L141 263' stroke='{kurtaDark}' stroke-width='3' stroke-linecap='round' fill='none'/><circle cx='124' cy='173' r='15' fill='{kurta}'/><path d='M122 289 Q126.9 294.7 132 290 Q127.1 292.3 122 289 Z' fill='{line}'/>`,
  },
};
