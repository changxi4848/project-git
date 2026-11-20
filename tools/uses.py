# -*- coding: utf-8 -*-
"""去掉行尾折线（全部直线）+ 新增“引用”线型（一个资源被多个节点用到）"""
import io

# ---------- 1) 去掉行尾直角折线 ----------
p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

i1 = s.index("    // 主干换行处：直角连接")
i2 = s.index("    const on = !focus || (focus.has(a.id) && focus.has(b.id));")
s = s[:i1] + s[i2:]

# ---------- 2) 新线型：引用（uses）----------
s = s.replace("""    else if (isResLink) { ctx.strokeStyle = 'rgba(150,160,172,0.75)'; ctx.lineWidth = 1.1 / cam.k; }""",
"""    else if (l.kind === 'uses') { ctx.strokeStyle = 'rgba(90,140,170,0.55)'; ctx.lineWidth = 1 / cam.k; }
    else if (isResLink) { ctx.strokeStyle = 'rgba(150,160,172,0.75)'; ctx.lineWidth = 1.1 / cam.k; }""")

s = s.replace("""      ctx.setLineDash((l.kind === 'relates' || l.kind === 'attach' || isResLink) ? [5 / cam.k, 4 / cam.k] : []);""",
"""      const dotted = l.kind === 'uses';
      ctx.setLineDash(dotted ? [1.5 / cam.k, 4 / cam.k]
        : ((l.kind === 'relates' || l.kind === 'attach' || isResLink) ? [5 / cam.k, 4 / cam.k] : []));""")

# 引用线的目标端画一个小空心点，表示“这里引用了上游资源”
s = s.replace("""      if (isSup) {
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);""",
"""      if (l.kind === 'uses') {
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 3 / cam.k, 0, 7);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = 'rgba(90,140,170,0.8)'; ctx.lineWidth = 1.2 / cam.k; ctx.stroke();
      }
      if (isSup) {
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);""")

io.open(p, "w", encoding="utf-8").write(s)
print("app ok")

# ---------- 3) 数据里加“引用”关系 ----------
p2 = "D:/03_code_list/project-git-项目知识时间轴/tools/seed_real.py"
t = io.open(p2, encoding="utf-8").read()
if "'uses'" not in t:
    t = t.replace('edges.append({"from": "r5", "to": "r2", "kind": "relates"})     # 固件 ← 交接文档',
"""edges.append({"from": "r5", "to": "r2", "kind": "relates"})     # 固件 ← 交接文档

# “一个资源被后面多个节点用到”：用 uses 表示（细点线 + 空心点），跟“归属”区分开
edges.append({"from": "r5", "to": "r10", "kind": "uses"})    # 固件镜像 → 改 GATT 时参考
edges.append({"from": "r5", "to": "r12", "kind": "uses"})    # 固件镜像 → 冒充 productKey
edges.append({"from": "r3", "to": "r17", "kind": "uses"})    # 试错记录 → 暂停归档复盘
edges.append({"from": "t6", "to": "t7", "kind": "uses"})     # 协议文档 → 逆向 LibH
edges.append({"from": "d5", "to": "d9", "kind": "uses"})     # 弹幕语料 → 检索链路 v2""")
    io.open(p2, "w", encoding="utf-8").write(t)
print("seed ok")
