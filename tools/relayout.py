# -*- coding: utf-8 -*-
"""重写布局与绘制：
   1) 先找出“最长链”，把它钉成一条水平主干（不再弯曲）
   2) 其余节点用力导向挂在主干上下
   3) 七类节点用七种形状：菱形/文档折角/胶囊/标签/双框/圆角卡片
"""
import io

p = "D:/03_code_list/project-git-项目知识时间轴/desktop/web/app.js"
s = io.open(p, encoding="utf-8").read()

# ---------------- A) 替换 rebuild（含最长链 + 钉住主干） ----------------
i1 = s.index("function rebuild() {")
i2 = s.index("function deoverlap(")
new_rebuild = r'''/** 在 DAG 上找最长链（按节点数），用作主干 */
function longestChain(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map();
  const roots = [];
  nodes.forEach((n) => {
    if (n.parent && ids.has(n.parent)) {
      if (!kids.has(n.parent)) kids.set(n.parent, []);
      kids.get(n.parent).push(n.id);
    } else roots.push(n.id);
  });
  const memo = new Map();
  function depth(id) {
    if (memo.has(id)) return memo.get(id);
    const ch = kids.get(id) || [];
    let best = 0;
    for (const c of ch) best = Math.max(best, depth(c));
    memo.set(id, best + 1);
    return best + 1;
  }
  let start = null, bestLen = 0;
  for (const id of roots) {
    const d = depth(id);
    if (d > bestLen) { bestLen = d; start = id; }
  }
  // 没有根（全是环）就退化成时间最早的节点
  if (!start) {
    start = nodes.slice().sort((a, b) => (a.content_at < b.content_at ? -1 : 1))[0].id;
  }
  const chain = [start];
  let cur = start;
  while (true) {
    const ch = (kids.get(cur) || []).slice();
    if (!ch.length) break;
    ch.sort((a, b) => depth(b) - depth(a));
    cur = ch[0];
    chain.push(cur);
  }
  return chain;
}

function rebuild() {
  const vn = visibleNodes();
  const times = vn.map((n) => msOf(n.content_at)).filter(Boolean);
  t0 = times.length ? Math.min(...times) : 0;
  t1 = times.length ? Math.max(...times) : t0 + 1;

  const old = new Map(ns.map((d) => [d.id, d]));
  ns = vn.map((n) => ({
    id: n.id, n,
    w: CARD_W, h: CARD_H,
    x: (old.get(n.id) ? old.get(n.id).x : (Math.random() - 0.5) * 200),
    y: (old.get(n.id) ? old.get(n.id).y : (Math.random() - 0.5) * 200),
    fx: null, fy: null,
  }));
  byId = new Map(ns.map((d) => [d.id, d]));
  ls = S.edges.filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

  // —— 主干：钉在一条水平线上 ——
  const chain = longestChain(vn);
  const PITCH = CARD_W + 52;
  const x0 = -((chain.length - 1) * PITCH) / 2;
  chain.forEach((id, i) => {
    const d = byId.get(id);
    if (!d) return;
    d.fx = x0 + i * PITCH;
    d.fy = 0;
    d.main = true;
  });
  chainSet = new Set(chain);

  if (sim) sim.stop();
  sim = d3.forceSimulation(ns)
    .force('link', d3.forceLink(ls).id((d) => d.id).distance(150).strength(0.35))
    .force('charge', d3.forceManyBody().strength(-620).distanceMax(900))
    .force('collide', d3.forceCollide().radius((d) => (d.main ? 105 : 96)).iterations(2))
    .force('y', d3.forceY((d) => (d.main ? 0 : (d.y >= 0 ? 210 : -210))).strength(0.06))
    .force('x', d3.forceX((d) => d.fx != null ? d.fx : ((msOf(d.n.content_at) || t0) - t0) / Math.max(1, t1 - t0) * 520 - 260).strength(0.08))
    .alphaDecay(0.03)
    .on('tick', draw)
    .on('end', () => { deoverlap(320); fit(); });

  selected = null; hovered = null; active = null;
  $('#drawer').classList.add('hidden');
  renderNav();
  draw();
  setTimeout(fit, 300);
}

'''
s = s[:i1] + new_rebuild + s[i2:]

