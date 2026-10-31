// ============================================================
// 파산 사건 진행 기록 (BK-4·BK-5, 20261031002100)
// 선고일·집회일·면책 결정일은 cases(기록 버튼), 그 밖의 파산 진행 값은 case_bankruptcy_details.
// 기한 계산은 법정 기간만(선고 +7일 서류 제출, +14일 면제재산 신청, 면책허가 공고 +14일 즉시항고 등). 판단은 하지 않는다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export interface BankruptcyDetails {
  insolventOn?: string;
  bankruptcyCaseNumber?: string;
  dischargeCaseNumber?: string;
  depositOrderedWon?: number;
  depositDueOn?: string;
  depositPaidOn?: string;
  dismissalType?: 'trustee' | 'simultaneous';
  trusteeName?: string;
  trusteePhone?: string;
  trusteeOffice?: string;
  trusteeInterviewOn?: string;
  trusteeDocsRequested?: string;
  trusteeDocsSubmittedOn?: string;
  objectionDeadlineOn?: string;
  dischargeHearingOn?: string;
  dischargeResult?: 'granted' | 'denied' | 'partial';
  dischargeConfirmedOn?: string;
  estateClosedOn?: string;
  memo?: string;
  version: number;
}

const COLS: Array<[keyof BankruptcyDetails, string]> = [
  ['insolventOn', 'insolvent_on'], ['bankruptcyCaseNumber', 'bankruptcy_case_number'], ['dischargeCaseNumber', 'discharge_case_number'],
  ['depositOrderedWon', 'deposit_ordered_won'], ['depositDueOn', 'deposit_due_on'], ['depositPaidOn', 'deposit_paid_on'],
  ['dismissalType', 'dismissal_type'], ['trusteeName', 'trustee_name'], ['trusteePhone', 'trustee_phone'], ['trusteeOffice', 'trustee_office'],
  ['trusteeInterviewOn', 'trustee_interview_on'], ['trusteeDocsRequested', 'trustee_docs_requested'], ['trusteeDocsSubmittedOn', 'trustee_docs_submitted_on'],
  ['objectionDeadlineOn', 'objection_deadline_on'], ['dischargeHearingOn', 'discharge_hearing_on'], ['dischargeResult', 'discharge_result'],
  ['dischargeConfirmedOn', 'discharge_confirmed_on'], ['estateClosedOn', 'estate_closed_on'], ['memo', 'memo'],
];

function mapDetails(r: any): BankruptcyDetails {
  const out: any = { version: r?.version || 0 };
  if (!r) return out;
  for (const [k, c] of COLS) if (r[c] !== null && r[c] !== undefined) out[k] = c === 'deposit_ordered_won' ? Number(r[c]) : r[c];
  return out;
}

const BK_MESSAGES: Array<[RegExp, string]> = [
  [/insolvency date after filing/i, '지급불능 시점이 접수일보다 늦어요. 날짜를 확인해 주세요.'],
  [/deposit paid before filing/i, '예납금 납부일이 접수일보다 빨라요. 날짜를 확인해 주세요.'],
  [/confirmation before decision/i, '면책 확정일이 면책 결정일보다 빨라요.'],
  [/case already filed/i, '법원에 접수한 뒤에는 유형을 바꿀 수 없어요. 이 사건을 \'파산 전환\'으로 종결하고 새 파산 사건을 만들어 주세요.'],
  [/bankruptcy case required/i, '파산 사건에서만 쓸 수 있어요.'],
];
function bkError<T>(error: { message?: string; code?: string }): RpcResult<T> {
  const m = error?.message || '';
  for (const [re, text] of BK_MESSAGES) if (re.test(m)) return { ok: false, code: error?.code || 'error', message: text };
  return toRpcError(error);
}

export async function loadBankruptcyDetails(caseId: string): Promise<RpcResult<BankruptcyDetails>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('case_bankruptcy_details_get', { p_case_id: caseId });
  if (error) return bkError(error);
  return { ok: true, data: mapDetails(data && (data as any).case_id ? data : null) };
}

