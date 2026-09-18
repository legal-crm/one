/**
 * 회생·파산 법원 전자소송 서식 마스터 레지스트리 (80여 종 전수 카탈로그 & 추천 룰 엔진)
 * 법원 실무준칙 및 대법원 전자소송 분류 체계 준용
 */
import type { ConsultRequest, CrmClientExtension } from '../../types';

export type DocCategory = 
  | 'CORE'           // 본신청 및 필수 서식
  | 'STAY_INJUNCT'   // 긴급 보전, 금지/중지 명령
  | 'EVIDENCE'       // 소명자료 및 부속 서식 (의뢰인 작성 포함)
  | 'SERVICE'        // 송달, 주소보정, 특별송달, 공고갈음
  | 'CORRECTION'     // 법원 보정명령 대응 (최저생계비, 배우자, 소득 등)
  | 'MODIFICATION'   // 절차 진행 중 채권자목록 수정, 변제계획 변경
  | 'RELEASE'        // 인가 후 압류/가압류 해제, 면책신청, 신용회복
  | 'APPEAL';        // 즉시항고, 이의신청, 채권조사확정재판, 소송

export type DocCaseScope = 'REHAB' | 'BANKRUPTCY' | 'INHERITED' | 'COMMON';
export type DocTypeNature = 'ISSUED_BY_AGENCY' | 'SELF_WRITTEN' | 'LAWYER_COURT';

export interface IssuanceGuideInfo {
  agencyName: string;            // 발급 기관 (정부24, 홈택스 등)
  agencyUrl?: string;            // 바로가기 URL
  agencyPhone?: string;          // 대표 콜센터 번호
  issuanceSteps: string[];       // 발급 단계 요령
  maskingRequired: boolean;      // 제3자 주민번호 마스킹 필수 여부
  tips?: string;                 // 추가 주의사항
  validityPeriod?: string;       // 유효기간 (예: 발급일 기준 1개월 이내)
}

export interface QuestionnaireField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'radio' | 'currency';
  options?: string[];
  placeholder?: string;
  required: boolean;
  helpText?: string;
  defaultValue?: any;
}

export interface LegalDocItem {
  docCode: string;               // 경쟁사 및 법원 문서번호 (예: 121150, 122013)
  title: string;                 // 서식 공식 명칭
  caseScope: DocCaseScope;       // 적용 사건 유형
  category: DocCategory;         // 서식 분류군
  subCategoryText: string;       // 소분류 (자동작성, 기타, 보정서, 답변서)
  docTypeNature?: DocTypeNature; // ISSUED_BY_AGENCY | SELF_WRITTEN | LAWYER_COURT
  issuanceGuide?: IssuanceGuideInfo; // 발급형 서류 안내
  questionnaireSchema?: QuestionnaireField[]; // 자가작성형 문답 필드
  isClientMobileSupport?: boolean; // 의뢰인 모바일 자가작성/전자서명 지원 여부
  courtOrderSlot?: string;       // 전자소송 결합 표준 슬롯 (R01~R14, B01~B10 또는 첨부)
  priorityLevel: 'CRITICAL' | 'HIGH' | 'NORMAL'; // 중요도
  description: string;           // 실무 용도 및 제출 시점 설명
  defaultPurpose?: string;       // 기본 신청취지/보정취지 템플릿
  defaultReasonTemplate?: string;// 기본 신청이유/보정사유 템플릿
  defaultEvidenceList?: string[];// 필요 첨부 서류
  storageTier?: 'HOT' | 'WARM' | 'COLD'; // 보관 등급: HOT(상시노출) | WARM(상황별라이브러리) | COLD(특수·딥아카이브)
  precedentSnippet?: string;     // 로펌 과거 모범 선례 기재례
}

