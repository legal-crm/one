import { describe, expect, it } from 'vitest';
import { isDebtRelatedCorrection, matchLedgerRows, normalizeCreditorName } from './correctionDebtMatch';

describe('보정 항목 ↔ 부채증명 장부 (DC-11)', () => {
  it('부채증명·대위변제·산정기준일 항목을 알아본다', () => {
    expect(isDebtRelatedCorrection('3. 채권자 국민카드의 부채증명서를 최근 발급분으로 제출하십시오.')).toBe(true);
    expect(isDebtRelatedCorrection('서울보증보험의 대위변제 여부를 소명하십시오.')).toBe(true);
    expect(isDebtRelatedCorrection('채권액 산정기준일을 통일하십시오.')).toBe(true);
    expect(isDebtRelatedCorrection('최근 1년간 통장 거래내역을 제출하십시오.')).toBe(false);
  });

  it('회사 형태 표시를 빼고 이름을 맞춘다', () => {
    expect(normalizeCreditorName('(주)국민카드')).toBe(normalizeCreditorName('주식회사 국민카드'));
    const rows = [{ creditorName: '㈜국민카드' }, { creditorName: '신한은행 강남지점' }, { creditorName: '가' }];
    const hit = matchLedgerRows('채권자 국민카드, 신한은행의 부채증명서', rows);
    expect(hit.map(r => r.creditorName)).toEqual(['㈜국민카드', '신한은행 강남지점']);
  });

  it('이름이 없으면 빈 목록', () => {
    expect(matchLedgerRows('부채증명서 전부 다시 내세요', [{ creditorName: '하나캐피탈' }])).toEqual([]);
  });
});
