# -*- coding: utf-8 -*-
"""《项目Git · 软件设计稿 v1.0》"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

INK = RGBColor(0x1F, 0x29, 0x33)
MUT = RGBColor(0x6B, 0x7A, 0x88)
ACC = RGBColor(0x2F, 0x2F, 0x5E)
FONT = "微软雅黑"

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.top_margin, sec.bottom_margin = Cm(1.9), Cm(1.7)
sec.left_margin, sec.right_margin = Cm(2.0), Cm(2.0)

normal = doc.styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(10)
normal.font.color.rgb = INK
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.line_spacing = 1.45
normal.paragraph_format.space_after = Pt(3)


def ea(run):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)


def para(text="", size=10, bold=False, color=None, align=None, before=0, after=3, indent=0):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(before); pf.space_after = Pt(after); pf.line_spacing = 1.45
    if indent: pf.left_indent = Cm(indent)
    if align == "center": p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for i, seg in enumerate(text.split("**")):
        if not seg: continue
        r = p.add_run(seg); ea(r); r.font.size = Pt(size)
        r.bold = bold or (i % 2 == 1)
        r.font.color.rgb = color or INK
    return p


def h1(text, num=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(15); p.paragraph_format.space_after = Pt(6)
    r = p.add_run((f"{num}　" if num else "") + text)
    ea(r); r.font.size = Pt(14.5); r.bold = True; r.font.color.rgb = ACC
    pPr = p._p.get_or_add_pPr(); bdr = OxmlElement("w:pBdr"); b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single"); b.set(qn("w:sz"), "10"); b.set(qn("w:space"), "4")
    b.set(qn("w:color"), "D6DEE6"); bdr.append(b); pPr.append(bdr)


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9); p.paragraph_format.space_after = Pt(3)
    r = p.add_run(text); ea(r); r.font.size = Pt(11); r.bold = True
    r.font.color.rgb = RGBColor(0x2C, 0x5E, 0x7A)


def bullets(items, size=9.8):
    for it in items:
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.85); pf.first_line_indent = Cm(-0.4)
        pf.space_after = Pt(2); pf.line_spacing = 1.4
        r0 = p.add_run("▪ "); ea(r0); r0.font.size = Pt(size); r0.font.color.rgb = RGBColor(0x3F, 0x8F, 0xC4)
        for i, seg in enumerate(it.split("**")):
            if not seg: continue
            r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (i % 2 == 1)


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def table(headers, rows, widths=None, size=8.4, first_bold=True):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ""
        p = c.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(1); p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(h); ea(r); r.font.size = Pt(size); r.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); shade(c, "2F2F5E")
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(1); p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.line_spacing = 1.2
            for j, seg in enumerate(str(v).split("**")):
                if not seg: continue
                r = p.add_run(seg); ea(r); r.font.size = Pt(size)
                r.bold = (j % 2 == 1) or (first_bold and i == 0)
            if ri % 2 == 1: shade(cells[i], "F6F8FA")
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows: row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def code(text, size=7.8):
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]; cell.text = ""; shade(cell, "F7F9FB")
    first = True
    for line in text.strip("\n").split("\n"):
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        p.paragraph_format.space_after = Pt(0); p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.line_spacing = 1.12
        r = p.add_run(line); ea(r, ); r.font.name = "Consolas"
        r.font.size = Pt(size); r.font.color.rgb = RGBColor(0x22, 0x33, 0x40)
    tcPr = cell._tc.get_or_add_tcPr(); bd = OxmlElement("w:tcBorders")
    el = OxmlElement("w:left"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "18")
    el.set(qn("w:color"), "3F8FC4"); bd.append(el); tcPr.append(bd)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def figure(path, width, caption):
    if not os.path.exists(path):
        para(f"[缺图：{path}]", size=8, color=MUT); return
    doc.add_picture(path, width=Cm(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(caption, size=8.4, color=MUT, align="center", after=8)


def callout(text, size=9.4):
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]; cell.text = ""; shade(cell, "F2F5F8")
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.35
    for i, seg in enumerate(text.split("**")):
        if not seg: continue
        r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (i % 2 == 1)
        r.font.color.rgb = ACC
    tcPr = cell._tc.get_or_add_tcPr(); bd = OxmlElement("w:tcBorders")
    el = OxmlElement("w:left"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "20")
    el.set(qn("w:color"), "3F8FC4"); bd.append(el); tcPr.append(bd)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ================= 封面 =================
para("", after=46)
para("项目Git", size=32, bold=True, color=ACC, align="center", after=6)
para("软件设计稿 v1.0", size=15, color=MUT, align="center", after=4)
para("团队决策的提交图 · 桌面应用", size=11, color=MUT, align="center", after=40)
para("功能设计 · 视图设计 · 实现方法 · 验收标准", size=9.5, color=MUT, align="center", after=3)
para("2026-11-22", size=9.5, color=MUT, align="center")

doc.add_page_break()

# ================= 00 =================
h1("摘要", "00")
para("项目Git 是一个**桌面应用**：把团队散在群聊、纪要、文档里的决定、方案、复盘，自动判断归属，"
     "长成一张 **Git 式提交图**——主干是主线决策，分叉是一次尝试，尝试可以终止（走错的路不会被删掉），"
     "也可以合并回主干（被采纳）；里程碑是一个 tag；每次提交下面挂着这次用到的材料。")

table(["这一版确定的四件事", "结论"],
      [["**视图形态**", "Git 式提交图（主干 / 分支 / 终止 / 合并 / tag / 材料附件）——见第 5 章"],
       ["**数据模型**", "借 Git 的对象模型：条目不可变、父指针、分支是并行尝试、tag 是里程碑"],
       ["**技术形态**", "Electron 桌面应用，渲染层与主进程分离，无服务器、无端口、断网可用"],
       ["**输入方式**", "粘贴群聊/纪要 → 切条 → 判定归属 → 落图；文件与 git 作为补充入口"]],
      widths=[4.2, 12.4], size=8.8)

callout("**一句话**：Git 记录“文件变成了什么样”，项目Git 记录“事情被定成了什么样”——"
        "结构照抄 Git（DAG + 不可变 + 指针），但把 commit 换成“决策条目”。")

# ================= 01 =================
h1("产品定位", "01")

h2("1.1 目标用户")
table(["角色", "他们的问题", "在图上的落点"],
      [["项目负责人", "这个项目到底做了哪些决定，哪条路走错了", "主干 + 已终止的分支"],
       ["新加入的人", "为什么要这么做，之前试过什么", "分支 + 每条提交下的材料"],
       ["复盘/答辩", "把过程讲清楚，别讲成流水账", "带叙事标注的主干"],
       ["AI 助手（后续）", "要能按结构读，而不是读一堆散文", "结构化条目 + 显式关系"]],
      widths=[3.2, 8.0, 5.4], size=8.4)

h2("1.2 与竞品的差别")
para("企业知识问答（飞书知识问答、Glean、Guru）解决的是“资料在哪、怎么回答”；它们假设知识先被治理干净。"
     "项目Git 处理的是另一半：**知识永远是脏的、过期的、互相矛盾的**，所以它不追求“答得对”，"
     "而是让每条东西都有位置、有状态、有出处，并且**走错的路也保留在图上**。")

h2("1.3 不做的事")
bullets([
    "不替代 Git：只读 `git log`，不写仓库、不解析代码。",
    "不替代项目管理工具：不管任务流，只记“决定与它的材料”。",
    "不做通用知识库：不做多租户、不做权限体系（第一版）。",
])

# ================= 02 =================
h1("核心概念：借 Git 的模型", "02")
para("整套设计只有一个隐喻：**项目是一串提交**。下面的映射贯穿数据模型、视图和交互。")
table(["Git 里的东西", "项目Git 里的东西", "视觉"],
      [["commit", "一条**决策**（不可变，只增不改）", "主干上的菱形"],
       ["parent", "前置决策", "主干线段"],
       ["branch", "一次**尝试**", "向上分叉的线"],
       ["分支终止", "尝试**被放弃**（保留不删）", "虚线 + ×"],
       ["merge", "尝试**被采纳**，回流主干", "两条线汇合"],
       ["tag", "**里程碑**（基线 / 发布）", "右侧小旗"],
       ["blob / tree", "**材料**（资料 / 数据 / 代码）", "提交下方虚线框"],
       ["diff", "这次比上次多了什么", "框内条目数"],
       ["`git log --graph`", "整个视图的排布规则", "—"]],
      widths=[3.6, 8.4, 4.6], size=8.4)

# ================= 03 =================
h1("数据模型", "03")

h2("3.1 条目（决策 / 方案 / 复盘 / 产出）")
code('''{
  "id": "n_1042",                    // 主键
  "project": "p_relay",              // 属于哪个项目
  "type": "decision",                // decision | plan | retro | doc | data | code | output
  "title": "放弃 HID，改 GATT 直连",
  "summary": "广播名用 Elite，Console 就走 GATT",
  "content_at": "2026-09-02",        // 内容时间（用于横轴）
  "ingest_at": "2026-11-22T10:00",   // 入库时间（审计用）
  "status": "active",                // active | superseded | abandoned | draft
  "parents": ["n_1031"],             // 前置条目（可多个 = merge）
  "branch": "main",                  // main | feat/hid | feat/pcb
  "tag": "b6677ef",                  // 里程碑（可选）
  "source": {                        // 材料出处
    "file": "中继底座-试错记录.md",
    "locator": { "kind": "text", "start": 393, "end": 413 },
    "excerpt": "这是稳定基线（git b6677ef）"
  },
  "extra": { "结论": "GATT 直连", "理由": "HID 描述符不完整" }
}''')

h2("3.2 关系（边）")
table(["关系", "含义", "画法"],
      [["parent", "这条决策由哪条而来", "主干线段 / 分叉"],
       ["supersedes", "推翻（旧条目状态变 superseded）", "灰色旧条目"],
       ["merge", "两条线合成一条", "汇合点"],
       ["attachment", "材料挂在这一条下", "虚线框"],
       ["uses", "**跨条目的复用**（一个资源被后面用到）", "默认不画，悬停出现"]],
      widths=[3.0, 8.0, 5.6], size=8.4)

h2("3.3 类型与字段（可自定义）")
code('''{
  "id": "decision", "name": "决策", "icon": "diamond", "color": "#D9534F",
  "fields": [
    { "key": "结论", "kind": "text", "required": true },
    { "key": "负责人", "kind": "person" },
    { "key": "理由", "kind": "longtext" }
  ]
}
// 字段名用中文；字段定义会编译成 JSON Schema 交给模型抽取''')

h2("3.4 状态机")
code('''draft ──提交──▶ active ──被推翻──▶ superseded
                   │
                   └──走不通──▶ abandoned（保留在图上，画成终止分支）''')

# ================= 04 =================
h1("功能设计", "04")

h2("4.1 功能清单")
table(["模块", "功能", "优先级", "说明"],
      [["捕获", "粘贴文本 → 切条 → 判定归属", "P0", "核心入口，3 秒内出结果"],
       ["捕获", "文件导入（.md/.txt/.pdf）", "P1", "按段落建条目"],
       ["捕获", "图片识别", "P2", "多模态转写，暂未接"],
       ["视图", "Git 式提交图（主干/分支/终止/合并/tag/材料）", "P0", "主视图"],
       ["视图", "分支折叠（只看选中分支）", "P1", "分支多时用"],
       ["检索", "关键词检索 + 高亮跳转", "P0", "标题/摘要/原文三路"],
       ["问答", "问一问：5 个工具 + Agent 循环 + 字符级引用", "P0", "无 key 时本地规划器兜底"],
       ["迁移", "批量导入 ingest（Agent 按 JSON 灌入整个项目）", "P0", "标准化 / 去重 / 补边 / 备份"],
       ["详情", "出处置顶 + 打开文件", "P0", "文本定位到字符区间"],
       ["编辑", "改父节点 / 改类型 / 标取代 / 删除 / 撤销", "P0", "AI 会错，人随时能改"],
       ["类型", "新建类型与中文字段", "P1", "字段即抽取结构"],
       ["Git", "只读接入仓库，commit → 提交节点", "P1", "读 log / tag"],
       ["队列", "待归类（拿不准的）", "P0", "绝不静默丢弃"]],
      widths=[2.2, 8.2, 1.8, 5.4], size=8.2)

h2("4.2 捕获与归位")
para("一条粘贴内容进来，做三件事：**切条 → 判定 → 闸门**。")
code('''切条：按「说话人 + 时间」切；识别 [图片] 等占位符；过短（≤4 字）丢弃并记日志
判定：type（线索词）+ project（关键词）+ parent（相似度/时间邻近/类型亲和）
闸门：置信度 ≥0.68 且分差 ≥0.10  → 自动挂
      置信度够但分差太小        → 弹窗问「这条属于哪里？」
      都不够                    → 进待归类队列（不丢）''')
para("分差这一条很关键：模型最危险的时刻不是“我只有 0.4 的把握”，而是“A 是 0.42、B 是 0.40”——它在瞎猜，但看起来很自信。")

h2("4.3 编辑与调整")
bullets([
    "**拖动**：把一个条目拖到另一个条目上 = 改父节点；松手后同组轻微让位，不重排整图。",
    "**标记取代**：右键菜单进入“点一个被取代的条目”状态，点完旧条目变 superseded。",
    "**撤销**：每次修改前压栈，`Ctrl+Z` 回退（最多 60 步）。",
])

h2("4.4 检索与详情")
para("检索三路打分（标题 / 摘要 / 原文片段），聚合到条目；命中后画布飞到该点并高亮一跳邻居。"
     "详情面板**出处置顶**：文件名 + 定位（字符区间或页码）+ 原文片段 + 「打开文件」按钮（系统默认程序打开整份文件）。")

h2("4.5 文件预览（应用内打开）")
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

h2("4.6 Git 接入")
para("只读执行 `git log --all --pretty=format:...`，把 commit 变成条目：title=提交说明、content_at=作者时间、"
     "parents=父提交、tag=里程碑。**不写仓库、不 checkout、不改配置。**")

# ================= 05 =================
h1("视图设计", "05")
figure("docs/图-主视图.png", 16.8, "图 1　主视图（卡片式）：主干为决策链，分叉为尝试，× 为终止，汇合为采纳，右上徽标为 tag，下方为材料卡")

h2("5.1 布局规则（六条）")
table(["规则", "内容"],
      [["**横轴**", "时间，从左到右；同一 x 区间 = 同一时间段"],
       ["**主干**", "`branch = main` 的条目水平串联，只在主干泳道内连线"],
       ["**分叉**", "`branch ≠ main` 的条目从父提交斜向分出（45° 短线），再水平延伸"],
       ["**终止**", "`status = abandoned` 的分支末端：虚线 + ×，并在右侧标注“尝试终止 · 日期”"],
       ["**合并**", "有两个父的条目：两条线在这一点汇合，标注“合并：<理由>”"],
       ["**材料**", "挂在提交卡片正下方：浅灰容器 + 若干白色小卡（图标 / 名称 / 类型·数量）"]],
      widths=[2.4, 14.0], size=8.4)

h2("5.2 卡片规格")
table(["元素", "规格"],
      [["**提交卡片**", "230 × 96，圆角 10，白底，1px 边框（边框色 = 类型色），投影 y-3 / 8% 透明"],
       ["**左色条**", "4px 宽，圆角 2，垂直居中，颜色 = 类型色（决策红 / 方案蓝 / 复盘紫 / 产出金）"],
       ["**卡内布局**", "左侧 24px 图标 → 右侧两行：标题 11.5px/600，副标题（类型 · 日期）8.4px 灰"],
       ["**自动换行**", "标题不截断：中文按字、英文按词换行；最多两行，卡片高度随之从 96 增到 118"],
       ["**状态徽标**", "卡片右上角圆角胶囊：已放弃 / 已取代 / 草稿，灰底灰字"],
       ["**tag 徽标**", "卡片右下角：米底金边，等宽字体 `tag b6677ef`"],
       ["**材料卡**", "卡片正下方，同宽，浅灰底容器；每行一张白色小卡（34px 高）：图标 + 名称 9px + `类型 · 数量` 7.6px"],
       ["**连线**", "1.5px 灰 `#CBD5DF`，末端小箭头；分支线 1.6px `#AEB9C5`，45° 进出"],
       ["**连线标注**", "主干卡片上方的浅灰胶囊，8.2px，写“怎么走到下一步”"],
       ["**终止标记**", "虚线 + × + “尝试终止”，卡片转灰底、虚线边框"]],
      widths=[3.2, 14.0], size=8.4)

h2("5.3 视觉系统（tokens）")
table(["类别", "取值"],
      [["**底色**", "画布 `#FFFFFF`；主干区 `#F8FAFC`；材料容器 `#FBFCFD`"],
       ["**文字**", "主 `#111827`；次 `#6B7A88`；弱 `#9AA5B1`"],
       ["**类型色**", "决策 `#D9534F`｜方案 `#3F8FC4`｜复盘 `#7C6BC4`｜资料 `#A1785A`｜数据 `#3F9D94`｜代码 `#5F7590`｜产出 `#C08A3E`"],
       ["**间距**", "主干卡间距 3.2 单位（约 0.6 卡宽）；分支泳道距主干 1.95；材料卡与卡片间距 0.10"],
       ["**圆角**", "卡片 10 / 小卡 8 / 胶囊 9（一律不超过 12）"],
       ["**投影**", "只有卡片有：`0 3 8 rgba(16,24,40,.06)`，其余元素用 1px 边框区分层次"]],
      widths=[2.8, 14.4], size=8.4)

h2("5.4 交互")
table(["操作", "行为"],
      [["悬停条目", "该条目 + 一跳邻居高亮，其余淡到 15%；隐形引用线浮现"],
       ["点击条目", "右侧滑出详情（不挤压画布）"],
       ["拖动条目", "移动该条目；松手后同组让位（0.4 秒缓动）"],
       ["滚轮", "以指针为锚点缩放"],
       ["双击", "聚焦到该条目"],
       ["`F` / `R` / `Esc`", "适应窗口 / 复位布局 / 关闭面板"]],
      widths=[3.6, 14.0], size=8.4)

h2("5.5 分支折叠（P1）")
para("分支多时纵向会变高。规则：默认只展开**当前选中条目所在分支**；其他分支折叠成一条虚线 + “+2 条尝试”，点开再展开。")

# ================= 06 =================
h1("实现架构", "06")
figure("docs/图-架构.png", 16.4, "图 2　两层架构：渲染层只画界面；主进程负责判定、存储、文件与 git")

h2("6.1 进程与职责")
table(["层", "职责", "禁止"],
      [["渲染层（Renderer）", "画图、面板、交互、调用 `window.api`", "不许 fs / child_process / 网络"],
       ["preload", "contextBridge 暴露 15 个白名单方法", "不许暴露通用 invoke"],
       ["主进程（Main）", "IPC 路由、engine 判定、store 落盘、文件定位、git 只读", "不做 UI"]],
      widths=[3.6, 9.6, 4.2], size=8.4)

h2("6.2 目录结构")
code('''desktop/
  main.js          主进程：窗口、菜单、IPC、文件与 git
  preload.js       白名单桥（window.api）
  engine.js        切条 / 判定 / 检索 / 轨迹（纯函数）
  store.js         状态读写、撤销栈、原子写
  qa.js            问答：5 个工具 + Agent 循环 + 本地兜底
  ingest.js        批量迁移：归一、去重、自动补边
  web/             单页结构 + 样式 + 渲染交互 + vendor
data/
  state.json       当前数据（唯一真相，原子写）
  files/           材料原文（每个资料/数据/代码条目一份）
  qa_config.json   问答配置（baseURL / model / apiKey）
tools/
  ingest.js        命令行导入入口（batch.json 或 stdin）
  eval_qa.js / eval_hard.js   两套评估：简单 20 题 / 难 20 题
docs/  skills/     设计图与文档 · 给 Agent 的操作手册''')

h2("6.3 IPC 契约")
table(["通道", "入参", "返回"],
      [["`state:get`", "—", "完整状态快照"],
       ["`capture`", "{ text, date }", "{ items[], dropped[], stats }"],
       ["`place`", "{ item, parent, type, placement }", "{ node_id }"],
       ["`edit`", "{ op, id, ... }", "{ ok }"],
       ["`undo` / `redo`", "—", "{ ok }"],
       ["`type:add`", "{ name, fields }", "{ type }"],
       ["`search`", "{ q }", "{ hits[], trace[], neighbors[] }"],
       ["`file:open`", "{ nodeId }", "{ kind, text|image, start, end }"],
       ["`file:preview`", "{ nodeId }", "{ kind, text | dataUrl, start, end }"],
       ["`file:reveal`", "{ nodeId }", "{ ok, path }（资源管理器选中）"],
       ["`file:openExtern`", "{ nodeId }", "{ ok, path }"],
       ["`ingest:batch`", "{ batch, dryRun }", "{ project, warnings, created, updated, skipped, edges, dryRun }"],
       ["`ingest:schema`", "—", "{ ok, schema }（给 Agent 看的 JSON 契约）"],
       ["`qa:ask`", "{ q }", "{ ok, answer, citations[], trace[], mode, ms }"],
       ["`qa:info`", "—", "{ mode, baseURL, model, tools[] }"],
       ["`git:sync`", "{ repo? }", "{ added, total }"]],
      widths=[4.2, 6.4, 6.8], size=8.2)

h2("6.4 关键实现点")
bullets([
    "**布局是纯计算**：给定条目与分支，算 x/y；不依赖力导向，不依赖第三方布局库（ELK 试过，不适用单链）。",
    "**渲染与状态分离**：`draw()` 只读 `ns/ls` 两个数组；任何数据变化先重建数组再重绘。",
    "**文件定位**：文本用字符区间；PDF 用 `pdftoppm` 渲染该页 + 叠加命中框（不引入 Python 依赖）。",
    "**原子写**：`state.json` 先写 `.tmp` 再 rename，断电不损坏。",
])

h2("6.5 问答层架构：工具层 / 规划层 / 评估层")
para("「问一问」不是“接个大模型就完事”。它被拆成**三层**，层与层之间只传 JSON：模型只被允许“决定调哪个工具”，"
     "事实一律由工具给，成绩一律由评估集量。")
table(["层", "是什么", "换掉它会怎样", "落点"],
      [["**工具层**", "5 个只读函数：`list_projects` / `search` / `get_node` / `get_timeline` / `get_citations`；入参是 JSON Schema，出参是纯数据", "**不能换**：答案的事实来源；换模型、换本地、换厂商，这 5 个函数一字不改", "`desktop/qa.js`"],
       ["**规划层**", "决定“先查哪个、要不要再查一次”。两种实现：模型（OpenAI 兼容 function-calling，最多 6 轮工具调用）或本地确定性规划器", "**可换**：改配置就换模型；没有 key 或模型报错就自动切本地", "`qa_config.json` + 环境变量"],
       ["**评估层**", "20 题简单问法 + 20 题换说法，走同一个 `qa.ask()` 入口，统计命中率、引用命中、耗时", "**不该换**：换模型前后用同一套题对比，才知道是模型变好还是题变简单", "`tools/eval_qa.js`、`eval_hard.js`"]],
      widths=[2.0, 6.8, 5.4, 3.6], size=8.1)
code('''// 工具层：一个工具 = 名字 + JSON Schema + 只读函数（只依赖 store / engine）
{ name: 'get_citations', parameters: { id: 'string' },
  run({ id }) { /* 文件、路径、kind、page、start/end、摘录 */ } }

// 规划层：同一个 ask(q)，两条路，出口同一个结构
if (apiKey) answer = await askWithModel(q)   // 最多 6 轮 function-calling
else        answer = askLocal(q)             // 确定性规划器（离线、毫秒级）
if (askWithModel 抛错) answer = askLocal(q)  // 回落，mode 写明原因

// 评估层：不碰 DOM，直接调同一个入口
const r = await qa.ask(q);  命中 = 期望词都出现在 r.answer 里''')
callout("**换模型不改工具**：5 个工具只认识 store（数据）和 engine（检索 / 时间），不认识 OpenAI、也不认识任何模型名。"
        "所以换模型 = 改 `data/qa_config.json` 里的 baseURL / model / apiKey 三个字段；本地兜底 = key 为空时自动生效。"
        "直接结果是：分数可以横着比——同一套工具、同一套题，变的只有“谁来规划”。")

# ================= 07 =================
h1("关键算法", "07")

h2("7.1 归位打分")
code('''score(parent) = 0.55 × 文本相似度
              + 0.25 × 时间邻近度
              + 0.20 × 类型亲和度（决策挂在方案下、复盘挂在决策下）

confidence = 0.45 × 类型强度 + 0.30 × 项目强度 + 0.25 × 父节点得分
             （类型与项目都 ≥0.8 时 +0.08 加成）
margin = 第一名 − 第二名''')

h2("7.2 布局：提交图")
code('''1. 取 branch = main 的条目，按 time 排序 → 主干 x 坐标（最小间距 300）
2. 其余条目按 branch 分组 → 每条分支一条泳道（y = ±(k × 泳道高)）
3. 分支起点 = 其父条目在主干上的 x；终点 = 该分支最后一个条目的 x
4. 终止分支：终点画 ×，不再向右延伸
5. 合并条目：两条线在同一 x 汇合
6. 材料：挂在其提交下方 0.6 单位，框宽随条目数自适应''')

h2("7.3 隐形引用线")
para("`uses` 关系**不参与布局、默认不绘制**；当悬停或选中某个材料条目时，才把它到各个使用点的细点线画出来（目标端一个空心点），"
     "同时把无关条目淡到 15%。这样“一个资源被三处用到”不会把图拉成蜘蛛网。")

# ================= 08 =================
h1("数据与存储", "08")
table(["项", "方案"],
      [["存储位置", "开发态：`<repo>/data`；打包后：`%APPDATA%/项目Git/data`"],
       ["状态文件", "`state.json`（单一真相），原子写"],
       ["材料文件", "`files/` 目录，条目只存文件名 + 定位，不存内容"],
       ["备份", "`state.bak.json`（菜单「重置为演示数据」时自动生成）"],
       ["规模", "单文件 JSON，建议条目 < 5000；超过后拆分为按项目的分片"]],
      widths=[3.0, 14.0], size=8.4)

# ================= 09 =================
h1("稳定性与性能", "09")
table(["指标", "目标", "手段"],
      [["启动", "≤ 1.5 s", "不做网络请求、不扫描目录"],
       ["100 条目渲染", "60 fps", "Canvas 单次重绘，无 DOM 节点"],
       ["500 条目渲染", "≥ 30 fps", "视口剔除 + 标签按缩放分级显示"],
       ["归位一次", "≤ 3 s", "纯 JS 打分，无模型调用（模型可替换）"],
       ["问答一次（本地）", "≤ 50 ms", "工具链固定：检索 + 取详情 + 取引用，无模型调用（实测约 1 ms）"],
       ["批量导入 500 条", "≤ 5 s", "标准化 + 去重 + 补边一次遍历，单个 JSON 落盘"],
       ["崩溃恢复", "不丢数据", "原子写 + 每次修改前压栈"]],
      widths=[3.4, 4.6, 9.0], size=8.4)

# ================= 10 =================
h1("验收与测试", "10")

h2("10.1 验收清单")
bullets([
    "粘一段群聊 → 切出 ≥4 条，其中至少 1 条自动挂、1 条弹窗询问、1 条进队列。",
    "主干上 6 个提交按时间从左到右，无交叉。",
    "一条走错的分支显示为“分叉 + 虚线 + ×”，且**没有被删除**。",
    "一条被采纳的分支显示为“分叉 + 汇合”。",
    "每条有原文的条目，点「打开文件」能用系统默认程序打开整份文件。",
    "悬停一个材料条目，能看到它被后面的哪几条用到（隐形点线）。",
    "拖动一个条目后，同组条目让位，整图不重排。",
    "`Ctrl+Z` 能撤销上一次修改。",
    "点「在应用内打开」：Markdown 渲染成带表格的正文，并自动滚到命中句、高亮。",
])

h2("10.2 测试")
code('''node --check main.js engine.js store.js preload.js web/app.js   # 语法
node -e "require('./engine').segment(...)"                      # 纯函数单测
electron . --screenshot --relay                                  # 渲染冒烟
electron . --screenshot --drawer                                 # 面板冒烟''')

# ================= 11 =================
h1("路线图", "11")
table(["阶段", "内容", "状态"],
      [["v1.0", "捕获 / 归位 / 提交图 / 检索 / 详情 / 编辑 / 队列", "已实现"],
       ["v1.1", "提交图布局 + 分支折叠 + 材料分组框", "已实现"],
       ["v1.2", "问答层（5 工具 + Agent 循环 + 本地兜底）+ 批量迁移 ingest", "**已实现**"],
       ["v1.3", "图片识别（多模态）+ 文件批量导入", "待做"],
       ["v1.4", "Git 双向：从仓库读 commit 后，条目可挂到 commit 上", "待做"],
       ["v2.0", "多人协作：条目级权限 + 冲突合并（真的 merge）", "远期待定"]],
      widths=[2.2, 10.6, 5.4], size=8.4)

para("")
para("—— 设计稿完 ——", size=9, color=MUT, align="center")

doc.save("docs/项目Git-软件设计稿v1.0.docx")
print("saved")
