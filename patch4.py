import io
p = "D:/03_code_list/project-git-项目知识时间轴/web/app.js"
s = io.open(p, encoding="utf-8").read()

# 1) 弹窗里说明“为什么还要问你”
old = """    <div id="place-cands" class="cands"></div>"""
# (html 里已有，这里只改 JS 里的文案)
s = s.replace(
    """  const cands = (cls.candidates || []).slice(0, 3);""",
    """  const cands = (cls.candidates || []).slice(0, 3);
  const marginTxt = (cls.margin != null)
    ? `判断置信度 ${(cls.confidence ?? 0).toFixed(2)}，但前两个候选只差 ${(cls.margin).toFixed(3)} —— AI 在“挂在谁下面”这件事上没把握，所以问你。`
    : "";
  let why = document.getElementById("place-why");
  if (!why) { why = el("div", "muted"); why.id = "place-why"; $("#place-cands").before(why); }
  why.textContent = marginTxt;
  why.style.margin = "4px 0 8px";""")

# 2) 演示参数：?q=定价  → 自动检索并打开第一个结果
old_boot = """  // 默认飞到 Q4 定价泳道
  const first = L.nodes[Math.floor(L.nodes.length * 0.55)];
  if (first) flyTo(first.x, first.y, Math.min(cam.s, 0.9), 500);"""
new_boot = """  // 演示参数：?q=xxx 自动检索；?node=xxx 直接打开节点
  const qs = new URLSearchParams(location.search);
  const q = qs.get("q");
  const nid = qs.get("node");
  if (nid) {
    const o = nodeBox(nid);
    if (o) { flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.0, 300); selectNode(nid); }
    return;
  }
  if (q) {
    await doSearch(q, true);
    if (lastSearch && lastSearch.hits.length) {
      const id = lastSearch.hits[0].id;
      setTimeout(() => {
        selectNode(id);
        const h = lastSearch.hits[0];
        if (h.snippet) {
          const ev = el("div", "ev");
          ev.style.borderColor = "#1b6e8c";
          ev.innerHTML = `<div class="muted" style="margin-bottom:4px">段落命中</div>` + h.snippet;
          $("#d-body").prepend(ev);
        }
      }, 520);
    }
    return;
  }
  // 默认飞到 Q4 定价泳道
  const first = L.nodes[Math.floor(L.nodes.length * 0.55)];
  if (first) flyTo(first.x, first.y, Math.min(cam.s, 0.9), 500);"""
assert old_boot in s
s = s.replace(old_boot, new_boot)
io.open(p, "w", encoding="utf-8").write(s)

# 3) HTML 里给弹窗加一个 id 占位（供上面的 before 使用）
p2 = "D:/03_code_list/project-git-项目知识时间轴/web/index.html"
h = io.open(p2, encoding="utf-8").read()
h = h.replace('<div id="place-text" class="quote"></div>',
              '<div id="place-text" class="quote"></div>')
io.open(p2, "w", encoding="utf-8").write(h)
print("ok")
