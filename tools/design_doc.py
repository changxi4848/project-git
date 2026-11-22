# -*- coding: utf-8 -*-
"""生成《项目Git 图谱方案 v3》docx"""
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
sec.top_margin, sec.bottom_margin = Cm(2.0), Cm(1.8)
sec.left_margin, sec.right_margin = Cm(2.1), Cm(2.1)

normal = doc.styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(10.5)
normal.font.color.rgb = INK
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.line_spacing = 1.5
normal.paragraph_format.space_after = Pt(3)


def ea(run):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)


def para(text="", size=10.5, bold=False, color=None, align=None, before=0, after=3, indent=0):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(before); pf.space_after = Pt(after); pf.line_spacing = 1.5
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
    p.paragraph_format.space_before = Pt(16); p.paragraph_format.space_after = Pt(7)
    r = p.add_run((f"{num}　" if num else "") + text)
    ea(r); r.font.size = Pt(15); r.bold = True; r.font.color.rgb = ACC
    pPr = p._p.get_or_add_pPr(); bdr = OxmlElement("w:pBdr"); b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single"); b.set(qn("w:sz"), "10"); b.set(qn("w:space"), "4")
    b.set(qn("w:color"), "D6DEE6"); bdr.append(b); pPr.append(bdr)


def h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text); ea(r); r.font.size = Pt(11.5); r.bold = True
    r.font.color.rgb = RGBColor(0x2C, 0x5E, 0x7A)


