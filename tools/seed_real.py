# -*- coding: utf-8 -*-
"""生成演示数据：把四个真实项目的“所有东西”都放进一张图

节点类型：方案 / 决策 / 复盘 / 资料 / 数据 / 代码 / 产出
（不只是决策，文档、语料、固件、脚本、板子、交付物都在图上）
"""
import os, io, json, shutil

ROOT = r"D:\03_code_list\project-git-项目知识时间轴"
DATA = os.path.join(ROOT, "data")
FILES = os.path.join(DATA, "files")
os.makedirs(FILES, exist_ok=True)

SRC = {
    "中继底座-试错记录.md": r"D:\03_code_list\esp32s3-relay-dock\docs\TRIALS-AND-ERRORS.md",
    "中继底座-交接文档.md": r"D:\03_code_list\esp32s3-relay-dock\docs\PROJECT-HANDOVER-2026-11-17.md",
    "TourBox-协议.md": r"D:\03_code_list\tuxbox-ref\protocol.md",
    "TourBox-抓包笔记.md": r"D:\03_code_list\tourbox-neo-probe\PROJECT_NOTES.md",
}
for name, src in SRC.items():
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(FILES, name))


def locate(fname, phrase):
    p = os.path.join(FILES, fname)
    if not os.path.exists(p):
        return None
    s = io.open(p, encoding="utf-8", errors="ignore").read()
    i = s.find(phrase)
    return None if i < 0 else {"kind": "text", "start": i, "end": i + len(phrase)}


projects = [
    {"id": "p_dachuang", "name": "大创 · 舆情 RAG", "color": "#3f8fc4",
     "keywords": ["大创", "舆情", "RAG", "直播", "弹幕", "标注", "答辩", "消费者决策", "消融", "开题"]},
    {"id": "p_relay", "name": "ESP32 中继底座", "color": "#5b9b52",
     "keywords": ["中继", "ESP32", "蓝牙", "BLE", "GATT", "固件", "底座", "TourBox", "广播名", "Console", "板子"]},
    {"id": "p_probe", "name": "TourBox 协议逆向", "color": "#7c6bc4",
     "keywords": ["抓包", "协议", "COM3", "逆向", "JVMTI", "反编译", "脱壳", "握手", "LibH"]},
    {"id": "p_qianwen", "name": "千问大赛 · 项目Git", "color": "#d9534f",
     "keywords": ["千问", "比赛", "命题", "Harness", "报名", "设计稿", "演示", "作品"]},
]

types = [
    {"id": "plan", "name": "方案", "color": "#3f8fc4", "fields": [{"key": "版本", "kind": "文本"}]},
    {"id": "decision", "name": "决策", "color": "#d9534f",
     "fields": [{"key": "结论", "kind": "文本", "required": True}, {"key": "理由", "kind": "长文本"}]},
    {"id": "retro", "name": "复盘", "color": "#7c6bc4",
     "fields": [{"key": "原以为", "kind": "文本"}, {"key": "实际", "kind": "长文本"}, {"key": "下次怎么做", "kind": "长文本"}]},
    {"id": "doc", "name": "资料", "color": "#a1785a", "fields": [{"key": "要点", "kind": "长文本"}]},
    {"id": "data", "name": "数据", "color": "#3f9d94", "fields": [{"key": "规模", "kind": "文本"}, {"key": "位置", "kind": "链接"}]},
    {"id": "code", "name": "代码", "color": "#5f7590", "fields": [{"key": "仓库", "kind": "链接"}, {"key": "说明", "kind": "文本"}]},
    {"id": "output", "name": "产出", "color": "#c08a3e", "fields": [{"key": "形态", "kind": "文本"}, {"key": "状态", "kind": "文本"}]},
]

