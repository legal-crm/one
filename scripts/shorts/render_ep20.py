# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP20 렌더러
기획: docs/youtube_shorts_plan_part2.md  #20 "채권자 집회 날, 법원에 가면 무슨 일이 생길까?"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep20/
실행: python scripts/shorts/render_ep20.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep20"

SCENES = [
    dict(plan=3.0, caption="법원 출석,\n[멱살 잡힐까?]",
         narration="채권자 집회 날, 빚쟁이들이 쫓아와 멱살 잡을까 봐 떨리시나요?",
         tts="채권자 집회 날, 빚쟁이들이 쫓아와 멱살 잡을까 봐 떨리시나요?"),
    dict(plan=6.0, caption="실제로는\n[조용히] 진행돼요",
         narration="영화 같은 일은 거의 없어요. 법정은 조용하고 차분하게 진행됩니다.",
         tts="영화 같은 일은 거의 없어요. 법정은 조용하고 차분하게 진행됩니다."),
    dict(plan=9.0, caption="[신분 확인] 후\n짧게 끝나요",
         narration="회생위원이 변제계획안을 설명하고 신분증을 확인하면, 보통 5분에서 10분이면 끝납니다.",
         tts="회생위원이 변제계획안을 설명하고 신분증을 확인하면, 보통 오 분에서 십 분이면 끝납니다."),
    dict(plan=8.0, caption="[집회 일정]도\n챙겨 드려요",
         narration="이의가 없으면 인가 결정 단계로 이어져요. 회생동행 캘린더가 일정을 챙겨 드립니다.",
         tts="이의가 없으면 인가 결정 단계로 이어져요. 회생동행 캘린더가 일정을 챙겨 드립니다."),
    dict(plan=6.0, caption="두려워 말고\n[인가까지]",
         narration="혼자 가면 떨리지만, 알고 가면 차분해집니다. 일정은 마이김변이 함께 챙깁니다.",
         tts="혼자 가면 떨리지만, 알고 가면 차분해집니다. 일정은 마이김변이 함께 챙깁니다."),
]

NOTE = "채권자 집회는 법원 일정에 따라 진행되며, 신분증 지참이 필요합니다."
NOTE2 = "진행 방식과 소요 시간은 법원·사건마다 다를 수 있습니다."
STONE = (203, 213, 225)
STONE_D = (148, 163, 184)


# ── 장면 1: 법원 청사 앞 뒷모습 (zoom-in) ─────────────────────────
@lru_cache(maxsize=None)
def courthouse():
    S = 2
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, x1, top = 130, 950, 760
    d.polygon([(x0 * S, (top + 130) * S), (540 * S, top * S), (x1 * S, (top + 130) * S)], fill=STONE + (255,))
    d.polygon([((x0 + 50) * S, (top + 116) * S), (540 * S, (top + 30) * S), ((x1 - 50) * S, (top + 116) * S)],
              fill=STONE_D + (255,))
    d.text((540 * S, (top + 88) * S), "OO법원", font=font("EB", 34 * S), fill=(51, 65, 85), anchor="mm")
    d.rectangle([x0 * S, (top + 130) * S, x1 * S, (top + 160) * S], fill=STONE + (255,))
    for i in range(6):
        cx = x0 + 70 + i * (x1 - x0 - 140) / 5
        d.rectangle([(cx - 30) * S, (top + 170) * S, (cx + 30) * S, (top + 560) * S], fill=(226, 232, 240, 255))
        d.rectangle([(cx - 40) * S, (top + 160) * S, (cx + 40) * S, (top + 180) * S], fill=STONE + (255,))
        for k in range(3):
            xx = cx - 18 + k * 18
            d.line([(xx * S, (top + 190) * S), (xx * S, (top + 550) * S)], fill=STONE + (255,), width=3 * S)
    d.rectangle([(x0 + 30) * S, (top + 170) * S, (x1 - 30) * S, (top + 560) * S], fill=None)
    d.rectangle([(x0 + 60) * S, (top + 200) * S, (x1 - 60) * S, (top + 560) * S], fill=None)
    for k in range(4):
        y = top + 560 + k * 34
        d.rectangle([(x0 - 30 - k * 30) * S, y * S, (x1 + 30 + k * 30) * S, (y + 34) * S],
                    fill=lerp_color(STONE, STONE_D, k / 3) + (255,))
    # 문
    d.rounded_rectangle([490 * S, (top + 380) * S, 590 * S, (top + 560) * S], 10 * S, fill=(51, 65, 85, 255))
    return im.resize((W, H), Image.LANCZOS)


