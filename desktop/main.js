'use strict';
/* 项目Git 桌面版 · 主进程
   - 真正的应用窗口（无浏览器、无本地端口）
   - 数据与判定全在本进程，渲染进程只做画面
   - 支持 --screenshot 自动截图（开发用）
*/
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const engine = require('./engine');
const store = require('./store');

const GATE = { autoConf: 0.68, autoMargin: 0.10 };
const SHOT_MODE = process.argv.includes('--screenshot');
const ROOT = path.join(__dirname, '..');

let win = null;
let dataDir = null;

function resolveDataDir() {
  if (app.isPackaged) {
    const d = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(d, { recursive: true });
    // 首次运行：从 app 内置样例复制
    const seed = path.join(process.resourcesPath, 'data');
    if (!fs.existsSync(path.join(d, 'state.json')) && fs.existsSync(seed)) {
      fs.cpSync(seed, d, { recursive: true });
    }
    return d;
  }
  return path.join(ROOT, 'data');
}

/* ---------------- 业务 ---------------- */

function capture({ text, date }) {
  const st = store.get();
  const { kept, dropped } = engine.segment(text, date || engine.nowISO().slice(0, 10));
  const items = [];
  for (const it of kept) {
    const cls = engine.classify(it, st, GATE);
    const item = {
      id: 'it_' + Math.random().toString(36).slice(2, 8),
      text: it.text, at: it.at || date, speaker: it.speaker,
      placeholders: it.placeholders || [], truncated: !!it.truncated, cls,
    };
    if (cls.action === 'auto') {
      store.pushUndo();
      item.node_id = createNode(item, cls, cls.parent, cls.type, cls.project, cls.placement);
      item.committed = true;
    } else if (cls.action === 'queue') {
      st.queue.push({ id: item.id, text: item.text, at: item.at, speaker: item.speaker, cls });
      item.committed = false;
    }
    items.push(item);
  }
  store.save();
  return { items, dropped, stats: { kept: kept.length, dropped: dropped.length } };
}

function createNode(item, cls, parent, type, project, placement) {
  const st = store.get();
  const id = store.nextId('n');
  let title = item.text.slice(0, 26).replace(/\n/g, ' ').trim();
  if (item.text.length > 26) title += '…';
  const extra = {};
  const t = st.types.find((x) => x.id === type) || { fields: [] };
  for (const f of t.fields || []) {
    if (f.key.includes('负责')) extra[f.key] = item.speaker || '张伟';
    else if (f.key.includes('时间') || f.key.includes('日')) extra[f.key] = (item.at || '').slice(0, 10);
    else if (f.required) extra[f.key] = item.text.slice(0, 60);
  }
  const node = {
    id, project, type, title, summary: item.text.slice(0, 80),
    content_at: (item.at || engine.nowISO()).slice(0, 10),
    ingest_at: engine.nowISO(), status: 'active',
    confidence: cls.confidence ?? 0.8, auto: true, placement,
    source: { file: null, locator: null, excerpt: item.text },
    extra, parent: parent || null,
  };
  st.nodes.push(node);
  if (parent) st.edges.push({ from: id, to: parent, kind: placement === 'attach' ? 'attach' : 'derived' });
  return id;
}

function place({ item, parent, project, type, placement, new_node_title, confidence }) {
  store.pushUndo();
  const st = store.get();
  const it = Object.assign({}, item);
  if (new_node_title) it.text = new_node_title + ' ' + (it.text || '');
  const nid = createNode(it, { confidence: confidence ?? 0.8 }, parent,
    type || (item.cls && item.cls.type) || 'plan',
    project || (item.cls && item.cls.project) || st.projects[0].id,
    placement || (item.cls && item.cls.placement) || 'grow');
  st.queue = st.queue.filter((q) => q.id !== item.id);
  st.choices.push({
    text: (item.text || '').slice(0, 120), project, type, parent, at: engine.nowISO(),
  });
  store.save();
  return { node_id: nid };
}

function edit(p) {
  store.pushUndo();
  const st = store.get();
  const n = store.nodeById(p.id);
  if (p.op === 'reparent' && n) {
    st.edges = st.edges.filter((e) => !(e.from === p.id && (e.kind === 'derived' || e.kind === 'attach')));
    if (p.parent) st.edges.push({ from: p.id, to: p.parent, kind: 'derived' });
    n.parent = p.parent || null;
  } else if (p.op === 'retype' && n) n.type = p.type;
  else if (p.op === 'status' && n) n.status = p.status;
  else if (p.op === 'title' && n) n.title = p.title;
  else if (p.op === 'delete' && n) n.status = 'deleted';
  else if (p.op === 'supersede' && n) {
    st.edges.push({ from: p.id, to: p.old, kind: 'supersedes' });
    const o = store.nodeById(p.old);
    if (o) o.status = 'superseded';
  }
  st.edits.push({ op: p.op, id: p.id, at: engine.nowISO() });
  store.save();
  return { ok: true };
}

