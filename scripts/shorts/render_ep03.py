# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP03 렌더러
기획: docs/youtube_shorts_plan.md  #3 "가족 모르게 채무 상담, 어디까지 가능할까"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
출력: assets/shorts/ep03/
실행: python scripts/shorts/render_ep03.py
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
    W, H, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, WHITE,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background,
    draw_caption, chip, put_phone, lock_icon, avatar, vgradient, scene5 as ep01_endcard,
)

EP = "ep03"

SCENES = [
    dict(plan=3.0, caption="가족이\n[알게 될까 봐]",
         narration="가족이 알까 봐 상담도 못 하고 계신가요?",
         tts="가족이 알까 봐 상담도 못 하고 계신가요?"),
    dict(plan=6.0, caption="혼자 검색만\n[몇 달째]",
         narration="혼자 검색만 하다가 몇 달이 지나기도 하죠.",
         tts="혼자 검색만 하다가 몇 달이 지나기도 하죠."),
    dict(plan=9.0, caption="상담은\n[가명으로]",
         narration="마이김변 상담방에서는 가명으로 대화하고, 실명과 연락처는 계약 전까지 공개되지 않아요.",
         tts="마이김변 상담방에서는 가명으로 대화하고, 실명과 연락처는 계약 전까지 공개되지 않아요."),
    dict(plan=8.0, caption="절차 서류는\n[따로 확인]",
         narration="다만 절차에 따라 가족 관련 서류가 필요할 수 있어요. 이 부분은 변호사와 먼저 확인하세요.",
         tts="다만 절차에 따라 가족 관련 서류가 필요할 수 있어요. 이 부분은 변호사와 먼저 확인하세요."),
    dict(plan=6.0, caption="첫 상담은\n[가명으로]",
         narration="첫걸음은 가명으로, 조용히 시작해 보세요.",
         tts="첫걸음은 가명으로, 조용히 시작해 보세요."),
]


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


def top_shade(frame, h=640, a=150):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    frame.alpha_composite(sh.filter(ImageFilter.GaussianBlur(80)))


# ── 장면 1: 거실 식탁, 뒤집어 놓은 휴대폰 (pan-right) ─────────────
WW = 1420  # 팬용 넓은 캔버스


@lru_cache(maxsize=None)
def living_room():
    img = vgradient(WW, H, (34, 48, 72), (22, 32, 52)).convert("RGBA")
    ov, d = overlay(WW, H)
    # 창문 (저녁빛)
    d.rounded_rectangle([90, 330, 470, 900], 18, fill=(52, 78, 118, 255), outline=(70, 90, 120, 255), width=14)
    d.line([280, 330, 280, 900], fill=(70, 90, 120, 255), width=12)
    d.line([90, 610, 470, 610], fill=(70, 90, 120, 255), width=12)
    # 벽 액자 (사람 없는 풍경)
    for x0, y0, w, h in [(640, 420, 250, 190), (930, 470, 170, 140)]:
        d.rounded_rectangle([x0, y0, x0 + w, y0 + h], 10, fill=(58, 70, 92, 255), outline=(150, 120, 90, 255), width=10)
        d.polygon([(x0 + 18, y0 + h - 18), (x0 + w * 0.45, y0 + h * 0.35), (x0 + w - 18, y0 + h - 18)], fill=(80, 110, 120, 255))
    # 스탠드 조명
    d.rectangle([1250, 560, 1262, 1120], fill=(40, 44, 56, 255))
    d.polygon([(1180, 560), (1332, 560), (1300, 440), (1212, 440)], fill=(230, 196, 140, 255))
    img.alpha_composite(ov)
    img.alpha_composite(radial(WW, H, 1256, 560, 700, (251, 191, 120), 90))
    # 식탁
    ov, d = overlay(WW, H)
    d.polygon([(-60, 1180), (WW + 60, 1180), (WW + 260, H + 40), (-260, H + 40)], fill=(112, 80, 58, 255))
    d.rectangle([-60, 1170, WW + 60, 1192], fill=(142, 104, 76, 255))
    rnd = random.Random(3)
    for _ in range(26):  # 나뭇결
        y = rnd.randint(1210, H)
        d.line([(-100, y), (WW + 100, y + rnd.randint(-20, 20))], fill=(100, 70, 50, 255), width=rnd.randint(2, 5))
    # 머그컵
    d.ellipse([240, 1330, 400, 1380], fill=(40, 30, 24, 120))
    d.rounded_rectangle([250, 1220, 390, 1360], 24, fill=(226, 232, 240, 255))
    d.ellipse([250, 1200, 390, 1244], fill=(203, 213, 225, 255))
    d.ellipse([262, 1206, 378, 1238], fill=(92, 60, 40, 255))
    d.arc([366, 1250, 430, 1320], -90, 90, fill=(226, 232, 240, 255), width=14)
    # 그릇
    d.ellipse([1020, 1300, 1300, 1400], fill=(40, 30, 24, 110))
    d.ellipse([1010, 1250, 1290, 1360], fill=(241, 245, 249, 255))
    d.ellipse([1050, 1268, 1250, 1336], fill=(203, 213, 225, 255))
    img.alpha_composite(ov)
    return img


