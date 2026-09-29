# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP08 렌더러
기획: docs/youtube_shorts_plan.md  #8 "진술서 쓰다 밤새우지 마세요" (포맷 B: 폰 화면 데모)

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
출력: assets/shorts/ep08/
실행: python scripts/shorts/render_ep08.py

주의: AI 음성 진술서는 '초안 보조' 기능. 최종 검토는 선택한 변호사라는 점을 화면에 명시한다.
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, check_icon, scene5 as ep01_endcard,
)

EP = "ep08"

SCENES = [
    dict(plan=3.0, caption="진술서,\n첫 줄부터 [막막]",
         narration="진술서, 첫 줄부터 막막하셨죠?",
         tts="진술서, 첫 줄부터 막막하셨죠?"),
    dict(plan=5.9, caption="서류는\n[수십 가지]",
         narration="떼야 할 서류도 많고, 무슨 말을 써야 할지도 모르겠고요.",
         tts="떼야 할 서류도 많고, 무슨 말을 써야 할지도 모르겠고요."),
    dict(plan=8.0, caption="말로 설명하면\n[초안]까지",
         narration="마이김변에선 사정을 말로 설명하면 진술서 초안이 만들어져요.",
         tts="마이김변에선 사정을 말로 설명하면 진술서 초안이 만들어져요."),
    dict(plan=8.0, caption="제출 서류도\n[한곳에]",
         narration="제출할 서류도 한곳에서 정리하고, 최종 검토는 선택한 변호사가 합니다.",
         tts="제출할 서류도 한곳에서 정리하고, 최종 검토는 선택한 변호사가 합니다."),
    dict(plan=6.0, caption="오늘 밤은\n[주무세요]",
         narration="오늘 밤은 진술서 대신 잠을 챙기세요.",
         tts="오늘 밤은 진술서 대신 잠을 챙기세요."),
]

AMBER_L = (0xFE, 0xF3, 0xC7)
AMBER_D = (0xB4, 0x53, 0x09)
ROSE = (0xF4, 0x3F, 0x5E)


def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


@lru_cache(maxsize=None)
def top_shade_layer(h=640, a=150):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    return sh.filter(ImageFilter.GaussianBlur(80))


# ── 장면 1: 빈 진술서 문서 + 깜빡이는 커서 (zoom-in) ─────────────
PAPER = (150, 650, 930, 1660)


@lru_cache(maxsize=None)
def scene1_static():
    img = background().copy().convert("RGBA")
    # 스탠드 조명 느낌
    ov, d = overlay()
    d.ellipse([60, 520, 1020, 1500], fill=(251, 191, 120, 34))
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(120)))
    # 종이 그림자
    ov, d = overlay()
    x0, y0, x1, y1 = PAPER
    d.rounded_rectangle([x0 + 10, y0 + 26, x1 + 10, y1 + 26], 26, fill=(0, 0, 0, 150))
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(24)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(PAPER, 26, fill=(250, 250, 247, 255))
    d.text((540, 750), "진술서", font=font("EB", 60), fill=SLATE900, anchor="mm")
    d.line([(220, 812), (860, 812)], fill=SLATE300, width=3)
    d.text((215, 850), "1. 채무 발생 경위", font=font("B", 36), fill=SLATE500)
    d.text((865, 858), "새벽 2:14", font=font("B", 28), fill=SLATE400, anchor="ra")
    for y in range(990, 1620, 72):
        d.line([(215, y), (865, y)], fill=(226, 232, 240), width=2)
    return img


def scene1(t, dur):
    frame = scene1_static().copy()
    d = ImageDraw.Draw(frame)
    # '저는' 입력 → 멈칫 → 지움
    word = "저는"
    if 0.7 <= t < 1.1:
        typed = word[: 1 + int((t - 0.7) / 0.2)]
    elif 1.1 <= t < 2.0:
        typed = word
    elif 2.0 <= t < 2.4:
        typed = word[: max(0, 2 - 1 - int((t - 2.0) / 0.2))]
    else:
        typed = ""
    f = font("B", 40)
    x = 218
    if typed:
        d.text((x, 925), typed, font=f, fill=SLATE900, anchor="lm")
        x += d.textlength(typed, font=f) + 6
    if int(t * 2.4) % 2 == 0 or 0.7 <= t < 2.4:
        d.rectangle([x, 900, x + 5, 952], fill=BLUE)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.08 * ease_in_out(t / dur), W / 2, 1150).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 2: 쌓여 가는 서류 더미 (zoom-out) ──────────────────────
