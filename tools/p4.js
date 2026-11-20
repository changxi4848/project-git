const fs=require("fs");
const p="desktop/main.js";
let s=fs.readFileSync(p,"utf8");
s=s.replace("select(ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id;",
            "select((ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id);");
fs.writeFileSync(p,s);
console.log("fixed");
