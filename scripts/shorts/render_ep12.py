# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP12 렌더러
기획: docs/youtube_shorts_plan_part2.md  #12 "법원에서 '보정권고' 받았다면, 겁먹지 마세요"

공통 규격은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep12/
실행: python scripts/shorts/render_ep12.py
"""
import math
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep12"

SCENES = [
    dict(plan=3.0, caption="법원 노란 봉투,\n[기각일까?]",
         narration="법원에서 '보정권고' 통지서 받고, 덜컥 겁부터 나셨나요?",
         tts="법원에서 보정권고 통지서 받고, 덜컥 겁부터 나셨나요?"),
    dict(plan=6.0, caption="[기각 통지]가\n아닙니다",
         narration="기각 통지가 아니에요. 서류를 보완해 달라는 법원의 절차 안내입니다.",
         tts="기각 통지가 아니에요. 서류를 보완해 달라는 법원의 절차 안내입니다."),
    dict(plan=9.0, caption="[기한 안에]\n서류 보완",
         narration="최근 계좌 내역이나 소득 자료처럼, 법원이 요구한 자료를 정해진 날짜 안에 소명하면 됩니다.",
         tts="최근 계좌 내역이나 소득 자료처럼, 법원이 요구한 자료를 정해진 날짜 안에 소명하면 됩니다."),
    dict(plan=8.0, caption="변호사와\n[함께 점검]",
         narration="혼자 고민하지 말고, 선택한 변호사와 함께 보정 서류를 점검하세요.",
         tts="혼자 고민하지 말고, 선택한 변호사와 함께 보정 서류를 점검하세요."),
    dict(plan=6.0, caption="보정권고,\n[차분하게 대응]",
         narration="보정권고는 절차의 한 과정일 뿐입니다. 오늘부터 차분하게 대응하세요.",
         tts="보정권고는 절차의 한 과정일 뿐입니다. 오늘부터 차분하게 대응하세요."),
]

NOTE = "보정 기한을 지키지 않으면 기각될 수 있으므로 송달일 확인이 필요합니다."
KRAFT = (238, 204, 112)
KRAFT_D = (214, 176, 84)


# ── 장면 1: 떨리는 손에 들린 법원 등기 봉투 (zoom-in) ───────────────
@lru_cache(maxsize=None)
def envelope():
    S, w, h = 2, 760, 480
    im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], 18 * S, fill=KRAFT + (255,))
    d.polygon([(0, 0), (w * S / 2, 170 * S), (w * S, 0)], fill=KRAFT_D + (255,))
    d.text((48 * S, 222 * S), "OO법원", font=font("EB", 40 * S), fill=(92, 64, 20, 255), anchor="lm")
    d.text((48 * S, 272 * S), "등기 · 특별송달", font=font("B", 26 * S), fill=(120, 88, 36, 255), anchor="lm")
    d.rounded_rectangle([370 * S, 300 * S, 710 * S, 430 * S], 12 * S, fill=(255, 253, 245, 255))
    d.text((396 * S, 338 * S), "받는 분", font=font("B", 22 * S), fill=SLATE500, anchor="lm")
    d.text((396 * S, 388 * S), "채무자 ○○○ 귀하", font=font("EB", 30 * S), fill=SLATE900, anchor="lm")
    d.rounded_rectangle([48 * S, 320 * S, 300 * S, 350 * S], 8 * S, fill=(226, 190, 100, 255))
    d.rounded_rectangle([48 * S, 370 * S, 240 * S, 400 * S], 8 * S, fill=(226, 190, 100, 255))
    return im.resize((w, h), Image.LANCZOS)


def scene1(t, dur):
    frame = new_frame(cy=1050, color=(245, 158, 11), alpha=34)
    env = envelope()
    tr = math.sin(t * 38) * 4 + math.sin(t * 23) * 3   # 떨림
    rot = math.sin(t * 29) * 0.8
    cx, cy = 530 + tr, 1060 + math.cos(t * 31) * 3
    place(frame, env, cx, cy, 1.0, rot=rot)
    stamp_in(frame, stamp_img("등기", RED, 170, 170, -14, 50, circle=True), cx + 250, cy - 150, t, 0.5)
    ov, d = overlay()
    thumb(d, cx - 300, cy + 150)
    thumb(d, cx + 300, cy + 150)
    frame.alpha_composite(ov)
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1150)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: 돋보기로 들여다본 '보정권고' ──────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=900, alpha=40)
    paper = paper_img(660, 560, "보정권고", (("사건", "개인회생"), ("보정 기한", "통지서에 기재"),
                                           ("요청", "자료 보완"), (None, None), (None, None)))
    place(frame, paper, 504, 900, pop(t, 0.0, 0.4), dy=40)
    # 돋보기
    mp = ease_in_out((t - 0.3) / 1.8)
    mx, my = lerp(300, 600, mp), lerp(1010, 880, mp) + math.sin(t * 2) * 6
    ov, d = overlay()
    d.ellipse([mx - 110, my - 110, mx + 110, my + 110], fill=(147, 197, 253, 60), outline=SLATE700 + (255,), width=16)
    d.line([(mx + 80, my + 80), (mx + 170, my + 170)], fill=SLATE700 + (255,), width=30)
    comp(frame, ov, pop(t, 0.2, 0.3))
    y = 1300
    xp = pop(t, cue(1, "기각"), 0.3)
    place(frame, card_img(390, 120, "기각 통지", "", "x", RED_D, fill=(60, 24, 36), tsize=36), 285, y, xp)
    if xp >= 1:
        draw_line_progress(frame, [(150, y), (440, y)], pop(t, cue(1, "기각") + 0.4, 0.3), RED, 8)
    place(frame, card_img(400, 120, "보완 요청", "", "check", TEAL, fill=CARD_HL, tsize=36, owidth=5),
          713, y, pop(t, cue(1, "서류를"), 0.35), s0=0.9)
    footnote(frame, [NOTE], t, 0.6, y=1452)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: DocHub 보정 서류 체크리스트 (데모) ───────────────────────
def screen_dochub(t, marks, t_done):
    s = Scr(SLATE50)
    s_header(s, "DocHub 보정 서류")
    s.rr(28, 180, SW - 28, 330, 28, fill=AMBER_L, outline=AMBER, width=3)
    s_icon(s, "clock", 84, 255, 46, AMBER)
    s.text(130, 232, "보정 기한 D-12", 28, SLATE900, "EB", "lm")
    s.text(130, 276, "기한 안에 법원에 제출해야 해요", 20, SLATE700, "B", "lm")
    items = [("최근 1년 계좌 거래내역", "입출금 소명 메모 포함"), ("소득 증빙 자료", "급여명세서·소득금액증명"),
             ("보정서 (소명 내용)", "법원 요청 항목별 답변"), ("재산 목록 수정본", "변경 사항 있을 때")]
    done = 0
    for i, (lab, sub) in enumerate(items):
        p = pop(t, marks[i], 0.3) if i < len(marks) else 0.0
        done += p >= 1
        s_check_row(s, 360 + i * 124, lab, sub, p, h=108)
    # 진행 바
    prog = sum(pop(t, m, 0.3) for m in marks) / len(items)
    s.text(36, 882, "준비 현황", 22, SLATE500, "B", "lm")
    s.text(SW - 36, 882, f"{int(round(prog * len(items)))} / {len(items)}", 22, TEAL_D, "EB", "rm")
    s.rr(28, 906, SW - 28, 930, 12, fill=SLATE200)
    s.rr(28, 906, 28 + max(24, (SW - 56) * prog), 930, 12, fill=TEAL)
    s_button(s, 966, "담당 변호사에게 검토 요청", "on" if t >= t_done else "off", h=92)
    s_toast(s, t, t_done, "제출 서류 정리 완료", "기한 안에 보정서를 제출하세요")
    return s.final()


def scene3(t, dur):
    frame = new_frame()
    marks = [cue(2, "계좌"), cue(2, "소득"), cue(2, "요구한")]
    t_done = cue(2, "소명하면")
    put_phone(frame, screen_dochub(t, marks, t_done), 0, math.sin(t * 1.3) * 5)
    for m, i in zip(marks, range(3)):
        tap(frame, 78, 360 + i * 124 + 54, t - m + 0.05)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 담당 변호사 검토 대화방 (데모) ──────────────────────────
def screen_chat(t, times):
    s = Scr(SLATE100)
    s.rr(0, 0, SW, 170, 0, fill=WHITE)
    s_header(s, "보정 서류 검토")
    s.text(SW / 2, 160, "용감한 고래 42 · 변호사 B", 18, SLATE500, "B", "mm")
    msgs = [("me", ["보정권고 받았어요.", "계좌 내역 이거면 될까요?"]),
            ("them", ["3월 입금 건은 소명이", "필요해요. 메모를 붙여 주세요."]),
            ("me", ["네, 오늘 올릴게요."]),
            ("them", ["확인 후 보정서에", "함께 반영할게요."])]
    y = 206
    for (side, lines), t0 in zip(msgs, times):
        y += s_bubble(s, side, lines, y, pop(t, t0, 0.3), SLATE100,
                      name="변호사 B" if side == "them" else None)
    # 첨부 카드
    if t >= times[2]:
        p = pop(t, times[2] + 0.2, 0.3)
        yy = y + (1 - p) * 20
        s.rr(SW - 330, yy, SW - 28, yy + 90, 20, fill=lerp_color(SLATE100, WHITE, p))
        s_icon(s, "doc", SW - 286, yy + 45, 40, lerp_color(SLATE100, BLUE, p))
        s.text(SW - 250, yy + 32, "계좌내역_소명.pdf", 19, lerp_color(SLATE100, SLATE900, p), "EB", "lm")
        s.text(SW - 250, yy + 62, "업로드 완료", 17, lerp_color(SLATE100, TEAL_D, p), "B", "lm")
    s.rr(0, SH - 120, SW, SH, 0, fill=WHITE)
    s.rr(28, SH - 96, SW - 110, SH - 36, 30, fill=SLATE100)
    s.text(56, SH - 66, "메시지 입력", 20, SLATE400, "B", "lm")
    s.circ(SW - 64, SH - 66, 32, fill=BLUE)
    s_icon(s, "arrow", SW - 64, SH - 66, 30, WHITE)
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    times = [0.3, cue(3, "선택한") - 0.2, cue(3, "함께"), cue(3, "점검하세요")]
    put_phone(frame, screen_chat(t, times), 0, math.sin(t * 1.3) * 5)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="법원에서 '보정권고' 받았다면, 겁먹지 마세요",
    desc=("보정권고는 기각 통지가 아닙니다. 법원이 서류를 보완해 달라고 요청하는 절차 안내입니다. "
          "최근 계좌 내역, 소득 자료처럼 법원이 요구한 자료를 정해진 기한 안에 소명하면 됩니다. "
          "보정 기한을 지키지 않으면 기각될 수 있으므로 송달일을 꼭 확인하세요.\n"
          "보정 서류는 혼자 판단하지 말고 선택한 변호사와 함께 점검하세요."),
    feature="DocHub 보정 서류 체크리스트 · 가명 상담방",
    tags="#보정권고 #개인회생인가 #법원서류 #DocHub #개인회생 #마이김변",
    comment=("보정권고는 많은 개인회생 사건이 거치는 절차입니다. 서류 정리는 DocHub에서 도움받고, "
             "담당 변호사와 함께 검토하세요."),
    related="public/guide/personal-rehabilitation.html",
    slot="5주차 목요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
