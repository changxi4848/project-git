/* 项目Git · 前端（无框架） */
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };

const S = { projects: [], types: [], nodes: [], edges: [], queue: [], choices: [], meta: {} };
const cam = { x: 90, y: 70, s: 1 };
const L = { nodes: [], lanes: [], t0: 0, t1: 1, W: 2400 };
const NODE_W = 176, NODE_H = 54, ROW_GAP = 14, LANE_PAD = 30, GUTTER = 190;

let canvas, ctx, mini, mctx, DPR = 1;
let editMode = false, highlight = new Set(), focusId = null;
let drag = null, panning = null, preview = null, supersedePick = null;
let anim = null, hoverId = null, lastSearch = null, DEMO = false;

/* ---------------- 工具 ---------------- */
const fmtDate = (s) => (s || "").slice(5, 10).replace("-", "-");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function typeOf(id) { return S.types.find(t => t.id === id) || { name: id, color: "#8A99A5", icon: "◇" }; }
function projectOf(id) { return S.projects.find(p => p.id === id) || { name: id, color: "#8A99A5" }; }
function ms(s) { const t = Date.parse((s || "").length <= 7 ? s + "-01" : s.replace("T", " ")); return isNaN(t) ? null : t; }

function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.add("hidden"), ms);
}
async function api(path, body) {
  const opt = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
  const r = await fetch(path, opt);
  return await r.json();
}

/* ---------------- 数据 ---------------- */
async function loadState() {
  const d = await api("/api/state");
  S.projects = d.projects; S.types = d.types; S.nodes = d.nodes;
  S.edges = d.edges; S.queue = d.queue || []; S.choices = d.choices || []; S.meta = d.meta || {};
  $("#stat-nodes").textContent = S.nodes.length;
  $("#stat-projects").textContent = S.projects.length;
  const qc = $("#queue-count");
  qc.textContent = S.queue.length;
  $("#btn-queue").classList.toggle("has", S.queue.length > 0);
  const sel = $("#filter-type");
  sel.innerHTML = '<option value="">全部类型</option>' +
    S.types.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
}

/* ---------------- 布局 ---------------- */
function computeLayout() {
  const withT = S.nodes.map(n => ({ n, t: ms(n.content_at) ?? Date.now() }));
  L.t0 = Math.min(...withT.map(o => o.t));
  L.t1 = Math.max(...withT.map(o => o.t));
  if (L.t1 - L.t0 < 86400000 * 30) L.t1 = L.t0 + 86400000 * 30;
  const padL = GUTTER + 20, padR = 40;
  const span = L.t1 - L.t0;
  const xOf = (t) => padL + ((t - L.t0) / span) * (L.W - padL - padR - NODE_W);

  const projs = [...S.projects].sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0));
  let y = 24;
  L.lanes = []; L.nodes = [];
  for (const p of projs) {
    const list = withT.filter(o => o.n.project === p.id).sort((a, b) => a.t - b.t);
    const rows = [];  // 每行的最后一个 x
    const placed = [];
    for (const o of list) {
      const x = xOf(o.t);
      let r = 0;
      while (rows[r] != null && x < rows[r] + ROW_GAP) r++;
      rows[r] = x + NODE_W;
      placed.push({ o, x, row: r });
    }
    const rowCount = Math.max(1, rows.length);
    const h = rowCount * (NODE_H + ROW_GAP) + LANE_PAD;
    L.lanes.push({ id: p.id, name: p.name, color: p.color, y, h, rows: rowCount });
    for (const it of placed) {
      L.nodes.push({ n: it.o.n, x: it.x, y: y + LANE_PAD / 2 + it.row * (NODE_H + ROW_GAP), t: it.o.t });
    }
    y += h + 14;
  }
  L.H = y + 40;
}
const nodeBox = (id) => L.nodes.find(o => o.n.id === id);

