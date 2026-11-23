# -*- coding: utf-8 -*-
"""视觉设计图（4 张）：主界面 / 卡片解剖 / 详情与预览 / 收进来"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, Rectangle, FancyArrowPatch
import numpy as np

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

INK = "#111827"; MUT = "#6B7A88"; DIM = "#9AA5B1"
BORDER = "#E4EAF0"; SOFT = "#F5F7FA"; TRACK = "#EEF2F6"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"; OUT = "#C08A3E"
ACC = "#2F2F5E"


def canvas(w, h):
    fig = plt.figure(figsize=(w, h), dpi=170)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w); ax.set_ylim(0, h); ax.axis("off")
    fig.patch.set_facecolor("#FFFFFF")
    return fig, ax


def panel(ax, x, y, w, h, fc="#FFFFFF", ec=BORDER, r=0.10, lw=1.0, z=3, ls="-"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.0,rounding_size={r}",
                                facecolor=fc, edgecolor=ec, lw=lw, zorder=z, linestyle=ls))


def shadow(ax, x, y, w, h, r=0.10, z=2):
    ax.add_patch(FancyBboxPatch((x + 0.02, y - 0.05), w, h, boxstyle=f"round,pad=0.0,rounding_size={r}",
                                facecolor="#EEF2F6", edgecolor="none", zorder=z))


def txt(ax, x, y, s, size=10, color=INK, weight="normal", ha="left", va="center", z=6, family=None):
    ax.text(x, y, s, fontsize=size, color=color, fontweight=weight, ha=ha, va=va, zorder=z,
            family=(family or "Microsoft YaHei"))


def icon(ax, kind, cx, cy, s, color):
    if kind == "decision":
        ax.add_patch(Polygon([[cx, cy + s], [cx + s, cy], [cx, cy - s], [cx - s, cy]],
                             closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "plan":
        ax.add_patch(Circle((cx, cy), s * 0.9, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "doc":
        ax.add_patch(Polygon([[cx - s, cy + s], [cx + s * 0.3, cy + s], [cx + s, cy + s * 0.3],
                              [cx + s, cy - s], [cx - s, cy - s]], closed=True,
                             facecolor=color, edgecolor="none", zorder=8))
    elif kind == "data":
        ax.add_patch(Rectangle((cx - s * 0.85, cy - s * 0.6), s * 1.7, s * 1.2, facecolor=color,
                               edgecolor="none", zorder=8))
        ax.add_patch(matplotlib.patches.Ellipse((cx, cy + s * 0.6), s * 1.7, s * 0.6,
                                                facecolor=color, edgecolor="none", zorder=9))
    elif kind == "code":
        ax.plot([cx - s * 0.3, cx - s, cx - s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color,
                lw=1.6, solid_capstyle="round", zorder=9)
        ax.plot([cx + s * 0.3, cx + s, cx + s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color,
                lw=1.6, solid_capstyle="round", zorder=9)
    else:
        ax.add_patch(Circle((cx, cy), s * 0.85, facecolor=color, edgecolor="none", zorder=8))


def card(ax, cx, cy, title, meta, color, kind="decision", w=2.62, h=0.96,
         dead=False, chip=None, tag=None):
    x0, y0 = cx - w / 2, cy - h / 2
    shadow(ax, x0, y0, w, h)
    panel(ax, x0, y0, w, h, "#FFFFFF" if not dead else "#FAFBFC",
          color if not dead else "#C7CFD8", r=0.09, lw=1.1, z=4, ls=("-" if not dead else (0, (4, 3))))
    ax.add_patch(FancyBboxPatch((x0 + 0.035, y0 + 0.16), 0.045, h - 0.32,
                                boxstyle="round,pad=0.0,rounding_size=0.02",
                                facecolor=color, edgecolor="none", zorder=5))
    icon(ax, kind, x0 + 0.24, cy, 0.07, color if not dead else "#B9C2CB")
    txt(ax, x0 + 0.40, cy + 0.17, (title if len(title) <= 16 else title[:15] + "…"),
        size=9.6, weight="600", color=INK if not dead else "#8D97A3")
    txt(ax, x0 + 0.40, cy - 0.17, meta, size=7.8, color=MUT)
    if chip:
        panel(ax, x0 + w - 0.66, y0 + h - 0.27, 0.58, 0.21, "#F3F5F7", "#DCE2E9", r=0.08, lw=0.8, z=7)
        txt(ax, x0 + w - 0.37, y0 + h - 0.165, chip, size=7, color="#8D97A3", ha="center", z=9)
    if tag:
        panel(ax, x0 + w - 0.90, y0 + 0.09, 0.80, 0.21, "#FFF7E8", "#E0B96B", r=0.08, lw=0.8, z=7)
        txt(ax, x0 + w - 0.50, y0 + 0.195, "tag " + tag, size=6.8, color="#A5751E", ha="center", z=9, family="Consolas")
    return x0, y0


def materials(ax, cx, top, items, w=2.62):
    row = 0.36
    total = len(items) * (row + 0.05)
    x0 = cx - w / 2
    panel(ax, x0, top - total - 0.08, w, total + 0.08, "#FBFCFD", "#EEF2F6", r=0.08, lw=0.9, z=1)
    ax.plot([cx, cx], [top - 0.08, top + 0.02], color="#E7EDF3", lw=1, zorder=1)
    for i, (kind, name, meta, color) in enumerate(items):
        cy = top - 0.12 - i * (row + 0.05) - row / 2
        panel(ax, x0 + 0.06, cy - row / 2, w - 0.12, row, "#FFFFFF", "#E7EDF3", r=0.06, lw=0.9, z=3)
        icon(ax, kind, x0 + 0.19, cy, 0.042, color)
        txt(ax, x0 + 0.30, cy + 0.065, (name if len(name) <= 11 else name[:10] + "…"), size=8, color=INK)
        txt(ax, x0 + 0.30, cy - 0.075, meta, size=6.8, color=DIM)


# =====================================================================
# 图 1：整窗主界面
# =====================================================================
fig, ax = canvas(14.4, 9.0)

# 顶栏
panel(ax, 0, 8.42, 14.4, 0.58, "#FFFFFF", "#EDF1F5", r=0.0, lw=1.0, z=5)
ax.add_patch(Circle((0.42, 8.71), 0.055, facecolor=DEC, edgecolor="none", zorder=7))
txt(ax, 0.55, 8.71, "项目Git", size=10.5, weight="600", color=ACC)
for i, name in enumerate(["大创 · 舆情 RAG", "ESP32 中继底座", "TourBox 协议逆向", "千问大赛"]):
    x = 1.62 + i * 1.42
    if i == 1:
        panel(ax, x - 0.10, 8.55, 1.46, 0.32, "#EDF0F8", "#EDF0F8", r=0.07, lw=0, z=6)
        txt(ax, x + 0.63, 8.71, name, size=8.4, color=ACC, weight="600", ha="center")
    else:
        txt(ax, x, 8.71, name, size=8.6, color=MUT)
panel(ax, 10.55, 8.55, 2.10, 0.32, "#FFFFFF", "#E4EAF0", r=0.07, lw=1.0, z=6)
txt(ax, 10.68, 8.71, "搜索", size=8.4, color=DIM)
panel(ax, 12.85, 8.53, 0.95, 0.34, ACC, ACC, r=0.07, lw=0, z=6)
txt(ax, 13.32, 8.70, "收进来", size=8.4, color="#FFFFFF", ha="center")
panel(ax, 13.92, 8.53, 0.34, 0.34, "#FFFFFF", "#E4EAF0", r=0.07, lw=1.0, z=6)
txt(ax, 14.09, 8.70, "···", size=9, color=MUT, ha="center")

# 画布底
panel(ax, 0, 0, 14.4, 8.42, "#FCFDFE", "#FFFFFF", r=0.0, lw=0, z=1)
ax.plot([10.62, 10.62], [0, 8.42], color="#EDF1F5", lw=1.2, zorder=2)

# 主干卡片
Y = 5.55
xs = [1.75, 4.75, 7.75]
c1 = card(ax, xs[0], Y, "让 NEO 冒充 Elite", "方案 · 08-12", PLAN, "plan")
c2 = card(ax, xs[1], Y, "放弃 HID，改 GATT", "决策 · 09-02", DEC)
c3 = card(ax, xs[2], Y, "冒用 productKey", "决策 · 09-12", DEC, tag="b6677ef")


for a, b, lab in [(xs[0], xs[1], "按 Plus 的 HID 试"), (xs[1], xs[2], "GATT 能连，机型不对")]:
    ax.annotate("", xy=(b - 1.32, Y), xytext=(a + 1.32, Y),
                arrowprops=dict(arrowstyle="-|>", color="#CBD5DF", lw=1.4), zorder=3)
    panel(ax, (a + b) / 2 - 0.52, Y + 0.66, 1.04, 0.22, "#F7F9FB", "#E9EEF3", r=0.08, lw=0.8, z=4)
    txt(ax, (a + b) / 2, Y + 0.77, lab, size=6.8, color="#5B6673", ha="center")

# 分支（终止）
bx = 2.55
b1 = card(ax, bx, 7.15, "先走 HID 流", "决策 · 08-20", "#C7CFD8", "decision", dead=True, chip="已放弃")
ax.plot([xs[0], xs[0] + 0.35, bx - 1.32], [Y + 0.48, 7.15, 7.15], color="#AEB9C5", lw=1.4, zorder=3)
txt(ax, bx - 1.15, 7.62, "feat/hid", size=6.8, color="#8D97A3")
tx = bx + 1.30
ax.plot([bx + 1.32, tx + 0.02], [7.15, 7.15], color="#C3CBD5", lw=1.4, ls=(0, (4, 3)), zorder=3)
ax.plot([tx, tx], [7.09, 7.21], color="#AEB8C4", lw=1.6, zorder=5)
ax.plot([tx - 0.06, tx + 0.06], [7.09, 7.21], color="#AEB8C4", lw=1.6, zorder=5)
txt(ax, tx + 0.10, 7.15, "尝试终止", size=6.8, color="#98A5B1")

# 材料
materials(ax, xs[0], Y - 0.60, [("doc", "试错记录", "资料 · 44 条", DOC),
                                ("data", "固件镜像", "数据 · 73 个", DATA)])
materials(ax, xs[2], Y - 0.60, [("data", "身份帧样本", "数据 · 37 组", DATA),
                                ("doc", "交接文档", "资料 · 已归档", DOC)])

# 右侧详情面板
PX = 10.62
panel(ax, PX, 0, 3.78, 8.42, "#FFFFFF", "#EDF1F5", r=0.0, lw=0, z=3)
txt(ax, PX + 0.30, 7.78, "放弃 HID，改 GATT 直连", size=11.4, weight="600")
txt(ax, PX + 0.30, 7.48, "决策 · 2026-09-02 · 有效", size=8.2, color=DIM)
panel(ax, PX + 0.30, 7.02, 3.18, 0.02, "#F1F4F7", "#F1F4F7", r=0, lw=0, z=4)
txt(ax, PX + 0.30, 6.72, "HID 描述符不完整，Console 走", size=8.4, color="#4B5563")
txt(ax, PX + 0.30, 6.48, "GATT 直连；广播名保留 Elite。", size=8.4, color="#4B5563")

txt(ax, PX + 0.30, 6.00, "出处", size=7.2, color=DIM)
panel(ax, PX + 0.30, 5.10, 3.18, 0.74, "#F8FAFB", "#EEF2F6", r=0.08, lw=0.9, z=4)
txt(ax, PX + 0.44, 5.62, "中继底座-试错记录.md", size=8.2, color="#374151")
txt(ax, PX + 0.44, 5.40, "第 393–413 字", size=7.2, color=DIM)
panel(ax, PX + 0.42, 5.16, 2.94, 0.18, "#FFFFFF", "#E7EDF3", r=0.05, lw=0.8, z=5)
txt(ax, PX + 0.50, 5.25, "这是稳定基线（git b6677ef）", size=6.6, color="#4B5563")

panel(ax, PX + 0.30, 4.62, 1.58, 0.32, ACC, ACC, r=0.07, lw=0, z=5)
txt(ax, PX + 1.09, 4.78, "在应用内打开", size=7.4, color="#FFFFFF", ha="center")
panel(ax, PX + 1.96, 4.62, 1.10, 0.32, "#FFFFFF", "#DCE2E9", r=0.07, lw=1.0, z=5)
txt(ax, PX + 2.51, 4.78, "外部打开", size=7.4, color="#4B5563", ha="center")

txt(ax, PX + 0.30, 4.18, "字段", size=7.2, color=DIM)
for i, (k, v) in enumerate([("结论", "GATT 直连"), ("理由", "HID 描述符不完整"), ("负责人", "张伟")]):
    yy = 3.90 - i * 0.30
    txt(ax, PX + 0.30, yy, k, size=7.6, color=DIM)
    txt(ax, PX + 1.10, yy, v, size=7.6, color="#374151")

txt(ax, PX + 0.30, 2.90, "关联", size=7.2, color=DIM)
for i, (k, v) in enumerate([("属于", "先走 HID 流（已放弃）"), ("被引用", "锁定基线 b6677ef"),
                            ("相关", "BLE 服务实现")]):
    yy = 2.62 - i * 0.28
    txt(ax, PX + 0.30, yy, k, size=7.0, color=DIM)
    txt(ax, PX + 0.80, yy, v, size=7.6, color="#374151")

fig.savefig("docs/图-1-主界面.png", dpi=170, facecolor="white")
plt.close(fig)

# =====================================================================
# 图 2：卡片解剖
# =====================================================================
fig, ax = canvas(14.4, 8.0)
txt(ax, 0.6, 7.45, "卡片解剖", size=15, weight="bold", color=INK)
txt(ax, 0.6, 7.05, "一张卡片承载一条提交：类型、标题、时间、状态、里程碑", size=9, color=MUT)

CX, CY, CW, CH = 5.6, 4.6, 4.6, 1.92
shadow(ax, CX - CW / 2, CY - CH / 2, CW, CH, r=0.14)
panel(ax, CX - CW / 2, CY - CH / 2, CW, CH, "#FFFFFF", DEC, r=0.14, lw=1.6, z=4)
ax.add_patch(FancyBboxPatch((CX - CW / 2 + 0.07, CY - CH / 2 + 0.34), 0.09, CH - 0.68,
                            boxstyle="round,pad=0.0,rounding_size=0.04",
                            facecolor=DEC, edgecolor="none", zorder=5))
icon(ax, "decision", CX - CW / 2 + 0.52, CY, 0.16, DEC)
txt(ax, CX - CW / 2 + 0.86, CY + 0.36, "放弃 HID，改 GATT 直连", size=15.5, weight="600")
txt(ax, CX - CW / 2 + 0.86, CY - 0.32, "决策 · 2026-09-02 · 有效", size=10.2, color=MUT)
panel(ax, CX + CW / 2 - 1.28, CY + CH / 2 - 0.50, 1.08, 0.36, "#F3F5F7", "#DCE2E9", r=0.12, lw=1.0, z=7)
txt(ax, CX + CW / 2 - 0.74, CY + CH / 2 - 0.32, "已放弃", size=8.6, color="#8D97A3", ha="center")
panel(ax, CX + CW / 2 - 1.60, CY - CH / 2 + 0.18, 1.40, 0.36, "#FFF7E8", "#E0B96B", r=0.12, lw=1.0, z=7)
txt(ax, CX + CW / 2 - 0.90, CY - CH / 2 + 0.36, "tag b6677ef", size=8.4, color="#A5751E",
    ha="center", family="Consolas")

# 标注
notes = [
    (CX + CW / 2 + 0.1, CY + CH / 2 + 1.5, "-0.9", "卡片 230×96，圆角 10"),
    (CX - CW / 2 - 0.2, CY + 0.9, "0.8", "左色条 4px = 类型色"),
    (CX - CW / 2 + 0.9, CY + 0.95, "-0.4", "图标 24px"),
    (CX + 0.3, CY + 0.75, "0.6", "标题 11.5px / 600"),
    (CX + 0.3, CY - 0.75, "-0.8", "副标题 8.4px：类型 · 时间 · 状态"),
    (CX + CW / 2 + 0.25, CY + CH / 2 - 0.35, "0.9", "状态徽标：已放弃 / 已取代 / 草稿"),
    (CX + CW / 2 + 0.25, CY - CH / 2 + 0.36, "-1.0", "tag 徽标：米底金边、等宽字体"),
]
for nx, ny, dy, label in notes:
    txt(ax, nx + (0.06 if nx > CX else -0.06), ny + 0.12, label, size=9, color="#374151",
        ha=("left" if nx > CX else "right"))

# 三种状态
states = [
    ("正常", "active", DEC, False, None, None),
    ("已放弃", "abandoned", "#C7CFD8", True, "已放弃", None),
    ("已取代", "superseded", "#B9C2CB", False, "已取代", None),
]
txt(ax, 0.6, 2.35, "三种状态", size=11, weight="600", color=ACC)
for i, (label, _, color, dead, chip, tag) in enumerate(states):
    cx = 2.0 + i * 3.6
    card(ax, cx, 1.35, "冒用 productKey", "决策 · 09-12", color, "decision", w=2.9, h=1.05,
         dead=dead, chip=chip, tag=tag)
    txt(ax, cx, 0.48, label, size=9, color=MUT, ha="center")

fig.savefig("docs/图-2-卡片解剖.png", dpi=170, facecolor="white")
plt.close(fig)

# =====================================================================
# 图 3：详情与预览
# =====================================================================
fig, ax = canvas(14.4, 8.6)
txt(ax, 0.6, 8.1, "详情面板 与 应用内预览", size=15, weight="bold", color=INK)
txt(ax, 0.6, 7.72, "点卡片 → 右栏出详情（出处置顶）→ 点「在应用内打开」→ 文件在应用内渲染并跳到命中句", size=9, color=MUT)

# 左：详情
LX, LY, LW, LH = 0.6, 1.2, 3.5, 6.0
shadow(ax, LX, LY, LW, LH)
panel(ax, LX, LY, LW, LH, "#FFFFFF", "#EDF1F5", r=0.12, lw=1.0)
txt(ax, LX + 0.28, LY + LH - 0.55, "放弃 HID，改 GATT", size=11, weight="600")
txt(ax, LX + 0.28, LY + LH - 0.85, "决策 · 2026-09-02", size=8, color=DIM)
txt(ax, LX + 0.28, LY + LH - 1.35, "HID 描述符不完整，", size=8.2, color="#4B5563")
txt(ax, LX + 0.28, LY + LH - 1.60, "改走 GATT 直连。", size=8.2, color="#4B5563")
txt(ax, LX + 0.28, LY + LH - 2.10, "出处", size=7, color=DIM)
panel(ax, LX + 0.28, LY + LH - 3.05, 2.94, 0.80, "#F8FAFB", "#EEF2F6", r=0.08, lw=0.9, z=5)
txt(ax, LX + 0.42, LY + LH - 2.50, "中继底座-试错记录.md", size=8, color="#374151")
txt(ax, LX + 0.42, LY + LH - 2.72, "第 393–413 字", size=7, color=DIM)
panel(ax, LX + 0.28, LY + LH - 3.65, 1.55, 0.32, ACC, ACC, r=0.07, lw=0, z=5)
txt(ax, LX + 1.05, LY + LH - 3.49, "在应用内打开", size=7.2, color="#FFFFFF", ha="center")
txt(ax, LX + 0.28, LY + 0.55, "关联 · 属于 / 被引用 / 相关", size=7.4, color=DIM)

# 右：预览
PX, PY, PW, PH = 4.55, 1.2, 9.25, 6.0
shadow(ax, PX, PY, PW, PH)
panel(ax, PX, PY, PW, PH, "#FFFFFF", "#EDF1F5", r=0.12, lw=1.0)
panel(ax, PX, PY + PH - 0.62, PW, 0.62, "#FFFFFF", "#EDF1F5", r=0.12, lw=0, z=4)
ax.plot([PX, PX + PW], [PY + PH - 0.62, PY + PH - 0.62], color="#EDF1F5", lw=1, zorder=5)
txt(ax, PX + 0.30, PY + PH - 0.31, "中继底座-试错记录.md", size=9, color="#374151")
panel(ax, PX + PW - 1.95, PY + PH - 0.48, 0.85, 0.30, "#FFFFFF", "#DCE2E9", r=0.07, lw=0.9, z=6)
txt(ax, PX + PW - 1.52, PY + PH - 0.33, "外部打开", size=7, color="#4B5563", ha="center")
txt(ax, PX + PW - 0.35, PY + PH - 0.33, "×", size=10, color=DIM, ha="center")

# 文档内容（模拟 Markdown 渲染）
yy = PY + PH - 1.15
txt(ax, PX + 0.36, yy, "阶段一：BLE 仿真（Windows 端）", size=12.5, weight="600")
yy -= 0.52
ax.plot([PX + 0.36, PX + 0.40], [yy - 0.26, yy + 0.26], color="#D5DEE7", lw=2.4, zorder=5)
txt(ax, PX + 0.58, yy + 0.14, "目的：把每一次尝试的结果和证据留下来。", size=8.4, color="#4B5563")
txt(ax, PX + 0.58, yy - 0.14, "每条都标注：做法 → 结果 → 证据 → 结论。", size=8.4, color="#4B5563")

yy -= 0.75
# 表格
tbl_x, tbl_w = PX + 0.36, PW - 0.72
colws = [0.5, 2.3, 2.0, 2.6, 1.4]
for i in range(5):
    txt(ax, tbl_x + 0.08 + sum(colws[:i]), yy, ["#", "尝试", "结果", "证据", "结论"][i], size=7.6, color=MUT)
ax.plot([tbl_x, tbl_x + tbl_w], [yy - 0.18, yy - 0.18], color="#EDF1F5", lw=1, zorder=5)

rows = [
    ("1", "广播名 Elite + 厂商 01", "Windows Console 可用", "Console 显示设备可用", "稳定基线"),
    ("2", "广播名改 Elite Plus", "卡「正在连接」", "只订阅 FFF1，从不发 55", "分流到 HID"),
    ("3", "名字 Plus + 真 HID 服务", "仍卡住", "订阅后仍无 55", "描述符不完整"),
]
for r, (n, a, b, c, d) in enumerate(rows):
    ry = yy - 0.45 - r * 0.62
    if r == 1:
        panel(ax, tbl_x - 0.04, ry - 0.26, tbl_w + 0.08, 0.52, "#FFFDF5", "#F3E6C4", r=0.06, lw=0.8, z=4)
    for i, val in enumerate([n, a, b, c, d]):
        txt(ax, tbl_x + 0.08 + sum(colws[:i]), ry, val, size=7.4,
            color=("#5A4400" if (r == 1 and i == 4) else "#374151"))
    if r == 1:
        panel(ax, tbl_x + 0.08 + sum(colws[:4]) - 0.04, ry - 0.13, 1.30, 0.26,
              "#FFF0B3", "#F0D98A", r=0.05, lw=0, z=5)
        txt(ax, tbl_x + 0.08 + sum(colws[:4]) + 0.02, ry, "分流到 HID", size=7.4, color="#5A4400")
    ax.plot([tbl_x, tbl_x + tbl_w], [ry - 0.31, ry - 0.31], color="#F1F4F7", lw=0.8, zorder=4)

# 高亮说明
panel(ax, PX + 0.36, PY + 0.30, 2.6, 0.42, "#FFFBEB", "#F3E6C4", r=0.08, lw=0.9, z=6)
txt(ax, PX + 0.50, PY + 0.51, "自动滚到命中句并高亮", size=7.4, color="#8A6A1E")

fig.savefig("docs/图-3-详情与预览.png", dpi=170, facecolor="white")
plt.close(fig)

# =====================================================================
# 图 4：收进来
# =====================================================================
fig, ax = canvas(14.4, 8.4)
panel(ax, 0, 0, 14.4, 8.4, "#F4F6F9", "#F4F6F9", r=0.0, lw=0, z=1)
txt(ax, 0.8, 7.85, "收进来：粘一段，切条，归位", size=15, weight="bold", color=INK)
txt(ax, 0.8, 7.45, "左边是原文，右边是切出来的条目与它们的去处；拿不准的绝不静默丢弃", size=9, color=MUT)

# 弹窗
MX, MY, MW, MH = 1.1, 1.0, 12.2, 5.9
shadow(ax, MX, MY, MW, MH, r=0.16)
panel(ax, MX, MY, MW, MH, "#FFFFFF", "#E4EAF0", r=0.16, lw=1.2)
txt(ax, MX + 0.42, MY + MH - 0.45, "收进来", size=11.5, weight="600")

# 左：原文
txt(ax, MX + 0.42, MY + MH - 0.90, "粘贴内容", size=7.4, color=DIM)
panel(ax, MX + 0.42, MY + 0.55, 5.6, 3.95, "#FBFCFD", "#E7EDF3", r=0.10, lw=1.0, z=5)
lines = [
    ("张伟 09-02 14:20", "HID 那条路走不通了，Console 一直卡"),
    ("", "在「正在连接」，我们改走 GATT 直连。"),
    ("李娜 09-02 14:26", "那广播名还叫 Elite 吗？"),
    ("张伟 09-02 14:31", "先保留 Elite，把 productKey 改成它自"),
    ("", "己的，让 NEO 认成 Plus。"),
    ("王强 09-12 10:05", "能跑通了，先把基线钉在 b6677ef。"),
]
ly = MY + MH - 1.35
for who, text in lines:
    if who:
        txt(ax, MX + 0.60, ly, who, size=6.8, color=DIM)
        ly -= 0.30
    txt(ax, MX + 0.60, ly, text, size=8.0, color="#374151")
    ly -= 0.42

# 右：切条结果
txt(ax, MX + 6.35, MY + MH - 0.90, "切出 4 条 · 去处", size=7.4, color=DIM)
rows = [
    ("放弃 HID，改 GATT 直连", "决策 · 09-02", "自动挂到「让 NEO 冒充」", "#EAF7EF", "#8CC7A4", "#2F7A4F"),
    ("广播名保留 Elite", "决策 · 09-02", "自动挂到「放弃 HID」", "#EAF7EF", "#8CC7A4", "#2F7A4F"),
    ("让 NEO 认成 Plus 的办法", "方案 · 09-02", "拿不准，问你一句", "#FFF7E8", "#E6C77E", "#8A6A1E"),
    ("把基线钉在 b6677ef", "决策 · 09-12", "进了待归类队列", "#F2F4F7", "#D5DDE4", "#5B6673"),
]
ry = MY + MH - 1.40
for title, meta, where, fc, ec, tc in rows:
    panel(ax, MX + 6.35, ry - 0.66, 5.35, 0.62, "#FFFFFF", "#EDF1F5", r=0.09, lw=1.0, z=5)
    txt(ax, MX + 6.55, ry - 0.26, title, size=8.6, color=INK)
    txt(ax, MX + 6.55, ry - 0.50, meta, size=7.0, color=DIM)
    panel(ax, MX + 9.30, ry - 0.44, 2.20, 0.30, fc, ec, r=0.07, lw=0.9, z=6)
    txt(ax, MX + 10.40, ry - 0.29, where, size=6.8, color=tc, ha="center")
    ry -= 0.76

# 底部按钮
panel(ax, MX + MW - 3.55, MY + 0.35, 1.35, 0.42, "#FFFFFF", "#DCE2E9", r=0.08, lw=1.0, z=6)
txt(ax, MX + MW - 2.88, MY + 0.56, "取消", size=8, color="#4B5563", ha="center")
panel(ax, MX + MW - 2.00, MY + 0.35, 1.65, 0.42, ACC, ACC, r=0.08, lw=0, z=6)
txt(ax, MX + MW - 1.18, MY + 0.56, "确认归位", size=8, color="#FFFFFF", ha="center")

# 标注
txt(ax, 1.1, 0.55, "切条规则：按「说话人 + 时间」切；少于 4 字丢弃并记日志；[图片] 等占位符单独标记", size=8, color=DIM)

fig.savefig("docs/图-4-收进来.png", dpi=170, facecolor="white")
plt.close(fig)
print("4 plates ok")
