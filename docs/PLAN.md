# talekit — build plan

talekit turns a written story into a simple 2D animated video. An AI agent
drives it through an MCP server: it designs characters and scenes, writes a
shot timeline, looks at rendered previews, fixes what looks wrong, and renders
an mp4. The product idea is "Paper for video": give the agent a language it is
fluent in (SVG + JSON), own the hard parts (rigging, motion, layout, encoding)
inside the engine, and close the loop with pictures.

This file is the design reasoning: what was decided, why, and what was
rejected. The file format itself is `docs/authoring-guide.md`.

## Principles

1. **The agent never animates a limb.** It writes _what happens when_ (a shot
   timeline). Walk cycles, blinking, mouth flaps, easing, bubble layout and
   camera moves are engine code. Agent-authored motion looks wrong nearly
   every time, so the engine is where quality lives.
2. **Constrain the drawing.** Characters are drawn into a fixed canonical box
   with known pivot points (a rig). The agent fills in shapes; the engine
   knows where the shoulders and hips are. This is what makes an LLM-drawn
   character animate reliably.
3. **Every write returns a picture.** `write_character` returns a pose sheet,
   `write_scene` the scene with anchors labelled, `write_shot` a contact
   sheet. Without that loop the output quality collapses.
4. **Plain files on disk.** A project is a directory of JSON files: any
   editor, any agent, git-friendly. The MCP server is a thin layer over the
   same library the CLI uses.
5. **Deterministic rendering.** A frame is a pure function
   `(project, shot, t) -> SVG string`. Rasterising and encoding are separate
   steps, so previews, tests and the final video all agree.

## Architecture

```
story (in the agent's head)
   │  agent writes JSON + SVG via MCP tools
   ▼
project directory   talekit.json, characters/, scenes/, shots/, audio/
   │
   ▼
engine (pure TypeScript, no I/O)   timeline → motion/gait/springs → compose → SVG
   │                               sound.ts: the cue sheet
   ▼
render   resvg on worker threads → raw RGBA → ffmpeg; audio mixer; .mkv; sheets
   │
   ▼
interfaces   cli.ts, viewer/ (review app), mcp/server.ts (stdio)
```

The module-by-module layout is in `CLAUDE.md`.

## Data model

- **Character**: a rig (`humanoid`, `quadruped` or `simple`) and parts, each
  an SVG fragment or a map of named variants (`mouth: { closed, open, … }`),
  drawn in the rig's box with the rig's pivots. `colors` are named tokens
  substituted into the SVG (`{skin}`), so library characters recolour without
  redrawing.
- **Scene**: SVG drawn at project size, with named floor anchors
  (`door: { x, y, scale? }`) so the timeline can say "walk to the door"; the
  stage shortcuts `left`, `center`, `right`, `offLeft`, `offRight` always
  exist. Optional `foreground`, `far` and `near` layers.
- **Shot**: a scene, a cast placed at anchors, and timed actions
  (`{ t, actor?, do?, to?, say?, emotion?, caption?, camera?, set?, … }`).
  The movie is the shots in filename order.

The full schema is the authoring guide.

## Phases

- [x] **Phase 1 — Engine core.** Types and validation, rigs, motion,
      timeline, compose, bubbles.
- [x] **Phase 2 — Render.** resvg rasteriser, ffmpeg encoder, pose, anchor
      and contact sheets.
- [x] **Phase 3 — Library + example.** Hand-drawn built-ins as the quality
      bar and copy-and-recolour starting points; a one-minute example that
      doubles as the integration test. Jungle, cave and village hut were
      added (2026-10-23) from the Hindi films' painted scenes, because the
      lion-and-mouse agent spent a tenth of its run reading older films'
      scene generators for a forest. They are 90 to 180 KB of SVG each, so
      `get_library_item` leaves their long layers out and `copy_from_library`
      takes `anchors`, so a story adds its own places without writing the
      scene out again.
- [x] **Phase 4 — MCP server.** Every write validates and returns an image.
      `patch_shot` came later (2026-10-23): film agents rewrote whole shots
      to move one line, or wrote Python patchers to avoid it. It edits by
      action index and returns a sheet of only the stretch that changed.
      The same day the returned pictures were made smaller: a picture costs
      about width × height / 750 tokens and sheets were 18% of a film
      agent's input. Shot and scene sheets are 1000 px wide, the pose sheet
      1200 px, both checked by eye against Devanagari bubbles and the
      smallest faces; the construction sheet and `preview_shot` /
      `preview_frame`, the closer looks, stay full size.
- [x] **Phase 5 — Viewer.** Grown into a review app after the clever-rabbit
      run: the person could not see the assets, could not point at a moment,
      and had no channel back to the agent except prose. It shows every
      asset as its sheet, plays live frames or the mp4, and saves notes
      against an asset or a shot time to `notes.json`; the agent reads them
      with `list_notes` (each with the picture the person saw) and closes
      them with `resolve_note`, the loop Paper uses. Notes are plain files so
      the viewer and the MCP share only the directory; the page polls mtimes
      rather than watching, to stay dependency-free.
      Reworked after eight released films (2026-11-06). The picture was
      sized by the space left over rather than by the film, so a reel came
      out 214 px wide on a laptop and scenery past the frame's edges showed
      round it. The frame now keeps the film's shape and gets the full
      height, and a reel's shots move to a side column. Notes kept quoting
      lines and describing places ("the jackal's tail, bottom left"), so the
      line being spoken is shown and a click pins a spot, which `list_notes`
      rings on the picture. Fixes that missed came back as fresh notes that
      lost the first ask, so a resolved note waits for the person to agree,
      and reopening it adds a reply to the same note. Notes done before
      `toCheck` existed count as checked, so released films stay quiet.
- [ ] **Phase 6 — Polish loop.** Run the MCP on a fresh story, watch where
      the agent struggles, fix the guide or the engine. Two passes so far.
      `examples/lighthouse` led to empty variants, custom variants on the
      pose sheet, a warning on overlapping speech and, later, `attach`.
      `examples/clever-rabbit`, made by a subagent given only the story,
      led to tool argument names in the guide, `get_library_item`, larger
      contact frames, a film sheet from `render` and more. A review of
      it found the key beat missing: the lion never saw anything in the
      well, staged as a 70 px reflection at the rim of a side-on well. The
      fix was staging, not engine (a point-of-view shot down the shaft,
      shots 07 to 09), and the guide gained the rule: when the plot turns on
      what a character sees, cut to what they see. Next: a run with a
      non-Claude agent, and a story that needs humanoid interaction.

## Phase 7 — Video quality

Reviewing the three films (2026-10-21) put the ceiling in the engine's
output, not the tool loop: agent-drawn characters looked generated (a deer
leg overlapping its body by six units read as detached), animals bobbed like
stickers, nothing had weight, nobody looked at anyone, and scenes were one
flat layer. Audio went last on purpose, since it would mask the visual
problems.

Decisions taken early: one drawing style for everything (**outlined
cartoon**, Bluey-like); animals come from a **library of rigged species**
that agents recolour and adapt, drawing from scratch stays the exception;
movement is **procedural with springs**, not a physics engine (rigid bodies
give ragdolls, not cartoon motion, and would break determinism and preview
speed).

Each pass ends with all examples re-rendered, before and after side by side,
and notes left; a pass is done when the notes stop being about it.

### 7.1 Art direction and character construction

First, because every later pass draws on the characters and the rules make a
linter possible. The guide got a style sheet (one dark line colour, flat
fills with one darker shade for inner detail, no gradients on characters,
eyes as white + iris + highlight) and per-rig construction rules (limbs as
strokes from their pivots, overlapping the body, nothing outside the box,
feet on the baseline).

