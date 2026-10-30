// ============================================================
// 수임료 수납 — 서버 원본 (20261030000800_fee_collection)
// 약정(버전)·회차·납부(추가만)·의뢰인 '입금했어요'. 금액은 원 단위 정수.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export type InstallmentStatus = 'paid' | 'partial' | 'overdue' | 'scheduled';

export interface FeeInstallmentStatus {
  installmentId: string;
  seq: number;
  label: string;
  dueOn: string;
  amountWon: number;
  allocatedWon: number;
  remainingWon: number;
  status: InstallmentStatus;
}

export interface FeeAgreement {
  id: string;
  version: number;
  totalFeeWon: number;
  source: 'contract' | 'manual';
  contractId?: string;
  memo?: string;
  createdAt: string;
}

export interface FeePayment {
  id: string;
  paidOn: string;
  amountWon: number;
  method: 'transfer' | 'cash' | 'card' | 'other';
  payerName?: string;
  memo?: string;
  source: string;
  recordedAt: string;
  voidedAt?: string;
  voidReason?: string;
}

export interface FeeClientReport {
  id: string;
  reportedPaidOn: string;
  amountWon: number;
  payerName?: string;
  note?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  rejectReason?: string;
  createdAt: string;
}

export interface FeeOverviewRow {
  caseId: string;
  caseTitle: string;
  clientDisplayName: string;
  totalFeeWon: number;
  paidWon: number;
  remainingWon: number;
  overdueCount: number;
  nextDueOn?: string;
  nextDueWon?: number;
  pendingReports: number;
  /** 기한 지난 회차의 남은 금액 합계 */
  overdueWon: number;
  consultRequestId?: string;
}

export interface InstallmentInput {
  label: string;
  dueOn: string;
  amountWon: number;
}

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  paid: '완납',
  partial: '일부 납부',
  overdue: '기한 지남',
  scheduled: '예정',
};

export const PAYMENT_METHOD_LABEL: Record<FeePayment['method'], string> = {
  transfer: '계좌이체',
  cash: '현금',
  card: '카드',
  other: '기타',
};

const RULES: Array<[RegExp, string]> = [
  [/permission denied: fee\.record/i, '수납을 기록할 권한이 없어요. 대표에게 권한을 확인해 주세요.'],
  [/permission denied/i, '이 사건의 수납 정보를 볼 권한이 없어요.'],
  [/installments total mismatch/i, '회차 금액 합계가 총 수임료와 같아야 해요.'],
  [/installments required|invalid installment/i, '회차마다 날짜와 금액을 입력해 주세요.'],
  [/reason required/i, '사유를 입력해 주세요.'],
  [/fee agreement required/i, '먼저 수임료 약정(회차)을 만들어 주세요.'],
  [/invalid amount|invalid report/i, '금액과 날짜를 확인해 주세요.'],
  [/invalid paid date/i, '입금일을 확인해 주세요.'],
  [/payment already voided/i, '이미 취소한 납부 기록이에요.'],
  [/client report not pending/i, '이미 처리한 입금 알림이에요.'],
  [/too many pending reports/i, '확인 대기 중인 입금 알림이 많아요. 사무소 확인 후 다시 보내 주세요.'],
  [/case not found/i, '사건을 찾지 못했어요.'],
  [/Failed to fetch|NetworkError/i, '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'],
];
const msg = (e: { message?: string } | null | undefined) => {
  const m = e?.message || '';
  for (const [re, t] of RULES) if (re.test(m)) return t;
  return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
};

export async function loadFeeStatus(caseId: string): Promise<RpcResult<FeeInstallmentStatus[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('fee_case_status', { p_case_id: caseId });
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      installmentId: r.installment_id, seq: r.seq, label: r.label, dueOn: r.due_on, amountWon: r.amount_won,
      allocatedWon: r.allocated_won, remainingWon: r.remaining_won, status: r.status,
    })),
  };
}

