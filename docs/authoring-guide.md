# talekit authoring guide

Goal: good-quality short 2D films and portrait reels made from a story.
talekit owns the animation; you own design and staging. This guide is the
file-format contract for what you write (characters, scenes, shots: JSON,
validated). Every write returns a picture: look at it and fix what looks
wrong before moving on.

## Workflow

1. **Plan** characters, locations and 6–40 shots of 5–20 s (a shot = one
   location, one bit of action). Unless asked for only one, deliver the
   landscape film (`out/movie.mp4` + `out/movie.mkv`) and the portrait reel
   (`out/movie.mp4`), a separate project beside it (`…` and `…-reel`, see
   [A reel](#a-reel-the-portrait-version)) made afterwards from the film's
   characters and voices. Each gets a cover and post text (step 8).
2. **`create_project(path, title)`** once (absolute `path`, taken by every
   later tool), then `list_library()` and `set_audio(path, narrator,
music)` ([Sound](#sound)).
3. **Characters.** Prefer `copy_from_library(path, libraryId, asId, name,
colors)` (tokens such as hair, skin, dress; without `name`, `old-man` is
   named "Old man"). `write_character(path, character)` only what the
   library lacks, after reading `get_library_item` for one on the same rig.
   It returns the pose sheet (proportions, expressions, variant fallbacks)
   and the construction sheet (part boxes, pivots, silhouette, joints in a
   swing, a numbered red box per numbered warning): rewrite until it looks
   right and the warnings are gone. A copy returns only the pose sheet.
   Every speaker needs a `voice` from `list_voices`.
4. **Scenes.** `copy_from_library` or `write_scene(path, scene)`, then read
   the anchor sheet: every place someone stands or sits needs a floor
   anchor. The library's jungle, cave, village hut and pond (tall for
   reels: `cave-tall`, `courtyard-tall`, `forest-tall`, `fields-tall`) are
   painted in detail: copy one and add places with `anchors`
   (`{ "well": { "x": 420, "y": 660 } }`, which also moves a same-named
   anchor) rather than painting anew.
5. **Shots.** `write_shot(path, shot, order)` one at a time, in order;
   check the contact sheet (positions, facing, bubbles, timing). Sheets are
   small; `preview_frame(path, shotId, t)` and `preview_shot(path, shotId,
frames)` are full size. Fix with `patch_shot(path, shotId, …)`: `edit`
   merges fields into an action by index (`{ index: 3, fields: { t: 4.5 }
}`, null removes a field), `remove`, `add`, `set` replaces top-level
   fields (`duration`, `camera`, `cut`, `allow`; null drops one), `cast`
   replaces, adds or (null) removes members. Indices are pre-patch, as
   `get_item` lists them. It validates like `write_shot`, keeps the shot's
   place and returns a sheet of the changed stretch.
6. **`render(path, shotId?)`** one shot early to check motion. Before the
   whole film run [the critic](#the-critic) (`critique` without a shot,
   then per shot). A full render returns a film sheet and, unless a reel,
   `out/movie.mkv` ([Subtitles and the .mkv](#subtitles-and-the-mkv)).
   Render the reel likewise.
7. **Review.** `open_review([film, reel])` (shell: `talekit serve <film>
<reel> --open`) serves all from one server, each at `…:4848/<folder>/`,
   and opens the first; with several, the root lists them as cards and
   headers step with ‹ ›. Give the person the addresses; `lan: true` only
   if they ask to review on a phone. They note a character, scene or
   moment, and pick [options](#options-and-samples). When `project_info`
   reports open notes or you are asked to fix notes, `list_notes(path)`
   gives each with its picture: `at (x, y)` is the clicked spot in frame
   pixels, ringed; `reopened: …` means a fix missed and the first ask still
   stands; `looking at option q:c` was written with that choice on;
   `picked c` is a pick. Fix, check the picture, `resolve_note(path, id)`.
   Never resolve a note you did not act on; say why.
8. **Cover and post text**, in `out/`. `talekit cover <dir> <shotId> -t
<sec> --title "…" [--sub "…"] [--tag "…"] [--zoom 1.3 --focus x,y]
[--quiet]` writes `out/thumbnail.png` (command kept in
   `out/thumbnail.txt`): 1280 × 720 for a film (title on the left third:
   action right of centre), 1080 × 1920 for a reel (title near the top,
   inside the 3:4 profile-grid crop). Pick the funniest or most dramatic
   moment, not the title card. `--sub` is a small line above the title,
   `--tag` a moral or hook on a red tag, `--zoom` pushes in about scene
   point `--focus`, `--quiet` hides bubbles and captions. `--banner` draws
   a 2560 × 1440 YouTube banner (`out/banner.png`) instead: words in the
   1546 × 423 middle, no bubbles or captions; a low `--focus` with `--zoom`
   lifts the cast into it.
   `out/youtube.txt` (both): title on line 1 (≤ 100 characters), blank
   line, description: 2–4 sentences teasing the turn without the ending,
   the moral, chapters (film only), hashtags, in the film's language and
   English. `out/instagram.txt` (reel): the same teaser and moral, a line
   pointing to the full film on YouTube, a few hashtags, no `#Shorts`, no
   chapters. Plain text: no `**` or `#` headings, one line per paragraph,
   each hashtag once. Chapters: a "Chapters" line, then `0:00 name` lines
   from 0:00, at least three, each ≥ 10 s. `talekit check` lints both
   (including a line starting on a vowel sign: a Devanagari paste that lost
   its first letter).

### Writing it from scripts: the Python kit

Keep a film as scripts in the project's `src/` that write the JSON. Copy
`kit/templates/cast.py` and `kit/templates/shots.py` there (stdlib only;
outside the repo run with `PYTHONPATH=<talekit>/kit`). Learn the kit from
`python3 kit/talekit/api.py` (signatures, docstrings, table keys like
`BEARDS`, `TILAK`, `LOOKS`; ~5k tokens; `api.py people` one module,
`api.py beard` matching names), not the sources (`people.py` is ~25k
tokens). Open a function body only when its docstring is not enough.

- **`talekit.people`**: the humanoid wardrobe. Heads `short_hair`,
  `side_part`, `spiky_hair`, `curly_hair`, `head_band`, `pagdi`,
  `tall_pagdi`, `safa`, `plumed_turban`, `crown`, `shaven_head` (shikha,
  sage's fringe or `locks`, student's stubble), women's `bun` (gajra, or
  sari over it), `plait`, `two_plaits` (swinging parts); torsos `kurta`
  (`long=330` to the knee), `banyan`, `bare_chest` (over a dhoti's waist
  wrap), `tunic`, `angrakha`, `sari`, `choli`, `kameez`, with `gamchha`,
  `angavastram`, `dupatta`, `mala`, `janeu` laid over; arms
  `blouse_sleeves` (bangles); legs `dhoti`, `pyjama`, `churidar`,
  `sari_skirt`, `ghagra`; feet incl. `khadau`; `face`/`eyes`/`mouth` with
  every variant (long beard, bindi, nose ring, glasses, lashes, lips).
  `person()` assembles and sets `hem`; `head_scale=1.18` for a child. Add
  what is missing to the wardrobe unless a one-off.
- **`talekit.characters`**: `character()`, `prop()` (simple rig, `body`
  variants such as `broken`). A missing `<x>Dark`/`<x>Light` is shaded from
  `<x>`; an unset token stops the script by name.
- **`talekit.shots`**: `Film` writes `shots/NN-<id>.json` in order.
  `F.after(t, line)` is when the next line can start, from the real voice
  once `talekit voice` ran, else an estimate: run, voice, run again. A
  reply timed `after(0.4)` is written as the format's `after`. Builders
  `say`, `cap` (English 4th argument, omitted in a reel), `do`, `at`, `cam`
  …; stock pieces `seated`, `attach`, `pickup`, `putdown`, `release`,
  `smash` (held prop falls, breaks, sounds), `keep` (variant carried into
  the next shot).
- **`talekit.scenes`**, **`talekit.svg`**: painting helpers (`blob`,
  `canopy`, `tufts`, `ribbon`, `taper`, `gem`), area helpers (see
  [Where things can stand](#where-things-can-stand-walk-water-climb-solids)),
  the scene writer.

The output is the same JSON: check every sheet and run `talekit check`.

## Coordinate boxes

Characters are drawn in a fixed box facing **right**; the engine scales it
to `height` px, puts its bottom-centre on the anchor and mirrors it for
`facing: "left"`. L is the far side, R the near side.

### `humanoid` rig — 200 wide × 400 tall, feet on y=400

```
 y   0 ─┬─ top of box (hair/hat)
        │   head: circle around (100, 88) r≈62   (kid)   or (100, 96) r≈54 (adult)
 y 152 ─┼─ NECK pivot (100,152): head rotates here
 y 170 ─┼─ SHOULDERS: armL pivot (76,170), armR pivot (124,170)
 y 226 ─┼─ ELBOWS: (73,226), (127,226); arms bend here to walk, run, wave
        │   torso: shoulders → hips (x 60..140)
 y 272 ─┼─ HIPS: legL pivot (86,272), legR pivot (114,272)
 y 330 ─┼─ KNEES: (86,330), (114,330); legs bend here to sit
        │   legs hang straight down, feet/shoes at y 384..400
 y 400 ─┴─ FEET LINE (anchor point is (100,400))
```

Draw order (back → front): `armL`, `legL`, `legR`, `torso` (required),
extras, `head`, `face`, `eyes`, `mouth`, `armR` (near arm: waves, points).
A `hangs` part draws next to its parent; one hung behind the head (a
plait) goes behind the torso while walking toward the viewer.

Library: `kid` (girl), `boy`, `grownup` (man), `woman` (kurta, plait),
`farmer` (pagdi, dhoti), `grandpa` (bald, glasses, waistcoat), `grandma`
(sari), `pirate` (eye patch, peg leg). Recolour the nearest before drawing.

- **`hem`**: the torso ends about y=292; a kurta, coat or dress drawn lower
  gives its hem y (grandpa: 324) so sitting rests it on the floor or over
  a seat edge (the check flags > 5 out). A skirt drawn on the legs bends
  with the knees; a peg leg below the knee works like a shin. `eyes` draws
  over `face`, so an eye patch goes in every `eyes` variant.
- **Face front-on; the engine turns it.** `face` (nose, cheeks, freckles,
  glasses: all but eyes and mouth), `eyes`, `mouth`: looking straight out,
  centred on x=100 inside x 64..136. The engine slides them 22 units to the
  facing side, narrows them to 0.8, and brings them front-on in a turn.
  Detail drawn in `head` stays put. Draw the rest of the head
  three-quarters (hair, ear or bow on the far/left side only; collar or
  buckle a little right of centre); the torso front-on (narrowed to 0.88,
  turned nearly side-on when walking).
- **Give `head` and `torso` a `back`** (`{ "default": "…", "back": "…" }`:
  back of the head with hair, both ears or pigtails; torso without collar
  or buttons). Walking into the screen (more up than across) face parts
  hide and `back` variants draw; without one the head shows a blank face
  (fine only for a bald character). Walking out of the screen the face
  turns to the viewer and limbs foreshorten.
- **Legs bend at y=330, arms at y=226**: the lower half turns under a
  round joint as wide as the stroke. Draw each limb as one straight stroke
  from its pivot ([Construction](#construction)), hand or shoe at the end,
  sock or shoe below the knee; a sleeve may cross the elbow.
- Detail where cloth folds (behind the knee, over the shoe, a bloused
  shirt); leave thin bare limbs plain (a crease on a 16-unit stroke reads
  as a scratch).
- **Swinging hair is its own part**, hung from the head where tied and
  listed in `springs` ([Springs](#springs)); keep the band on the head.
- The neck is in the torso, reaching ≥ 12 units into the head; the torso
  ends ≥ 12 units below the hips.

### `quadruped` rig — 260 wide × 200 tall, feet on y=200

Library: dog, cat, rabbit, deer, lion, tiger, bear, fox, jackal,
crocodile, mouse. Recolour one if you can; read `get_library_item("dog")`
before drawing.

```
 y   0 ─┬─ top of box (ear tips, antlers)
 y  46 ─┼─ EARS: earL pivot (204,46), earR pivot (220,46), both behind the head
        │   head: circle around (210,70) r≈32, muzzle out to x≈255
 y 108 ─┼─ NECK pivot (196,108): the head part, neck included, turns here
 y 110 ─┼─ TAIL pivot (44,110), at the rump
        │   body: rump x≈42 … chest x≈212, y≈90 … 152; turns about the hips (72,132)
 y 132 ─┼─ HIPS: legBL (66,132), legBR (82,132)
        │  SHOULDERS: legFL (178,132), legFR (194,132)
 y 166 ─┼─ KNEES: halfway down each leg, at its pivot's x
        │   legs hang straight down
 y 200 ─┴─ FEET LINE (anchor point is (130,200))
```

Draw order: `legBL`, `legFL`, `tail`, `body` (required), extras, `legBR`,
`legFR`, `earL`, `earR`, `head`, `eyes`, `mouth`. Legs, tail and head hang
from the body (they follow its tip for `sit` and the gallop's rock); ears
and face hang from the head.

- **`belly`**: the underside's y, default ~152, which `lie` puts on the
  floor (slender deer 140, round rabbit 166; the check flags > 5 out).
  `"hooves": true` (deer, goat, horse) folds the forelegs under the chest
  lying, instead of paws out. Low animals still stand on y=200.
- **`"sprawl": true`** for reptiles (crocodile, lizard, tortoise): drawn
  low, belly just off the floor, short legs splayed at knee and elbow
  (hind knee forward, elbow back). It walks in short quick steps, feet
  flat; `sit`/`lie` lower the belly level (never rears or sits on
  haunches). Set its legs' `pivots` and `bends`
  ([Pivots and chains](#pivots-and-chains)), each knee within ~10 of
  straight under the hip. The library crocodile is the example.
- **`muzzle`** (default [240, 100]): the mouth, where a carried prop hangs
  and what `eat` lowers to the grass. A head up a long neck (camel,
  giraffe; neck drawn in the head part) gives it (`"muzzle": [248, 47]`)
  and `eat` bows the neck as far as needed (library animals: 44°). A mouth
  already low or out of reach of any bow (a crocodile's jaw) only nods;
  lying, `eat` nods less.
- **Legs**: round-capped strokes straight down from the pivot
  (`<path d='M194 132 L194 189' stroke='{fur}' stroke-width='18'
stroke-linecap='round' fill='none'/>`), paw or hoof reaching y=200, on
  the pivot's x below the knee (y=166) or the bend notches. Short legs
  still start at the pivot. A deep chest and rump cover every pivot by 12
  units. Far legs a shade darker.
- **Near legs join the body without a line**. Lying, a paw animal's near
  hind leg is drawn whole, folded on the flank, foot flat. Form: a tapered
  `{line}` crease down the thigh front, open at the top; a hind haunch ends
  a few units above the knee; the hock is a bump behind the leg above the
  knee with a short tapered line down the heel (the near foreleg gets the
  same at the elbow), drawn after the leg's stroke, below neck and mane.
- **Head** includes the neck as a thick stroke from inside the chest (no
  line where it sinks in). Muzzle inside x ≤ 260.
- **Ears** behind the head, from ≥ 12 units below its edge to the tip,
  covering the pivot; a floppy ear may hang past the back of the head.
- **Tail** starts inside the rump, covering (44,110); may curve anywhere.
- **Face**: one profile eye (white, iris, highlight), a mouth under the
  muzzle, the usual variants.

It walks in diagonal pairs, gallops for `run`, turns in ~0.7 s (a person
0.2 s). Tail and ears are springs and the tail a chain by default.
`height`: mouse ~55, cat or dog 90–110, lion, bear or deer 170–190.

### `simple` rig — 200 × 200, base on y=200

A required `body` plus optional `eyes` and `mouth`: birds, fish, vehicles,
kites, balls, blob monsters, props. The engine bobs and tilts it for
walk/run, hops it for `bounce`, wobbles it for `fly`, rotates it for
`spin`, leans it toward its facing for `point` (set `facing` first), shivers it for `tremble`,
settles it lower and wider for `lie`; `wave`, `nod`, `shake` only tilt or
nudge. All rigs breathe when idle, less above 400 px tall, so a
frame-filling board (`height` 1000+) stays still.

```
 x   0 ──────────── 200
 y 0 ┌──────────────┐
     │   (tail)  head│   faces RIGHT: head and face in the right half, around
     │  ╭──────╮ ◠ ◡ │   x 130–190; tail or back on the left. The engine
     │  │ body │(eyes│   mirrors the whole box for facing: "left".
     │  ╰──┬┬──╯mouth│
 y200└────┴┴────────┘   base line y=200: feet, wheels or base touch it.
```

`body` is one group (wings, tail, head drawn in); `eyes`: `open`,
`closed`, `wide`, `happy`; `mouth`: `closed`, `open`, `smile`, `sad` (a
beak is a mouth). Head near the top, where bubbles hang. Worked example:
`get_library_item("bird")`; also `crow`, `parrot`, `swan` (no feet),
`frog`, `fish` (tail a hung spring), a rigid `cobra` (open mouth shows
fangs). `height`: bird 50–80, prop or small creature 80–140.

**Wings that beat**: draw each wing as its own part spread at mid-beat
(back and a little up), hung from the body at the shoulder (near wing
`"front": true`), listed in `flaps`. During `fly` they beat ~40° either
side, downstroke quicker, body lifting each beat. `spread`/`folded`
variants show in the air / otherwise (a `face` action overrides). To hover,
a short, slow `fly`.

```json
"hangs": {
  "wingFar": { "from": "body", "at": [96, 118] },
  "wingNear": { "from": "body", "at": [104, 122], "front": true }
},
"flaps": ["wingNear", "wingFar"]
```

**End-on views (`ends`)**: for animals walking up or down the screen in a
top-down scene (a maze, a yard). Whole drawings in the same box and base
line: `back` (walking up) and `front` (walking down, facing the viewer).
On mostly vertical legs of a walk or run the engine swaps to them
(narrowing through, like a turn): `legL`/`legR` (the picture's left and
right legs) lift in turn, the rest bobs, a part with a pivot (tail root)
sways, pawprints fall in two tracks. Parts draw in the order given (legs
before body). People need none. The pose sheet shows each view.

```json
"ends": {
  "back": { "parts": { "earL": "…", "earR": "…", "head": "…", "legL": "…", "legR": "…", "body": "…", "tail": "…" }, "pivots": { "tail": [130, 172] } },
  "front": { "parts": { "tail": "…", "legL": "…", "legR": "…", "body": "…", "head": "…", "eyes": "…" } }
}
```

### Variants

A part can be a map of named SVG fragments. The engine picks:

| part    | variants the engine looks for                                                        |
| ------- | ------------------------------------------------------------------------------------ |
| `mouth` | `closed` (rest), `open` (talking flap, surprised), `smile`, `sad`, `angry`, `scared` |
| `eyes`  | `open`, `closed` (blink), `wide` (surprised/scared), `happy`, `sad`, `angry`         |

A missing variant falls back along the list (angry eyes → open, scared
mouth → open → closed); the pose sheet labels it (`angry · eyes→open`).
Always draw `mouth.open` and `eyes.closed`. `""` draws nothing (a closed
beak drawn in the body) if some variant draws. Other parts may have
variants (`body: { dark, lit }`), set by a `face` action
(`{ "face": { "hat": "tilted" } }`).

### Springs

`springs`: parts that swing behind the motion (tail, ears, plaits).
Quadruped default `["tail", "earL", "earR"]`, other rigs none; `[]` for
rigid. A rig part turns about its pivot; an unknown, unhung part sways a
few units in place. Only weather `wind` drives springs from a shot
(downwind, gusting; a part held out along the wind is not turned). The
construction sheet marks springs `~`; the pose sheet shows them at ±28°,
where a shallow-rooted tail comes off the rump.

`hangs` places a part the rig lacks: `from` (its parent part) and `at`
(the point it turns about); drawn just behind the parent (`"front": true`:
in front). Draw it hanging from `at`, reaching into the parent (linted).
Hung parts may hang from hung parts.

```json
"hangs": {
  "pigtailL": { "from": "head", "at": [31, 103] },
  "pigtailR": { "from": "head", "at": [172, 105] }
},
"springs": ["pigtailL", "pigtailR"]
```

### Pivots and chains

A rig part turns about the rig's pivot wherever you drew its joint; give
`pivots` when yours differs (a crocodile tail leaves the body at ~(90,
157), not (44, 110)); hung parts set theirs in `hangs`. Legs drawn
shorter or lower take `pivots` (hip, shoulder) and `bends` (knee, elbow; quadruped default y 166):
`"bends": { "legBR": [124, 181] }`. Arms need `bends` only for an elbow
above or below y 226: the engine bends a wide or narrow arm about its drawn
middle with a joint as wide as the arm. A limb wider at the joint than its
round joint, or off-centre from a joint you gave, shows the cut's corners;
the check gives the `bends` that centres it.

`chains` bends a part along its length in links (round joints, the turn
shared out, more at the root; a spring's swing runs down like a whip). A
number cuts evenly from pivot to far end along the drawing's middle; or
list the joints, root first. A tail on the floor curls along it. What hangs
from a chain part (eyes, mouth, a prop in the mouth) follows its last link.
Quadruped tail default: 4; `1` is stiff. A two-link head bows from both
joints: put the upper joint behind the eye. A hung tail can chain too. A
tail looping back on itself needs its joints listed along the curl, or
stays stiff.

```json
"pivots": { "tail": [90, 157], "head": [180, 144] },
"chains": { "tail": 4, "head": [[201, 133]] }
```

### Shadow

People and animals get a soft ground shadow (shrinks in a jump, none when
flying or carried). Simple rig: none by default; `"shadow": true` for a
grounded prop, `false` for a ghost or reflection. Lights add cast shadows
([Lights and cast shadows](#lights-and-cast-shadows)).

### Colours

`colors` maps token → colour, used as `{skin}`, `{hair}` in part SVG; an
undefined token is an error. Define `line` (outline colour) to use
`{line}`.

## Drawing style

An **outlined cartoon**: flat, bold, round colour shapes with a dark line.
The library characters are the bar; read one before drawing.

- **No outlines**: the engine outlines every part (same screen width for
  all, thinner on `eyes`/`mouth`, `colors.line`, default `#2e2633`); shapes
  in one part merge; overlapping parts get a line where they cross; a
  quadruped's head and near legs join the body. `"outline": false` only
  for a glow or ghost.
- **No shading**: the engine darkens each part away from the light (the
  scene's sun, else top left, or a near `fire` with a warm rim).
  `"shade": false` only for a glow or flat sign.
- **No ground shadow**.
- **Flat fills**: one base colour per area plus one darker shade for inner
  detail; no gradients. Shapes under 0.95 `opacity` and strokes under 8
  wide get no outline.
- **Inner line work** (closed mouth, brows, nose, crease): `{line}` strokes
  3–4 units, round caps.
- **Eyes**: white, dark iris toward the look, small white highlight; blink
  a curved `{line}` stroke; small animals may use a dot with highlight.
- **Simple forms**: round head, a bean body with a dipped back and deep
  chest (not a box between ellipses), tube limbs with round ends; taper
  tails and haunches as filled paths. The box shows at about half size:
  nothing readable under 6 units.

## Construction

`write_character` checks these and returns the construction sheet.

- **Nothing outside the box** (an error). Head near the top.
- **Feet on the line**: humanoid shoes at y=400, all four quadruped feet at
  y=200, simple rig's lowest point y=200 unless it flies.
- **Limbs are strokes from their pivot**: `<path d='M124 170 L130 280'
stroke='{skin}' stroke-width='18' stroke-linecap='round' fill='none'/>`
  plus a hand or shoe. Absolute box coordinates, no `transform` on outer
  elements.
- **Sink, do not touch**: limbs overlap torso or body by ≥ 12 units, as do
  neck into head and ears into it; thin pieces sink ¾ of their width; pieces inside a part sink likewise.
- **Bend where drawn**: more than 4 units past the round joint at a knee or
  elbow (a wide cuff, an arm off your `bends`) splits the joint.
- **Draw order is depth**: in a part, far side, body, near side.
- **Inner SVG only** (`<path>`, `<circle>`, `<rect>`, `<g>`…): no `<svg>`,
  `<image>` or external refs; prefix any `id` with the character's id.

## Scenes

A scene is an SVG fragment at project size (default 1280×720, a reel
720×1280) plus named **anchors**, floor points where characters stand: one
per door, chair, tree, table or path end used. An anchor's `scale` sizes
whoever stands there (`0.7` far off); leave it out when the scene has a
`perspective`. `ground` is the floor y for shortcuts `left`, `center`,
`right`, `offLeft`, `offRight` (default 0.9 × height; off is 15% of the
width past the edge, 192 px at 1280, hiding up to ~350 px wide: place
wider characters further out).

**Seats**: `sit` puts the bottom on the anchor, so a seat anchor is on the
seat surface with `floor`, the floor y under it for the feet:
`"bench-seat": { "x": 1010, "y": 604, "floor": 655 }`. Without `floor` the
spot the actor stood on is the floor, and sitting in place is sitting on
the ground. `stand` or walking off steps onto the floor in front; an
animal hops up and down. Someone standing on the seat itself (jumped or
cast there, like a branch) sits and rises there. A `sit` or `lie` with a
`to` over 24 px away walks there first.

**Places used a certain way (`use`)**: `pose` (`stand`, default, or
`sit`: on the ground, or on the seat with `floor`), `facing`, and `at`, the
work point:

```json
"pathar": { "x": 960, "y": 684,
  "use": { "pose": "sit", "facing": "right", "at": [1068, 604] } }
```

A `strike`, `wipe` or `hold` `to` the anchor lands on `at`. The engine
walks (or sits) the doer there to finish just before the work and turns
them to `facing`; cast at the anchor and working from the start, they open
sat there. A doer busy elsewhere or sat elsewhere stays put
(`contact.reach`); so does an unreachable `at` (the finding gives the
right point). The sheet shows `facing` as an arrow and `at` as a pink
cross: check it sits on the drawing. Put work about ⅓ of a seated user's
height above the floor and ½ their height in front.

Anchors used together need a character's width between them (~150 px,
more at smaller `scale`).

`foreground` is drawn over the actors (table edge, fence). Water is a
translucent foreground from the waterline down: a swan is cut there, a
fish lower swims under it, a lower point sinks deeper. A speaker whose face
is more than half behind opaque `foreground`/`near` art is `sight.face` (a
peek round a pillar or a face under see-through water is fine).

Floor band in the bottom 15–25% of the frame; middle third clear for faces
and bubbles; a 220 px character is ~⅓ of the frame height. The anchor
sheet ghosts the tallest character for scale, so write characters first.
Gradients and `<defs>` are fine (prefix ids with the scene id). Keep
backgrounds soft and low-contrast; give props the cast touches (bench,
well, door) a ~3 px `#2e2633` outline.

### Where things can stand (`walk`, `water`, `climb`, `solids`)

- **`walk`** (required): polygons of `[x, y]` corners where feet stand:
  the floor (running past the frame's edges) and each raised surface
  (stair, roof, rock top, branch, wall top). With nothing to stand on (down
  a well, the sky): `"allow": { "world.walk": "the reason" }`.
- **`water`**: `[{ "area": [[x, y], ...], "wade": false }]`; `wade: true`
  is shallow enough to stand in. Under a translucent `foreground` band give
  `"waterline": 590` (the band's top y) so splashes, rings and wakes draw
  on it, over the band, not hidden at the feet. With no `water`, a `river`
  effect's `points` count as deep water; give `water` anyway, since river
  points often cover the bank.
- **Walk wins over water** (a stone, jetty, deck on the water holds you
  up), so keep the floor polygon off the water.
- **`climb`**: polygons round ladders, trunks, walls, ropes, from the
  ground to a top that should be a walk area; a `climb` stays inside one.
- **`solids`**: footprints feet cannot cross, by name:
  `{ "well": { "area": [[x, y], ...], "layer": "svg" } }` (the well's ring,
  cot legs, trunk foot, not the picture). `layer` `svg` (default): drawn
  under everyone, walks pass in front; `foreground`: walks pass behind.

```json
"walk": [
  [[-300, 578], [1580, 578], [1580, 760], [-300, 760]],
  [[700, 326], [890, 342], [890, 356], [700, 342]]
],
"water": [{ "area": [[327, 462], [1580, 450], [1580, 760], [490, 760], [402, 590]] }],
"climb": [[[852, 318], [912, 318], [912, 600], [852, 600]]]
```

A blocked `walk`/`run` routes itself the shortest way within walk areas
and round solids (open side), facing each leg, crossing water only on a
walk area (bridge), taking the longer way's time unless given `duration`.
Stage one walk start to end, not legs. To force a path (a maze's
mid-lanes), give corners in `via` (anchors or points, in order): one walk
turns through each without stopping. A walk to a spot on a solid goes
straight in at the end; a gap between two solids is a way through. With no
walk areas only solids are avoided. Standing inside a footprint (cast,
`set`, `move`) is `support.solid`; sitting or lying on it is fine.

`climb` goes straight up from the foot to `to`, back to the viewer:
`{ "t": 1, "actor": "bandar", "do": "climb", "to": { "x": 880, "y": 340 } }`.

The anchor sheet hatches walk green, water blue, climb orange, solids red:
check them against the art. Every anchor must be on walk or water, or be
waived: `"allow": { "world.anchor:sky": "where the crow flies to" }`. Kit
helpers: `below(line, bottom)` (all under a ground line), `ledge(x0, x1,
y)` (a strip along a branch or wall top), `rail(foot, top)` (a climb area,
may lean), `solid(x, y, width, depth)` (an oval footprint), `used(x, y,
at, facing, pose)` (an anchor with `use`).

**`habitat`**: `land` (default: walk areas and wadeable water), `water` (a
fish `["water"]`, a frog `["land", "water"]`), `air` (anywhere: kite,
moon, dust cloud, stars `["air"]`; `flaps` defaults to
`["land", "air"]`).

Feet up to 12 px above a walk area are put down on it; higher is a finding. Areas cannot tell
height from depth, so move things with verbs (`putdown`, `jump`, `climb`),
never `move`; a walker a `move` lifts off the ground is `support.air`.

### World findings

After saving, the engine plays the shot and checks every actor each 0.1 s.
Already held up: carried (`attach`), riding (`on`), mid-`jump`, falling,
`visible: false`, or past the frame's left or right edge; a `hidden` actor
is still held to the ground; climbers are held to `climb` areas. Findings are errors
(code, shot, time, who, where, a fix when mechanical) from `write_shot`,
`patch_shot` (with frames of the first three, ringed), `render` and
`talekit check` (`--frames dir` saves them). The shot saves, but nothing
renders until each is fixed or waived.

- `support.air`: on no walk area, cannot fly. `support.water`: in deep
  water, cannot swim. `support.dry`: water creature out of water.
  `support.solid`: inside a solid's footprint (cast, set or glided).
  `support.climb`: a `climb` outside every `climb` area.
- `world.walk`: no walk areas. `world.anchor`: anchor on no walk or water
  area. `world.scale`: an anchor's or spot's `scale` more than a fifth off
  the `perspective` at its depth.
- `attention.listener`: someone spoken to faces away from the speaker.
  `attention.speaker`: a speaker faces away from its `to`.
  `attention.reacts`: someone reacts facing away from the cause.
- `continuity.jump`: something jumps across the stage in sight (a prop
  handed from too far, `set.at` in sight, a too-fast `move`).
  `continuity.cut`: across a same-scene `next` cut, someone is not as left
  (moved, sat up, woken, prop in another hand, resized, appeared or
  vanished in sight). `continuity.direction`: off one side, then on in the
  next place moving back. `continuity.line`: across a `next` cut to another
  place, two seen on both sides swap sides (180° rule).
- `speech.mismatch`: no voiced take says the line ([Sound](#sound)).
- `contact.reach`: a `strike`, `wipe` or `hold` at `to` cannot land (hand,
  swung prop or tool `tip` too far, or a long stick too close); says where
  to stand. `give.reach`: a `give`'s two too far apart or facing away.
- `sight.face`: a speaker's face more than half behind `foreground`,
  `near` art or a stage fire's flames during its line. `sight.hidden`: a
  `hidden` actor shows.

Waive only what the film means, in the shot's `allow` (or the scene's, for
all its shots), keyed by code or `code:actor`, with a reason:
`"allow": { "support.air:ghost": "a ghost floats" }`. An unknown key is an
error. Otherwise fix it: move the actor, add the surface to `walk`, or give
the right `habitat`.

### Layers and depth

- `far`: sky, sun, clouds, far hills, sea, skyline; behind `svg`, moving
  at `parallax.far` (0–1, default 0.5; 0 still). **It must fill the whole
  frame alone**, to the bottom edge, and `svg` must leave the sky out (an
  opaque full-frame rect in `svg` warns; a see-through tint is fine).
- `svg` and `foreground`: the stage with actors and anchors, moving with
  the camera. Actors cannot stand on `far` things.
- `near`: things at the lens over everything (corner leaves, bottom
  grass), `parallax.near` (1–3, default 1.4). Keep it to the edges.

Interiors rarely need `far`; library `park` and `street` are layered
examples. The anchor sheet shows each layer and zoomed edges: look for
gaps.

### Perspective and haze (`perspective`, `depth`)

**Perspective**: scale is linear in floor y, given by a far and a near row
`[y, scale]` (extrapolated past both):

```json
"perspective": [[499, 0.62], [665, 0.95]]
```

Anchors, shot spots and stage shortcuts without `scale` take the scale at
their depth. Fit the rows to the art's yardsticks (fire-pit stones, a
doorway, a bench); the anchor sheet draws the ghost's height in cyan at
five depths (`×0.62` …) to check against.

**Raised surfaces** (dais, stage, roof, cart): give the anchor `ground`,
the y where the surface meets the floor in front, so its occupant is sized
for that depth: `"raja": { "x": 1034, "y": 474, "ground": 530 }`. A seat's
`floor` counts the same; shot spots take `ground` too (kit `pt(905, 496,
ground=530)`). Draw what stands up there (throne, canopy) at that depth's
size.

A `scale` more than a fifth off the perspective is `world.scale` (it gives
the right one): drop the scale (aimed-at points such as a `hold` target
need none), give `ground`, or waive it for a meant size (a giant, a big
nature face). A character's own size is its `height` or the cast's
`scale`, never an anchor's.

**Haze**: actors (and what they carry) fade toward the air's colour with
distance: none at the nearest row (largest anchor scale), `depth.haze` of
the way (default 0.35, at night 0.35 × (1 − ½ `weather.light` amount)) at
twice as far (half the near size). Air colour: the horizon of the painted
sky (last stop of the first gradient in `far`), else pale blue tinted by
`weather.light`. Distance comes from the perspective, else anchor scales;
all at scale 1 means no haze.

```json
"depth": { "haze": 0.5, "color": "#cfe3f2" }
```

`haze` 0 turns it off (a shallow interior), higher for mist; `color`
overrides the sky's.

### Weather and moving nature

The engine draws what moves by itself each frame. **Do not draw rain
streaks, snowflakes or flames**; paint what stays still (wet pavement, snow
on the ground, fire-pit stones) and name the rest. Paint a fair sky and let
`clouds` grey it.

```json
"weather": {
  "rain": { "amount": 0.6 },
  "wind": 0.4,
  "clouds": { "amount": 0.8, "dark": 0.8 },
  "lightning": { "every": 6 }
}
```

- `rain` (`amount` 0.2 drizzle to 1 downpour), splashing around `ground`;
  `snow` likewise. Both take `top` (y they fall from, for a shelter across
  the frame top) and `scale` (for a close-up scene drawn large).
- `wind` (-1 to 1, positive blows right): slants rain, carries snow,
  smoke, sparks and leaves, moves clouds, gusts from 0.3, blows springs and
  leans `sail` props ([Carrying](#carrying-attach)).
  `leaves: { "amount": 0.5 }` tumbles leaves (`colors` recolours).
- `clouds`: drift down to `low` (default 0.32 × height); `dark` 0 white to
  1 storm (darkens the frame); from `amount` 0.4 they wash out `far`.
- `lightning`: about every `every` s, bolt and flash.
- `heat` (0–1): `far` shimmers.
- `light: { "color": "#4a5a8f", "amount": 0.7 }` tints the cast for night
  (blue ~0.7) or dusk (orange ~0.5); a `fire` then lights those near it.

Clouds, lightning and heat need a `far` layer (warned).

**Shelters** stop rain and snow (dry ground under, drips off the ends). A
scene's: `shelters: [{ "x": 858, "y": 500, "width": 224 }]` (blue on the
anchor sheet). A character's, in its own box: `shelter: { "x": 13, "y": 50,
"width": 180, "when": "open" }` (`when` limits it to a variant; a list
gives one per variant); a carried umbrella keeps its carrier dry where it
leans.

**Changing weather**: a shot's `weather` replaces the scene's (`{}`
clears). An action `{ "t": 4, "weather": { "clouds": { "amount": 0.3 } },
"duration": 3 }` turns into it over `duration` (default 2 s); what it
omits goes away.

`effects`, each in its `layer`'s coordinates:

```json
"effects": [
  { "kind": "fire", "x": 640, "y": 608 },
  { "kind": "smoke", "x": 645, "y": 500, "size": 0.8 },
  { "kind": "sun", "x": 980, "y": 130 },
  { "kind": "waves", "y": 390, "height": 170 },
  { "kind": "river", "points": [[570, 448], [715, 448], [985, 720], [310, 720]], "flow": [4, 12] },
  { "kind": "waterfall", "x": 640, "y": 180, "width": 150, "height": 360 }
]
```

- `fire`: `x, y` mid-base on the ground; logs (`logs: false` for none),
  flames, glow, sparks. On the stage it is drawn among the actors by its
  `y`: those behind it (feet higher) and what they hold out are behind the
  flames; a prop cast at its spot (a flare) is in front.
- `smoke`: where it comes out; puffs rise and drift with the wind.
- `waterfall`: mid-lip; pours down `height` to foam and mist.
- `waves`: `y` the sea's far edge, `height` its depth; crests, swell, foam
  up the shore.
- `river`: `points` = the outline of water you painted; ripples and glints
  drift by `flow` (px/s at the bottom; default [18, 0], [0, 0] still),
  smaller toward the top. Paint no ripple marks. Under a translucent
  `foreground`, use two: one on the stage above the waterline, one
  `"layer": "front"` on the foreground, a little faster.
- `sun`: disc centre; breathing halo, turning rays.
- `draw`: `points` = a line in pen order, drawn on from `start` (s) over
  `duration`, the pen reaching each point in equal time (space points to
  pace it). `colors` (`#rrggbb`) blend along it; `width` (default 2) zooms
  with the camera unless `fixedWidth`; `opacity` < 1 shows crossings;
  `pen: false` drops the glowing tip. Hundreds of lines are fine; such
  films zoom far closer (3 on one flower of a hundred).

```json
{ "kind": "draw", "points": [[540, 1215], [541.2, 1213.8], ...], "start": 4,
  "duration": 6, "colors": ["#4fc3ff", "#a77bff", "#ff7bd5"],
  "width": 2.2, "fixedWidth": true, "opacity": 0.92 }
```

`size` scales fire (1 ≈ a 110 px campfire), smoke and sun; `color`
recolours water, foam, smoke or sun. `layer`: `far` default for the sun,
`stage` (behind actors) for the rest, `front` (before actors), `near`.
Waves on a sea in `far` need `"layer": "far"`. Paint the sea, pool and
fire pit yourself. The anchor sheet shows the empty scene at a few moments.

### Swaying trees and grass (`sway`)

Draw each crown, branch, frond or grass clump that should stir as its own
`<g id='…'>`, apart from its support, and list it with its fixed point:

```json
"sway": {
  "crown-left": { "at": [360, 430] },
  "branch-low": { "at": [520, 300] },
  "grass-3": { "at": [905, 668], "amount": 1.5 }
}
```

- `at`: the pivot in the layer's coordinates (trunk top, branch root, clump
  foot); groups may be in `svg`, `foreground`, `far` or `near`.
- Each turns gently out of step, bigger groups less and slower; `amount`
  scales it (0.5 stiffer, 2 a fern or banner); `wind` adds and leans.
- **Keep perches off swaying groups** (riders do not move with them; the
  check warns about an anchor in one).
- Each group turns rigidly about one point, so split anything held at
  several (each cloth on a line its own group, pivoting at its pegs).
- The sheet rings pivots pink and labels the far end's sweep
  (`~crown-left ±12 px`); over 40 px reads as rubber and warns: lower
  `amount` or use smaller pieces.

### Lights and cast shadows

Every person, animal and grounded prop casts a soft shadow away from each
light. A `sun` effect and each `fire` are lights; name lights painted into
the art in `lights`:

```json
"lights": [
  { "kind": "moon", "x": 1180, "y": 63 },
  { "kind": "lamp", "x": 420, "y": 380, "reach": 600 }
]
```

- `sun`, `moon`: in the sky where painted; high gives short shadows, low
  long ones. A sun also drives the cast's shading. Moon `strength` default
  0.55.
- `lamp`: on the stage (bulb, lantern, lit window); shadows lengthen with
  distance and a lower lamp, fading at `reach` (default 700 px); faint by
  day, strong at night.
- `strength` (0–1, default 1): shadow darkness (0.35 under a big tree).
  Clouds and rain dim a sun's shadows.

Paint shadows of painted things falling the same way.

## Shots

```json
{
  "id": "02-meet-in-park",
  "scene": "park",
  "duration": 12,
  "fadeIn": 0.5,
  "cast": {
    "mia": { "at": "gate", "facing": "right" },
    "dad": { "at": "bench", "facing": "left", "emotion": "happy" }
  },
  "actions": [
    { "t": 0, "caption": "Later, in the park…", "duration": 2.5 },
    { "t": 0.5, "actor": "mia", "do": "walk", "to": "tree" },
    { "t": 3, "actor": "mia", "say": "Dad! Look what I found!" },
    { "t": 3, "actor": "dad", "do": "wave" },
    { "after": 0.4, "actor": "dad", "say": "A kite! Let's fly it.", "emotion": "happy" },
    { "after": 0.3, "actor": "mia", "do": "jump" },
    { "t": 9, "camera": { "zoom": 1.6, "x": 400, "y": 500 }, "duration": 2 }
  ]
}
```

- `cast` places everyone at the start; nobody else is in the shot.
  `visible: false` hides until an `appear`.
- `hidden: true`: someone meant to be out of sight behind nearer art (a spy
  behind a `foreground` boulder); the check flags any part that shows
  (`sight.hidden`). Art under ~70% opacity does not hide. For a peek,
  `set: { hidden: false }` while up, `true` once down. Bubbles do not avoid
  hidden faces.
- **Draw order is by feet**: lower on screen is in front. To pass behind
  someone, use a smaller `y`.
- Positions (`at`, `to`, `set.at`): an anchor name or a point
  `{ "x": 640, "y": 610, "scale": 0.8 }` (no `scale`: 1, or the
  perspective's; `ground` for a raised spot). A `to` with `scale` tweens
  size over a `walk`/`move`/`fly` (into the distance, sinking into a
  well). Anchors survive scene redraws; use points for unnamed spots.
- `t` is seconds from shot start; one actor's actions may overlap.
- `after` instead of `t`: that many seconds after the nearest earlier `say`
  or `caption` finishes being spoken (from the shot start if none),
  recomputed once voices exist, so replies follow the real voice. Any
  action can use it. Keep actions in order; leave `duration` for the last
  line (a cut-off line warns). `get_item`/`patch_shot` show the computed
  time; fix one with `{ "t": 6, "after": null }`.
- Shots play in file order (`order` on `write_shot`).
- `crossfade: 1` dissolves in over the first second (time passing, soft
  change of place; the previous shot then needs no `fadeOut`).
  `fadeIn`/`fadeOut` fade from/to black at the film's start and end.
- **`cut`**: `'next'` (default for a hard cut) carries straight on: in the
  same scene everyone starts as the last shot left them (place, sitting or
  lying, asleep, what they hold, size; nobody appears or vanishes in
  sight): copy its end into the cast (`continuity.cut` gives the spot). A
  facing this shot reverses starts as before and turns visibly (eyeless
  things, a pot or bow, keep theirs). `'later'` (default after a
  `crossfade`) means time passed: the cast starts afresh. A shot after a
  title card or in another scene starts afresh too.
- **Screen direction**: someone leaving one side keeps moving the same way
  in the next place (off right, on from the left); reversing reads as
  turning back (`continuity.direction`, dissolve or not; waive for a new
  trip). A `next` cut to another scene (closer view, insert) keeps
  everyone seen on both sides on their sides (`continuity.line`); a time
  skip there is `cut: 'later'`.

### Verbs (`do`)

Default durations in brackets.

- `walk` / `run` (distance ÷ 220 / ÷ 420): planted-foot cycle to `to`,
  easing in and out; four legs gallop.
- `move` (distance ÷ 300): glide with no cycle (boat, sledge, ghost); never
  a prop to a hand or shelf, nor a walker through the air.
- `fall` (from the height): drops under gravity to the ground below, one
  bounce (a vase off a shelf, a mango off a branch).
- `fly` (distance ÷ 260): move with a wobble, beating `flaps`; `to` may be
  in the sky.
- `jump` (0.8 s): crouch, leap in place or to `to`, land with a give.
- `climb` (distance ÷ 70): up or down a ladder or trunk to `to`, hand over
  hand, back to the viewer (four legs: tipped up the slope, walking).
- `wave`, `point` (1.5 s): near arm or front paw (simple rig: lean).
- `nod`, `shake` (0.8 s): head yes / no.
- `tremble` (1.2 s): frightened shiver.
- `sit` / `stand` (0.4 s), `lie` (1.3 s): persistent; `sit` on `to` (a
  seat anchor), knees bent; `lie` sits then lies back (four legs: on the
  belly).
- `bounce`, `spin` (1 s / 0.8 s): squashy hop / full turn (simple rig).
- `appear`, `disappear` (0.4 s): pop in and settle / swell and shrink.
- `pickup`, `putdown` (1.2 s), `give` (1.4 s): on a prop, with `attach`
  ([Carrying](#carrying-attach)).
- `wipe` (2.4 s): near hand (or tool `tip`) circles on `to`.
- `kick` (0.9 s): near leg back, then out forward and up (lying: up off the
  bed; four legs: buck).
- `eat` (1.6 s): near hand and its food to the mouth, chewing; with `to`,
  from the food there (four legs: head down; simple: peck).
- `strike` (0.7 s): near arm overhead, chops down with what it holds; onto
  `to` (four legs: a butt).
- `swim` (3 s): paddles in place, nose up; pair with a `move`.
- `dig` (2.5 s, 2 strokes): bent over, swings its tool into the floor in
  front, clods flying.
- `hold` (2 s): near hand (or tool `tip`) on `to` and kept there.
- `aim` (3 s), `shoot` (flight distance ÷ 2400): archery
  ([Archery](#archery-aim-shoot)).

`duration` overrides any default; crossing the frame on foot takes 4–5 s,
and too short a walk sprints (stride fits speed and size). Walks start and
end feet together; a jump crosses ground only in the air. Facing changes
(`set`, walking back) are 0.2 s turns. Walking up the screen shows a
person's back, down it the front, so walk mostly across to keep profiles.
Walking, jumping and pointing look straight ahead.

**`swim`**: four legs churn under a still body, rump low, head straining
up; a person treads water. Nothing bobs (it reads helpless). The current
is your simultaneous `move`s: carry the swimmer downstream, dip one deeper
and back to drag the head under.

**`lie`**: a person sits (on the ground, or `to` a bed or sofa) and lies
back head behind, so face them where the feet should point; an animal lies
on its belly, paws out. A cot is a seat anchor with `floor`: cast a sleeper
at its `x` and `floor`; getting up steps onto the floor in front. Sleepers
need `face: { "eyes": "closed" }` (maybe a `"Zzz..."` thought). `stand`
rises, `sit` sits back up. A `walk`, `run` or `jump` from sitting or lying
rises first and ends 0.4 s or 1.3 s later; `stand` first for a slower rise.
To open a shot already lying or sat, give the `lie` or `sit` at `t: 0` a
`duration` of `0.05`.

### Carrying (`attach`)

Make the prop a character (usually `simple`) and attach it:
`{ "t": 0, "actor": "lantern", "attach": "pip" }`. It hangs from the near
hand (an animal's mouth), follows and faces with the carrier, drawn just in
front; its own moves are ignored. One thing at a time; never carry a
carrier.

- **`grip`**: the held point in the prop's box (`[100, 22]` for a
  lantern's handle; default its middle). **`tip`**: the working point that
  makes it a tool (hoe blade, ladle bowl, brush; default the box top above
  the grip); `dig`, `strike`, and `hold`/`wipe` with `to` land it. The
  construction sheet marks `hold`, `grip`, `tip`, bowstring, `nock`,
  `mark`.
- **Let go**: `"attach": false`; it falls to its carrier's floor (past the
  branch of someone up a tree) and bounces once. Use `putdown` to place it
  (never `move`); `set.at` places it instantly.
- **From the floor**: `{ "t": 5, "actor": "basket", "attach": "pip", "do":
"pickup" }`; stand the carrier facing it about ⅓ of their height in front
  of the feet (240 px person: 75 px); the validator says where when the
  hand would miss. `"attach": false, "do": "putdown", "to": "table-end"`
  reverses it (no `to`: the floor under the hand).
- **Table or shelf** (prop knee-high or more): the same `pickup` or a
  `putdown` with `to` reaches out; the arm is ~¼ of the person's height,
  so a grip at shoulder height needs them ~⅕ of their height away. Never
  attach a raised prop without `pickup`.
- **Reaching `to`** (`wipe`, `hold`, `strike`): `to` is an actor, an anchor
  (its `use` point) or a spot; the engine turns the doer to it first.
- **`wipe`**: `{ "do": "wipe", "to": "vase" }` circles the near hand on
  the actor's middle; stand as close as for a pickup.
- **`hold`**: `{ "do": "hold", "to": "ghayal" }` keeps the hand on the
  actor's shoulder (or a spot) for `duration`, following them up off the
  floor. To walk a hurt man in, two helpers `hold` him (one a step ahead on
  the far side, one behind on the near side) and all three walk the same
  distance in the same time.
- **Tools**: a `hold` or `wipe` `to` a spot by someone carrying a prop with
  a `tip` puts the tip there (ladle in the fire, brush on a wall, pointer
  on a map): the hand stops a tool's length short on the line from the
  shoulder. Nearer than that the tool comes down from above; at shoulder
  height it angles up. Give the tip's spot and place the holder about a
  tool's length away. `hold` on a cast actor is still the hand on the
  shoulder.
- **`dig`**: `{ "do": "dig", "duration": 3.75 }` with a hoe or spade is as
  many ~1.25 s strokes as fit, the `tip` biting the floor in front with
  clods, dust and a thud. Stand the digger at the bed's edge facing it: the
  blade lands ~⅓ of their height in front.
- **`eat`**: `{ "do": "eat", "sound": "munch" }`; the prop's `grip` reaches
  the lips (grip a roti by its lower edge). Several bites are several
  `eat`s. Give food on a plate or the floor as `to` (the plate actor or a
  spot), or it reads as eating air: the hand goes down first, lifts the
  bite by 0.24 of the `eat` and is at the mouth by 0.4. To show the bite,
  attach a morsel prop visible from that 0.24 until it is in the mouth.
- **`strike`**: `{ "t": 8, "actor": "farmer", "do": "strike", "to":
"camel" }`, one blow; a carried stick, sword or broom swings back over the
  shoulder and down. With `to`, its `tip` comes down from above (level on
  something shoulder-high) on a person's shoulders (standing, sitting or
  lying), an animal's mid-back, an anchor's `use` point or a spot; low
  targets bend the body (beat washing on the stone's `use` place or its
  top). Grip swung things near their foot. The blow lands at 0.55 of it
  (0.385 s by default) with a `thud` (unless the shot has its own sound
  within 0.3 s, a `bonk` or `crack`); the struck flinch back, eyes shut,
  and steady; a blow on the ground (a spot, or a place with no `use`)
  throws dust and clods. Without `to` it chops the air in front; any sound is yours.
  A beating: `strike`s ~0.75 s apart.
- **`give`**: `{ "t": 4, "actor": "roti", "attach": "sita", "do": "give"
}` passes it from its holder to Sita: both turn to face (if idle), reach
  near hands to a point between them and it changes hands halfway (0.7 s).
  An animal takes it in its mouth, the person bending to it. Stand them at
  most ~0.7 of their average height apart (two 220 px children 160 px, two
  300 px adults 220 px), facing (`give.reach`). Attaching a held prop
  without `give` passes it with no reach; from further than the carrier's
  height it is `continuity.jump`.
- **At rest** a carried tool never goes into the floor in front: one
  hanging lower than the hand swings up about the grip until its end rests
  on the floor line (the seat's `floor` on a raised seat). Seated holders
  prop a tool across the lap, `tip` 30° above level toward their facing.
- **`sail`** (0–1): wind caught while carried (umbrella or banner 1, a
  pole flag ~0.6; none for sticks, lanterns). It leans downwind about the
  grip, gusting, up to ~25° in a gale at 1, the arm giving at the shoulder.
  Grip at the handle's or pole's foot. Draw a flag streaming right; in wind
  it streams downwind whichever way the holder faces. A planted flag is the
  scene's `sway`. The pose sheet shows a gale's lean.
- Arrows are not carried ([Archery](#archery-aim-shoot)).

Carrying across cuts is staged: whoever ends a shot carrying starts the
next with it, cast and attached at `t: 0`, or puts it down first (warned).
`attach` with `appear` is magic; for a real prop, lay it on the floor and
pick it up.

### Archery (`aim`, `shoot`)

The bow is an attached prop; the arrow is never attached: `aim` names it
and it fades in on the string once the archer faces `to` with a hand on it
(~0.35 s into a first aim). A later `aim` naming the same arrow takes it
off the last bow (fading) first.

```json
{ "t": 0, "actor": "dhanush", "attach": "arjun" },
{ "t": 1, "actor": "arjun", "do": "aim", "to": "chidiya", "arrow": "baan", "duration": 15 },
{ "after": 0.3, "actor": "arjun", "do": "shoot" }
```

- **`aim`** (humanoid only): turns to `to` and over 0.6 s raises and draws
  as a right-handed archer seen from his right (bow in the far hand, string
  drawn by the near hand to the near jaw, elbow high); leans back to aim
  up, bends to aim down. Holds for the rest of `duration` (lines are fine)
  and lowers over the last 0.5 s; the bow stays in the far hand for the
  shot and into a `cut: 'next'` shot in the same place. `to`: a cast actor
  (its `mark`, followed if it moves), an anchor or a spot, level to well
  up, never behind.
- **Lowered without a shot**, the arrow stays on the slack string, pointing
  at the floor, to the shot's end. Several archers told to lower: `aim`s
  with no `shoot`.
- **`shoot`** (on the archer, during the aim): the arrow flies at 2400 px/s
  (≥ 0.12 s; `duration` sets the flight) and sticks where aimed, shaft
  shivering; the bow lowers 0.45 s later over 0.5 s, ending the aim. Twang,
  whoosh and thunk (when in the picture) are the engine's.
- **Where it sticks**: a spot or anchor keeps it; an actor carries it at
  the hit point through all later actions (a wooden bird falls with the
  arrow in its eye; a `move` turns both). A `shoot` with its own `to` sends
  it there instead (a miss).
- **Arrow off no bow**: `{ "actor": "baan", "do": "shoot", "to":
"chidiya", "duration": 0.4 }` flies from where it is cast (just off the
  frame's edge, for the cut to the target); whoosh and thunk, no twang.
- **Props**: bow: simple rig, upright, no string, string side left, `grip`
  mid-stave, `bowstring: [[x, y], [x, y]]` (string ends at the tips, top
  first; the engine draws and bends it), `nock` (default on the string
  level with the grip); ~⅔ of the archer's height. Arrow: level, pointing
  right, `grip` at the nock, `tip` at the head, low in its box; a bit under
  40% of the archer's height; cast `visible: false` anywhere. Target:
  `mark` (default the box middle). One arrow per aim that shoots; aims that
  only lower can share one.

### Standing on someone (`on`)

Feet order would draw a mouse on a lion's back behind it. Say whom it
stands on, `to` on the back (read it off a `preview_frame`):

```json
{ "t": 1.6, "actor": "chintu", "do": "jump", "to": { "x": 250, "y": 905 }, "on": "lion" }
```

`on` goes on a `walk`, `run`, `move`, `fly` or `jump` with `to`, or on
`set.at`, and lasts until a move without `on` (so hops along the back need
it too; the check warns). In the cast:
`"chintu": { "at": { "x": 250, "y": 905 }, "on": "lion" }`. The rider keeps
its spot as the mount gets up, walks or turns (keeping its own facing).
Never paint a character into a scene instead.

### Dialogue

`say` draws a bubble above the head and moves the mouth. A voiced line
shows for its voice + 0.5 s, an unvoiced one 1 s + 0.4 s a word (≥ 1.8 s);
`duration` lengthens a voiced line or sets an unvoiced one. `bubble`:
`speech` (default), `thought` (mouth still, nobody turns), `shout`. Lines
≤ 12 words; one speaker at a time (overlaps warn): time replies with
`after`. Bubbles keep their size at any zoom (a clipped look on a small
sheet is not real). The engine places each bubble once per line, off every
face in frame and other bubbles (beside the head when there is no room
above); spread talkers out in a crowd or corner.

Devanagari draws in the bundled Baloo 2 whatever the project `font`; write
it as in a book (`"अरे कछुए, तुम कितने धीमे हो!"`), same 12-word limit.

**Looks are the engine's job.** A moment after a line starts, the speaker
turns to its listener and listeners to the speaker (heads tilting too).
Listeners: the `to` actor alone (`{ "t": 4, "actor": "mia", "say": "Can we
go?", "to": "dad" }`); else whoever spoke last; everyone, when the speaker
is the shot's only talker; plus `audience` (ids or `"all"`). Do not stage
conversation turns. Only the idle turn: not someone walking, busy with the
hands (`strike`, `dig`, `eat`, `wipe`, `pickup`…), lying, eyes `closed`, or
turned by the shot near the line. A `to` listener who cannot turn is
`attention.listener`; a speaker facing away from its `to`,
`attention.speaker`. Stop the work before the line, or start the line
after.

**Reactions**: `reacts` names the cause: `{ "t": 6, "actor": "deer", "do":
"run", "to": "offRight", "reacts": "jackal" }` turns the deer to the
jackal 0.45 s before. A listener whose later reaction `reacts` to the
speaker turns then, not at the line. Facing away, unable to turn:
`attention.reacts`. Waive deliberate ignoring:
`"allow": { "attention.listener:kid": "sulks" }`.

**Startles**: a loud sound (`list_sounds` marks them: roar, hiss frighten;
crash, slam, bray surprise; a growl does not) makes everyone else look
scared or surprised a moment later and turn to the source if free. A
roar with a line said `to` someone startles only them and the `audience`.
Only calm faces (neutral, happy, sad) change; sleepers sleep on. No
`actor`: faces change, nobody turns. Faces settle after 1.5 s (lasting
fear is your `emotion`). Anyone given their own face, emotion, turn or
`reacts` from just before to 1 s after is left alone. `volume` < 0.6
startles nobody; `"startles": false` / `true` overrides. Write the running
away yourself, with `reacts`. Mouth sounds (marked `mouth`: roar, bark,
laugh) open the actor's mouth while sounding (≤ 3 s) unless the shot sets
it.

**Landings and splashes** (automatic): a `jump` or dropped prop landing on
a walk area raises dust (paler on `grass`; none on a branch, seat or back,
or under 40 px tall). Into water: spray, two rings, a splash sound. Wading
in splashes softly; anything moving in water leaves rings every 0.5 s and
a bow wave growing with speed, fading ~1 s after it stops; `swim` in place
makes rings only. A splash sound of yours within 0.3 s replaces the
engine's. On a `sand` or `snow` `surface` (see [Sound](#sound)) steps
leave prints for the shot (not in water, sitting, lying or carried); a
scene's `trail` (say 20) keeps only each walker's last prints, fading (a
maze). Use sand or snow only where the whole floor is soft.

`talekit explain <dir> [shot]` lists each turn, walk, sit and startle the
engine added, and why.

### Emotion, face, captions, camera, set

- `emotion`: `neutral | happy | sad | surprised | angry | scared`,
  persistent, each change with a blink and head move. `face: { "mouth":
"grin" }` forces a variant for the rest of the shot (no blinking/talking
  on that part); `""` hands it back.
- `caption`: narration (`captionStyle: "narration"`, default) or a centred
  card (`"title"`), for 3 s or the narrator's time. A film's narration
  strip moves to the top for the whole line when at the bottom it would
  cover a face; a reel's is always at the top. Captions ignore the camera;
  nobody talks over a title card.
- `camera: { zoom, x, y }` tweens over `duration` (default 1 s; `0.05` is
  a cut); `x, y` is the frame-centre world point. Zoom 1–2 for stories
  (finer work like `draw` closer); below 1 is raised to 1 and the view
  clamps to the scene. Above 1.3 the edges darken slightly. Zoom is
  geometric about a fixed point, so long zooms close steadily.
- `camera: { zoom: 1.6, follow: "kid" }` pans after an actor (room ahead,
  settles when they stop), for walks or chases longer than the frame; needs
  zoom > 1. On the shot's `camera` from the start; as an action it eases in
  over `duration`; `x`/`y` or `follow: ""` releases.
- `set: { facing, scale, visible, hidden, at }` changes state at once
  (`facing` still turns over 0.2 s).
- `lightning: true` (no actor) strikes at `t`.
- `weather: { … }` (no actor) changes the weather
  ([Weather and moving nature](#weather-and-moving-nature)).

## Sound

You set voices, narrator, music, ambience and story effects; the engine
adds the sounds of its own motion and sets the mix.

- **Voices**: `"chatterbox:hm_omega"` or `{ "id": "chatterbox:hm_psi",
"pitch": 4 }` from `list_voices`. `chatterbox:` acts the emotion and is
  best for Hindi; `kokoro:` (same voices) is flat and fast, for drafts.
  `pitch` in semitones (+3 to +5 child or small animal, -3 giant); `speed`
  0.85 old, 1.15 quick. Lines are voiced locally into `audio/voices/` on
  `write_shot` and before render. Devanagari needs a Hindi voice (warned).
  `shout` is louder, `thought` quieter with room. No voice, no sound. A
  line takes the emotion in force at its start: set `emotion` on or before
  every line not said calmly.
- **Every take is heard** (whisper.cpp): a take that skips, babbles or
  garbles is redone, up to three takes in all (`chatterbox:` only),
  keeping the best; hand-made takes are checked but never redone. A line no take says is
  `speech.mismatch` and blocks the render: respell the stumbled word as
  said or split the line. Listened and it is right: `"allow": {
"speech.mismatch:kid": "listened: it says it" }` (narrator:
  `speech.mismatch:narrator`).
- **Sounds inside a line**: wrap them in asterisks and give the `sound`:
  `{ "t": 3, "actor": "lion", "say": "*गुर्रर!* कौन है?", "sound":
"lion-growl", "bubble": "shout" }`. The bubble shows `गुर्रर! कौन है?`,
  the growl plays mouth open, then the voice says `कौन है?` (within 2 s).
  A sound-only line is not voiced. Unmarked growls, laughs, snores and
  marked sounds without `sound` warn.
- **Narrator**: `set_audio(path, narrator: "chatterbox:hf_alpha")` reads
  every caption.
- **Music**: `set_audio(path, music: "playful")` for the film. A shot's
  `music` (`"tense"`, `{ "track": "sad", "volume": 0.7 }`, `false` for
  silence) is for that shot only, so set it on each shot of a lasting
  mood. A continuing track plays across cuts, a new one crossfades; music
  ducks under voices. Change it only where the mood turns.
- **Ambience**: a scene's `ambience` loops (`["jungle"]`,
  `[{ "sound": "village", "volume": 0.6 }]`; library scenes have it),
  carrying across cuts in one place. `surface` (`hard` default, `grass`,
  `sand`, `snow`) sets footsteps. Never list rain, wind, fire, waterfalls
  or waves: they sound on their own.
- **Effects**: `{ "t": 3, "actor": "lion", "sound": "lion-roar" }` plays
  from the actor's side; `volume` 0.5 far, 1.5 close. Multi-take names
  vary. Names in `list_sounds`. Never add what the engine makes:
  footsteps, jump whooshes and landings, splashes, the `appear`/`disappear`
  sparkle, pickup/putdown taps, archery sounds, a `strike`'s thud at `to`.
  Loud ones startle ([Dialogue](#dialogue)).
- **Mix**: only if a listener finds a layer off, `set_audio(path, mix: {
"music": 0.5 })` scales `voices`, `music`, `ambience` or `effects` film-
  wide (0.5 = −6 dB, 2 = +6 dB); the review app has sliders.

Project sounds go in `audio/` (`.ogg`, `.wav`, `.mp3`, `.flac`), named by
file name; a bundled name is replaced.

Each shot sheet shows sound lanes on the shot's clock (a row per speaker,
then effects, ambience, music), with each line's spoken length; a red
outline is a line cut off by the shot's end. `set_audio` shows the film's.
Pace by starting each line ~0.3 s after the last and ending the shot ~0.5 s
after its last line. Lines starting during a caption or the same
speaker's previous line warn.

## Subtitles and the .mkv

A full film render writes `out/movie.mkv` beside `out/movie.mp4`:

- **Three sound tracks**: full mix (default); music and effects only; that
  plus the narrator (marked sounds count as effects), loudness-matched. No
  narrator: no third; nobody speaking: only the first.
- **Subtitles**, off by default: the lines' language (Hindi for
  Devanagari, else English) plus one per `translation` language, timed to
  bubbles and captions, at the bottom or at the top with narration (bottom
  again where narration moved up), in the bundled Baloo 2.
- **A chapter per shot**, named by its id.

```json
{
  "t": 2,
  "actor": "lion",
  "say": "*गुर्रर!* कौन है?",
  "sound": "lion-growl",
  "translation": { "en": "*Grrr!* Who's there?" }
}
```

Translate meaning in a child's words (`अरे कछुए भाई` is "Hey there,
tortoise", not "Oh tortoise brother"), marking sounds as the line does.
Translate every `say` and `caption` or none (`project_info` warns on
gaps). `talekit mkv <path>` rebuilds the .mkv in seconds after
translations change.

## A reel: the portrait version

A reel (Instagram Reels, YouTube Shorts) is its own 720 × 1280 project
(`create_project(path, title, width: 720, height: 1280)`), retold shorter
in tall scenes, not the film cropped. Copy the film's characters and
voices; scenes and shots are new.

- **≤ 3 minutes** (`project_info` warns); 90–170 s is good.
- **The narrator tells it**: a sentence or two a shot over the cast acting
  it out (`walk`, `pickup`, a munching `sound`, `emotion`). Characters
  speak only where their words turn the story (challenge, cry for help,
  promise kept), a line or two a scene, never repeating the narrator. Keep
  every plot event, especially those that explain the ending (the hare eats
  until too full to stay awake); cut decoration (greetings, walks there,
  repeats). Write fresh narration, not the film's lines cut down.
- **The apps cover the edges** (name, caption and sound along the bottom
  fifth, buttons down the right, icons on top). Text is kept clear; keep
  faces and action clear: feet at about y = 1000 (`ground` default 0.78 ×
  height), x 45–620, floor or foreground painted below.
- **Tall scenes**, `far` filling 720 × 1280; use the height (trunk into
  canopy, rock over a cave, sky). Start from the library's `-tall` scenes
  or draw tall ones in the same style.
- **Stage close**: two people 150–250 px apart (`left`/`right` at 26% and
  72% of the width); anchor `scale` 1.3–1.6 for library characters, zoom
  1.3–1.8 for a face. Text scales by the short side. For a close-up, zoom
  the camera; never paint a character large into a scene.
- `render` writes only `out/movie.mp4` (one track, text burnt in; no
  .mkv).

## Options and samples

Make each thing one way, your best judgment. Write alternatives only where
you cannot tell what the person wants and a wrong guess costs a round of
notes (two stagings of the turn, two drawings of a new animal, slow vs
quick chase); never for small things or per shot. Most films have none.

**An option** is `options/<question>/`, one folder per choice plus an
optional `question.json`. A choice mirrors the project layout
(`characters/`, `scenes/`, `shots/`, partial `talekit.json`, `audio/`) and
holds only changes: same id replaces, new id joins (a shot plays in its
file name's place, `03b-x.json` after `03-y.json`), `talekit.json` and
`audio/` lay over the project's. The project itself is the first choice
("as it is"), so write only alternatives. `question.json`: `{ "ask":
"Which tail for the camel?", "choices": { "long": "rooted deep, hangs
clear" }, "shot": "khet", "t": 3.2 }` (`shot`, `t`: where it shows best).
Kit: `write(option(PROJ, "tail", "long", ask=…, label=…), camel)` for a
character; `F.option("chase", "slow")` gives a `Film` writing into a
choice (same shot ids). `talekit voice` voices choices too.

Options are never rendered or checked (`talekit check`, `render`). In the
review app the person toggles choices in the film (`O`), compares them
under Options, and picks; links can open one
(`…/<folder>/?opt=tail:long&view=options`). A pick arrives as a note
(`option tail · picked long`): write that choice into the film (and its
`src/` when generated), delete `options/tail/`, resolve the note. For "as
it is", just delete the folder.

**Samples** are for what is not in a film yet (narrator voices, opening
tunes, a verb on a sample project): a folder outside the projects, served
with `open_review([film, reel, folder])`. A non-project folder is a board:
each sound, video and picture gets a player, each subfolder is a choice,
and a talekit project inside plays its `out/movie.mp4` (or a frame) and
opens its own page. Optional `board.json`: `{ "title": …, "ask": …,
"labels": { "voices": "Which narrator?", "voices/a.wav": "hf_alpha,
slower" } }`. Notes and picks land in its `notes.json`; read them with
`list_notes(folder)` (`file voices/a.wav · picked · warmer`).

## Pacing a story

- Open with a title card over the first scene (`fadeIn`, `caption` style
  `title`); close with "The End" and a `fadeOut`.
- One idea per shot (enter, react, speak, leave); 8–15 s is typical.
- Let lines land: `after` ~0.5, 0.2 for a retort, 1+ for a silence.
- Alternate wide shots (walks, arrivals) with closer zooms (feelings).
- Use `emotion` generously: a story reads through faces.
- **When the plot turns on what a character sees, cut to it**: a scene
  from their viewpoint (down the well: rim, shaft, water) and a short shot
  with the thing seen as the only cast member, drawn large, after they look
  (`point`, `emotion: surprised`). See `examples/clever-rabbit` shots 07–09.

## The critic

Before the person sees a film, look at it as they will. The checks catch
what has one right answer; this list is what reviews kept finding that no
rule could. `critique(path, shotId)` (shell: `talekit critic <dir>
[shotId]`) returns a shot's frames at its beats (first and last; each line
2 s in or at its middle if shorter; each verb at work or done; the last
frame of the shot before), each captioned with what is meant then (who
says what to whom, in English where translated; who walks where; who
sits, lies asleep, is hidden or held, facing which way). Without a shot it
returns the read-through: every line in order with time, speaker, voice
and English, and the silent stretches (`talekit critic <dir>` also writes
every shot's sheets). Go through the read-through once and each shot's
sheets once against the list below.

Best done by an agent that did not write the film, given only the
project's path and this section. Note each finding as shot, time, item,
what is wrong and how sure you are; fix the sure ones, look at unsure ones
full size (`preview_frame`), and ask the person about what stays unsure.
It adds to `talekit check` and replaces none of it.

**In the pictures**

1. **Every character is drawn as what it is.** A crocodile sprawls on a
   reptile's legs, not a bear's; a camel's head is a camel's; people look
   like the people of the story.
2. **Nothing comes apart.** No tail stuck on by its middle or hanging off
   the rump, no neck that kinks or stubs when the head turns, no split at
   an elbow or a knee, no leg folded wrong lying down.
3. **What is in front is what would be.** A sun or moon is behind trees
   and hills; an animal in water shows only what is above it; a garland's
   or strap's far side is hidden behind the neck; a stove or rock hides the
   legs of whoever is behind it.
4. **The scenery stands.** A trunk reaches the ground, a stove stands on
   the floor, scenery pieces do not run into each other, bars and a jail
   door close their gap.
5. **Work looks like work.** Hands are on what they wash, scrub, dig or
   carry; the body bends to it; a blow lands on its target from the side
   the striker faces; eating puts the food at the mouth.
6. **The picture says what the words say.** A hut said to hold a sleeping
   man shows him in it; guards said to be asleep over there are there,
   asleep; helpers said to lift a wounded man lift him; a struggle in the
   water looks like one.
7. **What changed stays changed.** A bed dug stays dug, a pot broken stays
   broken, work done in one shot shows in the next.
8. **One place keeps its layout.** What is far off in one shot of a place
   is far off in the next.
9. **The main thing can be seen.** No caption, bubble or prop over the
   faces or action that matter; a reel uses its tall frame.
10. **The world is alive.** Extras and animals where the story allows,
    reacting; water that moves; a time of day that shows.

**In the read-through**

11. **Every step of the story is said.** Nothing a character does lacks its
    reason: a warning the ending looks back to is in the film; a man who
    goes against his wife's word is said to have decided to.
12. **The turning points have room.** A realisation, a bargain, a moral is
    not one hurried sentence, and has a beat after it.
13. **The words fit who says them, and to whom.** "Brother" is not said to
    a female voice, nor "sister" to a male one; names are simple and of the
    story's region; a line said in anger has `emotion: angry`.
14. **Each voice is its own.** Two characters who talk to each other do
    not share a voice (or one gets a `pitch`).
15. **It moves.** No stretch drags with nothing said or done; a long scene
    in one view cuts away once; a reel ends promptly after its moral.

## Checklist before `render`

- `project_info`: no unintended validation or construction warnings;
  `talekit check`: no world findings, every `allow` meant.
- Contact sheets look staged: nobody clipped, the right people facing, the
  right actor in front.
- Props continuous: carried at a shot's end means in hand at the next
  start; nothing taken that was not lying there; put down stays down.
- Painted suns, moons and lamps are named in `lights`.
- Every speaker has a `voice`; narrator and music set; no red-outlined
  line; nobody talks over the narrator.
- Lines not said calmly have an `emotion`; growls, laughs and snores are
  `*marked*` with a `sound`.
- A non-English film has an English `translation` on every `say` and
  `caption` (unless told otherwise, or a reel).
- Duration fits the ask: fable 60–120 s, picture-book story 5–10 min, reel
  ≤ 3 min.
- A reel exists beside the film, unless only one was asked for.
- The critic has been through the read-through and every shot; sure
  findings are fixed.
- The `render` film sheet shows every shot as intended.
