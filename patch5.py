import io

p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 1) 左侧留出泳道名的世界坐标空间
s = s.replace("const NODE_W = 176, NODE_H = 54, ROW_GAP = 12, LANE_PAD = 26;",
              "const NODE_W = 176, NODE_H = 54, ROW_GAP = 14, LANE_PAD = 30, GUTTER = 150;")
s = s.replace("  const padL = 40, padR = 40;",
              "  const padL = GUTTER + 20, padR = 40;")

# 2) 泳道名改到世界坐标里画（不再压住节点）
start = s.index("  // 左侧泳道名（屏幕坐标）")
end = s.index("  drawMinimap();")
new_block = '''  // 泳道名（世界坐标，独立栏位，不压节点）
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);
  for (const ln of L.lanes) {
    ctx.fillStyle = "#fbfcfd";
    ctx.fillRect(0, ln.y, GUTTER - 14, ln.h);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3c4f5c";
    ctx.font = "600 12.5px 'Microsoft YaHei',sans-serif";
    const nm = ln.name.length > 10 ? ln.name.slice(0, 10) + "…" : ln.name;
    ctx.fillText(nm, 14, ln.y + Math.min(24, ln.h / 2));
    ctx.fillStyle = "#93a4b0";
    ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
    ctx.fillText(ln.rows + " 行", 14, ln.y + Math.min(42, ln.h / 2 + 16));
  }
  ctx.strokeStyle = "#e3ebf0"; ctx.lineWidth = 1 / cam.s;
  ctx.beginPath(); ctx.moveTo(GUTTER - 14, 0); ctx.lineTo(GUTTER - 14, L.H); ctx.stroke();
  ctx.restore();

  // 时间刻度（屏幕坐标）
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#8ea0ac"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
  ctx.textBaseline = "top";
  for (const t of months) {
    if (t < L.t0) continue;
    const [sx] = toScreen(40 + ((t - L.t0) / span) * (L.W - 80), 0);
    if (sx < GUTTER || sx > W - 10) continue;
    const d = new Date(t);
    ctx.fillText(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, sx + 4, 12);
  }
  ctx.restore();

'''
s = s[:start] + new_block + s[end:]

# 3) 相机夹住左侧栏位
s = s.replace("function toScreen(wx, wy) {", "function clampCam() {\n  cam.x = Math.max(GUTTER - 6, cam.x);\n  cam.y = Math.max(10, cam.y);\n}\nfunction toScreen(wx, wy) {")
s = s.replace("    cam.y = e.offsetY - wy * ns;\n    draw();",
              "    cam.y = e.offsetY - wy * ns;\n    clampCam(); draw();")
s = s.replace("    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; draw(); return; }",
              "    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; clampCam(); draw(); return; }")

# 4) 初始缩放 + 演示模式
s = s.replace("  cam.s = clamp((W - 120) / L.W, 0.3, 1.2);",
              "  cam.s = clamp((W - 170) / L.W, 0.22, 0.95);")
s = s.replace("    await doSearch(q, true);", "    DEMO = true;\n    await doSearch(q, true);")
s = s.replace("      if (o) flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.0);\n    }",
              "      if (o) flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 0.78);\n    }")
s = s.replace("let anim = null, hoverId = null, lastSearch = null;",
              "let anim = null, hoverId = null, lastSearch = null, DEMO = false;")

# 5) 演示模式不弹搜索结果列表（避免挡住图）
s = s.replace("  if (d.hits.length) {\n    hint.innerHTML",
              "  if (d.hits.length) {\n    if (DEMO) { hint.classList.remove('on'); }\n    hint.innerHTML")

io.open(p, "w", encoding="utf-8").write(s)
print("app patched")

# 6) 小地图挪到左下（抽屉在右侧）
p2 = "D:/03_code_list/project-git-项目知识时间轴/web/style.css"
c = io.open(p2, encoding="utf-8").read()
c = c.replace("  position:absolute;right:12px;bottom:56px;background:#fff;border:1px solid var(--line);",
              "  position:absolute;left:12px;bottom:56px;background:#fff;border:1px solid var(--line);")
io.open(p2, "w", encoding="utf-8").write(c)
print("css patched")
