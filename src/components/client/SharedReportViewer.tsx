import React from 'react';
import { AlertTriangle, Check, ArrowRight, Lock } from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { Badge, Button, formatKoreanWon } from './ui';
import { BrandMark } from './BrandLogo';

interface SharedReportViewerProps {
    result: RehabCalculationResult;
    userInput: RehabUserInput;
    onStartSelfDiagnosis: () => void;
}

/**
 * 공유 리포트 뷰어 (PIN 확인 후) — 고객 사이트(.client-light) 라이트 전용 · 네이비 브랜드 토큰
 * 공유 링크에는 일부 수치만 담긴다(ReportShareModal 참고). 없는 값은 0원·빈칸 대신 '정보 없음'으로 표시한다.
 */
export default function SharedReportViewer({ result, userInput, onStartSelfDiagnosis }: SharedReportViewerProps) {
    const hasValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const missing = <span className="font-semibold text-slate-500">정보 없음</span>;

    const formatCurrency = (amount: number | undefined): string => {
        // 이전: 값이 없으면 '0원', 만 원 아래 자리는 버림(월 변제금 812,000원 → '81만원')
        if (!hasValue(amount)) return '정보 없음';
        return formatKoreanWon(amount);
    };
    const amountOrMissing = (amount: number | undefined) => (hasValue(amount) ? formatCurrency(amount) : missing);

    const hasSpeculative = userInput.speculativeLoss && userInput.speculativeLoss > 0;
    const hasGambling = userInput.gamblingLoss && userInput.gamblingLoss > 0;

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900 flex flex-col justify-between py-6 px-4">
            <div className="w-full max-w-md mx-auto space-y-6">
                
                {/* 브랜드 머리 (고객 사이트 로고와 같은 마크) */}
                <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0" aria-hidden="true">
                            <BrandMark className="w-6 h-6" />
                        </span>
                        <div className="min-w-0">
                            <span className="text-base font-extrabold tracking-tight text-slate-900 block">my김변</span>
                            <span className="text-xs text-slate-600 block">공유받은 채무 정리 리포트</span>
                        </div>
                    </div>
                    <Badge tone="success" icon={<Lock className="w-3 h-3" aria-hidden="true" />}>비밀번호 확인됨</Badge>
                </header>

                {/* 읽기 전용 리포트 */}
                <main className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-6">
                    <div>
                        <h1 className="text-lg font-extrabold text-slate-900 leading-tight break-keep">
                            {userInput.name || '의뢰인'}님의 채무 정리 리포트
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            {result.courtName ? `${result.courtName} 기준 예상 계산` : '예상 계산 결과 (관할 법원 정보 없음)'}
                        </p>
                    </div>

                    {/* 주요 수치 */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="space-y-0.5">
                            <span className="text-xs text-slate-600">예상 감면율</span>
                            <div className="text-xl font-extrabold text-emerald-700">
                                {hasValue(result.debtReductionRate) ? `${result.debtReductionRate}%` : missing}
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs text-slate-600">예상 감면액</span>
                            <div className="text-xl font-extrabold text-brand">
                                {amountOrMissing(result.totalDebtReduction)}
                            </div>
                        </div>
                        <div className="col-span-2 border-t border-slate-200 pt-2.5 mt-1 space-y-0.5">
                            {/* 공유 링크에 월 변제금·변제기간이 없으면 '0원'·'(undefined개월)' 대신 정보 없음 */}
                            <span className="text-xs text-slate-600">
                                예상 월 변제금{hasValue(result.repaymentMonths) ? ` (${result.repaymentMonths}개월)` : ''}
                            </span>
                            <div className="text-lg font-extrabold text-slate-900">
                                {hasValue(result.monthlyPayment) ? (
                                    <>{formatCurrency(result.monthlyPayment)} <span className="text-xs text-slate-600 font-normal">/ 월</span></>
                                ) : missing}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-keep">
                        입력한 정보로 계산한 예상치예요. 실제 결과는 법원 심사에 따라 달라질 수 있어요.
                    </p>

                    {/* 입력 요약 */}
                    <div className="space-y-3.5 text-sm text-slate-700">
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">총 채무액</span>
                            <span className="font-semibold text-slate-900">{amountOrMissing(userInput.totalDebt)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">예상 총 변제액</span>
                            <span className="font-semibold text-emerald-700">{amountOrMissing(result.totalRepayment)}</span>
                        </div>
                        {userInput.retirementPay !== undefined && userInput.retirementPay > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="text-slate-600">예상 퇴직금 (반영률)</span>
                                <span className="font-semibold text-slate-900">
                                    {formatCurrency(userInput.retirementPay)} 
                                    <span className="text-xs text-slate-600 ml-1">
                                        {/* 계산 엔진과 동일: 미가입·모름만 50%, 퇴직연금 가입은 0% */}
                                        ({userInput.retirementPensionType === 'none' || userInput.retirementPensionType === 'unknown' ? '50% 반영' : '0% 반영'})
                                    </span>
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">가구원 수</span>
                            <span className="font-semibold text-slate-900">{hasValue(userInput.familySize) ? `${userInput.familySize}인 가구` : missing}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-slate-600">월 실수령액 소득</span>
                            <span className="font-semibold text-slate-900">{amountOrMissing(userInput.monthlyIncome)}</span>
                        </div>
                    </div>

                    {/* 투자·도박 손실 안내 */}
                    {(hasSpeculative || hasGambling) && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>주식·코인 손실이나 도박 채무가 있어요</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl">
                                <div>
                                    주식·코인 손실: <strong className="text-slate-900">{hasSpeculative ? formatCurrency(userInput.speculativeLoss) : '없음'}</strong>
                                </div>
                                <div>
                                    도박 채무: <strong className="text-slate-900">{hasGambling ? formatCurrency(userInput.gamblingLoss) : '없음'}</strong>
                                </div>
                            </div>
                            <p className="text-xs text-amber-900 leading-relaxed break-keep">
                                법원이 이런 손실을 청산가치에 반영하거나 추가 소명을 요청할 수 있어요. 상담할 때 변호사와 함께 확인해 보세요.
                            </p>
                        </div>
                    )}

                    {/* 퇴직연금 가입 형태를 모를 때 */}
                    {userInput.retirementPensionType === 'unknown' && userInput.retirementPay !== undefined && userInput.retirementPay > 0 && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>퇴직연금 가입 여부 확인 필요</span>
                            </div>
                            <p className="text-xs text-amber-900 leading-relaxed break-keep">
                                퇴직연금 가입 여부를 "모름"으로 선택했어요. 가입 여부에 따라 퇴직금이 청산가치에 반영되는 비율(0% 또는 50%)이 달라져요. 상담할 때 퇴직연금 가입 확인서를 준비하면 정확히 볼 수 있어요.
                            </p>
                        </div>
                    )}

                    {/* 자동 계산 안내 (이전 제목 '변호사 검토 의견 가이드라인' — 변호사가 검토한 내용이 아님) */}
                    {result.aiAdvice && result.aiAdvice.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-2.5 border border-slate-200">
                            <span className="text-xs text-slate-600 font-bold block">자동 계산 참고 안내</span>
                            <div className="space-y-2 text-sm text-slate-700">
                                {result.aiAdvice.slice(0, 2).map((advice, idx) => (
                                    <div key={idx} className="flex gap-1.5 items-start">
                                        <Check className="w-3.5 h-3.5 text-brand shrink-0 mt-1" aria-hidden="true" />
                                        {/* 계산 엔진 문구의 마크다운 강조(**)는 제거해 표시 */}
                                        <span className="break-keep">{String(advice).replace(/\*\*/g, '')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* 나도 체크해 보기 */}
            <div className="w-full max-w-md mx-auto pt-6 text-center space-y-4">
                <div className="space-y-1">
                    <h2 className="text-base font-bold text-slate-900">
                        내 상황도 확인해 보고 싶다면
                    </h2>
                    <p className="text-sm text-slate-600 break-keep">
                        회원가입 없이 약 3분이면 예상 감면 범위를 확인할 수 있어요.
                    </p>
                </div>
                
                <Button
                    size="lg"
                    fullWidth
                    onClick={onStartSelfDiagnosis}
                    rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                    className="rounded-2xl"
                >
                    익명으로 내 상황 체크하기
                </Button>
                
                <p className="text-xs text-slate-600 break-keep">
                    이 리포트는 공유 링크와 비밀번호를 함께 받은 사람만 열 수 있어요.
                </p>
            </div>
        </div>
    );
}
