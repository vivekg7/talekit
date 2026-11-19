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
the length of the take the engine plays for it once `talekit voice` has spoken it (by the
speaker's voice now, the bubble and the feeling, from the say() or cap() of that text),
else an estimate from its length, plus a linger and a gap. So the loop is: run the script,
`talekit voice <project>`, run it again, and every shot fits its voices. A feeling only the
shot's cast gives is not known yet: of several takes the neutral one is assumed, and
F.shot() names a line paced by the wrong one.

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
import re

from .characters import option, project_dir

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
    "option",
    "pickup",
    "project_dir",
    "pt",
    "putdown",
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


# Every say(), cap(), feel() and do() made, in order, and where each Film.shot() closed a
# shot in it: Film.after() finds a line's speaker and feeling here, before its shot exists.
_made, _cuts = [], []


def _act(a):
    _made.append(a)
    return a


def _words(text):
    """What the voice says, as voice.ts `spokenText`: empty when no letter is left."""
    words = re.sub(r"\s+", " ", re.sub(r"\*[^*]*\*", " ", text))
    words = re.sub(r"^[\s!?,.;:।…-]+", "", words).strip()
    return words if any(ch.isalpha() for ch in words) else ""


def _spec(v):
    """A voice (an id, {id, speed, pitch}, or an index entry) as (id, speed, pitch)."""
    if isinstance(v, str):
        return v, 1.0, 0.0
    return v.get("id", v.get("voice")), float(v.get("speed", 1)), float(v.get("pitch", 0))


def _num(x):
    return str(int(x)) if x == int(x) else repr(x)


def _key(voice, style, emotion, text):
    """A line's key in audio/voices/index.json, as voice.ts `lineKey` makes it: FNV-1a twice
    over the UTF-16 code units of voice, speed, pitch, style, emotion and words."""
    vid, speed, pitch = _spec(voice)
    engine, name = (vid.split(":") + ["undefined"])[:2]
    s = f"{engine}:{name}|{_num(speed)}|{_num(pitch)}|{style}|{emotion}|{text.strip()}".encode("utf-16-le")
    a, b = 0x811C9DC5, 0x01000193 ^ 0x5BD1E995
    for i in range(0, len(s), 2):
        c = s[i] | s[i + 1] << 8
        a = ((a ^ c) * 0x01000193) & 0xFFFFFFFF
        b = ((b ^ c) * 0x01000195) & 0xFFFFFFFF
    return f"{a:08x}{b:08x}"


def _emotion(actions, line, t, start):
    """The speaker's emotion as `line` is said at t, as voice.ts `emotionAt`: the last one
    set by then, else `start`, the cast's. One placed after() has no time yet: it counts
    when it comes before the line."""
    at, emotion, before = float("-inf"), start, True
    for a in actions:
        if a.get("actor") == line["actor"] and a.get("emotion"):
            if "t" not in a:
                emotion = a["emotion"] if before else emotion
            elif at <= a["t"] <= line.get("t", t):
                at, emotion = a["t"], a["emotion"]
        before = before and a is not line
    return emotion


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
        self.parent = None
        self.voices, self.narrator = {}, None
        self._cast(project)
        self.takes = {}  # spoken words -> the takes the engine can find (key -> entry)
        voices = os.path.join(project, "audio", "voices")
        try:
            with open(os.path.join(voices, "index.json")) as fh:
                index = json.load(fh)
        except FileNotFoundError:
            index = {}
        for k, e in index.items():
            whole = all(f in e for f in ("file", "voice", "style", "emotion", "text"))
            if (
                whole
                and os.path.exists(os.path.join(voices, e["file"]))
                and k == _key(e, e["style"], e["emotion"], e["text"])
            ):
                self.takes.setdefault(e["text"], {})[k] = e
        self.paced = {}  # id of the line, or its text -> the duration paced by, None if estimated

    def _cast(self, folder):
        """The speakers' voices as the engine reads them: characters/*.json by id, the
        narrator from talekit.json; an option's folder is read over the project's."""
        for f in sorted(glob.glob(os.path.join(folder, "characters", "*.json"))):
            with open(f) as fh:
                c = json.load(fh)
            if "id" in c:
                self.voices[c["id"]] = c.get("voice")
        try:
            with open(os.path.join(folder, "talekit.json")) as fh:
                self.narrator = json.load(fh).get("narrator", self.narrator)
        except FileNotFoundError:
            pass

    def anchors(self, scene):
        """The anchors of one of the project's scenes: {'name': {'x', 'y', ...}}."""
        with open(os.path.join(self.project, "scenes", f"{scene}.json")) as fh:
            return json.load(fh)["anchors"]

    def _take(self, line, text, t):
        """The duration of the take the engine plays for `text`, said by the say() or cap()
        `line` at t, else None. Without `line`, the one take of it in a voice of the cast."""
        takes = self.takes.get(_words(text), {}).values()
        if line is None:
            mine = {_spec(v) for v in [*self.voices.values(), self.narrator] if v}
            found = {e["duration"] for e in takes if _spec(e) in mine}
        else:
            voice, style, emotion = self._voicing(line, t)
            if not voice:
                return None
            takes = [e for e in takes if _spec(e) == _spec(voice) and e["style"] == style]
            # A feeling the cast sets alone is at()'s default, neutral, unless that has no take.
            found = {e["duration"] for e in takes if e["emotion"] == (emotion or "neutral")}
            if not found and emotion is None:
                found = {e["duration"] for e in takes}
        return found.pop() if len(found) == 1 else None

    def _voicing(self, line, t):
        """Voice, style and emotion of a line as voice.ts works them out. The emotion is None
        when the cast sets it: the shot's cast is not written yet."""
        if "say" not in line:
            return self.narrator, line.get("captionStyle", "narration"), "neutral"
        i = next(i for i in range(len(_made) - 1, -1, -1) if _made[i] is line)
        start = max([c for c in _cuts if c <= i], default=0)
        end = min([c for c in _cuts if c > i], default=len(_made))
        return self.voices.get(line["actor"]), line.get("bubble", "speech"), _emotion(_made[start:end], line, t, None)

    def up(self, text, t=None):
        """Seconds a line is up: its voice and the linger after it (an estimate until voiced)."""
        words = spoken(text)
        if not words:
            return 1.8
        line = next((a for a in reversed(_made) if text in (a.get("say"), a.get("caption"))), None)
        d = self.paced[id(line) if line else text] = self._take(line, text, t)
        if d:
            return d + self.linger
        return round(len(words) / self.rate + 0.9, 2)

    def _paced(self, line, text):
        return self.paced.get(id(line), self.paced.get(text, False))

    def after(self, t, text, gap=None):
        """When the next line can start after `text`, said at t."""
        return round(t + self.up(text, t) + (self.gap if gap is None else gap), 2)

    def shot(self, id, scene, end, cast, actions, camera=None, tail=0.6, **more):
        """Add a shot that runs to `end` plus `tail`. `more` takes any other shot field:
        music, crossfade, cut ('later' when time has passed since the last shot; else,
        in the same scene, its cast starts as that one left them, and in another, two
        who show in both keep their sides), fadeIn, fadeOut, weather, description, allow
        (world findings waived on purpose, each with its reason)."""
        self.shots.append(
            {
                "id": id,
                "scene": scene,
                "duration": round(end + tail, 2),
                "cast": cast,
                "camera": camera or {"zoom": 1},
                "actions": actions if any("after" in a for a in actions) else sorted(actions, key=lambda a: a["t"]),
                **more,
            }
        )
        _cuts.append(len(_made))
        for a in actions:
            text = a.get("say", a.get("caption"))
            paced = self._paced(a, text)
            if paced is False or "t" not in a:
                continue
            if "say" in a:
                start = (cast.get(a["actor"]) or {}).get("emotion", "neutral")
                voice, style = self.voices.get(a["actor"]), a.get("bubble", "speech")
                emotion = _emotion(actions, a, a["t"], start)
            else:
                voice, style, emotion = self.narrator, a.get("captionStyle", "narration"), "neutral"
            words = _words(text)
            take = voice and words and self.takes.get(words, {}).get(_key(voice, style, emotion, words))
            if take and take["duration"] != paced:
                how = "an estimate" if paced is None else f"a {paced} s take"
                print(f"{id}: {text!r} paced by {how}, not its {emotion} take ({take['duration']} s):"
                      " give its say() the emotion")  # fmt: skip

    def option(self, question, choice, **about):
        """A Film for a second way of staging some shots, written into the option's choice
        (characters.option(); `about`: ask, label, shot, t). Add only the shots this choice
        changes, with the same ids, and write(): each replaces its namesake in the review
        app when the choice is looked at; a new id plays after the shot before it in this
        Film. Call it once this Film has its own shots. It is paced by the same voices."""
        alt = Film(self.project, self.gap, self.linger, self.rate)
        alt.project = option(self.project, question, choice, **about)
        alt._cast(alt.project)
        alt.parent = self
        return alt

    def write(self):
        """Replace the project's shots with these, in order, and print the running time."""
        folder = os.path.join(self.project, "shots")
        os.makedirs(folder, exist_ok=True)
        for f in glob.glob(os.path.join(folder, "*.json")):
            os.remove(f)
        total = 0
        # An option's shot takes its namesake's number, so it lands in its place.
        ids = [p["id"] for p in self.parent.shots] if self.parent else []
        n = "00"
        for i, s in enumerate(self.shots):
            n = f"{ids.index(s['id']) + 1:02d}" if s["id"] in ids else n + "b" if self.parent else f"{i + 1:02d}"
            with open(os.path.join(folder, f"{n}-{s['id']}.json"), "w") as fh:
                json.dump(s, fh, ensure_ascii=False, indent=1)
            total += s["duration"]
            print(f"{n} {s['id']:12s} {s['duration']:6.2f}")
        known = sum(map(len, self.takes.values()))
        print(len(self.shots), "shots,", round(total, 1), "s,", known, "voiced lines known")


# ---------------------------------------------------------------- where


def at(where, facing="right", emotion="neutral", visible=True, **more):
    """A cast entry: at an anchor name or a pt(), facing, feeling. `more`: on, scale,
    hidden (out of sight behind the foreground or someone nearer, checked to be covered)."""
    return {"at": where, "facing": facing, "emotion": emotion, "visible": visible, **more}


def pt(x, y, scale=None, ground=None):
    """A point on the floor that is not an anchor; `scale` as an anchor's (a reel's 1.35).
    Without it, a scene with a `perspective` sizes it by its depth: `ground` is that depth
    for a spot up on a raised surface (the y the dais meets the floor at)."""
    return {
        "x": round(x),
        "y": round(y),
        **({"scale": scale} if scale else {}),
        **({"ground": round(ground)} if ground is not None else {}),
    }


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
    return {"after": float(t)} if isinstance(t, after) else {"t": round(t, 2)}


def _dur(duration):
    return {} if duration is None else {"duration": duration}


def say(t, actor, text, en=None, **more):
    """A spoken line. `more`: to (who they say it to), bubble ('shout', 'thought'),
    emotion, duration."""
    return _act({**_when(t), "actor": actor, "say": text, **({"translation": {"en": en}} if en else {}), **more})


def cap(t, text, en=None, style="narration", **more):
    """A caption: narration (read by the narrator), or style='title'. `more`: duration."""
    if en in ("title", "narration"):
        raise ValueError(f"cap({text!r}): the third argument is the English; write style={en!r}")
    tr = {"translation": {"en": en}} if en else {}
    return _act({**_when(t), "caption": text, "captionStyle": style, **tr, **more})


def do(t, actor, verb, duration=None, **more):
    """A verb (walk, run, sit, stand, nod, shake, point, tremble, wipe, kick, eat, strike, swim, dig,
    hold, aim, shoot, ...). `more`: to, which for a wipe names what is dusted (an actor, whose middle
    the hand goes round on), for a hold whom the hand rests on (their shoulder), for an aim what is
    aimed at (an actor's `mark`, an anchor, a spot); arrow, the arrow an aim puts on the string."""
    return _act({**_when(t), "actor": actor, "do": verb, **more, **_dur(duration)})


def feel(t, actor, emotion):
    return _act({**_when(t), "actor": actor, "emotion": emotion})


def turn(t, actor, facing):
    return {**_when(t), "actor": actor, "set": {"facing": facing}}


def variant(t, actor, **parts):
    """Switch a part's variant: variant(t, 'vase', body='broken')."""
    return {**_when(t), "actor": actor, "face": parts}


def sound(t, name, actor=None, **more):
    """A sound effect, placed at the actor when one is given. `more`: volume, startles.

    A loud one (a roar, a crash) startles everyone else in the shot on its own, and one made
    with the mouth opens the actor's mouth while it sounds; startles=False stops the first.
    """
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


def pickup(t, prop, holder, duration=None):
    """The holder takes the prop up from where it is: stooping to the floor for it, or
    reaching out to it on a table or a shelf. The hand closes on it halfway through."""
    return {**_when(t), "actor": prop, "attach": holder, "do": "pickup", **_dur(duration)}


def putdown(t, prop, to=None, duration=None):
    """The holder sets the prop down at `to` (a table top: the hand reaches out to it), or
    without one on the floor under the hand."""
    return {**_when(t), "actor": prop, "attach": False, "do": "putdown", **({"to": to} if to else {}), **_dur(duration)}


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
