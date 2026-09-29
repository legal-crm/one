# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP30 렌더러
기획: docs/youtube_shorts_plan_part3.md  #30 "개인회생, 신청 전에 걸러지는 4가지"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep30/
실행: python scripts/shorts/render_ep30.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402

EP = "ep30"

SCENES = [
    dict(plan=3.8, caption="신청해도\n[기각될 수도?]",
         narration="개인회생, 신청해도 바로 기각될 수 있는 경우가 있어요. 네 가지만 먼저 확인하세요.",
         tts="개인회생, 신청해도 바로 기각될 수 있는 경우가 있어요. 네 가지만 먼저 확인하세요."),
    dict(plan=7.5, caption="첫째,\n[채무 한도]",
         narration="첫째, 금액 한도예요. 담보 없는 빚은 10억 원, 담보 있는 빚은 15억 원 이하여야 신청할 수 있어요.",
         tts="첫째, 금액 한도예요. 담보 없는 빚은 십억 원, 담보 있는 빚은 십오억 원 이하여야 신청할 수 있어요."),
    dict(plan=7.5, caption="둘째, 재산보다\n[빚이 많게]",
         narration="둘째, 재산보다 빚이 많아야 해요. 다만 임차보증금 일부 공제처럼 재산 계산이 조정되는 부분도 있어요.",
         tts="둘째, 재산보다 빚이 많아야 해요. 다만 임차보증금 일부 공제처럼 재산 계산이 조정되는 부분도 있어요."),
    dict(plan=9.0, caption="셋째 소득,\n[넷째 면책 이력]",
         narration="셋째, 계속 들어오는 소득이 있어야 해요. 지금 막 일을 시작했어도 검토될 수 있고요. 넷째, 최근 5년 안에 면책받은 적이 없어야 합니다.",
         tts="셋째, 계속 들어오는 소득이 있어야 해요. 지금 막 일을 시작했어도 검토될 수 있고요. 넷째, 최근 오 년 안에 면책받은 적이 없어야 합니다."),
    dict(plan=6.5, caption="4가지부터\n[익명 체크]",
         narration="신청 전에 이 네 가지부터 확인해 보세요. 마이김변 익명 체크로 한 번에 정리할 수 있어요.",
         tts="신청 전에 이 네 가지부터 확인해 보세요. 마이김변 익명 체크로 한 번에 정리할 수 있어요."),
    dict(plan=5.5, caption="기각 전에\n[먼저 점검]",
         narration="번호 남기기 전에, 익명으로 먼저 확인하세요. 마이김변이 함께 챙깁니다.",
         tts="번호 남기기 전에, 익명으로 먼저 확인하세요. 마이김변이 함께 챙깁니다."),
]


@lru_cache(maxsize=None)
def stat_img(w, h, label, value, unit, color):
    S = 2
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 32 * S, fill=CARD_HL + (255,), outline=color + (255,), width=4 * S)
    d.text((w / 2 * S, 58 * S), label, font=font("B", 32 * S), fill=SLATE200, anchor="mm")
    d.text((w / 2 * S, (h / 2 + 14) * S), value, font=font("EB", 112 * S), fill=WHITE, anchor="mm")
    d.text((w / 2 * S, (h - 50) * S), unit, font=font("B", 32 * S), fill=color, anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


# ── 장면 1: 네 개의 관문 ─────────────────────────────────
def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=28)
    hero(frame, t, "search", BLUE, cx=CX, cy=940, r=150, t0=0.05)
    t4 = cue(0, "네 가지만")
    for k in range(4):
        x = 180 + k * 216
        place(frame, disc_img(56, [RED, AMBER, TEAL, BLUE][k]), x, 1250, pop(t, t4 + k * 0.12, 0.3), dy=0, s0=0.4)
        ov, d = overlay()
        d.text((x, 1250), str(k + 1), font=font("EB", 56), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, pop(t, t4 + k * 0.12, 0.3))
    return finish(frame, 0, t, dur, z=0.06)


# ── 장면 2: 채무 한도 ───────────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=34)
    place(frame, stat_img(390, 360, "담보 없는 빚", "10억", "원 이하", TEAL), 290, 900,
          pop(t, cue(1, "담보 없는"), 0.45), s0=0.85)
    place(frame, stat_img(390, 360, "담보 있는 빚", "15억", "원 이하", BLUE), 718, 900,
          pop(t, cue(1, "담보 있는"), 0.45), s0=0.85)
    place(frame, pill_img("넘으면 개인회생 신청 불가", RED, 32), CX, 1170, pop(t, cue(1, "이하여야"), 0.3), dy=12)
    footnote(frame, "근거: 채무자회생법 제579조 (개인회생채무자의 범위)", t, 0.8)
    return finish(frame, 1, t, dur)