// 80여 종 법원 서식 전수 카탈로그
export const ALL_LEGAL_DOC_REGISTRY: LegalDocItem[] = [
  // ── 1. 본신청 및 필수 서식 (CORE) ──
  {
    docCode: '100001',
    title: '개인회생신청서',
    caseScope: 'REHAB',
    category: 'CORE',
    subCategoryText: '자동작성',
    courtOrderSlot: 'R04',
    priorityLevel: 'CRITICAL',
    description: '개인회생절차 개시를 구하는 본안 신청서',
    defaultPurpose: '신청인에 대하여 개인회생절차를 개시한다. 라는 결정을 구합니다.'
  },
  {
    docCode: 'D5102',
    title: '개인회생 재산목록',
    caseScope: 'COMMON',
    category: 'CORE',
    subCategoryText: '자동작성',
    courtOrderSlot: 'R06',
    priorityLevel: 'CRITICAL',
    description: '청산가치 보장의 원칙 기준이 되는 보유 부동산, 차량, 예금, 보험, 임차보증금 목록 (대법원 전산양식 D5102)',
    defaultPurpose: '채무자 회생 및 파산에 관한 법률 제589조 제2항 제2호에 의하여 별지와 같이 재산목록을 제출합니다.',
    defaultReasonTemplate: '신청인의 부동산(KB시세/공시가 130%), 자동차(중고시세), 임차보증금(소액보증금 공제) 등 객관적 평가 기준에 의하여 성실히 작성하였습니다.'
  },
  {
    docCode: 'D5103',
    title: '채무자의 수입 및 지출에 관한 목록',
    caseScope: 'COMMON',
    category: 'CORE',
    subCategoryText: '자동작성',
    courtOrderSlot: 'R08',
    priorityLevel: 'CRITICAL',
    description: '개인회생 변제금 산정의 기준이 되는 월평균 순소득 및 법정 생계비 목록 (대법원 전산양식 D5103)',
    defaultPurpose: '채무자 회생 및 파산에 관한 법률 제589조 제2항 제3호에 의하여 별지와 같이 수입 및 지출에 관한 목록을 제출합니다.',
    defaultReasonTemplate: '신청인의 계속적·반복적 수입 및 부양가족 수에 따른 2026년 기준 법정생계비를 반영하여 월 가용소득을 성실히 산출하였습니다.'
  },
  {
    docCode: '100002',
    title: '파산 및 면책신청서',
    caseScope: 'BANKRUPTCY',
    category: 'CORE',
    subCategoryText: '자동작성',
    courtOrderSlot: 'B01',
    priorityLevel: 'CRITICAL',
    description: '파산선고 및 면책결정을 동시에 구하는 기본 신청서',
    defaultPurpose: '1. 신청인을 파산자로 한다.\n2. 신청인을 면책한다. 라는 결정을 구합니다.'
  },
  {
    docCode: '100003',
    title: '상속재산파산신청서',
    caseScope: 'INHERITED',
    category: 'CORE',
    subCategoryText: '자동작성',
    priorityLevel: 'HIGH',
    description: '망인의 채무 초과 상속재산을 청산하기 위한 파산신청서'
  },
  {
    docCode: '100004',
    title: '파산신청서 (채권자용)',
    caseScope: 'BANKRUPTCY',
    category: 'CORE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '채권자가 채무자의 지급불능을 이유로 신청하는 파산신청서'
  },
  {
    docCode: '100006',
    title: '(전환용) 파산면책 신청서',
    caseScope: 'COMMON',
    category: 'CORE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '개인회생 절차 폐지 또는 불인가 후 파산으로 전환 신청하는 양식'
  },
  {
    docCode: '100008',
    title: '주택담보대출채권채무재조정프로그램신청서',
    caseScope: 'REHAB',
    category: 'CORE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '1세대 1주택 실거주 주택담보대출 연체 방지 및 분할상환 특례 신청서'
  },
  {
    docCode: '111390',
    title: '신청서제출위임장',
    caseScope: 'COMMON',
    category: 'CORE',
    subCategoryText: '기타',
    courtOrderSlot: 'R14',
    isClientMobileSupport: true,
    priorityLevel: 'CRITICAL',
    description: '변호사 대리인 선임 및 법원 서류 제출 대리 위임장'
  },

  // ── 2. 긴급 보전·중지·금지명령 (STAY_INJUNCT) ──
  {
    docCode: '121150',
    title: '금지명령신청서 (급여소득자)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '개시결정 전 채권자들의 급여 압류 및 독촉/변제요구 행위 금지',
    defaultPurpose: '개인회생절차의 개시신청에 대한 결정이 있을 때까지 채권자들은 신청인의 급여채권에 대한 강제집행, 가압류 또는 채무 변제 요구 행위를 일체 하여서는 아니 된다. 라는 결정을 구합니다.',
    defaultReasonTemplate: '신청인은 성실하게 직장에 근무하며 급여를 수령하여 가용소득으로 변제계획을 수행하고자 하나, 채권자들의 무차별적인 급여 압류 및 독촉으로 인하여 직장생활과 기본 생계가 심각히 위협받고 있으므로 채무자회생법 제593조 제1항에 기하여 본 신청에 이른 것입니다.'
  },
  {
    docCode: '121140',
    title: '금지명령신청서 (영업소득자)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '개시결정 전 자영업자/사업자의 사업장 자산 및 매출채권 압류/독촉 금지',
    defaultPurpose: '개인회생절차 개시신청에 대한 결정이 있을 때까지 채권자들은 신청인의 영업용 자산 및 매출채권에 대한 강제집행이나 변제 요구를 하여서는 아니 된다. 라는 결정을 구합니다.'
  },
  {
    docCode: '121170',
    title: '중지명령신청서 (급여소득자)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '이미 진행 중인 급여 압류 및 전부·추심명령 절차의 일시적 정지',
    defaultPurpose: '신청인과 채권자 사이의 별지 기재 채권압류 및 추심명령에 기한 강제집행 절차는 개인회생절차 개시신청에 대한 결정이 있을 때까지 이를 중지한다. 라는 결정을 구합니다.'
  },
  {
    docCode: '121160',
    title: '중지명령신청서 (영업소득자)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '이미 진행 중인 사업장 유체동산/매출채권 압류 절차 중지'
  },
  {
    docCode: '121201',
    title: '강제집행중지신청 (부동산)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '채무자 소유 부동산에 대한 임의경매 또는 강제경매 절차의 중지'
  },
  {
    docCode: '121202',
    title: '강제집행중지신청 (유체동산)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '가재도구, 가전제품, 사업장 집기 등 빨간딱지 경매 절차 중지'
  },
  {
    docCode: '121203',
    title: '강제집행중지신청 (급여)',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '직장 급여 압류 절차 중지 및 회사 추심금 지급 보류'
  },
  {
    docCode: '121211',
    title: '배당절차중지신청서',
    caseScope: 'REHAB',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '경매 매각대금 배당기일 전 배당표 확정 및 배당금 지급 중지'
  },
  {
    docCode: '133011',
    title: '금지명령신청서 (파산)',
    caseScope: 'BANKRUPTCY',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '파산절차 신청 중 채권자의 강제집행 등 보전처분 금지'
  },
  {
    docCode: '133012',
    title: '중지명령·금지명령·면제재산 신청서 (파산)',
    caseScope: 'BANKRUPTCY',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '파산선고 전 집행중지와 1,110만 원 면제재산 지정을 동시 신청'
  },
  {
    docCode: '133016',
    title: '강제집행정지신청서 (파산/면책)',
    caseScope: 'BANKRUPTCY',
    category: 'STAY_INJUNCT',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '파산선고 및 면책신청 계류 중 진행 중인 강제집행 일시 정지'
  },

  // ── 3. 소명·부속 서식 (EVIDENCE - 의뢰인 모바일 연동 포함) ──
  {
    docCode: '111110',
    title: '무상거주사실 확인서',
    caseScope: 'COMMON',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    isClientMobileSupport: true,
    priorityLevel: 'CRITICAL',
    description: '본인 명의 임대차계약 없이 부모, 친척, 지인 명의 주택에 무상 거주함을 소명',
    defaultPurpose: '신청인이 아래 소유자/임차인의 주거지에 임차보증금 및 월세 부담 없이 무상으로 동거·거주하고 있음을 확인합니다.',
    defaultReasonTemplate: '신청인은 경제적 파탄으로 인하여 독립된 주거를 마련할 여력이 없어, 건물주/임차인의 배려로 보증금 및 차임 없이 무상으로 동거하고 있으며, 이로 인해 은닉된 임차보증금 반환채권이 존재하지 아니함을 사실대로 확인합니다.'
  },
  {
    docCode: '121020',
    title: '사채진술서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    isClientMobileSupport: true,
    priorityLevel: 'CRITICAL',
    description: '금융기관이 아닌 개인 대여자(사채, 지인)로부터 차용한 내역 및 이자 소명',
    defaultPurpose: '개인 채권자에 대한 차용 원금, 차용 경위, 이자 지급 내역을 사실대로 진술합니다.'
  },
  {
    docCode: '121040',
    title: '금융자료제공동의서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    isClientMobileSupport: true,
    priorityLevel: 'HIGH',
    description: '회생위원 및 법원의 금융거래내역 및 계좌 조회 열람 동의서'
  },
  {
    docCode: '121060',
    title: '소득진술서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    isClientMobileSupport: true,
    priorityLevel: 'HIGH',
    description: '4대보험 미가입자, 일용직, 아르바이트생의 월평균 실수령 소득 진술서'
  },
  {
    docCode: '121010',
    title: '자료송부청구서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '금융기관 등에 부채증명서 또는 거래내역서 발급을 촉탁 청구하는 서식'
  },
  {
    docCode: '121011',
    title: '면제재산결정신청서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '주택임차보증금(서울 5,500만 원 등) 또는 6개월 생계비(1,110만 원) 청산가치 제외 신청'
  },
  {
    docCode: '121030',
    title: '채권존재확인서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '차용증 분실 채권에 대해 채권자가 채무액의 존재를 인정한 확인서'
  },
  {
    docCode: '121050',
    title: '소득증명서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '고용주가 직원의 월급여 및 수당을 직접 증명하는 확인서'
  },
  {
    docCode: '121070',
    title: '재직증명서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '현재 사업장 또는 기업에 계속 재직 중임을 증명하는 서식'
  },
  {
    docCode: '121080',
    title: '예상퇴직금확인서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '현재 퇴직 시 수령 가능한 예상퇴직금(1/2 청산가치 반영용) 회사 발급 확인서'
  },
  {
    docCode: '121090',
    title: '부동산시가확인서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '인근 공인중개사가 확인한 주택/토지 시세 소명표'
  },
  {
    docCode: '121100',
    title: '오토바이시가확인서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '배달 라이더 소유 이륜차량의 중고 매매 시세 확인서'
  },
  {
    docCode: '121111',
    title: '점포무상사용사실증명원',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '사업장 점포를 임대료 없이 무상으로 사용하고 있음을 소명'
  },
  {
    docCode: '121120',
    title: '급여(가)압류적립금확인서',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '제3채무자(직장)에 압류되어 보관 중인 적립금 액수 및 1회차 투입 확인서'
  },
  {
    docCode: '121130',
    title: '비품, 재고품, 설비시가표',
    caseScope: 'REHAB',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '영업소득자의 사업장 내부 집기비품 및 원자재 재고 청산가치 평가표'
  },
  {
    docCode: '113120',
    title: '배우자배당신청서',
    caseScope: 'COMMON',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '공동명의 주택 경매 시 배우자 지분에 대한 우선 배당 신청'
  },
  {
    docCode: '113130',
    title: '배우자우선매수신고서',
    caseScope: 'COMMON',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '경매 진행 시 배우자가 최고가매수신고가격으로 우선 매수하겠다는 신고서'
  },
  {
    docCode: '115030',
    title: '상속재산포기심판청구서',
    caseScope: 'COMMON',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '망인의 채무 상속을 회피하기 위한 가정법원 상속포기 청구서'
  },
  {
    docCode: '115040',
    title: '상속재산한정승인심판청구서',
    caseScope: 'COMMON',
    category: 'EVIDENCE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '상속받은 재산의 한도 내에서 채무를 변제하기 위한 한정승인 청구서'
  },

  // ── 4. 송달·주소·조회 서식 (SERVICE) ──
  {
    docCode: '112141',
    title: '보정서 (채권자 주소불명)',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '송달이 안 된 금융기관/대부업체의 주민등록초본 또는 법인등기부 주소 보정'
  },
  {
    docCode: '112142',
    title: '보정서 (연대보증인 주소불명)',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '보증인 주소 송달불능에 따른 주소보정서'
  },
  {
    docCode: '112143',
    title: '주소보정서 (회생/파산)',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '법원의 주소보정명령에 따라 새로 발급받은 채권자/채무자 주소 제출'
  },
  {
    docCode: '112144',
    title: '특별송달신청서 (회생/파산)',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '채권자가 주간에 폐문부재인 경우 야간송달 또는 휴일송달 신청'
  },
  {
    docCode: '112145',
    title: '송달되지않는채권자에대한공고갈음신청서',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '폐업 또는 야간송달로도 송달이 불가능한 채권자에 대해 법원 게시판 공고로 송달 갈음'
  },
  {
    docCode: '112191',
    title: '사실조회촉탁신청',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '통신사, 은행, 행정기관 등에 주소 또는 채권 잔액 사실조회 요청'
  },
  {
    docCode: '112192',
    title: '송달장소변경신청서 (회생/파산 공통)',
    caseScope: 'COMMON',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '채무자 이사 또는 직장 변경 시 법원 우편물 수령지 변경'
  },
  {
    docCode: '133114',
    title: '송달장소변경신청서 (파산)',
    caseScope: 'BANKRUPTCY',
    category: 'SERVICE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '파산사건 전용 송달장소 변경신청서'
  },
  {
    docCode: '122120',
    title: '보정서 (신청인의 주소변경)',
    caseScope: 'REHAB',
    category: 'SERVICE',
    subCategoryText: '보정서',
    priorityLevel: 'NORMAL',
    description: '회생 진행 중 신청인의 주민등록 전출입에 따른 주소 정정'
  },
  {
    docCode: '122150',
    title: '보정서 (채권자 주소변경)',
    caseScope: 'REHAB',
    category: 'SERVICE',
    subCategoryText: '보정서',
    priorityLevel: 'NORMAL',
    description: '채권자의 본점 이전 등에 따른 채권자목록 상 주소 변경'
  },

  // ── 5. 법원 보정명령 대응 핵심 14종 (CORRECTION) ──
  {
    docCode: '122010',
    title: '보정서 (백지양식/통합)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '법원의 포괄적 보정명령에 대한 표준 종합 답변 및 증빙 제출서',
    defaultPurpose: '귀원의 2026. 00. 00.자 보정명령에 대하여 신청인은 별지와 같이 성실하게 보정합니다.'
  },
  {
    docCode: '122011',
    title: '보정서 (최저생계비 조정비율)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '기준 중위소득 60% 생계비 인정 여부 및 주거비/의료비 추가 인정 소명',
    defaultReasonTemplate: '신청인의 가구는 필수적인 주거비 및 만성질환 의료비 지출이 불가피하여 보건복지부 기준 최저생계비 100% 미만으로는 정상적인 변제 수행이 불가능한바, 실무준칙에 의거 생계비 조정을 탄원합니다.'
  },
  {
    docCode: '122012',
    title: '보정서 (누락된 채권자 추가시)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '신청 당시 누락되었던 금융기관 및 보증기관을 채권자목록에 추가',
    defaultPurpose: '누락된 채권자(별지 목록)를 채권자목록에 추가하고 이에 맞추어 변제계획안을 수정 제출합니다.'
  },
  {
    docCode: '122013',
    title: '보정서 (근로능력 있는 배우자의 부양사유)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '배우자가 경제활동을 하지 못하고 부양가족으로 포함되어야 하는 사유 소명',
    defaultReasonTemplate: '신청인의 배우자는 미취학 자녀 양육(또는 중증 질환, 간병)으로 인하여 상시 경제활동에 종사할 수 없는 상태에 있으며, 실질적으로 신청인의 소득만으로 전 가족이 생계를 유지하고 있습니다.'
  },
  {
    docCode: '122020',
    title: '보정서 (전세보증금 형성과정)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '임차보증금 자금 출처(부모 지원, 대출, 기존 보증금 이동) 투명 소명'
  },
  {
    docCode: '122030',
    title: '보정서 (배우자 부양가족 제외)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'HIGH',
    description: '법원의 지적에 따라 배우자를 부양가족에서 제외하고 생계비를 재산정'
  },
  {
    docCode: '122040',
    title: '보정서 (실제 급여액 소명)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '상여금, 야근수당 변동 및 이직 후 최근 3~6개월 통장 실수령액 분석 소명'
  },
  {
    docCode: '122050',
    title: '보정서 (영업소득자 평균소득)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '부가세 과세표준, 카드매출내역, 필요경비(임대료, 재료비, 인건비) 공제 소명'
  },
  {
    docCode: '122060',
    title: '보정서 (부양사유 임차보증금)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'HIGH',
    description: '가족 주거 안정을 위해 지출된 임차보증금의 정당성 소명'
  },
  {
    docCode: '122070',
    title: '보정서 (부양사유 주택구입)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'NORMAL',
    description: '과거 주택 매입 자금 흐름 및 시세 하락 손실 소명'
  },
  {
    docCode: '122080',
    title: '보정서 (급여압류적립금 투입)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '인가 시점에 직장에 압류되어 모인 적립금을 1회차 변제금으로 일시 투입 계획 소명'
  },
  {
    docCode: '122090',
    title: '보정서 (소액채무, 부채증명)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'HIGH',
    description: '최근 발생한 소액 대출 및 카드론 사용처 영수증 소명'
  },
  {
    docCode: '122100',
    title: '보정서 (개시전 대위변제)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'HIGH',
    description: '신용보증재단, 서울보증보험 등이 원채권자를 대위변제함에 따른 채권자 교체'
  },
  {
    docCode: '122110',
    title: '보정서 (배우자 소득없음 소명)',
    caseScope: 'REHAB',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '배우자의 사실증명원(소득금액 없음) 및 건강보험 자격득실확인서 제출'
  },
  {
    docCode: '135030',
    title: '보정서 (법원의 보정명령에 대하여 - 파산)',
    caseScope: 'BANKRUPTCY',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'CRITICAL',
    description: '파산관재인의 환가 및 면책불허가 사유 조사 보정명령 답변서'
  },
  {
    docCode: '135031',
    title: '보정서 (누락된 채권자 추가시 - 파산)',
    caseScope: 'BANKRUPTCY',
    category: 'CORRECTION',
    subCategoryText: '보정서',
    priorityLevel: 'HIGH',
    description: '파산 채권자목록에 누락된 채권자 추가 신고'
  },

  // ── 6. 절차 진행 중 수정 및 신고 (MODIFICATION) ──
  {
    docCode: '121250',
    title: '채권자목록수정허가신청서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '개시결정 이후 채권 양도·양수 또는 이의에 따른 목록 수정 허가 신청'
  },
  {
    docCode: '121251',
    title: '채권자목록변경신고서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '단순 주소 및 계좌 변경 등 경미한 사항의 변경 신고서'
  },
  {
    docCode: '121252',
    title: '채권자목록 및 변제계획안 수정허가신청서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '채권액 변동에 따라 변제표와 채권자목록을 일괄 수정 허가 신청'
  },
  {
    docCode: '121260',
    title: '변제계획수정안제출서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '인가 전 회생위원 수정 권고에 따른 수정 변제계획안 제출'
  },
  {
    docCode: '121270',
    title: '채권자계좌번호신고서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '변제금 입금용 채권자의 법인 계좌번호 신고'
  },
  {
    docCode: '121321',
    title: '개인회생채권계산서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '개시결정 당시 원금 및 개시전 이자 계산서'
  },
  {
    docCode: '121380',
    title: '변제계획변경안제출서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '인가결정 후 실직, 질병, 급여 삭감으로 변제율 하향 변경 신청'
  },
  {
    docCode: '121212',
    title: '배당금교부신청서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '경매 공탁 배당금 중 잉여금의 채무자 교부 신청'
  },
  {
    docCode: '121213',
    title: '가압류/압류공탁금변제투입지연사유서',
    caseScope: 'REHAB',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '공탁금 수령 지연으로 인한 1회차 투입 지연 소명 사유서'
  },
  {
    docCode: '133160',
    title: '파산절차속행신청서',
    caseScope: 'BANKRUPTCY',
    category: 'MODIFICATION',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '중지되었던 파산절차의 신속한 속행을 구하는 신청서'
  },

  // ── 7. 인가 후 압류해제·면책·신용회복 핵심 9종 (RELEASE) ──
  {
    docCode: '121320',
    title: '채권압류해제신청서 (급여/통장)',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '인가결정 확정에 따라 종전 급여 및 은행 통장 압류 해제',
    defaultPurpose: '신청인과 채권자 사이의 귀원 채권압류 및 추심명령 사건의 강제집행은 개인회생인가결정 확정으로 실효되었으므로 그 집행을 해제하여 주시기 바랍니다.'
  },
  {
    docCode: '121280',
    title: '채권가압류해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '인가결정 확정에 따른 채권 가압류 집행 해제'
  },
  {
    docCode: '121290',
    title: '부동산가압류해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '인가 확정 후 채무자 소유 아파트/주택 등기부 상 가압류 등기 말소 신청'
  },
  {
    docCode: '121330',
    title: '부동산강제경매해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '인가 확정에 따라 법원 경매계에 부동산 경매 기입등기 말소 촉탁 신청'
  },
  {
    docCode: '121300',
    title: '유체동산가압류해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '살림살이 가압류 해제'
  },
  {
    docCode: '121341',
    title: '유체동산강제집행취소신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '집행관 사무소에 빨간딱지 압류 취소 및 봉인 해제 신청'
  },
  {
    docCode: '121310',
    title: '자동차가압류해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '차량등록원부 상 가압류 기입 등록 말소'
  },
  {
    docCode: '121340',
    title: '자동차강제경매해제신청',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '자동차 인도명령 및 경매 절차 해제'
  },
  {
    docCode: '121420',
    title: '신용불량정보삭제요청서',
    caseScope: 'COMMON',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '면책결정 확정 후 한국신용정보원 및 금융기관에 특수기록코드(1201 등) 삭제 요청'
  },
  {
    docCode: '121231',
    title: '면책신청서 (변제기간중 특별면책)',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '책임질 수 없는 사유(중증 장애, 질병)로 변제 완료 전 조기 특별면책 신청'
  },
  {
    docCode: '121232',
    title: '면책신청서 (변제완료시)',
    caseScope: 'REHAB',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '36개월 또는 24개월 변제 완료 후 정규 면책결정 신청'
  },
  {
    docCode: '133150',
    title: '면책에대한동의서',
    caseScope: 'BANKRUPTCY',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '채권자의 면책 동의서'
  },
  {
    docCode: '133151',
    title: '면책신청서 (파산)',
    caseScope: 'BANKRUPTCY',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '파산절차 종료에 따른 면책 허가 결정 신청'
  },
  {
    docCode: '133110',
    title: '복권신청서',
    caseScope: 'BANKRUPTCY',
    category: 'RELEASE',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '파산선고로 상실된 공·사법상 자격(공무원, 전문직 자격)의 회복 신청'
  },

  // ── 8. 취하·폐지·이의·항고 및 쟁송 (APPEAL) ──
  {
    docCode: '121219',
    title: '개인회생취하서',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '개시결정 전 신청을 자진 철회하는 취하서'
  },
  {
    docCode: '121220',
    title: '개인회생취하허가신청서',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '개시결정 후 취하 시 법원의 허가를 구하는 신청서'
  },
  {
    docCode: '121230',
    title: '개인회생절차폐지신청서',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '소득 상실 등으로 절차 유지가 불가하여 폐지를 구하는 신청서'
  },
  {
    docCode: '135035',
    title: '파산및면책신청취하서',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '파산선고 전 신청을 철회하는 취하서'
  },
  {
    docCode: '115010',
    title: '이의신청 (이행권고결정에 대하여)',
    caseScope: 'COMMON',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '채권자의 지급명령/이행권고결정 확정을 방어하기 위한 2주 내 이의신청서'
  },
  {
    docCode: '115020',
    title: '이의신청 (지급명령에 대하여)',
    caseScope: 'COMMON',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '지급명령 정본 송달 2주 내 독촉절차 중단 및 본안소송 이행 이의'
  },
  {
    docCode: '121422',
    title: '즉시항고장 (금지명령 기각)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '법원의 금지명령 기각 결정에 불복하여 상급법원에 재심리 청구'
  },
  {
    docCode: '121420B',
    title: '즉시항고장 (신청기각결정)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '개시신청 기각결정(7일 이내)에 대한 불복 항고'
  },
  {
    docCode: '121421',
    title: '즉시항고장 (불인가결정)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '변제계획 불인가결정에 대한 즉시항고'
  },
  {
    docCode: '121423B',
    title: '특별항고장 (즉시항고 각하명령에 대한 불복)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '대법원에 헌법 위반을 이유로 제기하는 특별불복 절차'
  },
  {
    docCode: '134040',
    title: '즉시항고장 (파산선고기각)',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '파산선고 기각에 대한 즉시항고'
  },
  {
    docCode: '134050',
    title: '즉시항고장 (면책불허가)',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '면책불허가 결정에 대한 상급심 불복 항고'
  },
  {
    docCode: '121423',
    title: '이의신청서 (개인회생 채권자용)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '채권자가 채권표 또는 변제계획안에 이의를 제기하는 양식'
  },
  {
    docCode: '121424',
    title: '답변서 (채권자의 이의신청에 대하여)',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '답변서',
    priorityLevel: 'CRITICAL',
    description: '채권자의 최근 대출 편파변제 주장 이의에 대한 채무자의 반박 답변서'
  },
  {
    docCode: '135019',
    title: '이의신청서 (파산·면책 채권자용)',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'NORMAL',
    description: '파산 채권자의 면책불허가 사유 주장 이의서'
  },
  {
    docCode: '135020',
    title: '답변서 (채권자 이의신청에 대하여 - 파산)',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '답변서',
    priorityLevel: 'CRITICAL',
    description: '파산 채권자 이의신청에 대한 방어 답변서'
  },
  {
    docCode: '135036',
    title: '채권조사확정재판신청서',
    caseScope: 'REHAB',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '채권액 다툼이 있을 때 법원의 재판으로 채권을 확정하는 신청서'
  },
  {
    docCode: '135040',
    title: '청구이의의소',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '면책 확정 후에도 집행권원으로 압류를 시도하는 채권자에 대한 본안 소송'
  },
  {
    docCode: '135041',
    title: '청구이의의소 (강제집행정지 포함)',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'CRITICAL',
    description: '청구이의 본안소송과 판결 선고 시까지의 집행정지를 병합 신청'
  },
  {
    docCode: '135050',
    title: '면책확인의소',
    caseScope: 'BANKRUPTCY',
    category: 'APPEAL',
    subCategoryText: '기타',
    priorityLevel: 'HIGH',
    description: '누락 채권 또는 비면책 채권 다툼 시 면책되었음을 법적으로 확인 구하는 소송'
  }
];

