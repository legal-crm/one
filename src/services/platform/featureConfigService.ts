// 기능 표시 · 부가 기능 과금 모드 (CT-15, platform_config 'feature_flags')
// 읽기는 누구나, 쓰기는 관리자 서버 함수(admin_set_platform_features)로만 — 유료 전환은 30일 전 공지가 자동으로 붙는다
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from '../office/rpcResult';

export type AddonBillingMode = 'free' | 'ad_benefit' | 'flat_paid';

export interface PlatformFeatureConfig {
  caseReviewBilling: { mode: AddonBillingMode; effectiveFrom?: string | null; noticeId?: string | null };
  features: {
    /** 고객 '변제금 계산기' 공개 (B-7 재구성·외부 변호사 검토 전에는 숨김, CK-Q1) */
    calculatorVisible: boolean;
    companionVisible: boolean;
  };
}

export const DEFAULT_FEATURE_CONFIG: PlatformFeatureConfig = {
  caseReviewBilling: { mode: 'free', effectiveFrom: null, noticeId: null },
  features: { calculatorVisible: false, companionVisible: true },
};

export const BILLING_MODE_LABEL: Record<AddonBillingMode, string> = {
  free: '무료',
  ad_benefit: '광고 상품 이용 사무소에 제공',
  flat_paid: '정액 이용 신청',
};

function normalize(raw: any): PlatformFeatureConfig {
  const mode = ['free', 'ad_benefit', 'flat_paid'].includes(raw?.caseReviewBilling?.mode) ? raw.caseReviewBilling.mode : 'free';
  return {
    caseReviewBilling: { mode, effectiveFrom: raw?.caseReviewBilling?.effectiveFrom || null, noticeId: raw?.caseReviewBilling?.noticeId || null },
    features: {
      calculatorVisible: raw?.features?.calculatorVisible === true,
      companionVisible: raw?.features?.companionVisible !== false,
    },
  };
}

let cache: { value: PlatformFeatureConfig; at: number } | null = null;
const listeners = new Set<(v: PlatformFeatureConfig) => void>();

export async function loadFeatureConfig(force = false): Promise<PlatformFeatureConfig> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  let value = DEFAULT_FEATURE_CONFIG;
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('platform_config').select('data').eq('id', 'feature_flags').maybeSingle();
    if (!error && data?.data) value = normalize(data.data);
  }
  cache = { value, at: Date.now() };
  listeners.forEach(l => l(value));
  return value;
}

export async function saveFeatureConfig(next: PlatformFeatureConfig): Promise<RpcResult<PlatformFeatureConfig>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_set_platform_features', { p: next });
  if (error) {
    if (/30 days/i.test(error.message)) return { ok: false, code: 'invalid', message: '무료가 아닌 방식은 시작일을 오늘부터 30일 뒤 이후로 정해야 해요 (사무소 사전 공지).' };
    return toRpcError(error);
  }
  const value = normalize(data);
  cache = { value, at: Date.now() };
  listeners.forEach(l => l(value));
  return { ok: true, data: value };
}

export function usePlatformFeatures(): PlatformFeatureConfig {
  const [v, setV] = useState<PlatformFeatureConfig>(cache?.value || DEFAULT_FEATURE_CONFIG);
  useEffect(() => {
    listeners.add(setV);
    void loadFeatureConfig();
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}

const AD_TIERS_WITH_BENEFIT = ['top', 'regional', 'banner'];

/**
 * 사건 검토(상세 분석 제안서 포함) 사용 가능 여부
 * - 무료: 모두
 * - 광고 혜택: 시작일 전에는 모두, 시작일부터 노출 중 광고가 있는 사무소 + 관리자 예외
 * - 정액: 시작일 전에는 모두, 시작일부터 관리자가 켠 변호사(정액 이용 신청)만
 */
export function caseReviewAccess(cfg: PlatformFeatureConfig, lawyer: { adTier?: string; aiCaseAnalysisEnabled?: boolean }, now: Date = new Date()): { open: boolean; reason: string } {
  const { mode, effectiveFrom } = cfg.caseReviewBilling;
  if (mode === 'free') return { open: true, reason: '' };
  const today = now.toISOString().slice(0, 10);
  if (effectiveFrom && today < effectiveFrom) return { open: true, reason: `${effectiveFrom}부터 이용 조건이 바뀝니다 (${BILLING_MODE_LABEL[mode]}).` };
  if (lawyer.aiCaseAnalysisEnabled) return { open: true, reason: '' };
  if (mode === 'ad_benefit' && AD_TIERS_WITH_BENEFIT.includes(String(lawyer.adTier || ''))) return { open: true, reason: '' };
  return {
    open: false,
    reason: mode === 'ad_benefit'
      ? '광고 상품을 이용 중인 사무소에 제공하는 기능이에요. 광고·결제에서 확인해 주세요.'
      : '정액 이용 신청이 필요한 기능이에요. 마이김변 문의로 신청해 주세요.',
  };
}
