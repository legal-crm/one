// ============================================================
// 법률사무소(대리인) 정보 — 법원 서식·알림 문구의 대리인 기본값
// 이전에는 특정 사무소('법률사무소 보광', '정충원' 변호사, 주소·전화·이메일)가
// 모든 변호사의 법원 서식·알림톡 기본값으로 하드코딩되어 있었다.
// 이제 [알림 및 설정 > 사업자 정보]에 저장한 값만 사용하고, 없으면 빈 값으로 둔다.
// ============================================================

import { loadLawyerBusinessInfo } from '../taxInvoiceService';

export interface OfficeProfile {
  firmName: string;
  lawyerName: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
}

/**
 * @param lawyerName 로그인한 변호사 이름 (예: '홍길동 변호사') — 서식에는 '변호사'를 뺀 이름을 쓰는 곳이 있어 원문 그대로 반환
 */
export function getOfficeProfile(lawyerName?: string): OfficeProfile {
  let biz: ReturnType<typeof loadLawyerBusinessInfo> = null;
  try {
    biz = loadLawyerBusinessInfo();
  } catch {
    biz = null;
  }
  return {
    firmName: biz?.corpName || '',
    lawyerName: (lawyerName || '').trim(),
    address: biz?.addr || '',
    phone: '',
    fax: '',
    email: biz?.taxEmail || '',
  };
}
