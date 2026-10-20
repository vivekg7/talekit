import type { SceneInput } from '../engine/types.js';

/** Suburban street: three houses, a pavement and a road. Ground (pavement) y=610. */
export const STREET: SceneInput = {
  id: 'street',
  name: 'Street',
  description: 'Row of houses with a pavement (ground) and a road in front.',
  ground: 610,
  anchors: {
    'house-door': { x: 330, y: 600 },
    lamp: { x: 760, y: 605 },
    corner: { x: 1180, y: 605 },
    road: { x: 640, y: 690, scale: 1.1 },
    'far-end': { x: 60, y: 600 },
  },
  svg: `<defs><linearGradient id='street-sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#74c0fc'/><stop offset='1' stop-color='#d0ebff'/></linearGradient></defs><rect width='1280' height='720' fill='url(#street-sky)'/><g fill='#fff' opacity='0.9'><ellipse cx='200' cy='110' rx='70' ry='26'/><ellipse cx='240' cy='92' rx='46' ry='26'/><ellipse cx='980' cy='80' rx='64' ry='24'/><ellipse cx='1020' cy='64' rx='44' ry='24'/></g><path d='M0 420 Q320 360 640 400 T1280 390 L1280 560 L0 560 Z' fill='#9ad17a'/><g><rect x='200' y='330' width='260' height='230' fill='#ffe8a3'/><path d='M180 340 L330 220 L480 340 Z' fill='#c0392b'/><rect x='300' y='440' width='60' height='120' rx='4' fill='#8a5a2b'/><rect x='230' y='370' width='50' height='50' fill='#8fd3ff' stroke='#fff' stroke-width='6'/><rect x='390' y='370' width='50' height='50' fill='#8fd3ff' stroke='#fff' stroke-width='6'/><rect x='400' y='240' width='30' height='60' fill='#8a5a2b'/></g><g><rect x='560' y='360' width='220' height='200' fill='#bde0fe'/><path d='M540 370 L670 270 L800 370 Z' fill='#3d5a80'/><rect x='640' y='460' width='56' height='100' rx='4' fill='#6c4f2a'/><rect x='580' y='390' width='46' height='46' fill='#fff7ae' stroke='#fff' stroke-width='6'/><rect x='710' y='390' width='46' height='46' fill='#fff7ae' stroke='#fff' stroke-width='6'/></g><g><rect x='880' y='350' width='250' height='210' fill='#f8c8dc'/><path d='M860 360 L1005 250 L1150 360 Z' fill='#7b5e57'/><rect x='980' y='450' width='56' height='110' rx='4' fill='#5a3a1a'/><rect x='910' y='380' width='48' height='48' fill='#8fd3ff' stroke='#fff' stroke-width='6'/><rect x='1060' y='380' width='48' height='48' fill='#8fd3ff' stroke='#fff' stroke-width='6'/></g><g><rect x='1200' y='450' width='22' height='110' rx='5' fill='#7a4b2a'/><circle cx='1211' cy='420' r='56' fill='#3f9b45'/><circle cx='1170' cy='450' r='36' fill='#4caf50'/></g><rect y='560' width='1280' height='60' fill='#cfcfcf'/><rect y='558' width='1280' height='6' fill='#eaeaea'/><rect y='620' width='1280' height='100' fill='#4a4a4a'/><g stroke='#ffd166' stroke-width='6' stroke-dasharray='40 30'><line x1='0' y1='670' x2='1280' y2='670'/></g><g><rect x='754' y='380' width='12' height='230' fill='#333'/><rect x='740' y='360' width='40' height='30' rx='6' fill='#555'/><rect x='748' y='366' width='24' height='18' fill='#fff2a8'/></g><g><rect x='100' y='520' width='40' height='50' rx='6' fill='#2a9d8f'/><rect x='110' y='510' width='20' height='14' fill='#1d7a70'/></g>`,
};
