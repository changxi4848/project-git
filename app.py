# -*- coding: utf-8 -*-
"""项目Git · 本地服务（只用标准库，零依赖）

启动：python app.py  →  http://127.0.0.1:8765
"""
import os
import io
import json
import base64
import copy
import subprocess
import threading
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

import engine

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
FILES = os.path.join(DATA, "files")
WEB = os.path.join(BASE, "web")
STATE_PATH = os.path.join(DATA, "state.json")

GATE = {"auto_conf": 0.68, "auto_margin": 0.10}

_lock = threading.Lock()
state = {}
_undo = []
_redo = []


def load():
    global state
    with open(STATE_PATH, encoding="utf-8") as f:
        state = json.load(f)


def save():
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
    os.replace(tmp, STATE_PATH)


def snapshot():
    _undo.append(json.dumps({"nodes": state["nodes"], "edges": state["edges"]}, ensure_ascii=False))
    if len(_undo) > 60:
        _undo.pop(0)
    _redo.clear()


def node_by_id(nid):
    return next((n for n in state["nodes"] if n["id"] == nid), None)


def next_id(prefix="n"):
    i = len(state["nodes"]) + 1
    while node_by_id(f"{prefix}_{i}"):
        i += 1
    return f"{prefix}_{i}"


# ---------------- 业务操作 ----------------

def op_capture(payload):
    text = payload.get("text", "")
    default_date = payload.get("date") or engine.now_iso()
    kept, dropped = engine.segment(text, default_date)

    results = []
    for it in kept:
        cls = engine.classify(it, state, GATE)
        item = {
            "id": "it_" + str(abs(hash(it["text"])) % 100000),
            "text": it["text"], "at": it.get("at") or default_date,
            "speaker": it.get("speaker"), "placeholders": it.get("placeholders", []),
            "truncated": it.get("truncated", False),
            "cls": cls,
        }
        # 自动挂的，直接落库
        if cls["action"] == "auto":
            nid = create_node(item, cls, cls["parent"], cls["type"], cls["project"], cls["placement"])
            item["node_id"] = nid
            item["committed"] = True
        elif cls["action"] == "queue":
            state["queue"].append({k: item[k] for k in ("id", "text", "at", "speaker", "cls")})
            item["committed"] = False
        results.append(item)

    save()
    return {"items": results, "dropped": dropped,
            "stats": {"kept": len(kept), "dropped": len(dropped)}}


def create_node(item, cls, parent, typ, project, placement):
    nid = next_id("n")
    title = item["text"][:26].replace("\n", " ").strip()
    if len(item["text"]) > 26:
        title += "…"
    extra = {}
    fields = (next((t for t in state["types"] if t["id"] == typ), {}) or {}).get("fields", [])
    for f in fields:
        k = f["key"]
        if "负责" in k:
            extra[k] = item.get("speaker") or "张伟"
        elif "时间" in k or "日" in k:
            extra[k] = item.get("at", "")[:10]
        elif f.get("required"):
            extra[k] = item["text"][:60]
    node = {
        "id": nid, "project": project, "type": typ, "title": title,
        "summary": item["text"][:80],
        "content_at": (item.get("at") or engine.now_iso())[:10],
        "ingest_at": engine.now_iso(), "status": "active",
        "confidence": cls["confidence"], "auto": True, "placement": placement,
        "source": {"file": None,
                   "locator": None,
                   "excerpt": item["text"]},
        "extra": extra, "parent": parent,
    }
    state["nodes"].append(node)
    if parent:
        kind = "attach" if placement == "attach" else "derived"
        state["edges"].append({"from": nid, "to": parent, "kind": kind})
    return nid


def op_place(payload):
    """人工确认归位：popup 里选了某个候选，或指定新节点"""
    snapshot()
    it = payload["item"]
    cls = it.get("cls") or {}
    target = payload.get("parent")
    project = payload.get("project") or cls.get("project") or (state["projects"][0]["id"])
    typ = payload.get("type") or cls.get("type") or "plan"
    placement = payload.get("placement") or cls.get("placement") or "grow"

    if payload.get("new_node_title"):
        it = dict(it)
        it["text"] = payload["new_node_title"] + " " + it.get("text", "")
    nid = create_node(it, {"confidence": payload.get("confidence", 0.8)}, target, typ, project, placement)
    # 从队列里移除
    state["queue"] = [q for q in state["queue"] if q.get("id") != it.get("id")]
    # 记成 few-shot
    state["choices"].append({"text": it.get("text", "")[:120], "project": project,
                             "type": typ, "parent": target, "at": engine.now_iso()})
    save()
    return {"node_id": nid}


