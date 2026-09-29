# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP10 렌더러
기획: docs/youtube_shorts_plan.md  #10 "인가 받고 끝이 아닙니다"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
출력: assets/shorts/ep10/
실행: python scripts/shorts/render_ep10.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, K, SW, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, WHITE, RED, GREEN,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, check_icon, scene5 as ep01_endcard,
)

EP = "ep10"

SCENES = [
    dict(plan=3.0, caption="인가 받으면\n[끝일까?]",
         narration="개인회생, 인가 받으면 끝일까요?",
         tts="개인회생, 인가 받으면 끝일까요?"),
    dict(plan=6.0, caption="진짜는\n[변제기간]",
         narration="실제로는 그다음부터 변제기간이 시작돼요.",
         tts="실제로는 그다음부터 변제기간이 시작돼요."),
    dict(plan=9.0, caption="미납이 이어지면\n[위험]",
         narration="납부를 계속 놓치면 절차가 폐지될 수 있어서, 매달 날짜를 챙기는 게 중요해요.",
         tts="납부를 계속 놓치면 절차가 폐지될 수 있어서, 매달 날짜를 챙기는 게 중요해요."),
    dict(plan=8.0, caption="납부일 알림·\n[미납 경고]",
         narration="마이김변 회생동행 캘린더는 납부일을 알려 주고, 미납이 생기면 먼저 경고해요.",
         tts="마이김변 회생동행 캘린더는 납부일을 알려 주고, 미납이 생기면 먼저 경고해요."),
    dict(plan=6.0, caption="납부일, [끝까지]\n같이 챙기세요",
         narration="인가 다음 날부터, 끝까지 같이 챙기세요.",
         tts="인가 다음 날부터, 끝까지 같이 챙기세요."),
]

AMBER = (0xF5, 0x9E, 0x0B)
RED_D = (0xB9, 0x1C, 0x1C)
RED_50 = (0xFE, 0xF2, 0xF2)


def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


@lru_cache(maxsize=64)
def radial(w, h, cx, cy, r, color, alpha):
    """원형 광원 RGBA 레이어"""
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(1 - dist, 0, 1) ** 2 * alpha
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def with_alpha(img, p):
    if p >= 1:
        return img
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: int(v * p)))
    return img


# ── 장면 1: 넘어가는 달력 (인가 도장 → 빠른 컷) ─────────────────
PAGE_W, PAGE_H = 560, 600
CAL_X, CAL_Y = (W - PAGE_W) // 2, 780
STAMP_AT = 1.05      # 내레이션 '인가' 시점
FLIP0 = 1.75         # 첫 장 넘김


def flip_times():
    ts, t, d = [], FLIP0, 0.30
    while t < 3.6:
        ts.append(t)
        t += d
        d = max(0.11, d * 0.8)
    return ts


FLIPS = flip_times()


@lru_cache(maxsize=None)
def page_img(idx):
    """달력 한 장 (idx 0 = 인가 결정 페이지). 날짜는 모두 예시"""
    S = 2
    im = Image.new("RGBA", (PAGE_W * S, PAGE_H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, PAGE_W * S - 1, PAGE_H * S - 1], 36 * S, fill=WHITE + (255,))
    band = TEAL if idx == 0 else RED
    d.rounded_rectangle([0, 0, PAGE_W * S - 1, 170 * S], 36 * S, fill=band + (255,))
    d.rectangle([0, 130 * S, PAGE_W * S - 1, 170 * S], fill=band + (255,))
    label = "인가 결정" if idx == 0 else f"{(4 + idx) % 12 + 1}월"
    d.text((PAGE_W * S / 2, 88 * S), label, font=font("EB", 64 * S), fill=WHITE, anchor="mm")
    # 미니 달력
    colw = (PAGE_W - 60) / 7
    start = (idx * 2 + 3) % 7
    for day in range(1, 31):
        pos = start + day - 1
        r, c = divmod(pos, 7)
        cx = 30 + colw * (c + 0.5)
        cy = 225 + r * 70
        if day == 25:
            d.ellipse([(cx - 28) * S, (cy - 28) * S, (cx + 28) * S, (cy + 28) * S], fill=TEAL + (255,))
            d.text((cx * S, cy * S), str(day), font=font("EB", 28 * S), fill=WHITE, anchor="mm")
        else:
            d.text((cx * S, cy * S), str(day), font=font("B", 26 * S), fill=SLATE400, anchor="mm")
    if idx == 0:
        pass  # 도장은 scene1 에서 애니메이션
    return im.resize((PAGE_W, PAGE_H), Image.LANCZOS)


