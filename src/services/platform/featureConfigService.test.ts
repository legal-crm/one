import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));
import { caseReviewAccess, DEFAULT_FEATURE_CONFIG, type PlatformFeatureConfig } from './featureConfigService';

const cfg = (mode: PlatformFeatureConfig['caseReviewBilling']['mode'], effectiveFrom?: string): PlatformFeatureConfig =>
  ({ ...DEFAULT_FEATURE_CONFIG, caseReviewBilling: { mode, effectiveFrom } });

describe('사건 검토 이용 조건 (CT-15)', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  it('무료면 모두 연다', () => expect(caseReviewAccess(cfg('free'), {}, now).open).toBe(true));
  it('시작일 전에는 모두 연다', () => expect(caseReviewAccess(cfg('flat_paid', '2026-12-15'), {}, now).open).toBe(true));
  it('광고 혜택: 노출 중 광고가 있으면 연다', () => {
    expect(caseReviewAccess(cfg('ad_benefit', '2026-10-01'), { adTier: 'top' }, now).open).toBe(true);
    expect(caseReviewAccess(cfg('ad_benefit', '2026-10-01'), { adTier: 'free' }, now).open).toBe(false);
  });
  it('정액: 관리자가 켠 변호사만', () => {
    expect(caseReviewAccess(cfg('flat_paid', '2026-10-01'), { aiCaseAnalysisEnabled: true }, now).open).toBe(true);
    expect(caseReviewAccess(cfg('flat_paid', '2026-10-01'), { adTier: 'top' }, now).open).toBe(false);
  });
});
