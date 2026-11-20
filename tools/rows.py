# -*- coding: utf-8 -*-
"""主干改成分行排布（每行一条直线，行尾用直角连接），避免整条线拉得太长看不清"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

old = """  // —— 主干：钉在一条水平线上 ——
  const chain = longestChain(vn);
  const PITCH = CARD_W + 52;
  const x0 = -((chain.length - 1) * PITCH) / 2;
  chain.forEach((id, i) => {
    const d = byId.get(id);
    if (!d) return;
    d.fx = x0 + i * PITCH;
    d.fy = 0;
    d.main = true;
  });
  chainSet = new Set(chain);"""

new = """  // —— 主干：分行的直线（像文字换行），行尾直角连接 ——
  const chain = longestChain(vn);
  const PITCH = CARD_W + 34;          // 行内间距
  const ROW_H = CARD_H + 74;          // 行距
  const perRow = chain.length <= 5 ? chain.length : (chain.length <= 10 ? 5 : 6);
  const rows = Math.ceil(chain.length / perRow);
  const yBase = -((rows - 1) * ROW_H) / 2;
  chain.forEach((id, i) => {
    const d = byId.get(id);
    if (!d) return;
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const dir = row % 2 === 0 ? 1 : -1;                 // 蛇形：奇数行反向
    const n = Math.min(perRow, chain.length - row * perRow);
    const x = (col - (n - 1) / 2) * PITCH * dir;
    d.fx = x;
    d.fy = yBase + row * ROW_H;
    d.main = true;
    d.mainIdx = i;
    d.row = row;
  });
  chainSet = new Set(chain);
  LROW = { perRow, ROW_H, yBase, rows };"""

assert old in s
s = s.replace(old, new)

# 让分行信息对绘制可见
s = s.replace("let chainSet = new Set();", "let chainSet = new Set();\nlet LROW = { perRow: 6, ROW_H: 130, yBase: 0, rows: 1 };")

# 主干上的行尾换行：画直角连接（下 → 横 → 下），其余仍是直线
old_edge = """  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;"""
new_edge = """  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;

    // 主干换行处：直角连接
    if (a.main && b.main && Math.abs(a.fy - b.fy) > 20 && l.kind === 'derived') {
      const on2 = !focus || (focus.has(a.id) && focus.has(b.id));
      ctx.globalAlpha = on2 ? 1 : 0.14;
      ctx.strokeStyle = 'rgba(158,170,183,0.6)';
      ctx.lineWidth = 1 / cam.k;
      const yMid = (a.y + b.y) / 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + a.h / 2);
      ctx.lineTo(a.x, yMid);
      ctx.lineTo(b.x, yMid);
      ctx.lineTo(b.x, b.y - b.h / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }"""
assert old_edge in s
s = s.replace(old_edge, new_edge)

# 主干基线只在单行时画
s = s.replace("  if (mainNodes.length > 1) {", "  if (mainNodes.length > 1 && LROW.rows === 1) {")

io.open(p, "w", encoding="utf-8").write(s)
print("ok")
