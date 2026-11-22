'use strict';
/* 项目Git · 提交图（按设计稿 design-C）
   主干 = 决策链；分叉 = 一次尝试；× = 终止；汇合 = 合并；tag = 里程碑；虚线框 = 材料
*/

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR = {
  decision: '#D9534F', output: '#C08A3E', plan: '#3F8FC4', retro: '#7C6BC4',
  doc: '#A1785A', data: '#3F9D94', code: '#5F7590',
};
const GREY = '#B9C2CB';
const TYPE_NAME = { decision: '决策', output: '产出', plan: '方案', retro: '复盘', doc: '资料', data: '数据', code: '代码' };

let S = { projects: [], types: [], nodes: [], edges: [] };
let ns = [], ls = [], byId = new Map();
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, selected = null, hovered = null, focus = null;
let dragNode = null, panning = null, movedFar = false, anim = null, pvNode = null;

const msOf = (s) => { const t = Date.parse((s || '').length <= 7 ? s + '-01' : (s || '').replace('T', ' ')); return isNaN(t) ? 0 : t; };
const typeName = (id) => (S.types.find((t) => t.id === id) || { name: TYPE_NAME[id] || id }).name;

function toast(t, ms = 1800) {
  const e = $('#toast'); e.textContent = t; e.classList.remove('hidden');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('hidden'), ms);
}

/* ================= 启动 ================= */
async function boot() {
  canvas = $('#c'); ctx = canvas.getContext('2d');
  bindUI();
  S = await window.api.state();
  const first = S.projects.find((p) => S.nodes.some((n) => n.project === p.id && n.status !== 'deleted'));
  curProject = (S.projects.find((p) => p.id === 'p_relay') || first || S.projects[0] || {}).id;
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
    b.onclick = () => { curProject = p.id; selected = null; hidePanel(); renderTabs(); rebuild(); };
    box.appendChild(b);
  });
}

/* ================= 布局 ================= */
const X_GAP = 300;      // 主干提交间距
const BR_GAP = 210;     // 分支提交间距
const LANE_H = 150;     // 分支泳道高
const BOX_TOP = 120;    // 材料框距主干

function rebuild() {
  const vn = S.nodes.filter((n) => n.status !== 'deleted' && n.project === curProject);
  const byNid = new Map(vn.map((n) => [n.id, n]));
  const TRUNK = new Set(['decision', 'output']);

  // 1) 主干
  const trunk = vn.filter((n) => (TRUNK.has(n.type) || (n.type === 'plan' && !n.parent)) && (n.branch || 'main') === 'main')
    .sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
  const trunkSet = new Set(trunk.map((n) => n.id));

  // 2) 分支（显式 branch）
  const branches = new Map();
  vn.forEach((n) => {
    const b = n.branch || 'main';
    if (b === 'main') return;
    if (!branches.has(b)) branches.set(b, []);
    branches.get(b).push(n);
  });

  ns = [];
  // 主干坐标
  trunk.forEach((n, i) => {
    ns.push({ id: n.id, n, kind: 'commit', x: i * X_GAP, y: 0, r: n.type === 'output' ? 11 : 12 });
  });
  const tx = new Map(trunk.map((n, i) => [n.id, i * X_GAP]));

  // 分支坐标（全部向上，多分支依次加高）
  let lane = 1;
  const branchInfo = [];
  [...branches.entries()].forEach(([name, list]) => {
    const sorted = list.slice().sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
    const pnode = byNid.get(sorted[0].parent);
    const startX = (pnode && tx.has(pnode.id)) ? tx.get(pnode.id) : 0;
    const y = -lane * LANE_H;
    sorted.forEach((n, i) => {
      ns.push({ id: n.id, n, kind: 'branch', x: startX + 90 + i * BR_GAP, y, r: 10 });
    });
    const last = sorted[sorted.length - 1];
    branchInfo.push({ name, startX, y, list: sorted, endX: startX + 90 + (sorted.length - 1) * BR_GAP, last });
    lane++;
  });

  // 3) 材料：doc/data/code/plan/retro 挂到最近的祖先主干
  const materialTypes = new Set(['doc', 'data', 'code', 'plan', 'retro']);
  const mats = new Map();
  vn.forEach((n) => {
    if (!materialTypes.has(n.type)) return;
    if (trunkSet.has(n.id)) return;   // 主干节点不能挂成自己的材料
    if (branches.size && [...branches.values()].some((l) => l.includes(n))) return;
    let p = byNid.get(n.parent), guard = 0, owner = null;
    while (p && guard++ < 20) { if (trunkSet.has(p.id)) { owner = p.id; break; } p = byNid.get(p.parent); }
    if (!owner) {
      const t = msOf(n.content_at);
      let best = null, bd = Infinity;
      trunk.forEach((c) => { const d = Math.abs(msOf(c.content_at) - t); if (d < bd) { bd = d; best = c; } });
      owner = best && best.id;
    }
    if (!owner) return;
    if (!mats.has(owner)) mats.set(owner, []);
    mats.get(owner).push(n);
  });

  // 材料框排布（每个主干下最多 3 条，超出显示 +N）
  const boxes = [];
  const ROW = 44;
  mats.forEach((list, ownerId) => {
    const cx = tx.get(ownerId);
    const show = list.slice(0, 3);
    const h = ROW * show.length + (list.length > show.length ? 36 : 18);
    boxes.push({ ownerId, cx, y: BOX_TOP, h, w: 196, items: show, more: list.length - show.length });
    show.forEach((n, i) => {
      ns.push({ id: n.id, n, kind: 'material', x: cx - 72, y: BOX_TOP + 26 + i * ROW, r: 6 });
    });
  });

  byId = new Map(ns.map((d) => [d.id, d]));
  L = { trunk, branchInfo, boxes, tx };
  draw(); fit();
}

