# -*- coding: utf-8 -*-
"""
마이김변 쇼츠·릴스 Part 4 (EP37~EP66) 엔진
기획: docs/youtube_shorts_plan_part4.md

Part 1~3(render_ep01.py·part2_kit.py·part3_kit.py)과 달리 한 편의 대본(데이터)으로
  - 유튜브 쇼츠 세로 1080x1920 (epNN_final.mp4)
  - 인스타그램 정사각 1080x1080 (epNN_square.mp4)
두 규격을 같은 오디오로 렌더링한다. 장면 레이아웃은 규격별 콘텐츠 영역에 맞춰 다시 계산한다.

음성: edge-tts 한국어 신경망 음성 3종(선희·인준·현수) × 말투 프리셋. 대사마다 화자를 지정할 수 있어
대화·인터뷰·퀴즈 편은 두 사람 목소리로 진행한다. WordBoundary 이벤트로 단어 단위 싱크(자막·모션)를 맞춘다.
BGM·효과음: 코드로 직접 합성 (저작권 이슈 없음), 내레이션 구간에서는 BGM 자동 더킹.

필요: Python 3.10+, Pillow, numpy, pydub, edge-tts, ffmpeg(PATH)
"""
import asyncio
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pydub import AudioSegment
from pydub.silence import detect_leading_silence

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render_ep01 as base  # noqa: E402
import part2_kit as kit2  # noqa: E402
import part3_kit as kit3  # noqa: E402

ROOT = base.ROOT
FPS = 30
SR = 44100
TTS_CACHE = ROOT / "assets" / "shorts" / "_tts_cache"
DISCLAIMER = base.DISCLAIMER

# ── 음성 프리셋 (edge-tts 한국어 신경망 음성) ────────────────────
VOICES = {
    "sunhi": ("ko-KR-SunHiNeural", "+4%", "+0Hz"),          # 선희: 밝은 기본 진행
    "sunhi_bright": ("ko-KR-SunHiNeural", "+8%", "+5Hz"),   # 선희: 퀴즈 MC 톤
    "sunhi_soft": ("ko-KR-SunHiNeural", "-3%", "-3Hz"),     # 선희: 차분한 공감 톤
    "injoon": ("ko-KR-InJoonNeural", "+7%", "+0Hz"),        # 인준: 또렷한 해설
    "injoon_deep": ("ko-KR-InJoonNeural", "+4%", "-6Hz"),   # 인준: 낮은 브리핑 톤
    "hyunsu": ("ko-KR-HyunsuMultilingualNeural", "+4%", "+0Hz"),  # 현수: 자연스러운 대화체
    "hyunsu_up": ("ko-KR-HyunsuMultilingualNeural", "+9%", "+3Hz"),  # 현수: 경쾌한 카운트다운
}
VOICE_LABEL = {
    "sunhi": "선희(기본)", "sunhi_bright": "선희(밝은 MC)", "sunhi_soft": "선희(차분)",
    "injoon": "인준(해설)", "injoon_deep": "인준(브리핑)", "hyunsu": "현수(대화)", "hyunsu_up": "현수(경쾌)",
}

# ── 색 ─────────────────────────────────────────────────
WHITE = (255, 255, 255)
INK = (15, 23, 42)
TEAL = (13, 148, 136)
TEAL_B = (45, 212, 191)
NAVY = (30, 58, 95)
BLUE = (37, 99, 235)
AMBER = (245, 158, 11)
RED = (220, 38, 38)

THEMES = {
    "navy": dict(bg=((30, 58, 95), (11, 26, 48)), fg=WHITE, sub=(203, 213, 225), acc=(45, 212, 191),
                 acc2=(251, 191, 36), bad=(248, 113, 113), good=(45, 212, 191), card=(24, 47, 78),
                 line=(59, 86, 120), dark=True, pattern="glow", fam="square", famt="neo", bgm="pad"),
    "paper": dict(bg=((251, 248, 241), (241, 234, 220)), fg=(30, 41, 59), sub=(100, 116, 139), acc=(13, 148, 136),
                  acc2=(234, 88, 12), bad=(220, 38, 38), good=(13, 148, 136), card=(255, 255, 255),
                  line=(222, 214, 196), dark=False, pattern="grid", fam="square", famt="neo", bgm="lofi"),
    "mint": dict(bg=((240, 253, 250), (204, 251, 241)), fg=(15, 23, 42), sub=(71, 85, 105), acc=(15, 118, 110),
                 acc2=(37, 99, 235), bad=(220, 38, 38), good=(15, 118, 110), card=(255, 255, 255),
                 line=(153, 246, 228), dark=False, pattern="dots", fam="round", famt="round", bgm="pluck"),
    "night": dict(bg=((17, 24, 39), (3, 7, 18)), fg=WHITE, sub=(156, 163, 175), acc=(251, 191, 36),
                  acc2=(45, 212, 191), bad=(248, 113, 113), good=(52, 211, 153), card=(31, 41, 55),
                  line=(55, 65, 81), dark=True, pattern="scan", fam="neo", famt="neo", bgm="news"),
    "sky": dict(bg=((239, 246, 255), (214, 232, 254)), fg=(15, 23, 42), sub=(71, 85, 105), acc=(37, 99, 235),
                acc2=(13, 148, 136), bad=(220, 38, 38), good=(22, 163, 74), card=(255, 255, 255),
                line=(191, 219, 254), dark=False, pattern="dots", fam="square", famt="neo", bgm="pluck"),
    "coral": dict(bg=((255, 247, 237), (255, 226, 210)), fg=(28, 25, 23), sub=(120, 113, 108), acc=(234, 88, 12),
                  acc2=(13, 148, 136), bad=(220, 38, 38), good=(13, 148, 136), card=(255, 255, 255),
                  line=(254, 215, 170), dark=False, pattern="rays", fam="round", famt="round", bgm="bright"),
    "ink": dict(bg=((28, 28, 32), (9, 9, 11)), fg=WHITE, sub=(161, 161, 170), acc=(250, 204, 21),
                acc2=(45, 212, 191), bad=(248, 113, 113), good=(74, 222, 128), card=(39, 39, 42),
                line=(63, 63, 70), dark=True, pattern="none", fam="neo", famt="neo", bgm="lofi"),
    "teal": dict(bg=((15, 118, 110), (17, 78, 74)), fg=WHITE, sub=(204, 251, 241), acc=(254, 240, 138),
                 acc2=(255, 255, 255), bad=(254, 202, 202), good=(254, 240, 138), card=(19, 94, 89),
                 line=(45, 212, 191), dark=True, pattern="dots", fam="human", famt="human", bgm="warm"),
    "chat": dict(bg=((186, 206, 224), (170, 193, 214)), fg=(15, 23, 42), sub=(71, 85, 105), acc=(37, 99, 235),
                 acc2=(13, 148, 136), bad=(220, 38, 38), good=(13, 148, 136), card=(255, 255, 255),
                 line=(148, 163, 184), dark=False, pattern="none", fam="round", famt="round", bgm="lofi"),
    "story": dict(bg=((250, 245, 235), (236, 226, 208)), fg=(41, 37, 36), sub=(120, 113, 108), acc=(180, 83, 9),
                  acc2=(13, 148, 136), bad=(185, 28, 28), good=(13, 148, 136), card=(255, 252, 245),
                  line=(214, 200, 175), dark=False, pattern="paper", fam="serif", famt="serif", bgm="warm"),
}