@lru_cache(maxsize=None)
def back_person():
    S, w, h = 2, 360, 420
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([110 * S, 20 * S, 250 * S, 170 * S], fill=(15, 23, 42, 255))
    d.rounded_rectangle([20 * S, 160 * S, 340 * S, 520 * S], 140 * S, fill=(30, 41, 59, 255))
    d.rounded_rectangle([150 * S, 140 * S, 210 * S, 190 * S], 20 * S, fill=(15, 23, 42, 255))
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = Image.new("RGBA", (W, H))
    frame.paste(vgradient(W, H, (30, 58, 95), (15, 36, 64)))
    frame.alpha_composite(radial(W, H, 540, 700, 700, (253, 230, 138), 40))
    frame.alpha_composite(courthouse())
    frame = zoom_rgba(frame, 1.0 + 0.12 * ease_in_out(t / dur), 540, 1150)
    # 전경 인물 (줌 영향 적게, 떨림)
    tr = math.sin(t * 30) * 2
    frame.alpha_composite(back_person(), (int(540 - 180 + tr), 1360))
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 정숙한 법정 내부 일러스트 ───────────────────────────
@lru_cache(maxsize=None)
def courtroom():
    S = 2
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    WOOD, WOOD_D, WOOD_L = (146, 100, 62), (112, 74, 44), (176, 128, 84)
    # 벽·엠블럼
    d.rectangle([60 * S, 640 * S, 1020 * S, 1400 * S], fill=(36, 60, 92, 255))
    d.ellipse([470 * S, 670 * S, 610 * S, 810 * S], fill=(212, 175, 55, 255))
    d.ellipse([490 * S, 690 * S, 590 * S, 790 * S], fill=(36, 60, 92, 255))
    # 법대
    d.rectangle([160 * S, 850 * S, 920 * S, 1010 * S], fill=WOOD + (255,))
    d.rectangle([160 * S, 850 * S, 920 * S, 872 * S], fill=WOOD_L + (255,))
    for cx in (330, 540, 750):
        d.rounded_rectangle([(cx - 50) * S, 780 * S, (cx + 50) * S, 860 * S], 20 * S, fill=(30, 41, 59, 255))
    # 증언대·좌석 (원근)
    d.rectangle([420 * S, 1080 * S, 660 * S, 1160 * S], fill=WOOD_D + (255,))
    for k in range(3):
        y = 1220 + k * 90
        x0 = 120 - k * 50
        x1 = 960 + k * 50
        d.rounded_rectangle([x0 * S, y * S, 470 * S, (y + 60) * S], 12 * S, fill=WOOD + (255,))
        d.rounded_rectangle([610 * S, y * S, x1 * S, (y + 60) * S], 12 * S, fill=WOOD + (255,))
    return im.resize((W, H), Image.LANCZOS)


def scene2(t, dur):
    frame = new_frame(cy=900, color=(253, 230, 138), alpha=30)
    frame.alpha_composite(courtroom())
    # 부드럽게 흔들리는 빛
    frame.alpha_composite(radial(W, H, 540, 760, 520, (253, 230, 138), int(30 + 10 * math.sin(t * 1.5)) // 5 * 5))
    tags = [("조용한 법정", "calm", cue(1, "법정은")), ("차분한 진행", "calm2", cue(1, "차분하게"))]
    for i, (lab, _, t0) in enumerate(tags):
        place(frame, card_img(330, 100, lab, "", "check", TEAL, fill=CARD_HL, tsize=32), 290 + i * 428, 1450 - 50,
              pop(t, t0, 0.35), dy=20)
    frame = zoom_rgba(frame, 1.04 - 0.04 * ease_out(t / dur), W / 2, 1000)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 변제계획안 설명 · 신분증 확인 · 타이머 ────────────────────
def scene3(t, dur):
    frame = new_frame(cy=950, alpha=36)
    t_plan, t_id, t_time = cue(2, "변제계획안"), cue(2, "신분증"), cue(2, "보통")
    place(frame, vcard_img(390, 300, "변제계획안", "회생위원이 설명", "doc", BLUE), 290, 820, pop(t, t_plan, 0.4), s0=0.9)
    place(frame, vcard_img(390, 300, "신분증 확인", "본인 확인 절차", "id", TEAL, fill=CARD_HL, owidth=5),
          718, 820, pop(t, t_id, 0.4), s0=0.9)
    tp = pop(t, t_time, 0.4)
    if tp > 0:
        cx, cy, r = 504, 1180, 140
        ov, d = overlay()
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CARD + (255,), outline=(51, 65, 85, 255), width=18)
        prog = clamp((t - t_time) / 2.5)
        d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * ease_in_out(prog) * 0.8, fill=TEAL + (255,), width=18)
        d.text((cx, cy - 20), "보통", font=font("B", 30), fill=SLATE300 + (255,), anchor="mm")
        d.text((cx, cy + 30), "5~10분", font=font("EB", 52), fill=WHITE + (255,), anchor="mm")
        comp(frame, ov, tp)
        place(frame, icon("gavel", 110, (212, 175, 55)), cx + 250, cy + 20, pop(t, t_time + 0.3, 0.3), dy=-30,
              rot=12 * math.sin(clamp((t - t_time - 0.3) / 0.4) * math.pi))
    footnote(frame, [NOTE, NOTE2], t, 0.6)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 회생동행 캘린더 — 채권자 집회 안내 (데모) ──────────────────
