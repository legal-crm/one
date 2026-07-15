/**
 * 의뢰인 종합 채무·자산 분석 리포트 - 프리미엄 에디션
 * 
 * - 브랜드 퍼플 (#7264FF) 중심의 고급 글래스모피즘 UI
 * - 4개 멀티 탭 (종합 분석 / 재산 및 가구 / 소득 및 채무 / 변호사 핵심 가이드)
 * - 제도별 적합도 진단 시각화 (개인회생, 개인파산, 신용회복)
 * - 변호사 즉시 자문용 실무 체크리스트 및 관할 법원 가이드 연동
 */

import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { X, Check, AlertTriangle, Building2, Shield, ArrowRight, Download, Share2, Users, DollarSign, Percent, BarChart3, Sparkles, Zap, Home, CreditCard, Calculator, FileText, ChevronRight } from 'lucide-react';
import ReportShareModal from '../../../components/client/ReportShareModal';
import PrintableReportTemplate from '../../../components/client/PrintableReportTemplate';
import { RehabCalculationResult, RehabUserInput, formatCurrency, DebtComposition, RiskFactor, LegalActionGuide, BudgetItem } from '../../services/calculationService';
import { StatComparisonCard, DistributionBar } from './StatisticalComparison';
import { calculateIncomePercentile, calculateDebtPercentile, calculateReductionRatePercentile, generateStatisticalInsights } from '../../utils/statisticsUtils';
import { REHAB_STATISTICS_2025, AVERAGE_VALUES } from '../../config/rehabStatistics2025';
import { CountUp, GlowingCard, AnimatedProgress, DonutChart, PulsingBadge } from './animations/ReportAnimations';
import { ProcedureTimeline } from './ProcedureTimeline';

interface RehabResultReportProps {
    result: RehabCalculationResult;
    userInput: RehabUserInput;
    onClose: () => void;
    onConsultation?: () => void;
    isLoggedIn?: boolean;
    onShowAuthModal?: () => void;
}

