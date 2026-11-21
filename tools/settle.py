# -*- coding: utf-8 -*-
"""拖动后的“回弹/避让”：
   - 每个节点记住自己的“家”(hx,hy)
   - 松手后跑一段轻量松弛：邻居互相让开、其余慢慢靠回家
   - 按 R 可以把整张图复位
"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 1) 布局完成后记录 home
anchor = "  // 垂直居中\n  const ys0 = ns.map((d) => d.y);"
if anchor in s:
    s = s.replace(anchor, "  // 记录“家”的位置（用于回弹复位）\n  ns.forEach((d) => { d.hx = d.x; d.hy = d.y; });\n\n" + anchor)
else:
    # 兜底：在 rebuild 末尾统一记录
    s = s.replace("  selected = null; hovered = null; active = null;",
                  "  ns.forEach((d) => { d.hx = d.x; d.hy = d.y; });\n  selected = null; hovered = null; active = null;")

# 2) 松弛函数
hook = "function fit() {"
settle = '''/** 轻量松弛：互斥让开 + 慢慢靠回家。pinnedId 为被拖动的节点（保持不动） */
function settle(pinnedId, opts) {
  const o = Object.assign({ frames: 42, its: 3, pull: 0.035, gap: 20 }, opts || {});
  let frame = 0;
  if (settle._raf) cancelAnimationFrame(settle._raf);
  const step = () => {
    for (let it = 0; it < o.its; it++) {
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        if (a.id === pinnedId) continue;
        // 回家（很弱）
        a.x += (a.hx - a.x) * o.pull;
        a.y += (a.hy - a.y) * o.pull;
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const b = ns[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const minD = a.r + b.r + o.gap;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < minD) {
            const push = (minD - dist) * 0.45;
            const ux = dx / dist, uy = dy / dist;
            a.x += ux * push; a.y += uy * push;
          }
        }
      }
    }
    draw();
    if (++frame < o.frames) settle._raf = requestAnimationFrame(step);
    else settle._raf = null;
  };
  settle._raf = requestAnimationFrame(step);
}

function fit() {'''
assert hook in s
s = s.replace(hook, settle, 1)

# 3) 松手后触发松弛
s = s.replace("        // 松手后就地固定（布局是确定性的，不需要重排）",
              "        settle(d.id);        // 松手后轻微回弹，让周围节点让开")

# 4) R 键复位
s = s.replace("    if (e.key === 'f' || e.key === 'F') fit();",
"""    if (e.key === 'f' || e.key === 'F') fit();
    if (e.key === 'r' || e.key === 'R') {
      ns.forEach((d) => { d.x = d.hx; d.y = d.hy; });
      settle(null, { frames: 26, pull: 0.12 });
      toast('已复位');
    }""")

io.open(p, "w", encoding="utf-8").write(s)
print("ok", "settle" in s)
