"""카카오모먼트 광고 제작 소스 준비 스크립트 (1회 실행용).

- Fluent UI Emoji (MIT) 아이콘: Color SVG + 3D PNG
- Spoqa Han Sans Neo (OFL): 비즈보드 고정 폰트
- Pretendard (OFL): 본문/헤드라인 폰트 (프로젝트 내 파일 복사)
- 광고주 로고(법무법인 명율)는 prepare_logo.py 에서 따로 준비한다.

사용법: python scripts/kakao-ads/fetch_assets.py
"""
import os
import shutil
import sys
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "assets", "kakao-moment-ads", "_src")
ICON_COLOR = os.path.join(SRC, "icons", "color")
ICON_3D = os.path.join(SRC, "icons", "3d")
FONTS = os.path.join(SRC, "fonts")
LOGO = os.path.join(SRC, "logo")

FLUENT_BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/"

# 광고 비주얼 후보 (폴더명 그대로)
ICONS = [
    # 법·제도
    "Balance scale", "Classical building", "Scroll", "Page facing up", "Page with curl", "Memo",
    "Clipboard", "Ledger", "Books", "Open book",
    # 밤·시간
    "Crescent moon", "Waning crescent moon", "Bed", "Alarm clock", "Mantelpiece clock",
    "Hourglass not done", "Hourglass done", "Stopwatch", "Tear-off calendar", "Spiral calendar", "Calendar",
    # 독촉·보호
    "Bell with slash", "Mobile phone off", "No mobile phones", "Stop sign", "No entry",
    "Envelope with arrow", "Incoming envelope", "Envelope", "Shield", "Locked", "Unlocked", "Key",
    "Broken chain", "Chains", "Umbrella",
    # 돈
    "Money with wings", "Money bag", "Coin", "Credit card", "Receipt", "Abacus", "Input numbers",
    # 대상
    "Briefcase", "Convenience store", "Graduation cap", "Backpack", "Motor scooter", "Laptop",
    "Military helmet", "Chart decreasing", "Chart increasing", "Bar chart", "House", "House with garden",
    "Houses", "Delivery truck", "Oncoming taxi", "Office building", "Bank", "Toolbox", "Cooking", "Package",
    # 정보
    "Light bulb", "Magnifying glass tilted right", "Bullseye", "Puzzle piece", "Round pushpin",
    # 희망
    "Sunrise", "Sunrise over mountains", "Seedling", "Herb", "Four leaf clover", "Sun behind small cloud",
    "Rainbow", "Dove", "Sunflower", "Tulip", "Hot beverage", "Couch and lamp", "Teacup without handle",
    # 표정
    "Pensive face", "Worried face", "Weary face", "Anxious face with sweat", "Relieved face", "Face exhaling",
    "Sleeping face", "Smiling face with tear", "Thinking face", "Slightly smiling face",
    # 사람·손 (피부톤 폴더 구조)
    "Handshake", "Folded hands", "Raised hand", "Open hands", "Palm up hand", "Writing hand",
    "Person in bed", "Older person", "Man office worker", "Woman office worker", "Office worker",
    "Cook", "Construction worker", "Farmer", "Person raising hand", "Person walking",
]


def slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def fetch(url: str, dest: str) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "kiro-agent"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(dest, "wb") as f:
            f.write(data)
        return True
    except Exception:
        return False


def fluent_urls(name: str, kind: str):
    """kind: 'Color' | '3D'. 피부톤 없는 경로 → Light → Default 순서로 시도."""
    s = slug(name)
    q = urllib.parse.quote
    if kind == "Color":
        yield f"{FLUENT_BASE}{q(name)}/Color/{s}_color.svg"
        yield f"{FLUENT_BASE}{q(name)}/Light/Color/{s}_color_light.svg"
        yield f"{FLUENT_BASE}{q(name)}/Default/Color/{s}_color_default.svg"
    else:
        yield f"{FLUENT_BASE}{q(name)}/3D/{s}_3d.png"
        yield f"{FLUENT_BASE}{q(name)}/Light/3D/{s}_3d_light.png"
        yield f"{FLUENT_BASE}{q(name)}/Default/3D/{s}_3d_default.png"


def fetch_icons():
    miss = []
    for name in ICONS:
        s = slug(name)
        for kind, folder, ext in (("Color", ICON_COLOR, "svg"), ("3D", ICON_3D, "png")):
            dest = os.path.join(folder, f"{s}.{ext}")
            if os.path.exists(dest) and os.path.getsize(dest) > 0:
                continue
            if not any(fetch(u, dest) for u in fluent_urls(name, kind)):
                miss.append(f"{kind}:{name}")
    fetch("https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE", os.path.join(SRC, "icons", "LICENSE-fluentui-emoji.txt"))
    print(f"icons: {len(ICONS)} names, missing {len(miss)}")
    for m in miss:
        print("  missing", m)


def fetch_fonts():
    base = "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@latest/Subset/SpoqaHanSansNeo/"
    for w in ("Bold", "Regular"):
        dest = os.path.join(FONTS, f"SpoqaHanSansNeo-{w}.woff2")
        if not os.path.exists(dest):
            ok = fetch(base + f"SpoqaHanSansNeo-{w}.woff2", dest)
            print("font", w, "ok" if ok else "FAIL")
    fetch("https://raw.githubusercontent.com/spoqa/spoqa-han-sans/master/LICENSE", os.path.join(FONTS, "LICENSE-SpoqaHanSans.txt"))
    pret_src = os.path.join(ROOT, "assets", "cardnews", "_fonts", "PretendardVariable.woff2")
    pret_dst = os.path.join(FONTS, "PretendardVariable.woff2")
    if not os.path.exists(pret_dst):
        shutil.copyfile(pret_src, pret_dst)
    fetch("https://raw.githubusercontent.com/orioncactus/pretendard/main/LICENSE", os.path.join(FONTS, "LICENSE-Pretendard.txt"))
    print("fonts ready")


if __name__ == "__main__":
    for d in (ICON_COLOR, ICON_3D, FONTS, LOGO):
        os.makedirs(d, exist_ok=True)
    fetch_fonts()
    fetch_icons()
