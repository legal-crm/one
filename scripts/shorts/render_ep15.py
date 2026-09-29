# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP15 렌더러
기획: docs/youtube_shorts_plan_part2.md  #15 "배달라이더·N잡러, 4대 보험 없어도 회생 될까?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep15/
실행: python scripts/shorts/render_ep15.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep15"

SCENES = [
    dict(plan=3.0, caption="4대 보험 없으면\n[회생 불가?]",
         narration="배달 라이더, 프리랜서, 알바... 4대 보험 없으면 회생 안 될까요?",
         tts="배달 라이더, 프리랜서, 알바. 사대 보험 없으면 회생 안 될까요?"),
    dict(plan=6.0, caption="[계속 소득]이면\n신청 가능",
         narration="그렇지 않아요. 4대 보험이 없어도, 계속적인 소득이 있으면 신청할 수 있어요.",
         tts="그렇지 않아요. 사대 보험이 없어도, 계속적인 소득이 있으면 신청할 수 있어요."),
    dict(plan=9.0, caption="[입금 내역]으로\n소득 증빙",
         narration="배달앱 정산 내역이나, 3~6개월 통장 입금 기록으로 소득을 증명합니다.",
         tts="배달앱 정산 내역이나, 삼 개월에서 육 개월 통장 입금 기록으로 소득을 증명합니다."),
    dict(plan=8.0, caption="불규칙 소득,\n[경험] 확인",
         narration="수입이 매달 달라도, 평균 소득 산정 경험이 있는 변호사를 직접 고르세요.",
         tts="수입이 매달 달라도, 평균 소득 산정 경험이 있는 변호사를 직접 고르세요."),
    dict(plan=6.0, caption="일하고 있다면,\n[먼저 확인]",
         narration="땀 흘려 일하고 있다면, 가능성은 충분히 있어요. 1분 만에 소득부터 체크해 보세요.",
         tts="땀 흘려 일하고 있다면, 가능성은 충분히 있어요. 일 분 만에 소득부터 체크해 보세요."),
]

LAW = "근거: 채무자회생법 제579조 (급여소득자·영업소득자의 계속적 수입)"


# ── 장면 1: 바이크 핸들 + 거치대 속 배달앱 (zoom-in) ─────────────────
@lru_cache(maxsize=None)
def handlebar():
    S = 2
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 계기판·핸들 바
    d.rounded_rectangle([300 * S, 1430 * S, 780 * S, 1920 * S], 120 * S, fill=(30, 41, 59, 255))
    d.line([(-40 * S, 1560 * S), (300 * S, 1470 * S), (780 * S, 1470 * S), (1120 * S, 1560 * S)],
           fill=(51, 65, 85, 255), width=54 * S, joint="curve")
    for x0, x1, y in ((-60, 160, 1575), (920, 1140, 1575)):
        d.rounded_rectangle([x0 * S, (y - 46) * S, x1 * S, (y + 46) * S], 40 * S, fill=(17, 24, 39, 255))
        for k in range(5):
            xx = x0 + 40 + k * 32
            d.line([(xx * S, (y - 40) * S), (xx * S, (y + 40) * S)], fill=(40, 50, 66, 255), width=6 * S)
    # 거치대
    d.rounded_rectangle([500 * S, 1300 * S, 580 * S, 1480 * S], 20 * S, fill=(71, 85, 105, 255))
    return im.resize((W, H), Image.LANCZOS)


