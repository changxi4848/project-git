window.__err=null;window.onerror=function(m,src,l,c,e){window.__err=(m+' @'+l+':'+c);};
'use strict';
/* 项目Git · 卡片式提交图（固定布局）+ 详情 + 预览 + AI 指令总线 */

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COLOR = {
  decision: '#D9534F', output: '#C08A3E', plan: '#3F8FC4', retro: '#7C6BC4',
  doc: '#A1785A', data: '#3F9D94', code: '#5F7590',
};
const TYPE_NAME = { decision: '决策', output: '产出', plan: '方案', retro: '复盘', doc: '资料', data: '数据', code: '代码' };

const CARD_W = 230, CARD_H1 = 96, CARD_H2 = 118, CARD_R = 10;
const MAT_H = 46, MAT_GAP = 6;
const GAP_X = 186, GAP_Y = 190;

let S = { projects: [], types: [], nodes: [], edges: [] };
let model = { items: [], links: [], byId: new Map(), bounds: null };
let canvas, ctx, W = 0, H = 0, dpr = 1;
const cam = { x: 0, y: 0, k: 1 };
let curProject = null, selected = null, hovered = null, pvNode = null;
let panning = null, lastPointer = { x: 0, y: 0 };
let LOCKED = true;   // 固定布局：不可拖动节点

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
  installAI();
}

function renderTabs() {
  const box = $('#tabs'); box.innerHTML = '';
  S.projects.forEach((p) => {
    if (!S.nodes.some((x) => x.project === p.id && x.status !== 'deleted')) return;
    const b = document.createElement('button');
    b.className = 'tab' + (p.id === curProject ? ' on' : '');
    b.textContent = p.name;
    b.onclick = () => setProject(p.id);
    box.appendChild(b);
  });
}

function setProject(id) {
  curProject = id; selected = null; hovered = null;
  $('#panel').classList.add('hidden');
  renderTabs(); rebuild();
}

/* ================= 布局（固定、确定性） ================= */
function wrapText(text, maxW, font, maxLines) {
  const LIMIT = maxLines || 2;
  ctx.save(); ctx.font = font;
  const lines = []; let cur = '';
  for (const ch of text) {
    const t = cur + ch;
    if (ctx.measureText(t).width > maxW && cur) {
      if (/[A-Za-z0-9]$/.test(cur) && /[A-Za-z0-9-]/.test(ch)) {
        const cut = cur.lastIndexOf(' ');
        if (cut > 0) { lines.push(cur.slice(0, cut)); cur = cur.slice(cut + 1) + ch; continue; }
      }
      lines.push(cur); cur = ch;
      if (lines.length >= LIMIT) { cur = ''; break; }
    } else cur = t;
  }
  if (cur && lines.length < LIMIT) lines.push(cur);
  ctx.restore();
  return lines.length ? lines : [text];
}

function cardHeight(title) {
  const lines = wrapText(title, CARD_W - 62, '600 15px "Microsoft YaHei"');
  return lines.length > 1 ? CARD_H2 : CARD_H1;
}

