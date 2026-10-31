import { supabase, isSupabaseConfigured } from '../../supabaseClient';

// ============================================================
// 통합어드민 운영 서버 함수 (OP-2·OP-3·OP-8·OP-9·OP-10, 20261031001400)
// 관리자 화면은 브라우저 사본이 아니라 이 함수들로 서버 값을 읽고, 쓰기도 서버 함수로만 한다.
// ============================================================

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function errorMessage(error: any, fallback: string): string {
  const m = String(error?.message || '');
  if (m.includes('admin only')) return '관리자(2단계 인증 완료)만 할 수 있어요.';
  if (m.includes('reason required')) return '사유를 적어 주세요.';
  if (m.includes('only suspended')) return '정지된 변호사만 복구할 수 있어요.';
  if (m.includes('only approved')) return '승인된 변호사만 정지할 수 있어요.';
  if (m.includes('cannot change own')) return '내 계정은 여기서 바꿀 수 없어요.';
  if (m.includes('until must be')) return '정지 기한은 지금 이후로 정해 주세요.';
  if (m.includes('only for open reports')) return '원문은 열린 신고가 있는 요청만 볼 수 있어요.';
  if (m.includes('too many reports')) return '오늘 보낼 수 있는 신고 수(10건)를 넘었어요.';
  if (m.includes('not found')) return '대상을 찾지 못했어요. 목록을 새로 고쳐 주세요.';
  return fallback;
}

