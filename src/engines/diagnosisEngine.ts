import { 
  IntakeData, AppSettings, ComputeResponse,
  DiagnosisAnswers, DiagnosisResult, DiagnosisQuestion,
  StrategyType, StrategyRecommendation, UrgencyLevel
} from '../types';
import { calculateRehabPlan } from '../rehabEngine';
import { DEFAULT_SETTINGS } from '../constants';

// ============================================================
// 1. 진단 질문 데이터 (관리자 편집 가능 — 기본값)
// ============================================================

export const DEFAULT_DIAGNOSIS_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: 'q1_status',
    step: 1,
    title: '현재 상황에 가장 가까운 것을 선택하세요',
    subtitle: '연체나 추심 여부를 파악하기 위한 질문입니다',
    options: [
      { id: 'no_delinquency', label: '아직 연체는 아니지만 곧 힘들어질 것 같다', icon: '⏳' },
      { id: 'early_delinquency', label: '연체가 시작됐다 (1~30일)', icon: '⚡' },
      { id: 'severe_delinquency', label: '연체가 심하다 (1달 이상)', icon: '🔥' },
      { id: 'collection', label: '독촉·추심을 받고 있다', icon: '📞' },
      { id: 'seizure', label: '압류가 진행 중이다', icon: '🚨' },
    ],
  },
  {
    id: 'q2_debtScale',
    step: 2,
    title: '총 채무는 대략 어느 정도인가요?',
    subtitle: '정확하지 않아도 괜찮습니다. 대략적인 규모만 선택해주세요',
    options: [
      { id: 'under_1000', label: '1,000만 원 이하', icon: '💰' },
      { id: '1000_to_5000', label: '1,000만 ~ 5,000만 원', icon: '💵' },
      { id: '5000_to_10000', label: '5,000만 ~ 1억 원', icon: '💳' },
      { id: '10000_to_50000', label: '1억 ~ 5억 원', icon: '🏦' },
      { id: 'over_50000', label: '5억 원 이상', icon: '🏢' },
    ],
  },
  {
    id: 'q3_income',
    step: 3,
    title: '현재 정기적인 소득이 있으신가요?',
    subtitle: '회생 가능 여부를 판단하는 핵심 요소입니다',
    options: [
      { id: 'employed', label: '있다 (직장인/공무원)', icon: '👔', description: '4대보험 적용 직장' },
      { id: 'unstable', label: '있지만 불안정하다', icon: '🔄', description: '프리랜서, 일용직, 파트타임' },
      { id: 'business', label: '사업 소득이 있다', icon: '🏪', description: '자영업, 개인사업자' },
      { id: 'none', label: '현재 소득이 없다', icon: '😔', description: '무직, 구직 중' },
    ],
  },
  {
    id: 'q4_urgentNeed',
    step: 4,
    title: '지금 가장 급한 문제는 무엇인가요?',
    subtitle: '우선순위에 따라 최적의 전략이 달라집니다',
    options: [
      { id: 'harassment', label: '전화·문자 추심 스트레스', icon: '📱' },
      { id: 'seizure_wage', label: '급여·통장 압류', icon: '🔒' },
      { id: 'tax', label: '세금 체납', icon: '📋' },
      { id: 'overwhelmed', label: '채무 규모가 감당 불가', icon: '😰' },
      { id: 'unsure', label: '어떤 방법이 맞는지 모르겠다', icon: '🤔' },
    ],
  },
  {
    id: 'q5_goal',
    step: 5,
    title: '원하는 방향은?',
    subtitle: '목표에 맞춰 전략을 추천해드립니다',
    options: [
      { id: 'fast_resolution', label: '최대한 빨리 정리하고 싶다', icon: '⚡' },
      { id: 'buy_time', label: '버티면서 시간을 확보하고 싶다', icon: '⏰' },
      { id: 'reduce_burden', label: '월 부담을 줄이고 싶다', icon: '📉' },
      { id: 'need_guidance', label: '잘 모르겠다 — 방향을 알려주면 좋겠다', icon: '🧭' },
    ],
  },
];

// ============================================================
// 2. 답변 → IntakeData 매핑 (rehabEngine 직접 호출용)
// ============================================================

function estimateDebtAmount(debtScale: string): number {
  switch (debtScale) {
    case 'under_1000': return 700;
    case '1000_to_5000': return 3000;
    case '5000_to_10000': return 7500;
    case '10000_to_50000': return 25000;
    case 'over_50000': return 60000;
    default: return 5000;
  }
}

function estimateIncomeAmount(incomeType: string): number {
  switch (incomeType) {
    case 'employed': return 300;      // 월 300만원 (중위)
    case 'unstable': return 180;      // 월 180만원
    case 'business': return 250;      // 월 250만원
    case 'none': return 0;
    default: return 200;
  }
}

