import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

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
