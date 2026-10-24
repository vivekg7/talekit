/**
 * The review app, as one self-contained page. No framework, no build step: the server
 * embeds it, and everything dynamic comes from /api/*. Written without backticks or `${`
 * so it can live inside a template literal.
 */
export const PAGE = String.raw`<!doctype html><html><head><meta charset='utf-8'><title>talekit review</title>
<meta name='viewport' content='width=device-width, initial-scale=1'><link rel='icon' href='data:,'>
<style>
:root{--bg:#1b1f24;--panel:#262b32;--line:#3a414a;--text:#ddd;--dim:#9aa3ad;--accent:#ffd166;--ok:#06d6a0;--bad:#f9a}
*{box-sizing:border-box}
body{margin:0;font:14px system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;height:100vh}
header{display:flex;gap:14px;align-items:center;padding:8px 14px;background:var(--panel);flex-wrap:wrap}
header strong{font-size:16px}
nav{display:flex;gap:4px;margin-left:auto}
nav button{background:none;border:1px solid transparent;color:var(--dim);padding:6px 12px;border-radius:6px;cursor:pointer;font:inherit}
nav button.on{color:var(--text);border-color:var(--line);background:var(--bg)}
nav button .n{background:var(--accent);color:#000;border-radius:10px;padding:0 6px;font-size:11px;margin-left:4px}
#live{width:8px;height:8px;border-radius:50%;background:var(--ok);display:inline-block}
#live.off{background:var(--bad)}
main{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.view{display:none;flex:1;min-height:0;flex-direction:column}
.view.on{display:flex}
button,select,input,textarea{font:inherit}
button.act{background:var(--accent);color:#000;border:0;padding:5px 12px;border-radius:5px;cursor:pointer}
button.ghost{background:none;border:1px solid var(--line);color:var(--text);padding:4px 10px;border-radius:5px;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
#stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;min-height:0;position:relative}
#stage svg,#stage video{max-width:100%;max-height:100%;height:auto;box-shadow:0 0 0 1px #000,0 10px 40px #0008;background:#000}
#controls{display:flex;gap:10px;align-items:center;padding:6px 14px;flex-wrap:wrap}
#scrubwrap{flex:1;min-width:220px;position:relative;height:28px;display:flex;align-items:center}
#scrub{width:100%;margin:0}
#marks{position:absolute;left:8px;right:8px;top:0;height:8px;pointer-events:none}
#marks i{position:absolute;top:0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--accent);margin-left:-5px}
#t{font-variant-numeric:tabular-nums;min-width:120px}
#strip{display:flex;gap:8px;padding:6px 14px 10px;overflow-x:auto;flex-shrink:0}
#strip .shot{flex:0 0 auto;width:150px;cursor:pointer;border:2px solid transparent;border-radius:6px;padding:3px;color:var(--dim);font-size:12px}
#strip .shot.on{border-color:var(--accent);color:var(--text)}
#strip img{width:100%;display:block;border-radius:3px;background:#000}
#strip .shot b{display:block;font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#strip .shot b .dots{color:var(--accent)}
#problems{white-space:pre-wrap;color:var(--bad);padding:0 14px 8px;font-family:ui-monospace,monospace;font-size:12px}
.notebox{display:flex;gap:8px;padding:0 14px 8px;align-items:flex-start}
.notebox textarea{flex:1;min-height:38px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:6px;resize:vertical}
.notebox .where{color:var(--dim);font-size:12px;min-width:150px;padding-top:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px;padding:14px}
.card{background:var(--panel);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;display:block;background:#e9eef3;cursor:zoom-in}
.card img.construction{border-top:1px solid var(--line)}
.card .body{padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.card .title{display:flex;align-items:baseline;gap:8px}
.card .title b{font-size:15px}
.card .title span{color:var(--dim);font-size:12px}
.card .notes{font-size:12px;color:var(--accent)}
.card textarea{width:100%;min-height:36px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:6px;resize:vertical}
.card .row{display:flex;gap:8px;align-items:center}
#notes-list{padding:14px;display:flex;flex-direction:column;gap:8px}
.note{display:grid;grid-template-columns:48px 220px 1fr auto;gap:10px;align-items:center;background:var(--panel);padding:8px 12px;border-radius:6px}
.note.done{opacity:.5}
.note .id{color:var(--dim);font-family:ui-monospace,monospace}
.note .where{color:var(--accent);cursor:pointer}
.note .where.plain{color:var(--dim);cursor:default}
.note .btns{display:flex;gap:6px}
.empty{color:var(--dim);padding:14px}
#lightbox{position:fixed;inset:0;background:#000c;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:20px;z-index:9;cursor:zoom-out}
#lightbox.on{display:flex}
#lightbox img{max-width:none;background:#e9eef3;border-radius:6px}
.hint{color:var(--dim);font-size:12px;padding:0 14px 8px}
#mixer{display:flex;gap:6px 16px;align-items:center;padding:0 14px 8px;flex-wrap:wrap}
#mixer[hidden]{display:none}
#mixer b{font-weight:600}
#mixer label{display:flex;gap:6px;align-items:center;color:var(--dim)}
#mixer input{width:110px}
#mixer output{min-width:52px;font-variant-numeric:tabular-nums;color:var(--text)}
#mix-status{color:var(--dim);font-size:12px}
</style></head><body>
<header>
  <strong>talekit</strong><span id='title'></span><span id='live' title='watching the project directory'></span>
  <nav>
    <button data-view='film' class='on'>Film</button>
    <button data-view='characters'>Characters</button>
    <button data-view='scenes'>Scenes</button>
    <button data-view='notes'>Notes<span class='n' id='nopen' hidden></span></button>
  </nav>
</header>
<main>
  <section class='view on' id='view-film'>
    <div id='stage'></div>
    <div id='controls'>
      <button id='play' class='ghost'>Play</button>
      <div id='scrubwrap'><div id='marks'></div><input id='scrub' type='range' min='0' max='1' step='0.01' value='0'></div>
      <span id='t'>0.00s</span>
      <select id='source'><option value='live'>live frames</option><option value='video'>rendered video</option></select>
      <label><input id='debug' type='checkbox'> anchors</label>
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
    <div id='strip'></div>
    <div class='notebox'>
      <span class='where' id='note-where'></span>
      <textarea id='note-text' placeholder='What is wrong at this moment? (Enter to add, Shift+Enter for a new line)'></textarea>
      <button class='act' id='note-add'>Add note</button>
    </div>
    <div class='hint'>Space plays, arrow keys step one frame, [ and ] change shot. Yellow marks on the scrubber are notes on this shot. The sound is the film's, played through the sliders: move one while it plays to hear the change.</div>
    <div id='problems'></div>
  </section>
  <section class='view' id='view-characters'><div class='grid' id='characters'></div></section>
  <section class='view' id='view-scenes'><div class='grid' id='scenes'></div></section>
  <section class='view' id='view-notes'><div id='notes-list'></div></section>
</main>
<div id='lightbox'><img></div>
<script>
'use strict';
var info = null, shot = null, t = 0, playing = false, last = 0, busy = false, pending = false, view = 'film';
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var api = function (url, opts) { return fetch(url, opts).then(function (r) { return r.json(); }); };
var shotStart = function (s) { var sum = 0; for (var i = 0; i < info.shots.length; i++) { if (info.shots[i].id === s.id) break; sum += info.shots[i].duration; } return sum; };
var notesFor = function (kind, id) { return info.notes.filter(function (n) { return n.status === 'open' && n.target.kind === kind && n.target.id === id; }); };

function show(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
  document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('on', s.id === 'view-' + v); });
  if (v !== 'film' && playing) $('play').click();
}
document.querySelectorAll('nav button').forEach(function (b) { b.onclick = function () { show(b.dataset.view); }; });

function load() {
  return api('/api/project').then(function (data) {
    if (data.error) { $('problems').textContent = data.error; $('live').classList.add('off'); return; }
    $('live').classList.remove('off');
    info = data;
    $('title').textContent = info.title + ' · ' + info.duration.toFixed(1) + 's · ' + info.shots.length + ' shots';
    $('problems').textContent = info.problems === 'OK' ? '' : info.problems;
    var open = info.notes.filter(function (n) { return n.status === 'open'; }).length;
    $('nopen').hidden = !open; $('nopen').textContent = open;
    $('source').style.display = info.movie ? '' : 'none';
    $('source').options[1].textContent = info.movie ? 'rendered video' + (info.movie.stale ? ' (older than the shots)' : '') : '';
    if (!info.movie && $('source').value === 'video') $('source').value = 'live';
    renderStrip(); renderCards('characters'); renderCards('scenes'); renderNotes(); setupSound();
    var cur = shot && info.shots.find(function (s) { return s.id === shot.id; });
    shot = cur || info.shots[0] || null;
    if (shot) { t = Math.min(t, shot.duration); $('scrub').max = shot.duration; }
    syncStage(); draw();
  });
}

function renderStrip() {
  var el = $('strip'); el.innerHTML = '';
  info.shots.forEach(function (s, i) {
    var d = document.createElement('div'); d.className = 'shot'; d.dataset.id = s.id;
    var n = notesFor('shot', s.id).length;
    d.innerHTML = "<img src='/api/frame?shot=" + encodeURIComponent(s.id) + '&t=' + (s.duration / 2) + '&v=' + info.version + "'><b>" + (i + 1) + '. ' + esc(s.id) + ' · ' + s.duration + 's' + (n ? " <span class='dots'>" + '●'.repeat(Math.min(n, 5)) + '</span>' : '') + '</b>';
    d.onclick = function () { jumpTo(s.id, 0); };
    el.appendChild(d);
  });
  markStrip();
}
function markStrip() {
  document.querySelectorAll('#strip .shot').forEach(function (d) { d.classList.toggle('on', !!shot && d.dataset.id === shot.id); });
  var m = $('marks'); m.innerHTML = '';
  if (!shot) return;
  notesFor('shot', shot.id).forEach(function (n) {
    var i = document.createElement('i'); i.style.left = (100 * (n.target.t || 0) / shot.duration) + '%'; i.title = n.id + ': ' + n.text; m.appendChild(i);
  });
}

function renderCards(kind) {
  var el = $(kind); el.innerHTML = '';
  var items = info[kind];
  if (!items.length) { el.innerHTML = "<div class='empty'>No " + kind + ' yet.</div>'; return; }
  var k = kind === 'characters' ? 'character' : 'scene';
  items.forEach(function (c) {
    var open = notesFor(k, c.id);
    var card = document.createElement('div'); card.className = 'card';
    var meta = kind === 'characters' ? c.rig + ' rig · ' + c.height + 'px' : 'anchors: ' + (c.anchors.join(', ') || 'none');
    var sheet = '/api/sheet?id=' + encodeURIComponent(c.id) + '&v=' + info.version;
    card.innerHTML = "<img src='" + sheet + "'>" +
      (kind === 'characters' ? "<img class='construction' title='Construction: what the linter checked' src='" + sheet + "&kind=construction'>" : '') +
      "<div class='body'><div class='title'><b>" + esc(c.name) + '</b><span>' + esc(c.id) + ' · ' + esc(meta) + '</span></div>' +
      (open.length ? "<div class='notes'>" + open.map(function (n) { return esc(n.id + ': ' + n.text); }).join('<br>') + '</div>' : '') +
      "<textarea placeholder='What should change about this " + k + "?'></textarea><div class='row'><button class='act'>Add note</button></div></div>";
    card.querySelectorAll('img').forEach(function (img) { img.onclick = function () { lightbox(this.src); }; });
    var ta = card.querySelector('textarea');
    var add = function () { if (!ta.value.trim()) return; postNote({ kind: k, id: c.id }, ta.value).then(function () { ta.value = ''; }); };
    card.querySelector('button').onclick = add;
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } };
    el.appendChild(card);
  });
}

function renderNotes() {
  var el = $('notes-list'); el.innerHTML = '';
  if (!info.notes.length) { el.innerHTML = "<div class='empty'>No notes yet. Add one from the film, a character or a scene; the agent reads open notes with list_notes.</div>"; return; }
  info.notes.slice().reverse().forEach(function (n) {
    var d = document.createElement('div'); d.className = 'note' + (n.status === 'done' ? ' done' : '');
    var isShot = n.target.kind === 'shot';
    var where = isShot ? 'shot ' + n.target.id + (n.target.t !== undefined ? ' @ ' + n.target.t.toFixed(2) + 's' : '') : n.target.kind + ' ' + n.target.id;
    d.innerHTML = "<span class='id'>" + esc(n.id) + "</span><span class='where" + (isShot ? '' : ' plain') + "'>" + esc(where) + '</span><span>' + esc(n.text) + "</span><span class='btns'></span>";
    if (isShot) d.querySelector('.where').onclick = function () { show('film'); jumpTo(n.target.id, n.target.t || 0); };
    var btns = d.querySelector('.btns');
    var b1 = document.createElement('button'); b1.className = 'ghost'; b1.textContent = n.status === 'open' ? 'Done' : 'Reopen';
    b1.onclick = function () { api('/api/notes/' + n.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: n.status === 'open' ? 'done' : 'open' }) }).then(load); };
    var b2 = document.createElement('button'); b2.className = 'ghost'; b2.textContent = 'Delete';
    b2.onclick = function () { api('/api/notes/' + n.id, { method: 'DELETE' }).then(load); };
    btns.appendChild(b1); btns.appendChild(b2);
    el.appendChild(d);
  });
}

function postNote(target, text) {
  return api('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: target, text: text }) }).then(function (r) {
    if (r.error) alert(r.error); else return load();
  });
}
$('note-add').onclick = function () {
  var ta = $('note-text'); if (!shot || !ta.value.trim()) return;
  postNote({ kind: 'shot', id: shot.id, t: Math.round(t * 100) / 100 }, ta.value).then(function () { ta.value = ''; });
};
$('note-text').onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('note-add').click(); } e.stopPropagation(); };
$('note-text').onfocus = function () { if (playing) $('play').click(); };

function lightbox(src) { $('lightbox').classList.add('on'); $('lightbox').querySelector('img').src = src; }
$('lightbox').onclick = function () { $('lightbox').classList.remove('on'); };

function jumpTo(id, time) {
  var s = info.shots.find(function (x) { return x.id === id; }); if (!s) return;
  shot = s; t = Math.min(time, s.duration); $('scrub').max = s.duration; markStrip();
  if (video()) video().currentTime = shotStart(s) + t;
  soundSeek(); draw();
}

/* ---- the stage: live SVG frames, or the rendered mp4 when it exists ---- */
function video() { return $('source').value === 'video' ? $('stage').querySelector('video') : null; }
function syncStage() {
  var st = $('stage');
  if ($('source').value === 'video' && info.movie) {
    var old = st.querySelector('video');
    if (old && old.dataset.m !== String(info.movie.mtime)) { if (playing) $('play').click(); old = null; }
    if (!old) {
      st.innerHTML = "<video src='/movie.mp4?v=" + info.movie.mtime + "' data-m='" + info.movie.mtime + "' preload='auto' muted></video>";
      var v = st.querySelector('video');
      v.muted = true;
      v.ontimeupdate = function () { if (!shot) return; var tt = v.currentTime; for (var i = 0; i < info.shots.length; i++) { var s = info.shots[i]; if (tt < s.duration || i === info.shots.length - 1) { if (shot.id !== s.id) { shot = s; $('scrub').max = s.duration; markStrip(); } t = Math.max(0, Math.min(tt, s.duration)); break; } tt -= s.duration; } $('scrub').value = t; $('t').textContent = label(); soundDrift(); };
      v.onended = function () { playing = false; $('play').textContent = 'Play'; soundPause(); };
      // The sound starts when the picture does, not when it was asked to.
      v.onplaying = function () { if (playing) soundPlay(); };
      v.onloadedmetadata = function () { if (shot) v.currentTime = shotStart(shot) + t; };
    }
  } else if (st.querySelector('video')) st.innerHTML = '';
  $('debug').disabled = !!video();
}
$('source').onchange = function () { if (playing) $('play').click(); syncStage(); draw(); };
function label() { return shot ? shot.id + ' · ' + t.toFixed(2) + 's' : ''; }
$('note-where').textContent = '';
function draw() {
  if (!shot) { $('stage').innerHTML = ''; return; }
  $('scrub').value = t; $('t').textContent = label(); $('note-where').textContent = 'note at ' + label();
  if (video()) return;
  if (busy) { pending = true; return; }
  busy = true;
  fetch('/api/frame?shot=' + encodeURIComponent(shot.id) + '&t=' + t + ($('debug').checked ? '&debug=1' : '')).then(function (r) { return r.text(); }).then(function (svg) {
    $('stage').innerHTML = svg; busy = false; if (pending) { pending = false; draw(); }
  });
}
function tick(now) {
  if (!playing || video()) return;
  var dt = (now - last) / 1000; last = now; t += dt;
  if (t >= shot.duration) {
    var i = info.shots.indexOf(shot);
    if (i < info.shots.length - 1) { shot = info.shots[i + 1]; t = 0; $('scrub').max = shot.duration; markStrip(); }
    else { t = shot.duration - 1 / info.fps; playing = false; $('play').textContent = 'Play'; soundPause(); }
  }
  soundDrift(); draw(); requestAnimationFrame(tick);
}
$('play').onclick = function () {
  if (!shot) return;
  playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play';
  var v = video();
  if (v) { if (playing) { if (t >= shot.duration - 0.02) jumpTo(shot.id, 0); v.play(); } else { v.pause(); soundPause(); } return; }
  if (playing) { if (t >= shot.duration - 0.02) t = 0; last = performance.now(); requestAnimationFrame(tick); soundPlay(); } else soundPause();
};
$('scrub').oninput = function (e) { t = Number(e.target.value); var v = video(); if (v) v.currentTime = shotStart(shot) + t; soundSeek(); draw(); };
$('debug').onchange = draw;
document.addEventListener('keydown', function (e) {
  if (view !== 'film' || !shot || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  var step = 1 / info.fps, i = info.shots.indexOf(shot);
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  else if (e.code === 'ArrowRight') jumpTo(shot.id, Math.min(shot.duration, t + step));
  else if (e.code === 'ArrowLeft') jumpTo(shot.id, Math.max(0, t - step));
  else if (e.key === ']' && i < info.shots.length - 1) jumpTo(info.shots[i + 1].id, 0);
  else if (e.key === '[' && i > 0) jumpTo(info.shots[i - 1].id, 0);
  else if (e.key === 'n') { $('note-text').focus(); }
});

/* ---- the sound: each layer of the mix on its own, through a gain per slider ---- */
var sound = { ctx: null, key: null, els: {}, gains: {}, dirty: false };
var BUS = { voices: 'voice', music: 'music', ambience: 'ambience', effects: 'sfx' };
var sliders = function () { return Array.prototype.slice.call(document.querySelectorAll('#mixer input')); };
var gainOf = function (db) { return db <= -30 ? 0 : Math.pow(10, db / 20); };
var dbOf = function (g) { return g <= 0 ? -30 : Math.max(-30, Math.min(12, 20 * Math.log10(g))); };
var filmTime = function () { var v = video(); return v ? v.currentTime : shot ? shotStart(shot) + t : 0; };
function showLevels() {
  sliders().forEach(function (el) {
    var db = Number(el.value);
    el.nextElementSibling.textContent = db <= -30 ? 'off' : (db > 0 ? '+' : '') + db.toFixed(1) + ' dB';
    var g = sound.gains[BUS[el.dataset.k]]; if (g) g.gain.value = gainOf(db);
  });
}
function setupSound() {
  var st = info.stems;
  $('mixer').hidden = !st.buses.length;
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
    var go = function () { el.currentTime = filmTime(); el.play().catch(function () {}); };
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
