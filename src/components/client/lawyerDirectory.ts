import type { User } from '../../types';

/* ─────────────────────────────────────────────
   변호사 찾기 공용 규칙 (LawyersView · LawyerCard · LawyerProfileModal)
   - 공개 여부, 표시용 정보 가공, 즐겨찾기 저장
   - 원칙: 변호사가 직접 등록했거나 플랫폼이 확인한 정보만 보여 준다
   ───────────────────────────────────────────── */

/** 관리자 자격 심사를 통과한(또는 정지·반려되지 않은) 변호사만 공개 디렉토리에 노출 */
export function isPubliclyListable(l: User): boolean {
  if (l.approved === false) return false;
  if (l.licenseStatus === 'pending' || l.licenseStatus === 'rejected' || l.licenseStatus === 'suspended') return false;
  return true;
}

/** 플랫폼이 변호사 등록번호를 확인한 경우에만 배지 표시 (대한변협 인증 표기는 사실과 다를 수 있어 사용하지 않음) */
export function isLicenseVerified(l: User): boolean {
  return l.licenseStatus === 'verified';
}

/** 광고 상품 이용 여부 (광고 표시는 전문성 인증이나 추천이 아님) */
export function isAdLawyer(l: User): boolean {
  return l.adTier === 'top' || l.adTier === 'regional' || l.adTier === 'basic';
}

/** certYear 문자열에서 경력년수 계산 (예: "제8회 변호사시험 합격 (2019년)" → 7) */
export function getExperienceYears(certYear?: string): number | null {
  if (!certYear) return null;
  const match = certYear.match(/(\d{4})년/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const diff = new Date().getFullYear() - year;
  return diff > 0 ? diff : 1;
}

/** firmName 또는 career 첫 항목에서 소속명만 추출 (직함 제거) */
export function getAffiliation(l: User): string | null {
  if (l.firmName) return l.firmName;
  if (l.firm) return l.firm;
  if (l.career && l.career.length > 0) {
    return l.career[0].replace(/\s*(대표변호사|파트너변호사|소속변호사|변호사|대표|파트너|구성원|소속)$/g, '').trim() || null;
  }
  return null;
}

/** 화면 표시용 이름 ('변호사' 접미사 제거) */
export function getDisplayName(l: User): string {
  return l.name.replace(/\s*변호사$/, '');
}

export function getAvatarSrc(l: User): string {
  return l.avatarData || l.avatar;
}

// ── 즐겨찾기 (이 기기에만 저장. 내 관리방의 '즐겨찾기한 변호사에게 요청'과 같은 키를 쓴다) ──
export const FAVORITES_KEY = 'lawyer_favorites';

export function loadFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[]);
  } catch {
    return new Set<string>();
  }
}

export function saveFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    /* 저장 공간 부족·비공개 모드는 무시 (화면 상태는 유지) */
  }
}

/** 사무소 소재지 필터 (변호사 region 문자열에 포함되는지로 판정) */
export const LAWYER_REGIONS = [
  '전체',
  '서울',
  '경기',
  '인천/부천',
  '춘천/강원',
  '대전/충남/세종',
  '청주/충북',
  '대구/경북',
  '부산/울산/경남',
  '광주/전남',
  '전주/전북',
  '제주',
] as const;
export type LawyerRegion = (typeof LAWYER_REGIONS)[number];
