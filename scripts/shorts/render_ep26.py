# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP26 렌더러
기획: docs/youtube_shorts_plan_part3.md  #26 "개인회생 기각·폐지, 끝이 아닙니다"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep26/
실행: python scripts/shorts/render_ep26.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep26"

SCENES = [
    dict(plan=3.4, caption="회생 기각,\n[끝일까요?]",
         narration="개인회생이 기각되거나 폐지됐다면, 이제 방법이 없을까요?",
         tts="개인회생이 기각되거나 폐지됐다면, 이제 방법이 없을까요?"),
    dict(plan=7.0, caption="[기각]과 [폐지]\n차이는?",
         narration="개시 결정 전에 절차가 멈추면 기각, 개시 결정을 받은 뒤에 멈추면 폐지라고 해요.",
         tts="개시 결정 전에 절차가 멈추면 기각, 개시 결정을 받은 뒤에 멈추면 폐지라고 해요."),
    dict(plan=7.0, caption="첫째,\n[즉시항고]",
         narration="첫째, 결정을 받은 뒤 정해진 짧은 기간 안에 즉시항고를 해서 다시 판단받을 수 있어요.",
         tts="첫째, 결정을 받은 뒤 정해진 짧은 기간 안에 즉시항고를 해서 다시 판단받을 수 있어요."),
    dict(plan=8.5, caption="[재신청]이나\n파산 검토",
         narration="둘째, 문제가 된 사유를 보완해 다시 신청할 수 있어요. 소득이 크게 줄어 갚기 어렵다면, 개인파산을 검토하는 방법도 있습니다.",
         tts="둘째, 문제가 된 사유를 보완해 다시 신청할 수 있어요. 소득이 크게 줄어 갚기 어렵다면, 개인파산을 검토하는 방법도 있습니다."),
    dict(plan=6.0, caption="끝이 아니라\n[다음 단계]",
         narration="기각 사유부터 정확히 보면 다음 길이 보여요. 마이김변에서 변호사 프로필을 보고 직접 골라 상의하세요.",
         tts="기각 사유부터 정확히 보면 다음 길이 보여요. 마이김변에서 변호사 프로필을 보고 직접 골라 상의하세요."),
]


# ── 장면 1: 경고 + 기각/폐지 ───────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=36)
    hero(frame, t, "warn", RED, cx=CX, cy=980, r=160, t0=0.05)
    for k, (lab, x) in enumerate((("기각", 300), ("폐지", 708))):
        t0 = cue(0, "기각되거나" if k == 0 else "폐지됐다면")
        place(frame, pill_img(lab, (58, 30, 40), 44, fg=(254, 202, 202)), x, 1260, pop(t, t0, 0.3), dy=20)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 절차 흐름 속 기각·폐지 위치 ─────────────────────────
STEPS = (("신청", "서류 접수", "doc", BLUE), ("개시 결정", "절차 시작", "gavel", TEAL),
         ("인가·변제", "변제계획 수행", "calendar", TEAL))


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    times = [0.2, cue(1, "개시 결정 전에"), cue(1, "받은 뒤에")]
    vtimeline(frame, t, STEPS, times, x=190, y0=700, gap=300)
    for lab, y, key in (("여기서 멈추면 기각", 850, "기각,"), ("이후 멈추면 폐지", 1150, "폐지라고")):
        t0 = cue(1, key)
        place(frame, pill_img(lab, RED, 32), 600, y, pop(t, t0, 0.3), dy=0, s0=0.7)
    return finish(frame, 1, t, dur)


# ── 장면 3: 즉시항고 ───────────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, color=(245, 158, 11), alpha=30)
    t_h = cue(2, "즉시항고를")
    hero(frame, t, "hourglass", AMBER, cx=CX, cy=900, r=120, t0=0.15, glow=50)
    place(frame, card_img(828, 150, "즉시항고", "상급 법원에 다시 판단 요청", "gavel", TEAL, fill=CARD_HL), CX, 1170,
          pop(t, t_h, 0.4))
    place(frame, pill_img("기간이 짧아요", AMBER, 32), CX + 250, 760, pop(t, cue(2, "기간"), 0.3), dy=10)
    footnote(frame, ["즉시항고 기간은 송달·공고 방식에 따라 다릅니다(채무자회생법 제13조).",
                     "결정문을 받으면 날짜부터 확인하세요."], t, 0.8)
    return finish(frame, 2, t, dur)


# ── 장면 4: 재신청 · 개인파산 ──────────────────────────────
ITEMS = (("1", "즉시항고", "다시 판단 요청", AMBER), ("2", "사유 보완 후 재신청", "기각·폐지 사유부터 확인", TEAL),
         ("3", "개인파산 검토", "갚을 능력이 크게 줄었다면", BLUE))


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    times = [-1.0, cue(3, "보완해"), cue(3, "개인파산을")]
    num_list(frame, t, ITEMS, times, y0=720, h=140, gap=26)
    footnote(frame, "어떤 방법이 맞는지는 기각·폐지 사유와 현재 소득에 따라 다릅니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "기각되거나", "thump"), (0, "폐지됐다면", "thump"), (1, "개시 결정 전에", "pop"), (1, "기각,", "alert"),
       (1, "받은 뒤에", "pop"), (1, "폐지라고", "alert"), (2, "짧은", "tick"), (2, "즉시항고를", "pop"),
       (3, "보완해", "pop"), (3, "개인파산을", "pop")]

META = dict(
    title="개인회생 기각·폐지, 끝이 아닙니다",
    desc=("개시 결정 전에 절차가 끝나면 '기각', 개시 결정 뒤에 끝나면 '폐지'라고 합니다. 둘 다 받았더라도 방법이 없는 것은 아닙니다.\n"
          "① 정해진 기간 안에 즉시항고로 다시 판단을 받아 볼 수 있습니다(기간은 송달·공고 방식에 따라 다름).\n"
          "② 문제가 된 사유를 보완해 다시 신청할 수 있습니다.\n"
          "③ 소득이 크게 줄어 변제가 어렵다면 개인파산을 검토할 수 있습니다.\n"
          "어떤 방법이 맞는지는 사건 사정에 따라 다릅니다."),
    feature="변호사 프로필 확인 → 직접 선택 → 가명 상담방에서 기각 사유 검토",
    tags="#개인회생기각 #개인회생폐지 #즉시항고 #재신청 #개인파산 #마이김변",
    comment=("기각·폐지 결정문에는 사유가 적혀 있습니다. 결정문과 송달일을 확인해 선택한 변호사와 바로 상의하세요. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/guide/rehabilitation-eligibility.html",
    slot="10주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
