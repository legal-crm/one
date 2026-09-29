# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP14 렌더러
기획: docs/youtube_shorts_plan_part2.md  #14 "국세·건보료 체납도 개인회생에 들어갈까?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep14/
실행: python scripts/shorts/render_ep14.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep14"

SCENES = [
    dict(plan=3.0, caption="세금 체납도\n[회생] 될까?",
         narration="세금과 건강보험료가 수천만 원 밀렸는데, 회생이 될까요?",
         tts="세금과 건강보험료가 수천만 원 밀렸는데, 회생이 될까요?"),
    dict(plan=6.0, caption="세금은\n[탕감 안 돼요]",
         narration="솔직히 세금은 면책되지 않아요. 끝까지 갚아야 하는 우선 채권입니다.",
         tts="솔직히 세금은 면책되지 않아요. 끝까지 갚아야 하는 우선 채권입니다."),
    dict(plan=9.0, caption="대신\n[나눠 갚기] 가능",
         narration="하지만 일반 빚과 함께 변제계획에 넣어, 변제기간 동안 나눠 갚을 수 있어요.",
         tts="하지만 일반 빚과 함께 변제계획에 넣어, 변제기간 동안 나눠 갚을 수 있어요."),
    dict(plan=8.0, caption="체납처분\n[중지]도 검토",
         narration="절차 중에는 법원 결정에 따라, 세무서 체납처분 중지도 검토할 수 있습니다.",
         tts="절차 중에는 법원 결정에 따라, 세무서 체납처분 중지도 검토할 수 있습니다."),
    dict(plan=6.0, caption="세금 빚,\n[계획]부터 세우세요",
         narration="감당 못 할 세금 독촉, 분할 변제 계획부터 익명으로 점검하세요.",
         tts="감당 못 할 세금 독촉, 분할 변제 계획부터 익명으로 점검하세요."),
]

LAW = "근거: 채무자회생법 제611조 (우선권 있는 개인회생채권 전액 변제)"


# ── 장면 1: 쌓인 독촉 고지서 (pan-right) ─────────────────────────
WW = 1560
NOTICES = [  # (제목, 색, x, y, 회전)
    ("국세 독촉장", RED, 60, 700, 8), ("건보료 독촉", BLUE, 420, 640, -6), ("지방세 독촉", AMBER, 780, 720, 5),
    ("국세 독촉장", RED, 1120, 660, -9), ("건보료 독촉", BLUE, 200, 1010, -4), ("지방세 독촉", AMBER, 560, 1060, 7),
    ("국세 독촉장", RED, 930, 1020, -5), ("건보료 독촉", BLUE, 1250, 1060, 6),
]


@lru_cache(maxsize=None)
def notice_pile():
    layer = Image.new("RGBA", (WW, H), (0, 0, 0, 0))
    for title, col, x, y, rot in NOTICES:
        pp = paper_img(420, 330, title, (("체납액", "○○○만 원"), ("납부 기한", "20XX.XX.XX"), (None, None)),
                       accent=col)
        pp = pp.rotate(rot, resample=Image.BICUBIC, expand=True)
        layer.alpha_composite(pp, (x, y))
    return layer


def scene1(t, dur):
    frame = new_frame(cy=1100, color=(239, 68, 68), alpha=26)
    off = (WW - W) * ease_in_out(t / dur)
    pile = notice_pile()
    frame.alpha_composite(pile.crop((int(off), 0, int(off) + W, H)))
    # 마지막 고지서가 위로 툭 떨어짐
    p = pop(t, 0.9, 0.3)
    if p > 0:
        top = paper_img(460, 350, "체납 안내", (("합계", "3,400만 원"), ("구분", "국세·건보료"), (None, None)),
                        accent=RED_D)
        place(frame, top, 540, 1030, p, dy=-160, rot=-3)
    frame = zoom_rgba(frame, 1.0 + 0.05 * ease_in_out(t / dur), W / 2, 1300)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 자물쇠 + '면책 제외' 도장 ───────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=900, color=(245, 158, 11), alpha=30)
    place(frame, vcard_img(380, 300, "국세·지방세", "체납 세금", "bank", AMBER), 290, 860, pop(t, 0.1, 0.4))
    place(frame, vcard_img(380, 300, "건강보험료", "체납 보험료", "medical", BLUE), 718, 860, pop(t, 0.3, 0.4))
    t_lock = cue(1, "면책되지")
    lp = pop(t, t_lock - 0.2, 0.3)
    if lp > 0:
        ov, d = overlay()
        d.ellipse([504 - 80, 860 - 80, 504 + 80, 860 + 80], fill=SLATE900 + (255,), outline=AMBER + (255,), width=6)
        comp(frame, ov, lp)
        place(frame, icon("lock", 96, AMBER), 504, 856, lp, dy=-40, s0=1.3)
    stamp_in(frame, stamp_img("면책 제외", RED, 330, 124, -8), 504, 1085, t, t_lock + 0.3)
    text_box(frame, CAP_X, 1220, 828, 150, "우선권 있는 채권", "변제계획에서 전액 변제가 원칙",
             AMBER, pop(t, cue(1, "우선"), 0.4), sub_col=(255, 247, 237))
    footnote(frame, [LAW], t, 0.6, y=1452)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 변제기간 분할 타임라인 ─────────────────────────────