function mapIncomeType(incomeType: string): 'worker' | 'worker_no_ins' | 'freelancer' | 'business' | 'unemployed' {
  switch (incomeType) {
    case 'employed': return 'worker';
    case 'unstable': return 'freelancer';
    case 'business': return 'business';
    case 'none': return 'unemployed';
    default: return 'worker';
  }
}

function mapAnswersToIntakeData(answers: DiagnosisAnswers): IntakeData {
  const debtAmount = estimateDebtAmount(answers.q2_debtScale);
  const incomeAmount = estimateIncomeAmount(answers.q3_income);

  return {
    clientName: '익명',
    phoneNumber: '',
    birthDate: '1985-1-1',
    consultDate: new Date().toISOString().split('T')[0],
    dbVendor: '자가진단',
    caseType: 'individual_rehab',
    residence: '서울특별시',
    workplace: '',
    selectedCourt: '서울회생법원',
    maritalStatus: 'single',
    minorChildren: 0,
    minorChildrenFullRecognition: false,
    otherDependents: 0,
    prevHistory: { exists: false },
    incomeSources: [{
      id: 'diag-income-1',
      type: mapIncomeType(answers.q3_income),
      amount: incomeAmount,
    }],
    debts: [{
      id: 'diag-debt-1',
      creditor: '추정 채무',
      principal: debtAmount,
      interest: 0,
      type: 'unsecured',
      isGamblingOrLuxury: false,
      isRecent: answers.q1_status === 'no_delinquency',
    }],
    assets: [],
    monthlyLivingCost: 0,
    monthlyRent: 0,
    monthlyInsurance: 0,
    extraLivingCost: { utilities: 0, education: 0, specialEducation: 0, medical: 0, other: 0 },
    specialCircumstances: { singleParent: false, basicLivelihood: false, rentFraud: false, severeDisability: false },
    consultationLogs: [],
  };
}

// ============================================================
// 3. rehabEngine 결과 → 전략 해석
// ============================================================

const STRATEGY_LABELS: Record<StrategyType, string> = {
  REHABILITATION: '개인회생',
  BANKRUPTCY: '파산·면책',
  NEGOTIATION: '채무조정·대리인',
  FRESH_START: '새출발기금',
  WAIT_AND_SEE: '대기·전략 수립',
};

const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  REHABILITATION: '법원의 인가를 받아 3~5년간 일부만 변제하고 나머지를 면책받는 제도입니다.',
  BANKRUPTCY: '재산을 청산하여 채무를 전액 면책받는 제도입니다. 소득이 없거나 변제 능력이 없을 때 적합합니다.',
  NEGOTIATION: '채권자와 직접 협의하여 이자 감면, 분할 상환 등을 조정하는 방법입니다.',
  FRESH_START: '정부 지원 프로그램으로, 일정 조건을 충족하면 원금의 일부를 감면받을 수 있습니다.',
  WAIT_AND_SEE: '현재 상황에서 즉각 행동하기보다 전략적으로 시간을 확보하는 방향입니다.',
};

const STRATEGY_PROS: Record<StrategyType, string[]> = {
  REHABILITATION: ['최대 90% 채무 탕감 가능', '추심·압류 즉시 중단', '법적 보호 확실'],
  BANKRUPTCY: ['채무 전액 면책 가능', '새 출발 기회', '가장 빠른 해결'],
  NEGOTIATION: ['법원 절차 없이 진행', '신용 영향 상대적 적음', '유연한 조건 조정'],
  FRESH_START: ['정부 지원으로 안정적', '낮은 이자율 적용', '심리적 부담 적음'],
  WAIT_AND_SEE: ['추가 정보 수집 가능', '성급한 결정 방지', '소멸시효 활용 가능'],
};

const STRATEGY_CONS: Record<StrategyType, string[]> = {
  REHABILITATION: ['3~5년 변제 기간 필요', '정기 소득 필수', '신용 제한'],
  BANKRUPTCY: ['재산 청산 필요', '직업 제한 가능', '사회적 낙인 우려'],
  NEGOTIATION: ['법적 강제력 약함', '채권자 동의 필요', '감면 폭 제한적'],
  FRESH_START: ['자격 요건 까다로움', '지원 한도 존재', '신청 기간 제한'],
  WAIT_AND_SEE: ['추심 스트레스 지속', '채무 이자 증가', '상황 악화 가능'],
};

