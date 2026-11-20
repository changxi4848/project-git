'use strict';
/* 项目Git · 渲染层
   白底 / 卡片节点 / 直线连接 / 力导向 + 很弱的“向右”时间力
   - 走错的支线：节点灰化虚线 + 连线中间断开并打叉
*/

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR = { plan: '#3f8fc4', decision: '#d9534f', retro: '#7c6bc4', doc: '#a1785a', data: '#3f9d94', code: '#5f7590', output: '#c08a3e', asset: '#5b9b52', version: '#8a97a5' };
const CARD_W = 172, CARD_H = 64;

let S = { projects: [], types: [], nodes: [], edges: [], queue: [], choices: [], meta: {} };
let sim = null, ns = [], ls = [], byId = new Map();
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, mode = 'one', filterType = '';
let hovered = null, selected = null, active = null;
let edit = false, dragInfo = null, panning = null, pendingSupersede = null;
let anim = null, t0 = 0, t1 = 0;

const typeOf = (id) => S.types.find((t) => t.id === id) || { name: id, color: '#8a97a5' };
const projOf = (id) => S.projects.find((p) => p.id === id) || { name: id, color: '#8a97a5' };
const dstr = (s) => (s || '').slice(5, 10);
const msOf = (s) => { const t = Date.parse((s || '').length <= 7 ? s + '-01' : (s || '').replace('T', ' ')); return isNaN(t) ? null : t; };

function toast(msg, t = 2200) {
  const e = $('#toast'); e.textContent = msg; e.classList.remove('hidden');
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('hidden'), t);
}

async function loadState() {
  S = await window.api.state();
  renderTabs();
  $('#queue-count').textContent = S.queue.length;
}

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  S.projects.forEach((p) => {
    const n = S.nodes.filter((x) => x.project === p.id && x.status !== 'deleted').length;
    if (!n) return;
    const b = el('button', 'tab' + (p.id === curProject && mode === 'one' ? ' on' : ''), p.name);
    b.onclick = () => { mode = 'one'; curProject = p.id; rebuild(); };
    box.appendChild(b);
  });
  const all = el('button', 'tab' + (mode === 'all' ? ' on' : ''), '全部');
  all.onclick = () => { mode = 'all'; rebuild(); };
  box.appendChild(all);
}

function visibleNodes() {
  const live = S.nodes.filter((n) => n.status !== 'deleted');
  return mode === 'all' ? live : live.filter((n) => n.project === curProject);
}

/** 节点卡片上第二行：优先“结论 / 实际 / 理由”，否则摘要 */
function keyLine(n) {
  const e = n.extra || {};
  return e['结论'] || e['实际'] || e['理由'] || e['可复用做法'] || n.summary || '';
}

function rebuild() {
  const vn = visibleNodes();
  const deg = new Map();
  S.edges.forEach((e) => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });

  const times = vn.map((n) => msOf(n.content_at)).filter(Boolean);
  t0 = times.length ? Math.min(...times) : 0;
  t1 = times.length ? Math.max(...times) : t0 + 1;
  const span = Math.max(1, t1 - t0);

  const old = new Map(ns.map((d) => [d.id, d]));
  ns = vn.map((n) => {
    const p = old.get(n.id);
    return {
      id: n.id, n,
      w: CARD_W, h: CARD_H,
      r: Math.min(96, 62 + Math.sqrt(deg.get(n.id) || 0) * 6),
      x: p ? p.x : ((msOf(n.content_at) || t0) - t0) / span * 1100 - 550 + (Math.random() - 0.5) * 40,
      y: p ? p.y : (Math.random() - 0.5) * 300,
    };
  });
  byId = new Map(ns.map((d) => [d.id, d]));
  ls = S.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  if (sim) sim.stop();
  sim = d3.forceSimulation(ns)
    .force('link', d3.forceLink(ls).id((d) => d.id).distance(150).strength(0.68))
    .force('charge', d3.forceManyBody().strength(-420).distanceMax(800))
    .force('collide', d3.forceCollide().radius((d) => d.r).iterations(3))
    // 很弱的“向右”力：让时间大致从左到右，但不排成格子
    .force('x', d3.forceX((d) => ((msOf(d.n.content_at) || t0) - t0) / span * 760 - 380).strength(0.09))
    .force('y', d3.forceY(0).strength(0.045))
    .alphaDecay(0.022)
    .on('tick', draw)
    .on('end', () => { deoverlap(260); fit(); deoverlap(80); fit(); });


  selected = null; hovered = null; active = null;
  $('#drawer').classList.add('hidden');
  renderNav();
  draw();
  setTimeout(fit, 350);
}