PILE = [  # (라벨, 중심x, 중심y, 각도, 등장시각)
    ("주민등록등본", 330, 930, 9, 0.00),
    ("소득 증빙", 720, 900, -8, 0.15),
    ("재직증명서", 520, 1010, 3, 0.30),
    ("통장 거래내역", 300, 1190, -12, 0.45),
    ("부채증명서", 760, 1170, 11, 0.60),
    ("가족관계증명서", 540, 1260, -4, 0.75),
    ("임대차계약서", 360, 1400, 6, 0.90),
    ("급여명세서", 720, 1390, -7, 1.05),
    ("건강보험 납부확인", 540, 1120, 14, 1.20),
    ("재산 관련 자료", 560, 1480, -2, 1.35),
]
Q_AT = 1.72  # 내레이션 '무슨 말을 써야 할지…' 시작 (실측)


@lru_cache(maxsize=None)
def paper_tile(i):
    label, _, _, ang, _ = PILE[i]
    S = 2
    w, h = 330, 420
    m = 40
    im = Image.new("RGBA", ((w + m * 2) * S, (h + m * 2) * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([(m + 6) * S, (m + 14) * S, (m + w + 6) * S, (m + h + 14) * S], 16 * S, fill=(0, 0, 0, 120))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * S)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([m * S, m * S, (m + w) * S, (m + h) * S], 16 * S, fill=(252, 252, 250, 255), outline=(203, 213, 225, 255), width=2 * S)
    d.rectangle([m * S, (m + 18) * S, (m + w) * S, (m + 26) * S], fill=TEAL + (255,))
    d.text(((m + w / 2) * S, (m + 76) * S), label, font=font("EB", 30 * S), fill=SLATE900 + (255,), anchor="mm")
    d.text(((m + w / 2) * S, (m + 116) * S), "(예시)", font=font("B", 20 * S), fill=SLATE400 + (255,), anchor="mm")
    for j in range(6):
        ww = [250, 230, 250, 190, 240, 150][j]
        y = m + 160 + j * 38
        d.rounded_rectangle([(m + 40) * S, y * S, (m + 40 + ww) * S, (y + 12) * S], 6 * S, fill=(226, 232, 240, 255))
    d.rounded_rectangle([(m + w - 110) * S, (m + h - 70) * S, (m + w - 40) * S, (m + h - 30) * S], 8 * S, outline=(239, 68, 68, 255), width=3 * S)
    im = im.resize((w + m * 2, h + m * 2), Image.LANCZOS)
    return im.rotate(ang, resample=Image.BICUBIC, expand=True)


def scene2(t, dur):
    frame = background().copy().convert("RGBA")
    for i, (_, cx, cy, _, at) in enumerate(PILE):
        p = ease_out((t - at) / 0.3)
        if p <= 0:
            continue
        tile = paper_tile(i)
        if p < 1:
            tile = tile.copy()
            tile.putalpha(tile.getchannel("A").point(lambda v, p=p: int(v * p)))
        frame.alpha_composite(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2 - (1 - p) * 120)))
    # 물음표 (무슨 말을 써야 할지)
    qp = ease_out((t - Q_AT) / 0.4)
    if qp > 0:
        ov, d = overlay()
        for k, (x, y, sz) in enumerate([(210, 780, 110), (800, 760, 90), (860, 1060, 76)]):
            pk = ease_out((t - Q_AT - k * 0.15) / 0.35)
            if pk <= 0:
                continue
            a = int(255 * pk)
            yy = y + math.sin(t * 2.2 + k) * 8
            d.ellipse([x - sz * 0.62, yy - sz * 0.62, x + sz * 0.62, yy + sz * 0.62], fill=(245, 158, 11, a))
            d.text((x, yy), "?", font=font("EB", int(sz)), fill=NAVY_D + (a,), anchor="mm")
        frame.alpha_composite(ov)
    frame = zoom(frame.convert("RGB"), 1.28 - 0.28 * ease_out(t / (dur * 0.9)), W / 2, 760).convert("RGBA")  # 상단 기준 → 자막 영역 침범 방지
    frame.alpha_composite(top_shade_layer(640, 170))
    draw_caption(frame, SCENES[1]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 3: AI 음성 진술서 (마이크 → 음성 입력 → 초안) ─────────────
MIC_TAP = 0.35
SPEAK = (0.5, 2.3)  # '사정을 말로 설명하면' 0.18~2.42s
GEN_TAP = 2.45
DRAFT_AT = 2.7  # '진술서 초안이 만들어져요' 2.70s~
NOTE_AT = 4.5
MIC_C = (SW / 2, 470)
BTN_Y = 945
TRANSCRIPT = ["가게 매출이 줄면서 카드로", "생활비와 월세를 막다 보니", "돌려 막기가 늘었어요."]
DRAFT = ["신청인은 운영하던 가게의 매출이", "줄어들자 생활비와 월세를 신용", "카드로 충당하였고, 이후 카드", "대금을 다른 카드로 막으면서", "채무가 늘어났습니다."]


def mic_icon(s: Scr, cx, cy, sz, color):
    s.rr(cx - sz * 0.2, cy - sz * 0.52, cx + sz * 0.2, cy + sz * 0.12, sz * 0.2, fill=color)
    s.arc((cx - sz * 0.36, cy - sz * 0.3, cx + sz * 0.36, cy + sz * 0.32), 0, 180, color, sz * 0.08)
    s.line([(cx, cy + sz * 0.32), (cx, cy + sz * 0.48)], color, sz * 0.08)
    s.line([(cx - sz * 0.2, cy + sz * 0.5), (cx + sz * 0.2, cy + sz * 0.5)], color, sz * 0.08)


def pill(s: Scr, x, y, text, size, bg, fg, h=40, anchor_right=False):
    tw = s.tlen(text, size, "EB")
    if anchor_right:
        x = x - tw - 32
    s.rr(x, y, x + tw + 32, y + h, h / 2, fill=bg)
    s.text(x + 16, y + h / 2, text, size, fg, "EB", "lm")
    return x + tw + 32


def screen_voice(t):
    s = Scr(SLATE50)
    s.status()
    s.line([(48, 112), (34, 126), (48, 140)], SLATE900, 5)
    s.text(SW / 2, 126, "AI 음성 진술서", 32, SLATE900, "EB", "mm")
    drafting = t >= DRAFT_AT
    nx = pill(s, 28, 176, "3. 말로 사연 입력", 20, SLATE200 if drafting else TEAL_L, SLATE500 if drafting else TEAL_D)
    pill(s, nx + 10, 176, "4. AI 초안 & 검토", 20, TEAL_L if drafting else SLATE100, TEAL_D if drafting else SLATE400)

    # 질문 카드
    s.rr(28, 238, SW - 28, 360, 26, fill=WHITE, outline=SLATE200, width=2)
    s.text(56, 268, "Q.", 28, BLUE, "EB")
    s.text(104, 268, "빚이 생기게 된 사정을", 26, SLATE900, "EB")
    s.text(104, 308, "편하게 말해 주세요", 26, SLATE900, "EB")

    # 마이크
    listening = MIC_TAP <= t < GEN_TAP
    cx, cy = MIC_C
    if listening:
        for k in range(2):
            rp = ((t - MIC_TAP) * 1.1 + k * 0.5) % 1
            s.circ(cx, cy, 70 + 46 * rp, outline=lerp_color(ROSE, SLATE50, rp), width=4)
    s.circ(cx, cy, 70, fill=ROSE if listening else (BLUE if t < MIC_TAP else SLATE300))
    mic_icon(s, cx, cy, 70, WHITE)
    # 파형
    for i in range(23):
        x = SW / 2 + (i - 11) * 18
        if SPEAK[0] <= t < SPEAK[1]:
            amp = 0.35 + 0.65 * abs(math.sin(t * 9 + i * 0.9) * math.sin(t * 4.3 + i * 0.37))
        else:
            amp = 0.08
        hh = 6 + 42 * amp * (1 - abs(i - 11) / 14)
        s.rr(x - 4, 580 - hh / 2, x + 4, 580 + hh / 2, 4, fill=ROSE if listening else SLATE300)
    lab = "눌러서 말하기" if t < MIC_TAP else ("듣고 있어요" if listening else "녹음 완료")
    s.text(SW / 2, 634, lab, 22, SLATE500, "B", "mm")

    # 음성 인식 결과
    s.rr(28, 666, SW - 28, 880, 26, fill=WHITE, outline=SLATE200, width=2)
    s.text(56, 690, "음성 인식 결과 · 직접 수정 가능", 19, SLATE500, "B")
    total = sum(len(ln) for ln in TRANSCRIPT)
    n = int(clamp((t - SPEAK[0]) / (SPEAK[1] - SPEAK[0])) * total)
    for i, ln in enumerate(TRANSCRIPT):
        show = ln[: max(0, n)]
        n -= len(ln)
        if show:
            s.text(56, 740 + i * 42, show, 25, SLATE900, "B")

    # 버튼
    ready = t >= SPEAK[1]
    pressed = GEN_TAP <= t < GEN_TAP + 0.25
    s.rr(28, BTN_Y - 46, SW - 28, BTN_Y + 46, 26, fill=BLUE_D if pressed else (BLUE if ready else SLATE300))
    s.text(SW / 2, BTN_Y, "진술서 초안 만들기", 30, WHITE, "EB", "mm")

    # 초안 시트
    if drafting:
        p = ease_out((t - DRAFT_AT) / 0.45)
        y0 = lerp(SH, 230, p)
        s.rr(12, y0 - 4, SW - 12, SH + 60, 36, fill=SLATE200)
        s.rr(14, y0, SW - 14, SH + 60, 34, fill=WHITE)
        s.rr(SW / 2 - 40, y0 + 14, SW / 2 + 40, y0 + 22, 4, fill=SLATE300)
        s.text(44, y0 + 44, "진술서 초안", 34, SLATE900, "EB")
        pill(s, SW - 44, y0 + 44, "초안", 22, AMBER_L, AMBER_D, h=42, anchor_right=True)
        s.text(44, y0 + 98, "말씀하신 내용을 바탕으로 정리했어요", 21, SLATE500, "B")
        s.line([(44, y0 + 140), (SW - 44, y0 + 140)], SLATE100, 2)
        s.text(44, y0 + 160, "채무 발생 경위", 24, SLATE700, "EB")
        total = sum(len(ln) for ln in DRAFT)
        n = int(clamp((t - DRAFT_AT - 0.4) / 1.3) * total)
        for i, ln in enumerate(DRAFT):
            show = ln[: max(0, n)]
            n -= len(ln)
            if show:
                s.text(44, y0 + 206 + i * 40, show, 23, SLATE900, "R")
        # 최종 검토 안내 (초안 보조 명시)
        npv = ease_out((t - NOTE_AT) / 0.35)
        ny = y0 + 430
        s.rr(28, ny, SW - 28, ny + 118, 24, fill=lerp_color(WHITE, TEAL_L, npv), outline=lerp_color(SLATE200, TEAL, npv), width=3)
        s.circ(84, ny + 59, 30, fill=lerp_color(SLATE300, TEAL, npv))
        check_icon(s, 84, ny + 60, 30, WHITE, 5)
        s.text(130, ny + 40, "최종 검토는 선택한 변호사가", 25, TEAL_D if npv > 0.5 else SLATE400, "EB", "lm")
        s.text(130, ny + 80, "초안은 언제든 고칠 수 있어요", 20, SLATE500, "B", "lm")
    return s.final()


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_voice(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, MIC_C[0], MIC_C[1], t - MIC_TAP)
    tap(frame, SW / 2, BTN_Y, t - GEN_TAP)
    draw_caption(frame, SCENES[2]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 4: 서류 허브 (제출 서류 목록 체크) ─────────────────────
HUB_DOCS = [("주민등록등본", 0.5), ("가족관계증명서", 0.85), ("소득 증빙", 1.2), ("재직증명서", 1.55), ("통장 거래내역", 1.9)]
REVIEW_AT = 2.6  # '최종 검토는…' 2.63s~
SEND_TAP = 4.9
SEND_Y = 960


def doc_glyph(s: Scr, x, y, col):
    s.rr(x, y, x + 34, y + 44, 6, fill=WHITE, outline=col, width=3)
    for j in range(3):
        s.line([(x + 8, y + 14 + j * 9), (x + 26 - (j == 2) * 8, y + 14 + j * 9)], col, 3)


def screen_hub(t):
    s = Scr(SLATE50)
    s.status()
    s.line([(48, 112), (34, 126), (48, 140)], SLATE900, 5)
    s.text(SW / 2, 126, "서류 허브", 32, SLATE900, "EB", "mm")
    s.text(36, 180, "제출 서류를 한곳에서 정리해요", 24, SLATE500, "B")
    # 진행 바 (숫자 표기 없음)
    done = sum(ease_out((t - at) / 0.3) for _, at in HUB_DOCS)
    frac = (done + (1 if t >= REVIEW_AT else 0) * 0.5) / (len(HUB_DOCS) + 1)
    s.rr(36, 222, SW - 36, 238, 8, fill=SLATE200)
    s.rr(36, 222, 36 + max(16, (SW - 72) * frac), 238, 8, fill=TEAL)
    s.text(36, 262, "서류 목록 (예시)", 21, SLATE500, "B")
    rows = HUB_DOCS + [("진술서 초안", None)]
    for i, (name, at) in enumerate(rows):
        y = 300 + i * 84
        s.rr(28, y, SW - 28, y + 72, 20, fill=WHITE, outline=SLATE200, width=2)
        if at is None:
            doc_glyph(s, 52, y + 14, AMBER_D)
            s.text(104, y + 36, name, 25, SLATE900, "EB", "lm")
            if t >= REVIEW_AT:
                pr = ease_out((t - REVIEW_AT) / 0.3)
                pill(s, SW - 44, y + 17, "변호사 검토", 19, lerp_color(SLATE100, AMBER_L, pr), lerp_color(SLATE400, AMBER_D, pr), h=38, anchor_right=True)
            else:
                pill(s, SW - 44, y + 17, "작성 완료", 19, SLATE100, SLATE500, h=38, anchor_right=True)
            continue
        p = ease_out((t - at) / 0.3)
        doc_glyph(s, 52, y + 14, TEAL if p > 0.5 else SLATE400)
        s.text(104, y + 36, name, 25, SLATE900, "EB", "lm")
        cx, cy = SW - 72, y + 36
        s.text(cx - 40, cy, "완료" if p > 0.5 else "준비 중", 20, TEAL_D if p > 0.5 else SLATE400, "B", "rm")
        if p > 0:
            s.circ(cx, cy, 17 * (0.6 + 0.4 * p), fill=TEAL)
            if p > 0.5:
                check_icon(s, cx, cy + 1, 17, WHITE, 4)
        else:
            s.circ(cx, cy, 17, outline=SLATE300, width=3)
    # 최종 검토 안내
    rp = ease_out((t - REVIEW_AT) / 0.4)
    if rp > 0:
        y = 812 + (1 - rp) * 20
        s.rr(28, y, SW - 28, y + 92, 24, fill=lerp_color(SLATE50, SLATE900, rp))
        s.text(56, y + 32, "최종 검토: 선택한 변호사", 25, lerp_color(SLATE50, WHITE, rp), "EB", "lm")
        s.text(56, y + 66, "초안과 서류는 변호사와 함께 확인해요", 19, lerp_color(SLATE50, SLATE300, rp), "B", "lm")
    # 전달 버튼
    pressed = SEND_TAP <= t < SEND_TAP + 0.25
    s.rr(28, SEND_Y - 44, SW - 28, SEND_Y + 44, 26, fill=BLUE_D if pressed else BLUE)
    s.text(SW / 2, SEND_Y, "선택한 변호사에게 전달", 28, WHITE, "EB", "mm")
    # 완료 토스트
    if t >= SEND_TAP + 0.4:
        p = ease_out((t - SEND_TAP - 0.4) / 0.35)
        y = lerp(-120, 70, p)
        s.rr(28, y, SW - 28, y + 96, 28, fill=SLATE900)
        s.circ(84, y + 48, 24, fill=TEAL)
        check_icon(s, 84, y + 49, 24, WHITE, 5)
        s.text(126, y + 30, "전달 완료", 26, WHITE, "EB")
        s.text(126, y + 64, "선택한 변호사가 검토해요", 20, SLATE300, "B")
    return s.final()


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_hub(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, SEND_Y, t - SEND_TAP)
    draw_caption(frame, SCENES[3]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
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
    # 여러 편을 동시에 렌더링하면 메모리가 부족해 x264가 실패할 수 있어,
    # 이 프로세스의 인코더만 스레드·lookahead를 줄여 실행한다 (출력 규격은 동일, render_ep01.py 파일은 그대로).
    _popen = base.subprocess.Popen

    def lean_popen(cmd, *a, **kw):
        if cmd and cmd[0] == "ffmpeg" and "libx264" in cmd:
            i = cmd.index("libx264") + 1
            cmd = cmd[:i] + ["-threads", "2", "-x264-params", "rc-lookahead=10"] + cmd[i:]
        return _popen(cmd, *a, **kw)

    base.subprocess.Popen = lean_popen
    base.main()


if __name__ == "__main__":
    main()
