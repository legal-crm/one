/**
 * 마케팅 이미지·영상 프레임 캔버스 렌더러
 * AI 이미지 모델은 한글을 제대로 그리지 못하므로, 배경만 AI로 만들고 한글은 캔버스에 Pretendard로 직접 그린다.
 */
import type { Scene } from '../../../services/marketingAutopilotService';

export const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
export const BRAND = '마이김변 · 리걸테크 플랫폼';

/** 동적 서브셋 웹폰트는 쓰는 글자만 내려받으므로 그리기 전에 글자를 미리 불러온다 */
export async function ensureFonts(texts: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = texts.join(' ').slice(0, 4000) || '가';
  try {
    await Promise.all([
      document.fonts.load(`900 64px "Pretendard Variable"`, sample),
      document.fonts.load(`700 40px "Pretendard Variable"`, sample),
      document.fonts.load(`500 32px "Pretendard Variable"`, sample),
    ]);
  } catch { /* 시스템 폰트로 폴백 */ }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

/** 한국어 줄바꿈: 공백 단위로 나누고, 한 단어가 너무 길면 글자 단위로 자른다 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= maxWidth) { line = word; continue; }
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth) { lines.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** object-fit: cover + 확대·이동 */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number, scale = 1, offX = 0, offY = 0) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number, dh: number;
  if (ir > cr) { dh = h * scale; dw = dh * ir; } else { dw = w * scale; dh = dw / ir; }
  ctx.drawImage(img, (w - dw) / 2 + offX * w, (h - dh) / 2 + offY * h, dw, dh);
}

function fallbackBg(ctx: CanvasRenderingContext2D, w: number, h: number, hue = 225) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 55%, 14%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360}, 50%, 8%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─── 카드뉴스 1080x1080 ───
export interface SlideOptions { bg?: HTMLImageElement | null; headline: string; body: string; index: number; total: number; accent?: string; footnote?: string }

