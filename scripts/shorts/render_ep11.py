# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP11 렌더러
기획: docs/youtube_shorts_plan_part2.md  #11 "내가 회생하면 가족 보증인은 어떻게 될까?"

공통 규격·폰 목업·자막·오디오 파이프라인은 render_ep01.py, Part 2 공통 요소는 part2_kit.py 를 재사용한다.
출력: assets/shorts/ep11/
실행: python scripts/shorts/render_ep11.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part2_kit import *  # noqa: E402,F401,F403
import part2_kit as kit  # noqa: E402

EP = "ep11"

SCENES = [
    dict(plan=3.0, caption="내가 회생하면\n[가족은?]",
         narration="내가 개인회생 하면, 보증 선 가족은 어떻게 될까요?",
         tts="내가 개인회생 하면, 보증 선 가족은 어떻게 될까요?"),
    dict(plan=6.0, caption="[보증인]에게\n청구 갑니다",
         narration="솔직히 말씀드리면, 주채무자가 면책돼도 보증인에겐 청구가 가요.",
         tts="솔직히 말씀드리면, 주채무자가 면책돼도 보증인에겐 청구가 가요."),
    dict(plan=9.0, caption="함께 [조정]하는\n방법도",
         narration="그래서 보증인도 함께 채무조정을 밟거나, 신용회복을 연계하는 전략이 필요합니다.",
         tts="그래서 보증인도 함께 채무조정을 밟거나, 신용회복을 연계하는 전략이 필요합니다."),
    dict(plan=8.0, caption="[보증 채무]부터\n정리",
         narration="내 사건에 보증인이 있다면, 상담 전에 채무 구조부터 정확히 적어야 해요.",
         tts="내 사건에 보증인이 있다면, 상담 전에 채무 구조부터 정확히 적어야 해요."),
    dict(plan=6.0, caption="가족 빚,\n[숨기지 마세요]",
         narration="번호 남기기 전에 가족부터 챙기세요. 익명으로 먼저 정리해 보세요.",
         tts="번호 남기기 전에 가족부터 챙기세요. 익명으로 먼저 정리해 보세요."),
]

LAW = "근거: 채무자회생법 제625조 제3항 (면책은 보증인에 대한 권리에 영향 없음)"


# ── 장면 1: 한숨 쉬며 보는 입출금 내역 (zoom-in) ─────────────────
TX = [  # (내용, 금액, 빨강 여부)
    ("카드 대금", "-1,240,000", True),
    ("대출 이자", "-386,000", True),
    ("급여 입금", "+2,310,000", False),
    ("캐피탈 상환", "-520,000", True),
    ("연체 안내 문자", "D+32", True),
    ("카드론 이자", "-214,000", True),
]


def screen_bank(t):
    s = Scr(SLATE50)
    s_header(s, "입출금 내역")
    s.rr(28, 180, SW - 28, 370, 30, fill=NAVY)
    s.text(60, 222, "내 계좌", 22, SLATE300, "B", "lm")
    bal = int(lerp(412000, 12480, ease_in_out((t - 0.3) / 1.8)))
    s.text(60, 290, f"{bal:,}원", 52, WHITE, "EB", "lm")
    s_tag(s, 60, 318, "이번 달 출금 예정 4건", (51, 65, 85), SLATE200, 18, 34)
    for i, (lab, amt, neg) in enumerate(TX):
        p = pop(t, 0.2 + i * 0.28, 0.3)
        if p <= 0:
            continue
        y = 400 + i * 112 + (1 - p) * 30
        s.rr(28, y, SW - 28, y + 96, 22, fill=lerp_color(SLATE50, WHITE, p))
        s.circ(82, y + 48, 26, fill=lerp_color(SLATE50, (254, 226, 226) if neg else TEAL_L, p))
        s_icon(s, "card" if neg else "coin", 82, y + 48, 28, RED if neg else TEAL_D, p)
        s.text(126, y + 48, lab, 24, lerp_color(SLATE50, SLATE900, p), "EB", "lm")
        s.text(SW - 52, y + 48, amt, 24, lerp_color(SLATE50, RED if neg else TEAL_D, p), "EB", "rm")
    return s.final()


