"""A scene of a story, painted from the kit: copy into <project>/src/scenes/<id>.py and redraw.

usage: python3 src/scenes/<id>.py [projectDir]
Writes <project>/scenes/<id>.json at the project's size, so one generator serves the film
(1280 x 720) and its reel (720 x 1280). Look at it after: talekit sheet <project> <id>
(walk green, solids red, the perspective's ghosts cyan, a `use` work point a pink cross)."""

import json
import pathlib
import random
import sys

KIT = next((p / "kit" for p in pathlib.Path(__file__).resolve().parents if (p / "kit" / "talekit").is_dir()), None)
if KIT:  # inside the talekit repo; elsewhere run with PYTHONPATH=<talekit>/kit
    sys.path.insert(0, str(KIT))

from talekit.characters import project_dir
from talekit.scenes import LINE, below, blob, canopy, f, solid, tufts, used, write

PROJ = project_dir(__file__, up=2)
META = json.loads((pathlib.Path(PROJ) / "talekit.json").read_text())
W, H = META.get("width", 1280), META.get("height", 720)
rnd = random.Random("aangan")  # one seed a scene, drawn in a fixed order: the same every run
OL = f"stroke='{LINE}' stroke-width='3'"  # what the cast touches gets a line

GROUND = round(H * 0.72)  # where the yard meets the back wall
WELL = (W * 0.74, H * 0.84)
STONE = (W * 0.3, H * 0.86)
TREE = (max(W * 0.12, 140), GROUND)
SUN = (round(W * 0.85), round(H * 0.08))

# far: the sky, alone filling the frame (haze takes its last stop), the sun named in `lights`
far = (
    "<defs><linearGradient id='aangan-sky' x1='0' y1='0' x2='0' y2='1'>"
    "<stop offset='0' stop-color='#8fc4ea'/><stop offset='1' stop-color='#e4f1f6'/></linearGradient></defs>"
    f"<rect width='{W}' height='{H}' fill='url(#aangan-sky)'/><circle cx='{SUN[0]}' cy='{SUN[1]}' r='34' fill='#fff3c4'/>"
)
# svg: the stage, the sky left out; soft and low in contrast behind the faces
svg = f"<rect x='0' y='{round(H * 0.4)}' width='{W}' height='{GROUND - round(H * 0.4) + 4}' fill='#d9b48a'/>"
svg += f"<rect x='0' y='{GROUND}' width='{W}' height='{H - GROUND}' fill='#c9a06a'/>"
svg += f"<rect x='{f(W * 0.46)}' y='{f(GROUND - 150)}' width='96' height='150' fill='#7a4f2e' {OL}/>"  # the door
svg += f"<path d='M{f(TREE[0] - 12)} {GROUND} L{f(TREE[0] - 6)} {f(H * 0.3)} L{f(TREE[0] + 8)} {f(H * 0.3)} L{f(TREE[0] + 14)} {GROUND} Z' fill='#6b4a30'/>"
svg += f"<g id='aangan-crown'>{canopy(TREE[0], H * 0.24, 130, 90, rnd, ['#4f7a3a', '#6b9a48', '#8cbb5c'])}</g>"
x, y = WELL  # the well: a stone drum, its rim, the dark water inside
svg += f"<path d='M{f(x - 80)} {f(y - 50)} L{f(x - 80)} {f(y)} A80 22 0 0 0 {f(x + 80)} {f(y)} L{f(x + 80)} {f(y - 50)} Z' fill='#a8a29a' {OL}/>"
svg += f"<ellipse cx='{f(x)}' cy='{f(y - 50)}' rx='80' ry='20' fill='#8a8a8a' {OL}/>"
svg += f"<ellipse cx='{f(x)}' cy='{f(y - 50)}' rx='64' ry='13' fill='#3a4448'/>"
svg += f"<path d='{blob(STONE[0] + 70, STONE[1] - 30, 56, 20, rnd)}' fill='#9a9288' {OL}/>"  # a washing stone
svg += tufts([W * k / 9 for k in range(1, 9)], H - 20, rnd, ["#8a9a4a", "#6f8a3c"])

scene = {
    "id": "aangan",
    "name": "आँगन",
    "description": "A village courtyard: a mud wall with a door, a neem at the left, a well at the right, a washing stone. `door` at the doorway, `kuan` beside the well, `pathar` sits a washer at the stone.",
    "far": far,
    "svg": svg,
    "ground": round(H * 0.88),
    # anchors take their size from their depth: no scale on them
    "perspective": [[GROUND, 0.8], [H, 1.05]],
    "walk": [below([(0, GROUND), (W, GROUND)], H + 60)],
    "solids": {"kuan": solid(WELL[0], WELL[1] - 8, 170, 44)},
    "sway": {"aangan-crown": {"at": [round(TREE[0]), round(H * 0.3)]}},
    "lights": [{"kind": "sun", "x": SUN[0], "y": SUN[1]}],
    "weather": {"wind": 0.15},
    "anchors": {
        "door": {"x": round(W * 0.46 + 48), "y": GROUND + 8},
        "kuan": {"x": round(WELL[0] - 80 - W * 0.06), "y": round(WELL[1])},
        # a washer sits here facing right; a strike or wipe `to` it lands on the stone's top
        "pathar": used(STONE[0], STONE[1], (STONE[0] + 68, STONE[1] - 46), "right", "sit"),
    },
}
write(PROJ, scene)
