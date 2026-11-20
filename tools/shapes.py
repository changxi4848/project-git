# -*- coding: utf-8 -*-
"""节点回到“纯图形”：七类七种形状、大小不一；标签放在图形下方；间距大幅拉开"""
import io, re

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---------- 1) 主干：行内按时间给不同间距 ----------
i1 = s.index("  // —— 主干：分行的直线")
i2 = s.index("  chainSet = new Set(chain);")
new_spine = """  // —— 主干：分行直线，行内间距按时间拉开（不是等距） ——
  const chain = longestChain(vn);
  const MIN_GAP = 250;              // 相邻主干节点的最小间距
  const perRow = chain.length <= 4 ? chain.length : (chain.length <= 8 ? 4 : 5);
  const rows = Math.ceil(chain.length / perRow);
  const ROW_H = 300;                // 行距（要能放下标签和第二行）
  const yBase = -((rows - 1) * ROW_H) / 2;
  chain.forEach((id, i) => {
    const d = byId.get(id);
    if (!d) return;
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const first = row * perRow;
    const n = Math.min(perRow, chain.length - first);
    const rowIds = chain.slice(first, first + n);
    const ts = rowIds.map((rid) => msOf(byId.get(rid).n.content_at) || 0);
    const tMin = Math.min(...ts), tSpan = Math.max(1, Math.max(...ts) - tMin);
    const extra = 130;
    const xs = ts.map((t, k) => k * MIN_GAP + ((t - tMin) / tSpan) * extra);
    const width = xs[xs.length - 1] || 0;
    let x = xs[col] - width / 2;
    if (row % 2 === 1) x = -x;                        // 蛇形
    d.fx = x;
    d.fy = yBase + row * ROW_H;
    d.main = true;
    d.row = row;
  });
"""
s = s[:i1] + new_spine + s[i2:]

# ---------- 2) 力参数：拉开 ----------
s = s.replace(".force('link', d3.forceLink(ls).id((d) => d.id).distance(150).strength(0.35))",
              ".force('link', d3.forceLink(ls).id((d) => d.id).distance(260).strength(0.22))")
s = s.replace(".force('charge', d3.forceManyBody().strength(-620).distanceMax(900))",
              ".force('charge', d3.forceManyBody().strength(-2600).distanceMax(1800))")
s = s.replace(".force('collide', d3.forceCollide().radius((d) => (d.main ? 105 : 96)).iterations(2))",
              ".force('collide', d3.forceCollide().radius((d) => (d.r + 62)).iterations(2))")
s = s.replace(".force('y', d3.forceY((d) => (d.main ? 0 : (d.y >= 0 ? 210 : -210))).strength(0.06))",
              ".force('y', d3.forceY((d) => (d.main ? d.fy : (d.y >= 0 ? 330 : -330))).strength(0.05))")

# ---------- 3) 节点尺寸：按类型 + 连接数 ----------
s = s.replace("""  ns = vn.map((n) => ({
    id: n.id, n,
    w: CARD_W, h: CARD_H,""",
"""  const degTmp = new Map();
  S.edges.forEach((e) => { degTmp.set(e.from, (degTmp.get(e.from) || 0) + 1); degTmp.set(e.to, (degTmp.get(e.to) || 0) + 1); });
  const BASE_R = { decision: 15, output: 14, plan: 12, retro: 11, data: 11, doc: 10, code: 10, asset: 10, version: 10 };
  ns = vn.map((n) => ({
    id: n.id, n,
    r: (BASE_R[n.type] || 10) + Math.min(6, Math.sqrt(degTmp.get(n.id) || 0) * 2),
    w: (BASE_R[n.type] || 10) * 2 + 24, h: (BASE_R[n.type] || 10) * 2 + 20,""")

