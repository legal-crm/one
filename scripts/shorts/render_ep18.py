# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP18 렌더러
기획: docs/youtube_shorts_plan_part2.md  #18 "개인파산, 왜 누구는 되고 누구는 안 될까?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep18/
실행: python scripts/shorts/render_ep18.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep18"

SCENES = [
    dict(plan=3.0, caption="개인파산,\n[난 안 될까?]",
         narration="개인파산은 조건이 까다로워서 아무나 안 된다는 말, 사실일까요?",
         tts="개인파산은 조건이 까다로워서 아무나 안 된다는 말, 사실일까요?"),
    dict(plan=6.0, caption="[변제 능력]이\n핵심",
         narration="고령이나 질병으로 일해서 빚을 갚기 어려운 상황이라면, 파산을 검토합니다.",
         tts="고령이나 질병으로 일해서 빚을 갚기 어려운 상황이라면, 파산을 검토합니다."),
    dict(plan=9.0, caption="[면책 불허가]\n사유 확인",
         narration="재산을 숨기거나 도박, 낭비 같은 사유가 없다면, 성실하지만 불운한 채무자의 면책이 제도의 취지예요.",
         tts="재산을 숨기거나 도박, 낭비 같은 사유가 없다면, 성실하지만 불운한 채무자의 면책이 제도의 취지예요."),
    dict(plan=8.0, caption="회생? 파산?\n[1분 비교]",
         narration="소득과 건강 상태에 따라, 회생과 파산 중 어느 쪽이 맞는지 1분 만에 비교해 보세요.",
         tts="소득과 건강 상태에 따라, 회생과 파산 중 어느 쪽이 맞는지 일 분 만에 비교해 보세요."),
    dict(plan=6.0, caption="[새 출발],\n먼저 점검하세요",
         narration="갚을 수 없는 빚을 평생 안고 가지 마세요. 파산 자격부터 익명으로 점검하세요.",
         tts="갚을 수 없는 빚을 평생 안고 가지 마세요. 파산 자격부터 익명으로 점검하세요."),
]

LAW = "근거: 채무자회생법 제564조 (면책 불허가 사유) · 최종 판단은 법원"
FOLDER = (180, 140, 90)
FOLDER_D = (150, 112, 68)


# ── 장면 1: 낡은 서류철을 넘기는 손 (zoom-in) ─────────────────────
PW_, PH_ = 600, 720
FX, FY = 504 - PW_ // 2, 700


@lru_cache(maxsize=None)
def page(idx):
    titles = ["독촉장", "대출 약정서", "카드 명세서", "지급명령", "연체 안내"]
    pp = paper_img(PW_ - 80, PH_ - 80, titles[idx % len(titles)],
                   (("채권자", "○○○"), ("금액", "○○○만 원"), (None, None), (None, None), (None, None)),
                   accent=SLATE500, note=None)
    return pp