/* ---------------- 绘制 ---------------- */
function resize() {
  DPR = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * DPR; canvas.height = h * DPR;
  mini.width = 148 * DPR; mini.height = 90 * DPR;
  mini.style.width = "148px"; mini.style.height = "90px";
  draw();
}
function clampCam() {
  cam.x = Math.max(GUTTER - 6, cam.x);
  cam.y = Math.max(10, cam.y);
}
function toScreen(wx, wy) { return [wx * cam.s + cam.x, wy * cam.s + cam.y]; }
function toWorld(sx, sy) { return [(sx - cam.x) / cam.s, (sy - cam.y) / cam.s]; }

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function draw() {
  if (!ctx) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const ft = $("#filter-type").value, fs = $("#filter-status").value;
  const visible = (n) => (!ft || n.type === ft) && (!fs || n.status === fs) && n.status !== "deleted";

  // 时间网格
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);
  const months = [];
  const d0 = new Date(L.t0);
  let cur = new Date(d0.getFullYear(), d0.getMonth(), 1);
  while (cur.getTime() <= L.t1) { months.push(cur.getTime()); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
  const span = L.t1 - L.t0;
  for (const t of months) {
    if (t < L.t0) continue;
    const x = GUTTER + 20 + ((t - L.t0) / span) * (L.W - GUTTER - 60 - NODE_W);
    ctx.strokeStyle = "#eef3f6"; ctx.lineWidth = 1 / cam.s;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, L.H); ctx.stroke();
  }
  // 泳道
  for (const ln of L.lanes) {
    ctx.fillStyle = "rgba(246,250,252,.75)";
    ctx.fillRect(0, ln.y, L.W, ln.h);
    ctx.strokeStyle = "#e8eff3"; ctx.lineWidth = 1 / cam.s;
    ctx.beginPath(); ctx.moveTo(0, ln.y + ln.h); ctx.lineTo(L.W, ln.y + ln.h); ctx.stroke();
  }
  ctx.restore();

  // —— 以下进入相机坐标系 ——
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);

  // 边
  const edges = S.edges.filter(e => {
    const a = nodeBox(e.from), b = nodeBox(e.to);
    return a && b && visible(a.n) && visible(b.n);
  });
  for (const e of edges) drawEdge(e);

  // 节点
  for (const o of L.nodes) {
    if (!visible(o.n)) continue;
    drawNode(o);
  }

  ctx.restore();

  // 泳道名（世界坐标，独立栏位，不压节点）
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);
  for (const ln of L.lanes) {
    ctx.fillStyle = "#fbfcfd";
    ctx.fillRect(0, ln.y, GUTTER - 14, ln.h);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3c4f5c";
    ctx.font = "600 12.5px 'Microsoft YaHei',sans-serif";
    const nm = ln.name.length > 10 ? ln.name.slice(0, 10) + "…" : ln.name;
    ctx.fillText(nm, 14, ln.y + Math.min(24, ln.h / 2));
    ctx.fillStyle = "#93a4b0";
    ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
    ctx.fillText(ln.rows + " 行", 14, ln.y + Math.min(42, ln.h / 2 + 16));
  }
  ctx.strokeStyle = "#e3ebf0"; ctx.lineWidth = 1 / cam.s;
  ctx.beginPath(); ctx.moveTo(GUTTER - 14, 0); ctx.lineTo(GUTTER - 14, L.H); ctx.stroke();
  ctx.restore();

  // 时间刻度（屏幕坐标）
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "#8ea0ac"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
  ctx.textBaseline = "top";
  for (const t of months) {
    if (t < L.t0) continue;
    const [sx] = toScreen(GUTTER + 20 + ((t - L.t0) / span) * (L.W - GUTTER - 60 - NODE_W), 0);
    if (sx < GUTTER || sx > W - 10) continue;
    const d = new Date(t);
    ctx.fillText(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, sx + 4, 12);
  }
  ctx.restore();

  drawMinimap();
}

function drawEdge(e) {
  const a = nodeBox(e.from), b = nodeBox(e.to);
  if (!a || !b) return;
  const ax = a.x + NODE_W, ay = a.y + NODE_H / 2;   // 子节点右侧
  const bx = b.x, by = b.y + NODE_H / 2;            // 父节点左侧
  let x1 = ax, x2 = bx;
  if (bx > ax) { x1 = a.x; x2 = b.x + NODE_W; }     // 父在右，反向画
  const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
  const c1 = [x1 + (x2 > x1 ? dx : -dx), ay];
  const c2 = [x2 - (x2 > x1 ? dx : -dx), by];

  let color = "#a8b7c3", w = 1.2, dash = null, head = 7;
  if (e.kind === "supersedes") { color = "#b5473f"; w = 2.4; head = 11; }
  else if (e.kind === "relates") { color = "#b6c2cb"; dash = [4, 4]; w = 1; }
  else if (e.kind === "attach") { color = "#1b6e8c"; dash = [2, 3]; w = 1.4; }

  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, ay);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x2, by);
  ctx.stroke();
  ctx.setLineDash([]);
  // 箭头
  const ang = Math.atan2(by - c2[1], x2 - c2[0]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, by);
  ctx.lineTo(x2 - head * Math.cos(ang - 0.4), by - head * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - head * Math.cos(ang + 0.4), by - head * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();

  if (e.kind === "supersedes") {
    ctx.fillStyle = "#b5473f"; ctx.font = "10px 'Microsoft YaHei',sans-serif";
    ctx.fillText("取代", (x1 + x2) / 2 - 10, (ay + by) / 2 - 6);
  }
  ctx.restore();
}