# (id, 项目, 类型, 父节点, 标题, 摘要, 日期, 状态, 文件, 原文片段, 字段)
N = [
    # ================= 大创 · 舆情 RAG =================
    ("d1", "p_dachuang", "plan", None, "研究框架 v1", "直播舆情 → 消费者决策，用 RAG 做问答与归因", "2026-08-10", "active", None, None,
     {"版本": "v1"}),
    ("d2", "p_dachuang", "doc", "d1", "开题报告", "研究背景、问题定义、技术路线", "2026-08-14", "active", None, None,
     {"要点": "把“舆情”落到可测量的消费者决策阶段上"}),
    ("d3", "p_dachuang", "doc", "d1", "参考文献 23 篇", "RAG、观点挖掘、消费者决策路径", "2026-08-16", "active", None, None,
     {"要点": "以 RAG + 观点挖掘为主线"}),
    ("d4", "p_dachuang", "decision", "d1", "决定不做微调，改 RAG", "数据量不够、没有 GPU，微调不划算", "2026-08-20", "active", None, None,
     {"结论": "用 RAG + 提示工程，不微调", "理由": "标注数据不足万条，且本机无可用 GPU"}),
    ("d5", "p_dachuang", "data", "d4", "直播弹幕语料", "12 万条弹幕 + 2 万条评论，已脱敏", "2026-08-28", "active", None, None,
     {"规模": "12 万条弹幕 / 2 万条评论", "位置": "D://03_code_list/舆情语料"}),
    ("d6", "p_dachuang", "data", "d5", "四阶段标注集", "认知 / 比较 / 下单 / 复购，各 3000 条", "2026-09-08", "active", None, None,
     {"规模": "1.2 万条", "位置": "D://03_code_list/舆情语料/标注"}),
    ("d7", "p_dachuang", "decision", "d6", "消费者决策拆成 4 阶段", "按阶段分别标注，便于归因", "2026-09-05", "active", None, None,
     {"结论": "四阶段标注框架", "理由": "整体标注无法定位问题"}),
    ("d8", "p_dachuang", "retro", "d7", "第一轮标注一致性 0.61", "两个人标得差得远，比较和下单分不清", "2026-09-18", "active", None, None,
     {"原以为": "标一遍就够", "实际": "Kappa 只有 0.61，边界案例太多", "下次怎么做": "双人标 + 第三人仲裁，先定 20 条样例"}),
    ("d9", "p_dachuang", "plan", "d8", "检索链路 v2", "BM25 + 向量双路，再做重排", "2026-10-02", "active", None, None,
     {"版本": "v2"}),
    ("d10", "p_dachuang", "decision", "d9", "换 bge-small-zh 做向量", "CPU 能跑，中文效果够用", "2026-10-09", "active", None, None,
     {"结论": "embedding 换 bge-small-zh", "理由": "原模型英文为主，中文召回差"}),
    ("d11", "p_dachuang", "code", "d10", "检索 + 评测脚本", "召回评测、引用校验、批量跑批", "2026-10-15", "active", None, None,
     {"仓库": "D://03_code_list/舆情语料/code", "说明": "recall.py / eval.py"}),
    ("d12", "p_dachuang", "retro", "d11", "答辩预演复盘", "老师问“你怎么证明不是模型本来就会”", "2026-11-05", "active", None, None,
     {"原以为": "讲清方法就够", "实际": "缺一组对照实验，说服力不够", "下次怎么做": "任何结论都配一组消融"}),
    ("d13", "p_dachuang", "decision", "d12", "补一组消融实验", "去掉检索、去掉提示，各跑一遍", "2026-11-12", "active", None, None,
     {"结论": "加三组消融", "理由": "回答“分数是模型给的还是方法给的”"}),
    ("d14", "p_dachuang", "output", "d13", "论文初稿", "方法、实验、讨论", "2026-11-15", "active", None, None,
     {"形态": "Word / 1.4 万字", "状态": "待补实验数据"}),

    # ================= ESP32 中继底座 =================
    ("r1", "p_relay", "plan", None, "让 NEO 冒充 Elite", "NEO 按键 → ESP32 读 USB → BLE → Console 识别", "2026-08-12", "active", None, None,
     {"版本": "v1"}),
    ("r2", "p_relay", "doc", "r1", "交接文档", "目标、硬件基线、结论、后续路径", "2026-11-17", "active",
     "中继底座-交接文档.md", "目标未达成（安卓端官方 App 未识别模拟设备）",
     {"要点": "项目暂停归档，排除了大量方向"}),
    ("r3", "p_relay", "doc", "r1", "试错全记录 44 条", "每条：做法 → 结果 → 证据 → 结论", "2026-11-17", "active",
     "中继底座-试错记录.md", "Console 按名字分流到 HID 流",
     {"要点": "避免重复踩坑"}),
    ("r4", "p_relay", "doc", "r1", "Console 反编译源码", "1551 个 java，业务类可读", "2026-09-22", "active", None, None,
     {"要点": "Console 按设备名与 productKey 分流"}),
    ("r5", "p_relay", "data", "r1", "固件镜像 73 个", "从 Console 下发包里扒出的完整固件集", "2026-09-20", "active", None, None,
     {"规模": "73 个 .bin，最大 95 KB", "位置": "D://03_code_list/tourbox-neo-probe/ref/firmware-full"}),
    ("r6", "p_relay", "data", "r1", "身份帧样本", "26 字节身份帧，首字节 0x07 表示解锁成功", "2026-09-10", "active", None, None,
     {"规模": "37 组", "位置": "D://03_code_list/tourbox-neo-probe/captures"}),
    ("r7", "p_relay", "code", "r1", "esp32s3-relay-dock 仓库", "ESP-IDF 固件，113 个提交", "2026-08-15", "active", None, None,
     {"仓库": "D:\\03_code_list\\esp32s3-relay-dock", "说明": "基线 b6677ef"}),
    ("r8", "p_relay", "code", "r7", "BLE 服务实现", "FFF0 / FFF1 通知 / FFF2 写入", "2026-08-28", "active", None, None,
     {"仓库": "main/ble_relay.c", "说明": "GATT 直连"}),
    ("r9", "p_relay", "decision", "r8", "先走 HID 流（走错了）", "以为注册 HID 服务就能被认成 Plus，结果永远卡在“正在连接”", "2026-08-30", "abandoned", None, None,
     {"结论": "走 HID 流", "理由": "Plus 机型走 HID"}),
    ("r10", "p_relay", "decision", "r8", "放弃 HID，改 GATT 直连", "广播名用 Elite，Console 就走 GATT", "2026-09-02", "active",
     "中继底座-试错记录.md", "这是稳定基线（git b6677ef）",
     {"结论": "GATT 直连 + 广播名 Elite", "理由": "HID 描述符不完整，达不到 HID 流要求"}),
    ("r11", "p_relay", "retro", "r10", "原以为名字随便改就行", "名字改 Plus 就卡住，因为 Console 按名字分流", "2026-09-06", "active",
     "中继底座-试错记录.md", "Console 按名字分流到 HID 流",
     {"原以为": "厂商数据是分流依据", "实际": "分流依据是广播名", "下次怎么做": "先看名字，再谈协议"}),
    ("r12", "p_relay", "decision", "r11", "冒充 productKey 让 Console 识别", "身份帧里 productKey 写 101（Elite 黑）", "2026-09-12", "active", None, None,
     {"结论": "productKey=101", "理由": "Console 用 productKey 决定机型示意图"}),
    ("r13", "p_relay", "retro", "r12", "蓝牙配对失败复盘", "改名后 Windows 缓存旧配对，怎么都连不上", "2026-10-08", "active", None, None,
     {"原以为": "是固件问题", "实际": "Windows 侧缓存了旧设备", "下次怎么做": "改名字后先删配对再扫"}),
    ("r14", "p_relay", "decision", "r13", "锁定基线 b6677ef", "把能用的那版固化，不再往上堆功能", "2026-10-15", "active",
     "中继底座-交接文档.md", "Windows Console 走 GATT 流程可用",
     {"结论": "基线锁 b6677ef", "理由": "再改就不可复现"}),
    ("r15", "p_relay", "plan", "r14", "蓝牙中转站 PCB v1", "ESP32-S3 + 外部天线 + USB-C", "2026-10-25", "active", None, None,
     {"版本": "v1"}),
    ("r16", "p_relay", "decision", "r15", "改板：加外部天线", "板载天线在金属外壳里衰减太大", "2026-11-02", "active", None, None,
     {"结论": "改用 IPEX 外置天线", "理由": "实测 RSSI 掉 12dB"}),
    ("r17", "p_relay", "retro", "r16", "安卓端走不通，暂停归档", "安卓/iPad App 始终不认模拟设备", "2026-11-17", "active", None, None,
     {"原以为": "Windows 能用，安卓应该也能", "实际": "App 有额外内部校验，反推不出来", "下次怎么做": "先验证最难的那一端"}),

    # ================= TourBox 协议逆向 =================
    ("t1", "p_probe", "plan", None, "先看清设备吐什么", "抓包 → 解协议 → 再谈模拟", "2026-08-18", "active", None, None,
     {"版本": "v1"}),
    ("t2", "p_probe", "data", "t1", "NEO 串口日志", "USB CDC-ACM，115200 8N1", "2026-08-20", "active", None, None,
     {"规模": "约 40 万行", "位置": "D://03_code_list/tourbox-neo-probe/logs"}),
    ("t3", "p_probe", "code", "t2", "capture.py 抓包脚本", "按帧切分、落盘、可回放", "2026-08-24", "active",
     "TourBox-抓包笔记.md", "让 TourBox NEO 能操控 HarmonyOS 平板上的「天生会画」",
     {"仓库": "D://03_code_list/tourbox-neo-probe/capture.py", "说明": "pyserial"}),
    ("t4", "p_probe", "decision", "t3", "用 CDC-ACM 抓包，不上逻辑分析仪", "NEO 是标准串口设备，直接读 COM3", "2026-08-22", "active", None, None,
     {"结论": "pyserial 读 COM3", "理由": "省一台分析仪，还能拿到完整帧"}),
    ("t5", "p_probe", "retro", "t4", "Console 独占 COM3", "一开 Console 就抓不到数据", "2026-08-26", "active", None, None,
     {"原以为": "串口能同时被两个进程读", "实际": "Console 打开后独占，必须先退出", "下次怎么做": "抓包前先杀 Console 进程"}),
    ("t6", "p_probe", "doc", "t5", "协议文档（已解）", "握手两个阶段 + XOR 密钥", "2026-09-10", "active",
     "TourBox-协议.md", "Successfully reverse-engineered the TourBox Elite authentication protocol",
     {"要点": "55 00 07 88 94 00 1A FE 解锁；D5 挑战应答"}),
    ("t7", "p_probe", "decision", "t6", "逆向 LibH.dll", "它是 JVMTI 代理，能在类加载时解密", "2026-09-15", "active", None, None,
     {"结论": "用完整 JDK 加载 JVMTI 代理", "理由": "Console 自带的精简 JRE 注入不进去"}),
    ("t8", "p_probe", "retro", "t7", "精简 JRE 没有 java.instrument", "注入到运行中的 Console 必然失败", "2026-09-18", "active", None, None,
     {"原以为": "直接 attach 就行", "实际": "缺 instrument 模块", "下次怎么做": "自己起 JVM，别 attach"}),
    ("t9", "p_probe", "code", "t8", "dump.jar + LibH.dll", "自写 javaagent，导出解密后的类", "2026-09-20", "active", None, None,
     {"仓库": "D://03_code_list/tourbox-console-decompiled", "说明": "配合 -agentpath 使用"}),
    ("t10", "p_probe", "data", "t9", "反编译源码 1551 个 java", "Console 业务类全部还原", "2026-09-22", "active", None, None,
     {"规模": "1551 个 .java", "位置": "D://03_code_list/tourbox-console-decompiled/src"}),
    ("t11", "p_probe", "decision", "t10", "硬脱壳 360 企业版（走错了）", "newBlackDex 深度脱壳只拿到壳自己的 dex", "2026-10-20", "abandoned", None, None,
     {"结论": "硬脱壳不可行", "理由": "无 root，真实 dex 藏在加密载荷里"}),
    ("t12", "p_probe", "decision", "t11", "停掉脱壳路线", "不再在脱壳上耗时间，转去做协议模拟", "2026-10-30", "active", None, None,
     {"结论": "放弃脱壳", "理由": "投入产出不划算"}),
    ("t13", "p_probe", "output", "t12", "NEO → 平板改造方案", "按键映射到 GoPaint", "2026-10-24", "active", None, None,
     {"形态": "方案 + 演示", "状态": "Windows 可用，鸿蒙待验证"}),

    # ================= 千问大赛 =================
    ("q1", "p_qianwen", "doc", None, "赛题原文 6 道", "命题 05：知识密集型多项目团队的知识问答 Harness", "2026-11-18", "active", None, None,
     {"要点": "团队级、多项目、文档与经验、可溯源"}),
    ("q2", "p_qianwen", "plan", "q1", "选题：命题 05", "内容消费方向，一周内交作品", "2026-11-18", "active", None, None,
     {"版本": "v1"}),
    ("q3", "p_qianwen", "decision", "q2", "定为命题 05，放弃 03", "03 名额多但缺真实经营数据", "2026-11-19", "active", None, None,
     {"结论": "报命题 05", "理由": "能力匹配度更高"}),
    ("q4", "p_qianwen", "doc", "q3", "设计稿 v1.2", "21 页：数据模型、闸门、交互规格", "2026-11-20", "active", None, None,
     {"要点": "可直接照着开发"}),
    ("q5", "p_qianwen", "data", "q4", "演示数据", "4 个真实项目、52 个节点、7 份原文", "2026-11-21", "active", None, None,
     {"规模": "52 节点 / 36 关系", "位置": "data/state.json"}),
    ("q6", "p_qianwen", "code", "q5", "项目Git 应用", "Electron + d3 力导向", "2026-11-21", "active", None, None,
     {"仓库": "D:\\03_code_list\\project-git-项目知识时间轴", "说明": "main.js / engine.js / web"}),
    ("q7", "p_qianwen", "retro", "q6", "第一版界面推倒重来", "手搓坐标 + 卡片布局，渲染 bug 一堆", "2026-11-20", "active", None, None,
     {"原以为": "自己算坐标更可控", "实际": "缩放/连线/重叠全要自己管，很容易崩", "下次怎么做": "布局交给力导向库"}),
    ("q8", "p_qianwen", "decision", "q7", "改白底 + 力导向 + 卡片", "直线连接、时间用很弱的向右力", "2026-11-21", "active", None, None,
     {"结论": "重做为桌面应用", "理由": "稳定优先，能看清优先"}),
    ("q9", "p_qianwen", "decision", "q8", "样例改用自己做过的项目", "不编案例，讲起来顺", "2026-11-21", "active", None, None,
     {"结论": "用大创/中继/逆向做样例", "理由": "一眼能看懂"}),
    ("q10", "p_qianwen", "output", "q9", "演示视频", "3 分钟走 6 个镜头", "2026-11-22", "draft", None, None,
     {"形态": "录屏", "状态": "待录"}),
]

