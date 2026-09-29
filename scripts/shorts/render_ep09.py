# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP09 렌더러
기획: docs/youtube_shorts_plan.md  #9 "사무실 안 가고 폰으로 계약까지"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
상담방 말풍선은 render_ep03.py 의 bubble() 을 재사용한다.
출력: assets/shorts/ep09/
실행: python scripts/shorts/render_ep09.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE, RED,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, lock_icon, check_icon, avatar, vgradient,
    scene5 as ep01_endcard,
)
from render_ep03 import bubble, overlay, radial  # noqa: E402

EP = "ep09"

SCENES = [
    dict(plan=3.0, caption="평일에\n[갈 시간] 없죠?",
         narration="평일에 법률사무소 갈 시간, 없으시죠?",
         tts="평일에 법률사무소 갈 시간, 없으시죠?"),
    dict(plan=6.0, caption="가게\n[비울 수도] 없고",
         narration="가게를 비울 수도, 반차를 낼 수도 없고요.",
         tts="가게를 비울 수도, 반차를 낼 수도 없고요."),
    dict(plan=8.5, caption="상담은\n[상담방에서]",
         narration="마이김변에선 선택한 변호사와 상담방에서 편한 시간에 대화해요.",
         tts="마이김변에선 선택한 변호사와 상담방에서 편한 시간에 대화해요."),
    dict(plan=7.5, caption="계약도\n[폰으로]",
         narration="계약도 모바일 전자서명으로, 계약서 해시는 블록체인에 기록돼 원본을 확인할 수 있어요.",
         tts="계약도 모바일 전자서명으로, 계약서 해시는 블록체인에 기록돼 원본을 확인할 수 있어요."),
    dict(plan=6.0, caption="방문은\n[필요할 때만]",
         narration="방문은 꼭 필요할 때만 하세요.",
         tts="방문은 꼭 필요할 때만 하세요."),
]

SKIN = (236, 196, 166)
SKIN_D = (214, 170, 140)


@lru_cache(maxsize=None)
def shade_layer(h=640, a=150):
    """자막 가독성용 상단 음영 (캐시)"""
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    return sh.filter(ImageFilter.GaussianBlur(80))


# ── 장면 1: 벽시계 + 근무 중인 손 (zoom-in) ─────────────────────
CLK = (540, 840, 190)  # 중심 x, y, 반지름


@lru_cache(maxsize=None)
def office():
    img = vgradient(W, H, (48, 62, 86), (32, 44, 64)).convert("RGBA")
    ov, d = overlay()
    for x in range(-40, W + 180, 180):  # 벽 패널
        d.line([(x, 0), (x, 1170)], fill=(56, 71, 96, 255), width=4)
    # 벽시계
    cx, cy, r = CLK
    d.ellipse([cx - r - 18, cy - r - 18, cx + r + 18, cy + r + 18], fill=(30, 41, 59, 255))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(248, 250, 252, 255))
    for i in range(60):
        a = math.radians(i * 6)
        big = i % 5 == 0
        r0 = r - (34 if big else 18)
        d.line([(cx + r0 * math.sin(a), cy - r0 * math.cos(a)), (cx + (r - 10) * math.sin(a), cy - (r - 10) * math.cos(a))],
               fill=(51, 65, 85, 255) if big else (148, 163, 184, 255), width=8 if big else 3)
    for n, (dx, dy) in {"12": (0, -1), "3": (1, 0), "6": (0, 1), "9": (-1, 0)}.items():
        d.text((cx + dx * (r - 70), cy + dy * (r - 70)), n, font=font("EB", 40), fill=(30, 41, 59, 255), anchor="mm")
    # 책상
    d.polygon([(-60, 1180), (W + 60, 1180), (W + 240, H), (-240, H)], fill=(92, 72, 56, 255))
    d.rectangle([-60, 1168, W + 60, 1192], fill=(122, 96, 74, 255))
    # 탁상 달력 (평일 표시)
    d.polygon([(118, 1180), (150, 1040), (318, 1040), (350, 1180)], fill=(203, 213, 225, 255))
    d.rounded_rectangle([130, 1030, 338, 1172], 14, fill=(248, 250, 252, 255))
    d.rounded_rectangle([130, 1030, 338, 1078], 14, fill=(239, 68, 68, 255))
    d.rectangle([130, 1062, 338, 1078], fill=(239, 68, 68, 255))
    d.text((234, 1054), "평일", font=font("EB", 28), fill=(255, 255, 255, 255), anchor="mm")
    d.text((234, 1126), "수요일", font=font("EB", 44), fill=SLATE900 + (255,), anchor="mm")
    # 머그컵
    d.rounded_rectangle([770, 1060, 880, 1182], 20, fill=(226, 232, 240, 255))
    d.ellipse([770, 1046, 880, 1078], fill=(203, 213, 225, 255))
    d.ellipse([780, 1051, 870, 1073], fill=(92, 60, 40, 255))
    d.arc([860, 1090, 920, 1150], -90, 90, fill=(226, 232, 240, 255), width=12)
    # 서류 더미
    for k in range(3):
        d.rounded_rectangle([420 + k * 6, 1120 - k * 10, 700 + k * 6, 1150 - k * 10], 6, fill=(241, 245, 249, 255), outline=(203, 213, 225, 255), width=2)
    # 키보드
    d.rounded_rectangle([200, 1290, 880, 1480], 26, fill=(51, 65, 85, 255))
    for row in range(4):
        for col in range(13):
            x0 = 226 + col * 49 + (row % 2) * 12
            y0 = 1312 + row * 40
            if x0 + 40 > 858:
                continue
            d.rounded_rectangle([x0, y0, x0 + 40, y0 + 32], 6, fill=(71, 85, 105, 255))
    img.alpha_composite(ov)
    img.alpha_composite(radial(W, 900, 540, 0, 900, (255, 236, 200), 40), (0, 500))
    return img


