// ============================================================
// 외부 법률 검토 표시 (R6, 쟁점 33) — 한 곳
// 자문 변호사: 법률사무소 명율 소성록 변호사 (마이김변에 광고하지 않음, 건수와 무관한 정액 자문)
// 2026-11-01 검토 요청서 쟁점 1~39·계산기 검토 자료 전부 '그대로 진행' 확인 (docs/legal_review/02_review_result.md)
// 표시 형식: '법률 검토: 소성록 변호사(검토일)' — 실제로 검토한 글·문서에만, 사무소 이름·연락처·링크는 넣지 않는다(자문 변호사 광고 방지)
// ============================================================

export const LEGAL_REVIEWERS = Object.freeze([
  Object.freeze({ id: 'so-seongrok', name: '소성록 변호사', since: '2026-11-01' }),
]);

/** 2026-11-01 검토를 마친 사이트 문서 (약관·처리방침·법적 고지·변호사 약관·계산기·제도 안내) */
export const SITE_REVIEW = Object.freeze({ reviewer: 'so-seongrok', reviewedOn: '2026-11-01' });

export function reviewerName(id) {
  return LEGAL_REVIEWERS.find(r => r.id === id)?.name || '';
}

/** { reviewer, reviewedOn } → '법률 검토: 소성록 변호사(2026-11-01)', 조건이 안 맞으면 '' */
export function legalReviewLabel(review) {
  if (!review || typeof review !== 'object') return '';
  const name = reviewerName(review.reviewer);
  const on = typeof review.reviewedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedOn) ? review.reviewedOn : '';
  if (!name || !on) return '';
  const since = LEGAL_REVIEWERS.find(r => r.id === review.reviewer)?.since || '';
  if (since && on < since) return '';
  return `법률 검토: ${name}(${on})`;
}
