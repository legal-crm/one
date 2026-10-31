// ============================================================
// 거래처(광고대행사) 관리 (SL-15~17) — 리드를 보내 주는 쪽. 대행사 계정·열람 없음
// 계약 방식: 월 정액 / 매체비 + 수수료 / 리드 건당 단가 / 혼합. 성과(수임·계약·입금) 연동 지급은 없음 (SL-Q8)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';

export type VendorContractType = 'monthly_fixed' | 'media_plus_fee' | 'per_lead' | 'mixed';
export const VENDOR_CONTRACT_LABEL: Record<VendorContractType, string> = {
  monthly_fixed: '월 정액 대행료',
  media_plus_fee: '매체비 + 대행 수수료(%)',
  per_lead: '리드 건당 단가',
  mixed: '혼합',
};
export const PER_LEAD_NOTICE = '[운영자 판단] 리드 건당으로 대행사에 돈을 주는 계약은 변호사법 제34조(소개·알선 대가) 문제가 될 수 있어요. 광고 대행 용역(정액·매체비 기준)으로 계약하는 방식이 덜 위험해요.';

export const REPLACEMENT_REASON_OPTIONS = [
  { key: 'wrong_number', label: '결번·잘못된 번호' },
  { key: 'duplicate', label: '중복' },
  { key: 'not_self', label: '본인 아님' },
  { key: 'false_info', label: '허위 정보' },
  { key: 'opt_out', label: '수신 거부' },
] as const;

export interface SalesVendor {
  id: string;
  name: string;
  bizNo?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contractStart?: string;
  contractEnd?: string;
  status: 'active' | 'ended';
  contractType: VendorContractType;
  monthlyFee?: number;
  feePercent?: number;
  perLeadPrice?: number;
  perLeadAckAt?: string;
  collectionMode: 'entrusted' | 'third_party';
  consentVersion?: string;
  consentText?: string;
  consentNamesOffice: boolean;
  privacyPolicyChecked: boolean;
  replacementDays: number;
  replacementReasons: string[];
  memo?: string;
}

const toVendor = (r: any): SalesVendor => ({
  id: r.id, name: r.name, bizNo: r.biz_no || undefined, contactName: r.contact_name || undefined, contactPhone: r.contact_phone || undefined,
  contactEmail: r.contact_email || undefined, contractStart: r.contract_start || undefined, contractEnd: r.contract_end || undefined,
  status: r.status, contractType: r.contract_type, monthlyFee: r.monthly_fee ?? undefined, feePercent: r.fee_percent != null ? Number(r.fee_percent) : undefined,
  perLeadPrice: r.per_lead_price ?? undefined, perLeadAckAt: r.per_lead_ack_at || undefined, collectionMode: r.collection_mode,
  consentVersion: r.consent_version || undefined, consentText: r.consent_text || undefined, consentNamesOffice: !!r.consent_names_office,
  privacyPolicyChecked: !!r.privacy_policy_checked, replacementDays: r.replacement_days ?? 7, replacementReasons: r.replacement_reasons || [], memo: r.memo || undefined,
});

const blank = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : null);

let cache: SalesVendor[] = [];
const listeners = new Set<() => void>();
export const getCachedVendors = () => cache;
export function subscribeVendors(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export async function listVendors(officeId: string): Promise<RpcResult<SalesVendor[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('sales_vendors').select('*').eq('office_id', officeId).order('name');
  if (error) return toRpcError(error);
  cache = (data || []).map(toVendor);
  listeners.forEach(fn => fn());
  return { ok: true, data: cache };
}

export async function saveVendor(officeId: string, v: Partial<SalesVendor> & { name: string }): Promise<RpcResult<SalesVendor>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row = {
    office_id: officeId, name: v.name.trim(), biz_no: blank(v.bizNo), contact_name: blank(v.contactName), contact_phone: blank(v.contactPhone),
    contact_email: blank(v.contactEmail), contract_start: v.contractStart || null, contract_end: v.contractEnd || null, status: v.status || 'active',
    contract_type: v.contractType || 'monthly_fixed', monthly_fee: v.monthlyFee ?? null, fee_percent: v.feePercent ?? null, per_lead_price: v.perLeadPrice ?? null,
    per_lead_ack_at: v.perLeadAckAt || null, collection_mode: v.collectionMode || 'entrusted', consent_version: blank(v.consentVersion), consent_text: blank(v.consentText),
    consent_names_office: !!v.consentNamesOffice, privacy_policy_checked: !!v.privacyPolicyChecked, replacement_days: v.replacementDays ?? 7,
    replacement_reasons: v.replacementReasons && v.replacementReasons.length ? v.replacementReasons : REPLACEMENT_REASON_OPTIONS.map(o => o.key), memo: blank(v.memo),
  };
  const q = v.id ? supabase.from('sales_vendors').update(row).eq('id', v.id).select('*').single() : supabase.from('sales_vendors').insert(row).select('*').single();
  const { data, error } = await q;
  if (error) return toRpcError(error);
  void listVendors(officeId);
  return { ok: true, data: toVendor(data) };
}

export async function deleteVendor(officeId: string, id: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('sales_vendors').delete().eq('id', id);
  if (error) return toRpcError(error);
  void listVendors(officeId);
  return { ok: true, data: true };
}

