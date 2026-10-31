// ============================================================
// 사무소 설정·직인·제안서 검토 요청 서버 서비스 (ST-2·ST-5·RB-6, 20261031002300)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from './rpcResult';

export type OfficeSettingsSection = 'profile' | 'seal' | 'client_messaging' | 'copy_rules' | 'work_defaults' | 'security';

export async function loadOfficeSettings<T extends Record<string, unknown>>(officeId: string, section: OfficeSettingsSection): Promise<RpcResult<{ data: T; version: number } | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_settings').select('data, version').eq('office_id', officeId).eq('section', section).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? { data: (data.data || {}) as T, version: data.version } : null };
}

export async function saveOfficeSettings(officeId: string, section: OfficeSettingsSection, payload: Record<string, unknown>, expectedVersion?: number): Promise<RpcResult<{ version: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_office_settings', { p_office_id: officeId, p_section: section, p_data: payload, p_expected_version: expectedVersion ?? null });
  if (error) return toRpcError(error);
  return { ok: true, data: { version: (data as any)?.version } };
}

// ── 직인·도장·서명 ──────────────────────────────────────────
export type SealKind = 'office_seal' | 'lawyer_seal' | 'lawyer_signature';
export interface OfficeSeal { id: string; kind: SealKind; ownerUserId?: string; label: string; imagePath: string; imageUrl?: string; createdAt: string }

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/png';
  const bin = atob(body || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** 도장 이미지(PNG 투명 권장)를 비공개 저장소에 올리고 등록한다. 같은 종류의 이전 도장은 내린다 */
export async function registerSeal(officeId: string, kind: SealKind, image: Blob | string, label = ''): Promise<RpcResult<OfficeSeal>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const blob = typeof image === 'string' ? dataUrlToBlob(image) : image;
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(blob.type)) return { ok: false, code: 'type', message: 'PNG·WebP·JPG 이미지만 쓸 수 있어요.' };
  if (blob.size > 2 * 1024 * 1024) return { ok: false, code: 'size', message: '도장 이미지는 2MB 이하만 쓸 수 있어요.' };
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${officeId}/seals/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('office-assets').upload(path, blob, { contentType: blob.type, upsert: false });
  if (up.error) return toRpcError(up.error);
  const { data, error } = await supabase.rpc('register_office_seal', { p_office_id: officeId, p_kind: kind, p_image_path: path, p_label: label });
  if (error) return toRpcError(error);
  const r = data as any;
  return { ok: true, data: { id: r.id, kind: r.kind, ownerUserId: r.owner_user_id || undefined, label: r.label, imagePath: r.image_path, createdAt: r.created_at } };
}

/** 사무소 직인 + 내 도장·서명 (사용 중인 것만, 5분 서명 주소 포함) */
export async function loadActiveSeals(officeId: string): Promise<RpcResult<OfficeSeal[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const { data, error } = await supabase.from('office_seals').select('*').eq('office_id', officeId).eq('active', true);
  if (error) return toRpcError(error);
  const rows = (data || []).filter((r: any) => r.kind === 'office_seal' || r.owner_user_id === uid);
  const paths = rows.map((r: any) => r.image_path);
  const signed = paths.length ? await supabase.storage.from('office-assets').createSignedUrls(paths, 300) : { data: [] as any[] };
  const urls: Record<string, string> = {};
  for (const s of (signed.data || []) as any[]) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  return { ok: true, data: rows.map((r: any) => ({ id: r.id, kind: r.kind, ownerUserId: r.owner_user_id || undefined, label: r.label, imagePath: r.image_path, imageUrl: urls[r.image_path], createdAt: r.created_at })) };
}

export async function logSealUsage(officeId: string, sealId: string, documentName: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.rpc('log_seal_usage', { p_office_id: officeId, p_seal_id: sealId, p_document: documentName });
}

// ── 제안서 검토 요청 (RB-6) ─────────────────────────────────
export interface ProposalReview {
  id: string; reqId: string; clientName: string; staffId: string; staffName: string; proposalData: any;
  supervisingLawyerId: string; memo: string; createdAt: string; status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
}
function mapReview(r: any): ProposalReview {
  return {
    id: r.id, reqId: r.consult_request_id, clientName: r.client_alias || '의뢰인', staffId: r.requested_by, staffName: r.requested_by_name || '직원',
    proposalData: r.proposal_data, supervisingLawyerId: r.reviewer_lawyer_id, memo: r.memo || '', createdAt: r.created_at, status: r.status,
  };
}
const REVIEW_MESSAGES: Array<[RegExp, string]> = [
  [/review already pending/i, '이 상담 요청에는 이미 검토를 기다리는 제안서가 있어요.'],
  [/reviewer must be a lawyer/i, '검토할 변호사는 우리 사무소 변호사여야 해요.'],
  [/review already decided/i, '이미 처리된 검토 요청이에요.'],
];
function reviewErr<T>(e: { message?: string; code?: string }): RpcResult<T> {
  const m = e?.message || '';
  for (const [re, t] of REVIEW_MESSAGES) if (re.test(m)) return { ok: false, code: e?.code || 'error', message: t };
  return toRpcError(e);
}

export async function listPendingProposalReviews(officeId: string): Promise<RpcResult<ProposalReview[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('proposal_reviews').select('*').eq('office_id', officeId).eq('status', 'pending').order('created_at', { ascending: true }).limit(200);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapReview) };
}

export async function requestProposalReview(officeId: string, reqId: string, p: { clientAlias: string; proposalData: any; memo: string; reviewerLawyerId: string; requestedByName: string }): Promise<RpcResult<ProposalReview>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('request_proposal_review', {
    p_office_id: officeId, p_consult_request_id: reqId,
    p: { client_alias: p.clientAlias, proposal_data: p.proposalData, memo: p.memo, reviewer_lawyer_id: p.reviewerLawyerId, requested_by_name: p.requestedByName },
  });
  if (error) return reviewErr(error);
  return { ok: true, data: mapReview(data) };
}

export async function decideProposalReview(id: string, decision: 'approved' | 'rejected' | 'withdrawn', note?: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('decide_proposal_review', { p_id: id, p_decision: decision, p_note: note || null });
  if (error) return reviewErr(error);
  return { ok: true, data: true };
}
