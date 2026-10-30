// 보정 대응 화면 문구 (서버 연결 없는 순수 모듈 — 계산·출력·시험에서 함께 쓴다)

export type CorrectionKind = 'recommendation' | 'order' | 'objection_reply';
export type CorrectionStatus = 'received' | 'itemized' | 'requested' | 'drafting' | 'review' | 'submitted' | 'extension';
export type ItemOwner = 'client' | 'office' | 'both';
export type ItemStatus = 'draft' | 'requested' | 'in_progress' | 'submitted' | 'needs_fix' | 'confirmed' | 'cannot_submit' | 'office_done';
export type CannotReason = 'none' | 'delayed' | 'refused' | 'other';
export type TableType = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10' | 'T11';

export const KIND_LABEL: Record<CorrectionKind, string> = { recommendation: '보정권고', order: '보정명령', objection_reply: '이의 답변' };
export const ORDER_STATUS_LABEL: Record<CorrectionStatus, string> = {
  received: '접수', itemized: '항목 정리', requested: '의뢰인 요청', drafting: '작성 중', review: '검토', submitted: '제출 완료', extension: '연장 신청',
};
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  draft: '정리 중', requested: '요청함', in_progress: '의뢰인 작성 중', submitted: '의뢰인 보냄', needs_fix: '보완 요청',
  confirmed: '확인 완료', cannot_submit: '낼 수 없음', office_done: '사무소 처리',
};
export const CANNOT_REASON_LABEL: Record<CannotReason, string> = { none: '자료가 없어요', delayed: '발급이 늦어져요', refused: '기관이 발급을 거절했어요', other: '기타' };
