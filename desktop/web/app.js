'use strict';
/* 项目Git · 渲染层（白底 / 直线 / 纯力导向） */

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLOR = { plan: '#3f8fc4', decision: '#d9534f', asset: '#5b9b52', retro: '#7c6bc4', version: '#8a97a5' };

let S = { projects: [], types: [], nodes: [], edges: [], queue: [], choices: [], meta: {} };
let sim = null, ns = [], ls = [], byId = new Map();
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, mode = 'one', filterType = '';
let hovered = null, selected = null, active = null;
let edit = false, dragInfo = null, panning = null, pendingSupersede = null;
let anim = null;

const typeOf = (id) => S.types.find((t) => t.id === id) || { name: id, color: '#8a97a5' };
const projOf = (id) => S.projects.find((p) => p.id === id) || { name: id, color: '#8a97a5' };
const dstr = (s) => (s || '').slice(5, 10);
const shortFile = (f) => f ? f.replace(/\.(md|txt|pdf|docx)$/i, '').slice(0, 16) : '';

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

function rebuild() {
  const vn = visibleNodes();
  const deg = new Map();
  S.edges.forEach((e) => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });

  const old = new Map(ns.map((d) => [d.id, d]));
  ns = vn.map((n) => {
    const p = old.get(n.id);
    return {
      id: n.id, n,
      r: 6 + Math.sqrt(deg.get(n.id) || 0) * 2.2,
      x: p ? p.x : (Math.random() - 0.5) * 260,
      y: p ? p.y : (Math.random() - 0.5) * 260,
    };
  });
  byId = new Map(ns.map((d) => [d.id, d]));
  ls = S.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  if (sim) sim.stop();
  sim = d3.forceSimulation(ns)
    .force('link', d3.forceLink(ls).id((d) => d.id).distance(92).strength(0.65))
    .force('charge', d3.forceManyBody().strength(-300).distanceMax(700))
    .force('collide', d3.forceCollide().radius((d) => d.r + 30))
    .force('center', d3.forceCenter(0, 0).strength(0.12))
    .alphaDecay(0.025)
    .on('tick', draw);

  selected = null; hovered = null; active = null;
  $('#drawer').classList.add('hidden');
  renderNav();
  draw();
  setTimeout(fit, 500);
}

function fit() {
  if (!ns.length) return;
  const xs = ns.map((d) => d.x), ys = ns.map((d) => d.y);
  const pad = 120;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const k = clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.3, 1.4);
  cam.k = k;
  cam.x = W / 2 - ((minX + maxX) / 2) * k;
  cam.y = H / 2 - ((minY + maxY) / 2) * k;
  draw();
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  draw();
}

