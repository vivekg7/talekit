"""talekit's voice sidecar: text in, speech out, on MLX.

Reads one JSON request per line on stdin and answers each with one JSON line on stdout:

    {"engine": "kokoro", "voice": "hf_alpha", "text": "...", "speed": 1.0, "out": "/abs/x.wav"}
    -> {"ok": true, "out": "/abs/x.wav", "seconds": 2.41}   or   {"ok": false, "error": "..."}

Models stay loaded between lines, so a batch pays the load once. Anything else the
libraries print goes to stderr.
"""

import json
import os
import sys

# Libraries that print to stdout would corrupt the answers: keep stdout for those alone.
answers = os.fdopen(os.dup(sys.stdout.fileno()), "w", buffering=1)
os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

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
    return loaded[engine]


def speak(req):
    m = model(req["engine"])
    kw = {
        "text": req["text"],
        "voice": req["voice"],
        "speed": float(req.get("speed", 1.0)),
    }
    if req["engine"] == "kokoro":
        # Kokoro's voice names start with their language: a(merican), b(ritish), h(indi)...
        kw["lang_code"] = req["voice"][0]
    audio = np.concatenate(
        [np.array(r.audio, dtype=np.float32) for r in m.generate(**kw)]
    )
    os.makedirs(os.path.dirname(req["out"]), exist_ok=True)
    write_audio(req["out"], audio, m.sample_rate)
    return {
        "ok": True,
        "out": req["out"],
        "seconds": round(len(audio) / m.sample_rate, 3),
    }


for line in sys.stdin:
    if not line.strip():
        continue
    try:
        answer = speak(json.loads(line))
    except Exception as e:  # noqa: BLE001 - one bad line must not end the batch
        answer = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    answers.write(json.dumps(answer, ensure_ascii=False) + "\n")
