import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { ConsultRequest, ConsultMessage } from '../types';
import { isLegacyEncryptedField, isLegacyEncryptedString, LEGACY_ENCRYPTED_MESSAGE_PLACEHOLDER } from '../utils/cryptoField';

// [PART 4] 브라우저 "암호화"(번들 키) 제거 — 평문 저장 + RLS. 이관 전 레거시 암호문은 덮어쓰지 않도록 추적한다.
const legacyEncryptedProfileIds = new Set<string>();
const legacyEncryptedMessageIds = new Set<string>();
import { validateAndSanitizeConsultRequest } from '../schemas/consultSchema';

// ============================================================
// Consult Supabase Service Layer
// Supabase 미설정 시 localStorage 폴백으로 동작
// ============================================================

const REQUESTS_STORAGE_KEY = 'legal_crm_requests';
const MESSAGES_STORAGE_KEY = 'legal_crm_messages';

// ── 유틸리티 ──

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Supabase 에러 로깅 (화면에도 표시)
function logSupabaseError(operation: string, error: any) {
  const errorDetail = typeof error === 'object' ? (error?.message || error?.code || JSON.stringify(error)) : String(error);
  console.error(`[Consult] ${operation} 실패: ${errorDetail}`, error);
}


// ConsultRequest → DB row 변환
// 레거시 암호문 행은 financial_profile을 보내지 않아 기존 값을 보존한다(화면에는 빈 프로필로 보이므로 덮어쓰면 유실).
async function requestToRow(request: ConsultRequest) {
  const keepLegacyProfile = legacyEncryptedProfileIds.has(request.id);

  const row: Record<string, unknown> = {
    id: request.id,
    client_id: request.clientId || 'client-temp',
    client_name: request.clientName || '익명 의뢰인',
    phone: request.phone || '',
    request_type: request.requestType || 'open',
    max_participants: request.maxParticipants ?? 3,
    status: request.status || 'requested',
    selected_lawyer_id: request.selectedLawyerId || null,
    selected_lawyer_ids: request.selectedLawyerIds || [],
    accepted_lawyer_ids: request.acceptedLawyerIds || [],
    rejection_notified: request.rejectionNotified || false,
    proposals: request.proposals || [],
    title: request.title || '',
    content: request.content || '',
    financial_profile: request.financialProfile || {},
    phone_consultation_requested: request.phoneConsultationRequested ?? false,
    safe_number: request.safeNumber || null,
    safe_number_assigned_at: request.safeNumberAssignedAt || null,
    safe_number_expires_at: request.safeNumberExpiresAt || null,
    entry_category: request.entryCategory || null,
    created_at: request.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (keepLegacyProfile) delete row.financial_profile;
  return row;
}

// ── 역할별 DB 동기화 컨텍스트 (012 엄격 RLS 대응) ──
// - client : 본인 소유 행(client_id = auth.uid())만 upsert
// - lawyer : 기본 테이블 쓰기 불가 → 화이트리스트 RPC(lawyer_patch/create_consult_request)만 호출
// - admin  : JWT app_metadata.role=admin 세션에서 upsert
// - 그 외(honeypot 등): DB 쓰기 안 함
type ConsultSyncRole = 'client' | 'lawyer' | 'admin' | 'none';
let syncRole: ConsultSyncRole = 'none';
let syncActorId: string | null = null;
// 마지막으로 DB와 일치했던 스냅샷 (변경분만 전송 → 오래된 로컬 사본이 타인 변경을 덮어쓰지 않음)
const lastSynced = new Map<string, string>();

export function setConsultSyncContext(role: string, actorId?: string | null): void {
  const next: ConsultSyncRole = role === 'client' || role === 'lawyer' || role === 'admin' ? role : 'none';
  if (next !== syncRole || (actorId || null) !== syncActorId) {
    lastSynced.clear();
  }
  syncRole = next;
  syncActorId = actorId || null;
}

const snapshotOf = (r: ConsultRequest) => JSON.stringify(r);
const markSynced = (rows: ConsultRequest[]) => rows.forEach(r => lastSynced.set(r.id, snapshotOf(r)));
const isMaskedPhone = (phone?: string) => !!phone && phone.includes('*');

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** 변호사 로컬 변경분을 RPC 패치 목록으로 변환 (본인 권한 범위만) */
function buildLawyerPatches(prev: ConsultRequest, next: ConsultRequest, lawyerId: string): Record<string, unknown>[] {
  const patches: Record<string, unknown>[] = [];
  const prevProposals = new Map((prev.proposals || []).map((p: any) => [p.id, JSON.stringify(p)]));
  for (const p of (next.proposals || []) as any[]) {
    if (p?.lawyerId === lawyerId && prevProposals.get(p.id) !== JSON.stringify(p)) {
      patches.push({ proposal: p });
    }
  }
  const scalar: Record<string, unknown> = {};
  if (!(prev.acceptedLawyerIds || []).includes(lawyerId) && (next.acceptedLawyerIds || []).includes(lawyerId)) {
    scalar.accept_self = true;
  }
  if (prev.selectedLawyerId !== lawyerId && next.selectedLawyerId === lawyerId) {
    scalar.select_self = true;
  }
  if (prev.status !== next.status) {
    scalar.status = next.status;
  }
  // 연락처는 마스킹 값이 아닌 실제 수정일 때만 전송 (서버에서 계약/본인 등록 건만 허용)
  if (prev.clientName !== next.clientName && !isMaskedPhone(next.phone)) scalar.client_name = next.clientName;
  if (prev.phone !== next.phone && !isMaskedPhone(next.phone)) scalar.phone = next.phone;
  if (Object.keys(scalar).length > 0) patches.push(scalar);
  return patches;
}

async function syncRequestsToDb(requests: ConsultRequest[]): Promise<void> {
  if (!isSupabaseConfigured || syncRole === 'none' || requests.length === 0) return;

  const changed = requests.filter(r => lastSynced.get(r.id) !== snapshotOf(r));
  if (changed.length === 0) return;

  try {
    if (syncRole === 'client') {
      const uid = await getAuthUserId();
      if (!uid) return; // 비로그인: 로컬에만 보관 (로그인 후 본인 ID로 이관되어 저장)
      const own = changed.filter(r => r.clientId === uid);
      if (own.length === 0) return;
      // 일괄 upsert는 모든 행의 컬럼이 같아야 하므로, financial_profile을 보존할 레거시 행은 따로 보낸다
      const legacyRows = own.filter(r => legacyEncryptedProfileIds.has(r.id));
      const normalRows = own.filter(r => !legacyEncryptedProfileIds.has(r.id));
      let ok = true;
      for (const group of [normalRows, legacyRows]) {
        if (group.length === 0) continue;
        const payload = await Promise.all(group.map(requestToRow));
        const { error } = await supabase.from('consult_requests').upsert(payload, { onConflict: 'id' });
        if (error) { ok = false; logSupabaseError('syncRequestsToDb(client)', error); }
      }
      if (ok) markSynced(own);
      return;
    }

    if (syncRole === 'admin') {
      // [PART 3-3] 관리자는 행 전체 upsert를 하지 않는다.
      // (이전: 바뀐 행 전체를 덮어써 관리자가 불러온 뒤 의뢰인·변호사가 바꾼 제안서·상태가 사라질 수 있었음)
      // 관리자 변경은 컬럼 단위 RPC(adminSetConsultStatus/Hidden/Reopen, 023)로만 서버에 반영한다.
      markSynced(changed);
      return;
    }

    // lawyer (로그인 직후 컨텍스트 반영 전일 수 있어 세션 저장소도 확인)
    const lawyerId = syncActorId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('legal_crm_lawyer_session') : null);
    if (!lawyerId) return;
    for (const next of changed) {
      const prevRaw = lastSynced.get(next.id);
      if (!prevRaw) {
        // DB에 없던 행: 변호사가 직접 등록한 외부 의뢰인만 생성
        const isOwnExternal = next.createdByLawyerId === lawyerId || next.id.startsWith('ext-') || next.clientId === next.id;
        if (isOwnExternal) {
          const row = await requestToRow(next);
          const { error } = await supabase.rpc('lawyer_create_consult_request', { p_row: row });
          if (error) logSupabaseError('lawyer_create_consult_request', error);
          else markSynced([{ ...next, createdByLawyerId: lawyerId }]);
        }
        continue;
      }
      const patches = buildLawyerPatches(JSON.parse(prevRaw) as ConsultRequest, next, lawyerId);
      let ok = true;
      for (const patch of patches) {
        const { error } = await supabase.rpc('lawyer_patch_consult_request', { p_id: next.id, p_patch: patch });
        if (error) { ok = false; logSupabaseError('lawyer_patch_consult_request', error); }
      }
      if (ok) markSynced([next]);
    }
  } catch (e) {
    logSupabaseError('syncRequestsToDb (exception)', e);
  }
}

