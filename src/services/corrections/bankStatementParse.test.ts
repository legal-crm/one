import { describe, expect, it } from 'vitest';
import { parseCsv, statementToT2Rows } from './bankStatementParse';

describe('bankStatementParse', () => {
  it('출금·입금 칸이 따로 있는 표에서 기준 금액 이상만', () => {
    const t = parseCsv([
      '조회기간,2026.01.01~2026.06.30',
      '거래일시,적요,출금액,입금액,잔액,거래점',
      '2026.03.02 10:11,TEST급여,0,"2,500,000","3,000,000",본점',
      '2026.03.05 09:00,TEST카드대금,"320,000",0,"2,680,000",',
      '2026.04.10 14:20,TEST송금,"1,000,000",0,"1,680,000",',
    ].join('\n'));
    const r = statementToT2Rows(t, 1_000_000, '국민 1234');
    expect(r.headerFound).toBe(true);
    expect(r.scanned).toBe(3);
    expect(r.rows).toEqual([
      { account: '국민 1234', date: '2026-03-02', direction: '입금', amount: '2500000', counterparty: 'TEST급여', use: '', proof: '' },
      { account: '국민 1234', date: '2026-04-10', direction: '출금', amount: '1000000', counterparty: 'TEST송금', use: '', proof: '' },
    ]);
  });

  it('구분 + 거래금액 한 칸 형식', () => {
    const t = [['거래일자', '구분', '거래금액', '받는분'], ['2026-05-01', '입금', 1200000, 'TEST'], ['2026-05-02', '출금', '1,500,000', 'TEST2']];
    const r = statementToT2Rows(t, 1_000_000, '');
    expect(r.rows.map(x => `${x.direction}${x.amount}`)).toEqual(['입금1200000', '출금1500000']);
  });

  it('머리글이 없으면 빈 결과', () => {
    expect(statementToT2Rows([['a', 'b'], ['1', '2']], 1, '').headerFound).toBe(false);
  });
});
