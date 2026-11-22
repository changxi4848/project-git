import io
p = r"tools\arch_fig.py"
s = io.open(p, encoding="utf-8").read()
s = s.replace("IPC 路由\\城市", "IPC 路由")
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
