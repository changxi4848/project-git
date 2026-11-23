# -*- coding: utf-8 -*-
"""方案 D：卡片式提交图（数据单位 = 英寸；1 单位 ≈ 1 英寸）"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, Rectangle, FancyArrowPatch, Ellipse
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 16.8, 8.8
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#111827"; MUT = "#6B7A88"; DIM = "#9AA5B1"
LINE = "#CBD5DF"; SHADOW = "#EEF2F6"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"

CW, CH = 3.00, 0.95          # 卡片尺寸（数据单位）
Y_TRUNK = 5.05
Y_BR = 7.00

ax.text(0.55, 8.95, "方案 D · 卡片式提交图", fontsize=16.5, fontweight="bold", color=INK)
ax.text(0.55, 8.60, "骨架仍是 Git：主干一串提交、分叉是尝试、× 是终止、汇合是被采纳、旗子是里程碑",
        fontsize=9.4, color=MUT)
ax.text(16.05, 8.95, "主干 5 次提交 · 分支 2 条（1 终止 · 1 合并）", fontsize=8.6, color=DIM, ha="right")


def icon(kind, cx, cy, s, color):
    if kind == "decision":
        ax.add_patch(Polygon([[cx, cy + s], [cx + s, cy], [cx, cy - s], [cx - s, cy]],
                             closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "output":
        pts = []
        for i in range(10):
            a = np.pi / 5 * i - np.pi / 2
            r = s if i % 2 == 0 else s * 0.45
            pts.append([cx + np.cos(a) * r, cy + np.sin(a) * r])
        ax.add_patch(Polygon(pts, closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "data":
        ax.add_patch(Ellipse((cx, cy + s * 0.62), s * 1.7, s * 0.62, facecolor=color, edgecolor="none", zorder=9))
        ax.add_patch(Rectangle((cx - s * 0.85, cy - s * 0.62), s * 1.7, s * 1.24, facecolor=color,
                               edgecolor="none", zorder=8))
        ax.add_patch(Ellipse((cx, cy - s * 0.62), s * 1.7, s * 0.62, facecolor=color, edgecolor="none", zorder=9))
    elif kind == "doc":
        ax.add_patch(Polygon([[cx - s, cy + s], [cx + s * 0.3, cy + s], [cx + s, cy + s * 0.3],
                              [cx + s, cy - s], [cx - s, cy - s]], closed=True,
                             facecolor=color, edgecolor="none", zorder=8))
    elif kind == "code":
        ax.plot([cx - s * 0.3, cx - s, cx - s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color, lw=1.8,
                solid_capstyle="round", zorder=9)
        ax.plot([cx + s * 0.3, cx + s, cx + s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color, lw=1.8,
                solid_capstyle="round", zorder=9)
    else:
        ax.add_patch(Circle((cx, cy), s * 0.85, facecolor=color, edgecolor="none", zorder=8))


def card(cx, cy, title, meta, color, kind="decision", w=CW, h=CH, dead=False, chip=None, chipcolor=None, tag=None):
    x0, y0 = cx - w / 2, cy - h / 2
    ax.add_patch(FancyBboxPatch((x0 + 0.03, y0 - 0.05), w, h, boxstyle="round,pad=0.0,rounding_size=0.10",
                                facecolor=SHADOW, edgecolor="none", zorder=2))
    ax.add_patch(FancyBboxPatch((x0, y0), w, h, boxstyle="round,pad=0.0,rounding_size=0.10",
                                facecolor="#FFFFFF" if not dead else "#FAFBFC",
                                edgecolor=(color if not dead else "#C7CFD8"),
                                lw=1.2, linestyle=((0, (4, 3)) if dead else "-"), zorder=4))
    ax.add_patch(FancyBboxPatch((x0 + 0.035, y0 + 0.16), 0.045, h - 0.32,
                                boxstyle="round,pad=0.0,rounding_size=0.02",
                                facecolor=color, edgecolor="none", zorder=5))
    icon(kind, x0 + 0.25, cy, 0.075, color if not dead else "#B9C2CB")
    ax.text(x0 + 0.46, cy + 0.17, (title if len(title) <= 13 else title[:12] + "…"), fontsize=11.5, color=(INK if not dead else "#8D97A3"),
            fontweight="600", va="center", zorder=8)
    ax.text(x0 + 0.46, cy - 0.17, meta, fontsize=8.4, color=MUT, va="center", zorder=8)
    if chip:
        ax.add_patch(FancyBboxPatch((x0 + w - 0.72, y0 + h - 0.28), 0.62, 0.22,
                                    boxstyle="round,pad=0.0,rounding_size=0.09",
                                    facecolor=chipcolor[0], edgecolor=chipcolor[1], lw=0.8, zorder=7))
        ax.text(x0 + w - 0.41, y0 + h - 0.17, chip, fontsize=8, color=chipcolor[1],
                ha="center", va="center", zorder=8)
    if tag:
        ax.add_patch(FancyBboxPatch((x0 + w - 0.98, y0 + 0.09), 0.88, 0.24,
                                    boxstyle="round,pad=0.0,rounding_size=0.10",
                                    facecolor="#FFF7E8", edgecolor="#E0B96B", lw=0.9, zorder=7))
        ax.text(x0 + w - 0.54, y0 + 0.21, "tag " + tag, fontsize=7.6, color="#A5751E",
                ha="center", va="center", family="Consolas", zorder=8)
    return (cx + w / 2, cy, cx - w / 2, cy)


def link(a, b, label=None):
    ax.plot([a[0] + 0.04, b[2] - 0.07], [a[1], b[3]], color=LINE, lw=1.5, zorder=3, solid_capstyle="round")
    ax.add_patch(FancyArrowPatch((b[2] - 0.09, b[3]), (b[2] - 0.005, b[3]), arrowstyle="-|>",
                                 mutation_scale=9, color=LINE, lw=1.5, zorder=4))
    if label:
        mx = (a[0] + b[2]) / 2
        wp = len(label) * 0.080 + 0.20
        ly = Y_TRUNK + CH / 2 + 0.20
        ax.add_patch(FancyBboxPatch((mx - wp / 2, ly - 0.11), wp, 0.22,
                                    boxstyle="round,pad=0.0,rounding_size=0.09",
                                    facecolor="#F7F9FB", edgecolor="#E9EEF3", lw=0.8, zorder=5))
        ax.text(mx, ly, label, fontsize=8.2, color="#5B6673", ha="center", va="center", zorder=6)


def materials(cx, top, items, w=CW):
    row = 0.40
    total = len(items) * (row + 0.06)
    x0 = cx - w / 2
    ax.add_patch(FancyBboxPatch((x0, top - total - 0.10), w, total + 0.10,
                                boxstyle="round,pad=0.0,rounding_size=0.09",
                                facecolor="#FBFCFD", edgecolor="#EEF2F6", lw=1, zorder=1))
    ax.plot([cx, cx], [top - 0.10, top + 0.02], color="#E7EDF3", lw=1, zorder=1)
    for i, (kind, name, meta, color) in enumerate(items):
        cy = top - 0.14 - i * (row + 0.06) - row / 2
        ax.add_patch(FancyBboxPatch((x0 + 0.07, cy - row / 2), w - 0.14, row,
                                    boxstyle="round,pad=0.0,rounding_size=0.07",
                                    facecolor="#FFFFFF", edgecolor="#E7EDF3", lw=1, zorder=3))
        icon(kind, x0 + 0.21, cy, 0.045, color)
        ax.text(x0 + 0.33, cy + 0.07, (name if len(name) <= 12 else name[:11] + "…"), fontsize=9.0, color=INK, va="center", zorder=4)
        ax.text(x0 + 0.33, cy - 0.08, meta, fontsize=7.6, color=DIM, va="center", zorder=4)


# ---------- 主干 ----------
xs = [1.95, 5.15, 8.35, 11.55, 14.75]
c1 = card(xs[0], Y_TRUNK, "让 NEO 冒充 Elite", "方案 · 2026-08-12", PLAN, "plan")
c2 = card(xs[1], Y_TRUNK, "放弃 HID，改 GATT", "决策 · 2026-09-02", DEC, "decision")
c3 = card(xs[2], Y_TRUNK, "冒用 productKey", "决策 · 2026-09-12", DEC, "decision")
c4 = card(xs[3], Y_TRUNK, "锁定基线 b6677ef", "决策 · 2026-10-15", DEC, "decision", tag="b6677ef")
c5 = card(xs[4], Y_TRUNK, "改板：加外部天线", "决策 · 2026-11-02", DEC, "decision")

link(c1, c2, "按 Plus 的 HID 试")
link(c2, c3, "GATT 能连，机型不对")
link(c3, c4, "能跑了，先固化")
link(c4, c5, "天线衰减 12dB")

# ---------- 分支 1：终止 ----------
bx = 5.05
b1 = card(bx, Y_BR, "先走 HID 流", "决策 · 2026-08-20", "#C7CFD8", "decision", dead=True,
          chip="已放弃", chipcolor=("#F3F5F7", "#8D97A3"))
ax.plot([xs[0], xs[0] + 0.55, bx - CW / 2 - 0.02], [Y_TRUNK + CH / 2, Y_BR, Y_BR],
        color="#AEB9C5", lw=1.5, zorder=3, solid_capstyle="round", solid_joinstyle="round")
ax.text(bx - CW / 2, Y_BR + CH / 2 + 0.12, "feat/hid · 从主干分出", fontsize=8.0, color="#8D97A3", zorder=6)
tx = bx + CW / 2 + 0.22
ax.plot([bx + CW / 2 + 0.06, tx - 0.02], [Y_BR, Y_BR], color="#C3CBD5", lw=1.5, ls=(0, (4, 3)), zorder=3)
ax.plot([tx, tx], [Y_BR - 0.07, Y_BR + 0.07], color="#AEB8C4", lw=1.8, zorder=5)
ax.plot([tx - 0.07, tx + 0.07], [Y_BR - 0.07, Y_BR + 0.07], color="#AEB8C4", lw=1.8, zorder=5)
ax.text(tx + 0.10, Y_BR, "尝试终止", fontsize=8.2, color="#98A5B1", va="center", zorder=5)

# ---------- 分支 2：合并 ----------
px = 13.65
b2 = card(px, Y_BR, "PCB v1 打样", "方案 · 2026-10-25", PLAN, "plan")
ax.plot([xs[3], xs[3] + 0.55, px - CW / 2 - 0.02], [Y_TRUNK + CH / 2, Y_BR, Y_BR],
        color="#AEB9C5", lw=1.5, zorder=3, solid_capstyle="round", solid_joinstyle="round")
ax.plot([px + CW / 2 + 0.02, xs[4] - 0.58], [Y_BR, Y_BR], color="#AEB9C5", lw=1.5, zorder=3)
ax.plot([xs[4] - 0.62, xs[4] - 0.30], [Y_BR, Y_TRUNK + CH / 2 + 0.02], color="#AEB9C5", lw=1.5, zorder=3)
ax.add_patch(FancyArrowPatch((xs[4] - 0.22, Y_TRUNK + CH / 2 + 0.03), (xs[4] - 0.08, Y_TRUNK + CH / 2 - 0.04),
                             arrowstyle="-|>", mutation_scale=9, color="#AEB9C5", lw=1.5, zorder=4))
ax.text(px - CW / 2, Y_BR + CH / 2 + 0.12, "feat/pcb · 从主干分出", fontsize=8.0, color="#8D97A3", zorder=6)
ax.text((px + xs[4]) / 2, Y_BR - CH / 2 - 0.20, "合并：改板采纳了这个分支", fontsize=8.0, color="#8D97A3", ha="center", zorder=6)

# ---------- 材料 ----------
materials(xs[0], Y_TRUNK - CH / 2 - 0.10, [
    ("doc", "试错记录", "资料 · 44 条", DOC),
    ("doc", "Console 反编译源码", "资料 · 已产出", DOC),
    ("data", "固件镜像", "数据 · 73 个 .bin", DATA),
])
materials(xs[2], Y_TRUNK - CH / 2 - 0.10, [
    ("data", "身份帧样本", "数据 · 37 组", DATA),
    ("data", "抓包日志", "数据 · 40 万行", DATA),
])
materials(xs[3], Y_TRUNK - CH / 2 - 0.10, [
    ("doc", "交接文档", "资料 · 已归档", DOC),
    ("code", "esp32s3-relay-dock", "代码 · 113 commits", CODE),
])

# ---------- 图例 ----------
lx = 0.55
for name, kind, color in [("决策", "decision", DEC), ("方案", "plan", PLAN), ("复盘", "retro", RET),
                          ("资料", "doc", DOC), ("数据", "data", DATA), ("代码", "code", CODE)]:
    ax.add_patch(Circle((lx + 0.12, 0.95), 0.10, facecolor=color, edgecolor="none", zorder=6))
    ax.text(lx + 0.28, 0.95, name, fontsize=8.4, color=MUT, va="center")
    lx += 0.92
ax.text(6.6, 0.95, "卡片左色条＝类型　｜　右上角徽标＝状态 / tag　｜　连线小字＝怎么走到下一步",
        fontsize=8.2, color=DIM, va="center")

fig.savefig("docs/图-主视图.png", dpi=200, facecolor="white")
print("D ok")
