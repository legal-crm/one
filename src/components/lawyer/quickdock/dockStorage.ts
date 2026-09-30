// ============================================================
// 퀵독 메모 저장소 (의뢰인 개인정보가 들어가는 도구 전용)
// - 상담 메모·핀 메모에는 성명·연락처·신분증 이미지 등이 들어갈 수 있으므로
//   localStorage(영구, 같은 브라우저 모든 사용자 공유)에 두지 않는다.
// - 텍스트: sessionStorage(탭을 닫으면 삭제), 이미지: 메모리만(새로고침 시 삭제)
// - 로그아웃 시 clearDockSensitiveData()로 즉시 삭제
// - 계산기 공유값(소득·채무·재산 금액, dockShared)도 로그아웃 시 함께 초기화
// ============================================================

import { resetDockShared } from './dockShared';

export const QUICK_MEMO_KEY = 'legal_dock_scratchpad_memo';
export const PIN_MEMO_KEY = 'legal_dock_pin_memo_slots_v1';

/** 이전 버전이 localStorage에 남긴 개인정보 메모 삭제 (1회성 정리) */
export function purgeLegacyDockMemos(): void {
  try {
    localStorage.removeItem(QUICK_MEMO_KEY);
    localStorage.removeItem(PIN_MEMO_KEY);
  } catch {
    // ignore
  }
}

/** 핀 메모 이미지 (탭 메모리 전용 — 도구를 닫았다 열어도 유지, 새로고침·로그아웃 시 삭제) */
export const pinImageCache = new Map<string, string>();

export function clearDockSensitiveData(): void {
  purgeLegacyDockMemos();
  pinImageCache.clear();
  resetDockShared();
  try {
    sessionStorage.removeItem(QUICK_MEMO_KEY);
    sessionStorage.removeItem(PIN_MEMO_KEY);
  } catch {
    // ignore
  }
}

/** 핀 메모 이미지 최대 크기 */
export const PIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
