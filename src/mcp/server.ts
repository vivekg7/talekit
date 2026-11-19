import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { composeFrame } from '../engine/compose.js';
import { movieDuration, STAGE_SHORTCUTS } from '../engine/timeline.js';
import { staging, stagedWhat } from '../engine/stage.js';
import {
  AnchorSchema,
  CharacterSchema,
  SceneSchema,
  MixSchema,
  MusicSchema,
  ShotSchema,
  VoiceSchema,
  type Character,
  type Project,
  type Scene,
  type Shot,
  type Voice,
} from '../engine/types.js';
import { timeActions, voiceLines } from '../engine/voice.js';
import { LIBRARY, nameFromId } from '../library/index.js';
import {
  createProject,
  isProject,
  loadProject,
  projectPaths,
  saveCharacter,
  saveMeta,
  saveScene,
  saveShot,
  storedShot,
  shotOrder,
} from '../project/store.js';
import { listActions, patchShot, SETTABLE } from '../project/patch.js';
import {
  formatProblems,
  hasErrors,
  musicProblems,
  sceneSoundProblems,
  validateCharacter,
  voiceProblems,
  speechProblems,
  validateProject,
  validateScene,
  validateShot,
  worldProblems,
  type Problem,
} from '../project/validate.js';
import { rasterize } from '../render/raster.js';
import { criticSheetsSvg, readThrough } from '../render/critic.js';
import { guidePath, guideSection } from '../project/guide.js';
import {
  audioMapSvg,
  characterSheetSvg,
  constructionSheetSvg,
  contactSheetSvg,
  filmSheetSvg,
  findingFrameSvg,
  sceneSheetSvg,
} from '../render/sheets.js';
import { faceFallbacks } from '../engine/motion.js';
import { writeMkv } from '../render/mkv.js';
import { isPortrait } from '../engine/format.js';
import { renderVideo } from '../render/video.js';
import { openInBrowser } from '../viewer/open.js';
import { startReview, type Review } from '../viewer/server.js';
import { hearingLines, makeVoices } from '../project/voices.js';
import { MOUTH_SOUNDS, SOUNDS, STARTLES } from '../library/sounds.js';
import { VOICES } from '../library/voices.js';
import { describeNote, loadNotes, markSpot, setNoteStatus, type Note } from '../project/notes.js';
import { choiceDirs, listOptions, type Question } from '../project/options.js';

type Content =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };

const text = (t: string): Content => ({ type: 'text', text: t });
const image = (svg: string, width?: number): Content => ({
  type: 'image',
  data: rasterize(svg, width).toString('base64'),
  mimeType: 'image/png',
});
/**
 * The picture a write returns, drawn smaller than the sheet itself: a picture costs tokens in
 * proportion to its area, and comes back on every write. These widths were checked by eye
 * to keep faces, poses and Devanagari bubbles readable; preview_shot and preview_frame stay
 * at full size for a closer look.
 */
const SHOT_SHEET = 1000;
const POSE_SHEET = 1200;
const SCENE_SHEET = 1000;
const reduced = (svg: string, width: number): Content => {
  const own = Number(svg.match(/^<svg[^>]*\swidth='([\d.]+)'/)?.[1]);
  return image(svg, own > width ? width : undefined);
};
const ok = (...content: Content[]) => ({ content });

/** Findings drawn as ringed frames, at most this many a write (each costs tokens). */
const FINDING_FRAMES = 3;
const FINDING_FRAME = 800;

/**
 * The world findings of a shot just written: the text, and a ringed frame of the first few.
 * They do not stop the write (the agent looks at the shot and fixes it), only the render.
 */
function worldReport(project: Project, shot: Shot): { text: string; frames: Content[] } {
  const turns = staging(project, project.scenes[shot.scene], shot);
  const staged = turns.length
    ? `\n\nThe engine added: ${turns.map((a) => `${stagedWhat(a)} at ${a.t.toFixed(2)}s (${a.staged})`).join('; ')}.`
    : '';
  const problems = worldProblems(project, [shot]);
  if (!problems.length) return { text: staged, frames: [] };
  const frames = problems
    .slice(0, FINDING_FRAMES)
    .map((p) => reduced(findingFrameSvg(project, p.finding!), FINDING_FRAME));
  return {
    text:
      staged +
      `\n\nWorld: ${problems.length} finding${problems.length > 1 ? 's' : ''}, each an error that blocks the render until fixed or waived in \`allow\` with a reason${problems.length > FINDING_FRAMES ? ` (the first ${FINDING_FRAMES} pictured)` : ' (pictured)'}:\n` +
      formatProblems(problems),
    frames,
  };
}

/** Errors that stop a write: all but the world's, which the agent must see the result to fix. */
const blocking = (problems: Problem[]) => problems.filter((p) => p.level === 'error' && !p.code);

/** Check and save a scene for write_scene and copy_from_library alike: its world findings come
 * back with the anchor sheet and block only the render. */
