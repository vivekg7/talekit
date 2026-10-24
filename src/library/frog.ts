import type { CharacterInput } from '../engine/types.js';

/**
 * A squat storybook frog sitting on the `simple` rig: 200×200 box, base on y=200, turned
 * three-quarter to the right. `body` in depth order: the far front foot behind, one domed
 * body and head (no neck), the two eye bulges on top of the head (the far one smaller and
 * further right), a pale throat and belly down the front, darker spots on the back, the near
 * thigh folded against the flank with its crease, the long near hind foot lying forward
 * along the base line, the near front leg straight down, the toes marked with short creases,
 * nostrils and a faint blush. The eyeballs sit in the bulges as `eyes`, so a blink or a
 * frown lids them and the bulge stays; `mouth.open` puffs the throat out under the chin.
 */
export const FROG: CharacterInput = {
  id: 'frog',
  name: 'Frog',
  description:
    'Squat green frog sitting (simple rig): hops for bounce and jump, puffs its throat to talk.',
  rig: 'simple',
  height: 55,
  colors: {
    skin: '#6cbf4a',
    skinDark: '#4c9634',
    belly: '#e6efb4',
    throat: '#f4f7d2',
    eye: '#ffffff',
    cheek: '#f2788c',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body: `<g><path d='M176 160 L181 184' stroke='{skinDark}' stroke-width='13' stroke-linecap='round' fill='none'/><path d='M178 185 C184 182 194 185 196 191 C198 198 193 200 189 200 L181 200 C176 198 175 190 178 185 Z' fill='{skinDark}'/></g><path d='M38 168 C30 132 48 100 84 88 C98 82 110 78 124 76 C150 66 176 66 190 84 C197 94 195 110 186 120 C192 138 190 160 178 176 C170 184 160 186 148 186 L70 186 C52 186 42 180 38 168 Z' fill='{skin}'/><circle cx='172' cy='68' r='16' fill='{skin}'/><circle cx='134' cy='64' r='22' fill='{skin}'/><path d='M142 186 C164 184 182 170 187 148 C188 136 186 126 183 120 C172 128 160 132 146 132 C156 150 156 170 142 186 Z' fill='{belly}'/><ellipse cx='70' cy='114' rx='10' ry='7' fill='{skinDark}'/><ellipse cx='96' cy='98' rx='7' ry='5' fill='{skinDark}'/><ellipse cx='110' cy='116' rx='6' ry='4.5' fill='{skinDark}'/><g><path d='M44 184 C70 181 96 183 116 186 C128 186 136 189 136 194 C136 198 132 200 127 200 L44 199 Z' fill='{skin}'/></g><path d='M118 193 L119 199 M127 192 L128 199' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M34 176 C24 154 34 126 62 120 C90 114 112 132 110 158 C108 178 92 192 66 194 C50 194 38 188 34 176 Z' fill='{skin}'/><path d='M40 148 C46 128 70 118 94 124 C104 130 110 142 110 156' stroke='{line}' stroke-width='3' stroke-linecap='round' fill='none'/><ellipse cx='60' cy='144' rx='7' ry='5' fill='{skinDark}'/><ellipse cx='84' cy='166' rx='5' ry='4' fill='{skinDark}'/><g><path d='M152 146 L156 182' stroke='{skin}' stroke-width='16' stroke-linecap='round' fill='none'/><path d='M146 185 C152 181 170 182 178 188 C182 192 182 199 176 200 L149 200 C142 199 141 190 146 185 Z' fill='{skin}'/></g><path d='M158 192 L158 199 M167 192 L168 199' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M145 154 L148 180' stroke='{line}' stroke-width='3' stroke-linecap='round' fill='none'/><circle cx='181' cy='89' r='2.2' fill='{line}'/><circle cx='190' cy='91' r='1.8' fill='{line}'/><ellipse cx='152' cy='106' rx='8' ry='5' fill='{cheek}' opacity='0.45'/>`,
    eyes: {
      open: `<circle cx='134' cy='62' r='15' fill='{eye}'/><circle cx='138' cy='63' r='8.5' fill='{line}'/><circle cx='140.6' cy='59.6' r='3' fill='#fff'/><circle cx='172' cy='66' r='10.5' fill='{eye}'/><circle cx='175' cy='67' r='6' fill='{line}'/><circle cx='176.8' cy='64.6' r='2.1' fill='#fff'/>`,
      closed: `<path d='M120 64 Q134 74 148 64' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M162 67 Q172 74 182 67' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      wide: `<circle cx='134' cy='61' r='17' fill='{eye}'/><circle cx='136' cy='62' r='5.5' fill='{line}'/><circle cx='137.8' cy='59.6' r='2' fill='#fff'/><circle cx='172' cy='65' r='12.5' fill='{eye}'/><circle cx='174' cy='66' r='4' fill='{line}'/><circle cx='175.3' cy='64.3' r='1.5' fill='#fff'/>`,
      happy: `<path d='M120 66 Q134 52 148 66' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/><path d='M162 69 Q172 58 182 69' stroke='{line}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
      sad: `<circle cx='134' cy='62' r='15' fill='{eye}'/><circle cx='137' cy='67' r='8' fill='{line}'/><circle cx='139.4' cy='64' r='2.8' fill='#fff'/><path d='M119 60 C120 50 128 46 136 46 C144 47 148 52 149 58 Q134 50 119 60 Z' fill='{skin}' stroke='{line}' stroke-width='3' stroke-linejoin='round'/><circle cx='172' cy='66' r='10.5' fill='{eye}'/><circle cx='174' cy='70' r='5.6' fill='{line}'/><circle cx='175.6' cy='67.6' r='2' fill='#fff'/><path d='M161 63 C162 57 166 55 172 55 C178 55 182 60 183 64 Q172 59 161 63 Z' fill='{skin}' stroke='{line}' stroke-width='2.5' stroke-linejoin='round'/>`,
      angry: `<circle cx='134' cy='63' r='15' fill='{eye}'/><circle cx='138' cy='65' r='8' fill='{line}'/><circle cx='140.4' cy='62' r='2.8' fill='#fff'/><path d='M119 56 C121 50 128 46 136 46 C144 47 149 54 149 62 Q134 52 119 56 Z' fill='{skin}' stroke='{line}' stroke-width='3' stroke-linejoin='round'/><circle cx='172' cy='67' r='10.5' fill='{eye}'/><circle cx='175' cy='69' r='5.6' fill='{line}'/><circle cx='176.6' cy='66.6' r='2' fill='#fff'/><path d='M161 61 C163 57 167 55 172 55 C178 55 183 60 183 67 Q172 59 161 61 Z' fill='{skin}' stroke='{line}' stroke-width='2.5' stroke-linejoin='round'/>`,
    },
    mouth: {
      closed: `<path d='M118 102 Q120 108 126 108 Q158 120 188 102' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`,
      open: `<ellipse cx='162' cy='132' rx='22' ry='15' fill='{throat}' stroke='{line}' stroke-width='3'/><path d='M126 108 Q158 120 188 102 Q176 126 148 124 Q132 120 126 108 Z' fill='{mouth}' stroke='{line}' stroke-width='3.5' stroke-linejoin='round'/>`,
      smile: `<path d='M118 100 Q120 108 126 108 Q160 128 190 98' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`,
      sad: `<path d='M124 118 Q156 106 186 112' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`,
      angry: `<path d='M124 112 Q132 108 140 110 L186 104' stroke='{line}' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>`,
      scared: `<path d='M130 110 Q158 116 184 106 Q178 124 156 124 Q136 122 130 110 Z' fill='{mouth}' stroke='{line}' stroke-width='3.5' stroke-linejoin='round'/>`,
    },
  },
};
