# -*- coding: utf-8 -*-
"""布局彻底改为“分带定位”：主干分行 → 分支按深度分带 → 带内水平排开。
   不再使用力导向，位置完全确定，不会重叠、不会乱动。"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---------- 替换 rebuild 的“钉主干 + 力导向”部分 ----------
i1 = s.index("  // —— 主干：分行直线，行内间距按时间拉开（不是等距） ——")
i2 = s.index("  selected = null; hovered = null; active = null;")
new = '''  // —— 1. 主干：分行直线，行内按时间拉开 ——
  const chain = longestChain(vn);
  const MIN_GAP = 205;
  const perRow = chain.length <= 4 ? chain.length : (chain.length <= 8 ? 4 : 5);
  const rows = Math.ceil(chain.length / perRow);
  const ROW_H = 200;
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
    const xs = ts.map((t, k) => k * MIN_GAP + ((t - tMin) / tSpan) * 120);
    const width = xs[xs.length - 1] || 0;
    let x = xs[col] - width / 2;
    if (row % 2 === 1) x = -x;
    d.x = x; d.y = row * ROW_H; d.main = true; d.depth = 0;
  });
  chainSet = new Set(chain);
  const chainBottom = (rows - 1) * ROW_H;

  // —— 2. 分支：按“离主干几层”分带，带内水平排开 ——
  const kidsOf = new Map();
  vn.forEach((n) => {
    if (n.parent && byId.has(n.parent)) {
      if (!kidsOf.has(n.parent)) kidsOf.set(n.parent, []);
      kidsOf.get(n.parent).push(n.id);
    }
  });
  // 深度：父节点是主干 → 1；否则父深度+1
  const depthOf = new Map();
  const queue2 = [];
  chain.forEach((id) => { depthOf.set(id, 0); (kidsOf.get(id) || []).forEach((c) => queue2.push(c)); });
  while (queue2.length) {
    const id = queue2.shift();
    const d = byId.get(id);
    if (!d || depthOf.has(id)) continue;
    const p = byId.get(d.n.parent);
    const dep = (p && depthOf.has(p.id) ? depthOf.get(p.id) : 0) + 1;
    depthOf.set(id, dep);
    (kidsOf.get(id) || []).forEach((c) => queue2.push(c));
  }

  const bands = new Map();   // depth -> [{d, want}]
  ns.forEach((d) => {
    if (d.main) return;
    const dep = depthOf.get(d.id) || 1;
    d.depth = dep;
    const p = byId.get(d.n.parent);
    const want = p ? p.x : 0;
    if (!bands.has(dep)) bands.set(dep, []);
    bands.get(dep).push({ d, want });
  });

  const BAND_H = 155;
  const MIN_X = 178;
  [...bands.keys()].sort((a, b) => a - b).forEach((dep) => {
    const list = bands.get(dep).sort((a, b) => a.want - b.want);
    let prev = -Infinity;
    list.forEach((it) => {
      it.x = Math.max(it.want, prev + MIN_X);
      prev = it.x;
    });
    const shift = list.length ? (list.reduce((s2, it) => s2 + it.x, 0) / list.length) : 0;
    list.forEach((it) => {
      it.d.x = it.x - shift;
      it.d.y = chainBottom + 110 + (dep - 1) * BAND_H;
    });
  });

  if (sim) { sim.stop(); sim = null; }

'''
s = s[:i1] + new + s[i2:]

# 去掉对 sim 的其它引用
s = s.replace("        if (sim) sim.alpha(0.3).restart();\n", "")
s = s.replace("        if (sim) sim.alpha(0.2).restart();\n", "")
s = s.replace("  if (sim) sim.stop();\n  sim = d3.forceSimulation", "  /* 不再使用力导向 */\n  if (false) sim = d3.forceSimulation")

# 拖动不再触发任何模拟
s = s.replace("        if (!edit) { d.fx = null; d.fy = null; }   // 松手后就地固定，不重排",
              "        // 松手后就地固定（布局是确定性的，不需要重排）")

io.open(p, "w", encoding="utf-8").write(s)
print("ok", len(s))
