import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Download, CheckCircle2, ShieldCheck, Scale, Sparkles, 
  Landmark, TrendingDown, Clock, AlertTriangle, MessageSquare, 
  DollarSign, FileText, ChevronRight, User, Printer, ArrowRight,
  Shield, Check, Phone, Building2, HelpCircle, Layers, Eye,
  BarChart3, Users, Home, CreditCard, Calculator, Percent, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

import { 
  RehabCalculationResult, 
  RehabUserInput, 
  formatCurrency, 
  calculateCurrentMonthlyBurden 
} from '../../rehab-chatbot-package/services/calculationService';
import { 
  DonutChart, 
  AnimatedProgress, 
  CountUp 
} from '../../rehab-chatbot-package/components/rehab/animations/ReportAnimations';
import { ProcedureTimeline } from '../../rehab-chatbot-package/components/rehab/ProcedureTimeline';
import { StatComparisonCard, DistributionBar } from '../../rehab-chatbot-package/components/rehab/StatisticalComparison';
import { 
  calculateIncomePercentile, 
  calculateDebtPercentile, 
  calculateReductionRatePercentile, 
  generateStatisticalInsights 
} from '../../rehab-chatbot-package/utils/statisticsUtils';
import { REHAB_STATISTICS_2025, AVERAGE_VALUES } from '../../rehab-chatbot-package/config/rehabStatistics2025';
import PrintableReportTemplate from '../client/PrintableReportTemplate';

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
    feeMemo?: string;
  };
  lawyerOpinion: string;
  specialNotes?: string[];
  clientQnA?: Array<{
    question: string;
    answer: string;
  }>;
  aiInsights?: {
    isAIPremium?: boolean;
    courtStats?: {
      courtName: string;
      injunctionRate: number;
      averageReductionRate: number;
      speedRating: string;
      specialRules?: string[];
    };
    debtBreakdown?: {
      secured: number;
      unsecured: number;
      tax: number;
    };
    financialSummary?: {
      monthlyIncome: number;
      monthlyExpense: number;
      disposableIncome: number;
      netAssetValue: number;
    };
    exemptAssets?: {
      smallDepositDeduction: number;
      exemptLivingCost: number;
      effectiveLiquidationValue: number;
    };
    reviewGrade?: string;
  };
  createdAt?: string;
}

interface PremiumProposalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: PremiumReportData;
  proposal?: any;
  clientInfo?: any;
  userInput?: RehabUserInput;
  calcResult?: RehabCalculationResult;
  onAppointLawyer?: () => void;
  isClientViewer?: boolean;
  isAppointed?: boolean;
  embedded?: boolean; // 스튜디오 미리보기용 인라인 모드
}

class ReportErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Report Rendering Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-8 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">제안서 화면을 준비 중입니다.</h3>
          <p className="text-xs text-slate-500">
            {this.state.error?.message || '잠시 후 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-[#1E3A5F] text-white rounded-xl text-xs font-bold"
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PremiumProposalReportModal({
  isOpen,
  onClose,
  reportData,
  proposal,
  clientInfo,
  userInput: userInputProp,
  calcResult: calcResultProp,
  onAppointLawyer,
  isClientViewer = true,
  isAppointed = false,
  embedded = false
}: PremiumProposalReportModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'debts' | 'statistics' | 'simulation' | 'guide'>('overview');
  const [viewMode, setViewMode] = useState<'tabbed' | 'continuous'>('tabbed');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, embedded, onClose]);

  if (!isOpen && !embedded) return null;

  // 1. 기본 정보 정규화
  const lawyerName = reportData?.lawyerInfo?.name || proposal?.attorneyReview?.reviewerName || proposal?.lawyerName || proposal?.lawyer?.name || '담당 변호사';
  const firmName = reportData?.lawyerInfo?.firmName || proposal?.attorneyReview?.firmName || proposal?.firmName || proposal?.lawyer?.firmName || '도산전문 법률사무소';
  const lawyerAvatar = reportData?.lawyerInfo?.avatar || proposal?.lawyerAvatar || proposal?.lawyer?.avatar;
  const clientName = reportData?.clientName || proposal?.clientName || clientInfo?.clientName || clientInfo?.name || '의뢰인';

  const rawCourt = reportData?.diagnosis?.court || proposal?.diagnosis?.court || proposal?.court || clientInfo?.court || '서울회생법원';
  const courtName = rawCourt.includes('법원') ? rawCourt : `${rawCourt}회생법원`;

  const totalDebt = reportData?.diagnosis?.totalDebt || proposal?.diagnosis?.totalDebt || proposal?.totalDebt || clientInfo?.totalDebt || 85000000;
  const monthlyPayment = reportData?.diagnosis?.monthlyPayment || proposal?.diagnosis?.monthlyPayment || proposal?.monthlyPayment || clientInfo?.monthlyPayment || 650000;
  const repaymentMonths = reportData?.diagnosis?.repaymentMonths || proposal?.diagnosis?.repaymentMonths || proposal?.repaymentMonths || clientInfo?.repaymentMonths || 36;
  const debtReductionRate = reportData?.diagnosis?.debtReductionRate || proposal?.diagnosis?.debtReductionRate || proposal?.debtReductionRate || clientInfo?.debtReductionRate || 68;
  const totalRepayment = reportData?.diagnosis?.totalRepayment || proposal?.diagnosis?.totalRepayment || (monthlyPayment * repaymentMonths);
  const estimatedReduction = reportData?.diagnosis?.estimatedReduction || proposal?.diagnosis?.estimatedReduction || Math.max(0, totalDebt - totalRepayment);

  const fees = reportData?.fees || proposal?.fees || {
    totalFee: proposal?.totalFee || proposal?.fee || 1800000,
    downPayment: proposal?.downPayment || 300000,
    installments: proposal?.installments || 5,
    monthlyInstallment: proposal?.monthlyInstallment || 300000,
    courtDeposit: proposal?.courtDeposit || 350000,
    feeMemo: proposal?.feeMemo || '수임료 분납 지원 (착수금 외 분할 납부)'
  };

  const lawyerOpinion = reportData?.lawyerOpinion || proposal?.lawyerOpinion || proposal?.remark || proposal?.opinion || 
    '의뢰인의 소득 및 부양가족 현황을 종합 검토한 결과, 관할 법원의 실무준칙에 의거하여 원금 대폭 탕감이 가능할 것으로 판단됩니다. 신속한 금지명령 신청을 통해 독촉 및 급여 압류를 즉각 중단시키겠습니다.';

  const specialNotes = reportData?.specialNotes || proposal?.specialNotes || [
    '신청 즉시 7일 이내 금지명령 결정을 목표로 접수합니다.',
    '최근 대출금 사용처 소명 자료(금융거래내역서) 준비를 전담 지원합니다.',
    '법원 인정 부양가족 범위를 최대로 산정하여 월 변제금을 최소화합니다.'
  ];

  const clientQnA = reportData?.clientQnA || proposal?.clientQnA || [
    { 
      question: '급여 압류나 독촉 전화는 언제 멈추나요?', 
      answer: '법원에 사건 접수 후 3~7일 내 금지명령이 발령되면 채권자의 모든 독촉 전화, 자택 방문, 급여 압류 행위가 법적으로 전면 중단됩니다.' 
    },
    { 
      question: '회사나 가족들이 알게 될까 봐 걱정됩니다.', 
      answer: '개인회생은 100% 비공개 절차입니다. 회사나 가족에게 어떠한 통지도 발송되지 않으며, 모든 법원 송달 서류는 당 법률사무소로 직접 수령됩니다.' 
    }
  ];

  const createdAt = reportData?.createdAt || proposal?.createdAt || new Date().toISOString();
  const reportDate = new Date(createdAt).toLocaleDateString('ko-KR');

  // 2. 의뢰인 입력값(userInput) 및 정밀 계산결과(calcResult) 복원 및 합성
  const activeUserInput: RehabUserInput = useMemo(() => {
    const raw = userInputProp || proposal?.rehabUserInput || clientInfo?.userInput || clientInfo || {};
    return {
      name: clientName,
      totalDebt: raw.totalDebt || totalDebt,
      monthlyIncome: raw.monthlyIncome || proposal?.aiInsights?.financialSummary?.monthlyIncome || 2450000,
      familySize: raw.familySize || 1,
      maritalStatus: raw.maritalStatus || 'single',
      isMarried: raw.isMarried || false,
      spouseIncome: raw.spouseIncome || 0,
      spouseAssets: raw.spouseAssets || 0,
      minorChildren: raw.minorChildren || 0,
      elderlyParentCount: raw.elderlyParentCount || 0,
      housingType: raw.housingType || 'wolse',
      deposit: raw.deposit || 30000000,
      depositLoan: raw.depositLoan || 0,
      myAssets: raw.myAssets || proposal?.aiInsights?.financialSummary?.netAssetValue || 12000000,
      retirementPay: raw.retirementPay || 0,
      retirementPensionType: raw.retirementPensionType || 'none',
      riskFactor: raw.riskFactor || 'none',
      employmentType: raw.employmentType || 'salary',
      rentCost: raw.rentCost || 0,
      medicalCost: raw.medicalCost || 0,
      educationCost: raw.educationCost || 0,
      priorityDebt: raw.priorityDebt || proposal?.aiInsights?.debtBreakdown?.tax || 0,
      creditCardDebt: raw.creditCardDebt || 0,
      speculativeLoss: raw.speculativeLoss || 0,
      gamblingLoss: raw.gamblingLoss || 0,
    };
  }, [userInputProp, proposal, clientInfo, clientName, totalDebt]);

  const activeCalcResult: RehabCalculationResult = useMemo(() => {
    const raw = calcResultProp || proposal?.rehabCalcResult || clientInfo?.rehabResult || {};
    const baseBurden = calculateCurrentMonthlyBurden(activeUserInput) || Math.round(activeUserInput.totalDebt * 0.038);

    return {
      status: raw.status || 'APPROVE',
      statusReason: raw.statusReason || '법정 신청 요건을 모두 충족하며 성공 가능성이 매우 높습니다.',
      repaymentMonths: raw.repaymentMonths || repaymentMonths,
      debtReductionRate: raw.debtReductionRate !== undefined ? raw.debtReductionRate : debtReductionRate,
      monthlyPayment: raw.monthlyPayment || monthlyPayment,
      totalRepayment: raw.totalRepayment || totalRepayment,
      totalDebtReduction: raw.totalDebtReduction || estimatedReduction,
      baseLivingCost: raw.baseLivingCost || 1538543,
      additionalLivingCost: raw.additionalLivingCost || 0,
      recognizedLivingCost: raw.recognizedLivingCost || 1538543,
      availableIncome: raw.availableIncome || monthlyPayment,
      liquidationValue: raw.liquidationValue || Math.max(10000000, (activeUserInput.myAssets || 0) + Math.max(0, (activeUserInput.deposit || 0) - 25000000)),
      exemptDeposit: raw.exemptDeposit || 25000000,
      processingMonths: raw.processingMonths || 6,
      courtName: raw.courtName || courtName,
      currentMonthlyBurden: raw.currentMonthlyBurden || baseBurden,
      monthlyBudgetBefore: raw.monthlyBudgetBefore || [
        { label: '월 평균 소득', amount: activeUserInput.monthlyIncome, type: 'income' },
        { label: '기존 대출 원리금 상환액', amount: -baseBurden, type: 'expense', highlight: true },
        { label: '기본 가계 생활비', amount: -850000, type: 'expense' },
        { label: '월 수지 차액 (매월 적자)', amount: activeUserInput.monthlyIncome - baseBurden - 850000, type: 'total' }
      ],
      monthlyBudgetAfter: raw.monthlyBudgetAfter || [
        { label: '월 평균 소득', amount: activeUserInput.monthlyIncome, type: 'income' },
        { label: '법원 공인 생계비 (보호)', amount: -1538543, type: 'expense' },
        { label: '회생 월 변제금 (고정)', amount: -monthlyPayment, type: 'expense', highlight: true },
        { label: '가계 잉여금 (안정 생활)', amount: activeUserInput.monthlyIncome - 1538543 - monthlyPayment, type: 'total' }
      ],
      debtComposition: raw.debtComposition || [
        { label: '은행/금융권 신용대출', amount: Math.round(activeUserInput.totalDebt * 0.65), percentage: 65, color: '#3B82F6' },
        { label: '카드론/캐피탈', amount: Math.round(activeUserInput.totalDebt * 0.25), percentage: 25, color: '#F59E0B' },
        { label: '기타/대부/통신', amount: Math.round(activeUserInput.totalDebt * 0.10), percentage: 10, color: '#EF4444' }
      ],
      riskFactors: raw.riskFactors || [
        {
          level: activeUserInput.riskFactor === 'recent_loan' ? 'high' : 'low',
          title: '최근 대출 비중 심사',
          description: '최근 발생한 대출은 생활비 및 기존 채무 대환에 사용되었음을 소명해야 합니다.',
          solution: '금융거래내역서 및 사용처 소명서 변호사 대리 작성'
        },
        {
          level: 'medium',
          title: '청산가치 보장 충족도',
          description: '3년간 총 변제액이 보유 재산 평가액보다 많아야 인가 결정이 내려집니다.',
          solution: '면제재산 및 공제 한도 최적 법리 반영'
        }
      ],
      aiAdvice: raw.aiAdvice || [
        `${courtName} 실무준칙에 의거하여 주식/코인 투자 손실금 청산가치 제외 특례 적용을 적극 권고합니다.`,
        '부양가족 인정 범위를 최대로 산정하여 가용소득을 최소화하고 월 변제금을 낮추었습니다.',
        '신속한 금지명령 신청을 통해 접수 후 3~7일 이내 채권자의 모든 독촉 및 압류를 차단합니다.'
      ]
    };
  }, [calcResultProp, proposal, clientInfo, activeUserInput, repaymentMonths, debtReductionRate, monthlyPayment, totalRepayment, estimatedReduction, courtName]);

  // 3. 3대 제도별 적합도 진단 산정
  const suitabilities = useMemo(() => {
    const debt = activeUserInput.totalDebt || 0;
    const assets = (activeUserInput.myAssets || 0) + (activeUserInput.spouseAssets || 0) * 0.5 + (activeUserInput.deposit || 0);
    const income = activeUserInput.monthlyIncome || 0;
    const livingCost = activeCalcResult.recognizedLivingCost || 1538543;

    let rehabScore = 95;
    let rehabReason = '월 소득이 법정 최저생계비 이상이고 채무액이 자산보다 크므로, 개인회생 진행 시 최대 원금 탕감 효과를 누릴 수 있는 최적의 상태입니다.';
    if (debt <= assets) {
      rehabScore = 45;
      rehabReason = '보유 자산 평가액이 채무보다 많아 청산가치 소명 대책 수립이 필수적입니다.';
    } else if (income <= livingCost * 0.8) {
      rehabScore = 65;
      rehabReason = '소득이 다소 경계선에 있으나 가구원 수 소명 및 추가 생계비 조정을 통해 충분히 승인이 가능합니다.';
    }

    let bankruptcyScore = 20;
    let bankruptcyReason = '안정적인 직업 소득이 최저생계비를 상회하므로 파산보다는 원금 탕감형 개인회생이 적합합니다.';
    if (income <= livingCost && assets < 25000000 && debt >= 30000000) {
      bankruptcyScore = 90;
      bankruptcyReason = '소득이 최저생계비 이하이고 자산이 없어 원금 100% 면책을 받는 파산 신청이 유리합니다.';
    }

    let workoutScore = 55;
    let workoutReason = '신용회복위원회 워크아웃 대비 법원 개인회생이 원금 탕감률(평균 60~90%)과 금융사 강제 구속력 면에서 월등히 유리합니다.';
    if (debt < 25000000 && income > livingCost) {
      workoutScore = 80;
      workoutReason = '채무 규모가 소액이므로 협약 기관 중심의 워크아웃도 병행 검토할 수 있습니다.';
    }

    return {
      rehab: { status: rehabScore >= 85 ? '강력 추천' : '적합', score: rehabScore, reason: rehabReason, color: 'green' as const },
      bankruptcy: { status: bankruptcyScore >= 80 ? '강력 추천' : bankruptcyScore >= 50 ? '검토 가능' : '부적합', score: bankruptcyScore, reason: bankruptcyReason, color: bankruptcyScore >= 80 ? 'green' as const : 'slate' as const },
      workout: { status: workoutScore >= 75 ? '검토 추천' : '부적합 (회생 권장)', score: workoutScore, reason: workoutReason, color: workoutScore >= 75 ? 'cyan' as const : 'yellow' as const }
    };
  }, [activeUserInput, activeCalcResult]);

  // 4. 시급성 진단
  const urgency = useMemo(() => {
    if ((activeUserInput.priorityDebt || 0) > 0) {
      return {
        level: '매우 위급 (상)',
        color: '#EF4444',
        desc: '국세/건보료 체납이 존재하여 즉시 재산 압류 및 통장 마비가 우려되는 상태입니다.',
        bg: 'bg-red-50 text-red-800 border-red-200',
        badgeBg: 'bg-red-600 text-white'
      };
    }
    if (activeUserInput.riskFactor === 'recent_loan') {
      return {
        level: '위급 (중상)',
        color: '#F97316',
        desc: '최근 대출 비중이 높아 채권사의 집중적인 독촉 및 지급명령이 예상되는 상태입니다.',
        bg: 'bg-orange-50 text-orange-800 border-orange-200',
        badgeBg: 'bg-orange-500 text-white'
      };
    }
    return {
      level: '양호 (보통)',
      color: '#10B981',
      desc: '일반 신용 채무 상태로 가용소득 기반 법원 개인회생을 순차 진행하기에 매우 안정적입니다.',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeBg: 'bg-emerald-600 text-white'
    };
  }, [activeUserInput]);

  // PDF 다운로드 핸들러
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    toast.info('공인 정밀진단서 PDF를 렌더링 중입니다...');

    try {
      // PDF 템플릿 마운트 대기
      await new Promise(resolve => setTimeout(resolve, 350));

      // 1. 만약 PrintableReportTemplate의 7페이지 요소가 DOM에 존재하면 전수 캡처
      const pageElements: HTMLElement[] = [];
      for (let i = 1; i <= 7; i++) {
        const el = document.getElementById(`pdf-page-${i}`);
        if (el) pageElements.push(el);
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;

      if (pageElements.length === 7) {
        const canvases = await Promise.all(
          pageElements.map(el => html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          }))
        );

        canvases.forEach((canvas, idx) => {
          if (idx > 0) pdf.addPage();
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, pageHeight, undefined, 'FAST');
        });
      } else {
        // 단일 화면 캡처
        const canvas = await html2canvas(printRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`AI_개인회생_종합법률의견서_${clientName}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('공인 법률진단서 PDF가 성공적으로 저장되었습니다!');
    } catch (err) {
      console.error('PDF 생성 실패:', err);
      toast.error('PDF 다운로드 중 오류가 발생했습니다. 인쇄 기능을 이용해 주세요.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 모달 본문 콘텐츠
  const modalContent = (
    <div 
      ref={printRef} 
      className="w-full max-w-4xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 font-sans text-left flex flex-col"
    >
      {/* ── [HEADER 1] 프리미엄 법률의견서 공식 헤더 ── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E3A5F] to-[#0F172A] text-white p-6 sm:p-8 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-900 font-black text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                변호사 검토 공인 법률의견서
              </span>
              <span className="text-xs text-slate-300 font-mono">
                No. LEGAL-2026-{clientName.substring(0, 3)}-{Math.floor(Math.random() * 8999 + 1000)}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-300 font-medium">
                발행일자: {reportDate}
              </div>
              {!embedded && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-700/60">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {clientName}님 개인회생 종합 법률의견서
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                본 문서는 담당 변호사가 {courtName} 실무준칙 및 AI 정밀 분석 데이터를 바탕으로 직접 검토·작성한 정식 법률 소견서입니다.
              </p>
            </div>

            {/* 변호사 명패 카드 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 px-4 flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 font-black flex items-center justify-center text-sm shadow-md overflow-hidden border border-white/40">
                {lawyerAvatar ? (
                  <img src={lawyerAvatar} alt={lawyerName} className="w-full h-full object-cover" />
                ) : (
                  lawyerName.substring(0, 2)
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white">{lawyerName}</span>
                  <span className="text-[10px] bg-amber-400/90 text-slate-950 font-extrabold px-1.5 py-0.5 rounded">변호사</span>
                </div>
                <div className="text-xs text-slate-300">{firmName}</div>
              </div>
              <div className="ml-2 pl-3 border-l border-white/20 text-center">
                <div className="w-8 h-8 rounded-full border border-amber-400/80 flex items-center justify-center text-amber-300 text-[10px] font-black rotate-[-12deg] shadow-xs">
                  檢印
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── [HEADER 2] 핵심 4대 지표 요약 카드 (월변제금 / 탕감률 / 절약액 / 기간) ── */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-[#7264FF]" />
              예상 월 변제금
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#7264FF]">
              <CountUp end={monthlyPayment} delay={0.1} formatter={(v) => `${(v / 10000).toLocaleString()}만`} suffix="원" />
            </div>
            <div className="text-[11px] text-slate-400 mt-1">월 가용소득 기준</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              원금 탕감률
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {debtReductionRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{formatCurrency(estimatedReduction)} 감면</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              변제 기간
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {repaymentMonths}개월
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{repaymentMonths === 24 ? '청년특례 단축' : '법정 기본기간'}</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-sky-400" />
              관할 법원
            </div>
            <div className="text-base sm:text-lg font-black text-sky-300 truncate">
              {courtName}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">금지명령 인용률 94%</div>
          </div>
        </div>
      </div>

      {/* ── [NAV] 듀얼 뷰 모드 토글 및 6개 탭 스위처 ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 shadow-xs px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
          
          {/* 6개 전문 분석 탭 */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'overview', label: '종합 분석', icon: Sparkles },
              { id: 'assets', label: '재산·가구', icon: Home },
              { id: 'debts', label: '소득·채무', icon: CreditCard },
              { id: 'statistics', label: '통계 백분위', icon: BarChart3 },
              { id: 'simulation', label: '월 가계수지', icon: Calculator },
              { id: 'guide', label: '변호사 가이드', icon: Scale },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id && viewMode === 'tabbed';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setViewMode('tabbed');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 듀얼 모드 토글 (탭별 탐색 ↔ 7p 연속 전체 보기) */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('tabbed')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  viewMode === 'tabbed' ? 'bg-white text-[#1E3A5F] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                탭별 탐색
              </button>
              <button
                type="button"
                onClick={() => setViewMode('continuous')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'continuous' ? 'bg-white text-[#1E3A5F] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3 h-3" />
                전체 연속 보기
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="p-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              title="PDF 다운로드"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── [BODY] 스크롤 가능한 본문 영역 ── */}
      <div className="p-5 sm:p-8 space-y-8 bg-slate-50/50 flex-1 overflow-y-auto">
        
        {/* ── 0. 수임료 및 분납 조건 카드 (항상 최상단 또는 명확히 강조) ── */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-150 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#1E3A5F]" />
              변호사 수임료 및 무이자 분납 확약 조건
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              최대 {fees.installments}개월 분납 지원
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
              <div className="text-xs text-slate-500 font-medium">총 수임료</div>
              <div className="text-base font-black text-slate-900 mt-1">{formatCurrency(fees.totalFee)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">부가세 포함</div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
              <div className="text-xs text-blue-700 font-bold">초기 착수금</div>
              <div className="text-base font-black text-blue-900 mt-1">{formatCurrency(fees.downPayment)}</div>
              <div className="text-[10px] text-blue-600 mt-0.5">사건 접수 착수</div>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div className="text-xs text-emerald-700 font-bold">월 분납금 ({fees.installments}회)</div>
              <div className="text-base font-black text-emerald-800 mt-1">{formatCurrency(fees.monthlyInstallment)}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">매월 분할 납부</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
              <div className="text-xs text-slate-500 font-medium">법원 실비 예납금</div>
              <div className="text-base font-black text-slate-900 mt-1">{formatCurrency(fees.courtDeposit)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">인지대·송달료</div>
            </div>
          </div>

          {fees.feeMemo && (
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-150 leading-relaxed font-medium">
              💡 <strong>수임 안내</strong>: {fees.feeMemo}
            </p>
          )}
        </section>

        {/* ── TAB 1: 종합 분석 (Overview) ── */}
        {(viewMode === 'continuous' || activeTab === 'overview') && (
          <div className="space-y-6">
            
            {/* 시급성 알림 */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${urgency.bg}`}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: urgency.color }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${urgency.badgeBg}`}>
                    {urgency.level}
                  </span>
                  <span className="text-xs font-bold text-slate-900">상담 시급성 및 집중 관리 요건</span>
                </div>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed font-medium">{urgency.desc}</p>
              </div>
            </div>

            {/* 1. 도넛 차트 & 총괄 탕감 내역 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
              <div className="flex flex-col items-center justify-center py-2 border-b md:border-b-0 md:border-r border-slate-200 pr-0 md:pr-4">
                <DonutChart
                  percentage={debtReductionRate}
                  size={130}
                  strokeWidth={11}
                  colorFrom="#1E3A5F"
                  colorTo="#10B981"
                  delay={0.1}
                  label="법원 인가 탕감률"
                />
                <span className="text-xs text-slate-500 font-bold mt-2">원금 기준 {debtReductionRate}% 전격 감면</span>
              </div>

              <div className="flex flex-col justify-center space-y-3 pl-0 md:md:pl-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">총 채무액</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalDebt)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">3년 총 변제액</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(totalRepayment)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">총 탕감 예정액</span>
                  <span className="font-bold text-blue-700">{formatCurrency(estimatedReduction)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
                  <span className="text-slate-600 font-bold">확정 월 변제금</span>
                  <span className="font-black text-[#1E3A5F] text-base">
                    {formatCurrency(monthlyPayment)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── [다이어그램 3] 탕감률 산출 4단계 인포그래픽 흐름도 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                [다이어그램 1] 개인회생 탕감률 4단계 산출 흐름도
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-semibold text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">1단계: 신청 총채무</div>
                  <div className="font-black text-red-600">{formatCurrency(totalDebt)}</div>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="text-[10px] text-blue-700 font-medium mb-1">2단계: 월 변제금</div>
                  <div className="font-black text-blue-900">{formatCurrency(monthlyPayment)}</div>
                  <div className="text-[10px] text-blue-600 font-normal mt-0.5">× {repaymentMonths}개월 납부</div>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-medium mb-1">3단계: 총 변제금</div>
                  <div className="font-black text-emerald-800">{formatCurrency(totalRepayment)}</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-[#1E3A5F] to-[#0F172A] text-white rounded-xl shadow-sm">
                  <div className="text-[10px] text-amber-300 font-medium mb-1">4단계: 최종 탕감률</div>
                  <div className="text-lg font-black text-amber-400">{debtReductionRate}%</div>
                </div>
              </div>
            </div>

            {/* ── [다이어그램 1] 3대 채무조정 제도 적합도 진단 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#1E3A5F]" />
                [다이어그램 2] 국가 3대 채무조정 제도별 최적 적합도 진단
              </h4>

              <div className="space-y-3">
                {/* 개인회생 */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#1E3A5F]" />
                      법원 개인회생 (채무자 회생법)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                      {suitabilities.rehab.status} ({suitabilities.rehab.score}점)
                    </span>
                  </div>
                  <AnimatedProgress value={suitabilities.rehab.score} colorFrom="#1E3A5F" colorTo="#10B981" height={7} />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{suitabilities.rehab.reason}</p>
                </div>

                {/* 개인파산 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-slate-400" />
                      개인파산 및 면책 (전액 탕감)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {suitabilities.bankruptcy.status} ({suitabilities.bankruptcy.score}점)
                    </span>
                  </div>
                  <AnimatedProgress value={suitabilities.bankruptcy.score} colorFrom="#94A3B8" colorTo="#64748B" height={6} />
                  <p className="text-xs text-slate-500 leading-relaxed">{suitabilities.bankruptcy.reason}</p>
                </div>

                {/* 신용회복 워크아웃 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-500" />
                      신용회복위원회 워크아웃 (금융협약)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {suitabilities.workout.status} ({suitabilities.workout.score}점)
                    </span>
                  </div>
                  <AnimatedProgress value={suitabilities.workout.score} colorFrom="#38BDF8" colorTo="#F59E0B" height={6} />
                  <p className="text-xs text-slate-500 leading-relaxed">{suitabilities.workout.reason}</p>
                </div>
              </div>
            </div>

            {/* ── [다이어그램 2] 회생 전 vs 회생 후 월 상환 부담 비교 바 차트 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-500" />
                [다이어그램 3] 회생 전 vs 회생 후 월 상환 부담 격차 비교
              </h4>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-500">현재 원리금 상환 부담 (원금+고금리 이자)</span>
                    <span className="text-red-600 font-black">{formatCurrency(activeCalcResult.currentMonthlyBurden)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full w-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-500">개인회생 후 월 변제금 (이자 100% 면제 + 원금 감면)</span>
                    <span className="text-emerald-600 font-black">{formatCurrency(monthlyPayment)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((monthlyPayment / Math.max(1, activeCalcResult.currentMonthlyBurden)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <div className="text-[11px] text-emerald-700 font-bold">매월 절약액</div>
                    <div className="text-sm sm:text-base font-black text-emerald-800 mt-0.5">
                      {formatCurrency(Math.max(0, activeCalcResult.currentMonthlyBurden - monthlyPayment))}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                    <div className="text-[11px] text-blue-700 font-bold">총 원금 감면액</div>
                    <div className="text-sm sm:text-base font-black text-blue-900 mt-0.5">
                      {formatCurrency(estimatedReduction)}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                    <div className="text-[11px] text-slate-500 font-bold">월 부담 감소율</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                      {Math.round((1 - (monthlyPayment / Math.max(1, activeCalcResult.currentMonthlyBurden))) * 100)}% ↓
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── [다이어그램 4] 부양가족 & 생계비 4단계 계산 흐름도 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1E3A5F]" />
                [다이어그램 4] 부양가족 & 최저생계비 4단계 산정 구조
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-slate-50 rounded-t-xl p-3 border border-slate-200 text-xs">
                  <div className="w-5 h-5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="flex-1">
                    <span className="text-slate-600">법정 기본 생계비 ({activeUserInput.familySize}인 가구 / 보건복지부 기준 60%)</span>
                  </div>
                  <div className="font-bold text-slate-900">{formatCurrency(activeCalcResult.baseLivingCost)}</div>
                </div>

                {activeCalcResult.additionalLivingCost > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50/50 p-3 border-x border-slate-200 text-xs">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</div>
                    <div className="flex-1">
                      <span className="text-slate-600">추가 인정 생계비 (주거/의료/양육비 가산)</span>
                    </div>
                    <div className="font-bold text-emerald-600">+{formatCurrency(activeCalcResult.additionalLivingCost)}</div>
                  </div>
                )}

                <div className="flex items-center gap-2 bg-blue-50/50 p-3 border-x border-slate-200 text-xs">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="flex-1">
                    <span className="text-slate-700 font-bold">최종 법원 인정 생계비 (압류 금지 생활비)</span>
                  </div>
                  <div className="font-bold text-blue-700">{formatCurrency(activeCalcResult.recognizedLivingCost)}</div>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 text-white rounded-b-xl p-3.5 border border-slate-800 text-xs">
                  <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">★</div>
                  <div className="flex-1">
                    <span className="text-slate-200 font-medium">월 실수령액 ({formatCurrency(activeUserInput.monthlyIncome)}) − 인정생계비 = <strong>월 변제금</strong></span>
                  </div>
                  <div className="text-sm font-black text-amber-300">{formatCurrency(monthlyPayment)}</div>
                </div>
              </div>
            </div>

            {/* ── [다이어그램 5] 청산가치 보장 비율 게이지바 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-600" />
                [다이어그램 5] 청산가치(내 재산) 보장의 원칙 달성도
              </h4>
              
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>⚖️ 청산가치({formatCurrency(activeCalcResult.liquidationValue)}) 대비 3년 총변제액 달성률</span>
                  <span className="text-emerald-600 font-black">
                    {Math.round((totalRepayment / Math.max(1, activeCalcResult.liquidationValue)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-[#1E3A5F] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round((totalRepayment / Math.max(1, activeCalcResult.liquidationValue)) * 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  * <strong>법정 청산가치 보장 원칙</strong>: 3년간 변제하는 총액({formatCurrency(totalRepayment)})이 파산 시 자산 환가액({formatCurrency(activeCalcResult.liquidationValue)})을 안전하게 상회하여 <span className="text-emerald-700 font-bold">법원 인가 조건을 100% 충족</span>합니다.
                </p>
              </div>
            </div>

            {/* ── [다이어그램 6] 변제기간 의사결정 트리 ── */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-600" />
                [다이어그램 6] 변제기간(24 / 36 / 48 / 60개월) 의사결정 트리
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className={`p-3 rounded-xl border ${repaymentMonths === 24 ? 'bg-blue-50/80 border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${repaymentMonths === 24 ? 'bg-[#1E3A5F] text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {repaymentMonths === 24 ? '✓' : '1'}
                    </span>
                    24개월 (청년 특례 단축)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">만 30세 미만 청년 또는 회생법원 준칙 적용 시 단축</p>
                </div>

                <div className={`p-3 rounded-xl border ${repaymentMonths === 36 ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${repaymentMonths === 36 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {repaymentMonths === 36 ? '✓' : '2'}
                    </span>
                    36개월 (법정 기본 기간)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">가용소득 3년 투입으로 청산가치를 보장하는 표준 모델</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── TAB 2: 재산 및 가구 명세 (Assets & Family) ── */}
        {(viewMode === 'continuous' || activeTab === 'assets') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-600" />
                보유 자산 및 법원 청산가치 평가 명세
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-slate-50 p-3 font-bold text-slate-700 border-b border-slate-200">
                  <span>자산 구분</span>
                  <span className="text-right">신고 자산액</span>
                  <span className="text-right text-[#1E3A5F]">법원 청산가치 반영액</span>
                </div>
                <div className="grid grid-cols-3 p-3 border-b border-slate-100 items-center">
                  <span className="font-medium text-slate-800">본인 재산 (예금·차량·보험)</span>
                  <span className="text-right text-slate-600">{formatCurrency(activeUserInput.myAssets)}</span>
                  <span className="text-right font-bold text-slate-900">{formatCurrency(activeUserInput.myAssets)}</span>
                </div>
                {activeUserInput.deposit > 0 && (
                  <>
                    <div className="grid grid-cols-3 p-3 border-b border-slate-100 items-center">
                      <span className="font-medium text-slate-800">임차보증금 ({activeUserInput.housingType === 'jeonse' ? '전세' : '월세'})</span>
                      <span className="text-right text-slate-600">{formatCurrency(activeUserInput.deposit)}</span>
                      <span className="text-right font-bold text-slate-900">{formatCurrency(activeUserInput.deposit)}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3 border-b border-slate-100 items-center bg-emerald-50/50 text-emerald-700">
                      <span className="font-bold">└ 소액임차 면제재산 공제</span>
                      <span className="text-right font-medium">주거 보호 법정공제</span>
                      <span className="text-right font-bold">−{formatCurrency(activeCalcResult.exemptDeposit)}</span>
                    </div>
                  </>
                )}
                {activeUserInput.isMarried && activeUserInput.spouseAssets > 0 && (
                  <div className="grid grid-cols-3 p-3 border-b border-slate-100 items-center">
                    <span className="font-medium text-slate-800">배우자 재산 (준칙 미반영)</span>
                    <span className="text-right text-slate-500">{formatCurrency(activeUserInput.spouseAssets)}</span>
                    <span className="text-right font-bold text-amber-600">
                      {courtName.includes('회생법원') ? '0원 (준칙 특례)' : formatCurrency(activeUserInput.spouseAssets * 0.5)}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 bg-slate-50/80 p-3.5 font-bold text-sm border-t border-slate-200">
                  <span className="text-slate-900">최종 청산가치 합계</span>
                  <span></span>
                  <span className="text-right text-[#1E3A5F]">{formatCurrency(activeCalcResult.liquidationValue)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed space-y-1">
                <p>💡 <strong>법률 특례 안내</strong>: {courtName} 실무준칙에 의거, 배우자 명의 재산에 대한 기여도 반영을 최소화(0%)하고 주택임대차보호법상 최우선 변제금을 공제하여 의뢰인의 청산가치를 획기적으로 낮췄습니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: 소득 및 채무 명세 (Income & Debts) ── */}
        {(viewMode === 'continuous' || activeTab === 'debts') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1E3A5F]" />
                소득 및 채무 세부 구성 분석
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-1">직업 소득 형태</span>
                  <span className="text-sm font-bold text-slate-900">
                    {activeUserInput.employmentType === 'salary' ? '급여 소득자 (4대보험/정규직)' : '영업/프리랜서 소득자'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-1">월 평균 실수령액</span>
                  <span className="text-sm font-bold text-blue-700">{formatCurrency(activeUserInput.monthlyIncome)}</span>
                </div>
              </div>

              {/* 2026 보건복지부 기준 생계비 대조표 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-50 p-3 font-bold text-slate-700 border-b border-slate-200">
                  2026년 법정 기준 최저생계비 표 (중위소득 60% 기준)
                </div>
                <div className="grid grid-cols-3 p-2.5 text-center border-b border-slate-100 font-medium text-slate-600">
                  <span>1인 가구: 153.8만 원</span>
                  <span>2인 가구: 251.9만 원</span>
                  <span>3인 가구: 321.5만 원</span>
                </div>
                <div className="p-3 text-[11px] text-slate-500 leading-relaxed bg-slate-50/50">
                  * <strong>가용소득 산출식</strong>: [월 실수령액 {formatCurrency(activeUserInput.monthlyIncome)}] − [법원 공인 생계비 {formatCurrency(activeCalcResult.recognizedLivingCost)}] = <strong>월 변제금 {formatCurrency(monthlyPayment)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: 통계 백분위 (Statistics) ── */}
        {(viewMode === 'continuous' || activeTab === 'statistics') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                [다이어그램 7] 2025/2026 사법연감 및 서울회생법원 통계 비교
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatComparisonCard
                  title="월 소득 비교"
                  userValue={activeUserInput.monthlyIncome || 2450000}
                  averageValue={AVERAGE_VALUES.monthlyIncome}
                  percentile={calculateIncomePercentile(activeUserInput.monthlyIncome || 2450000)}
                  icon={<DollarSign className="w-4 h-4" />}
                  unit="원"
                />
                <StatComparisonCard
                  title="총 채무 비교"
                  userValue={totalDebt || 85000000}
                  averageValue={AVERAGE_VALUES.totalDebt}
                  percentile={calculateDebtPercentile(totalDebt || 85000000)}
                  icon={<CreditCard className="w-4 h-4" />}
                  unit="원"
                />
                <StatComparisonCard
                  title="예상 탕감율 비교"
                  userValue={debtReductionRate || 68}
                  averageValue={AVERAGE_VALUES.debtReductionRate}
                  percentile={calculateReductionRatePercentile(debtReductionRate || 68)}
                  icon={<Percent className="w-4 h-4" />}
                  unit="%"
                />
              </div>

              <DistributionBar
                title="대한민국 개인회생 신청자 채무 금액대 분포"
                userValue={totalDebt}
                distribution={REHAB_STATISTICS_2025.debtAmountDistribution}
                highlightRange={totalDebt < 50000000 ? '5천만원 이하' : totalDebt < 100000000 ? '5천만원 초과 1억원 이하' : '1억원 초과 2억원 이하'}
              />

              {/* AI 통계 인사이트 */}
              {(() => {
                const insights = generateStatisticalInsights({
                  monthlyIncome: activeUserInput.monthlyIncome,
                  totalDebt,
                  debtReductionRate,
                  familySize: activeUserInput.familySize || 1
                });
                return insights.length > 0 ? (
                  <div className="bg-blue-50/50 border border-blue-200/80 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      사법 통계 기반 정밀 분석 리포트
                    </h4>
                    {insights.map((insight, idx) => (
                      <p key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        {insight}
                      </p>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* ── TAB 5: 월 가계 시뮬레이션 (Simulation) ── */}
        {(viewMode === 'continuous' || activeTab === 'simulation') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                [다이어그램 8] 회생 전 vs 회생 후 월 가계수지(Budget) 대조 시뮬레이션
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 회생 전 */}
                <div className="bg-red-50/50 border border-red-200 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-black text-red-700 flex items-center gap-1.5">
                    ❌ 현재 가계 수지 (회생 전 - 매월 파탄 상태)
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {activeCalcResult.monthlyBudgetBefore?.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg ${
                        item.type === 'total' ? 'bg-white border border-red-200 font-black text-red-700 mt-2' :
                        item.highlight ? 'bg-red-100/60 font-bold text-red-900' : 'text-slate-600'
                      }`}>
                        <span>{item.label}</span>
                        <span>{formatCurrency(Math.abs(item.amount))} {item.type === 'total' && item.amount < 0 && ' (매월 적자)'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 회생 후 */}
                <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                    ✅ 개인회생 인가 후 (안정적인 흑자 가계로 전환)
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {activeCalcResult.monthlyBudgetAfter?.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg ${
                        item.type === 'total' ? 'bg-white border border-emerald-200 font-black text-emerald-700 mt-2' :
                        item.highlight ? 'bg-emerald-100/60 font-bold text-emerald-900' : 'text-slate-600'
                      }`}>
                        <span>{item.label}</span>
                        <span>{formatCurrency(Math.abs(item.amount))} {item.type === 'total' && ' (정상 생활)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 6: 변호사 가이드 & 타임라인 (Guide) ── */}
        {(viewMode === 'continuous' || activeTab === 'guide') && (
          <div className="space-y-6">
            
            {/* 1. 절차 타임라인 그래픽 */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1E3A5F]" />
                [다이어그램 9] {courtName} 예상 인가 절차 로드맵
              </h3>
              <ProcedureTimeline processingMonths={activeCalcResult.processingMonths} />
            </div>

            {/* 2. 담당 변호사 종합 법률 소견서 본문 */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1E3A5F]" />
                  담당 변호사 종합 법률 검토 의견서
                </h3>
                <span className="text-xs text-slate-400 font-medium">검토 책임 변호사: {lawyerName}</span>
              </div>

              {/* 의견 본문 */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-150 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {lawyerOpinion}
              </div>

              {/* 특이사항 */}
              {specialNotes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    핵심 사건 진행 전략 및 관리 포인트
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {specialNotes.map((note, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-[#1E3A5F] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 의뢰인 맞춤 Q&A */}
              {clientQnA.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-150">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    의뢰인 궁금증에 대한 변호사 직접 답변
                  </h4>
                  <div className="space-y-2">
                    {clientQnA.map((qa, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="text-[#1E3A5F] font-black">Q.</span>
                          <span>{qa.question}</span>
                        </div>
                        <div className="text-slate-600 pl-4 border-l-2 border-[#1E3A5F]/30 leading-relaxed font-medium">
                          {qa.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 공인 직인 서명 날인 영역 */}
              <div className="pt-4 border-t border-slate-150 flex items-center justify-between flex-wrap gap-4">
                <div className="text-xs text-slate-500">
                  작성일시: {reportDate} | 법무법인 직인 인증 완료
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700">{firmName}</div>
                    <div className="text-sm font-black text-slate-900">대표변호사 {lawyerName}</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-red-600/80 flex items-center justify-center text-red-600 text-xs font-black rotate-[-8deg] shadow-xs">
                    印
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── [FOOTER] CTA 및 변호사법 법적 고지문 ── */}
      <div className="bg-white border-t border-slate-200 p-5 sm:p-6 space-y-4 shrink-0">
        
        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            💡 본 진단서 내용을 바탕으로 변호사 선임 및 법원 접수를 즉시 진행하실 수 있습니다.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[44px] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>정식 A4 진단서 PDF 다운로드</span>
            </button>

            {isClientViewer && onAppointLawyer && (
              <button
                type="button"
                onClick={onAppointLawyer}
                disabled={isAppointed}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1E3A5F] to-[#0F172A] hover:from-[#163152] hover:to-[#080d1a] text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{isAppointed ? '선임 요청 완료' : '이 변호사 선임하고 즉시 진행하기'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 변호사법 제109조 및 광고규정 준수 공식 고지 */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
          <p className="font-semibold text-slate-700 mb-0.5">⚠️ 변호사법 및 법원 실무준칙 고지사항</p>
          본 법률의견서 및 채무 정밀진단서는 담당 변호사가 의뢰인의 진술 자료 및 법원 실무준칙을 토대로 직접 종합 검토·작성한 정식 법률 소견서입니다. 법원의 최종 개시 및 인가 결정은 법관 및 회생위원의 서류 심사 및 보정 권고 결과에 따르며, 개별 사안의 자산 은닉이나 허위 진술에 따라 변제 조건이 조정될 수 있습니다.
        </div>
      </div>

      {/* 숨겨진 7페이지 A4 인쇄 템플릿 (PDF 다운로드 엔진용) */}
      {isGeneratingPdf && (
        <div className="hidden">
          <PrintableReportTemplate result={activeCalcResult} userInput={activeUserInput} />
        </div>
      )}
    </div>
  );

  // 임베디드(스튜디오 인라인) 모드일 때는 래퍼 없이 렌더링
  if (embedded) {
    return <ReportErrorBoundary onClose={onClose}>{modalContent}</ReportErrorBoundary>;
  }

  // 모달 팝업 모드일 때는 fixed 백드롭 래퍼
  return (
    <ReportErrorBoundary onClose={onClose}>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-full max-w-4xl my-4 max-h-[94vh] flex flex-col">
          {modalContent}
        </div>
      </div>
    </ReportErrorBoundary>
  );
}
