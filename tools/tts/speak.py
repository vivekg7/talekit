"""talekit's voice sidecar: text in, speech out, on MLX.

Reads one JSON request per line on stdin and answers each with one JSON line on stdout:

    {"engine": "kokoro", "voice": "hf_alpha", "text": "...", "speed": 1.0,
     "emotion": "happy", "style": "speech", "out": "/abs/x.wav"}
    -> {"ok": true, "out": "/abs/x.wav", "seconds": 2.41}   or   {"ok": false, "error": "..."}

`emotion` is the speaker's (neutral, happy, sad, surprised, angry, scared) and `style` the
line's (speech, thought, shout, narration, title), for an engine that can act on them.
Models stay loaded between lines, so a batch pays the load once. Anything else the
libraries print goes to stderr.
"""

import json
import os
import sys

# Libraries that print to stdout would corrupt the answers: keep stdout for those alone.
answers = os.fdopen(os.dup(sys.stdout.fileno()), "w", buffering=1)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

import mlx.core as mx
import numpy as np


def use_system_espeak():
    """Kokoro reads non-English text through espeak-ng. The pip loader's bundled copy looks
    for its data at the path it was built in; a Homebrew install works, so prefer it."""
    for prefix in ("/opt/homebrew", "/usr/local"):
        lib = f"{prefix}/lib/libespeak-ng.1.dylib"
        data = f"{prefix}/share/espeak-ng-data"
        if os.path.exists(lib) and os.path.isdir(data):
            import espeakng_loader

            espeakng_loader.get_library_path = lambda lib=lib: lib
            espeakng_loader.get_data_path = lambda data=data: data
            return


use_system_espeak()

from mlx_audio.audio_io import write as write_audio
from mlx_audio.tts.utils import load_model

MODELS = {"kokoro": "mlx-community/Kokoro-82M-bf16"}
loaded = {}


def model(engine):
    if engine not in MODELS:
        raise ValueError(f"unknown engine '{engine}' (have: {', '.join(MODELS)})")
    if engine not in loaded:
        loaded[engine] = load_model(MODELS[engine])
        if engine == "kokoro":
            fix_hindi(loaded[engine])
    return loaded[engine]


def fix_hindi(m):
    """Two espeak-ng slips in Hindi that Kokoro hears wrong. It writes the flap in ड़ and ढ़
    as its internal name `r.`, whose dot Kokoro reads as a full stop (पकड़ लिया came out as
    "pakar. liya"); Kokoro has the IPA letter ɽ. And it reads ऊँ as "un" (जाऊँगा as
    "jaunga") but ऊं as the nasal vowel it is."""
    pipe = m._get_pipeline("h")
    g2p = pipe.g2p

    def fixed(text):
        ps, tokens = g2p(text.replace("ऊँ", "ऊं"))
        return ps.replace("r.", "ɽ"), tokens

    pipe.g2p = fixed
    act(m)


# Kokoro has no emotion control, but it predicts a pitch curve before it makes the sound,
# and that curve can be bent: a wider range around the line's own median pitch is livelier,
# a narrower one flatter; a raised pitch is tenser, a lowered one heavier. With the pace,
# that is what each emotion changes. (range: excursions times this; shift: semitones.)
MOOD = {
    "neutral": {"range": 1.0, "shift": 0.0, "speed": 1.0},
    "happy": {"range": 1.35, "shift": 1.0, "speed": 1.05},
    "surprised": {"range": 1.6, "shift": 2.0, "speed": 1.05},
    "angry": {"range": 1.45, "shift": 1.0, "speed": 1.05},
    "scared": {"range": 1.5, "shift": 2.5, "speed": 1.12},
    "sad": {"range": 0.75, "shift": -1.5, "speed": 0.88},
}
STYLE = {
    "shout": {"range": 1.1, "shift": 1.0, "speed": 1.0},
    "thought": {"range": 0.9, "shift": 0.0, "speed": 0.95},
}
mood = {"range": 1.0, "shift": 0.0}


def act(m):
    """Bend Kokoro's predicted pitch by the current `mood`."""
    predict = m.predictor.F0Ntrain

    def bent(x, s):
        f0, n = predict(x, s)
        if mood["range"] == 1.0 and mood["shift"] == 0.0:
            return f0, n
        f = np.array(f0, dtype=np.float32)
        voiced = f > 40
        if voiced.any():
            lf = np.log(np.maximum(f, 1.0))
            median = np.median(lf[voiced])
            lf = median + mood["range"] * (lf - median) + mood["shift"] * np.log(2) / 12
            f = np.where(voiced, np.exp(lf), f)
        return mx.array(f), n

    m.predictor.F0Ntrain = bent


def delivery(req):
    """How a line is said, from its speaker's emotion and its style: pitch range, shift, pace."""
    e = MOOD.get(req.get("emotion", "neutral"), MOOD["neutral"])
    s = STYLE.get(
        req.get("style", "speech"), {"range": 1.0, "shift": 0.0, "speed": 1.0}
    )
    return {
        "range": e["range"] * s["range"],
        "shift": e["shift"] + s["shift"],
        "speed": e["speed"] * s["speed"],
    }


def kokoro_line(req):
    """Kokoro saying a line, its pitch curve bent by the line's emotion."""
    m = model("kokoro")
    d = delivery(req)
    mood.update(range=d["range"], shift=d["shift"])
    out = m.generate(
        text=req["text"],
        voice=req["voice"],
        speed=float(req.get("speed", 1.0)) * d["speed"],
        # Kokoro's voice names start with their language: a(merican), b(ritish), h(indi)...
        lang_code=req["voice"][0],
    )
    return np.concatenate(
        [np.array(r.audio, dtype=np.float32) for r in out]
    ), m.sample_rate


def speak(req):
    if req["engine"] not in MODELS:
        raise ValueError(
            f"unknown engine '{req['engine']}' (have: {', '.join(MODELS)})"
        )
    audio, rate = kokoro_line(req)
    os.makedirs(os.path.dirname(req["out"]), exist_ok=True)
    write_audio(req["out"], audio, rate)
    return {"ok": True, "out": req["out"], "seconds": round(len(audio) / rate, 3)}


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        answer = speak(json.loads(line))
    except Exception as e:  # noqa: BLE001 - one bad line must not end the batch
        answer = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    answers.write(json.dumps(answer, ensure_ascii=False) + "\n")
