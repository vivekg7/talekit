#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { composeFrame } from './engine/compose.js';
import { movieDuration } from './engine/timeline.js';
import { LIBRARY, copyFromLibrary } from './library/index.js';
import { createProject, loadProject, projectPaths } from './project/store.js';
import { formatProblems, hasErrors, validateProject } from './project/validate.js';
import { rasterize } from './render/raster.js';
import { characterSheetSvg, contactSheetSvg, sceneSheetSvg } from './render/sheets.js';
import { renderVideo } from './render/video.js';

const USAGE = `talekit — story video generation for AI agents

  talekit init <dir> --title "My story" [--width 1280 --height 720 --fps 24]
  talekit check <dir>                          validate every file and cross reference
  talekit library                              list built-in characters and scenes
  talekit copy <dir> <libraryId> [--as <id>]   copy a built-in into the project
  talekit sheet <dir> <id> [-o file.png]       pose sheet (character) or anchor sheet (scene)
  talekit frame <dir> <shotId> [-t 1.5] [-o file.png] [--svg] [--debug]
  talekit contact <dir> <shotId> [-n 6] [-o file.png]
  talekit render <dir> [shotId] [-o file.mp4]
  talekit serve <dir> [--port 4848]            live preview in the browser
  talekit mcp                                  start the MCP server on stdio
`;

async function savePng(file: string, svg: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, rasterize(svg));
  console.log(file);
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      title: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      fps: { type: 'string' },
      as: { type: 'string' },
      out: { type: 'string', short: 'o' },
      time: { type: 'string', short: 't' },
      count: { type: 'string', short: 'n' },
      port: { type: 'string' },
      svg: { type: 'boolean' },
      debug: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, ...rest] = positionals;
  if (!cmd || values.help) {
    console.log(USAGE);
    return;
  }
  const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));

  switch (cmd) {
    case 'init': {
      const [dir] = rest;
      if (!dir || !values.title) throw new Error('usage: talekit init <dir> --title "..."');
      const meta = await createProject(dir, {
        title: values.title,
        ...(values.width ? { width: num(values.width)! } : {}),
        ...(values.height ? { height: num(values.height)! } : {}),
        ...(values.fps ? { fps: num(values.fps)! } : {}),
      });
      console.log(`created ${path.resolve(dir)} (${meta.width}x${meta.height} @ ${meta.fps}fps)`);
      return;
    }
    case 'check': {
      const project = await loadProject(rest[0] ?? '.');
      const problems = validateProject(project);
      console.log(formatProblems(problems));
      console.log(
        `${Object.keys(project.characters).length} characters, ${Object.keys(project.scenes).length} scenes, ${project.shots.length} shots, ${movieDuration(project).toFixed(1)}s`
      );
      if (hasErrors(problems)) process.exitCode = 1;
      return;
    }
    case 'library': {
      for (const c of Object.values(LIBRARY.characters))
        console.log(`character  ${c.id.padEnd(12)} ${c.name} — ${c.description ?? ''}`);
      for (const s of Object.values(LIBRARY.scenes))
        console.log(`scene      ${s.id.padEnd(12)} ${s.name} — ${s.description ?? ''}`);
      return;
    }
    case 'copy': {
      const [dir, libId] = rest;
      if (!dir || !libId) throw new Error('usage: talekit copy <dir> <libraryId> [--as <id>]');
      const file = await copyFromLibrary(dir, libId, values.as);
      console.log(file);
      return;
    }
    case 'sheet': {
      const [dir, id] = rest;
      if (!dir || !id) throw new Error('usage: talekit sheet <dir> <id>');
      const project = await loadProject(dir);
      const p = projectPaths(dir);
      if (project.characters[id]) {
        await savePng(
          values.out ?? path.join(p.out, `sheet-${id}.png`),
          characterSheetSvg(project.characters[id])
        );
      } else if (project.scenes[id]) {
        await savePng(
          values.out ?? path.join(p.out, `sheet-${id}.png`),
          sceneSheetSvg(project, project.scenes[id])
        );
      } else throw new Error(`no character or scene '${id}'`);
      return;
    }
    case 'frame': {
      const [dir, shotId] = rest;
      if (!dir || !shotId) throw new Error('usage: talekit frame <dir> <shotId> [-t sec]');
      const project = await loadProject(dir);
      const shot = project.shots.find((s) => s.id === shotId);
      if (!shot) throw new Error(`no shot '${shotId}'`);
      const t = num(values.time) ?? 0;
      const svg = composeFrame(project, shot, t, { debug: values.debug });
      const p = projectPaths(dir);
      if (values.svg) {
        const file = values.out ?? path.join(p.out, `frame-${shotId}-${t}.svg`);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, svg);
        console.log(file);
      } else await savePng(values.out ?? path.join(p.out, `frame-${shotId}-${t}.png`), svg);
      return;
    }
    case 'contact': {
      const [dir, shotId] = rest;
      if (!dir || !shotId) throw new Error('usage: talekit contact <dir> <shotId> [-n 6]');
      const project = await loadProject(dir);
      const shot = project.shots.find((s) => s.id === shotId);
      if (!shot) throw new Error(`no shot '${shotId}'`);
      const p = projectPaths(dir);
      await savePng(
        values.out ?? path.join(p.out, `contact-${shotId}.png`),
        contactSheetSvg(project, shot, num(values.count) ?? 6)
      );
      return;
    }
    case 'render': {
      const [dir, shotId] = rest;
      if (!dir) throw new Error('usage: talekit render <dir> [shotId]');
      const project = await loadProject(dir);
      const problems = validateProject(project);
      if (hasErrors(problems)) throw new Error(formatProblems(problems));
      const shots = shotId ? project.shots.filter((s) => s.id === shotId) : project.shots;
      if (shotId && !shots.length) throw new Error(`no shot '${shotId}'`);
      const p = projectPaths(dir);
      const outPath = values.out ?? path.join(p.out, shotId ? `${shotId}.mp4` : 'movie.mp4');
      const started = Date.now();
      const r = await renderVideo(project, {
        outPath,
        shots,
        onProgress: (d, total) => {
          if (d % 48 === 0 || d === total) process.stderr.write(`\r${d}/${total} frames`);
        },
      });
      process.stderr.write('\n');
      console.log(
        `${outPath}  (${r.seconds.toFixed(1)}s, ${r.frames} frames, ${((Date.now() - started) / 1000).toFixed(1)}s wall)`
      );
      return;
    }
    case 'serve': {
      const { serve } = await import('./serve.js');
      await serve(rest[0] ?? '.', num(values.port) ?? 4848);
      return;
    }
    case 'mcp': {
      const { startMcp } = await import('./mcp/server.js');
      await startMcp();
      return;
    }
    default:
      throw new Error(`unknown command '${cmd}'\n${USAGE}`);
  }
}

main(process.argv.slice(2)).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
