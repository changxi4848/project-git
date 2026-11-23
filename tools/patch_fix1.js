'use strict';
/* 四项改动：间距/多行解释/正交走线/点空白关闭 */
const fs = require('fs');
const p = 'desktop/web/app.js';
let s = fs.readFileSync(p, 'utf8');
const before = s;

/* 1) 主干间距拉大 */
s = s.replace('const GAP_X = 104, GAP_Y = 150;', 'const GAP_X = 186, GAP_Y = 190;');

/* 2) wrapText 支持多行 */
s = s.replace('function wrapText(text, maxW, font) {',
              'function wrapText(text, maxW, font, maxLines) {\n  const LIMIT = maxLines || 2;');
s = s.replace('      if (lines.length >= 2) { cur = \'\'; break; }',
              '      if (lines.length >= LIMIT) { cur = \'\'; break; }');
s = s.replace('  if (cur && lines.length < 2) lines.push(cur);',
              '  if (cur && lines.length < LIMIT) lines.push(cur);');

/* 3) 分支记录父卡位置 */
s = s.replace("    const pnode = byNid.get(sorted[0].parent);\n    const startX = p && trunkX.has(p.id) ? trunkX.get(p.id) : 0;",
  "    const pnode = byNid.get(sorted[0].parent);\n    const startX = p && byId.get(p.id) ? byId.get(p.id).x : (p && trunkX.has(p.id) ? trunkX.get(p.id) : 0);\n    const parentY = p && byId.get(p.id) ? byId.get(p.id).y : 0;\n    const parentH = p && byId.get(p.id) ? byId.get(p.id).h : CARD_H1;");
s = s.replace("    binfo.push({ name, startX, y, endX: bx - GAP_X * 0.7 - CARD_W / 2, last });",
              "    binfo.push({ name, startX, parentY, parentH, y, endX: bx - GAP_X * 0.7 - CARD_W / 2, last });");

/* 4) 主干过渡说明：多行，放在两卡之间 */
s = s.replace(`    const why = (trunk[i + 1].extra && trunk[i + 1].extra['理由']) || '';
    if (why) {
      ctx.font = '400 11px "Microsoft YaHei"';
      const t = fitText(why, 120);
      const tw = ctx.measureText(t).width + 14;
      const mx = (a.x + b.x) / 2;
      const ly = y - Math.max(a.h, b.h) / 2 - 26;
      roundRect(mx - tw / 2, ly, tw, 22, 6);
      ctx.fillStyle = '#F7F9FB'; ctx.fill();
      ctx.strokeStyle = '#E9EEF3'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#5B6673'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t, mx, ly + 11);
      ctx.textAlign = 'left';
    }`,
`    const why = (trunk[i + 1].extra && trunk[i + 1].extra['理由']) || '';
    if (why) {
      const maxW = (b.x - CARD_W / 2) - (a.x + CARD_W / 2) - 28;
      const lines = wrapText(why, maxW, '400 11.5px "Microsoft YaHei"', 3);
      ctx.font = '400 11.5px "Microsoft YaHei"';
      const tw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 20;
      const th = lines.length * 16 + 12;
      const mx = (a.x + b.x) / 2;
      const ly = y - 20 - th;
      roundRect(mx - tw / 2, ly, tw, th, 7);
      ctx.fillStyle = '#F5F8FB'; ctx.fill();
      ctx.strokeStyle = '#E4EAF1'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = '#4E5A67'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((ln, k) => ctx.fillText(ln, mx, ly + 15 + k * 16));
      ctx.textAlign = 'left';
    }`);

/* 5) 分支线：正交、从父卡顶部竖出 */
s = s.replace(`    ctx.strokeStyle = '#AEB9C5'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.startX, -CARD_H1 / 2);
    ctx.lineTo(b.startX + 46, b.y);
    ctx.lineTo(b.endX + CARD_W / 2, b.y);
    ctx.stroke();`,
`    const sy = (b.parentY || 0) - (b.parentH || CARD_H1) / 2;
    ctx.strokeStyle = '#AEB9C5'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(b.startX, sy);
    ctx.lineTo(b.startX, b.y);
    ctx.lineTo(b.endX - CARD_W / 2, b.y);
    ctx.stroke();`);

/* 6) 合并线：横到目标上方再竖直下来，箭头指向卡顶 */
s = s.replace(`    ctx.strokeStyle = '#9DB4C7'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(info.endX + CARD_W / 2, info.y);
    ctx.lineTo(it.x - 60, info.y);
    ctx.lineTo(it.x - CARD_W / 2 - 4, it.y - CARD_H1 / 2);
    ctx.stroke();`,
`    ctx.strokeStyle = '#9DB4C7'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(info.endX + CARD_W / 2, info.y);
    ctx.lineTo(it.x, info.y);
    ctx.lineTo(it.x, it.y - it.h / 2 - 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(it.x, it.y - it.h / 2 + 1);
    ctx.lineTo(it.x - 4.5, it.y - it.h / 2 + 9);
    ctx.lineTo(it.x + 4.5, it.y - it.h / 2 + 9);
    ctx.closePath();
    ctx.fillStyle = '#9DB4C7'; ctx.fill();`);

/* 7) 点空白关闭侧栏与预览 */
s = s.replace(`    if (it) { select(it.id); return; }
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };`,
`    if (it) { select(it.id); return; }
    if (selected) { selected = null; draw(); }
    const pn = $('#panel'), pv = $('#preview');
    if (pn && !pn.classList.contains('hidden')) pn.classList.add('hidden');
    if (pv && !pv.classList.contains('hidden')) pv.classList.add('hidden');
    panning = { x: e.offsetX - cam.x, y: e.offsetY - cam.y };`);

if (s === before) { console.log('NO CHANGE'); process.exit(1); }
fs.writeFileSync(p, s);
console.log('patched');
