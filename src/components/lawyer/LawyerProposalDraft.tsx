import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, TrendingDown, Scale, AlertTriangle, 
  MessageSquare, FileText, CheckCircle2, Building2, 
  Eye, EyeOff, Plus, Trash2, Microscope, TrendingUp, 
  Shield, Check, Clock, X, Settings, Sparkles, User,
  Share2, ArrowRight
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import { useProposalTemplates, OpinionTemplate, FeePreset, QASnippet } from '../../hooks/useProposalTemplates';
import { TemplateManageModal } from './TemplateManageModal';

export interface AIAnalysisData {
  factSummary: {
    monthlyIncome: number;
    monthlyExpense: number;
    disposableIncome: number;
    totalDebt: number;
    securedDebt: number;
    unsecuredDebt: number;
    taxDebt: number;
    assets: {
      realEstate: number;
      vehicles: number;
      deposit: number;
      insurance: number;
      other: number;
      netAssetValue: number;
    };
  };
  riskFlags: Array<{
    flagType: string;
    field: string;
    message: string;
    severity: 'HIGH_RISK' | 'CAUTION' | 'INFO';
    legalBasis?: string;
  }>;
  missingFields: Array<{
    field: string;
    label: string;
    importance: string;
  }>;
  conflicts: Array<{
    description: string;
    resolutionGuide: string;
  }>;
  reviewGrade?: string;
  courtPracticeNotes?: string;
}

interface LawyerProposalDraftProps {
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  consultRequest: any;
  onClose: () => void;
  onSendProposal: (proposalData: ProposalData) => void;
  viewerRole?: 'lawyer' | 'staff' | 'reviewer';
  onRequestConfirm?: (proposalData: ProposalData, memo: string) => void;
  onApproveProposal?: (proposalData: ProposalData) => void;
  onRejectProposal?: (reason: string) => void;
  pendingStaffName?: string;
  aiAnalysis?: AIAnalysisData;
  mode?: 'modal' | 'embedded';
  initialDraft?: {
    totalFeeStr: string;
    downPaymentStr: string;
    installments: number;
    courtDepositStr: string;
    feeMemo: string;
    lawyerOpinion: string;
    specialNotes: string[];
    clientAnswers: Record<number, string>;
    includeFinancialAnalysis: boolean;
    includeRiskReport: boolean;
    includeCourtNotes: boolean;
  } | null;
  onDraftChange?: (draft: any) => void;
  activeViewMode?: 'editor' | 'preview';
  onToggleViewMode?: (mode: 'editor' | 'preview') => void;
  lawyerInfo?: {
    name: string;
    firmName?: string;
    avatar?: string;
  };
}

export interface ProposalData {
  diagnosis: {
    monthlyPayment: number;
    repaymentMonths: number;
    debtReductionRate: number;
    totalDebt: number;
    totalRepayment: number;
    estimatedReduction: number;
    status: string;
    statusReason?: string;
    court?: string;
  };
  specialNotes: string[];
  fees: {
    totalFee: number;
    downPayment: number;
    installments: number;
    monthlyInstallment: number;
    courtDeposit: number;
    feeMemo: string;
  };
  lawyerOpinion: string;
  clientQnA: Array<{
    question: string;
    answer: string;
  }>;
  aiInsights?: {
    isAIPremium: true;
    debtBreakdown: {
      secured: number;
      unsecured: number;
      tax: number;
    };
    riskFlags: Array<{
      type: string;
      message: string;
    }>;
    reviewGrade: string;
    financialSummary: {
      monthlyIncome: number;
      monthlyExpense: number;
      disposableIncome: number;
      netAssetValue: number;
    };
    includeFinancialAnalysis: boolean;
    includeRiskReport: boolean;
    includeCourtNotes: boolean;
  };
}

const fmtNum = (n: number) => n.toLocaleString('ko-KR');

