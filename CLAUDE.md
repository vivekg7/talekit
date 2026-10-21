# CLAUDE.md — talekit

talekit renders short 2D story animations from JSON an AI agent writes. The
agent-facing contract is `docs/authoring-guide.md`; the roadmap and design
reasoning are in `docs/PLAN.md`. Read both before changing the data model.

## Layout

- `src/engine/` — pure functions, no I/O. `types.ts` (zod schemas = the file
  format), `rigs.ts` (canonical boxes and pivots), `motion.ts` (verb → pose),
  `gait.ts` (planted-foot walk and run), `springs.ts` (follow-through,
  integrated per shot), `timeline.ts` (actions → actor state at time t), `actor.ts` + `compose.ts`
  (state → SVG), `outline.ts` (the engine-drawn outline under every part),
  `bubble.ts` (text wrap and bubble geometry).
- `src/project/` — load/save/validate a project directory; `construction.ts`
  is the character linter (rasterises parts, checks box, feet, joints);
  `notes.ts` is the review-note store shared by the viewer and the MCP.
- `src/render/` — resvg rasteriser, ffmpeg encoder, preview sheets.
- `src/library/` — built-in characters and scenes (TypeScript modules holding
  SVG). They are the quality bar and the templates agents copy.
- `src/mcp/server.ts`, `src/cli.ts`, `src/viewer/` — thin interfaces over
  the same code. The viewer is one embedded page (`page.ts`, no framework, no
  build) plus a small HTTP server (`server.ts`).
- `examples/lost-kite/` — one-minute story used as the integration check.
  `examples/lighthouse/` — written through the MCP tools as the phase 6 run;
  it exercises from-scratch characters, custom variants and the carry trick.
  `examples/clever-rabbit/` — made by a subagent given only the story and
  the tool; an all-animal cast, kept as the cold-run fixture. Its well
  sequence was restaged by hand as the worked example of a point-of-view
  insert (shots 07 to 09), and its lion, deer and rabbit were moved to the
  quadruped rig; the monkey and the lion's reflection stay on the simple rig.

## Rules

- **The engine owns motion.** Do not add agent-facing knobs for limb angles
  or per-frame control; add a verb or a parameter to an existing verb.
- **Schema changes are format changes.** Anything touched in `types.ts` must
  be reflected in `docs/authoring-guide.md` and in the MCP tool descriptions
  in the same commit, and the example must still pass `talekit check`.
- **Every write returns a picture.** A new MCP write tool returns an image of
  the result; a new engine feature shows up on the relevant sheet.
- **Keep rendering deterministic.** No randomness; use `hash01(id)` for
  per-actor variation.
- Inner SVG only in parts and scenes (no `<svg>`, `<image>`, external refs).
  Single-quoted attributes keep JSON readable.

## Verify before committing

```bash
npm run typecheck && npm test && npm run format:check
npx tsx src/cli.ts check examples/lost-kite
npx tsx src/cli.ts contact examples/lost-kite flying   # look at the png
```

Changes to motion or art are visual: render the pose sheet
(`talekit sheet examples/demo kid`) or a contact sheet and look at it; do not
claim an animation change works from the code alone.
