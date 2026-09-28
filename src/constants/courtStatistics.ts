/**
 * 관할 법원 기본 정보
 *
 * 이전 버전은 법원별 '금지명령 인용률·평균 변제율·개시 소요기간·심사 유연성'과
 * "전국에서 가장 채무자 친화적", "접수를 강력 권고" 같은 평가 문구를 담고 있었으나,
 * 출처(사법연감 등)·기준일이 없는 임의 수치였고 의뢰인 제안서에까지 그대로 노출되었다.
 * 검증 가능한 정보(법원명·회생전문법원 여부)만 남기고, 통계는 공식 자료 확보 전까지 제공하지 않는다.
 */

export interface CourtStatistics {
  courtName: string;
  /** 회생법원(전문법원) 여부 */
  isSpecialized: boolean;
}

/** 회생법원(전문법원) — 서울·수원·부산, 2026.3. 개원 대전·대구·광주 */
const SPECIALIZED_REHAB_COURTS = new Set([
  '서울회생법원',
  '수원회생법원',
  '부산회생법원',
  '대전회생법원',
  '대구회생법원',
  '광주회생법원',
]);

/** 공식 통계 미확보 안내 문구 (화면 공통) */
export const COURT_STATS_UNAVAILABLE_NOTICE =
  '법원별 인가율·금지명령 인용률·처리기간 등 공식 통계는 확보되지 않아 표시하지 않습니다. 관할 법원의 최신 실무준칙을 직접 확인하세요.';

/** 법원 기본 정보 조회 */
export function getCourtStats(courtName: string): CourtStatistics {
  const name = (courtName || '').trim();
  return { courtName: name, isSpecialized: SPECIALIZED_REHAB_COURTS.has(name) };
}
