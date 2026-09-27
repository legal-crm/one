import { supabase, isSupabaseConfigured } from '../supabaseClient';

// ============================================================
// 변호사 계정 ↔ Supabase Auth 매핑 (012_consult_requests_strict_rls.sql)
// - 변호사 DB 접근 권한은 lawyer_accounts.approved = true 인 계정에만 부여된다.
// - 매핑 등록은 본인만(항상 미승인으로 생성), 승인/정지는 관리자 JWT로만 가능.
// ============================================================

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
