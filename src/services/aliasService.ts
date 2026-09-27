import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { generateAlias } from '../utils/generateAlias';

// ============================================================
// 스텔스 가명 유일성 보장 (014_client_alias_uniqueness.sql)
// ============================================================

export type AliasClaimResult = 'claimed' | 'taken' | 'invalid' | 'offline';

/** 서버에 가명 선점 요청 */
export async function claimAlias(alias: string): Promise<AliasClaimResult> {
  if (!isSupabaseConfigured) return 'offline';
  const { data, error } = await supabase.rpc('claim_client_alias', { p_alias: alias });
  if (error) return error.code === '22023' ? 'invalid' : 'offline';
  return data === true ? 'claimed' : 'taken';
}

/**
 * 사용 가능한 가명을 확보한다.
 * - preferred가 있으면 먼저 시도(기존 가명 유지), 타인이 쓰고 있으면 새로 발급
 * - 2자리 조합으로 3회 충돌 시 3자리 조합으로 확장, 최대 8회 시도
 * - 서버 미연결 시에는 후보 가명을 그대로 반환(로컬 모드)
 */
export async function ensureUniqueAlias(preferred?: string): Promise<{ alias: string; changed: boolean }> {
  const candidates: string[] = [];
  if (preferred && preferred.trim()) candidates.push(preferred.trim());

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = candidates[attempt] ?? generateAlias({ digits: attempt >= 3 ? 3 : 2 });
    const res = await claimAlias(candidate);
    if (res === 'claimed' || res === 'offline') {
      return { alias: candidate, changed: candidate !== preferred };
    }
    // 기존 계정의 구형 가명(밑줄 포함 등)은 상담 내역 매칭이 끊기지 않도록 그대로 유지
    if (res === 'invalid' && attempt === 0 && preferred) {
      return { alias: preferred, changed: false };
    }
    // taken / invalid → 다음 후보
  }
  // 극히 드문 경우: 마지막 3자리 후보를 로컬에서만 사용
  const fallback = generateAlias({ digits: 3 });
  return { alias: fallback, changed: true };
}
