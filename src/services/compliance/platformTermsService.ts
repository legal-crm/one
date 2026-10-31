// ============================================================
// 통합어드민 금지어 사전 (M-9 후속, 20261101005300)
// 공통 사전(api/_lib/compliance-terms.js)은 코드에 고정 — 관리자는 표현을 '더하기'만 한다.
//   clientTerms    : 의뢰인에게 보내는 글 검사(채팅·제안서·Q&A·프로필·광고 소재)에 더함
//   marketingTerms : 마케팅 글 검사에 더함 [{term, reason}]
// 읽기: platform_config 'compliance_terms'(누구나), 쓰기: admin_set_compliance_terms()
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';
// @ts-ignore — 순수 JS 모듈 (서버·브라우저 공용 규칙 검사기)
import { setExtraComplianceTerms } from '../../../api/_lib/marketing-compliance.js';

export interface MarketingExtraTerm { term: string; reason?: string | null }
export interface PlatformComplianceTerms {
  clientTerms: string[];
  marketingTerms: MarketingExtraTerm[];
  updatedAt?: string;
}

const EMPTY: PlatformComplianceTerms = { clientTerms: [], marketingTerms: [] };
let cache: PlatformComplianceTerms = EMPTY;
let loadedAt = 0;

function normalize(d: any): PlatformComplianceTerms {
  const clientTerms = Array.isArray(d?.clientTerms) ? d.clientTerms.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim()) : [];
  const marketingTerms = Array.isArray(d?.marketingTerms)
    ? d.marketingTerms.filter((x: any) => x && typeof x.term === 'string' && x.term.trim()).map((x: any) => ({ term: x.term.trim(), reason: x.reason || null }))
    : [];
  return { clientTerms, marketingTerms, updatedAt: d?.updatedAt || undefined };
}

function apply(t: PlatformComplianceTerms) {
  cache = t;
  loadedAt = Date.now();
  // 브라우저에서 돌리는 마케팅 검사도 같은 표현을 쓴다
  setExtraComplianceTerms([...t.marketingTerms, ...t.clientTerms.map(term => ({ term, reason: null }))]);
}

/** 서버에서 읽어 둔다 (5분 캐시, 실패하면 공통 사전만 — 검사가 멈추지 않게) */
export async function loadPlatformComplianceTerms(force = false): Promise<PlatformComplianceTerms> {
  if (!isSupabaseConfigured) return cache;
  if (!force && Date.now() - loadedAt < 5 * 60 * 1000) return cache;
  const { data, error } = await supabase.from('platform_config').select('data').eq('id', 'compliance_terms').maybeSingle();
  if (error) { console.warn('[compliance] platform terms not loaded:', error.message); return cache; }
  apply(normalize(data?.data));
  return cache;
}

export function getPlatformClientTerms(): string[] { return cache.clientTerms; }
export function getPlatformComplianceTerms(): PlatformComplianceTerms { return cache; }

/** 입력 정리: 앞뒤 공백 제거, 2~40자, 중복 제거 (서버도 같은 규칙) */
export function cleanTerms(list: string[]): { terms: string[]; bad: string[] } {
  const terms: string[] = [];
  const bad: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    if (!t) continue;
    if (t.length < 2 || t.length > 40) { bad.push(t); continue; }
    if (!terms.includes(t)) terms.push(t);
  }
  return { terms, bad };
}

export async function adminSaveComplianceTerms(clientTerms: string[], marketingTerms: MarketingExtraTerm[]): Promise<RpcResult<PlatformComplianceTerms>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_set_compliance_terms', {
    p_client_terms: clientTerms,
    p_marketing_terms: marketingTerms.map(m => ({ term: m.term, reason: m.reason || null })),
  });
  if (error) {
    if (/at most 100 terms/i.test(error.message)) return { ok: false, code: 'limit', message: '표현은 종류마다 100개까지 더할 수 있어요.' };
    if (/2 to 40 characters/i.test(error.message)) return { ok: false, code: 'length', message: '표현은 2~40자로 적어 주세요.' };
    if (/admin only/i.test(error.message)) return { ok: false, code: 'admin', message: '관리자(2단계 인증)만 바꿀 수 있어요.' };
    return toRpcError(error);
  }
  const t = normalize(data);
  apply(t);
  return { ok: true, data: t };
}
