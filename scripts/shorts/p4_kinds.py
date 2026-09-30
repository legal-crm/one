# -*- coding: utf-8 -*-
"""
Part 4 포맷별 장면 렌더러. 모든 좌표는 G.L(세로/정사각 레이아웃)의 콘텐츠 영역 기준으로 계산한다.

kind 목록
  hook       큰 아이콘 + 칩 (도입 질문)
  cards      번호 카드 목록
  count      TOP N 카운트다운 (장면당 한 순위)
  quiz       OX 퀴즈 (문제 → 3초 카운트다운 → 정답·해설, 두 목소리)
  mythfact   오해 카드 → 뒤집어 사실 카드
  chat       메신저 상담 톡 (두 목소리, 말풍선)
  interview  인터뷰 (두 화자 아바타 + 실제 음량 파형 + 문답 카드)
  versus     2열 비교
  calc       계산 구조 (블록 수식)
  timeline   가로 타임라인 + 기준선
  calendar   기한 달력(D-day) / 기간 막대
  news       법률 브리핑 (헤드라인 + 불릿 + 티커)
  kinetic    키네틱 타이포그래피 (단어 싱크)
  board      화이트보드 손글씨 판서
  story      사연 읽기 (예시 인물·소품)
  flow       YES/NO 셀프 진단 흐름도
  glossary   용어 플래시카드 (뒤집기)
  tutorial   브라우저 따라 하기
  sort       재산 분류 (항목이 두 상자로 이동)
"""
import math

from PIL import Image, ImageDraw

import p4_engine as E
from p4_engine import (G, u, col, rgba, mix, txt, put, box, disc, ring, ico, pill, pop, ease_out, ease_io,
                       back_out, clamp, lerp, WHITE)


def _v():
    return G.L.mode == "v"


def on_card():
    """카드 위 글자색"""
    return G.T["fg"]


def stamp(fr, text, color, x, y, t, t0, size=None, rot=-8):
    if t < t0:
        return
    size = size or u(46)
    im = _stamp_img(text, tuple(color), size, rot)
    p = clamp((t - t0) / 0.2)
    put(fr, im, x, y, "mm", 1.0, s=lerp(1.7, 1.0, ease_out(p)), alpha=clamp(p * 2))


_STAMPS = {}


