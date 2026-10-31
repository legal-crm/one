// ============================================================
// 의뢰인 안내 발송 방법 · 담당자 카톡 할 일 · 카톡 대화 백업 · PC 카톡 묶음 (KT-2·KT-4·KT-8)
// - 사무소 설정(office_settings.client_messaging)이 안내 종류(알림톡 마일스톤)마다 발송 방법을 정한다
//   alimtok 알림톡 / staff_kakao 담당자 카톡(할 일, 기한 지나면 알림톡 자동 대체) / both 둘 다 / none 안 보냄
// - 담당자 카톡은 자동으로 보내지 않는다. 담당자가 복사해 보내고 '보냈어요'를 누르면 소통 기록이 남는다
// - 실패는 화면에 보일 문장으로 돌려준다. 원본은 서버뿐
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';
import { loadOfficeSettings, saveOfficeSettings } from '../office/officeSettingsService';
import { ALIMTOK_MILESTONE_CONFIG, type AlimtokMilestone } from '../../types';
import { sha256OfFile, type CommTarget } from './commService';
import type { KakaoLine } from './kakaoExportParse';
import { toKakaoPlainText } from './kakaoPcBatchSheet';

export type NoticeMethod = 'alimtok' | 'staff_kakao' | 'both' | 'none';

export interface ClientMessagingSettings {
  methods: Partial<Record<AlimtokMilestone, NoticeMethod>>;
  fallbackEnabled: boolean;
  fallbackHours: number;
  workStart: number;
  workEnd: number;
}

export const NOTICE_METHOD_LABEL: Record<NoticeMethod, string> = {
  alimtok: '알림톡',
  staff_kakao: '담당자 카톡',
  both: '알림톡 + 담당자 카톡',
  none: '보내지 않음',
};

/**
 * 기본값 (KT-Q1): 상담·서류 요청·진행 안내 = 담당자 카톡,
 * 계약 체결·기일(개시결정·채권자집회·면책)·보정 기한·수임료 납부·연체 = 알림톡 + 담당자 카톡 (알림톡이 근거)
 */
export const DEFAULT_NOTICE_METHODS: Record<AlimtokMilestone, NoticeMethod> = {
  consult_booked: 'staff_kakao',
  document_request: 'staff_kakao',
  doc_request_phase1: 'staff_kakao',
  doc_request_phase2: 'staff_kakao',
  doc_phase2_reminder: 'staff_kakao',
  court_filed: 'staff_kakao',
  injunction_granted: 'staff_kakao',
  contract_signed: 'both',
  correction_order: 'both',
  commenced: 'both',
  hearing_notice: 'both',
  discharged: 'both',
  fee_upcoming: 'both',
  fee_due: 'both',
  fee_overdue: 'both',
  fee_receipt: 'both',
};

export const DEFAULT_CLIENT_MESSAGING: ClientMessagingSettings = {
  methods: {}, fallbackEnabled: true, fallbackHours: 3, workStart: 9, workEnd: 18,
};

export function noticeMethodFor(settings: ClientMessagingSettings | null | undefined, milestone: AlimtokMilestone): NoticeMethod {
  return settings?.methods?.[milestone] || DEFAULT_NOTICE_METHODS[milestone] || 'alimtok';
}

function normalizeSettings(raw: Record<string, unknown> | null | undefined): ClientMessagingSettings {
  const r = (raw || {}) as Partial<ClientMessagingSettings>;
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : d;
  };
  const methods: ClientMessagingSettings['methods'] = {};
  for (const [k, v] of Object.entries(r.methods || {})) {
    if (k in ALIMTOK_MILESTONE_CONFIG && (v === 'alimtok' || v === 'staff_kakao' || v === 'both' || v === 'none')) methods[k as AlimtokMilestone] = v;
  }
  const workStart = num(r.workStart, 9, 0, 23);
  const workEnd = num(r.workEnd, 18, 1, 24);
  return {
    methods,
    fallbackEnabled: r.fallbackEnabled !== false,
    fallbackHours: num(r.fallbackHours, 3, 1, 24),
    workStart: workStart < workEnd ? workStart : 9,
    workEnd: workStart < workEnd ? workEnd : 18,
  };
}

// 사무소 설정은 자주 바뀌지 않으므로 잠시 메모리에 둔다
const settingsCache = new Map<string, { at: number; value: ClientMessagingSettings; version: number }>();

