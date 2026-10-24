import type { CharacterInput } from '../engine/types.js';

/**
 * A village farmer in a pagdi, kurta and dhoti. Same box and pivots as `grownup`. A saffron
 * pagdi wound up into a mound that sits high on the head and swells out behind the skull,
 * its wraps crossing in stacked chevrons above the forehead, a pleated turra on top toward
 * the back and a short tail end hanging behind the ear (a part of its own, hung from the
 * head with `hangs`, so it swings; from behind it hangs at the middle of the back); an ear
 * under it on the far side, a rounded nose and a thick moustache that curls up at the tips
 * (drawn in every `mouth`, so it stays over the lips as they move); a neck in a band
 * collar, a kurta with a short buttoned placket, rolled sleeves above the elbow and side
 * slits, hanging to mid-thigh so the knees stay free; a checked gamchha round the neck
 * whose end hangs down the chest (hung from the torso, so it swings as he walks); mitten
 * hands with the thumb forward and a line where the fingers curl; a loose dhoti on each leg
 * to mid-calf with folds down the front, one behind the knee and a red border at the hem,
 * bare calves, and leather chappals with a strap over the foot. Limbs are round-capped
 * strokes from the pivots, the neck reaches 30 units into the head and the kurta hangs 30
 * below the hips.
 */