async function rpc<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<Result<T>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[adminOps] ${fn} 실패:`, error.message);
    return { ok: false, message: errorMessage(error, fallback) };
  }
  return { ok: true, data: data as T };
}

// ── 처리할 일 · 지표 ──
export interface AdminTodoItem { key: string; label: string; count: number; oldestAt?: string; overdue: boolean; tab: string }

export async function loadAdminTodo(): Promise<Result<AdminTodoItem[]>> {
  const r = await rpc<any[]>('admin_todo_items', {}, '처리할 일을 불러오지 못했어요.');
  if (r.ok === false) return r;
  return { ok: true, data: (r.data || []).map(x => ({ key: x.key, label: x.label, count: Number(x.count) || 0, oldestAt: x.oldest_at || undefined, overdue: !!x.overdue, tab: x.tab })) };
}

export interface PlatformMetrics {
  consult: { created: number; hidden: number; byStatus: Record<string, number> };
  seats: { requested: number; responded: number; respondedInTime: number; expired: number; declined: number; avgFirstResponseHours: number | null };
  lawyers: { approved: number; pending: number; listed: number; suspended: number };
  accounts: { clients: number; newClients: number; suspended: number };
  ads: { byStatus: Record<string, number>; paidAmount: number };
  inquiries: { clientPending: number; lawyerPending: number };
  checksCompleted: number;
}

export function mapMetrics(m: any): PlatformMetrics {
  const n = (v: unknown) => Number(v) || 0;
  return {
    consult: { created: n(m?.consult?.created), hidden: n(m?.consult?.hidden), byStatus: m?.consult?.by_status || {} },
    seats: {
      requested: n(m?.seats?.requested), responded: n(m?.seats?.responded), respondedInTime: n(m?.seats?.responded_in_time),
      expired: n(m?.seats?.expired), declined: n(m?.seats?.declined),
      avgFirstResponseHours: m?.seats?.avg_first_response_hours == null ? null : Number(m.seats.avg_first_response_hours),
    },
    lawyers: { approved: n(m?.lawyers?.approved), pending: n(m?.lawyers?.pending), listed: n(m?.lawyers?.listed), suspended: n(m?.lawyers?.suspended) },
    accounts: { clients: n(m?.accounts?.clients), newClients: n(m?.accounts?.new_clients), suspended: n(m?.accounts?.suspended) },
    ads: { byStatus: m?.ads?.by_status || {}, paidAmount: n(m?.ads?.paid_amount) },
    inquiries: { clientPending: n(m?.inquiries?.client_pending), lawyerPending: n(m?.inquiries?.lawyer_pending) },
    checksCompleted: n(m?.checks_completed),
  };
}

export async function loadPlatformMetrics(from: Date, to: Date = new Date()): Promise<Result<PlatformMetrics>> {
  const r = await rpc<any>('admin_platform_metrics', { p_from: from.toISOString(), p_to: to.toISOString() }, '지표를 불러오지 못했어요.');
  return r.ok === false ? r : { ok: true, data: mapMetrics(r.data) };
}

/** 하루 단위 스냅샷 (최근 n일, 오래된 날부터) */
export async function loadDailyMetrics(days: number): Promise<Result<Array<{ day: string; metrics: PlatformMetrics }>>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('platform_daily_metrics').select('day, metrics').gte('day', since).order('day', { ascending: true });
  if (error) return { ok: false, message: '추이를 불러오지 못했어요.' };
  return { ok: true, data: (data || []).map((r: any) => ({ day: r.day, metrics: mapMetrics(r.metrics) })) };
}

// ── 변호사 심사 ──
export type LawyerReviewStatus = 'pending' | 'info_requested' | 'approved' | 'rejected' | 'suspended';
export type LawyerReviewAction = 'approve' | 'request_info' | 'reject' | 'suspend' | 'reinstate' | 'verify_license';

export const LAWYER_REVIEW_STATUS_LABEL: Record<LawyerReviewStatus, string> = {
  pending: '심사 대기', info_requested: '보완 요청', approved: '승인', rejected: '반려', suspended: '이용 정지',
};

export interface LawyerApplication {
  lawyerId: string;
  authUserId: string;
  email?: string;
  name?: string;
  firmName?: string;
  region?: string;
  licenseNumber?: string;
  hasLicenseImage: boolean;
  businessNumber?: string;
  approved: boolean;
  status: LawyerReviewStatus;
  reason?: string;
  licenseCheckedAt?: string;
  licenseCheckNote?: string;
  submittedAt?: string;
  approvedAt?: string;
  waitingBusinessDays?: number | null;
  profileMissing: string[];
  listed: boolean;
  accountActive: boolean;
}

export async function loadLawyerApplications(): Promise<Result<LawyerApplication[]>> {
  const r = await rpc<any[]>('admin_list_lawyer_applications', {}, '심사 목록을 불러오지 못했어요.');
  if (r.ok === false) return r;
  return {
    ok: true,
    data: (r.data || []).map(x => ({
      lawyerId: x.lawyer_id, authUserId: x.auth_user_id, email: x.email || undefined, name: x.name || undefined,
      firmName: x.firm_name || undefined, region: x.region || undefined, licenseNumber: x.license_number || undefined,
      hasLicenseImage: !!x.has_license_image, businessNumber: x.business_number || undefined, approved: !!x.approved,
      status: x.status, reason: x.reason || undefined, licenseCheckedAt: x.license_checked_at || undefined,
      licenseCheckNote: x.license_check_note || undefined, submittedAt: x.submitted_at || undefined, approvedAt: x.approved_at || undefined,
      waitingBusinessDays: x.waiting_business_days ?? null, profileMissing: Array.isArray(x.profile_missing) ? x.profile_missing : [],
      listed: !!x.listed, accountActive: x.account_active !== false,
    })),
  };
}

export async function reviewLawyer(lawyerId: string, action: LawyerReviewAction, reason?: string): Promise<Result<{ status: LawyerReviewStatus; closedRequests: number }>> {
  const r = await rpc<any>('admin_review_lawyer', { p_lawyer_id: lawyerId, p_action: action, p_reason: reason?.trim() || null }, '심사 결과를 저장하지 못했어요.');
  return r.ok === false ? r : { ok: true, data: { status: r.data?.status, closedRequests: Number(r.data?.closed_requests) || 0 } };
}

// ── 계정 ──
export type AccountKind = 'client' | 'lawyer' | 'staff' | 'admin';
export interface AccountRow {
  userId: string;
  kind: AccountKind;
  alias?: string;
  email?: string;
  provider?: string;
  createdAt: string;
  lastSignInAt?: string;
  lawyerId?: string;
  lawyerApproved?: boolean;
  officeId?: string;
  status: 'active' | 'suspended';
  statusReason?: string;
  statusUntil?: string;
}

export async function listAccounts(opts: { search?: string; kind?: AccountKind; limit?: number; offset?: number }): Promise<Result<{ total: number; rows: AccountRow[] }>> {
  const r = await rpc<any>('admin_list_accounts', {
    p_search: opts.search?.trim() || null, p_kind: opts.kind || null, p_limit: opts.limit ?? 50, p_offset: opts.offset ?? 0,
  }, '계정 목록을 불러오지 못했어요.');
  if (r.ok === false) return r;
  return {
    ok: true,
    data: {
      total: Number(r.data?.total) || 0,
      rows: (r.data?.rows || []).map((x: any) => ({
        userId: x.user_id, kind: x.kind, alias: x.alias || undefined, email: x.email || undefined, provider: x.provider || undefined,
        createdAt: x.created_at, lastSignInAt: x.last_sign_in_at || undefined, lawyerId: x.lawyer_id || undefined,
        lawyerApproved: x.lawyer_approved ?? undefined, officeId: x.office_id || undefined, status: x.status === 'suspended' ? 'suspended' : 'active',
        statusReason: x.status_reason || undefined, statusUntil: x.status_until || undefined,
      })),
    },
  };
}

export async function setAccountStatus(userId: string, status: 'active' | 'suspended', reason?: string, until?: Date | null): Promise<Result<{ revokedSessions: number }>> {
  const r = await rpc<any>('admin_set_account_status', {
    p_user: userId, p_status: status, p_reason: reason?.trim() || null, p_until: until ? until.toISOString() : null,
  }, '계정 상태를 바꾸지 못했어요.');
  return r.ok === false ? r : { ok: true, data: { revokedSessions: Number(r.data?.revoked_sessions) || 0 } };
}

// ── 본인 ──
export interface MyAccountStatus { status: 'active' | 'suspended'; reason?: string; until?: string }

export async function loadMyAccountStatus(): Promise<MyAccountStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('my_account_status');
  if (error || !data) return null;
  return { status: (data as any).status === 'suspended' ? 'suspended' : 'active', reason: (data as any).reason || undefined, until: (data as any).until || undefined };
}

export interface MyLawyerReviewState { lawyerId: string; approved: boolean; status: LawyerReviewStatus; reason?: string; updatedAt?: string; submittedAt?: string }

export async function loadMyLawyerReviewState(): Promise<MyLawyerReviewState | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('my_lawyer_review_state');
  if (error || !data) return null;
  const d = data as any;
  return { lawyerId: d.lawyer_id, approved: !!d.approved, status: d.status, reason: d.reason || undefined, updatedAt: d.updated_at || undefined, submittedAt: d.submitted_at || undefined };
}

// ── 상담 관제 (OP-5): 운영 정보만. 원문은 열린 신고가 있을 때 사유를 남기고만 본다 ──
export interface ConsultOverviewRow {
  id: string; alias: string; status: string; adminHidden: boolean; adminHiddenReason: string | null;
  createdAt: string; updatedAt: string | null; lawyerCount: number; proposalCount: number; messageCount: number;
  lastMessageAt: string | null; seats: Record<string, number>; overdueSeats: number; openReports: number; source: string | null; hasSummary: boolean;
}
export interface ConsultOverview { total: number; rows: ConsultOverviewRow[]; counts: Record<string, number> }

export async function loadConsultOverview(opts: { status?: string; search?: string; limit?: number; offset?: number }): Promise<Result<ConsultOverview>> {
  const r = await rpc<any>('admin_consult_overview', {
    p_status: opts.status && opts.status !== 'all' ? opts.status : null, p_search: opts.search?.trim() || null,
    p_limit: opts.limit ?? 50, p_offset: opts.offset ?? 0,
  }, '상담 현황을 불러오지 못했어요.');
  if (r.ok === false) return r;
  const d = r.data || {};
  return {
    ok: true,
    data: {
      total: Number(d.total) || 0,
      counts: d.counts || {},
      rows: (d.rows || []).map((x: any) => ({
        id: x.id, alias: x.alias || '의뢰인', status: x.status, adminHidden: !!x.admin_hidden, adminHiddenReason: x.admin_hidden_reason ?? null,
        createdAt: x.created_at, updatedAt: x.updated_at ?? null, lawyerCount: Number(x.lawyer_count) || 0, proposalCount: Number(x.proposal_count) || 0,
        messageCount: Number(x.message_count) || 0, lastMessageAt: x.last_message_at ?? null, seats: x.seats || {}, overdueSeats: Number(x.overdue_seats) || 0,
        openReports: Number(x.open_reports) || 0, source: x.source ?? null, hasSummary: !!x.has_summary,
      })),
    },
  };
}

export interface ConsultReport {
  id: string; consultRequestId: string; alias: string; reporterRole: 'client' | 'office'; category: string; detail: string | null;
  status: 'open' | 'resolved' | 'dismissed'; resolution: string | null; createdAt: string; resolvedAt: string | null;
}

export async function listConsultReports(status: 'open' | 'resolved' | 'dismissed' | null = 'open'): Promise<Result<ConsultReport[]>> {
  const r = await rpc<any[]>('admin_list_consult_reports', { p_status: status }, '신고 목록을 불러오지 못했어요.');
  if (r.ok === false) return r;
  return {
    ok: true,
    data: (r.data || []).map((x: any) => ({
      id: x.id, consultRequestId: x.consult_request_id, alias: x.alias || '의뢰인', reporterRole: x.reporter_role, category: x.category,
      detail: x.detail ?? null, status: x.status, resolution: x.resolution ?? null, createdAt: x.created_at, resolvedAt: x.resolved_at ?? null,
    })),
  };
}

export async function resolveConsultReport(id: string, decision: 'resolved' | 'dismissed', resolution: string): Promise<Result<null>> {
  const r = await rpc<any>('admin_resolve_consult_report', { p_id: id, p_decision: decision, p_resolution: resolution }, '신고를 처리하지 못했어요.');
  return r.ok === false ? r : { ok: true, data: null };
}

export interface ConsultDetailForReview { alias: string; title: string; content: string; messages: Array<{ senderType: string; message: string; createdAt: string }> }

export async function openConsultDetail(id: string, reason: string): Promise<Result<ConsultDetailForReview>> {
  const r = await rpc<any>('admin_open_consult_detail', { p_id: id, p_reason: reason }, '원문을 열지 못했어요. 열린 신고가 있는 요청만 열 수 있어요.');
  if (r.ok === false) return r;
  const d = r.data || {};
  return {
    ok: true,
    data: {
      alias: d.alias || '의뢰인', title: d.title || '', content: d.content || '',
      messages: (d.messages || []).map((m: any) => ({ senderType: m.sender_type, message: m.message, createdAt: m.created_at })),
    },
  };
}

/** 의뢰인·사무소: 상담 요청 신고 (스팸·부적절) */
export async function reportConsultRequest(requestId: string, category: 'spam' | 'abuse' | 'fraud' | 'privacy' | 'other', detail?: string): Promise<Result<null>> {
  const r = await rpc<any>('report_consult_request', { p_request_id: requestId, p_category: category, p_detail: detail?.trim() || null }, '신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
  return r.ok === false ? r : { ok: true, data: null };
}
