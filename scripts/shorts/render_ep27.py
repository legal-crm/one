# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP27 렌더러
기획: docs/youtube_shorts_plan_part3.md  #27 "워크아웃 중에도 개인회생 신청할 수 있을까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep27/
실행: python scripts/shorts/render_ep27.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep27"

SCENES = [
    dict(plan=3.6, caption="워크아웃 중,\n[회생 가능?]",
         narration="신용회복위원회 채무조정을 하던 중에, 개인회생을 신청해도 될까요?",
         tts="신용회복위원회 채무조정을 하던 중에, 개인회생을 신청해도 될까요?"),
    dict(plan=7.0, caption="[다른 제도]라\n가능해요",
         narration="네, 가능해요. 신용회복은 채무조정 기구의 제도고, 개인회생은 법원 절차라서 진행 중에도 신청할 수 있습니다.",
         tts="네, 가능해요. 신용회복은 채무조정 기구의 제도고, 개인회생은 법원 절차라서 진행 중에도 신청할 수 있습니다."),
    dict(plan=7.0, caption="원금 감면이\n[없다면?]",
         narration="특히 신속채무조정이나 사전채무조정은 원금 감면이 없거나 제한적이라, 매달 내는 돈이 부담될 수 있어요.",
         tts="특히 신속채무조정이나 사전채무조정은 원금 감면이 없거나 제한적이라, 매달 내는 돈이 부담될 수 있어요."),
    dict(plan=9.0, caption="[월 변제금]\n비교해 보기",
         narration="소득과 재산이 적다면 개인회생에서 월 변제금이 줄고, 변제기간도 원칙적으로 3년이 될 수 있어요. 조정에서 빠진 빚도 함께 검토할 수 있고요.",
         tts="소득과 재산이 적다면 개인회생에서 월 변제금이 줄고, 변제기간도 원칙적으로 삼 년이 될 수 있어요. 조정에서 빠진 빚도 함께 검토할 수 있고요."),
    dict(plan=6.0, caption="버겁다면\n[다시 비교]",
         narration="지금 조정이 버겁다면 다른 길도 있어요. 마이김변 익명 체크로 먼저 비교해 보세요.",
         tts="지금 조정이 버겁다면 다른 길도 있어요. 마이김변 익명 체크로 먼저 비교해 보세요."),
]

HEADS = (("신속·사전 채무조정", PURPLE), ("개인회생", TEAL))
ROWS = (("원금 감면", ("없거나 제한적", "이자 위주 조정"), ("남은 빚 면책 검토", "변제계획 수행 후"), "R"),
        ("변제기간", ("조정 방식별 상이", ""), ("원칙 3년", "최장 5년"), "R"),
        ("빠진 빚·새 빚", ("포함 어려울 수 있음", ""), ("함께 검토 가능", ""), "R"))


# ── 장면 1: 신용회복 → 개인회생 갈아타기? ─────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(167, 139, 250), alpha=30)
    hero(frame, t, "handshake", PURPLE, cx=270, cy=1000, r=115, t0=0.05, glow=45)
    hero(frame, t, "gavel", TEAL, cx=738, cy=1000, r=115, t0=cue(0, "개인회생을"), glow=45)
    q = clamp((t - cue(0, "개인회생을") + 0.4) / 0.5)
    if q > 0:
        ov, d = overlay()
        for k in range(6):
            x = 410 + k * 34
            if x < lerp(400, 610, q):
                d.rounded_rectangle([x, 994, x + 20, 1006], 6, fill=SLATE300 + (255,))
        frame.alpha_composite(ov)
    for lab, x, t0 in (("신용회복 진행 중", 270, 0.3), ("개인회생 신청", 738, cue(0, "개인회생을") + 0.2)):
        place(frame, pill_img(lab, SLATE900, 32), x, 1190, pop(t, t0, 0.35), dy=16)
    place(frame, pill_img("?", AMBER, 56, pad=26, h=96), CX, 850, pop(t, cue(0, "될까요"), 0.3), dy=0, s0=0.4)
    return finish(frame, 0, t, dur, z=0.06)


# ── 장면 2: 서로 다른 제도 ──────────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    place(frame, vcard_img(390, 310, "신용회복", "채무조정 기구 제도", "handshake", PURPLE), 290, 880,
          pop(t, cue(1, "신용회복은"), 0.4), s0=0.9)
    place(frame, vcard_img(390, 310, "개인회생", "법원 절차", "gavel", TEAL, fill=CARD_HL, owidth=5), 718, 880,
          pop(t, cue(1, "개인회생은"), 0.4), s0=0.9)
    t_ok = cue(1, "진행 중에도")
    place(frame, card_img(828, 130, "진행 중에도 신청 가능", "두 제도는 서로 별개", "check", TEAL, fill=CARD_HL), CX, 1180,
          pop(t, t_ok, 0.4))
    footnote(frame, "개인회생 신청 시 진행 중인 조정의 처리는 담당 변호사와 확인하세요.", t, 0.8)
    return finish(frame, 1, t, dur)


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    versus(frame, t, HEADS, ROWS[:1], [cue(2, "원금 감면")], y0=640)
    t_b = cue(2, "매달")
    place(frame, card_img(828, 130, "매달 내는 돈이 부담될 수 있어요", "원금이 그대로 남아서", "wallet", AMBER),
          CX, 1060, pop(t, t_b, 0.4))
    footnote(frame, "신용회복위원회 제도별 감면 범위는 운영 기준에 따라 다릅니다.", t, 0.8)
    return finish(frame, 2, t, dur)


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    versus(frame, t, HEADS, ROWS, [-1.0, cue(3, "변제기간도"), cue(3, "빠진 빚")], y0=640, t_head=-1.0)
    footnote(frame, "변제기간·변제금은 소득·재산 등을 보고 법원이 정합니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "개인회생을", "pop"), (0, "될까요", "pop"), (1, "신용회복은", "pop"), (1, "개인회생은", "pop"),
       (1, "진행 중에도", "ding"), (2, "원금 감면", "pop"), (2, "매달", "alert"), (3, "변제기간도", "pop"),
       (3, "빠진 빚", "pop")]

META = dict(
    title="워크아웃 중에도 개인회생 신청할 수 있을까?",
    desc=("신용회복위원회 채무조정(워크아웃)을 하던 중에도 법원의 개인회생은 신청할 수 있습니다. 두 제도는 운영 주체와 절차가 다른 별개의 제도입니다.\n"
          "신속채무조정·사전채무조정은 원금 감면이 없거나 제한적이라 월 상환액이 부담될 수 있습니다. 소득과 재산이 적다면 "
          "개인회생에서 월 변제금이 줄고, 변제기간도 원칙적으로 3년(최장 5년)이 될 수 있습니다. 조정에서 빠진 채무나 새로 생긴 채무도 함께 검토할 수 있습니다.\n"
          "제도별 감면 범위와 변제금은 기준·사건에 따라 다릅니다."),
    feature="익명 채무 체크 > 4가지 해결 경로 비교 (개인회생·개인파산·신용회복·채무자대리)",
    tags="#워크아웃 #신용회복 #개인회생 #신속채무조정 #채무조정 #마이김변",
    comment=("진행 중인 신용회복 약정서와 월 상환액, 조정에 포함되지 않은 채무 목록을 정리해 두면 비교가 쉬워집니다. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/guide/credit-recovery.html",
    slot="11주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
