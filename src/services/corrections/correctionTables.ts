import type { TableType } from './correctionLabels';

// ============================================================
// 보정 별지 표 양식 T1~T11 (CR-6, 14 기획서 5-4장)
// 의뢰인은 휴대폰에서 한 줄씩 카드로 채우고, 사무소는 표로 보고, 보정서 뒤 '별지'로 출력한다.
// 계좌는 끝 4자리, 주소는 시·군·구까지만 받는다.
// ============================================================

export interface TableColumn {
  key: string;
  label: string;
  kind?: 'text' | 'date' | 'money' | 'select';
  options?: string[];
  hint?: string;
}

export interface TableDef {
  type: TableType;
  title: string;
  columns: TableColumn[];
}

export const CORRECTION_TABLES: Record<TableType, TableDef> = {
  T1: { type: 'T1', title: '대출금 사용처', columns: [
    { key: 'creditor', label: '채권자' }, { key: 'date', label: '대출일', kind: 'date' }, { key: 'amount', label: '금액(원)', kind: 'money' },
    { key: 'use', label: '사용처' }, { key: 'proof', label: '소명자료' }] },
  T2: { type: 'T2', title: '큰 금액 입출금 사용처', columns: [
    { key: 'account', label: '계좌(은행·끝 4자리)', hint: '예: 국민 1234' }, { key: 'date', label: '일자', kind: 'date' },
    { key: 'direction', label: '입금/출금', kind: 'select', options: ['입금', '출금'] }, { key: 'amount', label: '금액(원)', kind: 'money' },
    { key: 'counterparty', label: '상대방' }, { key: 'use', label: '사용처·받은 이유' }, { key: 'proof', label: '소명자료' }] },
  T3: { type: 'T3', title: '보험 가입 내역', columns: [
    { key: 'holder', label: '계약자' }, { key: 'insured', label: '피보험자' }, { key: 'company', label: '회사' }, { key: 'product', label: '상품' },
    { key: 'joined', label: '가입일', kind: 'date' }, { key: 'state', label: '상태', kind: 'select', options: ['유지', '해지', '실효'] },
    { key: 'refund', label: '해약환급금(원)', kind: 'money' }, { key: 'refundUse', label: '해약금 사용처' }] },
  T4: { type: 'T4', title: '최근 5년 주거 이력', columns: [
    { key: 'period', label: '기간', hint: '예: 2021.03~2023.02' }, { key: 'area', label: '주소(시·군·구)' },
    { key: 'type', label: '형태', kind: 'select', options: ['자가', '임차', '무상'] }, { key: 'deposit', label: '보증금(원)', kind: 'money' },
    { key: 'rent', label: '월세(원)', kind: 'money' }, { key: 'owner', label: '명의자' }, { key: 'depositUse', label: '보증금 사용처' }] },
  T5: { type: 'T5', title: '최근 5년 재산 취득·처분', columns: [
    { key: 'asset', label: '재산' }, { key: 'acquired', label: '취득일', kind: 'date' }, { key: 'disposed', label: '처분일', kind: 'date' },
    { key: 'amount', label: '금액(원)', kind: 'money' }, { key: 'use', label: '대금 사용처' }] },
  T6: { type: 'T6', title: '월 소득 산정 근거', columns: [
    { key: 'month', label: '월', hint: '예: 2026.06' }, { key: 'gross', label: '지급액·매출(원)', kind: 'money' },
    { key: 'deduction', label: '공제·경비(원)', kind: 'money' }, { key: 'net', label: '실수령·순수입(원)', kind: 'money' }, { key: 'note', label: '비고' }] },
  T7: { type: 'T7', title: '연도별 채무 증대 경위', columns: [
    { key: 'year', label: '연도' }, { key: 'creditor', label: '채권자' }, { key: 'amount', label: '금액(원)', kind: 'money' },
    { key: 'use', label: '사용처' }, { key: 'reason', label: '사정' }] },
  T8: { type: 'T8', title: '해지 계좌', columns: [
    { key: 'bank', label: '기관' }, { key: 'last4', label: '계좌 끝 4자리' }, { key: 'closed', label: '해지일', kind: 'date' },
    { key: 'balance', label: '해지 때 잔액(원)', kind: 'money' }, { key: 'reason', label: '해지 사유' }] },
  T9: { type: 'T9', title: '주식·가상자산', columns: [
    { key: 'institution', label: '기관·거래소' }, { key: 'balance', label: '잔고 평가액(원)', kind: 'money' },
    { key: 'summary', label: '최근 1년 거래 요약' }] },
  T10: { type: 'T10', title: '영업 비품', columns: [
    { key: 'item', label: '품목' }, { key: 'acquired', label: '취득일', kind: 'date' }, { key: 'cost', label: '취득가(원)', kind: 'money' },
    { key: 'life', label: '내용연수(년)' }, { key: 'value', label: '감가 후 가액(원)', kind: 'money', hint: '사무소가 계산해 채워요' }] },
  T11: { type: 'T11', title: '종전 사건 비교', columns: [
    { key: 'case', label: '사건' }, { key: 'filed', label: '신청일', kind: 'date' }, { key: 'result', label: '결과' },
    { key: 'debt', label: '채무(원)', kind: 'money' }, { key: 'payment', label: '월 변제금(원)', kind: 'money' }] },
};

export const TABLE_OPTIONS = Object.values(CORRECTION_TABLES).map(t => ({ value: t.type, label: `${t.type} ${t.title}` }));

/** 금액 칸: 숫자만 남겨 천 단위 쉼표 */
export function formatMoneyCell(v: string | undefined): string {
  const n = String(v ?? '').replace(/[^0-9]/g, '');
  return n ? Number(n).toLocaleString('ko-KR') : '';
}

/** 빈 줄(모든 칸이 비어 있음)은 뺀다 */
export function cleanRows(type: TableType, rows: Array<Record<string, string>>): Array<Record<string, string>> {
  const keys = CORRECTION_TABLES[type].columns.map(c => c.key);
  return rows
    .map(r => Object.fromEntries(keys.map(k => [k, String(r?.[k] ?? '').trim().slice(0, 500)])))
    .filter(r => keys.some(k => r[k]));
}
