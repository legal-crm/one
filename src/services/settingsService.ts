import type { AppSettings, CourtConfig } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { RENAMED_DISTRICTS, smallLeaseRegionFor } from './repayment/smallLeaseRegion';
import type { CourtRegionMapItem } from '../types';

/**
 * 게시본 지역 표 정리 (LS-9): 없어진 행정구역 이름을 지금 이름으로, 소액임차 칸은 법령 판정으로 채운다.
 * 게시본에 표가 없으면 코드 기본 표.
 */
function normalizeCourtRegionMap(map: CourtRegionMapItem[] | undefined): CourtRegionMapItem[] {
  if (!Array.isArray(map) || map.length === 0) return clone(DEFAULT_SETTINGS.courtRegionMap);
  const seen = new Set<string>();
  const out: CourtRegionMapItem[] = [];
  for (const raw of map) {
    if (!raw?.keyword) continue;
    const keyword = RENAMED_DISTRICTS[raw.keyword] || raw.keyword;
    const key = keyword + '|' + raw.court;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...raw, keyword, smallLeaseRegion: smallLeaseRegionFor(keyword).region });
  }
  return out;
}
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getSalesSettings } from './sales/salesSettingsService';
import { toRpcError, NOT_CONFIGURED, type RpcResult } from './office/rpcResult';

// ============================================================
// 계산 기준표 (LS-1): 원본은 서버 calc_standard_sets 의 최신 게시본.
// 게시본이 없으면 코드 기본값(DEFAULT_SETTINGS — 법령 원문 확인값).
// 사무소가 바꾼 '법원 성격' 칸(office_court_overrides)은 그 사무소 계산에만 덧씌운다.
// (이전: 관리자 브라우저 localStorage 에만 저장돼 다른 사람 계산에 반영되지 않았음)
// ============================================================

const LEGACY_SETTINGS_KEY = 'rehab_policy_settings';
try { localStorage.removeItem(LEGACY_SETTINGS_KEY); } catch { /* 브라우저 저장소 없음 */ }

export interface CalcStandardMeta {
  version: number | null;
  publishedAt: string | null;
  note: string;
  source: 'server' | 'code_default';
}

export interface CourtOverride {
  courtName: string;
  fields: Partial<CourtConfig> & { memo?: string };
  reason: string;
  updatedAt: string;
}

let cache: { settings: AppSettings; meta: CalcStandardMeta; at: number } | null = null;
const CACHE_MS = 5 * 60_000;

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

/** 서버 게시본 + (선택) 사무소 법원 성격 변경값 */
export async function loadCalcStandard(opts: { officeId?: string; force?: boolean } = {}): Promise<{ settings: AppSettings; meta: CalcStandardMeta; overrides: CourtOverride[]; error?: string }> {
  let error: string | undefined;
  if (!cache || opts.force || Date.now() - cache.at > CACHE_MS) {
    let settings: AppSettings = clone(DEFAULT_SETTINGS);
    let meta: CalcStandardMeta = { version: null, publishedAt: null, note: '', source: 'code_default' };
    if (isSupabaseConfigured) {
      const { data, error: e } = await supabase.rpc('current_calc_standard');
      if (e) error = toRpcError(e).message;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.settings) {
        // 새 연도·법원이 코드에 추가돼도 빠지지 않게 기본값 위에 게시본을 덮는다
        settings = {
          ...clone(DEFAULT_SETTINGS),
          ...row.settings,
          yearlyPolicies: { ...clone(DEFAULT_SETTINGS.yearlyPolicies), ...(row.settings.yearlyPolicies || {}) },
          courtConfigs: { ...clone(DEFAULT_SETTINGS.courtConfigs), ...(row.settings.courtConfigs || {}) },
          courtRegionMap: normalizeCourtRegionMap(row.settings.courtRegionMap),
        };
        meta = { version: row.version, publishedAt: row.published_at, note: row.note || '', source: 'server' };
      }
    }
    cache = { settings, meta, at: Date.now() };
  }
  const settings = clone(cache.settings);
  let overrides: CourtOverride[] = [];
  if (opts.officeId && isSupabaseConfigured) {
    const { data, error: e } = await supabase.from('office_court_overrides').select('court_name, fields, reason, updated_at').eq('office_id', opts.officeId);
    if (e) error = toRpcError(e).message;
    overrides = (data || []).map((r: any) => ({ courtName: r.court_name, fields: r.fields || {}, reason: r.reason, updatedAt: r.updated_at }));
    for (const o of overrides) {
      const base = settings.courtConfigs[o.courtName];
      if (!base) continue;
      const { memo: _memo, ...f } = o.fields;
      settings.courtConfigs[o.courtName] = { ...base, ...f };
    }
  }
  return { settings, meta: cache.meta, overrides, error };
}

/** 기존 호출부 호환: 계산에 쓸 기준표 (사무소 변경값은 officeId 가 있을 때만) */
export const fetchSettings = async (officeId?: string): Promise<AppSettings> => (await loadCalcStandard({ officeId })).settings;

/** 통합어드민: 새 기준표 버전 게시 (게시본은 고칠 수 없고, 고치면 새 버전) */
export async function publishCalcStandard(settings: AppSettings, note: string): Promise<RpcResult<{ version: number }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('admin_publish_calc_standard', { p_settings: settings, p_note: note });
  if (error) return toRpcError(error);
  cache = null;
  return { ok: true, data: { version: data.version } };
}

/** 사무소: 법원 성격 실무 칸 변경(fields 빈 값이면 되돌리기) */
export async function saveCourtOverride(officeId: string, courtName: string, fields: CourtOverride['fields'], reason: string): Promise<RpcResult<true>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_office_court_override', { p_office_id: officeId, p_court_name: courtName, p_fields: fields, p_reason: reason });
  return error ? toRpcError(error) : { ok: true, data: true };
}

/** @deprecated 기준표는 publishCalcStandard(관리자)·saveCourtOverride(사무소)로만 저장한다 */
export const updateSettings = async (_settings: AppSettings): Promise<boolean> => false;

// ── 영업 DB 설정 (SL-12): 서버 sales_settings 로 옮김 ──
// 예전 브라우저 키(1차 상태·2차 상태·거래처 수당·부재 알림 단계·텔레그램 방·유입 경로)는 지운다.
try {
  ['legal_crm_statuses', 'legal_crm_secondary_statuses', 'legal_crm_tertiary_statuses', 'legal_crm_partners', 'legal_crm_inbound_paths', 'legal_crm_interval_tiers', 'legal_crm_telegram_rooms']
    .forEach(k => localStorage.removeItem(k));
} catch { /* 브라우저 저장소 없음 */ }

/** 유입 경로 목록 (사무소 영업 설정) */
export function loadInboundPaths(): string[] {
  return getSalesSettings().inboundPaths;
}