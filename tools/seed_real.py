# -*- coding: utf-8 -*-
"""重新生成演示数据：用这台机器上真实做过的项目（大创 / TourBox 中继 / 协议逆向 / 千问大赛）

- 把 4 份真实文档复制进 data/files
- 节点引用的片段都取自原文，算好字符区间，点“打开文件”能真的打开
- 同时写入 data/state.json 与 desktop/seed/state.json
"""
import os, io, json, shutil, datetime

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
    if i < 0:
        return None
    return {"kind": "text", "start": i, "end": i + len(phrase)}

projects = [
    {"id": "p_dachuang", "name": "大创 · 舆情 RAG", "color": "#3f8fc4",
     "keywords": ["大创", "舆情", "RAG", "直播", "弹幕", "标注", "答辩", "消费者决策", "消融"]},
    {"id": "p_relay", "name": "ESP32 中继底座", "color": "#5b9b52",
     "keywords": ["中继", "ESP32", "蓝牙", "BLE", "GATT", "固件", "底座", "TourBox", "广播名", "Console"]},
    {"id": "p_probe", "name": "TourBox 协议逆向", "color": "#7c6bc4",
     "keywords": ["抓包", "协议", "COM3", "逆向", "JVMTI", "反编译", "脱壳", "握手"]},
    {"id": "p_qianwen", "name": "千问大赛 · 项目Git", "color": "#d9534f",
     "keywords": ["千问", "比赛", "命题", "Harness", "报名", "设计稿", "演示"]},
]

types = [
    {"id": "plan", "name": "方案", "color": "#3f8fc4", "fields": [{"key": "版本", "kind": "文本"}]},
    {"id": "decision", "name": "决策", "color": "#d9534f",
     "fields": [{"key": "结论", "kind": "文本", "required": True}, {"key": "负责人", "kind": "人员"}, {"key": "理由", "kind": "长文本"}]},
    {"id": "asset", "name": "资产", "color": "#5b9b52", "fields": [{"key": "位置", "kind": "链接"}]},
    {"id": "retro", "name": "复盘", "color": "#7c6bc4",
     "fields": [{"key": "原以为", "kind": "文本"}, {"key": "实际", "kind": "长文本"}, {"key": "下次怎么做", "kind": "长文本"}]},
    {"id": "version", "name": "版本", "color": "#8a97a5", "fields": [{"key": "编号", "kind": "文本"}]},
]

