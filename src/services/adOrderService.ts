// src/services/adOrderService.ts
// 광고 주문 — 원본은 서버(ad_orders). 가격·구좌·예약·사업자 정보 사본은 서버 함수가 정한다 (20261030000700_ad_billing)
// 브라우저 저장소(crm_ad_orders)·탭 간 방송은 쓰지 않는다. 실패는 문장으로 돌려 화면에 알린다.
import type { AdOrder } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { NOT_CONFIGURED, type RpcResult } from './office/rpcResult';
import { secureRemoveItem } from '../utils/secureStorage';

export interface AdProduct {
  id: string;
  name: string;
  placement: 'main_banner' | 'top_exposure' | 'regional';
  monthlyPriceWon: number;
  maxSlots: number;
  perRegion: boolean;
  termDiscounts: Record<string, number>;
  sortOrder: number;
}

export interface AdPromotion {
  id: string;
  name: string;
  rate: number;
  startsOn?: string;
  endsOn?: string;
  active: boolean;
  note?: string;
}

export interface AdPriceQuote {
  productId: string;
  productName: string;
  months: number;
  listMonthly: number;
  supply: number;
  vat: number;
  total: number;
  monthsDetail: Array<{ month: number; startsOn: string; rate: number; supply: number }>;
}

export interface OfficeBillingProfile {
  officeId: string;
  corpNum?: string;
  corpName?: string;
  ceoName?: string;
  address?: string;
  bizType?: string;
  bizClass?: string;
  email?: string;
  email2?: string;
  contactName?: string;
  contactPhone?: string;
  updatedAt?: string;
}

export interface ActivePlacement {
  lawyerId: string;
  placement: AdProduct['placement'];
  region?: string;
  endsOn: string;
}

const MESSAGE_RULES: Array<[RegExp, string]> = [
  [/permission denied: ads\.manage|permission denied/i, '광고를 신청할 권한이 없어요. 사무소 대표에게 권한을 확인해 주세요.'],
  [/lawyer is not approved/i, '마이김변 승인을 받은 변호사만 광고를 신청할 수 있어요.'],
  [/ad product not found/i, '판매 중인 광고 상품이 아니에요. 새로고침 후 다시 골라 주세요.'],
  [/invalid contract months/i, '계약 기간은 1·3·6·12개월 중에서 골라 주세요.'],
  [/invalid start date/i, '노출 시작일은 오늘부터 90일 안에서 골라 주세요.'],
  [/region required/i, '지역 광고는 노출 지역을 입력해 주세요.'],
  [/duplicate ad order/i, '같은 기간에 이미 신청한 같은 광고가 있어요.'],
  [/no ad slots available/i, '선택한 기간에 남은 구좌가 없어요. 시작일을 바꿔 보세요.'],
  [/only pending orders/i, '입금 대기 중인 주문만 입금 확인할 수 있어요.'],
  [/order already closed/i, '이미 끝난 주문이에요.'],
  [/invalid refund amount/i, '환불액은 0원 이상, 결제 금액 이하로 입력해 주세요.'],
  [/reason required/i, '사유를 입력해 주세요.'],
  [/cancel only before payment/i, '입금 전 주문만 직접 취소할 수 있어요. 입금한 주문은 환불 요청을 해 주세요.'],
  [/refund only for paid orders/i, '입금이 확인된 주문만 환불 요청할 수 있어요.'],
  [/refund request already open/i, '이미 처리 중인 환불 요청이 있어요.'],
  [/renew only paid orders/i, '입금 확인됐거나 노출 중인 광고만 연장할 수 있어요.'],
  [/already renewed/i, '이미 연장 신청한 광고예요.'],
  [/request already closed/i, '이미 처리된 요청이에요.'],
  [/authentication required/i, '로그인이 필요해요.'],
  [/Failed to fetch|NetworkError/i, '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'],
];

