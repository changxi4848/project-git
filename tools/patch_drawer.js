const fs = require('fs');
const p = 'desktop/main.js';
let m = fs.readFileSync(p, 'utf8');
const old = 'try { await win.webContents.executeJavaScript(\'select("n08")\'); } catch(e) {}';
const neu = "try { await win.webContents.executeJavaScript('(function(){var d=ns.find(function(x){return x.n.source\\u0026\\u0026x.n.source.file})||ns[0];if(d)select(d.id);return d?d.id:\"\";})()'); } catch(e) {}";
if (m.includes(old)) {
  m = m.replace(old, neu);
  fs.writeFileSync(p, m);
  console.log('patched');
} else {
  console.log('anchor missing');
}
