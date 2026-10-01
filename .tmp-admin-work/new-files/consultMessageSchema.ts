/**
 * 서버 consult_messages에 대상 변호사 칸(target_lawyer_id)이 있는지 — 상태만 보관한다.
 * (supabase를 import하지 않는다: 변호사 화면 필터(lawyer/chat/chatSelectors)가 이 값을 읽으므로
 *  순수 함수 모듈에서 불러도 서버 클라이언트가 딸려 오지 않게)
 *
 * - 'unknown' : 아직 확인 전 (앱 시작 직후, 또는 불러온 메시지가 없음)
 * - 'present' : 서버 응답 행에 target_lawyer_id 키가 있었다 (마이그레이션 030 적용됨)
 * - 'missing' : 응답 행에 그 키가 없거나, 저장 때 칸이 없다는 오류(PGRST204·42703)를 받았다
 *
 * 쓰는 곳
 * - consultService: 'missing'이면 저장할 때 그 칸을 빼고 보낸다
 * - chatSelectors: 'present'일 때만 '대상 정보 없는 의뢰인 메시지'를 비교 상담 중에 숨긴다
 *   (칸이 없으면 모든 메시지가 대상 없이 오므로, 숨기면 비교 상담 대화가 통째로 사라진다)
 */
export type TargetLawyerColumnState = 'unknown' | 'present' | 'missing';

let targetLawyerColumnState: TargetLawyerColumnState = 'unknown';

export function getTargetLawyerColumnState(): TargetLawyerColumnState {
  return targetLawyerColumnState;
}

export function setTargetLawyerColumnState(state: TargetLawyerColumnState): void {
  targetLawyerColumnState = state;
}
