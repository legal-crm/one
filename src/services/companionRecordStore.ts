// ============================================================
// 회생동행 기록 저장소 (S 트랙, 20261031003400 client_companion_records)
// - 로그인한 의뢰인: 원본은 서버. 화면은 메모리 사본을 동기로 읽고, 저장은 서버에 바로 올린다(실패는 토스트).
// - 로그인 전: 이 기기에만 둔다(작성 중 기록). 로그인하면 서버에 없는 기록을 한 번 올리고 기기 사본을 지운다.
// - 같은 사람이 다른 기기에서 로그인해도 같은 기록을 본다.
// ============================================================
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export type CompanionKind = 'rehab' | 'bankruptcy';

const LOCAL_BASE: Record<CompanionKind, string> = {
  rehab: 'mykim_rehab_companion_case',
  bankruptcy: 'mykim_bankruptcy_companion_case',
};

const cache = new Map<string, unknown>();
let serverUser: string | null = null;
let lastErrorAt = 0;

const cacheKey = (kind: CompanionKind, scope: string) => `${kind}|${scope}`;
export const companionLocalKey = (kind: CompanionKind, scope: string) => (scope ? `${LOCAL_BASE[kind]}_${scope}` : LOCAL_BASE[kind]);

function emitChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('mykim:companion-changed'));
}

function readLocal<T>(kind: CompanionKind, scope: string): T | null {
  try {
    const raw = localStorage.getItem(companionLocalKey(kind, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function notifySaveError() {
  if (Date.now() - lastErrorAt < 30_000) return;
  lastErrorAt = Date.now();
  toast.error('회생동행 기록을 서버에 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');
}

export function readCompanionRecord<T>(kind: CompanionKind, scope: string): T | null {
  if (serverUser) return (cache.get(cacheKey(kind, scope)) as T | undefined) ?? null;
  return readLocal<T>(kind, scope);
}

export function writeCompanionRecord(kind: CompanionKind, scope: string, data: unknown): void {
  if (serverUser && isSupabaseConfigured) {
    cache.set(cacheKey(kind, scope), data);
    const uid = serverUser;
    void supabase.from('client_companion_records')
      .upsert({ user_id: uid, kind, scope_key: scope, data }, { onConflict: 'user_id,kind,scope_key' })
      .then(({ error }) => { if (error) { console.warn('[companion] save', error.message); notifySaveError(); } });
    return;
  }
  try { localStorage.setItem(companionLocalKey(kind, scope), JSON.stringify(data)); } catch { /* ignore */ }
}

export function removeCompanionRecord(kind: CompanionKind, scope: string): void {
  if (serverUser && isSupabaseConfigured) {
    cache.delete(cacheKey(kind, scope));
    void supabase.from('client_companion_records').delete().eq('user_id', serverUser).eq('kind', kind).eq('scope_key', scope)
      .then(({ error }) => { if (error) console.warn('[companion] delete', error.message); });
    return;
  }
  try { localStorage.removeItem(companionLocalKey(kind, scope)); } catch { /* ignore */ }
}

/** 로그인 상태가 바뀔 때 부른다. 서버 기록을 읽고, 서버에 없는 기기 기록은 한 번 올린 뒤 지운다 */
export async function hydrateCompanionRecords(userId: string | null): Promise<void> {
  if (!userId || !isSupabaseConfigured) {
    serverUser = null;
    cache.clear();
    emitChanged();
    return;
  }
  const { data, error } = await supabase.from('client_companion_records').select('kind, scope_key, data').eq('user_id', userId);
  if (error) {
    console.warn('[companion] load', error.message);
    toast.error('회생동행 기록을 불러오지 못했어요. 새로고침해 주세요.');
    return;
  }
  cache.clear();
  for (const r of (data || []) as Array<{ kind: CompanionKind; scope_key: string; data: unknown }>) cache.set(cacheKey(r.kind, r.scope_key), r.data);
  serverUser = userId;

  // 기기에 남은 기록 옮기기 (서버에 같은 키가 없을 때만)
  try {
    const moves: Array<{ kind: CompanionKind; scope: string; key: string; value: unknown }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const kind of Object.keys(LOCAL_BASE) as CompanionKind[]) {
        const base = LOCAL_BASE[kind];
        if (key !== base && !key.startsWith(`${base}_`)) continue;
        const scope = key === base ? '' : key.slice(base.length + 1);
        if (cache.has(cacheKey(kind, scope))) continue;
        try { moves.push({ kind, scope, key, value: JSON.parse(localStorage.getItem(key) || 'null') }); } catch { /* ignore */ }
      }
    }
    for (const m of moves) {
      if (!m.value || typeof m.value !== 'object') { localStorage.removeItem(m.key); continue; }
      const { error: upErr } = await supabase.from('client_companion_records')
        .upsert({ user_id: userId, kind: m.kind, scope_key: m.scope, data: m.value }, { onConflict: 'user_id,kind,scope_key' });
      if (!upErr) { cache.set(cacheKey(m.kind, m.scope), m.value); localStorage.removeItem(m.key); }
    }
  } catch { /* ignore */ }
  emitChanged();
}