function drawNode(o) {
  const n = o.n, t = typeOf(n.type);
  const sup = n.status === "superseded";
  const color = sup ? "#b9c4cc" : t.color;
  const isHot = highlight.has(n.id) || focusId === n.id;
  const lod = cam.s;

  if (isHot) {
    for (const [k, a] of [[10, .10], [7, .16], [4, .26]]) {
      ctx.fillStyle = color; ctx.globalAlpha = a;
      roundRect(ctx, o.x - k, o.y - k, NODE_W + k * 2, NODE_H + k * 2, 10 + k);
      ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  ctx.save();
  ctx.shadowColor = "rgba(18,59,79,.10)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  roundRect(ctx, o.x, o.y, NODE_W, NODE_H, 8);
  ctx.fillStyle = sup ? "#f3f5f7" : "#ffffff";
  ctx.fill();
  ctx.restore();

  roundRect(ctx, o.x, o.y, NODE_W, NODE_H, 8);
  ctx.strokeStyle = color; ctx.lineWidth = isHot ? 2.2 : 1.1;
  if (n.status === "draft") ctx.setLineDash([5, 4]);
  ctx.stroke(); ctx.setLineDash([]);

  // 左色条
  ctx.fillStyle = color;
  roundRect(ctx, o.x + 1, o.y + 8, 3.5, NODE_H - 16, 2); ctx.fill();

  if (lod < 0.22) {   // 极小比例才退化成点
    ctx.beginPath(); ctx.arc(o.x + NODE_W / 2, o.y + NODE_H / 2, 5, 0, 7); ctx.fillStyle = color; ctx.fill();
    return;
  }

  ctx.textBaseline = "top";
  ctx.fillStyle = sup ? "#98a5ae" : "#16232c";
  ctx.font = "600 12px 'Microsoft YaHei',sans-serif";
  let title = n.title || "";
  while (ctx.measureText(title).width > NODE_W - 26 && title.length > 4) title = title.slice(0, -1);
  if (title !== n.title) title = title.slice(0, -1) + "…";
  ctx.fillText(title, o.x + 12, o.y + 9);

  ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
  ctx.fillStyle = "#8394a1";
  const sub = `${t.name} · ${fmtDate(n.content_at)}`;
  ctx.fillText(sub, o.x + 12, o.y + 30);

  if (n.auto) {
    ctx.fillStyle = "#e8f1f5"; roundRect(ctx, o.x + NODE_W - 34, o.y + 6, 26, 14, 4); ctx.fill();
    ctx.fillStyle = "#1b6e8c"; ctx.font = "9px 'Microsoft YaHei',sans-serif";
    ctx.fillText("AI", o.x + NODE_W - 27, o.y + 8.5);
  }
  if (n.placement === "attach") {
    ctx.fillStyle = "#1b6e8c"; ctx.font = "10px sans-serif";
    ctx.fillText("⊕", o.x + NODE_W - 20, o.y + 28);
  }
  if (sup) {
    ctx.strokeStyle = "#b9c4cc"; ctx.beginPath();
    ctx.moveTo(o.x + 12, o.y + 18); ctx.lineTo(o.x + NODE_W - 12, o.y + 18); ctx.stroke();
  }
}

function drawMinimap() {
  const W = mini.width / DPR, H = mini.height / DPR;
  mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = "#f7fafc"; mctx.fillRect(0, 0, W, H);
  const sx = W / L.W, sy = H / L.H;
  for (const ln of L.lanes) {
    mctx.fillStyle = "rgba(0,0,0,.03)";
    mctx.fillRect(0, ln.y * sy, W, ln.h * sy);
  }
  for (const o of L.nodes) {
    mctx.fillStyle = o.n.status === "superseded" ? "#c9d3da" : typeOf(o.n.type).color;
    mctx.fillRect(o.x * sx, o.y * sy, Math.max(2, NODE_W * sx), Math.max(1.5, NODE_H * sy));
  }
  // 视口
  const vx = (-cam.x / cam.s) * sx, vy = (-cam.y / cam.s) * sy;
  const vw = (canvas.clientWidth / cam.s) * sx, vh = (canvas.clientHeight / cam.s) * sy;
  mctx.strokeStyle = "#1b6e8c"; mctx.lineWidth = 1.2;
  mctx.strokeRect(vx, vy, vw, vh);
}

/* ---------------- 相机 ---------------- */
function flyTo(wx, wy, s, dur = 400) {
  const drawerOpen = !document.getElementById("drawer").classList.contains("hidden");
  const cx = drawerOpen ? (canvas.clientWidth - 340) / 2 : canvas.clientWidth / 2;
  const target = { x: cx - wx * s, y: canvas.clientHeight / 2 - wy * s, s };
  const from = { x: cam.x, y: cam.y, s: cam.s };
  const t0 = performance.now();
  if (anim) cancelAnimationFrame(anim);
  const step = (now) => {
    const k = clamp((now - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    cam.x = from.x + (target.x - from.x) * e;
    cam.y = from.y + (target.y - from.y) * e;
    cam.s = from.s + (target.s - from.s) * e;
    draw();
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

/* ---------------- 交互 ---------------- */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = L.nodes.length - 1; i >= 0; i--) {
    const o = L.nodes[i];
    if (wx >= o.x && wx <= o.x + NODE_W && wy >= o.y && wy <= o.y + NODE_H) return o;
  }
  return null;
}

function bindCanvas() {
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0012);
    const ns = clamp(cam.s * k, 0.18, 3);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.s = ns;
    cam.x = e.offsetX - wx * ns;
    cam.y = e.offsetY - wy * ns;
    clampCam(); draw();
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => {
    const o = pick(e.offsetX, e.offsetY);
    if (editMode && o) { drag = { id: o.n.id, moved: false }; canvas.classList.add("dragging"); return; }
    if (o && supersedePick) {
      applyEdit({ op: "supersede", id: supersedePick, old: o.n.id });
      supersedePick = null; canvas.classList.remove("edit"); toast("已标记取代");
      return;
    }
    if (o) { selectNode(o.n.id); return; }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
    canvas.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; clampCam(); draw(); return; }
    if (drag) {
      const o = pick(sx, sy);
      preview = o && o.n.id !== drag.id ? o.n.id : null;
      drag.moved = true;
      draw();
      if (preview) {
        const p = nodeBox(preview), d = nodeBox(drag.id);
        if (p && d) {
          ctx.save();
          ctx.strokeStyle = "#1b6e8c"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          const [x1, y1] = toScreen(d.x + NODE_W / 2, d.y + NODE_H / 2);
          const [x2, y2] = toScreen(p.x + NODE_W / 2, p.y + NODE_H / 2);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.restore();
        }
      }
      return;
    }
    const o = pick(sx, sy);
    const tip = $("#tip");
    if (o && o.n.id !== hoverId) {
      hoverId = o.n.id;
      const n = o.n;
      tip.innerHTML = `<b>${n.title}</b><br>${typeOf(n.type).name} · ${n.content_at}<br>${(n.summary || "").slice(0, 70)}`;
      tip.style.display = "block";
    } else if (!o) {
      hoverId = null; tip.style.display = "none";
    }
    if (tip.style.display === "block") {
      tip.style.left = Math.min(sx + 14, canvas.clientWidth - 270) + "px";
      tip.style.top = (sy + 16) + "px";
    }
  });

  window.addEventListener("mouseup", () => {
    if (drag) {
      const id = drag.id, parent = preview, moved = drag.moved;
      drag = null; preview = null; canvas.classList.remove("dragging");
      if (moved && parent) applyEdit({ op: "reparent", id, parent });
      draw();
    }
    if (panning) { panning = null; canvas.classList.remove("dragging"); }
  });

  canvas.addEventListener("dblclick", (e) => {
    const o = pick(e.offsetX, e.offsetY);
    if (o) flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, Math.max(cam.s, 0.95));
  });

  mini.addEventListener("click", (e) => {
    const r = mini.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * L.W;
    const wy = ((e.clientY - r.top) / r.height) * L.H;
    flyTo(wx, wy, cam.s, 300);
  });

  window.addEventListener("resize", resize);
}

