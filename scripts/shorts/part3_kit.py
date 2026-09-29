# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 Part 3 (EP21~EP36) 공통 키트
기획: docs/youtube_shorts_plan_part3.md

render_ep01.py(규격·TTS·BGM·ffmpeg)와 part2_kit.py(아이콘·카드·폰 UI·cue 싱크)를 그대로 쓰고,
Part 3 에서 추가한 요소를 모아 둔다.
  - 정보형 템플릿: hero(큰 아이콘), num_list(번호 카드), versus(2열 비교), vtimeline(세로 흐름)
  - 폰 화면: screen_checklist(체크 리스트), screen_chat(가명 상담방)
  - 편집 효과: 장면 전환 펀치 줌, 상단 진행 바, 시리즈 칩("회생 노트 N")
  - 효과음: 직접 합성한 whoosh/pop/thump/ding (저작권 이슈 없음)을 cue 시점에 믹스
  - endcard(): 마지막 장면 캡션을 쓰는 EP01 엔드카드 (장면 수와 무관)
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pydub import AudioSegment

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
import part2_kit as kit2  # noqa: E402
from part2_kit import *  # noqa: E402,F401,F403
from part2_kit import (  # noqa: E402
    W, H, K, SW, SH, CAP_X, NAVY, TEAL, TEAL_L, TEAL_D, BLUE, WHITE, RED, GREEN,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    AMBER, CARD, CARD_HL, Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color,
    draw_caption, overlay, comp, place, radial, new_frame, zoom_rgba, pop, cue, icon,
    s_header, s_tag, s_button, s_toast, s_check_row, s_bubble, s_icon, avatar, check_icon,
)

CX = 504                 # 콘텐츠 중심 x (우측 15% 세이프존 고려)
X0, X1 = 90, 918         # 콘텐츠 좌우 경계
BORDER = (51, 65, 85)
SERIES = "회생 노트"

NUM = [0]
STARTS = []
TOTAL = [1.0]


# ── 장면 공통 ────────────────────────────────────────────
def finish(frame, i, t, dur, z=0.03, cy=1000):
    """느린 줌 + 캡션"""
    if z:
        frame = zoom_rgba(frame, 1.0 + z * ease_in_out(t / dur), CX, cy)
    draw_caption(frame, base.SCENES[i]["caption"], t)
    return frame


def series_chip(frame, num):
    ov, d = overlay()
    f = font("EB", 28)
    label = f"{SERIES} {num}"
    tw = d.textlength(label, font=f)
    x, y = CAP_X, 158
    d.rounded_rectangle([x, y, x + tw + 64, y + 50], 25, fill=(13, 148, 136, 70), outline=(45, 212, 191, 150), width=2)
    d.ellipse([x + 18, y + 19, x + 30, y + 31], fill=(45, 212, 191, 255))
    d.text((x + 42, y + 25), label, font=f, fill=SLATE100 + (255,), anchor="lm")
    frame.alpha_composite(ov)


def progress_bar(frame, p):
    d = ImageDraw.Draw(frame)
    d.rectangle([0, 0, W, 9], fill=(15, 36, 64, 255))
    d.rectangle([0, 0, int(W * clamp(p)), 9], fill=(45, 212, 191, 255))


def _wrap(i, fn, n):
    def render(t, dur):
        fr = fn(t, dur)
        if fr.mode != "RGBA":
            fr = fr.convert("RGBA")
        if i > 0 and t < 0.24:   # 컷 전환 펀치 줌
            fr = zoom_rgba(fr, 1.0 + 0.045 * (1 - ease_out(t / 0.24)), W / 2, H / 2)
        if i < n - 1:
            series_chip(fr, NUM[0])
        st = STARTS[i] if i < len(STARTS) else 0
        progress_bar(fr, (st + t) / TOTAL[0])
        return fr
    return render


