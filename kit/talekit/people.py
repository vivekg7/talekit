"""A wardrobe for people on the humanoid rig (200 x 400, feet on y=400, facing right).

Pick a head, a torso, arms and legs, a face, eyes and a mouth, give the colours, and
`person()` returns the character. The pieces follow the rig's contract (docs/authoring-
guide.md, "humanoid rig" and "Construction"): limbs are straight strokes from their pivots,
faces are drawn front-on round x=100, every head and torso has a back.

    from talekit import people as p
    ramaiya = p.person(
        'ramaiya', 'रमैया', 225,
        head=p.short_hair(), torso=p.banyan(extras=[p.gamchha()]),
        arms=p.bare_arms(), legs=p.dhoti(p.bare_foot, bottom=358, border=False),
        face=p.face('small'), eyes=p.eyes('eager', brow=5), mouth=p.mouth(dy=2),
        colors=dict(skin='#9c6039', hair='#1c1513', shirt='#f6f3ea', pants='#ece4d0'))

The kinds of part:
  heads   -> (front, back) SVG:  short_hair side_part spiky_hair curly_hair head_band
             pagdi tall_pagdi safa plumed_turban crown bun
             (front, back, hung) with plaits that swing:  plait two_plaits
  torsos  -> Torso(front, back, hem):  kurta banyan tunic angrakha, sari choli kameez
  extras  -> (front, back) laid over a torso:  gamchha angavastram dupatta
  arms    -> fn(px, hx, near):  sleeves royal_sleeves bare_arms blouse_sleeves
  legs    -> fn(px, fx):  dhoti pyjama churidar sari_skirt ghagra, each standing on a foot
  feet    -> fn(fx):  bare_foot chappal jutti royal_jutti boot
  face(moustache, ...), eyes(look, ...), mouth(dy, ...) -> the face parts

Colour tokens the pieces use: skin, hair, shirt (kurta, banyan, tunic, kameez), coat
(angrakha), pants (dhoti, pyjama, churidar), sari and blouse (sari), blouse and skirt
(choli, ghagra), shoes, turban, and per piece the ones its docstring names. A woman wears
a sari over sari_skirt, a choli over a ghagra, or a kameez over pyjama or churidar. Shades (<x>Dark, <x>Light) and the routine colours are filled in by characters.py.
Everything here is the same on every run: no randomness."""

import itertools
import math
import re
from collections import namedtuple

from .characters import character
from .svg import circle, ellipse, f1, fill, gem, line, poly, qpts, ribbon, shift_y, stroke, sx, taper

Torso = namedtuple("Torso", "front back hem")


# ================================================================ arms
# An arm is one straight line from the shoulder (px, 178) to the hand (hx, 288..292); the
# engine bends it at the elbow (y 226). `near` is True for armR, the arm toward the viewer.


def hand(hx, hy):
    """A mitten hand, thumb forward, the fingers' curl as a short line."""
    return (
        fill(
            f"M{hx - 11} {hy - 8} C{hx - 13} {hy + 3} {hx - 8} {hy + 12} {hx} {hy + 12} C{hx + 9} {hy + 12} {hx + 12} {hy + 4} "
            f"{hx + 11} {hy - 7} C{hx + 9} {hy - 15} {hx - 9} {hy - 16} {hx - 11} {hy - 8} Z",
            "{skin}",
        )
        + fill(
            f"M{hx} {hy - 9} C{hx + 10} {hy - 17} {hx + 17} {hy - 12} {hx + 16} {hy - 5} C{hx + 15} {hy} {hx + 10} {hy + 5} {hx} {hy + 3} Z",
            "{skin}",
        )
        + line(f"M{hx - 7} {hy + 5} Q{hx - 2} {hy + 9} {hx + 3} {hy + 6}", 2.5, "{skinDark}")
    )


def _band_across(px, hx, cy, h, hw, col, at):
    """A band square across the arm's line, centred at height cy: a cuff, an armlet."""
    dx, dy = hx - px, 110
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    cx = at(cy)
    c0 = (cx - ux * h / 2, cy - uy * h / 2)
    c1 = (cx + ux * h / 2, cy + uy * h / 2)
    pts = [
        (c0[0] + nx * hw, c0[1] + ny * hw),
        (c1[0] + nx * hw, c1[1] + ny * hw),
        (c1[0] - nx * hw, c1[1] - ny * hw),
        (c0[0] - nx * hw, c0[1] - ny * hw),
    ]
    return fill(poly(pts), col)


def sleeves(cloth="shirt", cuff="cuff", bangle=False):
    """Full sleeves of a kurta or tunic to a cuff at the wrist, a bare wrist, the hand; a fold
    where the sleeve bends at the elbow. Tokens: skin, <cloth>, <cloth>Dark, cuff (or the
    `cuff` token given), gold for a bangle."""

    def arm(px, hx, near=False):
        def at(y):
            return px + (hx - px) * (y - 178) / 110

        wy = 262
        wx = at(wy)
        out = stroke(f"M{f1(at(250))} 250 L{hx} 284", "{skin}", 15) + hand(hx, 292)
        if bangle:
            out += stroke(f"M{f1(at(272) - 8)} 272 L{f1(at(272) + 8)} 273", "{gold}", 5)
        out += (
            circle(px, 174, 15, f"{{{cloth}}}")
            + stroke(f"M{px} 178 L{f1(wx)} {wy}", f"{{{cloth}}}", 22, "butt")
            + stroke(f"M{px} 178 L{f1(at(200))} 200", f"{{{cloth}}}", 22)
        )
        dx, dy = hx - px, 110
        ln = math.hypot(dx, dy)
        ux, uy = dx / ln, dy / ln
        nx, ny = -uy, ux
        c0 = (wx - ux * 9, wy - uy * 9)
        c1 = (wx + ux * 1, wy + uy * 1)
        hw = 12
        pts = [
            (c0[0] + nx * hw, c0[1] + ny * hw),
            (c1[0] + nx * hw, c1[1] + ny * hw),
            (c1[0] - nx * hw, c1[1] - ny * hw),
            (c0[0] - nx * hw, c0[1] - ny * hw),
        ]
        out += fill(poly(pts), f"{{{cuff}}}")
        out += line(f"M{f1(at(222) - 6)} 221 Q{f1(at(226))} 226 {f1(at(224) + 7)} 223", 2.5, f"{{{cloth}Dark}}")
        return out

    return arm


def royal_sleeves(cloth="coat", width=24, armlet=True, ring=True):
    """Silk sleeves to a gold cuff, a gold armlet with a ruby on the upper arm, a ring on the
    near hand. Tokens: skin, <cloth>, gold, goldDark, ruby."""

    def arm(px, hx, near=False):
        def at(y):
            return px + (hx - px) * (y - 178) / 110

        wy = 262
        wx = at(wy)
        out = stroke(f"M{f1(at(250))} 250 L{hx} 288", "{skin}", 15)
        out += (
            fill(
                f"M{hx - 11} 284 C{hx - 13} 295 {hx - 8} 304 {hx} 304 C{hx + 9} 304 {hx + 12} 296 {hx + 11} 285 "
                f"C{hx + 9} 277 {hx - 9} 276 {hx - 11} 284 Z",
                "{skin}",
            )
            + fill(
                f"M{hx} 283 C{hx + 10} 275 {hx + 17} 280 {hx + 16} 287 C{hx + 15} 292 {hx + 10} 297 {hx} 295 Z",
                "{skin}",
            )
            + fill(f"M{hx - 8} 294 Q{hx - 3} 299.7 {hx + 2} 295 Q{hx - 3} 297.3 {hx - 8} 294 Z", "{line}")
        )
        out += (
            circle(px, 174, width / 2 + 3, f"{{{cloth}}}")
            + stroke(f"M{px} 178 L{f1(wx)} {wy}", f"{{{cloth}}}", width, "butt")
            + stroke(f"M{px} 178 L{f1(at(200))} 200", f"{{{cloth}}}", width)
        )
        hw = width / 2
        out += _band_across(px, hx, wy - 4, 10, hw + 0.5, "{gold}", at)
        out += _band_across(px, hx, wy - 4, 3, hw + 0.5, "{goldDark}", at)
        if armlet:
            out += _band_across(px, hx, 204, 9, hw + 1, "{gold}", at) + gem(at(204), 204, 3.6, "{ruby}")
        if ring and near:
            out += circle(hx + 9, 288, 3.2, "{gold}")
        return out

    return arm


def bare_arms():
    """Bare thin arms (a sleeveless banyan, a bare-chested worker): a taper from the shoulder,
    fuller at the top. Tokens: skin, skinDark."""

    def arm(px, hx, near=False):
        return (
            fill(
                taper((px, 168), (px + (hx - px) * 0.3, 200), (px + (hx - px) * 0.6, 240), (hx, 282), 20, 14), "{skin}"
            )
            + hand(hx, 292)
            + line(
                f"M{f1(px + (hx - px) * 0.5 - 5)} 224 Q{f1(px + (hx - px) * 0.5)} 228 {f1(px + (hx - px) * 0.5 + 5)} 225",
                2.2,
                "{skinDark}",
            )
        )

    return arm


def blouse_sleeves(cloth="blouse", trim="border", end=210, bangles=3):
    """A woman's sleeve round the shoulder to a trimmed edge at `end` (210 a blouse's short
    sleeve, 236 a kameez's to below the elbow), the bare forearm with `bangles` (0 to 3) in
    alternating colours, the hand. Tokens: skin, skinDark, <cloth>, <trim> (default border,
    gold), bangle (gold), bangle2 (ruby)."""

    def arm(px, hx, near=False):
        def at(y):
            return px + (hx - px) * (y - 178) / 110

        out = stroke(f"M{px} 178 L{hx} 284", "{skin}", 14) + hand(hx, 292)
        for i, cy in enumerate((264, 269.5, 275)[:bangles]):
            out += _band_across(px, hx, cy, 4, 9, "{bangle}" if i % 2 == 0 else "{bangle2}", at)
        out += circle(px, 174, 14, f"{{{cloth}}}") + stroke(
            f"M{px} 178 L{f1(at(end))} {end}", f"{{{cloth}}}", 27, "butt"
        )
        out += _band_across(px, hx, end - 1, 8, 13.5, f"{{{trim}}}", at)
        return out

    return arm


# ================================================================ feet
# A foot stands on y=400 with the heel at fx-14 and the toe toward the right.


def bare_foot(fx):
    """A bare foot flat on the floor, the toes marked. Tokens: skin, skinDark."""
    x = fx - 14
    return (
        fill(
            f"M{x} 396 C{x - 1} 387 {x + 4} 380 {x + 13} 379 L{x + 22} 381 C{x + 31} 384 {x + 41} 388 {x + 47} 392 "
            f"C{x + 51} 395 {x + 50} 400 {x + 45} 400 L{x + 3} 400 Q{x} 400 {x} 396 Z",
            "{skin}",
        )
        + line(f"M{x + 40} 393 L{x + 39} 397", 2.2, "{skinDark}")
        + line(f"M{x + 35} 392 L{x + 34} 396", 2.2, "{skinDark}")
        + line(f"M{x + 8} 386 Q{x + 12} 388 {x + 16} 386", 2.2, "{skinDark}")
    )


def chappal(fx):
    """A bare foot on a flat leather chappal: a sole, a strap over the instep, a toe post.
    Tokens: skin, shoes."""
    x = fx - 14
    return (
        fill(
            f"M{x + 1} 393 C{x} 385 {x + 5} 380 {x + 14} 380 L{x + 24} 381 C{x + 33} 383 {x + 41} 387 {x + 46} 391 "
            f"C{x + 48} 393 {x + 48} 396 {x + 46} 397 L{x + 1} 397 Z",
            "{skin}",
        )
        + fill(
            f"M{x - 2} 394 L{x + 50} 394 Q{x + 51} 400 {x + 45} 400 L{x + 2} 400 Q{x - 2} 400 {x - 2} 394 Z", "{shoes}"
        )
        + stroke(f"M{x + 16} 382 Q{x + 23} 388 {x + 30} 384", "{shoes}", 6)
        + line(f"M{x + 40} 389 L{x + 38} 394", 2.5, "{shoes}")
    )