YEARS = [("1년차", 0.72, 0.28), ("2년차", 0.45, 0.55), ("3년차", 0.10, 0.90)]  # (라벨, 세금 비중, 일반 비중)


def scene3(t, dur):
    frame = new_frame(cy=1000, color=(13, 148, 136), alpha=34)
    ov, d = overlay()
    # 범례
    lg = pop(t, 0.1, 0.3)
    for i, (lab, col) in enumerate((("세금·건보료 (우선)", AMBER), ("일반 채무", TEAL))):
        x = CAP_X + i * 420
        d.rounded_rectangle([x, 640, x + 34, 674], 8, fill=col + (255,))
        d.text((x + 50, 657), lab, font=font("B", 30), fill=SLATE200 + (255,), anchor="lm")
    comp(frame, ov, lg)
    base_y, maxh, bw = 1230, 460, 200
    t0 = cue(2, "일반 빚") - 0.2
    t_split = cue(2, "변제기간")
    for i, (lab, tax, gen) in enumerate(YEARS):
        x = CAP_X + 40 + i * 270
        g = pop(t, t0 + i * 0.35, 0.6)
        ov, d = overlay()
        d.rounded_rectangle([x, base_y - maxh, x + bw, base_y], 24, fill=(28, 50, 82, 255))
        h_tax = maxh * tax * g
        h_gen = maxh * gen * pop(t, t_split + i * 0.3, 0.6)
        if h_gen > 2:
            d.rounded_rectangle([x, base_y - h_gen, x + bw, base_y], 24, fill=TEAL + (255,))
        if h_tax > 2:
            y1 = base_y - h_gen
            d.rounded_rectangle([x, y1 - h_tax, x + bw, y1 + (24 if h_gen > 24 else 0)], 24, fill=AMBER + (255,))
            if h_gen > 24:
                d.rectangle([x, y1, x + bw, y1 + 24], fill=TEAL + (255,))
        d.text((x + bw / 2, base_y + 44), lab, font=font("EB", 36), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, pop(t, 0.2 + i * 0.1, 0.3))
    # 변제기간 화살표
    ap = pop(t, t_split, 0.6)
    draw_line_progress(frame, [(CAP_X + 40, 1330), (CAP_X + 40 + 740 * ap, 1330)], 1 if ap > 0 else 0, SLATE300, 6)
    if ap >= 1:
        place(frame, icon("arrow", 40, SLATE300), CAP_X + 790, 1330, 1)
        ov, d = overlay()
        d.text((CAP_X + 40, 1374), "변제기간 동안 나눠 갚기", font=font("B", 28), fill=SLATE300 + (255,), anchor="lm")
        frame.alpha_composite(ov)
    footnote(frame, [LAW, "변제기간·금액은 소득과 사건에 따라 다릅니다."], t, 0.5, y=1440)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 변제계획 입력 UI — 세금 채무 포함 (데모) ──────────────────
