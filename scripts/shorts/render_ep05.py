# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP05 렌더러
기획: docs/youtube_shorts_plan.md  #5 "독촉 전화가 하루 종일 온다면"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py 를 재사용한다.
(네 갈래 아이콘은 render_ep02.py 에서 가져온다. 두 파일 모두 수정하지 않음)
출력: assets/shorts/ep05/
실행: python scripts/shorts/render_ep05.py
"""
import math
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402
    W, H, K, SW, SH, CAP_X, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE, RED,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom,
    draw_caption, chip, put_phone, tap, check_icon, lock_icon, screen_calllog,
    scene5 as ep01_endcard,
)
from render_ep02 import PATHS, PATH_COLORS, icon as path_icon  # noqa: E402

EP = "ep05"

SCENES = [
    dict(plan=3.0, caption="[독촉 전화],\n오늘도?",
         narration="독촉 전화, 오늘도 받으셨나요?",
         tts="독촉 전화, 오늘도 받으셨나요?"),
    dict(plan=6.0, caption="일도\n[손에 안 잡힘]",
         narration="일하다가도 전화 올까 봐 불안하죠.",
         tts="일하다가도 전화 올까 봐 불안하죠."),
    dict(plan=9.0, caption="[채무자대리인]\n제도",
         narration="대부업 등의 추심에는 변호사를 대리인으로 세우는 채무자대리인 제도가 있어요.",
         tts="대부업 등의 추심에는 변호사를 대리인으로 세우는 채무자대리인 제도가 있어요."),
    dict(plan=8.0, caption="회생이\n[먼저]일 수도",
         narration="상황에 따라 대리인보다 회생 신청이 먼저일 수도 있어요. 적용 범위는 변호사와 확인하세요.",
         tts="상황에 따라 대리인보다 회생 신청이 먼저일 수도 있어요. 적용 범위는 변호사와 확인하세요."),
    dict(plan=6.0, caption="[내 경우부터]\n확인",
         narration="어떤 길이 먼저인지, 내 경우부터 확인해 보세요.",
         tts="어떤 길이 먼저인지, 내 경우부터 확인해 보세요."),
]


def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


def comp(frame, ov, p=1.0):
    """불투명하게 그린 레이어를 p 만큼 페이드해 합성 (반투명 겹침 비침 방지)"""
    if p <= 0:
        return
    if p < 1:
        ov.putalpha(ov.getchannel("A").point(lambda v: int(v * p)))
    frame.alpha_composite(ov)


def top_shade(frame, h=620, a=150):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, W, h], fill=NAVY_D + (a,))
    frame.alpha_composite(sh.filter(ImageFilter.GaussianBlur(80)))


# ── 장면 1: 부재중 전화 목록이 계속 늘어나는 폰 (예시 화면) ─────────
def s1_vib(t):
    return any(a <= t <= b for a, b in [(0.1, 0.8), (1.0, 1.7), (1.9, 2.6)])


def scene1(t, dur):
    frame = background().copy().convert("RGBA")
    vib = s1_vib(t)
    dx = math.sin(t * 95) * 8 if vib else 0
    put_phone(frame, screen_calllog(0.25 + t * 1.9), dx, 0)
    if vib:
        ov, d = overlay()
        k = (t * 6) % 1
        for side in (-1, 1):
            cx = base.PX + base.PW / 2 + side * (base.PW / 2 + 28)
            for j in range(2):
                off = 16 + j * 24 + k * 10
                box = [cx - off, 1080 - off * 1.5, cx + off, 1080 + off * 1.5]
                a0 = 235 if side < 0 else -55
                d.arc(box, a0 - 10, a0 + 70, fill=(203, 213, 225, 255), width=7)
        comp(frame, ov)
    frame = zoom(frame.convert("RGB"), 1.0 + 0.08 * ease_in_out(t / dur), W / 2, H).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 업무 중 진동에 놀라는 손 (일러스트) ──────────────────
S2_VIB = [(0.55, 1.25), (2.5, 3.2), (4.3, 5.0)]
SKIN = (226, 190, 158)
SKIN_D = (196, 156, 124)
SLEEVE = (59, 88, 132)


@lru_cache(maxsize=None)
def desk_layer():
    img = background().copy().convert("RGBA")
    ov, d = overlay()
    # 책상 상판
    d.polygon([(-40, 700), (W + 40, 700), (W + 120, H), (-120, H)], fill=(44, 58, 84, 255))
    d.rectangle([-40, 690, W + 40, 706], fill=(64, 80, 108, 255))
    comp(img, ov)
    # 노트북 화면(작업 중 스프레드시트)
    ov, d = overlay()
    d.rounded_rectangle([120, 560, 640, 930], 22, fill=(20, 28, 44, 255), outline=(90, 104, 128, 255), width=6)
    d.rectangle([146, 586, 614, 904], fill=(241, 245, 249, 255))
    d.rectangle([146, 586, 614, 626], fill=(203, 213, 225, 255))
    for r in range(7):
        y = 640 + r * 38
        for c, w in enumerate([120, 150, 110]):
            x = 160 + sum([120, 150, 110][:c]) + c * 16
            d.rounded_rectangle([x, y, x + w, y + 20], 6, fill=(203, 213, 225, 255) if r % 2 else (226, 232, 240, 255))
    d.rounded_rectangle([160, 640 + 3 * 38, 270, 660 + 3 * 38], 6, fill=(147, 197, 253, 255))
    # 노트북 본체 + 키보드
    d.polygon([(120, 930), (640, 930), (700, 1210), (60, 1210)], fill=(148, 163, 184, 255))
    d.polygon([(60, 1210), (700, 1210), (700, 1226), (60, 1226)], fill=(100, 116, 139, 255))
    for r in range(4):
        y0 = 956 + r * 44
        spread = (y0 - 930) * 60 / 280        # 사다리꼴 옆면 기울기
        left, right = 120 - spread + 22, 640 + spread - 22
        n = 11
        kw = (right - left) / n
        for c in range(n):
            x = left + c * kw
            d.rounded_rectangle([x + 3, y0, x + kw - 3, y0 + 34], 6, fill=(71, 85, 105, 255))
    d.rounded_rectangle([300, 1140, 460, 1196], 10, fill=(128, 142, 164, 255))
    comp(img, ov)
    return img


@lru_cache(maxsize=None)
def hand_img():
    """위에서 본 오른손 일러스트 (실존 인물 아님)"""
    S = 2
    w, h = 300, 520
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 소매
    d.rounded_rectangle([70 * S, 300 * S, 230 * S, 540 * S], 40 * S, fill=SLEEVE + (255,))
    d.rounded_rectangle([80 * S, 290 * S, 220 * S, 330 * S], 18 * S, fill=(226, 232, 240, 255))
    # 손가락
    for x, top in [(78, 70), (116, 40), (154, 48), (190, 84)]:
        d.rounded_rectangle([x * S, top * S, (x + 34) * S, 220 * S], 17 * S, fill=SKIN + (255,), outline=SKIN_D + (255,), width=2 * S)
    # 엄지
    d.rounded_rectangle([20 * S, 170 * S, 60 * S, 290 * S], 20 * S, fill=SKIN + (255,), outline=SKIN_D + (255,), width=2 * S)
    # 손바닥(손등)
    d.rounded_rectangle([60 * S, 150 * S, 232 * S, 306 * S], 56 * S, fill=SKIN + (255,))
    for x in (100, 138, 176):  # 관절 음영
        d.arc([(x - 12) * S, 150 * S, (x + 12) * S, 176 * S], 200, 340, fill=SKIN_D + (255,), width=3 * S)
    return im.resize((w, h), Image.LANCZOS)


def small_phone(t, vib):
    """책상 위 휴대폰(화면 위) - 수신 중"""
    ov, d = overlay()
    x0, y0, x1, y1 = 730, 960, 890, 1290
    dx = math.sin(t * 95) * 7 if vib else 0
    x0, x1 = x0 + dx, x1 + dx
    d.rounded_rectangle([x0 + 8, y0 + 16, x1 + 8, y1 + 16], 30, fill=(14, 22, 38, 255))
    d.rounded_rectangle([x0, y0, x1, y1], 30, fill=(12, 18, 32, 255), outline=(90, 104, 128, 255), width=4)
    lit = vib
    scr = (30, 41, 59) if lit else (17, 24, 39)
    d.rounded_rectangle([x0 + 10, y0 + 10, x1 - 10, y1 - 10], 22, fill=scr)
    if lit:
        cx = (x0 + x1) / 2
        d.ellipse([cx - 34, y0 + 60, cx + 34, y0 + 128], fill=(71, 85, 105))
        d.ellipse([cx - 13, y0 + 72, cx + 13, y0 + 98], fill=(148, 163, 184))
        d.chord([cx - 24, y0 + 100, cx + 24, y0 + 150], 180, 360, fill=(148, 163, 184))
        d.text((cx, y0 + 160), "알 수 없는", font=font("EB", 22), fill=WHITE, anchor="mm")
        d.text((cx, y0 + 188), "번호", font=font("EB", 22), fill=WHITE, anchor="mm")
        d.ellipse([x0 + 26, y1 - 84, x0 + 76, y1 - 34], fill=RED)
        d.ellipse([x1 - 76, y1 - 84, x1 - 26, y1 - 34], fill=(34, 197, 94))
        k = (t * 6) % 1
        for j in range(2):
            off = 14 + j * 22 + k * 8
            d.arc([x1 + 4 - off, 1125 - off * 1.6, x1 + 4 + off, 1125 + off * 1.6], -60, 60, fill=(203, 213, 225), width=6)
    return ov


def scene2(t, dur):
    frame = desk_layer().copy()
    vib = any(a <= t <= b for a, b in S2_VIB)
    frame.alpha_composite(small_phone(t, vib))
    # 진동 시작 순간 손이 움찔
    jolt = 0.0
    for a, _ in S2_VIB:
        u = t - a
        if 0 <= u < 0.7:
            jolt = max(jolt, math.sin(math.pi * clamp(u / 0.7)) if u < 0.7 else 0)
    hand = hand_img()
    ang = -8 - 10 * jolt
    hr = hand.rotate(ang, resample=Image.BICUBIC, expand=True)
    hx = int(330 - hr.width / 2 + 30 * jolt)
    hy = int(1040 - 90 * jolt)
    frame.alpha_composite(hr, (hx, hy))
    if jolt > 0.15:
        ov, d = overlay()
        cx, cy = 560, 1010 - 90 * jolt
        for k in range(3):
            a = math.radians(-60 + k * 30)
            r0, r1 = 40, 40 + 46 * jolt
            d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], fill=(251, 191, 36, 255), width=9)
        comp(frame, ov)
    top_shade(frame, 560, 120)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 채무자 → 대리인 → 추심자 모션 그래픽 ─────────────────
NODE_Y = 960
NODE_R = 96
DEBTOR_X, AGENT_X, COLL_X = 190, 480, 770
AGENT_AT = 1.6      # '변호사를 대리인으로' 시작 1.62s (실측)
SWITCH_AT = 2.3     # '세우는' 무렵 연락 방향 전환
TITLE_AT = 3.3      # '채무자대리인 제도가 있어요' 3.33s (실측)


@lru_cache(maxsize=None)
def node_img(kind):
    S = 2
    size = NODE_R * 2
    z = size * S
    bg, fg = {"debtor": ((51, 65, 85), (148, 163, 184)),
              "agent": ((204, 251, 241), (45, 170, 150)),
              "coll": ((254, 226, 226), RED)}[kind]
    im = Image.new("RGB", (z, z), bg)
    d = ImageDraw.Draw(im)
    if kind == "coll":   # 건물(추심 회사)
        d.rectangle([z * .28, z * .26, z * .72, z * .8], fill=fg)
        for r in range(4):
            for c in range(3):
                x, y = z * (.34 + c * .12), z * (.32 + r * .11)
                d.rectangle([x, y, x + z * .06, y + z * .06], fill=bg)
        d.rectangle([z * .2, z * .78, z * .8, z * .82], fill=fg)
    else:                # 실루엣 (실존 인물 아님)
        hr = z * 0.19
        d.ellipse([z / 2 - hr, z * 0.2, z / 2 + hr, z * 0.2 + hr * 2], fill=fg)
        d.ellipse([z * 0.2, z * 0.62, z * 0.8, z * 1.22], fill=fg)
        if kind == "agent":  # 넥타이
            d.polygon([(z * .5, z * .64), (z * .56, z * .72), (z * .5, z * .92), (z * .44, z * .72)], fill=(15, 118, 110))
    out = Image.new("RGBA", (z, z), (0, 0, 0, 0))
    mask = Image.new("L", (z, z), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, z - 1, z - 1], fill=255)
    out.paste(im, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def token(d, x, y, col):
    """추심 연락 아이콘(전화·문자)"""
    d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=col)
    d.rounded_rectangle([x - 9, y - 15, x + 9, y + 15], 4, fill=WHITE)
    d.rectangle([x - 5, y - 10, x + 5, y + 8], fill=col)


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    # 연결선
    ov, d = overlay()
    ap = ease_out((t - AGENT_AT) / 0.45)
    if ap > 0.5:
        for x in range(DEBTOR_X + NODE_R + 6, AGENT_X - NODE_R - 6, 18):
            d.line([(x, NODE_Y), (x + 9, NODE_Y)], fill=TEAL + (255,), width=6)
    comp(frame, ov)
    # 노드
    hit = 0.0
    if t < SWITCH_AT + 0.9:
        for k in range(12):
            st = 0.2 + k * 0.42
            if st > SWITCH_AT:
                break
            u = (t - st - 0.8)
            if 0 <= u < 0.35:
                hit = max(hit, 1 - u / 0.35)
    shake = math.sin(t * 90) * 7 * hit
    for kind, x, p in [("debtor", DEBTOR_X + shake, 1.0), ("coll", COLL_X, 1.0), ("agent", AGENT_X, ap)]:
        if p <= 0:
            continue
        img = node_img(kind)
        s = 0.7 + 0.3 * p
        im = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
        if p < 1:
            im.putalpha(im.getchannel("A").point(lambda v: int(v * p)))
        frame.alpha_composite(im, (int(x - im.width / 2), int(NODE_Y - im.height / 2 - (1 - p) * 60)))
    # 채무자 불안 링 → 대리인 선임 후 안정
    ov, d = overlay()
    if hit > 0:
        r = NODE_R + 10 + 20 * (1 - hit)
        d.ellipse([DEBTOR_X - r, NODE_Y - r, DEBTOR_X + r, NODE_Y + r], outline=RED + (255,), width=6)
    comp(frame, ov, hit)
    # 라벨
    ov, d = overlay()
    fl, fs = font("EB", 36), font("B", 26)
    d.text((DEBTOR_X, NODE_Y + NODE_R + 44), "채무자", font=fl, fill=WHITE, anchor="mm")
    d.text((COLL_X, NODE_Y + NODE_R + 44), "추심자", font=fl, fill=WHITE, anchor="mm")
    d.text((COLL_X, NODE_Y + NODE_R + 88), "대부업 등", font=fs, fill=SLATE300, anchor="mm")
    comp(frame, ov)
    if ap > 0:
        ov, d = overlay()
        d.text((AGENT_X, NODE_Y + NODE_R + 44), "대리인", font=fl, fill=(153, 246, 228), anchor="mm")
        d.text((AGENT_X, NODE_Y + NODE_R + 88), "변호사", font=fs, fill=SLATE300, anchor="mm")
        comp(frame, ov, ap)
    # 날아가는 연락 토큰: 대리인 선임 전엔 채무자에게, 후엔 대리인에게
    ov, d = overlay()
    for k in range(20):
        st = 0.2 + k * 0.42
        if st > t:
            break
        to_agent = st >= SWITCH_AT
        u = (t - st) / 0.8
        if u > 1 or (not to_agent and st + 0.8 > SWITCH_AT + 0.9):
            continue
        tx = AGENT_X + NODE_R * 0.4 if to_agent else DEBTOR_X + NODE_R * 0.4
        x = lerp(COLL_X - NODE_R * 0.4, tx, ease_in_out(u))
        y = NODE_Y - 190 * math.sin(math.pi * u) - 40 * (1 - u)
        token(d, x, y, (RED if not to_agent else (100, 116, 139)) + (255,))
    comp(frame, ov)
    # 제도 카드
    cp = ease_out((t - TITLE_AT) / 0.45)
    if cp > 0:
        ov, d = overlay()
        y = 1250 + (1 - cp) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 220], 32, fill=(22, 52, 84, 255), outline=TEAL + (255,), width=4)
        d.text((CAP_X + 40, y + 34), "채무자대리인 제도", font=font("EB", 50), fill=WHITE)
        d.text((CAP_X + 40, y + 108), "변호사 선임 후 채권자에게 서면 통지", font=font("B", 30), fill=(204, 251, 241))
        d.text((CAP_X + 40, y + 160), "적용 대상·범위는 사건마다 다를 수 있어요", font=font("R", 26), fill=SLATE300)
        comp(frame, ov, cp)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 네 갈래 선택지 그래픽 ─────────────────────────────
# 카드 순서: 채무자대리를 먼저 강조 → '회생 신청이 먼저일 수도'에서 개인회생으로 이동
ORDER = [3, 0, 1, 2]                  # 표시 위치(좌상, 우상, 좌하, 우하)에 들어갈 PATHS 인덱스
CARD_POS = [(250, 640), (640, 640), (250, 920), (640, 920)]
POP = [0.15, 0.3, 0.45, 0.6]
HL_AGENT_AT = 0.9    # '대리인보다' ≈0.9s (첫 구간 0.2~3.53s 음절 비례 추정)
HL_REHAB_AT = 1.65   # '회생 신청이' ≈1.65s (추정)
CHECK_AT = 4.5       # '적용 범위는' 4.52s (실측)


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    hl = -1
    if t >= HL_REHAB_AT:
        hl = 0
    elif t >= HL_AGENT_AT:
        hl = 3
    for slot, pi in enumerate(ORDER):
        p = ease_out((t - POP[slot]) / 0.35)
        if p <= 0:
            continue
        cx, top = CARD_POS[slot]
        c = PATH_COLORS[pi]
        on = pi == hl
        ov, d = overlay()
        bw, bh = 340, 230
        x0, y0 = cx - bw / 2, top + (1 - p) * 40
        d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], 28,
                            fill=(15, 36, 64, 255) if not on else (22, 60, 92, 255),
                            outline=c + (255,), width=8 if on else 3)
        path_icon(d, pi, cx, y0 + bh * 0.4, 90, c + (255,))
        d.text((cx, y0 + bh * 0.8), PATHS[pi], font=font("EB", 38), fill=WHITE, anchor="mm")
        if on and pi == 0:
            tag = "먼저일 수도"
            f = font("EB", 26)
            tw = d.textlength(tag, font=f)
            d.rounded_rectangle([x0 + bw - tw - 44, y0 - 22, x0 + bw - 8, y0 + 26], 16, fill=c + (255,))
            d.text((x0 + bw - 26 - tw / 2, y0 + 2), tag, font=f, fill=NAVY_D, anchor="mm")
        comp(frame, ov, p if not on else 1.0)
        if not on and hl >= 0:  # 강조되지 않은 카드는 살짝 어둡게
            dim, dd = overlay()
            dd.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], 28, fill=(8, 18, 34, 255))
            comp(frame, dim, 0.45)
    # 확인 안내 박스
    ip = ease_out((t - CHECK_AT) / 0.45)
    if ip > 0:
        ov, d = overlay()
        y = 1240 + (1 - ip) * 30
        d.rounded_rectangle([CAP_X, y, 890, y + 150], 32, fill=TEAL + (255,))
        d.text((CAP_X + 40, y + 30), "적용 범위는 변호사와 확인", font=font("EB", 44), fill=WHITE)
        d.text((CAP_X + 40, y + 94), "법원·사건마다 다를 수 있어요", font=font("B", 30), fill=(240, 253, 250))
        comp(frame, ov, ip)
    # 보조 표기 (하단 20% 세이프존 위)
    ov, d = overlay()
    f = font("R", 26)
    d.text((CAP_X, 1438), "근거: 「채권의 공정한 추심에 관한 법률」 제8조의2", font=f, fill=SLATE400)
    d.text((CAP_X, 1476), "적용 대상은 채권자 유형에 따라 다름", font=f, fill=SLATE400)
    comp(frame, ov, ease_out((t - 0.3) / 0.4))
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 익명 체크(데모) → 엔드카드 ─────────────────────────
S5_ITEMS = [("연체 중인 채무가 있어요", 0.15), ("독촉 연락을 받고 있어요", 0.45), ("급여·통장 압류가 있어요", None)]
S5_PRESS = 0.8
S5_RESULT = 1.1
S5_SWITCH = 2.3   # 엔드카드 완전 전환 시점 (이후 고지문 노출 = 장면 길이 - 2.3초)


def screen_quick(t):
    s = Scr(SLATE50)
    s.status()
    s.text(36, 100, "익명 채무 체크", 40, SLATE900, "EB")
    s.rr(36, 160, 250, 204, 16, fill=TEAL_L)
    lock_icon(s, 64, 186, 22, TEAL_D)
    s.text(84, 182, "이름·번호 입력 없음", 20, TEAL_D, "EB", "lm")
    if t < S5_RESULT:
        for i, (lab, at) in enumerate(S5_ITEMS):
            y = 250 + i * 130
            on = at is not None and t >= at
            s.rr(36, y, SW - 36, y + 110, 22, fill=(240, 253, 250) if on else WHITE, outline=TEAL if on else SLATE200, width=3 if on else 2)
            s.rr(64, y + 31, 112, y + 79, 12, fill=TEAL if on else WHITE, outline=TEAL if on else SLATE300, width=3)
            if on:
                check_icon(s, 88, y + 56, 26, WHITE, 5)
            s.text(136, y + 55, lab, 28, SLATE900 if on else SLATE500, "EB", "lm")
        pressed = S5_PRESS <= t < S5_PRESS + 0.25
        s.rr(36, 700, SW - 36, 796, 26, fill=BLUE_D if pressed else BLUE)
        s.text(SW / 2, 748, "내 상황 정리하기", 32, WHITE, "EB", "mm")
    else:
        rt = t - S5_RESULT
        p = ease_out(rt / 0.35)
        y = 240 + (1 - p) * 40
        s.rr(28, y, SW - 28, y + 520, 30, fill=WHITE, outline=SLATE200, width=2)
        s.text(60, y + 30, "검토해 볼 방향", 28, SLATE900, "EB")
        rows = [("채무자대리", "추심 대응"), ("개인회생", "절차 검토"), ("신용회복", "조건 확인")]
        for i, (name, tag) in enumerate(rows):
            ip = ease_out((rt - 0.2 - i * 0.2) / 0.3)
            if ip <= 0:
                continue
            yy = y + 90 + i * 92
            s.rr(52, yy, SW - 52, yy + 76, 20, fill=(240, 253, 250), outline=TEAL, width=2)
            s.text(84, yy + 38, name, 28, SLATE900, "EB", "lm")
            tw = s.tlen(tag, 20, "EB")
            s.rr(SW - 84 - tw - 28, yy + 20, SW - 84, yy + 56, 14, fill=TEAL)
            s.text(SW - 84 - (tw + 28) / 2, yy + 38, tag, 20, WHITE, "EB", "mm")
        s.line([(60, y + 390), (SW - 60, y + 390)], SLATE100, 2)
        s.text(60, y + 410, "참고용 결과예요. 먼저 할 일은", 21, SLATE500, "B")
        s.text(60, y + 442, "선택한 변호사와 확인하세요.", 21, SLATE500, "B")
    return s.final()


def scene5(t, dur):
    fade0 = S5_SWITCH - 0.3
    if t >= S5_SWITCH:
        return ep01_endcard(t - fade0, dur - fade0)
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_quick(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 748, t - S5_PRESS)
    draw_caption(frame, SCENES[4]["caption"], t)
    if t >= fade0:
        end = ep01_endcard(t - fade0, dur - fade0)
        frame = Image.blend(frame, end, ease_in_out((t - fade0) / 0.3))
    return frame


class _LowMemSubprocess:
    """동시 렌더로 시스템 메모리가 부족할 때 x264 스레드·lookahead 를 줄여 인코더 메모리를 낮춘다.
    (render_ep01.py 는 수정하지 않고 이 모듈에서만 적용. 코덱·해상도·품질(CRF) 규격은 동일)"""
    PIPE = subprocess.PIPE

    @staticmethod
    def Popen(cmd, *a, **kw):
        if cmd and cmd[0] == "ffmpeg" and "libx264" in cmd:
            i = cmd.index("-c:v")
            cmd = cmd[:i] + ["-threads", "2", "-x264-params", "rc-lookahead=15"] + cmd[i:]
            # 느린 인코딩에서 -shortest 가 29.1초에서 조기 종료한 사례가 있어 제거
            # (오디오 믹스 길이 = 영상 길이로 이미 동일하게 맞춰져 있음)
            cmd = [c for c in cmd if c != "-shortest"]
        return subprocess.Popen(cmd, *a, **kw)


def main():
    base.subprocess = _LowMemSubprocess
    base.EP = EP
    base.OUT = base.ROOT / "assets" / "shorts" / EP
    base.TMP = base.OUT / "_work"
    base.SCENES = SCENES          # 엔드카드 자막·오디오·SRT 가 이 목록을 사용
    base.RENDERERS = [scene1, scene2, scene3, scene4, scene5]
    base.main()


if __name__ == "__main__":
    main()
