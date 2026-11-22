'use strict';
/* 项目Git · 向右生长的时间树
   横轴 = 时间，纵轴 = 层级；核心节点在主干上，附属节点在各自的时间片里向右生长。
*/

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR = {
  plan: '#5aa9d6', decision: '#e06c62', retro: '#9b8ad4',
  doc: '#b08d6a', data: '#4fb3a6', code: '#7f92ab', output: '#d6a04a',
};
const R_CORE = { decision: 9.5, output: 9, plan: 8, retro: 8 };
const R_LEAF = 5.2;

let S = { projects: [], types: [], nodes: [], edges: [] };
let ns = [], ls = [], byId = new Map();
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, selected = null, hovered = null, focus = null;
let dragNode = null, panning = null, movedFar = false, anim = null;

const typeName = (id) => (S.types.find((t) => t.id === id) || { name: id }).name;
const projName = (id) => (S.projects.find((p) => p.id === id) || { name: id }).name;
const colOf = (n) => COLOR[n.type] || '#8d959f';
const msOf = (s) => { const t = Date.parse((s || '').length <= 7 ? s + '-01' : (s || '').replace('T', ' ')); return isNaN(t) ? 0 : t; };

function toast(t, ms = 1800) {
  const e = $('#toast'); e.textContent = t; e.classList.remove('hidden');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('hidden'), ms);
}

async function boot() {
  canvas = $('#c'); ctx = canvas.getContext('2d');
  bindUI();
  S = await window.api.state();
  const first = S.projects.find((p) => S.nodes.some((n) => n.project === p.id && n.status !== 'deleted'));
  curProject = (S.projects.find((p) => p.id === 'p_pricing') || first || S.projects[0] || {}).id;
  renderTabs(); resize(); rebuild();
  window.addEventListener('resize', () => { resize(); draw(); });
}

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  S.projects.forEach((p) => {
    if (!S.nodes.some((x) => x.project === p.id && x.status !== 'deleted')) return;
    const b = document.createElement('button');
    b.className = 'tab' + (p.id === curProject ? ' on' : '');
    b.textContent = p.name;
    b.onclick = () => { curProject = p.id; selected = null; $('#panel').classList.add('hidden'); renderTabs(); rebuild(); };
    box.appendChild(b);
  });
}

/* ---------------- 布局：时间树 ---------------- */
const PX_PER_DAY = 12;      // 时间 → 像素
const MIN_CORE_GAP = 300;   // 核心之间最小间距
const SLOT = 190;           // 附属节点横向槽距
const ROW_H = 96;           // 层高

