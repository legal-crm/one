# -*- coding: utf-8 -*-
"""
마이김변 유튜브 쇼츠 EP36 렌더러
기획: docs/youtube_shorts_plan_part3.md  #36 "월세가 비싸면 생계비를 더 인정받을까?"

공통 규격은 render_ep01.py, 공통 요소는 part2_kit.py·part3_kit.py 를 재사용한다.
출력: assets/shorts/ep36/
실행: python scripts/shorts/render_ep36.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from part3_kit import *  # noqa: E402,F401,F403
import part3_kit as kit  # noqa: E402
from render_ep34 import house_img  # noqa: E402

EP = "ep36"

SCENES = [
    dict(plan=3.8, caption="월세 비싸면\n[생계비 더?]",
         narration="월세를 많이 내고 있다면, 개인회생에서 생계비를 더 인정받을 수 있을까요?",
         tts="월세를 많이 내고 있다면, 개인회생에서 생계비를 더 인정받을 수 있을까요?"),
    dict(plan=6.0, caption="기본 생계비에\n[주거비 포함]",
         narration="먼저, 기본 생계비 안에는 이미 주거비 일부가 들어 있어요.",
         tts="먼저, 기본 생계비 안에는 이미 주거비 일부가 들어 있어요."),
    dict(plan=8.0, caption="넘는 월세도\n[상한이 있어요]",
         narration="이걸 넘는 월세는 추가 생계비로 검토되지만, 지역별 상한이 있어서 전부 인정되지는 않아요.",
         tts="이걸 넘는 월세는 추가 생계비로 검토되지만, 지역별 상한이 있어서 전부 인정되지는 않아요."),
    dict(plan=8.5, caption="지역마다\n[기준 달라요]",
         narration="서울, 경기, 광역시, 그 밖의 지역처럼 지역 구분에 따라 상한이 달라서, 같은 월세라도 결과가 다를 수 있어요.",
         tts="서울, 경기, 광역시, 그 밖의 지역처럼 지역 구분에 따라 상한이 달라서, 같은 월세라도 결과가 다를 수 있어요."),
    dict(plan=6.0, caption="임대차계약서,\n[먼저 챙기기]",
         narration="임대차계약서와 월세 이체 내역이 기본 증빙이에요. 마이김변 DocHub로 미리 챙겨 두세요.",
         tts="임대차계약서와 월세 이체 내역이 기본 증빙이에요. 마이김변 독허브로 미리 챙겨 두세요."),
]


def scene1(t, dur):
    frame = new_frame(cy=1000, color=(59, 130, 246), alpha=32)
    p = pop(t, 0.05, 0.45)
    frame.alpha_composite(with_alpha(radial(W, H, CX, 990, 380, BLUE, 60), p))
    place(frame, disc_img(170, NAVY), CX, 990, p, dy=0, s0=0.6)
    place(frame, house_img(200), CX, 975, p, dy=0, s0=0.6)
    t_r = cue(0, "많이")
    for k in range(4):
        place(frame, icon("coin", 76, AMBER), CX + 240, 1100 - k * 40, pop(t, t_r + k * 0.12, 0.25), dy=-30)
    place(frame, pill_img("월세", AMBER, 40), CX, 1240, pop(t, cue(0, "월세를"), 0.3), dy=14)
    place(frame, pill_img("생계비 더?", TEAL, 40), CX, 1330, pop(t, cue(0, "생계비를"), 0.3), dy=14)
    return finish(frame, 0, t, dur, z=0.07)


SEGS = (("식비", 0.30, SLATE500), ("주거비", 0.24, TEAL), ("교통·통신", 0.2, SLATE500), ("기타", 0.26, SLATE700))


def scene2(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    t_h = cue(1, "주거비")
    x0, x1, y0, y1 = X0, X1, 900, 1060
    ov, d = overlay()
    d.text((x0, 850), "기본 생계비", font=font("EB", 40), fill=WHITE + (255,), anchor="lm")
    x = x0
    for k, (lab, w, col) in enumerate(SEGS):
        p = ease_out(clamp((t - 0.3 - k * 0.2) / 0.4))
        if p <= 0:
            break
        ww = (x1 - x0) * w
        hl = k == 1 and t >= t_h
        yy0 = y0 - (16 if hl else 0) * ease_out(clamp((t - t_h) / 0.3))
        d.rounded_rectangle([x + 3, yy0, x + 3 + (ww - 6) * p, y1], 18, fill=(TEAL if hl else col) + (255,))
        if p > 0.9:
            d.text((x + ww / 2, (yy0 + y1) / 2), lab, font=font("EB", 30), fill=WHITE + (255,), anchor="mm")
        x += ww
    frame.alpha_composite(ov)
    place(frame, pill_img("이미 일부 들어 있어요", TEAL, 34), X0 + (X1 - X0) * 0.42, 1150, pop(t, t_h + 0.2, 0.3), dy=10)
    footnote(frame, "예시 그림입니다. 항목 비율은 실제 기준과 다릅니다.", t, 0.8)
    return finish(frame, 1, t, dur)


def scene3(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    base_y, x = 1340, 250
    t_extra, t_cap, t_no = cue(2, "추가 생계비로"), cue(2, "지역별 상한이"), cue(2, "전부")
    parts = ((180, TEAL, "기본 생계비에 포함", 0.2), (200, BLUE, "추가 생계비로 검토", t_extra),
             (180, RED, "인정 안 될 수 있음", t_no))
    ov, d = overlay()
    y = base_y
    for h, col, lab, t0 in parts:
        p = ease_out(clamp((t - t0) / 0.5))
        if p <= 0:
            break
        hh = h * p
        if col == RED:
            d.rounded_rectangle([x, y - hh, x + 220, y - 6], 18, outline=col + (255,), width=5)
            for k in range(0, int(hh), 22):
                d.line([(x + 8, y - k - 6), (x + 60, y - k - 40)], fill=col + (120,), width=4)
        else:
            d.rounded_rectangle([x, y - hh, x + 220, y - 6], 18, fill=col + (255,))
        if p > 0.9:
            d.text((x + 260, y - h / 2), lab, font=font("EB", 34), fill=WHITE + (255,), anchor="lm")
        y -= h
    d.text((x + 110, base_y + 40), "내 월세", font=font("EB", 34), fill=WHITE + (255,), anchor="mm")
    frame.alpha_composite(ov)
    q = pop(t, t_cap, 0.35)
    if q > 0:
        cap_y = base_y - 180 - 200
        ov, d = overlay()
        for k in range(0, 640, 34):
            d.line([(x - 40 + k, cap_y), (x - 20 + k, cap_y)], fill=AMBER + (255,), width=5)
        comp(frame, ov, q)
        place(frame, pill_img("지역별 상한", AMBER, 30), x + 540, cap_y + 38, q, dy=8)
    footnote(frame, ["예시 그림입니다. 인정 범위는 법원 실무 기준에 따릅니다.",
                     "증빙 자료와 사건 사정에 따라 달라질 수 있습니다."], t, 0.8, y=1458)
    return finish(frame, 2, t, dur)


REG = (("서울", 1.0), ("경기", 0.74), ("광역시", 0.5), ("그 밖의 지역", 0.38))


def scene4(t, dur):
    frame = new_frame(cy=1000, alpha=32)
    base_y = 1300
    keys = ("서울", "경기", "광역시", "그 밖의")
    ov, d = overlay()
    d.line([(X0 + 10, base_y), (X1 - 10, base_y)], fill=SLATE400 + (255,), width=4)
    for k, (lab, r) in enumerate(REG):
        p = ease_out(clamp((t - cue(3, keys[k])) / 0.5))
        if p <= 0:
            continue
        x = 130 + k * 200
        h = 470 * r * p
        d.rounded_rectangle([x, base_y - h, x + 150, base_y], 18, fill=lerp_color(BLUE, TEAL, k / 3) + (255,))
        d.text((x + 75, base_y + 40), lab, font=font("EB", 30 if len(lab) < 4 else 26), fill=WHITE + (255,), anchor="mm")
    frame.alpha_composite(ov)
    ov, d = overlay()
    d.text((X0, 740), "추가 인정 상한 (예시)", font=font("B", 30), fill=SLATE300 + (255,), anchor="lm")
    comp(frame, ov, pop(t, 0.3, 0.4))
    place(frame, pill_img("같은 월세, 다른 결과", AMBER, 32), 700, 760, pop(t, cue(3, "같은 월세"), 0.3), dy=10)
    footnote(frame, ["예시 그래프입니다. 지역 구분과 금액 기준은 법원 실무 기준을 확인하세요.",
                     "기준은 바뀔 수 있습니다."], t, 0.8, y=1458)
    return finish(frame, 3, t, dur)


def scene5(t, dur):
    return endcard(t, dur)


SFX = [(0, "월세를", "pop"), (0, "많이", "tick"), (0, "생계비를", "pop"), (1, "주거비", "pop"), (2, "추가 생계비로", "pop"),
       (2, "지역별 상한이", "thump"), (2, "전부", "alert"), (3, "서울", "tick"), (3, "경기", "tick"), (3, "광역시", "tick"),
       (3, "그 밖의", "tick"), (3, "같은 월세", "pop")]

META = dict(
    title="월세가 비싸면 생계비를 더 인정받을까?",
    desc=("개인회생의 기본 생계비에는 이미 주거비 일부가 포함되어 있습니다. 이를 넘는 월세는 추가 생계비로 검토될 수 있지만, "
          "지역별 상한이 있어 전부 인정되지는 않습니다. 서울·경기·광역시·그 밖의 지역처럼 지역 구분에 따라 기준이 달라, "
          "같은 월세라도 결과가 다를 수 있습니다.\n"
          "임대차계약서와 월세 이체 내역이 기본 증빙입니다. 구체적인 인정 범위와 금액 기준은 법원 실무 기준과 사건 사정에 따라 다르며, 바뀔 수 있습니다."),
    feature="DocHub 서류함 > 주거비 증빙 (임대차계약서·월세 이체 내역)",
    tags="#추가생계비 #개인회생월세 #주거비 #개인회생생계비 #변제금 #마이김변",
    comment=("임대차계약서와 최근 월세 이체 내역을 미리 모아 두면 추가 생계비 검토가 수월해집니다. 인정 범위는 선택한 변호사와 상의하세요. "
             "개인정보는 댓글에 남기지 마세요."),
    related="public/guide/personal-rehabilitation.html",
    slot="14주차 화요일 18:40",
)


def main():
    kit.run(EP, SCENES, [scene1, scene2, scene3, scene4, scene5], META, SFX)


if __name__ == "__main__":
    main()
