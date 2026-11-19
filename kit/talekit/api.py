"""The kit's API in brief: every public helper's signature and docstring, and the keys of
the lookup tables (BEARDS, TILAK, LOOKS...), read from the modules themselves.

usage: python3 kit/talekit/api.py [module|name ...]
No argument prints the whole kit (about 5k tokens, against 25k for people.py alone); a
module name (people, shots...) prints that module, any other name the helpers and tables
it matches. Read this instead of the source; open a body only when its docstring is not
enough."""

import inspect
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from talekit import characters, people, scenes, shots, svg

MODULES = {"svg": svg, "characters": characters, "people": people, "scenes": scenes, "shots": shots}


def _public(mod):
    """The names a story script uses: functions and classes defined in the module, and its
    dict tables. Single-shape string constants (SKIN, NECK...) are internal to the wardrobe."""
    for name, obj in vars(mod).items():
        helper = (inspect.isfunction(obj) or inspect.isclass(obj)) and obj.__module__ == mod.__name__
        table = isinstance(obj, dict) and name.isupper()
        if not name.startswith("_") and (helper or table):
            yield name, obj


def _sig(obj):
    """The signature, a function default shown by its name (dhoti(foot=chappal))."""
    return re.sub(r"<function (\w+) at 0x[0-9a-f]+>", r"\1", str(inspect.signature(obj)))


def _doc(obj, indent="    "):
    doc = inspect.getdoc(obj)
    if doc and doc.startswith(f"{obj.__name__}("):  # a namedtuple's own "Torso(front, back, hem)"
        doc = None
    return "".join(f"\n{indent}{ln}" if ln else "\n" for ln in doc.splitlines()) if doc else ""


def describe(name, obj):
    if isinstance(obj, dict):
        return f"{name}: {', '.join(repr(k) for k in obj)}"
    if inspect.isclass(obj):
        out = f"class {name}{_sig(obj)}{_doc(obj)}"
        for m, fn in vars(obj).items():
            if inspect.isfunction(fn) and not m.startswith("_"):
                out += f"\n  .{m}{_sig(fn)}{_doc(fn, '      ')}"
        return out
    return f"{name}{_sig(obj)}{_doc(obj)}"


def main(args):
    picked = [MODULES[a] for a in args if a in MODULES]
    names = {a for a in args if a not in MODULES}
    for key, mod in MODULES.items():
        rows = [
            describe(n, o)
            for n, o in _public(mod)
            if (not args or mod in picked or any(q.lower() in n.lower() for q in names))
        ]
        if rows:
            head = (inspect.getdoc(mod) or "").split("\n\n")[0] if not names else ""
            print(f"## {key}" + (f"\n{head}" if head else ""))
            print("\n".join(rows) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
