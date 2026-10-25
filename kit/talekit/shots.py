"""Write a film's shots from a script: the action helpers, pacing by the real voices, and
the files.

    from talekit.shots import *
    F = Film(project_dir(__file__))
    D = F.anchors('darbar')

    t = 0.4
    a = [cap(t, 'एक दिन...', 'One day...')]
    t = F.after(t, 'एक दिन...')
    a += [say(t, 'raja', 'नमस्ते!', 'Hello!', to='maharaj'), do(t + 0.3, 'raja', 'nod')]
    t = F.after(t, 'नमस्ते!')
    F.shot('milan', 'darbar', t, {'raja': at('door'), 'maharaj': at('throne', 'left')}, a)
    F.write()

**Pacing.** `F.after(t, text)` is when the next line can start after `text` was said at t:
its voice's real length once `talekit voice` has spoken it (audio/voices/index.json), else
an estimate from its length, plus a linger and a gap. So the loop is: run the script,
`talekit voice <project>`, run it again, and every shot fits its voices.

**Replies.** `say(after(0.4), ...)` in place of a time writes the format's `after`: the
engine starts the reply 0.4 s after the line before it has been said, so it holds whatever
the voices do. Keep pacing the shot's end with `F.after`.

**Translations.** `say` and `cap` take the English as their fourth argument (the film's
subtitle track, see the guide's "Subtitles and the .mkv"); leave it out in a reel, which
has no .mkv.

Every helper returns plain dicts in the shot format of docs/authoring-guide.md ("Shots"),
so anything the helpers do not cover is written as a dict next to them."""

import glob
import json
import os

from .characters import project_dir

__all__ = [
    "Film",
    "after",
    "at",
    "attach",
    "cam",
    "cap",
    "do",
    "feel",
    "keep",
    "project_dir",
    "pt",
    "release",
    "row",
    "say",
    "seated",
    "smash",
    "sound",
    "spoken",
    "turn",
    "variant",
]  # fmt: skip


def spoken(text):
    """The words a voice reads: *marked* sounds in a line are shown, not spoken."""
    out, on = "", False
    for ch in text:
        if ch == "*":
            on = not on
        elif not on:
            out += ch
    return out.strip()


class Film:
    """One project's shots, written in order as shots/NN-<id>.json.

    gap: seconds between one line ending and the next starting.
    linger: seconds a line stays up after its voice ends.
    rate: characters a second, for the estimate before a line is voiced."""

    def __init__(self, project, gap=0.35, linger=0.5, rate=11.5):
        self.project = project
        self.gap = gap
        self.linger = linger
        self.rate = rate
        self.shots = []
        self.voiced = {}
        for f in glob.glob(os.path.join(project, "audio", "voices", "*.json")):
            with open(f) as fh:
                for v in json.load(fh).values():
                    if isinstance(v, dict) and "text" in v and "duration" in v:
                        self.voiced[v["text"]] = v["duration"]

    def anchors(self, scene):
        """The anchors of one of the project's scenes: {'name': {'x', 'y', ...}}."""
        with open(os.path.join(self.project, "scenes", f"{scene}.json")) as fh:
            return json.load(fh)["anchors"]

    def up(self, text):
        """Seconds a line is up: its voice and the linger after it (an estimate until voiced)."""
        words = spoken(text)
        if not words:
            return 1.8
        d = self.voiced.get(words) or self.voiced.get(text)
        if d:
            return d + self.linger
        return round(len(words) / self.rate + 0.9, 2)

    def after(self, t, text, gap=None):
        """When the next line can start after `text`, said at t."""
        return round(t + self.up(text) + (self.gap if gap is None else gap), 2)

    def shot(self, id, scene, end, cast, actions, camera=None, tail=0.6, **more):
        """Add a shot that runs to `end` plus `tail`. `more` takes any other shot field:
        music, crossfade, fadeIn, fadeOut, weather, ambience."""
        self.shots.append(
            {
                "id": id,
                "scene": scene,
                "duration": round(end + tail, 2),
                "cast": cast,
                "camera": camera or {"zoom": 1},
                # In time order, unless some are placed after a line: then as written.
                "actions": actions if any("after" in a for a in actions) else sorted(actions, key=lambda a: a["t"]),
                **more,
            }
        )

    def write(self):
        """Replace the project's shots with these, in order, and print the running time."""
        folder = os.path.join(self.project, "shots")
        os.makedirs(folder, exist_ok=True)
        for f in glob.glob(os.path.join(folder, "*.json")):
            os.remove(f)
        total = 0
        for i, s in enumerate(self.shots):
            with open(os.path.join(folder, f"{i + 1:02d}-{s['id']}.json"), "w") as fh:
                json.dump(s, fh, ensure_ascii=False, indent=1)
            total += s["duration"]
            print(f"{i + 1:02d} {s['id']:12s} {s['duration']:6.2f}")
        print(len(self.shots), "shots,", round(total, 1), "s,", len(self.voiced), "voiced lines known")


