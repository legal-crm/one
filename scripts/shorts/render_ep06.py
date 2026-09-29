# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP06 렌더러
기획: docs/youtube_shorts_plan.md  #6 "급여 압류 통지서, 받자마자 확인할 것"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
포맷 A(모션 그래픽/일러스트, 실존 인물 없음). 봉투 글자는 블러 처리(판독 불가).
출력: assets/shorts/ep06/
실행: python scripts/shorts/render_ep06.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, SW, SH, CAP_X, NAVY, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900, RED,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, check_icon, vgradient, scene5 as ep01_endcard,
)

EP = "ep06"

SCENES = [
    dict(plan=3.0, caption="급여 압류\n[통지서?]",
         narration="회사로 급여 압류 서류가 온다고요?",
         tts="회사로 급여 압류 서류가 온다고요?"),
    dict(plan=5.5, caption="회사가\n[알게 될까] 걱정",
         narration="월급도 걱정이지만, 회사에 알려질까 더 걱정되죠.",
         tts="월급도 걱정이지만, 회사에 알려질까 더 걱정되죠."),
    dict(plan=8.5, caption="[금지·중지명령]\n함께 신청 가능",
         narration="개인회생을 신청하면서 압류를 막거나 멈춰 달라는 명령을 함께 신청할 수 있어요.",
         tts="개인회생을 신청하면서 압류를 막거나 멈춰 달라는 명령을 함께 신청할 수 있어요."),
    dict(plan=8.0, caption="결정은\n[법원이] 합니다",
         narration="받아들여질지, 언제 나올지는 법원이 사건별로 판단해요. 그래서 빨리 확인하는 게 중요합니다.",
         tts="받아들여질지, 언제 나올지는 법원이 사건별로 판단해요. 그래서 빨리 확인하는 게 중요합니다."),
    dict(plan=7.0, caption="오늘 상황부터\n[정리]",
         narration="통지서를 받았다면, 오늘 내 상황부터 정리해 보세요.",
         tts="통지서를 받았다면, 오늘 내 상황부터 정리해 보세요."),
]

AMBER = (245, 158, 11)
CARD = (38, 66, 104)        # 불투명 카드색 (반투명 비침 방지)
CARD_LINE = (72, 104, 142)
NOTE = "※ 요건·효과는 법원·사건마다 다를 수 있음"


# ── 공통 헬퍼 ──────────────────────────────────────────────
def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


def fade(img, p):
    """RGBA 타일의 알파를 p 배로 (p>=1이면 원본)"""
    if p >= 1:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * p)))
    return out


def put(frame, tile, x, y, p, dy=30):
    """타일을 페이드·슬라이드인으로 합성"""
    if p <= 0:
        return
    frame.alpha_composite(fade(tile, p), (int(x), int(y + (1 - p) * dy)))


@lru_cache(maxsize=64)
def radial(w, h, cx, cy, r, color, alpha):
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(1 - dist, 0, 1) ** 2 * alpha
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def top_shade(frame, h=640, a=150):
    frame.alpha_composite(_top_shade(h, a))


@lru_cache(maxsize=8)
def _top_shade(h, a):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    return sh.filter(ImageFilter.GaussianBlur(80))


def note(frame, y, text=NOTE):
    """법 절차 장면 하단 작은 표기 (하단 20% 위)"""
    d = ImageDraw.Draw(frame)
    d.text((CAP_X, y), text, font=font("B", 28), fill=SLATE300)


