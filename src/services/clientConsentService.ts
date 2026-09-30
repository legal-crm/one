import { supabase, isSupabaseConfigured } from '../supabaseClient';

/* ─────────────────────────────────────────────
   의뢰인 동의 기록
   - 로그인: (필수) 서비스 이용약관 · (필수) 개인정보 수집·이용 — 로그인 직전 기기에 보관했다가 세션이 생기면 계정에 저장
   - 변호사에게 상담 정보 제공(개인정보 제3자 제공): 상담을 요청할 때마다 받는 변호사를 확인하고 동의
   저장 위치: Supabase 계정 user_metadata.consents (+ 이 기기 사본). 동의 문구가 바뀌면 버전을 올린다.
   ───────────────────────────────────────────── */

export const CONSENT_VERSIONS = {
  terms: 'tos-2026-09-30',
  privacy: 'privacy-2026-09-30',
  thirdParty: 'third-party-2026-09-30',
} as const;

export interface ConsentRecord {
  version: string;
  at: string;
}

export interface ThirdPartyConsentRecord extends ConsentRecord {
  requestId: string;
  /** 'selected' = 의뢰인이 고른 변호사, 'open' = 공개 요청(등록·승인된 변호사가 열람) */
  scope: 'selected' | 'open';
  lawyerIds: string[];
}

export interface ClientConsents {
  terms?: ConsentRecord;
  privacy?: ConsentRecord;
  thirdParty?: ThirdPartyConsentRecord[];
}

const PENDING_LOGIN_KEY = 'legal_crm_pending_login_consent';
const LOCAL_KEY = 'legal_crm_client_consents';
const THIRD_PARTY_HISTORY_LIMIT = 20;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간 부족 등은 무시 (계정 저장이 기준) */
  }
}

function normalize(value: unknown): ClientConsents {
  if (!value || typeof value !== 'object') return {};
  const v = value as ClientConsents;
  return {
    ...(v.terms?.at ? { terms: v.terms } : {}),
    ...(v.privacy?.at ? { privacy: v.privacy } : {}),
    ...(Array.isArray(v.thirdParty) ? { thirdParty: v.thirdParty.filter(r => r && r.at) } : {}),
  };
}

/** 계정(user_metadata)과 이 기기 사본을 합친 동의 기록 */
export async function loadClientConsents(): Promise<ClientConsents> {
  const local = normalize(readJson(LOCAL_KEY));
  if (!isSupabaseConfigured) return local;
  try {
    const { data } = await supabase.auth.getSession();
    const remote = normalize(data.session?.user?.user_metadata?.consents);
    return {
      terms: remote.terms || local.terms,
      privacy: remote.privacy || local.privacy,
      thirdParty: mergeThirdParty(remote.thirdParty, local.thirdParty),
    };
  } catch {
    return local;
  }
}

function mergeThirdParty(a: ThirdPartyConsentRecord[] = [], b: ThirdPartyConsentRecord[] = []): ThirdPartyConsentRecord[] {
  const seen = new Set<string>();
  return [...a, ...b]
    .filter(r => {
      const key = `${r.requestId}|${r.at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, THIRD_PARTY_HISTORY_LIMIT);
}

/** 계정에 동의 기록을 합쳐 저장한다. 실패해도 이 기기 사본은 남는다. */
async function saveConsents(patch: (current: ClientConsents) => ClientConsents): Promise<boolean> {
  const local = normalize(readJson(LOCAL_KEY));
  const nextLocal = patch(local);
  writeJson(LOCAL_KEY, nextLocal);
  if (!isSupabaseConfigured) return true;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return false;
    const remote = normalize(user.user_metadata?.consents);
    const next = patch(remote);
    const { error } = await supabase.auth.updateUser({ data: { consents: next } });
    return !error;
  } catch {
    return false;
  }
}

/** 로그인 버튼을 누르기 직전: 필수 동의를 이 기기에 보관 (OAuth 이동 후 돌아와서 계정에 저장) */
export function stashLoginConsent(): void {
  const at = new Date().toISOString();
  writeJson(PENDING_LOGIN_KEY, {
    terms: { version: CONSENT_VERSIONS.terms, at },
    privacy: { version: CONSENT_VERSIONS.privacy, at },
  } satisfies ClientConsents);
}

let committingLoginConsent: Promise<void> | null = null;

/** 로그인 세션이 생긴 뒤: 보관해 둔 필수 동의를 계정에 저장 (여러 번 불려도 한 번만 저장) */
export function commitPendingLoginConsent(): Promise<void> {
  if (committingLoginConsent) return committingLoginConsent;
  const pending = normalize(readJson(PENDING_LOGIN_KEY));
  if (!pending.terms && !pending.privacy) return Promise.resolve();
  committingLoginConsent = saveConsents(current => ({
    ...current,
    ...(pending.terms ? { terms: pending.terms } : {}),
    ...(pending.privacy ? { privacy: pending.privacy } : {}),
  }))
    .then(ok => {
      if (ok) {
        try { localStorage.removeItem(PENDING_LOGIN_KEY); } catch { /* ignore */ }
      }
    })
    .finally(() => {
      committingLoginConsent = null;
    });
  return committingLoginConsent;
}

/** 변호사에게 상담 정보를 제공하기로 동의한 기록 */
export function recordThirdPartyConsent(input: { requestId: string; scope: 'selected' | 'open'; lawyerIds: string[] }): Promise<boolean> {
  const record: ThirdPartyConsentRecord = {
    version: CONSENT_VERSIONS.thirdParty,
    at: new Date().toISOString(),
    requestId: input.requestId,
    scope: input.scope,
    lawyerIds: input.lawyerIds,
  };
  return saveConsents(current => ({
    ...current,
    thirdParty: mergeThirdParty([record], current.thirdParty),
  }));
}