def jutti(fx):
    """A jutti: a closed slipper, the pointed toe turned up, a pale sole edge and a stitched
    line along the vamp. Tokens: shoes, shoesLight, sole."""
    x = fx - 14
    return (
        fill(
            f"M{x} 394 C{x - 1} 384 {x + 5} 379 {x + 15} 379 L{x + 25} 380 C{x + 35} 382 {x + 44} 386 {x + 50} 385 "
            f"C{x + 54} 384 {x + 57} 381 {x + 58} 379 C{x + 59} 386 {x + 54} 394 {x + 46} 397 L{x} 397 Z",
            "{shoes}",
        )
        + fill(
            f"M{x - 2} 394 L{x + 50} 394 Q{x + 49} 400 {x + 43} 400 L{x + 2} 400 Q{x - 2} 400 {x - 2} 394 Z", "{sole}"
        )
        + line(f"M{x + 16} 384 Q{x + 30} 384 {x + 44} 389", 2.5, "{shoesLight}")
    )


def royal_jutti(fx):
    """A royal jutti with the toe curled right up to a bead, a gold vamp line, a pale sole.
    Tokens: shoes, shoesLight, sole."""
    x = fx - 14
    return (
        fill(
            f"M{x} 394 C{x - 1} 384 {x + 5} 379 {x + 15} 379 L{x + 25} 380 C{x + 35} 382 {x + 44} 386 {x + 50} 384 "
            f"C{x + 55} 382 {x + 57} 377 {x + 56} 372 C{x + 62} 376 {x + 60} 390 {x + 48} 397 L{x} 397 Z",
            "{shoes}",
        )
        + fill(
            f"M{x - 2} 394 L{x + 50} 394 Q{x + 49} 400 {x + 43} 400 L{x + 2} 400 Q{x - 2} 400 {x - 2} 394 Z", "{sole}"
        )
        + line(f"M{x + 14} 384 Q{x + 30} 383 {x + 46} 389", 3, "{shoesLight}")
        + circle(x + 56, 372, 2.6, "{shoesLight}")
    )


def boot(fx):
    """A leather boot to mid-shin, the toe turned up, a pale sole edge and a band at the top.
    Tokens: shoes, shoesDark, shoesLight, sole."""
    x = fx - 14
    return (
        fill(f"M{fx - 12} 346 L{fx + 12} 346 L{fx + 13} 384 L{fx - 13} 386 Z", "{shoes}")
        + fill(
            f"M{x} 394 C{x - 1} 384 {x + 3} 377 {x + 13} 376 L{x + 26} 378 C{x + 36} 381 {x + 44} 386 {x + 50} 385 "
            f"C{x + 55} 384 {x + 58} 380 {x + 59} 377 C{x + 60} 386 {x + 55} 394 {x + 46} 397 L{x} 397 Z",
            "{shoes}",
        )
        + fill(
            f"M{x - 2} 394 L{x + 50} 394 Q{x + 49} 400 {x + 43} 400 L{x + 2} 400 Q{x - 2} 400 {x - 2} 394 Z", "{sole}"
        )
        + fill(f"M{fx - 13} 344 L{fx + 13} 344 L{fx + 13} 353 L{fx - 13} 353 Z", "{shoesDark}")
        + line(f"M{x + 18} 383 Q{x + 32} 383 {x + 46} 389", 2.5, "{shoesLight}")
    )


# ================================================================ legs
# A leg is one straight stroke from the hip (px, 274) to the foot at fx; it bends at y=330.


def dhoti(foot=chappal, bottom=371, border=True):
    """A dhoti leg: full wrapped cloth at the top, drawn in below the knee to `bottom`, a
    coloured border at its edge, a bare shin and the foot. Tokens: pants, pantsDark, skin,
    border (when `border`)."""

    def leg(px, fx):
        out = stroke(f"M{fx} {bottom - 12} L{fx} 388", "{skin}", 14) + foot(fx)
        out += stroke(f"M{px} 274 L{fx} 330", "{pants}", 36) + fill(
            f"M{fx - 18} 300 L{fx + 18} 300 L{fx + 15} {bottom} Q{fx} {bottom + 6} {fx - 15} {bottom} Z", "{pants}"
        )
        if border:
            out += line(f"M{fx - 14} {bottom - 6} Q{fx} {bottom} {fx + 14} {bottom - 6}", 3, "{border}")
        out += line(f"M{fx - 12} 304 Q{fx - 4} 324 {fx + 1} 350", 2.5, "{pantsDark}") + line(
            f"M{fx + 6} 304 Q{fx + 11} 322 {fx + 10} 342", 2.5, "{pantsDark}"
        )
        return out

    return leg


def pyjama(foot=jutti):
    """A loose pyjama leg, full at the thigh, gathered a little at the ankle, a bare ankle and
    the foot. Tokens: pants, pantsDark, skin."""

    def leg(px, fx):
        return (
            stroke(f"M{fx} 372 L{fx} 388", "{skin}", 14)
            + foot(fx)
            + stroke(f"M{px} 274 L{fx} 330", "{pants}", 28)
            + fill(f"M{fx - 14} 300 L{fx + 14} 300 L{fx + 11} 378 Q{fx} 381 {fx - 11} 378 Z", "{pants}")
            + line(f"M{fx - 10} 372 Q{fx} 375 {fx + 10} 372", 2.5, "{pantsDark}")
            + line(f"M{fx + 6} 304 L{fx + 5} 366", 2.5, "{pantsDark}")
        )

    return leg


def churidar(foot=royal_jutti, gather="ankle"):
    """A tight churidar: easy at the thigh, close down the shin, bunched in rings of folds,
    `gather='ankle'` above a slipper or `'shin'` above a boot. Tokens: pants, pantsDark."""

    def leg(px, fx):
        if gather == "shin":
            out = stroke(f"M{px} 274 L{fx} 330", "{pants}", 28) + fill(
                f"M{fx - 14} 300 L{fx + 14} 300 L{fx + 11} 362 L{fx - 11} 362 Z", "{pants}"
            )
            for y in (316, 328, 338):
                out += line(f"M{fx - 9} {y} Q{fx} {y + 4} {fx + 9} {y}", 2.5, "{pantsDark}")
            out += line(f"M{fx + 6} 284 L{fx + 4} 306", 2.5, "{pantsDark}")
            return out + foot(fx)
        return (
            foot(fx)
            + stroke(f"M{px} 274 L{fx} 330", "{pants}", 26)
            + fill(f"M{fx - 13} 300 L{fx + 13} 300 L{fx + 10} 386 Q{fx} 388 {fx - 10} 386 Z", "{pants}")
            + "".join(
                line(f"M{fx - 9} {y} Q{fx} {y + 3} {fx + 9} {y}", 2.5, "{pantsDark}") for y in (352, 360, 368, 376)
            )
            + line(f"M{fx + 5} 304 L{fx + 4} 344", 2.5, "{pantsDark}")
        )

    return leg


def _skirt_half(px, fx, w, flare, bottom):
    """The lower half of a skirt on one leg, from the knee (y 300) to `bottom`: straight on
    the inside, where it runs past the middle under the other half, and flaring on the
    outside, so the two halves stand as one A-line skirt and part in a stride."""
    out = 1 if px > 100 else -1
    inner, outer = fx - out * w, fx + out * w
    return [(inner, 300), (outer, 300), (outer + out * flare, bottom), (inner, bottom)]


def _hem_band(pts, h):
    """The band along the bottom h units of a _skirt_half: a border."""
    (ix, _), (ox, _), (bx, by), _ = pts
    k = (by - h - 300) / (by - 300)
    return poly([(ix, by - h), (ox + (bx - ox) * k, by - h), (bx, by), (ix, by)])


def sari_skirt(foot=chappal, flare=7):
    """The skirt of a sari, half on each leg: cloth from the hip to the ankle, a little
    flared, with a border at the hem and the pleats down the near leg, so the knees bend
    inside it and it parts in a stride. Wear it under `sari()`. Tokens: sari, sariDark,
    border, borderDark."""

    def leg(px, fx):
        half = _skirt_half(px, fx, 22, flare, 388)
        out = foot(fx) + stroke(f"M{px} 274 L{fx} 330", "{sari}", 44) + fill(poly(half), "{sari}")
        if px > 100:
            for x0, x1 in ((-13, -15), (-5, -5.5), (3, 4), (11, 15)):
                out += line(f"M{fx + x0} 294 L{fx + x1} 370", 2.5, "{sariDark}")
        else:
            out += line(f"M{fx - 10} 292 L{fx - 13} 368", 2.5, "{sariDark}")
        out += fill(_hem_band(half, 14), "{border}")
        return out + line(
            f"M{f1(half[0][0])} 379 L{f1(half[2][0] - (1 if px > 100 else -1) * 3)} 379", 2, "{borderDark}"
        )

    return leg


def ghagra(foot=bare_foot, bottom=384, flare=16):
    """A ghagra (lehenga): a gathered skirt flaring from the hips to `bottom` with a border,
    half on each leg, scattered buti and gathers. Wear it under `choli()`. Tokens: skirt,
    skirtDark, skirtLight, border."""

    def leg(px, fx):
        half = _skirt_half(px, fx, 21, flare, bottom)
        out = foot(fx) + stroke(f"M{px} 274 L{fx} 330", "{skirt}", 42) + fill(poly(half), "{skirt}")
        side = 1 if px > 100 else -1
        for o in (-12, 0, 12):
            out += line(f"M{fx + o} 306 L{f1(fx + o + side * (o * side + 12) * 0.4)} {bottom - 16}", 2.5, "{skirtDark}")
        for dx, y in ((-7, 318), (7, 340), (-9, 356)):
            out += circle(fx + dx, y, 2.6, "{skirtLight}")
        return out + fill(_hem_band(half, 13), "{border}")

    return leg


# ================================================================ heads
# A head is (front, back). The front is three-quarter: hair and the ear on the far (left)
# side only, the face parts drawn separately. The back covers the face with hair or cloth.

SKIN = "<path d='M100 46 C128 46 150 66 150 98 C150 130 130 152 100 152 C72 152 52 132 52 102 C52 70 72 46 100 46 Z' fill='{skin}'/>"
SKIN_ROUND = "<path d='M100 46 C128 46 151 66 151 98 C151 132 131 155 100 155 C69 155 49 134 49 102 C49 70 72 46 100 46 Z' fill='{skin}'/>"
EAR = "<ellipse cx='58' cy='106' rx='11' ry='14' fill='{skin}'/>" + line("M61 99 Q54 104 58 112", 3, "{skinDark}")
EARS_BACK = "<ellipse cx='56' cy='106' rx='10' ry='14' fill='{skin}'/><ellipse cx='144' cy='106' rx='10' ry='14' fill='{skin}'/>"
EARS_WIDE = "<ellipse cx='55' cy='106' rx='10' ry='14' fill='{skin}'/><ellipse cx='145' cy='106' rx='10' ry='14' fill='{skin}'/>"
SIDEBURN = fill("M54 98 C54 90 60 84 70 82 C72 92 72 102 72 112 Q70 116 66 110 L64 100 C60 98 57 98 54 100 Z", "{hair}")
TEMPLE = fill("M54 98 C54 90 60 84 70 82 C72 92 72 100 72 108 Q70 112 66 106 L64 98 C60 96 57 97 54 100 Z", "{hair}")
BACK_OF_HEAD = "M50 108 C42 62 70 40 100 40 C130 40 158 62 150 108 C146 126 124 134 100 134 C76 134 54 126 50 108 Z"


def _locks(js, depth=9):
    d = ""
    for (x0, y0), (x1, y1) in itertools.pairwise(js):
        d += f"C{x0 - 3} {y0 + depth} {x1 + 3} {y1 + depth} {x1} {y1} "
    return d


def short_hair():
    """Short hair cut close with a side parting: a young man, a servant. Tokens: hair,
    hairLight, hairDark."""
    back_hair = fill("M60 126 C46 114 42 86 52 66 C64 46 90 40 110 44 L100 104 Z", "{hair}")
    cap = (
        "M48 98 C44 72 58 46 84 38 C112 30 144 34 152 52 C156 60 154 70 148 78 "
        "C140 72 128 70 118 72 C108 68 96 70 88 74 C80 76 75 82 73 92 L72 104 Q70 108 66 104 "
        "L64 94 C58 92 52 94 48 98 Z"
    )
    front = (
        back_hair
        + SKIN
        + EAR
        + fill(cap, "{hair}")
        + fill("M76 50 C90 42 108 40 124 43 C108 46 94 50 82 58 Z", "{hairLight}")
        + line("M120 38 Q112 50 116 66", 3, "{hairDark}")
    )
    back = (
        SKIN
        + EARS_BACK
        + fill(
            "M52 106 C44 64 70 42 100 42 C130 42 156 64 148 106 C144 122 124 128 100 128 C76 128 56 122 52 106 Z",
            "{hair}",
        )
        + fill("M68 58 C82 48 98 46 112 48 C96 52 84 58 74 68 Z", "{hairLight}")
    )
    return front, back


