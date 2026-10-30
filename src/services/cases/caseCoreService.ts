// ============================================================
// 사건 뼈대 서비스 (CM-1·CM-2·CM-3·CM-8·CM-9·CM-10·CM-11)
// 원본은 서버(office_clients·cases·case_events·case_form_drafts·case_plan_payments).
// 쓰기는 모두 서버 함수 — 단계·잠금·기록·버전 확인은 서버가 한다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export type CaseType = 'rehab' | 'bankruptcy';
export type CaseSource = 'consult_request' | 'sales_lead' | 'direct' | 'import' | 'conversion';
export type CloseReason = 'consult_ended' | 'contract_terminated' | 'withdrawn' | 'dismissed_or_abolished' | 'discharged' | 'converted_to_bankruptcy';

export type CaseMilestone =
  | 'proposal_sent' | 'contract_sent' | 'contract_signed' | 'drafting_started' | 'case_number_registered'
  | 'correction_registered' | 'commencement_decided' | 'bankruptcy_declared' | 'trustee_assigned'
  | 'creditors_meeting_set' | 'plan_confirmed' | 'discharge_hearing_set' | 'discharge_filed' | 'discharge_decided'
  | 'closed' | 'reopened' | 'manual_stage';

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  consult_ended: '상담 종료(수임 안 함)',
  contract_terminated: '계약 해지·사임',
  withdrawn: '신청 취하',
  dismissed_or_abolished: '기각·폐지',
  discharged: '면책·파산종결',
  converted_to_bankruptcy: '회생 → 파산 전환',
};

export interface StageDefinition {
  caseType: CaseType;
  code: string;
  sortOrder: number;
  groupNo: number;
  officeLabel: string;
  clientLabel: string;
}

export interface OfficeClient {
  id: string;
  officeId: string;
  displayName: string;
  realName: string | null;
  phone: string | null;
  email: string | null;
  clientUserId: string | null;
  source: CaseSource;
  memo: string;
  isTest: boolean;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  officeId: string;
  officeClientId: string;
  caseType: CaseType;
  stage: string;
  previousStage: string | null;
  lawyerMemberId: string | null;
  staffMemberId: string | null;
  source: CaseSource;
  consultRequestId: string | null;
  salesLeadId: string | null;
  title: string;
  courtName: string | null;
  caseNumber: string | null;
  plannedFilingOn: string | null;
  filedOn: string | null;
  commencedOn: string | null;
  creditorsMeetingOn: string | null;
  confirmedOn: string | null;
  dischargeDecidedOn: string | null;
  closeReason: CloseReason | null;
  closedOn: string | null;
  purgeAfter: string | null;
  isTest: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
  clientVisible: boolean;
  actorMemberId: string | null;
  createdAt: string;
}

export interface PlanPayment {
  id: string;
  caseId: string;
  roundNo: number;
  kind: 'pre_confirmation' | 'plan';
  dueOn: string;
  amount: number;
  status: 'unpaid' | 'client_reported' | 'confirmed' | 'waived';
  paidOn: string | null;
  clientReportedAt: string | null;
  confirmedAt: string | null;
  note: string;
}

export interface MyCaseSummary {
  caseId: string;
  officeName: string;
  caseType: CaseType;
  stage: string;
  clientStageLabel: string;
  groupNo: number;
  courtName: string | null;
  caseNumber: string | null;
  filedOn: string | null;
  commencedOn: string | null;
  creditorsMeetingOn: string | null;
  confirmedOn: string | null;
  dischargeDecidedOn: string | null;
  closedOn: string | null;
  closeReason: CloseReason | null;
  updatedAt: string;
  /** 사건 작업 공간 키 (상담 요청 ID 또는 'case-' + 사건 ID) */
  workspaceKey: string;
  /** 마이김변 상담 요청에서 시작한 사건인지 (아니면 '내 사건'에서 따로 서류를 받는다) */
  hasConsultRequest: boolean;
}

