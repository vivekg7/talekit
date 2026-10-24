import type { CharacterInput } from '../engine/types.js';

/**
 * An elderly woman in a sari, on the grown-up's box and pivots, shorter than grandpa. Grey-white
 * hair parted in the middle and combed back to a low bun at the nape with a string of jasmine
 * round it; a small gold stud at the ear. Round wire glasses, a bindi, a line across the forehead
 * and soft lines from the nose to the mouth in `face`, so they turn with it, and grey brows over
 * the eyes. A neck in a round neckline; an elbow-length blouse under the sari, whose pallu crosses
 * the chest from the near hip to the far shoulder with a gold border and falls down the back (it
 * shows past the rounded back in profile, and down the middle of it from behind), with the pleats
 * tucked at the waist. The skirt of the sari is drawn on the legs, half on each, as wide strokes
 * with the pleats down the near half and a gold border at the hem over the feet: the torso stops
 * at the hips (so sitting on the ground does not push it through the floor) and the knees bend
 * inside the sari. Bare forearms with gold and red bangles, mitten hands with the thumb forward
 * and a line where the fingers curl, and chappals with a toe post. Limbs are round-capped strokes
 * from the pivots, and the neck reaches 30 units into the head.
 */
export const GRANDMA: CharacterInput = {
  id: 'grandma',
  name: 'Grandma',
  description:
    'Elderly woman, grey hair in a bun, glasses, bindi, sari and bangles; recolour via colors.',
  rig: 'humanoid',
  height: 270,
  colors: {
    skin: '#c48a5e',
    skinDark: '#a06c45',
    hair: '#e9e5dd',
    hairLight: '#f8f6f1',
    hairDark: '#bdb5a8',
    sari: '#2f7a68',
    sariLight: '#4b9a85',
    sariDark: '#215748',
    border: '#e2b04a',
    borderDark: '#b5862c',
    blouse: '#a3324a',
    blouseDark: '#7a2236',
    bangle: '#e2b04a',
    bangle2: '#c1121f',
    chappal: '#7a4a2c',
    strap: '#5a3420',
    gajra: '#fbf8ef',
    stud: '#e2b04a',
    glasses: '#5a4636',
    bindi: '#c1121f',
    lip: '#8e4a4a',
    cheek: '#e07a6a',
    mouth: '#7a2a32',
    tongue: '#e07a7a',
    line: '#2e2633',
  },
  parts: {
    armL: `<path d='M76 178 L71 284' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M61 282 C59 292 64 300 71 300 C79 300 82 293 81 283 C79 276 63 275 61 282 Z' fill='{skin}'/><path d='M71 281 C80 274 86 279 85 285 C84 290 80 294 71 292 Z' fill='{skin}'/><path d='M63 262 Q72 265.5 81 262 L81 266 Q72 269.5 63 266 Z' fill='{bangle}'/><path d='M63 267.5 Q72 271 81 267.5 L81 271.5 Q72 275 63 271.5 Z' fill='{bangle2}'/><path d='M63 273 Q72 276.5 81 273 L81 277 Q72 280.5 63 277 Z' fill='{bangle}'/><circle cx='76' cy='173' r='14' fill='{blouse}'/><path d='M62 174 L62.5 214 L88.5 214 L90 174 Z' fill='{blouse}'/><path d='M62.4 207 Q75.5 210 88.6 207 L88.5 215 Q75.5 218 62.5 215 Z' fill='{border}'/><path d='M63 290 Q67.9 295.7 73 291 Q68.1 293.3 63 290 Z' fill='{line}'/>`,
    legL: `<path d='M74 393 C73 383 78 375 86 375 C94 375 99 383 104 387 C111 389 114 392 114 396 L74 396 Z' fill='{skin}'/><path d='M72 394 L116 394 Q117 400 111 400 L77 400 Q72 400 72 394 Z' fill='{chappal}'/><path d='M101 385 L104 394' stroke='{strap}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M86 274 L86 330' stroke='{sari}' stroke-width='44' stroke-linecap='round' fill='none'/><path d='M86 300 L86 388' stroke='{sari}' stroke-width='44' stroke-linecap='butt' fill='none'/><path d='M76 292 L75 368' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M64 374 L108 374 L108 388 L64 388 Z' fill='{border}'/><path d='M64 379 L108 379' stroke='{borderDark}' stroke-width='2' fill='none'/>`,
    legR: `<path d='M104 393 C103 383 108 375 116 375 C124 375 129 383 134 387 C141 389 144 392 144 396 L104 396 Z' fill='{skin}'/><path d='M102 394 L146 394 Q147 400 141 400 L107 400 Q102 400 102 394 Z' fill='{chappal}'/><path d='M131 385 L134 394' stroke='{strap}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M114 274 L114 330' stroke='{sari}' stroke-width='44' stroke-linecap='round' fill='none'/><path d='M114 300 L114 388' stroke='{sari}' stroke-width='44' stroke-linecap='butt' fill='none'/><path d='M101 296 L99 370' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M109 292 L108.5 370' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M117 292 L117.5 370' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M125 296 L127 370' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M92 374 L136 374 L136 388 L92 388 Z' fill='{border}'/><path d='M92 379 L136 379' stroke='{borderDark}' stroke-width='2' fill='none'/>`,
    torso: {
      default: `<rect x='90' y='122' width='20' height='54' rx='9' fill='{skin}'/><path d='M62 166 Q50 200 49 284 L70 288 L72 200 Z' fill='{sari}'/><path d='M62 172 Q53 205 52.5 282' stroke='{border}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M74 160 Q100 153 124 160 Q137 164 139 178 L141 246 L139 285 Q120 292 100 290 Q80 292 61 285 L59 246 L59 196 Q56 170 74 160 Z' fill='{sari}'/><path d='M74 160 Q100 153 124 160 Q137 164 139 178 L140 214 Q100 222 59 214 L59 196 Q56 170 74 160 Z' fill='{blouse}'/><path d='M88 157 Q100 184 112 157 Z' fill='{skin}'/><path d='M86 156 Q100 188 114 156' stroke='{blouseDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M57 214 Q54 168 76 157 L95 156 Q118 196 141 232 L141 264 Q130 266 122 262 Q90 236 57 214 Z' fill='{sari}'/><path d='M95 156 Q118 196 141 232' stroke='{border}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M78 164 Q102 202 131 250' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M62 194 Q92 222 118 254' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='88' cy='188' r='2.4' fill='{border}'/><circle cx='104' cy='210' r='2.4' fill='{border}'/><circle cx='120' cy='234' r='2.4' fill='{border}'/><path d='M60 252 Q100 262 140 252' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M101 266 L101 289' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M109 266 L109 289' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M117 265 L117 288' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M125 264 L125 287' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      back: `<rect x='90' y='122' width='20' height='54' rx='9' fill='{skin}'/><path d='M74 160 Q100 153 124 160 Q137 164 139 178 L141 246 L139 285 Q120 292 100 290 Q80 292 61 285 L59 246 L59 196 Q56 170 74 160 Z' fill='{sari}'/><path d='M74 160 Q100 153 124 160 Q137 164 139 178 L140 214 Q100 222 59 214 L59 196 Q56 170 74 160 Z' fill='{blouse}'/><path d='M88 157 Q100 168 112 157 Z' fill='{skin}'/><path d='M86 156 Q100 172 114 156' stroke='{blouseDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M66 160 Q82 155 96 158 L98 287 Q80 291 62 287 Q60 220 66 160 Z' fill='{sari}'/><path d='M96 158 L98 286' stroke='{border}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M76 164 L76 286' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='86' cy='196' r='2.4' fill='{border}'/><circle cx='86' cy='236' r='2.4' fill='{border}'/><circle cx='86' cy='272' r='2.4' fill='{border}'/><path d='M100 252 Q120 258 140 252' stroke='{sariDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    },
    head: {
      default: `<circle cx='47' cy='122' r='18' fill='{hair}'/><path d='M47 110 Q60 116 52 128 Q42 134 36 124' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='32' cy='115' r='3.2' fill='{gajra}'/><circle cx='35' cy='109' r='3.2' fill='{gajra}'/><circle cx='40.5' cy='105' r='3.2' fill='{gajra}'/><circle cx='47' cy='103.5' r='3.2' fill='{gajra}'/><circle cx='31' cy='122' r='3.2' fill='{gajra}'/><path d='M62 138 C48 128 42 102 46 78 C54 52 80 40 104 40 L100 110 Z' fill='{hair}'/><path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><path d='M48 104 C42 74 58 46 86 38 C112 32 140 38 150 58 C156 70 156 84 152 98 Q149 102 147 97 C144 78 130 62 106 56 C90 60 78 72 74 90 C73 96 72 100 70 104 L64 100 C58 98 52 100 48 104 Z' fill='{hair}'/><path d='M106 56 Q100 47 92 41' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M94 45 Q72 50 57 78' stroke='{hairDark}' stroke-width='2.2' fill='none' stroke-linecap='round'/><path d='M60 64 C70 50 84 43 98 42 C86 48 74 56 66 70 Z' fill='{hairLight}'/><ellipse cx='58' cy='108' rx='10' ry='13' fill='{skin}'/><path d='M61 101 Q54 106 58 114' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='57' cy='120' r='2.8' fill='{stud}'/>`,
      back: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><ellipse cx='55' cy='106' rx='9' ry='13' fill='{skin}'/><ellipse cx='145' cy='106' rx='9' ry='13' fill='{skin}'/><circle cx='54' cy='119' r='2.8' fill='{stud}'/><circle cx='146' cy='119' r='2.8' fill='{stud}'/><path d='M52 112 C44 66 70 40 100 40 C130 40 156 66 148 112 C144 130 124 142 100 144 C76 142 56 130 52 112 Z' fill='{hair}'/><path d='M72 54 Q84 92 92 116' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M128 54 Q116 92 108 116' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M100 46 L100 108' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M64 62 C74 50 88 44 100 44 C88 50 78 58 70 70 Z' fill='{hairLight}'/><circle cx='100' cy='126' r='20' fill='{hair}'/><path d='M100 112 Q114 118 108 132 Q98 140 88 130' stroke='{hairDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='81' cy='120' r='3.2' fill='{gajra}'/><circle cx='85' cy='112' r='3.2' fill='{gajra}'/><circle cx='92' cy='107' r='3.2' fill='{gajra}'/><circle cx='100' cy='105.5' r='3.2' fill='{gajra}'/><circle cx='108' cy='107' r='3.2' fill='{gajra}'/><circle cx='115' cy='112' r='3.2' fill='{gajra}'/><circle cx='119' cy='120' r='3.2' fill='{gajra}'/>`,
    },
    face: `<path d='M90 69 Q100 66 110 69' stroke='{skinDark}' stroke-width='2' fill='none' stroke-linecap='round'/><circle cx='101' cy='78' r='3' fill='{bindi}'/><path d='M103 104 Q114 112 104 118' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='76' cy='121' r='7' fill='{cheek}' opacity='0.3'/><circle cx='124' cy='121' r='7' fill='{cheek}' opacity='0.3'/><path d='M72 114 Q74 122 80 127' stroke='{skinDark}' stroke-width='2' fill='none' stroke-linecap='round'/><path d='M128 114 Q126 122 120 127' stroke='{skinDark}' stroke-width='2' fill='none' stroke-linecap='round'/><circle cx='84' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/><circle cx='116' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/><path d='M97 99 Q100 96 103 99' stroke='{glasses}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M71 98 L62 96' stroke='{glasses}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    eyes: {
      open: `<ellipse cx='84' cy='101' rx='7' ry='8.5' fill='#fff'/><circle cx='86' cy='102' r='5' fill='{line}'/><circle cx='87.8' cy='100' r='1.8' fill='#fff'/><ellipse cx='116' cy='101' rx='7' ry='8.5' fill='#fff'/><circle cx='118' cy='102' r='5' fill='{line}'/><circle cx='119.8' cy='100' r='1.8' fill='#fff'/><path d='M75 85 Q84 79 93 83' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/><path d='M107 83 Q116 79 125 85' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/>`,
      closed: `<path d='M77 103 Q84 108 91 103' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M109 103 Q116 108 123 103' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M75 85 Q84 79 93 83' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/><path d='M107 83 Q116 79 125 85' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/>`,
      happy: `<path d='M77 105 Q84 96 91 105' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M109 105 Q116 96 123 105' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M75 83 Q84 77 93 80' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/><path d='M107 80 Q116 77 125 83' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='84' cy='100' rx='9' ry='11' fill='#fff'/><circle cx='85' cy='101' r='3.6' fill='{line}'/><circle cx='86.6' cy='99' r='1.4' fill='#fff'/><ellipse cx='116' cy='100' rx='9' ry='11' fill='#fff'/><circle cx='117' cy='101' r='3.6' fill='{line}'/><circle cx='118.6' cy='99' r='1.4' fill='#fff'/><path d='M75 81 Q84 75 93 79' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/><path d='M107 79 Q116 75 125 81' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='84' cy='102' rx='7' ry='7.5' fill='#fff'/><circle cx='85' cy='104' r='4.8' fill='{line}'/><circle cx='86.6' cy='102' r='1.6' fill='#fff'/><ellipse cx='116' cy='102' rx='7' ry='7.5' fill='#fff'/><circle cx='117' cy='104' r='4.8' fill='{line}'/><circle cx='118.6' cy='102' r='1.6' fill='#fff'/><path d='M75 89 Q84 87 93 81' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/><path d='M107 81 Q116 87 125 89' stroke='{hairDark}' stroke-width='4.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M76 96 L92 100 C93 106 89 109 84 109 C79 109 76 105 76 96 Z' fill='#fff'/><path d='M124 96 L108 100 C107 106 111 109 116 109 C121 109 124 105 124 96 Z' fill='#fff'/><circle cx='86' cy='104' r='4.5' fill='{line}'/><circle cx='117' cy='104' r='4.5' fill='{line}'/><circle cx='87.6' cy='102' r='1.4' fill='#fff'/><circle cx='118.6' cy='102' r='1.4' fill='#fff'/><path d='M74 85 L93 92' stroke='{hairDark}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M126 85 L107 92' stroke='{hairDark}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M93 131 Q102 136 111 130' stroke='{lip}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M89 127 Q102 146 115 127 Q102 132 89 127 Z' fill='{mouth}'/><path d='M95 136 Q102 132 109 136 Q102 140 95 136 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='102' cy='133' rx='8' ry='9' fill='{mouth}'/><ellipse cx='102' cy='137.5' rx='4.5' ry='3' fill='{tongue}'/>`,
      sad: `<path d='M93 136 Q102 129 111 136' stroke='{lip}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M92 134 Q102 129 112 134' stroke='{lip}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M91 134 Q96.5 128 102 134 Q107.5 140 113 134' stroke='{lip}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    armR: `<path d='M124 178 L129 284' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M119 282 C117 292 122 300 129 300 C137 300 140 293 139 283 C137 276 121 275 119 282 Z' fill='{skin}'/><path d='M129 281 C138 274 144 279 143 285 C142 290 138 294 129 292 Z' fill='{skin}'/><path d='M119 262 Q128 265.5 137 262 L137 266 Q128 269.5 119 266 Z' fill='{bangle}'/><path d='M119 267.5 Q128 271 137 267.5 L137 271.5 Q128 275 119 271.5 Z' fill='{bangle2}'/><path d='M119 273 Q128 276.5 137 273 L137 277 Q128 280.5 119 277 Z' fill='{bangle}'/><circle cx='124' cy='173' r='14' fill='{blouse}'/><path d='M110 174 L111.5 214 L137.5 214 L138 174 Z' fill='{blouse}'/><path d='M111.4 207 Q124.5 210 137.6 207 L137.5 215 Q124.5 218 111.5 215 Z' fill='{border}'/><path d='M121 290 Q125.9 295.7 131 291 Q126.1 293.3 121 290 Z' fill='{line}'/>`,
  },
};
