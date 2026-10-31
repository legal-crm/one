import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { rpcErrorMessage } from './office/rpcResult';

/* ─────────────────────────────────────────────
   의뢰인 동의 기록 (CT-13·MY-9, 20261031003200)
   - 로그인: (필수) 서비스 이용약관 · (필수) 개인정보 수집·이용 — 로그인 직전 기기에 보관했다가 세션이 생기면 서버에 기록
   - 변호사에게 상담 정보 제공: 상담 요청을 보낼 때 서버(client_request_lawyers)가 동의 줄을 함께 남긴다
   - 원본은 서버 user_consents(추가만, 철회는 한 번). 이전에는 계정 user_metadata에 저장해 본인이 고칠 수 있었다.
   - 약관 버전은 서버 legal_documents. 새 버전이 '다시 동의 받기'로 게시되면 로그인 뒤 다시 묻는다.
   ───────────────────────────────────────────── */

export const CONSENT_VERSIONS = {
  terms: 'tos-2026-09-30',
  privacy: 'privacy-2026-09-30',
  thirdParty: 'third-party-2026-09-30',
} as const;

export type ConsentKind = 'terms' | 'privacy' | 'third_party' | 'lawyer_terms';

export interface ConsentRow {
  id: string;
  kind: ConsentKind;
  version: string;
  title: string | null;
  url: string | null;
  source: string;
  requestId: string | null;
  lawyerId: string | null;
  lawyerName: string | null;
  seatStatus: string | null;
  grantedAt: string;
  withdrawnAt: string | null;
  withdrawEffect: 'seat_withdrawn' | 'contracted_kept' | 'already_closed' | 'account_request' | null;
}

export interface PendingReconsent {
  kind: 'terms' | 'privacy';
  version: string;
  title: string;
  url: string;
  summary: string | null;
  effectiveOn: string;
}

const PENDING_LOGIN_KEY = 'legal_crm_pending_login_consent';
const OLD_LOCAL_KEY = 'legal_crm_client_consents';

/** 로그인 버튼을 누르기 직전: 필수 동의를 이 기기에 보관 (OAuth 이동 후 돌아와서 서버에 기록) */
export function stashLoginConsent(): void {
  try {
    localStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify({ terms: CONSENT_VERSIONS.terms, privacy: CONSENT_VERSIONS.privacy, at: new Date().toISOString() }));
  } catch { /* ignore */ }
}

let committingLoginConsent: Promise<void> | null = null;

/** 로그인 세션이 생긴 뒤: 보관해 둔 필수 동의를 서버에 기록 (여러 번 불려도 한 번만) */
export function commitPendingLoginConsent(): Promise<void> {
  if (committingLoginConsent) return committingLoginConsent;
  try { localStorage.removeItem(OLD_LOCAL_KEY); } catch { /* ignore */ }
  let pending: { terms?: string; privacy?: string } | null = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING_LOGIN_KEY) || 'null'); } catch { pending = null; }
  if (!pending || !isSupabaseConfigured) return Promise.resolve();
  const items = [
    pending.terms ? { kind: 'terms', version: pending.terms } : null,
    pending.privacy ? { kind: 'privacy', version: pending.privacy } : null,
  ].filter(Boolean);
  committingLoginConsent = (async () => {
    const { error } = await supabase.rpc('record_my_consents', { p_items: items });
    if (!error) {
      try { localStorage.removeItem(PENDING_LOGIN_KEY); } catch { /* ignore */ }
    } else {
      console.warn('[consent] record failed', error.message);
    }
  })().finally(() => { committingLoginConsent = null; });
  return committingLoginConsent;
}

/** 내 동의 기록 (최근 순) */
export async function loadMyConsents(): Promise<{ ok: true; rows: ConsentRow[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: true, rows: [] };
  const { data, error } = await supabase.rpc('my_consents');
  if (error) return { ok: false, message: '동의 기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' };
  return {
    ok: true,
    rows: ((data || []) as any[]).map(r => ({
      id: r.id, kind: r.kind, version: r.version, title: r.title, url: r.url, source: r.source,
      requestId: r.request_id, lawyerId: r.lawyer_id, lawyerName: r.lawyer_name, seatStatus: r.seat_status,
      grantedAt: r.granted_at, withdrawnAt: r.withdrawn_at, withdrawEffect: r.withdraw_effect,
    })),
  };
}

export const WITHDRAW_EFFECT_TEXT: Record<NonNullable<ConsentRow['withdrawEffect']>, string> = {
  seat_withdrawn: '그 변호사에게 보낸 상담 요청을 취소했어요. 변호사는 더 이상 내 정리 자료를 볼 수 없어요.',
  contracted_kept: '수임 계약을 맺은 변호사라 계약에 따라 사건 처리에 필요한 정보는 계속 다뤄요. 계약 해지는 사무소에 문의해 주세요.',
  already_closed: '이미 끝난 상담 요청이라 더 바뀌는 것은 없어요. 철회 기록만 남겼어요.',
  account_request: '이용약관·개인정보 동의 철회는 탈퇴로 처리해요. 개인정보 요청으로 접수했어요(10일 안에 처리).',
};

/** 동의 철회 */
export async function withdrawConsent(id: string, reason?: string): Promise<{ ok: true; effect: ConsentRow['withdrawEffect'] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버에 연결되지 않았어요.' };
  const { data, error } = await supabase.rpc('withdraw_my_consent', { p_id: id, p_reason: reason || null });
  if (error) return { ok: false, message: /too many open privacy/i.test(error.message || '') ? '처리 중인 개인정보 요청이 많아요. 처리된 뒤 다시 요청해 주세요.' : rpcErrorMessage(error) };
  return { ok: true, effect: ((data as any)?.effect ?? null) as ConsentRow['withdrawEffect'] };
}

/** 다시 동의가 필요한 새 약관 */
export async function loadPendingReconsent(): Promise<PendingReconsent[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('my_pending_reconsent');
  if (error) return [];
  return ((data || []) as any[]).map(r => ({ kind: r.kind, version: r.version, title: r.title, url: r.url, summary: r.summary, effectiveOn: r.effective_on }));
}

export async function acceptReconsent(docs: PendingReconsent[]): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('record_my_consents', { p_items: docs.map(d => ({ kind: d.kind, version: d.version, source: 'reconsent' })) });
  if (error) return { ok: false, message: '동의를 저장하지 못했어요. 다시 눌러 주세요.' };
  return { ok: true };
}
