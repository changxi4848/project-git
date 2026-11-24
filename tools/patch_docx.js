'use strict';
/* docx 应用内预览：mammoth → HTML */
const fs = require('fs');

/* 1) index.html 引入 mammoth */
let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('mammoth.browser.min.js')) {
  h = h.replace('<script src="./vendor/pdf.min.js"></script>',
    '<script src="./vendor/pdf.min.js"></script>\n<script src="./vendor/mammoth.browser.min.js"></script>');
  fs.writeFileSync('desktop/web/index.html', h);
}

/* 2) main.js：file:preview 支持 docx / xlsx */
let m = fs.readFileSync('desktop/main.js', 'utf8');
if (!m.includes("'.docx'")) {
  m = m.replace("      if (ext === '.pdf') {",
`      if (ext === '.docx' || ext === '.xlsx') {
        const b64 = fs.readFileSync(full).toString('base64');
        return { kind: ext === '.docx' ? 'docx' : 'xlsx', name, dataUrl: 'data:application/octet-stream;base64,' + b64 };
      }
      if (ext === '.pdf') {`);
  fs.writeFileSync('desktop/main.js', m);
}

/* 3) app.js：渲染 docx；xlsx 给出提示 */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');
if (!a.includes("r.kind === 'docx'")) {
  a = a.replace("  if (r.kind === 'markdown') {",
`  if (r.kind === 'docx') {
    box.innerHTML = '<div class="summary">正在解析 Word…</div>';
    try {
      const bin = atob(String(r.dataUrl).split(',')[1] || '');
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const out = await window.mammoth.convertToHtml({ arrayBuffer: buf.buffer });
      const wrap = document.createElement('div');
      wrap.className = 'md docx';
      wrap.innerHTML = sanitize(out.value || '');
      box.innerHTML = '';
      box.appendChild(wrap);
      if (out.messages && out.messages.length) {
        const tip = div('summary', '（有 ' + out.messages.length + ' 处格式未能完全还原）');
        tip.style.marginTop = '10px'; tip.style.fontSize = '11.5px';
        box.appendChild(tip);
      }
    } catch (e) {
      box.innerHTML = '<div class="summary">Word 解析失败：' + esc(e.message) + '</div>';
    }
    return;
  }
  if (r.kind === 'xlsx') {
    box.appendChild(div('summary', '表格暂不支持应用内预览，先用「外部打开」。'));
    const b = document.createElement('button');
    b.className = 'btn primary small'; b.style.marginTop = '10px'; b.textContent = '外部打开';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id });
    box.appendChild(b);
    return;
  }
  if (r.kind === 'markdown') {`);
  fs.writeFileSync('desktop/web/app.js', a);
}

/* 4) 样式：docx 表格/图片 */
let c = fs.readFileSync('desktop/web/style.css', 'utf8');
if (!c.includes('.docx table')) {
  c += `
.docx p{margin:8px 0}
.docx h1,.docx h2,.docx h3{color:#111827; margin:16px 0 8px}
.docx table{border-collapse:collapse; margin:10px 0; font-size:12px}
.docx th,.docx td{border:1px solid #E1E7EE; padding:5px 8px}
.docx img{max-width:100%; border-radius:6px}
.docx ul,.docx ol{margin:8px 0 8px 20px}
`;
  fs.writeFileSync('desktop/web/style.css', c);
}
console.log('docx preview wired');
