import { describe, expect, it } from 'vitest';
import { SITE_REVIEW, legalReviewLabel } from '../../../api/_lib/legal-review.js';

describe('법률 검토 표시 (R6·쟁점 33)', () => {
  it('등록된 검토 변호사·날짜가 있을 때만 표시', () => {
    expect(legalReviewLabel(SITE_REVIEW)).toBe('법률 검토: 소성록 변호사(2026-11-01)');
    expect(legalReviewLabel({ reviewer: 'so-seongrok', reviewedOn: '2026-12-03' })).toBe('법률 검토: 소성록 변호사(2026-12-03)');
    expect(legalReviewLabel(undefined)).toBe('');
    expect(legalReviewLabel({ reviewer: 'unknown', reviewedOn: '2026-12-03' })).toBe('');
    expect(legalReviewLabel({ reviewer: 'so-seongrok', reviewedOn: '' })).toBe('');
  });
  it('자문 시작 전 날짜는 표시하지 않음', () => {
    expect(legalReviewLabel({ reviewer: 'so-seongrok', reviewedOn: '2026-10-01' })).toBe('');
  });
});
