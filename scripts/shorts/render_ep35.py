# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP35 렌더러
기획: docs/youtube_shorts_plan_part3.md  #35 "부모님 모시면 부양가족으로 인정될까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep35/
실행: python scripts/shorts/render_ep35.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep35"

SCENES = [
    dict(plan=3.6, caption="부모님 모시면\n[부양가족?]",
         narration="부모님을 모시고 산다면, 개인회생에서 부양가족으로 인정될까요?",
         tts="부모님을 모시고 산다면, 개인회생에서 부양가족으로 인정될까요?"),
    dict(plan=6.0, caption="성인 가족은\n[인정 어려운 편]",
         narration="소득이 없는 부모님이라도, 성인 가족은 부양가족으로 잘 인정되지 않는 편이에요.",
         tts="소득이 없는 부모님이라도, 성인 가족은 부양가족으로 잘 인정되지 않는 편이에요."),
    dict(plan=9.0, caption="한 명 차이가\n[변제금 차이]",
         narration="생계비는 가구원 수로 정해져서, 한 명이 더해지고 빠지는 데 따라 매달 변제금이 크게 달라지거든요. 그래서 법원도 꼼꼼히 봐요.",
         tts="생계비는 가구원 수로 정해져서, 한 명이 더해지고 빠지는 데 따라 매달 변제금이 크게 달라지거든요. 그래서 법원도 꼼꼼히 봐요."),
    dict(plan=10.0, caption="[예외]도\n있어요",
         narration="다만 부양할 다른 가족이 없고, 부모님이 아프시거나 재산이 없는 것처럼 사정이 분명하면 일부 인정되기도 해요. 미성년 자녀도 배우자 소득에 따라 절반만 인정되는 경우가 있습니다.",
         tts="다만 부양할 다른 가족이 없고, 부모님이 아프시거나 재산이 없는 것처럼 사정이 분명하면 일부 인정되기도 해요. 미성년 자녀도 배우자 소득에 따라 절반만 인정되는 경우가 있습니다."),
    dict(plan=6.0, caption="가족 구성,\n[증빙이 핵심]",
         narration="부양가족은 증빙이 핵심이에요. 마이김변 익명 체크로 가족 구성부터 정리해 보세요.",
         tts="부양가족은 증빙이 핵심이에요. 마이김변 익명 체크로 가족 구성부터 정리해 보세요."),
]


def scene1(t, dur):
    frame = new_frame(cy=1000, color=(13, 148, 136), alpha=30)
    hero(frame, t, "family", TEAL, cx=CX, cy=990, r=170, t0=0.05)
    place(frame, pill_img("부양가족 인정?", AMBER, 40), CX, 1250, pop(t, cue(0, "부양가족으로"), 0.3), dy=16)
    return finish(frame, 0, t, dur, z=0.07)


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    place(frame, vcard_img(390, 320, "성인 부모님", "소득 없음", "family", SLATE500), 290, 900,
          pop(t, cue(1, "부모님이라도"), 0.4), s0=0.9)
    place(frame, vcard_img(390, 320, "미성년 자녀", "부양 필요", "person", TEAL), 718, 900, pop(t, 0.3, 0.4), s0=0.9)
    t_n = cue(1, "잘 인정되지")
    place(frame, pill_img("인정 어려운 편", AMBER, 34), 290, 1110, pop(t, t_n, 0.3), dy=12)
    place(frame, pill_img("인정되는 편", TEAL, 34), 718, 1110, pop(t, t_n + 0.3, 0.3), dy=12)
    footnote(frame, "부양가족 인정 기준은 법원·사건마다 다를 수 있습니다.", t, 0.8)
    return finish(frame, 1, t, dur)


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    t_one = cue(2, "한 명이")
    t_diff = cue(2, "변제금이")
    base_y, top_y = 1320, 780
    total = base_y - top_y
    q = ease_in_out(clamp((t - t_one) / 0.9))
    cols = ((250, "1인 가구", 0.42), (610, "2인 가구", lerp(0.42, 0.68, q)))
    ov, d = overlay()
    for k, (x, lab, live) in enumerate(cols):
        p = pop(t, 0.2 + k * 0.25, 0.4)
        if p <= 0:
            continue
        h = total * p
        lh = h * live
        d.rounded_rectangle([x, base_y - lh, x + 200, base_y], 18, fill=TEAL + (255,))
        d.rounded_rectangle([x, base_y - h, x + 200, base_y - lh - 8], 18, fill=BLUE + (255,))
        d.text((x + 100, base_y + 40), lab, font=font("EB", 34), fill=WHITE + (255,), anchor="mm")
        if p > 0.9:
            d.text((x + 100, base_y - lh / 2), "생계비", font=font("EB", 32), fill=WHITE + (255,), anchor="mm")
            d.text((x + 100, base_y - lh - (h - lh) / 2), "변제금", font=font("EB", 32), fill=WHITE + (255,), anchor="mm")
    frame.alpha_composite(ov)
    ov, d = overlay()
    d.text((X1 - 60, top_y - 10), "같은 소득", font=font("B", 28), fill=SLATE300 + (255,), anchor="rm")
    comp(frame, ov, pop(t, 0.6, 0.4))
    place(frame, pill_img("변제금이 달라져요", AMBER, 32), 710, 700, pop(t, t_diff, 0.3), dy=10)
    footnote(frame, ["예시 그래프입니다. 생계비 기준은 매년 바뀔 수 있습니다.",
                     "부양가족 인정 여부는 법원이 판단합니다."], t, 0.8, y=1438 + 20)
    return finish(frame, 2, t, dur)


