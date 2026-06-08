/**
 * AI 변제금 진단 결과 리포트 V2 - 프리미엄 에디션
 * 
 * 최첨단 디자인 + 프리미엄 애니메이션
 * - 글래스모피즘 카드
 * - 카운트업 애니메이션
 * - 도넛 차트 시각화
 * - 웨이브 프로그레스 바
 * - 스태거드 등장 효과
 */

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { X, Check, AlertTriangle, TrendingDown, Building2, Shield, ArrowRight, Download, Share2, Users, DollarSign, Percent, BarChart3, Sparkles, Zap, Clock, Home, CreditCard, Calculator } from 'lucide-react';
import { RehabCalculationResult, RehabUserInput, formatCurrency } from '../../services/calculationService';
import { StatComparisonCard, DistributionBar, PercentileBadge } from './StatisticalComparison';
import { calculateIncomePercentile, calculateDebtPercentile, calculateReductionRatePercentile, getAgeComparison, getFamilySizeComparison, generateStatisticalInsights } from '../../utils/statisticsUtils';
import { REHAB_STATISTICS_2025, AVERAGE_VALUES } from '../../config/rehabStatistics2025';
import { CountUp, GlowingCard, AnimatedProgress, DonutChart, PulsingBadge, GradientButton, StaggerContainer, StaggerItem } from './animations/ReportAnimations';
import { ProcedureTimeline } from './ProcedureTimeline';

interface RehabResultReportProps {
    result: RehabCalculationResult;
    userInput: RehabUserInput;
    onClose: () => void;
    onConsultation?: () => void;
}