# (id, 项目, 类型, 父节点, 标题, 摘要, 日期, 状态, 文件, 原文片段, 字段)
N = [
    # ---------- 大创 ----------
    ("d1", "p_dachuang", "plan", None, "研究框架 v1", "直播舆情 → 消费者决策，用 RAG 做问答与归因", "2026-08-12", "active", None, None, {"版本": "v1"}),
    ("d2", "p_dachuang", "decision", "d1", "决定不做微调，改 RAG", "数据量不够、没有 GPU，微调不划算", "2026-08-20", "active", None, None,
     {"结论": "用 RAG + 提示工程，不微调", "负责人": "我", "理由": "标注数据不足万条，且本机无可用 GPU"}),
    ("d3", "p_dachuang", "asset", "d1", "直播弹幕语料", "12 万条弹幕 + 2 万条评论，已脱敏", "2026-08-28", "active", None, None,
     {"位置": "D://03_code_list/舆情语料"}),
    ("d4", "p_dachuang", "decision", "d2", "消费者决策拆成 4 阶段", "认知 / 比较 / 下单 / 复购，分别标注", "2026-09-05", "active", None, None,
     {"结论": "四阶段标注框架", "负责人": "我", "理由": "评委更认阶段化拆解"}),
    ("d5", "p_dachuang", "retro", "d4", "第一轮标注一致性 0.61", "两个人标的差得远，尤其“比较”和“下单”分不清", "2026-09-18", "active", None, None,
     {"原以为": "标一遍就够", "实际": "Kappa 只有 0.61，边界案例太多", "下次怎么做": "双人标 + 第三人仲裁，先定 20 条样例"}),
    ("d6", "p_dachuang", "plan", "d5", "检索链路 v2", "BM25 + 向量双路，再做重排", "2026-10-02", "active", None, None, {"版本": "v2"}),
    ("d7", "p_dachuang", "decision", "d6", "换 bge-small-zh 做向量", "CPU 能跑，中文效果够用", "2026-10-09", "active", None, None,
     {"结论": "embedding 换 bge-small-zh", "负责人": "我", "理由": "原模型英文为主，中文召回差"}),
    ("d8", "p_dachuang", "retro", "d7", "答辩预演复盘", "老师问“你怎么证明不是模型本来就会”", "2026-11-05", "active", None, None,
     {"原以为": "讲清方法就够", "实际": "缺一组对照实验，说服力不够", "下次怎么做": "任何结论都配一组消融"}),
    ("d9", "p_dachuang", "decision", "d8", "补一组消融实验", "去掉检索、去掉提示，各跑一遍", "2026-11-12", "active", None, None,
     {"结论": "加三组消融", "负责人": "我", "理由": "回答“这分数是模型给的还是你的方法给的”"}),

    # ---------- 中继底座 ----------
    ("r1", "p_relay", "plan", None, "硬件选型：ESP32-S3", "16MB Flash / 8MB PSRAM，CH343 串口", "2026-08-15", "active",
     "TourBox-抓包笔记.md", "让 TourBox NEO 能操控 HarmonyOS 平板上的「天生会画」", {"版本": "v1"}),
    ("r2", "p_relay", "decision", "r1", "先走 HID 流", "以为注册 HID 服务就能被 Console 认成 Plus", "2026-08-20", "superseded", None, None,
     {"结论": "走 HID 流", "负责人": "我", "理由": "Plus 机型走 HID"}),
    ("r3", "p_relay", "decision", "r2", "放弃 HID，改 GATT 直连", "广播名用 Elite，Console 就走 GATT", "2026-08-30", "active",
     "中继底座-试错记录.md", "这是稳定基线（git b6677ef）",
     {"结论": "GATT 直连 + 广播名 Elite", "负责人": "我", "理由": "HID 描述符不完整，永远卡在“正在连接”"}),
    ("r4", "p_relay", "retro", "r3", "原以为名字随便改就行", "名字改 Plus 就卡住，因为 Console 按名字分流", "2026-09-06", "active",
     "中继底座-试错记录.md", "Console 按名字分流到 HID 流",
     {"原以为": "厂商数据是分流依据", "实际": "分流依据是广播名", "下次怎么做": "先看名字，再谈协议"}),
    ("r5", "p_relay", "decision", "r4", "冒充 productKey 让 Console 识别", "身份帧里 productKey 写 101（Elite 黑）", "2026-09-12", "active", None, None,
     {"结论": "productKey=101", "负责人": "我", "理由": "Console 用 productKey 决定机型示意图"}),
    ("r6", "p_relay", "asset", "r5", "固件镜像 73 个", "从 Console 下发包里扒出来的完整固件集", "2026-09-20", "active", None, None,
     {"位置": "D://03_code_list/tourbox-neo-probe/ref/firmware-full"}),
    ("r7", "p_relay", "retro", "r6", "蓝牙配对失败复盘", "改了几次名字后 Windows 缓存旧配对，怎么都连不上", "2026-10-08", "active", None, None,
     {"原以为": "是固件问题", "实际": "Windows 侧缓存了旧设备", "下次怎么做": "改名字后先删配对再扫"}),
    ("r8", "p_relay", "decision", "r7", "锁定基线 b6677ef", "把能用的那版固化，不再往上堆功能", "2026-10-15", "active",
     "中继底座-交接文档.md", "Windows Console 走 GATT 流程可用",
     {"结论": "基线锁 b6677ef", "负责人": "我", "理由": "再改就不可复现"}),
    ("r9", "p_relay", "plan", "r8", "蓝牙中转站 PCB v1", "ESP32-S3 + 外部天线 + USB-C", "2026-10-25", "active", None, None, {"版本": "v1"}),
    ("r10", "p_relay", "decision", "r9", "改板：加外部天线", "板载天线在金属外壳里衰减太大", "2026-11-02", "active", None, None,
     {"结论": "改用 IPEX 外置天线", "负责人": "我", "理由": "实测 RSSI 掉 12dB"}),
    ("r11", "p_relay", "retro", "r10", "项目暂停归档", "安卓端 App 始终不认模拟设备", "2026-11-17", "active",
     "中继底座-交接文档.md", "目标未达成（安卓端官方 App 未识别模拟设备）",
     {"原以为": "Windows 能用，安卓应该也能", "实际": "App 有额外内部校验，反推不出来", "下次怎么做": "先验证最难的那一端"}),

    # ---------- 协议逆向 ----------
    ("t1", "p_probe", "plan", None, "抓包方案", "先看设备到底吐什么，再谈模拟", "2026-08-18", "active", None, None, {"版本": "v1"}),
    ("t2", "p_probe", "decision", "t1", "用 CDC-ACM 抓包，不上逻辑分析仪", "NEO 是标准串口设备，直接读 COM3", "2026-08-22", "active",
     "TourBox-协议.md", "The device requires a specific unlock sequence",
     {"结论": "pyserial 读 COM3", "负责人": "我", "理由": "省一台分析仪，而且能拿到完整帧"}),
    ("t3", "p_probe", "asset", "t2", "capture.py 抓包脚本", "115200 8N1，按帧切分落盘", "2026-08-24", "active", None, None,
     {"位置": "D://03_code_list/tourbox-neo-probe/capture.py"}),
    ("t4", "p_probe", "retro", "t3", "Console 独占 COM3", "一开 Console 就抓不到数据", "2026-08-26", "active", None, None,
     {"原以为": "串口能同时被两个进程读", "实际": "Console 打开后独占，必须先退出", "下次怎么做": "抓包前先杀 Console 进程"}),
    ("t5", "p_probe", "decision", "t4", "逆向 LibH.dll", "它是 JVMTI 代理，能在类加载时解密", "2026-09-15", "active",
     "TourBox-协议.md", "Successfully reverse-engineered the TourBox Elite authentication protocol",
     {"结论": "用完整 JDK 加载 JVMTI 代理", "负责人": "我", "理由": "Console 自带的精简 JRE 注入不进去"}),
    ("t6", "p_probe", "retro", "t5", "精简 JRE 没有 java.instrument", "注入到运行中的 Console 必然失败", "2026-09-18", "active", None, None,
     {"原以为": "直接 attach 就行", "实际": "缺 instrument 模块", "下次怎么做": "自己起 JVM，别 attach"}),
    ("t7", "p_probe", "asset", "t6", "反编译源码 1551 个 java", "Console 业务类全部还原", "2026-09-22", "active", None, None,
     {"位置": "D://03_code_list/tourbox-console-decompiled"}),
    ("t8", "p_probe", "decision", "t7", "停掉 360 加固的脱壳尝试", "newBlackDex 只能 dump 出壳自己的 dex", "2026-10-30", "active", None, None,
     {"结论": "放弃脱壳路线", "负责人": "我", "理由": "无 root，脱不出来"}),

    # ---------- 千问大赛 ----------
    ("q1", "p_qianwen", "plan", None, "选题：命题 05 知识问答 Harness", "内容消费方向，一周内交作品", "2026-11-18", "active", None, None, {"版本": "v1"}),
    ("q2", "p_qianwen", "decision", "q1", "定为命题 05，放弃 03", "03 名额多但缺真实经营数据", "2026-11-19", "active", None, None,
     {"结论": "报命题 05", "负责人": "我", "理由": "能力匹配度更高"}),
    ("q3", "p_qianwen", "retro", "q2", "第一版界面推倒重来", "手搓坐标 + 卡片布局，渲染 bug 一堆", "2026-11-20", "active", None, None,
     {"原以为": "自己算坐标更可控", "实际": "缩放/连线/重叠全要自己管，很容易崩", "下次怎么做": "布局交给力导向库"}),
    ("q4", "p_qianwen", "decision", "q3", "改力导向 + 白底", "d3 力导向，直线连接，时间放节点下面", "2026-11-21", "active", None, None,
     {"结论": "重做为桌面应用", "负责人": "我", "理由": "稳定优先，视觉其次"}),
    ("q5", "p_qianwen", "asset", "q4", "设计稿 v1.2", "21 页，含数据模型与交互规格", "2026-11-20", "active", None, None,
     {"位置": "docs/项目Git-设计稿v1.2.docx"}),
    ("q6", "p_qianwen", "decision", "q5", "演示改用自己做过的项目", "避免虚构案例，讲起来更顺", "2026-11-21", "active", None, None,
     {"结论": "用大创 / 中继 / 逆向三个项目做样例", "负责人": "我"}),
]

