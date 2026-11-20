/* 项目Git · 前端 v2
   布局：时间列（week）× 主线/支线（两级），每个节点独占一个槽位 —— 不重叠、可预期。
*/
const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const S = { projects: [], types: [], nodes: [], edges: [], queue: [], choices: [], meta: {} };
const cam = { x: 0, y: 0, s: 1 };
const L = { nodes: [], cols: [], colW: 210, gap: 26, W: 0, H: 0, mode: "one", projects: [] };

const SPINE_W = 200, SPINE_H = 74, SPINE_GAP = 14;
const BRANCH_W = 184, BRANCH_H = 54, BRANCH_GAP = 12;
const COL_W = 196, COL_GAP = 34;
const HEADER_H = 46;         // 屏幕空间时间表头
const SPINE_TOP = 76;        // 主线带起点（世界坐标）
const LEFT_PAD = 14;
const MIN_FIT_SCALE = 0.58;  // 缩小下限：低于这个就不画细节

let canvas, ctx, mini, mctx, DPR = 1;
let curProject = null;
let editMode = false, highlight = new Set(), focusId = null;
let dragNode = null, dragPreview = null, panning = null, anim = null, hoverId = null;
let lastSearch = null, DEMO = false, supersedePick = null;
let miniDrag = null;

/* ---------------- 工具 ---------------- */
const typeOf = (id) => S.types.find(t => t.id === id) || { name: id, color: "#8A99A5" };
const projectOf = (id) => S.projects.find(p => p.id === id) || { name: id, color: "#8A99A5" };
const pad2 = (n) => String(n).padStart(2, "0");
const dstr = (s) => (s || "").slice(5, 10);
function ms(s) { const t = Date.parse((s || "").length <= 7 ? (s || "") + "-01" : (s || "").replace("T", " ")); return isNaN(t) ? null : t; }
function shortFile(f) { if (!f) return "粘贴"; return f.replace(/\.(md|txt|pdf|docx)$/i, "").slice(0, 12); }
function locText(n) {
  const loc = n.source && n.source.locator;
  if (!loc) return "";
  if (loc.kind === "pdf") return `第 ${loc.page} 页`;
  if (loc.kind === "text" && loc.start != null) return `字符 ${loc.start}–${loc.end}`;
  if (loc.kind === "docx") return `第 ${loc.para} 段`;
  return "";
}
function toast(msg, ms = 2400) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), ms);
}
async function api(p, body) {
  const o = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
  const r = await fetch(p, o);
  return await r.json();
}

/* ---------------- 数据 ---------------- */
async function loadState() {
  const d = await api("/api/state");
  Object.assign(S, d);
  S.queue = d.queue || []; S.choices = d.choices || []; S.meta = d.meta || {};
  const cnt = (pid) => S.nodes.filter(n => n.project === pid && n.status !== "deleted").length;
  // tabs
  const tabs = $("#tabs"); tabs.innerHTML = "";
  S.projects.forEach(p => {
    const b = el("button", "tab" + (p.id === curProject ? " on" : ""),
      `${p.name}<span class="n">${cnt(p.id)}</span>`);
    b.onclick = () => { curProject = p.id; L.mode = "one"; loadState().then(() => { computeLayout(); fitView(); renderNav(); }); };
    tabs.appendChild(b);
  });
  const all = el("button", "tab" + (L.mode === "all" ? " on" : ""), "全景");
  all.onclick = () => { L.mode = "all"; loadState().then(() => { computeLayout(); fitView(); renderNav(); }); };
  tabs.appendChild(all);

  $("#queue-count").textContent = S.queue.length;
  $("#nav-queue-count").textContent = S.queue.length;
  $("#btn-queue").classList.toggle("has", S.queue.length > 0);
  const sel = $("#filter-type");
  if (sel.options.length !== S.types.length + 1) {
    sel.innerHTML = '<option value="">全部类型</option>' + S.types.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  }
}

/* ---------------- 布局：时间列 × 主线/支线 ---------------- */
function spineOf(nodes) {
  let sp = nodes.filter(n => n.status === "active" && (n.type === "decision" || n.type === "version"));
  if (sp.length < 3) {
    const extra = nodes.filter(n => !n.parent && n.type === "plan" && n.status === "active");
    sp = sp.concat(extra);
  }
  const seen = new Set();
  return sp.filter(n => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => (ms(a.content_at) || 0) - (ms(b.content_at) || 0));
}

function computeLayout() {
  const allNodes = S.nodes.filter(n => n.status !== "deleted");
  const isAll = L.mode === "all";
  if (isAll) return computePortfolio(allNodes);

  const pid = curProject || (S.projects[0] && S.projects[0].id);
  const nodes = allNodes.filter(n => n.project === pid);
  L.nodes = []; L.cols = []; L.W = 0; L.H = 0;
  if (!nodes.length) return;

  const times = nodes.map(n => ms(n.content_at) || Date.now());
  let t0 = Math.min(...times), t1 = Math.max(...times);
  if (t1 - t0 < 86400000 * 28) t1 = t0 + 86400000 * 28;
  const days = (t1 - t0) / 86400000;
  // 列 = 约 10 天一格，5~9 格（宁可少而清，不要多而糊）
  const nCols = clamp(Math.round(days / 14), 5, 8);
  const PITCH = COL_W + COL_GAP;
  const colOf = (t) => clamp(Math.floor(((t - t0) / (t1 - t0)) * nCols), 0, nCols - 1);
  const colX = (i) => LEFT_PAD + i * PITCH + 12;

  for (let i = 0; i < nCols; i++) {
    const s0 = new Date(t0 + (i / nCols) * (t1 - t0));
    const s1 = new Date(t0 + ((i + 1) / nCols) * (t1 - t0) - 86400000);
    L.cols.push({
      i, x: LEFT_PAD + i * PITCH, w: COL_W,
      label: `${s0.getFullYear()}-${pad2(s0.getMonth() + 1)}-${pad2(s0.getDate())}`,
      sub: `${pad2(s1.getMonth() + 1)}-${pad2(s1.getDate())}`,
      n: 0
    });
  }

  // 主线 = 顶层方案 + 所有决策 + 所有版本（这是项目的骨架）
  const spine = nodes.filter(n =>
    n.type === "version" || n.type === "decision" || (n.type === "plan" && !n.parent)
  ).sort((a, b) => (ms(a.content_at) || 0) - (ms(b.content_at) || 0));

  const spineIds = new Set(spine.map(n => n.id));
  const spineRowsInCol = new Array(nCols).fill(0);
  spine.forEach(n => {
    const c = colOf(ms(n.content_at) || t0);
    const row = spineRowsInCol[c]++;
    L.cols[c].n++;
    L.nodes.push({
      n, kind: "spine", col: c,
      x: colX(c), w: SPINE_W,
      y: SPINE_TOP + row * (SPINE_H + SPINE_GAP), h: SPINE_H
    });
  });
  const spineRows = Math.max(1, Math.max(...spineRowsInCol));

  // 支线挂到最近的祖先主线
  const byId = new Map(nodes.map(n => [n.id, n]));
  const parentOf = (n) => (n.parent ? byId.get(n.parent) : null);
  const attOf = (n) => {
    let p = parentOf(n), guard = 0;
    while (p && guard++ < 30) { if (spineIds.has(p.id)) return p.id; p = parentOf(p); }
    const nt = ms(n.content_at) || t0;
    let best = null, bd = Infinity;
    spine.forEach(s0 => {
      const d = Math.abs((ms(s0.content_at) || t0) - nt);
      if ((ms(s0.content_at) || t0) <= nt + 86400000 * 3 && d < bd) { bd = d; best = s0; }
    });
    return best ? best.id : (spine[0] && spine[0].id) || null;
  };

  const branchTop = SPINE_TOP + spineRows * (SPINE_H + SPINE_GAP) + 30;
  const cursor = new Array(nCols).fill(branchTop);
  nodes.filter(n => !spineIds.has(n.id))
    .sort((a, b) => (ms(a.content_at) || 0) - (ms(b.content_at) || 0))
    .forEach(n => {
      const c = colOf(ms(n.content_at) || t0);
      L.cols[c].n++;
      L.nodes.push({
        n, kind: "branch", col: c,
        x: colX(c), w: BRANCH_W,
        y: cursor[c], h: BRANCH_H,
        attach: attOf(n)
      });
      cursor[c] += BRANCH_H + BRANCH_GAP;
    });

  L.W = LEFT_PAD + nCols * PITCH + 12;
  L.H = Math.max(Math.max(...cursor) + 30, branchTop + 200);
  L.spineIds = spineIds;
  L.spineRows = spineRows;
  L.spineBottom = SPINE_TOP + spineRows * (SPINE_H + SPINE_GAP);
  L.branchTop = branchTop;
  L.t0 = t0; L.t1 = t1; L.pid = pid; L.nCols = nCols; L.PITCH = PITCH;
}

