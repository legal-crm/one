import { describe, expect, it } from 'vitest';
import { candidatesFor, depositsFromTable } from './bankImport';

const row = (o: Partial<any>) => ({ caseId: 'c1', caseTitle: '', clientDisplayName: '홍길동', totalFeeWon: 3_000_000, paidWon: 0, remainingWon: 3_000_000, overdueCount: 0, nextDueOn: '2026-11-10', nextDueWon: 500_000, pendingReports: 0, overdueWon: 0, ...o });

describe('거래내역 파일 대조 (FE-9)', () => {
  it('입금 줄만 읽고 같은 줄은 순번으로 지문을 나눈다', async () => {
    const table = [
      ['거래일자', '출금액', '입금액', '적요', '보낸분'],
      ['2026.11.01', '', '500,000', '이체', '홍길동'],
      ['2026.11.01', '', '500,000', '이체', '홍길동'],
      ['2026.11.02', '30,000', '', '수수료', ''],
    ];
    const { deposits, headerFound } = await depositsFromTable(table, 'office-1');
    expect(headerFound).toBe(true);
    expect(deposits).toHaveLength(2);
    expect(deposits[0].hash).not.toBe(deposits[1].hash);
    const again = await depositsFromTable(table, 'office-1');
    expect(again.deposits[0].hash).toBe(deposits[0].hash);
  });

  it('금액·이름이 맞는 사건을 먼저 제안한다', () => {
    const dep = { date: '2026-11-01', amount: 500_000, payer: '홍길동', hash: 'x' };
    const c = candidatesFor(dep, [row({}), row({ caseId: 'c2', clientDisplayName: '김철수', nextDueWon: 500_000 }), row({ caseId: 'c3', remainingWon: 100_000, nextDueWon: 100_000 })]);
    expect(c[0].caseId).toBe('c1');
    expect(c.map(x => x.caseId)).not.toContain('c3');
  });
});
