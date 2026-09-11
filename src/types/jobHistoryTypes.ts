/**
 * 국민연금공단(NPS) 및 국민건강보험공단(NHIS) 자격득실 경력 조회 데이터 타입
 */

export interface RetrievedJobHistoryItem {
  id: string;
  workplaceName: string;         // 사업장명칭 (회사명)
  joinDate: string;              // 자격취득일 (예: 2019-04-01)
  leaveDate?: string;            // 자격상실일 (예: 2022-12-31, 재직 중이면 undefined)
  isCurrent: boolean;            // 현재 재직 여부
  periodText: string;            // 포맷팅된 기간 (예: 2019.04 ~ 2022.12)
  durationMonths: number;        // 근속 개월수
  dataSource: 'NPS' | 'NHIS' | 'OCR_DOCUMENT' | 'MANUAL'; // 국민연금, 건강보험, 서류OCR, 직접입력
  suggestedPosition?: string;    // 추정 직위/업종 (예: 정규직, 사무직, 자영업)
  leaveReason?: string;          // 퇴직 사유
  selected: boolean;             // 진술서에 넣을지 여부 체크
}

export interface JobHistoryImportParams {
  name: string;
  rrnFront: string;              // 주민번호 앞자리 (생년월일 6자리)
  phone: string;
  telecom?: 'SKT' | 'KT' | 'LGU' | 'MVNO'; // 통신사
  authType: 'KAKAO' | 'PASS' | 'NAVER' | 'TOSS'; // 간편인증 수단
}

export interface JobHistoryImportResult {
  ok: boolean;
  source: 'scraping_api' | 'vision_ocr' | 'mock_simulation';
  totalCount: number;
  items: RetrievedJobHistoryItem[];
  queriedAt: string;
  errorMessage?: string;
}
