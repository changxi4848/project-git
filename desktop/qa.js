'use strict';
/* 项目Git · 知识问答 Agent Harness
   三层：工具层（5 个）→ Agent 循环（模型 or 本地兜底）→ 带引用的答案
   模型：OpenAI 兼容接口；没有 key 时自动切到本地确定性规划器（离线可跑、可评估）
*/
const fs = require('fs');
const path = require('path');

let store = null;
let engine = null;

function init(s, e) { store = s; engine = e; }

/* ================= 配置 ================= */
function config() {
  const file = path.join(store.dataDir(), 'qa_config.json');
  let c = {};
  try { if (fs.existsSync(file)) c = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return {
    baseURL: process.env.PG_QA_BASE_URL || c.baseURL || 'https://api.deepseek.com/v1',
    apiKey: process.env.PG_QA_API_KEY || c.apiKey || '',
    model: process.env.PG_QA_MODEL || c.model || 'deepseek-chat',
    timeoutMs: c.timeoutMs || 45000,
  };
}

/* ================= 工具层 ================= */
const TOOLS = [
  {
    name: 'list_projects',
    description: '列出所有项目及其条目数。跨项目问题先用它定位。',
    parameters: { type: 'object', properties: {}, required: [] },
    run() {
      const st = store.get();
      return st.projects.map((p) => ({
        id: p.id, name: p.name,
        count: st.nodes.filter((n) => n.project === p.id && n.status !== 'deleted').length,
      })).filter((p) => p.count > 0);
    },
  },
  {
    name: 'search',
    description: '全文检索条目，返回标题、类型、状态、时间、出处。可限定项目。',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: '关键词，中文即可' },
        project: { type: 'string', description: '项目 id，可选' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
    run({ q, project, limit = 8 }) {
      const st = store.get();
      let hits = engine.search(q, st, limit * 3);
      if (project) hits = hits.filter((h) => h.project === project);
      return hits.slice(0, limit).map((h) => {
        const n = store.nodeById(h.id) || {};
        return {
          id: h.id, title: h.title, type: h.type, status: h.status || 'active',
          date: h.content_at, project: h.project,
          why: (n.extra && n.extra['理由']) || null,
          has_source: !!(n.source && n.source.file),
        };
      });
    },
  },
  {
    name: 'get_node',
    description: '取单条完整信息：状态、上下游、字段、出处（含字符区间）。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    run({ id }) {
      const n = store.nodeById(id);
      if (!n) return { error: 'not found: ' + id };
      const st = store.get();
      const parents = (n.parents && n.parents.length) ? n.parents : (n.parent ? [n.parent] : []);
      const kids = st.nodes.filter((x) => (x.parent === id || (x.parents || []).includes(id)) && x.status !== 'deleted');
      return {
        id: n.id, title: n.title, type: n.type, status: n.status || 'active',
        date: n.content_at, project: n.project,
        summary: n.summary || '', extra: n.extra || {},
        prev: parents.map((p) => { const x = store.nodeById(p); return x ? { id: x.id, title: x.title, status: x.status } : null; }).filter(Boolean),
        next: kids.map((x) => ({ id: x.id, title: x.title, status: x.status })),
        source: n.source ? {
          file: n.source.file,
          path: n.source.path || ('data/files/' + n.source.file),
          locator: n.source.locator || null,
          excerpt: n.source.excerpt || '',
        } : null,
      };
    },
  },
  {
    name: 'get_timeline',
    description: '取某项目的主线顺序与所有分支（含终止、合并），用于回答“后来怎么样了”。',
    parameters: {
      type: 'object',
      properties: { project: { type: 'string' } },
      required: ['project'],
    },
    run({ project }) {
      const st = store.get();
      const ns = st.nodes.filter((n) => n.project === project && n.status !== 'deleted');
      const byId = new Map(ns.map((n) => [n.id, n]));
      const main = ns.filter((n) => (n.branch || 'main') === 'main')
        .sort((a, b) => engine.toMs(a.content_at) - engine.toMs(b.content_at));
      const branches = {};
      ns.forEach((n) => {
        const b = n.branch || 'main';
        if (b === 'main') return;
        (branches[b] = branches[b] || []).push({ id: n.id, title: n.title, date: n.content_at, status: n.status });
      });
      return {
        project,
        main: main.map((n) => ({ id: n.id, title: n.title, date: n.content_at, status: n.status || 'active' })),
        branches,
      };
    },
  },
  {
    name: 'get_citations',
    description: '取某条目的原文出处：文件、定位方式、区间、摘录。回答必须基于它。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    run({ id }) {
      const n = store.nodeById(id);
      if (!n || !n.source) return { error: 'no source for ' + id };
      const loc = n.source.locator || {};
      return {
        id: n.id, title: n.title,
        file: n.source.file,
        path: n.source.path || ('data/files/' + n.source.file),
        kind: loc.kind || 'text',
        page: loc.page || null,
        start: loc.start ?? null,
        end: loc.end ?? null,
        excerpt: n.source.excerpt || '',
      };
    },
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
function runTool(name, args) {
  const t = TOOL_MAP.get(name);
  if (!t) return { error: 'unknown tool: ' + name };
  try { return t.run(args || {}); } catch (e) { return { error: String(e.message || e) }; }
}

/* ================= 系统提示 ================= */
const SYSTEM = `你是「项目Git」的问答助手，服务一个同时推进多个项目的团队。
规则：
1. 只用工具返回的事实作答，不要编造。工具没给的信息，就说“资料里没有”。
2. 注意条目的 status：active（有效）/ superseded（被取代）/ abandoned（已放弃）。
   回答“为什么”时，要说清是哪一条、什么状态、依据是什么。
3. 如果用户问的是“后来怎么样了”，用 get_timeline 说明主线与分支（含终止）。
4. 每个结论都要带引用：文件名 + 定位（第几字/第几页）。没有出处的结论要标注“无原文”。
5. 回答用中文，先给结论，再给依据，最后列出引用清单。不超过 300 字。`;

/* ================= 模型调用（OpenAI 兼容） ================= */
async function chat(cfg, messages, tools) {
  const body = {
    model: cfg.model,
    messages,
    temperature: 0.2,
    tools: tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const r = await fetch(cfg.baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* ================= Agent 循环（有模型） ================= */
async function askWithModel(cfg, question) {
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: question }];
  const used = [];
  const citations = [];
  for (let step = 0; step < 6; step++) {
    const res = await chat(cfg, messages, TOOLS);
    const msg = res.choices && res.choices[0] && res.choices[0].message;
    if (!msg) throw new Error('空响应');
    messages.push(msg);
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      return { answer: msg.content || '', citations: dedupeCitations(citations), trace: used, mode: 'model:' + cfg.model };
    }
    for (const c of calls) {
      const name = c.function.name;
      let args = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch (e) {}
      const out = runTool(name, args);
      used.push({ tool: name, args });
      if (name === 'get_citations' && out && !out.error) citations.push(out);
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return { answer: '（达到工具调用上限，未得出结论）', citations: dedupeCitations(citations), trace: used, mode: 'model' };
}

function dedupeCitations(list) {
  const seen = new Set();
  return list.filter((c) => {
    const k = c.id;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/* ================= 本地兜底规划器（离线可跑） ================= */
function pickProject(st, q) {
  const scored = st.projects.map((p) => {
    const ns = st.nodes.filter((n) => n.project === p.id);
    let s = 0;
    if (q.includes(p.name)) s += 10;
    p.name.split(/[·\s]+/).forEach((w) => { if (w && q.includes(w)) s += 4; });
    ns.forEach((n) => {
      if (q.includes(n.title.slice(0, 4))) s += 2;
    });
    return { id: p.id, name: p.name, s, count: ns.length };
  }).filter((x) => x.count > 0).sort((a, b) => b.s - a.s);
  return scored[0] && scored[0].s > 0 ? scored[0] : null;
}

const STATUS_CN = { active: '有效', superseded: '已被取代', abandoned: '已放弃' };

function fmtCite(c) {
  if (!c) return '';
  const loc = c.kind === 'pdf' ? `第 ${c.page} 页` : (c.start != null ? `第 ${c.start}–${c.end} 字` : '');
  return `${c.file}${loc ? ' · ' + loc : ''}`;
}

function askLocal(question) {
  const st = store.get();
  const trace = [];
  const citations = [];
  const proj = pickProject(st, question);
  const scope = proj ? proj.id : null;

  const wantStatus = /放弃|终止|走错|废|没用|走不通|否掉/.test(question);
  const wantTime = /后来|之后|最后|现在|还有效|取代/.test(question);
  const wantCite = /原文|出处|哪一段|第几|引用/.test(question);

  // 1) 检索
  const hits = runTool('search', { q: question, project: scope || undefined, limit: 6 });
  trace.push({ tool: 'search', args: { q: question, project: scope } });
  const pool = (Array.isArray(hits) ? hits : []).filter((h) => h.id);

  // 2) 优先级：状态相关的问题先看 abandoned/superseded
  let picked = pool;
  if (/为什么放弃|为啥放弃|为何放弃/.test(question)) {
    const doer = pool.filter((h) => /放弃/.test(h.title) && !/走错/.test(h.title));
    if (doer.length) picked = doer.concat(pool.filter((h) => !doer.includes(h)));
  }
  if (wantStatus) {
    const dead = pool.filter((h) => h.status === 'abandoned' || h.status === 'superseded');
    if (dead.length) picked = dead.concat(pool.filter((h) => !dead.includes(h)));
  }
  const top = picked.slice(0, 3);
  if (!top.length) {
    return {
      answer: '资料里没有找到相关内容。可以换个说法，或先把它「收进来」。',
      citations: [], trace, mode: 'local',
    };
  }

  // 3) 取详情 + 引用
  const details = top.map((h) => {
    const d = runTool('get_node', { id: h.id });
    trace.push({ tool: 'get_node', args: { id: h.id } });
    if (d && d.source) {
      const c = runTool('get_citations', { id: h.id });
      trace.push({ tool: 'get_citations', args: { id: h.id } });
      if (c && !c.error) citations.push(c);
    }
    return d;
  });

  // 4) 时间线（问“后来/最后”时）
  let timeline = null;
  if (wantTime && scope) {
    timeline = runTool('get_timeline', { project: scope });
    trace.push({ tool: 'get_timeline', args: { project: scope } });
  }

  // 5) 组织答案
  const lead = details[0];
  const lines = [];
  const st1 = STATUS_CN[lead.status] || lead.status;
  lines.push(`**结论**：${lead.title}（${st1} · ${lead.date}）`);
  const why = (lead.extra && lead.extra['理由']) || lead.summary;
  if (why) lines.push(`**依据**：${why}`);

  if (lead.prev && lead.prev.length) {
    lines.push(`**之前**：${lead.prev.map((p) => `${p.title}${p.status === 'abandoned' ? '（已放弃）' : ''}`).join(' → ')}`);
  }
  if (wantTime && timeline) {
    const tail = timeline.main.slice(-2).map((m) => `${m.title}${m.status !== 'active' ? '（' + (STATUS_CN[m.status] || m.status) + '）' : ''}`);
    if (tail.length) lines.push(`**后来**：${tail.join(' → ')}`);
    const deadBranches = Object.entries(timeline.branches)
      .filter(([, arr]) => arr.some((x) => x.status === 'abandoned'));
    if (deadBranches.length) {
      lines.push(`**放弃的尝试**：${deadBranches.map(([k, arr]) => `${arr.map((x) => x.title).join('、')}（${k}）`).join('；')}`);
    }
  }
  if (details.length > 1) {
    lines.push(`**相关**：${details.slice(1).map((d) => d.title).join('、')}`);
  }
  if (!citations.length) lines.push('', '（这条没有原文，结论来自粘贴录入）');

  return { answer: lines.join('\n'), citations: dedupeCitations(citations), trace, mode: 'local', project: scope };
}

/* ================= 对外入口 ================= */
async function ask(question) {
  const cfg = config();
  const started = Date.now();
  if (cfg.apiKey) {
    try {
      const r = await askWithModel(cfg, question);
      return { ok: true, ...r, ms: Date.now() - started };
    } catch (e) {
      const fb = askLocal(question);
      return { ok: true, ...fb, mode: 'local(fallback: ' + String(e.message || e).slice(0, 80) + ')', ms: Date.now() - started };
    }
  }
  const r = askLocal(question);
  return { ok: true, ...r, ms: Date.now() - started };
}

function describe() {
  const cfg = config();
  return {
    mode: cfg.apiKey ? 'model' : 'local',
    baseURL: cfg.baseURL, model: cfg.model,
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  };
}

module.exports = { init, ask, describe, TOOLS, runTool };
