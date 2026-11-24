'use strict';
/* 界面：PDF 走独立窗口；新增设置面板 */
const fs = require('fs');

/* ---------- index.html ---------- */
let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('id="btn-set"')) {
  h = h.replace('<button id="btn-ask" class="btn">问一问</button>',
    '<button id="btn-set" class="btn" title="设置">⚙</button>\n  <button id="btn-ask" class="btn">问一问</button>');
}
if (!h.includes('id="set"')) {
  h = h.replace('<div id="toast"',
`<div id="set" class="modal hidden">
  <div class="box">
    <h3>设置</h3>
    <div class="set-row"><label>接口地址</label><input id="set-base" placeholder="https://api.deepseek.com/v1" /></div>
    <div class="set-row"><label>模型</label><input id="set-model" placeholder="deepseek-chat" /></div>
    <div class="set-row"><label>API Key</label><input id="set-key" type="password" placeholder="sk-..." /></div>
    <div class="set-tip" id="set-tip">未配置时使用本地规划器（离线可用，准确率较低）</div>
    <div class="row">
      <button class="btn ghost" id="set-reset">重置演示数据</button>
      <div class="grow"></div>
      <button class="btn ghost" data-set-close>取消</button>
      <button class="btn primary" id="set-save">保存</button>
    </div>
  </div>
</div>

<div id="toast"`);
}
fs.writeFileSync('desktop/web/index.html', h);

/* ---------- style.css ---------- */
let c = fs.readFileSync('desktop/web/style.css', 'utf8');
if (!c.includes('.set-row')) {
  c += `
.set-row{display:flex; align-items:center; gap:10px; margin-bottom:10px}
.set-row label{width:72px; font-size:12.5px; color:#6B7A88}
.set-row input{flex:1; height:32px; border:1px solid #DCE2E9; border-radius:8px; padding:0 10px; font:inherit; font-size:12.5px; outline:none}
.set-row input:focus{border-color:#9BB0C9}
.set-tip{font-size:11.5px; color:#98A5B1; margin:2px 0 14px 82px}
`;
  fs.writeFileSync('desktop/web/style.css', c);
}

/* ---------- app.js ---------- */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');

// PDF：独立窗口
a = a.replace(`  if (r.kind === 'pdf') {
    box.appendChild(div('summary', 'PDF 暂不支持应用内预览（下一版接独立 PDF 视图），先用「外部打开」。'));
    const b = document.createElement('button');
    b.className = 'btn primary small'; b.style.marginTop = '10px'; b.textContent = '外部打开';
    b.onclick = () => window.api.openFileExtern({ nodeId: n.id });
    box.appendChild(b); return;
  }`,
`  if (r.kind === 'pdf') {
    await window.api.openPdf({ nodeId: n.id });
    box.appendChild(div('summary', '已用独立窗口打开 PDF（可翻页、命中处有红框）。'));
    const b = document.createElement('button');
    b.className = 'btn primary small'; b.style.marginTop = '10px'; b.textContent = '再开一次';
    b.onclick = () => window.api.openPdf({ nodeId: n.id });
    box.appendChild(b); return;
  }`);

// 设置面板逻辑
if (!a.includes('function openSettings')) {
  a = a.replace("/* ================= 问一问 ================= */",
`/* ================= 设置 ================= */
async function openSettings() {
  const el = $('#set');
  el.classList.remove('hidden');
  try {
    const c = await window.api.qaConfig();
    $('#set-base').value = c.baseURL || '';
    $('#set-model').value = c.model || '';
    $('#set-key').value = '';
    $('#set-key').placeholder = c.hasKey ? ('已保存：' + c.keyMask + '（留空则不修改）') : 'sk-...';
    $('#set-tip').textContent = c.hasKey
      ? '已配置模型：' + c.model + '。保存后立即生效。'
      : '未配置时使用本地规划器（离线可用，准确率较低）';
  } catch (e) {}
}
async function saveSettings() {
  const baseURL = $('#set-base').value.trim();
  const model = $('#set-model').value.trim();
  const apiKey = $('#set-key').value.trim();
  const payload = { baseURL, model };
  if (apiKey) payload.apiKey = apiKey;
  const r = await window.api.setQaConfig(payload);
  if (r && r.ok) { toast('已保存'); $('#set').classList.add('hidden'); }
  else toast('保存失败');
}

/* ================= 问一问 ================= */`);

  a = a.replace("  const askBtn = $('#btn-ask');",
`  const setBtn = $('#btn-set');
  if (setBtn) setBtn.onclick = openSettings;
  const setSave = $('#set-save');
  if (setSave) setSave.onclick = saveSettings;
  const setReset = $('#set-reset');
  if (setReset) setReset.onclick = async () => {
    if (!confirm('用演示数据覆盖当前数据？（会先备份为 state.bak.json）')) return;
    const r = await window.api.resetState();
    if (r && r.ok) { S = await window.api.state(); renderTabs(); rebuild(); toast('已重置'); $('#set').classList.add('hidden'); }
    else toast('重置失败');
  };
  document.querySelectorAll('[data-set-close]').forEach((b) => { b.onclick = () => $('#set').classList.add('hidden'); });
  const askBtn = $('#btn-ask');`);
  fs.writeFileSync('desktop/web/app.js', a);
  console.log('app ok');
} else console.log('app exists');

/* 详情里的「在应用内打开」对 PDF 改走独立窗口由 openPreview 处理，这里不动 */
console.log('done');