# ---------- 4) 绘制：图形节点 + 标签 ----------
j1 = s.index("function drawNode(d, focus) {")
j2 = s.index("function truncate(")
new_node = r'''/* 七类节点，七种形状；标签在图形下方 */
function shapePath(type, r) {
  ctx.beginPath();
  if (type === 'decision') {                    // 六边形
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  } else if (type === 'retro') {                // 方形（圆角）
    roundRect(ctx, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84, r * 0.28);
  } else if (type === 'doc') {                  // 折角纸
    const c = r * 0.7;
    ctx.moveTo(-r, -r);
    ctx.lineTo(r - c, -r);
    ctx.lineTo(r, -r + c);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.closePath();
  } else if (type === 'data') {                 // 胶囊
    const h = r * 1.5, w = r * 2.4;
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  } else if (type === 'code') {                 // 标签
    ctx.moveTo(-r, -r * 0.8);
    ctx.lineTo(r * 0.55, -r * 0.8);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.55, r * 0.8);
    ctx.lineTo(-r, r * 0.8);
    ctx.closePath();
  } else if (type === 'output') {               // 五角星
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 1.15 : r * 0.5;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  } else {                                      // 方案：圆
    ctx.arc(0, 0, r, 0, 7);
  }
}

function drawNode(d, focus) {
  const n = d.n;
  const on = !focus || focus.has(n.id);
  const abandoned = n.status === 'abandoned';
  const sup = n.status === 'superseded';
  const col = abandoned || sup ? '#b9c2cb' : (COLOR[n.type] || '#8a97a5');
  const isSel = selected === n.id, isHov = hovered === n.id;

  ctx.globalAlpha = on ? 1 : 0.16;
  ctx.save();
  ctx.translate(d.x, d.y);

  if (isSel || isHov) {
    ctx.save();
    ctx.shadowColor = 'rgba(17,24,39,.22)'; ctx.shadowBlur = 18;
    shapePath(n.type, d.r + 3);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }

  shapePath(n.type, d.r);
  ctx.fillStyle = abandoned ? '#f2f4f6' : (FILL[n.type] || '#fff');
  ctx.fill();
  ctx.lineWidth = (isSel || isHov ? 2.4 : 1.6) / cam.k;
  ctx.strokeStyle = col;
  if (abandoned) ctx.setLineDash([5 / cam.k, 4 / cam.k]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 产出：双边框
  if (n.type === 'output') {
    shapePath(n.type, d.r + 3.5);
    ctx.lineWidth = 1 / cam.k;
    ctx.strokeStyle = col + '88';
    ctx.stroke();
  }

  // 放弃标记：一道斜杠
  if (abandoned) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.6 / cam.k;
    const k = d.r * 0.7;
    ctx.beginPath(); ctx.moveTo(-k, k); ctx.lineTo(k, -k); ctx.stroke();
  }
  ctx.restore();

  // 标签（图形下方）
  const show = cam.k > 0.42 || isSel || isHov || (focus && focus.has(n.id));
  if (show) {
    const fs = 12 / cam.k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `${isSel ? 600 : 500} ${fs}px "Microsoft YaHei",sans-serif`;
    const title = n.title.length > 13 ? n.title.slice(0, 13) + '…' : n.title;
    const ty = d.y + d.r + 12 / cam.k;
    ctx.fillStyle = abandoned ? '#9aa5b1' : (isSel ? '#111827' : '#374151');
    ctx.fillText(title, d.x, ty);
    ctx.font = `${10.5 / cam.k}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#9aa5b1';
    ctx.fillText(`${typeOf(n.type).name} · ${n.content_at}`, d.x, ty + fs + 3 / cam.k);
    if (abandoned) {
      ctx.fillStyle = '#aeb8c2';
      ctx.fillText('已放弃', d.x, ty + fs + 3 / cam.k + 14 / cam.k);
    }
  }
  ctx.globalAlpha = 1;
}

'''
s = s[:j1] + new_node + s[j2:]

# 边从图形边界出发（用 r 而不是 w/h）
s = s.replace("""  const hw = (from.w || 40) / 2, hh = (from.h || 20) / 2;""",
              """  const hw = (from.r || 12), hh = (from.r || 12);""")

io.open(p, "w", encoding="utf-8").write(s)
print("ok", len(s))
