// ============================================================
// 키워드 은행 (M-7, 20261101005500) — 목록·저장·추세 새로고침·다음 주제 제안
// 관리자만(RLS). 추세는 서버가 네이버 데이터랩에서 받아 저장 (mode 'mk-keyword-trend')
// 주제 제안 규칙(04 기획서 8장): 아직 다루지 않은 키워드 중 우선순위·검색량·오르는 추세·계절 메모, 최근 3주 안에 쓴 것은 뺌
// ============================================================
import { supabase, isSupabaseConfigured, getAuthHeaders } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export type KeywordIntent = 'info' | 'procedure' | 'cost' | 'compare' | 'urgent' | 'other';
export const INTENT_LABEL: Record<KeywordIntent, string> = {
  info: '알아보기', procedure: '절차', cost: '비용·금액', compare: '제도 비교', urgent: '급한 상황', other: '기타',
};

export interface TrendPoint { period: string; ratio: number }
export interface MarketingKeyword {
  id: string; keyword: string; cluster?: string | null; intent: KeywordIntent; target_path?: string | null;
  covered: boolean; priority: number; monthly_volume?: number | null; season_note?: string | null; note?: string | null;
  trend?: TrendPoint[] | null; trend_at?: string | null; last_used_on?: string | null; created_at: string; updated_at: string;
}

export async function loadKeywords(): Promise<RpcResult<MarketingKeyword[]>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('marketing_keywords').select('*').order('priority', { ascending: false }).order('keyword').limit(500);
  if (error) return toRpcError(error);
  return { ok: true, data: (data || []) as MarketingKeyword[] };
}

export type KeywordInput = Partial<Pick<MarketingKeyword, 'keyword' | 'cluster' | 'intent' | 'target_path' | 'covered' | 'priority' | 'monthly_volume' | 'season_note' | 'note' | 'last_used_on'>>;

export function validateKeyword(k: KeywordInput): string | null {
  const kw = (k.keyword || '').trim();
  if (kw.length < 2 || kw.length > 40) return '키워드는 2~40자로 적어 주세요.';
  if (k.target_path && !/^\/\S{0,199}$/.test(k.target_path.trim())) return '목표 페이지는 /guide/… 처럼 / 로 시작하는 주소로 적어 주세요.';
  if (k.monthly_volume != null && (!Number.isFinite(k.monthly_volume) || k.monthly_volume < 0)) return '월 검색량은 0 이상 숫자로 적어 주세요.';
  return null;
}

export async function saveKeyword(id: string | null, k: KeywordInput): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const row: Record<string, unknown> = { ...k };
  if (typeof row.keyword === 'string') row.keyword = (row.keyword as string).trim();
  if (typeof row.target_path === 'string') row.target_path = (row.target_path as string).trim() || null;
  const q = id ? supabase.from('marketing_keywords').update(row).eq('id', id) : supabase.from('marketing_keywords').insert(row);
  const { error } = await q;
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { ok: false, code: 'dup', message: '같은 키워드가 이미 있어요.' };
    if (/at most 500 keywords/i.test(error.message)) return { ok: false, code: 'limit', message: '키워드는 500개까지 둘 수 있어요.' };
    return toRpcError(error);
  }
  return { ok: true, data: null };
}

export async function deleteKeyword(id: string): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.from('marketing_keywords').delete().eq('id', id);
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

export async function refreshTrends(ids: string[]): Promise<RpcResult<{ updated: number; failed: number; error?: string | null }>> {
  try {
    const res = await fetch('/api/generate-statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ mode: 'mk-keyword-trend', ids: ids.slice(0, 10) }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, code: String(res.status), message: j?.error || `추세를 가져오지 못했어요 (${res.status}).` };
    return { ok: true, data: { updated: j.updated || 0, failed: j.failed || 0, error: j.error || null } };
  } catch {
    return { ok: false, code: 'network', message: '서버에 연결하지 못했어요.' };
  }
}

// ── 순수 계산 (시험 대상) ───────────────────────────────────

/** 최근 3개월 평균 vs 그 전 3개월 평균 → 오름/내림/비슷 (점이 6개 미만이면 모름) */
export function trendDirection(trend: TrendPoint[] | null | undefined): { dir: 'up' | 'down' | 'flat' | 'unknown'; change: number | null } {
  const t = (trend || []).filter(p => Number.isFinite(p.ratio));
  if (t.length < 6) return { dir: 'unknown', change: null };
  const avg = (a: TrendPoint[]) => a.reduce((s, p) => s + p.ratio, 0) / a.length;
  const recent = avg(t.slice(-3));
  const before = avg(t.slice(-6, -3));
  if (before <= 0) return { dir: recent > 0 ? 'up' : 'flat', change: null };
  const change = Math.round(((recent - before) / before) * 100);
  return { dir: change >= 15 ? 'up' : change <= -15 ? 'down' : 'flat', change };
}

/** 사이트 페이지 제목·설명에 키워드의 단어가 모두 들어 있으면 '관련 글 있음' (공백·조사 차이 무시) */
export function relatedPages<P extends { url: string; title: string; description?: string }>(keyword: string, pages: P[]): P[] {
  const words = keyword.split(/\s+/).map(w => w.trim()).filter(w => w.length >= 2);
  if (!words.length) return [];
  return pages.filter(p => {
    const hay = `${p.title} ${p.description || ''}`.replace(/\s+/g, '');
    return words.every(w => hay.includes(w));
  });
}

export interface TopicSuggestion { keyword: MarketingKeyword; score: number; reasons: string[] }

/** 다음 주제 후보 (기본 5개) */
export function suggestTopics(list: MarketingKeyword[], today: Date = new Date(), limit = 5): TopicSuggestion[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const maxVol = Math.max(1, ...list.map(k => k.monthly_volume || 0));
  return list
    .filter(k => !k.covered)
    .filter(k => !k.last_used_on || (today.getTime() - new Date(`${k.last_used_on}T00:00:00+09:00`).getTime()) / dayMs > 21)
    .map(k => {
      const reasons: string[] = [`우선순위 ${k.priority}`];
      let score = k.priority * 20;
      if (k.monthly_volume) { score += Math.round((k.monthly_volume / maxVol) * 30); reasons.push(`월 검색량 ${k.monthly_volume.toLocaleString('ko-KR')}`); }
      const t = trendDirection(k.trend);
      if (t.dir === 'up') { score += 15; reasons.push(`검색 증가${t.change != null ? ` ${t.change}%` : ''}`); }
      if (t.dir === 'down') score -= 5;
      if (k.season_note) { score += 5; reasons.push(k.season_note); }
      if (k.intent === 'urgent') { score += 5; reasons.push('급한 상황 검색'); }
      return { keyword: k, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.keyword.keyword.localeCompare(b.keyword.keyword, 'ko'))
    .slice(0, limit);
}

/** 오늘(한국 날짜) YYYY-MM-DD */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}