def scene1(t, dur):
    frame = new_frame(cy=1050, color=(245, 158, 11), alpha=22)
    ov, d = overlay()
    d.rounded_rectangle([FX - 30, FY - 30, FX + PW_ + 30, FY + PH_ + 30], 28, fill=FOLDER_D + (255,))
    d.rounded_rectangle([FX - 10, FY - 70, FX + 200, FY], 18, fill=FOLDER_D + (255,))
    frame.alpha_composite(ov)
    flip_every = 0.7
    n = int(max(0, t - 0.4) / flip_every)
    under = page(n + 1)
    frame.alpha_composite(under, (FX - 40 + 40, FY - 40 + 40))
    top = page(n)
    f = ((t - 0.4) % flip_every) / flip_every if t >= 0.4 else 0
    e = ease_in_out(clamp(f / 0.6))
    sx = abs(math.cos(e * math.pi))
    if e < 0.5:
        w = max(2, int(top.width * sx))
        im = top.resize((w, top.height), Image.LANCZOS)
        shade = Image.new("RGBA", im.size, (0, 0, 0, int(90 * e)))
        im.alpha_composite(Image.composite(shade, Image.new("RGBA", im.size, (0, 0, 0, 0)), im.getchannel("A")))
        frame.alpha_composite(im, (FX + (top.width - w) - 0, FY))
    # 손 (주름 표현)
    ov, d = overlay()
    hx = FX + PW_ - 20 - 300 * e if e < 0.5 else FX + PW_ - 20
    hy = FY + 380 + math.sin(t * 3) * 6
    thumb(d, hx, hy, 84, 140)
    for k in range(3):
        d.arc([hx - 26, hy + 60 + k * 16, hx + 26, hy + 80 + k * 16], 200, 340, fill=SKIN_D + (255,), width=3)
    frame.alpha_composite(ov)
    frame = zoom_rgba(frame, 1.0 + 0.08 * ease_in_out(t / dur), W / 2, 1600)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 진단서 + 소득 0원 ────────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=950, alpha=36)
    place(frame, vcard_img(390, 320, "고령·질병", "진단서·소견서", "medical", RED, sub2="근로 어려움"),
          290, 880, pop(t, cue(1, "고령이나"), 0.4), s0=0.9)
    ip = pop(t, cue(1, "일해서"), 0.4)
    place(frame, vcard_img(390, 320, "월 소득 0원", "갚을 재원 없음", "coin", SLATE500, outline=SLATE500,
                           sub2=""), 718, 880, ip, s0=0.9)
    # 변제 능력 게이지
    gp = pop(t, cue(1, "어려운"), 0.8)
    if gp > 0:
        ov, d = overlay()
        y = 1130
        d.text((CAP_X, y), "변제 능력", font=font("EB", 36), fill=WHITE + (255,), anchor="lm")
        d.rounded_rectangle([CAP_X, y + 40, RIGHT, y + 84], 22, fill=(28, 50, 82, 255))
        lvl = lerp(0.85, 0.08, gp)
        d.rounded_rectangle([CAP_X, y + 40, CAP_X + max(44, (RIGHT - CAP_X) * lvl), y + 84], 22,
                            fill=lerp_color(TEAL, RED, gp) + (255,))
        d.text((RIGHT, y), "낮음" if gp > 0.7 else "", font=font("EB", 32), fill=(252, 165, 165, 255), anchor="rm")
        comp(frame, ov, min(1, gp * 3))
    text_box(frame, CAP_X, 1270, 828, 120, "이럴 땐 개인파산 검토", "", TEAL, pop(t, cue(1, "파산을"), 0.4), tsize=40)
    footnote(frame, ["파산·면책 여부는 소득·재산·사정을 종합해 법원이 판단합니다."], t, 0.6, y=1452)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 면책 불허가 사유 X 표시 → 성실·불운 원칙 ─────────────────
REASONS = [("재산 은닉", "eye_off", "숨기거나"), ("도박", "dice", "도박"), ("낭비", "card", "낭비")]


def scene3(t, dur):
    frame = new_frame(cy=950, alpha=36)
    for i, (lab, ic, kw) in enumerate(REASONS):
        cx = 220 + i * 284
        t0 = cue(2, kw)
        p = pop(t, t0 - 0.1, 0.35)
        place(frame, vcard_img(250, 290, lab, "없다면", ic, SLATE500, outline=SLATE500, tsize=38), cx, 830, p, s0=0.9)
        xp = pop(t, t0 + 0.35, 0.25)
        if xp > 0:
            ov, d = overlay()
            s = 70 * xp
            d.line([(cx - s, 760 - s), (cx + s, 760 + s)], fill=RED + (255,), width=16)
            d.line([(cx - s, 760 + s), (cx + s, 760 - s)], fill=RED + (255,), width=16)
            comp(frame, ov, xp)
    bp = pop(t, cue(2, "성실하지만"), 0.45)
    place(frame, card_img(828, 170, "성실하지만 불운한 채무자", "면책이 제도의 취지", "shield", TEAL, fill=CARD_HL, tsize=42,
                          ssize=30, owidth=5), 504, 1150, bp, s0=0.92)
    footnote(frame, [LAW, "재산 은닉·편파 변제 여부는 선택한 변호사와 사전 검토하세요."], t, 0.5, y=1400)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 회생 vs 파산 1분 자가진단 (데모) ───────────────────────
QUESTIONS = [("매달 일정한 소득이 있나요?", "아니요"), ("건강 때문에 일하기 어렵나요?", "예"),
             ("숨긴 재산이 없나요?", "예")]