export async function loadCurrentAgreement(caseId: string): Promise<RpcResult<FeeAgreement | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('fee_agreements').select('*').eq('case_id', caseId).eq('is_current', true).maybeSingle();
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  if (!data) return { ok: true, data: null };
  return { ok: true, data: { id: data.id, version: data.version, totalFeeWon: data.total_fee_won, source: data.source, contractId: data.contract_id || undefined, memo: data.memo || undefined, createdAt: data.created_at } };
}

export async function loadFeePayments(caseId: string): Promise<RpcResult<FeePayment[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('fee_payments').select('*').eq('case_id', caseId).order('paid_on', { ascending: false });
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, paidOn: r.paid_on, amountWon: r.amount_won, method: r.method, payerName: r.payer_name || undefined, memo: r.memo || undefined,
      source: r.source, recordedAt: r.recorded_at, voidedAt: r.voided_at || undefined, voidReason: r.void_reason || undefined,
    })),
  };
}

export async function loadClientReports(caseId: string): Promise<RpcResult<FeeClientReport[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('fee_client_reports').select('*').eq('case_id', caseId).order('created_at', { ascending: false });
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, reportedPaidOn: r.reported_paid_on, amountWon: r.amount_won, payerName: r.payer_name || undefined, note: r.note || undefined,
      status: r.status, rejectReason: r.reject_reason || undefined, createdAt: r.created_at,
    })),
  };
}

export async function loadFeeOverview(officeId: string): Promise<RpcResult<FeeOverviewRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('fee_office_overview', { p_office_id: officeId });
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      caseId: r.case_id, caseTitle: r.case_title || '', clientDisplayName: r.client_display_name || '', totalFeeWon: r.total_fee_won,
      paidWon: Number(r.paid_won) || 0, remainingWon: Number(r.remaining_won) || 0, overdueCount: r.overdue_count || 0,
      nextDueOn: r.next_due_on || undefined, nextDueWon: r.next_due_won ?? undefined, pendingReports: r.pending_reports || 0,
      overdueWon: Number(r.overdue_won) || 0, consultRequestId: r.consult_request_id || undefined,
    })),
  };
}

export async function setFeeAgreement(caseId: string, input: {
  totalFeeWon: number;
  installments: InstallmentInput[];
  source?: 'contract' | 'manual';
  contractId?: string;
  reason?: string;
  memo?: string;
}): Promise<RpcResult<{ agreementId: string; version: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('set_fee_agreement', {
    p_case_id: caseId,
    p_total_fee_won: Math.round(input.totalFeeWon),
    p_installments: input.installments.map(i => ({ label: i.label, due_on: i.dueOn, amount_won: Math.round(i.amountWon) })),
    p_source: input.source || 'manual',
    p_contract_id: input.contractId || null,
    p_reason: input.reason || null,
    p_memo: input.memo || null,
  });
  if (error) return { ok: false, code: 'save_failed', message: msg(error) };
  return { ok: true, data: { agreementId: (data as any).agreement_id, version: (data as any).version } };
}

export async function recordFeePayment(caseId: string, p: { paidOn: string; amountWon: number; method?: FeePayment['method']; payerName?: string; memo?: string; clientReportId?: string }): Promise<RpcResult<{ paymentId: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('record_fee_payment', {
    p_case_id: caseId, p_paid_on: p.paidOn, p_amount_won: Math.round(p.amountWon), p_method: p.method || 'transfer',
    p_payer_name: p.payerName || null, p_memo: p.memo || null, p_client_report_id: p.clientReportId || null,
  });
  if (error) return { ok: false, code: 'save_failed', message: msg(error) };
  return { ok: true, data: { paymentId: (data as any).payment_id } };
}

export async function voidFeePayment(paymentId: string, reason: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('void_fee_payment', { p_payment_id: paymentId, p_reason: reason });
  if (error) return { ok: false, code: 'save_failed', message: msg(error) };
  return { ok: true, data: null };
}

export async function rejectClientReport(reportId: string, reason: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('reject_fee_client_report', { p_report_id: reportId, p_reason: reason });
  if (error) return { ok: false, code: 'save_failed', message: msg(error) };
  return { ok: true, data: null };
}