def bullets(items, size=10.2):
    for it in items:
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.9); pf.first_line_indent = Cm(-0.42)
        pf.space_after = Pt(2); pf.line_spacing = 1.45
        r0 = p.add_run("▪ "); ea(r0); r0.font.size = Pt(size); r0.font.color.rgb = RGBColor(0x3F, 0x8F, 0xC4)
        for i, seg in enumerate(it.split("**")):
            if not seg: continue
            r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (i % 2 == 1)


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def table(headers, rows, widths=None, size=8.8):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = ""
        p = c.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(1); p.paragraph_format.space_before = Pt(1)
        r = p.add_run(h); ea(r); r.font.size = Pt(size); r.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); shade(c, "2F2F5E")
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(1); p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.line_spacing = 1.25
            for j, seg in enumerate(str(v).split("**")):
                if not seg: continue
                r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (j % 2 == 1)
            if ri % 2 == 1: shade(cells[i], "F6F8FA")
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows: row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def figure(path, width, caption):
    doc.add_picture(path, width=Cm(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(caption, size=8.8, color=MUT, align="center", after=10)


def callout(text, size=9.8):
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]; cell.text = ""; shade(cell, "F2F5F8")
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(5); p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.4
    for i, seg in enumerate(text.split("**")):
        if not seg: continue
        r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (i % 2 == 1)
        r.font.color.rgb = ACC
    tcPr = cell._tc.get_or_add_tcPr(); bd = OxmlElement("w:tcBorders")
    el = OxmlElement("w:left"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "22")
    el.set(qn("w:color"), "3F8FC4"); bd.append(el); tcPr.append(bd)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


# ---------------- 封面 ----------------
para("", after=40)
para("项目Git · 图谱方案 v4", size=24, bold=True, color=ACC, align="center", after=6)
para("时间树 · 正交泳道 · 按月分章", size=13, color=MUT, align="center", after=4)
para("配套设计图：A（时间轴+正交泳道）／B（按月分章）", size=10, color=MUT, align="center", after=30)
para("2026-11-22", size=10, color=MUT, align="center")

doc.add_page_break()

# ---------------- 1 诊断 ----------------
h1("现在为什么乱：八条具体原因", "01")
para("不是颜色不好看，是**规则互相打架**。每一条都在制造交叉和拥挤：")
table(["#", "问题", "后果"],
      [["1", "节点大小只按连接数，决策和资料长得一样", "眼睛没有落点，看不出哪几件事撑着项目"],
       ["2", "所有标签常显、且贴在节点右侧", "横向一排必挤压，密的地方互相压字"],
       ["3", "力导向布局没有方向约束", "今天一个形状、明天另一个形状，无法记忆"],
       ["4", "跨核心的引用画成斜线", "一条斜线横穿整张图，是“乱”的主要来源"],
       ["5", "时间和归属挤在同一个坐标轴上", "要么时间不对，要么归属不对，总会撒谎"],
       ["6", "节点名字只写“Console 反编译”这种短语", "看不出它是**资料、过程还是计划**"],
       ["7", "连线只表示“有关系”，不表示“怎么走到下一步”", "主线断成一段一段，读者要自己脑补"],
       ["8", "类型只靠颜色区分", "色弱看不出来；黑底打印出来全一样"]],
      widths=[0.9, 7.2, 7.6], size=8.8)
callout("结论：**问题不在调参，在模型。** 必须先把“时间”和“归属”分到两个坐标轴上，再谈好看。")

# ---------------- 2 目标 ----------------
h1("设计目标（可验收）", "02")
bullets([
    "**没有斜线**：连线只允许水平、垂直两种方向；斜线数量必须为 0。",
    "**一眼看到主干**：决策节点显著大于资源节点，字号差 ≥ 3px。",
    "**标签不叠**：任意两个标签的包围盒不相交（同一行最小间距 ≥ 标签宽 + 16px）。",
    "**位置不撒谎**：横轴位置必须与时间单调一致；同一列 = 同一时间段。",
])

# ---------------- 3 方案 A ----------------
doc.add_page_break()
h1("方案 A：时间轴 + 正交泳道", "03")
figure("docs/design-A2.png", 16.6, "图 1　方案 A2：节点内是类型图标，标签两行（名字 + 类型·日期·状态），连线上写“怎么走到下一步”")

h2("3.1 布局规则")
table(["规则", "说明"],
      [["**分区**", "上：决策与里程碑；中：方案与复盘；下：资源（资料/数据/代码）"],
       ["**横轴**", "时间；月份竖线做参考；同一列 = 同一时间段"],
       ["**主干**", "决策节点水平串联，只在决策泳道内连线"],
       ["**资源归属**", "一个决策的一组资源，用**一条竖直主干 + 一条水平母线**接入：竖直从决策落下，母线横跨这组资源，每个资源用短竖线挂上"],
       ["**节点图标**", "圆内画类型图标：菱形=决策、页=方案、循环箭头=复盘、折角纸=资料、圆柱=数据、尖括号=代码、星=产出"],
       ["**节点标签**", "两行：**名称** + `类型 · 日期 · 状态`（如“资料 · 已产出代码”）——解决“这是资料还是过程”"],
       ["**连线标注**", "决策之间连线的上方写一句“上一步是怎么走到下一步的”，如“卡在「正在连接」”"],
       ["**资源分组**", "同一决策的资源放进一个**虚线分组框**，框内左图标 + 名称 + 类型说明"],
       ["**取代**", "红色段**并入主干**，旁边标“取代”；不再另画折线"]],
      widths=[3.0, 13.2], size=8.8)

h2("3.2 优点与代价")
bullets([
    "**优点**：极其整齐，任何一条线都能一眼追到底；资源再多也不会乱，因为母线把它们收成一组。",
    "**优点**：三层的语义非常清楚——“做了什么决策 / 靠什么方案 / 用哪些材料”。",
    "**代价**：纵向有三层，宽屏下会偏“横向拉长”；跨泳道的复用关系画不出来（只能靠悬停隐形线）。",
])

# ---------------- 4 方案 B ----------------
doc.add_page_break()
h1("方案 B：按月分章", "04")
figure("docs/design-B.png", 16.6, "图 2　列 = 月份；列内节点上下排，用细竖线表达归属；列间用箭头表示时间推进")

h2("4.1 布局规则")
table(["规则", "说明"],
      [["**分列**", "每一列是一个月（或一个阶段），列宽固定"],
       ["**列内**", "决策在上、资源在下；细竖线把同一列内相关的节点串起来"],
       ["**列间**", "底部一条水平箭头链，表示时间推进"],
       ["**取代**", "列内用红色小箭头（上 → 下）"],
       ["**不画跨列关系**", "跨月的复用一律隐形（悬停才出现），避免跨列长线"]],
      widths=[3.0, 13.2], size=8.8)

h2("4.2 优点与代价")
bullets([
    "**优点**：最像“项目路线图/看板”，非技术的人也能一眼看懂“这个月干了什么”。",
    "**优点**：天然按时间分块，不会有任何跨月的斜线。",
    "**代价**：列内关系只能靠上下顺序表达，比 A 弱；一个月里事情多的时候，列会很长。",
])

# ---------------- 5 对比 ----------------
doc.add_page_break()
h1("方案 C（推荐）：Git 式提交图", "05")
para("前面两个方案都在“画布局”，这一个在**借 Git 的记录方式**：一条主干是主线提交，一次尝试是一条分叉，"
     "分叉可以终止，也可以合并回主干；里程碑是一个 tag；材料挂在提交下面。")
figure("docs/design-C.png", 16.6, "图 3　方案 C：主干 + 分叉 + 终止（×）+ 合并 + tag + 材料附件")

h2("5.1 借了 Git 的哪些概念")
table(["Git 里的东西", "我们图上的东西", "视觉"],
      [["commit（一次提交）", "一条**决策**（不可变，只增不改）", "主干上的菱形"],
       ["parent（父提交）", "这条决策的**前置决策**", "主干线段"],
       ["branch（分支）", "一次**尝试**（比如“先走 HID 流”）", "向上分叉的灰线"],
       ["分支终止", "尝试被**放弃**（不删除，留在图上）", "虚线 + **×**"],
       ["merge（合并）", "这次尝试**被采纳**，回流主干", "双线汇合到主干"],
       ["tag", "**里程碑**（基线 b6677ef、v1.2 发布）", "右侧小旗"],
       ["blob / tree", "**资源**（资料、数据、代码）", "提交下方的虚线框"],
       ["diff", "这次比上次**多了什么材料**", "框内条目数量"]],
      widths=[4.4, 8.0, 4.2], size=8.6)

h2("5.2 为什么它比 A / B 都更合适")
bullets([
    "**主干本身就是一条“决策链”**：谁推翻了谁、哪条尝试被采纳，一眼看出来，不需要额外解释。",
    "**走错的路终于有了正确的画法**：不是挂在下面的一颗灰点，而是一条**从主干分出去、又终止的分支**——这正是现实里发生的事。",
    "**合并 = 采纳**：PCB 打样那条分支回流到“改板”，读者立刻明白“这个决定吸收了那次尝试”。",
    "**材料和提交的关系最清楚**：材料是“这次提交带的附件”，而不是散落在地上的点。",
    "**可以照搬 Git 的不可变性**：已发生的决策不能改，只能新增一条并标注取代——和 Git 的历史只增不改一致。",
])

h2("5.3 它不解决什么")
bullets([
    "**跨提交的引用**（一个资源被后面三条决策用到）在主干图上画不出来 → 仍然用**悬停出现的隐形点线**。",
    "**分支很多时**纵向会变高（每条尝试占一条泳道）→ 需要“分支折叠”：只显示当前选中的那条。",
])

h1("四个画法怎么选", "06")
table(["维度", "方案 A（正交泳道）", "方案 B（按月分章）"],
      [["**C（Git 式）**", "**★★★★★**", "★★★★☆（分叉多时需折叠）"],
       ["整齐程度", "★★★★★", "★★★★☆"],
       ["时间感", "★★★★☆（连续）", "★★★★★（分块）"],
       ["归属表达", "★★★★★（母线）", "★★★☆☆（靠顺序）"],
       ["信息密度", "高（一屏看很多）", "中（每列留白多）"],
       ["非技术可读性", "★★★☆☆", "★★★★★"],
       ["实现难度", "低（纯坐标计算）", "很低（列 × 行）"]],
      widths=[3.2, 6.4, 6.4], size=8.8)

callout("**建议：主视图用 A，另给一个“按月看”的切换（B）。** 两者共用同一份数据，只换布局函数——"
        "A 回答“项目由哪几件事撑着”，B 回答“这个月发生了什么”。")

# ---------------- 6 落地规格 ----------------
h1("落地规格（写代码时照这个来）", "07")

h2("6.1 节点")
table(["类型", "半径", "标签", "颜色"],
      [["决策 / 里程碑", "10 px", "常显，12.5px 粗体", "红 #D9534F"],
       ["产出", "9 px", "常显", "金 #C08A3E"],
       ["方案", "8 px", "常显，11px", "蓝 #3F8FC4"],
       ["复盘", "8 px", "常显", "紫 #7C6BC4"],
       ["资源（资料/数据/代码）", "5 px", "常显，10px 灰", "棕 / 青 / 蓝灰"],
       ["已放弃", "5 px", "常显 + 删除线", "灰 #B9C2CB"]],
      widths=[5.0, 2.6, 5.6, 4.2], size=8.6)

h2("6.2 图标与标签")
table(["类型", "图标", "标签第二行示例"],
      [["决策", "菱形", "决策 · 08-12 · 有效 / 已放弃"],
       ["方案", "文档页（带两条横线）", "方案 · 08-10"],
       ["复盘", "循环箭头", "复盘 · 10-20"],
       ["资料", "折角纸", "资料 · 已产出代码 / 记录 · 44 条"],
       ["数据", "数据库圆柱", "数据 · 73 个 .bin"],
       ["代码", "尖括号 </>", "代码 · 113 commits"],
       ["产出", "星形", "产出 · 论文初稿"]],
      widths=[2.6, 5.4, 8.2], size=8.6)

h2("6.3 连线（只有四种）")
table(["关系", "画法", "禁止"],
      [["时间/归属主干", "水平或垂直实线，1.4px，色 #CBD5DF", "斜线"],
       ["资源接入", "竖直主干 + 水平母线 + 短竖线，1px，色 #DCE3EA", "从资源直接斜拉到决策"],
       ["取代", "红色折线（两段直角）+ 箭头，1.6px", "红色斜线"],
       ["复用引用", "**默认不画**，悬停资源时出现细点线", "常显"]],
      widths=[3.4, 8.4, 4.4], size=8.6)

h2("6.4 交互")
bullets([
    "**悬停**：该节点 + 一跳邻居高亮，其余淡到 15%；隐藏的复用点线浮现。",
    "**点击**：右侧滑出详情（出处 / 字段 / 关联 / 打开文件），画布不位移。",
    "**拖动**：只移动该节点；松手后同组节点轻微让位（约 0.4 秒），不重排整图。",
    "**缩放**：滚轮以指针为锚点；缩到 60% 以下时资源标签隐去，只留决策标签。",
    "**切换**：A/B 两个视图一键切换，共用数据。",
])

h2("6.5 验收清单")
bullets([
    "斜线数量 = 0（除取代关系的一处折线）。",
    "任意两个标签包围盒不相交。",
    "决策节点半径 ≥ 资源节点的 1.8 倍。",
    "横轴位置与时间严格单调。",
    "缩放到 100% 时，一屏内能看到至少 6 个决策及其资源。",
    "任意节点：不看颜色，只看图标也能说出它是什么类型。",
    "任意两个相邻决策之间的连线上，都有一句说明“为什么走到下一步”。",
])

para("")
para("—— 方案完 ——", size=9, color=MUT, align="center")

doc.save("docs/项目Git-图谱方案v4.docx")
print("saved")
