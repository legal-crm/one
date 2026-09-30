"""렌더 결과 후처리: 카카오 업로드 규격 맞춤.

- 디스플레이(2:1·1:1·4:5·9:16): PNG → JPG(4:4:4 크로마, 투명 없음), 490,000바이트 미만이 될 때까지 품질 조정
- 비즈보드 배너 1029x258: PNG-32(투명 배경) 300KB 이하
- 비즈보드 오브젝트 315x258: 투명 PNG 150KB 이하
입력: jobs.json 경로 / 출력: 마지막 줄에 JSON {"files":[{path,bytes,err}]}
"""
import io
import json
import os
import sys

from PIL import Image

LIMIT = {"display": 490_000, "biz": 300_000, "object": 150_000}


def save_jpg(src: str, dst: str, limit: int):
    img = Image.open(src).convert("RGB")
    for q in (93, 91, 89, 87, 85, 82, 79, 76):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q, subsampling=0, optimize=True, progressive=False)
        if buf.tell() < limit or q == 76:
            with open(dst, "wb") as f:
                f.write(buf.getvalue())
            return buf.tell(), q
    return None, None


def main(job_path: str):
    sys.stdout.reconfigure(encoding="utf-8")
    jobs = json.load(open(job_path, encoding="utf-8"))
    out = []
    for j in jobs:
        kind = j["kind"]
        err = None
        if kind == "display":
            size, q = save_jpg(j["src"], j["dst"], LIMIT[kind])
            with Image.open(j["dst"]) as im:
                if im.size != (j["w"], j["h"]):
                    err = f"크기 {im.size} != {(j['w'], j['h'])}"
            if size >= LIMIT[kind]:
                err = f"용량 {size}B 초과"
            os.remove(j["src"])
            out.append({"path": j["dst"], "bytes": size, "q": q, "err": err})
        else:
            path = j["src"]
            with Image.open(path) as im:
                im.load()
                rgba = im.convert("RGBA")
            if rgba.size != (j["w"], j["h"]):
                err = f"크기 {rgba.size} != {(j['w'], j['h'])}"
            rgba.save(path, "PNG", optimize=True)
            size = os.path.getsize(path)
            if size > LIMIT[kind]:
                err = f"용량 {size}B > {LIMIT[kind]}B"
            if rgba.getchannel("A").getextrema()[0] != 0:
                err = (err or "") + " 배경 투명 아님"
            out.append({"path": path, "bytes": size, "err": err})
    print(json.dumps({"files": out}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
