# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP21 렌더러
기획: docs/youtube_shorts_plan_part3.md  #21 "개인파산, 면책 못 받으면 다시 신청하면 될까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep21/
실행: python scripts/shorts/render_ep21.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep21"

SCENES = [
    dict(plan=3.2, caption="면책 불허가,\n[다시 신청?]",
         narration="개인파산에서 면책을 못 받으면, 다시 신청하면 될까요?",
         tts="개인파산에서 면책을 못 받으면, 다시 신청하면 될까요?"),
    dict(plan=7.0, caption="같은 빚으론\n[어려워요]",
         narration="판례는 분명해요. 같은 빚, 같은 이유로 다시 파산과 면책을 신청하는 건 받아들여지기 어렵습니다.",
         tts="판례는 분명해요. 같은 빚, 같은 이유로 다시 파산과 면책을 신청하는 건 받아들여지기 어렵습니다."),
    dict(plan=7.0, caption="선고 뒤엔\n[취하 불가]",
         narration="게다가 파산 선고가 난 뒤에는 신청을 취하할 수도 없어요. 한 번의 기회가 그대로 지나갈 수 있습니다.",
         tts="게다가 파산 선고가 난 뒤에는 신청을 취하할 수도 없어요. 한 번의 기회가 그대로 지나갈 수 있습니다."),
    dict(plan=8.0, caption="[면책 가능성]\n먼저 확인",
         narration="그래서 신청 전에 면책 불허가 사유부터 따져 봐야 해요. 재산, 채권자 목록, 지출, 이전 면책 이력까지요.",
         tts="그래서 신청 전에 면책 불허가 사유부터 따져 봐야 해요. 재산, 채권자 목록, 지출, 이전 면책 이력까지요."),
    dict(plan=6.0, caption="서두르기 전에\n[먼저 점검]",
         narration="한 번뿐일 수 있는 기회예요. 서두르기 전에, 마이김변에서 익명으로 먼저 점검해 보세요.",
         tts="한 번뿐일 수 있는 기회예요. 서두르기 전에, 마이김변에서 익명으로 먼저 점검해 보세요."),
]


# ── 장면 1: 면책 불허가 도장 → "다시?" ──────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=34)
    doc = paper_img(560, 620, "면책 신청서", (("신청인", "단단한 바위 71"), ("사건", "20XX하단 0000"),
                                          (None, None), (None, None), (None, None)), note="예시")
    place(frame, doc, CX, 1010, pop(t, 0.0, 0.4), dy=40)
    t_st = cue(0, "못 받으면")
    dx, dy = shake_xy(t, t_st + 0.1)
    stamp_in(frame, stamp_img("면책 불허가", RED, 380, 130, -9, 58), CX + 30 + dx, 1180 + dy, t, t_st)
    t_q = cue(0, "다시")
    place(frame, pill_img("다시 신청하면 될까?", AMBER, 40), CX, 655, pop(t, t_q, 0.35), dy=-20, s0=0.8)
    frame = zoom_rgba(frame, 1.0 + 0.08 * ease_in_out(t / dur), CX, 1100)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 같은 빚 재신청 제한 ──────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=950, alpha=36)
    t0 = cue(1, "같은 빚")
    t1 = cue(1, "다시 파산")
    t2 = cue(1, "받아들여지기")
    place(frame, vcard_img(360, 300, "1차 신청", "면책 불허가", "doc", RED), 290, 820, pop(t, 0.2, 0.4), s0=0.9)
    place(frame, icon("arrow", 70, SLATE300), CX, 820, pop(t, t0, 0.3), dy=0)
    place(frame, vcard_img(360, 300, "다시 신청", "같은 빚·같은 원인", "doc", SLATE500), 718, 820,
          pop(t, t1, 0.4), s0=0.9)
    if t >= t2:
        p = pop(t, t2, 0.3)
        place(frame, disc_img(34, RED, False), 870, 690, p, dy=0, s0=0.4)
        place(frame, icon("x", 32, WHITE), 870, 690, p, dy=0, s0=0.4)
        place(frame, pill_img("재신청 어려움", RED, 32), 718, 1010, p, dy=16)
    hero(frame, t, "gavel", NAVY, cx=CX, cy=1220, r=86, t0=cue(1, "판례"), pulse=False, glow=40)
    place(frame, pill_img("판례 취지", SLATE700, 30), CX, 1340, pop(t, cue(1, "분명해요"), 0.3), dy=10)
    footnote(frame, ["근거: 재도의 파산·면책 신청에 관한 대법원 판례 취지.",
                     "구체적인 판단은 사건마다 다를 수 있습니다."], t, 0.6)
    return finish(frame, 1, t, dur)