# ── 봉투 (글자 대신 블러 처리한 막대만, 판독 불가) ─────────────────
@lru_cache(maxsize=None)
def envelope(w=440, h=280):
    S = 2
    im = Image.new("RGBA", ((w + 80) * S, (h + 80) * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([46 * S, 56 * S, (w + 46) * S, (h + 56) * S], 14 * S, fill=(0, 0, 0, 150))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * S)))
    body = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 12 * S, fill=(246, 241, 228, 255))
    # 봉투 뒷면 접힘선
    d.line([(0, 0), (w * S / 2, h * S * 0.52), (w * S, 0)], fill=(222, 214, 196, 255), width=3 * S)
    # 글자 자리: 막대만 그리고 강하게 블러 → 판독 불가
    txt = Image.new("RGBA", body.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    for i, ww in enumerate([150, 110, 130]):  # 발신처
        td.rounded_rectangle([26 * S, (26 + i * 20) * S, (26 + ww) * S, (36 + i * 20) * S], 4 * S, fill=(90, 90, 100, 255))
    td.rectangle([(w - 120) * S, 24 * S, (w - 28) * S, 72 * S], fill=(200, 60, 60, 255))  # 붉은 표시
    td.rounded_rectangle([120 * S, 150 * S, (w - 60) * S, 244 * S], 8 * S, fill=(236, 230, 214, 255))  # 창
    for i, ww in enumerate([220, 180, 200]):  # 수신처
        td.rounded_rectangle([140 * S, (166 + i * 24) * S, (140 + ww) * S, (178 + i * 24) * S], 4 * S, fill=(70, 70, 82, 255))
    body.alpha_composite(txt.filter(ImageFilter.GaussianBlur(7 * S)))
    im.alpha_composite(body, (40 * S, 40 * S))
    return im.resize((w + 80, h + 80), Image.LANCZOS)


# ── 장면 1: 우편함에서 꺼낸 봉투 (zoom-in) ───────────────────────
@lru_cache(maxsize=None)
def mailbox_wall():
    img = vgradient(W, H, (40, 56, 82), (24, 34, 54)).convert("RGBA")
    ov, d = overlay()
    # 벽 패널 줄눈
    for y in range(700, H, 150):
        d.line([(0, y), (W, y)], fill=(34, 48, 72, 255), width=4)
    # 우편함 3x2
    x0, y0, bw, bh, g = 120, 860, 270, 300, 15
    d.rounded_rectangle([x0 - 26, y0 - 26, x0 + 3 * bw + 2 * g + 26, y0 + 2 * bh + g + 26], 18, fill=(52, 64, 84, 255))
    for r in range(2):
        for c in range(3):
            bx, by = x0 + c * (bw + g), y0 + r * (bh + g)
            d.rounded_rectangle([bx, by, bx + bw, by + bh], 10, fill=(148, 163, 184, 255), outline=(100, 116, 139, 255), width=4)
            d.rounded_rectangle([bx + 40, by + 44, bx + bw - 40, by + 66], 8, fill=(51, 65, 85, 255))  # 투입구
            d.rounded_rectangle([bx + bw / 2 - 40, by + 110, bx + bw / 2 + 40, by + 150], 6, fill=(203, 213, 225, 255))  # 빈 명판
            d.ellipse([bx + bw - 50, by + bh / 2 - 12, bx + bw - 26, by + bh / 2 + 12], fill=(71, 85, 105, 255))  # 손잡이
    img.alpha_composite(ov)
    return img


def scene1(t, dur):
    frame = mailbox_wall().copy()
    p = ease_out((t - 0.1) / 1.1)
    env = envelope()
    rot = lerp(-10, -4, p)
    env_r = env.rotate(rot, resample=Image.BICUBIC, expand=True)
    cx, cy = 540, lerp(1020, 900, p)
    frame.alpha_composite(radial(700, 600, 350, 300, 340, (255, 244, 214), 70), (int(cx - 350), int(cy - 300)))
    put(frame, env_r, cx - env_r.width / 2, cy - env_r.height / 2, clamp(t / 0.25), 0)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.16 * ease_in_out(t / dur), 540, 1080).convert("RGBA")
    top_shade(frame)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 사무실 책상, 굳은 손 ─────────────────────────────
BUBBLE1_AT = 0.2    # 실측 0.17s '월급도 걱정이지만'
BUBBLE2_AT = 1.8    # 실측 1.81s '회사에 알려질까'