# ── 글꼴 ────────────────────────────────────────────────
FONT_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts"
FAMILIES = {
    "square": {"H": "NanumSquareEB.ttf", "EB": "NanumSquareEB.ttf", "B": "NanumSquareB.ttf", "R": "NanumSquareR.ttf"},
    "neo": {"H": "NanumSquareNeo-eHv.ttf", "EB": "NanumSquareNeo-dEb.ttf", "B": "NanumSquareNeo-cBd.ttf",
            "R": "NanumSquareNeo-bRg.ttf"},
    "round": {"H": "NanumSquareRoundEB.ttf", "EB": "NanumSquareRoundEB.ttf", "B": "NanumSquareRoundB.ttf",
              "R": "NanumSquareRoundR.ttf"},
    "pen": {"H": "NanumPen.ttf", "EB": "NanumPen.ttf", "B": "NanumBarunpenB.ttf", "R": "NanumBarunpenR.ttf"},
    "serif": {"H": "NanumMyeongjoExtraBold.ttf", "EB": "NanumMyeongjoExtraBold.ttf", "B": "NanumMyeongjoBold.ttf",
              "R": "NanumMyeongjo.ttf"},
    "human": {"H": "NanumHumanHeavy.ttf", "EB": "NanumHumanEB.ttf", "B": "NanumHumanBold.ttf",
              "R": "NanumHumanRegular.ttf"},
}
FSCALE = {"pen": 1.32}
FALLBACK = {"R": Path("C:/Windows/Fonts/malgun.ttf")}


@lru_cache(maxsize=None)
def F(fam, w, size):
    p = FONT_DIR / FAMILIES[fam][w]
    if not p.exists():
        p = FALLBACK.get(w, Path("C:/Windows/Fonts/malgunbd.ttf"))
    return ImageFont.truetype(str(p), max(8, int(size)))


# ── 레이아웃 (세로 / 정사각) ───────────────────────────────
class Lay:
    def __init__(self, mode):
        self.mode = mode
        if mode == "v":
            self.W, self.H = 1080, 1920
            self.x0, self.x1, self.y0, self.y1 = 80, 930, 590, 1390
            self.cap_y, self.cap_size, self.cap_w = 292, 78, 830
            self.sub_y, self.sub_size, self.sub_w = 1446, 44, 800
            self.foot_y, self.foot_size = 1496, 25
            self.chip_y, self.bar_y = 180, 36
            self.k = 1.1
            self.full = (70, 250, 940, 1500)   # 대화·키네틱처럼 화면 전체를 쓰는 포맷
        else:
            self.W, self.H = 1080, 1080
            self.x0, self.x1, self.y0, self.y1 = 70, 1010, 256, 858
            self.cap_y, self.cap_size, self.cap_w = 84, 58, 940
            self.sub_y, self.sub_size, self.sub_w = 912, 36, 900
            self.foot_y, self.foot_size = 1000, 21
            self.chip_y, self.bar_y = 30, 12
            self.k = 0.8
            self.full = (60, 76, 1020, 1000)
        self.cx = (self.x0 + self.x1) / 2
        self.cy = (self.y0 + self.y1) / 2
        self.cw = self.x1 - self.x0
        self.ch = self.y1 - self.y0

    def X(self, u):
        return self.x0 + u * self.cw

    def Y(self, v):
        return self.y0 + v * self.ch


class _G:
    ep = None
    T = THEMES["navy"]
    L = Lay("v")
    scenes = []
    total = 1.0
    num = 0


G = _G()


def u(x):
    return int(round(x * G.L.k))


# ── 수학 유틸 ───────────────────────────────────────────
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def back_out(x, s=1.7):
    x = clamp(x)
    x -= 1
    return 1 + x * x * ((s + 1) * x + s)


def pop(t, t0, d=0.35):
    return ease_out((t - t0) / d) if t >= t0 else 0.0


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


def rgba(c, a=255):
    return tuple(c[:3]) + (int(a),)


def col(key):
    """테마 색 키('acc','bad'...) 또는 RGB 튜플"""
    if isinstance(key, str):
        return G.T[key]
    return key


def clean(s):
    return s.replace("[", "").replace("]", "")


# ── 스프라이트 ──────────────────────────────────────────
def _runs(s):
    out, hl, cur = [], False, ""
    for ch in s:
        if ch in "[]":
            if cur:
                out.append((cur, hl))
            cur, hl = "", ch == "["
        else:
            cur += ch
    if cur:
        out.append((cur, hl))
    return out


