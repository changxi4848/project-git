# -*- coding: utf-8 -*-
"""生成合成演示数据（不包含任何真实项目内容）
   产出：data/state.json、desktop/seed/state.json、data/files/*.md
"""
import io, json, os, re, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FILES = os.path.join(DATA, "files")
SEED = os.path.join(ROOT, "desktop", "seed", "state.json")
os.makedirs(FILES, exist_ok=True)

TYPES = [
    {"id": "decision", "name": "决策", "icon": "diamond", "color": "#D9534F",
     "fields": [{"key": "结论", "kind": "text"}, {"key": "理由", "kind": "longtext"},
                {"key": "负责人", "kind": "person"}]},
    {"id": "plan", "name": "方案", "icon": "page", "color": "#3F8FC4",
     "fields": [{"key": "目标", "kind": "text"}, {"key": "范围", "kind": "text"}]},
    {"id": "retro", "name": "复盘", "icon": "loop", "color": "#7C6BC4",
     "fields": [{"key": "结论", "kind": "text"}, {"key": "数据", "kind": "text"}]},
    {"id": "doc", "name": "资料", "icon": "doc", "color": "#A1785A",
     "fields": [{"key": "类型", "kind": "text"}, {"key": "状态", "kind": "text"}]},
    {"id": "data", "name": "数据", "icon": "db", "color": "#3F9D94",
     "fields": [{"key": "规模", "kind": "text"}, {"key": "位置", "kind": "text"}]},
    {"id": "code", "name": "代码", "icon": "code", "color": "#5F7590",
     "fields": [{"key": "语言", "kind": "text"}, {"key": "仓库", "kind": "text"}]},
    {"id": "output", "name": "产出", "icon": "star", "color": "#C08A3E",
     "fields": [{"key": "交付方", "kind": "text"}, {"key": "版本", "kind": "text"}]},
]

DOCS = {}          # 文件名 -> 正文
ERRORS = []
NODES = []         # 节点列表
EDGES = []


def doc(name, body):
    DOCS[name] = body.strip() + "\n"
    return name


def node(nid, proj, ntype, title, date, summary="", parent=None, branch="main",
         status="active", tag=None, extra=None, src=None):
    n = {
        "id": nid, "project": proj, "type": ntype, "title": title,
        "summary": summary, "content_at": date,
        "ingest_at": "2026-11-20T10:00:00", "status": status,
        "confidence": 0.95, "auto": False, "placement": "grow",
        "branch": branch, "parents": [parent] if parent else [],
        "extra": extra or {},
    }
    if parent:
        n["parent"] = parent
        EDGES.append({"from": nid, "to": parent, "kind": "derived"})
    if tag:
        n["tag"] = tag
    if src and src[1] is None:
        fname = src[0]
        ext = os.path.splitext(fname)[1].lower().lstrip(".")
        n["source"] = {"file": fname, "locator": {"kind": ext}, "excerpt": ""}
    elif src and src[1] != "":
        fname, excerpt = src
        body = DOCS[fname]
        i = body.find(excerpt)
        if i < 0:
            ERRORS.append((fname, excerpt))
            return
        n["source"] = {"file": fname,
                       "locator": {"kind": "text", "start": i, "end": i + len(excerpt)},
                       "excerpt": excerpt}
    NODES.append(n)