# ── 장면 3: 절차 흐름 — 선고 뒤 취하 불가 ─────────────────────────
STEPS = (("파산 신청", "서류 제출", "doc", BLUE), ("파산 선고", "이후 신청 취하 불가", "gavel", AMBER),
         ("면책 심리", "불허가 사유 검토", "search", BLUE), ("면책 결정", "허가 또는 불허가", "check", TEAL))


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=34)
    times = [0.2, cue(2, "파산 선고"), cue(2, "한 번의"), cue(2, "지나갈")]
    vtimeline(frame, t, STEPS, times, x=190, y0=690, gap=190)
    t_lock = cue(2, "취하할")
    if t >= t_lock:
        p = pop(t, t_lock, 0.3)
        place(frame, disc_img(30, RED, False), 505, 856, p, dy=0, s0=0.4)
        place(frame, icon("lock", 32, WHITE), 505, 854, p, dy=0, s0=0.4)
    footnote(frame, "절차와 판단 기준은 법원·사건마다 다를 수 있습니다.", t, 0.8)
    return finish(frame, 2, t, dur)


# ── 장면 4: 익명 채무 체크 — 면책 전 확인 (데모) ─────────────────────
ROWS = (("재산 숨기거나 넘긴 적 없음", "명의 이전·처분 내역 포함"), ("채권자 목록 빠짐없이", "가족·지인에게 빌린 돈 포함"),
        ("낭비·도박 지출 정리", "최근 지출 내역 확인"), ("이전 면책 이력 확인", "파산 면책 후 7년 기준"))


def scene4(t, dur):
    frame = new_frame()
    marks = [cue(3, "재산"), cue(3, "채권자"), cue(3, "지출"), cue(3, "이력")]
    t_res = marks[-1] + 0.6
    scr = screen_checklist(t, "익명 채무 체크", "면책 전 확인", "해당 항목은 변호사와 먼저 검토", ROWS, marks,
                           tag="예시 화면", result=("점검 내용 정리 완료", "선택한 변호사에게 가명으로 전달"),
                           t_result=t_res)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    for k, m in enumerate(marks):
        tap(frame, 78, 290 + k * 118 + 52, t - m + 0.05)
    return finish(frame, 3, t, dur, z=0)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "못 받으면", "thump"), (0, "다시", "pop"), (1, "다시 파산", "pop"), (1, "받아들여지기", "thump"),
       (2, "파산 선고", "pop"), (2, "취하할", "thump"), (2, "한 번의", "pop"), (2, "지나갈", "pop"),
       (3, "재산", "tick"), (3, "채권자", "tick"), (3, "지출", "tick"), (3, "이력", "tick")]

META = dict(
    title="개인파산, 면책 못 받으면 다시 신청하면 될까?",
    desc=("개인파산에서 면책이 허가되지 않은 뒤, 같은 채무·같은 파산 원인으로 다시 파산과 면책을 신청하는 이른바 "
          "'재도의 신청'은 판례상 받아들여지기 어렵습니다. 또 파산 선고가 난 뒤에는 신청을 취하할 수 없습니다.\n"
          "그래서 신청 전에 재산 처분, 채권자 목록 누락, 낭비·도박 지출, 이전 면책 이력 같은 면책 불허가 사유가 "
          "있는지부터 확인하는 것이 중요합니다. 구체적인 판단은 사건마다 다를 수 있습니다."),
    feature="익명 채무 체크 > 면책 전 확인 항목 정리 → 선택한 변호사와 검토",
    tags="#개인파산 #면책불허가 #재도의파산 #파산면책 #채무상담 #마이김변",
    comment=("면책 불허가 사유는 재산·지출·채권자 목록 등 사건 전체를 보고 판단합니다. 신청 전에 선택한 변호사와 "
             "자료를 함께 점검하세요. 개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/guide/bankruptcy.html",
    slot="9주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
