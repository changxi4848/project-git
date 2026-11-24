'use strict';
/* 加：PDF 独立窗口预览 + 设置面板（模型配置/重置数据） */

const fs = require('fs');

/* ---------- 1) PDF 查看页 ---------- */
fs.writeFileSync('desktop/web/pdf.html', `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8" />
<title>PDF</title>
<style>
  html,body{margin:0;height:100%;background:#525659;font:13px "Microsoft YaHei",sans-serif}
  #bar{height:40px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#3a3d41;color:#ddd}
  #bar button{height:26px;padding:0 10px;border:1px solid #55595e;border-radius:6px;background:#484c50;color:#eee;cursor:pointer}
  #bar button:hover{background:#55595e}
  #name{flex:1;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #pages{color:#aab;font-size:12px}
  #view{position:absolute;top:40px;left:0;right:0;bottom:0;overflow:auto;padding:18px;text-align:center}
  canvas{display:block;margin:0 auto 14px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.35)}
</style></head>
<body>
<div id="bar">
  <span id="name">—</span>
  <span id="pages"></span>
  <button id="prev">上一页</button><button id="next">下一页</button>
</div>
<div id="view"></div>
<script src="./vendor/pdf.min.js"></script>
<script src="./pdf.js"></script>
</body></html>`);

fs.writeFileSync('desktop/web/pdf.js', `'use strict';
const qs = new URLSearchParams(location.search);
const file = qs.get('file') || '';
const page0 = parseInt(qs.get('page') || '1', 10);
const rect = qs.get('rect') ? qs.get('rect').split(',').map(Number) : null;
document.getElementById('name').textContent = qs.get('name') || file.split('/').pop();

(async () => {
  try {
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument(file).promise;
    const view = document.getElementById('view');
    const info = document.getElementById('pages');
    let page = Math.min(Math.max(1, page0), doc.numPages);
    async function paint() {
      info.textContent = page + ' / ' + doc.numPages;
      view.innerHTML = '';
      const p = await doc.getPage(page);
      const vp = p.getViewport({ scale: 1.6 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      view.appendChild(cv);
      await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      if (rect && page === page0) {
        const s = vp.scale;
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;border:2px solid #e06c62;background:rgba(224,108,98,.18);pointer-events:none;' +
          \`left:\${cv.offsetLeft + rect[0] * s}px;top:\${cv.offsetTop + rect[1] * s}px;width:\${(rect[2] - rect[0]) * s}px;height:\${(rect[3] - rect[1]) * s}px\`;
        view.appendChild(el);
        el.scrollIntoView({ block: 'center' });
      }
    }
    document.getElementById('prev').onclick = () => { if (page > 1) { page--; paint(); } };
    document.getElementById('next').onclick = () => { if (page < doc.numPages) { page++; paint(); } };
    await paint();
  } catch (e) {
    document.getElementById('view').textContent = 'PDF 打开失败：' + e.message;
  }
})();`);

/* ---------- 2) main.js：pdf:open + qa:config ---------- */
let m = fs.readFileSync('desktop/main.js', 'utf8');
if (!m.includes("pdf:open")) {
  m = m.replace("  ipcMain.handle('file:preview',",
`  ipcMain.handle('pdf:open', async (e, p) => {
    const n = store.nodeById(p.nodeId);
    if (!n || !n.source || !n.source.file) return { error: '没有关联文件' };
    const full = path.join(store.filesDir(), n.source.file);
    if (!fs.existsSync(full)) return { error: '文件不存在：' + n.source.file };
    const loc = n.source.locator || {};
    const q = new URLSearchParams({
      file: 'file:///' + full.replace(/\\\\/g, '/'),
      name: n.source.file,
      page: String(loc.page || 1),
    });
    if (Array.isArray(loc.rect)) q.set('rect', loc.rect.join(','));
    const w = new BrowserWindow({
      width: 1000, height: 860, parent: win, backgroundColor: '#525659',
      title: n.source.file, autoHideMenuBar: true,
      webPreferences: { offscreen: false },
    });
    w.loadURL('file://' + path.join(__dirname, 'web', 'pdf.html') + '?' + q.toString());
    return { ok: true };
  });

  ipcMain.handle('qa:config', async () => {
    const qa = require('./qa');
    const c = qa.configForUi();
    return { ok: true, ...c };
  });

  ipcMain.handle('qa:config:set', async (e, p) => {
    const file = path.join(store.dataDir(), 'qa_config.json');
    let c = {};
    try { if (fs.existsSync(file)) c = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (x) {}
    if (p.baseURL) c.baseURL = String(p.baseURL).trim();
    if (p.model) c.model = String(p.model).trim();
    if (typeof p.apiKey === 'string') c.apiKey = p.apiKey.trim();
    fs.writeFileSync(file, JSON.stringify(c, null, 2));
    return { ok: true };
  });

  ipcMain.handle('state:reset', async () => {
    const src = path.join(ROOT, 'desktop', 'seed', 'state.json');
    const dst = path.join(store.dataDir(), 'state.json');
    if (!fs.existsSync(src)) return { error: '没有种子数据' };
    try { fs.copyFileSync(dst, path.join(store.dataDir(), 'state.bak.json')); } catch (x) {}
    fs.copyFileSync(src, dst);
    return { ok: true };
  });

  ipcMain.handle('file:preview',`);
  fs.writeFileSync('desktop/main.js', m);
}
console.log('main ok');

/* ---------- 3) preload ---------- */
let pr = fs.readFileSync('desktop/preload.js', 'utf8');
if (!pr.includes('pdf:')) {
  pr = pr.replace("  ingest: (p) => ipcRenderer.invoke('ingest:batch', p),",
    "  ingest: (p) => ipcRenderer.invoke('ingest:batch', p),\n  openPdf: (p) => ipcRenderer.invoke('pdf:open', p),\n  qaConfig: () => ipcRenderer.invoke('qa:config'),\n  setQaConfig: (p) => ipcRenderer.invoke('qa:config:set', p),\n  resetState: () => ipcRenderer.invoke('state:reset'),");
  fs.writeFileSync('desktop/preload.js', pr);
}
console.log('preload ok');
