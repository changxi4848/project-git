import io, re

p = "D:/03_code_list/project-git-项目知识时间轴/engine.py"
s = io.open(p, encoding="utf-8").read()

start = s.index("SPEAKER_TIME = re.compile(")
end = s.index("# ---------------- 归位判定 ----------------")
new_block = '''HEADER = re.compile(
    r"^\\s*([^\\s:：]{1,14})\\s+"            # 说话人
    r"(?:(20\\d{2})[-/](\\d{1,2})[-/](\\d{1,2}))?\\s*"  # 可选日期
    r"(?:(\\d{1,2}):(\\d{2}))?\\s*"          # 可选时间
    r"[：:]?\\s*(.*)$"                      # 正文（可为空）
)
NAME_COLON = re.compile(r"^\\s*([^\\s:：]{1,14})[：:]\\s*(.+)$")
DATE_IN_LINE = re.compile(r"(20\\d{2})[-/年](\\d{1,2})[-/月](\\d{1,2})?")
PLACEHOLDER = re.compile(r"\\[(图片|语音|表情|视频|文件|链接|动画表情|截图)\\]")
ONLY_PLACEHOLDER = re.compile(r"^\\s*(\\[(?:图片|语音|表情|视频|文件|链接|动画表情|截图)\\]\\s*)+$")


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
        has_stamp = bool(m and (m.group(2) or m.group(4)))
        if m and has_stamp:
            speaker = m.group(1).strip()
            d = default_date
            if m.group(2):
                d = f"{int(m.group(2)):04d}-{int(m.group(3)):02d}-{int(m.group(4)):02d}"
            body = (m.group(6) or "").strip()
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


'''

s = s[:start] + new_block + s[end:]

# 项目打分修正：没有显式上下文时，用关键词分归一化到 1.0
old = """        ctx_score = 0.0
        if item.get("project"):
            ctx_score = 1.0 if item["project"] == p["id"] else 0.0
        proj_scores.append((p["id"], 0.65 * kw_score + 0.35 * ctx_score))"""
new = """        if item.get("project"):
            ctx_score = 1.0 if item["project"] == p["id"] else 0.0
            proj_scores.append((p["id"], 0.75 * kw_score + 0.25 * ctx_score))
        else:
            proj_scores.append((p["id"], kw_score))"""
assert old in s
s = s.replace(old, new)

io.open(p, "w", encoding="utf-8").write(s)
print("engine patched")
