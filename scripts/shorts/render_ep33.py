# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP33 렌더러
기획: docs/youtube_shorts_plan_part3.md  #33 "2030 빚, 왜 이렇게 쉽게 불어날까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep33/
실행: python scripts/shorts/render_ep33.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep33"

SCENES = [
    dict(plan=3.4, caption="2030 빚,\n[왜 쉽게 늘까?]",
         narration="요즘 2030 세대가 빚에 쉽게 빠지는 이유, 뭘까요?",
         tts="요즘 이공삼공 세대가 빚에 쉽게 빠지는 이유, 뭘까요?"),
    dict(plan=7.0, caption="버튼 몇 번에\n[대출 실행]",
         narration="카드론, 리볼빙, 비상금 대출. 앱에서 버튼 몇 번이면 돈이 바로 들어오죠.",
         tts="카드론, 리볼빙, 비상금 대출. 앱에서 버튼 몇 번이면 돈이 바로 들어오죠."),
    dict(plan=8.0, caption="[리볼빙]의\n함정",
         narration="특히 리볼빙은 이번 달 카드값 일부를 미루는 대신, 높은 이자가 붙은 채 다음 달로 계속 넘어가요.",
         tts="특히 리볼빙은 이번 달 카드값 일부를 미루는 대신, 높은 이자가 붙은 채 다음 달로 계속 넘어가요."),
    dict(plan=7.5, caption="돌려막기 전\n[구조 점검]",
         narration="빚으로 빚을 막기 시작했다면, 금리와 잔액부터 한눈에 정리해 보는 게 먼저예요.",
         tts="빚으로 빚을 막기 시작했다면, 금리와 잔액부터 한눈에 정리해 보는 게 먼저예요."),
    dict(plan=6.0, caption="클릭 전에\n[한 번 더]",
         narration="빚이 빚을 부르기 전에 멈춰 보세요. 마이김변에서 익명으로 먼저 정리할 수 있어요.",
         tts="빚이 빚을 부르기 전에 멈춰 보세요. 마이김변에서 익명으로 먼저 정리할 수 있어요."),
]


# ── 장면 1: 휴대폰 주변을 도는 대출 상품 ──────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(59, 130, 246), alpha=36)
    hero(frame, t, "phone", BLUE, cx=CX, cy=1000, r=150, t0=0.05)
    t0 = cue(0, "빚에")
    for k, lab in enumerate(("카드론", "리볼빙", "비상금 대출")):
        a = math.radians(-150 + k * 120 + t * 25)
        x, y = CX + 290 * math.cos(a), 1000 + 250 * math.sin(a)
        x = min(x, 800)
        place(frame, pill_img(lab, AMBER, 34), x, y, pop(t, t0 + k * 0.15, 0.3), dy=0, s0=0.6)
    return finish(frame, 0, t, dur, z=0.06)


# ── 장면 2: 간편 대출 앱 (데모) ──────────────────────────────
def screen_loan(t, t_btn, t_toast):
    s = Scr(SLATE50)
    s_header(s, "간편 대출")
    s.text(36, 200, "비상금 대출", 34, SLATE900, "EB", "lm")
    s_tag(s, SW - 36, 182, "예시 화면", SLATE200, SLATE700, 19, 36, anchor="r")
    s.rr(28, 240, SW - 28, 480, 30, fill=NAVY)
    s.text(60, 290, "한도 조회 완료", 22, SLATE300, "B", "lm")
    s.text(60, 360, "○○○만 원", 54, WHITE, "EB", "lm")
    s.text(60, 430, "서류 없이 · 1분 만에", 21, TEAL_L, "B", "lm")
    for k, (lab, val) in enumerate((("금리", "연 ○○%"), ("상환 방식", "만기 일시"), ("입금 계좌", "내 통장"))):
        y = 520 + k * 90
        s.text(40, y + 30, lab, 23, SLATE500, "B", "lm")
        s.text(SW - 40, y + 30, val, 25, SLATE900, "EB", "rm")
        s.line([(36, y + 70), (SW - 36, y + 70)], SLATE200, 2)
    pressed = t_btn <= t < t_btn + 0.25
    s_button(s, 1004, "바로 받기", "pressed" if pressed else "on", h=92)
    s_toast(s, t, t_toast, "입금 완료", "내 통장으로 바로 들어왔어요", color=BLUE, kind="coin")
    return s.final()


def scene2(t, dur):
    frame = new_frame()
    t_btn = cue(1, "버튼")
    t_toast = cue(1, "들어오죠")
    put_phone(frame, screen_loan(t, t_btn, t_toast), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 1050, t - t_btn)
    return finish(frame, 1, t, dur, z=0)


