# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP19 렌더러
기획: docs/youtube_shorts_plan_part2.md  #19 "변호사 수임료, 한 번에 다 내야 하나요?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep19/
실행: python scripts/shorts/render_ep19.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep19"

SCENES = [
    dict(plan=3.0, caption="수임료 낼 돈도\n[없는데...]",
         narration="빚 갚기도 벅찬데, 변호사 비용은 또 어떻게 내나 막막하셨죠?",
         tts="빚 갚기도 벅찬데, 변호사 비용은 또 어떻게 내나 막막하셨죠?"),
    dict(plan=6.0, caption="법원 실비\n+ [변호사 보수]",
         narration="비용은 크게 법원에 내는 인지대·송달료 같은 실비와, 변호사 수임료로 나뉩니다.",
         tts="비용은 크게 법원에 내는 인지대, 송달료 같은 실비와, 변호사 수임료로 나뉩니다."),
    dict(plan=9.0, caption="[분납 가능]한\n곳도 있어요",
         narration="마이김변에선 수임료 분납이 가능한 변호사 프로필을 미리 확인하고 고를 수 있어요.",
         tts="마이김변에선 수임료 분납이 가능한 변호사 프로필을 미리 확인하고 고를 수 있어요."),
    dict(plan=8.0, caption="비용 구조\n[미리 확인]",
         narration="상담 요청 단계의 플랫폼 이용료는 0원. 비용 구조를 미리 확인하고 직접 선택하세요.",
         tts="상담 요청 단계의 플랫폼 이용료는 영 원. 비용 구조를 미리 확인하고 직접 선택하세요."),
    dict(plan=6.0, caption="비용도\n[투명하게 확인]",
         narration="돈이 없다고 포기하지 마세요. 분납 조건까지 미리 확인하고 선택하세요.",
         tts="돈이 없다고 포기하지 마세요. 분납 조건까지 미리 확인하고 선택하세요."),
]

NOTE = "법원 실비(인지대·송달료·회생위원 또는 관재인 보수 등)는 법원에 내는 금액입니다."
LEATHER = (120, 72, 40)
LEATHER_D = (92, 54, 30)


# ── 장면 1: 열어 본 빈 지갑 (zoom-in) ─────────────────────────────
@lru_cache(maxsize=None)
def wallet_back():
    S, w, h = 2, 700, 440
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 40 * S, fill=LEATHER_D + (255,))
    d.rounded_rectangle([30 * S, 30 * S, (w - 30) * S, (h - 30) * S], 26 * S, fill=(60, 36, 20, 255))
    for k in range(3):
        y = (70 + k * 40) * S
        d.rounded_rectangle([60 * S, y, (w - 60) * S, y + 26 * S], 10 * S, fill=(76, 46, 26, 255))
    return im.resize((w, h), Image.LANCZOS)


@lru_cache(maxsize=None)
def wallet_front():
    S, w, h = 2, 700, 250
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 36 * S, fill=LEATHER + (255,))
    for x in range(40, w - 30, 28):
        d.ellipse([x * S, 20 * S, (x + 8) * S, 28 * S], fill=(160, 110, 70, 255))
    d.rounded_rectangle([(w - 170) * S, 90 * S, (w - 40) * S, 170 * S], 20 * S, fill=LEATHER_D + (255,))
    d.ellipse([(w - 120) * S, 116 * S, (w - 90) * S, 146 * S], fill=(212, 175, 55, 255))
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=1050, alpha=30)
    wx, wy = 504 - 350, 820
    frame.alpha_composite(wallet_back(), (wx, wy))
    # 빈 지폐칸을 들여다보는 느낌: 안쪽에 '텅'
    op = pop(t, 0.5, 0.4)
    if op > 0:
        ov, d = overlay()
        d.text((504, wy + 150), "텅…", font=font("EB", 70), fill=(203, 213, 225, 255), anchor="mm")
        comp(frame, ov, op)
    frame.alpha_composite(wallet_front(), (wx, wy + 250))
    # 떨어지는 동전 두 개
    for i, (x0, t0) in enumerate(((380, 0.8), (620, 1.25))):
        if t < t0:
            continue
        k = t - t0
        y = wy + 300 + 900 * k * k
        if y > H:
            continue
        cx = x0 + 60 * k * (1 if i else -1)
        place(frame, icon("coin", 90, (212, 175, 55)), cx, y, 1, dy=0, rot=k * 300)
    ov, d = overlay()
    thumb(d, wx + 20, wy + 280, 80, 130)
    thumb(d, wx + 680, wy + 280, 80, 130)
    frame.alpha_composite(ov)
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1500)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 영수증이 두 갈래로 ──────────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=950, alpha=36)
    t_court, t_fee = cue(1, "법원에"), cue(1, "변호사")
    rp = pop(t, 0.0, 0.4) * (1 - 0.75 * pop(t, t_court, 0.4))
    place(frame, paper_img(460, 400, "비용 안내", (("합계", "?"), (None, None), (None, None), (None, None)),
                           accent=BLUE), 504, 860, rp, dy=40)
    place(frame, vcard_img(390, 330, "법원 실비", "인지대·송달료 등", "bank", AMBER, sub2="법원에 납부"),
          290, 1110, pop(t, t_court, 0.4), s0=0.9)
    place(frame, vcard_img(390, 330, "변호사 수임료", "선택한 사무소와", "briefcase", TEAL, fill=CARD_HL,
                           sub2="직접 협의", owidth=5), 718, 1110, pop(t, t_fee, 0.4), s0=0.9)
    footnote(frame, [NOTE], t, 0.6, y=1452)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: '수임료 분납' 프로필 필터 → 선택 (데모) ────────────────────
