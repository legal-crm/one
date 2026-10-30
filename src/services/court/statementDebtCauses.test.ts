import { describe, expect, it } from 'vitest';
import { normalizeDebtCauses, STATEMENT_DEBT_CAUSES } from './statementDebtCauses';

describe('statementDebtCauses', () => {
  it('예전 값은 양식 선택지로, 모르는 값은 기타로, 순서는 양식 순서', () => {
    expect(normalizeDebtCauses(['주식·코인 손실', '생활비 부족', '고금리 이자 누적', '보증 채무', '생활비 부족']))
      .toEqual(['생활비 부족', '주식 투자 실패', '타인(친지, 친구 등)의 채무보증', '기타']);
    expect(normalizeDebtCauses(undefined)).toEqual([]);
    expect(STATEMENT_DEBT_CAUSES).toHaveLength(9);
  });
});