/* ---------------- 节点详情 ---------------- */
function selectNode(id) {
  const n = S.nodes.find(x => x.id === id);
  if (!n) return;
  focusId = id;
  const t = typeOf(n.type), p = projectOf(n.project);
  $("#d-title").textContent = n.title;
  $("#d-meta").textContent = `${t.name} · ${n.content_at} · ${p.name}`;
  const body = $("#d-body");
  body.innerHTML = "";

  const st = el("div", "", `<span class="chip ${n.status === "superseded" ? "red" : "green"}">${n.status === "superseded" ? "已取代" : n.status === "draft" ? "草稿" : "有效"}</span>
    <span class="chip">${n.auto ? "AI 自动挂" : "人工"}</span>
    <span class="chip">${n.placement === "attach" ? "作为证据挂载" : "独立节点"}</span>
    <span class="chip">置信度 ${(n.confidence ?? 1).toFixed(2)}</span>`);
  body.appendChild(st);

  const ex = n.extra || {};
  if (Object.keys(ex).length) {
    body.appendChild(el("h4", "", "字段"));
    const kv = el("div", "kv");
    for (const [k, v] of Object.entries(ex)) {
      kv.appendChild(el("div", "k", k));
      kv.appendChild(el("div", "", String(v)));
    }
    body.appendChild(kv);
  }

  const src = n.source || {};
  body.appendChild(el("h4", "", "来源"));
  if (src.file) {
    const ev = el("div", "ev");
    ev.textContent = src.excerpt || "（无摘要）";
    body.appendChild(ev);
    const btn = el("button", "btn ghost small", "打开原文并定位");
    btn.onclick = () => showFile(n, ev);
    body.appendChild(btn);
  } else if (src.excerpt) {
    const ev = el("div", "ev"); ev.textContent = src.excerpt;
    body.appendChild(ev);
    body.appendChild(el("div", "muted", "来源：粘贴输入，无文件载体"));
  }

  const rel = S.edges.filter(e => e.from === id || e.to === id);
  if (rel.length) {
    body.appendChild(el("h4", "", "脉络"));
    for (const e of rel) {
      const other = nodeBox(e.from === id ? e.to : e.from);
      const dirTxt = e.from === id ? "→" : "←";
      const kindTxt = { derived: "派生", supersedes: "取代", relates: "关联", attach: "挂载" }[e.kind] || e.kind;
      const line = el("div", "", `<span class="muted">${dirTxt} ${kindTxt}：</span>${other ? other.n.title : e.to}`);
      line.style.fontSize = "12.5px"; line.style.marginBottom = "3px";
      line.style.cursor = "pointer";
      if (other) line.onclick = () => { selectNode(other.n.id); flyTo(other.x + NODE_W / 2, other.y + NODE_H / 2, cam.s); };
      body.appendChild(line);
    }
  }

  const acts = el("div", "btnrow");
  const mkBtn = (label, fn) => { const b = el("button", "btn ghost small", label); b.onclick = fn; acts.appendChild(b); };
  mkBtn("标记取代…", () => { supersedePick = id; canvas.classList.add("edit"); toast("点一个被取代的节点"); });
  mkBtn("切到草稿", () => applyEdit({ op: "status", id, status: n.status === "draft" ? "active" : "draft" }));
  mkBtn("删除", () => { if (confirm("软删除这个节点？可撤销")) applyEdit({ op: "delete", id }); });
  const sel = el("select");
  sel.innerHTML = S.types.map(t2 => `<option value="${t2.id}" ${t2.id === n.type ? "selected" : ""}>${t2.name}</option>`).join("");
  sel.onchange = () => applyEdit({ op: "retype", id, type: sel.value });
  acts.appendChild(sel);
  body.appendChild(acts);

  $("#drawer").classList.remove("hidden");
  draw();
}