@lru_cache(maxsize=None)
def office_desk():
    img = vgradient(W, H, (40, 56, 82), (26, 38, 60)).convert("RGBA")
    ov, d = overlay()
    # 파티션
    d.rectangle([0, 1030, W, 1140], fill=(48, 62, 86, 255))
    # 모니터
    d.rounded_rectangle([290, 690, 790, 1030], 18, fill=(20, 28, 44, 255), outline=(71, 85, 105, 255), width=6)
    d.rectangle([310, 710, 770, 1006], fill=(226, 232, 240, 255))
    d.rectangle([310, 710, 770, 752], fill=(59, 130, 246, 255))
    rows = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rows)
    for i in range(6):  # 메일 목록(블러, 판독 불가)
        y = 776 + i * 38
        rd.rounded_rectangle([330, y, 330 + [300, 360, 260, 340, 280, 320][i], y + 14], 6, fill=(148, 163, 184, 255))
    ov.alpha_composite(rows.filter(ImageFilter.GaussianBlur(4)))
    d = ImageDraw.Draw(ov)
    d.rectangle([520, 1030, 560, 1130], fill=(30, 41, 59, 255))
    d.ellipse([430, 1112, 650, 1148], fill=(30, 41, 59, 255))
    # 책상
    d.polygon([(-40, 1140), (W + 40, 1140), (W + 200, H), (-200, H)], fill=(112, 86, 66, 255))
    d.rectangle([-40, 1132, W + 40, 1150], fill=(140, 108, 82, 255))
    d.rounded_rectangle([330, 1190, 760, 1262], 14, fill=(71, 85, 105, 255))  # 키보드
    for r in range(3):
        for c in range(12):
            d.rounded_rectangle([346 + c * 34, 1200 + r * 20, 372 + c * 34, 1214 + r * 20], 3, fill=(100, 116, 139, 255))
    img.alpha_composite(ov)
    env = envelope(300, 190).rotate(9, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(env, (40, 1250))
    return img


@lru_cache(maxsize=None)
def hands():
    """맞잡은 두 주먹 (일러스트, 실존 인물 아님)"""
    S = 2
    w, h = 420, 560
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin, skin_d, sleeve, cuff = (228, 186, 152, 255), (196, 150, 118, 255), (30, 41, 59, 255), (203, 213, 225, 255)
    # 소매 (화면 아래에서 올라옴)
    d.polygon([(40 * S, h * S), (120 * S, 190 * S), (220 * S, 200 * S), (190 * S, h * S)], fill=sleeve)
    d.polygon([(230 * S, h * S), (250 * S, 200 * S), (360 * S, 180 * S), (420 * S, h * S)], fill=sleeve)
    d.polygon([(112 * S, 200 * S), (226 * S, 210 * S), (222 * S, 236 * S), (104 * S, 228 * S)], fill=cuff)
    d.polygon([(246 * S, 212 * S), (364 * S, 190 * S), (372 * S, 216 * S), (250 * S, 238 * S)], fill=cuff)
    # 주먹
    d.rounded_rectangle([90 * S, 40 * S, 240 * S, 200 * S], 56 * S, fill=skin)
    d.rounded_rectangle([200 * S, 20 * S, 360 * S, 190 * S], 58 * S, fill=skin, outline=skin_d, width=3 * S)
    for i in range(3):  # 손가락 마디
        y = (58 + i * 38) * S
        d.arc([214 * S, y, 300 * S, y + 44 * S], 200, 340, fill=skin_d, width=4 * S)
    d.arc([60 * S, 60 * S, 170 * S, 170 * S], 280, 60, fill=skin_d, width=4 * S)  # 엄지
    return im.resize((w, h), Image.LANCZOS)


def coin_icon(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=AMBER + (255,))
    d.ellipse([cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7], outline=(180, 110, 8, 255), width=4)
    d.rectangle([cx - 3, cy - r * 0.42, cx + 3, cy + r * 0.42], fill=(180, 110, 8, 255))


def building_icon(d, cx, cy, sz, col):
    d.rectangle([cx - sz * 0.4, cy - sz * 0.5, cx + sz * 0.4, cy + sz * 0.5], fill=col + (255,))
    for r in range(3):
        for c in range(2):
            x = cx - sz * 0.24 + c * sz * 0.3
            y = cy - sz * 0.36 + r * sz * 0.26
            d.rectangle([x, y, x + sz * 0.16, y + sz * 0.14], fill=WHITE + (255,))


@lru_cache(maxsize=None)
def bubble_tile(kind):
    f = font("EB", 42)
    label = "월급은?" if kind == 1 else "회사가 알게 되면?"
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bw = int(tmp.textlength(label, font=f)) + 150
    bh = 124
    im, d = overlay(bw + 10, bh + 40)
    col = SLATE200 if kind == 1 else AMBER
    d.rounded_rectangle([4, 4, bw, bh], 34, fill=WHITE + (255,), outline=col + (255,), width=5)
    d.polygon([(70, bh - 2), (110, bh - 2), (76, bh + 32)], fill=WHITE + (255,))
    if kind == 1:
        coin_icon(d, 66, bh / 2 + 2, 30)
    else:
        building_icon(d, 66, bh / 2 + 2, 60, (100, 116, 139))
    d.text((116, bh / 2 + 2), label, font=f, fill=NAVY_D + (255,), anchor="lm")
    return im


def scene2(t, dur):
    frame = office_desk().copy()
    shake = math.sin(t * 43) * 2.2 + math.sin(t * 17) * 1.2
    frame.alpha_composite(hands(), (int(500 + shake), 1360))
    top_shade(frame, 600, 120)
    put(frame, bubble_tile(1), 110, 606, ease_out((t - BUBBLE1_AT) / 0.35))
    put(frame, bubble_tile(2), 330, 770, ease_out((t - BUBBLE2_AT) / 0.35))
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 개인회생 신청 → 금지·중지명령 모션 그래픽 ─────────────
TOP_AT = 0.15       # '개인회생을 신청하면서'
BAN_AT = 1.75       # 실측 1.68s '압류를 막거나'
STAY_AT = 2.85      # 실측 약 2.8s '멈춰 달라는'
WITH_AT = 4.2       # 실측 3.88s~ (함께 ≈4.2s) '함께 신청할 수 있어요'


def doc_icon(d, x, y, sz, col):
    d.rounded_rectangle([x, y, x + sz * 0.78, y + sz], 8, fill=WHITE + (255,))
    d.polygon([(x + sz * 0.5, y), (x + sz * 0.78, y + sz * 0.28), (x + sz * 0.5, y + sz * 0.28)], fill=col + (255,))
    for j in range(3):
        d.rounded_rectangle([x + sz * 0.14, y + sz * (0.42 + j * 0.17), x + sz * (0.62 - (j == 2) * 0.18), y + sz * (0.5 + j * 0.17)], 3, fill=SLATE400 + (255,))


@lru_cache(maxsize=None)
def top_node():
    im, d = overlay(800, 150)
    d.rounded_rectangle([0, 0, 799, 149], 34, fill=CARD + (255,), outline=TEAL + (255,), width=5)
    doc_icon(d, 44, 32, 86, TEAL)
    d.text((150, 75), "개인회생 신청", font=font("EB", 50), fill=WHITE + (255,), anchor="lm")
    return im


def shield_icon(d, cx, cy, sz, col):
    pts = [(cx, cy - sz * 0.5), (cx + sz * 0.42, cy - sz * 0.32), (cx + sz * 0.36, cy + sz * 0.16),
           (cx, cy + sz * 0.5), (cx - sz * 0.36, cy + sz * 0.16), (cx - sz * 0.42, cy - sz * 0.32)]
    d.polygon(pts, fill=col + (255,))
    d.line([(cx - sz * 0.16, cy), (cx - sz * 0.02, cy + sz * 0.14), (cx + sz * 0.2, cy - sz * 0.14)], fill=WHITE + (255,), width=int(sz * 0.1))


def pause_icon(d, cx, cy, sz, col):
    d.ellipse([cx - sz / 2, cy - sz / 2, cx + sz / 2, cy + sz / 2], fill=col + (255,))
    for s in (-1, 1):
        d.rounded_rectangle([cx + s * sz * 0.13 - sz * 0.06, cy - sz * 0.22, cx + s * sz * 0.13 + sz * 0.06, cy + sz * 0.22], 3, fill=WHITE + (255,))


@lru_cache(maxsize=None)
def order_card(kind):
    im, d = overlay(390, 360)
    d.rounded_rectangle([0, 0, 389, 359], 34, fill=WHITE + (255,))
    if kind == 0:
        shield_icon(d, 72, 76, 76, TEAL)
        title, sub = "금지명령", ["새로운 압류를", "막아 달라는 신청"]
    else:
        pause_icon(d, 72, 76, 76, BLUE)
        title, sub = "중지명령", ["진행 중인 압류를", "멈춰 달라는 신청"]
    d.text((34, 150), title, font=font("EB", 50), fill=NAVY_D + (255,))
    for i, ln in enumerate(sub):
        d.text((34, 232 + i * 44), ln, font=font("B", 32), fill=SLATE700 + (255,))
    return im


@lru_cache(maxsize=None)
def with_pill():
    f = font("EB", 36)
    label = "+ 함께 신청"
    tw = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(label, font=f))
    im, d = overlay(tw + 60, 70)
    d.rounded_rectangle([0, 0, tw + 59, 69], 35, fill=TEAL + (255,))
    d.text((30, 35), label, font=f, fill=WHITE + (255,), anchor="lm")
    return im


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    put(frame, top_node(), CAP_X, 640, ease_out((t - TOP_AT) / 0.4))
    # 분기 화살표 (불투명 선, 길이로 애니메이션)
    d = ImageDraw.Draw(frame)
    ap = ease_out((t - (BAN_AT - 0.35)) / 0.45)
    if ap > 0:
        y0, ym = 790, 850
        d.line([(490, y0), (490, lerp(y0, ym, clamp(ap * 2)))], fill=SLATE300, width=8)
        if ap > 0.5:
            q = (ap - 0.5) * 2
            for xe in (285, 695):
                xm = lerp(490, xe, q)
                d.line([(490, ym), (xm, ym)], fill=SLATE300, width=8)
                if q >= 1:
                    d.line([(xe, ym), (xe, 900)], fill=SLATE300, width=8)
                    d.polygon([(xe - 18, 896), (xe + 18, 896), (xe, 920)], fill=SLATE300)
    put(frame, order_card(0), CAP_X, 930, ease_out((t - BAN_AT) / 0.4))
    put(frame, order_card(1), 500, 930, ease_out((t - STAY_AT) / 0.4))
    pill = with_pill()
    put(frame, pill, 490 - pill.width / 2, 815, ease_out((t - WITH_AT) / 0.35), 0)
    if t >= WITH_AT:
        note(frame, 1340)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 저울·법원 아이콘 ────────────────────────────────
