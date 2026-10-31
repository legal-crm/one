// ============================================================
// 영업 DB 설정 (SL-12) — 서버 sales_settings 가 원본, 화면은 메모리 사본을 동기 함수로 읽는다
// 유입 경로 목록 · 부재 재시도 규칙 · 통화 가능 시간 · 부재 문자 문구
// (이전: 브라우저 localStorage, 1차 상태 자유 목록·부재 알림 단계·거래처 수당·텔레그램은 삭제)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from '../office/rpcResult';
import { DEFAULT_SALES_RULES, type SalesRules } from './leadRules';

export interface SalesSettings {
  inboundPaths: string[];
  rules: SalesRules;
  noAnswerSms: string;
}

export const DEFAULT_INBOUND_PATHS = [
  '네이버 파워링크', '블로그/콘텐츠', '유튜브 채널', '메타(페이스북/인스타)', '지인 소개', '당근마켓', '카카오톡 채널', '랜딩 페이지', '기타',
];

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
  inboundPaths: DEFAULT_INBOUND_PATHS,
  rules: DEFAULT_SALES_RULES,
  noAnswerSms: '안녕하세요, {사무소}입니다. 남겨 주신 상담 문의로 연락드렸는데 통화가 어려우셨어요. 편하신 시간에 이 번호로 연락 주세요.',
};

let officeId = '';
let current: SalesSettings = DEFAULT_SALES_SETTINGS;
let version: number | null = null;
const listeners = new Set<() => void>();

function merge(data: any): SalesSettings {
  const d = data && typeof data === 'object' ? data : {};
  const rules = { ...DEFAULT_SALES_RULES, ...(d.rules || {}) } as SalesRules;
  if (!Array.isArray(rules.retrySteps) || rules.retrySteps.length === 0) rules.retrySteps = DEFAULT_SALES_RULES.retrySteps;
  return {
    inboundPaths: Array.isArray(d.inboundPaths) && d.inboundPaths.length ? d.inboundPaths.map(String).slice(0, 60) : DEFAULT_INBOUND_PATHS,
    rules,
    noAnswerSms: typeof d.noAnswerSms === 'string' ? d.noAnswerSms : DEFAULT_SALES_SETTINGS.noAnswerSms,
  };
}

export function getSalesSettings(): SalesSettings { return current; }
export function subscribeSalesSettings(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

/** 로그인한 사무소 기준으로 서버 설정을 읽는다 */
export async function loadSalesSettings(nextOfficeId: string): Promise<RpcResult<SalesSettings>> {
  officeId = nextOfficeId;
  if (!isSupabaseConfigured || !officeId) return { ok: true, data: current };
  const { data, error } = await supabase.from('sales_settings').select('data, version').eq('office_id', officeId).maybeSingle();
  if (error) return toRpcError(error);
  current = merge(data?.data);
  version = data?.version ?? null;
  emit();
  return { ok: true, data: current };
}

export async function saveSalesSettings(next: SalesSettings): Promise<RpcResult<SalesSettings>> {
  if (!isSupabaseConfigured) { current = next; emit(); return { ok: true, data: next }; }
  if (!officeId) return NOT_CONFIGURED;
  const clean = merge(next);
  const q = version === null
    ? supabase.from('sales_settings').insert({ office_id: officeId, data: clean }).select('version').single()
    : supabase.from('sales_settings').update({ data: clean }).eq('office_id', officeId).select('version').single();
  const { data, error } = await q;
  if (error) return toRpcError(error);
  version = data.version;
  current = clean;
  emit();
  return { ok: true, data: clean };
}

// ── 수신 거부 ──
export async function addSuppression(phone: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured || !officeId) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('add_sales_suppression', { p_office_id: officeId, p_phone: phone });
  return error ? toRpcError(error) : { ok: true, data: true };
}
export async function removeSuppression(phone: string): Promise<RpcResult<boolean>> {
  if (!isSupabaseConfigured || !officeId) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('remove_sales_suppression', { p_office_id: officeId, p_phone: phone });
  return error ? toRpcError(error) : { ok: true, data: data === true };
}
export async function isSuppressed(phone: string): Promise<boolean> {
  if (!isSupabaseConfigured || !officeId) return false;
  const { data } = await supabase.rpc('check_sales_phone_suppressed', { p_office_id: officeId, p_phone: phone });
  return data === true;
}
export async function countSuppression(): Promise<number | null> {
  if (!isSupabaseConfigured || !officeId) return null;
  const { count, error } = await supabase.from('sales_suppression').select('phone_hash', { count: 'exact', head: true }).eq('office_id', officeId);
  return error ? null : count ?? 0;
}