# ── 장면 3: 재산 vs 빚 저울 ────────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    base_y = 1300
    t_d = cue(2, "빚이")
    t_adj = cue(2, "임차보증금")
    grow = ease_out(clamp((t - 0.2) / 0.8))
    debt = ease_out(clamp((t - t_d) / 0.7))
    shrink = ease_in_out(clamp((t - t_adj) / 0.8))
    asset_h = (360 - 110 * shrink) * grow
    debt_h = 520 * debt
    ov, d = overlay()
    d.line([(X0 + 20, base_y), (X1 - 20, base_y)], fill=SLATE400 + (255,), width=4)
    if asset_h > 2:
        d.rounded_rectangle([210, base_y - asset_h, 390, base_y], 22, fill=AMBER + (255,))
        if shrink > 0:
            d.rounded_rectangle([210, base_y - 360 * grow, 390, base_y - asset_h], 22,
                                outline=AMBER + (int(200 * shrink),), width=4)
    if debt_h > 2:
        d.rounded_rectangle([620, base_y - debt_h, 800, base_y], 22, fill=RED + (255,))
    for x, lab, col in ((300, "재산", AMBER), (710, "빚", RED)):
        d.text((x, base_y + 44), lab, font=font("EB", 42), fill=WHITE + (255,), anchor="mm")
    frame.alpha_composite(ov)
    if debt > 0.6:
        place(frame, pill_img("빚 > 재산", TEAL, 34), 710, base_y - debt_h - 50, pop(t, t_d + 0.5, 0.3), dy=10)
    place(frame, pill_img("보증금 일부 공제", SLATE700, 28), 300, base_y - 360 * grow - 46, pop(t, t_adj, 0.3), dy=10)
    footnote(frame, "재산 계산 방법은 법원·사건마다 다를 수 있습니다.", t, 0.8, y=1438 + 20)
    return finish(frame, 2, t, dur)


# ── 장면 4: 계속적 소득 · 5년 내 면책 이력 ─────────────────────────
def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    items = (("briefcase", "계속 들어오는 소득", "새로 일을 시작해도 검토될 수 있어요", TEAL),
             ("clock", "최근 5년 내 면책 이력 없음", "회생·파산 면책 모두 포함", AMBER))
    num_list(frame, t, items, [cue(3, "셋째"), cue(3, "넷째")], y0=760, h=170, gap=40)
    footnote(frame, ["근거: 채무자회생법 제579조·제595조.",
                     "구체적인 판단은 법원·사건마다 다를 수 있습니다."], t, 0.8)
    return finish(frame, 3, t, dur)


# ── 장면 5: 익명 체크 (데모) ───────────────────────────────
ROWS = (("담보 없는 빚 10억 원 이하", "담보 있는 빚은 15억 원 이하"), ("재산보다 빚이 많음", "보증금 공제 여부 확인"),
        ("계속 들어오는 소득", "급여·사업·아르바이트"), ("최근 5년 내 면책 이력 없음", "회생·파산 모두"))


def scene5(t, dur):
    frame = new_frame()
    marks = [cue(4, "신청 전에"), cue(4, "네 가지부터"), cue(4, "익명 체크로"), cue(4, "한 번에")]
    scr = screen_checklist(t, "익명 채무 체크", "신청 전 4가지", "해당하는 항목을 체크하세요", ROWS, marks,
                           tag="예시 화면", result=("4가지 확인 완료", "변호사 프로필 보고 직접 선택"),
                           t_result=marks[-1] + 0.5)
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    for k, m in enumerate(marks):
        tap(frame, 78, 290 + k * 118 + 52, t - m + 0.05)
    return finish(frame, 4, t, dur, z=0)


def scene6(t, dur):
    return endcard(t, dur)


SFX = [(0, "기각될", "thump"), (0, "네 가지만", "pop"), (1, "담보 없는", "pop"), (1, "담보 있는", "pop"),
       (1, "이하여야", "alert"), (2, "빚이", "pop"), (2, "임차보증금", "pop"), (3, "셋째", "pop"), (3, "넷째", "pop"),
       (4, "신청 전에", "tick"), (4, "네 가지부터", "tick"), (4, "익명 체크로", "tick"), (4, "한 번에", "tick")]

META = dict(
    title="개인회생, 신청 전에 걸러지는 4가지",
    desc=("개인회생은 신청해도 요건이 맞지 않으면 기각될 수 있습니다. 먼저 확인할 4가지입니다.\n"
          "① 채무 한도: 담보 없는 채무 10억 원, 담보 있는 채무 15억 원 이하 (채무자회생법 제579조)\n"
          "② 재산보다 빚이 많을 것: 임차보증금 일부 공제 등으로 재산 계산이 조정될 수 있습니다.\n"
          "③ 계속적 소득: 새로 일을 시작한 경우에도 검토될 수 있습니다.\n"
          "④ 최근 5년 내 면책 이력이 없을 것: 개인회생·개인파산 면책 모두 해당 (제595조)\n"
          "구체적인 판단은 법원·사건마다 다를 수 있습니다."),
    feature="익명 채무 체크 > 신청 전 요건 확인",
    tags="#개인회생자격 #개인회생기각 #채무한도 #계속적소득 #면책이력 #마이김변",
    comment=("소득이 지금 없더라도 취업·창업 계획이 있다면 준비 방법을 선택한 변호사와 상의해 보세요. "
             "개인정보는 댓글에 남기지 마시고 익명 체크를 이용해 주세요."),
    related="public/guide/rehabilitation-eligibility.html",
    slot="12주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5, scene6], META, SFX)


if __name__ == "__main__":
    main()
