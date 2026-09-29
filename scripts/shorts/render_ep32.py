# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP32 렌더러
기획: docs/youtube_shorts_plan_part3.md  #32 "연체 전에도 개인회생 할 수 있을까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep32/
실행: python scripts/shorts/render_ep32.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep32"

SCENES = [
    dict(plan=3.4, caption="카드값 연체,\n[몇 번부터?]",
         narration="카드값이 몇 번 밀려야 개인회생을 할 수 있을까요?",
         tts="카드값이 몇 번 밀려야 개인회생을 할 수 있을까요?"),
    dict(plan=7.5, caption="연체 전에도\n[신청 가능]",
         narration="연체가 없어도 신청할 수 있어요. 앞으로 갚기 어려운 상황이 분명하다면 요건이 될 수 있습니다.",
         tts="연체가 없어도 신청할 수 있어요. 앞으로 갚기 어려운 상황이 분명하다면 요건이 될 수 있습니다."),
    dict(plan=6.5, caption="연체가 시작되면\n[독촉도 시작]",
         narration="연체가 시작되면 독촉과 추심이 따라오고, 마음도 빠르게 지치게 돼요.",
         tts="연체가 시작되면 독촉과 추심이 따라오고, 마음도 빠르게 지치게 돼요."),
    dict(plan=8.5, caption="[금지명령]으로\n추심 멈추기",
         narration="미리 준비해서 신청하면, 금지명령이 나온 뒤에는 강제집행과 추심이 멈춘 상태에서 절차를 밟을 수 있어요.",
         tts="미리 준비해서 신청하면, 금지명령이 나온 뒤에는 강제집행과 추심이 멈춘 상태에서 절차를 밟을 수 있어요."),
    dict(plan=6.0, caption="밀리기 전에\n[먼저 점검]",
         narration="밀리기 전이 가장 여유 있는 때예요. 마이김변 익명 체크로 지금 상황부터 확인해 보세요.",
         tts="밀리기 전이 가장 여유 있는 때예요. 마이김변 익명 체크로 지금 상황부터 확인해 보세요."),
]

MONTHS = ("1월", "2월", "3월", "4월", "5월", "6월")


def months(frame, t, times, bad_from=None, y=880):
    """월별 납부 칩. times: 칩별 등장 시점, bad_from 이후 칩은 연체 표시"""
    for k, lab in enumerate(MONTHS):
        if t < times[k]:
            continue
        p = pop(t, times[k], 0.3)
        bad = bad_from is not None and k >= bad_from
        x = X0 + 59 + k * 142
        col = RED if bad else TEAL
        ov, d = overlay()
        d.rounded_rectangle([x - 59, y - 90, x + 59, y + 90], 24, fill=((58, 30, 40) if bad else CARD) + (255,),
                            outline=col + (255,), width=3)
        d.text((x, y - 44), lab, font=font("EB", 32), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, p, (0, (1 - p) * 20))
        place(frame, disc_img(30, col, False), x, y + 30, p, dy=0, s0=0.4)
        place(frame, icon("x" if bad else "check", 30, WHITE), x, y + 30, p, dy=0, s0=0.4)


# ── 장면 1: 달력 + 몇 번? ─────────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=28)
    hero(frame, t, "calendar", NAVY, cx=CX, cy=980, r=160, t0=0.05, glow=40)
    t_q = cue(0, "몇 번")
    for k in range(3):
        place(frame, disc_img(34, RED, False), CX - 90 + k * 90, 1210, pop(t, t_q + k * 0.18, 0.25), dy=0, s0=0.3)
        place(frame, icon("x", 32, WHITE), CX - 90 + k * 90, 1210, pop(t, t_q + k * 0.18, 0.25), dy=0, s0=0.3)
    place(frame, pill_img("?", AMBER, 56, pad=26, h=96), CX + 150, 830, pop(t, cue(0, "할 수"), 0.3), dy=0, s0=0.4)
    return finish(frame, 0, t, dur, z=0.07)


