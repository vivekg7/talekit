"""Write a character JSON: the colours it uses, checked and completed, and the file.

`character()` builds the dict, `write()` saves it as <project>/characters/<id>.json. Every
`{token}` the parts use must resolve, or the project fails validation; this module fills
the routine ones so a spec names only the colours that make the character:

- `BASE` gives line, cheek, mouth, tongue, the golds, gems, pearl, a tilak's white and
  red, sandal paste (chandan), a gamchha's red and white, a leather belt and scabbard, a
  white plume, jasmine, rudraksha brown and a janeu's white.
- `FALLBACK` points a token at another: `iris` to `line`, `brow` to `hair`, `cuff` to
  `shirtDark`, `button`, `sash`, `border`, `trim`, `earring` and `bangle` to `gold`,
  `bangle2`, `tie`, `ribbon` and `tassel` to `ruby`, `sole` to `shoesDark`, `veil` to
  `sari`, `bindi` to `tilakRed`, `lip` to `mouth`, `glasses` to `line`.
- A missing `<x>Dark` or `<x>Light` is shaded from `<x>` (svg.darker, svg.lighter).

Anything still missing raises, naming the token and the part, before talekit sees it."""

import json
import os
import re

from .svg import darker, lighter

BASE = {
    "line": "#2e2633",
    "cheek": "#d9625a",
    "mouth": "#6e2430",
    "tongue": "#d8686c",
    "gold": "#e2b13c",
    "goldLight": "#f8dc80",
    "goldDark": "#a87a1c",
    "ruby": "#d0313f",
    "emerald": "#24a061",
    "sapphire": "#2b56c2",
    "pearl": "#fbf6ea",
    "tilak": "#fbf8f0",
    "tilakRed": "#d0302a",
    "gamchha": "#c8343c",
    "gamchhaLine": "#fbf3ea",
    "belt": "#6b3f22",
    "scabbard": "#3b2622",
    "plume": "#fbfaf5",
    "gajra": "#fbf8ef",
    "chandan": "#efb85a",
    "rudraksha": "#7a3b22",
    "janeu": "#fffdf4",
}

FALLBACK = {
    "iris": "line",
    "brow": "hair",
    "cuff": "shirtDark",
    "button": "gold",
    "sole": "shoesDark",
    "sash": "gold",
    "gem": "emerald",
    "turbanEdge": "turbanDark",
    "border": "gold",
    "trim": "gold",
    "earring": "gold",
    "bangle": "gold",
    "bangle2": "ruby",
    "tie": "ruby",
    "ribbon": "ruby",
    "tassel": "ruby",
    "veil": "sari",
    "bindi": "tilakRed",
    "lip": "mouth",
    "glasses": "line",
}

TOKEN = re.compile(r"\{([A-Za-z][A-Za-z0-9]*)\}")


def tokens(parts):
    """Every {token} used in a part map (strings or variant maps), with a part that uses it."""
    found = {}

    def walk(name, v):
        if isinstance(v, str):
            for t in TOKEN.findall(v):
                found.setdefault(t, name)
        elif isinstance(v, dict):
            for k, sub in v.items():
                walk(f"{name}.{k}", sub)

    for name, v in parts.items():
        walk(name, v)
    return found


def complete(colors, used):
    """The colours a character needs: the given ones, then BASE, fallbacks and shades for the
    tokens its parts use. Only used tokens (and `line`) are kept, so the file stays short."""
    have = {**BASE, **colors}
    out = {"line": have["line"]}

    def value(t):
        if t in have:
            return have[t]
        if t in FALLBACK:
            return value(FALLBACK[t])
        for suffix, shade in (("Dark", darker), ("Light", lighter)):
            if t.endswith(suffix) and len(t) > len(suffix):
                base = value(t[: -len(suffix)])
                return shade(base) if base else None
        return None

    missing = {}
    for t, where in used.items():
        v = value(t)
        if v is None:
            missing[t] = where
        else:
            out[t] = v
    if missing:
        raise ValueError("colors missing: " + ", ".join(f"{{{t}}} (used in {w})" for t, w in sorted(missing.items())))
    return out


def character(id, name, rig, height, parts, colors, description="", voice=None, **more):
    """A character dict with its colours completed. `more` takes any other field of the
    format as it is: hem, shadow, grip, hold, hangs, springs."""
    c = {
        "id": id,
        "name": name,
        "description": description,
        "rig": rig,
        "height": height,
        **{k: v for k, v in more.items() if v is not None},
        "colors": complete(colors, tokens(parts)),
        "parts": parts,
    }
    if voice:
        c["voice"] = voice
    return c


def prop(id, name, height, body, colors, description="", grip=None, shadow=True, **more):
    """A thing on the simple rig (200 x 200, base on y=200): a vase, a basket, a stick.
    `body` is one SVG string or a map of variants ({'default': ..., 'broken': ...}) that a
    shot switches with a `face` action. `grip` is where a hand holds it."""
    return character(id, name, "simple", height, {"body": body}, colors, description, grip=grip, shadow=shadow, **more)


def project_dir(script, up=1):
    """The project a generator writes into: argv[1] if given, else `up` folders above the
    folder of the script (src/people.py -> the project; src/scenes/x.py -> up=2)."""
    import sys

    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        return os.path.abspath(sys.argv[1])
    d = os.path.dirname(os.path.abspath(script))
    for _ in range(up):
        d = os.path.dirname(d)
    return d


def write(project, c):
    """Save the character as <project>/characters/<id>.json and say so."""
    folder = os.path.join(project, "characters")
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, c["id"] + ".json"), "w") as fh:
        json.dump(c, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote", c["id"], f"({len(c['colors'])} colours)")
