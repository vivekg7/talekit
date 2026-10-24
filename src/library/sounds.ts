import { fileURLToPath } from 'node:url';

export interface SoundInfo {
  /** Path under sounds/. */
  file: string;
  kind: 'sfx' | 'ambience' | 'music';
  /** One line an agent reads to choose it. */
  description: string;
  /** Seconds. */
  duration: number;
}

/** Where the bundled sounds live: sounds/ at the package root, beside fonts/. */
export const SOUNDS_DIR = fileURLToPath(new URL('../../sounds/', import.meta.url));

/**
 * The bundled sounds, all CC0 or public domain (sounds/CREDITS.md). A name with numbered
 * variants (`lion-roar-1`, `lion-roar-2`) is also reachable by the bare name, which picks
 * one per use so a repeated sound does not repeat exactly.
 */
export const SOUNDS: Record<string, SoundInfo> = {
  'rain-light': {
    file: 'ambience/rain-light.ogg',
    kind: 'ambience',
    description: 'light steady rain with soft dripping, no thunder',
    duration: 32.63,
  },
  'rain-heavy': {
    file: 'ambience/rain-heavy.ogg',
    kind: 'ambience',
    description: 'heavy downpour, dense hiss of rain, no thunder in this cut',
    duration: 28.53,
  },
  wind: {
    file: 'ambience/wind.ogg',
    kind: 'ambience',
    description: 'wind blowing through trees, steady whoosh of leaves',
    duration: 36.45,
  },
  fire: {
    file: 'ambience/fire.ogg',
    kind: 'ambience',
    description: 'small campfire crackling and popping, close',
    duration: 33.55,
  },
  waterfall: {
    file: 'ambience/waterfall.ogg',
    kind: 'ambience',
    description: 'small mountain waterfall, constant rushing water',
    duration: 31.79,
  },
  river: {
    file: 'ambience/river.ogg',
    kind: 'ambience',
    description: 'small brook babbling over stones',
    duration: 30.91,
  },
  sea: {
    file: 'ambience/sea.ogg',
    kind: 'ambience',
    description: 'sea waves washing on a beach, slow wave cycles',
    duration: 42.89,
  },
  forest: {
    file: 'ambience/forest.ogg',
    kind: 'ambience',
    description: 'forest by day, varied birdsong over rustling leaves, calm',
    duration: 40.59,
  },
  jungle: {
    file: 'ambience/jungle.ogg',
    kind: 'ambience',
    description: 'warm tropical jungle, dense birds and insects (a constructed soundscape)',
    duration: 37.53,
  },
  night: {
    file: 'ambience/night.ogg',
    kind: 'ambience',
    description: 'night in the countryside, field crickets, a rare frog',
    duration: 37.29,
  },
  cave: {
    file: 'ambience/cave.ogg',
    kind: 'ambience',
    description: 'cave, slow water drips echoing in a hollow space (a designed soundscape)',
    duration: 40.67,
  },
  village: {
    file: 'ambience/village.ogg',
    kind: 'ambience',
    description: 'rural morning in the countryside: doves, sparrows and chickens, no traffic',
    duration: 39.25,
  },
  city: {
    file: 'ambience/city.ogg',
    kind: 'ambience',
    description: 'busy city street heard from a balcony, traffic and bustle',
    duration: 38.85,
  },
  room: {
    file: 'ambience/room.ogg',
    kind: 'ambience',
    description: 'quiet indoor room tone, faint hum of a house',
    duration: 27.79,
  },
  'thunder-near-1': {
    file: 'sfx/thunder-near-1.ogg',
    kind: 'sfx',
    description: 'a close thunderclap: sharp crack then long rumble',
    duration: 15.47,
  },
  'thunder-near-2': {
    file: 'sfx/thunder-near-2.ogg',
    kind: 'sfx',
    description: 'a close thunderclap with a rolling rumble',
    duration: 10.79,
  },
  'thunder-far-1': {
    file: 'sfx/thunder-far-1.ogg',
    kind: 'sfx',
    description: 'distant thunder, low muffled rumble',
    duration: 12.13,
  },
  'thunder-far-2': {
    file: 'sfx/thunder-far-2.ogg',
    kind: 'sfx',
    description: 'distant thunder, low rolling rumble',
    duration: 10.9,
  },
  'step-shoe-1': {
    file: 'sfx/step-shoe-1.ogg',
    kind: 'sfx',
    description: 'one footstep, hard shoe on stone or pavement (variant 1)',
    duration: 0.11,
  },
  'step-shoe-2': {
    file: 'sfx/step-shoe-2.ogg',
    kind: 'sfx',
    description: 'one footstep, hard shoe on stone or pavement (variant 2)',
    duration: 0.11,
  },
  'step-shoe-3': {
    file: 'sfx/step-shoe-3.ogg',
    kind: 'sfx',
    description: 'one footstep, hard shoe on stone or pavement (variant 3)',
    duration: 0.11,
  },
  'step-shoe-4': {
    file: 'sfx/step-shoe-4.ogg',
    kind: 'sfx',
    description: 'one footstep, hard shoe on stone or pavement (variant 4)',
    duration: 0.11,
  },
  'step-grass-1': {
    file: 'sfx/step-grass-1.ogg',
    kind: 'sfx',
    description: 'one footstep on grass (variant 1)',
    duration: 0.19,
  },
  'step-grass-2': {
    file: 'sfx/step-grass-2.ogg',
    kind: 'sfx',
    description: 'one footstep on grass (variant 2)',
    duration: 0.59,
  },
  'step-grass-3': {
    file: 'sfx/step-grass-3.ogg',
    kind: 'sfx',
    description: 'one footstep on grass (variant 3)',
    duration: 0.2,
  },
  'step-grass-4': {
    file: 'sfx/step-grass-4.ogg',
    kind: 'sfx',
    description: 'one footstep on grass (variant 4)',
    duration: 0.18,
  },
  'step-paw-1': {
    file: 'sfx/step-paw-1.ogg',
    kind: 'sfx',
    description: "one soft padded footfall (carpet step), for an animal's paw (variant 1)",
    duration: 0.17,
  },
  'step-paw-2': {
    file: 'sfx/step-paw-2.ogg',
    kind: 'sfx',
    description: "one soft padded footfall (carpet step), for an animal's paw (variant 2)",
    duration: 0.15,
  },
  'step-paw-3': {
    file: 'sfx/step-paw-3.ogg',
    kind: 'sfx',
    description: "one soft padded footfall (carpet step), for an animal's paw (variant 3)",
    duration: 0.15,
  },
  'step-paw-4': {
    file: 'sfx/step-paw-4.ogg',
    kind: 'sfx',
    description: "one soft padded footfall (carpet step), for an animal's paw (variant 4)",
    duration: 0.15,
  },
  'whoosh-1': {
    file: 'sfx/whoosh-1.ogg',
    kind: 'sfx',
    description: 'a whoosh through the air (swung rope)',
    duration: 0.46,
  },
  'whoosh-2': {
    file: 'sfx/whoosh-2.ogg',
    kind: 'sfx',
    description: 'a quick short whoosh (swung bamboo stick)',
    duration: 0.28,
  },
  land: {
    file: 'sfx/land.ogg',
    kind: 'sfx',
    description: 'a body landing on earth after a jump, dull thud',
    duration: 0.25,
  },
  pop: {
    file: 'sfx/pop.ogg',
    kind: 'sfx',
    description: 'a small cartoon pop made with the lips',
    duration: 0.26,
  },
  sparkle: {
    file: 'sfx/sparkle.ogg',
    kind: 'sfx',
    description: 'a magic sparkle or wink, bright twinkling shimmer',
    duration: 0.81,
  },
  tap: {
    file: 'sfx/tap.ogg',
    kind: 'sfx',
    description: 'a glass set down on a wooden table',
    duration: 0.75,
  },
  knock: {
    file: 'sfx/knock.ogg',
    kind: 'sfx',
    description: 'three knocks on a light wooden door',
    duration: 0.67,
  },
  creak: {
    file: 'sfx/creak.ogg',
    kind: 'sfx',
    description: 'a wooden door creaking open',
    duration: 2.81,
  },
  splash: {
    file: 'sfx/splash.ogg',
    kind: 'sfx',
    description: 'a big splash, a heavy stone dropped into water',
    duration: 2.58,
  },
  bell: {
    file: 'sfx/bell.ogg',
    kind: 'sfx',
    description: 'one strike of a small bronze bell, ringing out',
    duration: 2.91,
  },
  boing: {
    file: 'sfx/boing.ogg',
    kind: 'sfx',
    description: 'a cartoon boing (jaw harp twang)',
    duration: 1.01,
  },
  bonk: {
    file: 'sfx/bonk.ogg',
    kind: 'sfx',
    description: 'a cartoon bonk, a low hollow drum hit for a knock on the head',
    duration: 0.68,
  },
  gulp: {
    file: 'sfx/gulp.ogg',
    kind: 'sfx',
    description: 'a nervous gulp, one hard swallow',
    duration: 0.54,
  },
  snore: {
    file: 'sfx/snore.ogg',
    kind: 'sfx',
    description: 'one snore, a sleeping man breathing in and out',
    duration: 3.97,
  },
  munch: {
    file: 'sfx/munch.ogg',
    kind: 'sfx',
    description: 'crunchy munching, chips eaten and chewed',
    duration: 2.81,
  },
  rustle: {
    file: 'sfx/rustle.ogg',
    kind: 'sfx',
    description: 'leaves rustling as something moves in a bush',
    duration: 2.82,
  },
  snap: { file: 'sfx/snap.ogg', kind: 'sfx', description: 'a dry twig snapping', duration: 0.81 },
  rope: {
    file: 'sfx/rope.ogg',
    kind: 'sfx',
    description: 'a rope creaking under strain',
    duration: 0.94,
  },
  gnaw: {
    file: 'sfx/gnaw.ogg',
    kind: 'sfx',
    description:
      'small teeth nibbling and gnawing (a rat at a cereal grain), for chewing rope or wood',
    duration: 4.18,
  },
  'slide-whistle-up': {
    file: 'sfx/slide-whistle-up.ogg',
    kind: 'sfx',
    description: 'a slide whistle sliding up (cartoon rise or jump)',
    duration: 1.19,
  },
  'slide-whistle-down': {
    file: 'sfx/slide-whistle-down.ogg',
    kind: 'sfx',
    description: 'a slide whistle sliding down (cartoon fall)',
    duration: 1.18,
  },
  'drum-roll': {
    file: 'sfx/drum-roll.ogg',
    kind: 'sfx',
    description: 'a snare drum roll ending in a rimshot',
    duration: 4.62,
  },
  applause: {
    file: 'sfx/applause.ogg',
    kind: 'sfx',
    description: 'applause from a small audience of 25 to 50 people',
    duration: 7.98,
  },
  cheer: {
    file: 'sfx/cheer.ogg',
    kind: 'sfx',
    description: 'a medium crowd cheering, clapping and whooping',
    duration: 12.87,
  },
  'lion-roar-1': {
    file: 'sfx/lion-roar-1.ogg',
    kind: 'sfx',
    description: "a lion's roar, two deep full roars, close and loud",
    duration: 4.24,
  },
  'lion-roar-2': {
    file: 'sfx/lion-roar-2.ogg',
    kind: 'sfx',
    description: 'a lion roaring twice, zoo recording, slightly rougher',
    duration: 4.98,
  },
  'lion-growl': {
    file: 'sfx/lion-growl.ogg',
    kind: 'sfx',
    description: "a lion's low growls, menacing (edited and deepened from a zoo recording)",
    duration: 4.57,
  },
  'mouse-squeak-1': {
    file: 'sfx/mouse-squeak-1.ogg',
    kind: 'sfx',
    description: 'a tiny cartoon mouse squeak',
    duration: 0.42,
  },
  'mouse-squeak-2': {
    file: 'sfx/mouse-squeak-2.ogg',
    kind: 'sfx',
    description: "a real mouse's high squeak",
    duration: 0.16,
  },
  'cat-meow-1': {
    file: 'sfx/cat-meow-1.ogg',
    kind: 'sfx',
    description: 'a cat meowing',
    duration: 2.03,
  },
  'cat-meow-2': {
    file: 'sfx/cat-meow-2.ogg',
    kind: 'sfx',
    description: 'a short cat meow',
    duration: 1.6,
  },
  'dog-bark-1': {
    file: 'sfx/dog-bark-1.ogg',
    kind: 'sfx',
    description: 'one bark from an old dog',
    duration: 1.03,
  },
  'dog-bark-2': {
    file: 'sfx/dog-bark-2.ogg',
    kind: 'sfx',
    description: 'a sled dog barking a few times',
    duration: 1.68,
  },
  'bird-chirp-1': {
    file: 'sfx/bird-chirp-1.ogg',
    kind: 'sfx',
    description: "a robin's short song, bright chirps",
    duration: 1.98,
  },
  'bird-chirp-2': {
    file: 'sfx/bird-chirp-2.ogg',
    kind: 'sfx',
    description: "a blackbird's short song phrase",
    duration: 2.12,
  },
  'crow-caw': {
    file: 'sfx/crow-caw.ogg',
    kind: 'sfx',
    description: 'a crow cawing three times',
    duration: 2.02,
  },
  'owl-hoot': {
    file: 'sfx/owl-hoot.ogg',
    kind: 'sfx',
    description:
      'a tawny owl hooting at night, hoo... hoo-hoo-hoo (the pause between calls shortened)',
    duration: 2.45,
  },
  rooster: {
    file: 'sfx/rooster.ogg',
    kind: 'sfx',
    description: 'a rooster crowing, cock-a-doodle-doo',
    duration: 2.24,
  },
  'cow-moo': {
    file: 'sfx/cow-moo.ogg',
    kind: 'sfx',
    description: 'a cow mooing once',
    duration: 2.11,
  },
  'goat-bleat': {
    file: 'sfx/goat-bleat.ogg',
    kind: 'sfx',
    description: 'a goat bleating once',
    duration: 1.02,
  },
  'horse-neigh': {
    file: 'sfx/horse-neigh.ogg',
    kind: 'sfx',
    description: 'a horse neighing',
    duration: 1.65,
  },
  elephant: {
    file: 'sfx/elephant.ogg',
    kind: 'sfx',
    description: 'an elephant trumpeting, then a low rumble (zoo recording)',
    duration: 7.77,
  },
  monkey: {
    file: 'sfx/monkey.ogg',
    kind: 'sfx',
    description: 'an ape (chimpanzee) screeching, zoo recording',
    duration: 3.21,
  },
  frog: {
    file: 'sfx/frog.ogg',
    kind: 'sfx',
    description: 'a frog croaking repeatedly at night',
    duration: 3.56,
  },
  duck: { file: 'sfx/duck.ogg', kind: 'sfx', description: 'ducks quacking', duration: 4.01 },
  'bear-growl': {
    file: 'sfx/bear-growl.ogg',
    kind: 'sfx',
    description: "a black bear's angry growl, real field recording, slightly muffled",
    duration: 5.83,
  },
  'wolf-howl': {
    file: 'sfx/wolf-howl.ogg',
    kind: 'sfx',
    description: 'a wolf howling, long and clear',
    duration: 8.11,
  },
  hen: {
    file: 'sfx/hen.ogg',
    kind: 'sfx',
    description: 'a hen clucking, short alarmed clucks',
    duration: 3.18,
  },
  'bee-buzz': {
    file: 'sfx/bee-buzz.ogg',
    kind: 'sfx',
    description: 'a bee buzzing past',
    duration: 2.79,
  },
  'laugh-child': {
    file: 'sfx/laugh-child.ogg',
    kind: 'sfx',
    description: 'small children laughing',
    duration: 3.72,
  },
  'laugh-adult': {
    file: 'sfx/laugh-adult.ogg',
    kind: 'sfx',
    description: "a man's short hearty laugh",
    duration: 1.32,
  },
  gasp: {
    file: 'sfx/gasp.ogg',
    kind: 'sfx',
    description: 'a short gasp of surprise',
    duration: 0.42,
  },
  sigh: {
    file: 'sfx/sigh.ogg',
    kind: 'sfx',
    description: 'a man sighing through his mouth',
    duration: 3.4,
  },
  'cry-child': {
    file: 'sfx/cry-child.ogg',
    kind: 'sfx',
    description: 'a five-year-old child crying and wailing',
    duration: 6.41,
  },
  yawn: { file: 'sfx/yawn.ogg', kind: 'sfx', description: 'a man yawning', duration: 3.86 },
  calm: {
    file: 'music/calm.ogg',
    kind: 'music',
    description: 'calm, gentle instrumental, unhurried, for quiet everyday scenes',
    duration: 142.47,
  },
  playful: {
    file: 'music/playful.ogg',
    kind: 'music',
    description: 'playful, light and bouncy instrumental',
    duration: 94.6,
  },
  adventure: {
    file: 'music/adventure.ogg',
    kind: 'music',
    description: 'adventurous, driving instrumental with a safari feel, for journeys',
    duration: 120.25,
  },
  tense: {
    file: 'music/tense.ogg',
    kind: 'music',
    description: 'tense, suspenseful pulse, for danger and worry',
    duration: 83.05,
  },
  sad: {
    file: 'music/sad.ogg',
    kind: 'music',
    description: 'slow, soft and wistful instrumental, for sad or tender moments',
    duration: 160.3,
  },
  triumphant: {
    file: 'music/triumphant.ogg',
    kind: 'music',
    description: 'triumphant, heroic swells, for a victory or happy ending',
    duration: 78.82,
  },
  lullaby: {
    file: 'music/lullaby.ogg',
    kind: 'music',
    description: "Brahms' lullaby played on a music box, for night and sleep",
    duration: 101.31,
  },
  mysterious: {
    file: 'music/mysterious.ogg',
    kind: 'music',
    description: 'mysterious, dreamy and surreal, for magic or the unknown',
    duration: 79.89,
  },
  comic: {
    file: 'music/comic.ogg',
    kind: 'music',
    description: 'comic, whimsical tea-party romp, for silly scenes',
    duration: 63.82,
  },
  indian: {
    file: 'music/indian.ogg',
    kind: 'music',
    description:
      'Indian-flavoured live jam: sitar and flute over a tanpura drone and hand drum (djembe), slowly building; an excerpt with a fade-out',
    duration: 135.0,
  },
};
