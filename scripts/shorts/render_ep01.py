# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP01 렌더러
기획: docs/youtube_shorts_plan.md  #1 "빚 상담, 번호부터 남기면 생기는 일"

출력: assets/shorts/ep01/
  - ep01_final.mp4   1080x1920, 30fps, H.264 + AAC
  - ep01_captions.srt 내레이션 자막(업로드용 CC)
  - ep01_thumb.png   첫 장면 썸네일
  - ep01_contact.png 장면별 검수용 컨택트시트

필요: Python 3.10+, Pillow, numpy, pydub, edge-tts, ffmpeg(PATH)
실행: python scripts/shorts/render_ep01.py
"""
import asyncio
import math
import os
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pydub import AudioSegment

ROOT = Path(__file__).resolve().parents[2]
EP = "ep01"  # 다른 편은 이 모듈을 import 해 EP/OUT/TMP/SCENES/RENDERERS 를 바꿔 main() 호출
OUT = ROOT / "assets" / "shorts" / EP
TMP = OUT / "_work"
LOGO = ROOT / "public" / "mykim_logo.png"

W, H, FPS = 1080, 1920, 30
VOICE = "ko-KR-SunHiNeural"
VOICE_RATE = "+4%"

# ── 브랜드 컬러 (기획서 3장) ─────────────────────────────
NAVY = (0x1E, 0x3A, 0x5F)
NAVY_D = (0x0F, 0x24, 0x40)
TEAL = (0x0D, 0x94, 0x88)
TEAL_L = (0xCC, 0xFB, 0xF1)
TEAL_D = (0x0F, 0x76, 0x6E)
BLUE = (0x3B, 0x82, 0xF6)
BLUE_D = (0x25, 0x63, 0xEB)
WHITE = (255, 255, 255)
SLATE50 = (0xF8, 0xFA, 0xFC)
SLATE100 = (0xF1, 0xF5, 0xF9)
SLATE200 = (0xE2, 0xE8, 0xF0)
SLATE300 = (0xCB, 0xD5, 0xE1)
SLATE400 = (0x94, 0xA3, 0xB8)
SLATE500 = (0x64, 0x74, 0x8B)
SLATE700 = (0x33, 0x41, 0x55)
SLATE900 = (0x0F, 0x17, 0x2A)
RED = (0xEF, 0x44, 0x44)
GREEN = (0x22, 0xC5, 0x5E)

# Pretendard 미설치 환경 → 동급 굵기의 NanumSquare로 대체
FONT_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts"
FONT_FILES = {
    "EB": [FONT_DIR / "NanumSquareEB.ttf", Path("C:/Windows/Fonts/malgunbd.ttf")],
    "B": [FONT_DIR / "NanumSquareB.ttf", Path("C:/Windows/Fonts/malgunbd.ttf")],
    "R": [FONT_DIR / "NanumSquareR.ttf", Path("C:/Windows/Fonts/malgun.ttf")],
}


@lru_cache(maxsize=None)
def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for p in FONT_FILES[weight]:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    raise FileNotFoundError(f"font {weight} not found")


# ── 콘티 (기획서 5장 #1 그대로, [ ] = 하이라이트) ───────────
SCENES = [
    dict(plan=3.0, caption="[번호부터]\n남기셨나요?",
         narration="빚 상담, 번호부터 남기셨나요?",
         tts="빚 상담, 번호부터 남기셨나요?"),
    dict(plan=6.0, caption="그 뒤로\n[모르는 전화]",
         narration="그 뒤로 모르는 번호 전화, 계속 오셨죠.",
         tts="그 뒤로 모르는 번호 전화, 계속 오셨죠."),
    dict(plan=9.0, caption="010 번호 없이,\n[가명으로]",
         narration="마이김변은 실명과 010 번호 없이, 스텔스 가명으로 상담을 요청합니다.",
         tts="마이김변은 실명과 공일공 번호 없이, 스텔스 가명으로 상담을 요청합니다."),
    dict(plan=8.0, caption="계약 전까지\n연락처 [비공개]",
         narration="변호사 프로필은 내가 먼저 보고, 연락처는 계약 전까지 공개되지 않아요.",
         tts="변호사 프로필은 내가 먼저 보고, 연락처는 계약 전까지 공개되지 않아요."),
    dict(plan=6.0, caption="[먼저 고르고,]\n연락은 그다음",
         narration="연락받기 전에 먼저 골라 보세요. 번호부터 남기기 전에요.",
         tts="연락받기 전에 먼저 골라 보세요. 번호부터 남기기 전에요."),
]

DISCLAIMER = ("마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 "
              "법률사무소가 수행합니다. 인가·면책은 법원이 판단합니다.")

VOICE_OFFSET = 0.15  # 장면 시작 후 내레이션 진입(초)


# ── 유틸 ────────────────────────────────────────────────
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def vgradient(w, h, top, bottom):
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = np.linspace(top[i], bottom[i], h, dtype=np.float32)[:, None]
    return Image.fromarray(arr, "RGB")


@lru_cache(maxsize=None)
def background():
    """Deep Navy 그라데이션 + 약한 비네트"""
    bg = vgradient(W, H, NAVY, NAVY_D).convert("RGBA")
    vig = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(vig)
    d.ellipse([-300, -200, W + 300, H + 200], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(220))
    dark = Image.new("RGBA", (W, H), (5, 12, 26, 255))
    dark.putalpha(Image.eval(vig, lambda v: int((255 - v) * 0.55)))
    bg.alpha_composite(dark)
    return bg.convert("RGB")


def zoom(img, s, cx=W / 2, cy=H / 2):
    """중심(cx,cy) 기준 확대(s>1)"""
    if abs(s - 1) < 1e-4:
        return img
    cw, ch = W / s, H / s
    cx = clamp(cx, cw / 2, W - cw / 2)
    cy = clamp(cy, ch / 2, H - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return img.resize((W, H), Image.BICUBIC, box=box)


# ── 자막 ────────────────────────────────────────────────
CAP_SIZE = 96
CAP_LH = 128
CAP_X = 90          # 좌측 정렬 (우측 15% 세이프존 회피)
CAP_Y = 250         # 상단 영역 (하단 20% 세이프존 회피)


def parse_caption(text):
    lines = []
    for raw in text.split("\n"):
        segs, buf, hl = [], "", False
        for ch in raw:
            if ch in "[]":
                if buf:
                    segs.append((buf, hl))
                buf, hl = "", ch == "["
            else:
                buf += ch
        if buf:
            segs.append((buf, hl))
        lines.append(segs)
    return lines


@lru_cache(maxsize=None)
def caption_layer(text, center=False, y0=CAP_Y):
    f = font("EB", CAP_SIZE)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(layer), ImageDraw.Draw(shadow)
    for li, segs in enumerate(parse_caption(text)):
        y = y0 + li * CAP_LH
        total = sum(d.textlength(s, font=f) for s, _ in segs)
        x = (W - total) / 2 if center else CAP_X
        for s, hl in segs:
            tw = d.textlength(s, font=f)
            if hl:
                d.rounded_rectangle([x - 14, y - 10, x + tw + 14, y + CAP_SIZE + 12], 18, fill=TEAL + (255,))
            else:
                ds.text((x + 3, y + 5), s, font=f, fill=(0, 0, 0, 170))
            d.text((x, y), s, font=f, fill=WHITE + (255,))
            x += tw
    shadow = shadow.filter(ImageFilter.GaussianBlur(7))
    shadow.alpha_composite(layer)
    return shadow


def draw_caption(frame, text, t, center=False, y0=CAP_Y):
    layer = caption_layer(text, center, y0)
    p = ease_out(t / 0.35)
    if p < 1:
        a = layer.getchannel("A").point(lambda v: int(v * p))
        layer = layer.copy()
        layer.putalpha(a)
        off = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        off.alpha_composite(layer, (0, int(40 * (1 - p))))
        layer = off
    frame.alpha_composite(layer)


def chip(frame, text, x, y):
    """'예시 화면' 표기 칩"""
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    f = font("B", 30)
    tw = d.textlength(text, font=f)
    d.rounded_rectangle([x, y, x + tw + 36, y + 52], 14, fill=(15, 36, 64, 200), outline=(203, 213, 225, 160), width=2)
    d.text((x + 18, y + 11), text, font=f, fill=SLATE200 + (255,))
    frame.alpha_composite(ov)


# ── 폰 목업 (2배 해상도로 그린 뒤 축소 → 안티에일리어싱) ─────
K = 2
SW, SH = 544, 1144              # 화면(1x)
PW, PH = 580, 1180              # 본체(1x)
PX, PY = 250, 610               # 본체 좌상단(1x). 우측 끝 830 < 918
BEZ = (PW - SW) // 2


class Scr:
    """화면 좌표(1x)로 그리는 2x 캔버스"""

    def __init__(self, bg):
        self.img = Image.new("RGB", (SW * K, SH * K), bg)
        self.d = ImageDraw.Draw(self.img)

    def rr(self, x0, y0, x1, y1, r, fill=None, outline=None, width=0):
        self.d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], int(r * K), fill=fill, outline=outline, width=int(width * K))

    def circ(self, cx, cy, r, fill=None, outline=None, width=0):
        self.d.ellipse([(cx - r) * K, (cy - r) * K, (cx + r) * K, (cy + r) * K], fill=fill, outline=outline, width=int(width * K))

    def text(self, x, y, s, size, fill, w="B", anchor="la"):
        self.d.text((x * K, y * K), s, font=font(w, int(size * K)), fill=fill, anchor=anchor)

    def tlen(self, s, size, w="B"):
        return self.d.textlength(s, font=font(w, int(size * K))) / K

    def line(self, pts, fill, width):
        self.d.line([(x * K, y * K) for x, y in pts], fill=fill, width=int(width * K), joint="curve")

    def arc(self, box, a0, a1, fill, width):
        self.d.arc([v * K for v in box], a0, a1, fill=fill, width=int(width * K))

    def status(self, dark=False):
        c = WHITE if dark else SLATE900
        self.text(40, 26, "9:41", 24, c, "EB")
        for i in range(4):
            h = 8 + i * 5
            self.rr(430 + i * 11, 44 - h, 437 + i * 11, 44, 2, fill=c)
        self.rr(482, 26, 518, 44, 5, outline=c, width=2)
        self.rr(486, 30, 508, 40, 2, fill=c)

    def final(self):
        return self.img.resize((SW, SH), Image.LANCZOS)


def avatar(s: Scr, cx, cy, r, bg, fg):
    """실존 인물이 아닌 기본 실루엣 아바타"""
    size = int(r * 2 * K)
    im = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(im)
    hr = size * 0.2
    d.ellipse([size / 2 - hr, size * 0.2, size / 2 + hr, size * 0.2 + hr * 2], fill=fg)
    d.ellipse([size * 0.18, size * 0.64, size * 0.82, size * 1.25], fill=fg)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    s.img.paste(im, (int((cx - r) * K), int((cy - r) * K)), mask)


def lock_icon(s: Scr, cx, cy, sz, color):
    s.arc((cx - sz * 0.32, cy - sz * 0.62, cx + sz * 0.32, cy + sz * 0.05), 180, 360, color, sz * 0.12)
    s.line([(cx - sz * 0.32, cy - sz * 0.28), (cx - sz * 0.32, cy - sz * 0.05)], color, sz * 0.12)
    s.line([(cx + sz * 0.32, cy - sz * 0.28), (cx + sz * 0.32, cy - sz * 0.05)], color, sz * 0.12)
    s.rr(cx - sz * 0.46, cy - sz * 0.08, cx + sz * 0.46, cy + sz * 0.5, sz * 0.1, fill=color)


def check_icon(s: Scr, cx, cy, sz, color, width=None):
    s.line([(cx - sz * 0.45, cy), (cx - sz * 0.12, cy + sz * 0.32), (cx + sz * 0.48, cy - sz * 0.36)], color, width or sz * 0.18)


def handset(s: Scr, cx, cy, sz, color, rot=0):
    """단순화한 수화기 아이콘"""
    size = int(sz * 2 * K)
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    w = size * 0.16
    d.arc([size * 0.18, size * 0.18, size * 0.82, size * 0.82], 110, 250, fill=255, width=int(w))
    d.rounded_rectangle([size * 0.22, size * 0.14, size * 0.46, size * 0.32], int(w / 2), fill=255)
    d.rounded_rectangle([size * 0.22, size * 0.68, size * 0.46, size * 0.86], int(w / 2), fill=255)
    im = im.rotate(-45 + rot, resample=Image.BICUBIC)
    s.img.paste(Image.new("RGB", (size, size), color), (int((cx - sz) * K), int((cy - sz) * K)), im)


@lru_cache(maxsize=None)
def phone_body():
    """본체 + 그림자 (RGBA, 여백 포함)"""
    m = 80
    img = Image.new("RGBA", ((PW + m * 2) * K, (PH + m * 2) * K), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([(m + 10) * K, (m + 40) * K, (m + PW - 10) * K, (m + PH + 20) * K], 80 * K, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(30 * K))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([m * K, m * K, (m + PW) * K, (m + PH) * K], 76 * K, fill=(12, 18, 32, 255), outline=(71, 85, 105, 255), width=3 * K)
    return img.resize((PW + m * 2, PH + m * 2), Image.LANCZOS), m


@lru_cache(maxsize=None)
def screen_mask():
    mk = Image.new("L", (SW * K, SH * K), 0)
    ImageDraw.Draw(mk).rounded_rectangle([0, 0, SW * K - 1, SH * K - 1], 58 * K, fill=255)
    return mk.resize((SW, SH), Image.LANCZOS)


def put_phone(frame, screen: Image.Image, dx=0, dy=0, notch=True):
    body, m = phone_body()
    x, y = int(PX + dx), int(PY + dy)
    frame.alpha_composite(body, (x - m, y - m))
    frame.paste(screen, (x + BEZ, y + BEZ), screen_mask())
    if notch:
        d = ImageDraw.Draw(frame)
        cx = x + PW / 2
        d.rounded_rectangle([cx - 62, y + BEZ + 14, cx + 62, y + BEZ + 48], 17, fill=(0, 0, 0))


def tap(frame, sx, sy, t):
    """손가락 탭 효과 (화면 좌표 sx,sy 기준, t: 탭 이후 경과초)"""
    if t < 0 or t > 0.6:
        return
    x, y = PX + BEZ + sx, PY + BEZ + sy
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    p = ease_out(t / 0.6)
    r = 30 + 60 * p
    a = int(200 * (1 - p))
    d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, a), width=6)
    if t < 0.25:
        d.ellipse([x - 34, y - 34, x + 34, y + 34], fill=(255, 255, 255, 120))
    frame.alpha_composite(ov)


# ── 장면 1: 연달아 진동하는 휴대폰 (zoom-in) ─────────────────
def screen_incoming(t):
    s = Scr((17, 24, 39))
    grad = vgradient(SW * K, SH * K, (30, 41, 59), (15, 23, 42))
    s.img.paste(grad)
    s.status(dark=True)
    s.text(SW / 2, 150, "수신 전화", 28, SLATE400, "B", "mm")
    pulse = 0.5 + 0.5 * math.sin(t * 8)
    s.circ(SW / 2, 360, 118 + 10 * pulse, fill=(51, 65, 85))
    avatar(s, SW / 2, 360, 100, (71, 85, 105), (148, 163, 184))
    s.text(SW / 2, 540, "알 수 없는 번호", 46, WHITE, "EB", "mm")
    s.text(SW / 2, 600, "010-****-****", 32, SLATE400, "B", "mm")
    for i, (cx, col, lab, rot) in enumerate([(150, RED, "거절", 90), (394, GREEN, "받기", 0)]):
        if i == 1:
            rp = (t * 1.4) % 1
            s.circ(cx, 930, 64 + 40 * rp, outline=lerp_color(GREEN, (15, 23, 42), rp), width=4)
        s.circ(cx, 930, 64, fill=col)
        handset(s, cx, 930, 36, WHITE, rot)
        s.text(cx, 1030, lab, 26, SLATE300, "B", "mm")
    return s.final()


def vibrating(t):
    """0.2~0.9, 1.1~1.8, 2.0~2.7 구간 진동"""
    for a, b in [(0.15, 0.9), (1.1, 1.85), (2.05, 2.8)]:
        if a <= t <= b:
            return True
    return False


def scene1(t, dur):
    frame = background().copy().convert("RGBA")
    d = ImageDraw.Draw(frame)
    # 책상 느낌의 바닥 조명
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([80, 1180, 1000, 1900], fill=(59, 130, 246, 38))
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    vib = vibrating(t)
    dx = math.sin(t * 95) * 9 if vib else 0
    dy = math.cos(t * 81) * 3 if vib else 0
    put_phone(frame, screen_incoming(t), dx, dy)
    if vib:
        k = (t * 6) % 1
        for side in (-1, 1):
            cx = PX + PW / 2 + side * (PW / 2 + 30)
            for j in range(2):
                off = 18 + j * 26 + k * 10
                box = [cx - off, PY + 470 - off * 1.5, cx + off, PY + 470 + off * 1.5]
                a = 235 if side < 0 else -55
                d.arc(box, a - 10 if side < 0 else a - 10, a + 70 if side < 0 else a + 70, fill=(203, 213, 225, 255), width=7)
    # 하단 기준 zoom-in → 폰이 자막 영역을 덮지 않음
    frame = zoom(frame.convert("RGB"), 1.0 + 0.10 * ease_in_out(t / dur), W / 2, H).convert("RGBA")
    draw_caption(frame, SCENES[0]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 2: 모르는 번호 수신 기록 누적 ─────────────────────────
CALLS = [
    ("010-****-**27", "오후 7:42"), ("070-****-**03", "오후 7:31"), ("02-***-**58", "오후 6:55"),
    ("010-****-**91", "오후 5:12"), ("070-****-**46", "오후 3:40"), ("031-***-**20", "오후 2:18"),
    ("010-****-**64", "오후 1:05"), ("070-****-**88", "오전 11:52"), ("02-***-**15", "오전 10:37"),
    ("010-****-**39", "오전 9:20"),
]


def screen_calllog(t):
    s = Scr(WHITE)
    appear = [0.2 + i * 0.5 for i in range(len(CALLS))]
    n_vis = sum(1 for a in appear if t >= a)
    top, rowh = 250, 104
    # 먼저 들어온(오래된) 항목부터 → 새 항목이 위로 쌓이며 아래로 밀림
    order = list(range(len(CALLS)))[::-1]  # 오래된 것 = 마지막 인덱스
    for vis_i, ci in enumerate(order):
        a = appear[vis_i]
        if t < a:
            continue
        idx = sum(ease_out((t - appear[j]) / 0.3) for j in range(vis_i + 1, len(CALLS)) if t >= appear[j])
        e = ease_out((t - a) / 0.3)
        y = top + idx * rowh - (1 - e) * 40
        if y > SH:
            continue
        num, tm = CALLS[ci]
        if e < 1:
            s.rr(16, y + 4, SW - 16, y + rowh - 4, 18, fill=lerp_color((254, 226, 226), WHITE, e))
        s.circ(64, y + rowh / 2, 28, fill=(254, 226, 226))
        handset(s, 64, y + rowh / 2, 17, RED, 0)
        s.text(112, y + 24, "알 수 없는 번호", 29, RED, "EB")
        s.text(112, y + 62, f"부재중 · {num}", 22, SLATE500, "B")
        s.text(SW - 36, y + 38, tm, 22, SLATE400, "B", "ra")
        s.line([(112, y + rowh), (SW - 24, y + rowh)], SLATE100, 2)
    # 헤더(목록 위에 그려서 가림)
    s.rr(0, 0, SW, top - 6, 0, fill=WHITE)
    s.status()
    s.text(36, 100, "최근 기록", 44, SLATE900, "EB")
    s.rr(36, 176, 160, 224, 24, fill=SLATE900)
    s.text(98, 200, "전체", 24, WHITE, "B", "mm")
    s.rr(172, 176, 318, 224, 24, fill=(254, 226, 226))
    s.text(245, 200, f"부재중 {n_vis}", 24, RED, "EB", "mm")
    return s.final()


def scene2(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_calllog(t), 0, 0)
    frame = zoom(frame.convert("RGB"), 1.06 - 0.06 * ease_out(t / dur), W / 2, 1100).convert("RGBA")
    draw_caption(frame, SCENES[1]["caption"], t)
    chip(frame, "예시 화면", CAP_X, 520)
    return frame


# ── 장면 3: 스텔스 가명 생성 UI ─────────────────────────────
ALIAS_FINAL = "용감한 고래 42"
ALIAS_ROLL = ["맑은 호수 17", "푸른 소나무 63", "조용한 별 28", "느긋한 구름 55", "단단한 바위 71", "포근한 달 34"]


def toggle(s: Scr, x, y, p):
    track = lerp_color(SLATE300, TEAL, p)
    s.rr(x, y, x + 88, y + 50, 25, fill=track)
    kx = lerp(x + 25, x + 63, p)
    s.circ(kx, y + 25, 20, fill=WHITE)


def screen_alias(t):
    s = Scr(SLATE50)
    s.status()
    s.line([(48, 112), (34, 126), (48, 140)], SLATE900, 5)
    s.text(SW / 2, 126, "상담 요청", 32, SLATE900, "EB", "mm")

    # 가명 카드
    s.rr(28, 190, SW - 28, 470, 32, fill=WHITE, outline=SLATE200, width=2)
    s.text(60, 226, "내 표시 이름", 24, SLATE500, "B")
    s.rr(SW - 206, 218, SW - 56, 262, 16, fill=TEAL_L)
    s.text(SW - 131, 240, "스텔스 가명", 22, TEAL_D, "EB", "mm")
    if t < 0.6:
        alias, done = "· · ·", False
    elif t < 2.4:
        alias, done = ALIAS_ROLL[int((t - 0.6) / 0.16) % len(ALIAS_ROLL)], False
    else:
        alias, done = ALIAS_FINAL, True
    s.rr(60, 290, SW - 60, 400, 22, fill=SLATE50 if not done else (240, 253, 250), outline=TEAL if done else SLATE200, width=3 if done else 2)
    s.text(90, 345, alias, 44, SLATE900 if done else SLATE400, "EB", "lm")
    if done:
        p = ease_out((t - 2.4) / 0.3)
        s.circ(SW - 110, 345, 26 * p + 0.1, fill=TEAL)
        if p > 0.5:
            check_icon(s, SW - 110, 346, 26, WHITE, 5)
    s.text(60, 424, "실명 대신 이 이름으로만 보여요", 22, SLATE500, "B")

    # 비공개 항목
    s.rr(28, 500, SW - 28, 760, 32, fill=WHITE, outline=SLATE200, width=2)
    rows = [("실명", 3.3), ("010 번호", 4.3)]
    for i, (lab, ton) in enumerate(rows):
        y = 530 + i * 116
        s.circ(84, y + 42, 32, fill=SLATE100)
        lock_icon(s, 84, y + 44, 34, SLATE700)
        s.text(136, y + 24, lab, 30, SLATE900, "EB")
        p = ease_out((t - ton) / 0.3)
        s.text(136, y + 62, "비공개" if p > 0.5 else "공개", 22, TEAL_D if p > 0.5 else SLATE400, "B")
        toggle(s, SW - 150, y + 18, p)
        if i == 0:
            s.line([(60, y + 110), (SW - 60, y + 110)], SLATE100, 2)

    # 버튼
    tap_t = 6.6
    pressed = tap_t <= t < tap_t + 0.25
    ready = t >= 4.6
    col = BLUE_D if pressed else (BLUE if ready else SLATE300)
    s.rr(28, 820, SW - 28, 916, 26, fill=col)
    s.text(SW / 2, 868, "가명으로 상담 요청", 32, WHITE, "EB", "mm")

    # 완료 토스트
    if t >= 7.1:
        p = ease_out((t - 7.1) / 0.35)
        y = lerp(-120, 70, p)
        s.rr(28, y, SW - 28, y + 96, 28, fill=SLATE900)
        s.circ(84, y + 48, 24, fill=TEAL)
        check_icon(s, 84, y + 49, 24, WHITE, 5)
        s.text(126, y + 30, "상담 요청 완료", 26, WHITE, "EB")
        s.text(126, y + 64, "변호사에게는 가명만 전달돼요", 20, SLATE300, "B")
    return s.final()


def scene3(t, dur):
    frame = background().copy().convert("RGBA")
    put_phone(frame, screen_alias(t), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 868, t - 6.6)
    draw_caption(frame, SCENES[2]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 4: 변호사 프로필 카드 스크롤 ───────────────────────────
LAWYERS = [
    ("예시 변호사 A", "개인회생·파산 사건 경험", ["서울", "상담방 답변"], (219, 234, 254), (96, 165, 250)),
    ("예시 변호사 B", "개인회생 사건 경험", ["경기", "야간 상담"], (204, 251, 241), (45, 212, 191)),
    ("예시 변호사 C", "채무조정·파산 사건 경험", ["부산", "상담방 답변"], (237, 233, 254), (167, 139, 250)),
    ("예시 변호사 D", "개인회생 사건 경험", ["인천", "주말 상담"], (254, 243, 199), (251, 191, 36)),
    ("예시 변호사 E", "개인파산 사건 경험", ["대전", "상담방 답변"], (252, 231, 243), (244, 114, 182)),
]


def screen_lawyers(t):
    s = Scr(SLATE50)
    list_top, cardh, gap = 400, 200, 22
    scroll = 200 * ease_in_out((t - 0.4) / 3.2)
    sel_t = 4.6
    sel_i = 2
    for i, (name, exp, tags, bg, fg) in enumerate(LAWYERS):
        y = list_top + i * (cardh + gap) - scroll
        if y > SH or y + cardh < list_top - 40:
            continue
        selected = i == sel_i and t >= sel_t
        s.rr(28, y, SW - 28, y + cardh, 30, fill=WHITE, outline=TEAL if selected else SLATE200, width=4 if selected else 2)
        avatar(s, 100, y + 72, 44, bg, fg)
        s.text(166, y + 38, name, 30, SLATE900, "EB")
        s.text(166, y + 82, exp, 22, SLATE500, "B")
        tx = 60
        for tg in tags:
            tw = s.tlen(tg, 20)
            s.rr(tx, y + 134, tx + tw + 28, y + 172, 14, fill=SLATE100)
            s.text(tx + 14, y + 153, tg, 20, SLATE700, "B", "lm")
            tx += tw + 40
        bx0, bx1 = SW - 176, SW - 56
        if selected:
            s.rr(bx0, y + 128, bx1, y + 178, 16, fill=TEAL)
            s.text((bx0 + bx1) / 2, y + 153, "선택됨", 22, WHITE, "EB", "mm")
        else:
            s.rr(bx0, y + 128, bx1, y + 178, 16, outline=BLUE, width=3)
            s.text((bx0 + bx1) / 2, y + 153, "선택", 22, BLUE, "EB", "mm")
    # 고정 헤더
    s.rr(0, 0, SW, list_top - 16, 0, fill=SLATE50)
    s.status()
    s.text(36, 100, "변호사 선택", 42, SLATE900, "EB")
    s.text(36, 160, "프로필을 보고 직접 고르세요", 24, SLATE500, "B")
    # 연락처 비공개 배너
    lp = ease_out((t - 1.0) / 0.4)
    s.rr(28, 214, SW - 28, 364, 28, fill=lerp_color(SLATE100, (240, 253, 250), lp), outline=lerp_color(SLATE200, TEAL, lp), width=3)
    s.circ(96, 289, 38, fill=lerp_color(SLATE300, TEAL, lp))
    lock_icon(s, 96, 292, 40, WHITE)
    s.text(152, 250, "내 연락처", 24, SLATE500, "B")
    s.text(152, 290, "계약 전까지 비공개", 32, TEAL_D, "EB")
    s.text(152, 332, "실명·010 번호 모두", 20, SLATE500, "B")
    return s.final(), (SW - 116, list_top + sel_i * (cardh + gap) - scroll + 153)


def scene4(t, dur):
    frame = background().copy().convert("RGBA")
    scr, tap_pos = screen_lawyers(t)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, tap_pos[0], tap_pos[1], t - 4.4)
    draw_caption(frame, SCENES[3]["caption"], t)
    chip(frame, "데모 화면", CAP_X, 520)
    return frame


# ── 장면 5: 엔드카드 (로고는 이 장면에만) ─────────────────────
@lru_cache(maxsize=None)
def logo_tile(size=300):
    src = Image.open(LOGO).convert("RGB")
    tile = Image.new("RGBA", (size * K, size * K), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle([0, 0, size * K - 1, size * K - 1], 64 * K, fill=WHITE + (255,))
    lg = src.resize((int(size * K * 0.86), int(size * K * 0.86)), Image.LANCZOS)
    off = (size * K - lg.width) // 2
    tile.paste(lg, (off, off))
    mask = Image.new("L", tile.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * K - 1, size * K - 1], 64 * K, fill=255)
    tile.putalpha(mask)
    return tile.resize((size, size), Image.LANCZOS)


def wrap(d, text, f, maxw):
    lines, cur = [], ""
    for word in text.split(" "):
        test = (cur + " " + word).strip()
        if d.textlength(test, font=f) <= maxw:
            cur = test
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def scene5(t, dur):
    frame = background().copy().convert("RGBA")
    d = ImageDraw.Draw(frame)
    # 로고
    p = ease_out(t / 0.45)
    size = 300
    tile = logo_tile(size)
    sc = 0.85 + 0.15 * p
    tl = tile.resize((int(size * sc), int(size * sc)), Image.LANCZOS)
    a = tl.getchannel("A").point(lambda v: int(v * p))
    tl.putalpha(a)
    frame.alpha_composite(tl, (int(W / 2 - tl.width / 2), int(330 + size / 2 - tl.height / 2)))
    d.text((W / 2, 690), "마이김변", font=font("EB", 44), fill=WHITE, anchor="mm")

    draw_caption(frame, SCENES[4]["caption"], max(0, t - 0.2), center=True, y0=790)

    # CTA 버튼
    cp = ease_out((t - 0.7) / 0.4)
    if cp > 0:
        pulse = 1 + 0.025 * math.sin(max(0, t - 1.2) * 5)
        bw, bh = 780 * pulse, 132 * pulse
        cy = 1150 + (1 - cp) * 30
        btn = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(btn)
        bd.rounded_rectangle([W / 2 - bw / 2, cy - bh / 2, W / 2 + bw / 2, cy + bh / 2], 34, fill=BLUE + (int(255 * cp),))
        bd.text((W / 2, cy - 2), "프로필 링크 → 익명 채무 체크", font=font("EB", 46), fill=(255, 255, 255, int(255 * cp)), anchor="mm")
        frame.alpha_composite(btn)
        d.text((W / 2, 1262), "mykim.kr/check", font=font("B", 34), fill=SLATE300, anchor="mm")

    # 고지문 (장면 전체 노출, 하단 20% 위)
    f = font("R", 30)
    lines = wrap(d, DISCLAIMER, f, 800)
    y = 1350
    d.line([(140, y - 24), (W - 140, y - 24)], fill=SLATE700, width=2)
    for ln in lines:
        d.text((W / 2, y), ln, font=f, fill=SLATE300, anchor="ma")
        y += 44
    return frame


RENDERERS = [scene1, scene2, scene3, scene4, scene5]


# ── 오디오 ──────────────────────────────────────────────
async def tts_all():
    import edge_tts
    for i, sc in enumerate(SCENES):
        path = TMP / f"vo_{i + 1}.mp3"
        if path.exists() and path.stat().st_size > 1000:
            continue
        await edge_tts.Communicate(sc["tts"], VOICE, rate=VOICE_RATE).save(str(path))


def trim_silence(seg: AudioSegment, thresh=-45):
    from pydub.silence import detect_leading_silence
    start = detect_leading_silence(seg, thresh)
    end = detect_leading_silence(seg.reverse(), thresh)
    return seg[max(0, start - 20): len(seg) - max(0, end - 60)]


def synth_bgm(seconds, sr=44100):
    """직접 합성한 잔잔한 패드 (저작권 이슈 없음)"""
    n = int(seconds * sr)
    t = np.arange(n) / sr
    chords = [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0],
              [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0]]
    out = np.zeros(n)
    seg = 4.0
    for k in range(int(math.ceil(seconds / seg)) + 1):
        c = chords[k % 4]
        s0 = k * seg - 0.8
        idx = (t >= s0) & (t < s0 + seg + 1.6)
        lt = t[idx] - s0
        env = np.minimum(1, lt / 1.2) * np.minimum(1, (seg + 1.6 - lt) / 1.2)
        for f0 in c:
            for det in (-0.6, 0.6):
                out[idx] += env * np.sin(2 * math.pi * (f0 + det) * t[idx]) * 0.5
            out[idx] += env * 0.12 * np.sin(2 * math.pi * f0 * 2 * t[idx])
        # 저음
        out[idx] += env * 0.6 * np.sin(2 * math.pi * c[0] / 2 * t[idx])
    # 간단한 로우패스
    kernel = np.ones(24) / 24
    out = np.convolve(out, kernel, mode="same")
    out /= np.max(np.abs(out)) + 1e-9
    fade = np.minimum(1, t / 0.5) * np.minimum(1, (seconds - t) / 1.2)
    out *= fade
    pcm = (out * 32767 * 0.9).astype(np.int16)
    return AudioSegment(pcm.tobytes(), frame_rate=sr, sample_width=2, channels=1).set_channels(2)


def build_audio():
    asyncio.run(tts_all())
    vos = [trim_silence(AudioSegment.from_file(TMP / f"vo_{i + 1}.mp3")) for i in range(len(SCENES))]
    durs = []
    for sc, vo in zip(SCENES, vos):
        need = VOICE_OFFSET + len(vo) / 1000 + 0.35
        durs.append(round(max(sc["plan"], need) * FPS) / FPS)
    total = sum(durs)
    mix = AudioSegment.silent(duration=int(total * 1000) + 50, frame_rate=44100).set_channels(2)
    bgm = synth_bgm(total) - 27
    mix = mix.overlay(bgm)
    starts, acc = [], 0.0
    for d_, vo in zip(durs, vos):
        starts.append(acc)
        mix = mix.overlay(vo.set_frame_rate(44100).set_channels(2), position=int((acc + VOICE_OFFSET) * 1000))
        acc += d_
    mix = mix[: int(total * 1000)]
    wav = TMP / "mix.wav"
    mix.export(wav, format="wav")
    return durs, starts, [len(v) / 1000 for v in vos], wav


def fmt_srt(x):
    ms = int(round(x * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def write_srt(starts, vo_lens):
    lines = []
    for i, (st, ln, sc) in enumerate(zip(starts, vo_lens, SCENES), 1):
        a = st + VOICE_OFFSET
        lines += [str(i), f"{fmt_srt(a)} --> {fmt_srt(a + ln)}", sc["narration"], ""]
    (OUT / f"{EP}_captions.srt").write_text("\n".join(lines), encoding="utf-8")


# ── 메인 ────────────────────────────────────────────────
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    print("[1/3] 내레이션·BGM 생성")
    durs, starts, vo_lens, wav = build_audio()
    total = sum(durs)
    print("  장면 길이:", [f"{d:.2f}" for d in durs], f"총 {total:.2f}s")
    write_srt(starts, vo_lens)

    print("[2/3] 프레임 렌더링 → ffmpeg 인코딩")
    out_mp4 = OUT / f"{EP}_final.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav),
           "-map", "0:v", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-movflags", "+faststart", "-shortest", str(out_mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    contact = []
    fi = 0
    for si, (render, dur) in enumerate(zip(RENDERERS, durs)):
        n = int(round(dur * FPS))
        for k in range(n):
            t = k / FPS
            img = render(t, dur).convert("RGB")
            proc.stdin.write(img.tobytes())
            if k == int(n * 0.75):
                contact.append(img.resize((270, 480), Image.LANCZOS))
            if si == 0 and k == int(FPS * 1.2):
                img.save(OUT / f"{EP}_thumb.png")
            fi += 1
        print(f"  장면 {si + 1} 완료 ({n}프레임)")
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg 인코딩 실패")

    sheet = Image.new("RGB", (270 * len(contact) + 10 * (len(contact) + 1), 500), (30, 30, 30))
    for i, im in enumerate(contact):
        sheet.paste(im, (10 + i * 280, 10))
    sheet.save(OUT / f"{EP}_contact.png")
    print(f"[3/3] 완료: {out_mp4} ({fi}프레임, {total:.2f}s)")


if __name__ == "__main__":
    main()
