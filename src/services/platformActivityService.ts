// ============================================================
// 플랫폼 활동 로그 (PART 3-2)
// ------------------------------------------------------------
// 이전: App.handleLogActivity가 가짜 IP(121.138.45.x 난수)를 붙여 각 브라우저 localStorage에만
//       저장했고, 관리자 화면은 관리자 본인 브라우저 기록 + 시드 16건(가짜 IP·가짜 대화)을 '실시간
//       통합 활동 피드'로 보여줬다. 쓰이지 않던 activityLogService(activity_logs 테이블)는
//       로그인한 누구나 전체 조회·위조 삽입이 가능한 RLS였다.
// 현재: 서버 audit_logs(021: 서버 IP·시각·실사용자 기록, 수정·삭제 불가, 관리자만 조회)에
//       action='member_activity'로 함께 기록하고, 관리자 화면은 서버 기록을 우선 조회한다.
// 개인정보: 상담 채팅 본문은 플랫폼 로그에 남기지 않는다(변호사·의뢰인 간 대화 비공개 원칙).
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { writeAuditLog, type ActorRole } from './auditService';
import type { ActivityLog, MemberRole } from '../types';

export const MEMBER_ACTIVITY_ACTION = 'member_activity';

const ROLE_TO_ACTOR: Record<MemberRole, ActorRole> = {
  CLIENT: 'client',
  LAWYER: 'lawyer',
  STAFF: 'lawyer',
  ADMIN: 'admin',
};

/** 로그에 남길 설명 (채팅 본문 제거, 길이 제한) */
export function sanitizeActivityDetails(action: ActivityLog['action'], details: string): string {
  if (action === 'CHAT_SEND') return '상담 메시지 작성';
  return String(details || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** 서버 기록 (실패해도 화면 동작에는 영향 없음) */
export function recordMemberActivity(log: ActivityLog): void {
  writeAuditLog({
    actor_id: log.memberId || 'unknown',
    actor_role: ROLE_TO_ACTOR[log.role] || 'anonymous',
    action: 'member_activity',
    target_type: log.action,
    detail: {
      member_name: String(log.memberName || '').slice(0, 60),
      member_role: log.role,
      details: sanitizeActivityDetails(log.action, log.details),
    },
  });
}

export interface PlatformActivityLog extends ActivityLog {
  /** 서버가 확인한 로그인 이메일 (비로그인 기록은 없음) */
  verifiedEmail?: string;
  /** 서버가 판정한 역할 (admin/lawyer/client/unverified/anonymous) */
  verifiedRole?: string;
}

const VALID_ACTIONS = new Set<ActivityLog['action']>([
  'SIGNUP', 'LOGIN', 'CALCULATE', 'CONSULT_REQUEST', 'CHAT_SEND', 'STATUS_CHANGE',
  'ADMIN_ACTION', 'WITHDRAWAL', 'QNA_BROWSE', 'SETTINGS',
]);
const VALID_ROLES = new Set<MemberRole>(['CLIENT', 'LAWYER', 'STAFF', 'ADMIN']);

/** 관리자용: 서버 활동 로그 조회 (audit_logs SELECT는 관리자만 가능) */
export async function fetchPlatformActivity(limit = 500): Promise<{ logs: PlatformActivityLog[]; error?: string }> {
  if (!isSupabaseConfigured) return { logs: [], error: 'Supabase가 설정되지 않았습니다.' };
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_id, actor_role, target_type, detail, ip_address, auth_email, created_at')
      .eq('action', MEMBER_ACTIVITY_ACTION)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { logs: [], error: error.message };
    const logs = (data || []).map((r: any): PlatformActivityLog => {
      const action = VALID_ACTIONS.has(r.target_type) ? r.target_type : 'ADMIN_ACTION';
      const role = VALID_ROLES.has(r.detail?.member_role) ? r.detail.member_role : 'CLIENT';
      return {
        id: `srv-${r.id}`,
        memberId: String(r.actor_id || ''),
        memberName: String(r.detail?.member_name || ''),
        role,
        action,
        details: String(r.detail?.details || ''),
        ipAddress: r.ip_address || '',
        createdAt: r.created_at,
        verifiedEmail: r.auth_email || undefined,
        verifiedRole: r.actor_role || undefined,
      };
    });
    return { logs };
  } catch {
    return { logs: [], error: '활동 로그를 불러오지 못했습니다.' };
  }
}

/** 관리자용: 진단 제출 건수 (auditDiagnosisSubmit 기록 기준) */
export async function fetchDiagnosisSubmitCounts(monthStartIso: string): Promise<{ total: number; thisMonth: number } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const [all, month] = await Promise.all([
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'diagnosis_submit'),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'diagnosis_submit').gte('created_at', monthStartIso),
    ]);
    if (all.error || month.error) return null;
    return { total: all.count ?? 0, thisMonth: month.count ?? 0 };
  } catch {
    return null;
  }
}