out_nodes = []
for (nid, proj, typ, parent, title, summary, date, status, fname, phrase, extra) in N:
    src = None
    if fname and phrase:
        loc = locate(fname, phrase)
        if loc:
            src = {"file": fname, "locator": loc, "excerpt": phrase}
    out_nodes.append({
        "id": nid, "project": proj, "type": typ, "title": title, "summary": summary,
        "content_at": date, "ingest_at": "2026-11-21T01:40",
        "status": status, "confidence": 0.95, "auto": False,
        "placement": "grow", "source": src, "extra": extra, "parent": parent,
    })

edges = []
for n in N:
    if n[3]:
        edges.append({"from": n[0], "to": n[3], "kind": "derived"})

# 取代：走错的路被后来的正确路线取代
edges.append({"from": "r10", "to": "r9", "kind": "supersedes"})
edges.append({"from": "t12", "to": "t11", "kind": "supersedes"})

# 跨项目 / 跨类型的“相关”
edges.append({"from": "r12", "to": "t7", "kind": "relates"})    # productKey ← 逆向
edges.append({"from": "r17", "to": "t12", "kind": "relates"})   # 暂停归档 ← 停脱壳
edges.append({"from": "q9", "to": "r10", "kind": "relates"})    # 样例 ← 中继
edges.append({"from": "q9", "to": "d4", "kind": "relates"})     # 样例 ← 大创
edges.append({"from": "r5", "to": "r2", "kind": "relates"})     # 固件 ← 交接文档