CARDS = lawyers_with("수임료 분납", {0, 2})


def scene3(t, dur):
    frame = new_frame()
    t_f, t_sel = cue(2, "분납이"), cue(2, "고를")
    scr, tp = screen_profiles(t, CARDS, "수임료 분납", t_f, 2, t_sel, filt_label="수임료 분납 가능")
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, 150, 256, t - t_f + 0.1)
    tap(frame, tp[0], tp[1], t - t_sel + 0.1)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 비용 구조 안내 화면 (데모) ───────────────────────────
def screen_cost(t, times, t_btn):
    s = Scr(SLATE50)
    s_header(s, "비용 안내")
    s.text(36, 200, "무엇에, 누구에게 내나요?", 30, SLATE900, "EB", "lm")
    rows = [("플랫폼 이용료", "상담 요청 단계", "0원", TEAL, "shield"),
            ("법원 실비", "인지대·송달료 등 · 법원 납부", "법원 기준", AMBER, "bank"),
            ("변호사 수임료", "분납 여부 포함 · 사무소와 협의", "직접 확인", BLUE, "briefcase")]
    for i, ((lab, sub, val, col, ic), t0) in enumerate(zip(rows, times)):
        p = pop(t, t0, 0.35)
        y = 250 + i * 170 + (1 - p) * 24
        hl = i == 0 and p >= 1
        s.rr(28, y, SW - 28, y + 150, 28, fill=lerp_color(SLATE50, (240, 253, 250) if hl else WHITE, p),
             outline=lerp_color(SLATE50, col if hl else SLATE200, p), width=4 if hl else 2)
        s.circ(88, y + 75, 36, fill=lerp_color(SLATE50, col, p))
        s_icon(s, ic, 88, y + 75, 38, WHITE, p)
        s.text(144, y + 56, lab, 27, lerp_color(SLATE50, SLATE900, p), "EB", "lm")
        s.text(144, y + 98, sub, 18, lerp_color(SLATE50, SLATE500, p), "B", "lm")
        s.text(SW - 52, y + 56, val, 28 if i == 0 else 21, lerp_color(SLATE50, col if i == 0 else SLATE700, p), "EB", "rm")
    p = pop(t, times[-1] + 0.6, 0.35)
    if p > 0:
        s.rr(28, 780, SW - 28, 880, 24, fill=lerp_color(SLATE50, SLATE900, p))
        s.text(SW / 2, 812, "추가 비용 조건도 계약 전에 확인하세요", 21, lerp_color(SLATE50, WHITE, p), "EB", "mm")
        s.text(SW / 2, 850, "수임 조건은 의뢰인이 선택한 사무소와 정합니다", 17, lerp_color(SLATE50, SLATE300, p), "B", "mm")
    pressed = t_btn <= t < t_btn + 0.25
    s_button(s, 920, "변호사 프로필 비교", "pressed" if pressed else ("on" if t >= times[-1] else "off"))
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    times = [cue(3, "플랫폼"), cue(3, "비용 구조") - 0.3, cue(3, "미리")]
    t_btn = max(cue(3, "직접") + 0.3, dur - 1.6)
    put_phone(frame, screen_cost(t, times, t_btn), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 968, t - t_btn)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="변호사 수임료, 한 번에 다 내야 하나요?",
    desc=("개인회생·파산 비용은 크게 법원에 내는 실비(인지대·송달료·회생위원 또는 관재인 보수 등)와 "
          "변호사 수임료로 나뉩니다. 수임료 금액과 분납 여부는 의뢰인이 선택한 법률사무소와 직접 협의합니다.\n"
          "마이김변에서는 상담 요청 단계의 플랫폼 이용료가 0원이며, 수임료 분납이 가능한 변호사 프로필을 미리 "
          "확인하고 직접 선택할 수 있습니다."),
    feature="변호사 프로필 > 수임료 분납 가능 필터",
    tags="#변호사수임료 #개인회생비용 #수임료분납 #투명한수임료 #마이김변",
    comment=("상담 요청 단계의 플랫폼 이용료는 0원입니다. 수임료 책정 및 분납 여부는 의뢰인이 선택한 "
             "법률사무소와 직접 협의합니다."),
    related="public/guide/rehabilitation-cost.html",
    slot="7주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
