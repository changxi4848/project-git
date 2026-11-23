# -*- coding: utf-8 -*-
"""设计图公共绘图库：统一卡片、字体、换行、图标"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, Rectangle, Ellipse

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False

INK = "#111827"; MUT = "#6B7A88"; DIM = "#9AA5B1"
BORDER = "#E4EAF0"; SOFT = "#F5F7FA"; SHADOWC = "#EEF2F6"
DEC = "#D9534F"; PLAN = "#3F8FC4"; RET = "#7C6BC4"; DOC = "#A1785A"; DATA = "#3F9D94"; CODE = "#5F7590"; OUT = "#C08A3E"
ACC = "#2F2F5E"

# 字号（pt）——设计稿的统一口径
FS_TITLE = 11.0      # 卡片标题
FS_META = 8.2        # 卡片副标题
FS_LABEL = 8.6       # 正文/说明
FS_TINY = 7.4        # 最小号
LINE_GAP = 0.98      # 行距系数


def canvas(w, h, dpi=170):
    fig = plt.figure(figsize=(w, h), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w); ax.set_ylim(0, h); ax.axis("off")
    fig.patch.set_facecolor("#FFFFFF")
    return fig, ax


def panel(ax, x, y, w, h, fc="#FFFFFF", ec=BORDER, r=0.10, lw=1.0, z=3, ls="-"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.0,rounding_size={r}",
                                facecolor=fc, edgecolor=ec, lw=lw, zorder=z, linestyle=ls))


def shadow(ax, x, y, w, h, r=0.10, z=2):
    ax.add_patch(FancyBboxPatch((x + 0.02, y - 0.055), w, h,
                                boxstyle=f"round,pad=0.0,rounding_size={r}",
                                facecolor=SHADOWC, edgecolor="none", zorder=z))


def txt(ax, x, y, s, size=FS_LABEL, color=INK, weight="normal", ha="left", va="center", z=9, family=None):
    ax.text(x, y, s, fontsize=size, color=color, fontweight=weight, ha=ha, va=va, zorder=z,
            family=(family or "Microsoft YaHei"))


def text_w(s, size):
    """估算文本宽度（英寸）：中文 1 字宽 = size，英文 ≈ 0.55"""
    pt = 0.0
    for ch in s:
        pt += size * (1.05 if ord(ch) > 0x2E80 else 0.58)
    return pt / 72.0


def wrap(s, size, max_w, max_lines=3):
    """按宽度换行：中文按字断，英文按词断（不拆单词）"""
    import re
    tokens = re.findall(r"[A-Za-z0-9_.\-]+|\s+|.", s, flags=re.UNICODE)
    lines, cur = [], ""
    for tk in tokens:
        if text_w(cur + tk, size) <= max_w or not cur:
            cur += tk
        else:
            if tk == " " or cur.endswith(" "):
                lines.append(cur.rstrip()); cur = tk.lstrip()
            elif re.fullmatch(r"[A-Za-z0-9_.\-]+", tk) and text_w(cur, size) < max_w * 0.72:
                lines.append(cur.rstrip()); cur = tk
            else:
                lines.append(cur.rstrip()); cur = tk
            if len(lines) >= max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur.rstrip())
    return lines


def icon(ax, kind, cx, cy, s, color):
    if kind == "decision":
        ax.add_patch(Polygon([[cx, cy + s], [cx + s, cy], [cx, cy - s], [cx - s, cy]],
                             closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "plan":
        ax.add_patch(Circle((cx, cy), s * 0.92, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "retro":
        ax.add_patch(Circle((cx, cy), s * 0.92, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "output":
        import numpy as np
        pts = []
        for i in range(10):
            a = np.pi / 5 * i - np.pi / 2
            r = s if i % 2 == 0 else s * 0.45
            pts.append([cx + np.cos(a) * r, cy + np.sin(a) * r])
        ax.add_patch(Polygon(pts, closed=True, facecolor=color, edgecolor="none", zorder=8))
    elif kind == "doc":
        ax.add_patch(Polygon([[cx - s, cy + s], [cx + s * 0.3, cy + s], [cx + s, cy + s * 0.3],
                              [cx + s, cy - s], [cx - s, cy - s]], closed=True,
                             facecolor=color, edgecolor="none", zorder=8))
    elif kind == "data":
        ax.add_patch(Ellipse((cx, cy + s * 0.62), s * 1.75, s * 0.62, facecolor=color, edgecolor="none", zorder=9))
        ax.add_patch(Rectangle((cx - s * 0.875, cy - s * 0.62), s * 1.75, s * 1.24, facecolor=color,
                               edgecolor="none", zorder=8))
        ax.add_patch(Ellipse((cx, cy - s * 0.62), s * 1.75, s * 0.62, facecolor=color, edgecolor="none", zorder=9))
    elif kind == "code":
        ax.plot([cx - s * 0.3, cx - s, cx - s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color,
                lw=1.7, solid_capstyle="round", zorder=9)
        ax.plot([cx + s * 0.3, cx + s, cx + s * 0.3], [cy + s * 0.7, cy, cy - s * 0.7], color=color,
                lw=1.7, solid_capstyle="round", zorder=9)
    else:
        ax.add_patch(Circle((cx, cy), s * 0.85, facecolor=color, edgecolor="none", zorder=8))


def card(ax, cx, cy, title, meta, color, kind="decision", w=3.20, dead=False, chip=None, tag=None):
    """卡片：标题按宽度自动换行（最多 2 行），高度随行数变化。返回 (x0,y0,w,h,cy)"""
    pad_x = 0.46                 # 图标区宽度
    inner = w - pad_x - 0.16     # 文本可用宽度
    if chip:
        inner -= text_w(chip, FS_TINY) + 0.30
    lines = wrap(title, FS_TITLE, inner, max_lines=2)
    title_h = len(lines) * (FS_TITLE / 72.0) * LINE_GAP + 0.06
    h = max(0.92, title_h + 0.52)
    x0, y0 = cx - w / 2, cy - h / 2

    shadow(ax, x0, y0, w, h, r=0.10)
    panel(ax, x0, y0, w, h, "#FFFFFF", color, r=0.10, lw=1.1, z=4,
          ls=("-" if not dead else (0, (4, 3))))
    ax.add_patch(FancyBboxPatch((x0 + 0.09, y0 + 0.16), 0.055, h - 0.32,
                                boxstyle="round,pad=0.0,rounding_size=0.02",
                                facecolor=color, edgecolor="none", zorder=5))
    icon(ax, kind, x0 + pad_x * 0.62, cy, 0.085, color if not dead else "#B9C2CB")

    top = cy + h / 2 - 0.20
    for i, line in enumerate(lines):
        txt(ax, x0 + pad_x, top - i * (FS_TITLE / 72.0) * LINE_GAP, line, size=FS_TITLE,
            weight="600", color=INK if not dead else "#8D97A3", va="top")
    txt(ax, x0 + pad_x, y0 + 0.20, meta, size=FS_META, color=MUT)

    if chip:
        cw = text_w(chip, FS_TINY) + 0.26
        panel(ax, x0 + w - cw - 0.12, y0 + h - 0.34, cw, 0.24, "#F3F5F7", "#DCE2E9", r=0.08, lw=0.8, z=7)
        txt(ax, x0 + w - 0.12 - cw / 2, y0 + h - 0.22, chip, size=FS_TINY, color="#8D97A3", ha="center")
    if tag:
        tw = text_w("tag " + tag, FS_TINY) + 0.24
        panel(ax, x0 + w - tw - 0.12, y0 + 0.10, tw, 0.24, "#FFF7E8", "#E0B96B", r=0.08, lw=0.8, z=7)
        txt(ax, x0 + w - 0.12 - tw / 2, y0 + 0.22, "tag " + tag, size=FS_TINY, color="#A5751E",
            ha="center", family="Consolas")
    return dict(x0=x0, y0=y0, w=w, h=h, cy=cy, cx=cx, top=y0 + h, bottom=y0)


def materials(ax, cx, top, items, w=3.20, row=0.40):
    total = len(items) * (row + 0.05)
    x0 = cx - w / 2
    panel(ax, x0, top - total - 0.08, w, total + 0.10, "#FBFCFD", "#EEF2F6", r=0.08, lw=0.9, z=1)
    ax.plot([cx, cx], [top - 0.08, top + 0.02], color="#E7EDF3", lw=1, zorder=1)
    for i, (kind, name, meta, color) in enumerate(items):
        cy = top - 0.13 - i * (row + 0.05) - row / 2
        panel(ax, x0 + 0.07, cy - row / 2, w - 0.14, row, "#FFFFFF", "#E7EDF3", r=0.06, lw=0.9, z=3)
        icon(ax, kind, x0 + 0.21, cy, 0.045, color)
        lines = wrap(name, FS_TINY + 0.8, w - 0.42, max_lines=1)
        txt(ax, x0 + 0.32, cy + 0.08, lines[0] if lines else name, size=FS_TINY + 0.8, color=INK)
        txt(ax, x0 + 0.32, cy - 0.08, meta, size=FS_TINY - 0.4, color=DIM)
    return total