# ── 장면 3: 리볼빙 이월이 쌓인다 ─────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=26)
    t0 = cue(2, "이번 달")
    t_int = cue(2, "높은 이자가")
    t_next = cue(2, "다음 달로")
    base_y = 1310
    ov, d = overlay()
    d.line([(X0 + 10, base_y), (X1 - 10, base_y)], fill=SLATE400 + (255,), width=4)
    for k in range(5):
        p = ease_out(clamp((t - (t0 if k == 0 else t_next + (k - 1) * 0.35)) / 0.4))
        if p <= 0:
            continue
        x = 130 + k * 158
        carry = (90 + k * 70) * p
        inter = (30 + k * 26) * p * (1 if t >= t_int else 0)
        d.rounded_rectangle([x, base_y - carry, x + 110, base_y], 14, fill=AMBER + (255,))
        if inter > 1:
            d.rounded_rectangle([x, base_y - carry - inter - 6, x + 110, base_y - carry - 6], 14, fill=RED + (255,))
        d.text((x + 55, base_y + 38), f"{k + 1}개월", font=font("B", 28), fill=SLATE300 + (255,), anchor="mm")
    frame.alpha_composite(ov)
    ov, d = overlay()
    d.rounded_rectangle([X0, 700, X0 + 28, 728], 8, fill=AMBER + (255,))
    d.text((X0 + 42, 714), "미룬 카드값", font=font("B", 30), fill=WHITE + (255,), anchor="lm")
    d.rounded_rectangle([X0 + 300, 700, X0 + 328, 728], 8, fill=RED + (255,))
    d.text((X0 + 342, 714), "붙는 이자", font=font("B", 30), fill=WHITE + (255,), anchor="lm")
    comp(frame, ov, pop(t, t0, 0.4))
    place(frame, pill_img("계속 넘어가요", RED, 34), 330, 800, pop(t, t_next + 0.8, 0.3), dy=10)
    footnote(frame, "리볼빙 금리·조건은 카드사 약관과 개인 신용도에 따라 다릅니다.", t, 0.8, y=1458)
    return finish(frame, 2, t, dur)


# ── 장면 4: 익명 채무 체크 — 채무 구조 정리 (데모) ─────────────────────
ROWS = (("카드론", "금리·잔액 입력"), ("리볼빙", "이월 잔액 확인"), ("비상금 대출", "만기일 확인"), ("카드 할부", "남은 회차 확인"))


def scene4(t, dur):
    frame = new_frame()
    marks = [cue(3, "빚으로"), cue(3, "금리와"), cue(3, "잔액부터"), cue(3, "한눈에")]
    scr = screen_checklist(t, "익명 채무 체크", "내 채무 정리", "금리와 잔액을 한눈에", ROWS, marks, tag="예시 화면",
                           result=("채무 4건 정리 완료", "월 상환액 합계를 한눈에"), t_result=marks[-1] + 0.6)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    for k, m in enumerate(marks):
        tap(frame, 78, 290 + k * 118 + 52, t - m + 0.05)
    return finish(frame, 3, t, dur, z=0)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "빚에", "pop"), (1, "버튼", "tick"), (1, "들어오죠", "ding"), (2, "이번 달", "pop"), (2, "높은 이자가", "alert"),
       (2, "다음 달로", "pop"), (3, "빚으로", "tick"), (3, "금리와", "tick"), (3, "잔액부터", "tick"), (3, "한눈에", "tick")]

META = dict(
    title="2030 빚, 왜 이렇게 쉽게 불어날까?",
    desc=("카드론, 리볼빙, 비상금 대출처럼 앱에서 버튼 몇 번이면 실행되는 대출이 많아지면서 빚이 쉽게 불어나기도 합니다.\n"
          "특히 리볼빙은 이번 달 카드값 일부를 미루는 대신 이자가 붙은 채 다음 달로 넘어가, 잔액이 계속 커질 수 있습니다.\n"
          "빚으로 빚을 막기 시작했다면 금리와 잔액부터 한눈에 정리해 보세요. 금리·조건은 금융회사 약관과 개인 신용도에 따라 다릅니다."),
    feature="익명 채무 체크 > 채무 목록 정리 (금리·잔액·월 상환액)",
    tags="#2030빚 #리볼빙 #카드론 #비상금대출 #돌려막기 #마이김변",
    comment=("리볼빙 약정 여부는 카드사 앱이나 명세서에서 확인할 수 있습니다. 개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/articles/crypto-stock-debt.html",
    slot="13주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
