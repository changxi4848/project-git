# -*- coding: utf-8 -*-
"""在 plates_v2 上追加：主界面右栏（简介 + 上下节点联系 + 出处路径），以及详情/预览图"""
import io, re, os

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plates_v2.py")
s = io.open(p, encoding="utf-8").read()

# ---------- 1) 替换 plate_window 的右栏 ----------
start = s.index("    # 详情面板\n    PX = 10.62")
end = s.index('    fig.savefig(os.path.join(OUT_DIR, "图-1-主界面.png")')
new_panel = '''    # ===== 右侧详情面板：简介 + 与上下节点的联系 + 出处 =====
    PX = 10.62
    txt(ax, PX + 0.32, 7.78, "放弃 HID，改 GATT 直连", size=11.2, weight="600")
    txt(ax, PX + 0.32, 7.50, "决策 · 2026-09-02 · 有效", size=FS_META, color=DIM)

    # 简介
    txt(ax, PX + 0.32, 7.14, "简介", size=FS_TINY, color=DIM)
    for i, line in enumerate(["HID 描述符不完整，Console 一直卡在", "「正在连接」，于是改走 GATT 直连。"][:2]):
        txt(ax, PX + 0.32, 6.90 - i * 0.235, line, size=FS_LABEL, color="#3F4A56")

    # 与上下节点的联系
    txt(ax, PX + 0.32, 6.16, "与上下节点的联系", size=FS_TINY, color=DIM)
    rel_rows = [
        ("上一步", "让 NEO 冒充 Elite", "按 Plus 的 HID 试，卡住了", DEC, 5.82),
        ("下一步", "冒用 productKey", "GATT 能连，但机型不对", PLAN, 5.02),
    ]
    for tag, name, why, col, yy in rel_rows:
        panel(ax, PX + 0.32, yy - 0.56, 3.06, 0.62, "#FBFCFD", "#EDF1F5", r=0.08, lw=0.9, z=4)
        tw = text_w(tag, FS_TINY - 0.6) + 0.20
        panel(ax, PX + 0.40, yy - 0.10, tw, 0.22, "#F1F4F9", "#E1E7EE", r=0.06, lw=0.7, z=6)
        txt(ax, PX + 0.40 + tw / 2, yy + 0.01, tag, size=FS_TINY - 0.6, color=MUT, ha="center")
        txt(ax, PX + 0.40 + tw + 0.10, yy + 0.01, name, size=FS_TINY + 0.3, color=INK)
        txt(ax, PX + 0.42, yy - 0.28, why, size=FS_TINY - 0.2, color=DIM)

    # 出处
    txt(ax, PX + 0.32, 4.30, "出处", size=FS_TINY, color=DIM)
    panel(ax, PX + 0.32, 3.30, 3.06, 0.92, "#F8FAFB", "#EEF2F6", r=0.08, lw=0.9, z=4)
    txt(ax, PX + 0.46, 4.02, "中继底座-试错记录.md", size=FS_META, color="#374151")
    # 文件路径（可点击）
    icon(ax, "doc", PX + 0.52, 3.76, 0.045, DOC)
    path_txt = "data/files/中继底座-试错记录.md"
    txt(ax, PX + 0.64, 3.76, path_txt, size=FS_TINY - 0.3, color="#2F6FD0")
    ax.plot([PX + 0.63, PX + 0.63 + text_w(path_txt, FS_TINY - 0.3)], [3.70, 3.70],
            color="#B9CDEE", lw=0.8, zorder=6)
    txt(ax, PX + 0.46, 3.50, "第 393–413 字 · 点击路径在文件夹中显示", size=FS_TINY - 0.6, color=DIM)

    panel(ax, PX + 0.32, 2.86, 1.48, 0.32, ACC, ACC, r=0.07, lw=0, z=5)
    txt(ax, PX + 1.06, 3.02, "在应用内打开", size=FS_TINY, color="#FFFFFF", ha="center")
    panel(ax, PX + 1.88, 2.86, 1.50, 0.32, "#FFFFFF", "#DCE2E9", r=0.07, lw=1.0, z=5)
    txt(ax, PX + 2.63, 3.02, "在文件夹中显示", size=FS_TINY, color="#4B5563", ha="center")

    # 关联
    txt(ax, PX + 0.32, 2.44, "关联", size=FS_TINY, color=DIM)
    for i, (k, v) in enumerate([("属于", "先走 HID 流（已放弃）"), ("被引用", "锁定基线 b6677ef"),
                                ("相关", "BLE 服务实现")]):
        yy = 2.18 - i * 0.28
        txt(ax, PX + 0.32, yy, k, size=FS_TINY, color=DIM)
        txt(ax, PX + 0.82, yy, v, size=FS_TINY + 0.3, color="#374151")

'''
s = s[:start] + new_panel + s[end:]

