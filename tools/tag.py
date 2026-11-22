import io
p = r"tools\seed_real.py"
s = io.open(p, encoding="utf-8").read()
if '"tag"' not in s:
    s = s.replace('''# —— 分支与合并''',
'''# 里程碑 tag（对应设计稿的小旗）
if "r14" in byid:
    byid["r14"]["tag"] = "b6677ef"

# —— 分支与合并''')
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched")