export const mapCase = (r: any): CaseRecord => ({
  id: r.id, officeId: r.office_id, officeClientId: r.office_client_id, caseType: r.case_type, stage: r.stage,
  previousStage: r.previous_stage ?? null, lawyerMemberId: r.lawyer_member_id ?? null, staffMemberId: r.staff_member_id ?? null,
  source: r.source, consultRequestId: r.consult_request_id ?? null, salesLeadId: r.sales_lead_id ?? null, title: r.title || '',
  courtName: r.court_name ?? null, caseNumber: r.case_number ?? null, plannedFilingOn: r.planned_filing_on ?? null,
  filedOn: r.filed_on ?? null, commencedOn: r.commenced_on ?? null, creditorsMeetingOn: r.creditors_meeting_on ?? null,
  confirmedOn: r.confirmed_on ?? null, dischargeDecidedOn: r.discharge_decided_on ?? null, closeReason: r.close_reason ?? null,
  closedOn: r.closed_on ?? null, purgeAfter: r.purge_after ?? null, isTest: r.is_test === true, version: r.version,
  createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at ?? null,
});

const mapClient = (r: any): OfficeClient => ({
  id: r.id, officeId: r.office_id, displayName: r.display_name || '', realName: r.real_name ?? null, phone: r.phone ?? null,
  email: r.email ?? null, clientUserId: r.client_user_id ?? null, source: r.source, memo: r.memo || '', isTest: r.is_test === true,
  createdAt: r.created_at,
});

const mapPayment = (r: any): PlanPayment => ({
  id: r.id, caseId: r.case_id, roundNo: r.round_no, kind: r.kind, dueOn: r.due_on, amount: Number(r.amount), status: r.status,
  paidOn: r.paid_on ?? null, clientReportedAt: r.client_reported_at ?? null, confirmedAt: r.confirmed_at ?? null, note: r.note || '',
});

let stageCache: StageDefinition[] | null = null;

export async function loadStageDefinitions(): Promise<RpcResult<StageDefinition[]>> {
  if (stageCache) return { ok: true, data: stageCache };
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_stage_definitions').select('*').order('case_type').order('sort_order');
  if (error) return toRpcError(error);
  stageCache = (data || []).map((r: any) => ({
    caseType: r.case_type, code: r.code, sortOrder: r.sort_order, groupNo: r.group_no, officeLabel: r.office_label, clientLabel: r.client_label,
  }));
  return { ok: true, data: stageCache };
}

export function stageDef(defs: StageDefinition[], caseType: CaseType, code: string): StageDefinition | undefined {
  return defs.find(d => d.caseType === caseType && d.code === code);
}

export interface CaseListFilter {
  officeId: string;
  view?: 'active' | 'closed' | 'trash' | 'all';
  includeTest?: boolean;
  limit?: number;
}

export async function listCases(f: CaseListFilter): Promise<RpcResult<CaseRecord[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('cases').select('*').eq('office_id', f.officeId).order('updated_at', { ascending: false }).limit(f.limit ?? 500);
  const view = f.view ?? 'active';
  if (view === 'trash') q = q.not('deleted_at', 'is', null);
  else {
    q = q.is('deleted_at', null);
    if (view === 'active') q = q.neq('stage', 'closed');
    if (view === 'closed') q = q.eq('stage', 'closed');
  }
  if (!f.includeTest) q = q.eq('is_test', false);
  const { data, error } = await q;
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapCase) };
}

// ── 사건 작업 공간 키 ─────────────────────────────────────────────────────
// 사건 관리 화면·crm_clients·case_files는 문자열 키 하나로 사건을 가리킨다.
// 상담 요청 사건 = 상담 요청 ID, 그 밖의 사건(직접 등록·영업 리드 이관) = 'case-' + 사건 ID (서버 crm_client_case_id와 같은 규칙)
const CASE_KEY_RE = /^case-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const workspaceKeyForCase = (c: Pick<CaseRecord, 'id' | 'consultRequestId'>): string => c.consultRequestId || `case-${c.id}`;
export const caseIdFromWorkspaceKey = (key: string): string | null => CASE_KEY_RE.exec(key)?.[1] ?? null;
export const isCaseWorkspaceKey = (key: string): boolean => CASE_KEY_RE.test(key);