# ── 엔드카드 (마지막 장면 캡션 사용) ──────────────────────────
def endcard(t, dur):
    frame = base.background().copy().convert("RGBA")
    d = ImageDraw.Draw(frame)
    p = ease_out(t / 0.45)
    size = 300
    tile = base.logo_tile(size)
    sc = 0.85 + 0.15 * p
    tl = tile.resize((int(size * sc), int(size * sc)), Image.LANCZOS)
    tl.putalpha(tl.getchannel("A").point(lambda v: int(v * p)))
    frame.alpha_composite(tl, (int(W / 2 - tl.width / 2), int(330 + size / 2 - tl.height / 2)))
    d.text((W / 2, 690), "마이김변", font=font("EB", 44), fill=WHITE, anchor="mm")
    draw_caption(frame, base.SCENES[-1]["caption"], max(0, t - 0.2), center=True, y0=790)
    cp = ease_out((t - 0.7) / 0.4)
    if cp > 0:
        pulse = 1 + 0.025 * math.sin(max(0, t - 1.2) * 5)
        bw, bh = 780 * pulse, 132 * pulse
        cy = 1150 + (1 - cp) * 30
        btn, bd = overlay()
        bd.rounded_rectangle([W / 2 - bw / 2, cy - bh / 2, W / 2 + bw / 2, cy + bh / 2], 34, fill=BLUE + (int(255 * cp),))
        bd.text((W / 2, cy - 2), "프로필 링크 → 익명 채무 체크", font=font("EB", 46),
                fill=(255, 255, 255, int(255 * cp)), anchor="mm")
        frame.alpha_composite(btn)
        d.text((W / 2, 1262), "mykim.kr/check", font=font("B", 34), fill=SLATE300, anchor="mm")
    f = font("R", 30)
    y = 1350
    d.line([(140, y - 24), (W - 140, y - 24)], fill=SLATE700, width=2)
    for ln in base.wrap(d, base.DISCLAIMER, f, 800):
        d.text((W / 2, y), ln, font=f, fill=SLATE300, anchor="ma")
        y += 44
    return frame


