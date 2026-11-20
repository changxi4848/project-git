const fs=require("fs");
const p="desktop/main.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace("curProject=\u0027p_relay\u0027;rebuild();", "curProject=\"p_relay\";rebuild();");
fs.writeFileSync(p,s);
console.log("ok");
