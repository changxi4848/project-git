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

  const pvc = document.getElementById('pv-close');
  if (pvc) pvc.onclick = closePreview;
  const pve = document.getElementById('pv-extern');
  if (pve) pve.onclick = () => { if (pvNode) window.api.openFileExtern({ nodeId: pvNode.id }); };
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
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    const b1 = document.createElement('button');
    b1.className = 'btn primary small'; b1.textContent = '在应用内打开';
    b1.onclick = () => openPreview(n);
    const b2 = document.createElement('button');
    b2.className = 'btn ghost small'; b2.textContent = '外部打开';
    b2.onclick = () => window.api.openFileExtern({ nodeId: n.id }).then((r) => { if (r && r.error) toast(r.error); });
    row.appendChild(b1); row.appendChild(b2);
    body.appendChild(row);
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


/* ================= 应用内预览 ================= */
let pvNode = null;

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function sanitize(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
             .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
             .replace(/javascript:/gi, '');
}

async function openPreview(n) {
  pvNode = n;
  const r = await window.api.preview({ nodeId: n.id });
  const box = document.getElementById('pv-body');
  const nameEl = document.getElementById('pv-name');
  const pv = document.getElementById('preview');
  pv.classList.remove('hidden');
  nameEl.textContent = r.name || n.title;
  box.innerHTML = '';
  if (r.error) { box.innerHTML = '<div class="summary">' + esc(r.error) + '</div>'; return; }

  if (r.kind === 'image') {
    const img = document.createElement('img');
    img.src = r.dataUrl;
    box.appendChild(img);
    if (r.rect) {
      img.onload = () => {
        const box2 = document.createElement('div');
        box2.style.position = 'relative';
        box2.style.display = 'inline-block';
        img.parentNode.replaceChild(box2, img);
        const img2 = document.createElement('img'); img2.src = r.dataUrl;
        box2.appendChild(img2);
        const [x0, y0, x1, y1] = r.rect;
        const hl = document.createElement('div'); hl.className = 'pdfhl';
        hl.style.left = (x0 / img2.naturalWidth * 100) + '%';
        hl.style.top = (y0 / img2.naturalHeight * 100) + '%';
        hl.style.width = ((x1 - x0) / img2.naturalWidth * 100) + '%';
        hl.style.height = ((y1 - y0) / img2.naturalHeight * 100) + '%';
        box2.appendChild(hl);
      };
    }
    return;
  }

  if (r.kind === 'pdf') {
    // PDF 直接内嵌渲染在当前 Electron 版本里会顶掉整个窗口，先降级
    const tip = document.createElement('div');
    tip.className = 'summary';
    tip.textContent = 'PDF 暂不支持应用内预览（下一版接 pdf.js 独立视图）。可以先用「外部打开」。';
    box.appendChild(tip);
    const b = document.createElement('button');
    b.className = 'btn primary small'; b.textContent = '外部打开';
    b.style.marginTop = '10px';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id });
    box.appendChild(b);
    return;
  }

  if (r.kind === 'markdown') {
    const html = sanitize(marked.parse(r.text || ''));
    const wrap = document.createElement('div');
    wrap.className = 'md';
    wrap.innerHTML = html;
    if (r.excerpt) highlightInDom(wrap, r.excerpt);
    box.appendChild(wrap);
    if (r.excerpt) scrollToMark(box);
    return;
  }

  if (r.kind === 'code') {
    box.appendChild(buildCode(r.text || '', r.start, r.end));
    scrollToMark(box);
    return;
  }

  // text
  const pre = document.createElement('div');
  pre.className = 'plain';
  const t = r.text || '';
  if (r.start != null && r.end != null && r.start >= 0) {
    pre.innerHTML = esc(t.slice(0, r.start)) + '<mark>' + esc(t.slice(r.start, r.end)) + '</mark>' + esc(t.slice(r.end));
  } else {
    pre.textContent = t;
  }
  box.appendChild(pre);
  if (r.start != null) scrollToMark(box);
}

