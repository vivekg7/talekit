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
   raster.ts     SVG -> PNG via @resvg/resvg-js (no browser needed)
   video.ts      PNG stream -> mp4 via system ffmpeg
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

### 7.6 Audio (last, on purpose)

- Narration and dialogue through TTS, with `say` duration taken from the
  audio and mouth flaps driven by amplitude instead of a sine wave.
- A music bed per project, a handful of effects tied to verbs (jump, splash,
  appear).
- Only after 7.1 to 7.5, because sound makes a silent film feel finished and
  would hide what still looks wrong.

## Later (deliberately not now)

- A run with a non-Claude agent, and more MCP ergonomics: cheap, and best
  done once phase 7 has changed what the tools return.
- More emotions and eyebrows; image-model generated backgrounds as a layer.
- Parallel rasterisation across worker threads for long films.
- Bundled font for identical output across machines (currently system fonts).
