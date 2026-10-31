// ============================================================
// 회사 정보 한 곳 (CT-12, A-8) — 사업자등록증 기준 기본값 + 통합어드민 '플랫폼 설정 › 회사 정보'(platform_config id 'company_info')
// 고객 푸터·변호사 화면 푸터·정적 페이지 푸터·회사 소개 표·JSON-LD·llms.txt·세금계산서 내보내기가 이 값을 쓴다.
// 서버 값은 빌드 때(scripts/company-info-build.mjs)와 화면을 열 때 읽고, 칸이 비면 아래 기본값.
// 법적 상호는 몬스터랩(개인사업자) — '주식회사'·'대표이사'·'my김변컴퍼니' 표기 금지 (R10)
// ============================================================

export const DEFAULT_COMPANY_INFO = Object.freeze({
  legalName: '몬스터랩',
  businessType: '개인사업자',
  ceo: '진성호',
  businessNumber: '521-39-01355',
  mailOrderNumber: '제2026-진접오남-0565호',
  address: '경기도 남양주시 진접읍 해밀예당1로189번길 3, 2102동 301호(원일플로라아파트)',
  phone: '070-4187-2882',
  email: 'support@mykim.kr',
  privacyOfficer: '진성호(대표)',
  hosting: 'Vercel Inc.',
});

export const COMPANY_INFO_FIELDS = [
  ['legalName', '상호', 40],
  ['businessType', '사업자 구분', 20],
  ['ceo', '대표', 20],
  ['businessNumber', '사업자등록번호', 12],
  ['mailOrderNumber', '통신판매업 신고번호', 40],
  ['address', '사업장 주소', 120],
  ['phone', '대표 전화', 20],
  ['email', '고객 문의 이메일', 80],
  ['privacyOfficer', '개인정보 보호책임자', 40],
  ['hosting', '호스팅 서비스 제공자', 40],
];

const BANNED = /주식회사|\(주\)|대표이사|my김변컴퍼니/;

/** 서버 값 + 기본값 (칸마다), 금지 표기는 기본값으로 */
export function normalizeCompanyInfo(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [key, , max] of COMPANY_INFO_FIELDS) {
    const v = typeof src[key] === 'string' ? src[key].trim().slice(0, max) : '';
    out[key] = v && !BANNED.test(v) ? v : DEFAULT_COMPANY_INFO[key];
  }
  if (!/^\d{3}-\d{2}-\d{5}$/.test(out.businessNumber)) out.businessNumber = DEFAULT_COMPANY_INFO.businessNumber;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) out.email = DEFAULT_COMPANY_INFO.email;
  return out;
}

/** 저장 전 확인 (관리자 화면): 문제 문장 목록 */
export function companyInfoProblems(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = [];
  for (const [key, label, max] of COMPANY_INFO_FIELDS) {
    const v = typeof src[key] === 'string' ? src[key].trim() : '';
    if (!v) out.push(`${label}을(를) 입력해 주세요.`);
    else if (v.length > max) out.push(`${label}은(는) ${max}자 이내로 입력해 주세요.`);
    else if (BANNED.test(v)) out.push(`${label}: '주식회사'·'(주)'·'대표이사'·'my김변컴퍼니'는 쓸 수 없어요(개인사업자).`);
  }
  if (src.businessNumber && !/^\d{3}-\d{2}-\d{5}$/.test(String(src.businessNumber).trim())) out.push('사업자등록번호는 000-00-00000 형식으로 입력해 주세요.');
  if (src.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(src.email).trim())) out.push('이메일 형식을 확인해 주세요.');
  return out;
}

/** 빌드 스크립트용: 서버(공개 읽기)에서 회사 정보를 읽는다. 실패하면 기본값 */
export async function fetchCompanyInfo(url, anonKey) {
  if (!url || !anonKey) return { info: normalizeCompanyInfo(null), source: 'default' };
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/platform_config?id=eq.company_info&select=data`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { info: normalizeCompanyInfo(null), source: 'default' };
    const rows = await r.json();
    const data = Array.isArray(rows) && rows[0]?.data;
    return { info: normalizeCompanyInfo(data), source: data ? 'server' : 'default' };
  } catch {
    return { info: normalizeCompanyInfo(null), source: 'default' };
  }
}
