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
para("2026-11-23", size=9.5, color=MUT, align="center")
doc.add_page_break()

# ================= 01 功能地图 =================
h1("功能地图", "01")
para("整个软件只有四件事：**进来、归位、看图、取证**。下面的模块按这四件事排列。")
table(["模块", "功能", "一句话", "优先级"],
      [["**录入**", "收进来（粘贴）", "群聊/纪要贴进来，切成条目", "P0"],
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
       ["", "应用内预览", "md / txt / 代码 / 图片就地打开并定位", "P0"],
       ["", "文件定位", "点路径在文件管理器中显示", "P0"],
       ["**其它**", "检索", "关键词命中并跳转", "P0"],
       ["", "类型与字段", "自定义类型与中文字段", "P1"],
       ["", "Git 只读接入", "commit 变提交节点", "P1"],
       ["", "数据管理", "重置演示数据、打开数据目录", "P1"]],
      widths=[2.0, 4.2, 8.0, 1.8], size=8.2)
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

# ================= 03 归位 =================
h1("归位：判定与闸门", "03")
h2("3.1 三个判断")
table(["判断", "依据", "出错后果"],
      [["**类型**", "线索词（“决定/定了”→决策，“方案/计划”→方案，“复盘/回顾”→复盘）", "卡片颜色与图标错，但内容还在"],
       ["**项目**", "关键词与项目名/材料名匹配度", "挂到别的项目，等于丢失"],
       ["**父节点**", "文本相似 + 时间邻近 + 类型亲和", "接错线，故事讲歪"]],
      widths=[2.4, 9.0, 5.0], size=8.4)

h2("3.2 闸门（决定要不要问人）")
table(["情形", "处理"],
      [["置信度 ≥0.68 且 与第二名分差 ≥0.10", "**自动挂**，卡片上标“自动”"],
       ["置信度够但分差 <0.10", "**弹窗问一句**：“这条属于哪里？”，列出 2~3 个候选 + “都不是”"],
       ["置信度 <0.68", "**进待归类队列**，不丢"],
       ["判断不出类型", "默认“资料”，并在详情里提示“类型待确认”"]],
      widths=[8.0, 8.4], size=8.4)
callout("**分差比置信度更重要**：模型最危险的时刻不是“我只有 0.4 的把握”，而是“A 0.42、B 0.40”——它在瞎猜，但看起来很自信。")

h2("3.3 手动调整")
bullets([
    "**改父节点**：在「调整模式」里把卡片拖到另一张卡片上，松手即改，并记一条“手动调整”审计。",
    "**改类型**：详情面板类型下拉，改完卡片颜色/图标/字段立刻变。",
    "**标取代**：右键「标记为取代」→ 点被取代的那条，旧条目转灰但保留在图上。",
    "**删除**：软删除（`status=deleted`），不真删；`Ctrl+Z` 可恢复。",
])

# ================= 04 主视图 =================
h1("主视图：提交图", "04")
figure("docs/图-主视图.png", 16.8, "图 1　卡片式提交图：主干、分支、终止 ×、合并、tag、材料卡")

h2("4.1 信息层级")
table(["元素", "承载信息", "强调方式"],
      [["**卡片**", "一条提交：类型 / 标题 / 时间 / 状态 / 里程碑", "白底卡片 + 投影"],
       ["**类型**", "资料 / 数据 / 代码 / 决策 / 方案 / 复盘", "**左侧淡色带 + 4px 色条 + 类型名上色**（三重强调）"],
       ["**状态**", "已放弃 / 已取代 / 草稿", "右上角灰底胶囊"],
       ["**里程碑**", "基线、版本", "右下角米底金边小旗"],
       ["**材料**", "这条提交用到的文件", "卡片正下方白色小卡，类型名同样上色"],
       ["**关系**", "怎么走到下一步", "主干线 + 上方小字"]],
      widths=[2.4, 8.0, 6.0], size=8.4)
callout("**类型为什么要三重强调**：卡片小、字多，单靠一条细色条在缩小时会消失。淡化色带负责“远看能分区”，色条负责“近看能识别”，类型名上色负责“不看颜色也能读”。")

h2("4.2 分支与终止")
bullets([
    "**分叉**：从卡片顶部 45° 引出，标注 `feat/xxx · 从主干分出`。",
    "**终止**：末端虚线 + **×** + “尝试终止”，卡片转灰底、虚线边框、右上角「已放弃」。",
    "**合并**：两条线汇到目标卡片，下方标“合并：<为什么采纳>”。",
])

