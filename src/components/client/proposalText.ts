/**
 * 제안서 소견 표시 규칙 (의뢰인 화면)
 * 변호사가 소견 없이 제안서를 보내면 remark에 자리표시 문구('제안서 발송')가 저장된다.
 * 이 값을 변호사가 쓴 말처럼 따옴표로 보여주지 않는다.
 */
export const PLACEHOLDER_REMARKS = ['제안서 발송'];

/** 변호사가 실제로 작성한 소견이면 그 문자열, 아니면 빈 문자열 */
export function authoredRemark(value?: string | null): string {
  const trimmed = (value || '').trim();
  return trimmed && !PLACEHOLDER_REMARKS.includes(trimmed) ? trimmed : '';
}
