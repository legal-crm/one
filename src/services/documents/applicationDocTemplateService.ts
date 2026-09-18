/**
 * 신청서류 마스터 템플릿 관리 서비스 (리걸플로 매뉴얼 20~21p 벤치마킹)
 * - 로펌 관리자가 카테고리별(개인회생 급여/영업, 파산, 보정권고)로 구비서류를 사전 등록/편집
 * - 의뢰인별 맞춤 구비서류 자동 생성 및 모바일 앱/웹 연동
 */

export type DocCategoryKey = 'REHAB_SALARIED' | 'REHAB_BUSINESS' | 'BANKRUPTCY' | 'CORRECTION';
export type DocPhase = 1 | 2; // 1: 착수/등기 1차 서류, 2: 소득/재산/진술서 2차 서류
export type SubmissionMethod = 'POST_MAIL' | 'DIGITAL_UPLOAD' | 'DIRECT_VISIT';

export interface ApplicationDocMasterItem {
  id: string;
  order: number;
  phase: DocPhase;                    // 1차 or 2차
  submissionMethod: SubmissionMethod; // 실물 등기우편 vs 모바일/온라인 업로드
  name: string;
  category: DocCategoryKey;
  agency: string;                     // 발급처 (정부24, 주민센터, 홈택스, 직장 등)
  agencyUrl?: string;                 // 온라인 바로가기 URL
  tips: string;                       // 발급 팁 및 주의사항
  isRequired: boolean;                // 필수 여부
  isThirdPartyMasking?: boolean;      // 제3자 주민번호 뒷자리 마스킹 여부
  isCreditorMultiplier?: boolean;     // 채권자 수에 연동된 (n+5)부 계산 필요 여부
  targetParty?: 'APPLICANT' | 'SPOUSE' | 'BOTH'; // 본인/배우자 대상 여부
  subCategory?: 'GOV' | 'TAX' | 'WORK' | 'FINANCE' | 'PERSONAL';
}

export interface ApplicationCategoryConfig {
  key: DocCategoryKey;
  label: string;
  description: string;
  badge: string;
}

export const APPLICATION_CATEGORIES: ApplicationCategoryConfig[] = [
  { 
    key: 'REHAB_SALARIED', 
    label: '개인회생 (급여소득자)', 
    description: '1차 서류 9종 + 2차 서류 17종 표준 구비서류 26종',
    badge: '💼 급여 표준 26종'
  },
  { 
    key: 'REHAB_BUSINESS', 
    label: '개인회생 (영업소득자)', 
    description: '1차 서류 9종 + 2차 서류 18종 소명 구비서류 27종',
    badge: '🏢 영업 표준 27종'
  },
  { 
    key: 'BANKRUPTCY', 
    label: '개인파산 및 면책', 
    description: '1차 서류 9종 + 2차 서류 16종 표준 구비서류 25종',
    badge: '⚖️ 파산 표준 25종'
  },
  { 
    key: 'CORRECTION', 
    label: '보정권고 대비 보충서류', 
    description: '법원 보정명령 1순위 소명자료 및 금융거래 사용처 12종',
    badge: '📋 보정 12종'
  },
];