@lru_cache(maxsize=None)
def facedown_phone():
    """뒤집어 놓은 휴대폰(뒷면) RGBA"""
    S = 2
    w, h = 300, 600
    im = Image.new("RGBA", ((w + 120) * S, (h + 120) * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([70 * S, 80 * S, (w + 70) * S, (h + 80) * S], 50 * S, fill=(0, 0, 0, 160))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18 * S)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([60 * S, 60 * S, (w + 60) * S, (h + 60) * S], 50 * S, fill=(30, 41, 59, 255), outline=(71, 85, 105, 255), width=4 * S)
    d.rounded_rectangle([86 * S, 86 * S, 196 * S, 206 * S], 28 * S, fill=(15, 23, 42, 255))
    for cx, cy in [(116, 116), (166, 116), (116, 166)]:
        d.ellipse([(cx - 20) * S, (cy - 20) * S, (cx + 20) * S, (cy + 20) * S], fill=(51, 65, 85, 255), outline=(100, 116, 139, 255), width=3 * S)
    im = im.resize((w + 120, h + 120), Image.LANCZOS)
    return im.rotate(-14, resample=Image.BICUBIC, expand=True)


def scene1(t, dur):
    room = living_room().copy()
    ph = facedown_phone()
    room.alpha_composite(ph, (760 - ph.width // 2, 1440 - ph.height // 2))
    # 뒷면 아래로 새어 나오는 알림 빛 (가끔)
    glow_a = int(70 * max(0, math.sin(t * 4.2)) ** 3) // 5 * 5  # 캐시용 양자화
    if glow_a > 2:
        room.alpha_composite(radial(660, 660, 330, 330, 330, (147, 197, 253), glow_a), (760 - 330, 1440 - 330))
    x = int((WW - W) * ease_in_out(t / dur))
    frame = room.crop((x, 0, x + W, H))
    top_shade(frame)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 밤, 이불 속 휴대폰 불빛 ────────────────────────────
QUERY = "가족 모르게 개인회생"
RESULTS = [
    ("가족이 알게 되나요? 경험 공유", 3), ("상담하면 집으로 연락 오나요", 2), ("몰래 알아보는 방법 정리", 3),
    ("회생 절차 서류 질문", 2), ("개인회생 문의드려요", 3), ("가족 모르게 가능한가요", 2),
    ("상담 전에 준비할 것", 3), ("비슷한 상황이신 분 계신가요", 2),
]


def screen_search(t):
    s = Scr((17, 24, 39))
    s.status(dark=True)
    # 검색창
    s.rr(28, 88, SW - 28, 164, 38, fill=(30, 41, 59))
    s.circ(74, 126, 14, outline=SLATE400, width=4)
    s.line([(84, 136), (96, 148)], SLATE400, 4)
    n = int(clamp((t - 0.1) / 0.9) * len(QUERY))
    s.text(110, 126, QUERY[:n], 26, WHITE, "B", "lm")
    if t < 1.2 and int(t * 3) % 2 == 0:
        s.line([(112 + s.tlen(QUERY[:n], 26), 108), (112 + s.tlen(QUERY[:n], 26), 144)], BLUE, 3)
    # 탭 수 (시간이 지날수록 늘어남)
    tabs = 3 + int(max(0, t - 1.0) * 5)
    s.rr(SW - 120, 190, SW - 28, 232, 12, outline=SLATE400, width=3)
    s.text(SW - 74, 211, f"{min(tabs, 99)}", 22, SLATE300, "EB", "mm")
    s.text(40, 211, "검색 결과", 24, SLATE400, "B", "lm")
    # 결과 목록 (계속 스크롤)
    if t >= 1.1:
        scroll = (t - 1.1) * 140
        rowh = 168
        span = rowh * len(RESULTS)
        for k, (title, lines) in enumerate(RESULTS):
            y = 256 + ((k * rowh - scroll) % span) - rowh  # 무한 스크롤
            if y > SH or y < 180:
                continue
            s.text(40, y, title, 26, (147, 197, 253), "EB")
            for j in range(lines - 1):
                ww = [440, 380, 300][j]
                s.rr(40, y + 50 + j * 30, 40 + ww, y + 66 + j * 30, 8, fill=(51, 65, 85))
        s.rr(0, 0, SW, 250, 0, fill=(17, 24, 39))  # 헤더 가림
        s.line([(28, 250), (SW - 28, 250)], (51, 65, 85), 2)
        s.status(dark=True)
        s.rr(28, 88, SW - 28, 164, 38, fill=(30, 41, 59))
        s.circ(74, 126, 14, outline=SLATE400, width=4)
        s.line([(84, 136), (96, 148)], SLATE400, 4)
        s.text(110, 126, QUERY, 26, WHITE, "B", "lm")
        s.rr(SW - 120, 190, SW - 28, 232, 12, outline=SLATE400, width=3)
        s.text(SW - 74, 211, f"{min(tabs, 99)}", 22, SLATE300, "EB", "mm")
        s.text(40, 211, "검색 결과", 24, SLATE400, "B", "lm")
    return s.final()


@lru_cache(maxsize=None)
def blanket():
    """이불 속 느낌: 하단의 부드러운 이불 둔덕 + 가장자리 어둠"""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # 가장자리 어둠 (이불로 덮인 공간)
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - 1150) / (H * 0.55)) ** 2)
    a = (np.clip(dist - 0.55, 0, 1) / 0.45) ** 1.5 * 235
    edge = np.zeros((H, W, 4), dtype=np.uint8)
    edge[..., :3] = (6, 10, 22)
    edge[..., 3] = np.clip(a, 0, 235).astype(np.uint8)
    layer.alpha_composite(Image.fromarray(edge, "RGBA"))
    # 하단 이불 둔덕 (부드러운 물결)
    ov, d = overlay()
    xs = np.linspace(-20, W + 20, 60)
    top = [(x, 1410 + 46 * math.sin(x / 170) + 24 * math.sin(x / 63 + 1)) for x in xs]
    d.polygon(top + [(W + 20, H), (-20, H)], fill=(30, 44, 74, 255))
    # 주름 하이라이트 (빛 받는 면)
    for y0, amp, ph in [(1500, 30, 0.0), (1620, 26, 1.7), (1760, 22, 3.1)]:
        pts = [(x, y0 + amp * math.sin(x / 150 + ph)) for x in xs]
        d.line(pts, fill=(56, 76, 114, 255), width=16, joint="curve")  # 불투명(아래 화면 비침 방지)
    layer.alpha_composite(ov.filter(ImageFilter.GaussianBlur(2)))
    return layer


