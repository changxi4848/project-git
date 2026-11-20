# -*- coding: utf-8 -*-
"""1) 拖动不再触发重排（折线的根源是拖一下就 restart 力导向）
   2) 隐形引用线：uses 不进力导向，只在悬停/拖动该资源时显示
"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---------- 1) 拆分：参与力的边 / 不参与力的隐形边 ----------
old = """  ls = S.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));"""
new = """  const allEdges = S.edges.filter((e) => byId.has(e.from) && byId.has(e.to));
  // uses = 隐形引用线：只画、不参与力
  ls = allEdges.filter((e) => e.kind !== 'uses')
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));
  hls = allEdges.filter((e) => e.kind === 'uses')
    .map((e) => ({ source: e.from, target: e.to, kind: 'uses' }));"""
assert old in s
s = s.replace(old, new)

s = s.replace("let sim = null, ns = [], ls = [], byId = new Map();",
              "let sim = null, ns = [], ls = [], hls = [], byId = new Map();")

# ---------- 2) 拖动：只移动自己，不重排 ----------
s = s.replace("""      if (dragInfo.moved) {
        const [wx, wy] = toWorld(sx, sy);
        dragInfo.d.fx = wx; dragInfo.d.fy = wy;
        if (sim) sim.alpha(0.25).restart();
      }""",
"""      if (dragInfo.moved) {
        const [wx, wy] = toWorld(sx, sy);
        dragInfo.d.fx = wx; dragInfo.d.fy = wy;
        dragInfo.d.x = wx; dragInfo.d.y = wy;   // 直接移动，不触发重排
      }""")

s = s.replace("""        if (edit && over && over.id !== d.id) {""",
"""        if (edit && over && over.id !== d.id) {""")

# 拖完只有“改父节点”才重排；否则把节点钉在原处
s = s.replace("""        if (sim) sim.alpha(0.2).restart();
      } else select(d.id);""",
"""        if (!edit) { d.fx = null; d.fy = null; }   // 松手后就地固定，不重排
      } else select(d.id);""")

# ---------- 3) 按下即聚焦（拖动时也能看到它的引用）----------
s = s.replace("    if (d) { dragInfo = { d, start: { x: e.offsetX, y: e.offsetY }, moved: false }; return; }",
              "    if (d) { focusOn(d.id); draw(); dragInfo = { d, start: { x: e.offsetX, y: e.offsetY }, moved: false }; return; }")

# ---------- 4) 画隐形引用线：只在聚焦时出现 ----------
s = s.replace("""  ns.forEach((d) => drawNode(d, focus));""",
"""  // 隐形引用线：只有聚焦（悬停/选中/拖动）时才显现
  if (focus) {
    hls.forEach((l) => {
      const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
      if (!a || !b) return;
      if (!focus.has(a.id) || !focus.has(b.id)) return;
      const p1 = edgePoint(a, b), p2 = edgePoint(b, a);
      ctx.save();
      ctx.strokeStyle = 'rgba(90,140,170,0.55)';
      ctx.lineWidth = 1.1 / cam.k;
      ctx.setLineDash([2 / cam.k, 5 / cam.k]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p2.x, p2.y, 3 / cam.k, 0, 7);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = 'rgba(90,140,170,0.75)'; ctx.lineWidth = 1.2 / cam.k; ctx.stroke();
      ctx.restore();
    });
  }

  ns.forEach((d) => drawNode(d, focus));""")

# ---------- 5) 详情里把 uses 说成人话 ----------
s = s.replace("const kt = { derived: '属于', supersedes: '取代', relates: '相关', attach: '证据' }[e.kind] || e.kind;",
              "const kt = { derived: '属于', supersedes: '取代', relates: '相关', attach: '证据', uses: '被引用' }[e.kind] || e.kind;")

io.open(p, "w", encoding="utf-8").write(s)
print("app ok")