@lru_cache(maxsize=1500)
def txt(text, size, w="EB", color=WHITE, hl=None, maxw=0, align="l", fam=None, lh=1.28, hlbg=None, spacing=0):
    """[강조] 표기를 지원하는 텍스트 스프라이트. maxw>0 이면 단어 단위 줄바꿈"""
    fam = fam or G.T["fam"]
    sz = int(size * FSCALE.get(fam, 1.0))
    f = F(fam, w, sz)
    lines = []
    for para in text.split("\n"):
        toks = []
        for s, h in _runs(para):
            for piece in re.split(r"(\s+)", s):
                if piece:
                    toks.append((piece, h))
        if not maxw:
            lines.append(toks)
            continue
        cur, cw = [], 0.0
        for tok in toks:
            tw = f.getlength(tok[0])
            if tok[0].isspace():
                if cur:
                    cur.append(tok)
                    cw += tw
                continue
            if cur and cw + tw > maxw:
                while cur and cur[-1][0].isspace():
                    cur.pop()
                lines.append(cur)
                cur, cw = [], 0.0
            cur.append(tok)
            cw += tw
        while cur and cur[-1][0].isspace():
            cur.pop()
        lines.append(cur)
    asc, desc = f.getmetrics()
    lhp = int(sz * lh)
    widths = [sum(f.getlength(s) for s, _ in ln) for ln in lines]
    pad = 14
    Wd = int(max(widths + [1])) + pad * 2
    Hd = lhp * (len(lines) - 1) + asc + desc + pad * 2
    im = Image.new("RGBA", (Wd, Hd), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        x = pad if align == "l" else (Wd - widths[i]) / 2 if align == "c" else Wd - pad - widths[i]
        y = pad + i * lhp
        for s, h in ln:
            tw = f.getlength(s)
            if h and hlbg and not s.isspace():
                d.rounded_rectangle([x - 6, y + (asc + desc) * 0.42, x + tw + 6, y + asc + desc - 1], 8, fill=hlbg)
            x += tw
        x = pad if align == "l" else (Wd - widths[i]) / 2 if align == "c" else Wd - pad - widths[i]
        for s, h in ln:
            d.text((x, y), s, font=f, fill=rgba(hl if (h and hl) else color))
            x += f.getlength(s)
    return im


@lru_cache(maxsize=64)
def _lut(q):
    return [int(i * q / 50) for i in range(256)]


def fade(im, p):
    if p >= 0.999:
        return im
    q = int(round(clamp(p) * 50))
    out = im.copy()
    out.putalpha(im.getchannel("A").point(_lut(q)))
    return out


def comp(fr, im, X, Y):
    X, Y = int(round(X)), int(round(Y))
    x0, y0 = max(0, X), max(0, Y)
    x1, y1 = min(fr.width, X + im.width), min(fr.height, Y + im.height)
    if x1 <= x0 or y1 <= y0:
        return
    if (x0, y0, x1, y1) != (X, Y, X + im.width, Y + im.height):
        im = im.crop((x0 - X, y0 - Y, x1 - X, y1 - Y))
    fr.alpha_composite(im, (x0, y0))


def put(fr, im, x, y, anchor="mm", p=1.0, dy=0, dx=0, s=1.0, alpha=None):
    """im 을 anchor 기준 (x,y)에 합성. p: 등장 진행도(투명도·슬라이드), s: 배율"""
    if im is None or p <= 0.001:
        return
    if abs(s - 1.0) > 0.004:
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.BILINEAR)
    a = p if alpha is None else alpha
    im = fade(im, a)
    ax = {"l": 0, "m": 0.5, "r": 1}[anchor[0]]
    ay = {"t": 0, "m": 0.5, "b": 1}[anchor[1]]
    comp(fr, im, x + dx * (1 - p) - im.width * ax, y + dy * (1 - p) - im.height * ay)