// DB row → ConsultRequest 변환 (financial_profile 자동 복호화)
async function rowToRequest(row: any): Promise<ConsultRequest> {
  const legacyProfile = isLegacyEncryptedField(row.financial_profile);
  if (legacyProfile) legacyEncryptedProfileIds.add(row.id);
  else legacyEncryptedProfileIds.delete(row.id);
  const decryptedProfile = legacyProfile ? {} : row.financial_profile;

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    phone: row.phone,
    requestType: row.request_type,
    maxParticipants: row.max_participants,
    status: row.status,
    selectedLawyerId: row.selected_lawyer_id,
    selectedLawyerIds: row.selected_lawyer_ids,
    acceptedLawyerIds: row.accepted_lawyer_ids,
    rejectionNotified: row.rejection_notified,
    proposals: row.proposals,
    title: row.title,
    content: row.content,
    financialProfile: decryptedProfile || {},
    phoneConsultationRequested: row.phone_consultation_requested,
    safeNumber: row.safe_number,
    safeNumberAssignedAt: row.safe_number_assigned_at,
    safeNumberExpiresAt: row.safe_number_expires_at,
    entryCategory: row.entry_category,
    createdAt: row.created_at,
    ...(row.created_by_lawyer_id ? { createdByLawyerId: row.created_by_lawyer_id } : {}),
    // 변호사 마스킹 뷰: 계약 체결(또는 본인 등록) 건만 실제 연락처가 내려옴
    ...(row.contact_visible === true ? { contactDisclosureStatus: 'contact_shared' as const } : {}),
    // 023 관리자 숨김 (관리자 조회에만 존재 — 변호사 뷰에는 숨김 행이 내려오지 않음)
    ...(row.admin_hidden === true ? { adminHidden: true, adminHiddenReason: row.admin_hidden_reason || undefined } : {}),
  };
}

