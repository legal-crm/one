/**
 * 신청서류 마스터 템플릿 관리 서비스 (리걸플로 매뉴얼 20~21p 벤치마킹)
 * - 로펌 관리자가 카테고리별(개인회생 급여/영업, 파산, 보정권고)로 구비서류를 사전 등록/편집
 * - 의뢰인별 맞춤 구비서류 자동 생성 및 모바일 앱/웹 연동
 */

export type DocCategoryKey = 'REHAB_SALARIED' | 'REHAB_BUSINESS' | 'BANKRUPTCY' | 'CORRECTION';

export interface ApplicationDocMasterItem {
  id: string;
  order: number;
  name: string;
  category: DocCategoryKey;
  agency: string;             // 발급처 (정부24, 주민센터, 홈택스, 위택스, 직장, 대법원 등)
  agencyUrl?: string;         // 온라인 바로가기 URL
  tips: string;               // 발급 팁 및 주의사항
  isRequired: boolean;        // 필수 여부
  isThirdPartyMasking?: boolean; // 제3자 주민번호 뒷자리 마스킹 여부
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
    description: '직장인, 아르바이트, 일용직 등 근로소득자 표준 구비서류 22종',
    badge: '💼 급여 22종'
  },
  { 
    key: 'REHAB_BUSINESS', 
    label: '개인회생 (영업소득자)', 
    description: '개인사업자, 프리랜서, 자영업자 매출·부가세 소명 중심 24종',
    badge: '🏢 영업 24종'
  },
  { 
    key: 'BANKRUPTCY', 
    label: '개인파산 및 면책', 
    description: '파산관재인 청산가치 및 면책불허가 방어 서류 20종',
    badge: '⚖️ 파산 20종'
  },
  { 
    key: 'CORRECTION', 
    label: '보정권고 대비 보충서류', 
    description: '법원 보정명령 1순위 소명자료 및 금융거래 사용처 12종',
    badge: '📋 보정 12종'
  },
];