export async function clientReportPayment(caseId: string, p: { paidOn: string; amountWon: number; payerName?: string; note?: string }): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('client_report_fee_payment', {
    p_case_id: caseId, p_paid_on: p.paidOn, p_amount_won: Math.round(p.amountWon), p_payer_name: p.payerName || null, p_note: p.note || null,
  });
  if (error) return { ok: false, code: 'save_failed', message: msg(error) };
  return { ok: true, data: null };
}

/** 상담 요청 ID → 서버 수납 현황 (대시보드·사이드바·일괄 발송 대상처럼 상담 요청 기준 화면용). 실패면 null */
export async function loadFeeOverviewByRequest(officeId: string): Promise<Record<string, FeeOverviewRow> | null> {
  if (!isSupabaseConfigured || !officeId) return null;
  const o = await loadFeeOverview(officeId);
  if (o.ok === false) return null;
  const out: Record<string, FeeOverviewRow> = {};
  o.data.forEach(r => { if (r.consultRequestId) out[r.consultRequestId] = r; });
  return out;
}

// ── 납부 안내 알림톡 자동 발송 (FE-7) ─────────────────────────────────────────
export interface FeeReminderSettings {
  enabled: boolean;
  sendDMinus3: boolean;
  sendDue: boolean;
  sendDPlus1: boolean;
  sendDPlus7: boolean;
  sendHour: number;
}
export interface FeeReminderRow {
  id: string;
  caseId: string;
  kind: 'd_minus_3' | 'due' | 'd_plus_1' | 'd_plus_7';
  dueOn: string;
  sendOn: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';
  error?: string;
  amountWon?: number;
  sentAt?: string;
}
export const REMINDER_KIND_LABEL: Record<FeeReminderRow['kind'], string> = {
  d_minus_3: '3일 전 안내', due: '당일 안내', d_plus_1: '다음 날 안내', d_plus_7: '7일 뒤 안내',
};
export const REMINDER_STATUS_LABEL: Record<FeeReminderRow['status'], string> = {
  pending: '보낼 예정', sending: '보내는 중', sent: '보냄', failed: '못 보냄', skipped: '건너뜀', cancelled: '취소',
};
export const DEFAULT_REMINDER_SETTINGS: FeeReminderSettings = { enabled: false, sendDMinus3: true, sendDue: true, sendDPlus1: true, sendDPlus7: true, sendHour: 10 };

export async function loadReminderSettings(officeId: string): Promise<RpcResult<FeeReminderSettings>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('fee_reminder_settings').select('*').eq('office_id', officeId).maybeSingle();
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  if (!data) return { ok: true, data: DEFAULT_REMINDER_SETTINGS };
  return { ok: true, data: { enabled: data.enabled, sendDMinus3: data.send_d_minus_3, sendDue: data.send_due, sendDPlus1: data.send_d_plus_1, sendDPlus7: data.send_d_plus_7, sendHour: data.send_hour } };
}

export async function saveReminderSettings(officeId: string, s: FeeReminderSettings): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_fee_reminder_settings', {
    p_office_id: officeId,
    p: { enabled: s.enabled, send_d_minus_3: s.sendDMinus3, send_due: s.sendDue, send_d_plus_1: s.sendDPlus1, send_d_plus_7: s.sendDPlus7, send_hour: s.sendHour },
  });
  if (error) return { ok: false, code: 'save_failed', message: /fee\.record/.test(error.message) ? '자동 안내 설정은 수납 기록 권한(전체)이 있어야 바꿀 수 있어요.' : msg(error) };
  return { ok: true, data: null };
}

