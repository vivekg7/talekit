# talekit

Story video generation for AI agents. Give your agent a children's story, point
it at the talekit MCP server, and it designs the characters and scenes, writes
a shot-by-shot timeline, checks its own work from rendered previews, and
produces an mp4 of simple 2D animation with comic-style speech bubbles.

The idea is "Paper for video": the agent writes a language it is already
fluent in (SVG fragments + JSON), the engine owns everything that is hard to
get right by hand (rigging, walk cycles, blinking, mouth flaps, bubble layout,
camera moves, encoding), and every write returns a picture so the agent can
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
node dist/cli.js serve  examples/lost-kite          # live scrubber at http://127.0.0.1:4848
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

## What the agent writes

- **Character** — a rigged puppet: SVG fragments per part (`head`, `torso`,
  `armL`…) drawn into a fixed 200×400 box with known pivots, plus variant maps
  for `mouth` and `eyes`. Colour tokens (`{skin}`) make recolouring trivial.
  Rigs: `humanoid` and `simple` (animals, props).
- **Scene** — a background SVG with named floor **anchors** (`door`, `bench`),
  an optional foreground layer, and a ground line for the built-in stage
  shortcuts `left/center/right/offLeft/offRight`.
- **Shot** — one scene, a cast with starting positions, and a list of timed
  actions: `walk`, `run`, `fly`, `jump`, `wave`, `point`, `nod`, `shake`,
  `sit`, `bounce`, `spin`, `appear`, `disappear`, `say` (speech / thought /
  shout bubble, drives the mouth), `emotion`, `caption` (narration or title
  card), `camera` (zoom and pan), `set`.

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
| `project_info`             | characters, scenes, shots and validation problems                       |
| `list_library`             | built-in characters (kid, grownup, dog) and scenes (park, home, street) |
| `copy_from_library`        | copies a built-in under a new id / name / colours, returns its sheet    |
| `write_character`          | validates, saves, returns a **pose sheet** (every pose and expression)  |
| `write_scene`              | validates, saves, returns the scene with **anchors marked**             |
| `write_shot`               | validates cross references, saves, returns a **contact sheet**          |
| `get_item` / `delete_item` | read back or remove one file                                            |
| `preview_frame`            | one frame at a time `t`, optional debug markers                         |
| `preview_shot`             | contact sheet of a shot                                                 |
| `render`                   | mp4 of one shot or the whole film                                       |

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
  state; `motion.ts` turns state into part rotations and face variants;
  `actor.ts` and `compose.ts` emit SVG; `bubble.ts` wraps and places text.
- `src/render` rasterises with `@resvg/resvg-js` and streams PNGs into
  `ffmpeg` (libx264, yuv420p). A minute of 720p renders in about half a
  minute on an M-series Mac.
- `src/render/sheets.ts` builds the preview images the MCP returns.
- `src/library` holds the hand-drawn built-ins; they set the quality bar and
  are the templates the agent copies.

Text uses system fonts (default stack starts with Chalkboard SE on macOS), so
output can differ slightly between machines. See [docs/PLAN.md](docs/PLAN.md)
for the roadmap and the reasoning behind the design.

## Development

```bash
npm run typecheck
npm test
npm run format
```