def clock_hands(d, t):
    cx, cy, r = CLK
    minute = 10 + t * 3.0           # 오후 2시 10분 무렵, 빠르게 흐르는 시간
    hour = 2 + minute / 60
    sec = t * 90                    # 초침 가속
    for ang, ln, wd, col in [(hour * 30, r * 0.5, 14, (30, 41, 59)), (minute * 6, r * 0.75, 9, (30, 41, 59)), (sec, r * 0.82, 4, RED)]:
        a = math.radians(ang)
        d.line([(cx - 20 * math.sin(a), cy + 20 * math.cos(a)), (cx + ln * math.sin(a), cy - ln * math.cos(a))], fill=col, width=wd)
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=RED)


def typing_hand(d, cx, cy, t, phase, mirror=1):
    """셔츠 소매 + 일러스트 손 (얼굴 없음)"""
    d.rounded_rectangle([cx - 90, cy + 70, cx + 90, H + 60], 40, fill=(40, 58, 92))
    d.rounded_rectangle([cx - 94, cy + 62, cx + 94, cy + 104], 18, fill=(226, 232, 240))
    d.rounded_rectangle([cx - 74, cy - 20, cx + 74, cy + 84], 38, fill=SKIN)
    for i in range(4):
        fx = cx - 54 + i * 36
        lift = max(0, math.sin(t * 16 + phase + i * 1.7)) * 16
        top = cy - 70 + abs(i - 1.5) * 10 - lift
        d.rounded_rectangle([fx - 15, top, fx + 15, cy + 10], 15, fill=SKIN)
        d.line([(fx - 8, top + 12), (fx + 8, top + 12)], fill=SKIN_D, width=3)
    tx = cx + mirror * 84  # 엄지
    d.rounded_rectangle([min(tx, cx + mirror * 40) - 16, cy + 6, max(tx, cx + mirror * 40) + 16, cy + 36], 15, fill=SKIN)


