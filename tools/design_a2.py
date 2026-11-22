# -*- coding: utf-8 -*-
"""方案 A2：带图标的节点 + 连线叙事 + 取代并入主干"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import (Circle, Rectangle, Polygon, FancyArrowPatch,
                                Ellipse, FancyBboxPatch, Arc)
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 16.4, 9.2
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#1F2933"; MUT = "#6B7A88"; DIM = "#98A5B1"; LINE = "#C7D2DD"; BAND = "#F5F7F9"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"

# ---------------- 泳道 ----------------
ax.add_patch(Rectangle((0.55, 5.95), 15.3, 1.55, facecolor=BAND, edgecolor="none", zorder=0))
ax.add_patch(Rectangle((0.55, 4.05), 15.3, 1.30, facecolor="#FAFBFC", edgecolor="none", zorder=0))
ax.add_patch(Rectangle((0.55, 1.72), 15.3, 1.90, facecolor="#FAFBFC", edgecolor="none", zorder=0))
for y, name in [(7.45, "决策 · 主线"), (5.32, "方案 / 复盘"), (3.58, "资源 · 资料 / 数据 / 代码")]:
    ax.text(0.62, y, name, fontsize=9, color=MUT, fontweight="bold")

# ---------------- 时间刻度 ----------------
for x, lab in [(1.55, "2026-08"), (4.55, "09"), (7.55, "10"), (10.9, "11"), (13.9, "12")]:
    ax.plot([x, x], [1.72, 7.55], color="#EDF1F5", lw=1, zorder=0)
    ax.text(x + 0.06, 7.60, lab, fontsize=8.5, color=DIM)

# ---------------- 图标（节点内） ----------------
def icon(kind, x, y, s=0.085, color="#FFFFFF"):
    if kind == "decision":            # 菱形
        ax.add_patch(Polygon([[x, y + s], [x + s, y], [x, y - s], [x - s, y]],
                             closed=True, facecolor=color, edgecolor="none", zorder=7))
    elif kind == "plan":              # 圆角方 + 两横线
        ax.add_patch(FancyBboxPatch((x - s * .85, y - s * .95), s * 1.7, s * 1.9,
                     boxstyle="round,pad=0.01,rounding_size=0.02", facecolor=color, edgecolor="none", zorder=7))
        ax.plot([x - s * .45, x + s * .45], [y + s * .3, y + s * .3], color="#3F8FC4", lw=1.1, zorder=8)
        ax.plot([x - s * .45, x + s * .45], [y - s * .25, y - s * .25], color="#3F8FC4", lw=1.1, zorder=8)
    elif kind == "doc":               # 折角纸
        p = [[x - s * .8, y + s], [x + s * .25, y + s], [x + s * .8, y + s * .35],
             [x + s * .8, y - s], [x - s * .8, y - s]]
        ax.add_patch(Polygon(p, closed=True, facecolor=color, edgecolor="none", zorder=7))
        ax.plot([x + s * .25, x + s * .25, x + s * .8], [y + s, y + s * .35, y + s * .35],
                color="#A1785A", lw=1.0, zorder=8)
    elif kind == "data":              # 圆柱
        ax.add_patch(Rectangle((x - s * .75, y - s * .85), s * 1.5, s * 1.5, facecolor=color,
                               edgecolor="none", zorder=7))
        ax.add_patch(Ellipse((x, y + s * .65), s * 1.5, s * .55, facecolor=color, edgecolor="none", zorder=8))
        ax.add_patch(Ellipse((x, y - s * .85), s * 1.5, s * .55, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "code":              # </> 尖括号
        ax.plot([x - s * .3, x - s * .85, x - s * .3], [y + s * .55, y, y - s * .55],
                color=color, lw=1.7, solid_capstyle="round", zorder=8)
        ax.plot([x + s * .3, x + s * .85, x + s * .3], [y + s * .55, y, y - s * .55],
                color=color, lw=1.7, solid_capstyle="round", zorder=8)
    elif kind == "retro":             # 循环箭头
        ax.add_patch(Arc((x, y), s * 1.7, s * 1.7, theta1=40, theta2=330, color=color, lw=2.0, zorder=8))
        ax.add_patch(Polygon([[x + s * .72, y + s * .62], [x + s * .95, y + s * .18], [x + s * .48, y + s * .22]],
                             closed=True, facecolor=color, edgecolor="none", zorder=9))
    elif kind == "output":            # 星
        pts = []
        for i in range(10):
            ang = np.pi / 5 * i - np.pi / 2
            rr = s * (1.05 if i % 2 == 0 else s * .46)
            pts.append([x + np.cos(ang) * rr, y + np.sin(ang) * rr])
        ax.add_patch(Polygon(pts, closed=True, facecolor=color, edgecolor="none", zorder=7))


ICON = {"decision": "decision", "plan": "plan", "doc": "doc", "data": "data",
        "code": "code", "retro": "retro", "output": "output"}


def node(x, y, kind, color, r=0.13, dead=False):
    c = "#B9C2CB" if dead else color
    ax.add_patch(Circle((x, y), r, facecolor=c, edgecolor="white", lw=1.8, zorder=6))
    icon(ICON[kind], x, y, s=r * 0.62, color="#FFFFFF")


def label2(x, y, name, sub, size=10, w=600, subsize=8.2, color=INK, ha="center"):
    ax.text(x, y, name, fontsize=size, color=color, ha=ha, va="top",
            fontweight=("bold" if w >= 600 else "normal"), zorder=9)
    if sub:
        ax.text(x, y - 0.21, sub, fontsize=subsize, color=MUT, ha=ha, va="top", zorder=9)


# ---------------- 决策主线 ----------------
decisions = [
    (1.60, "让 NEO 冒充 Elite", "决策 · 08-12 · 有效", False),
    (3.55, "先走 HID 流", "决策 · 08-20 · 已放弃", True),
    (5.55, "放弃 HID，改 GATT", "决策 · 09-02 · 有效", False),
    (8.40, "冒用 productKey", "决策 · 09-12 · 有效", False),
    (11.30, "锁定基线 b6677ef", "决策 · 10-15 · 有效", False),
    (14.10, "改板：加外部天线", "决策 · 11-02 · 有效", False),
]
TRUNK_Y = 6.72

# 主干线段（含“取代”那一段用红色）
for i in range(len(decisions) - 1):
    x1, x2 = decisions[i][0] + 0.14, decisions[i + 1][0] - 0.14
    supersede = (i == 1)
    ax.plot([x1, x2], [TRUNK_Y, TRUNK_Y], color=(DEC if supersede else LINE),
            lw=(1.8 if supersede else 1.5), zorder=3, solid_capstyle="round")

# 连线上写“怎么走到下一步”
edges_text = [
    (2.60, "按 Plus 的 HID 试"),
    (4.55, "卡在「正在连接」"),
    (7.00, "GATT 能连，机型不对"),
    (9.85, "能跑了，先固化"),
    (12.70, "天线衰减 12dB"),
]
for x, t in edges_text:
    ax.text(x, TRUNK_Y + 0.16, t, fontsize=8.2, color=MUT, ha="center", va="bottom", zorder=4,
            bbox=dict(boxstyle="round,pad=0.22", facecolor="white", edgecolor="none"))

# 取代标注
ax.text(4.55, TRUNK_Y - 0.18, "取代", fontsize=8.2, color=DEC, ha="center", va="top", zorder=4,
        bbox=dict(boxstyle="round,pad=0.22", facecolor="white", edgecolor="none"))

for x, name, sub, dead in decisions:
    node(x, TRUNK_Y, "decision", DEC, r=0.135, dead=dead)
    label2(x, TRUNK_Y - 0.30, name, sub, size=9.6, color=("#9AA5B1" if dead else INK))

# ---------------- 方案 / 复盘 ----------------
plans = [
    (1.60, "方案 v1", "方案 · 08-10", "plan"),
    (5.55, "GATT 直连方案", "方案 · 08-28", "plan"),
    (8.40, "身份帧方案", "方案 · 09-08", "plan"),
    (11.30, "基线复盘", "复盘 · 10-20", "retro"),
    (14.10, "PCB v1", "方案 · 10-25", "plan"),
]
PY = 5.05
for x, name, sub, kind in plans:
    ax.plot([x, x], [TRUNK_Y - 0.14, PY + 0.14], color="#DFE6ED", lw=1.1, zorder=2)
    node(x, PY, kind, PLAN if kind == "plan" else RET, r=0.105)
    label2(x, PY - 0.22, name, sub, size=9.2, w=500)

# ---------------- 资源（分组框） ----------------
groups = [
    (1.60, [("doc", "试错记录", "资料 · 记录 · 44 条"),
            ("doc", "Console 反编译源码", "资料 · 已产出代码"),
            ("data", "固件镜像", "数据 · 73 个 .bin")]),
    (8.40, [("data", "身份帧样本", "数据 · 37 组"),
            ("data", "抓包日志", "数据 · 40 万行")]),
    (11.30, [("doc", "交接文档", "资料 · 已归档"),
            ("code", "仓库 esp32s3-relay-dock", "代码 · 113 commits")]),
    (14.10, [("code", "中转站 PCB 工程", "代码 · KiCad 8")]),
]
for gx, items in groups:
    width = 2.05
    top = 3.32
    h = 0.52 * len(items) + 0.14
    ax.add_patch(FancyBboxPatch((gx - width / 2, top - h), width, h,
                 boxstyle="round,pad=0.02,rounding_size=0.06",
                 facecolor="#FCFDFE", edgecolor="#E2E8EE", lw=1, ls=(0, (4, 3)), zorder=1))
    ax.plot([gx, gx], [PY - 0.12, top], color="#E2E8EE", lw=1, zorder=1)
    for i, (kind, name, sub) in enumerate(items):
        y = top - 0.28 - i * 0.52
        node(gx - width / 2 + 0.24, y, kind,
             {"doc": DOC, "data": DATA, "code": CODE}[kind], r=0.078)
        ax.text(gx - width / 2 + 0.40, y + 0.10, name, fontsize=8.6, color=INK, va="center", zorder=9)
        ax.text(gx - width / 2 + 0.40, y - 0.13, sub, fontsize=7.6, color=MUT, va="center", zorder=9)

# ---------------- 图例 ----------------
lx = 0.62
for name, kind, color in [("决策", "decision", DEC), ("方案", "plan", PLAN), ("复盘", "retro", RET),
                          ("资料", "doc", DOC), ("数据", "data", DATA), ("代码", "code", CODE),
                          ("产出", "output", "#C08A3E")]:
    ax.add_patch(Circle((lx + 0.10, 1.00), 0.10, facecolor=color, edgecolor="white", lw=1.4, zorder=6))
    icon(ICON[kind], lx + 0.10, 1.00, s=0.062, color="#FFFFFF")
    ax.text(lx + 0.26, 1.00, name, fontsize=8.6, color=MUT, va="center")
    lx += 0.92

# ---------------- 标题 ----------------
ax.text(0.62, 8.72, "方案 A2 · 时间轴 + 正交泳道（带图标与连线叙事）", fontsize=16, fontweight="bold", color=INK)
ax.text(0.62, 8.34, "连线上的小字＝“上一步是怎么走到下一步的”；节点图标＝类型；资源放进虚线分组框",
        fontsize=9.5, color=MUT)
ax.text(0.62, 0.56, "所有连线只有水平、垂直；取代并入主干（红色段 + “取代”标注），不再另画一条折线。",
        fontsize=8.8, color=DIM)

plt.tight_layout(pad=0.25)
fig.savefig("docs/design-A2.png", dpi=200, bbox_inches="tight", facecolor="white")
print("A2 ok")
