'use strict';
/* 最终版收敛：
   1) 删掉未使用的 ELK（1.5MB）与临时截图
   2) 每行卡片数按窗口宽度自适应
   3) 空状态提示
   4) 导出当前图为 PNG（演示/文档用）
*/
const fs = require('fs');
const path = require('path');

/* ---------- 1) 清理 ---------- */
const elk = 'desktop/web/vendor/elk.bundled.js';
if (fs.existsSync(elk)) { fs.unlinkSync(elk); console.log('removed elk.bundled.js'); }
const docs = 'docs';
fs.readdirSync(docs).forEach((f) => {
  if (/^app-.*\.png$/.test(f) || /^dump-.*\.json$/.test(f) || /^p-\d+\.png$/.test(f)) {
    fs.unlinkSync(path.join(docs, f)); console.log('removed docs/' + f);
  }
});

/* ---------- 2) 自适应列数 ---------- */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');
a = a.replace("  const PER_ROW = 3;",
`  const PER_ROW = Math.max(2, Math.min(5, Math.floor((W - 80) / (CARD_W + GAP_X)) || 3));`);
a = a.replace("  const PER_ROW = 99;",
`  const PER_ROW = Math.max(2, Math.min(5, Math.floor((W - 80) / (CARD_W + GAP_X)) || 3));`);

/* ---------- 3) 空状态 ---------- */
if (!a.includes('function drawEmpty')) {
  a = a.replace("/* ================= 绘制 ================= */",
`function drawEmpty() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8A97A5';
  ctx.font = '600 16px "Microsoft YaHei"';
  ctx.fillText('这个项目还没有内容', W / 2, H / 2 - 18);
  ctx.font = '400 13px "Microsoft YaHei"';
  ctx.fillStyle = '#A8B2BD';
  ctx.fillText('点右上角「收进来」粘一段，或用 tools/ingest.js 批量导入', W / 2, H / 2 + 14);
}

/* ================= 绘制 ================= */`);
  a = a.replace("  ctx.fillStyle = '#EDF1F7'; ctx.fillRect(0, 0, W, H);",
`  ctx.fillStyle = '#EDF1F7'; ctx.fillRect(0, 0, W, H);
  if (!model.items || !model.items.length) { drawEmpty(); return; }`);
}

/* ---------- 4) 导出 PNG ---------- */
if (!a.includes('function exportPng')) {
  a = a.replace("/* ================= 设置 ================= */",
`/* ================= 导出图片 ================= */
function exportPng() {
  try {
    const url = canvas.toDataURL('image/png');
    const a2 = document.createElement('a');
    a2.href = url;
    a2.download = (curProject || 'graph') + '-' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a2); a2.click(); a2.remove();
    toast('已导出 PNG');
  } catch (e) { toast('导出失败：' + e.message); }
}

/* ================= 设置 ================= */`);
  a = a.replace("  const setBtn = $('#btn-set');",
`  const exportBtn = $('#set-export');
  if (exportBtn) exportBtn.onclick = exportPng;
  const setBtn = $('#btn-set');`);
}

/* 设置面板加「导出当前图为 PNG」 */
fs.writeFileSync('desktop/web/app.js', a);

let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('set-export')) {
  h = h.replace('<button class="btn ghost" id="set-reset">重置演示数据</button>',
    '<button class="btn ghost" id="set-export">导出当前图为 PNG</button>\n      <button class="btn ghost" id="set-reset">重置演示数据</button>');
  fs.writeFileSync('desktop/web/index.html', h);
}
console.log('polish done');
