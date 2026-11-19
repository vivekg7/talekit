# talekit — build plan

**Goal:** good-quality 2D story films and portrait reels, made by AI agents
through the talekit engine. The agent writes what happens, in SVG and JSON it
is fluent in; the engine owns the hard parts (rigs, motion, staging, layout,
sound, encoding) and answers every write with a picture.

This file is the design record: what was decided, why, and what was rejected.
The file format is `docs/authoring-guide.md`; the module layout is in
`CLAUDE.md`. Finished work is kept as decisions, not as a history of building
it; open work is marked **Open**.

## Principles

1. **The agent never animates a limb.** It writes _what happens when_. Walk
   cycles, blinking, mouths, easing, bubble layout and camera moves are engine
   code: agent-authored motion looks wrong nearly every time.
2. **Constrain the drawing.** Characters are drawn into a fixed box with known
   pivots (a rig), so an LLM-drawn character animates reliably.
3. **Every write returns a picture.** Pose sheet, scene with anchors, contact
   sheet. Without that loop quality collapses.
4. **Plain files on disk.** A project is a directory of JSON (and a sketch's
   JavaScript, 7.11): any editor, any agent, git-friendly. The MCP server is a thin layer over the CLI's library.
5. **Deterministic rendering.** A frame is a pure function
   `(project, shot, t) -> SVG`; previews, tests and the video agree.
6. **The engine fixes whatever has one right answer** (a listener faces the
   speaker, a dropped pot falls straight, a walk goes round the well). It
   works these out on load and never writes them back: the file says what was
   meant, `talekit explain` says what the engine made of it.
7. **Everything else is an error with a way out.** When the engine cannot know
   what was meant, the finding blocks the render until fixed or waived with a
   reason (`allow`). No soft warnings for staging mistakes: agents learn to
   skip warnings, and each skipped one reaches the person as a glitch. A check
   that cries wolf is tuned, not demoted.
8. **Content belongs to the channel, not the engine.** The engine renders
   whatever a story calls for, gentle or violent. Audience rules (kid-safe
   endings for the children's channels) are kept per channel, out of the
   code, the guide and the critic, so that one engine can serve an adult
   channel too.

## Architecture

```
story (in the agent's head)
   │  agent writes JSON + SVG via MCP tools
   ▼
project directory   talekit.json, characters/, scenes/, shots/, audio/
   │
   ▼
engine (pure TypeScript, no I/O)   stage → timeline → motion/gait/springs → compose → SVG
   │                               world.ts: the findings that block a render
   │                               sound.ts: the cue sheet
   ▼
render   sketches (sketch/: p5-style canvas, fluid) run in order → a picture on the stage
   │       resvg on worker threads → raw RGBA → ffmpeg; audio mixer; .mkv; sheets
   │
   ▼
interfaces   cli.ts, viewer/ (review app), mcp/server.ts (stdio)
```

## Data model

- **Character**: a rig (`humanoid`, `quadruped`, `simple`) and parts, each an
  SVG fragment or named variants, drawn in the rig's box. `colors` are tokens
  (`{skin}`), so library characters recolour without redrawing.
- **Scene**: SVG at project size with named floor anchors; `left`, `center`,
  `right`, `offLeft`, `offRight` always exist. Optional `foreground`, `far`,
  `near` layers, and the world model (walk, water, solids, lights,
  perspective).
- **Shot**: a scene, a cast at anchors, and timed actions. The movie is the
  shots in filename order.

## Phases

- [x] **1 — Engine core.** Types, rigs, motion, timeline, compose, bubbles.
- [x] **2 — Render.** resvg, ffmpeg, pose / anchor / contact sheets.
- [x] **3 — Library + example.** Hand-drawn built-ins are the quality bar and
      the starting points. Large painted scenes (90–180 KB) are summarised by
      `get_library_item`, and `copy_from_library` takes `anchors`, so a story
      adds places without rewriting the scene: agents had spent a tenth of a
      run reading old scene generators.
- [x] **4 — MCP server.** Every write validates and returns an image.
      `patch_shot` edits by action index and returns only the changed
      stretch, because agents rewrote whole shots to move one line. Returned
      sheets are 1000 px wide (pose sheet 1200): a picture costs about
      w × h / 750 tokens and sheets were 18% of an agent's input; closer looks
      stay full size.
- [x] **5 — Viewer / review app.** The person must see the assets, point at a
      moment and talk back in something better than prose. Notes are plain
      files (`notes.json`) shared with the MCP (`list_notes` with the picture
      seen, `resolve_note`); the page polls mtimes to stay dependency-free.
      The frame keeps the film's shape; a click pins a spot; a resolved note
      waits for the person to agree, and reopening replies on the same note
      (fresh notes lost the first ask). One server holds every film, reel
      and board (a non-project folder of samples, each with notes and a
      pick). **Options** (`options/<question>/<choice>/`, laid over the
      project by `loadProject`) are written only where the agent cannot tell
      which way the person wants it; they stay out of the format (`check` and
      `render` never see them) because films are generated from Python
      sources a server could not write back to.
- [ ] **6 — Polish loop.** Run the MCP on a fresh story, watch where the agent
      struggles, fix the guide or the engine. `examples/lighthouse` and
      `examples/clever-rabbit` were the two runs. The rabbit's key beat (the
      lion seeing his reflection) was missed as a 70 px reflection on a
      side-on well; the fix was staging, a point-of-view shot down the shaft,
      and the guide's rule: when the plot turns on what a character sees, cut
      to what they see. **Open:** a run with a non-Claude agent, and a story
      that needs humanoid interaction.
