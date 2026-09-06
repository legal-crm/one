// 전자세금계산서 프론트엔드 서비스
// PopBill API Serverless Functions 호출 래퍼
import * as XLSX from 'xlsx-js-style';
import type { AdOrder } from '../types';

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
  buyerTaxEmail2?: string;  // 추가 회계담당자 이메일
  buyerAddr?: string;       // 사업장 주소
}

export interface ModifyTaxInvoiceRequest {
  orderId: string;
  orgNTSConfirmNum: string;  // 당초 국세청 승인번호 (필수)
  modifyCode: 2 | 4;         // 4: 계약의 해제(전액 취소), 2: 공급가액 변동(부분 환불)
  modifyReason?: string;     // 취소/환불 사유
  refundSupplyCost: number;  // 취소/환불 공급가액 (양수로 전달)
  refundTax?: number;        // 취소/환불 부가세 (미입력 시 10%)
  refundTotalAmount?: number;// 취소/환불 합계금액
  itemName?: string;
  buyerCorpNum: string;
  buyerCorpName?: string;
  buyerCEOName?: string;
  buyerEmail?: string;
  buyerAddr?: string;
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
  taxEmail2?: string; // 추가 회계/세무 담당자 이메일
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
    mock?: boolean;
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

/** 수정세금계산서 발행 (계약의 해제 / 공급가액 변동) */
export async function issueModifyTaxInvoice(data: ModifyTaxInvoiceRequest): Promise<{
  ok: boolean;
  data?: {
    ntsConfirmNum: string;
    itemKey: string;
    orderId: string;
    modifyCode: number;
    modifyReason: string;
    issuedAt: string;
    supplyCost: number;
    tax: number;
    totalAmount: number;
    mock?: boolean;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: 수정세금계산서 발행 실패' };
  }
}

/** 세금계산서 이메일 재발송 */
export async function resendTaxInvoiceEmail(itemKey: string, receiverEmail: string): Promise<{
  ok: boolean;
  data?: { message: string; sentAt: string; receiverEmail: string };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey, receiverEmail }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: '네트워크 오류: 이메일 재발송 실패' };
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

// === 부가세 신고용 엑셀(XLSX) 다운로드 ===

export function exportTaxInvoicesToExcel(orders: AdOrder[], filename?: string): void {
  const invoiced = orders.filter(o => o.taxInvoice);
  if (invoiced.length === 0) {
    throw new Error('내보낼 세금계산서 발행 내역이 없습니다.');
  }

  const rows: any[] = [];
  let seq = 1;

  invoiced.forEach(order => {
    // 1. 당초 정발행 건
    if (order.taxInvoice) {
      rows.push({
        '순번': seq++,
        '발행구분': '정발행(매출)',
        '작성일자': order.taxInvoice.issuedAt ? order.taxInvoice.issuedAt.slice(0, 10) : '',
        '공급자상호': '몬스터랩',
        '공급자사업자번호': '521-39-01355',
        '공급자대표': '진성호',
        '공급받는자(상호)': order.buyerCorpName || order.lawyerName,
        '공급받는자(사업자번호)': formatCorpNum(order.buyerCorpNum || ''),
        '공급받는자(대표자)': order.buyerCEOName || order.lawyerName,
        '품목명': order.productName,
        '공급가액': order.taxInvoice.supplyCost,
        '세액(VAT)': order.taxInvoice.tax,
        '합계금액': order.taxInvoice.totalAmount,
        '국세청승인번호': order.taxInvoice.ntsConfirmNum || '',
        '상태': order.modifiedTaxInvoice ? '수정발행됨' : '국세청전송완료',
        '비고': `주문번호: ${order.id}`,
      });
    }

    // 2. 수정세금계산서(계약해제/환불)가 있는 경우 마이너스 행 추가
    if (order.modifiedTaxInvoice) {
      const mod = order.modifiedTaxInvoice;
      const modReasonLabel = mod.modifyCode === 2 ? '공급가액 변동' : '계약의 해제';
      rows.push({
        '순번': seq++,
        '발행구분': `수정발행 [${modReasonLabel}]`,
        '작성일자': mod.issuedAt ? mod.issuedAt.slice(0, 10) : '',
        '공급자상호': '몬스터랩',
        '공급자사업자번호': '521-39-01355',
        '공급자대표': '진성호',
        '공급받는자(상호)': order.buyerCorpName || order.lawyerName,
        '공급받는자(사업자번호)': formatCorpNum(order.buyerCorpNum || ''),
        '공급받는자(대표자)': order.buyerCEOName || order.lawyerName,
        '품목명': `${order.productName} [${modReasonLabel}]`,
        '공급가액': mod.supplyCost,     // 음수
        '세액(VAT)': mod.tax,           // 음수
        '합계금액': mod.totalAmount,    // 음수
        '국세청승인번호': mod.ntsConfirmNum || '',
        '상태': '국세청전송완료(차감)',
        '비고': `사유: ${mod.modifyReason || modReasonLabel} (당초: ${order.taxInvoice?.ntsConfirmNum || ''})`,
      });
    }
  });

  // 워크시트 생성
  const ws = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 6 },  // 순번
    { wch: 18 }, // 발행구분
    { wch: 12 }, // 작성일자
    { wch: 14 }, // 공급자상호
    { wch: 16 }, // 공급자사업자번호
    { wch: 10 }, // 공급자대표
    { wch: 20 }, // 공급받는자 상호
    { wch: 16 }, // 공급받는자 사업자번호
    { wch: 12 }, // 공급받는자 대표
    { wch: 22 }, // 품목명
    { wch: 14 }, // 공급가액
    { wch: 12 }, // 세액
    { wch: 14 }, // 합계금액
    { wch: 28 }, // 국세청승인번호
    { wch: 18 }, // 상태
    { wch: 30 }, // 비고
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '세금계산서 매출내역');

  const today = new Date().toISOString().slice(0, 10);
  const actualFilename = filename || `마이김변_세금계산서_부가세신고용_${today}.xlsx`;
  XLSX.writeFile(wb, actualFilename);
}