# ================= 05 详情 =================
h1("详情面板", "05")
figure("docs/图-3-详情与预览.png", 16.8, "图 2　左：简介 + 与上下节点的联系 + 出处（可点击路径）；右：应用内预览与命中高亮")

h2("5.1 三段结构")
table(["区块", "内容", "为什么需要"],
      [["**简介**", "2~3 句：这条在说什么（结论 + 理由）", "卡片只有标题，看不懂就要点开；简介是“展开的标题”"],
       ["**与上下节点的联系**", "上一步：谁 → 本节点，因为什么；下一步：本节点 → 谁，因为什么", "**回答“它从哪来、到哪去”**，这正是提交图的价值"],
       ["**出处**", "文件名 + 完整路径（可点击）+ 定位 + 原文片段", "能立刻验证这条是不是真的"]],
      widths=[3.4, 8.0, 5.0], size=8.4)

h2("5.2 与上下节点的联系：具体规则")
table(["显示项", "来源", "没有时"],
      [["上一步", "本节点的 `parents[0]` + 该边的过渡说明", "显示“这是起点”"],
       ["下一步", "以本节点为父的第一个节点 + 过渡说明", "显示“这是当前最后一步”"],
       ["分支时", "额外显示“分出 / 合并”标签", "—"],
       ["点击", "跳到该节点并把视图居中", "—"]],
      widths=[2.6, 9.4, 4.4], size=8.4)

# ================= 06 出处与文件 =================
h1("出处与文件定位", "06")
h2("6.1 展示规则")
table(["项", "展示", "交互"],
      [["**文件名**", "正文 12px，如 `中继底座-试错记录.md`", "—"],
       ["**完整路径**", "等宽 11px，蓝色带下划线，如 `data/files/中继底座-试错记录.md`", "**点击 → 在文件管理器中显示并选中该文件**"],
       ["**定位**", "文本：第 393–413 字；PDF：第 2 页；图片：框选区域", "打开预览时自动跳到该位置"],
       ["**片段**", "原文摘录，最多 4 行，超出滚动", "—"],
       ["**按钮**", "「在应用内打开」「在文件夹中显示」", "前者进预览，后者调系统文件管理器"]],
      widths=[2.4, 8.4, 5.6], size=8.4)

h2("6.2 文件定位的技术口径")
bullets([
    "**路径**：库里只存相对路径（`data/files/xxx`），展示时拼成绝对路径，避免换机器后失效。",
    "**文件不存在**：路径标红并提示“文件已移动”，提供「重新指定文件」。",
    "**在文件夹中显示**：Electron `shell.showItemInFolder(absPath)`——打开资源管理器并**选中**该文件，不是打开文件本身。",
    "**外部打开**：`shell.openPath(absPath)`，用系统默认程序打开。",
])

# ================= 07 预览 =================
h1("应用内预览", "07")
table(["格式", "渲染", "定位", "状态"],
      [["Markdown", "marked 渲染 + 消毒", "找到原文句子包 `<mark>`，滚到视口中央", "已实现"],
       ["纯文本", "等宽显示", "按字符区间高亮", "已实现"],
       ["代码", "行号 + 等宽", "定位到行", "已实现"],
       ["图片", "`<img>` + 命中框", "bbox 叠加", "已实现"],
       ["PDF", "独立窗口（pdf.js）", "页码 + 框选", "P1，当前降级为外部打开"],
       ["docx / xlsx", "mammoth / SheetJS（只读）", "段落 / 单元格", "P1"]],
      widths=[2.6, 6.8, 5.6, 3.4], size=8.2)

# ================= 08 检索 =================
h1("检索", "08")
bullets([
    "**三路打分**：标题 > 摘要 > 原文片段，聚合到条目。",
    "**结果**：下拉最多 6 条，显示标题 + 类型；回车进第一条。",
    "**跳转**：点结果 → 画布居中该卡片 + 高亮一跳邻居，其余淡到 15%。",
    "**空结果**：显示“没有找到”，不误报。",
])

# ================= 09 数据与设置 =================
h1("数据与设置", "09")
table(["功能", "行为"],
      [["重置为演示数据", "备份当前 `state.json` 为 `state.bak.json`，再写入种子数据，重启视图"],
       ["打开数据目录", "系统文件管理器打开 `data/`"],
       ["备份", "复制 `state.json` 到 `backups/state-日期.json`"],
       ["导入/导出", "导出为单个 JSON；导入时做版本校验"]],
      widths=[4.0, 12.4], size=8.4)

