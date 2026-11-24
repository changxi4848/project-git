#!/usr/bin/env node
'use strict';
/* 用法：
   node tools/ingest.js batch.json            # 导入
   node tools/ingest.js batch.json --dry-run  # 只看结果不写盘
   cat batch.json | node tools/ingest.js -    # 从 stdin 读
*/
const fs = require('fs');
const path = require('path');
const store = require('../desktop/store');
const ingest = require('../desktop/ingest');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!file) { console.error('用法: node tools/ingest.js <batch.json|-> [--dry-run]'); process.exit(1); }

const raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
let batch;
try { batch = JSON.parse(raw); } catch (e) { console.error('JSON 解析失败: ' + e.message); process.exit(2); }

store.init(path.join(__dirname, '..', 'data'));
store.load();
const r = ingest.apply(batch, store, { dryRun });
console.log(JSON.stringify(r, null, 2));
if (r.warnings.length) console.error('⚠ ' + r.warnings.length + ' 条警告');
process.exit(0);
