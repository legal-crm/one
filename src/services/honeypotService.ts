/**
 * 허니팟(가짜 관리자 로그인) 접근 기록 서비스
 * - ?role=admin 가짜 로그인 화면에 입력된 시도를 서버 audit_logs에 남긴다.
 *   (이전: 공격자 본인 브라우저 localStorage에만 저장돼 관리자는 실제 공격 기록을 볼 수 없었음)
 * - IP·기록 시각은 021 트리거가 서버에서 채운다 (클라이언트 값은 신뢰하지 않음).
 * - 조회는 관리자(is_platform_admin)만 가능하고, 기록은 수정·삭제할 수 없다.
 * - 비밀번호 원문은 보내지 않고 길이만 기록한다.
 */
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export interface HoneypotAttackLog {
  id: string;
  timestamp: string;
  attemptedId: string;
  passwordLength: number;
  userAgent: string;
  referrer: string;
  ipAddress: string;
}

export const HONEYPOT_ACTION = 'honeypot_attempt';

/** 가짜 로그인 입력 기록 (실패해도 화면 동작에는 영향 없음) */
export async function recordHoneypotAttack(attemptedId: string, rawPasswordLength: number): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('audit_logs').insert({
      actor_id: 'honeypot',
      actor_role: 'anonymous',
      action: HONEYPOT_ACTION,
      target_type: 'admin_login_decoy',
      detail: {
        attempted_id: attemptedId.trim().slice(0, 64) || '(빈 값)',
        password_length: Math.max(0, Math.min(Math.floor(rawPasswordLength), 256)),
        referrer: typeof document !== 'undefined' ? (document.referrer || '').slice(0, 200) : '',
      },
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    });
  } catch {
    // 기록 실패는 조용히 무시 (허니팟이 오류로 정체를 드러내지 않도록)
  }
}

/** 관리자용 조회 (최근 200건) */
export async function fetchHoneypotLogs(): Promise<{ logs: HoneypotAttackLog[]; error?: string }> {
  if (!isSupabaseConfigured) return { logs: [], error: 'Supabase가 설정되지 않아 서버 기록을 조회할 수 없습니다.' };
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, detail, user_agent, ip_address')
      .eq('action', HONEYPOT_ACTION)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { logs: [], error: `허니팟 기록을 불러오지 못했습니다: ${error.message}` };
    const logs = (data || []).map((r: any): HoneypotAttackLog => ({
      id: String(r.id),
      timestamp: r.created_at,
      attemptedId: String(r.detail?.attempted_id ?? ''),
      passwordLength: Number(r.detail?.password_length ?? 0),
      referrer: String(r.detail?.referrer ?? ''),
      userAgent: r.user_agent || '',
      ipAddress: r.ip_address || '',
    }));
    return { logs };
  } catch {
    return { logs: [], error: '허니팟 기록을 불러오지 못했습니다.' };
  }
}
