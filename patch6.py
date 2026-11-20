import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 1) 演示模式彻底不显示搜索列表
s = s.replace(
"""  if (d.hits.length) {
    if (DEMO) { hint.classList.remove('on'); }
    hint.innerHTML""",
"""  if (DEMO) {
    hint.classList.remove("on");
  } else if (d.hits.length) {
    hint.innerHTML""")
s = s.replace(
"""  } else {
    hint.innerHTML = `<div class="hint-item"><div class="m">没有命中。试试「定价」「口径」「预算」</div></div>`;
    hint.classList.add("on");""",
"""  } else if (!DEMO) {
    hint.innerHTML = `<div class="hint-item"><div class="m">没有命中。试试「定价」「口径」「预算」</div></div>`;
    hint.classList.add("on");""")

# 2) 左栏加宽
s = s.replace("ROW_GAP = 14, LANE_PAD = 30, GUTTER = 150;", "ROW_GAP = 14, LANE_PAD = 30, GUTTER = 190;")

# 3) 全景视图参数 ?view=all
s = s.replace(
"""  if (q) {
    DEMO = true;""",
"""  if (qs.get("view") === "all") {
    const sc = Math.min((canvas.clientWidth - 30) / L.W, (canvas.clientHeight - 80) / L.H);
    cam.s = sc; cam.x = 10; cam.y = 30; draw();
    return;
  }
  if (q) {
    DEMO = true;""")
io.open(p, "w", encoding="utf-8").write(s)
print("app patched")

# 4) 小地图移到抽屉左侧
p2 = "D:/03_code_list/project-git-项目知识时间轴/web/style.css"
c = io.open(p2, encoding="utf-8").read()
c = c.replace("  position:absolute;left:12px;bottom:56px;background:#fff;border:1px solid var(--line);",
              "  position:absolute;right:356px;bottom:52px;background:#fff;border:1px solid var(--line);")
io.open(p2, "w", encoding="utf-8").write(c)
print("css patched")
