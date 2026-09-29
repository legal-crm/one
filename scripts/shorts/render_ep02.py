# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP02 렌더러
기획: docs/youtube_shorts_plan.md  #2 "개인회생이 정답이 아닐 수도 있습니다"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 그대로 재사용한다.
출력: assets/shorts/ep02/
실행: python scripts/shorts/render_ep02.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, K, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, check_icon, lock_icon, scene5 as ep01_endcard,
)

EP = "ep02"

SCENES = [
    dict(plan=3.0, caption="빚 =\n[개인회생?]",
         narration="빚이 많으면 무조건 개인회생일까요?",
         tts="빚이 많으면 무조건 개인회생일까요?"),
    dict(plan=6.0, caption="방법은\n[4가지]입니다",
         narration="방법은 네 가지예요. 회생, 파산, 신용회복, 채무자대리.",
         tts="방법은 네 가지예요. 회생, 파산, 신용회복, 채무자대리."),
    # 장면 2 내레이션이 6.17초라 장면 3을 줄여 총 32.0초 유지 (내레이션 6.3초라 여유 있음)
    dict(plan=8.83, caption="연체·소득·압류가\n[기준]",
         narration="연체 기간, 소득이 안정적인지, 압류가 있는지에 따라 맞는 길이 달라집니다.",
         tts="연체 기간, 소득이 안정적인지, 압류가 있는지에 따라 맞는 길이 달라집니다."),
    dict(plan=8.0, caption="이름 없이\n[1분 체크]",
         narration="이름 없이 1분, 채무와 소득만 넣으면 내 상황이 정리돼요.",
         tts="이름 없이 일 분, 채무와 소득만 넣으면 내 상황이 정리돼요."),
    dict(plan=6.0, caption="[내 길부터]\n확인하세요",
         narration="제도를 고르기 전에, 내 상황부터 확인하세요.",
         tts="제도를 고르기 전에, 내 상황부터 확인하세요."),
]

PATHS = ["개인회생", "개인파산", "신용회복", "채무자대리"]
PATH_COLORS = [(45, 212, 191), (96, 165, 250), (251, 191, 36), (167, 139, 250)]


def overlay():
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


def bezier(p0, p1, p2, p3, n=60):
    pts = []
    for i in range(n + 1):
        u = i / n
        a, b, c, d = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


# ── 장면 1: 네 갈래 갈림길 항공샷 (zoom-out) ──────────────────
ROAD_ENDS = [(120, 520), (430, 470), (690, 490), (960, 560)]
FORK = (540, 1150)


@lru_cache(maxsize=None)
def road_map():
    """2배로 그린 뒤 축소한 정적 지도 레이어"""
    S = 2
    img = Image.new("RGB", (W * S, H * S), (22, 44, 58))
    d = ImageDraw.Draw(img)
    # 들판 패치
    import random
    rnd = random.Random(7)
    for _ in range(90):
        x, y = rnd.randint(-100, W + 100), rnd.randint(-100, H + 100)
        w, h = rnd.randint(120, 380), rnd.randint(80, 260)
        c = rnd.choice([(26, 52, 66), (19, 40, 54), (30, 58, 70), (24, 48, 60)])
        d.rounded_rectangle([x * S, y * S, (x + w) * S, (y + h) * S], 40 * S, fill=c)
    # 나무 점
    for _ in range(160):
        x, y = rnd.randint(0, W), rnd.randint(0, H)
        r = rnd.randint(10, 22)
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=(16, 64, 62))
    img = img.filter(ImageFilter.GaussianBlur(1.5 * S))
    d = ImageDraw.Draw(img)

    def stroke(pts, width, fill):
        d.line([(x * S, y * S) for x, y in pts], fill=fill, width=int(width * S), joint="curve")
        for x, y in (pts[0], pts[-1]):
            r = width / 2
            d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=fill)

    trunk = bezier((540, 2100), (540, 1700), (540, 1400), FORK)
    branches = [bezier(FORK, (FORK[0] + (ex - FORK[0]) * 0.2, FORK[1] - 250), (ex, ey + 350), (ex, ey - 400)) for ex, ey in ROAD_ENDS]
    for pts in [trunk] + branches:
        stroke(pts, 92, (12, 26, 36))       # 갓길 그림자
    for pts in [trunk] + branches:
        stroke(pts, 76, (71, 85, 105))      # 도로
    # 중앙 점선
    for pts in [trunk] + branches:
        for i in range(0, len(pts) - 1, 4):
            d.line([(pts[i][0] * S, pts[i][1] * S), (pts[i + 1][0] * S, pts[i + 1][1] * S)], fill=(226, 232, 240), width=5 * S)
    img = img.resize((W, H), Image.LANCZOS)
    return img, branches