function rebuild() {
  const vn = S.nodes.filter((n) => n.status !== 'deleted' && n.project === curProject);
  const byNid = new Map(vn.map((n) => [n.id, n]));
  const TRUNK_TYPES = new Set(['decision', 'output']);

  const trunk = vn.filter((n) => (TRUNK_TYPES.has(n.type) || (n.type === 'plan' && !n.parent)) && (n.branch || 'main') === 'main')
    .sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
  const trunkSet = new Set(trunk.map((n) => n.id));

  const branches = new Map();
  vn.forEach((n) => {
    const b = n.branch || 'main';
    if (b === 'main') return;
    if (!branches.has(b)) branches.set(b, []);
    branches.get(b).push(n);
  });

  // ---------- 材料归属 ----------
  const MAT_TYPES = new Set(['doc', 'data', 'code', 'plan', 'retro']);
  const mats = new Map();
  vn.forEach((n) => {
    if (!MAT_TYPES.has(n.type) || trunkSet.has(n.id)) return;
    if ([...branches.values()].some((l) => l.includes(n))) return;
    let p = byNid.get(n.parent), guard = 0, owner = null;
    while (p && guard++ < 20) { if (trunkSet.has(p.id)) { owner = p.id; break; } p = byNid.get(p.parent); }
    if (!owner) {
      const t = msOf(n.content_at); let best = null, bd = Infinity;
      trunk.forEach((c) => { const d = Math.abs(msOf(c.content_at) - t); if (d < bd) { bd = d; best = c; } });
      owner = best && best.id;
    }
    if (!owner) return;
    if (!mats.has(owner)) mats.set(owner, []);
    mats.get(owner).push(n);
  });

  const MAT_ROW = 52, MAT_PAD = 12, MAT_MORE = 18;
  const boxH = (len) => (len ? Math.min(3, len) * MAT_ROW + MAT_PAD + (len > 3 ? MAT_MORE : 0) : 0);

  // ---------- 分行 ----------
  const PER_ROW = 3;
  const rows = [];
  trunk.forEach((n, i) => {
    const r = Math.floor(i / PER_ROW);
    if (!rows[r]) rows[r] = [];
    rows[r].push(n);
  });

  const items = [], byId = new Map(), boxes = [];
  const rowInfo = [];
  let cursorY = 0;
  const GAP_ROW = 120, BRANCH_GAP = 300;

  rows.forEach((rowNodes, ri) => {
    if (!rowNodes || !rowNodes.length) return;
    const heights = rowNodes.map((n) => cardHeight(n.title));
    const boxHs = rowNodes.map((n) => boxH((mats.get(n.id) || []).length));
    // 行高 = 上半个卡 + 下半个卡（含材料框）
    const halfAbove = Math.max(...heights.map((h) => h / 2), CARD_H1 / 2);
    const halfBelow = Math.max(...heights.map((h, i) => h / 2 + (boxHs[i] ? 26 + boxHs[i] : 0)), CARD_H1 / 2);
    const rowH = halfAbove + halfBelow;

    // 该行是否有分支起点
    const hasBranch = [...branches.values()].some((l) => l.length && l.some((x) => rowNodes.some((r) => r.id === x.id)) );
    const reserve = hasBranch ? BRANCH_GAP : 0;

    const dir = ri % 2 === 0 ? 1 : -1;
    const rowY = cursorY + halfAbove;
    rowNodes.forEach((n, ci) => {
      const col = dir > 0 ? ci : (rowNodes.length - 1 - ci);
      const x = col * (CARD_W + GAP_X) + CARD_W / 2;
      const it = { id: n.id, n, kind: 'commit', row: ri, x, y: rowY, w: CARD_W, h: heights[ci] };
      items.push(it); byId.set(n.id, it);
    });

    rowInfo.push({ y: rowY, h: rowH, halfAbove, halfBelow, hasBranch, dir, nodes: rowNodes });
    cursorY += rowH + GAP_ROW + reserve;
  });

  // ---------- 材料 ----------
  mats.forEach((list, ownerId) => {
    const owner = byId.get(ownerId);
    if (!owner) return;
    const show = list.slice(0, 3);
    const top = owner.y + owner.h / 2 + 26;
    boxes.push({ ownerId, top, items: show, more: list.length - show.length, w: CARD_W, h: boxH(list.length) });
    show.forEach((n, i) => {
      items.push({
        id: n.id, n, kind: 'material', x: owner.x,
        y: top + MAT_PAD / 2 + i * MAT_ROW + MAT_H / 2,
        w: CARD_W - 24, h: MAT_H,
      });
      byId.set(n.id, items[items.length - 1]);
    });
  });

  // ---------- 分支：放在所属行下方，独占一条泳道 ----------
  const binfo = [];
  const usedLaneByRow = new Map();
  [...branches.entries()].forEach(([name, list]) => {
    const sorted = list.slice().sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
    const pNode = byNid.get(sorted[0].parent);
    const pIt = pNode ? byId.get(pNode.id) : null;
    const ri = pIt ? pIt.row : 0;
    const info = rowInfo[ri] || rowInfo[0];
    const laneIdx = usedLaneByRow.get(ri) || 0;
    usedLaneByRow.set(ri, laneIdx + 1);
    const laneY = (info ? info.y + info.halfBelow : 0) + 60 + laneIdx * 150;

    let bx = (pIt ? pIt.x : 0) + 170;
    const ids = [];
    sorted.forEach((n) => {
      const it = {
        id: n.id, n, kind: 'branch', row: ri,
        x: bx, y: laneY, w: CARD_W, h: cardHeight(n.title),
      };
      items.push(it); byId.set(n.id, it); ids.push(n.id);
      bx += CARD_W + 70;
    });
    binfo.push({ name, parentId: pNode ? pNode.id : null, laneY, last: sorted[sorted.length - 1], itemIds: ids, row: ri });
  });

  // ---------- 垂直居中 ----------
  if (items.length) {
    const ys = items.map((it) => it.y);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    items.forEach((it) => { it.y -= mid; });
    boxes.forEach((b) => { b.top -= mid; });
    binfo.forEach((b) => { b.laneY -= mid; });
  }

  model = { items, byId, trunk, binfo, boxes, rowInfo };
  draw(); fit();
}

/* ================= 相机 ================= */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
}

function bounds() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  model.items.forEach((it) => {
    x0 = Math.min(x0, it.x - it.w / 2); x1 = Math.max(x1, it.x + it.w / 2);
    y0 = Math.min(y0, it.y - it.h / 2); y1 = Math.max(y1, it.y + it.h / 2);
  });
  model.boxes.forEach((b) => { if (isFinite(b.top) && isFinite(b.h)) y1 = Math.max(y1, b.top + b.h); });
  return { x0, x1, y0, y1 };
}

