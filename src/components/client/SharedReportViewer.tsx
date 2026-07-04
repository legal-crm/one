import React from 'react';
import { Shield, Sparkles, Scale, DollarSign, Calendar, Landmark, AlertTriangle, Check, ArrowRight, User } from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface SharedReportViewerProps {
    result: RehabCalculationResult;
    userInput: RehabUserInput;
    onStartSelfDiagnosis: () => void;
}

export default function SharedReportViewer({ result, userInput, onStartSelfDiagnosis }: SharedReportViewerProps) {
    const formatCurrency = (amount: number | undefined): string => {
        if (amount === undefined) return '0원';
        if (amount === 0) return '0원';
        
        const absAmount = Math.abs(amount);
        const eok = Math.floor(absAmount / 100000000);
        const remainder = absAmount % 100000000;
        const man = Math.floor(remainder / 10000);

        let res = '';
        if (eok > 0) res += `${eok}억 `;
        if (man > 0) res += `${man.toLocaleString()}만`;
        return `${res}원`.trim();
    };

    const hasSpeculative = userInput.speculativeLoss && userInput.speculativeLoss > 0;
    const hasGambling = userInput.gamblingLoss && userInput.gamblingLoss > 0;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-[Pretendard] flex flex-col justify-between py-6 px-4">
            <div className="w-full max-w-md mx-auto space-y-6">
                
                {/* Header Branded Logo */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-[#7264FF]/10 text-[#7264FF] rounded-lg">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-black tracking-tight text-white">로이 법률 CRM</span>
                            <span className="text-[12px] text-slate-600 block">보안 진단 리포트 뷰어</span>
                        </div>
                    </div>
                    <span className="text-[12px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                        보안 인증 완료
                    </span>
                </div>

                {/* Main Read-only Report Card */}
                <div className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl space-y-6">
                    {/* Background glow decorator */}
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#7264FF]/10 blur-3xl rounded-full"></div>
                    
                    {/* Header Details */}
                    <div className="relative flex justify-between items-start">
                        <div>
                            <span className="text-[12px] uppercase text-[#7264FF] font-bold tracking-widest block mb-1">CONFIDENTIAL</span>
                            <h2 className="text-lg font-black text-white leading-tight">
                                {userInput.name || '의뢰인'}님의 채무 진단서
                            </h2>
                            <p className="text-[13px] text-slate-600 mt-1">
                                {result.courtName} 기준 시뮬레이션
                            </p>
                        </div>
                        <Scale className="w-8 h-8 text-slate-700" />
                    </div>

                    {/* Main Metrics Box */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                        <div className="space-y-0.5">
                            <span className="text-[12px] text-slate-600">예상 조정 비율</span>
                            <div className="text-xl font-black text-emerald-400">
                                {result.debtReductionRate}%
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[12px] text-slate-600">총 채무 절감액</span>
                            <div className="text-xl font-black text-[#7264FF]">
                                {formatCurrency(result.totalDebtReduction)}
                            </div>
                        </div>
                        <div className="col-span-2 border-t border-slate-800/50 pt-2.5 mt-1 space-y-0.5">
                            <span className="text-[12px] text-slate-600">예상 월 변제금 ({result.repaymentMonths}개월)</span>
                            <div className="text-lg font-black text-white">
                                {formatCurrency(result.monthlyPayment)} <span className="text-xs text-slate-500 font-normal">/ 월</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary Info Cards */}
                    <div className="space-y-3.5 text-xs text-slate-300">
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                            <span className="text-slate-600">총 채무액</span>
                            <span className="font-semibold text-slate-300">{formatCurrency(userInput.totalDebt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                            <span className="text-slate-600">실제 상환 예정 총액</span>
                            <span className="font-semibold text-emerald-400">{formatCurrency(result.totalRepayment)}</span>
                        </div>
                        {userInput.retirementPay !== undefined && userInput.retirementPay > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                                <span className="text-slate-600">예상 퇴직금 (반영률)</span>
                                <span className="font-semibold text-slate-300">
                                    {formatCurrency(userInput.retirementPay)} 
                                    <span className="text-[12px] text-slate-500 ml-1">
                                        ({userInput.retirementPensionType === 'pension' ? '0% 반영' : '50% 반영'})
                                    </span>
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                            <span className="text-slate-600">가구원수 및 인정 부양가족</span>
                            <span className="font-semibold text-slate-300">{userInput.familySize}인 가구</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-slate-600">월 실수령액 소득</span>
                            <span className="font-semibold text-slate-300">{formatCurrency(userInput.monthlyIncome)}</span>
                        </div>
                    </div>

                    {/* Investment / Gambling Debt Warning Panel */}
                    {(hasSpeculative || hasGambling) && (
                        <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>주식/코인 및 사행성 손실 채무 감지</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-500 bg-slate-950/40 p-2 rounded-xl">
                                <div>
                                    주식/코인 손실: <strong className="text-slate-200">{hasSpeculative ? formatCurrency(userInput.speculativeLoss) : '없음'}</strong>
                                </div>
                                <div>
                                    도박 사행성 채무: <strong className="text-slate-200">{hasGambling ? formatCurrency(userInput.gamblingLoss) : '없음'}</strong>
                                </div>
                            </div>
                            <p className="text-[12px] text-amber-200/70 leading-relaxed">
                                ※ 본 채무는 지방법원 기준 청산가치에 반영되거나 추가 보정 권고를 받을 리스크가 있으므로, 법원별 실무준칙에 맞게 소명 서류를 작성해야 합니다.
                            </p>
                        </div>
                    )}

                    {/* Retirement unknown Warning Panel */}
                    {userInput.retirementPensionType === 'unknown' && userInput.retirementPay !== undefined && userInput.retirementPay > 0 && (
                        <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 animate-pulse">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>퇴직연금 가입 형태 미확인</span>
                            </div>
                            <p className="text-[12px] text-amber-200/70 leading-relaxed">
                                ※ 예상 퇴직금 종류(퇴직연금 가입 여부)를 "모름"으로 선택하셨습니다. 퇴직연금 가입 여부에 따라 청산가치 반영액(0% 또는 50%)이 달라지므로, 정확한 진단을 위해 변호사와 추가 상담 시 퇴직연금 가입 확인서 검토가 필요합니다.
                            </p>
                        </div>
                    )}

                    {/* AI Advice Summary */}
                    {result.aiAdvice && result.aiAdvice.length > 0 && (
                        <div className="p-4 bg-slate-950/40 rounded-2xl space-y-2.5 border border-slate-800/60">
                            <span className="text-[12px] text-slate-600 font-bold block">변호사 검토 의견 가이드라인</span>
                            <div className="space-y-2 text-[13px] text-slate-500">
                                {result.aiAdvice.slice(0, 2).map((advice, idx) => (
                                    <div key={idx} className="flex gap-1.5 items-start">
                                        <Check className="w-3.5 h-3.5 text-[#7264FF] shrink-0 mt-0.5" />
                                        <span>{advice}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom CTA Block for platform marketing / viral expansion */}
            <div className="w-full max-w-md mx-auto pt-6 text-center space-y-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        나도 채무 감면율을 확인하고 싶다면?
                    </h3>
                    <p className="text-[13px] text-slate-600">
                        회원가입 없이 5분 만에 무료로 예상 조정 범위 체크하기
                    </p>
                </div>
                
                <button
                    onClick={onStartSelfDiagnosis}
                    className="w-full py-4 bg-[#7264FF] hover:bg-[#5b4cf5] text-white text-xs font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#7264FF]/25 active:scale-[0.98]"
                >
                    <span>⚡ 나도 무료로 5분 개인회생 진단해보기</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
                
                <p className="text-[11px] text-slate-650">
                    로이 법률 CRM은 개인정보를 안전하게 보호하며 권한 없이 타인에게 본 분석 내역을 공개하지 않습니다.
                </p>
            </div>
        </div>
    );
}