@lru_cache(maxsize=None)
def stamp_img():
    S = 2
    sz = 280
    im = Image.new("RGBA", (sz * S, sz * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([10 * S, 10 * S, (sz - 10) * S, (sz - 10) * S], outline=TEAL_D + (255,), width=12 * S)
    d.ellipse([34 * S, 34 * S, (sz - 34) * S, (sz - 34) * S], outline=TEAL_D + (255,), width=4 * S)
    d.text((sz * S / 2, sz * S / 2), "인가", font=font("EB", 92 * S), fill=TEAL_D + (255,), anchor="mm")
    im = im.resize((sz, sz), Image.LANCZOS).rotate(-14, resample=Image.BICUBIC, expand=True)
    return with_alpha(im, 0.92)


@lru_cache(maxsize=None)
def calendar_base():
    """페이지 아래 쌓인 종이 + 바인더"""
    ov, d = overlay()
    for k in (3, 2, 1):
        d.rounded_rectangle([CAL_X + k * 4, CAL_Y + k * 12, CAL_X + PAGE_W - k * 4, CAL_Y + PAGE_H + k * 12], 36,
                            fill=lerp_color(SLATE300, SLATE500, k / 3) + (255,))
    return ov


@lru_cache(maxsize=None)
def binder():
    ov, d = overlay()
    d.rounded_rectangle([CAL_X - 20, CAL_Y - 46, CAL_X + PAGE_W + 20, CAL_Y + 10], 18, fill=(30, 41, 59, 255))
    for i in range(7):
        cx = CAL_X + 50 + i * (PAGE_W - 100) / 6
        d.rounded_rectangle([cx - 9, CAL_Y - 70, cx + 9, CAL_Y + 26], 9, fill=SLATE300 + (255,))
    return ov


def scene1(t, dur):
    frame = background().copy().convert("RGBA")
    frame.alpha_composite(radial(W, H, 540, 1100, 700, (59, 130, 246), 50))
    frame.alpha_composite(calendar_base())
    n = sum(1 for ft in FLIPS if ft <= t)
    frame.alpha_composite(page_img(n), (CAL_X, CAL_Y))
    if n == 0 and t >= STAMP_AT:
        p = ease_out((t - STAMP_AT) / 0.22)
        st = stamp_img()
        sc = 1.6 - 0.6 * p
        im = with_alpha(st.resize((int(st.width * sc), int(st.height * sc)), Image.LANCZOS), p)
        frame.alpha_composite(im, (int(CAL_X + PAGE_W * 0.62 - im.width / 2), int(CAL_Y + 400 - im.height / 2)))
    # 넘어가는 페이지 (최근 2장)
    for k in range(max(0, n - 2), n):
        f = (t - FLIPS[k]) / 0.34
        if not 0 <= f < 1:
            continue
        pg = page_img(k)
        if k == 0:
            pg = pg.copy()
            st = stamp_img()
            pg.alpha_composite(st, (int(PAGE_W * 0.62 - st.width / 2), int(400 - st.height / 2)))
        e = ease_in_out(f)
        rot = pg.rotate(-22 * e, resample=Image.BICUBIC, expand=True)
        rot = with_alpha(rot, 1 - f ** 2)
        x = CAL_X + PAGE_W / 2 + 720 * e - rot.width / 2
        y = CAL_Y + PAGE_H / 2 - 160 * e - rot.height / 2
        frame.alpha_composite(rot, (int(x), int(y)))
    frame.alpha_composite(binder())
    frame = zoom(frame.convert("RGB"), 1.0 + 0.06 * ease_in_out(t / dur), W / 2, H).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 끝없이 이어지는 달력 칸 ────────────────────────────
COLS, CW, CH, GAP = 3, 250, 180, 24
GRID_Y = 720


@lru_cache(maxsize=None)
def fade_mask():
    y = np.arange(H, dtype=np.float32)
    a = np.clip((y - 600) / 170, 0, 1) * np.clip((1860 - y) / 360, 0, 1)
    arr = np.repeat((a * 255).astype(np.uint8)[:, None], W, axis=1)
    return Image.fromarray(arr, "L")


def scroll_px(t):
    return 70 * t + 42 * t * t


def scene2(t, dur):
    frame = background().copy().convert("RGBA")
    ov, d = overlay()
    off = scroll_px(t)
    pitch = CH + GAP
    r0 = max(0, int((off - 200) / pitch))
    fm, fs = font("EB", 42), font("B", 26)
    for r in range(r0, r0 + 10):
        y = GRID_Y + r * pitch - off
        if y > H:
            break
        for c in range(COLS):
            i = r * COLS + c
            x = CAP_X + c * (CW + GAP)
            if i == 0:
                d.rounded_rectangle([x, y, x + CW, y + CH], 28, fill=TEAL + (255,))
                d.text((x + 28, y + 30), "인가", font=fm, fill=WHITE + (255,))
                d.text((x + 28, y + 110), "여기서 시작", font=fs, fill=TEAL_L + (255,))
                continue
            done = y + CH / 2 < 1080
            fill = (22, 62, 88) if done else (28, 50, 82)
            line = TEAL if done else (60, 86, 120)
            d.rounded_rectangle([x, y, x + CW, y + CH], 28, fill=fill + (255,), outline=line + (255,), width=3)
            d.text((x + 28, y + 30), f"{(i - 1) % 12 + 1}월", font=fm, fill=WHITE + (255,))
            d.text((x + 28, y + 110), "변제금 납부", font=fs, fill=(SLATE300 if done else SLATE400) + (255,))
            if done:
                cx, cy = x + CW - 50, y + 52
                d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=TEAL + (255,))
                d.line([(cx - 12, cy), (cx - 3, cy + 10), (cx + 13, cy - 10)], fill=WHITE + (255,), width=6, joint="curve")
    ov.putalpha(ImageChops.multiply(ov.getchannel("A"), fade_mask()))
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 경고 아이콘 + 미납 칸 ──────────────────────────────
# 내레이션 실측 기준 시점(초, 장면 내)
MISS_AT = [0.4, 0.75, 1.1]    # '납부를 계속 놓치면'
REPEAL_AT = 1.4                 # '절차가 폐지될 수 있어서'
MONTHLY_AT = 3.4                 # '매달 날짜를 챙기는 게'


@lru_cache(maxsize=None)
def warn_icon(sz=300):
    S = 2
    im = Image.new("RGBA", (sz * S, sz * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = 26 * S
    pts = [(sz * S / 2, m), (sz * S - m, sz * S * 0.9 - m / 2), (m, sz * S * 0.9 - m / 2)]
    d.polygon(pts, fill=AMBER + (255,))
    d.line(pts + [pts[0]], fill=AMBER + (255,), width=40 * S, joint="curve")
    cx = sz * S / 2
    d.rounded_rectangle([cx - 17 * S, sz * S * 0.30, cx + 17 * S, sz * S * 0.62], 17 * S, fill=NAVY_D + (255,))
    d.ellipse([cx - 20 * S, sz * S * 0.68, cx + 20 * S, sz * S * 0.68 + 40 * S], fill=NAVY_D + (255,))
    return im.resize((sz, sz), Image.LANCZOS)


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    # 경고 아이콘 + 맥동 광원
    ga = int(60 + 50 * (0.5 + 0.5 * math.sin(t * 4))) // 10 * 10
    frame.alpha_composite(radial(W, H, 540, 760, 420, (245, 158, 11), ga))
    p = ease_out(t / 0.4)
    ic = warn_icon()
    sc = (0.6 + 0.4 * p) * (1 + 0.035 * math.sin(t * 4))
    im = with_alpha(ic.resize((int(ic.width * sc), int(ic.height * sc)), Image.LANCZOS), p)
    frame.alpha_composite(im, (int(540 - im.width / 2), int(770 - im.height / 2)))

    ov, d = overlay()
    # 납부 칸 5개: 2개 납부 → 3개 미납
    cw, ch, gap, y0 = 140, 130, 22, 960
    for i in range(5):
        x = CAP_X + i * (cw + gap)
        if i < 2:
            d.rounded_rectangle([x, y0, x + cw, y0 + ch], 24, fill=(22, 62, 88, 255), outline=TEAL + (255,), width=3)
            d.text((x + cw / 2, y0 + 36), f"{i + 1}월", font=font("EB", 30), fill=WHITE + (255,), anchor="mm")
            cx, cy = x + cw / 2, y0 + 88
            d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=TEAL + (255,))
            d.line([(cx - 10, cy), (cx - 2, cy + 8), (cx + 11, cy - 9)], fill=WHITE + (255,), width=5, joint="curve")
            continue
        mp = ease_out((t - MISS_AT[i - 2]) / 0.25)
        shake = math.sin((t - MISS_AT[i - 2]) * 60) * 8 * (1 - mp) if 0 < mp < 1 else 0
        x += shake
        fill = lerp_color((28, 50, 82), (127, 29, 29), mp)
        line = lerp_color((60, 86, 120), RED, mp)
        d.rounded_rectangle([x, y0, x + cw, y0 + ch], 24, fill=fill + (255,), outline=line + (255,), width=3)
        d.text((x + cw / 2, y0 + 36), f"{i + 1}월", font=font("EB", 30), fill=WHITE + (255,), anchor="mm")
        cx, cy = x + cw / 2, y0 + 88
        if mp > 0:
            s = 13 * mp
            d.line([(cx - s, cy - s), (cx + s, cy + s)], fill=(254, 202, 202, 255), width=6)
            d.line([(cx - s, cy + s), (cx + s, cy - s)], fill=(254, 202, 202, 255), width=6)
        else:
            d.text((cx, cy), "?", font=font("EB", 30), fill=SLATE400 + (255,), anchor="mm")
    # 폐지 위험 박스
    rp = ease_out((t - REPEAL_AT) / 0.4)
    if rp > 0:
        a = int(255 * rp)
        y = 1150 + (1 - rp) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 120], 28, fill=RED_D + (a,))
        d.text((CAP_X + 40, y + 60), "절차가 폐지될 수 있어요", font=font("EB", 46), fill=(255, 255, 255, a), anchor="lm")
        d.text((CAP_X + 6, y + 146), "※ 기준은 법원·사건마다 다를 수 있음", font=font("B", 28), fill=SLATE300 + (a,), anchor="lm")
    # 매달 날짜 확인
    mp = ease_out((t - MONTHLY_AT) / 0.4)
    if mp > 0:
        a = int(255 * mp)
        y = 1350 + (1 - mp) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 110], 28, fill=TEAL + (a,))
        cx, cy = CAP_X + 62, y + 55
        d.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(255, 255, 255, a))
        d.line([(cx - 13, cy), (cx - 3, cy + 11), (cx + 14, cy - 11)], fill=TEAL_D + (a,), width=6, joint="curve")
        d.text((CAP_X + 112, y + 55), "매달 납부일 챙기기", font=font("EB", 44), fill=(255, 255, 255, a), anchor="lm")
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 회생동행 캘린더 (납부일 알림 → 미납 경고) ─────────────
ALIAS = "용감한 고래 42"
PAY_DAY = 25
MONTH_START_COL = 3   # 1일 = 수요일 (예시)
NOTIFY_AT = 1.85      # '납부일을 알려 주고'
ADV_AT = 3.4          # '미납이 생기면' → 날짜 경과
WARN_AT = 4.4         # '먼저 경고해요'
TAP_AT = 6.2


