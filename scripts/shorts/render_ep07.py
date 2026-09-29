# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP07 렌더러
기획: docs/youtube_shorts_plan.md  #7 "코인·주식으로 생긴 빚도 회생 될까?"

포맷 A (모션 그래픽/일러스트). 실존 인물·실제 종목명·거래소 로고 없음, 차트는 추상 도형.
공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
출력: assets/shorts/ep07/
실행: python scripts/shorts/render_ep07.py
"""
import math
import random
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900, RED,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, vgradient, zoom,
    draw_caption, chip, put_phone, tap, lock_icon, check_icon, scene5 as ep01_endcard,
)

EP = "ep07"

SCENES = [
    dict(plan=3.0, caption="[투자 빚도]\n회생 될까?",
         narration="코인, 주식으로 생긴 빚도 회생이 될까요?",
         tts="코인, 주식으로 생긴 빚도 회생이 될까요?"),
    dict(plan=6.0, caption="투자라서\n[안 된다던데]",
         narration="투자 손실이라 안 된다는 말, 들어보셨죠.",
         tts="투자 손실이라 안 된다는 말, 들어보셨죠."),
    dict(plan=8.57, caption="법원마다\n[기준]이 있어요",
         narration="법원마다 투자 손실을 어떻게 볼지 정한 실무 기준이 있어요. 무조건 안 되는 건 아닙니다.",
         tts="법원마다 투자 손실을 어떻게 볼지 정한 실무 기준이 있어요. 무조건 안 되는 건 아닙니다."),
    dict(plan=8.0, caption="소득·재산·[시점]\n확인",
         narration="다만 소득, 남은 재산, 투자한 시점에 따라 달라져요. 관할 법원 기준부터 확인하세요.",
         tts="다만 소득, 남은 재산, 투자한 시점에 따라 달라져요. 관할 법원 기준부터 확인하세요."),
    dict(plan=6.0, caption="이름 없이\n[먼저 정리]",
         narration="차트 끄고, 내 빚부터 이름 없이 정리해 보세요.",
         tts="차트 끄고, 내 빚부터 이름 없이 정리해 보세요."),
]

RED_L = (248, 113, 113)
TEAL_B = (45, 212, 191)
COURT_NOTE = "예) 서울회생법원 실무준칙. 법원·사건마다 다를 수 있음"


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


@lru_cache(maxsize=8)
def shade_layer(h, a):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    return sh.filter(ImageFilter.GaussianBlur(80))


def top_shade(frame, h=640, a=150):
    frame.alpha_composite(shade_layer(h, a))


# ── 추상 하락 차트 패널 (종목명·수치 없음) ──────────────────────
@lru_cache(maxsize=None)
def chart_panel(w, h, seed):
    S = 2
    img = Image.new("RGBA", (w * S, h * S), (14, 20, 34, 255))
    d = ImageDraw.Draw(img)
    for i in range(1, 4):
        y = h * S * i / 4
        d.line([(0, y), (w * S, y)], fill=(28, 38, 56, 255), width=S)
    for i in range(1, 6):
        x = w * S * i / 6
        d.line([(x, 0), (x, h * S)], fill=(24, 32, 48, 255), width=S)
    # 라벨 자리 (글자 대신 막대)
    d.rounded_rectangle([14 * S, 12 * S, 88 * S, 22 * S], 5 * S, fill=(51, 65, 85, 255))
    d.rounded_rectangle([14 * S, 30 * S, 54 * S, 38 * S], 4 * S, fill=(40, 52, 70, 255))
    rnd = random.Random(seed)
    n = 26
    p = 1.0
    ohlc = []
    for i in range(n):
        o = p
        drift = -0.03 - (0.03 if i > n * 0.62 else 0)
        c = o + drift + rnd.uniform(-0.03, 0.028)
        hi = max(o, c) + rnd.uniform(0.002, 0.02)
        lo = min(o, c) - rnd.uniform(0.002, 0.025)
        ohlc.append((o, hi, lo, c))
        p = c
    vmax = max(x[1] for x in ohlc)
    vmin = min(x[2] for x in ohlc)
    top, bot = 50, h - 46

    def Y(v):
        return (top + (vmax - v) / (vmax - vmin) * (bot - top)) * S

    cw = w / n
    for i, (o, hi, lo, c) in enumerate(ohlc):
        x = (i + 0.5) * cw * S
        col = RED if c < o else (100, 116, 139)
        d.line([(x, Y(hi)), (x, Y(lo))], fill=col + (255,), width=S)
        y0, y1 = sorted([Y(o), Y(c)])
        d.rectangle([x - cw * 0.32 * S, y0, x + cw * 0.32 * S, max(y1, y0 + 2 * S)], fill=col + (255,))
        vh = rnd.uniform(6, 24) + (10 if i > n * 0.62 else 0)
        d.rectangle([x - cw * 0.3 * S, (h - 6 - vh) * S, x + cw * 0.3 * S, (h - 6) * S], fill=(88, 34, 44, 255))
    closes = [x[3] for x in ohlc]
    pts = []
    for i in range(n):
        seg = closes[max(0, i - 3): i + 1]
        pts.append(((i + 0.5) * cw * S, Y(sum(seg) / len(seg))))
    d.line(pts, fill=RED_L + (255,), width=3 * S, joint="curve")
    img = img.resize((w, h), Image.LANCZOS)
    return img, ((n - 0.5) * cw, Y(closes[-1]) / S)


# ── 장면 1: 빨간 하락 차트가 가득한 모니터 (pan-left) ──────────────
WW = 1500
PNW, PNH = 428, 303


@lru_cache(maxsize=None)
def trading_room():
    img = vgradient(WW, H, (14, 22, 38), (8, 12, 24)).convert("RGBA")
    img.alpha_composite(radial(WW, H, 750, 1020, 900, (239, 68, 68), 70))
    ov, d = overlay(WW, H)
    d.rectangle([0, 1566, WW, H], fill=(20, 26, 40, 255))
    d.rectangle([0, 1548, WW, 1566], fill=(40, 48, 66, 255))
    d.rectangle([700, 1400, 800, 1520], fill=(30, 38, 54, 255))
    d.rounded_rectangle([560, 1510, 940, 1552], 16, fill=(38, 46, 64, 255))
    d.rounded_rectangle([60, 650, 1440, 1400], 28, fill=(10, 14, 24, 255), outline=(51, 65, 85, 255), width=4)
    img.alpha_composite(ov)
    lasts = []
    for r in range(2):
        for c in range(3):
            x = 96 + c * (PNW + 12)
            y = 686 + r * (PNH + 12)
            panel, last = chart_panel(PNW, PNH, 11 + r * 3 + c)
            img.alpha_composite(panel, (x, y))
            lasts.append((x + last[0], y + last[1]))
    return img, tuple(lasts)


def scene1(t, dur):
    room, lasts = trading_room()
    room = room.copy()
    ov, d = overlay(WW, H)
    pulse = 0.5 + 0.5 * math.sin(t * 7)
    for (x, y) in lasts:
        r = 16 + 10 * pulse
        d.ellipse([x - r, y - r, x + r, y + r], fill=(239, 68, 68, int(90 * (1 - pulse) + 40)))
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(254, 202, 202, 255))
    room.alpha_composite(ov)
    x = int((WW - W) * (1 - ease_in_out(t / dur)))  # 카메라가 왼쪽으로 이동
    frame = room.crop((x, 0, x + W, H))
    top_shade(frame)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 새벽, 차트를 끄는 손 ─────────────────────────────
SCR_BOX = (215, 745, 865, 1135)   # 모니터 화면
BTN = (835, 1156)                  # 전원 버튼
OFF_AT = 1.65


@lru_cache(maxsize=None)
def dawn_room():
    img = vgradient(W, H, (18, 24, 44), (10, 14, 28)).convert("RGBA")
    # 창문: 새벽 하늘
    sky = np.zeros((380, 280, 3), dtype=np.float32)
    ys = np.linspace(0, 1, 380)[:, None]
    c0, c1, c2 = np.array((26, 36, 76)), np.array((86, 74, 122)), np.array((226, 156, 118))
    col = np.where(ys[..., None] < 0.6, c0 + (c1 - c0) * (ys[..., None] / 0.6), c1 + (c2 - c1) * ((ys[..., None] - 0.6) / 0.4))
    sky[:] = col[:, 0][:, None, :]
    img.paste(Image.fromarray(sky.astype(np.uint8), "RGB"), (720, 180))
    ov, d = overlay()
    d.rectangle([710, 170, 1010, 570], outline=(52, 64, 88, 255), width=14)
    d.line([860, 170, 860, 570], fill=(52, 64, 88, 255), width=10)
    d.line([710, 380, 1010, 380], fill=(52, 64, 88, 255), width=10)
    # 벽시계 (숫자 없음, 새벽 4시 무렵)
    cx, cy, r = 170, 700, 58
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(30, 40, 60, 255), outline=(148, 163, 184, 255), width=6)
    for k in range(12):
        a = k * math.pi / 6
        d.line([(cx + math.sin(a) * (r - 14), cy - math.cos(a) * (r - 14)), (cx + math.sin(a) * (r - 6), cy - math.cos(a) * (r - 6))], fill=(148, 163, 184, 255), width=3)
    d.line([(cx, cy), (cx + math.sin(4 / 12 * 2 * math.pi) * 28, cy - math.cos(4 / 12 * 2 * math.pi) * 28)], fill=(226, 232, 240, 255), width=6)
    d.line([(cx, cy), (cx + math.sin(2 / 12 * 2 * math.pi) * 42, cy - math.cos(2 / 12 * 2 * math.pi) * 42)], fill=(226, 232, 240, 255), width=4)
    # 책상
    d.polygon([(-40, 1300), (W + 40, 1300), (W + 200, H), (-200, H)], fill=(52, 40, 34, 255))
    d.rectangle([-40, 1290, W + 40, 1306], fill=(74, 58, 48, 255))
    img.alpha_composite(ov)
    return img


@lru_cache(maxsize=None)
def monitor_layer():
    ov, d = overlay()
    d.rectangle([505, 1170, 575, 1284], fill=(30, 38, 54, 255))
    d.rounded_rectangle([390, 1276, 690, 1304], 12, fill=(38, 46, 64, 255))
    d.rounded_rectangle([190, 720, 890, 1178], 22, fill=(10, 14, 24, 255), outline=(51, 65, 85, 255), width=4)
    d.ellipse([BTN[0] - 9, BTN[1] - 9, BTN[0] + 9, BTN[1] + 9], fill=(51, 65, 85, 255))
    return ov


@lru_cache(maxsize=None)
def hand_img():
    """단순화한 일러스트 손 (검지로 가리키는 모양). 손끝 = (0, 93)"""
    S = 2
    w, h = 720, 260
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin, shade = (236, 196, 164, 255), (206, 160, 128, 255)

    def rr(box, r, **kw):
        d.rounded_rectangle([v * S for v in box], r * S, **kw)

    rr([350, 40, 720, 250], 30, fill=(71, 85, 105, 255))
    rr([336, 50, 392, 240], 16, fill=(51, 65, 85, 255))
    rr([170, 62, 370, 228], 70, fill=skin)
    rr([196, 26, 332, 84], 28, fill=skin, outline=shade, width=3 * S)
    for y in (112, 150, 188):
        rr([150, y, 262, y + 38], 19, fill=skin, outline=shade, width=3 * S)
    rr([0, 72, 232, 114], 21, fill=skin, outline=shade, width=3 * S)
    rr([6, 79, 34, 107], 10, fill=(246, 216, 192, 255))
    return im.resize((w, h), Image.LANCZOS)


def screen_off_layer(p):
    """CRT식 꺼짐 (p: 0→1)"""
    ov, d = overlay()
    x0, y0, x1, y1 = SCR_BOX
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    d.rectangle(SCR_BOX, fill=(6, 8, 14, 255))
    if p < 0.6:
        q = p / 0.6
        hh = max(6, int((y1 - y0) * (1 - q) ** 2))
        panel = chart_panel(x1 - x0, y1 - y0, 5)[0].resize((x1 - x0, hh), Image.BILINEAR)
        panel = Image.blend(panel, Image.new("RGBA", panel.size, (255, 255, 255, 255)), q)
        ov.alpha_composite(panel, (x0, int(cy - hh / 2)))
    elif p < 1:
        q = (p - 0.6) / 0.4
        ww = max(4, int((x1 - x0) * (1 - q)))
        d.rectangle([cx - ww / 2, cy - 3, cx + ww / 2, cy + 3], fill=lerp_color((6, 8, 14), WHITE, 1 - q) + (255,))
    return ov


def scene2(t, dur):
    frame = dawn_room().copy()
    p_off = clamp((t - OFF_AT) / 0.4)
    glow = int(round(80 * (1 - p_off) / 10)) * 10
    if glow > 0:
        frame.alpha_composite(radial(W, H, 540, 940, 720, (239, 68, 68), glow))
    frame.alpha_composite(monitor_layer())
    x0, y0, x1, y1 = SCR_BOX
    if t < OFF_AT:
        frame.alpha_composite(chart_panel(x1 - x0, y1 - y0, 5)[0], (x0, y0))
    else:
        frame.alpha_composite(screen_off_layer(p_off))
        if p_off >= 1:
            ov, d = overlay()
            d.polygon([(x0 + 40, y0), (x0 + 200, y0), (x0 + 40, y0 + 200)], fill=(255, 255, 255, 10))
            d.ellipse([BTN[0] - 5, BTN[1] - 5, BTN[0] + 5, BTN[1] + 5], fill=(251, 146, 60, 255))
            frame.alpha_composite(ov)
    # 손: 들어와서 전원 버튼을 누르고 빠짐
    if t < 1.4:
        hx = lerp(1180, BTN[0], ease_out((t - 0.2) / 1.2))
    elif t < 1.9:
        hx = BTN[0] - 8 * math.sin(clamp((t - 1.4) / 0.5) * math.pi)
    else:
        hx = lerp(BTN[0], 1200, ease_in_out((t - 2.4) / 1.0))
    if hx < W:
        frame.alpha_composite(hand_img(), (int(hx), int(BTN[1] - 93)))
    # 누름 효과
    tt = t - OFF_AT
    if 0 <= tt <= 0.6:
        ov, d = overlay()
        pp = ease_out(tt / 0.6)
        r = 20 + 50 * pp
        d.ellipse([BTN[0] - r, BTN[1] - r, BTN[0] + r, BTN[1] + r], outline=(255, 255, 255, int(200 * (1 - pp))), width=5)
        frame.alpha_composite(ov)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.05 * ease_in_out(t / dur), W / 2, 1000).convert("RGBA")
    top_shade(frame, 600, 110)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 법원 건물 아이콘 + 체크 ────────────────────────────
# 내레이션 실측 기준 (장면 내 초)
COURT_AT = 0.1
CHECK_AT = 0.5    # '법원마다' 0.20s~
CARD_A_AT = 2.2   # '…실무 기준이 있어요' 2.14s~
CARD_B_AT = 4.7   # '무조건 안 되는 건 아닙니다' 4.72s~


@lru_cache(maxsize=None)
def court_icon():
    S = 2
    w, h = 600, 420
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    L1, L2, L3 = (226, 232, 240, 255), (203, 213, 225, 255), (255, 255, 255, 255)

    def sc(pts):
        return [(x * S, y * S) for x, y in pts]

    d.polygon(sc([(40, 130), (560, 130), (300, 20)]), fill=L1)
    d.polygon(sc([(120, 118), (480, 118), (300, 46)]), fill=L2)
    d.ellipse([276 * S, 76 * S, 324 * S, 112 * S], fill=TEAL + (255,))
    d.rectangle([30 * S, 130 * S, 570 * S, 172 * S], fill=L3)
    for x in (110, 230, 370, 490):
        d.rectangle([(x - 38) * S, 176 * S, (x + 38) * S, 192 * S], fill=L3)
        d.rectangle([(x - 28) * S, 192 * S, (x + 28) * S, 346 * S], fill=L1)
        for k in (-12, 0, 12):
            d.line([((x + k) * S, 200 * S), ((x + k) * S, 338 * S)], fill=L2, width=2 * S)
        d.rectangle([(x - 38) * S, 346 * S, (x + 38) * S, 360 * S], fill=L3)
    d.rectangle([20 * S, 360 * S, 580 * S, 386 * S], fill=L3)
    d.rectangle([0, 386 * S, 600 * S, 414 * S], fill=L2)
    return im.resize((w, h), Image.LANCZOS)


def wrap_note(d, text, f, maxw):
    if d.textlength(text, font=f) <= maxw:
        return [text]
    a, b = text.split(". ", 1)
    return [a + ".", b]


def doc_icon(d, x, y, col):
    d.rounded_rectangle([x, y, x + 64, y + 82], 10, fill=(255, 255, 255, 255))
    d.polygon([(x + 42, y), (x + 64, y + 22), (x + 42, y + 22)], fill=col + (255,))
    for j in range(3):
        d.rounded_rectangle([x + 11, y + 34 + j * 15, x + 53 - (j == 2) * 16, y + 41 + j * 15], 3, fill=(148, 163, 184, 255))


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    # 건물
    p = ease_out((t - COURT_AT) / 0.5)
    if p > 0:
        ic = court_icon()
        sc_ = 0.9 + 0.1 * p
        im = ic.resize((int(ic.width * sc_), int(ic.height * sc_)), Image.BICUBIC)
        im.putalpha(im.getchannel("A").point(lambda v: int(v * p)))
        frame.alpha_composite(im, (int(540 - im.width / 2), int(640 + (ic.height - im.height) / 2)))
    # 체크 배지
    cp = ease_out((t - CHECK_AT) / 0.35)
    if cp > 0:
        ov, d = overlay()
        cx, cy, r = 800, 660, 58 * (0.6 + 0.4 * cp)
        d.ellipse([cx - r - 6, cy - r - 6, cx + r + 6, cy + r + 6], fill=NAVY_D + (255,))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL + (255,))
        if cp > 0.5:
            d.line([(cx - 26, cy + 2), (cx - 8, cy + 20), (cx + 26, cy - 18)], fill=WHITE + (255,), width=10, joint="curve")
        frame.alpha_composite(ov)
    ov, d = overlay()
    # 카드 A: 실무 기준
    ap = ease_out((t - CARD_A_AT) / 0.4)
    if ap > 0:
        y = 1086 + (1 - ap) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 132], 28, fill=(255, 255, 255, int(22 * ap)), outline=(255, 255, 255, int(70 * ap)), width=2)
        doc_icon(d, CAP_X + 30, y + 25, TEAL)
        a = int(255 * ap)
        d.text((CAP_X + 124, y + 22), "법원이 정한", font=font("B", 30), fill=SLATE300 + (a,))
        d.text((CAP_X + 124, y + 62), "투자 손실 실무 기준", font=font("EB", 44), fill=(255, 255, 255, a))
    # 카드 B: 무조건 불가 → 기준에 따라 검토
    bp = ease_out((t - CARD_B_AT) / 0.4)
    if bp > 0:
        y = 1244 + (1 - bp) * 30
        a = int(255 * bp)
        d.rounded_rectangle([CAP_X, y, 890, y + 120], 28, fill=(255, 255, 255, int(22 * bp)), outline=(255, 255, 255, int(70 * bp)), width=2)
        f = font("EB", 40)
        tx = CAP_X + 36
        ty = y + 60
        d.text((tx, ty), "무조건 불가", font=f, fill=SLATE400 + (a,), anchor="lm")
        tw = d.textlength("무조건 불가", font=f)
        sp = ease_out((t - CARD_B_AT - 0.35) / 0.3)
        if sp > 0:
            d.line([(tx - 6, ty + 2), (tx - 6 + (tw + 12) * sp, ty + 2)], fill=RED + (255,), width=6)
        rp = ease_out((t - CARD_B_AT - 0.7) / 0.35)
        if rp > 0:
            ra = int(255 * rp)
            ax = tx + tw + 30
            d.line([(ax, ty), (ax + 40, ty)], fill=SLATE300 + (ra,), width=5)
            d.polygon([(ax + 40, ty - 12), (ax + 56, ty), (ax + 40, ty + 12)], fill=SLATE300 + (ra,))
            d.text((ax + 76, ty), "기준에 따라 검토", font=f, fill=TEAL_B + (ra,), anchor="lm")
    # 자막 보조 표기 (하단 20% 위)
    np_ = ease_out((t - 0.3) / 0.4)
    if np_ > 0:
        f = font("R", 30)
        y = 1420
        for ln in wrap_note(d, COURT_NOTE, f, 800):
            d.text((CAP_X, y), ln, font=f, fill=SLATE300 + (int(255 * np_),))
            y += 44
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 체크리스트 3줄 ────────────────────────────────────
ROWS = [  # (제목, 설명, 아이콘, 체크 시점)
    ("소득", "매달 갚아 나갈 수 있는 소득", "wallet", 1.4),
    ("남은 재산", "지금 남아 있는 재산 (청산가치)", "house", 2.45),
    ("투자한 시점", "빚을 진 때와 투자한 때", "clock", 3.1),
]
BOX_AT = 5.2   # '관할 법원 기준부터 확인하세요' 5.19s~


def row_icon(d, kind, cx, cy):
    c = WHITE + (255,)
    if kind == "wallet":
        d.rounded_rectangle([cx - 26, cy - 18, cx + 26, cy + 20], 8, outline=c, width=6)
        d.rounded_rectangle([cx + 6, cy - 6, cx + 30, cy + 8], 5, fill=c)
    elif kind == "house":
        d.polygon([(cx - 30, cy - 2), (cx, cy - 28), (cx + 30, cy - 2)], fill=c)
        d.rectangle([cx - 21, cy - 4, cx + 21, cy + 24], fill=c)
        d.rectangle([cx - 7, cy + 6, cx + 7, cy + 24], fill=TEAL + (255,))
    else:
        d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=c, width=6)
        d.line([(cx, cy - 14), (cx, cy), (cx + 12, cy + 8)], fill=c, width=6, joint="curve")


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    ov, d = overlay()
    hp = ease_out((t - 0.1) / 0.4)
    d.text((CAP_X, 600), "사건마다 따져 보는 요소 (예)", font=font("B", 32), fill=SLATE300 + (int(255 * hp),))
    for i, (title, sub, kind, at) in enumerate(ROWS):
        p = ease_out((t - (at - 0.35)) / 0.4)
        if p <= 0:
            continue
        a = int(255 * p)
        y = 664 + i * 166 + (1 - p) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 144], 28, fill=(255, 255, 255, int(20 * p)), outline=(255, 255, 255, int(60 * p)), width=2)
        d.ellipse([CAP_X + 28, y + 30, CAP_X + 112, y + 114], fill=lerp_color(NAVY_D, TEAL, p) + (255,))
        row_icon(d, kind, CAP_X + 70, y + 72)
        d.text((CAP_X + 140, y + 28), title, font=font("EB", 44), fill=(255, 255, 255, a))
        d.text((CAP_X + 140, y + 88), sub, font=font("B", 28), fill=SLATE300 + (a,))
        ck = ease_out((t - at) / 0.3)
        cx, cy = 826, y + 72
        if ck > 0:
            d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=TEAL + (255,))
            if ck > 0.4:
                d.line([(cx - 14, cy + 1), (cx - 4, cy + 12), (cx + 15, cy - 11)], fill=WHITE + (255,), width=7, joint="curve")
        else:
            d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline=SLATE400 + (a,), width=4)
    bp = ease_out((t - BOX_AT) / 0.45)
    if bp > 0:
        a = int(255 * bp)
        y = 1190 + (1 - bp) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 230], 32, fill=TEAL + (int(235 * bp),))
        d.text((CAP_X + 40, y + 42), "관할 법원 기준부터 확인", font=font("EB", 46), fill=(255, 255, 255, a))
        d.text((CAP_X + 40, y + 124), "법원·사건마다 다를 수 있어요", font=font("B", 32), fill=(240, 253, 250, a))
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 익명 체크 (데모) → 엔드카드 ───────────────────────
SECTIONS = [  # (라벨, 키, 선택지)
    ("빚이 생긴 이유 (복수 선택)", "reason", ["생활비", "코인·주식", "사업"]),
    ("소득 형태", "income", ["급여", "사업", "기타"]),
    ("투자 시점", "when", ["1년 이내", "그 이전", "잘 모름"]),
]
CHK_SEL = [("reason", 1, 0.25), ("reason", 0, 0.5), ("income", 0, 0.75), ("when", 0, 1.0)]
CHK_PRESS = 1.3
CHK_RESULT = 1.6
PH_END = 3.0     # 이후 엔드카드 (고지문 2초 이상)
XFADE = 0.3


def screen_check7(t):
    s = Scr(SLATE50)
    s.status()
    s.text(36, 100, "익명 채무 체크", 40, SLATE900, "EB")
    s.rr(36, 160, 250, 204, 16, fill=TEAL_L)
    lock_icon(s, 64, 186, 22, TEAL_D)
    s.text(84, 182, "이름·번호 입력 없음", 20, TEAL_D, "EB", "lm")
    if t < CHK_RESULT:
        y = 240
        for label, key, opts in SECTIONS:
            s.text(40, y, label, 24, SLATE700, "EB")
            for j, o in enumerate(opts):
                x0 = 36 + j * 160
                x1 = x0 + 148
                sel = any(k == key and jj == j and t >= at for k, jj, at in CHK_SEL)
                s.rr(x0, y + 40, x1, y + 118, 22, fill=(240, 253, 250) if sel else WHITE,
                     outline=TEAL if sel else SLATE200, width=3 if sel else 2)
                s.text((x0 + x1) / 2, y + 79, o, 25, TEAL_D if sel else SLATE500, "EB", "mm")
            y += 170
        pressed = CHK_PRESS <= t < CHK_PRESS + 0.25
        s.rr(36, 790, SW - 36, 886, 26, fill=BLUE_D if pressed else BLUE)
        s.text(SW / 2, 838, "내 상황 정리하기", 32, WHITE, "EB", "mm")
    else:
        rt = t - CHK_RESULT
        p = ease_out(rt / 0.35)
        y = 240 + (1 - p) * 40
        s.rr(28, y, SW - 28, y + 270, 30, fill=WHITE, outline=SLATE200, width=2)
        s.text(60, y + 32, "내 상황 요약", 24, SLATE500, "B")
        rows = [("빚이 생긴 이유", "코인·주식, 생활비"), ("소득 형태", "급여"), ("투자 시점", "1년 이내")]
        for i, (a, b) in enumerate(rows):
            yy = y + 86 + i * 56
            s.text(60, yy, a, 25, SLATE700, "B")
            s.text(SW - 60, yy, b, 26, SLATE900, "EB", "ra")
        y2 = y + 300
        s.rr(28, y2, SW - 28, y2 + 400, 30, fill=WHITE, outline=SLATE200, width=2)
        s.text(60, y2 + 30, "먼저 확인할 것", 28, SLATE900, "EB")
        items = ["관할 법원 실무 기준", "남은 재산 (청산가치)", "투자 시점 관련 자료"]
        for i, name in enumerate(items):
            ip = ease_out((rt - 0.25 - i * 0.18) / 0.3)
            if ip <= 0:
                continue
            yy = y2 + 90 + i * 82
            s.rr(52, yy, SW - 52, yy + 66, 20, fill=(240, 253, 250), outline=TEAL, width=2)
            s.circ(86, yy + 33, 14, fill=TEAL)
            check_icon(s, 86, yy + 34, 14, WHITE, 3)
            s.text(116, yy + 33, name, 25, SLATE900, "EB", "lm")
        s.line([(60, y2 + 334), (SW - 60, y2 + 334)], SLATE100, 2)
        s.text(60, y2 + 350, "참고용 결과예요. 최종 판단은 변호사와", 20, SLATE500, "B")
        s.text(60, y2 + 376, "관할 법원 기준으로 확인하세요.", 20, SLATE500, "B")
    return s.final()


def phone_part(t):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_check7(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 838, t - CHK_PRESS)
    draw_caption(frame, SCENES[4]["caption"], t)
    return frame


def scene5(t, dur):
    if t < PH_END - XFADE:
        return phone_part(t)
    if t < PH_END:
        a = phone_part(t).convert("RGB")
        b = ep01_endcard(0, dur).convert("RGB")
        return Image.blend(a, b, ease_in_out((t - (PH_END - XFADE)) / XFADE)).convert("RGBA")
    return ep01_endcard(t - PH_END, dur)


def main():
    base.EP = EP
    base.OUT = base.ROOT / "assets" / "shorts" / EP
    base.TMP = base.OUT / "_work"
    base.SCENES = SCENES
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    base.main()


if __name__ == "__main__":
    main()
