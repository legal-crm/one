# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP25 렌더러
기획: docs/youtube_shorts_plan_part3.md  #25 "새출발기금 vs 개인회생, 무엇이 다를까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep25/
실행: python scripts/shorts/render_ep25.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep25"

SCENES = [
    dict(plan=3.6, caption="새출발기금 vs\n[개인회생]",
         narration="새출발기금과 개인회생, 나에게는 어떤 제도가 맞을까요?",
         tts="새출발기금과 개인회생, 나에게는 어떤 제도가 맞을까요?"),
    dict(plan=8.0, caption="[대상자]부터\n달라요",
         narration="먼저 대상이 달라요. 새출발기금은 자영업자와 소상공인을 위한 제도고, 개인회생은 꾸준한 소득이 있으면 직장인도, 아르바이트생도 검토할 수 있어요.",
         tts="먼저 대상이 달라요. 새출발기금은 자영업자와 소상공인을 위한 제도고, 개인회생은 꾸준한 소득이 있으면 직장인도, 아르바이트생도 검토할 수 있어요."),
    dict(plan=8.0, caption="[정리되는 빚]\n범위도 달라요",
         narration="새출발기금은 협약한 금융회사 빚이 중심이고, 개인회생은 개인 간 빚이나 거래처 대금, 세금까지 변제계획에 넣을 수 있어요.",
         tts="새출발기금은 협약한 금융회사 빚이 중심이고, 개인회생은 개인 간 빚이나 거래처 대금, 세금까지 변제계획에 넣을 수 있어요."),
    dict(plan=8.0, caption="[내 빚 구조]가\n기준이에요",
         narration="담보대출 비중이 크면 새출발기금이, 신용 빚이 크고 재산과 소득이 적다면 개인회생이 더 맞을 수 있어요.",
         tts="담보대출 비중이 크면 새출발기금이, 신용 빚이 크고 재산과 소득이 적다면 개인회생이 더 맞을 수 있어요."),
    dict(plan=6.0, caption="제도 비교,\n[먼저 해 보기]",
         narration="제도마다 장단점이 달라요. 마이김변에서 내 빚 구조부터 익명으로 정리하고, 변호사와 비교해 보세요.",
         tts="제도마다 장단점이 달라요. 마이김변에서 내 빚 구조부터 익명으로 정리하고, 변호사와 비교해 보세요."),
]

HEADS = (("새출발기금", PURPLE), ("개인회생", TEAL))
ROWS = (("누가 신청하나", ("자영업자·소상공인", "사업 요건 있음"), ("소득 있는 개인", "직장인·알바·사업자"), None),
        ("정리되는 빚", ("협약 금융회사 빚", "중심"), ("개인 빚·거래처·세금", "변제계획에 포함"), None),
        ("이럴 때 맞을 수도", ("담보대출 비중 큼", "주택·사업장 담보"), ("신용 빚 큼", "재산·소득 적음"), "LR"))


# ── 장면 1: 두 제도 맞대결 ─────────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(167, 139, 250), alpha=28)
    hero(frame, t, "handshake", PURPLE, cx=290, cy=1000, r=130, t0=0.1, glow=50)
    hero(frame, t, "calendar", TEAL, cx=718, cy=1000, r=130, t0=cue(0, "개인회생"), glow=50)
    for k, (lab, x, t0) in enumerate((("새출발기금", 290, 0.3), ("개인회생", 718, cue(0, "개인회생") + 0.2))):
        place(frame, pill_img(lab, SLATE900, 36, fg=WHITE), x, 1200, pop(t, t0, 0.35), dy=16)
    place(frame, pill_img("VS", AMBER, 44, pad=24, h=90), CX, 1000, pop(t, cue(0, "나에게는"), 0.3), dy=0, s0=0.4)
    return finish(frame, 0, t, dur, z=0.06)


def table(frame, t, k, times):
    versus(frame, t, HEADS, ROWS[:k + 1], [-1.0] * k + times, y0=640, t_head=-1.0 if k else 0.1)


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    table(frame, t, 0, [cue(1, "새출발기금은")])
    footnote(frame, ["새출발기금 세부 대상·요건은 운영 기관 기준을 확인하세요.",
                     "개인회생은 채무 한도 등 법정 요건을 따로 충족해야 합니다."], t, 0.8)
    return finish(frame, 1, t, dur)


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    table(frame, t, 1, [cue(2, "새출발기금은")])
    footnote(frame, ["세금 등 우선권 있는 채권은 감면되지 않고 우선 변제됩니다.",
                     "포함 범위는 채무 종류·사건마다 다를 수 있습니다."], t, 0.8)
    return finish(frame, 2, t, dur)


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    table(frame, t, 2, [cue(3, "담보대출")])
    footnote(frame, "어떤 제도가 맞는지는 개별 상황에 따라 다릅니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "개인회생", "pop"), (0, "나에게는", "thump"), (1, "새출발기금은", "pop"), (2, "새출발기금은", "pop"),
       (3, "담보대출", "pop"), (3, "개인회생이", "ding")]

META = dict(
    title="새출발기금 vs 개인회생, 무엇이 다를까?",
    desc=("새출발기금과 개인회생은 대상자와 정리되는 빚의 범위가 다릅니다.\n"
          "· 대상: 새출발기금은 요건을 갖춘 자영업자·소상공인, 개인회생은 꾸준한 소득이 있는 개인(직장인·아르바이트·사업자)\n"
          "· 정리되는 빚: 새출발기금은 협약 금융회사 채무 중심, 개인회생은 개인 간 채무·거래처 대금·세금 등도 변제계획에 포함 "
          "(세금 등 우선권 있는 채권은 감면 없이 우선 변제)\n"
          "· 담보대출 비중이 크면 새출발기금이, 신용 채무가 크고 재산·소득이 적으면 개인회생이 맞을 수 있습니다.\n"
          "세부 요건은 운영 기관·법원 기준을 확인하고, 개별 상황은 변호사와 상의하세요."),
    feature="익명 채무 체크 > 채무 구조 입력 (담보·신용 채무 구분)",
    tags="#새출발기금 #개인회생 #자영업자빚 #소상공인 #채무조정 #마이김변",
    comment=("두 제도 모두 요건과 효과가 달라, 담보·신용 채무 비중과 소득·재산을 함께 봐야 합니다. "
             "개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/articles/self-employed-rehabilitation.html",
    slot="10주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