function determineUrgency(answers: DiagnosisAnswers): { level: UrgencyLevel; message: string } {
  if (answers.q1_status === 'seizure' || answers.q4_urgentNeed === 'seizure_wage') {
    return { level: 'immediate', message: '압류가 진행 중이거나 임박한 상태입니다. 즉각적인 법적 조치가 필요합니다.' };
  }
  if (answers.q1_status === 'collection' || answers.q1_status === 'severe_delinquency') {
    return { level: 'soon', message: '연체 또는 추심이 진행 중입니다. 빠른 전략 수립이 권장됩니다.' };
  }
  return { level: 'can_wait', message: '아직 시간적 여유가 있습니다. 신중하게 최적 전략을 선택하세요.' };
}

function generateActionItems(answers: DiagnosisAnswers, primaryStrategy: StrategyType): string[] {
  const items: string[] = [];
  
  // 공통 긴급 행동
  if (answers.q1_status === 'seizure') {
    items.push('즉시 채무자대리인 선임을 통해 추심 중단 요청');
    items.push('급여 통장을 제3금융권(카카오뱅크 등)으로 변경');
  }
  if (answers.q1_status === 'collection') {
    items.push('불법 추심 시 금융감독원(1332)에 즉시 신고');
    items.push('모든 독촉 전화·문자를 녹음/캡처하여 보관');
  }

  // 전략별 행동
  switch (primaryStrategy) {
    case 'REHABILITATION':
      items.push('추가 채무 발생을 즉시 중단하세요');
      items.push('최근 3개월 급여명세서를 준비하세요');
      items.push('보유 자산(부동산, 차량, 보험 등) 목록을 정리하세요');
      break;
    case 'BANKRUPTCY':
      items.push('현재 보유 재산 목록을 정리하세요');
      items.push('채무 발생 경위를 시간순으로 정리하세요');
      items.push('구직 활동 증거(이력서 제출 등)를 확보하세요');
      break;
    case 'NEGOTIATION':
      items.push('각 채권자별 연락처와 채무 금액을 정리하세요');
      items.push('현재 가능한 월 상환 금액을 산정하세요');
      break;
    case 'FRESH_START':
      items.push('새출발기금 자격 요건을 확인하세요');
      items.push('신용정보조회서를 발급받으세요');
      break;
    case 'WAIT_AND_SEE':
      items.push('각 채무의 소멸시효 기한을 확인하세요');
      items.push('불필요한 지출을 최소화하고 비상금을 확보하세요');
      break;
  }

  return items.slice(0, 5); // 최대 5개
}

function generateWarnings(answers: DiagnosisAnswers, result: ComputeResponse): string[] {
  const warnings: string[] = [];
  
  // rehabEngine 알림 기반
  result.alerts.forEach(alert => {
    if (alert.severity === 'error' || alert.severity === 'warn') {
      warnings.push(alert.message);
    }
  });

  // 추가 경고
  if (answers.q1_status === 'no_delinquency') {
    warnings.push('아직 연체 전이지만, 최근 1년 내 발생한 채무가 많으면 법원 심사 시 불리할 수 있습니다.');
  }
  if (answers.q2_debtScale === 'over_50000') {
    warnings.push('채무가 5억 원을 초과하면 개인회생 신청 자격이 제한될 수 있습니다. 정밀 분석이 필요합니다.');
  }

  return warnings;
}

function buildStrategyRecommendation(
  type: StrategyType, 
  confidence: 'high' | 'medium' | 'low'
): StrategyRecommendation {
  return {
    type,
    label: STRATEGY_LABELS[type],
    confidence,
    description: STRATEGY_DESCRIPTIONS[type],
    pros: STRATEGY_PROS[type],
    cons: STRATEGY_CONS[type],
  };
}