export async function loadClientMessaging(officeId: string, force = false): Promise<RpcResult<{ settings: ClientMessagingSettings; version: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const cached = settingsCache.get(officeId);
  if (!force && cached && Date.now() - cached.at < 60_000) return { ok: true, data: { settings: cached.value, version: cached.version } };
  const res = await loadOfficeSettings<Record<string, unknown>>(officeId, 'client_messaging');
  if (res.ok === false) return { ok: false, code: res.code, message: res.message };
  const value = normalizeSettings(res.data?.data);
  const version = res.data?.version ?? 0;
  settingsCache.set(officeId, { at: Date.now(), value, version });
  return { ok: true, data: { settings: value, version } };
}

export async function saveClientMessaging(officeId: string, s: ClientMessagingSettings, expectedVersion?: number): Promise<RpcResult<{ version: number }>> {
  const clean = normalizeSettings(s as unknown as Record<string, unknown>);
  const res = await saveOfficeSettings(officeId, 'client_messaging', clean as unknown as Record<string, unknown>, expectedVersion || undefined);
  if (res.ok) settingsCache.set(officeId, { at: Date.now(), value: clean, version: res.data.version });
  return res;
}

// ── 담당자 카톡 할 일 ──────────────────────────────────────────
export interface NoticeTask {
  id: string; workspaceKey: string; milestone: string; title: string; body: string; fallback: boolean;
  dueAt: string; status: 'pending' | 'sent' | 'fallback_sending' | 'fallback_sent' | 'fallback_failed' | 'cancelled';
  sentVia: 'kakao_copy' | 'kakao_pc_batch' | null; sentAt: string | null; fallbackError: string | null; createdAt: string;
}

const TASK_COLS = 'id, workspace_key, milestone, title, body, fallback, due_at, status, sent_via, sent_at, fallback_error, created_at';
const toTask = (r: any): NoticeTask => ({
  id: r.id, workspaceKey: r.workspace_key, milestone: r.milestone, title: r.title, body: r.body, fallback: !!r.fallback,
  dueAt: r.due_at, status: r.status, sentVia: r.sent_via ?? null, sentAt: r.sent_at ?? null, fallbackError: r.fallback_error ?? null,
  createdAt: r.created_at,
});

export async function listNoticeTasks(officeId: string, workspaceKey: string, includeDone = true): Promise<RpcResult<NoticeTask[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('client_notice_tasks').select(TASK_COLS).eq('office_id', officeId).eq('workspace_key', workspaceKey);
  if (!includeDone) q = q.in('status', ['pending', 'fallback_sending', 'fallback_failed']);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toTask) };
}

export async function createNoticeTask(officeId: string, p: {
  workspaceKey: string; milestone: AlimtokMilestone; title: string; body: string;
  phone?: string; receiverName?: string; alimtokText?: string; fallback?: boolean;
}): Promise<RpcResult<{ id: string; dueAt: string; fallback: boolean; existing: boolean }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_client_notice_task', {
    p_office_id: officeId,
    p: {
      workspace_key: p.workspaceKey, milestone: p.milestone, title: p.title.slice(0, 80), body: p.body.slice(0, 1000),
      phone: p.phone || '', receiver_name: (p.receiverName || '').slice(0, 40), alimtok_text: (p.alimtokText || '').slice(0, 1000),
      fallback: p.fallback !== false,
    },
  });
  if (error) return toRpcError(error);
  return { ok: true, data: { id: data.id, dueAt: data.due_at, fallback: !!data.fallback, existing: !!data.existing } };
}

export async function completeNoticeTask(id: string, body?: string): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('complete_client_notice_task', { p_id: id, p_body: body ?? null });
  return error ? toRpcError(error) : { ok: true, data: true };
}

export async function cancelNoticeTask(id: string, reason: string): Promise<RpcResult<true>> {
  const { error } = await supabase.rpc('cancel_client_notice_task', { p_id: id, p_reason: reason });
  return error ? toRpcError(error) : { ok: true, data: true };
}

/**
 * 안내 한 건을 사무소 설정대로 보낸다.
 * - sendAlimtok: 알림톡 보내기(호출부가 만든 함수). 'staff_kakao'면 부르지 않는다
 * - 담당자 카톡이면 할 일을 만든다(알림톡 문구·번호가 있으면 기한 뒤 자동 대체)
 * 서버 사무소가 없으면(개발) 예전처럼 알림톡만 보낸다
 */
export interface DeliverNoticeInput {
  officeId: string;
  workspaceKey: string;
  milestone: AlimtokMilestone;
  /** 담당자가 카톡으로 보낼 문장 (없으면 알림톡 문구) */
  kakaoText?: string;
  alimtokText: string;
  phone?: string;
  receiverName?: string;
  title?: string;
}
export interface DeliverNoticeResult {
  method: NoticeMethod;
  alimtok?: { ok: boolean; error?: string };
  task?: { ok: boolean; message?: string; dueAt?: string; fallback?: boolean };
}