/** 작업 공간 키 → 우리 사무소 사건 (없으면 null) */
export async function findCaseByWorkspaceKey(officeId: string, key: string): Promise<RpcResult<CaseRecord | null>> {
  const caseId = caseIdFromWorkspaceKey(key);
  if (!caseId) return findCaseByConsultRequest(officeId, key);
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('cases').select('*').eq('office_id', officeId).eq('id', caseId).is('deleted_at', null).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? mapCase(data) : null };
}

/** 상담 요청이 없는 사건(직접 등록·영업 리드 이관)과 의뢰인 — 사건 관리 목록에 넣는다 */
export async function listOfficeWorkspaceCases(officeId: string): Promise<RpcResult<Array<{ case: CaseRecord; client: OfficeClient | null }>>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('cases').select('*, office_clients(*)')
    .eq('office_id', officeId).is('consult_request_id', null).is('deleted_at', null).eq('is_test', false)
    .order('created_at', { ascending: false }).limit(1000);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ case: mapCase(r), client: r.office_clients ? mapClient(r.office_clients) : null })) };
}

/** 영업 리드 → 사건 이관 (서버가 권한·중복 이관 확인, 리드 '이관 완료' 표시까지 한 번에) */
export async function convertSalesLeadToCase(leadId: string, input: { caseType: CaseType; title?: string; officeClientId?: string; displayName?: string }): Promise<RpcResult<{ caseId: string; workspaceKey: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const p: Record<string, unknown> = { case_type: input.caseType, title: input.title, office_client_id: input.officeClientId, display_name: input.displayName };
  Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
  const { data, error } = await supabase.rpc('convert_sales_lead_to_case', { p_lead_id: leadId, p });
  if (error) {
    if (/already converted/i.test(error.message)) return { ok: false, code: 'conflict', message: '이미 사건 관리로 이관한 리드예요.' };
    if (/sales\.convert/i.test(error.message)) return { ok: false, code: 'forbidden', message: '리드를 사건 관리로 이관할 권한이 없어요.' };
    if (/lead not found/i.test(error.message)) return { ok: false, code: 'not_found', message: '리드를 찾지 못했어요. 영업 DB를 새로 불러온 뒤 다시 시도해 주세요.' };
    return toRpcError(error);
  }
  return { ok: true, data: { caseId: data.case_id, workspaceKey: data.workspace_key } };
}

/** 사건 목록이 바뀌었음을 화면에 알림 (직접 등록·이관 뒤) */
export const OFFICE_CASES_CHANGED_EVENT = 'mykim:office-cases-changed';
export const notifyOfficeCasesChanged = () => window.dispatchEvent(new Event(OFFICE_CASES_CHANGED_EVENT));

/** 상담 요청에 연결된 우리 사무소 사건 (없으면 null) */
export async function findCaseByConsultRequest(officeId: string, consultRequestId: string): Promise<RpcResult<CaseRecord | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('cases').select('*')
    .eq('office_id', officeId).eq('consult_request_id', consultRequestId).is('deleted_at', null).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? mapCase(data) : null };
}

export async function getCase(caseId: string): Promise<RpcResult<{ case: CaseRecord; client: OfficeClient | null } | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('cases').select('*, office_clients(*)').eq('id', caseId).maybeSingle();
  if (error) return toRpcError(error);
  if (!data) return { ok: true, data: null };
  return { ok: true, data: { case: mapCase(data), client: data.office_clients ? mapClient(data.office_clients) : null } };
}

export async function listOfficeClients(officeId: string, ids?: string[]): Promise<RpcResult<OfficeClient[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('office_clients').select('*').eq('office_id', officeId).is('deleted_at', null);
  if (ids?.length) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapClient) };
}