/* 全景：每个项目一行，只放主线 */
function computePortfolio(nodes) {
  L.nodes = []; L.cols = []; L.mode = "all";
  const times = nodes.map(n => ms(n.content_at) || Date.now());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const nCols = 10, CW = 150, PITCH = CW + 18, PAD_ALL = 168;
  L.colW = CW; L.gap = 18; L.padAll = PAD_ALL;
  for (let i = 0; i < nCols; i++) {
    const s = new Date(t0 + (i / nCols) * (t1 - t0));
    L.cols.push({ i, x: PAD_ALL + i * PITCH, w: CW, label: `${s.getFullYear()}-${pad2(s.getMonth() + 1)}`, sub: "" });
  }
  let y = 72;
  L.projects = [];
  S.projects.forEach(p => {
    const pn = nodes.filter(n => n.project === p.id);
    if (!pn.length) return;
    const sp = spineOf(pn);
    L.projects.push({ id: p.id, name: p.name, color: p.color, y, h: 82, total: pn.length, spine: sp.length });
    sp.forEach(n => {
      const c = clamp(Math.floor(((ms(n.content_at) || t0) - t0) / (t1 - t0) * nCols), 0, nCols - 1);
      L.nodes.push({ n, kind: "mini", col: c, x: PAD_ALL + c * PITCH + 6, w: CW - 12, y: y + 16, h: 50 });
    });
    y += 96;
  });
  L.W = PAD_ALL + nCols * PITCH + 8;
  L.H = y + 20;
  L.t0 = t0; L.t1 = t1;
}

