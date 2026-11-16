/* 囤肉斤两 · 计算核心（core.js）
 * 问题：肉价跌得低，想趁便宜冻一些。囤多少斤合适？涨回去囤少了心疼，再跌一截囤多了也心疼。
 * 模型（设计选择，页面「怎么算的」里写明）：
 *   - 现在单价 p0（元/斤），平时每周吃 c 斤。今天一次买 Q 斤冻起来，从本周起每周吃 c 斤（最后一周吃剩下的），
 *     吃完再照常每周买。囤的部分替代了「本来第 t 周要按那时的价买」的那一份。
 *   - 价格走势用几种「情景」描述：第 N 周价格线性走到 X，之后停在 X。情景 s 第 t 周的价 p_s(t) = p0 + (X−p0)·min(t,N)/N。
 *   - 冻着有成本：每斤每周 h 元（电费 + 冻久了口感打折，由用户自己估，是设计选择不是测量值）。
 *   - 情景 s 下囤 Q 斤省下的钱 V_s(Q) = Σ_t q_t·(p_s(t) − p0 − h·t)，q_t = 第 t 周吃掉的囤货斤数，t 从 0 起。负数 = 亏。
 *   - 能囤的上限 Qmax = min(冻柜能放的斤数, c × 最多冻几周)。斤数按 0.5 斤一档枚举 0…Qmax，全部算一遍（精确，不是贪心）。
 * 三个答案（都在 0…Qmax 里逐档比较，并列取更少的斤数）：
 *   ① 期望最划算：按「几成把握」加权的平均省钱 E(Q) 最大；
 *   ② 最不后悔：max_s [ 情景 s 下最好的囤法能省的 − V_s(Q) ] 最小（minimax regret）；
 *   ③ 亏得起：所有情景都不亏超过 L 元（min_s V_s(Q) ≥ −L）的前提下 E(Q) 最大（L 留空就不给这一条）。
 * 精确性：金额按分、斤按半斤取整数；各情景分母 2·N 不同，用 BigInt 通分到同一分母再比较，并列判断不受浮点误差影响。 */
