# -*- coding: utf-8 -*-
"""方案 B：按月分章（列=月份，列内上下排），列间用水平箭头推进"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle, FancyArrowPatch

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 16, 9
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(3.15, 9.05); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#1F2933"; MUT = "#7B8794"; DIM = "#9AA5B1"; LINE = "#D3DBE3"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"

cols = [
    (1.05, "2026-08", [
        ("dec", "让 NEO 冒充 Elite", 7.55),
        ("doc", "试错记录 44 条", 6.85),
        ("doc", "Console 反编译源码", 6.25),
        ("data", "固件镜像 73 个", 5.65),
    ]),
    (4.55, "2026-09", [
        ("dec", "走 HID 流（放弃）", 7.55),
        ("dec", "放弃 HID，改 GATT", 6.55),
        ("plan", "GATT 直连方案", 5.95),
        ("dec", "冒用 productKey", 5.05),
    ]),
    (8.05, "2026-10", [
        ("data", "身份帧样本", 7.55),
        ("plan", "身份帧方案", 6.95),
        ("dec", "锁定基线 b6677ef", 6.05),
    ]),
    (11.55, "2026-11", [
        ("ret", "基线复盘", 7.55),
        ("dec", "改板：加外部天线", 6.55),
        ("doc", "交接文档", 5.95),
        ("code", "PCB v1", 5.35),
    ]),
]

COLW = 3.35
for i, (x, label, items) in enumerate(cols):
    ax.add_patch(Rectangle((x - 0.15, 4.55), COLW, 3.55, facecolor="#FAFBFC", edgecolor="#EEF2F6", lw=1, zorder=0))
    ax.text(x, 8.42, label, fontsize=11, color=MUT, fontweight="bold")
    ax.plot([x - 0.15, x - 0.15], [4.55, 8.10], color="#E6EBF0", lw=1, zorder=0)
    for j, (kind, text, y) in enumerate(items):
        c = {"dec": DEC, "plan": PLAN, "ret": RET, "doc": DOC, "data": DATA, "code": CODE}[kind]
        r = 0.115 if kind == "dec" else 0.075
        ax.add_patch(Circle((x + 0.28, y), r, facecolor=c if kind != "dec" or "放弃" not in text else "#B9C2CB",
                            edgecolor="white", lw=1.6, zorder=5))
        ax.text(x + 0.50, y, text, fontsize=10 if kind == "dec" else 9.2,
                color=INK, va="center", fontweight="bold" if kind == "dec" else "normal")
        if j > 0:
            ax.plot([x + 0.28, x + 0.28], [y + 0.10, items[j - 1][2] - 0.10],
                    color="#E7ECF1", lw=1, zorder=0)
        if j < len(items) - 1:
            gap = y - items[j + 1][2]
            if gap < 0.45:
                ax.plot([x + 0.28, x + 0.28], [y - r, items[j + 1][2] + 0.09],
                        color="#E3E9EF", lw=1, zorder=1)

# 列间箭头
for i in range(len(cols) - 1):
    x1 = cols[i][0] + COLW - 0.05
    x2 = cols[i + 1][0] - 0.20
    y = 4.30
    ax.add_patch(FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>", mutation_scale=13,
                                 color="#B9C2CB", lw=1.2, zorder=3))

# 取代：红色小箭头
ax.add_patch(FancyArrowPatch((4.83, 7.38), (4.83, 6.72), arrowstyle="-|>", mutation_scale=11,
                             color=DEC, lw=1.4, zorder=6))
ax.text(4.95, 7.02, "取代", fontsize=8.5, color=DEC)

lg = [("决策", DEC), ("方案", PLAN), ("复盘", RET), ("资料", DOC), ("数据", DATA), ("代码", CODE)]
x0 = 1.05
for name, c in lg:
    ax.add_patch(Circle((x0, 3.62), 0.07, facecolor=c, edgecolor="white", lw=1.2, zorder=5))
    ax.text(x0 + 0.15, 3.62, name, fontsize=9, color=MUT, va="center")
    x0 += 0.95

ax.text(1.05, 8.75, "方案 B · 按月分章", fontsize=17, fontweight="bold", color=INK)
ax.text(1.05, 8.45 - 0.62, "", fontsize=10)
ax.text(1.05, 4.05, "列 = 月份；列内节点上下排；列间箭头表示时间推进。资源与决策在同一列，靠上下位置表达归属。",
        fontsize=9.5, color=DIM)

plt.tight_layout(pad=0.3)
fig.savefig("docs/design-B.png", dpi=200, bbox_inches="tight", facecolor="white")
print("B ok")