export async function loadRecentReminders(officeId: string, caseId?: string, limit = 50): Promise<RpcResult<FeeReminderRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('fee_reminders').select('*').eq('office_id', officeId).order('created_at', { ascending: false }).limit(limit);
  if (caseId) q = q.eq('case_id', caseId);
  const { data, error } = await q;
  if (error) return { ok: false, code: 'load_failed', message: msg(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({
      id: r.id, caseId: r.case_id, kind: r.kind, dueOn: r.due_on, sendOn: r.send_on, status: r.status,
      error: r.error || undefined, amountWon: r.amount_won ?? undefined, sentAt: r.sent_at || undefined,
    })),
  };
}

// ── 입금 계좌 (사무소 기본 + 사건별) ─────────────────────────────────────────
export interface DepositAccount { bankName: string; accountNumber: string; accountHolder: string; scope: 'case' | 'office' }

const accountMsg = (e: { message?: string } | null | undefined) => {
  const m = e?.message || '';
  if (/all required/i.test(m)) return '은행·계좌번호·예금주를 모두 입력해 주세요.';
  if (/invalid account number/i.test(m)) return '계좌번호는 숫자와 - 만 입력해 주세요.';
  if (/no permission|privilege/i.test(m)) return '입금 계좌를 바꿀 권한이 없어요.';
  return msg(e);
};

/** 사건에 안내할 입금 계좌 (사건 계좌 → 사무소 기본 계좌). 없으면 null */
export async function loadDepositAccount(caseId: string): Promise<RpcResult<DepositAccount | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('fee_deposit_account', { p_case_id: caseId });
  if (error) return { ok: false, code: 'load_failed', message: accountMsg(error) };
  const r = (data as any[] | null)?.[0];
  return { ok: true, data: r ? { bankName: r.bank_name, accountNumber: r.account_number, accountHolder: r.account_holder, scope: r.scope } : null };
}

/** 사무소 기본 입금 계좌 */
export async function loadOfficeDepositAccount(officeId: string): Promise<RpcResult<Omit<DepositAccount, 'scope'> | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('fee_office_account', { p_office_id: officeId });
  if (error) return { ok: false, code: 'load_failed', message: accountMsg(error) };
  const r = (data as any[] | null)?.[0];
  return { ok: true, data: r ? { bankName: r.bank_name, accountNumber: r.account_number, accountHolder: r.account_holder } : null };
}

/** 입금 계좌 저장. caseId가 없으면 사무소 기본 계좌. 세 칸을 모두 비우면 삭제 */
export async function saveDepositAccount(officeId: string, caseId: string | null, a: { bankName: string; accountNumber: string; accountHolder: string }): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_fee_deposit_account', {
    p_office_id: officeId, p_case_id: caseId, p_bank_name: a.bankName, p_account_number: a.accountNumber, p_account_holder: a.accountHolder,
  });
  if (error) return { ok: false, code: 'save_failed', message: accountMsg(error) };
  return { ok: true, data: null };
}

/** 공통 회차 생성기 (FE-4): 착수금 + 균등 분할, 끝전은 마지막 회차. 날짜는 매월 같은 날(말일 보정) */
export function buildInstallments(opts: { totalFeeWon: number; downPaymentWon: number; downPaymentOn: string; count: number; firstDueOn: string }): InstallmentInput[] {
  const total = Math.max(0, Math.round(opts.totalFeeWon));
  const down = Math.min(total, Math.max(0, Math.round(opts.downPaymentWon)));
  const rest = total - down;
  const out: InstallmentInput[] = [];
  if (down > 0) out.push({ label: '착수금', dueOn: opts.downPaymentOn, amountWon: down });
  const n = rest > 0 ? Math.max(1, Math.min(60, Math.floor(opts.count))) : 0;
  if (n > 0) {
    const base = Math.floor(rest / n);
    const [y, m, d] = opts.firstDueOn.split('-').map(Number);
    for (let i = 0; i < n; i++) {
      const target = new Date(Date.UTC(y, m - 1 + i, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(d, lastDay));
      const amount = i === n - 1 ? rest - base * (n - 1) : base;
      out.push({ label: `${i + 1}회차`, dueOn: target.toISOString().slice(0, 10), amountWon: amount });
    }
  }
  return out;
}
