import { describe, expect, it } from 'vitest';
import { applyDocRules, deriveDocFacts, isIssueStale, needsIssueDate } from './docRules';

const items = [
  { id: 'rs-p2-10', isRequired: true },
  { id: 'rs-p2-11', isRequired: false },
  { id: 'rs-p2-12', isRequired: false },
  { id: 'rs-p2-17', isRequired: false },
  { id: 'rb-p2-1', isRequired: true },
  { id: 'rs-p1-1', isRequired: true },
];

describe('docRules', () => {
  it('무상 거주 급여 소득자: 임대차·등기·사업자 서류는 빠지고 무상거주확인서·원천징수는 필수', () => {
    const facts = deriveDocFacts({ financialProfile: { housingType: 'free', jobType: 'SALARIED', assets: [{ type: 'deposit', name: '예금' }] } });
    const r = Object.fromEntries(applyDocRules(items, facts).map(x => [x.item.id, x]));
    expect(r['rs-p2-10'].applies).toBe(false);
    expect(r['rs-p2-11'].applies).toBe(true);
    expect(r['rs-p2-11'].isRequired).toBe(true);
    expect(r['rs-p2-12'].applies).toBe(false);
    expect(r['rs-p2-17'].isRequired).toBe(true);
    expect(r['rb-p2-1'].applies).toBe(false);
    expect(r['rs-p1-1'].isRequired).toBe(true);
  });

  it('사실을 모르면 빼지 않고 확인 필요 (재산 목록이 비어 있으면 부동산 여부도 모름)', () => {
    expect(applyDocRules(items, deriveDocFacts({ financialProfile: { housingType: 'free', assets: [] } }))
      .find(x => x.item.id === 'rs-p2-12')?.applies).toBeNull();
    const r = applyDocRules(items, deriveDocFacts({ financialProfile: {} }));
    expect(r.find(x => x.item.id === 'rs-p2-10')?.applies).toBeNull();
    expect(r.find(x => x.item.id === 'rs-p2-10')?.isRequired).toBe(false);
  });

  it('변호사 결정이 규칙보다 먼저', () => {
    const facts = deriveDocFacts({ financialProfile: { housingType: 'owned', jobType: 'BUSINESS' } });
    const r = applyDocRules(items, facts, { 'rs-p2-10': 'include', 'rb-p2-1': 'exclude' });
    expect(r.find(x => x.item.id === 'rs-p2-10')?.applies).toBe(true);
    expect(r.find(x => x.item.id === 'rb-p2-1')?.applies).toBe(false);
    expect(r.find(x => x.item.id === 'rs-p2-12')?.applies).toBe(true);
  });

  it('파산 사건 판정은 사건 종류로', () => {
    expect(deriveDocFacts({ financialProfile: { income: 0, debtTotal: 90000 } }).caseType).toBe('rehab');
    expect(deriveDocFacts({ financialProfile: {} }, { caseType: 'bankruptcy' }).caseType).toBe('bankruptcy');
  });

  it('발급일 기준', () => {
    expect(isIssueStale('2026-09-01', 1, '2026-10-15')).toBe(true);
    expect(isIssueStale('2026-09-20', 1, '2026-10-15')).toBe(false);
    expect(isIssueStale(undefined, 1)).toBe(false);
    expect(needsIssueDate({ id: 'x', agency: '정부24 / 주민센터', name: '주민등록등본' })).toBe(true);
    expect(needsIssueDate({ id: 'y', agency: '신청인 보유 (실물 등기 발송)', name: '인감도장 (실물)' })).toBe(false);
  });
});