def scene1(t, dur):
    frame = office().copy()
    d = ImageDraw.Draw(frame)
    clock_hands(d, t)
    typing_hand(d, 400, 1370, t, 0.0, -1)
    typing_hand(d, 690, 1370, t, 2.1, 1)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.07 * ease_in_out(t / dur), W / 2, 960).convert("RGBA")
    frame.alpha_composite(shade_layer(600, 130))
    draw_caption(frame, SCENES[0]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 2: 가게 셔터 → 작업장 (pan-right) ──────────────────────
WW2 = 1760
HALFDAY_AT = 1.6  # 내레이션 '반차를…' 시작(실측 1.62s)


@lru_cache(maxsize=None)
def street():
    img = vgradient(WW2, H, (40, 54, 80), (24, 34, 54)).convert("RGBA")
    ov, d = overlay(WW2, H)
    # 가게 외벽·간판
    d.rectangle([40, 700, 980, 1500], fill=(71, 85, 105, 255))
    d.rectangle([40, 700, 980, 812], fill=(30, 41, 59, 255))
    d.text((510, 756), "예시 가게", font=font("EB", 56), fill=(253, 230, 138, 255), anchor="mm")
    for i in range(10):  # 차양
        x0 = 40 + i * 94
        d.polygon([(x0, 812), (x0 + 94, 812), (x0 + 104, 900), (x0 + 10, 900)], fill=(TEAL if i % 2 == 0 else (240, 253, 250)) + (255,))
    # 매장 내부 (불 켜짐)
    d.rectangle([100, 930, 920, 1500], fill=(250, 226, 178, 255))
    for sy in (1110, 1230):  # 선반
        d.rectangle([140, sy, 520, sy + 14], fill=(160, 120, 84, 255))
        for k in range(6):
            bx = 156 + k * 60
            d.rounded_rectangle([bx, sy - 70 + (k % 2) * 16, bx + 46, sy], 6, fill=[(96, 165, 250, 255), (251, 146, 60, 255), (74, 222, 128, 255)][k % 3])
    d.rectangle([560, 1250, 900, 1500], fill=(120, 90, 64, 255))  # 계산대
    d.rectangle([560, 1250, 900, 1272], fill=(150, 112, 80, 255))
    d.rounded_rectangle([700, 1170, 820, 1250], 10, fill=(51, 65, 85, 255))  # 단말기
    # 반쯤 올린 셔터
    d.rectangle([100, 930, 920, 1080], fill=(148, 163, 184, 255))
    for y in range(936, 1080, 16):
        d.line([(100, y), (920, y)], fill=(100, 116, 139, 255), width=3)
    d.rectangle([100, 1068, 920, 1082], fill=(71, 85, 105, 255))
    # 영업 중 팻말
    d.line([(620, 1082), (640, 1130)], fill=(71, 85, 105, 255), width=4)
    d.line([(820, 1082), (800, 1130)], fill=(71, 85, 105, 255), width=4)
    d.rounded_rectangle([600, 1126, 840, 1200], 14, fill=TEAL_D + (255,))
    d.text((720, 1163), "영업 중", font=font("EB", 40), fill=(255, 255, 255, 255), anchor="mm")
    # 작업장
    d.rectangle([1040, 640, WW2, 1500], fill=(58, 70, 92, 255))
    d.rounded_rectangle([1080, 720, 1700, 1100], 16, fill=(168, 132, 96, 255))  # 타공판
    for yy in range(750, 1090, 34):
        for xx in range(1110, 1690, 34):
            d.ellipse([xx - 4, yy - 4, xx + 4, yy + 4], fill=(120, 92, 66, 255))
    # 공구 실루엣
    d.rectangle([1160, 800, 1180, 1000], fill=(71, 85, 105, 255))            # 망치 자루
    d.rounded_rectangle([1120, 780, 1220, 822], 8, fill=(51, 65, 85, 255))  # 망치 머리
    d.rectangle([1290, 790, 1310, 1010], fill=(71, 85, 105, 255))            # 스패너
    d.ellipse([1266, 764, 1334, 832], fill=(71, 85, 105, 255))
    d.ellipse([1284, 776, 1316, 808], fill=(168, 132, 96, 255))
    d.polygon([(1400, 800), (1600, 800), (1600, 860), (1400, 900)], fill=(148, 163, 184, 255))  # 톱날
    d.rounded_rectangle([1360, 790, 1420, 880], 12, fill=(234, 88, 12, 255))                     # 톱 손잡이
    d.rounded_rectangle([1440, 930, 1660, 1060], 12, fill=(251, 191, 36, 255))                  # 공구함
    d.rectangle([1440, 980, 1660, 992], fill=(217, 119, 6, 255))
    # 작업대 + 판재
    d.rectangle([1040, 1270, WW2, 1330], fill=(150, 112, 80, 255))
    d.rectangle([1080, 1330, 1110, 1500], fill=(120, 90, 64, 255))
    d.rectangle([1690, 1330, 1720, 1500], fill=(120, 90, 64, 255))
    d.rounded_rectangle([1140, 1226, 1660, 1272], 6, fill=(222, 184, 135, 255))
    # 보도
    d.rectangle([0, 1500, WW2, H], fill=(51, 65, 85, 255))
    for x in range(0, WW2, 160):
        d.line([(x, 1500), (x - 60, H)], fill=(71, 85, 105, 255), width=4)
    img.alpha_composite(ov)
    img.alpha_composite(radial(1000, 900, 500, 200, 600, (255, 236, 190), 70), (1000, 560))
    return img


def sanding_hands(d, t):
    off = math.sin(t * 5) * 60
    bx = 1390 + off
    d.rounded_rectangle([bx - 80, 1180, bx + 80, 1228], 10, fill=(180, 83, 9))          # 샌딩 블록
    for hx in (bx - 40, bx + 40):                                                        # 장갑 낀 손
        d.rounded_rectangle([hx - 44, 1130, hx + 44, 1196], 30, fill=(100, 116, 139))
        d.rounded_rectangle([hx - 40, 1190, hx + 40, 1330 + 200], 34, fill=(30, 58, 95))  # 작업복 소매
        d.rounded_rectangle([hx - 44, 1186, hx + 44, 1210], 10, fill=(71, 85, 105))
    # 톱밥
    for k in range(5):
        px = bx + 90 + ((t * 120 + k * 37) % 90)
        py = 1250 - ((t * 80 + k * 23) % 40)
        d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=(234, 210, 170))