Q1_AT = 0.15        # '받아들여질지'
Q2_AT = 1.35        # 실측 1.37s '언제 나올지는'
COURT_AT = 2.4      # 실측 2.39s '법원이 사건별로 판단해요'
FAST_AT = 5.1       # 실측 5.13s '그래서 빨리 확인하는 게'


@lru_cache(maxsize=None)
def court_tile():
    im, d = overlay(380, 300)
    c = SLATE200 + (255,)
    d.polygon([(190, 10), (370, 90), (10, 90)], fill=c)
    d.rectangle([20, 96, 360, 116], fill=c)
    for i in range(4):
        x = 48 + i * 88
        d.rectangle([x, 126, x + 40, 242], fill=c)
    d.rectangle([20, 250, 360, 270], fill=c)
    d.rectangle([0, 276, 380, 296], fill=c)
    d.ellipse([172, 40, 208, 76], fill=NAVY + (255,))
    return im


def scale_tile(ang):
    """기울기 ang(도)인 저울"""
    S = 2
    w, h = 380, 300
    im, d = overlay(w * S, h * S)
    c = SLATE200 + (255,)
    cx, py = 190 * S, 60 * S
    d.rectangle([cx - 6 * S, py, cx + 6 * S, 262 * S], fill=c)
    d.rounded_rectangle([cx - 80 * S, 262 * S, cx + 80 * S, 284 * S], 10 * S, fill=c)
    d.ellipse([cx - 16 * S, py - 16 * S, cx + 16 * S, py + 16 * S], fill=c)
    a = math.radians(ang)
    L = 150 * S
    for sgn in (-1, 1):
        ex, ey = cx + sgn * L * math.cos(a), py + sgn * L * math.sin(a)
        d.line([(cx, py), (ex, ey)], fill=c, width=10 * S)
        d.line([(ex, ey), (ex - 40 * S, ey + 90 * S)], fill=c, width=4 * S)
        d.line([(ex, ey), (ex + 40 * S, ey + 90 * S)], fill=c, width=4 * S)
        d.chord([ex - 56 * S, ey + 60 * S, ex + 56 * S, ey + 120 * S], 0, 180, fill=TEAL + (255,))
    return im.resize((w, h), Image.LANCZOS)


