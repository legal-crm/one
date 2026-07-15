// 전자세금계산서 프론트엔드 서비스
// PopBill API Serverless Functions 호출 래퍼

const API_BASE = '/api/invoice';

// === Types ===

export interface TaxInvoiceIssueRequest {
  orderId: string;
  itemName: string;
  supplyCost: number;       // 공급가액 (VAT 제외)
  tax?: number;             // 부가세 (미입력 시 자동 10%)
  totalAmount?: number;     // 합계
  buyerCorpNum: string;     // 변호사 사업자등록번호
  buyerCorpName: string;    // 법률사무소명
  buyerCEOName: string;     // 대표 변호사명
  buyerEmail?: string;      // 세금계산서 수신 이메일
  buyerAddr?: string;       // 사업장 주소
}

export interface TaxInvoiceRecord {
  itemKey: string;
  ntsConfirmNum: string;
  writeDate: string;
  supplyCostTotal: string;
  taxTotal: string;
  totalAmount: string;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCEOName: string;
  itemName: string;
  stateCode: string;
  stateDT: string;
  remark1: string;
}

export interface LawyerBusinessInfo {
  corpNum: string;
  corpName: string;
  ceoName: string;
  bizType: string;
  bizClass: string;
  addr: string;
  taxEmail: string;
}

// === API Calls ===

/** 세금계산서 즉시 발행 (통합어드민에서 호출) */
export async function issueTaxInvoice(data: TaxInvoiceIssueRequest): Promise<{
  ok: boolean;
  data?: {
    ntsConfirmNum: string;
    itemKey: string;
    orderId: string;
    issuedAt: string;
    supplyCost: number;
    tax: number;
    totalAmount: number;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: 세금계산서 발행 실패' };
  }
}

/** 사업자등록번호 유효성 확인 */
export async function checkCorpNum(corpNum: string): Promise<{
  ok: boolean;
  data?: { state: string; type: string; taxType: string };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/check-corp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corpNum }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: 사업자 확인 실패' };
  }
}

/** 세금계산서 목록 조회 */
export async function listTaxInvoices(params: {
  startDate: string;  // YYYYMMDD
  endDate: string;    // YYYYMMDD
  buyerCorpNum?: string;
  page?: number;
  perPage?: number;
}): Promise<{
  ok: boolean;
  data?: { total: number; list: TaxInvoiceRecord[] };
  error?: string;
}> {
  try {
    const query = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      ...(params.buyerCorpNum ? { buyerCorpNum: params.buyerCorpNum } : {}),
      page: String(params.page || 1),
      perPage: String(params.perPage || 20),
    });
    const res = await fetch(`${API_BASE}/list?${query}`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: 목록 조회 실패' };
  }
}

/** 세금계산서 PDF 뷰어 URL 조회 */
export async function getTaxInvoicePdfUrl(itemKey: string): Promise<{
  ok: boolean;
  data?: { url: string };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/pdf?itemKey=${encodeURIComponent(itemKey)}`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: PDF URL 조회 실패' };
  }
}

// === Helpers ===

/** 사업자등록번호 포맷 (하이픈 추가) */
export function formatCorpNum(num: string): string {
  const clean = num.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

/** 세금계산서 상태 코드 → 한글 라벨 */
export function getInvoiceStatusLabel(stateCode: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    '300': { label: '발행완료', color: 'emerald' },
    '301': { label: '국세청 전송중', color: 'amber' },
    '302': { label: '국세청 전송완료', color: 'emerald' },
    '303': { label: '발행취소', color: 'red' },
    '304': { label: '국세청 전송실패', color: 'red' },
    '305': { label: '확인완료', color: 'emerald' },
  };
  return map[stateCode] || { label: `상태: ${stateCode}`, color: 'slate' };
}

/** 금액 포맷 (천 단위 콤마) */
export function formatInvoiceAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  return num.toLocaleString('ko-KR') + '원';
}

/** localStorage 기반 변호사 사업자 정보 저장/조회 */
const BIZ_INFO_KEY = 'legal_crm_lawyer_biz_info';

export function saveLawyerBusinessInfo(info: LawyerBusinessInfo): void {
  localStorage.setItem(BIZ_INFO_KEY, JSON.stringify(info));
}

export function loadLawyerBusinessInfo(): LawyerBusinessInfo | null {
  const raw = localStorage.getItem(BIZ_INFO_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
