import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 关键 bug：边和节点没有套上相机变换（之前靠 cam≈1 蒙对了）
old = """  // 边
  const edges = S.edges.filter(e => {"""
new = """  // —— 以下进入相机坐标系 ——
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);

  // 边
  const edges = S.edges.filter(e => {"""
assert old in s
s = s.replace(old, new)

old2 = """  // 泳道名（世界坐标，独立栏位，不压节点）
  ctx.save();"""
new2 = """  ctx.restore();

  // 泳道名（世界坐标，独立栏位，不压节点）
  ctx.save();"""
assert old2 in s
s = s.replace(old2, new2)

io.open(p, "w", encoding="utf-8").write(s)
print("ok")
