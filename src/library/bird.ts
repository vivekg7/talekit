import type { CharacterInput } from '../engine/types.js';

/**
 * A plump little songbird on the `simple` rig: the worked example for anything that bobs,
 * hops or flies rather than walks. 200×200 box, base on y=200, faces right. One `body` part
 * in depth order: thin line-work legs reaching the base line, a fanned tail of three tapered
 * feathers, one egg-shaped body and head (no neck), a two-feather crest, a lighter breast,
 * a wing of three feathers fanning back with lighter feather lines, a faint blush. The beak
 * is the `mouth`, so talking opens it.
 */
export const BIRD: CharacterInput = {
  id: 'bird',
  name: 'Bird',
  description: 'Plump little songbird (simple rig): hops, flies, bounces, opens its beak to talk.',
  rig: 'simple',
  height: 60,
  colors: {
    feather: '#4f9dde',
    featherDark: '#2f74b5',
    breast: '#f7c66b',
    beak: '#f39c34',
    beakDark: '#c9701c',
    cheek: '#f2788c',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body: `<path d='M92 172 L90 194 M90 194 L80 197 M90 194 L98 198 M90 194 L86 199' stroke='{line}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M116 174 L116 194 M116 194 L106 197 M116 194 L124 198 M116 194 L112 199' stroke='{line}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M83.0 134.6 L74.3 126.3 L65.6 118.0 L56.9 109.6 L48.2 101.3 L39.5 92.9 L30.8 84.6 A7.2 7.2 0 0 1 21.2 95.4 L30.5 103.1 L39.8 110.7 L49.1 118.4 L58.4 126.0 L67.7 133.7 L77.0 141.4 A4.5 4.5 0 0 1 83.0 134.6 Z' fill='{featherDark}'/><path d='M79.2 133.6 L69.5 134.8 L59.7 136.0 L50.0 137.2 L40.3 138.4 L30.5 139.6 L20.8 140.9 A7.2 7.2 0 0 1 23.2 155.1 L32.8 153.0 L42.4 150.9 L52.0 148.8 L61.6 146.7 L71.2 144.6 L80.8 142.4 A4.5 4.5 0 0 1 79.2 133.6 Z' fill='{featherDark}'/><path d='M81.2 133.7 L70.0 130.1 L58.8 126.4 L47.6 122.8 L36.4 119.2 L25.2 115.6 L14.0 112.0 A7.2 7.2 0 0 1 10.0 126.0 L21.5 128.7 L33.0 131.4 L44.4 134.2 L55.9 136.9 L67.3 139.6 L78.8 142.3 A4.5 4.5 0 0 1 81.2 133.7 Z' fill='{featherDark}'/><path d='M60 126 L32 108' stroke='{feather}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M60 140 L34 140' stroke='{feather}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M138 56 C162 56 180 74 180 96 C180 106 176 113 172 119 C175 146 160 176 112 179 C80 180 56 164 53 136 C51 116 64 100 84 92 C97 87 104 81 110 72 C117 62 126 56 138 56 Z' fill='{feather}'/><path d='M139.9 67.7 L136.2 62.4 L133.1 57.2 L130.4 52.0 L128.2 46.8 L126.4 41.4 A2.5 2.5 0 0 1 121.6 42.6 L122.7 48.4 L124.3 54.4 L126.4 60.4 L129.1 66.4 L132.1 72.3 A4.5 4.5 0 0 1 139.9 67.7 Z' fill='{feather}'/><path d='M146.9 68.8 L147.6 63.7 L147.7 58.6 L147.4 53.5 L146.5 48.4 L145.2 43.6 A2.2 2.2 0 0 1 140.8 44.4 L141.4 49.2 L141.5 53.7 L141.1 58.2 L140.4 62.7 L139.1 67.2 A4.0 4.0 0 0 1 146.9 68.8 Z' fill='{feather}'/><path d='M175 100 C182 130 170 170 118 176 C104 168 100 148 112 130 C124 112 150 102 175 100 Z' fill='{breast}'/><path d='M109.6 116.4 L101.6 119.3 L93.8 121.7 L85.9 123.6 L78.0 125.0 L70.1 126.0 L61.9 126.5 A5.5 5.5 0 0 1 62.1 137.5 L70.6 137.8 L79.3 137.6 L88.1 136.9 L96.9 135.7 L105.7 133.9 L114.4 131.6 A8.0 8.0 0 0 1 109.6 116.4 Z' fill='{featherDark}'/><path d='M111.0 124.6 L103.0 128.3 L95.1 131.5 L87.3 134.2 L79.4 136.5 L71.5 138.2 L63.4 139.5 A5.5 5.5 0 0 1 64.6 150.5 L73.2 149.9 L81.9 148.9 L90.7 147.3 L99.5 145.2 L108.4 142.5 L117.0 139.4 A8.0 8.0 0 0 1 111.0 124.6 Z' fill='{featherDark}'/><path d='M112.1 133.0 L105.2 137.4 L98.4 141.1 L91.6 144.5 L84.7 147.3 L77.9 149.7 L70.8 151.6 A5.5 5.5 0 0 1 73.2 162.4 L80.8 161.2 L88.6 159.4 L96.4 157.0 L104.3 154.2 L112.2 150.8 L119.9 147.0 A8.0 8.0 0 0 1 112.1 133.0 Z' fill='{featherDark}'/><path d='M86 120 C96 106 124 104 134 118 C142 132 132 150 112 152 C96 152 82 140 86 120 Z' fill='{featherDark}'/><path d='M94 136 Q80 136 70 138' stroke='{feather}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M98 144 Q86 148 76 151' stroke='{feather}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M96 124 Q110 116 126 122' stroke='{feather}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/><ellipse cx='158' cy='112' rx='8' ry='5.5' fill='{cheek}' opacity='0.6'/>`,
    eyes: {
      open: `<circle cx='152' cy='88' r='6.5' fill='{line}'/><circle cx='154.2' cy='85.4' r='2.2' fill='#fff'/>`,
      closed: `<path d='M145 89 Q152 95 159 89' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='152' cy='87' rx='8.5' ry='9.5' fill='#fff'/><circle cx='153' cy='88' r='4.2' fill='{line}'/><circle cx='154.4' cy='85.6' r='1.5' fill='#fff'/>`,
      happy: `<path d='M145 91 Q152 82 159 91' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='152' cy='90' r='6' fill='{line}'/><circle cx='154' cy='87.5' r='2' fill='#fff'/><path d='M143 80 L159 76' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<circle cx='152' cy='90' r='6' fill='{line}'/><circle cx='154' cy='87.5' r='2' fill='#fff'/><path d='M143 76 L160 83' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M170 92 Q184 95 196 102 Q184 108 170 111 Z' fill='{beak}'/><path d='M172 102 L192 102' stroke='{beakDark}' stroke-width='2' stroke-linecap='round'/>`,
      open: `<path d='M170 90 Q184 89 196 94 Q184 99 171 101 Z' fill='{beak}'/><path d='M171 106 Q182 110 192 114 Q181 116 170 114 Z' fill='{beakDark}'/><path d='M171 100 L186 100 L171 107 Z' fill='{mouth}'/>`,
    },
  },
};
