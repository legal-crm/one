# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP04 렌더러
기획: docs/youtube_shorts_plan.md  #4 "변호사 한 명 말만 듣고 정하셨나요?" (포맷 B: 폰 화면 데모)

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
비교 대상은 답변과 프로필로 한정한다(가격·견적 표현 없음).
출력: assets/shorts/ep04/
실행: python scripts/shorts/render_ep04.py
"""
import math
import random
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
    draw_caption, chip, put_phone, tap, avatar, check_icon, vgradient, scene5 as ep01_endcard,
)

EP = "ep04"

SCENES = [
    dict(plan=3.0, caption="한 곳 말만 듣고\n[결정?]",
         narration="변호사, 한 곳 말만 듣고 정하셨나요?",
         tts="변호사, 한 곳 말만 듣고 정하셨나요?"),
    dict(plan=5.5, caption="비교할 방법이\n[없었죠]",
         narration="다른 의견을 들어볼 방법이 마땅치 않았죠.",
         tts="다른 의견을 들어볼 방법이 마땅치 않았죠."),
    dict(plan=7.5, caption="최대 [3명],\n한 번에 요청",
         narration="마이김변에서는 프로필을 보고 최대 세 명까지 골라 한 번에 상담을 요청해요.",
         tts="마이김변에서는 프로필을 보고 최대 세 명까지 골라 한 번에 상담을 요청해요."),
    dict(plan=8.0, caption="답변을\n[나란히 비교]",
         narration="답변을 나란히 비교하고, 원할 때만 상담을 이어가면 됩니다. 선임 강요는 없어요.",
         tts="답변을 나란히 비교하고, 원할 때만 상담을 이어가면 됩니다. 선임 강요는 없어요."),
    dict(plan=5.5, caption="선택은\n[내가 합니다]",
         narration="내 사건, 내가 고르세요.",
         tts="내 사건, 내가 고르세요."),
]

# 더미 변호사 (실존 인물 아님, 실루엣 아바타)
LAWYERS = [
    ("예시 변호사 A", "개인회생·파산 사건 경험", ["서울", "상담방 답변"], (219, 234, 254), (96, 165, 250)),
    ("예시 변호사 B", "개인회생 사건 경험", ["경기", "야간 상담"], (204, 251, 241), (45, 212, 191)),
    ("예시 변호사 C", "채무조정·파산 사건 경험", ["부산", "상담방 답변"], (237, 233, 254), (167, 139, 250)),
    ("예시 변호사 D", "개인파산 사건 경험", ["인천", "주말 상담"], (254, 243, 199), (251, 191, 36)),
]


def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


def fade(img, p):
    """RGBA 이미지 전체 알파에 p 곱하기"""
    if p >= 1:
        return img
    out = img.copy()
    out.putalpha(img.getchannel("A").point(lambda v: int(v * p)))
    return out


def tags_row(s: Scr, x, y, tags, size=20, dim=False):
    for tg in tags:
        tw = s.tlen(tg, size)
        s.rr(x, y, x + tw + 28, y + 38, 14, fill=SLATE100 if not dim else SLATE50)
        s.text(x + 14, y + 19, tg, size, SLATE700 if not dim else SLATE400, "B", "lm")
        x += tw + 40


# ── 장면 1: 변호사 카드 1장 → 3장으로 펼쳐짐 ─────────────────────
SPREAD_AT = 1.85  # 펼침 시작: '듣고 정하셨나요' (실측 1.85s)
SPREAD_LEN = 0.5


def profile_card(s: Scr, x0, y, x1, lw, h=190):
    name, exp, tags, bg, fg = lw
    s.rr(x0, y, x1, y + h, 30, fill=WHITE, outline=SLATE200, width=2)
    avatar(s, x0 + 72, y + 78, 46, bg, fg)
    s.text(x0 + 138, y + 44, name, 30, SLATE900, "EB", "lm")
    s.text(x0 + 138, y + 88, exp, 22, SLATE500, "B", "lm")
    tags_row(s, x0 + 32, y + 134, tags)


def screen_spread(t):
    s = Scr(SLATE50)
    s.status()
    p = ease_in_out((t - SPREAD_AT) / SPREAD_LEN)
    n = 3 if p >= 0.5 else 1
    s.text(36, 110, "들어본 의견", 42, SLATE900, "EB", "lm")
    s.rr(SW - 150, 88, SW - 36, 132, 22, fill=TEAL_L if n == 3 else SLATE200)
    s.text(SW - 93, 110, f"{n}곳", 24, TEAL_D if n == 3 else SLATE500, "EB", "mm")
    s.text(36, 170, "한 곳 의견만 들었어요" if n == 1 else "다른 의견도 함께 보면", 24, SLATE500, "B", "lm")
    finals = [236, 452, 668]
    mid = 452
    # 뒤 카드(0, 2) 먼저, 가운데(1) 마지막 → 겹침 순서
    for i, inset, off in [(0, 24, 26), (2, 12, 13)]:
        y = lerp(mid + off, finals[i], p)
        ins = lerp(inset, 0, p)
        profile_card(s, 28 + ins, y, SW - 28 - ins, LAWYERS[i])
    profile_card(s, 28, mid, SW - 28, LAWYERS[1])
    return s.final()


def scene1(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_spread(t), 0, 0)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.06 * ease_in_out(t / dur), W / 2, H).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 2: 고민하는 손 (예시 장면) ─────────────────────────────
# 내레이션 '다른 의견을…'에 맞춰 빈 카드 2장이 떠오름
GHOST_AT = [0.35, 0.95]  # '다른 의견을' 실측 0.17s~
DESK_Y = 1060


@lru_cache(maxsize=None)
def desk_scene():
    img = background().copy().convert("RGBA")
    ov, d = overlay()
    d.polygon([(-40, DESK_Y), (W + 40, DESK_Y), (W + 260, H + 20), (-260, H + 20)], fill=(78, 60, 50, 255))
    d.rectangle([-40, DESK_Y - 10, W + 40, DESK_Y + 8], fill=(104, 80, 64, 255))
    rnd = random.Random(4)
    for _ in range(22):
        y = rnd.randint(DESK_Y + 40, H)
        d.line([(-100, y), (W + 100, y + rnd.randint(-18, 18))], fill=(70, 53, 44, 255), width=rnd.randint(2, 4))
    img.alpha_composite(ov)
    # 책상 위 스탠드 빛
    glow, g = overlay()
    g.ellipse([120, 980, 960, 1700], fill=(251, 191, 120, 40))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(100)))
    # 상담 메모(예시) 한 장
    S = 2
    mw, mh = 420, 470
    memo = Image.new("RGBA", ((mw + 60) * S, (mh + 60) * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", memo.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([36 * S, 44 * S, (mw + 36) * S, (mh + 44) * S], 16 * S, fill=(0, 0, 0, 120))
    memo.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * S)))
    md = ImageDraw.Draw(memo)
    md.rounded_rectangle([30 * S, 30 * S, (mw + 30) * S, (mh + 30) * S], 16 * S, fill=(250, 250, 247, 255))
    md.text((64 * S, 70 * S), "상담 메모", font=font("EB", 36 * S), fill=SLATE900 + (255,))
    md.ellipse([64 * S, 150 * S, 84 * S, 170 * S], fill=TEAL + (255,))
    md.text((98 * S, 142 * S), "예시 사무소 A 의견", font=font("B", 28 * S), fill=SLATE700 + (255,))
    for j, ww in enumerate([330, 300, 340, 250]):
        yy = 206 + j * 44
        md.rounded_rectangle([64 * S, yy * S, (64 + ww) * S, (yy + 14) * S], 7 * S, fill=SLATE200 + (255,))
    md.text((64 * S, 400 * S), "다른 의견은…?", font=font("B", 28 * S), fill=SLATE400 + (255,))
    memo = memo.resize((mw + 60, mh + 60), Image.LANCZOS).rotate(5, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(memo, (110, 1090))
    # 펜
    pen, pd = overlay(360, 80)
    pd.rounded_rectangle([10, 26, 300, 50], 12, fill=(30, 41, 59, 255))
    pd.polygon([(300, 26), (340, 38), (300, 50)], fill=(203, 213, 225, 255))
    pd.rounded_rectangle([40, 22, 120, 30], 4, fill=(148, 163, 184, 255))
    img.alpha_composite(pen.rotate(-28, resample=Image.BICUBIC, expand=True), (560, 1500))
    return img


SKIN = (233, 196, 168, 255)
SKIN_D = (206, 165, 136, 255)


@lru_cache(maxsize=64)
def hand_img(lifts):
    """위에서 본 손등(평면 일러스트). lifts: 손가락 4개 들림 정도(0~6 정수)"""
    S = 2
    w, h = 380, 560
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    d = ImageDraw.Draw(im)
    fx = [118, 170, 222, 272]
    flen = [150, 178, 170, 128]
    fw = 46
    for i, (x, ln) in enumerate(zip(fx, flen)):
        lift = lifts[i] * 2
        top = 250 - ln + lift
        # 손가락 끝 그림자: 들리면 옅어지고 아래로 벌어짐
        sa = 90 - lifts[i] * 12
        so = lifts[i] * 3
        sd.ellipse([(x - 22 + so) * S, (top - 4 + so) * S, (x + 26 + so) * S, (top + 30 + so) * S], fill=(0, 0, 0, sa))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6 * S)))
    for i, (x, ln) in enumerate(zip(fx, flen)):
        lift = lifts[i] * 2
        top = 250 - ln + lift
        col = SKIN if lift == 0 else (240, 208, 182, 255)
        d.rounded_rectangle([(x - fw / 2) * S, top * S, (x + fw / 2) * S, 300 * S], int(fw / 2 * S), fill=col)
        d.rounded_rectangle([(x - 12) * S, (top + 8) * S, (x + 12) * S, (top + 30) * S], 8 * S, fill=(245, 222, 204, 255))
    # 엄지
    d.ellipse([46 * S, 250 * S, 128 * S, 380 * S], fill=SKIN)
    # 손등
    d.rounded_rectangle([92 * S, 214 * S, 302 * S, 420 * S], 80 * S, fill=SKIN)
    for x in fx:
        d.arc([(x - 16) * S, 232 * S, (x + 16) * S, 252 * S], 200, 340, fill=SKIN_D, width=3 * S)
    # 소매
    d.rounded_rectangle([96 * S, 400 * S, 300 * S, 580 * S], 30 * S, fill=(51, 65, 85, 255))
    d.rounded_rectangle([88 * S, 392 * S, 308 * S, 432 * S], 16 * S, fill=(71, 85, 105, 255))
    im = im.resize((w, h), Image.LANCZOS)
    return im.rotate(24, resample=Image.BICUBIC, expand=True)


def dashed_rrect(d, box, color, width=4, dash=18, gap=12):
    x0, y0, x1, y1 = box
    for (ax, ay, bx, by) in [(x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)]:
        ln = math.hypot(bx - ax, by - ay)
        k = 0.0
        while k < ln:
            e = min(ln, k + dash)
            d.line([(ax + (bx - ax) * k / ln, ay + (by - ay) * k / ln),
                    (ax + (bx - ax) * e / ln, ay + (by - ay) * e / ln)], fill=color, width=width)
            k += dash + gap


@lru_cache(maxsize=None)
def ghost_card():
    """'다른 의견?' 빈 카드 (불투명 요소만)"""
    cw, ch = 300, 250
    im, d = overlay(cw, ch)
    d.rectangle([6, 6, cw - 6, ch - 6], fill=(22, 44, 74, 255))
    dashed_rrect(d, (6, 6, cw - 6, ch - 6), (148, 163, 184, 255), 4)
    d.ellipse([cw / 2 - 44, 38, cw / 2 + 44, 126], fill=(51, 72, 102, 255))
    d.text((cw / 2, 84), "?", font=font("EB", 64), fill=SLATE300 + (255,), anchor="mm")
    d.text((cw / 2, 180), "다른 의견", font=font("EB", 36), fill=SLATE200 + (255,), anchor="mm")
    return im


def scene2(t, dur):
    frame = desk_scene().copy()
    # 빈 카드 2장 (책상 위 공중)
    for i, (x, at) in enumerate(zip([150, 560], GHOST_AT)):
        p = ease_out((t - at) / 0.45)
        if p <= 0:
            continue
        bob = math.sin((t - at) * 2.2 + i) * 8
        frame.alpha_composite(fade(ghost_card(), p), (x, int(700 + (1 - p) * 40 + bob)))
    # 손가락 두드리기 (새끼→검지 순서로 반복)
    ph = (t * 3.2) % 4
    lifts = tuple(int(round(6 * max(0.0, 1 - abs(ph - (3 - i)) * 1.6))) for i in range(4))
    hd = hand_img(lifts)
    frame.alpha_composite(hd, (540, 1060))
    draw_caption(frame, SCENES[1]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 3: 프로필 보고 최대 3명 선택 → 한 번에 요청 ─────────────────
LIST_TOP, CARD_H, CARD_GAP = 206, 140, 14
SEL = [(0, 2.2), (1, 2.6), (3, 3.0)]   # (카드, 선택 시점) '최대 세 명까지 골라' 실측 2.13s~
TAP3 = 3.3                             # '한 번에 상담을 요청해요' 실측 약 3.2s~
TOAST3 = TAP3 + 0.45
BTN3 = (28, 820, SW - 28, 906)


def card_y(i):
    return LIST_TOP + i * (CARD_H + CARD_GAP)


def screen_select(t):
    s = Scr(SLATE50)
    s.status()
    picked = [ci for ci, at in SEL if t >= at]
    k = len(picked)
    s.text(36, 110, "변호사 선택", 42, SLATE900, "EB", "lm")
    s.rr(SW - 176, 88, SW - 36, 132, 22, fill=TEAL if k == 3 else SLATE200)
    s.text(SW - 106, 110, f"{k}/3 선택", 24, WHITE if k == 3 else SLATE700, "EB", "mm")
    s.text(36, 168, "프로필을 보고 최대 3명까지", 24, SLATE500, "B", "lm")
    for i, lw in enumerate(LAWYERS):
        name, exp, tags, bg, fg = lw
        a = ease_out((t - 0.15 - i * 0.12) / 0.35)
        if a <= 0:
            continue
        y = card_y(i) + (1 - a) * 30
        sel = i in picked
        dim = k == 3 and not sel
        s.rr(28, y, SW - 28, y + CARD_H, 28, fill=SLATE100 if dim else WHITE,
             outline=TEAL if sel else SLATE200, width=4 if sel else 2)
        if dim:
            s.circ(90, y + 70, 38, fill=SLATE200)
        else:
            avatar(s, 90, y + 70, 38, bg, fg)
        s.text(146, y + 38, name, 28, SLATE400 if dim else SLATE900, "EB", "lm")
        s.text(146, y + 76, exp, 21, SLATE400 if dim else SLATE500, "B", "lm")
        s.text(146, y + 110, " · ".join(tags), 19, SLATE400, "B", "lm")
        cx, cy = SW - 82, y + 70
        if sel:
            at = dict(SEL)[i]
            q = ease_out((t - at) / 0.25)
            s.circ(cx, cy, 28, fill=TEAL)
            if q > 0.4:
                check_icon(s, cx, cy + 1, 26, WHITE, 5)
        else:
            s.circ(cx, cy, 28, fill=WHITE if not dim else SLATE100, outline=SLATE300, width=3)
        if dim:
            s.text(SW - 82, y + 118, "최대 3명", 17, SLATE400, "B", "mm")
    # 버튼
    pressed = TAP3 <= t < TAP3 + 0.25
    col = BLUE_D if pressed else (BLUE if k > 0 else SLATE300)
    s.rr(*BTN3, 26, fill=col)
    s.text(SW / 2, (BTN3[1] + BTN3[3]) / 2, "한 번에 상담 요청", 32, WHITE, "EB", "mm")
    # 완료 토스트
    if t >= TOAST3:
        p = ease_out((t - TOAST3) / 0.35)
        y = lerp(-120, 70, p)
        s.rr(28, y, SW - 28, y + 96, 28, fill=SLATE900)
        s.circ(84, y + 48, 24, fill=TEAL)
        check_icon(s, 84, y + 49, 24, WHITE, 5)
        s.text(126, y + 30, "상담 요청 완료", 26, WHITE, "EB")
        s.text(126, y + 64, "선택한 3명에게 한 번에 보냈어요", 20, SLATE300, "B")
    return s.final()


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_select(t), 0, 0)
    for ci, at in SEL:
        tap(frame, SW - 82, card_y(ci) + 70, t - at + 0.1)
    tap(frame, SW / 2, (BTN3[1] + BTN3[3]) / 2, t - TAP3)
    draw_caption(frame, SCENES[2]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 4: 답변 나란히 비교 ─────────────────────────────────
ANSWERS = [  # (변호사 인덱스, 답변 두 줄, 도착 시점)
    (0, ["소득 자료를 먼저 보고", "방향을 함께 정리해 볼게요"], 0.3),
    (1, ["채무 목록부터 확인하면", "상담이 수월해져요"], 0.7),
    (3, ["궁금한 점은 상담방에서", "편하게 물어보세요"], 1.1),
]
A_TOP, A_H, A_GAP = 196, 168, 12
BTN4_AT = 1.9       # '원할 때만 상담을 이어가면' 실측 1.9s~
BANNER4_AT = 4.9    # '선임 강요는 없어요' 실측 4.92s~


def screen_compare(t):
    s = Scr(SLATE50)
    s.status()
    arrived = sum(1 for *_, at in ANSWERS if t >= at)
    s.text(36, 110, "답변 비교", 42, SLATE900, "EB", "lm")
    s.rr(SW - 170, 88, SW - 36, 132, 22, fill=TEAL_L if arrived == 3 else SLATE200)
    s.text(SW - 103, 110, f"{arrived}/3 도착", 24, TEAL_D if arrived == 3 else SLATE700, "EB", "mm")
    s.text(36, 166, "답변과 프로필을 나란히 확인해요", 22, SLATE500, "B", "lm")
    for k, (li, lines, at) in enumerate(ANSWERS):
        name, exp, tags, bg, fg = LAWYERS[li]
        y = A_TOP + k * (A_H + A_GAP)
        done = t >= at
        s.rr(28, y, SW - 28, y + A_H, 26, fill=WHITE, outline=SLATE200, width=2)
        avatar(s, 72, y + 44, 26, bg, fg)
        s.text(110, y + 32, name, 26, SLATE900, "EB", "lm")
        s.text(110, y + 62, exp, 18, SLATE500, "B", "lm")
        if done:
            s.rr(SW - 164, y + 22, SW - 48, y + 58, 14, fill=TEAL_L)
            s.text(SW - 106, y + 40, "답변 도착", 19, TEAL_D, "EB", "mm")
            p = ease_out((t - at) / 0.3)
            col = lerp_color(WHITE, SLATE700, p)
            s.text(48, y + 102, lines[0], 23, col, "B", "lm")
            s.text(48, y + 138, lines[1], 23, col, "B", "lm")
            s.text(SW - 50, y + 140, "프로필 보기 ›", 18, lerp_color(WHITE, BLUE, p), "EB", "rm")
        else:
            s.rr(SW - 164, y + 22, SW - 48, y + 58, 14, fill=SLATE100)
            s.text(SW - 106, y + 40, "작성 중", 19, SLATE500, "B", "mm")
            for j in range(3):
                a = 0.5 + 0.5 * math.sin(t * 9 - j)
                s.circ(58 + j * 22, y + 112, 7, fill=lerp_color(SLATE200, SLATE500, a))
    # 선임 강요 없음 배너
    bp = ease_out((t - BANNER4_AT) / 0.4)
    by = A_TOP + 3 * (A_H + A_GAP) + 4
    if bp > 0:
        s.rr(28, by, SW - 28, by + 66, 22, fill=lerp_color(SLATE50, (240, 253, 250), bp),
             outline=lerp_color(SLATE50, TEAL, bp), width=3)
        s.circ(68, by + 33, 18, fill=lerp_color(SLATE50, TEAL, bp))
        check_icon(s, 68, by + 34, 18, lerp_color(SLATE50, WHITE, bp), 4)
        s.text(98, by + 33, "선임 강요 없음 · 원할 때만 이어가기", 22, lerp_color(SLATE50, TEAL_D, bp), "EB", "lm")
    # 버튼
    q = ease_out((t - BTN4_AT) / 0.35)
    if q > 0:
        y0 = 820 + (1 - q) * 20
        s.rr(28, y0, 300, y0 + 80, 24, fill=lerp_color(SLATE50, BLUE, q))
        s.text(164, y0 + 40, "상담 이어가기", 26, lerp_color(SLATE50, WHITE, q), "EB", "mm")
        s.rr(316, y0, SW - 28, y0 + 80, 24, fill=SLATE50, outline=lerp_color(SLATE50, SLATE300, q), width=3)
        s.text((316 + SW - 28) / 2, y0 + 40, "더 생각해 볼게요", 22, lerp_color(SLATE50, SLATE700, q), "B", "mm")
    return s.final()


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_compare(t), 0, math.sin(t * 1.3) * 5)
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
    # 메모리가 부족한 환경 대응: 이 프로세스의 x264 인코더 스레드·lookahead만 줄인다
    # (출력 규격 동일, render_ep01.py 는 수정하지 않음)
    orig_popen = base.subprocess.Popen

    def lean_popen(cmd, *a, **kw):
        if isinstance(cmd, list) and cmd and cmd[0] == "ffmpeg" and "libx264" in cmd:
            cmd = cmd[:-1] + ["-threads", "2", "-x264-params", "rc-lookahead=10", cmd[-1]]
        return orig_popen(cmd, *a, **kw)

    base.subprocess.Popen = lean_popen
    try:
        base.main()
    finally:
        base.subprocess.Popen = orig_popen


if __name__ == "__main__":
    main()
