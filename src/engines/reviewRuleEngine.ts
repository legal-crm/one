import type { 
  ReviewRule, ReviewRuleSet, ReviewFlag, ReviewFlagType, 
  RuleSourceType, CourtPracticeNote, RuleCondition, RuleOutputType 
} from '../types/copilot';
import type { FactEngineOutput } from './factEngine';

export interface ReviewRuleEngineOutput {
  /** 생성된 플래그 목록 */
  flags: ReviewFlag[];
  /** 추가 질문 */
  additionalQuestions: string[];
  /** 필요 서류 */
  requiredDocuments: string[];
  /** 관할법원 참고사항 */
  courtPracticeNotes: CourtPracticeNote[];
  /** 추천 상담 템플릿 */
  suggestedTemplate: string | null;
  /** 검토 등급 (고위험 플래그 수에 따라 자동 결정) */
  reviewGrade: 'NORMAL_REVIEW' | 'ENHANCED_REVIEW' | 'SECOND_REVIEW';
  /** 적용된 RuleSet 정보 */
  appliedRuleSetId: string;
  appliedRuleSetVersion: number;
  executedAt: string;
}

// ============================================================
// 기본 검토 규칙 (글로벌 템플릿)
// ============================================================
export const DEFAULT_REVIEW_RULES: ReviewRule[] = [
  {
    id: 'rule-01',
    ruleSetId: 'default',
    category: '채무한도',
    title: '채무한도 초과 확인',
    description: '채무액이 5억원(무담보)을 초과하는지 확인',
    conditions: [
      { field: 'totalDebt', operator: 'GT', value: 500000000 }
    ],
    outputType: 'REVIEW_FLAG',
    outputMessage: '채무액이 5억 원을 초과하여 개인회생 채무 한도와 관련된 사항을 확인하세요.',
    sourceType: 'FIRM_EXPERIENCE',
    sourceReference: '',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  },
  {
    id: 'rule-02',
    ruleSetId: 'default',
    category: '소득',
    title: '무소득 확인',
    description: '현재 소득이 없는 경우',
    conditions: [
      { field: 'monthlyIncome', operator: 'LTE', value: 0 }
    ],
    outputType: 'HIGH_RISK',
    outputMessage: '현재 소득이 없는 것으로 입력되어 있습니다. 소득 상태를 확인하세요.',
    sourceType: 'FIRM_EXPERIENCE',
    sourceReference: '',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  },
  {
    id: 'rule-03',
    ruleSetId: 'default',
    category: '가용소득',
    title: '가용소득 부족',
    description: '가용소득이 0 이하인 경우',
    conditions: [
      { field: 'disposableIncome', operator: 'LTE', value: 0 }
    ],
    outputType: 'HIGH_RISK',
    outputMessage: '가용소득이 없는 것으로 계산됩니다. 소득과 지출을 재확인하세요.',
    sourceType: 'FIRM_EXPERIENCE',
    sourceReference: '',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  },
  {
    id: 'rule-04',
    ruleSetId: 'default',
    category: '형사고소위험',
    title: '최근 채무 사기죄 피소 주의',
    description: '최근 6개월 이내 발생한 채무가 포함되어 채권자의 사기죄(형법 제347조) 고소 위험',
    conditions: [
      { field: 'recentDebts', operator: 'EXISTS', value: true }
    ],
    outputType: 'HIGH_RISK',
    outputMessage: '최근 발생한 채무가 확인되었습니다. 채권자의 사기죄 고소(차용 당시 변제의사/능력 부존재) 위험에 대비해 병원비, 생계비 등 실제 사용처 소명자료를 사전에 확보하세요.',
    sourceType: 'STATUTE',
    sourceReference: '형법 제347조, 채무자회생법 제595조',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  },
  {
    id: 'rule-05',
    ruleSetId: 'default',
    category: '별제권',
    title: '담보부 채권 예정부족액 발생',
    description: '담보물의 예상 환가액을 초과하는 담보부 채무가 존재하여 일반 무담보 회생채권으로 분할 필요',
    conditions: [
      { field: 'pledgedAssetsEstimatedDeficit', operator: 'GT', value: 0 }
    ],
    outputType: 'CAUTION',
    outputMessage: '담보물의 예상 환가액을 초과하는 담보 대출 부족액이 발생합니다. 해당 부족액을 일반 무담보 회생채권으로 변제계획안에 산입하세요.',
    sourceType: 'PRACTICE_MANUAL',
    sourceReference: '회생실무준칙 제411호',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  },
  {
    id: 'rule-06',
    ruleSetId: 'default',
    category: '우선채권',
    title: '조세 등 우선권 채권 분할 상환',
    description: '세금 체납액이 존재하여 변제기간 전반부 18회차 이내 전액 변제 스케줄링 필요',
    conditions: [
      { field: 'taxDebt', operator: 'GT', value: 0 }
    ],
    outputType: 'CAUTION',
    outputMessage: '국세/지방세 등 체납 세금이 포함되어 있습니다. 변제기간의 1/2(최대 18회차) 이내에 세금을 전액 우선 배당하도록 변제계획안을 편성하세요.',
    sourceType: 'STATUTE',
    sourceReference: '채무자회생법 제611조 제1항',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  }
];

