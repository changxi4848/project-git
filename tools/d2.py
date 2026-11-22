import io
p = r"tools\design_doc.py"
s = io.open(p, encoding="utf-8").read()
s = s.replace('h1("方案 A：时间轴 + 正交泳道", "03")', 'doc.add_page_break()\nh1("方案 A：时间轴 + 正交泳道", "03")')
s = s.replace('h1("方案 B：按月分章", "04")', 'doc.add_page_break()\nh1("方案 B：按月分章", "04")')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
