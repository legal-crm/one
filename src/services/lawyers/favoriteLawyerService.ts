// ============================================================
// 변호사 좋아요(즐겨찾기) — 서버 저장 (LD-10, 20261031003000)
// 이전: 이 기기 localStorage['lawyer_favorites']에만 저장했고, 내 관리방은 다른 방식(secureGetItem)으로 읽어
//       '좋아요한 변호사에게 요청'이 늘 비어 있었다. 다른 기기에서도 안 보였다.
// 이제: 로그인한 의뢰인 계정에 서버 저장(본인만 읽음). 로그인 전에는 좋아요를 누를 수 없다(로그인 안내).
// 좋아요는 바로가기일 뿐, 상담 요청 한도(3명)와는 관계없다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { rpcErrorMessage } from '../office/rpcResult';

const OLD_KEY = 'lawyer_favorites';
let cache = new Set<string>();
let loadedFor: string | null = null;
let sessionUser: string | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

function emit() {
  const snapshot = new Set(cache);
  listeners.forEach(fn => fn(snapshot));
}

/** 옛 기기 저장 값은 쓰지 않는다 (DM-Q3: 브라우저 데이터 이관 없이 새로 시작) */
function dropOldDeviceCopy() {
  try { localStorage.removeItem(OLD_KEY); } catch { /* ignore */ }
}

export function getFavoriteLawyerIds(): Set<string> {
  return new Set(cache);
}

export function subscribeFavoriteLawyers(fn: (ids: Set<string>) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 로그인한 계정의 좋아요를 서버에서 읽는다. 로그아웃이면 비운다. */
export async function refreshFavoriteLawyers(userId: string | null): Promise<{ ok: boolean; message?: string }> {
  dropOldDeviceCopy();
  sessionUser = userId;
  if (!userId || !isSupabaseConfigured || !supabase) {
    cache = new Set();
    loadedFor = null;
    emit();
    return { ok: true };
  }
  const { data, error } = await supabase.from('client_favorite_lawyers').select('lawyer_id').order('created_at');
  if (error) return { ok: false, message: '좋아요 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' };
  cache = new Set((data || []).map((r: { lawyer_id: string }) => r.lawyer_id));
  loadedFor = userId;
  emit();
  return { ok: true };
}

export function favoritesLoadedFor(): string | null {
  return loadedFor;
}

/** 좋아요 켜기·끄기. 화면은 바로 바꾸고, 서버가 거절하면 되돌린다. */
export async function setFavoriteLawyer(lawyerId: string, on: boolean): Promise<{ ok: boolean; needsLogin?: boolean; message?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, message: '서버에 연결되지 않아 좋아요를 저장하지 못했어요.' };
  if (!sessionUser) return { ok: false, needsLogin: true, message: '로그인하면 좋아요한 변호사를 어느 기기에서나 볼 수 있어요.' };
  const before = new Set(cache);
  if (on) cache.add(lawyerId); else cache.delete(lawyerId);
  emit();
  const { data, error } = await supabase.rpc('set_favorite_lawyer', { p_lawyer_id: lawyerId, p_on: on });
  if (error) {
    cache = before;
    emit();
    const raw = error.message || '';
    if (/too many favorites/i.test(raw)) return { ok: false, message: '좋아요는 50명까지 담을 수 있어요.' };
    if (/lawyer not listed/i.test(raw)) return { ok: false, message: '지금은 공개되지 않은 변호사예요.' };
    return { ok: false, message: rpcErrorMessage(error) };
  }
  if (Array.isArray(data)) {
    cache = new Set(data as string[]);
    emit();
  }
  return { ok: true };
}