export const FARMER: CharacterInput = {
  id: 'farmer',
  name: 'Farmer',
  description:
    'Village farmer in a pagdi, kurta, dhoti and chappals, a gamchha round his neck; recolour via colors.',
  rig: 'humanoid',
  height: 295,
  hem: 306, // his kurta ends here: what `sit` rests on the seat
  colors: {
    skin: '#a8693f',
    skinDark: '#86502c',
    hair: '#1f1815',
    pagdi: '#ef9a1f',
    pagdiLight: '#f8c25a',
    pagdiDark: '#c46f10',
    kurta: '#f4eee0',
    kurtaDark: '#d3c8b0',
    button: '#9c8c6c',
    gamchha: '#c8463c',
    gamchhaDark: '#9a2f28',
    gamchhaLight: '#f3dcb4',
    dhoti: '#fbf8f0',
    dhotiDark: '#d8d0bd',
    border: '#b8452f',
    chappal: '#7a4a28',
    chappalDark: '#4e2e18',
    cheek: '#d9625a',
    mouth: '#6e2430',
    tongue: '#d8686c',
    line: '#2e2633',
  },
  hangs: {
    pagdiTail: { from: 'head', at: [48, 88] },
    gamchha: { from: 'torso', at: [100, 160], front: true },
  },
  springs: ['pagdiTail', 'gamchha'],
  parts: {
    pagdiTail: {
      default: `<path d='M38 70 L56 74 L54 126 Q48 131 42 126 Z' fill='{pagdiDark}'/><path d='M41 114 L55 114 L54 128 Q48 133 42 128 Z' fill='{pagdi}'/>`,
      back: `<path d='M46 84 L56 84 L56 96 L46 96 Z' fill='{pagdiDark}'/>`,
    },
    gamchha: {
      default: `<path d='M90 154 Q100 150 112 154 L114 236 L92 236 Z' fill='{gamchha}'/><path d='M91 172 L113 172 M91 196 L114 196 M92 220 L114 220' stroke='{gamchhaLight}' stroke-width='3' fill='none'/><path d='M97 156 L97 236 M107 156 L108 236' stroke='{gamchhaDark}' stroke-width='3' fill='none'/><path d='M92 236 L92 244 M96 236 L96 245 M100 236 L100 244 M104 236 L104 245 M108 236 L108 244 M112 236 L112 245' stroke='{gamchha}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      back: `<path d='M64 168 Q100 150 136 168 L134 182 Q100 166 66 182 Z' fill='{gamchha}'/><path d='M82 164 L82 174 M100 158 L100 168 M118 164 L118 174' stroke='{gamchhaDark}' stroke-width='3' fill='none'/><path d='M68 172 Q100 158 132 172' stroke='{gamchhaLight}' stroke-width='2.5' fill='none'/>`,
    },
    armL: `<path d='M76 178 L70 288' stroke='{skin}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M59 284 C57 295 62 304 70 304 C79 304 82 296 81 285 C79 277 61 276 59 284 Z' fill='{skin}'/><path d='M70 283 C80 275 87 280 86 287 C85 292 80 297 70 295 Z' fill='{skin}'/><circle cx='76' cy='173' r='15' fill='{kurta}'/><path d='M61 174 L60.78 208 L86.78 208 L91 174 Z' fill='{kurta}'/><path d='M59.78 203 Q73.78 200 87.78 203 L87.78 213 Q73.78 216 59.78 213 Z' fill='{kurta}'/><path d='M60.5 205 Q73.78 202 87 205' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M62 293 Q66.9 298.7 72 294 Q67.1 296.3 62 293 Z' fill='{line}'/>`,
    legL: `<path d='M86 350 L85 384' stroke='{skin}' stroke-width='15' stroke-linecap='round' fill='none'/><path d='M73 393 C72 386 77 381 86 381 C94 381 99 384 104 387 C111 388 115 391 115 395 L73 395 Z' fill='{skin}'/><path d='M70 393 L117 393 Q118 400 112 400 L74 400 Q70 400 70 393 Z' fill='{chappal}'/><path d='M84 384 Q94 383 101 391' stroke='{chappalDark}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M86 274 L85 330' stroke='{dhoti}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M70 300 L101 300 L104 362 Q86 368 67 362 Z' fill='{dhoti}'/><path d='M78 300 Q80 330 77 361' stroke='{dhotiDark}' stroke-width='2' fill='none' stroke-linecap='round'/><path d='M92 292 Q96 328 93 360' stroke='{dhotiDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M72.5 324 Q78.6 328.6 83.5 323 Q78.4 325.4 72.5 324 Z' fill='{dhotiDark}'/><path d='M68.5 356 Q86 362 103.5 356 L104 362 Q86 368 67 362 Z' fill='{border}'/>`,
    legR: `<path d='M114 350 L115 384' stroke='{skin}' stroke-width='15' stroke-linecap='round' fill='none'/><path d='M103 393 C102 386 107 381 116 381 C124 381 129 384 134 387 C141 388 145 391 145 395 L103 395 Z' fill='{skin}'/><path d='M100 393 L147 393 Q148 400 142 400 L104 400 Q100 400 100 393 Z' fill='{chappal}'/><path d='M114 384 Q124 383 131 391' stroke='{chappalDark}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M114 274 L115 330' stroke='{dhoti}' stroke-width='30' stroke-linecap='round' fill='none'/><path d='M99 300 L130 300 L133 362 Q114 368 96 362 Z' fill='{dhoti}'/><path d='M107 300 Q109 330 106 361' stroke='{dhotiDark}' stroke-width='2' fill='none' stroke-linecap='round'/><path d='M121 292 Q125 328 122 360' stroke='{dhotiDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M101.5 324 Q107.6 328.6 112.5 323 Q107.4 325.4 101.5 324 Z' fill='{dhotiDark}'/><path d='M96.5 356 Q115 362 132.5 356 L133 362 Q114 368 96 362 Z' fill='{border}'/>`,
    torso: {
      default: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M74 160 Q100 152 126 160 Q140 164 142 180 L140 250 L146 300 Q123 308 100 306 Q77 308 54 300 L60 250 L58 180 Q60 164 74 160 Z' fill='{kurta}'/><path d='M86 156 Q100 162 114 156 L115 165 Q100 171 85 165 Z' fill='{kurtaDark}'/><path d='M118 166 L118 212' stroke='{kurtaDark}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='122' cy='178' r='2.4' fill='{button}'/><circle cx='122' cy='192' r='2.4' fill='{button}'/><circle cx='122' cy='206' r='2.4' fill='{button}'/><path d='M60 270 L57 300' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M140 270 L143 300' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M66 246 Q73.9 241.8 83 247 Q74.1 238.2 66 246 Z' fill='{kurtaDark}'/><path d='M120 247 Q128.1 241.8 137 246 Q127.9 238.2 120 247 Z' fill='{kurtaDark}'/><path d='M80 280 Q84 292 82 304' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      back: `<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/><path d='M74 160 Q100 152 126 160 Q140 164 142 180 L140 250 L146 300 Q123 308 100 306 Q77 308 54 300 L60 250 L58 180 Q60 164 74 160 Z' fill='{kurta}'/><path d='M86 156 Q100 162 114 156 L115 165 Q100 171 85 165 Z' fill='{kurtaDark}'/><path d='M100 190 L100 290' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M60 270 L57 300' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M140 270 L143 300' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M66 246 Q73.9 241.8 83 247 Q74.1 238.2 66 246 Z' fill='{kurtaDark}'/><path d='M120 247 Q128.1 241.8 137 246 Q127.9 238.2 120 247 Z' fill='{kurtaDark}'/>`,
    },
    head: {
      default: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><ellipse cx='58' cy='106' rx='11' ry='14' fill='{skin}'/><path d='M61 99 Q54 104 58 112' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M62 26 C54 16 52 6 58 2 C64 6 66 12 70 4 C76 8 78 16 80 22 Z' fill='{pagdiLight}'/><path d='M62 22 L59 6 M70 20 L70 6' stroke='{pagdiDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M42 94 C26 72 26 40 44 24 C60 10 88 4 114 6 C142 8 164 28 166 58 C167 70 165 80 162 86 C148 80 132 78 118 80 C110 76 102 76 96 80 C80 78 58 84 42 94 Z' fill='{pagdi}'/><path d='M34 44 Q76 50 112 62' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M96 64 Q130 42 162 44' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M46 24 Q80 28 108 42' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M94 44 Q122 22 150 20' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M56 30 Q80 14 108 12 Q82 22 64 40 Z' fill='{pagdiLight}'/>`,
      back: `<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/><ellipse cx='56' cy='106' rx='10' ry='14' fill='{skin}'/><ellipse cx='144' cy='106' rx='10' ry='14' fill='{skin}'/><path d='M93 84 L107 84 L106 120 Q100 124 94 120 Z' fill='{pagdiDark}'/><path d='M93 110 L107 110 L106 122 Q100 126 94 122 Z' fill='{pagdi}'/><path d='M84 26 C78 16 80 6 88 2 C94 6 96 12 100 4 C106 8 108 16 110 26 Z' fill='{pagdiLight}'/><path d='M88 22 L87 6 M100 22 L100 6' stroke='{pagdiDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M38 96 C24 70 30 34 54 18 C72 6 128 6 146 18 C170 34 176 70 162 96 C142 88 122 86 100 86 C78 86 58 88 38 96 Z' fill='{pagdi}'/><path d='M36 72 Q100 54 164 72' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M36 50 Q100 32 164 50' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M52 26 Q100 12 148 26' stroke='{pagdiDark}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M60 28 Q84 14 112 14 Q86 22 68 38 Z' fill='{pagdiLight}'/>`,
    },
    face: `<path d='M103 104 Q115 113 104 119' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M98 118 Q100 120 103 119' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/><circle cx='76' cy='121' r='7' fill='{cheek}' opacity='0.3'/><circle cx='128' cy='121' r='7' fill='{cheek}' opacity='0.3'/>`,
    eyes: {
      open: `<ellipse cx='84' cy='100' rx='8' ry='10' fill='#fff'/><circle cx='86' cy='101.5' r='5.5' fill='{line}'/><circle cx='88' cy='99.0' r='2' fill='#fff'/><ellipse cx='116' cy='100' rx='8' ry='10' fill='#fff'/><circle cx='118' cy='101.5' r='5.5' fill='{line}'/><circle cx='120' cy='99.0' r='2' fill='#fff'/><path d='M74 87 Q83 81 93 85' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/><path d='M107 85 Q117 81 126 87' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/>`,
      closed: `<path d='M76 102 Q84 108 92 102' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M108 102 Q116 108 124 102' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M74 87 Q83 81 93 85' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/><path d='M107 85 Q117 81 126 87' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/>`,
      happy: `<path d='M76 104 Q84 94 92 104' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M108 104 Q116 94 124 104' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M74 86 Q83 79 93 83' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/><path d='M107 83 Q117 79 126 86' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='84' cy='99' rx='10' ry='12.5' fill='#fff'/><circle cx='85' cy='100' r='4' fill='{line}'/><circle cx='87' cy='97.5' r='1.6' fill='#fff'/><ellipse cx='116' cy='99' rx='10' ry='12.5' fill='#fff'/><circle cx='117' cy='100' r='4' fill='{line}'/><circle cx='119' cy='97.5' r='1.6' fill='#fff'/><path d='M74 84 Q83 78 93 81' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/><path d='M107 81 Q117 78 126 84' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='84' cy='101' rx='8' ry='9' fill='#fff'/><circle cx='85' cy='104' r='5.5' fill='{line}'/><circle cx='87' cy='101.5' r='1.8' fill='#fff'/><ellipse cx='116' cy='101' rx='8' ry='9' fill='#fff'/><circle cx='117' cy='104' r='5.5' fill='{line}'/><circle cx='119' cy='101.5' r='1.8' fill='#fff'/><path d='M74 91 Q84 89 93 84' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/><path d='M107 84 Q116 89 126 91' stroke='{hair}' stroke-width='6.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M75 95 L93 100 C94 107 90 111 84 111 C78 111 75 106 75 95 Z' fill='#fff'/><path d='M125 95 L107 100 C106 107 110 111 116 111 C122 111 125 106 125 95 Z' fill='#fff'/><circle cx='86' cy='104' r='5' fill='{line}'/><circle cx='118' cy='104' r='5' fill='{line}'/><circle cx='88' cy='102' r='1.6' fill='#fff'/><circle cx='120' cy='102' r='1.6' fill='#fff'/><path d='M73 86 L94 94' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/><path d='M127 86 L106 94' stroke='{hair}' stroke-width='7' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M93 134 Q102 138 111 133' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M80 118 C84 124 92 121 98 118 C100 117 104 117 106 118 C112 121 120 124 124 118 C127 122 126 130 118 130 C112 130 106 127 102 125 C98 127 92 130 86 130 C78 130 77 122 80 118 Z' fill='{hair}'/>`,
      smile: `<path d='M89 130 Q102 150 115 130 Q102 135 89 130 Z' fill='{mouth}'/><path d='M96 140 Q102 136 108 140 Q102 144 96 140 Z' fill='{tongue}'/><path d='M80 118 C84 124 92 121 98 118 C100 117 104 117 106 118 C112 121 120 124 124 118 C127 122 126 130 118 130 C112 130 106 127 102 125 C98 127 92 130 86 130 C78 130 77 122 80 118 Z' fill='{hair}'/>`,
      open: `<ellipse cx='102' cy='136' rx='9' ry='10' fill='{mouth}'/><ellipse cx='102' cy='141' rx='5' ry='3.5' fill='{tongue}'/><path d='M80 118 C84 124 92 121 98 118 C100 117 104 117 106 118 C112 121 120 124 124 118 C127 122 126 130 118 130 C112 130 106 127 102 125 C98 127 92 130 86 130 C78 130 77 122 80 118 Z' fill='{hair}'/>`,
      sad: `<path d='M93 139 Q102 132 111 139' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M80 122 C84 126 92 122 98 119 C100 118 104 118 106 119 C112 122 120 126 124 122 C126 127 124 132 118 132 C112 132 106 128 102 126 C98 128 92 132 86 132 C80 132 78 127 80 122 Z' fill='{hair}'/>`,
      angry: `<path d='M92 137 Q102 133 112 137' stroke='{line}' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M80 122 C84 126 92 122 98 119 C100 118 104 118 106 119 C112 122 120 126 124 122 C126 127 124 132 118 132 C112 132 106 128 102 126 C98 128 92 132 86 132 C80 132 78 127 80 122 Z' fill='{hair}'/>`,
      scared: `<path d='M90 138 Q96 132 102 138 Q108 144 114 138' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M80 120 C84 125 92 122 98 118 C100 117 104 117 106 118 C112 122 120 125 124 120 C126 125 125 131 118 131 C112 131 106 128 102 126 C98 128 92 131 86 131 C79 131 78 125 80 120 Z' fill='{hair}'/>`,
    },
    armR: `<path d='M124 178 L130 283' stroke='{skin}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M119 279 C117 290 122 299 130 299 C139 299 142 291 141 280 C139 272 121 271 119 279 Z' fill='{skin}'/><path d='M130 278 C140 270 147 275 146 282 C145 287 140 292 130 290 Z' fill='{skin}'/><circle cx='124' cy='173' r='15' fill='{kurta}'/><path d='M109 174 L113.22 208 L139.22 208 L139 174 Z' fill='{kurta}'/><path d='M112.22 203 Q126.22 200 140.22 203 L140.22 213 Q126.22 216 112.22 213 Z' fill='{kurta}'/><path d='M113 205 Q126.22 202 139.5 205' stroke='{kurtaDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M122 289 Q126.9 294.7 132 290 Q127.1 292.3 122 289 Z' fill='{line}'/>`,
  },
};