# 隐形引用：资源被后面的节点用到（不参与力，悬停才显示）
edges.append({"from": "r5", "to": "r10", "kind": "uses"})   # 固件镜像 → 改 GATT
edges.append({"from": "r5", "to": "r12", "kind": "uses"})   # 固件镜像 → 冒充 productKey
edges.append({"from": "r3", "to": "r17", "kind": "uses"})   # 试错记录 → 暂停归档
edges.append({"from": "t6", "to": "t7", "kind": "uses"})    # 协议文档 → 逆向 LibH
edges.append({"from": "d5", "to": "d9", "kind": "uses"})    # 弹幕语料 → 检索链路 v2
edges.append({"from": "d6", "to": "d12", "kind": "uses"})   # 标注集 → 答辩复盘

state = {
    "projects": projects, "types": types,
    "nodes": out_nodes, "edges": edges,
    "queue": [], "choices": [], "edits": [],
    "meta": {"name": "项目Git · 真实项目全量数据", "version": 3,
             "git_repo": r"D:\03_code_list\esp32s3-relay-dock", "git_synced": False},
}

for target in [os.path.join(DATA, "state.json"),
               os.path.join(ROOT, "desktop", "seed", "state.json")]:
    with io.open(target, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)

from collections import Counter
c = Counter(n["type"] for n in out_nodes)
print("nodes:", len(out_nodes), "edges:", len(edges))
print("types:", dict(c))
print("有原文:", sum(1 for n in out_nodes if n["source"]))
