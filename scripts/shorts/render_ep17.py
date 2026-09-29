# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP17 렌더러
기획: docs/youtube_shorts_plan_part2.md  #17 "카드 돌려막기, 대환대출이 더 위험한 이유"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep17/
실행: python scripts/shorts/render_ep17.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep17"

SCENES = [
    dict(plan=3.0, caption="돌려막기,\n[이번 달도]?",
         narration="카드 돌려막기와 대환대출로, 이번 달도 간신히 넘기셨나요?",
         tts="카드 돌려막기와 대환대출로, 이번 달도 간신히 넘기셨나요?"),
    dict(plan=6.0, caption="원금 그대로,\n[이자만] 늘어요",
         narration="대환대출은 빚을 갚은 게 아니에요. 갚을 날짜만 미루면서 이자가 불어납니다.",
         tts="대환대출은 빚을 갚은 게 아니에요. 갚을 날짜만 미루면서 이자가 불어납니다."),
    dict(plan=9.0, caption="이자 내려 대출,\n[골든타임]",
         narration="이자를 내려고 새 대출을 받는 순간이, 바로 채무조정이 필요한 골든타임입니다.",
         tts="이자를 내려고 새 대출을 받는 순간이, 바로 채무조정이 필요한 골든타임입니다."),
    dict(plan=8.0, caption="돌려막기 멈추고\n[구조조정]",
         narration="1금융부터 대부업까지, 채무를 한 번에 묶어 조정하는 길을 확인하세요.",
         tts="일 금융부터 대부업까지, 채무를 한 번에 묶어 조정하는 길을 확인하세요."),
    dict(plan=6.0, caption="돌려막기,\n[오늘 끝내세요]",
         narration="언제 터질지 모를 돌려막기, 오늘 익명 체크로 탈출구를 찾아보세요.",
         tts="언제 터질지 모를 돌려막기, 오늘 익명 체크로 탈출구를 찾아보세요."),
]

NOTE = "대환대출은 채무를 줄여 주지 않으며, 총 원리금 부담이 커질 수 있습니다."


# ── 장면 1: 캘린더 결제일에 동그라미 (zoom-in) ─────────────────────
CAL_X, CAL_Y, CAL_W, CAL_H = 110, 640, 800, 760
START_COL = 2
DUES = [(5, "A카드", 0.35), (12, "B카드", 0.9), (15, "대환 상환", 1.45), (25, "C카드론", 2.0)]


def day_pos(day):
    r, c = divmod(START_COL + day - 1, 7)
    cw = (CAL_W - 40) / 7
    return CAL_X + 20 + cw * (c + 0.5), CAL_Y + 230 + r * 100