function fit() {
  if (!model.items.length) return;
  const b = bounds();
  const padX = 70, padY = 90;
  const k = clamp(Math.min(W / (b.x1 - b.x0 + padX * 2), H / (b.y1 - b.y0 + padY * 2)), 0.25, 1.6);
  cam.k = k;
  cam.x = W / 2 - ((b.x0 + b.x1) / 2) * k;
  cam.y = H / 2 - ((b.y0 + b.y1) / 2) * k;
  draw();
}

function toWorld(sx, sy) { return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]; }

/* ================= 绘制 ================= */
function icon(kind, x, y, s, color) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'decision') {
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'data') {
    ctx.beginPath(); ctx.ellipse(x, y - s * 0.55, s * 0.8, s * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillRect(x - s * 0.8, y - s * 0.55, s * 1.6, s * 1.1);
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.55, s * 0.8, s * 0.3, 0, 0, 7); ctx.fill();
  } else if (kind === 'doc') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8, y + s); ctx.lineTo(x + s * 0.25, y + s);
    ctx.lineTo(x + s * 0.8, y + s * 0.3); ctx.lineTo(x + s * 0.8, y - s);
    ctx.lineTo(x - s * 0.8, y - s); ctx.closePath(); ctx.fill();
  } else if (kind === 'code') {
    ctx.lineWidth = s * 0.3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.25, y - s * 0.5); ctx.lineTo(x - s * 0.7, y); ctx.lineTo(x - s * 0.25, y + s * 0.5);
    ctx.moveTo(x + s * 0.25, y - s * 0.5); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x + s * 0.25, y + s * 0.5);
    ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y, s * 0.75, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(it, hot) {
  const { x, y, w, h, n } = it;
  const dead = n.status === 'abandoned' || n.status === 'superseded';
  const col = dead ? '#B9C2CB' : (COLOR[n.type] || '#8A97A5');
  const x0 = x - w / 2, y0 = y - h / 2;

  // 阴影
  ctx.save(); ctx.fillStyle = 'rgba(16,24,40,0.06)';
  roundRect(x0 + 2, y0 + 5, w, h, CARD_R); ctx.fill(); ctx.restore();

  // 卡体
  roundRect(x0, y0, w, h, CARD_R);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.lineWidth = hot ? 2.4 : 1.6;
  ctx.strokeStyle = col;
  if (dead) ctx.setLineDash([5, 4]);
  ctx.stroke(); ctx.setLineDash([]);

  // 左侧淡色带
  ctx.save();
  ctx.fillStyle = hexA(col, dead ? 0.04 : 0.10);
  roundRect(x0 + 5, y0 + 8, 26, h - 16, 6); ctx.fill();
  // 色条
  ctx.fillStyle = col;
  roundRect(x0 + 11, y0 + 14, 6, h - 28, 3); ctx.fill();
  ctx.restore();

  // 图标
  ctx.save(); ctx.fillStyle = hexA(col, 0.16);
  ctx.beginPath(); ctx.arc(x0 + 46, y, 15, 0, 7); ctx.fill(); ctx.restore();
  icon(n.type, x0 + 46, y, 8, col);

  // 标题
  const lines = wrapText(n.title, w - 66, '600 15px "Microsoft YaHei"');
  ctx.fillStyle = dead ? '#7C8794' : '#0F172A';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = '600 15px "Microsoft YaHei"';
  const titleTop = y - (lines.length * 21) / 2 - 4;
  lines.forEach((ln, i) => ctx.fillText(ln, x0 + 64, titleTop + i * 21));

  // 类型 + 日期（类型放大）
  ctx.font = '700 14px "Microsoft YaHei"';
  const tname = TYPE_NAME[n.type] || n.type;
  ctx.fillStyle = dead ? '#9AA5B1' : col;
  ctx.textBaseline = 'middle';
  ctx.fillText(tname, x0 + 64, y + h / 2 - 18);
  const tw = ctx.measureText(tname).width;
  ctx.font = '400 12px "Microsoft YaHei"';
  ctx.fillStyle = '#8A97A5';
  ctx.fillText('· ' + String(n.content_at).slice(5), x0 + 64 + tw + 8, y + h / 2 - 18);

  // 状态徽标
  if (dead || n.status === 'draft') {
    const label = n.status === 'abandoned' ? '已放弃' : (n.status === 'superseded' ? '已取代' : '草稿');
    ctx.font = '400 10px "Microsoft YaHei"';
    const bw = ctx.measureText(label).width + 14;
    roundRect(x0 + w - bw - 10, y0 + h - 30, bw, 20, 6);
    ctx.fillStyle = '#F3F5F7'; ctx.fill();
    ctx.strokeStyle = '#DCE2E9'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#8D97A3'; ctx.textAlign = 'center';
    ctx.fillText(label, x0 + w - bw / 2 - 10, y0 + h - 20);
    ctx.textAlign = 'left';
  }
  // tag
  if (n.tag) {
    const label = 'tag ' + n.tag;
    ctx.font = '400 10px Consolas,monospace';
    const bw = ctx.measureText(label).width + 14;
    roundRect(x0 + w - bw - 10, y0 + 8, bw, 20, 6);
    ctx.fillStyle = '#FFF7E8'; ctx.fill();
    ctx.strokeStyle = '#E0B96B'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#A5751E'; ctx.textAlign = 'center';
    ctx.fillText(label, x0 + w - bw / 2 - 10, y0 + 18);
    ctx.textAlign = 'left';
  }
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawMaterial(it) {
  const { x, y, w, h, n } = it;
  const col = COLOR[n.type] || '#8A97A5';
  const x0 = x - w / 2, y0 = y - h / 2;
  roundRect(x0, y0, w, h, 7);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#E7EDF3'; ctx.lineWidth = 1; ctx.stroke();
  icon(n.type, x0 + 14, y, 6, col);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '400 12px "Microsoft YaHei"';
  ctx.fillStyle = '#111827';
  ctx.fillText(fitText(n.title, w - 34), x0 + 26, y - 7);
  ctx.font = '700 9.5px "Microsoft YaHei"';
  const tn = TYPE_NAME[n.type] || n.type;
  ctx.fillStyle = col;
  ctx.fillText(tn, x0 + 26, y + 9);
  const tw = ctx.measureText(tn).width;
  ctx.font = '400 9.5px "Microsoft YaHei"';
  ctx.fillStyle = '#9AA5B1';
  ctx.fillText('· ' + n.content_at.slice(5), x0 + 26 + tw + 6, y + 9);
}

function fitText(s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#EDF1F7'; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y); ctx.scale(cam.k, cam.k);

  const trunk = model.trunk || [];
  // ---------- 主干线：同行横连；换行走「右-下-左-下」 ----------
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = model.byId.get(trunk[i].id), b = model.byId.get(trunk[i + 1].id);
    if (!a || !b) continue;
    ctx.strokeStyle = '#C2CEDB'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (a.row === b.row) {
      const y = a.y, dir = b.x > a.x ? 1 : -1;
      const x1 = a.x + dir * (a.w / 2), x2 = b.x - dir * (b.w / 2);
      ctx.moveTo(x1, y); ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y); ctx.lineTo(x2 - dir * 9, y - 4.5); ctx.lineTo(x2 - dir * 9, y + 4.5);
      ctx.closePath(); ctx.fillStyle = '#C2CEDB'; ctx.fill();
    } else {
      const out = 46;
      const ax = a.x + (b.x > a.x ? a.w / 2 : -a.w / 2);
      const midY = (a.y + a.h / 2 + b.y - b.h / 2) / 2;
      ctx.moveTo(ax, a.y);
      ctx.lineTo(ax, midY);
      ctx.lineTo(b.x, midY);
      ctx.lineTo(b.x, b.y - b.h / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - b.h / 2); ctx.lineTo(b.x - 4.5, b.y - b.h / 2 - 9); ctx.lineTo(b.x + 4.5, b.y - b.h / 2 - 9);
      ctx.closePath(); ctx.fillStyle = '#C2CEDB'; ctx.fill();
    }

    // 过渡说明：放在两张卡中间的空隙
    const why = (trunk[i + 1].extra && trunk[i + 1].extra['理由']) || '';
    if (!why) continue;
    const sameRow = a.row === b.row;
    const gapW = sameRow ? Math.abs(b.x - a.x) - (a.w + b.w) / 2 - 26 : 210;
    if (gapW < 100) continue;
    const lines = wrapText(why, gapW, '400 11.5px "Microsoft YaHei"', 3);
    ctx.font = '400 11.5px "Microsoft YaHei"';
    const tw = Math.min(gapW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 20;
    const th = lines.length * 16 + 12;
    const mx = sameRow ? (a.x + b.x) / 2 : b.x;
    const ly = sameRow ? a.y - 18 - th : b.y - b.h / 2 - th - 14;
    roundRect(mx - tw / 2, ly, tw, th, 7);
    ctx.fillStyle = '#F4F7FB'; ctx.fill();
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#4E5A67'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, k) => ctx.fillText(ln, mx, ly + 15 + k * 16));
    ctx.textAlign = 'left';
  }

  // ---------- 分支线：父卡底 → 竖下到泳道 → 横走 → 子卡左缘 ----------
  (model.binfo || []).forEach((b) => {
    const pIt = b.parentId ? model.byId.get(b.parentId) : null;
    const kids = (b.itemIds || []).map((id) => model.byId.get(id)).filter(Boolean);
    if (!pIt || !kids.length) return;
    const first = kids[0], lastK = kids[kids.length - 1];
    const sx = pIt.x, sy = pIt.y + pIt.h / 2;
    const leftEdge = kids[0].x - kids[0].w / 2;
    const rightEdge = lastK.x + lastK.w / 2;
    ctx.strokeStyle = '#A8B6C4'; ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, b.laneY);
    ctx.lineTo(leftEdge, b.laneY);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, 7); ctx.fillStyle = '#A8B6C4'; ctx.fill();

    if (b.last.status === 'abandoned') {
      ctx.strokeStyle = '#BFC9D4'; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(rightEdge + 12, b.laneY); ctx.lineTo(rightEdge + 42, b.laneY); ctx.stroke();
      ctx.setLineDash([]);
      const tx = rightEdge + 46;
      ctx.strokeStyle = '#AEB8C4'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(tx - 5, b.laneY - 5); ctx.lineTo(tx + 5, b.laneY + 5);
      ctx.moveTo(tx + 5, b.laneY - 5); ctx.lineTo(tx - 5, b.laneY + 5);
      ctx.stroke();
      ctx.font = '400 11px "Microsoft YaHei"'; ctx.fillStyle = '#98A5B1';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('尝试终止', tx + 12, b.laneY);
    }
  });

  // ---------- 合并：分支末卡右缘 → 横到目标 → 竖上/下到卡边 ----------
  (model.trunk || []).forEach((n) => {
    const ps = (n.parents && n.parents.length) ? n.parents : (n.parent ? [n.parent] : []);
    if (ps.length < 2) return;
    const it = model.byId.get(n.id);
    const info = (model.binfo || []).find((b) => ps.includes(b.last.id));
    if (!info || !it) return;
    const lastK = (info.itemIds || []).map((id) => model.byId.get(id)).filter(Boolean).pop();
    if (!lastK) return;
    const sxm = lastK.x + lastK.w / 2, sym = info.laneY;
    const tx = it.x, ty = it.y - it.h / 2;
    ctx.strokeStyle = '#9DB4C7'; ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(sxm, sym);
    ctx.lineTo(tx, sym);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty); ctx.lineTo(tx - 4.5, ty - 9); ctx.lineTo(tx + 4.5, ty - 9);
    ctx.closePath(); ctx.fillStyle = '#9DB4C7'; ctx.fill();
  });

  // 材料容器
  (model.boxes || []).forEach((b) => {
    const its = (b.items || []).map((n) => model.byId.get(n.id)).filter(Boolean);
    if (!its.length) return;
    const xs = its.map((i) => i.x), ys = its.map((i) => i.y);
    const hw0 = its[0].w / 2;
    const x0 = Math.min(...xs) - hw0 - 12, x1 = Math.max(...xs) + hw0 + 12;
    const y0 = Math.min(...ys) - its[0].h / 2 - 10, y1 = Math.max(...ys) + its[0].h / 2 + (b.more > 0 ? 22 : 10);
    roundRect(x0, y0, x1 - x0, y1 - y0, 8);
    ctx.fillStyle = '#FBFCFD'; ctx.fill();
    ctx.strokeStyle = '#E6ECF3'; ctx.lineWidth = 1; ctx.stroke();
    const owner = model.byId.get(b.ownerId);
    if (owner) {
      ctx.strokeStyle = '#E1E8F0';
      ctx.beginPath(); ctx.moveTo(owner.x, owner.y + owner.h / 2); ctx.lineTo(owner.x, y0); ctx.stroke();
    }
    if (b.more > 0) {
      const label = '+' + b.more + ' 项';
      ctx.font = '400 10px "Microsoft YaHei"';
      const lw2 = ctx.measureText(label).width + 14;
      roundRect(x1 - lw2 - 8, y1 - 20, lw2, 16, 5);
      ctx.fillStyle = '#F1F4F7'; ctx.fill();
      ctx.fillStyle = '#8A97A5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x1 - lw2 / 2 - 8, y1 - 12);
      ctx.textAlign = 'left';
    }
  });

  function it_w(i) { return i.w; }

  // 项目内所有条目
  model.items.forEach((it) => {
    if (it.kind === 'material') drawMaterial(it);
    else drawCard(it, hovered === it.id || selected === it.id);
  });

  ctx.restore();
}