@lru_cache(maxsize=None)
def q_chip(label):
    f = font("EB", 38)
    tw = int(ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(label, font=f))
    im, d = overlay(tw + 60, 84)
    d.rounded_rectangle([0, 0, tw + 59, 83], 26, fill=CARD + (255,), outline=CARD_LINE + (255,), width=3)
    d.text((30, 42), label, font=f, fill=WHITE + (255,), anchor="lm")
    return im


@lru_cache(maxsize=None)
def court_box():
    im, d = overlay(800, 160)
    d.rounded_rectangle([0, 0, 799, 159], 34, fill=TEAL + (255,))
    d.text((40, 48), "법원이 사건별로 판단", font=font("EB", 50), fill=WHITE + (255,), anchor="lm")
    d.text((40, 114), "인정 여부·결정 시점 모두", font=font("B", 32), fill=(240, 253, 250, 255), anchor="lm")
    return im


@lru_cache(maxsize=None)
def fast_box():
    im, d = overlay(800, 110)
    d.rounded_rectangle([0, 0, 799, 109], 30, fill=WHITE + (255,))
    d.ellipse([28, 25, 88, 85], fill=AMBER + (255,))
    d.line([(58, 38), (58, 56), (72, 64)], fill=WHITE + (255,), width=6)
    d.text((110, 55), "통지서 받으면 빨리 확인", font=font("EB", 42), fill=NAVY_D + (255,), anchor="lm")
    return im


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    put(frame, court_tile(), CAP_X, 630, ease_out(t / 0.4))
    ang = 9 * math.sin(t * 1.9) * (1 - 0.8 * ease_out((t - COURT_AT) / 1.0))
    put(frame, scale_tile(round(ang * 2) / 2), 510, 630, ease_out(t / 0.4))
    put(frame, q_chip("받아들여질지?"), CAP_X, 970, ease_out((t - Q1_AT) / 0.35))
    put(frame, q_chip("언제 나올지?"), 530, 970, ease_out((t - Q2_AT) / 0.35))
    put(frame, court_box(), CAP_X, 1090, ease_out((t - COURT_AT) / 0.4))
    put(frame, fast_box(), CAP_X, 1280, ease_out((t - FAST_AT) / 0.4))
    note(frame, 1430, "※ 법원·사건마다 다를 수 있음")
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 익명 체크 → 상담 요청 (데모) → 엔드카드 ─────────────
QS = [("급여 압류 통지서", ("받음", "아직"), 0.3),
      ("소득 형태", ("급여", "사업"), 0.6),
      ("연체", ("있음", "없음"), 0.9)]
