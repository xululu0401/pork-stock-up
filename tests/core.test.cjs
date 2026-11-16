/* 囤肉斤两 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python Fraction 逐半斤模拟 300 组）、手算小例、默认场景逐项、常识性质（不信引擎自报）。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const S = (o) => Object.assign(A.defaultState(), o);
const sc = (name, to, by, w) => ({ name, to: String(to), by: String(by), w: String(w) });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + '：' + a + ' vs ' + b);
function fromCase(c) {
  return { price: (c.p0 / 100).toFixed(2), weekly: String(c.c / 2), cap: String(c.cap / 2), weeks: String(c.M), hold: (c.h / 100).toFixed(2),
    loss: c.L == null ? '' : (c.L / 100).toFixed(2), plan: String(c.plan / 2), scen: c.sc.map((s) => sc(s.name, (s.X / 100).toFixed(2), s.N, s.w)) };
}

test('默认场景：上限、三个答案与各情景读数（手算核对）', () => {
  const o = A.compute(A.defaultState());
  assert.ok(o.ok);
  assert.equal(o.Qmax, 60); assert.equal(o.capBy, 'cap'); /* 冻柜 30 斤 < 2.5×16=40 斤：卡在冻柜 */
  assert.equal(o.answers.exp.Q, 60); assert.equal(o.answers.regret.Q, 42); assert.equal(o.answers.loss.Q, 34);
  /* 手算 30 斤 · 涨回去：每周 2.5 斤吃 12 周；第 t 周价差 = 2×min(t,10)/10 元，冻成本 0.03t 元 */
  let v = 0; for (let t = 0; t < 12; t++) v += 2.5 * (2 * Math.min(t, 10) / 10 - 0.03 * t);
  near(o.planRow.perScen[0] / 100, v, '涨回去 30 斤');
  assert.equal(A.money(o.planRow.perScen[0]), '省 27.55 元');
  assert.equal(A.money(o.planRow.perScen[1]), '亏 4.95 元');
  assert.equal(A.money(o.planRow.perScen[2]), '亏 26.2 元');
  assert.equal(A.money(o.planRow.exp), '省 3.8 元');
  assert.equal(A.money(o.answers.regret.exp), '省 1.45 元');
  assert.equal(A.yuan(A.rnd(o.answers.regret.regret)), '14.59');
  assert.equal(A.money(o.answers.loss.worst), '亏 9.74 元');
  assert.equal(A.money(o.answers.loss.exp), '省 0.83 元');
  assert.deepEqual(o.best.map((b) => b.Q), [60, 0, 0]);
  assert.equal(o.planRow.weeksToEat, 12);
  assert.deepEqual(o.actions.map((a) => a.key), ['regret', 'loss']); /* 打算的 30 斤已是最划算，不重复建议 */
  assert.deepEqual(o.table.map((r) => r.Q), [0, 34, 42, 60]);
  assert.deepEqual(o.table.map((r) => r.tags.join('、')), ['不囤', '亏得起', '最不后悔', '最划算、你打算的、上限']);
});

test('对拍：300 组独立 Python 参考实现（三个答案 + 打算斤数的每情景读数）', () => {
  let n = 0;
  REF.forEach((c, k) => {
    const o = A.compute(fromCase(c));
    assert.ok(o.ok, '第 ' + k + ' 组应能算：' + JSON.stringify(o.errors));
    const w = c.want;
    assert.equal(o.Qmax, w.qmax, 'qmax #' + k);
    assert.equal(o.answers.exp.Q, w.exp, 'exp #' + k);
    assert.equal(o.answers.regret.Q, w.regret, 'regret #' + k);
    if (c.L == null) assert.equal(o.answers.loss, null); else assert.equal(o.answers.loss.Q, w.loss, 'loss #' + k);
    near(o.answers.exp.exp, w.expVal, 'expVal #' + k); near(o.answers.regret.regret, w.regretVal, 'regretVal #' + k);
    w.plan.forEach((x, i) => near(o.planRow.perScen[i], x, 'plan #' + k + ' s' + i));
    near(o.planRow.exp, w.planExp, 'planExp #' + k);
    n++;
  });
  assert.equal(n, 300);
});

