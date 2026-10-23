# talekit — build plan

talekit turns a written story into a simple 2D animated video. An AI agent
drives it through an MCP server: it designs characters and scenes, writes a
shot timeline, looks at rendered previews, fixes what looks wrong, and renders
an mp4. The product idea is "Paper for video": give the agent a language it is
fluent in (SVG + JSON), own the hard parts (rigging, motion, layout, encoding)
inside the engine, and close the loop with pictures.

## Principles

1. **The agent never animates a limb.** It writes _what happens when_ (a shot
   timeline). Walk cycles, bobbing, blinking, mouth flaps, easing, bubble
   layout and camera moves are engine code. Agent-authored motion looks wrong
   nearly every time, so the engine is where quality lives.
2. **Constrain the drawing.** Characters are drawn into a fixed canonical box
   with known pivot points (a rig template). The agent fills in shapes; the
   engine knows where the shoulders and hips are. This is what makes an
   LLM-drawn character animate reliably.
3. **Every write returns a picture.** `write_character` returns a pose sheet,
   `write_scene` returns the scene with anchors labelled, `write_shot` returns
   a contact sheet. Without that loop the output quality collapses.
4. **Plain files on disk.** A project is a directory of JSON files. Any editor,
   any agent, git-friendly. The MCP server is a thin layer over the same
   library the CLI uses.
5. **Deterministic rendering.** A frame is a pure function
   `(project, shot, t) -> SVG string`. Rasterising and encoding are separate
   steps, so previews, tests and the final video all agree.

## Architecture

```
story (text, in the agent's head)
   │  agent writes JSON + SVG via MCP tools
   ▼
project directory
   talekit.json          title, size, fps
   characters/*.json     rigged SVG puppets (canonical box + part variants)
   scenes/*.json         background SVG + named anchors (+ optional foreground)
   shots/*.json          timeline: cast, actions (walk, say, wave, camera...)
   │
   ▼
engine (pure TypeScript, no I/O)
   timeline.ts   resolve actor state at time t (position, facing, pose, bubble)
   motion.ts     action -> pose (part rotations, body offset, face variants)
   rigs.ts       rig templates: part names, pivots, hierarchy, draw order
   bubble.ts     word wrap + speech/thought bubble geometry
   compose.ts    frame SVG: scene, actors by depth, foreground, bubbles, captions
   │
   ▼
render
   raster.ts     SVG -> pixels via @resvg/resvg-js (no browser needed)
   video.ts      frames drawn on worker threads (frame-worker.ts), raw RGBA -> mp4 via system ffmpeg
   sheets.ts     character pose sheet, scene anchor sheet, shot contact sheet
   │
   ▼
interfaces
   cli.ts        init / check / library / copy / sheet / frame / contact / render / serve / mcp
   viewer/       review app: film scrubber, asset sheets, notes for the agent
   mcp/server.ts tools over stdio for Claude Code and other agents
```

## Data model (v0)

- **Character**: `{ id, name, rig: 'humanoid' | 'simple', height, colors?,
parts }`. Each part is an SVG fragment string, or a map of named variants
  (`mouth: { closed, open, smile, sad }`, `eyes: { open, closed }`). Humanoid
  parts live in a 200×400 box with feet at y=400; the rig defines pivots.
  `colors` are named tokens substituted into the SVG (`{skin}`) so library
  characters can be recoloured without redrawing.
- **Scene**: `{ id, name, svg, foreground?, ground?, anchors }`. Drawn at
  project size. Anchors are named floor points (`door: { x, y, scale? }`) so
  the timeline can say "walk to the door". Stage shortcuts `left`, `center`,
  `right`, `offLeft`, `offRight` always exist.
- **Shot**: `{ id, scene, duration, cast, camera?, fadeIn?, fadeOut?,
actions }`. Cast places characters at anchors. Actions are
  `{ t, actor?, do?, to?, duration?, say?, emotion?, caption?, camera?, set? }`.
  Verbs: walk, run, move, fly, jump, wave, nod, shake, point, tremble, sit,
  stand, bounce, spin, appear, disappear. Dialogue is `say` (speech or thought
  bubble); it also drives the mouth. The movie is the shots in filename order.

## Phases

- [x] **Phase 1 — Engine core.** Types + validation, rigs, motion, timeline,
      compose, bubbles. Unit tests for timeline resolution and wrapping.
- [x] **Phase 2 — Render.** resvg rasteriser, ffmpeg encoder, pose/anchor/
      contact sheets. `talekit render` produces an mp4.
- [x] **Phase 3 — Library + example.** Built-in characters (kid, grown-up,
      dog) and scenes (park, home, street) drawn by hand as quality bar and as
      copy-and-recolour starting points. A one-minute example story that
      doubles as the integration test.
- [x] **Phase 4 — MCP server.** `get_guide`, `create_project`, `project_info`,
      `get_item`, `list_library`, `get_library_item`, `copy_from_library`, `write_character`,
      `write_scene`, `write_shot`, `delete_item`, `preview_frame`,
      `preview_shot`, `render`, `list_notes`, `resolve_note`. Every write
      validates and returns an image.
