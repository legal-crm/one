import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { CertCategory, CertMethod, CertSource, CertStatus, DebtCertificate, Tri } from './debtLedgerRules';

// ============================================================
// 부채증명 장부 서버 서비스 (DC-2, 20261031001800)
// 사건 × 채권자 줄을 서버에 둔다. 브라우저 저장은 하지 않는다(예전 debt_cert_order_* 는 처음 열 때 옮기고 지운다).
// ============================================================

type R<T> = { ok: true; data: T } | { ok: false; message: string };

function msg(error: any, fallback: string): string {
  const m = String(error?.message || '');
  if (m.includes('base date required')) return '값을 확인하려면 증명서의 산정기준일을 넣어 주세요.';
  if (m.includes('unavailable reason required')) return '발급이 안 되는 사유를 골라 주세요.';
  if (m.includes('row-level security') || m.includes('not allowed')) return '이 사건의 부채증명을 다룰 권한이 없어요.';
  if (m.includes('certificate not in this case')) return '이 사건의 채권자 줄만 의뢰에 넣을 수 있어요.';
  return fallback;
}

const mapCert = (r: any): DebtCertificate => ({
  id: r.id, seq: r.seq, creditorName: r.creditor_name, branch: r.branch || undefined, source: r.source, method: r.method, status: r.status,
  requestedOn: r.requested_on || undefined, expectedOn: r.expected_on || undefined, receivedOn: r.received_on || undefined,
  unavailableReason: r.unavailable_reason || undefined, altProof: r.alt_proof || undefined, docType: r.doc_type || '부채증명서',
  values: r.values && typeof r.values === 'object' ? r.values : {}, category: r.category,
  attrs: { guarantee: (r.attrs?.guarantee || 'unknown') as Tri, futureIndemnity: (r.attrs?.futureIndemnity || 'unknown') as Tri, secured: (r.attrs?.secured || 'unknown') as Tri },
  claimedPrincipal: r.claimed_principal ?? undefined, fileIds: r.file_ids || [], appliedCreditorId: r.applied_creditor_id || undefined,
  verifiedAt: r.verified_at || undefined, appliedAt: r.applied_at || undefined, note: r.note || undefined, version: r.version,
});

function certRow(c: Partial<DebtCertificate>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('seq' in c) row.seq = c.seq;
  if ('creditorName' in c) row.creditor_name = (c.creditorName || '').trim().slice(0, 120);
  if ('branch' in c) row.branch = c.branch || null;
  if ('source' in c) row.source = c.source;
  if ('method' in c) row.method = c.method;
  if ('status' in c) row.status = c.status;
  if ('requestedOn' in c) row.requested_on = c.requestedOn || null;
  if ('expectedOn' in c) row.expected_on = c.expectedOn || null;
  if ('receivedOn' in c) row.received_on = c.receivedOn || null;
  if ('unavailableReason' in c) row.unavailable_reason = c.unavailableReason || null;
  if ('altProof' in c) row.alt_proof = c.altProof || null;
  if ('docType' in c) row.doc_type = c.docType || '부채증명서';
  if ('values' in c) row.values = c.values || {};
  if ('category' in c) row.category = c.category;
  if ('attrs' in c) row.attrs = c.attrs;
  if ('claimedPrincipal' in c) row.claimed_principal = Number.isFinite(c.claimedPrincipal) ? Math.round(c.claimedPrincipal as number) : null;
  if ('fileIds' in c) row.file_ids = c.fileIds || [];
  if ('appliedCreditorId' in c) row.applied_creditor_id = c.appliedCreditorId || null;
  if ('note' in c) row.note = c.note || null;
  return row;
}

export const DEBT_LEDGER_CHANGED_EVENT = 'mykim:debt-ledger-changed';
const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEBT_LEDGER_CHANGED_EVENT)); };

export async function loadDebtLedger(officeId: string, caseKey: string): Promise<R<DebtCertificate[]>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.from('debt_certificates').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('seq', { ascending: true });
  if (error) return { ok: false, message: msg(error, '부채증명 장부를 불러오지 못했어요.') };
  return { ok: true, data: (data || []).map(mapCert) };
}

export interface NewCertInput { creditorName: string; seq: number; source?: CertSource; method?: CertMethod; claimedPrincipal?: number; category?: CertCategory; status?: CertStatus; branch?: string }

export async function addDebtCertificates(officeId: string, caseKey: string, rows: NewCertInput[]): Promise<R<DebtCertificate[]>> {
  if (rows.length === 0) return { ok: true, data: [] };
  const payload = rows.map(r => ({ ...certRow({ ...r, source: r.source || 'office', method: r.method || 'agency', category: r.category || 'general', status: r.status || 'pending' }), office_id: officeId, case_key: caseKey }));
  const { data, error } = await supabase.from('debt_certificates').insert(payload).select('*');
  if (error) return { ok: false, message: msg(error, '채권자 줄을 추가하지 못했어요.') };
  notify();
  return { ok: true, data: (data || []).map(mapCert) };
}

export async function updateDebtCertificate(id: string, patch: Partial<DebtCertificate>): Promise<R<DebtCertificate>> {
  const { data, error } = await supabase.from('debt_certificates').update(certRow(patch)).eq('id', id).select('*').single();
  if (error) return { ok: false, message: msg(error, '저장하지 못했어요.') };
  notify();
  return { ok: true, data: mapCert(data) };
}

export async function deleteDebtCertificate(id: string): Promise<R<true>> {
  const { error, count } = await supabase.from('debt_certificates').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: msg(error, '요청 전·요청함 상태의 줄만 지울 수 있어요.') };
  notify();
  return { ok: true, data: true };
}

