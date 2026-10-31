// ============================================================
// PDF 거래내역 글자 → 표 (CR-11 'PDF 거래내역 읽기')
// 은행·인터넷뱅킹에서 저장한 글자 PDF(그림 스캔 아님)의 글자 조각을 위치로 묶어 표를 만든다.
// - 같은 높이(y)의 조각 = 한 줄, 머리글 줄(거래일 + 입금/출금/금액)의 칸 위치로 아래 줄 조각을 칸에 나눈다
// - 쪽마다 반복되는 머리글 줄은 건너뛴다
// - 브라우저에서만 처리한다(서버·외부 AI로 보내지 않음). 결과는 statementToT2Rows가 그대로 읽는다
// ============================================================

/** PDF 글자 조각: x = 왼쪽, y = 아래에서 위(PDF 좌표), w = 너비 */
export interface PdfTextItem { str: string; x: number; y: number; w: number; page: number }

const DATE_HEAD = /거래일|일자|날짜|거래일시/;
const MONEY_HEAD = /출금|입금|찾으신|맡기신|지급|거래금액|^금액$/;
const compact = (s: string) => s.replace(/\s+/g, '');

interface Line { page: number; y: number; items: PdfTextItem[] }

/** 같은 쪽·같은 높이(허용 오차 tol)의 조각을 한 줄로 묶는다. 위 → 아래, 왼쪽 → 오른쪽 순서 */
export function groupLines(items: PdfTextItem[], tol = 3): Line[] {
  const sorted = items
    .filter(it => it.str && it.str.trim())
    .slice()
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === it.page && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else lines.push({ page: it.page, y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

/** 머리글 줄 조각 → 칸(가까운 조각은 한 칸으로: '거래 일자'처럼 띄어 쓴 머리글) */
function headerCells(line: Line, gap = 6): Array<{ text: string; x0: number; x1: number }> {
  const cells: Array<{ text: string; x0: number; x1: number }> = [];
  for (const it of line.items) {
    const last = cells[cells.length - 1];
    if (last && it.x - last.x1 <= gap) { last.text += it.str; last.x1 = Math.max(last.x1, it.x + it.w); }
    else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
  }
  return cells.map(c => ({ ...c, text: c.text.trim() }));
}

function isHeaderLine(line: Line): boolean {
  const cells = headerCells(line).map(c => compact(c.text));
  return cells.some(c => DATE_HEAD.test(c)) && cells.some(c => MONEY_HEAD.test(c));
}

/**
 * 글자 조각 → 표. 머리글 줄을 못 찾으면 null (그림으로 된 PDF이거나 거래내역이 아님)
 * 첫 줄 = 머리글, 그 아래 = 거래 줄
 */
export function pdfItemsToTable(items: PdfTextItem[]): string[][] | null {
  const lines = groupLines(items);
  const hi = lines.findIndex(isHeaderLine);
  if (hi < 0) return null;
  const cols = headerCells(lines[hi]);
  const headerKey = cols.map(c => compact(c.text)).join('|');
  const centers = cols.map(c => (c.x0 + c.x1) / 2);
  // 칸 경계 = 이웃한 머리글 가운데의 중간
  const bounds = centers.slice(0, -1).map((c, i) => (c + centers[i + 1]) / 2);
  const colOf = (it: PdfTextItem) => {
    const mid = it.x + it.w / 2;
    let i = 0;
    while (i < bounds.length && mid > bounds[i]) i++;
    return i;
  };

  const table: string[][] = [cols.map(c => c.text)];
  for (const line of lines.slice(hi + 1)) {
    if (isHeaderLine(line) && headerCells(line).map(c => compact(c.text)).join('|') === headerKey) continue;
    const row = cols.map(() => '');
    for (const it of line.items) {
      const k = colOf(it);
      row[k] = row[k] ? `${row[k]} ${it.str.trim()}` : it.str.trim();
    }
    if (row.some(Boolean)) table.push(row);
  }
  return table;
}