def side_part():
    """Fuller hair, neatly combed with a side parting and locks over the brow. Tokens: hair,
    hairLight, hairDark."""
    back_hair = fill("M60 128 C44 116 38 84 50 62 C62 42 90 38 110 44 L100 104 Z", "{hair}")
    cap = (
        "M46 98 C42 72 56 44 84 34 C112 26 146 30 154 50 C158 60 156 72 148 80 "
        + _locks([(148, 80), (132, 70), (112, 66), (92, 66), (74, 72)])
        + "C72 82 72 92 72 104 Q70 108 66 104 L64 92 C58 90 52 92 46 98 Z"
    )
    front = (
        back_hair
        + SKIN
        + EAR
        + fill(cap, "{hair}")
        + fill("M70 50 C84 42 104 40 120 44 C104 46 88 50 76 58 Z", "{hairLight}")
        + line("M118 34 Q108 46 112 62", 3, "{hairDark}")
    )
    back = (
        SKIN
        + EARS_BACK
        + fill(BACK_OF_HEAD, "{hair}")
        + fill("M66 58 C80 46 98 44 112 46 C96 50 82 56 72 66 Z", "{hairLight}")
    )
    return front, back


def spiky_hair():
    """Short hair standing up in spikes over the forehead, a cowlick on the crown: a boy, the
    youngest brother. Tokens: hair, hairLight."""
    back_hair = fill("M60 128 C44 116 38 84 50 62 C62 42 90 38 110 44 L100 104 Z", "{hair}")
    cap = (
        "M46 98 C42 72 54 46 78 34 "
        "L80 18 L92 31 L100 12 L110 30 L124 14 L126 34 L142 24 L140 42 "
        "C150 46 156 58 156 66 C156 72 154 78 152 82 "
        + _locks([(152, 82), (132, 72), (112, 68), (92, 68), (74, 74)], 8)
        + "C72 84 72 92 72 104 Q70 108 66 104 L64 92 C58 90 52 92 46 98 Z"
    )
    front = (
        back_hair
        + SKIN
        + EAR
        + fill(cap, "{hair}")
        + stroke("M74 44 C62 28 72 14 82 22", "{hair}", 9)
        + fill("M84 38 L96 26 L104 36 Q92 40 84 46 Z", "{hairLight}")
        + fill("M110 34 L122 22 L124 38 Q116 38 110 42 Z", "{hairLight}")
    )
    back = (
        SKIN
        + EARS_BACK
        + fill(
            "M50 108 C42 70 56 46 74 40 L76 22 L90 34 L100 14 L110 34 L124 22 L126 40 C144 46 158 70 150 108 "
            "C146 126 124 134 100 134 C76 134 54 126 50 108 Z",
            "{hair}",
        )
        + stroke("M92 26 C84 12 98 4 104 14", "{hair}", 9)
        + fill("M66 62 C78 50 94 46 108 48 C94 52 82 58 72 70 Z", "{hairLight}")
    )
    return front, back


def _curls(points, r):
    return "".join(circle(x, y, r, "{hair}") for x, y in points)


def curly_hair():
    """Thick curly hair: a cap of round curls over the crown and a fringe of smaller ones
    along the forehead, curl marks in a lighter shade. Tokens: hair, hairLight."""
    base = (
        "M46 100 C40 70 56 42 86 34 C116 28 148 36 154 58 C156 68 152 76 146 80 "
        "C130 72 108 70 88 72 C80 74 74 80 72 92 L72 104 Q70 108 66 104 L64 94 C58 92 52 94 46 100 Z"
    )
    ring = [
        (50, 92),
        (48, 76),
        (54, 60),
        (64, 47),
        (78, 39),
        (94, 35),
        (110, 34),
        (125, 36),
        (138, 42),
        (148, 52),
        (153, 64),
    ]
    fringe = [(146, 76), (132, 70), (118, 68), (104, 68), (90, 70), (78, 76)]

    def marks(pts):
        return "".join(line(f"M{x - 4} {y + 1} Q{x} {y - 5} {x + 4} {y + 1}", 2.5, "{hairLight}") for x, y in pts)

    front = (
        fill("M60 128 C44 116 38 84 50 62 C62 42 90 38 110 44 L100 104 Z", "{hair}")
        + _curls([(54, 116), (48, 102)], 11)
        + SKIN
        + EAR
        + fill(base, "{hair}")
        + _curls(ring, 12)
        + _curls(fringe, 9)
        + marks([(70, 50), (96, 40), (122, 42), (60, 74), (110, 56), (86, 58), (140, 56)])
    )
    back_ring = [
        (48, 104), (46, 86), (52, 68), (62, 54), (76, 43), (92, 37), (108, 37), (124, 43), (138, 54),
        (148, 68), (154, 86), (152, 104), (60, 120), (80, 128), (100, 130), (120, 128), (140, 120),
    ]  # fmt: skip
    back = (
        SKIN
        + EARS_BACK
        + fill(BACK_OF_HEAD, "{hair}")
        + _curls(back_ring, 12)
        + marks([(80, 60), (104, 54), (124, 66), (70, 88), (100, 84), (130, 92), (86, 110), (114, 112)])
    )
    return front, back


def head_band():
    """Short hair under a cotton cloth tied round the head as a band, knotted at the back
    with two short ends hanging: a farmhand, a boatman. Tokens: hair, hairLight, band,
    bandLight, bandDark."""
    cap = (
        "M46 98 C42 72 56 46 82 38 C110 30 144 34 152 54 C156 62 154 70 150 76 "
        + _locks([(150, 76), (132, 72), (112, 70), (92, 70), (74, 74)], 6)
        + "C72 82 72 92 72 104 Q70 108 66 104 L64 92 C58 90 52 92 46 98 Z"
    )
    band = "M44 82 C60 62 100 52 140 56 C146 62 150 70 151 80 C110 72 72 80 50 100 Z"
    tails = fill("M48 84 C36 92 30 106 30 122 L42 120 C42 108 46 98 54 92 Z", "{band}") + fill(
        "M50 88 C44 100 44 112 48 126 L58 122 C54 110 56 100 60 94 Z", "{bandDark}"
    )
    knot = "<ellipse cx='50' cy='86' rx='11' ry='10' fill='{band}'/>"
    stripes = fill(ribbon((52, 80), (70, 66), (104, 60), (145, 65), 3), "{bandDark}") + fill(
        ribbon((54, 92), (72, 80), (106, 72), (148, 74), 3), "{bandLight}"
    )
    front = (
        tails
        + fill("M60 128 C44 116 38 84 50 62 C62 42 90 38 110 44 L100 104 Z", "{hair}")
        + SKIN
        + EAR
        + fill(cap, "{hair}")
        + fill("M80 44 C94 38 110 37 124 39 C110 42 96 46 86 52 Z", "{hairLight}")
        + fill(band, "{band}")
        + stripes
        + knot
    )
    back = (
        SKIN
        + EARS_BACK
        + fill(BACK_OF_HEAD, "{hair}")
        + fill("M68 52 C82 44 100 42 114 44 C98 48 84 54 74 62 Z", "{hairLight}")
        + fill("M48 78 C70 66 130 66 152 78 L152 96 C130 86 70 86 48 96 Z", "{band}")
        + line("M50 84 C72 74 128 74 150 84", 2.5, "{bandDark}")
        + fill("M96 90 C88 104 86 118 88 134 L100 132 C98 118 100 104 104 94 Z", "{band}")
        + fill("M102 92 C108 106 112 118 112 132 L122 128 C120 114 114 102 108 92 Z", "{bandDark}")
        + "<ellipse cx='100' cy='88' rx='11' ry='10' fill='{band}'/>"
    )
    return front, back


def pagdi():
    """A pagdi wound round the head, the wraps rising to the front and the loose end hanging
    at the back, hair at the temple: a village elder, a farmer. Tokens: turban, turbanLight,
    turbanDark, hair."""
    wrap = (
        "M42 92 C34 64 50 34 82 24 C112 16 146 24 156 46 C160 56 158 68 152 78 "
        "C128 70 100 70 78 78 C68 82 60 90 56 100 Z"
    )
    folds = (
        fill(ribbon((48, 84), (70, 62), (110, 52), (155, 57), 3.5, 2.5), "{turbanDark}")
        + fill(ribbon((44, 68), (64, 44), (104, 34), (146, 35), 3.5, 2.5), "{turbanDark}")
        + fill(ribbon((60, 94), (80, 76), (116, 68), (153, 71), 3, 2.5), "{turbanDark}")
    )
    crown = fill("M70 34 C88 24 114 22 132 28 C112 30 92 34 78 42 Z", "{turbanLight}")
    tail = fill("M56 80 C40 92 34 110 38 130 L52 128 C50 114 54 102 64 94 Z", "{turbanDark}")
    front = tail + SKIN + EAR + TEMPLE + fill(wrap, "{turban}") + folds + crown
    back = (
        SKIN
        + EARS_BACK
        + fill("M48 92 C46 104 50 112 58 116 C62 108 64 100 64 94 Z", "{hair}")
        + fill("M152 92 C154 104 150 112 142 116 C138 108 136 100 136 94 Z", "{hair}")
        + fill("M92 90 C84 104 82 122 86 140 L102 140 C100 122 102 106 108 92 Z", "{turbanDark}")
        + fill("M40 96 C30 60 60 22 100 20 C140 22 170 60 160 96 C130 88 70 88 40 96 Z", "{turban}")
        + fill(ribbon((46, 80), (70, 62), (130, 60), (156, 76), 3.5), "{turbanDark}")
        + fill(ribbon((52, 60), (76, 40), (124, 38), (148, 56), 3.5), "{turbanDark}")
        + fill("M80 30 C94 24 112 24 124 28 C108 30 94 34 86 40 Z", "{turbanLight}")
    )
    return front, back


def tall_pagdi():
    """A pagdi wound high into a tall dome that leans a little back, the wraps rising to the
    front, a fold of the cloth tucked over the top: a poet, a minister. Tokens: turban,
    turbanLight, turbanDark, turbanEdge (the rim; defaults to turbanDark), hair."""
    pag = (
        "M40 102 C28 74 28 36 52 18 C72 4 108 0 134 8 C158 18 168 44 162 72 "
        "C160 78 157 82 153 84 C130 70 104 66 84 71 C70 76 60 88 56 104 Z"
    )
    rim = ribbon((56, 101), (64, 82), (104, 66), (154, 80), 9, 7)
    wraps = (
        fill(ribbon((40, 84), (60, 56), (108, 46), (161, 60), 4, 3), "{turbanDark}")
        + fill(ribbon((34, 60), (52, 34), (100, 22), (152, 30), 4, 3), "{turbanDark}")
        + fill(ribbon((50, 34), (68, 14), (106, 8), (136, 12), 3.5, 2.5), "{turbanDark}")
    )
    crown = fill("M58 30 C74 16 100 10 122 12 C100 18 80 26 66 40 Z", "{turbanLight}")
    tuck = fill("M116 10 C130 2 152 10 156 28 C150 22 136 18 120 22 Z", "{turban}") + line(
        "M122 14 C134 10 146 16 150 24", 2.5, "{turbanDark}"
    )
    front = SKIN + EAR + SIDEBURN + fill(pag, "{turban}") + fill(rim, "{turbanEdge}") + wraps + crown + tuck
    back = (
        SKIN
        + EARS_BACK
        + fill("M58 104 Q100 148 142 104 L142 114 Q100 158 58 114 Z", "{hair}")
        + fill(
            "M36 104 C24 66 38 18 76 8 C92 4 110 4 126 8 C164 18 176 66 164 104 C140 118 120 124 100 124 C80 124 60 118 36 104 Z",
            "{turban}",
        )
        + fill(ribbon((38, 100), (66, 116), (134, 116), (162, 100), 9, 9), "{turbanEdge}")
        + fill(ribbon((32, 72), (66, 58), (134, 58), (168, 72), 4, 4), "{turbanDark}")
        + fill(ribbon((38, 46), (70, 32), (130, 32), (162, 46), 4, 4), "{turbanDark}")
        + fill(ribbon((60, 22), (82, 12), (118, 12), (140, 22), 3.5, 3.5), "{turbanDark}")
        + fill("M70 22 C86 14 104 12 118 14 C102 18 88 22 78 30 Z", "{turbanLight}")
    )
    return front, back


