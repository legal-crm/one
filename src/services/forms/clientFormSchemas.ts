// ============================================================
// 의뢰인이 직접 쓰는 서식의 질문 칸 (H-12·H-14)
// 사무소가 작성 요청을 보내면 이 칸들의 사본이 서버 요청(client_form_requests.fields)에 저장된다.
// 이전: 질문이 MobileDocFillView 화면 코드에 서식마다 따로 박혀 있었고, 이름 일부로 서식을 짐작했다.
// 주민등록번호는 묻지 않는다(L8). 판단·계산 문장은 넣지 않는다(제109조).
// ============================================================
import type { QuestionnaireField } from '../documents/legalDocRegistry';

export interface ClientFormSchema {
  docCode: string;
  title: string;
  /** 의뢰인에게 보이는 한 줄 안내 */
  guide: string;
  fields: QuestionnaireField[];
  /** 의뢰인 본인 서명이 필요한 서식 */
  needsSignature?: boolean;
  /** 의뢰인이 아닌 사람이 서명해야 하는 서식: 출력 → 자필 서명 → 사진 올리기 (FH-Q3) */
  thirdPartySigner?: string;
}

const RELATION = ['부모', '형제자매', '배우자', '자녀', '친척', '지인', '기타'];

export const CLIENT_FORM_SCHEMAS: ClientFormSchema[] = [
  {
    docCode: '111110',
    title: '무상거주사실 확인서',
    guide: '보증금·월세 없이 사는 집이라면, 집 명의자가 그 사실을 확인해 주는 서류예요. 내용을 채운 뒤 출력해 명의자 서명을 받아 사진으로 올려 주세요.',
    thirdPartySigner: '집 명의자',
    fields: [
      { id: 'owner_name', label: '집 명의자 이름', type: 'text', required: true },
      { id: 'owner_relation', label: '나와의 관계', type: 'select', options: RELATION, required: true },
      { id: 'address', label: '지금 사는 집 주소', type: 'text', required: true },
      { id: 'since', label: '살기 시작한 날', type: 'date', required: true },
      { id: 'reason', label: '돈을 내지 않고 사는 이유', type: 'textarea', required: true, placeholder: '예: 부모님 집에서 함께 살며 생활비만 나눠 냄' },
    ],
  },
  {
    docCode: '121020',
    title: '사채진술서',
    guide: '가족·지인 등 개인에게 빌린 돈이 있다면, 빌린 경위를 사실대로 적어 주세요.',
    needsSignature: true,
    fields: [
      { id: 'lender', label: '빌려준 사람 (이름 또는 관계)', type: 'text', required: true },
      { id: 'relation', label: '나와의 관계', type: 'select', options: RELATION, required: true },
      { id: 'loan_date', label: '빌린 날 (모르면 대략)', type: 'text', required: true, placeholder: '예: 2024년 3월쯤' },
      { id: 'amount', label: '빌린 금액 (원)', type: 'currency', required: true },
      { id: 'repaid', label: '지금까지 갚은 금액 (원)', type: 'currency', required: false },
      { id: 'proof', label: '차용증이나 이체 기록이 있나요?', type: 'radio', options: ['있어요', '없어요', '일부 있어요'], required: true },
      { id: 'purpose', label: '빌린 이유와 쓴 곳', type: 'textarea', required: true },
    ],
  },
  {
    docCode: '122040',
    title: '거래내역 사용처 소명',
    guide: '법원이 물은 큰 출금·이체가 어디에 쓰였는지 하나씩 적어 주세요. 여러 건이면 사무소가 표로 다시 요청해요.',
    fields: [
      { id: 'date', label: '거래 날짜', type: 'date', required: true },
      { id: 'amount', label: '금액 (원)', type: 'currency', required: true },
      { id: 'bank', label: '은행·계좌', type: 'text', required: false },
      { id: 'recipient', label: '받은 사람·곳', type: 'text', required: true },
      { id: 'category', label: '쓴 곳 분류', type: 'select', options: ['생활비', '병원비', '빚 갚음', '사업 비용', '가족 지원', '기타'], required: true },
      { id: 'detail', label: '자세한 설명', type: 'textarea', required: true },
    ],
  },
  {
    docCode: '122050',
    title: '영업소득 필요경비 소명',
    guide: '가게·사업의 한 달 평균 매출과 비용을 적어 주세요. 장부나 카드 매출 내역이 있으면 함께 올려 주세요.',
    fields: [
      { id: 'monthly_sales', label: '한 달 평균 매출 (원)', type: 'currency', required: true },
      { id: 'rent', label: '임대료 (원)', type: 'currency', required: false },
      { id: 'payroll', label: '인건비 (원)', type: 'currency', required: false },
      { id: 'material', label: '재료비·상품 매입 (원)', type: 'currency', required: false },
      { id: 'utility', label: '공과금·통신비 등 (원)', type: 'currency', required: false },
      { id: 'note', label: '그 밖에 알릴 내용', type: 'textarea', required: false },
    ],
  },
  {
    docCode: '122011',
    title: '추가 생계비 소명',
    guide: '기본 생계비 말고 더 드는 돈(월세·병원비·교육비 등)이 있다면 이유와 금액을 적어 주세요.',
    fields: [
      { id: 'kind', label: '어떤 비용인가요?', type: 'select', options: ['주거비', '의료비', '교육비', '기타'], required: true },
      { id: 'amount', label: '한 달 금액 (원)', type: 'currency', required: true },
      { id: 'reason', label: '이 비용이 드는 이유', type: 'textarea', required: true },
    ],
  },
  {
    docCode: '113120',
    title: '배우자·이혼 관련 소명',
    guide: '배우자 명의 재산이나 이혼 때 재산을 나눈 내용, 양육비를 적어 주세요.',
    fields: [
      { id: 'spouse_name', label: '배우자(전 배우자) 이름', type: 'text', required: true },
      { id: 'spouse_assets', label: '배우자 명의 재산', type: 'textarea', required: false, placeholder: '없으면 "없음"' },
      { id: 'division', label: '이혼 때 재산을 나눈 내용', type: 'textarea', required: false },
      { id: 'child_support', label: '한 달 양육비 (원, 주거나 받는 금액)', type: 'currency', required: false },
    ],
  },
  {
    docCode: 'D5116',
    title: '소득진술서',
    guide: '급여명세서로 확인하기 어려운 소득(현금 급여·일용·프리랜서 등)을 사실대로 적어 주세요.',
    needsSignature: true,
    fields: [
      { id: 'income_kind', label: '소득 종류', type: 'select', options: ['급여(현금)', '일용직', '프리랜서', '아르바이트', '기타'], required: true },
      { id: 'payer', label: '돈을 주는 곳', type: 'text', required: true },
      { id: 'monthly', label: '한 달 평균 소득 (원)', type: 'currency', required: true },
      { id: 'period', label: '일한 기간', type: 'text', required: true, placeholder: '예: 2025년 1월부터 지금까지' },
      { id: 'how_paid', label: '받는 방법', type: 'radio', options: ['계좌로 받아요', '현금으로 받아요', '둘 다'], required: true },
      { id: 'detail', label: '자세한 설명', type: 'textarea', required: false },
    ],
  },
  {
    docCode: '121040',
    title: '금융자료제공동의서',
    guide: '법원이 금융기관에 거래 자료를 조회할 수 있도록 동의하는 서류예요. 내용을 읽고 서명해 주세요.',
    needsSignature: true,
    fields: [
      { id: 'agree', label: '법원의 금융거래 자료 조회에 동의합니다', type: 'radio', options: ['동의합니다'], required: true },
    ],
  },
];

export function clientFormSchemaFor(docCode: string): ClientFormSchema | undefined {
  return CLIENT_FORM_SCHEMAS.find(s => s.docCode === docCode);
}

/** 화면 표시용 금액 (숫자만 남겨 천 단위 쉼표) */
export function formatWon(v: string | undefined): string {
  const n = Number(String(v || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('ko-KR')}원` : '';
}

/** 주민등록번호 형태 (서버와 같은 규칙) */
export const RRN_PATTERN = /[0-9]{6}\s*-?\s*[1-4][0-9]{6}/;

export function validateAnswers(fields: QuestionnaireField[], answers: Record<string, string>): { fieldId: string; message: string } | null {
  for (const f of fields) {
    const v = (answers[f.id] || '').trim();
    if (f.required && !v) return { fieldId: f.id, message: `'${f.label}'을(를) 채워 주세요.` };
    if (v && RRN_PATTERN.test(v)) return { fieldId: f.id, message: '주민등록번호는 적지 말아 주세요. 사무소가 출력할 때만 따로 받아요.' };
  }
  return null;
}
