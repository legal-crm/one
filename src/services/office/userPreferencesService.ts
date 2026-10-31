// ============================================================
// 사람별 화면 설정 (서버 user_preferences, 본인만 — 20261031002300)
// section: display · dashboard · notifications
// 오늘의 업무 카드 구성(HM-4)처럼 기기를 바꿔도 같아야 하는 화면 설정만 둔다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from './rpcResult';

export type UserPreferenceSection = 'display' | 'dashboard' | 'notifications';

export async function loadUserPreferences<T extends Record<string, unknown>>(section: UserPreferenceSection): Promise<RpcResult<T | null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, code: 'auth', message: '로그인이 필요해요.' };
  const { data, error } = await supabase.from('user_preferences').select('data').eq('user_id', uid).eq('section', section).maybeSingle();
  if (error) return toRpcError(error);
  return { ok: true, data: data ? ((data.data || {}) as T) : null };
}

export async function saveUserPreferences(section: UserPreferenceSection, payload: Record<string, unknown>): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, code: 'auth', message: '로그인이 필요해요.' };
  const { error } = await supabase.from('user_preferences')
    .upsert({ user_id: uid, section, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id,section' });
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

export async function clearUserPreferences(section: UserPreferenceSection): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, code: 'auth', message: '로그인이 필요해요.' };
  const { error } = await supabase.from('user_preferences').delete().eq('user_id', uid).eq('section', section);
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

/** 오늘의 업무 카드 구성: 고를 수 있는 카드 중 2~4개, 중복 없음 */
export function sanitizeDashboardCards(raw: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !allowed.includes(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length === 4) break;
  }
  return out.length >= 2 ? out : null;
}
