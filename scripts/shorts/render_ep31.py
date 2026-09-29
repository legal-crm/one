# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP31 렌더러
기획: docs/youtube_shorts_plan_part3.md  #31 "개인회생하면 인생 끝일까요?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep31/
실행: python scripts/shorts/render_ep31.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep31"

SCENES = [
    dict(plan=3.4, caption="개인회생하면\n[인생 끝?]",
         narration="개인회생하면 낙인이 찍히고, 인생이 끝나는 걸까요?",
         tts="개인회생하면 낙인이 찍히고, 인생이 끝나는 걸까요?"),
    dict(plan=8.0, caption="제도의 목적은\n[다시 서기]",
         narration="그렇다면 이런 제도를 만들 이유가 없겠죠. 회생과 파산은 성실하지만 어려워진 사람이 다시 일어서도록 만든 제도예요.",
         tts="그렇다면 이런 제도를 만들 이유가 없겠죠. 회생과 파산은 성실하지만 어려워진 사람이 다시 일어서도록 만든 제도예요."),
    dict(plan=7.0, caption="버티기만 하면\n[계속되는 것]",
         narration="오히려 갚을 수 없는 상태로 버티기만 하면, 독촉과 압류, 강제집행이 계속될 수 있어요.",
         tts="오히려 갚을 수 없는 상태로 버티기만 하면, 독촉과 압류, 강제집행이 계속될 수 있어요."),
    dict(plan=7.5, caption="정리가 빠르면\n[재기도 빨라요]",
         narration="버틸 수 없는 상황이라면, 빨리 정리하고 다시 시작하는 쪽이 시간을 아끼는 방법이에요.",
         tts="버틸 수 없는 상황이라면, 빨리 정리하고 다시 시작하는 쪽이 시간을 아끼는 방법이에요."),
    dict(plan=6.0, caption="혼자 버티지 말고\n[먼저 상의]",
         narration="혼자 버티지 마세요. 마이김변에서 010 번호 없이, 가명으로 먼저 상의해 보세요.",
         tts="혼자 버티지 마세요. 마이김변에서 공일공 번호 없이, 가명으로 먼저 상의해 보세요."),
]


# ── 장면 1: 낙인? ────────────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, alpha=30)
    hero(frame, t, "person", SLATE700, cx=CX, cy=1000, r=170, t0=0.05, icol=SLATE300, pulse=False)
    t_st = cue(0, "낙인이")
    dx, dy = shake_xy(t, t_st + 0.1)
    stamp_in(frame, stamp_img("낙인?", RED, 260, 120, -10, 62), CX + 60 + dx, 1110 + dy, t, t_st)
    place(frame, pill_img("인생 끝?", SLATE900, 40, fg=SLATE200), CX, 740, pop(t, cue(0, "인생이"), 0.3), dy=-14)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 계단을 오르는 사람 ─────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1050, color=(13, 148, 136), alpha=36)
    t_s = cue(1, "회생과")
    t_up = cue(1, "다시 일어서도록")
    ov, d = overlay()
    for k in range(5):
        p = pop(t, 0.2 + k * 0.12, 0.35)
        if p <= 0:
            continue
        x0 = 130 + k * 150
        top = 1330 - (k + 1) * 90
        d.rounded_rectangle([x0, top + (1 - p) * 40, x0 + 140, 1330], 16,
                            fill=lerp_color((40, 84, 110), TEAL, k / 4) + (int(255 * p),))
    frame.alpha_composite(ov)
    q = ease_in_out(clamp((t - t_up) / 1.8))
    step = q * 4
    k = min(4, int(step))
    f = step - k
    x = 200 + (k + f) * 150
    y = 1330 - (k + 1) * 90 - 70 - math.sin(f * math.pi) * 30
    place(frame, icon("person", 110, WHITE), x, y, pop(t, 0.6, 0.4), dy=0)
    place(frame, pill_img("성실하지만 어려워진 사람", SLATE700, 30), 330, 720, pop(t, cue(1, "성실하지만"), 0.3), dy=12)
    place(frame, pill_img("다시 일어서도록", TEAL, 34), 700, 800, pop(t, t_up, 0.3), dy=12)
    return finish(frame, 1, t, dur)


