// ============================================================
// 소통·증빙 기록 (CL·KT·AP 서버 쪽) — 업무폰 기기, 연락처, 통화·문자 기록, 녹음, 기기 명령, 문구함
// 원본은 서버(Supabase)뿐. 실패는 화면에 보일 문장으로 돌려준다.
// 녹음 재생은 서버에 열람 기록을 먼저 남겨야 저장소가 주소를 내준다(5분).
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export type CommChannel = 'call' | 'sms' | 'mms' | 'kakao' | 'alimtok' | 'visit' | 'other';
export type CommDirection = 'in' | 'out';
export type CommResult = 'answered' | 'missed' | 'rejected' | 'sent' | 'failed' | 'received' | 'unknown';
export type ContactRelation = 'self' | 'spouse' | 'family' | 'work' | 'other';

/** 사건 작업 공간 키(상담 요청 ID 또는 'case-…') 또는 영업 리드 하나 */
export interface CommTarget { workspaceKey?: string; salesLeadId?: string }

export interface OfficeDevice {
  id: string; officeId: string; userId: string; memberId: string | null;
  label: string; lineLabel: string; lineMode: 'personal' | 'shared';
  model: string; osVersion: string; appVersion: string;
  status: 'pending' | 'active' | 'revoked';
  pairedAt: string; approvedAt: string | null; revokedAt: string | null; revokeReason: string | null;
  lastSeenAt: string | null; clockSkewSec: number | null; pendingUploads: number; failedUploads: number;
  permissions: Record<string, unknown>;
}

export interface CommPolicy {
  officeId: string; requireApproval: boolean; uploadNetwork: 'any' | 'wifi'; uploadRecordings: boolean; autoTranscribe: boolean;
  appSmsAllowed: boolean; smsDailyLimit: number; smsQuietStart: number; smsQuietEnd: number; staffNotice: string; version: number;
  /** PC 카톡 묶음 발송 (KT-8, 사무소 선택). 처음 켤 때 [운영자 판단] 안내 확인 필요 */
  kakaoPcBatchEnabled: boolean; kakaoPcBatchAckAt: string | null; kakaoPcBatchDailyLimit: number;
}

export interface ClientContact {
  id: string; workspaceKey: string | null; salesLeadId: string | null; phone: string;
  relation: ContactRelation; label: string; validUntil: string | null; createdAt: string;
}

export interface CommLog {
  id: string; officeId: string; deviceId: string | null; userId: string | null;
  workspaceKey: string | null; salesLeadId: string | null; contactId: string | null;
  linkStatus: 'linked' | 'needs_review'; candidates: Array<{ workspace_key: string | null; sales_lead_id: string | null }>;
  source: 'app' | 'manual' | 'kakao_manual' | 'alimtok' | 'popbill' | 'kakao_export' | 'kakao_pc_batch';
  /** 카톡 대화 내보내기에서 온 줄의 보낸 사람 표시 이름 */
  senderName: string | null;
  exportId: string | null;
  channel: CommChannel; direction: CommDirection; result: CommResult;
  durationSec: number | null; lineLabel: string; body: string | null;
  occurredAt: string; receivedAt: string; contentHash: string;
  note: string | null; nextContactAt: string | null;
  linkHistory: Array<Record<string, unknown>>;
}

export interface CallRecording {
  id: string; commLogId: string | null; workspaceKey: string | null; salesLeadId: string | null;
  originalName: string; mimeType: string; sizeBytes: number | null; durationSec: number | null; recordedAt: string | null;
  deviceId: string | null; uploadedBy: string | null; deviceSha256: string | null; serverSha256: string | null;
  verifiedAt: string | null; status: 'uploading' | 'verified' | 'mismatch' | 'failed'; createdAt: string;
}

export interface RegisterRequest {
  id: string; deviceId: string | null; userId: string | null; phone: string; occurredAt: string | null; note: string | null;
  status: 'open' | 'linked' | 'ignored'; createdAt: string;
}

