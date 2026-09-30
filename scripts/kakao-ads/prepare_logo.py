"""법무법인 명율 로고 준비 스크립트.

원본: 다운로드 폴더의 `부제목 추가 (1).png` (175x140, 투명 여백 포함, 실제 로고 영역 168x26)
- 투명 여백을 잘라낸다.
- 원본 해상도가 작아 광고(가로 1080~1200px)에서 흐려지지 않도록 4배로 키운 뒤
  알파 경계를 선명하게 다듬는다. (브라우저에서 축소 표시되므로 가장자리가 깔끔해진다)
- 어두운 배경용 흰색 단색 버전을 만든다.

고해상도 원본(AI/SVG/PDF 또는 가로 1000px 이상 PNG)을 받으면 SRC만 바꿔 다시 실행하면 된다.
사용법: python scripts/kakao-ads/prepare_logo.py [원본경로]
"""
import os
import sys

from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets", "kakao-moment-ads", "_src", "logo")
DEFAULT_SRC = os.path.join(os.path.expanduser("~"), "Downloads", "부제목 추가 (1).png")
SCALE = 4


def sharpen_alpha(alpha: Image.Image) -> Image.Image:
    """업스케일로 번진 알파 경계를 S자 곡선으로 조여 선명하게 만든다."""
    def curve(v: int) -> int:
        x = v / 255.0
        # 0.5 부근을 가파르게 (가장자리 1~2px만 안티앨리어싱으로 남김)
        k = 6.0
        y = 1 / (1 + pow(2.718281828, -k * (x - 0.5) * 2))
        lo = 1 / (1 + pow(2.718281828, k))
        hi = 1 / (1 + pow(2.718281828, -k))
        return max(0, min(255, round((y - lo) / (hi - lo) * 255)))

    return alpha.point([curve(i) for i in range(256)])


def main(src: str) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.open(src).convert("RGBA")
    bbox = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    trimmed = img.crop(bbox)
    trimmed.save(os.path.join(OUT_DIR, "myungyul_h_original.png"))

    w, h = trimmed.size
    # 색은 LANCZOS, 알파는 BICUBIC 업스케일 후 경계 보정
    rgb = trimmed.convert("RGB").resize((w * SCALE, h * SCALE), Image.LANCZOS)
    alpha = trimmed.getchannel("A").resize((w * SCALE, h * SCALE), Image.BICUBIC)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    alpha = sharpen_alpha(alpha)

    color = rgb.copy()
    color.putalpha(alpha)
    color.save(os.path.join(OUT_DIR, "myungyul_h_color.png"), optimize=True)

    white = Image.new("RGBA", color.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    white.save(os.path.join(OUT_DIR, "myungyul_h_white.png"), optimize=True)

    # 미리보기(밝은/어두운 배경)
    pad = 24
    prev = Image.new("RGB", (color.width + pad * 2, (color.height + pad * 2) * 2), (255, 255, 255))
    dark = Image.new("RGB", (color.width + pad * 2, color.height + pad * 2), (14, 26, 51))
    prev.paste(color, (pad, pad), color)
    dark.paste(white, (pad, pad), white)
    prev.paste(dark, (0, color.height + pad * 2))
    prev.save(os.path.join(OUT_DIR, "_preview.png"))

    print("source", src)
    print("trimmed", trimmed.size, "-> upscaled", color.size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC)
