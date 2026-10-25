import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFromLibrary } from '../src/library/index.js';
import { createProject, loadProject } from '../src/project/store.js';
import { validateProject } from '../src/project/validate.js';

// The Python kit (kit/talekit) writes JSON the engine reads: run its templates and every
// piece of its wardrobe into a scratch project and hold the result to talekit check.
const KIT = path.resolve('kit');
const python = spawnSync('python3', ['--version']).status === 0;

function run(args: string[], input?: string): string {
  const r = spawnSync('python3', args, {
    input,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: KIT },
  });
  if (r.status !== 0) throw new Error(`python3 ${args.join(' ')} failed:\n${r.stderr}`);
  return r.stdout;
}

// One person for every head, the torsos, arms, legs and feet taken in turn alongside.
const WARDROBE = `
import sys
from talekit import people as p
from talekit.characters import write
heads = [p.short_hair, p.side_part, p.spiky_hair, p.curly_hair, p.head_band, p.pagdi, p.tall_pagdi, p.safa,
         p.plumed_turban, p.crown]
torsos = [lambda: p.kurta(), lambda: p.kurta(long=True, extras=[p.angavastram()]), lambda: p.banyan(extras=[p.gamchha()]),
          lambda: p.tunic(), lambda: p.angrakha('round'), lambda: p.angrakha('slim')]
arms = [p.sleeves(), p.sleeves(bangle=True), p.bare_arms(), p.sleeves(), p.royal_sleeves(), p.royal_sleeves(cloth='coat')]
legs = [p.dhoti(p.chappal), p.pyjama(p.jutti), p.dhoti(p.bare_foot, bottom=358, border=False), p.churidar(p.boot, gather='shin'),
        p.churidar(p.royal_jutti), p.pyjama(p.chappal)]
faces = [p.face(m) for m in (None, 'small', 'trim', 'bushy', 'big', 'curled', 'full')] + [p.face(tilak=t) for t in p.TILAK]
looks = list(p.LOOKS)
colors = dict(skin='#b97a4e', hair='#1f1815', turban='#f6efdc', band='#f08a24', shirt='#3f9a4c', coat='#7d1f35',
              shawl='#2f8a4e', sash='#b8304f', pants='#f7f4ec', border='#a33a3a', shoes='#7a4a26', plumeDark='#d6d2c6')
for i, head in enumerate(heads):
    write(sys.argv[1], p.person(
        f'w{i}', f'W{i}', 230, head=head(), torso=torsos[i % len(torsos)](), arms=arms[i % len(arms)],
        legs=legs[i % len(legs)], face=faces[i % len(faces)], eyes=p.eyes(looks[i % len(looks)]),
        mouth=p.mouth(dy=i % 9, closed=list(p.CLOSED_MOUTHS)[i % 4], angry=('teeth', 'line')[i % 2]),
        colors=colors))
`;

// Every woman's head, torso, arms and skirt, the face options with them; g2 a girl.
const WOMEN = `
import sys
from talekit import people as p
from talekit.characters import write
looks = [p.bun(), p.plait(), p.two_plaits(), p.bun(gajra=False, veil=True)]
dress = [(p.sari(), p.sari_skirt(p.chappal)), (p.kameez(extras=[p.dupatta()]), p.churidar(p.jutti)),
         (p.choli(), p.ghagra()), (p.sari(), p.sari_skirt(p.bare_foot))]
arms = [p.blouse_sleeves(), p.blouse_sleeves('shirt', 'trim', 236), p.blouse_sleeves(bangles=2), p.blouse_sleeves(bangles=0)]
faces = [p.face(tilak='bindi', nose='small', nath=True), p.face(tilak='bindi'), p.face(nose='small'),
         p.face(tilak='bindi', wrinkles=True, glasses=True)]
colors = dict(skin='#b97a4e', hair='#1f1815', sari='#2f8a4e', blouse='#c0392b', shirt='#3f7fbf', dupatta='#f2c230',
              skirt='#e0457b', pants='#f4efe4', shoes='#7a4a26')
for i, head in enumerate(looks):
    torso, legs = dress[i]
    write(sys.argv[1], p.person(
        f'g{i}', f'G{i}', 165 if i == 2 else 230, head=head, torso=torso, arms=arms[i], legs=legs, face=faces[i],
        eyes=p.eyes(('gentle', 'gentle', 'gentle', 'old')[i], brow=4.5, lashes=i < 3), mouth=p.mouth(lips=i != 2),
        head_scale=1.18 if i == 2 else 1, colors=colors))
`;

describe.skipIf(!python)('python kit', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'talekit-kit-'));
    await createProject(root, { title: 'kit' });
    await copyFromLibrary(root, 'hut');
    await mkdir(path.join(root, 'src'));
    for (const f of ['cast.py', 'shots.py'])
      await copyFile(path.join(KIT, 'templates', f), path.join(root, 'src', f));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('writes a cast and shots from the templates that pass talekit check', async () => {
    expect(run([path.join(root, 'src', 'cast.py')])).toContain('wrote matka');
    expect(run([path.join(root, 'src', 'shots.py')])).toContain('2 shots');
    const project = await loadProject(root);
    expect(Object.keys(project.characters).sort()).toEqual(['beta', 'dada', 'matka']);
    expect(validateProject(project)).toEqual([]);
  }, 30_000);

  it('builds every head, torso, limb and face into a person the linter passes', async () => {
    run(['-', root], WARDROBE);
    const project = await loadProject(root);
    const problems = validateProject(project).filter((p) =>
      /character 'w\d+'/.test(p.where + p.message)
    );
    expect(problems).toEqual([]);
    expect(Object.keys(project.characters).filter((id) => /^w\d+$/.test(id))).toHaveLength(10);
  }, 60_000);

  it("builds every piece of the women's wardrobe, plaits swinging, a child's head grown", async () => {
    run(['-', root], WOMEN);
    const project = await loadProject(root);
    const problems = validateProject(project).filter((p) =>
      /character 'g\d+'/.test(p.where + p.message)
    );
    expect(problems).toEqual([]);
    expect(project.characters.g1.springs).toEqual(['plait']);
    expect(project.characters.g2.springs).toEqual(['plaitL', 'plaitR']);
    expect(project.characters.g2.hangs!.plaitL.at).toEqual([45.7, 114.2]);
  }, 60_000);

  it('places a reply after() the line before it, in the order written', () => {
    const out = run([
      '-c',
      "import json; from talekit.shots import *; print(json.dumps([say(1, 'a', 'x'), say(after(0.4), 'b', 'y'), do(0.5, 'a', 'nod')]))",
    ]);
    expect(JSON.parse(out)).toEqual([
      { t: 1, actor: 'a', say: 'x' },
      { after: 0.4, actor: 'b', say: 'y' },
      { t: 0.5, actor: 'a', do: 'nod' },
    ]);
  });

  it('names a colour the parts use but nobody gave', () => {
    const r = spawnSync(
      'python3',
      [
        '-c',
        "from talekit import people as p; p.person('x', 'X', 200, head=p.short_hair(), torso=p.kurta(), arms=p.sleeves(), legs=p.pyjama(), colors={'skin': '#b97a4e'})",
      ],
      { encoding: 'utf8', env: { ...process.env, PYTHONPATH: KIT } }
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/colors missing: .*\{hair\}.*\{pants\}.*\{shirt\}.*\{shoes\}/);
  });
});
