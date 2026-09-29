# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP34 렌더러
기획: docs/youtube_shorts_plan_part3.md  #34 "담보대출 있는 집·차, 회생하면서 지킬 수 있을까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep34/
실행: python scripts/shorts/render_ep34.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep34"

SCENES = [
    dict(plan=3.6, caption="집·차 지키며\n[회생 가능?]",
         narration="개인회생하면서 집이나 차를 지킬 수 있다는 광고, 많이 보셨죠?",
         tts="개인회생하면서 집이나 차를 지킬 수 있다는 광고, 많이 보셨죠?"),
    dict(plan=6.0, caption="담보가 있으면\n[따질 게 많아요]",
         narration="그런데 담보대출이 걸려 있으면 이야기가 달라져요. 따져 볼 조건이 세 가지 있습니다.",
         tts="그런데 담보대출이 걸려 있으면 이야기가 달라져요. 따져 볼 조건이 세 가지 있습니다."),
    dict(plan=9.0, caption="지키려면\n[3가지 조건]",
         narration="청산가치 보장을 지켜야 하고, 담보를 가진 금융회사와 협의가 돼야 하며, 법원 변제금과 별도로 담보 빚을 갚을 여력이 있어야 해요.",
         tts="청산가치 보장을 지켜야 하고, 담보를 가진 금융회사와 협의가 돼야 하며, 법원 변제금과 별도로 담보 빚을 갚을 여력이 있어야 해요."),
    dict(plan=9.0, caption="[두 곳]에\n나눠 내기",
         narration="담보권자는 회생 절차 밖에서 담보물로 돈을 받아 가는 구조라, 생활비를 쪼개 두 곳에 내야 할 수 있어요. 그게 어렵다면 지키기 어렵습니다.",
         tts="담보권자는 회생 절차 밖에서 담보물로 돈을 받아 가는 구조라, 생활비를 쪼개 두 곳에 내야 할 수 있어요. 그게 어렵다면 지키기 어렵습니다."),
    dict(plan=6.0, caption="지킬 수 있을지\n[숫자로 먼저]",
         narration="지킬 수 있을지는 숫자로 먼저 따져 봐야 해요. 마이김변에서 변호사 프로필을 보고 직접 골라 상의하세요.",
         tts="지킬 수 있을지는 숫자로 먼저 따져 봐야 해요. 마이김변에서 변호사 프로필을 보고 직접 골라 상의하세요."),
]


@lru_cache(maxsize=None)
def house_img(sz, col=WHITE):
    S = sz * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S / 100
    c = tuple(col) + (255,)
    d.polygon([(50 * u, 6 * u), (96 * u, 46 * u), (4 * u, 46 * u)], fill=c)
    d.rectangle([16 * u, 44 * u, 84 * u, 94 * u], fill=c)
    d.rectangle([40 * u, 62 * u, 60 * u, 94 * u], fill=(0, 0, 0, 0))
    d.rectangle([66 * u, 12 * u, 78 * u, 32 * u], fill=c)
    return im.resize((sz, sz), Image.LANCZOS)


@lru_cache(maxsize=None)
def car_img(sz, col=WHITE):
    S = sz * 2
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = S / 100
    c = tuple(col) + (255,)
    d.polygon([(22 * u, 44 * u), (32 * u, 22 * u), (68 * u, 22 * u), (80 * u, 44 * u)], fill=c)
    d.rounded_rectangle([4 * u, 42 * u, 96 * u, 74 * u], int(10 * u), fill=c)
    d.polygon([(36 * u, 28 * u), (48 * u, 28 * u), (48 * u, 42 * u), (30 * u, 42 * u)], fill=(0, 0, 0, 0))
    d.polygon([(54 * u, 28 * u), (65 * u, 28 * u), (72 * u, 42 * u), (54 * u, 42 * u)], fill=(0, 0, 0, 0))
    for x in (26, 74):
        d.ellipse([(x - 13) * u, 62 * u, (x + 13) * u, 88 * u], fill=(0, 0, 0, 0))
        d.ellipse([(x - 9) * u, 66 * u, (x + 9) * u, 84 * u], fill=c)
    return im.resize((sz, sz), Image.LANCZOS)


def assets(frame, t, t0, t1, locked_at=None):
    for k, (img, lab, x, s) in enumerate(((house_img(170), "집", 300, t0), (car_img(170), "차", 708, t1))):
        p = pop(t, s, 0.4)
        place(frame, disc_img(140, NAVY), x, 980, p, dy=0, s0=0.6)
        place(frame, img, x, 970, p, dy=0, s0=0.6)
        place(frame, pill_img(lab, SLATE900, 38), x, 1180, p, dy=12)
        if locked_at is not None:
            q = pop(t, locked_at + k * 0.2, 0.3)
            dx, dy = shake_xy(t, locked_at + k * 0.2 + 0.05)
            place(frame, disc_img(44, AMBER, False), x + 100 + dx, 870 + dy, q, dy=0, s0=0.4)
            place(frame, icon("lock", 46, WHITE), x + 100 + dx, 868 + dy, q, dy=0, s0=0.4)
            place(frame, pill_img("담보대출", AMBER, 30), x, 1262, q, dy=10)