// ── 상담 요청 (ConsultRequest) 관리 ──

export interface ConsultRequestFilter {
  clientId?: string;
  lawyerId?: string;
  includeOpen?: boolean;
  isAdmin?: boolean;
}

export async function loadConsultRequests(filter?: string | ConsultRequestFilter): Promise<ConsultRequest[]> {
  const options: ConsultRequestFilter = typeof filter === 'string' 
    ? { clientId: filter } 
    : (filter || {});

  // [ANTI-BOLA 보안 가드]
  // clientId, lawyerId, isAdmin 중 아무런 스코프도 제공되지 않은 경우,
  // 타인 상담 대량 유출(BOLA/IDOR)을 방지하기 위해 쿼리를 즉시 차단합니다.
  if (!options.clientId && !options.lawyerId && !options.isAdmin) {
    console.warn('[SECURITY Anti-BOLA] loadConsultRequests 호출 시 소유자 또는 역할 스코프가 지정되지 않아 쿼리가 차단되었습니다.');
    return [];
  }

  if (isSupabaseConfigured) {
    try {
      // 변호사는 기본 테이블 SELECT 권한이 없음 → 행 범위·마스킹이 강제된 뷰로만 조회 (012)
      const source = options.lawyerId && !options.clientId ? 'consult_requests_for_lawyers' : 'consult_requests';
      let query = supabase.from(source).select('*').order('created_at', { ascending: false });
      
      if (options.clientId) {
        query = query.eq('client_id', options.clientId);
      } else if (options.lawyerId && !options.includeOpen) {
        // 뷰가 이미 본인 관련 + 오픈 대기 요청으로 제한하므로, 오픈 제외 시에만 추가 필터
        query = query.not('status', 'eq', 'requested');
      }
      
      const { data, error } = await query;
      
      if (error) {
        logSupabaseError('loadConsultRequests', error);
      } else if (data) {
        const mapped = await Promise.all(data.map(rowToRequest));
        const result = mapped.filter((req: ConsultRequest) => req.id !== 'req-1' && req.id !== 'req-2' && req.id !== 'req-3');
        markSynced(result);
        return result;
      }
    } catch (e) {
      logSupabaseError('loadConsultRequests (exception)', e);
    }
  }
  
  // LocalStorage Fallback (소유자 기반 스코프 필터링)
  const allRequests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  return allRequests
    .filter(r => {
      if (options.clientId) return r.clientId === options.clientId;
      if (options.lawyerId) {
        const isAssigned = r.selectedLawyerId === options.lawyerId || 
                           (r.acceptedLawyerIds || []).includes(options.lawyerId) ||
                           (r.selectedLawyerIds || []).includes(options.lawyerId);
        const isOpen = options.includeOpen && r.status === 'requested' && r.requestType === 'open';
        return isAssigned || isOpen;
      }
      if (options.isAdmin) return true;
      return false;
    })
    .filter(r => r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3');
}

// ── 관리자 전용 RPC (023, is_platform_admin: role=admin AND aal2) ──
type AdminRpcResult = { ok: true; status: string } | { ok: false; error: string };

async function callAdminConsultRpc(fn: string, args: Record<string, unknown>): Promise<AdminRpcResult> {
  if (!isSupabaseConfigured) return { ok: false, error: '서버가 설정되지 않아 반영할 수 없습니다.' };
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      const msg = /admin only|42501/i.test(error.message) ? '관리자(2단계 인증 완료) 권한이 필요합니다.' : error.message;
      return { ok: false, error: msg };
    }
    return { ok: true, status: String(data ?? '') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '서버 요청에 실패했습니다.' };
  }
}