# =====================================================================
# 项目 A：北极星 · 客服工单分流（12 节点）
# =====================================================================
A = "p_star"
D1 = doc("北极星-工单样本说明.md", """# 工单样本说明

## 来源
2026 年 3—6 月的线上工单，共 18,400 条，已脱敏。

## 字段
- ticket_id / created_at / channel / raw_text
- 人工标注的 category（12 类）与 priority（3 档）

## 质量
两人独立标注 500 条，一致率 0.78；分歧集中在「退款」与「售后」。

## 用途
作为分流模型的训练集与评测集，按时间切分：4—5 月训练，6 月评测。
""")
D2 = doc("北极星-规则分流方案v1.md", """# 规则分流方案 v1

## 思路
用关键词 + 渠道做兜底分流，不训练模型。

## 规则
1. 含「退款/退货」→ 售后组
2. 含「发票/开票」→ 财务组
3. 其余按渠道：App → 一线，电话 → 二线

## 预期
覆盖 60% 工单，剩下 40% 人工兜底。
""")
D3 = doc("北极星-分类模型评测.md", """# 分类模型评测记录

## 模型
- 基线：TF-IDF + 线性分类器
- 候选：小参数中文预训练模型微调

## 结果（6 月评测集，3,100 条）
| 方案 | 准确率 | 备注 |
|---|---|---|
| 规则 v1 | 0.61 | 长尾差 |
| 线性基线 | 0.71 | 训练 4 分钟 |
| 小模型微调 | 0.79 | 需要 1 张卡 |

## 结论
准确率提升主要来自「售后」类，长尾类仍差。
""")
D4 = doc("北极星-知识库接入说明.md", """# 知识库接入说明

## 背景
分流之后，一线仍要翻文档回答。把标准答案接进流程可以减少转人工。

## 数据
- 帮助中心文章 260 篇
- 历史优质回复 1,700 条

## 做法
按工单文本检索 Top3 文章，拼进回复草稿，人工确认后发送。

## 灰度
先开 10% 流量，观察 2 周。
""")
D5 = doc("北极星-上线报告.md", """# 上线报告

## 时间
2026-09-18 全量。

## 指标（对比上线前 4 周）
- 平均首响：4.2 分钟 → 1.9 分钟
- 转人工率：38% → 24%
- 满意度：4.31 → 4.42

## 遗留
- 长尾 12 类里仍有 4 类准确率低于 0.6
- 知识库命中但答案过期的比例约 7%
""")

node("a1", A, "plan", "规则分流打底", "2026-03-10",
     "先用关键词规则覆盖大头，不训练模型", extra={"目标": "60% 自动分流"}, src=(D2, "覆盖 60% 工单，剩下 40% 人工兜底。"))
node("a2", A, "data", "脱敏工单 18,400 条", "2026-03-18",
     "3—6 月线上工单，12 类标注", parent="a1",
     extra={"规模": "18,400 条", "位置": "data/files/北极星-工单样本说明.md"},
     src=(D1, "共 18,400 条，已脱敏"))
node("a3", A, "decision", "规则不够，上分类模型", "2026-04-02",
     "规则长尾太差，改训练分类器", parent="a1",
     extra={"理由": "规则只能覆盖 60%，长尾全靠人工"}, src=(D3, "规则 v1 | 0.61 | 长尾差"))
node("a4", A, "decision", "试过微调小模型，放弃", "2026-04-20",
     "效果最好但要 GPU，运维不接", parent="a3", branch="feat/finetune", status="abandoned",
     extra={"理由": "要 1 张卡，推理成本是线性的 3 倍"}, src=(D3, "小模型微调 | 0.79 | 需要 1 张卡"))
node("a5", A, "decision", "改用线性基线", "2026-04-28",
     "0.71 够用，CPU 可跑", parent="a3",
     extra={"理由": "差 8 个点，但成本差一个数量级"})
node("a6", A, "retro", "长尾类仍是短板", "2026-05-12",
     "4 类准确率低于 0.6", parent="a5",
     extra={"数据": "售后 0.58 / 退款 0.55"})
node("a7", A, "decision", "接知识库出草稿", "2026-06-08",
     "分流解决去哪，草稿解决怎么说", parent="a5",
     extra={"理由": "转人工的 24% 里，一半是没答案"})
node("a8", A, "doc", "知识库 260 篇", "2026-06-10",
     "帮助中心文章 + 优质回复", parent="a7", src=(D4, "帮助中心文章 260 篇"))