def _fan(cx, cy, r, a0, a1, n=5):
    """A pleated fan of stiff cloth (a turra) from (cx, cy) out to radius r between angles
    a0..a1 (degrees, 0 = right, -90 = up), the pleats as lines from the root."""
    pts = [(cx, cy)]
    for i in range(n * 2 + 1):
        a = math.radians(a0 + (a1 - a0) * i / (n * 2))
        rr = r if i % 2 == 0 else r - 3
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    out = fill(poly(pts), "{turban}")
    for i in range(1, n):
        a = math.radians(a0 + (a1 - a0) * i / n)
        out += line(
            f"M{f1(cx + math.cos(a) * 12)} {f1(cy + math.sin(a) * 12)} "
            f"L{f1(cx + math.cos(a) * (r - 6))} {f1(cy + math.sin(a) * (r - 6))}",
            2.5,
            "{turbanDark}",
        )
    return out


def safa(fan=True, jewel=True):
    """A safa tied tight and broad, the wraps crossing over the brow, a stiff fan of the
    cloth's end standing up at the back and a jewel at the front: a guard, a soldier, a
    groom. Tokens: turban, turbanLight, turbanDark, hair, gold, gem."""
    tail = fill("M50 84 C36 96 32 114 36 132 L50 130 C48 116 52 104 60 96 Z", "{turbanDark}")
    pag = (
        "M40 98 C30 70 38 36 66 22 C92 10 128 12 148 28 C162 40 164 58 158 76 "
        "C156 80 153 82 150 82 C128 72 102 68 82 74 C68 78 60 88 56 100 Z"
    )
    wraps = (
        fill(ribbon((44, 88), (64, 66), (110, 56), (160, 64), 5, 4), "{turbanDark}")
        + fill(ribbon((42, 64), (58, 42), (104, 32), (154, 42), 5, 4), "{turbanDark}")
        + fill(ribbon((60, 96), (78, 80), (114, 70), (152, 80), 4, 3.5), "{turbanLight}")
    )
    gemmed = (
        fill("M124 68 C120 58 124 50 130 46 C136 50 140 58 136 68 Z", "{gold}") + circle(130, 60, 4, "{gem}")
        if jewel
        else ""
    )
    front = (
        (_fan(78, 46, 44, -160, -95) if fan else "")
        + tail
        + SKIN
        + EAR
        + SIDEBURN
        + fill(pag, "{turban}")
        + wraps
        + gemmed
    )
    back = (
        SKIN
        + EARS_BACK
        + fill("M60 100 Q100 136 140 100 L141 110 Q100 144 59 110 Z", "{hair}")
        + (_fan(100, 40, 38, -125, -55) if fan else "")
        + fill("M92 104 C84 116 82 130 86 144 L102 144 C100 130 102 118 108 106 Z", "{turbanDark}")
        + fill(
            "M36 100 C26 60 54 24 100 22 C146 24 174 60 164 100 C140 114 120 120 100 120 C80 120 60 114 36 100 Z",
            "{turban}",
        )
        + fill(ribbon((40, 80), (70, 64), (130, 64), (160, 80), 5, 5), "{turbanDark}")
        + fill(ribbon((46, 56), (74, 40), (126, 40), (154, 56), 5, 5), "{turbanDark}")
    )
    return front, back


def plumed_turban(beard=True):
    """A king's or noble's safa with a white kalgi plume rising from a ruby jewel hung with
    pearls; a short trimmed beard round the jaw. Tokens: turban, turbanLight, turbanDark,
    plume, plumeDark, hair, hairLight, gold, ruby, pearl."""
    tail = fill("M54 78 C40 92 34 116 38 136 L52 134 C50 116 54 100 64 90 Z", "{turbanDark}")
    safa_ = (
        "M42 92 C34 62 52 30 86 20 C118 12 150 24 158 50 C162 60 160 72 154 82 "
        "C130 72 100 72 78 80 C66 84 58 92 54 100 Z"
    )
    top = fill(safa_, "{turban}")
    top += fill(ribbon((48, 84), (70, 60), (112, 50), (156, 56), 4, 3), "{turbanDark}")
    top += fill(ribbon((44, 66), (62, 42), (102, 30), (146, 34), 4, 3), "{turbanDark}")
    top += fill(ribbon((60, 94), (80, 76), (116, 68), (154, 72), 3.5, 3), "{turbanDark}")
    top += fill("M70 32 C88 22 116 20 134 26 C112 28 92 32 78 40 Z", "{turbanLight}")
    top += fill(taper((114, 48), (114, 22), (110, 4), (86, 8), 13, 4), "{plume}") + fill(
        taper((112, 44), (110, 26), (104, 12), (92, 10), 3, 2), "{plumeDark}"
    )
    top += (
        fill("M104 52 Q114 38 124 52 Q114 64 104 52 Z", "{gold}")
        + gem(114, 52, 5, "{ruby}")
        + circle(108, 66, 3, "{pearl}")
        + circle(114, 69, 3, "{pearl}")
        + circle(120, 66, 3, "{pearl}")
    )
    jaw = ""
    if beard:
        jaw = fill(
            "M66 94 L74 94 C72 108 72 122 78 132 C86 142 94 146 103 146 C114 146 124 142 132 134 "
            "C137 124 139 112 141 100 L147 102 C150 118 148 134 142 146 C134 158 120 164 104 164 "
            "C88 164 74 158 66 146 C60 130 60 110 66 94 Z",
            "{hair}",
        ) + line("M84 154 Q94 160 104 160", 2.5, "{hairLight}")
    front = tail + SKIN + EAR + circle(57, 121, 3.5, "{gold}") + TEMPLE + jaw + top
    back_top = fill("M40 96 C30 60 60 18 100 16 C140 18 170 60 160 96 C130 88 70 88 40 96 Z", "{turban}")
    back_top += fill(ribbon((46, 80), (70, 62), (130, 60), (156, 76), 4), "{turbanDark}")
    back_top += fill(ribbon((52, 58), (76, 38), (124, 36), (148, 54), 4), "{turbanDark}")
    back_top += fill(taper((100, 20), (98, 12), (94, 6), (84, 4), 8, 3), "{plume}")
    back = (
        SKIN
        + EARS_WIDE
        + (
            fill("M52 112 C52 134 62 150 74 158 L80 142 Z M148 112 C148 134 138 150 126 158 L120 142 Z", "{hair}")
            if beard
            else ""
        )
        + fill("M92 92 C86 108 86 124 90 142 L106 142 C104 124 104 110 110 94 Z", "{turban}")
        + line("M98 100 Q95 120 98 138", 2.5, "{turbanDark}")
        + back_top
    )
    return front, back


def _kundala(x, y):
    """A gold ear-stud with a hanging gold drop."""
    return (
        circle(x, y, 5, "{gold}")
        + fill(f"M{x - 4} {y + 4} Q{x} {y + 16} {x + 4} {y + 4} Z", "{gold}")
        + circle(x, y, 2.2, "{ruby}")
    )


def _cone_half(y):
    return max(4.0, 42 * ((y - 6) / 64) ** 0.62)


def _tier(y, h, gems=True):
    hw = _cone_half(y)
    out = fill(
        ribbon((100 - hw, y + 2), (100 - hw / 3, y - 2), (100 + hw / 3, y - 2), (100 + hw, y + 2), h), "{goldDark}"
    )
    if gems:
        n = max(2, int(hw * 2 / 11))
        for i in range(n + 1):
            u = -0.8 + 1.6 * i / n
            out += circle(
                100 + u * hw, y + 2 - 3 * (1 - u * u) + 0.5, h * 0.42, "{ruby}" if i % 2 == 0 else "{emerald}"
            )
    return out


def _kireeta(front=True):
    out = fill("M58 72 C58 50 78 24 94 9 Q100 4 106 9 C122 24 142 50 142 72 Z", "{gold}")
    for x0, x1 in ((76, 92), (88, 97), (124, 108), (112, 103)):
        out += line(f"M{x0} 66 L{x1} 18", 2.5, "{goldDark}")
    out += fill("M66 66 C66 50 76 32 90 16 C84 34 78 50 76 66 Z", "{goldLight}")
    out += _tier(58, 7) + _tier(38, 6) + _tier(22, 5, gems=False)
    out += ellipse(100, 12, 5.5, 9, "{gold}") + fill("M93 16 Q100 23 107 16 Q100 19 93 16 Z", "{goldDark}")
    out += circle(100, 4, 2.6, "{ruby}")
    out += fill("M48 68 Q100 57 152 68 L153 85 Q100 77 47 85 Z", "{gold}")
    out += fill(ribbon((47, 71.5), (80, 63), (120, 63), (153, 71.5), 2.6), "{goldDark}")
    out += fill(ribbon((46, 81.5), (80, 74), (120, 74), (154, 81.5), 2.6), "{goldDark}")
    if front:
        for x, col, r in (
            (56, "{emerald}", 3.4),
            (73, "{ruby}", 4),
            (91, "{emerald}", 4.2),
            (125, "{emerald}", 4.2),
            (142, "{ruby}", 3.8),
        ):
            k = 0.55 + 0.45 * math.cos((x - 104) / 56 * 1.3)
            out += gem(x, 71.5 + 5 * ((x - 100) / 55) ** 2, r, col, sx=k)
        for a in range(0, 360, 45):
            ra = math.radians(a)
            out += ellipse(106 + math.cos(ra) * 9, 47 + math.sin(ra) * 9, 4.2, 4.2, "{goldLight}")
        out += gem(106, 47, 7, "{ruby}") + gem(107, 72, 5.5, "{ruby}")
    else:
        for x in (62, 82, 100, 118, 138):
            out += circle(x, 75 + 5 * ((x - 100) / 55) ** 2, 3, "{ruby}")
    return out


def crown():
    """A king's kireeta: a tall pointed gold cone in jewelled tiers on a jewelled band, a
    lotus-bud finial; black hair to the nape, gold kundalas in the ears, a round face.
    Tokens: gold, goldLight, goldDark, ruby, emerald, hair, hairLight."""
    hair_back = fill("M58 80 C44 98 44 128 56 148 C62 156 72 156 74 148 L70 92 Z", "{hair}")
    temple = fill("M144 82 C152 92 153 104 149 114 C146 106 143 98 140 92 Z", "{hair}")
    chin = line("M86 148 Q100 154 114 148", 2.5, "{skinDark}")
    front = hair_back + SKIN_ROUND + EAR + _kundala(57, 122) + temple + chin + _kireeta(True)
    back = (
        SKIN_ROUND
        + EARS_WIDE
        + _kundala(54, 122)
        + _kundala(146, 122)
        + fill(
            "M50 82 C46 110 50 136 60 152 Q70 160 80 154 Q90 162 100 156 Q110 162 120 154 Q130 160 140 152 "
            "C150 136 154 110 150 82 Z",
            "{hair}",
        )
        + "".join(
            line(d, 2.5, "{hairLight}")
            for d in (
                "M66 92 Q62 120 68 146",
                "M84 92 Q82 122 86 150",
                "M100 92 L100 150",
                "M116 92 Q118 122 114 150",
                "M134 92 Q138 120 132 146",
            )
        )
        + _kireeta(False)
    )
    return front, back


# ---------------------------------------------------------------- women's hair
# Parted in the middle and combed back smooth over the ear. A plait is a part of its own,
# hung from the head (`hangs`) so it swings; such a head returns (front, back, hung), and
# person() adds the hung parts with their hangs and springs.

_LONG_BACK = fill("M64 142 C46 132 40 102 46 76 C54 50 80 38 104 40 L100 110 Z", "{hair}")
_PARTED = fill(
    "M48 104 C42 74 58 46 86 38 C112 32 140 38 150 58 C156 70 156 84 152 98 Q149 102 147 97 "
    "C144 78 130 62 106 56 C90 60 78 72 74 90 C73 96 72 100 70 104 L64 100 C58 98 52 100 48 104 Z",
    "{hair}",
)
_PARTING = line("M106 56 Q100 47 92 41", 2.5, "{skin}")
_SHEEN = fill("M60 64 C70 50 84 43 98 42 C86 48 74 56 66 70 Z", "{hairLight}") + fill(
    "M118 45 C132 47 142 55 146 66 C138 60 128 54 118 50 Z", "{hairLight}"
)
_DOME = fill(
    "M52 112 C44 66 70 40 100 40 C130 40 156 66 148 112 C144 130 124 142 100 144 C76 142 56 130 52 112 Z", "{hair}"
)