export interface CommTemplate {
  id: string; title: string; body: string; purpose: 'general' | 'documents' | 'schedule' | 'payment' | 'correction';
  archived: boolean; createdBy: string | null; updatedAt: string;
}

export const RELATION_LABEL: Record<ContactRelation, string> = { self: '본인', spouse: '배우자', family: '가족', work: '직장', other: '기타' };
export const CHANNEL_LABEL: Record<CommChannel, string> = { call: '통화', sms: '문자', mms: '문자(MMS)', kakao: '카카오톡', alimtok: '알림톡', visit: '방문', other: '기타' };
export const RESULT_LABEL: Record<CommResult, string> = {
  answered: '연결됨', missed: '부재', rejected: '거절', sent: '보냄', failed: '보내지 못함', received: '받음', unknown: '',
};
export const TEMPLATE_PURPOSE_LABEL: Record<CommTemplate['purpose'], string> = {
  general: '일반', documents: '서류', schedule: '일정·기일', payment: '납부', correction: '보정',
};

const nz = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

const toDevice = (r: any): OfficeDevice => ({
  id: r.id, officeId: r.office_id, userId: r.user_id, memberId: r.member_id ?? null,
  label: r.label || '', lineLabel: r.line_label || '', lineMode: r.line_mode === 'shared' ? 'shared' : 'personal',
  model: r.model || '', osVersion: r.os_version || '', appVersion: r.app_version || '',
  status: r.status, pairedAt: r.paired_at, approvedAt: r.approved_at ?? null, revokedAt: r.revoked_at ?? null,
  revokeReason: r.revoke_reason ?? null, lastSeenAt: r.last_seen_at ?? null, clockSkewSec: r.clock_skew_sec ?? null,
  pendingUploads: r.pending_uploads ?? 0, failedUploads: r.failed_uploads ?? 0, permissions: r.permissions || {},
});

const toPolicy = (r: any): CommPolicy => ({
  officeId: r.office_id, requireApproval: !!r.require_approval, uploadNetwork: r.upload_network === 'wifi' ? 'wifi' : 'any',
  uploadRecordings: !!r.upload_recordings, autoTranscribe: !!r.auto_transcribe, appSmsAllowed: !!r.app_sms_allowed,
  smsDailyLimit: r.sms_daily_limit ?? 50, smsQuietStart: r.sms_quiet_start ?? 21, smsQuietEnd: r.sms_quiet_end ?? 8,
  staffNotice: r.staff_notice || '', version: r.version ?? 1,
  kakaoPcBatchEnabled: !!r.kakao_pc_batch_enabled, kakaoPcBatchAckAt: r.kakao_pc_batch_ack_at ?? null,
  kakaoPcBatchDailyLimit: r.kakao_pc_batch_daily_limit ?? 100,
});

const toContact = (r: any): ClientContact => ({
  id: r.id, workspaceKey: r.workspace_key ?? null, salesLeadId: r.sales_lead_id ?? null, phone: r.phone,
  relation: r.relation, label: r.label || '', validUntil: r.valid_until ?? null, createdAt: r.created_at,
});

const toLog = (r: any): CommLog => ({
  id: r.id, officeId: r.office_id, deviceId: r.device_id ?? null, userId: r.user_id ?? null,
  workspaceKey: r.workspace_key ?? null, salesLeadId: r.sales_lead_id ?? null, contactId: r.contact_id ?? null,
  linkStatus: r.link_status, candidates: Array.isArray(r.candidates) ? r.candidates : [],
  source: r.source, senderName: r.sender_name ?? null, exportId: r.export_id ?? null,
  channel: r.channel, direction: r.direction, result: r.result,
  durationSec: r.duration_sec ?? null, lineLabel: r.line_label || '', body: r.body ?? null,
  occurredAt: r.occurred_at, receivedAt: r.received_at, contentHash: r.content_hash,
  note: r.note ?? null, nextContactAt: r.next_contact_at ?? null,
  linkHistory: Array.isArray(r.link_history) ? r.link_history : [],
});

