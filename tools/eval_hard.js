'use strict';
/* 难问法 20 题（全部换说法）：node tools/eval_hard.js */
const path = require('path');
const store = require('../desktop/store');
const engine = require('../desktop/engine');
const qa = require('../desktop/qa');

store.init(path.join(__dirname, '..', 'data'));
store.load();
qa.init(store, engine);

const CASES = [
  { c: '事实', q: '一开始想用什么办法顶住大部分工单？', expect: ['规则'] },
  { c: '事实', q: '后来靠什么把长尾也接住了？', expect: ['模型'] },
  { c: '事实', q: '为什么最后没选效果最好的那条路？', expect: ['卡'] },
  { c: '事实', q: '盒子上的模型是怎么压到能跑动的？', expect: ['int8'] },
  { c: '事实', q: '现场断网了事件会不会丢？', expect: ['缓存'] },
  { c: '事实', q: '雨雾天怎么处理的？', expect: ['阈值'] },
  { c: '状态', q: '哪条路线试过但放弃了？', expect: ['放弃'] },
  { c: '状态', q: 'WiFi 那条路还在用吗？', expect: ['WiFi'] },
  { c: '状态', q: '微调这条路现在还在做吗？', expect: ['微调'] },
  { c: '状态', q: '什么时候把版本钉死的？', expect: ['v1.0'] },
  { c: '状态', q: '为什么没敢一次全量放开？', expect: ['灰度'] },
  { c: '状态', q: '扩量之前还差什么？', expect: ['值班'] },
  { c: '跨项目', q: '哪些项目里有被否掉的做法？', expect: ['放弃'] },
  { c: '跨项目', q: '三个项目分别卡在哪一步？', expect: ['长尾'] },
  { c: '跨项目', q: '哪个项目是靠省成本取胜的？', expect: ['线性'] },
  { c: '跨项目', q: '有哪个项目做了灰度？', expect: ['灰度'] },
  { c: '跨项目', q: '哪个项目交付的是硬件？', expect: ['盒子'] },
  { c: '溯源', q: '「要一张卡」这句话出自哪份材料？', expect: ['评测'], cite: '北极星-分类模型评测.md' },
  { c: '溯源', q: '断链不丢事件的设计写在哪？', expect: ['缓存'], cite: '山海-本地缓存设计.md' },
  { c: '溯源', q: '误判 12% 这个数是从哪来的？', expect: ['误判'], cite: '潮汐-误判分析.md' },
];

(async () => {
  const cfg = qa.describe();
  console.log(`模式: ${cfg.mode}  模型: ${cfg.model}   题目: ${CASES.length}（全部换说法）`);
  console.log('─'.repeat(84));
  const byCat = {};
  let ok = 0, citeOk = 0, citeNeed = 0, ms = 0;
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const t0 = Date.now();
    let r;
    try { r = await qa.ask(c.q); } catch (e) { r = { answer: '', citations: [] }; }
    ms += Date.now() - t0;
    const ans = r.answer || '';
    const hit = c.expect.every((k) => ans.includes(k));
    const cites = (r.citations || []).map((x) => x.file);
    let cHit = null;
    if (c.cite) { citeNeed++; cHit = cites.includes(c.cite); if (cHit) citeOk++; }
    if (hit) ok++;
    byCat[c.c] = byCat[c.c] || { n: 0, ok: 0 };
    byCat[c.c].n++; if (hit) byCat[c.c].ok++;
    console.log(`${String(i + 1).padStart(2)}. [${c.c}] ${hit ? '✅' : '❌'} ${c.q}` + (c.cite ? `  [引用${cHit ? '✅' : '❌'}]` : ''));
    if (!hit) console.log('     答: ' + ans.replace(/\n/g, ' ').slice(0, 76));
  }
  console.log('─'.repeat(84));
  console.log(`总命中 ${ok}/${CASES.length} = ${(ok / CASES.length * 100).toFixed(0)}%`);
  Object.entries(byCat).forEach(([k, v]) => console.log(`  ${k}: ${v.ok}/${v.n}`));
  if (citeNeed) console.log(`引用命中 ${citeOk}/${citeNeed}`);
  console.log(`平均耗时 ${(ms / CASES.length).toFixed(0)}ms`);
})();
