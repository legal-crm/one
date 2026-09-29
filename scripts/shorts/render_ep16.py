# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP16 렌더러
기획: docs/youtube_shorts_plan_part2.md  #16 "공무원, 교사, 전문직... 회생하면 짤릴까?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep16/
실행: python scripts/shorts/render_ep16.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep16"

SCENES = [
    dict(plan=3.0, caption="회생하면\n[직장 잘릴까?]",
         narration="공무원, 교사, 전문직... 회생 신청하면 직장에서 잘릴까요?",
         tts="공무원, 교사, 전문직. 회생 신청하면 직장에서 잘릴까요?"),
    dict(plan=6.0, caption="파산과 회생은\n[다릅니다]",
         narration="파산은 직업에 따라 자격이 제한될 수 있지만, 개인회생은 원칙적으로 신분이 유지돼요.",
         tts="파산은 직업에 따라 자격이 제한될 수 있지만, 개인회생은 원칙적으로 신분이 유지돼요."),
    dict(plan=9.0, caption="회생은\n[결격사유 아님]",
         narration="국가공무원법에는 파산선고만 결격사유로 적혀 있고, 개인회생은 해당하지 않아요.",
         tts="국가공무원법에는 파산선고만 결격사유로 적혀 있고, 개인회생은 해당하지 않아요."),
    dict(plan=8.0, caption="가명으로\n[조용히] 알아보기",
         narration="직장 걱정 없이, 마이김변 가명 상담으로 차분하게 알아보세요.",
         tts="직장 걱정 없이, 마이김변 가명 상담으로 차분하게 알아보세요."),
    dict(plan=6.0, caption="직장 지키고\n[빚도 정리]",
         narration="직장 잃을 걱정보다, 내 신분과 급여를 지키는 방법부터 확인하세요.",
         tts="직장 잃을 걱정보다, 내 신분과 급여를 지키는 방법부터 확인하세요."),
]

LAW = "근거: 국가공무원법 제33조 등 (파산선고 후 복권되지 않은 자만 결격)"
LAW2 = "직역별 법령에 따라 다를 수 있으니 선택한 변호사와 확인하세요."


# ── 장면 1: 만지작거리는 사원증 (zoom-in) ─────────────────────────
@lru_cache(maxsize=None)
def badge():
    S, w, h = 2, 440, 620
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 60 * S, w * S - 1, h * S - 1], 36 * S, fill=WHITE + (255,))
    d.rounded_rectangle([0, 60 * S, w * S - 1, 190 * S], 36 * S, fill=NAVY + (255,))
    d.rectangle([0, 150 * S, w * S - 1, 190 * S], fill=NAVY + (255,))
    d.rounded_rectangle([170 * S, 0, 270 * S, 110 * S], 20 * S, fill=SLATE300 + (255,))
    d.rounded_rectangle([196 * S, 70 * S, 244 * S, 92 * S], 10 * S, fill=SLATE500 + (255,))
    d.text((w / 2 * S, 135 * S), "공무원증", font=font("EB", 34 * S), fill=WHITE, anchor="mm")
    d.rounded_rectangle([130 * S, 220 * S, 310 * S, 420 * S], 20 * S, fill=SLATE100 + (255,))
    sil = icon("person", 150 * S, SLATE400)
    im.alpha_composite(sil, (int(w / 2 * S - sil.width / 2), int(250 * S)))
    d.rectangle([130 * S, 400 * S, 310 * S, 420 * S], fill=SLATE100 + (255,))
    d.text((w / 2 * S, 470 * S), "○○○", font=font("EB", 40 * S), fill=SLATE900, anchor="mm")
    d.rounded_rectangle([90 * S, 520 * S, 350 * S, 544 * S], 12 * S, fill=SLATE200 + (255,))
    d.rounded_rectangle([130 * S, 562 * S, 310 * S, 584 * S], 11 * S, fill=SLATE200 + (255,))
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=1000, alpha=40)
    ov, d = overlay()
    # 목걸이 줄
    sw = math.sin(t * 2.6) * 6
    top_x = 540 + sw * 3
    d.line([(300, 560), (top_x - 18, 780)], fill=BLUE + (255,), width=22)
    d.line([(780, 560), (top_x + 18, 780)], fill=BLUE + (255,), width=22)
    frame.alpha_composite(ov)
    b = badge().rotate(sw, resample=Image.BICUBIC, expand=True, center=(220, 0))
    frame.alpha_composite(b, (int(top_x - b.width / 2), 760))
    ov, d = overlay()
    thumb(d, top_x + 190 + math.sin(t * 5) * 6, 1150 + math.cos(t * 4) * 8, 80, 130)
    frame.alpha_composite(ov)
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1200)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 파산 vs 개인회생 비교 ──────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=950, alpha=40)
    lp, rp = pop(t, cue(1, "파산은"), 0.4), pop(t, cue(1, "개인회생은"), 0.4)
    place(frame, vcard_img(390, 400, "개인파산", "직업에 따라", "warn", AMBER, sub2="자격 제한 가능", tsize=44),
          290, 930, lp, s0=0.9)
    place(frame, vcard_img(390, 400, "개인회생", "원칙적으로", "check", TEAL, fill=CARD_HL, sub2="신분 유지", tsize=44,
                           owidth=5), 718, 930, rp, s0=0.9)
    ov, d = overlay()
    d.ellipse([504 - 46, 930 - 46, 504 + 46, 930 + 46], fill=NAVY_D + (255,), outline=SLATE400 + (255,), width=4)
    d.text((504, 930), "VS", font=font("EB", 34), fill=WHITE + (255,), anchor="mm")
    comp(frame, ov, min(lp, 1.0))
    text_box(frame, CAP_X, 1200, 828, 130, "결격사유는 파산선고", "개인회생 신청만으로 해당하지 않아요",
             NAVY, pop(t, cue(1, "신분이"), 0.4), tsize=40, ssize=27)
    footnote(frame, [LAW, LAW2], t, 0.6)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 조항 텍스트 그래픽 ──────────────────────────────