function deoverlap(iters = 90) {
  const gap = 14;
  for (let k = 0; k < iters; k++) {
    let moved = false;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a1 = ns[i], b1 = ns[j];
        const dx = b1.x - a1.x, dy = b1.y - a1.y;
        const ox = (a1.w + b1.w) / 2 + gap - Math.abs(dx);
        const oy = (a1.h + b1.h) / 2 + gap - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox * a1.h < oy * a1.w) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a1.x -= s; b1.x += s; }
          else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a1.y -= s; b1.y += s; }
        }
      }
    }
    if (!moved) break;
  }
}

function fit() {
  if (!ns.length) return;
  const cw = canvas.clientWidth || W, ch = canvas.clientHeight || H;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const pad = 140;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  let k = Math.min(cw / (maxX - minX), ch / (maxY - minY));
  k = clamp(k, 0.3, 1.0);
  cam.k = k;
  cam.x = cw / 2 - ((minX + maxX) / 2) * k;
  cam.y = ch / 2 - ((minY + maxY) / 2) * k;
  draw();
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  draw();
}

/* ---------------- 绘制 ---------------- */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** 从卡片边缘出线的交点（把线缩短到边框上） */
function edgePoint(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const hw = (from.w || 40) / 2, hh = (from.h || 20) / 2;
  let k = 1;
  if (adx * hh > ady * hw) k = hw / (adx || 1);
  else k = hh / (ady || 1);
  return { x: from.x + dx * k, y: from.y + dy * k };
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  const focus = active && active.size ? active : null;

  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const isSup = l.kind === 'supersedes';
    const dead = a.n.status === 'abandoned' || b.n.status === 'abandoned';
    const p1 = edgePoint(a, b), p2 = edgePoint(b, a);

    ctx.globalAlpha = on ? 1 : 0.14;
    ctx.strokeStyle = isSup ? 'rgba(217,83,79,0.7)' : (dead ? 'rgba(160,168,178,0.55)' : 'rgba(148,161,175,0.6)');
    ctx.lineWidth = (isSup ? 1.8 : 1) / cam.k;

    if (dead) {
      // 断掉的线：中间留缺口 + 打个叉
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
      const gx = dx / len * 9, gy = dy / len * 9;
      ctx.setLineDash([5 / cam.k, 4 / cam.k]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mx - gx, my - gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + gx, my + gy); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      const s = 5 / cam.k;
      ctx.strokeStyle = 'rgba(160,168,178,0.85)';
      ctx.beginPath();
      ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s);
      ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s);
      ctx.stroke();
    } else {
      ctx.setLineDash(l.kind === 'relates' || l.kind === 'attach' ? [4 / cam.k, 4 / cam.k] : []);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      if (isSup) {
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const s = 6 / cam.k;
        ctx.fillStyle = 'rgba(217,83,79,0.85)';
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - s * Math.cos(ang - 0.45), p2.y - s * Math.sin(ang - 0.45));
        ctx.lineTo(p2.x - s * Math.cos(ang + 0.45), p2.y - s * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
      }
    }
  });
  ctx.globalAlpha = 1;

  ns.forEach((d) => drawCard(d, focus));
  ctx.restore();
}