function addType({ name, fields, color }) {
  store.pushUndo();
  const st = store.get();
  const t = { id: 't_' + (st.types.length + 1), name, color: color || '#c9942f', fields: fields || [] };
  st.types.push(t);
  store.save();
  return { type: t };
}

function search({ q }) {
  const st = store.get();
  const hits = engine.search(q, st);
  return { hits, trace: engine.buildTrace(q, hits, st), neighbors: neighborsOf(hits) };
}

function neighborsOf(hits) {
  if (!hits.length) return [];
  const st = store.get();
  const main = hits[0].id;
  const out = [];
  st.edges.forEach((e) => {
    if (e.from === main) out.push(e.to);
    else if (e.to === main) out.push(e.from);
  });
  return [...new Set(out)];
}

/* 打开原文并定位 */
function openFile({ nodeId }) {
  const n = store.nodeById(nodeId);
  if (!n || !n.source || !n.source.file) return { error: '该节点没有关联文件' };
  const name = n.source.file;
  const full = path.join(store.filesDir(), name);
  if (!fs.existsSync(full)) return { error: '文件不存在：' + name };
  const loc = n.source.locator || {};

  if (loc.kind === 'pdf') {
    return renderPdfPage(full, name, loc);
  }
  const text = fs.readFileSync(full, 'utf8');
  return { kind: 'text', name, text, start: loc.start ?? null, end: loc.end ?? null };
}

function renderPdfPage(full, name, loc) {
  return new Promise((resolve) => {
    const page = loc.page || 1;
    const out = path.join(os.tmpdir(), 'pg-' + Date.now());
    execFile('pdftoppm', ['-png', '-r', '110', '-f', String(page), '-l', String(page), '-singlefile', full, out],
      { timeout: 20000 }, (err) => {
        const png = out + '.png';
        if (err || !fs.existsSync(png)) {
          return resolve({ kind: 'text', name, text: '（PDF 渲染需要 poppler 的 pdftoppm；当前不可用）' });
        }
        const b64 = fs.readFileSync(png).toString('base64');
        fs.unlink(png, () => {});
        resolve({
          kind: 'pdf', name, page, image: 'data:image/png;base64,' + b64,
          rect: loc.rect || null,
        });
      });
  });
}

/* git：只读 */
function gitSync({ repo } = {}) {
  const st = store.get();
  const target = repo || path.join(dataDir, 'demo-repo');
  if (!fs.existsSync(path.join(target, '.git'))) return { error: '不是 git 仓库：' + target };
  store.pushUndo();

  const run = (args) => new Promise((res) => {
    execFile('git', args, { cwd: target, maxBuffer: 32 * 1024 * 1024, timeout: 30000 },
      (err, stdout) => res(err ? '' : stdout));
  });

  return run(['log', '--all', '--date=iso-strict', '--pretty=format:%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e'])
    .then(async (out) => {
      let proj = st.projects.find((p) => p.id === 'p_code');
      if (!proj) {
        proj = { id: 'p_code', name: 'code · 定价服务', lane: 3, color: '#7d8b99', keywords: [] };
        st.projects.push(proj);
      }
      const shaMap = {};
      let added = 0;
      for (const rec of out.split('\x1e')) {
        const line = rec.trim();
        if (!line) continue;
        const [sha, parents, author, date, subject] = line.split('\x1f');
        if (!sha) continue;
        const id = 'g_' + sha.slice(0, 7);
        shaMap[sha] = id;
        if (store.nodeById(id)) continue;
        st.nodes.push({
          id, project: 'p_code', type: 'version', title: (subject || '').slice(0, 40),
          summary: '提交', content_at: (date || '').slice(0, 10), ingest_at: engine.nowISO(),
          status: 'active', confidence: 1, auto: false, placement: 'grow',
          source: { file: null, locator: null, excerpt: subject || '' },
          extra: { 发布号: sha.slice(0, 7) }, parent: null, _parents: (parents || '').split(' ').filter(Boolean),
        });
        added++;
      }
      for (const n of st.nodes) {
        if (!n.id.startsWith('g_') || !n._parents) continue;
        n._parents.forEach((p, i) => {
          if (shaMap[p] && !st.edges.some((e) => e.from === n.id && e.to === shaMap[p])) {
            st.edges.push({ from: n.id, to: shaMap[p], kind: 'derived' });
          }
          if (i === 0) n.parent = shaMap[p];
        });
      }
      const tags = await run(['tag', '--list', '--format=%(refname:short)|%(creatordate:iso)']);
      for (const line of tags.split('\n')) {
        if (!line.includes('|')) continue;
        const [nm, created] = line.split('|');
        const id = 'tag_' + nm;
        if (store.nodeById(id)) continue;
        st.nodes.push({
          id, project: 'p_code', type: 'version', title: 'tag ' + nm, summary: '发布里程碑',
          content_at: (created || '').slice(0, 10), ingest_at: engine.nowISO(),
          status: 'active', confidence: 1, auto: false, placement: 'grow',
          source: { file: null, locator: null, excerpt: 'tag ' + nm },
          extra: { 发布号: nm }, parent: null,
        });
        added++;
      }
      store.save();
      return { added, total: st.nodes.filter((n) => n.project === 'p_code').length };
    });
}