/* ---------------- 绘制 ---------------- */
function resize() {
  DPR = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * DPR;
  canvas.height = canvas.clientHeight * DPR;
  mini.width = 168 * DPR; mini.height = 104 * DPR;
  draw();
}
const toScreen = (wx, wy) => [wx * cam.s + cam.x, wy * cam.s + cam.y];
const toWorld = (sx, sy) => [(sx - cam.x) / cam.s, (sy - cam.y) / cam.s];

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
  const visible = (n) => (!ft || n.type === ft) && (!fs || n.status === fs);

  // ---- 相机坐标系：列、泳道、边、节点 ----
  ctx.save();
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.x, DPR * cam.y);

  if (L.mode === "all") {
    L.projects.forEach(p => {
      ctx.fillStyle = "rgba(247,250,252,.9)";
      ctx.fillRect(0, p.y, L.W, 82);
      ctx.strokeStyle = "#eaf0f4"; ctx.lineWidth = 1 / cam.s;
      ctx.beginPath(); ctx.moveTo(0, p.y + 82); ctx.lineTo(L.W, p.y + 82); ctx.stroke();
    });
  } else {
    // 列底色 + 分隔
    L.cols.forEach((c, i) => {
      ctx.fillStyle = i % 2 ? "rgba(247,250,252,.55)" : "rgba(252,253,254,.5)";
      ctx.fillRect(c.x, 0, c.w, L.H);
      ctx.strokeStyle = "#edf2f5"; ctx.lineWidth = 1 / cam.s;
      ctx.beginPath(); ctx.moveTo(c.x + c.w + L.gap / 2, 0); ctx.lineTo(c.x + c.w + L.gap / 2, L.H); ctx.stroke();
    });
    // 主线带
    ctx.fillStyle = "rgba(238,245,249,.85)";
    ctx.fillRect(0, SPINE_TOP - 14, L.W, (L.branchStartY - SPINE_TOP) - 8);
    ctx.strokeStyle = "#dfe9ef"; ctx.lineWidth = 1 / cam.s;
    ctx.beginPath(); ctx.moveTo(0, SPINE_TOP - 14); ctx.lineTo(L.W, SPINE_TOP - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, L.branchStartY - 22); ctx.lineTo(L.W, L.branchStartY - 22); ctx.stroke();

    // 主线脊柱：一条贯穿的线，串起所有主线节点
    const sp = L.nodes.filter(o => o.kind === "spine");
    if (sp.length > 1) {
      const y0 = SPINE_TOP + SPINE_H / 2;
      const x0 = Math.min(...sp.map(o => o.x)) - 10;
      const x1 = Math.max(...sp.map(o => o.x + o.w)) + 10;
      ctx.strokeStyle = "#c3d5e0"; ctx.lineWidth = 2.4 / cam.s;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.fillStyle = "#c3d5e0";
      [[x0, y0], [x1, y0]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3 / cam.s, 0, 7); ctx.fill(); });
    }
  }

  // 边
  let bi = 0;
  L.nodes.forEach(o => {
    if (o.kind !== "branch" || !o.attach) return;
    const p = L.nodes.find(x => x.n.id === o.attach);
    if (!p || !visible(o.n) || !visible(p.n)) return;
    dropLink(o, p, "#7f9bb0", 1.6, bi++);
  });
  if (L.mode === "all") {
    // 全景里主线之间用细横线连起来
    L.projects.forEach(p => {
      const list = L.nodes.filter(o => o.n.project === p.id).sort((a, b) => a.x - b.x);
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        if (b.x - a.x < 4) continue;
        ctx.strokeStyle = "#c8d5de"; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(a.x + a.w, a.y + a.h / 2); ctx.lineTo(b.x, b.y + b.h / 2); ctx.stroke();
      }
    });
  }
  // 主线之间的派生 / 取代
  L.nodes.forEach(o => {
    if (o.kind !== "spine") return;
    S.edges.filter(e => e.from === o.n.id || e.to === o.n.id).forEach(e => {
      const other = L.nodes.find(x => x.n.id === (e.from === o.n.id ? e.to : e.from));
      if (!other || other.kind !== "spine") return;
      if (e.kind === "derived") return;   // 主线上的派生交给取代线表达
      if (e.kind === "supersedes") {
        if (e.from !== o.n.id) return;
        arcLink(o, other, "#b5473f", 2.4, "取代");
      }
    });
  });

  // 同列多行主线：从脊柱拉到卡片
  const railY = SPINE_TOP + SPINE_H / 2;
  L.nodes.filter(o => o.kind === "spine" && o.y > SPINE_TOP + 2).forEach(o => {
    ctx.strokeStyle = "#c3d5e0"; ctx.lineWidth = 1.4 / cam.s; ctx.setLineDash([4 / cam.s, 3 / cam.s]);
    const cx = o.x + o.w / 2;
    ctx.beginPath(); ctx.moveTo(cx, railY); ctx.lineTo(cx, o.y); ctx.stroke();
    ctx.setLineDash([]);
  });

  // 节点
  L.nodes.forEach(o => {
    if (!visible(o.n)) return;
    if (o.kind === "spine") drawSpine(o);
    else if (o.kind === "mini") drawMini(o);
    else drawBranch(o);
  });

  // 编辑预览线
  if (dragNode && dragPreview) {
    const a = L.nodes.find(x => x.n.id === dragNode);
    const b = L.nodes.find(x => x.n.id === dragPreview);
    if (a && b) {
      ctx.strokeStyle = "#1b6e8c"; ctx.lineWidth = 2 / cam.s; ctx.setLineDash([6 / cam.s, 4 / cam.s]);
      ctx.beginPath();
      ctx.moveTo(a.x + a.w / 2, a.y + a.h / 2);
      ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.restore();

  // ---- 屏幕坐标系：时间表头、项目名 ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // 表头底
  ctx.fillStyle = "rgba(251,252,253,.94)";
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.strokeStyle = "#e3ebf0"; ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke();

  if (L.mode === "all") {
    L.projects.forEach(p => {
      const [, sy] = toScreen(0, p.y + 22);
      if (sy < HEADER_H - 10 || sy > H) return;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(14, sy, 4, 0, 7); ctx.fill();
      ctx.fillStyle = "#3c4f5c"; ctx.font = "600 12.5px 'Microsoft YaHei',sans-serif"; ctx.textBaseline = "middle";
      ctx.fillText(p.name, 24, sy);
      ctx.fillStyle = "#93a4b0"; ctx.font = "11px 'Microsoft YaHei',sans-serif";
      ctx.fillText(`主线 ${p.spine} · 共 ${p.total}`, 24, sy + 16);
    });
  } else {
    L.cols.forEach(c => {
      const [sx] = toScreen(c.x, 0);
      if (sx > W || sx + c.w * cam.s < 0) return;
      ctx.fillStyle = "#7f909c"; ctx.font = "11.5px 'Microsoft YaHei',sans-serif"; ctx.textBaseline = "top";
      ctx.fillText(c.label, sx + 2, 9);
      if (c.sub) { ctx.fillStyle = "#a9b6bf"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif"; ctx.fillText("— " + c.sub, sx + 2, 26); }
    });
    // 主线 / 支线 标记
    const [, sy1] = toScreen(0, SPINE_TOP - 22);
    const [, sy2] = toScreen(0, L.branchStartY - 30);
    ctx.fillStyle = "#96a7b2"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif"; ctx.textBaseline = "middle";
    if (sy1 > HEADER_H) ctx.fillText("主脉络", 8, sy1);
    if (sy2 > HEADER_H) ctx.fillText("支线与证据", 8, sy2);
  }
  drawMinimap();
}

function drawSpine(o) {
  const n = o.n, t = typeOf(n.type), sup = n.status === "superseded";
  const color = sup ? "#b9c4cc" : t.color;
  const hot = highlight.has(n.id) || focusId === n.id;
  if (hot) {
    for (const [k, a] of [[12, .10], [8, .16], [5, .24]]) {
      ctx.fillStyle = color; ctx.globalAlpha = a;
      roundRect(ctx, o.x - k, o.y - k, o.w + 2 * k, o.h + 2 * k, 12 + k); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.save();
  ctx.shadowColor = "rgba(18,59,79,.12)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  roundRect(ctx, o.x, o.y, o.w, o.h, 9);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();

  roundRect(ctx, o.x, o.y, o.w, o.h, 9);
  ctx.strokeStyle = color; ctx.lineWidth = hot ? 2.4 : 1.8; ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, o.x + 1, o.y + 9, 4, o.h - 18, 2); ctx.fill();

  ctx.textBaseline = "top";
  ctx.fillStyle = "#16232c"; ctx.font = "600 13px 'Microsoft YaHei',sans-serif";
  let title = n.title || "";
  while (ctx.measureText(title).width > o.w - 26 && title.length > 3) title = title.slice(0, -1);
  ctx.fillText(title === n.title ? title : title + "…", o.x + 14, o.y + 10);

  ctx.fillStyle = "#7d8c99"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
  ctx.fillText(`${t.name} · ${dstr(n.content_at)}`, o.x + 14, o.y + 30);

  // 出处
  const f = n.source && n.source.file;
  ctx.fillStyle = f ? "#eef6fa" : "#f4f6f8";
  const tag = (f ? "▤ " + shortFile(f) + (locText(n) ? " · " + locText(n) : "") : "粘贴输入");
  const tw = Math.min(o.w - 24, ctx.measureText(tag).width + 12);
  roundRect(ctx, o.x + 12, o.y + o.h - 20, tw, 14, 4); ctx.fill();
  ctx.fillStyle = f ? "#1b6079" : "#8b99a4"; ctx.font = "9.5px 'Microsoft YaHei',sans-serif";
  ctx.fillText(tag, o.x + 17, o.y + o.h - 18);

  if (n.auto) {
    ctx.fillStyle = "#e8f1f5"; roundRect(ctx, o.x + o.w - 32, o.y + 8, 24, 13, 4); ctx.fill();
    ctx.fillStyle = "#1b6e8c"; ctx.font = "9px 'Microsoft YaHei',sans-serif";
    ctx.fillText("AI", o.x + o.w - 26, o.y + 10);
  }
}

function drawBranch(o) {
  const n = o.n, t = typeOf(n.type), sup = n.status === "superseded";
  const color = sup ? "#c3ccd3" : t.color;
  const hot = highlight.has(n.id) || focusId === n.id;
  if (hot) {
    ctx.fillStyle = color; ctx.globalAlpha = .18;
    roundRect(ctx, o.x - 5, o.y - 5, o.w + 10, o.h + 10, 9); ctx.fill(); ctx.globalAlpha = 1;
  }
  roundRect(ctx, o.x, o.y, o.w, o.h, 7);
  ctx.fillStyle = sup ? "#f6f7f9" : "#fff"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = hot ? 1.8 : 1; ctx.stroke();
  ctx.fillStyle = color; roundRect(ctx, o.x + 1, o.y + 8, 3, o.h - 16, 1.5); ctx.fill();

  ctx.textBaseline = "top";
  ctx.fillStyle = sup ? "#9aa7b0" : "#1b2830"; ctx.font = "12px 'Microsoft YaHei',sans-serif";
  let title = n.title || "";
  while (ctx.measureText(title).width > o.w - 22 && title.length > 3) title = title.slice(0, -1);
  ctx.fillText(title === n.title ? title : title + "…", o.x + 11, o.y + 7);

  const f = n.source && n.source.file;
  const meta = `${t.name} · ${dstr(n.content_at)}` + (f ? ` · ▤ ${shortFile(f)}` : "");
  ctx.fillStyle = f ? "#5c7f92" : "#8b99a4"; ctx.font = "10px 'Microsoft YaHei',sans-serif";
  let m = meta;
  while (ctx.measureText(m).width > o.w - 22 && m.length > 4) m = m.slice(0, -1);
  ctx.fillText(m === meta ? m : m + "…", o.x + 11, o.y + 27);

  if (sup) {
    ctx.strokeStyle = "#c3ccd3"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(o.x + 10, o.y + 19); ctx.lineTo(o.x + o.w - 10, o.y + 19); ctx.stroke();
  }
}

function drawMini(o) {
  const n = o.n, t = typeOf(n.type);
  const hot = highlight.has(n.id) || focusId === n.id;
  roundRect(ctx, o.x, o.y, o.w, o.h, 6);
  ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = hot ? t.color : "#d5e0e7"; ctx.lineWidth = hot ? 2 : 1; ctx.stroke();
  ctx.fillStyle = t.color; ctx.fillRect(o.x, o.y + 6, 3, o.h - 12);
  ctx.fillStyle = "#23323c"; ctx.font = "11px 'Microsoft YaHei',sans-serif"; ctx.textBaseline = "top";
  let title = n.title || "";
  while (ctx.measureText(title).width > o.w - 14 && title.length > 3) title = title.slice(0, -1);
  ctx.fillText(title, o.x + 8, o.y + 9);
  ctx.fillStyle = "#8b99a4"; ctx.font = "9.5px 'Microsoft YaHei',sans-serif";
  ctx.fillText(dstr(n.content_at), o.x + 8, o.y + 27);
}

/* 支线接入主线：竖 → 横 → 竖，末端箭头指向父卡片底部 */
function dropLink(child, parent, color, width, idx = 0) {
  const cx = child.x + child.w / 2;
  const px = parent.x + parent.w / 2;
  const yTop = parent.y + parent.h;               // 父卡片下沿
  const yGo = yTop + 12 + (idx % 5) * 8;          // 横走通道（错层，避免重叠）
  const yStart = child.y;                         // 支线顶部
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  if (Math.abs(px - cx) < 3) {
    ctx.moveTo(cx, yStart); ctx.lineTo(px, yTop);
  } else {
    ctx.moveTo(cx, yStart);
    ctx.lineTo(cx, yGo);
    ctx.lineTo(px, yGo);
    ctx.lineTo(px, yTop);
  }
  ctx.stroke();
  // 箭头（指向上方，贴住父卡片）
  ctx.fillStyle = color;
  const s2 = 5.5, ang = -Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(px, yTop);
  ctx.lineTo(px - s2 * Math.cos(ang - 0.45), yTop - s2 * Math.sin(ang - 0.45));
  ctx.lineTo(px - s2 * Math.cos(ang + 0.45), yTop - s2 * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* 主线上的取代：向上弓起，避免横穿中间的卡片 */
function arcLink(child, parent, color, width, label) {
  const ax = child.x + child.w, ay = child.y + child.h / 2;
  const bx = parent.x, by = parent.y + parent.h / 2;
  const mx = (ax + bx) / 2;
  const lift = Math.min(52, 16 + Math.abs(bx - ax) * 0.035);
  const my = Math.min(ay, by) - lift;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  // 箭头
  const ang = Math.atan2(by - my, bx - mx);
  ctx.fillStyle = color;
  const sz = 7;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - sz * Math.cos(ang - 0.45), by - sz * Math.sin(ang - 0.45));
  ctx.lineTo(bx - sz * Math.cos(ang + 0.45), by - sz * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill();
  if (label) {
    ctx.fillStyle = color; ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
    const t = ctx.measureText(label).width;
    ctx.fillText(label, mx - t / 2, my - 4);
  }
  ctx.restore();
}

/* L 形折线（思维导图式），比贝塞尔整齐 */
function elbow(child, parent, color, width, label, dashed) {
  const cx = child.x, cy = child.y + child.h / 2;
  const px = parent.x, py = parent.y + parent.h / 2;
  const sameCol = Math.abs(px - cx) < 6;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([3, 3]);
  ctx.beginPath();
  if (sameCol) {
    // 同列：从子节点顶部竖直到父节点底部
    const x = cx + child.w / 2;
    ctx.moveTo(x, child.y);
    ctx.lineTo(x, parent.y + parent.h);
  } else if (px > cx) {
    // 父在右：从子右侧出发
    const y = py;
    const sx = cx + child.w, ex = px;
    ctx.moveTo(sx, cy);
    ctx.lineTo(ex - 10, cy);
    ctx.quadraticCurveTo(ex, cy, ex, cy + (y - cy ? Math.sign(y - cy) * 8 : 0));
    ctx.lineTo(ex, y);
  } else {
    // 父在左：从子左侧出发，先左拐，再上下，再左到父右侧
    const sx = cx, ex = px + parent.w;
    const mid = sx - 10;
    ctx.moveTo(sx, cy);
    ctx.lineTo(mid + 6, cy);
    ctx.quadraticCurveTo(mid, cy, mid, cy + Math.sign(py - cy) * 6);
    ctx.lineTo(mid, py);
    ctx.quadraticCurveTo(mid, py, mid + 6, py);
    ctx.lineTo(ex, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 箭头
  let ax, ay, ang;
  if (sameCol) { ax = cx + child.w / 2; ay = parent.y + parent.h; ang = Math.PI / 2; }
  else if (px > cx) { ax = px; ay = py; ang = Math.PI; }
  else { ax = px + parent.w; ay = py; ang = 0; }
  ctx.fillStyle = color;
  const s = 6;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - s * Math.cos(ang - 0.42), ay - s * Math.sin(ang - 0.42));
  ctx.lineTo(ax - s * Math.cos(ang + 0.42), ay - s * Math.sin(ang + 0.42));
  ctx.closePath(); ctx.fill();

  if (label) {
    ctx.fillStyle = color; ctx.font = "10px 'Microsoft YaHei',sans-serif";
    ctx.fillText(label, (ax + (sameCol ? 0 : 8)), (ay + (sameCol ? 6 : -8)));
  }
  ctx.restore();
}

function drawMinimap() {
  const W = mini.width / DPR, H = mini.height / DPR;
  mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = "#f7fafc"; mctx.fillRect(0, 0, W, H);
  const sx = W / Math.max(1, L.W), sy = H / Math.max(1, L.H);
  L.nodes.forEach(o => {
    const col = o.n.status === "superseded" ? "#c9d3da" : typeOf(o.n.type).color;
    mctx.fillStyle = o.kind === "branch" ? col + "99" : col;
    mctx.fillRect(o.x * sx, o.y * sy, Math.max(2, o.w * sx), Math.max(1.5, o.h * sy));
  });
  const vx = (-cam.x / cam.s) * sx, vy = ((HEADER_H - cam.y) / cam.s) * sy;
  const vw = (canvas.clientWidth / cam.s) * sx, vh = (canvas.clientHeight / cam.s) * sy;
  mctx.strokeStyle = "#1b6e8c"; mctx.lineWidth = 1.4;
  mctx.strokeRect(vx, vy, vw, vh);
  mctx.fillStyle = "rgba(27,110,140,.07)"; mctx.fillRect(vx, vy, vw, vh);
}

/* ---------------- 相机 ---------------- */
function clampCam() {
  const minX = -L.W * 0.4, maxX = Math.max(canvas.clientWidth - 80, L.W * 0.4);
  cam.x = clamp(cam.x, minX, maxX);
  cam.y = clamp(cam.y, HEADER_H - L.H * 1.2, canvas.clientHeight * 0.7);
}
function flyTo(wx, wy, s, dur = 380) {
  const drawerOpen = !$("#drawer").classList.contains("hidden");
  const cx = drawerOpen ? (canvas.clientWidth - 352) / 2 : canvas.clientWidth / 2;
  const tgt = { x: cx - wx * s, y: (canvas.clientHeight + HEADER_H) / 2 - wy * s, s };
  const from = { x: cam.x, y: cam.y, s };
  const t0 = performance.now();
  if (anim) cancelAnimationFrame(anim);
  const step = (now) => {
    const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    cam.x = from.x + (tgt.x - from.x) * e;
    cam.y = from.y + (tgt.y - from.y) * e;
    cam.s = from.s + (tgt.s - from.s) * e;
    draw();
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
function fitView() {
  if (!L.W || !L.H) return;
  const W = canvas.clientWidth, H = canvas.clientHeight - HEADER_H - 10;
  let s = Math.min(W / (L.W + 24), H / (L.H + 16));
  s = clamp(s, 0.2, 1.1);
  cam.s = s;
  const contentH = L.H * s;
  cam.y = contentH < H ? HEADER_H + (H - contentH) / 2 : HEADER_H + 4;
  if (L.W * s <= W) cam.x = (W - L.W * s) / 2;
  else cam.x = W - L.W * s;      // 溢出时贴右：先看最近的状态
  clampCam(); draw();
}

/* ---------------- 命中与交互 ---------------- */
function pick(sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  for (let i = L.nodes.length - 1; i >= 0; i--) {
    const o = L.nodes[i];
    if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) return o;
  }
  return null;
}

function bindCanvas() {
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0012);
    const ns = clamp(cam.s * k, 0.2, 2.2);
    const [wx, wy] = toWorld(e.offsetX, e.offsetY);
    cam.s = ns; cam.x = e.offsetX - wx * ns; cam.y = e.offsetY - wy * ns;
    clampCam(); draw();
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => {
    const o = pick(e.offsetX, e.offsetY);
    if (editMode && o) { dragNode = o.n.id; canvas.classList.add("dragging"); return; }
    if (o && supersedePick) {
      applyEdit({ op: "supersede", id: supersedePick, old: o.n.id });
      supersedePick = null; canvas.classList.remove("editing"); toast("已标记取代"); return;
    }
    if (o) { selectNode(o.n.id); return; }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };
    canvas.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (miniDrag) {   // 小地图拖动
      const mr = mini.getBoundingClientRect();
      const fx = (e.clientX - mr.left) / mr.width, fy = (e.clientY - mr.top) / mr.height;
      cam.x = canvas.clientWidth / 2 - fx * L.W * cam.s;
      cam.y = canvas.clientHeight / 2 - fy * L.H * cam.s;
      clampCam(); draw(); return;
    }
    if (panning) { cam.x = sx - panning.x; cam.y = sy - panning.y; clampCam(); draw(); return; }

    if (dragNode) {
      const o = pick(sx, sy);
      dragPreview = o && o.n.id !== dragNode ? o.n.id : null;
      draw(); return;
    }
    const o = pick(sx, sy);
    const tip = $("#tip");
    if (o && o.n.id !== hoverId) {
      hoverId = o.n.id;
      const n = o.n, f = n.source && n.source.file;
      tip.innerHTML = `<b>${n.title}</b><br>${typeOf(n.type).name} · ${n.content_at}` +
        (f ? `<br>▤ ${f} ${locText(n)}` : `<br>粘贴输入`) +
        `<br><span style="opacity:.75">${(n.summary || "").slice(0, 60)}</span>`;
      tip.style.display = "block";
    } else if (!o) { hoverId = null; tip.style.display = "none"; }
    if (tip.style.display === "block") {
      tip.style.left = Math.min(sx + 16, canvas.clientWidth - 290) + "px";
      tip.style.top = Math.max(HEADER_H + 6, sy + 18) + "px";
    }
  });

  window.addEventListener("mouseup", () => {
    if (miniDrag) { miniDrag = null; return; }
    if (dragNode) {
      const id = dragNode, parent = dragPreview;
      dragNode = null; dragPreview = null; canvas.classList.remove("dragging");
      if (parent) applyEdit({ op: "reparent", id, parent });
      draw();
    }
    if (panning) { panning = null; canvas.classList.remove("dragging"); }
  });

  canvas.addEventListener("dblclick", (e) => {
    const o = pick(e.offsetX, e.offsetY);
    if (o) flyTo(o.x + o.w / 2, o.y + o.h / 2, Math.min(1.15, cam.s * 1.5));
  });

  // 小地图：按下即拖动
  mini.addEventListener("mousedown", (e) => { e.preventDefault(); miniDrag = true; mini.dispatchEvent(new MouseEvent("mousemove", e)); });
  window.addEventListener("resize", resize);

  $("#z-in").onclick = () => { cam.s = clamp(cam.s * 1.25, 0.2, 2.2); clampCam(); draw(); };
  $("#z-out").onclick = () => { cam.s = clamp(cam.s / 1.25, 0.2, 2.2); clampCam(); draw(); };
  $("#z-fit").onclick = fitView;
}

/* ---------------- 左导航 ---------------- */
function renderNav() {
  if (L.mode === "all") return renderNavAll();
  const nodes = L.nodes.map(o => o.n);
  const spine = L.nodes.filter(o => o.kind === "spine").map(o => o.n);
  const branch = L.nodes.filter(o => o.kind === "branch").map(o => o.n);
  $("#spine-count").textContent = spine.length;
  $("#branch-count").textContent = branch.length;

  const withFile = nodes.filter(n => n.source && n.source.file).length;
  const sup = nodes.filter(n => n.status === "superseded").length;
  $("#nav-stats").innerHTML =
    `<div><b>${nodes.length}</b>节点</div><div><b>${withFile}</b>有原文</div>` +
    `<div><b>${spine.length}</b>主线</div><div><b>${sup}</b>已取代</div>`;

  const mk = (list, box) => {
    box.innerHTML = "";
    list.forEach(n => {
      const t = typeOf(n.type), f = n.source && n.source.file;
      const d = el("div", "nav-item" + (n.id === focusId ? " on" : ""));
      d.innerHTML = `<span class="dot" style="background:${n.status === "superseded" ? "#c3ccd3" : t.color}"></span>
        <span class="tx">${n.title}${f ? `<br><span style="color:#94a3ae;font-size:10.5px">▤ ${shortFile(f)}</span>` : ""}</span>`;
      d.onclick = () => { const o = L.nodes.find(x => x.n.id === n.id); if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, Math.max(cam.s, .8)); selectNode(n.id); } };
      box.appendChild(d);
    });
  };
  mk(spine, $("#nav-spine"));
  mk(branch, $("#nav-branch"));

  const q = $("#nav-queue"); q.innerHTML = "";
  if (!S.queue.length) q.innerHTML = `<div class="muted" style="padding:2px 6px">队列是空的</div>`;
  S.queue.forEach(item => {
    const d = el("div", "nav-item");
    d.innerHTML = `<span class="dot" style="background:#c9942f"></span><span class="tx">${item.text}</span>`;
    d.onclick = () => openPlace({ ...item, truncated: false });
    q.appendChild(d);
  });
}

function renderNavAll() {
  $("#spine-count").textContent = L.projects.length;
  $("#branch-count").textContent = "-";
  const total = S.nodes.filter(n => n.status !== "deleted").length;
  $("#nav-stats").innerHTML = `<div><b>${L.projects.length}</b>项目</div><div><b>${total}</b>节点</div>` +
    `<div><b>${S.queue.length}</b>待归类</div><div><b>-</b>—</div>`;
  const box = $("#nav-spine"); box.innerHTML = "";
  L.projects.forEach(p => {
    const d = el("div", "nav-item");
    d.innerHTML = `<span class="dot" style="background:${p.color}"></span>
      <span class="tx">${p.name}<br><span style="color:#94a3ae;font-size:10.5px">主线 ${p.spine} · 共 ${p.total}</span></span>`;
    d.onclick = () => { L.mode = "one"; curProject = p.id; loadState().then(() => { computeLayout(); fitView(); renderNav(); }); };
    box.appendChild(d);
  });
  $("#nav-branch").innerHTML = `<div class="muted" style="padding:2px 6px">全景只显示主线；点项目进详情</div>`;
  const q = $("#nav-queue"); q.innerHTML = "";
  S.queue.forEach(item => {
    const d = el("div", "nav-item");
    d.innerHTML = `<span class="dot" style="background:#c9942f"></span><span class="tx">${item.text}</span>`;
    d.onclick = () => openPlace({ ...item, truncated: false });
    q.appendChild(d);
  });
}

/* ---------------- 详情 ---------------- */
function selectNode(id) {
  const n = S.nodes.find(x => x.id === id);
  if (!n) return;
  focusId = id;
  const t = typeOf(n.type), p = projectOf(n.project);
  $("#d-title").textContent = n.title;
  $("#d-meta").textContent = `${t.name} · ${n.content_at} · ${p.name}`;
  const body = $("#d-body"); body.innerHTML = "";

  const st = el("div", "", `
    <span class="chip ${n.status === "superseded" ? "red" : "green"}">${n.status === "superseded" ? "已取代" : n.status === "draft" ? "草稿" : "有效"}</span>
    <span class="chip blue">${n.auto ? "AI 自动挂" : "人工"}</span>
    <span class="chip">${n.placement === "attach" ? "作为证据" : "独立节点"}</span>
    <span class="chip">置信度 ${(n.confidence ?? 1).toFixed(2)}</span>`);
  body.appendChild(st);

  // 出处（放在最上面，一眼能看到）
  const src = n.source || {};
  body.appendChild(el("h4", "", "出处"));
  if (src.file) {
    const box = el("div", "source-box");
    box.innerHTML = `<div class="source-file">▤ ${src.file}</div>
      <div class="source-loc">${locText(n) || "全文"}　·　${src.locator && src.locator.kind === "pdf" ? "PDF" : "文本"}</div>
      <div class="source-ex"></div>`;
    box.querySelector(".source-ex").textContent = src.excerpt || "（无摘要）";
    body.appendChild(box);
    const b = el("button", "btn primary small", "打开原文并定位");
    b.style.marginTop = "8px";
    b.onclick = () => showFile(n, box.querySelector(".source-ex"));
    body.appendChild(b);
  } else {
    body.appendChild(el("div", "muted", "粘贴输入，无文件载体。"));
    if (src.excerpt) { const ev = el("div", "source-ex"); ev.textContent = src.excerpt; body.appendChild(ev); }
  }

  // 字段
  const ex = n.extra || {};
  if (Object.keys(ex).length) {
    body.appendChild(el("h4", "", "字段"));
    const kv = el("div", "kv");
    Object.entries(ex).forEach(([k, v]) => {
      kv.appendChild(el("div", "k", k));
      kv.appendChild(el("div", "", String(v)));
    });
    body.appendChild(kv);
  }

  // 脉络
  const rel = S.edges.filter(e => e.from === id || e.to === id);
  if (rel.length) {
    body.appendChild(el("h4", "", "脉络"));
    rel.forEach(e => {
      const otherId = e.from === id ? e.to : e.from;
      const o = L.nodes.find(x => x.n.id === otherId);
      const kindTxt = { derived: "派生", supersedes: "取代", relates: "关联", attach: "挂载" }[e.kind] || e.kind;
      const dir = e.from === id ? "↘" : "↖";
      const line = el("div", "rel", `<span class="k">${dir} ${kindTxt}</span><span>${o ? o.n.title : otherId}</span>`);
      if (o) line.onclick = () => { selectNode(otherId); flyTo(o.x + o.w / 2, o.y + o.h / 2, cam.s); };
      body.appendChild(line);
    });
  }

  // 操作
  const acts = el("div", "btnrow");
  const mk = (label, fn) => { const b = el("button", "btn ghost small", label); b.onclick = fn; acts.appendChild(b); };
  mk("标记取代…", () => { supersedePick = id; canvas.classList.add("editing"); toast("点一个被取代的节点"); });
  mk(n.status === "draft" ? "转有效" : "转草稿", () => applyEdit({ op: "status", id, status: n.status === "draft" ? "active" : "draft" }));
  mk("删除", () => { if (confirm("软删除？可 Ctrl+Z 撤销")) applyEdit({ op: "delete", id }); });
  const sel = el("select");
  sel.style.cssText = "height:25px;border:1px solid var(--line);border-radius:6px;font:inherit;padding:0 4px";
  sel.innerHTML = S.types.map(t2 => `<option value="${t2.id}" ${t2.id === n.type ? "selected" : ""}>${t2.name}</option>`).join("");
  sel.onchange = () => applyEdit({ op: "retype", id, type: sel.value });
  acts.appendChild(sel);
  body.appendChild(acts);

  $("#drawer").classList.remove("hidden");
  renderNav();
  draw();
}

async function showFile(n, evBox) {
  const d = await api("/api/file?node=" + encodeURIComponent(n.id));
  evBox.innerHTML = "";
  if (d.error) { evBox.textContent = d.error; return; }
  if (d.kind === "pdf") {
    const box = el("div", "imgbox");
    box.innerHTML = `<img src="${d.image}" />`;
    evBox.appendChild(box);
    evBox.appendChild(el("div", "muted", `${d.name} · 第 ${d.page} / ${d.total_pages} 页（红框为命中段）`));
  } else {
    const txt = d.text || "", s = d.start, e = d.end;
    if (s != null && e != null && s >= 0) evBox.innerHTML = txt.slice(0, s) + "<mark>" + txt.slice(s, e) + "</mark>" + txt.slice(e);
    else evBox.textContent = txt.slice(0, 3000);
  }
}

/* ---------------- 编辑 ---------------- */
async function applyEdit(payload) {
  await api("/api/edit", payload);
  await loadState(); computeLayout(); renderNav(); draw();
  if (payload.id && payload.op !== "delete") selectNode(payload.id);
  toast("已更新");
}

/* ---------------- 检索 ---------------- */
let sTimer = null;
async function doSearch(q, fly = true) {
  const hint = $("#search-hint");
  if (!q.trim()) { highlight.clear(); hint.classList.remove("on"); draw(); return; }
  const d = await api("/api/search?q=" + encodeURIComponent(q));
  highlight = new Set(d.hits.map(h => h.id));
  (d.neighbors || []).forEach(id => highlight.add(id));
  lastSearch = d;
  $("#trace").textContent = (d.trace || []).join("　→　");
  if (d.hits.length) {
    if (!DEMO) {
      hint.innerHTML = d.hits.slice(0, 6).map(h =>
        `<div class="hint-item" data-id="${h.id}"><div class="t">${h.title}</div>
         <div class="m">${typeOf(h.type).name} · ${projectOf(h.project).name} · ${h.score}</div></div>`).join("");
      hint.classList.add("on");
      hint.querySelectorAll(".hint-item").forEach(it => {
        it.onclick = () => { const o = L.nodes.find(x => x.n.id === it.dataset.id); if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, Math.max(cam.s, .9)); selectNode(it.dataset.id); } hint.classList.remove("on"); };
      });
    } else hint.classList.remove("on");
    if (fly) {
      const o = L.nodes.find(x => x.n.id === d.hits[0].id);
      if (o) flyTo(o.x + o.w / 2, o.y + o.h / 2, Math.max(cam.s, .85));
    }
  } else if (!DEMO) {
    hint.innerHTML = `<div class="hint-item"><div class="m">没有命中。试试「定价」「口径」「预算」</div></div>`;
    hint.classList.add("on");
    $("#trace").textContent = "① 判意图 → ② 检索 0 命中 → ③ 无凭证，拒答（这就是诚实地不知道）";
  }
  renderNav(); draw();
}

