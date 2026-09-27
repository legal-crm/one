import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { encryptReport, decryptReport } from '../utils';

// ============================================================
// 진단 보고서 보안 공유 (013_shared_reports_pin_attempt_limit.sql)
// - 암호문은 서버에만 보관, 링크에는 무작위 ID만 포함
// - PIN 검증은 서버에서 수행, 5회 실패 시 링크 영구 잠금
// ============================================================

export const SHARE_MAX_ATTEMPTS = 5;

/** 암호화 후 서버에 보관하고 공유 ID를 반환 */
export async function createSharedReport(payload: string, pin: string): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('보안 공유는 서버 연결이 필요합니다.');
  }
  const ciphertext = await encryptReport(payload, pin);
  const { data, error } = await supabase.rpc('create_shared_report', {
    p_ciphertext: ciphertext,
    p_pin: pin,
    p_ttl_hours: 168,
  });
  if (error || !data) {
    throw new Error(error?.code === '54000'
      ? '오늘 생성할 수 있는 공유 링크 수를 초과했습니다.'
      : '공유 링크를 만들지 못했습니다. 로그인 상태를 확인해 주세요.');
  }
  return String(data);
}

export type OpenSharedReportResult =
  | { ok: true; data: { result: any; userInput: any } }
  | { ok: false; reason: 'not_found' | 'locked' | 'wrong_pin' | 'legacy' | 'error'; remaining?: number };

/** 공유 ID로 서버 PIN 검증 후 복호화 */
export async function openSharedReport(shareId: string, pin: string): Promise<OpenSharedReportResult> {
  // 이전 방식(암호문을 링크에 담은 형식)은 시도 횟수 제한이 불가능하므로 더 이상 열지 않음
  if (shareId.length > 64) return { ok: false, reason: 'legacy' };
  if (!isSupabaseConfigured) return { ok: false, reason: 'error' };

  const { data, error } = await supabase.rpc('open_shared_report', { p_id: shareId, p_pin: pin });
  if (error || !data) return { ok: false, reason: 'error' };

  const res = data as { ok: boolean; reason?: string; remaining?: number; ciphertext?: string };
  if (!res.ok || !res.ciphertext) {
    const reason = (res.reason === 'locked' || res.reason === 'wrong_pin' || res.reason === 'not_found') ? res.reason : 'error';
    return { ok: false, reason, remaining: res.remaining };
  }

  try {
    const parsed = JSON.parse(await decryptReport(res.ciphertext, pin));
    if (parsed?.result && parsed?.userInput) return { ok: true, data: parsed };
  } catch {
    // PIN은 서버 검증을 통과했으므로 여기 도달하면 데이터 손상
  }
  return { ok: false, reason: 'error' };
}