def _stamp_img(text, color, size, rot):
    key = (text, color, size, rot)
    if key in _STAMPS:
        return _STAMPS[key]
    t = txt(text, size, "H", color, fam="neo")
    w, h = t.width + 30, t.height + 10
    im = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([10, 10, 10 + w, 10 + h], 16, outline=rgba(color), width=max(4, size // 9))
    im.alpha_composite(t, (10 + 15, 10 + 5))
    im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    _STAMPS[key] = im
    return im


def chips_row(fr, sc, t, chips, y, size=None, color="acc2", fg=None):
    """chips: [(글자, 등장시점)] 가로로 가운데 정렬, 넘치면 두 줄"""
    if not chips:
        return
    L, T = G.L, G.T
    size = size or u(34)
    c = col(color)
    fgc = fg or (WHITE if T["dark"] or color in ("acc", "bad", "good") else WHITE)
    ims = [pill(tx, c, fgc, size) for tx, _ in chips]
    rows, cur, cw = [], [], 0
    for im, ch in zip(ims, chips):
        if cur and cw + im.width + 16 > L.cw:
            rows.append(cur)
            cur, cw = [], 0
        cur.append((im, ch))
        cw += im.width + 16
    rows.append(cur)
    for r, row in enumerate(rows):
        tw = sum(im.width for im, _ in row) + 16 * (len(row) - 1)
        x = L.cx - tw / 2
        for im, (tx, at) in row:
            p = pop(t, sc.at(at), 0.35)
            put(fr, im, x + im.width / 2, y + r * (im.height + 14), "mm", p, dy=20, s=0.85 + 0.15 * back_out(p))
            x += im.width + 16


# ── hook ─────────────────────────────────────────────
def k_hook(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    c = col(d.get("color", "acc"))
    cy = L.Y(d.get("y", 0.40))
    r = u(d.get("r", 150))
    p = pop(t, 0.08, 0.5)
    for k in range(2):
        q = (t * 0.55 + k * 0.5) % 1
        put(fr, ring(int(r * (1.05 + 0.5 * q)), c, 4), L.cx, cy, alpha=p * (1 - q) * 0.8)
    s = 0.6 + 0.4 * back_out(p)
    put(fr, disc(r, c), L.cx, cy, "mm", p, s=s)
    put(fr, ico(d.get("icon", "question"), int(r * 1.05), WHITE), L.cx, cy, "mm", p, s=s)
    if d.get("badge"):
        tx, at = d["badge"]
        bp = pop(t, sc.at(at), 0.3)
        put(fr, pill(tx, T["bad"], WHITE, u(34)), L.cx + r * 0.95, cy - r * 0.85, "mm", bp, s=0.7 + 0.3 * back_out(bp))
    chips_row(fr, sc, t, d.get("chips"), L.Y(d.get("chips_y", 0.86)), color=d.get("chip_color", "acc2"))
    if d.get("stamp"):
        tx, at = d["stamp"]
        stamp(fr, tx, T["bad"], L.cx + r * 0.2, cy + r * 0.75, t, sc.at(at))


def sfx_hook(sc):
    ev = [(0.1, "pop")]
    for _, at in sc.d.get("chips", []):
        ev.append((sc.at(at), "pop"))
    if sc.d.get("stamp"):
        ev.append((sc.at(sc.d["stamp"][1]), "thump"))
    if sc.d.get("badge"):
        ev.append((sc.at(sc.d["badge"][1]), "alert"))
    return ev


# ── cards ────────────────────────────────────────────
def _card_item(w, h, badge, title, sub, accent, state):
    T = G.T
    fill = T["card"]
    outline = accent if state == "on" else (T["line"] if not T["dark"] else None)
    im = box(w, h, u(26), fill, outline, 3 if state == "on" else 2, shadow=u(14) if not T["dark"] else 0).copy()
    m = (im.width - w) // 2
    br = int(h * 0.30)
    bx, by = m + u(26) + br, m + h // 2
    bc = accent if state != "done" else mix(accent, T["card"], 0.35)
    b = disc(br, bc)
    im.alpha_composite(b, (bx - b.width // 2, by - b.height // 2))
    if badge.startswith("i:"):
        ic = ico(badge[2:], int(br * 1.1), WHITE)
        im.alpha_composite(ic, (bx - ic.width // 2, by - ic.height // 2))
    else:
        tb = txt(badge, int(br * 1.0), "H", WHITE, fam="neo")
        im.alpha_composite(tb, (bx - tb.width // 2, by - tb.height // 2))
    tx0 = bx + br + u(18)
    maxw = w - (tx0 - m) - u(24)
    tt = txt(title, u(40), "EB", on_card(), maxw=maxw)
    if sub:
        ts = txt(sub, u(28), "R", T["sub"], maxw=maxw)
        tot = tt.height + ts.height - u(18)
        y = by - tot // 2
        im.alpha_composite(tt, (tx0 - 14, y - 6))
        im.alpha_composite(ts, (tx0 - 14, y + tt.height - u(24)))
    else:
        im.alpha_composite(tt, (tx0 - 14, by - tt.height // 2))
    return im


_CARD_CACHE = {}


def k_cards(fr, sc, t):
    L, d = G.L, sc.d
    items = d["items"]
    n = len(items)
    gap = u(18)
    y0, y1 = L.Y(d.get("top", 0.0)), L.Y(d.get("bottom", 1.0))
    h = int(min(u(160), (y1 - y0 - gap * (n - 1)) / n))
    used = n * h + gap * (n - 1)
    y0 += max(0, (y1 - y0 - used) * 0.4)
    times = [sc.at(it[3]) for it in items]
    latest = max([k for k, tm in enumerate(times) if t >= tm] or [-1])
    for k, it in enumerate(items):
        badge, title, sub, at = it[:4]
        accent = col(it[4]) if len(it) > 4 else G.T["acc"]
        p = pop(t, times[k], 0.4)
        if p <= 0:
            continue
        state = "on" if k == latest else "done"
        key = (L.mode, G.ep["ep"], sc.i, k, state)
        if key not in _CARD_CACHE:
            _CARD_CACHE[key] = _card_item(int(L.cw), h, badge, title, sub, accent, state)
        im = _CARD_CACHE[key]
        put(fr, im, L.cx, y0 + k * (h + gap) + h / 2, "mm", p, dx=-50)


def sfx_cards(sc):
    return [(sc.at(it[3]), "pop") for it in sc.d["items"]]


# ── count (TOP N) ────────────────────────────────────
def k_count(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    rank, total = d["rank"], d.get("total", 5)
    c = col(d.get("color", "acc"))
    p = pop(t, 0.05, 0.45)
    nx, ny = L.X(0.16), L.Y(0.30)
    big = txt(str(rank), u(330), "H", c, fam="neo")
    put(fr, disc(u(150), rgba(c, 50) if T["dark"] else rgba(c, 38)), nx, ny, "mm", p, s=0.6 + 0.4 * back_out(p))
    put(fr, big, nx, ny + u(8), "mm", p, s=lerp(1.6, 1.0, ease_out(clamp(t / 0.35))))
    tp = pop(t, sc.at(d.get("at", 0.35)), 0.4)
    tx = L.X(0.36)
    put(fr, txt(d.get("kicker", f"{rank}위"), u(30), "B", T["sub"]), tx, ny - u(92), "lm", tp, dx=40)
    put(fr, txt(d["title"], u(58), "H", T["fg"], maxw=int(L.x1 - tx), fam=T["famt"], lh=1.18), tx, ny + u(6),
        "lm", tp, dx=40)
    if d.get("icon"):
        put(fr, ico(d["icon"], u(64), c), L.x1 - u(20), ny - u(92), "rm", tp)
    if d.get("sub"):
        sp = pop(t, sc.at(d.get("sub_at", 0.9)), 0.4)
        card = box(int(L.cw), u(190), u(28), T["card"], T["line"] if not T["dark"] else None, 2, shadow=u(12))
        put(fr, card, L.cx, L.Y(0.68), "mm", sp, dy=30)
        put(fr, txt(d["sub"], u(38), "B", T["fg"], maxw=int(L.cw - u(80)), align="c"), L.cx, L.Y(0.68), "mm", sp, dy=30)
    # 순위 점
    dy = L.Y(0.96)
    step = u(86)
    x0 = L.cx - step * (total - 1) / 2
    asc = d.get("asc", False)
    for k in range(total):
        rk = k + 1 if asc else total - k
        on = rk <= rank if asc else rk >= rank
        cc = c if rk == rank else (mix(c, T["card"], 0.5) if on else T["line"])
        put(fr, disc(u(24), cc), x0 + k * step, dy, "mm")
        put(fr, txt(str(rk), u(26), "H", WHITE, fam="neo"), x0 + k * step, dy + 1, "mm")


def sfx_count(sc):
    return [(0.05, "thump"), (sc.at(sc.d.get("at", 0.35)), "pop")]


# ── quiz ─────────────────────────────────────────────
def _quiz_times(sc):
    t_q = sc.lt(0)
    pa = sc.pauses[0] if sc.pauses else (sc.le(0) + 0.1, sc.le(0) + 1.5)
    t_r = sc.lt(1)
    return t_q, pa, t_r


def k_quiz(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    t_q, (pa0, pa1), t_r = _quiz_times(sc)
    # 문제 카드
    qp = pop(t, 0.05, 0.4)
    qh = u(270)
    card = box(int(L.cw), qh, u(34), T["card"], T["line"] if not T["dark"] else None, 2, shadow=u(16))
    qy = L.Y(0.0) + qh / 2
    put(fr, card, L.cx, qy, "mm", qp, dy=30)
    put(fr, pill(d.get("qn", "Q"), T["acc2"], WHITE, u(30)), L.x0 + u(40), L.Y(0.0), "lm", qp)
    put(fr, txt(d["q"], u(50), "H", T["fg"], maxw=int(L.cw - u(80)), align="c", fam=T["famt"], lh=1.25),
        L.cx, qy + u(8), "mm", qp, dy=30)
    # O / X 버튼
    by = L.Y(0.585)
    r = u(112)
    ans = d["ans"]
    rev = pop(t, t_r, 0.35)
    for side, x in (("O", L.X(0.25)), ("X", L.X(0.75))):
        cc = T["good"] if side == "O" else T["bad"]
        if T["dark"] is False:
            cc = (37, 99, 235) if side == "O" else T["bad"]
        bp = pop(t, 0.35 if side == "O" else 0.45, 0.4)
        right = side == ans
        s = 0.7 + 0.3 * back_out(bp)
        if rev > 0:
            s *= 1 + (0.14 * back_out(rev) if right else -0.12 * rev)
            if right:
                q = (t - t_r) * 0.8 % 1
                put(fr, ring(int(r * (1.1 + 0.4 * q)), cc, 6), x, by, alpha=(1 - q) * rev)
            else:
                cc = mix(cc, (203, 213, 225), 0.7 * rev)
        put(fr, disc(r, cc), x, by, "mm", bp, s=s)
        if side == "O":
            put(fr, ring(int(r * 0.52), WHITE, max(6, u(18))), x, by, "mm", bp, s=s)
        else:
            put(fr, ico("x", int(r * 1.0), WHITE), x, by, "mm", bp, s=s)
    # 카운트다운
    if pa0 <= t < t_r:
        span = pa1 - pa0
        k = clamp((t - pa0) / span)
        n = max(1, 3 - int(k * 3))
        put(fr, disc(u(58), T["card"]), L.cx, by, "mm")
        put(fr, ring(u(58), T["acc2"], max(5, u(8)), 1 - k), L.cx, by, "mm")
        put(fr, txt(str(n), u(56), "H", T["fg"], fam="neo"), L.cx, by + 2, "mm")
    # 정답 스탬프 + 해설
    if rev > 0:
        x = L.X(0.25) if ans == "O" else L.X(0.75)
        sx_ = x + r * 0.95 if ans == "O" else x - r * 0.95
        stamp(fr, "정답", T["acc2"] if T["dark"] else T["acc"], sx_, by - r * 0.7, t, t_r, size=u(40), rot=-10)
        ep_ = pop(t, t_r + 0.35, 0.45)
        exp = txt(d["exp"], u(38), "B", T["fg"], maxw=int(L.cw - u(90)), lh=1.32)
        eh = exp.height + u(40)
        ey = L.Y(0.80)
        put(fr, box(int(L.cw), eh, u(26), T["card"], col(T["acc"]), 3, shadow=u(12)), L.cx, ey + eh / 2, "mm", ep_, dy=40)
        put(fr, exp, L.x0 + u(34), ey + eh / 2, "lm", ep_, dy=40)


def sfx_quiz(sc):
    t_q, (pa0, pa1), t_r = _quiz_times(sc)
    ev = [(0.05, "pop")]
    span = pa1 - pa0
    for k in range(3):
        ev.append((pa0 + k * span / 3, "tick"))
    ev.append((t_r, "ding"))
    return ev


# ── mythfact ─────────────────────────────────────────
_MF = {}


def _mf_card(front, w, h):
    T, d = G.T, None
    key = (G.L.mode, G.ep["ep"], front[0], front[1], w, h)
    if key in _MF:
        return _MF[key]
    label, text, cc, kind = front
    im = box(w, h, u(36), T["card"], cc, 4, shadow=u(18)).copy()
    m = (im.width - w) // 2
    lab = pill(label, cc, WHITE, u(36))
    im.alpha_composite(lab, (m + u(40), m + u(40)))
    ic = ico(kind, u(120), mix(cc, T["card"], 0.75))
    im.alpha_composite(ic, (m + w - ic.width - u(36), m + u(30)))
    tt = txt(text, u(52), "H", T["fg"], maxw=w - u(100), align="c", fam=T["famt"], lh=1.26)
    im.alpha_composite(tt, (m + (w - tt.width) // 2, m + u(60) + (h - tt.height) // 2))
    _MF[key] = im
    return im


def k_mythfact(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    w, h = int(L.cw), int(min(u(520), L.ch * 0.86))
    cy = L.Y(0.47)
    t_f = sc.lt(1) - 0.2
    front = ("오해", d["myth"], T["bad"], "x")
    back = ("사실", d["fact"], T["good"], "check")
    p = pop(t, 0.05, 0.45)
    if d.get("n"):
        put(fr, pill(d["n"], T["fg"], T["bg"][0], u(28)), L.cx, L.Y(0.0) - u(10), "mm", p)
    if t < t_f:
        im = _mf_card(front, w, h)
        put(fr, im, L.cx, cy, "mm", p, dy=50, s=0.9 + 0.1 * p)
        stamp(fr, "틀린 상식", T["bad"], L.cx + w * 0.26, cy + h * 0.36, t, t_f - 0.55, size=u(40))
    else:
        k = clamp((t - t_f) / 0.36)
        sx = abs(math.cos(math.pi * k))
        im = _mf_card(front if k < 0.5 else back, w, h)
        im = im.resize((max(2, int(im.width * max(0.02, sx))), im.height), Image.BILINEAR)
        put(fr, im, L.cx, cy, "mm")
        if k >= 1:
            q = (t - t_f - 0.36)
            if q < 0.6:
                put(fr, ring(int(w * 0.35 + q * 300), T["good"], 5), L.cx, cy, alpha=1 - q / 0.6)


def sfx_mythfact(sc):
    return [(0.05, "thump"), (sc.lt(1) - 0.2, "whoosh"), (sc.lt(1) + 0.16, "ding")]


# ── chat ─────────────────────────────────────────────
_BUB = {}


def _bubble(text, mine, spk_name, w_max, active, color):
    T = G.T
    key = (G.L.mode, text, mine, spk_name, active, color)
    if key in _BUB:
        return _BUB[key]
    size = u(40) if _v() else 34
    fg = WHITE if mine else G.T["fg"]
    tt = txt(text, size, "B", fg, maxw=w_max - u(64), lh=1.3, fam="round")
    bw, bh = tt.width - 28 + u(56), tt.height - 28 + u(40)
    fill = color if mine else WHITE
    outline = (253, 224, 71) if active else None
    b = box(bw, bh, u(30), fill, outline, 4 if active else 0, shadow=u(8))
    im = b.copy()
    m = (im.width - bw) // 2
    im.alpha_composite(tt, (m + u(28) - 14, m + u(20) - 14))
    _BUB[key] = im
    return im


def k_chat(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    x0, y0, x1, y1 = L.full
    v = _v()
    names = d["names"]
    me = d["me"]
    hdr_h = u(128) if v else 96
    inp_h = u(104) if v else 80
    area_top, area_bot = y0 + hdr_h + 10, y1 - inp_h - 16
    # 말풍선
    wmax = int((x1 - x0) * 0.74)
    items = []
    for j, ln in enumerate(sc.lines):
        if t < ln.t0 - 0.02:
            break
        mine = ln.spk == me
        active = ln.t0 <= t <= ln.t1 + 0.1
        cc = col(names[ln.spk][1]) if mine else WHITE
        items.append((ln, mine, _bubble(ln.plain, mine, names[ln.spk][0], wmax, active, cc)))
    nxt = next((ln for ln in sc.lines if ln.t0 > t), None)
    typing = nxt is not None and nxt.t0 - t < 0.6 and (not items or t > items[-1][0].t1)
    gap = u(46) if v else 38
    y = area_bot
    if typing:
        y -= u(90) if v else 70
    placed = []
    for ln, mine, im in reversed(items):
        h = im.height + gap
        placed.append((ln, mine, im, y - im.height))
        y -= h
    # 새 말풍선이 올라오는 애니메이션
    shift = 0
    if items:
        lp = pop(t, items[-1][0].t0, 0.28)
        shift = (1 - lp) * (items[-1][2].height + gap)
    av_r = u(34) if v else 28
    for ln, mine, im, top in placed:
        yy = top + shift
        if yy + im.height < area_top:
            continue
        p = pop(t, ln.t0, 0.28)
        if mine:
            put(fr, im, x1 - 8, yy, "rt", p, s=0.94 + 0.06 * p)
        else:
            ax = x0 + av_r + 6
            put(fr, disc(av_r, col(names[ln.spk][1])), ax, yy + av_r - 4, "mm", p)
            put(fr, txt(names[ln.spk][2], int(av_r * 1.0), "H", WHITE, fam="round"), ax, yy + av_r - 4, "mm", p)
            put(fr, txt(names[ln.spk][0], u(26) if v else 22, "B", T["sub"], fam="round"), ax + av_r + 10, yy - 4, "lb", p)
            put(fr, im, ax + av_r + 4, yy, "lt", p, s=0.94 + 0.06 * p)
    if typing:
        mine = nxt.spk == me
        tw, th = (u(140), u(70)) if v else (112, 56)
        b = box(tw, th, th // 2, col(names[nxt.spk][1]) if mine else WHITE, shadow=u(6))
        bx = x1 - 8 - b.width / 2 if mine else x0 + av_r * 2 + 16 + b.width / 2
        by = area_bot - th / 2
        put(fr, b, bx, by, "mm")
        for k in range(3):
            a = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(t * 9 - k * 0.9))
            put(fr, disc(u(8) if v else 7, WHITE if mine else (148, 163, 184)), bx + (k - 1) * (u(28) if v else 22), by,
                "mm", alpha=a)
    # 헤더
    dr = ImageDraw.Draw(fr)
    dr.rectangle([0, 0, L.W, y0 + hdr_h], fill=rgba(mix(T["bg"][0], WHITE, 0.55)))
    dr.line([(0, y0 + hdr_h), (L.W, y0 + hdr_h)], fill=rgba(T["line"]), width=2)
    hy = y0 + hdr_h / 2 + (u(20) if v else 14)
    put(fr, txt(d.get("room", "가명 상담방"), u(40) if v else 32, "H", T["fg"], fam="round"), x0 + 60, hy, "lm")
    put(fr, pill("번호 비공개", T["acc2"], WHITE, u(24) if v else 20), x1 - 8, hy, "rm")
    cs = u(16) if v else 13
    dr.line([(x0 + 28, hy - cs), (x0 + 28 - cs, hy), (x0 + 28, hy + cs)], fill=rgba(T["fg"]), width=max(3, u(5)))
    # 입력창
    dr.rectangle([0, y1 - inp_h, L.W, L.H], fill=rgba(WHITE))
    put(fr, box(int(x1 - x0 - u(120)), int(inp_h * 0.62), int(inp_h * 0.31), (241, 245, 249)), x0 + (x1 - x0 - u(120)) / 2,
        y1 - inp_h / 2, "mm")
    put(fr, txt("메시지 입력", u(30) if v else 24, "R", (148, 163, 184), fam="round"), x0 + u(30), y1 - inp_h / 2, "lm")
    put(fr, disc(int(inp_h * 0.3), T["acc"]), x1 - u(40), y1 - inp_h / 2, "mm")
    put(fr, ico("arrow", int(inp_h * 0.3), WHITE), x1 - u(40), y1 - inp_h / 2, "mm")
    if G.L.mode == "v":
        dr.rectangle([0, y1, L.W, L.H], fill=rgba(WHITE))


def sfx_chat(sc):
    return [(ln.t0, "tick") for ln in sc.lines]


# ── interview ────────────────────────────────────────
def k_interview(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    names = d["names"]
    host = d["host"]
    spks = list(names.keys())
    ln = sc.active_line(t) or sc.lines[0]
    ay = L.Y(0.12)
    r = u(80)
    for k, spk in enumerate(spks):
        x = L.X(0.22 if k == 0 else 0.78)
        label, ckey, kind = names[spk]
        c = col(ckey)
        active = ln.spk == spk and ln.t0 <= t <= ln.t1 + 0.1
        p = pop(t, 0.05 + k * 0.12, 0.4)
        if active:
            q = (t * 1.2) % 1
            put(fr, ring(int(r * (1.08 + 0.35 * q)), c, 5), x, ay, alpha=1 - q)
        put(fr, disc(r, c if active else mix(c, T["card"], 0.45)), x, ay, "mm", p)
        put(fr, ico(kind, int(r * 1.1), WHITE), x, ay + u(6), "mm", p)
        put(fr, pill(label, T["card"], T["fg"], u(26), outline=c if active else None), x, ay + r + u(34), "mm", p)
    # 파형
    wy = L.Y(0.36)
    n = 34
    bw = L.cw / n
    c = col(names[ln.spk][1])
    env = ln.env if ln.env is not None else [0]
    fi = int((t - ln.t0) * E.FPS)
    dr = ImageDraw.Draw(fr)
    speaking = ln.t0 <= t <= ln.t1
    for k in range(n):
        idx = fi - (n // 2 - abs(k - n // 2)) // 2
        a = env[idx] if speaking and 0 <= idx < len(env) else 0.0
        hgt = u(8) + a * u(90) * (0.55 + 0.45 * math.sin(k * 1.7 + t * 6) ** 2)
        x = L.x0 + k * bw + bw * 0.2
        dr.rounded_rectangle([x, wy - hgt / 2, x + bw * 0.6, wy + hgt / 2], int(bw * 0.3),
                             fill=rgba(c, 230 if speaking else 90))
    # 문답 카드
    for j, x in enumerate(sc.lines):
        if not (x.t0 - 0.05 <= t):
            continue
        nxt = sc.lines[j + 1] if j + 1 < len(sc.lines) else None
        if nxt and t >= nxt.t0 + 0.25:
            continue
        p = pop(t, x.t0 - 0.05, 0.35)
        out = 1 - (clamp((t - nxt.t0) / 0.25) if nxt and t >= nxt.t0 else 0)
        isq = x.spk == host
        cc = col(names[x.spk][1])
        body = txt(x.show, u(46), "EB", T["fg"], hl=cc, maxw=int(L.cw - u(110)), lh=1.3)
        ch = body.height + u(50)
        top = L.Y(0.47)
        put(fr, box(int(L.cw), ch, u(30), T["card"], cc, 3, shadow=u(14)), L.cx, top + ch / 2, "mm", p * out, dy=40)
        put(fr, txt("Q" if isq else "A", u(54), "H", cc, fam="neo"), L.x0 + u(30), top + u(46), "lm", p * out, dy=40)
        put(fr, body, L.x0 + u(80), top + ch / 2, "lm", p * out, dy=40)


SFX_INTERVIEW = None


# ── versus ───────────────────────────────────────────
def k_versus(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    heads, rows = d["heads"], d["rows"]
    gap = u(22)
    cw = (L.cw - gap) / 2
    hh = u(130)
    for k, (title, ckey, kind) in enumerate(heads):
        c = col(ckey)
        x = L.x0 + cw / 2 + k * (cw + gap)
        p = pop(t, sc.at(d.get("head_at", [0.1, 0.25])[k]), 0.4)
        put(fr, box(int(cw), hh, u(28), c, shadow=u(12)), x, L.y0 + hh / 2, "mm", p, dy=-30)
        put(fr, ico(kind, u(56), WHITE), x - cw / 2 + u(56), L.y0 + hh / 2, "mm", p, dy=-30)
        put(fr, txt(title, u(44), "H", WHITE, maxw=int(cw - u(110)), fam=T["famt"], lh=1.1), x + u(28), L.y0 + hh / 2,
            "mm", p, dy=-30)
    n = len(rows)
    area = L.ch - hh - u(30)
    rh = min(u(210), area / n)
    for k, (label, left, right, at) in enumerate(rows):
        p = pop(t, sc.at(at), 0.4)
        top = L.y0 + hh + u(30) + k * rh
        for j, cell in enumerate((left, right)):
            x = L.x0 + cw / 2 + j * (cw + gap)
            c = col(heads[j][1])
            put(fr, box(int(cw), int(rh - u(18)), u(22), T["card"], rgba(c), 2), x, top + rh / 2, "mm", p, dy=30)
            put(fr, txt(cell, u(34), "B", T["fg"], maxw=int(cw - u(40)), align="c", lh=1.25), x, top + rh / 2 + u(12),
                "mm", p, dy=30)
        put(fr, pill(label, T["fg"] if not T["dark"] else T["line"], T["bg"][0] if not T["dark"] else WHITE, u(24)),
            L.cx, top + u(6), "mm", p)


def sfx_versus(sc):
    return [(sc.at(r[3]), "pop") for r in sc.d["rows"]]


# ── calc ─────────────────────────────────────────────
def k_calc(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    terms, ops = d["terms"], d.get("ops", [])
    v = _v()
    n = len(terms)
    if v:
        bw, bh, og = int(L.cw * 0.86), u(140), u(78)
        tot = n * bh + (n - 1) * og
        y = L.Y(d.get("top", 0.02))
        pos = []
        for k in range(n):
            pos.append((L.cx, y + bh / 2))
            y += bh + og
        opos = [(L.cx, pos[k][1] + bh / 2 + og / 2) for k in range(n - 1)]
    else:
        og = u(80)
        bw = int((L.cw - og * (n - 1)) / n)
        bh = u(200)
        yy = L.Y(0.30)
        pos = [(L.x0 + bw / 2 + k * (bw + og), yy) for k in range(n)]
        opos = [(pos[k][0] + bw / 2 + og / 2, yy) for k in range(n - 1)]
    for k, (label, sub, ckey, at) in enumerate(terms):
        c = col(ckey)
        p = pop(t, sc.at(at), 0.4)
        x, y = pos[k]
        last = k == n - 1 and d.get("result", True)
        put(fr, box(bw, bh, u(28), c if last else T["card"], c, 4, shadow=u(12)), x, y, "mm", p, dy=30, s=0.9 + 0.1 * back_out(p))
        put(fr, txt(label, u(44), "H", WHITE if last else T["fg"], fam=T["famt"], maxw=bw - u(30), align="c"), x,
            y - (u(20) if sub else 0), "mm", p, dy=30)
        if sub:
            put(fr, txt(sub, u(26), "B", WHITE if last else T["sub"], maxw=bw - u(30), align="c"), x, y + u(34), "mm", p, dy=30)
    for k, op in enumerate(ops):
        p = pop(t, sc.at(terms[k + 1][3]) - 0.1, 0.3)
        put(fr, txt(op, u(72), "H", T["acc2"], fam="neo"), opos[k][0], opos[k][1], "mm", p, s=0.6 + 0.4 * back_out(p))
    if d.get("after"):
        tx, at = d["after"]
        p = pop(t, sc.at(at), 0.4)
        ay = (pos[-1][1] + bh / 2 + u(90)) if v else L.Y(0.78)
        put(fr, pill(tx, T["acc2"], WHITE, u(40), pad=40), L.cx, ay, "mm", p, dy=20, s=0.85 + 0.15 * back_out(p))


def sfx_calc(sc):
    ev = [(sc.at(x[3]), "pop") for x in sc.d["terms"]]
    if sc.d.get("after"):
        ev.append((sc.at(sc.d["after"][1]), "ding"))
    return ev


# ── timeline ─────────────────────────────────────────
def k_timeline(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    ay = L.Y(d.get("axis_y", 0.52))
    xa, xb = L.X(0.03), L.X(0.97)
    p = ease_out(clamp((t - 0.05) / 0.6))
    dr = ImageDraw.Draw(fr)
    for z in d.get("zones", []):
        zx0, zx1, label, ckey, at = z
        zp = pop(t, sc.at(at), 0.4)
        if zp <= 0:
            continue
        c = col(ckey)
        X0, X1 = lerp(xa, xb, zx0), lerp(xa, xb, zx1)
        zh = u(250)
        put(fr, box(int(X1 - X0), zh, u(20), rgba(c, int(46 * zp) if True else 40)), (X0 + X1) / 2, ay - zh / 2 - u(10), "mm")
        put(fr, txt(label, u(34), "EB", c if not T["dark"] else mix(c, WHITE, 0.3), maxw=int(X1 - X0 - 20), align="c"),
            (X0 + X1) / 2, ay - zh + u(40), "mm", zp)
    dr.rounded_rectangle([xa, ay - u(5), xa + (xb - xa) * p, ay + u(5)], u(5), fill=rgba(T["fg"], 200))
    if p > 0.95:
        dr.polygon([(xb + u(24), ay), (xb - u(4), ay - u(16)), (xb - u(4), ay + u(16))], fill=rgba(T["fg"], 200))
    for k, pt in enumerate(d["points"]):
        x, label, sub, at = pt[:4]
        c = col(pt[4]) if len(pt) > 4 else T["acc"]
        pp = pop(t, sc.at(at), 0.4)
        X = lerp(xa, xb, x)
        put(fr, disc(u(20), c, WHITE, 4), X, ay, "mm", pp, s=0.5 + 0.5 * back_out(pp))
        below = pt[5] if len(pt) > 5 else True
        ty = ay + (u(70) if below else -u(70))
        put(fr, txt(label, u(34), "H", T["fg"], maxw=u(300), align="c", fam=T["famt"]), X, ty, "mt" if below else "mb", pp,
            dy=20 if below else -20)
        if sub:
            put(fr, txt(sub, u(26), "B", T["sub"], maxw=u(300), align="c"), X, ty + (u(52) if below else -u(52)),
                "mt" if below else "mb", pp)
    if d.get("cut"):
        x, label, at = d["cut"]
        cp = pop(t, sc.at(at), 0.35)
        if cp > 0:
            X = lerp(xa, xb, x)
            top, bot = ay - u(300) * cp, ay + u(14)
            yy = top
            while yy < bot:
                dr.line([(X, yy), (X, min(bot, yy + u(18)))], fill=rgba(T["bad"]), width=max(3, u(6)))
                yy += u(32)
            put(fr, pill(label, T["bad"], WHITE, u(30)), X, ay - u(320), "mm", cp, s=0.7 + 0.3 * back_out(cp))


def sfx_timeline(sc):
    ev = [(sc.at(p[3]), "pop") for p in sc.d["points"]]
    if sc.d.get("cut"):
        ev.append((sc.at(sc.d["cut"][2]), "thump"))
    return ev


# ── calendar ─────────────────────────────────────────
def k_calendar(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    if d.get("mode") == "bars":
        return _cal_bars(fr, sc, t)
    n = d["days"]
    off = d.get("offset", 2)
    a, b = sc.at(d["from"]), sc.at(d["to"])
    k = clamp((t - a) / max(0.1, b - a))
    lit = int(round(k * n)) if t >= a else 0
    v = _v()
    cell = u(104) if v else 82
    gw = cell * 7
    gx = L.cx - gw / 2
    gy = L.Y(0.28)
    wd = "일월화수목금토"
    p = pop(t, 0.05, 0.4)
    for j, ch in enumerate(wd):
        c = T["bad"] if j == 0 else T["sub"]
        put(fr, txt(ch, u(28), "B", c), gx + cell * (j + 0.5), gy - u(30), "mm", p)
    rows = math.ceil((n + off + 1) / 7)
    for idx in range(rows * 7):
        day = idx - off
        cx_, cy_ = gx + cell * (idx % 7 + 0.5), gy + cell * (idx // 7 + 0.5)
        if day < 0 or day > n:
            continue
        on = day <= lit and t >= a
        last = day == n
        fill = (T["bad"] if last else T["acc"]) if on else T["card"]
        put(fr, box(cell - 10, cell - 10, u(18), fill, T["line"] if not on else None, 2), cx_, cy_, "mm", p)
        lab = "송달" if day == 0 else ("마감" if last else str(day))
        put(fr, txt(lab, u(28) if day in (0, n) else u(32), "EB", WHITE if on else T["fg"]), cx_, cy_, "mm", p)
    # D-day 카운터
    dd = n - lit if t >= a else n
    big = txt(d.get("fmt", "D-{n}").format(n=dd) if dd > 0 else "D-DAY", u(120), "H", T["bad"] if dd <= 3 else T["acc"], fam="neo")
    put(fr, big, L.cx, L.Y(0.10), "mm", p)
    if d.get("note"):
        tx, at = d["note"]
        put(fr, pill(tx, T["acc2"], WHITE, u(34)), L.cx, gy + rows * cell + u(60), "mm", pop(t, sc.at(at), 0.4), dy=20)


def _cal_bars(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    rows = d["bars"]
    mx = d.get("max", 10)
    n = len(rows)
    rh = min(u(240), L.ch / n)
    off = max(0, (L.ch - n * rh) * 0.4)
    for k, (label, years, ckey, at) in enumerate(rows):
        c = col(ckey)
        t0 = sc.at(at)
        p = pop(t, 0.15 + 0.15 * k, 0.4)   # 항목·트랙은 먼저 보이고, 막대는 키워드 시점에 채워진다
        fillp = ease_io(clamp((t - t0 - 0.1) / 1.0)) if t >= t0 else 0.0
        top = L.y0 + off + k * rh + u(10)
        put(fr, txt(label, u(40), "H", T["fg"], fam=T["famt"]), L.x0, top + u(20), "lm", p, dx=-30)
        cur = years * fillp
        put(fr, txt(f"{int(round(cur))}년", u(64), "H", c, fam="neo"), L.x1, top + u(20), "rm", p)
        bw = L.cw
        by = top + u(92)
        put(fr, box(int(bw), u(40), u(20), T["card"], T["line"] if not T["dark"] else None, 2), L.cx, by, "mm", p)
        wv = max(u(40), bw * years / mx * fillp)
        if p > 0 and fillp > 0:
            put(fr, box(int(wv), u(40), u(20), c), L.x0 + wv / 2, by, "mm", p)
        if len(rows[k]) > 4:
            pass


def sfx_calendar(sc):
    d = sc.d
    if d.get("mode") == "bars":
        return [(sc.at(r[3]), "pop") for r in d["bars"]]
    a, b = sc.at(d["from"]), sc.at(d["to"])
    n = d["days"]
    ev = [(a + (b - a) * k / n, "tick") for k in range(1, n + 1, 2)]
    ev.append((b, "alert"))
    return ev


# ── news ─────────────────────────────────────────────
def k_news(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    v = _v()
    p = pop(t, 0.05, 0.4)
    ty = L.cap_y - (6 if v else 10)
    tag = pill("    " + d.get("tag", "30초 요약"), T["bad"], WHITE, u(30) if v else 22)
    put(fr, tag, L.x0 - 14, ty, "lt", p)
    blink = 0.4 + 0.6 * (0.5 + 0.5 * math.sin(t * 6))
    put(fr, disc(u(8) if v else 6, WHITE), L.x0 - 14 + (u(30) if v else 22), ty + tag.height / 2, "mm", p, alpha=blink * p)
    hs = u(64) if v else 48
    head = txt(d["headline"], hs, "H", T["fg"], hl=T["acc"], maxw=L.cap_w, fam="neo", lh=1.2)
    put(fr, head, L.x0 - 14, ty + tag.height + (u(18) if v else 6), "lt", pop(t, 0.15, 0.45), dy=20)
    by = L.Y(0.03)
    for k, (tx, at) in enumerate(d.get("bullets", [])):
        bp = pop(t, sc.at(at), 0.4)
        body = txt(tx, u(44), "B", T["fg"], hl=T["acc"], maxw=int(L.cw - u(70)), lh=1.3)
        put(fr, box(u(16), u(16), u(4), T["acc"]), L.x0 + u(8), by + u(40), "mm", bp)
        put(fr, body, L.x0 + u(34), by, "lt", bp, dx=40)
        by += body.height + u(26)
    # 핵심 숫자 카드 또는 배경 아이콘
    rest_top = by + u(20)
    rest_bot = L.y1 - (u(90) if v else 60)
    mid = (rest_top + rest_bot) / 2
    if d.get("big") and rest_bot - rest_top > u(160):
        big, label, at = d["big"]
        bp = pop(t, sc.at(at), 0.45)
        bh = min(rest_bot - rest_top, u(300))
        put(fr, box(int(L.cw), int(bh), u(30), T["card"], T["line"], 2), L.cx, mid, "mm", bp, dy=30)
        put(fr, txt(big, u(120), "H", T["acc"], fam="neo"), L.cx, mid - u(22), "mm", bp, dy=30, s=0.8 + 0.2 * back_out(bp))
        put(fr, txt(label, u(32), "B", T["sub"]), L.cx, mid + bh / 2 - u(44), "mm", bp, dy=30)
    elif rest_bot - rest_top > u(160):
        put(fr, ico(d.get("icon", "gavel"), int(min(u(230), rest_bot - rest_top - 20)), mix(T["bg"][0], T["fg"], 0.12)),
            L.cx, mid, "mm", p)
    # 티커
    th = u(66) if v else 50
    tyk = L.y1 - th / 2 + (u(20) if v else -4)
    dr = ImageDraw.Draw(fr)
    dr.rectangle([0, tyk - th / 2, L.W, tyk + th / 2], fill=rgba(mix(T["bg"][1], (0, 0, 0), 0.3), 235))
    lab = pill("NOTE", T["acc"], (17, 24, 39), u(26) if v else 20, h=int(th * 0.7))
    tick_text = d.get("ticker", "법 조항 기준 요약 · 개별 사건은 법원 판단에 따라 다를 수 있습니다 · 마이김변 법률 브리핑")
    tt = txt((tick_text + "   ·   ") * 3, u(28) if v else 22, "B", T["sub"])
    x = L.W - ((t * 90) % (tt.width / 3))
    put(fr, tt, x - tt.width / 3 * 2, tyk, "lm")
    dr.rectangle([0, tyk - th / 2, lab.width + 40, tyk + th / 2], fill=rgba(mix(T["bg"][1], (0, 0, 0), 0.3), 255))
    put(fr, lab, 24, tyk, "lm")


def sfx_news(sc):
    return [(sc.at(b[1]), "tick") for b in sc.d.get("bullets", [])]


# ── kinetic ──────────────────────────────────────────
_KW = {}


def _kin_layout(ln, size, maxw):
    key = (G.L.mode, G.ep["ep"], ln.show, size, maxw)
    if key in _KW:
        return _KW[key]
    f = E.F(G.T["famt"], "H", size)
    rows, cur, cw = [], [], 0
    sp = f.getlength(" ")
    for w in ln.words:
        ww = f.getlength(w[2]) * (1.1 if w[3] else 1)
        if cur and cw + sp + ww > maxw:
            rows.append((cur, cw))
            cur, cw = [], 0
        cw += (sp if cur else 0) + ww
        cur.append((w, ww))
    if cur:
        rows.append((cur, cw))
    _KW[key] = (rows, sp)
    return _KW[key]


def k_kinetic(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    x0, y0, x1, y1 = L.full
    v = _v()
    size = u(96) if v else 74
    maxw = (x1 - x0) - 60
    for j, ln in enumerate(sc.lines):
        nxt = sc.lines[j + 1] if j + 1 < len(sc.lines) else None
        end = (nxt.t0 - 0.12) if nxt else sc.dur + 1
        if not (ln.t0 - 0.1 <= t < end):
            continue
        out = clamp((end - t) / 0.18) if nxt else 1.0
        rows, sp = _kin_layout(ln, size, maxw)
        lh = size * 1.32
        cy = (y0 + y1) / 2 - (u(40) if v else 10)
        top = cy - lh * len(rows) / 2
        # 배경 블롭
        bc = [T["acc"], T["acc2"]][j % 2]
        bp = pop(t, ln.t0 - 0.1, 0.4)
        put(fr, disc(int((x1 - x0) * 0.42), rgba(bc, 38)), L.W / 2 + (j % 2 * 2 - 1) * u(120), cy, "mm", bp * out,
            s=0.8 + 0.2 * bp)
        for r, (row, rw) in enumerate(rows):
            x = L.W / 2 - rw / 2
            y = top + r * lh + lh / 2
            for w, ww in row:
                p = pop(t, w[0] - 0.04, 0.22)
                c = T["acc"] if w[3] else T["fg"]
                im = txt(w[2], int(size * (1.1 if w[3] else 1)), "H", c, fam=T["famt"])
                if w[3] and p > 0:
                    hb = box(int(ww + 20), int(size * 1.15), u(14), rgba(c, 40))
                    put(fr, hb, x + ww / 2, y + u(4), "mm", p * out)
                put(fr, im, x + ww / 2, y, "mm", p * out, dy=u(30), s=0.7 + 0.3 * back_out(p))
                x += ww + sp
        if d.get("tags") and j < len(d["tags"]) and d["tags"][j]:
            put(fr, pill(d["tags"][j], T["fg"], T["bg"][1], u(30)), L.W / 2, top - u(60), "mm", bp * out)


def sfx_kinetic(sc):
    ev = []
    for ln in sc.lines:
        for w in ln.words:
            if w[3]:
                ev.append((w[0], "pop"))
                break
    return ev


# ── board (화이트보드) ─────────────────────────────────
def _pp(x, y):
    L = G.L
    return L.X(x), L.Y(y)


def _poly_progress(dr, pts, p, color, width):
    if p <= 0:
        return
    segs = list(zip(pts[:-1], pts[1:]))
    lens = [math.dist(a, b) for a, b in segs]
    tot = sum(lens) or 1
    remain = tot * p
    for (a, b), ln in zip(segs, lens):
        if remain <= 0:
            break
        f = min(1, remain / ln) if ln else 1
        e = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        dr.line([a, e], fill=color, width=width)
        dr.ellipse([e[0] - width / 2, e[1] - width / 2, e[0] + width / 2, e[1] + width / 2], fill=color)
        remain -= ln


def _reveal(im, p):
    if p >= 1:
        return im
    w = max(1, int(im.width * clamp(p)))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im.crop((0, 0, w, im.height)), (0, 0))
    return out


def k_board(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    dr = ImageDraw.Draw(fr)
    ink = rgba(T["fg"])
    lw = max(3, u(5))
    for it in d["items"]:
        typ = it[0]
        if typ == "box":
            _, text, x, y, w, ckey, at = it
            t0 = sc.at(at)
            if t < t0:
                continue
            c = rgba(col(ckey))
            X, Y = _pp(x, y)
            tt = txt(text, u(58), "EB", T["fg"], maxw=int(L.cw * w - u(40)), align="c", fam="pen", lh=1.05)
            bw, bh = L.cw * w, tt.height + u(24)
            j = u(6)
            pts = [(X - bw / 2, Y - bh / 2 + j), (X + bw / 2 - j, Y - bh / 2), (X + bw / 2, Y + bh / 2 - j),
                   (X - bw / 2 + j, Y + bh / 2), (X - bw / 2, Y - bh / 2 + j)]
            pb = clamp((t - t0) / 0.45)
            if pb >= 1:
                put(fr, box(int(bw - 8), int(bh - 8), u(10), rgba(col(ckey), 34)), X, Y, "mm")
            _poly_progress(dr, pts, ease_io(pb), c, lw)
            put(fr, _reveal(tt, ease_io((t - t0 - 0.2) / 0.5)), X, Y, "mm")
        elif typ == "text":
            _, text, x, y, size, ckey, at = it
            t0 = sc.at(at)
            if t < t0:
                continue
            X, Y = _pp(x, y)
            tt = txt(text, u(size * 1.25), "EB", col(ckey), maxw=int(L.cw - u(20)), align="c", fam="pen", lh=1.05)
            put(fr, _reveal(tt, ease_io((t - t0) / 0.5)), X, Y, "mm")
        elif typ == "arrow":
            _, a, b, ckey, at = it
            t0 = sc.at(at)
            if t < t0:
                continue
            c = rgba(col(ckey))
            A, B = _pp(*a), _pp(*b)
            pa = ease_io(clamp((t - t0) / 0.4))
            _poly_progress(dr, [A, B], pa, c, lw)
            if pa >= 1:
                ang = math.atan2(B[1] - A[1], B[0] - A[0])
                hl = u(26)
                for s in (-1, 1):
                    e = (B[0] - hl * math.cos(ang + s * 0.5), B[1] - hl * math.sin(ang + s * 0.5))
                    dr.line([B, e], fill=c, width=lw)
        elif typ == "circle":
            _, x, y, rx, ry, ckey, at = it
            t0 = sc.at(at)
            if t < t0:
                continue
            X, Y = _pp(x, y)
            RX, RY = L.cw * rx, L.ch * ry
            pc = ease_io(clamp((t - t0) / 0.5))
            pts = [(X + RX * math.cos(a_) * (1 + 0.04 * math.sin(a_ * 3)), Y + RY * math.sin(a_))
                   for a_ in [(-0.4 + 2 * math.pi * 1.08 * k / 48) for k in range(49)]]
            _poly_progress(dr, pts, pc, rgba(col(ckey)), lw)
        elif typ == "under":
            _, x0, x1, y, ckey, at = it
            t0 = sc.at(at)
            if t < t0:
                continue
            A, B = _pp(x0, y), _pp(x1, y)
            pts = [A, ((A[0] + B[0]) / 2, A[1] + u(6)), B]
            _poly_progress(dr, pts, ease_io(clamp((t - t0) / 0.35)), rgba(col(ckey)), lw + 2)
        elif typ == "icon":
            _, kind, x, y, size, ckey, at = it
            p = pop(t, sc.at(at), 0.4)
            X, Y = _pp(x, y)
            put(fr, ico(kind, u(size), col(ckey)), X, Y, "mm", p, s=0.6 + 0.4 * back_out(p))
    _ = ink


def sfx_board(sc):
    return [(sc.at(it[-1]), "tick") for it in sc.d["items"] if it[0] in ("box", "arrow", "circle")]


# ── story ────────────────────────────────────────────
def k_story(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    p = pop(t, 0.05, 0.45)
    ch = L.ch * 0.96
    put(fr, box(int(L.cw), int(ch), u(30), T["card"], T["line"], 3, shadow=u(18)), L.cx, L.y0 + ch / 2, "mm", p, dy=30)
    if d.get("chapter"):
        put(fr, pill(d["chapter"], T["acc"], WHITE, u(28), fam="serif"), L.x0 + u(30), L.y0 + u(44), "lm", p)
    hx, hy = L.X(0.28), L.Y(0.48)
    r = u(118)
    hc = col(d.get("hero_color", "acc"))
    put(fr, disc(r, mix(hc, WHITE, 0.2)), hx, hy, "mm", p, s=0.8 + 0.2 * back_out(p))
    put(fr, ico(d.get("hero_icon", "person"), int(r * 1.15), WHITE), hx, hy + u(10), "mm", p, s=0.8 + 0.2 * back_out(p))
    put(fr, txt(d.get("hero", "A씨 (예시)"), u(34), "EB", T["fg"]), hx, hy + r + u(40), "mm", p)
    props = d.get("props", [])
    n = len(props)
    for k, (kind, label, at) in enumerate(props):
        pp = pop(t, sc.at(at), 0.4)
        px = L.X(0.73)
        py = L.Y(0.22 + (0.56 * k / max(1, n - 1) if n > 1 else 0.26))
        c = col(props[k][3]) if len(props[k]) > 3 else T["acc2"]
        put(fr, disc(u(60), c), px - u(90), py, "mm", pp, s=0.6 + 0.4 * back_out(pp))
        put(fr, ico(kind, u(64), WHITE), px - u(90), py, "mm", pp, s=0.6 + 0.4 * back_out(pp))
        put(fr, txt(label, u(32), "EB", T["fg"], maxw=u(250), lh=1.15), px - u(18), py, "lm", pp, dx=30)
    if d.get("bubble"):
        tx, at = d["bubble"]
        bp = pop(t, sc.at(at), 0.4)
        body = txt(tx, u(34), "B", T["fg"], maxw=u(360), align="c", lh=1.3)
        bw, bh = body.width + u(20), body.height + u(10)
        bx, by = hx + u(40), hy - r - bh / 2 - u(10)
        put(fr, box(int(bw), int(bh), u(26), WHITE, T["acc"], 3, shadow=u(10)), bx, by, "mm", bp, s=0.8 + 0.2 * back_out(bp))
        put(fr, body, bx, by, "mm", bp, s=0.8 + 0.2 * back_out(bp))


def sfx_story(sc):
    ev = [(sc.at(pr[2]), "pop") for pr in sc.d.get("props", [])]
    if sc.d.get("bubble"):
        ev.append((sc.at(sc.d["bubble"][1]), "pop"))
    return ev


# ── flow ─────────────────────────────────────────────
def k_flow(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    nodes = {}
    for nd in d["nodes"]:
        nid, text, x, y, ckey, at = nd[:6]
        q = nd[6] if len(nd) > 6 else False
        w = L.cw * (0.9 if q else 0.46)
        tt = txt(text, u(42), "EB", WHITE if not q else T["fg"], maxw=int(w - u(40)), align="c", lh=1.25)
        h = tt.height + u(26)
        nodes[nid] = (L.X(x), L.Y(y), w, h, tt, col(ckey), sc.at(at), q)
    dr = ImageDraw.Draw(fr)
    for a, b, label, at in d.get("edges", []):
        ax, ay, aw, ah = nodes[a][:4]
        bx, by, bw, bh = nodes[b][:4]
        t0 = sc.at(at)
        pe = ease_io(clamp((t - t0) / 0.4))
        if pe <= 0:
            continue
        A = (ax + (bx - ax) * 0.25, ay + ah / 2)
        B = (bx, by - bh / 2 - u(8))
        pts = [A, (A[0], (A[1] + B[1]) / 2), (B[0], (A[1] + B[1]) / 2), B]
        _poly_progress(dr, pts, pe, rgba(nodes[b][5]), max(4, u(6)))
        if label:
            put(fr, pill(label, nodes[b][5], WHITE, u(26)), (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, "mm", pe)
    for nid, (x, y, w, h, tt, c, t0, q) in nodes.items():
        p = pop(t, t0, 0.4)
        if q:
            put(fr, box(int(w), int(h), u(24), T["card"], c, 4, shadow=u(12)), x, y, "mm", p, dy=20)
        else:
            put(fr, box(int(w), int(h), u(24), c, shadow=u(12)), x, y, "mm", p, dy=20, s=0.85 + 0.15 * back_out(p))
        put(fr, tt, x, y, "mm", p, dy=20)


def sfx_flow(sc):
    return [(sc.at(nd[5]), "pop") for nd in sc.d["nodes"]]


# ── glossary ─────────────────────────────────────────
_GL = {}


def _gl_card(side, w, h, d):
    T = G.T
    key = (G.L.mode, G.ep["ep"], d["term"], side, w, h)
    if key in _GL:
        return _GL[key]
    im = box(w, h, u(40), T["card"] if side == "f" else WHITE, T["acc"], 4, shadow=u(18)).copy()
    m = (im.width - w) // 2
    ink = T["fg"] if side == "f" else (15, 23, 42)
    if side == "f":
        lab = pill(d.get("n", "용어"), T["acc"], (17, 24, 39) if T["dark"] else WHITE, u(30))
        im.alpha_composite(lab, (m + (w - lab.width) // 2, m + u(44)))
        ic = ico(d.get("icon", "doc"), u(120), T["acc"])
        im.alpha_composite(ic, (m + (w - ic.width) // 2, m + int(h * 0.26)))
        tt = txt(d["term"], u(96), "H", ink, fam=T["famt"])
        im.alpha_composite(tt, (m + (w - tt.width) // 2, m + int(h * 0.56)))
    else:
        tt = txt(d["term"], u(44), "H", (15, 118, 110), fam=T["famt"])
        im.alpha_composite(tt, (m + u(50) - 14, m + u(46)))
        bd = txt(d.get("def_") or d["def"], u(46), "B", ink, maxw=w - u(100), lh=1.35, hl=(15, 118, 110))
        im.alpha_composite(bd, (m + u(50) - 14, m + u(140)))
    _GL[key] = im
    return im


def k_glossary(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    w, h = int(L.cw * 0.94), int(min(u(640), L.ch * 0.98))
    cy = L.Y(0.5)
    for k in (2, 1):
        put(fr, box(w, h, u(40), mix(T["card"], T["bg"][0], 0.3 * k), T["line"], 2), L.cx + k * u(14), cy + k * u(18), "mm")
    t_f = sc.lt(1) - 0.2 if len(sc.lines) > 1 else 99
    p = pop(t, 0.05, 0.4)
    if t < t_f:
        put(fr, _gl_card("f", w, h, d), L.cx, cy, "mm", p, dx=L.W * 0.4)
    else:
        k = clamp((t - t_f) / 0.36)
        sx = abs(math.cos(math.pi * k))
        im = _gl_card("f" if k < 0.5 else "b", w, h, d)
        im = im.resize((max(2, int(im.width * max(0.02, sx))), im.height), Image.BILINEAR)
        put(fr, im, L.cx, cy, "mm")


def sfx_glossary(sc):
    return [(0.05, "whoosh"), (sc.lt(1) - 0.2, "pop")] if len(sc.lines) > 1 else [(0.05, "whoosh")]


# ── tutorial ─────────────────────────────────────────
def k_tutorial(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    p = pop(t, 0.05, 0.45)
    bw, bh = int(L.cw), int(L.ch * 0.98)
    top = L.y0
    put(fr, box(bw, bh, u(30), WHITE, (203, 213, 225), 2, shadow=u(18)), L.cx, top + bh / 2, "mm", p, dy=40)
    if p < 1:
        return
    dr = ImageDraw.Draw(fr)
    # 주소창
    dr.rounded_rectangle([L.x0, top, L.x1, top + u(96)], u(30), fill=(241, 245, 249, 255))
    dr.rectangle([L.x0, top + u(60), L.x1, top + u(96)], fill=(241, 245, 249, 255))
    for k, c in enumerate(((248, 113, 113), (251, 191, 36), (74, 222, 128))):
        put(fr, disc(u(10), c), L.x0 + u(34) + k * u(30), top + u(48), "mm")
    put(fr, box(int(bw - u(170)), u(56), u(28), WHITE), L.x0 + u(140) + (bw - u(170)) / 2, top + u(48), "mm")
    put(fr, ico("lock", u(26), (100, 116, 139)), L.x0 + u(170), top + u(48), "mm")
    put(fr, txt(d["url"], u(28), "B", (51, 65, 85), fam="square"), L.x0 + u(192), top + u(48), "lm")
    put(fr, txt(d.get("page", ""), u(42), "H", (15, 23, 42), fam="neo"), L.x0 + u(40), top + u(150), "lm")
    y = top + u(190)
    ink = (15, 23, 42)
    steps = d["steps"]
    cur_y = None
    for k, st in enumerate(steps):
        at, typ = st[0], st[1]
        t0 = sc.at(at)
        sp = pop(t, t0, 0.35)
        if typ in ("field", "select"):
            label, value = st[2], st[3]
            put(fr, txt(label, u(28), "B", (100, 116, 139), fam="square"), L.x0 + u(40), y, "lt")
            fy = y + u(40)
            dr.rounded_rectangle([L.x0 + u(40), fy, L.x1 - u(40), fy + u(78)], u(16), fill=(248, 250, 252, 255),
                                 outline=rgba(T["acc"] if 0 < sp else (203, 213, 225)), width=3)
            if t >= t0:
                nchar = int(len(value) * clamp((t - t0 - 0.15) / 0.7)) if typ == "field" else len(value)
                shown = value[:nchar]
                if shown:
                    put(fr, txt(shown, u(34), "B", ink, fam="square"), L.x0 + u(60), fy + u(39), "lm")
                if typ == "select":
                    ax_, ay_ = L.x1 - u(76), fy + u(39)
                    dr.polygon([(ax_ - u(12), ay_ - u(6)), (ax_ + u(12), ay_ - u(6)), (ax_, ay_ + u(8))],
                               fill=(100, 116, 139, 255))
            if 0 < sp:
                cur_y = fy + u(39)
            y = fy + u(100)
        elif typ == "button":
            label = st[2]
            pressed = t0 <= t < t0 + 0.25
            c = T["acc"] if not pressed else mix(T["acc"], (0, 0, 0), 0.25)
            dr.rounded_rectangle([L.x0 + u(40), y, L.x1 - u(40), y + u(88)], u(22), fill=rgba(c))
            put(fr, txt(label, u(36), "EB", WHITE, fam="square"), L.cx, y + u(44), "mm")
            if 0 < sp:
                cur_y = y + u(44)
            y += u(120)
        elif typ == "result":
            rows = st[2]
            if sp > 0:
                for j, row in enumerate(rows):
                    rp = pop(t, t0 + j * 0.25, 0.35)
                    put(fr, box(int(bw - u(80)), u(70), u(16), mix(T["acc"], WHITE, 0.88)), L.cx, y + u(35), "mm", rp, dy=20)
                    put(fr, txt(row, u(30), "B", ink, fam="square", maxw=int(bw - u(120))), L.x0 + u(64), y + u(35), "lm",
                        rp, dy=20)
                    y += u(84)
        if len(st) > 4 and st[4] and 0 < sp and (k == len(steps) - 1 or t < sc.at(steps[k + 1][0])):
            put(fr, pill(st[4], T["acc2"], WHITE, u(28)), L.x1 - u(20), (cur_y or y) - u(66), "rm", sp, s=0.8 + 0.2 * back_out(sp))
    if cur_y is not None:
        tap_t = t % 1.0
        put(fr, ring(int(u(26) + u(20) * tap_t), T["acc2"], 4), L.x1 - u(120), cur_y, "mm", alpha=1 - tap_t)
        put(fr, disc(u(18), rgba(T["acc2"], 200)), L.x1 - u(120), cur_y, "mm")


def sfx_tutorial(sc):
    ev = []
    for st in sc.d["steps"]:
        ev.append((sc.at(st[0]), "pop" if st[1] == "button" else "tick"))
    return ev


# ── sort ─────────────────────────────────────────────
def k_sort(fr, sc, t):
    L, T, d = G.L, G.T, sc.d
    bins = d["bins"]
    gap = u(24)
    bw = (L.cw - gap) / 2
    btop = L.Y(0.42)
    bh = L.y1 - btop
    for k, (label, ckey, kind) in enumerate(bins):
        c = col(ckey)
        x = L.x0 + bw / 2 + k * (bw + gap)
        p = pop(t, 0.1 + 0.12 * k, 0.4)
        put(fr, box(int(bw), int(bh), u(28), rgba(c, 40), c, 4), x, btop + bh / 2, "mm", p, dy=30)
        put(fr, pill(label, c, WHITE, u(30)), x, btop, "mm", p)
    counts = [0, 0]
    for k, (text, kind, b, at) in enumerate(d["items"]):
        t0 = sc.at(at)
        if t < t0:
            continue
        c = col(bins[b][1])
        chip = pill(text, T["card"], T["fg"], u(36), outline=c)
        sx, sy = L.cx, L.Y(0.14)
        slot = counts[b]
        counts[b] += 1
        tx = L.x0 + bw / 2 + b * (bw + gap)
        ty = btop + u(80) + slot * (chip.height + u(14))
        f = ease_io(clamp((t - t0 - 0.6) / 0.45))
        x, y = lerp(sx, tx, f), lerp(sy, ty, f) - math.sin(math.pi * f) * u(60)
        p = pop(t, t0, 0.3)
        s = lerp(1.25, 1.0 if chip.width < bw - 20 else (bw - 20) / chip.width, f)
        put(fr, chip, x, y, "mm", p, s=s)
        if f < 1:
            put(fr, ico(kind, u(80), c), sx, sy - u(90), "mm", p * (1 - f))


def sfx_sort(sc):
    ev = []
    for text, kind, b, at in sc.d["items"]:
        ev += [(sc.at(at), "pop"), (sc.at(at) + 1.0, "tick")]
    return ev


E.KINDS.update(hook=k_hook, cards=k_cards, count=k_count, quiz=k_quiz, mythfact=k_mythfact, chat=k_chat,
               interview=k_interview, versus=k_versus, calc=k_calc, timeline=k_timeline, calendar=k_calendar,
               news=k_news, kinetic=k_kinetic, board=k_board, story=k_story, flow=k_flow, glossary=k_glossary,
               tutorial=k_tutorial, sort=k_sort)
E.SFX.update(hook=sfx_hook, cards=sfx_cards, count=sfx_count, quiz=sfx_quiz, mythfact=sfx_mythfact, chat=sfx_chat,
             versus=sfx_versus, calc=sfx_calc, timeline=sfx_timeline, calendar=sfx_calendar, news=sfx_news,
             kinetic=sfx_kinetic, board=sfx_board, story=sfx_story, flow=sfx_flow, glossary=sfx_glossary,
             tutorial=sfx_tutorial, sort=sfx_sort)
