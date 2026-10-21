import type { CharacterInput } from '../engine/types.js';

/**
 * A round little bird on the `simple` rig: the worked example for anything that bobs, hops
 * or flies rather than walks. 200×200 box, base on y=200, faces right. One `body` part in
 * depth order (tail, far wing, body and head as one blob, near wing); the legs are thin line
 * work reaching the base line. The beak is the `mouth`, so talking opens it.
 */
export const BIRD: CharacterInput = {
  id: 'bird',
  name: 'Bird',
  description: 'Round little songbird (simple rig): hops, flies, bounces, opens its beak to talk.',
  rig: 'simple',
  height: 60,
  colors: {
    feather: '#4f9dde',
    featherDark: '#2f74b5',
    breast: '#f7c66b',
    beak: '#f39c34',
    beakDark: '#c9701c',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body: `<path d='M86 168 L84 196 M84 196 L74 198 M84 196 L94 198' stroke='{line}' stroke-width='4' stroke-linecap='round' fill='none'/><path d='M112 170 L112 196 M112 196 L102 198 M112 196 L122 198' stroke='{line}' stroke-width='4' stroke-linecap='round' fill='none'/><path d='M62 124 L18 104 L26 130 L16 150 L64 146 Z' fill='{featherDark}'/><ellipse cx='98' cy='134' rx='50' ry='42' fill='{feather}'/><circle cx='132' cy='96' r='34' fill='{feather}'/><path d='M104 120 Q140 116 146 146 Q136 172 102 174 Q86 160 104 120 Z' fill='{breast}'/><path d='M60 116 Q92 104 110 130 Q100 158 70 156 Q50 140 60 116 Z' fill='{featherDark}'/>`,
    eyes: {
      open: `<circle cx='144' cy='88' r='6' fill='{line}'/><circle cx='146' cy='85.5' r='2' fill='#fff'/>`,
      closed: `<path d='M137 89 Q144 95 151 89' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<ellipse cx='144' cy='87' rx='8' ry='9' fill='#fff'/><circle cx='145' cy='88' r='4' fill='{line}'/><circle cx='146.5' cy='85.5' r='1.4' fill='#fff'/>`,
      happy: `<path d='M137 91 Q144 82 151 91' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='144' cy='90' r='6' fill='{line}'/><circle cx='146' cy='87.5' r='2' fill='#fff'/><path d='M135 80 L151 76' stroke='{line}' stroke-width='3' stroke-linecap='round'/>`,
      angry: `<circle cx='144' cy='90' r='6' fill='{line}'/><circle cx='146' cy='87.5' r='2' fill='#fff'/><path d='M135 76 L152 83' stroke='{line}' stroke-width='3.5' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M156 90 L188 100 L156 110 Z' fill='{beak}'/><path d='M158 100 L186 100' stroke='{beakDark}' stroke-width='2' stroke-linecap='round'/>`,
      open: `<path d='M156 88 L188 92 L158 99 Z' fill='{beak}'/><path d='M158 104 L184 110 L156 113 Z' fill='{beakDark}'/><path d='M158 99 L176 101 L158 104 Z' fill='{mouth}'/>`,
    },
  },
};
