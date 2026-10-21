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
      to the tallest character, and the scale tween documented. Next: a run
      with a non-Claude agent, and a story that needs humanoid interaction.

## Later (deliberately not now)

- Audio: narration via TTS, music bed, lip-sync from phonemes.
- Quadruped rig, more emotions, eyebrows, hands with props (an `attach` that
  parents a simple-rig character to a hand, so carrying is one action).
- Image-model generated backgrounds as a scene layer.
- Parallel rasterisation across worker threads for long films.
- Bundled font for identical output across machines (currently system fonts).
