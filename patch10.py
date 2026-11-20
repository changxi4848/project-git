import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 抽屉打开时，把目标节点居中在“剩余可视区”，而不是整块画布
s = s.replace(
"""function flyTo(wx, wy, s, dur = 400) {
  const target = { x: canvas.clientWidth / 2 - wx * s, y: canvas.clientHeight / 2 - wy * s, s };""",
"""function flyTo(wx, wy, s, dur = 400) {
  const drawerOpen = !document.getElementById("drawer").classList.contains("hidden");
  const cx = drawerOpen ? (canvas.clientWidth - 340) / 2 : canvas.clientWidth / 2;
  const target = { x: cx - wx * s, y: canvas.clientHeight / 2 - wy * s, s };""")

# 演示参数 ?demo=place → 直接打开归位弹窗（用于截图与答辩）
s = s.replace(
"""  if (qs.get("view") === "all") {""",
"""  if (qs.get("demo") === "place") {
    DEMO = true;
    const cands = ["n08", "n07", "n09"].map(id => S.nodes.find(n => n.id === id)).filter(Boolean);
    openPlace({
      id: "it_demo",
      text: "定价就按 B 方案走吧，A 的风险太大",
      at: "2026-11-19",
      speaker: "张三",
      truncated: false,
      cls: {
        type: "decision", project: "p_pricing", placement: "grow",
        confidence: 0.851, margin: 0.007,
        candidates: cands.map((n, i) => ({ id: n.id, score: [0.42, 0.40, 0.31][i] || 0.3 })),
      },
    });
    return;
  }
  if (qs.get("view") === "all") {""")
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
