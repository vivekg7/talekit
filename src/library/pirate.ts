import type { CharacterInput } from '../engine/types.js';

const MOUSTACHE = `<path d='M78 129 C84 123 94 121 102 125 C110 121 120 123 126 129 C130 133 132 139 128 143 C122 137 112 135 102 137 C92 135 82 137 76 143 C72 139 74 133 78 129 Z' fill='{beard}'/><path d='M90 127 Q96 125 101 129 M104 129 Q110 125 116 127' stroke='{beardLight}' stroke-width='2' fill='none' stroke-linecap='round'/>`;

// The patch over the near eye, its strings running up under the hat brim.
const PATCH = `<path d='M110 92 L99 78 M126 93 L133 77' stroke='{patch}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M108 97 C108 91 113 89 118 89 C124 89 128 92 128 98 C128 105 123 110 117.5 110 C111.5 110 108 104 108 97 Z' fill='{patch}'/><path d='M112 94 Q117 91.5 123 93' stroke='{patchLight}' stroke-width='2' fill='none' stroke-linecap='round'/>`;

const BROWS = (far: string, near: string) =>
  `<path d='${far}' stroke='{beard}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='${near}' stroke='{beard}' stroke-width='7' fill='none' stroke-linecap='round'/>`;

/**
 * A pirate on one peg leg, in a tricorn and a long coat. Same box and pivots as `grownup`. A
 * black tricorn with a gold-edged brim cocked up in three points, its front corner a little
 * right of centre over the turned face, and a small skull and crossbones on it; dark hair
 * behind the far ear tied back in a queue with a red ribbon (the back of the head shows it
 * down the nape); a bushy brown beard round the jaw, drawn in `head` so it frames whichever
 * way the face turns, with a curled moustache in every `mouth` so it stays over the lips; a
 * round nose and a ruddy far cheek in `face`; a black patch over the near eye, drawn in every
 * `eyes` variant with its strings running up under the brim, so only the far eye and the two
 * eyebrows carry the expression. A striped shirt open at the collar between the lapels of a
 * crimson long coat with navy facings, gold buttons and a gold hem, hanging to mid-thigh with
 * a vent at the back; a green sash round the waist knotted at the far hip, a leather belt over
 * it with a brass buckle. Full coat sleeves with deep navy cuffs and mitten hands. Tan
 * breeches gathered in a band below the knee; the far leg in a tall black boot with a
 * turned-down top, the near leg (`legR`) a turned wooden peg from that band, tapering to an
 * iron tip on the ground line. Everything below the knee hangs below the bend line at y=330,
 * so the knee bends as on any leg and the peg swings and plants like a shin and foot. Limbs
 * are round-capped strokes from the pivots, the neck reaches 30 units into the head and the
 * coat hangs 40 below the hips.
 */
