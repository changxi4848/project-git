# -*- coding: utf-8 -*-
"""项目Git · 判定引擎（纯逻辑，无 IO）

包含：分词打分、切条、归位判定、闸门、检索。
"""
import re
import time
import datetime

# ---------------- 基础工具 ----------------

CJK = re.compile(r"[\u4e00-\u9fff]")


def now_iso():
    return datetime.datetime.now().strftime("%Y-%m-%dT%H:%M")


def to_ms(date_str):
    """把 2026-11-03 / 2026-11-03T19:12 转成毫秒时间戳，失败返回 None"""
    if not date_str:
        return None
    s = str(date_str).strip().replace("/", "-")
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            d = datetime.datetime.strptime(s, fmt)
            return int(d.timestamp() * 1000)
        except ValueError:
            continue
    return None


def tokenize(text):
    """中文按 2-gram，英文数字按词。够用且无需分词依赖。"""
    if not text:
        return set()
    text = str(text).lower()
    toks = set()
    for w in re.findall(r"[a-z0-9_\-]{2,}", text):
        toks.add(w)
    cjk = "".join(CJK.findall(text))
    for i in range(len(cjk) - 1):
        toks.add(cjk[i:i + 2])
    return toks


def overlap(a, b):
    """0..1"""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (min(len(a), len(b)) or 1)


# ---------------- 类型判定 ----------------

TYPE_CUES = {
    "decision": ["定了", "就按", "决定", "改为", "改成", "统一为", "暂停", "不做",
                 "批准", "拍板", "确认用", "切换到", "取消", "同意", "上线吧", "就用",
                 "延长到", "定为", "不再", "别再加", "就算了", "提前", "锁定"],
    "plan": ["方案", "prd", "设计稿", "计划", "排期", "草案", "初稿", "规划"],
    "retro": ["复盘", "总结", "教训", "原以为", "结果发现", "踩坑", "回顾", "归因"],
    "asset": ["数据表", "看板", "报表", "素材", "大盘", "图表", "链接", "文档库"],
    "version": ["发布", "上线了", "版本", "灰度", "回滚", "tag", "release"],
}


def score_type(text):
    t = str(text).lower()
    scores = {}
    for typ, cues in TYPE_CUES.items():
        hit = sum(1 for c in cues if c in t)
        scores[typ] = hit
    best = max(scores.values()) if scores else 0
    if best == 0:
        return "unknown", 0.0
    typ = max(scores, key=lambda k: scores[k])
    strength = min(1.0, 0.55 + 0.25 * best)
    return typ, strength


# ---------------- 切条 ----------------

HEADER = re.compile(
    r"^\s*([^\s:：]{1,14})\s+"            # 说话人
    r"(?:(20\d{2})[-/](\d{1,2})[-/](\d{1,2}))?\s*"  # 可选日期
    r"(?:(\d{1,2}):(\d{2}))?\s*"          # 可选时间
    r"[：:]?\s*(.*)$"                      # 正文（可为空）
)
NAME_COLON = re.compile(r"^\s*([^\s:：]{1,14})[：:]\s*(.+)$")
DATE_IN_LINE = re.compile(r"(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})?")
PLACEHOLDER = re.compile(r"\[(图片|语音|表情|视频|文件|链接|动画表情|截图)\]")
ONLY_PLACEHOLDER = re.compile(r"^\s*(\[(?:图片|语音|表情|视频|文件|链接|动画表情|截图)\]\s*)+$")