// ── 대행사 ──
export interface DebtAgency { id: string; name: string; phone?: string; email?: string; feePer?: number; issueFeePer?: number; avgBusinessDays: number; showAmountsToClient: boolean }
export async function loadDebtAgencies(officeId: string): Promise<DebtAgency[]> {
  const { data } = await supabase.from('office_debt_agencies').select('*').eq('office_id', officeId).order('name');
  return (data || []).map((r: any) => ({ id: r.id, name: r.name, phone: r.phone || undefined, email: r.email || undefined, feePer: r.fee_per ?? undefined, issueFeePer: r.issue_fee_per ?? undefined, avgBusinessDays: r.avg_business_days || 7, showAmountsToClient: !!r.show_amounts_to_client }));
}
export async function saveDebtAgency(officeId: string, a: Omit<DebtAgency, 'id'> & { id?: string }): Promise<R<DebtAgency>> {
  const row = { office_id: officeId, name: a.name.trim().slice(0, 80), phone: a.phone || null, email: a.email || null, fee_per: a.feePer ?? null, issue_fee_per: a.issueFeePer ?? null, avg_business_days: a.avgBusinessDays || 7, show_amounts_to_client: !!a.showAmountsToClient };
  const q = a.id ? supabase.from('office_debt_agencies').update(row).eq('id', a.id).select('*').single() : supabase.from('office_debt_agencies').insert(row).select('*').single();
  const { data, error } = await q;
  if (error) return { ok: false, message: /row-level/.test(error.message) ? '대행사 설정은 사무소 설정 권한이 있어야 바꿀 수 있어요.' : /duplicate/.test(error.message) ? '같은 이름의 대행사가 있어요.' : '대행사를 저장하지 못했어요.' };
  const r: any = data;
  return { ok: true, data: { id: r.id, name: r.name, phone: r.phone || undefined, email: r.email || undefined, feePer: r.fee_per ?? undefined, issueFeePer: r.issue_fee_per ?? undefined, avgBusinessDays: r.avg_business_days, showAmountsToClient: !!r.show_amounts_to_client } };
}

export interface AgencyOrder { id: string; agencyName: string; sentOn: string; method: string; certificateIds: string[]; agencyFee?: number; issueFee?: number; repliedOn?: string; note?: string }
export async function loadAgencyOrders(officeId: string, caseKey: string): Promise<AgencyOrder[]> {
  const { data } = await supabase.from('debt_agency_orders').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('sent_on', { ascending: false });
  return (data || []).map((r: any) => ({ id: r.id, agencyName: r.agency_name, sentOn: r.sent_on, method: r.method, certificateIds: r.certificate_ids || [], agencyFee: r.agency_fee ?? undefined, issueFee: r.issue_fee ?? undefined, repliedOn: r.replied_on || undefined, note: r.note || undefined }));
}
export async function recordAgencyOrder(officeId: string, caseKey: string, o: Omit<AgencyOrder, 'id'>): Promise<R<AgencyOrder>> {
  const { data, error } = await supabase.from('debt_agency_orders').insert({
    office_id: officeId, case_key: caseKey, agency_name: o.agencyName, sent_on: o.sentOn, method: o.method, certificate_ids: o.certificateIds,
    agency_fee: o.agencyFee ?? null, issue_fee: o.issueFee ?? null, note: o.note || null,
  }).select('*').single();
  if (error) return { ok: false, message: msg(error, '의뢰 기록을 저장하지 못했어요.') };
  notify();
  const r: any = data;
  return { ok: true, data: { id: r.id, agencyName: r.agency_name, sentOn: r.sent_on, method: r.method, certificateIds: r.certificate_ids || [], agencyFee: r.agency_fee ?? undefined, issueFee: r.issue_fee ?? undefined } };
}
export async function markAgencyReplied(id: string, repliedOn: string): Promise<boolean> {
  const { error } = await supabase.from('debt_agency_orders').update({ replied_on: repliedOn }).eq('id', id);
  return !error;
}

// ── 의뢰인 진행 (DC-10, 금액은 사무소가 켠 경우만) ──
export interface ClientDebtProgress { total: number; received: number; unavailable: number; items: Array<{ name: string; received: boolean; unavailable: boolean; principal?: number }> }
export async function loadClientDebtProgress(caseKey: string): Promise<ClientDebtProgress | null> {
  const { data, error } = await supabase.rpc('client_debt_cert_progress', { p_case_key: caseKey });
  if (error || !data) return null;
  const d = data as any;
  return { total: Number(d.total) || 0, received: Number(d.received) || 0, unavailable: Number(d.unavailable) || 0, items: Array.isArray(d.items) ? d.items : [] };
}

// ── 예전 브라우저 저장분 옮기기 (debt_cert_order_<사건>) ──
export async function migrateLegacyDebtOrder(officeId: string, caseKey: string, existingCount: number): Promise<number> {
  if (typeof window === 'undefined') return 0;
  const key = `debt_cert_order_${caseKey}`;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(key); } catch { return 0; }
  if (!raw) return 0;
  try {
    const order = JSON.parse(raw);
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    if (existingCount === 0 && items.length) {
      const r = await addDebtCertificates(officeId, caseKey, items.filter(i => i?.creditorName).slice(0, 80).map((i, idx) => ({
        creditorName: String(i.creditorName), seq: idx + 1, source: 'client', method: 'agency',
        claimedPrincipal: Number(i.expectedPrincipal) || undefined, branch: i.branchName || undefined, status: order.orderStatus && order.orderStatus !== 'draft' ? 'requested' : 'pending',
      })));
      if (r.ok === false) return 0;
      window.localStorage.removeItem(key);
      return r.data.length;
    }
    window.localStorage.removeItem(key);
  } catch { /* 깨진 값은 그대로 둔다 */ }
  return 0;
}
