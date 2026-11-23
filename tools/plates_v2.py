# -*- coding: utf-8 -*-
"""卡片式设计图（主视图 / 主界面 / 卡片解剖）——统一字号与换行"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, FancyArrowPatch
from plate_lib import (canvas, panel, shadow, txt, icon, card, materials,
                       INK, MUT, DIM, BORDER, DEC, PLAN, RET, DOC, DATA, CODE, OUT, ACC,
                       FS_TITLE, FS_META, FS_LABEL, FS_TINY, text_w)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")


# =====================================================================
# 图：主视图（卡片式提交图）
# =====================================================================
def plate_main():
    W, H = 16.8, 8.2
    fig, ax = canvas(W, H)
    Y = 4.55
    xs = [2.30, 6.10, 9.90, 13.70]

    txt(ax, 0.6, 7.88, "主视图 · 卡片式提交图", size=16, weight="bold", color=INK)
    txt(ax, 0.6, 7.52, "骨架仍是 Git：主干一串提交、分叉是尝试、× 是终止、汇合是被采纳、旗子是里程碑",
        size=9.2, color=MUT)
    txt(ax, 16.2, 7.88, "主干 4 次提交 · 分支 2 条（1 终止 · 1 合并）", size=8.4, color=DIM, ha="right")

    c1 = card(ax, xs[0], Y, "让 NEO 冒充 Elite", "方案 · 2026-08-12", PLAN, "plan")
    c2 = card(ax, xs[1], Y, "放弃 HID，改 GATT 直连", "决策 · 2026-09-02", DEC)
    c3 = card(ax, xs[2], Y, "冒用 productKey", "决策 · 2026-09-12", DEC)
    c4 = card(ax, xs[3], Y, "锁定基线 b6677ef", "决策 · 2026-10-15", DEC, tag="b6677ef")

    labels = ["按 Plus 的 HID 试", "GATT 能连，机型不对", "能跑了，先固化"]
    for i, lab in enumerate(labels):
        a, b = xs[i], xs[i + 1]
        ay = Y
        ax.annotate("", xy=(b - c4["w"] / 2 - 0.05, ay), xytext=(a + c4["w"] / 2 + 0.05, ay),
                    arrowprops=dict(arrowstyle="-|>", color="#CBD5DF", lw=1.5), zorder=3)
        wp = text_w(lab, FS_TINY) + 0.26
        mx = (a + b) / 2
        panel(ax, mx - wp / 2, Y + c2["h"] / 2 + 0.14, wp, 0.26, "#F7F9FB", "#E9EEF3", r=0.09, lw=0.8, z=5)
        txt(ax, mx, Y + c2["h"] / 2 + 0.27, lab, size=FS_TINY, color="#5B6673", ha="center")

    # 分支 1：终止
    bx = 4.05
    b1 = card(ax, bx, 6.42, "先走 HID 流", "决策 · 2026-08-20", "#C7CFD8", "decision", dead=True, chip="已放弃")
    ax.plot([xs[0], xs[0] + 0.55, bx - b1["w"] / 2 - 0.06], [Y + c1["h"] / 2, 6.42, 6.42],
            color="#AEB9C5", lw=1.5, zorder=3, solid_capstyle="round", solid_joinstyle="round")
    txt(ax, bx - b1["w"] / 2, 6.42 + b1["h"] / 2 + 0.12, "feat/hid · 从主干分出", size=FS_TINY, color="#8D97A3")
    tx = bx + b1["w"] / 2 + 0.30
    ax.plot([bx + b1["w"] / 2 + 0.08, tx], [6.42, 6.42], color="#C3CBD5", lw=1.5, ls=(0, (4, 3)), zorder=3)
    ax.plot([tx, tx], [6.34, 6.50], color="#AEB8C4", lw=1.7, zorder=5)
    ax.plot([tx - 0.08, tx + 0.08], [6.34, 6.50], color="#AEB8C4", lw=1.7, zorder=5)
    txt(ax, tx + 0.12, 6.42, "尝试终止", size=FS_TINY, color="#98A5B1")

    # 分支 2：合并
    px = 12.10
    b2 = card(ax, px, 6.42, "PCB v1 打样", "方案 · 2026-10-25", PLAN, "plan")
    ax.plot([xs[2], xs[2] + 0.55, px - b2["w"] / 2 - 0.06], [Y + c3["h"] / 2, 6.42, 6.42],
            color="#AEB9C5", lw=1.5, zorder=3, solid_capstyle="round", solid_joinstyle="round")
    ax.plot([px + b2["w"] / 2 + 0.06, xs[3] - 0.62], [6.42, 6.42], color="#AEB9C5", lw=1.5, zorder=3)
    ax.plot([xs[3] - 0.62, xs[3] - 0.28], [6.42, Y + c4["h"] / 2 + 0.02], color="#AEB9C5", lw=1.5, zorder=3)
    ax.add_patch(FancyArrowPatch((xs[3] - 0.30, Y + c4["h"] / 2 + 0.03), (xs[3] - 0.14, Y + c4["h"] / 2 - 0.06),
                                 arrowstyle="-|>", mutation_scale=9, color="#AEB9C5", lw=1.5, zorder=4))
    txt(ax, px - b2["w"] / 2, 6.42 + b2["h"] / 2 + 0.12, "feat/pcb · 从主干分出", size=FS_TINY, color="#8D97A3")
    txt(ax, (px + xs[3]) / 2, 6.42 - b2["h"] / 2 - 0.22, "合并：改板采纳了这个分支", size=FS_TINY, color="#8D97A3", ha="center")

    # 材料
    materials(ax, xs[0], Y - c1["h"] / 2 - 0.12, [
        ("doc", "试错记录 44 条", "资料 · 已归档", DOC),
        ("doc", "Console 反编译源码", "资料 · 已产出代码", DOC),
        ("data", "固件镜像 73 个", "数据 · 73 个 .bin", DATA),
    ], w=c1["w"])
    materials(ax, xs[2], Y - c3["h"] / 2 - 0.12, [
        ("data", "身份帧样本", "数据 · 37 组", DATA),
        ("data", "抓包日志", "数据 · 40 万行", DATA),
    ], w=c3["w"])
    materials(ax, xs[3], Y - c4["h"] / 2 - 0.12, [
        ("doc", "交接文档", "资料 · 已归档", DOC),
        ("code", "esp32s3-relay-dock", "代码 · 113 commits", CODE),
    ], w=c4["w"])

    # 图例
    lx = 0.6
    for name, kind, color in [("决策", "decision", DEC), ("方案", "plan", PLAN), ("复盘", "retro", RET),
                              ("资料", "doc", DOC), ("数据", "data", DATA), ("代码", "code", CODE)]:
        ax.add_patch(Circle((lx + 0.12, 1.15), 0.10, facecolor=color, edgecolor="none", zorder=6))
        txt(ax, lx + 0.28, 1.15, name, size=FS_TINY + 0.8, color=MUT)
        lx += 0.95
    txt(ax, 6.9, 1.15, "左色条＝类型　｜　右上徽标＝状态　｜　右下小旗＝tag　｜　连线小字＝怎么走到下一步",
        size=FS_TINY, color=DIM)

    fig.savefig(os.path.join(OUT_DIR, "图-主视图.png"), dpi=170, facecolor="white")
    plt.close(fig)


# =====================================================================
# 图 1：整窗主界面
# =====================================================================
def plate_window():
    W, H = 14.4, 8.9
    fig, ax = canvas(W, H)

    panel(ax, 0, H - 0.60, W, 0.60, "#FFFFFF", "#EDF1F5", r=0.0, lw=1.0, z=5)
    ax.add_patch(Circle((0.42, H - 0.30), 0.055, facecolor=DEC, edgecolor="none", zorder=7))
    txt(ax, 0.56, H - 0.30, "项目Git", size=10.5, weight="600", color=ACC)
    tabs = ["大创 · 舆情 RAG", "ESP32 中继底座", "TourBox 协议逆向", "千问大赛"]
    x = 1.58
    for i, name in enumerate(tabs):
        wpx = text_w(name, 8.4) + 0.26
        if i == 1:
            panel(ax, x - 0.10, H - 0.45, wpx, 0.30, "#EDF0F8", "#EDF0F8", r=0.07, lw=0, z=6)
            txt(ax, x - 0.10 + wpx / 2, H - 0.30, name, size=8.4, color=ACC, weight="600", ha="center")
        else:
            txt(ax, x, H - 0.30, name, size=8.4, color=MUT)
        x += wpx + 0.24
    panel(ax, 10.60, H - 0.46, 2.05, 0.32, "#FFFFFF", "#E4EAF0", r=0.07, lw=1.0, z=6)
    txt(ax, 10.73, H - 0.30, "搜索", size=8.2, color=DIM)
    panel(ax, 12.86, H - 0.47, 0.98, 0.34, ACC, ACC, r=0.07, lw=0, z=6)
    txt(ax, 13.35, H - 0.30, "收进来", size=8.2, color="#FFFFFF", ha="center")
    panel(ax, 13.96, H - 0.47, 0.36, 0.34, "#FFFFFF", "#E4EAF0", r=0.07, lw=1.0, z=6)
    txt(ax, 14.14, H - 0.30, "···", size=8.5, color=MUT, ha="center")

    ax.plot([10.62, 10.62], [0, H - 0.60], color="#EDF1F5", lw=1.2, zorder=2)
    panel(ax, 10.62, 0, W - 10.62, H - 0.60, "#FFFFFF", "#FFFFFF", r=0.0, lw=0, z=1)

    Y = 5.35
    xs = [2.05, 5.55, 9.05]
    c1 = card(ax, xs[0], Y, "让 NEO 冒充 Elite", "方案 · 08-12", PLAN, "plan", w=3.05)
    c2 = card(ax, xs[1], Y, "放弃 HID，改 GATT", "决策 · 09-02", DEC, w=3.05)
    c3 = card(ax, xs[2], Y, "冒用 productKey", "决策 · 09-12", DEC, w=3.05, tag="b6677ef")

    for a, b, lab in [(xs[0], xs[1], "按 Plus 的 HID 试"), (xs[1], xs[2], "GATT 能连，机型不对")]:
        ax.annotate("", xy=(b - 1.55, Y), xytext=(a + 1.55, Y),
                    arrowprops=dict(arrowstyle="-|>", color="#CBD5DF", lw=1.4), zorder=3)
        wp = text_w(lab, FS_TINY) + 0.22
        mx = (a + b) / 2
        panel(ax, mx - wp / 2, Y + 0.62, wp, 0.24, "#F7F9FB", "#E9EEF3", r=0.08, lw=0.8, z=5)
        txt(ax, mx, Y + 0.74, lab, size=FS_TINY - 0.4, color="#5B6673", ha="center")

    b1 = card(ax, 3.30, 7.05, "先走 HID 流", "决策 · 08-20", "#C7CFD8", "decision", w=3.05, dead=True, chip="已放弃")
    ax.plot([xs[0], xs[0] + 0.45, 3.30 - 1.53], [Y + c1["h"] / 2, 7.05, 7.05],
            color="#AEB9C5", lw=1.4, zorder=3)
    tx = 3.30 + 1.55 + 0.28
    ax.plot([3.30 + 1.55 + 0.06, tx], [7.05, 7.05], color="#C3CBD5", lw=1.4, ls=(0, (4, 3)), zorder=3)
    ax.plot([tx, tx], [7.0, 6.42], color="#AEB8C4", lw=1.5, zorder=5)
    ax.plot([tx - 0.06, tx + 0.06], [7.0, 6.42], color="#AEB8C4", lw=1.5, zorder=5)
    txt(ax, tx + 0.10, 7.05, "尝试终止", size=FS_TINY - 0.4, color="#98A5B1")

    materials(ax, xs[0], Y - c1["h"] / 2 - 0.12, [
        ("doc", "试错记录 44 条", "资料 · 已归档", DOC),
        ("data", "固件镜像 73 个", "数据 · 73 个", DATA)], w=3.05)
    materials(ax, xs[2], Y - c3["h"] / 2 - 0.12, [
        ("data", "身份帧样本", "数据 · 37 组", DATA),
        ("doc", "交接文档", "资料 · 已归档", DOC)], w=3.05)

    # 详情面板
    PX = 10.62
    txt(ax, PX + 0.32, 7.72, "放弃 HID，改 GATT 直连", size=11.2, weight="600")
    txt(ax, PX + 0.32, 7.42, "决策 · 2026-09-02 · 有效", size=FS_META, color=DIM)
    ax.plot([PX + 0.32, PX + 3.40], [6.42, 6.42], color="#F1F4F7", lw=1, zorder=4)
    txt(ax, PX + 0.32, 6.82, "HID 描述符不完整，Console 走 GATT", size=FS_LABEL, color="#4B5563")
    txt(ax, PX + 0.32, 6.58, "直连；广播名保留 Elite。", size=FS_LABEL, color="#4B5563")
    txt(ax, PX + 0.32, 6.14, "出处", size=FS_TINY, color=DIM)
    panel(ax, PX + 0.32, 5.20, 3.06, 0.78, "#F8FAFB", "#EEF2F6", r=0.08, lw=0.9, z=4)
    txt(ax, PX + 0.46, 5.76, "中继底座-试错记录.md", size=FS_META, color="#374151")
    txt(ax, PX + 0.46, 5.52, "第 393–413 字", size=FS_TINY - 0.3, color=DIM)
    panel(ax, PX + 0.44, 5.26, 2.82, 0.18, "#FFFFFF", "#E7EDF3", r=0.05, lw=0.8, z=5)
    txt(ax, PX + 0.52, 5.35, "这是稳定基线（git b6677ef）", size=FS_TINY - 0.5, color="#4B5563")

    panel(ax, PX + 0.32, 4.66, 1.52, 0.34, ACC, ACC, r=0.07, lw=0, z=5)
    txt(ax, PX + 1.08, 4.83, "在应用内打开", size=FS_TINY, color="#FFFFFF", ha="center")
    panel(ax, PX + 1.94, 4.66, 1.06, 0.34, "#FFFFFF", "#DCE2E9", r=0.07, lw=1.0, z=5)
    txt(ax, PX + 2.47, 4.83, "外部打开", size=FS_TINY, color="#4B5563", ha="center")

    txt(ax, PX + 0.32, 4.22, "字段", size=FS_TINY, color=DIM)
    for i, (k, v) in enumerate([("结论", "GATT 直连"), ("理由", "HID 描述符不完整"), ("负责人", "张伟")]):
        yy = 3.94 - i * 0.30
        txt(ax, PX + 0.32, yy, k, size=FS_TINY + 0.3, color=DIM)
        txt(ax, PX + 1.06, yy, v, size=FS_TINY + 0.3, color="#374151")

    txt(ax, PX + 0.32, 2.92, "关联", size=FS_TINY, color=DIM)
    for i, (k, v) in enumerate([("属于", "先走 HID 流（已放弃）"), ("被引用", "锁定基线 b6677ef"),
                                ("相关", "BLE 服务实现")]):
        yy = 2.64 - i * 0.28
        txt(ax, PX + 0.32, yy, k, size=FS_TINY, color=DIM)
        txt(ax, PX + 0.82, yy, v, size=FS_TINY + 0.3, color="#374151")

    fig.savefig(os.path.join(OUT_DIR, "图-1-主界面.png"), dpi=170, facecolor="white")
    plt.close(fig)


# =====================================================================
# 图 2：卡片解剖
# =====================================================================
def plate_anatomy():
    W, H = 14.4, 8.0
    fig, ax = canvas(W, H)
    txt(ax, 0.6, 7.50, "卡片解剖", size=15, weight="bold", color=INK)
    txt(ax, 0.6, 7.12, "标题按卡片宽度自动换行（最多两行），不再用省略号截断", size=9.2, color=MUT)

    CX, CY, CW = 4.45, 4.55, 5.30
    # 大卡：两行标题
    from plate_lib import wrap
    inner = CW - 0.46 - 0.16 - (text_w("已放弃", FS_TINY + 1) + 0.34)
    lines = wrap("放弃 HID，改 GATT 直连并保留 Elite 广播名", FS_TITLE + 3, inner, max_lines=2)
    th = len(lines) * ((FS_TITLE + 3) / 72.0) * 0.98 + 0.06
    CH = max(1.10, th + 0.62)
    shadow(ax, CX - CW / 2, CY - CH / 2, CW, CH, r=0.13)
    panel(ax, CX - CW / 2, CY - CH / 2, CW, CH, "#FFFFFF", DEC, r=0.13, lw=1.5, z=4)
    ax.add_patch(FancyBboxPatch((CX - CW / 2 + 0.10, CY - CH / 2 + 0.20), 0.075, CH - 0.40,
                                boxstyle="round,pad=0.0,rounding_size=0.03",
                                facecolor=DEC, edgecolor="none", zorder=5))
    icon(ax, "decision", CX - CW / 2 + 0.30, CY, 0.10, DEC)
    top = CY + CH / 2 - 0.26
    for i, line in enumerate(lines):
        txt(ax, CX - CW / 2 + 0.46, top - i * ((FS_TITLE + 3) / 72.0) * 0.98, line,
            size=FS_TITLE + 3, weight="600", va="top")
    txt(ax, CX - CW / 2 + 0.46, CY - CH / 2 + 0.26, "决策 · 2026-09-02 · 有效", size=FS_META + 1, color=MUT)

    cw2 = text_w("已放弃", FS_TINY + 1) + 0.28
    panel(ax, CX + CW / 2 - cw2 - 0.14, CY + CH / 2 - 0.42, cw2, 0.26, "#F3F5F7", "#DCE2E9", r=0.08, lw=0.8, z=7)
    txt(ax, CX + CW / 2 - 0.14 - cw2 / 2, CY + CH / 2 - 0.29, "已放弃", size=FS_TINY + 1, color="#8D97A3", ha="center")
    tw = text_w("tag b6677ef", FS_TINY + 1) + 0.26
    panel(ax, CX + CW / 2 - tw - 0.14, CY - CH / 2 + 0.12, tw, 0.26, "#FFF7E8", "#E0B96B", r=0.08, lw=0.8, z=7)
    txt(ax, CX + CW / 2 - 0.14 - tw / 2, CY - CH / 2 + 0.25, "tag b6677ef", size=FS_TINY + 1,
        color="#A5751E", ha="center", family="Consolas")

    notes = [
        ("① 卡片宽 230，高随标题行数自适应（96 / 118）", CY + 1.00),
        ("② 左色条 4px，圆角 2，颜色 = 类型", CY + 0.50),
        ("③ 图标 24px：菱形决策 / 圆点方案 / 圆柱数据", CY + 0.00),
        ("④ 标题 11.5px / 600，一行放不下就换行，最多两行", CY - 0.50),
        ("⑤ 副标题 8.4px 灰：类型 · 时间 · 状态", CY - 1.00),
        ("⑥ 徽标：右上状态、右下 tag，均为胶囊圆角 8", CY - 1.50),
    ]
    for label, y in notes:
        ax.plot([8.55, 8.80], [y, y], color="#CBD5DF", lw=1, zorder=4)
        txt(ax, 8.88, y, label, size=FS_LABEL, color="#374151")

    txt(ax, 0.6, 2.28, "三种状态", size=11, weight="600", color=ACC)
    states = [("正常", DEC, False, None, None),
              ("已放弃", "#C7CFD8", True, "已放弃", None),
              ("已取代", "#B9C2CB", False, "已取代", None)]
    for i, (label, color, dead, chip, tag) in enumerate(states):
        cx = 2.10 + i * 3.55
        card(ax, cx, 1.30, "冒用 productKey 让 Console 认成 Plus", "决策 · 09-12", color,
             "decision", w=3.25, dead=dead, chip=chip, tag=tag)
        txt(ax, cx, 0.38, label, size=FS_LABEL, color=MUT, ha="center")

    fig.savefig(os.path.join(OUT_DIR, "图-2-卡片解剖.png"), dpi=170, facecolor="white")
    plt.close(fig)


plate_main()
plate_window()
plate_anatomy()
print("3 plates ok")
