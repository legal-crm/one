# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP13 렌더러
기획: docs/youtube_shorts_plan_part2.md  #13 "통장 압류돼도 185만 원은 찾을 수 있다?"

※ 압류금지 예금 기준 금액은 민사집행법 시행령 개정에 따라 바뀔 수 있다.
   업로드 전 최신 기준을 확인하고, 바뀌었다면 아래 AMOUNT/AMOUNT_TTS/AMOUNT_WON 만 고쳐 다시 렌더링한다.
출력: assets/shorts/ep13/
실행: python scripts/shorts/render_ep13.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep13"
AMOUNT = "185만 원"
AMOUNT_TTS = "백팔십오만 원"
AMOUNT_WON = 1_850_000

SCENES = [
    dict(plan=3.0, caption="통장 압류,\n[밥값도] 없나요?",
         narration="통장이 하루아침에 묶여, 생활비도 못 뽑고 계신가요?",
         tts="통장이 하루아침에 묶여, 생활비도 못 뽑고 계신가요?"),
    dict(plan=6.0, caption=f"[{AMOUNT}]까지\n압류 금지",
         narration=f"법적으로 {AMOUNT}까지는 최저 생계비라, 압류할 수 없는 돈입니다.",
         tts=f"법적으로 {AMOUNT_TTS}까지는 최저 생계비라, 압류할 수 없는 돈입니다."),
    dict(plan=9.0, caption="압류금지\n[범위변경] 신청",
         narration="법원에 압류금지채권 범위변경을 신청하거나, 개인회생 중지명령으로 멈출 수 있어요.",
         tts="법원에 압류금지채권 범위변경을 신청하거나, 개인회생 중지명령으로 멈출 수 있어요."),
    dict(plan=8.0, caption="회생으로\n[압류 해제]까지",
         narration="압류된 돈이 크다면, 개인회생 인가 후 압류 효력을 없애는 길도 있습니다.",
         tts="압류된 돈이 크다면, 개인회생 인가 후 압류 효력을 없애는 길도 있습니다."),
    dict(plan=6.0, caption="[생활비부터]\n지키세요",
         narration="굶으면서 버티지 마세요. 내 통장 상태부터 익명으로 체크해 보세요.",
         tts="굶으면서 버티지 마세요. 내 통장 상태부터 익명으로 체크해 보세요."),
]

LAW = "근거: 민사집행법 제246조 제1항 제8호 (개인별 예금 잔액 기준)"
LAW2 = "기준 금액은 법령 개정에 따라 달라질 수 있습니다."


