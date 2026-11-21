'use strict';
/* 项目Git · Obsidian 风格关系图谱
   只有圆点、细线和标签；颜色区分类别；悬停聚焦；标签随缩放淡出。
*/

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR = {
  plan: '#5aa9d6', decision: '#e06c62', retro: '#9b8ad4',
  doc: '#b08d6a', data: '#4fb3a6', code: '#7f92ab', output: '#d6a04a',
  asset: '#6fa96a', version: '#8d959f',
};
const R_BASE = { decision: 8.5, output: 8, plan: 7, retro: 6.5, data: 6.5, doc: 6, code: 6, asset: 6, version: 6 };

let S = { projects: [], types: [], nodes: [], edges: [], queue: [] };
let ns = [], ls = [], byId = new Map();
let sim = null, canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, selected = null, hovered = null, focus = null;
let dragNode = null, panning = null, movedFar = false;
let anim = null;

const typeName = (id) => (S.types.find((t) => t.id === id) || { name: id }).name;
const projName = (id) => (S.projects.find((p) => p.id === id) || { name: id }).name;
const colOf = (n) => COLOR[n.type] || '#8d959f';

function toast(t, ms = 1900) {
  const e = $('#toast'); e.textContent = t; e.classList.remove('hidden');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('hidden'), ms);
}

/* ---------- 载入 ---------- */
async function boot() {
  canvas = $('#c'); ctx = canvas.getContext('2d');
  bindUI();
  S = await window.api.state();
  const first = S.projects.find((p) => S.nodes.some((n) => n.project === p.id && n.status !== 'deleted'));
  curProject = (S.projects.find((p) => p.id === 'p_pricing') || first || S.projects[0] || {}).id;
  renderTabs();
  resize();
  rebuild();
  window.addEventListener('resize', () => { resize(); draw(); });
}

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  S.projects.forEach((p) => {
    const n = S.nodes.filter((x) => x.project === p.id && x.status !== 'deleted').length;
    if (!n) return;
    const b = document.createElement('button');
    b.className = 'tab' + (p.id === curProject ? ' on' : '');
    b.textContent = p.name;
    b.onclick = () => { curProject = p.id; selected = null; $('#panel').classList.add('hidden'); renderTabs(); rebuild(); };
    box.appendChild(b);
  });
}

/* ---------- 建图 ---------- */
function rebuild() {
  const vn = S.nodes.filter((n) => n.status !== 'deleted' && n.project === curProject);
  const deg = new Map();
  S.edges.forEach((e) => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });

  ns = vn.map((n) => ({
    id: n.id, n,
    r: (R_BASE[n.type] || 6) + Math.min(5, Math.sqrt(deg.get(n.id) || 0) * 1.6),
    x: (Math.random() - 0.5) * 300,
    y: (Math.random() - 0.5) * 300,
  }));
  byId = new Map(ns.map((d) => [d.id, d]));
  ls = S.edges
    .filter((e) => e.kind !== 'uses' && byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  if (sim) sim.stop();
  sim = d3.forceSimulation(ns)
    .force('link', d3.forceLink(ls).id((d) => d.id).distance(96).strength(0.55))
    .force('charge', d3.forceManyBody().strength(-520).distanceMax(900))
    .force('collide', d3.forceCollide().radius((d) => d.r + 26))
    .force('center', d3.forceCenter(0, 0).strength(0.08))
    .alphaDecay(0.03)
    .on('tick', draw)
    .on('end', fit);
  draw();
  setTimeout(fit, 400);
  setTimeout(fit, 1500);
}

/* ---------- 画 ---------- */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
}