/* ================= 交互 ================= */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const list = model.items;
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    if (wx >= it.x - it.w / 2 && wx <= it.x + it.w / 2 && wy >= it.y - it.h / 2 && wy <= it.y + it.h / 2) return it;
  }
  return null;
}

function bindUI() {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k2 = clamp(cam.k * Math.exp(-e.deltaY * 0.0012), 0.2, 3);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.k = k2; cam.x = e.offsetX - wx * k2; cam.y = e.offsetY - wy * k2;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    lastPointer = { x: e.offsetX, y: e.offsetY };
    const it = pick(e.offsetX, e.offsetY);
    if (it) { select(it.id); return; }
    if (selected) { selected = null; draw(); }
    const pnEl = document.getElementById('panel'), pvEl = document.getElementById('preview');
    if (pnEl) pnEl.classList.add('hidden');
    if (pvEl) pvEl.classList.add('hidden');
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
  });

  window.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }
    const it = pick(sx, sy);
    const id = it ? it.id : null;
    if (id !== hovered) {
      hovered = id;
      canvas.style.cursor = id ? 'pointer' : 'default';
      draw();
    }
  });

  window.addEventListener('mouseup', () => { panning = null; });

  canvas.addEventListener('dblclick', (e) => {
    const it = pick(e.offsetX, e.offsetY);
    if (it) openPreview(S.nodes.find((n) => n.id === it.id));
  });

  const setBtn = $('#btn-set');
  if (setBtn) setBtn.onclick = openSettings;
  const setSave = $('#set-save');
  if (setSave) setSave.onclick = saveSettings;
  const setReset = $('#set-reset');
  if (setReset) setReset.onclick = async () => {
    if (!confirm('用演示数据覆盖当前数据？（会先备份为 state.bak.json）')) return;
    const r = await window.api.resetState();
    if (r && r.ok) { S = await window.api.state(); renderTabs(); rebuild(); toast('已重置'); $('#set').classList.add('hidden'); }
    else toast('重置失败');
  };
  document.querySelectorAll('[data-set-close]').forEach((b) => { b.onclick = () => $('#set').classList.add('hidden'); });
  const askBtn = $('#btn-ask');
  if (askBtn) askBtn.onclick = () => openAsk();
  const askGo = $('#ask-go');
  if (askGo) askGo.onclick = submitAsk;
  const askClose = $('#ask-close');
  if (askClose) askClose.onclick = closeAsk;
  const askInput = $('#ask-input');
  if (askInput) askInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAsk(); if (e.key === 'Escape') closeAsk(); });
  $('#btn-capture').onclick = () => { $('#modal').classList.remove('hidden'); $('#m-date').valueAsDate = new Date(); $('#m-text').focus(); };
  $('#m-go').onclick = doCapture;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => $('#modal').classList.add('hidden'); });

  const pvc = document.getElementById('pv-close');
  if (pvc) pvc.onclick = closePreview;
  const pve = document.getElementById('pv-extern');
  if (pve) pve.onclick = () => { if (pvNode) window.api.openFileExtern({ nodeId: pvNode.id }); };
  const pc = document.getElementById('p-close');
  if (pc) pc.onclick = () => { selected = null; $('#panel').classList.add('hidden'); draw(); };

  $('#search').addEventListener('input', (e) => { clearTimeout(window._st); window._st = setTimeout(() => doSearch(e.target.value), 200); });
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; $('#search-hint').classList.remove('on'); draw(); }
  });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape') { $('#panel').classList.add('hidden'); $('#preview').classList.add('hidden'); selected = null; draw(); }
    if (e.key === 'f' || e.key === 'F') fit();
  });
}

