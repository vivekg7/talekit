/**
 * The speech check: whether a voiced take says its line (docs/PLAN.md, phase 8.1).
 *
 * A take is heard by speech recognition (src/project/hear.ts) and compared with its text
 * here. Recognition spells Hindi loosely (ध for द, short vowels for long, a nasal dropped),
 * so both are first reduced to a skeleton of the sounds a listener would call the same
 * word. What is left wrong is a take that skips words, babbles past its end, or garbles a
 * stretch: a run of sounds missing or extra, or too much of it wrong.
 *
 * Measured on 500 takes from the released films (whisper large-v3-turbo): heard whole, 4
 * were judged wrong, 3 of them cleared when heard again in pieces (hear.ts), and the last
 * says क्यारियाँ twice. Takes cut short or of another line were at least 0.32 wrong, with
 * runs of 4 and more.
 */

/** How a take compares with its line. */
export interface TakeMatch {
  /** Share of the line's skeleton heard wrong (substituted, missing or extra). */
  err: number;
  /** The longest run of the line's sounds not heard: a skipped word. */
  missing: number;
  /** The longest run of sounds heard that the line does not have: babble, a repeat. */
  extra: number;
}

/** A run this long, missing or extra, is about a word. */
const RUN = 4;
/** More of the line wrong than this is a garbled take. */
const ERR = 0.3;
/**
 * A line shorter than this (in skeleton sounds) gives recognition little to go on ("शाबाश,
 * अर्जुन!" alone is heard "शबस्ट आरचुन"), so only more wrong than ERR_SHORT counts.
 */
const SHORT = 12;
const ERR_SHORT = 0.6;

/** One to a hundred in Hindi: recognition writes सौ as 100. */
const HINDI_NUMBERS = (
  'एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस ' +
  'इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस ' +
  'पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस ' +
  'सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ ' +
  'इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर ' +
  'पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी ' +
  'सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे ' +
  'निन्यानवे सौ'
).split(' ');

/** A number as it is said in Hindi, up to the lakhs; as written when it is not one of those. */
function hindiNumber(n: number): string {
  const say = (k: number): string => (k <= 100 ? HINDI_NUMBERS[k - 1] : String(k));
  if (!Number.isInteger(n) || n < 1) return String(n);
  if (n <= 100) return say(n);
  if (n % 100000 === 0 && n / 100000 <= 100) return `${say(n / 100000)} लाख`;
  if (n % 1000 === 0 && n / 1000 <= 100) return `${say(n / 1000)} हज़ार`;
  if (n % 100 === 0 && n / 100 <= 10) return `${say(n / 100)} सौ`;
  return String(n);
}

/** Half of a nasal consonant before another consonant: written as an anusvara too. */
const NASAL_HALF = /[नमणङञ]्(?=[क-ह])/g;

/** The line as plain letters: no punctuation or spaces, one spelling for each sound. */
function normalise(text: string): string {
  return (
    text
      .normalize('NFD')
      // A nukta (ज़ = ज) and a chandrabindu (= anusvara); the half n of हन्स (= हंस).
      .replace(/़/g, '')
      .normalize('NFC')
      .replace(/ँ/g, 'ं')
      .replace(NASAL_HALF, 'ं')
      .replace(/ॉ/g, 'ा')
      .replace(/ऑ/g, 'आ')
      // The avagraha of a drawn-out sound (ढेंचूऽऽऽ) is said, not a sound of its own.
      .replace(/\u093d/g, '')
      .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]/gu, '')
  );
}

/**
 * Sounds folded together that recognition spells either way, as pairs: the aspirates onto
 * the plain stops and the retroflex onto the dental (whisper writes ढेंचू as धेंचू), the
 * sibilants onto स, long vowels onto short, व onto ब.
 */
const FOLD = new Map(
  ['खक', 'घग', 'छच', 'झज', 'ठत', 'ढद', 'टत', 'डद', 'थत', 'धद', 'फप', 'भब', 'शस', 'षस', 'णन', 'ङन']
    .concat(['ञन', 'ऋर'])
    .concat(['\u0943र', 'ीि', 'ूु', 'ईइ', 'ऊउ', 'ैे', 'ौो', 'ऐए', 'औओ', 'वब', 'ॅे'])
    .map((pair) => [pair[0], pair.slice(1)] as const)
);
/** Dropped: the anusvara, the virama, the visarga and the short vowel signs. */
const SILENT = new Set(['\u0902', '\u094d', '\u0903', 'ि', 'ु']);

/** The sounds of a line, as a listener would tell words apart. */
export function skeleton(text: string): string {
  return [...normalise(text)]
    .map((c) => FOLD.get(c) ?? c)
    .filter((c) => !SILENT.has(c))
    .join('');
}

type Op = '=' | 's' | 'd' | 'i';

/** The edit script from a to b: kept, substituted, deleted (in a only), inserted (in b only). */
function edits(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const D = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(
        D[i - 1][j] + 1,
        D[i][j - 1] + 1,
        D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  const out: Op[] = [];
  let i = n;
  let j = m;
  while (i || j) {
    const same = i && j && a[i - 1] === b[j - 1];
    if (i && j && D[i][j] === D[i - 1][j - 1] + (same ? 0 : 1)) {
      out.push(same ? '=' : 's');
      i--;
      j--;
    } else if (i && D[i][j] === D[i - 1][j] + 1) {
      out.push('d');
      i--;
    } else {
      out.push('i');
      j--;
    }
  }
  return out.reverse();
}

/** The longest run of `kind`, a substitution carrying on a run already begun. */
function longest(ops: Op[], kind: Op): number {
  let best = 0;
  let cur = 0;
  for (const o of ops) {
    cur = o === kind || (o === 's' && cur > 0) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/** How what was heard compares with the line. */
export function matchTake(line: string, heard: string): TakeMatch {
  // A Hindi line's numbers are words: say back what recognition wrote as digits.
  if (/[\u0900-\u097f]/.test(line))
    heard = heard.replace(/\d[\d,]*/g, (d) => ` ${hindiNumber(Number(d.replace(/,/g, '')))} `);
  const a = [...skeleton(line)];
  const b = [...skeleton(heard)];
  const ops = edits(a, b);
  const wrong = ops.filter((o) => o !== '=').length;
  return {
    err: Math.round((wrong / Math.max(1, a.length)) * 1000) / 1000,
    missing: longest(ops, 'd'),
    extra: longest(ops, 'i'),
  };
}

/** Whether a take does not say its line. */
export function badTake(line: string, m: TakeMatch): boolean {
  if (m.missing >= RUN || m.extra >= RUN) return true;
  return m.err > ([...skeleton(line)].length < SHORT ? ERR_SHORT : ERR);
}

/** Lower is better: for keeping the best of several takes. */
export const takeScore = (m: TakeMatch): number => m.err + 0.05 * Math.max(m.missing, m.extra);

/** The language recognition listens for: Hindi for a Hindi voice (h…), else English. */
export const speechLanguage = (voiceName: string): string =>
  voiceName.startsWith('h') ? 'hi' : 'en';
