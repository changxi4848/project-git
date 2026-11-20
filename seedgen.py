# -*- coding: utf-8 -*-
"""生成演示数据：样本文件、演示 git 仓库、种子节点。

运行：python seedgen.py
"""
import os
import json
import subprocess
import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
FILES = os.path.join(DATA, "files")
REPO = os.path.join(DATA, "demo-repo")

os.makedirs(FILES, exist_ok=True)
os.makedirs(DATA, exist_ok=True)


def w(name, text):
    p = os.path.join(FILES, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p


# ---------------- 样本文件 ----------------
f_pricing_a = w("定价A灰度复盘.md", """# 定价 A 方案灰度复盘

## 一、灰度范围
本次灰度覆盖 3 个类目、共 1.2 万商家，灰度周期 2026-09-15 至 2026-10-18。

## 二、核心结论
原以为问题出在渠道结构，实际是**价格锚点**的设置方式让中小商家算不清账。
灰度期间客单价提升 6.2%，但商家咨询量上升 3.1 倍，客服成本抵消了大部分收益。

## 三、关键分歧
运营团队认为应该继续灰度到年底，用时间换认知；产品团队认为咨询成本不可持续。
评审会最终决定 Q4 起改用 B 方案，A 方案仅保留跨境场景。

## 四、可复用做法
上线前先做一版“算账页”，让商家在 30 秒内看懂自己要付多少。这一条已经写进后续所有定价方案。
""")

f_pricing_b = w("定价B方案提案.md", """# 定价 B 方案提案

## 设计思路
不再按“类目 × 阶梯”报价，改为按“成交效果”分档，商家先付基础费，效果达标再补。

## 与 A 方案的差异
- A 方案：前置付费，锚点复杂，需要商家自己算
- B 方案：后置补费，锚点单一，商家只看“达标了没有”

## 风险
现金流回款周期拉长 15 天，需要在结算侧做垫资准备。财务已确认可支持 2000 万额度。

## 上线计划
11 月 10 日完成配置，11 月 15 日灰度 5%，12 月 1 日全量。
""")

f_promo_retro = w("双十一大促复盘.md", """# 双十一大促复盘

## 结果
GMV 达成 108%，但**利润**只达成 91%。

## 原以为 / 实际
原以为追加 200 万预算能带来同比例增量，实际边际投产比从 3.2 掉到 1.9。
实际原因是主推品类在 10 月已经透支了需求，追加预算只是把后面的量提前了。

## 教训
大促前不要在主推品类上做二次加预算，除非确认需求没有被透支。
判断方法：看该品类近 30 天的搜索指数斜率，斜率为负就不要再加。

## 待跟进
返场方案需要在 11 月 20 日前确认，避免和大促复盘结论冲突。
""")

f_metric = w("指标口径说明.md", """# 转化率口径说明

团队里“转化率”有两个口径，历史上并行使用，导致周会经常对不上数。

## 口径 A（下单转化率）
下单人数 / 曝光人数。用于投放侧的效率评估。

## 口径 B（成交转化率）
支付成功人数 / 下单人数。用于交易链路与商家侧评估。

## 2026-10-11 的决定
统一为：对外一律使用口径 A，对内复盘使用口径 B，且必须在看板标题里注明是哪一种。
旧口径统计已于 10 月 28 日暂停。
""")

f_launch = w("上线检查清单.txt", """上线检查清单 v1.2
1. 灰度开关已配置，默认关闭
2. 回滚脚本已验证，回滚时间小于 3 分钟
3. 监控大盘已加告警：错误率 > 1% 立即通知
4. 商家侧通知文案已过法务
5. 客服话术已同步，含 5 个高频问题
""")

# 生成 PDF（用 reportlab；没有就跳过 PDF 定位演示）
pdf_path = os.path.join(FILES, "Q4评审纪要.pdf")
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph
    from reportlab.lib.styles import ParagraphStyle

    font_ok = True
    try:
        pdfmetrics.registerFont(TTFont("YaHei", r"C:\Windows\Fonts\msyh.ttc"))
    except Exception:
        font_ok = False

    style = ParagraphStyle("s", fontName="YaHei" if font_ok else "Helvetica",
                           fontSize=11, leading=18)
    doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                            leftMargin=60, rightMargin=60, topMargin=60, bottomMargin=60)
    paras = [
        "Q4 定价评审会议纪要　2026-11-03",
        "一、背景",
        "定价 A 方案灰度 34 天，客单价提升 6.2%，商家咨询量上升 3.1 倍。",
        "二、讨论",
        "运营：建议延长灰度到年底，用时间换认知。",
        "产品：咨询成本不可持续，且中小商家算不清账是结构性问题。",
        "财务：B 方案的回款周期拉长 15 天，可支持 2000 万垫资额度。",
        "三、决议",
        "决定 Q4 起改用 B 方案，A 方案仅保留跨境场景。负责人：张伟。",
        "四、后续",
        "11 月 10 日完成配置，11 月 15 日灰度 5%，12 月 1 日全量。",
    ]
    doc.build([Paragraph(p, style) for p in paras])
    print("pdf ok")
