import type { CharacterInput } from '../engine/types.js';

/**
 * A scarlet macaw on the `simple` rig, laid out like `bird`: 200×200 box, base on y=200, faces
 * right. Upright, as a parrot stands. One `body` part in depth order: a long red tail tapering
 * down behind to the base line with blue tips, short grey legs with zygodactyl feet (two toes
 * forward, two back) gripping the base line, a red body and round head in one shape, the bare
 * pale face patch with fine red feather lines round the eye, and a folded wing: red coverts at
 * the shoulder, the yellow band with green tips below it, then blue flight feathers sweeping
 * back over the tail. The pale iris rings a dark pupil. The heavy hooked beak is the `mouth`, so
 * talking opens it: an ivory upper mandible hooking over a dark lower one, with a dark tongue
 * when open.
 */
export const PARROT: CharacterInput = {
  id: 'parrot',
  name: 'Parrot',
  description: 'Scarlet macaw, red with yellow and blue wings (simple rig): hops, flies, squawks.',
  rig: 'simple',
  height: 70,
  colors: {
    feather: '#d8302a',
    featherDark: '#a91f1f',
    yellow: '#f5c330',
    green: '#4c9a52',
    blue: '#2f6fc0',
    blueDark: '#214f91',
    face: '#f3ebe2',
    faceLine: '#d77c72',
    beak: '#efe4cf',
    beakShade: '#c9bb9f',
    beakDark: '#2e2a2c',
    eye: '#f2e7a6',
    legs: '#7c7a80',
    mouth: '#5a2230',
    line: '#2e2633',
  },
  parts: {
    body:
      // Tail: two long feathers tapering to the base line, blue at the tips.
      `<path d='M98 158 C72 172 42 186 8 197 C36 198 70 192 106 178 Z' fill='{featherDark}'/>` +
      `<path d='M42 186 C30 190 18 194 8 197 C20 198 34 196 48 192 Z' fill='{blue}'/>` +
      `<path d='M94 166 C74 180 52 190 26 199 C52 199 80 192 108 180 Z' fill='{feather}'/>` +
      `<path d='M56 189 C46 193 36 196 26 199 C38 199 50 197 62 194 Z' fill='{blue}'/>` +
      // Legs and feet: two toes forward, two back, curled on the base line.
      `<path d='M112 176 L112 191 M112 191 L123 196 M112 191 L120 199 M112 191 L102 196 M112 191 L105 199' stroke='{legs}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>` +
      `<path d='M128 172 L129 191 M129 191 L140 196 M129 191 L137 199 M129 191 L119 196 M129 191 L122 199' stroke='{legs}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>` +
      // Body and head in one shape.
      `<path d='M108 52 C116 34 144 30 158 44 C166 54 166 70 162 84 C164 102 158 124 148 142 C140 160 128 176 110 182 C94 186 82 178 80 164 C78 140 86 110 96 86 C100 74 102 62 108 52 Z' fill='{feather}'/>` +
      // The bare face patch round the eye, with fine feather lines.
      `<path d='M134 48 C146 42 158 48 158 62 C158 76 152 86 142 88 C132 88 126 78 126 66 C126 57 129 51 134 48 Z' fill='{face}'/>` +
      `<path d='M130 76 Q138 80 148 78 M133 82 Q141 85 149 82' stroke='{faceLine}' stroke-width='1.6' stroke-linecap='round' fill='none'/>` +
      // The folded wing: blue flight feathers, the yellow band, red coverts at the shoulder.
      `<path d='M128 94 C144 110 142 140 126 158 C110 174 84 184 56 186 C76 170 96 142 106 114 C110 102 118 92 128 94 Z' fill='{blue}'/>` +
      `<path d='M118 140 Q96 162 70 180 M128 132 Q110 160 86 178' stroke='{blueDark}' stroke-width='2.5' stroke-linecap='round' fill='none'/>` +
      `<path d='M128 94 C140 104 142 120 136 134 C124 132 112 124 104 118 C108 104 116 92 128 94 Z' fill='{yellow}'/>` +
      `<path d='M106 120 C114 126 126 132 136 134' stroke='{green}' stroke-width='4' stroke-linecap='round' fill='none'/>` +
      `<path d='M126 94 C134 100 136 108 132 114 C122 112 114 108 108 104 C112 96 118 92 126 94 Z' fill='{featherDark}'/>`,
    eyes: {
      open: `<circle cx='143' cy='62' r='7' fill='{eye}'/><circle cx='144' cy='62' r='4' fill='{line}'/><circle cx='145.4' cy='60.4' r='1.4' fill='#fff'/>`,
      closed: `<path d='M135 63 Q143 69 151 63' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<circle cx='143' cy='61' r='8.5' fill='{eye}'/><circle cx='144' cy='62' r='3.4' fill='{line}'/><circle cx='145.2' cy='60.2' r='1.2' fill='#fff'/>`,
      happy: `<path d='M135 66 Q143 57 151 66' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='143' cy='64' r='6.5' fill='{eye}'/><circle cx='144' cy='66' r='3.8' fill='{line}'/><circle cx='145.3' cy='64.2' r='1.3' fill='#fff'/><path d='M134 54 L151 50' stroke='{featherDark}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      angry: `<circle cx='143' cy='64' r='6.5' fill='{eye}'/><circle cx='144.5' cy='65' r='3.8' fill='{line}'/><circle cx='145.8' cy='63.2' r='1.3' fill='#fff'/><path d='M133 50 L153 58' stroke='{featherDark}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
    },
    mouth: {
      closed:
        `<path d='M154 84 C162 82 171 85 175 93 C171 102 162 106 155 103 C151 98 151 89 154 84 Z' fill='{beakDark}'/>` +
        `<path d='M156 46 C175 43 193 57 193 80 C194 92 189 100 180 103 C182 93 178 86 170 84 C164 82 159 84 155 86 C149 76 149 54 156 46 Z' fill='{beak}'/>` +
        `<path d='M161 52 C176 52 186 62 188 78' stroke='{beakShade}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
      open:
        `<path d='M156 76 C166 74 178 78 182 90 C180 100 176 106 172 108 C166 102 160 98 155 97 Z' fill='{mouth}'/>` +
        `<path d='M158 90 C164 88 170 91 171 96 C167 99 161 99 158 97 Z' fill='{beakDark}'/>` +
        `<path d='M154 96 C162 96 172 102 176 110 C171 118 161 119 155 114 C151 109 151 100 154 96 Z' fill='{beakDark}'/>` +
        `<path d='M156 40 C176 34 196 46 197 70 C198 82 193 90 184 93 C186 83 181 76 173 74 C166 72 160 74 155 77 C149 66 149 48 156 40 Z' fill='{beak}'/>` +
        `<path d='M161 46 C176 45 189 54 192 68' stroke='{beakShade}' stroke-width='2.5' stroke-linecap='round' fill='none'/>`,
    },
  },
};