export async function deliverClientNotice(input: DeliverNoticeInput, sendAlimtok: () => Promise<{ ok: boolean; error?: string }>): Promise<DeliverNoticeResult> {
  if (!input.officeId || !isSupabaseConfigured) {
    const r = await sendAlimtok();
    return { method: 'alimtok', alimtok: { ok: r.ok, error: r.error } };
  }
  const cfg = await loadClientMessaging(input.officeId);
  const method = noticeMethodFor(cfg.ok ? cfg.data.settings : null, input.milestone);
  if (method === 'none') return { method };
  const out: DeliverNoticeResult = { method };
  if (method === 'alimtok' || method === 'both') {
    const r = await sendAlimtok();
    out.alimtok = { ok: r.ok, error: r.error };
  }
  if (method === 'staff_kakao' || method === 'both') {
    const title = input.title || ALIMTOK_MILESTONE_CONFIG[input.milestone]?.label || '진행 안내';
    const t = await createNoticeTask(input.officeId, {
      workspaceKey: input.workspaceKey, milestone: input.milestone, title,
      body: (input.kakaoText || toKakaoPlainText(input.alimtokText)).trim(),
      phone: input.phone, receiverName: input.receiverName,
      // 둘 다 보내는 경우엔 알림톡이 이미 나가서 대체할 필요가 없다
      alimtokText: method === 'staff_kakao' ? input.alimtokText : '',
      fallback: method === 'staff_kakao',
    });
    out.task = t.ok ? { ok: true, dueAt: t.data.dueAt, fallback: t.data.fallback } : { ok: false, message: t.message };
  }
  return out;
}

/** 결과를 한 줄 안내로 (토스트용) */
export function describeDelivery(r: DeliverNoticeResult): { ok: boolean; text: string } {
  const due = r.task?.dueAt ? new Date(r.task.dueAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  if (r.method === 'none') return { ok: true, text: '사무소 설정에서 이 안내는 보내지 않도록 되어 있어요.' };
  const parts: string[] = [];
  let ok = true;
  if (r.alimtok) {
    if (r.alimtok.ok) parts.push('알림톡을 보냈어요');
    else { ok = false; parts.push(`알림톡을 보내지 못했어요(${r.alimtok.error || '실패'})`); }
  }
  if (r.task) {
    if (r.task.ok) parts.push(`담당자 카톡 할 일을 만들었어요${due ? ` (기한 ${due}${r.task.fallback ? ', 지나면 알림톡으로 대체' : ''})` : ''}`);
    else { ok = false; parts.push(`담당자 카톡 할 일을 만들지 못했어요(${r.task.message})`); }
  }
  return { ok, text: parts.join(' · ') };
}

// ── 의뢰인 카톡 이름 ───────────────────────────────────────────
export async function loadCaseKakaoName(officeId: string, workspaceKey: string): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_kakao_names').select('kakao_name').eq('office_id', officeId).eq('workspace_key', workspaceKey).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data?.kakao_name || '' };
}

export async function saveCaseKakaoName(officeId: string, workspaceKey: string, name: string): Promise<RpcResult<{ name: string; sameNameCases: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_case_kakao_name', { p_office_id: officeId, p_key: workspaceKey, p_name: name });
  if (error) return toRpcError(error);
  return { ok: true, data: { name: data?.kakao_name || '', sameNameCases: Number(data?.same_name_cases || 0) } };
}

// ── 카톡 대화 내보내기 백업 (KT-4) ─────────────────────────────
export interface KakaoExportRecord {
  id: string; originalName: string; sizeBytes: number; status: string; format: string | null;
  clientNames: string[]; officeNames: string[]; lineCount: number; insertedCount: number; duplicateCount: number;
  skippedCount: number; unparsedCount: number; firstAt: string | null; lastAt: string | null; createdAt: string;
  clientSha256: string; serverSha256: string | null;
}

const toExport = (r: any): KakaoExportRecord => ({
  id: r.id, originalName: r.original_name || '', sizeBytes: r.size_bytes, status: r.status, format: r.format ?? null,
  clientNames: r.client_names || [], officeNames: r.office_names || [], lineCount: r.line_count, insertedCount: r.inserted_count,
  duplicateCount: r.duplicate_count, skippedCount: r.skipped_count, unparsedCount: r.unparsed_count,
  firstAt: r.first_at ?? null, lastAt: r.last_at ?? null, createdAt: r.created_at, clientSha256: r.client_sha256, serverSha256: r.server_sha256 ?? null,
});