async function showFile(n, evBox) {
  const d = await api("/api/file?node=" + encodeURIComponent(n.id));
  evBox.innerHTML = "";
  if (d.error) { evBox.textContent = d.error; return; }
  if (d.kind === "pdf") {
    const box = el("div", "imgbox");
    box.innerHTML = `<img src="${d.image}" alt="pdf" />`;
    evBox.appendChild(box);
    evBox.appendChild(el("div", "muted", `${d.name} · 第 ${d.page} 页 / 共 ${d.total_pages} 页（红框为命中段）`));
  } else {
    const txt = d.text || "";
    const s = d.start, e = d.end;
    if (s != null && e != null && s >= 0) {
      evBox.innerHTML = txt.slice(0, s) + "<mark>" + txt.slice(s, e) + "</mark>" + txt.slice(e);
    } else {
      evBox.textContent = txt.slice(0, 3000);
    }
  }
}

/* ---------------- 编辑 ---------------- */
async function applyEdit(payload) {
  await api("/api/edit", payload);
  await loadState(); computeLayout(); draw();
  if (payload.id && payload.op !== "delete") selectNode(payload.id);
  toast("已更新");
}

/* ---------------- 检索 ---------------- */
let searchTimer = null;
async function doSearch(q, fly = true) {
  if (!q.trim()) { highlight.clear(); $("#search-hint").classList.remove("on"); draw(); return; }
  const d = await api("/api/search?q=" + encodeURIComponent(q));
  highlight = new Set(d.hits.map(h => h.id));
  (d.neighbors || []).forEach(id => highlight.add(id));
  lastSearch = d;
  $("#trace").textContent = (d.trace || []).join("　→　");
  const hint = $("#search-hint");
  if (DEMO) {
    hint.classList.remove("on");
  } else if (d.hits.length) {
    hint.innerHTML = d.hits.slice(0, 6).map(h =>
      `<div class="hint-item" data-id="${h.id}"><div class="t">${h.title}</div>
       <div class="m">${typeOf(h.type).name} · ${projectOf(h.project).name} · 匹配 ${h.score}</div></div>`).join("");
    hint.classList.add("on");
    hint.querySelectorAll(".hint-item").forEach(it => {
      it.onclick = () => {
        const id = it.dataset.id; const o = nodeBox(id);
        if (o) { flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.05); selectNode(id); }
        hint.classList.remove("on");
        const h = d.hits.find(x => x.id === id);
        if (h && h.snippet) showSnippet(h);
      };
    });
    if (fly) {
      const o = nodeBox(d.hits[0].id);
      if (o) flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 0.78);
    }
  } else if (!DEMO) {
    hint.innerHTML = `<div class="hint-item"><div class="m">没有命中。试试「定价」「口径」「预算」</div></div>`;
    hint.classList.add("on");
    $("#trace").textContent = "① 判意图 → ② 检索：0 命中 → ③ 无凭证，拒绝回答（这是产品在诚实地说“不知道”）";
  }
  draw();
}