/** 관리자: 상태 변경 (상태 컬럼만, 서버 감사 기록) */
export function adminSetConsultStatus(id: string, status: ConsultRequest['status']) {
  return callAdminConsultRpc('admin_set_consult_status', { p_id: id, p_status: status });
}

/** 관리자: 스팸 숨김/해제 (원문 보존, 이전 상태 복원) */
export function adminSetConsultHidden(id: string, hidden: boolean, reason?: string) {
  return callAdminConsultRpc('admin_set_consult_hidden', { p_id: id, p_hidden: hidden, p_reason: reason || null });
}

/** 관리자: 장기 미응답 요청을 오픈 매칭으로 재공개 */
export function adminReopenStaleConsult(id: string, reason?: string) {
  return callAdminConsultRpc('admin_reopen_stale_consult', { p_id: id, p_reason: reason || null });
}

export async function saveConsultRequest(request: ConsultRequest): Promise<void> {
  // [SECURITY Zod Validation] 런타임 스키마 검증 및 XSS 태그 정제
  const validation = validateAndSanitizeConsultRequest(request);
  const safeRequest: ConsultRequest = validation.success && validation.data 
    ? ({ ...request, ...validation.data } as unknown as ConsultRequest) 
    : request;

  // Always save to localStorage (클라이언트 메모리/세션은 즉각적인 반응성을 위해 평문 객체 유지)
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  const idx = requests.findIndex(r => r.id === safeRequest.id);
  if (idx >= 0) requests[idx] = safeRequest;
  else requests.push(safeRequest);
  setLocalData(REQUESTS_STORAGE_KEY, requests);

  // DB 전송은 역할별 권한 경로로 (평문 저장, 접근은 012 RLS가 제한)
  await syncRequestsToDb([safeRequest]);
}

export async function saveAllConsultRequests(requests: ConsultRequest[]): Promise<void> {
  // Save to localStorage
  setLocalData(REQUESTS_STORAGE_KEY, requests);
  // 변경된 행만, 현재 역할이 허용된 경로로 전송 (012 엄격 RLS)
  await syncRequestsToDb(requests);
}