D6 = doc("北极星-分流服务说明.md", """# 分流与草稿服务

## 组成
- router：工单分类（线性模型，CPU）
- drafter：检索知识库并拼草稿
- api：FastAPI，两个接口 /route 与 /draft

## 部署
单机 4 核 8G，P99 时延 180ms。

## 依赖
模型文件 42MB，随镜像打包，启动时加载一次。
""")
node("a9", A, "code", "分流与草稿服务", "2026-06-20",
     "Python，FastAPI", parent="a7",
     extra={"语言": "Python", "仓库": "star-ticket-router"},
     src=(D6, "api：FastAPI，两个接口 /route 与 /draft"))
node("a10", A, "decision", "灰度 10% 上线", "2026-07-01",
     "先开 10% 流量观察两周", parent="a7", tag="v0.9",
     extra={"理由": "草稿质量未知，全量风险大"})
node("a11", A, "output", "上线报告", "2026-09-18",
     "首响 4.2→1.9 分钟", parent="a10", src=(D5, "平均首响：4.2 分钟 → 1.9 分钟"))
# 合并：a5 与分支 feat/finetune 的结论一起汇入 a11（示意）
EDGES.append({"from": "a11", "to": "a5", "kind": "derived"})

# 一份 Word 版报告（演示 docx 预览）
try:
    from docx import Document
    d = Document()
    d.add_heading("北极星 · 上线报告（Word 版）", 0)
    d.add_paragraph("2026-09-18 全量上线。首响从 4.2 分钟降到 1.9 分钟，转人工率 38% → 24%。")
    d.add_heading("一、指标", level=1)
    t = d.add_table(rows=4, cols=2); t.style = "Table Grid"
    t.rows[0].cells[0].text = "指标"; t.rows[0].cells[1].text = "变化"
    t.rows[1].cells[0].text = "平均首响"; t.rows[1].cells[1].text = "4.2 分钟 → 1.9 分钟"
    t.rows[2].cells[0].text = "转人工率"; t.rows[2].cells[1].text = "38% → 24%"
    t.rows[3].cells[0].text = "满意度"; t.rows[3].cells[1].text = "4.31 → 4.42"
    d.add_heading("二、遗留", level=1)
    d.add_paragraph("1. 长尾 4 类准确率仍低于 0.6；")
    d.add_paragraph("2. 知识库命中但答案过期约占 7%。")
    d.save(os.path.join(FILES, "北极星-上线报告.docx"))
    node("a12", A, "doc", "上线报告（Word 版）", "2026-09-20",
         "把上线报告导出成 Word 发给业务方", parent="a11",
         src=("北极星-上线报告.docx", None))
except Exception as e:
    print("skip docx:", e)

# =====================================================================
# 项目 B：山海 · 边缘告警（11 节点）
# =====================================================================
B = "p_shan"
E1 = doc("山海-现场样本说明.md", """# 现场样本说明

## 采集
3 个园区、11 个点位，2026 年 4—5 月，共 31,200 段 8 秒视频。

## 标注
- 正样本：真实告警 2,140 段
- 负样本：误报 6,800 段
- 其余为背景

## 环境
夜间占比 47%，雨雾天 12%。
""")
E2 = doc("山海-回传方案对比.md", """# 回传方案对比

| 方案 | 时延 | 月成本 | 稳定性 |
|---|---|---|---|
| 现场 WiFi | 0.3 s | 低 | 跨楼层掉线 |
| 4G 专网 | 1.2 s | 中 | 稳定 |
| 边缘推理 + 4G 回传结果 | 0.8 s | 中 | 稳定 |

结论：走「边缘推理 + 4G 回传结果」，只回传结构化事件。
""")
E3 = doc("山海-本地缓存设计.md", """# 本地缓存设计

## 问题
4G 偶发断链，断链期间事件会丢。

## 方案
- 本地环形缓冲 2 小时（按事件 ID 去重）
- 恢复后按时间序补传
- 超过 2 小时的只补「计数」，不补原始帧

## 容量
单点日均 900 事件，2 小时约 75 条，占用 < 2 MB。
""")
E4 = doc("山海-交付清单.md", """# 交付清单

- 边缘盒子 11 台（含 4G 模块）
- 模型包 v1.0（int8）
- 运维手册 1 份
- 告警对接文档 1 份

验收：连续 7 天，误报率 < 8%，漏报 < 3%。
""")

