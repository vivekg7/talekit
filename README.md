# talekit

Story video generation for AI agents. Give your agent a children's story, point
it at the talekit MCP server, and it designs the characters and scenes, writes
a shot-by-shot timeline, checks its own work from rendered previews, and
produces an mp4 of simple 2D animation with comic-style speech bubbles.

The idea is "Paper for video": the agent writes a language it is already
fluent in (SVG fragments + JSON), the engine owns everything that is hard to
get right by hand (rigging, walk cycles with planted feet, follow-through,
blinking, mouth flaps, bubble layout, camera moves, encoding), and every write returns a picture so the agent can
see and fix its output.

```
story ──agent──▶ characters/*.json  scenes/*.json  shots/*.json ──talekit──▶ movie.mp4
                 (rigged SVG puppets) (SVG + anchors)  (timeline)
```

## Requirements

- Node 20+
- `ffmpeg` on the PATH (`brew install ffmpeg`) — only for `render`
- No browser needed: frames are rasterised with resvg.

## Quick start

```bash
npm install
npm run build

# render the bundled one-minute example
node dist/cli.js render examples/lost-kite          # → examples/lost-kite/out/movie.mp4
node dist/cli.js serve  examples/lost-kite          # review app at http://127.0.0.1:4848
```

Register the MCP server with Claude Code (or any MCP client):

```bash
claude mcp add talekit -- node /absolute/path/to/talekit/dist/cli.js mcp
```

Then, in a Claude Code session:

> Use talekit to turn this story into a video: _(paste story)_. Make a project
> in ~/stories/the-lost-kite.

The agent's first call should be `get_guide`; it returns
[docs/authoring-guide.md](docs/authoring-guide.md), which is the full contract
for characters, scenes and shots.

## Reviewing what the agent made

`talekit serve <project>` opens the review app: the film with a scrubber and
a strip of every shot (live frames, or the rendered mp4 once it exists), the
characters as pose sheets, the scenes as anchor sheets. Pick a moment or an
asset, type what is wrong, and it is saved as a note in `<project>/notes.json`.
Then tell the agent "fix my notes": `list_notes` hands it each open note with a
picture of exactly what you were looking at, and `resolve_note` closes it. The
page follows the project directory, so the agent's edits appear as it works.

## What the agent writes

- **Character** — a rigged puppet: SVG fragments per part (`head`, `torso`,
  `armL`…) drawn into a fixed 200×400 box with known pivots, plus variant maps
  for `mouth` and `eyes`. Colour tokens (`{skin}`) make recolouring trivial.
  Rigs: `humanoid` (people), `quadruped` (four-legged animals: walks in
  diagonal pairs, gallops, sits) and `simple` (birds, props, anything that
  bobs).
- **Scene** — a background SVG with named floor **anchors** (`door`, `bench`),
  an optional foreground layer, optional `far` and `near` layers that move at
  their own rates when the camera does, a ground line for the built-in
  stage shortcuts `left/center/right/offLeft/offRight`, and `lights` (a sun,
  moon or lamp painted in) that every character casts a shadow from.
- **Shot** — one scene, a cast with starting positions, and a list of timed
  actions: `walk`, `run`, `fly`, `jump`, `wave`, `point`, `nod`, `shake`,
  `sit`, `bounce`, `spin`, `appear`, `disappear`, `pickup` / `putdown`
  (stoop to take or leave a prop on the floor), `say` (speech / thought /
  shout bubble, drives the mouth; listeners look at the speaker on their
  own), `emotion`, `attach` (carry a prop), `caption` (narration or title
  card), `camera` (zoom and pan), `set`. A shot can `crossfade` in from the
  one before instead of cutting.

A project is a plain directory:

```
my-story/
  talekit.json        title, size, fps
  characters/*.json
  scenes/*.json
  shots/NN-*.json     play in filename order
  out/                renders and previews (git-ignored)
```

## MCP tools

| tool                       | returns                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `get_guide`                | the authoring guide (read first)                                        |
| `create_project`           | a new project directory                                                 |
| `project_info`             | characters, scenes, shots, validation problems, open review notes       |
| `list_library`             | built-in characters (kid, grownup, eight animals, a bird) and scenes    |
| `get_library_item`         | the JSON of a built-in, to learn a rig's layout before drawing          |
| `copy_from_library`        | copies a built-in under a new id / name / colours, returns its sheet    |
| `write_character`          | validates, saves, returns a **pose sheet** and a **construction sheet** |
| `write_scene`              | validates, saves, returns the scene with **anchors marked**             |
| `write_shot`               | validates cross references, saves, returns a **contact sheet**          |
| `get_item` / `delete_item` | read back or remove one file                                            |
| `preview_frame`            | one frame at a time `t`, optional debug markers                         |
| `preview_shot`             | contact sheet of a shot                                                 |
| `render`                   | mp4 of one shot or the whole film, plus a **film sheet** (frame/shot)   |
| `list_notes`               | review notes left in the app, each with the frame or sheet it points at |
| `resolve_note`             | marks a note done once the fix is in                                    |

## CLI

```
talekit init <dir> --title "…"       talekit sheet <dir> <id>
talekit check <dir>                  talekit frame <dir> <shot> -t 2.5 [--debug] [--svg]
talekit library                      talekit contact <dir> <shot> -n 6
talekit copy <dir> <libraryId>       talekit render <dir> [shot]
talekit serve <dir>                  talekit mcp
```

## How it works

- `src/engine` is pure: `composeFrame(project, shot, t)` returns an SVG
  string. Timeline resolution (`timeline.ts`) turns actions into per-actor
  state; `motion.ts` turns state into part rotations and face variants,
  with `gait.ts` fitting the leg cycle to the distance covered so feet do
  not slide and `springs.ts` swinging tails and ears behind the motion;
  `actor.ts` and `compose.ts` emit SVG; `bubble.ts` wraps and places text.
- `src/render` rasterises with `@resvg/resvg-js` on a pool of worker
  threads and streams raw frames into `ffmpeg` (libx264, yuv420p). A minute
  of 720p renders in about ten seconds on an M-series Mac.
- `src/render/sheets.ts` builds the preview images the MCP returns.
- `src/engine/outline.ts` draws the house outline under every part;
  `src/project/construction.ts` is the construction linter behind
  `write_character` and `check`.
- `src/viewer` is the review app: one embedded page over the same engine,
  polling the project directory so it never needs a watcher or a build step.
- `src/library` holds the hand-drawn built-ins; they set the quality bar and
  are the templates the agent copies.

Latin text uses system fonts (default stack starts with Chalkboard SE on
macOS), so output can differ slightly between machines. Hindi (Devanagari) is
shaped with HarfBuzz in the bundled Baloo 2 (`fonts/`, SIL Open Font
License), because the rasteriser misplaces its vowel signs. See [docs/PLAN.md](docs/PLAN.md)
for the roadmap and the reasoning behind the design.

## Development

```bash
npm run typecheck
npm test
npm run format
```
