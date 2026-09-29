# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP23 렌더러
기획: docs/youtube_shorts_plan_part3.md  #23 "개인회생, 어떤 사람들이 신청할까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep23/
실행: python scripts/shorts/render_ep23.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep23"

SCENES = [
    dict(plan=3.6, caption="회생 신청자,\n[어떤 사람?]",
         narration="개인회생은 어떤 사람들이 신청할까요? 돈을 펑펑 쓴 사람들일까요?",
         tts="개인회생은 어떤 사람들이 신청할까요? 돈을 펑펑 쓴 사람들일까요?"),
    dict(plan=6.5, caption="생각보다\n[평범해요]",
         narration="실제로는 매달 월급을 받고, 가족과 평범하게 사는 직장인도 적지 않아요.",
         tts="실제로는 매달 월급을 받고, 가족과 평범하게 사는 직장인도 적지 않아요."),
    dict(plan=8.0, caption="생활비가\n[빚이 될 때]",
         narration="월급으로 생활비가 모자라 대출을 받고, 그 원리금을 갚으려 또 빌리다 보면 누구나 버티기 어려워져요.",
         tts="월급으로 생활비가 모자라 대출을 받고, 그 원리금을 갚으려 또 빌리다 보면 누구나 버티기 어려워져요."),
    dict(plan=8.0, caption="[맞는 경로]\n찾기부터",
         narration="비난하거나 숨길 일이 아니에요. 소득과 빚의 구조를 먼저 보면, 나에게 맞는 해결 경로가 보입니다.",
         tts="비난하거나 숨길 일이 아니에요. 소득과 빚의 구조를 먼저 보면, 나에게 맞는 해결 경로가 보입니다."),
    dict(plan=6.0, caption="누구에게나\n[올 수 있는 일]",
         narration="누구에게나 올 수 있는 일이에요. 마이김변에서 익명으로 먼저 정리해 보세요.",
         tts="누구에게나 올 수 있는 일이에요. 마이김변에서 익명으로 먼저 정리해 보세요."),
]


# ── 장면 1: 물음표 실루엣 + 흔한 오해 ────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, alpha=36)
    hero(frame, t, "person", SLATE700, cx=CX, cy=1000, r=170, t0=0.05, icol=SLATE300)
    place(frame, pill_img("?", AMBER, 60, pad=26, h=100), CX + 150, 850, pop(t, cue(0, "신청할까요") - 0.1, 0.3),
          dy=0, s0=0.4)
    t_m = cue(0, "펑펑")
    for k, (txt, x, y) in enumerate((("과소비?", 250, 1270), ("투자 실패?", 740, 1300))):
        place(frame, pill_img(txt, (71, 85, 105), 34), x, y, pop(t, t_m + k * 0.2, 0.3), dy=20)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 평범한 직장인 ──────────────────────────────────────
ITEMS = (("briefcase", "매달 월급을 받는 직장인", "소득이 꾸준히 있어요", BLUE),
         ("family", "가족을 책임지는 가장", "생활비가 계속 들어가요", TEAL),
         ("clock", "성실하게 일하는 중", "그래도 빚이 줄지 않아요", PURPLE))


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=34)
    times = [cue(1, "월급을"), cue(1, "가족과"), cue(1, "직장인도")]
    num_list(frame, t, ITEMS, times, y0=720, h=140, gap=26, states=["on"] * 3)
    footnote(frame, "예시 상황입니다. 신청자 통계를 나타내지 않습니다.", t, 0.8)
    return finish(frame, 1, t, dur)


# ── 장면 3: 생활비 → 대출 → 원리금 → 다시 대출 (순환) ─────────────────
LOOP = (("월급", "coin", BLUE, -90), ("생활비 부족", "wallet", AMBER, 0), ("대출", "bank", RED, 90),
        ("원리금 부담", "receipt", RED, 180))


def scene3(t, dur):
    frame = new_frame(cy=1030, color=(239, 68, 68), alpha=26)
    cx, cy, R = CX, 1030, 250
    times = [0.2, cue(2, "생활비가"), cue(2, "대출을"), cue(2, "원리금을")]
    t_again = cue(2, "또 빌리다")
    ov, d = overlay()
    for k in range(4):
        a0 = LOOP[k][3] + 22
        a1 = LOOP[(k + 1) % 4][3] - 22 + (360 if k == 3 else 0)
        s = times[k + 1] - 0.5 if k < 3 else t_again - 0.4
        q = clamp((t - s) / 0.5)
        if q > 0:
            d.arc([cx - R, cy - R, cx + R, cy + R], a0, lerp(a0, a1, q),
                  fill=(RED if k == 3 else SLATE400) + (255,), width=8)
    frame.alpha_composite(ov)
    for k, (lab, ic, col, ang) in enumerate(LOOP):
        p = pop(t, times[k], 0.4)
        x = cx + R * math.cos(math.radians(ang))
        y = cy + R * math.sin(math.radians(ang))
        place(frame, disc_img(62, col), x, y, p, dy=0, s0=0.5)
        place(frame, icon(ic, 62, WHITE), x, y, p, dy=0, s0=0.5)
        if p > 0:
            ov, d = overlay()
            ly = y + 100 if ang != -90 else y - 100
            d.text((x, ly), lab, font=font("EB", 36), fill=WHITE + (255,), anchor="mm")
            comp(frame, ov, p)
    if t >= t_again:
        spin = (t - t_again) * 120
        place(frame, icon("hourglass", 90, SLATE300), cx, cy, pop(t, t_again, 0.4), dy=0,
              rot=math.sin(math.radians(spin)) * 12)
    return finish(frame, 2, t, dur)


# ── 장면 4: 4가지 해결 경로 (데모) ──────────────────────────────
def scene4(t, dur):
    frame = new_frame()
    hl_at = cue(3, "해결 경로")
    put_phone(frame, screen_paths(t, hl=0, hl_at=hl_at, hl_tag="소득이 있다면 검토", sub="소득·빚 구조로 비교",
                                  pop0=cue(3, "소득과") - 0.2), 0, math.sin(t * 1.3) * 5)
    chip(frame, "예시 화면", 640, 560)
    return finish(frame, 3, t, dur, z=0)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "신청할까요", "pop"), (0, "펑펑", "pop"), (1, "월급을", "pop"), (1, "가족과", "pop"), (1, "직장인도", "pop"),
       (2, "생활비가", "pop"), (2, "대출을", "pop"), (2, "원리금을", "pop"), (2, "또 빌리다", "alert"),
       (3, "해결 경로", "tick")]

META = dict(
    title="개인회생, 어떤 사람들이 신청할까?",
    desc=("개인회생은 과소비나 투자 실패로 빚진 사람만 하는 절차가 아닙니다. 매달 월급을 받고 가족과 평범하게 사는 "
          "직장인도, 생활비가 모자라 받은 대출과 그 원리금 부담이 반복되면서 신청을 검토하게 됩니다.\n"
          "비난하거나 숨길 일이 아니라, 소득과 빚의 구조를 먼저 정리하면 개인회생·개인파산·신용회복·채무자대리 중 "
          "맞는 경로를 비교할 수 있습니다. (영상 속 인물은 예시 상황입니다)"),
    feature="익명 채무 체크 > 4가지 해결 경로 비교",
    tags="#개인회생 #생계형채무 #직장인빚 #채무조정 #빚고민 #마이김변",
    comment=("주변에 회생을 준비하는 분이 있다면 비난보다 응원이 도움이 됩니다. 개인정보는 댓글에 남기지 마시고 "
             "익명 체크를 이용해 주세요."),
    related="public/guide/debt-management.html",
    slot="9주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
