// PopBill 전자세금계산서 서비스 헬퍼
// Vercel Serverless Functions에서 공통으로 사용

import popbill from 'popbill';

// 팝빌 설정 초기화
popbill.config({
  LinkID: process.env.POPBILL_LINK_ID || '',
  SecretKey: process.env.POPBILL_SECRET_KEY || '',
  IsTest: process.env.POPBILL_IS_TEST === 'true',
  IPRestrictOnOff: true,
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
  contactEmail: process.env.POPBILL_CONTACT_EMAIL || '',
  contactTEL: process.env.POPBILL_CONTACT_TEL || process.env.POPBILL_SENDER_PHONE || '',
};

// 팝빌 카카오/문자 연동 통합 설정
export const POPBILL_CONFIG = {
  corpNum: process.env.POPBILL_CORP_NUM || SUPPLIER_INFO.corpNum,
  userId: process.env.POPBILL_USER_ID || 'monsterlab',
  plusFriendId: process.env.POPBILL_PLUS_FRIEND_ID || '@mykim',
  senderPhone: process.env.POPBILL_SENDER_PHONE || process.env.POPBILL_CONTACT_TEL || SUPPLIER_INFO.contactTEL || '1544-0000',
  isConfigured: Boolean(process.env.POPBILL_LINK_ID && process.env.POPBILL_SECRET_KEY),
  isTest: process.env.POPBILL_IS_TEST === 'true',
};

// 서비스 인스턴스
export const taxinvoiceService = popbill.TaxinvoiceService();
export const kakaoService = popbill.KakaoService();
export const messageService = popbill.MessageService();

// 오늘 날짜 문자열 (YYYYMMDD)
export function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// CORS 헤더 설정
export function setCorsHeaders(req, res) {
  const allowedOrigins = [
    'https://mykim.kr',
    'https://www.mykim.kr',
    'https://legal-crm-xi.vercel.app'
  ];
  
  if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
    allowedOrigins.push('http://localhost:5173');
    allowedOrigins.push('http://localhost:3000');
  }

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