const RehabResultReport: React.FC<RehabResultReportProps> = ({
    result,
    userInput,
    onClose,
    onConsultation,
    isLoggedIn = false,
    onShowAuthModal
}) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [activeReportTab, setActiveReportTab] = useState<'overview' | 'assets' | 'debts' | 'statistics' | 'simulation' | 'checklist'>('overview');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [loginPromptAction, setLoginPromptAction] = useState<'pdf' | 'share' | 'consultation'>('pdf');

    // 로그인 필요 액션 게이트
    const requireLogin = (action: 'pdf' | 'share' | 'consultation') => {
        if (!isLoggedIn) {
            setLoginPromptAction(action);
            setShowLoginPrompt(true);
            return true;
        }
        return false;
    };

    // 전문가용 PDF 보고서 다운로드 기능 (jspdf + html2canvas)
    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        try {
            const page1El = document.getElementById('pdf-page-1');
            const page2El = document.getElementById('pdf-page-2');
            const page3El = document.getElementById('pdf-page-3');
            const page4El = document.getElementById('pdf-page-4');

            if (!page1El || !page2El || !page3El || !page4El) {
                alert('PDF 템플릿을 찾을 수 없습니다.');
                setIsGeneratingPdf(false);
                return;
            }

            // 페이지 1 캡처
            const canvas1 = await html2canvas(page1El, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 페이지 2 캡처
            const canvas2 = await html2canvas(page2El, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 페이지 3 캡처
            const canvas3 = await html2canvas(page3El, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // 페이지 4 캡처
            const canvas4 = await html2canvas(page4El, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            // PDF 생성 (A4: 210mm x 297mm)
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = 297;

            const imgData1 = canvas1.toDataURL('image/jpeg', 1.0);
            const imgData2 = canvas2.toDataURL('image/jpeg', 1.0);
            const imgData3 = canvas3.toDataURL('image/jpeg', 1.0);
            const imgData4 = canvas4.toDataURL('image/jpeg', 1.0);

            pdf.addImage(imgData1, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
            pdf.addPage();
            pdf.addImage(imgData2, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
            pdf.addPage();
            pdf.addImage(imgData3, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
            pdf.addPage();
            pdf.addImage(imgData4, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');

            const date = new Date().toISOString().split('T')[0];
            pdf.save(`종합채무진단보고서_${userInput.name || '의뢰인'}_${date}.pdf`);
        } catch (error) {
            console.error('PDF 다운로드 실패:', error);
            alert('PDF 다운로드 처리 중 오류가 발생했습니다.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

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
            link.download = `종합채무진단_${userInput.name || '의뢰인'}_${date}.png`;
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
            if (navigator.share && navigator.canShare) {
                const canvas = await html2canvas(reportRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    logging: false
                });

                canvas.toBlob(async (blob) => {
                    if (!blob) return;

                    const file = new File([blob], `종합채무진단_${userInput.name || '의뢰인'}.png`, { type: 'image/png' });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: '의뢰인 종합 채무·자산 분석 리포트',
                            text: `${userInput.name || '의뢰인'}님의 채무 진단 결과입니다.`,
                            files: [file]
                        });
                    } else {
                        await navigator.share({
                            title: '의뢰인 종합 채무·자산 분석 리포트',
                            text: `${userInput.name || '의뢰인'}님의 채무 진단 결과입니다.`,
                        });
                    }
                }, 'image/png');
            } else {
                alert('이 브라우저에서는 직접 공유가 지원되지 않습니다.\n이미지를 저장한 후 공유해주세요.');
                handleSaveReport();
            }
        } catch (error) {
            console.error('공유 실패:', error);
            if ((error as Error).name !== 'AbortError') {
                alert('공유에 실패했습니다. 이미지를 저장 후 공유해주세요.');
            }
        }
    };

    // 1. 제도별 적합도 평가 연동
    const suitabilities = useMemo(() => {
        const debt = userInput.totalDebt || 0;
        const retirementAsset = (userInput.retirementPay && (userInput.retirementPensionType === 'none' || userInput.retirementPensionType === 'unknown')) 
            ? userInput.retirementPay * 0.5 
            : 0;
        const assets = (userInput.myAssets || 0) + (userInput.spouseAssets || 0) * 0.5 + (userInput.deposit || 0) + retirementAsset;
        const income = userInput.monthlyIncome || 0;
        
        // 최저생계비 기준 설정 (2026년 기준 1인 생계비 약 133만원 등)
        const livingCost = result.recognizedLivingCost || 1330000;
        
        // [개인회생]
        let rehabScore = 0;
        let rehabReason = '';
        if (debt > assets && income > livingCost && debt >= 10000000) {
            rehabScore = 95;
            rehabReason = '월 소득이 법정 최저생계비 이상이고 채무액이 자산보다 크므로, 개인회생 진행 시 최대 원금 탕감 효과를 크게 볼 수 있는 가장 이상적인 조건입니다.';
        } else if (debt > assets && income > livingCost * 0.8) {
            rehabScore = 80;
            rehabReason = '소득이 다소 경계선에 있으나, 추가 생계비 조정 및 가구원 수 소명을 통해 가용소득을 다듬으면 충분히 승인 가능성이 큽니다.';
        } else if (debt <= assets) {
            rehabScore = 40;
            rehabReason = '보유 자산 평가액이 총 채무보다 많아 기각 위험 또는 월 변제금 상승 위험이 있습니다. 자산 저평가 사유 소명 대책을 변호사와 의논해야 합니다.';
        } else {
            rehabScore = 30;
            rehabReason = '정기적인 월 소득이 최저생계비에 다소 미달하여 매달 고정 변제금을 납부하기 어렵습니다. 소득 증빙 보강이 우선 필요합니다.';
        }

        // [개인파산]
        let bankruptcyScore = 0;
        let bankruptcyReason = '';
        if (income <= livingCost && assets < 25000000 && debt >= 20000000) {
            bankruptcyScore = 92;
            bankruptcyReason = '월 소득이 최저생계비 이하로 상환 능력이 없으며, 보유 자산 가치도 면제재산 한도 내로 매우 낮아 법적으로 원금 100% 면책을 받는 파산 신청이 매우 유력합니다.';
        } else if (income > livingCost) {
            bankruptcyScore = 15;
            bankruptcyReason = '안정적이고 반복적인 직업 소득이 최저생계비를 상당 폭 상회하므로 파산이 기각되고 개인회생 절차로 유도될 것입니다.';
        } else if (assets >= debt) {
            bankruptcyScore = 10;
            bankruptcyReason = '채무보다 청산 가능한 재산이 많으므로 법적인 파산 원인(지급불능 상태)으로 판단되기 어렵습니다.';
        } else {
            bankruptcyScore = 50;
            bankruptcyReason = '소득은 낮으나 처분 가치가 큰 자산이 있어 자산 환가 배당 절차와 면책 제한 리스크를 면밀하게 사전 법리 검토해야 합니다.';
        }

        // [신용회복 (워크아웃)]
        let workoutScore = 0;
        let workoutReason = '';
        if (debt < 25000000 && income > livingCost) {
            workoutScore = 85;
            workoutReason = '채무 규모가 비교적 소액이고 소득이 확실하므로, 법원 절차의 복잡한 서류와 공적 기록 보존 리스크를 피해 신용회복위원회의 협약 채무 조정을 우선 검토하는 것이 효율적입니다.';
        } else if (debt >= 150000000) {
            workoutScore = 30;
            workoutReason = '채무액이 매우 커 사적 조정(연체 유예 및 이자 감면)을 거쳐도 매달 납부할 원금 분할 상환액이 지나치게 높으므로 원금 감면이 가능한 개인회생이 정답입니다.';
        } else {
            workoutScore = 60;
            workoutReason = '주요 채권사 비율과 연체 개월 수에 따라 이자 감면 및 장기 분할 상환을 목적으로 하는 프리워크아웃 또는 개인워크아웃 신청을 고려할 수 있습니다.';
        }

        return {
            rehab: { status: rehabScore >= 85 ? '강력 추천' : rehabScore >= 65 ? '적합' : rehabScore >= 40 ? '검토 필요' : '부적합', score: rehabScore, reason: rehabReason, color: rehabScore >= 80 ? 'green' as const : rehabScore >= 60 ? 'cyan' as const : rehabScore >= 40 ? 'yellow' as const : 'red' as const },
            bankruptcy: { status: bankruptcyScore >= 85 ? '강력 추천' : bankruptcyScore >= 65 ? '적합' : bankruptcyScore >= 40 ? '검토 필요' : '부적합', score: bankruptcyScore, reason: bankruptcyReason, color: bankruptcyScore >= 80 ? 'green' as const : bankruptcyScore >= 60 ? 'cyan' as const : bankruptcyScore >= 40 ? 'yellow' as const : 'red' as const },
            workout: { status: workoutScore >= 85 ? '강력 추천' : workoutScore >= 65 ? '적합' : workoutScore >= 40 ? '검토 필요' : '부적합', score: workoutScore, reason: workoutReason, color: workoutScore >= 80 ? 'green' as const : workoutScore >= 60 ? 'cyan' as const : workoutScore >= 40 ? 'yellow' as const : 'red' as const }
        };
    }, [userInput, result]);

    // 2. 상담 위급성 진단
    const urgency = useMemo(() => {
        const hasRecentLoan = userInput.riskFactor === 'recent_loan';
        const hasSpeculative = userInput.riskFactor === 'gambling' || userInput.riskFactor === 'investment';
        const hasPriority = (userInput.priorityDebt || 0) > 0;

        if (hasPriority) {
            return { level: '매우 위급 (상)', color: '#EF4444', desc: '국세/세금 체납이 존재하여 즉시 재산 압류가 예상되는 위급 상태입니다.', bg: 'bg-red-500/10 text-red-400 border border-red-500/20' };
        } else if (hasRecentLoan) {
            return { level: '위급 (중상)', color: '#F97316', desc: '최근 1년 이내 신규 대출 비율이 높아 금융사 집중 독촉이 우려되는 상태입니다.', bg: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
        } else if (hasSpeculative) {
            return { level: '주의 (중)', color: '#F59E0B', desc: '주식/코인/사행성 손실 채무가 있어 법정 청산가치 소명이 필수적인 상태입니다.', bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
        }
        return { level: '보통 (하)', color: '#10B981', desc: '일반 신용 채무 상태로 가용소득 기반 조정 절차를 순차 진행하기에 적절합니다.', bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    }, [userInput]);

    // 3. 통화 포맷터 (만원 단위 변환 요약용)
    const currencyFormatter = (value: number) => {
        if (value >= 100000000) {
            return `${(value / 100000000).toFixed(1)}억`;
        } else if (value >= 10000) {
            return `${Math.floor(value / 10000).toLocaleString()}만`;
        }
        return value.toLocaleString();
    };

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                {/* Background Overlay */}
                <motion.div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                />

                {/* Main Report Container */}
                <motion.div
                    ref={reportRef}
                    initial={{ opacity: 0, y: 40, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                    className="relative w-full max-w-xl my-4 bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl text-slate-900"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ========== DARK HEADER BAR ========== */}
                    <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
                        <div className="flex items-start justify-between">
                            <div>
                                <motion.h1
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
                                >
                                    <Shield className="w-5 h-5 text-[#7264FF]" />
                                    의뢰인 종합 채무·자산 분석 리포트
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xs text-slate-600 mt-1"
                                >
                                    {userInput.name || '의뢰인'}님 진단서 · 기준: 2026.01 전국 회생법원 실무준칙
                                </motion.p>
                            </div>
                            <div className="flex items-center gap-2">
                                <motion.button
                                    onClick={() => { if (!requireLogin('pdf')) handleDownloadPDF(); }}
                                    disabled={isGeneratingPdf}
                                    className="p-1.5 text-slate-500 hover:text-[#7264FF] hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                    title="PDF 저장"
                                >
                                    <Download className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                    onClick={() => { if (!requireLogin('share')) setIsShareModalOpen(true); }}
                                    className="p-1.5 text-slate-500 hover:text-[#7264FF] hover:bg-slate-100 rounded-lg transition-colors"
                                    title="보안 공유"
                                >
                                    <Share2 className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                    onClick={onClose}
                                    className="p-1.5 text-slate-500 hover:text-[#7264FF] hover:bg-slate-100 rounded-lg transition-colors"
                                    title="닫기"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    {/* ========== TABS NAVIGATION ========== */}
                    <div className="flex bg-white border-b border-slate-200 sticky top-0 z-50 shrink-0 overflow-x-auto">
                        {(['overview', 'assets', 'debts', 'statistics', 'simulation', 'checklist'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveReportTab(tab)}
                                className={`flex-1 min-w-[70px] py-3 text-[12px] sm:text-xs font-semibold border-b-2 transition-all text-center whitespace-nowrap ${
                                    activeReportTab === tab
                                        ? 'border-[#7264FF] text-[#7264FF] bg-[#7264FF]/5 font-bold'
                                        : 'border-transparent text-slate-500 hover:text-slate-600'
                                }`}
                            >
                                {tab === 'overview' && '종합 분석'}
                                {tab === 'assets' && '재산·가구'}
                                {tab === 'debts' && '소득·채무'}
                                {tab === 'statistics' && '📊 나의 위치'}
                                {tab === 'simulation' && '💰 시뮬레이션'}
                                {tab === 'checklist' && '변호사 가이드'}
                            </button>
                        ))}
                    </div>

                    {/* ========== SCROLLABLE CONTENT AREA ========== */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
                        <AnimatePresence mode="wait">
                            
                            {/* TAB 1: 종합 분석 (Overview) */}
                            {activeReportTab === 'overview' && (
                                <motion.div
                                    key="overview"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {/* 위급성 경보 */}
                                    <div className={`p-4 rounded-xl flex items-start gap-3 ${urgency.bg}`}>
                                        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                                        <div>
                                            <div className="text-xs font-bold">상담 시급성: {urgency.level}</div>
                                            <div className="text-[13px] opacity-85 mt-0.5">{urgency.desc}</div>
                                        </div>
                                    </div>

                                    {/* 예상 탕감률 & 주요 요약 지표 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 shadow-sm p-4 rounded-xl">
                                        <div className="flex items-center justify-center py-2 border-b md:border-b-0 md:border-r border-slate-200 pr-0 md:pr-4">
                                            <DonutChart
                                                percentage={result.debtReductionRate}
                                                size={110}
                                                strokeWidth={9}
                                                colorFrom="#7264FF"
                                                colorTo="#10B981"
                                                delay={0.1}
                                                label="AI 예상 탕감률"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-center space-y-2.5 pl-0 md:pl-2">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">총 채무액</span>
                                                <span className="font-semibold text-slate-900">{formatCurrency(userInput.totalDebt)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">예상 실상환액</span>
                                                <span className="font-semibold text-[#10B981]">{formatCurrency(result.totalRepayment)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2.5">
                                                <span className="text-slate-500">예상 월 변제금</span>
                                                <span className="font-bold text-[#7264FF] text-sm">
                                                    <CountUp end={result.monthlyPayment} delay={0.2} formatter={currencyFormatter} suffix="원" />
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">변제 기간</span>
                                                <span className="font-semibold text-slate-900">{result.repaymentMonths}개월</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 조정 제도별 적합도 진단 */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-[#7264FF]" />
                                            제도별 최적 적합도 진단
                                        </h3>

                                        {/* 개인회생 적합도 카드 */}
                                        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4 text-[#7264FF]" />
                                                    법원 개인회생 (채무자 회생법)
                                                </span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-bold ${
                                                    suitabilities.rehab.color === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    suitabilities.rehab.color === 'cyan' ? 'bg-sky-500/10 text-sky-400' :
                                                    'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    {suitabilities.rehab.status}
                                                </span>
                                            </div>
                                            <AnimatedProgress
                                                value={suitabilities.rehab.score}
                                                colorFrom="#7264FF"
                                                colorTo="#10B981"
                                                height={6}
                                            />
                                            <p className="text-[13px] text-slate-600 leading-relaxed pt-1">
                                                {suitabilities.rehab.reason}
                                            </p>
                                        </div>

                                        {/* 개인파산 적합도 카드 */}
                                        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                                    <Shield className="w-4 h-4 text-emerald-400" />
                                                    개인파산 면책 (전액 탕감)
                                                </span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-bold ${
                                                    suitabilities.bankruptcy.color === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    suitabilities.bankruptcy.color === 'cyan' ? 'bg-sky-500/10 text-sky-400' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {suitabilities.bankruptcy.status}
                                                </span>
                                            </div>
                                            <AnimatedProgress
                                                value={suitabilities.bankruptcy.score}
                                                colorFrom="#10B981"
                                                colorTo="#64748B"
                                                height={6}
                                            />
                                            <p className="text-[13px] text-slate-600 leading-relaxed pt-1">
                                                {suitabilities.bankruptcy.reason}
                                            </p>
                                        </div>

                                        {/* 신용회복 적합도 카드 */}
                                        <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                                    <Users className="w-4 h-4 text-sky-400" />
                                                    신용회복위원회 워크아웃
                                                </span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-bold ${
                                                    suitabilities.workout.color === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    suitabilities.workout.color === 'cyan' ? 'bg-sky-500/10 text-sky-400' :
                                                    'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    {suitabilities.workout.status}
                                                </span>
                                            </div>
                                            <AnimatedProgress
                                                value={suitabilities.workout.score}
                                                colorFrom="#38BDF8"
                                                colorTo="#475569"
                                                height={6}
                                            />
                                            <p className="text-[13px] text-slate-350 leading-relaxed pt-1">
                                                {suitabilities.workout.reason}
                                            </p>
                                        </div>
                                    </div>

                                    {/* V2.1: 회생 전/후 비교 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-3">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <BarChart3 className="w-3.5 h-3.5 text-[#7264FF]" />
                                            회생 전/후 비교
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-[13px] mb-1">
                                                    <span className="text-slate-500">현재 월 부담 (36개월 기준)</span>
                                                    <span className="text-red-400 font-bold">{formatCurrency(Math.round(userInput.totalDebt / 36))}</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: '100%' }}
                                                        transition={{ duration: 0.8, delay: 0.2 }}
                                                        className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[13px] mb-1">
                                                    <span className="text-slate-500">회생 후 월 변제금</span>
                                                    <span className="text-emerald-400 font-bold">{formatCurrency(result.monthlyPayment)}</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${Math.min(100, Math.round((result.monthlyPayment / Math.max(1, userInput.totalDebt / 36)) * 100))}%` }}
                                                        transition={{ duration: 0.8, delay: 0.5 }}
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-center">
                                                    <div className="text-[12px] text-slate-600 font-semibold">월 절약액</div>
                                                    <div className="text-xs font-bold text-emerald-600 mt-0.5">
                                                        {formatCurrency(Math.max(0, Math.round(userInput.totalDebt / 36) - result.monthlyPayment))}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-center">
                                                    <div className="text-[12px] text-slate-600 font-semibold">총 탕감액</div>
                                                    <div className="text-xs font-bold text-[#7264FF] mt-0.5">{formatCurrency(result.totalDebtReduction)}</div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-center">
                                                    <div className="text-[12px] text-slate-600 font-semibold">감소율</div>
                                                    <div className="text-xs font-bold text-amber-600 mt-0.5">{result.debtReductionRate}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* TAB 2: 재산 및 가구 명세 (Assets & Family) */}
                            {activeReportTab === 'assets' && (
                                <motion.div
                                    key="assets"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {/* 가구 구성 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-[#7264FF]" />
                                            가계 및 부양가족 상세 판정
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                <span className="text-slate-500 block mb-1">인정 부양 가구원수</span>
                                                <span className="text-base font-bold text-slate-900">{userInput.familySize}인</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                <span className="text-slate-500 block mb-1">혼인 여부</span>
                                                <span className="text-base font-bold text-slate-900">
                                                    {userInput.maritalStatus === 'married' ? '기혼' :
                                                     userInput.maritalStatus === 'divorced' ? '이혼' : '미혼'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 부양가족 상세 해설 추가 */}
                                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-150 text-xs space-y-2 text-slate-900">
                                            <div className="font-bold flex items-center gap-1">
                                                <Shield className="w-3.5 h-3.5 text-[#7264FF]" />
                                                <span>💡 부양가족 산정 기준 및 공제 설명</span>
                                            </div>
                                            <p className="text-[13px] text-slate-600 leading-relaxed">
                                                인정 부양가족 수는 <strong>{userInput.familySize ? userInput.familySize - 1 : 0}명</strong>으로 산정되어 본인을 포함해 총 <strong>{userInput.familySize || 1}인 가구</strong>로 변제금을 계산합니다.
                                            </p>
                                            <ul className="text-[10.5px] text-slate-600 list-disc pl-4 space-y-1">
                                                <li><strong>미성년 자녀:</strong> 만 19세 미만 자녀는 전원 인정되나, 맞벌이 시 소득이 월등히 높은 사람에게 일괄 반영하거나 부부 간 1명씩 분할 반영합니다.</li>
                                                <li><strong>고령 부모님 (만 65세 이상):</strong> 동거 상태에서 실질적인 부양 중이어야 하며, 부모님의 재산이나 별도 소득이 없거나 소액이어야 인정됩니다.</li>
                                                <li><strong>배우자:</strong> 신체 건강하여 일할 수 있는 경우 부양가족에서 제외됩니다. (장애나 지병 등 예외 사유 소명 시에만 가능)</li>
                                            </ul>
                                            {userInput.familySize && userInput.familySize >= 2 && (
                                                <div className="text-[13px] font-semibold text-[#7264FF] border-t border-slate-200/60 pt-1.5 mt-1.5">
                                                    👉 2명 부양 시 총 3인 가구 생계비(2026 보건복지부 기준 월 3,012,382원)를 보장받아 공제됩니다.
                                                </div>
                                            )}
                                        </div>
                                        {userInput.dependentReason && (
                                            <div className="text-[13px] text-[#7264FF] bg-[#7264FF]/5 p-2 rounded-lg border border-[#7264FF]/10">
                                                💡 {userInput.dependentReason}
                                            </div>
                                        )}
                                    </div>

                                    {/* 자산 목록 및 법원 청산가치 평가 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <Home className="w-4 h-4 text-[#10B981]" />
                                            보유 자산 및 법상 청산가치 명세
                                        </h4>
                                        
                                        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                                            <div className="grid grid-cols-3 bg-white p-2.5 font-semibold text-slate-450 border-b border-slate-200">
                                                <span>자산 구분</span>
                                                <span className="text-right">실제 신고 자산액</span>
                                                <span className="text-right text-[#7264FF]">법원 청산가치 반영액</span>
                                            </div>
                                            <div className="grid grid-cols-3 p-2.5 border-b border-slate-200/60 items-center">
                                                <span>본인 자산 (차량, 예금 등)</span>
                                                <span className="text-right text-slate-600">{formatCurrency(userInput.myAssets)}</span>
                                                <span className="text-right font-medium text-slate-900">{formatCurrency(userInput.myAssets)}</span>
                                            </div>
                                            {userInput.spouseAssets !== undefined && userInput.spouseAssets > 0 && (
                                                <div className="grid grid-cols-3 p-2.5 border-b border-slate-200/60 items-center">
                                                    <span>배우자 자산 (50% 반영)</span>
                                                    <span className="text-right text-slate-500">{formatCurrency(userInput.spouseAssets)}</span>
                                                    <span className="text-right font-medium text-[#F59E0B]">{formatCurrency(userInput.spouseAssets * 0.5)}</span>
                                                </div>
                                            )}
                                            {userInput.deposit !== undefined && userInput.deposit > 0 && (
                                                <>
                                                    <div className="grid grid-cols-3 p-2.5 border-b border-slate-200/60 items-center">
                                                        <span>임차 보증금 ({userInput.housingType === 'jeonse' ? '전세' : '월세'})</span>
                                                        <span className="text-right text-slate-600">{formatCurrency(userInput.deposit)}</span>
                                                        <span className="text-right font-medium text-slate-900">{formatCurrency(userInput.deposit)}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 p-2.5 border-b border-slate-200/60 items-center text-[#10B981] bg-emerald-500/5">
                                                        <span className="font-medium">법원 소액임차 면제재산</span>
                                                        <span className="text-right">최대 공제</span>
                                                        <span className="text-right font-semibold">-{formatCurrency(result.exemptDeposit)}</span>
                                                    </div>
                                                </>
                                            )}
                                            {userInput.retirementPay !== undefined && userInput.retirementPay > 0 && (
                                                <div className="grid grid-cols-3 p-2.5 border-b border-slate-200/60 items-center">
                                                    <span>
                                                        예상 퇴직금 
                                                        <span className="text-[12px] text-slate-450 block font-normal mt-0.5">
                                                            ({userInput.retirementPensionType === 'pension' ? '퇴직연금 가입 - 0% 반영' :
                                                              userInput.retirementPensionType === 'none' ? '연금 미가입 - 50% 반영' : 
                                                              '연금 모름 - 50% 반영'})
                                                        </span>
                                                    </span>
                                                    <span className="text-right text-slate-500">{formatCurrency(userInput.retirementPay)}</span>
                                                    <span className={`text-right font-semibold ${userInput.retirementPensionType === 'pension' ? 'text-slate-500' : 'text-[#F59E0B]'}`}>
                                                        {formatCurrency(userInput.retirementPensionType === 'pension' ? 0 : userInput.retirementPay * 0.5)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 bg-white p-3 font-bold text-sm items-center border-t border-slate-200">
                                                <span className="text-slate-900">최종 청산가치 합계</span>
                                                <span></span>
                                                <span className="text-right text-[#7264FF]">{formatCurrency(result.liquidationValue)}</span>
                                            </div>
                                        </div>

                                        {/* CSS 시각화 게이지바 추가 */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 space-y-2 mt-2">
                                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                                                <span>⚖️ 청산가치(내 재산) 대비 3년 총 변제예정액 비율</span>
                                                <span className="text-[#10B981] font-bold">{Math.round((result.totalRepayment / Math.max(1, result.liquidationValue)) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-gradient-to-r from-[#10B981] to-[#7264FF] h-full rounded-full" 
                                                    style={{ width: `${Math.min(100, Math.round((result.totalRepayment / Math.max(1, result.liquidationValue)) * 100))}%` }}
                                                />
                                            </div>
                                            <p className="text-[12px] text-slate-600 leading-relaxed mt-1">
                                                * <strong>청산가치 보장 원칙</strong>: 3년간 법원에 갚는 돈의 합계({formatCurrency(result.totalRepayment)})가 내 재산({formatCurrency(result.liquidationValue)})보다 많아야 회생이 허가됩니다.
                                            </p>
                                        </div>

                                        {/* 자산 산정 상세 가이드 추가 */}
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 text-xs space-y-2 text-slate-900">
                                            <div className="font-bold flex items-center gap-1">
                                                <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                                                <span>📋 재산 평가 및 공제 상세 기준 안내</span>
                                            </div>
                                            <ul className="text-[10.5px] text-slate-550 list-disc pl-4 space-y-1.5">
                                                <li><strong>배우자 자산 반영:</strong> 부부 공동재산 추정으로 50% 가산하나, 서울/수원/부산회생법원 준칙을 적용받는 관할인 경우 원칙적으로 반영하지 않아 대단히 유리합니다.</li>
                                                <li><strong>퇴직연금 전액 면제 (0% 반영):</strong> 일반 퇴직금은 예상액의 50%가 반영되나, 근로자퇴직급여 보장법에 의해 완전히 압류가 금지된 퇴직연금(DB, DC, IRP)은 전액 제외됩니다.</li>
                                                <li><strong>임차보증금 공제 (최우선변제금):</strong> 주택임대차보호법에 따라 지역별 서민 주거 보장 금액(서울 5,500만 원, 과밀억제권역 4,800만 원 등)만큼 청산가치에서 제외됩니다.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* TAB 3: 소득 및 채무 명세 (Income & Debts) */}
                            {activeReportTab === 'debts' && (
                                <motion.div
                                    key="debts"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {/* 소득 상세 명세 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <DollarSign className="w-4 h-4 text-[#7264FF]" />
                                            소득 및 법정 생계비 분석
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                <span className="text-slate-500 block mb-1">직업 형태</span>
                                                <span className="text-base font-bold text-slate-900">
                                                    {userInput.employmentType === 'salary' ? '급여 소득자' :
                                                     userInput.employmentType === 'business' ? '영업 소득자' :
                                                     userInput.employmentType === 'freelancer' ? '프리랜서' :
                                                     userInput.employmentType === 'both' ? '겸업 소득자' :
                                                     userInput.employmentType === 'daily' ? '일용직' : '무직'}
                                                </span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                <span className="text-slate-500 block mb-1">월 평균 실수령액</span>
                                                <span className="text-base font-bold text-[#7264FF]">{formatCurrency(userInput.monthlyIncome)}</span>
                                            </div>
                                        </div>
                                        <dl className="space-y-2 text-xs border-t border-slate-200/50 pt-2.5">
                                            <div className="flex justify-between items-center py-1">
                                                <dt className="text-slate-500">• 법원 기본 인정 생계비 (보건복지부 기준 60%)</dt>
                                                <dd className="text-slate-600 font-semibold">{formatCurrency(result.baseLivingCost)}</dd>
                                            </div>
                                            {result.additionalLivingCost > 0 && (
                                                <div className="flex justify-between items-center py-1">
                                                    <dt className="text-slate-500">• 가중 추가 생계비 (주거/의료/교육)</dt>
                                                    <dd className="text-[#10B981] font-semibold">+{formatCurrency(result.additionalLivingCost)}</dd>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center py-2 border-t border-slate-200 font-bold text-sm">
                                                <dt className="text-slate-900 font-bold">최종 인정 생계비 합계</dt>
                                                <dd className="text-emerald-500 font-bold">{formatCurrency(result.recognizedLivingCost)}</dd>
                                            </div>
                                            <div className="flex justify-between items-center py-2 font-bold text-sm text-slate-900 bg-[#7264FF]/5 px-2 rounded">
                                                <dt>월 가용 소득 (법원에 매달 갚는 돈)</dt>
                                                <dd className="text-[#7264FF] font-bold">{formatCurrency(result.availableIncome)}</dd>
                                            </div>
                                        </dl>

                                        {/* 2026년 기준 중위소득 60% 생계비 표 안내 */}
                                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-150 text-xs">
                                            <div className="font-bold text-slate-850 flex items-center gap-1 mb-2">
                                                <Shield className="w-3.5 h-3.5 text-[#7264FF]" />
                                                <span>📋 2026년 법정 기준 최저 생계비 표 (60% 기준)</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center text-[12px] bg-white p-2 rounded border border-slate-200">
                                                <span className="font-bold text-slate-600">가구원수</span>
                                                <span className="font-bold text-slate-600">기준 중위소득</span>
                                                <span className="font-bold text-[#7264FF]">인정 생계비</span>
                                                
                                                <span>1인 가구</span>
                                                <span className="text-slate-500">256만 원</span>
                                                <span className="font-semibold text-slate-900">153.8만 원</span>
                                                
                                                <span>2인 가구</span>
                                                <span className="text-slate-500">420만 원</span>
                                                <span className="font-semibold text-slate-900">251.9만 원</span>
                                                
                                                <span className="bg-slate-100/60 rounded">3인 가구</span>
                                                <span className="bg-slate-100/60 text-slate-500 rounded">536만 원</span>
                                                <span className="bg-slate-100/60 font-bold text-[#7264FF] rounded">321.5만 원</span>
                                                
                                                <span>4인 가구</span>
                                                <span className="text-slate-500">649만 원</span>
                                                <span className="font-semibold text-slate-900">389.6만 원</span>
                                            </div>
                                            <p className="text-[10.5px] text-slate-600 mt-2.5 leading-relaxed">
                                                ※ <strong>월 변제금 공식</strong>: [월 실수령액] - [최종 인정 생계비] = [가용소득(월 변제금)]. 생계비가 크고 소득이 보정될수록 매달 갚을 돈은 낮아집니다.
                                            </p>
                                        </div>
                                    </div>

                                    {/* 채무 명세 및 위험 채무 검토 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <CreditCard className="w-4 h-4 text-[#EF4444]" />
                                            채무 세부 구성 분석
                                        </h4>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                                            <div className="grid grid-cols-2 bg-white p-2.5 font-semibold text-slate-450 border-b border-slate-200">
                                                <span>채무 분류</span>
                                                <span className="text-right">채무 금액</span>
                                            </div>
                                            <div className="grid grid-cols-2 p-2.5 border-b border-slate-200/60">
                                                <span>신용대출 및 일반 금융권 채무</span>
                                                <span className="text-right text-slate-650 font-semibold">
                                                    {formatCurrency(Math.max(0, (userInput.totalDebt || 0) - (userInput.creditCardDebt || 0) - (userInput.priorityDebt || 0)))}
                                                </span>
                                            </div>
                                            {userInput.creditCardDebt !== undefined && userInput.creditCardDebt > 0 && (
                                                <div className="grid grid-cols-2 p-2.5 border-b border-slate-200/60">
                                                    <span>신용카드 결제대금 및 카드론</span>
                                                    <span className="text-right text-slate-650 font-semibold">{formatCurrency(userInput.creditCardDebt)}</span>
                                                </div>
                                            )}
                                            {userInput.priorityDebt !== undefined && userInput.priorityDebt > 0 && (
                                                <div className="grid grid-cols-2 p-2.5 border-b border-slate-200/60 bg-red-50 text-red-700">
                                                    <span className="font-semibold">우선 변제 채권 (체납 국세/지방세/4대보험)</span>
                                                    <span className="text-right font-bold">{formatCurrency(userInput.priorityDebt)}</span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 bg-white p-3 font-bold text-sm border-t border-slate-200">
                                                <span className="text-slate-900">총 채무 합계</span>
                                                <span className="text-right text-slate-900">{formatCurrency(userInput.totalDebt)}</span>
                                            </div>
                                        </div>

                                        {/* 위험채무 경고문구 */}
                                        {userInput.riskFactor !== 'none' && (
                                            <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-xs flex items-start gap-2 text-amber-400">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                <div>
                                                    {userInput.riskFactor === 'recent_loan' && (
                                                        <p><strong>최근 채무 의심 경고</strong>: 최근 1년 내에 발생한 채무 비중이 높은 경우, 법원에서는 사용처 소명을 매우 까다롭게 요구하며 고의적 대출 유발 여부를 심사하므로 철저한 법률 준비가 요구됩니다.</p>
                                                    )}
                                                    {userInput.riskFactor === 'investment' && (
                                                        <p><strong>주식/코인 투자 손실 경고</strong>: 투자성 손실 채무는 거주 법원에 따라 청산가치에 반영되거나 제외되는 실무준칙 차이가 큽니다. 기각 없이 안전하게 개시결정을 받기 위해 법리 검토가 필요합니다.</p>
                                                    )}
                                                    {userInput.riskFactor === 'gambling' && (
                                                        <p><strong>사행성 채무 경고</strong>: 도박 채무는 파산 시 면책 불허가 사유에 해당하나 개인회생에서는 진행이 가능합니다. 다만 탕감률 보정 권고 수위가 높으므로 적극적인 소명이 수반되어야 합니다.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* TAB 4: 변호사 핵심 가이드 (Lawyer Checklist) */}
                            {activeReportTab === 'checklist' && (
                                <motion.div
                                    key="checklist"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {/* 독촉 정지/금지명령 예측 */}
                                    <div className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl space-y-2">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <Shield className="w-4 h-4 text-[#7264FF]" />
                                            금지명령/중지명령 인용 가능성
                                        </h4>
                                        <div className="flex justify-between items-center py-2.5">
                                            <span className="text-sm font-semibold text-slate-900">독촉 차단 금지명령 예상 인용도</span>
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                                                userInput.riskFactor === 'recent_loan' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                                {userInput.riskFactor === 'recent_loan' ? '주의 (법원 보정 가능)' : '양호 (즉시 인용 기대)'}
                                            </span>
                                        </div>
                                        <p className="text-[13px] text-slate-500 leading-relaxed">
                                            ※ 과거 회생 면책 5년 이내 이력이 없고 최근 채무 남용이 아닌 경우, 법원 접수 후 평균 3~7일 내 금지명령이 인용되어 일체의 추심 및 압류 행위가 즉시 금지됩니다.
                                        </p>
                                    </div>

                                    {/* 변호사 검토 checklist */}
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-[#10B981]" />
                                            변호사용 실무 쟁점 체크리스트
                                        </h4>
                                        <ul className="space-y-2.5 text-xs text-slate-600">
                                            <li className="flex gap-2 items-start">
                                                <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                <span>청산가치 보장 원칙 충족 여부 확인 필요: 가용소득 기반 변제액이 청산가치 {formatCurrency(result.liquidationValue)}보다 많은지 계산 검토</span>
                                            </li>
                                            {userInput.spouseAssets !== undefined && userInput.spouseAssets > 0 && (
                                                <li className="flex gap-2 items-start">
                                                    <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                    <span>배우자 재산 소명: 배우자 명의 재산 반등({formatCurrency(userInput.spouseAssets * 0.5)})에 대한 가계 기여도 예외 사유(상속, 결혼 전 형성 등) 조력 준비</span>
                                                </li>
                                            )}
                                            {userInput.riskFactor === 'recent_loan' && (
                                                <li className="flex gap-2 items-start">
                                                    <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                    <span>최근 채무 소명 대책: 신규 대출금의 기존 채무 상환(대환) 사용 내역 및 실질 생활비 소요 내역 증빙 준비</span>
                                                </li>
                                            )}
                                            {userInput.riskFactor === 'investment' && (
                                                <li className="flex gap-2 items-start">
                                                    <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                    <span>투자 손실 준칙 적용: 관할 법원({result.courtName})의 서울/수원/부산 준칙 적용 및 투자 손실금의 청산가치 제외 법리 구성 검토</span>
                                                </li>
                                            )}
                                            {userInput.priorityDebt !== undefined && userInput.priorityDebt > 0 && (
                                                <li className="flex gap-2 items-start">
                                                    <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                    <span>세금 체납 체납 조정: 우선권 채무액({formatCurrency(userInput.priorityDebt)})에 대한 변제 개월 수(최대 18개월 이내 우선 변제) 및 가용 소득 배정 밸런스 점검</span>
                                                </li>
                                            )}
                                            <li className="flex gap-2 items-start">
                                                <Check className="w-4 h-4 text-[#7264FF] mt-0.5 shrink-0" />
                                                <span>추가 생계비 소명: {userInput.rentCost && userInput.rentCost > 0 ? '추가 주거비' : ''} {userInput.medicalCost && userInput.medicalCost > 0 ? '정기 의료비' : ''} {userInput.educationCost && userInput.educationCost > 0 ? '추가 교육비' : ''} 증빙(임대차 계약서, 의료 처방전, 학비 영수증) 제출 대기</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* 법원 절차 타임라인 */}
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                                        <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4 text-[#2563EB]" />
                                            예상 진행 절차 소요 시간 ({result.courtName} 기준)
                                        </h4>
                                        <ProcedureTimeline processingMonths={result.processingMonths} />
                                    </div>
                                </motion.div>
                            )}

                            {/* TAB 5: 통계 비교 (나의 위치) - V2.1 신규 */}
                            {activeReportTab === 'statistics' && (
                                <motion.div
                                    key="statistics"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        2025년 서울회생법원 통계 기준 나의 위치
                                    </h3>

                                    {/* 소득 비교 */}
                                    <StatComparisonCard
                                        title="월 소득 비교"
                                        userValue={userInput.monthlyIncome}
                                        averageValue={AVERAGE_VALUES.monthlyIncome}
                                        percentile={calculateIncomePercentile(userInput.monthlyIncome)}
                                        icon={<DollarSign className="w-4 h-4" />}
                                        unit="원"
                                    />

                                    {/* 채무 비교 */}
                                    <StatComparisonCard
                                        title="총 채무 비교"
                                        userValue={userInput.totalDebt}
                                        averageValue={AVERAGE_VALUES.totalDebt}
                                        percentile={calculateDebtPercentile(userInput.totalDebt)}
                                        icon={<CreditCard className="w-4 h-4" />}
                                        unit="원"
                                    />

                                    {/* 탕감율 비교 */}
                                    <StatComparisonCard
                                        title="예상 탕감율 비교"
                                        userValue={result.debtReductionRate}
                                        averageValue={AVERAGE_VALUES.debtReductionRate}
                                        percentile={calculateReductionRatePercentile(result.debtReductionRate)}
                                        icon={<Percent className="w-4 h-4" />}
                                        unit="%"
                                    />

                                    {/* 채무 금액대 분포 */}
                                    <DistributionBar
                                        title="채무 금액대 분포"
                                        userValue={userInput.totalDebt}
                                        distribution={REHAB_STATISTICS_2025.debtAmountDistribution}
                                        highlightRange={(() => {
                                            const debt = userInput.totalDebt;
                                            if (debt < 50000000) return '5천만원 이하';
                                            if (debt < 100000000) return '5천만원 초과 1억원 이하';
                                            if (debt < 200000000) return '1억원 초과 2억원 이하';
                                            return '2억원 초과';
                                        })()}
                                    />

                                    {/* AI 통계 인사이트 */}
                                    {(() => {
                                        const insights = generateStatisticalInsights({
                                            monthlyIncome: userInput.monthlyIncome,
                                            totalDebt: userInput.totalDebt,
                                            debtReductionRate: result.debtReductionRate,
                                            familySize: userInput.familySize || 1
                                        });
                                        return insights.length > 0 ? (
                                            <div className="bg-[#7264FF]/5 border border-[#7264FF]/20 p-4 rounded-xl space-y-2">
                                                <h4 className="text-xs font-bold text-[#7264FF] flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    AI 통계 인사이트
                                                </h4>
                                                {insights.map((insight, idx) => (
                                                    <p key={idx} className="text-[13px] text-slate-600 flex items-start gap-1.5">
                                                        <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                                        {insight}
                                                    </p>
                                                ))}
                                            </div>
                                        ) : null;
                                    })()}

                                    {/* 위험 요인 분석 (V2.1) */}
                                    {result.riskFactors && result.riskFactors.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                                위험 요인 분석
                                            </h4>
                                            {result.riskFactors.map((factor, idx) => (
                                                <div key={idx} className={`p-3 rounded-xl border ${
                                                    factor.level === 'high' ? 'bg-red-500/5 border-red-500/20' :
                                                    factor.level === 'medium' ? 'bg-amber-500/5 border-amber-500/20' :
                                                    'bg-emerald-500/5 border-emerald-500/20'
                                                }`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            factor.level === 'high' ? 'bg-red-400' :
                                                            factor.level === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                                                        }`} />
                                                        <span className="text-xs font-bold text-slate-900">{factor.title}</span>
                                                    </div>
                                                    <p className="text-[13px] text-slate-500 ml-4">{factor.description}</p>
                                                    <p className="text-[13px] text-emerald-400 ml-4 mt-1">💡 {factor.solution}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* TAB 6: 월 가계 시뮬레이션 - V2.1 신규 */}
                            {activeReportTab === 'simulation' && (
                                <motion.div
                                    key="simulation"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        회생 전/후 월 가계 시뮬레이션
                                    </h3>

                                    {/* 회생 전 */}
                                    {result.monthlyBudgetBefore && result.monthlyBudgetBefore.length > 0 && (
                                        <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl space-y-2">
                                            <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                                ❌ 현재 (회생 전)
                                            </h4>
                                            <div className="space-y-1.5">
                                                {result.monthlyBudgetBefore.map((item, idx) => (
                                                    <div key={idx} className={`flex justify-between items-center text-xs px-2 py-1.5 rounded-lg ${
                                                        item.type === 'total' ? 'bg-slate-100 border border-slate-200 mt-2' :
                                                        item.highlight ? 'bg-red-500/5' : ''
                                                    }`}>
                                                        <span className={`${
                                                            item.type === 'total' ? 'font-bold text-slate-900' :
                                                            item.type === 'income' ? 'text-slate-600' : 'text-slate-500'
                                                        }`}>{item.label}</span>
                                                        <span className={`font-semibold ${
                                                            item.type === 'income' ? 'text-slate-900' :
                                                            item.type === 'total' && item.amount < 0 ? 'text-red-600 font-bold' :
                                                            item.type === 'total' ? 'text-emerald-600' :
                                                            item.highlight ? 'text-red-500' : 'text-slate-600'
                                                        }`}>
                                                            {formatCurrency(Math.abs(item.amount))}
                                                            {item.type === 'total' && item.amount < 0 && ' ❌ 부족'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 화살표 */}
                                    <div className="flex justify-center">
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="bg-[#7264FF] text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5"
                                        >
                                            ⬇ 개인회생 신청 후 ⬇
                                        </motion.div>
                                    </div>

                                    {/* 회생 후 */}
                                    {result.monthlyBudgetAfter && result.monthlyBudgetAfter.length > 0 && (
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-2">
                                            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                                ✅ 회생 후
                                            </h4>
                                            <div className="space-y-1.5">
                                                {result.monthlyBudgetAfter.map((item, idx) => (
                                                    <div key={idx} className={`flex justify-between items-center text-xs px-2 py-1.5 rounded-lg ${
                                                        item.type === 'total' ? 'bg-slate-100 border border-slate-200 mt-2' :
                                                        item.highlight ? 'bg-[#7264FF]/5' : ''
                                                    }`}>
                                                        <span className={`${
                                                            item.type === 'total' ? 'font-bold text-slate-900' :
                                                            item.type === 'income' ? 'text-slate-600' : 'text-slate-500'
                                                        }`}>{item.label}</span>
                                                        <span className={`font-semibold ${
                                                            item.type === 'income' ? 'text-slate-900' :
                                                            item.type === 'total' ? 'text-emerald-600 font-bold' :
                                                            item.highlight ? 'text-indigo-600' : 'text-slate-600'
                                                        }`}>
                                                            {formatCurrency(Math.abs(item.amount))}
                                                            {item.type === 'total' && ' ✅ 관리 가능'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 채무 구성 분석 (V2.1) */}
                                    {result.debtComposition && result.debtComposition.length > 0 && (
                                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                                <BarChart3 className="w-3.5 h-3.5 text-[#7264FF]" />
                                                채무 구성 분석
                                            </h4>
                                            <div className="space-y-2">
                                                {result.debtComposition.map((comp, idx) => (
                                                    <div key={idx}>
                                                        <div className="flex justify-between text-[13px] mb-1">
                                                            <span className="text-slate-600 flex items-center gap-1">
                                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.color }} />
                                                                {comp.label}
                                                            </span>
                                                            <span className="text-slate-500">
                                                                {formatCurrency(comp.amount)} ({comp.percentage}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${comp.percentage}%` }}
                                                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                                                className="h-full rounded-full"
                                                                style={{ backgroundColor: comp.color }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 법적 조치 대응 가이드 (V2.1) */}
                                    {result.legalActionGuide && result.legalActionGuide.length > 0 && (
                                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                            <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-amber-400" />
                                                법적 조치 대응 가이드
                                            </h4>
                                            {result.legalActionGuide.map((guide, idx) => (
                                                <div key={idx} className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">{guide.icon}</span>
                                                        <span className="text-xs font-bold text-slate-900">{guide.title}</span>
                                                    </div>
                                                    <p className="text-[13px] text-slate-600 ml-7">{guide.response}</p>
                                                    <p className="text-[12px] text-amber-400 ml-7">⏱ {guide.timeline}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 요약 절약 카드 */}
                                    <div className="bg-[#7264FF]/10 border border-[#7264FF]/20 p-4 rounded-xl text-center">
                                        <div className="text-[12px] text-slate-500 mb-1">{result.repaymentMonths}개월 후 잔여 채무</div>
                                        <div className="text-lg font-bold text-[#7264FF]">전액 면책 🎉</div>
                                        <div className="text-[13px] text-slate-500 mt-1">
                                            총 {formatCurrency(result.totalDebtReduction)} 탕감 · 월 {formatCurrency(Math.max(0, Math.round(userInput.totalDebt / 36) - result.monthlyPayment))} 절약
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* 챗봇 리포트 원 의견 코멘트 */}
                            {activeReportTab !== 'checklist' && activeReportTab !== 'statistics' && activeReportTab !== 'simulation' && (result.aiAdvice.length > 0 || result.riskWarnings.length > 0) && (
                                <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                        <Shield className="w-4 h-4 text-[#7264FF]" />
                                        AI 정밀 분석 핵심 소견
                                    </h4>
                                    <div className="space-y-1.5">
                                        {result.aiAdvice.slice(0, 3).map((advice, idx) => (
                                            <p key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                                                <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                                {advice}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </AnimatePresence>

                        {/* Status Reason & Disclaimer */}
                        <div className="text-center space-y-2 px-2 py-1">
                            <p className="text-[12px] text-slate-600 leading-relaxed">{result.statusReason}</p>
                            <p className="text-[11px] text-slate-600">
                                ※ 본 리포트의 진단 내용은 기재하신 답변을 근거로 도출되었으며, 정밀 판정을 위해 변호사 서류 상담이 필요합니다.
                            </p>
                        </div>
                    </div>

                    {/* ========== CTA FOOTER ========== */}
                    <div className="sticky bottom-0 p-4 bg-white border-t border-slate-200 shrink-0 z-50">
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => { if (!requireLogin('consultation')) onConsultation?.(); }}
                            className="w-full py-3.5 bg-[#7264FF] hover:bg-[#5b4cf5] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#7264FF]/20"
                        >
                            <Sparkles className="w-4 h-4 text-white" />
                            내 전담 변호사 선택하기
                            <ArrowRight className="w-4 h-4 text-white" />
                        </motion.button>

                        {/* Save & Share Buttons */}
                        <div className="flex gap-2 mt-3 text-xs font-semibold">
                            <button
                                onClick={() => { if (!requireLogin('pdf')) handleDownloadPDF(); }}
                                disabled={isGeneratingPdf}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-200 disabled:opacity-55"
                            >
                                <Download className="w-3.5 h-3.5" />
                                {isGeneratingPdf ? 'PDF 생성 중...' : '전문가 PDF 다운로드'}
                            </button>
                            <button
                                onClick={() => { if (!requireLogin('share')) setIsShareModalOpen(true); }}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                보안 공유 (PIN 번호 설정)
                            </button>
                        </div>
                    </div>

                    {/* Off-screen Printable Template */}
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', overflow: 'hidden', height: 0, width: 0 }}>
                        <PrintableReportTemplate result={result} userInput={userInput} />
                    </div>

                    {/* Secure Share Modal */}
                    <ReportShareModal
                        isOpen={isShareModalOpen}
                        onClose={() => setIsShareModalOpen(false)}
                        result={result}
                        userInput={userInput}
                    />

                    {/* Login Required Prompt Modal */}
                    {showLoginPrompt && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4" onClick={() => setShowLoginPrompt(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#7264FF]/15 to-[#5b4cf5]/10 flex items-center justify-center">
                                    <Shield className="w-7 h-7 text-[#7264FF]" />
                                </div>
                                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                                    로그인이 필요합니다
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed mb-5">
                                    {loginPromptAction === 'consultation'
                                        ? '전담 변호사를 선택하고 상담을 요청하려면 로그인이 필요합니다. 로그인 후 진단 결과가 내 관리방에 안전하게 저장됩니다.'
                                        : loginPromptAction === 'pdf'
                                            ? '진단 결과를 PDF로 저장하려면 로그인이 필요합니다. 로그인 후 다시 시도해주세요.'
                                            : '진단 결과를 공유하려면 로그인이 필요합니다. 로그인 후 다시 시도해주세요.'}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowLoginPrompt(false)}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors"
                                    >
                                        닫기
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowLoginPrompt(false);
                                            onShowAuthModal?.();
                                        }}
                                        className="flex-1 py-2.5 bg-[#7264FF] hover:bg-[#5b4cf5] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#7264FF]/20"
                                    >
                                        로그인 하기
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </motion.div>
            </motion.div >
        </AnimatePresence >,
        document.body
    );
};

export default RehabResultReport;
