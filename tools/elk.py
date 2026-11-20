# -*- coding: utf-8 -*-
"""用 ELK.js 的分层布局替换手写布局
   - 方向：从左到右（决策 → 后续）
   - 节点尺寸含标签区，ELK 会按真实尺寸避让，标签不再压字
   - 层内顺序由 ELK 的重心排序决定，交叉数被最小化
"""
import io

# ---------- 1) index.html 引入 elk ----------
p_html = r"D:/03_code_list/project-git-项目知识时间轴/desktop/web/index.html"
h = io.open(p_html, encoding="utf-8").read()
if "elk.bundled.js" not in h:
    h = h.replace('<script src="./vendor/d3.min.js"></script>',
                  '<script src="./vendor/d3.min.js"></script>\n<script src="./vendor/elk.bundled.js"></script>')
    io.open(p_html, "w", encoding="utf-8").write(h)
    print("html ok")

# ---------- 2) app.js：替换布局 ----------
p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

s = s.replace("function rebuild() {\n  const vn = visibleNodes();", "async function rebuild() {\n  const vn = visibleNodes();")

i1 = s.index("  // —— 1. 主干：分行直线，行内按时间拉开 ——")
i2 = s.index("  if (sim) { sim.stop(); sim = null; }")
new = '''  // —— 用 ELK 做分层布局 ——
  const chain = longestChain(vn);
  chainSet = new Set(chain);
  const LABEL_BLOCK = 46;                        // 标签占的高度
  ns.forEach((d) => {
    d.main = chainSet.has(d.id);
    d.w = 158;                                   // 固定宽，保证标签放得下
    d.h = d.r * 2 + 10 + LABEL_BLOCK;
  });

  const elk = new ELK();
  const layoutGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(96 * DENS)),
      'elk.spacing.nodeNode': String(Math.round(34 * DENS)),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeRouting': 'NONE',
      'elk.padding': '[top=30,left=30,bottom=30,right=30]',
    },
    children: ns.map((d) => ({ id: d.id, width: d.w, height: d.h })),
    // 注意：我们的边是 子→父，ELK 里反过来，让“父”在左、“子”在右
    edges: ls.map((l, i) => ({ id: 'e' + i, sources: [l.target], targets: [l.source] })),
  };

  let res = null;
  try {
    res = await elk.layout(layoutGraph);
  } catch (err) {
    console.warn('ELK 布局失败，退回时间顺序', err);
  }

  if (res && res.children) {
    res.children.forEach((c) => {
      const d = byId.get(c.id);
      if (!d) return;
      d.x = c.x + c.width / 2;
      d.y = c.y + c.height / 2;
    });
  } else {
    // 兜底：按时间排一行
    ns.forEach((d, i) => { d.x = i * 200; d.y = 0; });
  }

'''
s = s[:i1] + new + s[i2:]

# rebuild 结尾：布局完成后再画 + 适配
s = s.replace("""  selected = null; hovered = null; active = null;
  $('#drawer').classList.add('hidden');
  renderNav();
  draw();
  setTimeout(fit, 300);
}""",
"""  selected = null; hovered = null; active = null;
  $('#drawer').classList.add('hidden');
  renderNav();
  draw();
  fit();
}""")

# boot 里等布局完成
s = s.replace("  resize();\n  rebuild();\n  requestAnimationFrame(() => { resize(); fit(); });",
              "  resize();\n  await rebuild();\n  requestAnimationFrame(() => { resize(); fit(); });")

# 切项目 / 收进来等调用点：await
s = s.replace("b.onclick = () => { mode = 'one'; curProject = p.id; rebuild(); };",
              "b.onclick = async () => { mode = 'one'; curProject = p.id; await rebuild(); };")
s = s.replace("all.onclick = () => { mode = 'all'; rebuild(); };",
              "all.onclick = async () => { mode = 'all'; await rebuild(); };")
s = s.replace("      rebuild();\n      toast('疏密：'", "      rebuild().then(() => toast('疏密：'")
s = s.replace("(DENS < 1 ? '紧凑' : DENS < 1.2 ? '标准' : '宽松'));", "(DENS < 1 ? '紧凑' : DENS < 1.2 ? '标准' : '宽松')));")

io.open(p, "w", encoding="utf-8").write(s)
print("app ok")