def scene1(t, dur):
    img, branches = road_map()
    frame = img.copy().convert("RGBA")
    ov, d = overlay()
    # 갈래 끝의 목적지 마커 (순서대로 점등)
    for i, (ex, ey) in enumerate(ROAD_ENDS):
        p = ease_out((t - 0.3 - i * 0.25) / 0.35)
        if p <= 0:
            continue
        c = PATH_COLORS[i]
        r = 34 * p
        y = ey - 330
        d.ellipse([ex - r - 12, y - r - 12, ex + r + 12, y + r + 12], fill=c + (70,))
        d.ellipse([ex - r, y - r, ex + r, y + r], fill=c + (255,))
    # 갈림길 위의 '나' 표시
    pulse = (t * 1.5) % 1
    rr = 26 + 50 * pulse
    d.ellipse([FORK[0] - rr, FORK[1] + 160 - rr, FORK[0] + rr, FORK[1] + 160 + rr], outline=(255, 255, 255, int(200 * (1 - pulse))), width=5)
    d.ellipse([FORK[0] - 24, FORK[1] + 136, FORK[0] + 24, FORK[1] + 184], fill=(255, 255, 255, 255), outline=BLUE + (255,), width=8)
    frame.alpha_composite(ov)
    # 상단 자막 가독성용 어둡게
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle([0, 0, W, 620], fill=NAVY_D + (150,))
    frame.alpha_composite(shade.filter(ImageFilter.GaussianBlur(80)))
    frame = zoom(frame.convert("RGB"), 1.28 - 0.28 * ease_out(t / dur), W / 2, FORK[1]).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 네 개의 표지판 ──────────────────────────────────
SIGN_POP = [2.40, 3.18, 4.00, 4.95]   # 내레이션 '회생·파산·신용회복·채무자대리' 발화 시점(실측)