def halfday_card(frame, t):
    p = ease_out((t - HALFDAY_AT) / 0.35)
    if p <= 0:
        return
    ov, d = overlay()
    a = int(255 * p)
    x0, y0 = CAP_X, 610 + (1 - p) * 30
    d.rounded_rectangle([x0, y0, x0 + 430, y0 + 110], 28, fill=(255, 255, 255, a))
    # 달력 아이콘
    d.rounded_rectangle([x0 + 26, y0 + 26, x0 + 84, y0 + 86], 10, fill=(226, 232, 240, a))
    d.rectangle([x0 + 26, y0 + 26, x0 + 84, y0 + 44], fill=(59, 130, 246, a))
    d.text((x0 + 104, y0 + 55), "반차 신청", font=font("EB", 40), fill=SLATE900 + (a,), anchor="lm")
    q = ease_out((t - HALFDAY_AT - 0.35) / 0.3)
    if q > 0:
        cx, cy = x0 + 372, y0 + 55
        rr = 32 * q
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(239, 68, 68, a))
        if q > 0.6:
            d.line([(cx - 13, cy - 13), (cx + 13, cy + 13)], fill=(255, 255, 255, a), width=7)
            d.line([(cx - 13, cy + 13), (cx + 13, cy - 13)], fill=(255, 255, 255, a), width=7)
    frame.alpha_composite(ov)