/* ================= 详情 ================= */
function relation(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return { prev: null, next: null };
  const parents = (n.parents && n.parents.length) ? n.parents : (n.parent ? [n.parent] : []);
  const prevId = parents[0];
  const prev = prevId ? S.nodes.find((x) => x.id === prevId) : null;
  const nextCandidates = S.edges.filter((e) => e.kind === 'derived' && e.to === id)
    .map((e) => S.nodes.find((x) => x.id === e.from))
    .filter((x) => x && x.project === n.project)
    .sort((a, b) => msOf(a.content_at) - msOf(b.content_at));
  const next = nextCandidates[0] || null;
  return { prev, next };
}

function select(id) {
  const n = S.nodes.find((x) => x.id === id);
  if (!n) return;
  selected = id; draw();

  $('#p-title').textContent = n.title;
  $('#p-meta').textContent = `${TYPE_NAME[n.type] || n.type} · ${n.content_at}` +
    (n.tag ? ` · tag ${n.tag}` : '') + (n.status === 'abandoned' ? ' · 已放弃' : '');

  const body = $('#p-body'); body.innerHTML = '';

  // 简介
  body.appendChild(h4('简介'));
  body.appendChild(div('summary', n.summary || '（没有摘要）'));

  // 与上下节点的联系
  const rel = relation(id);
  body.appendChild(h4('与上下节点的联系'));
  const relBox = div('', '');
  if (rel.prev) relBox.appendChild(relRow('上一步', rel.prev, n));
  if (rel.next) relBox.appendChild(relRow('下一步', rel.next, null));
  if (!rel.prev && !rel.next) relBox.appendChild(div('summary', '这是一个孤立的节点。'));
  body.appendChild(relBox);

  // 出处
  const src = n.source || {};
  body.appendChild(h4('出处'));
  if (src.file) {
    const box = div('src', '');
    box.innerHTML = `<div class="src-file">${src.file}</div>`;
    const pathEl = document.createElement('div');
    pathEl.className = 'src-path';
    pathEl.textContent = src.path || ('data/files/' + src.file);
    pathEl.title = '点击在文件夹中显示';
    pathEl.onclick = async () => {
      const r = await window.api.reveal({ nodeId: n.id });
      if (r && r.error) toast(r.error);
      else toast('已在文件夹中选中');
    };
    box.appendChild(pathEl);
    const loc = src.locator || {};
    const locTxt = loc.kind === 'pdf' ? `第 ${loc.page} 页` : (loc.start != null ? `第 ${loc.start}–${loc.end} 字` : '');
    if (locTxt) box.appendChild(div('src-loc', locTxt + ' · 点击路径在文件夹中显示'));
    const ex = div('src-ex', ''); ex.textContent = src.excerpt || '';
    if (src.excerpt) box.appendChild(ex);
    body.appendChild(box);

    const row = document.createElement('div'); row.className = 'btn-row';
    const b1 = document.createElement('button');
    b1.className = 'btn primary small'; b1.textContent = '在应用内打开';
    b1.onclick = () => openPreview(n);
    const b2 = document.createElement('button');
    b2.className = 'btn ghost small'; b2.textContent = '在文件夹中显示';
    b2.onclick = async () => {
      const r = await window.api.reveal({ nodeId: n.id });
      if (r && r.error) toast(r.error);
    };
    row.appendChild(b1); row.appendChild(b2); body.appendChild(row);
  } else {
    body.appendChild(div('summary', '粘贴输入，没有原始文件。'));
  }

  // 字段
  const ex = n.extra || {};
  if (Object.keys(ex).length) {
    body.appendChild(h4('字段'));
    const kv = div('kv', '');
    Object.entries(ex).forEach(([k, v]) => {
      kv.appendChild(div('k', k));
      kv.appendChild(div('', String(v)));
    });
    body.appendChild(kv);
  }

  $('#panel').classList.remove('hidden');
}

