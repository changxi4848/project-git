'use strict';
const fs = require('fs');

/* ---------- 1) index.html：引入 marked / pdf.js，加预览容器 ---------- */
let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('marked.min.js')) {
  h = h.replace('<script src="./vendor/d3.min.js"></script>',
    '<script src="./vendor/d3.min.js"></script>\n' +
    '<script src="./vendor/marked.min.js"></script>\n' +
    '<script src="./vendor/pdf.min.js"></script>');
}
if (!h.includes('id="preview"')) {
  h = h.replace('<div id="toast"',
`<div id="preview" class="preview hidden">
  <div class="pv-head">
    <div class="pv-name" id="pv-name">—</div>
    <button id="pv-extern" class="btn ghost small">外部打开</button>
    <button id="pv-close" class="close">✕</button>
  </div>
  <div id="pv-body" class="pv-body"></div>
</div>

<div id="toast"`);
}
fs.writeFileSync('desktop/web/index.html', h);
console.log('html ok');

/* ---------- 2) style.css：预览样式 ---------- */
let c = fs.readFileSync('desktop/web/style.css', 'utf8');
if (!c.includes('.preview{')) {
  c += `
/* ---------- 应用内预览 ---------- */
.preview{
  position:fixed; top:44px; right:0; bottom:0; width:560px; max-width:72vw; z-index:25;
  background:#1c1c20; border-left:1px solid var(--line); display:flex; flex-direction:column;
  box-shadow:-12px 0 40px rgba(0,0,0,.35);
}
.preview.hidden{display:none}
.pv-head{display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid var(--line)}
.pv-name{flex:1; font-size:12.5px; color:#d9dce2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.pv-body{flex:1; overflow:auto; padding:16px 18px 40px}
.pv-body img{max-width:100%; display:block; border-radius:6px; margin:0 auto}
.pv-body canvas{display:block; margin:0 auto; background:#fff; border-radius:4px}
.pv-body .pdfwrap{position:relative; display:inline-block}
.pv-body .pdfhl{position:absolute; border:2px solid #e06c62; background:rgba(224,108,98,.16); border-radius:2px; pointer-events:none}
.pv-body .pagenav{display:flex; gap:8px; align-items:center; justify-content:center; margin:10px 0 0; color:#8b9098; font-size:12px}
/* markdown */
.md{font-size:13px; line-height:1.85; color:#c9cdd4}
.md h1,.md h2,.md h3{color:#eef0f4; margin:18px 0 8px; line-height:1.4}
.md h1{font-size:19px} .md h2{font-size:16px} .md h3{font-size:14px}
.md p{margin:8px 0}
.md ul,.md ol{margin:8px 0 8px 20px}
.md code{background:#26262b; padding:1px 5px; border-radius:4px; font-family:Consolas,monospace; font-size:12px}
.md pre{background:#17171a; border:1px solid #2b2b31; border-radius:7px; padding:10px 12px; overflow:auto}
.md pre code{background:none; padding:0}
.md blockquote{border-left:3px solid #3f3f47; margin:10px 0; padding:2px 12px; color:#9aa0a9}
.md table{border-collapse:collapse; margin:10px 0; font-size:12px}
.md th,.md td{border:1px solid #33333a; padding:5px 8px}
.md hr{border:0; border-top:1px solid #2f2f36; margin:16px 0}
.md mark{background:#5a4a16; color:#ffe6a8; padding:0 2px; border-radius:2px}
.md a{color:#8ea8ff}
/* 代码 / 纯文本 */
.codewrap{display:flex; font-family:Consolas,"Microsoft YaHei",monospace; font-size:12px; line-height:1.65}
.ln{flex:0 0 44px; text-align:right; padding-right:10px; color:#5d646e; user-select:none}
.code{flex:1; white-space:pre-wrap; word-break:break-word; color:#c4c9d1}
.code mark, .txtmark{background:#5a4a16; color:#ffe6a8; border-radius:2px}
.plain{white-space:pre-wrap; font-size:12.5px; line-height:1.8; color:#c4c9d1}
.plain mark{background:#5a4a16; color:#ffe6a8; border-radius:2px}
`;
  fs.writeFileSync('desktop/web/style.css', c);
  console.log('css ok');
}

