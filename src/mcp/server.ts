import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { composeFrame } from '../engine/compose.js';
import { movieDuration, STAGE_SHORTCUTS } from '../engine/timeline.js';
import {
  AnchorSchema,
  CharacterSchema,
  SceneSchema,
  MusicSchema,
  ShotSchema,
  VoiceSchema,
  type Character,
  type Project,
  type Scene,
  type Shot,
  type Voice,
} from '../engine/types.js';
import { voiceLines } from '../engine/voice.js';
import { LIBRARY, nameFromId } from '../library/index.js';
import {
  createProject,
  loadProject,
  projectPaths,
  saveCharacter,
  saveMeta,
  saveScene,
  saveShot,
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
  validateProject,
  validateScene,
  validateShot,
  type Problem,
} from '../project/validate.js';
import { rasterize } from '../render/raster.js';
import {
  audioMapSvg,
  characterSheetSvg,
  constructionSheetSvg,
  contactSheetSvg,
  filmSheetSvg,
  sceneSheetSvg,
} from '../render/sheets.js';
import { faceFallbacks } from '../engine/motion.js';
import { renderVideo } from '../render/video.js';
import { makeVoices } from '../project/voices.js';
import { SOUNDS } from '../library/sounds.js';
import { VOICES } from '../library/voices.js';
import { describeNote, loadNotes, setNoteStatus, type Note } from '../project/notes.js';

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

/**
 * Speak the lines in these shots that have no audio yet, and say what happened in a line
 * for the tool's text. Never throws: without the sidecar the lines stay silent, on
 * estimated timings, and the agent is told so once per call.
 */
async function voice(root: string, project: Project, shots: Shot[]): Promise<string> {
  try {
    const r = await makeVoices(root, project, shots);
    if (!r.made && !r.failed.length) return '';
    const failed = r.failed.map(
      (f) => `\n  failed: ${f.line.shot} action ${f.line.action}: ${f.error}`
    );
    return `\nvoices: ${r.made} line${r.made === 1 ? '' : 's'} spoken${failed.join('')}`;
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

function guidePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    path.join(here, '..', '..', 'docs', 'authoring-guide.md'),
    path.join(here, '..', 'docs', 'authoring-guide.md'),
  ])
    if (existsSync(candidate)) return candidate;
  throw new Error('authoring-guide.md not found');
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