def op_edit(payload):
    snapshot()
    op = payload.get("op")
    nid = payload.get("id")
    n = node_by_id(nid)

    if op == "reparent" and n:
        newp = payload.get("parent")
        state["edges"] = [e for e in state["edges"] if not (e["from"] == nid and e["kind"] in ("derived", "attach"))]
        if newp:
            state["edges"].append({"from": nid, "to": newp, "kind": "derived"})
        n["parent"] = newp

    elif op == "retype" and n:
        n["type"] = payload.get("type", n["type"])

    elif op == "supersede" and n:
        old = payload.get("old")
        state["edges"].append({"from": nid, "to": old, "kind": "supersedes"})
        o = node_by_id(old)
        if o:
            o["status"] = "superseded"

    elif op == "delete" and n:
        n["status"] = "deleted"

    elif op == "status" and n:
        n["status"] = payload.get("status", n["status"])

    elif op == "title" and n:
        n["title"] = payload.get("title", n["title"])

    state["edits"].append({"op": op, "id": nid, "at": engine.now_iso(),
                           "payload": {k: v for k, v in payload.items() if k != "item"}})
    save()
    return {"ok": True}


def op_undo(_payload=None):
    global state
    if not _undo:
        return {"ok": False}
    _redo.append(json.dumps({"nodes": state["nodes"], "edges": state["edges"]}, ensure_ascii=False))
    s = json.loads(_undo.pop())
    state["nodes"], state["edges"] = s["nodes"], s["edges"]
    save()
    return {"ok": True}


def op_redo(_payload=None):
    if not _redo:
        return {"ok": False}
    _undo.append(json.dumps({"nodes": state["nodes"], "edges": state["edges"]}, ensure_ascii=False))
    s = json.loads(_redo.pop())
    state["nodes"], state["edges"] = s["nodes"], s["edges"]
    save()
    return {"ok": True}


def op_type(payload):
    snapshot()
    tid = "t_" + str(len(state["types"]) + 1)
    t = {"id": tid, "name": payload["name"], "color": payload.get("color", "#8A99A5"),
         "icon": payload.get("icon", "◇"), "fields": payload.get("fields", [])}
    state["types"].append(t)
    save()
    return {"type": t}


def op_git(payload):
    repo = payload.get("path") or os.path.join(DATA, "demo-repo")
    if not os.path.isdir(os.path.join(repo, ".git")):
        return {"error": "not a git repo: " + repo}
    snapshot()

    fmt = "%H\x1f%P\x1f%an\x1f%aI\x1f%s\x1e"
    r = subprocess.run(["git", "log", "--all", "--date=iso-strict",
                        "--pretty=format:" + fmt],
                       cwd=repo, capture_output=True, text=True,
                       encoding="utf-8", errors="ignore")
    if r.returncode != 0:
        return {"error": r.stderr[:200]}

    proj = next((p for p in state["projects"] if p["id"] == "p_code"), None)
    if not proj:
        proj = {"id": "p_code", "name": "code · 定价服务", "lane": 3, "color": "#8A99A5",
                "keywords": ["commit", "merge", "发布", "版本"]}
        state["projects"].append(proj)

    added = 0
    sha_map = {}
    for rec in r.stdout.split("\x1e"):
        rec = rec.strip()
        if not rec:
            continue
        parts = rec.split("\x1f")
        if len(parts) < 5:
            continue
        sha, parents, author, date, subject = parts[0], parts[1].split(), parts[2], parts[3], parts[4]
        nid = "g_" + sha[:7]
        sha_map[sha] = nid
        if node_by_id(nid):
            continue
        stat = subprocess.run(["git", "show", "--stat", "--oneline", "--format=%H", sha],
                              cwd=repo, capture_output=True, text=True,
                              encoding="utf-8", errors="ignore").stdout
        last = [ln for ln in stat.strip().splitlines() if "|" in ln]
        summary = f"{len(last)} 个文件变更" if last else "无文件变更"
        state["nodes"].append({
            "id": nid, "project": "p_code", "type": "version",
            "title": subject[:40], "summary": summary,
            "content_at": date[:10], "ingest_at": engine.now_iso(),
            "status": "active", "confidence": 1.0, "auto": False, "placement": "grow",
            "source": {"file": None, "locator": None, "excerpt": subject},
            "extra": {"发布号": sha[:7], "改动": summary},
            "parent": None, "_parents": parents,
        })
        added += 1

    # 建边（父提交可能在上一轮已存在）
    for n in list(state["nodes"]):
        if n["id"].startswith("g_") and n.get("_parents"):
            pid = n["_parents"][0]
            if pid in sha_map:
                if not any(e["from"] == n["id"] and e["to"] == sha_map[pid] for e in state["edges"]):
                    state["edges"].append({"from": n["id"], "to": sha_map[pid], "kind": "derived"})
            if len(n["_parents"]) > 1:
                for p2 in n["_parents"][1:]:
                    if p2 in sha_map:
                        state["edges"].append({"from": n["id"], "to": sha_map[p2], "kind": "derived"})
            n["parent"] = sha_map.get(n["_parents"][0])

    tags = subprocess.run(["git", "tag", "--list", "--format=%(refname:short)|%(creatordate:iso)"],
                          cwd=repo, capture_output=True, text=True,
                          encoding="utf-8", errors="ignore").stdout.strip()
    for line in tags.splitlines():
        if "|" not in line:
            continue
        name, created = line.split("|", 1)
        tid = "tag_" + name
        if node_by_id(tid):
            continue
        state["nodes"].append({
            "id": tid, "project": "p_code", "type": "version",
            "title": f"tag {name}", "summary": "发布里程碑",
            "content_at": created[:10], "ingest_at": engine.now_iso(),
            "status": "active", "confidence": 1.0, "auto": False, "placement": "grow",
            "source": {"file": None, "locator": None, "excerpt": "tag " + name},
            "extra": {"发布号": name, "改动": "发布"}, "parent": None,
        })
        added += 1

    state["meta"]["git_synced"] = True
    state["meta"]["git_repo"] = repo
    save()
    return {"added": added, "total": len([n for n in state["nodes"] if n["project"] == "p_code"])}


