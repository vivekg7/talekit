"""talekit's Python kit: helpers for the generator scripts that write a story's JSON.

A story's characters, scenes and shots are JSON (docs/authoring-guide.md). Writing them
from a script in the project's src/ keeps a film editable: change a line, run it again.
This kit is the code those scripts kept rewriting:

  svg         drawing primitives: fill, line, stroke, ribbon, taper, poly, gem, sx, shades
  characters  character() and prop() with their colours completed and checked; write()
  people      a wardrobe on the humanoid rig: heads, torsos, arms, legs, feet, faces; person()
  scenes      painting helpers (blob, canopy, tufts, stick) and write()
  shots       Film (voice-paced timing, shot files) and the action helpers
  api         prints all of the above in brief: python3 kit/talekit/api.py [module|name]

Start from kit/templates (cast.py, shots.py): copy them into <project>/src/ and edit.
Inside the talekit repo a script finds the kit by walking up from itself (the header in
the templates); elsewhere run it with PYTHONPATH=<talekit>/kit. No dependencies beyond
the standard library."""
