# -*- coding: utf-8 -*-
"""重写 rebuild 几何与连线绘制：折行 + 材料高度预留 + 分支泳道在行下方 + 正交连线"""
import io, re

p = r"D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---------- 1) 替换 rebuild 的几何部分 ----------
start = s.index("function rebuild() {")
end = s.index("/* ================= 相机 ================= */")
new_rebuild = r'''function rebuild() {
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
    const cardMax = Math.max(...heights, CARD_H1);
    const boxMax = Math.max(...boxHs, 0);
    const rowH = Math.max(cardMax, boxMax + 24);

    // 该行是否有分支起点
    const hasBranch = [...branches.values()].some((l) => l.length && l.some((x) => rowNodes.some((r) => r.id === x.id)) );
    const reserve = hasBranch ? BRANCH_GAP : 0;

    const dir = ri % 2 === 0 ? 1 : -1;
    rowNodes.forEach((n, ci) => {
      const col = dir > 0 ? ci : (rowNodes.length - 1 - ci);
      const x = col * (CARD_W + GAP_X) + CARD_W / 2;
      const it = { id: n.id, n, kind: 'commit', row: ri, x, y: cursorY, w: CARD_W, h: heights[ci] };
      items.push(it); byId.set(n.id, it);
    });

    rowInfo.push({ y: cursorY, h: rowH, hasBranch, dir, nodes: rowNodes });
    cursorY += rowH / 2 + GAP_ROW + reserve + rowH / 2 * 0;
  });

  // ---------- 材料 ----------
  mats.forEach((list, ownerId) => {
    const owner = byId.get(ownerId);
    if (!owner) return;
    const show = list.slice(0, 3);
    const top = owner.y + owner.h / 2 + 26;
    boxes.push({ ownerId, top, items: show, more: list.length - show.length, w: CARD_W });
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
    const laneY = (info ? info.y + info.h / 2 : 0) + 70 + laneIdx * 150;

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

'''
s = s[:start] + new_rebuild + s[end:]

# ---------- 2) 替换连线绘制 ----------
lstart = s.index("  // 主干线")
lend = s.index("  // 材料容器")
new_links = r'''  // ---------- 主干线：同行横连；换行走「右-下-左-下」 ----------
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

'''
s = s[:lstart] + new_links + s[lend:]

io.open(p, "w", encoding="utf-8").write(s)
print("rewrote rebuild + links")
