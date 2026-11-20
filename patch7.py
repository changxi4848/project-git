import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 时间映射要预留节点自身宽度，否则最右侧节点会出画
s = s.replace(
    "  const xOf = (t) => padL + ((t - L.t0) / span) * (L.W - padL - padR);",
    "  const xOf = (t) => padL + ((t - L.t0) / span) * (L.W - padL - padR - NODE_W);")

# 时间刻度也用同一映射
s = s.replace(
    'const [sx] = toScreen(40 + ((t - L.t0) / span) * (L.W - 80), 0);',
    'const [sx] = toScreen(GUTTER + 20 + ((t - L.t0) / span) * (L.W - GUTTER - 60 - NODE_W), 0);')

# 网格竖线同步
s = s.replace(
    '    const x = 40 + ((t - L.t0) / span) * (L.W - 80);',
    '    const x = GUTTER + 20 + ((t - L.t0) / span) * (L.W - GUTTER - 60 - NODE_W);')

io.open(p, "w", encoding="utf-8").write(s)

p2 = "D:/03_code_list/project-git-项目知识时间轴/web/style.css"
c = io.open(p2, encoding="utf-8").read()
c = c.replace("  position:absolute;right:356px;bottom:52px;background:#fff;border:1px solid var(--line);",
              "  position:absolute;right:12px;bottom:52px;background:#fff;border:1px solid var(--line);")
io.open(p2, "w", encoding="utf-8").write(c)
print("ok")