nodes = [n[0] for n in N]
edges = []

def add(nid, proj, typ, parent, title, summary, date, status, fname, phrase, extra):
    src = None
    if fname and phrase:
        loc = locate(fname, phrase)
        if loc:
            src = {"file": fname, "locator": loc, "excerpt": phrase}
    node = {
        "id": nid, "project": proj, "type": typ, "title": title, "summary": summary,
        "content_at": date, "ingest_at": "2026-11-21T00:30",
        "status": status, "confidence": 0.95, "auto": False, "placement": "grow",
        "source": src, "extra": extra, "parent": parent,
    }
    return node

out_nodes = [add(*n) for n in N]
for n in N:
    if n[3]:
        edges.append({"from": n[0], "to": n[3], "kind": "derived"})

# 取代关系：r3 推翻了 r2 的 HID 路线
edges.append({"from": "r3", "to": "r2", "kind": "supersedes"})
# 跨项目相关
edges.append({"from": "r5", "to": "t5", "kind": "relates"})   # productKey ← 逆向
edges.append({"from": "r11", "to": "t8", "kind": "relates"})  # 暂停归档 ← 脱壳失败
edges.append({"from": "q6", "to": "r3", "kind": "relates"})   # 演示用例 ← 中继项目

state = {
    "projects": projects, "types": types,
    "nodes": out_nodes, "edges": edges,
    "queue": [], "choices": [], "edits": [],
    "meta": {"name": "项目Git · 真实项目演示数据", "version": 2,
             "git_repo": r"D:\03_code_list\esp32s3-relay-dock", "git_synced": False},
}

for target in [os.path.join(DATA, "state.json"),
               os.path.join(ROOT, "desktop", "seed", "state.json")]:
    with io.open(target, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)

withsrc = sum(1 for n in out_nodes if n["source"])
print("nodes:", len(out_nodes), "edges:", len(edges), "有原文:", withsrc)
print("files:", [f for f in os.listdir(FILES)])