const toRecording = (r: any): CallRecording => ({
  id: r.id, commLogId: r.comm_log_id ?? null, workspaceKey: r.workspace_key ?? null, salesLeadId: r.sales_lead_id ?? null,
  originalName: r.original_name || '', mimeType: r.mime_type, sizeBytes: r.size_bytes ?? null, durationSec: r.duration_sec ?? null,
  recordedAt: r.recorded_at ?? null, deviceId: r.device_id ?? null, uploadedBy: r.uploaded_by ?? null,
  deviceSha256: r.device_sha256 ?? null, serverSha256: r.server_sha256 ?? null, verifiedAt: r.verified_at ?? null,
  status: r.status, createdAt: r.created_at,
});

const toTemplate = (r: any): CommTemplate => ({
  id: r.id, title: r.title, body: r.body, purpose: r.purpose, archived: !!r.archived, createdBy: r.created_by ?? null, updatedAt: r.updated_at,
});

const targetArgs = (t: CommTarget) => ({ workspace_key: nz(t.workspaceKey), sales_lead_id: nz(t.salesLeadId) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTarget(q: any, t: CommTarget): any {
  return t.workspaceKey ? q.eq('workspace_key', t.workspaceKey) : q.eq('sales_lead_id', t.salesLeadId || '');
}

// ── 기기 ────────────────────────────────────────────────────────────
export async function listOfficeDevices(officeId: string): Promise<RpcResult<OfficeDevice[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_devices')
    .select('id, office_id, user_id, member_id, label, line_label, line_mode, model, os_version, app_version, status, paired_at, approved_at, revoked_at, revoke_reason, last_seen_at, clock_skew_sec, pending_uploads, failed_uploads, permissions')
    .eq('office_id', officeId).order('paired_at', { ascending: false }).limit(200);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toDevice) };
}

export interface PairingCode { code: string; expiresAt: string; preApproved: boolean; qr: string }

export async function createPairingCode(officeId: string, label: string): Promise<RpcResult<PairingCode>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_device_pairing_code', { p_office_id: officeId, p_label: label });
  if (error) return toRpcError(error);
  return { ok: true, data: { code: data.code, expiresAt: data.expires_at, preApproved: !!data.pre_approved, qr: data.qr } };
}

export async function approveDevice(id: string): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('approve_office_device', { p_device_id: id });
  return error ? toRpcError(error) : { ok: true, data: true };
}

export async function revokeDevice(id: string, reason: string): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('revoke_office_device', { p_device_id: id, p_reason: reason || null });
  return error ? toRpcError(error) : { ok: true, data: true };
}

export async function updateDevice(id: string, patch: { label?: string; lineLabel?: string; lineMode?: 'personal' | 'shared' }): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('update_office_device', {
    p_device_id: id, p: { label: patch.label, line_label: patch.lineLabel, line_mode: patch.lineMode },
  });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 정책 ────────────────────────────────────────────────────────────
export async function loadCommPolicy(officeId: string): Promise<RpcResult<CommPolicy>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('get_office_comm_policy', { p_office_id: officeId });
  if (error) return toRpcError(error);
  return { ok: true, data: toPolicy(data) };
}

export async function saveCommPolicy(officeId: string, p: Partial<CommPolicy>, expectedVersion?: number, ack?: { kakaoPcBatch?: boolean }): Promise<RpcResult<CommPolicy>> {
  const { data, error } = await supabase.rpc('set_office_comm_policy', {
    p_office_id: officeId,
    p: {
      require_approval: p.requireApproval, upload_network: p.uploadNetwork, upload_recordings: p.uploadRecordings,
      auto_transcribe: p.autoTranscribe, app_sms_allowed: p.appSmsAllowed, sms_daily_limit: p.smsDailyLimit,
      sms_quiet_start: p.smsQuietStart, sms_quiet_end: p.smsQuietEnd, staff_notice: p.staffNotice,
      kakao_pc_batch_enabled: p.kakaoPcBatchEnabled, kakao_pc_batch_daily_limit: p.kakaoPcBatchDailyLimit,
      // 처음 켤 때 [운영자 판단] 안내를 확인했다는 표시 (서버가 확인 시각을 남긴다)
      kakao_pc_batch_ack: ack?.kakaoPcBatch ? true : undefined,
    },
    p_expected_version: expectedVersion ?? null,
  });
  if (error) return toRpcError(error);
  return { ok: true, data: toPolicy(data) };
}