/* ---------------- 绘制 ---------------- */
function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  const focus = active && active.size ? active : null;

  // 直线连接
  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const isSup = l.kind === 'supersedes';
    ctx.globalAlpha = on ? 1 : 0.16;
    ctx.strokeStyle = isSup ? 'rgba(217,83,79,0.75)' : (l.kind === 'relates' ? 'rgba(120,132,146,0.35)' : 'rgba(150,163,176,0.55)');
    ctx.lineWidth = (isSup ? 1.8 : 1) / cam.k;
    if (l.kind === 'relates' || l.kind === 'attach') ctx.setLineDash([3 / cam.k, 3 / cam.k]);
    else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    if (isSup) {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const s = 6 / cam.k, ex = b.x - Math.cos(ang) * (b.r + 1), ey = b.y - Math.sin(ang) * (b.r + 1);
      ctx.fillStyle = 'rgba(217,83,79,0.8)';
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - s * Math.cos(ang - 0.45), ey - s * Math.sin(ang - 0.45));
      ctx.lineTo(ex - s * Math.cos(ang + 0.45), ey - s * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  // 节点 + 标签
  ns.forEach((d) => {
    const on = !focus || focus.has(d.id);
    const col = COLOR[d.n.type] || '#8a97a5';
    const isSel = selected === d.id, isHov = hovered === d.id;

    ctx.globalAlpha = on ? 1 : 0.2;
    if (isSel) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, 0, 7);
      ctx.fillStyle = col + '22'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = (isSel || isHov ? 1.8 : 1.2) / cam.k;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    const show = cam.k > 0.5 || isSel || isHov || (focus && focus.has(d.id));
    if (show) {
      const fs = 12 / cam.k, ds = 10.5 / cam.k;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = `${fs}px "Microsoft YaHei",sans-serif`;
      const title = d.n.title.length > 14 ? d.n.title.slice(0, 14) + '…' : d.n.title;
      ctx.globalAlpha = on ? 1 : 0.25;
      ctx.fillStyle = isSel ? '#111827' : '#374151';
      ctx.fillText(title, d.x, d.y + d.r + 6 / cam.k);
      ctx.font = `${ds}px "Microsoft YaHei",sans-serif`;
      ctx.fillStyle = '#9aa5b1';
      ctx.fillText(dstr(d.n.content_at), d.x, d.y + d.r + 6 / cam.k + fs + 2 / cam.k);
    }
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

function flyTo(x, y, k, dur = 340) {
  const cx = W / 2, cy = H / 2;
  const target = { x: cx - x * k, y: cy - y * k, k };
  const from = { ...cam }, start = performance.now(), drawer = !$('#drawer').classList.contains('hidden');
  const tx = drawer ? (W - 360) / 2 : cx;
  target.x = tx - x * k;
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
    if (dx * dx + dy * dy <= (d.r + 5) ** 2) return d;
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
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0014), 0.2, 3);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.k = k2; cam.x = e.offsetX - wx * k2; cam.y = e.offsetY - wy * k2;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    const start = { x: e.offsetX, y: e.offsetY };
    if (d) {
      dragInfo = { d, start, moved: false };
      return;                              // 先不选中：区分“点”和“拖”
    }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
    canvas.classList.add('dragging');
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
        canvas.classList.add('dragging');
      }
      if (dragInfo.moved) {
        const [wx, wy] = toWorld(sx, sy);
        dragInfo.d.fx = wx; dragInfo.d.fy = wy;
        if (sim) sim.alpha(0.25).restart();
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
        (f ? `<br><span style="color:#9aa5b1">${f}</span>` : '');
      tip.style.display = 'block';
      tip.style.left = Math.min(sx + 16, W - 300) + 'px';
      tip.style.top = Math.max(8, sy + 18) + 'px';
    } else tip.style.display = 'none';
  });

  window.addEventListener('mouseup', (e) => {
    if (dragInfo) {
      const { d, moved } = dragInfo;
      d.fx = null; d.fy = null;
      dragInfo = null;
      canvas.classList.remove('dragging');
      if (moved) {
        const r = canvas.getBoundingClientRect();
        const over = pick(e.clientX - r.left, e.clientY - r.top);
        if (edit && over && over.id !== d.id) {
          if (pendingSupersede) {
            window.api.edit({ op: 'supersede', id: pendingSupersede, old: over.id }).then(async () => {
              pendingSupersede = null; await loadState(); rebuild(); toast('已标记取代');
            });
          } else {
            window.api.edit({ op: 'reparent', id: d.id, parent: over.id }).then(async () => {
              await loadState(); rebuild(); toast('已改到新节点下');
            });
          }
        }
        if (sim) sim.alpha(0.2).restart();
      } else {
        select(d.id);                 // 只有“没拖动”才打开面板
      }
    }
    if (panning) { panning = null; canvas.classList.remove('dragging'); }
  });

  canvas.addEventListener('dblclick', (e) => {
    const d = pick(e.offsetX, e.offsetY);
    if (!d) return;
    const others = ns.filter((x) => x !== d);
    const k = Math.min(2, cam.k * 1.6);
    flyTo(d.x, d.y, k);
  });

  $('#z-in').onclick = () => { cam.k = clamp(cam.k * 1.3, .2, 3); draw(); };
  $('#z-out').onclick = () => { cam.k = clamp(cam.k / 1.3, .2, 3); draw(); };
  $('#z-fit').onclick = fit;
  window.addEventListener('resize', resize);
}

/* ---------------- 左栏 ---------------- */
function renderNav() {
  const list = ns.filter((d) => !filterType || d.n.type === filterType)
    .slice()
    .sort((a, b) => (a.n.content_at < b.n.content_at ? 1 : -1));
  $('#nav-count').textContent = list.length;
  const box = $('#nav-list'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="empty-nav">还没有节点</div>'; return; }
  list.forEach((d) => {
    const n = d.n;
    const it = el('div', 'node-item' + (selected === n.id ? ' on' : ''));
    it.innerHTML = `<span class="dot" style="background:${n.status === 'superseded' ? '#c8ced5' : (COLOR[n.type] || '#8a97a5')}"></span>
      <span><span class="tx">${n.title}</span><div class="dt">${typeOf(n.type).name} · ${n.content_at}</div></span>`;
    it.onclick = () => {
      selected = n.id; focusOn(n.id);
      flyTo(d.x, d.y, Math.max(cam.k, 1));
      showNode(n.id); renderNav();
    };
    box.appendChild(it);
  });
}

/* ---------------- 详情 ---------------- */
function select(id) {
  selected = id; focusOn(id); showNode(id); renderNav(); draw();
}

function showNode(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  const t = typeOf(n.type);
  $('#d-title').textContent = n.title;
  const body = $('#d-body'); body.innerHTML = '';

  body.appendChild(el('div', '', `<span class="chip">${t.name}</span>` +
    `<span class="chip">${n.content_at}</span>` +
    `<span class="chip ${n.status === 'superseded' ? 'red' : 'green'}">${n.status === 'superseded' ? '已被取代' : '有效'}</span>`));

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
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id });
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
        if (d) { select(d.id); flyTo(d.x, d.y, Math.max(cam.k, 1.2)); }
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
  else if (auto.length) {
    const d = byId.get(auto[auto.length - 1].node_id);
    if (d) { select(d.id); flyTo(d.x, d.y, 1.1); }
  }
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
    if (d) { select(d.id); flyTo(d.x, d.y, 1.1); }
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

  $('#d-close').onclick = () => { $('#drawer').classList.add('hidden'); selected = null; active = null; renderNav(); draw(); };

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
      $('#drawer').classList.add('hidden'); $('#more-menu').classList.add('hidden');
      selected = null; active = null; renderNav(); draw();
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
  rebuild();
  resize();
}

boot();
