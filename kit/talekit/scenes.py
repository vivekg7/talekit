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

from .svg import f1, taper

LINE = "#2e2633"


def f(v):
    """svg.f1: a number to one decimal, without a trailing .0."""
    return f1(v)


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


def below(line, bottom, margin=300):
    """A walk or water area: everything under a ground line down to `bottom` (the frame's
    height plus a little). `line` is [(x, y), ...] left to right along the top edge of what
    can be stood on (the meadow's edge, the far bank, the floor meeting the wall); it is
    run on `margin` px past both ends at the end heights, so the ground leaves the frame.
    below([(0, 560), (640, 548), (1280, 575)], 760) is a wide scene's floor."""
    pts = [(round(x), round(y)) for x, y in line]
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    return [
        [x0 - margin, y0],
        *[[x, y] for x, y in pts],
        [x1 + margin, y1],
        [x1 + margin, bottom],
        [x0 - margin, bottom],
    ]


def ledge(x0, x1, y, depth=14):
    """A thin walk area along the top of something stood on above the floor (a branch, a
    wall top, a step, a rock's crown): from x0 to x1 at height y, `depth` px deep."""
    return [
        [round(x0), round(y - depth / 2)],
        [round(x1), round(y - depth / 2)],
        [round(x1), round(y + depth / 2)],
        [round(x0), round(y + depth / 2)],
    ]


def rail(foot, top, width=40):
    """A climb area up a ladder, a trunk, a wall or a rope: a band `width` px wide from
    `foot` (x, y), where it stands on the ground, to `top` (x, y), where it reaches (the
    deck, the branch); it may lean. A `climb` goes from one end to the other inside it."""
    (fx, fy), (tx, ty) = foot, top
    h = width / 2
    return [
        [round(tx - h), round(ty - 8)],
        [round(tx + h), round(ty - 8)],
        [round(fx + h), round(fy + 6)],
        [round(fx - h), round(fy + 6)],
    ]


def solid(x, y, width, depth, layer="svg", sides=12):
    """A solid: the oval footprint on the floor of something feet cannot pass through (a
    well's ring, a trunk's foot, a boulder), centred on (x, y), `width` across and `depth`
    from back to front. layer="foreground" when its picture is drawn there, so walks go
    round its back; in "svg" (the default) they go round its front.
    scene["solids"] = {"well": solid(850, 632, 290, 60, "foreground")}."""
    pts = [
        [
            round(x + width / 2 * math.cos(2 * math.pi * i / sides)),
            round(y + depth / 2 * math.sin(2 * math.pi * i / sides)),
        ]
        for i in range(sides)
    ]
    return {"area": pts, "layer": layer}


def used(x, y, at, facing=None, pose="stand", **more):
    """An anchor for a place used a certain way: whoever works there stands (or, pose="sit",
    sits on the ground; give floor= for a seat) at (x, y) facing `facing`, and a strike, wipe
    or hold with this anchor as its `to` lands on `at`, (x, y) in the scene. The engine walks
    the doer over first and, for pose="sit", sits it down, if it has the time and nothing
    else to do. used(960, 684, (1068, 604), "right", "sit"): a washer beside a raised
    stone. `more`: scale, floor, ground."""
    use = {"pose": pose, "at": [round(at[0]), round(at[1])]}
    if facing:
        use["facing"] = facing
    return {"x": round(x), "y": round(y), **more, "use": use}


def write(project, scene):
    """Save the scene as <project>/scenes/<id>.json and print each layer's size. A scene
    needs `walk` (see below() and ledge()), or allow {'world.walk': reason}."""
    folder = os.path.join(project, "scenes")
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, f"{scene['id']}.json"), "w") as fh:
        json.dump(scene, fh, ensure_ascii=False, indent=1)
    print(
        "wrote",
        scene["id"],
        {k: len(v) for k, v in scene.items() if k in ("far", "svg", "near", "foreground")},
        f"walk {len(scene.get('walk', []))}, water {len(scene.get('water', []))}, climb {len(scene.get('climb', []))}",
    )
    if not scene.get("walk") and "world.walk" not in scene.get("allow", {}):
        print(f"  {scene['id']}: no walk areas: add scene['walk'] (below(), ledge()) or talekit check fails")
