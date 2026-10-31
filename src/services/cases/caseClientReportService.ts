// ============================================================
// 인가 뒤 변동 알리기 (NF-9, 20261101005000)
// 의뢰인: client_report_case_change · 본인 기록 읽기 / 사무소: 사건 기록 읽기(case.view) · office_handle_case_client_report(case.edit)
// 판단 문구 없음 — 변경 신청이 필요한지는 변호사가 판단한다
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export type CaseChangeKind = 'moved' | 'job_change' | 'income_change' | 'family_change' | 'payment_trouble' | 'other';

export const CASE_CHANGE_LABEL: Record<CaseChangeKind, string> = {
  moved: '이사했어요',
  job_change: '직장이 바뀌었어요',
  income_change: '소득이 바뀌었어요',
  family_change: '가족 상황이 바뀌었어요',
  payment_trouble: '변제금 내기가 어려워요',
  other: '그 밖의 일',
};

export const CASE_CHANGE_HINT: Record<CaseChangeKind, string> = {
  moved: '새 주소로 옮긴 날짜를 적어 주세요. 주민등록번호는 적지 마세요.',
  job_change: '그만둔 날·새 직장에 들어간 날을 적어 주세요.',
  income_change: '바뀐 월 실수령액과 바뀐 때를 적어 주세요.',
  family_change: '결혼·이혼·출산·가족 사망 등 바뀐 내용과 날짜를 적어 주세요.',
  payment_trouble: '어떤 사정으로 언제부터 어려운지 적어 주세요.',
  other: '사무소에 알릴 내용을 적어 주세요.',
};

export interface CaseClientReport {
  id: string;
  caseKey: string;
  kind: CaseChangeKind;
  note?: string;
  status: 'open' | 'handled';
  handledAt?: string;
  handleNote?: string;
  createdAt: string;
}

const map = (r: any): CaseClientReport => ({
  id: r.id, caseKey: r.case_key, kind: r.kind, note: r.note || undefined, status: r.status,
  handledAt: r.handled_at || undefined, handleNote: r.handle_note || undefined, createdAt: r.created_at,
});

export const CASE_REPORTS_CHANGED_EVENT = 'mykim:case-reports-changed';
const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CASE_REPORTS_CHANGED_EVENT)); };

function friendly(e: { message?: string; code?: string } | null): RpcResult<never> {
  const m = e?.message || '';
  if (/too many open reports/i.test(m)) return { ok: false, code: 'limit', message: '아직 사무소가 확인하지 않은 알림이 5건 있어요. 확인된 뒤 다시 알려 주세요.' };
  if (/note required/i.test(m)) return { ok: false, code: 'note', message: '알릴 내용을 적어 주세요.' };
  return toRpcError(e);
}

/** 사건 기록 읽기 (의뢰인은 내 것만, 사무소는 사건 전체 — RLS) */
export async function loadCaseClientReports(caseKey: string): Promise<RpcResult<CaseClientReport[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('case_client_reports').select('*').eq('case_key', caseKey).order('created_at', { ascending: false }).limit(50);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []).map(map) };
}

export async function reportCaseChange(caseKey: string, kind: CaseChangeKind, note: string): Promise<RpcResult<CaseClientReport>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('client_report_case_change', { p_case_key: caseKey, p_kind: kind, p_note: note.trim() || null });
  if (error) return friendly(error);
  notify();
  return { ok: true, data: map(data) };
}

export async function handleCaseClientReport(id: string, note: string): Promise<RpcResult<CaseClientReport>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_handle_case_client_report', { p_id: id, p_note: note.trim() || null });
  if (error) return friendly(error);
  notify();
  return { ok: true, data: map(data) };
}
