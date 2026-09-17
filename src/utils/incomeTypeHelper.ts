/**
 * 고객 소득 유형 판별 및 법원 필수 서류 안내 헬퍼
 * 직장인(급여소득), 개인사업자(영업소득), 프리랜서, 일용직, 무직별 차별화 가이드
 */

export type IncomeClassificationKey = 'salary' | 'business' | 'freelancer' | 'daily' | 'none';

export interface ClientIncomeTypeInfo {
  type: IncomeClassificationKey;
  label: string;
  badgeLabel: string;
  shortTag: string;
  badgeClass: string;
  icon: string;
  requiresD5103: boolean; // 12개월 수지표(D5103) 필수 여부
  documentSummary: string; // 서류 요약
  rationale: string; // 왜 이 서류가 필요한지 법률 실무적 이유
  keyRequiredDocuments: string[]; // 필수 핵심 서류 목록
  exemptDocuments: string[]; // 면제 서류 목록
}

export function detectClientIncomeType(
  financialProfile?: any,
  d5103Data?: any,
  consultRequest?: any
): ClientIncomeTypeInfo {
  // 1. D5103 데이터에서 확인
  const d5103Type = d5103Data?.detailedIncomeType || d5103Data?.incomeType;
  // 2. FinancialProfile에서 확인
  const fpEmp = financialProfile?.employmentType || financialProfile?.incomeType;
  // 3. ConsultRequest 원본에서 확인
  const reqEmp = consultRequest?.employmentType || consultRequest?.incomeType;

  const raw = String(d5103Type || fpEmp || reqEmp || '').toLowerCase();

  // 1) 개인사업자 / 영업소득자
  if (raw.includes('business') || raw.includes('사업') || raw.includes('자영업') || raw.includes('대표')) {
    return {
      type: 'business',
      label: '개인사업자 (영업소득)',
      badgeLabel: '🏢 개인사업자',
      shortTag: '사업순이익',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      icon: '🏢',
      requiresD5103: true,
      documentSummary: '12개월 수지표(D5103) 필수 • 부가세·소득금액증명·사업장 임대차계약서 수합',
      rationale: '사업자는 매출에서 필요경비를 차감한 실질 순소득으로 변제금을 산정하므로 12개월간의 수지표(D5103)와 매출/매입 증빙이 법원 필수 요구사항입니다.',
      keyRequiredDocuments: [
        '12개월 수입·지출 내역서 (수지표, D5103)',
        '사업자등록증 사본',
        '부가가치세 과세표준증명 (최근 1~2년)',
        '종합소득세 소득금액증명원',
        '사업장 임대차계약서 사본',
        '주요 사업용 계좌 거래내역서'
      ],
      exemptDocuments: [
        '근로소득원천징수영수증',
        '재직증명서'
      ]
    };
  }

  // 2) 프리랜서 (3.3% 원천징수 / 특수고용)
  if (raw.includes('freelancer') || raw.includes('프리랜서') || raw.includes('특고') || raw.includes('위촉')) {
    return {
      type: 'freelancer',
      label: '프리랜서 (3.3% 사업소득)',
      badgeLabel: '💻 프리랜서',
      shortTag: '용역소득',
      badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
      icon: '💻',
      requiresD5103: true,
      documentSummary: '수입상황보고서(수지표) 제출 • 위촉계약서 및 거주자 사업소득원천징수 수합',
      rationale: '프리랜서는 사업자등록 유무와 무관하게 실적에 따라 소득이 변동하는 영업소득자로 분류되므로 최근 1년간의 수입상황보고서(수지표) 작성이 필수입니다.',
      keyRequiredDocuments: [
        '최근 1년 수입상황보고서 (수지표)',
        '위촉증명서 또는 용역(업무위탁)계약서',
        '거주자 사업소득 원천징수영수증 (최근 1년)',
        '수수료 입금 통장 거래내역서 (1년치)'
      ],
      exemptDocuments: [
        '사업자등록증 (미등록인 경우)',
        '재직증명서'
      ]
    };
  }

  // 3) 일용근로자 / 아르바이트
  if (raw.includes('daily') || raw.includes('일용') || raw.includes('알바') || raw.includes('파트타임') || raw.includes('day_laborer')) {
    return {
      type: 'daily',
      label: '일용직 / 단기근로',
      badgeLabel: '🔨 일용·단기',
      shortTag: '일용소득',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      icon: '🔨',
      requiresD5103: false,
      documentSummary: '일용근로소득지급명세서 및 통장 입금내역, 소득진술서 중심 수합',
      rationale: '정규 고용계약이 없는 일용직은 최근 6개월~1년간 실제로 수령한 노임 입금 통장 내역과 국세청 일용근로지급명세서로 평균소득을 산정합니다.',
      keyRequiredDocuments: [
        '일용근로소득 지급명세서 (홈택스)',
        '노임 입금 계좌 거래내역서',
        '소득 진술서 (간이 양식)',
        '고용확인서 또는 현장 근로확인서'
      ],
      exemptDocuments: [
        '12개월 영업 수지표 (D5103)',
        '부가가치세 과세표준증명'
      ]
    };
  }

  // 4) 무직 / 주부 / 취약계층 (무소득)
  if (raw.includes('none') || raw.includes('무직') || raw.includes('주부') || raw.includes('은퇴') || raw.includes('학생')) {
    return {
      type: 'none',
      label: '무직 / 주부 (무소득)',
      badgeLabel: '🏠 무직·주부',
      shortTag: '무소득',
      badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-400/40',
      icon: '🏠',
      requiresD5103: false,
      documentSummary: '무소득 사실증명원 수합 • 개인파산 및 면책 우선 검토 대상',
      rationale: '지속적인 생계 소득이 없어 개인회생 변제금 납입이 불가능하므로 원칙적으로 개인파산·면책 절차를 검토하며, 무소득사실증명원으로 소득 없음을 입증합니다.',
      keyRequiredDocuments: [
        '사실증명원 (신고사실없음 / 홈택스)',
        '건강보험자격득실확인서 (피부양자 확인)',
        '생계보조금/수급자 증명서 (해당 시)',
        '진단서/소견서 (근로능력 상실 시)'
      ],
      exemptDocuments: [
        '12개월 수지표 (D5103)',
        '원천징수영수증'
      ]
    };
  }

  // 5) 기본값: 4대보험 가입 직장인 (급여소득자)
  return {
    type: 'salary',
    label: '4대보험 직장인 (급여소득)',
    badgeLabel: '💼 4대보험 직장인',
    shortTag: '급여',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    icon: '💼',
    requiresD5103: false,
    documentSummary: '수지표(D5103) 면제 대상 • 근로소득원천징수영수증 및 급여통장(1년) 중심 수합',
    rationale: '고정 급여소득자로 월평균 실질소득이 명확하여 복잡한 12개월 영업수지표(D5103) 작성이 면제되며, 원천징수영수증과 급여통장 사본으로 충분히 소명됩니다.',
    keyRequiredDocuments: [
      '근로소득원천징수영수증 (최근 1년)',
      '재직증명서',
      '급여 입금 통장 거래내역서 (최근 1년 사본)',
      '건강보험 자격득실확인서 & 보험료납부확인서'
    ],
    exemptDocuments: [
      '12개월 영업 수지표 (D5103, 면제)',
      '부가가치세 과세표준증명'
    ]
  };
}