**Done 2026-10-21, with two changes from the plan.**

- **The engine draws the outline** (`outline.ts`), not the artist with
  `paint-order`: under each part goes a copy in the line colour with filled
  shapes and strokes widened, so only a rim shows. Agents forget strokes and
  mix widths; the engine owning the line is the engine-owns-motion argument
  again. The width is fixed on screen (3.4 px at scale 1), not per rig, so a
  90 px mouse and a 300 px adult look drawn with one pen. That made the
  planned "missing outline" and "inconsistent width" checks unnecessary.
- **The linter rasterises** (`construction.ts`) each part and shape at one
  pixel per unit with resvg instead of parsing paths, so caps, arcs and
  transforms count exactly as drawn; overlap is the thickness of the
  intersection at the joint.

The library characters were redrawn in the style; the scenes waited for 7.5.

### 7.2 Quadruped rig and library species

Most children's stories are animal stories, and the simple rig cannot walk.

**Done 2026-10-21.** The `quadruped` rig (260 × 200) is in the guide. Changes
from the plan and why:

- **Both ears sit behind the head.** An ear in front carries its own outline
  across the forehead and reads as a sticker; behind, the head's outline
  closes its base.
- Every leg, the tail and the head hang from the body, which turns about the
  hips, so `sit` is one rotation plus a drop. One diagonal-pair walk, no
  separate trot.
- The rig data carries what used to be `if humanoid` branches (expected
  parts, feet, joints, the bubble point), so the linter checks every rig the
  same way. Birds and fish stay on the simple rig; the library dog moved to
  the quadruped, and a small bird became the simple rig's worked example.

**Later, 2026-10-24**, from watching the films:

- **Fused near legs.** Hind legs read as drumsticks pressed onto the body,
  each carrying its own outline round. The near legs are fused into the
  body like the head (`Rig.fuse`), with the outline split from the fill so
  it bends with the leg, plus a thigh crease, hock line and elbow line for
  form. A more lifelike style (long muzzle, almond eye) was studied and
  rejected: the cast keeps its round cartoon look.
- **A slow turn.** An animal flipping in 0.2 s like a person read as
  instant. It takes 0.7 s: the head leads, the body narrows only to 0.45
  (about end-on; narrower reads as a card flipping), a standing animal
  steps round, and a walking one keeps its gait as it turns.
- **Hocks.** Every leg lifted with the knee forward, which is wrong for a
  hind leg. `Rig.hocks` names the hind legs, which lift by swinging the
  joint back; the foot lands where it did, so the gait is unchanged.
- **Shading at elbows and knees.** The shade nudge is mostly upward, so a
  limb's wide end laid its lit copy over the limb above. A limb now loses
  shade only where a sideways-nudged copy is lit too.
- **Hung parts** (`hangs`): the kid's pigtails need to turn about their ties
  and nod with the head. A character hangs a part from another at a point;
  `rigOf` merges hung parts into the rig, so drawing, springs and the linter
  treat them as the rig's own. Preferred to new humanoid parts with fixed
  pivots, which would have fitted the kid's head and no one else's.
- Creases on people's thin bare limbs read as scratches at half size; the
  detail went into cloth folds instead.

**Library, three batches (2026-10-24)**, for the Indian folk tales the films
tell: boy, woman, farmer, grandpa, tiger, jackal, crow; a pond with
crocodile, swan, frog and fish; pirate, parrot, grandma, cobra. A recolour
is not a new character. What each taught:

- A kurta stops above the knee bend (the torso is rigid). Cloth and hair
  that swing are hung parts. The pagdi's wraps cross high, since lower reads
  to the linter as face that will not turn.
- The pond's water is a translucent `foreground` band, so a swimmer is cut
  at the line and tinted below; one band means one swimming depth. A fish
  leaps by moving above the line, since `jump` lifts too little. Springs
  answer changes of speed, so a fish's tail swishes on a start, not
  steadily. Necks that carry the face (swan, cobra) stay rigid. A heavy
  spring tail drags into the floor as a walk starts, so the crocodile's is
  not one.
- A peg leg drawn below the knee walks like any leg; a hobble would be
  engine work. A grandma's sari skirt goes on the legs so `sit: ground`
  keeps her off the floor, at the cost of parting like trousers in a stride.
  A part hung from the torso draws under it from behind, so her pallu is
  drawn on the torso.
- Open: ripples round a swimmer (engine), a parrot riding a shoulder
  (`attach` to a named point). Not drawings at all: a crane (two-legged bird
  rig), a slithering snake, crutches, a wheelchair.

**Resting, 2026-10-24.**

- **`belly` and `hem`.** `lie` lowered every animal a fixed 48 units, and six
  library animals were drawn off that line (the deer hovered, the rabbit
  sank). Redrawing a slender deer stockier would have been worse, so a
  character says where its underside is (`belly`). People sitting on the
  ground sank their kurtas through the floor; resting the hem on the seat
  was tried and is wrong on a stool, so a person sits on the hem (`hem`)
  only when it would reach through the floor. The construction check
  measures both and gives the number when the field is more than 5 out.
- **Raised seats.** Sitting `to` a seat anchor stood the actor on the
  cushion for an instant; now the body starts lowered by the seat's height
  and rises as the knees bend, and getting up runs it backwards. A sit or
  lie more than 24 px away walks to the seat first. An animal hops up and
  down instead, with the jump's arc.
- **Facing out.** A plait hung from the head lay across the chest of someone
  walking toward the viewer; it now goes behind the torso, fading over the
  turn (`Pose.toward`, a how-far).
- **Paws and hooves.** A lying animal's legs folded inside its outline. The
  forelegs now reach forward to paws in front of the chest; nothing in the
  drawing tells hooves from paws, so a character says `hooves`, and hooves
  fold back under the chest. The hind legs still vanished: folded against
  the flank, a fused leg never leaves the body, so it had no line at all.
  Lying, a paw animal's near hind leg is `loose` (`Pose.loose`): drawn with
  its whole outline, folded as when sitting, the foot flat on the floor.
- The park bench was redrawn: it read as a fence and its legs went below its
  floor. Its seat anchor is 42 above the floor, so a child's feet swing clear.

### 7.3 Motion with weight

Smoothness is contact, anticipation and follow-through, not interpolation.
All of it is engine code; the agent vocabulary does not grow.

**Done 2026-10-22.**

- **Planted feet.** The leg cycle is driven by distance, not the clock: each
  gait is a duty factor and a landing offset per leg, and a planted leg's
  angle keeps sin(angle) linear in travel, so the foot stays still. The
  cycle is shortened to fit whole half cycles into the move, so a walk
  starts and ends with the legs together; that is what makes any duration
  work without a speed limit. Moves ramp speed over 0.3 s at each end, so
  the legs slow with the body. Jumps are crouch, flight, landing.
  Breathing is a stretch about the feet (the old bob lifted them).
- **Springs** are angular for parts the rig places (pushed by the pivot's
  acceleration across a lever to the part's rough centre) and a small sway
  for parts it does not. They integrate at 120 Hz from the start of the
  shot and are cached per shot, so a frame renders the same alone or in
  order; a teleport or a facing flip is a cut, not a push.
- Not done: a walk in depth (mostly y) still slides its feet.

### 7.4 Acting

Characters placed in a frame are a diorama; characters that look at each
other are a scene.

**Done 2026-10-22.**

- **Looking** is a head tilt toward the target's eyes, half the true angle
  and capped (10° people, 8° animals): the full angle read as a glare.
  Attention comes from the shot's lines alone, latest event wins (a line
  makes listeners watch the speaker; walking and pointing look ahead). Only
  targets in front count and nothing turns a body round, because an
  automatic about-face would fight the author's `facing`. The listener is
  the existing `to` on a line with no `do`, not a new field.
