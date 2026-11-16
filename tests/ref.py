#!/usr/bin/env python3
"""囤肉斤两 · 独立参考实现：Fraction 精确算术、逐斤（半斤一档）逐周模拟，不复用 core.js 的任何写法。
   换一种写法算省钱：按「每半斤是第几周吃掉的」逐个半斤累加，而不是按周分块。
   生成 300 组随机场景 → tests/ref.json，供 core.test.cjs 对拍。"""
from fractions import Fraction as Fr
import json, random
from pathlib import Path

def price(p0, X, N, t):
    return Fr(p0) + (Fr(X) - Fr(p0)) * Fr(min(t, N), N)

def saving(case, sc, halves):
    p0 = Fr(case['p0'], 100); h = Fr(case['h'], 100); c = case['c']  # c = 每周半斤数
    tot = Fr(0)
    for k in range(halves):          # 第 k 个半斤
        t = k // c                   # 在第 t 周吃掉
        tot += Fr(1, 2) * (price(p0, Fr(sc['X'], 100), sc['N'], t) - p0 - h * t)
    return tot * 100                 # 分

def solve(case):
    qmax = min(case['cap'], case['c'] * case['M'])
    S = case['sc']; W = sum(s['w'] for s in S)
    V = [[saving(case, s, q) for s in S] for q in range(qmax + 1)]
    best = [max(V[q][i] for q in range(qmax + 1)) for i in range(len(S))]
    E = [sum(S[i]['w'] * V[q][i] for i in range(len(S))) / W for q in range(qmax + 1)]
    Rg = [max(best[i] - V[q][i] for i in range(len(S))) for q in range(qmax + 1)]
    qe = min(range(qmax + 1), key=lambda q: (-E[q], q))
    qr = min(range(qmax + 1), key=lambda q: (Rg[q], q))
    ql = None
    if case['L'] is not None:
        ok = [q for q in range(qmax + 1) if min(V[q]) >= -case['L']]
        ql = min(ok, key=lambda q: (-E[q], q)) if ok else None
    plan = min(case['plan'], qmax)
    return {'qmax': qmax, 'exp': qe, 'regret': qr, 'loss': ql,
            'expVal': float(E[qe]), 'regretVal': float(Rg[qr]),
            'plan': [float(x) for x in V[plan]], 'planExp': float(E[plan])}

def rand_case(rng):
    p0 = rng.randint(500, 3000)
    n = rng.randint(1, 5)
    sc = []
    for i in range(n):
        sc.append({'name': '情景%d' % (i + 1), 'X': max(1, p0 + rng.randint(-600, 900)), 'N': rng.randint(1, 20), 'w': rng.randint(0, 10)})
    if sum(s['w'] for s in sc) == 0: sc[0]['w'] = 1
    return {'p0': p0, 'c': rng.randint(1, 8), 'cap': rng.randint(0, 80), 'M': rng.randint(1, 20),
            'h': rng.choice([0, 1, 2, 3, 5, 8, 15]), 'L': rng.choice([None, 0, 500, 1000, 3000]),
            'plan': rng.randint(0, 90), 'sc': sc}

if __name__ == '__main__':
    rng = random.Random(20261116)
    out = []
    for _ in range(300):
        c = rand_case(rng); c['want'] = solve(c); out.append(c)
    Path(__file__).with_name('ref.json').write_text(json.dumps(out, ensure_ascii=False))
    feas = sum(1 for c in out if c['L'] is not None and c['want']['loss'] is not None)
    nol = sum(1 for c in out if c['L'] is not None and c['want']['loss'] is None)
    same = sum(1 for c in out if c['want']['exp'] == c['want']['regret'])
    print('ref.json: %d 组；设了亏得起 %d 组（有解 %d / 无解 %d）；最划算=最不后悔 %d 组；qmax=0 %d 组' % (len(out), feas + nol, feas, nol, same, sum(1 for c in out if c['want']['qmax'] == 0)))
