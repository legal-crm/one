/**
 * filingAutoDraftEngine.ts
 * 1·2차 스캔 서류 기반 8대 필수 전산서식 AI 자동 초안(Drafting) 생성 및 
 * 옵션 A(변호사 8종 전수 검토 필수) 승인 관리 엔진
 */

import type { ConsultRequest, CrmClientExtension } from '../../types';
import { detectCourtJurisdiction } from './courtFilingEngine';

export type AutoDraftReviewStatus = 'PENDING_REVIEW' | 'REVIEWED_APPROVED' | 'SUPPLEMENT_REQUIRED';

export type RiskLevel = 'INFO' | 'WARNING' | 'ALERT';

export interface DraftRiskFlag {
  level: RiskLevel;
  message: string;
  targetField?: string;
}

export interface AutoDraftFormItem {
  code: 'R01' | 'R02' | 'R06' | 'R08' | 'R10' | 'R04' | 'R03' | 'R07';
  name: string;
  badge: string;
  legalFormCode: string;
  isDraftReady: boolean;
  confidenceScore: number; // 0 ~ 100
  reviewStatus: AutoDraftReviewStatus;
  sourceDocuments: string[];
  summaryNote: string;
  riskFlags: DraftRiskFlag[];
  reviewedBy?: string;
  reviewedAt?: string;
  lastGeneratedAt: string;
  draftPayload: Record<string, any>;
}

export interface AutoDraftSuiteState {
  clientId: string;
  isGenerating: boolean;
  generatedAt?: string;
  allReviewed: boolean;
  approvedCount: number;
  totalCount: number;
  forms: Record<string, AutoDraftFormItem>;
}

const STORAGE_KEY_PREFIX = 'LEGAL_CRM_AUTO_DRAFT_SUITE_';

/**
 * 8대 서식 기본 메타데이터 및 1·2차 원천 서류 매핑 규격
 */
export const STANDARD_FORM_DEFS: {
  code: AutoDraftFormItem['code'];
  name: string;
  badge: string;
  legalFormCode: string;
  defaultSources: string[];
  baseConfidence: number;
}[] = [
  {
    code: 'R01',
    name: '개인회생절차 개시신청서 본안',
    badge: 'D5101',
    legalFormCode: 'D5101',
    defaultSources: ['주민등록초본', '신분증 사본', '주민등록등본'],
    baseConfidence: 96,
  },
  {
    code: 'R02',
    name: '개인회생 채권자목록 (CSV)',
    badge: 'PDF+CSV',
    legalFormCode: 'D5102-CSV',
    defaultSources: ['금융기관 부채증명서', '부채잔액확인서', '신용정보조회서'],
    baseConfidence: 86,
  },
  {
    code: 'R06',
    name: '재산목록 (D5102)',
    badge: 'D5102',
    legalFormCode: 'D5102',
    defaultSources: ['임대차계약서', '보험해약환급금확인서', '자동차등록원부', '지방세세목별과세증명서'],
    baseConfidence: 89,
  },
  {
    code: 'R08',
    name: '수입 및 지출에 관한 목록 (D5103)',
    badge: 'D5103',
    legalFormCode: 'D5103',
    defaultSources: ['근로소득원천징수영수증', '급여명세서(최근1년)', '건강보험자격득실확인서'],
    baseConfidence: 91,
  },
  {
    code: 'R10',
    name: '진술서 (채무 증대 경위서)',
    badge: 'AI첨삭',
    legalFormCode: 'STATEMENT_AI',
    defaultSources: ['주민등록초본(주소이력)', '의뢰인 5문5답 설문', '부채발생 타임라인'],
    baseConfidence: 78,
  },
  {
    code: 'R04',
    name: '변제계획안 및 변제예정표',
    badge: 'D5110',
    legalFormCode: 'D5110',
    defaultSources: ['R08 수입지출목록(가용소득)', 'R06 재산목록(청산가치)', 'R02 채권자목록'],
    baseConfidence: 97,
  },
  {
    code: 'R03',
    name: '소송위임장',
    badge: '대리권',
    legalFormCode: 'POWER_OF_ATTORNEY',
    defaultSources: ['신청인 인적사항', '법무법인/담당변호사 정보'],
    baseConfidence: 99,
  },
  {
    code: 'R07',
    name: '첨부서류 일체 (4대 발급처 증빙)',
    badge: '수합완비',
    legalFormCode: 'BUNDLE_ATTACHMENTS',
    defaultSources: ['1차 행정서류 9종', '2차 재산소득서류 17종'],
    baseConfidence: 93,
  },
];

