/**
 * 1차 실물 서류(등기/택배) 배송추적 유틸리티
 * - 우체국 빠른등기, 편의점 택배(GS25, CU, 세븐일레븐, 이마트24), 일반 택배사 지원
 * - 원클릭 공식 배송조회 URL 생성 및 라벨 매핑
 */

export interface CarrierOption {
  code: string;
  name: string;
  category: 'EPOST' | 'CVS' | 'PARCEL' | 'DIRECT';
  badge: string;
  urlGenerator?: (trackingNumber: string) => string;
}

export const CARRIER_LIST: CarrierOption[] = [
  {
    code: 'EPOST',
    name: '우체국 빠른등기 / 택배',
    category: 'EPOST',
    badge: '📮 우체국 (추천)',
    urlGenerator: (no) => `https://service.epost.go.kr/trace.RetrieveDomRcvTraceList.comm?sid1=${encodeURIComponent(no)}`,
  },
  {
    code: 'GS25',
    name: 'GS25 편의점택배 (포스트박스/반값)',
    category: 'CVS',
    badge: '🏪 GS25 편의점',
    urlGenerator: (no) => `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${encodeURIComponent(no)}`,
  },
  {
    code: 'CU',
    name: 'CU 편의점택배 (CUpost/알뜰)',
    category: 'CVS',
    badge: '🏪 CU 편의점',
    urlGenerator: (no) => `https://www.cupost.co.kr/postbox/delivery/localResult.cupost?inv_no=${encodeURIComponent(no)}`,
  },
  {
    code: 'SEVEN',
    name: '세븐일레븐 편의점택배',
    category: 'CVS',
    badge: '🏪 세븐일레븐',
    urlGenerator: (no) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encodeURIComponent(no)}`,
  },
  {
    code: 'EMART24',
    name: '이마트24 편의점택배',
    category: 'CVS',
    badge: '🏪 이마트24',
    urlGenerator: (no) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(no)}`,
  },
  {
    code: 'CJ',
    name: 'CJ대한통운',
    category: 'PARCEL',
    badge: '🚚 CJ대한통운',
    urlGenerator: (no) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(no)}`,
  },
  {
    code: 'HANJIN',
    name: '한진택배',
    category: 'PARCEL',
    badge: '🚚 한진택배',
    urlGenerator: (no) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(no)}`,
  },
  {
    code: 'LOTTE',
    name: '롯데택배',
    category: 'PARCEL',
    badge: '🚚 롯데택배',
    urlGenerator: (no) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encodeURIComponent(no)}`,
  },
  {
    code: 'LOGEN',
    name: '로젠택배',
    category: 'PARCEL',
    badge: '🚚 로젠택배',
    urlGenerator: (no) => `https://www.ilogen.com/web/personal/trace/${encodeURIComponent(no)}`,
  },
  {
    code: 'DIRECT',
    name: '사무소 직접 방문 제출',
    category: 'DIRECT',
    badge: '🏢 방문 제출',
  },
];

/**
 * 배송사 코드 및 운송장번호로 공식 배송조회 URL 생성
 */
export function getCarrierTrackingUrl(carrierCode: string | undefined, trackingNumber: string | undefined): string | null {
  if (!trackingNumber) return null;
  const cleanNumber = trackingNumber.replace(/[^0-9]/g, '');
  if (!cleanNumber) return null;

  const targetCarrier = CARRIER_LIST.find(c => c.code === carrierCode) || CARRIER_LIST[0]; // 기본값: 우체국
  if (!targetCarrier.urlGenerator) return null;

  return targetCarrier.urlGenerator(cleanNumber);
}

/**
 * 배송사 코드로 라벨/뱃지 텍스트 반환
 */
export function getCarrierLabel(carrierCode: string | undefined): string {
  if (!carrierCode) return '우체국 빠른등기';
  const found = CARRIER_LIST.find(c => c.code === carrierCode);
  return found ? found.name : carrierCode;
}