- [x] **Phase 5 — Viewer.** `talekit serve` with a shot picker and scrubber.
      Grown into a review app after the clever-rabbit run: the person could
      not see the assets, could not point at a moment, and had no channel
      back to the agent except prose. Now the page shows every character and
      scene as its sheet, plays live frames or the rendered mp4 with a shot
      strip, and saves notes against an asset or a shot time to
      `notes.json`. The agent reads them with `list_notes` (each with the
      picture the person saw) and closes them with `resolve_note`, the same
      selection-plus-comments loop Paper uses. Notes are plain files so the
      viewer and the MCP share nothing but the directory; the page polls
      file mtimes rather than watching, to stay dependency-free.
- [ ] **Phase 6 — Polish loop.** Run the MCP from Claude Code on a fresh
      story, watch where the agent struggles, and fix the guide or the engine.
      First pass done with `examples/lighthouse` (seagull and lantern drawn
      from scratch, two new scenes). It surfaced: empty variants were rejected
      (now allowed in a variant map), custom part variants were invisible on
      the pose sheet (now shown), the guide understated `say` duration (fixed,
      and `write_shot` now warns on overlapping speech), and no way to carry a
      prop (documented workaround; proper attach is below).
      Second pass: a fresh subagent given only a Panchatantra story and the
      tool made `examples/clever-rabbit` (five animals from scratch, 101 s)
      with two staging rewrites. Its report led to: tool argument names in
      the guide, a worked simple-rig box and `get_library_item`, draw order
      documented, face fallbacks listed and labelled on the pose sheet,
      larger contact-sheet frames, a film sheet from `render`, a leaning
      `point` and a `tremble` verb for the simple rig, the scene ghost sized
      to the tallest character, and the scale tween documented. Vivek's
      review of that film found the story's key beat missing: the lion
      never saw anything in the well, because the subagent staged a 70 px
      "reflection" at the rim of a side-on well. The fix was staging, not
      engine: a point-of-view scene looking down the shaft, the reflection
      drawn large in the water, the lion leaning over the rim before the cut
      (shots 07 to 09, now 111 s). The guide gained the rule behind it:
      when the plot turns on what a character sees, cut to what they see.
      Next: a run with a non-Claude agent, and a story that needs humanoid
      interaction.

## Phase 7 — Video quality

Reviewing the three films (2026-10-21) settled where the ceiling is. The tool
loop works; what comes out of the engine does not look like a cartoon yet.
Specifically: agent-drawn characters look generated (generic shapes, no
construction, a deer leg overlapping its body by six units so it reads as
detached), animals move by bobbing a sticker, nothing has weight, nobody
looks at anyone, and scenes are one flat layer. Audio is a known gap and is
deliberately last: it would mask the visual problems, so those come first.

Decisions taken with Vivek before planning: one drawing style for everything
(**outlined cartoon**, Bluey-like); animals come from a **library of rigged
species** that agents recolour and adapt, drawing from scratch stays the
exception; movement is **procedural with springs**, not a physics engine (a
rigid-body simulation gives ragdolls, not cartoon motion, and would break
determinism and preview speed).

Each pass ends the same way: re-render all three examples, put before and
after side by side in the review app, and leave notes. A pass is done when
the notes stop being about that pass.

### 7.1 Art direction and character construction

Why first: every later pass draws on top of the characters, and the rules
also make the linter possible.

- **Style sheet** in the guide, short and absolute: a single dark outline
  colour, outline width per rig (humanoid 6, simple and quadruped 5 canonical
  units) with round joins and caps, `paint-order='stroke'` so outlines sit
  under fills of the same shape, flat fills with one darker shade for inner
  detail (muzzle, belly, inner ear), no gradients on characters, eyes built
  as white + iris + highlight, a soft ground shadow drawn by the engine, not
  the artist.
- **Construction rules** per rig, the part the guide is missing today: every
  limb is a stroke from its pivot; a limb must overlap the body silhouette by
  at least 12 units; the neck sits inside the head; nothing outside the box;
  feet on the baseline; smallest readable feature 6 units; parts listed in
  draw order with the near side in front.
- **Character linter** in `validate.ts`, run by `write_character` and
  `check`: bounding boxes per SVG primitive (paths via a small path parser),
  reporting shapes outside the box, feet off the baseline, a limb that does
  not meet the body, filled shapes without the outline, inconsistent stroke
  widths. Warnings with the location, not errors, except outside-the-box.
  `write_character` adds a **construction sheet** next to the pose sheet:
  silhouette, part boxes and pivots overlaid, so the agent sees what the
  linter saw.
- **Redraw the library** (kid, grownup, dog) in the style as the bar, then
  the example casts (lost-kite by recopying, lighthouse and clever-rabbit by
  hand), so every example is a worked example of the rules.
