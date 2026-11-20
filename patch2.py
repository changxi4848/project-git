import io
p = "D:/03_code_list/project-git-项目知识时间轴/engine.py"
s = io.open(p, encoding="utf-8").read()
s = s.replace('has_stamp = bool(m and (m.group(2) or m.group(4)))',
              'has_stamp = bool(m and (m.group(2) or m.group(5)))')
s = s.replace('body = (m.group(6) or "").strip()',
              'body = (m.group(7) or "").strip()')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
