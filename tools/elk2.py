# -*- coding: utf-8 -*-
"""ELK 布局后处理：按“层”折行
   ELK 给出每层（x 相同为一层）与层内顺序，我们只做“每行放几层、蛇形换行”
   这样既保留 ELK 的交叉最小化，又不会拉成一条超长的线
"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

old = """  if (res && res.children) {
    res.children.forEach((c) => {
      const d = byId.get(c.id);
      if (!d) return;
      d.x = c.x + c.width / 2;
      d.y = c.y + c.height / 2;
    });
  } else {
    // 兜底：按时间排一行
    ns.forEach((d, i) => { d.x = i * 200; d.y = 0; });
  }"""

new = """  if (res && res.children) {
    // 1) 先把 ELK 的结果读进来
    const raw = res.children.map((c) => ({
      d: byId.get(c.id), x: c.x, y: c.y, w: c.width, h: c.height,
    })).filter((o) => o.d);

    // 2) 按 x 聚成“层”，层内按 y 排序
    const xsSorted = [...new Set(raw.map((o) => Math.round(o.x)))].sort((a, b) => a - b);
    const layerOf = (o) => xsSorted.indexOf(Math.round(o.x));
    const layers = xsSorted.map((x, i) => raw.filter((o) => layerOf(o) === i)
      .sort((a, b) => a.y - b.y));

    // 3) 折行：每行 LAYERS_PER_ROW 层，蛇形
    const LAYERS_PER_ROW = Math.max(3, Math.min(6, Math.round(Math.sqrt(layers.length * 1.6))));
    const COL_W = Math.round(200 * DENS);
    const ROW_H = Math.round(190 * DENS);
    const lastIdx = layers.length - 1;
    layers.forEach((layer, li) => {
      const row = Math.floor(li / LAYERS_PER_ROW);
      const col = li % LAYERS_PER_ROW;
      const nInRow = Math.min(LAYERS_PER_ROW, layers.length - row * LAYERS_PER_ROW);
      const cx = (col - (nInRow - 1) / 2) * COL_W * (row % 2 === 0 ? 1 : -1);
      const count = layer.length;
      layer.forEach((o, k) => {
        o.d.x = cx;
        o.d.y = (k - (count - 1) / 2) * ROW_H + row * (ROW_H * Math.max(1, 2));
      });
    });
    // 4) 整体垂直居中
    const ys = ns.map((d) => d.y);
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    ns.forEach((d) => { d.y -= midY; });
  } else {
    ns.forEach((d, i) => { d.x = i * 200; d.y = 0; });
  }"""

assert old in s
s = s.replace(old, new)
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
