# -*- coding: utf-8 -*-
"""软件架构图（Electron 双层）"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

W, H = 13.0, 6.6
fig, ax = plt.subplots(figsize=(W, H), dpi=200)
ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
fig.patch.set_facecolor("#FFFFFF")

INK = "#1F2933"; MUT = "#6B7A88"; ACC = "#2F2F5E"; LINE = "#C7D2DD"
F1 = "#F4F7FA"; F2 = "#F7FAF5"; F3 = "#FFF9EF"; F4 = "#FBF5F5"


def box(x, y, w, h, title, body, fc, ec):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor=fc, edgecolor=ec, lw=1.2, zorder=3))
    ax.text(x + w / 2, y + h - 0.26, title, fontsize=10.5, fontweight="bold", color=INK,
            ha="center", va="center", zorder=5)
    ax.text(x + w / 2, y + h / 2 - 0.18, body, fontsize=8.6, color=MUT, ha="center", va="center",
            linespacing=1.6, zorder=5)


def arrow(x1, y1, x2, y2, label="", color="#8B98A6", ls="-"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="<|-|>", mutation_scale=12,
                                 color=color, lw=1.2, ls=ls, zorder=2, shrinkA=2, shrinkB=2))
    if label:
        ax.text((x1 + x2) / 2, max(y1, y2) + 0.16, label, fontsize=8, color=MUT, ha="center")


ax.text(0.45, 6.25, "项目Git · 软件架构", fontsize=15, fontweight="bold", color=ACC)
ax.text(0.45, 5.96, "Electron 两层：渲染层只画界面，主进程做判定与数据；中间用 preload 白名单桥接",
        fontsize=9.2, color=MUT)

# 渲染层
box(0.45, 2.35, 3.6, 3.1, "渲染层（Renderer）",
    "Canvas 提交图\n右侧详情面板\n顶部项目 / 搜索\n收进来弹窗\n\n不碰文件系统\n不碰网络", F1, "#9DB4C7")

# preload
box(4.55, 3.25, 2.4, 1.35, "preload 桥",
    "contextBridge\n白名单 API\n15 个方法", F3, "#E0B96B")

# 主进程
box(7.45, 1.55, 5.1, 3.9, "主进程（Main）",
    "IPC 路由\nengine.js  切条 / 判定 / 检索\nstore.js  状态读写 + 撤销栈\nfile:open  文本偏移 / PDF 渲染\ngit:sync   只读 git log",
    F2, "#9CB98A")

# 数据与系统
box(7.45, 0.35, 2.45, 0.95, "本地数据", "state.json\nfiles/", F1, "#9DB4C7")
box(10.1, 0.35, 2.45, 0.95, "系统能力", "shell.openPath\ngit CLI", F4, "#C9A0A0")

arrow(4.05, 3.9, 4.55, 3.9, "IPC 调用")
arrow(6.95, 3.9, 7.45, 3.9, "")
arrow(8.6, 1.55, 8.6, 1.30, "")
arrow(11.3, 1.55, 11.3, 1.30, "")

ax.text(0.45, 1.75, "数据流：用户操作 → IPC → engine 判定 → store 落盘 → 返回快照 → 渲染",
        fontsize=8.8, color=MUT)
ax.text(0.45, 1.42, "安全边界：渲染层不允许 fs / child_process；只有 preload 暴露的方法可用",
        fontsize=8.8, color=MUT)
ax.text(0.45, 1.09, "无服务器、无端口、无网络请求；断网可用",
        fontsize=8.8, color=MUT)

plt.tight_layout(pad=0.3)
fig.savefig("docs/soft-arch.png", dpi=200, bbox_inches="tight", facecolor="white")
print("ok")
