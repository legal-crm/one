import type { Partner, MissedCallIntervalTier, TelegramRoomTarget } from '../types/leadTypes';
import type { AppSettings, CourtConfig } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
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

export const SETTINGS_STORAGE_KEYS = {
  STATUSES: 'legal_crm_statuses',
  SECONDARY_STATUSES: 'legal_crm_secondary_statuses',
  TERTIARY_STATUSES: 'legal_crm_tertiary_statuses',
  PARTNERS: 'legal_crm_partners',
  INBOUND_PATHS: 'legal_crm_inbound_paths',
  INTERVAL_TIERS: 'legal_crm_interval_tiers',
  TELEGRAM_ROOMS: 'legal_crm_telegram_rooms',
  AI_PROMPTS: 'legal_crm_ai_prompts',
};

// 기본 인입 경로
export const DEFAULT_INBOUND_PATHS: string[] = [
  '타사DB구매',
  '네이버 파워링크',
  '블로그/콘텐츠',
  '유튜브 채널',
  '메타(페이스북/인스타)',
  '지인 소개',
  '당근마켓',
  '카카오톡 채널',
  '기타'
];

// 기본 1차 상태
export const DEFAULT_STATUSES: string[] = [
  '신규접수',
  '1차통화',
  '재통화예약',
  '상담진행',
  '접수완료',
  '수임계약',
  '보류',
  '종결'
];

// 기본 2차 상태 (실무 세부 상태)
export const DEFAULT_SECONDARY_STATUSES: string[] = [
  '부재1차',
  '부재2차',
  '부재3차이상',
  '재통화예약',
  '사무장상담',
  '서류보완요청',
  '단순변심',
  '자격미달',
  '결번/오류'
];

// 기본 부재중 티어 (시간별 경고 색상)
export const DEFAULT_INTERVAL_TIERS: MissedCallIntervalTier[] = [
  { id: 'tier-1', label: '1차 (30분 경과)', minutes: 30, color: 'text-amber-500' },
  { id: 'tier-2', label: '2차 (1시간 경과)', minutes: 60, color: 'text-orange-600' },
  { id: 'tier-3', label: '3차 (2시간 경과)', minutes: 120, color: 'text-red-600' },
  { id: 'tier-4', label: '장기 부재 (24시간 이상)', minutes: 1440, color: 'text-rose-700' },
];

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = secureGetItem(key) || localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(`[settingsService] Failed to load ${key}`, e);
  }
  return fallback;
}

function setStored<T>(key: string, val: T): void {
  try {
    const str = JSON.stringify(val);
    secureSetItem(key, str);
    localStorage.setItem(key, str);
  } catch (e) {
    console.warn(`[settingsService] Failed to save ${key}`, e);
  }
}

// ── 1. 인입 경로(Inbound Paths) ──
export function loadInboundPaths(): string[] {
  return getStored<string[]>(SETTINGS_STORAGE_KEYS.INBOUND_PATHS, DEFAULT_INBOUND_PATHS);
}

export function saveInboundPaths(paths: string[]): void {
  setStored(SETTINGS_STORAGE_KEYS.INBOUND_PATHS, paths);
}

export function addInboundPath(path: string): string[] {
  const current = loadInboundPaths();
  if (!current.includes(path.trim())) {
    const updated = [...current, path.trim()];
    saveInboundPaths(updated);
    return updated;
  }
  return current;
}

export function deleteInboundPath(path: string): string[] {
  const current = loadInboundPaths();
  const updated = current.filter(p => p !== path);
  saveInboundPaths(updated);
  return updated;
}

// ── 2. 상태(Statuses) 및 2차/3차 상태 ──
export function loadStatuses(): string[] {
  return getStored<string[]>(SETTINGS_STORAGE_KEYS.STATUSES, DEFAULT_STATUSES);
}

export function saveStatuses(statuses: string[]): void {
  setStored(SETTINGS_STORAGE_KEYS.STATUSES, statuses);
}

export function loadSecondaryStatuses(): string[] {
  return getStored<string[]>(SETTINGS_STORAGE_KEYS.SECONDARY_STATUSES, DEFAULT_SECONDARY_STATUSES);
}

export function saveSecondaryStatuses(list: string[]): void {
  setStored(SETTINGS_STORAGE_KEYS.SECONDARY_STATUSES, list);
}

export function loadTertiaryStatuses(): Record<string, string[]> {
  return getStored<Record<string, string[]>>(SETTINGS_STORAGE_KEYS.TERTIARY_STATUSES, {});
}

export function saveTertiaryStatuses(data: Record<string, string[]>): void {
  setStored(SETTINGS_STORAGE_KEYS.TERTIARY_STATUSES, data);
}

// ── 3. 파트너사 및 수수료 룰 ──
export function loadPartners(): Partner[] {
  return getStored<Partner[]>(SETTINGS_STORAGE_KEYS.PARTNERS, [
    {
      id: 'partner-default',
      name: '자체 마케팅 (직접 인입)',
      rules: [],
      memo: '사무소 자체 유입',
      createdAt: new Date().toISOString(),
    }
  ]);
}

export function savePartners(partners: Partner[]): void {
  setStored(SETTINGS_STORAGE_KEYS.PARTNERS, partners);
}

// ── 4. 부재중 티어 설정 ──
export function loadIntervalTiers(): MissedCallIntervalTier[] {
  return getStored<MissedCallIntervalTier[]>(SETTINGS_STORAGE_KEYS.INTERVAL_TIERS, DEFAULT_INTERVAL_TIERS);
}

export function saveIntervalTiers(tiers: MissedCallIntervalTier[]): void {
  setStored(SETTINGS_STORAGE_KEYS.INTERVAL_TIERS, tiers);
}

// ── 5. 텔레그램 연동 ──
export function loadTelegramRooms(): TelegramRoomTarget[] {
  return getStored<TelegramRoomTarget[]>(SETTINGS_STORAGE_KEYS.TELEGRAM_ROOMS, []);
}

export function saveTelegramRooms(rooms: TelegramRoomTarget[]): void {
  setStored(SETTINGS_STORAGE_KEYS.TELEGRAM_ROOMS, rooms);
}