function adError(error: { message?: string } | null | undefined): string {
  const msg = error?.message || '';
  for (const [re, text] of MESSAGE_RULES) if (re.test(msg)) return text;
  return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function rowToProduct(r: any): AdProduct {
  return {
    id: r.id,
    name: r.name,
    placement: r.placement,
    monthlyPriceWon: Number(r.monthly_price_won) || 0,
    maxSlots: Number(r.max_slots) || 0,
    perRegion: !!r.per_region,
    termDiscounts: r.term_discounts || {},
    sortOrder: Number(r.sort_order) || 0,
  };
}

export function rowToAdOrder(r: any): AdOrder {
  const total = Number(r.total_amount ?? r.total_price) || 0;
  return {
    id: r.id,
    lawyerId: r.lawyer_id,
    lawyerName: r.lawyer_name || '',
    productId: r.product_id || '',
    productName: r.product_name || '',
    contractMonths: Number(r.contract_months) || 1,
    monthlyPrice: Number(r.monthly_price) || 0,
    totalPrice: total,
    status: r.status,
    requestedAt: r.requested_at,
    paidAt: r.paid_at || undefined,
    activatedAt: r.activated_at || undefined,
    expiresAt: r.expires_at || undefined,
    depositorName: r.depositor_name || undefined,
    region: r.region || undefined,
    taxInvoice: r.tax_invoice || undefined,
    modifiedTaxInvoice: r.modified_tax_invoice || undefined,
    buyerCorpNum: r.buyer_corp_num || undefined,
    buyerCorpName: r.buyer_corp_name || undefined,
    buyerCEOName: r.buyer_ceo_name || undefined,
    buyerEmail: r.buyer_email || undefined,
    officeId: r.office_id || undefined,
    placement: r.placement || undefined,
    supplyAmount: r.supply_amount ?? undefined,
    vatAmount: r.vat_amount ?? undefined,
    startsOn: r.starts_on || undefined,
    endsOn: r.ends_on || undefined,
    reservedUntil: r.reserved_until || undefined,
    cancelledAt: r.cancelled_at || undefined,
    cancelReason: r.cancel_reason || undefined,
    refundAmount: r.refund_amount ?? undefined,
    creativeId: r.creative_id ?? undefined,
    renewedFrom: r.renewed_from ?? undefined,
  };
}

/** 예전 버전이 남긴 브라우저 사본 정리 */
export function clearLegacyAdOrderCache(): void {
  try { secureRemoveItem('crm_ad_orders'); secureRemoveItem('legal_crm_lawyer_biz_info'); } catch { /* ignore */ }
}

export async function fetchAdProducts(): Promise<RpcResult<AdProduct[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('ad_products').select('*').order('sort_order');
  if (error) return { ok: false, code: 'load_failed', message: adError(error) };
  return { ok: true, data: (data || []).map(rowToProduct) };
}

export async function fetchActivePromotions(): Promise<RpcResult<AdPromotion[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('ad_promotions').select('*');
  if (error) return { ok: false, code: 'load_failed', message: adError(error) };
  return {
    ok: true,
    data: (data || []).map((r: any) => ({ id: r.id, name: r.name, rate: r.rate, startsOn: r.starts_on || undefined, endsOn: r.ends_on || undefined, active: !!r.active, note: r.note || undefined })),
  };
}

export async function quoteAdPrice(productId: string, months: number, startsOn: string): Promise<RpcResult<AdPriceQuote>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('ad_price_quote', { p_product_id: productId, p_months: months, p_starts_on: startsOn });
  if (error) return { ok: false, code: 'quote_failed', message: adError(error) };
  const q = data as any;
  return {
    ok: true,
    data: {
      productId: q.product_id,
      productName: q.product_name,
      months: q.months,
      listMonthly: q.list_monthly,
      supply: q.supply,
      vat: q.vat,
      total: q.total,
      monthsDetail: (q.months_detail || []).map((m: any) => ({ month: m.month, startsOn: m.starts_on, rate: m.rate, supply: m.supply })),
    },
  };
}

export async function createAdOrder(input: {
  lawyerId: string;
  productId: string;
  months: number;
  startsOn: string;
  region?: string;
  depositorName?: string;
}): Promise<RpcResult<AdOrder>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('create_ad_order', {
    p_lawyer_id: input.lawyerId,
    p_product_id: input.productId,
    p_months: input.months,
    p_starts_on: input.startsOn,
    p_region: input.region || null,
    p_depositor_name: input.depositorName || null,
  });
  if (error) return { ok: false, code: error.code || 'create_failed', message: adError(error) };
  return { ok: true, data: rowToAdOrder(data) };
}

/** 내가 볼 수 있는 주문 (RLS: 본인·사무소 권한·관리자) */
export async function fetchAdOrders(limit = 500): Promise<RpcResult<AdOrder[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('ad_orders').select('*').order('requested_at', { ascending: false }).limit(limit);
  if (error) return { ok: false, code: 'load_failed', message: adError(error) };
  return { ok: true, data: (data || []).map(rowToAdOrder) };
}