def screen_meeting(t, marks, t_next, t_toast):
    s = Scr(SLATE50)
    s_header(s, "회생동행")
    s.text(36, 196, "단단한 바위 71 님", 28, SLATE900, "EB", "lm")
    s_tag(s, SW - 36, 178, "개시 결정 후", TEAL_L, TEAL_D, 19, 36, anchor="r")
    s.rr(28, 236, SW - 28, 430, 30, fill=NAVY)
    s_tag(s, 56, 258, "채권자 집회 D-3", TEAL, WHITE, 21, 42)
    s.text(56, 342, "○월 ○일 (화) 오후 2:00", 32, WHITE, "EB", "lm")
    s.text(56, 392, "OO법원 ○호 법정", 21, SLATE300, "B", "lm")
    s.circ(SW - 96, 340, 40, fill=lerp_color(NAVY, WHITE, 0.15))
    s_icon(s, "calendar", SW - 96, 340, 42, WHITE)
    s.text(36, 474, "준비물 체크", 24, SLATE900, "EB", "lm")
    items = [("신분증", "주민등록증·운전면허증"), ("변제계획안 사본", "담당 변호사가 안내"),
             ("20분 일찍 도착", "법정 위치 미리 확인")]
    for i, ((lab, sub), m) in enumerate(zip(items, marks)):
        s_check_row(s, 500 + i * 118, lab, sub, pop(t, m, 0.3), h=104)
    # 다음 단계 타임라인
    np_ = pop(t, t_next, 0.4)
    y = 870
    steps = ["개시 결정", "채권자 집회", "인가 여부 결정"]
    for i, lab in enumerate(steps):
        x = 70 + i * 202
        on = i < 2 or np_ > 0.5
        s.circ(x, y, 14, fill=TEAL if on else SLATE300)
        s.text(x, y + 38, lab, 17, SLATE900 if on else SLATE400, "EB", "mm")
        if i < 2:
            s.line([(x + 18, y), (x + 184, y)], TEAL if (i == 0 or np_ > 0.5) else SLATE300, 4)
    s.text(SW / 2, 960, "인가 여부는 법원이 판단합니다", 17, SLATE400, "B", "mm")
    s_toast(s, t, t_toast, "집회 알림 설정 완료", "하루 전·당일 아침에 알려 드려요", kind="bell")
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    t_next = cue(3, "인가")
    marks = [cue(3, "회생동행"), cue(3, "캘린더가"), cue(3, "일정을")]
    t_toast = cue(3, "챙겨") + 0.2
    put_phone(frame, screen_meeting(t, marks, t_next, t_toast), 0, math.sin(t * 1.3) * 5)
    for i, m in enumerate(marks):
        tap(frame, 78, 500 + i * 118 + 52, t - m + 0.05)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="채권자 집회 날, 법원에 가면 무슨 일이 생길까?",
    desc=("개인회생 채권자 집회는 영화처럼 소란스러운 자리가 아닙니다. 보통 회생위원이 변제계획안을 설명하고 "
          "신분증으로 본인을 확인하며, 짧은 시간 안에 차분하게 진행됩니다. 이의가 없으면 인가 여부 결정 단계로 이어집니다.\n"
          "진행 방식과 소요 시간은 법원·사건마다 다를 수 있고, 신분증 지참이 필요합니다. 인가 여부는 법원이 판단합니다."),
    feature="마이김변 마이페이지 > 회생동행 (채권자 집회 일정·준비물 알림)",
    tags="#채권자집회 #회생법원 #개인회생인가 #출석체크 #회생동행 #마이김변",
    comment=("채권자 집회에 실제 금융기관 채권자가 참석하는 경우는 많지 않습니다. 질문에는 정직하게 답변하시고, "
             "준비물은 담당 변호사와 미리 확인하세요."),
    related="src/components/client/landing/ServiceGuideSection.tsx",
    slot="8주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
