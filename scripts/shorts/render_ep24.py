# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP24 렌더러
기획: docs/youtube_shorts_plan_part3.md  #24 "파산 면책 받은 뒤, 꼭 챙길 3가지"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep24/
실행: python scripts/shorts/render_ep24.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep24"

SCENES = [
    dict(plan=3.4, caption="파산 면책 후,\n[끝일까요?]",
         narration="개인파산 면책 결정을 받았다면, 이제 신경 쓸 일은 없을까요?",
         tts="개인파산 면책 결정을 받았다면, 이제 신경 쓸 일은 없을까요?"),
    dict(plan=7.0, caption="첫째, 압류는\n[따로 해제]",
         narration="첫째, 이미 들어와 있던 압류나 가압류는 저절로 풀리지 않을 수 있어요. 해제 절차를 따로 밟아야 합니다.",
         tts="첫째, 이미 들어와 있던 압류나 가압류는 저절로 풀리지 않을 수 있어요. 해제 절차를 따로 밟아야 합니다."),
    dict(plan=8.0, caption="둘째, 빠진 빚\n[바로 갚지 말기]",
         narration="둘째, 목록에서 빠진 빚으로 연락이 와도 바로 갚지 마세요. 고의로 빠뜨린 게 아니라면 면책 효력을 다툴 수 있어요.",
         tts="둘째, 목록에서 빠진 빚으로 연락이 와도 바로 갚지 마세요. 고의로 빠뜨린 게 아니라면 면책 효력을 다툴 수 있어요."),
    dict(plan=7.0, caption="셋째, 새 재산\n[모아도 돼요]",
         narration="셋째, 면책 뒤에 열심히 일해서 모은 돈과 재산은 문제 되지 않아요. 새로 시작하셔도 됩니다.",
         tts="셋째, 면책 뒤에 열심히 일해서 모은 돈과 재산은 문제 되지 않아요. 새로 시작하셔도 됩니다."),
    dict(plan=6.0, caption="면책 이후도\n[차근차근]",
         narration="면책 이후도 차근차근 챙기면 됩니다. 궁금한 점은 마이김변에서 익명으로 확인해 보세요.",
         tts="면책 이후도 차근차근 챙기면 됩니다. 궁금한 점은 마이김변에서 익명으로 확인해 보세요."),
]

TOP = (("1", "압류·가압류 해제", "", TEAL), ("2", "빠진 빚 연락 대응", "", AMBER), ("3", "새 재산 형성", "", BLUE))


def top_list(frame, t, k):
    """상단 누적 체크리스트 (현재 항목만 강조)"""
    items = [(n, ti, "", c) for n, ti, _, c in TOP[:k + 1]]
    times = [-1.0] * k + [0.15]
    num_list(frame, t, items, times, y0=600, h=100, gap=16)


# ── 장면 1: 면책 결정문 → "끝?" ─────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(13, 148, 136), alpha=34)
    doc = paper_img(560, 600, "면책 결정", (("채무자", "단단한 바위 71"), ("주문", "면책을 허가한다"),
                                        (None, None), (None, None)), accent=TEAL, note="예시")
    place(frame, doc, CX, 1010, pop(t, 0.0, 0.4), dy=40)
    t_st = cue(0, "결정을")
    stamp_in(frame, stamp_img("면책", TEAL, 200, 200, -12, 64, circle=True), CX + 150, 1180, t, t_st)
    place(frame, pill_img("이제 끝일까?", AMBER, 40), CX, 612, pop(t, cue(0, "신경"), 0.35), dy=-20, s0=0.8)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 압류는 따로 해제 ───────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1100, alpha=32)
    top_list(frame, t, 0)
    t_a, t_b = cue(1, "압류나"), cue(1, "해제 절차")
    place(frame, vcard_img(330, 290, "통장·급여", "압류 그대로", "lock", RED), 290, 1130, pop(t, t_a, 0.4), s0=0.9)
    place(frame, icon("arrow", 70, SLATE300), CX, 1130, pop(t, t_b - 0.2, 0.3), dy=0)
    place(frame, vcard_img(330, 290, "해제 신청", "따로 진행", "doc", TEAL, fill=CARD_HL, owidth=5), 718, 1130,
          pop(t, t_b, 0.4), s0=0.9)
    t_n = cue(1, "저절로")
    place(frame, pill_img("자동으로 안 풀릴 수 있음", SLATE700, 30), 290, 1320, pop(t, t_n, 0.3), dy=12)
    footnote(frame, "해제 절차는 압류 종류·집행 기관에 따라 다를 수 있습니다.", t, 0.8)
    return finish(frame, 1, t, dur)


