/**
 * A character seen end-on: walking straight into the screen, its back to the viewer, or out
 * of it, face to the viewer. A person turns its own parts round for that (`Rig.turn`); an
 * animal on its side-on rig cannot, so it may give whole drawings of itself from behind and
 * from the front (`Character.ends`), in the same box as the side view, and the engine draws
 * one while a walk or a run goes mostly up or down the screen (`ActorState.view`).
 *
 * The engine walks the drawing: its `legL` and `legR` (the legs on the left and the right of
 * the picture) lift in turn on the gait's own beat, so they land when the side view's legs
 * would and the footsteps and prints still fall on them; the rest bobs a little on each
 * step and the whole rocks over the planted foot; a part with a pivot (a tail, ears) sways
 * about it. Going into an end view and out of it, the drawing narrows through the swap, as a
 * turn does.
 */
import { clamp01, easeInOut } from './easing.js';
import { gaitPhase, legFalls } from './gait.js';
import { DEFAULT_LINE_COLOR, OUTLINE_PX, outlineFor } from './outline.js';
import { rigOf, type Rig } from './rigs.js';
import { shadePart, type Light } from './shade.js';
import { applyColors, n, spanAt } from './svg.js';
import type { Character } from './types.js';

export type End = 'back' | 'front';

/** How far into the screen (or out of it) a move has to go before the end drawing shows. */
const END_AT = 0.5;
/** The narrowest the drawing gets through the swap, as a share of its width. */
const NARROWEST = 0.45;
/** Share of a leg's cycle on the floor; the rest it is up, swinging forward. */
const STANCE = 0.55;
/** How high a foot lifts, and how much the body bobs and rocks, as shares of the rig. */
const LIFT = { walk: 0.07, run: 0.12 };
const BOB = 0.018;
const ROCK = 2.5;
/** Degrees a part with a pivot (a tail) sways either way over a stride. */
const SWAY = 9;
/** The parts that face the viewer, left unshaded as on the side view. */
const FACE = new Set(['face', 'eyes', 'mouth', 'nose']);

/** The end drawing a character shows at `view` (-1 into the screen .. 1 out of it), if any. */
export function endOf(character: Character, view: number): End | undefined {
  if (!character.ends || Math.abs(view) < END_AT) return undefined;
  const end: End = view < 0 ? 'back' : 'front';
  return character.ends[end] ? end : undefined;
}

/**
 * The drawing's width through the swap between the side view and an end view, as a share:
 * narrowing to NARROWEST as the side view turns away, widening again as the end one comes
 * round. 1 for a character without the end drawing it is turning to.
 */
export function endSquash(character: Character, view: number): number {
  const a = Math.abs(view);
  if (!character.ends?.[view < 0 ? 'back' : 'front'] || a === 0) return 1;
  const u = a < END_AT ? a / END_AT : (1 - a) / (1 - END_AT);
  return 1 - (1 - NARROWEST) * easeInOut(clamp01(u));
}

/**
 * The rig leg whose step each side of an end drawing keeps. From behind, the picture's left
 * is the animal's own left (the far legs, `…L`); from the front, its right. An animal shows
 * its hind legs from behind and its forelegs from the front.
 */
function legOf(rig: Rig, end: End, side: 'legL' | 'legR'): string {
  const own = (side === 'legL') === (end === 'back') ? 'L' : 'R';
  if (rig.name === 'quadruped') return `leg${end === 'back' ? 'B' : 'F'}${own}`;
  return `leg${own}`;
}

/** The side of the picture an end drawing puts a rig leg's foot on: -1 left, 1 right. */
export function endSide(end: End, leg: string): -1 | 1 {
  const own = /L$/.test(leg) ? -1 : 1;
  return (end === 'back' ? own : -own) as -1 | 1;
}

/** How high a foot is off the floor at `phase` of the cycle, for a leg landing at `land`. */
function lift(phase: number, land: number): number {
  const u = (((phase - land) % 1) + 1) % 1;
  return u < STANCE ? 0 : Math.sin((Math.PI * (u - STANCE)) / (1 - STANCE));
}

/** How far out from the middle each foot of an end drawing is, in the rig's units. */
export function endFeet(character: Character, end: End): { legL: number; legR: number } {
  const rig = rigOf(character);
  const parts = character.ends?.[end]?.parts ?? {};
  const mid = rig.width / 2;
  const at = (name: 'legL' | 'legR', guess: number) => {
    const svg = parts[name];
    const run = svg && spanAt(svg, rig.height - 4, guess);
    return run ? (run[0] + run[1]) / 2 - mid : guess - mid;
  };
  return { legL: at('legL', mid - 0.12 * rig.width), legR: at('legR', mid + 0.12 * rig.width) };
}

/**
 * The end drawing, walked: in the character's box, like `characterBody`. `loco` and the
 * travel's `phase` (0..1 through the gait's cycle) move the legs; standing, it is still.
 */
export function endBody(
  character: Character,
  end: End,
  loco: string,
  phase: number | undefined,
  light: Light | null
): string {
  const view = character.ends?.[end];
  if (!view) return '';
  const rig = rigOf(character);
  const line = character.colors.line ?? DEFAULT_LINE_COLOR;
  const walking = phase !== undefined && (loco === 'walk' || loco === 'run');
  const falls = walking ? legFalls(rig, loco as 'walk' | 'run') : {};
  const up = walking ? LIFT[loco as 'walk' | 'run'] * rig.height : 0;
  const p = phase ?? 0;
  const cx = rig.width / 2;
  const bob = walking ? -BOB * rig.height * (0.5 - 0.5 * Math.cos(4 * Math.PI * p)) : 0;
  // The house pen, as on the side view (actor.ts `outlineWidth`).
  const width = OUTLINE_PX / (character.height / rig.height);
  let out = '';
  for (const [name, raw] of Object.entries(view.parts)) {
    const svg = applyColors(raw, character.colors);
    let tf = '';
    if (name === 'legL' || name === 'legR') {
      const land = falls[legOf(rig, end, name)] ?? (name === 'legL' ? 0 : 0.5);
      const h = walking ? lift(p, land) * up : 0;
      if (h) tf = `translate(0 ${n(-h)})`;
    } else {
      const pivot = view.pivots[name];
      const sway = pivot && walking ? SWAY * Math.sin(2 * Math.PI * p + Math.PI / 2) : 0;
      tf = [
        bob ? `translate(0 ${n(bob)})` : '',
        sway ? `rotate(${n(sway)} ${pivot![0]} ${pivot![1]})` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
    const under = character.outline
      ? outlineFor(svg, line, FACE.has(name) ? width / 2 : width)
      : '';
    const shade =
      light && character.shade && !FACE.has(name) ? shadePart(svg, 0, 1, light, rig, line) : '';
    out += `<g class='part-${end}-${name}'${tf ? ` transform='${tf}'` : ''}>${under}${svg}${shade}</g>`;
  }
  // Rocking over the planted foot: toward the side whose hind (or fore) leg is down.
  const rock = walking ? ROCK * Math.sin(2 * Math.PI * p) : 0;
  return rock ? `<g transform='rotate(${n(rock)} ${cx} ${rig.height})'>${out}</g>` : out;
}

/** The phase of an actor's gait now, for an end drawing's legs: undefined when not walking. */
export function endPhase(
  character: Character,
  loco: string,
  travel: Parameters<typeof gaitPhase>[2] | undefined
): number | undefined {
  if ((loco !== 'walk' && loco !== 'run') || !travel) return undefined;
  return gaitPhase(rigOf(character), loco, travel);
}