/* ---------------- 窗口 ---------------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 640,
    backgroundColor: '#141519',
    title: '项目Git',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (SHOT_MODE) {
      setTimeout(async () => {
        if (process.argv.includes('--drawer')) {
          await new Promise(r => setTimeout(r, 1200));
          try {
            const r2 = await win.webContents.executeJavaScript('(function(){try{select("n08");return "ok";}catch(e){return "ERR:"+e.message}})()');
            fs.writeFileSync(path.join(ROOT, 'docs', 'dbg2.txt'), String(r2));
          } catch(e) { fs.writeFileSync(path.join(ROOT, 'docs', 'dbg2.txt'), 'EXE:' + e.message); }
          await new Promise(r => setTimeout(r, 700));
        }
        try {
          const dbg = await win.webContents.executeJavaScript('JSON.stringify({dbg:window.__dbg||{}, err:window.__err||null})');
          fs.writeFileSync(path.join(ROOT, 'docs', 'debug.json'), dbg || '{}');
        } catch (e) { console.error('dbg fail', e); }
        const img = await win.webContents.capturePage();
        const outPng = path.join(ROOT, 'docs', 'app-shot.png');
        fs.mkdirSync(path.dirname(outPng), { recursive: true });
        fs.writeFileSync(outPng, img.toPNG());
        console.log('shot saved', outPng);
        app.quit();
      }, 2600);
    }
  });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const send = (ch, payload) => win && win.webContents.send(ch, payload);
  const tpl = [
    {
      label: '文件',
      submenu: [
        { label: '重新载入数据', accelerator: 'CmdOrCtrl+R', click: () => { store.load(); send('reload'); } },
        { label: '打开数据目录', click: () => shell.openPath(store.dataDir()) },
        {
          label: '重置为演示数据', click: async () => {
            const { response } = await dialog.showMessageBox(win, {
              type: 'warning', buttons: ['取消', '重置'], defaultId: 0,
              message: '重置会把当前 data/state.json 换成演示数据（原文件备份为 state.bak.json）',
            });
            if (response !== 1) return;
            const src = path.join(ROOT, 'data', 'state.json');
            const dst = path.join(store.dataDir(), 'state.json');
            if (fs.existsSync(dst)) fs.copyFileSync(dst, dst.replace('.json', '.bak.json'));
            if (fs.existsSync(src) && src !== dst) fs.copyFileSync(src, dst);
            store.load(); send('reload');
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => send('zoom', 1) },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => send('zoom', -1) },
        { label: '适应窗口', accelerator: 'F', click: () => send('fit') },
        { type: 'separator' },
        { label: '调整模式', accelerator: 'E', click: () => send('toggle-edit') },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于项目Git', click: () => dialog.showMessageBox(win, {
            type: 'info', title: '项目Git',
            message: '项目Git · 团队知识的时间轴',
            detail: '代码有 git，项目也该有。\n\n任何输入丢进来，自己判断属于哪个项目、挂到哪个节点；\n想找什么，一句话，镜头推过去。',
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------------- IPC ---------------- */

function registerIpc() {
  ipcMain.handle('state:get', () => store.get());
  ipcMain.handle('capture', (e, p) => capture(p));
  ipcMain.handle('place', (e, p) => place(p));
  ipcMain.handle('edit', (e, p) => edit(p));
  ipcMain.handle('undo', () => ({ ok: store.undo() }));
  ipcMain.handle('redo', () => ({ ok: store.redo() }));
  ipcMain.handle('type:add', (e, p) => addType(p));
  ipcMain.handle('git:sync', (e, p) => gitSync(p || {}));
  ipcMain.handle('search', (e, p) => search(p));
  ipcMain.handle('file:open', (e, p) => openFile(p));
  ipcMain.handle('shell:open', (e, p) => shell.openPath(p));
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(), dataDir: store.dataDir(), packaged: app.isPackaged,
  }));
}

app.whenReady().then(() => {
  dataDir = resolveDataDir();
  store.init(dataDir);
  store.load();
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
