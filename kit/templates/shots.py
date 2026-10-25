"""The shots of a story, written from the kit: copy into <project>/src/ and write the film.

usage: python3 src/shots.py [projectDir]
Writes <project>/shots/NN-<id>.json in order. Lines are paced by their real voices once
spoken: run this, `talekit voice <project>`, run this again. For a reel, leave out the
English (the fourth argument of say and cap): a reel has no .mkv.

This one is staged in the library's `hut` scene (talekit copy <project> hut)."""

import pathlib
import sys

KIT = next((p / "kit" for p in pathlib.Path(__file__).resolve().parents if (p / "kit" / "talekit").is_dir()), None)
if KIT:  # inside the talekit repo; elsewhere run with PYTHONPATH=<talekit>/kit
    sys.path.insert(0, str(KIT))

from talekit.shots import *

F = Film(project_dir(__file__))
after, shot = F.after, F.shot
H = F.anchors("hut")

# ------------------------------------------------------------------ 1. fetching water
N1 = "एक दिन दादा ने बेटे को पानी लाने भेजा।"
L1 = "बेटा, मटका ध्यान से लाना!"
L2 = "हाँ दादा, बिल्कुल!"
t = 0.5
a = [seated("dada", "platform"), cap(t, N1, "One day Grandpa sent the boy to fetch water.")]
a += [do(0.6, "beta", "walk", 2.6, to="pots")]
t = max(after(t, N1), 3.4)
a += [attach(t - 0.4, "matka", "beta"), turn(t - 0.2, "beta", "left")]
a += [say(t, "dada", L1, "Son, carry the pot carefully!", to="beta")]
t = after(t, L1)
a += [say(t, "beta", L2, "Yes, Grandpa, of course!", to="dada", emotion="happy"), do(t + 0.3, "beta", "nod")]
t = after(t, L2)
shot(
    "paani", "hut", t,
    {"dada": at("platform", emotion="happy"), "beta": at("path-left"), "matka": at("pots")},
    a, fadeIn=1, music="calm",
)  # fmt: skip

# ------------------------------------------------------------------ 2. the slip
N2 = "पर रास्ते में उसका पैर फिसल गया..."
L3 = "अरे! मटका टूट गया!"
L4 = "कोई बात नहीं, बेटा। तुम्हें चोट तो नहीं लगी?"
t = 0.4
a = [seated("dada", "platform"), attach(0, "matka", "beta"), cap(t, N2, "But on the way, his foot slipped...")]
a += [do(0.5, "beta", "walk", 2.2, to="yard")]
drop = 2.9
a += [do(drop - 0.3, "beta", "tremble", 0.5), feel(drop - 0.2, "beta", "surprised")]
a += smash(drop, "matka", pt(H["yard"]["x"] - 45, H["yard"]["y"] + 12), noise="bonk")
t = max(after(t, N2), drop + 0.8)
a += [say(t, "beta", L3, "Oh no! The pot broke!", bubble="shout", emotion="scared")]
t = after(t, L3)
a += [say(t, "dada", L4, "Never mind, son. You're not hurt, are you?", to="beta", emotion="happy")]
a += [feel(after(t, L4) - 0.4, "beta", "happy")]
t = after(t, L4)
shot(
    "matka", "hut", t,
    {"dada": at("platform"), "beta": at("pots", "left"), "matka": at("pots")},
    a, fadeOut=1,
)  # fmt: skip

F.write()
