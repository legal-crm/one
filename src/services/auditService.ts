import { supabase, isSupabaseConfigured } from '../supabaseClient';

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
  | 'auto_cleanup';

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
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // 콘솔 로그는 항상 남김 (개발 환경 디버깅용)
  if (import.meta.env.DEV) {
    console.log('[AUDIT]', entry.action, entry);
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
      detail: entry.detail || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      created_at: new Date().toISOString(),
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
export function auditAdminLoginFailed(attemptedId: string, attemptCount: number): void {
  writeAuditLog({
    actor_id: attemptedId || 'unknown',
    actor_role: 'anonymous',
    action: 'login_failed',
    detail: { attempt_count: attemptCount },
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
