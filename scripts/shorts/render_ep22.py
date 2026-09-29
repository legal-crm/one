# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP22 렌더러
기획: docs/youtube_shorts_plan_part3.md  #22 "회생 전에 가족 빚부터 갚으면 생기는 일"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep22/
실행: python scripts/shorts/render_ep22.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep22"

SCENES = [
    dict(plan=3.4, caption="가족 빚부터\n[먼저 갚기?]",
         narration="개인회생 신청 전에, 가족이나 지인 빚부터 먼저 갚으려고 하시나요?",
         tts="개인회생 신청 전에, 가족이나 지인 빚부터 먼저 갚으려고 하시나요?"),
    dict(plan=7.0, caption="이게 바로\n[편파변제]",
         narration="일부 채권자에게만 먼저 갚는 걸 편파변제라고 해요. 법원은 이 돈을 문제 삼을 수 있습니다.",
         tts="일부 채권자에게만 먼저 갚는 걸 편파변제라고 해요. 법원은 이 돈을 문제 삼을 수 있습니다."),
    dict(plan=8.0, caption="돈이 [두 번]\n나갈 수도",
         narration="갚은 금액만큼 청산가치에 더해져, 변제금을 더 내라고 할 수 있거든요. 가족에게 한 번, 법원에 또 한 번 나가는 셈이죠.",
         tts="갚은 금액만큼 청산가치에 더해져, 변제금을 더 내라고 할 수 있거든요. 가족에게 한 번, 법원에 또 한 번 나가는 셈이죠."),
    dict(plan=8.0, caption="[그대로 두고]\n상의하세요",
         narration="통장에 돈이 있거나 재산을 팔아 돈이 생겼다면, 쓰지 말고 그대로 둔 채 먼저 상의하는 게 안전해요.",
         tts="통장에 돈이 있거나 재산을 팔아 돈이 생겼다면, 쓰지 말고 그대로 둔 채 먼저 상의하는 게 안전해요."),
    dict(plan=6.0, caption="갚기 전에\n[먼저 물어보기]",
         narration="누구에게 먼저 갚을지 정하기 전에, 마이김변 가명 상담방에서 먼저 물어보세요.",
         tts="누구에게 먼저 갚을지 정하기 전에, 마이김변 가명 상담방에서 먼저 물어보세요."),
]


def coins(frame, t, t0, a, b, n=5, every=0.22, fly=0.7, h=260):
    """a→b 포물선으로 동전이 날아감"""
    for k in range(n):
        s = t0 + k * every
        q = (t - s) / fly
        if not 0 <= q <= 1:
            continue
        e = ease_in_out(q)
        x = lerp(a[0], b[0], e)
        y = lerp(a[1], b[1], e) - math.sin(math.pi * e) * h
        place(frame, icon("coin", 70, AMBER), x, y, 1.0 - max(0, q - 0.85) / 0.15, dy=0)


# ── 장면 1: 지갑에서 가족에게만 동전이 간다 ──────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(245, 158, 11), alpha=30)
    hero(frame, t, "wallet", NAVY, cx=CX, cy=860, r=120, t0=0.05, pulse=False, glow=50)
    t_f = cue(0, "가족이나")
    for k, cx in enumerate((190, 370)):
        place(frame, vcard_img(150, 230, "은행", "", "bank", SLATE500, tsize=34, owidth=2), cx, 1250,
              pop(t, 0.2 + k * 0.1, 0.35))
    place(frame, vcard_img(260, 240, "가족·지인", "", "family", AMBER, fill=CARD_HL, tsize=36, owidth=4), 760, 1245,
          pop(t, t_f, 0.35))
    coins(frame, t, cue(0, "먼저") - 0.2, (CX, 900), (760, 1180))
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 일부 채권자에게만 변제 = 편파변제 ─────────────────────────
ROWS = (("A카드", "변제 없음", "card", SLATE500), ("B캐피탈", "변제 없음", "bank", SLATE500),
        ("가족·지인", "신청 직전 먼저 변제", "family", AMBER))


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=34)
    t_hl = cue(1, "먼저 갚는")
    for k, (name, sub, ic, col) in enumerate(ROWS):
        hl = k == 2 and t >= t_hl
        img = card_img(828, 140, name, sub, ic, AMBER if hl else col, fill=CARD_HL if hl else CARD,
                       outline=AMBER if hl else (51, 65, 85), owidth=4 if hl else 2)
        place(frame, img, CX, 760 + k * 170, pop(t, 0.2 + k * 0.25, 0.4))
    t_st = cue(1, "편파변제라고")
    dx, dy = shake_xy(t, t_st + 0.1)
    stamp_in(frame, stamp_img("편파변제", RED, 280, 110, -8, 52), 760 + dx, 1100 + dy, t, t_st)
    t_c = cue(1, "법원은")
    hero(frame, t, "gavel", NAVY, cx=CX, cy=1290, r=64, t0=t_c, pulse=False, glow=30)
    return finish(frame, 1, t, dur)


