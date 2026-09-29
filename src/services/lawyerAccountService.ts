import { supabase, isSupabaseConfigured } from '../supabaseClient';

// ============================================================
// 변호사 계정 ↔ Supabase Auth 매핑 (012_consult_requests_strict_rls.sql)
// - 변호사 DB 접근 권한은 lawyer_accounts.approved = true 인 계정에만 부여된다.
// - 매핑 등록은 본인만(항상 미승인으로 생성), 승인/정지는 관리자 JWT로만 가능.
// ============================================================

export interface LawyerAccount {
  lawyerId: string;
  approved: boolean;
  authEmail: string | null;
}

export type LawyerAccountResult =
  | { ok: true; account: LawyerAccount }
  | { ok: false; reason: 'not_configured' | 'no_session' | 'error'; message?: string };

/**
 * 현재 Supabase 세션에 이미 연결된 변호사 계정 매핑만 조회한다 (생성하지 않음).
 * 의뢰인 세션이 변호사 화면에 들어왔을 때 자동으로 변호사 계정이 만들어지지 않도록
 * 새 매핑 생성은 사용자가 "변호사 로그인"을 직접 시작한 경우에만 claimLawyerAccount로 한다.
 * @returns ok=true & account=null 이면 매핑 없음
 */
export async function getMyLawyerAccount(): Promise<
  { ok: true; account: LawyerAccount | null } | { ok: false; reason: 'not_configured' | 'no_session' | 'error'; message?: string }
> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'not_configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'no_session' };
    const { data, error } = await supabase
      .from('lawyer_accounts')
      .select('lawyer_id, approved, auth_email')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('[lawyerAccount] 계정 매핑 조회 실패:', error.message);
      return { ok: false, reason: 'error', message: error.message };
    }
    if (!data) return { ok: true, account: null };
    return {
      ok: true,
      account: {
        lawyerId: String(data.lawyer_id),
        approved: data.approved === true,
        authEmail: data.auth_email ?? session.user.email ?? null,
      },
    };
  } catch (e: any) {
    console.warn('[lawyerAccount] 계정 매핑 조회 예외:', e);
    return { ok: false, reason: 'error', message: e?.message };
  }
}

/**
 * 현재 Supabase 세션의 변호사 계정 매핑을 조회하고, 없으면 서버가 'lawyer-<uid>'로
 * 미승인 매핑을 생성한다 (018 claim_lawyer_account).
 * 변호사 포털 로그인 판정은 반드시 이 결과(서버 판정)만 사용한다.
 */
export async function claimLawyerAccount(): Promise<LawyerAccountResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'not_configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: 'no_session' };

    const { data, error } = await supabase.rpc('claim_lawyer_account');
    if (error) {
      console.warn('[lawyerAccount] 계정 매핑 확인 실패:', error.message);
      return { ok: false, reason: 'error', message: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.lawyer_id) return { ok: false, reason: 'error', message: 'empty mapping' };
    return {
      ok: true,
      account: {
        lawyerId: String(row.lawyer_id),
        approved: row.approved === true,
        authEmail: row.auth_email ?? session.user.email ?? null,
      },
    };
  } catch (e: any) {
    console.warn('[lawyerAccount] 계정 매핑 확인 예외:', e);
    return { ok: false, reason: 'error', message: e?.message };
  }
}

/**
 * OAuth 로그인한 변호사 계정을 lawyer_id에 연결한다. (멱등)
 * @returns 승인 여부 (DB 미설정·실패 시 null)
 */
export async function registerLawyerAccount(lawyerId: string): Promise<boolean | null> {
  if (!isSupabaseConfigured || !lawyerId) return null;
  try {
    const { data, error } = await supabase.rpc('register_lawyer_account', { p_lawyer_id: lawyerId });
    if (error) {
      console.warn('[lawyerAccount] 매핑 등록 실패:', error.message);
      return null;
    }
    return Boolean(data);
  } catch (e) {
    console.warn('[lawyerAccount] 매핑 등록 예외:', e);
    return null;
  }
}