ITEMS = ["피성년후견인", "파산선고를 받고 복권되지 아니한 자", "금고 이상의 실형을 선고받고 …", "…"]


@lru_cache(maxsize=None)
def article():
    S, w, h = 2, 828, 520
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 28 * S, fill=(250, 250, 247, 255))
    d.text((40 * S, 60 * S), "국가공무원법 제33조", font=font("EB", 40 * S), fill=SLATE900, anchor="lm")
    d.text((40 * S, 110 * S), "(결격사유) 다음 각 호의 어느 하나에 해당하는 자는", font=font("B", 25 * S), fill=SLATE500,
           anchor="lm")
    d.text((40 * S, 146 * S), "공무원으로 임용될 수 없다.", font=font("B", 25 * S), fill=SLATE500, anchor="lm")
    d.line([(40 * S, 180 * S), ((w - 40) * S, 180 * S)], fill=SLATE300, width=3 * S)
    return im.resize((w, h), Image.LANCZOS)


def scene3(t, dur):
    frame = new_frame(cy=950, alpha=36)
    x0, y0 = CAP_X, 640
    place(frame, article(), x0 + 414, y0 + 260, pop(t, 0.0, 0.4), dy=40)
    t_hl = cue(2, "파산선고만")
    ov, d = overlay()
    for i, it in enumerate(ITEMS):
        y = y0 + 220 + i * 70
        hl = i == 1 and t >= t_hl
        if hl:
            hp = pop(t, t_hl, 0.4)
            d.rounded_rectangle([x0 + 24, y - 30, x0 + 24 + 780 * hp, y + 30], 14, fill=(254, 240, 138, 255))
        d.text((x0 + 40, y), f"{i + 1}.", font=font("EB", 30), fill=SLATE700 + (255,), anchor="lm")
        d.text((x0 + 90, y), it, font=font("EB" if i == 1 else "B", 30),
               fill=(SLATE900 if i == 1 else SLATE500) + (255,), anchor="lm")
    comp(frame, ov, pop(t, 0.3, 0.4))
    place(frame, card_img(560, 140, "개인회생", "결격사유 목록에 없음", "check", TEAL, fill=CARD_HL, tsize=40, ssize=26,
                          owidth=5), 504, 1270, pop(t, cue(2, "개인회생은"), 0.4), s0=0.9)
    footnote(frame, ["근거: 국가공무원법 제33조 제2호 (조문 일부 발췌)", LAW2], t, 0.5, y=1440)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 스텔스 가명 상담 (데모) ─────────────────────────────
