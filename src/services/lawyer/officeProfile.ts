// ============================================================
// 법률사무소(대리인) 정보 — 법원 서식·알림 문구·계약서의 대리인 기본값
// 원본: 서버 office_billing_profiles (광고·결제 > 사업자 정보). 로그인 때 한 번 읽어 메모리에 둔다.
// 저장된 값이 없으면 빈 값 (이전: 특정 사무소 이름·주소 하드코딩 → 브라우저 사업자 정보)
// ============================================================

import { fetchBillingProfile, type OfficeBillingProfile } from '../adOrderService';

export interface OfficeProfile {
  firmName: string;
  lawyerName: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
}

let cachedOfficeId = '';
let cached: OfficeBillingProfile | null = null;

/** 로그인한 사무소의 사업자 정보를 서버에서 읽어 둔다 (실패하면 빈 값 유지, 오류 문장 반환) */
export async function loadOfficeProfile(officeId: string | undefined | null): Promise<string | null> {
  const id = (officeId || '').trim();
  if (!id) { cachedOfficeId = ''; cached = null; return null; }
  const r = await fetchBillingProfile(id);
  if (r.ok === false) return r.message;
  cachedOfficeId = id;
  cached = r.data;
  return null;
}

/** 사업자 정보를 저장한 뒤 화면 값도 바로 바꾼다 */
export function setOfficeProfileCache(profile: OfficeBillingProfile | null): void {
  cached = profile;
  cachedOfficeId = profile?.officeId || cachedOfficeId;
}

/**
 * @param lawyerName 로그인한 변호사 이름 (예: '홍길동 변호사') — 서식에는 '변호사'를 뺀 이름을 쓰는 곳이 있어 원문 그대로 반환
 */
export function getOfficeProfile(lawyerName?: string): OfficeProfile {
  const biz = cachedOfficeId ? cached : null;
  return {
    firmName: biz?.corpName || '',
    lawyerName: (lawyerName || '').trim(),
    address: biz?.address || '',
    phone: biz?.contactPhone || '',
    fax: '',
    email: biz?.email || '',
  };
}