def _jhumka(x, y):
    """An earring: a stud and a little bell-shaped drop. Token: earring (gold)."""
    return circle(x, y, 2.5, "{earring}") + fill(f"M{x - 5.5} {y + 10} Q{x} {y - 1} {x + 5.5} {y + 10} Z", "{earring}")


def _woman_front(earrings):
    return SKIN + _PARTED + _PARTING + _SHEEN + EAR + (_jhumka(57, 122) if earrings else "")


def _woman_back(earrings, dome=_DOME):
    ears = _jhumka(54, 120) + _jhumka(146, 120) if earrings else ""
    return SKIN + EARS_BACK + ears + dome + fill("M64 62 C74 50 88 44 100 44 C88 50 78 58 70 70 Z", "{hairLight}")


def _braid(top, bottom, w0, w1, n):
    """A plait from `top` to `bottom`, w0 wide narrowing to w1: the edges bulge a little at
    each crossing, a strand line runs across each one, alternately."""
    (x0, y0), (x1, y1) = top, bottom

    def c(k):
        u = k / n
        return x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, (w0 + (w1 - w0) * u) / 2

    R = [(x + hw, y) for x, y, hw in map(c, range(n + 1))]
    L = [(x - hw, y) for x, y, hw in map(c, range(n + 1))]
    d = f"M{f1(L[0][0])} {f1(L[0][1])} L{f1(R[0][0])} {f1(R[0][1])}"
    for k in range(1, n + 1):
        out = 1.0 + (k % 2) * 1.5
        d += f" Q{f1((R[k - 1][0] + R[k][0]) / 2 + out)} {f1((R[k - 1][1] + R[k][1]) / 2)} {f1(R[k][0])} {f1(R[k][1])}"
    d += f" L{f1(L[n][0])} {f1(L[n][1])}"
    for k in range(n, 0, -1):
        out = 1.0 + (k % 2) * 1.5
        d += f" Q{f1((L[k - 1][0] + L[k][0]) / 2 - out)} {f1((L[k - 1][1] + L[k][1]) / 2)} {f1(L[k - 1][0])} {f1(L[k - 1][1])}"
    s = fill(d + " Z", "{hair}")
    seg = (y1 - y0) / n
    for k in range(1, n):
        x, y, hw = c(k)
        if k % 2:
            s += line(
                f"M{f1(x - hw)} {f1(y)} Q{f1(x + hw * 0.05)} {f1(y + seg * 0.55)} {f1(x + hw * 0.25)} {f1(y + seg * 0.9)}",
                2.5,
                "{hairDark}",
            )
        else:
            s += line(
                f"M{f1(x + hw)} {f1(y)} Q{f1(x - hw * 0.05)} {f1(y + seg * 0.55)} {f1(x - hw * 0.25)} {f1(y + seg * 0.9)}",
                2.5,
                "{hairDark}",
            )
    return s


def _tassel(x, y):
    """A plait's end: a tie, a tuft of hair and a tasselled parandi. Tokens: tie (ruby),
    trim (gold)."""
    return (
        fill(f"M{x - 7} {y + 4} Q{x} {y + 26} {x + 7} {y + 4} Z", "{hair}")
        + f"<rect x='{f1(x - 8)}' y='{f1(y - 7)}' width='16' height='10' rx='3' fill='{{tie}}'/>"
        + fill(f"M{x - 3} {y + 4} L{x + 3} {y + 4} L{x + 6} {y + 26} Q{x} {y + 30} {x - 6} {y + 26} Z", "{tie}")
        + circle(x, y + 27, 3.5, "{trim}")
    )


def _bow(x, y):
    """A ribbon bow at a plait's end: two loops and the knot. Token: ribbon (ruby)."""
    return (
        fill(
            f"M{x} {y} C{x - 6} {y - 10} {x - 16} {y - 6} {x - 13} {y + 2} C{x - 11} {y + 8} {x - 4} {y + 4} {x} {y} Z",
            "{ribbon}",
        )
        + fill(
            f"M{x} {y} C{x + 6} {y - 10} {x + 16} {y - 6} {x + 13} {y + 2} C{x + 11} {y + 8} {x + 4} {y + 4} {x} {y} Z",
            "{ribbon}",
        )
        + fill(f"M{x - 4} {y - 4} L{x - 7} {y + 14} L{x} {y + 11} Z", "{ribbon}")
        + fill(f"M{x + 4} {y - 4} L{x + 7} {y + 14} L{x} {y + 11} Z", "{ribbon}")
        + circle(x, y, 3.2, "{ribbonDark}")
    )


def bun(gajra=True, veil=False, earrings=True):
    """Hair parted in the middle, combed back to a low bun at the nape, with `gajra` a string
    of jasmine round it; with `veil` the pallu of the sari drawn over the head (ghunghat) with
    its border framing the face. Tokens: hair, hairLight, hairDark, gajra (white), earring
    (gold); with a veil also veil (defaults to sari), veilDark, border (gold)."""
    knot = circle(47, 122, 18, "{hair}") + line("M47 110 Q60 116 52 128 Q42 134 36 124", 2.5, "{hairDark}")
    if gajra:
        knot += "".join(
            circle(x, y, 3.2, "{gajra}") for x, y in ((31, 122), (32, 115), (35, 109), (40.5, 105), (47, 103.5))
        )
    # Under a veil the cloth hides the bun from the front.
    front = ("" if veil else knot) + _LONG_BACK + _woman_front(earrings)
    knot_b = circle(100, 126, 20, "{hair}") + line("M100 112 Q114 118 108 132 Q98 140 88 130", 2.5, "{hairDark}")
    if gajra:
        knot_b += "".join(
            circle(x, y, 3.2, "{gajra}")
            for x, y in ((81, 120), (85, 112), (92, 107), (100, 105.5), (108, 107), (115, 112), (119, 120))
        )
    back = (
        _woman_back(earrings)
        + line("M72 54 Q84 92 92 116", 2.5, "{hairDark}")
        + line("M128 54 Q116 92 108 116", 2.5, "{hairDark}")
        + line("M100 46 L100 108", 2.5, "{hairDark}")
        + knot_b
    )
    if veil:
        # The border as filled bands, not a stroke: it is the cloth's edge, not a line on the face.
        edge = "".join(
            fill(ribbon(*seg, 5), "{border}")
            for seg in (
                ((158, 74), (150, 60), (130, 50), (104, 50)),
                ((104, 50), (84, 52), (70, 62), (64, 82)),
                ((64, 82), (60, 98), (61, 122), (70, 152)),
            )
        )
        front += fill(
            "M38 152 C30 120 34 72 60 48 C84 30 126 30 147 44 C157 52 161 62 158 74 "
            "C150 60 130 50 104 50 C84 52 70 62 64 82 C60 98 61 122 70 152 Z",
            "{veil}",
        )
        front += line("M48 140 Q42 104 56 72", 2.5, "{veilDark}") + edge
        back += fill("M44 164 C34 120 42 52 100 38 C158 52 166 120 156 164 Q100 176 44 164 Z", "{veil}")
        back += line("M72 62 Q66 110 70 158", 2.5, "{veilDark}") + line("M128 62 Q134 110 130 158", 2.5, "{veilDark}")
        back += stroke("M44 162 Q100 174 156 162", "{border}", 5)
    return front, back


def plait(earrings=True):
    """Hair parted in the middle into one long plait down the back with a tasselled tie: it
    swings as she walks, hangs over the far shoulder from in front and down the middle of
    the back from behind. Tokens: hair, hairLight, hairDark, earring (gold), tie (ruby),
    trim (gold)."""
    front = _LONG_BACK + _woman_front(earrings)
    back = (
        _woman_back(earrings)
        + line("M72 54 Q82 100 96 138", 2.5, "{hairDark}")
        + line("M128 54 Q118 100 104 138", 2.5, "{hairDark}")
    )
    hung = {
        "parts": {
            "plait": {
                "default": _braid((60, 112), (50, 236), 22, 12, 9) + _tassel(50, 236),
                "back": stroke("M62 118 L94 150", "{hair}", 20)
                + _braid((100, 138), (100, 238), 22, 12, 7)
                + _tassel(100, 238),
            }
        },
        "hangs": {"plait": {"from": "head", "at": [60, 124]}},
        "springs": ["plait"],
    }
    return front, back, hung


def two_plaits(earrings=False):
    """A girl's two plaits, one each side from behind the ears to the shoulders, each tied
    with a ribbon bow; both swing. Tokens: hair, hairLight, hairDark, ribbon (ruby), earring
    (gold) when `earrings`."""
    front = _LONG_BACK + _woman_front(earrings)
    back = _woman_back(earrings) + line("M100 44 L100 132", 2.5, "{hairDark}")
    hung = {
        "parts": {
            "plaitL": _braid((54, 114), (44, 200), 18, 11, 6) + _bow(44, 200),
            "plaitR": _braid((144, 114), (154, 200), 18, 11, 6) + _bow(154, 200),
        },
        "hangs": {"plaitL": {"from": "head", "at": [54, 120]}, "plaitR": {"from": "head", "at": [144, 120]}},
        "springs": ["plaitL", "plaitR"],
    }
    return front, back, hung


# ================================================================ face, eyes, mouth
CHEEKS = "<circle cx='78' cy='119' r='7' fill='{cheek}' opacity='0.35'/><circle cx='122' cy='119' r='7' fill='{cheek}' opacity='0.35'/>"
NOSES = {
    "plain": line("M103 103 Q116 112 105 119", 3.5) + line("M98 118 Q100 120 104 119", 3),
    "big": line("M103 101 Q118 112 106 120", 3.8) + line("M97 118 Q100 121 105 120", 3),
    "small": line("M103 105 Q113 112 104 117", 3) + line("M99 117 Q101 118.5 104 117", 2.5),
}

MOUSTACHES = {
    # A small neat moustache: a young man.
    "small": fill(
        "M100 121 C107 119 114 120 117 124 C118 127 116 128 113 126 C109 124 105 124 101 125 "
        "C97 124 93 124 89 126 C86 128 84 127 85 124 C88 120 95 119 100 121 Z",
        "{hair}",
    ),
    # A trimmed moustache, a little fuller: a nobleman, a merchant.
    "trim": fill(
        "M100 120 C108 117 118 118 124 124 C126 128 123 130 120 128 C114 125 106 125 101 127 "
        "C96 125 88 125 82 128 C79 130 76 128 78 124 C84 118 92 117 100 120 Z",
        "{hair}",
    ),
    # A bushy moustache with the tips turned down and in: Tenali Rama.
    "bushy": fill(
        "M100 117 C112 113 127 116 134 124 C138 129 139 136 135 140 C131 134 122 129 109 129 "
        "C105 129 102 130 100 131 C98 130 95 129 91 129 C78 129 69 134 65 140 C61 136 62 129 66 124 "
        "C73 116 88 113 100 117 Z",
        "{hair}",
    )
    + stroke("M134 138 C138 134 139 128 136 124", "{hair}", 5)
    + stroke("M66 138 C62 134 61 128 64 124", "{hair}", 5)
    + line("M84 121 Q91 119 97 122", 2, "{hairLight}")
    + line("M103 122 Q110 119 117 121", 2, "{hairLight}"),
    # A big moustache curled up at both ends: a guard, a wrestler.
    "big": fill(
        "M100 116 C114 112 130 116 138 124 C144 120 146 112 142 106 C150 110 152 122 146 130 "
        "C140 136 130 134 122 130 C114 128 106 128 100 130 C94 128 86 128 78 130 C70 134 60 136 54 130 "
        "C48 122 50 110 58 106 C54 112 56 120 62 124 C70 116 86 112 100 116 Z",
        "{hair}",
    )
    + line("M82 121 Q91 118 98 121", 2, "{hairLight}")
    + line("M102 121 Q109 118 118 121", 2, "{hairLight}"),
    # A thick moustache sweeping out and curling up: a king.
    "curled": fill(taper((102, 121), (114, 116), (130, 126), (131, 110), 11, 4), "{hair}")
    + fill(taper((98, 121), (86, 116), (70, 126), (69, 110), 11, 4), "{hair}")
    + circle(129, 110, 3, "{hair}")
    + circle(71, 110, 3, "{hair}"),
    # A full drooping moustache with the hairs marked: an old man.
    "full": fill(
        "M100 119 C110 117 122 119 128 127 C130 132 128 138 124 140 C122 134 116 129 106 128 C103 128 101 129 100 130 "
        "C99 129 97 128 94 128 C84 129 78 134 76 140 C72 138 70 132 72 127 C78 119 90 117 100 119 Z",
        "{hair}",
    )
    + line("M86 124 Q92 122 98 124", 2, "{hairDark}")
    + line("M102 124 Q108 122 114 124", 2, "{hairDark}"),
}