/* ---------------- 收进来 ---------------- */
async function capture() {
  const text = $("#capture-text").value.trim();
  if (!text) return toast("先粘点东西");
  const date = $("#capture-date").value || null;
  const d = await api("/api/capture", { text, date });
  $("#modal-capture").classList.add("hidden");
  await loadState(); computeLayout(); renderNav(); draw();
  const auto = d.items.filter(i => i.committed).length;
  const pop = d.items.filter(i => !i.committed && i.cls.action === "popup");
  const queued = d.items.filter(i => !i.committed && i.cls.action === "queue").length;
  toast(`切出 ${d.items.length} 条：自动挂 ${auto}，待确认 ${pop.length}，进队列 ${queued}，丢弃 ${d.dropped.length}`);
  if (pop.length) openPlace(pop[0], pop.slice(1));
  else if (auto) {
    const last = d.items.filter(i => i.committed).pop();
    const o = L.nodes.find(x => x.n.id === last.node_id);
    if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, 1); selectNode(last.node_id); }
  }
}

let placeQueue = [];
function openPlace(item, rest = []) {
  placeQueue = rest;
  const cls = item.cls || {};
  $("#place-text").textContent = item.text + (item.truncated ? "（原文可能不完整）" : "");
  $("#place-why").textContent = cls.margin != null
    ? `判断置信度 ${(cls.confidence ?? 0).toFixed(2)}，但前两个候选只差 ${cls.margin.toFixed(3)} —— AI 在“挂在谁下面”这件事上没把握，所以问你。`
    : "";
  const box = $("#place-cands"); box.innerHTML = "";
  let picked = null;
  (cls.candidates || []).slice(0, 3).forEach((c, i) => {
    const n = S.nodes.find(x => x.id === c.id) || {};
    const div = el("div", "cand" + (i === 0 ? " sel" : ""));
    div.innerHTML = `<span class="sc">${c.score}</span>
      <div class="path">${projectOf(n.project).name} ▸ ${typeOf(n.type).name} ▸ ${n.title || c.id}</div>
      <div class="why">${i === 0 ? "最像这一条的上游" : "次选"}</div>`;
    div.onclick = () => { box.querySelectorAll(".cand").forEach(x => x.classList.remove("sel")); div.classList.add("sel"); picked = c.id; };
    box.appendChild(div);
    if (i === 0) picked = c.id;
  });
  $("#place-custom").value = "";
  $("#modal-place").classList.remove("hidden");

  $("#place-confirm").onclick = async () => {
    const custom = $("#place-custom").value.trim();
    const r = await api("/api/place", {
      item: { id: item.id, text: item.text, at: item.at, speaker: item.speaker, cls },
      parent: custom ? null : picked,
      project: cls.project, type: cls.type, placement: cls.placement,
      new_node_title: custom || null,
    });
    $("#modal-place").classList.add("hidden");
    await loadState(); computeLayout(); renderNav(); draw();
    const o = r.node_id && L.nodes.find(x => x.n.id === r.node_id);
    if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, 1); selectNode(r.node_id); }
    toast("已挂上，并记住这次的判断");
    if (placeQueue.length) openPlace(placeQueue.shift(), placeQueue);
  };
}

