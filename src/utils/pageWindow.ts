/** 쪽 번호 앞뒤 radius개만 (예: 현재 7쪽, 전체 40쪽, radius 5 → 2~12). 전부 나열하면 쪽이 많을 때 줄이 넘친다 (OP-16) */
export function pageWindow(current: number, total: number, radius = 5): number[] {
  const t = Math.max(1, Math.floor(total) || 1);
  const c = Math.min(Math.max(1, Math.floor(current) || 1), t);
  const from = Math.max(1, c - radius);
  const to = Math.min(t, c + radius);
  const out: number[] = [];
  for (let p = from; p <= to; p++) out.push(p);
  return out;
}