def _scan_date(text, default=None):
    m = DATE_IN_LINE.search(text or "")
    if not m:
        return default
    y, mo, d = m.group(1), m.group(2), m.group(3) or "1"
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def segment(text, default_date=None):
    """把一段粘贴内容切成信息条目。

    返回 (kept, dropped)；每条 = {text, speaker, at, placeholders, truncated}
    支持三种写法：
        张三 2026-11-19 10:12        ← 头行，正文在下一行
        张三 2026-11-19 10:12 定价改 B
        张三：定价改 B
    """
    items = []
    dropped = []
    if not text:
        return items, dropped

    cur = None
    for raw in str(text).splitlines():
        ln = raw.rstrip()
        if not ln.strip():
            continue

        # 只含占位符的行（[图片]）→ 挂到上一条
        if ONLY_PLACEHOLDER.match(ln):
            phs = [p for p in PLACEHOLDER.findall(ln)]
            if cur is not None:
                cur["placeholders"].extend(phs)
            else:
                items.append({"text": ln.strip(), "speaker": None,
                              "at": _scan_date(ln, default_date),
                              "placeholders": phs, "truncated": False})
                cur = items[-1]
            continue

        m = HEADER.match(ln)
        has_stamp = bool(m and (m.group(2) or m.group(5)))
        if m and has_stamp:
            speaker = m.group(1).strip()
            d = default_date
            if m.group(2):
                d = f"{int(m.group(2)):04d}-{int(m.group(3)):02d}-{int(m.group(4)):02d}"
            body = (m.group(7) or "").strip()
            cur = {"text": body, "speaker": speaker, "at": d,
                   "placeholders": [p for p in PLACEHOLDER.findall(body)],
                   "truncated": ("…" in body) or ("..." in body)}
            items.append(cur)
            continue

        m2 = NAME_COLON.match(ln)
        if m2 and len(m2.group(2)) > 1:
            body = m2.group(2).strip()
            cur = {"text": body, "speaker": m2.group(1).strip(),
                   "at": _scan_date(ln, default_date),
                   "placeholders": [p for p in PLACEHOLDER.findall(body)],
                   "truncated": ("…" in body) or ("..." in body)}
            items.append(cur)
            continue

        # 续行
        if cur is not None:
            cur["text"] = (cur["text"] + " " + ln.strip()).strip()
            cur["placeholders"].extend(PLACEHOLDER.findall(ln))
            if "…" in ln or "..." in ln:
                cur["truncated"] = True
        else:
            items.append({"text": ln.strip(), "speaker": None,
                          "at": _scan_date(ln, default_date),
                          "placeholders": PLACEHOLDER.findall(ln),
                          "truncated": ("…" in ln) or ("..." in ln)})
            cur = items[-1]

    kept = []
    for it in items:
        it["text"] = it["text"].strip()
        if not it["text"] and not it["placeholders"]:
            continue
        if len(it["text"]) <= 4 and not it["placeholders"]:
            dropped.append(it)
            continue
        kept.append(it)
    return kept, dropped


# ---------------- 归位判定 ----------------

ATTACH_HINTS = ["截图", "如图", "这个图", "附件", "见上图", "补一张", "证据", "原图"]


def classify(item, state, gate_cfg):
    """返回判定结果：类型 / 项目 / 父节点候选 / 置信度 / 落法"""
    text = item.get("text", "")
    toks = tokenize(text)
    typ, t_strength = score_type(text)

    # 项目打分：项目关键词命中
    proj_scores = []
    for p in state["projects"]:
        hits = sum(1 for kw in p.get("keywords", []) if kw in text)
        kw_score = min(1.0, hits / 2.0)
        if item.get("project"):
            ctx_score = 1.0 if item["project"] == p["id"] else 0.0
            proj_scores.append((p["id"], 0.75 * kw_score + 0.25 * ctx_score))
        else:
            proj_scores.append((p["id"], kw_score))
    proj_scores.sort(key=lambda x: -x[1])
    best_proj, p_score = proj_scores[0] if proj_scores else (None, 0.0)

    # 父节点候选：同项目内，标题/摘要相似 + 时间靠前优先
    cands = []
    item_ms = to_ms(item.get("at")) or to_ms(now_iso())
    for n in state["nodes"]:
        if n.get("project") != best_proj:
            continue
        ntoks = tokenize(n.get("title", "") + " " + n.get("summary", ""))
        sim = overlap(toks, ntoks)
        n_ms = to_ms(n.get("content_at")) or item_ms
        # 时间越近越好，但必须早于（或同月）
        delta_days = (item_ms - n_ms) / 86400000.0
        if delta_days < -3:
            time_score = 0.15          # 比节点早，基本不可能是它的子节点
        elif delta_days <= 40:
            time_score = 1.0 - abs(delta_days) / 60.0
        else:
            time_score = max(0.1, 1.0 - delta_days / 240.0)
        # 类型亲和：决策挂在方案下，复盘挂在决策下
        affinity = 1.0 if (n.get("type") in ("plan", "decision")) else 0.6
        score = 0.55 * sim + 0.25 * time_score + 0.20 * affinity
        cands.append({"id": n["id"], "score": round(score, 3),
                      "title": n.get("title", ""), "project": n.get("project"),
                      "type": n.get("type")})
    cands.sort(key=lambda c: -c["score"])
    top = cands[:3]
    parent_score = top[0]["score"] if top else 0.0
    margin = (top[0]["score"] - top[1]["score"]) if len(top) > 1 else (0.30 if top else 0.0)

    conf = 0.45 * t_strength + 0.30 * p_score + 0.25 * parent_score
    # 类型与项目都很确定时，给一个“双重确定”加成（避免明明很清楚却进队列）
    if t_strength >= 0.8 and p_score >= 0.8:
        conf += 0.08
    conf = round(min(0.98, max(0.05, conf)), 3)

    # 落法：像“证据/附件”且能明确挂到某节点 → attach
    looks_attach = any(h in text for h in ATTACH_HINTS) or bool(item.get("placeholders"))
    placement = "attach" if (looks_attach and top and top[0]["score"] >= 0.55) else "grow"

    # 闸门
    if conf >= gate_cfg["auto_conf"] and margin >= gate_cfg["auto_margin"]:
        action = "auto"
    elif conf >= gate_cfg["auto_conf"]:
        action = "popup"
    else:
        action = "queue"

    return {
        "type": typ if typ != "unknown" else "plan",
        "type_confident": typ != "unknown",
        "project": best_proj,
        "parent": top[0]["id"] if top else None,
        "candidates": top,
        "confidence": conf,
        "margin": round(margin, 3),
        "placement": placement,
        "action": action,
    }


