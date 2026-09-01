import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { CopilotAuditAction } from '../types/copilot';

/**
 * 코파일럿 전용 감사 로그 기록 서비스
 * Supabase `copilot_audit_logs` 테이블에 기록하며 실패 시 메인 로직을 차단하지 않습니다.
 * 오프라인/미설정 시 localStorage 폴백을 사용합니다.
 *
 * @param tenantId - 테넌트 식별자
 * @param actorId - 액터 식별자
 * @param actorRole - 액터 역할
 * @param action - 수행한 감사 동작
 * @param targetType - 대상 리소스 타입
 * @param targetId - 대상 리소스 식별자
 * @param detail - 상세 내역
 */
export async function writeCopilotAuditLog(
  tenantId: string,
  actorId: string,
  actorRole: string,
  action: CopilotAuditAction,
  targetType: string,
  targetId: string,
  detail: Record<string, any>
): Promise<void> {
  const logEntry = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    created_at: new Date().toISOString()
  };

  // [SECURITY M-2] 개발 환경에서만 비민감 메타데이터 로그 출력 (상세 페이로드 제외)
  if (import.meta.env.DEV) {
    console.log('[COPILOT_AUDIT]', action, {
      actorRole,
      targetType,
      targetId,
    });
  }

  // 1. LocalStorage 폴백 저장
  try {
    const raw = localStorage.getItem('copilot_audit_logs');
    const logs = raw ? JSON.parse(raw) : [];
    logs.push(logEntry);
    localStorage.setItem('copilot_audit_logs', JSON.stringify(logs));
  } catch (e) {
    console.warn('[COPILOT_AUDIT] localStorage 저장 실패', e);
  }

  // 2. Supabase 저장
  if (isSupabaseConfigured) {
    try {
      await supabase.from('copilot_audit_logs').insert([logEntry]);
    } catch (e) {
      console.warn('[COPILOT_AUDIT] Supabase 저장 실패 (비차단)', e);
    }
  }
}
