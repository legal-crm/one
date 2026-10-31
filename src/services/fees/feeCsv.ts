// ============================================================
// 수납 CSV 공통 (FE-11): 엑셀에서 수식으로 읽히지 않게, 이름 가리기, UTF-8 BOM
// ============================================================

/** 칸 하나: = + - @ (그리고 탭·CR)로 시작하면 앞에 ' 를 붙이고, 쉼표·따옴표·줄바꿈이 있으면 감싼다 */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(cols => cols.map(csvCell).join(',')).join('\r\n');
}

/** 홍길동 → 홍*동, 김철 → 김*, 남궁민수 → 남**수, 한 글자는 그대로 * */
export function maskPersonName(name: string): string {
  const n = (name || '').trim();
  if (!n) return '';
  const chars = Array.from(n);
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

export function downloadCsv(fileName: string, rows: unknown[][]): void {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
