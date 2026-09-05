// ============================================================
// [SECURITY] 의뢰인(고객) 세션 생명주기 및 보안 가드 서비스
// 창/탭 종료 시 세션 자동 파기, 30분 유휴 타임아웃, 스토리지 전수 소각 지원
// ============================================================

import { supabase } from '../supabaseClient';
import { secureRemoveItem } from '../utils/secureStorage';

export const CLIENT_SESSION_ACTIVE_KEY = 'legal_crm_client_session_active';
export const CLIENT_LAST_ACTIVE_KEY = 'legal_crm_client_last_active';
export const CLIENT_PENDING_OAUTH_KEY = 'pending_oauth_login';
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30분 미활동 시 자동 로그아웃 (금융/법률 표준)

const SESSION_SECURITY_CHANNEL = 'legal_crm_session_security_channel';

/**
 * 현재 페이지 로드가 새로고침(F5, Ctrl+R, 새로고침 버튼)인지 정밀 감지합니다.
 * PerformanceNavigationTiming (Level 2) 및 legacy performance.navigation 지원
 */
export function isPageReload(): boolean {
  try {
    if (typeof window === 'undefined' || !window.performance) return false;
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries && navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      return nav.type === 'reload';
    }
    // Legacy Performance API 폴백 (타입 1 = TYPE_RELOAD)
    if ((performance as any).navigation) {
      return (performance as any).navigation.type === 1;
    }
  } catch {
    // 안전한 폴백
  }
  return false;
}

/**
 * 소셜 로그인(Kakao / Google) 후 리다이렉트 콜백으로 돌아온 상태인지 확인합니다.
 */
export function isOAuthReturnFlow(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // 1. URL 해시 또는 파라미터에 OAuth 토큰/코드 포함 여부
    const hasHashToken = hash.includes('access_token=') || hash.includes('refresh_token=');
    const hasSearchCode = search.includes('code=');

    // 2. AuthModal에서 리다이렉트 직전에 세팅한 플래그 확인
    const pendingSession = sessionStorage.getItem(CLIENT_PENDING_OAUTH_KEY);
    const pendingLocal = localStorage.getItem(CLIENT_PENDING_OAUTH_KEY);

    return hasHashToken || hasSearchCode || Boolean(pendingSession) || Boolean(pendingLocal);
  } catch {
    return false;
  }
}

/**
 * 마지막 사용자 활동 시각을 조회합니다.
 */
export function getClientLastActiveTimestamp(): number {
  try {
    const val = sessionStorage.getItem(CLIENT_LAST_ACTIVE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * 사용자 활동이 감지되었을 때 마지막 활동 시각을 갱신합니다.
 */
export function touchClientActivity(): void {
  try {
    sessionStorage.setItem(CLIENT_LAST_ACTIVE_KEY, Date.now().toString());
    sessionStorage.setItem(CLIENT_SESSION_ACTIVE_KEY, 'true');
  } catch {
    // ignore
  }
}

/**
 * 의뢰인 세션 및 로컬/세션 스토리지의 모든 민감 데이터를 완전 소각(Purge)합니다.
 */
export async function purgeClientSession(): Promise<void> {
  try {
    // 1. Supabase 공식 로그아웃 (원격 세션 무효화)
    await supabase.auth.signOut().catch(() => {});
  } catch {}

  try {
    // 2. 세션 스토리지 정리
    sessionStorage.removeItem(CLIENT_SESSION_ACTIVE_KEY);
    sessionStorage.removeItem(CLIENT_LAST_ACTIVE_KEY);
    sessionStorage.removeItem(CLIENT_PENDING_OAUTH_KEY);

    // 3. secureStorage 민감 데이터 정리
    secureRemoveItem('legal_crm_client_id');
    secureRemoveItem('legal_crm_client_alias');
    secureRemoveItem('legal_crm_requests');
    secureRemoveItem('legal_crm_messages');
    secureRemoveItem('legal_crm_inquiries');
    secureRemoveItem('legal_crm_appointed_lawyer_id');
    secureRemoveItem('lawyer_favorites');

    // 4. sessionStorage & localStorage 내 모든 Supabase 잔여 토큰(청크 포함) 전수 삭제
    const purgeKeys = (storage: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('auth-token') || k === CLIENT_PENDING_OAUTH_KEY)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => storage.removeItem(k));
    };

    purgeKeys(sessionStorage);
    purgeKeys(localStorage);
  } catch {}

  // 5. 열려있는 다른 탭에 즉각 강제 로그아웃 동기화 전파 (BroadcastChannel)
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SESSION_SECURITY_CHANNEL);
      channel.postMessage({ type: 'CLIENT_LOGOUT', timestamp: Date.now() });
      channel.close();
    }
  } catch {}
}

