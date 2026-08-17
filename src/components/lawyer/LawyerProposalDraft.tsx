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
  Clock 
} from 'lucide-react';
import { RehabCalculationResult, RehabUserInput, formatCurrency } from '../../rehab-chatbot-package/services/calculationService';

interface LawyerProposalDraftProps {
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  consultRequest: any;
  onClose: () => void;
  onSendProposal: (proposalData: ProposalData) => void;
  viewerRole?: 'lawyer' | 'staff';
  onRequestConfirm?: (memo: string) => void;
}

interface ProposalData {
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
}

const fmtNum = (n: number) => n.toLocaleString('ko-KR');

const LawyerProposalDraft: React.FC<LawyerProposalDraftProps> = ({
  rehabCalcResult,
  rehabUserInput,
  consultRequest,
  onClose,
  onSendProposal,
  viewerRole = 'lawyer',
  onRequestConfirm
}) => {
  const clientName = rehabUserInput.name || consultRequest?.clientName || consultRequest?.financialProfile?.clientName || '고객';

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

    return notes;
  }, [rehabUserInput, rehabCalcResult]);

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

  // Section 4: Lawyer Opinion
  const [lawyerOpinion, setLawyerOpinion] = useState('');

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

  const handleSubmit = () => {
    const proposalData: ProposalData = {
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
      }))
    };

    onSendProposal(proposalData);
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
              고객 제안서 초안
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {clientName}님 · 개인회생 진단 결과
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
                    onClick={() => onRequestConfirm && onRequestConfirm(staffMemo)}
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
                  변호사 컨펌 요청
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