export async function deleteConsultRequest(requestId: string): Promise<void> {
  const requests = getLocalData<ConsultRequest[]>(REQUESTS_STORAGE_KEY, []);
  setLocalData(REQUESTS_STORAGE_KEY, requests.filter(r => r.id !== requestId));

  // 로컬 메시지 동시 정화
  const messages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  setLocalData(MESSAGES_STORAGE_KEY, messages.filter(m => m.consultRequestId !== requestId));

  if (isSupabaseConfigured) {
    try {
      // ON DELETE CASCADE가 걸려있으나 명시적 2중 파기 수행
      await supabase.from('consult_messages').delete().eq('consult_request_id', requestId);
      const { error } = await supabase.from('consult_requests').delete().eq('id', requestId);
      if (error) {
        logSupabaseError('deleteConsultRequest', error);
      }
    } catch (e) {
      logSupabaseError('deleteConsultRequest (exception)', e);
    }
  }
}

/**
 * [SECURITY Auto-Destruct / Data Purge]
 * 텔레그램식 '원클릭 상담 기록 자폭' 함수.
 * 특정 상담방의 모든 대화, 진단 상세 정보, 제안서 내역을 DB와 로컬 스토리지에서 영구 파기(Cryptographic Shredding)합니다.
 */
export async function purgeConsultationRecord(requestId: string): Promise<boolean> {
  try {
    await deleteConsultRequest(requestId);
    return true;
  } catch (err) {
    console.error('[SECURITY] 상담 기록 영구 파기 실패:', err);
    return false;
  }
}

/**
 * [SECURITY Complete Client Purge]
 * 의뢰인의 모든 상담 요청, 금융 진단 데이터, 1:1 대화 로그를 전수 소각합니다.
 */
export interface ClientPurgeResult {
  /** 서버 삭제가 모두 성공했는지 (Supabase 미설정 환경은 true) */
  serverOk: boolean;
  deletedRequests: number;
  deletedInquiries: number;
  errors: string[];
}

// 이 기기에 남는 의뢰인 데이터 키 (접두어) — 상담·진단·서류·동행·계약·인증서·캐시·알림
const CLIENT_DATA_KEY_PREFIXES = [
  'legal_crm_', 'LEGAL_CRM_', 'mykim', 'client_', 'scourt_cache_', 'debt_discovery_cache_',
  'electronic_contracts', 'qa_author_id', 'shared_report', 'diagnosis', 'rehab_', 'statement_', 'income_expense', 'property_',
];

function wipeClientDeviceData(): number {
  let removed = 0;
  for (const storage of [localStorage, sessionStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && CLIENT_DATA_KEY_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    keys.forEach(k => { storage.removeItem(k); removed++; });
  }
  return removed;
}

/**
 * [SECURITY Complete Client Purge]
 * 로그인한 의뢰인 본인의 상담 요청·메시지(서버), 1:1 문의(서버), 이 기기의 모든 의뢰인 데이터를 삭제한다.
 * - 기존: 로컬 캐시에 있는 요청만, 잘못된 ID('client-temp')로 찾아 실제 요청이 지워지지 않았고 결과와 무관하게 '서버에서 파기' 안내
 * - 변호사 측 수임 기록(CRM·전자계약서)은 법령상 보관 의무가 있을 수 있어 여기서 삭제하지 않는다 → 화면에서 사실대로 안내
 */
export async function purgeAllClientData(): Promise<ClientPurgeResult> {
  const result: ClientPurgeResult = { serverOk: true, deletedRequests: 0, deletedInquiries: 0, errors: [] };

  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      result.serverOk = false;
      result.errors.push('로그인 세션이 없어 서버 기록을 삭제하지 못했습니다.');
    } else {
      // 1) 상담 요청 + 메시지 (012 RLS: 본인 삭제 허용)
      const { data: rows, error: selErr } = await supabase.from('consult_requests').select('id').eq('client_id', uid);
      if (selErr) {
        result.serverOk = false;
        result.errors.push('상담 기록 조회 실패');
      } else {
        for (const r of rows || []) {
          const { error: mErr } = await supabase.from('consult_messages').delete().eq('consult_request_id', r.id);
          const { error: rErr } = await supabase.from('consult_requests').delete().eq('id', r.id);
          if (mErr || rErr) { result.serverOk = false; result.errors.push(`상담 ${r.id} 삭제 실패`); }
          else result.deletedRequests++;
        }
      }
      // 2) 1:1 문의 (서버 함수가 본인 문의만 삭제)
      try {
        const res = await fetch('/api/inquiry?action=delete-mine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) { result.serverOk = false; result.errors.push('1:1 문의 삭제 실패'); }
        else result.deletedInquiries = json.deleted || 0;
      } catch {
        result.serverOk = false;
        result.errors.push('1:1 문의 삭제 실패');
      }
    }
  }

  // 3) 이 기기의 의뢰인 데이터 전체 (서버 실패와 무관하게 삭제)
  try { wipeClientDeviceData(); } catch (err) { result.errors.push('기기 데이터 일부 삭제 실패'); }

  return result;
}