/**
 * 사건 및 의뢰인 프로파일 기반 스마트 서식 추천 엔진
 */
export function getSmartRecommendedDocs(
  request: ConsultRequest,
  crmExt?: CrmClientExtension
): {
  criticalList: LegalDocItem[];
  conditionalList: LegalDocItem[];
  mobileFillList: LegalDocItem[];
  reasonMap: Record<string, string>;
} {
  const profile = request.financialProfile;
  const status = crmExt?.crmStatus || request.status;
  const reasonMap: Record<string, string> = {};

  const isBankruptcy = (profile?.income || 0) === 0 || (profile?.debtTotal || 0) > 50000;
  const jobType = profile?.jobType || profile?.employmentType || '';
  const isSalaried = jobType.includes('SALARIED') || jobType.includes('salary');
  const isBusiness = jobType.includes('BUSINESS') || jobType.includes('business');
  
  const hasSeizure = (profile?.harassmentLevel === 'SEIZURE' || profile?.legalActions?.includes('SEIZURE')) || false;
  const housingType = profile?.housingType || '';
  const isFreeHousing = housingType === 'free' || housingType.includes('무상');
  const hasPrivateDebt = (profile?.debtTypes?.personals || 0) > 0;
  const hasSpouse = profile?.maritalStatus === 'MARRIED' || profile?.maritalStatus === 'married';
  const hasRecentHighLoan = (profile?.debtTypes?.recentLoans || 0) > 2000 || (profile?.riskFlags?.includes('최근 1년 이내 대출 과다'));

  const criticalCodes = new Set<string>();
  const conditionalCodes = new Set<string>();
  const mobileCodes = new Set<string>();

  // 1. 사건 기본 신청서 및 위임장
  if (isBankruptcy) {
    criticalCodes.add('100002');
    reasonMap['100002'] = '개인파산 및 면책 기본 사건 신청 필수 서식';
  } else {
    criticalCodes.add('100001');
    reasonMap['100001'] = '개인회생절차 개시 기본 필수 서식';
  }
  criticalCodes.add('111390');
  reasonMap['111390'] = '변호사 대리인 선임 및 제출 위임 필수 서식 (모바일 서명 가능)';
  mobileCodes.add('111390');

  // 2. 직업 및 압류 상태에 따른 금지/중지명령
  if (!isBankruptcy) {
    if (isSalaried) {
      criticalCodes.add('121150');
      reasonMap['121150'] = '급여소득자: 개시 전 월급 압류 및 불법 독촉 방어를 위해 즉시 신청 권장';
      if (hasSeizure) {
        criticalCodes.add('121203');
        reasonMap['121203'] = '현재 급여 압류 진행 중: 직장 추심금 지급 중지를 위한 긴급 서식';
        conditionalCodes.add('121120');
        reasonMap['121120'] = '급여압류 적립금 확인: 1회차 변제 투입 소명 필요';
      }
    } else if (isBusiness) {
      criticalCodes.add('121140');
      reasonMap['121140'] = '영업소득자: 사업장 집기 및 카드매출 압류 방지 필수 신청';
      conditionalCodes.add('122050');
      reasonMap['122050'] = '영업소득자 평균소득 소명표 (부가세 및 필요경비 공제)';
    }
  }

  // 3. 주거 및 부속 소명서류 (의뢰인 모바일 자가작성 추천)
  if (isFreeHousing) {
    conditionalCodes.add('111110');
    reasonMap['111110'] = '무상 거주 중: 보증금 은닉 의혹 방지를 위한 무상거주사실확인서 필수 (의뢰인 모바일 서명 지원)';
    mobileCodes.add('111110');
  }

  if (hasPrivateDebt) {
    conditionalCodes.add('121020');
    reasonMap['121020'] = '개인 채무/사채 보유: 법원 편파변제 조사 방어용 사채진술서 (의뢰인 모바일 작성 지원)';
    mobileCodes.add('121020');
  }

  // 4. 퇴직금 및 금융동의서
  if (isSalaried && (profile?.retirementPay || 0) > 0) {
    conditionalCodes.add('121080');
    reasonMap['121080'] = '예상 퇴직금 확인서: 퇴직금 1/2 청산가치 반영 증빙';
  }
  mobileCodes.add('121040');
  reasonMap['121040'] = '금융자료제공동의서: 전자소송 금융조회 동의 (모바일 간편 전자서명 지원)';

  // 5. 배우자 및 보정 대비
  if (hasSpouse) {
    conditionalCodes.add('122013');
    reasonMap['122013'] = '배우자 부양사유 소명서: 배우자 부양가족 인정용 필수 보정 서식';
    conditionalCodes.add('122110');
    reasonMap['122110'] = '배우자 소득없음 소명서: 사실증명원 제출용 서식';
  }

  if (hasRecentHighLoan) {
    conditionalCodes.add('122090');
    reasonMap['122090'] = '최근 1년 대출 과다 플래그: 법원 보정권고 1순위 소명자료 사전 대비 권장';
  }

  // 6. 단계별 (인가 후 / 면책 단계인 경우)
  if (status === 'commenced' || status === 'repaying' || status === 'discharged') {
    criticalCodes.add('121320');
    reasonMap['121320'] = '인가/면책 확정: 종전 급여 및 통장 압류 해제 즉시 신청 가능';
    criticalCodes.add('121420');
    reasonMap['121420'] = '신용불량정보삭제요청서: 한국신용정보원 특수기록 해제';
    conditionalCodes.add('121280');
    reasonMap['121280'] = '채권 가압류 해제신청';
    conditionalCodes.add('121290');
    reasonMap['121290'] = '부동산 가압류 등기 말소 신청';
  }

  const findDoc = (code: string) => ALL_LEGAL_DOC_REGISTRY.find(d => d.docCode === code);

  return {
    criticalList: Array.from(criticalCodes).map(findDoc).filter(Boolean) as LegalDocItem[],
    conditionalList: Array.from(conditionalCodes).map(findDoc).filter(Boolean) as LegalDocItem[],
    mobileFillList: Array.from(mobileCodes).map(findDoc).filter(Boolean) as LegalDocItem[],
    reasonMap
  };
}