/* ---------------- 类型 ---------------- */
function addFieldRow(key = "", kind = "文本") {
  const row = el("div", "field-row");
  row.innerHTML = `<input placeholder="字段名（中文）" value="${key}" />
    <select>${["文本", "长文本", "日期", "人员", "数字", "单选", "链接"].map(k => `<option ${k === kind ? "selected" : ""}>${k}</option>`).join("")}</select>`;
  $("#type-fields").appendChild(row);
}

/* ---------------- 事件 ---------------- */
function bindUI() {
  $("#btn-capture").onclick = () => {
    $("#modal-capture").classList.remove("hidden");
    $("#capture-date").valueAsDate = new Date();
    $("#capture-text").focus();
  };
  $("#capture-go").onclick = capture;
  $("#btn-edit").onclick = () => {
    editMode = !editMode;
    $("#btn-edit").classList.toggle("on", editMode);
    canvas.classList.toggle("editing", editMode);
    toast(editMode ? "调整模式：拖动节点到另一个节点上即可改父节点" : "已退出调整模式");
  };
  $("#btn-queue").onclick = () => {
    $("#nav").classList.remove("collapsed");
    const first = $("#nav-queue").querySelector(".nav-item");
    if (first) first.click(); else toast("队列是空的");
  };
  $("#nav-toggle").onclick = () => {
    const n = $("#nav");
    n.classList.toggle("collapsed");
    $("#nav-toggle").textContent = n.classList.contains("collapsed") ? "›" : "‹";
    setTimeout(resize, 200);
  };
  $("#d-close").onclick = () => { $("#drawer").classList.add("hidden"); focusId = null; renderNav(); draw(); };
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
    await api("/api/type", { name, fields, color: "#B4743A" });
    $("#modal-type").classList.add("hidden");
    await loadState(); toast("类型已创建");
  };
  $("#btn-git").onclick = async () => {
    toast("正在读取 git 历史…");
    const d = await api("/api/git", {});
    if (d.error) return toast("git 读取失败：" + d.error);
    await loadState();
    curProject = "p_code"; L.mode = "one";
    await loadState(); computeLayout(); fitView(); renderNav();
    toast(`已接入 ${d.added} 个版本节点（共 ${d.total} 个）`);
  };
  $("#search").addEventListener("input", (e) => { clearTimeout(sTimer); const q = e.target.value; sTimer = setTimeout(() => doSearch(q), 260); });
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch(e.target.value);
    if (e.key === "Escape") { e.target.value = ""; doSearch(""); $("#search-hint").classList.remove("on"); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) $("#search-hint").classList.remove("on"); });
  $("#trace-toggle").onclick = () => {
    const t = $("#trace");
    if (t.dataset.full) { t.textContent = t.dataset.full; t.dataset.full = ""; }
    else { t.dataset.full = t.textContent; t.textContent = (lastSearch && lastSearch.trace || []).join("  |  "); }
  };
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest(".modal").classList.add("hidden"));

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA";
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
      $("#drawer").classList.add("hidden"); $("#search-hint").classList.remove("on");
      focusId = null; renderNav(); draw();
    }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
    if (e.key === "e" || e.key === "E") $("#btn-edit").click();
    if (e.key === "f" || e.key === "F") fitView();
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      api("/api/undo", {}).then(async () => { await loadState(); computeLayout(); renderNav(); draw(); toast("已撤销"); });
    }
    const step = 80;
    if (e.key === "ArrowLeft") { cam.x += step; clampCam(); draw(); }
    if (e.key === "ArrowRight") { cam.x -= step; clampCam(); draw(); }
    if (e.key === "ArrowUp") { cam.y += step; clampCam(); draw(); }
    if (e.key === "ArrowDown") { cam.y -= step; clampCam(); draw(); }
  });
}