RESULT_AT = 1.3
TAP_AT = 2.2
XF_AT, XF_LEN = 3.7, 0.35   # 엔드카드 전환


def screen_check(t):
    s = Scr(SLATE50)
    s.status()
    s.text(36, 100, "익명 채무 체크", 40, SLATE900, "EB")
    s.text(36, 160, "이름·번호 없이 상황만 정리", 22, SLATE500, "B")
    for i, (q, opts, at) in enumerate(QS):
        y = 206 + i * 128
        s.rr(28, y, SW - 28, y + 112, 24, fill=WHITE, outline=SLATE200, width=2)
        s.text(56, y + 56, q, 26, SLATE900, "EB", "lm")
        on = t >= at
        for j, op in enumerate(opts):
            x1 = SW - 52 - (1 - j) * 108  # 왼쪽 = 선택지 0
            x0 = x1 - 96
            if j == 0 and on:
                s.rr(x0, y + 32, x1, y + 80, 22, fill=TEAL)
                s.text((x0 + x1) / 2, y + 56, op, 22, WHITE, "EB", "mm")
            else:
                s.rr(x0, y + 32, x1, y + 80, 22, outline=SLATE300, width=2)
                s.text((x0 + x1) / 2, y + 56, op, 22, SLATE500, "B", "mm")
    rp = ease_out((t - RESULT_AT) / 0.35)
    if rp > 0:
        y = 606 + (1 - rp) * 30
        s.rr(28, y, SW - 28, y + 240, 28, fill=lerp_color(SLATE50, (240, 253, 250), rp), outline=lerp_color(SLATE50, TEAL, rp), width=3)
        s.circ(76, y + 48, 24, fill=lerp_color(SLATE50, TEAL, rp))
        check_icon(s, 76, y + 49, 24, WHITE, 5)
        s.text(116, y + 48, "내 상황 정리 완료", 28, lerp_color(SLATE50, SLATE900, rp), "EB", "lm")
        s.text(56, y + 104, "변호사와 확인할 항목", 22, lerp_color(SLATE50, SLATE500, rp), "B", "lm")
        s.text(56, y + 150, "· 금지·중지명령 신청 여부", 24, lerp_color(SLATE50, SLATE900, rp), "B", "lm")
        s.text(56, y + 194, "· 개인회생 등 절차 경로", 24, lerp_color(SLATE50, SLATE900, rp), "B", "lm")
    ready = t >= RESULT_AT + 0.3
    pressed = TAP_AT <= t < TAP_AT + 0.25
    s.rr(28, 880, SW - 28, 976, 26, fill=BLUE_D if pressed else (BLUE if ready else SLATE300))
    s.text(SW / 2, 928, "상담 요청하기", 32, WHITE, "EB", "mm")
    s.text(SW / 2, 1012, "변호사에게는 가명으로 전달돼요", 20, SLATE500, "B", "mm")
    if t >= TAP_AT + 0.3:
        p = ease_out((t - TAP_AT - 0.3) / 0.35)
        y = lerp(-120, 70, p)
        s.rr(28, y, SW - 28, y + 96, 28, fill=SLATE900)
        s.circ(84, y + 48, 24, fill=TEAL)
        check_icon(s, 84, y + 49, 24, WHITE, 5)
        s.text(126, y + 30, "상담 요청 완료", 26, WHITE, "EB")
        s.text(126, y + 64, "선택한 변호사가 확인해요", 20, SLATE300, "B")
    return s.final()


