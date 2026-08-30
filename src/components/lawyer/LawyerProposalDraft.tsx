import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Send, 
  AlertTriangle, 
  Calculator, 
  MessageSquare, 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Scale, 
  Clock,
  Microscope,
  TrendingUp,
  Shield,
  Building2,
  Eye,
  EyeOff
} from 'lucide-react';
import { RehabCalculationResult, RehabUserInput, formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import type { ReviewFlag, CourtPracticeNote } from '../../types/copilot';
import type { MissingField, InputConflict } from '../../engines/factEngine';

// ── AI 분석 데이터 타입 ──
export interface AIAnalysisData {
  factSummary: {
    totalDebt: number;
    securedDebt: number;
    unsecuredDebt: number;
    taxDebt: number;
    monthlyIncome: number;
    monthlyExpense: number;
    disposableIncome: number;
    dependents: number;
    creditorCount: number;
    assets: {
      totalMarketValue: number;
      totalLoanBalance: number;
      netAssetValue: number;
      hasRealEstate: boolean;
      hasVehicle: boolean;
      hasInsurance: boolean;
      hasSeverance: boolean;
      hasStock: boolean;
      spouseAssetCount: number;
    };
    recentDebts: { creditor: string; principal: number; isRecent: boolean }[];
    delinquencyStatus: string;
    seizureStatus: string;
    previousHistory: boolean;
    delinquencyMonths: number;
  };
  riskFlags: ReviewFlag[];
  missingFields: MissingField[];
  conflicts: InputConflict[];
  reviewGrade: 'NORMAL_REVIEW' | 'ENHANCED_REVIEW' | 'SECOND_REVIEW';
  courtPracticeNotes: CourtPracticeNote[];
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
  aiAnalysis?: AIAnalysisData;  // AI 프리미엄 분석 데이터 (optional)
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

// ── AI 초안 의견 자동 생성 (룰 기반 템플릿) ──
function generateAIOpinionDraft(
  rehabResult: RehabCalculationResult,
  aiData: AIAnalysisData
): string {
  const parts: string[] = [];

  if (rehabResult.status === 'POSSIBLE' || rehabResult.status === '가능') {
    parts.push('개인회생 진행이 가능한 것으로 분석됩니다.');
  } else if (rehabResult.status === 'DIFFICULT' || rehabResult.status === '어려움') {
    parts.push('현재 조건에서 개인회생 진행에 추가 검토가 필요합니다.');
  } else {
    parts.push('현재 조건으로는 개인회생 진행이 어려운 것으로 분석됩니다. 다른 채무 해결 방안을 함께 검토해 드리겠습니다.');
  }

  const disposable = aiData.factSummary.disposableIncome;
  if (disposable > 0) {
    parts.push(`월 가용소득은 약 ${formatCurrency(disposable)}원으로 산출되며, 변제 기간은 ${rehabResult.repaymentMonths}개월, 예상 탕감률은 ${rehabResult.debtReductionRate}%입니다.`);
  } else {
    parts.push('현재 소득 대비 생계비를 고려하면 가용소득이 부족한 상황입니다. 소득 증빙 방법에 따라 결과가 달라질 수 있으므로 상담 시 구체적으로 안내드리겠습니다.');
  }

  const highRisks = aiData.riskFlags.filter(f => f.flagType === 'HIGH_RISK');
  const cautions = aiData.riskFlags.filter(f => f.flagType === 'CAUTION');
  if (highRisks.length > 0) {
    parts.push(`주의가 필요한 사항이 ${highRisks.length}건 확인되었습니다. 상담 시 해당 부분에 대해 자세히 안내드리겠습니다.`);
  }
  if (cautions.length > 0) {
    parts.push(`참고하실 사항이 ${cautions.length}건 있으며, 절차 진행 시 미리 준비하시면 도움이 됩니다.`);
  }

  const { taxDebt } = aiData.factSummary;
  if (taxDebt > 0) {
    parts.push(`채무 중 조세 채무(${formatCurrency(taxDebt)}원)가 포함되어 있어 우선변제 대상으로 별도 고려됩니다.`);
  }

  parts.push('구체적인 상담을 위해 최근 3개월 급여명세서, 채무 관련 서류, 재산 목록 등을 준비해 주시면 보다 정확한 안내가 가능합니다.');

  return parts.join('\n\n');
}

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
  aiAnalysis
}) => {
  const clientName = rehabUserInput.name || consultRequest?.clientName || consultRequest?.financialProfile?.clientName || '고객';
  const isAIPremium = !!aiAnalysis;

  // ── AI 프리미엄 섹션 의뢰인 공개 토글 ──
  const [includeFinancialAnalysis, setIncludeFinancialAnalysis] = useState(true);
  const [includeRiskReport, setIncludeRiskReport] = useState(true);
  const [includeCourtNotes, setIncludeCourtNotes] = useState(true);

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
    
    // 청산가치 보장 주의 (if liquidation value is close to total repayment)
    const totalRepayment = rehabCalcResult.monthlyPayment * rehabCalcResult.repaymentMonths;
    if (rehabUserInput.totalAssets && rehabUserInput.totalAssets > totalRepayment * 0.8) {
      notes.push('청산가치 보장 주의 (재산 가치가 총 변제금과 비슷하거나 높음)');
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

  const [specialNotes, setSpecialNotes] = useState<string[]>(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Section 3: Fees State
  const [totalFeeStr, setTotalFeeStr] = useState('');
  const [downPaymentStr, setDownPaymentStr] = useState('');
  const [installments, setInstallments] = useState<number>(5);
  const [courtDepositStr, setCourtDepositStr] = useState('300000');
  const [feeMemo, setFeeMemo] = useState('');

  const totalFee = parseInt(totalFeeStr.replace(/,/g, ''), 10) || 0;
  const downPayment = parseInt(downPaymentStr.replace(/,/g, ''), 10) || 0;
  const courtDeposit = parseInt(courtDepositStr.replace(/,/g, ''), 10) || 0;
  const monthlyInstallment = Math.max(0, Math.floor((totalFee - downPayment) / installments));

  const handleCurrencyInput = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const numOnly = value.replace(/[^0-9]/g, '');
    if (numOnly) {
      setter(fmtNum(parseInt(numOnly, 10)));
    } else {
      setter('');
    }
  };

  // Section 4: Lawyer Opinion (AI 프리미엄: 초안 자동 생성)
  const aiDraftOpinion = useMemo(() => {
    if (aiAnalysis) {
      return generateAIOpinionDraft(rehabCalcResult, aiAnalysis);
    }
    return '';
  }, [aiAnalysis, rehabCalcResult]);
  const [lawyerOpinion, setLawyerOpinion] = useState(aiDraftOpinion);

  // AI 초안이 로드되면 의견이 비어있을 때만 자동 채우기
  useEffect(() => {
    if (aiDraftOpinion && !lawyerOpinion) {
      setLawyerOpinion(aiDraftOpinion);
    }
  }, [aiDraftOpinion]);

  // Section 5: Client Q&A
  const clientQuestions = useMemo(() => {
    const questions: string[] = [];
    const notes = consultRequest?.financialProfile?.clientNotes;
    if (Array.isArray(notes)) {
      notes.forEach(note => {
        if (typeof note === 'string' && note.trim()) questions.push(note);
      });
    }
    const singleNote = consultRequest?.financialProfile?.clientNote;
    if (typeof singleNote === 'string' && singleNote.trim()) {
      questions.push(singleNote);
    }
    // Remove duplicates
    return Array.from(new Set(questions));
  }, [consultRequest]);

  const [clientAnswers, setClientAnswers] = useState<Record<number, string>>({});

  // Staff confirmation memo state
  const [showStaffMemo, setShowStaffMemo] = useState(false);
  const [staffMemo, setStaffMemo] = useState('');
  // Reviewer rejection state
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Derived Summary Values
  const totalDebt = rehabUserInput.totalDebt || 0;
  const totalRepayment = rehabCalcResult.monthlyPayment * rehabCalcResult.repaymentMonths;
  const estimatedReduction = Math.max(0, totalDebt - totalRepayment);
  
  const getStatusInfo = (status: string) => {
    if (status === 'POSSIBLE' || status === '가능') return { color: 'text-green-600 bg-green-50 border-green-200', label: '진행 가능' };
    if (status === 'DIFFICULT' || status === '어려움') return { color: 'text-amber-600 bg-amber-50 border-amber-200', label: '진행 어려움' };
    return { color: 'text-red-600 bg-red-50 border-red-200', label: '진행 불가' };
  };
  const statusInfo = getStatusInfo(rehabCalcResult.status);

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
      court: (rehabCalcResult as any).court || '관할 법원 미정'
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
        riskFlags: aiAnalysis.riskFlags.map(f => ({
          type: f.flagType,
          message: f.message,
        })),
        reviewGrade: aiAnalysis.reviewGrade,
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

  const handleSubmit = () => {
    onSendProposal(getProposalData());
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      setSpecialNotes([...specialNotes, newNote.trim()]);
      setNewNote('');
      setIsAddingNote(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#7264FF]" />
              {viewerRole === 'reviewer' ? '제안서 컨펌 요청' : '고객 제안서 초안'}
              {isAIPremium && (
                <span className="ml-1 inline-flex items-center gap-1 bg-[#1E3A5F]/10 text-[#1E3A5F] text-xs font-bold px-2.5 py-1 rounded-lg border border-[#1E3A5F]/20">
                  <Microscope className="w-3.5 h-3.5" />
                  AI 정밀 분석
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {clientName}님 · 개인회생 진단 결과
              {viewerRole === 'reviewer' && pendingStaffName && (
                <span className="ml-2 inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-lg">📋 작성: {pendingStaffName}</span>
              )}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-[0.98]"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Diagnosis Summary */}
          <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-slate-600" />
              진단 요약
            </h3>
            
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-xl p-4 border border-[#7264FF]/10">
                <div className="text-xs text-[#7264FF] font-medium mb-1">예상 월 변제금</div>
                <div className="text-lg font-bold text-slate-800">{formatCurrency(rehabCalcResult.monthlyPayment)}원</div>
              </div>
              <div className="bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-xl p-4 border border-[#7264FF]/10">
                <div className="text-xs text-[#7264FF] font-medium mb-1">변제 기간</div>
                <div className="text-lg font-bold text-slate-800">{rehabCalcResult.repaymentMonths}개월</div>
              </div>
              <div className="bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-xl p-4 border border-[#7264FF]/10">
                <div className="text-xs text-[#7264FF] font-medium mb-1">예상 탕감률</div>
                <div className="text-lg font-bold text-slate-800">{rehabCalcResult.debtReductionRate}%</div>
              </div>
            </div>

            {/* AI 프리미엄: 채무 구조 분석 바 */}
            {isAIPremium && aiAnalysis && (() => {
              const { securedDebt, unsecuredDebt, taxDebt } = aiAnalysis.factSummary;
              const debtTotal = securedDebt + unsecuredDebt + taxDebt;
              if (debtTotal <= 0) return null;
              const secPct = Math.round((securedDebt / debtTotal) * 100);
              const unsecPct = Math.round((unsecuredDebt / debtTotal) * 100);
              const taxPct = 100 - secPct - unsecPct;
              return (
                <div className="mb-5 bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                    채무 구조 분석
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-5 mb-2.5">
                    {unsecPct > 0 && (
                      <div className="bg-[#7264FF] flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${unsecPct}%` }}>
                        {unsecPct > 10 ? `${unsecPct}%` : ''}
                      </div>
                    )}
                    {secPct > 0 && (
                      <div className="bg-sky-500 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${secPct}%` }}>
                        {secPct > 10 ? `${secPct}%` : ''}
                      </div>
                    )}
                    {taxPct > 0 && (
                      <div className="bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${taxPct}%` }}>
                        {taxPct > 10 ? `${taxPct}%` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#7264FF]" /> 무담보 {formatCurrency(unsecuredDebt)}원</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> 담보 {formatCurrency(securedDebt)}원</span>
                    {taxDebt > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 조세 {formatCurrency(taxDebt)}원</span>}
                  </div>
                </div>
              );
            })()}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-sm">
              <div className="flex border-b border-slate-100">
                <div className="w-1/3 bg-slate-50 p-3 text-slate-500 font-medium border-r border-slate-100">총 채무액</div>
                <div className="w-2/3 p-3 text-slate-800 font-semibold">{formatCurrency(totalDebt)}원</div>
              </div>
              <div className="flex border-b border-slate-100">
                <div className="w-1/3 bg-slate-50 p-3 text-slate-500 font-medium border-r border-slate-100">예상 총 변제금</div>
                <div className="w-2/3 p-3 text-slate-800">{formatCurrency(totalRepayment)}원</div>
              </div>
              <div className="flex border-b border-slate-100">
                <div className="w-1/3 bg-slate-50 p-3 text-slate-500 font-medium border-r border-slate-100">예상 탕감액</div>
                <div className="w-2/3 p-3 text-[#7264FF] font-bold">{formatCurrency(estimatedReduction)}원</div>
              </div>
              <div className="flex border-b border-slate-100">
                <div className="w-1/3 bg-slate-50 p-3 text-slate-500 font-medium border-r border-slate-100">진행 가능성</div>
                <div className="w-2/3 p-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {rehabCalcResult.statusReason && (
                    <p className="mt-1.5 text-xs text-slate-500">{rehabCalcResult.statusReason}</p>
                  )}
                </div>
              </div>
              <div className="flex">
                <div className="w-1/3 bg-slate-50 p-3 text-slate-500 font-medium border-r border-slate-100">적용 관할 법원</div>
                <div className="w-2/3 p-3 text-slate-700">{(rehabCalcResult as any).court || '관할 법원 미정'}</div>
              </div>
            </div>
          </section>

          {/* Section 2: Special Notes */}
          <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-600" />
                진행 특이사항
              </h3>
            </div>
            
            <div className="space-y-2">
              {specialNotes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-amber-50/50 border border-amber-200 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 leading-relaxed">{note}</span>
                  <button 
                    onClick={() => setSpecialNotes(specialNotes.filter((_, i) => i !== idx))}
                    className="p-1 hover:bg-amber-100 rounded-lg transition-colors shrink-0 text-amber-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {isAddingNote ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="특이사항을 입력하세요..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none"
                    autoFocus
                  />
                  <button 
                    onClick={handleAddNote}
                    className="px-4 py-2 bg-[#7264FF] text-white rounded-xl text-sm font-medium hover:bg-[#5f51e5] active:scale-[0.98] whitespace-nowrap"
                  >
                    추가
                  </button>
                  <button 
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNote('');
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 active:scale-[0.98] whitespace-nowrap"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingNote(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#7264FF] p-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  특이사항 추가
                </button>
              )}
            </div>
          </section>

          {/* Section 3: Fees Structure */}
          <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-slate-600" />
              예상 수임료 및 분납 조건
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">총 수임료</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={totalFeeStr}
                    onChange={(e) => handleCurrencyInput(e.target.value, setTotalFeeStr)}
                    placeholder="수임료 입력"
                    className="w-full rounded-xl border border-slate-200 pl-3 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">원</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">법원 예납금</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={courtDepositStr}
                    onChange={(e) => handleCurrencyInput(e.target.value, setCourtDepositStr)}
                    className="w-full rounded-xl border border-slate-200 pl-3 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">원</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">착수금</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={downPaymentStr}
                    onChange={(e) => handleCurrencyInput(e.target.value, setDownPaymentStr)}
                    placeholder="착수금 입력"
                    className="w-full rounded-xl border border-slate-200 pl-3 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">원</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">분납 횟수</label>
                <select 
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none bg-white"
                >
                  <option value={3}>3회 분납</option>
                  <option value={5}>5회 분납</option>
                  <option value={8}>8회 분납</option>
                  <option value={10}>10회 분납</option>
                  <option value={12}>12회 분납</option>
                </select>
              </div>

              <div className="col-span-2 bg-slate-100/50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  월 분납금 (예상)
                </span>
                <span className="text-lg font-bold text-[#7264FF]">
                  {totalFee > 0 ? formatCurrency(monthlyInstallment) : '0'}원
                </span>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">수임료 안내 메모 (선택)</label>
                <textarea 
                  value={feeMemo}
                  onChange={(e) => setFeeMemo(e.target.value)}
                  placeholder="추가 비용 발생 가능성 등 고객에게 안내할 내용을 메모하세요."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none resize-none min-h-[80px]"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Lawyer Opinion */}
          <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-600" />
              변호사 의견
              {isAIPremium && lawyerOpinion === aiDraftOpinion && (
                <span className="text-xs font-medium text-[#1E3A5F]/70 bg-[#1E3A5F]/8 px-2 py-0.5 rounded-lg border border-[#1E3A5F]/15">
                  AI 초안 · 수정 가능
                </span>
              )}
            </h3>
            
            <div className="relative">
              <textarea 
                value={lawyerOpinion}
                onChange={(e) => setLawyerOpinion(e.target.value)}
                placeholder="고객에게 전달할 종합 의견을 작성해주세요. (예: 회생 진행 시 예상 소요 기간, 주의사항, 필요 서류 등)"
                className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none resize-y min-h-[120px] pb-8"
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400 font-medium">
                {lawyerOpinion.length}자
              </div>
            </div>
            {isAIPremium && lawyerOpinion !== aiDraftOpinion && aiDraftOpinion && (
              <button
                onClick={() => setLawyerOpinion(aiDraftOpinion)}
                className="mt-2 text-xs text-[#1E3A5F] hover:text-[#1E3A5F]/80 font-medium flex items-center gap-1 transition-colors"
              >
                <Microscope className="w-3 h-3" />
                AI 초안으로 되돌리기
              </button>
            )}
          </section>

          {/* Section 5: Client Q&A */}
          <section className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-slate-600" />
              고객 질문 및 답변
            </h3>
            
            {clientQuestions.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">고객이 남긴 추가 질문이 없습니다</p>
                <p className="text-xs text-slate-500 mt-1">상담 요청 시 고객이 메모를 남기지 않았습니다</p>
              </div>
            ) : (
              <div className="space-y-6">
                {clientQuestions.map((question, idx) => (
                  <div key={idx} className="space-y-3">
                    {/* Question Bubble */}
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ml-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        고객 메모
                      </span>
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-700 shadow-sm max-w-[90%]">
                        {question}
                      </div>
                    </div>
                    
                    {/* Answer Input */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-[#7264FF] flex items-center gap-1.5 mr-1">
                        <FileText className="w-3.5 h-3.5" />
                        변호사 답변
                      </span>
                      <textarea
                        value={clientAnswers[idx] || ''}
                        onChange={(e) => setClientAnswers({...clientAnswers, [idx]: e.target.value})}
                        placeholder="이 질문에 대한 답변을 작성해주세요..."
                        className="w-full bg-[#7264FF]/5 border border-[#7264FF]/20 rounded-2xl rounded-tr-sm p-4 text-sm focus:ring-2 focus:ring-[#7264FF]/30 focus:border-[#7264FF] outline-none min-h-[100px] resize-y"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ══════════════════════════════════════════════════ */}
          {/* AI 프리미엄 전용 섹션 (토글 가능) */}
          {/* ══════════════════════════════════════════════════ */}
          {isAIPremium && aiAnalysis && (
            <>
              {/* Section 6: AI 재무 분석 카드 */}
              <section className="bg-[#1E3A5F]/[0.03] rounded-2xl p-5 border border-[#1E3A5F]/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#1E3A5F]" />
                    AI 재무 분석
                  </h3>
                  <button
                    onClick={() => setIncludeFinancialAnalysis(!includeFinancialAnalysis)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-[0.98] ${
                      includeFinancialAnalysis
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {includeFinancialAnalysis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {includeFinancialAnalysis ? '의뢰인 공개' : '내부 전용'}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium mb-1">월 소득</div>
                    <div className="text-base font-bold text-slate-800">{formatCurrency(aiAnalysis.factSummary.monthlyIncome)}원</div>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium mb-1">월 생계비</div>
                    <div className="text-base font-bold text-slate-800">{formatCurrency(aiAnalysis.factSummary.monthlyExpense)}원</div>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium mb-1">월 가용소득</div>
                    <div className={`text-base font-bold ${aiAnalysis.factSummary.disposableIncome > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(aiAnalysis.factSummary.disposableIncome)}원
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium mb-1">순자산 가치</div>
                    <div className="text-base font-bold text-slate-800">{formatCurrency(aiAnalysis.factSummary.assets.netAssetValue)}원</div>
                  </div>
                </div>

                {aiAnalysis.factSummary.disposableIncome > 0 ? (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 font-medium">
                    ✅ 가용소득이 양호하여 변제 계획 수립이 가능합니다.
                  </div>
                ) : (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-medium">
                    ⚠️ 가용소득이 부족합니다. 소득 증빙 방법 또는 생계비 조정을 검토해 주세요.
                  </div>
                )}
              </section>

              {/* Section 7: AI 위험 요인 보고 */}
              {aiAnalysis.riskFlags.length > 0 && (
                <section className="bg-[#1E3A5F]/[0.03] rounded-2xl p-5 border border-[#1E3A5F]/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-[#1E3A5F]" />
                      AI 위험 요인 분석
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {aiAnalysis.riskFlags.length}건
                      </span>
                    </h3>
                    <button
                      onClick={() => setIncludeRiskReport(!includeRiskReport)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-[0.98] ${
                        includeRiskReport
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {includeRiskReport ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {includeRiskReport ? '의뢰인 공개' : '내부 전용'}
                    </button>
                  </div>

                  {/* 검토 등급 */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                      aiAnalysis.reviewGrade === 'SECOND_REVIEW' ? 'bg-red-50 text-red-700 border-red-200' :
                      aiAnalysis.reviewGrade === 'ENHANCED_REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {aiAnalysis.reviewGrade === 'SECOND_REVIEW' ? '🔴 정밀 검토 필요' :
                       aiAnalysis.reviewGrade === 'ENHANCED_REVIEW' ? '🟡 강화 검토' :
                       '🟢 일반 검토'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {aiAnalysis.riskFlags.map((flag, idx) => {
                      const colorClass = flag.flagType === 'HIGH_RISK'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : flag.flagType === 'CAUTION'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800';
                      const label = flag.flagType === 'HIGH_RISK' ? '고위험'
                        : flag.flagType === 'CAUTION' ? '주의'
                        : '확인';
                      return (
                        <div key={idx} className={`flex items-start gap-2 rounded-xl p-3 border ${colorClass}`}>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${colorClass}`}>
                            {label}
                          </span>
                          <span className="text-sm leading-relaxed">{flag.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Section 8: 관할법원 참고사항 */}
              {aiAnalysis.courtPracticeNotes.length > 0 && (
                <section className="bg-[#1E3A5F]/[0.03] rounded-2xl p-5 border border-[#1E3A5F]/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#1E3A5F]" />
                      관할법원 참고사항
                    </h3>
                    <button
                      onClick={() => setIncludeCourtNotes(!includeCourtNotes)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-[0.98] ${
                        includeCourtNotes
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {includeCourtNotes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {includeCourtNotes ? '의뢰인 공개' : '내부 전용'}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {aiAnalysis.courtPracticeNotes.map((note, idx) => (
                      <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                        <div className="font-semibold text-sm text-slate-800">{note.courtName}</div>
                        {note.generalCorrectionRequirements && (
                          <p className="text-xs text-slate-600"><span className="font-bold text-slate-700">보정 요구:</span> {note.generalCorrectionRequirements}</p>
                        )}
                        {note.documentNotes && (
                          <p className="text-xs text-slate-600"><span className="font-bold text-slate-700">서류 참고:</span> {note.documentNotes}</p>
                        )}
                        {note.recentChanges && (
                          <p className="text-xs text-slate-600"><span className="font-bold text-slate-700">최근 변경:</span> {note.recentChanges}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-[0.98] whitespace-nowrap min-h-[44px]"
          >
            닫기
          </button>
          
          {viewerRole === 'lawyer' ? (
            <button 
              onClick={handleSubmit}
              className="px-8 py-3 rounded-xl font-semibold text-white bg-[#7264FF] hover:bg-[#5f51e5] shadow-lg shadow-[#7264FF]/20 flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
            >
              <Send className="w-5 h-5" />
              고객에게 제안서 발송
            </button>
          ) : viewerRole === 'reviewer' ? (
            <div className="flex items-center gap-2">
              {showRejectInput ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="반려 사유 입력..."
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none w-52"
                    autoFocus
                  />
                  <button 
                    onClick={() => { onRejectProposal && onRejectProposal(rejectReason); }}
                    disabled={!rejectReason.trim()}
                    className="px-5 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
                  >
                    반려
                  </button>
                  <button onClick={() => setShowRejectInput(false)} className="px-3 py-3 rounded-xl text-slate-400 hover:text-slate-600">
                    취소
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setShowRejectInput(true)}
                    className="px-5 py-3 rounded-xl font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
                  >
                    반려
                  </button>
                  <button 
                    onClick={() => onApproveProposal && onApproveProposal(getProposalData())}
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    승인 및 발송
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {showStaffMemo ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={staffMemo}
                    onChange={(e) => setStaffMemo(e.target.value)}
                    placeholder="컨펌 요청 메모..."
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none w-48"
                  />
                  <button 
                    onClick={() => onRequestConfirm && onRequestConfirm(getProposalData(), staffMemo)}
                    className="px-6 py-3 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
                  >
                    요청하기
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowStaffMemo(true)}
                  className="px-8 py-3 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px]"
                >
                  📋 변호사 컨펌 요청
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default LawyerProposalDraft;