/**
 * 관리자: 변호사 프로필 ID에 연결된 서버 계정 매핑(승인 여부) 조회.
 * lawyer_accounts SELECT 정책상 관리자(is_platform_admin)만 타인 행을 볼 수 있다.
 * @returns ok=true & account=null 이면 이 프로필 ID에 연결된 로그인 계정이 없음
 */
export async function getLawyerAccountByLawyerId(lawyerId: string): Promise<
  { ok: true; account: LawyerAccount | null } | { ok: false; reason: 'not_configured' | 'error'; message?: string }
> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'not_configured' };
  if (!lawyerId) return { ok: true, account: null };
  try {
    const { data, error } = await supabase
      .from('lawyer_accounts')
      .select('lawyer_id, approved, auth_email')
      .eq('lawyer_id', lawyerId)
      .maybeSingle();
    if (error) {
      console.warn('[lawyerAccount] 관리자 매핑 조회 실패:', error.message);
      return { ok: false, reason: 'error', message: error.message };
    }
    if (!data) return { ok: true, account: null };
    return {
      ok: true,
      account: {
        lawyerId: String(data.lawyer_id),
        approved: data.approved === true,
        authEmail: data.auth_email ?? null,
      },
    };
  } catch (e: any) {
    console.warn('[lawyerAccount] 관리자 매핑 조회 예외:', e);
    return { ok: false, reason: 'error', message: e?.message };
  }
}

/**
 * 관리자: 한 번 이상 소셜 로그인한 계정(이메일)을 기존 변호사 프로필 ID에 연결 (018 admin_link_lawyer_account).
 * 해당 계정이 다른 ID(예: 'lawyer-<uid>')로 매핑되어 있었다면 이 프로필 ID로 옮겨진다.
 */
export async function adminLinkLawyerAccount(
  email: string,
  lawyerId: string,
  approved: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase가 설정되지 않았습니다.' };
  const trimmed = (email || '').trim();
  if (!trimmed || !lawyerId) return { ok: false, message: '이메일과 프로필 ID가 필요합니다.' };
  try {
    const { data, error } = await supabase.rpc('admin_link_lawyer_account', {
      p_email: trimmed,
      p_lawyer_id: lawyerId,
      p_approved: approved,
    });
    if (error) {
      console.warn('[lawyerAccount] 계정 연결 실패:', error.message);
      const msg = error.message || '';
      if (msg.includes('no auth user')) return { ok: false, message: '이 이메일로 로그인한 기록이 없습니다. 변호사가 소셜 로그인을 한 번 완료한 뒤 다시 시도하세요.' };
      if (msg.includes('already linked')) return { ok: false, message: '이 프로필 ID는 이미 다른 로그인 계정에 연결되어 있습니다.' };
      if (msg.includes('admin only')) return { ok: false, message: '관리자 권한(MFA 인증 포함)이 확인되지 않았습니다.' };
      return { ok: false, message: msg || '계정 연결에 실패했습니다.' };
    }
    return data === false ? { ok: false, message: '계정 연결에 실패했습니다.' } : { ok: true };
  } catch (e: any) {
    console.warn('[lawyerAccount] 계정 연결 예외:', e);
    return { ok: false, message: e?.message || '계정 연결에 실패했습니다.' };
  }
}

/**
 * 관리자: 변호사 DB 접근 승인/정지. 앱 화면의 승인 상태와 함께 호출한다.
 * @returns 매핑된 계정이 있어 반영되었으면 true
 */
export async function setLawyerDbApproval(lawyerId: string, approved: boolean): Promise<boolean> {
  if (!isSupabaseConfigured || !lawyerId) return false;
  try {
    const { data, error } = await supabase.rpc('admin_set_lawyer_approval', {
      p_lawyer_id: lawyerId,
      p_approved: approved,
    });
    if (error) {
      console.warn('[lawyerAccount] 승인 상태 반영 실패:', error.message);
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.warn('[lawyerAccount] 승인 상태 반영 예외:', e);
    return false;
  }
}