def scene1(t, dur):
    frame = new_frame(cy=1250, alpha=40)
    put_phone(frame, screen_bank(t), 0, math.sin(t * 1.2) * 4)
    # 한숨 말풍선
    p = pop(t, 0.9, 0.4)
    if p > 0:
        ov, d = overlay()
        x, y = 660, 610 - p * 20
        d.rounded_rectangle([x, y, x + 230, y + 96], 48, fill=(255, 255, 255, 235))
        d.ellipse([x + 20, y + 88, x + 44, y + 112], fill=(255, 255, 255, 235))
        d.ellipse([x + 4, y + 118, x + 18, y + 132], fill=(255, 255, 255, 235))
        d.text((x + 115, y + 48), "휴…", font=font("EB", 44), fill=SLATE700 + (255,), anchor="mm")
        comp(frame, ov, p * (1 - pop(t, 2.1, 0.4)))
    # '보증 선 가족' 아이콘
    fp = pop(t, cue(0, "보증"), 0.35)
    if fp > 0:
        place(frame, card_img(340, 110, "보증 선 가족", "", "family", RED, fill=(60, 24, 36), tsize=34),
              600, 1130, fp, dy=30, s0=0.85)
    frame = zoom_rgba(frame, 1.0 + 0.10 * ease_in_out(t / dur), W / 2, 1300)
    draw_caption(frame, SCENES[0]["caption"], t)
    return frame


# ── 장면 2: '연대보증인' 붉은 도장 ────────────────────────────
def scene2(t, dur):
    frame = new_frame(cy=900, alpha=40)
    paper = paper_img(640, 520, "보증계약서", (("주채무자", "본인"), ("연대보증인", "가족"),
                                             ("보증 금액", "3,000만 원"), (None, None), (None, None)))
    t_stamp = cue(1, "보증인에겐")
    sx, sy = shake_xy(t, t_stamp + 0.2, 10)
    place(frame, paper, 504 + sx, 900 + sy, pop(t, 0.0, 0.4), dy=50)
    stamp_in(frame, stamp_img("연대보증인", RED, 330, 124, -12), 545, 890, t, t_stamp)
    # 면책 → 청구 흐름
    y = 1290
    lp = pop(t, cue(1, "주채무자"), 0.35)
    place(frame, card_img(330, 110, "주채무자", "면책 결정", "person", TEAL, tsize=32, ssize=24), 255, y, lp, dy=24)
    ap = pop(t, cue(1, "면책돼도"), 0.5)
    if ap > 0:
        draw_line_progress(frame, [(430, y), (540, y)], ap, SLATE300, 8)
        if ap >= 1:
            place(frame, icon("arrow", 44, SLATE300), 548, y, 1)
    rp = pop(t, t_stamp, 0.35)
    place(frame, card_img(330, 110, "보증인", "청구는 계속", "family", RED, fill=(60, 24, 36), tsize=32, ssize=24),
          753, y, rp, dy=24)
    footnote(frame, [LAW, "사건 사정에 따라 대응 방안이 다릅니다."], t, 0.6)
    draw_caption(frame, SCENES[1]["caption"], t)
    return frame


# ── 장면 3: 두 갈래 보호 전략 ────────────────────────────────
def scene3(t, dur):
    frame = new_frame(cy=1000, color=(13, 148, 136), alpha=36)
    top = card_img(440, 120, "보증 채무", "주채무자 + 가족 보증인", "doc", AMBER, tsize=38, ssize=24)
    place(frame, top, 504, 700, pop(t, 0.1, 0.4))
    t_l, t_r = cue(2, "보증인도"), cue(2, "신용회복")
    branch = [(504, 762), (504, 830)]
    draw_line_progress(frame, branch, pop(t, t_l - 0.3, 0.3), SLATE300, 8)
    draw_line_progress(frame, [(504, 830), (290, 830), (290, 900)], pop(t, t_l - 0.1, 0.35), TEAL, 8)
    draw_line_progress(frame, [(504, 830), (718, 830), (718, 900)], pop(t, t_r - 0.2, 0.35), BLUE, 8)
    place(frame, vcard_img(390, 300, "보증인도 함께", "채무조정 절차", "family", TEAL, sub2="동시 진행 검토"),
          290, 1050, pop(t, t_l, 0.4), s0=0.9)
    place(frame, vcard_img(390, 300, "신용회복 연계", "신용회복위원회", "handshake", BLUE, sub2="조정 제도 검토"),
          718, 1050, pop(t, t_r, 0.4), s0=0.9)
    text_box(frame, CAP_X, 1240, 828, 150, "사건마다 전략이 달라요", "보증인과의 관계·채권자 성격부터 정리",
             TEAL, pop(t, cue(2, "전략이"), 0.4), tsize=42, ssize=28)
    footnote(frame, [LAW], t, 0.4, y=1452)
    draw_caption(frame, SCENES[2]["caption"], t)
    return frame


# ── 장면 4: 익명 체크 — 보증 채무 표시 → 변호사 선택 (데모) ───────────
DEBTS = [("A카드", "1,200만 원", False), ("B캐피탈", "800만 원", True),
         ("C은행 신용대출", "1,500만 원", True), ("D카드론", "400만 원", False)]


