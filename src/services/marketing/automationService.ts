// ============================================================
// 마케팅 자동화 수준 (M-1, 20261101005700)
//   읽기: marketing_automation_config() — 저장값이 없으면 결정값(L2·엄격·90점·스레드·페이스북)
//   쓰기: admin_set_marketing_automation() — 관리자(2단계 인증)만, 조치 기록. 긴급 정지 = L1로 저장
// 판단 규칙은 서버와 같은 파일(api/_lib/marketing-automation.js)을 쓴다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';
// @ts-ignore — 순수 JS 모듈 (서버·브라우저 공용)
import { normalizeAutomationConfig } from '../../../api/_lib/marketing-automation.js';

export type AutomationLevel = 'L1' | 'L2';
export type CheckMode = 'strict' | 'advisory';
export type AutoChannel = 'threads' | 'facebook';
export interface MarketingAutomation {
  level: AutomationLevel;
  checkMode: CheckMode;
  minScore: number;
  autoChannels: AutoChannel[];
  updatedAt: string | null;
}

export const normalizeAutomation = normalizeAutomationConfig as (raw: unknown) => MarketingAutomation;

export async function loadMarketingAutomation(): Promise<RpcResult<MarketingAutomation>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('marketing_automation_config');
  if (error) return toRpcError(error);
  return { ok: true, data: normalizeAutomation(data) };
}

export async function saveMarketingAutomation(p: Omit<MarketingAutomation, 'updatedAt'>): Promise<RpcResult<MarketingAutomation>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const minScore = Math.round(Number(p.minScore));
  if (!Number.isFinite(minScore) || minScore < 70 || minScore > 100) {
    return { ok: false, code: 'score', message: '자동 승인 점수는 70~100점으로 정해 주세요.' };
  }
  const { data, error } = await supabase.rpc('admin_set_marketing_automation', {
    p: { level: p.level, checkMode: p.checkMode, minScore, autoChannels: p.autoChannels },
  });
  if (error) {
    if (/admin only/i.test(error.message)) return { ok: false, code: 'admin', message: '관리자(2단계 인증)만 바꿀 수 있어요.' };
    if (/min score/i.test(error.message)) return { ok: false, code: 'score', message: '자동 승인 점수는 70~100점으로 정해 주세요.' };
    if (/invalid automation level|invalid check mode|autoChannels/i.test(error.message)) {
      return { ok: false, code: 'invalid', message: '설정 값을 다시 확인해 주세요.' };
    }
    return toRpcError(error);
  }
  return { ok: true, data: normalizeAutomation(data) };
}