export const PIRATE: CharacterInput = {
  id: 'pirate',
  name: 'Pirate',
  description:
    'Pirate with a peg leg, eye patch, beard, tricorn and long coat; recolour via colors.',
  rig: 'humanoid',
  height: 290,
  colors: {
    skin: '#c88b5c',
    skinDark: '#a26a40',
    beard: '#4a2c1c',
    beardLight: '#6e4630',
    hat: '#25212b',
    hatLight: '#3c3644',
    trim: '#e2b54a',
    bone: '#f1ead8',
    ribbon: '#b8323a',
    patch: '#1d1a20',
    patchLight: '#3d3842',
    shirt: '#f2ede2',
    stripe: '#3d5a8a',
    coat: '#8e2632',
    coatDark: '#661b24',
    facing: '#2c3a63',
    facingDark: '#1f2a4a',
    sash: '#2f7d6d',
    sashDark: '#215a4e',
    belt: '#3d2a1e',
    buckle: '#e2b54a',
    breeches: '#c9a46e',
    breechesDark: '#a5814f',
    boot: '#2f2522',
    bootLight: '#4a3a33',
    wood: '#b07a45',
    woodDark: '#7d5229',
    woodLight: '#d39b62',
    iron: '#4a4850',
    cheek: '#d9625a',
    mouth: '#6e2430',
    tongue: '#d8686c',
    teeth: '#f4efe2',
    gold: '#f0c24a',
    line: '#2e2633',
  },
  parts: {
    armL: `<path d='M70.9 270 L70 288' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M59 284 C57 295 62 304 70 304 C79 304 82 296 81 285 C79 277 61 276 59 284 Z' fill='{skin}'/><path d='M70 283 C80 275 87 280 86 287 C85 292 80 297 70 295 Z' fill='{skin}'/><path d='M76 178 L73 232' stroke='{coat}' stroke-width='24' stroke-linecap='round' fill='none'/><path d='M74 210 L71.2 262' stroke='{coat}' stroke-width='24' stroke-linecap='butt' fill='none'/><path d='M56 252 L88 254 L86 278 L56 276 Z' fill='{facing}'/><path d='M56.5 253 L87.5 255' stroke='{trim}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M60 264 L84 265' stroke='{facingDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/><circle cx='76' cy='173' r='15' fill='{coat}'/><path d='M62 293 Q66.9 298.7 72 294 Q67.1 296.3 62 293 Z' fill='{line}'/>`,
    legL: `<path d='M86 274 L86 330' stroke='{breeches}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M80 300 Q84 314 82 324' stroke='{breechesDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M86 350 L86 386' stroke='{boot}' stroke-width='22' stroke-linecap='round' fill='none'/><path d='M70 392 C69 383 76 378 86 378 L94 378 C102 380 110 383 117 385 C122 386 126 384 128 382 C128 389 124 395 117 396 L70 396 Z' fill='{boot}'/><path d='M68 393 L121 393 Q122 400 115 400 L73 400 Q68 400 68 393 Z' fill='{belt}'/><path d='M96 382 Q106 384 114 387' stroke='{bootLight}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M71 332 L101 332 L101 344 L71 344 Z' fill='{breechesDark}'/><circle cx='95' cy='338' r='2.4' fill='{trim}'/><path d='M70 343 L102 343 L99 360 L73 360 Z' fill='{bootLight}'/><path d='M74 356 L98 356' stroke='{boot}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
    legR: `<path d='M114 274 L114 330' stroke='{breeches}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M108 300 Q112 314 110 324' stroke='{breechesDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M103 334 L125 334 L124 344 L120.5 358 L117.5 395 L110.5 395 L107.5 358 L104 344 Z' fill='{wood}'/><path d='M106 350 L122 350 M108 364 L120 364 M109 378 L119 378' stroke='{woodDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M117 346 L115.5 390' stroke='{woodLight}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M109.5 390 L118.5 390 L117.5 400 L110.5 400 Z' fill='{iron}'/><path d='M99 332 L129 332 L129 344 L99 344 Z' fill='{breechesDark}'/><circle cx='123' cy='338' r='2.4' fill='{trim}'/>`,
    torso: {
      default: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M72 160 Q100 152 128 160 Q142 164 144 180 L146 250 L152 312 Q130 318 106 314 L100 262 L94 314 Q70 318 48 312 L54 250 L56 180 Q58 164 72 160 Z' fill='{coat}'/><path d='M94 262 L106 262 L109 314 L91 314 Z' fill='{breeches}'/><path d='M86 158 Q100 166 116 158 L122 250 L80 250 Z' fill='{shirt}'/><path d='M85 176 L117 176 M84 192 L118 192 M83 208 L119 208 M82 224 L120 224 M81 240 L121 240' stroke='{stripe}' stroke-width='5' fill='none'/><path d='M86 158 L96 174 L100 164 Z' fill='{shirt}'/><path d='M116 158 L106 174 L102 164 Z' fill='{shirt}'/><path d='M86 158 L96 174 M116 158 L106 174' stroke='{stripe}' stroke-width='2' fill='none' stroke-linecap='round'/><path d='M72 162 L86 158 L80 210 L74 250 L66 250 L68 200 Z' fill='{facing}'/><path d='M128 162 L116 158 L122 210 L126 250 L134 250 L132 200 Z' fill='{facing}'/><path d='M86 158 L80 210 L74 250 M116 158 L122 210 L126 250' stroke='{trim}' stroke-width='2.5' fill='none' stroke-linecap='round'/><circle cx='71' cy='212' r='2.8' fill='{trim}'/><circle cx='70' cy='232' r='2.8' fill='{trim}'/><circle cx='131' cy='212' r='2.8' fill='{trim}'/><circle cx='132' cy='232' r='2.8' fill='{trim}'/><path d='M54 240 Q100 250 146 240 L147 266 Q100 274 53 266 Z' fill='{sash}'/><path d='M60 248 Q100 256 140 248' stroke='{sashDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M54 248 Q100 258 146 248 L146 260 Q100 270 54 260 Z' fill='{belt}'/><rect x='102' y='249' width='18' height='17' rx='3' fill='{buckle}'/><rect x='107' y='253' width='8' height='9' rx='1.5' fill='{belt}'/><path d='M60 262 C54 272 52 286 56 300 L64 298 C62 286 64 274 68 266 Z' fill='{sash}'/><path d='M66 264 C66 278 70 290 76 302 L82 298 C76 288 74 276 74 266 Z' fill='{sashDark}'/><circle cx='66' cy='264' r='6' fill='{sash}'/><path d='M50 306 Q72 312 93 308 M107 308 Q130 312 150 306' stroke='{trim}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M140 270 L146 310' stroke='{coatDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M66 228 Q72 224 80 228 Q72 220 66 228 Z' fill='{coatDark}'/>`,
      back: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M72 160 Q100 152 128 160 Q142 164 144 180 L146 250 L152 312 Q130 318 106 314 L100 270 L94 314 Q70 318 48 312 L54 250 L56 180 Q58 164 72 160 Z' fill='{coat}'/><path d='M94 270 L106 270 L109 314 L91 314 Z' fill='{coatDark}'/><path d='M82 156 Q100 150 118 156 L120 168 Q100 162 80 168 Z' fill='{facing}'/><path d='M100 170 L100 240' stroke='{coatDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M54 240 Q100 250 146 240 L147 266 Q100 274 53 266 Z' fill='{sash}'/><path d='M54 248 Q100 258 146 248 L146 260 Q100 270 54 260 Z' fill='{belt}'/><path d='M60 262 C54 272 52 286 56 300 L64 298 C62 286 64 274 68 266 Z' fill='{sash}'/><circle cx='64' cy='262' r='6' fill='{sash}'/><circle cx='94' cy='276' r='2.8' fill='{trim}'/><circle cx='106' cy='276' r='2.8' fill='{trim}'/><path d='M50 306 Q72 312 93 308 M107 308 Q130 312 150 306' stroke='{trim}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    head: {
      default: `<path d='M58 74 C46 88 44 112 50 132 C54 146 60 156 66 164 C72 158 72 148 68 138 L66 92 Z' fill='{beard}'/><path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><ellipse cx='60' cy='104' rx='11' ry='14' fill='{skin}'/><path d='M63 97 Q56 102 60 110' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='54' cy='114' r='3' fill='{gold}'/><path d='M63 80 L75 80 C72 98 70 114 74 124 C80 128 90 128 102 128 C114 128 126 128 134 124 C138 116 140 106 142 96 C150 104 154 120 148 136 C144 152 134 164 120 172 C114 178 106 182 100 180 C92 182 84 178 78 172 C66 164 58 150 58 132 C58 110 60 94 63 80 Z' fill='{beard}'/><path d='M76 150 Q80 160 86 166 M100 156 L100 172 M118 152 Q116 162 112 168 M132 140 Q130 150 124 158' stroke='{beardLight}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M62 62 C60 34 78 18 102 18 C126 18 142 34 140 62 Z' fill='{hat}'/><path d='M22 48 C42 56 62 62 80 62 C94 58 104 56 114 60 C124 56 146 48 180 42 C176 62 156 76 134 78 L114 86 L94 80 C66 80 34 70 22 48 Z' fill='{hat}'/><path d='M22 48 C42 56 62 62 80 62 C94 58 104 56 114 60 C124 56 146 48 180 42' stroke='{trim}' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M34 62 C52 72 76 76 96 74 M134 72 C150 68 164 60 172 52' stroke='{hatLight}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M94 34 L114 48 M114 34 L94 48' stroke='{bone}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='104' cy='37' r='6' fill='{bone}'/><circle cx='102' cy='36.5' r='1.5' fill='{hat}'/><circle cx='106' cy='36.5' r='1.5' fill='{hat}'/>`,
      back: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><ellipse cx='56' cy='106' rx='10' ry='14' fill='{skin}'/><ellipse cx='144' cy='106' rx='10' ry='14' fill='{skin}'/><path d='M54 120 C56 140 62 150 70 156 L74 140 Z M146 120 C144 140 138 150 130 156 L126 140 Z' fill='{beard}'/><path d='M60 66 C52 84 54 112 64 130 C76 144 90 148 100 148 C110 148 124 144 136 130 C146 112 148 84 140 66 Z' fill='{beard}'/><path d='M92 140 Q100 150 96 176 L104 176 Q100 150 108 140 Z' fill='{beard}'/><path d='M92 144 L108 144 L108 154 L92 154 Z' fill='{ribbon}'/><path d='M80 96 Q82 116 88 130 M100 96 L100 132 M120 96 Q118 116 112 130' stroke='{beardLight}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M62 62 C60 34 78 18 100 18 C122 18 140 34 138 62 Z' fill='{hat}'/><path d='M22 46 C44 56 70 62 100 62 C130 62 156 56 178 46 C172 66 150 78 120 80 L100 86 L80 80 C50 78 28 66 22 46 Z' fill='{hat}'/><path d='M22 46 C44 56 70 62 100 62 C130 62 156 56 178 46' stroke='{trim}' stroke-width='4' fill='none' stroke-linecap='round'/>`,
    },
    face: `<circle cx='78' cy='117' r='6' fill='{cheek}' opacity='0.35'/><path d='M100 103 C101 107 103 110 107 111 C115 111 117 120 109 122 C103 123 97 121 97 116 C97 111 99 108 100 103 Z' fill='{skin}'/><path d='M100 104 C101 107 103 110 107 111 C115 111 117 120 109 122 C104 123 99 121 98 118' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    eyes: {
      open: `<ellipse cx='84' cy='100' rx='8' ry='10' fill='#fff'/><circle cx='86' cy='101.5' r='5.5' fill='{line}'/><circle cx='88' cy='99' r='2' fill='#fff'/>${PATCH}${BROWS('M74 87 Q83 81 93 85', 'M106 85 Q117 80 128 86')}`,
      closed: `<path d='M76 102 Q84 108 92 102' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>${PATCH}${BROWS('M74 88 Q83 83 93 87', 'M106 86 Q117 82 128 87')}`,
      happy: `<path d='M76 104 Q84 94 92 104' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>${PATCH}${BROWS('M74 85 Q83 78 93 82', 'M106 82 Q117 77 128 84')}`,
      wide: `<ellipse cx='84' cy='99' rx='10' ry='12.5' fill='#fff'/><circle cx='85' cy='100' r='4' fill='{line}'/><circle cx='87' cy='97.5' r='1.6' fill='#fff'/>${PATCH}${BROWS('M74 82 Q83 76 93 80', 'M106 80 Q117 75 128 81')}`,
      sad: `<ellipse cx='84' cy='101' rx='8' ry='9' fill='#fff'/><circle cx='85' cy='104' r='5.5' fill='{line}'/><circle cx='87' cy='101.5' r='1.8' fill='#fff'/>${PATCH}${BROWS('M74 90 Q84 88 93 83', 'M106 83 Q117 87 128 89')}`,
      angry: `<path d='M75 95 L93 100 C94 107 90 111 84 111 C78 111 75 106 75 95 Z' fill='#fff'/><circle cx='86' cy='104' r='5' fill='{line}'/><circle cx='88' cy='102' r='1.6' fill='#fff'/>${PATCH}${BROWS('M73 85 L94 93', 'M128 84 L106 92')}`,
    },
    mouth: {
      closed: `<path d='M92 145 Q102 149 112 144' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>${MOUSTACHE}`,
      smile: `<path d='M88 139 Q102 161 116 139 Q102 145 88 139 Z' fill='{mouth}'/><path d='M91 141 Q102 146 113 141 L112 145 Q102 149 92 145 Z' fill='{teeth}'/><rect x='105' y='142' width='5' height='5' rx='1' fill='{gold}'/>${MOUSTACHE}`,
      open: `<ellipse cx='102' cy='146' rx='10' ry='11' fill='{mouth}'/><ellipse cx='102' cy='151' rx='5.5' ry='4' fill='{tongue}'/><rect x='104' y='137' width='5' height='5' rx='1' fill='{gold}'/>${MOUSTACHE}`,
      sad: `<path d='M92 150 Q102 143 112 150' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>${MOUSTACHE}`,
      angry: `<path d='M90 143 L114 143 L112 151 L92 151 Z' fill='{mouth}'/><path d='M91 144 L113 144 L112.5 147 L91.5 147 Z' fill='{teeth}'/><rect x='104' y='144' width='4.5' height='3' fill='{gold}'/>${MOUSTACHE}`,
      scared: `<path d='M90 148 Q96 142 102 148 Q108 154 114 148' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>${MOUSTACHE}`,
    },
    armR: `<path d='M129.4 266 L130 283' stroke='{skin}' stroke-width='14' stroke-linecap='round' fill='none'/><path d='M119 279 C117 290 122 299 130 299 C139 299 142 291 141 280 C139 272 121 271 119 279 Z' fill='{skin}'/><path d='M130 278 C140 270 147 275 146 282 C145 287 140 292 130 290 Z' fill='{skin}'/><path d='M124 178 L127 232' stroke='{coat}' stroke-width='24' stroke-linecap='round' fill='none'/><path d='M126 210 L128.8 258' stroke='{coat}' stroke-width='24' stroke-linecap='butt' fill='none'/><path d='M112 248 L144 246 L144 270 L114 272 Z' fill='{facing}'/><path d='M112.5 249 L143.5 247' stroke='{trim}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M116 260 L140 259' stroke='{facingDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/><circle cx='124' cy='173' r='15' fill='{coat}'/><path d='M122 289 Q126.9 294.7 132 290 Q127.1 292.3 122 289 Z' fill='{line}'/>`,
  },
};
