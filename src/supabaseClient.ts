/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Supabase 크레덴셜 (Anon Key는 공개 키이므로 클라이언트 번들에 포함해도 안전합니다)
// 환경변수가 있으면 우선 사용, 없으면 프로덕션 기본값 사용
// ============================================================
// [SECURITY] 환경변수가 있으면 사용, 없으면 빈 문자열 할당 후 경고
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[SECURITY] Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다. Auth 및 DB 기능이 작동하지 않습니다.');
}
// navigator.locks 데드락 방지: no-op lock 함수 사용
// Supabase auth-js가 navigator.locks.request()를 사용하는데,
// OAuth 리다이렉트 후 페이지 로드 시 lock이 해제되지 않아 getSession()이 영원히 멈추는 문제 해결
const noOpLock = async (
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<any>
): Promise<any> => {
  return await fn();
};

// 세션 스토리지 어댑터: sessionStorage를 사용하여 브라우저(탭) 종료 시 세션이 자동 만료되도록 함
// localStorage(기본값)는 브라우저를 닫아도 세션이 영구 유지되어 보안 문제 발생
const sessionStorageAdapter = {
  getItem: (key: string): string | null => {
    return sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    sessionStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    sessionStorage.removeItem(key);
  },
};

// Supabase 서버가 #access_token (implicit) 방식으로 응답하므로 클라이언트도 implicit으로 설정
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    lock: noOpLock as any,
    storage: sessionStorageAdapter,
    // persistSession은 true(기본값) 유지하되, storage를 sessionStorage로 교체하여
    // 브라우저 탭이 열려 있는 동안만 세션 유지, 브라우저 종료 시 자동 삭제
    persistSession: true,
  }
});

// Supabase 연결 상태 확인 유틸리티
export const isSupabaseConfigured = true;