async function writeScene(root: string, scene: Scene) {
  const project = await loadProject(root);
  const problems = [
    ...validateScene(scene, project.meta.width, project.meta.height),
    ...sceneSoundProblems(scene, project),
  ];
  if (blocking(problems).length) return fail(formatProblems(problems));
  const file = await saveScene(root, scene);
  return ok(
    text(`wrote ${file}\n${formatProblems(problems)}`),
    reduced(sceneSheetSvg(project, scene), SCENE_SHEET)
  );
}

/**
 * Speak the lines in these shots that have no audio yet, and say what happened in a line
 * for the tool's text. Never throws: without the sidecar the lines stay silent, on
 * estimated timings, and the agent is told so once per call.
 */
async function voice(root: string, project: Project, shots: Shot[]): Promise<string> {
  try {
    const r = await makeVoices(root, project, shots);
    if (!r.made && !r.failed.length && !r.heard && !r.doubtful.length && !r.hearError) return '';
    const failed = r.failed.map(
      (f) => `\n  failed: ${f.line.shot} action ${f.line.action}: ${f.error}`
    );
    const heard = hearingLines(r).map((l) => `\n${l}`);
    return `\nvoices: ${r.made} line${r.made === 1 ? '' : 's'} spoken${failed.join('')}${heard.join('')}`;
  } catch (e) {
    return `\nvoices: not spoken (${(e as Error).message}); lines stay silent and are timed by their words`;
  }
}
/** Validation text plus which emotions will not get the face variant they prefer. */
const characterReport = (c: Character, problems: Problem[]): string => {
  const fallbacks = faceFallbacks(c.parts);
  return (
    formatProblems(problems) +
    (fallbacks.length
      ? `\nFallbacks (add the variant or accept the substitute):\n- ${fallbacks.join('\n- ')}`
      : '')
  );
};
const fail = (message: string) => ({ content: [text(message)], isError: true as const });

/** A layer longer than this was painted by a generator, not written: tens of thousands of
 * tokens of path data that teach nothing a hand-drawn scene does not. */
const LONG_ART = 8000;

/** A library item as get_library_item shows it: painted scene layers left out. */
function libraryItemForReading(item: Character | Scene): object {
  if ('rig' in item) return item;
  const out: Record<string, unknown> = { ...item };
  for (const k of ['far', 'svg', 'foreground', 'near'] as const) {
    const v = item[k];
    if (v && v.length > LONG_ART)
      out[k] =
        `(${v.length} characters of painted SVG, left out; copy_from_library uses it as it is)`;
  }
  return out;
}

function soundSummary(project: Project): string {
  const { music, narrator } = project.meta;
  const name = (v: Voice) => (typeof v === 'string' ? v : v.id);
  const lines = voiceLines(project);
  const spoken = lines.filter((l) => project.audio?.voices[l.key]).length;
  const silent = Object.values(project.characters)
    .filter(
      (c) => !c.voice && project.shots.some((s) => s.actions.some((a) => a.actor === c.id && a.say))
    )
    .map((c) => c.id);
  return [
    `music: ${music ? (typeof music === 'string' ? music : music.track) : 'none'} · narrator: ${narrator ? name(narrator) : 'none'}`,
    `voiced lines: ${spoken} of ${lines.length} spoken${spoken < lines.length ? ' (the rest are spoken on the next write or render)' : ''}`,
    ...(silent.length ? [`speak with no voice (silent): ${silent.join(', ')}`] : []),
  ].join('\n');
}

/** The open questions, for project_info: each choice, and whether it has been picked. */
function optionLines(options: Question[]): string[] {
  if (!options.length) return [];
  return [
    '',
    '## Options (options/: the person picks one in the review app; list_notes has the pick)',
    ...options.map(
      (q) =>
        `- ${q.id}${q.ask ? ` (${q.ask})` : ''}: as it is, ${q.choices.map((c) => c.id).join(', ')} · shows in ${q.touches.join(', ') || 'no shot'}`
    ),
  ];
}

function describeProject(
  root: string,
  project: Project,
  problems: Problem[],
  notes: Note[],
  options: Question[] = []
): string {
  const open = notes.filter((n) => n.status === 'open');
  const lines = [
    `# ${project.meta.title}`,
    `${project.meta.width}x${project.meta.height} @ ${project.meta.fps}fps · ${project.shots.length} shots · ${movieDuration(project).toFixed(1)}s total`,
    '',
    '## Characters',
    ...Object.values(project.characters).map(
      (c) =>
        `- ${c.id} (${c.name}, rig ${c.rig}, height ${c.height}) parts: ${Object.entries(c.parts)
          .map(([k, v]) => (typeof v === 'string' ? k : `${k}{${Object.keys(v).join('|')}}`))
          .join(
            ', '
          )}${Object.keys(c.colors).length ? ` colors: ${Object.keys(c.colors).join(', ')}` : ''}`
    ),
    '',
    '## Scenes',
    ...Object.values(project.scenes).map(
      (s) =>
        `- ${s.id} (${s.name}) anchors: ${Object.keys(s.anchors).join(', ') || 'none'}; shortcuts: ${STAGE_SHORTCUTS.join(', ')}`
    ),
    '',
    '## Shots (playback order)',
    ...project.shots.map(
      (s, i) =>
        `${i + 1}. ${s.id} — scene ${s.scene}, ${s.duration}s, cast: ${Object.keys(s.cast).join(', ') || 'none'}, ${s.actions.length} actions`
    ),
    '',
    '## Sound',
    soundSummary(project),
    '',
    '## Validation',
    formatProblems(problems),
    '',
    '## Review notes',
    open.length
      ? `${open.length} open — call list_notes to see them with pictures, fix each, then resolve_note.`
      : 'none open',
    `Review app: open_review, or \`talekit serve ${projectPaths(root).root} --open\` (the person leaves notes there)`,
    ...optionLines(options),
  ];
  return lines.join('\n');
}