/// 초기 표준 기본 데이터셋 (로펌 실무 및 법률사무소 보광 표준 실무 모델 준용)
const DEFAULT_DOC_TEMPLATES: ApplicationDocMasterItem[] = [
  // ── [1차 서류] 개인회생 (급여소득자) - 착수 & 부채증명서 대행 (등기 9종) ──
  {
    id: 'rs-p1-7',
    order: 1,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '인감증명서 (본인발급 2~3부 / 채권사수 + 5부)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '주민센터 방문 발급 (대리 불가)',
    tips: '주민센터 본인 발급 필수. 금융기관 부채증명서 대행 발급 및 법원 전자소송 위임용 (1차 서류 필수).',
    isRequired: true,
    isCreditorMultiplier: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p1-6',
    order: 2,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '인감도장 (실물)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '신청인 보유 (실물 등기 발송)',
    tips: '인감증명서와 동일한 인감도장 필수. 금융기관 부채증명서 대리 발급 위임장 날인 후 안전 반환.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p1-1',
    order: 3,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '주민등록등본 1부 (전체 포함)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    tips: '과거 주소변동사항 전체 포함하여 발급. 배우자와 세대 분리 시 배우자 등본도 필수 발급.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-p1-2',
    order: 4,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '주민등록초본 1부 (과거 주소이력 포함)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    tips: '과거 주소 전체 변동사항, 개명 이력, 주민등록번호 변동사항 포함하여 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p1-3',
    order: 5,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '가족관계증명서 1부 (상세)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '대법원 전자의무기록 / 주민센터',
    agencyUrl: 'https://efamily.scourt.go.kr',
    tips: '반드시 "상세" 증명서로 발급. 신청인 외 가족(부모, 배우자, 자녀) 주민번호 뒷자리는 마스킹(******) 처리 필수.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-p1-4',
    order: 6,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '혼인관계증명서 1부 (상세, 미혼자 포함)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '대법원 전자의무기록 / 주민센터',
    agencyUrl: 'https://efamily.scourt.go.kr',
    tips: '미혼, 기혼, 이혼 여부와 무관하게 모든 신청인이 반드시 "상세" 증명서로 발급.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-p1-5',
    order: 7,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '신분증 사본 (앞/뒤)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '신청인 보유',
    tips: '주민등록증 또는 운전면허증 앞/뒤 선명한 사본 (부채증명서 발급 위임 필수 첨부).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p1-8',
    order: 8,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '지방세 세목별 과세증명서 1부 (최근 5년간)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '위택스 / 주민센터',
    agencyUrl: 'https://www.wetax.go.kr',
    tips: '전국 / 전체 세목으로 발급 (본인 및 배우자). 재산/차량이 없어 납세 사실이 없는 경우 "납세사실 없음"으로 기재 요청.',
    isRequired: true,
    targetParty: 'BOTH',
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p1-9',
    order: 9,
    phase: 1,
    submissionMethod: 'POST_MAIL',
    name: '자동차등록원부 갑/을부 (차량 소유 시)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '정부24 / 자동차365',
    agencyUrl: 'https://www.car365.go.kr',
    tips: '본인 및 배우자 명의 차량 보유 시 필수 (갑부 및 저당권 설정 내역이 있는 을부 모두 발급).',
    isRequired: false,
    targetParty: 'BOTH',
    isThirdPartyMasking: false
  },

  // ── [2차 서류] 개인회생 (급여소득자) - 소득·재산·진술서 (디지털 17종) ──
  {
    id: 'rs-p2-1',
    order: 10,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '주거래 통장 거래내역 (최근 1년분)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '각 은행 인터넷뱅킹 / 모바일앱',
    tips: '급여, 생활비 등 주거래 통장의 최근 1년 입출금 거래내역 (엑셀 또는 PDF 다운로드).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-2',
    order: 11,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '생명보험협회 보험가입 확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '생명·손해보험협회 (내보험찾기 / 내보험다보여)',
    agencyUrl: 'https://cont.insure.or.kr',
    tips: '내보험찾기 접속 후 가입된 보험 전체 목록 조회 결과서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-3',
    order: 12,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '보험 예상 해약환급금 확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '해당 보험사 콜센터 통화 후 팩스/파일 발급',
    tips: '유지 중인 모든 보험의 기준일자 해약환급금 확인서 (콜센터에 팩스 또는 이메일 요청).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-4',
    order: 13,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '건강보험 자격득실확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '국민건강보험공단 (1577-1000)',
    agencyUrl: 'https://www.nhis.or.kr',
    tips: '전체 이력 포함 발급 (1577-1000 전화 후 사무소 팩스 발급 요청 가능).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-5',
    order: 14,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '국민연금 산정용 가입내역확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '국민연금공단 (1355)',
    agencyUrl: 'https://www.nps.or.kr',
    tips: '1355 전화 후 팩스 발급 요청 또는 공단 홈페이지 전자민원 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-6',
    order: 15,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '지적전산자료 조회 결과 (내토지찾기)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '스마트국토정보 / K-Geo 플랫폼',
    agencyUrl: 'https://www.kgeop.go.kr',
    tips: '스마트국토정보 접속 후 "내토지찾기" 조회 (소유 부동산이 없는 경우에도 "무소유 증명" 필수).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-7',
    order: 16,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '계좌정보통합관리(어카운트인포) 결과',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '금융결제원 계좌정보통합관리서비스(payinfo)',
    agencyUrl: 'https://www.payinfo.or.kr',
    tips: '1금융권, 2금융권, 증권사 전 계좌목록 및 상세조회 결과 (휴면계좌 포함).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-8',
    order: 17,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '개인회생 진술서 (채무증대 경위)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '신청인 직접 작성',
    tips: '제공해 드리는 표준 샘플 양식을 참고하여 채무 발생 원인 및 현재 생활상황 솔직히 기재.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-9',
    order: 18,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '변제금 입출금용 통장사본 (앞면)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '신청인 보유 은행 통장',
    tips: '압류되지 않은 1금융권 통장 앞면 사본 (추후 법원 변제금 전용 계좌).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-10',
    order: 19,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '주거지 임대차계약서 (확정일자부)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '보관 서류 / 주민센터 확정일자 부여현황',
    tips: '월세/전세 거주자 필수. 무상 거주 시 "무상거주사실확인서"로 대체 제출.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-11',
    order: 20,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '무상거주확인서 (무상거주 시 해당)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '임대인 또는 소유자 작성',
    tips: '부모님, 친척, 지인 명의 주택에 무상으로 거주하는 경우에만 작성하여 제출.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-12',
    order: 21,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '부동산 등기사항 전부증명서 (자가/토지)',
    category: 'REHAB_SALARIED',
    subCategory: 'PERSONAL',
    agency: '인터넷등기소 / 등기국',
    agencyUrl: 'http://www.iros.go.kr',
    tips: '본인 또는 배우자 명의 주택, 아파트, 토지 보유 시 필수 발급.',
    isRequired: false,
    targetParty: 'BOTH',
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-13',
    order: 22,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '재직증명서 (직인 날인)',
    category: 'REHAB_SALARIED',
    subCategory: 'WORK',
    agency: '현 직장 인사과',
    tips: '회사 직인 날인 필수 (입사일자, 근무 부서, 직위 명시).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-14',
    order: 23,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '근로계약서 (재직 3개월 미만 시 필수)',
    category: 'REHAB_SALARIED',
    subCategory: 'WORK',
    agency: '현 직장 / 본인 보관',
    tips: '이직 또는 신규 입사로 재직 3개월 미만인 경우 급여 산정 위해 반드시 필요.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-15',
    order: 24,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '급여명세서 (최근 6개월분)',
    category: 'REHAB_SALARIED',
    subCategory: 'WORK',
    agency: '현 직장',
    tips: '최근 6개월 상세 급여명세서 (기본급, 수당, 공제내역 명시).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-16',
    order: 25,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '예상퇴직금 확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'WORK',
    agency: '현 직장 / 퇴직연금 운용사',
    tips: '재직 1년 이상자 필수 (예상 퇴직금의 1/2이 청산가치에 반영됨).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-17',
    order: 26,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '근로소득 원천징수영수증 (최근 1년)',
    category: 'REHAB_SALARIED',
    subCategory: 'TAX',
    agency: '홈택스 / 현 직장',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '1년 이상 재직자 해당 (이직한 경우 전 직장 원천징수 포함).',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── [영업소득자 2차 서류군] ──
  {
    id: 'rb-p2-1',
    order: 27,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '사업자등록증명원 (또는 폐업사실증명)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '현재 개인사업 영위자 또는 과거 5년 내 폐업 이력자 필수.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-2',
    order: 28,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '부가가치세 과세표준증명원 (최근 3년)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '면세사업자의 경우 "부가가치세 면세사업자 수입금액증명원" 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-3',
    order: 29,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '종합소득세 과세표준 확정신고서 (최근 2년)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '종합소득세 신고서 부속서류(손익계산서, 수입금액명세서) 포함하여 출력.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-4',
    order: 30,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '사업장 임대차계약서 및 사업장 비품 목록',
    category: 'REHAB_BUSINESS',
    subCategory: 'PERSONAL',
    agency: '보관 서류 / 사업장 현장',
    tips: '임차보증금(청산가치 반영) 및 월차임(필요경비 공제) 소명자료.',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── [파산 전용 2차 서류군] ──
  {
    id: 'bp-p2-1',
    order: 31,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '최근 3년 전 금융기관 입출금거래내역 (상세)',
    category: 'BANKRUPTCY',
    subCategory: 'FINANCE',
    agency: '각 은행 인터넷뱅킹',
    tips: '파산관재인 편파변제 및 재산은닉 검증 대비 최근 3년 이상 입출금 거래내역 전체.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'bp-p2-2',
    order: 32,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '지급불능 소명자료 (진단서/폐업사실/실직증명)',
    category: 'BANKRUPTCY',
    subCategory: 'PERSONAL',
    agency: '병원, 주민센터, 세무서 등',
    tips: '고령, 중증 질환, 장애, 장기 실직 등 지속적 근로소득 창출 불가 사유 입증 서류.',
    isRequired: true,
    isThirdPartyMasking: false
  },

  // ── [보정권고 대비 서류군] ──
  {
    id: 'cor-1',
    order: 33,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '100만원 이상 출금/이체금액 사용처 소명표',
    category: 'CORRECTION',
    subCategory: 'FINANCE',
    agency: '자체 양식 작성 + 영수증',
    tips: '최근 1~2년 내 고액 출금/계좌이체에 대한 사용처(생활비, 병원비, 채무변제 등) 영수증 및 소명표.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'cor-2',
    order: 34,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '주식·코인 등 가상자산 투자금 거래내역서',
    category: 'CORRECTION',
    subCategory: 'FINANCE',
    agency: '가상자산거래소 / 증권사',
    tips: '업비트, 빗썸 등 원화 입출금 내역 및 총 손실금액 증빙 (법원 준칙에 따른 청산가치 반영 방어용).',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── [신규 확장 구비서류군: 특수 상황, 상세 소명 및 시가 평가 증빙] ──
  {
    id: 'rs-p2-18',
    order: 35,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '건강보험료 납부확인서 (최근 1~2년분)',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '국민건강보험공단 (1577-1000)',
    agencyUrl: 'https://www.nhis.or.kr',
    tips: '건보공단 홈페이지 또는 전화(1577-1000) 팩스 신청. 급여 실수령액 및 체납 여부 교차 소명.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-19',
    order: 36,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '소득금액증명원 (최근 3년분, 국세청 홈택스)',
    category: 'REHAB_SALARIED',
    subCategory: 'TAX',
    agency: '국세청 홈택스 / 세무서',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 3개년도 발급. 소득이 없었던 기간은 "사실증명(신고사실없음)" 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-5',
    order: 37,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '소득금액증명원 (영업소득자용 최근 3년)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '종합소득세 신고 기준 최근 3년 소득금액증명원 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-6',
    order: 38,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '국세 및 지방세 납세증명서·체납사실증명서',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '홈택스 / 위택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '조세채권은 우선권 있는 개인회생채권으로 분류되므로 체납액 확인 필수.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-7',
    order: 39,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '표준재무제표증명 (최근 3개년도)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '복식부기의무자 또는 법인사업자 필수 (대차대조표, 손익계산서 포함).',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-8',
    order: 40,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '사업장 매출장부 및 매출통장 거래내역 (최근 1년)',
    category: 'REHAB_BUSINESS',
    subCategory: 'FINANCE',
    agency: '사업장 포스기 / 매출통장 은행',
    tips: '최근 1년간의 POS 매출 집계표 또는 사업용 계좌 거래내역서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-p2-9',
    order: 41,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '사업장 필요경비 증빙자료 (공과금, 매입세금계산서)',
    category: 'REHAB_BUSINESS',
    subCategory: 'TAX',
    agency: '홈택스 / 관리비 영수증',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '월세 이체확인증, 전기/가스/통신비 영수증, 매입세금계산서 등 필요경비 공제 소명자료.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-20',
    order: 42,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '기초생활수급자 / 장애인 / 연금수급 증명서',
    category: 'REHAB_SALARIED',
    subCategory: 'GOV',
    agency: '정부24 / 국민연금공단 / 주민센터',
    agencyUrl: 'https://www.gov.kr',
    tips: '취약계층 소명 시 법원 생계비 특례 및 변제율 완화 적용 가능.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-21',
    order: 43,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '부동산 시가 확인자료 (KB시세/실거래가/공인중개사)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: 'KB부동산 / 국토부 실거래가 / 인근 중개업소',
    agencyUrl: 'https://kbland.kr',
    tips: 'KB부동산 일반평균가 캡처본(아파트) 또는 국토부 실거래가, 인근 공인중개사 2곳 시세확인서.',
    isRequired: false,
    targetParty: 'BOTH',
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-22',
    order: 44,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '자동차 시가 확인자료 (기준가액/중고차 2곳)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '보험개발원 / 엔카 / KB차차차',
    agencyUrl: 'https://www.kidi.or.kr',
    tips: '보험개발원 차량기준가액표 출력본 및 엔카/KB차차차 중고차 시세표 2곳.',
    isRequired: false,
    targetParty: 'BOTH',
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-23',
    order: 45,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '대여금·미수금 등 채권 증빙 (차용증/이체증)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '보관 서류 / 은행 이체확인증',
    tips: '타인에게 빌려준 돈이나 미수금이 있는 경우 차용증, 판결문 및 회수불능 사유서 첨부.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-24',
    order: 46,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '최근 1년 이내 1,000만원 이상 재산 처분대금 소명서',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '매매계약서 / 계좌 입금증명 / 사용처 소명표',
    tips: '부동산, 차량, 전세금 처분 대금의 담보 상환 후 잔여금 사용처(은닉/편파변제 방어).',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-25',
    order: 47,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '개인채권자 부채 증빙자료 (차용증/이체증/인적사항)',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '보관 차용증 / 계좌이체증 / 채권자 주민등록초본',
    tips: '지인/개인 사채 채권자의 성명, 주민번호, 주소, 연락처 및 송금내역서 필수.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-26',
    order: 48,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '사적 채무조정(신용회복위원회) 신용상담보고서/실효확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '신용회복위원회 (cyber.ccrs.or.kr)',
    agencyUrl: 'https://cyber.ccrs.or.kr',
    tips: '신용회복위원회 협약 가입 이력자 필수. 신용상담보고서 또는 채무조정 실효확인서 발급.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-p2-27',
    order: 49,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '강제집행·압류결정문 및 압류적립금 확인서',
    category: 'REHAB_SALARIED',
    subCategory: 'FINANCE',
    agency: '송달 결정문 / 직장 총무팀 적립금 증명',
    tips: '법원 채권압류및추심명령 결정문(타채 사건번호) 및 직장 급여 압류적립금 잔액 확인서.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'cor-3',
    order: 50,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '최근 2년 내 이혼 재산분할 소명자료 및 양육비부담조서',
    category: 'CORRECTION',
    subCategory: 'PERSONAL',
    agency: '가정법원 / 주민센터',
    tips: '이혼판결문, 조정조서, 협의이혼의사확인서, 재산분할협의서(위장이혼 방어 필수).',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'cor-4',
    order: 51,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '과거 10년 이내 회생·파산 결정문 및 변제수행 납입증명원',
    category: 'CORRECTION',
    subCategory: 'PERSONAL',
    agency: '대법원 나의사건검색 / 관할 법원',
    tips: '종전 사건 개시/인가/폐지/면책결정문 및 법원 변제금 전액 납입 증명원.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'cor-5',
    order: 52,
    phase: 2,
    submissionMethod: 'DIGITAL_UPLOAD',
    name: '추가 생계비(주거비/의료비/교육비) 인정 신청 소명자료',
    category: 'CORRECTION',
    subCategory: 'PERSONAL',
    agency: '임대차계약서·월세이체증 / 병원 진단서 및 진료비영수증',
    tips: '기준중위소득 60% 외에 불가피한 고액 월세, 중증질환 정기 병원비, 특수교육비 실비 소명.',
    isRequired: false,
    isThirdPartyMasking: false
  },
];

const STORAGE_KEY = 'LEGAL_CRM_APPLICATION_DOC_MASTER_TEMPLATES_V3';

/**
 * 서류 목록 정렬 우선순위 비교기
 * 1순위: 인감증명서 (부채증명서 발급 핵심 필수 서류 -> 최상단)
 * 2순위: 인감도장 (인감증명서 직후 최상단)
 * 3순위: 1차 서류군 (주민등록등본, 초본 등 기본 서류)
 * 4순위: 2차 서류군 (소득, 재산, 진술서 등)
 */
export function compareDocItemsPriority<T extends { name: string; phase?: number; order?: number }>(a: T, b: T): number {
  const isASealCert = a.name.includes('인감증명서');
  const isBSealCert = b.name.includes('인감증명서');
  if (isASealCert && !isBSealCert) return -1;
  if (!isASealCert && isBSealCert) return 1;

  const isASealStamp = a.name.includes('인감도장');
  const isBSealStamp = b.name.includes('인감도장');
  if (isASealStamp && !isBSealStamp) return -1;
  if (!isASealStamp && isBSealStamp) return 1;

  const isASealAny = a.name.includes('인감');
  const isBSealAny = b.name.includes('인감');
  if (isASealAny && !isBSealAny) return -1;
  if (!isASealAny && isBSealAny) return 1;

  const phaseA = a.phase || 1;
  const phaseB = b.phase || 1;
  if (phaseA !== phaseB) {
    return phaseA - phaseB;
  }

  return (a.order || 0) - (b.order || 0);
}

export class ApplicationDocTemplateService {
  /**
   * 서류 항목 정규화 (인감증명서는 부채증명서 발급 필수 서류이므로 무조건 1차 서류 보장)
   */
  static normalizeItem(item: ApplicationDocMasterItem): ApplicationDocMasterItem {
    const isSealDoc = item.name.includes('인감');
    const phase: DocPhase = isSealDoc ? 1 : (item.phase || (item.order <= 9 ? 1 : 2));
    const isRequired = isSealDoc ? true : item.isRequired;
    const submissionMethod: SubmissionMethod = phase === 1 ? 'POST_MAIL' : (item.submissionMethod || 'DIGITAL_UPLOAD');

    return {
      ...item,
      phase,
      isRequired,
      submissionMethod,
    };
  }

  /**
   * 저장소에서 전체 템플릿 목록 로드 (없으면 기본값 초기화 및 지능형 마이그레이션)
   */
  static getTemplates(): ApplicationDocMasterItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || 
                  localStorage.getItem('LEGAL_CRM_APPLICATION_DOC_MASTER_TEMPLATES_V2') || 
                  localStorage.getItem('LEGAL_CRM_APPLICATION_DOC_MASTER_TEMPLATES_V1');
      if (!raw) {
        this.resetToDefaults();
        return DEFAULT_DOC_TEMPLATES.slice().sort(compareDocItemsPriority);
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let hasChanges = false;
        const normalizedList = parsed.map(item => {
          const normalized = this.normalizeItem(item);
          if (normalized.phase !== item.phase || normalized.isRequired !== item.isRequired) {
            hasChanges = true;
          }
          return normalized;
        });

        // V3 마스터 서류 지능형 머지: 기본 템플릿 중 누락된 신규 항목 자동 병합
        const existingIds = new Set(normalizedList.map(i => i.id));
        DEFAULT_DOC_TEMPLATES.forEach(defItem => {
          if (!existingIds.has(defItem.id)) {
            normalizedList.push(defItem);
            hasChanges = true;
          }
        });

        // 인감증명서 최상단 우선순위 정렬
        normalizedList.sort(compareDocItemsPriority);

        // 변경된 사항이 있거나 V3 승격 시 로컬스토리지 자동 갱신
        if (hasChanges || !localStorage.getItem(STORAGE_KEY)) {
          this.saveTemplates(normalizedList);
        }

        return normalizedList;
      }
      return DEFAULT_DOC_TEMPLATES.slice().sort(compareDocItemsPriority);
    } catch {
      return DEFAULT_DOC_TEMPLATES.slice().sort(compareDocItemsPriority);
    }
  }

  /**
   * 특정 카테고리의 템플릿 목록 로드
   */
  static getTemplatesByCategory(category: DocCategoryKey): ApplicationDocMasterItem[] {
    const list = this.getTemplates();
    return list
      .filter(item => item.category === category)
      .sort(compareDocItemsPriority);
  }

  /**
   * 인감증명서 부수 계산기 (실무 표준: 채권사 수 + 5부)
   */
  static getRequiredSealCertCount(creditorCount: number): number {
    const safeCount = Math.max(1, Number(creditorCount) || 1);
    return safeCount + 5;
  }

  /**
   * 새 서류 템플릿 추가
   */
  static addTemplate(item: Omit<ApplicationDocMasterItem, 'id' | 'order'>): ApplicationDocMasterItem {
    const list = this.getTemplates();
    const sameCat = list.filter(i => i.category === item.category);
    const maxOrder = sameCat.reduce((max, i) => Math.max(max, i.order), 0);

    const isSealDoc = item.name.includes('인감');
    const phase: DocPhase = isSealDoc ? 1 : (item.phase || 2);

    const newItem: ApplicationDocMasterItem = {
      ...item,
      id: `doc-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order: maxOrder + 1,
      phase,
      isRequired: isSealDoc ? true : item.isRequired,
      submissionMethod: item.submissionMethod || (phase === 1 ? 'POST_MAIL' : 'DIGITAL_UPLOAD'),
    };

    list.push(newItem);
    this.saveTemplates(list);
    return newItem;
  }

  /**
   * 서류 템플릿 수정
   */
  static updateTemplate(id: string, updates: Partial<ApplicationDocMasterItem>): boolean {
    const list = this.getTemplates();
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return false;

    const merged = { ...list[idx], ...updates };
    list[idx] = this.normalizeItem(merged);
    this.saveTemplates(list);
    return true;
  }

  /**
   * 서류 템플릿 삭제
   */
  static deleteTemplate(id: string): boolean {
    const list = this.getTemplates();
    const filtered = list.filter(i => i.id !== id);
    if (filtered.length === list.length) return false;

    this.saveTemplates(filtered);
    return true;
  }

  /**
   * 순서 변경 (위 / 아래)
   */
  static moveTemplateOrder(id: string, direction: 'UP' | 'DOWN'): boolean {
    const list = this.getTemplates();
    const target = list.find(i => i.id === id);
    if (!target) return false;

    const sameCat = list
      .filter(i => i.category === target.category)
      .sort((a, b) => a.order - b.order);
    
    const currIdx = sameCat.findIndex(i => i.id === id);
    if (currIdx === -1) return false;

    const swapIdx = direction === 'UP' ? currIdx - 1 : currIdx + 1;
    if (swapIdx < 0 || swapIdx >= sameCat.length) return false;

    const tempOrder = sameCat[currIdx].order;
    sameCat[currIdx].order = sameCat[swapIdx].order;
    sameCat[swapIdx].order = tempOrder;

    this.saveTemplates(list);
    return true;
  }

  /**
   * 기본 표준 템플릿으로 초기화
   */
  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DOC_TEMPLATES));
  }

  /**
   * 의뢰인 사건 정보(소득, 회생/파산)에 부합하는 권장 서류 목록 반환 (인감증명서 최상단 보장)
   */
  static getRecommendedDocsForClient(clientRequest: any): ApplicationDocMasterItem[] {
    const isBankruptcy = clientRequest?.caseType === 'bankruptcy' || clientRequest?.targetSolution === '파산면책';
    const isBusiness = clientRequest?.jobType === '사업자' || clientRequest?.isBusiness || clientRequest?.incomeType === '사업소득';

    // 공통 1차 서류 (인감증명서 최상단 보장)
    const phase1Docs = this.getTemplatesByCategory('REHAB_SALARIED').filter(d => d.phase === 1);

    if (isBankruptcy) {
      // 파산: 1차 서류 + 파산 전용 2차 서류
      const bpPhase2 = this.getTemplatesByCategory('BANKRUPTCY');
      const commonPhase2 = this.getTemplatesByCategory('REHAB_SALARIED').filter(d => 
        d.phase === 2 && ['rs-p2-1', 'rs-p2-2', 'rs-p2-3', 'rs-p2-6', 'rs-p2-7', 'rs-p2-8', 'rs-p2-10'].includes(d.id)
      );
      return [...phase1Docs, ...commonPhase2, ...bpPhase2]
        .sort(compareDocItemsPriority)
        .map((d, idx) => ({ ...d, order: idx + 1 }));
    }

    if (isBusiness) {
      // 영업소득자: 1차 서류 + 일반 급여제외 2차 + 사업자 전용 2차
      const salariedPhase2 = this.getTemplatesByCategory('REHAB_SALARIED').filter(d => 
        d.phase === 2 && !['rs-p2-13', 'rs-p2-14', 'rs-p2-15', 'rs-p2-16'].includes(d.id)
      );
      const businessDocs = this.getTemplatesByCategory('REHAB_BUSINESS');
      return [...phase1Docs, ...salariedPhase2, ...businessDocs]
        .sort(compareDocItemsPriority)
        .map((d, idx) => ({ ...d, order: idx + 1 }));
    }

    // 기본: 급여소득자 (인감증명서 최상단 정렬)
    return this.getTemplatesByCategory('REHAB_SALARIED').sort(compareDocItemsPriority);
  }

  /**
   * 1차 서류 또는 2차 서류만 필터링하여 반환
   */
  static getRecommendedDocsByPhase(clientRequest: any, phase: DocPhase): ApplicationDocMasterItem[] {
    const all = this.getRecommendedDocsForClient(clientRequest);
    return all.filter(d => (d.phase || 1) === phase);
  }

  private static saveTemplates(list: ApplicationDocMasterItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}
