import type { CharacterInput } from '../engine/types.js';

/**
 * A white mute swan floating, on the `simple` rig: 200×200 box, base on y=200, faces right. The
 * base line is the waterline's underside, so nothing is drawn below the body (no feet) and the
 * bottom of the body stays plain for a scene's water to cover. One `body` part in depth order:
 * a boat-shaped body with a pointed tail tipped up at the left and a cool grey shade under the
 * wing, a tapering S-curved neck rising from the chest to a small head near the top right, the
 * black knob and mask of a mute swan, then the folded wing over the back, arched and rising to
 * layered flight feathers at the back. The beak is the `mouth`, so talking opens it: orange
 * with a dark nail at the tip. The eye sits on the black mask, so it has a white ring to read,
 * and the closed and happy eyes are drawn in white.
 */
export const SWAN: CharacterInput = {
  id: 'swan',
  name: 'Swan',
  description: 'White mute swan floating (simple rig): glides, bobs, opens its beak to talk.',
  rig: 'simple',
  height: 100,
  colors: {
    feather: '#fbfbf7',
    shade: '#dde3ec',
    shadeDark: '#bcc6d4',
    beak: '#f08a2c',
    beakLight: '#f8ae62',
    beakDark: '#b85a17',
    mask: '#2e2a33',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body:
      // Body, tail tipped up at the left.
      `<path d='M8 112 C22 124 32 136 36 150 C40 178 62 198 98 199 L140 199 C168 199 186 184 186 164 C186 146 176 134 160 130 C130 126 98 132 72 134 C46 136 24 128 8 112 Z' fill='{feather}'/>` +
      `<path d='M38 156 C58 178 100 188 156 184 C128 194 76 196 54 182 C46 176 40 166 38 156 Z' fill='{shade}'/>` +
      `<path d='M12 116 C24 126 30 134 34 144' stroke='{shade}' stroke-width='3' stroke-linecap='round' fill='none'/>` +
      // Neck and head.
      `<path d='M152 152 C162 132 140 114 129 92 C122 72 128 44 148 32 C160 25 176 27 180 38 L174 50 C156 56 146 70 150 86 C156 104 187 122 187 170 Z' fill='{feather}'/>` +
      `<path d='M150 84 C152 100 168 112 178 128' stroke='{shade}' stroke-width='3.5' stroke-linecap='round' fill='none'/>` +
      // Mask from the eye to the beak, and the knob on the beak's base.
      `<path d='M155 39 C160 34 170 33 179 36 L177 46 C168 48 160 47 155 43 Z' fill='{mask}'/>` +
      `<path d='M167 38 C170 29 180 28 184 35 L177 41 Z' fill='{mask}'/>` +
      // Wing: three flight feathers layered behind, rising, then the folded wing over the back.
      `<path d='M114 104 C82 92 50 80 22 70 C30 84 44 98 76 114 Z' fill='{shadeDark}'/>` +
      `<path d='M106 118 C72 106 42 96 16 92 C26 104 42 116 74 128 Z' fill='{shade}'/>` +
      `<path d='M80 124 C62 118 42 114 20 114 C30 124 44 132 64 136 Z' fill='{feather}'/>` +
      `<path d='M74 126 C58 122 42 119 26 118' stroke='{shade}' stroke-width='2.5' stroke-linecap='round' fill='none'/>` +
      `<path d='M154 162 C166 132 148 108 112 100 C96 96 84 96 72 100 C64 112 60 126 58 138 C70 150 88 160 108 166 C126 170 144 172 154 162 Z' fill='{feather}'/>` +
      `<path d='M122 101 Q131 102 134 94 C140 104 148 116 154 130 L118 120 Z' fill='{feather}'/>` +
      `<path d='M142 142 C126 128 106 120 80 116' stroke='{shade}' stroke-width='3' stroke-linecap='round' fill='none'/>` +
      `<path d='M134 156 C114 146 92 138 66 134' stroke='{shade}' stroke-width='3' stroke-linecap='round' fill='none'/>` +
      `<path d='M146 128 Q136 130 132 140 M134 116 Q122 118 118 128 M118 108 Q106 110 102 120' stroke='{shadeDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
    eyes: {
      open: `<circle cx='164' cy='40' r='4.6' fill='#fff'/><circle cx='165' cy='40' r='3' fill='{line}'/><circle cx='166' cy='38.8' r='1.1' fill='#fff'/>`,
      closed: `<path d='M159 40 Q164 44 169 40' stroke='#fff' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
      wide: `<circle cx='164' cy='39.5' r='5.8' fill='#fff'/><circle cx='164.6' cy='40' r='2.6' fill='{line}'/><circle cx='165.6' cy='38.6' r='1' fill='#fff'/>`,
      happy: `<path d='M159 42 Q164 36 169 42' stroke='#fff' stroke-width='2.4' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='164' cy='41' r='4.4' fill='#fff'/><circle cx='164.6' cy='42' r='2.8' fill='{line}'/><circle cx='165.6' cy='40.8' r='1' fill='#fff'/><path d='M157 33 L170 30' stroke='{shadeDark}' stroke-width='2.5' fill='none' stroke-linecap='round'/>`,
      angry: `<circle cx='164' cy='41' r='4.4' fill='#fff'/><circle cx='165' cy='41.6' r='2.8' fill='{line}'/><circle cx='166' cy='40.4' r='1' fill='#fff'/><path d='M157 30 L171 35' stroke='{shadeDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed: `<path d='M174 34 C184 36 194 44 198 52 C196 56 188 54 172 46 Z' fill='{beak}'/><path d='M176 37 C184 39 191 44 195 49' stroke='{beakLight}' stroke-width='2' stroke-linecap='round' fill='none'/><path d='M173 45 L196 53' stroke='{beakDark}' stroke-width='1.8' stroke-linecap='round'/><path d='M194 47 C197 49 199 51 198 53 C196 54 194 53 193 52 Z' fill='{mask}'/>`,
      open: `<path d='M174 42 L196 46 L190 60 L172 50 Z' fill='{mouth}'/><path d='M174 34 C184 34 194 38 199 45 C194 48 184 46 173 43 Z' fill='{beak}'/><path d='M173 47 C182 52 190 56 194 61 C188 63 180 58 172 52 Z' fill='{beak}'/><path d='M195 42 C198 43 200 45 199 47 C197 47 195 46 194 45 Z' fill='{mask}'/>`,
    },
  },
};