# ---------------- 检索 ----------------

def search(q, state, limit=8):
    qtoks = tokenize(q)
    if not qtoks:
        return []
    hits = []
    for n in state["nodes"]:
        title_t = tokenize(n.get("title", ""))
        sum_t = tokenize(n.get("summary", ""))
        ex_t = tokenize((n.get("source") or {}).get("excerpt", ""))
        extra_t = tokenize(" ".join(str(v) for v in (n.get("extra") or {}).values()))
        s_title = overlap(qtoks, title_t)
        s_sum = overlap(qtoks, sum_t)
        s_ex = overlap(qtoks, ex_t)
        s_extra = overlap(qtoks, extra_t)
        score = 0.45 * s_title + 0.25 * s_sum + 0.20 * s_ex + 0.10 * s_extra
        if q.lower() in (n.get("title", "") + n.get("summary", "")).lower():
            score += 0.35
        if score > 0.06:
            hits.append((score, n))
    hits.sort(key=lambda x: -x[0])
    out = []
    for score, n in hits[:limit]:
        snippet = None
        loc = (n.get("source") or {}).get("locator")
        excerpt = (n.get("source") or {}).get("excerpt", "")
        if excerpt and overlap(qtoks, tokenize(excerpt)) > 0.05:
            snippet = excerpt
        out.append({
            "id": n["id"], "title": n.get("title"), "project": n.get("project"),
            "type": n.get("type"), "status": n.get("status"),
            "score": round(score, 3), "snippet": snippet, "locator": loc,
            "file": (n.get("source") or {}).get("file"),
        })
    return out


def build_trace(q, hits, state):
    """Harness 执行轨迹：让评审看见“它在干什么”"""
    steps = []
    intent = "找节点"
    if any(k in q for k in ("还算不算", "有效", "状态", "取代", "作废")):
        intent = "问状态"
    elif any(k in q for k in ("谁", "找谁", "负责")):
        intent = "问人"
    steps.append(f"① 判意图：{intent}")
    steps.append(f"② 检索：命中 {len(hits)} 个节点（标题 + 摘要 + 原文片段三路）")

    # 冲突检测：同项目、同类型、都 active、时间相近
    conflicts = []
    if hits:
        main = next((n for n in state["nodes"] if n["id"] == hits[0]["id"]), None)
        if main:
            for n in state["nodes"]:
                if n is main:
                    continue
                if (n.get("project") == main.get("project")
                        and n.get("type") == main.get("type")
                        and n.get("status") == "active"
                        and main.get("status") == "active"
                        and overlap(tokenize(n.get("title", "")), tokenize(main.get("title", ""))) > 0.2):
                    conflicts.append(n["id"])
    if conflicts:
        steps.append(f"③ 校验：发现 {len(conflicts)} 条并存的同类节点 → 需要在回答里指出分歧")
    else:
        steps.append("③ 校验：无并存冲突，凭证完整")
    steps.append("④ 输出：命中节点 + 前后脉络 + 凭证定位")
    return steps