def op_search(q):
    hits = engine.search(q, state)
    trace = engine.build_trace(q, hits, state)
    neighbors = []
    if hits:
        main = hits[0]["id"]
        for e in state["edges"]:
            if e["from"] == main:
                neighbors.append(e["to"])
            elif e["to"] == main:
                neighbors.append(e["from"])
    return {"hits": hits, "trace": trace, "neighbors": list(dict.fromkeys(neighbors))}


def op_file(nid):
    n = node_by_id(nid)
    if not n or not n.get("source") or not n["source"].get("file"):
        return {"error": "该节点没有关联文件"}
    name = n["source"]["file"]
    path = os.path.join(FILES, name)
    if not os.path.exists(path):
        return {"error": "文件不存在：" + name}
    loc = n["source"].get("locator") or {}
    if loc.get("kind") == "pdf":
        try:
            import fitz
            d = fitz.open(path)
            page_no = max(0, int(loc.get("page", 1)) - 1)
            page = d[page_no]
            rects = []
            if loc.get("rect"):
                r = loc["rect"]
                rects.append(fitz.Rect(r[0], r[1], r[2], r[3]))
            for rc in rects:
                page.draw_rect(rc, color=(0.71, 0.28, 0.25), width=2, fill=(1, 0.9, 0.9))
            pix = page.get_pixmap(dpi=110)
            b64 = base64.b64encode(pix.tobytes("png")).decode()
            return {"kind": "pdf", "name": name, "page": loc.get("page", 1),
                    "image": "data:image/png;base64," + b64,
                    "total_pages": d.page_count}
        except Exception as e:
            return {"kind": "text", "name": name, "text": "（PDF 渲染失败：%s）" % e}
    with open(path, encoding="utf-8", errors="ignore") as f:
        content = f.read()
    return {"kind": "text", "name": name, "text": content,
            "start": loc.get("start"), "end": loc.get("end")}


ROUTES = {
    "/api/capture": op_capture,
    "/api/place": op_place,
    "/api/edit": op_edit,
    "/api/undo": op_undo,
    "/api/redo": op_redo,
    "/api/type": op_type,
    "/api/git": op_git,
}


class Handler(BaseHTTPRequestHandler):
    server_version = "ProjectGit/1.0"

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else str(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def do_GET(self):
        u = urlparse(self.path)
        p = u.path
        qs = parse_qs(u.query)
        try:
            if p == "/api/state":
                return self._json({"projects": state["projects"], "types": state["types"],
                                   "nodes": [n for n in state["nodes"] if n.get("status") != "deleted"],
                                   "edges": state["edges"], "queue": state["queue"],
                                   "choices": state["choices"], "meta": state.get("meta", {})})
            if p == "/api/search":
                return self._json(op_search((qs.get("q") or [""])[0]))
            if p == "/api/file":
                return self._json(op_file((qs.get("node") or [""])[0]))
            if p.startswith("/api/static/"):
                name = unquote(p[len("/api/static/"):])
                full = os.path.join(FILES, os.path.basename(name))
                if not os.path.exists(full):
                    return self._json({"error": "not found"}, 404)
                with open(full, "rb") as f:
                    return self._send(200, f.read(), "application/octet-stream")
            # 静态文件
            if p == "/":
                p = "/index.html"
            full = os.path.join(WEB, os.path.basename(p))
            if not os.path.exists(full):
                return self._send(404, "not found", "text/plain; charset=utf-8")
            ctype = {"html": "text/html; charset=utf-8", "js": "application/javascript; charset=utf-8",
                     "css": "text/css; charset=utf-8", "png": "image/png", "svg": "image/svg+xml"}.get(
                full.rsplit(".", 1)[-1], "application/octet-stream")
            with open(full, "rb") as f:
                return self._send(200, f.read(), ctype)
        except Exception as e:
            return self._json({"error": repr(e)}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            payload = {}
        fn = ROUTES.get(u.path)
        if not fn:
            return self._json({"error": "no route"}, 404)
        try:
            with _lock:
                if u.path in ("/api/capture", "/api/place", "/api/edit", "/api/type", "/api/git"):
                    snapshot()
                return self._json(fn(payload))
        except Exception as e:
            return self._json({"error": repr(e)}, 500)


def main():
    load()
    port = int(os.environ.get("PORT", "8765"))
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("项目Git 已启动： http://127.0.0.1:%d" % port)
    srv.serve_forever()


if __name__ == "__main__":
    main()