def phone_part(t):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_check(t), 0, 0)
    tap(frame, SW / 2, 928, t - TAP_AT)
    draw_caption(frame, SCENES[4]["caption"], t)
    return frame


def scene5(t, dur):
    if t < XF_AT:
        return phone_part(t)
    end = ep01_endcard(t - XF_AT, dur - XF_AT)
    p = (t - XF_AT) / XF_LEN
    if p >= 1:
        return end
    return Image.blend(phone_part(t).convert("RGB"), end.convert("RGB"), ease_in_out(p)).convert("RGBA")


def main():
    base.EP = EP
    base.OUT = base.ROOT / "assets" / "shorts" / EP
    base.TMP = base.OUT / "_work"
    base.SCENES = SCENES
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    # 동시 렌더로 메모리가 부족한 환경 대비: x264 스레드 수만 제한 (render_ep01.py 는 수정하지 않음)
    popen = base.subprocess.Popen

    def popen_lowmem(cmd, *a, **kw):
        if isinstance(cmd, list) and "libx264" in cmd:
            i = cmd.index("libx264") + 1
            cmd = cmd[:i] + ["-threads", "2"] + cmd[i:]
        return popen(cmd, *a, **kw)

    base.subprocess.Popen = popen_lowmem
    try:
        base.main()
    finally:
        base.subprocess.Popen = popen


if __name__ == "__main__":
    main()
