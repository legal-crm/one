import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { cleanTerms } from './platformTermsService';
// @ts-ignore — 순수 JS 모듈
import { scanCompliance, setExtraComplianceTerms, getExtraComplianceTerms } from '../../../api/_lib/marketing-compliance.js';

describe('platform compliance terms', () => {
  afterEach(() => setExtraComplianceTerms([]));

  it('cleans admin input (trim, 2~40 chars, no duplicates)', () => {
    const r = cleanTerms([' 특급 해결 ', '특급 해결', '가', '', 'x'.repeat(41), '기적 상담']);
    expect(r.terms).toEqual(['특급 해결', '기적 상담']);
    expect(r.bad).toEqual(['가', 'x'.repeat(41)]);
  });

  it('adds admin terms to the marketing scan without removing base rules', () => {
    setExtraComplianceTerms([{ term: '특급 해결', reason: '근거 없는 표현' }, '전국구']);
    expect(getExtraComplianceTerms()).toHaveLength(2);
    const r = scanCompliance('이번 주 특급해결 안내, 무조건 인가!');
    const ids = r.issues.map((i: { ruleId: string }) => i.ruleId);
    expect(ids).toContain('admin-term');
    expect(ids).toContain('guarantee');
    expect(r.issues.find((i: { ruleId: string }) => i.ruleId === 'admin-term')?.hint).toBe('근거 없는 표현');
  });

  it('ignores empty or too-long admin terms', () => {
    setExtraComplianceTerms(['', 'a', { term: 'y'.repeat(41) }]);
    expect(getExtraComplianceTerms()).toEqual([]);
  });
});
