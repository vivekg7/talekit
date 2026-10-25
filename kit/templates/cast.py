"""The cast of a story, written from the kit: copy into <project>/src/, rename, redress.

usage: python3 src/cast.py [projectDir] [ids...]
Writes <project>/characters/<id>.json. Look at each sheet after: talekit sheet <project> <id>."""

import pathlib
import sys

KIT = next((p / "kit" for p in pathlib.Path(__file__).resolve().parents if (p / "kit" / "talekit").is_dir()), None)
if KIT:  # inside the talekit repo; elsewhere run with PYTHONPATH=<talekit>/kit
    sys.path.insert(0, str(KIT))

from talekit import people as p
from talekit.characters import project_dir, prop, write
from talekit.svg import edge, ellipse, fill, line, poly

PROJ = project_dir(__file__)

CAST = {
    # An old farmer: white pagdi, a long kurta with a gamchha, dhoti, chappals.
    "dada": p.person(
        "dada",
        "दादा",
        225,
        head=p.pagdi(),
        torso=p.kurta(long=True, extras=[p.gamchha()]),
        arms=p.sleeves(),
        legs=p.dhoti(p.chappal),
        face=p.face("full", wrinkles=True, nose="big"),
        eyes=p.eyes("old", brow=7.5),
        mouth=p.mouth(dy=6, closed="soft"),
        description="An old farmer: white pagdi, white moustache, cream kurta with a checked gamchha, white dhoti, chappals.",
        voice={"id": "chatterbox:hm_omega", "speed": 0.9},
        colors={
            "skin": "#b47a52",
            "hair": "#e9e6df",
            "hairDark": "#b9b3a8",
            "brow": "#dedad2",
            "turban": "#f7f3e8",
            "turbanLight": "#ffffff",
            "turbanDark": "#d8cfbb",
            "shirt": "#eee0bf",
            "button": "#a07c46",
            "pants": "#f7f4ec",
            "border": "#a33a3a",
            "shoes": "#8a5530",
        },
    ),
    # His grandson: spiky hair, a short kurta, pyjama, juttis.
    "beta": p.person(
        "beta",
        "बेटा",
        205,
        head=p.spiky_hair(),
        torso=p.kurta(k=0.92),
        arms=p.sleeves(),
        legs=p.pyjama(p.jutti),
        face=p.face(),
        eyes=p.eyes("eager", brow=5),
        mouth=p.mouth(),
        description="A boy of twelve: spiky hair, mustard kurta, white pyjama, tan juttis.",
        voice={"id": "chatterbox:hm_psi", "pitch": 3},
        hold=[129, 284],
        colors={
            "skin": "#c58c60",
            "hair": "#2b201b",
            "shirt": "#e2a82c",
            "pants": "#f3efe6",
            "shoes": "#a86a32",
            "sole": "#5e3a1b",
        },
    ),
}


def matka():
    """A clay water pot: round belly, short neck, rolled lip, two painted bands."""
    whole = (
        fill("M72 182 L128 182 L126 200 L74 200 Z", "{potDark}")
        + fill(
            "M100 82 C138 82 158 112 156 142 C154 176 130 198 100 198 C70 198 46 176 44 142 C42 112 62 82 100 82 Z",
            "{pot}",
        )
        + fill("M82 62 L118 62 L122 100 L78 100 Z", "{pot}")
        + ellipse(100, 62, 28, 8, "{pot}")
        + ellipse(100, 62, 20, 4.5, "{potDark}")
        + line("M52 128 Q100 142 148 128", 4, "{paint}")
        + line("M48 150 Q100 166 152 150", 4, "{paint}")
        + fill("M60 120 C62 104 72 94 84 90 C76 102 70 112 68 126 Z", "{potLight}")
    )
    pieces = [
        [(30, 200), (36, 176), (58, 164), (72, 184), (66, 200)],
        [(70, 200), (80, 170), (104, 160), (118, 178), (112, 200)],
        [(112, 200), (128, 176), (152, 172), (160, 200)],
        [(150, 200), (166, 186), (184, 200)],
    ]
    broken = "".join(fill(poly(ps), "{pot}") + edge(ps) for ps in pieces)
    broken += line("M86 186 Q98 180 110 184", 4, "{paint}") + line("M40 190 Q52 184 62 188", 4, "{paint}")
    return {"default": whole, "broken": broken}


PROPS = {
    "matka": prop(
        "matka",
        "मटका",
        70,
        matka(),
        {"pot": "#b5552c", "potLight": "#d98458", "paint": "#f3e6cf"},
        description="A clay water pot; body variants default (whole) and broken (shards on the ground).",
        grip=[100, 70],
    ),
}

if __name__ == "__main__":
    only = sys.argv[2:]
    for cid, c in {**CAST, **PROPS}.items():
        if not only or cid in only:
            write(PROJ, c)
