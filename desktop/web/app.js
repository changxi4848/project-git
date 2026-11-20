window.onerror = function(m,s,l,c,e){ window.__err = (m+' @'+l+':'+c); };
'use strict';
/* 项目Git 桌面版 · 渲染层
   视觉参照 Obsidian 的关系图谱：暗色、圆点、细线、悬停聚焦、标签随缩放淡入
   布局用 d3 力导向，x 轴被时间牵引（保持“先后”的语义）
*/

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TYPE_COLOR = { plan: '#5aa9d6', decision: '#e06c62', asset: '#7fb069', retro: '#9b8ad4', version: '#8d9aa8' };
const KIND_STYLE = {
  derived: { color: 'rgba(255,255,255,0.10)', w: 1, dash: null },
  supersedes: { color: 'rgba(224,108,98,0.62)', w: 1.7, dash: null, arrow: true },
  relates: { color: 'rgba(255,255,255,0.055)', w: 1, dash: [3, 4] },
  attach: { color: 'rgba(122,180,214,0.20)', w: 1, dash: [2, 3] },
};

let S = { projects: [], types: [], nodes: [], edges: [], queue: [], choices: [], meta: {} };
let sim = null, ns = [], ls = [], byId = new Map();
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, mode = 'one';
let hovered = null, selected = null, active = null;   // active: Set of ids to focus
let edit = false, dragNode = null, panning = null, dragOver = null;
let anim = null, t0 = 0, t1 = 1;

const typeOf = (id) => S.types.find((t) => t.id === id) || { name: id, color: '#8d9aa8' };
const projOf = (id) => S.projects.find((p) => p.id === id) || { name: id, color: '#8d9aa8' };
const msOf = (s) => { const t = Date.parse((s || '').length <= 7 ? s + '-01' : (s || '').replace('T', ' ')); return isNaN(t) ? null : t; };
const dstr = (s) => (s || '').slice(5, 10);
const shortFile = (f) => f ? f.replace(/\.(md|txt|pdf|docx)$/i, '').slice(0, 14) : '粘贴';
const locText = (n) => {
  const l = n.source && n.source.locator; if (!l) return '';
  if (l.kind === 'pdf') return `第 ${l.page} 页`;
  if (l.kind === 'text' && l.start != null) return `字符 ${l.start}–${l.end}`;
  return '';
};

function toast(msg, t = 2400) {
  const e = $('#toast'); e.textContent = msg; e.classList.remove('hidden');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('hidden'), t);
}

/* ---------------- 数据 ---------------- */
async function loadState() {
  S = await window.api.state();
  renderTabs();
  $('#queue-count').textContent = S.queue.length;
  $('#stat-count').textContent = `${S.nodes.filter(n => n.status !== 'deleted').length} 个节点 · ${S.projects.length} 个项目`;
}

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  S.projects.forEach((p) => {
    const n = S.nodes.filter((x) => x.project === p.id && x.status !== 'deleted').length;
    const b = el('button', 'tab' + (p.id === curProject && mode === 'one' ? ' on' : ''),
      `${p.name}<span class="n">${n}</span>`);
    b.onclick = () => { mode = 'one'; curProject = p.id; rebuild(); };
    box.appendChild(b);
  });
  const all = el('button', 'tab' + (mode === 'all' ? ' on' : ''), '全部');
  all.onclick = () => { mode = 'all'; rebuild(); };
  box.appendChild(all);
}

/* ---------------- 图 ---------------- */
function visibleNodes() {
  const live = S.nodes.filter((n) => n.status !== 'deleted');
  return mode === 'all' ? live : live.filter((n) => n.project === curProject);
}

function timeX(t) {
  const x = msOf(t) || t0;
  const span = Math.max(1, t1 - t0);
  return 70 + ((x - t0) / span) * (Math.max(1100, W * 1.5) - 140);
}

