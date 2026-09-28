// ============================================================
// 로컬(사용자 시간대) 날짜 유틸
// toISOString()은 UTC 기준이라 한국 시간 00:00~08:59에는 '어제' 날짜가 된다.
// 납부일·마감일·서명일 같은 '날짜'는 반드시 이 함수로 만든다.
// ============================================================

/** YYYY-MM-DD (로컬) */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD'를 로컬 자정 Date로 해석 (new Date('YYYY-MM-DD')는 UTC 자정) */
export function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 기준일로부터 n개월 뒤 같은 일자 (말일 보정: 1/31 + 1개월 → 2/28 또는 2/29) */
export function addMonthsClamped(base: Date, months: number): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + months;
  const day = base.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, lastDay));
}

/** YYYY-MM-DD에 일수 더하기 (로컬) */
export function addDaysYmd(ymd: string, days: number): string {
  const d = parseLocalYmd(ymd);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  return localYmd(d);
}
