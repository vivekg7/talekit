/**
 * A board of samples, as one self-contained page like the review app (page.ts): any folder
 * that is not a talekit project, served beside the film and its reel. Each sound, video
 * and picture gets a player, each folder of them is one question (pick one), and a folder
 * that is a project, a sample animation, plays its render or opens its own review page.
 * Notes and picks go to the board's notes.json, for the agent's `list_notes`. Written
 * without backticks or `${` so it can live inside a template literal.
 */
export const BOARD = String.raw`<!doctype html><html><head><meta charset='utf-8'><title>talekit samples</title>
<meta name='viewport' content='width=device-width, initial-scale=1'><link rel='icon' href='data:,'>
<style>
:root{--bg:#1b1f24;--panel:#262b32;--line:#3a414a;--text:#ddd;--dim:#9aa3ad;--accent:#ffd166;--ok:#06d6a0;--bad:#f9a;--pin:#e0245e}
*{box-sizing:border-box}
body{margin:0;font:14px system-ui,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;gap:12px;align-items:center;padding:8px 14px;background:var(--panel);flex-wrap:wrap;position:sticky;top:0;z-index:2}
header strong{font-size:16px}
#apps{display:flex;flex-wrap:wrap;max-width:100%;gap:2px;background:var(--bg);border-radius:7px;padding:2px}
#apps:empty{display:none}
#apps a{color:var(--dim);text-decoration:none;padding:4px 10px;border-radius:5px}
#apps a.on{background:var(--panel);color:var(--text)}
#title{color:var(--dim)}
#live{width:8px;height:8px;border-radius:50%;background:var(--ok);display:inline-block}
#live.off{background:var(--bad)}
#ask{padding:14px 16px 0;font-size:16px}
#ask:empty{display:none}
#error{color:var(--bad);padding:14px;font-family:ui-monospace,monospace;white-space:pre-wrap}
#error:empty{display:none}
section{padding:14px 16px}
section h2{font-size:15px;margin:0 0 4px;display:flex;gap:10px;align-items:baseline}
section h2 span{color:var(--dim);font-size:12px;font-weight:normal;font-family:ui-monospace,monospace}
.state{color:var(--ok);font-size:12px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin:8px 0}
.card{background:var(--panel);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;border:2px solid transparent;min-width:0}
.card.won{border-color:var(--ok)}
.card img,.card video{width:100%;display:block;background:#000;max-height:60vh;object-fit:contain}
.card img{cursor:zoom-in}
.card audio{width:100%;display:block;padding:10px 8px 0}
.card .body{padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.card .name{display:flex;gap:8px;align-items:baseline}
.card .name b{font-weight:600;word-break:break-all}
.card .name a{color:var(--accent);font-size:12px;margin-left:auto}
.card .label{color:var(--dim)}
button,textarea{font:inherit}
button.act{background:var(--accent);color:#000;border:0;padding:5px 12px;border-radius:5px;cursor:pointer}
button.ghost{background:none;border:1px solid var(--line);color:var(--text);padding:4px 10px;border-radius:5px;cursor:pointer}
textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:6px;resize:vertical;min-height:38px}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.note{background:var(--bg);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px;border-left:3px solid var(--accent);font-size:13px}
.note.check{border-left-color:var(--ok)}
.note .nh{display:flex;gap:8px;font-size:12px;color:var(--dim)}
.note .nh .st{margin-left:auto}
.note .nr{font-size:12px;color:var(--dim);border-left:2px solid var(--line);padding-left:6px}
.empty{color:var(--dim);padding:14px 16px}
#lightbox{position:fixed;inset:0;background:#000c;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:20px;z-index:9;cursor:zoom-out}
#lightbox.on{display:flex}
#lightbox img{max-width:none;border-radius:6px}
@media (max-width:700px){.grid{grid-template-columns:minmax(0,1fr)}section{padding:10px}}
</style></head><body>
<header><strong>talekit</strong><span id='apps'></span><span id='title'></span><span id='live' title='watching the folder'></span></header>
<div id='ask'></div><div id='error'></div>
<main id='groups'></main>
<div id='lightbox'><img></div>
<script>
'use strict';
var info = null;
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var api = function (url, opts) { return fetch(url, opts).then(function (r) { return r.json(); }); };
var post = function (url, body, method) { return api(url, { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { if (r.error) alert(r.error); return load(); }); };
var stateOf = function (n) { return n.status === 'open' ? 'open' : n.toCheck ? 'check' : 'checked'; };
var dirOf = function (p) { var i = p.lastIndexOf('/'); return i < 0 ? '.' : p.slice(0, i); };
/** The last pick among this folder's samples. */
function pickIn(dir) {
  var p = info.notes.filter(function (n) { return n.pick && n.target.kind === 'file' && dirOf(n.target.id) === dir; });
  return p[p.length - 1];
}

function noteItem(n) {
  var st = stateOf(n), d = document.createElement('div');
  d.className = 'note ' + st;
  d.innerHTML = "<div class='nh'><span>" + esc(n.id) + (n.pick ? ' · pick' : '') + "</span><span class='st'>" + { open: 'open', check: 'fixed: check it', checked: 'done' }[st] + '</span></div><div>' + esc(n.text) + '</div>' +
    (n.replies || []).map(function (r) { return "<div class='nr'>reopened: " + esc(r.text) + '</div>'; }).join('') + "<div class='row'></div>";
  var row = d.querySelector('.row');
  var btn = function (label, cls, fn) { var b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; row.appendChild(b); };
  if (st === 'check') { btn('Looks good', 'act', function () { post('api/notes/' + n.id, { checked: true }, 'PATCH'); }); btn('Reopen', 'ghost', function () { var r = prompt('What is still wrong?'); if (r !== null) post('api/notes/' + n.id, { status: 'open', reply: r }, 'PATCH'); }); }
  else if (st === 'open') { btn('Close', 'ghost', function () { post('api/notes/' + n.id, { status: 'done', checked: true }, 'PATCH'); }); btn('Delete', 'ghost', function () { if (confirm('Delete ' + n.id + '?')) api('api/notes/' + n.id, { method: 'DELETE' }).then(load); }); }
  return d;
}
/** A note box for a sample (or a whole folder: "none of these"), with Pick for a sample. */
function noteBox(el, target, pickable, placeholder) {
  var ta = document.createElement('textarea'); ta.placeholder = placeholder;
  var row = document.createElement('div'); row.className = 'row';
  var add = document.createElement('button'); add.className = 'ghost'; add.textContent = 'Add note';
  var go = function () { if (ta.value.trim()) post('api/notes', { target: target, text: ta.value }); };
  add.onclick = go;
  ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
  row.appendChild(add);
  if (pickable) {
    var pick = document.createElement('button'); pick.className = 'act'; pick.textContent = 'Pick this';
    pick.title = 'Choose this one; the note box above says why (optional)';
    pick.onclick = function () { post('api/pick', { target: target, text: ta.value }); };
    row.insertBefore(pick, add);
  }
  el.appendChild(ta); el.appendChild(row);
}
var notesOn = function (id) { return info.notes.filter(function (n) { return n.target.kind === 'file' && n.target.id === id && (stateOf(n) !== 'checked' || n.pick); }); };

function media(e) {
  var src = 'file?path=' + encodeURIComponent(e.path) + '&v=' + e.mtime;
  if (e.kind === 'audio') return "<audio controls preload='none' src='" + src + "'></audio>";
  if (e.kind === 'video') return "<video controls preload='metadata' playsinline src='" + src + "'></video>";
  if (e.kind === 'image') return "<img loading='lazy' src='" + src + "'>";
  // A sample animation: its render if it has one, else a frame drawn live.
  var page = '../' + encodeURIComponent(e.slug) + '/';
  return e.movie ? "<video controls preload='metadata' playsinline src='" + page + 'movie.mp4?v=' + e.mtime + "'></video>" : "<img data-project='" + page + "'>";
}

function render() {
  var el = $('groups'); el.innerHTML = '';
  if (!info.groups.length) { el.innerHTML = "<div class='empty'>Nothing here yet: sounds, videos, pictures or a sample project in this folder show up as they are written.</div>"; return; }
  info.groups.forEach(function (g) {
    var sec = document.createElement('section'), dir = g.dir || '.', won = pickIn(dir);
    var several = g.entries.length > 1;
    sec.innerHTML = '<h2>' + esc(g.label || (g.dir ? g.dir : info.title)) + (g.label && g.dir ? '<span>' + esc(g.dir) + '</span>' : '') + '</h2>' +
      (won ? "<div class='state'>picked " + esc(won.target.id.split('/').pop()) + (won.status === 'open' ? ': waiting for the agent' : ', done') + '</div>' : '') + "<div class='grid'></div><div class='gnotes'></div>";
    g.entries.forEach(function (e) {
      var card = document.createElement('div');
      card.className = 'card' + (won && won.target.id === e.path ? ' won' : '');
      card.innerHTML = media(e) + "<div class='body'><div class='name'><b>" + esc(e.name) + '</b>' + (e.kind === 'project' ? "<a href='../" + encodeURIComponent(e.slug) + "/'>open its review</a>" : '') + '</div>' +
        (e.label ? "<div class='label'>" + esc(e.label) + '</div>' : '') + "<div class='notes'></div></div>";
      notesOn(e.path).forEach(function (n) { card.querySelector('.notes').appendChild(noteItem(n)); });
      noteBox(card.querySelector('.body'), { kind: 'file', id: e.path }, several, 'What do you think of this one?');
      card.querySelectorAll('img:not([data-project])').forEach(function (img) { img.onclick = function () { $('lightbox').classList.add('on'); $('lightbox').querySelector('img').src = this.src; }; });
      sec.querySelector('.grid').appendChild(card);
    });
    var gn = sec.querySelector('.gnotes');
    notesOn(dir).forEach(function (n) { gn.appendChild(noteItem(n)); });
    if (several) noteBox(gn, { kind: 'file', id: dir }, false, 'A note on all of these (none of them, try another way…)');
    el.appendChild(sec);
  });
  // A sample project without a render shows the middle of its first shot.
  document.querySelectorAll('img[data-project]').forEach(function (img) {
    var page = img.dataset.project;
    api(page + 'api/project').then(function (p) {
      var s = p.shots && p.shots[0];
      if (s) img.src = page + 'api/frame?shot=' + encodeURIComponent(s.id) + '&t=' + s.duration / 2 + '&v=' + p.version;
      img.onclick = function () { location.href = page; };
    });
  });
}
// One sample plays at a time.
document.addEventListener('play', function (e) {
  document.querySelectorAll('audio,video').forEach(function (m) { if (m !== e.target) m.pause(); });
}, true);
$('lightbox').onclick = function () { this.classList.remove('on'); };

function renderApps() {
  var el = $('apps');
  if (info.apps.length < 2) { el.innerHTML = ''; return; }
  var kindOf = function (a) { return a.kind === 'board' ? 'Samples' : a.portrait ? 'Reel' : 'Film'; };
  var count = {};
  info.apps.forEach(function (a) { var k = kindOf(a); count[k] = (count[k] || 0) + 1; });
  el.innerHTML = info.apps.map(function (a) {
    var k = kindOf(a), name = count[k] > 1 ? k + ': ' + a.title : k;
    return "<a href='../" + encodeURIComponent(a.slug) + "/'" + (a.here ? " class='on'" : '') + " title='" + esc(a.title) + "'>" + esc(name) + '</a>';
  }).join('');
}

function load() {
  return api('api/board').then(function (data) {
    if (data.error) { $('error').textContent = data.error; $('live').classList.add('off'); return; }
    $('error').textContent = ''; $('live').classList.remove('off');
    // Keep what is playing playing: redraw only when something changed.
    var key = JSON.stringify([data.groups, data.notes]);
    var same = info && info.key === key;
    info = data; info.key = key;
    document.title = info.title + ' · talekit samples';
    $('title').textContent = info.title;
    $('ask').textContent = info.ask || '';
    renderApps();
    if (!same) render();
  });
}
var version = null;
setInterval(function () {
  api('api/version').then(function (r) {
    // This board is no longer served (the server restarted with others): go to what is.
    if (r.gone) { location.replace('../'); return; }
    if (version !== null && r.version !== version) load();
    version = r.version; $('live').classList.remove('off');
  }).catch(function () { $('live').classList.add('off'); });
}, 1500);
load();
</script></body></html>`;