function interpretRehabResult(
  result: ComputeResponse, 
  answers: DiagnosisAnswers
): { primary: StrategyRecommendation; secondary?: StrategyRecommendation; all: StrategyRecommendation[] } {
  const hasImpossible = result.alerts.some(a => a.type === 'impossible');
  const hasNoIncome = result.alerts.some(a => a.type === 'income');
  const hasExcessCut = result.alerts.some(a => a.type === 'excess');
  const preferred = result.preferred;
  
  let primary: StrategyRecommendation;
  let secondary: StrategyRecommendation | undefined;

  if (hasImpossible) {
    // 청산가치 > 채무 → 회생 부적합
    primary = buildStrategyRecommendation('NEGOTIATION', 'high');
    secondary = buildStrategyRecommendation('WAIT_AND_SEE', 'medium');
  } else if (hasNoIncome || answers.q3_income === 'none') {
    // 소득 없음 → 파산 추천
    primary = buildStrategyRecommendation('BANKRUPTCY', 'high');
    secondary = buildStrategyRecommendation('FRESH_START', 'medium');
  } else if (preferred) {
    // Look up needCutPct from matching row since PreferredPlan doesn't carry it
    const matchingRow = result.rows.find(r => r.m === preferred.m);
    const cutPct = matchingRow ? matchingRow.needCutPct : 0;
    
    if (cutPct <= 0) {
      // 정상 상환 가능 → 회생 최적
      primary = buildStrategyRecommendation('REHABILITATION', 'high');
      secondary = buildStrategyRecommendation('NEGOTIATION', 'low');
    } else if (cutPct <= 0.15) {
      // 소폭 조정 필요 → 회생 가능
      primary = buildStrategyRecommendation('REHABILITATION', 'high');
      secondary = buildStrategyRecommendation('FRESH_START', 'medium');
    } else if (cutPct <= 0.3) {
      // 대폭 조정 필요 → 회생 가능하나 어려움
      primary = buildStrategyRecommendation('REHABILITATION', 'medium');
      secondary = buildStrategyRecommendation('BANKRUPTCY', 'medium');
    } else {
      // 한도 초과 → 회생 매우 어려움
      primary = buildStrategyRecommendation('BANKRUPTCY', 'high');
      secondary = buildStrategyRecommendation('REHABILITATION', 'low');
    }
  } else if (hasExcessCut) {
    primary = buildStrategyRecommendation('BANKRUPTCY', 'medium');
    secondary = buildStrategyRecommendation('REHABILITATION', 'low');
  } else {
    // 기본 fallback
    primary = buildStrategyRecommendation('REHABILITATION', 'medium');
    secondary = buildStrategyRecommendation('NEGOTIATION', 'medium');
  }

  // 목표 기반 보조 조정
  if (answers.q5_goal === 'buy_time' && primary.type !== 'WAIT_AND_SEE') {
    secondary = buildStrategyRecommendation('WAIT_AND_SEE', 'medium');
  }

  // 전체 전략 리스트 생성 (추천도 순서)
  const allTypes: StrategyType[] = ['REHABILITATION', 'BANKRUPTCY', 'NEGOTIATION', 'FRESH_START', 'WAIT_AND_SEE'];
  const all = allTypes.map(type => {
    if (type === primary.type) return primary;
    if (secondary && type === secondary.type) return secondary;
    return buildStrategyRecommendation(type, 'low');
  });

  return { primary, secondary, all };
}

// ============================================================
// 4. 메인 진단 함수
// ============================================================

export function runDiagnosis(
  answers: DiagnosisAnswers,
  settings?: AppSettings
): DiagnosisResult {
  const effectiveSettings = settings || DEFAULT_SETTINGS;
  
  // 1. 답변 → IntakeData 매핑
  const intakeData = mapAnswersToIntakeData(answers);
  
  // 2. rehabEngine 실행
  let computeResponse: ComputeResponse;
  let rehabEngineUsed = true;
  
  try {
    computeResponse = calculateRehabPlan(intakeData, effectiveSettings);
  } catch {
    // rehabEngine 실패 시 간이 결과 생성
    rehabEngineUsed = false;
    computeResponse = {
      caseId: 'FALLBACK',
      ownerId: 'anonymous',
      status: 'error',
      client: { name: '익명', age: 40, monthlyIncome: estimateIncomeAmount(answers.q3_income), dependents: 0, court: '서울회생법원', residence: '서울' },
      base: { disposable: 0, living: 0, debtTotal: estimateDebtAmount(answers.q2_debtScale), liq: 0 },
      allow2435: false,
      rows: [],
      top3: [],
      preferred: null,
      alerts: [],
    };
  }

  // 3. 전략 해석
  const { primary, secondary, all } = interpretRehabResult(computeResponse, answers);
  
  // 4. 긴급도 판단
  const urgency = determineUrgency(answers);
  
  // 5. 행동 가이드 생성
  const actionItems = generateActionItems(answers, primary.type);
  
  // 6. 경고 생성
  const warnings = generateWarnings(answers, computeResponse);

  // 7. 금액 계산
  const debtTotal = computeResponse.base.debtTotal;
  const preferred = computeResponse.preferred;
  const totalRepayment = preferred ? preferred.total : debtTotal;
  const savingsAmount = Math.max(0, debtTotal - totalRepayment);
  const savingsRate = debtTotal > 0 ? savingsAmount / debtTotal : 0;
  const monthlyPayment = preferred ? preferred.monthly : 0;

  return {
    id: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    answers,
    primaryStrategy: primary,
    secondaryStrategy: secondary,
    allStrategies: all,
    urgencyLevel: urgency.level,
    urgencyMessage: urgency.message,
    estimatedSavingsAmount: savingsAmount,
    estimatedSavingsRate: savingsRate,
    estimatedMonthlyPayment: monthlyPayment,
    estimatedDebtTotal: debtTotal,
    actionItems,
    warnings,
    rehabEngineUsed,
    computeResponse,
  };
}