export async function listKakaoExports(officeId: string, target: CommTarget): Promise<RpcResult<KakaoExportRecord[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('kakao_chat_exports')
    .select('id, original_name, size_bytes, status, format, client_names, office_names, line_count, inserted_count, duplicate_count, skipped_count, unparsed_count, first_at, last_at, created_at, client_sha256, server_sha256')
    .eq('office_id', officeId);
  q = target.workspaceKey ? q.eq('workspace_key', target.workspaceKey) : q.eq('sales_lead_id', target.salesLeadId || '');
  const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toExport) };
}

/** 원본 올리기 → 서버 지문 확인 → 줄 넣기(3,000줄씩). 원본 파일이 기준이고 줄은 보기용 */
export async function importKakaoExport(officeId: string, target: CommTarget, file: File, parsed: {
  format: string; lines: KakaoLine[]; unparsed: number; clientNames: string[]; officeNames: string[];
}, onProgress?: (done: number, total: number) => void): Promise<RpcResult<{ inserted: number; duplicates: number; skipped: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (file.size > 10 * 1024 * 1024) return { ok: false, code: 'size', message: '파일이 너무 커요. 10MB 이하만 올릴 수 있어요.' };
  const sha = await sha256OfFile(file);
  const { data: slot, error } = await supabase.rpc('create_kakao_export_upload', {
    p_office_id: officeId,
    p: { workspace_key: target.workspaceKey || '', sales_lead_id: target.salesLeadId || '', original_name: file.name.slice(0, 200), size_bytes: file.size, sha256: sha },
  });
  if (error) return toRpcError(error);
  const up = await supabase.storage.from('comm-exports').upload(slot.path, file, { contentType: 'text/plain', upsert: false });
  if (up.error) return { ok: false, code: 'upload', message: '원본 파일을 올리지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.' };
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  try {
    const res = await fetch('/api/device?route=verify-kakao-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id: slot.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) return { ok: false, code: 'verify', message: '원본 파일의 지문을 확인하지 못했어요. 잠시 뒤 다시 올려 주세요.' };
    if (json.status === 'mismatch') return { ok: false, code: 'mismatch', message: '올린 파일의 지문이 서버 파일과 달라요. 원본 파일을 다시 올려 주세요.' };
  } catch {
    return { ok: false, code: 'verify', message: '원본 파일의 지문을 확인하지 못했어요. 잠시 뒤 다시 올려 주세요.' };
  }
  const CHUNK = 3000;
  let inserted = 0; let duplicates = 0; let skipped = 0;
  const total = parsed.lines.length;
  for (let i = 0; i < Math.max(1, total); i += CHUNK) {
    const part = parsed.lines.slice(i, i + CHUNK);
    const final = i + CHUNK >= total;
    const { data, error: e2 } = await supabase.rpc('import_kakao_export_lines', {
      p_export_id: slot.id,
      p: { format: parsed.format, client_names: parsed.clientNames, office_names: parsed.officeNames, unparsed: parsed.unparsed, lines: part },
      p_final: final,
    });
    if (e2) return toRpcError(e2);
    inserted += Number(data?.inserted || 0); duplicates += Number(data?.duplicates || 0); skipped += Number(data?.skipped || 0);
    onProgress?.(Math.min(total, i + CHUNK), total);
  }
  return { ok: true, data: { inserted, duplicates, skipped } };
}

export async function getKakaoExportDownloadUrl(exportId: string): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: path, error } = await supabase.rpc('log_kakao_export_access', { p_export_id: exportId });
  if (error) return toRpcError(error);
  const { data, error: e2 } = await supabase.storage.from('comm-exports').createSignedUrl(String(path), 300, { download: true });
  if (e2 || !data?.signedUrl) return { ok: false, code: 'url', message: '내려받기 주소를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' };
  return { ok: true, data: data.signedUrl };
}

// ── PC 카톡 묶음 발송 (KT-8) ──────────────────────────────────
export interface PcBatchRow { taskId: string; workspaceKey: string; kakaoName: string; title: string; body: string; dueAt: string }

export async function listPcBatch(officeId: string): Promise<RpcResult<PcBatchRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('kakao_pc_batch_list', { p_office_id: officeId, p_limit: 30 });
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: ((data || []) as any[]).map(r => ({ taskId: r.task_id, workspaceKey: r.workspace_key, kakaoName: r.kakao_name, title: r.title, body: r.body, dueAt: r.due_at })),
  };
}

export async function recordPcBatchResults(officeId: string, taskIds: string[]): Promise<RpcResult<{ sent: number; skipped: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('record_kakao_pc_batch_results', { p_office_id: officeId, p_task_ids: taskIds });
  if (error) return toRpcError(error);
  return { ok: true, data: { sent: Number(data?.sent || 0), skipped: Number(data?.skipped || 0) } };
}