# ── 장면 2: 정상 납부 중에도 신청 가능 ─────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    months(frame, t, [0.15 + k * 0.12 for k in range(6)])
    place(frame, pill_img("연체가 없어도 검토 가능", TEAL, 38), CX, 1060, pop(t, cue(1, "신청할"), 0.35), dy=14)
    place(frame, card_img(828, 140, "앞으로 갚기 어려운 상황", "파산 원인이 생길 염려도 요건이 될 수 있어요", "warn", AMBER),
          CX, 1230, pop(t, cue(1, "앞으로"), 0.4))
    footnote(frame, ["근거: 채무자회생법 제579조 (파산 원인 사실이 생길 염려가 있는 경우 포함).",
                     "요건 충족 여부는 법원이 판단합니다."], t, 0.8)
    return finish(frame, 1, t, dur)


# ── 장면 3: 연체 → 독촉·추심 ──────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=30)
    t_s = cue(2, "연체가")
    months(frame, t, [-1.0] * 3 + [t_s + k * 0.2 for k in range(3)], bad_from=3)
    for k, (title, sub, key) in enumerate((("연체 안내", "카드사 · 예시", "독촉과"), ("추심 연락", "채권추심 · 예시", "추심이"))):
        t0 = cue(2, key)
        dx, _ = shake_xy(t, t0, 10, 0.4)
        place(frame, card_img(828, 130, title, sub, "phone", RED, fill=(58, 30, 40)), CX + dx, 1100 + k * 150,
              pop(t, t0, 0.35), dy=-30)
    return finish(frame, 2, t, dur)


# ── 장면 4: 금지명령 방패 ───────────────────────────────
def scene4(t, dur):
    frame = new_frame(cy=1000, color=(13, 148, 136), alpha=36)
    t_sh = cue(3, "금지명령이")
    t_stop = cue(3, "멈춘")
    hero(frame, t, "shield", TEAL, cx=CX, cy=1000, r=150, t0=t_sh)
    for k, (lab, x0, y0) in enumerate((("추심", 170, 760), ("강제집행", 800, 760), ("독촉", 170, 1240))):
        a = pop(t, 0.2 + k * 0.15, 0.3)
        if t >= t_stop:
            a *= 1 - clamp((t - t_stop) / 0.6)
        e = 0.22 * ease_in_out(clamp((t - t_sh) / max(0.1, t_stop - t_sh)))
        place(frame, pill_img(lab, RED, 32), lerp(x0, CX, e), lerp(y0, 1000, e), a, dy=0)
    place(frame, pill_img("금지명령 · 법원 결정", SLATE900, 32, fg=TEAL_L), CX, 1290, pop(t, t_sh + 0.3, 0.3), dy=12)
    footnote(frame, ["금지명령 발령 여부와 효력 범위는 법원이 판단합니다.",
                     "신청 준비는 담당 변호사와 함께 확인하세요."], t, 0.8)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "몇 번", "tick"), (0, "할 수", "pop"), (1, "신청할", "ding"), (1, "앞으로", "pop"), (2, "연체가", "alert"),
       (2, "독촉과", "alert"), (2, "추심이", "alert"), (3, "금지명령이", "thump"), (3, "멈춘", "ding")]

META = dict(
    title="연체 전에도 개인회생 할 수 있을까?",
    desc=("개인회생은 연체가 없어도 신청할 수 있습니다. 앞으로 갚기 어려운 상황이 분명한 경우, 즉 파산 원인 사실이 생길 "
          "염려가 있는 경우도 요건이 될 수 있습니다(채무자회생법 제579조).\n"
          "연체가 시작되면 독촉과 추심이 따라옵니다. 미리 준비해 신청하면 금지명령이 나온 뒤에는 강제집행과 추심이 멈춘 상태에서 "
          "절차를 밟을 수 있습니다. 금지명령 발령 여부와 요건 충족 여부는 법원이 판단합니다."),
    feature="익명 채무 체크 > 현재 상황 점검 (연체 여부·월 상환액)",
    tags="#개인회생 #연체전 #금지명령 #카드값연체 #추심중단 #마이김변",
    comment=("연체를 일부러 만들 필요는 없습니다. 월 상환액과 소득을 정리해 선택한 변호사와 신청 시점을 상의하세요. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/articles/debt-collection-defense.html",
    slot="12주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
