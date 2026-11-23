'use strict';
/* 给 main.js 增加：file:reveal（在文件夹中定位）、ai:exec（AI 指令总线） */
const fs = require('fs');
const p = 'desktop/main.js';
let m = fs.readFileSync(p, 'utf8');

if (!m.includes("file:reveal")) {
  const anchor = "  ipcMain.handle('file:preview',";
  const add = `  ipcMain.handle('file:reveal', async (e, p) => {
    const n = store.nodeById(p.nodeId);
    if (!n || !n.source || !n.source.file) return { error: '没有关联文件' };
    const full = path.join(store.filesDir(), n.source.file);
    if (!fs.existsSync(full)) return { error: '文件不存在：' + n.source.file };
    shell.showItemInFolder(full);
    return { ok: true, path: full };
  });

`;
  m = m.replace(anchor, add + anchor);
}

if (!m.includes("ai:exec")) {
  const anchor = "  ipcMain.handle('file:openExtern',";
  const add = `  /* ---------------- AI 指令总线 ----------------
     渲染进程（或未来的 MCP/自动化脚本）统一走这里：
     ai:exec({ cmd, args }) -> { ok, data } | { ok:false, error }
     支持的 cmd 在 web/app.js 的 AI_COMMANDS 里注册。               */
  ipcMain.handle('ai:exec', async (e, p) => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return { ok: false, error: '没有窗口' };
      const payload = JSON.stringify((p && p.args) || {});
      const script = 'window.__PG__.exec(' + JSON.stringify(p && p.cmd) + ',' + payload + ')';
      const data = await win.webContents.executeJavaScript(script, true);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

`;
  m = m.replace(anchor, add + anchor);
}

fs.writeFileSync(p, m);
console.log('main patched');

let pr = fs.readFileSync('desktop/preload.js', 'utf8');
if (!pr.includes('reveal:')) {
  pr = pr.replace("  preview: (p) => ipcRenderer.invoke('file:preview', p),",
    "  preview: (p) => ipcRenderer.invoke('file:preview', p),\n  reveal: (p) => ipcRenderer.invoke('file:reveal', p),\n  ai: (p) => ipcRenderer.invoke('ai:exec', p),");
  fs.writeFileSync('desktop/preload.js', pr);
  console.log('preload patched');
}
