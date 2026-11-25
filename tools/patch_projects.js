'use strict';
/* 项目管理：新建 / 删除 / 清空 + 仓库不带私人数据 */
const fs = require('fs');

/* ---------- 1) 主进程 IPC ---------- */
let m = fs.readFileSync('desktop/main.js', 'utf8');
if (!m.includes('project:create')) {
  m = m.replace("  ipcMain.handle('state:reset',",
`  ipcMain.handle('project:create', async (e, p) => {
    const name = String((p && p.name) || '').trim();
    if (!name) return { error: '项目名不能为空' };
    const st = store.get();
    if (st.projects.some((x) => x.name === name)) return { error: '已有同名项目' };
    const id = 'p_' + name.toLowerCase().replace(/[^\\w\\u4e00-\\u9fa5]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '_' + Date.now().toString(36).slice(-4);
    st.projects.push({ id, name });
    store.save();
    return { ok: true, id, name };
  });

  ipcMain.handle('project:delete', async (e, p) => {
    const id = String((p && p.id) || '');
    const st = store.get();
    const proj = st.projects.find((x) => x.id === id);
    if (!proj) return { error: '项目不存在' };
    const ids = new Set(st.nodes.filter((n) => n.project === id).map((n) => n.id));
    const n0 = st.nodes.length, e0 = st.edges.length;
    st.nodes = st.nodes.filter((n) => n.project !== id);
    st.edges = st.edges.filter((x) => !ids.has(x.from) && !ids.has(x.to));
    st.projects = st.projects.filter((x) => x.id !== id);
    try { fs.writeFileSync(path.join(store.dataDir(), 'state.before-delete.json'), JSON.stringify(st, null, 1)); } catch (x) {}
    store.save();
    return { ok: true, name: proj.name, removedNodes: n0 - st.nodes.length, removedEdges: e0 - st.edges.length };
  });

  ipcMain.handle('state:clear', async () => {
    const st = store.get();
    const n0 = st.nodes.length;
    try { fs.writeFileSync(path.join(store.dataDir(), 'state.before-clear.json'), JSON.stringify(st, null, 1)); } catch (x) {}
    st.projects = []; st.nodes = []; st.edges = [];
    store.save();
    return { ok: true, removedNodes: n0 };
  });

  ipcMain.handle('state:reset',`);
  fs.writeFileSync('desktop/main.js', m);
  console.log('main ok');
}

/* ---------- 2) preload ---------- */
let pr = fs.readFileSync('desktop/preload.js', 'utf8');
if (!pr.includes('createProject')) {
  pr = pr.replace("  resetState: () => ipcRenderer.invoke('state:reset'),",
`  resetState: () => ipcRenderer.invoke('state:reset'),
  createProject: (p) => ipcRenderer.invoke('project:create', p),
  deleteProject: (p) => ipcRenderer.invoke('project:delete', p),
  clearAll: () => ipcRenderer.invoke('state:clear'),`);
  fs.writeFileSync('desktop/preload.js', pr);
  console.log('preload ok');
}

/* ---------- 3) index.html：设置里加项目管理 ---------- */
let h = fs.readFileSync('desktop/web/index.html', 'utf8');
if (!h.includes('set-newproj')) {
  h = h.replace('      <div class="grow"></div>',
`      <div class="set-sep"></div>
      <div class="set-row"><label>项目管理</label>
        <input id="set-newproj" placeholder="新项目名称，回车创建" />
        <button class="btn ghost small" id="set-newgo">新建</button>
      </div>
      <div class="set-actions">
        <button class="btn ghost small" id="set-delproj">删除当前项目</button>
        <button class="btn ghost small" id="set-clear">清空所有数据</button>
      </div>
      <div class="grow"></div>`);
  fs.writeFileSync('desktop/web/index.html', h);
}

/* ---------- 4) style ---------- */
let c = fs.readFileSync('desktop/web/style.css', 'utf8');
if (!c.includes('.set-sep')) {
  c += `
.set-sep{height:1px; background:#F1F4F7; margin:6px 0 12px}
.set-actions{display:flex; gap:8px; margin:0 0 12px 82px}
.set-row input#set-newproj{max-width:260px}
`;
  fs.writeFileSync('desktop/web/style.css', c);
}

/* ---------- 5) app.js：绑定 ---------- */
let a = fs.readFileSync('desktop/web/app.js', 'utf8');
if (!a.includes('set-newgo')) {
  a = a.replace("  const setSave = $('#set-save');",
`  const newGo = $('#set-newgo');
  if (newGo) newGo.onclick = async () => {
    const name = ($('#set-newproj').value || '').trim();
    if (!name) return toast('先填项目名');
    const r = await window.api.createProject({ name });
    if (r.error) return toast(r.error);
    S = await window.api.state();
    curProject = r.id; renderTabs(); rebuild();
    $('#set').classList.add('hidden');
    toast('已新建：' + r.name);
  };
  const newInput = $('#set-newproj');
  if (newInput) newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') newGo && newGo.click(); });

  const delProj = $('#set-delproj');
  if (delProj) delProj.onclick = async () => {
    const p = S.projects.find((x) => x.id === curProject);
    if (!p) return toast('没有可删的项目');
    if (!confirm('删除项目「' + p.name + '」及其全部条目与关系？\\n（会先备份为 state.before-delete.json）')) return;
    const r = await window.api.deleteProject({ id: curProject });
    if (r.error) return toast(r.error);
    S = await window.api.state();
    curProject = (S.projects[0] || {}).id || null;
    renderTabs(); rebuild();
    $('#set').classList.add('hidden');
    toast('已删除「' + r.name + '」：' + r.removedNodes + ' 条记录');
  };

  const clearAll = $('#set-clear');
  if (clearAll) clearAll.onclick = async () => {
    if (!confirm('清空所有项目、条目与关系？\\n（会先备份为 state.before-clear.json）')) return;
    const r = await window.api.clearAll();
    if (r.error) return toast(r.error);
    S = await window.api.state();
    curProject = null; selected = null;
    renderTabs(); rebuild();
    $('#set').classList.add('hidden');
    toast('已清空：' + r.removedNodes + ' 条记录');
  };

  const setSave = $('#set-save');`);
  fs.writeFileSync('desktop/web/app.js', a);
  console.log('app ok');
}

/* ---------- 6) 空项目也要能显示 ---------- */
let a2 = fs.readFileSync('desktop/web/app.js', 'utf8');
a2 = a2.replace("function rebuild() {\n  const vn = S.nodes.filter(",
  "function rebuild() {\n  if (!curProject) { model = { items: [], byId: new Map(), trunk: [], binfo: [], boxes: [], rowInfo: [] }; draw(); return; }\n  const vn = S.nodes.filter(");
fs.writeFileSync('desktop/web/app.js', a2);
console.log('done');
