# -*- coding: utf-8 -*-
"""
마이김변 쇼츠·릴스 Part 4 (EP37~EP66) 렌더러
기획: docs/youtube_shorts_plan_part4.md

실행 예
  python scripts/shorts/render_p4.py 37            # EP37 세로+정사각
  python scripts/shorts/render_p4.py 37-46 -j 4     # 범위, 4개 병렬
  python scripts/shorts/render_p4.py all -j 5       # 30편 전체 (번호 순서대로 시작)
  python scripts/shorts/render_p4.py 37 --preview   # 인코딩 없이 검수용 프레임만
  python scripts/shorts/render_p4.py --export-text  # 컴플라이언스 검사용 텍스트 JSON

출력(assets/shorts/epNN/)
  epNN_final.mp4 (1080x1920, 유튜브 쇼츠) · epNN_square.mp4 (1080x1080, 인스타그램)
  epNN_captions.srt · epNN_thumb.png · epNN_square_cover.png · epNN_contact.png · epNN_square_contact.png
  upload.txt (유튜브) · upload_reels.txt (인스타그램)
"""
import argparse
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

DAYS = ["화", "목", "토"]


def load():
    import p4_ep_a
    import p4_ep_b
    import p4_ep_c
    eps = p4_ep_a.EPISODES + p4_ep_b.EPISODES + p4_ep_c.EPISODES
    return {int(e["ep"][2:]): e for e in eps}


def slot(num):
    """EP36 = 14주차 화요일 → 이후 화·목·토 18:40 (릴스는 같은 날 21:00)"""
    p = num - 36
    return 14 + p // 3, DAYS[p % 3]


YT_TMPL = """[제목]
{title}

[설명란]
{desc}

관련 기능: {feature}

마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 법률사무소가 수행합니다. 인가·면책은 법원이 판단합니다.

{tags}

[고정 댓글]
{comment}

[채널 링크(프로필 고정)]
https://mykim.kr/check?utm_source=youtube&utm_medium=shorts&utm_campaign=s{num}

[관련 콘텐츠]
{related}

[업로드 설정]
- 파일: {ep}_final.mp4 (1080x1920, {dur:.0f}초)
- 자막: {ep}_captions.srt 업로드 (한국어)
- 포맷: {series} · 음성: {voices}
- 변경되거나 합성된 콘텐츠: 해당 없음 (일러스트·UI 목업, 실존 인물 없음). 내레이션은 TTS 음성
- 게시: {week}주차 {day}요일 18:40
"""

REELS_TMPL = """[릴스 캡션]
{title}

{short}

프로필 링크 → 익명 채무 체크 (mykim.kr/check)
마이김변은 리걸테크 플랫폼이며, 상담·수임은 의뢰인이 선택한 법률사무소가 수행합니다. 인가·면책은 법원이 판단합니다.

{tags} #릴스 #법률정보

[프로필 링크(UTM)]
https://mykim.kr/check?utm_source=instagram&utm_medium=reels&utm_campaign=r{num}

[업로드 설정]
- 파일: {ep}_square.mp4 (1080x1080 정사각, {dur:.0f}초) · 커버: {ep}_square_cover.png
- 피드 미리보기: 1:1 · 릴스 탭에서는 9:16 전체화면이 아니므로 위아래 여백이 보일 수 있음
- 오디오: 자체 합성 BGM·효과음 (저작권 이슈 없음), 내레이션 TTS 음성
- 댓글 고정: {comment}
- 게시: {week}주차 {day}요일 21:00
"""


def write_uploads(ep, total):
    from p4_engine import ROOT, VOICE_LABEL
    num = int(ep["ep"][2:])
    week, day = slot(num)
    m = ep["meta"]
    voices = " / ".join(dict.fromkeys(VOICE_LABEL[v] for v in ep["cast"].values()))
    out = ROOT / "assets" / "shorts" / ep["ep"]
    first = m["desc"].split(". ")
    short = ". ".join(first[:2]).rstrip(".") + "."
    (out / "upload.txt").write_text(YT_TMPL.format(ep=ep["ep"], num=num, title=ep["title"], series=ep["series"],
                                                   voices=voices, week=week, day=day, dur=total, **m), encoding="utf-8")
    (out / "upload_reels.txt").write_text(REELS_TMPL.format(ep=ep["ep"], num=num, title=ep["title"], short=short,
                                                            tags=m["tags"], comment=m["comment"], week=week, day=day,
                                                            dur=total), encoding="utf-8")


def render_one(num, preview=False, modes=("v", "s")):
    import p4_engine as E
    import p4_kinds  # noqa: F401  (KINDS 등록)
    ep = load()[num]
    t0 = time.time()
    total = E.run(ep, modes=modes, preview=preview)
    if not preview:
        write_uploads(ep, total)
    return num, total, time.time() - t0


def export_text(path):
    eps = load()
    data = {}
    for num, ep in sorted(eps.items()):
        parts = [ep["title"], ep["meta"]["desc"], ep["meta"]["comment"]]
        for sc in ep["scenes"]:
            for k in ("cap", "foot", "q", "exp", "myth", "fact", "headline", "def_", "term", "title", "sub"):
                if sc.get(k):
                    parts.append(str(sc[k]).replace("[", "").replace("]", ""))
            for item in sc["lines"]:
                if item[0] != "pause":
                    parts.append(item[1].replace("[", "").replace("]", ""))
        data[ep["ep"]] = "\n".join(parts)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"텍스트 {len(data)}편 → {path}")


def parse(sel, eps):
    if sel == "all":
        return sorted(eps)
    out = []
    for part in sel.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sel", nargs="?", default="all")
    ap.add_argument("-j", type=int, default=1)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--modes", default="vs")
    ap.add_argument("--export-text")
    a = ap.parse_args()
    if a.export_text:
        return export_text(a.export_text)
    eps = load()
    nums = parse(a.sel, eps)
    modes = tuple(a.modes)
    if a.j <= 1:
        for n in nums:
            num, total, sec = render_one(n, a.preview, modes)
            print(f"== EP{num} 완료: {total:.1f}s 영상, {sec:.0f}초 소요")
        return
    fails = []
    with ProcessPoolExecutor(max_workers=a.j) as ex:
        futs = {ex.submit(render_one, n, a.preview, modes): n for n in nums}
        for f in as_completed(futs):
            n = futs[f]
            try:
                num, total, sec = f.result()
                print(f"== EP{num} 완료: {total:.1f}s 영상, {sec:.0f}초 소요", flush=True)
            except Exception as e:  # 한 편 실패가 전체를 멈추지 않게
                fails.append(n)
                print(f"!! EP{n} 실패: {e!r}", flush=True)
    if fails:
        sys.exit(f"실패: {sorted(fails)}")


if __name__ == "__main__":
    main()