# ---------------------------------------------------------------- where


def at(where, facing="right", emotion="neutral", visible=True, **more):
    """A cast entry: at an anchor name or a pt(), facing, feeling. `more`: on, scale."""
    return {"at": where, "facing": facing, "emotion": emotion, "visible": visible, **more}


def pt(x, y, scale=None):
    """A point on the floor that is not an anchor; `scale` as an anchor's (a reel's 1.35)."""
    return {"x": round(x), "y": round(y), **({"scale": scale} if scale else {})}


def row(actors, anchor):
    """Cast entries for actors standing in a row of numbered anchors: row(VASES, 'vase-{}')
    puts the first at vase-1, the next at vase-2. `anchor` may also be a list of names."""
    names = anchor if isinstance(anchor, list) else [anchor.format(i + 1) for i in range(len(actors))]
    return {a: at(n) for a, n in zip(actors, names)}


# ---------------------------------------------------------------- what happens


class after(float):
    """In place of a time: start this many seconds after the line listed before it in the
    shot stops being spoken, as the engine works it out from the real voices (the format's
    `after`). For a reply that must follow its line whatever the voices do; the script still
    paces the shot's end with `F.after`. Keep a shot's actions in the order they happen: a
    shot with any such action is written in the order given."""


def _when(t):
    """The action's time: {'t': ...}, or {'after': ...} for an after()."""
    return {"after": float(t)} if isinstance(t, after) else {"t": round(t, 2)}


def say(t, actor, text, en=None, **more):
    """A spoken line. `more`: to (who they say it to), bubble ('shout', 'thought',
    'whisper'), emotion, duration."""
    return {**_when(t), "actor": actor, "say": text, **({"translation": {"en": en}} if en else {}), **more}


def cap(t, text, en=None, style="narration", **more):
    """A caption: narration (read by the narrator), or style='title'. `more`: duration."""
    if en in ("title", "narration"):
        raise ValueError(f"cap({text!r}): the third argument is the English; write style={en!r}")
    tr = {"translation": {"en": en}} if en else {}
    return {**_when(t), "caption": text, "captionStyle": style, **tr, **more}


def do(t, actor, verb, duration=None, **more):
    """A verb (walk, run, sit, stand, nod, shake, point, tremble, ...). `more`: to."""
    a = {**_when(t), "actor": actor, "do": verb, **more}
    if duration is not None:
        a["duration"] = duration
    return a


def feel(t, actor, emotion):
    return {**_when(t), "actor": actor, "emotion": emotion}


def turn(t, actor, facing):
    return {**_when(t), "actor": actor, "set": {"facing": facing}}


def variant(t, actor, **parts):
    """Switch a part's variant: variant(t, 'vase', body='broken')."""
    return {**_when(t), "actor": actor, "face": parts}


def sound(t, name, actor=None, **more):
    """A sound effect, placed at the actor when one is given. `more`: volume."""
    a = {**_when(t), "sound": name, **more}
    if actor:
        a["actor"] = actor
    return a


def cam(t, duration, zoom, x, y):
    """Move the camera to look at (x, y) at `zoom` over `duration` seconds."""
    return {**_when(t), "duration": duration, "camera": {"zoom": zoom, "x": x, "y": y}}


# ---------------------------------------------------------------- stock staging


def attach(t, prop, holder):
    """The holder takes the prop in hand; it moves with them until released."""
    return {**_when(t), "actor": prop, "attach": holder}


def release(t, prop, to, duration=0.35):
    """The prop leaves the hand and drops to an anchor or pt() over `duration`."""
    return {**_when(t), "actor": prop, "attach": False, "do": "move", "to": to, "duration": duration}


def smash(t, prop, to, noise=None, broken="broken", part="body", duration=0.3, volume=1.3):
    """A held prop falls to `to` and breaks on landing: release, switch `part` to its
    `broken` variant, and the `noise` sound at the moment it lands. Takes a time, not an
    after(): the landing is counted from it."""
    if isinstance(t, after):
        raise TypeError("smash() needs a time, not after(): the landing is counted from it")
    land = t + duration
    out = [release(t, prop, to, duration), variant(land, prop, **{part: broken})]
    if noise:
        out.append(sound(land, noise, prop, volume=volume))
    return out


def seated(actor, seat, t=0):
    """Start a shot with the actor already sat on a seat anchor (`floor` on it)."""
    return do(t, actor, "sit", 0.05, to=seat)


def keep(actors, **parts):
    """Carry a variant over from an earlier shot: keep(['vase-1'], body='broken') at t=0."""
    return [variant(0, a, **parts) for a in actors]
