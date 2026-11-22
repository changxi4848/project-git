import io
p = r"tools\design_b.py"
s = io.open(p, encoding="utf-8").read()
s = s.replace("ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis(\"off\")",
              "ax.set_xlim(0, W); ax.set_ylim(3.15, 9.05); ax.axis(\"off\")")
# 列内加细竖线，表达归属
s = s.replace('''        if j < len(items) - 1:''',
'''        if j > 0:
            ax.plot([x + 0.28, x + 0.28], [y + 0.10, items[j - 1][2] - 0.10],
                    color="#E7ECF1", lw=1, zorder=0)
        if j < len(items) - 1:''')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
