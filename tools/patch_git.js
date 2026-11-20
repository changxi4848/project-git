const fs = require('fs');
const p = 'desktop/main.js';
let m = fs.readFileSync(p, 'utf8');
const old = "  const target = repo || path.join(dataDir, 'demo-repo');";
const neu = [
  "  const candidates = [",
  "    repo,",
  "    'D:\\\\03_code_list\\\\esp32s3-relay-dock',",
  "    path.join(dataDir, 'demo-repo'),",
  "  ].filter(Boolean);",
  "  const target = candidates.find((d) => fs.existsSync(path.join(d, '.git'))) || candidates[0];",
].join('\n');
if (!m.includes(old)) { console.log('anchor missing'); process.exit(1); }
m = m.replace(old, neu);
fs.writeFileSync(p, m);
console.log('git default patched');
