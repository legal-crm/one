// ============================================================
// AI 검색 인용 점검 (M-5, 20261101005400)
// 질문 관리 = geo_target_questions (관리자 RLS), 결과 = admin_geo_overview(),
// '지금 점검' = /api/generate-statement {mode:'geo-check'} (관리자 2단계 인증, 한 번에 최대 5개)
// 정기 점검은 서버가 매주 월요일 아침에 한다 (pg_cron → pg_net)
// ============================================================
import { supabase, isSupabaseConfigured, getAuthHeaders } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export interface GeoSource { domain: string; title?: string }
export interface GeoCheck {
  checked_at: string; model?: string | null; ok: boolean; cited: boolean; cited_rank?: number | null;
  source_count: number; sources: GeoSource[]; answer_excerpt?: string | null; error?: string | null; trigger_kind: 'cron' | 'manual';
}
export interface GeoQuestion {
  id: string; question: string; target_path?: string | null; note?: string | null; active: boolean; sort_order: number;
  last?: GeoCheck | null; cited_8w: number; checked_8w: number;
}
export interface GeoOverview { questions: GeoQuestion[]; weekly: Array<{ week: string; checked: number; cited: number }> }

export async function loadGeoOverview(): Promise<RpcResult<GeoOverview>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_geo_overview');
  if (error) return toRpcError(error);
  const d = (data || {}) as any;
  return { ok: true, data: { questions: Array.isArray(d.questions) ? d.questions : [], weekly: Array.isArray(d.weekly) ? d.weekly : [] } };
}

const cleanPath = (p: string) => {
  const t = p.trim();
  if (!t) return null;
  try { if (/^https?:\/\//i.test(t)) return new URL(t).pathname || '/'; } catch { /* 아래 */ }
  return t.startsWith('/') ? t : `/${t}`;
};

export function validateQuestion(q: string, path: string): string | null {
  const t = q.trim();
  if (t.length < 5 || t.length > 200) return '질문은 5~200자로 적어 주세요.';
  const p = cleanPath(path);
  if (p && (/\s/.test(p) || p.length > 200)) return '목표 페이지 주소를 확인해 주세요. 예: /guide/rehabilitation-cost.html';
  return null;
}

export async function saveGeoQuestion(input: { id?: string; question: string; targetPath: string; note?: string; active?: boolean }): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row = { question: input.question.trim(), target_path: cleanPath(input.targetPath), note: input.note?.trim() || null, active: input.active ?? true };
  const q = input.id ? supabase.from('geo_target_questions').update(row).eq('id', input.id) : supabase.from('geo_target_questions').insert(row);
  const { error } = await q;
  if (error) {
    if (/at most 50 active/i.test(error.message)) return { ok: false, code: 'limit', message: '점검 질문은 50개까지 켜 둘 수 있어요. 쓰지 않는 질문을 꺼 주세요.' };
    if (/duplicate key|unique/i.test(error.message)) return { ok: false, code: 'dup', message: '같은 질문이 이미 있어요.' };
    return toRpcError(error);
  }
  return { ok: true, data: null };
}

export async function deleteGeoQuestion(id: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('geo_target_questions').delete().eq('id', id);
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

/** 지금 점검 (questionId가 있으면 그 질문만, 없으면 6일 넘게 점검하지 않은 질문 최대 5개) */
export async function runGeoCheckNow(questionId?: string): Promise<RpcResult<{ checked: number; cited: number; failed: number }>> {
  try {
    const res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'geo-check', questionId: questionId || undefined }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, code: String(res.status), message: j?.error || `점검을 시작하지 못했어요 (${res.status}).` };
    const results: Array<{ ok: boolean; cited: boolean }> = j.results || [];
    return { ok: true, data: { checked: results.length, cited: results.filter(r => r.ok && r.cited).length, failed: results.filter(r => !r.ok).length } };
  } catch {
    return { ok: false, code: 'network', message: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.' };
  }
}

/** 최근 8주 인용률(%) — 점검 기록이 없으면 null */
export function citationRate(q: Pick<GeoQuestion, 'cited_8w' | 'checked_8w'>): number | null {
  return q.checked_8w > 0 ? Math.round((q.cited_8w / q.checked_8w) * 100) : null;
}