function rebuild() {
  const keep = new Map(ns.map((d) => [d.id, d]));
  const vn = visibleNodes();
  const times = vn.map((n) => msOf(n.content_at)).filter(Boolean);
  t0 = times.length ? Math.min(...times) : Date.now();
  t1 = times.length ? Math.max(...times) : t0 + 86400000 * 30;
  if (t1 - t0 < 86400000 * 21) t1 = t0 + 86400000 * 21;

  const deg = new Map();
  S.edges.forEach((e) => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });

  ns = vn.map((n) => {
    const old = keep.get(n.id);
    const d = deg.get(n.id) || 0;
    const lane = mode === 'all' ? (S.projects.findIndex((p) => p.id === n.project) || 0) : 0;
    return {
      id: n.id, n,
      r: 5.5 + Math.sqrt(d) * 2.4,
      x: old ? old.x : timeX(n.content_at),
      y: old ? old.y : (mode === 'all' ? 110 + lane * 150 : H / 2 + (Math.random() - 0.5) * 120),
      vx: old ? old.vx : 0, vy: old ? old.vy : 0,
    };
  });
  byId = new Map(ns.map((d) => [d.id, d]));

  ls = S.edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  if (sim) sim.stop();
  sim = d3.forceSimulation(ns)
    .force('link', d3.forceLink(ls).id((d) => d.id)
      .distance((l) => (l.kind === 'supersedes' ? 150 : l.kind === 'attach' ? 78 : 96))
      .strength(0.22))
    .force('charge', d3.forceManyBody().strength(-420).distanceMax(700))
    .force('collide', d3.forceCollide().radius((d) => Math.max(d.r + 40, 62)).iterations(2))
    .force('x', d3.forceX((d) => timeX(d.n.content_at)).strength(mode === 'all' ? 0.2 : 0.38))
    .force('y', d3.forceY((d) => (mode === 'all'
      ? 100 + (S.projects.findIndex((p) => p.id === d.n.project) || 0) * 150
      : H / 2)).strength(mode === 'all' ? 0.5 : 0.12))
    .alphaDecay(0.03)
    .on('tick', draw);

  window.__dbg = { cur: curProject, mode, total: S.nodes.length, vis: ns.length, ids: S.projects.map(p => p.id), firstNode: (S.nodes[0]||{}).project };
  $('#empty').classList.toggle('hidden', ns.length > 0);
  renderNav();
  selected = null; $('#drawer').classList.add('hidden');
  draw();
  setTimeout(fit, 260);
}

function fit() {
  if (!ns.length) return;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60;
  const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60;
  const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.25, 1.6);
  cam.k = k;
  cam.x = W / 2 - ((minX + maxX) / 2) * k;
  cam.y = H / 2 - ((minY + maxY) / 2) * k;
  draw();
}

