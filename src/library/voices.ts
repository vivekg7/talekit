/**
 * The voices the TTS sidecar (tools/tts) can speak in, as `engine:name`. Kokoro's are the
 * default: Apache-licensed, fast (a line in a fraction of a second) and with Hindi as well
 * as English. Its voices are grown-ups; a child or a small animal is one of them with the
 * pitch raised (`pitch: 3` to `5`), which is what a cartoon does anyway.
 */
export interface VoiceInfo {
  language: 'en-us' | 'en-gb' | 'hi';
  gender: 'female' | 'male';
  description: string;
}

export const VOICES: Record<string, VoiceInfo> = {
  'kokoro:af_heart': {
    language: 'en-us',
    gender: 'female',
    description: 'warm and clear; the best English narrator',
  },
  'kokoro:af_bella': {
    language: 'en-us',
    gender: 'female',
    description: 'bright, lively; a mother, an older sister',
  },
  'kokoro:af_nicole': {
    language: 'en-us',
    gender: 'female',
    description: 'soft and close, almost a whisper',
  },
  'kokoro:af_sarah': {
    language: 'en-us',
    gender: 'female',
    description: 'light, a little breathy',
  },
  'kokoro:af_sky': {
    language: 'en-us',
    gender: 'female',
    description: 'young and light; raise the pitch for a girl',
  },
  'kokoro:af_kore': { language: 'en-us', gender: 'female', description: 'even, calm' },
  'kokoro:am_michael': {
    language: 'en-us',
    gender: 'male',
    description: 'friendly, steady; a father, a teacher',
  },
  'kokoro:am_fenrir': {
    language: 'en-us',
    gender: 'male',
    description: 'deep and strong; a king, a lion',
  },
  'kokoro:am_puck': {
    language: 'en-us',
    gender: 'male',
    description: 'playful, quick; raise the pitch for a boy or a trickster',
  },
  'kokoro:am_echo': { language: 'en-us', gender: 'male', description: 'plain, middle' },
  'kokoro:am_onyx': {
    language: 'en-us',
    gender: 'male',
    description: 'low and slow; an old man, a bear',
  },
  'kokoro:am_santa': {
    language: 'en-us',
    gender: 'male',
    description: 'jolly, round; a grandfather',
  },
  'kokoro:bf_emma': {
    language: 'en-gb',
    gender: 'female',
    description: 'British, warm; a storyteller',
  },
  'kokoro:bf_isabella': { language: 'en-gb', gender: 'female', description: 'British, crisp' },
  'kokoro:bf_lily': { language: 'en-gb', gender: 'female', description: 'British, young' },
  'kokoro:bm_george': {
    language: 'en-gb',
    gender: 'male',
    description: 'British, mature; a narrator, a wise old owl',
  },
  'kokoro:bm_fable': {
    language: 'en-gb',
    gender: 'male',
    description: 'British, expressive; a fox, a schemer',
  },
  'kokoro:bm_lewis': { language: 'en-gb', gender: 'male', description: 'British, deep' },
  'kokoro:hf_alpha': {
    language: 'hi',
    gender: 'female',
    description: 'Hindi, clear; a narrator, a mother',
  },
  'kokoro:hf_beta': {
    language: 'hi',
    gender: 'female',
    description: 'Hindi, lighter; raise the pitch for a girl',
  },
  'kokoro:hm_omega': {
    language: 'hi',
    gender: 'male',
    description: 'Hindi, deep; a king, a lion, a father',
  },
  'kokoro:hm_psi': {
    language: 'hi',
    gender: 'male',
    description: 'Hindi, lighter; raise the pitch for a boy or a mouse',
  },
};