const RehabResultReport: React.FC<RehabResultReportProps> = ({
    result,
    userInput,
    onClose,
    onConsultation
}) => {
    const reportRef = useRef<HTMLDivElement>(null);

    // 이미지 저장 기능
    const handleSaveReport = async () => {
        if (!reportRef.current) return;

        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false
            });

            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.download = `변제금진단_${userInput.name}_${date}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('보고서 저장 실패:', error);
            alert('보고서 저장에 실패했습니다. 다시 시도해주세요.');
        }
    };

    // 공유 기능
    const handleShareReport = async () => {
        if (!reportRef.current) return;

        try {
            // Web Share API 지원 확인
            if (navigator.share && navigator.canShare) {
                const canvas = await html2canvas(reportRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    logging: false
                });

                canvas.toBlob(async (blob) => {
                    if (!blob) return;

                    const file = new File([blob], `변제금진단_${userInput.name}.png`, { type: 'image/png' });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: 'AI 변제금 진단 리포트',
                            text: `${userInput.name}님의 개인회생 변제금 진단 결과입니다.`,
                            files: [file]
                        });
                    } else {
                        // 파일 공유 불가시 링크로 대체
                        await navigator.share({
                            title: 'AI 변제금 진단 리포트',
                            text: `${userInput.name}님의 개인회생 변제금 진단 결과입니다.`,
                        });
                    }
                }, 'image/png');
            } else {
                // Web Share API 미지원시 이미지 저장으로 대체
                alert('이 브라우저에서는 직접 공유가 지원되지 않습니다.\n이미지를 저장한 후 공유해주세요.');
                handleSaveReport();
            }
        } catch (error) {
            console.error('공유 실패:', error);
            // 사용자가 공유 취소한 경우는 에러 표시하지 않음
            if ((error as Error).name !== 'AbortError') {
                alert('공유에 실패했습니다. 이미지를 저장 후 공유해주세요.');
            }
        }
    };

    // 상태별 설정
    const statusConfig = {
        POSSIBLE: {
            badge: '개인회생 가능',
            icon: <Check className="w-5 h-5" />,
            color: 'green' as const,
            bgGradient: 'from-emerald-50 to-white',
            accentColor: '#059669',
        },
        DIFFICULT: {
            badge: '검토 필요',
            icon: <AlertTriangle className="w-5 h-5" />,
            color: 'yellow' as const,
            bgGradient: 'from-amber-50 to-white',
            accentColor: '#d97706',
        },
        IMPOSSIBLE: {
            badge: '신청 어려움',
            icon: <X className="w-5 h-5" />,
            color: 'red' as const,
            bgGradient: 'from-red-50 to-white',
            accentColor: '#dc2626',
        }
    };

    const config = statusConfig[result.status];

    // 통화 포맷터 (카운트업용)
    const currencyFormatter = (value: number) => {
        if (value >= 100000000) {
            return `${(value / 100000000).toFixed(1)}억`;
        } else if (value >= 10000) {
            return `${Math.floor(value / 10000).toLocaleString()}만`;
        }
        return value.toLocaleString();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                {/* Background - Clean Executive Style */}
                <motion.div
                    className="absolute inset-0 bg-[#F7F9FC]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                />

                {/* Main Report Container */}
                <motion.div
                    ref={reportRef}
                    initial={{ opacity: 0, y: 40, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.98 }}
                    transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                    className="relative w-full max-w-lg my-4 bg-white rounded-xl overflow-hidden max-h-[92vh] overflow-y-auto"
                    style={{ boxShadow: '0 6px 18px rgba(16,24,40,0.10)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ========== DARK HEADER BAR ========== */}
                    <div className="bg-[#101828] text-white px-5 py-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <motion.h1
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-lg font-bold text-[#F2F4F7]"
                                >
                                    AI 변제금 진단 리포트
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xs text-gray-400 mt-1"
                                >
                                    {userInput.name}님 · 산정 기준: 2025.01 서울회생법원
                                </motion.p>
                            </div>
                            <div className="flex items-center gap-2">
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    onClick={handleSaveReport}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                    title="저장"
                                >
                                    <Download className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.35 }}
                                    onClick={handleShareReport}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                    title="공유"
                                >
                                    <Share2 className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                    title="닫기"
                                >
                                    <X className="w-4 h-4" />
                                </motion.button>
                            </div>
                        </div>

                        {/* Status Badge in Header */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-4"
                        >
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${result.status === 'POSSIBLE' ? 'bg-emerald-500/20 text-emerald-300' :
                                result.status === 'DIFFICULT' ? 'bg-amber-500/20 text-amber-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                {config.icon}
                                {config.badge}
                            </span>
                        </motion.div>
                    </div>

                    {/* ========== KPI SUMMARY STRIP ========== */}
                    <div className="bg-[#F7F9FC] border-b border-[#E6EAF0] px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Monthly Payment */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-center"
                            >
                                <div className="text-[10px] text-[#5B677A] mb-1">월 변제금</div>
                                <div className="text-base font-bold text-[#0B1220]">
                                    <CountUp
                                        end={result.monthlyPayment}
                                        delay={0.5}
                                        formatter={currencyFormatter}
                                        suffix="원"
                                    />
                                </div>
                            </motion.div>

                            {/* Debt Reduction */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.45 }}
                                className="text-center"
                            >
                                <div className="text-[10px] text-[#5B677A] mb-1">총 탕감액</div>
                                <div className="text-base font-bold text-[#16A34A]">
                                    <CountUp
                                        end={result.totalDebtReduction}
                                        delay={0.55}
                                        formatter={currencyFormatter}
                                        suffix="원"
                                    />
                                </div>
                            </motion.div>

                            {/* Reduction Rate */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="text-center"
                            >
                                <div className="text-[10px] text-[#5B677A] mb-1">탕감률</div>
                                <div className="text-base font-bold text-[#2563EB]">
                                    <CountUp end={result.debtReductionRate} delay={0.6} suffix="%" />
                                </div>
                            </motion.div>

                            {/* Duration */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.55 }}
                                className="text-center"
                            >
                                <div className="text-[10px] text-[#5B677A] mb-1">변제기간</div>
                                <div className="text-base font-bold text-[#0B1220]">{result.repaymentMonths}개월</div>
                            </motion.div>
                        </div>
                    </div>

                    {/* ========== MAIN CONTENT ========== */}
                    <div className="px-5 py-5 space-y-4 bg-white">

                        {/* ===== DEBT VISUALIZATION ===== */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="report-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[#0B1220] mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-[#2563EB]" />
                                채무 감면 현황
                            </h3>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <DonutChart
                                    percentage={result.debtReductionRate}
                                    size={90}
                                    strokeWidth={8}
                                    colorFrom="#2563EB"
                                    colorTo="#16A34A"
                                    delay={0.7}
                                    label="탕감률"
                                />
                                <div className="space-y-3 flex-1 sm:ml-6 w-full sm:w-auto">
                                    <div className="flex justify-between items-center py-2 border-b border-[#E6EAF0]">
                                        <span className="text-xs text-[#5B677A]">현재 총 채무</span>
                                        <span className="text-sm font-medium text-[#DC2626] line-through opacity-70">
                                            {formatCurrency(userInput.totalDebt)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-xs text-[#5B677A]">실제 변제 금액</span>
                                        <span className="text-sm font-bold text-[#16A34A]">
                                            {formatCurrency(result.totalRepayment)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* ===== DEBT COMPARISON BARS ===== */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="report-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[#0B1220] mb-4 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-[#2563EB]" />
                                채무 비교
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-[#5B677A]">현재 총 채무</span>
                                        <span className="text-[#0B1220]">{formatCurrency(userInput.totalDebt)}</span>
                                    </div>
                                    <AnimatedProgress
                                        value={100}
                                        colorFrom="#DC2626"
                                        colorTo="#F59E0B"
                                        delay={0.8}
                                        height={8}
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-[#5B677A]">실제 갚을 금액</span>
                                        <span className="text-[#16A34A] font-medium">{formatCurrency(result.totalRepayment)}</span>
                                    </div>
                                    <AnimatedProgress
                                        value={100 - result.debtReductionRate}
                                        colorFrom="#16A34A"
                                        colorTo="#2563EB"
                                        delay={0.9}
                                        height={8}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* ===== STATISTICS COMPARISON SECTION ===== */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="report-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[#0B1220] mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-[#2563EB]" />
                                2025년 개인회생 신청자 통계 비교
                                <span className="text-[10px] text-[#5B677A] font-normal ml-auto">서울회생법원 기준</span>
                            </h3>

                            {/* Percentile Comparison Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <StatComparisonCard
                                    title="월 소득"
                                    userValue={userInput.monthlyIncome}
                                    averageValue={AVERAGE_VALUES.monthlyIncome}
                                    percentile={calculateIncomePercentile(userInput.monthlyIncome)}
                                    icon={<DollarSign className="w-4 h-4" />}
                                />
                                <StatComparisonCard
                                    title="총 채무"
                                    userValue={userInput.totalDebt}
                                    averageValue={AVERAGE_VALUES.totalDebt}
                                    percentile={calculateDebtPercentile(userInput.totalDebt)}
                                    icon={<CreditCard className="w-4 h-4" />}
                                />
                            </div>

                            {/* Reduction Rate Comparison */}
                            <div className="mb-4">
                                <StatComparisonCard
                                    title="예상 탕감률"
                                    userValue={`${result.debtReductionRate}%`}
                                    averageValue={`${AVERAGE_VALUES.debtReductionRate}%`}
                                    percentile={calculateReductionRatePercentile(result.debtReductionRate)}
                                    icon={<Percent className="w-4 h-4" />}
                                />
                            </div>

                            {/* Distribution Chart */}
                            <DistributionBar
                                title="채무 총액"
                                userValue={userInput.totalDebt}
                                distribution={REHAB_STATISTICS_2025.debtAmountDistribution}
                                highlightRange={
                                    userInput.totalDebt <= 50000000 ? '5천만원 이하' :
                                        userInput.totalDebt <= 100000000 ? '5천만원 초과 1억 이하' :
                                            userInput.totalDebt <= 200000000 ? '1억 초과 2억 이하' :
                                                userInput.totalDebt <= 300000000 ? '2억 초과 3억 이하' :
                                                    userInput.totalDebt <= 400000000 ? '3억 초과 4억 이하' : '4억 초과'
                                }
                            />

                            {/* Statistical Insights */}
                            {(() => {
                                const insights = generateStatisticalInsights({
                                    monthlyIncome: userInput.monthlyIncome,
                                    totalDebt: userInput.totalDebt,
                                    debtReductionRate: result.debtReductionRate,
                                    familySize: userInput.familySize,
                                });

                                return insights.length > 0 ? (
                                    <div className="mt-4 pt-4 border-t border-[#E6EAF0]">
                                        <p className="text-[10px] text-[#5B677A] uppercase tracking-wider mb-2">AI 통계 인사이트</p>
                                        <div className="space-y-1.5">
                                            {insights.map((insight, idx) => (
                                                <motion.p
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 1.0 + idx * 0.1 }}
                                                    className="text-xs text-[#2563EB] flex items-start gap-1.5"
                                                >
                                                    <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                    {insight}
                                                </motion.p>
                                            ))}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                        </motion.div>

                        {/* ===== PROCEDURE TIMELINE SECTION ===== */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.0 }}
                            className="report-card p-4"
                        >
                            <ProcedureTimeline processingMonths={result.processingMonths} />
                        </motion.div>

                        {/* ===== DETAILED INFO SECTIONS ===== */}
                        <div className="space-y-3">

                            {/* Court & Jurisdiction */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.1 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-[#2563EB]" />
                                    관할 법원
                                </h3>
                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">법원</dt>
                                        <dd className="text-[#0B1220] font-medium">{result.courtName}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">지역 그룹</dt>
                                        <dd className="text-[#0B1220]">{result.regionGroup}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5">
                                        <dt className="text-[#5B677A]">개시결정 소요기간</dt>
                                        <dd className="text-[#2563EB] font-bold">약 {result.processingMonths}개월</dd>
                                    </div>
                                </dl>
                            </motion.div>

                            {/* Assets */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.15 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-[#2563EB]" />
                                    자산 구성
                                </h3>
                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">본인 재산</dt>
                                        <dd className="text-[#0B1220]">{formatCurrency(userInput.myAssets)}</dd>
                                    </div>
                                    {userInput.isMarried && (
                                        <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                            <dt className="text-[#5B677A]">배우자 재산 (50%)</dt>
                                            <dd className="text-[#0B1220]">{formatCurrency(userInput.spouseAssets)}</dd>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">보증금/전세금</dt>
                                        <dd className="text-[#0B1220]">{formatCurrency(userInput.deposit)}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">면제 보증금</dt>
                                        <dd className="text-[#16A34A]">-{formatCurrency(result.exemptDeposit)}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 font-semibold">
                                        <dt className="text-[#0B1220]">청산가치</dt>
                                        <dd className="text-[#2563EB]">{formatCurrency(result.liquidationValue)}</dd>
                                    </div>
                                </dl>
                            </motion.div>

                            {/* Family & Dependents */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#2563EB]" />
                                    부양가족 구성
                                </h3>
                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">적용 가구원 수</dt>
                                        <dd className="text-[#2563EB] font-bold text-base">{userInput.familySize}인</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">혼인 상태</dt>
                                        <dd className="text-[#0B1220]">{userInput.isMarried ? '기혼' : '미혼/이혼/사별'}</dd>
                                    </div>
                                    {userInput.minorChildren !== undefined && userInput.minorChildren > 0 && (
                                        <>
                                            <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                                <dt className="text-[#5B677A]">미성년 자녀</dt>
                                                <dd className="text-[#0B1220]">{userInput.minorChildren}명</dd>
                                            </div>
                                            {userInput.recognizedChildDependents !== undefined && (
                                                <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                                    <dt className="text-[#5B677A]">인정 부양가족</dt>
                                                    <dd className="text-[#2563EB] font-medium">
                                                        {userInput.recognizedChildDependents === Math.floor(userInput.recognizedChildDependents)
                                                            ? `${userInput.recognizedChildDependents}명`
                                                            : `${userInput.recognizedChildDependents}명 (중간값)`}
                                                    </dd>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {userInput.elderlyParentDependents !== undefined && userInput.elderlyParentDependents > 0 && (
                                        <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                            <dt className="text-[#5B677A]">고령 부모님</dt>
                                            <dd className="text-[#2563EB] font-medium">{userInput.elderlyParentDependents}분</dd>
                                        </div>
                                    )}
                                </dl>
                                {userInput.dependentReason && (
                                    <p className="text-[#2563EB] mt-3 pt-2 border-t border-[#E6EAF0] text-[11px]">
                                        💡 {userInput.dependentReason}
                                    </p>
                                )}
                                {userInput.isMarried && (
                                    <p className="text-[#F59E0B] text-[10px] mt-1">
                                        ※ 배우자가 양육/장애/질병 등으로 경제활동 불가 시 추가 인정 가능
                                    </p>
                                )}
                            </motion.div>

                            {/* Living Cost */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.25 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <Home className="w-4 h-4 text-[#16A34A]" />
                                    생계비 내역
                                </h3>
                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">기본 생계비 ({userInput.familySize}인)</dt>
                                        <dd className="text-[#0B1220]">{formatCurrency(result.baseLivingCost)}</dd>
                                    </div>
                                    {result.additionalLivingCost > 0 && (
                                        <>
                                            {userInput.rentCost && userInput.rentCost > 0 && (
                                                <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                                    <dt className="text-[#5B677A]">• 월세</dt>
                                                    <dd className="text-[#0B1220]">
                                                        {result.housingCostBreakdown
                                                            ? formatCurrency(result.housingCostBreakdown.recognized)
                                                            : formatCurrency(userInput.rentCost)}
                                                    </dd>
                                                </div>
                                            )}
                                            {userInput.medicalCost && userInput.medicalCost > 0 && (
                                                <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                                    <dt className="text-[#5B677A]">• 의료비</dt>
                                                    <dd className="text-[#0B1220]">
                                                        {result.medicalCostBreakdown
                                                            ? formatCurrency(result.medicalCostBreakdown.recognized)
                                                            : formatCurrency(userInput.medicalCost)}
                                                    </dd>
                                                </div>
                                            )}
                                            {userInput.educationCost && userInput.educationCost > 0 && (
                                                <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                                    <dt className="text-[#5B677A]">• 교육비</dt>
                                                    <dd className="text-[#0B1220]">
                                                        {result.educationCostBreakdown
                                                            ? formatCurrency(result.educationCostBreakdown.recognized)
                                                            : formatCurrency(userInput.educationCost)}
                                                    </dd>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="flex justify-between items-center py-2 font-semibold">
                                        <dt className="text-[#0B1220]">총 인정 생계비</dt>
                                        <dd className="text-[#16A34A]">{formatCurrency(result.recognizedLivingCost)}</dd>
                                    </div>
                                </dl>
                            </motion.div>

                            {/* Available Income Calculation */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.3 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#2563EB]" />
                                    가용 소득 계산
                                </h3>
                                <dl className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">월 소득</dt>
                                        <dd className="text-[#0B1220]">{formatCurrency(userInput.monthlyIncome)}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-[#E6EAF0]">
                                        <dt className="text-[#5B677A]">총 인정 생계비</dt>
                                        <dd className="text-[#DC2626]">-{formatCurrency(result.recognizedLivingCost)}</dd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 font-semibold">
                                        <dt className="text-[#0B1220]">가용 소득</dt>
                                        <dd className="text-[#2563EB] text-base">{formatCurrency(result.availableIncome)}</dd>
                                    </div>
                                </dl>
                            </motion.div>

                            {/* Repayment Calculation Method */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.35 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <Calculator className="w-4 h-4 text-[#2563EB]" />
                                    변제금 산출 방식
                                </h3>
                                <div className="space-y-2 text-xs text-[#5B677A]">
                                    <p>• <span className="text-[#2563EB] font-medium">청산가치 기준</span>: {formatCurrency(result.liquidationValue)} ÷ {result.repaymentMonths}개월 = <span className="text-[#0B1220]">{formatCurrency(Math.floor(result.liquidationValue / result.repaymentMonths))}/월</span></p>
                                    <p>• <span className="text-[#2563EB] font-medium">가용소득 기준</span>: <span className="text-[#0B1220]">{formatCurrency(result.availableIncome)}/월</span></p>
                                    <p className="pt-2 border-t border-[#E6EAF0] text-[#2563EB] font-medium">
                                        → 두 금액 중 <span className="text-[#2563EB] font-bold">큰 금액</span> = 월 변제금
                                    </p>
                                </div>
                            </motion.div>
                        </div>

                        {/* ===== AI ADVICE SECTION ===== */}
                        {(result.aiAdvice.length > 0 || result.riskWarnings.length > 0) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.4 }}
                                className="report-card p-4"
                            >
                                <h3 className="text-sm font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-[#2563EB]" />
                                    AI 분석 의견
                                </h3>

                                {/* Findings */}
                                {result.aiAdvice.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[10px] text-[#5B677A] uppercase tracking-wider mb-2">주요 소견</p>
                                        <div className="space-y-2">
                                            {result.aiAdvice.map((advice, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 1.5 + idx * 0.05 }}
                                                    className="flex items-start gap-2"
                                                >
                                                    <Check className="w-4 h-4 text-[#16A34A] mt-0.5 flex-shrink-0" />
                                                    <p className="text-xs text-[#5B677A]">{advice}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Risks */}
                                {result.riskWarnings.length > 0 && (
                                    <div className="pt-3 border-t border-[#E6EAF0]">
                                        <p className="text-[10px] text-[#5B677A] uppercase tracking-wider mb-2">주의 사항</p>
                                        <div className="space-y-2">
                                            {result.riskWarnings.map((warning, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 1.6 + idx * 0.05 }}
                                                    className="flex items-start gap-2"
                                                >
                                                    <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                                    <p className="text-xs text-[#F59E0B]">{warning}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Status Reason & Disclaimer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5 }}
                            className="text-center space-y-2 px-2 py-3"
                        >
                            <p className="text-xs text-[#5B677A]">{result.statusReason}</p>
                            <p className="text-[10px] text-[#5B677A]/70">
                                ※ 본 결과는 AI 추정치이며, 실제 법원 판단과 다를 수 있습니다.
                            </p>
                        </motion.div>
                    </div>

                    {/* ========== CTA FOOTER ========== */}
                    <div className="sticky bottom-0 p-4 bg-white border-t border-[#E6EAF0]">
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.6 }}
                            onClick={onConsultation}
                            className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Sparkles className="w-4 h-4" />
                            즉시 전문 상담 신청
                            <ArrowRight className="w-4 h-4" />
                        </motion.button>

                        {/* Save & Share Buttons */}
                        <div className="flex gap-2 mt-3">
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.7 }}
                                onClick={handleSaveReport}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 border border-gray-200"
                            >
                                <Download className="w-4 h-4" />
                                보고서 저장
                            </motion.button>
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.75 }}
                                onClick={handleShareReport}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 border border-gray-200"
                            >
                                <Share2 className="w-4 h-4" />
                                공유
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div >
        </AnimatePresence >
    );
};

export default RehabResultReport;
