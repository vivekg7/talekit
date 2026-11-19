import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { characterBody } from '../src/engine/actor.js';
import { emptyPose } from '../src/engine/motion.js';
import { voiceLines } from '../src/engine/voice.js';
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
# A sage and a temple student: the shaven heads, long locks, a long beard, a mala, a janeu, khadau.
write(sys.argv[1], p.person(
    'w10', 'W10', 235, head=p.shaven_head(beard=True, locks=True), torso=p.kurta(long=330, extras=[p.angavastram(), p.mala()]),
    arms=p.sleeves(), legs=p.dhoti(p.khadau), face=p.face('full', tilak='tripundra', beard='long'),
    eyes=p.eyes('plain'), mouth=p.mouth(dy=8), colors=colors))
write(sys.argv[1], p.person(
    'w11', 'W11', 225, head=p.shaven_head(fringe=False, stubble=True),
    torso=p.kurta(k=0.9, extras=[p.janeu(), p.angavastram(over='shoulder')]), arms=p.sleeves(),
    legs=p.dhoti(p.khadau), face=p.face('thin', tilak='chandan'), eyes=p.eyes('sly'), mouth=p.mouth(dy=4),
    colors=colors))
# A poor priest: bare-chested over the dhoti's waist wrap, a janeu and a shawl over one shoulder.
write(sys.argv[1], p.person(
    'w12', 'W12', 228, head=p.shaven_head(), torso=p.bare_chest(extras=[p.janeu(), p.angavastram(over='shoulder')]),
    arms=p.bare_arms(), legs=p.dhoti(p.khadau, bottom=360), face=p.face('full', tilak='tripundra'), eyes=p.eyes('sly'),
    mouth=p.mouth(dy=8), colors=colors))
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

// A story's golden deer: the library deer copied in, a `sona` look on every fur part.
const GOLDEN = `
import json, sys
from talekit.characters import character, write
deer = json.load(open(f'{sys.argv[1]}/characters/deer.json'))
gold = lambda svg: svg.replace('{furDark}', '{goldDark}').replace('{fur}', '{gold}')
parts = {k: v if isinstance(v, dict) or '{fur' not in v else {'default': v, 'sona': gold(v)}
         for k, v in deer['parts'].items()}
keep = {k: deer[k] for k in ('belly', 'hooves', 'outline', 'shade')}
write(sys.argv[1], character('ruru', 'Ruru', 'quadruped', 180, parts, deer['colors'], **keep))
`;

