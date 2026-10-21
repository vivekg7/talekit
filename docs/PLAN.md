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

### 7.5 Depth and camera

- Optional scene `layers` (back, mid, front) with parallax factors; the
  existing `svg` and `foreground` map onto mid and front so no scene breaks.
- Camera moves shift layers at different rates; zooms above 1.3 get a soft
  vignette; every actor gets a ground shadow sized by its box.
- Cuts stay cuts; `fadeIn`/`fadeOut` stay; a cross-fade becomes possible
  once layers exist.

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
