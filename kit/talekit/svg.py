"""Drawing primitives: SVG fragments as strings, single-quoted so the JSON stays readable.

Colours are `{token}` strings resolved by the character's `colors` (see characters.py).
Paths are absolute M/L/Q/C/Z, which is what `sx` and `shift_y` rewrite."""

import itertools
import math
import re


def f1(v):
    """A number to one decimal, without a trailing .0."""
    s = f"{v:.1f}"
    return s.removesuffix(".0")


def stroke(d, col, w, cap="round"):
    """A path drawn as an even stroke: a limb, a strap, a plume's spine."""
    return f"<path d='{d}' stroke='{col}' stroke-width='{w}' stroke-linecap='{cap}' fill='none'/>"


def line(d, w=3.5, col="{line}"):
    """Line work inside a silhouette: a brow, a crease, a closed mouth."""
    return f"<path d='{d}' stroke='{col}' stroke-width='{w}' fill='none' stroke-linecap='round'/>"


def fill(d, col, extra=""):
    return f"<path d='{d}' fill='{col}'{extra}/>"


def circle(cx, cy, r, col, extra=""):
    return f"<circle cx='{f1(cx)}' cy='{f1(cy)}' r='{f1(r)}' fill='{col}'{extra}/>"


def ellipse(cx, cy, rx, ry, col, extra=""):
    return f"<ellipse cx='{f1(cx)}' cy='{f1(cy)}' rx='{f1(rx)}' ry='{f1(ry)}' fill='{col}'{extra}/>"


def poly(pts):
    """A closed polygon path through the points."""
    return "M" + " L".join(f"{f1(x)} {f1(y)}" for x, y in pts) + " Z"


def edge(pts, w=3):
    """A polygon's own edge in line colour: a shard that must read apart from the one under it."""
    return f"<path d='{poly(pts)}' stroke='{{line}}' stroke-width='{w}' stroke-linejoin='round' fill='none'/>"


def bez(p0, c1, c2, p1, t):
    """The point at t along a cubic."""
    u = 1 - t
    return tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, c1, c2, p1))


def qpts(p0, c, p1, step):
    """Points about `step` apart along a quadratic: beads, pearls, a row of buttons."""

    def at(t):
        u = 1 - t
        return (u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])

    fine = [at(i / 400) for i in range(401)]
    out, acc = [fine[0]], 0.0
    for a, b in itertools.pairwise(fine):
        acc += math.hypot(b[0] - a[0], b[1] - a[1])
        if acc >= step:
            out.append(b)
            acc = 0.0
    return out


def ribbon(p0, c1, c2, p1, w0, w1=None, n=16):
    """A band of even (or w0 to w1) width along a cubic, square ended, as a fill: a border,
    a wrap of a turban, a sash. Filled rather than stroked so the engine outlines it."""
    w1 = w0 if w1 is None else w1
    pts = [bez(p0, c1, c2, p1, i / n) for i in range(n + 1)]
    L, R = [], []
    for i, q in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(n, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = (w0 + (w1 - w0) * i / n) / 2
        L.append((q[0] + nx * w, q[1] + ny * w))
        R.append((q[0] - nx * w, q[1] - ny * w))
    return poly(L + R[::-1])


def taper(p0, c1, c2, p1, w0, w1, n=14, ease=1.0):
    """A filled path along a cubic, w0 wide at the start to w1 at the end, round ends: a
    tail, a haunch, a moustache's sweep, a plume. Each end is a point semicircle bulging
    along the tangent, so there is no arc-flag ambiguity."""
    pts = [bez(p0, c1, c2, p1, i / n) for i in range(n + 1)]
    L, R, N = [], [], []
    for i, p in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(n, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        N.append((nx, ny))
        w = (w0 + (w1 - w0) * (i / n) ** ease) / 2
        L.append((p[0] + nx * w, p[1] + ny * w))
        R.append((p[0] - nx * w, p[1] - ny * w))

    def cap(c, nrm, r):
        nx, ny = nrm
        tx, ty = ny, -nx
        return [
            (c[0] + nx * r * math.cos(a) + tx * r * math.sin(a), c[1] + ny * r * math.cos(a) + ty * r * math.sin(a))
            for a in (math.pi * k / 6 for k in range(1, 6))
        ]

    seq = L + cap(pts[-1], N[-1], w1 / 2) + R[::-1] + cap(pts[0], (-N[0][0], -N[0][1]), w0 / 2)
    return "M" + " ".join(("" if i == 0 else "L") + f"{q[0]:.1f} {q[1]:.1f}" for i, q in enumerate(seq)) + " Z"


def _map_path(d, fx, fy):
    out = []
    for tok in re.split(r"([MLQCZ])", d):
        if tok in "MLQCZ" and len(tok) == 1:
            out.append(tok)
            continue
        vals = [float(v) for v in tok.replace(",", " ").split()]
        out.append(" ".join(f1(fx(v)) if i % 2 == 0 else f1(fy(v)) for i, v in enumerate(vals)) + (" " if vals else ""))
    return "".join(out).strip()


def sx(d, k):
    """Scale every x of an absolute M/L/Q/C/Z path about x=100: a narrower or broader build
    from the same outline."""
    return _map_path(d, lambda v: 100 + (v - 100) * k, lambda v: v)


def shift_y(d, dy):
    """Move an absolute M/L/Q/C/Z path down by dy."""
    return _map_path(d, lambda v: v, lambda v: v + dy)


def gem(x, y, r, col, rim="{gold}", sx=1.0):
    """A cabochon in a setting with a white glint; sx < 1 narrows it round a curve."""
    return (
        ellipse(x, y, (r + 2.2) * sx, r + 2.2, rim)
        + ellipse(x, y, r * sx, r, col)
        + ellipse(x - r * 0.35 * sx, y - r * 0.4, max(1.2, r * 0.3 * sx), max(1.2, r * 0.3), "#fff")
    )


# ---------------------------------------------------------------- colour


def _rgb(hex_):
    h = hex_.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def mix(a, b, k):
    """Colour a moved k of the way to colour b."""
    ra, rb = _rgb(a), _rgb(b)
    return "#" + "".join(f"{round(x + (y - x) * k):02x}" for x, y in zip(ra, rb))


def darker(c, k=0.22):
    """The shade for inner detail on a colour (a hem, a fold): toward a warm near-black, so
    it stays rich instead of going grey."""
    return mix(c, "#1a0f14", k)


def lighter(c, k=0.3):
    return mix(c, "#ffffff", k)
