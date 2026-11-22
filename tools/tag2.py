import io
p = r"tools\seed_real.py"
s = io.open(p, encoding="utf-8").read()
bad = '''# 里程碑 tag（对应设计稿的小旗）
if "r14" in byid:
    byid["r14"]["tag"] = "b6677ef"

'''
s = s.replace(bad, "")
s = s.replace('byid = {n["id"]: n for n in out_nodes}',
'''byid = {n["id"]: n for n in out_nodes}
# 里程碑 tag（对应设计稿的小旗）
if "r14" in byid:
    byid["r14"]["tag"] = "b6677ef"''')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