test('最优性：三个答案对全部斤数逐档比较都不输（引擎自己的 curve 之外，重新调用 savNum 算）', () => {
  REF.slice(0, 60).forEach((c) => {
    const o = A.compute(fromCase(c));
    o.curve.forEach((r) => {
      assert.ok(o.answers.exp.exp >= r.exp - 1e-9);
      if (r.exp === o.answers.exp.exp) assert.ok(r.Q >= o.answers.exp.Q, '并列取少');
      assert.ok(o.answers.regret.regret <= r.regret + 1e-9);
      if (o.answers.loss && r.worst >= -o.L - 1e-9) assert.ok(o.answers.loss.exp >= r.exp - 1e-9);
    });
    if (o.answers.loss) assert.ok(o.answers.loss.worst >= -o.L - 1e-9, '亏得起不能超');
  });
});

test('常识：不囤省 0；价不变且有冻成本必亏；冻成本为 0 时价不变不赚不亏；只涨不跌时囤满最划算', () => {
  const o0 = A.compute(S({ plan: '0' }));
  o0.planRow.perScen.forEach((v) => assert.equal(v, 0));
  const flat = A.compute(S({ scen: [sc('不变', 11.5, 4, 5)], plan: '10' }));
  assert.ok(flat.planRow.perScen[0] < 0); assert.equal(flat.answers.exp.Q, 0); assert.equal(flat.answers.regret.Q, 0);
  const free = A.compute(S({ hold: '0', scen: [sc('不变', 11.5, 4, 5)], plan: '10' }));
  assert.equal(free.planRow.perScen[0], 0); assert.equal(free.answers.exp.Q, 0); /* 并列取少 */
  const up = A.compute(S({ hold: '0', scen: [sc('涨', 15, 1, 5)] }));
  assert.equal(up.answers.exp.Q, up.Qmax); assert.equal(up.answers.regret.Q, up.Qmax);
  /* 只有一种情景时：后悔最小 = 最划算 */
  const one = A.compute(S({ scen: [sc('涨', 13.5, 10, 3)] }));
  assert.equal(one.answers.regret.Q, one.answers.exp.Q); near(one.answers.regret.regret, 0, '单情景后悔 0');
});

test('冻成本让「囤太多」变亏：有一个内部最优（不是囤满）', () => {
  const o = A.compute(S({ hold: '0.3', cap: '100', weeks: '40', weekly: '2', scen: [sc('涨', 14, 4, 5)] }));
  /* 第 t 周每斤收益 = 2.5×min(t,4)/4 − 0.3t：t=8 时 0.1，t=9 时 −0.2 → 吃到第 8 周（9 周 × 2 斤 = 18 斤）最好 */
  assert.equal(o.answers.exp.Q, 36);
  assert.ok(o.answers.exp.Q < o.Qmax);
});

test('上限：冻柜 vs 吃得完，取小；打算超过上限按上限算并给改法', () => {
  const a = A.compute(S({ cap: '100', weeks: '4' }));
  assert.equal(a.Qmax, 20); assert.equal(a.capBy, 'weeks');
  const b = A.compute(S({ cap: '8' }));
  assert.equal(b.Qmax, 16); assert.equal(b.capBy, 'cap');
  assert.ok(b.planClamped); assert.equal(b.planRow.Q, 16);
  const cl = b.actions.filter((x) => x.key === 'clamp')[0]; assert.ok(cl); assert.equal(cl.set.plan, '8');
  const tie = A.compute(S({ cap: '40', weeks: '16' })); assert.equal(tie.Qmax, 80); assert.equal(tie.capBy, 'cap'); /* 正好相等时说是冻柜 */
  const z = A.compute(S({ cap: '0' }));
  assert.equal(z.Qmax, 0); assert.equal(z.answers.exp.Q, 0); assert.equal(z.curve.length, 1);
});

