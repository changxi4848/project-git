'use strict';
/* 布局体检：检查卡片/材料框/分支之间是否有重叠，行高是否容纳材料 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs');
const files = fs.readdirSync(dir).filter((f) => /^dump-.*\.json$/.test(f));
let bad = 0;

function aabb(a) {
  return { x0: a.x - a.w / 2, x1: a.x + a.w / 2, y0: a.y - a.h / 2, y1: a.y + a.h / 2 };
}
function overlap(a, b, pad = 0) {
  const A = aabb(a), B = aabb(b);
  const dx = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
  const dy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
  return dx > pad && dy > pad ? { dx, dy } : null;
}

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!d.items) { console.log(f, 'no items'); continue; }
  const cards = d.items.filter((i) => i.kind !== 'material');
  const mats = d.items.filter((i) => i.kind === 'material');
  const issues = [];

  // 1) 卡片之间不能重叠
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const o = overlap(cards[i], cards[j], 2);
      if (o) issues.push(`卡片重叠 ${cards[i].id} × ${cards[j].id} (${o.dx.toFixed(0)}×${o.dy.toFixed(0)})`);
    }
  }
  // 2) 材料之间不能重叠
  for (let i = 0; i < mats.length; i++) {
    for (let j = i + 1; j < mats.length; j++) {
      const o = overlap(mats[i], mats[j], 1);
      if (o) issues.push(`材料重叠 ${mats[i].id} × ${mats[j].id}`);
    }
  }
  // 3) 材料不能压到其它项目的卡片（允许压自己那张卡下方的空白）
  for (const m of mats) {
    for (const c of cards) {
      const o = overlap(m, c, 2);
      if (o) issues.push(`材料压卡片 ${m.id} × ${c.id}`);
    }
  }
  // 4) 相邻行的卡片不能重叠（行距检查）
  const rows = d.rows || [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    const gap = (b.y - b.h / 2) - (a.y + a.h / 2);
    if (gap < 40) issues.push(`行距过小 ${i}→${i + 1}: ${gap.toFixed(0)}`);
  }
  // 5) 材料框必须在所属行内（不越过行底）
  for (const b of d.boxes || []) {
    const row = rows.find((r) => Math.abs(r.y - (b.top - 26 - 0)) < 2) ||
                rows.slice().sort((x, y) => Math.abs(x.y - b.top) - Math.abs(y.y - b.top))[0];
    if (row) {
      const rowBottom = row.y + row.halfBelow;
      if (b.top + b.h > rowBottom + 2) {
        issues.push(`材料框越出本行 ${b.ownerId}: 底 ${(b.top + b.h).toFixed(0)} > 行底 ${rowBottom.toFixed(0)}`);
      }
    }
  }

  const ok = issues.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${f}  卡片 ${cards.length} · 材料 ${mats.length} · 行 ${rows.length}`);
  issues.slice(0, 8).forEach((s) => console.log('   · ' + s));
  if (issues.length > 8) console.log(`   · …还有 ${issues.length - 8} 条`);
}
process.exit(bad ? 1 : 0);
