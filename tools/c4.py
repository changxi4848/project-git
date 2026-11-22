import io
p = r"tools\design_c.py"
s = io.open(p, encoding="utf-8").read()

# 主干下加一条淡色底带，锚住主线
s = s.replace('# ---------------- 时间刻度 ----------------',
'''# 主干底带
ax.add_patch(Rectangle((0.55, Y_MAIN - 1.15), 15.3, 1.62, facecolor="#F7FAFC", edgecolor="none", zorder=0))

# ---------------- 时间刻度 ----------------''')

# 决策编号
s = s.replace('''for x, kind, name, sub in main:
    commit(x, Y_MAIN, kind, DEC if kind == "decision" else "#C08A3E")''',
'''for idx, (x, kind, name, sub) in enumerate(main, 1):
    commit(x, Y_MAIN, kind, DEC if kind == "decision" else "#C08A3E")
    ax.text(x - 0.22, Y_MAIN + 0.20, str(idx), fontsize=8, color="#B9C2CB", ha="right", va="bottom", zorder=9)''')

# 分支线略深一点
s = s.replace('color=GREY, lw=1.6, zorder=2,\n        solid_capstyle="round", solid_joinstyle="round")',
              'color="#A8B4C0", lw=1.7, zorder=2,\n        solid_capstyle="round", solid_joinstyle="round")')

# 右上角状态说明
s = s.replace('''ax.text(0.62, 8.58, "主干＝主线提交；分叉＝一次尝试；×＝尝试终止；双线汇合＝被采纳；小旗＝里程碑；虚线框＝这次提交带的材料",
        fontsize=9.4, color=MUT)''',
'''ax.text(0.62, 8.58, "主干＝主线提交；分叉＝一次尝试；×＝尝试终止；双线汇合＝被采纳；小旗＝里程碑；虚线框＝这次提交带的材料",
        fontsize=9.4, color=MUT)
ax.text(15.85, 8.95, "主线 6 次提交 · 分支 2 条（1 条终止、1 条合并）", fontsize=8.6, color=DIM, ha="right")''')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
