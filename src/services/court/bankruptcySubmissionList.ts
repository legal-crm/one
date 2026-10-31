// 개인파산 자료제출목록 (서울회생법원 실무준칙 제407호 '자료제출목록' 양식의 10개 분류, 06 기획서 7-4)
// 칸: 제출 / 제출 못하거나 일부만 제출한 이유(해당사항 없음·협조거부·기타). 본인 주민번호는 전체, 제3자는 뒷자리 비표기.
import type { BankruptcyRequiredDoc } from '../../types/bankruptcyTypes';

export const SUBMISSION_GROUPS: Array<{ no: number; label: string }> = [
  { no: 1, label: '인적·주거 관계' },
  { no: 2, label: '지방세 과세' },
  { no: 3, label: '자동차' },
  { no: 4, label: '부동산·임대차' },
  { no: 5, label: '재산 처분' },
  { no: 6, label: '보험' },
  { no: 7, label: '근로·영업·기타 소득' },
  { no: 8, label: '계좌 거래' },
  { no: 9, label: '이혼' },
  { no: 10, label: '신용회복위원회 등 채무조정' },
];

export type UnobtainableKind = 'not_applicable' | 'refused' | 'other';
export const UNOBTAINABLE_KIND_LABEL: Record<UnobtainableKind, string> = {
  not_applicable: '해당사항 없음',
  refused: '협조 거부',
  other: '기타',
};

// [분류 번호, 자료명, 안내, 필수 여부]
const ITEMS: Array<[number, string, string, boolean]> = [
  [1, '가족관계증명서 (상세)', '본인 기준 상세본', true],
  [1, '혼인관계증명서 (상세)', '이혼 이력이 보이는 상세본', true],
  [1, '주민등록초본 (주소 변동 전체)', '과거 주소 변동·개명 전체', true],
  [1, '주민등록등본', '세대원 전체 표기', true],
  [2, '지방세 세목별 과세증명서', '최근 5년, 전국', true],
  [3, '자동차등록원부 (갑·을)', '자동차가 있을 때', false],
  [3, '자동차 시가 자료', '중고차 시세 등', false],
  [4, '부동산 등기사항전부증명서', '소유 또는 최근 처분한 부동산', false],
  [4, '임대차계약서 사본 또는 무상거주확인서', '현재 거주지', true],
  [5, '처분한 재산의 등기·계약서·영수증', '지급불능 1년 전부터 1,000만 원 이상 처분(부동산은 금액 무관)', false],
  [6, '보험 가입내역 조회서', '모든 보험사', true],
  [6, '해약환급금 확인서', '가입한 보험마다', true],
  [7, '소득금액증명 또는 사실증명', '국세청 발급(영업 경험이 있으면 사실증명 8종)', true],
  [7, '급여 자료 (급여명세서·근로소득원천징수영수증)', '근로소득이 있을 때', false],
  [7, '연금·기타 수입 자료', '연금·수당 등을 받을 때', false],
  [7, '건강보험 자격득실확인서', '직장·지역 가입 이력', true],
  [8, '계좌 거래내역 (최근 1년)', '본인 명의 모든 계좌', true],
  [9, '이혼 관련 판결서·조정조서·재산분할 자료', '2년 안에 이혼했을 때', false],
  [10, '신용회복위원회·채무조정 진행 자료', '채무조정을 신청했거나 진행 중일 때', false],
];

export function defaultBankruptcySubmissionList(): BankruptcyRequiredDoc[] {
  return ITEMS.map(([groupNo, title, detailDescription, isMandatory], i) => ({
    id: `bs-${i + 1}`,
    itemNumber: i + 1,
    groupNo,
    category: SUBMISSION_GROUPS[groupNo - 1].label,
    title,
    detailDescription,
    isMandatory,
    status: 'PREPARING' as const,
  }));
}

/** 예전 15항목 목록(분류 번호 없음)을 10분류 목록으로 옮긴다. 같은 이름이 있으면 제출 상태·사유를 이어 받는다 */
export function upgradeSubmissionList(saved: BankruptcyRequiredDoc[] | undefined): BankruptcyRequiredDoc[] {
  if (saved && saved.length > 0 && saved.every(d => typeof d.groupNo === 'number')) return saved;
  const fresh = defaultBankruptcySubmissionList();
  if (!saved || saved.length === 0) return fresh;
  const key = (s: string) => s.replace(/\s|\(.*?\)/g, '').slice(0, 6);
  const byKey = new Map(saved.map(d => [key(d.title), d]));
  return fresh.map(d => {
    const old = byKey.get(key(d.title));
    return old ? { ...d, status: old.status, unobtainableReason: old.unobtainableReason, fileUrl: old.fileUrl, fileName: old.fileName } : d;
  });
}

/** 미제출 사유 문장 (인쇄용) */
export function unobtainableText(d: Pick<BankruptcyRequiredDoc, 'unobtainableKind' | 'unobtainableReason'>): string {
  const kind = d.unobtainableKind ? UNOBTAINABLE_KIND_LABEL[d.unobtainableKind] : '';
  const reason = (d.unobtainableReason || '').trim();
  if (kind && reason) return `${kind}: ${reason}`;
  return kind || reason;
}
