import type { CharacterInput } from '../engine/types.js';

/**
 * A little boy in a striped T-shirt and shorts: the kid's box, pivots, proportions and big eyes,
 * with a boy's silhouette. Short tousled hair with a spiky fringe and two tufts swept up on the
 * crown, drawn three-quarters with the ear on the far side showing below it. A neck in a ribbed
 * crew collar, a T-shirt with three stripes worn loose over the shorts; short sleeves round the
 * shoulder pivot with a stripe and a hemmed cuff; mitten hands with the thumb forward and a line
 * where the fingers curl. Shorts to just above the knee, so the knee bends bare; striped socks and
 * sneakers with a thick pale sole and laces. Limbs are round-capped strokes from their pivots, the
 * neck reaches 30 units into the head and the shorts start 36 above the hips, so nothing opens up
 * in motion.
 */
export const BOY: CharacterInput = {
  id: 'boy',
  name: 'Boy',
  description: 'Boy with short tousled hair, striped T-shirt and shorts; recolour via colors.',
  rig: 'humanoid',
  height: 215,
  colors: {
    skin: '#dca57c',
    skinDark: '#b98059',
    hair: '#2b2422',
    hairLight: '#4a3d38',
    hairDark: '#1a1513',
    shirt: '#4d96d9',
    shirtDark: '#346fa8',
    stripe: '#eaf4fb',
    shorts: '#c8a26b',
    shortsDark: '#a07f4f',
    socks: '#ffffff',
    sockStripe: '#e63946',
    shoes: '#e63946',
    sole: '#f4f1ea',
    cheek: '#f28b82',
    mouth: '#8c2f39',
    tongue: '#f08080',
    line: '#2e2633',
  },
  parts: {
    armL: `<path d='M76 178 L71 274' stroke='{skin}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M61 278 C59 288 63 297 71 297 C79 297 82 290 81 280 C79 272 63 271 61 278 Z' fill='{skin}'/><path d='M77 277 C82 272 87 275 86 281 C85 286 81 289 77 288 Z' fill='{skin}'/><circle cx='76' cy='173' r='15' fill='{shirt}'/><path d='M61 174 L61 204 L91 204 L91 174 Z' fill='{shirt}'/><path d='M61 184 L91 184 L91 191 L61 191 Z' fill='{stripe}'/><path d='M60.5 199 Q76 202 91.5 199 L91.5 207 Q76 210 60.5 207 Z' fill='{shirtDark}'/><path d='M64 287 Q68.9 292.7 74 288 Q69.1 290.3 64 287 Z' fill='{line}'/>`,
    legL: `<path d='M86 274 L85 384' stroke='{skin}' stroke-width='17' stroke-linecap='round' fill='none'/><path d='M85 358 L85 386' stroke='{socks}' stroke-width='17' stroke-linecap='butt' fill='none'/><rect x='75' y='352' width='20' height='9' rx='4' fill='{socks}'/><path d='M76 357 L94 357' stroke='{sockStripe}' stroke-width='2.5' fill='none'/><path d='M77 364 L93 364' stroke='{sockStripe}' stroke-width='2.5' fill='none'/><path d='M72 392 C71 382 77 376 87 376 C96 376 101 380 106 383 C114 385 118 389 118 395 L72 395 Z' fill='{shoes}'/><path d='M70 391 L119 391 Q121 400 114 400 L75 400 Q70 400 70 391 Z' fill='{sole}'/><path d='M89 380 L94 386' stroke='{sole}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M95 380 L100 386' stroke='{sole}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M71 276 L101 276 L103 318 Q86 322 69 318 Z' fill='{shorts}'/><path d='M69.6 311 Q86 315 102.4 311' stroke='{shortsDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    legR: `<path d='M114 274 L115 384' stroke='{skin}' stroke-width='17' stroke-linecap='round' fill='none'/><path d='M115 358 L115 386' stroke='{socks}' stroke-width='17' stroke-linecap='butt' fill='none'/><rect x='105' y='352' width='20' height='9' rx='4' fill='{socks}'/><path d='M106 357 L124 357' stroke='{sockStripe}' stroke-width='2.5' fill='none'/><path d='M107 364 L123 364' stroke='{sockStripe}' stroke-width='2.5' fill='none'/><path d='M102 392 C101 382 107 376 117 376 C126 376 131 380 136 383 C144 385 148 389 148 395 L102 395 Z' fill='{shoes}'/><path d='M100 391 L149 391 Q151 400 144 400 L105 400 Q100 400 100 391 Z' fill='{sole}'/><path d='M119 380 L124 386' stroke='{sole}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M125 380 L130 386' stroke='{sole}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M99 276 L129 276 L131 318 Q114 322 97 318 Z' fill='{shorts}'/><path d='M97.6 311 Q114 315 130.4 311' stroke='{shortsDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    torso: {
      default: `<rect x='90' y='122' width='20' height='50' rx='9' fill='{skin}'/><path d='M63 238 L137 238 L139 286 Q120 296 100 292 Q80 296 61 286 Z' fill='{shorts}'/><path d='M100 264 L100 288' stroke='{shortsDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M78 160 Q100 153 122 160 Q134 163 137 176 L140 254 Q100 262 60 254 L63 176 Q66 163 78 160 Z' fill='{shirt}'/><path d='M62.2 196 L137.8 196 L138.2 206 L61.8 206 Z' fill='{stripe}'/><path d='M61.3 220 L138.7 220 L139.1 230 L60.9 230 Z' fill='{stripe}'/><path d='M60.5 240 L139.5 240 L139.8 249 L60.2 249 Z' fill='{stripe}'/><path d='M88 157 Q100 170 112 157 Z' fill='{skin}'/><path d='M84 156 Q100 176 116 156 L120 160 Q100 184 80 160 Z' fill='{shirtDark}'/>`,
      back: `<rect x='90' y='122' width='20' height='50' rx='9' fill='{skin}'/><path d='M63 238 L137 238 L139 286 Q120 296 100 292 Q80 296 61 286 Z' fill='{shorts}'/><path d='M100 266 L100 290' stroke='{shortsDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M78 160 Q100 153 122 160 Q134 163 137 176 L140 254 Q100 262 60 254 L63 176 Q66 163 78 160 Z' fill='{shirt}'/><path d='M62.2 196 L137.8 196 L138.2 206 L61.8 206 Z' fill='{stripe}'/><path d='M61.3 220 L138.7 220 L139.1 230 L60.9 230 Z' fill='{stripe}'/><path d='M60.5 240 L139.5 240 L139.8 249 L60.2 249 Z' fill='{stripe}'/><path d='M84 157 Q100 163 116 157 L117 163 Q100 170 83 163 Z' fill='{shirtDark}'/>`,
    },
    head: {
      default: `<circle cx='100' cy='90' r='60' fill='{skin}'/><path d='M42 112 C34 84 40 52 62 36 C84 20 122 20 144 34 C158 44 164 60 162 80 C158 74 154 70 150 66 L147 80 L139 64 L130 78 L121 62 L112 76 L102 60 L93 74 L85 62 L78 78 C74 88 72 100 72 110 Q70 114 66 112 L62 98 C56 94 48 98 42 112 Z' fill='{hair}'/><path d='M72 40 C66 26 74 14 90 12 C84 20 84 28 90 36 Z' fill='{hair}'/><path d='M100 34 C100 20 110 10 126 12 C118 18 116 26 118 36 Z' fill='{hair}'/><path d='M54 62 C60 46 74 36 90 32 C80 42 70 52 62 66 Z' fill='{hairLight}'/><ellipse cx='46' cy='106' rx='10' ry='13' fill='{skin}'/><path d='M49 99 Q42 105 46 113' stroke='{skinDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      back: `<circle cx='100' cy='90' r='60' fill='{skin}'/><ellipse cx='42' cy='104' rx='9' ry='13' fill='{skin}'/><ellipse cx='158' cy='104' rx='9' ry='13' fill='{skin}'/><path d='M44 112 C34 80 46 42 74 30 C90 22 110 22 126 30 C154 42 166 80 156 112 C150 126 138 134 124 136 Q100 140 76 136 C62 134 50 126 44 112 Z' fill='{hair}'/><path d='M76 40 C70 26 78 14 94 12 C88 20 88 28 94 36 Z' fill='{hair}'/><path d='M104 34 C104 20 114 10 130 12 C122 18 120 26 122 36 Z' fill='{hair}'/><path d='M100 56 Q112 58 109 68 Q102 75 95 67' stroke='{hairDark}' stroke-width='3' fill='none' stroke-linecap='round'/><path d='M54 66 C58 50 70 40 84 34 C74 46 64 58 60 72 Z' fill='{hairLight}'/><path d='M146 66 C142 50 130 40 116 34 C126 46 136 58 140 72 Z' fill='{hairLight}'/>`,
    },
    face: `<circle cx='70' cy='116' r='9' fill='{cheek}' opacity='0.35'/><circle cx='132' cy='116' r='9' fill='{cheek}' opacity='0.35'/><path d='M103 101 Q109 107 102 110' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    eyes: {
      open: `<ellipse cx='83' cy='95' rx='10.5' ry='13' fill='#fff'/><circle cx='85.5' cy='97.5' r='7.5' fill='{line}'/><circle cx='88.3' cy='94.0' r='2.6' fill='#fff'/><ellipse cx='117' cy='95' rx='10.5' ry='13' fill='#fff'/><circle cx='119.5' cy='97.5' r='7.5' fill='{line}'/><circle cx='122.3' cy='94.0' r='2.6' fill='#fff'/><path d='M72 77 Q82 73 93 76' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M107 76 Q118 73 128 77' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
      closed: `<path d='M72 96 Q83 104 94 96' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M106 96 Q117 104 128 96' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M72 77 Q82 73 93 76' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M107 76 Q118 73 128 77' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
      happy: `<path d='M72 100 Q83 87 94 100' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M106 100 Q117 87 128 100' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M72 75 Q82 70 93 73' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M107 73 Q118 70 128 75' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='83' cy='94' rx='12' ry='15.5' fill='#fff'/><circle cx='84' cy='95' r='5' fill='{line}'/><circle cx='86.8' cy='91.5' r='2' fill='#fff'/><ellipse cx='117' cy='94' rx='12' ry='15.5' fill='#fff'/><circle cx='118' cy='95' r='5' fill='{line}'/><circle cx='120.8' cy='91.5' r='2' fill='#fff'/><path d='M71 73 Q82 68 93 71' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M107 71 Q118 68 129 73' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
      sad: `<ellipse cx='83' cy='96' rx='10.5' ry='12' fill='#fff'/><circle cx='84.5' cy='100.5' r='7' fill='{line}'/><circle cx='87.3' cy='97.0' r='2.4' fill='#fff'/><ellipse cx='117' cy='96' rx='10.5' ry='12' fill='#fff'/><circle cx='118.5' cy='100.5' r='7' fill='{line}'/><circle cx='121.3' cy='97.0' r='2.4' fill='#fff'/><path d='M72 82 Q82 80 92 73' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M108 73 Q118 80 128 82' stroke='{hair}' stroke-width='5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M71 88 L94 95 C95 104 90 109 83 109 C75 109 71 102 71 88 Z' fill='#fff'/><path d='M129 88 L106 95 C105 104 110 109 117 109 C125 109 129 102 129 88 Z' fill='#fff'/><circle cx='85' cy='101' r='6' fill='{line}'/><circle cx='119' cy='101' r='6' fill='{line}'/><circle cx='87.5' cy='98.5' r='2' fill='#fff'/><circle cx='121.5' cy='98.5' r='2' fill='#fff'/><path d='M70 79 L94 88' stroke='{hair}' stroke-width='5.5' fill='none' stroke-linecap='round'/><path d='M130 79 L106 88' stroke='{hair}' stroke-width='5.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M93 124 Q102 131 111 124' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      smile: `<path d='M86 119 Q102 145 118 119 Q102 126 86 119 Z' fill='{mouth}'/><path d='M95 132 Q102 127 109 132 Q102 137 95 132 Z' fill='{tongue}'/>`,
      open: `<ellipse cx='102' cy='127' rx='10' ry='12' fill='{mouth}'/><ellipse cx='102' cy='133' rx='6' ry='4' fill='{tongue}'/>`,
      sad: `<path d='M92 131 Q102 121 112 131' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M91 129 Q102 122 113 129' stroke='{line}' stroke-width='4' fill='none' stroke-linecap='round'/>`,
      scared: `<path d='M89 128 Q95 121 101 128 Q107 135 113 128' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    armR: `<path d='M124 178 L129 274' stroke='{skin}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M119 278 C117 288 121 297 129 297 C137 297 140 290 139 280 C137 272 121 271 119 278 Z' fill='{skin}'/><path d='M132 277 C137 272 142 275 141 281 C140 286 136 289 132 288 Z' fill='{skin}'/><circle cx='124' cy='173' r='15' fill='{shirt}'/><path d='M109 174 L109 204 L139 204 L139 174 Z' fill='{shirt}'/><path d='M109 184 L139 184 L139 191 L109 191 Z' fill='{stripe}'/><path d='M108.5 199 Q124 202 139.5 199 L139.5 207 Q124 210 108.5 207 Z' fill='{shirtDark}'/><path d='M122 287 Q126.9 292.7 132 288 Q127.1 290.3 122 287 Z' fill='{line}'/>`,
  },
};