# ── 장면 1: ATM '출금 불가' 붉은 안내창 (zoom-in) ─────────────────
@lru_cache(maxsize=None)
def atm_body():
    S, w, h = 2, 780, 1060
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 46 * S, fill=(71, 85, 105, 255))
    d.rounded_rectangle([20 * S, 20 * S, (w - 20) * S, 120 * S], 30 * S, fill=(51, 65, 85, 255))
    d.text((w * S / 2, 70 * S), "ATM", font=font("EB", 44 * S), fill=SLATE300, anchor="mm")
    d.rounded_rectangle([60 * S, 150 * S, (w - 60) * S, 600 * S], 22 * S, fill=(15, 23, 42, 255))
    # 카드 투입구·키패드
    d.rounded_rectangle([470 * S, 660 * S, 710 * S, 700 * S], 12 * S, fill=(30, 41, 59, 255))
    d.rounded_rectangle([490 * S, 674 * S, 690 * S, 686 * S], 6 * S, fill=(15, 23, 42, 255))
    for r in range(4):
        for c in range(3):
            x, y = 80 + c * 110, 650 + r * 90
            d.rounded_rectangle([x * S, y * S, (x + 90) * S, (y + 70) * S], 14 * S, fill=(100, 116, 139, 255))
            lab = "123456789*0#"[r * 3 + c]
            d.text(((x + 45) * S, (y + 35) * S), lab, font=font("EB", 30 * S), fill=(226, 232, 240, 255), anchor="mm")
    d.rounded_rectangle([470 * S, 760 * S, 710 * S, 820 * S], 14 * S, fill=(30, 41, 59, 255))
    d.rounded_rectangle([490 * S, 784 * S, 690 * S, 796 * S], 6 * S, fill=(15, 23, 42, 255))
    d.text((590 * S, 850 * S), "지폐", font=font("B", 22 * S), fill=SLATE300, anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


def atm_screen(t, t_alert):
    S, w, h = 2, 660, 450
    im = Image.new("RGBA", (w * S, h * S), (15, 23, 42, 255))
    d = ImageDraw.Draw(im)
    if t < t_alert:
        d.text((w * S / 2, 140 * S), "출금 금액을 확인 중입니다", font=font("B", 30 * S), fill=SLATE300, anchor="mm")
        n = int(t * 3) % 4
        d.text((w * S / 2, 220 * S), "·" * n, font=font("EB", 60 * S), fill=SLATE300, anchor="mm")
        d.text((w * S / 2, 320 * S), "출금 100,000원", font=font("EB", 44 * S), fill=WHITE, anchor="mm")
    else:
        blink = 0.75 + 0.25 * math.sin((t - t_alert) * 9)
        d.rounded_rectangle([24 * S, 24 * S, (w - 24) * S, (h - 24) * S], 20 * S,
                            fill=lerp_color((60, 16, 16), RED_D, blink) + (255,))
        tri = icon("warn", 110 * S, WHITE)
        im.alpha_composite(tri, (int(w * S / 2 - tri.width / 2), 50 * S))
        d.text((w * S / 2, 250 * S), "출금 불가", font=font("EB", 72 * S), fill=WHITE, anchor="mm")
        d.text((w * S / 2, 340 * S), "압류된 계좌입니다", font=font("B", 32 * S), fill=(254, 226, 226), anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=int(20 + 20 * (t > 0.6)))
    body = atm_body()
    x0, y0 = 540 - body.width // 2 - 36, 640
    frame.alpha_composite(body, (x0, y0))
    frame.alpha_composite(atm_screen(t, 0.6), (x0 + 60, y0 + 150))
    frame = zoom_rgba(frame, 1.0 + 0.12 * ease_in_out(t / dur), 504, 1500)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 법전 + 보호막 속 지갑, 보호 금액 카운트업 ──────────────────
@lru_cache(maxsize=None)
def law_book():
    S, w, h = 2, 300, 380
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([20 * S, 10 * S, w * S, (h - 10) * S], 18 * S, fill=(245, 240, 225, 255))
    d.rounded_rectangle([0, 0, (w - 16) * S, (h - 20) * S], 18 * S, fill=(127, 29, 29, 255))
    d.rectangle([0, 0, 34 * S, (h - 20) * S], fill=(100, 20, 20, 255))
    d.rounded_rectangle([70 * S, 70 * S, (w - 50) * S, 200 * S], 10 * S, outline=(234, 179, 8, 255), width=4 * S)
    d.text(((w + 4) / 2 * S, 115 * S), "민사", font=font("EB", 40 * S), fill=(250, 204, 21), anchor="mm")
    d.text(((w + 4) / 2 * S, 165 * S), "집행법", font=font("EB", 40 * S), fill=(250, 204, 21), anchor="mm")
    d.text(((w + 4) / 2 * S, 290 * S), "§246", font=font("EB", 34 * S), fill=(254, 226, 226), anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


def scene2(t, dur):
    frame = new_frame(cy=950, color=(13, 148, 136), alpha=40)
    place(frame, law_book(), 250, 900, pop(t, 0.1, 0.4), s0=0.9)
    t_amt, t_shield = cue(1, "까지는") - 0.9, cue(1, "압류할")
    cx, cy = 690, 900
    sp = pop(t, t_shield, 0.45)
    if sp > 0:
        frame.alpha_composite(radial(W, H, cx, cy, 300, (45, 212, 191), int(90 * sp)))
        sh = icon("shield", 400, TEAL)
        place(frame, sh, cx, cy, sp, dy=0, s0=0.7)
    place(frame, icon("wallet", 190 if sp <= 0 else 150, WHITE if sp <= 0 else NAVY_D), cx, cy - (0 if sp <= 0 else 20),
          pop(t, 0.3, 0.4), dy=20)
    # 금액 카운트업
    ap = ease_out((t - t_amt) / 1.2) if t >= t_amt else 0
    if ap > 0:
        ov, d = overlay()
        val = int(AMOUNT_WON * ap / 10000) * 10000
        d.rounded_rectangle([CAP_X, 1170, RIGHT, 1330], 34, fill=CARD_HL + (255,), outline=TEAL + (255,), width=4)
        d.text((CAP_X + 40, 1215), "압류할 수 없는 생계비", font=font("B", 30), fill=TEAL_L + (255,), anchor="lm")
        d.text((CAP_X + 40, 1282), f"{val:,}원", font=font("EB", 64), fill=WHITE + (255,), anchor="lm")
        if ap >= 1:
            s_ = icon("lock", 70, TEAL_L)
            frame.alpha_composite(ov)
            place(frame, s_, RIGHT - 70, 1250, pop(t, t_amt + 1.2, 0.3), dy=0, s0=0.6)
        else:
            frame.alpha_composite(ov)
    footnote(frame, [LAW, LAW2], t, 0.6)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 법원 신청서 + 중지명령 ───────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=950, alpha=40)
    t_form, t_stop = cue(2, "압류금지채권"), cue(2, "개인회생")
    paper = paper_img(600, 440, "범위변경 신청서", (("신청 취지", "압류금지 범위 확장"), ("대상", "생계비 예금"),
                                                  (None, None), (None, None)), accent=TEAL)
    fp = pop(t, t_form - 0.3, 0.45)
    # 중지명령 등장 시 서류는 왼쪽 위로 비켜남
    mv = ease_in_out((t - t_stop) / 0.5) if t >= t_stop else 0
    place(frame, paper, lerp(504, 420, mv), lerp(900, 850, mv), fp, dy=60, rot=lerp(0, 4, mv))
    if fp >= 1:
        stamp_in(frame, stamp_img("신청", TEAL_D, 190, 110, -8, 50), lerp(700, 610, mv), lerp(1010, 960, mv), t,
                 t_form + 0.9)
    place(frame, card_img(560, 150, "개인회생 중지명령", "회생 신청과 함께 압류 절차 멈춤", "hourglass", BLUE,
                          fill=CARD_HL, tsize=38, ssize=25, owidth=4), 610, 1210, pop(t, t_stop, 0.4), s0=0.92)
    footnote(frame, ["근거: 민사집행법 제246조 제2항 · 채무자회생법 제593조",
                     "요건·결과는 법원이 사건별로 판단합니다."], t, 0.5)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 4가지 경로 비교 → 개인회생 강조 (데모) ─────────────────
def scene4(t, dur):
    frame = new_frame()
    hl_at = cue(3, "개인회생")
    scr = screen_paths(t, hl=0, hl_at=hl_at, hl_tag="압류 해제 검토",
                       note=("인가되면 중지된 압류는 효력 상실", "채무자회생법 제615조 제3항"),
                       note_at=cue(3, "압류 효력"))
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 300 + 65, t - hl_at + 0.1)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title=f"통장 압류돼도 {AMOUNT}은 찾을 수 있다?",
    desc=(f"민사집행법은 최저 생계비에 해당하는 예금을 압류하지 못하도록 정하고 있습니다(현재 기준 개인별 예금 잔액 {AMOUNT}, "
          "민사집행법 제246조 제1항 제8호). 생활이 어렵다면 법원에 압류금지채권 범위변경을 신청하거나(같은 조 제2항), "
          "개인회생을 신청하면서 중지명령을 받아 압류 절차를 멈출 수 있습니다. 변제계획이 인가되면 중지된 압류는 효력을 잃습니다"
          "(채무자회생법 제615조 제3항).\n기준 금액은 법령 개정에 따라 달라질 수 있고, 요건과 결과는 법원이 사건별로 판단합니다."),
    feature="익명 채무 체크 > 4가지 해결 경로 비교",
    tags="#통장압류 #압류금지채권 #최저생계비 #압류해제 #개인회생 #마이김변",
    comment=("통장이 압류됐다면 압류금지 범위변경 신청이나 개인회생 중지명령 가능 여부를 먼저 확인하세요. "
             "구체적인 절차는 선택한 변호사와 상담하세요."),
    related="public/articles/wage-garnishment-defense.html",
    slot="5주차 토요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