let L = { trunk: [], branchInfo: [], boxes: [], tx: new Map() };

/* ================= 相机 ================= */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
}
function fit() {
  if (!ns.length) return;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const minX = Math.min(...xs) - 140, maxX = Math.max(...xs) + 260;
  const minY = Math.min(...ys) - 90, maxY = Math.max(...ys) + 210;
  const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.25, 1.5);
  cam.k = k;
  cam.x = W / 2 - ((minX + maxX) / 2) * k;
  cam.y = H / 2 - ((minY + maxY) / 2) * k;
  draw();
}
function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

/* ================= 绘制 ================= */
function icon(kind, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'decision') {
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'output') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i - Math.PI / 2;
      const rr = i % 2 === 0 ? s : s * 0.45;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'doc') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8, y + s); ctx.lineTo(x + s * 0.25, y + s);
    ctx.lineTo(x + s * 0.8, y + s * 0.35); ctx.lineTo(x + s * 0.8, y - s);
    ctx.lineTo(x - s * 0.8, y - s); ctx.closePath(); ctx.fill();
  } else if (kind === 'data') {
    ctx.beginPath(); ctx.ellipse(x, y - s * 0.55, s * 0.75, s * 0.28, 0, 0, 7); ctx.fill();
    ctx.fillRect(x - s * 0.75, y - s * 0.6, s * 1.5, s * 1.15);
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.55, s * 0.75, s * 0.28, 0, 0, 7); ctx.fill();
  } else if (kind === 'code') {
    ctx.lineWidth = s * 0.3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.25, y - s * 0.5); ctx.lineTo(x - s * 0.7, y); ctx.lineTo(x - s * 0.25, y + s * 0.5);
    ctx.moveTo(x + s * 0.25, y - s * 0.5); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x + s * 0.25, y + s * 0.5);
    ctx.stroke();
  } else if (kind === 'retro') {
    ctx.lineWidth = s * 0.28; ctx.beginPath();
    ctx.arc(x, y, s * 0.7, 0.7, 5.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.62, y - s * 0.5); ctx.lineTo(x + s * 0.9, y - s * 0.05);
    ctx.lineTo(x + s * 0.4, y - s * 0.02); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  const trunk = L.trunk || [];

  // 主干底带
  if (trunk.length > 1) {
    const x0 = trunk[0] ? L.tx.get(trunk[0].id) : 0;
    const x1 = L.tx.get(trunk[trunk.length - 1].id);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(x0 - 90, -92, (x1 - x0) + 180, 188);
  }

  // 主干线 + 叙事
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = L.tx.get(trunk[i].id), b = L.tx.get(trunk[i + 1].id);
    ctx.strokeStyle = '#B9C6D3'; ctx.lineWidth = 2 / cam.k;
    ctx.beginPath(); ctx.moveTo(a + 18, 0); ctx.lineTo(b - 18, 0); ctx.stroke();
    const nxt = trunk[i + 1];
    const label = (nxt.extra && nxt.extra['理由']) || '';
    if (label) {
      const t = label.length > 12 ? label.slice(0, 12) + '…' : label;
      ctx.save();
      ctx.font = `${10.5 / cam.k}px "Microsoft YaHei",sans-serif`;
      const w = ctx.measureText(t).width + 10 / cam.k;
      ctx.fillStyle = '#fff';
      ctx.fillRect((a + b) / 2 - w / 2, -16 / cam.k, w, 16 / cam.k);
      ctx.fillStyle = '#6B7A88'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t, (a + b) / 2, -8 / cam.k);
      ctx.restore();
    }
  }

  // 分支线
  (L.branchInfo || []).forEach((b) => {
    const from = b.startX;
    ctx.strokeStyle = '#A8B4C0'; ctx.lineWidth = 1.7 / cam.k;
    ctx.beginPath();
    ctx.moveTo(from, -14); ctx.lineTo(from + 60, b.y); ctx.lineTo(b.endX, b.y);
    ctx.stroke();
    if (b.last.status === 'abandoned') {
      ctx.strokeStyle = '#C3CBD5'; ctx.setLineDash([4 / cam.k, 4 / cam.k]);
      ctx.beginPath(); ctx.moveTo(b.endX + 12, b.y); ctx.lineTo(b.endX + 48, b.y); ctx.stroke();
      ctx.setLineDash([]);
      const x = b.endX + 52, s = 5 / cam.k;
      ctx.strokeStyle = '#AEB8C4'; ctx.lineWidth = 1.8 / cam.k;
      ctx.beginPath();
      ctx.moveTo(x - s, b.y - s); ctx.lineTo(x + s, b.y + s);
      ctx.moveTo(x + s, b.y - s); ctx.lineTo(x - s, b.y + s);
      ctx.stroke();
      ctx.save(); ctx.font = `${10 / cam.k}px "Microsoft YaHei",sans-serif`;
      ctx.fillStyle = '#98A5B1'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('尝试终止', x + 10 / cam.k, b.y);
      ctx.restore();
    }
  });

  // 合并：主干节点有两个父 → 从分支末点斜下汇入
  trunk.forEach((n) => {
    const ps = (n.parents && n.parents.length) ? n.parents : (n.parent ? [n.parent] : []);
    if (ps.length < 2) return;
    const info = (L.branchInfo || []).find((b) => ps.includes(b.last.id));
    if (!info) return;
    const x = L.tx.get(n.id);
    ctx.strokeStyle = '#9DB4C7'; ctx.lineWidth = 1.7 / cam.k;
    ctx.beginPath();
    ctx.moveTo(info.endX, info.y); ctx.lineTo(x - 60, info.y); ctx.lineTo(x - 14, 0);
    ctx.stroke();
  });

  // 材料虚线框
  (L.boxes || []).forEach((bx) => {
    const x = bx.cx - bx.w / 2;
    ctx.strokeStyle = '#E2E8EE'; ctx.lineWidth = 1.2 / cam.k;
    ctx.setLineDash([5 / cam.k, 4 / cam.k]);
    ctx.beginPath();
    ctx.roundRect(x, bx.y, bx.w, bx.h, 8 / cam.k);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(bx.cx, 22); ctx.lineTo(bx.cx, bx.y); ctx.stroke();
    if (bx.more > 0) {
      ctx.fillStyle = '#98A5B1'; ctx.font = `${10 / cam.k}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + bx.more + ' 项', x + 12, bx.y + bx.h - 14 / cam.k);
    }
  });

  ctx.restore();

  // 节点（屏幕空间画标签，形状在世界里画）
  ctx.save();
  ctx.translate(cam.x, cam.y); ctx.scale(cam.k, cam.k);
  ns.forEach((d) => {
    if (d.kind === 'material') {
      const mc = COLOR[d.n.type] || '#8A97A5';
      ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, 7); ctx.fillStyle = mc; ctx.fill();
      icon(d.n.type, d.x, d.y, 3.6, '#fff');
      return;
    }
    const dead = d.n.status === 'abandoned' || d.n.status === 'superseded';
    const col = dead ? GREY : (COLOR[d.n.type] || '#8A97A5');
    const hot = hovered === d.id || selected === d.id;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = (hot ? 2 : 1.6) / cam.k; ctx.strokeStyle = '#fff'; ctx.stroke();
    icon(d.n.type, d.x, d.y, d.r * 0.58, '#fff');
    if (d.n.tag) {
      const tw = 78 / cam.k, th = 18 / cam.k;
      ctx.fillStyle = '#FFF7E8'; ctx.strokeStyle = '#E0B96B'; ctx.lineWidth = 1 / cam.k;
      ctx.beginPath(); ctx.roundRect(d.x + 14 / cam.k, d.y - 40 / cam.k, tw, th, 3 / cam.k);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#A5751E'; ctx.font = `${9.5 / cam.k}px Consolas,monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('tag ' + d.n.tag, d.x + 14 / cam.k + tw / 2, d.y - 40 / cam.k + th / 2);
    }
  });
  ctx.restore();

  // 标签（屏幕空间）
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ns.forEach((d) => {
    const [sx, sy] = [d.x * cam.k + cam.x, d.y * cam.k + cam.y];
    if (sx < -200 || sx > W + 200 || sy < 0 || sy > H + 60) return;
    const on = !focus || focus.has(d.id);
    const dead = d.n.status === 'abandoned' || d.n.status === 'superseded';
    if (d.kind === 'material') {
      ctx.globalAlpha = on ? 1 : 0.2;
      ctx.textAlign = 'left';
      ctx.font = '11px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText(d.n.title.length > 13 ? d.n.title.slice(0, 13) + '…' : d.n.title, sx + 12, sy - 13);
      ctx.font = '9.5px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#98A5B1';
      ctx.fillText(`${TYPE_NAME[d.n.type] || ''} · ${d.n.content_at.slice(5)}`, sx + 12, sy + 2);
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = on ? 1 : 0.25;
    const main = d.kind === 'commit';
    ctx.font = `${main ? 600 : 400} ${main ? 12.5 : 11.5}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = dead ? '#9AA5B1' : '#1F2933';
    const t = d.n.title.length > (main ? 16 : 14) ? d.n.title.slice(0, main ? 16 : 14) + '…' : d.n.title;
    ctx.fillText(t, sx, sy + d.r * cam.k + 10);
    ctx.font = `${main ? 10 : 9.5}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#8A97A5';
    const sub = `${TYPE_NAME[d.n.type] || ''} · ${d.n.content_at}${d.n.status === 'abandoned' ? ' · 已放弃' : ''}`;
    ctx.fillText(sub, sx, sy + d.r * cam.k + 26);
    ctx.globalAlpha = 1;
  });
}

