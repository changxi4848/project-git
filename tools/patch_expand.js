'use strict';
/* 给 qa.js 加「换说法」能力：同义扩展 + 二次扫描 + 事实型直答 */
const fs = require('fs');
const p = 'desktop/qa.js';
let s = fs.readFileSync(p, 'utf8');

/* 1) 同义扩展表 */
if (!s.includes('const EXPAND')) {
  s = s.replace('/* ================= 配置 ================= */',
`/* ================= 换说法的同义扩展 ================= */
const EXPAND = [
  [/(连接方式|连法|怎么连|通信方式)/, ['GATT', '直连', 'HID']],
  [/(广播名|设备名|名字)/, ['Elite', '广播', 'productKey']],
  [/(提交号|commit|版本号|基线)/, ['b6677ef', '基线', 'commit']],
  [/(抓\s*USB|抓包|抓数据|监听)/, ['CDC-ACM', '抓包', '串口']],
  [/(动态库|dll|库文件)/, ['LibH', 'dll', 'jar']],
  [/(脱壳|加固)/, ['脱壳', '360', '走错']],
  [/(动硬件|改板|硬件改动|天线)/, ['改板', '天线', 'PCB']],
  [/(安卓|手机端)/, ['安卓', '暂停', '归档']],
  [/(论文|毕业论文)/, ['论文', '初稿', '答辩']],
  [/(微调|fine.?tune)/, ['微调', 'RAG', '检索']],
  [/(向量|embedding)/, ['bge', '向量']],
  [/(标注|一致性)/, ['标注', '一致性', '0.61']],
  [/(逻辑分析仪)/, ['CDC-ACM', '抓包']],
  [/(FFF1|55\s*帧|不发\s*55)/, ['FFF1', '55', '订阅']],
  [/(硬件项目|两个硬件)/, ['中继', 'PCB', '平板']],
  [/(复盘|回顾|总结)/, ['复盘', '回顾']],
  [/(放弃|走不通|没用|废掉)/, ['放弃', '走错', 'abandoned']],
];

function expandQuery(q) {
  const add = [];
  EXPAND.forEach(([re, words]) => { if (re.test(q)) add.push(...words); });
  return { extra: add, q: add.length ? q + ' ' + add.join(' ') : q };
}

/* 2) 二次扫描：标题/摘要/字段/摘录里的词命中 */
function scanNodes(st, terms, project) {
  const out = [];
  st.nodes.forEach((n) => {
    if (n.status === 'deleted') return;
    if (project && n.project !== project) return;
    const hay = [
      n.title, n.summary,
      Object.values(n.extra || {}).join(' '),
      (n.source && n.source.excerpt) || '',
    ].join(' ').toLowerCase();
    let sc = 0;
    terms.forEach((t) => { if (t && hay.includes(String(t).toLowerCase())) sc += 2; });
    if (sc > 0) out.push({ id: n.id, score: sc });
  });
  return out.sort((a, b) => b.score - a.score);
}

/* ================= 配置 ================= */`);
}

/* 3) 检索阶段用扩展后的词，并合并二次扫描结果 */
s = s.replace(`  // 1) 检索
  const hits = runTool('search', { q: question, project: scope || undefined, limit: 6 });
  trace.push({ tool: 'search', args: { q: question, project: scope } });
  const pool = (Array.isArray(hits) ? hits : []).filter((h) => h.id);`,
`  // 1) 检索：原问 + 同义扩展 + 二次扫描
  const ex = expandQuery(question);
  const hits = runTool('search', { q: ex.q, project: scope || undefined, limit: 8 });
  trace.push({ tool: 'search', args: { q: ex.q, project: scope } });
  let pool = (Array.isArray(hits) ? hits : []).filter((h) => h.id);

  const terms = [question, ...ex.extra].filter(Boolean);
  const scanned = scanNodes(store.get(), terms, scope);
  trace.push({ tool: 'scan', args: { terms: ex.extra } });
  const seen = new Set(pool.map((h) => h.id));
  scanned.slice(0, 6).forEach((h) => {
    if (seen.has(h.id)) return;
    const n = store.nodeById(h.id);
    if (!n) return;
    pool.push({
      id: n.id, title: n.title, type: n.type, status: n.status || 'active',
      date: n.content_at, project: n.project,
      why: (n.extra && n.extra['理由']) || null,
      has_source: !!(n.source && n.source.file),
      _scan: h.score,
    });
  });
  // 二次扫描命中的排前面
  pool.sort((a, b) => (b._scan || 0) - (a._scan || 0));`);

/* 4) 事实型问题：直接给“值” */
s = s.replace(`  // 5) 组织答案
  const lead = details[0];`,
`  // 5) 组织答案
  const lead = details[0];
  const isFact = /什么|哪个|哪份|多少|叫什么|是谁/.test(question);
  if (isFact) {
    const exKeys = Object.entries(lead.extra || {});
    const direct = exKeys.find(([k, v]) => terms.some((t) => String(v).includes(t)) || /结论|值|名称|版本/.test(k));
    if (direct && String(direct[1]).length < 60) {
      const lines0 = [\`**答案**：\${direct[1]}\`, \`**出自**：\${lead.title}（\${STATUS_CN[lead.status] || lead.status} · \${lead.date}）\`];
      if (citations.length) lines0.push('', '原文见下方引用。');
      return { answer: lines0.join('\\n'), citations: dedupeCitations(citations), trace, mode: 'local', project: scope };
    }
  }`);
fs.writeFileSync(p, s);
console.log('patched');