@lru_cache(maxsize=None)
def calendar():
    S = 2
    im = Image.new("RGBA", (CAL_W * S, CAL_H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, CAL_W * S - 1, CAL_H * S - 1], 36 * S, fill=(250, 250, 247, 255))
    d.rounded_rectangle([0, 0, CAL_W * S - 1, 130 * S], 36 * S, fill=NAVY + (255,))
    d.rectangle([0, 90 * S, CAL_W * S - 1, 130 * S], fill=NAVY + (255,))
    d.text((CAL_W * S / 2, 66 * S), "이번 달 결제일", font=font("EB", 44 * S), fill=WHITE, anchor="mm")
    cw = (CAL_W - 40) / 7
    for c, wd in enumerate("일월화수목금토"):
        d.text(((20 + cw * (c + 0.5)) * S, 172 * S), wd, font=font("B", 28 * S),
               fill=(RED if c == 0 else SLATE500), anchor="mm")
    for day in range(1, 31):
        x, y = day_pos(day)
        d.text(((x - CAL_X) * S, (y - CAL_Y) * S), str(day), font=font("B", 34 * S), fill=SLATE700, anchor="mm")
    return im.resize((CAL_W, CAL_H), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=1000, alpha=36)
    frame.alpha_composite(calendar(), (CAL_X, CAL_Y))
    ov, d = overlay()
    for day, lab, t0 in DUES:
        p = clamp((t - t0) / 0.4)
        if p <= 0:
            continue
        x, y = day_pos(day)
        d.arc([x - 46, y - 40, x + 46, y + 40], -100, -100 + 380 * ease_out(p), fill=RED + (255,), width=8)
        if p >= 1:
            f = font("EB", 22)
            tw = d.textlength(lab, font=f)
            d.rounded_rectangle([x - tw / 2 - 12, y + 38, x + tw / 2 + 12, y + 72], 12, fill=RED + (255,))
            d.text((x, y + 55), lab, font=f, fill=WHITE + (255,), anchor="mm")
    frame.alpha_composite(ov)
    # 펜 (마지막 동그라미 위치를 따라감)
    act = [dd for dd in DUES if t >= dd[2]]
    if act:
        day, _, t0 = act[-1]
        x, y = day_pos(day)
        a = math.radians(-100 + 380 * ease_out(clamp((t - t0) / 0.4)))
        px, py = x + 46 * math.cos(a), y + 40 * math.sin(a)
        pen = Image.new("RGBA", (60, 300), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pen)
        pd.rounded_rectangle([14, 30, 46, 300], 14, fill=SLATE700 + (255,))
        pd.polygon([(14, 32), (46, 32), (30, 0)], fill=SKIN + (255,))
        pd.polygon([(24, 12), (36, 12), (30, 0)], fill=SLATE900 + (255,))
        pen = pen.rotate(-30, resample=Image.BICUBIC, expand=True)
        frame.alpha_composite(pen, (int(px - 8), int(py - 6)))
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1600)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 굴러가며 커지는 빚 눈덩이 ────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=1000, color=(239, 68, 68), alpha=26)
    t_roll = cue(1, "갚을 날짜")
    k = ease_in_out(clamp((t - 0.2) / (dur - 0.6)))
    r = lerp(70, 200, k)
    cx, cy = lerp(200, 700, k), 1180 - r
    ov, d = overlay()
    # 경사면
    d.polygon([(0, 1200), (W, 1160), (W, 1240), (0, 1240)], fill=(28, 50, 82, 255))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(241, 245, 249, 255))
    ang = t * 3
    for i in range(5):
        a = ang + i * 1.25
        rr = r * 0.6
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        d.text((x, y), "₩", font=font("EB", int(r * 0.34)), fill=SLATE300 + (255,), anchor="mm")
    frame.alpha_composite(ov)
    # '원금 그대로' 고정 태그, '이자 +' 누적
    place(frame, card_img(330, 100, "원금 그대로", "", "lock", SLATE500, fill=CARD, outline=SLATE500, tsize=32),
          CAP_X + 165, 680, pop(t, cue(1, "대환대출은"), 0.35))
    n = int(clamp((t - t_roll) / 2.4) * 6) if t >= t_roll else 0
    for i in range(n):
        ov, d = overlay()
        x = CAP_X + (i % 2) * 190
        y = 770 + (i // 2) * 76
        d.rounded_rectangle([x, y, x + 170, y + 60], 20, fill=RED + (255,))
        d.text((x + 85, y + 30), f"이자 +{(i + 1) * 12}만", font=font("EB", 26), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, pop(t, t_roll + i * 0.4, 0.25))
    footnote(frame, [NOTE], t, 0.6, y=1452)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 부채 ↑ / 신용점수 ↓ 그래프, 골든타임 표시 ─────────────────
GX0, GY0, GX1, GY1 = CAP_X + 30, 680, RIGHT - 20, 1260


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=36)
    ov, d = overlay()
    d.line([(GX0, GY0), (GX0, GY1), (GX1, GY1)], fill=SLATE400 + (255,), width=4)
    for i, lab in enumerate(("1월", "3월", "6월", "9월", "12월")):
        x = lerp(GX0 + 30, GX1 - 20, i / 4)
        d.text((x, GY1 + 34), lab, font=font("B", 26), fill=SLATE400 + (255,), anchor="mm")
    frame.alpha_composite(ov)
    n = 40
    debt = [(lerp(GX0 + 10, GX1 - 10, i / n), GY1 - 120 - 380 * (i / n) ** 1.8) for i in range(n + 1)]
    score = [(lerp(GX0 + 10, GX1 - 10, i / n), GY0 + 80 + 360 * (i / n) ** 1.5) for i in range(n + 1)]
    gp = clamp((t - 0.3) / 3.2)
    draw_line_progress(frame, debt, gp, RED, 10)
    draw_line_progress(frame, score, gp, BLUE, 10)
    ov, d = overlay()
    d.text((GX1 - 10, GY0 - 10), "총 부채", font=font("EB", 28), fill=RED + (255,), anchor="rm")
    d.text((GX0 + 30, GY0 + 40), "신용점수", font=font("EB", 28), fill=(147, 197, 253, 255), anchor="lm")
    comp(frame, ov, pop(t, 0.6, 0.4))
    # 골든타임 세로선 (교차 지점 부근)
    t_g = cue(2, "골든타임") - 0.5
    xg = None
    for (x1, y1), (_, y2) in zip(debt, score):
        if y1 <= y2:
            xg = x1
            break
    xg = xg or (GX0 + GX1) / 2
    lp = pop(t, t_g, 0.5)
    if lp > 0:
        ov, d = overlay()
        d.rounded_rectangle([xg - 110, GY0, xg + 110, GY1], 20, fill=(245, 158, 11, 60))
        y = GY0
        while y < lerp(GY0, GY1, lp):
            d.line([(xg, y), (xg, min(y + 20, GY1))], fill=AMBER + (255,), width=6)
            y += 34
        comp(frame, ov, lp)
        text_box(frame, CAP_X, 1330, 828, 110, "이자 내려고 새 대출 = 골든타임", "", AMBER, lp, tsize=38)
    ap = pop(t, cue(2, "새 대출"), 0.3)
    if ap > 0:
        ov, d = overlay()
        x, y = xg - 180, GY0 + 150
        d.rounded_rectangle([x, y, x + 250, y + 64], 22, fill=SLATE900 + (255,), outline=RED + (255,), width=3)
        d.text((x + 125, y + 32), "새 대출 +1", font=font("EB", 28), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, ap)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 4가지 경로 비교 (데모) ─────────────────────────────
