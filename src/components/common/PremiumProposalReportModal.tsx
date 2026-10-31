import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Download, CheckCircle2, ShieldCheck, Scale, Sparkles, 
  Landmark, TrendingDown, Clock, AlertTriangle, AlertCircle, MessageSquare, 
  DollarSign, FileText, ChevronRight, User, Printer, ArrowRight,
  Shield, Check, Phone, Building2, HelpCircle, Layers, Eye,
  BarChart3, Users, Home, CreditCard, Calculator, Percent, Zap
} from 'lucide-react';
import { toast } from 'sonner';

import { 
  RehabCalculationResult, 
  RehabUserInput, 
  formatCurrency, 
  calculateCurrentMonthlyBurden 
} from '../../rehab-chatbot-package/services/calculationService';
import { ProcedureTimeline } from '../../rehab-chatbot-package/components/rehab/ProcedureTimeline';
import { StatComparisonCard, DistributionBar } from '../../rehab-chatbot-package/components/rehab/StatisticalComparison';
import { 
  calculateIncomePercentile, 
  calculateDebtPercentile, 
  calculateReductionRatePercentile 
} from '../../rehab-chatbot-package/utils/statisticsUtils';
import { REHAB_STATISTICS_2025, AVERAGE_VALUES } from '../../rehab-chatbot-package/config/rehabStatistics2025';
import { downloadProposalPdf } from '../../services/proposal/proposalPdf';
import ModalPortal from './ModalPortal';
import { getRecognizedLivingCost2026 } from '../../services/repayment/rehabLegalCore';
import ClientProposalReport from './proposal/ClientProposalReport';
import { proposalFaqs, summarizeProposalInput, type ProposalProcedure, type ProposalSnapshot } from '../../services/proposal/clientProposalModel';
import { isBankruptcyCaseType } from '../../services/cases/caseTypeOf';

// ── 의뢰인 화면 표시 원칙 ──
// 변호사가 작성하지 않은 소견·계획을 기본 문구로 채워 변호사 이름 아래 보여주지 않는다.
const NOT_WRITTEN_TEXT = '변호사가 아직 작성하지 않았습니다.';
/** 관할 법원 정보가 없을 때 표시 (임의 법원명을 넣지 않는다) */
const UNKNOWN_COURT_LABEL = '관할 법원 확인 필요';
/** 소견 없이 발송된 제안서에 저장되는 자리표시 문구 — 변호사가 작성한 소견으로 보지 않는다 */
const PLACEHOLDER_REMARKS = ['제안서 발송'];
/** 변호사 화면(에디터·미리보기)에서만 쓰는 수정 출발용 기본 소견 */
const DEFAULT_LAWYER_COMMENT = '제출해 주신 소득·부양가족·채무 정보를 기준으로 개인회생 진행 방향을 검토했습니다. 신청 시 금지·중지명령을 함께 신청해 추심 부담을 줄이는 방안을 검토하고, 관할법원 실무에 맞는 변제계획안을 준비하겠습니다. 실제 개시·인가 여부는 법원 심리와 제출 서류에 따라 결정됩니다.';
/** 변호사 화면(에디터·미리보기)에서만 쓰는 수정 출발용 기본 계획 */
const DEFAULT_SPECIAL_NOTES = [
  '서류가 준비되는 대로 신청서와 금지명령 신청을 함께 준비합니다.',
  '최근 대출금 사용처 소명 자료(금융거래내역 등) 준비를 안내해 드립니다.',
  '법원의 보정권고에는 담당 변호사가 검토 후 대응합니다.'
];
/** 수임 계약 이후의 상담 단계 — 이 단계에서는 '전자계약 진행' 버튼을 보여주지 않는다 */
const CONTRACTED_REQUEST_STATUSES = ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];
/** 제안서의 진행 가능성 문구 → 진단 상태 (변호사가 발송 시 남긴 값) */
const FEASIBILITY_STATUS: Record<string, RehabCalculationResult['status']> = {
  '진행 가능': 'POSSIBLE',
  '진행 어려움': 'DIFFICULT',
  '진행 불가': 'IMPOSSIBLE',
};

/** 앞에서부터 실제로 작성된(빈 값·자리표시 문구가 아닌) 문자열을 고른다 */
function pickAuthoredText(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && !PLACEHOLDER_REMARKS.includes(trimmed)) return candidate;
  }
  return '';
}

export interface PremiumReportData {
  lawyerInfo?: {
    name: string;
    firmName?: string;
    avatar?: string;
    phone?: string;
  };
  clientName?: string;
  diagnosis: {
    monthlyPayment: number;
    repaymentMonths: number;
    debtReductionRate: number;
    totalDebt: number;
    totalRepayment: number;
    estimatedReduction: number;
    status: string;
    statusReason?: string;
    court: string;
  };
  fees: {
    totalFee: number;
    downPayment: number;
    installments: number;
    monthlyInstallment: number;
    courtDeposit: number;
    additionalCostsNotice?: string;
    isInstallmentAvailable?: boolean;
    feeMemo?: string;
  };
  lawyerComment?: string;
  lawyerOpinion?: string;
  proposalId?: string;
  createdAt?: string;
  expiresAt?: string;
  clientInput?: RehabUserInput;
  calculationResult?: RehabCalculationResult;
  specialNotes?: string[];
  recommendedStrategy?: string;
  clientQnA?: Array<{ question: string; answer: string; }>;
  aiInsights?: any;
  /** 제안서 절차 (B-5d) */
  procedure?: ProposalProcedure;
  validDays?: number;
  snapshot?: ProposalSnapshot;
}

export interface PremiumProposalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: PremiumReportData;
  proposal?: any;
  clientInfo?: any;
  userInput?: RehabUserInput;
  calcResult?: RehabCalculationResult;
  reportId?: string;
  onAcceptProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onContactLawyer?: (lawyerInfo: any) => void;
  onAppointLawyer?: () => void;
  /** false면 변호사 미리보기 화면. 생략하면 의뢰인 화면으로 본다 */
  isClientViewer?: boolean;
  isAppointed?: boolean;
  /** 이 상담 요청의 수임 계약이 이미 완료(서명)된 경우 true — '전자계약 진행' 버튼 대신 완료 안내를 표시한다 */
  isContracted?: boolean;
  embedded?: boolean;
  isLawyerEditor?: boolean;
  /** 'client' = 의뢰인용 한 줄 스크롤 화면(B-5c), 'classic' = 탭 화면(변호사 편집). 생략하면 의뢰인 화면일 때 'client' */
  layout?: 'client' | 'classic';
  /** 의뢰인이 제안서에서 질문·정정을 보내면 상담방 입력창에 넣는다 */
  onAskLawyer?: (text: string) => void;
  onApplyChanges?: (updatedData: {
    monthlyPayment: number;
    repaymentMonths: number;
    debtReductionRate: number;
    lawyerOpinion: string;
    specialNotes?: string[];
  }) => void;
}

