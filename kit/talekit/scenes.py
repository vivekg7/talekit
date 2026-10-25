"""Painting helpers for scene generators, and the writer.

A scene generator builds its layers (`far`, `svg`, `near`, `foreground`) from these and
code of its own, then `write(project, scene)`. Every helper takes the caller's own seeded
`random.Random`, so a scene paints the same on every run: seed it once per scene
(`rnd = random.Random('darbar')`) and draw in a fixed order.

Draw backgrounds soft and low in contrast so the outlined cast reads against them; give
what a character touches (a throne, a table, bars) a LINE outline about 3 px. See the
guide's "Scenes" for anchors, layers, lights, weather and effects."""

import json
import math
import os

from .svg import taper

LINE = "#2e2633"


def f(v):
    """A number to one decimal, without a trailing .0 or 0."""
    return f"{v:.1f}".rstrip("0").rstrip(".")


def blob(cx, cy, rx, ry, rnd, n=9, jitter=0.18):
    """A soft irregular closed blob: a smooth quadratic path through jittered points."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.12, 0.12)
        k = 1 + rnd.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k))
    mids = [((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2) for i in range(n)]
    d = f"M{f(mids[-1][0])} {f(mids[-1][1])}"
    for i in range(n):
        d += f" Q{f(pts[i][0])} {f(pts[i][1])} {f(mids[i][0])} {f(mids[i][1])}"
    return d + " Z"


def canopy(cx, cy, rx, ry, rnd, tones, count=34, leaf=(26, 44), hi=True):
    """A painted leaf mass: a dark underside, then mid clumps, then sunlit clumps up and to
    the left (the light is high on the left). `tones`: dark, mid, light[, highlight]."""
    dark, mid, light = tones[0], tones[1], tones[2]
    s = f"<path d='{blob(cx, cy + ry * 0.08, rx, ry, rnd, 11, 0.12)}' fill='{dark}'/>"
    for _ in range(count):
        a = rnd.uniform(0, 2 * math.pi)
        r = math.sqrt(rnd.uniform(0, 1))
        x = cx + math.cos(a) * rx * 0.85 * r
        y = cy + math.sin(a) * ry * 0.8 * r
        sz = rnd.uniform(*leaf)
        lit = (cy - y) / ry * 0.6 + (cx - x) / rx * 0.4
        col = light if lit > 0.25 else (mid if lit > -0.35 else dark)
        if y > cy + ry * 0.5:
            col = dark
        s += f"<path d='{blob(x, y, sz, sz * 0.75, rnd, 7, 0.2)}' fill='{col}'/>"
    if hi:
        for _ in range(count // 3):
            a = rnd.uniform(math.pi * 0.9, math.pi * 1.6)
            r = rnd.uniform(0.3, 0.85)
            x = cx + math.cos(a) * rx * r
            y = cy + math.sin(a) * ry * r
            sz = rnd.uniform(leaf[0] * 0.4, leaf[0] * 0.75)
            top = tones[3] if len(tones) > 3 else light
            s += f"<path d='{blob(x, y, sz, sz * 0.7, rnd, 6, 0.2)}' fill='{top}' opacity='0.8'/>"
    return s


def tufts(xs, y0, rnd, cols, h=(10, 22), blades=(3, 6), lean=0.0):
    """Grass tufts at each x: curved pointed blades fanning from a base point, one path a
    tuft. `y0` is the ground line, or a function of x for sloping ground."""
    s = ""
    for x in xs:
        y = y0(x) if callable(y0) else y0
        col = rnd.choice(cols)
        n = rnd.randint(*blades)
        hh = rnd.uniform(*h)
        d = ""
        for b in range(n):
            ang = (b - (n - 1) / 2) * 0.32 + rnd.uniform(-0.12, 0.12) + lean
            L = hh * rnd.uniform(0.7, 1.1)
            tx = x + math.sin(ang) * L * 1.2
            ty = y - math.cos(ang) * L
            bx = x + (b - (n - 1) / 2) * 1.5
            d += (
                f"M{bx - 1.8:.0f} {y:.0f}Q{bx + math.sin(ang) * L * 0.3 - 1:.0f} {y - L * 0.6:.0f} {tx:.0f} {ty:.0f}"
                f"Q{bx + math.sin(ang) * L * 0.3 + 1.5:.0f} {y - L * 0.5:.0f} {bx + 1.8:.0f} {y:.0f}Z"
            )
        s += f"<path d='{d}' fill='{col}'/>"
    return s


def stick(p0, p1, w0, w1, col, rnd, bend=0.08, outline=None):
    """A dry stick or branch: a tapered, slightly bent filled path; `outline` is
    (colour, width) for one a character touches."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    nx, ny = -dy, dx
    b1 = rnd.uniform(-bend, bend)
    b2 = rnd.uniform(-bend, bend)
    c1 = (p0[0] + dx / 3 + nx * b1, p0[1] + dy / 3 + ny * b1)
    c2 = (p0[0] + 2 * dx / 3 + nx * b2, p0[1] + 2 * dy / 3 + ny * b2)
    d = taper(p0, c1, c2, p1, w0, w1, 10)
    if outline:
        return f"<path d='{d}' fill='{col}' stroke='{outline[0]}' stroke-width='{outline[1]}' stroke-linejoin='round'/>"
    return f"<path d='{d}' fill='{col}'/>"


def write(project, scene):
    """Save the scene as <project>/scenes/<id>.json and print each layer's size."""
    folder = os.path.join(project, "scenes")
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, f"{scene['id']}.json"), "w") as fh:
        json.dump(scene, fh, ensure_ascii=False, indent=1)
    print("wrote", scene["id"], {k: len(v) for k, v in scene.items() if k in ("far", "svg", "near", "foreground")})