export async function adminConfirmAdPayment(orderId: string, paidOn?: string): Promise<RpcResult<AdOrder>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_confirm_ad_payment', { p_order_id: orderId, p_paid_on: paidOn || null });
  if (error) return { ok: false, code: error.code || 'confirm_failed', message: adError(error) };
  return { ok: true, data: rowToAdOrder(data) };
}

export async function adminCancelAdOrder(orderId: string, reason: string, refundAmount?: number | null): Promise<RpcResult<AdOrder>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_cancel_ad_order', {
    p_order_id: orderId,
    p_reason: reason,
    p_refund_amount: refundAmount ?? null,
  });
  if (error) return { ok: false, code: error.code || 'cancel_failed', message: adError(error) };
  return { ok: true, data: rowToAdOrder(data) };
}

// ── AD-7·AD-8 신청 취소·연장·환불 요청 ─────────────────────────────────────────
export interface AdRefundQuote { rule: 'before_start' | 'prorated' | 'none'; amount: number; total: number; days: number | null; daysLeft: number | null }
export interface AdOrderRequest {
  id: string; orderId: string; officeId: string; reason: string; suggestedRefund: number;
  status: 'open' | 'approved' | 'rejected' | 'withdrawn'; requestedAt: string; resolvedAt?: string; resolveNote?: string; refundAmount?: number;
}
function rowToRequest(r: any): AdOrderRequest {
  return {
    id: r.id, orderId: r.order_id, officeId: r.office_id, reason: r.reason || '', suggestedRefund: Number(r.suggested_refund) || 0,
    status: r.status, requestedAt: r.requested_at, resolvedAt: r.resolved_at || undefined, resolveNote: r.resolve_note || undefined,
    refundAmount: r.refund_amount ?? undefined,
  };
}

/** 변호사: 입금 전 신청 취소 */
export async function cancelMyAdOrder(orderId: string): Promise<RpcResult<AdOrder>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('ad_cancel_my_order', { p_order_id: orderId });
  if (error) return { ok: false, code: error.code || 'cancel_failed', message: adError(error) };
  return { ok: true, data: rowToAdOrder(data) };
}

/** 환불 예상액 (AD-Q4: 시작 전 전액, 노출 중 남은 날 일할) */
export async function quoteAdRefund(orderId: string): Promise<RpcResult<AdRefundQuote>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('ad_refund_quote', { p_order_id: orderId });
  if (error) return { ok: false, code: error.code || 'quote_failed', message: adError(error) };
  const q = data as any;
  return { ok: true, data: { rule: q.rule, amount: Number(q.amount) || 0, total: Number(q.total) || 0, days: q.days ?? null, daysLeft: q.days_left ?? null } };
}

export async function requestAdRefund(orderId: string, reason: string): Promise<RpcResult<AdOrderRequest>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('ad_request_refund', { p_order_id: orderId, p_reason: reason });
  if (error) return { ok: false, code: error.code || 'request_failed', message: adError(error) };
  return { ok: true, data: rowToRequest(data) };
}

export async function withdrawAdRefundRequest(requestId: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('ad_withdraw_refund_request', { p_request_id: requestId });
  if (error) return { ok: false, code: error.code || 'withdraw_failed', message: adError(error) };
  return { ok: true, data: null };
}

/** 변호사: 끝나는 날부터 같은 상품·지역으로 연장 신청 (새 주문) */
export async function renewAdOrder(orderId: string, months: number, depositorName?: string): Promise<RpcResult<AdOrder>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('ad_renew_order', { p_order_id: orderId, p_months: months, p_depositor_name: depositorName?.trim() || null });
  if (error) return { ok: false, code: error.code || 'renew_failed', message: adError(error) };
  return { ok: true, data: rowToAdOrder(data) };
}

/** 환불 요청 목록 (RLS: 사무소 ads.manage·billing.view, 관리자) */
export async function fetchAdOrderRequests(onlyOpen = false): Promise<RpcResult<AdOrderRequest[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  let q = supabase.from('ad_order_requests').select('*').order('requested_at', { ascending: false }).limit(300);
  if (onlyOpen) q = q.eq('status', 'open');
  const { data, error } = await q;
  if (error) return { ok: false, code: error.code || 'load_failed', message: adError(error) };
  return { ok: true, data: (data || []).map(rowToRequest) };
}

