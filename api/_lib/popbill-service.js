// PopBill 전자세금계산서 서비스 헬퍼
// Vercel Serverless Functions에서 공통으로 사용

import popbill from 'popbill';

// 팝빌 설정 초기화
popbill.config({
  LinkID: process.env.POPBILL_LINK_ID || 'MONSTERLAB',
  SecretKey: process.env.POPBILL_SECRET_KEY || '',
  // 팝빌 운영(Production) 환경 승인 완료 -> 기본값 false (운영 모드)
  IsTest: process.env.POPBILL_IS_TEST === 'true',
  IPRestrictOnOff: false, // Vercel 서버리스 유동 IP 환경 대응
  UseStaticIP: false,
  UseLocalTimeYN: true,
  defaultErrorHandler: (err) => {
    console.error('[PopBill Error]', err);
  }
});

// 공급자 (플랫폼 운영사) 정보 — 몬스터랩
export const SUPPLIER_INFO = {
  corpNum: process.env.POPBILL_CORP_NUM || '5213901355',        // 사업자등록번호 (하이픈 제거)
  corpName: '몬스터랩',
  ceoName: '진성호',
  bizType: '서비스업',
  bizClass: '소프트웨어 개발 및 공급',
  addr: '',                     // 필요 시 추가
  contactName: '진성호',
  contactEmail: process.env.POPBILL_CONTACT_EMAIL || '2882@daum.net',
  contactTEL: process.env.POPBILL_CONTACT_TEL || process.env.POPBILL_SENDER_PHONE || '01026060357',
};

// 팝빌 카카오/문자 연동 통합 설정
export const POPBILL_CONFIG = {
  corpNum: process.env.POPBILL_CORP_NUM || SUPPLIER_INFO.corpNum,
  userId: process.env.POPBILL_USER_ID || 'mykim99',
  plusFriendId: process.env.POPBILL_PLUS_FRIEND_ID || '@마이김변',
  senderPhone: process.env.POPBILL_SENDER_PHONE || process.env.POPBILL_CONTACT_TEL || SUPPLIER_INFO.contactTEL || '01026060357',
  isConfigured: Boolean((process.env.POPBILL_LINK_ID || 'MONSTERLAB') && (process.env.POPBILL_SECRET_KEY || '')),
  isTest: process.env.POPBILL_IS_TEST === 'true',
};

// 서비스 인스턴스
export const taxinvoiceService = popbill.TaxinvoiceService();
// 사업자 휴폐업 조회는 TaxinvoiceService가 아니라 ClosedownService에 있음 (이전: taxinvoiceService.checkCorpNum 호출 → 항상 실패)
export const closedownService = popbill.ClosedownService();
export const kakaoService = popbill.KakaoService();
export const messageService = popbill.MessageService();

// 오늘 날짜 문자열 (YYYYMMDD, 한국 시간)
// (이전: 서버 로컬 시간 — Vercel은 UTC라 한국 00:00~08:59에 작성일자가 '어제'로 발행됨)
export function getTodayStr() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// 팝빌 세금계산서 설정 여부 (LinkID·SecretKey 모두 필요)
export const isTaxinvoiceConfigured = Boolean(process.env.POPBILL_LINK_ID && process.env.POPBILL_SECRET_KEY);

// 사업자등록번호 체크섬 검증 (10자리)
export function isValidCorpNum(num) {
  const n = String(num || '').replace(/[^0-9]/g, '');
  if (!/^\d{10}$/.test(n)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[i]) * w[i];
  sum += Math.floor((Number(n[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(n[9]);
}

// CORS 헤더 설정
export { setCorsHeaders } from './cors-helper.js';
