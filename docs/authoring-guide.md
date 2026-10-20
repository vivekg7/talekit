# talekit authoring guide

You are turning a story into a short 2D animated film. talekit owns the
animation; you own the design and the staging. You write three kinds of files
(all JSON, all validated) and look at the picture that comes back after every
write. Fix what looks wrong before moving on.

## Workflow

1. **Read the story and plan.** List characters, locations and 6–40 shots of
   5–20 seconds each. A shot is one location with one bit of action.
2. **`create_project`** once. Then **`list_library`**.
3. **Characters.** Prefer `copy_from_library` with a new `asId`, `name` and
   `colors` (hair, skin, dress, shirt…). Draw from scratch with
   `write_character` only for something the library lacks (a dragon, a robot,
   a prop like a kite). Look at the returned pose sheet: proportions, pivots,
   expressions. Rewrite until it looks right.
4. **Scenes.** `copy_from_library` or `write_scene`. Look at the anchor sheet:
   every place a character will stand or sit needs an anchor on the floor.
5. **Shots.** `write_shot` one at a time, in order. Study the contact sheet:
   are people where you expect, facing each other, bubbles readable, timing
   sensible? Use `preview_frame` for an exact moment.
6. **`render`** a single shot early to check motion, then the whole film.

## Coordinate boxes

Characters are drawn into a fixed canonical box. The engine scales the box to
`height` pixels on screen and places the bottom-centre of the box at the
anchor (the feet point).

### `humanoid` rig — 200 wide × 400 tall, feet on y=400

```
 y   0 ─┬─ top of box (hair/hat)
        │   head: circle around (100, 88) r≈62   (kid)   or (100, 96) r≈54 (adult)
 y 152 ─┼─ NECK pivot (100,152): head rotates here
 y 170 ─┼─ SHOULDERS: armL pivot (76,170), armR pivot (124,170)
        │   torso: shoulders → hips (x 60..140)
 y 272 ─┼─ HIPS: legL pivot (86,272), legR pivot (114,272)
        │   legs hang straight down, feet/shoes at y 384..400
 y 400 ─┴─ FEET LINE (anchor point is (100,400))
```

Parts and draw order (back → front): `armL`, `legL`, `legR`, `torso`, (any
extra parts), `head`, `eyes`, `mouth`, `armR`. The character faces slightly
**right**; the engine mirrors it for `facing: "left"`. `armR` is the near arm
(waves, points), `armL` is the far arm.

Rules that make the rig work:

- **Draw every part in absolute canonical coordinates**, hanging from its
  pivot. The engine rotates the part around the pivot, so an arm must start at
  the shoulder and a leg at the hip. No `transform` attributes on the outer
  elements.
- Arms and legs are easiest as a `<path d='M76 170 L70 284' stroke='{skin}'
stroke-width='18' stroke-linecap='round' fill='none'/>` plus a hand circle
  and a shoe shape at the end.
- `eyes` and `mouth` rotate with the head. Give them variants (below).
- `torso` is required. Put the neck in the torso.
- Inner elements only (`<path>`, `<circle>`, `<rect>`, `<g>`…). Never an
  `<svg>` element, never `<image>`, no external references. Prefix any `id`
  you define with the character id to avoid clashes.

### `simple` rig — 200 × 200, base on y=200

One required `body` part plus optional `eyes` and `mouth`. The engine bobs and
tilts the whole body for walk/run, hops it for `bounce`, wobbles it for `fly`,
rotates it for `spin`. Use it for animals, vehicles, kites, balls, monsters.

### Variants

A part can be a map of named SVG fragments instead of a string. The engine
picks the variant from the current emotion, talking state and blinking:

| part    | variants the engine looks for                                                        |
| ------- | ------------------------------------------------------------------------------------ |
| `mouth` | `closed` (rest), `open` (talking flap, surprised), `smile`, `sad`, `angry`, `scared` |
| `eyes`  | `open`, `closed` (blink), `wide` (surprised/scared), `happy`, `sad`, `angry`         |