(function (root) {
  'use strict';
  var MAX_SC = 5, MAX_PRICE = 1000, MAX_WEEKLY = 50, MAX_CAP = 500, MAX_WEEKS = 52, MAX_HOLD = 10, MAX_LOSS = 100000;

  function defaultState() {
    return {
      price: '11.5', weekly: '2.5', cap: '30', weeks: '16', hold: '0.03', loss: '10', plan: '30',
      scen: [
        { name: '过两个多月涨回去', to: '13.5', by: '10', w: '4' },
        { name: '就一直这个价', to: '11.5', by: '4', w: '4' },
        { name: '再跌一截', to: '10.5', by: '6', w: '2' }
      ]
    };
  }

  /* ── 解析与校验 ── */
  function blank(s) { return String(s == null ? '' : s).trim() === ''; }
  function num(s) { s = String(s == null ? '' : s).trim().replace(/，/g, ',').replace(/,/g, ''); if (s === '') return NaN; if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN; return Number(s); }
  function dec(s) { var m = /\.(\d+)$/.exec(String(s).trim()); return m ? m[1].length : 0; }
  function cents(s) { return Math.round(num(s) * 100); }
  function halves(s) { return Math.round(num(s) * 2); }
  function isHalf(s) { var v = num(s); return isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9; }

  function parse(st) {
    var E = [];
    function err(field, message) { E.push({ field: field, message: message }); }
    var p0 = num(st.price);
    if (!(isFinite(p0) && p0 > 0 && p0 <= MAX_PRICE)) err('price', '现在的单价要填 0.01 到 1,000 元/斤之间的数。');
    else if (dec(st.price) > 2) err('price', '现在的单价最多填到分（两位小数）。');
    var c = num(st.weekly);
    if (!(isFinite(c) && c > 0 && c <= MAX_WEEKLY)) err('weekly', '每周吃多少要填 0.5 到 50 斤。');
    else if (!isHalf(st.weekly)) err('weekly', '每周吃多少按半斤一档填（比如 2.5）。');
    var cap = num(st.cap);
    if (!(isFinite(cap) && cap >= 0 && cap <= MAX_CAP)) err('cap', '冻柜能放多少要填 0 到 500 斤。');
    else if (!isHalf(st.cap)) err('cap', '冻柜能放多少按半斤一档填。');
    var M = num(st.weeks);
    if (!(isFinite(M) && Math.floor(M) === M && M >= 1 && M <= MAX_WEEKS)) err('weeks', '最多冻几周要填 1 到 52 的整数。');
    var h = num(st.hold);
    if (!(isFinite(h) && h >= 0 && h <= MAX_HOLD)) err('hold', '冻着的成本要填 0 到 10 元/斤/周。');
    else if (dec(st.hold) > 2) err('hold', '冻着的成本最多填到分（两位小数）。');
    var L = null;
    if (!blank(st.loss)) {
      L = num(st.loss);
      if (!(isFinite(L) && L >= 0 && L <= MAX_LOSS)) err('loss', '最多亏得起要填 0 到 100,000 元，或者留空。');
      else if (dec(st.loss) > 2) err('loss', '最多亏得起最多填到分。');
    }
    var plan = num(st.plan);
    if (!(isFinite(plan) && plan >= 0 && plan <= MAX_CAP)) err('plan', '打算囤多少要填 0 到 500 斤。');
    else if (!isHalf(st.plan)) err('plan', '打算囤多少按半斤一档填。');

    var sc = [], list = Array.isArray(st.scen) ? st.scen : [];
    if (list.length > MAX_SC) err('scen', '情景最多 5 种。');
    list.slice(0, MAX_SC).forEach(function (r, i) {
      r = r || {};
      var nm = String(r.name == null ? '' : r.name).trim();
      if (!nm && blank(r.to) && blank(r.by) && blank(r.w)) return; /* 整行空着当没写 */
      var bad = false;
      if (!nm) { err('sc' + i + '.name', '第 ' + (i + 1) + ' 种情景要起个名字。'); bad = true; }
      else if (nm.length > 16) { err('sc' + i + '.name', '第 ' + (i + 1) + ' 种情景的名字最多 16 个字。'); bad = true; }
      var X = num(r.to);
      if (!(isFinite(X) && X > 0 && X <= MAX_PRICE)) { err('sc' + i + '.to', '「' + (nm || '第 ' + (i + 1) + ' 种') + '」的价格要填 0.01 到 1,000 元/斤。'); bad = true; }
      else if (dec(r.to) > 2) { err('sc' + i + '.to', '「' + nm + '」的价格最多填到分。'); bad = true; }
      var N = num(r.by);
      if (!(isFinite(N) && Math.floor(N) === N && N >= 1 && N <= MAX_WEEKS)) { err('sc' + i + '.by', '「' + (nm || '第 ' + (i + 1) + ' 种') + '」第几周到这个价要填 1 到 52 的整数。'); bad = true; }
      var w = num(r.w);
      if (!(isFinite(w) && Math.floor(w) === w && w >= 0 && w <= 10)) { err('sc' + i + '.w', '「' + (nm || '第 ' + (i + 1) + ' 种') + '」的把握填 0 到 10 成的整数。'); bad = true; }
      if (!bad) sc.push({ row: i, name: nm, X: cents(r.to), N: N, w: w });
    });
    if (!E.length && !sc.length) err('scen', '至少写一种价格走势的情景。');
    if (!E.length && sc.reduce(function (a, s) { return a + s.w; }, 0) === 0) err('scen', '几种情景的把握不能全是 0 成。');
    if (E.length) return { ok: false, errors: E };
    return { ok: true, p0: cents(st.price), c: halves(st.weekly), cap: halves(st.cap), M: M, h: cents(st.hold), L: L == null ? null : cents(st.loss), plan: halves(st.plan), sc: sc };
  }

  /* ── 计算 ── */
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  /* 情景 s 下囤 Q（半斤）的省钱，返回分子：单位 = 半斤·分·N，真实分 = num / (2N) */
  function savNum(P, s, Q) {
    var v = 0, r = Q, t = 0, d = s.X - P.p0;
    while (r > 0) { var q = Math.min(P.c, r); v += q * (d * Math.min(t, s.N) - P.h * t * s.N); r -= q; t++; }
    return v;
  }
  function breakeven(P, s, Q) {
    /* 这种情景要涨（或跌）到多少，囤 Q 才刚好不亏：Σq·[(X−p0)·min(t,N)/N − h·t] = 0 */
    var a = 0, b = 0, r = Q, t = 0;
    while (r > 0) { var q = Math.min(P.c, r); a += q * Math.min(t, s.N); b += q * t; r -= q; t++; }
    if (a === 0) return null;
    return Math.ceil(P.p0 + P.h * s.N * b / a - 1e-9); /* 分，向上取到分 */
  }

  function compute(st) {
    var P = parse(st);
    if (!P.ok) return P;
    var o = { ok: true, p0: P.p0, c: P.c, cap: P.cap, M: P.M, h: P.h, L: P.L, plan: P.plan, sc: P.sc };
    var Qmax = Math.min(P.cap, P.c * P.M);
    o.Qmax = Qmax; o.capBy = P.cap <= P.c * P.M ? 'cap' : 'weeks';
    var Lc = 1; P.sc.forEach(function (s) { Lc = Lc / gcd(Lc, s.N) * s.N; });
    var LB = BigInt(Lc), W = P.sc.reduce(function (a, s) { return a + s.w; }, 0), WB = BigInt(W);
    var DEN = 2 * Lc; /* 每个情景的通分值 = num·(Lc/N)，真实分 = 通分值 / DEN */
    function scaled(s, Q) { return BigInt(savNum(P, s, Q)) * BigInt(Lc / s.N); }
    var rows = [];
    for (var Q = 0; Q <= Qmax; Q++) {
      var v = P.sc.map(function (s) { return scaled(s, Q); });
      var e = 0n; v.forEach(function (x, i) { e += x * BigInt(P.sc[i].w); }); /* E·W·DEN */
      var mn = v.reduce(function (a, x) { return x < a ? x : a; }, v[0]);
      rows.push({ Q: Q, v: v, e: e, mn: mn });
    }
    var best = P.sc.map(function (_, i) { return rows.reduce(function (a, r) { return r.v[i] > a ? r.v[i] : a; }, rows[0].v[i]); });
    rows.forEach(function (r) { var g = 0n; r.v.forEach(function (x, i) { var d = best[i] - x; if (d > g) g = d; }); r.reg = g; });
    function argBest(list, better) { var b = null; list.forEach(function (r) { if (!b || better(r, b)) b = r; }); return b; }
    var rE = argBest(rows, function (r, b) { return r.e > b.e; });
    var rR = argBest(rows, function (r, b) { return r.reg < b.reg; });
    var rL = null;
    if (P.L != null) { var lim = -BigInt(P.L) * BigInt(DEN); rL = argBest(rows.filter(function (r) { return r.mn >= lim; }), function (r, b) { return r.e > b.e; }); }
    function yuanOf(x) { return Number(x) / DEN; }       /* 通分值 → 分（可带小数） */
    function eOf(r) { return Number(r.e) / W / DEN; }
    function pack(r) {
      return { Q: r.Q, perScen: r.v.map(yuanOf), exp: eOf(r), worst: yuanOf(r.mn), regret: yuanOf(r.reg),
        weeksToEat: Math.ceil(r.Q / P.c) };
    }
    o.best = best.map(function (b, i) { var r = argBest(rows, function (x, y) { return x.v[i] > y.v[i]; }); return { Q: r.Q, cents: yuanOf(b) }; });
    o.answers = { exp: pack(rE), regret: pack(rR), loss: rL ? pack(rL) : null };
    var planQ = Math.min(P.plan, Qmax);
    o.planClamped = P.plan > Qmax;
    o.planRow = pack(rows[planQ]);
    o.planRow.breakeven = P.sc.map(function (s) { return breakeven(P, s, planQ); });
    o.curve = rows.map(pack);
    o.W = W;
    /* 改法：每个答案点一下就填进「打算囤多少」 */
    var acts = [], seen = {};
    function add(id, key, r, label) { if (!r || seen[r.Q] || r.Q === planQ && !o.planClamped) { seen[r.Q] = true; return; } seen[r.Q] = true; acts.push({ id: id, key: key, Q: r.Q, text: label + '：囤 ' + jin(r.Q) + ' 斤', set: { plan: jinStr(r.Q) } }); }
    add('actExp', 'exp', rE, '按把握算最划算');
    add('actReg', 'regret', rR, '最不怕后悔');
    if (rL) add('actLoss', 'loss', rL, '亏不超过 ' + yuan(P.L) + ' 元里最划算');
    if (o.planClamped) acts.push({ id: 'actClamp', key: 'clamp', Q: Qmax, text: '改成能放下 / 吃得完的上限：囤 ' + jin(Qmax) + ' 斤', set: { plan: jinStr(Qmax) } });
    o.actions = acts;
    /* 对照表：0、三个答案、打算的、上限 */
    var pick = {}; [0, rE.Q, rR.Q, rL ? rL.Q : 0, planQ, Qmax].forEach(function (q) { pick[q] = true; });
    o.table = Object.keys(pick).map(Number).sort(function (a, b) { return a - b; }).map(function (q) {
      var r = pack(rows[q]); r.tags = [];
      if (q === 0) r.tags.push('不囤'); if (q === rE.Q) r.tags.push('最划算'); if (q === rR.Q) r.tags.push('最不后悔');
      if (rL && q === rL.Q) r.tags.push('亏得起'); if (q === planQ) r.tags.push('你打算的'); if (q === Qmax) r.tags.push('上限');
      return r;
    });
    o.same = rE.Q === rR.Q && (!rL || rL.Q === rE.Q);
    return o;
  }

  /* ── 格式 ── */
  function yuan(c) { /* 分 → 元，四舍五入到分；千分位 */
    var neg = c < 0, v = Math.round(Math.abs(c) + 1e-9); var s = (v / 100).toFixed(2).replace(/\.?0+$/, '');
    var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = parts.join('.'); return (neg && v !== 0 ? '−' : '') + s;
  }
  function rnd(x) { return x < 0 ? -Math.round(-x) : Math.round(x); } /* 半分远离 0 取整，正负对称 */
  function money(c) { var v = rnd(c); return v > 0 ? '省 ' + yuan(v) + ' 元' : v < 0 ? '亏 ' + yuan(-v) + ' 元' : '不赚不亏'; }
  function jin(h) { return (h / 2).toFixed(1).replace(/\.0$/, ''); }
  function jinStr(h) { return jin(h); }

  function csvCell(s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(o, stamp) {
    if (!o.ok) return '';
    var L = [];
    L.push(['囤肉斤两', '导出 ' + stamp].map(csvCell).join(','));
    L.push(['现在单价(元/斤)', yuan(o.p0), '每周吃(斤)', jin(o.c), '冻柜(斤)', jin(o.cap), '最多冻(周)', o.M, '冻着成本(元/斤/周)', yuan(o.h), '亏得起(元)', o.L == null ? '不限' : yuan(o.L)].map(csvCell).join(','));
    L.push(['情景', '到第几周', '变成(元/斤)', '把握(成)'].map(csvCell).join(','));
    o.sc.forEach(function (s) { L.push([s.name, s.N, yuan(s.X), s.w].map(csvCell).join(',')); });
    L.push('');
    L.push(['囤多少(斤)'].concat(o.sc.map(function (s) { return s.name + ' 省(元)'; }), ['按把握平均省(元)', '最坏(元)', '最大后悔(元)']).map(csvCell).join(','));
    o.curve.forEach(function (r) { L.push([jin(r.Q)].concat(r.perScen.map(function (x) { return yuan(rnd(x)); }), [yuan(rnd(r.exp)), yuan(rnd(r.worst)), yuan(rnd(r.regret))]).map(csvCell).join(',')); });
    return L.join('\n') + '\n';
  }
  function toMD(o, stamp) {
    if (!o.ok) return '';
    var A = o.answers, L = ['# 囤肉斤两', '', '导出时间：' + stamp, ''];
    L.push('现在 ' + yuan(o.p0) + ' 元/斤，每周吃 ' + jin(o.c) + ' 斤，最多能囤 ' + jin(o.Qmax) + ' 斤（' + (o.capBy === 'cap' ? '冻柜放得下的' : o.M + ' 周内吃得完的') + '），冻着每斤每周算 ' + yuan(o.h) + ' 元。', '');
    L.push('- **按把握算最划算：囤 ' + jin(A.exp.Q) + ' 斤**，平均' + money(A.exp.exp));
    L.push('- **最不怕后悔：囤 ' + jin(A.regret.Q) + ' 斤**，最多后悔 ' + yuan(rnd(A.regret.regret)) + ' 元');
    if (A.loss) L.push('- **亏不超过 ' + yuan(o.L) + ' 元：囤 ' + jin(A.loss.Q) + ' 斤**，最坏' + money(A.loss.worst));
    L.push('', '| 囤多少 | ' + o.sc.map(function (s) { return s.name.replace(/\|/g, '/'); }).join(' | ') + ' | 按把握平均 | 最大后悔 |');
    L.push('|---|' + o.sc.map(function () { return '---|'; }).join('') + '---|---|');
    o.table.forEach(function (r) { L.push('| ' + jin(r.Q) + ' 斤（' + r.tags.join('、') + '） | ' + r.perScen.map(money).join(' | ') + ' | ' + money(r.exp) + ' | ' + yuan(rnd(r.regret)) + ' 元 |'); });
    L.push('', '情景（价格第 N 周线性走到目标价后不再变）：', '');
    o.sc.forEach(function (s) { L.push('- ' + s.name + '：第 ' + s.N + ' 周到 ' + yuan(s.X) + ' 元/斤，' + s.w + ' 成把握'); });
    L.push('', '_情景与把握是你自己的判断，不是价格预测；默认数字为虚构示例。_');
    return L.join('\n') + '\n';
  }

  var api = { MAX_SC: MAX_SC, defaultState: defaultState, parse: parse, compute: compute, savNum: savNum, rnd: rnd, yuan: yuan, money: money, jin: jin, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== 'undefined' ? window : this);
