/**
 * 회생·파산 자산 가치 산정 및 공적 조회 사이트 다이렉트 연동 유틸리티
 * 신우법무사 가이드 기준 11대 자산별 실무 검색 포털 딥링크 및 클립보드 복사 헬퍼
 */

export interface ExternalSearchPortal {
  id: string;
  name: string;
  category: 'realestate' | 'vehicle' | 'insurance_finance' | 'public_registry';
  badge: string;
  description: string;
  url: string;
  supportsSearchQuery: boolean;
  getSearchUrl?: (query: string) => string;
}

export const ASSET_SEARCH_PORTALS: Record<string, ExternalSearchPortal> = {
  // ── 1. 부동산 조회 포털 ──
  kb_realestate: {
    id: 'kb_realestate',
    name: 'KB부동산 시세',
    category: 'realestate',
    badge: '아파트/오피스텔 필수',
    description: '법원 인정 1순위 시세 기준 (일반평균가 확인)',
    url: 'https://kbland.kr',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://kbland.kr/search?keyword=${encodeURIComponent(query)}`,
  },
  realty_price: {
    id: 'realty_price',
    name: '부동산 공시가격 알리미',
    category: 'realestate',
    badge: '공시가격 130%',
    description: '빌라/연립/다세대/단독주택 공시가격 조회 (국토교통부)',
    url: 'https://www.realtyprice.kr',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://www.realtyprice.kr/notice/town/searchRenew.htm?query=${encodeURIComponent(query)}`,
  },
  molit_real_trade: {
    id: 'molit_real_trade',
    name: '국토교통부 실거래가 공개시스템',
    category: 'realestate',
    badge: '실거래가/상가',
    description: 'KB시세 미등록 단지 및 상가/오피스텔 최근 매매가 확인',
    url: 'https://rt.molit.go.kr',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://rt.molit.go.kr/pt/xls/xls.do?query=${encodeURIComponent(query)}`,
  },
  eum_land: {
    id: 'eum_land',
    name: '토지이음 (구 토지이용규제)',
    category: 'realestate',
    badge: '토지/임야 130%',
    description: '전·답·임야·대지 개별공시지가 및 지적도 조회',
    url: 'https://www.eum.go.kr',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://www.eum.go.kr/web/ar/lu/luLandDetSearch.do?query=${encodeURIComponent(query)}`,
  },
  iros_registry: {
    id: 'iros_registry',
    name: '대법원 인터넷등기소',
    category: 'public_registry',
    badge: '을구 근저당 확인',
    description: '부동산 등기사항전부증명서 및 근저당 채권최고액 확인',
    url: 'http://www.iros.go.kr',
    supportsSearchQuery: false,
  },

  // ── 2. 자동차 및 이륜차 조회 포털 ──
  encar: {
    id: 'encar',
    name: '엔카 (Encar)',
    category: 'vehicle',
    badge: '중고차 시세 1순위',
    description: '대표 중고차 거래 플랫폼 실매물 평균 시세 확인',
    url: 'http://www.encar.com',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `http://www.encar.com/dc/dc_carsearchlist.do?carSearch=${encodeURIComponent(query)}`,
  },
  kb_chachacha: {
    id: 'kb_chachacha',
    name: 'KB차차차',
    category: 'vehicle',
    badge: '중고차 2순위 비교',
    description: 'KB캐피탈 공인 중고차 국민시세 및 감정가 확인',
    url: 'https://www.kbchachacha.com',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://www.kbchachacha.com/public/search/main.kbc?query=${encodeURIComponent(query)}`,
  },
  kidi_car: {
    id: 'kidi_car',
    name: '보험개발원 차량기준가액',
    category: 'vehicle',
    badge: '법원 공식가액',
    description: '자동차 등록원부 차명/형식에 따른 분기별 법정 기준가액',
    url: 'https://www.kidi.or.kr/user/car/carSearch.do',
    supportsSearchQuery: false,
  },
  passo_bike: {
    id: 'passo_bike',
    name: '파쏘 (PASSO) 오토바이',
    category: 'vehicle',
    badge: '이륜차 시세',
    description: '오토바이/바이크 중고 시세 및 시세표 조회',
    url: 'https://bike.passo.co.kr',
    supportsSearchQuery: true,
    getSearchUrl: (query: string) => `https://bike.passo.co.kr/bike/search.php?keyword=${encodeURIComponent(query)}`,
  },
  ecar_portal: {
    id: 'ecar_portal',
    name: '자동차 365 / 대국민포털',
    category: 'public_registry',
    badge: '등록원부 저당확인',
    description: '자동차등록원부(갑/을) 저당권 및 압류 내역 조회',
    url: 'https://www.car365.go.kr',
    supportsSearchQuery: false,
  },

  // ── 3. 보험 및 금융 조회 포털 ──
  credit4u: {
    id: 'credit4u',
    name: '내보험다보여 (신용정보원)',
    category: 'insurance_finance',
    badge: '전체 보험가입내역',
    description: '가입 보험 증권 및 보장 내역 전수 조회 (본인인증)',
    url: 'https://www.credit4u.or.kr',
    supportsSearchQuery: false,
  },
  payinfo: {
    id: 'payinfo',
    name: '어카운트인포 (계좌정보통합)',
    category: 'insurance_finance',
    badge: '전체 예금/보험 환급금',
    description: '금융결제원 전 계좌 잔액 및 휴면/해약환급금 통합 조회',
    url: 'https://www.payinfo.or.kr',
    supportsSearchQuery: false,
  },
  insure_finder: {
    id: 'insure_finder',
    name: '내보험 찾아줌 (생·손보협회)',
    category: 'insurance_finance',
    badge: '숨은 보험금/환급금',
    description: '생명·손해보험협회 미청구 보험금 및 해약환급금 조회',
    url: 'https://cont.insure.or.kr',
    supportsSearchQuery: false,
  },
  nps_severance: {
    id: 'nps_severance',
    name: '국민연금공단 (가입내역조회)',
    category: 'insurance_finance',
    badge: '재직/연금 확인',
    description: '국민연금 가입증명서 및 직장 근속연수 확인',
    url: 'https://www.nps.or.kr',
    supportsSearchQuery: false,
  },
};

/**
 * 포털 열기 및 검색 키워드 클립보드 복사 헬퍼
 * @param portalKey 포털 식별자
 * @param query 검색 키워드 (주소, 차종 등)
 * @returns 복사 성공 여부
 */
export async function openExternalSearchPortal(
  portalKey: keyof typeof ASSET_SEARCH_PORTALS,
  query?: string
): Promise<{ success: boolean; copiedQuery?: string; targetUrl: string }> {
  const portal = ASSET_SEARCH_PORTALS[portalKey];
  if (!portal) {
    return { success: false, targetUrl: '' };
  }

  let targetUrl = portal.url;
  const cleanQuery = query?.trim() || '';

  if (cleanQuery && portal.supportsSearchQuery && portal.getSearchUrl) {
    targetUrl = portal.getSearchUrl(cleanQuery);
  }

  // 검색어가 있으면 클립보드에 복사하여 붙여넣기 편의성 제공
  let copiedQuery: string | undefined;
  if (cleanQuery && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(cleanQuery);
      copiedQuery = cleanQuery;
    } catch {
      // 클립보드 실패 시 무시하고 진행
    }
  }

  window.open(targetUrl, '_blank', 'noopener,noreferrer');

  return {
    success: true,
    copiedQuery,
    targetUrl,
  };
}
