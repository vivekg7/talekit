import type { CharacterInput } from '../engine/types.js';

/**
 * An Indian spectacled cobra coiled on the ground, on the `simple` rig: 200×200 box, base on
 * y=200, faces right. One rigid `body` part in depth order: three coils stacked smaller to
 * the top, each a ring stroked wide with a light line along its back, the pale belly showing
 * under its front, rows of scale arcs and a dark line where it rests on the coil below (the
 * outline underlay goes round the whole part, so the coils draw their own); the tail tip
 * comes out under the front of the bottom coil and curls up at the right. From behind the
 * top coil the neck rises in an S, its belly band facing us, into the hood: a shield nearly
 * twice the head's width that bulges out on both sides below the head and tapers back into
 * the neck, so it reads as a cobra in silhouette. The hood is turned a little toward us: the
 * far (left) flare shows its back with one eye of the spectacle mark, the pale front carries
 * the ventral scale lines and two dark throat bands. The head sits on top of the hood with
 * the snout to the right, outlined so it parts from the hood behind it. The eye has a slit
 * pupil; brows are the dark scale over it. `mouth.open` drops the jaw on two fangs and
 * flicks the forked tongue out, so talking is a hiss. The neck does not sway: the face parts
 * are placed on `body`, so a hung neck would leave the eyes and mouth behind.
 */