function rebuild() {
  const vn = S.nodes.filter((n) => n.status !== 'deleted' && n.project === curProject);
  const deg = new Map();
  S.edges.forEach((e) => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });
  const byNid = new Map(vn.map((n) => [n.id, n]));

  // 1) 核心 = 决策 / 产出 / 度数≥3
  const isCore = (n) => n.status !== 'abandoned' && (n.type === 'decision' || n.type === 'output' || (deg.get(n.id) || 0) >= 3);
  let cores = vn.filter(isCore).sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
  if (!cores.length && vn.length) cores = [vn.slice().sort((a, b) => msOf(a.content_at) - msOf(b.content_at))[0]];
  const coreSet = new Set(cores.map((n) => n.id));

  // 2) 主干 x：时间映射 + 最小间距
  const t0 = Math.min(...cores.map((n) => msOf(n.content_at)));
  let prevX = 0;
  const coreX = new Map();
  cores.forEach((n) => {
    const tx = ((msOf(n.content_at) - t0) / 86400000) * PX_PER_DAY;
    const x = Math.max(prevX + (prevX === 0 ? 0 : MIN_CORE_GAP), tx);
    coreX.set(n.id, x);
    prevX = x;
  });

  ns = [];
  cores.forEach((n) => {
    ns.push({ id: n.id, n, core: true, r: R_CORE[n.type] || 8, x: coreX.get(n.id), y: 0, hx: coreX.get(n.id), hy: 0 });
  });

  // 3) 附属归属：沿 parent 找最近的核心；找不到就按时间找最近的前一个核心
  const parentOf = (n) => (n.parent && byNid.get(n.parent)) || null;
  const ownerOf = (n) => {
    let p = parentOf(n), guard = 0;
    while (p && guard++ < 30) { if (coreSet.has(p.id)) return p.id; p = parentOf(p); }
    const t = msOf(n.content_at);
    let best = cores[0], bd = Infinity;
    cores.forEach((c) => { const d = Math.abs(msOf(c.content_at) - t); if (d < bd) { bd = d; best = c; } });
    return best ? best.id : null;
  };

  const leavesByCore = new Map();
  vn.filter((n) => !coreSet.has(n.id)).forEach((n) => {
    const oid = ownerOf(n);
    if (!oid) return;
    if (!leavesByCore.has(oid)) leavesByCore.set(oid, []);
    leavesByCore.get(oid).push(n);
  });

  // 4) 每个核心的时间片里，附属按自身时间排布，满了换行
  cores.forEach((c, ci) => {
    const cx = coreX.get(c.id);
    const nextX = ci + 1 < cores.length ? coreX.get(cores[ci + 1].id) : cx + MIN_CORE_GAP * 1.4;
    const slice = Math.max(SLOT, nextX - cx);
    const perRow = Math.max(1, Math.floor((slice - 40) / SLOT));
    const list = (leavesByCore.get(c.id) || []).sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
    list.forEach((n, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const cnt = Math.min(perRow, list.length - row * perRow);
      const step = Math.min(SLOT, (slice - 40) / Math.max(1, cnt));
      const x = cx + 46 + col * step + (cnt === 1 ? step / 2 : 0);
      const y = ROW_H + row * ROW_H;
      ns.push({ id: n.id, n, core: false, r: R_LEAF, x, y, hx: x, hy: y, owner: c.id });
    });
  });

  byId = new Map(ns.map((d) => [d.id, d]));
  ls = S.edges
    .filter((e) => e.kind !== 'uses' && byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  // 垂直居中
  const ys = ns.map((d) => d.y);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  ns.forEach((d) => { d.y -= midY; d.hy = d.y; });

  draw(); fit();
}

/* ---------------- 相机 ---------------- */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
}
function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

