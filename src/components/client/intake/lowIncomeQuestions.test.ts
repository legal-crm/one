import { describe, expect, it } from 'vitest';
import { bankruptcyReferenceLines, needsLowIncomeQuestions } from './lowIncomeQuestions';

describe('소득이 없거나 생계비 이하일 때 추가 질문 (I-7)', () => {
  it('보여 줄지 여부 (소득 만 원 단위)', () => {
    expect(needsLowIncomeQuestions({ jobType: 'UNEMPLOYED', income: 300 }, 2026)).toBe(true);
    expect(needsLowIncomeQuestions({ jobType: 'SALARIED', income: 0 }, 2026)).toBe(true);
    // 2026 1인 생계비 1,538,543원 → 150만 원은 이하, 160만 원은 초과
    expect(needsLowIncomeQuestions({ jobType: 'SALARIED', income: 150, dependents: 0 }, 2026)).toBe(true);
    expect(needsLowIncomeQuestions({ jobType: 'SALARIED', income: 160, dependents: 0 }, 2026)).toBe(false);
    // 2인 2,519,575원
    expect(needsLowIncomeQuestions({ jobType: 'SALARIED', income: 250, dependents: 1 }, 2026)).toBe(true);
    expect(needsLowIncomeQuestions(null)).toBe(false);
  });
  it('답한 것만 변호사 자료 줄로', () => {
    expect(bankruptcyReferenceLines(undefined)).toEqual([]);
    expect(bankruptcyReferenceLines({ unableSince: 'over2y', disposal2y: 'no' })).toEqual(['• 갚기 어려워진 때: 2년 넘음', '• 최근 2년 재산 처분: 없음']);
  });
});