- [x] **7 — Video quality.** Below.
- [x] **8 — The world model.** Below.

## Phase 7 — Video quality

Reviewing the first films put the ceiling in the engine's output, not the
tool loop: agent-drawn characters looked generated, animals bobbed like
stickers, nothing had weight, nobody looked at anyone, scenes were one flat
layer. Decided up front: one style (**outlined cartoon**, Bluey-like);
animals from a **library of rigged species** that agents recolour, drawing
from scratch the exception; **procedural motion with springs, not a physics
engine** (rigid bodies give ragdolls, not cartoon motion, and would break
determinism and preview speed). Audio went last so it would not mask visual
problems. A pass was done when review notes stopped being about it.

### 7.1 Art direction and character construction

- The guide holds a style sheet (one dark line colour, flat fills plus one
  darker shade, no gradients on characters) and per-rig construction rules;
  the rules are what make a linter possible.
- **The engine draws the outline** (`outline.ts`) at a fixed on-screen width,
  not per rig. Agents forget strokes and mix widths; a fixed width makes a
  mouse and an adult look drawn with one pen, and removes the need for
  outline checks.
- **The linter rasterises** each part (`construction.ts`) rather than parsing
  paths, so caps, arcs and transforms count exactly as drawn.

### 7.2 Quadruped rig and library species

Most children's stories are animal stories, and the simple rig cannot walk.

- Legs, tail and head hang from the body, which turns about the hips: `sit`
  is one rotation plus a drop; one diagonal-pair walk, no trot. Rig data
  carries what used to be `if humanoid` branches, so the linter treats every
  rig alike. Birds and fish stay on the simple rig.
- **Ears behind the head**: an ear in front carries its outline across the
  forehead and reads as a sticker.
- **Fused near legs and head** (`Rig.fuse`): separate legs read as drumsticks
  pressed on, a neck as a line across the chest. A more lifelike style was
  rejected; the cast keeps its round cartoon look.
- **A slow animal turn** (0.7 s, narrowing only to 0.45): a 0.2 s flip read as
  instant, narrower as a card flipping. **Hocks** (`Rig.hocks`) lift hind
  legs by swinging the joint back.
- **Hung parts** (`hangs`): plaits and cloth hang from another part at a
  point and join the rig, rather than new fixed humanoid parts that would fit
  one head only.
- **`belly`, `hem`, `hooves`, `Pose.loose`**: the character says where its
  underside and hem are and whether it has hooves, because one fixed lying
  drop left animals hovering or sunk, and redrawing them to fit would be
  worse; nothing in a drawing tells hooves from paws. The hem is sat on only
  when it would reach through the floor (resting it on the seat is wrong on a
  stool).
- **Raised seats**: the body starts lowered by the seat's height and rises as
  the knees bend; an animal hops up instead.
- Drawing lessons from the library batches (kurta length, water as a
  translucent foreground band, rigid necks that carry a face) are in the
  guide.

### 7.3 Motion with weight

Smoothness is contact, anticipation and follow-through, not interpolation.

- **Planted feet**: the leg cycle runs on distance, not the clock, and is
  shortened to fit whole half cycles into a move, so any duration works with
  no speed limit and a walk starts and ends with the legs together.
- **Springs** integrate at 120 Hz from the shot's start and are cached per
  shot, so a frame renders the same alone or in order; a teleport or a facing
  flip is a cut, not a push.

### 7.4 Acting

- **Looking** tilts the head toward the target at half the true angle, capped
  (10° people, 8° animals): the full angle read as a glare. The listener is
  the existing `to` on a line, not a new field. (Body turns came with 8.1.)
- **`attach`** is an action field, not a verb, so a drop and a move share one
  action; each rig names a hold point, so the prop follows the arm.

### 7.5 Depth and camera