# ── 장면 3: 버티면 계속되는 것들 ────────────────────────────
ITEMS = (("phone", "독촉 전화·문자", "하루에도 여러 번", RED), ("lock", "통장·급여 압류", "생활비까지 묶일 수 있어요", RED),
         ("gavel", "강제집행", "재산에 대한 집행 절차", RED))


def scene3(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=30)
    times = [cue(2, "독촉과"), cue(2, "압류"), cue(2, "강제집행이")]
    shake = sum(shake_xy(t, m, 8, 0.3)[0] for m in times)
    place(frame, pill_img("갚을 수 없는 상태로 버티면", SLATE700, 34), CX, 660, pop(t, 0.2, 0.35), dy=12)
    num_list(frame, t, ITEMS, times, y0=760, h=150, gap=26, states=["bad"] * 3, x0=X0 + shake)
    return finish(frame, 2, t, dur)


# ── 장면 4: 버티기 vs 정리 ───────────────────────────────
def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    t_a = 0.2
    t_b = cue(3, "빨리")
    ov, d = overlay()
    d.text((X0, 700), "버티기", font=font("EB", 40), fill=(254, 202, 202, 255), anchor="lm")
    d.text((X0, 1010), "정리하고 다시 시작", font=font("EB", 40), fill=TEAL_L + (255,), anchor="lm")
    comp(frame, ov, pop(t, t_a, 0.4))
    wave = [(X0 + 10 + k * 40, 850 + math.sin(k * 0.9) * 26 + k * 3) for k in range(21)]
    draw_line_progress(frame, wave, clamp((t - t_a) / 2.4), RED, 9)
    rise = [(X0 + 10, 1320), (300, 1300), (500, 1230), (700, 1130), (880, 1060)]
    draw_line_progress(frame, rise, clamp((t - t_b) / 1.6), TEAL, 10)
    for k, (lab, x, y, key) in enumerate((("정리", 300, 1300, "정리하고"), ("변제", 500, 1230, "다시 시작"),
                                          ("새 출발", 700, 1130, "시간을"))):
        place(frame, pill_img(lab, TEAL, 28), x, y + 60, pop(t, cue(3, key), 0.3), dy=10)
    place(frame, icon("hourglass", 80, (254, 202, 202)), 860, 715, pop(t, 1.0, 0.4), dy=0)
    place(frame, icon("chart_up", 90, TEAL_L), 860, 960, pop(t, cue(3, "아끼는"), 0.4), dy=0)
    footnote(frame, "절차에 걸리는 기간은 사건마다 다를 수 있습니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "낙인이", "thump"), (0, "인생이", "pop"), (1, "회생과", "pop"), (1, "다시 일어서도록", "ding"),
       (2, "독촉과", "alert"), (2, "압류", "alert"), (2, "강제집행이", "thump"), (3, "빨리", "pop"),
       (3, "정리하고", "tick"), (3, "다시 시작", "tick"), (3, "시간을", "tick")]

META = dict(
    title="개인회생하면 인생 끝일까요?",
    desc=("개인회생·파산을 '낙인'으로 여기는 분이 많지만, 제도의 목적은 성실하지만 어려워진 채무자가 다시 일어설 수 있게 돕는 데 있습니다.\n"
          "오히려 갚을 수 없는 상태로 버티기만 하면 독촉과 압류, 강제집행이 이어질 수 있습니다. 버틸 수 없는 상황이라면 "
          "빨리 정리하고 다시 시작하는 편이 시간을 아끼는 방법일 수 있습니다. 어떤 절차가 맞는지는 개별 상황에 따라 다릅니다."),
    feature="스텔스 가명 상담 (010 번호를 공개하지 않고 상담 요청)",
    tags="#개인회생 #개인파산 #재기 #빚고민 #채무정리 #마이김변",
    comment=("주변 시선보다 지금 생활을 지키는 것이 먼저입니다. 개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/articles/rehabilitation-vs-bankruptcy.html",
    slot="12주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
