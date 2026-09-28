// ============================================================
// [SECURITY] 통합 어드민 인증 (서버 판정 + TOTP MFA)
// ------------------------------------------------------------
// 이전 구조의 문제
//  - 관리자 여부를 번들에 하드코딩된 구글 이메일 목록으로 판정했고,
//  - "HMAC 세션"의 키가 같은 브라우저 sessionStorage(또는 번들의 VITE_SESSION_SECRET)에 있어
//    누구나 서명을 만들 수 있었으며,
//  - OTP는 브라우저에서 생성·검증되고 demoCode로 화면·콘솔에 노출됐다.
//
// 현재 구조
//  1) supabase.auth.getUser() — Auth 서버가 토큰을 검증해 돌려준 사용자만 신뢰
//  2) app_metadata.role === 'admin' — 서비스 롤로만 설정 가능한 값 (사용자가 직접 못 바꿈)
//  3) TOTP MFA(aal2) — Supabase Auth가 코드 검증·시도 제한을 서버에서 수행
//  4) DB 권한은 021 마이그레이션의 is_platform_admin()이 role=admin AND aal=aal2 로 판정
//     → 이 파일의 화면 분기를 조작해도 데이터에는 접근할 수 없다.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';

export type AdminAuthState =
  | { stage: 'signed_out'; reason?: 'not_configured' }
  | { stage: 'denied'; email: string }
  | { stage: 'mfa_enroll'; email: string }
  | { stage: 'mfa_verify'; email: string; factorId: string }
  | { stage: 'ready'; email: string };

/** 현재 로그인 상태를 서버 기준으로 판정 */
export async function evaluateAdminAuth(): Promise<AdminAuthState> {
  if (!isSupabaseConfigured) return { stage: 'signed_out', reason: 'not_configured' };

  const { data, error } = await supabase.auth.getUser();
  // 네트워크 장애는 '로그아웃'으로 판정하지 않고 호출 측에 알린다
  if (error && (error.name === 'AuthRetryableFetchError' || (error as { status?: number }).status === 0)) {
    throw error;
  }
  const user = data?.user;
  if (error || !user) return { stage: 'signed_out' };

  const email = (user.email || '').toLowerCase();
  if ((user.app_metadata as Record<string, unknown> | undefined)?.role !== 'admin') {
    return { stage: 'denied', email };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { stage: 'ready', email };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.all ?? []).find(f => f.factor_type === 'totp' && f.status === 'verified');
  if (verified) return { stage: 'mfa_verify', email, factorId: verified.id };
  return { stage: 'mfa_enroll', email };
}

export interface TotpEnrollment {
  factorId: string;
  /** SVG data URL (Supabase 제공) */
  qrCode: string;
  /** QR을 못 읽을 때 수동 입력용 비밀 키 */
  secret: string;
}

/** 인증 앱(TOTP) 등록 시작 — 이전에 끝내지 못한 미검증 등록은 정리 */
export async function startTotpEnrollment(): Promise<{ ok: true; enrollment: TotpEnrollment } | { ok: false; error: string }> {
  try {
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `mykim-admin-${Date.now()}`,
    });
    if (error || !data) return { ok: false, error: error?.message || '인증 앱 등록을 시작하지 못했습니다.' };
    return {
      ok: true,
      enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '인증 앱 등록을 시작하지 못했습니다.' };
  }
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** 6자리 코드 검증 (등록 확인·로그인 2단계 공용). 성공 시 세션이 aal2로 올라간다 */
export async function verifyTotpCode(factorId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidTotpCode(code)) return { ok: false, error: '6자리 숫자를 입력해 주세요.' };
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) {
      const tooMany = /rate|too many/i.test(error.message);
      return { ok: false, error: tooMany ? '시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요.' : '인증 코드가 올바르지 않거나 만료되었습니다.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: '인증 코드를 확인하지 못했습니다. 네트워크를 확인해 주세요.' };
  }
}

export async function signOutAdmin(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try { await supabase.auth.signOut(); } catch {}
}