function h4(t) { return Object.assign(document.createElement('h4'), { textContent: t }); }
function div(cls, txt) { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = txt; return d; }

function relRow(tag, other, self) {
  const row = document.createElement('div');
  row.className = 'rel-row';
  const t = document.createElement('span'); t.className = 'rel-tag'; t.textContent = tag;
  const name = document.createElement('span'); name.className = 'rel-name'; name.textContent = other.title;
  const why = document.createElement('div'); why.className = 'rel-why';
  why.textContent = (other.extra && other.extra['理由']) ? other.extra['理由'] : '（没有记录原因）';
  row.appendChild(t); row.appendChild(name); row.appendChild(why);
  row.onclick = () => {
    select(other.id);
    const it = model.byId.get(other.id);
    if (it) { cam.x = W / 2 - it.x * cam.k; cam.y = H / 2 - it.y * cam.k; draw(); }
  };
  return row;
}

/* ================= 设置 ================= */
async function openSettings() {
  const el = $('#set');
  el.classList.remove('hidden');
  try {
    const c = await window.api.qaConfig();
    $('#set-base').value = c.baseURL || '';
    $('#set-model').value = c.model || '';
    $('#set-key').value = '';
    $('#set-key').placeholder = c.hasKey ? ('已保存：' + c.keyMask + '（留空则不修改）') : 'sk-...';
    $('#set-tip').textContent = c.hasKey
      ? '已配置模型：' + c.model + '。保存后立即生效。'
      : '未配置时使用本地规划器（离线可用，准确率较低）';
  } catch (e) {}
}
async function saveSettings() {
  const baseURL = $('#set-base').value.trim();
  const model = $('#set-model').value.trim();
  const apiKey = $('#set-key').value.trim();
  const payload = { baseURL, model };
  if (apiKey) payload.apiKey = apiKey;
  const r = await window.api.setQaConfig(payload);
  if (r && r.ok) { toast('已保存'); $('#set').classList.add('hidden'); }
  else toast('保存失败');
}

