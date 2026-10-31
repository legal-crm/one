// ============================================================
// '내 상황 체크하기' 작성 중 초안 — 로그인한 의뢰인은 계정에 둔다 (I-5, 20261101003600)
//  * 로그인 전: 챗봇이 이 창(sessionStorage)에만 둔다 (창을 닫으면 지워짐)
//  * 로그인 후: 같은 내용을 3초 모아 서버에 한 번 (본인만 읽기), 다른 기기·새 창에서 이어 하기
//  * 정리를 마치거나 처음부터 다시 하면 지운다
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Record<string, unknown> | null = null;
let warned = false;

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  } catch {
    return null;
  }
}

export function queueCheckDraft(data: Record<string, unknown>): void {
  pending = data;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const body = pending;
    pending = null;
    if (!body) return;
    void (async () => {
      const uid = await currentUserId();
      if (!uid) return;
      const json = JSON.stringify(body);
      if (json.length > 290_000) return; // 너무 길면 이 창에만 둔다
      const { error } = await supabase.from('client_check_drafts').upsert({ user_id: uid, data: body }, { onConflict: 'user_id' });
      if (error && !warned) {
        warned = true;
        console.warn('[checkDraft] 계정에 임시 저장하지 못했어요 (이 창에는 남아 있어요):', error.message);
      }
    })();
  }, 3000);
}

export async function loadCheckDraft(): Promise<Record<string, any> | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('client_check_drafts').select('data, updated_at').eq('user_id', uid).maybeSingle();
  if (error || !data) return null;
  return (data.data as Record<string, any>) || null;
}

export function clearCheckDraft(): void {
  pending = null;
  if (timer) { clearTimeout(timer); timer = null; }
  void (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    await supabase.from('client_check_drafts').delete().eq('user_id', uid);
  })();
}