- **`attach`** is an action field, not a verb, so a drop and a move share
  one action. Each rig names a hold point in a part (near hand, quadruped's
  mouth), so the prop follows the arm. Letting go reads the hand just
  before, as the arm relaxes the moment it stops holding. Not done: the prop
  stays upright as the hand turns, and a carrier cannot be carried.

### 7.5 Depth and camera

**Done 2026-10-22.**

- **Layers `far` and `near`**, not back/mid/front: `foreground` already
  meant "in front of the actors at their depth", and a front layer beside
  it would be two words for different things. A layer at parallax p sees the
  camera offset times p and the zoom raised to p; zoom as a power is what
  guarantees a far layer that fills the frame still fills it at any view the
  camera clamp allows. The rule this puts on authors: the far layer reaches
  the bottom edge. The home interior is not layered; a room has no far.
- **Shadows** are an ellipse as wide as the stance, drawn for every actor
  before any actor, so a shadow never lies across someone behind. The simple
  rig casts none by default, because it is mostly things in mid-air and the
  engine cannot tell sky from floor.
- **`crossfade`** runs the previous shot on past its end underneath, so the
  film's length and every shot's timing stay as written.
- The zoom vignette sits under bubbles and captions, so text is never
  darkened.

Four agent-written films (fox and crow, bear and honey, red umbrella, hill
race) were the check before audio. The fixes they led to:

- Several validation and timeline bugs (`to` needing an anchor, `set.at`
  lost beside `attach: false`, a `face` that could not be cleared, thoughts moving the
  mouth).
- **Culling (`cull.ts`).** resvg cuts every group that needs its own canvas
  to four times the frame and panics, uncatchably, when one lies wholly
  outside it: a `near` layer at a close zoom, the stage past zoom 3, an
  actor parked far off-screen. Every camera layer now leaves out shapes more
  than a frame outside before drawing. No example pixel changed. Dissolves
  fade with an alpha filter for the same reason. Later, blurred tree crowns
  wider than the frame panicked from zoom 1.4: a canvas inside another is
  bounded about the outer one's corner, not the frame's, and a blur's region
  starts a frame or two left of the frame at a close camera, so a
  see-through leaf just right of the frame was out of bounds. The whole
  frame is now culled at once, through every layer and filter: a lone
  shape's `opacity` moves into its `fill-opacity` or `stroke-opacity` where
  that draws the same (no canvas, so no bounds, and fewer canvases to
  allocate), and any canvas still outside its bounds, worked out as resvg
  does, is left out. Groups with an `id` used to be kept whole, so swaying
  crowns escaped culling; only an id something points at is kept whole now.
  And a line was measured at the origin (`x1` did not read as a name).
- **Fused heads.** A quadruped's neck carried its own line across the chest;
  its head's outline now goes down with the body's (`Rig.fuse`).
- **Knees and elbows** (`Rig.bends`, `Pose.bend`). Legs stuck out stiff on a
  seat. The composer cuts a limb at the joint with a disc on each half and
  turns the lower half, drawing both outlines before either fill, so the
  joint is round with no line across it. In the engine rather than a new
  shin part, so every leg already drawn as one stroke bends. `sit` folds the
  legs from the hips' height so the feet stay down; an anchor's `floor`
  says how far below the seat the floor is. A shortening leg now bends
  instead of sliding into the body, except an animal's planted legs
  (`give: false`): on legs that short, a give becomes a rubbery bend. Arms
  bend at the elbow in the walk, the run and the wave.
- **`lie`**, layered on sitting, for people and animals. The bubble point is
  carried through postures, not through passing moves, so a "Zzz" stays on
  the head.
- `sit`, `lie` and `stand` take `duration`, so a shot can open with someone
  already sat (agents had written `duration: 0.05` and got a 0.4 s sit).
- **Turning faces and bodies** (`Rig.turn`, `Pose.yaw`, `ActorState.view`).
  Front-on faces on side-on bodies stared at the viewer. The engine slides
  and narrows the face parts toward the facing, which reads as
  three-quarters on a round head, and narrows the torso with the far
  shoulder and hip stepping in. A move mostly up the screen shows the back
  (`back` variants; face parts hidden); limbs swinging toward the viewer are
  foreshortened. In the engine rather than asking for three-quarter
  drawings, so every character already drawn turns. Backs are variants, not
  a new part list, so a character without one still works.
- **Standing `on` someone** (2026-10-25). First only the draw order, which
  goes by the feet. Then riding along, once the lion reel needed a mouse on
  a lion that gets up: the spot is kept in the coordinates of the rig's main
  part (a body, a torso) as the one underneath stood when the rider landed,
  and carried through that part's pose each frame. The root alone was not
  enough, since a lying animal lowers and levels its body part, not its
  root; with it the mouse ended up on the lion's flank. A hop along the
  back without `on` takes the rider off, which the reel itself got wrong,
  so the check warns about it.

Not done: a depth walk slides its feet; no camera shake or handheld drift.

### 7.6 Weather and moving nature

**Done 2026-10-23.** The red-umbrella film's rain was streaks painted into
`near`, hanging in the air. A scene was a still picture, so nothing could
flicker, fall or roll in. Now the engine draws what moves by itself, every
frame, from time and `hash01`, so a frame still renders on its own. Scene
`weather` (rain, snow, wind, leaves, clouds, lightning, heat) and `effects`
(fire, smoke, waterfall, waves, sun) are in the guide. Decisions:

- Rain and snow fall at three depths, each moving with the camera like a
  layer and wrapping round the frame, so it is always evenly full.
- The flash brightens through a gain filter rather than laying white over
  the frame, which read as fog.
- Heat haze displaces the far layer with scrolling noise; resvg fixes noise
  to the group's coordinates, so the layer is shifted down inside a group
  shifted back up.
- A close-up scene sets `weather.scale`: the engine cannot tell a close-up
  from a wide shot. Clouds, bolts and haze need a far layer; the validator
  says so.
- **Shelters** are spans, not shapes (a bench seat, an umbrella's canopy per
  variant): a drop only needs to know where it stops, and a span can be read
  off one's own drawing. A falling drip asks where a carried shelter's edge
  was when it let go, by resolving the shot at that earlier time, so it does
  not slide with a walking umbrella.
- A `weather` action blends one weather into another over its duration.
  Clouds sit in ten fixed slots so a clearing sky does not reshuffle them.
- **Light.** `weather.light` tints the characters through a channel filter
  (the scene is painted in its own colours and left alone); a fire warms the
  actors near it, more the darker the light.

### 7.7 Light and form

Better-looking characters were asked for (2026-10-23), with downloaded
SVGs suggested. Dropped-in art does not suit the engine: a downloaded cat is one
picture, the rig turns separate parts, art from several sources would not
share a style, and art with its own outline gets a second one. What made the
library look like stickers was flat colour. So the engine draws the light,
as it draws the outline, and the library was redrawn in one style, using
downloaded art as reference only.

- **Shade** (`shade.ts`): each part's silhouette in a cool dark at about 20%,
  masked by the silhouette nudged toward the light, so only the far side
  shows. Hard-edged like cel shading, and one mask per part with no blur, so
  resvg stays fast. The nudge turns with the part and mirrors with the
  actor. A fused part adds its parent's silhouette to its mask, or a shaded
  edge would cross the neck.
- **Firelight** swings the light toward the fire the more it outshines the
  scene and puts a warm rim on the near side.
