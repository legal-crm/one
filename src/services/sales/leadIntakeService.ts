// 영업 DB 자동 접수 주소 (SL-2) — 사무소 전용 접수 키 관리
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export interface LeadIntakeSource {
  id: string;
  name: string;
  keyHint: string;
  active: boolean;
  hourlyLimit: number;
  receivedCount: number;
  lastReceivedAt?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface IntakeLogRow {
  receivedAt: string;
  result: 'created' | 'duplicate' | 'rejected_key' | 'rejected_limit' | 'rejected_invalid';
  sourceId?: string;
}

export const INTAKE_RESULT_LABEL: Record<IntakeLogRow['result'], string> = {
  created: '새 리드',
  duplicate: '재문의',
  rejected_key: '키 오류',
  rejected_limit: '한도 초과',
  rejected_invalid: '이름·번호 오류',
};

const msg = (e: { message?: string } | null | undefined) => {
  const m = e?.message || '';
  if (/permission denied/i.test(m)) return '접수 주소는 영업 DB 관리 권한이 있어야 다룰 수 있어요.';
  if (/too many sources/i.test(m)) return '접수 주소는 30개까지 만들 수 있어요.';
  if (/name required/i.test(m)) return '접수 경로 이름을 입력해 주세요.';
  if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했어요.';
  return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
};

export function leadIntakeEndpoint(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mykim.kr';
  return `${origin}/api/leads`;
}

export async function listIntakeSources(officeId: string): Promise<RpcResult<LeadIntakeSource[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('sales_lead_sources').select('*').eq('office_id', officeId).order('created_at', { ascending: false });
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, name: r.name, keyHint: r.key_hint, active: !!r.active, hourlyLimit: r.hourly_limit, receivedCount: r.received_count,
      lastReceivedAt: r.last_received_at || undefined, createdAt: r.created_at, revokedAt: r.revoked_at || undefined,
    })),
  };
}

export async function listIntakeLogs(officeId: string, limit = 50): Promise<RpcResult<IntakeLogRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('sales_intake_logs').select('received_at, result, source_id').eq('office_id', officeId).order('received_at', { ascending: false }).limit(limit);
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return { ok: true, data: (data || []).map((r: any) => ({ receivedAt: r.received_at, result: r.result, sourceId: r.source_id || undefined })) };
}

/** 새 접수 키 (평문 키는 이 응답에서만 받을 수 있다) */
export async function createIntakeSource(officeId: string, name: string): Promise<RpcResult<{ id: string; key: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_sales_lead_source', { p_office_id: officeId, p_name: name });
  if (error) return { ok: false, code: 'create_failed', message: msg(error) };
  return { ok: true, data: { id: (data as any).id, key: (data as any).key } };
}

export async function revokeIntakeSource(sourceId: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('revoke_sales_lead_source', { p_source_id: sourceId });
  if (error) return { ok: false, code: 'revoke_failed', message: msg(error) };
  return { ok: true, data: null };
}

/** 랜딩 페이지에 붙일 HTML 폼 예시 */
export function buildFormSnippet(key: string): string {
  return `<form action="${leadIntakeEndpoint()}" method="post">
  <input type="hidden" name="key" value="${key}">
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
  <label>이름 <input name="name" required></label>
  <label>연락처 <input name="phone" type="tel" required></label>
  <label>지역 <input name="region"></label>
  <label>문의 내용 <textarea name="memo"></textarea></label>
  <label><input type="checkbox" required> 개인정보 수집·이용(상담 연락 목적)에 동의합니다</label>
  <button type="submit">상담 신청</button>
</form>`;
}