function drawCard(d, focus) {
  const n = d.n;
  const on = !focus || focus.has(n.id);
  const abandoned = n.status === 'abandoned';
  const sup = n.status === 'superseded';
  const col = abandoned || sup ? '#b9c2cb' : (COLOR[n.type] || '#8a97a5');
  const isSel = selected === n.id, isHov = hovered === n.id;

  const x = d.x - d.w / 2, y = d.y - d.h / 2;

  ctx.globalAlpha = on ? 1 : 0.16;

  // 阴影
  if (isSel || isHov) {
    ctx.save();
    ctx.shadowColor = 'rgba(17,24,39,.16)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    roundRect(ctx, x, y, d.w, d.h, 9); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }

  roundRect(ctx, x, y, d.w, d.h, 9);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = (isSel || isHov ? 2 : 1.2) / cam.k;
  ctx.strokeStyle = col;
  if (abandoned) ctx.setLineDash([5 / cam.k, 4 / cam.k]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 左侧色条
  ctx.fillStyle = col;
  roundRect(ctx, x + 1, y + 10, 3, d.h - 20, 1.5); ctx.fill();

  const innerW = d.w - 22;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  // 标题
  ctx.fillStyle = abandoned ? '#9aa5b1' : '#111827';
  ctx.font = '600 12.5px "Microsoft YaHei",sans-serif';
  ctx.fillText(truncate(ctx, n.title, innerW), x + 12, y + 9);

  // 第二行：关键信息
  const key = keyLine(n);
  if (key) {
    ctx.fillStyle = abandoned ? '#a9b2bc' : '#5b6673';
    ctx.font = '10.5px "Microsoft YaHei",sans-serif';
    ctx.fillText(truncate(ctx, key, innerW), x + 12, y + 28);
  }

  // 底部：类型 · 日期（右对齐一个状态标）
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '9.5px "Microsoft YaHei",sans-serif';
  ctx.fillText(`${typeOf(n.type).name} · ${n.content_at}`, x + 12, y + d.h - 16);

  if (abandoned) {
    ctx.fillStyle = '#eef1f4';
    roundRect(ctx, x + d.w - 52, y + 7, 44, 15, 4); ctx.fill();
    ctx.fillStyle = '#8794a1'; ctx.font = '9.5px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('已放弃', x + d.w - 30, y + 9.5);
    ctx.textAlign = 'left';
  } else if (sup) {
    ctx.fillStyle = '#fdf0ef';
    roundRect(ctx, x + d.w - 52, y + 7, 44, 15, 4); ctx.fill();
    ctx.fillStyle = '#c06a63'; ctx.font = '9.5px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('已取代', x + d.w - 30, y + 9.5);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;
}

function truncate(ctx, text, maxW) {
  let t = String(text || '');
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

function inCard(d, wx, wy) {
  return Math.abs(wx - d.x) <= d.w / 2 && Math.abs(wy - d.y) <= d.h / 2;
}

function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = ns.length - 1; i >= 0; i--) if (inCard(ns[i], wx, wy)) return ns[i];
  return null;
}

function flyTo(x, y, k, dur = 340) {
  const drawer = !$('#drawer').classList.contains('hidden');
  const target = { x: (drawer ? (W - 360) / 2 : W / 2) - x * k, y: H / 2 - y * k, k };
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
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0014), 0.2, 3);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.k = k2; cam.x = e.offsetX - wx * k2; cam.y = e.offsetY - wy * k2;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) { dragInfo = { d, start: { x: e.offsetX, y: e.offsetY }, moved: false }; return; }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
    canvas.classList.add('dragging');
    closeDrawer();          // 点空白处收起右侧面板
  });

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }

    if (dragInfo) {
      const dx = sx - dragInfo.start.x, dy = sy - dragInfo.start.y;
      if (!dragInfo.moved && Math.hypot(dx, dy) > 4) {
        dragInfo.moved = true;
        dragInfo.d.fx = dragInfo.d.x; dragInfo.d.fy = dragInfo.d.y;
      }
      if (dragInfo.moved) {
        const [wx, wy] = toWorld(sx, sy);
        dragInfo.d.fx = wx; dragInfo.d.fy = wy;
        if (sim) sim.alpha(0.3).restart();
      }
      draw(); return;
    }

    const d = pick(sx, sy);
    const id = d ? d.id : null;
    if (id !== hovered) { hovered = id; if (!selected) focusOn(id); draw(); }

    const tip = $('#tip');
    if (d) {
      const n = d.n, f = n.source && n.source.file;
      tip.innerHTML = `<b>${n.title}</b><br>${typeOf(n.type).name} · ${n.content_at}` +
        (n.summary ? `<br><span style="color:#5b6673">${n.summary.slice(0, 60)}</span>` : '') +
        (f ? `<br><span style="color:#9aa5b1">${f}</span>` : '');
      tip.style.display = 'block';
      tip.style.left = Math.min(sx + 16, W - 310) + 'px';
      tip.style.top = Math.max(8, sy + 18) + 'px';
    } else tip.style.display = 'none';
  });

  window.addEventListener('mouseup', (e) => {
    if (dragInfo) {
      const { d, moved } = dragInfo;
      d.fx = null; d.fy = null; dragInfo = null;
      canvas.classList.remove('dragging');
      if (moved) {
        const r = canvas.getBoundingClientRect();
        const over = pick(e.clientX - r.left, e.clientY - r.top);
        if (edit && over && over.id !== d.id) {
          if (pendingSupersede) {
            window.api.edit({ op: 'supersede', id: pendingSupersede, old: over.id })
              .then(async () => { pendingSupersede = null; await loadState(); rebuild(); toast('已标记取代'); });
          } else {
            window.api.edit({ op: 'reparent', id: d.id, parent: over.id })
              .then(async () => { await loadState(); rebuild(); toast('已改到新节点下'); });
          }
        }
        if (sim) sim.alpha(0.25).restart();
      } else select(d.id);
    }
    if (panning) { panning = null; canvas.classList.remove('dragging'); }
  });

  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (d) flyTo(d.x, d.y, Math.min(1.8, cam.k * 1.5));
  });

  $('#z-in').onclick = () => { cam.k = clamp(cam.k * 1.3, .2, 3); draw(); };
  $('#z-out').onclick = () => { cam.k = clamp(cam.k / 1.3, .2, 3); draw(); };
  $('#z-fit').onclick = fit;
  window.addEventListener('resize', resize);
}