/* ================= 交互 ================= */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = ns.length - 1; i >= 0; i--) {
    const d = ns[i];
    const rr = d.kind === 'material' ? 9 : d.r + 6;
    if ((wx - d.x) ** 2 + (wy - d.y) ** 2 <= rr ** 2) return d;
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
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0015), 0.2, 3);
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
    if (dragNode) { if (!movedFar) select(dragNode.d.id); dragNode = null; }
    panning = null;
  });
  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) { cam.k = Math.min(2, cam.k * 1.5); cam.x = W / 2 - d.x * cam.k; cam.y = H / 2 - d.y * cam.k; draw(); }
  });

  $('#btn-capture').onclick = () => { $('#modal').classList.remove('hidden'); $('#m-date').valueAsDate = new Date(); $('#m-text').focus(); };
  $('#m-go').onclick = doCapture;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $('#modal').classList.add('hidden'); });

  const pvc = document.getElementById('pv-close');
  if (pvc) pvc.onclick = closePreview;
  const pve = document.getElementById('pv-extern');
  if (pve) pve.onclick = () => { if (pvNode) window.api.openFileExtern({ nodeId: pvNode.id }); };
  const pc = document.getElementById('p-close');
  if (pc) pc.onclick = hidePanel;

  $('#search').addEventListener('input', (e) => { clearTimeout(window._st); window._st = setTimeout(() => doSearch(e.target.value), 200); });
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; setFocus(null); $('#search-hint').classList.remove('on'); draw(); } });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'Escape') { hidePanel(); closePreview(); }
    if (e.key === 'f' || e.key === 'F') fit();
  });
}