/**
 * 3계층 보관 등급(Tier) 판별: HOT (자주씀) | WARM (상황별) | COLD (특수·딥아카이브)
 */
export function getDocumentTier(doc: LegalDocItem): 'HOT' | 'WARM' | 'COLD' {
  if (doc.storageTier) return doc.storageTier;

  // 1. COLD: 1년에 한 번 쓰일까 말까 한 특수·쟁송·희귀 서식
  const coldCodes = new Set([
    '100003', '100004', '113120', '113130', '115030', '115040', 
    '121100', '121111', '121130', '121211', '121212', '121213', 
    '121219', '121220', '121230', '133110', '133160', '135035', 
    '135036', '135040', '135041', '135050'
  ]);
  if (doc.category === 'APPEAL' || coldCodes.has(doc.docCode)) {
    return 'COLD';
  }

  // 2. HOT: 상시 사용 본신청, 핵심 보정 14종, 금지/중지, 대표 압류해제
  const hotCodes = new Set([
    '100001', '100002', '111390', '121150', '121140', '121170', '121203',
    '122010', '122011', '122012', '122013', '122020', '122030', '122040',
    '122050', '122060', '122070', '122080', '122090', '122100', '122110',
    '121320', '121420'
  ]);
  if (hotCodes.has(doc.docCode)) {
    return 'HOT';
  }

  // 3. WARM: 의뢰인 소명, 주소보정, 채권자목록 수정 등
  return 'WARM';
}