ITEMS = (("check", "부양할 다른 가족이 없음", "형제자매 등 다른 부양 의무자", TEAL),
         ("medical", "부모님 질병·소득 없음", "진단서·소득 자료로 증빙", TEAL),
         ("wallet", "부모님 재산 없음", "재산 관련 서류로 확인", TEAL),
         ("person", "미성년 자녀", "배우자 소득에 따라 절반만 인정되기도", BLUE))


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    times = [cue(3, "부양할"), cue(3, "아프시거나"), cue(3, "재산이"), cue(3, "미성년")]
    num_list(frame, t, ITEMS, times, y0=640, h=132, gap=20, states=["on"] * 4)
    footnote(frame, "인정 범위는 가족 사정과 증빙 자료에 따라 달라질 수 있습니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "부양가족으로", "pop"), (1, "부모님이라도", "pop"), (1, "잘 인정되지", "alert"), (2, "한 명이", "pop"),
       (2, "변제금이", "pop"), (3, "부양할", "pop"), (3, "아프시거나", "pop"), (3, "재산이", "pop"), (3, "미성년", "pop")]

META = dict(
    title="부모님 모시면 부양가족으로 인정될까?",
    desc=("개인회생에서 생계비는 가구원 수를 기준으로 정해져, 부양가족 한 명이 더해지거나 빠지는 데 따라 월 변제금이 크게 달라집니다. "
          "그래서 법원은 부양가족 인정 여부를 꼼꼼히 봅니다.\n"
          "소득이 없는 부모님이라도 성인 가족은 부양가족으로 잘 인정되지 않는 편입니다. 다만 다른 부양 의무자가 없고, 부모님이 아프시거나 "
          "재산이 없는 등 사정이 분명하면 일부 인정되기도 합니다. 미성년 자녀도 배우자 소득에 따라 절반만 인정되는 경우가 있습니다.\n"
          "생계비 기준은 매년 바뀔 수 있고, 인정 범위는 법원·사건마다 다를 수 있습니다."),
    feature="익명 채무 체크 > 가족 구성 입력",
    tags="#부양가족 #개인회생생계비 #변제금 #기준중위소득 #개인회생 #마이김변",
    comment=("부양가족을 주장하려면 가족관계증명서, 소득·재산 자료, 진단서 등 증빙을 미리 준비하세요. 개인정보는 댓글에 남기지 마세요."),
    related="public/guide/personal-rehabilitation.html",
    slot="13주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