export interface CreateCaseInput {
  caseType: CaseType;
  source: CaseSource;
  consultRequestId?: string;
  salesLeadId?: string;
  displayName?: string;
  realName?: string;
  phone?: string;
  email?: string;
  plannedFilingOn?: string;
  title?: string;
  officeClientId?: string;
  convertedFromCaseId?: string;
  isTest?: boolean;
}

export async function createCase(officeId: string, input: CreateCaseInput): Promise<RpcResult<CaseRecord>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const p: Record<string, unknown> = {
    case_type: input.caseType, source: input.source, consult_request_id: input.consultRequestId,
    sales_lead_id: input.salesLeadId, display_name: input.displayName, real_name: input.realName, phone: input.phone,
    email: input.email, planned_filing_on: input.plannedFilingOn, title: input.title, office_client_id: input.officeClientId,
    converted_from_case_id: input.convertedFromCaseId, is_test: input.isTest,
  };
  Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
  const { data, error } = await supabase.rpc('create_case', { p_office_id: officeId, p });
  if (error) return toRpcError(error);
  return { ok: true, data: mapCase(data) };
}

export async function findClientsByPhone(officeId: string, phone: string): Promise<RpcResult<Array<{ officeClientId: string; displayName: string; caseCount: number; lastCaseAt: string | null }>>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('find_office_clients_by_phone', { p_office_id: officeId, p_phone: phone });
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ officeClientId: r.office_client_id, displayName: r.display_name, caseCount: Number(r.case_count), lastCaseAt: r.last_case_at })) };
}

export async function recordMilestone(caseId: string, kind: CaseMilestone, payload: Record<string, unknown> = {}): Promise<RpcResult<CaseRecord>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('record_case_milestone', { p_case_id: caseId, p_kind: kind, p: payload });
  if (error) return toRpcError(error);
  return { ok: true, data: mapCase(data) };
}

export async function updateCaseBasic(caseId: string, patch: { title?: string; plannedFilingOn?: string | null; courtName?: string | null; caseNumber?: string | null; expectedVersion?: number }): Promise<RpcResult<CaseRecord>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const p: Record<string, unknown> = {};
  if (patch.title !== undefined) p.title = patch.title;
  if (patch.plannedFilingOn !== undefined) p.planned_filing_on = patch.plannedFilingOn;
  if (patch.courtName !== undefined) p.court_name = patch.courtName;
  if (patch.caseNumber !== undefined) p.case_number = patch.caseNumber;
  if (patch.expectedVersion !== undefined) p.expected_version = patch.expectedVersion;
  const { data, error } = await supabase.rpc('update_case_basic', { p_case_id: caseId, p });
  if (error) return toRpcError(error);
  return { ok: true, data: mapCase(data) };
}

export async function updateOfficeClient(clientId: string, patch: { displayName?: string; realName?: string | null; phone?: string | null; email?: string | null; memo?: string }): Promise<RpcResult<OfficeClient>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const p: Record<string, unknown> = {};
  if (patch.displayName !== undefined) p.display_name = patch.displayName;
  if (patch.realName !== undefined) p.real_name = patch.realName;
  if (patch.phone !== undefined) p.phone = patch.phone;
  if (patch.email !== undefined) p.email = patch.email;
  if (patch.memo !== undefined) p.memo = patch.memo;
  const { data, error } = await supabase.rpc('update_office_client', { p_client_id: clientId, p });
  if (error) return toRpcError(error);
  return { ok: true, data: mapClient(data) };
}

export async function setCaseAssignment(caseId: string, lawyerMemberId: string | null, staffMemberId: string | null): Promise<RpcResult<CaseRecord>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_case_assignment', { p_case_id: caseId, p_lawyer_member_id: lawyerMemberId, p_staff_member_id: staffMemberId });
  if (error) return toRpcError(error);
  return { ok: true, data: mapCase(data) };
}

export async function trashCase(caseId: string, restore = false): Promise<RpcResult<CaseRecord>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('trash_case', { p_case_id: caseId, p_restore: restore });
  if (error) return toRpcError(error);
  return { ok: true, data: mapCase(data) };
}