def screen_plan(t, t_toggle, t_sum):
    s = Scr(SLATE50)
    s_header(s, "변제계획 미리보기")
    s.text(36, 200, "채무 목록", 34, SLATE900, "EB", "lm")
    rows = [("국세", "1,800만 원", "우선권", AMBER, "bank"), ("건강보험료", "600만 원", "우선권", AMBER, "medical"),
            ("카드·대출", "4,200만 원", "일반", TEAL, "card")]
    for i, (lab, amt, tg, col, ic) in enumerate(rows):
        p = pop(t, 0.2 + i * 0.25, 0.3)
        y = 250 + i * 118 + (1 - p) * 20
        s.rr(28, y, SW - 28, y + 102, 24, fill=lerp_color(SLATE50, WHITE, p), outline=lerp_color(SLATE50, SLATE200, p), width=2)
        s.circ(84, y + 51, 30, fill=lerp_color(SLATE50, col, p))
        s_icon(s, ic, 84, y + 51, 32, WHITE, p)
        s.text(132, y + 36, lab, 25, lerp_color(SLATE50, SLATE900, p), "EB", "lm")
        s.text(132, y + 72, amt, 21, lerp_color(SLATE50, SLATE500, p), "B", "lm")
        if p > 0.5:
            s_tag(s, SW - 52, y + 33, tg, AMBER_L if col == AMBER else TEAL_L,
                  (180, 83, 9) if col == AMBER else TEAL_D, 18, 36, anchor="r")
    # 체납처분 중지 토글
    tp = pop(t, t_toggle, 0.3)
    y = 620
    s.rr(28, y, SW - 28, y + 120, 26, fill=WHITE, outline=lerp_color(SLATE200, BLUE, tp), width=3)
    s.circ(84, y + 60, 32, fill=lerp_color(SLATE100, (219, 234, 254), tp))
    s_icon(s, "hourglass", 84, y + 60, 36, lerp_color(SLATE500, BLUE_D, tp))
    s.text(136, y + 42, "체납처분 중지 검토", 26, SLATE900, "EB", "lm")
    s.text(136, y + 80, "법원 결정 · 징수기관 의견 청취", 19, SLATE500, "B", "lm")
    toggle(s, SW - 144, y + 35, tp)
    # 월 변제금 요약
    sp = pop(t, t_sum, 0.4)
    if sp > 0:
        y = 770 + (1 - sp) * 24
        s.rr(28, y, SW - 28, y + 180, 30, fill=lerp_color(SLATE50, NAVY, sp))
        s.text(60, y + 40, "월 변제금", 21, lerp_color(NAVY, SLATE300, sp), "B", "lm")
        s.text(60, y + 96, "780,000원", 46, lerp_color(NAVY, WHITE, sp), "EB", "lm")
        s.text(60, y + 146, "세금·건보료 먼저 · 36개월 분할", 19, lerp_color(NAVY, TEAL_L, sp), "B", "lm")
    s.text(SW / 2, 1000, "근거: 채무자회생법 제593조 (중지명령)", 17, SLATE400, "B", "mm")
    s.text(SW / 2, 1028, "중지 여부와 범위는 법원이 판단합니다", 17, SLATE400, "B", "mm")
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    t_toggle = cue(3, "체납처분")
    t_sum = cue(3, "검토할")
    put_phone(frame, screen_plan(t, t_toggle, t_sum), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW - 100, 655, t - t_toggle + 0.1)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="국세·건보료 체납도 개인회생에 들어갈까?",
    desc=("세금과 건강보험료는 개인회생에서 면책되지 않는 채권이며, 변제계획에서 전액 변제하는 것이 원칙입니다"
          "(우선권 있는 개인회생채권, 채무자회생법 제611조). 대신 일반 채무와 함께 변제계획에 넣어 변제기간 동안 "
          "나눠 갚는 계획을 세울 수 있습니다. 절차 중에는 법원 결정에 따라 체납처분 중지도 검토할 수 있습니다"
          "(같은 법 제593조).\n변제기간·금액·중지 여부는 소득과 사건에 따라 다르며 법원이 판단합니다."),
    feature="익명 채무 체크 > 채무 구조 입력 (세금·건보료 포함)",
    tags="#세금체납 #국세체납 #건보료체납 #개인회생세금 #우선변제채권 #마이김변",
    comment=("세금·건보료는 파산에서도 면책되지 않는 채권입니다. 개인회생을 통해 분할 상환 계획을 세우는 방법이 있는지 "
             "선택한 변호사와 상의하세요."),
    related="public/guide/tax-debt.html",
    slot="6주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
