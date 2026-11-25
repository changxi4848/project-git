'use strict';
/* 发布前清理：.gitignore 规范化、私有数据出库、真实项目名清干净 */
const fs = require('fs');

/* 1) .gitignore 重写（保证每行独立） */
const gi = [
  'node_modules/',
  'dist/',
  '*.log',
  '__pycache__/',
  '*.pyc',
  '',
  '# 运行时数据（每台机器自己的）',
  'data/',
  'private-data/',
  'temp/',
  '',
  '# 本地密钥',
  'data/qa_config.json',
].join('\n') + '\n';
fs.writeFileSync('.gitignore', gi);
console.log('.gitignore rewritten');

/* 2) main.js：默认 git 仓库路径去掉真名 */
let m = fs.readFileSync('desktop/main.js', 'utf8');
m = m.replace(/'D:\\\\03_code_list\\\\esp32s3-relay-dock',?\s*/g, '');
m = m.replace(/const DEFAULT_REPO = '[^']*';?/, "const DEFAULT_REPO = '';   // 留空：设置里自己填");
fs.writeFileSync('desktop/main.js', m);

/* 3) README 项目表换成合成数据 */
let r = fs.readFileSync('README.md', 'utf8');
r = r.replace(/\| \*\*大创 · 舆情 RAG\*\*[\s\S]*?\| \*\*千问大赛 · 项目Git\*\* \| 10 \|[^\n]*\n/,
`| **北极星 · 客服工单分流** | 12 | 规则分流 → 分类模型 → 知识库草稿；含一条**放弃的微调路线**、tag v0.9 |
| **山海 · 边缘告警** | 11 | 现场样本、回传方案对比、本地缓存、交付清单；含一条**放弃的 WiFi 回传**、tag v1.0 |
| **潮汐 · 内容审核台** | 9 | 误判分析、复核流程、灰度报告；tag v0.5 |
`);
r = r.replace('- git 只读单仓库（默认 `D:\\03_code_list\\esp32s3-relay-dock`）', '- git 只读：仓库路径在设置里自己填，默认不连任何仓库');
r = r.replace(/cd "D:\\\\03_code_list\\\\Claude code\\\\任务64-千问大赛"\n/g, '');
fs.writeFileSync('README.md', r);

/* 4) docs/README 同源清理 */
let d = fs.readFileSync('docs/README.md', 'utf8');
d = d.replace(/大创[^\n]*\n/g, '').replace(/TourBox[^\n]*\n/g, '').replace(/千问[^\n]*\n/g, '');
fs.writeFileSync('docs/README.md', d);

console.log('scrubbed');
