// 보정 때 자주 요구된 자료 미리 받기 (DP-7)
// 출시 때는 실제 보정권고 4건(광주·의정부·대구·인천)에서 의뢰인이 내야 했던 자료로 법원별 기본 묶음을 둔다.
// 보정 통계(CR-12)가 쌓이면 이 표를 통계로 바꾼다. 묶음은 '요청 제안'일 뿐이고 변호사가 고른 것만 의뢰인에게 간다.

export interface PrepItem {
  key: string;
  label: string;
  description: string;
}

export interface PrepBundle {
  id: 'common' | 'gwangju' | 'uijeongbu';
  title: string;
  match?: RegExp;
  items: PrepItem[];
}

export const CORRECTION_PREP_BUNDLES: PrepBundle[] = [
  {
    id: 'common',
    title: '공통 (여러 법원)',
    items: [
      { key: 'loan-use', label: '대출금 사용처 소명', description: '최근 대출(특히 신청 전 1년 안)마다 받은 돈을 어디에 썼는지 적고, 통장 내역 등 근거를 함께 내 주세요.' },
      { key: 'debt-growth', label: '채무가 늘어난 경위 설명', description: '처음 빚이 생긴 때부터 갚기 어려워진 때까지 순서대로 적어 주세요. 날짜와 금액을 알면 함께 적어 주세요.' },
    ],
  },
  {
    id: 'gwangju',
    title: '광주 지역 법원',
    match: /광주/,
    items: [
      { key: 'gj-insurance', label: '보험 가입 현황 표', description: '가입한 보험마다 보험사·상품·계약자·월 보험료·예상 해약환급금을 표로 정리해 주세요.' },
      { key: 'gj-housing5y', label: '최근 5년 주거 내역 표', description: '최근 5년 동안 살았던 곳마다 기간·주소·거주 형태(월세·전세·무상 등)·보증금을 적어 주세요.' },
      { key: 'gj-disposal', label: '재산 처분 내역 표', description: '최근 2년 안에 팔거나 넘긴 재산(차량·부동산·보증금 등)이 있으면 날짜·금액·받은 돈의 사용처를 적어 주세요.' },
      { key: 'gj-business', label: '영업 관련 자료 (사업자만)', description: '사업자라면 매출·매입 자료, 사업장 계약서, 폐업했다면 폐업 사실 증명을 내 주세요.' },
    ],
  },
  {
    id: 'uijeongbu',
    title: '의정부 지역 법원',
    match: /의정부/,
    items: [
      { key: 'uj-immigration', label: '출입국에 관한 사실증명', description: '정부24 또는 출입국·외국인관서에서 최근 기간의 출입국 사실증명을 발급받아 주세요.' },
      { key: 'uj-1m-table', label: '100만 원 이상 입출금 내역 표', description: '통장 거래 중 100만 원 이상 입금·출금마다 날짜·금액·상대방·사유를 표로 적어 주세요.' },
      { key: 'uj-closed', label: '해지한 계좌 거래내역', description: '최근 해지한 계좌가 있으면 해지 전까지의 거래내역서를 발급받아 주세요.' },
      { key: 'uj-spouse', label: '배우자 소득·재산 자료', description: '배우자의 소득 자료(원천징수영수증 등)와 배우자 명의 재산 자료를 내 주세요.' },
    ],
  },
];

/** 사건 관할 법원 이름으로 자동 선택할 묶음 */
export function bundlesForCourt(courtName: string | undefined): PrepBundle['id'][] {
  const ids: PrepBundle['id'][] = ['common'];
  CORRECTION_PREP_BUNDLES.forEach(b => { if (b.match && courtName && b.match.test(courtName)) ids.push(b.id); });
  return ids;
}
