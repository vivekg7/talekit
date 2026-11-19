# CLAUDE.md — talekit

**Goal:** good-quality 2D films, reels and animations, made by AI agents with
this engine. Agents write JSON (or Python kit scripts) and the engine renders
it. `docs/authoring-guide.md` is the agent-facing contract. `docs/PLAN.md` holds
the design reasons: read the relevant part before you change the data model.

## Layout

- `src/engine/` — pure functions, no I/O.
  - Format: `types.ts` (zod schemas = the file format).
  - Motion: `timeline.ts` (actions → actor state at t), `motion.ts` (verb →
    pose), `gait.ts` (walk/run), `springs.ts` (follow-through, wind), `rigs.ts`
    (boxes, pivots), `stage.ts` (staging the engine adds by itself, listed
    by `talekit explain`), `route.ts` (walks round solids).
  - World: `world.ts` (the rules each shot is checked against; its findings
    block the render unless waived via `allow.ts`), `area.ts` (walk/water
    polygons).
  - Drawing: `actor.ts` + `compose.ts` (state → SVG), `shade.ts`, `outline.ts`,
    `cast.ts` (shadows), `depth.ts` (perspective, haze), `cull.ts` (drops
    shapes resvg would panic on).
  - Nature: `weather.ts`, `effects.ts`, `sway.ts`, `impact.ts` (dust,
    splashes, footprints).
  - Text and sound: `bubble.ts`, `place.ts` (bubble placement), `glyphs.ts`
    (Devanagari via HarfBuzz), `format.ts` (film vs reel frame), `sound.ts`
    (cue sheet), `subtitles.ts`, `speech.ts` (does a take say its line).
- `src/project/` — load/save/validate a project (`store.ts`, `validate.ts`),
  the character linter (`construction.ts`), visibility checks (`sight.ts`),
  guide sections (`guide.ts`), review notes (`notes.ts`), options
  (`options.ts`), voicing and hearing (`voices.ts`, `hear.ts`), and the post
  text lint (`posts.ts`).
- `src/render/` — resvg rasteriser, ffmpeg encoder on worker threads, the sound
  mixer, the .mkv, preview sheets, the critic (`critic.ts`).
- `src/library/` — built-in characters, scenes and sounds: the quality bar and
  the templates agents copy.
- `kit/` — the Python kit that story scripts import, plus the starting
  templates. A helper's docstring is its documentation (`kit/talekit/api.py`
  prints them). `test/kit.test.ts` runs the kit through `talekit check`.
- `src/mcp/server.ts`, `src/cli.ts`, `src/viewer/` — thin interfaces over the
  same code. The viewer is one HTTP server with two framework-free pages
  (`page.ts`, `board-page.ts`).
- `examples/` — `demo` (pose sheets), `lost-kite` (the integration check),
  `lighthouse` (MCP-written: custom characters, `attach`, `far`, `crossfade`),
  `clever-rabbit` (cold-run fixture, all-animal cast).

## Rules

- **The engine owns motion.** Add no agent-facing knobs for limb angles or
  per-frame control: add a verb, or a parameter to an existing verb.
- **Schema changes are format changes.** A change to `types.ts` updates the
  authoring guide and the MCP tool descriptions in the same commit, and the
  examples must still pass `talekit check`.
- **Every write returns a picture.** A new MCP write tool returns an image; a
  new engine feature shows on the relevant sheet.
- **Rendering stays deterministic.** No randomness: use `hash01(id)` for
  per-actor variation.
- Parts and scenes hold inner SVG only (no `<svg>`, `<image>` or external refs).
  Use single-quoted attributes so the JSON stays readable.
- Comments explain only what the code can't: the reason, an invariant, a
  gotcha. No comments that restate the code.

## Verify before committing

```bash
npm run typecheck && npm test && npm run format:check
npx tsx src/cli.ts check examples/lost-kite
npx tsx src/cli.ts contact examples/lost-kite flying   # look at the png
```

Motion and art changes are visual. Render a pose sheet
(`talekit sheet examples/demo kid`) or a contact sheet and look at it before
claiming a change works.
