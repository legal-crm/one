// ============================================================
// 공용 채권자 정보 (NF-5, 20261101001900_creditor_registry)
// 서버 creditor_registry를 읽어 채권자 목록(creditorAddressDirectory)에 넣는다.
// 사무소는 '수정 제안'만, 반영은 통합어드민 확인 뒤. 개인 채권자는 넣지 않는다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';
import { setCreditorDirectory, type CreditorDirectoryItem } from './creditorAddressDirectory';

export interface CreditorRegistryRow {
  id: string;
  official_name: string;
  aliases: string[];
  category: CreditorDirectoryItem['category'] | 'INSURANCE' | 'MUTUAL' | 'OTHER';
  category_label: string;
  representative: string;
  biz_number: string;
  zip_code: string;
  address: string;
  service_address: string;
  phone: string;
  fax: string;
  cert_desk: string;
  is_priority_default: boolean;
  source: string;
  verified_on: string | null;
  version: number;
  is_active: boolean;
  updated_at: string;
}

export function rowToDirectoryItem(r: CreditorRegistryRow): CreditorDirectoryItem {
  return {
    id: r.id,
    officialName: r.official_name,
    alias: Array.isArray(r.aliases) ? r.aliases : [],
    category: (['BANK', 'CARD', 'CAPITAL', 'SAVINGS_BANK', 'LOAN_NPL', 'PUBLIC_AGENCY'].includes(r.category) ? r.category : 'LOAN_NPL') as CreditorDirectoryItem['category'],
    categoryLabel: r.category_label || '',
    representative: r.representative || '',
    bizNumber: r.biz_number || '',
    zipCode: r.zip_code || '',
    address: r.address || '',
    serviceAddress: r.service_address || '',
    phone: r.phone || undefined,
    isPriorityDefault: !!r.is_priority_default,
    fax: r.fax || undefined,
    certDesk: r.cert_desk || undefined,
    source: r.source || undefined,
    verifiedOn: r.verified_on,
    version: r.version,
  };
}

export const CREDITOR_FIELDS = 'id, official_name, aliases, category, category_label, representative, biz_number, zip_code, address, service_address, phone, fax, cert_desk, is_priority_default, source, verified_on, version, is_active, updated_at';

/** 서버 목록을 읽어 채권자 검색·자동 매칭에 넣는다 (실패하면 코드 초기 목록 그대로) */
export async function loadCreditorRegistry(): Promise<RpcResult<number>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('creditor_registry').select(CREDITOR_FIELDS).eq('is_active', true).order('official_name').limit(2000);
  if (error) return toRpcError(error);
  const rows = (data || []) as CreditorRegistryRow[];
  setCreditorDirectory(rows.map(rowToDirectoryItem));
  return { ok: true, data: rows.length };
}

/** 관리자 화면용: 비활성 포함 전체 */
export async function adminListCreditorRegistry(): Promise<RpcResult<CreditorRegistryRow[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('creditor_registry').select(CREDITOR_FIELDS).order('official_name').limit(2000);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []) as CreditorRegistryRow[] };
}

export type CreditorChanges = Partial<Pick<CreditorRegistryRow,
  'official_name' | 'aliases' | 'category' | 'category_label' | 'representative' | 'biz_number' | 'zip_code' | 'address' | 'service_address' | 'phone' | 'fax' | 'cert_desk' | 'is_priority_default' | 'source' | 'verified_on'>>;

export async function suggestCreditorChange(officeId: string, registryId: string | null, changes: CreditorChanges, note: string): Promise<RpcResult<string>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('suggest_creditor_registry_change', {
    p_office_id: officeId, p_registry_id: registryId, p_changes: changes, p_note: note,
  });
  if (error) {
    if (/pending suggestion exists/.test(error.message)) return { ok: false, code: 'pending', message: '이 채권자에 대해 확인을 기다리는 제안이 이미 있어요.' };
    if (/too many suggestions/.test(error.message)) return { ok: false, code: 'limit', message: '오늘은 제안을 더 보낼 수 없어요. 내일 다시 보내 주세요.' };
    if (/resident number/.test(error.message)) return { ok: false, code: 'rrn', message: '주민등록번호 형식은 넣을 수 없어요. 개인 채권자는 사건의 채권자 칸에만 적어 주세요.' };
    return toRpcError(error);
  }
  return { ok: true, data: String(data) };
}

export async function adminUpsertCreditor(id: string, values: CreditorChanges): Promise<RpcResult<number>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_upsert_creditor_registry', { p_id: id, p_values: values });
  if (error) return toRpcError(error);
  return { ok: true, data: Number(data) };
}

export async function adminSetCreditorActive(id: string, active: boolean): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('admin_set_creditor_active', { p_id: id, p_active: active });
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

export interface CreditorSuggestion {
  id: string;
  registry_id: string | null;
  office_name: string;
  changes: CreditorChanges;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  review_note: string;
  created_at: string;
  current: CreditorRegistryRow | null;
}

export async function adminListCreditorSuggestions(status: 'pending' | 'all' = 'pending'): Promise<RpcResult<CreditorSuggestion[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_list_creditor_suggestions', { p_status: status });
  if (error) return toRpcError(error);
  return { ok: true, data: (Array.isArray(data) ? data : []) as CreditorSuggestion[] };
}

export async function adminReviewCreditorSuggestion(id: string, accept: boolean, note: string, newId?: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('admin_review_creditor_suggestion', { p_id: id, p_accept: accept, p_note: note, p_new_id: newId ?? null });
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

/** 새 채권자 ID 만들기 (영문 소문자·숫자·밑줄) */
export function makeCreditorId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return `${base || 'creditor'}_${Date.now().toString(36)}`;
}

export const CREDITOR_FIELD_LABELS: Record<string, string> = {
  official_name: '정식 이름', aliases: '검색어', category: '분류', category_label: '분류 표시', representative: '대표자',
  biz_number: '사업자·법인번호', zip_code: '우편번호', address: '본점 주소', service_address: '송달 장소', phone: '대표 전화',
  fax: '팩스', cert_desk: '부채증명서 발급 창구', is_priority_default: '우선권 기본값', source: '출처', verified_on: '확인일',
};