// ── 상담 메시지 (ConsultMessage) 관리 ──

export async function loadConsultMessages(requestIds?: string[]): Promise<ConsultMessage[]> {
  // [ANTI-BOLA 보안 가드]
  // 특정 상담 ID 목록이 제공되지 않은 경우, 전체 메시지 덤프를 방지하기 위해 빈 배열을 즉시 반환합니다.
  if (!requestIds || requestIds.length === 0) {
    return [];
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('consult_messages')
        .select('*')
        .in('consult_request_id', requestIds);
      
      if (error) {
        logSupabaseError('loadConsultMessages', error);
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          consultRequestId: row.consult_request_id,
          senderType: row.sender_type,
          senderId: row.sender_id,
          senderName: row.sender_name,
          message: readStoredMessage(row.id, row.message),
          createdAt: row.created_at,
        }));
      }
    } catch (e) {
      logSupabaseError('loadConsultMessages (exception)', e);
    }
  }
  
  const allMessages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  const filtered = allMessages.filter(m => requestIds.includes(m.consultRequestId));
  return filtered.map(m => ({ ...m, message: readStoredMessage(m.id, m.message) }));
}

function readStoredMessage(id: string, stored: string): string {
  if (isLegacyEncryptedString(stored)) {
    legacyEncryptedMessageIds.add(id);
    return LEGACY_ENCRYPTED_MESSAGE_PLACEHOLDER;
  }
  return stored;
}

export async function saveConsultMessage(message: ConsultMessage): Promise<void> {
  const messages = getLocalData<ConsultMessage[]>(MESSAGES_STORAGE_KEY, []);
  const idx = messages.findIndex(m => m.id === message.id);
  if (idx >= 0) messages[idx] = message;
  else messages.push(message);
  setLocalData(MESSAGES_STORAGE_KEY, messages);

  if (isSupabaseConfigured) {
    try {
      // 레거시 암호문 메시지는 안내 문구로 덮어쓰지 않는다
      if (legacyEncryptedMessageIds.has(message.id)) return;

      const { error } = await supabase.from('consult_messages').upsert({
        id: message.id,
        consult_request_id: message.consultRequestId,
        sender_type: message.senderType,
        sender_id: message.senderId,
        sender_name: message.senderName,
        message: message.message,
        created_at: message.createdAt,
      }, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveConsultMessage', error);
      }
    } catch (e) {
      logSupabaseError('saveConsultMessage (exception)', e);
    }
  }
}

export async function saveAllConsultMessages(messages: ConsultMessage[]): Promise<void> {
  setLocalData(MESSAGES_STORAGE_KEY, messages);
  
  if (isSupabaseConfigured && messages.length > 0) {
    try {
      const payload = messages.filter(msg => !legacyEncryptedMessageIds.has(msg.id)).map(msg => ({
        id: msg.id,
        consult_request_id: msg.consultRequestId,
        sender_type: msg.senderType,
        sender_id: msg.senderId,
        sender_name: msg.senderName,
        message: msg.message,
        created_at: msg.createdAt,
      }));
      const { error } = await supabase.from('consult_messages').upsert(payload, { onConflict: 'id' });
      if (error) {
        logSupabaseError('saveAllConsultMessages', error);
      }
    } catch (e) {
      logSupabaseError('saveAllConsultMessages (exception)', e);
    }
  }
}

// ── 마이그레이션 ──

export async function migrateAnonymousRequests(newClientId: string, newClientName: string): Promise<ConsultRequest[]> {
  const requests = await loadConsultRequests('client-temp');
  if (requests.length === 0) return [];

  const updatedRequests = requests.map(req => ({
    ...req,
    clientId: newClientId,
    clientName: req.clientName === '익명 의뢰인' ? newClientName : req.clientName,
  }));

  await saveAllConsultRequests(updatedRequests);
  return updatedRequests;
}