- Scenes: props and foreground objects follow the same outline rule;
  backgrounds stay soft so characters pop.

**Done 2026-10-21, with two changes from the plan above.** The outline is
drawn by the engine (`src/engine/outline.ts`), not by the artist with
`paint-order`: before each part it draws a copy of the part in the line
colour with every filled shape and every limb stroke widened, so only a rim
shows. Agents forget strokes and mix widths; the engine owning the line is
the same argument as the engine owning motion. The width is fixed on screen
(3.4 px at scale 1) rather than per rig, so a 90 px mouse and a 300 px adult
look drawn with one pen. That made the planned "filled shape without
outline" and "inconsistent stroke width" checks unnecessary. The linter
(`src/project/construction.ts`) rasterises each part and each top-level
shape at one pixel per unit with resvg instead of parsing paths, so caps,
arcs and transforms count exactly as drawn; overlap is measured as the
thickness of the intersection at the joint, against both sides as they are
there. The library scenes were not redrawn: the guide asks for outlined
props, and the scenes come up again in 7.5 with layers.

### 7.2 Quadruped rig and library species

Why: most children's stories are animal stories, and the simple rig cannot
walk.

- **`quadruped` rig**, 260 wide by 200 tall, baseline y=200, facing right:
  `body` (required), `head` (neck pivot), `legFL`/`legFR` (shoulder pivots),
  `legBL`/`legBR` (hip pivots), `tail` (rump pivot), `earL`/`earR` (on the
  head), `eyes`/`mouth` on the head. Draw order: far legs, tail, body, near
  legs, head, ears, face. Pivot table and ASCII box in the guide like the
  humanoid one.
- **Gaits**: walk and trot as diagonal pairs (FL with BR, FR with BL), run as
  a gallop with a gathered and a stretched pose, head bob in counter-phase,
  tail sway. `sit` folds the hind legs and tilts the body back; `point` and
  `wave` lift a front paw; `jump` gathers then stretches.
- **Library species** in the 7.1 style: dog, cat, rabbit, deer, lion, bear,
  fox, mouse. Birds and fish stay on the simple rig (`fly` is already
  right for them); the monkey stays humanoid with a `tail` part.
- The simple rig stays for props, vehicles and anything that bobs.

**Done 2026-10-21.** The rig is as planned except the ears: both sit behind
the head, not in front of it. An ear in front carries its own outline across
the forehead and reads as a sticker; behind, the head's outline closes its
base, which is how pointed ears are drawn anyway (a floppy ear hangs past the
back of the head). Every leg, the tail and the head hang from the body, and
the body turns about the hips, so `sit` is one rotation plus a drop and the
front paws land back on the line. The walk is one diagonal-pair gait (no
separate trot verb); the body drops by exactly what the angled legs lose, so
the feet carrying it stay on the line, and the swinging pair lifts. Feet
still slide along the ground; planting them is 7.3. The rig data now carries
what used to be `if humanoid` branches (expected parts, feet, joints, the
bubble point), so the linter checks a quadruped's legs, tail, neck and ears
the same way; a thin limb sinks three quarters of its width measured at the
joint, not at its fattest point. The library dog moved to the quadruped, so a
small bird was added as the simple rig's worked example. In the examples,
Biscuit and the clever-rabbit lion, deer and rabbit were recopied from the
library with their colours, and the lion's reflection was rebuilt from the
new lion's head; the monkey only bounces, so it stays on the simple rig.

### 7.3 Motion with weight

Why: smoothness is not interpolation, it is contact, anticipation and
follow-through. All of it is engine code; the agent vocabulary does not grow.

- **Feet that plant.** Stride length derives from character height, cycle
  frequency from speed over stride, legs split into stance and swing, the
  body dips on each contact. No sliding feet on either rig.
- **Anticipation and overshoot** on every verb: a jump crouches before it
  launches and squashes on landing, walks ease in and out, a facing flip is
  a short squash-turn instead of an instant mirror, `appear` pops with
  overshoot.
- **Springs**: a deterministic spring-damper per follow-through part (tail,
  ears, hair, antlers, anything the character names in a `springs` list),
  driven by the parent's velocity and integrated at a fixed step from the
  start of the shot, so the same frame always renders the same. This is the
  "physics" the films need: secondary motion, not rigid bodies.
- Bubbles pop in with overshoot and shrink out; captions slide; idle gets
  breathing and the occasional double blink.