function evaluateCondition(condition: RuleCondition, factOutput: FactEngineOutput): boolean {
  let actualValue: any;
  const fieldPath = condition.field.split('.');
  if (fieldPath.length === 1) {
    actualValue = (factOutput.factSummary as any)[fieldPath[0]];
  } else if (fieldPath.length === 2 && fieldPath[0] === 'assets') {
    actualValue = (factOutput.factSummary.assets as any)[fieldPath[1]];
  }

  if (actualValue === undefined || actualValue === null) return false;

  switch (condition.operator) {
    case 'EQ': return actualValue === condition.value;
    case 'NEQ': return actualValue !== condition.value;
    case 'GT': return actualValue > condition.value;
    case 'GTE': return actualValue >= condition.value;
    case 'LT': return actualValue < condition.value;
    case 'LTE': return actualValue <= condition.value;
    case 'CONTAINS': return String(actualValue).includes(String(condition.value));
    case 'EXISTS': 
      if (Array.isArray(actualValue)) return actualValue.length > 0;
      return actualValue !== undefined && actualValue !== null;
    case 'NOT_EXISTS': 
      if (Array.isArray(actualValue)) return actualValue.length === 0;
      return actualValue === undefined || actualValue === null;
    default: return false;
  }
}

function evaluateRule(rule: ReviewRule, factOutput: FactEngineOutput): boolean {
  return rule.conditions.every(cond => evaluateCondition(cond, factOutput));
}

function generateFlag(rule: ReviewRule, factOutput: FactEngineOutput): ReviewFlag {
  const usedInputValues: Record<string, any> = {};
  rule.conditions.forEach(cond => {
    const fieldPath = cond.field.split('.');
    let actualValue: any;
    if (fieldPath.length === 1) {
      actualValue = (factOutput.factSummary as any)[fieldPath[0]];
    } else if (fieldPath.length === 2 && fieldPath[0] === 'assets') {
      actualValue = (factOutput.factSummary.assets as any)[fieldPath[1]];
    }
    usedInputValues[cond.field] = actualValue;
  });

  // outputType → flagType 매핑
  let flagType: ReviewFlagType = 'INFO';
  if (rule.outputType === 'HIGH_RISK') flagType = 'HIGH_RISK';
  else if (rule.outputType === 'CAUTION') flagType = 'CAUTION';
  else if (rule.outputType === 'ADDITIONAL_QUESTION') flagType = 'ADDITIONAL_CHECK';
  else if (rule.outputType === 'REVIEW_FLAG') flagType = 'CAUTION';

  return {
    id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    caseReviewId: '',
    ruleId: rule.id,
    flagType,
    message: rule.outputMessage,
    usedInputValues,
    appliedRuleName: rule.title,
    appliedRuleVersion: rule.version,
    sourceType: rule.sourceType,
    sourceReference: rule.sourceReference,
    judgmentStatus: 'REQUIRES_LAWYER_REVIEW',
  };
}

