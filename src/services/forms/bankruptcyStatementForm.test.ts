import { describe, expect, it } from 'vitest';
import { BANKRUPTCY_STATEMENT_SCHEMA, bankruptcyAnswersFromClient } from './clientFormSchemas';

describe('파산 진술서 추가 진술사항 의뢰인 요청 (BK-7)', () => {
  it('서버 규칙 안의 칸 (40칸 이하·id 형식·제목 100자)', () => {
    const f = BANKRUPTCY_STATEMENT_SCHEMA.fields;
    expect(f.length).toBeLessThanOrEqual(40);
    expect(new Set(f.map(x => x.id)).size).toBe(f.length);
    f.forEach(x => { expect(x.id).toMatch(/^[a-z0-9_]{1,40}$/); expect(x.label.length).toBeLessThanOrEqual(100); });
  });
  it('의뢰인 답 → 공식 문항 답 (있어요만 내용, 빈 답은 건너뜀)', () => {
    const out = bankruptcyAnswersFromClient({
      q01_crime: '없어요', q01_crime_detail: '무시됨',
      q07_preferential: '있어요', q07_preferential_detail: 'TEST 2025-03 50만 원',
      q05_insolvency: '2024년 실직',
    });
    expect(out.q01_crime).toEqual({ answer: 'no', detail: '' });
    expect(out.q07_preferential).toEqual({ answer: 'yes', detail: 'TEST 2025-03 50만 원' });
    expect(out.q05_insolvency).toEqual({ answer: 'yes', detail: '2024년 실직' });
    expect(out.q02_installment).toBeUndefined();
  });
});