function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a1a1c';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  // 连线：细、低对比
  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const sup = l.kind === 'supersedes';
    ctx.globalAlpha = on ? 1 : 0.12;
    ctx.strokeStyle = sup ? 'rgba(224,108,98,.55)' : 'rgba(255,255,255,.10)';
    ctx.lineWidth = (sup ? 1.4 : 0.8) / cam.k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // 节点：纯圆
  ns.forEach((d) => {
    const on = !focus || focus.has(d.id);
    const col = d.n.status === 'superseded' || d.n.status === 'abandoned' ? '#4a4d54' : colOf(d.n);
    ctx.globalAlpha = on ? 1 : 0.15;
    if (selected === d.id) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 / cam.k, 0, 7);
      ctx.fillStyle = col + '33'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    if (hovered === d.id || selected === d.id) {
      ctx.lineWidth = 1.2 / cam.k; ctx.strokeStyle = '#f2f4f8'; ctx.stroke();
    }
  });
  ctx.restore();

  // 标签：屏幕空间，缩放越大越明显
  const showAll = ns.length <= 30 ? 1 : clamp((cam.k - 0.45) / 0.35, 0, 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ns.forEach((d) => {
    const on = !focus || focus.has(d.id);
    const isHot = hovered === d.id || selected === d.id;
    const alpha = isHot || (focus && focus.has(d.id)) ? 1 : (on ? showAll * 0.9 : 0.12);
    if (alpha <= 0.02) return;
    const [sx, sy] = [d.x * cam.k + cam.x, d.y * cam.k + cam.y];
    if (sx < -200 || sx > W + 200 || sy < -50 || sy > H + 50) return;
    ctx.globalAlpha = alpha;
    ctx.font = `${isHot ? 600 : 400} 11.5px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = isHot ? '#ffffff' : '#a9aeb8';
    ctx.fillText(d.n.title.length > 18 ? d.n.title.slice(0, 18) + '…' : d.n.title,
      sx + (d.r * cam.k) + 7, sy);
  });
  ctx.globalAlpha = 1;
}

/* ---------- 相机 ---------- */
function fit() {
  if (!ns.length) return;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const pad = 90;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.25, 1.6);
  cam.k = k;
  cam.x = W / 2 - ((minX + maxX) / 2) * k;
  cam.y = (H + 44) / 2 - ((minY + maxY) / 2) * k;
  draw();
}

function flyTo(x, y, k) {
  const from = { ...cam }, t0 = performance.now(), dur = 320;
  const tgt = { x: W / 2 - x * k, y: (H + 44) / 2 - y * k, k };
  if (anim) cancelAnimationFrame(anim);
  const step = (now) => {
    const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
    cam.x = from.x + (tgt.x - from.x) * e;
    cam.y = from.y + (tgt.y - from.y) * e;
    cam.k = from.k + (tgt.k - from.k) * e;
    draw();
    if (p < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

/* ---------- 交互 ---------- */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = ns.length - 1; i >= 0; i--) {
    const d = ns[i];
    if ((wx - d.x) ** 2 + (wy - d.y) ** 2 <= (d.r + 6) ** 2) return d;
  }
  return null;
}

function setFocus(id) {
  if (!id) { focus = null; return; }
  const set = new Set([id]);
  S.edges.forEach((e) => {
    if (e.from === id) set.add(e.to);
    else if (e.to === id) set.add(e.from);
  });
  focus = set;
}

function bindUI() {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0015), 0.15, 4);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.k = k2; cam.x = e.offsetX - wx * k2; cam.y = e.offsetY - wy * k2;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    movedFar = false;
    if (d) {
      dragNode = { d, sx: e.offsetX, sy: e.offsetY };
      d.fx = d.x; d.fy = d.y;
      hovered = d.id; setFocus(d.id); draw();
      return;
    }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
  });

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }

    if (dragNode) {
      if (Math.hypot(sx - dragNode.sx, sy - dragNode.sy) > 3) movedFar = true;
      const [wx, wy] = toWorld(sx, sy);
      dragNode.d.fx = wx; dragNode.d.fy = wy;
      dragNode.d.x = wx; dragNode.d.y = wy;
      if (sim) sim.alpha(0.06).restart();
      draw();
      return;
    }

    const d = pick(sx, sy);
    const id = d ? d.id : null;
    if (id !== hovered) {
      hovered = id;
      setFocus(id || (selected || null));
      draw();
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragNode) {
      const d = dragNode.d;
      if (!movedFar) { select(d.id); }
      d.fx = null; d.fy = null;
      dragNode = null;
      if (sim) sim.alpha(0.25).restart();   // 松手后缓慢回弹
    }
    panning = null;
  });

  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) flyTo(d.x, d.y, Math.max(1.4, cam.k * 1.5));
  });

  $('#btn-capture').onclick = () => {
    $('#modal').classList.remove('hidden');
    $('#m-date').valueAsDate = new Date();
    $('#m-text').focus();
  };
  $('#m-go').onclick = doCapture;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $('#modal').classList.add('hidden'); });

  $('#search').addEventListener('input', (e) => { clearTimeout(window._st); window._st = setTimeout(() => doSearch(e.target.value), 200); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; setFocus(null); $('#search-hint').classList.remove('on'); draw(); } });
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { selected = null; focus = null; $('#panel').classList.add('hidden'); draw(); }
    if (e.key === 'f' || e.key === 'F') fit();
    if (e.key === 'r' || e.key === 'R') { if (sim) { ns.forEach((d) => { d.fx = null; d.fy = null; }); sim.alpha(0.8).restart(); } }
  });
}

/* ---------- 详情 ---------- */
function select(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  selected = id; setFocus(id);
  $('#p-title').textContent = n.title;
  $('#p-meta').textContent = `${typeName(n.type)} · ${n.content_at}`;
  const body = $('#p-body'); body.innerHTML = '';
  if (n.summary) body.appendChild(Object.assign(document.createElement('div'), { className: 'summary', textContent: n.summary }));

  const src = n.source || {};
  body.appendChild(Object.assign(document.createElement('h4'), { textContent: '出处' }));
  if (src.file) {
    const box = document.createElement('div'); box.className = 'src';
    const loc = src.locator || {};
    const locTxt = loc.kind === 'pdf' ? `第 ${loc.page} 页` : (loc.start != null ? `第 ${loc.start}–${loc.end} 字` : '');
    box.innerHTML = `<div class="src-file">${src.file}</div>${locTxt ? `<div class="src-loc">${locTxt}</div>` : ''}` +
      `<div class="src-ex"></div>`;
    box.querySelector('.src-ex').textContent = src.excerpt || '';
    body.appendChild(box);
    const b = document.createElement('button');
    b.className = 'btn primary open'; b.textContent = '打开文件';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id }).then((r) => { if (r && r.error) toast(r.error); });
    body.appendChild(b);
  } else {
    body.appendChild(Object.assign(document.createElement('div'), { className: 'summary', textContent: '粘贴输入，没有原始文件。' }));
  }

  const ex = n.extra || {};
  if (Object.keys(ex).length) {
    body.appendChild(Object.assign(document.createElement('h4'), { textContent: '字段' }));
    const kv = document.createElement('div'); kv.className = 'kv';
    Object.entries(ex).forEach(([k, v]) => {
      kv.appendChild(Object.assign(document.createElement('div'), { className: 'k', textContent: k }));
      kv.appendChild(Object.assign(document.createElement('div'), { textContent: String(v) }));
    });
    body.appendChild(kv);
  }

  const rel = S.edges.filter((e) => e.from === id || e.to === id);
  if (rel.length) {
    body.appendChild(Object.assign(document.createElement('h4'), { textContent: '关联' }));
    rel.forEach((e) => {
      const other = S.nodes.find((x) => x.id === (e.from === id ? e.to : e.from));
      if (!other) return;
      const kt = { derived: '属于', supersedes: '取代', relates: '相关', attach: '证据', uses: '被引用' }[e.kind] || e.kind;
      const line = document.createElement('div');
      line.className = 'rel';
      line.innerHTML = `<span class="k">${kt}</span>${other.title}`;
      line.onclick = () => { select(other.id); const d = byId.get(other.id); if (d) flyTo(d.x, d.y, Math.max(cam.k, 1.1)); };
      body.appendChild(line);
    });
  }

  $('#panel').classList.remove('hidden');
  draw();
}

/* ---------- 搜索 ---------- */
async function doSearch(q) {
  const hint = $('#search-hint');
  if (!q.trim()) { hint.classList.remove('on'); setFocus(null); draw(); return; }
  const r = await window.api.search({ q });
  focus = new Set(r.hits.map((h) => h.id));
  r.neighbors.forEach((id) => focus.add(id));
  if (r.hits.length) {
    hint.innerHTML = r.hits.slice(0, 6).map((h) =>
      `<div data-id="${h.id}"><div class="t">${h.title}</div><div class="m">${typeName(h.type)} · ${projName(h.project)}</div></div>`).join('');
    hint.classList.add('on');
    hint.querySelectorAll('div[data-id]').forEach((el) => {
      el.onclick = () => {
        hint.classList.remove('on');
        const d = byId.get(el.dataset.id);
        if (d) { select(d.id); flyTo(d.x, d.y, Math.max(cam.k, 1.2)); }
      };
    });
    const first = byId.get(r.hits[0].id);
    if (first) flyTo(first.x, first.y, Math.max(cam.k, 1.1));
  } else {
    hint.innerHTML = '<div><div class="m">没有找到</div></div>';
    hint.classList.add('on');
  }
  draw();
}

/* ---------- 收进来 ---------- */
async function doCapture() {
  const text = $('#m-text').value.trim();
  if (!text) return toast('先粘点东西');
  const r = await window.api.capture({ text, date: $('#m-date').value || null });
  $('#modal').classList.add('hidden');
  S = await window.api.state();
  renderTabs(); rebuild();
  toast(`进来 ${r.items.length} 条，已挂上 ${r.items.filter((i) => i.committed).length} 条`);
}

boot();
