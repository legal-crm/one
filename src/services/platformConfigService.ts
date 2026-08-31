import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type { PlatformConfig, PopupConfig, AppSettings } from '../types';
import { initialPlatformConfig, initialPopupConfig } from '../data';
import { DEFAULT_SETTINGS } from '../constants';

// ============================================================
// PlatformConfig Supabase Hybrid Sync Service
// 플랫폼 설정 데이터 관리: localStorage 우선 저장 후 Supabase upsert 동기화
// ============================================================

const PLATFORM_CONFIG_KEY = 'legal_crm_platform_config';
const POPUP_CONFIG_KEY = 'legal_crm_popup_config';
const MATCHING_COOLDOWN_KEY = 'legal_crm_matching_cooldown_hours';
const REHAB_POLICY_KEY = 'rehab_policy_settings';

interface ConfigRow<T = any> {
  id: string;
  data: T;
  updated_at: string;
}

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`[PlatformConfigService] localStorage 저장 실패 (${key}):`, e);
  }
}

function logSupabaseError(operation: string, error: any) {
  const errorDetail = typeof error === 'object' ? (error?.message || error?.code || JSON.stringify(error)) : String(error);
  console.error(`[PlatformConfigService] ${operation} 실패: ${errorDetail}`, error);
}

// ── 변환 함수 (TypeScript camelCase <-> DB snake_case / JSONB Row) ──

function toRow<T>(id: string, data: T): ConfigRow<T> {
  return {
    id,
    data,
    updated_at: new Date().toISOString(),
  };
}

function fromRow<T>(row: any, fallback: T): T {
  if (!row) return fallback;
  return (row.data !== undefined && row.data !== null) ? (row.data as T) : fallback;
}

// ============================================================
// 1. Platform Config (기본 플랫폼 설정)
// table: platform_config, key: legal_crm_platform_config, id: 'main'
// ============================================================

/**
 * 플랫폼 설정 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백
 */
export async function loadPlatformConfig(): Promise<PlatformConfig | any> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (error) {
        logSupabaseError('loadPlatformConfig', error);
      } else if (data && data.data) {
        const config = fromRow<PlatformConfig>(data, initialPlatformConfig);
        setLocalData(PLATFORM_CONFIG_KEY, config);
        return config;
      }
    } catch (e) {
      logSupabaseError('loadPlatformConfig (exception)', e);
    }
  }

  return getLocalData<PlatformConfig>(PLATFORM_CONFIG_KEY, initialPlatformConfig);
}

/**
 * 플랫폼 설정 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function savePlatformConfig(config: any): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(PLATFORM_CONFIG_KEY, config);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const row = toRow('main', config);
      const { error } = await supabase
        .from('platform_config')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        logSupabaseError('savePlatformConfig', error);
      }
    } catch (e) {
      logSupabaseError('savePlatformConfig (exception)', e);
    }
  }
}

// ============================================================
// 2. Popup Config (팝업 설정)
// table: popup_config, key: legal_crm_popup_config, id: 'main'
// ============================================================

/**
 * 팝업 설정 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백
 */
export async function loadPopupConfig(): Promise<PopupConfig | any> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('popup_config')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (error) {
        logSupabaseError('loadPopupConfig', error);
      } else if (data && data.data) {
        const config = fromRow<PopupConfig>(data, initialPopupConfig);
        setLocalData(POPUP_CONFIG_KEY, config);
        return config;
      }
    } catch (e) {
      logSupabaseError('loadPopupConfig (exception)', e);
    }
  }

  return getLocalData<PopupConfig>(POPUP_CONFIG_KEY, initialPopupConfig);
}

/**
 * 팝업 설정 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function savePopupConfig(config: any): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(POPUP_CONFIG_KEY, config);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const row = toRow('main', config);
      const { error } = await supabase
        .from('popup_config')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        logSupabaseError('savePopupConfig', error);
      }
    } catch (e) {
      logSupabaseError('savePopupConfig (exception)', e);
    }
  }
}

// ============================================================
// 3. Matching Cooldown (매칭 쿨다운 시간 설정)
// table: matching_config, key: legal_crm_matching_cooldown_hours, id: 'main'
// ============================================================

/**
 * 매칭 쿨다운 시간 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백
 */
export async function loadMatchingCooldown(): Promise<number> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('matching_config')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (error) {
        logSupabaseError('loadMatchingCooldown', error);
      } else if (data && data.data !== undefined && data.data !== null) {
        const rawCooldown = typeof data.data === 'number' ? data.data : Number(data.data?.hours ?? data.data);
        const cooldown = isNaN(rawCooldown) ? 24 : rawCooldown;
        setLocalData(MATCHING_COOLDOWN_KEY, cooldown);
        return cooldown;
      }
    } catch (e) {
      logSupabaseError('loadMatchingCooldown (exception)', e);
    }
  }

  const stored = getLocalData<number>(MATCHING_COOLDOWN_KEY, 24);
  const num = typeof stored === 'number' ? stored : Number(stored);
  return isNaN(num) ? 24 : num;
}

/**
 * 매칭 쿨다운 시간 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function saveMatchingCooldown(hours: number): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(MATCHING_COOLDOWN_KEY, hours);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const row = toRow('main', hours);
      const { error } = await supabase
        .from('matching_config')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveMatchingCooldown', error);
      }
    } catch (e) {
      logSupabaseError('saveMatchingCooldown (exception)', e);
    }
  }
}

// ============================================================
// 4. Rehab Policy Settings (회생/파산 정책 설정)
// table: rehab_policy_settings, key: rehab_policy_settings, id: 'main'
// ============================================================

/**
 * 회생/파산 정책 설정 로드
 * Supabase 우선 조회 후 실패 시 localStorage 폴백
 */
export async function loadRehabPolicySettings(): Promise<AppSettings | any> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('rehab_policy_settings')
        .select('*')
        .eq('id', 'main')
        .maybeSingle();

      if (error) {
        logSupabaseError('loadRehabPolicySettings', error);
      } else if (data && data.data) {
        const settings = fromRow<AppSettings>(data, DEFAULT_SETTINGS);
        setLocalData(REHAB_POLICY_KEY, settings);
        return settings;
      }
    } catch (e) {
      logSupabaseError('loadRehabPolicySettings (exception)', e);
    }
  }

  return getLocalData<AppSettings>(REHAB_POLICY_KEY, DEFAULT_SETTINGS);
}

/**
 * 회생/파산 정책 설정 저장
 * localStorage에 먼저 저장한 후 Supabase upsert
 */
export async function saveRehabPolicySettings(settings: any): Promise<void> {
  // 1. LocalStorage 저장
  setLocalData(REHAB_POLICY_KEY, settings);

  // 2. Supabase 동기화
  if (isSupabaseConfigured) {
    try {
      const row = toRow('main', settings);
      const { error } = await supabase
        .from('rehab_policy_settings')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        logSupabaseError('saveRehabPolicySettings', error);
      }
    } catch (e) {
      logSupabaseError('saveRehabPolicySettings (exception)', e);
    }
  }
}