def bell(s: Scr, cx, cy, sz, color, rot=0.0):
    size = int(sz * 2 * K)
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    u = size / 2
    d.ellipse([u - size * 0.07, size * 0.08, u + size * 0.07, size * 0.22], fill=255)
    d.rounded_rectangle([size * 0.24, size * 0.16, size * 0.76, size * 0.72], int(size * 0.24), fill=255)
    d.rectangle([size * 0.24, size * 0.46, size * 0.76, size * 0.72], fill=255)
    d.rounded_rectangle([size * 0.14, size * 0.66, size * 0.86, size * 0.76], int(size * 0.05), fill=255)
    d.ellipse([u - size * 0.1, size * 0.74, u + size * 0.1, size * 0.9], fill=255)
    im = im.rotate(rot, resample=Image.BICUBIC, center=(u, size * 0.12))
    s.img.paste(Image.new("RGB", (size, size), color), (int((cx - sz) * K), int((cy - sz) * K)), im)


def today_at(t):
    if t < ADV_AT:
        return 22
    return 22 + min(4, int((t - ADV_AT) / 0.22) + 1)


def screen_companion(t):
    s = Scr(SLATE50)
    today = today_at(t)
    diff = PAY_DAY - today
    shift = 206 * ease_out((t - WARN_AT) / 0.45)

    # 헤더
    s.line([(48, 112), (34, 126), (48, 140)], SLATE900, 5)
    s.text(SW / 2, 126, "회생동행", 32, SLATE900, "EB", "mm")
    s.text(36, 196, f"{ALIAS} 님", 30, SLATE900, "EB", "lm")
    s.rr(36, 228, 206, 266, 19, fill=TEAL_L)
    s.text(121, 247, "인가 · 변제 중", 20, TEAL_D, "EB", "mm")

    # D-Day 카드
    y = 290 + shift
    card = RED_D if diff < 0 else TEAL_D
    s.rr(28, y, SW - 28, y + 180, 30, fill=card)
    if diff > 0:
        lab = f"다음 변제일까지 D-{diff}일"
    elif diff == 0:
        lab = "오늘이 변제금 납부일입니다"
    else:
        lab = "납부일이 지난 회차가 있습니다"
    pill = lerp_color(card, WHITE, 0.2)
    s.rr(52, y + 22, 52 + s.tlen(lab, 21, "EB") + 36, y + 64, 21, fill=pill)
    s.text(70, y + 43, lab, 21, WHITE, "EB", "lm")
    s.text(56, y + 96, "월 변제금", 21, lerp_color(card, WHITE, 0.75), "B", "lm")
    s.text(56, y + 140, "450,000원", 42, WHITE, "EB", "lm")
    ring = NOTIFY_AT <= t < NOTIFY_AT + 1.0
    s.circ(SW - 96, y + 118, 40, fill=pill)
    bell(s, SW - 96, y + 118, 30, WHITE, 18 * math.sin((t - NOTIFY_AT) * 22) * (1 - (t - NOTIFY_AT)) if ring else 0)

    # 납부 캘린더
    y = 496 + shift
    s.rr(28, y, SW - 28, y + 380, 30, fill=WHITE, outline=SLATE200, width=2)
    s.text(56, y + 36, "납부 캘린더", 26, SLATE900, "EB", "lm")
    s.text(SW - 56, y + 36, "이번 달", 20, SLATE500, "B", "rm")
    colw = (SW - 56) / 7
    for c, wd in enumerate("일월화수목금토"):
        s.text(28 + colw * (c + 0.5), y + 86, wd, 20, RED if c == 0 else SLATE400, "B", "mm")
    for day in range(1, 31):
        r, c = divmod(MONTH_START_COL + day - 1, 7)
        cx, cy = 28 + colw * (c + 0.5), y + 134 + r * 54
        if day == PAY_DAY:
            missed = today > PAY_DAY
            s.circ(cx, cy, 23, fill=RED if missed else TEAL)
            s.text(cx, cy, str(day), 22, WHITE, "EB", "mm")
            s.text(cx, cy + 36, "미기록" if missed else "납부일", 14, RED if missed else TEAL_D, "EB", "mm")
        else:
            s.text(cx, cy, str(day), 22, SLATE300 if day < today else SLATE700, "B", "mm")
        if day == today and day != PAY_DAY:
            s.circ(cx, cy, 24, outline=BLUE, width=3)

    # 미납 경고 배너 (화면 상단에 삽입)
    if t >= WARN_AT:
        bh = shift - 20
        s.rr(28, 290, SW - 28, 290 + max(1, bh), 30, fill=RED_50, outline=RED, width=3)
        if bh > 150:
            s.circ(78, 340, 26, fill=RED)
            s.rr(75, 322, 81, 346, 3, fill=WHITE)
            s.circ(78, 355, 4, fill=WHITE)
            s.rr(118, 322, 228, 358, 18, fill=RED)
            s.text(173, 340, "미납 경고", 19, WHITE, "EB", "mm")
            s.text(56, 396, "납부일이 지난 회차가 있습니다", 25, SLATE900, "EB", "lm")
            s.text(56, 436, "이미 납부했다면 확인증을 등록해 주세요", 19, SLATE500, "B", "lm")
            pressed = TAP_AT <= t < TAP_AT + 0.25
            s.rr(SW - 176, 318, SW - 48, 362, 16, fill=RED_D if pressed else WHITE, outline=RED, width=2)
            s.text(SW - 112, 340, "증빙 등록", 19, WHITE if pressed else RED, "EB", "mm")

    # 상단 상태바/헤더 영역 위에 뜨는 앱 내 알림
    s.rr(0, 0, SW, 64, 0, fill=SLATE50)
    s.status()
    if NOTIFY_AT <= t < ADV_AT + 0.4:
        p = ease_out((t - NOTIFY_AT) / 0.35) * (1 - ease_out((t - ADV_AT) / 0.4))
        ty = lerp(-120, 66, p)
        s.rr(20, ty, SW - 20, ty + 104, 28, fill=SLATE900)
        s.circ(74, ty + 52, 28, fill=TEAL)
        bell(s, 74, ty + 52, 20, WHITE)
        s.text(118, ty + 34, "변제금 납부일 D-3", 24, WHITE, "EB", "lm")
        s.text(118, ty + 72, "이번 달 납부일이 다가와요", 19, SLATE300, "B", "lm")
    return s.final()


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_companion(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW - 112, 340, t - TAP_AT)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 엔드카드 (EP01 레이아웃 재사용) ───────────────────
def scene5(t, dur):
    return ep01_endcard(t, dur)


def main():
    base.EP = EP
    base.OUT = base.ROOT / "assets" / "shorts" / EP
    base.TMP = base.OUT / "_work"
    base.SCENES = SCENES
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    base.main()


if __name__ == "__main__":
    main()
