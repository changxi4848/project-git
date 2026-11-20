import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# LOD 阈值下调：0.62 这类总览缩放必须还能看见标题
s = s.replace("if (lod < 0.55) {   // 小比例只画点",
              "if (lod < 0.22) {   // 极小比例才退化成点")

# 小地图尺寸
s = s.replace("""  mini.width = 180 * DPR; mini.height = 110 * DPR;
  mini.style.width = "180px"; mini.style.height = "110px";""",
"""  mini.width = 148 * DPR; mini.height = 90 * DPR;
  mini.style.width = "148px"; mini.style.height = "90px";""")
io.open(p, "w", encoding="utf-8").write(s)

p2 = "D:/03_code_list/project-git-项目知识时间轴/web/style.css"
c = io.open(p2, encoding="utf-8").read()
c = c.replace("#minimap{display:block;width:180px;height:110px;border-radius:5px;background:#f7fafc}",
              "#minimap{display:block;width:148px;height:90px;border-radius:5px;background:#f7fafc}")
c = c.replace("  position:absolute;right:12px;bottom:52px;background:#fff;border:1px solid var(--line);\n  border-radius:8px;padding:4px;box-shadow:0 4px 14px rgba(18,59,79,.08);z-index:10",
              "  position:absolute;right:12px;bottom:52px;background:#fff;border:1px solid var(--line);\n  border-radius:8px;padding:3px;box-shadow:0 4px 14px rgba(18,59,79,.08);z-index:10;opacity:.92")
io.open(p2, "w", encoding="utf-8").write(c)
print("ok")
