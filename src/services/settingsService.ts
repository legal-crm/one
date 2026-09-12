import type { Partner, MissedCallIntervalTier, TelegramRoomTarget } from '../types/leadTypes';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';

const SETTINGS_KEY = 'rehab_policy_settings';

/**
 * 회생파산 정책/계산 기준 설정을 로드합니다.
 * localStorage에 저장된 값이 없으면 DEFAULT_SETTINGS를 반환합니다.
 */
export const fetchSettings = async (): Promise<AppSettings> => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  return Promise.resolve(stored ? JSON.parse(stored) : DEFAULT_SETTINGS);
};

/**
 * 회생파산 정책/계산 기준 설정을 저장합니다.
 */
export const updateSettings = async (settings: AppSettings): Promise<boolean> => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return Promise.resolve(true);
  } catch (e) {
    console.error('설정 저장 실패:', e);
    return Promise.resolve(false);
  }
};

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