function createBuiltinFlag(
  idSuffix: string,
  flagType: ReviewFlagType,
  message: string,
  usedInputValues: Record<string, any>
): ReviewFlag {
  return {
    id: `flag-${idSuffix}-${Date.now()}`,
    caseReviewId: '',
    ruleId: `builtin-${idSuffix}`,
    flagType,
    message,
    usedInputValues,
    appliedRuleName: `내장 규칙: ${idSuffix}`,
    judgmentStatus: 'REQUIRES_LAWYER_REVIEW',
  };
}

function determineHighRiskFlags(factOutput: FactEngineOutput, existingFlags: ReviewFlag[]): ReviewFlag[] {
  const flags = [...existingFlags];
  const { factSummary, conflicts } = factOutput;

  // 최근 채무 비중
  const recentDebtSum = factSummary.recentDebts.reduce((acc, curr) => acc + curr.principal, 0);
  if (factSummary.totalDebt > 0 && (recentDebtSum / factSummary.totalDebt) > 0.3) {
    flags.push(createBuiltinFlag('recent-debt', 'HIGH_RISK',
      '최근 발생한 채무의 비중이 30%를 초과합니다. 사용처와 증빙자료를 확인하세요.',
      { totalDebt: factSummary.totalDebt, recentDebtSum }
    ));
  }

  // 조세 채무
  if (factSummary.taxDebt > 0) {
    flags.push(createBuiltinFlag('tax-debt', 'CAUTION',
      '우선 변제되어야 할 조세 채무가 포함되어 있습니다. 변제 계획을 확인하세요.',
      { taxDebt: factSummary.taxDebt }
    ));
  }

  // 과거 이력
  if (factSummary.previousHistory) {
    flags.push(createBuiltinFlag('prev-history', 'HIGH_RISK',
      '과거 회생/파산 진행 이력이 있습니다. 재신청 가능 요건을 확인하세요.',
      { previousHistory: true }
    ));
  }

  // 입력값 충돌
  if (conflicts.length > 0) {
    flags.push(createBuiltinFlag('conflicts', 'ADDITIONAL_CHECK',
      '입력된 데이터 간 충돌이 감지되었습니다. 사실 관계를 확인하세요.',
      { conflictCount: conflicts.length }
    ));
  }

  return flags;
}

function determineReviewGrade(flags: ReviewFlag[]): 'NORMAL_REVIEW' | 'ENHANCED_REVIEW' | 'SECOND_REVIEW' {
  const highRiskCount = flags.filter(f => f.flagType === 'HIGH_RISK').length;
  if (highRiskCount >= 3) return 'SECOND_REVIEW';
  if (highRiskCount >= 1) return 'ENHANCED_REVIEW';
  return 'NORMAL_REVIEW';
}

/**
 * Review Rule Engine 실행
 * FactEngineOutput에 사무실별 규칙을 적용하여 검토 플래그를 생성합니다.
 * ★ 모든 플래그는 '결론'이 아니라 '검토 요청'으로 출력됩니다.
 */
export function runReviewRuleEngine(
  factOutput: FactEngineOutput,
  ruleSet: ReviewRuleSet,
  rules: ReviewRule[],
  courtNotes?: CourtPracticeNote[]
): ReviewRuleEngineOutput {
  
  let flags: ReviewFlag[] = [];
  
  rules.forEach(rule => {
    if (rule.status === 'ACTIVE' && evaluateRule(rule, factOutput)) {
      flags.push(generateFlag(rule, factOutput));
    }
  });

  flags = determineHighRiskFlags(factOutput, flags);
  
  const reviewGrade = determineReviewGrade(flags);

  let matchedCourtNotes: CourtPracticeNote[] = [];
  if (courtNotes && factOutput.rawComputeResponse?.client?.court) {
    matchedCourtNotes = courtNotes.filter(n => n.courtName === factOutput.rawComputeResponse.client.court);
  }

  return {
    flags,
    additionalQuestions: [],
    requiredDocuments: [],
    courtPracticeNotes: matchedCourtNotes,
    suggestedTemplate: null,
    reviewGrade,
    appliedRuleSetId: ruleSet.id,
    appliedRuleSetVersion: ruleSet.version,
    executedAt: new Date().toISOString()
  };
}