function describeProject(
  root: string,
  project: Project,
  problems: Problem[],
  notes: Note[]
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
    `Review app: \`talekit serve ${projectPaths(root).root}\` (the person leaves notes there)`,
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
        'READ THIS FIRST. How to design characters, scenes and shots for talekit: coordinate boxes, rig pivots, part variants, anchors, the action vocabulary and the recommended workflow.',
      inputSchema: {},
    },
    async () => ok(text(await readFile(guidePath(), 'utf8')))
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description:
        'Create a new talekit project directory with talekit.json and empty characters/, scenes/, shots/ folders.',
      inputSchema: {
        path: pathArg,
        title: z.string(),
        width: z.number().int().optional().describe('Default 1280'),
        height: z.number().int().optional().describe('Default 720'),
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
        'Summary of a project: characters with their parts and variants, scenes with anchors, shots in playback order, validation problems, and how many review notes are open.',
      inputSchema: { path: pathArg },
    },
    async ({ path: root }) => {
      try {
        const project = await loadProject(root);
        return ok(
          text(describeProject(root, project, validateProject(project), await loadNotes(root)))
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
        'Return the stored JSON of one character, scene or shot so it can be edited and written back; for a shot, also its actions numbered as patch_shot addresses them.',
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
        const json = JSON.stringify(item, null, 2);
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
        'Built-in characters and scenes that can be copied into a project (and recoloured) as starting points. Copying is much more reliable than drawing from scratch.',
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
        'The full JSON of a built-in character or scene without copying it into the project. Read a character on the rig you are about to draw (`kid` for the humanoid, `dog` for the quadruped, `bird` for the simple rig) to see how its parts and variants are laid out, then write your own with write_character. A painted scene (jungle, cave, hut) comes back without its long SVG layers: copy it instead, and its anchor sheet shows the picture.',
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
        'Copy a built-in character or scene into the project under a new id, optionally overriding colour tokens and the display name, or adding anchors to a scene. Returns the pose sheet (a library drawing already passes construction, so no construction sheet), or the anchor sheet.',
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
            "Display name, e.g. the character name in the story (default: from asId, 'old-man' → 'Old man', else the library name)"
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
            'Scene only: anchors added to the copy, or replacing one of the same name, e.g. { "well": { "x": 400, "y": 652 } }; the rest of the scene is copied as it is'
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
          const project = await loadProject(root);
          const problems = validateScene(scene, project.meta.width, project.meta.height);
          if (hasErrors(problems)) return fail(formatProblems(problems));
          const file = await saveScene(root, scene);
          return ok(
            text(`wrote ${file}\n${formatProblems(problems)}`),
            reduced(sceneSheetSvg(project, scene), SCENE_SHEET)
          );
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
        'Validate and save a character (creates or replaces characters/<id>.json). Returns two pictures. The pose sheet shows every pose and expression the engine can produce, plus one cell per variant of any other part (selected in shots with a `face` action), each standing in its ground shadow when it casts one. The construction sheet shows what the construction linter checked: part boxes and pivots, the silhouette, swing poses that open any gap at a joint, and numbered red boxes matching the numbered warnings in the text (a limb not reaching into the torso or body, an ear not sunk into the head, a leg that only touches the body, feet off the line); parts listed in `springs` (follow-through: a tail, ears) are labelled with ~. Drawing outside the canonical box is an error. The engine adds the outline and the shading itself; do not draw either. Fix and re-write until both sheets look right and the warnings are gone. A `voice` (list_voices) speaks its lines in every shot that has them.',
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
        'Validate and save a scene (scenes/<id>.json). Returns the scene with anchors and stage shortcuts marked, plus a ghost showing how tall a 220px character is, so you can check scale and placement. A layered scene (`far` behind the stage, `near` in front of it) gets a strip underneath: each layer alone, then the camera zoomed into either side, where the far layer must still fill the frame and should sit differently behind the stage. A scene with `weather` or `effects` gets a row of the empty scene at a few moments, to show the rain, clouds, flames or waves moving. Lights (`lights` for a sun, moon or lamp painted into the art; a `sun` effect and every fire count too) are ringed in yellow, with the shadow each throws of the ghost, so you can check the shadows fall away from what the picture shows as the light.',
      inputSchema: { path: pathArg, scene: SceneSchema },
    },
    async ({ path: root, scene }) => {
      try {
        const project = await loadProject(root);
        const problems = [
          ...validateScene(scene, project.meta.width, project.meta.height),
          ...sceneSoundProblems(scene, project),
        ];
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveScene(root, scene);
        return ok(
          text(`wrote ${file}\n${formatProblems(problems)}`),
          reduced(sceneSheetSvg(project, scene), SCENE_SHEET)
        );
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
        'Validate and save a shot (shots/<NN>-<id>.json; `order` sets NN and therefore playback order). Cross-checks cast, anchors, face variants, who a line is spoken `to`, who carries what (`attach`; a `pickup` the carrier cannot reach says where to stand) and whether a `crossfade` has a shot to dissolve from, and warns when two actors speak at once. The project check also warns when someone ends a shot carrying a prop and starts the next empty-handed. Listeners look at the speaker on their own; do not stage looks. Lines of characters with a `voice`, and captions when the project has a narrator, are spoken now; a spoken line lasts as long as it takes to say, and a warning says when one is cut off by the end of the shot. Returns a contact sheet of evenly spaced frames so you can check staging, timing and bubbles, with the sound under it (a row per speaker, effects, ambience, music; a line outlined in red is cut off); it is drawn smaller than preview_shot draws it, so use that when a detail is hard to make out.',
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
          .describe('Contact sheet frame count (default 6, in two columns of 630px)'),
      },
    },
    async ({ path: root, shot, order, frames }) => {
      try {
        const project = await loadProject(root);
        const problems = validateShot(shot, project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveShot(root, shot, order);
        const fresh = await loadProject(root);
        const saved = fresh.shots.find((s) => s.id === shot.id)!;
        // Spoken now, so the warnings and the sheet go by how long each line really takes.
        const spoken = await voice(root, fresh, [saved]);
        return ok(
          text(`wrote ${file}${spoken}\n${formatProblems(validateShot(saved, fresh))}`),
          reduced(contactSheetSvg(fresh, saved, frames ?? 6), SHOT_SHEET)
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
        "Change a saved shot without writing it out again: replace top-level fields (`set`), add, replace or take out cast members (`cast`), merge fields into actions by index (`edit`; null removes a field), take actions out (`remove`) or add new ones (`add`). Indices are the shot's actions before the patch, as `get_item` and this tool list them. The result is validated exactly as write_shot validates and keeps the shot's place in the film. Returns the actions renumbered and a contact sheet of the stretch the change shows in (the whole shot after a `set` or `cast` change); preview_shot shows all of it. For a shot restaged from scratch, use write_shot.",
      inputSchema: {
        path: pathArg,
        shotId: z.string(),
        set: z
          .partialRecord(z.enum(SETTABLE), z.unknown())
          .optional()
          .describe(
            `Top-level fields replaced whole (${SETTABLE.join(', ')}), as in write_shot; weather: null drops the shot's own weather`
          ),
        cast: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Cast members by id, each replaced whole as in write_shot, or null to take one out'
          ),
        edit: z
          .array(
            z.object({
              index: z.number().int().min(0),
              fields: z
                .record(z.string(), z.unknown())
                .describe(
                  'Action fields to change, e.g. { "t": 3.5 } or { "say": "…" }; null removes one'
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
          .describe('New actions, written as in write_shot; they take their place by t'),
        frames: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe(
            'Contact sheet frame count (default 4 over the changed stretch, 6 over a whole shot)'
          ),
      },
    },
    async ({ path: root, shotId, set, cast, edit, remove, add, frames }) => {
      try {
        const project = await loadProject(root);
        const before = project.shots.find((s) => s.id === shotId);
        if (!before) return fail(`no shot '${shotId}'`);
        const { shot, from, to } = patchShot(before, { set, cast, edit, remove, add });
        const problems = validateShot(shot, project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveShot(root, shot, await shotOrder(root, shotId));
        const fresh = await loadProject(root);
        const saved = fresh.shots.find((s) => s.id === shotId)!;
        const spoken = await voice(root, fresh, [saved]);
        const whole = from === 0 && to === saved.duration;
        return ok(
          text(
            `wrote ${file}${spoken}\n${formatProblems(validateShot(saved, fresh))}\n\nActions now:\n${listActions(saved)}` +
              (whole
                ? ''
                : `\n\nSheet: ${from.toFixed(2)}s to ${to.toFixed(2)}s of ${saved.duration}s`)
          ),
          reduced(contactSheetSvg(fresh, saved, frames ?? (whole ? 6 : 4), 2, from, to), SHOT_SHEET)
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
          const project = await loadProject(root);
          if (!project.shots.some((s) => s.id === id)) return fail(`no shot '${id}'`);
          await saveShot(
            root,
            project.shots.find((s) => s.id === id)!
          ); // normalises the file name
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
        'Render a single frame of a shot at time t (seconds from the start of the shot). Use debug=true to mark anchors and feet points.',
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
        'Contact sheet of evenly spaced frames from a shot (default 6, up to 12), at full size: the closer look at a sheet that write_shot or patch_shot returned smaller.',
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
        'Render the whole movie (or one shot) to an H.264 mp4 in <project>/out/, with its sound: voices, music, ambience and effects (lines not yet spoken are spoken first). Validation errors block rendering. A minute of 720p takes about ten seconds. Returns a film sheet: one frame from the middle of each rendered shot, so you can confirm the cut without opening the file.',
      inputSchema: { path: pathArg, shotId: z.string().optional() },
    },
    async ({ path: root, shotId }) => {
      try {
        const project = await loadProject(root);
        const problems = validateProject(project);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const shots = shotId ? project.shots.filter((s) => s.id === shotId) : project.shots;
        if (!shots.length) return fail(shotId ? `no shot '${shotId}'` : 'no shots to render');
        const outPath = path.join(projectPaths(root).out, shotId ? `${shotId}.mp4` : 'movie.mp4');
        const started = Date.now();
        const spoken = await voice(root, project, shots);
        const r = await renderVideo(project, { outPath, shots });
        return ok(
          text(
            `rendered ${outPath}: ${r.seconds.toFixed(1)}s, ${r.frames} frames, in ${((Date.now() - started) / 1000).toFixed(1)}s${spoken}\n${formatProblems(problems)}`
          ),
          image(filmSheetSvg(project, shots))
        );
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
        "Voices a character (`voice`) or the project's narrator (set_audio) can speak in, by language. Lines are spoken by a local model when a shot is written, and a voiced line lasts as long as it takes to say.",
      inputSchema: {},
    },
    async () => {
      const byLang = new Map<string, string[]>();
      for (const [id, v] of Object.entries(VOICES))
        byLang.set(v.language, [
          ...(byLang.get(v.language) ?? []),
          `- ${id} (${v.gender}): ${v.description}`,
        ]);
      const names = { 'en-us': 'English (American)', 'en-gb': 'English (British)', hi: 'Hindi' };
      return ok(
        text(
          [
            "Write a voice as 'engine:name', or { id, speed, pitch }: pitch in semitones (3 to 5 turns a grown-up into a child or a small animal, -3 a giant), speed 0.85 slow to 1.15 quick.",
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
        "Bundled music, ambience and sound effects, by name. Music goes in set_audio or a shot's `music`, ambience in a scene's `ambience`, effects in a `sound` action. A project can add its own files to its audio/ folder and use them by file name without the extension. Rain, wind, fire, waterfalls, waves and thunder are heard from weather and effects on their own, and footsteps from walking; do not add them.",
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
          ...[...seen].map(
            ([name, s]) => `- ${name}${s.n > 1 ? ` (${s.n} takes)` : ''}: ${s.description}`
          ),
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
      title: 'Set music and narrator',
      description:
        "Set the project's music (under every shot that does not choose its own) and its narrator voice (who reads the captions); null clears one, leaving it out keeps it. Setting a narrator speaks every caption that has no audio yet. Returns a map of the whole film's sound: a row per speaker, the effects, the ambience and the music, against the clock, with the cuts numbered. A line outlined in red is still being said when its shot cuts.",
      inputSchema: {
        path: pathArg,
        music: MusicSchema.nullable().optional(),
        narrator: VoiceSchema.nullable().optional(),
      },
    },
    async ({ path: root, music, narrator }) => {
      try {
        const project = await loadProject(root);
        const meta = { ...project.meta };
        if (music !== undefined) meta.music = music ?? undefined;
        if (narrator !== undefined) meta.narrator = narrator ?? undefined;
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
        'Notes a person left in the review app (`talekit serve <path>`) on a character, a scene, or one moment of a shot. Each open note comes with a picture of what they were looking at: the frame at that moment for a shot note, the pose or anchor sheet for an asset note. Fix what the note asks, check the result, then call resolve_note.',
      inputSchema: {
        path: pathArg,
        all: z.boolean().optional().describe('Include resolved notes (default: open only)'),
      },
    },
    async ({ path: root, all }) => {
      try {
        const notes = (await loadNotes(root)).filter((n) => all || n.status === 'open');
        if (!notes.length) return ok(text(all ? 'no notes' : 'no open notes'));
        const project = await loadProject(root);
        const content: Content[] = [];
        let pictures = 0;
        for (const n of notes) {
          content.push(text(describeNote(n)));
          if (n.status !== 'open' || pictures >= 8) continue;
          const { kind, id, t } = n.target;
          const shot = kind === 'shot' ? project.shots.find((s) => s.id === id) : undefined;
          const svg = shot
            ? composeFrame(project, shot, t ?? shot.duration / 2)
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
        'Mark a review note done (or reopen it with status "open"). Do this only after the fix is written and checked; the person sees the status change in the review app.',
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
