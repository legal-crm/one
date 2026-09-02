import { 
  RehabCompanionCase, 
  RepaymentRoundItem, 
  LifeCrisisReport, 
  SupportProgram, 
  BankruptcyCompanionCase,
  RepaymentVerificationStatus,
  CompanionSourceType
} from '../types';

const COMPANION_STORAGE_KEY = 'mykim_rehab_companion_case';
const CRISIS_STORAGE_KEY = 'mykim_life_crisis_reports';
const BANKRUPTCY_STORAGE_KEY = 'mykim_bankruptcy_companion_case';

// 36개월/60개월 스케줄 생성 헬퍼
export function generateRepaymentSchedules(
  startYearMonth: string, // '2024-07'
  totalRounds: number = 36,
  monthlyAmount: number = 480000,
  repaymentDay: number = 10,
  initialCompletedRounds: number = 14
): RepaymentRoundItem[] {
  const [startYear, startMonth] = (startYearMonth || '2025-07').split('-').map(Number);
  const items: RepaymentRoundItem[] = [];

  for (let i = 1; i <= totalRounds; i++) {
    const currentMonthIndex = (startMonth || 7) - 1 + (i - 1);
    const dateYear = (startYear || 2025) + Math.floor(currentMonthIndex / 12);
    const dateMonth = (currentMonthIndex % 12) + 1;
    const paddedMonth = String(dateMonth).padStart(2, '0');
    const paddedDay = String(repaymentDay).padStart(2, '0');
    const dueDate = `${dateYear}-${paddedMonth}-${paddedDay}`;

    let status: RepaymentVerificationStatus = 'pending';
    let paidDate: string | undefined = undefined;
    let actualPaidAmount: number | undefined = undefined;

    if (i <= initialCompletedRounds) {
      if (i <= 13) {
        status = 'court_confirmed';
        paidDate = dueDate;
        actualPaidAmount = monthlyAmount;
      } else if (i === 14) {
        status = 'receipt_uploaded';
        paidDate = dueDate;
        actualPaidAmount = monthlyAmount;
      }
    } else {
      status = 'pending';
    }

    items.push({
      round: i,
      dueDate,
      scheduledAmount: monthlyAmount,
      actualPaidAmount,
      paidDate,
      status,
      receiptName: i === 14 ? '2026년_8월_신한이체확인증.pdf' : undefined,
    });
  }

  return items;
}