/* ---------------- 启动 ---------------- */
async function boot() {
  canvas = $("#canvas"); ctx = canvas.getContext("2d");
  mini = $("#minimap"); mctx = mini.getContext("2d");
  bindUI(); bindCanvas();

  await loadState();
  curProject = (S.projects.find(p => p.id === "p_pricing") || S.projects[0] || {}).id;

  const qs = new URLSearchParams(location.search);

  if (qs.get("view") === "all") L.mode = "all";
  await loadState();
  computeLayout(); resize(); fitView(); renderNav();

  if (qs.get("demo") === "place") {
    DEMO = true;
    const cands = ["n08", "n07", "n09"].map(id => S.nodes.find(n => n.id === id)).filter(Boolean);
    openPlace({
      id: "it_demo", text: "定价就按 B 方案走吧，A 的风险太大", at: "2026-11-19", speaker: "张三", truncated: false,
      cls: { type: "decision", project: "p_pricing", placement: "grow", confidence: 0.851, margin: 0.007,
             candidates: cands.map((n, i) => ({ id: n.id, score: [0.42, 0.40, 0.31][i] || 0.3 })) },
    });
    return;
  }
  const q = qs.get("q");
  if (q) {
    DEMO = true;
    await doSearch(q, true);
    if (lastSearch && lastSearch.hits.length) {
      const id = lastSearch.hits[0].id;
      setTimeout(() => {
        const o = L.nodes.find(x => x.n.id === id);
        if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, Math.max(cam.s, .9)); selectNode(id); }
      }, 420);
    }
  }
  const nid = qs.get("node");
  if (nid) {
    const o = L.nodes.find(x => x.n.id === nid);
    if (o) { flyTo(o.x + o.w / 2, o.y + o.h / 2, 1); selectNode(nid); }
  }
}
boot();
