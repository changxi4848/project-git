'use strict';
/* 给应用加「问一问」面板 */
const fs = require('fs');

/* ---------- index.html ---------- */
let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('id="btn-ask"')) {
  h = h.replace('<button id="btn-capture" class="btn">收进来</button>',
    '<button id="btn-ask" class="btn">问一问</button>\n  <button id="btn-capture" class="btn">收进来</button>');
}
if (!h.includes('id="ask"')) {
  h = h.replace('<div id="toast"',
`<div id="ask" class="ask hidden">
  <div class="ask-head">
    <div class="ask-title">问一问</div>
    <button id="ask-close" class="close">✕</button>
  </div>
  <div class="ask-bar">
    <input id="ask-input" placeholder="例如：为什么放弃 HID？现在还有效吗？" spellcheck="false" />
    <button id="ask-go" class="btn primary small">问</button>
  </div>
  <div id="ask-hintline" class="ask-hint"></div>
  <div id="ask-body" class="ask-body">
    <div class="ask-empty">问团队里的任意一件事：为什么这么定、后来怎么样了、原文在哪。</div>
  </div>
</div>

<div id="toast"`);
}
fs.writeFileSync('desktop/web/index.html', h);

/* ---------- style.css ---------- */
let c = fs.readFileSync('desktop/web/style.css', 'utf8');
if (!c.includes('.ask{')) {
  c += `
/* ---------- 问一问 ---------- */
.ask{position:fixed; top:46px; left:50%; transform:translateX(-50%); width:min(760px,92vw);
  max-height:calc(100% - 80px); background:#fff; border:1px solid #E4EAF0; border-radius:14px;
  box-shadow:0 24px 70px rgba(16,24,40,.18); z-index:45; display:flex; flex-direction:column; overflow:hidden}
.ask.hidden{display:none}
.ask-head{display:flex; align-items:center; padding:12px 16px 6px}
.ask-title{flex:1; font-size:13px; font-weight:600; color:#0F172A}
.ask-bar{display:flex; gap:8px; padding:6px 16px 10px}
.ask-bar input{flex:1; height:34px; border:1px solid #DCE2E9; border-radius:8px; padding:0 12px;
  font:inherit; font-size:13px; outline:none; color:#111827}
.ask-bar input:focus{border-color:#9BB0C9}
.ask-hint{font-size:11px; color:#98A5B1; padding:0 16px 8px}
.ask-body{flex:1; overflow:auto; padding:4px 16px 18px; border-top:1px solid #F1F4F7}
.ask-empty{color:#98A5B1; font-size:12.5px; padding:18px 0}
.ask-a{font-size:13px; line-height:1.85; color:#1F2933; padding-top:12px; white-space:pre-wrap}
.ask-a strong{color:#0F172A; font-weight:600}
.ask-cites{margin-top:12px; border-top:1px dashed #E7EDF3; padding-top:10px}
.ask-cites .h{font-size:10.5px; color:#98A5B1; letter-spacing:1px; margin-bottom:6px}
.cite{display:inline-flex; align-items:center; gap:6px; margin:0 8px 8px 0; padding:5px 9px;
  border:1px solid #DCE6F0; border-radius:7px; background:#F7FAFD; font-size:11.5px; color:#2F5E8C; cursor:pointer}
.cite:hover{background:#EEF5FC; border-color:#C6D9EC}
.cite .dot{width:6px; height:6px; border-radius:50%; background:#3F8FC4}
.ask-meta{font-size:10.5px; color:#A8B2BD; padding-top:10px}
`;
  fs.writeFileSync('desktop/web/style.css', c);
}

/* ---------- app.js ---------- */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');
if (!a.includes('function openAsk')) {
  a = a.replace("/* ================= 检索 ================= */",
`/* ================= 问一问 ================= */
function esc2(s) { return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function openAsk(preset) {
  const el = $('#ask'); if (!el) return;
  el.classList.remove('hidden');
  const inp = $('#ask-input');
  if (preset) inp.value = preset;
  inp.focus();
  window.api.qaInfo().then((info) => {
    $('#ask-hintline').textContent =
      info.mode === 'model'
        ? \`模型：\${info.model}（API）· 工具：\${info.tools.length} 个\`
        : '离线模式：本地规划器（未配置 API key）。答案只基于结构化条目，可评估。';
  }).catch(() => {});
}

function closeAsk() { const el = $('#ask'); if (el) el.classList.add('hidden'); }

async function submitAsk() {
  const q = ($('#ask-input').value || '').trim();
  if (!q) return;
  const body = $('#ask-body');
  body.innerHTML = '<div class="ask-empty">正在查…</div>';
  let r;
  try { r = await window.api.qa({ q }); }
  catch (e) { body.innerHTML = '<div class="ask-empty">出错：' + esc2(e.message) + '</div>'; return; }

  const ans = esc2(r.answer || '（没有答案）')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  let html = '<div class="ask-a">' + ans + '</div>';
  if (r.citations && r.citations.length) {
    html += '<div class="ask-cites"><div class="h">引用</div>';
    r.citations.forEach((c) => {
      const loc = c.kind === 'pdf' ? \`第 \${c.page} 页\` : (c.start != null ? \`第 \${c.start}–\${c.end} 字\` : '');
      html += \`<span class="cite" data-file="\${esc2(c.file)}" data-id="\${esc2(c.id)}">
        <span class="dot"></span>\${esc2(c.file)}\${loc ? ' · ' + loc : ''}</span>\`;
    });
    html += '</div>';
  }
  html += \`<div class="ask-meta">\${esc2(r.mode || '')} · \${r.ms || 0}ms\${r.trace ? ' · ' + r.trace.length + ' 次工具调用' : ''}</div>\`;
  body.innerHTML = html;
  body.querySelectorAll('.cite').forEach((el) => {
    el.onclick = () => {
      const id = el.dataset.id;
      const n = S.nodes.find((x) => x.id === id);
      if (n && n.source) { openPreview(n); }
      else toast('这条没有原文');
    };
  });
  body.scrollTop = 0;
}

/* ================= 检索 ================= */`);

  a = a.replace("  $('#btn-capture').onclick =",
`  const askBtn = $('#btn-ask');
  if (askBtn) askBtn.onclick = () => openAsk();
  const askGo = $('#ask-go');
  if (askGo) askGo.onclick = submitAsk;
  const askClose = $('#ask-close');
  if (askClose) askClose.onclick = closeAsk;
  const askInput = $('#ask-input');
  if (askInput) askInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAsk(); if (e.key === 'Escape') closeAsk(); });
  $('#btn-capture').onclick =`);

  // AI 命令加 ask
  a = a.replace("  commands: () => ({ ok: true, commands: Object.keys(AI_COMMANDS) }),",
`  ask: async ({ q }) => {
    const r = await window.api.qa({ q });
    return { ok: true, ...r };
  },

  commands: () => ({ ok: true, commands: Object.keys(AI_COMMANDS) }),`);

  fs.writeFileSync('desktop/web/app.js', a);
  console.log('app ok');
} else console.log('app exists');
