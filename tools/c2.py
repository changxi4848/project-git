import io
p = r"tools\design_c.py"
s = io.open(p, encoding="utf-8").read()
s = s.replace("✕＝尝试终止", "×＝尝试终止")
s = s.replace("Y_RES = 3.15", "Y_RES = 3.55")
s = s.replace("def res_box(cx, items, top=2.55):", "def res_box(cx, items, top=3.35):")
# 缩短画布下方空白
s = s.replace("W, H = 16.4, 9.4", "W, H = 16.4, 9.4")
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
