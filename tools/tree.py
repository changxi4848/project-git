# -*- coding: utf-8 -*-
"""分支改为“挂在父节点正下方纵向堆叠”：线更短、更整齐"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

i1 = s.index("  const bands = new Map();   // depth -> [{d, want}]")
i2 = s.index("  if (sim) { sim.stop(); sim = null; }")
new = '''  // 每个父节点的子节点：在父节点正下方纵向排开（按时间先后）
  const baseY = chainBottom + 115;
  const BAND_H = 150;
  const byParent = new Map();
  ns.forEach((d) => {
    if (d.main) return;
    const pid = d.n.parent && byId.has(d.n.parent) ? d.n.parent : '__root';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(d);
  });

  // 深度 1 的父节点先摆，深度 2 的再挂在它们下面
  const placeChildren = (pid) => {
    const list = (byParent.get(pid) || [])
      .sort((a, b) => (a.n.content_at < b.n.content_at ? -1 : 1));
    const parent = byId.get(pid);
    const px = parent ? parent.x : 0;
    const depth = parent ? (parent.main ? 0 : (parent.depth || 0)) + 1 : 1;
    const y0 = baseY + (depth - 1) * (BAND_H * 1.0);
    list.forEach((d, i) => {
      d.depth = depth;
      d.x = px + (i % 2 === 0 ? -34 : 34) * (i > 1 ? 1 : 0);
      d.y = y0 + i * BAND_H;
      placeChildren(d.id);
    });
  };
  [...byParent.keys()].filter((k) => {
    const p = byId.get(k);
    return p && p.main;
  }).forEach((k) => placeChildren(k));
  // 没有父节点的孤儿
  (byParent.get('__root') || []).forEach((d, i) => {
    d.depth = 1; d.x = (i - 1) * 220; d.y = baseY + i * BAND_H;
  });

  // 消除同层横向压字：同一 y 上的节点按 x 排序，最小间距 178
  const rowsMap = new Map();
  ns.forEach((d) => {
    if (d.main) return;
    const key = Math.round(d.y);
    if (!rowsMap.has(key)) rowsMap.set(key, []);
    rowsMap.get(key).push(d);
  });
  rowsMap.forEach((list) => {
    list.sort((a, b) => a.x - b.x);
    let prev = -Infinity;
    list.forEach((d) => { d.x = Math.max(d.x, prev + 178); prev = d.x; });
    const mean = list.reduce((s2, d) => s2 + d.x, 0) / list.length;
    const anchor = list.reduce((s2, d) => s2 + (byId.get(d.n.parent) ? byId.get(d.n.parent).x : 0), 0) / list.length;
    list.forEach((d) => { d.x += anchor - mean; });
  });

'''
s = s[:i1] + new + s[i2:]
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