def screen_diag(t, ans_t, t_res):
    s = Scr(SLATE50)
    s_header(s, "회생·파산 1분 비교")
    s.text(36, 200, "간단 자가진단", 30, SLATE900, "EB", "lm")
    for i, ((q, a), t0) in enumerate(zip(QUESTIONS, ans_t)):
        y = 240 + i * 150
        s.rr(28, y, SW - 28, y + 134, 26, fill=WHITE, outline=SLATE200, width=2)
        s.text(56, y + 36, f"Q{i + 1}. {q}", 22, SLATE900, "EB", "lm")
        for j, opt in enumerate(("예", "아니요")):
            x0 = 56 + j * 222
            on = t >= t0 and opt == a
            s.rr(x0, y + 66, x0 + 206, y + 116, 18, fill=TEAL if on else SLATE100, outline=None)
            s.text(x0 + 103, y + 91, opt, 22, WHITE if on else SLATE500, "EB", "mm")
    # 결과 게이지
    rp = pop(t, t_res, 0.3)
    y0 = 700
    s.rr(28, y0, SW - 28, y0 + 330, 30, fill=lerp_color(SLATE50, WHITE, rp), outline=lerp_color(SLATE50, SLATE200, rp),
         width=2)
    if rp > 0:
        cx, cy, r = SW / 2, y0 + 220, 150
        s.arc((cx - r, cy - r, cx + r, cy + r), 180, 270, lerp_color(WHITE, TEAL, rp), 26)
        s.arc((cx - r, cy - r, cx + r, cy + r), 270, 360, lerp_color(WHITE, BLUE, rp), 26)
        s.text(cx - r - 10, cy + 34, "개인회생", 20, TEAL_D, "EB", "mm")
        s.text(cx + r + 10, cy + 34, "개인파산", 20, BLUE_D, "EB", "mm")
        ang = math.radians(180 + lerp(20, 150, ease_out((t - t_res) / 1.0)))
        s.line([(cx, cy), (cx + (r - 30) * math.cos(ang), cy + (r - 30) * math.sin(ang))], SLATE900, 8)
        s.circ(cx, cy, 14, fill=SLATE900)
        s.text(cx, y0 + 40, "결과", 20, SLATE500, "B", "mm")
        if t >= t_res + 1.0:
            lab = "파산 쪽 검토"
            s_tag(s, cx - (s.tlen(lab, 20, "EB") + 28) / 2, cy + 48, lab, BLUE, WHITE, 20, 40)
    s_button(s, 1050, "파산 경험 변호사 보기", "on" if t >= t_res + 1.0 else "off", h=82)
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    ans_t = [cue(3, "소득과"), cue(3, "건강"), cue(3, "회생과")]
    t_res = cue(3, "어느 쪽이")
    put_phone(frame, screen_diag(t, ans_t, t_res), 0, math.sin(t * 1.3) * 5)
    for i, t0 in enumerate(ans_t):
        a = QUESTIONS[i][1]
        tap(frame, 56 + (0 if a == "예" else 222) + 103, 240 + i * 150 + 91, t - t0 + 0.05)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="개인파산, 왜 누구는 되고 누구는 안 될까?",
    desc=("개인파산은 고령·질병 등으로 일해서 빚을 갚기 어려운 분을 위한 제도입니다. 재산 은닉, 도박·낭비 같은 "
          "면책 불허가 사유(채무자회생법 제564조)가 없다면, 성실하지만 불운한 채무자에게 면책 기회를 주는 것이 "
          "제도의 취지입니다.\n소득과 건강 상태에 따라 회생과 파산 중 어느 쪽이 맞는지 먼저 비교해 보세요. "
          "최종 면책 여부는 법원이 판단합니다."),
    feature="익명 채무 체크 > 회생·파산 자가진단",
    tags="#개인파산 #면책불허가 #파산자격 #파산면책 #채무면제 #마이김변",
    comment=("파산은 장래 소득 활동이 어려운 분들을 위한 법적 구제책입니다. 재산 은닉이나 편파 변제 여부는 "
             "선택한 변호사와 사전에 검토하세요."),
    related="public/guide/bankruptcy.html",
    slot="7주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