export const COBRA: CharacterInput = {
  id: 'cobra',
  name: 'Cobra',
  description:
    'Spectacled cobra, coiled with its hood spread (simple rig): sways with a bob, hisses to talk.',
  rig: 'simple',
  height: 110,
  colors: {
    scales: '#8a6a3a',
    scalesDark: '#634a26',
    scalesLight: '#a98a55',
    belly: '#e9d7a2',
    bellyDark: '#c9b27a',
    band: '#4a3820',
    mark: '#f1e6c6',
    eye: '#e9c25a',
    tongue: '#c8343e',
    mouth: '#7a2a32',
    line: '#2e2633',
  },
  parts: {
    body: `<ellipse cx='90' cy='174' rx='64' ry='13' stroke='{scales}' stroke-width='24' fill='{scales}'/><path d='M28 174 A62 11 0 0 1 152 174' stroke='{scalesLight}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M17.5 174 A72.5 21.5 0 0 0 162.5 174' stroke='{belly}' stroke-width='4' fill='none'/><path d='M33.7 174.3 Q36.7 177.3 39.7 174.3 M19.8 178.4 Q22.8 181.4 25.8 178.4 M40.2 175.5 Q43.2 178.5 46.2 175.5 M28.1 183.3 Q31.1 186.3 34.1 183.3 M50.6 176.5 Q53.6 179.5 56.6 176.5 M41.2 187.4 Q44.2 190.4 47.2 187.4 M63.9 177.2 Q66.9 180.2 69.9 177.2 M57.9 190.3 Q60.9 193.3 63.9 190.3 M79.1 177.6 Q82.1 180.6 85.1 177.6 M77 191.8 Q80 194.8 83 191.8 M94.9 177.6 Q97.9 180.6 100.9 177.6 M97 191.8 Q100 194.8 103 191.8 M110.1 177.2 Q113.1 180.2 116.1 177.2 M116.1 190.3 Q119.1 193.3 122.1 190.3 M123.4 176.5 Q126.4 179.5 129.4 176.5 M132.8 187.4 Q135.8 190.4 138.8 187.4 M133.8 175.5 Q136.8 178.5 139.8 175.5 M145.9 183.3 Q148.9 186.3 151.9 183.3 M140.3 174.3 Q143.3 177.3 146.3 174.3 M154.2 178.4 Q157.2 181.4 160.2 178.4' stroke='{scalesDark}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M14 174 A76 25 0 0 0 166 174' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M104 190 C126 196 152 197 170 192 C178 189 182 182 177 178 C173 176 170 180 171 184 C160 188 136 188 108 182 Z' fill='{scales}'/><path d='M108 182 C136 188 160 188 171 184' stroke='{line}' stroke-width='2.2' stroke-linecap='round' fill='none'/><path d='M112 191 C134 195 154 195 168 191' stroke='{belly}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M124 187 Q128 190 132 188 M138 188 Q142 191 146 189 M152 188 Q156 190 160 188' stroke='{scalesDark}' stroke-width='1.4' stroke-linecap='round' fill='none'/><ellipse cx='94' cy='150' rx='48' ry='10' stroke='{scales}' stroke-width='22' fill='{scales}'/><path d='M48 150 A46 8 0 0 1 140 150' stroke='{scalesLight}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M38.5 150 A55.5 17.5 0 0 0 149.5 150' stroke='{belly}' stroke-width='4' fill='none'/><path d='M53.8 149.9 Q56.8 152.9 59.8 149.9 M41.6 154.9 Q44.6 157.9 47.6 154.9 M62.5 150.6 Q65.5 153.6 68.5 150.6 M53.2 160 Q56.2 163 59.2 160 M75.6 151.1 Q78.6 154.1 81.6 151.1 M70.5 163.3 Q73.5 166.3 76.5 163.3 M91 151.3 Q94 154.3 97 151.3 M91 164.5 Q94 167.5 97 164.5 M106.4 151.1 Q109.4 154.1 112.4 151.1 M111.5 163.3 Q114.5 166.3 117.5 163.3 M119.5 150.6 Q122.5 153.6 125.5 150.6 M128.8 160 Q131.8 163 134.8 160 M128.2 149.9 Q131.2 152.9 134.2 149.9 M140.4 154.9 Q143.4 157.9 146.4 154.9' stroke='{scalesDark}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M35 150 A59 21 0 0 0 153 150' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M118 128 C148 124 158 116 140 102' stroke='{scales}' stroke-width='22' stroke-linecap='round' fill='none'/><path d='M129 132 C158 128 168 116 152 104' stroke='{belly}' stroke-width='8' stroke-linecap='round' fill='none'/><path d='M131 127 L138 130 M140 123 L147 125 M147 117 L155 118' stroke='{bellyDark}' stroke-width='1.4' stroke-linecap='round' fill='none'/><ellipse cx='98' cy='129' rx='32' ry='7' stroke='{scales}' stroke-width='19' fill='{scales}'/><path d='M68 129 A30 5 0 0 1 128 129' stroke='{scalesLight}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M60 129 A38 13 0 0 0 136 129' stroke='{belly}' stroke-width='4' fill='none'/><path d='M74.5 128.2 Q77.5 131.2 80.5 128.2 M65.3 134.9 Q68.3 137.9 71.3 134.9 M87.2 128.3 Q90.2 131.3 93.2 128.3 M83.6 139.2 Q86.6 142.2 89.6 139.2 M102.8 128.3 Q105.8 131.3 108.8 128.3 M106.4 139.2 Q109.4 142.2 112.4 139.2 M115.5 128.2 Q118.5 131.2 121.5 128.2 M124.7 134.9 Q127.7 137.9 130.7 134.9' stroke='{scalesDark}' stroke-width='1.6' stroke-linecap='round' fill='none'/><path d='M56.5 129 A41.5 16.5 0 0 0 139.5 129' stroke='{line}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M132 114 C112 102 82 84 82 58 C82 38 98 22 122 20 L156 20 C180 22 196 38 196 58 C196 84 166 102 148 114 Z' fill='{scales}'/><path d='M130 108 C110 96 88 80 88 58 C88 40 100 27 118 23 C106 38 102 56 108 74 C112 88 120 100 130 108 Z' fill='{scalesDark}'/><ellipse cx='101' cy='62' rx='6.5' ry='10' stroke='{line}' stroke-width='7.5' fill='none'/><ellipse cx='101' cy='62' rx='6.5' ry='10' stroke='{mark}' stroke-width='4' fill='{mark}'/><circle cx='101.5' cy='62' r='3.8' fill='{line}'/><path d='M105 72 Q110 80 118 82' stroke='{line}' stroke-width='7' stroke-linecap='round' fill='none'/><path d='M105 72 Q110 80 118 82' stroke='{mark}' stroke-width='3.4' stroke-linecap='round' fill='none'/><path d='M136 110 C122 94 112 72 116 52 C120 38 132 32 146 32 C162 32 174 42 176 58 C178 78 160 98 144 110 Z' fill='{belly}'/><path d='M117 56 Q146 61 175 56 M115 64 Q146 69 177 64 M117 76 Q146 81 175 76 M121 88 Q146 93 170 88 M127 98 Q146 102 162 98' stroke='{bellyDark}' stroke-width='1.4' stroke-linecap='round' fill='none'/><path d='M115 70 Q146 76 177 70' stroke='{band}' stroke-width='5' stroke-linecap='round' fill='none'/><path d='M119 82 Q146 88 173 82' stroke='{band}' stroke-width='4.5' stroke-linecap='round' fill='none'/><path d='M180 34 C189 44 192 56 190 70' stroke='{scalesLight}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M112 36 C110 22 122 13 138 13 C152 13 166 20 171 29 C173 34 169 40 162 42 C148 45 128 46 118 44 C114 42 112 39 112 36 Z' fill='{scales}' stroke='{line}' stroke-width='2.5' stroke-linejoin='round'/><path d='M118 42 C132 44 150 43 164 40' stroke='{belly}' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M124 17 C132 14 146 14 156 18' stroke='{scalesLight}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M126 22 L130 18 M136 21 L138 16 M146 22 L147 17' stroke='{scalesDark}' stroke-width='1.4' stroke-linecap='round' fill='none'/><circle cx='165' cy='27' r='1.6' fill='{line}'/>`,
    eyes: {
      open: `<circle cx='142' cy='26' r='6' fill='{eye}'/><ellipse cx='143.5' cy='26' rx='2.5' ry='3.6' fill='{line}'/><circle cx='144.7' cy='24.4' r='1.1' fill='#fff'/>`,
      closed: `<path d='M136 26 Q142 31 148 26' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
      wide: `<circle cx='142' cy='25.5' r='7.4' fill='{eye}'/><ellipse cx='143' cy='25.5' rx='2.4' ry='3.4' fill='{line}'/><circle cx='144.2' cy='23.9' r='1.1' fill='#fff'/>`,
      happy: `<path d='M136 28 Q142 21 148 28' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
      sad: `<circle cx='142' cy='27' r='5.6' fill='{eye}'/><ellipse cx='143' cy='28.4' rx='2.4' ry='3.4' fill='{line}'/><circle cx='144.2' cy='26.8' r='1.1' fill='#fff'/><path d='M134 21 Q142 17 149 19' stroke='{scalesDark}' stroke-width='3' stroke-linecap='round' fill='none'/>`,
      angry: `<circle cx='142' cy='27' r='5.6' fill='{eye}'/><ellipse cx='144' cy='27.6' rx='2.4' ry='3.4' fill='{line}'/><circle cx='145.2' cy='26' r='1.1' fill='#fff'/><path d='M134 18 L150 23' stroke='{scalesDark}' stroke-width='3.5' stroke-linecap='round' fill='none'/>`,
    },
    mouth: {
      closed: `<path d='M144 38 Q156 39 168 34' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
      smile: `<path d='M142 35 Q152 42 168 33' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
      sad: `<path d='M144 40 Q154 35 167 37' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
      angry: `<path d='M143 37 L152 39 L168 34' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none' stroke-linejoin='round'/>`,
      open: `<path d='M138 37 L171 31 L168 50 Q152 54 138 44 Z' fill='{mouth}'/><path d='M161 35 L163 42 L165 34 Z M153 36.5 L154.5 42 L156.5 36 Z' fill='#fff'/><path d='M136 42 Q152 52 169 49 C170 53 164 57 152 56 C142 55 136 50 136 42 Z' fill='{scales}'/><path d='M140 51 Q152 55 164 53' stroke='{belly}' stroke-width='2.5' stroke-linecap='round' fill='none'/><path d='M152 45 L176 42 L184 37 M176 42 L184 46' stroke='{tongue}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M138 37 L171 31' stroke='{line}' stroke-width='2.6' stroke-linecap='round' fill='none'/>`,
    },
  },
};
