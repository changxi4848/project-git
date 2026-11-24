# -*- coding: utf-8 -*-
"""自检：每个「资料 / 数据 / 代码」节点是否都有真实存在、能打开的原始文件

检查项：
  1. source.file 是否存在（缺 source、文件不在 data/files/ 里都算缺文件）
  2. excerpt 是否为空，是否是原文里的连续子串
  3. locator.start/end 是否精确指向 excerpt（0-based，end 开区间）

用法：
    PYTHONUTF8=1 python tools/check_sources.py
    PYTHONUTF8=1 python tools/check_sources.py data/state.json
    PYTHONUTF8=1 python tools/check_sources.py desktop/seed/state.json

退出码：0 = 全部通过；1 = 有问题（清单见输出）
"""
import io
import json
import os
import sys

# 二进制格式只校验「文件存在」，不校验 excerpt 是否为文本子串
BINARY_EXT = ('.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.zip')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FILES_DIR = os.path.join(DATA, "files")
DEFAULT_STATE = os.path.join(DATA, "state.json")

NEED_TYPES = ("doc", "data", "code")
TYPE_NAME = {"doc": "资料", "data": "数据", "code": "代码"}


def load_state(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def read_text(name):
    p = os.path.join(FILES_DIR, name)
    if not os.path.exists(p):
        return None, None
    raw = open(p, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    return raw.decode("utf-8", errors="replace"), bom


def check(state):
    missing = []      # 缺文件（无 source / 文件不存在）
    broken = []       # 有文件但摘录对不上
    bom_files = []
    used = {}
    nodes = state.get("nodes", [])
    targets = [n for n in nodes if n.get("type") in NEED_TYPES]

    for n in targets:
        nid = n.get("id")
        title = n.get("title", "")
        typ = n.get("type")
        src = n.get("source") or {}
        fname = src.get("file")
        excerpt = src.get("excerpt") or ""
        loc = src.get("locator") or {}

        if not fname:
            missing.append((nid, typ, title, "没有 source.file"))
            continue

        text, bom = read_text(fname)
        if text is None:
            missing.append((nid, typ, title, "文件不存在：%s" % fname))
            continue
        used[fname] = used.get(fname, 0) + 1
        if bom:
            bom_files.append(fname)

        if str(src.get('file','')).lower().endswith(BINARY_EXT):
            continue
        if not excerpt:
            broken.append((nid, typ, title, fname, "excerpt 为空"))
            continue

        at = text.find(excerpt)
        if at < 0:
            broken.append((nid, typ, title, fname, "excerpt 不是原文的子串"))
            continue

        kind = loc.get("kind")
        if kind in (None, "text"):
            s = loc.get("start")
            e = loc.get("end")
            if not isinstance(s, int) or not isinstance(e, int):
                broken.append((nid, typ, title, fname, "locator 缺 start/end"))
            elif e - s != len(excerpt):
                broken.append((nid, typ, title, fname,
                               "start/end 长度不对：end-start=%d，excerpt=%d 字"
                               % (e - s, len(excerpt))))
            elif text[s:e] != excerpt:
                broken.append((nid, typ, title, fname,
                               "start/end 偏移对不上（实际在 %d，记录 %d）" % (at, s)))

    return {
        "targets": targets,
        "missing": missing,
        "broken": broken,
        "bom": sorted(set(bom_files)),
        "used": used,
    }


def main():
    state_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_STATE
    if not os.path.isabs(state_path):
        state_path = os.path.join(ROOT, state_path)
    if not os.path.exists(state_path):
        print("找不到 state 文件：%s" % state_path)
        return 1

    state = load_state(state_path)
    r = check(state)
    try:
        rel = os.path.relpath(state_path, ROOT)
    except ValueError:          # state 在别的盘上时 relpath 会抛错
        rel = state_path

    print("=" * 68)
    print("原文自检 ·%s" % (" " + rel))
    print("=" * 68)
    n_files = 0
    if os.path.isdir(FILES_DIR):
        n_files = len([f for f in os.listdir(FILES_DIR)
                       if os.path.isfile(os.path.join(FILES_DIR, f))])
    print("节点总数        : %d" % len(state.get("nodes", [])))
    print("资料/数据/代码  : %d 个" % len(r["targets"]))
    print("引用原文文件    : %d 份" % len(r["used"]))
    print("data/files/ 文件: %d 个" % n_files)
    print("")

    if r["missing"]:
        print("缺文件的条目（%d 条）：" % len(r["missing"]))
        for nid, typ, title, why in r["missing"]:
            print("  ✗ %-6s %-4s %-22s %s" % (nid, TYPE_NAME.get(typ, typ), title, why))
    else:
        print("缺文件的条目：0（空）")

    if r["broken"]:
        print("")
        print("摘录/偏移对不上的条目（%d 条）：" % len(r["broken"]))
        for nid, typ, title, fname, why in r["broken"]:
            print("  ! %-6s %-4s %-22s %s ← %s"
                  % (nid, TYPE_NAME.get(typ, typ), title, why, fname))

    if r["bom"]:
        print("")
        print("带 BOM 的原文（会导致首字符匹配失败）：")
        for f in r["bom"]:
            print("  ! %s" % f)

    print("")
    ok = not r["missing"] and not r["broken"] and not r["bom"]
    if ok:
        print("结论：通过 —— 所有资料/数据/代码条目都有真实存在的原文，"
              "excerpt 与 locator 一致。")
        return 0
    print("结论：未通过 —— 缺文件 %d 条，摘录/偏移问题 %d 条。"
          % (len(r["missing"]), len(r["broken"])))
    return 1


if __name__ == "__main__":
    sys.exit(main())
