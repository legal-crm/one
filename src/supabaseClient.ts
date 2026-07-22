/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Supabase 크레덴셜 (Anon Key는 공개 키이므로 클라이언트 번들에 포함해도 안전합니다)
// 환경변수가 있으면 우선 사용, 없으면 프로덕션 기본값 사용
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xgmmvpmoyywpttuslwkh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbW12cG1veXl3cHR0dXNsd2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU1MDIsImV4cCI6MjA5NTMxMTUwMn0.j9zOJQgczrW0XeJgiUnTFs9TRpJXnsw3eIgBd0zaxVA';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',        // hash 기반 OAuth (코드 교환 불필요)
    detectSessionInUrl: true,     // URL에서 세션 자동 감지
    autoRefreshToken: true,
    persistSession: true,
  }
});

// Supabase 연결 상태 확인 유틸리티
export const isSupabaseConfigured = true;
