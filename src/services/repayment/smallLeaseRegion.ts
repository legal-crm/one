// ============================================================
// 소액임차보증금 지역 구분 (LS-9) — 주택임대차보호법 시행령 제10조·제11조 (2023-02-21 시행분)
//  1. 서울특별시
//  2. 수도권정비계획법상 과밀억제권역(서울 제외), 세종특별자치시, 용인시, 화성시, 김포시
//  3. 광역시(과밀억제권역에 포함된 지역과 군 지역 제외), 안산시, 광주시(경기), 파주시, 이천시, 평택시
//  4. 그 밖의 지역
// 과밀억제권역(수도권정비계획법 시행령 별표 1): 인천(강화·옹진 및 서구 일부·경제자유구역 등 제외), 의정부, 구리,
//   남양주(호평·평내·금곡·일패·이패·삼패·가운·수석·지금·도농동만), 하남, 고양, 수원, 성남, 안양, 부천, 광명, 과천, 의왕, 군포, 시흥(반월특수지역 제외)
// 일부 동만 들어가는 곳(남양주·인천 서구·시흥)은 '확인 필요'로 돌려준다.
// 이전: 지역 표(constants.ts)에 화성시 '그 밖', 세종 '그 밖', 부산 '그 밖', 대구 달성·군위군 '광역시' 같은 오류와
//       없어진 행정구역(청원군·연기군·당진군·여주군, '동탄시')이 섞여 있었다.
// ============================================================
import type { RegionKey } from '../../types';

export interface SmallLeaseRegionResult { region: RegionKey; needsCheck: boolean; reason: string }

const OVERCROWDED_CITIES = ['의정부시', '구리시', '하남시', '고양시', '수원시', '성남시', '안양시', '부천시', '광명시', '과천시', '의왕시', '군포시'];
const SPECIAL_OVERCROWDED = ['세종', '용인시', '화성시', '김포시'];
const METRO_EXTRA = ['안산시', '파주시', '이천시', '평택시'];
const METRO_CITIES = ['부산', '대구', '광주광역시', '대전', '울산'];
const METRO_COUNTIES = ['기장군', '달성군', '군위군', '울주군'];
const NAMYANGJU_DONGS = ['호평동', '평내동', '금곡동', '일패동', '이패동', '삼패동', '가운동', '수석동', '지금동', '도농동'];

/** 주소(또는 시·군·구 이름)로 소액임차 지역을 정한다 */
export function smallLeaseRegionFor(address: string): SmallLeaseRegionResult {
  const a = String(address || '').replace(/\s+/g, ' ').trim();
  if (!a) return { region: 'Others', needsCheck: true, reason: '주소가 없어요' };
  if (/서울/.test(a)) return { region: 'Seoul', needsCheck: false, reason: '서울특별시' };
  if (/인천/.test(a)) {
    if (/강화군|옹진군/.test(a)) return { region: 'Others', needsCheck: false, reason: '인천 강화·옹진(과밀억제권역 제외)' };
    if (/서구/.test(a) || /송도|청라|영종/.test(a)) return { region: 'Overcrowded', needsCheck: true, reason: '인천 서구·경제자유구역 일부는 과밀억제권역이 아니에요' };
    return { region: 'Overcrowded', needsCheck: false, reason: '인천(과밀억제권역)' };
  }
  if (/남양주/.test(a)) {
    const inside = NAMYANGJU_DONGS.some(d => a.includes(d));
    if (inside) return { region: 'Overcrowded', needsCheck: false, reason: '남양주 과밀억제권역 동' };
    return { region: 'Others', needsCheck: !/(진접|오남|화도|와부|별내|퇴계원|조안|수동|다산)/.test(a), reason: '남양주는 일부 동만 과밀억제권역이에요' };
  }
  if (/시흥/.test(a)) return { region: 'Overcrowded', needsCheck: /반월|정왕|시화/.test(a), reason: '시흥(반월특수지역 제외)' };
  if (OVERCROWDED_CITIES.some(c => a.includes(c) || a.includes(c.replace(/시$/, '')))) return { region: 'Overcrowded', needsCheck: false, reason: '과밀억제권역' };
  if (SPECIAL_OVERCROWDED.some(c => a.includes(c) || a.includes(c.replace(/시$/, '')))) return { region: 'Overcrowded', needsCheck: false, reason: '세종·용인·화성·김포(시행령 제10조 2호)' };
  if (/경기.*광주|광주시/.test(a) && !/광주광역시/.test(a)) return { region: 'Metro', needsCheck: false, reason: '경기 광주시(시행령 제10조 3호)' };
  if (METRO_EXTRA.some(c => a.includes(c) || a.includes(c.replace(/시$/, '')))) return { region: 'Metro', needsCheck: false, reason: '안산·광주·파주·이천·평택(시행령 제10조 3호)' };
  if (METRO_CITIES.some(c => a.includes(c))) {
    if (METRO_COUNTIES.some(c => a.includes(c))) return { region: 'Others', needsCheck: false, reason: '광역시의 군 지역' };
    return { region: 'Metro', needsCheck: false, reason: '광역시' };
  }
  return { region: 'Others', needsCheck: false, reason: '그 밖의 지역' };
}

/** 없어진 행정구역 이름 → 지금 이름 (지역 표 정리용) */
export const RENAMED_DISTRICTS: Record<string, string> = {
  '청원군': '청주시 청원구', '연기군': '세종시', '당진군': '당진시', '여주군': '여주시', '동탄시': '화성시',
};
