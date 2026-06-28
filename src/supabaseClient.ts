/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// [SECURITY] Supabase 크레덴셜을 환경변수에서만 로드합니다.
// .env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요.
// 소스코드에 API 키를 하드코딩하지 않습니다.
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SECURITY] Supabase 환경변수가 설정되지 않았습니다. ' +
    '.env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요. ' +
    'DB 관련 기능(진단 결과 저장 등)이 비활성화됩니다.'
  );
}

// 환경변수가 없으면 더미 클라이언트를 생성하여 런타임 에러 방지
export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Supabase 연결 상태 확인 유틸리티
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
