// 우리 사무소 보정 통계 → 이 사건 법원 요약 (DP-6·CR-12). 개인정보 없음 (법원·분류·건수만)
import type { CorrectionStats } from '../corrections/correctionService';

export interface CourtPrepStats {
  courtLabel: string;
  orders: number;
  avgDays: number | null;
  extensions: number;
  topCategories: Array<{ category: string; items: number; cannot: number }>;
}

/** 법원 이름 비교용: 공백 지우고 '지방법원'·'회생법원'·'지원' 표기 차이를 줄인다 */
const norm = (s: string) => s.replace(/\s/g, '').replace(/지방법원/g, '지법').replace(/회생법원/g, '회생');

export function courtStatsFor(stats: CorrectionStats, courtName: string | undefined, top = 5): CourtPrepStats | null {
  if (!courtName || !courtName.trim()) return null;
  const want = norm(courtName);
  const same = (c: string) => { const n = norm(c || ''); return !!n && (n === want || n.includes(want) || want.includes(n)); };
  const courts = stats.byCourt.filter(c => same(c.court));
  const orders = courts.reduce((s, c) => s + c.orders, 0);
  const daysRows = courts.filter(c => c.avgDays !== null && c.orders > 0);
  const avgDays = daysRows.length
    ? Math.round(daysRows.reduce((s, c) => s + (c.avgDays as number) * c.orders, 0) / daysRows.reduce((s, c) => s + c.orders, 0))
    : null;
  const byCat = new Map<string, { items: number; cannot: number }>();
  for (const r of stats.byCategory) {
    if (!same(r.court)) continue;
    const key = r.category || '기타';
    const cur = byCat.get(key) || { items: 0, cannot: 0 };
    cur.items += r.items; cur.cannot += r.cannot;
    byCat.set(key, cur);
  }
  const topCategories = [...byCat.entries()].map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.items - a.items || b.cannot - a.cannot || a.category.localeCompare(b.category, 'ko'))
    .slice(0, top);
  return {
    courtLabel: courts[0]?.court || courtName.trim(),
    orders,
    avgDays,
    extensions: courts.reduce((s, c) => s + c.extensions, 0),
    topCategories,
  };
}
