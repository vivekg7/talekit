# talekit

Story video generation for AI agents. Give your agent a children's story, point
it at the talekit MCP server, and it designs the characters and scenes, writes
a shot-by-shot timeline, checks its own work from rendered previews, and
produces an mp4 of simple 2D animation with comic-style speech bubbles and
spoken lines.

The idea is "Paper for video": the agent writes a language it is already
fluent in (SVG fragments + JSON), the engine owns everything that is hard to
get right by hand (rigging, walks with planted feet, follow-through, faces,
bubble layout, camera, weather, sound, encoding), and every write returns a
picture so the agent can see and fix its output.

```
story ──agent──▶ characters/*.json  scenes/*.json  shots/*.json ──talekit──▶ movie.mp4
                 (rigged SVG puppets) (SVG + anchors)  (timeline)
```

## Requirements

- Node 20+ and `ffmpeg` on the PATH (`brew install ffmpeg`). No browser:
  frames are rasterised with resvg.
- For voices: [uv](https://docs.astral.sh/uv/), an Apple Silicon Mac (the
  model runs on MLX) and `brew install espeak-ng` for Hindi. The first voiced
  line sets up `tools/tts/` (about 1.2 GB) and downloads the models (about
  3.2 GB). Without them everything works and lines are silent.

## Quick start

```bash
npm install
npm run build
node dist/cli.js render examples/lost-kite   # → examples/lost-kite/out/movie.mp4 and .mkv
node dist/cli.js serve  examples/lost-kite   # review app at http://127.0.0.1:4848
claude mcp add talekit -- node /absolute/path/to/talekit/dist/cli.js mcp
```

Then, in a Claude Code session:

> Use talekit to turn this story into a video: _(paste story)_. Make a project
> in ~/stories/the-lost-kite.

The agent's first call should be `get_guide`, which returns
[docs/authoring-guide.md](docs/authoring-guide.md): the full contract for
characters, scenes and shots.

## Reviewing and output

`talekit serve <project>` opens the review app: the film with a scrubber and
a strip of shots, the characters as pose sheets, the scenes as anchor sheets.
Pick a moment or an asset and type what is wrong; it is saved to
`<project>/notes.json`. Tell the agent "fix my notes": `list_notes` hands it
each note with a picture of what you saw, and `resolve_note` closes it. The
page follows the directory, so the agent's edits appear as it works.

The film plays with a slider per sound layer (voices, music, ambience,
effects). **Save** writes the balance to the project's `mix`; **Save and
remix video** also puts the new sound under `out/movie.mp4` in seconds,
without drawing a frame (`talekit remix` from the command line).

Beside the mp4, `render` writes `out/movie.mkv`: three sound tracks (the
full mix, the film without dialogue, and that with the narrator), subtitles
in the film's language and each translation (off until chosen), and a
chapter per shot. VLC or MX Player on a phone shows them all.

A **reel** for Instagram or YouTube Shorts is a project of its own at
720 × 1280 (`talekit init <dir> --width 720 --height 1280`): the story told
again in at most three minutes, mostly by the narrator, in scenes drawn
tall. Text keeps clear of the apps' overlays, and the render is one mp4,
with no .mkv.

## What the agent writes

- **Character** — a rigged puppet: SVG per part (`head`, `torso`, `armL`…)
  drawn in the rig's fixed box, with variant maps for `mouth` and `eyes` and
  colour tokens (`{skin}`) for recolouring. Rigs: `humanoid`, `quadruped`
  (walks in diagonal pairs, gallops, sits, lies) and `simple` (birds, props).
- **Scene** — a background SVG with named floor **anchors**, optional
  `foreground`, `far` and `near` layers with parallax, `weather` and
  `effects` the engine animates, and `lights` that cast shadows.
- **Shot** — one scene, a cast, and timed actions: verbs (`walk`, `run`,
  `jump`, `sit`, `lie`, `pickup`…), `say` (speech, thought or shout; drives
  the mouth, and listeners look at the speaker), `emotion`, `attach` (carry
  a prop), `caption`, `camera` (including `follow`), `sound`, `set`. A shot
  can `crossfade` in.
- **Sound** — a `voice` per character, a narrator for captions, music, and
  scene `ambience`. Footsteps, rain, fire, thunder and the like come from
  what is on screen.

A project is a plain directory:

```
my-story/
  talekit.json        title, size, fps, music, narrator, mix
  characters/*.json
  scenes/*.json
  shots/NN-*.json     play in filename order
  audio/              the project's own sound files; voices/ caches spoken lines
  out/                renders and previews (git-ignored)
```

## MCP tools

| tool                       | returns                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `get_guide`                | the authoring guide (read first)                                        |
| `create_project`           | a new project directory                                                 |
| `project_info`             | characters, scenes, shots, validation problems, open review notes       |
| `list_library`             | built-in characters and scenes (park, jungle, pond and others)          |
| `get_library_item`         | the JSON of a built-in, to learn a rig's layout before drawing          |
| `copy_from_library`        | copies a built-in with a new id, name, colours or anchors; its sheet    |
| `write_character`          | validates, saves, returns a **pose sheet** and a **construction sheet** |
| `write_scene`              | validates, saves, returns the scene with **anchors marked**             |
| `write_shot`               | validates cross references, saves, returns a **contact sheet**          |
| `patch_shot`               | changes fields, cast or actions of a saved shot without rewriting it    |
| `get_item` / `delete_item` | read back or remove one file                                            |
| `preview_frame`            | one frame at a time `t`, optional debug markers                         |
| `preview_shot`             | contact sheet of a shot                                                 |
| `list_voices`              | voices for characters and the narrator, by language                     |
| `list_sounds`              | bundled music, ambience and sound effects                               |
| `set_audio`                | sets the music, narrator and mix, returns a **map of the film's sound** |
| `render`                   | mp4 of one shot or the whole film, plus a **film sheet** (frame/shot)   |
| `list_notes`               | review notes left in the app, each with the frame or sheet it points at |
| `resolve_note`             | marks a note done once the fix is in                                    |

## CLI

```
talekit init <dir> --title "…"       talekit sheet <dir> <id>
talekit check <dir>                  talekit frame <dir> <shot> -t 2.5 [--debug] [--svg]
talekit library                      talekit contact <dir> <shot> -n 6
talekit copy <dir> <libraryId>       talekit render <dir> [shot] [--silent]
talekit serve <dir>                  talekit voice <dir> [shot]
talekit mcp                          talekit remix <dir> [-o file.mp4]
                                     talekit mkv <dir> [-o file.mp4]
```

`node dist/cli.js` with no arguments prints every option.

## How it works

`src/engine` is pure: `composeFrame(project, shot, t)` returns an SVG
string, and the sound is a cue sheet computed the same way. `src/render`
rasterises with resvg on worker threads, streams raw frames into ffmpeg
(libx264), mixes the sound in JS and muxes it as AAC; a minute of 720p
renders in about ten seconds on an M-series Mac. Lines are spoken by a
Python sidecar on MLX (`tools/tts/`) and cached in the project, so a render
is the same every time and needs no model once the lines exist. The module
layout is in [CLAUDE.md](CLAUDE.md); the roadmap and the reasoning behind
the design are in [docs/PLAN.md](docs/PLAN.md).

Latin text uses system fonts (the default stack starts with Chalkboard SE),
so output can differ slightly between machines. Hindi (Devanagari) is shaped
with HarfBuzz in the bundled Baloo 2 (`fonts/`, SIL Open Font License),
because the rasteriser misplaces its vowel signs.

## Development

```bash
npm run typecheck
npm test
npm run format
```
