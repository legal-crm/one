# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP28 렌더러
기획: docs/youtube_shorts_plan_part3.md  #28 "회생·파산 준비, 주민센터에서 뗄 서류 4가지"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep28/
실행: python scripts/shorts/render_ep28.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep28"

SCENES = [
    dict(plan=3.6, caption="회생 준비,\n[첫 서류]는?",
         narration="개인회생이나 파산을 준비할 때, 주민센터에서 먼저 떼야 할 서류들이 있어요.",
         tts="개인회생이나 파산을 준비할 때, 주민센터에서 먼저 떼야 할 서류들이 있어요."),
    dict(plan=8.0, caption="[인감증명서]\n여러 통 필요",
         narration="첫째, 인감증명서나 본인서명사실확인서 중 하나. 대리인이 서류를 대신 발급받을 때 쓰여서, 채권자 수에 따라 여러 통이 필요할 수 있어요.",
         tts="첫째, 인감증명서나 본인서명사실확인서 중 하나. 대리인이 서류를 대신 발급받을 때 쓰여서, 채권자 수에 따라 여러 통이 필요할 수 있어요."),
    dict(plan=8.0, caption="[가족·주소]\n기록 서류",
         narration="둘째, 가족관계증명서와 혼인관계증명서는 상세로. 셋째, 주민등록초본은 과거 주소가 모두 나오게 발급해 주세요.",
         tts="둘째, 가족관계증명서와 혼인관계증명서는 상세로. 셋째, 주민등록초본은 과거 주소가 모두 나오게 발급해 주세요."),
    dict(plan=9.0, caption="놓치기 쉬운\n[과세증명서]",
         narration="넷째, 지방세 세목별 과세증명서. 과거 재산을 확인하는 서류라, 보통 최근 5년치를 전국 단위로 떼야 해요. 과세 내역이 없는 지역까지 빠짐없이 요청하세요.",
         tts="넷째, 지방세 세목별 과세증명서. 과거 재산을 확인하는 서류라, 보통 최근 오 년치를 전국 단위로 떼야 해요. 과세 내역이 없는 지역까지 빠짐없이 요청하세요."),
    dict(plan=6.0, caption="[DocHub]로\n하나씩 체크",
         narration="헷갈리는 서류 목록은 마이김변 DocHub 체크리스트로 하나씩 챙기세요.",
         tts="헷갈리는 서류 목록은 마이김변 독허브 체크리스트로 하나씩 챙기세요."),
    dict(plan=5.5, caption="서류부터\n[차근차근]",
         narration="서류 준비가 시작이에요. 마이김변에서 익명으로 먼저 정리해 보세요.",
         tts="서류 준비가 시작이에요. 마이김변에서 익명으로 먼저 정리해 보세요."),
]

DOCS = (("1", "인감증명서 또는 서명확인서", "채권자 수에 따라 여러 통", BLUE),
        ("2", "가족관계·혼인관계증명서", "상세로 발급", TEAL),
        ("3", "주민등록초본", "과거 주소 전부 포함", TEAL),
        ("4", "지방세 세목별 과세증명서", "최근 5년 · 전국 단위", AMBER))


def doc_list(frame, t, n, times):
    num_list(frame, t, DOCS[:n], times, y0=630, h=128, gap=18)


# ── 장면 1: 서류 뭉치 ───────────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, alpha=36)
    for k in range(3):
        p = pop(t, 0.1 + k * 0.18, 0.4)
        doc = paper_img(460, 520, "증명서", ((None, None), (None, None), (None, None), (None, None)), accent=BLUE)
        place(frame, doc, CX - 70 + k * 70, 1030 - k * 30, p, dy=50, rot=(k - 1) * 6)
    place(frame, pill_img("주민센터에서 먼저", TEAL, 40), CX, 620, pop(t, cue(0, "주민센터에서"), 0.35), dy=-16)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 인감증명서 여러 통 ─────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    doc_list(frame, t, 1, [cue(1, "인감증명서")])
    t_n = cue(1, "채권자 수")
    if t >= t_n:
        n = 1 + min(5, int((t - t_n) / 0.22))
        for k in range(n):
            place(frame, icon("doc", 170, lerp_color(SLATE300, WHITE, k / 5)), 200 + k * 52, 1000 - k * 12,
                  pop(t, t_n + k * 0.22, 0.25), dy=20)
        place(frame, pill_img("여러 통", AMBER, 40), 720, 1000, pop(t, t_n + 0.6, 0.3), dy=0, s0=0.6)
    footnote(frame, ["필요 통수는 채권자 수와 담당 사무소 안내에 따라 다릅니다.",
                     "인감증명서와 본인서명사실확인서 중 하나를 준비합니다."], t, 0.8)
    return finish(frame, 1, t, dur)