export function drawCardSlide(canvas: HTMLCanvasElement, o: SlideOptions) {
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const accent = o.accent || '#34D399';
  if (o.bg) {
    // 장마다 다른 구도를 위해 확대 위치를 바꾼다
    const shift = ((o.index % 3) - 1) * 0.04;
    drawCover(ctx, o.bg, W, H, 1.12, shift, -shift / 2);
  } else fallbackBg(ctx, W, H, 220 + o.index * 12);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(6,10,20,0.55)');
  g.addColorStop(0.45, 'rgba(6,10,20,0.72)');
  g.addColorStop(1, 'rgba(6,10,20,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'top';
  ctx.fillStyle = accent;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(`${String(o.index + 1).padStart(2, '0')} / ${String(o.total).padStart(2, '0')}`, 90, 90);

  const isCover = o.index === 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${isCover ? 96 : 78}px ${FONT}`;
  const hl = wrapText(ctx, o.headline, W - 180);
  let y = isCover ? 330 : 250;
  const lh = isCover ? 118 : 98;
  hl.slice(0, 4).forEach((line, i) => {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18;
    ctx.fillText(line, 90, y + i * lh);
  });
  ctx.shadowBlur = 0;
  y += Math.min(hl.length, 4) * lh + 30;
  ctx.fillStyle = accent;
  ctx.fillRect(90, y, 120, 8);
  y += 50;
  ctx.fillStyle = 'rgba(241,245,249,0.94)';
  ctx.font = `500 44px ${FONT}`;
  wrapText(ctx, o.body, W - 180).slice(0, 5).forEach((line, i) => ctx.fillText(line, 90, y + i * 64));

  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = 'rgba(226,232,240,0.92)';
  ctx.fillText(BRAND, 90, H - 120);
  if (o.footnote) {
    ctx.font = `400 22px ${FONT}`;
    ctx.fillStyle = 'rgba(203,213,225,0.85)';
    wrapText(ctx, o.footnote, W - 180).slice(0, 2).forEach((line, i) => ctx.fillText(line, 90, H - 78 + i * 28));
  }
}

// ─── 블로그 삽입 이미지 ───
export function drawBlogImage(canvas: HTMLCanvasElement, o: { bg?: HTMLImageElement | null; headline: string; sub: string; tag: string; w: number; h: number; index: number }) {
  canvas.width = o.w; canvas.height = o.h;
  const ctx = canvas.getContext('2d')!;
  if (o.bg) drawCover(ctx, o.bg, o.w, o.h, 1.05); else fallbackBg(ctx, o.w, o.h, 210 + o.index * 20);
  const g = ctx.createLinearGradient(0, o.h * 0.3, 0, o.h);
  g.addColorStop(0, 'rgba(6,10,20,0.1)');
  g.addColorStop(1, 'rgba(6,10,20,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, o.w, o.h);
  const pad = Math.round(o.w * 0.07);
  ctx.textBaseline = 'top';
  ctx.font = `700 ${Math.round(o.w * 0.026)}px ${FONT}`;
  const tw = ctx.measureText(o.tag).width + 36;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, pad, pad, tw, Math.round(o.w * 0.05), 14);
  ctx.fill();
  ctx.fillStyle = '#A5B4FC';
  ctx.fillText(o.tag, pad + 18, pad + Math.round(o.w * 0.012));
  ctx.fillStyle = '#FFFFFF';
  const hs = Math.round(o.w * 0.066);
  ctx.font = `900 ${hs}px ${FONT}`;
  const lines = wrapText(ctx, o.headline, o.w - pad * 2).slice(0, 2);
  const subSize = Math.round(o.w * 0.032);
  const baseY = o.h - pad - subSize * 1.6 - lines.length * hs * 1.22;
  lines.forEach((l, i) => ctx.fillText(l, pad, baseY + i * hs * 1.22));
  ctx.font = `500 ${subSize}px ${FONT}`;
  ctx.fillStyle = 'rgba(226,232,240,0.95)';
  ctx.fillText(wrapText(ctx, o.sub, o.w - pad * 2)[0] || '', pad, o.h - pad - subSize * 1.2);
}

// ─── 숏폼 영상 프레임 1080x1920 ───
export interface FrameInput {
  scenes: Scene[];
  durations: number[];
  images: (HTMLImageElement | null)[];
  t: number;               // 전체 경과 초
  badge: string;           // 상단 배지 (예: 오늘의 회생 뉴스)
  disclaimer: string;
}

const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

export function sceneAt(durations: number[], t: number) {
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    if (t < acc + durations[i] || i === durations.length - 1) return { index: i, local: Math.max(0, t - acc), start: acc };
    acc += durations[i];
  }
  return { index: 0, local: 0, start: 0 };
}

export function drawVideoFrame(ctx: CanvasRenderingContext2D, f: FrameInput) {
  const W = 1080, H = 1920;
  const { index, local } = sceneAt(f.durations, f.t);
  const scene = f.scenes[index];
  const dur = f.durations[index] || 1;
  const p = Math.min(1, local / dur);
  const img = f.images[index];

  ctx.clearRect(0, 0, W, H);
  // 켄 번스 모션
  if (img) {
    const m = scene.motion || ['zoom-in', 'pan-left', 'zoom-out', 'pan-right'][index % 4];
    let scale = 1.1, ox = 0;
    if (m === 'zoom-in') scale = 1.02 + 0.14 * p;
    else if (m === 'zoom-out') scale = 1.16 - 0.14 * p;
    else if (m === 'pan-left') { scale = 1.14; ox = 0.05 - 0.1 * p; }
    else if (m === 'pan-right') { scale = 1.14; ox = -0.05 + 0.1 * p; }
    drawCover(ctx, img, W, H, scale, ox, 0);
  } else fallbackBg(ctx, W, H, 220 + index * 25);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(5,8,18,0.55)');
  g.addColorStop(0.35, 'rgba(5,8,18,0.35)');
  g.addColorStop(0.7, 'rgba(5,8,18,0.6)');
  g.addColorStop(1, 'rgba(5,8,18,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 상단 진행 바 (스토리형)
  const n = f.durations.length;
  const gap = 12, barW = (W - 120 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = 60 + i * (barW + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x, 80, barW, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, 80, barW * (i < index ? 1 : i === index ? p : 0), 8);
  }

  // 상단 배지
  ctx.textBaseline = 'middle';
  ctx.font = `800 40px ${FONT}`;
  const bw = ctx.measureText(f.badge).width + 56;
  ctx.fillStyle = index === 0 ? '#EF4444' : 'rgba(79,70,229,0.92)';
  roundRect(ctx, 60, 130, bw, 76, 20);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(f.badge, 88, 169);

  // 키네틱 자막 (등장 애니메이션 + 단어 하이라이트)
  const enter = Math.min(1, local / 0.35);
  const s = 0.82 + 0.18 * easeOutBack(enter);
  ctx.save();
  ctx.globalAlpha = Math.min(1, enter * 1.4);
  ctx.translate(W / 2, H * 0.44);
  ctx.scale(s, s);
  ctx.font = `900 104px ${FONT}`;
  ctx.textAlign = 'left';
  const lines = wrapText(ctx, scene.caption, W - 140).slice(0, 3);
  const words = scene.caption.split(/\s+/).filter(Boolean);
  const hi = Math.min(words.length - 1, Math.floor(p * words.length * 1.15));
  let wi = 0;
  const lh = 128;
  const top = -((lines.length - 1) * lh) / 2;
  lines.forEach((line, li) => {
    const lw = ctx.measureText(line).width;
    let x = -lw / 2;
    for (const w of line.split(' ')) {
      const ww = ctx.measureText(w).width;
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineJoin = 'round';
      ctx.strokeText(w, x, top + li * lh);
      ctx.fillStyle = wi === hi ? '#FDE047' : '#FFFFFF';
      ctx.fillText(w, x, top + li * lh);
      x += ww + ctx.measureText(' ').width;
      wi++;
    }
  });
  ctx.restore();

  // 나레이션 자막 (무음 시청 대응)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `600 46px ${FONT}`;
  const nl = wrapText(ctx, scene.narration, W - 200).slice(0, 3);
  const boxH = nl.length * 64 + 44;
  const boxY = H * 0.68;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 70, boxY, W - 140, boxH, 28);
  ctx.fill();
  ctx.fillStyle = 'rgba(248,250,252,0.96)';
  nl.forEach((l, i) => ctx.fillText(l, W / 2, boxY + 22 + i * 64));

  // 하단 브랜드 + 마지막 장면 고지문
  ctx.font = `800 38px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(BRAND, W / 2, H - 230);
  if (index === n - 1) {
    ctx.font = `400 26px ${FONT}`;
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    wrapText(ctx, f.disclaimer, W - 160).slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, H - 170 + i * 34));
  }
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), type, quality));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