def mini_app(t):
    S, w, h = 2, 400, 700
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 50 * S, fill=(12, 18, 32, 255), outline=(71, 85, 105, 255), width=4 * S)
    X0, Y0, X1, Y1 = 16 * S, 16 * S, (w - 16) * S, (h - 16) * S
    d.rounded_rectangle([X0, Y0, X1, Y1], 38 * S, fill=(226, 232, 240, 255))
    # 지도 격자
    for k in range(9):
        y = Y0 + (60 + k * 60 + (t * 70) % 60) * S
        if y < Y1 - 250 * S:
            d.line([(X0, y), (X1, y)], fill=(203, 213, 225, 255), width=6 * S)
    for x in (110, 250):
        d.line([(x * S, Y0), (x * S, Y1 - 250 * S)], fill=(203, 213, 225, 255), width=10 * S)
    d.ellipse([(186) * S, 250 * S, 214 * S, 278 * S], fill=BLUE + (255,))
    d.rounded_rectangle([X0, 60 * S, X1, 120 * S], 0, fill=(255, 255, 255, 230))
    d.text((w / 2 * S, 90 * S), "배달 앱", font=font("EB", 26 * S), fill=SLATE900, anchor="mm")
    # 하단 카드
    d.rounded_rectangle([X0 + 10 * S, Y1 - 240 * S, X1 - 10 * S, Y1 - 10 * S], 28 * S, fill=WHITE + (255,))
    d.text((48 * S, (h - 216) * S), "배차 완료 · 오늘 14건", font=font("EB", 25 * S), fill=SLATE900, anchor="lm")
    d.text((48 * S, (h - 170) * S), "오늘 정산", font=font("B", 20 * S), fill=SLATE500, anchor="lm")
    val = int(lerp(96400, 128400, ease_out(t / 2.2)) / 100) * 100
    d.text((48 * S, (h - 120) * S), f"{val:,}원", font=font("EB", 40 * S), fill=TEAL_D, anchor="lm")
    d.rounded_rectangle([48 * S, (h - 82) * S, (w - 48) * S, (h - 44) * S], 16 * S, fill=TEAL + (255,))
    d.text((w / 2 * S, (h - 63) * S), "다음 배달 수락", font=font("EB", 20 * S), fill=WHITE, anchor="mm")
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=900, alpha=30)
    ov, d = overlay()
    # 흘러가는 도로 차선 (원근)
    for k in range(6):
        f = ((t * 0.9 + k / 6) % 1)
        y = lerp(620, 1900, f ** 1.6)
        w = lerp(6, 44, f)
        hh = lerp(20, 160, f)
        d.rounded_rectangle([540 - w / 2, y, 540 + w / 2, y + hh], int(w / 2), fill=(148, 163, 184, int(160 * f)))
    frame.alpha_composite(ov)
    bx, by = math.sin(t * 17) * 3, math.sin(t * 23) * 4
    frame.alpha_composite(handlebar(), (int(bx), int(by)))
    app = mini_app(t)
    frame.alpha_composite(app, (int(540 - app.width / 2 + bx), int(640 + by)))
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1100)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 3.3% 원천징수 영수증 + 계속 소득 체크 ───────────────────
def scene2(t, dur):
    frame = new_frame(cy=900, color=(13, 148, 136), alpha=34)
    paper = paper_img(620, 470, "원천징수 영수증", (("소득 구분", "사업소득 3.3%"), ("지급처", "배달 플랫폼"),
                                                  ("지급액", "2,480,000원"), (None, None)), accent=BLUE)
    place(frame, paper, 504, 870, pop(t, 0.0, 0.4), dy=50)
    y = 1250
    xp = pop(t, cue(1, "사대"), 0.35)
    place(frame, card_img(390, 130, "4대 보험", "없어도 무관", "x", SLATE500, fill=CARD, outline=SLATE500, tsize=34,
                          ssize=24), 285, y, xp)
    cp = pop(t, cue(1, "계속적인"), 0.35)
    place(frame, card_img(400, 130, "계속 소득", "신청 가능", "check", TEAL, fill=CARD_HL, tsize=34, ssize=24, owidth=5),
          713, y, cp, s0=0.9)
    footnote(frame, [LAW, "소득·생계비 산정은 법원이 사건별로 판단합니다."], t, 0.6)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 정산·입금 내역으로 월평균 소득 산정 (데모) ─────────────────
MONTHS = [("4월", 2.1), ("5월", 2.9), ("6월", 2.3), ("7월", 2.7), ("8월", 2.2), ("9월", 2.6)]  # 백만 원