@lru_cache(maxsize=800)
def box(w, h, r, fill, outline=None, ow=0, shadow=0):
    w, h, r = int(w), int(h), int(r)
    S = 2
    m = int(shadow * 1.6) if shadow else 0
    im = Image.new("RGBA", ((w + 2 * m) * S, (h + 2 * m) * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([m * S, m * S, (m + w) * S - 1, (m + h) * S - 1], r * S, fill=rgba(fill, fill[3] if len(fill) > 3 else 255),
                        outline=rgba(outline) if outline else None, width=ow * S)
    im = im.resize((w + 2 * m, h + 2 * m), Image.LANCZOS)
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([m, m + shadow // 2, m + w, m + h + shadow // 2], r,
                                             fill=(0, 0, 0, 90 if G.T["dark"] else 45))
        sh = sh.filter(ImageFilter.GaussianBlur(max(1, shadow // 2)))
        sh.alpha_composite(im)
        im = sh
    return im


@lru_cache(maxsize=1024)
def disc(r, fill, outline=None, ow=0):
    r = int(r)
    S = 2
    im = Image.new("RGBA", (2 * r * S + 4, 2 * r * S + 4), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([2, 2, 2 + 2 * r * S, 2 + 2 * r * S], fill=rgba(fill, fill[3] if len(fill) > 3 else 255) if fill else None,
                               outline=rgba(outline) if outline else None, width=ow * S)
    return im.resize((im.width // S, im.height // S), Image.LANCZOS)


@lru_cache(maxsize=512)
def ring(r, color, width, frac=1.0):
    r = int(r)
    S = 2
    im = Image.new("RGBA", (2 * r * S + 8, 2 * r * S + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if frac >= 0.999:
        d.ellipse([4, 4, 4 + 2 * r * S, 4 + 2 * r * S], outline=rgba(color), width=width * S)
    elif frac > 0:
        d.arc([4, 4, 4 + 2 * r * S, 4 + 2 * r * S], -90, -90 + 360 * frac, fill=rgba(color), width=width * S)
    return im.resize((im.width // S, im.height // S), Image.LANCZOS)


EXTRA_ICONS = {"home", "store", "heart", "question", "globe", "car", "box", "scale", "user2", "spark", "mail_open", "flag"}


@lru_cache(maxsize=None)
def ico(kind, sz, color=WHITE):
    color = tuple(color[:3])
    if kind not in EXTRA_ICONS:
        return kit2.icon(kind, int(sz), color)
    S = int(sz) * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = color + (255,)
    H = (0, 0, 0, 0)
    q = S / 100

    def R(a, b, c_, e, r=0, fill=c):
        d.rounded_rectangle([a * q, b * q, c_ * q, e * q], int(r * q), fill=fill)

    def P(pts, fill=c):
        d.polygon([(x * q, y * q) for x, y in pts], fill=fill)

    def E(a, b, c_, e, fill=c):
        d.ellipse([a * q, b * q, c_ * q, e * q], fill=fill)

    def Ln(pts, w, fill=c):
        d.line([(x * q, y * q) for x, y in pts], fill=fill, width=int(w * q), joint="curve")

    if kind == "home":
        P([(50, 6), (96, 46), (84, 46), (84, 94), (16, 94), (16, 46), (4, 46)])
        R(40, 60, 60, 94, 3, H)
    elif kind == "store":
        R(8, 8, 92, 30, 4)
        for i in range(4):
            E(8 + i * 21, 20, 29 + i * 21, 42)
        R(14, 40, 86, 94, 4)
        R(24, 52, 46, 94, 2, H)
        R(56, 52, 76, 72, 2, H)
    elif kind == "heart":
        E(6, 12, 52, 58)
        E(48, 12, 94, 58)
        P([(8, 44), (92, 44), (50, 92)])
    elif kind == "question":
        d.text((50 * q, 52 * q), "?", font=F("neo", "H", int(96 * q)), fill=c, anchor="mm")
    elif kind == "globe":
        d.ellipse([6 * q, 6 * q, 94 * q, 94 * q], outline=c, width=int(8 * q))
        d.ellipse([30 * q, 6 * q, 70 * q, 94 * q], outline=c, width=int(7 * q))
        Ln([(8, 50), (92, 50)], 7)
    elif kind == "car":
        P([(16, 44), (28, 20), (72, 20), (84, 44)])
        R(4, 42, 96, 76, 12)
        E(16, 64, 38, 86, H)
        E(62, 64, 84, 86, H)
        E(20, 68, 34, 82)
        E(66, 68, 80, 82)
        P([(32, 26), (68, 26), (76, 42), (24, 42)], H)
    elif kind == "box":
        P([(50, 6), (94, 26), (50, 46), (6, 26)])
        P([(6, 32), (46, 52), (46, 96), (6, 76)])
        P([(94, 32), (54, 52), (54, 96), (94, 76)])
    elif kind == "scale":
        R(46, 10, 54, 88, 3)
        R(22, 86, 78, 96, 4)
        Ln([(12, 24), (88, 24)], 7)
        P([(2, 58), (22, 26), (42, 58)])
        P([(58, 58), (78, 26), (98, 58)])
        R(2, 56, 42, 64, 4)
        R(58, 56, 98, 64, 4)
    elif kind == "user2":
        E(34, 6, 66, 38)
        E(16, 46, 84, 120)
    elif kind == "spark":
        P([(50, 2), (60, 40), (98, 50), (60, 60), (50, 98), (40, 60), (2, 50), (40, 40)])
    elif kind == "mail_open":
        P([(4, 40), (50, 8), (96, 40), (96, 94), (4, 94)])
        R(18, 22, 82, 62, 4, (255, 255, 255, 255) if color != (255, 255, 255) else (200, 200, 200, 255))
        P([(4, 44), (50, 74), (96, 44), (96, 94), (4, 94)])
    elif kind == "flag":
        R(12, 6, 20, 96, 3)
        P([(20, 8), (90, 20), (70, 36), (90, 52), (20, 56)])
    return im.resize((int(sz), int(sz)), Image.LANCZOS)


def lum(c):
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255


def pill(text, bg, fg=WHITE, size=30, w="EB", pad=26, h=None, outline=None, fam=None):
    if tuple(fg[:3]) == WHITE and lum(bg) > 0.62 and (len(bg) < 4 or bg[3] > 200):
        fg = INK   # 밝은 배경 위 흰 글자 대비 보정
    return _pill(text, tuple(bg), tuple(fg), int(size), w, int(pad), h, outline, fam or G.T["fam"])


@lru_cache(maxsize=600)
def _pill(text, bg, fg, size, w, pad, h, outline, fam):
    t = txt(text, size, w, fg, fam=fam)
    hh = int(h or size * 1.9)
    b = box(t.width - 28 + pad * 2, hh, hh // 2, bg, outline, 2 if outline else 0)
    out = b.copy()
    out.alpha_composite(t, ((out.width - t.width) // 2, (out.height - t.height) // 2 + 1))
    return out


# ── 배경 ────────────────────────────────────────────────
@lru_cache(maxsize=6)
def background(mode, theme, variant=0):
    T = THEMES[theme]
    L = Lay(mode)
    Wd, Hd = L.W, L.H
    top, bot = T["bg"]
    if variant:
        top = mix(top, T["acc"], 0.10 if T["dark"] else 0.06)
    yy = np.linspace(0, 1, Hd, dtype=np.float32)[:, None, None]
    arr = np.array(top, np.float32)[None, None, :] * (1 - yy) + np.array(bot, np.float32)[None, None, :] * yy
    arr = np.repeat(arr, Wd, axis=1)
    pat = T["pattern"]
    if pat in ("glow", "scan", "rays") or variant:
        Y, X = np.mgrid[0:Hd, 0:Wd].astype(np.float32)
        cx, cy = Wd * 0.5, Hd * (0.36 if mode == "v" else 0.42)
        r = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) / (Wd * 0.8)
        g = np.clip(1 - r, 0, 1) ** 2
        amt = {"glow": 0.22, "scan": 0.12, "rays": 0.35}.get(pat, 0.12)
        glow_c = np.array(T["acc"] if pat != "rays" else (255, 255, 255), np.float32)
        arr = arr * (1 - g[..., None] * amt) + glow_c[None, None, :] * g[..., None] * amt
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    lc = T["line"]
    if pat == "grid":
        for x in range(0, Wd, 54):
            d.line([(x, 0), (x, Hd)], fill=rgba(lc, 90), width=1)
        for y in range(0, Hd, 54):
            d.line([(0, y), (Wd, y)], fill=rgba(lc, 90), width=1)
    elif pat == "dots":
        for y in range(24, Hd, 44):
            for x in range(24 + (y // 44 % 2) * 22, Wd, 44):
                d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=rgba(lc, 110 if not T["dark"] else 60))
    elif pat == "scan":
        for y in range(0, Hd, 6):
            d.line([(0, y), (Wd, y)], fill=(255, 255, 255, 6), width=1)
    elif pat == "paper":
        rng = np.random.default_rng(7)
        noise = (rng.normal(0, 5, (Hd // 2, Wd // 2))).astype(np.float32)
        n = Image.fromarray(np.clip(128 + noise, 0, 255).astype(np.uint8), "L").resize((Wd, Hd), Image.BILINEAR)
        tint = Image.new("RGBA", (Wd, Hd), (120, 90, 40, 0))
        tint.putalpha(n.point(lambda v: max(0, (v - 122)) * 2))
        img.alpha_composite(tint)
    elif pat == "rays":
        cx, cy = Wd / 2, Hd * (0.36 if mode == "v" else 0.42)
        for k in range(18):
            a0 = k * 20 * math.pi / 180
            a1 = a0 + 8 * math.pi / 180
            R_ = Hd * 1.2
            d.polygon([(cx, cy), (cx + R_ * math.cos(a0), cy + R_ * math.sin(a0)),
                       (cx + R_ * math.cos(a1), cy + R_ * math.sin(a1))], fill=(255, 255, 255, 18))
    return img


def new_frame(variant=0):
    return background(G.L.mode, G.ep["theme"], variant).copy()


# ── 대사·타이밍 ─────────────────────────────────────────
def _chars(s):
    return re.sub(r"[\s\.,!?·…'\"“”‘’()\-~:;/%]", "", s)


class Line:
    def __init__(self, spk, show, tts=None):
        self.spk = spk
        self.show = show              # 화면·자막용 ([강조] 허용)
        self.plain = clean(show)
        self.tts = tts or self.plain  # TTS 입력 (숫자·영문 한글 표기)
        self.t0 = self.t1 = 0.0
        self.words = []               # [(t0, t1, word, hl, c0, c1)] (장면 기준 시각, plain 문자 위치)
        self.env = None               # 프레임별 음량 (인터뷰 파형용)
        self.seg = None

    def build_words(self, tw, trim):
        """tts 단어 경계 → 화면 문구 단어 시각 (문자 비율로 선형 보간)"""
        xs, ts = [0.0], [0.0]
        tot = sum(len(_chars(w)) for _, _, w in tw) or 1
        acc = 0
        for off, dur, w in tw:
            xs.append(acc / tot)
            ts.append(max(0.0, off - trim))
            acc += len(_chars(w))
            xs.append(acc / tot)
            ts.append(max(0.0, off - trim + dur))
        dur_all = len(self.seg) / 1000
        xs.append(1.0000001)
        ts.append(dur_all)
        xs, ts = np.array(xs), np.maximum.accumulate(np.array(ts))
        total_c = len(_chars(self.plain)) or 1
        words, pos, cc = [], 0, 0
        for m in re.finditer(r"\S+", self.show):
            raw = m.group(0)
            wtxt = clean(raw)
            if not wtxt:
                continue
            hl = "[" in raw or "]" in raw or self._in_hl(m.start())
            n = len(_chars(wtxt))
            a = np.interp(cc / total_c, xs, ts)
            b = np.interp((cc + n) / total_c, xs, ts)
            c0 = self.plain.find(wtxt, pos)
            c0 = c0 if c0 >= 0 else pos
            pos = c0 + len(wtxt)
            words.append([float(a), float(b), wtxt, hl, c0, pos])
            cc += n
        self.words = words

    def _in_hl(self, idx):
        depth = 0
        for ch in self.show[:idx]:
            if ch == "[":
                depth = 1
            elif ch == "]":
                depth = 0
        return depth == 1

    def shift(self, t0):
        self.t0 = t0
        self.t1 = t0 + len(self.seg) / 1000
        for w in self.words:
            w[0] += t0
            w[1] += t0


class Scene:
    def __init__(self, idx, spec):
        self.i = idx
        self.d = spec
        self.kind = spec["kind"]
        self.lines = []
        self.pauses = []
        self.start = 0.0
        self.dur = 0.0

    # 장면 기준 시각 도우미
    def cue(self, kw, line=None, lead=0.0):
        rng = [line] if line is not None else range(len(self.lines))
        for li in rng:
            ln = self.lines[li]
            p = ln.plain.find(kw)
            if p >= 0:
                for w in ln.words:
                    if w[4] <= p < w[5] or w[4] >= p:
                        return max(0.0, w[0] - lead)
                return ln.t0
        raise KeyError(f"{G.ep['ep']} 장면{self.i + 1}: 대사에 '{kw}' 없음")

    def lt(self, i):
        return self.lines[i].t0

    def le(self, i):
        return self.lines[i].t1

    def at(self, spec, default=0.2):
        """spec: 숫자(초) | '키워드' | ('L', 줄번호) | ('E', 줄번호)"""
        if spec is None:
            return default
        if isinstance(spec, (int, float)):
            return float(spec)
        if isinstance(spec, tuple):
            return self.lt(spec[1]) if spec[0] == "L" else self.le(spec[1])
        return self.cue(spec)

    def active_line(self, t):
        cur = None
        for ln in self.lines:
            if ln.t0 - 0.05 <= t:
                cur = ln
        return cur


# ── TTS ────────────────────────────────────────────────
def _tts_key(persona, text):
    v, r, p = VOICES[persona]
    return hashlib.sha1(f"{v}|{r}|{p}|{text}".encode("utf-8")).hexdigest()[:20]


async def _tts_fetch(persona, text, sem):
    key = _tts_key(persona, text)
    mp3, js = TTS_CACHE / f"{key}.mp3", TTS_CACHE / f"{key}.json"
    if mp3.exists() and js.exists() and mp3.stat().st_size > 1000:
        return
    import edge_tts
    v, r, p = VOICES[persona]
    async with sem:
        for attempt in range(5):
            try:
                c = edge_tts.Communicate(text, v, rate=r, pitch=p, boundary="WordBoundary")
                audio, words = bytearray(), []
                async for ch in c.stream():
                    if ch["type"] == "audio":
                        audio += ch["data"]
                    elif ch["type"] == "WordBoundary":
                        words.append([ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]])
                if len(audio) < 1000:
                    raise RuntimeError("빈 음성")
                mp3.write_bytes(bytes(audio))
                js.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
                return
            except Exception as e:  # 네트워크 오류 재시도
                if attempt == 4:
                    raise
                print(f"  TTS 재시도 {attempt + 1}: {e}")
                await asyncio.sleep(2 + attempt * 2)


def _load_line_audio(ln, persona):
    key = _tts_key(persona, ln.tts)
    seg = AudioSegment.from_file(TTS_CACHE / f"{key}.mp3").set_frame_rate(SR).set_channels(1)
    tw = json.loads((TTS_CACHE / f"{key}.json").read_text(encoding="utf-8"))
    lead = detect_leading_silence(seg, -45)
    tail = detect_leading_silence(seg.reverse(), -45)
    a = max(0, lead - 15)
    seg = seg[a: max(a + 50, len(seg) - max(0, tail - 60))]
    seg = seg.high_pass_filter(75)
    if seg.dBFS > -80:
        seg = seg.apply_gain(-18.5 - seg.dBFS)   # 화자 간 음량 맞춤
    seg = seg.fade_in(6).fade_out(25)
    ln.seg = seg
    ln.build_words(tw, a / 1000)
    arr = np.array(seg.get_array_of_samples(), dtype=np.float32) / 32768
    hop = SR // FPS
    n = max(1, len(arr) // hop)
    env = np.sqrt(np.mean(arr[: n * hop].reshape(n, hop) ** 2, axis=1)) if len(arr) >= hop else np.zeros(1)
    ln.env = np.clip(env / (env.max() + 1e-6), 0, 1)


# ── BGM 합성 ────────────────────────────────────────────
def _mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _note(freq, dur, kind):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    atk = np.minimum(1, t / 0.006)
    if kind == "epiano":
        y = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 3)
             + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 7)) * np.exp(-t * 1.5)
    elif kind == "pluck":
        y = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 9)) * np.exp(-t * 5.5)
    elif kind == "marimba":
        y = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 4 * freq * t) * np.exp(-t * 22)) * np.exp(-t * 7)
    elif kind == "bass":
        y = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)) * np.exp(-t * 2.2)
    elif kind == "sbass":
        y = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t)) * np.exp(-t * 9)
    elif kind == "pad":
        rel = np.minimum(1, (dur - t) / 0.8)
        y = sum(np.sin(2 * np.pi * (freq + dt) * t) for dt in (-0.7, 0, 0.7)) / 3 * np.minimum(1, t / 0.9) * np.clip(rel, 0, 1)
        atk = 1
    elif kind == "kick":
        f = 45 + 80 * np.exp(-t * 28)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)
    elif kind == "hat":
        rng = np.random.default_rng(int(freq))
        nz = rng.normal(0, 1, n)
        nz = nz - np.convolve(nz, np.ones(6) / 6, mode="same")
        y = nz * np.exp(-t * 55) * 0.5
    else:
        raise ValueError(kind)
    return y * atk


STYLES = {
    # bpm, 진행(MIDI 코드), 악기 패턴
    "lofi": dict(bpm=80, prog=[[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]]),
    "pluck": dict(bpm=100, prog=[[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]]),
    "news": dict(bpm=96, prog=[[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]),
    "bright": dict(bpm=112, prog=[[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]),
    "warm": dict(bpm=70, prog=[[60, 64, 67, 71], [52, 55, 59, 64], [57, 60, 64, 69], [53, 57, 60, 65]]),
}


def synth_bgm(style, seconds):
    if style == "pad":
        seg = base.synth_bgm(seconds)
        a = np.array(seg.set_channels(1).get_array_of_samples(), dtype=np.float32) / 32768
        return a
    S_ = STYLES[style]
    beat = 60 / S_["bpm"]
    bar = beat * 4
    n = int(seconds * SR) + SR * 2
    out = np.zeros(n, np.float32)

    def add(at, y, g):
        i = int(at * SR)
        if i >= n:
            return
        j = min(n, i + len(y))
        out[i:j] += (y[: j - i] * g).astype(np.float32)

    nb = int(seconds / bar) + 2
    for b in range(nb):
        ch = S_["prog"][b % len(S_["prog"])]
        t0 = b * bar
        root = ch[0] - 12
        if style == "lofi":
            for off in (0, beat * 2.5):
                for m in ch:
                    add(t0 + off + 0.012 * ch.index(m), _note(_mtof(m), beat * 2.2, "epiano"), 0.15)
            add(t0, _note(_mtof(root - 12), beat * 2, "bass"), 0.42)
            add(t0 + beat * 2, _note(_mtof(root - 12), beat * 2, "bass"), 0.36)
            for k in (0, 2.5):
                add(t0 + k * beat, _note(0, 0.4, "kick"), 0.32)
            for k in range(8):
                add(t0 + k * beat / 2, _note(100 + k, 0.1, "hat"), 0.05 if k % 2 else 0.03)
        elif style == "pluck":
            seq = [0, 1, 2, 3, 2, 1, 2, 3]
            for k in range(8):
                m = ch[seq[k] % len(ch)] + (12 if k in (3, 7) else 0)
                add(t0 + k * beat / 2, _note(_mtof(m), 0.6, "pluck"), 0.16)
            add(t0, _note(_mtof(root - 12), bar, "bass"), 0.36)
            for k in range(4):
                add(t0 + k * beat + beat / 2, _note(200 + k, 0.08, "hat"), 0.04)
        elif style == "news":
            for m in ch:
                add(t0, _note(_mtof(m), bar + 0.4, "pad"), 0.09)
            for k in range(8):
                add(t0 + k * beat / 2, _note(_mtof(root - 12), beat / 2, "sbass"), 0.30 if k % 2 == 0 else 0.2)
            for k in range(4):
                add(t0 + k * beat, _note(300 + k, 0.06, "hat"), 0.05)
            add(t0, _note(0, 0.4, "kick"), 0.30)
            add(t0 + 2 * beat, _note(0, 0.4, "kick"), 0.24)
        elif style == "bright":
            seq = [0, 2, 1, 2, 0, 2, 1, 2]
            for k in range(8):
                m = ch[seq[k] % len(ch)] + 12
                add(t0 + k * beat / 2, _note(_mtof(m), 0.45, "marimba"), 0.18)
            add(t0, _note(_mtof(root - 12), beat * 2, "bass"), 0.34)
            add(t0 + 2 * beat, _note(_mtof(root - 5), beat * 2, "bass"), 0.3)
            for k in range(4):
                add(t0 + k * beat + beat / 2, _note(400 + k, 0.07, "hat"), 0.045)
        elif style == "warm":
            for m in ch:
                add(t0, _note(_mtof(m), bar + 0.6, "pad"), 0.10)
            for k, m in enumerate([ch[-1] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]):
                add(t0 + k * beat, _note(_mtof(m), beat * 1.8, "epiano"), 0.08)
            add(t0, _note(_mtof(root - 12), bar, "bass"), 0.3)
    out = np.convolve(out, np.ones(5) / 5, mode="same")[: int(seconds * SR)]
    out /= np.max(np.abs(out)) + 1e-9
    t = np.arange(len(out)) / SR
    out *= np.minimum(1, t / 0.6) * np.minimum(1, (seconds - t) / 1.4)
    return out


def _seg_to_np(seg):
    return np.array(seg.set_frame_rate(SR).set_channels(1).get_array_of_samples(), dtype=np.float32) / 32768


# ── 오디오 빌드 ─────────────────────────────────────────
GAP_SAME, GAP_SWITCH, LEAD, TAIL = 0.20, 0.36, 0.22, 0.42


def build_timeline(ep, scenes):
    cast = ep["cast"]
    texts = []
    for sc in scenes:
        for item in sc.d["lines"]:
            if item[0] == "pause":
                continue
            ln = Line(*item)
            sc.lines.append(ln)
            texts.append((cast[ln.spk], ln.tts))
    TTS_CACHE.mkdir(parents=True, exist_ok=True)

    async def fetch_all():
        sem = asyncio.Semaphore(4)
        await asyncio.gather(*[_tts_fetch(p, tx, sem) for p, tx in dict.fromkeys(texts)])
    asyncio.run(fetch_all())

    acc = 0.0
    for sc in scenes:
        t = LEAD if sc.i else 0.12
        li = 0
        prev = None
        for item in sc.d["lines"]:
            if item[0] == "pause":
                sc.pauses.append((t, t + item[1]))
                t += item[1]
                continue
            ln = sc.lines[li]
            _load_line_audio(ln, cast[ln.spk])
            if prev is not None:
                t += GAP_SAME if prev == ln.spk else GAP_SWITCH
            ln.shift(t)
            t = ln.t1
            prev = ln.spk
            li += 1
        dur = max(sc.d.get("min", 0), t + sc.d.get("tail", TAIL))
        sc.dur = round(dur * FPS) / FPS
        sc.start = acc
        acc += sc.dur
    return acc


def build_audio(ep, scenes, total, wav_path, sfx_events):
    n = int(total * SR) + 1
    voice = np.zeros(n, np.float32)
    speak = np.zeros(n, np.float32)
    for sc in scenes:
        for ln in sc.lines:
            a = _seg_to_np(ln.seg)
            i = int((sc.start + ln.t0) * SR)
            j = min(n, i + len(a))
            voice[i:j] += a[: j - i]
            speak[i:j] = 1
    # BGM + 더킹
    style = ep.get("bgm") or THEMES[ep["theme"]]["bgm"]
    music = synth_bgm(style, total)[:n]
    music = np.pad(music, (0, n - len(music)))
    win = int(0.3 * SR)
    cs = np.concatenate([[0.0], np.cumsum(speak, dtype=np.float64)])
    lo = np.clip(np.arange(n) - win // 2, 0, n)
    hi = np.clip(np.arange(n) + win // 2, 0, n)
    duck = ((cs[hi] - cs[lo]) / win).astype(np.float32)
    rms = np.sqrt(np.mean(music ** 2)) + 1e-9
    level = 10 ** (-31 / 20) / rms
    music = music * level * (1 - 0.5 * np.clip(duck, 0, 1))
    out = voice + music
    for at, kind in sfx_events:
        y = _seg_to_np(kit3._sfx(kind)) * (10 ** ((kit3.GAIN[kind] - 3) / 20))
        i = int(max(0, at) * SR)
        j = min(n, i + len(y))
        if j > i:
            out[i:j] += y[: j - i]
    peak = np.max(np.abs(out)) + 1e-9
    if peak > 0.97:
        out *= 0.97 / peak
    pcm = (out * 32767).astype(np.int16)
    st = np.stack([pcm, pcm], axis=1).reshape(-1)
    AudioSegment(st.tobytes(), frame_rate=SR, sample_width=2, channels=2).export(wav_path, format="wav")


# ── 공통 화면 요소 ───────────────────────────────────────
def draw_caption(fr, cap, t, center=False, y=None, color=None):
    if not cap:
        return
    L, T = G.L, G.T
    hlbg = None if T["dark"] else rgba(T["acc"], 60)
    hl = T["acc"] if T["dark"] else T["fg"]
    if not T["dark"]:
        hl = mix(T["acc"], (0, 0, 0), 0.15)
    y = L.cap_y if y is None else y
    lines = cap.split("\n")
    lh = int(L.cap_size * 1.24)
    for k, ln in enumerate(lines):
        im = txt(ln, L.cap_size, "H", color or T["fg"], hl=hl, fam=G.T["famt"], hlbg=hlbg)
        p = ease_out((t - 0.05 - k * 0.08) / 0.38)
        if center:
            put(fr, im, L.W / 2, y + k * lh, "mt", p, dy=26)
        else:
            put(fr, im, L.x0 - 14, y + k * lh, "lt", p, dy=26)


def draw_foot(fr, text, t, t0=0.5):
    if not text:
        return
    L, T = G.L, G.T
    im = txt(text, L.foot_size, "R", T["sub"], maxw=L.cw if L.mode == "v" else 900, align="c", fam="square", lh=1.35)
    put(fr, im, L.cx if L.mode == "v" else L.W / 2, L.foot_y, "mt", pop(t, t0, 0.5))


def _chunks(words, maxw, f):
    chunks, cur, cw = [], [], 0.0
    sp = f.getlength(" ")
    for w in words:
        ww = f.getlength(w[2])
        if cur and cw + sp + ww > maxw:
            chunks.append(cur)
            cur, cw = [], 0.0
        cw += (sp if cur else 0) + ww
        cur.append(w)
    if cur:
        chunks.append(cur)
    return chunks


@lru_cache(maxsize=400)
def _sub_sprite(words_key, spoken, size, hlc, fam):
    f = F(fam, "EB", size)
    words = words_key.split("\u0001")
    sp = f.getlength(" ")
    tw = sum(f.getlength(w) for w in words) + sp * (len(words) - 1)
    asc, desc = f.getmetrics()
    pw, ph = int(tw + 56), int(asc + desc + 30)
    im = box(pw, ph, 18, (8, 12, 24, 190)).copy()
    d = ImageDraw.Draw(im)
    x = 28
    for i, w in enumerate(words):
        d.text((x, 15), w, font=f, fill=rgba(hlc if i < spoken else WHITE, 255 if i < spoken else 235))
        x += f.getlength(w) + sp
    return im


def draw_subs(fr, sc, t):
    """단어 단위 카라오케 자막 (하단 세이프존 위)"""
    L = G.L
    ln = None
    for x in sc.lines:
        if x.t0 - 0.08 <= t <= x.t1 + 0.35:
            ln = x
    if ln is None or not ln.words:
        return
    size = L.sub_size
    f = F("square", "EB", size)
    chunks = _chunks(ln.words, L.sub_w - 60, f)
    cur = chunks[0]
    for ch in chunks:
        if t >= ch[0][0] - 0.05:
            cur = ch
    spoken = sum(1 for w in cur if t >= w[0])
    hlc = (253, 224, 71)
    im = _sub_sprite("\u0001".join(w[2] for w in cur), spoken, size, hlc, "square")
    a = clamp((t - ln.t0 + 0.08) / 0.12) * clamp((ln.t1 + 0.35 - t) / 0.15)
    put(fr, im, L.cx if L.mode == "v" else L.W / 2, L.sub_y, "mm", 1.0, alpha=a)


def draw_chrome(fr, sc, t):
    L, T = G.L, G.T
    d = ImageDraw.Draw(fr)
    n = len(G.scenes)
    x0, x1, gap = 40, L.W - 40, 8
    wseg = (x1 - x0 - gap * (n - 1)) / n
    base_c = rgba(T["fg"], 60)
    fill_c = rgba(T["acc"] if T["dark"] else T["acc"], 255)
    for k in range(n):
        a = x0 + k * (wseg + gap)
        d.rounded_rectangle([a, L.bar_y, a + wseg, L.bar_y + 7], 3, fill=base_c)
        p = 1 if k < sc.i else (clamp(t / sc.dur) if k == sc.i else 0)
        if p > 0:
            d.rounded_rectangle([a, L.bar_y, a + max(7, wseg * p), L.bar_y + 7], 3, fill=fill_c)
    if sc.kind != "end":
        label = f"{G.ep['series']}  #{G.num}"
        bg = rgba(T["acc"], 60) if T["dark"] else rgba(T["fg"], 235)
        fg = T["fg"] if T["dark"] else WHITE
        im = _pill(label, bg, fg, u(27) if L.mode == "v" else 22, "EB", 22, None,
                   rgba(T["acc"], 170) if T["dark"] else None, "square")
        put(fr, im, L.x0 - 14, L.chip_y, "lt")


def draw_transition(fr, sc, t):
    if sc.i == 0 or t > 0.3:
        return fr
    style = G.ep.get("trans", "wipe")
    p = t / 0.3
    L, T = G.L, G.T
    if style == "wipe":
        d = ImageDraw.Draw(fr)
        x = -260 + (L.W + 520) * ease_io(p)
        d.polygon([(x - 160, 0), (x + 100, 0), (x + 160, L.H), (x - 100, L.H)], fill=rgba(T["acc"], int(235 * (1 - p * 0.3))))
    elif style == "flash":
        ov = Image.new("RGBA", fr.size, rgba(WHITE if not T["dark"] else T["acc"], int(150 * (1 - p))))
        fr.alpha_composite(ov)
    elif style == "zoom":
        s = 1 + 0.05 * (1 - ease_out(p))
        w2, h2 = int(L.W / s), int(L.H / s)
        x0, y0 = (L.W - w2) // 2, (L.H - h2) // 2
        fr = fr.crop((x0, y0, x0 + w2, y0 + h2)).resize((L.W, L.H), Image.BILINEAR)
    elif style == "slide":
        off = int(L.W * 0.10 * (1 - ease_out(p)))
        if off > 0:
            bgc = new_frame(sc.d.get("variant", 0))
            bgc.alpha_composite(fr.crop((0, 0, L.W - off, L.H)), (off, 0))
            fr = bgc
    return fr


# ── 엔드카드 ────────────────────────────────────────────
def k_end(fr, sc, t):
    L, T = G.L, G.T
    v = L.mode == "v"
    p = ease_out(t / 0.45)
    size = 250 if v else 150
    tile = base.logo_tile(size)
    ty = 500 if v else 150
    put(fr, tile, L.W / 2, ty, "mm", p, s=0.85 + 0.15 * p)
    put(fr, txt("마이김변", 46 if v else 36, "H", T["fg"], fam="neo"), L.W / 2, ty + size / 2 + (58 if v else 40), "mm", p)
    draw_caption(fr, sc.d.get("cap"), max(0, t - 0.2), center=True, y=(790 if v else 318))
    cp = ease_out((t - 0.7) / 0.4)
    if cp > 0:
        pulse = 1 + 0.025 * math.sin(max(0, t - 1.2) * 5)
        bw, bh = (780, 128) if v else (700, 104)
        cy = (1150 if v else 590) + (1 - cp) * 30
        btn = box(bw, bh, bh // 2, BLUE if not T["dark"] else (59, 130, 246), shadow=12)
        put(fr, btn, L.W / 2, cy, "mm", cp, s=pulse)
        put(fr, txt("프로필 링크 → 익명 채무 체크", 44 if v else 36, "EB", WHITE, fam="square"), L.W / 2, cy, "mm", cp, s=pulse)
        put(fr, txt("mykim.kr/check", 34 if v else 28, "B", T["sub"], fam="square"), L.W / 2, cy + bh / 2 + (48 if v else 38), "mm", cp)
    dy = 1340 if v else 750
    d = ImageDraw.Draw(fr)
    d.line([(140, dy - 26), (L.W - 140, dy - 26)], fill=rgba(T["line"]), width=2)
    im = txt(DISCLAIMER, 29 if v else 24, "R", T["sub"], maxw=800 if v else 860, align="c", fam="square", lh=1.45)
    put(fr, im, L.W / 2, dy, "mt", pop(t, 0.9, 0.5))


# ── 렌더 루프 ───────────────────────────────────────────
KINDS = {"end": k_end}
NO_SUBS = {"chat", "kinetic", "interview", "quiz", "mythfact", "glossary", "end"}
NO_CAP = {"chat", "kinetic", "news", "end"}


def render_frame(sc, t):
    fr = new_frame(sc.d.get("variant", 0))
    KINDS[sc.kind](fr, sc, t)
    if sc.kind not in NO_CAP:
        draw_caption(fr, sc.d.get("cap"), t)
    if sc.kind not in NO_SUBS and not sc.d.get("nosubs"):
        draw_subs(fr, sc, t)
    draw_foot(fr, sc.d.get("foot"), t)
    draw_chrome(fr, sc, t)
    fr = draw_transition(fr, sc, t)
    return fr


def fmt_srt(x):
    ms = int(round(x * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def write_srt(path, scenes):
    out, k = [], 1
    for sc in scenes:
        for ln in sc.lines:
            out += [str(k), f"{fmt_srt(sc.start + ln.t0)} --> {fmt_srt(sc.start + ln.t1)}", ln.plain, ""]
            k += 1
    path.write_text("\n".join(out), encoding="utf-8")


def encode(mode, scenes, wav, out_mp4, thumb, contact, preview=False):
    G.L = Lay(mode)
    L = G.L
    if preview:
        proc = None
    else:
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{L.W}x{L.H}", "-r", str(FPS), "-i", "-",
               "-i", str(wav), "-map", "0:v", "-map", "1:a",
               "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
               "-threads", "4", "-x264-params", "rc-lookahead=20",
               "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
               "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
               "-movflags", "+faststart", "-shortest", str(out_mp4)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, bufsize=0)
    shots = []
    cw = 270 if mode == "v" else 360
    chh = int(cw * L.H / L.W)
    for sc in scenes:
        n = int(round(sc.dur * FPS))
        picks = {int(n * 0.8)} if not preview else {int(n * 0.35), int(n * 0.8)}
        for k in range(n):
            t = k / FPS
            if preview and k not in picks and not (sc.i == 0 and k == int(FPS * 1.2)):
                continue
            img = render_frame(sc, t).convert("RGB")
            if proc:
                proc.stdin.write(img.tobytes())
            if k in picks:
                shots.append(img.resize((cw, chh), Image.LANCZOS))
            if sc.i == 0 and k == min(n - 1, int(FPS * 1.2)):
                img.save(thumb)
    if proc:
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg 인코딩 실패")
    cols = min(len(shots), 7 if mode == "v" else 6)
    rows = math.ceil(len(shots) / cols)
    sheet = Image.new("RGB", (cols * (cw + 10) + 10, rows * (chh + 10) + 10), (30, 30, 30))
    for i, im in enumerate(shots):
        sheet.paste(im, (10 + (i % cols) * (cw + 10), 10 + (i // cols) * (chh + 10)))
    sheet.save(contact)


def sfx_events(scenes):
    ev = []
    for sc in scenes:
        if sc.i > 0:
            ev.append((sc.start - 0.14, "whoosh"))
        fn = SFX.get(sc.kind)
        if fn:
            for t, kind in fn(sc):
                ev.append((sc.start + t, kind))
        for t, kind in sc.d.get("sfx", []):
            ev.append((sc.start + sc.at(t), kind))
    ev.append((scenes[-1].start + 0.35, "ding"))
    return ev


SFX = {}


def run(ep, modes=("v", "s"), preview=False, keep_work=False):
    G.ep = ep
    G.T = THEMES[ep["theme"]]
    G.num = int(ep["ep"][2:])
    out = ROOT / "assets" / "shorts" / ep["ep"]
    work = out / "_work"
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    scenes = [Scene(i, s) for i, s in enumerate(ep["scenes"])]
    G.scenes = scenes
    print(f"[{ep['ep']}] {ep['title']}  ({ep['series']}, 테마 {ep['theme']})")
    total = build_timeline(ep, scenes)
    G.total = total
    print("  장면 길이:", " ".join(f"{s.dur:.1f}" for s in scenes), f"= {total:.1f}s")
    wav = work / "mix.wav"
    build_audio(ep, scenes, total, wav, sfx_events(scenes))
    write_srt(out / f"{ep['ep']}_captions.srt", scenes)
    names = {"v": ("final", "thumb", "contact"), "s": ("square", "square_cover", "square_contact")}
    for mode in modes:
        a, b, c = names[mode]
        suffix = "_preview" if preview else ""
        encode(mode, scenes, wav, out / f"{ep['ep']}_{a}.mp4", out / f"{ep['ep']}_{b}{suffix}.png",
               out / f"{ep['ep']}_{c}{suffix}.png", preview)
        print(f"  {'세로 1080x1920' if mode == 'v' else '정사각 1080x1080'} 완료")
    if not keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return total
