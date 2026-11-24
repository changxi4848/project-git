'use strict';
/* 项目Git · 批量迁移入口
   任何 Agent / 脚本把「项目 + 条目 + 关系」按约定 JSON 丢进来，
   这里做标准化、校验、去重，然后落盘，图会自动长出来。
*/
const fs = require('fs');
const path = require('path');

const TYPE_ALIAS = {
  '决策': 'decision', '决定': 'decision', 'decision': 'decision',
  '方案': 'plan', '计划': 'plan', 'plan': 'plan',
  '复盘': 'retro', '回顾': 'retro', '总结': 'retro', 'retro': 'retro',
  '资料': 'doc', '文档': 'doc', 'doc': 'doc',
  '数据': 'data', 'data': 'data',
  '代码': 'code', 'code': 'code',
  '产出': 'output', '成果': 'output', 'output': 'output',
};
const STATUS_ALIAS = {
  '有效': 'active', 'active': 'active', '进行中': 'active',
  '已放弃': 'abandoned', '放弃': 'abandoned', 'abandoned': 'abandoned', '废弃': 'abandoned',
  '已取代': 'superseded', '取代': 'superseded', 'superseded': 'superseded',
  '草稿': 'draft', 'draft': 'draft',
};
const EDGE_KINDS = new Set(['derived', 'supersedes', 'relates', 'attach', 'uses']);