# ── 그래픽 부품 ─────────────────────────────────────────
@lru_cache(maxsize=None)
def disc_img(r, color, ring=True):
    S = 2
    R = r * S
    im = Image.new("RGBA", (2 * R + 8, 2 * R + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([4, 4, 4 + 2 * R, 4 + 2 * R], fill=color + (255,))
    if ring:
        hl = lerp_color(color, WHITE, 0.28)
        d.ellipse([4 + R * 0.12, 4 + R * 0.12, 4 + R * 1.88, 4 + R * 1.88], outline=hl + (255,), width=max(2, int(R * 0.04)))
    return im.resize((im.width // S, im.height // S), Image.LANCZOS)


def hero(frame, t, kind, color, cx=CX, cy=1010, r=170, t0=0.1, pulse=True, icol=WHITE, glow=70):
    """큰 원형 아이콘 (스케일 인 + 맥동 링)"""
    p = pop(t, t0, 0.45)
    if p <= 0:
        return
    frame.alpha_composite(with_alpha(radial(W, H, int(cx), int(cy), int(r * 2.3), color, glow), p))
    if pulse:
        for k in range(2):
            q = ((t - t0) * 0.7 + k * 0.5) % 1
            ov, d = overlay()
            rr = r * (1.0 + 0.55 * q)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=color + (int(150 * (1 - q) * p),), width=5)
            frame.alpha_composite(ov)
    disc = disc_img(int(r), color)
    place(frame, disc, cx, cy, p, dy=0, s0=0.6)
    place(frame, icon(kind, int(r * 1.05), icol), cx, cy, p, dy=0, s0=0.6)


with_alpha = kit2.with_alpha


@lru_cache(maxsize=None)
def pill_img(text, color, size=34, fg=WHITE, pad=30, h=None):
    S = 2
    f = font("EB", size * S)
    tw = ImageDraw.Draw(Image.new("L", (1, 1))).textlength(text, font=f) / S
    hh = h or int(size * 1.9)
    w = int(tw + pad * 2)
    im = Image.new("RGBA", (w * S, hh * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, hh * S - 1], hh * S // 2, fill=color + (255,))
    d.text((w * S / 2, hh * S / 2), text, font=f, fill=fg + (255,), anchor="mm")
    return im.resize((w, hh), Image.LANCZOS)


@lru_cache(maxsize=None)
def num_card_img(w, h, num, title, sub, accent, state="on", tsize=40, ssize=27):
    """번호 카드. state: on(강조) | done(지나간 항목) | bad(경고)"""
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    on = state in ("on", "bad")
    fill = CARD_HL if state == "on" else ((58, 30, 40) if state == "bad" else CARD)
    oc = accent if on else BORDER
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 30 * S, fill=fill + (255,), outline=oc + (255,), width=(4 if on else 2) * S)
    r = min(40, h * 0.3)
    cy = h / 2
    ccol = accent if on else lerp_color(accent, CARD, 0.45)
    d.ellipse([30 * S, (cy - r) * S, (30 + 2 * r) * S, (cy + r) * S], fill=ccol + (255,))
    if len(num) <= 2:
        d.text(((30 + r) * S, cy * S), num, font=font("EB", int(r * 1.1) * S), fill=WHITE, anchor="mm")
    else:
        ic = icon(num, int(r * 1.1 * S), WHITE)
        im.alpha_composite(ic, (int((30 + r) * S - ic.width / 2), int(cy * S - ic.height / 2)))
    x = 30 + 2 * r + 26
    tcol = WHITE if on else SLATE200
    scol = SLATE200 if on else SLATE400
    if sub:
        d.text((x * S, (h / 2 - 6) * S), title, font=font("EB", tsize * S), fill=tcol, anchor="ls")
        d.text((x * S, (h / 2 + 10) * S), sub, font=font("B", ssize * S), fill=scol, anchor="lt")
    else:
        d.text((x * S, h / 2 * S), title, font=font("EB", tsize * S), fill=tcol, anchor="lm")
    return im.resize((w, h), Image.LANCZOS)


def num_list(frame, t, items, times, y0=700, h=132, gap=22, states=None, x0=X0, w=X1 - X0):
    """items: ((번호|아이콘, 제목, 설명, 강조색), ...). times: 항목별 등장 시점.
    기본: 가장 최근 등장 항목만 강조(on), 이전 항목은 done."""
    shown = [k for k, t0 in enumerate(times) if t >= t0]
    last = shown[-1] if shown else -1
    for k, (num, title, sub, col) in enumerate(items):
        if t < times[k]:
            continue
        st = states[k] if states else ("on" if k == last else "done")
        img = num_card_img(w, h, num, title, sub, col, st)
        place(frame, img, x0 + w / 2, y0 + k * (h + gap) + h / 2, pop(t, times[k], 0.4), dy=36)


@lru_cache(maxsize=None)
def vbox_img(w, h, text, sub, color, win):
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fill = CARD_HL if win else CARD
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 26 * S, fill=fill + (255,),
                        outline=(color if win else BORDER) + (255,), width=(4 if win else 2) * S)
    if sub:
        d.text((w / 2 * S, (h / 2 - 4) * S), text, font=font("EB", 36 * S), fill=WHITE, anchor="ms")
        d.text((w / 2 * S, (h / 2 + 12) * S), sub, font=font("B", 25 * S), fill=SLATE300, anchor="mt")
    else:
        d.text((w / 2 * S, h / 2 * S), text, font=font("EB", 36 * S), fill=WHITE, anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


def versus(frame, t, heads, rows, times, y0=640, row_h=196, box_h=118, t_head=0.1):
    """heads: ((제목, 색), (제목, 색)). rows: ((라벨, (왼쪽, 설명), (오른쪽, 설명), 'L'|'R'|None), ...)"""
    cw = (X1 - X0 - 20) // 2
    lx, rx = X0 + cw / 2, X1 - cw / 2
    hp = pop(t, t_head, 0.4)
    for k, (title, col) in enumerate(heads):
        place(frame, pill_img(title, col, 38, h=76), lx if k == 0 else rx, y0 + 38, hp, dy=24)
    if hp > 0:
        place(frame, pill_img("VS", SLATE900, 26, fg=SLATE200, pad=18, h=56), CX, y0 + 38, hp, dy=0, s0=0.5)
    for k, (label, left, right, win) in enumerate(rows):
        if t < times[k]:
            continue
        p = pop(t, times[k], 0.4)
        y = y0 + 110 + k * row_h
        ov, d = overlay()
        d.text((CX, y + 18), label, font=font("B", 28), fill=SLATE300 + (255,), anchor="mm")
        d.line([(X0 + 10, y + 18), (CX - d.textlength(label, font=font("B", 28)) / 2 - 20, y + 18)], fill=BORDER + (255,), width=2)
        d.line([(CX + d.textlength(label, font=font("B", 28)) / 2 + 20, y + 18), (X1 - 10, y + 18)], fill=BORDER + (255,), width=2)
        comp(frame, ov, p)
        for side, (txt, sub) in (("L", left), ("R", right)):
            col = heads[0][1] if side == "L" else heads[1][1]
            won = side in (win or "")
            img = vbox_img(cw, box_h, txt, sub, col, won)
            place(frame, img, lx if side == "L" else rx, y + 50 + box_h / 2, p, dy=30)
            if won and p > 0.6:
                bx = (lx if side == "L" else rx) + cw / 2 - 26
                place(frame, disc_img(22, col, False), bx, y + 50, pop(t, times[k] + 0.25, 0.3), dy=0, s0=0.4)
                place(frame, icon("check", 26, WHITE), bx, y + 50, pop(t, times[k] + 0.25, 0.3), dy=0, s0=0.4)


def vtimeline(frame, t, steps, times, x=170, y0=660, gap=180, line_col=TEAL):
    """steps: ((제목, 설명, 아이콘, 색), ...). 연결선은 다음 단계 등장 직전에 그려진다."""
    for k in range(len(steps) - 1):
        if t < times[k]:
            continue
        a = times[k] + 0.2
        b = max(a + 0.1, times[k + 1] - 0.05)
        q = clamp((t - a) / (b - a))
        if q > 0:
            ov, d = overlay()
            ya, yb = y0 + k * gap + 46, y0 + (k + 1) * gap - 46
            d.line([(x, ya), (x, lerp(ya, yb, ease_in_out(q)))], fill=line_col + (255,), width=8)
            frame.alpha_composite(ov)
    for k, (title, sub, kind, col) in enumerate(steps):
        if t < times[k]:
            continue
        p = pop(t, times[k], 0.4)
        y = y0 + k * gap
        place(frame, disc_img(46, col), x, y, p, dy=0, s0=0.5)
        place(frame, icon(kind, 48, WHITE), x, y, p, dy=0, s0=0.5)
        ov, d = overlay()
        d.text((x + 82, y - 6), title, font=font("EB", 42), fill=WHITE + (255,), anchor="ls")
        if sub:
            d.text((x + 82, y + 14), sub, font=font("B", 28), fill=SLATE300 + (255,), anchor="lt")
        comp(frame, ov, p, (lerp(-30, 0, p), 0))


def footnote(frame, lines, t, t0=0.3, y=1438):
    kit2.footnote(frame, lines, t, t0, y)


# ── 폰 화면 ────────────────────────────────────────────
def screen_checklist(t, title, heading, sub, rows, marks, tag=None, result=None, t_result=None,
                     btn=None, t_ready=None, t_tap=None, toast=None, t_toast=None, row_h=104, y0=290):
    """rows: ((라벨, 설명), ...), marks: 행별 체크 시점. result: (제목, 설명) 요약 박스.
    toast: (제목, 설명, 아이콘)"""
    s = Scr(SLATE50)
    s_header(s, title)
    s.text(36, 200, heading, 34, SLATE900, "EB", "lm")
    if sub:
        s.text(36, 246, sub, 21, SLATE500, "B", "lm")
    if tag:
        s_tag(s, SW - 36, 182, tag, TEAL_L, TEAL_D, 19, 36, anchor="r")
    for k, ((lab, sb), m) in enumerate(zip(rows, marks)):
        s_check_row(s, y0 + k * (row_h + 14), lab, sb, pop(t, m, 0.3), h=row_h)
    y = y0 + len(rows) * (row_h + 14) + 10
    if result and t_result is not None and t >= t_result:
        p = pop(t, t_result, 0.35)
        yy = y + (1 - p) * 20
        s.rr(28, yy, SW - 28, yy + 124, 26, fill=lerp_color(SLATE50, NAVY, p))
        s.circ(84, yy + 62, 30, fill=lerp_color(NAVY, TEAL, p))
        s_icon(s, "shield", 84, yy + 62, 34, WHITE, p)
        s.text(132, yy + 44, result[0], 24, lerp_color(NAVY, WHITE, p), "EB", "lm")
        s.text(132, yy + 84, result[1], 19, lerp_color(NAVY, SLATE300, p), "B", "lm")
    if btn:
        pressed = t_tap is not None and t_tap <= t < t_tap + 0.25
        state = "pressed" if pressed else ("on" if (t_ready is not None and t >= t_ready) else "off")
        s_button(s, 1004, btn, state, h=92)
    if toast and t_toast is not None:
        s_toast(s, t, t_toast, toast[0], toast[1], kind=toast[2] if len(toast) > 2 else "check")
    return s.final()


def screen_chat(t, msgs, times, room="가명 상담방", who="변호사 B", alias="단단한 바위 71"):
    """msgs: (('me'|'them', (줄, ...)), ...)"""
    s = Scr(SLATE100)
    s.rr(0, 0, SW, 176, 0, fill=WHITE)
    s.status()
    s.line([(48, 112), (34, 126), (48, 140)], SLATE900, 5)
    avatar(s, 100, 126, 26, (204, 251, 241), (45, 212, 191))
    s.text(140, 112, who, 26, SLATE900, "EB", "lm")
    s.text(140, 146, f"{room} · 내 이름: {alias}", 18, SLATE500, "B", "lm")
    s.line([(0, 176), (SW, 176)], SLATE200, 2)
    y = 206
    s_tag(s, SW / 2 - 110, y, "010 번호 비공개 상담", SLATE200, SLATE700, 17, 34)
    y += 60
    for (side, lines), t0 in zip(msgs, times):
        p = pop(t, t0, 0.35)
        if p <= 0:
            break
        y += s_bubble(s, side, list(lines), y, p, name=who if side == "them" else None)
    s.rr(20, SH - 110, SW - 20, SH - 40, 35, fill=WHITE, outline=SLATE200, width=2)
    s.text(50, SH - 75, "메시지 입력", 21, SLATE400, "B", "lm")
    return s.final()


# ── 효과음 (직접 합성) ────────────────────────────────────
SR = 44100


@lru_cache(maxsize=None)
def _sfx(kind):
    rng = np.random.default_rng(3)
    if kind == "pop":
        n = int(0.14 * SR)
        tt = np.arange(n) / SR
        f = 520 + 520 * np.exp(-tt * 30)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 34) * 0.42
    elif kind == "tick":
        n = int(0.06 * SR)
        tt = np.arange(n) / SR
        y = np.sin(2 * np.pi * 1850 * tt) * np.exp(-tt * 90) * 0.28
    elif kind == "whoosh":
        n = int(0.42 * SR)
        tt = np.arange(n) / SR
        noise = rng.normal(0, 1, n)
        k = np.ones(18) / 18
        noise = np.convolve(noise, k, mode="same") - np.convolve(noise, np.ones(90) / 90, mode="same")
        env = np.sin(np.pi * np.clip(tt / 0.42, 0, 1)) ** 2.2
        y = noise * env * 0.55
    elif kind == "thump":
        n = int(0.3 * SR)
        tt = np.arange(n) / SR
        f = 70 + 90 * np.exp(-tt * 25)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 14) * 0.8
        y[: int(0.006 * SR)] += rng.normal(0, 0.25, int(0.006 * SR))
    elif kind == "ding":
        n = int(1.0 * SR)
        tt = np.arange(n) / SR
        y = (np.sin(2 * np.pi * 1318.5 * tt) + 0.45 * np.sin(2 * np.pi * 1975.5 * tt)) * np.exp(-tt * 4.5) * 0.2
        y *= np.minimum(1, tt / 0.004)
    elif kind == "alert":
        n = int(0.32 * SR)
        tt = np.arange(n) / SR
        y = np.sin(2 * np.pi * 330 * tt) * (np.sin(2 * np.pi * 14 * tt) > 0) * np.exp(-tt * 7) * 0.22
    else:
        raise ValueError(kind)
    pcm = (np.clip(y, -1, 1) * 32767).astype(np.int16)
    return AudioSegment(pcm.tobytes(), frame_rate=SR, sample_width=2, channels=1).set_channels(2)


GAIN = {"pop": -9, "tick": -10, "whoosh": -13, "thump": -6, "ding": -11, "alert": -10}


def _mix_sfx(wav, starts, sfx, n):
    mix = AudioSegment.from_file(wav)
    events = []
    for i in range(1, n):
        events.append((max(0.0, starts[i] - 0.16), "whoosh"))
    events.append((starts[n - 1] + 0.35, "ding"))
    for si, key, kind in sfx:
        off = cue(si, key) if isinstance(key, str) else float(key)
        events.append((starts[si] + off, kind))
    for at, kind in events:
        mix = mix.overlay(_sfx(kind) + GAIN[kind], position=int(at * 1000))
    mix.export(wav, format="wav")
    print(f"  효과음 {len(events)}개 믹스")


# ── 실행 ────────────────────────────────────────────────
def run(ep, scenes, renderers, meta, sfx=(), keep_work=False):
    import shutil
    NUM[0] = int(ep[2:])
    base.EP = ep
    base.OUT = base.ROOT / "assets" / "shorts" / ep
    base.TMP = base.OUT / "_work"
    base.SCENES = scenes
    n = len(renderers)
    base.RENDERERS = [_wrap(i, r, n) for i, r in enumerate(renderers)]
    orig = base.build_audio

    def patched():
        durs, starts, vos, wav = orig()
        kit2.DUR[:] = durs
        kit2.VO[:] = vos
        STARTS[:] = starts
        TOTAL[0] = sum(durs)
        print("  내레이션 길이:", [f"{v:.2f}" for v in vos])
        _mix_sfx(wav, starts, sfx, n)
        return durs, starts, vos, wav

    base.build_audio = patched
    try:
        base.main()
    finally:
        base.build_audio = orig
    kit2.write_upload(ep, meta)
    if not keep_work:
        shutil.rmtree(base.TMP, ignore_errors=True)
