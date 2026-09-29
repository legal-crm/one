# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 Part 2 (EP11~EP20) 공통 키트
기획: docs/youtube_shorts_plan_part2.md

render_ep01.py 의 규격(1080x1920·30fps·자막·폰 목업·TTS·BGM·ffmpeg 파이프라인)을 그대로 쓰고,
Part 2 편들이 공통으로 쓰는 요소를 모아 둔다.
  - cue(): 내레이션 문장 안의 단어가 발화되는 시점(초)을 음절 비례로 추정 → 모션 싱크
  - icon()/card_img()/paper_img()/stamp_img(): 2배 해상도로 그린 뒤 축소한 안티에일리어싱 그래픽
  - 폰 화면 공통 UI(헤더·태그·버튼·토스트·말풍선·체크 행·4가지 경로 비교표)
  - run(): EP 설정 → base.main() 실행 → upload.txt 작성 → 작업 폴더 정리
"""
import math
import shutil
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_ep01 as base  # noqa: E402
from render_ep01 import (  # noqa: E402,F401
    W, H, K, SW, SH, CAP_X, NAVY, NAVY_D, TEAL, TEAL_L, TEAL_D, BLUE, BLUE_D, WHITE, RED, GREEN,
    SLATE50, SLATE100, SLATE200, SLATE300, SLATE400, SLATE500, SLATE700, SLATE900,
    Scr, font, clamp, ease_out, ease_in_out, lerp, lerp_color, background, zoom, vgradient,
    draw_caption, chip, put_phone, tap, check_icon, lock_icon, avatar, toggle, handset,
    scene5 as ep01_endcard,
)

AMBER = (0xF5, 0x9E, 0x0B)
AMBER_L = (0xFE, 0xF3, 0xC7)
RED_D = (0xB9, 0x1C, 0x1C)
RED_50 = (0xFE, 0xF2, 0xF2)
PURPLE = (0xA7, 0x8B, 0xFA)
CARD = (22, 44, 72)        # 네이비 배경 위 카드
CARD_HL = (22, 62, 92)
RIGHT = 918                # 우측 15% 세이프존 경계
BOTTOM = 1536              # 하단 20% 세이프존 경계

VO = []    # 장면별 내레이션 길이(초) — build_audio 직후 채워짐
DUR = []   # 장면별 길이(초)


# ── 내레이션 싱크 ─────────────────────────────────────────
def _weight(text):
    w = 0.0
    for ch in text:
        if ch == ",":
            w += 2.5
        elif ch in ".?!":
            w += 3.5
        elif ch == " ":
            w += 0.35
        elif ch in "·…'\"~()":
            w += 0.3
        else:
            w += 1.0
    return w


def cue(i, kw, lead=0.0):
    """장면 i 내레이션에서 kw 가 시작되는 시점(장면 내 초). 음절 비례 추정."""
    text = base.SCENES[i]["tts"]
    idx = text.find(kw)
    if idx < 0:
        raise ValueError(f"cue 키워드 없음: {kw!r} in {text!r}")
    if not VO:
        return 0.0
    total = _weight(text.rstrip(".?! "))
    return max(0.0, base.VOICE_OFFSET + _weight(text[:idx]) / total * VO[i] - lead)


def pop(t, t0, d=0.35):
    return ease_out((t - t0) / d) if t >= t0 else 0.0


# ── 레이어 유틸 ─────────────────────────────────────────
def overlay(w=W, h=H):
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return ov, ImageDraw.Draw(ov)


def with_alpha(img, p):
    if p >= 1:
        return img
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: int(v * clamp(p))))
    return img


def comp(frame, layer, p=1.0, xy=(0, 0)):
    """불투명하게 그린 레이어를 p 만큼 페이드해 합성"""
    if p <= 0:
        return
    frame.alpha_composite(with_alpha(layer, p), (int(xy[0]), int(xy[1])))


def place(frame, img, cx, cy, p=1.0, dy=40, s0=1.0, rot=0.0):
    """img 중심을 (cx,cy)에 두고 p 진행도로 페이드·슬라이드·스케일 인"""
    if p <= 0:
        return
    sc = lerp(s0, 1.0, p)
    im = img
    if abs(sc - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    if abs(rot) > 0.05:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    comp(frame, im, p, (cx - im.width / 2, cy - im.height / 2 + (1 - p) * dy))


@lru_cache(maxsize=64)
def radial(w, h, cx, cy, r, color, alpha):
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(1 - dist, 0, 1) ** 2 * alpha
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


@lru_cache(maxsize=16)
def _bg(cx, cy, r, color, alpha):
    f = background().copy().convert("RGBA")
    if alpha:
        f.alpha_composite(radial(W, H, cx, cy, r, color, alpha))
    return f


def new_frame(cx=540, cy=1100, r=700, color=(59, 130, 246), alpha=46):
    return _bg(cx, cy, r, color, alpha).copy()


def zoom_rgba(frame, s, cx=W / 2, cy=H):
    return zoom(frame.convert("RGB"), s, cx, cy).convert("RGBA")


def footnote(frame, lines, t, t0=0.3, y=1438):
    """근거·유의 문구 (하단 20% 세이프존 위)"""
    if isinstance(lines, str):
        lines = [lines]
    ov, d = overlay()
    f = font("R", 26)
    for i, ln in enumerate(lines):
        d.text((CAP_X, y + i * 38), ln, font=f, fill=SLATE400 + (255,))
    comp(frame, ov, pop(t, t0, 0.4))


def text_box(frame, x, y, w, h, title, sub, color, p, tsize=44, ssize=30, sub_col=(240, 253, 250)):
    """모션 그래픽용 강조 박스"""
    if p <= 0:
        return
    ov, d = overlay()
    yy = y + (1 - p) * 30
    d.rounded_rectangle([x, yy, x + w, yy + h], 32, fill=color + (255,))
    if sub:
        d.text((x + 40, yy + h / 2 - 6), title, font=font("EB", tsize), fill=WHITE + (255,), anchor="ls")
        d.text((x + 40, yy + h / 2 + 14), sub, font=font("B", ssize), fill=sub_col + (255,), anchor="lt")
    else:
        d.text((x + 40, yy + h / 2), title, font=font("EB", tsize), fill=WHITE + (255,), anchor="lm")
    comp(frame, ov, p)


# ── 아이콘 (단색, 2배로 그린 뒤 축소) ────────────────────────
@lru_cache(maxsize=None)
def icon(kind, sz, col=WHITE):
    S = sz * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = tuple(col) + (255,)
    c2 = tuple(col) + (150,)
    HOLE = (0, 0, 0, 0)
    u = S / 100

    def R(x0, y0, x1, y1, r=0, fill=c, outline=None, width=0):
        d.rounded_rectangle([x0 * u, y0 * u, x1 * u, y1 * u], int(r * u), fill=fill, outline=outline, width=int(width * u))

    def E(x0, y0, x1, y1, fill=c, outline=None, width=0):
        d.ellipse([x0 * u, y0 * u, x1 * u, y1 * u], fill=fill, outline=outline, width=int(width * u))

    def L(pts, w, fill=c):
        d.line([(x * u, y * u) for x, y in pts], fill=fill, width=int(w * u), joint="curve")
        for x, y in (pts[0], pts[-1]):
            E(x - w / 2, y - w / 2, x + w / 2, y + w / 2, fill=fill)

    def P(pts, fill=c):
        d.polygon([(x * u, y * u) for x, y in pts], fill=fill)

    def T(x, y, s, size, fill=HOLE):
        d.text((x * u, y * u), s, font=font("EB", int(size * u)), fill=fill, anchor="mm")

    if kind == "check":
        L([(16, 52), (40, 76), (86, 26)], 14)
    elif kind == "x":
        L([(22, 22), (78, 78)], 14)
        L([(78, 22), (22, 78)], 14)
    elif kind == "doc":
        R(16, 4, 84, 96, 9)
        P([(60, 3), (85, 3), (85, 28)], HOLE)
        P([(60, 4), (60, 28), (84, 28)], c2)
        for y0, x1 in ((42, 70), (57, 70), (72, 56)):
            R(28, y0, x1, y0 + 6, 3, HOLE)
    elif kind == "shield":
        P([(50, 4), (90, 17), (86, 56), (50, 96), (14, 56), (10, 17)])
        L([(32, 50), (46, 64), (70, 36)], 9, HOLE)
    elif kind == "wallet":
        R(14, 10, 78, 34, 8, c2)
        R(6, 24, 94, 90, 12)
        R(60, 44, 97, 70, 9, HOLE)
        E(68, 51, 80, 63)
    elif kind == "bank":
        P([(50, 4), (96, 30), (4, 30)])
        R(8, 32, 92, 38)
        for x in (15, 36, 57, 78):
            R(x, 42, x + 8, 78, 2)
        R(4, 82, 96, 94, 3)
    elif kind == "calendar":
        R(6, 14, 94, 94, 11)
        R(6, 38, 94, 42, 0, HOLE)
        for r in range(3):
            for cc in range(4):
                R(16 + cc * 19, 48 + r * 15, 28 + cc * 19, 58 + r * 15, 2, HOLE)
        R(24, 4, 34, 24, 5)
        R(66, 4, 76, 24, 5)
    elif kind == "coin":
        E(4, 4, 96, 96)
        E(14, 14, 86, 86, fill=None, outline=HOLE, width=5)
        T(50, 53, "₩", 50)
    elif kind == "person":
        E(31, 6, 69, 44)
        E(12, 52, 88, 132)
    elif kind == "family":
        E(12, 12, 40, 40)
        E(2, 46, 50, 120)
        E(60, 12, 88, 40)
        E(50, 46, 98, 120)
        E(34, 40, 66, 72, HOLE)
        E(28, 70, 72, 118, HOLE)
        E(38, 44, 62, 68)
        E(32, 74, 68, 118)
    elif kind == "gavel":
        g = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.rounded_rectangle([22 * u, 20 * u, 70 * u, 42 * u], int(6 * u), fill=c)
        gd.rounded_rectangle([14 * u, 14 * u, 28 * u, 48 * u], int(5 * u), fill=c)
        gd.rounded_rectangle([64 * u, 14 * u, 78 * u, 48 * u], int(5 * u), fill=c)
        gd.rounded_rectangle([42 * u, 40 * u, 50 * u, 88 * u], int(4 * u), fill=c)
        g = g.rotate(38, resample=Image.BICUBIC, center=(46 * u, 50 * u))
        im.alpha_composite(g, (int(-4 * u), int(-6 * u)))
        R(52, 84, 96, 96, 4)
    elif kind == "id":
        R(4, 16, 96, 84, 10)
        R(12, 28, 42, 72, 6, HOLE)
        E(19, 32, 35, 48)
        E(14, 50, 40, 84)
        R(12, 72, 42, 86, 0, c)
        for y0, x1 in ((34, 86), (48, 86), (62, 72)):
            R(50, y0, x1, y0 + 6, 3, HOLE)
    elif kind == "warn":
        P([(50, 6), (96, 90), (4, 90)])
        R(45, 34, 55, 64, 5, HOLE)
        E(44, 70, 56, 82, HOLE)
    elif kind == "clock":
        E(4, 4, 96, 96)
        E(13, 13, 87, 87, HOLE)
        L([(50, 50), (50, 24)], 8)
        L([(50, 50), (68, 62)], 8)
    elif kind == "search":
        E(6, 6, 68, 68, fill=None, outline=c, width=12)
        L([(60, 60), (90, 90)], 15)
    elif kind == "receipt":
        R(16, 4, 84, 88, 6)
        for i in range(4):
            x = 16 + i * 17
            P([(x, 87), (x + 8.5, 97), (x + 17, 87)])
        for y0, x1 in ((20, 70), (36, 70), (52, 56)):
            R(28, y0, x1, y0 + 6, 3, HOLE)
        R(28, 68, 72, 76, 3, HOLE)
    elif kind == "lock":
        E(26, 4, 74, 56, fill=None, outline=c, width=10)
        R(14, 40, 86, 96, 11)
        E(43, 54, 57, 68, HOLE)
        R(47, 62, 53, 82, 3, HOLE)
    elif kind == "bell":
        E(43, 4, 57, 18)
        R(22, 14, 78, 74, 26)
        R(22, 46, 78, 74)
        R(10, 68, 90, 80, 5)
        E(39, 78, 61, 96)
    elif kind == "phone":
        R(24, 2, 76, 98, 12)
        R(30, 12, 70, 82, 4, HOLE)
        E(45, 86, 55, 94, HOLE)
    elif kind == "bike":
        E(2, 54, 38, 90, fill=None, outline=c, width=7)
        E(62, 54, 98, 90, fill=None, outline=c, width=7)
        L([(20, 72), (42, 46), (66, 46), (80, 72)], 7)
        L([(42, 46), (52, 72), (20, 72)], 7)
        L([(66, 46), (62, 28), (74, 26)], 7)
        R(8, 22, 38, 46, 4)
    elif kind == "chart_down":
        L([(8, 8), (8, 92), (94, 92)], 7)
        L([(18, 26), (38, 40), (56, 36), (80, 72)], 9)
        P([(88, 84), (70, 78), (84, 62)])
    elif kind == "chart_up":
        L([(8, 8), (8, 92), (94, 92)], 7)
        L([(18, 76), (38, 58), (56, 64), (80, 28)], 9)
        P([(88, 16), (84, 38), (68, 24)])
    elif kind == "medical":
        R(8, 8, 92, 92, 20)
        R(41, 22, 59, 78, 4, HOLE)
        R(22, 41, 78, 59, 4, HOLE)
    elif kind == "dice":
        R(8, 8, 92, 92, 20)
        for x, y in ((30, 30), (70, 30), (50, 50), (30, 70), (70, 70)):
            E(x - 8, y - 8, x + 8, y + 8, HOLE)
    elif kind == "eye_off":
        P([(4, 50), (22, 32), (50, 24), (78, 32), (96, 50), (78, 68), (50, 76), (22, 68)])
        E(32, 32, 68, 68, HOLE)
        E(40, 40, 60, 60)
        L([(16, 88), (86, 14)], 18, HOLE)
        L([(18, 84), (84, 18)], 8)
    elif kind == "card":
        R(4, 18, 96, 82, 10)
        R(4, 30, 96, 42, 0, HOLE)
        R(14, 62, 42, 70, 3, HOLE)
    elif kind == "chat":
        R(6, 10, 94, 70, 16)
        P([(22, 68), (18, 92), (44, 68)])
        for x in (30, 50, 70):
            E(x - 6, 34, x + 6, 46, HOLE)
    elif kind == "envelope":
        R(4, 18, 96, 82, 8)
        L([(8, 24), (50, 56), (92, 24)], 6, HOLE)
    elif kind == "briefcase":
        R(32, 8, 68, 34, 7, fill=None, outline=c, width=7)
        R(4, 26, 96, 90, 10)
        R(4, 50, 96, 56, 0, HOLE)
        R(42, 46, 58, 62, 3)
    elif kind == "arrow":
        L([(8, 50), (72, 50)], 13)
        P([(58, 22), (96, 50), (58, 78)])
    elif kind == "split":
        L([(50, 96), (50, 56)], 11)
        L([(50, 58), (18, 22)], 11)
        L([(50, 58), (82, 22)], 11)
        P([(6, 8), (32, 12), (12, 34)])
        P([(94, 8), (68, 12), (88, 34)])
    elif kind == "handshake":
        L([(4, 40), (26, 30), (46, 42), (70, 30), (96, 40)], 10)
        P([(26, 34), (50, 52), (74, 34), (88, 58), (60, 82), (40, 82), (12, 58)])
        for x in (40, 52, 64):
            L([(x, 60), (x + 8, 70)], 4, HOLE)
    elif kind == "hourglass":
        R(14, 4, 86, 14, 4)
        R(14, 86, 86, 96, 4)
        P([(22, 14), (78, 14), (54, 50), (78, 86), (22, 86), (46, 50)])
        P([(34, 22), (66, 22), (50, 44)], HOLE)
    else:
        raise ValueError(kind)
    return im.resize((sz, sz), Image.LANCZOS)


# ── 카드·서류·도장 그래픽 ──────────────────────────────────
@lru_cache(maxsize=None)
def card_img(w, h, title, sub="", icon_kind=None, accent=TEAL, fill=CARD, outline=None, tsize=40, ssize=28,
             tcol=WHITE, scol=SLATE300, radius=30, owidth=3):
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    oc = outline if outline is not None else accent
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], radius * S, fill=fill + (255,),
                        outline=(oc + (255,)) if oc else None, width=owidth * S)
    x = 36
    if icon_kind:
        r = min(h * 0.30, 46)
        cy = h / 2
        d.ellipse([34 * S, (cy - r) * S, (34 + 2 * r) * S, (cy + r) * S], fill=accent + (255,))
        ic = icon(icon_kind, int(r * 1.05 * S), WHITE)
        im.alpha_composite(ic, (int((34 + r) * S - ic.width / 2), int(cy * S - ic.height / 2)))
        x = 34 + 2 * r + 26
    if sub:
        d.text((x * S, (h / 2 - 6) * S), title, font=font("EB", tsize * S), fill=tcol, anchor="ls")
        d.text((x * S, (h / 2 + 10) * S), sub, font=font("B", ssize * S), fill=scol, anchor="lt")
    else:
        d.text((x * S, h / 2 * S), title, font=font("EB", tsize * S), fill=tcol, anchor="lm")
    return im.resize((w, h), Image.LANCZOS)


@lru_cache(maxsize=None)
def vcard_img(w, h, title, sub="", icon_kind=None, accent=TEAL, fill=CARD, outline=None, tsize=40, ssize=27,
              sub2="", owidth=3):
    """세로형 카드: 위 아이콘 원 · 아래 제목/설명(최대 2줄)"""
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    oc = outline if outline is not None else accent
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 32 * S, fill=fill + (255,),
                        outline=(oc + (255,)) if oc else None, width=owidth * S)
    y = 34
    if icon_kind:
        r = 50
        d.ellipse([(w / 2 - r) * S, y * S, (w / 2 + r) * S, (y + 2 * r) * S], fill=accent + (255,))
        ic = icon(icon_kind, int(r * 1.1 * S), WHITE)
        im.alpha_composite(ic, (int(w / 2 * S - ic.width / 2), int((y + r) * S - ic.height / 2)))
        y += 2 * r + 30
    d.text((w / 2 * S, (y + tsize / 2) * S), title, font=font("EB", tsize * S), fill=WHITE, anchor="mm")
    y += tsize + 18
    for ln in (sub, sub2):
        if ln:
            d.text((w / 2 * S, (y + ssize / 2) * S), ln, font=font("B", ssize * S), fill=SLATE300, anchor="mm")
            y += ssize + 12
    return im.resize((w, h), Image.LANCZOS)


def draw_line_progress(frame, pts, p, color, width=8):
    """폴리라인을 p(0~1) 만큼 그려 나감"""
    if p <= 0:
        return
    segs = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(segs)
    left = total * clamp(p)
    out = [pts[0]]
    for (a, b), ln in zip(zip(pts, pts[1:]), segs):
        if left >= ln:
            out.append(b)
            left -= ln
        else:
            f = left / ln if ln else 0
            out.append((lerp(a[0], b[0], f), lerp(a[1], b[1], f)))
            break
    S = 2
    ov = Image.new("RGBA", (W // S * S, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.line(out, fill=color + (255,), width=width, joint="curve")
    for x, y in (out[0], out[-1]):
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=color + (255,))
    frame.alpha_composite(ov)


@lru_cache(maxsize=None)
def paper_img(w, h, title, rows, accent=NAVY, note=None):
    """흰 종이 서류. rows: ((라벨, 값), ...) · 값이 None 이면 회색 자리표시 줄"""
    S, m = 2, 40
    im = Image.new("RGBA", ((w + m * 2) * S, (h + m * 2) * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([(m + 8) * S, (m + 22) * S, (m + w - 8) * S, (m + h + 12) * S], 18 * S,
                                         fill=(0, 0, 0, 140))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18 * S)))
    d = ImageDraw.Draw(im)
    X0, Y0 = m * S, m * S
    d.rounded_rectangle([X0, Y0, X0 + w * S, Y0 + h * S], 16 * S, fill=(250, 250, 247, 255))
    d.rectangle([X0, Y0 + 16 * S, X0 + w * S, Y0 + 22 * S], fill=accent + (255,))
    d.text((X0 + w * S / 2, Y0 + 84 * S), title, font=font("EB", 44 * S), fill=SLATE900, anchor="mm")
    if note:
        f = font("B", 20 * S)
        tw = d.textlength(note, font=f)
        d.rounded_rectangle([X0 + w * S - tw - 44 * S, Y0 + 36 * S, X0 + w * S - 18 * S, Y0 + 66 * S], 10 * S,
                            fill=SLATE100 + (255,))
        d.text((X0 + w * S - 31 * S - tw / 2, Y0 + 51 * S), note, font=f, fill=SLATE500, anchor="mm")
    d.line([(X0 + 36 * S, Y0 + 128 * S), (X0 + (w - 36) * S, Y0 + 128 * S)], fill=SLATE300, width=3 * S)
    y = 160
    for lab, val in rows:
        if lab is None:
            d.rounded_rectangle([X0 + 40 * S, Y0 + y * S, X0 + (w - 120) * S, Y0 + (y + 14) * S], 7 * S,
                                fill=SLATE200 + (255,))
            y += 40
            continue
        d.text((X0 + 40 * S, Y0 + (y + 16) * S), lab, font=font("B", 28 * S), fill=SLATE500, anchor="lm")
        if val:
            d.text((X0 + (w - 40) * S, Y0 + (y + 16) * S), val, font=font("EB", 30 * S), fill=SLATE900, anchor="rm")
        d.line([(X0 + 40 * S, Y0 + (y + 44) * S), (X0 + (w - 40) * S, Y0 + (y + 44) * S)], fill=SLATE200, width=2 * S)
        y += 66
    return im.resize((w + m * 2, h + m * 2), Image.LANCZOS)


@lru_cache(maxsize=None)
def stamp_img(text, color=RED, w=300, h=120, rot=-10, size=56, circle=False):
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = color + (255,)
    if circle:
        d.ellipse([6 * S, 6 * S, (w - 6) * S, (h - 6) * S], outline=c, width=10 * S)
        d.ellipse([24 * S, 24 * S, (w - 24) * S, (h - 24) * S], outline=c, width=3 * S)
    else:
        d.rounded_rectangle([6 * S, 6 * S, (w - 6) * S, (h - 6) * S], 16 * S, outline=c, width=9 * S)
        d.rounded_rectangle([20 * S, 20 * S, (w - 20) * S, (h - 20) * S], 10 * S, outline=c, width=3 * S)
    f = font("EB", size * S)
    while d.textlength(text, font=f) > (w - 64) * S and size > 20:
        size -= 2
        f = font("EB", size * S)
    d.text((w * S / 2, h * S / 2), text, font=f, fill=c, anchor="mm")
    # 잉크 번짐 느낌의 미세 결
    rng = np.random.default_rng(7)
    a = np.array(im.getchannel("A"), dtype=np.float32)
    a *= 0.82 + 0.18 * rng.random(a.shape)
    im.putalpha(Image.fromarray(a.astype(np.uint8), "L"))
    im = im.resize((w, h), Image.LANCZOS)
    return with_alpha(im.rotate(rot, resample=Image.BICUBIC, expand=True), 0.94)


def stamp_in(frame, img, cx, cy, t, t0, d=0.22):
    """쾅 찍히는 도장 (크게 → 정위치, 살짝 흔들림)"""
    p = pop(t, t0, d)
    if p <= 0:
        return
    sc = 1.7 - 0.7 * p
    im = img.resize((int(img.width * sc), int(img.height * sc)), Image.LANCZOS)
    comp(frame, im, p, (cx - im.width / 2, cy - im.height / 2))


def shake_xy(t, t0, amp=12, dur=0.3):
    k = t - t0
    if not 0 <= k < dur:
        return 0, 0
    f = 1 - k / dur
    return math.sin(k * 90) * amp * f, math.cos(k * 70) * amp * 0.5 * f


@lru_cache(maxsize=None)
def soft_shadow(w, h, r=30, blur=26, a=150):
    m = blur * 2
    im = Image.new("RGBA", (w + m * 2, h + m * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([m, m + 16, m + w, m + h + 16], r, fill=(0, 0, 0, a))
    return im.filter(ImageFilter.GaussianBlur(blur)), m


# ── 폰 화면 공통 UI (Scr 좌표 1x) ────────────────────────────
def s_icon(s: Scr, kind, cx, cy, sz, col, p=1.0):
    ic = icon(kind, max(2, int(sz * K)), col)
    if p < 1:
        ic = with_alpha(ic, p)
    s.img.paste(ic, (int(cx * K - ic.width / 2), int(cy * K - ic.height / 2)), ic)


def s_header(s: Scr, title, back=True, dark=False):
    s.status(dark)
    col = WHITE if dark else SLATE900
    if back:
        s.line([(48, 112), (34, 126), (48, 140)], col, 5)
    s.text(SW / 2, 126, title, 32, col, "EB", "mm")


def s_tag(s: Scr, x, y, text, bg, fg, size=20, h=38, anchor="l"):
    tw = s.tlen(text, size, "EB")
    if anchor == "r":
        x -= tw + 28
    s.rr(x, y, x + tw + 28, y + h, h / 2, fill=bg)
    s.text(x + 14, y + h / 2, text, size, fg, "EB", "lm")
    return tw + 28


def s_button(s: Scr, y, label, state="on", h=96, col=BLUE):
    fill = {"off": SLATE300, "on": col, "pressed": BLUE_D if col == BLUE else lerp_color(col, SLATE900, 0.25)}[state]
    s.rr(28, y, SW - 28, y + h, 26, fill=fill)
    s.text(SW / 2, y + h / 2, label, 32, WHITE, "EB", "mm")


def s_toast(s: Scr, t, t0, title, sub, color=TEAL, kind="check", y_to=70):
    if t < t0:
        return
    p = ease_out((t - t0) / 0.35)
    y = lerp(-120, y_to, p)
    s.rr(24, y, SW - 24, y + 100, 28, fill=SLATE900)
    s.circ(82, y + 50, 26, fill=color)
    s_icon(s, kind, 82, y + 51, 30, WHITE)
    s.text(126, y + 32, title, 25, WHITE, "EB", "lm")
    s.text(126, y + 70, sub, 19, SLATE300, "B", "lm")


def s_check_row(s: Scr, y, label, sub, p, h=104, bg=SLATE50, accent=TEAL):
    """체크박스 행. p: 체크 진행도(0~1)"""
    s.rr(28, y, SW - 28, y + h, 24, fill=lerp_color(WHITE, (240, 253, 250), p),
         outline=lerp_color(SLATE200, accent, p), width=3 if p > 0.5 else 2)
    bx, by = 58, y + h / 2 - 20
    s.rr(bx, by, bx + 40, by + 40, 10, fill=lerp_color(WHITE, accent, p), outline=lerp_color(SLATE300, accent, p), width=3)
    if p > 0.3:
        check_icon(s, bx + 20, by + 21, 22, WHITE, 4)
    if sub:
        s.text(124, y + h / 2 - 16, label, 26, SLATE900, "EB", "lm")
        s.text(124, y + h / 2 + 20, sub, 19, SLATE500, "B", "lm")
    else:
        s.text(124, y + h / 2, label, 26, SLATE900, "EB", "lm")


def s_bubble(s: Scr, side, lines, y, p, bgc=SLATE100, name=None):
    """말풍선. side='me'|'them'. 반환: 차지한 높이"""
    fsz, lh = 23, 34
    tw = max(s.tlen(ln, fsz, "B") for ln in lines)
    bw, bh = tw + 44, len(lines) * lh + 28
    top = 30 if (name and side == "them") else 0
    if p <= 0:
        return bh + top + 22
    yy = y + (1 - p) * 24
    if side == "me":
        x1 = SW - 28
        x0 = x1 - bw
        fill, fg = lerp_color(bgc, BLUE, p), lerp_color(bgc, WHITE, p)
    else:
        x0 = 100
        x1 = x0 + bw
        fill, fg = lerp_color(bgc, WHITE, p), lerp_color(bgc, SLATE900, p)
        if p > 0.4:
            avatar(s, 58, yy + top + 26, 26, (204, 251, 241), (45, 212, 191))
        if name:
            s.text(x0 + 4, yy + 12, name, 18, lerp_color(bgc, SLATE500, p), "B", "lm")
    s.rr(x0, yy + top, x1, yy + top + bh, 22, fill=fill)
    for i, ln in enumerate(lines):
        s.text(x0 + 22, yy + top + 14 + lh * i + lh / 2, ln, fsz, fg, "B", "lm")
    return bh + top + 22


PATHS4 = (
    ("개인회생", "소득으로 일부 변제 · 나머지 면책 검토", TEAL, "calendar"),
    ("개인파산", "변제 능력이 없을 때 면책 검토", BLUE, "doc"),
    ("신용회복", "신용회복위원회 채무조정", PURPLE, "handshake"),
    ("채무자대리", "변호사가 추심 연락을 대신 응대", AMBER, "phone"),
)


def screen_paths(t, hl=0, hl_at=2.0, hl_tag="내 상황에 맞을 수도", sub="익명 체크 결과", rows=PATHS4,
                 pop0=0.25, note=None, note_at=None):
    s = Scr(SLATE50)
    s_header(s, "해결 경로 비교")
    s.text(36, 206, "4가지 경로", 40, SLATE900, "EB", "lm")
    s.text(36, 252, sub, 21, SLATE500, "B", "lm")
    on = t >= hl_at
    for i, (name, desc, col, ic) in enumerate(rows):
        p = pop(t, pop0 + i * 0.22, 0.35)
        if p <= 0:
            continue
        y = 300 + i * 150 + (1 - p) * 30
        is_hl = on and i == hl
        dim = on and i != hl
        bg = lerp_color(SLATE50, WHITE, p)
        s.rr(28, y, SW - 28, y + 130, 28, fill=(240, 253, 250) if is_hl else bg,
             outline=col if is_hl else lerp_color(SLATE50, SLATE200, p), width=4 if is_hl else 2)
        ccol = lerp_color(col, SLATE300, 0.6) if dim else col
        s.circ(92, y + 65, 38, fill=lerp_color(bg, ccol, p))
        s_icon(s, ic, 92, y + 65, 40, WHITE, p)
        tc = SLATE400 if dim else SLATE900
        s.text(150, y + 46, name, 30, lerp_color(bg, tc, p), "EB", "lm")
        s.text(150, y + 88, desc, 19, lerp_color(bg, SLATE400 if dim else SLATE500, p), "B", "lm")
        if is_hl:
            hp = pop(t, hl_at, 0.3)
            tw = s.tlen(hl_tag, 18, "EB") + 28
            s.rr(SW - 44 - tw, y - 16 + (1 - hp) * 10, SW - 44, y + 20 + (1 - hp) * 10, 18, fill=col)
            s.text(SW - 44 - tw / 2, y + 2 + (1 - hp) * 10, hl_tag, 18, WHITE, "EB", "mm")
    if note and note_at is not None and t >= note_at:
        p = pop(t, note_at, 0.4)
        y = 920 + (1 - p) * 30
        s.rr(28, y, SW - 28, y + 120, 28, fill=lerp_color(SLATE50, SLATE900, p))
        s_icon(s, "shield", 80, y + 60, 44, lerp_color(SLATE900, TEAL_L, p))
        s.text(124, y + 42, note[0], 24, lerp_color(SLATE900, WHITE, p), "EB", "lm")
        s.text(124, y + 80, note[1], 19, lerp_color(SLATE900, SLATE300, p), "B", "lm")
    return s.final()


# ── 실행 ────────────────────────────────────────────────
UPLOAD_TMPL = """[제목]
{title}