def screen_check(t, t_toggle, t_tags, t_ready, t_tap):
    s = Scr(SLATE50)
    s_header(s, "익명 채무 체크")
    s.text(36, 200, "채무 구조 적기", 36, SLATE900, "EB", "lm")
    s_tag(s, SW - 36, 182, "2 / 3 단계", TEAL_L, TEAL_D, 19, 36, anchor="r")
    # 보증인 토글 카드
    tp = pop(t, t_toggle, 0.3)
    s.rr(28, 250, SW - 28, 370, 26, fill=WHITE, outline=lerp_color(SLATE200, TEAL, tp), width=3)
    s.circ(84, 310, 32, fill=lerp_color(SLATE100, TEAL_L, tp))
    s_icon(s, "family", 84, 310, 38, lerp_color(SLATE500, TEAL_D, tp))
    s.text(136, 292, "보증인이 있는 채무", 26, SLATE900, "EB", "lm")
    s.text(136, 330, "가족·지인이 보증을 섰어요", 19, SLATE500, "B", "lm")
    toggle(s, SW - 144, 285, tp)
    # 채무 목록
    s.text(36, 412, "채무 목록", 22, SLATE500, "B", "lm")
    gp = pop(t, t_tags, 0.35)
    for i, (name, amt, guar) in enumerate(DEBTS):
        y = 440 + i * 116
        hl = guar and gp > 0
        s.rr(28, y, SW - 28, y + 100, 22, fill=lerp_color(WHITE, AMBER_L, gp * 0.6) if guar else WHITE,
             outline=lerp_color(SLATE200, AMBER, gp) if guar else SLATE200, width=3 if hl else 2)
        s.text(56, y + 34, name, 24, SLATE900, "EB", "lm")
        s.text(56, y + 70, amt, 21, SLATE500, "B", "lm")
        if hl:
            s_tag(s, SW - 52, y + 32 - (1 - gp) * 8, "보증인 있음", AMBER, WHITE, 18, 36, anchor="r")
    # 요약 + 버튼
    if t >= t_tags + 0.4:
        p = pop(t, t_tags + 0.4, 0.35)
        s.rr(28, 916, SW - 28, 980, 20, fill=lerp_color(SLATE50, SLATE900, p))
        s.text(SW / 2, 948, "보증 채무 2건 · 상담 때 함께 확인", 21, lerp_color(SLATE900, WHITE, p), "EB", "mm")
    pressed = t_tap <= t < t_tap + 0.25
    s_button(s, 1004, "변호사 프로필 보기", "pressed" if pressed else ("on" if t >= t_ready else "off"), h=92)
    s_toast(s, t, t_tap + 0.35, "채무 구조 정리 완료", "선택한 변호사에게만 가명으로 전달돼요")
    return s.final()


def scene4(t, dur):
    frame = new_frame()
    t_toggle = cue(3, "보증인이")
    t_tags = cue(3, "채무 구조")
    t_ready = cue(3, "정확히")
    t_tap = max(t_ready + 0.6, dur - 1.6)
    put_phone(frame, screen_check(t, t_toggle, t_tags, t_ready, t_tap), 0, math.sin(t * 1.3) * 5)
    tap(frame, SW - 144 + 44, 310, t - t_toggle + 0.1)
    tap(frame, SW / 2, 1050, t - t_tap)
    draw_caption(frame, SCENES[3]["caption"], t)
    return frame


# ── 장면 5: 엔드카드 (EP01 레이아웃 재사용) ───────────────────
def scene5(t, dur):
    return ep01_endcard(t, dur)


META = dict(
    title="내가 회생하면 가족 보증인은 어떻게 될까?",
    desc=("개인회생에서 주채무자가 면책을 받더라도, 채권자가 보증인에게 갖는 권리에는 영향이 없습니다"
          "(채무자회생법 제625조 제3항). 그래서 가족이 보증을 섰다면 보증인도 함께 채무조정 절차를 검토하거나 "
          "신용회복 제도를 연계하는 전략이 필요할 수 있습니다. 대응 방안은 사건 사정에 따라 다릅니다.\n"
          "상담 전에 어떤 채무에 보증인이 있는지, 채무 구조부터 정확히 정리해 두세요."),
    feature="익명 채무 체크 > 채무 구조 입력 (보증인 있는 채무 표시)",
    tags="#보증채무 #개인회생 #연대보증 #가족빚 #채무상담 #마이김변",
    comment=("보증 채무는 혼자 판단하지 마시고, 보증인과의 관계와 채권자 성격을 정리해 선택한 변호사와 상의하세요. "
             "익명 체크는 0원입니다."),
    related="public/articles/secret-rehabilitation.html",
    slot="5주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META)


if __name__ == "__main__":
    main()