**Done 2026-10-22.** The leg cycle is driven by distance, not the clock: each
gait (humanoid walk and run, quadruped walk and gallop) is a duty factor and
a landing offset per leg, and while a foot is down its leg angle is chosen so
sin(angle) falls linearly with travel, which holds the foot exactly still.
The swing comes from the speed (within the gait's range) and the cycle is
then shortened to fit a whole number of half cycles into the move, so every
walk starts and ends with the legs together, where idle has them; that is
what makes "any duration works" true without a speed limit. A rigid leg can
only reach the line with the body lower, so the body takes part of that
drop and the legs give the rest by sliding into the body (the knee); swing
feet are lifted the same way. A body that rocks (the gallop) also nudges its
shoulders sideways, which planted legs cancel. Moves ramp their speed over
0.3 s at each end instead of the easing curve walks used before, so the
legs slow with the body. Jumps are three beats (crouch, flight, landing) and
the actor crosses the ground only in flight. Breathing became a stretch
about the feet, because the old idle bob lifted the feet off the line.

Springs are angular for parts the rig places (pushed by the pivot's
acceleration across a lever aimed at the part's rough centre, read from its
SVG coordinates, plus the parent's own spin) and a small sway for parts it
does not, so `hair` on a humanoid works without a pivot. They integrate at
120 Hz from the start of the shot and are cached per shot object, so a frame
renders the same whether the shots are rendered in order or one frame is
asked for alone; a teleport or a facing flip is a cut, not a push. Not done:
the turn is a horizontal squash, not a drawn three-quarter view; a walk in
depth (mostly y) still slides its feet, since the legs only stride sideways.

### 7.4 Acting

Why: characters placed in a frame are a diorama; characters that look at
each other are a scene.

- Actors in a conversation turn head and eyes toward the speaker without
  being told; `point` and `walk` set the look target; an `emotion` change
  gets a short take (head pop, blink).
- One new optional field, `say.to`, names the listener when the engine's
  guess would be wrong. Nothing else is added to the agent's vocabulary.
- `attach`: parent a simple-rig character to a hand or a mouth so carrying
  a prop is one action instead of the current walk-plus-move workaround.

**Done 2026-10-22.** Looking is a head tilt toward the target's eyes, half
the true angle and capped (10° for people, 8° for animals, 5° of body for the
simple rig): the full angle read as a glare. Attention is worked out from the
shot's lines alone, latest event wins: another actor's line makes the
listener watch them, one's own line looks at `to`, else whoever spoke last,
else the nearest actor in front; walking, jumping and pointing look ahead.
Only targets in front count and nothing turns a body round to look, because
an automatic about-face would fight the author's `facing`. Only characters
with eyes look, so props stay still. `say.to` is the existing `to` field on a
line with no `do`, rather than a new field: a line has no other use for it.
A take is a blink plus a per-emotion head move and stretch over 0.6 s.

`attach` is an action field (`"attach": "pip"`, `false` to let go) rather
than a verb, so a drop and a move can share one action. Each rig names a hold
point drawn in a part (the near hand, the quadruped's mouth), so the prop
follows the arm swing; the prop names its `grip`. Letting go reads the hand
just before, since the carrier's arm relaxes the moment it stops holding.
The lighthouse climb now carries its lantern this way. Not done: the prop
stays upright instead of turning with the hand, and a carrier cannot itself
be carried.

### 7.5 Depth and camera

- Optional scene `layers` (back, mid, front) with parallax factors; the
  existing `svg` and `foreground` map onto mid and front so no scene breaks.
- Camera moves shift layers at different rates; zooms above 1.3 get a soft
  vignette; every actor gets a ground shadow sized by its box.
- Cuts stay cuts; `fadeIn`/`fadeOut` stay; a cross-fade becomes possible
  once layers exist.

**Done 2026-10-22.** The layers are named `far` and `near` rather than back,
mid and front: `foreground` already means "in front of the actors at their
depth" (a fence they stand behind), and a front layer beside it would have
been two words for different things. So a scene is four planes: `far`
(parallax 0.5), `svg` and `foreground` (the stage, 1, where anchors live)
and `near` (1.4). A layer at factor p sees the camera's offset times p and
its zoom raised to p; zoom as a power rather than a blend is what guarantees
a far layer that fills the frame still fills it behind any view of the
stage the camera clamp allows (the tests check the corners). The rule this
puts on authors is the far layer must reach the bottom edge: a zoom shows
far scenery below the stage's horizon, and a far hill that stopped at y=540
left a black band. The library park and street, the example copies of
them and the lighthouse beach are layered; the home interior is not, since a
room has no far. The anchor sheet of a layered scene shows each layer and
two zoomed views, which is where a gap would show.

Shadows are a radial-gradient ellipse as wide as the rig's stance, drawn for
every actor before any actor so a shadow never lies across someone behind.
Lift shrinks and fades it, which is most of what sells a jump. The simple
rig casts none by default (`shadow` overrides it), because it is mostly
birds and kites in mid-air and the engine cannot tell sky from floor;
flying and being carried hide it too. The vignette is a frame-sized radial
gradient whose opacity ramps from zoom 1.3 to 1.9, under bubbles and
captions so text is never darkened.

`crossfade` on a shot dissolves it in over its first seconds while the
previous shot keeps running past its end underneath, so the film's length
and every shot's timing stay as written. It works for any two shots, layers
or not; the lighthouse uses it from the lit tower to the boat coming in. Not
done: a depth walk still slides its feet, and the camera has no shake or
handheld drift.

Four more one-minute films, each written by an agent from the guide alone
(fox and crow, bear and honey, a red umbrella, a hill race), were the check
before audio, and they turned up these fixes:

- A line's `to` was rejected unless the listener's id was also an anchor.
- A sitting animal floated while it trembled, because shiver, nod and shake
  replaced the sit's offsets instead of adding to them.
- A `face` override could not be cleared; `""` now hands the part back to
  the emotion.
- A thought moved the mouth and turned heads like speech.
- `set.at` was lost beside `attach: false`, because the let-go ran after it.
- resvg 2.6 panics on a group with `opacity` that holds another one (a
  translucent cloud) beside a layer wholly off the frame, which is a
  dissolve into a close-up with a `near` layer. So the dissolve fades with
  an alpha filter over the frame instead; the pixels match.
- A quadruped's head looked stuck on: its neck carried its own line across
  the chest. Now the head's outline goes down with the body's (`Rig.fuse`),
  so the neck grows out of the shoulders. A person's chin keeps its line
  against the chest.
- No leg had a knee, so a sitting girl's legs stuck out stiff below the
  seat, and a sitting bear's or a sleeping deer's hind legs poked forward
  like sticks. Every rig now has knee points (`Rig.knees`) and a pose bends
  a leg there (`Pose.bend`). The composer cuts the leg across the knee with
  a disc the width of the leg on each half and turns the lower half, so the
  joint is round with no gap, and draws both outlines before either fill,
  so no line crosses it. Doing it in the engine rather than adding a shin
  part means every leg already drawn as one straight stroke bends, with no
  art to redo. `sit` folds the legs from how high the hips are at each
  moment, so the feet stay on the floor all the way down. A person needs to
  know how far below the seat the floor is: an anchor's `floor` says, else
  it is where the actor stood before sitting onto the seat, and sitting
  where one stands is on the ground, legs out with the knees up a little.
  The bottom of the torso, not the hips, now rests on the seat, so a skirt
  no longer sinks into the bench.
- With knees in place, a leg that has to get shorter bends instead of
  sliding up into the body: the swinging foot lifts by bending, a person's
  planted leg gives a little on contact, and the jump crouches on bent
  knees and tucks them in the air. The foot lands exactly where the slide
  put it, so the planted-foot walk is unchanged underneath. A four-legged
  animal's planted legs still slide (`give: false` on its gaits): on legs
  that short, a give of a few units becomes a deep bend and the walk looks
  rubbery.
- `lie` was missing, so a sleeping deer slept sitting up. It is layered on
  sitting: a person sits on the ground, then the torso turns back about
  the hips until the back is on the floor, with the head tipped forward as
  on a pillow and the legs out; an animal brings its body level onto its
  belly, folds all four legs and lowers its head on its neck (tipping it
  instead put the face on the floor). Getting up runs it backwards. The
  bubble point is carried through the posture (sitting, lying), not
  through passing moves like a nod, so a "Zzz" comes from the head where
  it lies without the bubble bobbing; a lying person's shadow stretches
  along them.
- `sit` and `stand` ignored `duration`, so a shot could not open with
  someone already sat: the agents wrote `duration: 0.05` and got a 0.4 s
  sit-down. `sit`, `lie` and `stand` now take it, shared between sitting
  and lying back the way the defaults are.
- People stared out of the screen whatever way they went: the faces were
  drawn front-on on a body that walks side-on, so a girl walking right
  looked at the viewer. Now the engine turns the face (`Rig.turn`,
  `Pose.yaw`): the eyes, the mouth and a new `face` part (nose, cheeks)
  slide toward the way the character faces and narrow, which on a round
  head reads as three-quarters. Doing it in the engine rather than asking
  for three-quarter faces means every character already drawn front-on
  turns, and a turn can bring the face round through front-on: the body
  now narrows only to 0.72 through the mirror, where it used to squash to
  a sliver, so a turning person looks like they are turning round. The
  library people (and the example casts copied from them) lost the near
  ear and the near bow, which the face would cover, and moved the collar
  and buckle toward the front.
- Arms swung from the shoulder as straight sticks, so a runner flailed.
  `Rig.knees` became `Rig.bends`, with elbows on the humanoid: an arm hangs
  almost straight, bends as it swings forward in a walk, is held bent and
  pumped to run (easing in and out with the stride), waves from the elbow,
  and rests its hand on the knee when sitting. A carried prop stays in the
  hand, since the hold point goes through the bend.
- The turned face sat on a body still drawn front-on, and a person walking
  into the screen kept looking at the viewer. The body now turns with the
  face (`Rig.turn` `body`, `limbs`): the torso is drawn narrower and the
  far shoulder and hip step in behind it, and a walker turns further toward
  side-on than someone standing. The limbs step in only as far as
  three-quarters, since a hip moving under a planted foot drags the foot.
  A move mostly up the screen turns the actor away (`ActorState.view`): the
  face parts are hidden and parts with a `back` variant draw it, so the
  library people have the back of the head and a torso without its collar;
  a move mostly down the screen turns the face to the viewer. Limbs
  swinging toward or away from the viewer are foreshortened: each points
  where its end would be with the sideways swing squeezed and is shortened
  to reach just there, which keeps its width, unlike squeezing the whole
  limb. A bent leg comes out a little short that way, so the body is
  lowered by as much as the lowest foot rose. Backs are variants rather than
  a new part list, so a character without one still works.

### 7.6 Weather and moving nature

**Done 2026-10-23.** The red-umbrella film's rain was streaks drawn into the
scene's `near` layer, so it hung in the air and only slid when the camera
moved. The agent had no other way to make rain, nor a fire that flickers,
the sea, or a waterfall: a scene was a still picture. Now the engine draws
what moves by itself, every frame, from time and `hash01`, so any frame
still renders on its own and the film stays deterministic.

- Scene `weather` is the sky and the air: `rain` and `snow` at three depths
  (a haze behind the stage, drops behind the actors, a few large ones in
  front of them), each depth moving with the camera like a layer at that
  parallax and wrapping round the frame so it is always evenly full; rain
  splashes on the floor; `wind`, which slants and carries everything and
  from 0.3 up draws wavy gusts; tumbling `leaves`; drifting `clouds`, whose
  `dark` makes storm clouds and dims the frame; `lightning`; and `heat`
  haze. A shot's own `weather` replaces the scene's, and a `lightning`
  action strikes at a story beat, since a storm's timing is the story's.
- Scene `effects` are placed things that move: `fire` (logs, nested
  flickering flames, glow, sparks), `smoke`, `waterfall`, `waves` (rows of
  crests, a swell rolling in, foam washing up the shore) and `sun`. Each is
  drawn in its plane (`far`, `stage` behind the actors, `front`, `near`).
- The flash brightens the frame through a filter (gain and lift on every
  channel) instead of laying white over it, which read as fog: the scene
  keeps its contrast and looks lit by the bolt.
- Heat haze displaces the far layer with a noise that scrolls up. resvg's
  noise is fixed to the filtered group's coordinates, so the layer is drawn
  in a group shifted down by the scroll inside one shifted back up, and the
  plain layer goes underneath so the edges the shimmer pulls in are not
  black.
- Rain gets a faint dark edge under each streak, or it vanishes against a
  pale wall; and a close-up scene drawn large sets `weather.scale`, since
  the engine cannot tell a close-up from a wide shot.
- The anchor sheet adds a row of the empty scene at a few moments, one of
  them just as a strike lights up, so an agent writing a scene sees it move.

Clouds, bolts and haze live in the far layer, so they need a layered scene;
the validator says so.

Then the three gaps left after the first pass:

- Rain fell through the red umbrella and the bench. Shelters are spans that
  stop rain and snow: a scene's `shelters` for what is drawn into it (a bench
  seat, a roof), a character's `shelter` in its own box for what moves (an
  umbrella's canopy), limited by `when` to a variant, so a closed umbrella
  shelters nothing, or a list for one span per variant. A drop whose slanted
  path crosses a span stops on it; one wholly under it is not drawn; no
  splash lands below it; drops gather on both ends and fall to the floor.
  Spans rather than shapes, because a drop only needs to know where it is
  stopped, and a span is something an agent can read off its own drawing.
  A frame knows only where an umbrella is now, so at first a falling drip
  kept up with a walking umbrella, sliding sideways in the air. Each shelter
  now has a key (scene shelters by index, a character's by actor and span),
  and a falling drop asks where its shelter's edge was at the moment it let
  go, by resolving the shot at that earlier time; a shelter that was not
  there then (an umbrella just opened) has no drop falling yet. Only carried
  shelters are looked up, two per span per frame, which costs nothing
  measurable in a render.
- Weather could not change within a shot. A `weather` action turns the
  weather in force into another over its duration, blending every amount
  (absent rain is rain at 0), so rain thins out drop by drop. Clouds had to
  stop depending on how many there were: they sat at count-dependent places,
  so a clearing sky reshuffled them. They now sit in ten fixed slots shown in
  an order that keeps any number spread out, and the last one in or out
  fades.
- Nothing was lit by a fire, and nothing could be, since characters are
  drawn in daylight colours and stayed bright in a night scene. `weather.light`
  tints the characters through a filter that scales each colour channel (the
  scene is drawn in its own colours, so it is left alone), and a fire adds
  warmth to the actors it reaches, falling off with distance and flickering
  with the flames, plus a warm pool blended as light (screen) over the scene
  and the actors around it. The fire counts for more the darker the light.

### 7.7 Light and form

Vivek asked (2026-10-23) for better-looking characters, suggesting
downloaded SVGs. Dropped-in art does not suit the engine: a downloaded cat
is one picture, while the rig turns separate parts about their joints; art
from several sources would not share one style, and art that brings its own
outline gets a second one from the engine. What makes the library look like
stickers is that every part is one flat colour. So the engine draws the
light, the way it draws the outline (7.1), and the library is redrawn in
one style with real shapes, using downloaded art as reference only.

- Every part is shaded on the side away from the light (`shade.ts`). The
  part's silhouette (the outline underlay with no widening) is drawn over
  the part in a cool dark at about 20%, masked by the same silhouette
  nudged toward the light, so only the far side shows: a crescent on a
  round head, a strip down a leg. Hard-edged, as cel shading is, and cheap
  enough for resvg: one mask per part, with no blur. The nudge is turned
  into each part's frame and mirrored with the actor, so a raised arm keeps
  its shade on the side away from the light and a character facing left is
  lit from the same side as one facing right. A part fused into its parent
  (a quadruped's head) adds the parent's silhouette to its mask, or a
  shaded edge would run across the neck where it meets the shoulders.
  The face parts (eyes, mouth) and line work are not shaded.
- Firelight was a uniform warm tint on the whole actor. A fire now also
  swings the light toward itself the more it outshines the scene, so the
  shadow falls on the far side, and puts a warm rim on the near side
  (the silhouette minus a copy nudged away from the fire). The uniform
  warmth is halved, since the rim does most of the work.
- The sky stayed grey when the rain cleared, because the guide told agents
  to paint the mood into the far layer and nothing could change it. Now
  clouds grade the far layer through a filter in screen space: saturation
  falls as they cover the sky (from amount 0.3, gone at 0.9) and storm
  clouds take some brightness, so a sky painted blue is overcast under
  them and blue again when a `weather` turn clears them. The whole far
  layer is graded, hills too, which is how an overcast day looks; the
  stage is left as painted, since wet ground stays wet.
- A walk from sitting or lying stood up and set off in the same moment, so
  the actor slid along the floor as it rose; the guide asked for a `stand`
  first, and agents forgot. A move now gets up first, sitting up and then
  standing on the spot, and starts once it is up: the move keeps its own
  duration and ends later by the time the getting up took.
- The camera could only be sent to fixed points, so a walk across a scene
  was either a wide shot or a pan the author timed by hand, and agents
  timed it wrong. `camera.follow` names a cast member: the camera aims at
  them, ahead by a share of the frame the way they face, and trails through
  a weighted mean of where they were over the last 0.9 s, newer places
  weighing more. A mean of past states rather than a spring keeps every
  frame computable on its own (nine actor lookups, nothing integrated), and
  it eases out of a start and settles after a stop. Each sample is clamped
  into the scene before the mean, or the camera would run into the scene's
  edge and stop dead. Setting a point, or `follow: ""`, lets go.
- The library was redrawn in one pass, the cat first as the pattern and
  the other ten by agents working from it, each checked on its pose and
  construction sheets. Bodies became shaped beans with a dipped back and a
  deep chest, near hind legs got a haunch, tails and stripes taper (filled
  paths along a curve), and faces got muzzles, noses, eyebrows in every eye
  variant, hair with real shape, collars, sleeves, hands and shoes. Part
  names, variants and colour tokens are unchanged, so projects that copied
  a character keep working and only new copies change. Two rules came out
  of it, now in the guide: a leg below the knee runs down the knee's x, and
  a haunch ends above the knee, or the bend shows a notch. A small dark
  spike still showed beside a sharply bent knee or elbow on every
  character. It came from the bend: each half of a bent limb keeps a disc
  round the joint so the turn opens no gap, and the upper half's disc
  reached down into the top of the paw's outline, which it drew unturned.
  Now a piece wholly below the joint stays out of the upper half and one
  wholly above it out of the lower (measured from its coordinates; a piece
  that cannot be measured, a group or a relative path, stays in both, as
  before). Each half is also shaded as it lies, the lower one turned by the
  bend, where before it carried the upper half's shading round with it.
- The examples' library-based characters (all eight were the old library
  drawings with only their colours changed) were recast onto the new
  drawings with their own colours. Where a new drawing adds a shade of a
  base colour (`hairLight` of `hair`), the example's shade is derived from
  its own base the way the library's is from the library's, so a grey-haired
  grandma does not get brown highlights. The lighthouse's from-scratch gull
  and lantern, the kite, the monkey and the lion's reflection are left as
  they were: they are the record of what an agent draws on its own.
- Hindi. Stories told in Hindi need their bubbles in Devanagari, and resvg
  sets it wrong: it misplaces vowel signs (a matra lands on the next
  letter) and drops spaces, with the system fonts and with Noto, Hind and
  Baloo alike, and its newest build does the same. HarfBuzz (WASM,
  `harfbuzzjs`) shapes it correctly, so a Devanagari line is shaped there
  in the bundled Baloo 2 and drawn as glyph outlines (`glyphs.ts`); its
  width comes from the same shaping, so wrapping and bubble sizes fit. Only
  lines in that script take this path: Latin text stays `<text>` in the
  project's font, so existing films render exactly as before. Bundling one
  font for everything was the alternative; it would change every film's
  look for a problem only Hindi has.
- Cast shadows (`cast.ts`). Vivek asked for real shadows wherever there is
  a light: the sun, the moon, a bulb. Each light throws every grounded
  actor's own silhouette across the floor: the actor drawn again unshaded,
  flattened by an affine map that keeps the floor line and moves each point
  by its height, painted one cool dark through a filter, blurred a little
  and faded toward its far end with a gradient mask. The silhouette rather
  than a stretched ellipse, because a raised arm, a dog's tail and a sitter
  on a cot should all show in it, and the same map serves every rig. A sky
  light (a `sun` effect, or `lights` for a sun or moon painted in) is far
  away and in the picture, so behind the stage: shadows fall forward and
  away from its side, longer the lower it hangs; that the per-actor
  direction then fans out from under the sun is how such shadows look in
  perspective. A lamp (or a fire) stands on the stage, so shadows run along
  the floor away from it and fade with distance, faint by day and strong at
  night. A scene with a sun now shades its characters from the sun too, so
  the dark side and the shadow agree. Painted lights are declared, not
  found in the art: guessing a sun from the SVG is not reliable, and a
  scene with no lights renders exactly as before. Scenery painted into the
  art casts nothing; its shadows stay the painter's.
- Picking up and putting down. The sticks film had the brothers' bundles
  arrive in their hands from nowhere, then vanish at the next cut. Both
  were the directing agent's staging mistakes, but for the first it had no
  better choice: `attach` could only snap a prop to a hand. `pickup` and
  `putdown`, given on the prop with `attach`, make the carrier stoop
  (knees bent, back over, near arm down to the floor in front; a
  four-legged animal puts its head down) and take or leave the prop at the
  bottom; the prop eases from where it lay into the hand, so nothing jumps.
  Any attach during a shot now eases the same way, which makes a hand-to-
  hand pass travel instead of teleport; one from further off than the
  carrier's height still snaps, as that reads as a cut. The validator now
  says where to stand when the hand would come down too far from the prop,
  and warns when someone ends a shot carrying something and starts the next
  without it, which is the mistake that made the sticks vanish.

### 7.8 Audio (last, on purpose)

- Narration and dialogue through TTS, with `say` duration taken from the
  audio and mouth flaps driven by amplitude instead of a sine wave.
- A music bed per project, a handful of effects tied to verbs (jump, splash,
  appear).
- Only after 7.1 to 7.6, because sound makes a silent film feel finished and
  would hide what still looks wrong.

## Render speed

Measured 2026-10-23 on a 12-core M-series Mac, on the race film (273 s, scenery
painted by an agent at 100 to 200 KB of SVG) and lost-kite (61 s, English
bubbles):

- Most of a frame went on fonts, not drawing. resvg reads every system font
  whenever it is handed SVG with fonts on, about 75 ms a frame against 15 to
  35 ms of drawing, and it was on for every frame. Now each `<text>` element
  is laid out once by resvg itself (`Resvg.toString()` gives back the paths
  it would draw) and frames carry those paths and render with no fonts.
  Films with no Latin text come out byte-identical; on a Latin text frame
  a few edge pixels move by a step or two of 255 (coordinate rounding),
  which nobody can see. Text that takes its look from around it, or sits
  under a `<style>`, is left as text and still loads the fonts.
- Frames were composed one at a time on the main thread and rasterised four
  at a time on libuv's pool. Now a pool of worker threads (all cores but two,
  up to 8; the encoder needs the rest) each composes and rasterises whole
  frames, and the main thread only puts them in order for ffmpeg.
- Frames go to ffmpeg as raw RGBA rather than PNG: no packing on our side,
  no unpacking on ffmpeg's. Every frame is opaque, so the encoder sees the
  same pixels either way.
- resvg's frames live outside the JS heap behind small wrappers, so V8 saw
  little memory in use, seldom collected, and a worker kept every frame it
  drew (6 GB in a few minutes of film). Each worker now draws one frame per
  turn and runs a young-generation collection after it, which holds a
  render to under 1 GB.

Result: the race film went from 262 s to 39 s wall (byte-identical mp4), and
lost-kite from 41 s to 10 s with half the CPU time. What is left is drawing
itself: on the race film about 27 of 38 ms a frame is the scenery, which does
not change in most shots, so drawing it once per shot and laying the actors
over it is the next step if long films need to be faster. On lost-kite the
scenery is 5 of 16 ms, so there the actors dominate and caching would gain
little.

## Later (deliberately not now)

- A run with a non-Claude agent, and more MCP ergonomics: cheap, and best
  done once phase 7 has changed what the tools return.
- More emotions and eyebrows; image-model generated backgrounds as a layer.
- Bundled font for identical output across machines (currently system fonts
  for Latin text; Devanagari is bundled, see 7.7).