/**
 * 앱 진입 시(컴포넌트 마운트 시) 세션 복원 가능 여부를 엄격하게 판정합니다.
 *
 * - OAuth 리다이렉트 복귀 시: 정상 승인 (소셜 로그인 직후)
 * - 새로고침(F5) 시: 30분 유휴 타임아웃 검증 후 허용
 * - 창/탭 닫았다가 다시 열었을 때 (크롬 세션 복원, 북마크 재진입 등): 즉각 소각 및 로그인 해제
 */
export async function validateClientSessionOnMount(): Promise<{
  canRestore: boolean;
  reason?: 'window_closed' | 'inactivity_timeout' | 'valid';
}> {
  const isReload = isPageReload();
  const isOAuth = isOAuthReturnFlow();

  // 1. OAuth 콜백 흐름: 소셜 로그인 완료 후 첫 리턴이므로 정상 승인
  if (isOAuth) {
    touchClientActivity();
    return { canRestore: true, reason: 'valid' };
  }

  // 2. 단순 페이지 새로고침 (F5 / Ctrl+R)
  if (isReload) {
    const lastActive = getClientLastActiveTimestamp();
    const now = Date.now();
    // 30분 넘게 방치된 후 새로고침한 경우 만료
    if (lastActive > 0 && now - lastActive > INACTIVITY_TIMEOUT_MS) {
      await purgeClientSession();
      return { canRestore: false, reason: 'inactivity_timeout' };
    }
    touchClientActivity();
    return { canRestore: true, reason: 'valid' };
  }

  // 3. 새로고침도 아니고 OAuth 복귀도 아님:
  //    브라우저 창을 닫았다가 다시 열었거나, 새로운 창/탭에서 접속한 경우.
  //    Chromium의 "중단한 위치에서 계속하기" 등으로 인해 sessionStorage가 디스크에서 복원되었더라도,
  //    사용자가 창을 닫았으므로 보안을 위해 복원된 세션을 즉시 전수 소각합니다.
  await purgeClientSession();
  return { canRestore: false, reason: 'window_closed' };
}

/**
 * 로그인 상태일 때 30분 무활동(유휴) 감시 타이머를 가동합니다.
 * 사용자 활동(마우스, 키보드, 터치, 스크롤) 시 타임스탬프를 갱신하며,
 * 30분 동안 조작이 없으면 onTimeout 콜백을 호출합니다.
 */
export function setupClientInactivityWatcher(onTimeout: (reason: string) => void): () => void {
  let lastTouch = Date.now();

  const handleActivity = () => {
    const now = Date.now();
    // 과도한 스토리지 쓰기 방지: 최소 5초 간격으로만 타임스탬프 갱신
    if (now - lastTouch > 5000) {
      lastTouch = now;
      touchClientActivity();
    }
  };

  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

  // 10초 주기 정기 유휴 시간 점검
  const intervalId = setInterval(async () => {
    const lastActive = getClientLastActiveTimestamp();
    const now = Date.now();
    if (lastActive > 0 && now - lastActive > INACTIVITY_TIMEOUT_MS) {
      clearInterval(intervalId);
      await purgeClientSession();
      onTimeout('30분 동안 활동이 없어 개인정보 및 채무 정보 보호를 위해 세션이 안전하게 자동 종료되었습니다.');
    }
  }, 10_000);

  return () => {
    clearInterval(intervalId);
    events.forEach(e => window.removeEventListener(e, handleActivity));
  };
}

/**
 * 다른 탭에서 로그아웃이 발생했을 때 실시간 동기화 수신
 */
export function listenToRemoteClientLogout(onLogout: () => void): () => void {
  try {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return () => {};
    }
    const channel = new BroadcastChannel(SESSION_SECURITY_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === 'CLIENT_LOGOUT') {
        onLogout();
      }
    };
    return () => {
      try {
        channel.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