// 초기 표준 기본 데이터셋 (리걸플로 및 신우법무사 표준 실무 모델 준용)
const DEFAULT_DOC_TEMPLATES: ApplicationDocMasterItem[] = [
  // ── 1. 개인회생 (급여소득자) 22종 ──
  {
    id: 'rs-1',
    order: 1,
    name: '주민등록등본',
    category: 'REHAB_SALARIED',
    agency: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    tips: '과거 주소변동사항 전체 포함하여 발급. 배우자와 세대 분리 시 배우자 등본도 필수 발급.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-2',
    order: 2,
    name: '주민등록초본',
    category: 'REHAB_SALARIED',
    agency: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr/portal/main/nologin',
    tips: '과거 주소 전체 변동사항, 개명 이력, 주민등록번호 변동사항 포함하여 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-3',
    order: 3,
    name: '가족관계증명서(상세)',
    category: 'REHAB_SALARIED',
    agency: '대법원 전자의무기록 / 주민센터',
    agencyUrl: 'https://efamily.scourt.go.kr',
    tips: '반드시 "상세" 증명서로 발급. 신청인 외 가족(부모, 배우자, 자녀) 주민번호 뒷자리는 마스킹(******) 처리 필수.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-4',
    order: 4,
    name: '혼인관계증명서(상세)',
    category: 'REHAB_SALARIED',
    agency: '대법원 전자의무기록 / 주민센터',
    agencyUrl: 'https://efamily.scourt.go.kr',
    tips: '미혼, 기혼, 이혼 여부와 무관하게 모든 신청인이 반드시 "상세" 증명서로 발급.',
    isRequired: true,
    isThirdPartyMasking: true
  },
  {
    id: 'rs-5',
    order: 5,
    name: '지방세 세목별 과세증명서',
    category: 'REHAB_SALARIED',
    agency: '위택스 / 주민센터',
    agencyUrl: 'https://www.wetax.go.kr',
    tips: '최근 5년 동안, 전국 단위, 과세사실 없는 세목까지 "모든 세목 표시"하여 발급.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-6',
    order: 6,
    name: '지적전산자료조회결과서 (K-Geo)',
    category: 'REHAB_SALARIED',
    agency: '국가공간정보포털(K-Geo) / 구청',
    agencyUrl: 'https://www.kgeop.go.kr',
    tips: '전국 단위 본인 명의 토지 소유 현황 (소유 토지 없는 경우에도 "무소유 증명" 발급 필수).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-7',
    order: 7,
    name: '자동차등록원부 (갑, 을)',
    category: 'REHAB_SALARIED',
    agency: '정부24 / 자동차365',
    agencyUrl: 'https://www.car365.go.kr',
    tips: '본인 명의 차량 보유 시 필수 (갑부, 저당권 설정 내역이 있는 을부 모두 발급).',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-8',
    order: 8,
    name: '건강보험 자격득실확인서',
    category: 'REHAB_SALARIED',
    agency: '국민건강보험공단',
    agencyUrl: 'https://www.nhis.or.kr',
    tips: '전체 이력 포함 발급 (현재 직장 재직 여부 및 과거 근무 이력 소명).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-9',
    order: 9,
    name: '건강보험료 납부확인서',
    category: 'REHAB_SALARIED',
    agency: '국민건강보험공단',
    agencyUrl: 'https://www.nhis.or.kr',
    tips: '최근 1~2년 납부내역 발급 (실제 급여 수준 및 체납 여부 확인용).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-10',
    order: 10,
    name: '근로소득세 원천징수영수증',
    category: 'REHAB_SALARIED',
    agency: '홈택스 / 현 직장',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 1~2년도 해당분 (이직한 경우 전 직장 원천징수 포함).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-11',
    order: 11,
    name: '소득금액증명원',
    category: 'REHAB_SALARIED',
    agency: '국세청 홈택스 / 정부24',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 3년분 발급 (근로소득자용 또는 종합소득세용).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-12',
    order: 12,
    name: '재직증명서',
    category: 'REHAB_SALARIED',
    agency: '현 직장 인사과',
    tips: '직인 날인 필수 (입사일자, 근무 부서, 직급 명시).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-13',
    order: 13,
    name: '최근 1년 급여명세서',
    category: 'REHAB_SALARIED',
    agency: '현 직장',
    tips: '최근 12개월분 급여 상세명세서 (신규 입사자는 최근 입사 이래 전 기간).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-14',
    order: 14,
    name: '예상퇴직금확인서 (또는 퇴직연금)',
    category: 'REHAB_SALARIED',
    agency: '현 직장 / 퇴직연금 운용 금융사',
    tips: '재직 1년 이상자 필수 (예상 퇴직금의 1/2이 청산가치에 반영됨).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-15',
    order: 15,
    name: '금융결제원 어카운트인포 계좌통합목록',
    category: 'REHAB_SALARIED',
    agency: '금융결제원 계좌정보통합관리서비스',
    agencyUrl: 'https://www.payinfo.or.kr',
    tips: '1금융권, 2금융권, 증권사 전 계좌목록 및 상세조회 결과서 (휴면계좌 포함).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-16',
    order: 16,
    name: '최근 1년 모든 계좌 거래내역서',
    category: 'REHAB_SALARIED',
    agency: '각 은행 인터넷뱅킹',
    tips: '주거래, 급여, 비상금 등 보유한 모든 계좌의 최근 1년 입출금 거래내역 (엑셀 또는 PDF).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-17',
    order: 17,
    name: '보험가입조회서 및 예상 해약환급금확인서',
    category: 'REHAB_SALARIED',
    agency: '한국신용정보원(내보험다보여) / 각 보험사',
    agencyUrl: 'https://www.credit4u.or.kr',
    tips: '내보험다보여 조회서 + 유지 중인 모든 보험의 기준일자 해약환급금 확인서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-18',
    order: 18,
    name: '주거지 임대차계약서 (확정일자부)',
    category: 'REHAB_SALARIED',
    agency: '보관 서류 / 주민센터 확정일자 부여현황',
    tips: '월세/전세 거주자 필수. 무상 거주 시 "무상거주사실확인서"로 대체.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-19',
    order: 19,
    name: '국세 납세증명서 및 체납사실증명서',
    category: 'REHAB_SALARIED',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '국세 체납 여부 확인 (체납세액은 100% 우선변제 채권으로 목록화).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-20',
    order: 20,
    name: '최근 1년 신용카드 이용대금명세서',
    category: 'REHAB_SALARIED',
    agency: '각 카드사 홈페이지',
    tips: '보유 중인 신용카드별 최근 1년 결제 상세내역 (채무 증대 경위 소명자료).',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-21',
    order: 21,
    name: '금융기관 부채증명서',
    category: 'REHAB_SALARIED',
    agency: '각 채권 금융기관 (사무소 대행 가능)',
    tips: '원금, 이자, 연체이자, 담보 설정 여부가 명시된 법원 제출용 부채증명서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rs-22',
    order: 22,
    name: '인감증명서 (본인발급 2~3부)',
    category: 'REHAB_SALARIED',
    agency: '주민센터 방문 (대리 불가)',
    tips: '부채증명서 대행 발급 및 법원 전자소송 위임용 (본인 서명 사실확인서 대체 가능).',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── 2. 개인회생 (영업소득자) 추가 서류군 ──
  {
    id: 'rb-1',
    order: 1,
    name: '사업자등록증명원 (또는 폐업사실증명)',
    category: 'REHAB_BUSINESS',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '현재 사업자등록 상태 또는 과거 5년 내 폐업 사실 증명.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-2',
    order: 2,
    name: '부가가치세 과세표준증명원',
    category: 'REHAB_BUSINESS',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 3년분 (면세사업자는 부가가치세 면세사업자 수입금액증명원).',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-3',
    order: 3,
    name: '종합소득세 확정신고서 및 납부영수증',
    category: 'REHAB_BUSINESS',
    agency: '국세청 홈택스 / 세무사',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 2~3개 연도 종합소득세 신고 첨부서류 일체.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-4',
    order: 4,
    name: '사업장 임대차계약서 및 공과금 영수증',
    category: 'REHAB_BUSINESS',
    agency: '보관 서류',
    tips: '사업장 임대료, 관리비, 전기세, 가스비 등 필요경비 지출 소명자료.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-5',
    order: 5,
    name: '사업용 매출·매입 통장 최근 1년 거래내역',
    category: 'REHAB_BUSINESS',
    agency: '각 은행 인터넷뱅킹',
    tips: '카드매출 입금 및 자재 매입 통장 1년 입출금 거래내역서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'rb-6',
    order: 6,
    name: '매출처별/매입처별 세금계산서합계표',
    category: 'REHAB_BUSINESS',
    agency: '국세청 홈택스',
    agencyUrl: 'https://www.hometax.go.kr',
    tips: '최근 1년 전자세금계산서 발행 및 수취 합계표.',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── 3. 개인파산 및 면책 ──
  {
    id: 'bp-1',
    order: 1,
    name: '생계곤란 및 근로능력 상실 소명서 (진단서/장애인증명)',
    category: 'BANKRUPTCY',
    agency: '종합병원 / 주민센터',
    tips: '파산 신청의 정당성을 소명하기 위한 6개월 이상 치료 요하는 진단서 또는 장애인증명서.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'bp-2',
    order: 2,
    name: '과거 5년 전체 통장 거래내역서',
    category: 'BANKRUPTCY',
    agency: '각 은행 방문 또는 인터넷뱅킹',
    tips: '파산관재인의 부인권 행사 및 재산 은닉 조사 대응을 위한 5개년 금융거래내역.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'bp-3',
    order: 3,
    name: '국민기초생활수급자 증명서',
    category: 'BANKRUPTCY',
    agency: '정부24 / 주민센터',
    agencyUrl: 'https://www.gov.kr',
    tips: '생계급여, 의료급여, 주거급여 수급권자인 경우 송달료 등 소송구조 신청 가능.',
    isRequired: false,
    isThirdPartyMasking: false
  },

  // ── 4. 보정권고 대비 서류 ──
  {
    id: 'cr-1',
    order: 1,
    name: '최근 1년 대출금 사용처 소명표 및 영수증',
    category: 'CORRECTION',
    agency: '자체 작성 / 금융거래 증빙',
    tips: '최근 1년 이내 발생한 채무의 인출금 사용처(기존 채무 대환, 생활비, 병원비 등) 소명.',
    isRequired: true,
    isThirdPartyMasking: false
  },
  {
    id: 'cr-2',
    order: 2,
    name: '배우자 재산형성 기여도 소명서',
    category: 'CORRECTION',
    agency: '자체 작성 / 통장 입증',
    tips: '배우자 명의 부동산, 전세보증금, 차량이 배우자 특유재산임을 소명하여 청산가치 반영 방어.',
    isRequired: false,
    isThirdPartyMasking: false
  },
  {
    id: 'cr-3',
    order: 3,
    name: '급여·통장 압류적립금 증명원 (타채 사건번호)',
    category: 'CORRECTION',
    agency: '직장 회계과 / 공탁계',
    tips: '압류로 인해 회사에 유보된 적립금을 1회차 변제금으로 일괄 투입하기 위한 소명자료.',
    isRequired: false,
    isThirdPartyMasking: false
  }
];

const STORAGE_KEY = 'LEGAL_CRM_APPLICATION_DOC_MASTER_TEMPLATES_V1';

export class ApplicationDocTemplateService {
  /**
   * 저장소에서 전체 템플릿 목록 로드 (없으면 기본값 초기화)
   */
  static getTemplates(): ApplicationDocMasterItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.resetToDefaults();
        return DEFAULT_DOC_TEMPLATES;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_DOC_TEMPLATES;
    }
  }

  /**
   * 특정 카테고리의 템플릿 목록 로드
   */
  static getTemplatesByCategory(category: DocCategoryKey): ApplicationDocMasterItem[] {
    const list = this.getTemplates();
    return list
      .filter(item => item.category === category)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 새 서류 템플릿 추가
   */
  static addTemplate(item: Omit<ApplicationDocMasterItem, 'id' | 'order'>): ApplicationDocMasterItem {
    const list = this.getTemplates();
    const sameCat = list.filter(i => i.category === item.category);
    const maxOrder = sameCat.reduce((max, i) => Math.max(max, i.order), 0);

    const newItem: ApplicationDocMasterItem = {
      ...item,
      id: `doc-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      order: maxOrder + 1
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

    list[idx] = { ...list[idx], ...updates };
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
   * 의뢰인 사건 정보(소득, 회생/파산)에 부합하는 권장 서류 목록 반환
   */
  static getRecommendedDocsForClient(clientRequest: any): ApplicationDocMasterItem[] {
    const isBankruptcy = clientRequest?.caseType === 'bankruptcy' || clientRequest?.targetSolution === '파산면책';
    const isBusiness = clientRequest?.jobType === '사업자' || clientRequest?.isBusiness || clientRequest?.incomeType === '사업소득';

    if (isBankruptcy) {
      // 파산 기본 20종 + 공통 신분증빙
      const baseDocs = this.getTemplatesByCategory('REHAB_SALARIED').filter(d => d.order <= 6 || d.order === 15 || d.order === 18);
      const bpDocs = this.getTemplatesByCategory('BANKRUPTCY');
      return [...baseDocs, ...bpDocs].map((d, idx) => ({ ...d, order: idx + 1 }));
    }

    if (isBusiness) {
      // 영업소득자 24종: 기본 신분/자산/금융 + 사업자 전용 서류
      const salaried = this.getTemplatesByCategory('REHAB_SALARIED');
      // 급여명세, 재직증명 제외하고 사업자 서류 결합
      const nonSalaried = salaried.filter(d => !['rs-10', 'rs-12', 'rs-13', 'rs-14'].includes(d.id));
      const businessDocs = this.getTemplatesByCategory('REHAB_BUSINESS');
      return [...nonSalaried, ...businessDocs].map((d, idx) => ({ ...d, order: idx + 1 }));
    }

    // 기본: 급여소득자 22종
    return this.getTemplatesByCategory('REHAB_SALARIED');
  }

  private static saveTemplates(list: ApplicationDocMasterItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
}