- **Clouds grade the far layer** (saturation, and brightness for storm
  clouds) in screen space, so a sky painted blue goes overcast under them
  and comes back when a `weather` turn clears them. The stage is left as
  painted, since wet ground stays wet.
- **A move gets up first.** Agents forgot the guide's `stand` before a walk
  from sitting and slid along the floor; now the move waits until the actor
  is up.
- **`camera.follow`**: agents timed pans by hand and got them wrong. The
  camera aims ahead of a cast member and trails through a weighted mean of
  where they were over the last 0.9 s. A mean of past states rather than a
  spring keeps every frame computable on its own (nine lookups, nothing
  integrated). Each sample is clamped into the scene first, or the camera
  would hit the scene's edge and stop dead.
- **The library redrawn**: the cat first as the pattern, the rest by agents
  from it, each checked on its sheets. Part names, variants and tokens did
  not change, so projects that copied a character keep working. Two rules
  came out of it for the guide: a leg below the knee runs down the knee's
  x, and a haunch ends above the knee. Each half of a bent limb now keeps
  only the pieces on its side of the joint, which removed a dark spike at
  sharp bends. The examples were recast onto the new drawings, deriving
  extra shades from their own base colours; the agent-drawn gull, lantern,
  kite, monkey and reflection stay as the record of what an agent draws.
- **Devanagari.** resvg misplaces Hindi vowel signs and drops spaces with
  every font tried, in its newest build too. HarfBuzz (`harfbuzzjs`) shapes
  it correctly, so a Devanagari line is shaped in the bundled Baloo 2 and
  drawn as outlines (`glyphs.ts`), its width from the same shaping. Only
  that script takes this path; bundling one font for all text would have
  changed every film's look for a problem only Hindi has.
- **Cast shadows** (`cast.ts`), asked for in review. Each light throws every
  grounded actor's own silhouette across the floor, flattened by an affine
  map that keeps the floor line, blurred and faded toward its far end. The
  silhouette rather than an ellipse, so a raised arm or a tail shows, and
  one map serves every rig. A sky light sits behind the stage, so shadows
  fall forward and fan out from under it; a lamp or fire on the stage
  throws them along the floor. Lights are declared (`lights`), not guessed
  from the art, and a scene without them renders as before. Painted scenery
  keeps the painter's shadows.
- **`pickup` and `putdown`.** The sticks film's bundles appeared in hands
  from nowhere, because `attach` could only snap. Now the carrier stoops and
  the prop eases from where it lay; any attach eases (a hand-to-hand pass
  travels) unless it comes from further than the carrier's height, which
  reads as a cut. The validator says where to stand when the hand would not
  reach, and warns when someone ends a shot carrying something and starts
  the next without it.

### 7.8 Audio (last, on purpose)

Sound makes a silent film feel finished and would hide what still looked
wrong, so it came after 7.1 to 7.7. Planned 2026-10-23. Six
layers, each with one owner:

| Layer         | Who writes it                       | Where it comes from                                                       |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Music         | the agent, per project and per shot | bundled tracks, or a file in the project                                  |
| Ambience      | the engine, from the scene          | weather and effects, thunder after each strike, plus a scene's `ambience` |
| Sound effects | the engine, plus a `sound` action   | footsteps on planted feet; appear, jump, pickup; roars, knocks            |
| Thoughts      | the agent's thought bubbles         | the character's voice, quieter, with a little room                        |
| Dialogue      | the agent's `say` lines             | a local TTS model, in the character's `voice`                             |
| Narrator      | the agent's captions                | the same model, in the project's `narrator` voice                         |

The principle is the visual rule again: **the engine owns sound that follows
from what is on screen.** The agent chooses only what a story chooses: who
sounds like what, which music, and the one-off noises.

Decisions:

- **Sources are CC0 or public domain only**, with `sounds/CREDITS.md`. They
  ship in a public MIT repo, which is redistribution: that rules out CC-BY
  (every film would owe a credit) and the Pixabay and Mixkit licences (free
  to use, not to redistribute). A project can use its own files from
  `audio/`. The library (166 files, 32 MB) is normalised on the way in, so
  the mix uses fixed levels: effects peak at -1 dBFS, ambience -23 LUFS,
  music -18 LUFS, lines levelled to one speaking loudness.
- **Voices from a local model, not a service**, through a Python sidecar
  (`tools/tts/`, run with `uv`) on MLX: the good models are Python and
  MLX-only. A voice is `engine:name`, so a model can be added without a
  format change. Without the sidecar everything works silently on estimated
  timings.
- **Voice audio is cached in the project** (`audio/voices/`, keyed by a hash
  of the voice, text and emotion) and the render reads only the cache. The
  models are not bit-identical run to run, so this is what keeps a render
  deterministic, and the examples render with sound on a machine without a
  model.
- **A voiced line lasts as long as its audio.** The mouth follows the line's
  loudness envelope. The validator warns on overruns, and the shot sheet has
  an audio lane so an overrun shows in every write's picture.
- **Mixing is our code, not an ffmpeg filter graph.** ffmpeg decodes clips to
  PCM; the mixer sums them with known gains and ducks the music on ramps
  computed from when each line plays, so no compressor is guessing. The cue
  sheet is a pure function (`sound.ts`); decoding and summing are I/O
  (`audio.ts`). A film with nothing to hear gets no audio track.

Built in four commits (cue sheet and mixer; voices; engine-owned sound; the
bundled library with `list_sounds` and `list_voices`), then listened to.

**The voice model** (2026-10-23, the same lines through each, scored by
Whisper large-v3-turbo as characters heard differently):

| Model                      | Hindi | English | Speed on an M4 Pro | Licence    |
| -------------------------- | ----- | ------- | ------------------ | ---------- |
| Kokoro 82M                 | 8–12% | 0%      | a line in ~0.2 s   | Apache-2.0 |
| Chatterbox multilingual v3 | 5–8%  | 14%     | ~0.6× real time    | MIT        |
| rumik-oss 1                | 5–19% | 4%      | ~2.5× real time    | model card |
| Voxtral 4B                 | 3–8%  | 0%      | ~2× real time      | CC-BY-NC   |

rumik-oss is slow with only four women's voices; Voxtral's licence rules out
films that are sold. Kokoro was the first default: fast enough to speak a
shot's lines inside `write_shot`, and its mistakes were vowel lengths, not
wrong words. After the first listen
(2026-10-24) Chatterbox was judged always better, for dialogue and
narration: it said हँसा right where Kokoro was badly wrong, and it acts. So
every voice is `chatterbox:<kokoro voice>`: Kokoro reads a calm reference
passage once at the character's pitch and speed (cached in
`~/.cache/talekit/references/`) and Chatterbox speaks every line in that
voice. `kokoro:` stays for quick drafts. A line takes about a second, which
`write_shot` can afford.

**First listen** (lion-mouse-hi) also led to:

- **A line is said with its speaker's emotion**, the one its face has then.
  No new field, because a face and a voice that disagree is a mistake.
  Chatterbox's exaggeration is set per emotion from review notes (an
  excited thought was better at 1.26 than 0.5, an angry shout at 0.5 than
  1.4, since the words carry the anger).
- **A sound is not a word.** Agents wrote growls and laughs into lines and a
  voice read them out. Text between asterisks is shown, never spoken; the
  action's `sound` is what is heard. The validator flags unmarked ones.
- **Nobody talks over the narrator.** The validator warns when a line and a
  narration overlap; a voiced line is talking until its voice stops, not
  until its bubble fades.
- Two espeak-ng slips in Hindi fixed in the sidecar (ड़, ऊँ). Later,
  Chatterbox was heard saying हंस as "has": the spectrograms showed a nasal
  vowel where a good take closes the n. Written हन्स for it alone, every take
  closed the n (12 of 12, against 2 of 12), so the sidecar respells such words
  for Chatterbox and the screen keeps the real spelling.