function fit() {
  if (!ns.length) return;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const padX = 120, padTop = 110, padBottom = 120;
  const minX = Math.min(...xs) - padX, maxX = Math.max(...xs) + padX + 180; // 右侧给标签留量
  const minY = Math.min(...ys) - padTop, maxY = Math.max(...ys) + padBottom;
  const k = clamp(Math.min(W / (maxX - minX), (H - 44) / (maxY - minY)), 0.2, 1.3);
  cam.k = k;
  cam.x = W / 2 - ((minX + maxX) / 2) * k;
  cam.y = 44 + (H - 44) / 2 - ((minY + maxY) / 2) * k;
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

/* ---------------- 画 ---------------- */
function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a1a1c';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  // 主干：一条淡横线
  const cores = ns.filter((d) => d.core).sort((a, b) => a.x - b.x);
  if (cores.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1.2 / cam.k;
    ctx.beginPath();
    ctx.moveTo(cores[0].x - 20, 0);
    ctx.lineTo(cores[cores.length - 1].x + 20, 0);
    ctx.stroke();
  }

  // 连线
  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const sup = l.kind === 'supersedes';
    ctx.globalAlpha = on ? 1 : 0.12;
    ctx.strokeStyle = sup ? 'rgba(224,108,98,.6)' : 'rgba(255,255,255,.10)';
    ctx.lineWidth = (sup ? 1.5 : 0.9) / cam.k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // 节点
  ns.forEach((d) => {
    const on = !focus || focus.has(d.id);
    const col = (d.n.status === 'superseded' || d.n.status === 'abandoned') ? '#4a4d54' : colOf(d.n);
    ctx.globalAlpha = on ? 1 : 0.15;
    if (selected === d.id) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5 / cam.k, 0, 7);
      ctx.fillStyle = col + '33'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    if (hovered === d.id || selected === d.id) {
      ctx.lineWidth = 1.2 / cam.k; ctx.strokeStyle = '#f5f6f8'; ctx.stroke();
    }
  });
  ctx.restore();

  // 标签：全部常显，贴右侧；核心更亮更大
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ns.forEach((d) => {
    const on = !focus || focus.has(d.id);
    const isHot = hovered === d.id || selected === d.id;
    const [sx, sy] = [d.x * cam.k + cam.x, d.y * cam.k + cam.y];
    if (sx < -260 || sx > W + 260 || sy < 30 || sy > H + 40) return;
    const base = d.core ? 12.5 : 11;
    const fs = (isHot ? base + 1 : base) * clamp(cam.k, 0.55, 1.15);
    ctx.globalAlpha = on ? 1 : 0.15;
    ctx.font = `${d.core ? 600 : 400} ${fs}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = isHot ? '#ffffff' : (d.core ? '#d3d6dc' : '#8f949d');
    const max = d.core ? 22 : 16;
    const title = d.n.title.length > max ? d.n.title.slice(0, max) + '…' : d.n.title;
    ctx.fillText(title, sx + d.r * cam.k + 7, sy);
  });
  ctx.globalAlpha = 1;
}

/* ---------------- 交互 ---------------- */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = ns.length - 1; i >= 0; i--) {
    const d = ns[i];
    if ((wx - d.x) ** 2 + (wy - d.y) ** 2 <= (d.r + 7) ** 2) return d;
  }
  return null;
}

function setFocus(id) {
  if (!id) { focus = null; return; }
  const set = new Set([id]);
  S.edges.forEach((e) => { if (e.from === id) set.add(e.to); else if (e.to === id) set.add(e.from); });
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
    if (d) { dragNode = { d, sx: e.offsetX, sy: e.offsetY }; return; }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
  });

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }
    if (dragNode) {
      if (Math.hypot(sx - dragNode.sx, sy - dragNode.sy) > 3) movedFar = true;
      const [wx, wy] = toWorld(sx, sy);
      dragNode.d.x = wx; dragNode.d.y = wy;
      draw(); return;
    }
    const d = pick(sx, sy);
    const id = d ? d.id : null;
    if (id !== hovered) { hovered = id; setFocus(id || selected); draw(); }
  });

  window.addEventListener('mouseup', () => {
    if (dragNode) {
      const d = dragNode.d;
      if (!movedFar) select(d.id);
      else { d.hx = d.x; d.hy = d.y; }
      dragNode = null;
    }
    panning = null;
  });

  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) flyTo(d.x, d.y, Math.max(1.3, cam.k * 1.4));
  });

  $('#btn-capture').onclick = () => { $('#modal').classList.remove('hidden'); $('#m-date').valueAsDate = new Date(); $('#m-text').focus(); };
  $('#m-go').onclick = doCapture;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $('#modal').classList.add('hidden'); });

  $('#search').addEventListener('input', (e) => { clearTimeout(window._st); window._st = setTimeout(() => doSearch(e.target.value), 200); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; setFocus(null); $('#search-hint').classList.remove('on'); draw(); } });
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { selected = null; focus = null; $('#panel').classList.add('hidden'); draw(); }
    if (e.key === 'f' || e.key === 'F') fit();
    if (e.key === 'r' || e.key === 'R') { ns.forEach((d) => { d.x = d.hx; d.y = d.hy; }); draw(); }
  });
}

/* ---------------- 详情 ---------------- */
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
    box.innerHTML = `<div class="src-file">${src.file}</div>${locTxt ? `<div class="src-loc">${locTxt}</div>` : ''}<div class="src-ex"></div>`;
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

/* ---------------- 搜索 ---------------- */
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
      el.onclick = () => { hint.classList.remove('on'); const d = byId.get(el.dataset.id); if (d) { select(d.id); flyTo(d.x, d.y, Math.max(cam.k, 1.2)); } };
    });
    const first = byId.get(r.hits[0].id);
    if (first) flyTo(first.x, first.y, Math.max(cam.k, 1.1));
  } else { hint.innerHTML = '<div><div class="m">没有找到</div></div>'; hint.classList.add('on'); }
  draw();
}

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