const pathArg = z.string().describe('Absolute path of the project directory');

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'talekit', version: '0.1.0' });

  server.registerTool(
    'get_guide',
    {
      title: 'Authoring guide',
      description:
        'READ THIS FIRST. The authoring guide: the workflow and the file format of characters, scenes and shots, sound, the reel and the critic. Other tools point to its sections by name.',
      inputSchema: {},
    },
    async () => ok(text(await readFile(guidePath(), 'utf8')))
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description:
        'Create a project directory: talekit.json and empty characters/, scenes/, shots/ and out/.',
      inputSchema: {
        path: pathArg,
        title: z.string(),
        width: z
          .number()
          .int()
          .optional()
          .describe('Default 1280; 720 for a portrait reel (authoring guide, A reel)'),
        height: z.number().int().optional().describe('Default 720; 1280 for a reel'),
        fps: z.number().int().optional().describe('Default 24'),
      },
    },
    async ({ path: root, title, width, height, fps }) => {
      try {
        const meta = await createProject(root, {
          title,
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          ...(fps ? { fps } : {}),
        });
        return ok(
          text(`created ${projectPaths(root).root} (${meta.width}x${meta.height} @ ${meta.fps}fps)`)
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'project_info',
    {
      title: 'Project info',
      description:
        'Summary of a project: characters with their parts and variants, scenes with anchors, shots in playback order, sound, validation problems, open review notes and options.',
      inputSchema: { path: pathArg },
    },
    async ({ path: root }) => {
      try {
        const project = await loadProject(root);
        return ok(
          text(
            describeProject(
              root,
              project,
              validateProject(project),
              await loadNotes(root),
              await listOptions(root, project)
            )
          )
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'get_item',
    {
      title: 'Get character, scene or shot',
      description:
        'The stored JSON of one character, scene or shot, to edit and write back; for a shot, also its actions numbered as patch_shot addresses them.',
      inputSchema: { path: pathArg, kind: z.enum(['character', 'scene', 'shot']), id: z.string() },
    },
    async ({ path: root, kind, id }) => {
      try {
        const project = await loadProject(root);
        const item =
          kind === 'character'
            ? project.characters[id]
            : kind === 'scene'
              ? project.scenes[id]
              : project.shots.find((s) => s.id === id);
        if (!item) return fail(`no ${kind} '${id}'`);
        const json = JSON.stringify(kind === 'shot' ? storedShot(item as Shot) : item, null, 2);
        if (kind !== 'shot') return ok(text(json));
        return ok(
          text(`${json}\n\nActions by index (for patch_shot):\n${listActions(item as Shot)}`)
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'list_library',
    {
      title: 'List built-in library',
      description:
        'Built-in characters and scenes to copy (copy_from_library) and recolour: far more reliable than drawing from scratch. Scenes ending in -tall are 720x1280, for a reel; the rest 1280x720.',
      inputSchema: {},
    },
    async () =>
      ok(
        text(
          [
            '## Characters',
            ...Object.values(LIBRARY.characters).map(
              (c) =>
                `- ${c.id}: ${c.description} rig=${c.rig} height=${c.height} colors: ${JSON.stringify(c.colors)}`
            ),
            '',
            '## Scenes',
            ...Object.values(LIBRARY.scenes).map(
              (s) => `- ${s.id}: ${s.description} anchors: ${Object.keys(s.anchors).join(', ')}`
            ),
          ].join('\n')
        )
      )
  );

  server.registerTool(
    'get_library_item',
    {
      title: 'Get library item JSON',
      description:
        'The JSON of a built-in character or scene, without copying it. Before write_character, read one on the same rig (`kid` humanoid, `dog` quadruped, `bird` simple) to see how its parts and variants are laid out. A painted scene comes back without its long SVG layers: copy it instead, and its anchor sheet shows the picture.',
      inputSchema: { libraryId: z.string() },
    },
    async ({ libraryId }) => {
      const item = LIBRARY.characters[libraryId] ?? LIBRARY.scenes[libraryId];
      if (!item)
        return fail(
          `no library item '${libraryId}'; available: ${[...Object.keys(LIBRARY.characters), ...Object.keys(LIBRARY.scenes)].join(', ')}`
        );
      return ok(text(JSON.stringify(libraryItemForReading(item), null, 2)));
    }
  );

  server.registerTool(
    'copy_from_library',
    {
      title: 'Copy from library',
      description:
        'Copy a built-in character or scene into the project, optionally under a new id, name, colours, height or (scene) added anchors. Returns the pose sheet (a library drawing already passes construction) or the anchor sheet; a scene is checked and saved as write_scene does it, world findings included.',
      inputSchema: {
        path: pathArg,
        libraryId: z.string(),
        asId: z
          .string()
          .optional()
          .describe('New id in the project (default: same as the library id)'),
        name: z
          .string()
          .optional()
          .describe(
            "Display name (default: a character's from asId, 'old-man' → 'Old man'; else the library name)"
          ),
        colors: z
          .record(z.string(), z.string())
          .optional()
          .describe('Colour token overrides, e.g. { "hair": "#f4d35e" }'),
        height: z.number().positive().optional().describe('On-screen height override in pixels'),
        anchors: z
          .record(z.string(), AnchorSchema)
          .optional()
          .describe(
            'Scene only: anchors added, or replacing one of the same name, e.g. { "well": { "x": 400, "y": 652 } }'
          ),
      },
    },
    async ({ path: root, libraryId, asId, name, colors, height, anchors }) => {
      try {
        const c = LIBRARY.characters[libraryId];
        if (c) {
          const character = CharacterSchema.parse({
            ...c,
            id: asId ?? c.id,
            name: name ?? (asId ? nameFromId(asId) : c.name),
            colors: { ...c.colors, ...(colors ?? {}) },
            ...(height ? { height } : {}),
          });
          const file = await saveCharacter(root, character);
          return ok(
            text(`wrote ${file}\n${characterReport(character, validateCharacter(character))}`),
            reduced(characterSheetSvg(character), POSE_SHEET)
          );
        }
        const s = LIBRARY.scenes[libraryId];
        if (s) {
          const scene = SceneSchema.parse({
            ...s,
            id: asId ?? s.id,
            name: name ?? s.name,
            anchors: { ...s.anchors, ...(anchors ?? {}) },
          });
          return await writeScene(root, scene);
        }
        return fail(`no library item '${libraryId}'`);
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'write_character',
    {
      title: 'Write character',
      description:
        "Validate and save a character (characters/<id>.json, created or replaced). Format: authoring guide, Coordinate boxes (rigs, variants, springs, pivots and chains), Drawing style and Construction; the engine draws the outline and shading, so draw neither. Returns two pictures. The pose sheet: every pose and expression the engine can produce, a cell per variant of any other part, `springs` parts thrown as far as follow-through throws them, and what the character's extras do (`ends` standing and mid-stride, a bow drawn back, a person aiming and just after a `shoot`, a `sail` prop leaned in a gale). The construction sheet: part boxes and pivots, the silhouette, swing poses that open a gap at a joint, springs labelled ~, and a numbered red box per numbered warning. Rewrite until both sheets look right and the warnings are gone. A new `voice` speaks this character's unvoiced lines in every shot.",
      inputSchema: { path: pathArg, character: CharacterSchema },
    },
    async ({ path: root, character }) => {
      try {
        const problems = validateCharacter(character);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveCharacter(root, character);
        // A new or changed voice speaks every line of this character's that has no audio in it.
        const spoken = character.voice
          ? await loadProject(root).then((p) => voice(root, p, p.shots))
          : '';
        return ok(
          text(`wrote ${file}\n${characterReport(character, problems)}${spoken}`),
          reduced(characterSheetSvg(character), POSE_SHEET),
          image(constructionSheetSvg(character))
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'write_scene',
    {
      title: 'Write scene',
      description:
        "Validate and save a scene (scenes/<id>.json). Format: authoring guide, Scenes and its subsections. Returns the anchor sheet, to check against the art: anchors and stage shortcuts marked (a `use` anchor's facing as an arrow, its `at` as a pink cross), a ghost of the project's tallest character (220px if none) for scale, drawn at five depths in cyan with a `perspective`, walk areas hatched green, water blue, climb orange and solids red, and lights ringed in yellow with the shadow each throws of the ghost. A layered scene adds each layer alone and the camera zoomed into either side (`far` must still fill the frame); one with `weather`, `effects` or `sway` adds the empty scene at a few moments, each swaying group's pivot ringed in pink with the arc its far end sweeps (over 40 px warns). World findings (no walk areas, an anchor on no walk or water area, a `scale` off the perspective) do not stop the save, but block the render until fixed or waived in `allow` with a reason.",
      inputSchema: { path: pathArg, scene: SceneSchema },
    },
    async ({ path: root, scene }) => {
      try {
        return await writeScene(root, scene);
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'write_shot',
    {
      title: 'Write shot',
      description:
        "Validate and save a shot (shots/<NN>-<id>.json; `order` sets NN, its place in the film). Format: authoring guide, Shots and its subsections. A broken cross-reference (cast, anchors, variants, `to`, `attach`, `on`, archery, `crossfade`) stops the write; warnings cover lines that overlap, are cut off by the shot's end or write a sound out for the voice to read. Lines with a voice, and captions when there is a narrator, are spoken now, so `after` timings follow the real voice. The text lists the turns, walks and sits the engine added: do not stage those. Once saved, the world check plays the shot (authoring guide, World findings); each finding comes back as an error with a frame of it, the spot ringed, and blocks the render until fixed or waived in `allow` with a reason (only when the film means it: a ghost floats). Returns a contact sheet of evenly spaced frames with the sound lanes under it (a line outlined in red is cut off), drawn smaller than preview_shot draws it.",
      inputSchema: {
        path: pathArg,
        shot: ShotSchema,
        order: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Playback position (1 = first). Shots play in filename order.'),
        frames: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe('Contact sheet frames (default 6)'),
      },
    },
    async ({ path: root, shot, order, frames }) => {
      try {
        const project = await loadProject(root);
        timeActions(project, shot);
        const problems = validateShot(shot, project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveShot(root, shot, order);
        const fresh = await loadProject(root);
        const saved = fresh.shots.find((s) => s.id === shot.id)!;
        // Spoken now, so the warnings and the sheet go by how long each line really takes.
        const spoken = await voice(root, fresh, [saved]);
        const world = worldReport(fresh, saved);
        return ok(
          text(
            `wrote ${file}${spoken}\n${formatProblems(validateShot(saved, fresh))}${world.text}`
          ),
          reduced(contactSheetSvg(fresh, saved, frames ?? 6), SHOT_SHEET),
          ...world.frames
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'patch_shot',
    {
      title: 'Patch shot',
      description:
        'Change a saved shot without rewriting it: replace top-level fields (`set`), add, replace or remove cast members (`cast`), merge fields into actions by index (`edit`), take actions out (`remove`) or add new ones (`add`). Indices are the actions before the patch, as get_item lists them. Validated and checked as write_shot is; the shot keeps its place. Returns the actions renumbered and a contact sheet of the stretch the change shows in (the whole shot after `set` or `cast`). To restage a shot from scratch, use write_shot.',
      inputSchema: {
        path: pathArg,
        shotId: z.string(),
        set: z
          .partialRecord(z.enum(SETTABLE), z.unknown())
          .optional()
          .describe(
            `Top-level fields replaced whole (${SETTABLE.join(', ')}); null drops an optional one`
          ),
        cast: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Cast members by id, each added or replaced whole, or null to take one out'),
        edit: z
          .array(
            z.object({
              index: z.number().int().min(0),
              fields: z
                .record(z.string(), z.unknown())
                .describe(
                  'Fields to change, e.g. { "t": 3.5 } or { "say": "…" }; null removes one. An action timed `after` a line takes { "after": 0.5 }, or { "t": 3.5, "after": null } for a fixed time'
                ),
            })
          )
          .optional(),
        remove: z
          .array(z.number().int().min(0))
          .optional()
          .describe('Indices of actions to take out'),
        add: z
          .array(z.record(z.string(), z.unknown()))
          .optional()
          .describe('New actions, as in write_shot; each takes its place by t'),
        frames: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe(
            'Contact sheet frames (default 4 over the changed stretch, 6 over a whole shot)'
          ),
      },
    },
    async ({ path: root, shotId, set, cast, edit, remove, add, frames }) => {
      try {
        const project = await loadProject(root);
        const before = project.shots.find((s) => s.id === shotId);
        if (!before) return fail(`no shot '${shotId}'`);
        const { shot, from, to } = patchShot(before, { set, cast, edit, remove, add }, project);
        const problems = validateShot(shot, project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveShot(root, shot, await shotOrder(root, shotId));
        const fresh = await loadProject(root);
        const saved = fresh.shots.find((s) => s.id === shotId)!;
        const spoken = await voice(root, fresh, [saved]);
        const whole = from === 0 && to === saved.duration;
        const world = worldReport(fresh, saved);
        return ok(
          text(
            `wrote ${file}${spoken}\n${formatProblems(validateShot(saved, fresh))}${world.text}\n\nActions now:\n${listActions(saved)}` +
              (whole
                ? ''
                : `\n\nSheet: ${from.toFixed(2)}s to ${to.toFixed(2)}s of ${saved.duration}s`)
          ),
          reduced(
            contactSheetSvg(fresh, saved, frames ?? (whole ? 6 : 4), 2, from, to),
            SHOT_SHEET
          ),
          ...world.frames
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'delete_item',
    {
      title: 'Delete character, scene or shot',
      description: 'Remove one file from the project.',
      inputSchema: { path: pathArg, kind: z.enum(['character', 'scene', 'shot']), id: z.string() },
    },
    async ({ path: root, kind, id }) => {
      try {
        const p = projectPaths(root);
        if (kind === 'shot') {
          const shot = (await loadProject(root)).shots.find((s) => s.id === id);
          if (!shot) return fail(`no shot '${id}'`);
          // Saved with no order, the file is <id>.json whatever its prefix was.
          await saveShot(root, shot);
          await rm(path.join(p.shots, `${id}.json`));
        } else {
          const file = path.join(kind === 'character' ? p.characters : p.scenes, `${id}.json`);
          if (!existsSync(file)) return fail(`no ${kind} '${id}'`);
          await rm(file);
        }
        return ok(text(`deleted ${kind} '${id}'`));
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'preview_frame',
    {
      title: 'Preview one frame',
      description:
        "One frame of a shot at t seconds from its start, at full size. debug marks the anchors and each actor's feet point.",
      inputSchema: {
        path: pathArg,
        shotId: z.string(),
        t: z.number().min(0),
        debug: z.boolean().optional(),
      },
    },
    async ({ path: root, shotId, t, debug }) => {
      try {
        const project = await loadProject(root);
        const shot = project.shots.find((s) => s.id === shotId);
        if (!shot) return fail(`no shot '${shotId}'`);
        return ok(text(`${shotId} @ ${t}s`), image(composeFrame(project, shot, t, { debug })));
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'preview_shot',
    {
      title: 'Preview a shot',
      description:
        'Contact sheet of evenly spaced frames of a shot (default 6) at full size: the closer look at the smaller sheet write_shot or patch_shot returned.',
      inputSchema: {
        path: pathArg,
        shotId: z.string(),
        frames: z.number().int().min(1).max(12).optional(),
      },
    },
    async ({ path: root, shotId, frames }) => {
      try {
        const project = await loadProject(root);
        const shot = project.shots.find((s) => s.id === shotId);
        if (!shot) return fail(`no shot '${shotId}'`);
        return ok(
          text(`${shotId}: ${shot.duration}s`),
          image(contactSheetSvg(project, shot, frames ?? 6))
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'render',
    {
      title: 'Render video',
      description:
        'Render the whole film (or one shot) to an mp4 in <project>/out/ with its sound, speaking any unvoiced lines first. The whole film, unless a portrait reel, also gets movie.mkv (authoring guide, Subtitles and the .mkv). Validation errors block it, world findings included, and so does a voiced line no take says (`speech.mismatch`: reword it, or listen and waive it). A minute of 720p takes about ten seconds. Returns a film sheet: one frame from the middle of each shot rendered.',
      inputSchema: { path: pathArg, shotId: z.string().optional() },
    },
    async ({ path: root, shotId }) => {
      try {
        const project = await loadProject(root);
        const problems = validateProject(project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const shots = shotId ? project.shots.filter((s) => s.id === shotId) : project.shots;
        if (!shots.length) return fail(shotId ? `no shot '${shotId}'` : 'no shots to render');
        const p = projectPaths(root);
        const outPath = shotId ? path.join(p.out, `${shotId}.mp4`) : p.movie;
        const started = Date.now();
        const spoken = await voice(root, project, shots);
        // A take spoken just now that no retake could make say its line stops it too.
        const misspoken = speechProblems(project, shots);
        if (hasErrors(misspoken)) return fail(`${spoken.trim()}\n${formatProblems(misspoken)}`);
        const r = await renderVideo(project, { outPath, shots });
        let mkv = '';
        // A reel is posted as the one mp4; only a film gets the .mkv beside it.
        if (!shotId && !isPortrait(project.meta)) {
          const file = outPath.replace(/\.mp4$/, '.mkv');
          const m = await writeMkv(project, outPath, file);
          mkv = `\n${file}: sound ${m.audio.join(', ') || 'none'}; subtitles ${m.subtitles.join(', ') || 'none'}`;
        }
        return ok(
          text(
            `rendered ${outPath}: ${r.seconds.toFixed(1)}s, ${r.frames} frames, in ${((Date.now() - started) / 1000).toFixed(1)}s${spoken}${mkv}\n${formatProblems(problems)}`
          ),
          image(filmSheetSvg(project, shots))
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'critique',
    {
      title: 'Critique a film',
      description:
        "Look at the film as the person will, for what the checks cannot judge (authoring guide, The critic); best done by an agent that did not write it. Without shotId: the critic's checklist and the read-through (every line in the order heard, with its time, speaker, voice and English, and the stretches where nobody speaks). With shotId: the shot's frames at its beats (first and last, mid-line, each verb at work or done, and the frame before the cut), each captioned with what is meant to happen. Go through the read-through once and every shot once. It adds to `talekit check` and replaces none of it.",
      inputSchema: { path: pathArg, shotId: z.string().optional() },
    },
    async ({ path: root, shotId }) => {
      try {
        const project = await loadProject(root);
        if (!shotId)
          return ok(
            text(
              `${await guideSection('The critic')}\nShots, in order: ${project.shots.map((s) => s.id).join(', ')}\n\n${readThrough(project)}`
            )
          );
        const shot = project.shots.find((s) => s.id === shotId);
        if (!shot) return fail(`no shot '${shotId}'`);
        const sheets = criticSheetsSvg(project, shot);
        return ok(
          text(
            `${shot.id}: ${sheets.length} image${sheets.length === 1 ? '' : 's'} of its beats, each frame captioned with what is meant to happen then. Check them against the critic's checklist (critique without shotId).`
          ),
          ...sheets.map((svg) => image(svg))
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  // The review server open_review started; it lives as long as this server.
  let review: Review | undefined;
  server.registerTool(
    'open_review',
    {
      title: 'Open the review app',
      description:
        "Serve the review app for each folder from one server on 127.0.0.1, each under its own path (a folder already served keeps it), and open the first in the person's browser. A project (the film and its reel, once rendered) gets the film review with its options; any other folder a board of samples (sounds, videos, pictures, sample projects) to note and pick from. Returns the addresses: tell the person.",
      inputSchema: {
        paths: z
          .array(z.string())
          .min(1)
          .describe('Absolute directories: projects, the landscape film first, or boards'),
        lan: z
          .boolean()
          .optional()
          .describe(
            'Also serve on the local network, for a phone (anyone on it can open it); only when the person asks'
          ),
      },
    },
    async ({ paths, lan }) => {
      try {
        // Asked for lan, a server on 127.0.0.1 only is started afresh with what it had.
        if (!review || (lan && !review.lan)) {
          const had = review?.roots() ?? [];
          review?.close();
          review = await startReview(4848, { lan: lan || review?.lan });
          for (const root of had) await review.add(root);
        }
        const urls: string[] = [];
        for (const root of paths) urls.push(`${await review.add(root)}  ${path.resolve(root)}`);
        openInBrowser(urls[0].split('  ')[0]);
        return ok(text(`review open:\n${urls.join('\n')}`));
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'list_voices',
    {
      title: 'List voices',
      description:
        "Voices for a character's `voice` or the narrator (set_audio), by language, the two engines that speak them, and how to write one.",
      inputSchema: {},
    },
    async () => {
      const byLang = new Map<string, string[]>();
      for (const [id, v] of Object.entries(VOICES)) {
        const [engine, name] = id.split(':');
        if (engine !== 'kokoro') continue;
        byLang.set(v.language, [
          ...(byLang.get(v.language) ?? []),
          `- ${name} (${v.gender}): ${v.description}`,
        ]);
      }
      const names = { 'en-us': 'English (American)', 'en-gb': 'English (British)', hi: 'Hindi' };
      return ok(
        text(
          [
            "Write a voice as 'engine:name' ('chatterbox:hm_omega'), or { id, speed, pitch }: pitch in semitones (3 to 5 turns a grown-up into a child or a small animal, -3 a giant), speed 0.85 slow to 1.15 quick.",
            '',
            'Two engines speak the same voices:',
            "- chatterbox:<name> acts: each line is said with its speaker's emotion (set `emotion` on the character), and it pronounces Hindi best. Use it for every character and the narrator. A line takes a second or two to make.",
            '- kokoro:<name> reads evenly and clearly, a line in a fraction of a second: for a quick draft.',
            ...[...byLang].flatMap(([lang, lines]) => [
              '',
              `## ${names[lang as keyof typeof names]}`,
              ...lines,
            ]),
          ].join('\n')
        )
      );
    }
  );

  server.registerTool(
    'list_sounds',
    {
      title: 'List sounds',
      description:
        "Bundled music, ambience and sound effects by name, marking those that startle the others in the shot or open the actor's mouth. A project's own files in audio/ are named by file name. What the engine already sounds (weather, fire, footsteps and the like) must not be added: authoring guide, Sound.",
      inputSchema: {},
    },
    async () => {
      const all = Object.entries(SOUNDS);
      if (!all.length)
        return ok(text("No bundled sounds yet; use files in the project's audio/ folder."));
      const section = (kind: string, title: string) => {
        // Numbered variants are one name: the bare name picks one of them each time.
        const seen = new Map<string, { n: number; description: string; duration: number }>();
        for (const [id, s] of all.filter(([, s]) => s.kind === kind)) {
          const name = id.replace(/-\d+$/, '');
          const prev = seen.get(name);
          seen.set(name, {
            n: (prev?.n ?? 0) + 1,
            description: prev?.description ?? s.description,
            duration: s.duration,
          });
        }
        return [
          '',
          `## ${title}`,
          ...[...seen].map(([name, s]) => {
            const marks = [
              s.n > 1 ? `${s.n} takes` : '',
              STARTLES[name] ? `startles: ${STARTLES[name]}` : '',
              MOUTH_SOUNDS.has(name) ? 'mouth' : '',
            ].filter(Boolean);
            return `- ${name}${marks.length ? ` (${marks.join(', ')})` : ''}: ${s.description}`;
          }),
        ];
      };
      return ok(
        text(
          [
            ...section('music', 'Music'),
            ...section('ambience', 'Ambience'),
            ...section('sfx', 'Sound effects'),
          ].join('\n')
        )
      );
    }
  );

  server.registerTool(
    'set_audio',
    {
      title: 'Set music, narrator and mix',
      description:
        "Set the project's music (under every shot without its own), narrator voice (reads the captions) and mix (a volume per layer, only when a listener finds one off); null clears one, leaving it out keeps it. A narrator speaks every unvoiced caption. Returns a map of the film's sound against the clock: a row per speaker, effects, ambience and music, the cuts numbered, a line outlined in red still being said when its shot cuts.",
      inputSchema: {
        path: pathArg,
        music: MusicSchema.nullable().optional(),
        narrator: VoiceSchema.nullable().optional(),
        mix: MixSchema.nullable().optional(),
      },
    },
    async ({ path: root, music, narrator, mix }) => {
      try {
        const project = await loadProject(root);
        const meta = { ...project.meta };
        if (music !== undefined) meta.music = music ?? undefined;
        if (narrator !== undefined) meta.narrator = narrator ?? undefined;
        if (mix !== undefined) meta.mix = mix ?? undefined;
        const next = { ...project, meta };
        const problems = [
          ...musicProblems('project', meta.music, next),
          ...voiceProblems('project narrator', meta.narrator),
        ];
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveMeta(root, meta);
        const spoken = meta.narrator ? await voice(root, next, next.shots) : '';
        return ok(
          text(`wrote ${file}${spoken}\n${formatProblems(validateProject(next))}`),
          image(audioMapSvg(next))
        );
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'list_notes',
    {
      title: 'List review notes',
      description:
        'Notes the person left in the review app (open_review) on a character, a scene, a moment of a shot, an option or (on a board) a file. Each open project note comes with the picture they were looking at (the frame, or the pose or anchor sheet); a clicked spot, "at (x, y)", is ringed on it. Reading them ("reopened", "looking at option", "picked"): authoring guide, Workflow (Review) and Options and samples. Fix what each asks, check the result, then resolve_note.',
      inputSchema: {
        path: pathArg,
        all: z.boolean().optional().describe('Include resolved notes (default: open only)'),
      },
    },
    async ({ path: root, all }) => {
      try {
        const notes = (await loadNotes(root)).filter((n) => all || n.status === 'open');
        if (!notes.length) return ok(text(all ? 'no notes' : 'no open notes'));
        // A board of samples has no pictures to draw: its notes name the file.
        if (!isProject(root)) return ok(...notes.map((n) => text(describeNote(n))));
        const base = await loadProject(root);
        const content: Content[] = [];
        let pictures = 0;
        for (const n of notes) {
          content.push(text(describeNote(n)));
          if (n.status !== 'open' || pictures >= 8) continue;
          const { kind, id, t, at, choice } = n.target;
          // Drawn with the options the person was looking at, or the choice they picked.
          const picks =
            kind === 'option' ? (choice ? { [id]: choice } : {}) : (n.target.options ?? {});
          const over = choiceDirs(root, picks);
          const project = over.length ? await loadProject(root, over) : base;
          if (kind === 'option') {
            const q = (await listOptions(root, base)).find((x) => x.id === id);
            if (!q) {
              content.push(text(`  (option '${id}' is no longer in options/)`));
              continue;
            }
            const shot = project.shots.find((s) => s.id === (q.shot ?? q.touches[0]));
            if (shot) {
              content.push(image(composeFrame(project, shot, q.t ?? shot.duration / 2)));
              pictures++;
            }
            continue;
          }
          const shot = kind === 'shot' ? project.shots.find((s) => s.id === id) : undefined;
          const frame = shot && composeFrame(project, shot, t ?? shot.duration / 2);
          const svg = frame
            ? at
              ? markSpot(frame, at, project.meta)
              : frame
            : kind === 'character' && project.characters[id]
              ? characterSheetSvg(project.characters[id])
              : kind === 'scene' && project.scenes[id]
                ? sceneSheetSvg(project, project.scenes[id])
                : undefined;
          if (!svg) content.push(text(`  (the ${kind} '${id}' no longer exists)`));
          else {
            content.push(image(svg));
            pictures++;
          }
        }
        if (pictures === 8 && notes.length > 8)
          content.push(
            text('(pictures shown for the first 8 notes; use preview_frame for the rest)')
          );
        return ok(...content);
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  server.registerTool(
    'resolve_note',
    {
      title: 'Resolve a review note',
      description:
        'Mark a review note done, or reopen it (status "open"), only once the fix is written and checked; the person sees the status in the review app.',
      inputSchema: {
        path: pathArg,
        id: z.string().describe('Note id, e.g. n3'),
        status: z.enum(['done', 'open']).optional().describe('Default done'),
      },
    },
    async ({ path: root, id, status }) => {
      try {
        const note = await setNoteStatus(root, id, status ?? 'done');
        return ok(text(describeNote(note)));
      } catch (e) {
        return fail((e as Error).message);
      }
    }
  );

  return server;
}

export async function startMcp(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}
