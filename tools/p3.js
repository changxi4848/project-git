const fs=require("fs");
const p="desktop/main.js";
let s=fs.readFileSync(p,"utf8");
const marker = 'select("n08")';
if (s.includes(marker)) {
  s = s.replace('select("n08")', 'select(ns.find(function(x){return x.n.source&&x.n.source.file})||ns[0]).id');
  fs.writeFileSync(p, s);
  console.log("replaced");
} else console.log("not found");