**Second listen** (on a phone, the race and sticks films): beds too loud
against dialogue. Measured in 0.4 s blocks, voices were 16 dB over the beds
in the median but 7 dB in the loudest tenth, and the music swelled back in
every gap. So: lower beds (music 0.24, ambience 0.32 of source), deeper
ducking that holds through gaps under 1.5 s, and **a mix the listener sets**
(`mix`: per-layer volumes on top of the engine's levels), because the right
balance depends on where the film is heard. The review app plays each layer
as its own cached stem through a gain per slider, so a change is heard
while playing; mixing is linear, so the stems sum to the film. Remixing puts
new sound under the mp4 with the video copied, in seconds. A compressor keyed
on the voices was the alternative; fixed levels with a hold do it without
guessing and keep the mix a function of the cue sheet.

**The .mkv** (2026-10-24), for watching on a phone: the full mix, music and
effects without dialogue, the same with the narrator, subtitles in each
language (off by default) and a chapter per shot. MKV, because it carries
named sound and subtitle tracks, styled ASS subtitles and their font; the
mp4 stays, since a phone's gallery may not play an .mkv. It is built from
the rendered mp4 with the picture copied: two more mixes and a mux, not a
render. The dialogue-free tracks leave the lines out of the ducking, since
music that dips for an unheard voice sounds like a fault. Without the
voices those tracks measured 6 to 10 LU under the full mix (2026-10-25),
so a player switched to one had to be turned up; each is now raised to the
full mix's loudness, with a limiter 3 dB under full scale for the effects
the gain pushes over (AAC's true peak passed 0 dB at 2). Translations come
from the agent (`translation` on each line), not a model at render time: the
agent knows the story, and the render stays deterministic and offline.
Baloo 2's narrow space is widened in the subtitles, and a subtitle over a
narration caption moves to the top.

### 7.9 Reels (portrait)

Most viewers watch reels, not films (2026-10-24), so a story
also comes as a portrait reel: 720 × 1280, at most three minutes, one mp4.
It is its own project, a second, shorter telling with its scenes drawn tall,
not a reframe of the film. A 9:16 window on a 16:9 scene keeps a third of
its width, and `left` and `right` are 716 px apart, so a conversation does
not fit; pan and scan would have made every exchange a whip pan or a cut and
left the wide shots a slice. The agent writes both versions from the story,
as a person adapting it would. The engine's part is small:

- **Text by the short side.** Bubbles, captions, weather and effects scale by
  `min(width, height) / 720`, so a reel's text is the size a film's is on
  the same phone.
- **A safe area.** The apps draw over the bottom fifth, down the right and
  across the top. Bubbles and captions keep clear (insets 22% bottom, 14%
  right, 10% top, 6% left: the usual Reels and Shorts figures, a little
  generous, since the apps move their overlays), the default floor is 0.78 ×
  height, and the stage shortcuts sit at 26% and 72%. Narration goes at the
  top: at the bottom it sat on the cast.
- **Three minutes** is a warning, not an error, so a draft can run over.
- **No .mkv**: the apps play one sound track and no subtitles.

A frame is portrait when it is taller than wide; there is no format field,
since the size already says it.

Four of the reels' tall scenes went into the library (2026-10-25) as
`cave-tall`, `courtyard-tall`, `forest-tall` and `fields-tall`, with their
story-bound anchors renamed (`son1` became `front-left`): every reel had
painted its own scenes from nothing, which is the slowest and least
reliable part of making one. The suffix, not a field, marks them, for the
same reason there is no format field.

The first reels kept the films' dialogue and cut events to fit, and told too
little: the race reel lost the hare stopping to eat, which is why he sleeps,
while two conversations took most of its time (review, 2026-10-25). A reel is
told by the narrator instead, a sentence or two a shot over the cast acting
it out, with a character speaking only where the words turn the story. That
is a rule for the agent, in the guide; the engine needs nothing new.

## Phase 8 — The world model

After eighteen released films (2026-11-14), the person's review notes were
sorted by kind: about 110 notes, of which about 70 were mistakes the engine
could have known about. The rest were drawing quality, pacing and taste.

| Kind                  | Notes | For example                                                                                                                                         |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Support, gravity      | ~14   | a baby floating; cats halfway up a trunk; washers beating cloth in the air (three films); clothes leaving a fixed line; a vase not falling straight |
| Teleports, continuity | ~10   | a roti flying between mouths; a bundle jumping across the floor; a man asleep in one shot and awake in the next                                     |
| Attention, facing     | ~8    | listeners facing away; a man beating the empty side; animals fleeing from what they never saw                                                       |
| Readability           | ~9    | bubbles over faces; a bucket hiding the otter; a hidden spy half seen                                                                               |
| Solidity              | ~7    | walking through a well (three times); bars you could walk round                                                                                     |
| Reach, contact        | ~7    | the vessel moving to the hand, not the hand to the vessel; an axe landing outside the bed                                                           |
| Audio                 | ~14   | हंस said as "has"; lines with no voice; भाई said to a woman's voice                                                                                 |

Each one cost a person's careful watch to find. The cause is the same every
time. The engine knew where things were drawn, not what they were. A scene's
ground was one `y`; water was decoration; a well was pixels; nothing said
who a line was for beyond `to`.

The user of this engine is an LLM, not a person, and the goal is a film
with no glitches in it. Two decisions follow from that.

1. **The engine fixes whatever has one right answer.** Intent is clear but
   the execution is wrong: a listener should face the speaker, a pot let go
   of should fall straight, a walk should go round the well. An agent
   forgets these over and over, so the engine owns them, as it owns motion
   (principle 1). It works them out when it loads a shot, like a constraint
   solver, and never writes them back into the file: the file says what was
   meant, and `talekit explain` says what the engine made of it.
2. **Everything else is an error with a way out.** When the engine cannot
   know what was meant (a land animal in deep water, a roti that jumps), it
   reports an error that blocks the render, until the shot is fixed or the
   error is waived with a reason (`allow`). There are no soft warnings for
   these kinds of mistake: an agent learns to skip warnings, and every
   skipped one reaches the person as a glitch. A check that cries wolf is
   tuned, not demoted.

Every finding has a code, the shot, the time span, the actors, one sentence
on what is wrong and why it shows, a patch when the fix is mechanical, and a
frame with the spot ringed (principle 3). The same findings come back from
`talekit check`, `render` and every MCP write. A write is saved anyway, so
the agent can look at it and iterate. Only the render is refused.

### The plan

- **8.0 Base.**
  - Scenes say where the ground is: `walk` areas (floors, stairs, perches,
    a branch top) and `water` areas (deep, or shallow enough to wade).
  - Characters say where they can be on their own (`habitat`: land, water,
    air).
  - A simulator steps each shot through the timeline (a pure function
    already) at 10 fps and runs rules on the states.
  - Findings, waivers (`allow` on a shot or a scene), the render gate, and
    ringed frames (`talekit check --frames`).
  - The first rule: **support**.
- **8.1 Attention and gravity.**
  - Attention: the audience of a line (its `to`, else everyone awake and
    idle) turns to the speaker, staggered by `hash01`. A striker faces its
    target. A reaction (`reacts`) looks at its cause first.
  - Gravity: a prop let go of falls straight to what is under it (Rapier 2D,
    deterministic build).
  - Feet a few pixels off the ground snap onto it.
  - A `climb` verb for ladders, trees and walls, so nothing slides up or
    down them with `move`; a `move` that carries a walker off the ground
    is flagged.
  - Teleports inside a shot are flagged, and a `give` verb hands a thing
    from one actor to another.
  - Every voiced take is transcribed (whisper.cpp or AI4Bharat's Hindi
    models, whichever reads our takes better) and re-voiced when it does not
    match its line.
- **8.2 Continuity.**
  - A shot in the same place starts where the last one ended: positions,
    posture, sleep, held props, looks. `cut: 'later'` starts fresh.
  - The 180° rule is checked across cuts.
  - Smart objects: an anchor says what is done there and how (a washing
    stone: seated, facing right, the cloth landing at x, y).
  - Contact verbs walk the actor to a use point and bend the arm onto the
    target.
- **8.3 Solids and readability.**
  - Solids with footprints and named openings; walks route round them on a
    2D navmesh.
  - Bubbles are placed off every face box. Art over a speaker's face, or a
    `hidden` actor who shows, is flagged.
  - Art checks on the sheets: a drawing that comes apart in a pose (a split
    elbow, a loose tail), and a sway group whose far end moves too far.
- **8.4 A vision critic.** The agent checks a contact sheet against a
  checklist before the person sees anything. It is not deterministic, so it
  adds to the checks and replaces none of them.

Each kind of note becomes a fixture that must be fixed or flagged, and the
checks are run over the released stories: a finding there is either a false
positive to tune away or a mistake that got past the review.

**Not Blender, Unity or Godot.** They would bring physics, but the failures
above are about knowing the world, not about drawing it. Moving the engine
would put the agent in front of a much larger API, mostly in 3D, which is
harder for it to get right, and lose the rigs, the library and the authoring
contract. Proven parts go inside instead: Rapier 2D for falling and
settling, a 2D navmesh for routing, Clipper2 for polygon overlap, resvg
(already here) for pixel-exact occlusion, and whisper.cpp for speech.

### 8.0 as built

- **What a scene is.** Scenes take `walk` (polygons where feet can stand)
  and `water` (areas, `wade` for shallow). A character takes `habitat`
  (land, water, air; land by default, plus air for one that `flaps`).
  Shots and scenes take `allow`: waivers keyed by code or `code:actor`,
  each with a reason. A key that names no check is an error, so a typo
  waives nothing.
- **The rules.** `src/engine/world.ts` samples each shot every 0.1 s
  through `resolveActor` and runs the rules. `support` holds every actor
  to what it can rest on. Carried, ridden (`on`), mid-jump, hidden and
  off-frame actors are held up already. On the scene itself, `world.walk`
  (no walk areas) and `world.anchor` (an anchor on no ground or water) are
  checked.
- **How findings come back.** A finding is a `Problem` with a `code` and
  the finding itself. `validateProject` runs the shot rules once nothing
  else is wrong, so `check` and `render` see them and `render` refuses.
  `write_shot` and `patch_shot` save anyway and add the findings, with up
  to three frames of them, each spot ringed (`findingFrameSvg`).
  `write_scene` no longer refuses on a world error: an agent fixing its
  walk areas needs the sheet to do it.
- **Pictures and tools.** The scene sheet hatches walk areas green and
  water blue. `talekit check --frames dir` saves a ringed frame per
  finding. The Python kit has `below()` and `ledge()`.
- **The library.** All eleven library scenes and the four examples were
  given walk areas, read off their sheets. Birds, the swan, the fish, the
  frog and the crocodile were given habitats.

**First catches.** The examples had two real ones. The lighthouse's
lantern glided from Pip's hand to the pedestal with a `move` (now a
`putdown`), and lost-kite's kite and the lighthouse gull had no way to be
in the air (now `habitat`).

**A trial on a released film.** गाने वाला गधा (R18, already reviewed by the
person) was given walk areas and checked. It found the two guards sliding
down the machaan's ladder in a standing pose: a `move`, since the engine
has no climbing. That was a real glitch the review missed. It also taught
three things about the model:

- **Walk wins over water.** A washing stone in the river is a walk area
  on top of the water.
- **A `river` effect's points are not the water.** Its polygon runs over
  the bank, where the art hides the ripples, so a scene with a river
  gives `water`.
- **Areas are flat on the screen.** They cannot tell a pot floating in
  front of the floor from one standing further back on it, or a gull
  over the sea from one standing in it. They catch what floats above the
  ground line, or in the wrong medium. The rest needs motion rules: no
  gliding with `move`, gravity for what is let go (8.1), and `climb` for
  ladders and trees (added to 8.1).

### 8.1 so far

- **Attention** (`src/engine/stage.ts`). Before a shot plays, the engine adds
  `set.facing` actions. Everything downstream sees them, and the file is
  untouched.
  - The speaker turns to its `to`, or to whoever it replies to.
  - Listeners turn to the speaker 0.15 to 0.5 s into the line, staggered
    by `hash01`. They are the line's `to` alone, the one replied to, or
    everyone when the speaker is the only one who talks in the shot, plus
    the line's `audience`.
  - Someone walking, busy with their hands, lying down, with eyes `closed`
    or carried does not turn. One still moving turns once its move ends,
    and listeners are looked at again every 0.5 s through the line.
  - Only a `set.facing` near the line counts as the agent directing it. A
    move does not: the guards in R18 ran in and kept facing their run,
    which was the review note.
  - `reacts` turns an actor to the cause 0.45 s before its reaction. A
    later `reacts` to the speaker means the listener has not noticed yet,
    so it turns then.
  - `attention.*` findings catch the ones that could not turn, judged over
    the whole line: facing away for more than half of it, after 0.7 s to
    turn. An archer's `aim` keeps its eyes on the mark and is never a
    finding.
  - `talekit explain` and the MCP writes list every added turn.
- **Gravity.**
  - A prop let go of (`attach: false`) falls straight down from the hand to
    the floor its carrier stands on. A perched carrier's drop falls past
    its branch to the ground.
  - The new `fall` verb drops a thing off a shelf or a branch.
  - The fall accelerates (1800 px/s² at scale 1) and bounces once. It is
    exact for a straight drop, so Rapier waits for tumbling and rolling.
- **Feet snap** onto a walk area up to 12 px below them, for a walker on its
  own feet.
- **Climbing.** `climb` takes an actor up or down a ladder or a trunk to
  `to`, at 70 px/s. A scene marks what can be climbed with `climb` areas,
  and a climber is held to them instead of to the walk areas
  (`support.climb`).
  - A person turns its back to the viewer and goes hand over hand. Seen
    from behind, the arms swing across the screen (`Pose.flat`), up in a V
    either side of the head. The legs step into it, foreshortened. The
    cycle is paced by the distance climbed, one hand and the other foot per
    rung.
  - An animal walks up, tipped up the slope by as much as 70°, about its
    feet, easing into the tilt and out of it.
  - A walker that a `move` takes off the ground is still `support.air`, but
    the message now says it glides and names `climb`, `jump` and `fall`. That
    is the R18 guards on the machaan ladder.
- **The jump rule** (`continuity.jump`). Anything in sight moving faster
  than 1500 px/s between samples is a finding: a hand-over from too far
  (the roti), a `set.at` while it shows, a `move` too fast to be one (use
  `fall`). Arrows, falls, a prop carried through its carrier's turn or
  swung in a blow, and anything out of sight are left alone.

- **The speech check** (`src/engine/speech.ts`, `src/project/hear.ts`).
  Every voiced take is heard by whisper.cpp (large-v3-turbo, q5, 570 MB,
  MIT-licensed) and compared with its line.
  - AI4Bharat's Hindi wav2vec2 was the other candidate, but it is gated on
    Hugging Face behind a login, so it cannot be the default.
  - Whisper spells Hindi loosely (ध for द, ढ for ध, short vowels for long,
    a nasal dropped). So the line and what was heard are both reduced to a
    skeleton of the sounds a listener tells apart, and the remaining
    differences are read as runs.
  - A take is bad with 4 or more sounds missing or extra in a row (a skipped
    word, babble), or more than 0.3 of it wrong (a garble, for a line of 8
    sounds or more).
  - Whisper writes numbers as digits ("100" for सौ), which are said back
    in Hindi before comparing. A line under 12 sounds gives it little to go
    on, so only more than 0.6 wrong counts there.
  - On 500 released takes heard whole, 4 were judged wrong. Hearing in
    pieces cleared 3 of them. The last says क्यारियाँ twice: R14's
    `04-khudai` narration, 4.8 to 5.8 s into the take. That stutter is
    probably real, and the review missed it. Takes cut short or paired with
    another line came out at least 0.32 wrong, with runs of 4 to 28.
  - Whisper drops a word said alone before a pause ("परछाईं...? शेर को…"),
    so a take that seems wrong is heard again cut at its pauses, and the
    better hearing counts.
  - A bad take is said again with another seed, up to three takes
    (Chatterbox only; Kokoro does not sample), and the best is kept.
  - A line no take says is `speech.mismatch`, an error that blocks the
    render until the line is reworded or the take is waived. Only what was
    heard is stored, and the take is judged afresh on every load, so a
    better judge never leaves a stale verdict behind.
  - Without whisper-cli, takes are voiced but not heard, and the report
    says so. Tests turn hearing off and pass in a fake hearer.

**Calibration on the released stories.** The attention and jump rules need
no walk areas, so they were run over all 36 projects.

- At first they found 43 things. Most were archers who keep their eyes on
  the bird while Drona speaks, which is right, hence the `aim` exemption.
  The rest were listeners whose own move left them facing away, now turned
  once the move ends.
- Now they find 2, both one real glitch the review missed: the wooden bird
  in the archery reel drops off its perch as a 0.55 s `move` at 1770 px/s,
  carrying the arrow stuck in it.
- Before the exemptions they also found two more real glitches, in the
  engine itself, not in any shot:
  - an arrow on the string jumps 150 to 480 px as an `aim` begins, or
    when one arrow is reused by the next archer;
  - a prop carried in a long animal's mouth swaps sides at mid-turn, with
    the head.

  The turn is how a side-on drawing turns, so the second stays, and
  anything held, an arrow on a string among them, is exempt through its
  holder's turn.

- **The arrow fix.** The first came from the turn. An aim turns the
  archer to face the mark, and half way round the side-on drawing mirrors,
  the bow in hand with it; the arrow was already fading in on the string
  and went too. Now it shows on the string only once the turn is done and
  a hand is on the string (after the hand-over of a first aim). A reused
  arrow fades off the last bow first and is out of sight for a moment
  before it shows on the new one, where it used to cross the stage in one
  frame. Run over the archery films again, the only arrow jumps left are
  through an archer's turn; the rule's exemption for nocked arrows was cut
  down to that.

- **Give** (`do: 'give'` on a held prop, `attach` the taker). Handing a thing
  over used to be an `attach` to the other hand, with no arm moving. Now the
  two face each other first (staged, like a listener's turn), and each
  reaches its near hand out to a meeting point, its share of the way by the
  length of its arm, standing upright. The prop changes hands there half way
  through, so it never leaves a hand. The point is worked out once, from
  where the two stand at the hand-over. An animal's mouth is the meeting
  point, and the person stoops to it, since it is lower than the hand
  hangs. A stoop for a hand at chest height was tried first and dropped: at
  the limit the two crouched into each other. `give.reach` flags two
  whose hands do not meet: too far apart (over about 0.7 of their average
  height) or facing away, where a hand would get there only behind the
  back.

8.1 is done.

### 8.2 so far

- **Same-place continuity.** A shot says whether it carries straight on
  from the last one in the same scene (`cut: 'next'`) or time has passed
  (`cut: 'later'`).
  - **Defaults.** A hard cut is `next` and a crossfade `later`: a dissolve
    reads as time passing, as it does in film. A shot after a title card
    starts afresh, and so does one in another scene.
  - **What a continuous cut is held to.** Everyone in sight on either side
    of it must start as the last shot left them: where they stood (within
    12 px), sitting or lying, asleep or awake (lying with eyes `closed`:
    shut eyes alone are as often a howl), holding what they held, at the
    same size. Nobody may vanish from a spot the new shot
    still shows, or appear in one the last shot showed empty. Each
    difference is a `continuity.cut` finding. It gives the spot or the cast
    entry to copy as the fix, and offers `cut: 'later'` as the way out.
  - **Facing is the engine's.** Whoever the shot has facing the other way
    starts facing as they were and turns at t 0, a 0.2 s turn you can see,
    rather than a flip at the cut. The engine stages the turn, and
    `explain` lists it. A thing with no eyes (a pot, a bow) cannot turn
    itself, so it keeps the facing it had. Anything held faces with its
    holder. Anyone lying down, or moved or turned by the shot at its start,
    is left alone.
  - **Why errors, not fixes, for the rest.** The cast says where everyone
    starts, explicitly. When that differs from where they were left, the
    engine cannot tell a slip from a jump in time. So the shot has to say
    which, and a skipped time is one word.
  - The project warning about a prop vanishing from a carrier's hand at a
    cut now covers only cuts to another place or a later time.

**Calibration.** Of 143 same-scene cuts in the 36 released projects
that changed something, the rule finds 91 things.

- **What the field could not mark.** Most are time skips the files had no
  way to mark: a dream and back (`gadha-hi`), a dug garden between
  shots (`prashn-hi`), an establishing shot of the forest before the
  friends (`chand-hi`).
- **Real slips the review missed**, checked frame by frame:
  - an arrow left on the string of Yudhishthir's lowered bow vanishes at
    the cut to the next prince (`lakshya-hi`);
  - the camel, just inside the edge of the farmer's shot, is left out of it
    and vanishes, and so does a melon (`oont-hi`).
- **Seen in the numbers, not yet watched.** A darbar reframed by moving
  the king, the vases and Ramaiya 60 to 120 px instead of the camera, so
  they would slide against the set (`vase-hi`). A seated jackal stands at the
  cut (`siyar-hi`), and so does a seated man (`sapna-hi`). The lion edges
  40 to 70 px between two shots (`lion-mouse-hi`).
- **Not found by the rule.** A bow held after an `aim` is in the far hand,
  but the next shot started it back in the near one, so it jumped 40 px at
  the cut. The rule lets held props go where their holder's hand goes, so
  it misses this. The engine now carries it: an archer left aimed, bow in
  hand, at the end of the shot a cut carries straight on from starts the
  next one with the bow in the far hand, and a later `aim` there does not
  hand it over again. In `lakshya-hi` and its reel that is 9 cuts where the
  bow jumped 38 to 46 px, now 0 to 4 px. The aimed state now carries down
  each chain of carry-on shots, so the survey now finds 16 aimed archers at those cuts. On the
  first cut, frame by frame, the bow stays behind Yudhishthir's far side.
  It changes angle a little at the cut (lowered and slanted at the end of
  the aim, hanging upright at the start of the next shot): the lowered
  angle is not carried.
- **False alarms.** The cuts after a title card were the only class of
  them, now exempt.

The examples had three. clever-rabbit's rabbit stepped 120 px closer to
the lion at a reframing cut, and now stays where it walked to. In
lighthouse, Gus started in the sky in plain sight and now flies in from
off the frame, and Grandma vanished from the beach while Pip found the
lantern and now stays.

- **Screen direction.** Held across a cut to another place; in the same
  place the continuity check holds everyone already.
  - **A journey keeps its direction** (`continuity.direction`). Someone
    who goes off one side of the frame and is moving in the next place must
    keep going the same way. Off to the right means on from the left,
    moving right; coming on the other way reads as turning back. A dissolve
    does not excuse it: "they walked for days" skips time, not the way they
    were going. A new trip after a skip (the next morning) is the one real
    exception, and the engine cannot tell it from the same trip, so it is
    waived with a reason rather than keyed to `cut`.
  - **The 180° rule** (`continuity.line`). Across a cut to another scene
    that carries straight on, a closer view or an insert of the same moment,
    two in sight on both sides keep their sides. A 2D stage has no camera
    to swing round, so a swap is only ever the cast moved, and they seem to
    jump past each other. `cut: 'later'` marks a time skip, as it does in
    the same place, and a hard cut is read as `next` here too.
  - **Eyelines were tried and dropped.** The check was: someone faces
    another, then a cut to them alone shows them facing away. It found 23
    cuts in the released films. The one checked frame by frame was a rabbit
    turning to lead the lion on, and 20 of the 23 are dissolves to another
    place, where a turn to lead, leave or look elsewhere is as common as a
    broken eyeline.

**Calibration.** Over the 36 projects and the examples, 17 direction
findings and 2 line findings.

- **Direction.** Nearly all are the same habit: the agent sends people off
  to the left and brings them on moving right, as if left to right meant
  forward. About 13 are one journey. Seen in frames: the cats set off
  from their tree for the village and come on moving the other way
  (`billi-hi`), and the mouse runs to keep its promise and comes in from
  the side it left by (`lion-mouse-hi` reel). Read in the scripts: the
  mouse going to see the lion (`lion-mouse-hi`), the cats running off with
  the roti (`billi-hi`), the servant sent for Birbal (`khichdi-hi`), the
  rabbit setting off for the lion (`khargosh-hi`), Birbal sent to search
  the bazaars (`bachcha-hi`), the brahman walking home with his alms
  (`sapna-hi`). The rest are new trips after a skip, the donkey's routine
  montage and his next morning (`gadha-hi`), which are what the waiver is
  for.
- **Line.** Both are time skips with a hard cut: the fields to the courtyard
  (`sticks-hi`), and the walk down the street to the park in lost-kite,
  now marked `cut: 'later'`. No film yet cuts to an insert of two people,
  so the rule has found no real swap; it is there for when they do.

- **Blows that land.** Of 684 work actions in the released films, `wipe` and
  `hold` already land: the engine bends the arm onto their `to`, and the
  hand ends a median 4 box units from it. `strike` had no target. It was
  used 163 times, for beating washing on a stone (`gadha-hi`, `khichdi-hi`)
  and for beating someone (`oont-hi`, `gadha-hi`, `bachcha-hi`), and it
  chopped the air in front, wherever that was. That is how the `gadha-hi`
  washers came to beat cloth in the air.
  - **A `strike` takes `to`** (an actor, or a spot). The hand stops up and
    back from the target by the length of what it swings, at 40° above it,
    and the stick turns so its `tip` comes down on it. Someone struck is hit
    on the shoulders (along the body, so lying down works too), an animal on
    the middle of its back. On a camel, higher than the farmer's shoulder,
    the blow comes in level, as it would.
  - **The doer faces it.** A `strike`, `wipe` or `hold` at something turns
    its doer to it first, if idle, as a give does. In the released films
    that changes one shot: a seated wipe by the disguised king in the
    `prashn-hi` reel (`bhaagta`), where he faced away from the spot and his
    hand missed it by 44 units.
  - **`contact.reach`.** At the moment of contact (a strike's hit, half way
    through a wipe or a hold) the stick's end or the hand must be within
    0.12 of the doer's height of the target. The finding says whether it
    falls short or a long stick passes over, and where to stand. With the
    turn in place it finds nothing in the released films, where no strike
    had a `to`; it is there for the ones that will.

Places used a certain way (smart objects):

- **An anchor's `use`** says how the place is used: `pose` (`stand`, or
  `sit` on the ground there, or on the seat with a `floor`), `facing`, and
  `at`, the work point. A washing stone is the anchor where the washer sits
  plus the spot on the stone's top where the cloth lands. Before this, the
  `gadha-hi` washers were cast at a bare anchor, given an opening `sit` by
  hand, and beat with no `to`; the stones were then drawn where that blow
  happened to fall.
- **A `strike`, `wipe` or `hold` whose `to` names the anchor** lands on
  `at`, not on the feet point. Its doer is walked there, or sat there (a
  `sit` to it walks over first), timed to finish a turn's time before the
  work, then turned to `facing`. These are staged actions, so `talekit
explain` lists them. A doer cast there and working from the first moment
  opens the shot sat. A doer busy in that time, or sat somewhere else, is
  left alone, and `contact.reach` says it never got there. A work point out
  of reach is reported with where the blow lands from the anchor, which is
  the value to put in `at`.
- **Checked on a copy of `gadha-hi`'s ghat**, with Kallu's anchor given a
  `use`, frame by frame:
  - Cast at the anchor, he opens sat and turned to the stone, and the cloth
    comes down from above on the slab's far end, where the scene draws the
    wet cloth.
  - Cast 240 px away, he walks over, sits and then beats.
  - With `at` on the stone's near end, 45 px in front of him, the blow came
    down almost straight, with the hand in front of his face. The guide
    says to put the work about half the user's height in front.
- **A cot was left out.** Lying is already `lie` with a `to`, and a turn
  while lying flips the body, so `use` has no `lie` pose and gives no
  facing on a bed.
- **No released film changes.** None of their anchors has a `use`.

8.2 is done: same-place continuity, screen direction, blows that land,
places that say how they are used, and the bow carried across a cut.

## Render speed

Measured 2026-10-23 on a 12-core M-series Mac, on the race film (273 s,
agent-painted scenery at 100 to 200 KB of SVG) and lost-kite (61 s):

- **Fonts, not drawing, were most of a frame.** resvg read every system font
  for any SVG with fonts on, about 75 ms against 15 to 35 ms of drawing. Each
  `<text>` is now laid out once by resvg (`Resvg.toString()` returns the
  paths) and frames render with no fonts. Latin text frames move a few edge
  pixels by a step or two of 255. Text that inherits its look or sits under
  a `<style>` stays text.
- **Worker threads** (all cores but two, up to 8) each compose and rasterise
  whole frames; the main thread orders them for ffmpeg, as raw RGBA rather
  than PNG.
- **Memory.** resvg's frames live outside the JS heap, so V8 seldom collected
  and a worker held 6 GB in minutes. Each worker draws one frame per turn and
  runs a young-generation collection after it: under 1 GB.

The race film went from 262 s to 39 s (byte-identical), lost-kite from 41 s
to 10 s. Drawing still dominates: ffmpeg alone encodes the race in 7 s.

Drawing the scenery once per shot was tried and dropped. The backdrop is 27
of 38 ms a frame, but it is not still (a `sun` turns its rays, clouds and
rain move), so a cached backdrop repeated in 2 of 16 race shots; the still
parts cost less than unpacking a cached picture (about 8 ms), and drawing
the scene on a clear layer moved edge pixels by up to 54 of 255.

## Later (deliberately not now)

- A run with a non-Claude agent, and more MCP ergonomics.
- More emotions and eyebrows; image-model backgrounds as a layer.
- A bundled font for identical Latin text across machines (Devanagari is
  bundled already, see 7.7).
- From the passes above: ripples round a swimmer, `attach` to a named point
  (a parrot on a shoulder), a depth walk with planted feet, camera shake, a
  prop that turns with the hand, a hobble.
