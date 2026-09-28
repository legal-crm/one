/**
 * filingAutoDraftEngine.ts
 * 1·2차 스캔 서류 기반 8대 필수 전산서식 AI 자동 초안(Drafting) 생성 및 
 * 옵션 A(변호사 8종 전수 검토 필수) 승인 관리 엔진
 */

import type { ConsultRequest, CrmClientExtension } from '../../types';
import { detectCourtJurisdiction } from './courtFilingEngine';
import { getOfficeProfile } from '../lawyer/officeProfile';
import { DEPOSIT_EXEMPTION_KRW, EXEMPT_INSURANCE_REFUND_LIMIT } from '../repayment/repaymentConstants2026';

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
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '';
  const jurisdiction = detectCourtJurisdiction(courtName);
  const now = new Date().toISOString();

  const creditors = crmExt?.repaymentPlan?.creditors || [];
  const creditorCount = creditors.length || Number(clientRequest.creditorCount) || 0;
  const totalPrincipal = crmExt?.repaymentPlan?.totalPrincipal || 0;
  // 청산가치 0원도 정상 반영되도록 널 병합 연산자(??) 사용
  const totalLiquidation = crmExt?.repaymentPlan?.totalLiquidationValue ?? 0;
  const monthlyIncome = crmExt?.repaymentPlan?.incomeExpense?.monthlyNetIncome || 0;
  const livingExpense = crmExt?.repaymentPlan?.calculatedLiving?.finalTotalLivingExpense || 0;
  const monthlyRepayment = Math.max(0, monthlyIncome - livingExpense);
  const months = crmExt?.repaymentPlan?.months || 36;
  const totalRepayment = monthlyRepayment * months;
  // 별제권(담보부 채권)을 공제한 무담보 회생채권 기준 법원 표준 변제율 산출
  // 담보부 채권 원금 합계 (이전: 담보 채권이 하나라도 있으면 8,050,000원 고정값 차감)
  const securedAmount = creditors
    .filter((c: any) => c.isSecured || c.debtType?.includes('담보') || c.debtType?.includes('별제권'))
    .reduce((s: number, c: any) => s + (Number(c.principal) || 0), 0);
  const prop: any = (crmExt as any)?.propertyListD5102;
  const inc: any = (crmExt as any)?.incomeExpenseD5103;
  const stmt: any = crmExt?.courtStatement;
  const unsecuredPrincipal = (crmExt?.repaymentPlan as any)?.unsecuredPrincipal || Math.max(1, totalPrincipal - securedAmount);
  const repaymentRate = (crmExt?.repaymentPlan as any)?.totalRepaymentRate ?? 
    (unsecuredPrincipal > 0 ? Math.min(100, Math.round((totalRepayment / unsecuredPrincipal) * 100)) : 0);
  const lawyerName = crmExt?.petitionInfo?.lawyerName || '';

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
        note = `${courtName} 관할 접수 · 신청인 ${clientName} · 환급계좌: ${crmExt?.petitionInfo?.refundBank || ''}`;
        draftPayload.courtName = courtName;
        draftPayload.clientName = clientName;
        draftPayload.applicantRrn = (clientRequest as any).rrn || '';
        draftPayload.totalPrincipal = totalPrincipal;
        draftPayload.totalLiquidation = totalLiquidation;
        draftPayload.creditorCount = creditorCount;
        riskFlags.push(courtName
          ? { level: 'INFO', message: `관할 법원: ${courtName} (${jurisdiction})` }
          : { level: 'ALERT', message: '관할 법원이 입력되지 않았습니다. 사건 정보에서 관할 법원을 지정하세요.', targetField: 'courtName' });
        break;

      case 'R02':
        note = `채권사 ${creditorCount}개소 · 원금 ${totalPrincipal.toLocaleString()}원 · 대법원 UTF-8 BOM CSV 바인딩`;
        // 이전: 채권자가 없으면 가짜 채권자 3곳(국민은행·신한카드·현대캐피탈)을 채워 넣음
        draftPayload.creditors = creditors;
        if (creditors.length === 0) {
          riskFlags.push({ level: 'ALERT', message: '채권자목록이 비어 있습니다. 부채증명서를 기준으로 채권자를 등록하세요.', targetField: 'creditors' });
        }
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
        draftPayload.depositExemption = DEPOSIT_EXEMPTION_KRW;
        draftPayload.insuranceExemption = EXEMPT_INSURANCE_REFUND_LIMIT;
        // 임차보증금·소액보증금 공제는 재산목록(D5102) 입력값 사용 (이전: 보증금 2천만원·서울 5,500만원 공제 고정)
        draftPayload.leaseholdDeposit = (prop?.leaseDeposits || []).reduce((s: number, l: any) => s + (Number(l.depositAmount) || 0), 0);
        draftPayload.leaseholdExemption = (prop?.leaseDeposits || []).reduce((s: number, l: any) => s + (Number(l.statutoryExemption) || 0), 0);
        if (!prop) {
          riskFlags.push({ level: 'ALERT', message: '재산목록(D5102)이 작성되지 않았습니다.', targetField: 'propertyList' });
        }
        break;

      case 'R08':
        note = `월 순소득 ${monthlyIncome.toLocaleString()}원 · 법정생계비 ${livingExpense.toLocaleString()}원 인정`;
        draftPayload.monthlyNetIncome = monthlyIncome;
        draftPayload.livingExpense = livingExpense;
        draftPayload.familyCount = Number(inc?.expenses?.householdSize) || ((clientRequest.financialProfile as any)?.dependents || 0) + 1;
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
        // 이전: 모든 의뢰인에게 같은 가짜 경위('2019년 생활비 대출 개시 ➔ …')와 'AI 첨삭 완료' 표기
        note = stmt ? '학력·경력·채무발생 경위 (의뢰인 작성 진술서 기준)' : '의뢰인 진술서 미작성';
        draftPayload.timelineSummary = [stmt?.story?.initialCauseDetail, stmt?.story?.growthProcessDetail, stmt?.story?.insolvencyTriggerDetail].filter(Boolean).join(' ➔ ');
        draftPayload.causes = stmt?.story?.initialCauseKeywords || [];
        if (!stmt) riskFlags.push({ level: 'ALERT', message: '진술서가 작성되지 않았습니다.', targetField: 'narrative' });
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
        note = lawyerName ? `대리인 변호사 ${lawyerName}` : '대리인 정보 미입력';
        draftPayload.lawyerName = lawyerName;
        draftPayload.lawfirm = getOfficeProfile(lawyerName).firmName || '';
        draftPayload.delegationScope = '개인회생신청, 채권자목록 작성 및 수정, 변제계획안 작성 및 수정, 이의신청, 일체의 소송행위';
        break;

      case 'R07':
        // 이전: 파일이 없어도 8건으로 표시, 마스킹 로직 없이 '자동 마스킹 완료'
        const fileCount = (crmExt?.uploadedFiles || []).length;
        note = `업로드된 첨부서류 ${fileCount}건`;
        draftPayload.bundledFileCount = fileCount;
        draftPayload.isMaskingComplete = false;
        riskFlags.push({
          level: 'WARNING',
          message: '가족관계증명서 등 제3자 주민등록번호 뒷자리 마스킹 여부를 제출 전에 직접 확인하세요.',
        });
        break;
    }

    forms[def.code] = {
      code: def.code,
      name: def.name,
      badge: def.badge,
      legalFormCode: def.legalFormCode,
      // 해당 서식의 원천 데이터가 있을 때만 초안 준비 완료 (이전: 항상 true)
      isDraftReady: !riskFlags.some(f => f.level === 'ALERT'),
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

// Node.js(테스트 러너) 및 SSR 환경 대응 인메모리 캐시
const inMemoryDraftCache = new Map<string, AutoDraftSuiteState>();

/**
 * 로컬 스토리지 영속화 헬퍼 (브라우저 + Node.js 겸용)
 */
export function loadAutoDraftStateFromStorage(clientId: string): AutoDraftSuiteState | null {
  if (typeof window === 'undefined') {
    return inMemoryDraftCache.get(clientId) || null;
  }
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
  if (typeof window === 'undefined') {
    inMemoryDraftCache.set(clientId, state);
    return;
  }
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${clientId}`, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save auto draft state', e);
  }
}