export async function setSourceVendor(sourceId: string, vendorId: string | null): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_sales_source_vendor', { p_source_id: sourceId, p_vendor_id: vendorId });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 불량 리드 교체 ──
export interface ReplacementCandidate { leadId: string; vendorLeadRef?: string; phoneLast4?: string; reason: string; receivedAt: string; closedAt: string }
export interface Replacement { id: string; leadId: string; vendorLeadRef?: string; phoneLast4?: string; reason: string; leadReceivedAt?: string; status: 'requested' | 'replaced' | 'refused' | 'refunded'; requestedAt: string; resolvedAt?: string; note?: string }
const toRep = (r: any): Replacement => ({ id: r.id, leadId: r.lead_id, vendorLeadRef: r.vendor_lead_ref || undefined, phoneLast4: r.phone_last4 || undefined, reason: r.reason, leadReceivedAt: r.lead_received_at || undefined, status: r.status, requestedAt: r.requested_at, resolvedAt: r.resolved_at || undefined, note: r.note || undefined });

export async function listReplacementCandidates(vendorId: string): Promise<RpcResult<ReplacementCandidate[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('sales_vendor_replacement_candidates', { p_vendor_id: vendorId });
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ leadId: r.lead_id, vendorLeadRef: r.vendor_lead_ref || undefined, phoneLast4: r.phone_last4 || undefined, reason: r.reason, receivedAt: r.received_at, closedAt: r.closed_at })) };
}
export async function listReplacements(vendorId: string): Promise<RpcResult<Replacement[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('sales_vendor_replacements').select('*').eq('vendor_id', vendorId).order('requested_at', { ascending: false }).limit(500);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toRep) };
}
export async function requestReplacements(vendorId: string, leadIds: string[]): Promise<RpcResult<Replacement[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('request_sales_vendor_replacements', { p_vendor_id: vendorId, p_lead_ids: leadIds });
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(toRep) };
}
export async function setReplacementResult(id: string, status: Replacement['status'], note?: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_sales_vendor_replacement_result', { p_id: id, p_status: status, p_note: note || null });
  return error ? toRpcError(error) : { ok: true, data: true };
}

/** 대행사에 보낼 교체 요청 파일 (이름·전화번호 없음: 대행사 리드 번호·접수 일시·사유, 번호가 없으면 끝 4자리) */
export function replacementCsv(rows: Replacement[], reasonLabel: (k: string) => string): string {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['대행사 리드 번호', '접수 일시', '사유', '전화번호 끝 4자리'].map(esc).join(',')];
  for (const r of rows) {
    lines.push([r.vendorLeadRef || '', r.leadReceivedAt ? new Date(r.leadReceivedAt).toLocaleString('ko-KR') : '', reasonLabel(r.reason), r.vendorLeadRef ? '' : (r.phoneLast4 || '')].map(esc).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

// ── 월 청구·지급 ──
export interface VendorBilling { id?: string; vendorId: string; month: string; mediaCost: number; feeAmount: number; otherAmount: number; invoiceNo?: string; paidOn?: string; memo?: string }
export async function listBillings(vendorId: string): Promise<RpcResult<VendorBilling[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('sales_vendor_billings').select('*').eq('vendor_id', vendorId).order('month', { ascending: false }).limit(36);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map((r: any) => ({ id: r.id, vendorId: r.vendor_id, month: r.month, mediaCost: r.media_cost, feeAmount: r.fee_amount, otherAmount: r.other_amount, invoiceNo: r.invoice_no || undefined, paidOn: r.paid_on || undefined, memo: r.memo || undefined })) };
}
export async function saveBilling(officeId: string, b: VendorBilling): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row = { office_id: officeId, vendor_id: b.vendorId, month: b.month, media_cost: Math.max(0, Math.round(b.mediaCost || 0)), fee_amount: Math.max(0, Math.round(b.feeAmount || 0)), other_amount: Math.max(0, Math.round(b.otherAmount || 0)), invoice_no: blank(b.invoiceNo), paid_on: b.paidOn || null, memo: blank(b.memo) };
  const { error } = await supabase.from('sales_vendor_billings').upsert(row, { onConflict: 'vendor_id,month' });
  return error ? toRpcError(error) : { ok: true, data: true };
}

// ── 통계 (SL-11·SL-17) ──
export interface FunnelRow { kind: 'source' | 'vendor'; key: string; leads: number; valid: number; connected: number; counseled: number; converted: number; firstContactMin: number | null; reasons: Record<string, number>; cost: number | null; perLeadPrice: number | null }
export async function loadFunnelStats(officeId: string, from: string, to: string): Promise<RpcResult<FunnelRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('sales_funnel_stats', { p_office_id: officeId, p_from: from, p_to: to });
  if (error) return toRpcError(error);
  return { ok: true, data: ((data as any)?.rows || []).map((r: any) => ({ kind: r.kind, key: r.key, leads: r.leads, valid: r.valid, connected: r.connected, counseled: r.counseled, converted: r.converted, firstContactMin: r.first_contact_min ?? null, reasons: r.reasons || {}, cost: r.cost ?? null, perLeadPrice: r.per_lead_price ?? null })) };
}
