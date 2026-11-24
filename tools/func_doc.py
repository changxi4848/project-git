# -*- coding: utf-8 -*-
"""《项目Git · 功能设计稿 v1.0》"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

INK = RGBColor(0x1F, 0x29, 0x33); MUT = RGBColor(0x6B, 0x7A, 0x88); ACC = RGBColor(0x2F, 0x2F, 0x5E)
FONT = "微软雅黑"

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.top_margin, sec.bottom_margin = Cm(1.9), Cm(1.7)
sec.left_margin, sec.right_margin = Cm(2.0), Cm(2.0)
normal = doc.styles["Normal"]
normal.font.name = FONT; normal.font.size = Pt(10); normal.font.color.rgb = INK
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.line_spacing = 1.45; normal.paragraph_format.space_after = Pt(3)


def ea(r):
    r.font.name = FONT; r._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)


def para(text="", size=10, bold=False, color=None, align=None, before=0, after=3):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(before); p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.45
    if align == "center": p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for i, seg in enumerate(text.split("**")):
        if not seg: continue
        r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = bold or (i % 2 == 1)
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
    p.paragraph_format.keep_with_next = True
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


def table(headers, rows, widths=None, size=8.3):
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
                r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (j % 2 == 1)
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
        p.paragraph_format.line_spacing = 1.15
        r = p.add_run(line); r.font.name = "Consolas"
        r._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        r.font.size = Pt(size); r.font.color.rgb = RGBColor(0x22, 0x33, 0x40)
    tcPr = cell._tc.get_or_add_tcPr(); bd = OxmlElement("w:tcBorders")
    el = OxmlElement("w:left"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "18")
    el.set(qn("w:color"), "3F8FC4"); bd.append(el); tcPr.append(bd)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def callout(text, size=9.4):
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]; cell.text = ""; shade(cell, "F2F5F8")
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.35
    for i, seg in enumerate(text.split("**")):
        if not seg: continue
        r = p.add_run(seg); ea(r); r.font.size = Pt(size); r.bold = (i % 2 == 1); r.font.color.rgb = ACC
    tcPr = cell._tc.get_or_add_tcPr(); bd = OxmlElement("w:tcBorders")
    el = OxmlElement("w:left"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "20")
    el.set(qn("w:color"), "3F8FC4"); bd.append(el); tcPr.append(bd)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def figure(path, width, caption):
    if not os.path.exists(path):
        para(f"[缺图：{path}]", size=8, color=MUT); return
    doc.add_picture(path, width=Cm(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(caption, size=8.4, color=MUT, align="center", after=8)


# ================= 封面 =================
para("", after=46)
para("项目Git", size=31, bold=True, color=ACC, align="center", after=6)
para("功能设计稿 v1.0", size=15, color=MUT, align="center", after=4)
para("每个功能：做什么、怎么做、边界在哪、怎么验收", size=11, color=MUT, align="center", after=40)
para("2026-11-24", size=9.5, color=MUT, align="center")
doc.add_page_break()

# ================= 01 功能地图 =================
h1("功能地图", "01")
para("整个软件只有五件事：**进来、归位、看图、取证、问答**。下面的模块按这五件事排列。")
table(["模块", "功能", "一句话", "优先级"],
      [["**录入**", "收进来（粘贴）", "群聊/纪要贴进来，切成条目", "P0"],
       ["", "批量迁移（ingest）", "Agent 按 JSON 灌入整个项目，自动标准化", "P0"],
       ["", "文件导入", "md / txt / pdf 按段落建条目", "P1"],
       ["", "图片识别", "截图转写后入库", "P2"],
       ["**归位**", "自动判定", "判类型、判项目、判父节点", "P0"],
       ["", "闸门与追问", "拿不准就问一句，不静默丢", "P0"],
       ["", "待归类队列", "兜底：先存着，随时处理", "P0"],
       ["", "手动调整", "拖拽改父节点、改类型、标取代", "P0"],
       ["**看图**", "提交图主视图", "主干/分支/终止/合并/tag/材料", "P0"],
       ["", "类型标识", "卡片上直接看出是资料还是数据", "P0"],
       ["", "分支折叠", "分支多时收起，只看当前线", "P1"],
       ["**取证**", "详情面板", "简介 + 与上下节点的联系 + 出处", "P0"],
       ["", "应用内预览", "md / txt / 代码 / 图片 / PDF / Word 就地打开并定位", "P0"],
       ["", "文件定位", "点路径在文件管理器中显示", "P0"],
       ["", "原文齐备", "资料/数据/代码条目都带真实原文文件", "P0"],
       ["**问答**", "问一问", "自然语言提问，答案带字符级引用", "P0"],
       ["", "5 个只读工具", "list_projects / search / get_node / get_timeline / get_citations", "P0"],
       ["", "本地兜底", "没有模型 key 也能答（确定性规划器）", "P0"],
       ["**其它**", "检索", "关键词命中并跳转", "P0"],
       ["", "AI 指令总线", "外部 Agent 读图、定位、写入、提问", "P0"],
       ["", "类型与字段", "自定义类型与中文字段", "P1"],
       ["", "Git 只读接入", "commit 变提交节点", "P1"],
       ["", "数据管理", "重置演示数据、打开数据目录", "P1"]],
      widths=[1.9, 4.3, 8.0, 1.8], size=8.0)
callout("**优先级原则**：P0 = 没有它这个产品不成立；P1 = 让产品好用；P2 = 可以等。")

# ================= 02 录入 =================
h1("录入：收进来", "02")
h2("2.1 粘贴录入")
table(["环节", "规则"],
      [["**入口**", "顶栏「收进来」；快捷键 `Ctrl+V` 在画布上直接开弹窗并填入剪贴板内容"],
       ["**切条**", "按「说话人 + 时间」切分（如 `张伟 09-02 14:20`）；无标记时按空行切；单条少于 4 字丢弃并记日志"],
       ["**占位符**", "`[图片]` `[语音]` 等单独标记为“待补”，不删"],
       ["**时间**", "用消息里的时间；没有就用弹窗里的日期；再没有就用当天"],
       ["**结果**", "弹窗右上显示「切出 N 条」，逐条给出去处（自动挂 / 询问 / 队列）"]],
      widths=[3.0, 13.4], size=8.4)

h2("2.2 边界")
bullets([
    "**空文本**：按钮禁用并提示“先粘点东西”。",
    "**超长**（>20000 字）：先切条再逐条处理，界面显示进度，不卡死。",
    "**全被丢弃**：提示“没切出有效条目”，并列出丢弃原因（太短 / 无意义）。",
    "**重复**：与已有条目标题相同且时间相差 < 1 天 → 标为“疑似重复”，进队列而不是自动挂。",
])

# ================= 03 批量迁移 =================
h1("批量迁移（Agent 导入）", "03")
para("粘贴是给人用的入口；**批量迁移是给「使用者的 Agent」用的入口**——把一个项目里散落的材料，按约定 JSON 一次灌进来，"
     "项目Git 负责标准化、去重、补边、落盘，提交图自动长出来。完整字段说明见 `docs/INGEST.md`，"
     "给 Agent 的操作手册见 `skills/project-git-ingest/SKILL.md`。")

h2("3.1 三种调用方式")
table(["方式", "用法", "适用"],
      [["**命令行**", "`node tools/ingest.js batch.json [--dry-run]`", "Agent 有文件系统权限，最常用"],
       ["**标准输入**", "`cat batch.json | node tools/ingest.js -`", "Agent 直接管道，不落临时文件"],
       ["**应用内 IPC**", "`window.api.ingest({ batch, dryRun })`", "Agent 驱动应用时（不重启、立刻看图）"]],
      widths=[3.0, 8.4, 5.0], size=8.4)
callout("**先 dry-run 再正式导入**：`--dry-run` 只返回统计与警告，不写盘。Agent 应先跑一次、看 `warnings`，确认无硬伤再去掉该参数。")

h2("3.2 JSON 契约（摘要）")
code('''{
  "project": { "id": "p_demo", "name": "示例 · 课程设计" },
  "nodes": [
    { "key": "a",                    // 批内引用，可省略
      "type": "方案",                 // 方案/决策/复盘/资料/数据/代码/产出（也接受英文）
      "title": "先做单机版验证想法",     // 必填
      "summary": "一句话摘要",
      "date": "2026-03-02",          // 也接受 2026/3/2、2026年3月2日
      "status": "有效",               // 有效/已放弃/已取代/草稿
      "branch": "main",              // 非 main 即为分支（feat/xxx）
      "parents": ["a"],              // 父节点：key、id 或标题
      "tag": "v1.0",                 // 可选：里程碑
      "source": { "file": "冲突用例.md",
                  "locator": { "kind": "text", "start": 0, "end": 20 },
                  "excerpt": "原文片段" },
      "extra": { "理由": "为什么这么定" } } ],
  "edges": [ { "from": "d", "to": "b", "kind": "attach" } ]
}''')
table(["字段", "必填", "说明"],
      [["`title`", "✅", "没有 title 的条目会被跳过，并写入 `warnings`"],
       ["`status`", "—", "缺失 `active`；**“已放弃”会画成带 × 的终止分支**"],
       ["`branch`", "—", "默认 `main`（主线）；`feat/lan` 这类自动分叉"],
       ["`parents`", "—", "不写就没有上游，图上从行首开始；写两个 = 合并"],
       ["`source`", "—", "有 `source` 才能“点开原文”；没有则详情显示“无原文”"]],
      widths=[2.6, 1.7, 12.1], size=8.3)
para("`type` 与 `date` 的写法见 3.3：都做了归一，写中文、写不规范的日期都行。", size=9.0, color=MUT)

h2("3.3 标准化规则")
table(["#", "规则", "输入举例", "归一为"],
      [["1", "**类型归一**", "`决策 / 决定`；`方案 / 计划`；`复盘 / 回顾 / 总结`；`资料 / 文档`；`数据`；`代码`；`产出 / 成果`",
        "`decision` / `plan` / `retro` / `doc` / `data` / `code` / `output`"],
       ["2", "**状态归一**", "`已放弃 / 放弃 / 废弃`；`已取代 / 取代`；`有效 / 进行中`；`草稿`", "`abandoned` / `superseded` / `active` / `draft`"],
       ["3", "**日期归一**", "`2026/3/2`、`2026.3.2`、`2026年3月2日`", "`2026-03-02`（补零）"],
       ["4", "**引用归一**", "`parents` 里写批内 `key`、真实 `id` 或标题", "落盘前统一换成最终 `id`"],
       ["5", "**去重**", "同项目 + 同标题 + 同日期", "跳过并计入 `skipped`，不重复建条目"],
       ["6", "**自动补边**", "每个 `parent`", "自动生成一条 `derived` 边；已存在则不重复写"],
       ["7", "**落盘前备份**", "每次正式导入", "先写 `data/state.before-ingest.json`，再写 `data/state.json`"]],
      widths=[0.8, 3.2, 7.8, 5.6], size=8.1)
para("另外两条约定：**id 稳定**——给了 `id` 就用你的，没给则按 `项目_标题` 生成，所以同一份 JSON 重复导入不会重复建条目；"
     "**父指针双写**——只有一个父节点时同时写 `parent` 字段，兼容旧视图与检索。", size=9.4)

h2("3.4 给 Agent 的流程")
code('''1. 读项目材料 → 抽成 nodes（决定、方案、复盘、走错的路）
2. 用 parents 串出先后关系；走不通的标 status=已放弃 + branch=feat/xxx
3. 跑一次 dry-run，看 warnings 与 created/skipped
4. 没有硬伤 → 正式导入（去掉 --dry-run）
5. 打开应用、切到该项目，图就出来了；可立刻在「问一问」里自检''')
callout("**返回结构**：`{ project, warnings, created, updated, skipped, edges, dryRun }`。"
        "把 created / skipped 报给用户，比说“导入成功”有用。")

h2("3.5 注意事项")
bullets([
    "**不要编造 `source`**：没有原文文件就别写，否则详情点开是空的；宁可显示“无原文”。",
    "**日期用内容发生的日期**，不是今天——横轴按它排，写错会把故事讲反。",
    "**一条一个事件**：不要把一整段纪要塞进一个 title；标题超过一行，图上就只剩半句。",
    "**已放弃 ≠ 删除**：走错的路要导进来，这是本工具最有价值的部分。",
    "**分支名要有意义**：`feat/hid`、`feat/pcb` 会显示在图上，方便人读。",
])

# ================= 04 归位 =================
h1("归位：判定与闸门", "04")
h2("4.1 三个判断")
table(["判断", "依据", "出错后果"],
      [["**类型**", "线索词（“决定/定了”→决策，“方案/计划”→方案，“复盘/回顾”→复盘）", "卡片颜色与图标错，但内容还在"],
       ["**项目**", "关键词与项目名/材料名匹配度", "挂到别的项目，等于丢失"],
       ["**父节点**", "文本相似 + 时间邻近 + 类型亲和", "接错线，故事讲歪"]],
      widths=[2.4, 9.0, 5.0], size=8.4)

h2("4.2 闸门（决定要不要问人）")
table(["情形", "处理"],
      [["置信度 ≥0.68 且 与第二名分差 ≥0.10", "**自动挂**，卡片上标“自动”"],
       ["置信度够但分差 <0.10", "**弹窗问一句**：“这条属于哪里？”，列出 2~3 个候选 + “都不是”"],
       ["置信度 <0.68", "**进待归类队列**，不丢"],
       ["判断不出类型", "默认“资料”，并在详情里提示“类型待确认”"]],
      widths=[8.0, 8.4], size=8.4)
callout("**分差比置信度更重要**：模型最危险的时刻不是“我只有 0.4 的把握”，而是“A 0.42、B 0.40”——它在瞎猜，但看起来很自信。")

h2("4.3 手动调整")
bullets([
    "**改父节点**：在「调整模式」里把卡片拖到另一张卡片上，松手即改，并记一条“手动调整”审计。",
    "**改类型**：详情面板类型下拉，改完卡片颜色/图标/字段立刻变。",
    "**标取代**：右键「标记为取代」→ 点被取代的那条，旧条目转灰但保留在图上。",
    "**删除**：软删除（`status=deleted`），不真删；`Ctrl+Z` 可恢复。",
])

# ================= 05 主视图 =================
h1("主视图：提交图", "05")
figure("docs/图-主视图.png", 16.6, "图 1　卡片式提交图：主干、分支、终止 ×、合并、tag、材料卡")

h2("5.1 信息层级")
table(["元素", "承载信息", "强调方式"],
      [["**卡片**", "一条提交：类型 / 标题 / 时间 / 状态 / 里程碑", "白底卡片 + 投影"],
       ["**类型**", "资料 / 数据 / 代码 / 决策 / 方案 / 复盘", "**左侧淡色带 + 4px 色条 + 类型名上色**（三重强调）"],
       ["**状态**", "已放弃 / 已取代 / 草稿", "右上角灰底胶囊"],
       ["**里程碑**", "基线、版本", "右下角米底金边小旗"],
       ["**材料**", "这条提交用到的文件", "卡片正下方白色小卡，类型名同样上色"],
       ["**关系**", "怎么走到下一步", "主干线 + 上方小字"]],
      widths=[2.4, 8.0, 6.0], size=8.4)
callout("**类型为什么要三重强调**：卡片小、字多，单靠一条细色条在缩小时会消失。淡化色带负责“远看能分区”，色条负责“近看能识别”，类型名上色负责“不看颜色也能读”。")

h2("5.2 分支与终止")
bullets([
    "**分叉**：从卡片顶部 45° 引出，标注 `feat/xxx · 从主干分出`。",
    "**终止**：末端虚线 + **×** + “尝试终止”，卡片转灰底、虚线边框、右上角「已放弃」。",
    "**合并**：两条线汇到目标卡片，下方标“合并：<为什么采纳>”。",
])

# ================= 06 详情 =================
h1("详情面板", "06")
figure("docs/图-3-详情与预览.png", 14.2, "图 2　左：简介 + 与上下节点的联系 + 出处（可点击路径）；右：应用内预览与命中高亮")

h2("6.1 三段结构")
table(["区块", "内容", "为什么需要"],
      [["**简介**", "2~3 句：这条在说什么（结论 + 理由）", "卡片只有标题，看不懂就要点开；简介是“展开的标题”"],
       ["**与上下节点的联系**", "上一步：谁 → 本节点，因为什么；下一步：本节点 → 谁，因为什么", "**回答“它从哪来、到哪去”**，这正是提交图的价值"],
       ["**出处**", "文件名 + 完整路径（可点击）+ 定位 + 原文片段", "能立刻验证这条是不是真的"]],
      widths=[3.4, 8.0, 5.0], size=8.4)

h2("6.2 与上下节点的联系：具体规则")
table(["显示项", "来源", "没有时"],
      [["上一步", "本节点的 `parents[0]` + 该边的过渡说明", "显示“这是起点”"],
       ["下一步", "以本节点为父的第一个节点 + 过渡说明", "显示“这是当前最后一步”"],
       ["分支时", "额外显示“分出 / 合并”标签", "—"],
       ["点击", "跳到该节点并把视图居中", "—"]],
      widths=[2.6, 9.4, 4.4], size=8.4)

# ================= 07 出处与文件 =================
h1("出处与文件定位", "07")
h2("7.1 展示规则")
table(["项", "展示", "交互"],
      [["**文件名**", "正文 12px，如 `中继底座-试错记录.md`", "—"],
       ["**完整路径**", "等宽 11px，蓝色带下划线，如 `data/files/中继底座-试错记录.md`", "**点击 → 在文件管理器中显示并选中该文件**"],
       ["**定位**", "文本：第 393–413 字；PDF：第 2 页；图片：框选区域", "打开预览时自动跳到该位置"],
       ["**片段**", "原文摘录，最多 4 行，超出滚动", "—"],
       ["**按钮**", "「在应用内打开」「在文件夹中显示」", "前者进预览，后者调系统文件管理器"]],
      widths=[2.4, 8.4, 5.6], size=8.4)

h2("7.2 原文齐备与技术口径")
para("**每个资料 / 数据 / 代码条目都对应一份真实原文文件**（在 `data/files/` 下），条目本身不存正文，只存"
     "「文件名 + 定位 + 摘录」。所以详情里的路径不是装饰：点一下就能在资源管理器里选中那份文件，对着原文核这句话。")
bullets([
    "**没有原文的条目**（比如纯粘贴的群聊）详情显示“粘贴输入，没有原始文件”，不显示空按钮；**文件丢失**时路径标红并给「重新指定文件」。",
    "**路径只存相对**（`data/files/xxx`），展示时拼成绝对路径，换机器不失效。",
    "**在文件夹中显示**：`shell.showItemInFolder(absPath)`——打开资源管理器并**选中**该文件，不是打开文件本身；要打开用 `shell.openPath`。",
])

# ================= 08 预览 =================
h1("应用内预览", "08")
para("原文按格式分流：文本类就地渲染并高亮命中，PDF 走独立窗口，Word 渲染成可读的排版。")
table(["格式", "打开方式", "能不能定位"],
      [["Markdown", "就地渲染，命中句黄底高亮并滚到视口中央", "精确到字符区间"],
       ["文本 / 代码", "等宽显示，行号；命中行高亮", "精确到字符区间 / 行"],
       ["图片", "就地显示，命中处叠加红框", "bbox"],
       ["PDF", "独立窗口（可翻页），命中页红框", "页码 + 框选"],
       ["Word（.docx）", "就地渲染段落 / 表格 / 编号列表", "段落级"],
       ["Excel（.xlsx）", "暂给「外部打开」", "—"]],
      widths=[3.2, 9.4, 4.6], size=8.4)
table(["格式", "渲染", "定位", "状态"],
      [["Markdown", "marked 渲染 + 消毒", "找到原文句子包 `<mark>`，滚到视口中央", "已实现"],
       ["纯文本", "等宽显示", "按字符区间高亮", "已实现"],
       ["代码", "行号 + 等宽", "定位到行", "已实现"],
       ["图片", "`<img>` + 命中框", "bbox 叠加", "已实现"],
       ["PDF", "独立窗口（pdf.js），可翻页、命中处红框", "页码 + 框选", "已实现"],
       ["docx", "mammoth 渲染为 HTML（段落/表格/列表）", "段落级（不精确到字）", "已实现"],
       ["xlsx", "—", "—", "待做：暂给「外部打开」"]],
      widths=[2.6, 6.8, 5.6, 3.4], size=8.2)

# ================= 09 检索 =================
h1("检索", "09")
bullets([
    "**三路打分**：标题 > 摘要 > 原文片段，聚合到条目。",
    "**结果**：下拉最多 6 条，显示标题 + 类型；回车进第一条。",
    "**跳转**：点结果 → 画布居中该卡片 + 高亮一跳邻居，其余淡到 15%。",
    "**空结果**：显示“没有找到”，不误报。",
])
callout("**检索与「问一问」的分工**：检索回答“哪一条”，给的是位置；问一问回答“为什么、后来怎么样、原文在哪”，给的是带引用的句子。")

# ================= 10 问答与评估 =================
h1("问答与评估", "10")
para("顶栏「问一问」背后是一个**只读的 Agent Harness**：模型（或本地规划器）不能直接看数据库，只能通过 5 个工具取事实，"
     "再自己组织答案。答案里每条结论都要落到“哪份文件、第几字”，点引用直接跳原文。")

h2("10.1 五个工具")
table(["工具", "入参", "返回什么", "什么时候用"],
      [["`list_projects`", "—", "项目 id / 名称 / 有效条目数", "跨项目问题先定位到项目"],
       ["`search`", "{ q, project?, limit? }", "标题、类型、状态、日期、理由、有无原文", "先用它把候选找出来"],
       ["`get_node`", "{ id }", "完整条目 + prev/next + 自定义字段 + source", "看这一条的细节与上下游"],
       ["`get_timeline`", "{ project }", "main 主线顺序 + 各分支（含终止）", "回答“后来怎么样了”"],
       ["`get_citations`", "{ id }", "文件、路径、kind、page、start/end、摘录", "**答案必须基于它**；无 source 返回 error"]],
      widths=[2.7, 4.0, 6.6, 4.9], size=8.1)

h2("10.2 Agent 循环")
bullets([
    "**接口**：OpenAI 兼容的 `/chat/completions`，`tools` 用 function-calling 描述上表 5 个工具；默认 `deepseek-chat`，baseURL / 模型 / key 可配（环境变量或 `data/qa_config.json`）。",
    "**轮数**：最多 **6 轮**工具调用；模型不再发起工具调用时，把这一轮的内容当答案返回。单个工具结果截断 6000 字符，引用按条目 id 去重。",
    "**系统提示**：只用工具返回的事实、不许编造；说清条目状态（有效 / 被取代 / 已放弃）；时间类问题必须用 `get_timeline`；每个结论带引用；没出处的结论标“无原文”；中文、先结论后依据、不超过 300 字。",
    "**界面**：答案（Markdown）+ 引用清单（可点击定位）+ 一行元信息：`mode · 耗时 · 工具调用次数`。",
])

h2("10.3 本地兜底：没有 key 也能答")
para("没有 `apiKey`，或模型调用报错（超时 / HTTP 错误），自动切到**本地确定性规划器**，`mode` 里写明 `local` 或 `local(fallback: 原因)`。规则如下：")
table(["步骤", "做法"],
      [["**定位项目**", "题目里出现项目名 / 项目名分词 / 任一条目标题前 4 字 → 打分取最高，命中则把检索限定在该项目"],
       ["**判意图**", "“放弃 / 走不通 / 废 / 否掉”→ 优先 `abandoned`、`superseded`；“后来 / 现在 / 取代”→ 追加时间线；“原文 / 出处 / 第几”→ 强调引用"],
       ["**固定链**", "`search` → `get_node`（前 3 条）→ `get_citations` →（必要时）`get_timeline`，全程没有模型参与"],
       ["**组答案**", "结论 / 依据 / 之前 / 后来 / 放弃的尝试 / 相关，逐段拼；一条引用都没有时明确写“这条没有原文”"]],
      widths=[2.6, 13.8], size=8.3)
para("特性：确定性、毫秒级、离线可跑、不花钱——所以它能当**评估基线**，也保证断网时功能不假死。", size=9.4)

h2("10.4 两套评估集")
para("评估脚本直接调 `qa.ask()`，与界面走同一条路径；报告写入 `docs/qa-eval.json`。")
table(["评估集", "题目", "命中", "引用命中", "平均耗时", "说明"],
      [["`tools/eval_qa.js`（简单问法）", "20", "**19/20 = 95%**", "2/2", "1 ms", "题目含标题词，检索容易命中——**下限**"],
       ["`tools/eval_hard.js`（难问法）", "20", "**12/20 = 60%**", "2/3", "1 ms", "全部换说法、不含标题词——**真实水平**"]],
      widths=[5.0, 1.3, 3.2, 2.4, 1.9, 4.6], size=8.0)
table(["难问法分类", "命中", "说明"],
      [["**事实**", "2/6", "“当初为什么以为 HID 能走通”这类要跨条目推理，本地规划器基本不会"],
       ["**状态**", "5/6", "问题里有“放弃 / 放弃了吗”这类线索词，状态优先策略有效"],
       ["**跨项目**", "4/5", "项目定位打分够用，能落到对的项目的条目"],
       ["**溯源**", "1/3", "引用文件经常选对，但答案里没把原文关键词写出来，判为未命中"]],
      widths=[2.8, 1.8, 11.8], size=8.3)
callout("**难问法是真实水平，简单问法是下限**。本地规划器并不“聪明”，它只是把“查得到”做稳；接上模型后提升的是“问得绕”的那部分——"
        "工具、引用与评估集都不用改。")

# ================= 11 AI 接入 =================
h1("AI 接入与快捷键", "11")
para("渲染进程暴露一个**指令总线** `window.__PG__.exec(cmd, args)`；主进程再包一层 `ai:exec`，"
     "外部脚本（或 MCP 服务器 / 外部 Agent）不必碰 DOM 就能操作整个应用。问答与导入另有专用通道。")

h2("11.1 指令表（14 条）")
table(["命令", "参数", "作用", "返回"],
      [["`ping`", "—", "探活", "{ok,ts}"],
       ["`graph`", "—", "当前项目整张图：节点、坐标、主干、分支、边", "{project,projects,nodes,trunk,branches,links}"],
       ["`node`", "{id}", "单条详情 + 上下节点", "{ok,node,prev,next}"],
       ["`focus` / `select`", "{id}", "选中；`focus` 额外把画布居中到它", "{ok,id}"],
       ["`open`", "{id}", "打开应用内预览", "{ok,id}"],
       ["`reveal`", "{id}", "在文件管理器中选中该条目的原文文件", "{ok,path}"],
       ["`search`", "{q}", "关键词检索", "{ok,hits,neighbors,...}"],
       ["`capture`", "{text,date}", "收进来（切条+归位）", "{ok,...,items}"],
       ["`project`", "{id}", "切换项目", "{ok,project}"],
       ["`fit`", "—", "适应窗口", "{ok,k}"],
       ["`state`", "—", "当前状态（项目/选中/锁定/缩放）", "{ok,project,selected,locked,k}"],
       ["`ask`", "{q}", "问一问：Agent 循环 + 带引用的答案", "{ok,answer,citations,trace,mode,ms}"],
       ["`commands`", "—", "列出全部命令", "{ok,commands}"]],
      widths=[2.2, 3.0, 8.0, 3.2], size=8.0)

h2("11.2 调用方式")
bullets([
    "**页面内**：`window.__PG__.exec('focus', { id: 'n_1042' })`——调试、自动化测试用它。",
    "**进程外**：主进程 IPC `ai:exec`，参数 `{ cmd, args }`，返回 `{ ok, data }`——未来的 MCP / 外部 Agent 走这条。",
    "**专用方法**：`window.api.ingest({ batch, dryRun })` 批量迁移；`window.api.qa({ q })` 问答；`window.api.qaInfo()` 看当前是模型还是本地模式。",
    "**安全性**：只暴露命令白名单，不接受任意 JS；渲染层仍不允许文件系统访问。",
])

h2("11.3 快捷键")
table(["按键", "作用"],
      [["`/`", "聚焦搜索框"],
       ["`F`", "适应窗口（fit）"],
       ["`Esc`", "关闭详情面板 / 预览 / 搜索建议 / 问一问"],
       ["`Ctrl+Z`", "撤销上一次修改"],
       ["双击卡片", "应用内打开该条目的原始文件"],
       ["点击路径", "在文件夹中显示并选中文件"]],
      widths=[3.4, 13.0], size=8.4)
callout("**给 AI 的最小闭环**：`graph` 看图 → `node` 看细节 → `ask` 问一句 → `focus/open` 定位 → `capture` / `ingest` 写入。"
        "五条路径就能让外部 Agent 完成“读图—查证—补录”。")

# ================= 12 数据与设置 =================
h1("数据与设置", "12")
table(["功能", "行为"],
      [["重新载入 / 打开目录", "`Ctrl+R` 从磁盘重读 `state.json` 并重绘（手改数据不用重启）；菜单可打开 `data/`"],
       ["重置为演示数据", "备份当前 `state.json` 为 `state.bak.json`，再写入种子数据，重载视图"],
       ["批量导入快照", "每次 `ingest` 落盘时写 `data/state.before-ingest.json`，便于对比与排查"],
       ["问答配置", "⚙ 设置里填模型地址 / 模型名 / API Key（存 `data/qa_config.json`），也可用环境变量覆盖"],
       ["状态文件", "`data/state.json` 是唯一真相，原子写（先 `.tmp` 再 rename）"]],
      widths=[4.0, 12.4], size=8.4)

# ================= 13 状态与边界 =================
h1("状态与边界", "13")
table(["场景", "界面表现"],
      [["项目里没有条目", "画布中央提示“还没有内容，点右上角「收进来」”"],
       ["条目没有出处", "详情显示“粘贴输入，没有原始文件”，不显示空按钮"],
       ["文件丢失", "路径标红 + 「重新指定文件」"],
       ["预览失败", "面板内显示错误原因，保留「外部打开」"],
       ["队列堆积", "顶部出现“待归类 3 条”提示，点开处理"],
       ["导入有警告", "返回 `warnings` 逐条列出（缺 title / 缺 from-to / nodes 为空），已导入的条目不受影响"],
       ["问答没命中", "回答“资料里没有找到相关内容”，不编答案"],
       ["没有模型 key / 模型报错", "照常可用：本地规划器接管，界面写明 `local`；模型报错时 `mode` 带 `fallback: 原因`，不白屏"],
       ["删除后", "卡片消失但可从撤销恢复；`status=deleted` 不参与统计"]],
      widths=[4.0, 12.4], size=8.4)

# ================= 14 验收 =================
h1("验收用例", "14")
table(["#", "操作", "期望"],
      [["1", "粘一段 6 条消息的群聊 → 确认", "切出 ≥4 条；至少 1 条自动挂、1 条询问、1 条进队列"],
       ["2", "看卡片 → 点开详情", "能直接从颜色带 / 色条 / 类型名判断类型；详情有简介、上下步及原因、可点击路径"],
       ["3", "点路径", "文件管理器打开并选中该文件"],
       ["4", "点「在应用内打开」", "Markdown 渲染成正文，自动滚到命中句并高亮"],
       ["5", "拖卡片到另一张卡片", "父节点改变；线条跟着变；可撤销"],
       ["6", "标一条为“已放弃”", "卡片转灰、虚线框、右上角显示已放弃；**仍在图上**"],
       ["7", "合并一条分支", "两条线汇到目标卡片，显示合并说明"],
       ["8", "搜索关键词", "结果列表；点击后居中并高亮邻居"],
       ["9", "先 `node tools/ingest.js batch.json --dry-run`，再正式导一次同一份", "dry-run 不写盘；正式导入 created=0、skipped=条目数（去重生效），并生成 `state.before-ingest.json`"],
       ["10", "打开导入的项目看图", "主干按日期从左到右；`已放弃` 条目变成带 × 的终止分支"],
       ["11", "「问一问」问“为什么放弃 HID？”", "答案先给结论与状态，再给理由，最后列引用；点引用能定位到文件"],
       ["12", "问一个资料里没有的问题", "回答“资料里没有找到”，不编造"],
       ["13", "断网 / 清空 key 再问一次", "仍能回答，界面显示 `local` 模式"],
       ["14", "关掉软件重开", "数据、视图状态都在"]],
      widths=[1.4, 7.4, 7.6], size=8.0)

# 去掉表格后多余的空行，避免尾页只剩一行
while doc.paragraphs and not doc.paragraphs[-1].text.strip():
    el = doc.paragraphs[-1]._element; el.getparent().remove(el)

para("—— 功能设计稿完 ——", size=9, color=MUT, align="center", before=9)

doc.save("docs/项目Git-功能设计稿v1.0.docx")
print("saved")