- **Layers `far` and `near`**, not back/mid/front: `foreground` already meant
  "in front of the actors at their depth". A layer at parallax p takes the
  zoom raised to p, which guarantees a far layer that fills the frame still
  fills it; the authoring rule this costs is that `far` reaches the bottom
  edge.
- **Contact shadows** are drawn before any actor, so none lies across someone
  behind. The simple rig casts none by default: it is mostly things in
  mid-air.
- **`crossfade`** plays the previous shot on underneath, so every shot's
  length and timing stay as written.
- **Culling** (`cull.ts`): resvg panics, uncatchably, on a canvas wholly
  outside its bounds (four frames wide; a nested canvas is bounded about its
  parent's corner). The whole frame is culled through every layer and filter;
  a lone shape's `opacity` folds into fill/stroke opacity so it needs no
  canvas; only an `id` something points at is kept whole.
- **Knees and elbows** (`Rig.bends`) are cut and turned by the composer, not
  drawn as shin parts, so every limb already drawn as one stroke bends. An
  animal's planted legs do not give: on legs that short a give is rubbery.
- **Turning faces and bodies** (`Rig.turn`, `back` variants): front-on faces
  on side-on bodies stared at the viewer. The engine slides and narrows parts
  for three-quarters, so every existing character turns; backs are variants,
  so a character without one still works.
- **Riding `on`**: the spot is kept in the coordinates of the carrier's main
  part, not its root, because a lying animal lowers its body, not its root.
- **Perspective** (`perspective`: floor y → scale, `depth.ts`): hand-set anchor
  scales drifted apart and a raised platform at the back read as standing
  beside the front row. `world.scale` flags a spot more than a fifth off it.
  A perspective inferred for scenes that declare none was dropped: it flagged
  deliberate sizes (birds in trees, a mountain's face). Aerial haze by depth
  folds into the existing light filter, so it is free; a stage fire is drawn
  among the actors by depth.

### 7.6 Weather and moving nature

- The engine draws what moves by itself (scene `weather`, `effects`) from time
  and `hash01`, so a frame still renders on its own; painted rain hung in the
  air.
- Rain and snow at three depths move with the camera and wrap, so the frame
  is always evenly full. Lightning brightens through a gain filter: white
  laid over read as fog.
- `weather.scale` marks a close-up: the engine cannot tell one from a wide
  shot.
- **Shelters are spans**, not shapes: a drop only needs where it stops, and a
  span can be read off the drawing. A drip asks where a carried shelter's
  edge was when it fell, so it does not slide with the umbrella.
- Clouds sit in fixed slots, so a clearing sky does not reshuffle them.
- `weather.light` tints the characters only; a scene is painted in its own
  colours and left alone.

### 7.7 Light and form

Downloaded art does not suit the engine: it is one picture where the rig needs
parts, mixes styles, and brings its own outline. Flat colour was what made
the library look like stickers, so **the engine draws the light**, as it
draws the outline; downloads are reference only.

- **Shade** (`shade.ts`): a hard-edged mask of each part nudged toward the
  light, one mask and no blur, so resvg stays fast.
- Clouds grade the far layer in screen space; the stage is left as painted
  (wet ground stays wet).
- **A move gets up first**: agents forgot `stand` and slid along the floor.
- **`camera.follow`**: agents timed pans by hand and got them wrong. The
  camera trails a weighted mean of the last 0.9 s rather than a spring, so
  every frame is computable alone; samples are clamped into the scene first.
- **Devanagari** is shaped with HarfBuzz into outlines in bundled Baloo 2
  (`glyphs.ts`): resvg misplaces vowel signs with every font. Only that
  script takes this path; one bundled font for all text would have changed
  every film's look for a Hindi-only problem.
- **Cast shadows** (`cast.ts`): the actor's own silhouette, not an ellipse,
  so a raised arm shows, through one affine map that serves every rig. Lights
  are declared, not guessed from the art; painted scenery keeps its
  painter's shadows.
- **`pickup` / `putdown`**: props appeared in hands from nowhere. Any attach
  eases, unless from further than the carrier's height, which reads as a
  cut.

### 7.8 Audio

**The engine owns sound that follows from what is on screen** (footsteps,
ambience, thunder, landings); the agent chooses only what a story chooses:
voices, music, one-off noises. Layers: music (agent), ambience and effects
(engine, plus a `sound` action), thoughts, dialogue and narration (TTS).

- **CC0 or public domain only**, credited in `sounds/CREDITS.md`: a public MIT
  repo is redistribution, which rules out CC-BY and Pixabay/Mixkit terms. The
  library is normalised on the way in, so the mix uses fixed levels.
- **Voices from a local model, not a service**, via a Python sidecar
  (`tools/tts/`) on MLX, where the good models are. A voice is `engine:name`,
  so models can be added without a format change. Without the sidecar
  everything works silently on estimated timings.
- **Takes are cached in the project** and the render reads only the cache: the
  models are not bit-identical run to run, so this is what keeps rendering
  deterministic.
- **A voiced line lasts as long as its audio**; the mouth follows its
  loudness.
- **Our own mixer, not an ffmpeg filter graph**: it sums with known gains and
  ducks music on ramps computed from when lines play, so no compressor is
  guessing. The cue sheet is pure (`sound.ts`); I/O is `audio.ts`.
- **Model** (2026-10, scored by Whisper and by ear): Chatterbox multilingual
  speaks every line, in a voice made by Kokoro reading a reference passage at
  the character's pitch; it acts and got Hindi right where Kokoro did not.
  Kokoro stays for quick drafts. Rejected: rumik-oss (slow, four women's
  voices), Voxtral (non-commercial licence).
- **A line is said with its face's emotion**, no new field: a face and voice
  that disagree is a mistake. Exaggeration per emotion is tuned from notes.
- **Sounds are not words**: text between asterisks is shown, never spoken.
  **Nobody talks over the narrator** (a validator check). The sidecar
  respells words Chatterbox mispronounces (`RESPELL`; the screen keeps the
  real spelling).
- **Beds were too loud on a phone**: lower beds, ducking that holds through
  gaps under 1.5 s, and a listener-set `mix` (the review app plays cached
  stems through gains; mixing is linear, so stems sum to the film). Chosen
  over a voice-keyed compressor: fixed levels with a hold do it without
  guessing.
- **The .mkv** carries the full mix, music-and-effects with and without the
  narrator (each raised to the full mix's loudness, with a limiter), subtitles
  and a chapter per shot; the mp4 stays because phone galleries may not play
  mkv. It is built from the mp4 with the picture copied. The dialogue-free
  tracks do not duck for unheard lines. **Translations come from the agent**
  (`translation`), not a model at render time: the agent knows the story, and
  the render stays offline and deterministic.

### 7.9 Reels (portrait)

Most viewers watch reels, so each story also comes as a 720 × 1280 reel of at
most three minutes. **A reel is its own project**, a second, shorter telling
with tall scenes, not a reframe: a 9:16 window keeps a third of a wide scene,
so a conversation does not fit and pan-and-scan would make every exchange a
whip pan.

- Text scales by the short side, so a reel's text matches a film's on the same
  phone. Bubbles and captions keep out of the area the apps draw over;
  narration goes at the top (at the bottom it sat on the cast).
- Three minutes is a warning, so a draft can run over. No .mkv: the apps play
  one track and no subtitles.
- **No format field**: a frame taller than wide is portrait. Tall library
  scenes are marked by a `-tall` suffix for the same reason.
- **Reels are narrator-led** (a guide rule, no engine change): reels that kept
  the films' dialogue cut causal beats to fit (the hare stopping to eat, which
  is why he sleeps).

### 7.11 The open canvas (sketches)

Fluid reels drawn as SVG polylines looked thin next to a real fluid
simulation: its look comes from a dye _field_, a colour in every pixel, where
folded dye shows thousands of filaments and the light comes from the field's
gradient. No amount of SVG gets there, so a shot can run code on a raster
canvas (`sketch`), drawn on the stage and composed with everything else.

- **p5.js in instance mode** is the API (`sketch/p5.ts`): agents write it
  fluently, and its model (setup, draw per frame, fill/stroke state, a canvas
  that keeps what was drawn) suits frames. It is a subset over a Skia canvas
  (`@napi-rs/canvas`): p5's semantics need a real raster canvas (trails,
  pixels, blend modes), which resvg cannot be. Rejected: real p5 under jsdom
  (a DOM to fake, unseeded chance) and collecting shapes as SVG (a trail of
  ten thousand circles never clears).
- **Time and chance are the film's**: draw runs once per frame at the
  project's fps, `p.time` is the shot's seconds, `random` and `noise` are
  seeded. Sketches are `.js`, not `.ts`, so they import in Node 20 without a
  loader.
- **Stateful, and still a function of t.** A simulation cannot jump to t, so
  frame n is what draw leaves after n + 1 calls; the runner
  (`render/sketch.ts`) keeps runs and carries them forward, so frames asked in
  order (the film, a contact sheet) cost one draw each. The film sends a
  sketch shot's frames, and a dissolve into or out of one, to a single worker.
- **Late previews** (2026-11): a preview at 33 s replayed 990 draws in a fresh
  process. Two remedies, both keeping frame n a function of t. An opt-in
  `p.update` steps the state every frame and `draw()` runs only for frames
  shown; it is opt-in because a sketch that leaves trails on its canvas
  needs every draw, and the film, which shows every frame, calls both
  anyway, so a split sketch's film and previews are the same pixels. And
  `frame -t 3,9,15` draws several times in one run, in time order.
  Measured on split copies at full size: thinkpaws-jets-1 at 4 s, 87 s to
  63 s (each skipped frame saves the fluid's shading and bloom);
  thinkpaws-flock-1 at 33 s, 65 s to 59 s (its simulation is the cost, not
  its drawing); six times of the flock in one run 58 s, against about
  three minutes as six calls. A fluid's dither was seeded by how many times
  it had been rendered, so a split frame differed in its grain; it is now
  seeded by its steps. No snapshots of state to jump from: a sketch's state
  is arbitrary JS, so saving it would need the sketch's help.
- **The camera, seen by the sketch** (2026-11). A canvas on the stage is a
  bitmap the camera scales, so a zoom blurs it, and agents wrote their own
  cameras inside sketches to stay sharp. Now `p.camera` and `p.view` are
  the shot's camera at the frame (resolved by the runner with the engine's
  `resolveCamera`), and `p.screen = true` asks for a canvas in screen space:
  compose puts it just before the camera group instead of first inside it,
  the same depth (over `far`, under the scene's `svg`), but with no
  transform, so resvg draws it pixel for pixel; `applyCamera()` gives the
  sketch the camera's transform (a no-op in world mode, so one sketch
  works both ways). Declared in the code, not the shot: the runner has run
  setup before compose asks for the picture, so the canvas callback returns
  `{ href, screen }` and the schema stays out of it; whether a sketch is
  drawn for the screen is a fact about its code. The camera is the only one
  (shake is an actor verb, not a camera move), and a lightning flash or
  vignette goes over the whole frame either way. A preview at a t between
  frames places the scene by the camera at t and the screen canvas by the
  camera at its frame: under one frame of camera movement, and none in
  the film, whose times are frames.
- **Parameters** (2026-11): `sketchParams` on the shot, `p.params` in the
  code, so one sketch serves several shots and tuning is a JSON edit;
  `--param k=v` on `frame` and `contact` overrides one for a picture.
  Values are numbers, text and booleans: enough to tune, and what a CLI
  flag can say.
- **The run cache's key** is the sketch file's version, the shot, its
  length, the density and its params. The camera joins it only once the
  code has read `p.camera` or `p.view` (a getter notices), since most
  sketches never do and a camera edit should not replay them. A following
  camera depends on where its actor walks, so then the whole shot and its
  scene are the camera's key. A picture's href names its run, so a
  restarted run never shows a kept picture of another.
- **The engine never runs code**: `composeFrame` takes a `canvas` callback
  that gives the picture's href, so the engine stays pure and a test's
  project draws without it.
- **A picture in the SVG, not pixels composited after.** The canvas is an
  `<image>` at the start of the stage layer, so it sits in depth like the
  scene (over `far`, under `svg`), moves with the camera, dissolves with its
  shot, and every caller that draws a frame (film, previews, sheets, critic,
  covers, the review app) shows it with no path of its own. Compositing pixels
  after resvg would have saved ~55 ms a full-size frame but put the canvas
  only under or over everything, and given previews a second path.
- **Handed to resvg, not encoded into the SVG**: hrefs on a host that cannot
  resolve (`sketch.talekit.invalid`), resolved from memory with a stored
  (uncompressed) PNG. Measured at 1080 × 1920: Skia's PNG encoder 250 ms, a
  stored PNG 6 ms plus 60 ms for resvg to draw it; base64 in the SVG cost
  300 ms to parse. The review app, a browser, gets them inline.
- **Previews draw at half density**: the same picture from shapes, nearly the
  same from a fluid (its grid is fixed, its dye half as fine), a quarter of
  the dye's cost. The film and covers draw at full size.
- **The fluid** (`sketch/fluid.ts`) is a CPU port of Pavel Dobryakov's WebGL
  Fluid Simulation: vorticity confinement, pressure by red-black SOR warm
  started, MacCormack dye advection at the canvas's resolution, then shading,
  bloom and sun rays. About a second a full-size frame on one core.

### 7.10 Voices that sound human — Open

After twenty-two released films the voices are the weakest part: clear, but
read, not acted. Causes:

- **Every voice copies a synthetic one.** Chatterbox copies its reference
  clip's timbre _and_ its flat read-aloud delivery, and the reference is
  Kokoro reading calmly (`reference()` in `tools/tts/speak.py`). Every story
  uses one of four such voices.
- **Characters are told apart by `asetrate`**, which shifts formants with
  pitch: it sounds unnatural rather than like another person.
- **Each line is spoken alone**, so there is no back-and-forth rhythm.
- **The mix flattens acting.** `level()` (`src/project/voices.ts`) brings every
  take to one loudness; only `STYLE_GAIN` (`src/engine/sound.ts`) lifts a
  shout and lowers a thought. A scared whisper plays as loud as plain speech,
  and spoken lines are dry in every scene.
- Chatterbox's Hindi is its weaker language (hence `RESPELL`).

Tasks, in order:

1. **Other models** — done, first round. Wanted: Hindi, cloning or described
   voices, a licence that allows sold films. Candidates were VoxCPM2
   (Apache-2.0, in mlx-audio), IndicF5 (MIT, gated), Indic Parler-TTS
   (Apache-2.0, gated) and Chatterbox with a human reference. Ruled out by
   licence: OmniVoice, Fish Audio S2, XTTS-v2, Voxtral, Higgs Audio v3. The ear
   decides, not Whisper, since a flat take can be heard perfectly. Nine lines
   of clever-rabbit through VoxCPM2: clearly better only on two lines
   Chatterbox got wrong. **The model is not what holds the voices back**, so
   no switch; a second engine for takes the retake loop gives up on stays an
   option.
2. **Human reference clips** (next). Each voice recorded once by a real
   person, about ten seconds per emotion, reused across stories; a line uses
   the clip of its emotion, since the model copies delivery as well as voice.
   Kept out of the repo (a voice belongs to its speaker; the repo is public)
   and used only with consent. Ends `asetrate`: a character gets a different
   person, not a shifted one.
3. **Mix.** Loudness by emotion and style (scared and sad quieter, angry
   louder), and the scene's room on spoken lines (indoors, forest, well).
   Both pure functions of the cue sheet.
4. **A hosted voice, last resort.** ElevenLabs v3 speaks Hindi, acts from tags
   and voices a dialogue in one pass, but reverses "local model, not a
   service" (7.8). Takes would still be cached, so renders stay
   deterministic. A narrower use: the narrator only, who speaks most.

## Phase 8 — The world model

After eighteen released films, about 70 of 110 review notes were mistakes
the engine could have known about: support and gravity (a floating baby,
washers beating cloth in the air), teleports and continuity (a roti flying
between mouths), attention (listeners facing away), readability (bubbles over
faces), solidity (walking through a well), reach (an axe landing outside the
bed), audio (lines with no voice). The cause each time: the engine knew where
things were drawn, not what they were. Principles 6 and 7 came out of this.

Every finding has a code, shot, time span, actors, one sentence on what is
wrong and why it shows, a patch when mechanical, and a frame with the spot
ringed. The same findings come from `check`, `render` and every MCP write.
**A write is saved anyway** so the agent can look and iterate; only the
render is refused. Each check was calibrated over the released stories: a
finding there is a false positive to tune away or a mistake the review
missed.

**Not Blender, Unity or Godot.** The failures are about knowing the world, not
drawing it; moving would put the agent in front of a much larger, mostly 3D
API and lose the rigs, library and contract. Rapier, a navmesh and Clipper2
were planned; only resvg and whisper.cpp went in: falling was simple enough
to work out directly, routing is a visibility graph, and the polygon tests
are a few lines of our own.

### 8.0 Base

- Scenes say where feet can stand (`walk`) and where water is (`water`,
  `wade`); characters say where they can be (`habitat`). `allow` waivers carry
  a reason, and a key that names no check is an error, so a typo waives
  nothing.
- `world.ts` samples each shot every 0.1 s and runs the rules; the first is
  **support**. `write_scene` does not refuse on a world error: an agent fixing
  its walk areas needs the sheet to do it.
- **Walk wins over water** (a washing stone in a river). A `river` effect's
  points are not the water (they run over the bank). **Areas are flat on the
  screen**: they cannot tell a pot floating in front of the floor from one
  standing further back, so the rest needs motion rules (no gliding `move`,
  gravity, `climb`).

### 8.1 Attention and gravity

- **Attention** (`stage.ts`): the engine stages `set.facing` turns: the
  speaker to its `to`, listeners to the speaker staggered by `hash01`, a
  `reacts` to its cause just before. Busy, walking, lying, eyes-closed or
  carried actors do not turn. Only a `set.facing` near the line counts as the
  agent directing it; a move does not (guards who ran in kept facing their
  run). `attention.*` findings judge the whole line, not a moment. An archer's
  `aim` keeps its eyes on the mark.
- **Gravity**: a let-go prop falls straight to the floor its carrier stands on;
  `fall` drops a thing off a shelf. Worked out directly (exact for a straight
  drop), so Rapier waits for tumbling and rolling. Feet within 12 px snap onto
  a walk area.
- **`climb`** for ladders and trunks, held to `climb` areas: guards slid down
  a machaan ladder in a standing pose with `move`. A `move` that lifts a
  walker off the ground is flagged and names `climb`, `jump`, `fall`.
- **`continuity.jump`**: anything in sight faster than 1500 px/s between
  samples (a hand-over from too far, a `set.at` in view). Arrows, falls, and
  props through their holder's turn are exempt. An arrow now shows on the
  string only after the archer's turn, since the side-on drawing mirrors half
  way round.
- **`give`**: the two face each other and each reaches its share of the way,
  by arm length; the prop changes hands at the meeting point, so it never
  leaves a hand. A stoop at chest height was dropped: at the limit the two
  crouched into each other. `give.reach` flags hands that cannot meet.
- **Speech check** (`speech.ts`, `hear.ts`): every take is heard by
  whisper.cpp (MIT; AI4Bharat's Hindi model is gated behind a login, so
  cannot be the default). Whisper spells Hindi loosely, so line and hearing
  are both reduced to a skeleton of sounds a listener tells apart, and
  differences are read as runs. A take that seems wrong is heard again cut at
  its pauses (Whisper drops a word said alone). A bad take is retried with
  other seeds, up to three; a line no take says is `speech.mismatch`. Only
  what was heard is stored and judged afresh on load, so a better judge never
  leaves a stale verdict.

### 8.2 Continuity

- **`cut: 'next' | 'later'`**: a hard cut defaults to `next`, a crossfade to
  `later` (a dissolve reads as time passing); after a title card or in another
  scene a shot starts fresh. Across a `next` cut everyone must start as left
  (place, posture, sleep, held props, size) or it is `continuity.cut`.
  **Errors, not fixes**: the cast states starts explicitly, and the engine
  cannot tell a slip from a jump in time; a skip is one word.
- **Facing carries** across a `next` cut as a visible 0.2 s turn at t 0, staged
  by the engine. An aimed archer's bow stays in the far hand down a chain of
  carry-on shots (it had jumped 40 px at each cut).
- **Screen direction** (`continuity.direction`): a journey keeps its direction
  across places, dissolves included ("they walked for days" skips time, not
  the way). A new trip after a skip is waived, since the engine cannot tell
  it from the same trip. Agents habitually send people off left and bring
  them on moving right.
- **The 180° line** (`continuity.line`) across a cut to a closer view or
  insert: on a 2D stage a swap is only ever the cast moved. **Eyelines were
  tried and dropped**: 20 of 23 hits were dissolves to another place, where a
  turn to leave or lead is as common as a broken eyeline.
- **Blows that land**: `strike` takes `to` and the tool's `tip` comes down on
  it (washers had beaten cloth in the air, since a strike chopped the air in
  front). A `strike`, `wipe` or `hold` turns an idle doer to its target.
  `contact.reach` checks the hand or tip at contact. A `hold` or `wipe` with a
  tipped tool puts the tip on `to` (priests' ladles hung off the hand
  wherever); a carried prop never rests below its holder's floor line, and a
  seated holder props a tool across the lap.
- **Anchor `use`** (smart objects): `pose`, `facing` and `at`, the work point.
  Work at the anchor lands on `at`, and the doer is walked or sat there and
  turned first. Before this, washing stones were drawn wherever an unaimed
  blow happened to fall. A cot was left out: lying is `lie` with `to`, and a
  turn while lying flips the body.

### 8.3 Solids and readability

- **Bubbles off every face** (`place.ts`): ten candidate places, scored by
  faces covered (the speaker's double) plus a small cost per step from
  centred. Chosen once per line from five frames, then the bubble follows the
  head, so it does not hop. Crowds where every place covers someone remain.
- **What shows** (`sight.ts`) renders masks with resvg rather than reasoning
  about boxes. `sight.face`: more than half a speaker's face under foreground
  art (half, because approved films had a thief peeking round a pillar at 41%
  and a jackal under 55%-opaque water). `sight.hidden`: a `hidden` actor is
  still drawn (unlike `visible: false`) and is flagged if more than 3% shows.
  Effects are left out; they come and go.
- **Solids and routing** (`route.ts`): walks go round named footprints by the
  shortest way on a visibility graph, keeping to the walk areas. **A solid is
  passed on one side**: art is flat, so a well in `svg` is drawn under
  everyone and one in `foreground` over everyone; the solid names its layer
  and the strip behind or in front of it is blocked too (a lion routed round
  the front walked "into" a foreground wall). **Openings are not built**: a
  gap is where no footprint is, which is enough until enclosures have insides
  on screen.
- **Art checks** (construction warnings, shown on sheets): a split elbow (the
  drawing reaching more than 4 units past the joint disc; the message gives
  the `bends` that centres it) and a sway whose far end moves more than 40 px
  (approved crowns move 33). The pose sheet shows follow-through parts thrown
  to their 28° limit. **Dropped**: a per-pose joint check (found nothing over
  316 characters, a body is big enough that standing overlap implies turned
  overlap, and it cost a quarter of `check`); a check for swaying art touching
  still art (all art touches its background). The guide says to sway pieces
  held where they hang instead.

### 8.4 A vision critic

- **Frames at beats, captioned with intent** (`critic.ts`, `critique`,
  `talekit critic`): first and last frame, each line's middle, each verb at
  its work or done, the frame before the cut; repeats looked at once, nothing
  inside a dissolve, at most eleven. The caption (who says what to whom, the
  verbs, the engine's staging, each actor's state) is the point: the critic
  judges the picture against what was meant. Plus a read-through of every
  line and silence of 4 s or more.
- **The checklist is a guide section ("The critic")** printed by the tool, so
  there is one copy; its items come from review notes no check catches.
- **Best done by a fresh agent**: the author sees what was meant. It is
  judgment, so it gates nothing.
- Trial: five planted mistakes in a released film; a fresh agent found four
  surely and the fifth unsure, plus true faults the review had missed. One run
  is a sign, not a measure.

### Cause and effect

"Every action has a reaction": wind already moved weather and sway. What did
not reach anything:

- **Startles** (`stage.ts`; the loud sounds are `STARTLES` in
  `library/sounds.ts`): a loud sound briefly changes calm
  faces and turns free heads to its source. A roar said `to` someone startles
  that one only, and a growl nobody: the first cut frightened the lion's own
  allies. The face settles after 1.5 s, because the engine cannot tell whose
  side anyone is on: a flinch is physics, a lasting fear is the story's.
  Fleeing, anyone the shot directs around then, and waking sleepers are left
  to the author: they are plot.
- **Mouth sounds** hold the mouth open while they play.
- **Hits that land**: a `strike` with `to` gets a thud unless a sound is
  already within 0.3 s (so hand-placed thuds are not doubled), and the struck
  one recoils. The knock is in the pose, not the position, so support and
  continuity never see an actor shoved off its area.
- **Wind on springs**: gusts push springs as a pivot's acceleration would,
  never past the 28° limit; each spring starts where the wind holds it, or
  every shot in a gale opened with plaits swinging out.
- **Landings and splashes** (`impact.ts`) are read off how actors move, not
  off the actions; the landing surface decides dust, splash or nothing.
  `waterline` exists because swimmers sit below a foreground band, which hid
  splashes drawn at the feet. Sizes go by the square root of what lands, so a
  frog's still shows.
- **Bow waves** are built from the swimmer's sampled past, not a fixed shape,
  so the V lengthens with speed, bends round a turn and fades when it stops.
  Three ripples per arm: one line was lost in painted waterline dashes.
- **Footprints** only on `surface: sand | snow`: prints on grass would be
  wrong, and every grass scene would sprout trails on a re-render.
- **Held sails** (`sail` on a prop) lean downwind about the grip as a function
  of time, not a spring (a held pole is stiff). A marker, not a guess from the
  shape: only the author knows a banner from a board.

**Open:** prints across a cut, a wake that breaks on a bank, a body leaning
into a gale, a planted flag facing downwind.

## Render speed

Measured on a 12-core Mac: the race film went from 262 s to 39 s,
byte-identical.

- **Fonts, not drawing, were most of a frame** (resvg read every system font).
  Each `<text>` is laid out once into paths and frames render with no fonts.
- **Worker threads** compose and rasterise whole frames, sent to ffmpeg as raw
  RGBA. Each worker draws one frame per turn and runs a young-generation GC
  after it: resvg's memory lives outside the JS heap, so V8 seldom collected
  and a worker grew to 6 GB.
- **Drawing the scenery once per shot was dropped**: the backdrop is not still
  (sun rays, clouds, rain), its still parts cost less than unpacking a cached
  picture, and drawing on a clear layer moved edge pixels.

## Later (deliberately not now)

- More MCP ergonomics.
- More emotions and eyebrows; image-model backgrounds as a layer.
- A bundled font for identical Latin text across machines (Devanagari is
  bundled already, 7.7).
- From the passes above: a depth walk with planted feet (a walk mostly in y
  still slides its feet), camera shake, a prop that turns with the hand,
  `attach` to a named point (a parrot on a shoulder), a hobble, a carrier
  that is itself carried.
- Needing engine work, not drawing: a slithering snake, crutches, a
  wheelchair.