node("b1", B, "plan", "先做现场试点", "2026-04-06",
     "选 1 个园区先跑通", extra={"目标": "7 天连续运行"})
node("b2", B, "data", "现场样本 31,200 段", "2026-04-15",
     "3 园区 11 点位", parent="b1",
     extra={"规模": "31,200 段", "位置": "data/files/山海-现场样本说明.md"},
     src=(E1, "共 31,200 段 8 秒视频"))
node("b3", B, "decision", "现场 WiFi 回传不可靠", "2026-04-26",
     "跨楼层掉线，改用 4G", parent="b1", branch="feat/wifi", status="abandoned",
     extra={"理由": "跨楼层丢包 18%，夜间更差"}, src=(E2, "现场 WiFi | 0.3 s | 低 | 跨楼层掉线"))
node("b4", B, "decision", "改 4G 专网回传", "2026-05-06",
     "时延 1.2 秒，稳定", parent="b1",
     extra={"理由": "试点园区 7 天无断链"}, src=(E2, "4G 专网 | 1.2 s | 中 | 稳定"))
node("b5", B, "decision", "边缘推理，只回传事件", "2026-05-14",
     "省流量，时延更可控", parent="b4",
     extra={"理由": "原始帧上行成本是事件的上百倍"}, src=(E2, "边缘推理 + 4G 回传结果"))
D7 = doc("山海-边缘推理程序说明.md", """# 边缘推理程序

## 组成
- 采集：GStreamer 取流，8 秒切片
- 推理：int8 量化模型，单帧 11ms
- 上报：结构化事件 JSON，MQTT over 4G

## 资源
盒子 4 核 A55，内存占用 380MB，常驻。

## 运维
支持 OTA 升级模型包，失败自动回滚上一版。
""")
node("b6", B, "code", "边缘推理程序", "2026-05-20",
     "C++，int8 量化", parent="b5", extra={"语言": "C++", "仓库": "shan-edge-infer"},
     src=(D7, "int8 量化模型，单帧 11ms"))
node("b7", B, "decision", "加本地缓存兜底", "2026-05-28",
     "断链 2 小时内不丢事件", parent="b5",
     extra={"理由": "4G 偶发断链，事件丢了没法补"}, src=(E3, "本地环形缓冲 2 小时"))
node("b8", B, "retro", "误报集中在雨雾天", "2026-06-10",
     "雨雾天误报率 19%", parent="b7", extra={"数据": "晴天 5%，雨雾 19%"})
node("b9", B, "decision", "加天气条件分支", "2026-06-18",
     "雨雾天提高阈值", parent="b8",
     extra={"理由": "宁可漏报一点，也别把误报堆给保安"})
node("b10", B, "decision", "锁定交付版本", "2026-07-02",
     "模型 v1.0 固化", parent="b9", tag="v1.0",
     extra={"理由": "再改就不可复现"})
node("b11", B, "output", "交付清单与验收", "2026-07-20",
     "11 台盒子 + 运维手册", parent="b10", src=(E4, "误报率 < 8%，漏报 < 3%"))

