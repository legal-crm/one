/**
 * [SECURITY] 보안 스토리지 유틸리티
 * 
 * 민감한 PII 데이터는 sessionStorage에 저장 (탭 종료 시 자동 삭제)
 * 공개 콘텐츠는 localStorage에 저장 (캐싱 용도)
 */

// 민감 데이터 키 목록 (sessionStorage 사용)
const SENSITIVE_KEYS = new Set([
  'legal_crm_requests',       // 상담 요청 (재무 프로필 포함)
  'legal_crm_messages',       // 상담 메시지 (비밀 대화)
  'legal_crm_cases',          // 사건 데이터
  'legal_crm_members',        // 직원/구성원 정보
  'legal_crm_client_memos',   // 고객 메모
  'legal_crm_activity_logs',  // 활동 로그
  'legal_crm_inquiries',      // 고객 문의 (개인정보)
  'legal_crm_lawyer_inquiries', // 변호사 문의
  'legal_crm_client_id',      // 고객 식별자
  'legal_crm_admin_session',  // 관리자 세션
]);

function getStorage(key: string): Storage {
  return SENSITIVE_KEYS.has(key) ? sessionStorage : localStorage;
}

/**
 * 키의 민감도에 따라 적절한 스토리지에서 데이터를 읽습니다.
 * 민감 데이터 → sessionStorage (탭 닫으면 삭제)
 * 공개 데이터 → localStorage (지속 캐싱)
 */
export function secureGetItem(key: string): string | null {
  // 마이그레이션: localStorage에 남아있는 민감 데이터를 sessionStorage로 이동
  if (SENSITIVE_KEYS.has(key)) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
    
    // localStorage에 이전 데이터가 있으면 이동
    const localValue = localStorage.getItem(key);
    if (localValue) {
      sessionStorage.setItem(key, localValue);
      localStorage.removeItem(key); // 민감 데이터 localStorage에서 제거
      return localValue;
    }
    return null;
  }
  return localStorage.getItem(key);
}

/**
 * 키의 민감도에 따라 적절한 스토리지에 데이터를 저장합니다.
 */
export function secureSetItem(key: string, value: string): void {
  try {
    getStorage(key).setItem(key, value);
  } catch {
    // 스토리지 용량 초과 시 무시
  }
}

/**
 * 키의 민감도에 따라 적절한 스토리지에서 데이터를 삭제합니다.
 */
export function secureRemoveItem(key: string): void {
  // 양쪽 모두에서 삭제 (마이그레이션 안전성)
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

/**
 * 민감 데이터인지 확인합니다.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key);
}