/* ---------------- 左栏 ---------------- */
function renderNav() {
  const list = ns.filter((d) => !filterType || d.n.type === filterType)
    .slice().sort((a, b) => (a.n.content_at < b.n.content_at ? 1 : -1));
  $('#nav-count').textContent = list.length;
  const box = $('#nav-list'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty-nav">还没有节点</div>'; return; }
  list.forEach((d) => {
    const n = d.n;
    const dead = n.status === 'abandoned';
    const it = el('div', 'node-item' + (selected === n.id ? ' on' : ''));
    it.innerHTML = `<span class="dot" style="background:${dead ? '#c8ced5' : (COLOR[n.type] || '#8a97a5')}"></span>
      <span><span class="tx" style="${dead ? 'color:#9aa5b1' : ''}">${n.title}</span>
      <div class="dt">${typeOf(n.type).name} · ${n.content_at}${dead ? ' · 已放弃' : n.status === 'superseded' ? ' · 已取代' : ''}</div></span>`;
    it.onclick = () => { selected = n.id; focusOn(n.id); flyTo(d.x, d.y, Math.max(cam.k, 0.9)); showNode(n.id); renderNav(); };
    box.appendChild(it);
  });
}

/* ---------------- 详情 ---------------- */
function closeDrawer() {
  if ($('#drawer').classList.contains('hidden')) return;
  $('#drawer').classList.add('hidden');
  selected = null; active = null; renderNav(); draw();
}

function select(id) {
  selected = id; focusOn(id); showNode(id); renderNav(); draw();
}

function showNode(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  const t = typeOf(n.type);
  $('#d-title').textContent = n.title;
  const body = $('#d-body'); body.innerHTML = '';

  const stTxt = n.status === 'abandoned' ? '已放弃' : n.status === 'superseded' ? '已被取代' : '有效';
  const stCls = n.status === 'active' ? 'green' : 'red';
  body.appendChild(el('div', '', `<span class="chip">${t.name}</span>` +
    `<span class="chip">${n.content_at}</span>` +
    `<span class="chip ${stCls}">${stTxt}</span>`));

  if (n.summary) body.appendChild(el('div', 'summary', n.summary));

  const src = n.source || {};
  body.appendChild(el('h4', '', '出处'));
  if (src.file) {
    const box = el('div', 'src');
    const loc = src.locator || {};
    const locTxt = loc.kind === 'pdf' ? `第 ${loc.page} 页` : (loc.start != null ? `第 ${loc.start}–${loc.end} 字` : '');
    box.innerHTML = `<div class="src-file">${src.file}</div>` +
      (locTxt ? `<div class="src-loc">${locTxt}</div>` : '') +
      `<div class="src-ex">${(src.excerpt || '').replace(/</g, '&lt;')}</div>`;
    body.appendChild(box);
    const b = el('button', 'btn primary small', '打开文件');
    b.style.marginTop = '8px';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id }).then((r) => { if (r && r.error) toast(r.error); });
    body.appendChild(b);
  } else {
    body.appendChild(el('div', 'muted', '这段内容是从对话里粘进来的，没有原始文件。'));
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
    body.appendChild(el('h4', '', '关联'));
    rel.forEach((e) => {
      const other = S.nodes.find((x) => x.id === (e.from === id ? e.to : e.from));
      const kt = { derived: '属于', supersedes: '取代', relates: '相关', attach: '证据' }[e.kind] || e.kind;
      const line = el('div', 'rel', `<span class="k">${kt}</span><span>${other ? other.title : ''}</span>`);
      if (other) line.onclick = () => { select(other.id); const d = byId.get(other.id); if (d) flyTo(d.x, d.y, cam.k); };
      body.appendChild(line);
    });
  }

  const acts = el('div', 'btnrow');
  const mk = (label, fn) => { const b = el('button', 'btn ghost small', label); b.onclick = fn; acts.appendChild(b); };
  mk('删除', () => window.api.edit({ op: 'delete', id }).then(async () => { await loadState(); rebuild(); }));
  const sel = el('select');
  sel.style.cssText = 'height:24px;border:1px solid #e7ebef;border-radius:6px;font:inherit;color:#374151';
  sel.innerHTML = S.types.map((t2) => `<option value="${t2.id}" ${t2.id === n.type ? 'selected' : ''}>改成「${t2.name}」</option>`).join('');
  sel.onchange = () => window.api.edit({ op: 'retype', id, type: sel.value }).then(async () => { await loadState(); rebuild(); });
  acts.appendChild(sel);
  body.appendChild(acts);

  $('#drawer').classList.remove('hidden');
}

