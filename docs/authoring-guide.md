# talekit authoring guide

You are turning a story into a short 2D animated film. talekit owns the
animation; you own the design and the staging. You write three kinds of files
(all JSON, all validated) and look at the picture that comes back after every
write. Fix what looks wrong before moving on.

## Workflow

1. **Read the story and plan.** List characters, locations and 6–40 shots of
   5–20 seconds each. A shot is one location with one bit of action.
2. **`create_project(path, title)`** once; `path` is the absolute project
   directory and every later tool takes the same `path`. Then
   **`list_library()`**.
3. **Characters.** Prefer `copy_from_library(path, libraryId, asId, name,
colors)` (colour tokens: hair, skin, dress, shirt…). Draw from scratch with
   `write_character(path, character)` only for something the library lacks
   (an animal it does not have, a dragon, a robot, a prop like a kite); read
   `get_library_item(libraryId)` first to see how a character on that rig is
   laid out, and follow [Drawing style](#drawing-style) and
   [Construction](#construction). Two pictures come back: the pose sheet
   (proportions, expressions, the fallback list in the text) and the
   construction sheet (part boxes, pivots, silhouette, joints in a swing,
   numbered red boxes for each numbered warning). Rewrite until it looks
   right and the construction warnings are gone.
4. **Scenes.** `copy_from_library` or `write_scene(path, scene)`. Look at the
   anchor sheet: every place a character will stand or sit needs an anchor on
   the floor.
5. **Shots.** `write_shot(path, shot, order)` one at a time, in order. Study
   the contact sheet: are people where you expect, facing each other, bubbles
   readable, timing sensible? Use `preview_frame(path, shotId, t)` for an
   exact moment and `preview_shot(path, shotId, frames)` for more frames.
6. **`render(path, shotId?)`** a single shot early to check motion, then the
   whole film. It returns a film sheet, one frame per shot, to confirm the cut.
7. **Review notes.** The person watches the result in the review app
   (`talekit serve <path>`) and leaves notes on a character, a scene, or one
   moment of a shot. When `project_info` reports open notes, or you are asked
   to "fix my notes", call `list_notes(path)`: each note comes with the frame
   or sheet the person was looking at. Fix what it asks, check the new
   picture, then `resolve_note(path, id)`. Do not resolve a note you did not
   act on; say why instead.

## Coordinate boxes

Characters are drawn into a fixed canonical box. The engine scales the box to
`height` pixels on screen and places the bottom-centre of the box at the
anchor (the feet point).

### `humanoid` rig — 200 wide × 400 tall, feet on y=400

```
 y   0 ─┬─ top of box (hair/hat)
        │   head: circle around (100, 88) r≈62   (kid)   or (100, 96) r≈54 (adult)
 y 152 ─┼─ NECK pivot (100,152): head rotates here
 y 170 ─┼─ SHOULDERS: armL pivot (76,170), armR pivot (124,170)
        │   torso: shoulders → hips (x 60..140)
 y 272 ─┼─ HIPS: legL pivot (86,272), legR pivot (114,272)
 y 330 ─┼─ KNEES: (86,330), (114,330); legs bend here to sit
        │   legs hang straight down, feet/shoes at y 384..400
 y 400 ─┴─ FEET LINE (anchor point is (100,400))
```

Parts and draw order (back → front): `armL`, `legL`, `legR`, `torso`, (any
extra parts), `head`, `eyes`, `mouth`, `armR`. The character faces slightly
**right**; the engine mirrors it for `facing: "left"`. `armR` is the near arm
(waves, points), `armL` is the far arm.

Rules that make the rig work:

- **Draw every part in absolute canonical coordinates**, hanging from its
  pivot. The engine rotates the part around the pivot, so an arm must start at
  the shoulder and a leg at the hip. No `transform` attributes on the outer
  elements.
- Arms and legs are easiest as a `<path d='M76 170 L70 284' stroke='{skin}'
stroke-width='18' stroke-linecap='round' fill='none'/>` plus a hand circle
  and a shoe shape at the end.
- **Legs bend at the knee** when the character walks, crouches, sits or
  lies down: the engine cuts the leg across y=330 and turns the lower half,
  with a round joint as wide as the leg's stroke. So draw each leg as one
  straight stroke down from its pivot, as above, and keep the shoe and any
  sock below the knee.
- `eyes` and `mouth` rotate with the head. Give them variants (below).
- `torso` is required. Put the neck in the torso, reaching at least 12
  units up into the head, and end the torso at least 12 units below the hips
  so the legs start under it.
- Inner elements only (`<path>`, `<circle>`, `<rect>`, `<g>`…). Never an
  `<svg>` element, never `<image>`, no external references. Prefix any `id`
  you define with the character id to avoid clashes.

### `quadruped` rig — 260 wide × 200 tall, feet on y=200

Four-legged animals. The library has a dog, cat, rabbit, deer, lion, bear,
fox and mouse: copy and recolour one when you can, and read
`get_library_item("dog")` before drawing a new one (a horse, a pig, a sheep).

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

Parts and draw order (back → front): `legBL`, `legFL` (the far legs),
`tail`, `body`, (any extra parts), `legBR`, `legFR` (the near legs), `earL`,
`earR`, `head`, `eyes`, `mouth`. `body` is required. The animal faces
**right**; L is the far side and R the near side, as on the humanoid. Every
leg, the tail and the head hang from the body, so when the body tips back
for `sit` or rocks in the gallop they go with it; the ears and face hang
from the head.

- **Legs** are round-capped strokes straight down from their pivot to the
  line (`<path d='M194 132 L194 189' stroke='{fur}' stroke-width='18'
stroke-linecap='round' fill='none'/>`) with a paw or hoof shape at the
  bottom reaching y=200. The body must cover every pivot by at least 12
  units, so give it a deep chest and rump; a leg can be short and mostly
  hidden (a rabbit, a mouse), but it starts at its pivot. Far legs a shade
  darker than near ones. A sitting animal's hind legs bend at the knee
  (y=166), so keep each leg one straight stroke and the paw below the knee.
- **Head** includes the neck: a thick stroke from inside the chest up to the
  head, so a nod lowers the whole neck. The head's outline is drawn with the
  body's, so no line crosses where the neck sinks into the chest and the head
  grows out of the shoulders. Keep the muzzle inside x ≤ 260.
- **Ears** sit behind the head, so the head's outline closes their base:
  draw each from below the head's edge (sunk at least 12 units) up to its
  tip, covering its pivot. A floppy ear hangs past the back of the head.
- **Tail** starts inside the rump and covers (44,110); a long tail can
  curve anywhere in the box.
- **Face**: one eye in profile (white, iris, highlight) and a mouth under
  the muzzle, with the same variants as every other rig.

The engine walks it in diagonal pairs (near front with far hind), with the
feet planted while they are down, a lifted paw bending at the knee, the head
bobbing against the step and the tail swinging; `run` is a gallop between a
gathered pose and a stretched one; `sit` tips the body back about the hips,
bends the hind legs at the knee with the paws on the floor and keeps the
front paws planted on the way down; `lie` brings the body level onto its
belly with all four legs folded and the head lowered; `wave` and `point`
lift the near front paw; `jump` gathers on bent legs, then leaps stretched
out. The tail and ears are springs by default (see below). `height` is the
box height on screen: about 55 for a mouse, 90–110 for a cat or dog, 170–190
for a lion, bear or deer.

### `simple` rig — 200 × 200, base on y=200

One required `body` part plus optional `eyes` and `mouth`. The engine bobs and
tilts the whole body for walk/run, hops it for `bounce`, wobbles it for `fly`,
rotates it for `spin`, leans it forward for `point`, shivers it for `tremble`,
settles it lower and wider for `lie`.
Use it for birds, fish, vehicles, kites, balls, blobby monsters and props:
anything that bobs, hops or flies rather than walks. A four-legged animal
belongs on the quadruped rig.

```
 x   0 ──────────── 200
 y 0 ┌──────────────┐
     │   (tail)  head│   faces RIGHT: head and face in the right half, around
     │  ╭──────╮ ◠ ◡ │   x 130–190; tail or back on the left. The engine
     │  │ body │(eyes│   mirrors the whole box for facing: "left".
     │  ╰──┬┬──╯mouth│
 y200└────┴┴────────┘   base line y=200: feet, wheels or base touch it.
```

A minimal creature: `body` is one `<path>`/`<ellipse>` group with wings,
tail and head drawn in; `eyes` has `open`, `closed`, `wide`, `happy`; `mouth`
has `closed`, `open`, `smile`, `sad` (a bird's beak is its mouth). Bubbles
hang from the top of the box, so keep the head near the top.
`get_library_item("bird")` is a complete worked example to copy the layout
from; `height` on screen is typically 50–80 for a bird and 80–140 for a
prop or a small creature.

### Variants

A part can be a map of named SVG fragments instead of a string. The engine
picks the variant from the current emotion, talking state and blinking:

| part    | variants the engine looks for                                                        |
| ------- | ------------------------------------------------------------------------------------ |
| `mouth` | `closed` (rest), `open` (talking flap, surprised), `smile`, `sad`, `angry`, `scared` |
| `eyes`  | `open`, `closed` (blink), `wide` (surprised/scared), `happy`, `sad`, `angry`         |

Missing variants fall back to the next in the list (angry eyes → open, scared
mouth → open → closed); `write_character` lists every fallback in its text
and the pose sheet labels the cell (`angry · eyes→open`), so a missing
variant is never silent. `mouth.open` and `eyes.closed` are what make a
character feel alive. A variant may be the empty string `""` to
draw nothing (a beak's closed mouth when the beak is part of the body) as long
as one variant of the part draws something. Any other part may have variants
too (`body: { dark, lit }` on a lantern, `hat: { on, tilted }`); select them
with a `face` action, e.g. `{ "face": { "hat": "tilted" } }`. The pose sheet
shows one cell per such variant at the end, so check them there.

### Springs

`springs` lists parts that swing behind the motion on their own: a tail
trails when a walk starts and flicks past on the stop, ears bounce on a
landing. On the quadruped the default is `["tail", "earL", "earR"]`; other
rigs have none. Write your own list to change it (`["tail", "scarf"]`), or
`[]` to keep every part rigid. A part the rig places turns about its pivot,
so draw it hanging from there; a part the rig does not know (`hair`,
`scarf` on a humanoid) sways in place by a few units instead. The
construction sheet marks spring parts with `~`. Nothing in a shot drives a
spring: it follows the motion the engine makes.

### Shadow

Every person and animal stands in a soft ground shadow the engine draws
under its feet, as wide as the rig's stance; it shrinks and fades as a jump
or a bounce lifts the body, and goes while the character flies or is
carried. The simple rig has none by default, since birds and kites hang in
the air: set `"shadow": true` on a prop that sits on the ground (a lantern,
a basket), or `false` on anything that should not touch the floor (a ghost,
a reflection). The pose sheet draws it.

### Colours

`colors` is a map of token → colour. Inside part SVG write `{skin}`, `{hair}`
and so on. Copying a library character and changing `colors` is the fastest
way to make a new cast member. Undefined tokens are a validation error.
`line` is the outline colour (below); define it to use `{line}` for line work.

## Drawing style

One style for every character, so a cast looks like it came from one show:
an **outlined cartoon**. Flat colour shapes, bold and round, with a dark line
around them. The library characters are the bar; read one before drawing.

- **Do not draw outlines.** The engine draws the line around every part,
  the same width on screen for the whole cast, thinner on `eyes` and `mouth`.
  Shapes inside one part merge into one silhouette; a part in front of
  another (the near arm over the torso) gets its own line where they cross.
  The exception is a four-legged animal's head, which joins its body
  without a line.
  It uses `colors.line` (default `#2e2633`, near-black plum). Set `"outline":
false` only for something that should not look drawn: a glow, a ghost.
- **Flat fills.** One base colour per area plus one darker shade of it for
  inner detail: a muzzle, a belly, an inner ear, a hem. No gradients on
  characters. Faint shapes (`opacity` below 0.95, e.g. blush at `0.5`) and
  thin strokes (under 8 wide) get no outline, so they read as detail.
- **Line work inside the silhouette** (a closed mouth, eyebrows, a nose, a
  crease) is a stroke in `{line}`, 3–4 units, round caps.
- **Eyes** are a white, a dark iris and a small white highlight up and to the
  side. The iris sits toward where the character looks; a blink is a curved
  `{line}` stroke. Small animals may use a dark dot with a highlight.
- **Simple shapes**: a head is a circle or a rounded blob, a body a bean,
  limbs are tubes with round ends. On screen the box shrinks to about half
  size, so nothing readable is smaller than 6 units.
- Do not draw a ground shadow; the floor belongs to the scene.

## Construction

The rules a rig needs to move without coming apart. `write_character` checks
them on the drawing itself and returns the construction sheet; each numbered
warning has a matching red box on it.

- **Nothing outside the box.** This one is an error: the engine scales and
  places the box, and bubbles hang from its top.
- **Feet on the line**: shoes touch y=400 on the humanoid, all four paws or
  hooves touch y=200 on the quadruped; the lowest point touches y=200 on the
  simple rig, unless the thing flies.
- **Limbs are strokes from their pivot**, e.g. `<path d='M124 170 L130 280'
stroke='{skin}' stroke-width='18' stroke-linecap='round' fill='none'/>`. The
  round cap at the pivot looks the same at every angle, so the joint never
  shows a corner when the limb swings.
- **Sink, do not touch.** A limb overlaps the torso (or the quadruped's
  body) by at least 12 units, the neck reaches 12 units into the head, an
  ear sinks 12 into the head; a thin limb (a mouse's leg, a lion's tail)
  sinks three quarters of its width. Inside a part every piece (a leg,
  a tail, an ear, a pigtail) sinks at least 12 units (three quarters of its
  own width if it is thinner) into the shape it hangs from. Two shapes that
  only touch read as separate stickers, and a gap opens as soon as they move.
- **Draw order is depth.** Inside a part, write the far side first, then the
  body, then the near side: far legs, tail, body, near legs, head, ears.
- **Keep the head near the top of the box**, where bubbles hang.

## Scenes

A scene is an SVG fragment the size of the project (default 1280×720) plus
named **anchors**: floor points where characters stand. Add an anchor for
every door, chair, tree, table, path end you will use. Optional `scale` on an
anchor shrinks characters that stand further back (`0.7` for a distant path).
`ground` is the floor y for the built-in shortcuts `left`, `center`, `right`,
`offLeft`, `offRight` (off = 15% of the frame width outside the edge, 192 px
at 1280, so anything up to about 350 px wide starts fully hidden; for wider
characters use an explicit point further out).

Seating: `sit` puts the **bottom of the body** (just under the hips) on the
anchor, so a seat anchor goes on the seat surface, not on the floor. Give it
`floor`, the y of the floor under the seat, and a person sat there bends
their knees to put their feet on it (e.g. `"bench-seat": { "x": 1010, "y":
604, "floor": 655 }`). Without `floor`, sitting onto a seat from where the
actor stood takes that spot as the floor, and sitting where it stands is
sitting on the ground: legs out, knees up a little.

Keep anchors that two people use at the same time at least a character's
width apart (about 150 px, more if one stands further back at a smaller
`scale`), or the nearer one hides the other and their bubbles collide.

Optional `foreground` is drawn in front of the actors (a table edge, a fence).

### Layers and depth

When the camera pans or zooms, a flat scene slides past as one picture.
Split it into depths and it opens up:

- `far`: the sky, sun, clouds, far hills, the sea, a skyline. Drawn behind
  `svg`, it moves at half the stage's rate (`parallax.far`, 0 to 1; 0 holds
  it still like a sky). **It must fill the whole frame on its own**, down to
  the bottom edge (run the far hill or the sea to y=720), because a zoom
  shows more of it than you expect; and `svg` must leave the sky out, or it
  hides `far` (the validator warns about a full-frame rect in `svg`).
- `svg` and `foreground`: the stage, where the actors and every anchor are.
  They move with the camera exactly. Keep anchors on the stage: an actor
  standing on something in `far` slides off it when the camera moves.
- `near`: things right in front of the lens, drawn over everything (leaves
  hanging into a top corner, grass along the bottom edge, a window frame).
  It moves faster than the stage (`parallax.near`, 1 to 3, default 1.4).
  Keep it to the edges of the frame, where it cannot cover a face.

With the camera still, the layers line up as drawn. Interiors usually need
no `far`. The library `park` and `street` are layered; read them for the
split. The anchor sheet of a layered scene adds a strip underneath: each
layer on its own, then the camera zoomed into either side, where the far
layer should sit differently behind the stage with no gap anywhere.

Design tips: the floor band should be the bottom 15–25% of the frame; keep
the middle third uncluttered where faces and bubbles go; a 220px character is
about a third of the frame height. The anchor sheet shows a ghost for scale:
the project's tallest character once one exists (so write characters before
scenes), otherwise a 220px humanoid.
Gradients and `<defs>` are fine; prefix ids with the scene id. Keep
backgrounds soft and low in contrast so the outlined characters pop; props
and foreground objects a character touches (a bench, a well, a door) get a
`#2e2633` outline of about 3 px, like the characters.

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
    { "t": 5.5, "actor": "dad", "say": "A kite! Let's fly it.", "emotion": "happy" },
    { "t": 8, "actor": "mia", "do": "jump" },
    { "t": 9, "camera": { "zoom": 1.6, "x": 400, "y": 500 }, "duration": 2 }
  ]
}
```

- `cast` places everyone at the start. Characters not in the cast are not in
  the shot. `visible: false` hides until an `appear`.
- **Draw order is by feet position:** the actor whose feet are lower on
  screen is nearer and is drawn in front. Cast order and size do not matter.
  When two actors share a path and one must pass behind, give it an anchor or
  point with a smaller `y`.
- A position (`at`, `to`, `set.at`) is an anchor name or an explicit point in
  scene pixels, `{ "x": 640, "y": 610, "scale": 0.8 }` (`scale` optional).
  A `to` with a `scale` tweens the size during `walk`/`move`/`fly`: use it to
  walk into the distance, or to sink into a well (`move` to a point with
  `scale: 0.3` behind a `foreground`).
  Anchors read better and survive a scene redraw; use points for spots the
  scene has no name for, such as a kite in the sky.
- `t` is seconds from the start of the shot. Actions on the same actor can
  overlap (walk and say at once). Actions never carry across shots.
- Shots play in file order; pass `order` to `write_shot` to set it.
- A shot is a cut from the one before. `crossfade: 1` dissolves it in from
  the previous shot over its first second instead, while the previous shot's
  last moment carries on underneath: use it for time passing or a change of
  place that should feel soft. The previous shot then needs no `fadeOut`
  (it would dissolve from black). `fadeIn`/`fadeOut` still fade from and to
  black, for the start and end of the film.

### Verbs (`do`)

| verb                  | what happens                                                               | duration default |
| --------------------- | -------------------------------------------------------------------------- | ---------------- |
| `walk` / `run`        | planted-foot cycle to `to`, easing in and out (four legs: gallop)          | distance ÷ speed |
| `move`                | glide to `to` without a cycle (sliding, floating objects)                  | distance ÷ 300   |
| `fly`                 | move with a gentle wobble (birds, kites, balloons); `to` may be in the sky | distance ÷ 260   |
| `jump`                | crouch, leap (in place, or to `to`), land with a give                      | 0.8s             |
| `wave`, `point`       | near arm (or front paw) up and waving / pointing (simple rig: lean toward) | 1.5s             |
| `nod`, `shake`        | head yes / no                                                              | 0.8s             |
| `tremble`             | frightened shiver (head and shoulders, or the whole simple body)           | 1.2s             |
| `sit` / `stand`       | persistent: seat on `to` (a seat anchor), knees bent; four legs sit down   | 0.4s ease        |
| `lie`                 | persistent: sits, then lies back on the floor (four legs: on the belly)    | 1.3s ease        |
| `bounce`, `spin`      | squashy hop / full rotation (best on the simple rig)                       | 1s / 0.8s        |
| `appear`, `disappear` | pop in past full size and settle / swell a touch and shrink away           | 0.4s             |

Walking speed is about 220 px/s, so crossing the frame takes 4–5 seconds;
`run` is about 420 px/s, `fly` 260, `move` 300. Set `duration` to override any
default. Any duration works with feet planted: the engine fits the stride
and its rate to the speed and the character's size, so a small dog keeping
up with a walking child patters and a lion strolls. A walk starts and ends
with the feet together, and a jump crosses the ground only while it is in
the air (the crouch and the landing stay put). Every change of facing, by
`set` or by walking the other way, is a quick turn (0.2 s), not a flip.

`lie` is for sleeping and resting. A person sits down on the ground (or on
`to`, a bed or a sofa seat) and lies back with the head behind them, so
face them the way their feet should point; an animal lies on its belly
with its head down. A sleeper needs `face: { "eyes": "closed" }` and,
if you like, a thought bubble (`"Zzz..."`): it comes from the head where it
lies. `stand` gets up again (sitting up first) and `sit` sits back up;
`stand` before walking off, or the walk slides while they get up. To open a
shot with someone already lying or sat, give the `lie` or `sit` at `t: 0` a
`duration` of `0.05`.

On the `simple` rig `wave`, `nod` and `shake` only tilt or nudge the body;
`point` leans the body toward what it faces, `tremble` shivers it, and
`bounce`, `jump` and `spin` read best there. Face the actor toward the thing
first (`set: { "facing": … }`) and `point` will lean that way.

### Carrying (`attach`)

To have someone carry something, make the prop a character (usually `simple`)
and attach it: `{ "t": 0, "actor": "lantern", "attach": "pip" }`. From then
on it hangs from the carrier's near hand (a four-legged animal carries it in
its mouth), follows every walk, swing and jump, faces the way the carrier
faces and is drawn just in front of them; its own moves are ignored. To put
it down, `{ "t": 7.5, "actor": "lantern", "attach": false, "do": "move", "to":
"pedestal-top" }`: it is let go where the hand is, and the `move` in the same
action carries on from there; a `set: { "at": … }` in the same action puts it
down there at once instead. Give the prop a `grip`, the point in its own box
the hand holds (`[100, 22]` for a lantern's handle, the end of a balloon's
string); without one it is held at its middle. The construction sheet marks a
character's `hold` point and a prop's `grip`. Carry one thing at a time, and
do not carry a carrier.

### Dialogue

`say` draws a bubble above the head and flaps the mouth. Duration defaults to
1 s plus 0.4 s per word (min 1.8 s), so a six-word line stays up for 3.4 s;
set it explicitly for pacing. `bubble` can be `speech` (default), `thought` or
`shout`; a thought keeps the mouth still and nobody turns to look. Keep lines
short (≤ 12 words) and sequence speakers so bubbles do not overlap:
`write_shot` warns when one actor starts speaking before another has finished. A bubble pops out of the speaker's head and shrinks back into it.
Bubbles are always laid out inside the frame and keep the same size at any
camera zoom, so a bubble that looks clipped on a small contact-sheet frame is
not; check the text, not the edges.

Everyone listens without being told: while someone speaks, the others with
eyes tip their heads toward the speaker (up to a grown-up, down to a dog), and
the speaker looks at the one spoken to. That is whoever spoke to them last,
or the nearest actor in front; when it would be someone else, name them with
`to`: `{ "t": 4, "actor": "mia", "say": "Can we go?", "to": "dad" }`. Walking,
jumping and pointing look straight ahead. The engine never turns anyone round
to look, so set `facing` so that people who talk face each other.

### Emotion, face, captions, camera, set

- `emotion`: `neutral | happy | sad | surprised | angry | scared` — persistent
  until changed. Each change gets a short take: a blink and a quick head move
  (thrown back for surprise, dropped for sadness). `face: { "mouth": "grin" }`
  forces specific variants for the rest of the shot, which also stops that
  part blinking or talking; `face: { "mouth": "" }` hands it back.
- `caption`: narrator text at the bottom (`captionStyle: "narration"`, the
  default) or a big centred card (`"title"`). Default 3 s. Captions are a
  layer above everything and do not follow the camera (narration rises into
  place as it fades in): a narration strip can run under a
  speech bubble without touching it, but a title card sits in the middle of
  the frame where faces and bubbles are, so do not talk over one.
- `camera: { zoom, x, y }` tweens from the current camera over `duration`
  (default 1 s; `0` cuts). `x, y` is the world point at frame centre. Zoom in
  on a face for reactions, pull back for arrivals. Keep zoom between 1 and 2:
  below 1 is raised to 1 (the scene has nothing outside its edges), and the
  view is clamped to the scene, so a zoom near an edge shifts toward the middle.
  A layered scene's `far` and `near` move at their own rates (see Scenes),
  and above zoom 1.3 the frame's edges darken a little, more the closer in.
- `set: { facing, scale, visible, at }` changes state instantly (teleport,
  grow); a new `facing` turns round over 0.2 s.

## Pacing a children's story

- Open with a title card over the first scene (`fadeIn`, `caption` style
  `title`), close with "The End" and a `fadeOut`.
- One idea per shot. Enter, react, speak, leave. 8–15 seconds is typical.
- Let a line land: leave ~0.5 s after a bubble before the next one.
- Alternate wide shots (walks, arrivals) with closer camera zooms (feelings).
- Use `emotion` generously: a story reads through faces.
- **When the plot turns on what a character sees, cut to what they see.** A
  reflection in a well, a letter, a monster behind the door: the wide shot
  cannot show it, so write a scene from that character's viewpoint (looking
  down the well: rim, shaft, water) and a short shot in it where the thing
  seen is the only cast member, drawn large. In the wide shot before the cut,
  make the character look: `point` on the simple rig leans the body toward
  the thing, `emotion: surprised` sells it. See `examples/clever-rabbit`
  shots 07 to 09.
- Every `walk` needs enough `duration` or the character will sprint.

## Checklist before `render`

- `project_info` shows no validation errors or warnings you did not intend,
  construction warnings included.
- Every shot's contact sheet looks staged: nobody floating, nobody clipped,
  right people facing each other, the right actor in front.
- Total duration matches what was asked for: a short fable is 60–120 s, a
  full picture-book story 5–10 minutes.
- The film sheet returned by `render` shows every shot the way you intended.
