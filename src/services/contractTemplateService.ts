// ============================================================
// 전자 계약 서식(문서함) 관리 및 11대 법률 표준 라이브러리 서비스
// ============================================================

import type { ContractDocType, ContractDocument } from '../types';

export interface LawyerContractTemplate {
  id: string;
  lawyerId?: string;
  title: string;
  description: string;
  category: 'contract' | 'consent' | 'power_of_attorney' | 'special_terms' | 'custom';
  type: ContractDocType;
  content: string;
  signatureRequired: 'client' | 'lawyer' | 'both' | 'none';
  requiredConfirmationText?: string;
  isCustom?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaceholderVariables {
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  lawyerName?: string;
  lawFirmName?: string;
  totalFee?: number;
  contractDate?: string;
}

// ── 자주 쓰는 법률 특약 스니펫 (Quick Snippets) ──
export const LEGAL_QUICK_SNIPPETS = [
  {
    id: 'debt_cert_fee',
    title: '부채증명서 발급 실비 정산 조항',
    desc: '채권사 부채증명서 발급 대행 수수료를 실비로 별도 정산하는 조항',
    text: `\n\n[특약] 제 O 조 (부채증명서 발급 비용 실비 정산)
1. 갑의 채권자 목록 작성을 위한 각 금융기관별 부채증명서 발급 비용(발급 수수료 및 대행 실비)은 상기 총 수임료와 별도로 갑이 실비 부담하며, 영수증 증빙에 따라 정산한다.`
  },
  {
    id: 'omission_liability',
    title: '채권자 누락 면책 제한 고지 조항',
    desc: '의뢰인이 고의/과실로 채권자를 누락한 경우의 책임 한계 명시',
    text: `\n\n[특약] 제 O 조 (채권자 목록의 성실 고지 의무)
1. 갑은 본인이 인지하고 있는 모든 채권자(사채, 보증채무, 개인채무 포함)를 누락 없이 을에게 제공해야 한다.
2. ==갑이 고의 또는 과실로 누락한 채권은 회생인가 또는 파산면책의 효력이 미치지 아니하며, 이에 대한 모든 법적 책임은 갑에게 귀속된다.==`
  },
  {
    id: 'installment_forfeit',
    title: '분납금 연체 시 기한이익 상실 조항',
    desc: '수임료 분납금 연체 시 즉시 완납 의무 발생 및 업무 중단 고지',
    text: `\n\n[특약] 제 O 조 (분납금 연체 및 기한이익 상실)
1. ==갑이 약정된 수임료 분납금을 2회 이상 연속하여 연체하거나 30일 이상 지체한 경우, 을은 서면 통지 없이 기한의 이익을 상실시키고 잔여 수임료 전액의 즉시 지급을 청구할 수 있다.==
2. 기한이익 상실 시 을은 법원 서류 제출 및 사건 진행을 일시 보류할 수 있다.`
  },
  {
    id: 'success_fee_agreement',
    title: '변제계획 인가결정 성공보수 조항',
    desc: '변제계획안 인가 또는 면책결정 확정 시 약정 보수 청구 조항',
    text: `\n\n[특약] 제 O 조 (성공보수의 지급)
1. 본 사건이 법원으로부터 최종 개인회생 변제계획인가 결정(또는 파산면책 허가결정)을 받은 때, 갑은 을에게 성공보수로 [       ]원을 결정 송달일로부터 14일 이내에 지급하기로 약정한다.`
  },
  {
    id: 'spouse_asset_cooperation',
    title: '배우자 재산 소명 협조 의무 조항',
    desc: '법원/회생위원의 배우자 재산 소명 요구 시 서류 제출 협조 조항',
    text: `\n\n[특약] 제 O 조 (배우자 및 동거가족 재산 소명 협조)
1. 법원 또는 회생위원의 권고에 따라 배우자의 재산 및 소득 소명자료(부동산, 예금, 보험해약환급금 등) 제출이 요구될 경우, 갑은 적극 협조하여 기한 내에 관련 서류를 제출하여야 한다.`
  }
];

// ── 11대 법률 표준 서식 라이브러리 ──
export const STANDARD_LEGAL_TEMPLATES: LawyerContractTemplate[] = [
  {
    id: 'std_main_contract_standard',
    title: '개인회생·파산 사건 위임계약서 (표준형)',
    description: '대한변호사협회 표준 양식에 기반한 개인회생·파산 사건 기본 위임계약서',
    category: 'contract',
    type: 'main_contract',
    signatureRequired: 'both',
    requiredConfirmationText: '총 수임료 및 분납 일정을 확인하였습니다',
    tags: ['표준양식', '위임계약', '필수서식'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `개인회생·파산 사건 위임 계약서

위임인 (갑): {{의뢰인명}} (연락처: {{의뢰인연락처}})
수임인 (을): {{법무법인}} 담당변호사 {{변호사명}}

위임인(이하 '갑')과 수임인(이하 '을')은 개인회생(또는 파산·면책) 사건의 위임에 관하여 다음과 같이 합의하고 본 계약을 체결한다.

제 1 조 (위임 사무의 목적 및 범위)
갑은 아래 사건에 관한 일체의 법률사무 처리를 을에게 위임한다.
1. 채무자 회생 및 파산에 관한 법률에 따른 개인회생(또는 개인파산·면책) 신청서의 작성 및 법원 제출
2. 보정권고 및 보정명령에 대한 답변서 및 소명자료 작성·제출
3. 채권자집회 기일 출석 지원 및 사건 진행에 부수되는 법률 상담 일체

제 2 조 (수임료 및 납부 방법)
1. 갑이 을에게 지급할 ==총 수임료는 일금 {{총수임료}}원정(부가세 별도)==으로 한다.
2. 법원 송달료, 인지대 등 공과금성 법원 실비용은 별도 산정하여 갑이 부담한다.
3. 수임료 분할납부 시에는 본 계약서에 첨부된 분납 스케줄에 따라 정해진 기일에 성실히 납부하여야 한다.

제 3 조 (성실의무 및 자료제출 의무)
1. 을은 선량한 관리자의 주의의무를 다하여 위임 사무를 성실히 처리한다.
2. ==갑은 사건 진행에 필요한 일체의 사실관계를 진실되게 고지하여야 하며, 법원 또는 을이 요구하는 금융거래내역, 소득증빙, 부채증명 등 일체의 서류를 기한 내에 성실히 제출하여야 한다.==
3. ==갑이 고의 또는 중대한 과실로 재산을 은닉하거나 채권자를 누락하여 발생한 불이익(면책불허가, 형사고발 등)에 대해서는 을이 책임지지 아니한다.==

제 4 조 (계약의 해지 및 정산)
1. 갑 또는 을은 정당한 사유가 있는 경우 서면 통지로써 본 계약을 해지할 수 있다.
2. 해지 시점까지 을이 이미 수행한 업무(상담, 부채조사, 서류작성, 접수 등)에 대한 정당한 보수는 대한변호사협회 보수 기준 및 진행 단계에 따라 공제 후 정산한다.

제 5 조 (비밀유지)
을은 본 위임 사무를 수행하는 과정에서 취득한 갑의 개인정보, 채무내역 및 영업비밀을 제3자에게 누설하지 아니한다.

본 계약의 성립을 증명하기 위하여 당사자는 전자서명법 제3조에 따라 전자서명을 날인하여 체결한다.

체결일자: {{계약일자}}`
  },
  {
    id: 'std_main_contract_enhanced',
    title: '개인회생·파산 사건 위임계약서 (특약 강화형 - 분납·실비정산)',
    description: '부채발급 대행 실비 정산, 2회 연체 시 기한이익 상실 및 채권자 누락 책임 한계 특약이 포함된 실무형 계약서',
    category: 'contract',
    type: 'main_contract',
    signatureRequired: 'both',
    requiredConfirmationText: '기한이익 상실 및 실비 정산 특약을 확인하였습니다',
    tags: ['특약포함', '실무추천', '분납보호'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `개인회생·파산 사건 위임 계약서 (특약 강화형)

위임인 (갑): {{의뢰인명}} (연락처: {{의뢰인연락처}})
수임인 (을): {{법무법인}} 담당변호사 {{변호사명}}

위 당사자는 신의성실의 원칙에 입각하여 다음과 같이 특약이 포함된 위임계약을 체결한다.

제 1 조 (위임 사무)
개인회생(또는 파산·면책) 신청 및 절차 일체의 대리 및 법률자문.

제 2 조 (수임료 및 분납 조건)
1. ==총 수임료: {{총수임료}}원 (부가세 별도)==
2. 착수금 납부 후 잔여 금액은 약정된 납부일에 분할 납부한다.
3. ==[기한이익 상실 특약] 갑이 수임료 분납금을 정당한 사유 없이 2회 이상 연속 연체할 경우, 기한의 이익을 즉시 상실하며 을은 잔여금 전액 청구 및 법원 보정서류 제출을 일시 중단할 수 있다.==

제 3 조 (부채증명서 발급 실비 정산 특약)
1. ==각 금융기관 및 채권자별 부채증명서 발급 수수료 및 발급 대행 실비용은 수임료와 별도로 갑이 전액 부담한다.==

제 4 조 (채권자 누락에 대한 책임 제한)
1. ==갑이 고의·과실로 을에게 알리지 아니한 채권은 변제계획인가 또는 면책결정의 효력이 미치지 아니하며, 이에 따른 법적 책임은 갑에게 있다.==

제 5 조 (계약 해지 시 정산 기준)
신청서 접수 전 해지 시 착수금의 50% 공제, 법원 접수 후 해지 시 수임료 전액 환불 불가함을 원칙으로 한다.

체결일자: {{계약일자}}`
  },
  {
    id: 'std_privacy_consent',
    title: '개인정보 수집·이용 동의서 (개인정보보호법 준수)',
    description: '개인정보보호법 제15조 및 제22조에 따른 필수 개인정보 처리 동의서',
    category: 'consent',
    type: 'privacy_consent',
    signatureRequired: 'client',
    requiredConfirmationText: '개인정보 수집 및 이용에 동의합니다',
    tags: ['법정필수', '개인정보'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `개인정보 수집·이용 동의서

{{법무법인}}(이하 "사무소")은 개인정보보호법 제15조 및 제22조에 따라 의뢰인의 개인정보를 보호하며, 회생·파산 사건의 처리를 위하여 아래와 같이 동의를 구합니다.

1. 수집 및 이용 목적
- 개인회생, 파산, 면책 사건의 신청서 작성 및 관할 법원 제출
- 채권자 목록 및 재산목록 작성, 소득 증빙 검토
- 법원 보정권고·명령 대응 및 재산조회

2. 수집하는 개인정보 항목
- 기본 인적사항: 성명, 주민등록번호(외국인등록번호), 주소, 연락처
- ==금융 및 재산정보: 은행 계좌거래내역(최근 1~2년), 보험해약환급금, 부동산/자동차등록원부, 임대차계약서==
- ==채무정보: 대출원리금, 신용카드 사용내역, 사채 및 차용증, 보증채무 내역==
- 소득정보: 원천징수영수증, 급여명세서, 소득금액증명원, 건강보험료 납부확인서

3. 보유 및 이용 기간
- 위임 사무 종료 시점으로부터 5년 (변호사법 및 관련 세법 기준 보존 연한 준수)

4. 동의 거부권 및 불이익 안내
- 귀하는 개인정보 수집·이용에 동의하지 않을 권리가 있으나, 거부 시 회생·파산 사건의 법원 접수가 불가능합니다.`
  },
  {
    id: 'std_third_party_consent',
    title: '제3자 정보제공 동의서 (법원·채권기관 제공)',
    description: '개인정보보호법 제17조에 따라 관할 법원, 채권 금융사 등에 정보 제공 동의',
    category: 'consent',
    type: 'third_party_consent',
    signatureRequired: 'client',
    requiredConfirmationText: '제3자 정보제공에 동의합니다',
    tags: ['법정필수', '제3자제공'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `제3자 정보제공 동의서

{{법무법인}}은 회생·파산 절차의 적법한 진행을 위해 다음과 같이 개인정보를 제3자에게 제공합니다.

1. 제공받는 자
- 관할 법원(파산부, 회생단독재판부, 회생위원, 파산관재인)
- 채권 금융기관(은행, 저축은행, 캐피탈, 대부업체 등 사건 채권자 일체)
- 한국신용정보원, 국민건강보험공단, 국세청, 국민연금공단

2. 제공 항목
- 성명, 주민등록번호, 주소, 채무총액 및 채권내역, 소득증빙자료, 재산평가액

3. 제공 목적
- 회생·파산 신청서 심리, 채권자집회 공고, 변제계획안 인가 심사

4. 보유 기간
- 제공 목적 달성 시 및 법률 절차 종료 시까지`
  },
  {
    id: 'std_power_of_attorney',
    title: '소송 및 신청 대리 위임장',
    description: '관할 법원에 제출하는 대리인 선임 위임장',
    category: 'power_of_attorney',
    type: 'power_of_attorney',
    signatureRequired: 'client',
    tags: ['법원제출', '위임장'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `위  임  장

위임인: {{의뢰인명}} (주소: {{의뢰인주소}})
대리인: {{법무법인}} 담당변호사 {{변호사명}}

위임인은 아래 사건에 관하여 대리인에게 다음 권한을 일체 위임합니다.

[위임 사건]
- 개인회생 (또는 개인파산 및 면책) 신청 사건

[수여 권한]
1. 신청서, 변제계획안, 진술서, 목록 등의 작성 및 법원 제출
2. 보정권고 및 명령에 대한 소명서 작성, 보정기간 연장 신청
3. 채권자집회 기일 출석 및 의견 진술
4. 송달물 수령, 열람·복사 신청 및 부수되는 일체의 절차 행위

체결일자: {{계약일자}}`
  },
  {
    id: 'std_debt_cert_delegation',
    title: '부채증명서 발급 대행 위임장 및 확인서',
    description: '의뢰인을 대신하여 채권사 부채증명서를 일괄 발급받기 위한 실무 필수 위임장',
    category: 'power_of_attorney',
    type: 'custom',
    signatureRequired: 'client',
    requiredConfirmationText: '부채증명서 발급 대행에 동의합니다',
    tags: ['실무필수', '발급대행', '부채조사'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `부채증명서 발급 대행 위임장

위임인 (채무자): {{의뢰인명}}
생년월일: 신분증 사본 참조
연락처: {{의뢰인연락처}}

수임인: {{법무법인}} (담당: {{변호사명}} 변호사 및 소속 직원)

위임인은 채무자 회생 및 파산 절차의 채권자 목록 작성을 위하여, 수임인에게 본인의 각 금융기관 및 대부업체, 보증기관에 대한 부채증명서, 잔액증명서, 대출원장 발급 신청 및 수령 권한을 위임합니다.

1. ==위임인은 발급에 소요되는 각 금융사 제증명 발급 수수료 및 우편 실비를 전액 부담함을 확인합니다.==
2. 본 위임장은 회생·파산 사건 준비 목적 이외의 용도로 사용되지 아니합니다.

체결일자: {{계약일자}}`
  },
  {
    id: 'std_installment_agreement',
    title: '수임료 분할납부 약정서 (기한이익 상실 포함)',
    description: '수임료 분납 시 납부 기일, 연체 이자 및 2회 이상 연체 시 기한이익 상실 조항 명시',
    category: 'special_terms',
    type: 'installment_agreement',
    signatureRequired: 'both',
    requiredConfirmationText: '분납금 연체 시 기한이익 상실 조항을 확인하였습니다',
    tags: ['분납약정', '수임료', '채권관리'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `수임료 분할납부 약정서

위임인 {{의뢰인명}}(이하 "갑")과 {{법무법인}}(이하 "을")은 수임료 분할납부에 관하여 다음과 같이 약정한다.

1. 총 분납 약정액: 일금 {{총수임료}}원정 (상세 스케줄은 첨부 납부표에 의함)
2. 납부 기일: 매월 지정된 일자에 지정 전용계좌로 입금한다.
3. ==[기한의 이익 상실] 갑이 납부 기일로부터 14일 이상 연체하거나 2회 연속 분납금을 미납할 경우, 별도 최고 없이 기한의 이익을 상실하며 즉시 미납 잔액 전액을 변제하여야 한다.==
4. ==연체 시 을은 법원 서류 제출을 일시 보류할 수 있으며, 이로 인한 신청 기각 등 불이익에 대해 을은 책임을 지지 않는다.==`
  },
  {
    id: 'std_procedure_consent',
    title: '사건 진행 및 면책 절차 성실 이행 확인서',
    description: '절차 기간, 면책 불허가 가능성 및 법원 보정 성실 이행 확인서',
    category: 'consent',
    type: 'procedure_consent',
    signatureRequired: 'client',
    requiredConfirmationText: '면책 불허가 사유를 고지받았으며 성실히 임하겠습니다',
    tags: ['면책고지', '필독조항', '부인방지'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `사건 진행 및 면책 절차 성실 이행 확인서

의뢰인 {{의뢰인명}}은 아래 중요 사항에 대하여 담당 변호사로부터 충분한 설명을 듣고 이해하였음을 확인합니다.

1. ==[결과 불보장 고지]==
회생인가 및 파산면책은 관할 법원의 엄격한 심사를 거쳐 결정되며, ==변호사 사무소는 결과를 100% 보장하지 않습니다.==

2. ==[면책 불허가 사유]==
채무 발생 원인이 도박, 가상화폐 등 사행성 행위이거나, 재산은닉 또는 허위 채무 부담이 있는 경우 법원 심사 결과에 따라 면책이 불허가되거나 변제율이 상향될 수 있습니다.

3. ==[보정 서류 제출 협조 의무]==
법원의 보정명령에 정해진 기한 내에 서류를 제출하지 못하면 사건이 기각될 수 있으므로, 의뢰인은 요구 서류를 지체 없이 제출하여야 합니다.`
  },
  {
    id: 'std_spouse_consent',
    title: '배우자 재산 소명 및 자료제출 동의서',
    description: '회생 심사 시 배우자 명의 재산 조사 및 관련 금융 서류 제출 동의',
    category: 'consent',
    type: 'spouse_consent',
    signatureRequired: 'client',
    requiredConfirmationText: '배우자 재산 소명 협조에 동의합니다',
    tags: ['기혼자필수', '배우자재산', '소명협조'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `배우자 재산 소명 및 자료제출 동의서

본인은 채무자 {{의뢰인명}}의 회생·파산 사건과 관련하여 다음 사항을 확인하고 동의합니다.

1. ==법원 실무준칙에 따라 혼인 기간 중 형성된 배우자 명의 재산(부동산, 임차보증금, 예금, 자동차)의 1/2이 채무자의 청산가치에 반영될 수 있음을 고지받았습니다.==
2. 법원 또는 회생위원의 보정권고 시 배우자의 재산 및 소득 소명자료(지방세세목별과세증명서, 지적전산자료조회결과서 등) 제출에 적극 협조합니다.`
  },
  {
    id: 'std_id_confirmation',
    title: '신분증 사본 제출 확인서',
    description: '주민등록증/운전면허증 사본 제출 증빙',
    category: 'custom',
    type: 'id_confirmation',
    signatureRequired: 'client',
    tags: ['신분확인', '본인증빙'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `신분증 사본 제출 확인서

{{법무법인}}은 의뢰인의 본인 확인 및 법원 대리인 선임계 제출을 위해 아래 신분증 사본을 정히 수령하였음을 확인합니다.

- 의뢰인 성명: {{의뢰인명}}
- 연락처: {{의뢰인연락처}}
- 신분증 종류: □ 주민등록증  □ 운전면허증  □ 여권
- 제출일자: {{계약일자}}`
  },
  {
    id: 'std_confidentiality_pledge',
    title: '비밀유지 및 채무자 권리보호 서약서',
    description: '직장/가족 비밀 보장 및 금지명령 송달 후 채권자 추심 대응 확약',
    category: 'custom',
    type: 'custom',
    signatureRequired: 'lawyer',
    tags: ['안심보증', '비밀유지', '추심차단'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: `비밀유지 및 채무자 권리보호 서약서

{{법무법인}}은 의뢰인 {{의뢰인명}} 님의 심리적 안정을 최우선으로 하며 아래 사항을 서약합니다.

1. ==[철저한 비밀유지]== 의뢰인의 사건 위임 사실 및 일체의 상담 내용은 직장이나 제3자에게 절대 누설하지 않습니다.
2. ==[추심 금지명령 즉시 신청]== 접수 즉시 금지명령을 신청하여 채권자의 불법 방문추심 및 압류를 신속히 차단합니다.
3. ==[대리인 송달 송달지 지정]== 법원 우편물이 직장이나 자택으로 송달되지 않도록 송달영수인 및 송달장소를 당 법무법인으로 일원화합니다.

담당변호사: {{변호사명}} (인)`
  }
];

// ── 로컬스토리지 키 ──
const CUSTOM_TEMPLATES_KEY = 'lawyer_custom_contract_templates';

// ── 치환 변수 적용 유틸리티 ──
export function applyTemplatePlaceholders(content: string, vars: PlaceholderVariables): string {
  if (!content) return '';
  const clientName = vars.clientName || '의뢰인';
  const clientPhone = vars.clientPhone || '010-0000-0000';
  const clientAddress = vars.clientAddress || '주소 미입력';
  const lawyerName = vars.lawyerName || '담당 변호사';
  const lawFirmName = vars.lawFirmName || '법무법인';
  const totalFeeStr = vars.totalFee ? ((vars.totalFee * 10000).toLocaleString() + '원') : '협의 금액';
  const contractDate = vars.contractDate || new Date().toISOString().split('T')[0];

  return content
    .replace(/\{\{의뢰인명\}\}/g, clientName)
    .replace(/\{\{의뢰인연락처\}\}/g, clientPhone)
    .replace(/\{\{의뢰인주소\}\}/g, clientAddress)
    .replace(/\{\{변호사명\}\}/g, lawyerName)
    .replace(/\{\{법무법인\}\}/g, lawFirmName)
    .replace(/\{\{총수임료\}\}/g, totalFeeStr)
    .replace(/\{\{계약일자\}\}/g, contractDate);
}

// ── 사무소 맞춤 양식 CRUD ──
export function loadLawyerCustomTemplates(): LawyerContractTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLawyerCustomTemplate(tpl: Omit<LawyerContractTemplate, 'createdAt' | 'updatedAt'> & { id?: string }): LawyerContractTemplate {
  const list = loadLawyerCustomTemplates();
  const now = new Date().toISOString();
  const id = tpl.id || `custom-tpl-${Date.now()}`;
  const completeTpl: LawyerContractTemplate = {
    ...tpl,
    id,
    isCustom: true,
    createdAt: (tpl as any).createdAt || now,
    updatedAt: now,
  };

  const existingIdx = list.findIndex(item => item.id === id);
  if (existingIdx >= 0) {
    list[existingIdx] = completeTpl;
  } else {
    list.unshift(completeTpl);
  }

  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
  return completeTpl;
}

export function deleteLawyerCustomTemplate(id: string): void {
  const list = loadLawyerCustomTemplates();
  const filtered = list.filter(item => item.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(filtered));
}

// ── 템플릿을 ContractDocument 객체로 변환 ──
export function templateToContractDocument(tpl: LawyerContractTemplate, vars: PlaceholderVariables, order: number): ContractDocument {
  const filledContent = applyTemplatePlaceholders(tpl.content, vars);
  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: tpl.type,
    title: tpl.title,
    content: filledContent,
    signatureRequired: tpl.signatureRequired,
    order,
    included: true,
    requiredConfirmationText: tpl.requiredConfirmationText,
  };
}
