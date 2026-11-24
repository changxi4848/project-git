'use strict';
/* 问答评估：20 题，跑本地规划器（无 key 时）或模型，统计命中率 / 引用命中 / 耗时 */
const path = require('path');
const store = require('../desktop/store');
const engine = require('../desktop/engine');
const qa = require('../desktop/qa');

store.init(path.join(__dirname, '..', 'data'));
store.load();
qa.init(store, engine);

// expect: 答案里必须出现的词（全部命中才算对）
// cite:   期望引用到的文件名（可选）
const CASES = [
  { q: '为什么放弃 HID？', expect: ['HID', 'GATT'], cite: '中继底座-试错记录.md' },
  { q: '放弃 HID 之后改成了什么？', expect: ['GATT'] },
  { q: '先走 HID 流后来怎么样了？', expect: ['HID'] },
  { q: '锁定基线是哪个 commit？', expect: ['b6677ef'] },
  { q: '中继底座为什么改板加外部天线？', expect: ['改板'] },
  { q: '冒用 productKey 是做什么的？', expect: ['productKey'] },
  { q: '硬脱壳为什么走错了？', expect: ['脱壳'] },
  { q: '停掉脱壳路线是什么时候？', expect: ['脱壳'] },
  { q: 'TourBox 抓包用什么方法？', expect: ['CDC-ACM'] },
  { q: '协议逆向最终逆向的是哪个文件？', expect: ['LibH'] },
  { q: '为什么不使用逻辑分析仪？', expect: ['CDC-ACM'] },
  { q: '大创项目为什么不做微调？', expect: ['RAG'] },
  { q: '舆情 RAG 用的什么向量模型？', expect: ['bge'] },
  { q: '标注一致性是多少？', expect: ['0.61'] },
  { q: '论文初稿属于哪个项目？', expect: ['论文初稿'] },
  { q: '千问大赛为什么选命题 05？', expect: ['命题 05'] },
  { q: '哪个项目里有走错了的决策？', expect: ['走错'] },
  { q: '试错记录里稳定基线是怎么描述的？', expect: ['稳定基线'], cite: '中继底座-试错记录.md' },
  { q: '交接文档出自哪个文件？', expect: ['交接文档'] },
  { q: '安卓端为什么暂停归档？', expect: ['安卓'] },
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
    const dt = Date.now() - t0;
    ms += dt;
    const ans = r.answer || '';
    const hit = c.expect.every((k) => ans.includes(k));
    const cites = (r.citations || []).map((x) => x.file);
    let cHit = null;
    if (c.cite) { citeNeed++; cHit = cites.includes(c.cite); if (cHit) citeOk++; }
    if (hit) ok++;
    console.log(
      `${String(i + 1).padStart(2)}. ${hit ? '✅' : '❌'} ${c.q}` +
      (c.cite ? `   [引用 ${cHit ? '✅' : '❌'} ${c.cite}]` : '') + `   ${dt}ms`
    );
    if (!hit) console.log('     答案: ' + ans.replace(/\n/g, ' ').slice(0, 90));
  }
  console.log('─'.repeat(78));
  console.log(`命中 ${ok}/${CASES.length} = ${(ok / CASES.length * 100).toFixed(0)}%`);
  if (citeNeed) console.log(`引用命中 ${citeOk}/${citeNeed}`);
  console.log(`平均耗时 ${(ms / CASES.length).toFixed(0)}ms`);
})();