TILAK = {
    # The Vaishnava namam: a white U with a red line up the middle. Tokens: tilak, tilakRed.
    "namam": stroke("M91.5 72 L93.5 86 Q100 96 106.5 86 L108.5 72", "{tilak}", 6)
    + stroke("M100 73 L100 90", "{tilakRed}", 4),
    # A round red dot (a bindi or a tilak). Token: tilakRed.
    "dot": circle(100, 84, 4, "{tilakRed}"),
    # Three horizontal lines of ash with a red dot (tripundra). Tokens: tilak, tilakRed.
    "tripundra": "".join(stroke(f"M86 {y} Q100 {y - 2} 114 {y}", "{tilak}", 3) for y in (74, 80, 86))
    + circle(100, 80, 2.6, "{tilakRed}"),
    # A woman's small bindi. Token: bindi (defaults to tilakRed).
    "bindi": circle(100, 80, 3.2, "{bindi}"),
}

# Round wire spectacles. Token: glasses (defaults to line).
GLASSES = (
    "<circle cx='84' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/>"
    "<circle cx='116' cy='100' r='13' fill='none' stroke='{glasses}' stroke-width='2.5'/>"
    + line("M97 99 Q100 96 103 99", 2.5, "{glasses}")
    + line("M71 98 L62 96", 2.5, "{glasses}")
)
# A nose ring (nath) at the near nostril with a pearl. Tokens: gold, pearl.
NATH = "<circle cx='107.5' cy='118.5' r='3.6' fill='none' stroke='{gold}' stroke-width='1.6'/>" + circle(
    105, 121.5, 1.4, "{pearl}"
)


def face(
    moustache=None, tilak=None, nose="plain", crease=False, wrinkles=False, cheeks=True, nath=False, glasses=False
):
    """The face part: cheeks, a nose, and what makes the face (a moustache from MOUSTACHES,
    a tilak or bindi from TILAK, smile creases for a stern man, wrinkles for an old one, a
    nose ring, glasses). Tokens: cheek, hair (moustache), skinDark (crease, wrinkles)."""
    out = ""
    if wrinkles:
        out += (
            line("M68 108 Q65 104 67 99", 2.2, "{skinDark}")
            + line("M132 108 Q135 104 133 99", 2.2, "{skinDark}")
            + line("M78 112 Q84 115 90 112", 2.2, "{skinDark}")
            + line("M110 112 Q116 115 122 112", 2.2, "{skinDark}")
            + line("M84 80 Q100 76 116 80", 2.2, "{skinDark}")
        )
    if cheeks:
        out += CHEEKS
    if crease:
        out += line("M70 112 Q66 120 70 128", 2.2, "{skinDark}") + line("M130 112 Q134 120 130 128", 2.2, "{skinDark}")
    if tilak:
        out += TILAK[tilak]
    out += NOSES[nose]
    if nath:
        out += NATH
    if moustache:
        out += MOUSTACHES[moustache]
    if glasses:
        out += GLASSES
    return out


def _eyeball(cx, cy, rx, ry, ix, iy, ir, hl=2.0, twinkle=False):
    s = (
        f"<ellipse cx='{f1(cx)}' cy='{f1(cy)}' rx='{f1(rx)}' ry='{f1(ry)}' fill='#fff'/>"
        + circle(ix, iy, ir, "{iris}")
        + circle(ix + 2, iy - 2.5, hl, "#fff")
    )
    if twinkle:
        s += circle(ix - 2, iy + 2.2, 1.1, "#fff")
    return s


def _lid(cx, cy, rx, ry, cut, slant=0.0):
    """A heavy upper lid: skin over the top of the eye white down to `cut` from its top,
    `slant` tilting the edge (positive drops it toward the nose, a frown)."""
    xa = rx * math.sqrt(max(0, 1 - ((ry - cut) / ry) ** 2))
    y = cy - ry + cut
    yl, yr = y - slant, y + slant
    return fill(
        f"M{f1(cx - xa - 1)} {f1(yl)} L{f1(cx - xa - 1)} {f1(cy - ry - 2)} L{f1(cx + xa + 1)} {f1(cy - ry - 2)} L{f1(cx + xa + 1)} {f1(yr)} Z",
        "{skin}",
    ) + line(f"M{f1(cx - xa - 1)} {f1(yl)} L{f1(cx + xa + 1)} {f1(yr)}", 2.5)


# Each look: the brows at rest, happy and closed (left, right), and how the open eye sits.
LOOKS = {
    # Brows lifted at the middle: mild, eager to please.
    "eager": {
        "rest": ("M75 88 Q83 84 93 83", "M107 83 Q117 84 125 88"),
        "happy": ("M75 84 Q83 79 93 82", "M107 82 Q117 79 125 84"),
        "closed": ("M75 87 Q83 82 93 85", "M107 85 Q117 82 125 87"),
        "eye": {},
    },
    # One brow cocked: a clever man's knowing look.
    "knowing": {
        "rest": ("M73 87 Q83 82 93 86", "M107 83 Q117 76 127 81"),
        "happy": ("M74 84 Q83 78 93 81", "M107 80 Q117 75 126 80"),
        "closed": ("M73 87 Q83 82 93 86", "M107 83 Q117 76 127 81"),
        "eye": {"hl": 2.6},
    },
    # Heavy lids and brows drawn down toward the nose: stern at rest.
    "stern": {
        "rest": ("M72 86 Q84 85 95 91", "M105 91 Q116 85 128 86"),
        "happy": ("M73 84 Q84 79 94 83", "M106 83 Q116 79 127 84"),
        "closed": ("M72 86 Q84 85 95 91", "M105 91 Q116 85 128 86"),
        "eye": {"cut": 5, "slant": 1.5, "hl": 1.8},
    },
    # Even arched brows: calm, assured.
    "plain": {
        "rest": ("M73 88 Q83 81 94 85", "M106 85 Q117 81 127 88"),
        "happy": ("M73 86 Q83 79 94 82", "M106 82 Q117 79 127 86"),
        "closed": ("M73 88 Q83 81 94 85", "M106 85 Q117 81 127 88"),
        "eye": {},
    },
    # Fine high arches and a softer eye: a woman, a girl.
    "gentle": {
        "rest": ("M75 86 Q84 80 93 83", "M107 83 Q116 80 125 86"),
        "happy": ("M75 83 Q84 77 93 80", "M107 80 Q116 77 125 83"),
        "closed": ("M75 86 Q84 80 93 83", "M107 83 Q116 80 125 86"),
        "eye": {"rx": 7.5, "ry": 9},
    },
    # Lids a little heavy, brows low at the outside: an old man.
    "old": {
        "rest": ("M72 90 Q80 81 94 84", "M106 84 Q120 81 128 90"),
        "happy": ("M74 84 Q83 77 93 81", "M107 81 Q117 77 126 84"),
        "closed": ("M72 90 Q80 81 94 84", "M106 84 Q120 81 128 90"),
        "eye": {"cut": 6},
    },
}


def eyes(look="plain", brow=6.5, twinkle=False, lashes=False):
    """The six eye variants the engine picks from (open, closed, wide, happy, sad, angry) for
    a look in LOOKS; `brow` is the brows' stroke width (4.5 a woman's, 5 young, 7.5 heavy),
    `twinkle` a second glint, `lashes` a flick at each outer corner. Tokens: iris (defaults
    to line), brow (defaults to hair), skin."""
    lk = LOOKS[look]

    def brows(pair, w=brow):
        return line(pair[0], w, "{brow}") + line(pair[1], w, "{brow}")

    def pair(dy=0, rx=8, ry=10, idx=2, idy=1.5, ir=5.5, hl=2.0, cut=None, slant=0.0):
        s = _eyeball(84, 100 + dy, rx, ry, 84 + idx, 100 + dy + idy, ir, hl, twinkle) + _eyeball(
            116, 100 + dy, rx, ry, 116 + idx, 100 + dy + idy, ir, hl, twinkle
        )
        if cut is not None:
            s += _lid(84, 100 + dy, rx, ry, cut, slant) + _lid(116, 100 + dy, rx, ry, cut, -slant)
        return s

    sad_lid = {"cut": lk["eye"]["cut"] + 1} if "cut" in lk["eye"] and look == "old" else {}

    def flick(dy=0):
        return line(f"M77 {95 + dy} L71 {91 + dy}", 2.5) + line(f"M123 {95 + dy} L129 {91 + dy}", 2.5) if lashes else ""

    return {
        "open": pair(**lk["eye"]) + flick() + brows(lk["rest"]),
        "closed": line("M76 102 Q84 108 92 102") + line("M108 102 Q116 108 124 102") + brows(lk["closed"]),
        "happy": line("M76 104 Q84 94 92 104") + line("M108 104 Q116 94 124 104") + brows(lk["happy"]),
        "wide": pair(-1, 10, 12.5, 1, 1, 4, 1.6) + flick(-3) + brows(("M74 80 Q83 73 93 77", "M107 77 Q117 73 126 80")),
        "sad": pair(1, 8, 9, 1, 3, 5.5, 1.8, **sad_lid)
        + flick(2)
        + brows(("M74 89 Q84 88 93 81", "M107 81 Q116 88 126 89")),
        "angry": (
            fill("M75 95 L93 100 C94 107 90 111 84 111 C78 111 75 106 75 95 Z", "#fff")
            + fill("M125 95 L107 100 C106 107 110 111 116 111 C122 111 125 106 125 95 Z", "#fff")
            + circle(86, 104, 5, "{iris}")
            + circle(118, 104, 5, "{iris}")
            + circle(88, 102, 1.6, "#fff")
            + circle(120, 102, 1.6, "#fff")
            + brows(("M72 85 L95 94", "M128 85 L105 94"), brow + 0.5)
        ),
    }


CLOSED_MOUTHS = {
    "plain": "M93 130 Q102 134 111 130",
    "sly": "M92 130 Q103 135 113 127",  # a half smile, one corner up
    "flat": "M92 131 Q102 129 112 131",  # set hard: a guard
    "soft": "M92 130 Q102 135 112 129",
}


def mouth(dy=0, closed="plain", angry="teeth", lips=False):
    """The six mouth variants (closed, open, smile, sad, angry, scared), moved down by `dy`
    to clear a moustache (2 for a small one, 7-9 for a big one). `closed` names the resting
    line in CLOSED_MOUTHS; `angry` is 'teeth' (bared) or 'line' (a hard set line); `lips`
    draws the lines in the lip colour, not the line colour. Tokens: mouth, tongue, lip
    (defaults to mouth)."""
    lc = "{lip}" if lips else "{line}"

    def p(d):
        return shift_y(d, dy)

    def e(cx, cy, rx, ry, col):
        return f"<ellipse cx='{cx}' cy='{f1(cy + dy)}' rx='{rx}' ry='{ry}' fill='{col}'/>"

    mad = (
        fill(p("M90 128 Q102 124 114 128 Q112 138 102 138 Q92 138 90 128 Z"), "{mouth}")
        + fill(p("M92 128 Q102 125 112 128 L111 131 Q102 129 93 131 Z"), "#fff")
        if angry == "teeth"
        else line(p("M91 133 Q102 128 113 133"), 4, lc)
    )
    return {
        "closed": line(p(CLOSED_MOUTHS[closed]), 3.5, lc),
        "smile": fill(p("M88 126 Q102 146 116 126 Q102 131 88 126 Z"), "{mouth}")
        + fill(p("M95 136 Q102 132 109 136 Q102 140 95 136 Z"), "{tongue}"),
        "open": e(102, 132, 9, 10, "{mouth}") + e(102, 137, 5, 3.5, "{tongue}"),
        "sad": line(p("M92 135 Q102 127 112 135"), 3.5, lc),
        "angry": mad,
        "scared": line(p("M90 133 Q96 127 102 133 Q108 139 114 133"), 3.5, lc),
    }


_EYES, _MOUTH = eyes, mouth

# ================================================================ torsos
NECK = "<rect x='89' y='122' width='22' height='54' rx='9' fill='{skin}'/>"


def _with(front, back, extras):
    for f, b in extras:
        front += f
        back += b
    return front, back