describe.skipIf(!python)('python kit', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'talekit-kit-'));
    await createProject(root, { title: 'kit' });
    await copyFromLibrary(root, 'hut');
    await copyFromLibrary(root, 'deer');
    await mkdir(path.join(root, 'src', 'scenes'), { recursive: true });
    for (const f of ['cast.py', 'shots.py'])
      await copyFile(path.join(KIT, 'templates', f), path.join(root, 'src', f));
    await copyFile(
      path.join(KIT, 'templates', 'scene.py'),
      path.join(root, 'src/scenes/aangan.py')
    );
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('writes a cast, a scene and shots from the templates that pass talekit check', async () => {
    expect(run([path.join(root, 'src', 'cast.py')])).toContain('wrote matka');
    expect(run([path.join(root, 'src/scenes/aangan.py')])).toContain('wrote aangan');
    expect(run([path.join(root, 'src', 'shots.py')])).toContain('2 shots');
    const project = await loadProject(root);
    expect(Object.keys(project.characters).sort()).toEqual(['beta', 'dada', 'deer', 'matka']);
    expect(project.scenes.aangan.anchors.pathar.use).toMatchObject({ pose: 'sit' });
    expect(validateProject(project)).toEqual([]);
  }, 30_000);

  it('builds every head, torso, limb and face into a person the linter passes', async () => {
    run(['-', root], WARDROBE);
    const project = await loadProject(root);
    const problems = validateProject(project).filter((p) =>
      /character 'w\d+'/.test(p.where + p.message)
    );
    expect(problems).toEqual([]);
    expect(Object.keys(project.characters).filter((id) => /^w\d+$/.test(id))).toHaveLength(13);
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

  it('gives a library animal a look of its own, its new colours completed', async () => {
    run(['-', root], GOLDEN);
    const project = await loadProject(root);
    const ruru = project.characters.ruru;
    expect(validateProject(project).filter((p) => /'ruru'/.test(p.where + p.message))).toEqual([]);
    expect(Object.keys(ruru.parts.body)).toEqual(['default', 'sona']);
    expect(ruru.colors.gold).toMatch(/^#/);
    expect(ruru).toMatchObject({ rig: 'quadruped', hooves: true });
    const look = (face: Record<string, string>) => characterBody(ruru, { ...emptyPose(), face });
    expect(look({ body: 'sona' })).toContain(ruru.colors.gold);
    expect(look({})).not.toContain(ruru.colors.gold);
  }, 30_000);

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

  // Two speakers say the same words; one has changed voice since a take was made of it.
  it('paces each line by the take the engine plays for it, else by the estimate', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'talekit-pace-'));
    await createProject(dir, { title: 'pace', narrator: 'kokoro:hm_nar' });
    await copyFromLibrary(dir, 'hut');
    const voice = async (id: string, v: string) => {
      await copyFromLibrary(dir, 'deer', id);
      const f = path.join(dir, 'characters', `${id}.json`);
      const c = JSON.parse(await readFile(f, 'utf8'));
      // A float written by Python (1.0) is the number 1 to the engine's key.
      await writeFile(f, JSON.stringify({ ...c, voice: 'VOICE' }).replace('"VOICE"', v));
    };
    const X = 'हाँ, यही सही है।';
    const script = `
import sys
from talekit.shots import *
F = Film(sys.argv[1])
t = 0.3
a = [cap(t, '...एक दिन')]
t = F.after(t, '...एक दिन')
a += [say(t, 'a', '${X}')]
t = F.after(t, '${X}')
a += [say(t, 'b', '${X}', emotion='happy')]
t = F.after(t, '${X}')
F.shot('one', 'hut', t, {'a': at(pt(400, 600), emotion='sad'), 'b': at(pt(800, 600), 'left')}, a)
F.write()`;
    const paced = () => {
      run(['-', dir], script);
      return loadProject(dir);
    };
    const takes: Record<string, object> = {};
    const voiceAll = async (secs: Record<string, number>) => {
      for (const l of voiceLines(await paced())) {
        const [engine, name] = [l.voice.engine, l.voice.name];
        takes[l.key] = {
          file: `${l.key}.ogg`,
          voice: `${engine}:${name}`,
          speed: l.voice.speed,
          pitch: l.voice.pitch,
          emotion: l.emotion,
          style: l.style,
          text: l.text,
          duration: secs[l.actor ?? 'narrator'],
          envelope: '',
        };
        await writeFile(path.join(dir, 'audio', 'voices', `${l.key}.ogg`), '');
      }
      await writeFile(path.join(dir, 'audio', 'voices', 'index.json'), JSON.stringify(takes));
    };
    try {
      await mkdir(path.join(dir, 'audio', 'voices'), { recursive: true });
      await voice('a', '"kokoro:hm_old"');
      await voice('b', '{"id": "kokoro:hf_b", "speed": 1.0, "pitch": -2}');
      await voiceAll({ narrator: 2, a: 9, b: 3 });
      await voice('a', '{"id": "kokoro:hm_a", "speed": 0.9}');
      await voiceAll({ narrator: 2, a: 1, b: 3 });
      // Each line its own take plus the linger (0.5) and the gap (0.35); a's old one unused.
      const one = (await paced()).shots[0];
      expect(one.actions.map((a) => a.t)).toEqual([0.3, 3.15, 5]);
      expect(one.duration).toBe(9.45);
      // b's voice changes and nothing has said the line in it yet: the estimate, not a's take.
      await voice('b', '"kokoro:hf_new"');
      const est = Math.round((X.length / 11.5 + 0.9) * 100) / 100;
      expect((await paced()).shots[0].duration).toBe(
        Math.round((5 + est + 0.35 + 0.6) * 100) / 100
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // The brief agents read instead of the source: it must cover the kit and stay brief.
  it('prints the API in brief, whole or narrowed to a module or a name', () => {
    const api = path.join(KIT, 'talekit', 'api.py');
    const all = run([api]);
    for (const name of [
      'person(',
      'shaven_head(',
      'class Film(',
      'putdown(',
      'canopy(',
      'taper(',
      'BEARDS:',
    ])
      expect(all).toContain(name);
    expect(all.length).toBeLessThan(40_000);
    expect(run([api, 'shots'])).not.toContain('## people');
    expect(run([api, 'tilak'])).toMatch(/^## people\nTILAK: /);
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
