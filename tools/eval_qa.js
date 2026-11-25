'use strict';
/* 简单问法 20 题（含标题词）：node tools/eval_qa.js */
const path = require('path');
const store = require('../desktop/store');
const engine = require('../desktop/engine');
const qa = require('../desktop/qa');

store.init(path.join(__dirname, '..', 'data'));
store.load();
qa.init(store, engine);

const CASES = [
  { q: '为什么放弃微调小模型？', expect: ['微调'], cite: '北极星-分类模型评测.md' },
  { q: '微调放弃之后改用了什么？', expect: ['线性'] },
  { q: '现场 WiFi 回传为什么不可靠？', expect: ['WiFi'] },
  { q: '改成了什么回传方式？', expect: ['4G'] },
  { q: '边缘推理为什么只回传事件？', expect: ['事件'] },
  { q: '误报集中在什么天气？', expect: ['雨雾'] },
  { q: '误判率从多少降到多少？', expect: ['12', '6.4'] },
  { q: '低置信度转人工的阈值是多少？', expect: ['0.6'] },
  { q: '北极星用什么模型做分类？', expect: ['线性'] },
  { q: '山海交付的验收标准是什么？', expect: ['误报'] },
  { q: '潮汐灰度扩到多少？', expect: ['50'] },
  { q: '分流服务用什么框架？', expect: ['FastAPI'] },
  { q: '知识库有多少篇？', expect: ['260'] },
  { q: '工单样本有多少条？', expect: ['18,400'] },
  { q: '现场样本有多少段？', expect: ['31,200'] },
  { q: '申诉样本有多少条？', expect: ['1,200'] },
  { q: '哪个项目有放弃的尝试？', expect: ['放弃'] },
  { q: '试点覆盖几个点位？', expect: ['11'] },
  { q: '边缘推理单帧耗时多少？', expect: ['11ms'] },
  { q: '上线后首响从多少降到多少？', expect: ['4.2', '1.9'] },
];

(async () => {
  const cfg = qa.describe();
  console.log(`模式: ${cfg.mode}  模型: ${cfg.model}`);
  console.log('─'.repeat(78));
  let ok = 0, citeOk = 0, citeNeed = 0, ms = 0;
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const t0 = Date.now();
    const r = await qa.ask(c.q);
    ms += Date.now() - t0;
    const ans = r.answer || '';
    const hit = c.expect.every((k) => ans.includes(k));
    const cites = (r.citations || []).map((x) => x.file);
    let cHit = null;
    if (c.cite) { citeNeed++; cHit = cites.includes(c.cite); if (cHit) citeOk++; }
    if (hit) ok++;
    console.log(`${String(i + 1).padStart(2)}. ${hit ? '✅' : '❌'} ${c.q}` + (c.cite ? `  [引用${cHit ? '✅' : '❌'}]` : ''));
    if (!hit) console.log('     ' + ans.replace(/\n/g, ' ').slice(0, 80));
  }
  console.log('─'.repeat(78));
  console.log(`命中 ${ok}/${CASES.length} = ${(ok / CASES.length * 100).toFixed(0)}%`);
  if (citeNeed) console.log(`引用命中 ${citeOk}/${citeNeed}`);
  console.log(`平均耗时 ${(ms / CASES.length).toFixed(0)}ms`);
})();
