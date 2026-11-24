'use strict';
/* 难问法评估：20 题，全部换说法，不含标题词。
   分类：事实 / 状态 / 跨项目 / 溯源。
   用法：node tools/eval_hard.js
*/
const path = require('path');
const store = require('../desktop/store');
const engine = require('../desktop/engine');
const qa = require('../desktop/qa');

store.init(path.join(__dirname, '..', 'data'));
store.load();
qa.init(store, engine);

const CASES = [
  // ---------- 事实 ----------
  { c: '事实', q: '当初为什么以为 HID 那条路能走通？', expect: ['HID'] },
  { c: '事实', q: '后来换成了什么连接方式？', expect: ['GATT'] },
  { c: '事实', q: '设备的广播名叫什么，Windows 才认？', expect: ['Elite'] },
  { c: '事实', q: '我们把哪个提交号当成稳定的版本？', expect: ['b6677ef'] },
  { c: '事实', q: '抓 USB 数据用的是什么办法？', expect: ['CDC-ACM'] },
  { c: '事实', q: '最后逆向的是哪个动态库？', expect: ['LibH'] },

  // ---------- 状态 ----------
  { c: '状态', q: '哪条路试到一半发现走不通，放弃了？', expect: ['HID'] },
  { c: '状态', q: '脱壳这条线现在还在做吗？', expect: ['脱壳'] },
  { c: '状态', q: '安卓那边为什么没继续？', expect: ['安卓'] },
  { c: '状态', q: '基线都定了，为什么还要动硬件？', expect: ['改板'] },
  { c: '状态', q: '名字改成 Plus 之后出了什么问题？', expect: ['Plus'] },
  { c: '状态', q: '有没有试过用逻辑分析仪？', expect: ['CDC-ACM'] },

  // ---------- 跨项目 ----------
  { c: '跨项目', q: '哪些项目里有被放弃的尝试？', expect: ['放弃'] },
  { c: '跨项目', q: '哪些项目留下过复盘记录？', expect: ['复盘'] },
  { c: '跨项目', q: '我们的硬件项目分别在解决什么问题？', expect: ['中继'] },
  { c: '跨项目', q: '哪个项目换过技术路线，比如把微调换掉？', expect: ['RAG'] },
  { c: '跨项目', q: '论文相关的东西在哪个项目里？', expect: ['论文'] },

  // ---------- 溯源 ----------
  { c: '溯源', q: '刚才那句“稳定基线”的原文在哪一份材料里？', expect: ['试错'], cite: '中继底座-试错记录.md' },
  { c: '溯源', q: '交接文档是从哪个文件来的？', expect: ['交接'], cite: '中继底座-交接文档.md' },
  { c: '溯源', q: '哪份材料能证明“只订阅 FFF1 不发 55”？', expect: ['试错'], cite: '中继底座-试错记录.md' },
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
    const dt = Date.now() - t0;
    ms += dt;
    const ans = r.answer || '';
    const hit = c.expect.every((k) => ans.includes(k));
    const cites = (r.citations || []).map((x) => x.file);
    let cHit = null;
    if (c.cite) { citeNeed++; cHit = cites.includes(c.cite); if (cHit) citeOk++; }
    if (hit) ok++;
    byCat[c.c] = byCat[c.c] || { n: 0, ok: 0 };
    byCat[c.c].n++; if (hit) byCat[c.c].ok++;
    console.log(`${String(i + 1).padStart(2)}. [${c.c}] ${hit ? '✅' : '❌'} ${c.q}` + (c.cite ? `  [引用${cHit ? '✅' : '❌'}]` : ''));
    if (!hit) console.log(`     答: ${ans.replace(/\n/g, ' ').slice(0, 78)}`);
  }
  console.log('─'.repeat(84));
  console.log(`总命中 ${ok}/${CASES.length} = ${(ok / CASES.length * 100).toFixed(0)}%`);
  Object.entries(byCat).forEach(([k, v]) => console.log(`  ${k}: ${v.ok}/${v.n}`));
  if (citeNeed) console.log(`引用命中 ${citeOk}/${citeNeed}`);
  console.log(`平均耗时 ${(ms / CASES.length).toFixed(0)}ms`);
})();
