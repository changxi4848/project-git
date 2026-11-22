import io
p = r"tools\soft_doc.py"
s = io.open(p, encoding="utf-8").read()

# 第 4 章补“文件预览”
s = s.replace('h2("4.5 Git 接入")',
'''h2("4.5 文件预览（应用内打开）")
para("详情面板给两个按钮：**在应用内打开** / **外部打开**。应用内预览覆盖四类格式，且都支持**定位高亮**：")
table(["格式", "渲染方式", "定位能力", "状态"],
      [["Markdown", "marked 渲染成 HTML，再在 DOM 里找到原文片段包 `<mark>`", "定位到命中句并滚动到视口中央", "已实现"],
       ["纯文本", "等宽显示，按字符区间包 `<mark>`", "精确到字符区间", "已实现"],
       ["代码", "行号 + 等宽，按字符区间定位到行", "定位到行并高亮", "已实现"],
       ["图片", "`<img>` + 叠加命中框", "bbox 框选", "已实现"],
       ["PDF", "pdf.js 渲染（当前 Electron 内嵌会顶掉窗口）", "页码 + 框选", "**降级**：先给「外部打开」"],
       ["docx / xlsx", "mammoth / SheetJS", "段落 / 单元格", "待做（P1）"]],
      widths=[2.6, 7.4, 4.6, 3.4], size=8.2)
para("安全：渲染出的 HTML 必须过一遍消毒（去掉 script 与 on* 属性），CSP 已禁止远程脚本。文件只存路径不存内容，打开时校验存在性。")

h2("4.6 Git 接入")''')

# IPC 表加一行
s = s.replace('''       ["`file:openExtern`", "{ nodeId }", "{ ok, path }"],''',
'''       ["`file:openExtern`", "{ nodeId }", "{ ok, path }"],
       ["`file:preview`", "{ nodeId }", "{ kind, text | dataUrl, start, end }"],''')

# 验收加一条
s = s.replace('''    "`Ctrl+Z` 能撤销上一次修改。",''',
'''    "`Ctrl+Z` 能撤销上一次修改。",
    "点「在应用内打开」：Markdown 渲染成带表格的正文，并自动滚到命中句、高亮。",''')

io.open(p, "w", encoding="utf-8").write(s)
print("ok")
