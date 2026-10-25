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
- [ ] **Phase 6 — Polish loop.** Run the MCP on a fresh story, watch where
      the agent struggles, fix the guide or the engine. Two passes so far.
      `examples/lighthouse` led to empty variants, custom variants on the
      pose sheet, a warning on overlapping speech and, later, `attach`.
      `examples/clever-rabbit`, made by a subagent given only the story,
      led to tool argument names in the guide, `get_library_item`, larger
      contact frames, a film sheet from `render` and more. Vivek's review of
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

Decisions taken with Vivek: one drawing style for everything (**outlined
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
  fold back under the chest.
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
  fade with an alpha filter for the same reason.
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

Vivek asked (2026-10-23) for better-looking characters, suggesting downloaded
SVGs. Dropped-in art does not suit the engine: a downloaded cat is one
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
- **Cast shadows** (`cast.ts`), at Vivek's asking. Each light throws every
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
wrong, so it came after 7.1 to 7.7. Planned 2026-10-23 with Vivek. Six
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
  `audio/`. The library (95 files, 20 MB) is normalised on the way in, so
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
(2026-10-24) Vivek judged Chatterbox always better, for dialogue and
narration: it said हँसा right where Kokoro was badly wrong, and it acts. So
every voice is `chatterbox:<kokoro voice>`: Kokoro reads a calm reference
passage once at the character's pitch and speed (cached in
`~/.cache/talekit/references/`) and Chatterbox speaks every line in that
voice. `kokoro:` stays for quick drafts. A line takes about a second, which
`write_shot` can afford.

**First listen** (lion-mouse-hi) also led to:

- **A line is said with its speaker's emotion**, the one its face has then.
  No new field, because a face and a voice that disagree is a mistake.
  Chatterbox's exaggeration is set per emotion from Vivek's notes (an
  excited thought was better at 1.26 than 0.5, an angry shout at 0.5 than
  1.4, since the words carry the anger).
- **A sound is not a word.** Agents wrote growls and laughs into lines and a
  voice read them out. Text between asterisks is shown, never spoken; the
  action's `sound` is what is heard. The validator flags unmarked ones.
- **Nobody talks over the narrator.** The validator warns when a line and a
  narration overlap; a voiced line is talking until its voice stops, not
  until its bubble fades.
- Two espeak-ng slips in Hindi fixed in the sidecar (ड़, ऊँ).

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

**The .mkv** (2026-10-24), for the family's phones: the full mix, music and
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

Most of the family watches reels, not films (Vivek, 2026-10-24), so a story
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

The first reels kept the films' dialogue and cut events to fit, and told too
little: the race reel lost the hare stopping to eat, which is why he sleeps,
while two conversations took most of its time (Vivek, 2026-10-25). A reel is
told by the narrator instead, a sentence or two a shot over the cast acting
it out, with a character speaking only where the words turn the story. That
is a rule for the agent, in the guide; the engine needs nothing new.

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