// ── 연락처 ──────────────────────────────────────────────────────────
export async function listContacts(officeId: string, target: CommTarget): Promise<RpcResult<ClientContact[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const q = supabase.from('client_contacts')
    .select('id, workspace_key, sales_lead_id, phone, relation, label, valid_until, created_at')
    .eq('office_id', officeId).is('removed_at', null);
  const { data, error } = await applyTarget(q, target).order('created_at');
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toContact) };
}

export async function saveContact(officeId: string, target: CommTarget, c: { id?: string; phone: string; relation: ContactRelation; label?: string; validUntil?: string | null })
  : Promise<RpcResult<ClientContact & { sharedCount: number }>> {
  const { data, error } = await supabase.rpc('save_client_contact', {
    p_office_id: officeId,
    p: { ...targetArgs(target), ...(c.id ? { id: c.id } : {}), phone: c.phone, relation: c.relation, label: c.label || '', valid_until: c.validUntil || '' },
  });
  if (error) return toRpcError(error);
  return { ok: true, data: { ...toContact({ ...data, created_at: new Date().toISOString() }), sharedCount: Number(data.shared_count) || 0 } };
}

export async function removeContact(id: string): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('remove_client_contact', { p_id: id });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 소통 기록 ───────────────────────────────────────────────────────
/** opts.kakaoExport: 'exclude' = 카톡 대화 백업 줄 빼고, 'only' = 그 줄만 (백업 줄이 많아 다른 기록을 밀어내지 않게 따로 읽는다) */
export async function listCommLogs(officeId: string, target: CommTarget, limit = 200, opts: { kakaoExport?: 'exclude' | 'only' } = {}): Promise<RpcResult<CommLog[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('client_comm_logs').select('*').eq('office_id', officeId);
  if (opts.kakaoExport === 'exclude') q = q.neq('source', 'kakao_export');
  if (opts.kakaoExport === 'only') q = q.eq('source', 'kakao_export');
  const { data, error } = await applyTarget(q, target).order('occurred_at', { ascending: false }).limit(limit);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toLog) };
}

/** 번호가 여러 사건에 걸려 '확인 필요'로 들어온 기록 */
export async function listReviewCommLogs(officeId: string): Promise<RpcResult<CommLog[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('client_comm_logs').select('*')
    .eq('office_id', officeId).eq('link_status', 'needs_review').order('occurred_at', { ascending: false }).limit(200);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toLog) };
}

export interface ManualLogInput {
  channel: 'call' | 'sms' | 'kakao' | 'visit' | 'other';
  direction: CommDirection;
  result?: CommResult;
  occurredAt?: string;
  durationSec?: number | null;
  body?: string;
  note?: string;
  contactId?: string | null;
  nextContactAt?: string | null;
}

export async function recordManualLog(officeId: string, target: CommTarget, input: ManualLogInput): Promise<RpcResult<CommLog>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('record_manual_comm_log', {
    p_office_id: officeId,
    p: {
      ...targetArgs(target), channel: input.channel, direction: input.direction, result: input.result || '',
      occurred_at: input.occurredAt || '', duration_sec: input.durationSec ?? '', body: input.body || '', note: input.note || '',
      contact_id: input.contactId || '', next_contact_at: input.nextContactAt || '',
    },
  });
  if (error) return toRpcError(error);
  return { ok: true, data: toLog(data) };
}

