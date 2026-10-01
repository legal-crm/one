"""미리보기 보드: 제작된 소재를 비율별로 한 장에 모은다 (검수·보고용).

사용법: python scripts/kakao-ads/board.py [id,id,...] [--variant=logo|nologo] [--root=검수폴더]
출력: assets/kakao-moment-ads/_preview/board_{ratio}_{variant}.jpg, board_bizboard_{variant}.png
      (--root 를 주면 그 폴더의 소재를 모아 그 폴더/_preview 에 저장)
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "kakao-moment-ads")
PREV = os.path.join(OUT, "_preview")
FONT = "C:/Windows/Fonts/malgunbd.ttf"

RATIOS = {"2x1_1200x600": 360, "1x1_1080x1080": 300, "4x5_1080x1350": 300, "9x16_1080x1920": 250}
TAG = ""  # --tag=A → board_4x5_logo_A.jpg (컨셉별 등 나눠 보기)


def dirs_for(ids):
    out = []
    for d in sorted(glob.glob(os.path.join(OUT, "[0-9][0-9][0-9]_*"))):
        n = int(os.path.basename(d)[:3])
        if not ids or n in ids:
            out.append((n, d))
    return out


def board(ids, variant):
    os.makedirs(PREV, exist_ok=True)
    font = ImageFont.truetype(FONT, 18)
    items = dirs_for(ids)
    cols = 5
    for r, tw in RATIOS.items():
        thumbs = []
        for n, d in items:
            f = os.path.join(d, f"{n:03d}_{r}_{variant}.jpg")
            if os.path.exists(f):
                im = Image.open(f).convert("RGB")
                th = im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS)
                thumbs.append((n, th))
        if not thumbs:
            continue
        th_h = thumbs[0][1].height
        rows = (len(thumbs) + cols - 1) // cols
        gap, lab = 16, 26
        W = cols * tw + (cols + 1) * gap
        H = rows * (th_h + lab) + (rows + 1) * gap
        canvas = Image.new("RGB", (W, H), (232, 235, 239))
        dr = ImageDraw.Draw(canvas)
        for i, (n, th) in enumerate(thumbs):
            x = gap + (i % cols) * (tw + gap)
            y = gap + (i // cols) * (th_h + lab + gap)
            dr.text((x, y), f"#{n:03d}", fill=(40, 44, 52), font=font)
            canvas.paste(th, (x, y + lab))
        path = os.path.join(PREV, f"board_{r.split('_')[0]}_{variant}{TAG}.jpg")
        canvas.save(path, quality=88)
        print(path)
    # 비즈보드: 카카오 박스 배경(#F3F3F3) 위에 합성
    rows = []
    for n, d in items:
        f = os.path.join(d, f"{n:03d}_bizboard_1029x258_{variant}.png")
        if os.path.exists(f):
            rows.append((n, Image.open(f).convert("RGBA")))
    if rows:
        tw = 1029 // 2
        th = 258 // 2
        gap = 14
        W = 2 * tw + 3 * gap
        H = ((len(rows) + 1) // 2) * (th + gap) + gap
        canvas = Image.new("RGB", (W, H), (255, 255, 255))
        for i, (n, im) in enumerate(rows):
            bg = Image.new("RGBA", im.size, (243, 243, 243, 255))
            bg.alpha_composite(im)
            t = bg.resize((tw, th), Image.LANCZOS).convert("RGB")
            x = gap + (i % 2) * (tw + gap)
            y = gap + (i // 2) * (th + gap)
            canvas.paste(t, (x, y))
        path = os.path.join(PREV, f"board_bizboard_{variant}{TAG}.png")
        canvas.save(path)
        print(path)


if __name__ == "__main__":
    ids = []
    variant = "logo"
    for a in sys.argv[1:]:
        if a.startswith("--variant="):
            variant = a.split("=", 1)[1]
        elif a.startswith("--root="):
            OUT = os.path.abspath(a.split("=", 1)[1])
            PREV = os.path.join(OUT, "_preview")
        elif a.startswith("--tag="):
            TAG = "_" + a.split("=", 1)[1]
        else:
            ids = [int(x) for x in a.split(",") if x]
    board(ids, variant)