function showSnippet(h) {
  const box = $("#d-body");
  selectNode(h.id);
  const ev = el("div", "ev");
  ev.style.borderColor = "#1b6e8c";
  ev.innerHTML = `<div class="muted" style="margin-bottom:4px">段落命中</div>` + (h.snippet || "");
  setTimeout(() => { $("#d-body").prepend(ev); }, 30);
  $("#drawer").classList.remove("hidden");
}

/* ---------------- 收进来 ---------------- */
async function capture() {
  const text = $("#capture-text").value.trim();
  if (!text) return toast("先粘点东西进来");
  const date = $("#capture-date").value || null;
  const d = await api("/api/capture", { text, date });
  $("#modal-capture").classList.add("hidden");
  await loadState(); computeLayout(); draw();
  const auto = d.items.filter(i => i.committed).length;
  const pop = d.items.filter(i => !i.committed && i.cls.action === "popup");
  const queued = d.items.filter(i => !i.committed && i.cls.action === "queue").length;
  toast(`切出 ${d.items.length} 条：自动挂 ${auto}，待确认 ${pop.length}，进队列 ${queued}，丢弃 ${d.dropped.length}`);
  if (d.dropped.length) console.log("丢弃的碎片：", d.dropped.map(x => x.text));
  if (pop.length) openPlace(pop[0], pop.slice(1));
  else if (auto) {
    const last = d.items.filter(i => i.committed).pop();
    const o = nodeBox(last.node_id);
    if (o) { flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.05); selectNode(last.node_id); }
  }
  if (queued) $("#btn-queue").classList.add("has");
}