/* ---------- 3) app.js：两个按钮 + 预览逻辑 ---------- */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');

const oldBtn = `    const b = document.createElement('button');
    b.className = 'btn primary open'; b.textContent = '打开文件';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id }).then((r) => { if (r && r.error) toast(r.error); });
    body.appendChild(b);`;
const newBtn = `    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    const b1 = document.createElement('button');
    b1.className = 'btn primary small'; b1.textContent = '在应用内打开';
    b1.onclick = () => openPreview(n);
    const b2 = document.createElement('button');
    b2.className = 'btn ghost small'; b2.textContent = '外部打开';
    b2.onclick = () => window.api.openFileExtern({ nodeId: n.id }).then((r) => { if (r && r.error) toast(r.error); });
    row.appendChild(b1); row.appendChild(b2);
    body.appendChild(row);`;

if (a.includes(oldBtn)) {
  a = a.replace(oldBtn, newBtn);
  console.log('buttons ok');
} else {
  console.log('buttons: anchor not found');
}

if (!a.includes('async function openPreview')) {
  const preview = `
/* ================= 应用内预览 ================= */
let pvNode = null;

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function sanitize(html) {
  return html.replace(/<script[\\s\\S]*?<\\/script>/gi, '')
             .replace(/\\son\\w+\\s*=\\s*"[^"]*"/gi, '')
             .replace(/\\son\\w+\\s*=\\s*'[^']*'/gi, '')
             .replace(/javascript:/gi, '');
}

async function openPreview(n) {
  pvNode = n;
  const r = await window.api.preview({ nodeId: n.id });
  const box = document.getElementById('pv-body');
  const nameEl = document.getElementById('pv-name');
  const pv = document.getElementById('preview');
  pv.classList.remove('hidden');
  nameEl.textContent = r.name || n.title;
  box.innerHTML = '';
  if (r.error) { box.innerHTML = '<div class="summary">' + esc(r.error) + '</div>'; return; }

  if (r.kind === 'image') {
    const img = document.createElement('img');
    img.src = r.dataUrl;
    box.appendChild(img);
    if (r.rect) {
      img.onload = () => {
        const box2 = document.createElement('div');
        box2.style.position = 'relative';
        box2.style.display = 'inline-block';
        img.parentNode.replaceChild(box2, img);
        const img2 = document.createElement('img'); img2.src = r.dataUrl;
        box2.appendChild(img2);
        const [x0, y0, x1, y1] = r.rect;
        const hl = document.createElement('div'); hl.className = 'pdfhl';
        hl.style.left = (x0 / img2.naturalWidth * 100) + '%';
        hl.style.top = (y0 / img2.naturalHeight * 100) + '%';
        hl.style.width = ((x1 - x0) / img2.naturalWidth * 100) + '%';
        hl.style.height = ((y1 - y0) / img2.naturalHeight * 100) + '%';
        box2.appendChild(hl);
      };
    }
    return;
  }

  if (r.kind === 'pdf') {
    await renderPdf(r, box);
    return;
  }

  if (r.kind === 'markdown') {
    const html = sanitize(marked.parse(r.text || ''));
    const wrap = document.createElement('div');
    wrap.className = 'md';
    wrap.innerHTML = html;
    if (r.excerpt) highlightInDom(wrap, r.excerpt);
    box.appendChild(wrap);
    if (r.excerpt) scrollToMark(box);
    return;
  }

  if (r.kind === 'code') {
    box.appendChild(buildCode(r.text || '', r.start, r.end));
    scrollToMark(box);
    return;
  }

  // text
  const pre = document.createElement('div');
  pre.className = 'plain';
  const t = r.text || '';
  if (r.start != null && r.end != null && r.start >= 0) {
    pre.innerHTML = esc(t.slice(0, r.start)) + '<mark>' + esc(t.slice(r.start, r.end)) + '</mark>' + esc(t.slice(r.end));
  } else {
    pre.textContent = t;
  }
  box.appendChild(pre);
  if (r.start != null) scrollToMark(box);
}

function buildCode(text, start, end) {
  const wrap = document.createElement('div');
  wrap.className = 'codewrap';
  const lines = text.split('\\n');
  const ln = document.createElement('div'); ln.className = 'ln';
  const code = document.createElement('div'); code.className = 'code';
  let acc = 0, hiFrom = -1, hiTo = -1, offset = 0;
  const marks = [];
  if (start != null && end != null && start >= 0) { hiFrom = start; hiTo = end; }
  const parts = [];
  lines.forEach((line, i) => {
    const lineStart = offset, lineEnd = offset + line.length;
    offset = lineEnd + 1;
    if (hiFrom >= 0 && hiFrom < lineEnd && hiTo > lineStart) {
      const a = Math.max(0, hiFrom - lineStart), b = Math.min(line.length, hiTo - lineStart);
      parts.push({ html: esc(line.slice(0, a)) + '<mark>' + esc(line.slice(a, b)) + '</mark>' + esc(line.slice(b)), hit: true });
    } else {
      parts.push({ html: esc(line), hit: false });
    }
  });
  ln.innerHTML = parts.map((_, i) => String(i + 1)).join('<br>');
  code.innerHTML = parts.map((p) => p.html || '&nbsp;').join('\\n');
  wrap.appendChild(ln); wrap.appendChild(code);
  return wrap;
}

function highlightInDom(root, needle) {
  const key = String(needle).slice(0, 30);
  if (!key) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const i = node.nodeValue.indexOf(key);
    if (i >= 0) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, Math.min(node.nodeValue.length, i + key.length));
      const mark = document.createElement('mark');
      try { range.surroundContents(mark); } catch (e) {}
      return;
    }
  }
}

function scrollToMark(box) {
  const m = box.querySelector('mark');
  if (m) setTimeout(() => m.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
}

async function renderPdf(r, box) {
  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
    const bin = atob(r.dataUrl.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const doc2 = await pdfjsLib.getDocument({ data: buf }).promise;
    const state = { page: Math.min(Math.max(1, r.page || 1), doc2.numPages) };

    const nav = document.createElement('div');
    nav.className = 'pagenav';
    const prev = document.createElement('button'); prev.className = 'btn ghost small'; prev.textContent = '上一页';
    const next = document.createElement('button'); next.className = 'btn ghost small'; next.textContent = '下一页';
    const info = document.createElement('span');
    nav.appendChild(prev); nav.appendChild(info); nav.appendChild(next);

    const wrap = document.createElement('div'); wrap.className = 'pdfwrap';
    box.appendChild(wrap); box.appendChild(nav);

    async function paint() {
      info.textContent = state.page + ' / ' + doc2.numPages;
      const page = await doc2.getPage(state.page);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      wrap.innerHTML = '';
      wrap.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (r.rect && state.page === (r.page || 1)) {
        const [x0, y0, x1, y1] = r.rect;
        const s = viewport.scale;
        const hl = document.createElement('div'); hl.className = 'pdfhl';
        hl.style.left = (x0 * s) + 'px';
        hl.style.top = (y0 * s) + 'px';
        hl.style.width = ((x1 - x0) * s) + 'px';
        hl.style.height = ((y1 - y0) * s) + 'px';
        wrap.appendChild(hl);
        hl.scrollIntoView({ block: 'center' });
      }
    }
    prev.onclick = () => { if (state.page > 1) { state.page--; paint(); } };
    next.onclick = () => { if (state.page < doc2.numPages) { state.page++; paint(); } };
    await paint();
  } catch (e) {
    box.innerHTML = '<div class="summary">PDF 预览失败：' + esc(e.message) + '</div>';
  }
}

function closePreview() {
  document.getElementById('preview').classList.add('hidden');
  pvNode = null;
}
`;
  a = a.replace('boot();', preview + '\nboot();');
  a = a.replace("  $('#p-close').onclick", "  $('#pv-close').onclick = closePreview;\n  $('#pv-extern').onclick = () => { if (pvNode) window.api.openFileExtern({ nodeId: pvNode.id }); };\n  $('#p-close').onclick");
  console.log('preview fn ok');
} else console.log('preview fn exists');

fs.writeFileSync('desktop/web/app.js', a);