/* ---------------- 检索 ---------------- */
let sTimer = null;
async function doSearch(q) {
  const hint = $('#search-hint');
  if (!q.trim()) { active = null; hint.classList.remove('on'); draw(); return; }
  const r = await window.api.search({ q });
  active = new Set(r.hits.map((h) => h.id));
  r.neighbors.forEach((id) => active.add(id));
  $('#trace').textContent = r.hits.length ? `找到 ${r.hits.length} 个相关节点` : '没有相关内容';
  if (r.hits.length) {
    hint.innerHTML = r.hits.slice(0, 6).map((h) =>
      `<div class="hint-item" data-id="${h.id}"><div class="t">${h.title}</div>
        <div class="m">${typeOf(h.type).name} · ${projOf(h.project).name}</div></div>`).join('');
    hint.classList.add('on');
    hint.querySelectorAll('.hint-item').forEach((it) => {
      it.onclick = () => {
        hint.classList.remove('on');
        const d = byId.get(it.dataset.id);
        if (d) { select(d.id); flyTo(d.x, d.y, Math.max(cam.k, 1.1)); }
      };
    });
  } else {
    hint.innerHTML = '<div class="hint-item"><div class="m">没有找到相关内容</div></div>';
    hint.classList.add('on');
  }
  renderNav(); draw();
}

/* ---------------- 收进来 ---------------- */
async function doCapture() {
  const text = $('#capture-text').value.trim();
  if (!text) return toast('先粘点东西');
  const r = await window.api.capture({ text, date: $('#capture-date').value || null });
  $('#modal-capture').classList.add('hidden');
  await loadState(); rebuild();

  const auto = r.items.filter((i) => i.committed);
  const ask = r.items.filter((i) => !i.committed && i.cls.action === 'popup');
  const queued = r.items.filter((i) => !i.committed && i.cls.action === 'queue');
  $('#trace').textContent = `进来 ${r.items.length} 条：${auto.length} 条已挂上，${ask.length} 条要问你，${queued.length} 条先放着`;
  if (ask.length) openPlace(ask[0], ask.slice(1));
  else if (auto.length) { const d = byId.get(auto[auto.length - 1].node_id); if (d) { select(d.id); flyTo(d.x, d.y, 1); } }
}