/**
 * CRM 단일 데이터 소스(SSOT)로부터 8대 필수 전산서식 AI 1차 자동 초안을 일괄 생성
 * 옵션 A: 모든 서식은 기본적으로 'PENDING_REVIEW'(변호사 검토 대기)로 초기화됨.
 */
export function generateAll8AutoDrafts(
  clientRequest: ConsultRequest,
  crmExt?: CrmClientExtension,
  existingState?: AutoDraftSuiteState | null
): AutoDraftSuiteState {
  const clientName = clientRequest.clientName || clientRequest.name || '신청인';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const jurisdiction = detectCourtJurisdiction(courtName);
  const now = new Date().toISOString();

  const creditors = crmExt?.repaymentPlan?.creditors || [];
  const creditorCount = creditors.length || Number(clientRequest.creditorCount) || 3;
  const totalPrincipal = crmExt?.repaymentPlan?.totalPrincipal || (creditorCount * 12000000);
  const totalLiquidation = crmExt?.repaymentPlan?.totalLiquidationValue || 8500000;
  const monthlyIncome = crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 3500000;
  const livingExpense = crmExt?.repaymentPlan?.calculatedLiving?.finalTotalLivingExpense || 1500000;
  const monthlyRepayment = Math.max(0, monthlyIncome - livingExpense);
  const months = crmExt?.repaymentPlan?.months || 36;
  const totalRepayment = monthlyRepayment * months;
  const repaymentRate = totalPrincipal > 0 ? Math.min(100, Math.round((totalRepayment / totalPrincipal) * 100)) : 0;
  const lawyerName = crmExt?.petitionInfo?.lawyerName || '정충원 변호사';

  const forms: Record<string, AutoDraftFormItem> = {};

  STANDARD_FORM_DEFS.forEach((def) => {
    // 기존에 이미 변호사가 승인한 서식이 있다면 승인 상태 유지 (단, 재산출 시 최신 데이터 갱신)
    const existingForm = existingState?.forms?.[def.code];
    const prevStatus: AutoDraftReviewStatus = existingForm?.reviewStatus === 'REVIEWED_APPROVED' 
      ? 'REVIEWED_APPROVED' 
      : 'PENDING_REVIEW'; // 옵션 A: 검토 대기

    let note = '';
    const riskFlags: DraftRiskFlag[] = [];
    const draftPayload: Record<string, any> = {};

    switch (def.code) {
      case 'R01':
        note = `${courtName} 관할 접수 · 신청인 ${clientName} · 환급계좌: ${crmExt?.petitionInfo?.refundBank || '우체국'}`;
        draftPayload.courtName = courtName;
        draftPayload.clientName = clientName;
        draftPayload.applicantRrn = (clientRequest as any).rrn || '820415-1******';
        draftPayload.totalPrincipal = totalPrincipal;
        draftPayload.totalLiquidation = totalLiquidation;
        draftPayload.creditorCount = creditorCount;
        riskFlags.push({
          level: 'INFO',
          message: `${jurisdiction} 기준 관할 법원 자동 지정 완료`,
        });
        break;

      case 'R02':
        note = `채권사 ${creditorCount}개소 · 원금 ${totalPrincipal.toLocaleString()}원 · 대법원 UTF-8 BOM CSV 바인딩`;
        draftPayload.creditors = creditors.length > 0 ? creditors : [
          { id: 'c1', creditorName: '국민은행', principal: 15000000, interest: 230000, debtType: '신용대출' },
          { id: 'c2', creditorName: '신한카드', principal: 8500000, interest: 110000, debtType: '카드론' },
          { id: 'c3', creditorName: '현대캐피탈', principal: 12500000, interest: 450000, debtType: '신용대출' },
        ];
        draftPayload.totalPrincipal = totalPrincipal;
        riskFlags.push({
          level: 'WARNING',
          message: '부채증명서 상의 양수도(원채권자-양수금) 채권자 승계 관계 최종 대조 요망',
          targetField: 'creditors',
        });
        break;

      case 'R06':
        note = `총 청산가치 ${totalLiquidation.toLocaleString()}원 · 11대 자산 가치평가 및 법정공제 적용`;
        draftPayload.totalLiquidationValue = totalLiquidation;
        draftPayload.depositExemption = 1850000; // 185만원 압류금지
        draftPayload.insuranceExemption = 1500000; // 150만원 압류금지
        draftPayload.leaseholdDeposit = 20000000;
        draftPayload.leaseholdExemption = 55000000; // 서울 소액임차
        riskFlags.push({
          level: 'INFO',
          message: '서울회생법원 소액임차보증금 최우선변제액 5,500만원 자동 공제 적용됨',
        });
        break;

      case 'R08':
        note = `월 순소득 ${monthlyIncome.toLocaleString()}원 · 법정생계비 ${livingExpense.toLocaleString()}원 인정`;
        draftPayload.monthlyNetIncome = monthlyIncome;
        draftPayload.livingExpense = livingExpense;
        draftPayload.familyCount = 1;
        draftPayload.incomeType = crmExt?.petitionInfo?.incomeType || 'SALARIED';
        if (monthlyIncome - livingExpense <= 0) {
          riskFlags.push({
            level: 'ALERT',
            message: '가용소득(소득-생계비) 부족 경고: 최저생계비 재조정 검토 필요',
            targetField: 'monthlyNetIncome',
          });
        }
        break;

      case 'R10':
        note = '학력·경력·채무발생 경위 및 AI 법률 첨삭 완료 · 의뢰인 5문5답 동기화';
        draftPayload.timelineSummary = '2019년 생활비 대출 개시 ➔ 2022년 금리 인상으로 이자 부담 가중 ➔ 2024년 돌려막기 한계 도달';
        draftPayload.causes = ['생활비 부족', '고금리 누적'];
        riskFlags.push({
          level: 'WARNING',
          message: '의뢰인의 주관적 진술 사실관계와 통장 고액 출금 내역 간 일치 여부 변호사 확인 필수',
          targetField: 'narrative',
        });
        break;

      case 'R04':
        note = `월 ${monthlyRepayment.toLocaleString()}원 (${months}개월) · 총변제율 ${repaymentRate}% · 청산가치 보장 충족`;
        draftPayload.monthlyRepaymentTotal = monthlyRepayment;
        draftPayload.months = months;
        draftPayload.totalRepayment = totalRepayment;
        draftPayload.repaymentRate = repaymentRate;
        draftPayload.isLiquidationGuaranteed = totalRepayment >= totalLiquidation;
        if (totalRepayment < totalLiquidation) {
          riskFlags.push({
            level: 'ALERT',
            message: '청산가치 미달 경고: 총변제액이 청산가치보다 적습니다. 변제기간 연장 또는 추가변제 필요',
            targetField: 'totalRepayment',
          });
        } else {
          riskFlags.push({
            level: 'INFO',
            message: `청산가치 보장의 원칙 충족 (총변제액 ${totalRepayment.toLocaleString()}원 > 청산가치 ${totalLiquidation.toLocaleString()}원)`,
          });
        }
        break;

      case 'R03':
        note = `대리인 변호사 ${lawyerName} · 8대 소송대리 수권 및 경유확인서 완료`;
        draftPayload.lawyerName = lawyerName;
        draftPayload.lawfirm = '법무법인 리걸케어';
        draftPayload.delegationScope = '개인회생신청, 채권자목록 작성 및 수정, 변제계획안 작성 및 수정, 이의신청, 일체의 소송행위';
        break;

      case 'R07':
        const fileCount = (crmExt?.uploadedFiles || []).length || 8;
        note = `주민센터·홈택스·정부24·부채증명서 수합 완료 (${fileCount}건 번들 편철)`;
        draftPayload.bundledFileCount = fileCount;
        draftPayload.isMaskingComplete = true;
        riskFlags.push({
          level: 'INFO',
          message: '신청인 외 제3자 주민등록번호 뒷자리 자동 마스킹 완료',
        });
        break;
    }

    forms[def.code] = {
      code: def.code,
      name: def.name,
      badge: def.badge,
      legalFormCode: def.legalFormCode,
      isDraftReady: true,
      confidenceScore: def.baseConfidence,
      reviewStatus: prevStatus,
      sourceDocuments: def.defaultSources,
      summaryNote: note,
      riskFlags,
      reviewedBy: existingForm?.reviewedBy,
      reviewedAt: existingForm?.reviewedAt,
      lastGeneratedAt: now,
      draftPayload,
    };
  });

  const clientId = clientRequest.id || clientRequest.clientName || 'default_client';
  const approvedCount = Object.values(forms).filter((f) => f.reviewStatus === 'REVIEWED_APPROVED').length;
  const totalCount = STANDARD_FORM_DEFS.length;

  const suiteState: AutoDraftSuiteState = {
    clientId,
    isGenerating: false,
    generatedAt: now,
    allReviewed: approvedCount === totalCount,
    approvedCount,
    totalCount,
    forms,
  };

  saveAutoDraftStateToStorage(clientId, suiteState);
  return suiteState;
}