# ---------- 2) 追加 plot_detail ----------
detail = '''

# =====================================================================
# 图 3：详情（简介 + 上下联系 + 出处路径）与 应用内预览
# =====================================================================
def plate_detail():
    W, H = 14.4, 8.4
    fig, ax = canvas(W, H)
    txt(ax, 0.6, 7.90, "详情面板 与 应用内预览", size=15, weight="bold", color=INK)
    txt(ax, 0.6, 7.52, "简介说清“这条是什么”，联系说清“它从哪来、到哪去”，出处给到可直接打开的文件位置",
        size=9.0, color=MUT)

    # 左：详情
    LX, LY, LW, LH = 0.6, 0.9, 3.75, 6.35
    shadow(ax, LX, LY, LW, LH)
    panel(ax, LX, LY, LW, LH, "#FFFFFF", "#EDF1F5", r=0.12, lw=1.0)
    txt(ax, LX + 0.30, LY + LH - 0.48, "放弃 HID，改 GATT", size=11.5, weight="600")
    txt(ax, LX + 0.30, LY + LH - 0.76, "决策 · 2026-09-02 · 有效", size=FS_META, color=DIM)

    txt(ax, LX + 0.30, LY + LH - 1.20, "简介", size=FS_TINY, color=DIM)
    txt(ax, LX + 0.30, LY + LH - 1.44, "HID 描述符不完整，Console 卡在", size=FS_LABEL, color="#3F4A56")
    txt(ax, LX + 0.30, LY + LH - 1.67, "「正在连接」，改走 GATT 直连。", size=FS_LABEL, color="#3F4A56")

    txt(ax, LX + 0.30, LY + LH - 2.10, "与上下节点的联系", size=FS_TINY, color=DIM)
    for tag, name, why, yy in [("上一步", "让 NEO 冒充 Elite", "按 Plus 的 HID 试，卡住了", LY + LH - 2.78),
                               ("下一步", "冒用 productKey", "GATT 能连，但机型不对", LY + LH - 3.62)]:
        panel(ax, LX + 0.30, yy - 0.20, 3.15, 0.68, "#FBFCFD", "#EDF1F5", r=0.08, lw=0.9, z=4)
        tw = text_w(tag, FS_TINY - 0.6) + 0.20
        panel(ax, LX + 0.38, yy + 0.28, tw, 0.22, "#F1F4F9", "#E1E7EE", r=0.06, lw=0.7, z=6)
        txt(ax, LX + 0.38 + tw / 2, yy + 0.39, tag, size=FS_TINY - 0.6, color=MUT, ha="center")
        txt(ax, LX + 0.38 + tw + 0.10, yy + 0.39, name, size=FS_TINY + 0.4, color=INK)
        txt(ax, LX + 0.40, yy + 0.10, why, size=FS_TINY - 0.1, color=DIM)

    txt(ax, LX + 0.30, LY + 1.62, "出处", size=FS_TINY, color=DIM)
    panel(ax, LX + 0.30, LY + 0.62, 3.15, 0.92, "#F8FAFB", "#EEF2F6", r=0.08, lw=0.9, z=4)
    txt(ax, LX + 0.44, LY + 1.30, "中继底座-试错记录.md", size=FS_META, color="#374151")
    icon(ax, "doc", LX + 0.50, LY + 1.04, 0.045, DOC)
    pt = "data/files/中继底座-试错记录.md"
    txt(ax, LX + 0.62, LY + 1.04, pt, size=FS_TINY - 0.3, color="#2F6FD0")
    ax.plot([LX + 0.61, LX + 0.61 + text_w(pt, FS_TINY - 0.3)], [LY + 0.98, LY + 0.98],
            color="#B9CDEE", lw=0.8, zorder=6)
    txt(ax, LX + 0.44, LY + 0.80, "第 393–413 字 · 点击路径在文件夹中显示", size=FS_TINY - 0.6, color=DIM)

    panel(ax, LX + 0.30, LY + 0.16, 1.52, 0.32, ACC, ACC, r=0.07, lw=0, z=5)
    txt(ax, LX + 1.06, LY + 0.32, "在应用内打开", size=FS_TINY, color="#FFFFFF", ha="center")
    panel(ax, LX + 1.90, LY + 0.16, 1.55, 0.32, "#FFFFFF", "#DCE2E9", r=0.07, lw=1.0, z=5)
    txt(ax, LX + 2.67, LY + 0.32, "在文件夹中显示", size=FS_TINY, color="#4B5563", ha="center")

    # 右：预览
    PX, PY, PW, PH = 4.75, 0.9, 9.05, 6.35
    shadow(ax, PX, PY, PW, PH)
    panel(ax, PX, PY, PW, PH, "#FFFFFF", "#EDF1F5", r=0.12, lw=1.0)
    ax.plot([PX, PX + PW], [PY + PH - 0.62, PY + PH - 0.62], color="#EDF1F5", lw=1, zorder=5)
    txt(ax, PX + 0.30, PY + PH - 0.31, "中继底座-试错记录.md", size=9, color="#374151")
    panel(ax, PX + PW - 2.02, PY + PH - 0.48, 0.88, 0.30, "#FFFFFF", "#DCE2E9", r=0.07, lw=0.9, z=6)
    txt(ax, PX + PW - 1.58, PY + PH - 0.33, "外部打开", size=7, color="#4B5563", ha="center")
    txt(ax, PX + PW - 0.36, PY + PH - 0.33, "×", size=10, color=DIM, ha="center")

    yy = PY + PH - 1.15
    txt(ax, PX + 0.36, yy, "阶段一：BLE 仿真（Windows 端）", size=12.5, weight="600")
    yy -= 0.52
    ax.plot([PX + 0.36, PX + 0.40], [yy - 0.26, yy + 0.26], color="#D5DEE7", lw=2.4, zorder=5)
    txt(ax, PX + 0.58, yy + 0.14, "目的：把每一次尝试的结果和证据留下来。", size=FS_LABEL, color="#4B5563")
    txt(ax, PX + 0.58, yy - 0.14, "每条都标注：做法 → 结果 → 证据 → 结论。", size=FS_LABEL, color="#4B5563")

    yy -= 0.72
    tbl_x = PX + 0.36
    colws = [0.45, 2.25, 1.95, 2.55, 1.45]
    for i, hname in enumerate(["#", "尝试", "结果", "证据", "结论"]):
        txt(ax, tbl_x + 0.08 + sum(colws[:i]), yy, hname, size=7.6, color=MUT)
    ax.plot([tbl_x, tbl_x + sum(colws)], [yy - 0.18, yy - 0.18], color="#EDF1F5", lw=1, zorder=5)

    rows = [("1", "广播名 Elite + 厂商 01", "Windows Console 可用", "显示设备、按键可用", "稳定基线"),
            ("2", "广播名改 Elite Plus", "卡「正在连接」", "只订阅 FFF1，不发 55", "分流到 HID"),
            ("3", "名字 + 真 HID 服务", "仍卡住", "订阅后仍无 55", "描述符不完整")]
    for r, (n, a, b, c, d) in enumerate(rows):
        ry = yy - 0.46 - r * 0.62
        if r == 1:
            panel(ax, tbl_x - 0.04, ry - 0.25, sum(colws) + 0.08, 0.50, "#FFFDF5", "#F3E6C4", r=0.06, lw=0.8, z=4)
        for i, val in enumerate([n, a, b, c, d]):
            txt(ax, tbl_x + 0.08 + sum(colws[:i]), ry, val, size=7.4,
                color=("#5A4400" if (r == 1 and i == 4) else "#374151"))
        ax.plot([tbl_x, tbl_x + sum(colws)], [ry - 0.30, ry - 0.30], color="#F1F4F7", lw=0.8, zorder=4)

    panel(ax, PX + 0.36, PY + 0.26, 2.70, 0.40, "#FFFBEB", "#F3E6C4", r=0.08, lw=0.9, z=6)
    txt(ax, PX + 0.50, PY + 0.46, "自动滚到命中句并高亮", size=FS_TINY, color="#8A6A1E")

    fig.savefig(os.path.join(OUT_DIR, "图-3-详情与预览.png"), dpi=170, facecolor="white")
    plt.close(fig)


plate_detail()
'''
s = s.replace("\nplate_main()\nplate_window()\nplate_anatomy()\nprint(\"3 plates ok\")",
              "\nplate_main()\nplate_window()\nplate_anatomy()" + detail + "\nprint(\"4 plates ok\")")
io.open(p, "w", encoding="utf-8").write(s)
print("patched")