export async function saveBankruptcyDetails(caseId: string, patch: Partial<Omit<BankruptcyDetails, 'version'>>, expectedVersion?: number): Promise<RpcResult<BankruptcyDetails>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const p: Record<string, unknown> = {};
  for (const [k, c] of COLS) if (k in patch) p[c] = (patch as any)[k] ?? '';
  const { data, error } = await supabase.rpc('set_case_bankruptcy_details', { p_case_id: caseId, p, p_expected_version: expectedVersion ?? null });
  if (error) return bkError(error);
  return { ok: true, data: mapDetails(data) };
}

export async function setServerCaseType(caseId: string, caseType: 'rehab' | 'bankruptcy', reason?: string): Promise<RpcResult<{ caseType: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_case_type', { p_case_id: caseId, p_case_type: caseType, p_reason: reason || null });
  if (error) return bkError(error);
  return { ok: true, data: { caseType: (data as any)?.case_type } };
}

export interface ClientBankruptcySchedule {
  filedOn?: string; declaredOn?: string; depositDueOn?: string; depositPaid?: boolean; trusteeInterviewOn?: string;
  creditorsMeetingOn?: string; dischargeHearingOn?: string; dischargeDecidedOn?: string; dischargeConfirmedOn?: string;
}
export async function loadClientBankruptcySchedule(caseId: string): Promise<RpcResult<ClientBankruptcySchedule | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('client_bankruptcy_schedule', { p_case_id: caseId });
  if (error) return toRpcError(error);
  if (!data) return { ok: true, data: null };
  const d = data as any;
  return { ok: true, data: {
    filedOn: d.filed_on, declaredOn: d.declared_on, depositDueOn: d.deposit_due_on, depositPaid: !!d.deposit_paid,
    trusteeInterviewOn: d.trustee_interview_on, creditorsMeetingOn: d.creditors_meeting_on, dischargeHearingOn: d.discharge_hearing_on,
    dischargeDecidedOn: d.discharge_decided_on, dischargeConfirmedOn: d.discharge_confirmed_on,
  } };
}

// ── 법정 기한 계산 (BK-5, 06 기획서 7-1) ─────────────────────
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export interface BankruptcyDeadline { key: string; label: string; date: string; basis: string }

/** 선고일·집회일·면책 결정일에서 법정 기한을 계산한다. 날짜가 없는 항목은 만들지 않는다 */
export function bankruptcyDeadlines(input: { declaredOn?: string; creditorsMeetingOn?: string; dischargeDecidedOn?: string; dischargeResult?: BankruptcyDetails['dischargeResult'] }): BankruptcyDeadline[] {
  const out: BankruptcyDeadline[] = [];
  if (input.declaredOn) {
    out.push({ key: 'docs7', label: '누락 서류 관재인 제출', date: addDays(input.declaredOn, 7), basis: '선고일부터 7일 (관재인 안내문)' });
    out.push({ key: 'exempt14', label: '면제재산 결정신청 기한', date: addDays(input.declaredOn, 14), basis: '선고일부터 14일 (법 제383조 ③)' });
    out.push({ key: 'interview', label: '관재인 면담 예상 (2주~1달)', date: addDays(input.declaredOn, 14), basis: '직무편람: 선고 후 2주~1달' });
    out.push({ key: 'early', label: '선면책 검토 가능 (선고 1년)', date: addDays(input.declaredOn, 365), basis: '실무준칙 제377호' });
  }
  if (input.creditorsMeetingOn) {
    out.push({ key: 'objection', label: '면책 이의신청기간 만료 (예상)', date: addDays(input.creditorsMeetingOn, -7), basis: '통상 1회 집회일 1주 전 — 법원 결정문 날짜로 고쳐 주세요' });
  }
  if (input.dischargeDecidedOn) {
    if (input.dischargeResult === 'denied') {
      out.push({ key: 'appeal_denied', label: '면책불허가 즉시항고 기한', date: addDays(input.dischargeDecidedOn, 7), basis: '송달일부터 1주 (송달일 기준으로 다시 확인)' });
    } else {
      out.push({ key: 'appeal_granted', label: '면책허가 즉시항고 기간 끝 (예상)', date: addDays(input.dischargeDecidedOn, 14), basis: '공고일부터 14일 (공고일 기준으로 다시 확인)' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
