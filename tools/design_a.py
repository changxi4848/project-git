# -*- coding: utf-8 -*-
"""方案 A：时间轴 + 正交泳道（所有连线只有水平和垂直，没有斜线）"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Rectangle
import matplotlib.patheffects as pe

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 16, 9
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#1F2933"; MUT = "#7B8794"; DIM = "#9AA5B1"; LINE = "#CBD5DF"; GRID = "#F1F4F7"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"

# 泳道
lanes = [(6.55, "决策 · 里程碑"), (4.30, "方案 · 复盘"), (2.05, "资源 · 资料 / 数据 / 代码")]
for y, name in lanes:
    ax.add_patch(Rectangle((0.55, y - 0.62), 15.0, 1.24, facecolor=GRID, edgecolor="none", zorder=0))
    ax.text(0.62, y + 0.82, name, fontsize=9.5, color=MUT, fontweight="bold")

# 时间刻度
months = [(2.0, "2026-08"), (5.6, "2026-09"), (9.2, "2026-10"), (12.7, "2026-11")]
for x, lab in months:
    ax.plot([x, x], [1.28, 7.55], color="#E7ECF1", lw=1, zorder=0)
    ax.text(x + 0.08, 7.62, lab, fontsize=9, color=DIM)


def node(x, y, label, color, r=0.11, bold=False, size=10):
    ax.add_patch(Circle((x, y), r, facecolor=color, edgecolor="white", lw=1.6, zorder=5))
    ax.text(x, y - r - 0.20, label, fontsize=size, color=INK, ha="center", va="top",
            fontweight="bold" if bold else "normal", zorder=6)


def vline(x, y1, y2, color=LINE, lw=1.0, ls="-"):
    ax.plot([x, x], [y1, y2], color=color, lw=lw, ls=ls, zorder=2, solid_capstyle="round")


def hline(y, x1, x2, color=LINE, lw=1.0, ls="-"):
    ax.plot([x1, x2], [y, y], color=color, lw=lw, ls=ls, zorder=2, solid_capstyle="round")


# ---------- 决策（主线，水平连） ----------
dec = [(2.0, "让 NEO 冒充 Elite"), (4.0, "走 HID 流"), (5.6, "放弃 HID，改 GATT"),
       (9.2, "冒用 productKey"), (11.6, "锁定基线 b6677ef"), (14.2, "改板加天线")]
for i in range(len(dec) - 1):
    hline(6.55, dec[i][0] + 0.12, dec[i + 1][0] - 0.12, color=LINE, lw=1.6)
for x, lab in dec:
    node(x, 6.55, lab, DEC if "HID 流" not in lab else "#B9C2CB", r=0.13, bold=True, size=10)

# 走错的那条：红色取代弧线（唯一的例外，用直折线）
ax.plot([4.0, 4.0, 5.6], [6.42, 6.05, 6.42], color=DEC, lw=1.6, zorder=3)
ax.text(4.8, 5.92, "取代", fontsize=9, color=DEC, ha="center")

# ---------- 方案/复盘（第二条泳道） ----------
plans = [(2.0, "方案 v1"), (5.6, "GATT 直连方案"), (9.2, "身份帧方案"), (11.6, "基线复盘")]
for x, lab in plans:
    node(x, 4.30, lab, PLAN if "方案" in lab else RET, r=0.10, size=9.5)

# ---------- 资源（第三条泳道，成组挂在决策下方） ----------
groups = [
    (2.0, ["试错记录 44 条", "Console 反编译", "固件镜像 73 个"]),
    (9.2, ["身份帧样本", "抓包日志"]),
    (11.6, ["交接文档"]),
]
for base, items in groups:
    span = 1.05
    start = base - span * (len(items) - 1) / 2
    xs = [start + i * span for i in range(len(items))]
    # 竖直主干 + 水平母线
    vline(base, 6.30, 3.38, color="#DCE3EA", lw=1.2)
    hline(3.38, min(xs), max(xs), color="#DCE3EA", lw=1.2)
    for x, lab in zip(xs, items):
        vline(x, 3.38, 2.28, color="#DCE3EA", lw=1.2)
        node(x, 2.05, lab, DATA if "镜像" in lab or "样本" in lab else (DOC if "文档" in lab or "记录" in lab or "反编译" in lab else DATA),
             r=0.085, size=9)

# 图例
lg = [("决策", DEC), ("方案", PLAN), ("复盘", RET), ("资料", DOC), ("数据", DATA)]
x0 = 0.62
for name, c in lg:
    ax.add_patch(Circle((x0, 0.72), 0.075, facecolor=c, edgecolor="white", lw=1.2, zorder=5))
    ax.text(x0 + 0.16, 0.72, name, fontsize=9, color=MUT, va="center")
    x0 += 1.0

ax.text(0.62, 8.55, "方案 A · 时间轴 + 正交泳道", fontsize=17, fontweight="bold", color=INK)
ax.text(0.62, 8.16, "所有连线只有水平和垂直；资源成组挂在决策下方，用母线统一接入", fontsize=10.5, color=MUT)
ax.text(0.62, 0.34, "时间从左到右；同一列 = 同一时间段；斜线一律不画。",
        fontsize=9.5, color=DIM)

plt.tight_layout(pad=0.3)
fig.savefig("docs/design-A.png", dpi=200, bbox_inches="tight", facecolor="white")
print("A ok")
