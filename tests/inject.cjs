'use strict';
/* 等价变异已删除 1 处（halves 的 round→floor：校验已保证是半斤整档，×2 恒为精确整数）。
 * 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
const M=[
["v += q * (d * Math.min(t, s.N) - P.h * t * s.N);","v += q * (d * Math.min(t + 1, s.N) - P.h * t * s.N);"],
["v += q * (d * Math.min(t, s.N) - P.h * t * s.N);","v += q * (d * t - P.h * t * s.N);"],
["v += q * (d * Math.min(t, s.N) - P.h * t * s.N);","v += q * (d * Math.min(t, s.N) - P.h * (t + 1) * s.N);"],
["v += q * (d * Math.min(t, s.N) - P.h * t * s.N);","v += q * (d * Math.min(t, s.N));"],
["var q = Math.min(P.c, r); v +=","var q = P.c; v +="],
["var Qmax = Math.min(P.cap, P.c * P.M);","var Qmax = P.cap;"],
["var Qmax = Math.min(P.cap, P.c * P.M);","var Qmax = Math.min(P.cap, P.c * (P.M - 1));"],
["o.capBy = P.cap <= P.c * P.M ? 'cap' : 'weeks';","o.capBy = P.cap < P.c * P.M ? 'cap' : 'weeks';"],
["var rE = argBest(rows, function (r, b) { return r.e > b.e; });","var rE = argBest(rows, function (r, b) { return r.e >= b.e; });"],
["var rR = argBest(rows, function (r, b) { return r.reg < b.reg; });","var rR = argBest(rows, function (r, b) { return r.reg <= b.reg; });"],
["var rR = argBest(rows, function (r, b) { return r.reg < b.reg; });","var rR = argBest(rows, function (r, b) { return r.mn > b.mn; });"],
["return r.mn >= lim; })","return r.mn > lim; })"],
["var d = best[i] - x; if (d > g) g = d;","var d = x - best[i]; if (d > g) g = d;"],
["e += x * BigInt(P.sc[i].w);","e += x;"],
["function eOf(r) { return Number(r.e) / W / DEN; }","function eOf(r) { return Number(r.e) / DEN; }"],
["return Math.ceil(P.p0 + P.h * s.N * b / a - 1e-9);","return Math.round(P.p0 + P.h * s.N * b / a);"],
["if (a === 0) return null;","if (a === 0) return 0;"],
["weeksToEat: Math.ceil(r.Q / P.c)","weeksToEat: Math.floor(r.Q / P.c)"],
["var planQ = Math.min(P.plan, Qmax);","var planQ = P.plan;"],
["o.planClamped = P.plan > Qmax;","o.planClamped = P.plan >= Qmax;"],
["if (!r || seen[r.Q] || r.Q === planQ && !o.planClamped)","if (!r || seen[r.Q])"],
["if (!(isFinite(p0) && p0 > 0 && p0 <= MAX_PRICE))","if (!(isFinite(p0) && p0 >= 0 && p0 <= MAX_PRICE))"],
["else if (!isHalf(st.weekly))","else if (false)"],
["if (!(isFinite(M) && Math.floor(M) === M && M >= 1 && M <= MAX_WEEKS))","if (!(isFinite(M) && M >= 1 && M <= MAX_WEEKS))"],
["if (!(isFinite(h) && h >= 0 && h <= MAX_HOLD))","if (!(isFinite(h) && h > 0 && h <= MAX_HOLD))"],
["else if (nm.length > 16)","else if (nm.length > 17)"],
["if (!nm && blank(r.to) && blank(r.by) && blank(r.w)) return;","if (!nm) return;"],
["sc.reduce(function (a, s) { return a + s.w; }, 0) === 0) err","sc.reduce(function (a, s) { return a + s.w; }, 0) < 0) err"],
["if (!(isFinite(w) && Math.floor(w) === w && w >= 0 && w <= 10))","if (!(isFinite(w) && w >= 0 && w <= 10))"],
["function rnd(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }","function rnd(x) { return Math.round(x); }"],
["s = parts.join('.'); return (neg && v !== 0 ? '−' : '') + s;","s = parts.join('.'); return (neg ? '−' : '') + s;"],
["parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');",""],
["return /[\",\\n]/.test(s) ? '\"' + s.replace(/\"/g, '\"\"') + '\"' : s;","return s;"],
["if (q === rE.Q) r.tags.push('最划算');",""],
];
let caught=0,missed=[],nomatch=[];
try{
M.forEach(([a,b],i)=>{
  if(src.indexOf(a)<0){nomatch.push(i);return;}
  fs.writeFileSync(F,src.replace(a,b));
  let fail=false;try{execFileSync(process.execPath,['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:120000});}catch(e){fail=true;}
  if(fail)caught++;else missed.push(i+': '+b.slice(0,90));
});
}finally{fs.writeFileSync(F,src);}
console.log('注入 '+M.length+' 处，抓到 '+caught+'，漏 '+missed.length+(nomatch.length?'，未匹配 '+nomatch.join(','):''));
missed.forEach(m=>console.log('  漏：'+m));