def scene2(t, dur):
    world = street().copy()
    sanding_hands(ImageDraw.Draw(world), t)
    x = int((WW2 - W) * ease_in_out(t / dur))
    frame = world.crop((x, 0, x + W, H))
    frame.alpha_composite(shade_layer(600, 130))
    draw_caption(frame, SCENES[1]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    halfday_card(frame, t)
    return frame


# ── 장면 3: 가명 상담방 (시간 조율 → 계약 안내) ───────────────────
ALIAS = "부지런한 참새 15"
MESSAGES = [  # (보낸 쪽, 줄, 등장 시점)
    ("me", ["평일엔 가게를 못 비워요.", "밤에 문의해도 될까요?"], 0.4),
    ("lawyer", ["편한 시간에 남겨 주세요.", "확인 후 답변드릴게요."], 1.9),   # 내레이션 0.19~4.31s
    ("me", ["영업 끝나고", "채무 자료 올릴게요."], 3.7),
    ("lawyer", ["계약은 모바일", "전자서명으로 안내할게요."], 5.4),  # 다음 장면 연결
]


def screen_chat(t):
    s = Scr(SLATE100)
    s.status()
    s.rr(0, 60, SW, 176, 0, fill=WHITE)
    s.line([(44, 104), (30, 118), (44, 132)], SLATE900, 5)
    avatar(s, 100, 118, 30, TEAL_L, (45, 212, 191))
    s.text(146, 100, "예시 변호사 B", 28, SLATE900, "EB")
    s.text(146, 138, "내가 선택한 변호사 · 상담방", 20, SLATE500, "B")
    # 가명 배너
    s.rr(24, 196, SW - 24, 290, 24, fill=WHITE, outline=SLATE200, width=2)
    s.circ(74, 243, 28, fill=TEAL)
    lock_icon(s, 74, 246, 30, WHITE)
    s.text(118, 226, f"나는 '{ALIAS}'", 23, SLATE900, "EB", "lm")
    s.text(118, 262, "가명으로 대화 중", 20, TEAL_D, "B", "lm")
    # 시간 칩 (퇴근·마감 후)
    s.rr(SW / 2 - 110, 308, SW / 2 + 110, 346, 19, fill=SLATE300)
    s.text(SW / 2, 327, "수요일 오후 10:40", 19, WHITE, "EB", "mm")
    y = 370
    for side, lines, at in MESSAGES:
        if t < at:
            if at - 0.9 <= t and side == "lawyer":
                s.rr(96, y, 196, y + 56, 26, fill=WHITE, outline=SLATE200, width=2)
                for k in range(3):
                    a = 0.5 + 0.5 * math.sin(t * 9 - k)
                    s.circ(124 + k * 22, y + 28, 7, fill=lerp_color(SLATE200, SLATE500, a))
            break
        if side == "me":
            s.text(SW - 36, y, ALIAS, 18, SLATE500, "B", "ra")
            y += 28
        bh = bubble(s, side, lines, y, ease_out((t - at) / 0.3))
        y += bh + 26
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


# ── 장면 4: 모바일 전자서명 → 체결 완료 → 원본 검증 ────────────────
# 내레이션 실측 기준 (장면 내 초)
AGREE_AT = 0.3       # 약관 동의 체크
SIGN_A, SIGN_B = 0.5, 1.35  # 서명 획 ('모바일 전자서명으로' 0.18~1.89s)
SUBMIT_AT = 1.6      # 제출 탭
DONE_AT = 1.9        # 완료 화면 전환
HASH_AT = 2.2        # '계약서 해시는…' (실측 2.24s)
CHAIN_AT = 3.0       # '블록체인에 기록돼' (실측 약 3.0s)
VERIFY_AT = 4.2      # '원본을 확인할 수…' (실측 4.16s) → 검증 버튼 탭
RESULT_AT = 4.5
HASH_TXT = "0x3f9a…c21e"


def sig_points(n=160):
    pts = []
    for i in range(n):
        u = i / (n - 1)
        x = 90 + u * 360
        y = 745 + 46 * math.sin(u * 13) * (0.55 + 0.45 * math.sin(u * 3 + 0.4)) - 30 * u
        pts.append((x, y))
    return pts


SIG = sig_points()


def screen_sign(t):
    s = Scr(SLATE50)
    s.status()
    s.text(36, 104, "위임계약서 서명", 34, SLATE900, "EB", "lm")
    s.text(36, 146, "예시 법률사무소 · 모바일 전자서명", 20, SLATE500, "B", "lm")
    # 계약서 미리보기
    s.rr(28, 178, SW - 28, 392, 24, fill=WHITE, outline=SLATE200, width=2)
    s.text(56, 214, "위임계약서 (예시)", 26, SLATE900, "EB", "lm")
    s.text(56, 254, "위임인  ○○○   수임인  예시 변호사 B", 19, SLATE500, "B", "lm")
    for j, ww in enumerate([420, 400, 430, 300]):
        s.rr(56, 284 + j * 26, 56 + ww, 296 + j * 26, 6, fill=SLATE200)
    # 단계
    rows = [("스마트폰 본인인증", -1.0), ("모든 필수 약관에 전체 동의합니다", AGREE_AT)]
    for i, (lab, at) in enumerate(rows):
        y = 414 + i * 70
        on = t >= at
        s.rr(28, y, SW - 28, y + 58, 18, fill=WHITE, outline=TEAL if on else SLATE200, width=2)
        s.rr(46, y + 13, 78, y + 45, 8, fill=TEAL if on else WHITE, outline=TEAL if on else SLATE300, width=2)
        if on:
            check_icon(s, 62, y + 30, 20, WHITE, 4)
        s.text(94, y + 29, lab, 21, SLATE900, "B", "lm")
        if i == 0:
            s.text(SW - 50, y + 29, "완료", 20, TEAL_D, "EB", "rm")
    # 서명 패드
    s.rr(28, 566, SW - 28, 880, 24, fill=WHITE, outline=SLATE300, width=2)
    s.text(52, 596, "전자서명", 20, SLATE500, "B", "lm")
    s.line([(60, 820), (SW - 60, 820)], SLATE200, 2)
    p = clamp((t - SIGN_A) / (SIGN_B - SIGN_A))
    if p <= 0:
        s.text(SW / 2, 740, "여기에 서명해 주세요", 24, SLATE300, "B", "mm")
    else:
        n = max(2, int(len(SIG) * p))
        s.line(SIG[:n], SLATE900, 5)
    # 제출 버튼
    ready = p >= 1
    pressed = SUBMIT_AT <= t < SUBMIT_AT + 0.25
    s.rr(28, 910, SW - 28, 1000, 26, fill=BLUE_D if pressed else (BLUE if ready else SLATE300))
    lock_icon(s, 110, 958, 26, WHITE)
    s.text(SW / 2 + 16, 955, "위임계약서 서명 최종 제출", 27, WHITE, "EB", "mm")
    return s.final()


def screen_done(t):
    s = Scr(SLATE50)
    s.status()
    p = ease_out((t - DONE_AT) / 0.4)
    s.circ(SW / 2, 196, 64 * (0.6 + 0.4 * p), fill=TEAL)
    check_icon(s, SW / 2, 198, 58, WHITE, 10)
    s.text(SW / 2, 304, "전자계약 체결 완료", 36, SLATE900, "EB", "mm")
    s.text(SW / 2, 350, "예시 법률사무소 · 위임계약서", 21, SLATE500, "B", "mm")
    # 전자지문 박스
    hp = ease_out((t - HASH_AT) / 0.4)
    if hp > 0:
        y0 = 400 + (1 - hp) * 24
        s.rr(28, y0, SW - 28, y0 + 230, 26, fill=lerp_color(SLATE50, SLATE900, hp))
        s.text(56, y0 + 42, "체결본 전자지문 (SHA-256)", 21, lerp_color(SLATE50, WHITE, hp), "EB", "lm")
        s.rr(56, y0 + 76, SW - 56, y0 + 150, 16, fill=lerp_color(SLATE50, (2, 6, 23), hp))
        s.text(SW / 2, y0 + 113, HASH_TXT, 38, lerp_color(SLATE50, (110, 231, 183), hp), "EB", "mm")
        s.text(56, y0 + 190, "계약서 내용으로 계산한 고유값", 19, lerp_color(SLATE50, SLATE400, hp), "B", "lm")
        cp = ease_out((t - CHAIN_AT) / 0.35)
        if cp > 0:
            bx1 = SW - 48
            bx0 = bx1 - 168
            s.rr(bx0, y0 + 24, bx1, y0 + 62, 12, fill=lerp_color(SLATE900, (6, 78, 59), cp), outline=lerp_color(SLATE900, (52, 211, 153), cp), width=2)
            s.text((bx0 + bx1) / 2, y0 + 43, "블록체인 기록됨", 18, lerp_color(SLATE900, (110, 231, 183), cp), "EB", "mm")
    # 원본 검증 버튼
    bp = ease_out((t - (CHAIN_AT + 0.4)) / 0.35)
    if bp > 0:
        pressed = VERIFY_AT <= t < VERIFY_AT + 0.25
        s.rr(28, 664, SW - 28, 752, 24, fill=(239, 246, 255) if pressed else WHITE, outline=lerp_color(SLATE50, BLUE, bp), width=3)
        s.text(SW / 2, 708, "전자계약 원본 검증", 28, lerp_color(SLATE50, BLUE, bp), "EB", "mm")
    # 검증 결과
    rp = ease_out((t - RESULT_AT) / 0.4)
    if rp > 0:
        y0 = 784 + (1 - rp) * 24
        s.rr(28, y0, SW - 28, y0 + 170, 24, fill=lerp_color(SLATE50, (236, 253, 245), rp), outline=lerp_color(SLATE50, (16, 185, 129), rp), width=3)
        s.circ(84, y0 + 58, 28, fill=lerp_color(SLATE50, (16, 185, 129), rp))
        check_icon(s, 84, y0 + 59, 28, WHITE, 5)
        s.text(130, y0 + 58, "원본 일치", 30, lerp_color(SLATE50, (6, 95, 70), rp), "EB", "lm")
        s.text(56, y0 + 112, "다시 계산한 전자지문이", 21, lerp_color(SLATE50, SLATE700, rp), "B", "lm")
        s.text(56, y0 + 142, "체결 당시 값과 같아요", 21, lerp_color(SLATE50, SLATE700, rp), "B", "lm")
    return s.final()


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    if t < DONE_AT:
        scr = screen_sign(t)
    elif t < DONE_AT + 0.3:
        scr = Image.blend(screen_sign(t), screen_done(t), (t - DONE_AT) / 0.3)
    else:
        scr = screen_done(t)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 955, t - SUBMIT_AT)
    tap(frame, SW / 2, 708, t - VERIFY_AT)
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
    base.SCENES = SCENES          # 엔드카드 자막·오디오·SRT 가 이 목록을 사용
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    base.main()


if __name__ == "__main__":
    main()