except Exception as e:
    print("pdf skip:", e)

# ---------------- 演示 git 仓库 ----------------
def sh(cmd, cwd=REPO, env=None):
    e = os.environ.copy()
    if env:
        e.update(env)
    return subprocess.run(cmd, cwd=cwd, env=e, capture_output=True, text=True,
                          encoding="utf-8", errors="ignore")


def build_repo():
    if os.path.isdir(os.path.join(REPO, ".git")):
        return
    os.makedirs(REPO, exist_ok=True)
    sh(["git", "init", "-b", "main"], cwd=REPO)
    sh(["git", "config", "user.name", "dev"], cwd=REPO)
    sh(["git", "config", "user.email", "dev@example.com"], cwd=REPO)

    commits = [
        ("2026-08-12T10:00:00", "初始化定价服务骨架", "pricing/README.md", "# pricing\n"),
        ("2026-08-15T11:20:00", "定价 A 方案：类目阶梯配置", "pricing/tier.py", "def tier(x):\n    return x\n"),
        ("2026-08-29T09:40:00", "接入商家伙算账页", "pricing/calc.py", "def calc():\n    pass\n"),
        ("2026-09-12T16:10:00", "A 方案灰度开关", "pricing/flag.py", "FLAG = 'a'\n"),
        ("2026-09-27T14:05:00", "修投诉：阶梯边界四舍五入", "pricing/tier.py", "def tier(x):\n    return round(x, 2)\n"),
        ("2026-10-20T10:30:00", "灰度数据导出任务", "jobs/export.py", "def export():\n    pass\n"),
        ("2026-11-04T09:15:00", "B 方案：按效果分档", "pricing/effect.py", "def effect(x):\n    return x\n"),
        ("2026-11-06T15:40:00", "结算垫资接口", "settle/advance.py", "def advance():\n    pass\n"),
        ("2026-11-10T11:00:00", "B 方案配置化", "pricing/config.py", "SCHEMA = {}\n"),
    ]
    for i, (date, msg, path, content) in enumerate(commits):
        full = os.path.join(REPO, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content + f"\n# rev{i}\n")
        sh(["git", "add", "."])
        env = {"GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date}
        sh(["git", "commit", "-m", msg], env=env)

    # 分支 + 合并
    sh(["git", "checkout", "-b", "feat/settle"])
    for i, (date, msg, path, content) in enumerate([
        ("2026-11-11T10:00:00", "垫资风控校验", "settle/risk.py", "def risk():\n    pass\n"),
        ("2026-11-12T09:30:00", "垫资额度接口联调", "settle/api.py", "def api():\n    pass\n"),
    ]):
        full = os.path.join(REPO, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content + f"\n# branch{i}\n")
        sh(["git", "add", "."])
        sh(["git", "commit", "-m", msg],
           env={"GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date})
    sh(["git", "checkout", "main"])
    sh(["git", "merge", "--no-ff", "feat/settle", "-m", "合并结算垫资能力"],
       env={"GIT_AUTHOR_DATE": "2026-11-13T17:00:00",
            "GIT_COMMITTER_DATE": "2026-11-13T17:00:00"})
    sh(["git", "tag", "v1.2", "-m", "Q4 定价 B 方案上线"])
    print("repo ok")


build_repo()

# ---------------- 种子数据 ----------------
projects = [
    {"id": "p_pricing", "name": "Q4 定价", "lane": 0, "color": "#1B6E8C",
     "keywords": ["定价", "报价", "阶梯", "客单价", "A 方案", "B 方案", "灰度", "锚点", "商家", "跨境", "垫资", "回款"]},
    {"id": "p_promo", "name": "双十一大促", "lane": 1, "color": "#7A6BB0",
     "keywords": ["大促", "双十一", "预算", "GMV", "主推", "品类", "返场", "活动", "投产比", "复购"]},
    {"id": "p_content", "name": "内容理解", "lane": 2, "color": "#6B8E4E",
     "keywords": ["口径", "转化率", "埋点", "指标", "标签", "归因", "看板", "双跑", "v2", "长尾"]},
]

types = [
    {"id": "plan", "name": "方案", "color": "#2C6E8F", "icon": "▤",
     "fields": [{"key": "版本号", "kind": "文本"}, {"key": "适用范围", "kind": "文本"}]},
    {"id": "decision", "name": "决策", "color": "#B5473F", "icon": "◆",
     "fields": [{"key": "结论", "kind": "文本", "required": True},
                {"key": "负责人", "kind": "人员"},
                {"key": "依据", "kind": "长文本"}]},
    {"id": "asset", "name": "资产", "color": "#6B8E4E", "icon": "▦",
     "fields": [{"key": "链接", "kind": "链接"}, {"key": "更新方式", "kind": "文本"}]},
    {"id": "retro", "name": "复盘", "color": "#7A6BB0", "icon": "↺",
     "fields": [{"key": "原以为", "kind": "文本"}, {"key": "实际", "kind": "长文本"},
                {"key": "可复用做法", "kind": "长文本"}]},
    {"id": "version", "name": "版本", "color": "#8A99A5", "icon": "⎇",
     "fields": [{"key": "发布号", "kind": "文本"}, {"key": "改动", "kind": "文本"}]},
]
T = {t["id"]: t for t in types}

# (id, project, type, parent, title, summary, date, status, file, excerpt, extra)
N = [
    ("n01", "p_pricing", "plan", None, "定价策略草案 v1", "按类目阶梯报价，前置付费", "2026-08-14", "active",
     "定价A灰度复盘.md", "定价 A 方案灰度复盘", {"版本号": "v1", "适用范围": "中国区"}),
    ("n02", "p_pricing", "asset", "n01", "竞品价格数据表", "6 家竞品、32 个类目的价格快照", "2026-08-22", "active",
     None, None, {"链接": "bi://pricing/comp", "更新方式": "周更"}),
    ("n03", "p_pricing", "decision", "n01", "决定 A 方案进入灰度", "9 月 12 日评审通过，灰度 5%", "2026-09-12", "active",
     "Q4评审纪要.pdf", "决定 Q4 起改用 B 方案", {"结论": "A 方案进入灰度", "负责人": "张伟", "依据": "竞品数据表"}),
    ("n04", "p_pricing", "plan", "n03", "A 方案详设", "阶梯与锚点规则、算账页", "2026-09-15", "active",
     None, None, {"版本号": "v2", "适用范围": "灰度商家"}),
    ("n05", "p_pricing", "retro", "n04", "灰度第一周复盘", "客单价涨 6.2%，咨询量涨 3.1 倍", "2026-10-18", "active",
     "定价A灰度复盘.md", "原以为问题出在渠道结构", {"原以为": "渠道结构问题", "实际": "价格锚点让商家算不清账"}),
    ("n06", "p_pricing", "decision", "n05", "决定延长灰度两周", "再观察一轮咨询成本", "2026-10-02", "superseded",
     None, None, {"结论": "延长灰度两周", "负责人": "张伟"}),
    ("n07", "p_pricing", "plan", "n06", "B 方案提案", "按成交效果分档，后置补费", "2026-10-28", "active",
     "定价B方案提案.md", "不再按“类目 × 阶梯”报价",
     {"版本号": "v1", "适用范围": "全量"}),
    ("n08", "p_pricing", "decision", "n07", "决定 Q4 起改用 B 方案", "评审通过，A 仅保留跨境场景", "2026-11-03", "active",
     "Q4评审纪要.pdf", "决定 Q4 起改用 B 方案，A 方案仅保留跨境场景",
     {"结论": "Q4 起改用 B 方案", "负责人": "张伟", "依据": "灰度复盘 + 财务额度"}),
    ("n09", "p_pricing", "plan", "n08", "B 方案落地计划", "11-10 配置、11-15 灰度、12-01 全量", "2026-11-05", "active",
     "定价B方案提案.md", "11 月 10 日完成配置，11 月 15 日灰度 5%，12 月 1 日全量",
     {"版本号": "v1", "适用范围": "全量"}),
    ("n10", "p_pricing", "asset", "n09", "定价实时看板", "客单价 / 咨询量 / 回款周期", "2026-11-06", "active",
     None, None, {"链接": "bi://pricing/live", "更新方式": "实时"}),
    ("n11", "p_pricing", "decision", "n08", "决定保留 A 用于跨境", "跨境类目继续用 A，不回滚", "2026-11-12", "active",
     None, None, {"结论": "跨境保留 A 方案", "负责人": "李娜"}),
    ("n12", "p_pricing", "retro", "n11", "定价切换风险清单", "回款周期、垫资、客服话术", "2026-11-15", "active",
     "上线检查清单.txt", "回滚脚本已验证，回滚时间小于 3 分钟",
     {"原以为": "切换只要配开关", "实际": "结算侧需要垫资准备"}),

    ("n20", "p_promo", "plan", None, "大促活动排期", "10-20 启动，11-11 主推", "2026-08-28", "active",
     None, None, {"版本号": "v3", "适用范围": "全站"}),
    ("n21", "p_promo", "plan", "n20", "大促素材清单", "主图 / 短视频 / 直播脚本", "2026-09-05", "active",
     None, None, {"版本号": "v1", "适用范围": "主推品类"}),
    ("n22", "p_promo", "decision", "n20", "决定追加预算 200 万", "用于主推品类冲量", "2026-09-20", "active",
     None, None, {"结论": "追加 200 万预算", "负责人": "王强", "依据": "历史投产比 3.2"}),
    ("n23", "p_promo", "asset", "n22", "大促实时看板", "GMV / 投产比 / 品类结构", "2026-10-01", "active",
     None, None, {"链接": "bi://promo/live", "更新方式": "实时"}),
    ("n24", "p_promo", "decision", "n23", "决定主推 A 品类", "A 品类搜索指数最高", "2026-10-08", "active",
     None, None, {"结论": "主推 A 品类", "负责人": "王强"}),
    ("n25", "p_promo", "retro", "n24", "大促预演复盘", "压测通过，库存预警未打通", "2026-10-25", "active",
     None, None, {"原以为": "库存系统已对接", "实际": "预警没接"}),
    ("n26", "p_promo", "decision", "n25", "决定提前 2 天开启", "抢竞对窗口", "2026-10-30", "active",
     None, None, {"结论": "提前 2 天开启", "负责人": "王强"}),
    ("n27", "p_promo", "retro", "n26", "大促复盘", "GMV 108%，利润仅 91%", "2026-11-08", "active",
     "双十一大促复盘.md", "原以为追加 200 万预算能带来同比例增量，实际边际投产比从 3.2 掉到 1.9",
     {"原以为": "预算同比例增量", "实际": "需求已透支，边际投产比 1.9",
      "可复用做法": "加预算前看品类搜索指数斜率，为负就别加"}),
    ("n28", "p_promo", "plan", "n27", "大促返场方案", "11-20 前确认，避免和复盘冲突", "2026-11-12", "active",
     "双十一大促复盘.md", "返场方案需要在 11 月 20 日前确认",
     {"版本号": "v1", "适用范围": "返场"}),

    ("n30", "p_content", "plan", None, "埋点口径方案", "曝光 / 下单 / 支付三段埋点", "2026-09-05", "active",
     None, None, {"版本号": "v1", "适用范围": "全端"}),
    ("n31", "p_content", "decision", "n30", "决定统一转化率口径", "对外用 A，对内复盘用 B", "2026-10-11", "active",
     "指标口径说明.md", "统一为：对外一律使用口径 A，对内复盘使用口径 B",
     {"结论": "对外 A、对内 B", "负责人": "陈默", "依据": "口径说明文档"}),
    ("n32", "p_content", "asset", "n31", "口径对照表", "两个口径的公式与适用场景", "2026-10-12", "active",
     "指标口径说明.md", "口径 A（下单转化率）", {"链接": "bi://metric/map", "更新方式": "按需"}),
    ("n33", "p_content", "retro", "n31", "指标掉点归因", "不是渠道，是埋点重复上报", "2026-10-22", "active",
     None, None, {"原以为": "渠道质量下降", "实际": "埋点重复上报导致分母虚高"}),
    ("n34", "p_content", "decision", "n33", "决定暂停旧口径统计", "10-28 起停用旧口径", "2026-10-28", "active",
     "指标口径说明.md", "旧口径统计已于 10 月 28 日暂停", {"结论": "暂停旧口径", "负责人": "陈默"}),
    ("n35", "p_content", "plan", "n30", "内容标签体系 v2", "从 12 个粗标签到 86 个细标签", "2026-11-02", "active",
     None, None, {"版本号": "v2", "适用范围": "全量内容"}),
    ("n36", "p_content", "decision", "n35", "决定采用标签体系 v2", "迁移期两周，双跑对齐", "2026-11-10", "active",
     None, None, {"结论": "采用 v2，双跑两周", "负责人": "陈默"}),
    ("n37", "p_content", "asset", "n36", "标签覆盖率看板", "覆盖率 / 冲突率", "2026-11-14", "active",
     None, None, {"链接": "bi://content/tags", "更新方式": "日更"}),
    ("n38", "p_content", "retro", "n37", "标签迁移复盘", "覆盖率 92%，但长尾内容仍缺标签", "2026-11-18", "active",
     None, None, {"原以为": "两周能全量对齐", "实际": "长尾 8% 需要人工补"}),
]

nodes = []
for (nid, proj, typ, parent, title, summary, date, status, fname, excerpt, extra) in N:
    src = None
    if fname:
        path = os.path.join(FILES, fname)
        loc = {"kind": "pdf" if fname.endswith(".pdf") else "text"}
        if loc["kind"] == "text" and excerpt and os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                content = f.read()
            idx = content.find(excerpt)
            if idx >= 0:
                loc.update({"start": idx, "end": idx + len(excerpt)})
        if loc["kind"] == "pdf":
            loc.update({"page": 1, "rect": [60, 330, 535, 400]})
        src = {"file": fname, "locator": loc, "excerpt": excerpt}
    nodes.append({
        "id": nid, "project": proj, "type": typ, "title": title, "summary": summary,
        "content_at": date, "ingest_at": "2026-11-20T09:00", "status": status,
        "confidence": 0.92, "auto": False, "placement": "grow",
        "source": src, "extra": extra, "parent": parent,
    })

edges = []
for n in nodes:
    if n["parent"]:
        edges.append({"from": n["id"], "to": n["parent"], "kind": "derived"})
# 取代关系
edges.append({"from": "n08", "to": "n06", "kind": "supersedes"})   # B 取代“延长灰度”
edges.append({"from": "n34", "to": "n31", "kind": "supersedes"})   # 停旧口径 取代 口径统一？→ 用 relates 更准
edges = [e for e in edges if not (e["from"] == "n34" and e["kind"] == "supersedes")]
edges.append({"from": "n34", "to": "n31", "kind": "relates"})
# 跨项目关联：大促复盘 → 定价 B（需求透支影响定价）
edges.append({"from": "n27", "to": "n08", "kind": "relates"})
edges.append({"from": "n05", "to": "n27", "kind": "relates"})

seed = {
    "projects": projects,
    "types": types,
    "nodes": nodes,
    "edges": edges,
    "queue": [],
    "choices": [],
    "edits": [],
    "meta": {"name": "项目Git 演示数据", "version": 1,
             "git_repo": "data/demo-repo", "git_synced": False},
}

with open(os.path.join(DATA, "state.json"), "w", encoding="utf-8") as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)

print("nodes:", len(nodes), "edges:", len(edges))
print("files:", len(os.listdir(FILES)))
