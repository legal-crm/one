# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP29 렌더러
기획: docs/youtube_shorts_plan_part3.md  #29 "금지명령이 안 나올 수 있는 4가지 경우"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep29/
실행: python scripts/shorts/render_ep29.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep29"

SCENES = [
    dict(plan=3.6, caption="금지명령,\n[안 나왔어요]",
         narration="개인회생을 신청했는데, 금지명령이 안 나올 수도 있을까요?",
         tts="개인회생을 신청했는데, 금지명령이 안 나올 수도 있을까요?"),
    dict(plan=8.0, caption="[4가지] 경우\n주의하세요",
         narration="최근 빚이 많은 경우, 도박 같은 사행성 지출이 많은 경우, 재신청 사건, 그리고 서류가 부실한 경우예요.",
         tts="최근 빚이 많은 경우, 도박 같은 사행성 지출이 많은 경우, 재신청 사건, 그리고 서류가 부실한 경우예요."),
    dict(plan=8.0, caption="미리 [소명]\n준비하기",
         narration="최근 빚은 왜 늘었는지 자료로 설명하고, 사행성 지출은 치료 상담 확인서처럼 노력한 기록을 준비해 두세요.",
         tts="최근 빚은 왜 늘었는지 자료로 설명하고, 사행성 지출은 치료 상담 확인서처럼 노력한 기록을 준비해 두세요."),
    dict(plan=7.5, caption="재신청이면\n[지난 사유]",
         narration="재신청이라면 지난번 기각이나 취하 사유를 먼저 설명하고, 서류는 처음부터 꼼꼼하게 챙기세요.",
         tts="재신청이라면 지난번 기각이나 취하 사유를 먼저 설명하고, 서류는 처음부터 꼼꼼하게 챙기세요."),
    dict(plan=6.5, caption="[준비]하면\n달라질 수 있어요",
         narration="금지명령은 법원이 판단하지만, 준비는 내가 할 수 있어요. 마이김변 DocHub로 소명 자료부터 정리해 보세요.",
         tts="금지명령은 법원이 판단하지만, 준비는 내가 할 수 있어요. 마이김변 독허브로 소명 자료부터 정리해 보세요."),
]

CASES = (("1", "최근 빚 비중이 큰 경우", "신청 직전에 늘어난 채무", RED),
         ("2", "사행성 지출이 많은 경우", "도박·투기성 거래", RED),
         ("3", "재신청 사건", "이전 기각·취하 이력", AMBER),
         ("4", "서류가 부실한 경우", "자료 누락·불일치", AMBER))
FIX = (("최근 빚 많음", "사용처 소명 자료"), ("사행성 지출", "치료·상담 확인서"),
       ("재신청 사건", "지난 사유 먼저 설명"), ("서류 부실", "처음부터 빠짐없이"))


# ── 장면 1: 금지명령 방패가 안 뜬다 ───────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=30)
    hero(frame, t, "shield", SLATE700, cx=CX, cy=990, r=160, t0=0.05, icol=SLATE300)
    t_x = cue(0, "안 나올")
    p = pop(t, t_x, 0.3)
    dx, dy = shake_xy(t, t_x + 0.05)
    place(frame, disc_img(56, RED, False), CX + 120 + dx, 870 + dy, p, dy=0, s0=0.4)
    place(frame, icon("x", 54, WHITE), CX + 120 + dx, 870 + dy, p, dy=0, s0=0.4)
    place(frame, pill_img("금지명령", SLATE900, 40), CX, 1240, pop(t, cue(0, "금지명령이"), 0.3), dy=16)
    return finish(frame, 0, t, dur, z=0.07)


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    times = [cue(1, "최근"), cue(1, "도박"), cue(1, "재신청"), cue(1, "서류가")]
    num_list(frame, t, CASES, times, y0=660, h=136, gap=20)
    footnote(frame, "금지명령 발령 여부는 법원이 사건별로 판단합니다.", t, 0.8)
    return finish(frame, 1, t, dur)


def fix_rows(frame, t, times, active):
    """문제 → 준비 자료 매핑 행"""
    for k, (prob, fix) in enumerate(FIX[:len(times)]):
        if t < times[k]:
            continue
        p = pop(t, times[k], 0.4)
        on = k in active
        y = 700 + k * 170
        col = CASES[k][3]
        place(frame, card_img(330, 130, prob, "", "warn", col if on else SLATE500, fill=CARD,
                              outline=col if on else (51, 65, 85), tsize=30, owidth=3 if on else 2), 255, y, p, dy=24)
        place(frame, icon("arrow", 44, SLATE300 if on else SLATE700), 450, y, p, dy=0)
        place(frame, card_img(440, 130, fix, "", "check", TEAL if on else SLATE500, fill=CARD_HL if on else CARD,
                              outline=TEAL if on else (51, 65, 85), tsize=30, owidth=4 if on else 2), 698, y,
              pop(t, times[k] + 0.3, 0.4), dy=24)


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    fix_rows(frame, t, [cue(2, "최근"), cue(2, "사행성")], {0, 1})
    return finish(frame, 2, t, dur)


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    fix_rows(frame, t, [-1.0, -1.0, cue(3, "재신청이라면"), cue(3, "서류는")], {2, 3})
    footnote(frame, "소명 자료의 종류와 범위는 법원·사건마다 다를 수 있습니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "금지명령이", "pop"), (0, "안 나올", "thump"), (1, "최근", "pop"), (1, "도박", "pop"), (1, "재신청", "pop"),
       (1, "서류가", "pop"), (2, "최근", "pop"), (2, "사행성", "pop"), (3, "재신청이라면", "pop"), (3, "서류는", "pop")]

META = dict(
    title="금지명령이 안 나올 수 있는 4가지 경우",
    desc=("개인회생 신청 후 금지명령이 나오지 않는 경우가 있습니다. 대표적으로 ① 최근 채무 비중이 큰 경우 ② 도박 등 사행성 지출이 "
          "많은 경우 ③ 재신청 사건 ④ 신청 서류가 부실한 경우입니다.\n"
          "해당될까 걱정된다면 미리 준비하세요. 최근 채무는 사용처와 사정을 자료로 소명하고, 사행성 지출은 치료·상담 확인서 등 "
          "노력한 기록을, 재신청이라면 지난 기각·취하 사유를 설명하는 자료를 준비합니다. 금지명령 여부는 법원이 사건별로 판단합니다."),
    feature="DocHub 서류함 > 소명 자료 정리 · AI 음성 진술서(초안 보조)",
    tags="#금지명령 #개인회생 #소명자료 #재신청 #추심중단 #마이김변",
    comment=("소명 자료는 '왜 그렇게 됐는지'를 객관적인 자료로 보여 주는 것이 중요합니다. 준비 범위는 선택한 변호사와 상의하세요. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/articles/debt-collection-defense.html",
    slot="11주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