export async function listCaseEvents(caseId: string, limit = 200): Promise<RpcResult<CaseEvent[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_events').select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(limit);
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({ id: r.id, caseId: r.case_id, kind: r.kind, summary: r.summary, detail: r.detail || {}, clientVisible: r.client_visible, actorMemberId: r.actor_member_id, createdAt: r.created_at })),
  };
}

export async function loadFormDraft<T extends Record<string, unknown>>(caseId: string, formKey: string): Promise<RpcResult<{ data: T; version: number } | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_form_drafts').select('data, version').eq('case_id', caseId).eq('form_key', formKey).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? { data: data.data as T, version: data.version } : null };
}

/** 바뀐 칸만 보낸다. 다른 사람이 먼저 고쳤으면 version conflict → 화면이 새로 불러오기를 묻는다 */
export async function saveFormDraft(caseId: string, formKey: string, patch: Record<string, unknown>, expectedVersion?: number): Promise<RpcResult<{ version: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('save_case_form_draft', {
    p_case_id: caseId, p_form_key: formKey, p_patch: patch, p_expected_version: expectedVersion ?? null,
  });
  if (error) return toRpcError(error);
  return { ok: true, data: { version: data.version } };
}

export async function listPlanPayments(caseId: string): Promise<RpcResult<PlanPayment[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_plan_payments').select('*').eq('case_id', caseId).order('kind').order('round_no');
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(mapPayment) };
}

export async function setPlanPayments(caseId: string, rows: Array<{ roundNo: number; dueOn: string; amount: number; kind?: PlanPayment['kind'] }>): Promise<RpcResult<number>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_case_plan_payments', {
    p_case_id: caseId,
    p_rows: rows.map(r => ({ round_no: r.roundNo, due_on: r.dueOn, amount: Math.round(r.amount), kind: r.kind ?? 'plan' })),
  });
  if (error) return toRpcError(error);
  return { ok: true, data: Number(data) };
}

export async function markPlanPayment(paymentId: string, action: 'client_report' | 'confirm' | 'unpaid' | 'waive', paidOn?: string, note?: string): Promise<RpcResult<PlanPayment>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('mark_case_plan_payment', { p_payment_id: paymentId, p_action: action, p_paid_on: paidOn ?? null, p_note: note ?? null });
  if (error) return toRpcError(error);
  return { ok: true, data: mapPayment(data) };
}

export async function createClientLinkInvite(officeClientId: string, ttlHours = 168): Promise<RpcResult<{ token: string; expiresAt: string; url: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_client_link_invite', { p_office_client_id: officeClientId, p_ttl_hours: ttlHours });
  if (error) return toRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, data: { token: row.token, expiresAt: row.expires_at, url: `${window.location.origin}/?tab=mypage&caseLink=${encodeURIComponent(row.token)}` } };
}

export async function acceptClientLinkInvite(token: string): Promise<RpcResult<{ officeName: string; caseCount: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('accept_client_link_invite', { p_token: token });
  if (error) return toRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, data: { officeName: row?.office_name || '', caseCount: Number(row?.case_count || 0) } };
}

/** 의뢰인 '내 사건' (공개 항목만) */
export async function loadMyCases(): Promise<RpcResult<MyCaseSummary[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('my_cases');
  if (error) return toRpcError(error);
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      caseId: r.case_id, officeName: r.office_name || '', caseType: r.case_type, stage: r.stage, clientStageLabel: r.client_stage_label,
      groupNo: r.group_no, courtName: r.court_name, caseNumber: r.case_number, filedOn: r.filed_on, commencedOn: r.commenced_on,
      creditorsMeetingOn: r.creditors_meeting_on, confirmedOn: r.confirmed_on, dischargeDecidedOn: r.discharge_decided_on,
      closedOn: r.closed_on, closeReason: r.close_reason, updatedAt: r.updated_at,
      workspaceKey: r.workspace_key || `case-${r.case_id}`, hasConsultRequest: r.has_consult_request === true,
    })),
  };
}