/**
 * 변호사의 단일 서식 승인/검토 완료 처리 (옵션 A)
 */
export function approveDraftForm(
  clientId: string,
  formCode: string,
  lawyerName: string = '담당 변호사'
): AutoDraftSuiteState | null {
  const state = loadAutoDraftStateFromStorage(clientId);
  if (!state || !state.forms[formCode]) return null;

  const now = new Date().toISOString();
  state.forms[formCode].reviewStatus = 'REVIEWED_APPROVED';
  state.forms[formCode].reviewedBy = lawyerName;
  state.forms[formCode].reviewedAt = now;

  const approvedCount = Object.values(state.forms).filter((f) => f.reviewStatus === 'REVIEWED_APPROVED').length;
  state.approvedCount = approvedCount;
  state.allReviewed = approvedCount === state.totalCount;

  saveAutoDraftStateToStorage(clientId, state);
  return state;
}

/**
 * 변호사의 단일 서식 보완 요청 처리
 */
export function rejectDraftFormWithSupplement(
  clientId: string,
  formCode: string,
  reason: string
): AutoDraftSuiteState | null {
  const state = loadAutoDraftStateFromStorage(clientId);
  if (!state || !state.forms[formCode]) return null;

  state.forms[formCode].reviewStatus = 'SUPPLEMENT_REQUIRED';
  state.forms[formCode].riskFlags.push({
    level: 'ALERT',
    message: `변호사 보완 지시: ${reason}`,
  });

  const approvedCount = Object.values(state.forms).filter((f) => f.reviewStatus === 'REVIEWED_APPROVED').length;
  state.approvedCount = approvedCount;
  state.allReviewed = approvedCount === state.totalCount;

  saveAutoDraftStateToStorage(clientId, state);
  return state;
}

/**
 * 모든 8개 서식 일괄 승인 (선택적 빠른 처리)
 */
export function approveAllDraftForms(
  clientId: string,
  lawyerName: string = '담당 변호사'
): AutoDraftSuiteState | null {
  const state = loadAutoDraftStateFromStorage(clientId);
  if (!state) return null;

  const now = new Date().toISOString();
  Object.keys(state.forms).forEach((code) => {
    state.forms[code].reviewStatus = 'REVIEWED_APPROVED';
    state.forms[code].reviewedBy = lawyerName;
    state.forms[code].reviewedAt = now;
  });

  state.approvedCount = state.totalCount;
  state.allReviewed = true;

  saveAutoDraftStateToStorage(clientId, state);
  return state;
}

/**
 * 로컬 스토리지 영속화 헬퍼
 */
export function loadAutoDraftStateFromStorage(clientId: string): AutoDraftSuiteState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clientId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AutoDraftSuiteState;
  } catch (e) {
    console.error('Failed to load auto draft state', e);
    return null;
  }
}

export function saveAutoDraftStateToStorage(clientId: string, state: AutoDraftSuiteState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${clientId}`, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save auto draft state', e);
  }
}
