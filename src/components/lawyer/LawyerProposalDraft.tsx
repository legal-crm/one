import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, FileText, AlertTriangle, Scale, Plus, Trash2, 
  Send, Sparkles, User, MessageSquare, Clock, Eye, Edit3, Settings,
  ShieldAlert, ShieldCheck, Microscope, Info, ArrowUpRight, Zap
} from 'lucide-react';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import { useProposalTemplates, OpinionTemplate, FeePreset, QASnippet } from '../../hooks/useProposalTemplates';
import { TemplateManageModal } from './TemplateManageModal';
import { ProposalDraftState } from '../../hooks/useProposalDraft';
import { toast } from 'sonner';

export interface AIAnalysisData {
  factSummary: {
    disposableIncome: number;
    totalDebt: number;
    securedDebt: number;
    unsecuredDebt: number;
    taxDebt: number;
    monthlyIncome: number;
    monthlyExpense: number;
    dependents: number;
    assets: {
      netAssetValue: number;
      effectiveLiquidationValue?: number;
    };
  };
  riskFlags: Array<{
    flagType: string;
    message: string;
  }>;
  missingFields: string[];
  conflicts: string[];
  reviewGrade?: string;
  courtPracticeNotes?: string;
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
    court: string;
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

interface LawyerProposalDraftProps {
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  consultRequest?: any;
  onClose: () => void;
  onSendProposal: (proposalData: ProposalData) => void;
  viewerRole?: 'lawyer' | 'staff' | 'reviewer';
  onRequestConfirm?: (proposalData: ProposalData, memo: string) => void;
  onApproveProposal?: (proposalData: ProposalData) => void;
  onRejectProposal?: (reason: string) => void;
  pendingStaffName?: string;
  aiAnalysis?: AIAnalysisData;
  mode?: 'modal' | 'embedded';
  initialDraft?: ProposalDraftState | null;
  onDraftChange?: (draft: ProposalDraftState) => void;
  activeViewMode?: 'editor' | 'preview';
  onToggleViewMode?: (mode: 'editor' | 'preview') => void;
  lawyerInfo?: {
    name: string;
    firmName?: string;
    avatar?: string;
  };
}

const fmtNum = (n: number) => n.toLocaleString('ko-KR');

// 5대 핵심 실무 전략 태그 칩
const STRATEGY_CHIPS = [
  {
    tag: '#주식코인손실탕감',
    text: '\n• [주식/코인 투자손실 방어]: 손실금의 청산가치 과다 반영을 차단하여 원금 탕감률을 최대화하도록 소명하겠습니다.'
  },
  {
    tag: '#서울회생법원특칙',
    text: '\n• [관할법원 실무준칙 적용]: 관할 법원의 실무준칙에 의거하여 보정권고 횟수를 최소화하고 빠른 개시결정을 유도합니다.'
  },
  {
    tag: '#급여압류신속해제',
    text: '\n• [압류 및 독촉 즉시중단]: 접수 즉시 금지명령·중지명령을 신청하여 급여 압류를 조기에 해제하고 생계비를 보장합니다.'
  },
  {
    tag: '#생계비추가인정',
    text: '\n• [가계 수지 최적화]: 실제 지출 중인 주거비(월세) 및 필수 의료비를 추가 생계비로 반영시켜 월 변제금을 최소화합니다.'
  },
  {
    tag: '#배우자재산미반영',
    text: '\n• [배우자 재산 방어]: 원칙적으로 배우자 명의 재산을 청산가치에 반영하지 않도록 법리적으로 완벽히 방어합니다.'
  }
];

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
  mode = 'embedded',
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
      notes.push(`투기성 손실 ${formatCurrency(rehabUserInput.speculativeLoss)} 존재 (주식/코인)`);
    }
    if ((rehabUserInput as any).gamblingLoss && (rehabUserInput as any).gamblingLoss > 0) {
      notes.push(`도박/사행성 손실 ${formatCurrency((rehabUserInput as any).gamblingLoss)}`);
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

  // Section 3: Fees State (3자리 콤마 기본 적용)
  const [totalFeeStr, setTotalFeeStr] = useState(() => {
    if (initialDraft?.totalFeeStr) {
      const num = parseInt(initialDraft.totalFeeStr.replace(/,/g, ''), 10);
      return isNaN(num) ? '1,500,000' : fmtNum(num);
    }
    return '1,500,000';
  });
  const [downPaymentStr, setDownPaymentStr] = useState(() => {
    if (initialDraft?.downPaymentStr) {
      const num = parseInt(initialDraft.downPaymentStr.replace(/,/g, ''), 10);
      return isNaN(num) ? '300,000' : fmtNum(num);
    }
    return '300,000';
  });
  const [installments, setInstallments] = useState<number>(initialDraft?.installments ?? 5);
  const [courtDepositStr, setCourtDepositStr] = useState(() => {
    if (initialDraft?.courtDepositStr) {
      const num = parseInt(initialDraft.courtDepositStr.replace(/,/g, ''), 10);
      return isNaN(num) ? '300,000' : fmtNum(num);
    }
    return '300,000';
  });
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
  const courtName = (rehabCalcResult as any).court || consultRequest?.financialProfile?.selectedCourt || '서울회생법원';
  
  const defaultOpinion = useMemo(() => {
    if (aiAnalysis) {
      return `개인회생 진행이 가능한 것으로 분석되었습니다.\n\n현재 월 가용소득은 약 ${formatCurrency(aiAnalysis.factSummary.disposableIncome)}으로 산출되며, 예상 변제 기간 ${rehabCalcResult.repaymentMonths}개월 동안 성실히 납부 시 총 채무의 약 ${rehabCalcResult.debtReductionRate}%를 법적으로 면책받으실 수 있습니다.\n\n${courtName}의 실무 기준에 맞추어 사건 접수 즉시 금지명령을 신청하여 독촉과 압류를 중단시키고, 인가 결정을 최단기간에 이끌어내겠습니다.`;
    }
    return `개인회생 신청 적격 대상자로 분석됩니다.\n\n의뢰인님의 소득과 생계비를 종합 고려하여 월 최저 변제금(${formatCurrency(rehabCalcResult.monthlyPayment)})으로 인가받을 수 있도록 최적의 변제계획안을 수립하겠습니다.\n\n접수 즉시 금지명령을 통해 모든 채권 추심과 압류를 신속히 중단시켜 드리겠습니다.`;
  }, [aiAnalysis, rehabCalcResult, courtName]);

  const [lawyerOpinion, setLawyerOpinion] = useState(initialDraft?.lawyerOpinion ?? defaultOpinion);

  // Section 5: Client Q&A State
  const initialQuestions = useMemo(() => {
    const questions: string[] = [];
    const notes = consultRequest?.financialProfile?.clientNotes;
    if (Array.isArray(notes)) {
      notes.forEach(note => {
        if (typeof note === 'string' && note.trim()) questions.push(note);
      });
    }
    const singleNote = consultRequest?.financialProfile?.clientNote || consultRequest?.content;
    if (typeof singleNote === 'string' && singleNote.trim() && !questions.includes(singleNote)) {
      questions.push(singleNote.length > 80 ? singleNote.slice(0, 80) + '...' : singleNote);
    }
    return Array.from(new Set(questions));
  }, [consultRequest]);

  const [clientQuestions, setClientQuestions] = useState<string[]>(initialQuestions);
  const [clientAnswers, setClientAnswers] = useState<Record<number, string>>(initialDraft?.clientAnswers ?? {});

  // ── 외부(ClientReferencePanel) 이벤트 리스너 연동 ──
  // 1. 고객 질문 인용 이벤트 (proposal-quote-question)
  useEffect(() => {
    const handleQuote = (e: any) => {
      const { question, defaultAnswer } = e.detail || {};
      if (!question) return;

      setClientQuestions(prev => {
        const existingIdx = prev.indexOf(question);
        if (existingIdx >= 0) {
          // 이미 존재하면 답변만 업데이트
          if (defaultAnswer) {
            setClientAnswers(ans => ({ ...ans, [existingIdx]: defaultAnswer }));
          }
          toast.success(`Q${existingIdx + 1} 질문에 추천 답변이 적용되었습니다.`);
          return prev;
        } else {
          // 새로 추가
          const nextIdx = prev.length;
          if (defaultAnswer) {
            setClientAnswers(ans => ({ ...ans, [nextIdx]: defaultAnswer }));
          }
          toast.success(`고객 질문이 Q&A 섹션에 성공적으로 추가되었습니다.`);
          return [...prev, question];
        }
      });
    };

    document.addEventListener('proposal-quote-question', handleQuote);
    return () => document.removeEventListener('proposal-quote-question', handleQuote);
  }, []);

  // 2. AI 변제금 플랜 적용 이벤트 (proposal-apply-plan)
  useEffect(() => {
    const handleApplyPlan = (e: any) => {
      const { monthlyPayment, months, reductionRate, name } = e.detail || {};
      if (!monthlyPayment) return;

      const planSummary = `\n[적용 플랜: ${name || 'AI 추천안'}] 월 변제금 ${formatCurrency(monthlyPayment)}, 변제기간 ${months}개월 (예상 탕감률 약 ${reductionRate}%)`;
      
      setLawyerOpinion(prev => {
        if (prev.includes(planSummary.trim())) return prev;
        return prev + '\n' + planSummary;
      });

      toast.success(`${name || 'AI 추천안'} 플랜이 제안서 소견에 반영되었습니다.`);
    };

    document.addEventListener('proposal-apply-plan', handleApplyPlan);
    return () => document.removeEventListener('proposal-apply-plan', handleApplyPlan);
  }, []);

  // Draft 변경 알림 (자동 임시저장)
  useEffect(() => {
    if (onDraftChange) {
      onDraftChange({
        totalFeeStr, downPaymentStr, installments, courtDepositStr, feeMemo,
        lawyerOpinion, specialNotes, clientAnswers,
        includeFinancialAnalysis, includeRiskReport, includeCourtNotes,
      });
    }
  }, [totalFeeStr, downPaymentStr, installments, courtDepositStr, feeMemo, lawyerOpinion, specialNotes, clientAnswers, includeFinancialAnalysis, includeRiskReport, includeCourtNotes, onDraftChange]);

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
      court: courtName
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
    toast.success(`'${tpl.title}' 템플릿이 적용되었습니다.`);
  };

  // 수임료 패키지 원클릭 적용 핸들러
  const handleApplyFeePreset = (preset: FeePreset) => {
    setTotalFeeStr(fmtNum(preset.totalFee));
    setDownPaymentStr(fmtNum(preset.downPayment));
    setInstallments(preset.installments);
    setCourtDepositStr(fmtNum(preset.courtDeposit));
    if (preset.memo) setFeeMemo(preset.memo);
    toast.success(`'${preset.label}' 패키지가 적용되었습니다.`);
  };

  // Q&A 빠른 답변 스니펫 적용 핸들러
  const handleApplyQASnippet = (questionIdx: number, snippet: QASnippet) => {
    setClientAnswers(prev => ({
      ...prev,
      [questionIdx]: snippet.answer
    }));
  };

  // 전략 태그 칩 클릭 시 소견에 추가
  const handleAddStrategyTag = (chip: typeof STRATEGY_CHIPS[0]) => {
    if (lawyerOpinion.includes(chip.text.trim())) {
      toast('이미 해당 전략 문단이 포함되어 있습니다.');
      return;
    }
    setLawyerOpinion(prev => prev.trim() + '\n' + chip.text);
    toast.success(`${chip.tag} 전략 문구가 소견에 추가되었습니다.`);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      setSpecialNotes([...specialNotes, newNote.trim()]);
      setNewNote('');
      setIsAddingNote(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // VIEW: 1. 실시간 고객 시점 미리보기 (Live Preview Card)
  // ═════════════════════════════════════════════════════════════════════
  if (activeViewMode === 'preview') {
    return (
      <div className="h-full bg-slate-100 p-6 overflow-y-auto flex flex-col items-center">
        <div className="max-w-xl w-full space-y-4 animate-fadeIn">
          
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span className="font-bold">고객 수신 화면 실시간 미리보기</span>
            </div>
            <span className="text-[11px] text-blue-600 bg-white px-2 py-0.5 rounded-md font-medium border border-blue-100">
              카카오톡/웹 제안서 규격
            </span>
          </div>

          {/* 실제 고객이 보게 될 제안서 카드 규격 */}
          <div className="bg-white border-2 border-[#1E3A5F] rounded-3xl p-6 shadow-lg space-y-5">
            {/* 상단 변호사 정보 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {lawyerInfo?.avatar ? (
                  <img src={lawyerInfo.avatar} alt="변호사" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center font-black text-lg">
                    {lawyerInfo?.name?.charAt(0) || '변'}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-400">{lawyerInfo?.firmName || '도산전문 법률사무소'}</div>
                  <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    {lawyerInfo?.name || '담당 변호사'}
                    <span className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded-full font-bold">인증 변호사</span>
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

            {/* 진단 결과 핵심 박스 */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">진단 결과</span>
                <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {rehabCalcResult.status === 'POSSIBLE' ? '✓ 개인회생 신청 적격' : '⚠️ 보완 필요'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">월 예상 변제금</span>
                  <span className="text-sm font-black text-[#1E3A5F] font-mono">{formatCurrency(rehabCalcResult.monthlyPayment)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">변제 기간</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{rehabCalcResult.repaymentMonths}개월</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">예상 감면율</span>
                  <span className="text-sm font-black text-rose-600 font-mono">약 {rehabCalcResult.debtReductionRate}%</span>
                </div>
              </div>
            </div>

            {/* 변호사 의견 */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E3A5F]" />
                변호사 종합 검토 소견
              </h4>
              <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                {lawyerOpinion || '작성된 변호사 소견이 없습니다.'}
              </div>
            </div>

            {/* 수임료 및 분납 조건 */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[#1E3A5F]" />
                예상 수임료 및 분납 안내
              </h4>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">총 수임료</span>
                <span className="font-extrabold text-slate-900 font-mono text-sm">{formatCurrency(totalFee)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">착수금</span>
                <span className="font-bold text-slate-700 font-mono">{formatCurrency(downPayment)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                <span className="font-bold text-[#1E3A5F]">월 분납금 ({installments}회)</span>
                <span className="font-black text-[#1E3A5F] font-mono text-sm">{formatCurrency(monthlyInstallment)} / 월</span>
              </div>
              {feeMemo && (
                <p className="text-[11px] text-slate-500 pt-1 leading-snug">• {feeMemo}</p>
              )}
            </div>

            {/* Q&A 리스트 */}
            {clientQuestions.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#1E3A5F]" />
                  고객님 질문에 대한 답변
                </h4>
                {clientQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800">Q. {q}</p>
                    <p className="text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                      {clientAnswers[idx] || '변호사가 직접 상담 시 상세히 답변드릴 예정입니다.'}
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // VIEW: 2. 제안서 에디터 렌더링 (Speed Proposal Builder)
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto font-sans text-left">
      
      {/* ── 1. 맞춤 소견 템플릿 바 (가로 스크롤 칩) ── */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-5 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
            원클릭 소견 템플릿
          </span>
          <button
            onClick={() => {
              setTemplateModalDefaultTab('opinion');
              setIsTemplateModalOpen(true);
            }}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <Settings className="w-3 h-3 text-slate-500" />
            템플릿 설정
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {opinionTemplates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white hover:bg-[#1E3A5F] hover:text-white border border-slate-200 hover:border-[#1E3A5F] text-slate-700 transition-all active:scale-95 whitespace-nowrap shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>💡</span>
              <span>{tpl.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-5 flex-1 pb-24">
        
        {/* ── 2. 슬림형 진단 요약 스트립 ── */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">진단 월 변제금</span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">{formatCurrency(rehabCalcResult.monthlyPayment)}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">변제 기간</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{rehabCalcResult.repaymentMonths}개월</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">예상 탕감률</span>
              <span className="font-mono font-extrabold text-[#1E3A5F] text-sm">약 {rehabCalcResult.debtReductionRate}%</span>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
            rehabCalcResult.status === 'POSSIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {rehabCalcResult.status === 'POSSIBLE' ? '✓ 신청 적격' : '⚠️ 보완 대상'}
          </span>
        </div>

        {/* ── 3. 예상 수임료 및 분납 패키지 (10초 퀵 프리셋) ── */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#1E3A5F]" />
              예상 수임료 및 분납 조건
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">퀵 프리셋:</span>
              {feePresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyFeePreset(preset)}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50 hover:bg-[#1E3A5F] hover:text-white text-indigo-700 border border-indigo-100 transition-all active:scale-95 cursor-pointer"
                >
                  ⚡ {preset.label.split('(')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">총 수임료 (원)</label>
              <input 
                type="text" 
                value={totalFeeStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setTotalFeeStr)}
                placeholder="1,500,000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">착수금 (원)</label>
              <input 
                type="text" 
                value={downPaymentStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setDownPaymentStr)}
                placeholder="300,000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">분납 횟수</label>
              <select 
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none bg-white"
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
                placeholder="300,000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none"
              />
            </div>
          </div>

          {/* 월 분납액 계산 안내 */}
          <div className="bg-indigo-50/60 rounded-xl p-2.5 border border-indigo-100 flex items-center justify-between text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1E3A5F]" />
              예상 월 분납액: <span className="text-[#1E3A5F] font-mono text-sm ml-1 font-black">{formatCurrency(monthlyInstallment)} / 월</span>
            </span>
            <span className="text-[11px] text-indigo-800">
              (총 {formatCurrency(totalFee)} - 착수금 {formatCurrency(downPayment)} ÷ {installments}회)
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">수임료 안내 메모 (고객 전달용)</label>
            <input 
              type="text"
              value={feeMemo}
              onChange={(e) => setFeeMemo(e.target.value)}
              placeholder="예: 착수금 30만원 결제 후 5회 분납 가능 (송달료 및 인지대 포함)"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none"
            />
          </div>
        </section>

        {/* ── 4. 변호사 종합 소견 & 맞춤 전략 태그 칩 ── */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E3A5F]" />
                변호사 종합 소견 및 전략
              </h3>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                AI 지원
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLawyerOpinion(defaultOpinion);
                  toast.success('AI 추천 소견이 재작성되었습니다.');
                }}
                className="text-[11px] font-bold text-[#1E3A5F] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#1E3A5F]" />
                AI 맞춤 소견 자동완성
              </button>
              <span className="text-[11px] text-slate-400 font-mono">{lawyerOpinion.length}자</span>
            </div>
          </div>

          {/* 전략 태그 칩 리스트 (클릭 시 소견 본문에 자동 추가) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-bold text-slate-400">전략 문단 추가:</span>
            {STRATEGY_CHIPS.map(chip => (
              <button
                key={chip.tag}
                onClick={() => handleAddStrategyTag(chip)}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 hover:bg-[#1E3A5F] hover:text-white text-slate-700 border border-slate-200 transition-all active:scale-95 cursor-pointer"
              >
                + {chip.tag}
              </button>
            ))}
          </div>

          <textarea 
            value={lawyerOpinion}
            onChange={(e) => setLawyerOpinion(e.target.value)}
            placeholder="고객에게 전달할 솔루션과 소견을 작성하세요. 좌측의 고객 사연과 질문을 참고하여 작성하시면 더욱 좋습니다."
            rows={6}
            className="w-full rounded-xl border border-slate-200 p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-[#1E3A5F]/30 outline-none resize-y leading-relaxed font-sans"
          />
        </section>

        {/* ── 5. 의뢰인 질문 & 1:1 맞춤 답변 (Q&A) ── */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#1E3A5F]" />
                의뢰인 질문에 대한 1:1 맞춤 답변
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold font-mono">
                {clientQuestions.length}건
              </span>
            </div>

            <button
              onClick={() => {
                setTemplateModalDefaultTab('qa');
                setIsTemplateModalOpen(true);
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              Q&A 스니펫 관리
            </button>
          </div>

          {clientQuestions.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              고객 질문이 없습니다. 좌측 패널의 [제안서 Q&A에 답변 삽입 ↗] 버튼을 누르면 즉시 추가됩니다.
            </div>
          ) : (
            <div className="space-y-3">
              {clientQuestions.map((q, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        질문 {idx + 1}
                      </span>
                      <p className="text-xs text-slate-800 font-bold leading-relaxed">{q}</p>
                    </div>

                    <button
                      onClick={() => {
                        setClientQuestions(clientQuestions.filter((_, i) => i !== idx));
                        const nextAns = { ...clientAnswers };
                        delete nextAns[idx];
                        setClientAnswers(nextAns);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="질문 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 빠른 답변 스니펫 바 */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">빠른 답변:</span>
                    {qaSnippets.map(snip => (
                      <button
                        key={snip.id}
                        onClick={() => handleApplyQASnippet(idx, snip)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-white hover:bg-[#1E3A5F] hover:text-white text-slate-700 border border-slate-200 transition-all cursor-pointer"
                      >
                        💬 {snip.keyword}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={clientAnswers[idx] || ''}
                    onChange={(e) => setClientAnswers({ ...clientAnswers, [idx]: e.target.value })}
                    placeholder="이 질문에 대한 전문 답변을 입력하세요."
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 resize-none leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 6. 쟁점 특이사항 체크리스트 ── */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              쟁점 및 특이사항 체크리스트
            </h3>
          </div>

          <div className="space-y-2">
            {specialNotes.map((note, idx) => (
              <div key={idx} className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 text-xs text-amber-950">
                <span className="font-medium">• {note}</span>
                <button 
                  onClick={() => setSpecialNotes(specialNotes.filter((_, i) => i !== idx))}
                  className="text-amber-600 hover:text-rose-600 p-1 cursor-pointer"
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
                  placeholder="특이사항 직접 입력"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
                  autoFocus
                />
                <button onClick={handleAddNote} className="px-3 py-1.5 bg-[#1E3A5F] text-white rounded-xl text-xs font-bold cursor-pointer">추가</button>
                <button onClick={() => setIsAddingNote(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs cursor-pointer">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingNote(true)}
                className="text-xs font-bold text-[#1E3A5F] hover:text-[#163152] flex items-center gap-1 py-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                특이사항 항목 직접 추가
              </button>
            )}
          </div>
        </section>

        {/* ── 7. AI 프리미엄 리포트 동봉 설정 ── */}
        {isAIPremium && aiAnalysis && (
          <section className="bg-gradient-to-br from-[#1E3A5F]/5 to-transparent rounded-2xl p-4 border border-[#1E3A5F]/20 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#1E3A5F] flex items-center gap-2">
                <Microscope className="w-4 h-4" />
                AI 정밀 분석 리포트 동봉 설정
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">재무 수지 분석표</span>
                <input 
                  type="checkbox" 
                  checked={includeFinancialAnalysis} 
                  onChange={e => setIncludeFinancialAnalysis(e.target.checked)}
                  className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">위험 요인 진단서</span>
                <input 
                  type="checkbox" 
                  checked={includeRiskReport} 
                  onChange={e => setIncludeRiskReport(e.target.checked)}
                  className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="text-xs font-bold text-slate-800">관할 법원 실무 팁</span>
                <input 
                  type="checkbox" 
                  checked={includeCourtNotes} 
                  onChange={e => setIncludeCourtNotes(e.target.checked)}
                  className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F]"
                />
              </label>
            </div>
          </section>
        )}

      </div>

      {/* ── 모달 모드 전용 액션 푸터 (임베디드가 아닌 단독 모달 호출 시 대응) ── */}
      {!isEmbedded && (
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors active:scale-[0.98] min-h-[44px] whitespace-nowrap cursor-pointer"
          >
            닫기
          </button>
          <button
            onClick={() => onSendProposal(getProposalData())}
            className="px-6 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-extrabold text-xs shadow-md flex items-center gap-2 transition-all active:scale-[0.98] min-h-[44px] whitespace-nowrap cursor-pointer"
          >
            <Send className="w-4 h-4" />
            고객에게 제안서 발송하기
          </button>
        </footer>
      )}

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
