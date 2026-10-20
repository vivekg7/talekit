import http from 'node:http';
import { composeFrame } from './engine/compose.js';
import { movieDuration } from './engine/timeline.js';
import { loadProject } from './project/store.js';
import { formatProblems, validateProject } from './project/validate.js';
import { characterSheetSvg, sceneSheetSvg } from './render/sheets.js';

const PAGE = `<!doctype html><html><head><meta charset='utf-8'><title>talekit preview</title>
<style>
body{margin:0;font:14px system-ui,sans-serif;background:#1b1f24;color:#ddd;display:flex;flex-direction:column;height:100vh}
header{display:flex;gap:12px;align-items:center;padding:8px 12px;background:#262b32;flex-wrap:wrap}
select,button,input{font:inherit}button{padding:4px 10px}
#stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0}
#stage svg{max-width:100%;max-height:100%;height:auto;box-shadow:0 0 0 1px #000,0 10px 40px #0008}
#scrub{flex:1;min-width:200px}#t{font-variant-numeric:tabular-nums;min-width:90px}
#problems{white-space:pre-wrap;color:#f9a;padding:0 12px 8px;font-family:ui-monospace,monospace;font-size:12px}
</style></head><body>
<header><strong>talekit</strong> <span id='title'></span>
<select id='shot'></select><button id='play'>Play</button>
<input id='scrub' type='range' min='0' max='1' step='0.01' value='0'><span id='t'>0.00s</span>
<label><input id='debug' type='checkbox'> anchors</label><button id='reload'>Reload</button></header>
<div id='stage'></div><div id='problems'></div>
<script>
let info, shot, t = 0, playing = false, last = 0, busy = false;
const $ = (id) => document.getElementById(id);
async function load() {
  info = await (await fetch('/api/project')).json();
  $('title').textContent = info.title + ' · ' + info.duration.toFixed(1) + 's';
  const sel = $('shot'); const prev = sel.value; sel.innerHTML = '';
  for (const s of info.shots) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.id + ' (' + s.duration + 's, ' + s.scene + ')'; sel.appendChild(o); }
  if (info.shots.some(s => s.id === prev)) sel.value = prev;
  $('problems').textContent = info.problems === 'OK' ? '' : info.problems;
  pick();
}
function pick() { shot = info.shots.find(s => s.id === $('shot').value); if (!shot) return; $('scrub').max = shot.duration; t = Math.min(t, shot.duration); draw(); }
async function draw() {
  if (!shot || busy) return; busy = true;
  const res = await fetch('/api/frame?shot=' + encodeURIComponent(shot.id) + '&t=' + t + ($('debug').checked ? '&debug=1' : ''));
  $('stage').innerHTML = await res.text(); $('scrub').value = t; $('t').textContent = t.toFixed(2) + 's'; busy = false;
}
function tick(now) {
  if (!playing) return;
  const dt = (now - last) / 1000; last = now; t += dt;
  if (t >= shot.duration) { const i = info.shots.indexOf(shot); if (i < info.shots.length - 1) { $('shot').value = info.shots[i + 1].id; t = 0; pick(); } else { t = shot.duration - 1 / info.fps; playing = false; $('play').textContent = 'Play'; } }
  draw(); requestAnimationFrame(tick);
}
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; if (playing) { if (t >= shot.duration - 0.02) t = 0; last = performance.now(); requestAnimationFrame(tick); } };
$('scrub').oninput = (e) => { t = Number(e.target.value); draw(); };
$('shot').onchange = () => { t = 0; pick(); };
$('debug').onchange = draw; $('reload').onclick = load;
document.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); $('play').click(); } if (e.code === 'ArrowRight') { t = Math.min(shot.duration, t + 1 / info.fps); draw(); } if (e.code === 'ArrowLeft') { t = Math.max(0, t - 1 / info.fps); draw(); } });
load();
</script></body></html>`;

/** Local preview: reloads the project on every request so edits show up immediately. */
export async function serve(root: string, port: number): Promise<void> {
  await loadProject(root); // fail fast if the directory is not a project
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
        return;
      }
      const project = await loadProject(root);
      if (url.pathname === '/api/project') {
        const body = {
          title: project.meta.title,
          fps: project.meta.fps,
          duration: movieDuration(project),
          shots: project.shots.map((s) => ({ id: s.id, duration: s.duration, scene: s.scene })),
          problems: formatProblems(validateProject(project)),
        };
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
        return;
      }
      if (url.pathname === '/api/frame') {
        const shot = project.shots.find((s) => s.id === url.searchParams.get('shot'));
        if (!shot) throw new Error('unknown shot');
        const t = Number(url.searchParams.get('t') ?? 0);
        const svg = composeFrame(project, shot, t, { debug: url.searchParams.has('debug') });
        res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
        return;
      }
      if (url.pathname === '/api/sheet') {
        const id = url.searchParams.get('id') ?? '';
        const svg = project.characters[id]
          ? characterSheetSvg(project.characters[id])
          : project.scenes[id]
            ? sceneSheetSvg(project, project.scenes[id])
            : undefined;
        if (!svg) throw new Error('unknown id');
        res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(svg);
        return;
      }
      res.writeHead(404).end('not found');
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end((e as Error).message);
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`talekit preview: http://127.0.0.1:${port}/  (${root})`);
}
