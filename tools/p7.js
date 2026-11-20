const fs=require("fs");
const p="desktop/main.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace("curProject=\"p_relay\";rebuild();setTimeout(function(){select((ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id);},800);",
            "select((ns.find(function(x){return x.n.source&&x.n.source.file})||ns[1]||ns[0]).id);");
fs.writeFileSync(p,s); console.log("ok");