ALIAS_ROLL = ["맑은 호수 17", "푸른 소나무 63", "조용한 별 28", "느긋한 구름 55"]
ALIAS = "단단한 바위 71"


def screen_alias(t, t_alias, t_rows, t_tap):
    s = Scr(SLATE50)
    s_header(s, "가명 상담 요청")
    s.rr(28, 190, SW - 28, 440, 32, fill=WHITE, outline=SLATE200, width=2)
    s.text(60, 228, "내 표시 이름", 24, SLATE500, "B", "lm")
    s_tag(s, SW - 56, 208, "스텔스 가명", TEAL_L, TEAL_D, 20, 40, anchor="r")
    done = t >= t_alias
    if t < 0.4:
        alias = "· · ·"
    elif not done:
        alias = ALIAS_ROLL[int((t - 0.4) / 0.15) % len(ALIAS_ROLL)]
    else:
        alias = ALIAS
    s.rr(60, 270, SW - 60, 380, 22, fill=(240, 253, 250) if done else SLATE50, outline=TEAL if done else SLATE200,
         width=3 if done else 2)
    s.text(90, 325, alias, 42, SLATE900 if done else SLATE400, "EB", "lm")
    if done:
        s.circ(SW - 110, 325, 26, fill=TEAL)
        check_icon(s, SW - 110, 326, 26, WHITE, 5)
    s.text(60, 412, "변호사에게는 이 이름만 보여요", 21, SLATE500, "B", "lm")
    rows = [("실명", "lock"), ("010 번호", "phone"), ("직장·소속", "briefcase")]
    s.rr(28, 470, SW - 28, 470 + 3 * 112 + 20, 32, fill=WHITE, outline=SLATE200, width=2)
    for i, (lab, ic) in enumerate(rows):
        y = 490 + i * 112
        p = pop(t, t_rows + i * 0.35, 0.3)
        s.circ(84, y + 46, 32, fill=SLATE100)
        s_icon(s, ic, 84, y + 46, 34, SLATE700)
        s.text(136, y + 28, lab, 28, SLATE900, "EB", "lm")
        s.text(136, y + 66, "비공개" if p > 0.5 else "공개", 20, TEAL_D if p > 0.5 else SLATE400, "B", "lm")
        toggle(s, SW - 150, y + 21, p)
    pressed = t_tap <= t < t_tap + 0.25
    s_button(s, 860, "가명으로 상담 요청", "pressed" if pressed else ("on" if t >= t_rows + 1.0 else "off"))
    s_toast(s, t, t_tap + 0.4, "상담 요청 완료", "변호사에게는 가명만 전달돼요")
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    t_alias = cue(3, "마이김변")
    t_rows = cue(3, "가명 상담")
    t_tap = max(t_rows + 1.4, dur - 1.8)
    put_phone(frame, screen_alias(t, t_alias, t_rows, t_tap), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 908, t - t_tap)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="공무원, 교사, 전문직... 회생하면 짤릴까?",
    desc=("국가공무원법 제33조는 '파산선고를 받고 복권되지 아니한 자'를 결격사유로 정하고 있고, 개인회생은 이 목록에 "
          "없습니다. 파산은 직업에 따라 자격이 제한될 수 있지만, 개인회생은 원칙적으로 신분이 유지됩니다.\n"
          "직역별 법령에 따라 다를 수 있으니, 가명 상담으로 차분하게 알아보고 선택한 변호사와 확인하세요."),
    feature="스텔스 가명 상담 (실명·010 번호·직장 정보 비공개)",
    tags="#공무원개인회생 #교사개인회생 #전문직회생 #결격사유 #스텔스가명 #마이김변",
    comment=("의사, 변호사, 회계사, 공무원 등 많은 직역에서 개인회생은 결격사유로 정해져 있지 않습니다. "
             "내 직역 법령은 선택한 변호사와 먼저 확인하세요."),
    related="public/articles/professional-license-preservation.html",
    slot="6주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
