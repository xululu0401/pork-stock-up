/* 囤肉斤两 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做省钱计算。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'pork-stock-up:v1';
  var $ = function (id) { return document.getElementById(id); };
  var Y = A.yuan, J = A.jin, M = A.money, R = A.rnd;
  var COLORS = ['#2b7a4b', '#6b6259', '#b3261e', '#2f5fa8', '#b07a16'];
  var FIELDS = ['price', 'weekly', 'cap', 'weeks', 'hold', 'loss'];
  var PRESETS = [
    { key: 'base', name: '两口之家（默认）', note: '虚构示例：现在 11.5 元/斤，每周吃 2.5 斤，冻柜还能放 30 斤、最多冻 16 周，冻着每斤每周算 3 分钱；三种走势和把握都是编的，请换成你自己的判断。', s: {} },
    { key: 'small', name: '冻柜只剩一格', note: '虚构示例：冻柜只放得下 8 斤，其余同默认。', s: { cap: '8' } },
    { key: 'bear', name: '我觉得还会跌', note: '虚构示例：把「再跌一截」的把握提到 6 成、「涨回去」降到 2 成，其余同默认。', s: { scen: [{ name: '过两个多月涨回去', to: '13.5', by: '10', w: '2' }, { name: '就一直这个价', to: '11.5', by: '4', w: '2' }, { name: '再跌一截', to: '10.5', by: '6', w: '6' }] } },
    { key: 'carefree', name: '亏点无所谓', note: '虚构示例：不设「最多亏得起」，冻着的成本算 0，其余同默认。', s: { loss: '', hold: '0' } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; Object.keys(p.s).forEach(function (f) { s[f] = clone(p.s[f]); }); return s; }
  function presetKey(s) { var t = clone(s); t.plan = ''; var j = JSON.stringify(t); for (var i = 0; i < PRESETS.length; i++) { var u = presetState(PRESETS[i].key); u.plan = ''; if (JSON.stringify(u) === j) return PRESETS[i].key; } return null; }

  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    if (Array.isArray(s.scen)) { d.scen = s.scen.slice(0, A.MAX_SC).map(function (r) { r = r && typeof r === 'object' ? r : {}; return { name: str(r.name, 30), to: str(r.to, 10), by: str(r.by, 6), w: str(r.w, 4) }; }); any = true; }
    FIELDS.concat(['plan']).forEach(function (k) { if (k in s) { d[k] = str(s[k], 12); any = true; } });
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  var state = load() || A.defaultState();
  var out = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cls(c) { c = R(c); return c > 0 ? 'pos' : c < 0 ? 'neg' : ''; }

  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你改过的（按你填的算）。';
  }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fill(); update(); });

  /* 走势表（输入）：只在结构变化时重建 */
  function buildSc() {
    var h = '<tr><th>#</th><th>走势</th><th class="n">到第几周</th><th class="n">变成多少元/斤</th><th class="n">几成把握</th><th></th></tr>';
    state.scen.forEach(function (r, i) {
      h += '<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + COLORS[i] + '"></span></td>' +
        '<td><input class="nm" type="text" id="sc' + i + '_name" data-i="' + i + '" data-f="name" maxlength="30" value="' + esc(r.name) + '"></td>' +
        '<td class="n"><input class="num" type="text" inputmode="numeric" id="sc' + i + '_by" data-i="' + i + '" data-f="by" value="' + esc(r.by) + '"></td>' +
        '<td class="n"><input class="num" type="text" inputmode="decimal" id="sc' + i + '_to" data-i="' + i + '" data-f="to" value="' + esc(r.to) + '"></td>' +
        '<td class="n"><input class="num" type="text" inputmode="numeric" id="sc' + i + '_w" data-i="' + i + '" data-f="w" value="' + esc(r.w) + '"></td>' +
        '<td><button type="button" class="del" data-del="' + i + '" aria-label="删掉这种走势">删</button></td></tr>';
    });
    $('scTbl').innerHTML = h;
    $('addSc').disabled = state.scen.length >= A.MAX_SC;
    $('addSc').textContent = state.scen.length >= A.MAX_SC ? '已经 5 种（上限）' : '＋ 再加一种';
  }
  $('scTbl').addEventListener('input', function (e) { var t = e.target, i = t.getAttribute('data-i'); if (i == null) return; state.scen[+i][t.getAttribute('data-f')] = t.value; update(); });
  $('scTbl').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; state.scen.splice(+b.getAttribute('data-del'), 1); buildSc(); update(); });
  $('addSc').addEventListener('click', function () { if (state.scen.length >= A.MAX_SC) return; state.scen.push({ name: '', to: '', by: '', w: '' }); buildSc(); update(); var n = $('sc' + (state.scen.length - 1) + '_name'); if (n) n.focus(); });

  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; update(); }); });
  $('plan').addEventListener('input', function () { state.plan = this.value; update(); });
  $('qRange').addEventListener('input', function () { state.plan = this.value; $('plan').value = this.value; update(); });
  $('ticks').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (!b) return; state.plan = b.getAttribute('data-q'); $('plan').value = state.plan; update(); });

  function fill() { buildSc(); FIELDS.forEach(function (k) { $(k).value = state[k]; }); $('plan').value = state.plan; }

  function markErrors() {
    document.querySelectorAll('input.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (out.ok) return;
    out.errors.forEach(function (er) {
      var m = /^sc(\d+)\.(\w+)$/.exec(er.field), el = m ? $('sc' + m[1] + '_' + m[2]) : $(er.field);
      if (el) el.classList.add('bad');
    });
  }

  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok);
    $('okBox').classList.toggle('hide', !o.ok);
    $('chartPanel').classList.toggle('hide', !o.ok);
    $('tblPanel').classList.toggle('hide', !o.ok);
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的格子：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    var a = o.answers, p = o.planRow;
    var h = '按把握算最划算囤 <b>' + J(a.exp.Q) + ' 斤</b>，最不怕后悔囤 <b>' + J(a.regret.Q) + ' 斤</b>';
    if (a.loss) h += '，要保证亏不超过 ' + esc(Y(o.L)) + ' 元就囤 <b>' + J(a.loss.Q) + ' 斤</b>';
    $('headline').innerHTML = h + '。';
    $('qBig').textContent = J(p.Q);
    $('qNote').textContent = (o.planClamped ? '（填的超过上限，按上限 ' + J(o.Qmax) + ' 斤算）' : '') + '能囤的上限 ' + J(o.Qmax) + ' 斤（' + (o.capBy === 'cap' ? '冻柜放得下的' : o.M + ' 周内吃得完的') + '）· 够吃 ' + p.weeksToEat + ' 周';
    var r = $('qRange'); r.max = J(o.Qmax); r.value = J(p.Q);
    var tk = [{ q: 0, t: '不囤' }, { q: a.exp.Q, t: '最划算' }, { q: a.regret.Q, t: '最不后悔' }];
    if (a.loss) tk.push({ q: a.loss.Q, t: '亏得起' });
    tk.push({ q: o.Qmax, t: '上限' });
    var mg = []; tk.forEach(function (x) { var f = mg.filter(function (m) { return m.q === x.q; })[0]; if (f) f.t += ' · ' + x.t; else mg.push({ q: x.q, t: x.t }); }); /* 同一斤数合成一个按钮 */
    mg.sort(function (a, b) { return a.q - b.q; });
    $('ticks').innerHTML = mg.map(function (x) { return '<button type="button" class="tick" data-q="' + J(x.q) + '" aria-pressed="' + (x.q === p.Q) + '">' + x.t + ' <b>' + J(x.q) + ' 斤</b></button>'; }).join('');
    var L = o.sc.map(function (s, i) {
      var v = p.perScen[i], be = p.breakeven[i];
      var d = '第 ' + s.N + ' 周到 ' + Y(s.X) + ' 元/斤 · ' + s.w + ' 成把握';
      if (p.Q > 0 && be != null) d += ' · 这个斤数要它到 ' + Y(be) + ' 元/斤才不亏';
      if (p.Q > 0) { var g = R(o.best[i].cents - v); d += g > 0 ? ' · 早知道是它，换个斤数能多省 ' + Y(g) + ' 元' : ' · 早知道是它也就这么囤'; }
      return '<div class="ln" id="ln' + i + '"><span class="nm"><i style="background:' + COLORS[i] + '"></i>' + esc(s.name) + '</span><span class="v ' + cls(v) + '">' + M(v) + '</span><span class="d">' + esc(d) + '</span></div>';
    });
    L.push('<div class="ln avg" id="lnAvg"><span class="nm">按把握加权平均</span><span class="v ' + cls(p.exp) + '">' + M(p.exp) + '</span><span class="d">最坏' + M(p.worst) + ' · 最多后悔 ' + Y(R(p.regret)) + ' 元</span></div>');
    $('lines').innerHTML = L.join('');
    drawChart();
    var th = '<tr><th>囤多少</th>' + o.sc.map(function (s, i) { return '<th class="n"><span style="color:' + COLORS[i] + '">■</span> ' + esc(s.name) + '</th>'; }).join('') + '<th class="n">按把握平均</th><th class="n">最多后悔</th></tr>';
    $('tbl').innerHTML = th + o.table.map(function (t) {
      return '<tr' + (t.Q === p.Q ? ' class="cur"' : '') + '><td>' + J(t.Q) + ' 斤 <span class="muted">' + esc(t.tags.join('、')) + '</span></td>' + t.perScen.map(function (v) { return '<td class="n ' + cls(v) + '">' + M(v) + '</td>'; }).join('') +
        '<td class="n ' + cls(t.exp) + '">' + M(t.exp) + '</td><td class="n">' + Y(R(t.regret)) + ' 元</td></tr>';
    }).join('');
  }

  function drawChart() {
    var o = out, cwid = $('chart').getBoundingClientRect().width || 900, Wd = Math.round(Math.max(420, Math.min(900, cwid))), Ht = Math.round(Wd < 600 ? Wd * 0.62 : 340);
    $('chart').setAttribute('viewBox', '0 0 ' + Wd + ' ' + Ht);
    var l = 64, rt = 20, tp = 16, bt = 40, cw = Wd - l - rt, ch = Ht - tp - bt;
    var lo = 0, hi = 0; o.curve.forEach(function (r) { r.perScen.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (hi - lo < 100) { hi += 50; lo -= 50; }
    var span = hi - lo, n = Math.max(1, o.Qmax);
    var X = function (q) { return l + cw * q / n; }, Yp = function (v) { return tp + ch * (hi - v) / span; };
    var step = Math.pow(10, Math.floor(Math.log(span / 4) / Math.LN10)); [1, 2, 5, 10].some(function (m) { if (span / (step * m) <= 6) { step *= m; return true; } return false; });
    var g = '';
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) g += '<line x1="' + l + '" x2="' + (Wd - rt) + '" y1="' + Yp(v).toFixed(1) + '" y2="' + Yp(v).toFixed(1) + '" stroke="' + (Math.abs(v) < 1e-9 ? '#58514b' : '#ece5dd') + '" stroke-width="' + (Math.abs(v) < 1e-9 ? 1.5 : 1) + '"/><text x="' + (l - 8) + '" y="' + (Yp(v) + 5).toFixed(1) + '" font-size="14" text-anchor="end" fill="#8c847c">' + Y(R(v)) + '</text>';
    var xs = Math.max(1, Math.ceil(o.Qmax / 2 / 6)); for (var q = 0; q <= o.Qmax / 2 + 1e-9; q += xs) g += '<text x="' + X(q * 2).toFixed(1) + '" y="' + (Ht - 14) + '" font-size="14" text-anchor="middle" fill="#8c847c">' + q + ' 斤</text>';
    o.sc.forEach(function (s, i) { g += '<polyline fill="none" stroke="' + COLORS[i] + '" stroke-width="2.5" points="' + o.curve.map(function (r) { return X(r.Q).toFixed(1) + ',' + Yp(r.perScen[i]).toFixed(1); }).join(' ') + '"/>'; });
    g += '<polyline fill="none" stroke="#a8432f" stroke-width="2" stroke-dasharray="6 5" points="' + o.curve.map(function (r) { return X(r.Q).toFixed(1) + ',' + Yp(r.exp).toFixed(1); }).join(' ') + '"/>';
    var pq = o.planRow.Q; g += '<line x1="' + X(pq).toFixed(1) + '" x2="' + X(pq).toFixed(1) + '" y1="' + tp + '" y2="' + (tp + ch) + '" stroke="#a8432f" stroke-width="2"/>';
    g += '<text x="' + Math.min(Wd - rt - 4, Math.max(l + 4, X(pq) + (pq > o.Qmax / 2 ? -6 : 6))).toFixed(1) + '" y="' + (tp + ch - 8) + '" font-size="14" font-weight="700" fill="#a8432f" text-anchor="' + (pq > o.Qmax / 2 ? 'end' : 'start') + '">' + J(pq) + ' 斤</text>';
    g += '<text x="' + (Wd - rt) + '" y="' + (Ht - 1) + '" font-size="13" text-anchor="end" fill="#a8432f">虚线 = 按把握平均</text>';
    $('chart').innerHTML = g;
  }

  function update() { out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  /* 导出 */
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? J(out.planRow.Q) + '斤' : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('囤肉斤两-逐档.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('囤肉斤两-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('囤肉斤两-备份.json', new Blob([JSON.stringify({ app: '囤肉斤两', slug: 'pork-stock-up', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fill(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f5f2ee'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(60, 50, W - 120, H - 100);
    g.strokeStyle = '#dfd6cd'; g.lineWidth = 2; g.strokeRect(60, 50, W - 120, H - 100);
    var L = 110, Rr = W - 110, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function text(t, size, color, bold, x, w) { font(size, bold); g.fillStyle = color; g.fillText(clip(t, w || maxW), x || L, y); }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[−0-9.,]+ ?(?:元\/斤|元|斤|周|成)[）)。，、；：]?|[（(「]?[0-9A-Za-z.,%]+[）)」。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.5; return; } g.fillText(cur, L, y); y += size * 1.5; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.5; }
    }
    text('囤肉斤两', 52, '#231f1c', true); y += 22;
    g.fillStyle = '#231f1c'; g.fillRect(L, y, maxW, 4); y += 56;
    if (!out.ok) { y += 30; text('还算不了', 48, '#b3261e', true); y += 70; out.errors.slice(0, 6).forEach(function (e) { wrap('· ' + e.message, 28, '#58514b', false, 2); y += 8; }); y += 30; wrap('改好标红的格子，结果会自动重算。', 26, '#8c847c'); y += 40; wrap('这张卡算的是：肉价低的时候一次冻多少斤，在你写的几种价格走势下各省多少、亏多少。', 26, '#8c847c'); return cv; }
    var o = out, a = o.answers, p = o.planRow;
    font(30); g.fillStyle = '#58514b'; g.fillText('这次打算囤', L, y); y += 82;
    font(96, true); g.fillStyle = '#a8432f'; var s1 = J(p.Q) + ' 斤'; g.fillText(s1, L, y); var w1 = g.measureText(s1).width;
    font(30); g.fillStyle = '#58514b'; g.fillText(clip('够吃 ' + p.weeksToEat + ' 周 · 平均' + M(p.exp), maxW - w1 - 30), L + w1 + 30, y - 10); y += 60;
    wrap('现在 ' + Y(o.p0) + ' 元/斤，每周吃 ' + J(o.c) + ' 斤，最多能囤 ' + J(o.Qmax) + ' 斤，冻着每斤每周 ' + Y(o.h) + ' 元', 26, '#58514b', false, 2); y += 16;
    o.sc.forEach(function (s, i) {
      var v = p.perScen[i], top = y - 38;
      g.fillStyle = '#fffdfb'; g.fillRect(L, top, maxW, 92); g.fillStyle = COLORS[i]; g.fillRect(L, top, 8, 92);
      var vt = M(v); font(34, true); var vw = g.measureText(vt).width;
      g.fillStyle = R(v) > 0 ? '#2b7a4b' : R(v) < 0 ? '#b3261e' : '#58514b'; g.textAlign = 'right'; g.fillText(vt, Rr - 18, y + 4); g.textAlign = 'left';
      font(30, true); g.fillStyle = '#231f1c'; g.fillText(clip(s.name, maxW - vw - 70), L + 30, y);
      font(22); g.fillStyle = '#8c847c'; g.fillText(clip('第 ' + s.N + ' 周到 ' + Y(s.X) + ' 元/斤 · ' + s.w + ' 成把握', maxW - vw - 70), L + 30, y + 36);
      y += 106;
    });
    y += 20;
    var tips = ['按把握最划算：' + J(a.exp.Q) + ' 斤（平均' + M(a.exp.exp) + '）', '最不怕后悔：' + J(a.regret.Q) + ' 斤（最多后悔 ' + Y(R(a.regret.regret)) + ' 元）'];
    if (a.loss) tips.push('亏不超过 ' + Y(o.L) + ' 元：' + J(a.loss.Q) + ' 斤（最坏' + M(a.loss.worst) + '）');
    tips.forEach(function (t) { if (y < H - 150) { wrap('· ' + t, 28, '#231f1c', false, 2); y += 6; } });
    /* 结果卡下半：每种走势「囤多少 → 省/亏」的小图（与页面同一 curve） */
    var cT = y + 30, cB = H - 180, cL = L + 70, cR = Rr - 10;
    if (cB - cT > 180) {
      var lo = 0, hi = 0; o.curve.forEach(function (r) { r.perScen.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
      if (hi - lo < 100) { hi += 50; lo -= 50; }
      var nq = Math.max(1, o.Qmax), cx = function (q) { return cL + (cR - cL) * q / nq; }, cy = function (v) { return cT + (cB - cT) * (hi - v) / (hi - lo); };
      font(22); g.fillStyle = '#8c847c'; g.fillText('横轴 = 囤多少斤，纵轴 = 省（上）/ 亏（下）', L, cT - 12);
      g.strokeStyle = '#58514b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cL, cy(0)); g.lineTo(cR, cy(0)); g.stroke();
      g.textAlign = 'right'; font(20); g.fillText('0', cL - 8, cy(0) + 7); g.fillText(Y(R(hi)), cL - 8, cy(hi) + 14); g.fillText(Y(R(lo)), cL - 8, cy(lo)); g.textAlign = 'left';
      o.sc.forEach(function (s, i) { g.strokeStyle = COLORS[i]; g.lineWidth = 4; g.beginPath(); o.curve.forEach(function (r, k) { var X = cx(r.Q), Yv = cy(r.perScen[i]); if (k) g.lineTo(X, Yv); else g.moveTo(X, Yv); }); g.stroke(); });
      g.strokeStyle = '#a8432f'; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); o.curve.forEach(function (r, k) { var X = cx(r.Q), Yv = cy(r.exp); if (k) g.lineTo(X, Yv); else g.moveTo(X, Yv); }); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#a8432f'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx(p.Q), cT); g.lineTo(cx(p.Q), cB); g.stroke();
      font(20); g.fillStyle = '#8c847c'; g.fillText('0 斤', cL, cB + 28); g.textAlign = 'right'; g.fillText(J(o.Qmax) + ' 斤', cR, cB + 28); g.fillStyle = '#a8432f'; g.fillText('虚线 = 按把握平均', cR, cT - 12); g.textAlign = 'left';
    }
    font(21); g.fillStyle = '#8c847c';
    g.fillText(clip('走势与把握是自己的判断，不是肉价预测；默认数字为虚构示例', maxW), L, H - 92);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('囤肉斤两-' + tag() + '-1080x1350.png', b); }, 'image/png'); });

  var rz = null; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (out && out.ok) drawChart(); }, 120); });
  window.__psUi = { state: function () { return JSON.parse(JSON.stringify(state)); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fill(); update();
})();