# =====================================================================
# 项目 C：潮汐 · 内容审核工作台（9 节点）
# =====================================================================
C = "p_tide"
F1 = doc("潮汐-误判分析.md", """# 误判分析

## 样本
抽 1,200 条人工申诉，其中 144 条确认误判（12%）。

## 分布
- 反讽/谐音：41%
- 上下文缺失：27%
- 多模态（图+文）：19%
- 其他：13%

## 结论
单看文本无法判断反讽，需要上下文与作者历史。
""")
F2 = doc("潮汐-人工复核流程.md", """# 人工复核流程

## 触发
模型置信度 < 0.6，或用户申诉。

## 队列
按风险分三档，高风险 30 分钟内处理。

## SLA
- 高风险：30 分钟
- 中风险：4 小时
- 低风险：24 小时
""")
F3 = doc("潮汐-灰度报告.md", """# 灰度报告

## 范围
10% 内容量，运行 14 天。

## 结果
- 误判率：12% → 6.4%
- 人均处理量：+18%
- 高风险时效：达标 96%

## 建议
扩到 50%，但要先补夜间值班。
""")

node("c1", C, "plan", "人机协同审核", "2026-05-04",
     "模型初筛 + 人工复核", extra={"目标": "误判减半"})
node("c2", C, "retro", "误判 12% 的来源", "2026-05-18",
     "反讽与上下文缺失占大头", parent="c1", src=(F1, "144 条确认误判（12%）"))
node("c3", C, "decision", "低置信度转人工", "2026-05-26",
     "0.6 以下直接进复核队列", parent="c2",
     extra={"理由": "宁可多转，也不能让反讽漏过去"}, src=(F2, "模型置信度 < 0.6"))
node("c4", C, "doc", "复核流程与 SLA", "2026-06-02",
     "三档风险与时效", parent="c3", src=(F2, "高风险：30 分钟"))
node("c5", C, "data", "申诉样本 1,200 条", "2026-06-06",
     "含 144 条确认误判", parent="c2",
     extra={"规模": "1,200 条", "位置": "data/files/潮汐-误判分析.md"},
     src=(F1, "抽 1,200 条人工申诉"))
node("c6", C, "decision", "先灰度 10%", "2026-06-15",
     "14 天观察再扩量", parent="c3", tag="v0.5",
     extra={"理由": "夜间值班没排，扩太快会压垮"})
node("c7", C, "retro", "灰度结论", "2026-07-01",
     "误判 12%→6.4%，处理量 +18%", parent="c6", src=(F3, "误判率：12% → 6.4%"))
node("c8", C, "decision", "扩到 50%，先补夜班", "2026-07-08",
     "扩量前必须先解决值班", parent="c7",
     extra={"理由": "高风险时效一旦破线，扩量就得回滚"})
node("c9", C, "output", "灰度报告", "2026-07-12",
     "含扩量建议", parent="c8", src=(F3, "扩到 50%，但要先补夜间值班"))

# =====================================================================
# 写盘
# =====================================================================
for name, body in DOCS.items():
    with io.open(os.path.join(FILES, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(body)

state = {
    "version": 3,
    "projects": [
        {"id": A, "name": "北极星 · 客服工单分流"},
        {"id": B, "name": "山海 · 边缘告警"},
        {"id": C, "name": "潮汐 · 内容审核台"},
    ],
    "types": TYPES,
    "nodes": NODES,
    "edges": EDGES,
    "queue": [],
}
text = json.dumps(state, ensure_ascii=False, indent=1)
os.makedirs(os.path.dirname(SEED), exist_ok=True)
for p in [os.path.join(DATA, "state.json"), SEED]:
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text + "\n")

print("projects:", len(state["projects"]))
print("nodes:", len(NODES), "edges:", len(EDGES))
print("docs:", len(DOCS))
print("with source:", sum(1 for n in NODES if n.get("source")))
print("abandoned:", sum(1 for n in NODES if n["status"] == "abandoned"))
print("tags:", [n["tag"] for n in NODES if n.get("tag")])
if ERRORS:
    print("!! excerpt 不匹配", len(ERRORS))
    for f, e in ERRORS:
        print("  -", f, "|", e)