/**
 * 특수 서식 작성 시 참조할 수 있는 로펌 과거 모범 선례 문안 조회
 */
export function getDocumentPrecedent(docCode: string): string {
  const PRECEDENT_DB: Record<string, string> = {
    '121130': `[비품·재고품·설비 시가 산정 모범 선례]\n- 사업장 소재지: 서울 중구 명동길 12, 2층 (일반음식점)\n- 주방 집기류: 업소용 냉장고(구입 5년 경과, 내용연수 초과) 감가상각 90% 적용 ➔ 청산가치 30만 원 반영\n- 테이블 및 의자: 12조 일괄 매각 추정가 20만 원 반영\n- 식자재 재고: 유통기한 임박 생물 특성상 청산가치 0원 처리 인가 득함.`,
    '135041': `[청구이의의소 및 강제집행정지 모범 선례]\n1. 원고는 피고의 지급명령에 기한 채권을 파산 및 면책결정(서울회생법원 2024하단1234, 2024하면5678)에 의하여 전액 면책받았습니다.\n2. 피고는 위 면책 사실을 통지받았음에도 불구하고 집행력 있는 정본에 기하여 원고의 급여채권에 대한 압류를 강행하고 있는바,\n3. 원고는 본안 판결 확정 시까지 피고의 위 집행권원에 기한 강제집행의 일시 정지를 긴급히 구합니다.`,
    '135036': `[채권조사확정재판신청 모범 선례]\n1. 채권자가 신고한 채권액 5,000만 원 중 이자제한법(연 20%)을 초과하여 선이자로 공제된 800만 원 및 불법 중개수수료 200만 원은 무효입니다.\n2. 따라서 개시결정 당시 실질 채권 원금은 4,000만 원에 불과하므로 귀원의 재판으로 이를 정당하게 확정하여 주시기 바랍니다.`,
    '113130': `[배우자 우선매수신고서 모범 선례]\n- 경매사건: 2025타경 9876호 부동산임의경매\n- 신고인(배우자): 본인은 공유자(지분 1/2)로서 민사집행법 제140조에 따라 최고가매수신고가격과 동일한 가격으로 우선 매수할 것을 신고하며, 보증금을 즉시 납부할 준비가 되어 있습니다.`
  };

  return PRECEDENT_DB[docCode] || `[로펌 표준 선례 안내]\n- 본 서식은 법원의 최근 보정 실무준칙에 따라 의뢰인의 경제적 파탄 경위와 불가피성을 소명하여 인가를 득한 검증된 양식입니다.`;
}

