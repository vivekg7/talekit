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
  CharacterSchema,
  SceneSchema,
  ShotSchema,
  type Character,
  type Project,
} from '../engine/types.js';
import { LIBRARY } from '../library/index.js';
import {
  createProject,
  loadProject,
  projectPaths,
  saveCharacter,
  saveScene,
  saveShot,
} from '../project/store.js';
import {
  formatProblems,
  hasErrors,
  validateCharacter,
  validateProject,
  validateScene,
  validateShot,
  type Problem,
} from '../project/validate.js';
import { rasterize } from '../render/raster.js';
import {
  characterSheetSvg,
  contactSheetSvg,
  filmSheetSvg,
  sceneSheetSvg,
} from '../render/sheets.js';
import { faceFallbacks } from '../engine/motion.js';
import { renderVideo } from '../render/video.js';

type Content =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };

const text = (t: string): Content => ({ type: 'text', text: t });
const image = (svg: string, width?: number): Content => ({
  type: 'image',
  data: rasterize(svg, width).toString('base64'),
  mimeType: 'image/png',
});
const ok = (...content: Content[]) => ({ content });
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

function guidePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    path.join(here, '..', '..', 'docs', 'authoring-guide.md'),
    path.join(here, '..', 'docs', 'authoring-guide.md'),
  ])
    if (existsSync(candidate)) return candidate;
  throw new Error('authoring-guide.md not found');
}

function describeProject(project: Project, problems: Problem[]): string {
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
    '## Validation',
    formatProblems(problems),
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
        'Summary of a project: characters with their parts and variants, scenes with anchors, shots in playback order, and validation problems.',
      inputSchema: { path: pathArg },
    },
    async ({ path: root }) => {
      try {
        const project = await loadProject(root);
        return ok(text(describeProject(project, validateProject(project))));
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
        'Return the stored JSON of one character, scene or shot so it can be edited and written back.',
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
        return ok(text(JSON.stringify(item, null, 2)));
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
        'The full JSON of a built-in character or scene without copying it into the project. Read a character on the rig you are about to draw (e.g. `dog` for the simple rig) to see how its parts and variants are laid out, then write your own with write_character.',
      inputSchema: { libraryId: z.string() },
    },
    async ({ libraryId }) => {
      const item = LIBRARY.characters[libraryId] ?? LIBRARY.scenes[libraryId];
      if (!item)
        return fail(
          `no library item '${libraryId}'; available: ${[...Object.keys(LIBRARY.characters), ...Object.keys(LIBRARY.scenes)].join(', ')}`
        );
      return ok(text(JSON.stringify(item, null, 2)));
    }
  );

  server.registerTool(
    'copy_from_library',
    {
      title: 'Copy from library',
      description:
        'Copy a built-in character or scene into the project under a new id, optionally overriding colour tokens and the display name. Returns the pose sheet or anchor sheet.',
      inputSchema: {
        path: pathArg,
        libraryId: z.string(),
        asId: z
          .string()
          .optional()
          .describe('New id in the project (default: same as the library id)'),
        name: z.string().optional().describe('Display name, e.g. the character name in the story'),
        colors: z
          .record(z.string(), z.string())
          .optional()
          .describe('Colour token overrides, e.g. { "hair": "#f4d35e" }'),
        height: z.number().positive().optional().describe('On-screen height override in pixels'),
      },
    },
    async ({ path: root, libraryId, asId, name, colors, height }) => {
      try {
        const c = LIBRARY.characters[libraryId];
        if (c) {
          const character = CharacterSchema.parse({
            ...c,
            id: asId ?? c.id,
            name: name ?? c.name,
            colors: { ...c.colors, ...(colors ?? {}) },
            ...(height ? { height } : {}),
          });
          const file = await saveCharacter(root, character);
          return ok(
            text(`wrote ${file}\n${characterReport(character, validateCharacter(character))}`),
            image(characterSheetSvg(character))
          );
        }
        const s = LIBRARY.scenes[libraryId];
        if (s) {
          const scene = SceneSchema.parse({ ...s, id: asId ?? s.id, name: name ?? s.name });
          const file = await saveScene(root, scene);
          const project = await loadProject(root);
          return ok(text(`wrote ${file}`), image(sceneSheetSvg(project, scene)));
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
        'Validate and save a character (creates or replaces characters/<id>.json). Returns a pose sheet showing every pose and expression the engine can produce, plus one cell per variant of any other part (selected in shots with a `face` action), so you can check proportions, pivots and variants. The text lists emotions that fall back to a substitute variant (e.g. angry eyes → open) because the preferred one is missing. Fix and re-write until it looks right.',
      inputSchema: { path: pathArg, character: CharacterSchema },
    },
    async ({ path: root, character }) => {
      try {
        const problems = validateCharacter(character);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveCharacter(root, character);
        return ok(
          text(`wrote ${file}\n${characterReport(character, problems)}`),
          image(characterSheetSvg(character))
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
        'Validate and save a scene (scenes/<id>.json). Returns the scene with anchors and stage shortcuts marked, plus a ghost showing how tall a 220px character is, so you can check scale and placement.',
      inputSchema: { path: pathArg, scene: SceneSchema },
    },
    async ({ path: root, scene }) => {
      try {
        const project = await loadProject(root);
        const problems = validateScene(scene, project.meta.width, project.meta.height);
        if (hasErrors(problems)) return fail(formatProblems(problems));
        const file = await saveScene(root, scene);
        return ok(
          text(`wrote ${file}\n${formatProblems(problems)}`),
          image(sceneSheetSvg(project, scene))
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
        'Validate and save a shot (shots/<NN>-<id>.json; `order` sets NN and therefore playback order). Cross-checks cast, anchors and face variants, and warns when two actors speak at once. Returns a contact sheet of evenly spaced frames so you can check staging, timing and bubbles.',
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
        return ok(
          text(`wrote ${file}\n${formatProblems(problems)}`),
          image(contactSheetSvg(fresh, saved, frames ?? 6))
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
      description: 'Contact sheet of evenly spaced frames from a shot (default 6, up to 12).',
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
        'Render the whole movie (or one shot) to an H.264 mp4 in <project>/out/. Validation errors block rendering. A minute of 720p takes about half a minute. Returns a film sheet: one frame from the middle of each rendered shot, so you can confirm the cut without opening the file.',
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
        const r = await renderVideo(project, { outPath, shots });
        return ok(
          text(
            `rendered ${outPath}: ${r.seconds.toFixed(1)}s, ${r.frames} frames, in ${((Date.now() - started) / 1000).toFixed(1)}s\n${formatProblems(problems)}`
          ),
          image(filmSheetSvg(project, shots))
        );
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
