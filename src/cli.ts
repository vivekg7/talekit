#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { composeFrame } from './engine/compose.js';
import { movieDuration } from './engine/timeline.js';
import type { Project } from './engine/types.js';
import { LIBRARY, copyFromLibrary } from './library/index.js';
import { createProject, loadProject, projectPaths } from './project/store.js';
import { formatProblems, hasErrors, validateProject } from './project/validate.js';
import { rasterize } from './render/raster.js';
import {
  characterSheetSvg,
  constructionSheetSvg,
  contactSheetSvg,
  sceneSheetSvg,
} from './render/sheets.js';
import { writeMkv } from './render/mkv.js';
import { isPortrait } from './engine/format.js';
import { remixVideo, renderVideo } from './render/video.js';
import { makeVoices, type VoiceReport } from './project/voices.js';

const USAGE = `talekit — story video generation for AI agents

  talekit init <dir> --title "My story" [--width 1280 --height 720 --fps 24]
  talekit check <dir>                          validate every file and cross reference
  talekit library                              list built-in characters and scenes
  talekit copy <dir> <libraryId> [--as <id>]   copy a built-in into the project
  talekit sheet <dir> <id> [-o file.png]       pose + construction sheet (character) or anchor sheet (scene)
  talekit frame <dir> <shotId> [-t 1.5] [-o file.png] [--svg] [--debug]
  talekit contact <dir> <shotId> [-n 6] [-o file.png]
  talekit voice <dir> [shotId]                 speak the lines that have no audio yet (local TTS)
  talekit render <dir> [shotId] [-o file.mp4] [--silent]   the whole film (not a reel) also writes a .mkv
  talekit remix <dir> [-o file.mp4]            mix the sound again under a rendered film (after a mix change)
  talekit mkv <dir> [-o file.mp4]              build the .mkv again from the rendered mp4 (after a translation)
  talekit serve <dir> [dir...] [--port 4848] [--open]   a review app per project (a film and its reel); --open opens them
  talekit mcp                                  start the MCP server on stdio
`;

/** Write the film's .mkv next to its mp4 and say what is in it. */
async function mkvBeside(project: Project, mp4: string, silent?: boolean): Promise<string> {
  const file = mp4.replace(/\.mp4$/i, '') + '.mkv';
  const r = await writeMkv(project, mp4, file, { silent });
  return `${file}  (sound: ${r.audio.join(', ') || 'none'}; subtitles: ${r.subtitles.join(', ') || 'none'})`;
}

function voiceSummary(r: VoiceReport): string {
  const lines = [`voices: ${r.made} spoken, ${r.kept} already had audio`];
  for (const f of r.failed)
    lines.push(`  failed: ${f.line.shot} action ${f.line.action}: ${f.error}`);
  return lines.join('\n');
}

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
      open: { type: 'boolean' },
      svg: { type: 'boolean' },
      debug: { type: 'boolean' },
      silent: { type: 'boolean' },
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
        const file = values.out ?? path.join(p.out, `sheet-${id}.png`);
        await savePng(file, characterSheetSvg(project.characters[id]));
        await savePng(
          path.join(path.dirname(file), `construction-${path.basename(file)}`),
          constructionSheetSvg(project.characters[id])
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
    case 'voice': {
      const [dir, shotId] = rest;
      if (!dir) throw new Error('usage: talekit voice <dir> [shotId]');
      const project = await loadProject(dir);
      const shots = shotId ? project.shots.filter((s) => s.id === shotId) : project.shots;
      if (shotId && !shots.length) throw new Error(`no shot '${shotId}'`);
      const r = await makeVoices(dir, project, shots, (d, total) =>
        process.stderr.write(`\r${d}/${total} lines`)
      );
      process.stderr.write('\n');
      console.log(voiceSummary(r));
      if (r.failed.length) process.exitCode = 1;
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
      // Lines written since the last voicing are spoken first; without the sidecar they stay silent.
      if (!values.silent)
        await makeVoices(dir, project, shots).then(
          (r) => r.made + r.failed.length && console.error(voiceSummary(r)),
          (e) => console.error(`voices: ${(e as Error).message}; unvoiced lines stay silent`)
        );
      const r = await renderVideo(project, {
        outPath,
        shots,
        silent: values.silent,
        onProgress: (d, total) => {
          if (d % 48 === 0 || d === total) process.stderr.write(`\r${d}/${total} frames`);
        },
      });
      process.stderr.write('\n');
      console.log(
        `${outPath}  (${r.seconds.toFixed(1)}s, ${r.frames} frames, ${((Date.now() - started) / 1000).toFixed(1)}s wall)`
      );
      // A reel is posted as the one mp4; only a film gets the .mkv beside it.
      if (!shotId && !isPortrait(project.meta))
        console.log(await mkvBeside(project, outPath, values.silent));
      return;
    }
    case 'remix': {
      const [dir] = rest;
      if (!dir) throw new Error('usage: talekit remix <dir> [-o file.mp4]');
      const project = await loadProject(dir);
      const file = values.out ?? path.join(projectPaths(dir).out, 'movie.mp4');
      const r = await remixVideo(project, file);
      console.log(`${file}  (new sound under ${r.seconds.toFixed(1)}s)`);
      if (!isPortrait(project.meta)) console.log(await mkvBeside(project, file));
      return;
    }
    case 'mkv': {
      const [dir] = rest;
      if (!dir) throw new Error('usage: talekit mkv <dir> [-o file.mp4]');
      const project = await loadProject(dir);
      const problems = validateProject(project);
      if (hasErrors(problems)) throw new Error(formatProblems(problems));
      console.log(
        await mkvBeside(project, values.out ?? path.join(projectPaths(dir).out, 'movie.mp4'))
      );
      return;
    }
    case 'serve': {
      const { serve } = await import('./viewer/server.js');
      const { openInBrowser } = await import('./viewer/open.js');
      // The film and its reel are reviewed side by side: one app each, on consecutive ports.
      let port = num(values.port) ?? 4848;
      for (const dir of rest.length ? rest : ['.']) {
        const { url } = await serve(dir, port);
        console.log(`talekit review: ${url}  (${dir})`);
        if (values.open) openInBrowser(url);
        port = Number(new URL(url).port) + 1;
      }
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
