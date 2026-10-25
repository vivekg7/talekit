"""The kit's API in brief: every public helper's signature and docstring, and the keys of
the lookup tables (BEARDS, TILAK, LOOKS...), read from the modules themselves.

usage: python3 kit/talekit/api.py [module|name ...]
With no argument it prints the whole kit (about 5k tokens, against 25k for people.py
alone); a module name (people, shots...) prints that module, any other name the helpers
and tables it matches. Read this instead of the source: open a function's body only when
its docstring is not enough. Generated from the code, so it cannot go stale."""

import inspect
import pathlib
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


def _doc(obj, indent="    "):
    doc = inspect.getdoc(obj)
    return "".join(f"\n{indent}{ln}" if ln else "\n" for ln in doc.splitlines()) if doc else ""


def describe(name, obj):
    if isinstance(obj, dict):
        return f"{name}: {', '.join(repr(k) for k in obj)}"
    if inspect.isclass(obj):
        out = f"class {name}{inspect.signature(obj)}{_doc(obj)}"
        for m, fn in vars(obj).items():
            if inspect.isfunction(fn) and not m.startswith("_"):
                out += f"\n  .{m}{inspect.signature(fn)}{_doc(fn, '      ')}"
        return out
    return f"{name}{inspect.signature(obj)}{_doc(obj)}"


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
