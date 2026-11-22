import io, json
p = r"tools\seed_real.py"
s = io.open(p, encoding="utf-8").read()
if "branch" not in s:
    s = s.replace('''state = {
    "projects": projects, "types": types,''',
'''# —— 分支与合并（对应设计稿里的 feat/hid 与 feat/pcb）——
for n in out_nodes:
    n["branch"] = "main"
    n["parents"] = [n["parent"]] if n.get("parent") else []
byid = {n["id"]: n for n in out_nodes}
# 走 HID 的分支：从“让 NEO 冒充 Elite”分出，终止
if "r9" in byid:
    byid["r9"]["branch"] = "feat/hid"
    byid["r9"]["parents"] = ["r1"]
    byid["r9"]["status"] = "abandoned"
# PCB 打样：从“锁定基线”分出，合并进“改板”
if "r15" in byid:
    byid["r15"]["branch"] = "feat/pcb"
    byid["r15"]["parents"] = ["r14"]
if "r16" in byid:
    byid["r16"]["parents"] = ["r14", "r15"]
edges = [e for e in edges if not (e["from"] == "r15" and e["kind"] == "derived")]
edges.append({"from": "r15", "to": "r14", "kind": "derived"})

state = {
    "projects": projects, "types": types,''')
    io.open(p, "w", encoding="utf-8").write(s)
    print("seed patched")
else:
    print("already")