export const PremiumProposalReportModal: React.FC<PremiumProposalReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  proposal: proposalProp,
  clientInfo,
  userInput: userInputProp,
  calcResult: calcResultProp,
  reportId = `RPT-${Date.now()}`,
  onAcceptProposal,
  onRejectProposal,
  onContactLawyer,
  onAppointLawyer,
  isClientViewer = true,
  isContracted = false,
  embedded = false,
  isLawyerEditor = false,
  layout,
  onAskLawyer,
  onApplyChanges
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'statistics' | 'roadmap' | 'faq'>('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, embedded, onClose]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen && !embedded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, embedded]);

  // 1. AI 정밀 진단서 여부 감지 (isAIPremium)
  const rawAiInsights = 
    proposalProp?.proposalData?.aiInsights || 
    proposalProp?.aiInsights || 
    reportData?.aiInsights || 
    (reportData as any)?.rawAiInsights;
  const isAIPremium = Boolean(rawAiInsights?.isAIPremium);

  // AI 전용 탭에서 일반 제안서로 바뀔 때 overview로 리셋
  useEffect(() => {
    if (!isAIPremium && (activeTab === 'statistics' || activeTab === 'faq')) {
      setActiveTab('overview');
    }
  }, [isAIPremium, activeTab]);

  // 의뢰인 화면 여부 — 변호사 에디터(isLawyerEditor)·변호사 미리보기(isClientViewer=false)가 아니면 의뢰인 화면
  const isClientView = isClientViewer && !isLawyerEditor;

  // 2. Unify and normalize props across reportData & proposal & clientInfo
  const lawyerName = 
    reportData?.lawyerInfo?.name || 
    proposalProp?.attorneyReview?.reviewerName || 
    proposalProp?.lawyerName || 
    proposalProp?.lawyer?.name || 
    '담당 변호사';

  // 가짜 사무소명·사진·전화번호로 채우지 않는다 — 변호사가 입력한 정보만 표시
  const lawyerFirmName: string = 
    reportData?.lawyerInfo?.firmName || 
    proposalProp?.attorneyReview?.firmName || 
    proposalProp?.firmName || 
    proposalProp?.lawyer?.firmName || 
    '';

  const lawyerAvatar: string = 
    reportData?.lawyerInfo?.avatar || 
    proposalProp?.lawyerAvatar || 
    proposalProp?.lawyer?.avatar || 
    '';

  const lawyerPhone: string = 
    reportData?.lawyerInfo?.phone || 
    proposalProp?.lawyerPhone || 
    proposalProp?.lawyer?.phone || 
    '';

  const clientName = 
    reportData?.clientName || 
    proposalProp?.clientName || 
    clientInfo?.clientName || 
    clientInfo?.name || 
    '의뢰인';

  // 관할 법원은 저장된 실제 값만 쓴다. 없으면 임의 법원(예: 서울회생법원)을 넣지 않고 '확인 필요'로 표시
  const rawCourt: string = String(
    reportData?.diagnosis?.court || 
    proposalProp?.diagnosis?.court || 
    proposalProp?.proposalData?.diagnosis?.court || 
    proposalProp?.court || 
    clientInfo?.court || 
    clientInfo?.financialProfile?.selectedCourt || 
    ''
  ).trim();
  const isCourtKnown = rawCourt.length > 0;
  const courtName = !isCourtKnown
    ? UNKNOWN_COURT_LABEL
    : rawCourt.includes('법원') ? rawCourt : `${rawCourt}회생법원`;
  // 문장 안에 넣을 때 쓰는 표현 (미확인이면 '관할 법원')
  const courtPhrase = isCourtKnown ? courtName : '관할 법원';

  // Currency normalizer:
  const normalizeToWon = (val: number | undefined | null): number => {
    if (!val || isNaN(val)) return 0;
    return val < 10000 ? Math.round(val * 10000) : Math.round(val);
  };

  const rawTotalDebt = 
    reportData?.diagnosis?.totalDebt ?? 
    proposalProp?.diagnosis?.totalDebt ?? 
    proposalProp?.proposalData?.diagnosis?.totalDebt ?? 
    proposalProp?.totalDebt ?? 
    clientInfo?.totalDebt;
  // financialProfile.debtTotal은 항상 만원 단위 — normalizeToWon(1만 미만만 만원으로 간주)을 거치면
  // 1억 원(1만 만원) 이상 채무가 원 단위로 오인되므로, 이 값은 직접 원으로 바꾼다
  const profileDebtTotalManWon = Number(clientInfo?.financialProfile?.debtTotal);
  const profileDebtTotalWon = Number.isFinite(profileDebtTotalManWon) && profileDebtTotalManWon > 0
    ? Math.round(profileDebtTotalManWon * 10000)
    : 0;

  const rawMonthlyPayment = 
    reportData?.diagnosis?.monthlyPayment ?? 
    proposalProp?.diagnosis?.monthlyPayment ?? 
    proposalProp?.monthlyPayment ?? 
    clientInfo?.monthlyPayment ?? 
    0;

  // 발송된 제안서(ConsultProposal)는 변제 기간을 duration에 저장한다 — 변호사가 제안한 기간을 우선 사용
  const repaymentMonths = 
    reportData?.diagnosis?.repaymentMonths || 
    proposalProp?.diagnosis?.repaymentMonths || 
    proposalProp?.proposalData?.diagnosis?.repaymentMonths || 
    proposalProp?.repaymentMonths || 
    proposalProp?.duration || 
    clientInfo?.repaymentMonths || 
    36;

  const rawEstimatedReduction = 
    reportData?.diagnosis?.estimatedReduction ?? 
    proposalProp?.diagnosis?.estimatedReduction ?? 
    proposalProp?.estimatedReduction;

  const rawDebtReductionRate = 
    reportData?.diagnosis?.debtReductionRate ?? 
    proposalProp?.diagnosis?.debtReductionRate ?? 
    proposalProp?.debtReductionRate ?? 
    0;

  const totalDebt = rawTotalDebt != null ? normalizeToWon(rawTotalDebt) : profileDebtTotalWon;
  const monthlyPayment = normalizeToWon(rawMonthlyPayment);
  const totalRepaymentCalculated = monthlyPayment * repaymentMonths;
  const estimatedReduction = rawEstimatedReduction !== undefined && rawEstimatedReduction > 0
    ? normalizeToWon(rawEstimatedReduction)
    : Math.max(0, totalDebt - totalRepaymentCalculated);

  const debtReductionRate = totalDebt > 0 
    ? Math.min(100, Math.max(0, Math.round((estimatedReduction / totalDebt) * 100))) 
    : (rawDebtReductionRate || 0);

  // 제안서 스냅샷 (B-5d, 발송 때 저장) — 있으면 확정값·입력 요약·유효기간을 이 값으로 쓴다
  const snapshot: ProposalSnapshot | undefined =
    (proposalProp?.snapshot && proposalProp.snapshot.v === 1 ? proposalProp.snapshot : undefined) ||
    ((reportData as any)?.snapshot && (reportData as any).snapshot.v === 1 ? (reportData as any).snapshot : undefined);
  const procedure: ProposalProcedure =
    snapshot?.procedure ||
    (proposalProp?.procedureType === 'bankruptcy' || (reportData as any)?.procedure === 'bankruptcy' ? 'bankruptcy' : undefined) ||
    (isBankruptcyCaseType(null, clientInfo) ? 'bankruptcy' : 'rehab');

  // ── 고객 상황 맞춤형 동적 FAQ 추출 로직 ──
  const effectiveUserInput = useMemo(() => {
    return (
      userInputProp || 
      reportData?.clientInput || 
      (proposalProp as any)?.clientInput || 
      (proposalProp as any)?.userInput || 
      (clientInfo as any)?.userInput || 
      {}
    );
  }, [userInputProp, reportData, proposalProp, clientInfo]);

  // 상황별 질문과 답 — 의뢰인 화면과 같은 중립 문구 한 곳(clientProposalModel.proposalFaqs)에서 가져온다 (B-5b)
  // (이전: 이모지 배지, "전혀 아닙니다!", "기각 없이 안전하게", 2026 고정 수치 등)
  const personalizedFaqs = useMemo(() => {
    const merged = { ...((clientInfo as any)?.financialProfile || {}), ...effectiveUserInput };
    return proposalFaqs(procedure, merged).map(f => ({
      q: f.q,
      a: f.a,
      badge: { label: f.tag || '공통', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      tip: undefined as string | undefined,
    }));
  }, [effectiveUserInput, clientInfo, procedure]);

  // Fees
  const rawFees = reportData?.fees || proposalProp?.fees || proposalProp || {};
  // 변호사가 입력하지 않은 수임료 항목은 0(미정)으로 두고 화면에서 '협의'로 표시한다
  const rawTotalFee = rawFees.totalFee ?? proposalProp?.totalFee ?? proposalProp?.fee ?? 0;
  const rawDownPayment = rawFees.downPayment ?? proposalProp?.downPayment ?? 0;
  const rawMonthlyInstallment = rawFees.monthlyInstallment ?? proposalProp?.monthlyInstallment ?? 0;
  const rawCourtDeposit = rawFees.courtDeposit ?? proposalProp?.courtDeposit ?? 0;
  const installments = rawFees.installments ?? proposalProp?.installments ?? 0;
  const additionalCostsNotice = rawFees.additionalCostsNotice || proposalProp?.additionalCostsNotice || proposalProp?.feeMemo;

  const totalFeeWon = normalizeToWon(rawTotalFee);
  const downPaymentWon = normalizeToWon(rawDownPayment);
  const monthlyInstallmentWon = normalizeToWon(rawMonthlyInstallment);
  const courtDepositWon = normalizeToWon(rawCourtDeposit);

  // Lawyer Comments & Notes
  // 변호사가 실제로 작성·저장한 소견만 '작성됨'으로 본다 (빈 값·'제안서 발송' 같은 자리표시 문구 제외)
  const authoredLawyerComment = pickAuthoredText(
    reportData?.lawyerComment,
    reportData?.lawyerOpinion,
    proposalProp?.lawyerComment,
    proposalProp?.lawyerOpinion,
    proposalProp?.opinion,
    proposalProp?.remark,
    proposalProp?.proposalData?.lawyerOpinion
  );
  const hasAuthoredLawyerComment = authoredLawyerComment.length > 0;
  // 변호사 화면에서는 기본 문구를 수정 출발점으로 유지하고, 의뢰인 화면에는 작성된 소견만 보여준다
  const lawyerComment = authoredLawyerComment || (isClientView ? '' : DEFAULT_LAWYER_COMMENT);
  const isLawyerCommentMissing = isClientView && !hasAuthoredLawyerComment;

  // Lawyer Editing State (isLawyerEditor mode)
  const [editMonthlyPayment, setEditMonthlyPayment] = useState(monthlyPayment);
  const [editRepaymentMonths, setEditRepaymentMonths] = useState(repaymentMonths);
  const [editLawyerComment, setEditLawyerComment] = useState(lawyerComment);
  const [isEditingOpen, setIsEditingOpen] = useState(false);

  useEffect(() => {
    setEditMonthlyPayment(monthlyPayment);
  }, [monthlyPayment]);

  useEffect(() => {
    setEditRepaymentMonths(repaymentMonths);
  }, [repaymentMonths]);

  useEffect(() => {
    setEditLawyerComment(lawyerComment);
  }, [lawyerComment]);

  // 변호사 직접 수정값으로 다시 계산한 총 변제액
  const editTotalRepayment = editMonthlyPayment * editRepaymentMonths;
  const editEstimatedReduction = Math.max(0, totalDebt - editTotalRepayment);
  const editDebtReductionRate = totalDebt > 0 
    ? Math.min(100, Math.max(0, Math.round((editEstimatedReduction / totalDebt) * 100))) 
    : 0;

  const handleApplyChangesToDraft = () => {
    if (onApplyChanges) {
      onApplyChanges({
        monthlyPayment: editMonthlyPayment,
        repaymentMonths: editRepaymentMonths,
        debtReductionRate: editDebtReductionRate,
        lawyerOpinion: editLawyerComment,
        specialNotes
      });
      toast.success('수정된 AI 분석 및 변제 조건이 제안서에 반영되었습니다.');
      onClose();
    }
  };

  const rawSpecialNotes: unknown = 
    reportData?.specialNotes || 
    proposalProp?.specialNotes || 
    proposalProp?.proposalData?.specialNotes;
  // 의뢰인 화면: 변호사가 작성한 계획만 표시 (기본 계획 문구로 채우지 않음)
  // 변호사 화면: 기존처럼 저장값이 없으면 기본 계획을 수정 출발점으로 표시
  const specialNotes: string[] = isClientView
    ? (Array.isArray(rawSpecialNotes)
        ? rawSpecialNotes.filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
        : [])
    : (Array.isArray(rawSpecialNotes) ? rawSpecialNotes as string[] : DEFAULT_SPECIAL_NOTES);

  const clientQnA: Array<{ question: string; answer: string }> = 
    proposalProp?.clientQnA || [];

  const proposalId = 
    reportData?.proposalId || 
    proposalProp?.id || 
    proposalProp?.proposalId;

  // Calculation Result Fallback
  const clientInput = reportData?.clientInput || userInputProp;
  const calculationResult = reportData?.calculationResult || calcResultProp;

  // 계산 결과가 없을 때의 보조값 — 2026 법원 인정 생계비 기준표(가구원 수) 사용
  const fallbackFamilySize = Math.max(1, Number((clientInput as any)?.familySize) || 1);
  const fallbackLivingCost = getRecognizedLivingCost2026(fallbackFamilySize);
  const fallbackAdvice = useMemo(() => [
    isCourtKnown
      ? `${courtName} 실무준칙을 참고해 변제계획을 검토했습니다.`
      : '관할 법원이 확인되지 않아 일반적인 실무 기준으로 계산한 예상치입니다. 관할 법원이 정해지면 변제계획이 달라질 수 있습니다.',
    `예상 월 변제금 ${formatCurrency(monthlyPayment)}원, ${repaymentMonths}개월 기준 총 변제액은 약 ${formatCurrency(totalRepaymentCalculated)}원입니다. 실제 금액은 법원 심리에 따라 달라질 수 있습니다.`
  ], [isCourtKnown, courtName, monthlyPayment, repaymentMonths, totalRepaymentCalculated]);
  const fallbackCourtDescription = isCourtKnown ? `${courtName} 실무준칙 종합 적용` : UNKNOWN_COURT_LABEL;

  // 진단 상태는 변호사가 제안서에 남긴 값을 우선 사용한다 (없을 때만 기존 기본값)
  const rawProposalStatus =
    reportData?.diagnosis?.status ||
    proposalProp?.diagnosis?.status ||
    proposalProp?.proposalData?.diagnosis?.status ||
    FEASIBILITY_STATUS[String(proposalProp?.feasibility || '').trim()];
  const proposalStatus: RehabCalculationResult['status'] =
    rawProposalStatus === 'POSSIBLE' || rawProposalStatus === 'DIFFICULT' || rawProposalStatus === 'IMPOSSIBLE'
      ? rawProposalStatus
      : 'POSSIBLE';

  const activeCalcResult: RehabCalculationResult = useMemo(() => {
    const cr = calculationResult as any;
    if (cr && (cr.totalDebt || cr.monthlyPayment)) {
      return {
        ...cr,
        monthlyPayment: cr.monthlyPayment || monthlyPayment,
        totalRepayment: cr.totalRepayment || cr.totalPayment || totalRepaymentCalculated,
        totalPayment: cr.totalPayment || cr.totalRepayment || totalRepaymentCalculated,
        repaymentMonths: cr.repaymentMonths || repaymentMonths,
        debtReductionRate: cr.debtReductionRate ?? cr.reductionRate ?? debtReductionRate,
        reductionRate: cr.reductionRate ?? cr.debtReductionRate ?? debtReductionRate,
        totalDebtReduction: cr.totalDebtReduction ?? cr.reductionAmount ?? estimatedReduction,
        reductionAmount: cr.reductionAmount ?? cr.totalDebtReduction ?? estimatedReduction,
        totalDebt: cr.totalDebt || totalDebt,
        courtName: cr.courtName || courtName,
        court: cr.court || courtName,
        courtDescription: cr.courtDescription || fallbackCourtDescription,
        status: cr.status || 'POSSIBLE',
        statusReason: cr.statusReason || '변호사 제안 조건 기준 예상치',
        availableIncome: cr.availableIncome || monthlyPayment,
        recognizedLivingCost: cr.recognizedLivingCost || fallbackLivingCost,
        baseLivingCost: cr.baseLivingCost || fallbackLivingCost,
        additionalLivingCost: cr.additionalLivingCost || 0,
        liquidationValue: cr.liquidationValue || 0,
        processingMonths: cr.processingMonths || 6,
        aiAdvice: cr.aiAdvice || fallbackAdvice,
        riskWarnings: cr.riskWarnings || [],
        exemptDeposit: cr.exemptDeposit || 0,
        regionGroup: cr.regionGroup || 'etc',
        alerts: cr.alerts || [],
      } as RehabCalculationResult;
    }
    const currentBurden = clientInput 
      ? calculateCurrentMonthlyBurden(clientInput as any)
      : Math.round(totalDebt * 0.04);

    // 소득 미입력 시 임의 금액(280만)을 넣지 않는다. 생계비는 2026 법원 기준표(가구원 수)로만 산정.
    const monthlyIncome = normalizeToWon(clientInput?.monthlyIncome);
    const recognizedLivingCost = fallbackLivingCost;
    const availableIncome = monthlyIncome > 0 ? Math.max(0, monthlyIncome - recognizedLivingCost) : monthlyPayment;

    return {
      monthlyPayment: monthlyPayment,
      totalPayment: totalRepaymentCalculated,
      totalRepayment: totalRepaymentCalculated,
      repaymentMonths: repaymentMonths,
      debtReductionRate: debtReductionRate,
      reductionRate: debtReductionRate,
      totalDebtReduction: estimatedReduction,
      reductionAmount: estimatedReduction,
      totalDebt: totalDebt,
      currentMonthlyBurden: currentBurden,
      court: courtName,
      courtName: courtName,
      courtDescription: fallbackCourtDescription,
      status: proposalStatus,
      statusReason: '변호사 제안 조건 기준 예상치',
      reasons: [],
      eligibleProcedures: ['individual_rehabilitation'],
      monthlyIncome: monthlyIncome,
      recognizedLivingCost: recognizedLivingCost,
      baseLivingCost: recognizedLivingCost,
      additionalLivingCost: 0,
      availableIncome: availableIncome,
      dependentsCount: clientInput?.dependentsCount || 1,
      liquidationValue: 0,
      processingMonths: 6,
      aiAdvice: fallbackAdvice,
      riskWarnings: [],
      exemptDeposit: 0,
      regionGroup: 'etc',
      alerts: [],
    } as RehabCalculationResult;
  }, [calculationResult, totalDebt, monthlyPayment, repaymentMonths, estimatedReduction, debtReductionRate, clientInput, courtName, totalRepaymentCalculated, fallbackLivingCost, fallbackAdvice, fallbackCourtDescription, proposalStatus]);

  // 현재 월 상환 부담 — 실제 납부액 자료가 없어 항상 추정치다. 화면에는 산정 근거를 함께 표시하고, 값이 없으면 숨긴다.
  const currentMonthlyBurden = Number(activeCalcResult.currentMonthlyBurden) || 0;
  const hasCurrentBurdenEstimate = currentMonthlyBurden > 0;
  const hasCalcBurdenSource = Boolean(
    clientInput ||
    ((calculationResult as any) && ((calculationResult as any).totalDebt || (calculationResult as any).monthlyPayment))
  );
  const currentBurdenBasis = hasCalcBurdenSource
    ? '추정: 36개월 원리금균등상환·이자율 가정 기준'
    : '추정: 총 채무의 4% 기준';

  const activeUserInput: RehabUserInput = useMemo(() => {
    if (clientInput) {
      return {
        ...clientInput,
        name: clientInput.name || clientName,
        totalDebt: clientInput.totalDebt || totalDebt,
        monthlyIncome: clientInput.monthlyIncome || (activeCalcResult as any).monthlyIncome || 0,
        familySize: clientInput.familySize || ((activeCalcResult as any).dependentsCount || 1),
      };
    }
    return {
      address: '서울특별시',
      employmentType: 'salary',
      isMarried: false,
      deposit: 0,
      myAssets: 0,
      spouseAssets: 0,
      monthlyIncome: (activeCalcResult as any).monthlyIncome || 0,
      familySize: (activeCalcResult as any).dependentsCount || 1,
      totalDebt: totalDebt,
      name: clientName,
    };
  }, [clientInput, clientName, activeCalcResult, totalDebt]);

  // PDF: '변호사 검토 제안서' 1종, 서버 글자 PDF (B-5e). 이전: 7쪽/2쪽 두 양식을 html2canvas 그림으로 저장
  const handleExportPDF = async () => {
    setIsGeneratingPdf(true);
    const toastId = toast.loading('변호사 검토 제안서 PDF를 만들고 있어요...');
    try {
      const r: any = activeCalcResult || {};
      const analysisRows = isAIPremium ? [
        r.recognizedLivingCost ? { label: '인정 생계비(월)', value: `${Math.round(r.recognizedLivingCost).toLocaleString('ko-KR')}원` } : null,
        r.availableIncome ? { label: '가용 소득(월)', value: `${Math.round(r.availableIncome).toLocaleString('ko-KR')}원` } : null,
        r.liquidationValue ? { label: '청산가치', value: `${Math.round(r.liquidationValue).toLocaleString('ko-KR')}원` } : null,
        r.priorityRepayment ? { label: '조세 등 우선채권', value: `${Math.round(r.priorityRepayment).toLocaleString('ko-KR')}원` } : null,
        r.planReason ? { label: '기간 판단 근거', value: String(r.planReason) } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }> : undefined;
      const res = await downloadProposalPdf({
        documentId: proposalId,
        issuedAt: snapshot?.issuedAt || proposalProp?.createdAt || reportData?.createdAt,
        validDays: snapshot?.validDays || Number(proposalProp?.validDays) || 30,
        lawyerName: lawyerName || '담당 변호사',
        lawyerFirmName,
        clientLabel: isClientView ? '본인' : (clientName || '의뢰인'),
        procedure: procedure === 'bankruptcy' ? '개인파산·면책' : '개인회생',
        courtName,
        totalDebt,
        monthlyPayment: procedure === 'bankruptcy' ? 0 : (snapshot?.confirmed?.monthlyPaymentWon ?? monthlyPayment),
        repaymentMonths: procedure === 'bankruptcy' ? 0 : (snapshot?.confirmed?.months ?? repaymentMonths),
        totalRepayment: procedure === 'bankruptcy' ? 0 : (snapshot?.confirmed?.totalRepaymentWon ?? totalRepaymentCalculated),
        lawyerOpinion: lawyerComment || NOT_WRITTEN_TEXT,
        specialNotes,
        totalFeeWon,
        downPaymentWon,
        monthlyInstallmentWon,
        installments,
        additionalCostsNotice,
        includeAnalysis: !!isAIPremium,
        analysisRows,
      });
      if (res.ok === false) { toast.error(res.message, { id: toastId }); return; }
      toast.success('변호사 검토 제안서 PDF를 저장했어요.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 계약이 이미 끝난 상담이면 '전자계약 진행' 대신 완료 안내를 보여준다
  const isContractDone = isContracted || CONTRACTED_REQUEST_STATUSES.includes(String(clientInfo?.status || ''));

  const handleAccept = () => {
    if (isContractDone) return;
    if (onAcceptProposal && proposalId) {
      onAcceptProposal(proposalId);
    } else if (onAppointLawyer) {
      onAppointLawyer();
    } else {
      // 처리할 수 있는 연결(콜백·제안서 ID)이 없으면 수락된 것처럼 안내하지 않는다
      toast.error('제안서 정보를 확인하지 못해 계약을 진행할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (!isOpen && !embedded) return null;

  // ── 의뢰인용 한 줄 스크롤 화면 (B-5c·B-5d) ──
  const useClientLayout = !isLawyerEditor && (layout === 'client' || (layout !== 'classic' && isClientView));
  if (useClientLayout) {
    const conf = snapshot?.confirmed;
    const fp: any = (clientInfo as any)?.financialProfile || {};
    // 스냅샷이 없는 이전 제안서: 계산 입력값 → 상담 요청 정리 자료(만원 단위) 순으로 요약
    const fallbackInput = clientInput
      ? summarizeProposalInput(clientInput, isCourtKnown ? courtName : '')
      : summarizeProposalInput({
          familySize: fp.dependents || fp.familySize,
          monthlyIncome: Number(fp.income) > 0 ? Number(fp.income) * 10000 : undefined,
          totalDebt: profileDebtTotalWon || totalDebt || undefined,
          employmentType: fp.incomeType,
          housingType: fp.housingType,
          creditorCount: fp.creditorCount,
        }, isCourtKnown ? courtName : '');
    const r: any = activeCalcResult || {};
    const rows = isAIPremium ? [
      r.recognizedLivingCost ? { label: '인정 생계비(월)', value: `${Math.round(r.recognizedLivingCost).toLocaleString('ko-KR')}원`, termKey: 'livingCost' } : null,
      r.availableIncome ? { label: '가용소득(월)', value: `${Math.round(r.availableIncome).toLocaleString('ko-KR')}원`, termKey: 'disposableIncome' } : null,
      r.liquidationValue ? { label: '청산가치', value: `${Math.round(r.liquidationValue).toLocaleString('ko-KR')}원`, termKey: 'liquidationValue' } : null,
      r.priorityRepayment ? { label: '우선채권', value: `${Math.round(r.priorityRepayment).toLocaleString('ko-KR')}원`, termKey: 'priorityClaim' } : null,
      r.planReason ? { label: '기간을 정한 이유', value: String(r.planReason) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string; termKey?: string }> : undefined;
    const report = (
      <ClientProposalReport
        procedure={procedure}
        lawyerName={lawyerName}
        lawyerFirmName={lawyerFirmName}
        lawyerAvatar={lawyerAvatar}
        lawyerPhone={isClientView ? lawyerPhone : ''}
        courtName={courtName}
        isCourtKnown={isCourtKnown}
        issuedAt={snapshot?.issuedAt || proposalProp?.createdAt || reportData?.createdAt}
        validDays={snapshot?.validDays || Number(proposalProp?.validDays) || reportData?.validDays || undefined}
        expiresAt={snapshot?.expiresAt || proposalProp?.expiresAt || reportData?.expiresAt}
        totalDebtWon={totalDebt}
        monthlyPaymentWon={conf ? conf.monthlyPaymentWon : monthlyPayment}
        months={conf ? conf.months : repaymentMonths}
        totalRepaymentWon={conf ? conf.totalRepaymentWon : totalRepaymentCalculated}
        input={snapshot?.input || fallbackInput}
        lawyerComment={isClientView ? authoredLawyerComment : lawyerComment}
        specialNotes={specialNotes}
        clientQnA={(reportData?.clientQnA || clientQnA || []).filter((q: any) => q && q.question)}
        fees={{
          totalFeeWon, downPaymentWon, installments, monthlyInstallmentWon, courtDepositWon,
          notice: typeof additionalCostsNotice === 'string' ? additionalCostsNotice : undefined,
        }}
        analysisRows={rows}
        faqInput={{ ...fp, ...effectiveUserInput }}
        isContractDone={isContractDone}
        canAccept={!!(onAcceptProposal || onAppointLawyer)}
        onAccept={handleAccept}
        onAskLawyer={onAskLawyer || (onContactLawyer ? () => onContactLawyer({ name: lawyerName, firmName: lawyerFirmName, phone: lawyerPhone }) : undefined)}
        onExportPdf={handleExportPDF}
        isGeneratingPdf={isGeneratingPdf}
        onClose={embedded ? undefined : onClose}
        preview={!isClientView}
      />
    );
    if (embedded) return <div className="w-full rounded-3xl overflow-hidden border border-slate-200">{report}</div>;
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 flex items-stretch sm:items-center justify-center sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="report-modal-title" className="relative w-full sm:max-w-3xl bg-slate-50 sm:rounded-3xl shadow-2xl overflow-y-auto h-full sm:h-auto sm:max-h-[calc(100vh-2.5rem)]">
            {report}
          </div>
        </div>
      </ModalPortal>
    );
  }

  const modalContent = (
    <div className={embedded ? "w-full" : "fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"}>
      {/* Main Modal Container */}
      <div 
        className={`relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${embedded ? '' : 'max-h-[calc(100vh-2.5rem)]'} animate-in fade-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        {/* Top Header Bar */}
        <div className="bg-slate-950 text-white px-5 sm:px-8 py-5 border-b border-slate-800 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            {/* Lawyer and Client Profile Badges */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {lawyerAvatar ? (
                  <img 
                    src={lawyerAvatar} 
                    alt={lawyerName} 
                    className={`w-13 h-13 rounded-full object-cover ring-2 shadow-md ${
                      isAIPremium ? 'ring-amber-400/80' : 'ring-blue-500/60'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-13 h-13 rounded-full bg-gradient-to-br from-blue-600 to-[#1E3A5F] text-white flex items-center justify-center font-black text-lg ring-2 shadow-md ${
                      isAIPremium ? 'ring-amber-400/80' : 'ring-blue-500/60'
                    }`}
                    aria-hidden="true"
                  >
                    {lawyerName.charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ring-2 ring-slate-950 ${
                  isAIPremium ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAIPremium ? (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#1E3A5F]/70 text-blue-200 border border-blue-400/30 shadow-2xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                      AI 분석 리포트 & 변호사 제안서
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-400" />
                      변호사 검토 제안서
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    가명 안심 보호 중
                  </span>
                </div>
                
                <h2 id="report-modal-title" className="text-lg sm:text-xl font-black text-white mt-1.5 flex items-center gap-2">
                  <span>{isAIPremium ? `${clientName}님의 개인회생 AI 분석 리포트` : `${clientName}님을 위한 변호사 제안서`}</span>
                  <span className="text-sm font-normal text-slate-300">· {lawyerName}{lawyerFirmName ? ` (${lawyerFirmName})` : ''}</span>
                </h2>
                
                <p className="text-xs text-slate-400 mt-0.5">
                  수신: <span className="text-slate-200 font-semibold">{clientName}</span> 님 귀하 | 관할: <span className="text-slate-200 font-semibold">{courtName}</span>
                  {isAIPremium ? (
                    <span className="text-blue-300 font-semibold ml-2">✦ 규칙 기반 맞춤 진단</span>
                  ) : (
                    <span className="text-emerald-300 font-semibold ml-2">⚖️ 담당 변호사 검토 의견</span>
                  )}
                </p>

                {/* 관할 법원 표시 */}
                {isAIPremium && rawAiInsights?.courtStats?.courtName && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30 font-semibold">
                      🏛️ 관할 {rawAiInsights.courtStats.courtName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick KPI Bar & Action Buttons */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <button
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border active:scale-[0.98] disabled:opacity-50 whitespace-nowrap bg-[#1E3A5F] hover:bg-[#162A45] text-white border-blue-400/30 shadow-xs cursor-pointer"
                title="진단서 PDF 저장"
              >
                <Download className="w-4 h-4 text-blue-200" />
                <span>{isGeneratingPdf ? 'PDF 생성 중...' : isAIPremium ? 'AI 7p 리포트 PDF 저장' : '변호사 의견서 PDF 저장 (2p)'}</span>
              </button>

              {isLawyerEditor && (
                <button
                  onClick={() => setIsEditingOpen(!isEditingOpen)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition border active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                    isEditingOpen
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 hover:bg-indigo-500/30'
                  }`}
                  title="변호사 직접 수정"
                >
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                  <span>{isEditingOpen ? '수정창 닫기' : '변호사 직접 수정'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-[0.98] cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Executive Summary Ribbon */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">총 채무액</span>
              <span className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 block font-mono">
                {formatCurrency(totalDebt)}
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">예상 월 변제금</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 block font-mono">
                {formatCurrency(monthlyPayment)}
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">총 변제액(예상)</span>
              <span className="text-sm sm:text-base font-bold text-blue-300 mt-0.5 block font-mono">
                {formatCurrency(totalRepaymentCalculated)}
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">갚지 않아도 되는 금액(예상)</span>
              <span className="text-sm sm:text-base font-bold text-amber-300 mt-0.5 block font-mono">
                {formatCurrency(estimatedReduction)}
              </span>
            </div>
          </div>

          {/* Lawyer Direct Edit Panel (Collapsible) */}
          {isLawyerEditor && isEditingOpen && (
            <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-indigo-500/40 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    담당 변호사 AI 분석 보고서 직접 수정 및 제안서 연동
                  </h4>
                </div>
                <span className="text-[11px] text-indigo-300 font-mono font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  총 변제액 다시 계산: {formatCurrency(editTotalRepayment)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">추천 월 변제금 (원)</label>
                  <input
                    type="number"
                    step="10000"
                    value={editMonthlyPayment}
                    onChange={(e) => setEditMonthlyPayment(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-400">
                    현재: {editMonthlyPayment.toLocaleString()}원 / 월
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">변제 기간 (개월)</label>
                  <select
                    value={editRepaymentMonths}
                    onChange={(e) => setEditRepaymentMonths(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-400 focus:outline-none cursor-pointer"
                  >
                    <option value={24}>24개월 (3년 미만 단축 사유 검토)</option>
                    <option value={36}>36개월 (원칙)</option>
                    <option value={48}>48개월 (3년 초과 사유 검토)</option>
                    <option value={60}>60개월 (최대)</option>
                  </select>
                  <div className="text-[10px] text-slate-400">
                    총 변제액: {(editTotalRepayment).toLocaleString()}원
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">예상 원금 감면액</label>
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 flex items-center justify-between">
                    <span>{editEstimatedReduction.toLocaleString()}원</span>
                    <span className="text-[11px] text-slate-400 font-sans font-normal">감면</span>
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    총 변제액: {formatCurrency(editTotalRepayment)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">변호사 종합 검토 소견 및 전략 (의뢰인 제안서 연동)</label>
                <textarea
                  rows={2}
                  value={editLawyerComment}
                  onChange={(e) => setEditLawyerComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed focus:border-indigo-400 focus:outline-none font-sans"
                  placeholder="의뢰인의 상황에 맞춘 변호사 종합의견을 입력하세요."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleApplyChangesToDraft}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>수정 내용 제안서에 즉시 반영하기</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs (Distinct for AI Premium vs Standard) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-8 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'overview'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            {isAIPremium ? <Sparkles className="w-4 h-4 text-blue-300" /> : <Scale className="w-4 h-4 text-blue-300" />}
            <span>{isAIPremium ? 'AI 종합 진단' : '변호사 직접 검토의견 (전문)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'financial'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isAIPremium ? '소득·재산 & 가계수지' : '채무조정 변제계획안'}</span>
          </button>

          {/* AI 7p 정밀 진단서 전용 탭: 사법연감 통계 백분위 */}
          {isAIPremium && (
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
                activeTab === 'statistics'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>통계 비교 (참고용)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'roadmap'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{isAIPremium ? '수임료 & 사건 로드맵' : '수임료 및 사건 진행 절차'}</span>
          </button>

          {isAIPremium && (
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
                activeTab === 'faq'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>자주 묻는 질문 & 실전 가이드</span>
            </button>
          )}
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* [변호사 직접 검토 전용 서식] 공인 법률의견서 정식 서면 */}
              {!isAIPremium ? (
                <div className="space-y-6">
                  {/* 1. 담당 변호사 직접 심사 총괄 소견 카드 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              변호사 검토의견
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              관할: <strong className="text-slate-700">{courtName}</strong>
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                            {lawyerName} 변호사의 검토 소견
                          </h3>
                        </div>
                      </div>

                      {/* 작성 사무소 (가짜 인장 표시 없음) */}
                      {lawyerFirmName && (
                        <div className="flex items-center gap-2 self-end sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <span className="text-xs font-semibold text-slate-700">{lawyerFirmName}</span>
                        </div>
                      )}
                    </div>

                    {/* 핵심 변호사 코멘트 및 소견 */}
                    {isClientView ? (
                      /* 의뢰인 화면: 고정 안내 문장을 변호사 인용문처럼 붙이지 않고, 작성된 소견만 표시 */
                      isLawyerCommentMissing ? (
                        <p className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-sm text-slate-500 leading-relaxed">
                          {NOT_WRITTEN_TEXT}
                        </p>
                      ) : (
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 text-slate-800 leading-relaxed">
                          <div className="flex items-start gap-2.5">
                            <span className="text-blue-600 text-2xl font-serif font-black leading-none select-none" aria-hidden="true">“</span>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                              {lawyerComment}
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 text-slate-800 leading-relaxed space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="text-blue-600 text-2xl font-serif font-black leading-none select-none">“</span>
                          <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                            제출해 주신 소득 요건과 부채 규모를 관할법원 실무 기준에 맞추어 검토한 변제 계획안입니다.
                          </p>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed pl-5 whitespace-pre-line">
                          {lawyerComment}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2. 법원 보정명령 방어 및 직접 소명 3대 전략 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                          보정 대응 및 소명 준비 계획
                        </h4>
                      </div>
                    </div>

                    {isClientView && specialNotes.length === 0 ? (
                      /* 의뢰인 화면: 변호사가 작성한 계획이 없으면 기본 계획으로 채우지 않는다 */
                      <p className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
                        {NOT_WRITTEN_TEXT}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {specialNotes.map((note, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-slate-900 font-extrabold">계획 {idx + 1}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">{note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. 의뢰인 안내 사항 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">상담 비밀 보호</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">계약 전까지 가명으로 상담하며, 상담 내용은 변호사 비밀유지의무로 보호됩니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">담당 변호사 책임 수행</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">수임 후 사건은 계약서에 기재된 담당 변호사가 책임지고 진행합니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">환불 조건 사전 확인</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">중도 해지 시 환불 조건은 서명 전에 위임계약서에서 확인하실 수 있습니다</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. 법적 신뢰 인증 씰 바 */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-800">
                        상담 내용은 변호사법 제26조(비밀유지의무)에 따라 보호됩니다. 본 제안서는 수임 전 참고 의견입니다.
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-medium">
                      작성: {lawyerFirmName ? `${lawyerFirmName} · ` : ''}{lawyerName}{lawyerName.endsWith('변호사') ? '' : ' 변호사'}
                    </span>
                  </div>
                </div>
              ) : (
                /* [AI 프리미엄 특화] AI 정밀 진단서 기존 뷰 */
                <>
                  {/* [AI 프리미엄 특화] AI 정밀 사건 브리핑: 부채 구조 3분류 & 사전 위험 플래그 진단 */}
                  {rawAiInsights && (
                    <div className="bg-gradient-to-br from-amber-50/60 via-blue-50/40 to-slate-50 border border-amber-200/80 shadow-sm rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-900 font-bold">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900">
                              AI 정밀 사건 브리핑: 부채 구조 및 사전 위험 진단
                            </h4>
                            <p className="text-xs text-slate-600">입력하신 부채 정보를 자동 분류한 결과와 검토가 필요한 위험 요인입니다.</p>
                          </div>
                        </div>
                        {rawAiInsights.reviewGrade && (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            검토 수준: {rawAiInsights.reviewGrade === 'ENHANCED_REVIEW' ? '강화 검토' : rawAiInsights.reviewGrade === 'NORMAL_REVIEW' ? '일반 검토' : '정밀 검토'}
                          </span>
                        )}
                      </div>

                      {/* 부채 구성 3대 분류 */}
                      {rawAiInsights.debtBreakdown && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">무담보 신용 채무</div>
                            <div className="text-base font-black text-slate-900">{formatCurrency(rawAiInsights.debtBreakdown.unsecured)}</div>
                            <div className="text-xs text-emerald-700 font-bold mt-1">변제계획에 따른 감면 대상</div>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">담보 대출 채무</div>
                            <div className="text-base font-black text-slate-900">{formatCurrency(rawAiInsights.debtBreakdown.secured)}</div>
                            <div className="text-xs text-slate-500 mt-1">별제권 별도 보호 관리</div>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">우선변제 (조세·공과금)</div>
                            <div className="text-base font-black text-amber-600">{formatCurrency(rawAiInsights.debtBreakdown.tax)}</div>
                            <div className="text-xs text-amber-700 font-bold mt-1">변제계획 1순위 변제</div>
                          </div>
                        </div>
                      )}

                      {/* AI 위험 플래그 진단 */}
                      {rawAiInsights.riskFlags && rawAiInsights.riskFlags.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span>사전 검토가 필요한 위험 요인</span>
                          </div>
                          <div className="space-y-2">
                            {rawAiInsights.riskFlags.map((flag: any, idx: number) => (
                              <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200/70 text-xs text-slate-700 flex items-start gap-2.5 shadow-xs">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                                <span className="leading-relaxed">{flag.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Primary Before vs After Visual Comparison Card */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                          <TrendingDown className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">개인회생 신청 전후 재무 변화</h3>
                          <p className="text-xs text-slate-600">제안 조건대로 인가될 경우의 예상 채무 조정 결과입니다. 실제 결과는 법원 심리에 따라 달라질 수 있습니다.</p>
                        </div>
                      </div>
                      <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        원금 약 {debtReductionRate}% 감면 예상
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before: Current Debt Burden */}
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 relative overflow-hidden">
                        <div className="text-xs font-bold text-slate-700 tracking-tight mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            신청 전 현재 상태
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                            이자·독촉 지속
                          </span>
                        </div>
                        <div className="space-y-2.5 mt-3">
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-500 font-medium">갚아야 할 총 채무</span>
                            <span className="font-bold text-slate-900 font-mono">{formatCurrency(totalDebt)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-500 font-medium">대출 이자</span>
                            <span className="font-bold text-rose-700">연 15~20% 계속 증가</span>
                          </div>
                          {hasCurrentBurdenEstimate && (
                            <div className="flex justify-between items-start gap-2 text-xs sm:text-sm">
                              <span className="text-slate-500 font-medium">
                                매달 원리금 상환 부담
                                <span className="block text-[11px] text-slate-400 font-normal">{currentBurdenBasis}</span>
                              </span>
                              <span className="font-bold text-slate-900 font-mono">약 {formatCurrency(currentMonthlyBurden)}</span>
                            </div>
                          )}
                          <div className="pt-2.5 border-t border-slate-200 text-xs text-rose-700 font-medium flex items-center gap-1">
                            <span>⚠️ 채권추심 전화 및 통장 압류 위험 노출</span>
                          </div>
                        </div>
                      </div>

                      {/* After: Rehabilitation Plan */}
                      <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 relative overflow-hidden shadow-2xs">
                        <div className="text-xs font-bold text-emerald-800 tracking-tight mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-900 font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-700" />
                            개인회생 인가 후 (예상)
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100/80 border border-emerald-300 text-emerald-800 font-bold">
                            원금 대폭 감면
                          </span>
                        </div>
                        <div className="space-y-2.5 mt-3">
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-600 font-medium">월 변제금 ({repaymentMonths}개월)</span>
                            <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">{formatCurrency(monthlyPayment)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-600 font-medium">이자 및 연체이자</span>
                            <span className="font-bold text-emerald-700">개시결정 뒤 더 붙지 않음</span>
                          </div>
                          <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span className="text-slate-600 font-medium">3년간 갚을 총 원금</span>
                            <span className="font-bold text-slate-900 font-mono">{formatCurrency(totalRepaymentCalculated)}</span>
                          </div>
                          <div className="pt-2.5 border-t border-emerald-200/80 text-xs text-emerald-900 font-bold flex items-center justify-between">
                            <span>갚지 않아도 되는 금액(예상)</span>
                            <span className="text-sm font-black text-emerald-700 font-mono">{formatCurrency(estimatedReduction)}</span>
                          </div>
                          <div className="text-xs text-emerald-800 font-medium mt-1 flex items-center gap-1">
                            <span>🛡️ 금지·중지명령이 나오면 추심·강제집행이 멈춥니다</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lawyer's Diagnosis Opinion */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-2xl shrink-0 ${isAIPremium ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
                        <Scale className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {lawyerName} 변호사의 종합 소견
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            진단 기준 법원: {courtName}
                          </span>
                        </div>

                        <div className={`mt-3 p-4 rounded-xl bg-slate-50 border text-sm leading-relaxed ${
                          isLawyerCommentMissing ? 'border-dashed border-slate-300 text-slate-500' : 'border-slate-200 text-slate-700'
                        }`}>
                          {isLawyerCommentMissing ? NOT_WRITTEN_TEXT : lawyerComment}
                        </div>

                        {specialNotes && specialNotes.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="text-xs font-bold text-slate-700">📌 사건 진행 시 주의사항</div>
                            <ul className="space-y-1.5">
                              {specialNotes.map((note, idx) => (
                                <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 의뢰인 안내 사항 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">금지명령 함께 신청</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">법원이 금지명령을 내리면 채권자의 추심·강제집행이 제한됩니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">상담 비밀 보호</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">상담 내용은 변호사 비밀유지의무로 보호됩니다. 직장·가족 관련 유의사항은 상담 시 안내합니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">환불 조건 사전 확인</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">중도 해지 시 환불 조건은 서명 전에 위임계약서에서 확인하실 수 있습니다</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

          {/* TAB 2: FINANCIAL & LIVING EXPENSES */}
          {activeTab === 'financial' && (
            <div className="space-y-6">

              {/* Income vs Living Cost Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">내 월급에서 변제금은 이렇게 정해져요</h3>
                    <p className="text-xs text-slate-500">월급에서 최소 생활비(법원이 정한 금액)를 빼고 남은 돈이 매달 갚을 변제금이에요.</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    부양가족 {(activeCalcResult as any).dependentsCount || 1}인 기준
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">내 월급 (세후)</div>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      {(activeCalcResult as any).monthlyIncome ? formatCurrency((activeCalcResult as any).monthlyIncome) : '미입력'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">실제 통장에 들어오는 금액</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">법원이 보장하는 생활비</div>
                    <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                      {formatCurrency(activeCalcResult.recognizedLivingCost)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">2026 기준 중위소득 60% 기준</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-blue-200/80 bg-blue-50/20">
                    <div className="text-xs text-[#1E3A5F] font-bold">매달 갚을 금액</div>
                    <div className="text-lg font-black text-[#1E3A5F] mt-1 font-mono">
                      {formatCurrency(monthlyPayment)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">매달 법원 계좌에 넣는 금액</div>
                  </div>
                </div>

                {/* Formula Bar */}
                <div className="mt-5 p-4 rounded-xl bg-slate-100 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                  <span>📐 <strong>산정 원리</strong>: 월 소득 − 인정 생계비 = 월 가용소득. 월 변제금은 가용소득을 기준으로 청산가치·최저변제액 요건을 함께 고려해 정해집니다.</span>
                  <span className="text-slate-500">※ 추가 생계비(주거·의료 등) 인정 여부에 따라 달라질 수 있습니다.</span>
                </div>
              </div>

              {/* Monthly Repayment Burden Relief Meter — 현재 부담은 추정치이므로 근거와 함께 표시하고, 추정할 자료가 없으면 숨긴다 */}
              {hasCurrentBurdenEstimate && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">월 상환 부담 비교 (추정)</h3>
                <p className="text-xs text-slate-500 mb-5">
                  현재 월 상환 부담 추정치와 회생 인가 시 예상 월 변제금을 비교한 참고 자료입니다. 실제 상환액과 다를 수 있습니다. ({currentBurdenBasis})
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-500">현재 원리금 상환 부담 (추정)</span>
                      <span className="text-red-600 font-bold">약 {formatCurrency(currentMonthlyBurden)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full w-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-500">개인회생 인가 시 예상 월 변제금</span>
                      <span className="text-emerald-600 font-black">{formatCurrency(monthlyPayment)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((monthlyPayment / Math.max(1, currentMonthlyBurden)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-bold">월 부담 감소 (추정)</div>
                      <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 font-mono">
                        약 {formatCurrency(Math.max(0, currentMonthlyBurden - monthlyPayment))}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                      <div className="text-[11px] text-slate-500 font-bold">총 원금 감면액 (예상)</div>
                      <div className="text-sm sm:text-base font-black text-[#1E3A5F] mt-0.5 font-mono">
                        {formatCurrency(estimatedReduction)}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-slate-500 font-bold">변제 기간</div>
                      <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5 font-mono">
                        {repaymentMonths}개월
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

            </div>
          )}

          {/* TAB 3: STATISTICS (AI 7p 정밀 진단서 전용 탭) */}
          {isAIPremium && activeTab === 'statistics' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        공개 통계 기준 참고 비교
                      </h3>
                      <p className="text-xs text-slate-600">공개된 개인회생 통계와 입력하신 소득·채무를 비교한 참고 자료입니다. 법원의 판단 기준이 아닙니다.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                    참고용
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeUserInput.monthlyIncome > 0 && (
                    <StatComparisonCard
                      title="월 소득 비교"
                      userValue={activeUserInput.monthlyIncome}
                      averageValue={AVERAGE_VALUES.monthlyIncome}
                      percentile={calculateIncomePercentile(activeUserInput.monthlyIncome)}
                      icon={<DollarSign className="w-4 h-4" />}
                      unit="원"
                    />
                  )}
                  {totalDebt > 0 && (
                    <StatComparisonCard
                      title="총 채무 비교"
                      userValue={totalDebt}
                      averageValue={AVERAGE_VALUES.totalDebt}
                      percentile={calculateDebtPercentile(totalDebt)}
                      icon={<CreditCard className="w-4 h-4" />}
                      unit="원"
                    />
                  )}
                </div>

                <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-purple-900 leading-relaxed">
                  💡 <strong>참고</strong>: 통계 비교는 사건의 개시·인가 가능성을 보장하지 않으며, 실제 결과는 {courtPhrase}의 심리와 제출 서류에 따라 달라집니다.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEGAL FEES & CASE ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">

              {/* Transparent Legal Fees Structure Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">수임료 및 분납 조건 안내</h3>
                    <p className="text-xs text-slate-600">변호사가 제안한 수임료입니다. 최종 금액과 납부 일정은 위임계약서에 기재됩니다.</p>
                  </div>
                  {installments > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      {installments}회 분납
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">총 변호사 수임료</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {totalFeeWon > 0 ? formatCurrency(totalFeeWon) : '상담 후 확정'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">변호사 제안 기준</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">착수금 (계약 시)</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {downPaymentWon > 0 ? formatCurrency(downPaymentWon) : '협의'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">계약서에 기재된 일정에 따라 납부</div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-xs text-emerald-700 font-medium">
                      월 분납액{installments > 0 ? ` (${installments}회 분할)` : ''}
                    </div>
                    <div className="text-xl font-black text-emerald-800 mt-1">
                      {monthlyInstallmentWon > 0 ? formatCurrency(monthlyInstallmentWon) : '협의'}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">분납 조건은 변호사마다 다릅니다</div>
                  </div>
                </div>

                {courtDepositWon > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                    <span>🏛️ 법원 예납비용 (인지대, 송달료 등 실비)</span>
                    <span className="font-bold">{formatCurrency(courtDepositWon)}</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  * {additionalCostsNotice || '인지대·송달료 등 법원 실비는 채권자 수에 따라 별도로 정해집니다. 계약서에 없는 비용 요구가 있으면 고객센터로 알려 주세요.'}
                </p>
              </div>

              {/* 5-Step Procedure Timeline */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">개인회생 5단계 진행 로드맵</h3>
                <p className="text-xs text-slate-600 mb-6">신청서 접수부터 면책 결정까지의 일반적인 진행 순서입니다.</p>

                <ProcedureTimeline currentStage={1} />
              </div>

              {/* 1:1 맞춤 Q&A (있는 경우) */}
              {clientQnA && clientQnA.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-brand" />
                    <span>의뢰인 맞춤 핵심 Q&A</span>
                  </h3>
                  <div className="space-y-3">
                    {clientQnA.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-xs font-bold text-slate-900 flex items-start gap-2">
                          <span className="text-brand font-black">Q.</span>
                          <span>{item.question}</span>
                        </div>
                        <div className="text-xs text-slate-600 pl-4 leading-relaxed">
                          <span className="text-emerald-600 font-bold mr-1.5">A.</span>
                          {item.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 5: FAQ & 실전 가이드 (AI Premium only) */}
          {activeTab === 'faq' && isAIPremium && (
            <div className="space-y-6">

              {/* 🎯 Section 1: 고객 맞춤형 질문 (데이터 기반 동적 추천) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-[#1E3A5F]">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <span>🎯 {clientName}님의 상황 맞춤 질문</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A5F] border border-blue-200">
                          {personalizedFaqs.length}개 추천
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        입력해주신 주거, 가족, 재산, 채무 성격을 바탕으로 가장 걱정하실 질문들을 자동 선별했습니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {personalizedFaqs.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/90 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badge.color}`}>
                          {item.badge.label}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 flex items-start gap-2">
                        <span className="text-[#1E3A5F] font-black text-base shrink-0">Q.</span>
                        <span className="leading-snug">{item.q}</span>
                      </div>
                      <div className="text-xs text-slate-700 pl-6 leading-relaxed">
                        <span className="text-emerald-700 font-bold mr-1.5">A.</span>
                        {item.a}
                      </div>
                      {item.tip && (
                        <div className="mt-2 ml-6 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span><strong>실무 팁:</strong> {item.tip}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 📞 Section 2: 실전 추심 전화 대응 가이드 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      📞 실전 추심 대응 가이드
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      접수 후 금지명령이 나오기까지 3~7일 동안 채권자 전화가 오면 이렇게 당당하게 말씀하세요.
                    </p>
                  </div>
                </div>

                {/* 당당한 한마디 스크립트 박스 */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1E3A5F]">
                    <span>💬 채권추심원 통화 시 복사해서 읽는 스크립트</span>
                    <span className="text-[11px] font-normal text-slate-500">당황하지 마시고 그대로 말씀하세요</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed font-mono select-all">
                    "변호사를 통해 법원에 개인회생 신청을 정식 접수했습니다.<br />
                    사건번호는 <strong>2026개회 (접수 후 나오는 번호)</strong>호입니다.<br />
                    현재 법적 절차에 따라 진행 중이니 담당 대리인 법률사무소(<strong>{lawyerPhone || '02-0000-0000'}</strong>)로 연락하시기 바랍니다."
                  </div>
                  <p className="text-[11px] text-slate-600">
                    💡 사건번호를 알려주면 대부분의 추심원은 추심을 중단하고 대리인 사무실 확인 단계로 넘어갑니다.
                  </p>
                </div>

                {/* 불법추심 식별 가이드 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="block text-slate-900 font-bold mb-1">🚫 야간 연락 금지</strong>
                    <span className="text-slate-600 text-[11px]">오후 9시부터 다음 날 오전 8시까지 전화·문자·방문은 법적으로 전면 금지됩니다.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="block text-slate-900 font-bold mb-1">🚫 직장·가족 방문 금지</strong>
                    <span className="text-slate-600 text-[11px]">직장에 찾아와 알리거나 가족에게 대신 갚으라고 요구하는 행위는 형사처벌 대상입니다.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <strong className="block text-slate-900 font-bold mb-1">⚖️ 금융감독원 신고</strong>
                    <span className="text-slate-600 text-[11px]">위반 사항 발생 시 통화 녹음 후 금융감독원(국번없이 1332)에 즉시 신고할 수 있습니다.</span>
                  </div>
                </div>
              </div>

              {/* 💳 Section 3: 안전한 금융생활 & 통장 압류 방지 3계명 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      💳 통장 압류 방지 & 안전한 은행 이동법
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      회생 신청 직후 내 생활비와 급여를 안전하게 지키는 3대 원칙입니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">채권사 은행 잔고 비우기</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      빚이 있는 은행(대출·마이너스통장·신용카드 결제 계좌)에 돈이 있으면 은행이 빚과 잔고를 맞바꿔(상계) 인출해 갈 수 있으니 잔고를 0원으로 만드세요.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">채무 없는 은행으로 급여 이동</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      대출이 전혀 없는 제1금융권 은행(신한·국민·하나 등)이나 단위 농협·수협·신협·새마을금고에서 새 계좌를 만들어 직장 급여 통장을 미리 옮기세요.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">체크카드는 보통 사용 가능</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      신용카드는 사용이 중단되지만 새 통장의 체크카드는 자유롭게 발급받아 온라인 쇼핑, 배달, 교통카드까지 아무런 제약 없이 편하게 쓰실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 📋 Section 4: 5분 스마트폰 사전 필수 서류 발급 체크리스트 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      📋 스마트폰으로 준비하는 필수 사전 서류
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      미리 떼어두시면 서류 접수 및 사건 개시 기간이 최대 2주일 단축됩니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-[#1E3A5F] flex items-center gap-1">
                      <span>🏛️ 정부24 (무료 즉시 발급)</span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                      <li>주민등록등본 및 초본 (전체 포함)</li>
                      <li>가족관계증명서 (상세)</li>
                      <li>지방세 세목별 과세증명서</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-[#1E3A5F] flex items-center gap-1">
                      <span>💼 홈택스 / 손택스 (소득)</span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                      <li>소득금액증명원 (최근 1~3개년)</li>
                      <li>근로소득원천징수영수증</li>
                      <li>사업자등록증명원 / 폐업사실증명</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-[#1E3A5F] flex items-center gap-1">
                      <span>📊 어카운트인포 (계좌통합)</span>
                    </div>
                    <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                      <li>은행 전 계좌 잔고 및 내역서</li>
                      <li>보험가입조회서 및 해약환급금확인서</li>
                      <li>카드 발급 및 채무 현황 조회서</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 🛡️ Section 5: 회생 진행 중 위기 안전망 (실직·질병 시 대처법) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      🛡️ 회생 진행 중 위기 안전망 안내
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      3~5년 동안 갚다가 중간에 아프거나 실직해도 법적인 구제 장치가 마련되어 있습니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-900 font-bold">1~2회 미납 시 즉시 취소 안 됨</strong>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      보통 연속 3회 이상 미납 시 경고가 오며, 실직이나 치료 사유서와 함께 "납부유예 신청서"를 제출하면 유예받을 수 있습니다.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-900 font-bold">변제계획안 변경 신청 제도</strong>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      이직으로 월급이 줄어들거나 부양가족이 늘어난 경우, 법원에 변제계획안 변경을 신청하여 월 변제금을 낮출 수 있습니다.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <strong className="block text-slate-900 font-bold">불가피한 사유 시 특별면책</strong>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      중병이나 장해 등으로 더 이상 근로가 불가능해진 경우, 이미 납부한 금액만으로 남은 빚을 면제받는 특별면책 제도가 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* ❓ Section 6: 공통 필수 질문 TOP 5 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      ❓ 자주 묻는 질문 공통 TOP 5
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      회생을 처음 알아보시는 모든 분들이 가장 많이 질문하시는 내용입니다.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      q: '독촉 전화가 진짜 멈추나요?',
                      a: '네! 법원에서 금지명령이 내려지면 모든 채권자는 전화, 문자, 독촉장 발송, 자택 방문이 법적으로 전면 금지됩니다. 위반 시 채권자에게 법적 과태료가 부과됩니다.'
                    },
                    {
                      q: '회사나 직장에 알려지나요? 해고 사유가 되나요?',
                      a: '개인회생은 법원에서 직장으로 일체 통보하지 않습니다. 직업 제한이 없어서 공무원, 교사, 군인, 대기업/금융권 재직자도 신분 변동 없이 안전하게 신청 가능합니다.'
                    },
                    {
                      q: '가족(부모님, 자녀)에게 신용상 피해가 가나요?',
                      a: '본인 명의의 채무만 조정되므로 부모님이나 자녀, 배우자의 재산이나 신용점수에는 영향이 없습니다. (단, 가족이 연대보증을 선 채무는 보증채무 점검이 필요합니다).'
                    },
                    {
                      q: '해외여행이나 출국에 제한이 생기나요?',
                      a: '개인회생 절차 자체로 출국이 금지되지는 않습니다. 다만 채권자집회 등 법원 기일에는 반드시 출석해야 하니 일정을 맞춰 주세요.'
                    },
                    {
                      q: '채권자집회에 가면 채권자들이 저를 비난하나요?',
                      a: '아닙니다! 은행이나 카드사 등 금융기관 채권자는 거의 참석하지 않습니다. 판사님이 출석 확인 후 성실 납부를 당부하는 5분 이내의 형식적인 절차이므로 전혀 두려워하실 필요가 없습니다.'
                    }
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                      <div className="text-sm font-bold text-slate-900 flex items-start gap-2 mb-1.5">
                        <span className="text-[#1E3A5F] font-black text-base shrink-0">Q.</span>
                        <span>{item.q}</span>
                      </div>
                      <div className="text-xs text-slate-700 pl-6 leading-relaxed">
                        <span className="text-emerald-700 font-bold mr-1.5">A.</span>
                        {item.a}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 🚫 Section 7: 절대 하면 안 되는 것 (사기회생 방지 수칙) */}
              <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-rose-100">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">🚫 절대 하면 안 되는 것 (사기회생 방지 수칙)</h3>
                    <p className="text-xs text-rose-700 font-medium">이 4가지만 지키시면 회생은 안전하게 인가됩니다.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      title: '추가 대출·신용카드 현금화 금지',
                      desc: '신청 직전에 카드깡을 하거나 고의로 새 대출을 받으면 사기죄로 형사고소 및 기각될 수 있습니다.',
                      icon: '💳'
                    },
                    {
                      title: '재산 숨기기·가족 명의 이전 금지',
                      desc: '부동산이나 차량을 가족에게 증여하거나 헐값에 매매하면 법원 부인권 행사 대상이 됩니다.',
                      icon: '🏠'
                    },
                    {
                      title: '특정 빚만 먼저 갚기 금지 (편파변제)',
                      desc: '지인이나 부모님 빚만 먼저 갚으면 그 돈이 재산으로 간주되어 매달 변제금이 올라갑니다.',
                      icon: '⚖️'
                    },
                    {
                      title: '법원 서류 소명 시 허위 진술 금지',
                      desc: '금융거래내역을 회생위원이 정밀 조사하므로 솔직하게 작성하고 변호사의 조력을 받는 것이 최선입니다.',
                      icon: '📝'
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/70">
                      <div className="text-xs sm:text-sm font-bold text-rose-900 flex items-center gap-2 mb-1">
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                      </div>
                      <p className="text-xs text-rose-800/80 leading-relaxed pl-6">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 🌱 Section 8: 회생 완주 후 신용회복 로드맵 */}
              <div className="bg-gradient-to-br from-blue-50/60 to-emerald-50/60 rounded-2xl p-6 border border-blue-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2">
                  <div className="p-2 rounded-xl bg-white text-emerald-700 shadow-2xs border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      🌱 성실 변제를 마치면 맞이할 새로운 금융생활
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      36개월 성실 납부 완료 시 한국신용정보원의 1301 공공기록이 영구 삭제됩니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center shadow-2xs">
                    <div className="text-2xl mb-1.5">📈</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">신용점수 급상승</div>
                    <div className="text-xs text-slate-600 mt-1">700~800점대로 회복되어 신용불량 꼬리표 완전 삭제</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center shadow-2xs">
                    <div className="text-2xl mb-1.5">💳</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">1금융권 정상 거래</div>
                    <div className="text-xs text-slate-600 mt-1">시중 은행 신용카드 신규 발급 및 정상 대출 가능</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center shadow-2xs">
                    <div className="text-2xl mb-1.5">🏡</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">빚 없는 자유로운 삶</div>
                    <div className="text-xs text-slate-600 mt-1">남은 모든 원금과 이자의 법적 책임 완전 소멸</div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-5 sm:px-8 py-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>상담 내용은 변호사법 제26조(비밀유지의무)에 따라 철저히 보호됩니다.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isLawyerEditor && onApplyChanges && (
              <button
                type="button"
                onClick={handleApplyChangesToDraft}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>수정 내용 제안서에 반영하기</span>
              </button>
            )}

            {lawyerPhone && !isLawyerEditor && (
              <a
                href={`tel:${lawyerPhone}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>전화 상담</span>
              </a>
            )}

            {onContactLawyer && (
              <button
                onClick={() => onContactLawyer({ name: lawyerName, firmName: lawyerFirmName, phone: lawyerPhone })}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>변호사 1:1 메시지</span>
              </button>
            )}

            {(onAcceptProposal || onAppointLawyer) && (
              isContractDone ? (
                /* 계약이 끝난 상담에는 새 전자계약 진행 버튼을 보여주지 않는다 */
                <div
                  role="status"
                  className="flex items-center justify-center gap-1.5 px-6 min-h-[44px] whitespace-nowrap rounded-xl text-xs sm:text-sm font-bold w-full sm:w-auto bg-slate-100 text-slate-700 border border-slate-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>계약이 완료된 상담입니다</span>
                </div>
              ) : (
                <button
                  onClick={handleAccept}
                  type="button"
                  className="flex items-center justify-center gap-1.5 px-6 min-h-[44px] whitespace-nowrap rounded-xl text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-xs cursor-pointer bg-[#1E3A5F] hover:bg-[#162A45] text-white border border-blue-400/30"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>이 조건으로 전자계약 진행</span>
                </button>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return embedded ? modalContent : <ModalPortal>{modalContent}</ModalPortal>;
};

export default PremiumProposalReportModal;
