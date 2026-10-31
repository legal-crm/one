// ============================================================
// 법률사무소(대리인) 정보 — 법원 서식·알림 문구·계약서·제안서의 사무소 정보 원본 (ST-3)
// 원본: 서버 office_settings.profile (설정 > 사무소 설정 > 사무소 정보).
// 비어 있는 칸은 광고·결제 사업자 정보(office_billing_profiles)로 채운다. 로그인 때 한 번 읽어 메모리에 둔다.
// 저장된 값이 없으면 빈 값 (가짜 기본값 금지 — 화면이 '사무소 정보에서 입력해 주세요'를 띄운다)
// ============================================================

import { fetchBillingProfile, type OfficeBillingProfile } from '../adOrderService';
import { loadOfficeSettings } from '../office/officeSettingsService';

export interface OfficeProfile {
  firmName: string;
  lawyerName: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
}

/** 설정 화면에서 고치는 사무소 정보 */
export interface OfficeProfileSettings {
  firmName?: string;
  representative?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  bizNumber?: string;
}

let cachedOfficeId = '';
let cached: OfficeBillingProfile | null = null;
let settings: OfficeProfileSettings = {};

/** 로그인한 사무소 정보를 서버에서 읽어 둔다 (실패하면 빈 값 유지, 오류 문장 반환) */
export async function loadOfficeProfile(officeId: string | undefined | null): Promise<string | null> {
  const id = (officeId || '').trim();
  if (!id) { cachedOfficeId = ''; cached = null; settings = {}; return null; }
  const [b, s] = await Promise.all([fetchBillingProfile(id), loadOfficeSettings<OfficeProfileSettings & Record<string, unknown>>(id, 'profile')]);
  cachedOfficeId = id;
  if (b.ok) cached = b.data;
  if (s.ok) settings = s.data?.data || {};
  if (b.ok === false) return b.message;
  if (s.ok === false) return s.message;
  return null;
}

/** 사업자 정보를 저장한 뒤 화면 값도 바로 바꾼다 */
export function setOfficeProfileCache(profile: OfficeBillingProfile | null): void {
  cached = profile;
  cachedOfficeId = profile?.officeId || cachedOfficeId;
}

/** 사무소 정보를 저장한 뒤 화면 값도 바로 바꾼다 */
export function setOfficeProfileSettingsCache(s: OfficeProfileSettings): void {
  settings = { ...s };
}

export function getOfficeProfileSettings(): OfficeProfileSettings { return { ...settings }; }

/**
 * @param lawyerName 로그인한 변호사 이름 (예: '홍길동 변호사') — 서식에는 '변호사'를 뺀 이름을 쓰는 곳이 있어 원문 그대로 반환
 */
export function getOfficeProfile(lawyerName?: string): OfficeProfile {
  const biz = cachedOfficeId ? cached : null;
  const s = cachedOfficeId ? settings : {};
  const pick = (a?: string, b?: string | null) => (a && a.trim()) || (b && b.trim()) || '';
  return {
    firmName: pick(s.firmName, biz?.corpName),
    lawyerName: (lawyerName || '').trim(),
    address: pick(s.address, biz?.address),
    phone: pick(s.phone, biz?.contactPhone),
    fax: pick(s.fax),
    email: pick(s.email, biz?.email),
  };
}
