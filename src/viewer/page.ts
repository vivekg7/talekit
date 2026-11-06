/**
 * The review app, as one self-contained page. No framework, no build step: the server
 * embeds it, and everything dynamic comes from /api/*. Written without backticks or `${`
 * so it can live inside a template literal.
 *
 * The watch view is a grid: the picture takes all the room the controls leave, at the film's
 * exact shape, with this shot's notes and lines in a column beside it. A film keeps its
 * shots in a strip along the bottom; a reel, tall and narrow, has them in a second column,
 * so the picture gets the full height. On a phone everything stacks.
 */
export const PAGE = String.raw`<!doctype html><html><head><meta charset='utf-8'><title>talekit review</title>
<meta name='viewport' content='width=device-width, initial-scale=1'><link rel='icon' href='data:,'>
<style>
:root{--bg:#1b1f24;--panel:#262b32;--line:#3a414a;--text:#ddd;--dim:#9aa3ad;--accent:#ffd166;--ok:#06d6a0;--bad:#f9a;--pin:#e0245e}
*{box-sizing:border-box}
body{margin:0;font:14px system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;height:100vh}
header{display:flex;gap:12px;align-items:center;padding:8px 14px;background:var(--panel);flex-wrap:wrap}
header strong{font-size:16px}
#apps{display:flex;gap:2px;background:var(--bg);border-radius:7px;padding:2px}
#apps:empty{display:none}
#apps a{color:var(--dim);text-decoration:none;padding:4px 10px;border-radius:5px}
#apps a.on{background:var(--panel);color:var(--text)}
#title{color:var(--dim)}
nav{display:flex;gap:4px;margin-left:auto}
nav button{background:none;border:1px solid transparent;color:var(--dim);padding:6px 12px;border-radius:6px;cursor:pointer;font:inherit}
nav button.on{color:var(--text);border-color:var(--line);background:var(--bg)}
nav .n{background:var(--accent);color:#000;border-radius:10px;padding:0 6px;font-size:11px;margin-left:4px}
nav .n.check{background:var(--ok)}
#live{width:8px;height:8px;border-radius:50%;background:var(--ok);display:inline-block}
#live.off{background:var(--bad)}
main{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.view{display:none;flex:1;min-height:0;flex-direction:column}
.view.on{display:flex}
button,select,input,textarea{font:inherit}
button.act{background:var(--accent);color:#000;border:0;padding:5px 12px;border-radius:5px;cursor:pointer}
button.ghost{background:none;border:1px solid var(--line);color:var(--text);padding:4px 10px;border-radius:5px;cursor:pointer}
button.ghost.on{border-color:var(--accent);color:var(--accent)}
button:disabled{opacity:.4;cursor:default}
select{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:3px 4px}
textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:6px;resize:vertical}

/* ---- the watch view ---- */
#film{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:minmax(0,1fr) auto auto auto auto auto;
  grid-template-areas:'stage side' 'controls side' 'line side' 'tools side' 'mixer side' 'shots shots'}
body.portrait #film{grid-template-columns:minmax(0,1fr) 200px 340px;grid-template-rows:minmax(0,1fr) auto auto auto auto;
  grid-template-areas:'stage shots side' 'controls shots side' 'line shots side' 'tools shots side' 'mixer shots side'}
#stage{grid-area:stage;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0;min-width:0;overflow:hidden}
#frame{position:relative;overflow:hidden;background:#000;box-shadow:0 0 0 1px #000,0 10px 40px #0008;cursor:crosshair;flex:none}
#pic,#pins,#safe{position:absolute;inset:0}
#pic svg,#pic video{display:block;width:100%;height:100%}
#pins,#safe{pointer-events:none}
#safe .zone{position:absolute;border:1px dashed #fff8;outline:2000px solid #e0245e30}
.pin{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid var(--accent);box-shadow:0 0 0 2px #000a,inset 0 0 0 2px #000a;font-style:normal}
.pin b{position:absolute;left:30px;top:-6px;background:#000c;color:var(--accent);font:600 12px system-ui;padding:1px 5px;border-radius:4px;white-space:nowrap}
.pin.check{border-color:var(--ok)}.pin.check b{color:var(--ok)}
.pin.new{border-color:var(--pin);animation:pulse 1s infinite alternate}.pin.new b{color:#fff;background:var(--pin)}
@keyframes pulse{to{transform:scale(1.25)}}
#controls{grid-area:controls;display:flex;gap:10px;align-items:center;padding:4px 14px}
#scrubwrap{flex:1;min-width:120px;position:relative;height:28px;display:flex;align-items:center}
#scrub{width:100%;margin:0}
#marks{position:absolute;left:8px;right:8px;top:0;height:8px;pointer-events:none}
#marks i{position:absolute;top:0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--accent);margin-left:-5px}
#marks i.check{border-top-color:var(--ok)}
#t{font-variant-numeric:tabular-nums;min-width:110px;text-align:right}
#line{grid-area:line;min-height:30px;padding:2px 14px;display:flex;flex-direction:column;justify-content:center;font-size:15px}
#line div{cursor:pointer}
#line b{color:var(--accent);font-weight:600;margin-right:6px}
#line .narrator b,#line .title b{color:var(--dim)}
#tools{grid-area:tools;display:flex;gap:6px 12px;align-items:center;padding:2px 14px 6px;flex-wrap:wrap;color:var(--dim)}
#tools label{display:flex;gap:5px;align-items:center;cursor:pointer}
#tools .gap{flex:1}
#help{display:none;color:var(--dim);font-size:12px;line-height:1.6;padding:6px 14px;grid-column:1/-1}
#help.on{display:block}
#help kbd{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:0 4px;font:11px ui-monospace,monospace;color:var(--text)}
#mixer{grid-area:mixer;display:flex;gap:6px 16px;align-items:center;padding:0 14px 8px;flex-wrap:wrap}
#mixer[hidden]{display:none}
#mixer b{font-weight:600}
#mixer label{display:flex;gap:6px;align-items:center;color:var(--dim)}
#mixer input{width:100px}
#mixer output{min-width:52px;font-variant-numeric:tabular-nums;color:var(--text)}
#mix-status{color:var(--dim);font-size:12px}

#shots{grid-area:shots;display:flex;gap:8px;padding:6px 14px 10px;overflow-x:auto;min-height:0}
#shots .shot{flex:0 0 auto;width:150px;cursor:pointer;border:2px solid transparent;border-radius:6px;padding:3px;color:var(--dim);font-size:12px}
#shots .shot.on{border-color:var(--accent);color:var(--text)}
#shots img{width:100%;display:block;border-radius:3px;background:#000}
#shots .shot b{display:block;font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#shots .dots{color:var(--accent)}
body.portrait #shots{flex-direction:column;overflow-x:hidden;overflow-y:auto;padding:10px 8px;border-left:1px solid var(--line)}
body.portrait #shots .shot{width:auto;display:flex;gap:8px;align-items:flex-start}
body.portrait #shots img{width:64px;flex:none}
body.portrait #shots .shot b{white-space:normal}

#side{grid-area:side;min-height:0;overflow-y:auto;border-left:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px}
#side h3{margin:8px 0 0;font-size:12px;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
#problems{white-space:pre-wrap;color:var(--bad);font-family:ui-monospace,monospace;font-size:12px}
#problems:empty{display:none}
#note-where{color:var(--dim);font-size:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#note-where .pinned{color:#fff;background:var(--pin);border-radius:4px;padding:0 5px}
#note-where button{background:none;border:0;color:var(--dim);cursor:pointer;padding:0 2px}
#note-text{min-height:58px}
.row{display:flex;gap:8px;align-items:center}
.row .hint{color:var(--dim);font-size:12px}
#script div{display:flex;gap:6px;padding:3px 4px;border-radius:4px;cursor:pointer;color:var(--dim);font-size:13px;align-items:baseline}
#script div.on{background:var(--panel);color:var(--text)}
#script .at{font-variant-numeric:tabular-nums;font-size:11px;min-width:38px}
#script .tx{flex:1}
#script .tx b{font-weight:600;margin-right:4px}
#script .q{visibility:hidden;background:none;border:0;color:var(--dim);cursor:pointer;padding:0 2px}
#script div:hover .q{visibility:visible}

/* ---- a note, in the side column, on a card and in the notes view ---- */
.note{background:var(--panel);border-radius:6px;padding:7px 9px;display:flex;flex-direction:column;gap:4px;border-left:3px solid var(--accent)}
.note.check{border-left-color:var(--ok)}
.note.checked{opacity:.5;border-left-color:var(--line)}
.note .nh{display:flex;gap:8px;align-items:baseline;font-size:12px;color:var(--dim)}
.note .id{font-family:ui-monospace,monospace}
.note .where.go{color:var(--accent);cursor:pointer}
.note .st{margin-left:auto}
.note.check .st{color:var(--ok)}
.note .nr{font-size:12px;color:var(--dim);border-left:2px solid var(--line);padding-left:6px}
.note .nb{display:flex;gap:6px;flex-wrap:wrap}
.note .nb:empty{display:none}
.note textarea{min-height:40px}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px;padding:14px}
.card{background:var(--panel);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;display:block;background:#e9eef3;cursor:zoom-in}
.card img.construction{border-top:1px solid var(--line)}
.card .body{padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.card .title{display:flex;align-items:baseline;gap:8px}
.card .title b{font-size:15px}
.card .title span{color:var(--dim);font-size:12px}
.card .note{background:var(--bg)}
#notes-bar{display:flex;gap:6px;padding:14px 14px 0}
#notes-list{padding:14px;display:flex;flex-direction:column;gap:8px;max-width:900px}
.empty{color:var(--dim);padding:6px 0}
#notes-list .empty,.grid .empty{padding:14px}
#lightbox{position:fixed;inset:0;background:#000c;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:20px;z-index:9;cursor:zoom-out}
#lightbox.on{display:flex}
#lightbox img{max-width:none;background:#e9eef3;border-radius:6px}

/* ---- a phone, or a narrow window: one column, the page scrolls ---- */
@media (max-width:860px){
  #film,body.portrait #film{display:flex;flex-direction:column;flex:none}
  #stage{padding:6px}
  #shots,body.portrait #shots{flex-direction:row;overflow-x:auto;overflow-y:hidden;border:0;padding:6px 10px}
  body.portrait #shots .shot{display:block;width:84px}
  body.portrait #shots img{width:100%}
  #side{border:0;overflow:visible}
  #tools .keys,#help .keys{display:none}
  nav button{padding:6px 8px}
}
</style></head><body>
<header>
  <strong>talekit</strong><span id='apps'></span><span id='title'></span><span id='live' title='watching the project directory'></span>
  <nav>
    <button data-view='film' class='on'>Watch</button>
    <button data-view='characters'>Characters</button>
    <button data-view='scenes'>Scenes</button>
    <button data-view='notes'>Notes<span class='n' id='nopen' hidden></span><span class='n check' id='ncheck' hidden></span></button>
  </nav>
</header>
<main>
  <section class='view on' id='view-film'><div id='film'>
    <div id='stage'><div id='frame'><div id='pic'></div><div id='safe'></div><div id='pins'></div></div></div>
    <div id='controls'>
      <button id='play' class='ghost'>Play</button>
      <div id='scrubwrap'><div id='marks'></div><input id='scrub' type='range' min='0' max='1' step='0.01' value='0'></div>
      <span id='t'>0.00s</span>
    </div>
    <div id='line'></div>
    <div id='tools'>
      <select id='rate' title='Playback speed'><option value='0.5'>0.5×</option><option value='0.75'>0.75×</option><option value='1' selected>1×</option><option value='1.25'>1.25×</option><option value='1.5'>1.5×</option><option value='2'>2×</option></select>
      <label title='Play this shot over and over (L)'><input id='loop' type='checkbox'> loop shot</label>
      <select id='source'><option value='live'>live frames</option><option value='video'>rendered video</option></select>
      <label><input id='debug' type='checkbox'> anchors</label>
      <label id='safe-label' title='What the reel apps draw over: caption, buttons, search (S)'><input id='safe-on' type='checkbox'> safe area</label>
      <span class='gap'></span>
      <button class='ghost' id='sound-btn' title='The sound levels, one slider per layer'>Sound</button>
      <button class='ghost' id='help-btn' title='Keys and how notes work'>?</button>
      <div id='help'><span class='keys'><kbd>Space</kbd> plays · <kbd>←</kbd> <kbd>→</kbd> step one frame · <kbd>[</kbd> <kbd>]</kbd> change shot · <kbd>N</kbd> writes a note · <kbd>L</kbd> loops the shot · <kbd>S</kbd> shows the safe area · <kbd>Esc</kbd> lets go of the pin.<br></span>
        Click the picture to pin a spot: the note points at it, and the agent sees it ringed. Click a line in the script to jump to it, or its ❝ to quote it in the note. A fix the agent closed waits under <i>fixed: check it</i> until you agree or reopen it with what is still wrong. The sound is the film's, played through the sliders: move one while it plays to hear the change.</div>
    </div>
    <div id='mixer' hidden><b>Sound</b>
      <label>Voices <input type='range' data-k='voices' min='-30' max='12' step='0.5' value='0'><output></output></label>
      <label>Music <input type='range' data-k='music' min='-30' max='12' step='0.5' value='0'><output></output></label>
      <label>Ambience <input type='range' data-k='ambience' min='-30' max='12' step='0.5' value='0'><output></output></label>
      <label>Effects <input type='range' data-k='effects' min='-30' max='12' step='0.5' value='0'><output></output></label>
      <button class='ghost' id='mix-reset' title='Back to the engine levels'>Reset</button>
      <button class='act' id='mix-save' title='Write the mix to talekit.json; the next render uses it'>Save</button>
      <button class='act' id='mix-remix' title='Save, then put the new sound under out/movie.mp4 without rendering a frame'>Save and remix video</button>
      <span id='mix-status'></span>
    </div>
    <div id='shots'></div>
    <aside id='side'>
      <div id='problems'></div>
      <div id='note-where'></div>
      <textarea id='note-text' placeholder='What is wrong at this moment? Click the picture to point at it. (Enter adds, Shift+Enter for a new line)'></textarea>
      <div class='row'><button class='act' id='note-add'>Add note</button><span class='hint' id='note-hint'></span></div>
      <h3>Notes on this shot</h3><div id='shot-notes'></div>
      <h3>Script</h3><div id='script'></div>
    </aside>
  </div></section>
  <section class='view' id='view-characters'><div class='grid' id='characters'></div></section>
  <section class='view' id='view-scenes'><div class='grid' id='scenes'></div></section>
  <section class='view' id='view-notes'>
    <div id='notes-bar'><button class='ghost on' data-f='todo'>Open and to check</button><button class='ghost' data-f='all'>All</button></div>
    <div id='notes-list'></div>
  </section>
</main>
<div id='lightbox'><img></div>
<script>
'use strict';
var info = null, shot = null, t = 0, playing = false, last = 0, busy = false, pending = false, view = 'film';
var pin = null, focusNote = null, notesFilter = 'todo';
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var api = function (url, opts) { return fetch(url, opts).then(function (r) { return r.json(); }); };
var store = function (k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('talekit:' + k)); localStorage.setItem('talekit:' + k, JSON.stringify(v)); } catch (e) { return null; } };
var shotStart = function (s) { var sum = 0; for (var i = 0; i < info.shots.length; i++) { if (info.shots[i].id === s.id) break; sum += info.shots[i].duration; } return sum; };
var rate = function () { return Number($('rate').value); };
var fine = matchMedia('(pointer: fine)').matches;

/* ---- notes: open, fixed by the agent and waiting for the person, or checked ---- */
var stateOf = function (n) { return n.status === 'open' ? 'open' : n.toCheck ? 'check' : 'checked'; };
var notesOn = function (kind, id) { return info.notes.filter(function (n) { return n.target.kind === kind && n.target.id === id; }); };
var todo = function (n) { return stateOf(n) !== 'checked'; };
function patchNote(id, body) {
  return api('/api/notes/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { if (r.error) alert(r.error); return load(); });
}
function whereOf(n, full) {
  var g = n.target, w = '';
  if (full) w = g.kind + ' ' + g.id;
  if (g.t !== undefined) w += (w ? ' @ ' : '') + g.t.toFixed(2) + 's';
  if (g.at) w += (w ? ' · ' : '') + 'pinned';
  return w;
}
function noteItem(n, full) {
  var st = stateOf(n), d = document.createElement('div');
  d.className = 'note ' + st;
  var shotNote = n.target.kind === 'shot' && info.shots.some(function (s) { return s.id === n.target.id; });
  d.innerHTML = "<div class='nh'><span class='id'>" + esc(n.id) + "</span><span class='where" + (shotNote ? ' go' : '') + "'>" + esc(whereOf(n, full)) + "</span><span class='st'>" + { open: 'open', check: 'fixed: check it', checked: 'done' }[st] + '</span></div>' +
    '<div>' + esc(n.text) + '</div>' +
    (n.replies || []).map(function (r) { return "<div class='nr'>reopened: " + esc(r.text) + '</div>'; }).join('') + "<div class='nb'></div>";
  if (shotNote) d.querySelector('.where').onclick = function () { focusNote = n.id; show('film'); jumpTo(n.target.id, n.target.t || 0); };
  var nb = d.querySelector('.nb');
  var btn = function (label, cls, fn) { var b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; nb.appendChild(b); };
  var reopen = function () {
    nb.innerHTML = "<textarea placeholder='What is still wrong? (optional)'></textarea>";
    var ta = nb.querySelector('textarea');
    var go = function () { patchNote(n.id, { status: 'open', reply: ta.value }); };
    ta.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } if (e.key === 'Escape') render(); };
    btn('Reopen', 'act', go); btn('Cancel', 'ghost', function () { render(); });
    ta.focus();
  };
  var render = function () {
    nb.innerHTML = '';
    if (st === 'check') { btn('Looks good', 'act', function () { patchNote(n.id, { checked: true }); }); btn('Reopen', 'ghost', reopen); }
    else if (st === 'checked') btn('Reopen', 'ghost', reopen);
    // Closing your own note needs no second look.
    else btn('Close', 'ghost', function () { patchNote(n.id, { status: 'done', checked: true }); });
    if (full || st === 'open') btn('Delete', 'ghost', function () { if (confirm('Delete ' + n.id + '?')) api('/api/notes/' + n.id, { method: 'DELETE' }).then(load); });
  };
  render();
  return d;
}

function show(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
  document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('on', s.id === 'view-' + v); });
  if (v !== 'film' && playing) $('play').click();
  if (v === 'film') fit();
}
document.querySelectorAll('nav button').forEach(function (b) { b.onclick = function () { show(b.dataset.view); }; });

function load() {
  return api('/api/project').then(function (data) {
    if (data.error) { $('problems').textContent = data.error; $('live').classList.add('off'); return; }
    $('live').classList.remove('off');
    var first = !info;
    info = data;
    document.body.classList.toggle('portrait', info.height > info.width);
    document.title = info.title + ' · talekit review';
    $('title').textContent = info.title + ' · ' + info.duration.toFixed(1) + 's · ' + info.shots.length + ' shots';
    $('problems').textContent = info.problems === 'OK' ? '' : info.problems;
    var open = info.notes.filter(function (n) { return stateOf(n) === 'open'; }).length;
    var check = info.notes.filter(function (n) { return stateOf(n) === 'check'; }).length;
    $('nopen').hidden = !open; $('nopen').textContent = open; $('nopen').title = open + ' open';
    $('ncheck').hidden = !check; $('ncheck').textContent = check; $('ncheck').title = check + ' fixed, to check';
    $('source').style.display = info.movie ? '' : 'none';
    $('source').options[1].textContent = info.movie ? 'rendered video' + (info.movie.stale ? ' (older than the shots)' : '') : '';
    if (!info.movie && $('source').value === 'video') $('source').value = 'live';
    $('safe-label').style.display = info.safe.bottom ? '' : 'none';
    renderApps(); renderShots(); renderCards('characters'); renderCards('scenes'); renderNotes(); setupSound(); drawSafe();
    var cur = shot && info.shots.find(function (s) { return s.id === shot.id; });
    if (first) {
      // Back where this page was, after a reload or a trip to the film's other cut.
      // A link to a moment (#hua@3.9) wins over that.
      var m = /^#([^@]+)@([\d.]+)$/.exec(decodeURIComponent(location.hash));
      var was = m ? { shot: m[1], t: Number(m[2]) } : store('at:' + location.port);
      cur = was && info.shots.find(function (s) { return s.id === was.shot; });
      if (cur) t = was.t;
    }
    shot = cur || info.shots[0] || null;
    if (shot) { t = Math.min(t, shot.duration); $('scrub').max = shot.duration; }
    renderSide(); syncStage(); fit(); draw();
  });
}

/* ---- the film and its reel, switched between from the header ---- */
function renderApps() {
  var el = $('apps');
  if (info.apps.length < 2) { el.innerHTML = ''; return; }
  var count = {};
  info.apps.forEach(function (a) { var k = a.portrait ? 'Reel' : 'Film'; count[k] = (count[k] || 0) + 1; });
  el.innerHTML = info.apps.map(function (a) {
    var k = a.portrait ? 'Reel' : 'Film';
    var name = count[k] > 1 ? k + ': ' + a.title : k;
    return "<a href='" + location.protocol + '//' + location.hostname + ':' + a.port + "/'" + (a.here ? " class='on'" : '') + " title='" + esc(a.title) + "'>" + esc(name) + '</a>';
  }).join('');
}

function renderShots() {
  var el = $('shots'); el.innerHTML = '';
  info.shots.forEach(function (s, i) {
    var d = document.createElement('div'); d.className = 'shot'; d.dataset.id = s.id;
    var n = notesOn('shot', s.id).filter(function (x) { return stateOf(x) === 'open'; }).length;
    d.innerHTML = "<img loading='lazy' src='/api/frame?shot=" + encodeURIComponent(s.id) + '&t=' + (s.duration / 2) + '&v=' + info.version + "'><b>" + (i + 1) + '. ' + esc(s.id) + ' · ' + s.duration + 's' + (n ? " <span class='dots'>" + '●'.repeat(Math.min(n, 5)) + '</span>' : '') + '</b>';
    d.onclick = function () { jumpTo(s.id, 0); };
    el.appendChild(d);
  });
  markShots();
}
function markShots() {
  document.querySelectorAll('#shots .shot').forEach(function (d) {
    var on = !!shot && d.dataset.id === shot.id;
    if (on && !d.classList.contains('on')) d.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    d.classList.toggle('on', on);
  });
  var m = $('marks'); m.innerHTML = '';
  if (!shot) return;
  notesOn('shot', shot.id).filter(todo).forEach(function (n) {
    var i = document.createElement('i'); i.className = stateOf(n);
    i.style.left = (100 * (n.target.t || 0) / shot.duration) + '%'; i.title = n.id + ': ' + n.text; m.appendChild(i);
  });
}

/* ---- the column beside the picture: the note box, this shot's notes, its script ---- */
var linesHere = function () { return shot ? info.lines.filter(function (l) { return l.shot === shot.id; }) : []; };
function renderSide() {
  var el = $('shot-notes'); el.innerHTML = '';
  var list = shot ? notesOn('shot', shot.id).filter(todo).sort(function (a, b) { return (a.target.t || 0) - (b.target.t || 0); }) : [];
  if (!list.length) el.innerHTML = "<div class='empty'>None open.</div>";
  list.forEach(function (n) { el.appendChild(noteItem(n, false)); });
  var sc = $('script'); sc.innerHTML = '';
  var lines = linesHere();
  if (!lines.length) sc.innerHTML = "<div class='empty'>No lines in this shot.</div>";
  lines.forEach(function (l, i) {
    var d = document.createElement('div'); d.dataset.i = i;
    d.innerHTML = "<span class='at'>" + l.t.toFixed(1) + "s</span><span class='tx'><b>" + esc(l.who) + '</b>' + esc(l.text) + "</span><button class='q' title='Quote this line in the note'>❝</button>";
    d.onclick = function () { jumpTo(shot.id, l.t + 0.01); };
    d.querySelector('.q').onclick = function (e) { e.stopPropagation(); quote(l); };
    sc.appendChild(d);
  });
  markShots();
}
function quote(l) {
  var ta = $('note-text'), q = l.who + ': "' + l.text + '"';
  ta.value = ta.value ? ta.value.replace(/\s*$/, ' ') + q + ' ' : q + ' ';
  ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
}
/** What changes with the moment: the line up now, the script's place, the pins. */
function moment() {
  if (!shot) return;
  $('scrub').value = t; $('t').textContent = shot.id + ' · ' + t.toFixed(2) + 's';
  var lines = linesHere();
  var now = lines.filter(function (l) { return t >= l.t && t < l.end; });
  var key = now.map(function (l) { return l.t; }).join(',') + shot.id;
  if ($('line').dataset.key !== key) {
    $('line').dataset.key = key; $('line').innerHTML = '';
    now.forEach(function (l) {
      var d = document.createElement('div'); d.className = l.who === 'narrator' || l.who === 'title' ? l.who : '';
      d.innerHTML = '<b>' + esc(l.who) + '</b>' + esc(l.text); d.title = 'Quote this line in the note';
      d.onclick = function () { quote(l); };
      $('line').appendChild(d);
    });
    document.querySelectorAll('#script div[data-i]').forEach(function (d) { d.classList.toggle('on', now.indexOf(lines[Number(d.dataset.i)]) >= 0); });
  }
  var where = esc('note at ' + shot.id + ' · ' + t.toFixed(2) + 's') + (pin ? " <span class='pinned'>at (" + pin.x + ', ' + pin.y + ")</span><button id='unpin' title='Let go of the pin (Esc)'>×</button>" : '');
  if ($('note-where').innerHTML !== where) {
    $('note-where').innerHTML = where;
    if (pin) $('unpin').onclick = function () { pin = null; moment(); };
    $('note-hint').textContent = pin ? '' : 'click the picture to point at something';
  }
  drawPins();
}
// Where the page is, so a reload or a trip to the other cut comes back to it.
// The address follows the moment too, so a copied link opens on it.
setInterval(function () {
  if (!shot) return;
  store('at:' + location.port, { shot: shot.id, t: t });
  history.replaceState(null, '', '#' + encodeURIComponent(shot.id) + '@' + t.toFixed(2));
}, 1000);
function drawPins() {
  var el = $('pins'); el.innerHTML = '';
  var add = function (at, label, cls) {
    var i = document.createElement('i'); i.className = 'pin ' + cls;
    i.style.left = 100 * at.x / info.width + '%'; i.style.top = 100 * at.y / info.height + '%';
    i.innerHTML = '<b>' + esc(label) + '</b>'; el.appendChild(i);
  };
  notesOn('shot', shot.id).forEach(function (n) {
    if (!n.target.at || !todo(n)) return;
    if (Math.abs((n.target.t || 0) - t) < 0.6 || n.id === focusNote) add(n.target.at, n.id, stateOf(n));
  });
  if (pin) add(pin, 'new note', 'new');
}
function drawSafe() {
  var s = info.safe, el = $('safe');
  el.innerHTML = $('safe-on').checked && s.bottom ? "<div class='zone' style='top:" + 100 * s.top / info.height + '%;bottom:' + 100 * s.bottom / info.height + '%;left:' + 100 * s.left / info.width + '%;right:' + 100 * s.right / info.width + "%'></div>" : '';
}
$('safe-on').onchange = function () { store('safe', this.checked); drawSafe(); };
$('safe-on').checked = !!store('safe');

/* Clicking the picture pins the spot the next note is about, in frame pixels. */
$('frame').onclick = function (e) {
  if (!shot) return;
  var r = this.getBoundingClientRect();
  pin = { x: Math.round((e.clientX - r.left) / r.width * info.width), y: Math.round((e.clientY - r.top) / r.height * info.height) };
  if (playing) $('play').click();
  moment();
  if (fine) $('note-text').focus();
};

/* The frame at the film's exact shape, as large as the stage allows: nothing past its edges. */
function fit() {
  if (!info) return;
  var st = $('stage'), f = $('frame');
  var narrow = matchMedia('(max-width: 860px)').matches;
  st.style.height = narrow ? Math.min(innerHeight * 0.72, (st.clientWidth - 12) * info.height / info.width + 12) + 'px' : '';
  var w = st.clientWidth - (narrow ? 12 : 24), h = st.clientHeight - (narrow ? 12 : 24);
  var k = Math.max(0, Math.min(w / info.width, h / info.height));
  f.style.width = Math.floor(info.width * k) + 'px'; f.style.height = Math.floor(info.height * k) + 'px';
}
new ResizeObserver(function () { fit(); }).observe($('stage'));
addEventListener('resize', fit);

function renderCards(kind) {
  var el = $(kind); el.innerHTML = '';
  var items = info[kind];
  if (!items.length) { el.innerHTML = "<div class='empty'>No " + kind + ' yet.</div>'; return; }
  var k = kind === 'characters' ? 'character' : 'scene';
  items.forEach(function (c) {
    var card = document.createElement('div'); card.className = 'card';
    var meta = kind === 'characters' ? c.rig + ' rig · ' + c.height + 'px' : 'anchors: ' + (c.anchors.join(', ') || 'none');
    var sheet = '/api/sheet?id=' + encodeURIComponent(c.id) + '&v=' + info.version;
    card.innerHTML = "<img loading='lazy' src='" + sheet + "'>" +
      (kind === 'characters' ? "<img loading='lazy' class='construction' title='Construction: what the linter checked' src='" + sheet + "&kind=construction'>" : '') +
      "<div class='body'><div class='title'><b>" + esc(c.name) + '</b><span>' + esc(c.id) + ' · ' + esc(meta) + "</span></div><div class='list'></div>" +
      "<textarea placeholder='What should change about this " + k + "?'></textarea><div class='row'><button class='act'>Add note</button></div></div>";
    notesOn(k, c.id).filter(todo).forEach(function (n) { card.querySelector('.list').appendChild(noteItem(n, false)); });
    card.querySelectorAll('img').forEach(function (img) { img.onclick = function () { lightbox(this.src); }; });
    var ta = card.querySelector('textarea');
    var add = function () { if (!ta.value.trim()) return; postNote({ kind: k, id: c.id }, ta.value).then(function () { ta.value = ''; }); };
    card.querySelector('.row button').onclick = add;
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
    el.appendChild(card);
  });
}

function renderNotes() {
  var el = $('notes-list'); el.innerHTML = '';
  var list = info.notes.filter(function (n) { return notesFilter === 'all' || todo(n); });
  if (!list.length) { el.innerHTML = "<div class='empty'>" + (info.notes.length ? 'Nothing open or waiting for a check.' : 'No notes yet. Add one from the film, a character or a scene; the agent reads open notes with list_notes.') + '</div>'; return; }
  // Fixes to check first, then what is still open, newest first within each.
  var rank = { check: 0, open: 1, checked: 2 };
  list.slice().reverse().sort(function (a, b) { return rank[stateOf(a)] - rank[stateOf(b)]; }).forEach(function (n) { el.appendChild(noteItem(n, true)); });
}
document.querySelectorAll('#notes-bar button').forEach(function (b) {
  b.onclick = function () { notesFilter = b.dataset.f; document.querySelectorAll('#notes-bar button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderNotes(); };
});

function postNote(target, text) {
  return api('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target, text: text }) }).then(function (r) {
    if (r.error) alert(r.error); else return load();
  });
}
$('note-add').onclick = function () {
  var ta = $('note-text'); if (!shot || !ta.value.trim()) return;
  var target = { kind: 'shot', id: shot.id, t: Math.round(t * 100) / 100 };
  if (pin) target.at = pin;
  postNote(target, ta.value).then(function () { ta.value = ''; pin = null; moment(); });
};
$('note-text').onkeydown = function (e) {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('note-add').click(); }
  if (e.key === 'Escape') this.blur();
};
$('note-text').onfocus = function () { if (playing) $('play').click(); };

function lightbox(src) { $('lightbox').classList.add('on'); $('lightbox').querySelector('img').src = src; }
$('lightbox').onclick = function () { $('lightbox').classList.remove('on'); };

function jumpTo(id, time) {
  var s = info.shots.find(function (x) { return x.id === id; }); if (!s) return;
  var changed = !shot || shot.id !== s.id;
  shot = s; t = Math.min(time, s.duration); $('scrub').max = s.duration;
  if (changed) { pin = null; renderSide(); }
  if (video()) video().currentTime = shotStart(s) + t;
  soundSeek(); draw();
}

/* ---- the stage: live SVG frames, or the rendered mp4 when it exists ---- */
function video() { return $('source').value === 'video' ? $('pic').querySelector('video') : null; }
/** Shot and time from where the video is. */
function fromVideo(v) {
  if (!shot) return;
  var tt = v.currentTime;
  for (var i = 0; i < info.shots.length; i++) {
    var s = info.shots[i];
    if (tt < s.duration || i === info.shots.length - 1) {
      if (shot.id !== s.id) { shot = s; $('scrub').max = s.duration; pin = null; renderSide(); }
      t = Math.max(0, Math.min(tt, s.duration)); break;
    }
    tt -= s.duration;
  }
  moment(); soundDrift();
}
/** Looping a shot of the video: back to its start on reaching its end. */
function loopVideo(v) {
  if (!$('loop').checked || !shot) return false;
  var s0 = shotStart(shot);
  if (v.currentTime < s0 + shot.duration - 0.04) return false;
  v.currentTime = s0; soundSeek(); return true;
}
function syncStage() {
  var pic = $('pic');
  if ($('source').value === 'video' && info.movie) {
    var old = pic.querySelector('video');
    if (old && old.dataset.m !== String(info.movie.mtime)) { if (playing) $('play').click(); old = null; }
    if (!old) {
      pic.innerHTML = "<video src='/movie.mp4?v=" + info.movie.mtime + "' data-m='" + info.movie.mtime + "' preload='auto' muted playsinline></video>";
      var v = pic.querySelector('video');
      v.muted = true; v.playbackRate = rate();
      v.ontimeupdate = function () { if (!loopVideo(v)) fromVideo(v); };
      v.onended = function () { if ($('loop').checked) { jumpTo(shot.id, 0); v.play(); return; } playing = false; $('play').textContent = 'Play'; soundPause(); };
      // The sound starts when the picture does, not when it was asked to.
      v.onplaying = function () { if (playing) soundPlay(); };
      v.onloadedmetadata = function () { if (shot) v.currentTime = shotStart(shot) + t; };
    }
  } else if (pic.querySelector('video')) pic.innerHTML = '';
  $('debug').disabled = !!video();
}
$('source').onchange = function () { if (playing) $('play').click(); syncStage(); draw(); };
function draw() {
  if (!shot) { $('pic').innerHTML = ''; return; }
  moment();
  if (video()) return;
  if (busy) { pending = true; return; }
  busy = true;
  fetch('/api/frame?shot=' + encodeURIComponent(shot.id) + '&t=' + t + ($('debug').checked ? '&debug=1' : '')).then(function (r) { return r.text(); }).then(function (svg) {
    if (!video()) $('pic').innerHTML = svg;
    busy = false; if (pending) { pending = false; draw(); }
  });
}
function tick(now) {
  if (!playing) return;
  var v = video();
  if (v) { if (!loopVideo(v)) fromVideo(v); requestAnimationFrame(tick); return; }
  var dt = (now - last) / 1000 * rate(); last = now; t += dt;
  if (t >= shot.duration) {
    var i = info.shots.indexOf(shot);
    if ($('loop').checked) { t = 0; soundSeek(); }
    else if (i < info.shots.length - 1) { shot = info.shots[i + 1]; t = 0; $('scrub').max = shot.duration; pin = null; renderSide(); }
    else { t = shot.duration - 1 / info.fps; playing = false; $('play').textContent = 'Play'; soundPause(); }
  }
  soundDrift(); draw(); requestAnimationFrame(tick);
}
$('play').onclick = function () {
  if (!shot) return;
  playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play';
  var v = video();
  if (v) { if (playing) { if (t >= shot.duration - 0.02) jumpTo(shot.id, 0); v.play(); requestAnimationFrame(tick); } else { v.pause(); soundPause(); } return; }
  if (playing) { if (t >= shot.duration - 0.02) t = 0; last = performance.now(); requestAnimationFrame(tick); soundPlay(); } else soundPause();
};
$('scrub').oninput = function (e) { t = Number(e.target.value); var v = video(); if (v) v.currentTime = shotStart(shot) + t; soundSeek(); draw(); };
$('debug').onchange = draw;
$('rate').onchange = function () {
  var r = rate(), v = video(); if (v) v.playbackRate = r;
  Object.keys(sound.els).forEach(function (b) { sound.els[b].playbackRate = r; });
  store('rate', r);
};
if (store('rate')) $('rate').value = String(store('rate'));
$('loop').onchange = function () { store('loop', this.checked); };
$('loop').checked = !!store('loop');
$('help-btn').onclick = function () { $('help').classList.toggle('on'); this.classList.toggle('on'); };
document.addEventListener('keydown', function (e) {
  if (view !== 'film' || !shot || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey) return;
  var step = 1 / info.fps, i = info.shots.indexOf(shot);
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  else if (e.code === 'ArrowRight') jumpTo(shot.id, Math.min(shot.duration, t + step));
  else if (e.code === 'ArrowLeft') jumpTo(shot.id, Math.max(0, t - step));
  else if (e.key === ']' && i < info.shots.length - 1) jumpTo(info.shots[i + 1].id, 0);
  else if (e.key === '[' && i > 0) jumpTo(info.shots[i - 1].id, 0);
  else if (e.key === 'n') { e.preventDefault(); $('note-text').focus(); }
  else if (e.key === 'l') { $('loop').click(); }
  else if (e.key === 's' && info.safe.bottom) { $('safe-on').click(); }
  else if (e.key === 'Escape') { pin = null; focusNote = null; moment(); }
  else if (e.key === '?') $('help-btn').click();
});

/* ---- the sound: each layer of the mix on its own, through a gain per slider ---- */
var sound = { ctx: null, key: null, els: {}, gains: {}, dirty: false, buses: [] };
var BUS = { voices: 'voice', music: 'music', ambience: 'ambience', effects: 'sfx' };
var sliders = function () { return Array.prototype.slice.call(document.querySelectorAll('#mixer input')); };
var gainOf = function (db) { return db <= -30 ? 0 : Math.pow(10, db / 20); };
var dbOf = function (g) { return g <= 0 ? -30 : Math.max(-30, Math.min(12, 20 * Math.log10(g))); };
var filmTime = function () { var v = video(); return v ? v.currentTime : shot ? shotStart(shot) + t : 0; };
function showMixer() {
  var open = !!store('mixer') && sound.buses.length > 0;
  $('mixer').hidden = !open; $('sound-btn').classList.toggle('on', open);
  $('sound-btn').style.display = sound.buses.length ? '' : 'none';
  fit();
}
$('sound-btn').onclick = function () { store('mixer', !store('mixer')); showMixer(); };
function showLevels() {
  sliders().forEach(function (el) {
    var db = Number(el.value);
    el.nextElementSibling.textContent = db <= -30 ? 'off' : (db > 0 ? '+' : '') + db.toFixed(1) + ' dB';
    var g = sound.gains[BUS[el.dataset.k]]; if (g) g.gain.value = gainOf(db);
  });
}
function setupSound() {
  var st = info.stems;
  sound.buses = st.buses; showMixer();
  $('mix-remix').style.display = info.movie ? '' : 'none';
  if (!sound.dirty) sliders().forEach(function (el) { var g = info.mix[el.dataset.k]; el.value = dbOf(g === undefined ? 1 : g); });
  sliders().forEach(function (el) { el.disabled = st.buses.indexOf(BUS[el.dataset.k]) < 0; });
  if (st.key !== sound.key) {
    var was = playing;
    Object.keys(sound.els).forEach(function (b) { sound.els[b].pause(); });
    sound.els = {}; sound.gains = {}; sound.key = st.key;
    var waiting = st.buses.length;
    if (waiting) $('mix-status').textContent = 'preparing the sound…';
    st.buses.forEach(function (b) {
      var el = new Audio(); el.preload = 'auto';
      el.oncanplaythrough = function () { el.oncanplaythrough = null; if (--waiting === 0 && sound.key === st.key) $('mix-status').textContent = ''; };
      el.onerror = function () { $('mix-status').textContent = 'the ' + b + ' layer could not be mixed'; };
      el.src = '/api/stem?bus=' + b + '&k=' + st.key;
      sound.els[b] = el;
    });
    if (sound.ctx) connectSound();
    if (was) soundPlay();
  }
  showLevels();
}
function connectSound() {
  Object.keys(sound.els).forEach(function (b) {
    if (sound.gains[b]) return;
    var g = sound.ctx.createGain();
    sound.ctx.createMediaElementSource(sound.els[b]).connect(g).connect(sound.ctx.destination);
    sound.gains[b] = g;
  });
  showLevels();
}
function soundPlay() {
  if (!Object.keys(sound.els).length) return;
  if (!sound.ctx) { sound.ctx = new AudioContext(); connectSound(); }
  sound.ctx.resume();
  Object.keys(sound.els).forEach(function (b) {
    var el = sound.els[b];
    var go = function () { el.playbackRate = rate(); el.currentTime = filmTime(); el.play().catch(function () {}); };
    // A layer still being mixed starts where the film is once it arrives.
    if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', function () { if (playing) go(); }, { once: true });
  });
}
function soundPause() { Object.keys(sound.els).forEach(function (b) { sound.els[b].pause(); }); }
function soundSeek() { if (playing) soundPlay(); }
function soundDrift() {
  if (!playing) return;
  var ft = filmTime();
  Object.keys(sound.els).forEach(function (b) { var el = sound.els[b]; if (!el.paused && Math.abs(el.currentTime - ft) > 0.12) el.currentTime = ft; });
}
sliders().forEach(function (el) {
  el.oninput = function () { sound.dirty = true; $('mix-status').textContent = 'not saved'; showLevels(); };
});
$('mix-reset').onclick = function () { sliders().forEach(function (el) { el.value = 0; }); sound.dirty = true; $('mix-status').textContent = 'not saved'; showLevels(); };
function saveMix() {
  var mix = {};
  sliders().forEach(function (el) { mix[el.dataset.k] = Math.round(gainOf(Number(el.value)) * 1000) / 1000; });
  return api('/api/mix', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mix: mix }) }).then(function (r) {
    if (r.error) throw new Error(r.error);
    sound.dirty = false;
  });
}
$('mix-save').onclick = function () {
  saveMix().then(function () { $('mix-status').textContent = 'saved to talekit.json: the next render uses it'; }).catch(function (e) { $('mix-status').textContent = e.message; });
};
$('mix-remix').onclick = function () {
  var b = this; b.disabled = true;
  saveMix().then(function () {
    $('mix-status').textContent = 'mixing the sound under out/movie.mp4…';
    return api('/api/remix', { method: 'POST' });
  }).then(function (r) {
    if (r.error) throw new Error(r.error);
    $('mix-status').textContent = 'saved, and out/movie.mp4 has the new sound';
  }).catch(function (e) { $('mix-status').textContent = e.message; }).then(function () { b.disabled = false; });
};

/* ---- follow the agent: reload whenever a project file changes ---- */
var version = null;
setInterval(function () {
  api('/api/version').then(function (r) {
    if (version !== null && r.version !== version) load();
    version = r.version; $('live').classList.remove('off');
  }).catch(function () { $('live').classList.add('off'); });
}, 1500);
load();
</script></body></html>`;