// 초기 기본 데모 케이스 시딩 (사용자가 바로 풍부한 기능을 체감할 수 있도록)
function createDefaultCompanionCase(): RehabCompanionCase {
  const schedules = generateRepaymentSchedules('2025-07', 36, 480000, 10, 14);
  
  return {
    id: 'case-demo-2026-001',
    alias: '희망의날개',
    sourceType: 'external_office',
    externalOfficeName: '법무법인 율* (타 사무소 진행)',
    caseType: 'individual_rehab',
    courtName: '서울회생법원',
    caseNumber: '2024개회108492',
    caseNumberMasked: '2024개회10****',
    monthlyRepaymentAmount: 480000,
    repaymentDay: 10,
    totalRounds: 36,
    completedRounds: 14,
    startRepaymentDate: '2025-07',
    courtVirtualAccount: '신한은행 110-***-849201 (서울회생법원)',
    assignedLawyerName: '이소민 변호사 (도산 전문)',
    cashflow: {
      monthlyIncome: 2800000,
      essentialLivingCost: 1750000,
      repaymentAmount: 480000,
      otherFixedExpenses: 320000,
    },
    schedules,
    documents: [
      {
        id: 'doc-1',
        name: '개인회생_변제계획인가결정문.pdf',
        type: 'decision',
        uploadedAt: '2025-06-20T10:00:00Z',
        fileSize: 1024 * 450,
      },
      {
        id: 'doc-2',
        name: '확정_변제계획안.pdf',
        type: 'plan',
        uploadedAt: '2025-06-20T10:05:00Z',
        fileSize: 1024 * 320,
      },
      {
        id: 'doc-3',
        name: '14회차_이체확인증.jpg',
        type: 'receipt',
        uploadedAt: '2026-08-10T14:30:00Z',
        fileSize: 1024 * 180,
      }
    ],
    notificationLevel: 'basic',
    createdAt: '2025-07-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  };
}

// 회생동행 사건 불러오기
export function loadRehabCompanionCase(): RehabCompanionCase {
  try {
    const raw = localStorage.getItem(COMPANION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading companion case:', err);
  }
  const defaultCase = createDefaultCompanionCase();
  saveRehabCompanionCase(defaultCase);
  return defaultCase;
}

// 회생동행 사건 저장
export function saveRehabCompanionCase(caseData: RehabCompanionCase): void {
  try {
    localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify({
      ...caseData,
      updatedAt: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Error saving companion case:', err);
  }
}

// 신규 사건 등록 (오픈 온보딩: 타 사무소 / 나홀로 / 마이김변)
export function registerNewCompanionCase(params: {
  alias: string;
  sourceType: CompanionSourceType;
  externalOfficeName?: string;
  caseType: 'individual_rehab' | 'bankruptcy';
  courtName: string;
  caseNumber: string;
  monthlyRepaymentAmount: number;
  repaymentDay: number;
  totalRounds: number;
  completedRounds: number;
  startRepaymentDate: string;
  courtVirtualAccount?: string;
  monthlyIncome?: number;
  essentialLivingCost?: number;
  otherFixedExpenses?: number;
}): RehabCompanionCase {
  const maskedNumber = params.caseNumber.length > 6 
    ? `${params.caseNumber.slice(0, -4)}****`
    : params.caseNumber;

  const schedules = generateRepaymentSchedules(
    params.startRepaymentDate || '2026-01',
    params.totalRounds || 36,
    params.monthlyRepaymentAmount || 500000,
    params.repaymentDay || 10,
    params.completedRounds || 0
  );

  const newCase: RehabCompanionCase = {
    id: `case-${Date.now()}`,
    alias: params.alias || '회원',
    sourceType: params.sourceType,
    externalOfficeName: params.externalOfficeName,
    caseType: params.caseType,
    courtName: params.courtName,
    caseNumber: params.caseNumber,
    caseNumberMasked: maskedNumber,
    monthlyRepaymentAmount: params.monthlyRepaymentAmount,
    repaymentDay: params.repaymentDay,
    totalRounds: params.totalRounds,
    completedRounds: params.completedRounds,
    startRepaymentDate: params.startRepaymentDate,
    courtVirtualAccount: params.courtVirtualAccount,
    cashflow: {
      monthlyIncome: params.monthlyIncome || 2500000,
      essentialLivingCost: params.essentialLivingCost || 1500000,
      repaymentAmount: params.monthlyRepaymentAmount,
      otherFixedExpenses: params.otherFixedExpenses || 300000,
    },
    schedules,
    documents: [],
    notificationLevel: 'basic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveRehabCompanionCase(newCase);
  return newCase;
}

// 회차별 납부 상태 업데이트 & 영수증 등록
export function updateRepaymentRound(
  round: number, 
  status: RepaymentVerificationStatus,
  receipt?: { name: string; dataUrl: string },
  memo?: string
): RehabCompanionCase {
  const currentCase = loadRehabCompanionCase();
  
  const updatedSchedules = currentCase.schedules.map(item => {
    if (item.round === round) {
      return {
        ...item,
        status,
        actualPaidAmount: ['court_confirmed', 'receipt_uploaded', 'self_marked'].includes(status) 
          ? item.scheduledAmount 
          : undefined,
        paidDate: ['court_confirmed', 'receipt_uploaded', 'self_marked'].includes(status)
          ? (item.paidDate || new Date().toISOString().split('T')[0])
          : undefined,
        receiptName: receipt ? receipt.name : item.receiptName,
        receiptDataUrl: receipt ? receipt.dataUrl : item.receiptDataUrl,
        memo: memo !== undefined ? memo : item.memo
      };
    }
    return item;
  });

  // 완료 회차 수 재계산
  const completedCount = updatedSchedules.filter(s => 
    ['court_confirmed', 'receipt_uploaded', 'self_marked'].includes(s.status)
  ).length;

  const updatedCase: RehabCompanionCase = {
    ...currentCase,
    schedules: updatedSchedules,
    completedRounds: completedCount,
    updatedAt: new Date().toISOString()
  };

  saveRehabCompanionCase(updatedCase);
  return updatedCase;
}

// 생활위기 SOS 접수
export function submitLifeCrisisReport(report: Omit<LifeCrisisReport, 'id' | 'createdAt' | 'status'>): LifeCrisisReport {
  const newReport: LifeCrisisReport = {
    ...report,
    id: `crisis-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'submitted',
    lawyerAdvice: '접수된 사정변경 내용을 검토 중입니다. 필요 시 변제계획 변경신청 또는 상환유예 요건을 자문해 드립니다.'
  };

  try {
    const existing = loadLifeCrisisReports();
    const updated = [newReport, ...existing];
    localStorage.setItem(CRISIS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving crisis report:', err);
  }

  return newReport;
}

export function loadLifeCrisisReports(): LifeCrisisReport[] {
  try {
    const raw = localStorage.getItem(CRISIS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading crisis reports:', err);
  }
  return [];
}

// ═══════════════════════════════════════════════
// 공적 복지·채무지원·성실상환 금융 데이터 (공식 기관 기반)
// ═══════════════════════════════════════════════

export const OFFICIAL_SUPPORT_PROGRAMS: SupportProgram[] = [
  // 1순위: 무상·긴급 복지 지원
  {
    id: 'welfare-1',
    priority: 1,
    category: 'welfare_emergency',
    badge: '정부 공적 지원',
    title: '보건복지부 긴급복지지원제도 (생계·의료·주거)',
    subtitle: '갑작스러운 실직, 질병, 휴·폐업 등으로 생계유지가 곤란한 가구 대상 무상 지원',
    organization: '보건복지부 / 관할 시·군·구청',
    eligibility: '중위소득 75% 이하 & 금융재산 600만 원(주거지원 800만 원) 이하',
    benefit: '생계지원금 1인 최대 71만 원 / 4인 최대 183만 원 (최장 6개월), 의료비 최대 300만 원 지원',
    contactNumber: '보건복지상담센터 129',
    officialUrl: 'https://www.bokjiro.go.kr'
  },
  {
    id: 'welfare-2',
    priority: 1,
    category: 'welfare_emergency',
    badge: '취업·소득 지원',
    title: '고용노동부 국민취업지원제도 (I유형)',
    subtitle: '취업지원 서비스와 함께 구직기간 중 안정적인 생계소득 지원',
    organization: '고용노동부 고용복지플러스센터',
    eligibility: '15~69세 구직자 중 가구 중위소득 60% 이하 & 재산 4억 원 이하',
    benefit: '구직촉진수당 월 50만 원 × 6개월 (최대 300만 원) + 가족수당 1인당 10만 원',
    contactNumber: '고용노동부 고객상담센터 1350',
    officialUrl: 'https://www.kua.go.kr'
  },
  {
    id: 'welfare-3',
    priority: 1,
    category: 'welfare_emergency',
    badge: '주거 복지',
    title: 'LH 긴급주거지원 & 마이홈 주거안정 프로그램',
    subtitle: '경매, 퇴거위기, 임대료 체납 위기 가구에 대한 임시거처 및 임대주택 연계',
    organization: '한국토지주택공사(LH) / 마이홈',
    eligibility: '긴급복지지원 수급자 중 주거지원이 필요한 가구',
    benefit: 'LH 매입·전세임대주택 긴급 입주 및 주거안정 보증금 연계',
    contactNumber: '마이홈 콜센터 1600-1004',
    officialUrl: 'https://www.myhome.go.kr'
  },

  // 2순위: 공적 채무·신용 지원
  {
    id: 'credit-1',
    priority: 2,
    category: 'public_debt_credit',
    badge: '공적 채무상담',
    title: '신용회복위원회 채무조정 & 복합지원 연계',
    subtitle: '개인회생 변제수행 중 위기상황 발생 시 채무상담 및 복지·고용 복합 연계',
    organization: '신용회복위원회',
    eligibility: '채무 문제로 어려움을 겪는 금융소비자 누구나',
    benefit: '전문 신용상담원 1:1 맞춤 상담, 일자리 연계, 복지제도 원스톱 연결',
    contactNumber: '신용회복위원회 1600-5500',
    officialUrl: 'https://www.ccrs.or.kr'
  },
  {
    id: 'credit-2',
    priority: 2,
    category: 'public_debt_credit',
    badge: '무료 법률구조',
    title: '대한법률구조공단 개인회생·파산 법률구조',
    subtitle: '경제적으로 어렵거나 법을 몰라 법적 보호를 받지 못하는 국민 대상 법률지원',
    organization: '대한법률구조공단',
    eligibility: '기준 중위소득 125% 이하 국민, 기초생활수급자, 차상위계층 등',
    benefit: '무료 법률상담 및 소송대리, 변제계획 변경 등 법률구조 지원',
    contactNumber: '국번없이 132',
    officialUrl: 'https://www.klac.or.kr'
  },
  {
    id: 'credit-3',
    priority: 2,
    category: 'public_debt_credit',
    badge: '피해 구제',
    title: '금융감독원 불법사금융 피해신고 & 채무자대리인 무료지원',
    subtitle: '고금리 불법사금융, 불법 채권추심으로부터 채무자를 무료 변호사가 보호',
    organization: '금융감독원 / 대한법률구조공단',
    eligibility: '미등록 대부업자 또는 불법추심 피해를 입은 채무자',
    benefit: '무료 변호사를 채무자대리인으로 선임하여 추심 전면 차단 및 손해배상 소송 지원',
    contactNumber: '금융감독원 1332',
    officialUrl: 'https://www.fss.or.kr'
  },

  // 3순위: 성실상환자 공적 금융정보
  {
    id: 'loan-1',
    priority: 3,
    category: 'diligent_repayment_loan',
    badge: '정책 금융',
    title: '서민금융진흥원 개인회생 성실상환자 소액대출 (공식 제도)',
    subtitle: '법원 개인회생 변제계획을 인가받아 일정 기간 이상 미납 없이 성실히 납부한 분을 위한 공적 상품',
    organization: '서민금융진흥원 (KINFA)',
    eligibility: '개인회생 인가 후 6개월(또는 9개월) 이상 성실하게 변제금을 납부 중이거나 최근 3년 이내 완제한 분',
    benefit: '연 2~4%대 저금리, 생활안정자금/의료비/학자금 등 최대 700만 원 (심사 거쳐 결정)',
    contactNumber: '서민금융콜센터 1397',
    officialUrl: 'https://www.kinfa.or.kr'
  },
  {
    id: 'loan-2',
    priority: 3,
    category: 'diligent_repayment_loan',
    badge: '공적 소액금융',
    title: '신용회복위원회 소액금융지원 (성실상환자)',
    subtitle: '채무조정 확정 후 6개월 이상 성실 상환 중인 분 대상 긴급 생활안정자금',
    organization: '신용회복위원회',
    eligibility: '신복위 채무조정 6개월 이상 상환자 또는 법원 개인회생 18~24개월 이상 성실납부자',
    benefit: '연 2.0~3.5% 저금리 소액대출, 최장 5년 분할상환',
    contactNumber: '신용회복위원회 1600-5500',
    officialUrl: 'https://www.ccrs.or.kr'
  }
];

// 파산 전용 케이스 불러오기 및 기본값 시딩
export function loadBankruptcyCase(): BankruptcyCompanionCase {
  try {
    const raw = localStorage.getItem(BANKRUPTCY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading bankruptcy case:', err);
  }

  const defaultBankruptcy: BankruptcyCompanionCase = {
    id: 'bankrupt-demo-001',
    alias: '새출발2026',
    sourceType: 'external_office',
    externalOfficeName: '법무법인 한* (타 사무소 진행)',
    courtName: '서울회생법원',
    caseNumberMasked: '2025하단10**** / 2025하면10****',
    bankruptcyTrusteeName: '박*호 파산관재인 변호사',
    timelines: [
      {
        id: 't-1',
        stageName: '파산 및 면책 신청서 접수',
        status: 'completed',
        targetDate: '2025-11-10',
        description: '법원에 파산 및 면책 동시 신청서 접수 완료'
      },
      {
        id: 't-2',
        stageName: '파산선고 및 파산관재인 선임',
        status: 'completed',
        targetDate: '2026-02-15',
        description: '법원의 파산선고 결정 및 전담 파산관재인 배정'
      },
      {
        id: 't-3',
        stageName: '파산관재인 1차 소명자료 제출',
        status: 'completed',
        targetDate: '2026-04-20',
        description: '과거 3년간 통장거래내역 및 재산 처분내역 소명서 제출 완료'
      },
      {
        id: 't-4',
        stageName: '제1회 채권자집회 및 의견청취기일',
        status: 'completed',
        targetDate: '2026-06-18',
        description: '법원 법정 출석 및 파산관재인 경과 보고 완료'
      },
      {
        id: 't-5',
        stageName: '추가 보정자료 검토 및 배당절차',
        status: 'in_progress',
        targetDate: '2026-09-25',
        description: '파산재단 환가 및 채권자 배당 여부 최종 확인 중'
      },
      {
        id: 't-6',
        stageName: '면책 심문 및 최종 면책결정',
        status: 'pending',
        targetDate: '2026-11-30',
        description: '면책 불허가 사유 유무 최종 판단 및 면책결정문 송달'
      }
    ],
    documents: [
      { id: 'b-doc-1', name: '파산선고결정문.pdf', uploadedAt: '2026-02-16', status: 'reviewed' },
      { id: 'b-doc-2', name: '관재인_요청서류_소명서.pdf', uploadedAt: '2026-04-18', status: 'reviewed' },
    ],
    notificationLevel: 'basic',
    createdAt: '2025-11-10T00:00:00Z',
  };

  try {
    localStorage.setItem(BANKRUPTCY_STORAGE_KEY, JSON.stringify(defaultBankruptcy));
  } catch (err) {}

  return defaultBankruptcy;
}
