# -*- coding: utf-8 -*-
"""方案 C：Git 风格的提交图 —— 主干 + 并行分支 + 合并 + 终止 + tag + 资源附件"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import (Circle, Rectangle, Polygon, FancyBboxPatch, Ellipse, Arc)
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 16.4, 9.4
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#1F2933"; MUT = "#6B7A88"; DIM = "#98A5B1"; LINE = "#B9C6D3"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"
GREY = "#B9C2CB"

Y_MAIN = 5.35
Y_BR1 = 7.05
Y_BR2 = 7.05
Y_RES = 3.55

# ---------------- 标题 ----------------
ax.text(0.62, 8.95, "方案 C · Git 式提交图", fontsize=16.5, fontweight="bold", color=INK)
ax.text(0.62, 8.58, "主干＝主线提交；分叉＝一次尝试；×＝尝试终止；双线汇合＝被采纳；小旗＝里程碑；虚线框＝这次提交带的材料",
        fontsize=9.4, color=MUT)

# ---------------- 时间刻度 ----------------
for x, lab in [(1.5, "2026-08"), (4.1, "09"), (6.4, "10"), (9.4, "11"), (13.2, "12")]:
    ax.plot([x, x], [1.55, 8.05], color="#EFF3F6", lw=1, zorder=0)
    ax.text(x + 0.06, 8.08, lab, fontsize=8.5, color=DIM)


def icon(kind, x, y, s=0.085, color="#FFFFFF"):
    if kind == "decision":
        ax.add_patch(Polygon([[x, y + s], [x + s, y], [x, y - s], [x - s, y]],
                             closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "doc":
        ax.add_patch(Polygon([[x - s * .8, y + s], [x + s * .25, y + s], [x + s * .8, y + s * .35],
                              [x + s * .8, y - s], [x - s * .8, y - s]],
                             closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "data":
        ax.add_patch(Rectangle((x - s * .75, y - s * .8), s * 1.5, s * 1.45, facecolor=color, edgecolor="none", zorder=8))
        ax.add_patch(Ellipse((x, y + s * .62), s * 1.5, s * .5, facecolor=color, edgecolor="none", zorder=9))
        ax.add_patch(Ellipse((x, y - s * .8), s * 1.5, s * .5, facecolor=color, edgecolor="none", zorder=9))
    elif kind == "code":
        ax.plot([x - s * .3, x - s * .8, x - s * .3], [y + s * .5, y, y - s * .5], color=color, lw=1.7,
                solid_capstyle="round", zorder=9)
        ax.plot([x + s * .3, x + s * .8, x + s * .3], [y + s * .5, y, y - s * .5], color=color, lw=1.7,
                solid_capstyle="round", zorder=9)
    elif kind == "retro":
        ax.add_patch(Arc((x, y), s * 1.6, s * 1.6, theta1=40, theta2=330, color=color, lw=1.9, zorder=9))
        ax.add_patch(Polygon([[x + s * .68, y + s * .6], [x + s * .9, y + s * .16], [x + s * .44, y + s * .2]],
                             closed=True, facecolor=color, edgecolor="none", zorder=10))
    elif kind == "output":
        pts = []
        for i in range(10):
            ang = np.pi / 5 * i - np.pi / 2
            rr = s * (1.0 if i % 2 == 0 else s * .44)
            pts.append([x + np.cos(ang) * rr, y + np.sin(ang) * rr])
        ax.add_patch(Polygon(pts, closed=True, facecolor=color, edgecolor="none", zorder=8))


def commit(x, y, kind, color, r=0.135, hollow=False, dead=False):
    c = GREY if dead else color
    if hollow:
        ax.add_patch(Circle((x, y), r, facecolor="white", edgecolor=c, lw=2.0, zorder=7))
    else:
        ax.add_patch(Circle((x, y), r, facecolor=c, edgecolor="white", lw=1.8, zorder=7))
        icon(kind, x, y, s=r * 0.6, color="#FFFFFF")


# ---------------- 主干提交 ----------------
main = [
    (1.50, "decision", "让 NEO 冒充 Elite", "决策 · 08-12"),
    (3.35, "decision", "放弃 HID，改 GATT", "决策 · 09-02"),
    (5.10, "decision", "冒用 productKey", "决策 · 09-12"),
    (7.70, "decision", "锁定基线 b6677ef", "决策 · 10-15"),
    (11.40, "decision", "改板：加外部天线", "决策 · 11-02"),
    (13.80, "output", "交接归档", "产出 · 11-17"),
]
# 主干线
for i in range(len(main) - 1):
    ax.plot([main[i][0] + 0.14, main[i + 1][0] - 0.14], [Y_MAIN, Y_MAIN],
            color=LINE, lw=2.0, zorder=2, solid_capstyle="round")

# 连接上的叙事
for x, t in [(2.42, "按 Plus 的 HID 试"), (4.22, "卡在「正在连接」"),
             (6.40, "GATT 能连，机型不对"), (9.55, "能跑通，先固化"),
             (12.60, "天线衰减 12dB")]:
    ax.text(x, Y_MAIN + 0.20, t, fontsize=8.2, color=MUT, ha="center", va="bottom", zorder=5,
            bbox=dict(boxstyle="round,pad=0.24", facecolor="white", edgecolor="none"))

for x, kind, name, sub in main:
    commit(x, Y_MAIN, kind, DEC if kind == "decision" else "#C08A3E")
    ax.text(x, Y_MAIN - 0.30, name, fontsize=9.6, color=INK, ha="center", va="top", fontweight="bold", zorder=9)
    ax.text(x, Y_MAIN - 0.54, sub, fontsize=8.2, color=MUT, ha="center", va="top", zorder=9)

# ---------------- 分支 1：走 HID（终止） ----------------
bx0, bx1 = 1.50, 3.05
ax.plot([bx0, bx0 + 0.42, bx1], [Y_MAIN, Y_BR1, Y_BR1], color=GREY, lw=1.6, zorder=2,
        solid_capstyle="round", solid_joinstyle="round")
commit(bx1, Y_BR1, "decision", GREY, r=0.115, dead=True)
ax.text(bx1, Y_BR1 - 0.26, "先走 HID 流", fontsize=9, color="#8A939E", ha="center", va="top", zorder=9)
ax.text(bx1, Y_BR1 - 0.48, "分支 · 08-20", fontsize=8, color=DIM, ha="center", va="top", zorder=9)
# 终止标记
tx = bx1 + 0.46
ax.plot([bx1 + 0.12, tx], [Y_BR1, Y_BR1], color=GREY, lw=1.6, ls=(0, (3, 3)), zorder=2)
ax.plot([tx, tx], [Y_BR1 - 0.10, Y_BR1 + 0.10], color=GREY, lw=1.8, zorder=6)
ax.plot([tx - 0.10, tx + 0.10], [Y_BR1 - 0.10, Y_BR1 + 0.10], color=GREY, lw=1.8, zorder=6)
ax.text(tx + 0.10, Y_BR1, "尝试终止 · 08-28", fontsize=8, color="#9AA5B1", va="center", zorder=9)

# ---------------- 分支 2：PCB（合并回来） ----------------
mx0, mx1 = 7.70, 11.40
ax.plot([mx0, mx0 + 0.55, mx1 - 0.55, mx1], [Y_MAIN, Y_BR2, Y_BR2, Y_MAIN],
        color="#9DB4C7", lw=1.6, zorder=2, solid_capstyle="round", solid_joinstyle="round")
commit(9.35, Y_BR2, "decision", PLAN, r=0.115)
ax.text(9.35, Y_BR2 - 0.26, "PCB v1 打样", fontsize=9, color=INK, ha="center", va="top", zorder=9)
ax.text(9.35, Y_BR2 - 0.48, "分支 · 10-25", fontsize=8, color=DIM, ha="center", va="top", zorder=9)
ax.text(10.55, Y_BR2 + 0.18, "合并：改板采纳这个分支", fontsize=8, color="#5F7590", ha="center", zorder=9,
        bbox=dict(boxstyle="round,pad=0.22", facecolor="white", edgecolor="none"))

# ---------------- tag：里程碑 ----------------
tx0 = 7.70
ax.add_patch(FancyBboxPatch((tx0 + 0.02, Y_MAIN + 0.30), 1.16, 0.30,
             boxstyle="round,pad=0.02,rounding_size=0.05", facecolor="#FFF7E8", edgecolor="#E0B96B", lw=1, zorder=8))
ax.text(tx0 + 0.60, Y_MAIN + 0.45, "tag  b6677ef", fontsize=8.2, color="#A5751E", ha="center", va="center", zorder=9)
ax.plot([tx0, tx0 + 0.02], [Y_MAIN + 0.12, Y_MAIN + 0.30], color="#E0B96B", lw=1, zorder=7)

# ---------------- 资源附件（虚线框挂在提交下方） ----------------
def res_box(cx, items, top=3.95):
    w = 2.25
    h = 0.46 * len(items) + 0.16
    ax.plot([cx, cx], [Y_MAIN - 0.72, top], color="#E2E8EE", lw=1, zorder=1)
    ax.add_patch(FancyBboxPatch((cx - w / 2, top - h), w, h,
                 boxstyle="round,pad=0.02,rounding_size=0.06",
                 facecolor="#FCFDFE", edgecolor="#E2E8EE", lw=1, ls=(0, (4, 3)), zorder=1))
    for i, (kind, name, sub) in enumerate(items):
        y = top - 0.26 - i * 0.46
        ax.add_patch(Circle((cx - w / 2 + 0.22, y), 0.072,
                     facecolor={"doc": DOC, "data": DATA, "code": CODE}[kind], edgecolor="white", lw=1.2, zorder=6))
        icon(kind, cx - w / 2 + 0.22, y, s=0.045, color="#FFFFFF")
        ax.text(cx - w / 2 + 0.38, y + 0.09, name, fontsize=8.3, color=INK, va="center", zorder=9)
        ax.text(cx - w / 2 + 0.38, y - 0.13, sub, fontsize=7.3, color=MUT, va="center", zorder=9)
    return w


res_box(1.50, [("doc", "试错记录", "资料 · 44 条"),
               ("doc", "Console 反编译源码", "资料 · 已产出"),
               ("data", "固件镜像", "数据 · 73 个")])
res_box(5.10, [("data", "身份帧样本", "数据 · 37 组"),
               ("data", "抓包日志", "数据 · 40 万行")])
res_box(7.70, [("doc", "交接文档", "资料 · 已归档"),
               ("code", "esp32s3-relay-dock", "代码 · 113 commits")])

# ---------------- 图例 ----------------
lx = 0.62
for name, kind, color in [("提交（决策）", "decision", DEC), ("提交（产出）", "output", "#C08A3E"),
                          ("资料", "doc", DOC), ("数据", "data", DATA), ("代码", "code", CODE)]:
    ax.add_patch(Circle((lx + 0.10, 0.92), 0.10, facecolor=color, edgecolor="white", lw=1.3, zorder=6))
    icon(kind, lx + 0.10, 0.92, s=0.06, color="#FFFFFF")
    ax.text(lx + 0.25, 0.92, name, fontsize=8.4, color=MUT, va="center")
    lx += 1.32
# 线型图例
ax.plot([6.9, 7.5], [0.92, 0.92], color=LINE, lw=2.0)
ax.text(7.56, 0.92, "主干", fontsize=8.4, color=MUT, va="center")
ax.plot([8.2, 8.8], [0.92, 0.92], color=GREY, lw=1.6)
ax.text(8.86, 0.92, "分支", fontsize=8.4, color=MUT, va="center")
ax.plot([9.5, 10.1], [0.92, 0.92], color=GREY, lw=1.6, ls=(0, (3, 3)))
ax.text(10.16, 0.92, "终止", fontsize=8.4, color=MUT, va="center")
ax.text(10.9, 0.92, "虚线框＝这次提交带的材料", fontsize=8.4, color=DIM, va="center")

ax.text(0.62, 0.45, "横轴时间；纵轴是分支泳道。走错的路不会被删掉——它作为一条终止的分支留在图上。",
        fontsize=8.8, color=DIM)

plt.tight_layout(pad=0.25)
fig.savefig("docs/design-C.png", dpi=200, bbox_inches="tight", facecolor="white")
print("C ok")
