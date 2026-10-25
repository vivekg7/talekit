# talekit authoring guide

You are turning a story into a short 2D animated film. talekit owns the
animation; you own the design and the staging. You write characters,
scenes and shots (all JSON, all validated) and look at the picture that
comes back after every write. Fix what looks wrong before moving on.

## Workflow

1. **Plan.** List characters, locations and 6–40 shots of 5–20 s each. A
   shot is one location with one bit of action. A reel for a phone held
   upright is a project of its own (see
   [A reel](#a-reel-the-portrait-version)).
2. **`create_project(path, title)`** once; `path` is the absolute project
   directory and every later tool takes it. Then `list_library()`, and
   `set_audio(path, narrator, music)` (see [Sound](#sound)).
3. **Characters.** Prefer `copy_from_library(path, libraryId, asId, name,
colors)` (tokens such as hair, skin, dress); without `name` the copy is
   named from `asId` (`old-man` is "Old man"). Draw with
   `write_character(path, character)` only what the library lacks (a
   dragon, a robot, a kite), after reading `get_library_item` for a
   character on the same rig. It returns the pose
   sheet (proportions, expressions, variant fallbacks) and the construction
   sheet (part boxes, pivots, silhouette, joints in a swing, a numbered red
   box per numbered warning). Rewrite until it looks right and the warnings
   are gone. A library copy returns only the pose sheet. Give every
   character that speaks a `voice` from `list_voices`.
4. **Scenes.** `copy_from_library` or `write_scene(path, scene)`, then read
   the anchor sheet: every place a character stands or sits needs an anchor
   on the floor. The library's jungle, cave, village hut and pond are
   painted in detail: copy one and add the places the story needs with
   `anchors` (`{ "well": { "x": 420, "y": 660 } }`, which also moves an
   anchor of that name) rather than painting a new scene.
5. **Shots.** `write_shot(path, shot, order)` one at a time, in order.
   Study the contact sheet: people where you expect, facing each other,
   bubbles readable, timing sensible. Write sheets are drawn small;
   `preview_frame(path, shotId, t)` and `preview_shot(path, shotId,
frames)` are full size. To fix a shot, `patch_shot(path, shotId, …)`:
   `edit` merges fields into an action by index (`{ index: 3, fields: { t:
4.5 } }`, null removes a field), `remove` takes actions out, `add` puts
   new ones in, `set` replaces top-level fields (`duration`, `camera`), and
   `cast` replaces, adds or (null) removes cast members. Indices are the
   actions before the patch, as `get_item` lists them. It validates like
   `write_shot`, keeps the shot's place and returns a sheet of the stretch
   that changed. Restaging from the beginning is `write_shot`.
6. **`render(path, shotId?)`** one shot early to check motion, then the
   whole film, which returns a film sheet (one frame per shot) and, unless
   it is a reel, `out/movie.mkv` (see
   [Subtitles and the .mkv](#subtitles-and-the-mkv)).
7. **Review notes.** The person watches in the review app (`talekit serve
<path>`) and leaves notes on a character, a scene or a moment of a shot.
   When `project_info` reports open notes, or you are asked to "fix my
   notes", `list_notes(path)` gives each with the picture the person saw.
   Fix it, check the new picture, then `resolve_note(path, id)`. Do not
   resolve a note you did not act on; say why instead.

## Coordinate boxes

Characters are drawn into a fixed canonical box, facing **right**. The
engine scales the box to `height` pixels, puts its bottom-centre on the
anchor (the feet point) and mirrors it for `facing: "left"`. On every rig
L is the far side and R the near side.

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
extra parts, `head`, `face`, `eyes`, `mouth`, `armR`. `armR` is the near
arm (waves, points). A part placed with `hangs` is drawn next to the part
it hangs from; one hung behind the head (a plait) goes behind the torso
while the character walks toward the viewer, fading across as they turn.

The library has a girl (`kid`), a `boy`, a man (`grownup`), a `woman` in a
kurta with a plait, a `farmer` in a pagdi and dhoti, a bald `grandpa` in
glasses and a waistcoat, a `grandma` in a sari, and a `pirate` with an eye
patch and a peg leg. Copy and recolour the nearest before drawing a person.

- **`hem`.** The torso ends at about y=292. A kurta, coat or dress drawn
  lower says where with `"hem"` (the grandpa's kurta: 324), so sitting
  rests the hem on the floor or hangs it over a seat's edge. The
  construction check gives the number when it is more than 5 out. A skirt
  drawn on the legs (the grandma's sari) bends with the knees and parts in
  a stride. A peg leg below the knee (the pirate) bends and plants like any
  shin. `eyes` draws over `face`, so an eye patch goes in every `eyes`
  variant.
- **Draw the face front-on; the engine turns it.** `face` (nose, cheeks,
  freckles, glasses: everything but eyes and mouth), `eyes` and `mouth` are
  drawn looking straight out, centred on x=100, inside x 64..136. The
  engine slides them 22 units toward the facing side and narrows them to
  0.8, and brings them through front-on as the character turns. Detail
  drawn in `head` stays put, so the nose would end up behind the eyes.
  Draw the rest of the head three-quarters: hair, an ear or a bow on the
  far (left) side only; a collar or buckle a little right of centre. Draw
  the torso front-on too: the engine narrows it (0.88) and turns a walker
  further, nearly side-on.
- **Give `head` and `torso` a back.** Walking into the screen (up it more
  than across) the character turns away: the face parts hide and every
  part with a `back` variant draws it. Make `head` and `torso` `{
"default": "…", "back": "…" }`: the back of the head (hair over it, both
  ears or pigtails), the torso without collar or buttons. Without a `back`
  the head shows a blank face, which suits only a bald character. Walking
  out of the screen the face turns to the viewer and the limbs foreshorten.
- **Legs bend at y=330, arms at y=226.** The engine cuts the limb there and
  turns the lower half with a round joint as wide as its stroke. Draw each
  as one straight stroke from its pivot (see
  [Construction](#construction)), the hand or shoe at the end, any sock or
  shoe below the knee; a sleeve may cross the elbow.
- **Put detail where cloth folds**: above and behind the knee, trousers
  breaking over the shoe, a shirt bloused over its belt, a curled finger
  line. Leave thin bare limbs plain: at half size a crease on a 16-unit
  stroke reads as a scratch.
- **Hair that swings is its own part**, hung from the head where it is tied
  (`hangs`, see [Springs](#springs)) and listed in `springs`; keep the
  bobble or band on the head so the tie stays put.
- The neck is in the torso, reaching at least 12 units into the head; the
  torso ends at least 12 units below the hips.

### `quadruped` rig — 260 wide × 200 tall, feet on y=200

Four-legged animals. The library has a dog, cat, rabbit, deer, lion, tiger,
bear, fox, jackal, crocodile and mouse: recolour one when you can, and read
`get_library_item("dog")` before drawing a new one.

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

Draw order (back → front): `legBL`, `legFL`, `tail`, `body` (required),
extra parts, `legBR`, `legFR`, `earL`, `earR`, `head`, `eyes`, `mouth`. The
legs, tail and head hang from the body, so they follow it when it tips
back to `sit` or rocks in the gallop; the ears and face hang from the head.

- **`belly`.** The underside of the body sits near y=152, which `lie` puts
  on the floor. Drawn higher (a slender deer: 140) or lower (a round
  rabbit: 166), say so with `"belly"`; the check gives the number when it
  is more than 5 out. `"hooves": true` (a deer, a goat, a horse) folds the
  forelegs under the chest when lying, instead of stretching the paws out
  in front. A low animal still stands on y=200 (the crocodile has long
  legs; in water the scene hides them).
- **Legs** are round-capped strokes straight down from their pivot (`<path
d='M194 132 L194 189' stroke='{fur}' stroke-width='18'
stroke-linecap='round' fill='none'/>`) with a paw or hoof reaching
  y=200. Give the body a deep chest and rump so it covers every pivot by 12
  units; a short leg (a rabbit, a mouse) still starts at its pivot. Far
  legs a shade darker. Below the knee (y=166) the leg runs down the
  pivot's x, or the bend shows a notch.
- **Near legs join the body without a line**, like the head, so a haunch
  grows out of the rump. Give it form with a tapered `{line}` crease down
  the front of the thigh, open at the top; a hind leg's haunch ends a few
  units above the knee. A bump behind the leg above the knee is the hock,
  with a short tapered line down the back of the heel; the near front leg
  gets the same at the elbow. Draw them after the leg's stroke, below the
  neck and mane, which hide anything higher.
- **Head** includes the neck: a thick stroke from inside the chest, so a
  nod lowers the whole neck; no line crosses where it sinks in. Muzzle
  inside x ≤ 260.
- **Ears** sit behind the head: draw each from at least 12 units below the
  head's edge to its tip, covering its pivot. A floppy ear hangs past the
  back of the head.
- **Tail** starts inside the rump, covering (44,110); it can curve anywhere
  in the box.
- **Face**: one eye in profile (white, iris, highlight) and a mouth under
  the muzzle, with the usual variants.

The engine walks it in diagonal pairs with planted feet and gallops it
for `run`. A turn takes about 0.7 s (a person's 0.2 s), the head first and
the feet stepping round. The tail and ears are springs by default. `height`: about 55 for a mouse, 90–110 for a cat or
dog, 170–190 for a lion, bear or deer.

### `simple` rig — 200 × 200, base on y=200

One required `body` part plus optional `eyes` and `mouth`, for birds, fish,
vehicles, kites, balls, blobby monsters and props: anything that bobs,
hops or flies rather than walks. The engine bobs and tilts the whole body
for walk/run, hops it for `bounce`, wobbles it for `fly`, rotates it for
`spin`, leans it the way it faces for `point` (set `facing` first),
shivers it for `tremble`, settles it lower and wider for `lie`; `wave`,
`nod` and `shake` only tilt or nudge it.

```
 x   0 ──────────── 200
 y 0 ┌──────────────┐
     │   (tail)  head│   faces RIGHT: head and face in the right half, around
     │  ╭──────╮ ◠ ◡ │   x 130–190; tail or back on the left. The engine
     │  │ body │(eyes│   mirrors the whole box for facing: "left".
     │  ╰──┬┬──╯mouth│
 y200└────┴┴────────┘   base line y=200: feet, wheels or base touch it.
```

`body` is one group with wings, tail and head drawn in; `eyes` has `open`,
`closed`, `wide`, `happy`; `mouth` has `closed`, `open`, `smile`, `sad` (a
beak is a mouth). Keep the head near the top, where bubbles hang.
`get_library_item("bird")` is the worked example; the library also has a
`crow`, `parrot`, `swan` (no feet: water covers them), `frog`, `fish` (its
tail a hung spring part) and a rigid coiled `cobra` whose open mouth shows
fangs, so talking reads as a hiss. `height`: 50–80 for a bird, 80–140 for
a prop or small creature.

### Variants

A part can be a map of named SVG fragments instead of a string. The engine
picks the variant from the emotion, talking and blinking:

| part    | variants the engine looks for                                                        |
| ------- | ------------------------------------------------------------------------------------ |
| `mouth` | `closed` (rest), `open` (talking flap, surprised), `smile`, `sad`, `angry`, `scared` |
| `eyes`  | `open`, `closed` (blink), `wide` (surprised/scared), `happy`, `sad`, `angry`         |

A missing variant falls back to the next in the list (angry eyes → open,
scared mouth → open → closed); `write_character` lists every fallback and
the pose sheet labels the cell (`angry · eyes→open`). `mouth.open` and
`eyes.closed` make a character feel alive. `""` draws nothing (a beak's
closed mouth drawn in the body) as long as some variant of the part draws.
Any other part may have variants (`body: { dark, lit }` on a lantern), set
with a `face` action (`{ "face": { "hat": "tilted" } }`); the pose sheet
shows one cell per variant at the end.

### Springs

`springs` lists parts that swing behind the motion on their own: a tail
trails when a walk starts and flicks past on the stop, ears bounce on a
landing. The quadruped's default is `["tail", "earL", "earR"]`; other rigs
have none; `[]` keeps every part rigid. A part the rig places turns about
its pivot; one it does not know sways in place by a few units, unless you
hang it. Nothing in a shot drives a spring. The construction sheet marks
spring parts with `~`.

`hangs` places a part the rig does not know: the part that carries it
(`from`) and the point in the box it turns about (`at`). It moves with
that part and is drawn just behind it (just in front with `"front":
true`). The library kid's pigtails:

```json
"hangs": {
  "pigtailL": { "from": "head", "at": [31, 103] },
  "pigtailR": { "from": "head", "at": [172, 105] }
},
"springs": ["pigtailL", "pigtailR"]
```

Draw a hung part hanging from `at`, reaching into the part it hangs from;
the linter checks that joint. A part may hang from another hung part (a
ribbon on a pigtail).

### Shadow

People and animals stand in a soft ground shadow as wide as their stance,
which shrinks as a jump lifts them and goes while they fly or are carried.
The simple rig has none by default: set `"shadow": true` on a prop that
sits on the ground (a lantern, a basket), `false` on anything that should
not touch it (a ghost, a reflection). Scene lights add a cast shadow too
(see [Lights and cast shadows](#lights-and-cast-shadows)); a carried
prop's goes with its carrier's.

### Colours

`colors` maps token → colour; part SVG writes `{skin}`, `{hair}` and so on.
An undefined token is a validation error. `line` is the outline colour;
define it to use `{line}` for line work.

## Drawing style

One style for every cast, an **outlined cartoon**: flat colour shapes,
bold and round, with a dark line around them. The library characters are
the bar; read one before drawing.

- **Do not draw outlines.** The engine draws one around every part, the
  same width on screen for the whole cast, thinner on `eyes` and `mouth`,
  in `colors.line` (default `#2e2633`). Shapes inside one part merge into
  one silhouette; a part in front of another gets its own line where they
  cross; a four-legged animal's head and near legs join its body without
  one. `"outline": false` only for a glow or a ghost.
- **Do not draw shading.** The engine darkens every part on the side away
  from the light (the scene's sun, else high on the left, or a nearby
  `fire` with a warm rim), turning with the part as it swings; a limb
  shades down its length and under its hand or shoe; an animal's head and
  body shade as one shape. `"shade": false` only
  for something with no form or that gives light: a glow, a flat sign.
- **Do not draw a ground shadow**; the floor belongs to the scene.
- **Flat fills**: one base colour per area plus one darker shade for inner
  detail (a muzzle, a belly, a hem). No gradients on characters. Faint
  shapes (`opacity` under 0.95, e.g. blush at 0.5) and strokes under 8 wide
  get no outline, so they read as detail.
- **Line work inside the silhouette** (closed mouth, eyebrows, nose,
  crease) is a `{line}` stroke, 3–4 units, round caps.
- **Eyes**: a white, a dark iris toward where the character looks, a small
  white highlight up to the side; a blink is a curved `{line}` stroke. Small
  animals may use a dark dot with a highlight.
- **Simple, shaped forms**: a head is a circle or rounded blob, a body a
  bean with a dip in the back and a deep chest (not a box between two
  ellipses), limbs tubes with round ends. Taper what tapers (a tail, a
  haunch, a stripe) as a filled path, not an even stroke. On screen the box
  is about half size, so nothing readable is under 6 units.

## Construction

What a rig needs to move without coming apart. `write_character` checks it
on the drawing and returns the construction sheet, a red box per numbered
warning.

- **Nothing outside the box.** An error: the engine scales and places the
  box, and bubbles hang from its top. Keep the head near the top.
- **Feet on the line**: shoes touch y=400 (humanoid), all four feet y=200
  (quadruped), the lowest point y=200 (simple, unless it flies).
- **Limbs are strokes from their pivot**, e.g. `<path d='M124 170 L130 280'
stroke='{skin}' stroke-width='18' stroke-linecap='round' fill='none'/>`,
  plus a hand circle or a shoe. The round cap shows no corner at any angle.
  Draw every part in absolute box coordinates, hanging from its pivot, with
  no `transform` on its outer elements.
- **Sink, do not touch.** A limb overlaps the torso or body by at least 12
  units, as do the neck into the head and an ear into it; a thin piece (a
  mouse's leg, a lion's tail) sinks three quarters of its width. Inside a
  part every piece sinks the same into what it hangs from. Shapes that only
  touch read as stickers and gap as soon as they move.
- **Draw order is depth.** Inside a part, far side first, then the body,
  then the near side.
- **Inner SVG only** (`<path>`, `<circle>`, `<rect>`, `<g>`…): never
  `<svg>` or `<image>`, no external references. Prefix any `id` with the
  character's id.

## Scenes

A scene is an SVG fragment the size of the project (default 1280×720, a
reel's 720×1280) plus named **anchors**: floor points where characters
stand. Add one for every door, chair, tree, table and path end you will
use. An anchor's optional `scale` shrinks whoever stands there (`0.7` for
a distant path). `ground` is the floor y for the shortcuts `left`,
`center`, `right`, `offLeft` and `offRight` (default 0.9 × height; off is
15% of the width outside the edge, 192 px at 1280, which hides anything up
to about 350 px wide; place wider characters further out).

**Seats.** `sit` puts the bottom of the body on the anchor, so a seat
anchor goes on the seat surface, with `floor`, the y of the floor under it,
where the feet go: `"bench-seat": { "x": 1010, "y": 604, "floor": 655 }`.
Without `floor`, sitting onto a seat takes the spot the actor stood on as
the floor, and sitting where it stands is sitting on the ground. `stand`
or a walk off gets up onto the floor in front; an animal hops up onto a
raised seat and down again. A `sit` or `lie` with a `to` more than 24 px
away walks there first.

Keep anchors two people use at once a character's width apart (about 150
px, more at a smaller `scale`), or one hides the other and their bubbles
collide.

`foreground` is drawn in front of the actors (a table edge, a fence).
Water is a translucent foreground: the library pond lays its surface over
the pond from the waterline down, so a swan in it is cut at the waterline
and a fish placed lower swims wholly under it. A point lower in the water
sinks the actor deeper.

Keep the floor band to the bottom 15–25% of the frame and the middle third
uncluttered for faces and bubbles; a 220 px character is about a third of
the frame height. The anchor sheet shows the project's tallest character
(or a 220 px humanoid) as a ghost for scale, so write characters first.
Gradients and `<defs>` are fine; prefix ids with the scene id. Keep
backgrounds soft and low in contrast so the outlined characters pop; give
props a character touches (a bench, a well, a door) a `#2e2633` outline of
about 3 px.

### Layers and depth

A flat scene slides past as one picture when the camera moves. Split it
into depths:

- `far`: sky, sun, clouds, far hills, the sea, a skyline. Drawn behind
  `svg`, moving at `parallax.far` of the stage's rate (0 to 1, default
  0.5; 0 holds it still). **It must fill the whole frame on its own**, down
  to the bottom edge, since a zoom shows more of it than you expect; and
  `svg` must leave the sky out (the validator warns about an opaque
  full-frame rect in `svg`; a see-through tint is fine).
- `svg` and `foreground`: the stage, with the actors and every anchor,
  moving with the camera exactly. An actor standing on something in `far`
  slides off it.
- `near`: things right at the lens, over everything (leaves in a top
  corner, grass along the bottom edge), moving at `parallax.near` (1 to 3,
  default 1.4). Keep it to the edges, where it cannot cover a face.

Interiors usually need no `far`. The library `park` and `street` are
layered examples. A layered scene's anchor sheet adds each layer alone and
the camera zoomed into either side; look for gaps there.

### Weather and moving nature

Anything that moves by itself (rain, snow, clouds, fire, the sea) is drawn
by the engine every frame. **Do not draw rain streaks, snowflakes or
flames**: they would stand still. Draw the mood and what does not move
(wet pavement, snow on the ground, the fire pit's stones), and name the
rest. Paint the sky in fair weather and let `clouds` grey it, so clearing
them brings the blue back.

```json
"weather": {
  "rain": { "amount": 0.6 },
  "wind": 0.4,
  "clouds": { "amount": 0.8, "dark": 0.8 },
  "lightning": { "every": 6 }
}
```

- `rain` (`amount` 0.2 drizzle to 1 downpour) falls at three depths, with
  splashes on the floor around `ground`; `snow` is the same with swaying
  flakes. Both take `top`, the stage y they fall from (under a shelter
  across the whole frame top), and `scale`, the anchors' scale in a
  close-up scene drawn large.
- `wind` (-1 to 1, positive blows right) slants rain, carries snow, smoke,
  sparks and leaves, moves the clouds, and from 0.3 draws gusts.
  `leaves: { "amount": 0.5 }` sends leaves tumbling (`colors` recolours).
- `clouds` drift across the sky band (down to `low`, default 0.32 ×
  height). `dark` 0 is white, 1 a storm that darkens the sky and dims the
  frame. From `amount` 0.4 they wash the colour out of the far layer.
- `lightning` strikes about every `every` seconds, a bolt and a flash.
- `heat` (0 to 1) makes the far layer shimmer.
- `light: { "color": "#4a5a8f", "amount": 0.7 }` tints the characters,
  drawn in daylight colours, to a night (blue, ~0.7) or dusk (orange,
  ~0.5) scene. A `fire` then lights whoever comes near it.

Clouds, lightning and heat are drawn in `far`, so the scene needs one (the
validator warns).

**Shelters.** Rain and snow stop on a shelter, keep the ground under it dry
and drip off both ends. A scene lists its own, `shelters: [{ "x": 858,
"y": 500, "width": 224 }]` (a bench seat, a roof edge, a canopy; marked
blue on the anchor sheet). A character carries one in its own box,
`shelter: { "x": 13, "y": 50, "width": 180, "when": "open" }` (an
umbrella's canopy): `when` limits it to a variant, and a list gives one
span per variant.

**Changing weather.** A shot's `weather` replaces the scene's for the
shot; `{}` clears it. An action `{ "t": 4, "weather": { "clouds": {
"amount": 0.3 } }, "duration": 3 }` turns the weather in force into that
over `duration` (default 2 s); what it leaves out goes away.

`effects` places moving things, each in the coordinates of its `layer`:

```json
"effects": [
  { "kind": "fire", "x": 640, "y": 608 },
  { "kind": "smoke", "x": 645, "y": 500, "size": 0.8 },
  { "kind": "sun", "x": 980, "y": 130 },
  { "kind": "waves", "y": 390, "height": 170 },
  { "kind": "waterfall", "x": 640, "y": 180, "width": 150, "height": 360 }
]
```

| kind        | where `x`, `y` is                                  | what moves                                                                      |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `fire`      | the middle of the base, on the ground              | crossed logs (`logs: false` for none), flickering flames, a glow, rising sparks |
| `smoke`     | where it comes out (a chimney top, a flame's tip)  | puffs rising, swelling, drifting with the wind                                  |
| `waterfall` | the middle of the lip it pours over                | streaks pouring down `height`, foam, ripples and mist at the foot               |
| `waves`     | `y` is the far edge of the sea, `height` its depth | rows of crests, a swell rolling in, foam washing up the shore line and back     |
| `sun`       | the centre of the disc                             | a breathing halo and slowly turning rays                                        |

`size` scales fire (1 is a campfire about 110 px tall), smoke and the sun;
`color` recolours water, foam, smoke or sun. `layer` defaults to `far` for
the sun and `stage` (behind the actors) for the rest; `front` is in front
of the actors, `near` with the near layer. Waves on a sea drawn in `far`
need `"layer": "far"`. Draw the sea, the pool and the fire pit yourself.
The anchor sheet adds a row of the empty scene at a few moments.

### Lights and cast shadows

Every person, animal and grounded prop casts its silhouette across the
floor away from each light, soft and fading. A `sun` effect and every
`fire` are lights already; name a light painted into the art in `lights`
so the shadows agree with it:

```json
"lights": [
  { "kind": "moon", "x": 1180, "y": 63 },
  { "kind": "lamp", "x": 420, "y": 380, "reach": 600 }
]
```

- `sun` and `moon` are in the sky where painted: high, short shadows; low,
  long ones, falling toward the viewer and away from the light's side. A
  sun also lights the characters' shading. A moon's `strength` defaults to
  0.55.
- `lamp` is on the stage (a bulb, a lantern, a lit window): shadows run
  away from it, longer the further off and the lower it hangs, fading out
  at `reach` (default 700 px); faint by day, strong at night. A fire is a
  lamp at its flames.
- `strength` (0 to 1, default 1) is how dark the shadow is: 0.35 under a
  big tree. Clouds and rain dim a sun's shadows by themselves.

Shadows of painted things (a tree, a house) are the painter's: paint them
falling the same way.

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

- `cast` places everyone at the start; nobody else is in the shot.
  `visible: false` hides until an `appear`.
- **Draw order is by feet**: lower on screen is nearer and in front,
  whatever the cast order or size. To pass behind someone on a shared path,
  use an anchor or point with a smaller `y`.
- A position (`at`, `to`, `set.at`) is an anchor name or a point in scene
  pixels, `{ "x": 640, "y": 610, "scale": 0.8 }`. A `to` with a `scale`
  tweens the size during `walk`/`move`/`fly`: walking into the distance,
  sinking into a well behind a `foreground`. Anchors survive a scene
  redraw; use points for spots with no name, like a kite in the sky.
- `t` is seconds from the shot's start. One actor's actions can overlap
  (walk and say at once). Nothing carries across shots.
- Shots play in file order; `order` on `write_shot` sets it.
- A shot is a cut. `crossfade: 1` dissolves it in from the previous shot
  over its first second, for time passing or a soft change of place (the
  previous shot then needs no `fadeOut`). `fadeIn`/`fadeOut` fade from and
  to black, for the start and end of the film.

### Verbs (`do`)

| verb                  | what happens                                                               | duration default     |
| --------------------- | -------------------------------------------------------------------------- | -------------------- |
| `walk` / `run`        | planted-foot cycle to `to`, easing in and out (four legs: gallop)          | distance ÷ 220 / 420 |
| `move`                | glide to `to` without a cycle (sliding, floating objects)                  | distance ÷ 300       |
| `fly`                 | move with a gentle wobble (birds, kites, balloons); `to` may be in the sky | distance ÷ 260       |
| `jump`                | crouch, leap (in place, or to `to`), land with a give                      | 0.8s                 |
| `wave`, `point`       | near arm (or front paw) up and waving / pointing (simple rig: lean toward) | 1.5s                 |
| `nod`, `shake`        | head yes / no                                                              | 0.8s                 |
| `tremble`             | frightened shiver (head and shoulders, or the whole simple body)           | 1.2s                 |
| `sit` / `stand`       | persistent: seat on `to` (a seat anchor), knees bent; four legs sit down   | 0.4s ease            |
| `lie`                 | persistent: sits, then lies back on the floor (four legs: on the belly)    | 1.3s ease            |
| `bounce`, `spin`      | squashy hop / full rotation (best on the simple rig)                       | 1s / 0.8s            |
| `appear`, `disappear` | pop in past full size and settle / swell a touch and shrink away           | 0.4s                 |
| `pickup`, `putdown`   | on a prop, with `attach`: its carrier stoops to the floor for it (below)   | 1.2s                 |

Crossing the frame on foot takes 4–5 s. `duration` overrides any default,
and every walk needs enough of it or the character sprints; the engine
fits the stride to the speed and size, so a small dog keeping up with a
child patters. A walk starts and ends with the feet together; a jump
crosses ground only in the air. A change of facing, by `set` or walking
the other way, is a quick turn (0.2 s). Walking up the screen a person is
seen from behind, down it from the front, turning at the start and end of
the move; walk them mostly across to keep the face in profile.

`lie` is for sleeping and resting. A person sits (on the ground or `to`, a
bed or sofa) and lies back with the head behind them, so face them the way
the feet should point; an animal lies on its belly, paws out under its
chin. A sleeper needs `face: { "eyes": "closed" }` and maybe a `"Zzz..."`
thought bubble. `stand` gets up, `sit` sits back up. A `walk`, `run` or
`jump` from sitting or lying gets up first and ends that much later (0.4 s,
1.3 s); give a `stand` first for a slower rise. To open a shot with someone
already lying or sat, give the `lie` or `sit` at `t: 0` a `duration` of
`0.05`.

### Carrying (`attach`)

Make the prop a character (usually `simple`) and attach it: `{ "t": 0,
"actor": "lantern", "attach": "pip" }`. It hangs from the carrier's near
hand (an animal's mouth), follows every move, faces the carrier's way and
is drawn just in front; its own moves are ignored.

- **Let go**: `{ "t": 7.5, "actor": "lantern", "attach": false, "do":
"move", "to": "pedestal-top" }` lets it go where the hand is and the
  `move` carries on from there; a `set: { "at": … }` puts it there at once.
- **From the floor**: `{ "t": 5, "actor": "basket", "attach": "pip", "do":
"pickup" }` stoops the carrier, the hand closing on the prop halfway.
  Stand the carrier facing it about a third of their height in front of
  their feet (a 240 px person: 75 px); the validator says where to stand
  when the hand would miss. `"attach": false, "do": "putdown", "to":
"table-end"` is the reverse (without `to`, onto the floor under the
  hand).
- **Hand to hand**: attaching a prop already held passes it over. One
  attached from more than the carrier's height away is taken at once.
- `grip` is the point in the prop's box the hand holds (`[100, 22]` for a
  lantern's handle); default its middle. The construction sheet marks a
  character's `hold` and a prop's `grip`.
- One thing at a time; never carry a carrier. An umbrella with a `shelter`
  keeps its carrier dry.

Carrying holds across cuts only if staged: whoever ends a shot carrying
something starts the next one with it, cast and attached at `t: 0`, or
puts it down before the cut (the validator warns). A prop that appears in
a hand (`attach` with `appear`) is magic; when it came from somewhere, lay
it on the floor and pick it up.

### Standing on someone (`on`)

Draw order goes by the feet, so a mouse on a sleeping lion's back, feet
higher than the lion's, would be drawn behind it. Say whom it stands on:

```json
{ "t": 1.6, "actor": "chintu", "do": "jump", "to": { "x": 250, "y": 905 }, "on": "lion" }
```

with `to` on the lion's back (read it off a `preview_frame`). `on` goes on
a `walk`, `run`, `move`, `fly` or `jump` with a `to`, or with `set.at`. The
mouse is drawn in front of the lion from when it sets off, through hops in
place up there, until a move without `on` lands it elsewhere. A shot that
opens with it up there says so in the cast: `"chintu": { "at": { "x": 250,
"y": 905 }, "on": "lion" }`. It does not ride along: if the lion gets up,
move the mouse too, or carry it with `attach`. Never paint a character into
a scene to get round this; the real one breathes, blinks and wakes.

### Dialogue

`say` draws a bubble above the head and moves the mouth. A voiced line
stays up as long as it takes to say plus 0.5 s; an unvoiced one 1 s plus
0.4 s per word (at least 1.8 s). A `duration` keeps a voiced line up
longer (never shorter than its voice) and sets an unvoiced one's. `bubble`
is `speech` (default), `thought` (mouth still, nobody turns to look) or
`shout`. Keep lines to 12 words or fewer and let one speaker finish before
the next starts (`write_shot` warns when bubbles overlap). Bubbles stay
inside the frame at the same size at any zoom, so one that looks clipped
on a small sheet is not: check the text.

Hindi works: Devanagari is drawn in the bundled Baloo 2 whatever the
project's `font` (a Latin stack). Write it as in a book, `"अरे कछुए, तुम
कितने धीमे हो!"`; the same 12-word limit holds.

While someone speaks the others tip their heads toward them, and the
speaker looks at the one spoken to: whoever spoke to them last, or the
nearest actor in front, or the one named with `to` (`{ "t": 4, "actor":
"mia", "say": "Can we go?", "to": "dad" }`). Nobody is turned round to
look, so set `facing` so that people who talk face each other. Walking,
jumping and pointing look straight ahead.

### Emotion, face, captions, camera, set

- `emotion`: `neutral | happy | sad | surprised | angry | scared`,
  persistent until changed, each change with a blink and a head move.
  `face: { "mouth": "grin" }` forces variants for the rest of the shot
  (that part stops blinking or talking); `face: { "mouth": "" }` hands it
  back.
- `caption`: narration at the bottom (`captionStyle: "narration"`, the
  default) or a big centred card (`"title"`), for 3 s or as long as the
  narrator takes. Captions are above everything and ignore the camera; a
  narration strip can run under a bubble, but nobody should talk over a
  title card.
- `camera: { zoom, x, y }` tweens over `duration` (default 1 s; `0.05` is
  a cut); `x, y` is the world point at frame centre. Zoom in on a face for
  a reaction, pull back for an arrival. Keep zoom 1 to 2: below 1 is raised
  to 1 and the view is clamped to the scene, so a zoom near an edge shifts
  inward. Above 1.3 the frame's edges darken a little.
- `camera: { zoom: 1.6, follow: "kid" }` pans after a cast member, trailing
  a moment with room ahead, and settles when they stop: for a walk or chase
  longer than the frame. It needs zoom above 1 and a scene with things
  worth passing. On the shot's `camera` it follows from the start; in an
  action it eases across over `duration`; `x`/`y` or `follow: ""` lets go.
- `set: { facing, scale, visible, at }` changes state at once (a new
  `facing` still turns over 0.2 s).
- `lightning: true` (no actor) strikes at `t`, for a thunderclap on a beat.
- `weather: { … }` (no actor) changes the weather (see
  [Weather and moving nature](#weather-and-moving-nature)).

## Sound

A film has six layers of sound. You choose four; the engine makes the rest.

- **Voices.** Each speaking character gets a `voice` from `list_voices`:
  `"chatterbox:hm_omega"`, or `{ "id": "chatterbox:hm_psi", "pitch": 4 }`
  for a mouse. `chatterbox:` acts the line with its speaker's emotion and
  says Hindi best; the same voice as `kokoro:` reads evenly and is much
  faster, for a draft. `pitch` is semitones (3 to 5 up for a child or small
  animal, -3 a giant); `speed` 0.85 is slow and old, 1.15 quick. Lines are
  spoken locally when a shot is written (and before a render) into
  `audio/voices/`. The voice sets the language: Devanagari needs a Hindi
  voice (`write_shot` warns). `shout` is louder; `thought` quieter, with a
  little room on it. A character with no voice is silent. A line is said
  with the emotion the character has when it starts, so set `emotion` on or
  before every line not said calmly.
- **Sounds inside a line.** A growl, a giggle, a snore is not words: put it
  between asterisks and give the action the `sound`: `{ "t": 3, "actor":
"lion", "say": "*गुर्रर!* कौन है?", "sound": "lion-growl", "bubble":
"shout" }`. The bubble shows `गुर्रर! कौन है?`, the growl is heard with
  the mouth open, and the voice says `कौन है?` after it (2 s at most). A
  line that is only a sound is not spoken. `write_shot` warns about
  unmarked growls, laughs and snores, and a marked sound with no `sound`.
- **Narrator.** `set_audio(path, narrator: "chatterbox:hf_alpha")` reads
  every caption, narration and title alike.
- **Music.** `set_audio(path, music: "playful")` plays under the film. A
  shot's `music` changes it from there: `"tense"`, `{ "track": "sad",
"volume": 0.7 }`, or `false` for silence. The same track plays on across
  a cut; a new one crossfades in. It ducks under voices on its own. Change
  it only where the mood turns.
- **Ambience.** A scene's `ambience` loops the place's sounds: `["jungle"]`,
  `[{ "sound": "village", "volume": 0.6 }]`; the library scenes have
  theirs. It carries across cuts in the same place. `surface` (`hard`, the
  default, or `grass`) sets the footstep sound. Do not list rain, wind,
  fire, waterfalls or waves: weather and effects are heard on their own.
- **Effects.** `{ "t": 3, "actor": "lion", "sound": "lion-roar" }` plays at
  `t` from the actor's side of the frame; `volume` 0.5 far off, 1.5 close.
  A name with several takes picks one each time. `list_sounds` has the
  names. Footsteps, jump whooshes and landings, the `appear`/`disappear`
  sparkle and the pickup/putdown tap are the engine's: never add them.
- **Mix.** The engine sets every layer's level. Only when a listener finds
  a layer wrong, `set_audio(path, mix: { "music": 0.5 })` scales `voices`,
  `music`, `ambience` or `effects` for the whole film (1 as set, 0.5 is
  −6 dB, 2 is +6 dB); the review app has sliders for it.

A project's own sounds go in `audio/` (`.ogg`, `.wav`, `.mp3`, `.flac`)
and are named by file name without the extension; one named like a bundled
sound replaces it.

Every shot sheet shows the sound under the frames against the shot's
clock: a row per speaker, then effects, ambience and music, each line
marked with how long it takes to say; a line outlined in red is cut off by
the shot's end. `set_audio` shows the same for the whole film. To pace a
shot, write it, read the lanes, then with `patch_shot` start each line
about 0.3 s after the last ends and end the shot about 0.5 s after its
last line. `write_shot` warns when a line starts while a caption is still
being read, or before the same speaker's last line ends.

## Subtitles and the .mkv

Rendering the whole film writes `out/movie.mkv` beside `out/movie.mp4`:
the same picture with tracks a player can choose between.

- **Three sound tracks**: the full mix (default); music and effects
  without dialogue; and that plus the narrator. Sounds marked in a line are
  effects, so they stay in all three. The second and third are brought up
  to the first's loudness. No narrator, no third track; nobody speaking,
  only the first.
- **Subtitles**, off until chosen: one in the lines' language (Hindi for
  Devanagari, else English) and one per language in their `translation`,
  each up as long as its bubble or caption, at the bottom, or at the top
  when it belongs to (or overlaps) a narration caption. They are drawn in
  the bundled Baloo 2, which the .mkv carries.
- **A chapter per shot**, named by its id.

Write the translation with each line, keyed by language code:

```json
{
  "t": 2,
  "actor": "lion",
  "say": "*गुर्रर!* कौन है?",
  "sound": "lion-growl",
  "translation": { "en": "*Grrr!* Who's there?" }
}
```

Translate the meaning in words a child would hear: `अरे कछुए भाई` is "Hey
there, tortoise", not "Oh tortoise brother". Mark sounds as the line does.
Give it to every `say` and `caption` or to none (`project_info` warns
about gaps). A translation changes no picture or sound, so after adding
them, `talekit mkv <path>` rebuilds the .mkv in seconds.

## A reel: the portrait version

A reel (Instagram Reels, YouTube Shorts) is the story for a phone held
upright, its own project at 720 × 1280: `create_project(path, title,
width: 720, height: 1280)`. It is not the film cropped (a crop keeps a
third of the frame and loses whoever talks across it): it is told again,
shorter, in scenes drawn tall. The film's characters and voices can be
copied; the scenes and shots are new.

- **Three minutes at most** (the apps' limit; `project_info` warns past
  it). 90 to 170 s is a good length.
- **The narrator tells a reel.** A spoken line takes 3 to 4 s, so the
  film's conversations alone would fill three minutes with a quarter of
  the story told. The narrator carries the plot, a sentence or two a shot,
  over the picture of it happening, with the cast acting it out (a `walk`,
  a `pickup`, a munching `sound`, an `emotion`). A character speaks only
  where the words themselves turn the story (the challenge, the cry for
  help, the promise kept), a line or two a scene, never repeating the
  narrator. Keep every event the plot needs, above all those that explain
  the ending (the hare eats until he is too full to stay awake, which is
  why he sleeps through the race); cut what only decorates it (greetings,
  the walk there, a line that says the last one again). Write the
  narration afresh, not the film's lines cut down.
- **The app draws over the edges**: account name, caption and sound along
  the bottom fifth, buttons down the right, icons across the top. The
  engine keeps bubbles and captions clear (narration goes at the top,
  under the icons, over the sky); keep faces and action clear too. Stand
  people with their feet at about y = 1000 (a reel's `ground` defaults to
  0.78 × height), between x 45 and 620, with floor or foreground painted
  below.
- **Draw scenes tall.** `far` fills 720 × 1280 on its own. Use the height:
  a trunk rising into its canopy, rock above a cave, sky. The library's
  1280 × 720 scenes do not fit; draw tall ones in the same style.
- **Stage close.** Two people side by side, 150 to 250 px apart (a reel's
  `left` and `right` are at 26% and 72% of the width). Draw the scene so
  the wide shot holds the cast large: anchor `scale` 1.3 to 1.6 for the
  library's people and animals, zoom 1.3 to 1.8 for a face. Text is scaled
  by the short side, so it matches a film's. For a closer view of someone,
  zoom the camera onto the character; never paint part of a character
  large into a scene.
- **One file to post.** `render` writes only `out/movie.mp4`, one picture
  and one sound track, bubbles and captions in the picture; no .mkv, since
  the apps play neither extra sound nor subtitle tracks.

## Pacing a children's story

- Open with a title card over the first scene (`fadeIn`, `caption` style
  `title`), close with "The End" and a `fadeOut`.
- One idea per shot: enter, react, speak, leave. 8–15 s is typical.
- Let a line land: about 0.5 s after a bubble before the next one.
- Alternate wide shots (walks, arrivals) with closer zooms (feelings).
- Use `emotion` generously: a story reads through faces.
- **When the plot turns on what a character sees, cut to what they see.**
  A reflection in a well, a letter, a monster behind the door: write a
  scene from their viewpoint (looking down the well: rim, shaft, water) and
  a short shot in it with the thing seen as the only cast member, drawn
  large. Before the cut, make the character look (`point`, `emotion:
surprised`). See `examples/clever-rabbit` shots 07 to 09.

## Checklist before `render`

- `project_info` shows no validation or construction warnings you did not
  intend.
- Every contact sheet looks staged: nobody floating or clipped, the right
  people facing each other, the right actor in front.
- Props are continuous: what is carried at a shot's end is in hand at the
  next one's start, nothing is taken that was not lying there, and a prop
  put down stays down in later shots in the same place.
- A scene with a painted sun, moon or lamp names it in `lights`.
- Everyone who speaks has a `voice`, the project has a narrator and music,
  no line is outlined in red, and nobody talks over the narrator.
- Every line not said calmly has its `emotion`, and every growl, laugh or
  snore in a line is `*marked*` with a `sound`.
- A film in Hindi (or anything but English) has an English `translation`
  on every `say` and `caption`, unless told otherwise or it is a reel.
- Total duration matches the ask: a short fable 60–120 s, a picture-book
  story 5–10 minutes, a reel at most 3 minutes.
- The film sheet from `render` shows every shot as intended.