# ── 장면 3: 빠진 빚 연락 → 바로 갚지 않기 ──────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1100, color=(245, 158, 11), alpha=26)
    top_list(frame, t, 1)
    t_call = cue(2, "연락이")
    p = pop(t, t_call, 0.4)
    dx, _ = shake_xy(t, t_call, 10, 0.5)
    place(frame, card_img(828, 150, "예전 대출, 지금 갚으세요", "알 수 없는 채권자 · 예시", "phone", RED, fill=(58, 30, 40)),
          CX + dx, 1010, p, dy=-30)
    t_no = cue(2, "갚지 마세요")
    place(frame, pill_img("바로 입금 X", RED, 36), 290, 1150, pop(t, t_no, 0.3), dy=10, s0=0.7)
    t_ok = cue(2, "면책 효력")
    place(frame, card_img(828, 130, "면책 효력을 다툴 수 있어요", "고의 누락이 아니라면", "shield", TEAL, fill=CARD_HL),
          CX, 1290, pop(t, t_ok, 0.4))
    footnote(frame, "악의로 채권자 목록에서 뺀 채권은 면책되지 않을 수 있습니다.", t, 0.8)
    return finish(frame, 2, t, dur)


# ── 장면 4: 새 재산 형성 가능 ──────────────────────────────
def scene4(t, dur):
    frame = new_frame(cy=1100, color=(59, 130, 246), alpha=40)
    top_list(frame, t, 2)
    t_up = cue(3, "모은 돈")
    q = clamp((t - t_up) / 1.6)
    ov, d = overlay()
    base_y = 1380
    for k in range(5):
        h = (70 + k * 55) * ease_out(clamp(q * 5 - k))
        x = 200 + k * 130
        if h > 1:
            d.rounded_rectangle([x, base_y - h, x + 90, base_y], 16, fill=lerp_color(BLUE, TEAL, k / 4) + (255,))
    frame.alpha_composite(ov)
    place(frame, icon("chart_up", 120, WHITE), 820, 1000, pop(t, t_up + 0.6, 0.4), dy=0, s0=0.6)
    place(frame, pill_img("새로 시작해도 돼요", TEAL, 36), 330, 1000, pop(t, cue(3, "새로"), 0.35), dy=16)
    footnote(frame, "면책 후 새로 얻은 소득·재산은 종전 파산 절차와 별개로 봅니다.", t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "결정을", "thump"), (0, "신경", "pop"), (1, "압류나", "pop"), (1, "해제 절차", "pop"),
       (2, "연락이", "alert"), (2, "갚지 마세요", "pop"), (2, "면책 효력", "ding"), (3, "모은 돈", "pop"),
       (3, "새로", "pop")]

META = dict(
    title="파산 면책 받은 뒤, 꼭 챙길 3가지",
    desc=("개인파산 면책 결정 뒤에도 챙길 것이 있습니다.\n"
          "① 이미 들어와 있던 압류·가압류는 저절로 풀리지 않을 수 있어 해제 절차를 따로 밟아야 합니다.\n"
          "② 채권자 목록에서 빠진 빚으로 연락이 와도 바로 갚지 마세요. 악의로 누락한 경우가 아니라면 면책 효력을 다툴 수 있습니다.\n"
          "③ 면책 뒤 일해서 모은 돈과 재산은 문제 되지 않습니다.\n"
          "구체적인 대응은 사건마다 다를 수 있습니다."),
    feature="익명 채무 체크 · 가명 상담방 (면책 후 궁금한 점 질문)",
    tags="#개인파산 #파산면책 #압류해제 #면책확인 #새출발 #마이김변",
    comment=("면책 후 누락 채권으로 연락이 오면 면책 결정문 사본을 준비해 선택한 변호사와 대응 방법을 상의하세요. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/guide/bankruptcy.html",
    slot="10주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
