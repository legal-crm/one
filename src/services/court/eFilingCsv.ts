// ============================================================
// 전자소송 채권자 CSV (H-9, 05 기획서 8장 — 10-29 형식 확정)
// 회생 = 채권자(기본정보) 13열 당사자형, CP949. 금액·원인·주민번호는 넣지 않는다(채권자목록 PDF로 따로 낸다).
// 파산 = 18열 채권자목록형(두 경쟁사 형식 일치). 발생원인은 번호(①~④), 금액은 숫자만.
// 지어낸 기본값은 넣지 않고, 비어 있으면 경고 목록으로 돌려준다(출력 전 확인).
// ============================================================

import type { RepaymentCreditor } from '../repayment/repaymentTypes';

export const REHAB_CSV_HEADERS = [
  '체크(기본값 F)', '구분', '채권자목록번호', '구분번호', '채권자명', '인격구분',
  '도로명주소1(도로명 건물번호까지)', '도로명주소2(상세주소)', '우편번호', '휴대전화번호', '전화번호', '팩스번호', '이메일',
] as const;

export const BANKRUPTCY_CSV_HEADERS = [
  '체크(기본값 F)', '채권자목록번호', '보증인번호', '채권자명', '보증인명',
  '도로명주소1(도로명 건물번호까지)', '도로명주소2(상세주소)', '우편번호', '휴대전화번호', '전화번호', '팩스번호', '이메일',
  '차용또는구입일자', '발생원인', '최초채권액', '사용처', '잔존원금', '잔존이자및지연손해금',
] as const;

const PERSON_LABEL: Record<NonNullable<RepaymentCreditor['personType']>, string> = {
  natural: '자연인', corporation: '법인', unincorporated: '법인', state: '국가', local_gov: '지방자치단체',
};

/** 인격구분: 저장값 우선, 없으면 이름으로 분명한 경우만 (모르면 빈칸 + 경고) */
export function personTypeLabel(c: Pick<RepaymentCreditor, 'personType' | 'name'>): string {
  if (c.personType) return PERSON_LABEL[c.personType];
  const n = c.name || '';
  if (/세무서|국세청|관세청|대한민국/.test(n)) return '국가';
  if (/(특별|광역)?시청$|구청$|군청$|도청$|특별자치(시|도)$/.test(n)) return '지방자치단체';
  if (/은행|카드|캐피탈|저축|금고|보험|증권|공단|공사|대부|자산관리|신용정보|농협|수협|신협|새마을|\(주\)|주식회사|유한회사|조합/.test(n)) return '법인';
  return '';
}

/** 도로명 주소를 '건물번호까지' / '상세주소'로 나눈다 (예: 서울 중구 세종대로 110, 3층 → [서울 중구 세종대로 110, 3층]) */
export function splitRoadAddress(addr?: string): [string, string] {
  const a = String(addr || '').replace(/\s+/g, ' ').trim();
  if (!a) return ['', ''];
  const m = a.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?(?:번길\s?\d+(?:-\d+)?)?)(?:[,\s]+(.*))?$/);
  if (m) return [m[1].trim(), (m[2] || '').replace(/^,\s*/, '').trim()];
  return [a, ''];
}

/** 전국 대표번호(1588 등)는 '02-'를 붙인다 (전자소송 형식 오류 방지) */
export function normalizeCourtPhone(phone?: string): string {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (/^1[5-9]\d{6}$/.test(digits)) return `02-${digits.slice(0, 4)}-${digits.slice(4)}`;
  return raw;
}

const q = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const isMobile = (p: string) => /^01[016789]/.test(p.replace(/[^0-9]/g, ''));

export interface CsvResult { text: string; warnings: string[] }

/** 표시 번호(4-1 등) → [목록번호, 구분번호] */
function numbers(c: RepaymentCreditor, idx: number): [string, string] {
  const d = String(c.displayNumber || '').trim();
  const m = d.match(/^(\d+)(?:-(\d+))?$/);
  if (m) return [m[1], m[2] || ''];
  return [String(c.creditorNumber || idx + 1), ''];
}