const LawyerProposalDraft: React.FC<LawyerProposalDraftProps> = ({
  rehabCalcResult,
  rehabUserInput,
  consultRequest,
  onClose,
  onSendProposal,
  viewerRole = 'lawyer',
  onRequestConfirm,
  onApproveProposal,
  onRejectProposal,
  pendingStaffName,
  aiAnalysis,
  mode = 'modal',
  initialDraft,
  onDraftChange,
  activeViewMode = 'editor',
  onToggleViewMode,
  lawyerInfo
}) => {
  const clientName = rehabUserInput.name || consultRequest?.clientName || consultRequest?.financialProfile?.clientName || '고객';
  const isAIPremium = !!aiAnalysis;
  const isEmbedded = mode === 'embedded';

  // 템플릿 관리 훅
  const { 
    opinionTemplates, 
    feePresets, 
    qaSnippets 
  } = useProposalTemplates(consultRequest?.selectedLawyerId || 'default');

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalDefaultTab, setTemplateModalDefaultTab] = useState<'opinion' | 'fee' | 'qa'>('opinion');

  // ── AI 프리미엄 섹션 의뢰인 공개 토글 ──
  const [includeFinancialAnalysis, setIncludeFinancialAnalysis] = useState(initialDraft?.includeFinancialAnalysis ?? true);
  const [includeRiskReport, setIncludeRiskReport] = useState(initialDraft?.includeRiskReport ?? true);
  const [includeCourtNotes, setIncludeCourtNotes] = useState(initialDraft?.includeCourtNotes ?? true);

  // Section 2: Special Notes State
  const initialNotes = useMemo(() => {
    const notes: string[] = [];
    if (rehabUserInput.speculativeLoss && rehabUserInput.speculativeLoss > 0) {
      notes.push(`투기성 손실 ${formatCurrency(rehabUserInput.speculativeLoss)}원 존재 (주식/코인)`);
    }
    if ((rehabUserInput as any).gamblingLoss && (rehabUserInput as any).gamblingLoss > 0) {
      notes.push(`도박/사행성 손실 ${formatCurrency((rehabUserInput as any).gamblingLoss)}원`);
    }
    if (rehabUserInput.debtTypes && rehabUserInput.debtTypes.includes('priorityDebt')) {
      notes.push('세금 체납 (우선변제채권) 존재');
    }
    if ((rehabCalcResult as any).recentLoanWarning) {
      notes.push((rehabCalcResult as any).recentLoanWarning);
    }
    if ((rehabCalcResult as any).legalActions && (rehabCalcResult as any).legalActions.length > 0) {
      notes.push(`진행 중인 법적 조치: ${(rehabCalcResult as any).legalActions.join(', ')}`);
    }
    
    // AI 프리미엄: 위험 플래그 자동 병합
    if (aiAnalysis) {
      aiAnalysis.riskFlags.forEach(flag => {
        const msg = flag.message;
        if (!notes.some(n => n === msg)) {
          notes.push(msg);
        }
      });
    }

    return notes;
  }, [rehabUserInput, rehabCalcResult, aiAnalysis]);

  const [specialNotes, setSpecialNotes] = useState<string[]>(initialDraft?.specialNotes ?? initialNotes);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Section 3: Fees State
  const [totalFeeStr, setTotalFeeStr] = useState(initialDraft?.totalFeeStr ?? '1500000');
  const [downPaymentStr, setDownPaymentStr] = useState(initialDraft?.downPaymentStr ?? '300000');
  const [installments, setInstallments] = useState<number>(initialDraft?.installments ?? 5);
  const [courtDepositStr, setCourtDepositStr] = useState(initialDraft?.courtDepositStr ?? '300000');
  const [feeMemo, setFeeMemo] = useState(initialDraft?.feeMemo ?? '착수금 결제 후 매월 분납 가능 (송달료 포함)');

  const totalFee = parseInt(totalFeeStr.replace(/,/g, ''), 10) || 0;
  const downPayment = parseInt(downPaymentStr.replace(/,/g, ''), 10) || 0;
  const courtDeposit = parseInt(courtDepositStr.replace(/,/g, ''), 10) || 0;
  const monthlyInstallment = installments > 0 ? Math.max(0, Math.floor((totalFee - downPayment) / installments)) : 0;

  const handleCurrencyInput = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const numOnly = value.replace(/[^0-9]/g, '');
    setter(numOnly ? fmtNum(parseInt(numOnly, 10)) : '');
  };

  // Section 4: Lawyer Opinion
  const defaultOpinion = useMemo(() => {
    if (aiAnalysis) {
      return `개인회생 진행이 가능한 것으로 분석됩니다.\n\n월 가용소득은 약 ${formatCurrency(aiAnalysis.factSummary.disposableIncome)}원으로 산출되며, 예상 변제 기간은 ${rehabCalcResult.repaymentMonths}개월, 총 감면율은 약 ${rehabCalcResult.debtReductionRate}%입니다.\n\n상세한 변제계획 수립 및 금지명령 신청을 신속히 진행해 드리겠습니다.`;
    }
    return `개인회생 신청 적격 대상자로 분석됩니다.\n\n의뢰인님의 소득과 생계비를 종합 고려하여 월 최저 변제금(${formatCurrency(rehabCalcResult.monthlyPayment)}원)으로 인가받을 수 있도록 최적의 변제계획안을 수립하겠습니다.\n\n접수 즉시 금지명령을 통해 모든 채권 추심과 압류를 중단시켜 드리겠습니다.`;
  }, [aiAnalysis, rehabCalcResult]);

  const [lawyerOpinion, setLawyerOpinion] = useState(initialDraft?.lawyerOpinion ?? defaultOpinion);

  // Section 5: Client Q&A
  const clientQuestions = useMemo(() => {
    const questions: string[] = [];
    const notes = consultRequest?.financialProfile?.clientNotes;
    if (Array.isArray(notes)) {
      notes.forEach(note => {
        if (typeof note === 'string' && note.trim()) questions.push(note);
      });
    }
    const singleNote = consultRequest?.financialProfile?.clientNote || consultRequest?.content;
    if (typeof singleNote === 'string' && singleNote.trim() && !questions.includes(singleNote)) {
      questions.push(singleNote);
    }
    return Array.from(new Set(questions));
  }, [consultRequest]);

  const [clientAnswers, setClientAnswers] = useState<Record<number, string>>(initialDraft?.clientAnswers ?? {});

  // Draft 변경 알림 (자동 임시저장)
  useEffect(() => {
    if (mode === 'embedded' && onDraftChange) {
      onDraftChange({
        totalFeeStr, downPaymentStr, installments, courtDepositStr, feeMemo,
        lawyerOpinion, specialNotes, clientAnswers,
        includeFinancialAnalysis, includeRiskReport, includeCourtNotes,
      });
    }
  }, [mode, totalFeeStr, downPaymentStr, installments, courtDepositStr, feeMemo, lawyerOpinion, specialNotes, clientAnswers, includeFinancialAnalysis, includeRiskReport, includeCourtNotes, onDraftChange]);

  // Derived Summary Values
  const totalDebt = rehabUserInput.totalDebt || 0;
  const totalRepayment = rehabCalcResult.monthlyPayment * rehabCalcResult.repaymentMonths;
  const estimatedReduction = Math.max(0, totalDebt - totalRepayment);

  const getProposalData = (): ProposalData => ({
    diagnosis: {
      monthlyPayment: rehabCalcResult.monthlyPayment,
      repaymentMonths: rehabCalcResult.repaymentMonths,
      debtReductionRate: rehabCalcResult.debtReductionRate,
      totalDebt: totalDebt,
      totalRepayment: totalRepayment,
      estimatedReduction: estimatedReduction,
      status: rehabCalcResult.status,
      statusReason: rehabCalcResult.statusReason,
      court: (rehabCalcResult as any).court || '서울회생법원'
    },
    specialNotes,
    fees: {
      totalFee,
      downPayment,
      installments,
      monthlyInstallment,
      courtDeposit,
      feeMemo
    },
    lawyerOpinion,
    clientQnA: clientQuestions.map((q, idx) => ({
      question: q,
      answer: clientAnswers[idx] || ''
    })),
    ...(isAIPremium && aiAnalysis ? {
      aiInsights: {
        isAIPremium: true as const,
        debtBreakdown: {
          secured: aiAnalysis.factSummary.securedDebt,
          unsecured: aiAnalysis.factSummary.unsecuredDebt,
          tax: aiAnalysis.factSummary.taxDebt,
        },
        riskFlags: aiAnalysis.riskFlags.map(f => ({ type: f.flagType, message: f.message })),
        reviewGrade: aiAnalysis.reviewGrade || 'NORMAL_REVIEW',
        financialSummary: {
          monthlyIncome: aiAnalysis.factSummary.monthlyIncome,
          monthlyExpense: aiAnalysis.factSummary.monthlyExpense,
          disposableIncome: aiAnalysis.factSummary.disposableIncome,
          netAssetValue: aiAnalysis.factSummary.assets.netAssetValue,
        },
        includeFinancialAnalysis,
        includeRiskReport,
        includeCourtNotes,
      }
    } : {})
  });

  // External Submit listener
  useEffect(() => {
    if (!isEmbedded) return;
    const handleExternalSubmit = () => {
      onSendProposal(getProposalData());
    };
    document.addEventListener('proposal-workspace-submit', handleExternalSubmit);
    return () => document.removeEventListener('proposal-workspace-submit', handleExternalSubmit);
  }, [isEmbedded, onSendProposal]);

  // 템플릿 원클릭 적용 핸들러
  const handleApplyTemplate = (tpl: OpinionTemplate) => {
    setLawyerOpinion(tpl.content);
    if (tpl.recommendedNotes && tpl.recommendedNotes.length > 0) {
      const merged = Array.from(new Set([...specialNotes, ...tpl.recommendedNotes]));
      setSpecialNotes(merged);
    }
  };

  // 수임료 패키지 원클릭 적용 핸들러
  const handleApplyFeePreset = (preset: FeePreset) => {
    setTotalFeeStr(fmtNum(preset.totalFee));
    setDownPaymentStr(fmtNum(preset.downPayment));
    setInstallments(preset.installments);
    setCourtDepositStr(fmtNum(preset.courtDeposit));
    if (preset.memo) setFeeMemo(preset.memo);
  };

  // Q&A 빠른 답변 스니펫 적용 핸들러
  const handleApplyQASnippet = (questionIdx: number, snippet: QASnippet) => {
    setClientAnswers(prev => ({
      ...prev,
      [questionIdx]: snippet.answer
    }));
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      setSpecialNotes([...specialNotes, newNote.trim()]);
      setNewNote('');
      setIsAddingNote(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // VIEW: 1. 실시간 고객 시점 미리보기 렌더링 (Live Preview Card)
  // ═════════════════════════════════════════════════════════════════════
  if (activeViewMode === 'preview') {
    return (
      <div className="h-full bg-slate-100 p-6 overflow-y-auto flex flex-col items-center">
        <div className="max-w-xl w-full space-y-4 animate-fadeIn">
          
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand shrink-0" />
              <span className="font-bold">고객 수신 화면 실시간 미리보기</span>
            </div>
            <span className="text-[11px] text-blue-600 bg-white px-2 py-0.5 rounded-md font-medium border border-blue-100">
              고객용 제안서 비교 카드 템플릿
            </span>
          </div>

          {/* 실제 고객이 보게 될 제안서 카드 규격 */}
          <div className="bg-white border-2 border-brand rounded-3xl p-6 shadow-lg space-y-5">
            {/* 상단 변호사 정보 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {lawyerInfo?.avatar ? (
                  <img src={lawyerInfo.avatar} alt="변호사" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-lg">
                    {lawyerInfo?.name?.charAt(0) || '변'}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-400">{lawyerInfo?.firmName || '도산전문 법률사무소'}</div>
                  <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    {lawyerInfo?.name || '담당 변호사'}
                    <span className="text-[10px] bg-brand text-white px-2 py-0.5 rounded-full font-bold">인증 변호사</span>
                  </div>
                </div>
              </div>

              {isAIPremium && (
                <div className="bg-[#1E3A5F] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                  <Microscope className="w-3 h-3 text-blue-300" />
                  AI 정밀 분석 인증
                </div>
              )}
            </div>

            {/* 핵심 수치 매트릭스 2x2 */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-xs text-slate-500 font-medium">예상 월 변제금</span>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                  {formatCurrency(rehabCalcResult.monthlyPayment)}원
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium">예상 탕감률</span>
                <div className="text-lg font-black text-brand font-mono mt-0.5">
                  약 {rehabCalcResult.debtReductionRate}% 탕감
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-xs text-slate-500 font-medium">변제 기간</span>
                <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {rehabCalcResult.repaymentMonths}개월 (24M~36M)
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-xs text-slate-500 font-medium">총 탕감 예상액</span>
                <div className="text-sm font-bold text-emerald-600 font-mono mt-0.5">
                  약 {formatCurrency(estimatedReduction)}원
                </div>
              </div>
            </div>

            {/* 수임료 및 분납 조건 박스 */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-950">총 수임료</span>
                <span className="text-base font-extrabold text-indigo-900 font-mono">{formatCurrency(totalFee)}원</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>착수금 / 분납 조건</span>
                <span className="font-bold text-brand font-mono">
                  착수금 {formatCurrency(downPayment)}원 + 월 {formatCurrency(monthlyInstallment)}원 ({installments}회 분납)
                </span>
              </div>
              {feeMemo && (
                <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-lg border border-indigo-100">
                  💬 {feeMemo}
                </div>
              )}
            </div>

            {/* 변호사 의견 */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                변호사 솔루션 및 의견
              </span>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {lawyerOpinion || '작성된 소견이 없습니다.'}
              </div>
            </div>

            {/* 진행 특이사항 칩 */}
            {specialNotes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">핵심 진행 특이사항</span>
                <div className="flex flex-wrap gap-1.5">
                  {specialNotes.map((note, i) => (
                    <span key={i} className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
                      • {note}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Q&A 답변 */}
            {clientQuestions.length > 0 && Object.keys(clientAnswers).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">의뢰인 질문에 대한 1:1 답변</span>
                {clientQuestions.map((q, idx) => clientAnswers[idx] ? (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-xs space-y-1">
                    <div className="font-bold text-slate-600">Q. {q}</div>
                    <div className="text-brand font-medium">A. {clientAnswers[idx]}</div>
                  </div>
                ) : null)}
              </div>
            )}

            {/* 하단 고객 수락 버튼 모의 */}
            <button disabled className="w-full py-3.5 bg-brand text-white font-extrabold text-sm rounded-xl shadow-md cursor-not-allowed opacity-90">
              💬 이 제안서로 1:1 상담 시작하기 (고객 선택 버튼)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // VIEW: 2. 고속 제안서 빌더 & 스마트 템플릿 에디터 렌더링
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full bg-white flex flex-col overflow-y-auto">
      
      {/* ── 1. 스마트 템플릿 툴바 (최상단 고정/원클릭 바) ── */}
      <div className="sticky top-0 z-10 bg-slate-900 text-white p-3.5 shadow-md flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs font-bold text-brand flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            1초 템플릿:
          </span>
          {opinionTemplates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-brand hover:text-white border border-slate-700 text-slate-200 transition-all active:scale-[0.98] whitespace-nowrap"
              title={tpl.title}
            >
              💡 {tpl.title}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setTemplateModalDefaultTab('opinion');
            setIsTemplateModalOpen(true);
          }}
          className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors shrink-0"
        >
          <Settings className="w-3 h-3" />
          템플릿 관리
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1">
        
        {/* ── 2. 슬림형 진단 요약 스트립 (중복 제거) ── */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">진단 월 변제금</span>
              <span className="font-mono font-extrabold text-slate-800 text-sm">{formatCurrency(rehabCalcResult.monthlyPayment)}원</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">변제 기간</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{rehabCalcResult.repaymentMonths}개월</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">예상 탕감률</span>
              <span className="font-mono font-extrabold text-brand text-sm">약 {rehabCalcResult.debtReductionRate}%</span>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
            rehabCalcResult.status === 'POSSIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {rehabCalcResult.status === 'POSSIBLE' ? '✓ 개인회생 신청 적격' : '⚠️ 보완 필요 대상'}
          </span>
        </div>

        {/* ── 3. 수임료 및 분납 조건 (원클릭 패키지 지원) ── */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand" />
              예상 수임료 및 분납 패키지
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">퀵 프리셋:</span>
              {feePresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyFeePreset(preset)}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50 hover:bg-brand hover:text-white text-indigo-700 border border-indigo-100 transition-all active:scale-[0.98]"
                >
                  ⚡ {preset.label.split('(')[0].trim()}
                </button>
              ))}
              <button
                onClick={() => {
                  setTemplateModalDefaultTab('fee');
                  setIsTemplateModalOpen(true);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
                title="수임료 패키지 설정"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">총 수임료 (원)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={totalFeeStr}
                  onChange={(e) => handleCurrencyInput(e.target.value, setTotalFeeStr)}
                  placeholder="1,500,000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-brand/30 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">착수금 (원)</label>
              <input 
                type="text" 
                value={downPaymentStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setDownPaymentStr)}
                placeholder="300,000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-brand/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">분납 횟수</label>
              <select 
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand/30 outline-none bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                  <option key={n} value={n}>{n === 1 ? '일시납' : `${n}회 분납`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">법원 예납금 (원)</label>
              <input 
                type="text" 
                value={courtDepositStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setCourtDepositStr)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 focus:ring-2 focus:ring-brand/30 outline-none"
              />
            </div>
          </div>

          {/* 계산 결과 안내 바 */}
          <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100 flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand" />
              예상 월 분납액: <span className="text-brand font-mono text-sm ml-1 font-extrabold">{formatCurrency(monthlyInstallment)}원 / 월</span>
            </span>
            <span className="text-[11px] text-indigo-800">
              (총 {formatCurrency(totalFee)}원 - 착수금 {formatCurrency(downPayment)}원 ÷ {installments}회)
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">수임료 안내 메모 (고객 전달)</label>
            <input 
              type="text"
              value={feeMemo}
              onChange={(e) => setFeeMemo(e.target.value)}
              placeholder="예: 착수금 30만원 결제 후 매월 분납 가능 (송달료/인지대 포함 패키지)"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-brand/30 outline-none"
            />
          </div>
        </section>

        {/* ── 4. 변호사 종합 소견 (템플릿 삽입 / AI 연동) ── */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand" />
              변호사 종합 소견
              {isAIPremium && (
                <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  AI 어시스턴트 지원
                </span>
              )}
            </h3>

            <span className="text-[11px] text-slate-400 font-mono">{lawyerOpinion.length}자</span>
          </div>

          <textarea 
            value={lawyerOpinion}
            onChange={(e) => setLawyerOpinion(e.target.value)}
            placeholder="고객에게 전달할 솔루션과 소견을 작성하세요."
            rows={5}
            className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-brand/30 outline-none resize-y leading-relaxed font-sans"
          />
        </section>

        {/* ── 5. 진행 특이사항 ── */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              진행 특이사항 (주의점 및 소명 포인트)
            </h3>
          </div>

          <div className="space-y-2">
            {specialNotes.map((note, idx) => (
              <div key={idx} className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 text-xs text-amber-950">
                <span className="font-medium">• {note}</span>
                <button 
                  onClick={() => setSpecialNotes(specialNotes.filter((_, i) => i !== idx))}
                  className="text-amber-600 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {isAddingNote ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="특이사항 입력"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
                  autoFocus
                />
                <button onClick={handleAddNote} className="px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold">추가</button>
                <button onClick={() => setIsAddingNote(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingNote(true)}
                className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                특이사항 항목 직접 추가
              </button>
            )}
          </div>
        </section>

        {/* ── 6. 의뢰인 질문 & 1:1 맞춤 답변 (스마트 스니펫 연동) ── */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand" />
              의뢰인 질문에 대한 1:1 답변
            </h3>

            <button
              onClick={() => {
                setTemplateModalDefaultTab('qa');
                setIsTemplateModalOpen(true);
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              Q&A 스니펫 설정
            </button>
          </div>

          {clientQuestions.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              고객이 남긴 추가 질문이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {clientQuestions.map((q, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-xs text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      고객 사연/질문
                    </span>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">{q}</p>
                  </div>

                  {/* 빠른 답변 스니펫 추천 바 */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400">빠른 답변 삽입:</span>
                    {qaSnippets.map(snip => (
                      <button
                        key={snip.id}
                        onClick={() => handleApplyQASnippet(idx, snip)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-white hover:bg-brand hover:text-white text-slate-700 border border-slate-200 transition-all"
                      >
                        💬 {snip.keyword}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={clientAnswers[idx] || ''}
                    onChange={(e) => setClientAnswers({ ...clientAnswers, [idx]: e.target.value })}
                    placeholder="이 사연/질문에 대한 변호사 답변을 입력하세요."
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand/30 resize-none leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 7. AI 프리미엄 전용 리포트 동봉 설정 ── */}
        {isAIPremium && aiAnalysis && (
          <section className="bg-gradient-to-br from-[#1E3A5F]/5 to-transparent rounded-2xl p-5 border border-[#1E3A5F]/20 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E3A5F] flex items-center gap-2">
                <Microscope className="w-4 h-4" />
                AI 정밀 분석 리포트 동봉 설정
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">재무 수지 분석표</span>
                <input 
                  type="checkbox" 
                  checked={includeFinancialAnalysis} 
                  onChange={e => setIncludeFinancialAnalysis(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">위험 요인 진단서</span>
                <input 
                  type="checkbox" 
                  checked={includeRiskReport} 
                  onChange={e => setIncludeRiskReport(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">관할 법원 실무 팁</span>
                <input 
                  type="checkbox" 
                  checked={includeCourtNotes} 
                  onChange={e => setIncludeCourtNotes(e.target.checked)}
                  className="rounded text-brand focus:ring-brand"
                />
              </label>
            </div>
          </section>
        )}

      </div>

      {/* 템플릿 & 수임료 관리 모달 */}
      <TemplateManageModal
        lawyerId={consultRequest?.selectedLawyerId || 'default'}
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        defaultTab={templateModalDefaultTab}
      />
    </div>
  );
};

export default LawyerProposalDraft;