Missing variants fall back gracefully, but `mouth.open` and `eyes.closed` are
what make a character feel alive. A variant may be the empty string `""` to
draw nothing (a beak's closed mouth when the beak is part of the body) as long
as one variant of the part draws something. Any other part may have variants
too (`body: { dark, lit }` on a lantern, `hat: { on, tilted }`); select them
with a `face` action, e.g. `{ "face": { "hat": "tilted" } }`. The pose sheet
shows one cell per such variant at the end, so check them there.

### Colours

`colors` is a map of token → colour. Inside part SVG write `{skin}`, `{hair}`
and so on. Copying a library character and changing `colors` is the fastest
way to make a new cast member. Undefined tokens are a validation error.

## Scenes

A scene is an SVG fragment the size of the project (default 1280×720) plus
named **anchors**: floor points where characters stand. Add an anchor for
every door, chair, tree, table, path end you will use. Optional `scale` on an
anchor shrinks characters that stand further back (`0.7` for a distant path).
`ground` is the floor y for the built-in shortcuts `left`, `center`, `right`,
`offLeft`, `offRight` (off = just outside the frame, for entrances and exits).

Seating: `sit` puts the **hips** on the anchor, so a seat anchor goes on the
seat surface (e.g. `"bench-seat": { "x": 1010, "y": 604 }`), not on the floor.

Keep anchors that two people use at the same time at least a character's
width apart (about 150 px, more if one stands further back at a smaller
`scale`), or the nearer one hides the other and their bubbles collide.

Optional `foreground` is drawn in front of the actors (a table edge, a fence).

Design tips: the floor band should be the bottom 15–25% of the frame; keep
the middle third uncluttered where faces and bubbles go; a 220px character is
about a third of the frame height — the anchor sheet shows a ghost for scale.
Gradients and `<defs>` are fine; prefix ids with the scene id.

## Shots

```json
{
  "id": "02-meet-in-park",
  "scene": "park",
  "duration": 12,
  "fadeIn": 0.5,
  "cast": {
    "mia": { "at": "gate", "facing": "right" },
    "dad": { "at": "bench", "facing": "left", "emotion": "happy" }
  },
  "actions": [
    { "t": 0, "caption": "Later, in the park…", "duration": 2.5 },
    { "t": 0.5, "actor": "mia", "do": "walk", "to": "tree" },
    { "t": 3, "actor": "mia", "say": "Dad! Look what I found!" },
    { "t": 3, "actor": "dad", "do": "wave" },
    { "t": 5.5, "actor": "dad", "say": "A kite! Let's fly it.", "emotion": "happy" },
    { "t": 8, "actor": "mia", "do": "jump" },
    { "t": 9, "camera": { "zoom": 1.6, "x": 400, "y": 500 }, "duration": 2 }
  ]
}
```

- `cast` places everyone at the start. Characters not in the cast are not in
  the shot. `visible: false` hides until an `appear`.
- A position (`at`, `to`, `set.at`) is an anchor name or an explicit point in
  scene pixels, `{ "x": 640, "y": 610, "scale": 0.8 }` (`scale` optional).
  Anchors read better and survive a scene redraw; use points for spots the
  scene has no name for, such as a kite in the sky.
- `t` is seconds from the start of the shot. Actions on the same actor can
  overlap (walk and say at once). Actions never carry across shots.
- Shots play in file order; pass `order` to `write_shot` to set it.

### Verbs (`do`)

| verb                  | what happens                                                                | duration default |
| --------------------- | --------------------------------------------------------------------------- | ---------------- |
| `walk` / `run`        | leg/arm cycle to `to`; faces the direction of travel                        | distance ÷ speed |
| `move`                | glide to `to` without a cycle (sliding, floating objects)                   | distance ÷ 300   |
| `fly`                 | move with a gentle wobble (birds, kites, balloons); `to` may be in the sky  | distance ÷ 260   |
| `jump`                | hop in place, or to `to` if given                                           | 0.8s             |
| `wave`, `point`       | near arm up and waving / pointing forward                                   | 1.5s             |
| `nod`, `shake`        | head yes / no                                                               | 0.8s             |
| `sit` / `stand`       | persistent: hips on `to` (a seat anchor) or the current spot, until `stand` | instant          |
| `bounce`, `spin`      | squashy hop / full rotation (best on the simple rig)                        | 1s / 0.8s        |
| `appear`, `disappear` | fade in / out                                                               | 0.3s             |

Walking speed is about 220 px/s, so crossing the frame takes 4–5 seconds;
`run` is about 420 px/s, `fly` 260, `move` 300. Set `duration` to override any
default.

On the `simple` rig `wave`, `point`, `nod` and `shake` only tilt or nudge the
body; `bounce`, `jump` and `spin` read far better there.

There is no way to attach a prop to a hand. To have someone carry something,
make the prop a `simple` character and give it a `move` with the same `t`,
`to` and `duration` as the carrier's `walk`, offset so it sits beside the
hand; then `move` it to its resting anchor when they arrive.

### Dialogue

`say` draws a bubble above the head and flaps the mouth. Duration defaults to
1 s plus 0.4 s per word (min 1.8 s), so a six-word line stays up for 3.4 s;
set it explicitly for pacing. `bubble` can be `speech` (default), `thought` or
`shout`. Keep lines short (≤ 12 words) and sequence speakers so bubbles do not
overlap: `write_shot` warns when one actor starts speaking before another has
finished. Bubbles stay readable at any camera zoom.

### Emotion, face, captions, camera, set

- `emotion`: `neutral | happy | sad | surprised | angry | scared` — persistent
  until changed. `face: { "mouth": "grin" }` forces specific variants.
- `caption`: narrator text at the bottom (`captionStyle: "narration"`, the
  default) or a big centred card (`"title"`). Default 3 s.
- `camera: { zoom, x, y }` tweens from the current camera over `duration`
  (default 1 s; `0` cuts). `x, y` is the world point at frame centre. Zoom in
  on a face for reactions, pull back for arrivals. Keep zoom between 1 and 2:
  below 1 is raised to 1 (the scene has nothing outside its edges), and the
  view is clamped to the scene, so a zoom near an edge shifts toward the middle.
- `set: { facing, scale, visible, at }` changes state instantly (teleport,
  turn to face someone, grow).

## Pacing a children's story

- Open with a title card over the first scene (`fadeIn`, `caption` style
  `title`), close with "The End" and a `fadeOut`.
- One idea per shot. Enter, react, speak, leave. 8–15 seconds is typical.
- Let a line land: leave ~0.5 s after a bubble before the next one.
- Alternate wide shots (walks, arrivals) with closer camera zooms (feelings).
- Use `emotion` generously: a story reads through faces.
- Every `walk` needs enough `duration` or the character will sprint.

## Checklist before `render`

- `project_info` shows no validation errors or warnings you did not intend.
- Every shot's contact sheet looks staged: nobody floating, nobody clipped,
  bubbles inside the frame, right people facing each other.
- Total duration matches the target (5–10 minutes = 300–600 s).
