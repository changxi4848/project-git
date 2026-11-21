# -*- coding: utf-8 -*-
"""ELK 单行分层布局（不折行）
   - 方向从左到右；父在左、子在右
   - 节点尺寸含标签区，ELK 按真实尺寸避让
   - 层内顺序由 ELK 重心排序决定，交叉最小化
"""
import io

# 1) 引入 elk
p_html = r"D:/03_code_list/project-git-项目知识时间轴/desktop/web/index.html"
h = io.open(p_html, encoding="utf-8").read()
if "elk.bundled.js" not in h:
    h = h.replace('<script src="./vendor/d3.min.js"></script>',
                  '<script src="./vendor/d3.min.js"></script>\n<script src="./vendor/elk.bundled.js"></script>')
    io.open(p_html, "w", encoding="utf-8").write(h)

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

s = s.replace("function rebuild() {\n  const vn = visibleNodes();", "async function rebuild() {\n  const vn = visibleNodes();")

i1 = s.index("  // —— 1. 主干：分行直线，行内按时间拉开 ——")
i2 = s.index("  if (sim) { sim.stop(); sim = null; }")
new = '''  // —— ELK 分层布局（单行，不折行） ——
  const chain = longestChain(vn);
  chainSet = new Set(chain);
  const LABEL_BLOCK = 46;
  ns.forEach((d) => {
    d.main = chainSet.has(d.id);
    d.w = 156;
    d.h = d.r * 2 + 8 + LABEL_BLOCK;
  });

  const layoutGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(84 * DENS)),
      'elk.spacing.nodeNode': String(Math.round(30 * DENS)),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeRouting': 'NONE',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
    },
    children: ns.map((d) => ({ id: d.id, width: d.w, height: d.h })),
    // 我们的边是 子→父，ELK 里反过来：父在左，子在右
    edges: ls.map((l, i) => ({ id: 'e' + i, sources: [l.target], targets: [l.source] })),
  };

  let placed = false;
  try {
    const res = await new ELK().layout(layoutGraph);
    if (res && res.children) {
      res.children.forEach((c) => {
        const d = byId.get(c.id);
        if (!d) return;
        d.x = c.x + c.width / 2;
        d.y = c.y + c.height / 2;
      });
      placed = true;
    }
  } catch (err) {
    console.warn('ELK 布局失败，退回时间顺序', err);
  }
  if (!placed) {
    ns.forEach((d, i) => { d.x = i * Math.round(190 * DENS); d.y = 0; });
  }
  // 垂直居中
  const ys0 = ns.map((d) => d.y);
  const midY = (Math.min(...ys0) + Math.max(...ys0)) / 2;
  ns.forEach((d) => { d.y -= midY; });

'''
s = s[:i1] + new + s[i2:]

# rebuild 结尾：布局完成后统一绘制 + 适配
s = s.replace("  renderNav();\n  draw();\n  setTimeout(fit, 300);\n}",
              "  renderNav();\n  draw();\n  fit();\n}")
s = s.replace("  renderNav();\n  draw();\n  fit();\n}\n\nfunction deoverlap", "  renderNav();\n  draw();\n  fit();\n}\n\nfunction deoverlap")

# fit：允许更小的缩放，保证整条线能进视口
s = s.replace("  k = clamp(k, 0.4, 1.0);", "  k = clamp(k, 0.18, 1.0);")

# 标签：缩放太小就只留主干
s = s.replace("const show = (d.main || cam.k > 0.5 || isSel || isHov || (focus && focus.has(n.id)));",
              "const show = (d.main || cam.k > 0.5 || isSel || isHov || (focus && focus.has(n.id)));")

# boot / 交互处 await
s = s.replace("  resize();\n  rebuild();\n  requestAnimationFrame(() => { resize(); fit(); });",
              "  resize();\n  await rebuild();\n  requestAnimationFrame(() => { resize(); fit(); });")
s = s.replace("b.onclick = () => { mode = 'one'; curProject = p.id; rebuild(); };",
              "b.onclick = async () => { mode = 'one'; curProject = p.id; await rebuild(); };")
s = s.replace("all.onclick = () => { mode = 'all'; rebuild(); };",
              "all.onclick = async () => { mode = 'all'; await rebuild(); };")

io.open(p, "w", encoding="utf-8").write(s)
print("ok")