export function buildRehabCreditorCsv(creditors: RepaymentCreditor[]): CsvResult {
  const warnings: string[] = [];
  const rows = creditors.map((c, idx) => {
    const [no, sub] = numbers(c, idx);
    const [a1, a2] = splitRoadAddress(c.serviceAddress || c.address);
    const person = personTypeLabel(c);
    const phone = normalizeCourtPhone(c.phone);
    const label = `${no}${sub ? `-${sub}` : ''}번 ${c.name || '(이름 없음)'}`;
    if (!c.name) warnings.push(`${label}: 채권자명이 없어요.`);
    if (!person) warnings.push(`${label}: 인격구분(국가·지방자치단체·법인·자연인)을 정해 주세요.`);
    if (!a1) warnings.push(`${label}: 주소가 없어요.`);
    if (!c.zipCode) warnings.push(`${label}: 우편번호가 없어요(필수).`);
    const isGuarantor = !!(sub || c.parentCreditorId || c.isGuarantorClaim);
    return [
      'F', isGuarantor ? '보증인(대위변제자)' : '채권자', no, sub, c.name || '', person,
      a1, a2, c.zipCode || '', isMobile(phone) ? phone : '', isMobile(phone) ? '' : phone, c.fax || '', '',
    ].map(q).join(',');
  });
  return { text: [REHAB_CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n', warnings };
}

/** 파산 발생원인 번호 (①금전차용 ②물품구입 ③보증 ④기타) */
export function bankruptcyCauseCode(c: RepaymentCreditor): string {
  // 직접 고른 값이 먼저 (BK-3). 없을 때만 글자로 짐작
  if (c.bankruptcyCause) return ({ '1': '①', '2': '②', '3': '③', '4': '④' } as const)[c.bankruptcyCause];
  const t = `${c.debtCauseDetail || ''} ${c.claimCause || ''}`;
  if (c.isGuaranteedDebt || /보증/.test(t)) return '③';
  if (/카드|구입|할부|물품/.test(t) || /카드/.test(c.name || '')) return '②';
  if (/대출|대여|차용|금전/.test(t)) return '①';
  return t.trim() ? '④' : '';
}

const dotYmd = (ymd?: string) => { const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}.${m[2]}.${m[3]}.` : ''; };

export function buildBankruptcyCreditorCsv(creditors: RepaymentCreditor[]): CsvResult {
  const warnings: string[] = [];
  const rows = creditors.map((c, idx) => {
    const [no, sub] = numbers(c, idx);
    const [a1, a2] = splitRoadAddress(c.serviceAddress || c.address);
    const phone = normalizeCourtPhone(c.phone);
    const cause = bankruptcyCauseCode(c);
    const label = `${no}${sub ? `-${sub}` : ''}번 ${c.name || '(이름 없음)'}`;
    if (!c.borrowedDate) warnings.push(`${label}: 차용(구입)일자가 없어요(필수).`);
    if (!cause) warnings.push(`${label}: 발생원인을 정해 주세요(필수).`);
    if (!c.initialPrincipal) warnings.push(`${label}: 최초채권액이 없어요(필수).`);
    if (!c.debtUsage) warnings.push(`${label}: 사용처가 없어요(필수).`);
    if (!c.zipCode) warnings.push(`${label}: 우편번호가 없어요.`);
    return [
      'F', no, sub, sub ? '' : c.name || '', sub ? c.name || '' : '',
      a1, a2, c.zipCode || '', isMobile(phone) ? phone : '', isMobile(phone) ? '' : phone, c.fax || '', '',
      dotYmd(c.borrowedDate), cause, c.initialPrincipal ? Math.round(c.initialPrincipal) : '', c.debtUsage || '',
      Math.round(c.principal || 0), Math.round(c.interest || 0),
    ].map(q).join(',');
  });
  return { text: [BANKRUPTCY_CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n', warnings };
}
