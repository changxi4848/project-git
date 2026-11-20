# -*- coding: utf-8 -*-
"""回调密度 + 恢复主干直线视觉 + 连线分类型（主干实线 / 资源附庸虚线 / 取代红线）"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---- 间距与力：密度回调，别散成一盘沙 ----
s = s.replace("const MIN_GAP = 250;", "const MIN_GAP = 205;")
s = s.replace("const ROW_H = 300;", "const ROW_H = 245;")
s = s.replace(".force('link', d3.forceLink(ls).id((d) => d.id).distance(260).strength(0.22))",
              ".force('link', d3.forceLink(ls).id((d) => d.id).distance(200).strength(0.3))")
s = s.replace(".force('charge', d3.forceManyBody().strength(-2600).distanceMax(1800))",
              ".force('charge', d3.forceManyBody().strength(-1150).distanceMax(1100))")
s = s.replace(".force('collide', d3.forceCollide().radius((d) => (d.r + 62)).iterations(2))",
              ".force('collide', d3.forceCollide().radius((d) => (d.r + 44)).iterations(2))")
s = s.replace(".force('y', d3.forceY((d) => (d.main ? d.fy : (d.y >= 0 ? 330 : -330))).strength(0.05))",
              ".force('y', d3.forceY((d) => (d.main ? d.fy : (d.y >= 0 ? 265 : -265))).strength(0.06))")

# ---- fit：别缩得太小，保证标签能看清 ----
s = s.replace("  k = clamp(k, 0.3, 1.0);", "  k = clamp(k, 0.55, 1.0);")
s = s.replace("  const pad = 170;", "  const pad = 150;")

# ---- 标签更早出现 ----
s = s.replace("const show = cam.k > 0.42 ||", "const show = cam.k > 0.3 ||")

# ---- 主干：每行画一条淡基线 ----
s = s.replace("""  if (mainNodes.length > 1 && LROW.rows === 1) {
    const xs = mainNodes.map((d) => d.x);
    ctx.strokeStyle = 'rgba(120,132,146,0.22)';
    ctx.lineWidth = 1.4 / cam.k;
    ctx.beginPath();
    ctx.moveTo(Math.min(...xs) - CARD_W / 2, 0);
    ctx.lineTo(Math.max(...xs) + CARD_W / 2, 0);
    ctx.stroke();
  }""",
"""  if (mainNodes.length > 1) {
    const byRow = new Map();
    mainNodes.forEach((d) => {
      const r = Math.round(d.fy);
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r).push(d);
    });
    byRow.forEach((list, y) => {
      list.sort((a, b) => a.x - b.x);
      ctx.strokeStyle = 'rgba(120,132,146,0.28)';
      ctx.lineWidth = 1.6 / cam.k;
      ctx.beginPath();
      ctx.moveTo(list[0].x - 26, y);
      ctx.lineTo(list[list.length - 1].x + 26, y);
      ctx.stroke();
    });
  }""")

# ---- 连线分类型 ----
old_edge_head = """    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const isSup = l.kind === 'supersedes';
    const dead = a.n.status === 'abandoned' || b.n.status === 'abandoned';"""
new_edge_head = """    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const isSup = l.kind === 'supersedes';
    const dead = a.n.status === 'abandoned' || b.n.status === 'abandoned';
    // 资源附庸：文档/数据/代码/产出 挂到主干上
    const RES = ['doc', 'data', 'code', 'output', 'asset'];
    const side = RES.includes(a.n.type) ? a : (RES.includes(b.n.type) ? b : null);
    const owner = side === a ? b : (side === b ? a : null);
    const isResLink = !!(side && owner && (owner.main || side.main));"""
assert old_edge_head in s
s = s.replace(old_edge_head, new_edge_head)

# 样式选择：主干实线 / 资源附庸虚线 / 其它
s = s.replace("""    ctx.globalAlpha = on ? 1 : 0.14;
    ctx.strokeStyle = isSup ? 'rgba(217,83,79,0.7)' : (dead ? 'rgba(178,186,196,0.6)' : 'rgba(158,170,183,0.55)');
    ctx.lineWidth = (isSup ? 1.8 : 1) / cam.k;""",
"""    ctx.globalAlpha = on ? 1 : 0.14;
    if (isSup) { ctx.strokeStyle = 'rgba(217,83,79,0.75)'; ctx.lineWidth = 1.9 / cam.k; }
    else if (isResLink) { ctx.strokeStyle = 'rgba(150,160,172,0.75)'; ctx.lineWidth = 1.1 / cam.k; }
    else if (dead) { ctx.strokeStyle = 'rgba(178,186,196,0.6)'; ctx.lineWidth = 1 / cam.k; }
    else { ctx.strokeStyle = 'rgba(120,134,150,0.7)'; ctx.lineWidth = 1.5 / cam.k; }""")

# 资源附庸线用虚线（不改死线逻辑）
s = s.replace("""      ctx.setLineDash(l.kind === 'relates' || l.kind === 'attach' ? [4 / cam.k, 4 / cam.k] : []);""",
"""      ctx.setLineDash((l.kind === 'relates' || l.kind === 'attach' || isResLink) ? [5 / cam.k, 4 / cam.k] : []);""")

io.open(p, "w", encoding="utf-8").write(s)
print("ok")