# ── 장면 3: 가족에게 한 번 + 법원에 또 한 번 ────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=28)
    t_a, t_b, t_c = cue(2, "갚은 금액"), cue(2, "변제금을"), cue(2, "가족에게")
    place(frame, card_img(828, 140, "가족에게 갚은 돈", "이미 나간 돈", "coin", AMBER, fill=CARD_HL), CX, 700,
          pop(t, t_a, 0.4))
    place(frame, pill_img("+", SLATE700, 48, pad=22, h=80), CX, 812, pop(t, t_b - 0.2, 0.3), dy=0, s0=0.5)
    place(frame, card_img(828, 140, "변제금에 더해질 수 있는 돈", "청산가치 반영", "gavel", RED, fill=CARD_HL), CX, 924,
          pop(t, t_b, 0.4))
    tr = pop(t, t_c, 0.45)
    if tr > 0:
        ov, d = overlay()
        d.line([(X0 + 40, 1030), (X1 - 40, 1030)], fill=SLATE400 + (255,), width=4)
        comp(frame, ov, tr)
        place(frame, disc_img(92, RED), CX - 200, 1170, tr, dy=0, s0=0.5)
        ov, d = overlay()
        d.text((CX - 200, 1170), "×2", font=font("EB", 84), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, tr)
        ov, d = overlay()
        d.text((CX - 80, 1140), "같은 돈이", font=font("B", 36), fill=SLATE300 + (255,), anchor="lm")
        d.text((CX - 80, 1200), "두 번 나가는 셈", font=font("EB", 48), fill=WHITE + (255,), anchor="lm")
        comp(frame, ov, pop(t, t_c + 0.3, 0.4), (lerp(-30, 0, pop(t, t_c + 0.3, 0.4)), 0))
    footnote(frame, ["편파변제는 부인권 행사나 청산가치 반영 대상이 될 수 있습니다.",
                     "처리 방식은 법원·사건마다 다를 수 있습니다."], t, 0.6)
    return finish(frame, 2, t, dur)


# ── 장면 4: 가명 상담방에서 먼저 묻기 (데모) ─────────────────────────
MSGS = (("me", ("가족에게 빌린 돈,", "신청 전에 먼저 갚아도 될까요?")),
        ("them", ("일부 채권자에게만 먼저 갚으면", "편파변제로 볼 수 있어요.")),
        ("them", ("통장 돈은 그대로 두시고", "자료부터 같이 살펴볼게요.")))


def scene4(t, dur):
    frame = new_frame()
    times = [0.4, cue(3, "쓰지 말고"), cue(3, "먼저 상의")]
    put_phone(frame, screen_chat(t, MSGS, times), 0, math.sin(t * 1.3) * 5)
    chip(frame, "예시 화면", 640, 560)
    return finish(frame, 3, t, dur, z=0)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "가족이나", "pop"), (1, "편파변제라고", "thump"), (2, "갚은 금액", "pop"), (2, "변제금을", "pop"),
       (2, "가족에게", "alert"), (3, "쓰지 말고", "tick"), (3, "먼저 상의", "tick")]

META = dict(
    title="회생 전에 가족 빚부터 갚으면 생기는 일",
    desc=("개인회생·파산 신청 전에 가족이나 지인 등 일부 채권자에게만 먼저 갚는 것을 편파변제라고 합니다. "
          "법원은 이 금액을 부인권 행사 대상으로 보거나 청산가치에 반영해, 변제금을 더 내도록 할 수 있습니다. "
          "결국 가족에게 한 번, 법원에 또 한 번 돈이 나가는 셈이 될 수 있습니다.\n"
          "통장에 돈이 있거나 재산을 처분해 돈이 생겼다면, 쓰기 전에 먼저 상의하세요. 처리 방식은 법원·사건마다 다를 수 있습니다."),
    feature="가명 상담방 (010 번호 비공개로 선택한 변호사에게 질문)",
    tags="#편파변제 #개인회생 #부인권 #청산가치 #가족빚 #마이김변",
    comment=("신청 직전의 변제뿐 아니라 재산 처분·명의 이전도 문제 될 수 있습니다. 돈을 움직이기 전에 선택한 변호사와 먼저 "
             "상의하세요. 개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/guide/personal-rehabilitation.html",
    slot="9주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
