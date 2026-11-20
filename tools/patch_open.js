const fs = require('fs');

// ---- preload: 暴露“用系统默认程序打开文件” ----
let pr = fs.readFileSync('desktop/preload.js', 'utf8');
if (!pr.includes('openFileExtern')) {
  pr = pr.replace("  openFile: (p) => ipcRenderer.invoke('file:open', p),",
    "  openFile: (p) => ipcRenderer.invoke('file:open', p),\n  openFileExtern: (p) => ipcRenderer.invoke('file:openExtern', p),");
  fs.writeFileSync('desktop/preload.js', pr);
  console.log('preload ok');
}

// ---- main: 实现 openExtern ----
let m = fs.readFileSync('desktop/main.js', 'utf8');
if (!m.includes("file:openExtern")) {
  const anchor = "  ipcMain.handle('shell:open', (e, p) => shell.openPath(p));";
  const add = [
    "  ipcMain.handle('file:openExtern', async (e, p) => {",
    "    const n = store.nodeById(p.nodeId);",
    "    if (!n || !n.source || !n.source.file) return { error: '没有关联文件' };",
    "    const full = path.join(store.filesDir(), n.source.file);",
    "    if (!fs.existsSync(full)) return { error: '文件不存在：' + full };",
    "    const err = await shell.openPath(full);",
    "    return err ? { error: err } : { ok: true, path: full };",
    "  });",
  ].join('\n');
  if (!m.includes(anchor)) { console.log('anchor missing'); process.exit(1); }
  m = m.replace(anchor, anchor + '\n' + add);
  fs.writeFileSync('desktop/main.js', m);
  console.log('main ok');
}
