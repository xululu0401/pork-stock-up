/* 封面 cover.svg（1200×1200），读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok || o.answers.exp.Q !== 60 || o.answers.regret.Q !== 42 || o.answers.loss.Q !== 34) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const C = ['#2b7a4b', '#6b6259', '#b3261e'];
const cL = 200, cR = 1040, cT = 470, cB = 900;
let lo = 0, hi = 0; o.curve.forEach((r) => r.perScen.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
const X = (q) => cL + (cR - cL) * q / o.Qmax, Y = (v) => cT + (cB - cT) * (hi - v) / (hi - lo);
let lines = o.sc.map((s, i) => `<polyline fill="none" stroke="${C[i]}" stroke-width="7" stroke-linejoin="round" points="${o.curve.map((r) => X(r.Q).toFixed(1) + ',' + Y(r.perScen[i]).toFixed(1)).join(' ')}"/>`).join('');
lines += `<polyline fill="none" stroke="#a8432f" stroke-width="5" stroke-dasharray="14 10" points="${o.curve.map((r) => X(r.Q).toFixed(1) + ',' + Y(r.exp).toFixed(1)).join(' ')}"/>`;
const mark = (q, label, dy) => `<line x1="${X(q)}" x2="${X(q)}" y1="${cT - 10}" y2="${cB + 10}" stroke="#a8432f" stroke-width="2.5" stroke-dasharray="4 6"/><text x="${X(q)}" y="${cB + 52 + dy}" font-family="${F}" font-size="28" font-weight="700" fill="#a8432f" text-anchor="middle">${label}</text>`;
const end = o.planRow.perScen;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f5f2ee"/>
  <rect x="70" y="60" width="1060" height="1080" rx="18" fill="#fff" stroke="#dfd6cd" stroke-width="3"/>
  <text x="140" y="200" font-family="${F}" font-size="108" font-weight="800" fill="#231f1c">囤肉斤两</text>
  <text x="140" y="268" font-family="${F}" font-size="38" fill="#58514b">肉价低的时候，冻多少斤才不后悔</text>
  <rect x="140" y="298" width="920" height="5" fill="#231f1c"/>
  <text x="140" y="372" font-family="${F}" font-size="40" font-weight="800" fill="#231f1c">最划算 <tspan fill="#a8432f">${A.jin(o.answers.exp.Q)} 斤</tspan> · 最不后悔 <tspan fill="#a8432f">${A.jin(o.answers.regret.Q)} 斤</tspan> · 亏得起 <tspan fill="#a8432f">${A.jin(o.answers.loss.Q)} 斤</tspan></text>
  <text x="140" y="420" font-family="${F}" font-size="28" fill="#58514b">囤满 ${A.jin(o.Qmax)} 斤：涨回去${A.money(end[0])}，不变${A.money(end[1])}，再跌${A.money(end[2])}</text>
  <line x1="${cL}" x2="${cR}" y1="${Y(0)}" y2="${Y(0)}" stroke="#58514b" stroke-width="2"/>
  <text x="${cL - 14}" y="${Y(0) + 10}" font-family="${F}" font-size="26" fill="#8c847c" text-anchor="end">0 元</text>
  ${mark(o.answers.loss.Q, A.jin(o.answers.loss.Q), 0)}${mark(o.answers.regret.Q, A.jin(o.answers.regret.Q), 0)}
  ${lines}
  <text x="${cR}" y="${cB + 52}" font-family="${F}" font-size="28" font-weight="700" fill="#a8432f" text-anchor="end">${A.jin(o.Qmax)} 斤</text>
  <text x="140" y="1050" font-family="${F}" font-size="28" font-weight="700" fill="#231f1c"><tspan fill="${C[0]}">■</tspan> 涨回去　<tspan fill="${C[1]}">■</tspan> 一直这个价　<tspan fill="${C[2]}">■</tspan> 再跌一截　<tspan fill="#a8432f">┅</tspan> 按把握平均</text>
  <text x="140" y="1100" font-family="${F}" font-size="22" fill="#8c847c">横轴 = 囤多少斤 · 纵轴 = 省 / 亏多少元 · 价格、走势与把握均为虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
console.log('cover.svg', svg.length);