export async function relinkCommLog(id: string, target: CommTarget, reason: string): Promise<RpcResult<CommLog>> {
  const { data, error } = await supabase.rpc('relink_comm_log', { p_id: id, p: { ...targetArgs(target), reason } });
  if (error) return toRpcError(error);
  return { ok: true, data: toLog(data) };
}

export async function setCommLogNote(id: string, note: string, nextContactAt: string | null): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('set_comm_log_note', { p_id: id, p_note: note, p_next_contact_at: nextContactAt });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 녹음 ────────────────────────────────────────────────────────────
export async function listRecordings(officeId: string, target: CommTarget): Promise<RpcResult<CallRecording[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const q = supabase.from('call_recordings')
    .select('id, comm_log_id, workspace_key, sales_lead_id, original_name, mime_type, size_bytes, duration_sec, recorded_at, device_id, uploaded_by, device_sha256, server_sha256, verified_at, status, created_at')
    .eq('office_id', officeId);
  const { data, error } = await applyTarget(q, target).order('created_at', { ascending: false }).limit(200);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toRecording) };
}

export async function sha256OfFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const AUDIO_TYPES: Record<string, string> = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', amr: 'audio/amr', '3gp': 'audio/3gpp',
  ogg: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm',
};

export function audioMimeOf(file: File): string | null {
  const t = (file.type || '').toLowerCase();
  if (t && Object.values(AUDIO_TYPES).includes(t)) return t;
  if (t === 'audio/x-m4a' || t === 'audio/m4a') return 'audio/mp4';
  if (t === 'audio/x-wav') return 'audio/wav';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return AUDIO_TYPES[ext] || null;
}

/** 웹에서 녹음 올리기: 지문 계산 → 자리 만들기 → 저장소 올리기 → 서버 지문 확인 */
export async function uploadRecording(officeId: string, target: CommTarget, file: File, opts: { commLogId?: string | null; durationSec?: number | null; recordedAt?: string | null } = {})
  : Promise<RpcResult<{ id: string; status: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const mime = audioMimeOf(file);
  if (!mime) return { ok: false, code: 'type', message: '녹음 파일 형식을 지원하지 않아요. m4a·mp3·amr·wav 파일을 올려 주세요.' };
  if (file.size > 50 * 1024 * 1024) return { ok: false, code: 'size', message: '파일이 너무 커요. 50MB 이하만 올릴 수 있어요.' };
  const sha = await sha256OfFile(file);
  const { data: slot, error } = await supabase.rpc('create_call_recording_upload', {
    p_office_id: officeId,
    p: {
      ...targetArgs(target), comm_log_id: opts.commLogId || '', mime_type: mime, size_bytes: file.size, sha256: sha,
      original_name: file.name.slice(0, 200), duration_sec: opts.durationSec ?? '', recorded_at: opts.recordedAt || '',
    },
  });
  if (error) return toRpcError(error);
  const up = await supabase.storage.from('call-recordings').upload(slot.path, file, { contentType: mime, upsert: false });
  if (up.error) return { ok: false, code: 'upload', message: '파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.' };
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  try {
    const res = await fetch('/api/device?route=verify-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id: slot.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) return { ok: false, code: 'verify', message: '올린 파일의 지문을 확인하지 못했어요. 잠시 뒤 녹음 목록에서 다시 확인해 주세요.' };
    return { ok: true, data: { id: slot.id, status: json.status } };
  } catch {
    return { ok: false, code: 'verify', message: '올린 파일의 지문을 확인하지 못했어요. 잠시 뒤 녹음 목록에서 다시 확인해 주세요.' };
  }
}

/** 재생 주소 (열람 기록을 먼저 남김, 5분) */
export async function getRecordingPlayUrl(recordingId: string, action: 'play' | 'download' = 'play'): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: path, error } = await supabase.rpc('log_evidence_access', { p_recording_id: recordingId, p_action: action });
  if (error) return toRpcError(error);
  const { data, error: e2 } = await supabase.storage.from('call-recordings').createSignedUrl(String(path), 300, action === 'download' ? { download: true } : undefined);
  if (e2 || !data?.signedUrl) return { ok: false, code: 'url', message: '재생 주소를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' };
  return { ok: true, data: data.signedUrl };
}