let placeQueue = [];
function openPlace(item, rest = []) {
  placeQueue = rest;
  const cls = item.cls || {};
  $("#place-text").textContent = item.text + (item.truncated ? "（原文可能不完整）" : "");
  const box = $("#place-cands");
  box.innerHTML = "";
  const cands = (cls.candidates || []).slice(0, 3);
  const marginTxt = (cls.margin != null)
    ? `判断置信度 ${(cls.confidence ?? 0).toFixed(2)}，但前两个候选只差 ${(cls.margin).toFixed(3)} —— AI 在“挂在谁下面”这件事上没把握，所以问你。`
    : "";
  let why = document.getElementById("place-why");
  if (!why) { why = el("div", "muted"); why.id = "place-why"; $("#place-cands").before(why); }
  why.textContent = marginTxt;
  why.style.margin = "4px 0 8px";
  let picked = cands.length ? cands[0].id : null;
  cands.forEach((c, i) => {
    const n = S.nodes.find(x => x.id === c.id) || {};
    const div = el("div", "cand" + (i === 0 ? " sel" : ""));
    div.innerHTML = `<span class="sc">${c.score}</span>
      <div class="path">${projectOf(n.project).name} ▸ ${typeOf(n.type).name} ▸ ${n.title || c.id}</div>
      <div class="why">${i === 0 ? "最像这一条的上游" : "次选"}</div>`;
    div.onclick = () => {
      box.querySelectorAll(".cand").forEach(x => x.classList.remove("sel"));
      div.classList.add("sel"); picked = c.id;
    };
    box.appendChild(div);
  });
  $("#place-custom").value = "";
  $("#modal-place").classList.remove("hidden");

  $("#place-confirm").onclick = async () => {
    const custom = $("#place-custom").value.trim();
    const payload = {
      item: { id: item.id, text: item.text, at: item.at, speaker: item.speaker, cls },
      parent: custom ? null : picked,
      project: cls.project, type: cls.type, placement: cls.placement,
      new_node_title: custom || null,
    };
    const r = await api("/api/place", payload);
    $("#modal-place").classList.add("hidden");
    await loadState(); computeLayout(); draw();
    if (r.node_id) {
      const o = nodeBox(r.node_id);
      if (o) { flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.05); selectNode(r.node_id); }
    }
    toast("已挂上，并记住这次的判断");
    if (placeQueue.length) openPlace(placeQueue.shift(), placeQueue);
    else if (S.queue.length) renderQueue();
  };
}

/* ---------------- 待归类 ---------------- */
function renderQueue() {
  const list = $("#queue-list");
  list.innerHTML = "";
  if (!S.queue.length) { list.innerHTML = `<div class="muted" style="padding:10px">队列是空的。</div>`; return; }
  S.queue.forEach(q => {
    const d = el("div", "qitem");
    d.innerHTML = `<div class="txt">${q.text}</div>
      <div class="muted">${q.at || ""} ${q.speaker ? "· " + q.speaker : ""} · 置信度 ${(q.cls?.confidence ?? 0).toFixed(2)}</div>
      <div class="row"><button class="btn ghost small">处理</button></div>`;
    d.querySelector("button").onclick = () => openPlace({ ...q, truncated: false });
    list.appendChild(d);
  });
}

/* ---------------- 新建类型 ---------------- */
function addFieldRow(key = "", kind = "文本") {
  const row = el("div", "field-row");
  row.innerHTML = `<input placeholder="字段名（中文）" value="${key}" />
    <select>${["文本", "长文本", "日期", "人员", "数字", "单选", "链接"].map(k => `<option ${k === kind ? "selected" : ""}>${k}</option>`).join("")}</select>`;
  $("#type-fields").appendChild(row);
}