[설명란]
{desc}

관련 기능: {feature}

마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 법률사무소가 수행합니다. 인가·면책은 법원이 판단합니다.

{tags}

[고정 댓글]
{comment}

[채널 링크(프로필 고정)]
https://mykim.kr/check?utm_source=youtube&utm_medium=shorts&utm_campaign=s{num}

[관련 콘텐츠]
{related}

[업로드 설정]
- 자막: {ep}_captions.srt 업로드 (한국어)
- 변경되거나 합성된 콘텐츠: 해당 없음 (일러스트·UI 목업, 실존 인물 없음). 내레이션은 TTS 음성
- 게시: {slot}
"""


def write_upload(ep, meta):
    num = int(ep[2:])
    txt = UPLOAD_TMPL.format(ep=ep, num=num, **meta)
    (base.OUT / "upload.txt").write_text(txt, encoding="utf-8")


def run(ep, scenes, renderers, meta=None, keep_work=False):
    base.EP = ep
    base.OUT = base.ROOT / "assets" / "shorts" / ep
    base.TMP = base.OUT / "_work"
    base.SCENES = scenes
    base.RENDERERS = renderers
    orig = base.build_audio

    def patched():
        r = orig()
        DUR[:] = r[0]
        VO[:] = r[2]
        print("  내레이션 길이:", [f"{v:.2f}" for v in VO])
        return r

    base.build_audio = patched
    try:
        base.main()
    finally:
        base.build_audio = orig
    if meta:
        write_upload(ep, meta)
    if not keep_work:
        shutil.rmtree(base.TMP, ignore_errors=True)


# ── 변호사 프로필 목록 (필터 칩 → 걸러짐 → 선택) ─────────────────
def screen_profiles(t, cards, hl_tag, filt_at, sel_i, sel_at, title="변호사 선택",
                    sub="프로필을 보고 직접 고르세요", filt_label=None):
    """cards: ((이름, 경험, (태그...), 아바타bg, 아바타fg), ...). hl_tag 가 있는 카드만 남는다.
    반환: (화면, 선택 버튼 좌표)"""
    s = Scr(SLATE50)
    s_header(s, title)
    s.text(36, 196, sub, 24, SLATE500, "B", "lm")
    fp = pop(t, filt_at, 0.5)
    chip_x = 36
    for lab, active in (("전체", fp < 0.5), (filt_label or hl_tag, fp >= 0.5)):
        tw = s.tlen(lab, 21, "EB") + 36
        s.rr(chip_x, 232, chip_x + tw, 280, 24, fill=SLATE900 if active else WHITE,
             outline=None if active else SLATE300, width=2)
        s.text(chip_x + tw / 2, 256, lab, 21, WHITE if active else SLATE700, "EB", "mm")
        chip_x += tw + 12
    top, ch, gap = 312, 176, 18
    match_idx = [i for i, c in enumerate(cards) if hl_tag in c[2]]
    tap_pos = (SW / 2, 700)
    order = [i for i in range(len(cards)) if i not in match_idx] + match_idx
    for i in order:
        name, exp, tags, bg, fg = cards[i]
        match = i in match_idx
        y0 = top + i * (ch + gap)
        if match:
            y1 = top + match_idx.index(i) * (ch + gap)
            y = lerp(y0, y1, ease_in_out(fp))
            q = 1.0
            dx = 0
        else:
            y = y0
            q = 1 - fp
            dx = 60 * fp
            if q <= 0.02:
                continue
        if y > SH:
            continue
        selected = match and i == sel_i and t >= sel_at
        fill = lerp_color(SLATE50, WHITE, q)
        s.rr(28 + dx, y, SW - 28 + dx, y + ch, 28, fill=fill,
             outline=TEAL if selected else lerp_color(SLATE50, SLATE200, q), width=4 if selected else 2)
        if q > 0.5:
            avatar(s, 96 + dx, y + 66, 40, bg, fg)
        s.text(158 + dx, y + 44, name, 28, lerp_color(SLATE50, SLATE900, q), "EB", "lm")
        s.text(158 + dx, y + 84, exp, 20, lerp_color(SLATE50, SLATE500, q), "B", "lm")
        tx = 56 + dx
        for tg in tags:
            on = tg == hl_tag and fp > 0.3
            tw = s.tlen(tg, 18, "EB")
            s.rr(tx, y + 120, tx + tw + 26, y + 156, 14,
                 fill=TEAL_L if on else lerp_color(SLATE50, SLATE100, q))
            s.text(tx + 13, y + 138, tg, 18, TEAL_D if on else lerp_color(SLATE50, SLATE700, q), "EB", "lm")
            tx += tw + 36
        bx0, bx1 = SW - 160, SW - 52
        by = y + 30
        if selected:
            s.rr(bx0 + dx, by, bx1 + dx, by + 46, 16, fill=TEAL)
            s.text((bx0 + bx1) / 2 + dx, by + 23, "선택됨", 20, WHITE, "EB", "mm")
        else:
            s.rr(bx0 + dx, by, bx1 + dx, by + 46, 16, outline=lerp_color(SLATE50, BLUE, q), width=3)
            s.text((bx0 + bx1) / 2 + dx, by + 23, "선택", 20, lerp_color(SLATE50, BLUE, q), "EB", "mm")
        if match and i == sel_i:
            tap_pos = ((bx0 + bx1) / 2, by + 23)
    return s.final(), tap_pos


LAWYERS = (
    ("변호사 A", "개인회생 사건 경험", ("서울", "상담방 답변"), (219, 234, 254), (96, 165, 250)),
    ("변호사 B", "개인회생·파산 사건 경험", ("경기", "야간 상담"), (204, 251, 241), (45, 212, 191)),
    ("변호사 C", "채무조정 사건 경험", ("부산", "상담방 답변"), (237, 233, 254), (167, 139, 250)),
    ("변호사 D", "개인회생 사건 경험", ("인천", "주말 상담"), (254, 243, 199), (251, 191, 36)),
)


def lawyers_with(tag, idx):
    """예시 변호사 목록 중 idx 에 해당하는 카드에 tag 추가"""
    out = []
    for i, (n, e, tags, bg, fg) in enumerate(LAWYERS):
        out.append((n, e, (tags[0], tag) if i in idx else tags, bg, fg))
    return tuple(out)


# ── 손 일러스트 (실존 인물 아님) ─────────────────────────────
SKIN = (226, 190, 158)
SKIN_D = (196, 156, 124)


def thumb(d, x, y, w=70, h=120, rot_left=True):
    """물건 가장자리를 쥔 엄지 + 뒤쪽 손가락 그림자 (frame 좌표 직접 그림)"""
    d.rounded_rectangle([x - w * 0.9, y + h * 0.35, x + w * 0.9, y + h * 1.6], int(w * 0.6), fill=SKIN_D + (255,))
    d.rounded_rectangle([x - w / 2, y, x + w / 2, y + h], int(w / 2), fill=SKIN + (255,))
    d.rounded_rectangle([x - w * 0.32, y + 10, x + w * 0.32, y + h * 0.36], int(w * 0.3), fill=(236, 206, 180, 255))