test('最后一周吃不满：只算剩下的那点（半斤边界）', () => {
  /* 每周 1 斤，囤 2.5 斤：第 0、1 周各 1 斤，第 2 周 0.5 斤 */
  const o = A.compute(S({ weekly: '1', hold: '0', plan: '2.5', scen: [sc('涨', 12.5, 2, 1)] }));
  near(o.planRow.perScen[0], 100 * (1 * 0 + 1 * 0.5 + 0.5 * 1), '2.5 斤');
  assert.equal(o.planRow.weeksToEat, 3);
});

test('不亏价（breakeven）：代入后省钱 ≥ 0，少 1 分就 < 0', () => {
  const o = A.compute(A.defaultState());
  o.planRow.breakeven.forEach((be, i) => {
    const st = A.defaultState();
    st.scen[i].to = (be / 100).toFixed(2); assert.ok(A.compute(st).planRow.perScen[i] >= -1e-9, 'be ' + i);
    st.scen[i].to = ((be - 1) / 100).toFixed(2); assert.ok(A.compute(st).planRow.perScen[i] < 0, 'be-1 ' + i);
  });
  assert.equal(A.compute(S({ plan: '0' })).planRow.breakeven[0], null);
  /* 只吃一周（全在第 0 周）时价差还没起来，没有不亏价 */
  assert.equal(A.compute(S({ plan: '2.5' })).planRow.breakeven[0], null);
});

test('把握：权重为 0 的情景不进平均，但仍进后悔；改把握会挪动最划算', () => {
  const st = A.defaultState(); st.scen[2].w = '0';
  const o = A.compute(st);
  near(o.planRow.exp, (4 * o.planRow.perScen[0] + 4 * o.planRow.perScen[1]) / 8, '加权');
  assert.equal(o.answers.regret.Q, A.compute(A.defaultState()).answers.regret.Q); /* 后悔不看把握 */
  const bear = A.defaultState(); bear.scen[0].w = '2'; bear.scen[1].w = '2'; bear.scen[2].w = '6';
  assert.equal(A.compute(bear).answers.exp.Q, 0);
});

test('非法输入：逐字段报错并带字段名', () => {
  const bad = (o, field) => { const r = A.compute(S(o)); assert.equal(r.ok, false); assert.ok(r.errors.some((e) => e.field === field), field + ' ' + JSON.stringify(r.errors)); };
  bad({ price: '0' }, 'price'); bad({ price: 'abc' }, 'price'); bad({ price: '11.555' }, 'price'); bad({ price: '1001' }, 'price');
  bad({ weekly: '0' }, 'weekly'); bad({ weekly: '2.3' }, 'weekly'); bad({ weekly: '51' }, 'weekly');
  bad({ cap: '-1' }, 'cap'); bad({ cap: '1.2' }, 'cap'); bad({ cap: '501' }, 'cap');
  bad({ weeks: '0' }, 'weeks'); bad({ weeks: '1.5' }, 'weeks'); bad({ weeks: '53' }, 'weeks');
  bad({ hold: '-0.01' }, 'hold'); bad({ hold: '0.005' }, 'hold'); bad({ hold: '11' }, 'hold');
  bad({ loss: '-1' }, 'loss'); bad({ loss: '100001' }, 'loss');
  bad({ plan: '0.3' }, 'plan'); bad({ plan: '-2' }, 'plan');
  bad({ scen: [] }, 'scen');
  bad({ scen: [sc('a', 12, 2, 0), sc('b', 10, 2, 0)] }, 'scen');
  bad({ scen: [sc('', 12, 2, 1)] }, 'sc0.name');
  bad({ scen: [sc('一二三四五六七八九十一二三四五六七', 12, 2, 1)] }, 'sc0.name');
  bad({ scen: [sc('a', 0, 2, 1)] }, 'sc0.to'); bad({ scen: [sc('a', 12, 0, 1)] }, 'sc0.by'); bad({ scen: [sc('a', 12, 53, 1)] }, 'sc0.by');
  bad({ scen: [sc('a', 12, 2, 11)] }, 'sc0.w'); bad({ scen: [sc('a', 12, 2, 1.5)] }, 'sc0.w');
  bad({ scen: [1, 2, 3, 4, 5, 6].map((i) => sc('s' + i, 12, 2, 1)) }, 'scen');
  /* 边界两侧：合法 */
  ['0.01', '1000'].forEach((p) => assert.ok(A.compute(S({ price: p })).ok));
  ['1', '52'].forEach((w) => assert.ok(A.compute(S({ weeks: w })).ok));
  ['0', '10'].forEach((h) => assert.ok(A.compute(S({ hold: h })).ok));
  ['0', '500'].forEach((c) => assert.ok(A.compute(S({ cap: c })).ok));
  assert.ok(A.compute(S({ price: '1,000', loss: '1,000' })).ok);
  assert.ok(A.compute(S({ price: ' 11.5 ' })).ok);
  assert.equal(A.compute(S({ loss: '' })).answers.loss, null);
  /* 整行空的情景当没写 */
  const st = A.defaultState(); st.scen.push({ name: '', to: '', by: '', w: '' }); assert.equal(A.compute(st).sc.length, 3);
});