/* ---------------- 事件绑定 ---------------- */
function bindUI() {
  $("#btn-capture").onclick = () => { $("#modal-capture").classList.remove("hidden"); $("#capture-date").valueAsDate = new Date(); $("#capture-text").focus(); };
  $("#capture-go").onclick = capture;
  $("#btn-edit").onclick = () => {
    editMode = !editMode;
    $("#btn-edit").classList.toggle("on", editMode);
    canvas.classList.toggle("edit", editMode);
    toast(editMode ? "调整模式：拖动节点可改父节点" : "已退出调整模式");
  };
  $("#btn-queue").onclick = () => { $("#queue-panel").classList.toggle("hidden"); renderQueue(); };
  $("#d-close").onclick = () => { $("#drawer").classList.add("hidden"); focusId = null; draw(); };
  $("#btn-type").onclick = () => {
    $("#type-fields").innerHTML = ""; $("#type-name").value = "";
    addFieldRow("结论"); addFieldRow("负责人", "人员");
    $("#modal-type").classList.remove("hidden");
  };
  $("#type-add-field").onclick = () => addFieldRow();
  $("#type-save").onclick = async () => {
    const name = $("#type-name").value.trim();
    if (!name) return toast("给类型起个名字");
    const fields = [...$("#type-fields").querySelectorAll(".field-row")].map(r => ({
      key: r.querySelector("input").value.trim() || "未命名字段",
      kind: r.querySelector("select").value,
    }));
    await api("/api/type", { name, fields, color: "#B4743A", icon: "◇" });
    $("#modal-type").classList.add("hidden");
    await loadState(); toast("类型已创建，判定时会按它的字段抽取");
  };
  $("#btn-git").onclick = async () => {
    toast("正在读取 git 历史…");
    const d = await api("/api/git", {});
    if (d.error) return toast("git 读取失败：" + d.error);
    await loadState(); computeLayout(); draw();
    toast(`已接入 ${d.added} 个版本节点（共 ${d.total} 个）`);
    setTimeout(() => { const o = L.nodes.find(x => x.n.project === "p_code"); if (o) flyTo(o.x, o.y, 0.8); }, 200);
  };
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value;
    searchTimer = setTimeout(() => doSearch(q), 260);
  });
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch(e.target.value);
    if (e.key === "Escape") { e.target.value = ""; doSearch(""); $("#search-hint").classList.remove("on"); }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) $("#search-hint").classList.remove("on");
  });
  $("#trace-toggle").onclick = () => {
    const t = $("#trace");
    if (t.dataset.full) { t.textContent = t.dataset.full; t.dataset.full = ""; t.style.whiteSpace = "nowrap"; }
    else { t.dataset.full = t.textContent; t.textContent = lastSearch ? (lastSearch.trace || []).join("  |  ") : t.textContent; t.style.whiteSpace = "normal"; }
  };
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest(".modal").classList.add("hidden"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
      $("#drawer").classList.add("hidden"); $("#search-hint").classList.remove("on");
      focusId = null; draw();
    }
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault(); $("#search").focus();
    }
    if ((e.key === "e" || e.key === "E") && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      $("#btn-edit").click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault(); api("/api/undo", {}).then(async () => { await loadState(); computeLayout(); draw(); toast("已撤销"); });
    }
  });
}

/* ---------------- 启动 ---------------- */
async function boot() {
  canvas = $("#canvas"); ctx = canvas.getContext("2d");
  mini = $("#minimap"); mctx = mini.getContext("2d");
  bindUI(); bindCanvas();
  await loadState();
  computeLayout(); resize();
  const W = canvas.clientWidth;
  cam.s = clamp((W - 170) / L.W, 0.22, 0.95);
  cam.x = 100; cam.y = 40;
  draw();
  // 演示参数：?q=xxx 自动检索；?node=xxx 直接打开节点
  const qs = new URLSearchParams(location.search);
  const q = qs.get("q");
  const nid = qs.get("node");
  if (nid) {
    const o = nodeBox(nid);
    if (o) { flyTo(o.x + NODE_W / 2, o.y + NODE_H / 2, 1.0, 300); selectNode(nid); }
    return;
  }
  if (qs.get("demo") === "place") {
    DEMO = true;
    const cands = ["n08", "n07", "n09"].map(id => S.nodes.find(n => n.id === id)).filter(Boolean);
    openPlace({
      id: "it_demo",
      text: "定价就按 B 方案走吧，A 的风险太大",
      at: "2026-11-19",
      speaker: "张三",
      truncated: false,
      cls: {
        type: "decision", project: "p_pricing", placement: "grow",
        confidence: 0.851, margin: 0.007,
        candidates: cands.map((n, i) => ({ id: n.id, score: [0.42, 0.40, 0.31][i] || 0.3 })),
      },
    });
    return;
  }
  if (qs.get("view") === "all") {
    const sc = Math.min((canvas.clientWidth - 30) / L.W, (canvas.clientHeight - 80) / L.H);
    cam.s = sc; cam.x = 10; cam.y = 30; draw();
    return;
  }
  if (q) {
    DEMO = true;
    await doSearch(q, true);
    if (lastSearch && lastSearch.hits.length) {
      const id = lastSearch.hits[0].id;
      setTimeout(() => {
        selectNode(id);
        const h = lastSearch.hits[0];
        if (h.snippet) {
          const ev = el("div", "ev");
          ev.style.borderColor = "#1b6e8c";
          ev.innerHTML = `<div class="muted" style="margin-bottom:4px">段落命中</div>` + h.snippet;
          $("#d-body").prepend(ev);
        }
      }, 520);
    }
    return;
  }
  // 默认飞到 Q4 定价泳道
  const first = L.nodes[Math.floor(L.nodes.length * 0.55)];
  if (first) flyTo(first.x, first.y, Math.min(cam.s, 0.9), 500);
}
boot();