function buildCode(text, start, end) {
  const wrap = document.createElement('div');
  wrap.className = 'codewrap';
  const lines = text.split('\n');
  const ln = document.createElement('div'); ln.className = 'ln';
  const code = document.createElement('div'); code.className = 'code';
  let acc = 0, hiFrom = -1, hiTo = -1, offset = 0;
  const marks = [];
  if (start != null && end != null && start >= 0) { hiFrom = start; hiTo = end; }
  const parts = [];
  lines.forEach((line, i) => {
    const lineStart = offset, lineEnd = offset + line.length;
    offset = lineEnd + 1;
    if (hiFrom >= 0 && hiFrom < lineEnd && hiTo > lineStart) {
      const a = Math.max(0, hiFrom - lineStart), b = Math.min(line.length, hiTo - lineStart);
      parts.push({ html: esc(line.slice(0, a)) + '<mark>' + esc(line.slice(a, b)) + '</mark>' + esc(line.slice(b)), hit: true });
    } else {
      parts.push({ html: esc(line), hit: false });
    }
  });
  ln.innerHTML = parts.map((_, i) => String(i + 1)).join('<br>');
  code.innerHTML = parts.map((p) => p.html || '&nbsp;').join('\n');
  wrap.appendChild(ln); wrap.appendChild(code);
  return wrap;
}

function highlightInDom(root, needle) {
  const key = String(needle).slice(0, 30);
  if (!key) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const i = node.nodeValue.indexOf(key);
    if (i >= 0) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, Math.min(node.nodeValue.length, i + key.length));
      const mark = document.createElement('mark');
      try { range.surroundContents(mark); } catch (e) {}
      return;
    }
  }
}

function scrollToMark(box) {
  const m = box.querySelector('mark');
  if (m) setTimeout(() => m.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
}

async function renderPdf(r, box) {
  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
    const bin = atob(r.dataUrl.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const doc2 = await pdfjsLib.getDocument({ data: buf }).promise;
    const state = { page: Math.min(Math.max(1, r.page || 1), doc2.numPages) };

    const nav = document.createElement('div');
    nav.className = 'pagenav';
    const prev = document.createElement('button'); prev.className = 'btn ghost small'; prev.textContent = '上一页';
    const next = document.createElement('button'); next.className = 'btn ghost small'; next.textContent = '下一页';
    const info = document.createElement('span');
    nav.appendChild(prev); nav.appendChild(info); nav.appendChild(next);

    const wrap = document.createElement('div'); wrap.className = 'pdfwrap';
    box.appendChild(wrap); box.appendChild(nav);

    async function paint() {
      info.textContent = state.page + ' / ' + doc2.numPages;
      const page = await doc2.getPage(state.page);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      wrap.innerHTML = '';
      wrap.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (r.rect && state.page === (r.page || 1)) {
        const [x0, y0, x1, y1] = r.rect;
        const s = viewport.scale;
        const hl = document.createElement('div'); hl.className = 'pdfhl';
        hl.style.left = (x0 * s) + 'px';
        hl.style.top = (y0 * s) + 'px';
        hl.style.width = ((x1 - x0) * s) + 'px';
        hl.style.height = ((y1 - y0) * s) + 'px';
        wrap.appendChild(hl);
        hl.scrollIntoView({ block: 'center' });
      }
    }
    prev.onclick = () => { if (state.page > 1) { state.page--; paint(); } };
    next.onclick = () => { if (state.page < doc2.numPages) { state.page++; paint(); } };
    await paint();
  } catch (e) {
    box.innerHTML = '<div class="summary">PDF 预览失败：' + esc(e.message) + '</div>';
  }
}

function closePreview() {
  document.getElementById('preview').classList.add('hidden');
  pvNode = null;
}

boot();