test('并列：镜像情景平均恰为 0 时取 0 斤；分母不同的三情景数值有限（不同分母的并列由 300 组对拍覆盖）', () => {
  /* N=3 与 N=7 两情景对称设计，使某些斤数的平均正好相等 */
  const o = A.compute(S({ hold: '0', weekly: '1', cap: '10', weeks: '10', scen: [sc('涨', 13.5, 3, 1), sc('跌', 9.5, 3, 1)] }));
  /* 两情景镜像对称：任意斤数平均都正好 0 → 并列取 0 斤 */
  o.curve.forEach((r) => assert.equal(r.exp, 0));
  assert.equal(o.answers.exp.Q, 0);
  const o2 = A.compute(S({ hold: '0.01', weekly: '1', cap: '20', weeks: '20', scen: [sc('a', 12.1, 3, 1), sc('b', 12.1, 7, 1), sc('c', 10.9, 5, 1)] }));
  assert.ok(o2.ok); o2.curve.forEach((r) => assert.ok(Number.isFinite(r.exp)));
});

test('格式：金额千分位、负号、取整；斤数半斤', () => {
  assert.equal(A.yuan(123456789), '1,234,567.89'); assert.equal(A.yuan(-150), '−1.5'); assert.equal(A.yuan(0), '0'); assert.equal(A.yuan(-0.4), '0');
  assert.equal(A.money(0.4), '不赚不亏'); assert.equal(A.money(-0.5), '亏 0.01 元'); assert.equal(A.money(0.5), '省 0.01 元'); assert.equal(A.money(-973.5), '亏 9.74 元');
  assert.equal(A.jin(61), '30.5'); assert.equal(A.jin(60), '30'); assert.equal(A.jin(0), '0');
});

test('导出：CSV 逐档行数、转义；MD 含三个答案', () => {
  const st = A.defaultState(); st.scen[0].name = '涨,"回去"';
  const o = A.compute(st);
  const csv = A.toCSV(o, '2026-11-16 19:00');
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 3 + 3 + 1 + 1 + 61);
  assert.ok(csv.indexOf('"涨,""回去"""') >= 0);
  assert.ok(lines[lines.length - 1].startsWith('30,27.55,−4.95,−26.2,3.8,'), lines[lines.length - 1]);
  const md = A.toMD(o, 'x');
  ['按把握算最划算：囤 30 斤', '最不怕后悔：囤 21 斤', '亏不超过 10 元：囤 17 斤', '虚构示例'].forEach((k) => assert.ok(md.indexOf(k) >= 0, k));
  assert.equal(A.toCSV({ ok: false }, ''), ''); assert.equal(A.toMD({ ok: false }, ''), '');
});