def scene1(t, dur):
    frame = new_frame(cy=1000, color=(59, 130, 246), alpha=30)
    assets(frame, t, cue(0, "집이나"), cue(0, "차를"))
    place(frame, pill_img("지키면서 회생?", TEAL, 38), CX, 700, pop(t, cue(0, "지킬"), 0.3), dy=-14)
    return finish(frame, 0, t, dur, z=0.07)


def scene2(t, dur):
    frame = new_frame(cy=1000, color=(245, 158, 11), alpha=26)
    assets(frame, t, -1.0, -1.0, locked_at=cue(1, "담보대출이"))
    place(frame, pill_img("따져 볼 조건 3가지", SLATE700, 34), CX, 700, pop(t, cue(1, "세 가지"), 0.3), dy=-14)
    return finish(frame, 1, t, dur)


ITEMS = (("1", "청산가치 보장", "지키는 재산만큼 변제액이 늘 수 있어요", TEAL),
         ("2", "담보권자와 협의", "담보를 가진 금융회사의 동의", BLUE),
         ("3", "따로 갚을 여력", "법원 변제금과 별도로 담보 빚 상환", AMBER))


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    times = [cue(2, "청산가치"), cue(2, "담보를"), cue(2, "법원 변제금과")]
    num_list(frame, t, ITEMS, times, y0=700, h=150, gap=26)
    footnote(frame, "요건과 협의 가능 여부는 담보 종류·사건마다 다를 수 있습니다.", t, 0.8)
    return finish(frame, 2, t, dur)


def coins(frame, t, t0, a, b, n=4, every=0.3, fly=0.8):
    for k in range(n):
        q = (t - t0 - k * every) / fly
        if 0 <= q <= 1:
            e = ease_in_out(q)
            place(frame, icon("coin", 60, AMBER), lerp(a[0], b[0], e), lerp(a[1], b[1], e), 1 - max(0, q - 0.85) / 0.15, dy=0)


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    t_w, t_split, t_hard = cue(3, "생활비를"), cue(3, "두 곳에"), cue(3, "그게")
    hero(frame, t, "wallet", NAVY, cx=CX, cy=760, r=100, t0=t_w, pulse=False, glow=40)
    place(frame, vcard_img(370, 280, "법원 변제금", "변제계획에 따라", "gavel", TEAL), 290, 1150, pop(t, t_split, 0.4), s0=0.9)
    place(frame, vcard_img(370, 280, "담보 대출 상환", "회생 절차와 별도", "bank", AMBER), 718, 1150,
          pop(t, t_split + 0.2, 0.4), s0=0.9)
    coins(frame, t, t_split, (CX, 820), (290, 1040))
    coins(frame, t, t_split + 0.15, (CX, 820), (718, 1040))
    q = pop(t, t_hard, 0.35)
    if q > 0:
        place(frame, pill_img("여력이 없으면 지키기 어려워요", RED, 32), CX, 1350, q, dy=12)
    footnote(frame, "담보권(별제권)은 회생 절차와 별도로 행사될 수 있습니다.", t, 0.8, y=1458)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "집이나", "pop"), (0, "차를", "pop"), (0, "지킬", "pop"), (1, "담보대출이", "thump"), (1, "세 가지", "pop"),
       (2, "청산가치", "pop"), (2, "담보를", "pop"), (2, "법원 변제금과", "pop"), (3, "생활비를", "pop"),
       (3, "두 곳에", "tick"), (3, "그게", "alert")]

META = dict(
    title="담보대출 있는 집·차, 회생하면서 지킬 수 있을까?",
    desc=("개인회생 중에도 집이나 차를 지킬 수 있다는 광고가 많지만, 담보대출이 걸려 있으면 따져 볼 조건이 있습니다.\n"
          "① 청산가치 보장: 지키는 재산의 가치만큼 변제액이 늘 수 있습니다.\n"
          "② 담보권자와 협의: 담보를 가진 금융회사의 동의가 필요합니다.\n"
          "③ 따로 갚을 여력: 담보권자는 회생 절차 밖에서 담보물로 채권을 회수할 수 있어, 법원 변제금과 별도로 담보 빚을 갚아야 할 수 있습니다.\n"
          "두 곳에 나눠 낼 여력이 없다면 지키기 어렵습니다. 요건과 협의 가능 여부는 사건마다 다를 수 있습니다."),
    feature="변호사 프로필 확인 → 직접 선택 → 가명 상담방에서 담보 채무 검토",
    tags="#개인회생 #담보대출 #자동차할부 #별제권 #청산가치 #마이김변",
    comment=("담보대출 약정서, 잔액 증명, 시세 자료를 준비하면 지킬 수 있을지 계산하기 쉬워집니다. 개인정보는 댓글에 남기지 마세요."),
    related="public/guide/debt-types.html",
    slot="13주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