// ── 업무폰 명령 ─────────────────────────────────────────────────────
export async function sendDeviceCommand(deviceId: string, kind: 'dial' | 'sms', contactId: string, body?: string): Promise<RpcResult<{ id: string; expiresAt: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_device_command', { p_device_id: deviceId, p_kind: kind, p_contact_id: contactId, p_body: body ?? null });
  if (error) return toRpcError(error);
  return { ok: true, data: { id: data.id, expiresAt: data.expires_at } };
}

export async function getDeviceCommandStatus(id: string): Promise<string | null> {
  const { data } = await supabase.from('device_commands').select('status').eq('id', id).maybeSingle();
  return data?.status ?? null;
}

// ── 등록 요청함 ─────────────────────────────────────────────────────
export async function listRegisterRequests(officeId: string): Promise<RpcResult<RegisterRequest[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('device_register_requests').select('*')
    .eq('office_id', officeId).eq('status', 'open').order('created_at', { ascending: false }).limit(200);
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, deviceId: r.device_id ?? null, userId: r.user_id ?? null, phone: r.phone, occurredAt: r.occurred_at ?? null,
      note: r.note ?? null, status: r.status, createdAt: r.created_at,
    })),
  };
}

export async function resolveRegisterRequest(id: string, action: 'link' | 'ignore', target?: CommTarget, relation: ContactRelation = 'self', label = ''): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('resolve_device_register_request', {
    p_id: id, p: { action, ...(target ? targetArgs(target) : {}), relation, label },
  });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 문구함 ──────────────────────────────────────────────────────────
export async function listCommTemplates(officeId: string): Promise<RpcResult<CommTemplate[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('comm_templates').select('*').eq('office_id', officeId).eq('archived', false).order('updated_at', { ascending: false });
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toTemplate) };
}

export async function saveCommTemplate(officeId: string, t: { id?: string; title: string; body: string; purpose: CommTemplate['purpose'] }): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row = { title: t.title.trim().slice(0, 40), body: t.body.trim().slice(0, 1000), purpose: t.purpose };
  const { data: auth } = await supabase.auth.getUser();
  const { error } = t.id
    ? await supabase.from('comm_templates').update(row).eq('id', t.id)
    : await supabase.from('comm_templates').insert({ ...row, office_id: officeId, created_by: auth.user?.id });
  return error ? toRpcError(error) : { ok: true, data: true };
}

export async function archiveCommTemplate(id: string): Promise<RpcResult<true>> {
  const { error } = await supabase.from('comm_templates').update({ archived: true }).eq('id', id);
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 표시 도우미 ─────────────────────────────────────────────────────
export function formatPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return d.startsWith('02') ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return d;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

/** 기록 줄 한 줄 요약 (개인정보 없음) */
export function describeLog(l: Pick<CommLog, 'channel' | 'direction' | 'result' | 'durationSec' | 'source'>): string {
  const dir = l.channel === 'visit' ? '' : (l.direction === 'in' ? '받음' : '보냄');
  const head = l.channel === 'call' ? (l.direction === 'in' ? '걸려 온 전화' : '건 전화') : `${CHANNEL_LABEL[l.channel]} ${dir}`.trim();
  const res = l.channel === 'call' ? RESULT_LABEL[l.result] : (l.result === 'failed' ? RESULT_LABEL.failed : '');
  const dur = l.channel === 'call' && l.durationSec ? formatDuration(l.durationSec) : '';
  const src = l.source === 'kakao_manual' ? '담당자 카톡(직접 보냄)'
    : l.source === 'kakao_pc_batch' ? '담당자 카톡(PC 묶음)'
    : l.source === 'kakao_export' ? '카톡 대화 백업'
    : l.source === 'manual' ? '직접 기록'
    : l.source === 'alimtok' ? '발송 결과 기록' : '';
  return [head, res, dur, src].filter(Boolean).join(' · ');
}