# ---------------- B) 替换 draw / drawCard ----------------
j1 = s.index("function draw() {")
j2 = s.index("function truncate(")
new_draw = r'''function draw() {
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.k, cam.k);

  const focus = active && active.size ? active : null;

  // 主干基线：一条很淡的横线，让“主脉络”一眼可见
  const mainNodes = ns.filter((d) => d.main);
  if (mainNodes.length > 1) {
    const xs = mainNodes.map((d) => d.x);
    ctx.strokeStyle = 'rgba(120,132,146,0.22)';
    ctx.lineWidth = 1.4 / cam.k;
    ctx.beginPath();
    ctx.moveTo(Math.min(...xs) - CARD_W / 2, 0);
    ctx.lineTo(Math.max(...xs) + CARD_W / 2, 0);
    ctx.stroke();
  }

  ls.forEach((l) => {
    const a = byId.get(l.source.id || l.source), b = byId.get(l.target.id || l.target);
    if (!a || !b) return;
    const on = !focus || (focus.has(a.id) && focus.has(b.id));
    const isSup = l.kind === 'supersedes';
    const dead = a.n.status === 'abandoned' || b.n.status === 'abandoned';
    const p1 = edgePoint(a, b), p2 = edgePoint(b, a);

    ctx.globalAlpha = on ? 1 : 0.14;
    ctx.strokeStyle = isSup ? 'rgba(217,83,79,0.7)' : (dead ? 'rgba(178,186,196,0.6)' : 'rgba(158,170,183,0.55)');
    ctx.lineWidth = (isSup ? 1.8 : 1) / cam.k;

    if (dead) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
      const gx = dx / len * 9, gy = dy / len * 9;
      ctx.setLineDash([5 / cam.k, 4 / cam.k]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mx - gx, my - gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + gx, my + gy); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      const s2 = 5 / cam.k;
      ctx.strokeStyle = 'rgba(178,186,196,0.95)';
      ctx.beginPath();
      ctx.moveTo(mx - s2, my - s2); ctx.lineTo(mx + s2, my + s2);
      ctx.moveTo(mx + s2, my - s2); ctx.lineTo(mx - s2, my + s2);
      ctx.stroke();
    } else {
      ctx.setLineDash(l.kind === 'relates' || l.kind === 'attach' ? [4 / cam.k, 4 / cam.k] : []);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      if (isSup) {
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const s2 = 6 / cam.k;
        ctx.fillStyle = 'rgba(217,83,79,0.85)';
        ctx.beginPath(); ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - s2 * Math.cos(ang - 0.45), p2.y - s2 * Math.sin(ang - 0.45));
        ctx.lineTo(p2.x - s2 * Math.cos(ang + 0.45), p2.y - s2 * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
      }
    }
  });
  ctx.globalAlpha = 1;

  ns.forEach((d) => drawNode(d, focus));
  ctx.restore();
}

/* —— 七类节点，七种形状 —— */
function nodePath(type, x, y, w, h) {
  ctx.beginPath();
  if (type === 'decision') {                  // 六边形（像一枚印章）
    const c = 16;
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  } else if (type === 'data') {               // 胶囊（像一条数据）
    const r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  } else if (type === 'code') {               // 标签（右侧尖角）
    const c = 14;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else if (type === 'doc' || type === 'retro') {   // 文档：右上角折角
    const c = 18;
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - 8);
    ctx.quadraticCurveTo(x + w, y + h, x + w - 8, y + h);
    ctx.lineTo(x + 8, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - 8);
    ctx.lineTo(x, y + 8);
    ctx.quadraticCurveTo(x, y, x + 8, y);
    ctx.closePath();
  } else {                                    // 方案 / 产出：圆角卡片
    roundRect(ctx, x, y, w, h, 9);
  }
}

const FILL = {
  plan: '#ffffff', decision: '#fdf2f1', retro: '#f7f5fd', doc: '#fbf7f3',
  data: '#f1faf8', code: '#f6f8fb', output: '#fffaf0', asset: '#f6fbf4', version: '#f7f8f9',
};

function drawNode(d, focus) {
  const n = d.n;
  const on = !focus || focus.has(n.id);
  const abandoned = n.status === 'abandoned';
  const sup = n.status === 'superseded';
  const col = abandoned || sup ? '#b9c2cb' : (COLOR[n.type] || '#8a97a5');
  const isSel = selected === n.id, isHov = hovered === n.id;
  const x = d.x - d.w / 2, y = d.y - d.h / 2;

  ctx.globalAlpha = on ? 1 : 0.16;

  if (isSel || isHov) {
    ctx.save();
    ctx.shadowColor = 'rgba(17,24,39,.18)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    nodePath(n.type, x, y, d.w, d.h);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }

  nodePath(n.type, x, y, d.w, d.h);
  ctx.fillStyle = abandoned ? '#f7f8f9' : (FILL[n.type] || '#fff');
  ctx.fill();
  ctx.lineWidth = (isSel || isHov ? 2 : 1.3) / cam.k;
  ctx.strokeStyle = col;
  if (abandoned) ctx.setLineDash([5 / cam.k, 4 / cam.k]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (n.type === 'output') {   // 产出：双框
    const pad = 3.5;
    nodePath(n.type, x + pad, y + pad, d.w - pad * 2, d.h - pad * 2);
    ctx.lineWidth = 1 / cam.k;
    ctx.strokeStyle = col + '66';
    ctx.stroke();
  }

  const leftInset = n.type === 'decision' ? 26 : (n.type === 'data' ? 22 : 13);
  const innerW = d.w - leftInset - 14;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  ctx.fillStyle = abandoned ? '#9aa5b1' : (n.type === 'decision' ? '#a33b36' : '#111827');
  ctx.font = `600 ${n.type === 'decision' ? 12.5 : 12}px "Microsoft YaHei",sans-serif`;
  ctx.fillText(truncate(ctx, n.title, innerW), x + leftInset, y + 9);

  const key = keyLine(n);
  if (key) {
    ctx.fillStyle = abandoned ? '#a9b2bc' : '#5b6673';
    ctx.font = '10.5px "Microsoft YaHei",sans-serif';
    ctx.fillText(truncate(ctx, key, innerW + 8), x + leftInset, y + 28);
  }

  ctx.fillStyle = '#9aa5b1';
  ctx.font = '9.5px "Microsoft YaHei",sans-serif';
  ctx.fillText(`${typeOf(n.type).name} · ${n.content_at}`, x + leftInset, y + d.h - 16);

  if (abandoned || sup) {
    const tag = abandoned ? '已放弃' : '已取代';
    ctx.fillStyle = abandoned ? '#eef1f4' : '#fdf0ef';
    roundRect(ctx, x + d.w - 56, y + d.h - 20, 46, 14, 4); ctx.fill();
    ctx.fillStyle = abandoned ? '#8794a1' : '#c06a63';
    ctx.font = '9px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tag, x + d.w - 33, y + d.h - 18);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;
}

'''
s = s[:j1] + new_draw + s[j2:]

# ---------------- C) 全局变量：chainSet ----------------
s = s.replace("let edit = false, dragInfo = null,", "let chainSet = new Set();\nlet edit = false, dragInfo = null,")

io.open(p, "w", encoding="utf-8").write(s)
print("rewritten:", len(s), "chars")