# ── 장면 3: 가족관계·초본 ─────────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    doc_list(frame, t, 3, [-1.0, cue(2, "가족관계"), cue(2, "주민등록초본")])
    t_d, t_a = cue(2, "상세로"), cue(2, "과거 주소")
    place(frame, pill_img("상세 발급", TEAL, 36), 330, 1150, pop(t, t_d, 0.3), dy=12, s0=0.7)
    place(frame, pill_img("과거 주소 전부", TEAL, 36), 680, 1150, pop(t, t_a, 0.3), dy=12, s0=0.7)
    footnote(frame, "발급 옵션을 잘못 고르면 다시 떼야 할 수 있습니다.", t, 0.8)
    return finish(frame, 2, t, dur)


# ── 장면 4: 지방세 세목별 과세증명서 ────────────────────────────
def scene4(t, dur):
    frame = new_frame(cy=1000, color=(245, 158, 11), alpha=24)
    doc_list(frame, t, 4, [-1.0, -1.0, -1.0, cue(3, "지방세")])
    t_y, t_n, t_r = cue(3, "최근"), cue(3, "전국"), cue(3, "과세 내역이")
    place(frame, pill_img("최근 5년", AMBER, 30), 192, 1310, pop(t, t_y, 0.3), dy=12, s0=0.7)
    place(frame, pill_img("전국 단위", AMBER, 30), 424, 1310, pop(t, t_n, 0.3), dy=12, s0=0.7)
    place(frame, pill_img("과세 없는 지역 포함", RED, 30), 714, 1310, pop(t, t_r, 0.3), dy=12, s0=0.7)
    footnote(frame, ["과세 사실이 없는 지역은 '없음'으로 발급돼야 전국 자료가 됩니다.",
                     "제출 서류와 기간은 법원·사건마다 다를 수 있습니다."], t, 0.8)
    return finish(frame, 3, t, dur)


# ── 장면 5: DocHub 체크리스트 (데모) ────────────────────────────
ROWS = (("인감증명서", "채권자 수 확인 후 발급"), ("가족관계·혼인관계증명서", "상세 발급"),
        ("주민등록초본", "과거 주소 전부 포함"), ("지방세 세목별 과세증명서", "최근 5년 · 전국"))


def scene5(t, dur):
    frame = new_frame()
    marks = [cue(4, "서류 목록은"), cue(4, "마이김변"), cue(4, "체크리스트로"), cue(4, "하나씩")]
    scr = screen_checklist(t, "DocHub 서류함", "주민센터 서류", "발급한 서류를 체크하세요", ROWS, marks,
                           tag="예시 화면", result=("주민센터 서류 4건 준비", "다음 단계: 금융기관 서류"),
                           t_result=marks[-1] + 0.5)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    for k, m in enumerate(marks):
        tap(frame, 78, 290 + k * 118 + 52, t - m + 0.05)
    return finish(frame, 4, t, dur, z=0)


def scene6(t, dur):
    return endcard(t, dur)


SFX = [(0, "주민센터에서", "pop"), (1, "인감증명서", "pop"), (1, "채권자 수", "tick"), (2, "가족관계", "pop"),
       (2, "주민등록초본", "pop"), (3, "지방세", "pop"), (3, "전국", "tick"), (3, "과세 내역이", "tick"),
       (4, "서류 목록은", "tick"), (4, "마이김변", "tick"), (4, "체크리스트로", "tick"), (4, "하나씩", "tick")]

META = dict(
    title="회생·파산 준비, 주민센터에서 뗄 서류 4가지",
    desc=("개인회생·개인파산을 준비할 때 주민센터에서 먼저 발급받는 서류입니다.\n"
          "① 인감증명서 또는 본인서명사실확인서: 대리인이 서류를 대신 발급받을 때 쓰여, 채권자 수에 따라 여러 통이 필요할 수 있습니다.\n"
          "② 가족관계증명서·혼인관계증명서: 상세로 발급\n"
          "③ 주민등록초본: 과거 주소 변동 내역이 모두 나오게 발급\n"
          "④ 지방세 세목별 과세증명서: 과거 재산 확인용. 보통 최근 5년치를 전국 단위로, 과세 사실이 없는 지역까지 빠짐없이 발급\n"
          "필요 서류·통수·기간은 법원과 사건, 담당 사무소 안내에 따라 다를 수 있습니다."),
    feature="DocHub 서류함 > 주민센터 서류 체크리스트",
    tags="#개인회생서류 #개인파산서류 #주민센터 #과세증명서 #DocHub #마이김변",
    comment=("과세증명서는 '과세 사실 없음' 지역도 함께 있어야 전국 자료가 됩니다. 발급 전 담당 사무소에 필요한 통수와 "
             "옵션을 먼저 확인하세요."),
    related="public/guide/personal-rehabilitation.html",
    slot="11주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5, scene6], META, SFX)


if __name__ == "__main__":
    main()