def kurta(long=False, k=1.0, extras=()):
    """A kurta with a band collar, a placket and buttons, side slits: to the hip, or with
    `long` to the upper thigh. `k` narrows (0.92) or broadens the build. Tokens: shirt,
    shirtDark, shirtLight, skin, button (defaults to gold)."""
    if long:
        body = (
            "M74 160 Q100 152 126 160 Q140 164 142 180 L140 250 Q142 280 146 302 "
            "Q123 308 100 306 Q77 308 54 302 Q58 280 60 250 L58 180 Q60 164 74 160 Z"
        )
        hem = "M54 302 Q77 308 100 306 Q123 308 146 302 L145 293 Q123 299 100 297 Q77 299 55 293 Z"
        slits = line(sx("M61 270 L58 296", k), 2.5, "{shirtDark}") + line(
            sx("M139 270 L142 296", k), 2.5, "{shirtDark}"
        )
    else:
        body = (
            "M74 160 Q100 152 126 160 Q140 164 142 180 L140 250 Q141 274 145 293 "
            "Q123 299 100 297 Q77 299 55 293 Q59 274 60 250 L58 180 Q60 164 74 160 Z"
        )
        hem = "M55 293 Q77 299 100 297 Q123 299 145 293 L144 285 Q123 291 100 289 Q77 291 56 285 Z"
        slits = line(sx("M61 264 L58 286", k), 2.5, "{shirtDark}") + line(
            sx("M139 264 L142 286", k), 2.5, "{shirtDark}"
        )
    base = NECK + fill(sx(body, k), "{shirt}") + fill(sx(hem, k), "{shirtDark}") + slits
    front = (
        base
        + fill("M85 156 Q100 162 115 156 L116 166 Q100 173 84 166 Z", "{shirtDark}")
        + fill("M96 166 L106 166 L106 214 Q101 218 96 214 Z", "{shirtLight}")
        + "".join(circle(101, y, 2.8, "{button}") for y in (178, 192, 206))
    )
    back = (
        base
        + fill(sx("M74 160 Q100 152 126 160 Q138 166 140 178 Q100 188 60 178 Q62 166 74 160 Z", k), "{shirtLight}")
        + fill("M86 154 Q100 160 114 154 L115 162 Q100 168 85 162 Z", "{shirtDark}")
        + line("M100 190 L100 280", 2.5, "{shirtDark}")
    )
    return Torso(*_with(front, back, extras), 306 if long else 298)


def banyan(k=0.9, extras=()):
    """A sleeveless cotton banyan to the hips with a round neck and three cloth buttons, the
    arms bare from the shoulder: a servant, a labourer. Tokens: shirt, shirtDark, skin."""
    vest = (
        "M76 160 Q100 154 124 160 Q134 164 136 178 L137 250 Q138 276 141 292 "
        "Q122 297 100 296 Q78 297 59 292 Q62 276 63 250 L64 178 Q66 164 76 160 Z"
    )
    hem = "M59 292 Q78 297 100 296 Q122 297 141 292 L140 285 Q122 290 100 289 Q78 290 60 285 Z"
    base = NECK + fill(sx(vest, k), "{shirt}") + fill(sx(hem, k), "{shirtDark}")
    base += fill(sx("M64 168 Q70 160 80 160 Q74 172 66 182 Z", k), "{skin}") + fill(
        sx("M136 168 Q130 160 120 160 Q126 172 134 182 Z", k), "{skin}"
    )
    front = (
        base
        + fill("M86 158 Q100 182 114 158 Q100 164 86 158 Z", "{skin}")
        + "".join(circle(101, y, 2.6, "{shirtDark}") for y in (190, 206, 222))
        + line("M96 186 L96 260", 2.2, "{shirtDark}")
    )
    back = base + line("M100 186 L100 280", 2.2, "{shirtDark}")
    return Torso(*_with(front, back, extras), 296)


def tunic(sword=True, extras=()):
    """An angrakha-cut tunic flaring to mid-thigh with a gold border, a sash at the waist with
    its end hanging, and with `sword` a belt from the far shoulder and a curved talwar in its
    scabbard at the hip, hilt forward: a guard, a soldier. Tokens: shirt, shirtDark, gold,
    goldDark, sash (defaults to gold), belt, scabbard."""
    upper = "M74 160 Q100 152 126 160 Q140 164 142 180 L141 244 L59 244 L58 180 Q60 164 74 160 Z"
    skirt = "M60 240 L140 240 Q146 278 154 312 Q128 320 100 318 Q72 320 46 312 Q54 278 60 240 Z"
    border = "M46 312 Q72 320 100 318 Q128 320 154 312 L152 302 Q128 310 100 308 Q72 310 48 302 Z"
    base = NECK + fill(skirt, "{shirt}") + fill(border, "{gold}") + fill(upper, "{shirt}")
    base += line("M80 262 Q74 288 66 306", 2.5, "{shirtDark}") + line("M120 262 Q126 288 134 306", 2.5, "{shirtDark}")
    sash = (
        fill("M58 232 Q100 226 142 232 L142 256 Q100 250 58 256 Z", "{sash}")
        + line("M60 240 Q100 234 140 240", 2.5, "{sashDark}")
        + line("M60 248 Q100 242 140 248", 2.5, "{sashDark}")
    )
    front = (
        base
        + fill("M84 156 Q100 162 116 156 L117 166 Q100 173 83 166 Z", "{gold}")
        + fill(ribbon((88, 166), (100, 186), (118, 206), (126, 236), 5, 5), "{gold}")
        + "".join(circle(x, y, 2.6, "{gold}") for x, y in ((104, 186), (116, 204)))
    )
    back = base + fill("M85 154 Q100 160 115 154 L116 162 Q100 168 84 162 Z", "{gold}")
    if sword:
        front += fill(ribbon((64, 164), (84, 196), (110, 222), (136, 240), 9, 9), "{belt}")
        back += fill(ribbon((136, 164), (116, 196), (90, 222), (64, 240), 9, 9), "{belt}")
    front += (
        sash
        + fill("M108 250 L122 250 L124 290 L116 296 L106 290 Z", "{sash}")
        + line("M108 286 L122 286", 2.5, "{sashDark}")
    )
    back += sash
    if sword:
        scab = taper((132, 256), (108, 292), (84, 328), (50, 342), 16, 11)
        front += (
            fill(scab, "{scabbard}")
            + fill(ribbon((62, 336), (57, 339), (52, 341), (44, 340), 15, 13, 6), "{gold}")
            + fill(ribbon((122, 266), (120, 269), (118, 272), (116, 275), 19, 19, 4), "{gold}")
            + stroke("M140 262 Q166 262 170 232", "{gold}", 5)
            + fill(ribbon((131, 245), (134, 251), (138, 258), (142, 265), 9, 9, 6), "{gold}")
            + fill(ribbon((133, 257), (145, 247), (156, 238), (165, 230), 10, 9, 6), "{gold}")
            + line("M146 245 L150 251", 2.5, "{goldDark}")
            + line("M154 239 L158 245", 2.5, "{goldDark}")
            + circle(165, 230, 7.5, "{gold}")
            + circle(165, 230, 3, "{goldDark}")
        )
    return Torso(*_with(front, back, extras), 318)


def _pearls(p0, c, p1, r=3.6, step=8.2):
    return "".join(circle(x, y, r, "{pearl}") for x, y in qpts(p0, c, p1, step)[1:-1])


def _butas(spots):
    """Small gold buta flowers woven into silk: three dots round a centre."""
    return "".join(
        circle(x, y - 2.6, 2.2, "{gold}")
        + circle(x - 2.4, y + 1.4, 2.2, "{gold}")
        + circle(x + 2.4, y + 1.4, 2.2, "{gold}")
        for x, y in spots
    )


def angrakha(build="slim", extras=()):
    """A silk angrakha: a gold-edged wrap across the chest, a sash, a gold hem, pearls and a
    jewel at the throat. `build='round'` is a king: a round belly, the skirt below the knee,
    gold butas in the silk, three strings of pearls with a ruby pendant. `'slim'` is a noble:
    straighter, to the knee, the sash knotted at the hip, one string of pearls. Tokens:
    coat, coatDark, sash, sashDark, gold, goldDark, pearl, ruby, emerald, skin."""
    if build == "round":
        body = (
            "M70 158 Q100 150 130 158 Q148 164 150 184 L152 222 Q160 244 154 264 "
            "Q160 298 166 334 Q134 344 100 342 Q66 344 34 334 Q40 298 46 264 Q40 244 48 222 L50 184 Q52 164 70 158 Z"
        )
        hem = "M34 334 Q66 344 100 342 Q134 344 166 334 L164 324 Q134 334 100 332 Q66 334 36 324 Z"
        sash = "M46 250 Q100 262 154 250 L155 270 Q100 282 45 270 Z"
        base = NECK + fill(body, "{coat}")
        base += (
            line("M64 280 L52 326", 3, "{coatDark}")
            + line("M84 284 L80 330", 3, "{coatDark}")
            + line("M140 282 L150 326", 3, "{coatDark}")
        )
        base += _butas([(60, 300), (96, 304), (138, 302), (72, 318), (154, 318), (46, 316)])
        base += fill(hem, "{gold}") + line("M38 329 Q66 338 100 337 Q134 338 162 329", 2.5, "{goldDark}")
        sash_ = fill(sash, "{sash}") + line("M47 260 Q100 272 153 260", 3, "{sashDark}")
        front = base + _butas([(70, 196), (68, 228), (130, 200)])
        front += fill(ribbon((88, 160), (96, 196), (122, 220), (151, 232), 7), "{gold}")
        front += fill(ribbon((122, 270), (124, 292), (127, 312), (131, 333), 6), "{gold}")
        front += sash_
        front += fill("M100 266 L120 266 L125 318 L99 318 Z", "{sash}") + fill(
            "M99 310 L125 310 L125 318 L99 318 Z", "{gold}"
        )
        front += "".join(line(f"M{x} 319 L{x} 325", 2.5, "{gold}") for x in (102, 108, 114, 120))
        front += line("M110 270 L112 306", 2.5, "{sashDark}")
        front += fill(ribbon((84, 159), (90, 172), (110, 172), (116, 159), 7), "{gold}")
        front += _pearls((80, 160), (100, 246), (120, 160)) + _pearls((77, 161), (100, 288), (123, 161))
        front += _pearls((74, 163), (100, 326), (126, 163))
        front += gem(100, 246, 6.5, "{ruby}") + gem(100, 259, 3.5, "{emerald}") + gem(100, 168, 3.2, "{emerald}")
        back = base + line("M100 166 L100 248", 2.5, "{coatDark}") + sash_
        back += _pearls((82, 158), (100, 168), (118, 158), 3.4, 7.5) + fill(
            ribbon((84, 157), (90, 164), (110, 164), (116, 157), 5), "{gold}"
        )
        return Torso(*_with(front, back, extras), 340)
    body = (
        "M72 160 Q100 152 128 160 Q142 164 144 182 L145 248 Q148 260 146 270 "
        "Q152 298 158 324 Q128 334 100 332 Q72 334 42 324 Q48 298 54 270 Q52 260 55 248 L56 182 Q58 164 72 160 Z"
    )
    hem = "M42 324 Q72 334 100 332 Q128 334 158 324 L156 315 Q128 324 100 322 Q72 324 44 315 Z"
    sash = "M54 248 Q100 258 146 248 L147 266 Q100 276 53 266 Z"
    base = NECK + fill(body, "{coat}")
    base += (
        line("M66 280 L58 318", 3, "{coatDark}")
        + line("M86 282 L84 322", 3, "{coatDark}")
        + line("M138 280 L146 318", 3, "{coatDark}")
    )
    base += fill(hem, "{gold}")
    sash_ = fill(sash, "{sash}") + line("M55 257 Q100 267 145 257", 3, "{sashDark}")
    front = base + fill(ribbon((90, 160), (98, 192), (120, 214), (145, 226), 6), "{gold}")
    front += fill(ribbon((120, 266), (122, 286), (125, 304), (128, 322), 5), "{gold}")
    front += (
        sash_
        + fill("M128 262 L142 262 L148 306 L132 306 Z", "{sash}")
        + fill("M131 298 L148 298 L148 306 L132 306 Z", "{gold}")
    )
    front += ellipse(134, 258, 9, 8, "{sash}")
    front += fill(ribbon((84, 160), (90, 172), (110, 172), (116, 160), 6), "{gold}")
    front += _pearls((80, 161), (100, 254), (120, 161), 3.4, 7.8) + gem(100, 208, 5, "{emerald}")
    back = base + line("M100 166 L100 246", 2.5, "{coatDark}") + sash_
    back += fill(ribbon((84, 158), (90, 165), (110, 165), (116, 158), 5), "{gold}")
    return Torso(*_with(front, back, extras), 330)


