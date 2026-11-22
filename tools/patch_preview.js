'use strict';
/* 在 main.js 里追加：file:preview（应用内预览） */
const fs = require('fs');
const p = 'desktop/main.js';
let m = fs.readFileSync(p, 'utf8');

if (!m.includes("file:preview")) {
  const anchor = "  ipcMain.handle('file:openExtern', async (e, p) => {";
  const add = `  ipcMain.handle('file:preview', async (e, p) => {
    const n = store.nodeById(p.nodeId);
    if (!n || !n.source || !n.source.file) return { error: '没有关联文件' };
    const name = n.source.file;
    const full = path.join(store.filesDir(), name);
    if (!fs.existsSync(full)) return { error: '文件不存在：' + name };
    const loc = n.source.locator || {};
    const ext = path.extname(name).toLowerCase();
    const IMG = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
    try {
      if (IMG.includes(ext)) {
        const b64 = fs.readFileSync(full).toString('base64');
        const mime = ext === '.svg' ? 'image/svg+xml' : 'image/' + ext.slice(1).replace('jpg', 'jpeg');
        return { kind: 'image', name, dataUrl: 'data:' + mime + ';base64,' + b64, rect: loc.rect || null };
      }
      if (ext === '.pdf') {
        const b64 = fs.readFileSync(full).toString('base64');
        return { kind: 'pdf', name, dataUrl: 'data:application/pdf;base64,' + b64, page: loc.page || 1, rect: loc.rect || null };
      }
      const text = fs.readFileSync(full, 'utf8');
      const CODE = ['.c', '.h', '.py', '.js', '.ts', '.json', '.yaml', '.yml', '.sh', '.java', '.cpp', '.rs', '.go', '.sql', '.ini', '.toml'];
      const kind = ext === '.md' ? 'markdown' : (CODE.includes(ext) ? 'code' : 'text');
      return { kind, name, text, start: loc.start ?? null, end: loc.end ?? null, excerpt: n.source.excerpt || '' };
    } catch (err) {
      return { error: String(err && err.message || err) };
    }
  });

`;
  m = m.replace(anchor, add + anchor);
  fs.writeFileSync(p, m);
  console.log('main patched');
} else console.log('main ok');

let pr = fs.readFileSync('desktop/preload.js', 'utf8');
if (!pr.includes('preview:')) {
  pr = pr.replace("  openFileExtern: (p) => ipcRenderer.invoke('file:openExtern', p),",
                  "  openFileExtern: (p) => ipcRenderer.invoke('file:openExtern', p),\n  preview: (p) => ipcRenderer.invoke('file:preview', p),");
  fs.writeFileSync('desktop/preload.js', pr);
  console.log('preload patched');
} else console.log('preload ok');