/**
 * 관공서 및 공공기관 발급형 서류 마스터 발급 가이드 데이터베이스
 */
export const MASTER_ISSUANCE_GUIDE_DB: Record<string, IssuanceGuideInfo> = {
  '주민등록등본': {
    agencyName: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    agencyPhone: '1588-2188',
    issuanceSteps: [
      '정부24 접속 후 간편인증(카카오/PASS/토스)으로 로그인합니다.',
      '자주 찾는 서비스에서 [주민등록표등본(초본)]을 클릭합니다.',
      '발급형태에서 "선택발급"을 누르고, 과거의 주소 변동사항을 "전체 포함"으로 체크합니다.',
      '세대 구성원 정보에서 본인을 제외한 타인(가족)의 주민번호 뒷자리는 반드시 "미표기(마스킹)"를 선택합니다.',
      '신청하기를 누르고 문서출력 화면에서 [PDF로 저장]을 선택하여 다운로드합니다.'
    ],
    maskingRequired: true,
    validityPeriod: '최근 1개월 이내 발급분 필수',
    tips: '배우자와 세대를 달리하는 경우 배우자의 주민등록등본도 각각 1부 발급받으셔야 합니다.'
  },
  '주민등록초본': {
    agencyName: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    agencyPhone: '1588-2188',
    issuanceSteps: [
      '정부24 접속 후 로그인 ➔ [주민등록표초본]을 선택합니다.',
      '발급대상자: 본인을 선택합니다.',
      '과거의 주소 변동사항: "전체 포함"을 반드시 선택합니다.',
      '개명 이력 및 주민등록번호 변경 내역이 모두 표기되도록 설정 후 발급합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '신청인의 태어나서부터 현재까지의 전체 주소 이력이 모두 나와야 법원 관할 및 주소 소명이 가능합니다.'
  },
  '가족관계증명서': {
    agencyName: '대법원 전자의무기록(전자가족관계등록시스템)',
    agencyUrl: 'https://efamily.scourt.go.kr',
    agencyPhone: '1899-2732',
    issuanceSteps: [
      '전자가족관계등록시스템 접속 후 [가족관계증명서]를 클릭합니다.',
      '증명서 종류에서 반드시 일반이 아닌 "상세증명서"를 선택합니다.',
      '주민등록번호 공개 여부에서 "신청인 본인만 공개", 부모·배우자·자녀는 "비공개(마스킹)"를 선택합니다.',
      '발급 사유를 "법원 제출용"으로 선택 후 발급/PDF 저장합니다.'
    ],
    maskingRequired: true,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '반드시 "상세" 증명서로 발급받아야 하며, 가족들의 주민번호 뒷자리는 꼭 가려져야 합니다.'
  },
  '혼인관계증명서': {
    agencyName: '대법원 전자의무기록(전자가족관계등록시스템)',
    agencyUrl: 'https://efamily.scourt.go.kr',
    agencyPhone: '1899-2732',
    issuanceSteps: [
      '전자가족관계등록시스템 접속 후 [혼인관계증명서]를 선택합니다.',
      '미혼, 기혼, 이혼 여부와 무관하게 모든 신청인이 발급해야 합니다.',
      '증명서 종류는 반드시 "상세증명서"를 선택합니다.',
      '주민번호 뒷자리 마스킹 처리 후 PDF로 다운로드합니다.'
    ],
    maskingRequired: true,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '미혼인 경우에도 "혼인 사실 없음"을 입증하기 위해 법원 필수 제출 서류입니다.'
  },
  '지방세 세목별 과세증명서': {
    agencyName: '위택스(WeTax) / 주민센터',
    agencyUrl: 'https://www.wetax.go.kr',
    agencyPhone: '110',
    issuanceSteps: [
      '위택스 접속 ➔ [납부결과/증명발급] ➔ [세목별 과세증명서] 클릭.',
      '과세구분: "전체 세목", 과세물건지: "전국", 발급기간: "최근 5년"을 설정합니다.',
      '과세 사실이나 재산이 없어 부과 내역이 없더라도 "해당 과세사실 없음"으로 발급받아야 합니다.',
      '본인 및 배우자 명의로 각각 1부씩 발급합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '재산세, 자동차세 납부 내역을 통해 은닉 재산 유무를 법원이 검증하는 핵심 서류입니다.'
  },
  '소득금액증명원': {
    agencyName: '국세청 홈택스 / 손택스',
    agencyUrl: 'https://www.hometax.go.kr',
    agencyPhone: '126',
    issuanceSteps: [
      '국세청 홈택스 접속 ➔ [국세증명·사업자등록·세금관련 신청/신고] ➔ [소득금액증명].',
      '용도: "관공서제출용", 수령방법: "인터넷발급(열람용 또는 출력)" 선택.',
      '과세기간: 최근 3개년도를 선택합니다.',
      '근로소득자용, 종합소득세신고자용, 연말정산한 사업소득자용 중 본인 해당분 발급.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 3년분 발급',
    tips: '소득이 없었던 연도의 경우 홈택스에서 "사실증명(소득이 없다는 사실증명원)"을 발급받으시면 됩니다.'
  },
  '건강보험 자격득실확인서': {
    agencyName: '국민건강보험공단',
    agencyUrl: 'https://www.nhis.or.kr',
    agencyPhone: '1577-1000',
    issuanceSteps: [
      '건보공단 홈페이지 접속 ➔ [자격득실확인서 발급].',
      '조회조건: "전체" (직장가입자, 지역가입자, 피부양자 전체 이력 포함).',
      '프린트 발급 또는 전자증명서 발급 클릭.',
      '전화(1577-1000)로 본인인증 후 로펌 팩스로 직접 전송 요청도 가능합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '과거부터 현재까지의 전체 취업 및 실직 이력을 증명하는 필수 서류입니다.'
  },
  '국민연금 산정용 가입내역확인서': {
    agencyName: '국민연금공단(NPS)',
    agencyUrl: 'https://www.nps.or.kr',
    agencyPhone: '1355',
    issuanceSteps: [
      '국민연금 전자민원서비스 접속 ➔ [가입내역조회] ➔ [산정용 가입내역확인서].',
      '1355 콜센터 전화 상담원 연결을 통해 법률사무소 팩스로 즉시 발송 가능.',
      '과거 직장별 기준소득월액 및 가입기간 전체가 표기되도록 발급.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '법원에서 신청인의 실질 급여 수준을 교차 검증할 때 사용하는 표준 공적 자료입니다.'
  },
  '지적전산자료': {
    agencyName: '스마트국토정보 K-Geo 플랫폼 (내토지찾기)',
    agencyUrl: 'https://www.kgeop.go.kr',
    issuanceSteps: [
      'K-Geo 플랫폼 접속 ➔ [내토지찾기] 서비스 클릭.',
      '본인 인증 후 전국 단위 소유 토지 조회 실행.',
      '소유 토지가 없는 경우에도 "전국 토지 조회 결과: 조회된 내역이 없습니다"라는 화면을 출력하거나 캡처하여 제출합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내',
    tips: '부동산을 소유하지 않았음을 증명하기 위해서도 반드시 "무소유 결과 증명"을 첨부해야 합니다.'
  },
  '계좌정보통합관리': {
    agencyName: '금융결제원 어카운트인포 (payinfo)',
    agencyUrl: 'https://www.payinfo.or.kr',
    issuanceSteps: [
      '어카운트인포 접속 ➔ [계좌정보통합조회].',
      '은행권(1금융), 제2금융권(저축은행/새마을금고/신협), 증권사 전 계좌 목록 조회.',
      '각 계좌별 상세내역(잔고, 개설일, 휴면 여부) 출력/인쇄.',
      '모바일 어카운트인포 앱에서도 PDF 다운로드 가능.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 발급분',
    tips: '잊고 있던 휴면계좌 잔고나 다른 증권계좌가 법원 조사에서 누락되면 은닉 의혹을 받게 되므로 전체 조회가 필수입니다.'
  },
  '보험가입조회서': {
    agencyName: '생명·손해보험협회 (내보험찾기) / 신용정보원 (내보험다보여)',
    agencyUrl: 'https://cont.insure.or.kr',
    issuanceSteps: [
      '내보험찾기(cont.insure.or.kr) 또는 한국신용정보원 내보험다보여 접속.',
      '본인인증 후 가입된 생명보험, 손해보험, 우체국/공제보험 전체 계약 조회.',
      '유지 중인 보험과 실효/해지된 보험 목록 전체를 PDF로 저장.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내',
    tips: '목록에 나온 모든 유지 중인 보험사에 전화하여 "예상 해약환급금확인서"를 별도 발급받아야 합니다.'
  },
  '보험 예상 해약환급금확인서': {
    agencyName: '가입된 각 보험회사 콜센터',
    issuanceSteps: [
      '유지 중인 각 보험회사 콜센터로 전화합니다.',
      '상담원에게 "개인회생 제출용 기준일자 예상 해약환급금확인서 발급"을 요청합니다.',
      '신청인의 이메일로 PDF를 받거나, 법률사무소 팩스번호로 직접 전송 요청합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내 기준',
    tips: '약관대출금이 있는 경우 대출원리금을 차감한 순수 예상환급금 잔액이 표기되어야 합니다.'
  },
  '자동차등록원부': {
    agencyName: '정부24 / 자동차365',
    agencyUrl: 'https://www.car365.go.kr',
    issuanceSteps: [
      '자동차365 또는 정부24 접속 ➔ [자동차등록원부(갑/을) 발급].',
      '기본 소유권이 표시된 "갑부"와 저당권/압류 내역이 표기된 "을부"를 둘 다 발급받습니다.',
      '저당권이 설정되어 있지 않은 경우에도 "을부 발급 내역 없음"을 확인해야 합니다.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내',
    tips: '본인뿐만 아니라 배우자 명의 차량이 있는 경우에도 동일하게 갑/을부를 모두 제출해야 합니다.'
  },
  '121080': {
    agencyName: '현 직장 총무·인사과 / 퇴직연금 운용 금융기관',
    issuanceSteps: [
      '회사 인사/총무과에 "기준일자 기준 퇴직 시 예상 퇴직금 확인서" 발급 요청.',
      '회사 직인(도장) 날인 필수.',
      'DC/DB형 퇴직연금 가입자의 경우 퇴직연금 가입확인서 및 적립금 잔액증명서로 대체 가능.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내',
    tips: '재직 기간 1년 이상인 경우 필수이며, 예상 퇴직금의 1/2이 재산목록 청산가치에 반영됩니다.'
  },
  '121090': {
    agencyName: 'KB부동산시세(kbland.kr) / 국토교통부 실거래가',
    agencyUrl: 'https://kbland.kr',
    issuanceSteps: [
      'KB부동산(kbland.kr) 접속 후 해당 아파트/단지 검색 ➔ [일반평균가] 화면 캡처 또는 출력.',
      'KB시세가 없는 빌라·단독주택: 국토교통부 실거래가 공개시스템 최근 1년 거래내역 캡처.',
      '실거래가도 없는 경우 인근 공인중개사사무소 2곳의 시세확인서 또는 개별공시지가확인서(130% 반영).'
    ],
    maskingRequired: false,
    validityPeriod: '신청일 기준 시세',
    tips: '법원 실무상 아파트는 KB부동산 일반평균가를 1순위 공인 시세로 인정합니다.'
  },
  '121100': {
    agencyName: '보험개발원 차량기준가액(kidi.or.kr) / 엔카·KB차차차',
    agencyUrl: 'https://www.kidi.or.kr',
    issuanceSteps: [
      '보험개발원(kidi.or.kr) 접속 ➔ [차량기준가액] 조회.',
      '차량 연식, 모델명, 배기량을 선택하여 기준가액표 출력.',
      '오토바이의 경우 파쏘(passo) 또는 번개장터 중고 오토바이 평균 매물 시세 2곳 캡처.'
    ],
    maskingRequired: false,
    validityPeriod: '신청일 기준',
    tips: '중고차 딜러 견적서 2곳 또는 엔카 일반 시세표를 첨부하여 차량 감가상각을 방어합니다.'
  },
  '121120': {
    agencyName: '현 직장 급여담당부서 (회계/총무팀)',
    issuanceSteps: [
      '직장 회계팀에 법원 채권압류 및 추심명령에 따라 급여에서 공제되어 회사에 보관 중인 적립금 확인서 요청.',
      '압류 결정 사건번호, 채권자명, 매월 적립된 금액 및 현재 누적 총 적립금 기재.',
      '회사 직인 날인 후 발급.'
    ],
    maskingRequired: false,
    validityPeriod: '최근 1개월 이내',
    tips: '급여 압류 적립금은 개인회생 1회차 변제금으로 일괄 투입하여 채무를 탕감하는 데 사용됩니다.'
  }
};

/**
 * 문서 코드 또는 문서명으로 발급 가이드 조회
 */
export function getIssuanceGuideForDoc(docCodeOrTitle: string): IssuanceGuideInfo | undefined {
  if (!docCodeOrTitle) return undefined;

  // 1. 코드 직접 일치
  if (MASTER_ISSUANCE_GUIDE_DB[docCodeOrTitle]) {
    return MASTER_ISSUANCE_GUIDE_DB[docCodeOrTitle];
  }

  // 2. 제목 키워드 부분 일치
  const keys = Object.keys(MASTER_ISSUANCE_GUIDE_DB);
  for (const key of keys) {
    if (docCodeOrTitle.includes(key) || key.includes(docCodeOrTitle)) {
      return MASTER_ISSUANCE_GUIDE_DB[key];
    }
  }

  // 3. 레지스트리 항목 내부 issuanceGuide 확인
  const registryDoc = ALL_LEGAL_DOC_REGISTRY.find(d => 
    d.docCode === docCodeOrTitle || d.title === docCodeOrTitle
  );
  if (registryDoc?.issuanceGuide) {
    return registryDoc.issuanceGuide;
  }

  return undefined;
}

/**
 * 사건 관할(회생 / 파산 / 공통)별 서류 필터
 */
export function getDocumentsByCaseScope(scope: DocCaseScope): LegalDocItem[] {
  if (scope === 'COMMON') {
    return ALL_LEGAL_DOC_REGISTRY.filter(d => d.caseScope === 'COMMON');
  }
  return ALL_LEGAL_DOC_REGISTRY.filter(d => d.caseScope === scope || d.caseScope === 'COMMON');
}

/**
 * 서류 성격(발급형 vs 자가작성형 vs 변호사법원서식)별 서류 필터
 */
export function getDocumentsByNature(nature: DocTypeNature): LegalDocItem[] {
  return ALL_LEGAL_DOC_REGISTRY.filter(d => {
    if (nature === 'ISSUED_BY_AGENCY') {
      return d.docTypeNature === 'ISSUED_BY_AGENCY' || !!getIssuanceGuideForDoc(d.docCode) || !!getIssuanceGuideForDoc(d.title);
    }
    if (nature === 'SELF_WRITTEN') {
      return d.docTypeNature === 'SELF_WRITTEN' || d.isClientMobileSupport;
    }
    return d.docTypeNature === 'LAWYER_COURT' || (!d.isClientMobileSupport && !getIssuanceGuideForDoc(d.docCode));
  });
}