def sari(extras=()):
    """A sari's upper half: an elbow-length blouse with a round neck, the pallu across the
    chest from the near hip to the far shoulder with a border, falling down the back (it
    shows past the far side in profile, and down the middle from behind), the pleats tucked
    at the waist. The skirt is `sari_skirt()` on the legs. Tokens: sari, sariDark, border,
    blouse, blouseDark, skin."""
    body = "M74 160 Q100 153 124 160 Q137 164 139 178 L141 246 L139 285 Q120 292 100 290 Q80 292 61 285 L59 246 L59 196 Q56 170 74 160 Z"
    blouse = "M74 160 Q100 153 124 160 Q137 164 139 178 L140 214 Q100 222 59 214 L59 196 Q56 170 74 160 Z"
    front = (
        NECK
        + fill("M62 166 Q50 200 49 284 L70 288 L72 200 Z", "{sari}")
        + stroke("M62 172 Q53 205 52.5 282", "{border}", 5)
        + fill(body, "{sari}")
        + fill(blouse, "{blouse}")
        + fill("M88 157 Q100 184 112 157 Z", "{skin}")
        + line("M86 156 Q100 188 114 156", 3, "{blouseDark}")
        + fill("M57 214 Q54 168 76 157 L95 156 Q118 196 141 232 L141 264 Q130 266 122 262 Q90 236 57 214 Z", "{sari}")
        + stroke("M95 156 Q118 196 141 232", "{border}", 5)
        + line("M78 164 Q102 202 131 250", 2.5, "{sariDark}")
        + line("M62 194 Q92 222 118 254", 2.5, "{sariDark}")
        + "".join(circle(x, y, 2.4, "{border}") for x, y in ((88, 188), (104, 210), (120, 234)))
        + line("M60 252 Q100 262 140 252", 2.5, "{sariDark}")
        + "".join(
            line(f"M{x} {y0} L{x} {y0 + 23}", 2.5, "{sariDark}")
            for x, y0 in ((101, 266), (109, 266), (117, 265), (125, 264))
        )
    )
    back = (
        NECK
        + fill(body, "{sari}")
        + fill(blouse, "{blouse}")
        + fill("M88 157 Q100 168 112 157 Z", "{skin}")
        + line("M86 156 Q100 172 114 156", 3, "{blouseDark}")
        + fill("M66 160 Q82 155 96 158 L98 287 Q80 291 62 287 Q60 220 66 160 Z", "{sari}")
        + stroke("M96 158 L98 286", "{border}", 5)
        + line("M76 164 L76 286", 2.5, "{sariDark}")
        + "".join(circle(86, y, 2.4, "{border}") for y in (196, 236, 272))
        + line("M100 252 Q120 258 140 252", 2.5, "{sariDark}")
    )
    return Torso(*_with(front, back, extras), 292)


def choli(extras=()):
    """A short blouse (choli) with a round neck over the gathered top of a ghagra, its
    waistband at the waist: a village girl, a dancer. The skirt is `ghagra()` on the legs.
    Tokens: blouse, blouseDark, border, skirt, skirtDark, skin."""
    blouse = "M74 160 Q100 153 124 160 Q137 164 139 178 L140 212 Q100 220 59 212 L59 196 Q56 170 74 160 Z"
    skirt = (
        NECK
        + fill("M58 206 Q100 214 142 206 L146 292 Q100 300 54 292 Z", "{skirt}")
        + "".join(
            line(f"M{x} 226 L{f1(100 + (x - 100) * 1.1)} 288", 2.5, "{skirtDark}") for x in (72, 86, 100, 114, 128)
        )
    )
    band = fill("M58 206 Q100 214 142 206 L142 220 Q100 228 58 220 Z", "{border}")
    front = (
        skirt
        + band
        + fill(blouse, "{blouse}")
        + stroke("M60 212 Q100 220 139 212", "{border}", 4)
        + fill("M88 157 Q100 182 112 157 Z", "{skin}")
        + line("M86 156 Q100 186 114 156", 3, "{blouseDark}")
    )
    back = (
        skirt
        + band
        + fill(blouse, "{blouse}")
        + stroke("M60 212 Q100 220 139 212", "{border}", 4)
        + line("M100 166 L100 210", 2.5, "{blouseDark}")
    )
    return Torso(*_with(front, back, extras), 292)


def kameez(extras=()):
    """A woman's kameez to mid-thigh with a round neck trimmed in gold, small buti, side slits
    and a hem band; wear it with `pyjama` (salwar) or `churidar`, and `blouse_sleeves(
    'shirt', 'trim', 236)`. Tokens: shirt, shirtDark, shirtLight, trim (gold), skin."""
    body = "M76 160 Q100 153 124 160 Q137 164 139 178 L141 246 L146 298 Q124 307 100 305 Q76 307 54 298 L59 246 L61 178 Q63 164 76 160 Z"
    hem = fill("M55.5 286 Q100 296 144.5 286 L146 298 Q124 307 100 305 Q76 307 54 298 Z", "{trim}")
    slits = line("M66 258 L63.5 301", 3, "{shirtDark}") + line("M134 258 L136.5 301", 3, "{shirtDark}")
    spots = ((78, 200), (122, 200), (86, 236), (114, 236), (72, 262), (128, 262), (86, 276), (114, 276))
    butis = "".join(circle(x, y, 2.6, "{shirtLight}") for x, y in spots)
    front = (
        NECK
        + fill(body, "{shirt}")
        + fill("M88 157 Q100 190 112 157 Z", "{skin}")
        + stroke("M86 156 Q100 194 114 156", "{trim}", 5)
        + butis
        + circle(100, 214, 2.6, "{shirtLight}")
        + circle(100, 260, 2.6, "{shirtLight}")
        + hem
        + slits
    )
    back = (
        NECK
        + fill(body, "{shirt}")
        + fill("M88 157 Q100 168 112 157 Z", "{skin}")
        + stroke("M86 156 Q100 172 114 156", "{trim}", 5)
        + butis
        + hem
        + slits
    )
    return Torso(*_with(front, back, extras), 305)


# ================================================================ extras over a torso


def gamchha():
    """A checked cotton gamchha over the far shoulder, hanging down the chest (or the back)
    with a fringed end. Tokens: gamchha, gamchhaLine (default red and white)."""

    def strip(front):
        top, bot = (72, 154), (78, 248 if front else 258)
        w = 19
        dx, dy = bot[0] - top[0], bot[1] - top[1]
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln, dx / ln

        def p(t, s):
            return (top[0] + dx * t + nx * s, top[1] + dy * t + ny * s)

        a, b, c, d = p(0, -w / 2), p(0, w / 2), p(1, w / 2), p(1, -w / 2)
        body = fill(
            f"M{f1(a[0])} {f1(a[1])} Q72 144 {f1(b[0] + 4)} {f1(b[1] - 6)} L{f1(c[0])} {f1(c[1])} L{f1(d[0])} {f1(d[1])} Z",
            "{gamchha}",
        )
        checks = ""
        for s in (-4.5, 4.5):
            q0, q1 = p(0.02, s), p(0.97, s)
            checks += line(f"M{f1(q0[0])} {f1(q0[1])} L{f1(q1[0])} {f1(q1[1])}", 2.2, "{gamchhaLine}")
        for i in range(1, 8):
            q0, q1 = p(i / 8, -w / 2 + 1.5), p(i / 8, w / 2 - 1.5)
            checks += line(f"M{f1(q0[0])} {f1(q0[1])} L{f1(q1[0])} {f1(q1[1])}", 2.2, "{gamchhaLine}")
        fringe = ""
        for s in (-7, -2.5, 2.5, 7):
            q = p(1, s)
            fringe += line(f"M{f1(q[0])} {f1(q[1] - 2)} L{f1(q[0] + 0.5)} {f1(q[1] + 7)}", 2.5, "{gamchha}")
        return body + checks + fringe

    return strip(True), strip(False)


def angavastram():
    """An angavastram: a shawl over the far shoulder, across the chest to the near hip, edged
    in gold; from behind its other end hangs straight down with a fringe. Tokens: shawl,
    shawlDark, gold."""
    front = fill(ribbon((70, 158), (86, 196), (112, 238), (146, 268), 30, 30), "{shawl}")
    front += fill(ribbon((58, 168), (60, 152), (76, 146), (90, 162), 18, 24), "{shawl}")
    front += fill(ribbon((56, 164), (72, 202), (98, 246), (134, 280), 4, 4), "{gold}") + fill(
        ribbon((84, 154), (100, 190), (126, 230), (158, 258), 4, 4), "{gold}"
    )
    front += line("M80 190 Q96 214 112 228", 2.5, "{shawlDark}") + line("M90 176 Q108 204 126 220", 2.5, "{shawlDark}")
    back = fill(ribbon((70, 154), (68, 190), (66, 226), (66, 262), 30, 32), "{shawl}")
    back += (
        fill(ribbon((55, 156), (53, 190), (51, 226), (50, 262), 4, 4), "{gold}")
        + fill(ribbon((85, 156), (83, 190), (81, 226), (82, 262), 4, 4), "{gold}")
        + fill(ribbon((51, 266), (60, 268), (74, 268), (83, 266), 5, 5), "{gold}")
    )
    back += "".join(line(f"M{x} 270 L{x} 278", 2.5, "{shawl}") for x in (55, 61, 67, 73, 79))
    back += line("M66 180 L66 250", 2.5, "{shawlDark}")
    return front, back


def dupatta():
    """A dupatta across the front of the neck with both ends thrown back over the shoulders,
    hanging down the back. Tokens: dupatta, dupattaDark, border (gold)."""
    front = fill(ribbon((62, 162), (72, 222), (128, 222), (138, 162), 15), "{dupatta}")
    front += stroke("M66 176 Q100 232 134 176", "{border}", 3) + line("M74 186 Q100 214 126 186", 2.2, "{dupattaDark}")
    back = ""
    for x0, x1 in ((70, 66), (130, 134)):
        back += fill(ribbon((x0, 158), (x0, 200), (x1, 240), (x1, 282), 20), "{dupatta}")
        back += stroke(f"M{x1 - 10} 280 L{x1 + 10} 280", "{border}", 4)
    return front, back


# ================================================================ the person


def _grown(svg, k, apart=True):
    """A head part drawn k times as large about the neck (100, 152): a child's big head.
    `apart` puts each shape in a group of its own, so the construction check still sees the
    head's shapes one by one; a plait is grown whole."""
    if k == 1:
        return svg
    if isinstance(svg, dict):
        return {v: _grown(x, k, apart) for v, x in svg.items()}
    g = f"<g transform='translate(100 152) scale({k}) translate(-100 -152)'>"
    if not apart:
        return g + svg + "</g>"
    return "".join(g + el + "</g>" for el in re.findall(r"<[^<>]+/>", svg))


def person(
    id, name, height, *, head, torso, arms, legs, colors, face="", eyes=None, mouth=None,
    description="", voice=None, reach=(70, 130), hem=None, head_scale=1, **more,
):  # fmt: skip
    """A humanoid character from wardrobe pieces. `reach` is where the far and near hands
    hang (x at the wrist): (64, 136) for a broad build. `hem` defaults to the torso's.
    `head_scale` draws the head and face larger about the neck: 1.15 to 1.2 for a child. A
    head with a plait brings its hung parts, hangs and springs. `more` passes other fields
    through: hold, hangs, springs, shadow."""
    hf, hb, *rest = head
    hung = rest[0] if rest else {"parts": {}, "hangs": {}, "springs": []}
    k = head_scale
    parts = {
        "armL": arms(76, reach[0], False),
        "legL": legs(86, 85),
        "legR": legs(114, 115),
        "torso": {"default": torso.front, "back": torso.back},
        **{n: _grown(v, k, apart=False) for n, v in hung["parts"].items()},
        "head": _grown({"default": hf, "back": hb}, k),
        "face": _grown(face, k),
        "eyes": _grown(eyes if eyes is not None else _EYES(), k),
        "mouth": _grown(mouth if mouth is not None else _MOUTH(), k),
        "armR": arms(124, reach[1], True),
    }
    if hung["hangs"]:
        grow = lambda x, y: [round(100 + (x - 100) * k, 1), round(152 + (y - 152) * k, 1)]
        more["hangs"] = {
            **{n: {**h, "at": grow(*h["at"])} for n, h in hung["hangs"].items()},
            **more.get("hangs", {}),
        }
        more["springs"] = [*hung["springs"], *more.get("springs", [])]
    return character(
        id, name, "humanoid", height, parts, colors, description, voice,
        hem=hem if hem is not None else torso.hem, **more,
    )  # fmt: skip
