/** 토·일을 건너뛴 n영업일 뒤 날짜 (예정일 표시용 — 공휴일은 서버 달력에서만 정확히 센다) */
export function addBusinessDaysLocal(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  let left = Math.max(0, Math.floor(n));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) left -= 1;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