function hidePanel() {
  $('#panel').classList.add('hidden');
  selected = null; focus = null; draw();
}

function select(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  selected = id; setFocus(id); draw();
  $('#p-title').textContent = n.title;
  $('#p-meta').textContent = `${typeName(n.type)} · ${n.content_at}${n.tag ? ' · tag ' + n.tag : ''}`;
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
    row.appendChild(b1); row.appendChild(b2); body.appendChild(row);
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
      line.onclick = () => select(other.id);
      body.appendChild(line);
    });
  }
  $('#panel').classList.remove('hidden');
}

/* ================= 检索 ================= */
async function doSearch(q) {
  const hint = $('#search-hint');
  if (!q.trim()) { hint.classList.remove('on'); setFocus(null); draw(); return; }
  const r = await window.api.search({ q });
  focus = new Set(r.hits.map((h) => h.id));
  r.neighbors.forEach((id) => focus.add(id));
  if (r.hits.length) {
    hint.innerHTML = r.hits.slice(0, 6).map((h) =>
      `<div data-id="${h.id}"><div class="t">${h.title}</div><div class="m">${TYPE_NAME[h.type] || h.type}</div></div>`).join('');
    hint.classList.add('on');
    hint.querySelectorAll('div[data-id]').forEach((el) => {
      el.onclick = () => {
        hint.classList.remove('on');
        const d = byId.get(el.dataset.id);
        if (d) { select(d.id); cam.x = W / 2 - d.x * cam.k; cam.y = H / 2 - d.y * cam.k; draw(); }
      };
    });
  } else { hint.innerHTML = '<div><div class="m">没有找到</div></div>'; hint.classList.add('on'); }
  draw();
}

