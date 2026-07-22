/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Supabase 크레덴셜 (Anon Key는 공개 키이므로 클라이언트 번들에 포함해도 안전합니다)
// 환경변수가 있으면 우선 사용, 없으면 프로덕션 기본값 사용
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xgmmvpmoyywpttuslwkh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbW12cG1veXl3cHR0dXNsd2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU1MDIsImV4cCI6MjA5NTMxMTUwMn0.j9zOJQgczrW0XeJgiUnTFs9TRpJXnsw3eIgBd0zaxVA';

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

// Supabase 서버가 #access_token (implicit) 방식으로 응답하므로 클라이언트도 implicit으로 설정
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    lock: noOpLock as any,
  }
});

// Supabase 연결 상태 확인 유틸리티
export const isSupabaseConfigured = true;