# ================= 10 状态与边界 =================
h1("状态与边界", "10")
table(["场景", "界面表现"],
      [["项目里没有条目", "画布中央提示“还没有内容，点右上角「收进来」”"],
       ["条目没有出处", "详情显示“粘贴输入，没有原始文件”，不显示空按钮"],
       ["文件丢失", "路径标红 + 「重新指定文件」"],
       ["预览失败", "面板内显示错误原因，保留「外部打开」"],
       ["队列堆积", "顶部出现“待归类 3 条”提示，点开处理"],
       ["删除后", "卡片消失但可从撤销恢复；`status=deleted` 不参与统计"]],
      widths=[4.0, 12.4], size=8.4)

# ================= 11 验收 =================
h1("AI 接入与快捷键", "12")
para("渲染进程暴露一个**指令总线** `window.__PG__.exec(cmd, args)`；主进程再包一层 `ai:exec`，"
     "外部脚本（或未来的 MCP 服务器）不必碰 DOM 就能操作整个应用。")
h2("12.1 指令表")
table(["命令", "参数", "作用", "返回"],
      [["`ping`", "—", "探活", "{ok,ts}"],
       ["`graph`", "—", "当前项目整张图：节点、坐标、主干、分支、边", "{project,nodes,trunk,branches,links}"],
       ["`node`", "{id}", "单条详情 + 上下节点", "{node,prev,next}"],
       ["`focus`", "{id}", "选中并把画布居中到它", "{ok,id}"],
       ["`select`", "{id}", "只选中（不移动画布）", "{ok,id}"],
       ["`open`", "{id}", "打开应用内预览", "{ok,id}"],
       ["`reveal`", "{id}", "在文件管理器中选中该文件", "{ok,path}"],
       ["`search`", "{q}", "关键词检索", "{hits,neighbors}"],
       ["`capture`", "{text,date}", "收进来（切条+归位）", "{items,...}"],
       ["`project`", "{id}", "切换项目", "{ok,project}"],
       ["`fit`", "—", "适应窗口", "{ok,k}"],
       ["`state`", "—", "当前状态（项目/选中/缩放）", "{project,selected,k}"],
       ["`commands`", "—", "列出全部命令", "{commands}"],
       ["`voice`", "(预留)", "语音输入", "—"]],
      widths=[2.4, 3.2, 7.4, 3.4], size=8.2)

h2("12.2 两种调用方式")
bullets([
    "**页面内**：`window.__PG__.exec('focus', { id: 'n_1042' })`——适合调试、自动化测试。",
    "**进程外**：主进程 IPC `ai:exec`，参数 `{ cmd, args }`，返回 `{ ok, data }`——未来的 MCP / 外部 Agent 走这条。",
    "**安全性**：只暴露命令白名单，不接受任意 JS；渲染层仍不允许文件系统访问。",
])

h2("12.3 快捷键")
table(["按键", "作用"],
      [["`/`", "聚焦搜索框"],
       ["`F`", "适应窗口（fit）"],
       ["`Esc`", "关闭详情面板 / 预览 / 搜索建议"],
       ["双击卡片", "应用内打开该条目的原始文件"],
       ["点击路径", "在文件夹中显示并选中文件"]],
      widths=[3.4, 13.0], size=8.4)
callout("**给 AI 的最小闭环**：`graph` 看图 → `node` 看细节 → `focus/open` 定位 → `capture` 写入。"
        "四条命令就能让外部 Agent 完成“读图—查证—补录”。")

h1("验收用例", "11")
table(["#", "操作", "期望"],
      [["1", "粘一段 6 条消息的群聊 → 确认", "切出 ≥4 条；至少 1 条自动挂、1 条询问、1 条进队列"],
       ["2", "看一张卡片", "能直接从颜色带 / 色条 / 类型名判断它是“资料”还是“数据”"],
       ["3", "点开卡片详情", "有简介；有“上一步 / 下一步”及原因；有点击可用的文件路径"],
       ["4", "点路径", "文件管理器打开并选中该文件"],
       ["5", "点「在应用内打开」", "Markdown 渲染成正文，自动滚到命中句并高亮"],
       ["6", "拖卡片到另一张卡片", "父节点改变；线条跟着变；可撤销"],
       ["7", "标一条为“已放弃”", "卡片转灰、虚线框、右上角显示已放弃；**仍在图上**"],
       ["8", "合并一条分支", "两条线汇到目标卡片，显示合并说明"],
       ["9", "搜索关键词", "结果列表；点击后居中并高亮邻居"],
       ["10", "关掉软件重开", "数据、视图状态都在"]],
      widths=[1.2, 7.0, 8.2], size=8.4)

para("")
para("—— 功能设计稿完 ——", size=9, color=MUT, align="center")

doc.save("docs/项目Git-功能设计稿v1.0.docx")
print("saved")