/* ================= 收进来 ================= */
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
function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function sanitize(h) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
          .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
          .replace(/javascript:/gi, '');
}

async function openPreview(n) {
  pvNode = n;
  const r = await window.api.preview({ nodeId: n.id });
  const box = $('#pv-body'), nameEl = $('#pv-name'), pv = $('#preview');
  pv.classList.remove('hidden');
  nameEl.textContent = r.name || n.title;
  box.innerHTML = '';
  if (r.error) { box.innerHTML = '<div class="summary">' + esc(r.error) + '</div>'; return; }

  if (r.kind === 'image') {
    const img = document.createElement('img'); img.src = r.dataUrl; box.appendChild(img); return;
  }
  if (r.kind === 'pdf') {
    const tip = document.createElement('div');
    tip.className = 'summary';
    tip.textContent = 'PDF 暂不支持应用内预览（下一版接独立 PDF 视图），先用「外部打开」。';
    box.appendChild(tip);
    const b = document.createElement('button');
    b.className = 'btn primary small'; b.style.marginTop = '10px'; b.textContent = '外部打开';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id });
    box.appendChild(b); return;
  }
  if (r.kind === 'markdown') {
    const wrap = document.createElement('div'); wrap.className = 'md';
    wrap.innerHTML = sanitize(marked.parse(r.text || ''));
    if (r.excerpt) highlightInDom(wrap, r.excerpt);
    box.appendChild(wrap);
    scrollToMark(box); return;
  }
  if (r.kind === 'code') { box.appendChild(buildCode(r.text || '', r.start, r.end)); scrollToMark(box); return; }
  const pre = document.createElement('div'); pre.className = 'plain';
  const t = r.text || '';
  if (r.start != null && r.end != null && r.start >= 0) {
    pre.innerHTML = esc(t.slice(0, r.start)) + '<mark>' + esc(t.slice(r.start, r.end)) + '</mark>' + esc(t.slice(r.end));
  } else pre.textContent = t;
  box.appendChild(pre); if (r.start != null) scrollToMark(box);
}

function buildCode(text, start, end) {
  const wrap = document.createElement('div'); wrap.className = 'codewrap';
  const lines = text.split('\n');
  const ln = document.createElement('div'); ln.className = 'ln';
  const code = document.createElement('div'); code.className = 'code';
  let offset = 0;
  const parts = lines.map((line) => {
    const s0 = offset, s1 = offset + line.length;
    offset = s1 + 1;
    if (start != null && end != null && start < s1 && end > s0) {
      const a = Math.max(0, start - s0), b = Math.min(line.length, end - s0);
      return esc(line.slice(0, a)) + '<mark>' + esc(line.slice(a, b)) + '</mark>' + esc(line.slice(b));
    }
    return esc(line);
  });
  ln.innerHTML = lines.map((_, i) => i + 1).join('<br>');
  code.innerHTML = parts.join('\n');
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
      range.setStart(node, i); range.setEnd(node, Math.min(node.nodeValue.length, i + key.length));
      const m = document.createElement('mark');
      try { range.surroundContents(m); } catch (e) {}
      return;
    }
  }
}
function scrollToMark(box) {
  const m = box.querySelector('mark');
  if (m) setTimeout(() => m.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
}
function closePreview() { $('#preview').classList.add('hidden'); pvNode = null; }

boot();