def scene4(t, dur):
    frame = new_frame()
    hl_at = cue(3, "채무를")
    scr = screen_paths(t, hl=0, hl_at=hl_at, hl_tag="채무 한 번에 조정",
                       note=("1금융부터 대부업까지 함께 검토", "경로마다 대상 채무·요건이 달라요"),
                       note_at=cue(3, "길을"))
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, SW / 2, 365, t - hl_at + 0.1)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="카드 돌려막기, 대환대출이 더 위험한 이유",
    desc=("대환대출은 빚을 갚는 것이 아니라 갚을 날짜를 미루는 것입니다. 원금은 그대로인데 이자 부담이 계속 쌓이고, "
          "총 원리금 부담이 커질 수 있습니다. 이자를 내려고 새 대출을 받는 순간이 채무조정을 검토할 시점입니다.\n"
          "1금융부터 대부업까지 채무를 함께 조정하는 방법이 있는지, 4가지 경로를 비교해 보세요. "
          "경로마다 대상 채무와 요건이 다릅니다."),
    feature="익명 채무 체크 > 4가지 해결 경로 비교",
    tags="#돌려막기 #카드론 #대환대출 #다중채무 #채무조정 #마이김변",
    comment=("다중 채무는 시간이 지날수록 이자 부담이 커집니다. 연체 전이라도 신속채무조정이나 개인회생을 검토할 수 있으니 "
             "먼저 익명으로 채무 구조를 정리해 보세요."),
    related="public/guide/credit-recovery.html",
    slot="7주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
