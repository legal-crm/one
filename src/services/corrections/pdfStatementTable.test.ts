import { describe, it, expect } from 'vitest';
import { pdfItemsToTable, type PdfTextItem } from './pdfStatementTable';
import { statementToT2Rows } from './bankStatementParse';

const t = (str: string, x: number, y: number, page = 1, w = str.length * 5): PdfTextItem => ({ str, x, y, w, page });

// 머리글: 거래일자(10) · 적요(80) · 출금액(160) · 입금액(230) · 잔액(300)
const header = (y: number, page = 1) => [t('거래', 10, y, page, 10), t('일자', 22, y, page, 10), t('적요', 80, y, page), t('출금액', 160, y, page), t('입금액', 230, y, page), t('잔액', 300, y, page)];

describe('PDF 거래내역 → 표 (CR-11)', () => {
  it('머리글 칸 위치로 거래 줄을 나누고, 다음 쪽 반복 머리글은 건너뛴다', () => {
    const items: PdfTextItem[] = [
      t('거래내역 조회', 10, 800),
      ...header(760),
      t('2026.03.02', 10, 740), t('이체 홍', 80, 740), t('1,500,000', 168, 740), t('3,000,000', 300, 740),
      t('2026.03.05', 10, 720), t('급여', 80, 720), t('2,400,000', 236, 720), t('5,400,000', 300, 720),
      ...header(760, 2),
      t('2026.03.09', 10, 740, 2), t('카드', 80, 740, 2), t('80,000', 170, 740, 2), t('5,320,000', 300, 740, 2),
    ];
    const table = pdfItemsToTable(items)!;
    expect(table[0]).toEqual(['거래일자', '적요', '출금액', '입금액', '잔액']);
    expect(table.length).toBe(4); // 머리글 + 3줄 (2쪽 머리글 제외)
    expect(table[1]).toEqual(['2026.03.02', '이체 홍', '1,500,000', '', '3,000,000']);
    expect(table[2][3]).toBe('2,400,000');

    const r = statementToT2Rows(table, 1_000_000, '국민 1234');
    expect(r.headerFound).toBe(true);
    expect(r.scanned).toBe(3);
    expect(r.rows.map(x => [x.date, x.direction, x.amount])).toEqual([
      ['2026-03-02', '출금', '1500000'],
      ['2026-03-05', '입금', '2400000'],
    ]);
  });

  it('머리글이 없으면(그림 PDF·다른 문서) null', () => {
    expect(pdfItemsToTable([t('부채증명서', 10, 800), t('원금 1,000,000원', 10, 780)])).toBeNull();
  });
});
