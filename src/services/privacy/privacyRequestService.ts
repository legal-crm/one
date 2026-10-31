// 개인정보 요청 (OP-11): 이용자 요청 → 관리자 처리(10일 안), 처리 결과는 알림으로
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export type PrivacyKind = 'access' | 'correction' | 'deletion' | 'suspension' | 'withdrawal_consent';
export type PrivacyStatus = 'received' | 'in_progress' | 'done' | 'rejected';

export const PRIVACY_KIND_LABEL: Record<PrivacyKind, string> = {
  access: '내 정보 열람',
  correction: '정보 정정',
  deletion: '정보 삭제',
  suspension: '처리 정지',
  withdrawal_consent: '동의 철회',
};
export const PRIVACY_STATUS_LABEL: Record<PrivacyStatus, string> = { received: '접수', in_progress: '처리 중', done: '처리 완료', rejected: '처리 불가' };

export interface PrivacyRequest {
  id: string; userId: string; kind: PrivacyKind; detail: string | null; status: PrivacyStatus;
  dueOn: string; response: string | null; handledAt: string | null; createdAt: string;
}

const toRow = (r: any): PrivacyRequest => ({
  id: r.id, userId: r.user_id, kind: r.kind, detail: r.detail ?? null, status: r.status, dueOn: r.due_on,
  response: r.response ?? null, handledAt: r.handled_at ?? null, createdAt: r.created_at,
});

/** 본인 요청 목록 (관리자는 전체) */
export async function listPrivacyRequests(status?: PrivacyStatus[]): Promise<RpcResult<PrivacyRequest[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('privacy_requests').select('*').order('created_at', { ascending: false }).limit(200);
  if (status?.length) q = q.in('status', status);
  const { data, error } = await q;
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toRow) };
}

export async function submitPrivacyRequest(kind: PrivacyKind, detail: string): Promise<RpcResult<PrivacyRequest>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('submit_privacy_request', { p_kind: kind, p_detail: detail.trim() || null });
  if (error) {
    if (/too many open privacy/.test(error.message)) return { ok: false, code: 'limit', message: '처리 중인 요청이 5건 있어요. 처리된 뒤 다시 보내 주세요.' };
    return toRpcError(error);
  }
  return { ok: true, data: toRow(data) };
}

export async function handlePrivacyRequest(id: string, status: Exclude<PrivacyStatus, 'received'>, response: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('admin_handle_privacy_request', { p_id: id, p_status: status, p_response: response.trim() });
  return error ? toRpcError(error) : { ok: true, data: null };
}