/* ---------------- 绘制 ---------------- */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  draw();
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 背景
  const g = ctx.createRadialGradient(W * 0.45, H * 0.4, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
  g.addColorStop(0, '#181a1f');
  g.addColorStop(1, '#101114');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  // 时间参考线（月初）
  drawTimeGuides();

  // 焦点集合
  const focus = active && active.size ? active : null;
  const dimAll = !!focus;

  // 边
  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const st = KIND_STYLE[l.kind] || KIND_STYLE.derived;
    const on = !dimAll || (focus.has(a.id) && focus.has(b.id));
    ctx.globalAlpha = on ? 1 : 0.18;
    ctx.strokeStyle = st.color; ctx.lineWidth = st.w / cam.k;
    if (st.dash) ctx.setLineDash(st.dash.map((x) => x / cam.k)); else ctx.setLineDash([]);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cx = mx - dy * 0.10, cy = my + dx * 0.10;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke();
    if (l.kind === 'supersedes') {
      const ang = Math.atan2(b.y - cy, b.x - cx);
      ctx.fillStyle = st.color;
      const s = 5 / cam.k;
      ctx.beginPath(); ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - s * Math.cos(ang - 0.5), b.y - s * Math.sin(ang - 0.5));
      ctx.lineTo(b.x - s * Math.cos(ang + 0.5), b.y - s * Math.sin(ang + 0.5));
      ctx.closePath(); ctx.fill();
    }
  });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // 节点
  ns.forEach((d) => {
    const on = !dimAll || focus.has(d.id);
    const col = d.n.status === 'superseded' ? '#5a626c' : (TYPE_COLOR[d.n.type] || '#8d9aa8');
    const isSel = selected === d.id, isHov = hovered === d.id;

    if (isSel) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 7 / cam.k, 0, 7);
      ctx.fillStyle = col + '22'; ctx.fill();
    }
    ctx.globalAlpha = on ? 1 : 0.22;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = (isSel || isHov ? 1.6 : 1) / cam.k;
    ctx.strokeStyle = isSel || isHov ? '#f2f5fa' : 'rgba(10,11,13,0.85)';
    ctx.stroke();

    if (d.n.auto) {
      ctx.beginPath(); ctx.arc(d.x + d.r * 0.75, d.y - d.r * 0.75, 2.2 / cam.k, 0, 7);
      ctx.fillStyle = '#8b7cf6'; ctx.fill();
    }

    // 标签
    const showLabel = cam.k > 0.62 || isSel || isHov || (focus && focus.has(d.id));
    if (showLabel) {
      const fs = 11 / cam.k;
      ctx.font = `${fs}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const label = d.n.title.length > 16 ? d.n.title.slice(0, 16) + '…' : d.n.title;
      ctx.globalAlpha = on ? 0.95 : 0.3;
      ctx.fillStyle = '#0d0f12';
      ctx.fillText(label, d.x + 0.6 / cam.k, d.y + d.r + 5 / cam.k + 0.6 / cam.k);
      ctx.fillStyle = isSel ? '#ffffff' : '#b8bfc9';
      ctx.fillText(label, d.x, d.y + d.r + 5 / cam.k);
    }
    ctx.globalAlpha = 1;
  });

  ctx.restore();

  // 空图提示
  if (!ns.length) {
    ctx.fillStyle = 'rgba(140,148,160,.5)';
    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('这个项目还没有节点', W / 2, H / 2 - 10);
    ctx.font = '12px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(120,128,140,.45)';
    ctx.fillText('点右上角「收进来」粘一段群聊试试', W / 2, H / 2 + 16);
  }
}

function drawTimeGuides() {
  const d = new Date(t0);
  let cur = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(t1);
  while (cur.getTime() <= end.getTime()) {
    if (cur.getTime() >= t0) {
      const x = timeX(new Date(cur).toISOString().slice(0, 10));
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 1 / cam.k;
      ctx.beginPath(); ctx.moveTo(x, -2000); ctx.lineTo(x, 4000); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.font = `${10.5 / cam.k}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`, x + 5 / cam.k, (22 - cam.y) / cam.k);
    }
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
}

/* ---------------- 相机 ---------------- */
function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }
function flyTo(x, y, k, dur = 380) {
  const drawerOpen = !$('#drawer').classList.contains('hidden');
  const cx = drawerOpen ? (W - 360) / 2 : W / 2;
  const target = { x: cx - x * k, y: H / 2 - y * k, k };
  const from = { ...cam }, start = performance.now();
  if (anim) cancelAnimationFrame(anim);
  const step = (now) => {
    const p = clamp((now - start) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
    cam.x = from.x + (target.x - from.x) * e;
    cam.y = from.y + (target.y - from.y) * e;
    cam.k = from.k + (target.k - from.k) * e;
    draw();
    if (p < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

/* ---------------- 交互 ---------------- */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = ns.length - 1; i >= 0; i--) {
    const d = ns[i];
    const dx = wx - d.x, dy = wy - d.y;
    if (dx * dx + dy * dy <= (d.r + 4 / cam.k) ** 2) return d;
  }
  return null;
}

function focusOn(id) {
  if (!id) { active = null; return; }
  const set = new Set([id]);
  S.edges.forEach((e) => {
    if (e.from === id) set.add(e.to);
    else if (e.to === id) set.add(e.from);
  });
  active = set;
}

function bindCanvas() {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0014), 0.2, 3.2);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.k = k2;
    cam.x = e.offsetX - wx * k2;
    cam.y = e.offsetY - wy * k2;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) {
      dragNode = d; d.fx = d.x; d.fy = d.y;
      if (!edit) { select(d.id); }
      return;
    }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
    canvas.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }

    if (dragNode) {
      const [wx, wy] = toWorld(sx, sy);
      dragNode.fx = wx; dragNode.fy = wy;
      if (edit) {
        const over = pick(sx, sy);
        dragOver = over && over.id !== dragNode.id ? over : null;
      }
      if (sim) sim.alpha(0.28).restart();
      draw(); return;
    }

    const d = pick(sx, sy);
    if ((d && d.id) !== hovered) {
      hovered = d ? d.id : null;
      if (hovered && !selected) focusOn(hovered);
      if (!hovered && !selected) active = null;
      draw();
    }
    const tip = $('#tip');
    if (d) {
      const n = d.n, f = n.source && n.source.file;
      tip.innerHTML = `<b>${n.title}</b><br>${typeOf(n.type).name} · ${n.content_at}` +
        (f ? `<br><span style="opacity:.7">▤ ${f} ${locText(n)}</span>` : `<br><span style="opacity:.5">粘贴输入</span>`);
      tip.style.display = 'block';
      tip.style.left = Math.min(sx + 16, W - 290) + 'px';
      tip.style.top = Math.max(8, sy + 18) + 'px';
    } else tip.style.display = 'none';
  });

  window.addEventListener('mouseup', () => {
    if (dragNode) {
      const d = dragNode, over = dragOver;
      d.fx = null; d.fy = null;
      dragNode = null; dragOver = null;
      if (edit && over) doEdit({ op: 'reparent', id: d.id, parent: over.id });
      if (sim) sim.alpha(0.2).restart();
    }
    if (panning) { panning = null; canvas.classList.remove('dragging'); }
  });

  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) flyTo(d.x, d.y, Math.min(2.2, cam.k * 1.7));
  });

  window.addEventListener('resize', () => { resize(); });
  $('#z-in').onclick = () => { cam.k = clamp(cam.k * 1.3, .2, 3.2); draw(); };
  $('#z-out').onclick = () => { cam.k = clamp(cam.k / 1.3, .2, 3.2); draw(); };
  $('#z-fit').onclick = fit;
}

/* ---------------- 面板 ---------------- */
function renderNav() {
  const spine = ns.filter((d) => ['decision', 'version'].includes(d.n.type) || (d.n.type === 'plan' && !d.n.parent));
  const branch = ns.filter((d) => !spine.includes(d));
  $('#nav-stats').innerHTML =
    `<div><b>${ns.length}</b>节点</div><div><b>${ns.filter(d => d.n.source && d.n.source.file).length}</b>有原文</div>` +
    `<div><b>${spine.length}</b>主线</div><div><b>${ns.filter(d => d.n.status === 'superseded').length}</b>已取代</div>`;

  const fill = (box, list) => {
    box.innerHTML = '';
    if (!list.length) { box.appendChild(el('div', 'nav-item', '<span class="sub">—</span>')); return; }
    list.forEach((d) => {
      const n = d.n, f = n.source && n.source.file;
      const it = el('div', 'nav-item' + (selected === n.id ? ' on' : ''));
      it.innerHTML = `<span class="dot" style="background:${n.status === 'superseded' ? '#5a626c' : (TYPE_COLOR[n.type] || '#8d9aa8')}"></span>
        <span class="tx">${n.title}${f ? `<br><span class="sub">▤ ${shortFile(f)}</span>` : ''}</span>`;
      it.onclick = () => { selected = n.id; focusOn(n.id); flyTo(d.x, d.y, Math.max(cam.k, 1.1)); showNode(n.id); renderNav(); };
      box.appendChild(it);
    });
  };
  fill($('#nav-spine'), spine);
  fill($('#nav-branch'), branch);

  const q = $('#nav-queue'); q.innerHTML = '';
  if (!S.queue.length) q.appendChild(el('div', 'nav-item', '<span class="sub">队列是空的</span>'));
  S.queue.forEach((item) => {
    const it = el('div', 'nav-item', `<span class="dot" style="background:#c9942f"></span><span class="tx">${item.text}</span>`);
    it.onclick = () => openPlace(item);
    q.appendChild(it);
  });
}

function select(id) {
  selected = id;
  focusOn(id);
  showNode(id);
  renderNav();
  draw();
}

async function showNode(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  const t = typeOf(n.type), p = projOf(n.project);
  $('#d-title').textContent = n.title;
  $('#d-meta').textContent = `${t.name} · ${n.content_at} · ${p.name}`;
  const body = $('#d-body'); body.innerHTML = '';

  body.appendChild(el('div', '',
    `<span class="chip ${n.status === 'superseded' ? 'red' : 'green'}">${n.status === 'superseded' ? '已取代' : n.status === 'draft' ? '草稿' : '有效'}</span>` +
    `<span class="chip blue">${n.auto ? 'AI 自动挂' : '人工'}</span>` +
    `<span class="chip">${n.placement === 'attach' ? '作为证据' : '独立节点'}</span>` +
    `<span class="chip">置信度 ${(n.confidence ?? 1).toFixed(2)}</span>`));

  const src = n.source || {};
  body.appendChild(el('h4', '', '出处'));
  if (src.file) {
    const box = el('div', 'src');
    box.innerHTML = `<div class="src-file">▤ ${src.file}</div>
      <div class="src-loc">${locText(n) || '全文'} · ${(src.locator && src.locator.kind === 'pdf') ? 'PDF' : '文本'}</div>
      <div class="src-ex"></div>`;
    box.querySelector('.src-ex').textContent = src.excerpt || '（无摘要）';
    body.appendChild(box);
    const b = el('button', 'btn primary small', '打开原文并定位');
    b.style.marginTop = '8px';
    b.onclick = () => openSource(n, box.querySelector('.src-ex'));
    body.appendChild(b);
  } else {
    body.appendChild(el('div', 'muted', '粘贴输入，没有文件载体。'));
    if (src.excerpt) { const d = el('div', 'src-ex'); d.textContent = src.excerpt; body.appendChild(d); }
  }

  const ex = n.extra || {};
  if (Object.keys(ex).length) {
    body.appendChild(el('h4', '', '字段'));
    const kv = el('div', 'kv');
    Object.entries(ex).forEach(([k, v]) => { kv.appendChild(el('div', 'k', k)); kv.appendChild(el('div', '', String(v))); });
    body.appendChild(kv);
  }

  const rel = S.edges.filter((e) => e.from === id || e.to === id);
  if (rel.length) {
    body.appendChild(el('h4', '', '脉络'));
    rel.forEach((e) => {
      const other = S.nodes.find((x) => x.id === (e.from === id ? e.to : e.from));
      const kt = { derived: '派生', supersedes: '取代', relates: '关联', attach: '挂载' }[e.kind] || e.kind;
      const line = el('div', 'rel', `<span class="k">${e.from === id ? '↘' : '↖'} ${kt}</span><span>${other ? other.title : ''}</span>`);
      if (other) line.onclick = () => { select(other.id); const d = byId.get(other.id); if (d) flyTo(d.x, d.y, cam.k); };
      body.appendChild(line);
    });
  }

  const acts = el('div', 'btnrow');
  const mk = (label, fn) => { const b = el('button', 'btn ghost small', label); b.onclick = fn; acts.appendChild(b); };
  mk('标记取代…', () => { toast('进入调整模式，再点一个被取代的节点'); toggleEdit(true); pendingSupersede = id; });
  mk(n.status === 'draft' ? '转有效' : '转草稿', () => doEdit({ op: 'status', id, status: n.status === 'draft' ? 'active' : 'draft' }));
  mk('删除', () => doEdit({ op: 'delete', id }));
  const sel2 = el('select');
  sel2.style.cssText = 'height:24px;background:#14161a;border:1px solid #2b2f37;color:#dfe3e9;border-radius:6px;font:inherit';
  sel2.innerHTML = S.types.map((t2) => `<option value="${t2.id}" ${t2.id === n.type ? 'selected' : ''}>${t2.name}</option>`).join('');
  sel2.onchange = () => doEdit({ op: 'retype', id, type: sel2.value });
  acts.appendChild(sel2);
  body.appendChild(acts);

  $('#drawer').classList.remove('hidden');
}

async function openSource(n, box) {
  const d = await window.api.openFile({ nodeId: n.id });
  box.innerHTML = '';
  if (d.error) { box.textContent = d.error; return; }
  if (d.kind === 'pdf') {
    const wrap = el('div', 'imgbox');
    wrap.innerHTML = `<img src="${d.image}" />`;
    if (d.rect) {
      const hl = el('div', 'hl');
      // PDF 页面 595x842pt，渲染 110dpi ≈ 910x1288px
      const [x0, y0, x1, y1] = d.rect;
      const sx = 910 / 595, sy = 1288 / 842;
      hl.style.left = (x0 * sx) + 'px';
      hl.style.top = (y0 * sy) + 'px';
      hl.style.width = ((x1 - x0) * sx) + 'px';
      hl.style.height = ((y1 - y0) * sy) + 'px';
      wrap.appendChild(hl);
    }
    box.appendChild(wrap);
    box.appendChild(el('div', 'muted', `${d.name} · 第 ${d.page} 页`));
  } else {
    const s = d.start, e = d.end;
    const txt = d.text || '';
    if (s != null && e != null && s >= 0) box.innerHTML = txt.slice(0, s) + '<mark>' + txt.slice(s, e) + '</mark>' + txt.slice(e);
    else box.textContent = txt.slice(0, 3000);
  }
}

let pendingSupersede = null;
function toggleEdit(force) {
  edit = force === undefined ? !edit : force;
  $('#btn-edit').classList.toggle('on', edit);
  canvas.classList.toggle('editing', edit);
  toast(edit ? '调整模式：把节点拖到另一个节点上即可改父节点' : '已退出调整模式');
}

async function doEdit(p) {
  if (p.op === 'supersede') pendingSupersede = null;
  await window.api.edit(p);
  await loadState(); rebuild();
}

/* ---------------- 检索 ---------------- */
let sTimer = null;
async function doSearch(q) {
  const hint = $('#search-hint');
  if (!q.trim()) { active = null; hint.classList.remove('on'); draw(); return; }
  const r = await window.api.search({ q });
  active = new Set(r.hits.map((h) => h.id));
  r.neighbors.forEach((id) => active.add(id));
  $('#trace').textContent = (r.trace || []).join('　·　');
  if (r.hits.length) {
    hint.innerHTML = r.hits.slice(0, 6).map((h) =>
      `<div class="hint-item" data-id="${h.id}"><div class="t">${h.title}</div>
        <div class="m">${typeOf(h.type).name} · ${projOf(h.project).name}</div></div>`).join('');
    hint.classList.add('on');
    hint.querySelectorAll('.hint-item').forEach((it) => {
      it.onclick = () => {
        hint.classList.remove('on');
        const d = byId.get(it.dataset.id);
        if (d) { select(d.id); flyTo(d.x, d.y, Math.max(cam.k, 1.3)); }
      };
    });
    const first = byId.get(r.hits[0].id);
    if (first) flyTo(first.x, first.y, Math.max(cam.k, 1.1));
  } else {
    hint.innerHTML = '<div class="hint-item"><div class="m">没有命中。试试「定价」「口径」「预算」</div></div>';
    hint.classList.add('on');
    $('#trace').textContent = '检索 0 命中 → 没有凭证，不猜（拒答也是一种回答）';
  }
  renderNav(); draw();
}

/* ---------------- 收进来 ---------------- */
async function doCapture() {
  const text = $('#capture-text').value.trim();
  if (!text) return toast('先粘点东西');
  const date = $('#capture-date').value || null;
  const r = await window.api.capture({ text, date });
  $('#modal-capture').classList.add('hidden');
  await loadState(); rebuild();
  const auto = r.items.filter((i) => i.committed).length;
  const pop = r.items.filter((i) => !i.committed && i.cls.action === 'popup');
  const queued = r.items.filter((i) => !i.committed && i.cls.action === 'queue').length;
  toast(`切出 ${r.items.length} 条：自动挂 ${auto}，待确认 ${pop.length}，进队列 ${queued}，丢弃 ${r.dropped.length}`);
  if (pop.length) openPlace(pop[0], pop.slice(1));
  else if (auto) {
    const last = r.items.filter((i) => i.committed).pop();
    const d = byId.get(last.node_id);
    if (d) { select(d.id); flyTo(d.x, d.y, 1.2); }
  }
}

let placeQueue = [];
function openPlace(item, rest = []) {
  placeQueue = rest;
  const cls = item.cls || {};
  $('#place-text').textContent = item.text + (item.truncated ? '（原文可能不完整）' : '');
  $('#place-why').textContent = cls.margin != null
    ? `判断置信度 ${(cls.confidence ?? 0).toFixed(2)}，但前两个候选只差 ${cls.margin.toFixed(3)} —— AI 在“挂在谁下面”这件事上没把握，所以问你。`
    : '';
  const box = $('#place-cands'); box.innerHTML = '';
  let picked = null;
  (cls.candidates || []).slice(0, 3).forEach((c, i) => {
    const n = S.nodes.find((x) => x.id === c.id) || {};
    const div = el('div', 'cand' + (i === 0 ? ' sel' : ''));
    div.innerHTML = `<span class="sc">${c.score}</span>
      <div class="path">${projOf(n.project).name} ▸ ${typeOf(n.type).name} ▸ ${n.title || c.id}</div>
      <div class="why">${i === 0 ? '最像这一条的上游' : '次选'}</div>`;
    div.onclick = () => { box.querySelectorAll('.cand').forEach((x) => x.classList.remove('sel')); div.classList.add('sel'); picked = c.id; };
    box.appendChild(div);
    if (i === 0) picked = c.id;
  });
  $('#place-custom').value = '';
  $('#modal-place').classList.remove('hidden');

  $('#place-confirm').onclick = async () => {
    const custom = $('#place-custom').value.trim();
    const r = await window.api.place({
      item: { id: item.id, text: item.text, at: item.at, speaker: item.speaker, cls },
      parent: custom ? null : picked,
      project: cls.project, type: cls.type, placement: cls.placement,
      new_node_title: custom || null,
    });
    $('#modal-place').classList.add('hidden');
    await loadState(); rebuild();
    const d = byId.get(r.node_id);
    if (d) { select(d.id); flyTo(d.x, d.y, 1.2); }
    toast('已挂上，并记住这次的判断');
    if (placeQueue.length) openPlace(placeQueue.shift(), placeQueue);
  };
}

/* ---------------- 类型 ---------------- */
function addFieldRow(key = '', kind = '文本') {
  const row = el('div', 'field-row');
  row.innerHTML = `<input placeholder="字段名（中文）" value="${key}" />
    <select>${['文本', '长文本', '日期', '人员', '数字', '单选', '链接'].map((k) => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  $('#type-fields').appendChild(row);
}

/* ---------------- 绑定 ---------------- */
function bindUI() {
  $('#btn-capture').onclick = () => {
    $('#modal-capture').classList.remove('hidden');
    $('#capture-date').valueAsDate = new Date();
    $('#capture-text').focus();
  };
  $('#capture-go').onclick = doCapture;
  $('#btn-edit').onclick = () => toggleEdit();
  $('#btn-queue').onclick = () => {
    $('#nav').classList.remove('collapsed');
    const first = $('#nav-queue').querySelector('.nav-item');
    if (S.queue.length) openPlace(S.queue[0]); else toast('队列是空的');
  };
  $('#nav-toggle').onclick = () => {
    $('#nav').classList.toggle('collapsed');
    $('#nav-toggle').textContent = $('#nav').classList.contains('collapsed') ? '›' : '‹';
    setTimeout(resize, 180);
  };
  $('#d-close').onclick = () => { $('#drawer').classList.add('hidden'); selected = null; active = null; renderNav(); draw(); };
  $('#btn-type').onclick = () => {
    $('#type-fields').innerHTML = ''; $('#type-name').value = '';
    addFieldRow('结论'); addFieldRow('负责人', '人员');
    $('#modal-type').classList.remove('hidden');
  };
  $('#type-add-field').onclick = () => addFieldRow();
  $('#type-save').onclick = async () => {
    const name = $('#type-name').value.trim();
    if (!name) return toast('给类型起个名字');
    const fields = [...$('#type-fields').querySelectorAll('.field-row')].map((r) => ({
      key: r.querySelector('input').value.trim() || '未命名字段',
      kind: r.querySelector('select').value,
    }));
    await window.api.addType({ name, fields });
    $('#modal-type').classList.add('hidden');
    await loadState();
    toast('类型已创建');
  };
  $('#btn-git').onclick = async () => {
    toast('正在读取 git 历史…');
    const r = await window.api.gitSync({});
    if (r.error) return toast('git 读取失败：' + r.error);
    await loadState();
    mode = 'one'; curProject = 'p_code'; rebuild();
    toast(`已接入 ${r.added} 个版本节点（共 ${r.total} 个）`);
  };
  $('#search').addEventListener('input', (e) => { clearTimeout(sTimer); sTimer = setTimeout(() => doSearch(e.target.value), 240); });
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; active = null; $('#search-hint').classList.remove('on'); draw(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) $('#search-hint').classList.remove('on'); });
  document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => b.closest('.modal').classList.add('hidden'));

  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
      $('#drawer').classList.add('hidden'); $('#search-hint').classList.remove('on');
      selected = null; active = null; renderNav(); draw();
    }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'e' || e.key === 'E') toggleEdit();
    if (e.key === 'f' || e.key === 'F') fit();
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z')) { e.preventDefault(); window.api.undo().then(async () => { await loadState(); rebuild(); }); }
  });

  window.api.onMenu(async (m) => {
    if (m.type === 'fit') fit();
    if (m.type === 'zoom') { cam.k = clamp(cam.k * (m.dir > 0 ? 1.25 : 0.8), .2, 3.2); draw(); }
    if (m.type === 'toggle-edit') toggleEdit();
    if (m.type === 'reload') { await loadState(); rebuild(); }
  });
}

/* ---------------- 启动 ---------------- */
async function boot() {
  canvas = $('#canvas'); ctx = canvas.getContext('2d');
  bindUI(); bindCanvas();
  await loadState();
  curProject = (S.projects.find((p) => p.id === 'p_pricing') || S.projects[0] || {}).id;
  rebuild();
  resize();
  // 图例
  const lg = $('#legend'); lg.innerHTML = '';
  S.types.slice(0, 5).forEach((t) => {
    lg.appendChild(el('span', '', `<i style="background:${TYPE_COLOR[t.id] || t.color}"></i>${t.name}`));
  });
}

boot();