/* ================= 问一问 ================= */
function esc2(s) { return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function openAsk(preset) {
  const el = $('#ask'); if (!el) return;
  el.classList.remove('hidden');
  const inp = $('#ask-input');
  if (preset) inp.value = preset;
  inp.focus();
  window.api.qaInfo().then((info) => {
    $('#ask-hintline').textContent =
      info.mode === 'model'
        ? `模型：${info.model}（API）· 工具：${info.tools.length} 个`
        : '离线模式：本地规划器（未配置 API key）。答案只基于结构化条目，可评估。';
  }).catch(() => {});
}

function closeAsk() { const el = $('#ask'); if (el) el.classList.add('hidden'); }

async function submitAsk() {
  const q = ($('#ask-input').value || '').trim();
  if (!q) return;
  const body = $('#ask-body');
  body.innerHTML = '<div class="ask-empty">正在查…</div>';
  let r;
  try { r = await window.api.qa({ q }); }
  catch (e) { body.innerHTML = '<div class="ask-empty">出错：' + esc2(e.message) + '</div>'; return; }

  const ans = esc2(r.answer || '（没有答案）')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '<div class="ask-a">' + ans + '</div>';
  if (r.citations && r.citations.length) {
    html += '<div class="ask-cites"><div class="h">引用</div>';
    r.citations.forEach((c) => {
      const loc = c.kind === 'pdf' ? `第 ${c.page} 页` : (c.start != null ? `第 ${c.start}–${c.end} 字` : '');
      html += `<span class="cite" data-file="${esc2(c.file)}" data-id="${esc2(c.id)}" title="点开原文">
        <span class="dot"></span>${esc2(c.file)}${loc ? ' · ' + loc : ''}</span><span class="cite-focus" data-id="${esc2(c.id)}" title="在图上定位">在图上看</span>`;
    });
    html += '</div>';
  }
  html += `<div class="ask-meta">${esc2(r.mode || '')} · ${r.ms || 0}ms${r.trace ? ' · ' + r.trace.length + ' 次工具调用' : ''}</div>`;
  body.innerHTML = html;
  body.querySelectorAll('.cite').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.id;
      const n = S.nodes.find((x) => x.id === id);
      if (n && n.source) { openPreview(n); }
      else toast('这条没有原文');
    };
  });
  body.scrollTop = 0;
}

