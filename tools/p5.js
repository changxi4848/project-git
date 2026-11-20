const fs=require("fs");
const p="desktop/main.js";
let s=fs.readFileSync(p,"utf8");
const a="select((ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id);";
const b="curProject='p_relay';rebuild();setTimeout(function(){select((ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id);},800);";
if(s.includes(a)){ s=s.replace(a,b); fs.writeFileSync(p,s); console.log("ok"); } else console.log("missing");