let placeQueue = [];
function openPlace(item, rest = []) {
  placeQueue = rest;
  const cls = item.cls || {};
  $('#place-text').textContent = item.text;
  const box = $('#place-cands'); box.innerHTML = '';
  let picked = null;
  (cls.candidates || []).slice(0, 3).forEach((c, i) => {
    const n = S.nodes.find((x) => x.id === c.id) || {};
    const div = el('div', 'cand' + (i === 0 ? ' sel' : ''));
    div.innerHTML = `<div class="path">${n.title || c.id}</div>
      <div class="why">${typeOf(n.type).name} · ${projOf(n.project).name}</div>`;
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
    if (d) { select(d.id); flyTo(d.x, d.y, 1); }
    if (placeQueue.length) openPlace(placeQueue.shift(), placeQueue);
  };
}

/* ---------------- 其他 ---------------- */
function addFieldRow(key = '', kind = '文本') {
  const row = el('div', 'field-row');
  row.innerHTML = `<input placeholder="字段名" value="${key}" />
    <select>${['文本', '长文本', '日期', '人员', '数字', '单选', '链接'].map((k) => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  $('#type-fields').appendChild(row);
}

function bindUI() {
  $('#btn-capture').onclick = () => {
    $('#modal-capture').classList.remove('hidden');
    $('#capture-date').valueAsDate = new Date();
    $('#capture-text').focus();
  };
  $('#capture-go').onclick = doCapture;

  $('#btn-more').onclick = (e) => { e.stopPropagation(); $('#more-menu').classList.toggle('hidden'); };
  document.addEventListener('click', () => $('#more-menu').classList.add('hidden'));
  $('#more-menu').onclick = (e) => e.stopPropagation();

  $('#btn-queue').onclick = () => {
    $('#more-menu').classList.add('hidden');
    if (S.queue.length) openPlace(S.queue[0]); else toast('没有待归类的');
  };
  $('#btn-edit').onclick = () => {
    $('#more-menu').classList.add('hidden');
    edit = !edit;
    canvas.classList.toggle('editing', edit);
    $('#trace').textContent = edit ? '调整中：把一个节点拖到另一个节点上，就挂到它下面' : '';
  };
  $('#btn-type').onclick = () => {
    $('#more-menu').classList.add('hidden');
    $('#type-fields').innerHTML = ''; $('#type-name').value = '';
    addFieldRow('结论'); addFieldRow('负责人', '人员');
    $('#modal-type').classList.remove('hidden');
  };
  $('#btn-git').onclick = async () => {
    $('#more-menu').classList.add('hidden');
    toast('读取中…');
    const r = await window.api.gitSync({});
    if (r.error) return toast('失败：' + r.error);
    await loadState(); mode = 'one'; curProject = 'p_code'; rebuild();
    toast(`接入 ${r.added} 个提交`);
  };
  $('#type-add-field').onclick = () => addFieldRow();
  $('#type-save').onclick = async () => {
    const name = $('#type-name').value.trim();
    if (!name) return toast('起个名字');
    const fields = [...$('#type-fields').querySelectorAll('.field-row')].map((r) => ({
      key: r.querySelector('input').value.trim() || '字段', kind: r.querySelector('select').value,
    }));
    await window.api.addType({ name, fields });
    $('#modal-type').classList.add('hidden');
    await loadState(); toast('已创建');
  };

  $('#nav-filter').onclick = (e) => {
    const b = e.target.closest('.chipf'); if (!b) return;
    [...$('#nav-filter').children].forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    filterType = b.dataset.t;
    renderNav();
  };

  $('#d-close').onclick = closeDrawer;

  $('#search').addEventListener('input', (e) => { clearTimeout(sTimer); sTimer = setTimeout(() => doSearch(e.target.value), 220); });
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; active = null; $('#search-hint').classList.remove('on'); draw(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) $('#search-hint').classList.remove('on'); });
  document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => b.closest('.modal').classList.add('hidden'));

  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
      $('#more-menu').classList.add('hidden');
      closeDrawer();
    }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'f' || e.key === 'F') fit();
    if (e.key === 'e' || e.key === 'E') $('#btn-edit').click();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); window.api.undo().then(async () => { await loadState(); rebuild(); }); }
  });

  window.api.onMenu(async (m) => {
    if (m.type === 'fit') fit();
    if (m.type === 'zoom') { cam.k = clamp(cam.k * (m.dir > 0 ? 1.25 : 0.8), .2, 3); draw(); }
    if (m.type === 'toggle-edit') $('#btn-edit').click();
    if (m.type === 'reload') { await loadState(); rebuild(); }
  });
}

async function boot() {
  canvas = $('#canvas'); ctx = canvas.getContext('2d');
  bindUI(); bindCanvas();
  await loadState();
  const first = S.projects.find((p) => S.nodes.some((n) => n.project === p.id && n.status !== 'deleted'));
  curProject = (S.projects.find((p) => p.id === 'p_pricing') || first || S.projects[0] || {}).id;
  resize();
  rebuild();
  requestAnimationFrame(() => { resize(); fit(); });
}

boot();