def icon(d, kind, cx, cy, sz, col):
    w = max(4, int(sz * 0.1))
    if kind == 0:   # 달력 = 분할 변제
        d.rounded_rectangle([cx - sz * .5, cy - sz * .42, cx + sz * .5, cy + sz * .5], sz * .12, outline=col, width=w)
        d.line([cx - sz * .5, cy - sz * .16, cx + sz * .5, cy - sz * .16], fill=col, width=w)
        for dx in (-.25, .25):
            d.line([cx + sz * dx, cy - sz * .56, cx + sz * dx, cy - sz * .3], fill=col, width=w)
        for r in range(2):
            for c in range(3):
                x, y = cx + sz * (-.26 + c * .26), cy + sz * (.08 + r * .22)
                d.ellipse([x - sz * .05, y - sz * .05, x + sz * .05, y + sz * .05], fill=col)
    elif kind == 1:  # 저울 = 법원 절차
        d.line([cx, cy - sz * .5, cx, cy + sz * .4], fill=col, width=w)
        d.line([cx - sz * .45, cy - sz * .32, cx + sz * .45, cy - sz * .32], fill=col, width=w)
        d.line([cx - sz * .3, cy + sz * .45, cx + sz * .3, cy + sz * .45], fill=col, width=w)
        for sx in (-1, 1):
            x = cx + sx * sz * .45
            d.line([x, cy - sz * .32, x - sz * .16, cy + sz * .05], fill=col, width=max(3, w // 2))
            d.line([x, cy - sz * .32, x + sz * .16, cy + sz * .05], fill=col, width=max(3, w // 2))
            d.chord([x - sz * .2, cy - sz * .08, x + sz * .2, cy + sz * .2], 0, 180, fill=col)
    elif kind == 2:  # 카드 + 상승 화살표 = 신용회복
        d.rounded_rectangle([cx - sz * .5, cy - sz * .3, cx + sz * .5, cy + sz * .36], sz * .1, outline=col, width=w)
        d.line([cx - sz * .5, cy - sz * .1, cx + sz * .5, cy - sz * .1], fill=col, width=w)
        d.line([cx - sz * .3, cy + sz * .22, cx - sz * .05, cy + sz * .06, cx + sz * .1, cy + sz * .16, cx + sz * .34, cy - sz * .02], fill=col, width=w, joint="curve")
    else:           # 방패 = 채무자대리
        pts = [(cx, cy - sz * .52), (cx + sz * .44, cy - sz * .34), (cx + sz * .38, cy + sz * .14), (cx, cy + sz * .52), (cx - sz * .38, cy + sz * .14), (cx - sz * .44, cy - sz * .34)]
        d.polygon(pts, outline=col, width=w)
        d.line([cx - sz * .18, cy, cx - sz * .02, cy + sz * .16, cx + sz * .22, cy - sz * .14], fill=col, width=w, joint="curve")


def scene2(t, dur):
    frame = background().copy().convert("RGBA")
    ov, d = overlay()
    # 바닥선
    d.rounded_rectangle([60, 1470, 900, 1482], 6, fill=(255, 255, 255, 40))
    cols = [(230, 820), (640, 820), (230, 1160), (640, 1160)]  # 우측 끝 < 918
    for i, (cx, top) in enumerate(cols):
        p = ease_out((t - SIGN_POP[i]) / 0.35)
        if p <= 0:
            # 아직 안 나온 자리 표시
            d.rounded_rectangle([cx - 150, top, cx + 150, top + 230], 28, outline=(255, 255, 255, 40), width=3)
            continue
        c = PATH_COLORS[i]
        lift = (1 - p) * 60
        # 기둥
        d.rounded_rectangle([cx - 10, top + 200 - lift, cx + 10, top + 300 - lift], 6, fill=(148, 163, 184, int(255 * p)))
        # 판
        s = 0.85 + 0.15 * p
        bw, bh = 300 * s, 230 * s
        bx0, by0 = cx - bw / 2, top + (230 - bh) / 2 - lift
        d.rounded_rectangle([bx0, by0, bx0 + bw, by0 + bh], 28, fill=(15, 36, 64, int(240 * p)), outline=c + (int(255 * p),), width=5)
        icon(d, i, cx, by0 + bh * 0.42, 96 * s, c + (int(255 * p),))
        d.text((cx, by0 + bh * 0.82), PATHS[i], font=font("EB", 36), fill=(255, 255, 255, int(255 * p)), anchor="mm")
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 기준 체크리스트 모션 그래픽 ─────────────────────────
CRITERIA = [
    ("연체 기간", "몇 달째 밀려 있나요?", 0.15),
    ("소득", "매달 들어오는 수입이 안정적인가요?", 1.2),
    ("압류", "급여·통장 압류가 있나요?", 2.75),
]
PATHS_AT = 4.3


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    ov, d = overlay()
    y0 = 640
    for i, (title, sub, at) in enumerate(CRITERIA):
        p = ease_out((t - at) / 0.4)
        if p <= 0:
            continue
        y = y0 + i * 190 + (1 - p) * 40
        a = int(255 * p)
        d.rounded_rectangle([90, y, 890, y + 160], 32, fill=(255, 255, 255, int(22 * p)), outline=(255, 255, 255, int(60 * p)), width=2)
        # 체크 박스
        cp = ease_out((t - at - 0.5) / 0.3)
        bx, by = 150, y + 80
        d.rounded_rectangle([bx - 36, by - 36, bx + 36, by + 36], 16, fill=lerp_color((30, 58, 95), TEAL, cp) + (a,), outline=TEAL + (a,), width=4)
        if cp > 0.3:
            d.line([bx - 17, by + 1, bx - 4, by + 15, bx + 19, by - 14], fill=(255, 255, 255, a), width=8, joint="curve")
        d.text((220, y + 36), title, font=font("EB", 50), fill=(255, 255, 255, a))
        d.text((220, y + 104), sub, font=font("B", 30), fill=SLATE300 + (a,))
    # 기준 → 4갈래 중 맞는 길 표시
    qp = ease_out((t - PATHS_AT) / 0.4)
    if qp > 0:
        d.text((90, 1250), "기준에 따라 달라지는 방향", font=font("B", 32), fill=SLATE300 + (int(255 * qp),))
        hi = int(((t - PATHS_AT - 0.5) / 0.6)) % 4 if t >= PATHS_AT + 0.5 else -1
        x = 90
        for i, name in enumerate(PATHS):
            f = font("EB", 34)
            tw = d.textlength(name, font=f)
            on = i == hi
            c = PATH_COLORS[i]
            d.rounded_rectangle([x, 1310, x + tw + 40, 1390], 22,
                                fill=(c + (int(255 * qp),)) if on else (255, 255, 255, int(20 * qp)),
                                outline=c + (int(255 * qp),), width=3)
            d.text((x + 20 + tw / 2, 1350), name, font=f, fill=(NAVY_D if on else WHITE) + (int(255 * qp),), anchor="mm")
            x += tw + 56
    frame.alpha_composite(ov)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 익명 채무 체크 입력 → 결과 (데모 화면) ────────────────
FIELDS = [
    ("총 채무", "4,800", "만 원", 0.3),
    ("월 소득", "260", "만 원", 0.95),
    ("연체 기간", "3", "개월", 1.6),
]
SEIZURE_AT = 2.15
PRESS_AT = 2.7
RESULT_AT = 3.15   # 내레이션 '내 상황이 정리돼요' 시작 시점


def typed(value, t0, t):
    n = int(clamp((t - t0) / 0.5) * len(value) + 0.001)
    return value[:n]


def screen_check(t):
    s = Scr(SLATE50)
    s.status()
    s.text(36, 100, "익명 채무 체크", 40, SLATE900, "EB")
    s.rr(36, 160, 250, 204, 16, fill=TEAL_L)
    lock_icon(s, 64, 186, 22, TEAL_D)
    s.text(84, 182, "이름·번호 입력 없음", 20, TEAL_D, "EB", "lm")

    if t < RESULT_AT:
        y = 240
        for i, (lab, val, unit, at) in enumerate(FIELDS):
            focus = at <= t < at + 0.8
            s.text(40, y, lab, 24, SLATE700, "EB")
            s.rr(36, y + 38, SW - 36, y + 124, 22, fill=WHITE, outline=BLUE if focus else SLATE200, width=3 if focus else 2)
            v = typed(val, at, t)
            s.text(64, y + 81, v if v else "0", 38, SLATE900 if v else SLATE300, "EB", "lm")
            s.text(SW - 64, y + 81, unit, 26, SLATE500, "B", "rm")
            if focus and int(t * 3) % 2 == 0:
                cx = 64 + s.tlen(v, 38, "EB") + 4
                s.line([(cx, y + 60), (cx, y + 102)], BLUE, 3)
            y += 156
        # 압류 여부
        s.text(40, y, "압류 여부", 24, SLATE700, "EB")
        on = t >= SEIZURE_AT
        for j, lab in enumerate(["없음", "있음"]):
            x0 = 36 + j * 244
            sel = on and j == 0
            s.rr(x0, y + 38, x0 + 228, y + 118, 22, fill=(240, 253, 250) if sel else WHITE, outline=TEAL if sel else SLATE200, width=3 if sel else 2)
            s.text(x0 + 114, y + 78, lab, 30, TEAL_D if sel else SLATE500, "EB", "mm")
        pressed = PRESS_AT <= t < PRESS_AT + 0.25
        s.rr(36, 960, SW - 36, 1056, 26, fill=BLUE_D if pressed else BLUE)
        s.text(SW / 2, 1008, "내 상황 정리하기", 32, WHITE, "EB", "mm")
    else:
        rt = t - RESULT_AT
        p = ease_out(rt / 0.4)
        y = 240 + (1 - p) * 40
        s.rr(28, y, SW - 28, y + 250, 30, fill=WHITE, outline=SLATE200, width=2)
        s.text(60, y + 32, "내 상황 요약", 24, SLATE500, "B")
        rows = [("총 채무", "4,800만 원"), ("월 소득", "260만 원"), ("연체·압류", "3개월 · 없음")]
        for i, (a, b) in enumerate(rows):
            yy = y + 84 + i * 52
            s.text(60, yy, a, 26, SLATE700, "B")
            s.text(SW - 60, yy, b, 28, SLATE900, "EB", "ra")
        # 검토 방향 카드
        y2 = y + 280
        s.rr(28, y2, SW - 28, y2 + 560, 30, fill=WHITE, outline=SLATE200, width=2)
        s.text(60, y2 + 30, "검토해 볼 방향", 28, SLATE900, "EB")
        items = [("개인회생", True), ("신용회복", True), ("개인파산", False), ("채무자대리", False)]
        for i, (name, rec) in enumerate(items):
            ip = ease_out((rt - 0.4 - i * 0.25) / 0.3)
            if ip <= 0:
                continue
            yy = y2 + 90 + i * 92
            s.rr(52, yy, SW - 52, yy + 76, 20, fill=(240, 253, 250) if rec else SLATE50, outline=TEAL if rec else SLATE200, width=2)
            s.text(84, yy + 38, name, 28, SLATE900 if rec else SLATE500, "EB", "lm")
            tag = "먼저 검토" if rec else "추가 확인"
            tw = s.tlen(tag, 20, "EB")
            s.rr(SW - 84 - tw - 28, yy + 20, SW - 84, yy + 56, 14, fill=TEAL if rec else SLATE200)
            s.text(SW - 84 - (tw + 28) / 2, yy + 38, tag, 20, WHITE if rec else SLATE700, "EB", "mm")
        s.line([(60, y2 + 466), (SW - 60, y2 + 466)], SLATE100, 2)
        s.text(60, y2 + 484, "참고용 결과예요. 최종 판단은", 21, SLATE500, "B")
        s.text(60, y2 + 516, "선택한 변호사와 법원 기준으로 확인하세요.", 21, SLATE500, "B")
    return s.final()


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_check(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 1008, t - PRESS_AT)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 엔드카드 (EP01 레이아웃 재사용) ───────────────────
def scene5(t, dur):
    return ep01_endcard(t, dur)


def main():
    base.EP = EP
    base.OUT = base.ROOT / "assets" / "shorts" / EP
    base.TMP = base.OUT / "_work"
    base.SCENES = SCENES          # 엔드카드 자막·오디오·SRT 가 이 목록을 사용
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    base.main()


if __name__ == "__main__":
    main()