/** 관리자: 환불 요청 승인(주문 취소 + 환불액) / 반려(사유 필수) */
export async function adminResolveAdRequest(requestId: string, decision: 'approve' | 'reject', refundAmount?: number | null, note?: string): Promise<RpcResult<AdOrderRequest>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_resolve_ad_request', {
    p_request_id: requestId, p_decision: decision, p_refund_amount: refundAmount ?? null, p_note: note?.trim() || null,
  });
  if (error) return { ok: false, code: error.code || 'resolve_failed', message: adError(error) };
  return { ok: true, data: rowToRequest(data) };
}

/** 관리자: 입금 기한 지난 예약 취소·시작·만료를 바로 실행 (매일 자동 실행과 같은 함수) */
export async function adminRunAdLifecycle(): Promise<RpcResult<{ cancelled: number; started: number; expired: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('run_ad_order_lifecycle');
  if (error) return { ok: false, code: 'lifecycle_failed', message: adError(error) };
  return { ok: true, data: data as any };
}

/** 관리자: 세금계산서 발행 기록 저장 (발행 자체는 /api/popbill) */
export async function adminSaveAdOrderInvoice(orderId: string, patch: { taxInvoice?: AdOrder['taxInvoice'] | null; modifiedTaxInvoice?: AdOrder['modifiedTaxInvoice'] | null }): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row: Record<string, unknown> = {};
  if (patch.taxInvoice !== undefined) row.tax_invoice = patch.taxInvoice;
  if (patch.modifiedTaxInvoice !== undefined) row.modified_tax_invoice = patch.modifiedTaxInvoice;
  const { data, error } = await supabase.from('ad_orders').update(row).eq('id', orderId).select('id');
  if (error) return { ok: false, code: 'save_failed', message: adError(error) };
  if (!data || data.length === 0) return { ok: false, code: 'not_found', message: '주문을 찾지 못했거나 권한이 없어요.' };
  return { ok: true, data: null };
}

export async function fetchBillingProfile(officeId: string): Promise<RpcResult<OfficeBillingProfile | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('office_billing_profiles').select('*').eq('office_id', officeId).maybeSingle();
  if (error) return { ok: false, code: 'load_failed', message: adError(error) };
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      officeId: data.office_id,
      corpNum: data.corp_num || undefined,
      corpName: data.corp_name || undefined,
      ceoName: data.ceo_name || undefined,
      address: data.address || undefined,
      bizType: data.biz_type || undefined,
      bizClass: data.biz_class || undefined,
      email: data.email || undefined,
      email2: data.email2 || undefined,
      contactName: data.contact_name || undefined,
      contactPhone: data.contact_phone || undefined,
      updatedAt: data.updated_at || undefined,
    },
  };
}

export async function saveBillingProfile(p: OfficeBillingProfile): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const blank = (v?: string) => (v && v.trim() ? v.trim() : null);
  const { error } = await supabase.from('office_billing_profiles').upsert({
    office_id: p.officeId,
    corp_num: blank(p.corpNum?.replace(/[^0-9]/g, '')),
    corp_name: blank(p.corpName),
    ceo_name: blank(p.ceoName),
    address: blank(p.address),
    biz_type: blank(p.bizType),
    biz_class: blank(p.bizClass),
    email: blank(p.email),
    email2: blank(p.email2),
    contact_name: blank(p.contactName),
    contact_phone: blank(p.contactPhone),
  }, { onConflict: 'office_id' });
  if (error) {
    if (/check constraint|violates check/i.test(error.message || '')) {
      return { ok: false, code: 'invalid', message: '입력값 형식을 확인해 주세요. (사업자번호 10자리, 이메일 형식)' };
    }
    return { ok: false, code: 'save_failed', message: adError(error) };
  }
  return { ok: true, data: null };
}

/** 고객 사이트: 지금 노출 중인 광고 (금액 없음) */
export async function fetchActivePlacements(): Promise<RpcResult<ActivePlacement[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('public_active_ad_placements');
  if (error) return { ok: false, code: 'load_failed', message: adError(error) };
  return { ok: true, data: (data || []).map((r: any) => ({ lawyerId: r.lawyer_id, placement: r.placement, region: r.region || undefined, endsOn: r.ends_on })) };
}

export const AD_STATUS_LABEL: Record<string, string> = {
  pending: '입금 대기',
  paid: '시작 예정',
  active: '노출 중',
  expired: '기간 끝남',
  cancelled: '취소',
};
