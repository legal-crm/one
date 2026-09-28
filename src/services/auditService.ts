import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getActiveRequestId } from '../utils/tracking';

// ============================================================
// [SECURITY Phase 2] 감사 로그 서비스
// 민감한 데이터 접근/수정 행위를 Supabase audit_logs에 기록합니다.
// ============================================================

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'login_locked'
  | 'view_client_detail'
  | 'view_financial_profile'
  | 'decrypt_phone'
  | 'download_report'
  | 'download_pdf'
  | 'export_excel'
  | 'update_config'
  | 'update_case'
  | 'update_profile'
  | 'delete_data'
  | 'send_notification'
  | 'chat_room_open'
  | 'diagnosis_submit'
  | 'diagnosis_view'
  | 'auto_cleanup'
  | 'access_denied'
  | 'mfa_enrolled'
  | 'honeypot_attempt'
  | 'revoke_auth_sessions';

export type ActorRole = 'admin' | 'lawyer' | 'client' | 'system' | 'anonymous';

export interface AuditEntry {
  actor_id: string;
  actor_role: ActorRole;
  action: AuditAction;
  target_type?: string;
  target_id?: string;
  detail?: Record<string, unknown>;
}

/**
 * 감사 로그를 Supabase audit_logs 테이블에 기록합니다.
 * Supabase 미설정 시 콘솔에만 출력합니다 (비차단).
 *
 * [021] 서버 트리거가 기록 시각·IP·실제 로그인 사용자(auth_uid/auth_email)를 채우고,
 * 관리자가 아닌 요청의 actor_role 'admin'/'system' 주장은 강등합니다.
 * 기록은 수정·삭제할 수 없고 조회는 관리자만 가능합니다.
 * actor_id·actor_role은 참고용 주장값이며, 신원 판단은 auth_uid로 하세요.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const reqId = getActiveRequestId();

  // [SECURITY M-2] 개발 환경에서만 비민감 메타데이터 로그 출력 (개인정보/상세 페이로드 제외)
  if (import.meta.env.DEV) {
    console.log('[AUDIT]', entry.action, {
      actor_role: entry.actor_role,
      target_type: entry.target_type,
      target_id: entry.target_id,
      request_id: reqId,
    });
  }

  if (!isSupabaseConfigured) {
    return;
  }

  try {
    await supabase.from('audit_logs').insert({
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      detail: {
        ...(entry.detail || {}),
        request_id: reqId,
      },
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    });
  } catch (err) {
    // 감사 로그 실패는 비차단 — 메인 기능에 영향 없음
    console.warn('[AUDIT] 감사 로그 기록 실패 (비차단):', err);
  }
}

/**
 * 관리자 로그인 성공 시 감사 로그
 */
export function auditAdminLogin(adminId: string): void {
  writeAuditLog({
    actor_id: adminId,
    actor_role: 'admin',
    action: 'login',
  });
}

/**
 * 관리자 로그인 실패 시 감사 로그
 */
export function auditAdminLoginFailed(attemptedId: string, attemptCount: number, stage: 'password' | 'mfa' = 'password'): void {
  writeAuditLog({
    actor_id: attemptedId || 'unknown',
    actor_role: 'anonymous',
    action: 'login_failed',
    target_type: 'admin_portal',
    detail: { attempt_count: attemptCount, stage },
  });
}

/**
 * 관리자 권한이 없는 계정의 관리자 포털 로그인 시도
 */
export function auditAdminAccessDenied(email: string): void {
  writeAuditLog({
    actor_id: email || 'unknown',
    actor_role: 'anonymous',
    action: 'access_denied',
    target_type: 'admin_portal',
  });
}

/**
 * 관리자 인증 앱(TOTP) 최초 등록
 */
export function auditMfaEnrolled(email: string): void {
  writeAuditLog({
    actor_id: email || 'unknown',
    actor_role: 'admin',
    action: 'mfa_enrolled',
    target_type: 'admin_portal',
  });
}

/**
 * 로그인 잠금 시 감사 로그
 */
export function auditLoginLocked(attemptedId: string): void {
  writeAuditLog({
    actor_id: attemptedId || 'unknown',
    actor_role: 'anonymous',
    action: 'login_locked',
    detail: { locked_at: new Date().toISOString() },
  });
}

/**
 * 관리자 로그아웃 시 감사 로그
 */
export function auditAdminLogout(adminId: string): void {
  writeAuditLog({
    actor_id: adminId,
    actor_role: 'admin',
    action: 'logout',
  });
}

/**
 * 고객 상세 정보 열람 시 감사 로그
 */
export function auditViewClient(actorId: string, actorRole: ActorRole, clientId: string): void {
  writeAuditLog({
    actor_id: actorId,
    actor_role: actorRole,
    action: 'view_client_detail',
    target_type: 'client',
    target_id: clientId,
  });
}

/**
 * PDF/보고서 다운로드 시 감사 로그
 */
export function auditDownload(actorId: string, actorRole: ActorRole, fileType: string, targetId?: string): void {
  writeAuditLog({
    actor_id: actorId,
    actor_role: actorRole,
    action: 'download_pdf',
    target_type: fileType,
    target_id: targetId,
    detail: { downloaded_at: new Date().toISOString() },
  });
}

/**
 * 진단 결과 제출 시 감사 로그
 */
export function auditDiagnosisSubmit(sessionId: string): void {
  writeAuditLog({
    actor_id: sessionId,
    actor_role: 'anonymous',
    action: 'diagnosis_submit',
    target_type: 'diagnosis',
  });
}

/**
 * 설정 변경 시 감사 로그
 */
export function auditConfigUpdate(adminId: string, configType: string, changes?: Record<string, unknown>): void {
  writeAuditLog({
    actor_id: adminId,
    actor_role: 'admin',
    action: 'update_config',
    target_type: configType,
    detail: changes,
  });
}