/* ================= 检索 ================= */
async function doSearch(q) {
  const hint = $('#search-hint');
  if (!q.trim()) { hint.classList.remove('on'); draw(); return; }
  const r = await window.api.search({ q });
  if (r.hits.length) {
    hint.innerHTML = r.hits.slice(0, 6).map((h) =>
      `<div data-id="${h.id}"><div class="t">${h.title}</div><div class="m">${TYPE_NAME[h.type] || h.type}</div></div>`).join('');
    hint.classList.add('on');
    hint.querySelectorAll('div[data-id]').forEach((el) => {
      el.onclick = () => {
        hint.classList.remove('on');
        const it = model.byId.get(el.dataset.id);
        if (it) { select(it.id); cam.x = W / 2 - it.x * cam.k; cam.y = H / 2 - it.y * cam.k; draw(); }
      };
    });
  } else {
    hint.innerHTML = '<div><div class="m">没有找到</div></div>';
    hint.classList.add('on');
  }
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

/* ================= 预览 ================= */
function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function sanitize(h) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
          .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
          .replace(/javascript:/gi, '');
}

async function openPreview(n) {
  if (!n) return;
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
    box.appendChild(div('summary', 'PDF 暂不支持应用内预览（下一版接独立 PDF 视图），先用「外部打开」。'));
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

/* =================================================================
   AI 指令总线：window.__PG__.exec(cmd, args)
   - 所有命令都返回纯 JSON，可被外部脚本 / MCP / 自动化直接调用
   - main 进程里的 ai:exec 也转发到这里
   ================================================================= */
const AI_COMMANDS = {
  ping: () => ({ ok: true, ts: Date.now() }),

  graph: () => ({
    project: curProject,
    projects: S.projects.map((p) => ({ id: p.id, name: p.name })),
    nodes: model.items.map((it) => ({
      id: it.id, kind: it.kind, title: it.n.title, type: it.n.type,
      date: it.n.content_at, status: it.n.status, tag: it.n.tag || null,
      x: Math.round(it.x), y: Math.round(it.y),
    })),
    trunk: model.trunk.map((n) => n.id),
    branches: model.binfo.map((b) => ({ name: b.name, items: b.items ? b.items.map((i) => i.id) : [] })),
    links: S.edges.filter((e) => e.kind !== 'uses').map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
  }),

  node: ({ id }) => {
    const n = S.nodes.find((x) => x.id === id);
    if (!n) return { ok: false, error: 'no such node: ' + id };
    const rel = relation(id);
    return { ok: true, node: n, prev: rel.prev && rel.prev.id, next: rel.next && rel.next.id };
  },

  focus: ({ id }) => {
    const it = model.byId.get(id);
    if (!it) return { ok: false, error: 'no such node: ' + id };
    select(id);
    cam.x = W / 2 - it.x * cam.k; cam.y = H / 2 - it.y * cam.k; draw();
    return { ok: true, id };
  },

  open: async ({ id }) => {
    const n = S.nodes.find((x) => x.id === id);
    if (!n) return { ok: false, error: 'no such node: ' + id };
    await openPreview(n);
    return { ok: true, id };
  },

  search: async ({ q }) => {
    const r = await window.api.search({ q });
    return { ok: true, ...r };
  },

  project: ({ id }) => { setProject(id); return { ok: true, project: id }; },

  fit: () => { fit(); return { ok: true, k: cam.k }; },

  capture: async ({ text, date }) => {
    const r = await window.api.capture({ text, date: date || null });
    S = await window.api.state();
    renderTabs(); rebuild();
    return { ok: true, ...r };
  },

  reveal: async ({ id }) => window.api.reveal({ nodeId: id }),

  select: ({ id }) => { select(id); return { ok: true, id }; },

  state: () => ({ ok: true, project: curProject, selected, locked: LOCKED, k: cam.k }),

  ask: async ({ q }) => {
    const r = await window.api.qa({ q });
    return { ok: true, ...r };
  },

  commands: () => ({ ok: true, commands: Object.keys(AI_COMMANDS) }),
};

function installAI() {
  window.__PG__ = {
    exec(cmd, args) {
      const fn = AI_COMMANDS[cmd];
      if (!fn) return { ok: false, error: 'unknown command: ' + cmd, available: Object.keys(AI_COMMANDS) };
      try { return fn(args || {}); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    },
    commands: () => Object.keys(AI_COMMANDS),
    // 便捷方法
    focus: (id) => window.__PG__.exec('focus', { id }),
    node: (id) => window.__PG__.exec('node', { id }),
    graph: () => window.__PG__.exec('graph'),
  };
}

boot().catch(function(e){ window.__err = String((e && e.stack) || e); });