def scene2(t, dur):
    frame = Image.new("RGBA", (W, H), (8, 14, 28, 255))
    frame.alpha_composite(radial(W, H, 540, 1180, 820, (147, 197, 253), 120))
    put_phone(frame, screen_search(t), 0, math.sin(t * 0.9) * 8 + 30)
    frame.alpha_composite(blanket())
    top_shade(frame, 600, 120)
    draw_caption(frame, SCENES[1]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    # 시간 경과 칩: 1개월째 → 2개월째 → 3개월째
    months = 1 + min(2, int(max(0, t - 1.4) / 1.4))
    ov, d = overlay()
    f = font("EB", 30)
    label = f"{months}개월째"
    x0 = CAP_X + 190
    d.rounded_rectangle([x0, 520, x0 + d.textlength(label, font=f) + 36, 572], 14, fill=(245, 158, 11, 230))
    d.text((x0 + 18, 531), label, font=f, fill=NAVY_D + (255,))
    frame.alpha_composite(ov)
    return frame


# ── 장면 3: 가명 상담방 ─────────────────────────────────────
ALIAS = "용감한 고래 42"
MESSAGES = [  # (보낸 쪽, 문장 줄들, 등장 시점)
    ("me", ["가족이 모르게 상담받을 수", "있을까요?"], 0.6),
    ("lawyer", ["상담방에서는 가명으로 표시돼요.", "편한 시간에 상황을 알려 주세요."], 2.4),
    ("me", ["채무 상황부터 정리해서", "보낼게요."], 4.6),
]


def bubble(s: Scr, side, lines, y, p):
    fsz, lh = 26, 38
    tw = max(s.tlen(ln, fsz, "B") for ln in lines)
    bw, bh = tw + 48, len(lines) * lh + 34
    yy = y + (1 - p) * 24
    if side == "me":
        x1 = SW - 32
        x0 = x1 - bw
        s.rr(x0, yy, x1, yy + bh, 26, fill=BLUE)
        col = WHITE
    else:
        x0 = 96
        avatar(s, 58, yy + 26, 26, TEAL_L, (45, 212, 191))
        s.rr(x0, yy, x0 + bw, yy + bh, 26, fill=WHITE, outline=SLATE200, width=2)
        col = SLATE900
    for i, ln in enumerate(lines):
        s.text(x0 + 24, yy + 18 + i * lh, ln, fsz, col, "B")
    return bh


def screen_chat(t):
    s = Scr(SLATE100)
    s.status()
    # 헤더
    s.rr(0, 60, SW, 176, 0, fill=WHITE)
    s.line([(44, 104), (30, 118), (44, 132)], SLATE900, 5)
    avatar(s, 100, 118, 30, TEAL_L, (45, 212, 191))
    s.text(146, 100, "예시 변호사 B", 28, SLATE900, "EB")
    s.text(146, 138, "상담방", 20, SLATE500, "B")
    # 비공개 배너
    bp = ease_out((t - 3.35) / 0.4)  # 내레이션 '실명과 연락처는…' 시작(실측)
    s.rr(24, 196, SW - 24, 300, 24, fill=lerp_color(WHITE, (240, 253, 250), bp), outline=lerp_color(SLATE200, TEAL, bp), width=3)
    s.circ(76, 248, 30, fill=lerp_color(SLATE300, TEAL, bp))
    lock_icon(s, 76, 251, 32, WHITE)
    s.text(122, 228, f"나는 '{ALIAS}'", 24, SLATE900, "EB", "lm")
    s.text(122, 268, "실명·연락처 계약 전까지 비공개", 21, TEAL_D if bp > 0.5 else SLATE500, "B", "lm")
    # 메시지
    y = 336
    for side, lines, at in MESSAGES:
        if t < at:
            # 입력 중 표시
            if at - 0.9 <= t < at:
                if side == "lawyer":
                    s.rr(96, y, 196, y + 56, 26, fill=WHITE, outline=SLATE200, width=2)
                    for k in range(3):
                        a = 0.5 + 0.5 * math.sin(t * 9 - k)
                        s.circ(124 + k * 22, y + 28, 7, fill=lerp_color(SLATE200, SLATE500, a))
            break
        if side == "me":
            s.text(SW - 36, y, ALIAS, 18, SLATE500, "B", "ra")
            y += 28
        bh = bubble(s, side, lines, y, ease_out((t - at) / 0.3))
        y += bh + 30
    # 입력창
    s.rr(0, SH - 130, SW, SH, 0, fill=WHITE)
    s.rr(24, SH - 110, SW - 110, SH - 46, 32, fill=SLATE100)
    s.text(52, SH - 78, "메시지 입력", 24, SLATE400, "B", "lm")
    s.circ(SW - 62, SH - 78, 32, fill=BLUE)
    s.line([(SW - 74, SH - 78), (SW - 50, SH - 78)], WHITE, 5)
    s.line([(SW - 62, SH - 90), (SW - 50, SH - 78), (SW - 62, SH - 66)], WHITE, 5)
    return s.final()


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_chat(t), 0, math.sin(t * 1.3) * 5)
    draw_caption(frame, SCENES[2]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 4: 서류 아이콘 + 자막 박스 ────────────────────────────
# 내레이션 '가족 관련 서류가…'(1.5s~), '이 부분은 변호사와…'(4.6s~) 실측 기준
DOCS = [("가족관계증명서", 1.5), ("주민등록등본", 2.0), ("배우자 소득·재산 자료", 2.5)]
INFO_AT = 4.55


def doc_icon(d, x, y, a, col):
    d.rounded_rectangle([x, y, x + 70, y + 90], 10, fill=(255, 255, 255, a))
    d.polygon([(x + 46, y), (x + 70, y + 24), (x + 46, y + 24)], fill=col + (a,))
    for j in range(3):
        d.rounded_rectangle([x + 12, y + 38 + j * 16, x + 58 - (j == 2) * 16, y + 46 + j * 16], 3, fill=(148, 163, 184, a))


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    ov, d = overlay()
    d.text((CAP_X, 640), "사건에 따라 요청될 수 있는 서류 (예)", font=font("B", 32), fill=SLATE300 + (255,))
    for i, (name, at) in enumerate(DOCS):
        p = ease_out((t - at) / 0.4)
        if p <= 0:
            continue
        a = int(255 * p)
        y = 710 + i * 150 + (1 - p) * 40
        d.rounded_rectangle([CAP_X, y, 890, y + 124], 28, fill=(255, 255, 255, int(20 * p)), outline=(255, 255, 255, int(60 * p)), width=2)
        doc_icon(d, CAP_X + 30, y + 17, a, TEAL)
        d.text((CAP_X + 130, y + 62), name, font=font("EB", 42), fill=(255, 255, 255, a), anchor="lm")
    # 자막 박스: 확인 안내
    ip = ease_out((t - INFO_AT) / 0.45)
    if ip > 0:
        a = int(255 * ip)
        y = 1200 + (1 - ip) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 250], 32, fill=TEAL + (int(235 * ip),))
        d.text((CAP_X + 40, y + 44), "선택한 변호사와 먼저 확인", font=font("EB", 46), fill=(255, 255, 255, a))
        d.text((CAP_X + 40, y + 124), "필요한 서류와 범위는", font=font("B", 32), fill=(240, 253, 250, a))
        d.text((CAP_X + 40, y + 170), "법원·사건마다 다를 수 있어요", font=font("B", 32), fill=(240, 253, 250, a))
    frame.alpha_composite(ov)
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