def screen_income(t, t_bars, t_avg, t_clip):
    s = Scr(SLATE50)
    s_header(s, "소득 증빙 정리")
    s.text(36, 200, "최근 6개월 입금", 30, SLATE900, "EB", "lm")
    s.rr(28, 240, SW - 28, 700, 30, fill=WHITE, outline=SLATE200, width=2)
    base_y, maxv, top = 640, 3.2, 300
    bw, gap = 58, 22
    x0 = 28 + (SW - 56 - (bw * 6 + gap * 5)) / 2
    for i, (m, v) in enumerate(MONTHS):
        g = pop(t, t_bars + i * 0.18, 0.4)
        x = x0 + i * (bw + gap)
        hgt = (base_y - top) * v / maxv * g
        if hgt > 4:
            s.rr(x, base_y - hgt, x + bw, base_y, 12, fill=lerp_color(TEAL_L, TEAL, 0.5 + 0.5 * (i % 2)))
        s.text(x + bw / 2, base_y + 28, m, 18, SLATE500, "B", "mm")
        if g >= 1:
            s.text(x + bw / 2, base_y - hgt - 18, f"{v:.1f}", 16, SLATE700, "EB", "mm")
    avg = sum(v for _, v in MONTHS) / len(MONTHS)
    ap = pop(t, t_avg, 0.5)
    if ap > 0:
        ya = base_y - (base_y - top) * avg / maxv
        xe = lerp(x0, x0 + 6 * bw + 5 * gap, ap)
        xx = x0
        while xx < xe:
            s.line([(xx, ya), (min(xx + 16, xe), ya)], BLUE, 4)
            xx += 26
    s.text(SW - 52, 270, "단위: 백만 원", 16, SLATE400, "B", "rm")
    # 평균 카드
    if ap > 0:
        y = 724 + (1 - ap) * 20
        s.rr(28, y, SW - 28, y + 130, 28, fill=lerp_color(SLATE50, NAVY, ap))
        s.text(60, y + 38, "월평균 소득", 20, lerp_color(NAVY, SLATE300, ap), "B", "lm")
        s.text(60, y + 90, f"{int(avg * 100) * 10_000:,}원", 40, lerp_color(NAVY, WHITE, ap), "EB", "lm")
        s_tag(s, SW - 56, y + 70, "영업소득", TEAL, WHITE, 18, 36, anchor="r")
    # 첨부 목록
    for i, lab in enumerate(("배달앱 정산 내역 6건", "통장 입금 내역 (6개월)")):
        p = pop(t, t_clip + i * 0.3, 0.3)
        y = 880 + i * 92 + (1 - p) * 16
        s.rr(28, y, SW - 28, y + 78, 20, fill=lerp_color(SLATE50, WHITE, p), outline=lerp_color(SLATE50, SLATE200, p), width=2)
        s_icon(s, "doc", 70, y + 39, 32, lerp_color(SLATE50, BLUE, p))
        s.text(104, y + 39, lab, 21, lerp_color(SLATE50, SLATE900, p), "EB", "lm")
        if p >= 1:
            check_icon(s, SW - 66, y + 40, 26, TEAL, 5)
    return s.final()


def scene3(t, dur):
    frame = new_frame()
    t_bars, t_avg, t_clip = cue(2, "배달앱") + 0.1, cue(2, "소득을"), cue(2, "통장")
    put_phone(frame, screen_income(t, t_bars, t_avg, t_clip), 0, math.sin(t * 1.3) * 5)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: '프리랜서 소득' 경험 변호사 필터 → 직접 선택 (데모) ──────────
CARDS = lawyers_with("프리랜서 소득", {1, 3})


def scene4(t, dur):
    frame = new_frame()
    t_f, t_sel = cue(3, "평균"), cue(3, "직접")
    scr, tp = screen_profiles(t, CARDS, "프리랜서 소득", t_f, 3, t_sel, filt_label="프리랜서 소득 경험")
    put_phone(frame, scr, 0, math.sin(t * 1.3) * 5)
    tap(frame, 150, 256, t - t_f + 0.1)
    tap(frame, tp[0], tp[1], t - t_sel + 0.1)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="배달라이더·N잡러, 4대 보험 없어도 회생 될까?",
    desc=("개인회생은 4대 보험 가입 여부가 아니라 계속적·반복적인 수입이 있는지가 기준입니다(채무자회생법 제579조). "
          "배달 라이더·프리랜서처럼 사업소득 원천징수를 받는 분도 배달앱 정산 내역, 3~6개월 통장 입금 기록으로 "
          "소득을 증명할 수 있습니다.\n수입이 매달 달라도 평균 소득을 산정하는 방식이 있으니, "
          "관련 경험을 확인하고 변호사를 직접 선택하세요. 소득 산정은 법원이 사건별로 판단합니다."),
    feature="익명 채무 체크 > 소득 입력 · 변호사 프로필 필터",
    tags="#배달라이더회생 #프리랜서개인회생 #N잡러 #소득증빙 #개인회생자격 #마이김변",
    comment=("플랫폼 노동자나 프리랜서는 최근 몇 달의 평균 소득으로 산정하는 경우가 많습니다. "
             "증빙 서류 준비는 선택한 변호사와 함께 맞춰 가시면 됩니다."),
    related="public/guide/occupation-guide.html",
    slot="6주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
