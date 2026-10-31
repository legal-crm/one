// ============================================================
// 의뢰인 도장 이미지 (H-0, 고객 기획서 6-A 서명·날인 3·4번) — 브라우저 캔버스로만 만든다
//  * makeNameSeal: 이름 원형 도장 (2자: 세로 / 3자: 세로 / 4자: 2×2, 붉은 인주색)
//  * cleanSealPhoto: 종이에 찍은 도장 사진에서 흰 바탕을 지우고 도장 부분만 잘라 투명 PNG로
// ============================================================

const INK = { r: 200, g: 32, b: 40 };

export function makeNameSeal(name: string, size = 300): string {
  const chars = Array.from(name.replace(/\s+/g, '')).slice(0, 4);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  const color = `rgb(${INK.r},${INK.g},${INK.b})`;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = size * 0.045;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - g.lineWidth, 0, Math.PI * 2);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const font = (px: number) => `bold ${Math.round(px)}px "Nanum Myeongjo", "NanumMyeongjo", "Batang", serif`;
  if (chars.length === 4) {
    // 오른쪽 위부터 세로로 읽는 전통 배치: [0][2] / [1][3] → 오른쪽 열이 앞 두 글자
    g.font = font(size * 0.3);
    const pos = [[0.66, 0.36], [0.66, 0.66], [0.34, 0.36], [0.34, 0.66]];
    chars.forEach((ch, i) => g.fillText(ch, size * pos[i][0], size * pos[i][1]));
  } else {
    const n = Math.max(1, chars.length);
    const px = n === 1 ? size * 0.5 : n === 2 ? size * 0.36 : size * 0.26;
    g.font = font(px);
    const step = px * 1.02;
    const top = size / 2 - (step * (n - 1)) / 2;
    chars.forEach((ch, i) => g.fillText(ch, size / 2, top + step * i));
  }
  return c.toDataURL('image/png');
}

/** 도장 사진: 밝은 바탕을 투명하게, 붉은 기운이 있는 부분만 남기고 그 부분만 잘라낸다 */
export async function cleanSealPhoto(file: File, maxSide = 600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('사진을 열지 못했어요.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2];
        const redness = r - (gg + b) / 2;
        const bright = (r + gg + b) / 3;
        if (redness > 40 && bright < 235) {
          // 인주 부분: 색을 인주색으로 맞추고 진하기를 투명도로
          const alpha = Math.min(255, Math.round(redness * 2.2));
          d.data[i] = INK.r; d.data[i + 1] = INK.g; d.data[i + 2] = INK.b; d.data[i + 3] = alpha;
          if (alpha > 60) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
        } else {
          d.data[i + 3] = 0;
        }
      }
    }
    if (maxX < 0) throw new Error('사진에서 붉은 도장 자국을 찾지 못했어요. 밝은 곳에서 도장만 크게 찍어 주세요.');
    g.putImageData(d, 0, 0);
    const pad = 6;
    const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
    const cw = Math.min(w - cx, maxX - minX + pad * 2), ch = Math.min(h - cy, maxY - minY + pad * 2);
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.getContext('2d')!.drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