function normType(t) {
  if (!t) return 'doc';
  return TYPE_ALIAS[String(t).trim()] || (TYPE_ALIAS[String(t).trim().toLowerCase()] || 'doc');
}
function normStatus(s) {
  if (!s) return 'active';
  return STATUS_ALIAS[String(s).trim()] || (STATUS_ALIAS[String(s).trim().toLowerCase()] || 'active');
}
function normDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const s = String(d).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})([-/.](\d{1,2}))?/);
  if (m) {
    const mm = String(m[2]).padStart(2, '0');
    const dd = String(m[4] || '01').padStart(2, '0');
    return `${m[1]}-${mm}-${dd}`;
  }
  m = s.match(/^(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3] || '01').padStart(2, '0')}`;
  const t = Date.parse(s);
  return isNaN(t) ? new Date().toISOString().slice(0, 10) : new Date(t).toISOString().slice(0, 10);
}
function slug(s) {
  return String(s).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'item';
}

/* ---------- 标准化 ---------- */
function normalize(batch, state) {
  const warnings = [];
  const projectIn = batch.project || {};
  const pname = projectIn.name || batch.projectName || '未命名项目';
  let pid = projectIn.id || batch.projectId;
  if (!pid) {
    const hit = state.projects.find((p) => p.name === pname);
    pid = hit ? hit.id : 'p_' + slug(pname);
  }
  const project = { id: pid, name: pname };

  const nodesIn = Array.isArray(batch.nodes) ? batch.nodes : [];
  if (!nodesIn.length) warnings.push('nodes 为空');

  const nodes = [];
  const keyToId = new Map();
  nodesIn.forEach((raw, i) => {
    const title = String(raw.title || raw.name || '').trim();
    if (!title) { warnings.push(`第 ${i + 1} 条没有 title，已跳过`); return; }
    const type = normType(raw.type);
    const date = normDate(raw.date || raw.content_at || raw.at);
    const id = raw.id || `${pid}_${slug(title)}`;
    const n = {
      id, project: pid, type, title,
      summary: String(raw.summary || raw.desc || '').slice(0, 500),
      content_at: date,
      ingest_at: new Date().toISOString(),
      status: normStatus(raw.status),
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.95,
      auto: false,
      placement: 'grow',
      branch: raw.branch || 'main',
      parents: normParents(raw),
      extra: raw.extra && typeof raw.extra === 'object' ? raw.extra : {},
      source: null,
    };
    if (raw.tag) n.tag = String(raw.tag);
    if (raw.source && (raw.source.file || raw.source.text)) {
      const loc = raw.source.locator || {};
      n.source = {
        file: raw.source.file || (slug(title) + '.md'),
        path: raw.source.path || (raw.source.file ? 'data/files/' + raw.source.file : ''),
        locator: loc.kind ? loc : (loc.start != null ? { kind: 'text', start: loc.start, end: loc.end ?? loc.start } : null),
        excerpt: String(raw.source.excerpt || '').slice(0, 400),
      };
      if (raw.source.text) n.source.text = String(raw.source.text).slice(0, 20000);
    }
    keyToId.set(String(raw.key || raw.id || title), id);
    nodes.push(n);
  });

  // 父节点引用：支持 key / id / 标题
  nodes.forEach((n) => {
    n.parents = n.parents.map((p) => keyToId.get(String(p)) || String(p)).filter(Boolean);
    if (n.parents.length === 1) n.parent = n.parents[0];
    if (n.parents.length === 0) delete n.parent;
  });

  const edges = [];
  (Array.isArray(batch.edges) ? batch.edges : []).forEach((e, i) => {
    const from = keyToId.get(String(e.from)) || String(e.from || '');
    const to = keyToId.get(String(e.to)) || String(e.to || '');
    const kind = EDGE_KINDS.has(e.kind) ? e.kind : 'derived';
    if (!from || !to) { warnings.push(`第 ${i + 1} 条关系缺少 from/to，已跳过`); return; }
    edges.push({ from, to, kind });
  });
  // 父节点自动生成 derived 边
  nodes.forEach((n) => {
    (n.parents || []).forEach((p) => {
      if (!edges.some((e) => e.from === n.id && e.to === p)) edges.push({ from: n.id, to: p, kind: 'derived' });
    });
  });

  return { project, nodes, edges, warnings };
}

function normParents(raw) {
  const p = raw.parents ?? raw.parent;
  if (!p) return [];
  return Array.isArray(p) ? p.filter(Boolean) : [p];
}

/* ---------- 应用 ---------- */
function apply(batch, store, opts = {}) {
  const state = store.get();
  const { project, nodes, edges, warnings } = normalize(batch, state);
  const dry = !!opts.dryRun;

  const proj = state.projects.find((p) => p.id === project.id);
  const out = { project, warnings, created: 0, updated: 0, skipped: 0, edges: 0, dryRun: dry };

  if (!dry && !proj) state.projects.push({ id: project.id, name: project.name });
  else if (!dry && proj && proj.name !== project.name) proj.name = project.name;

  const seen = new Set(state.nodes.map((n) => `${n.project}|${n.title}|${n.content_at}`));
  nodes.forEach((n) => {
    const k = `${n.project}|${n.title}|${n.content_at}`;
    if (seen.has(k)) { out.skipped++; return; }
    seen.add(k);
    const exists = state.nodes.find((x) => x.id === n.id);
    if (exists) {
      Object.assign(exists, n);
      out.updated++;
    } else {
      // 批次内的父节点引用要指向最终 id
      state.nodes.push(n);
      out.created++;
    }
  });

  const edgeKey = new Set(state.edges.map((e) => `${e.from}|${e.to}|${e.kind}`));
  edges.forEach((e) => {
    const k = `${e.from}|${e.to}|${e.kind}`;
    if (edgeKey.has(k)) return;
    edgeKey.add(k);
    if (!dry) state.edges.push(e);
    out.edges++;
  });

  if (!dry) {
    try {
      const bak = path.join(store.dataDir(), 'state.before-ingest.json');
      fs.writeFileSync(bak, JSON.stringify(state, null, 1));
    } catch (e) {}
    store.save();
  }
  return out;
}

function schemaText() {
  return JSON.stringify({
    project: { id: 'p_demo', name: '项目名' },
    nodes: [{
      key: 'k1', type: 'decision|plan|retro|doc|data|code|output',
      title: '标题', summary: '一句话摘要', date: '2026-09-02',
      status: 'active|abandoned|superseded|draft', branch: 'main|feat/xxx',
      parents: ['k0'], tag: 'v1.0',
      source: { file: '原文.md', locator: { kind: 'text', start: 0, end: 10 }, excerpt: '原文片段' },
      extra: { '理由': '...' },
    }],
    edges: [{ from: 'k1', to: 'k0', kind: 'derived|supersedes|relates|attach|uses' }],
  }, null, 2);
}

module.exports = { apply, normalize, normType, normStatus, normDate, TYPE_ALIAS, STATUS_ALIAS, schemaText };
