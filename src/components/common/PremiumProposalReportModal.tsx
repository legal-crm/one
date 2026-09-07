import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Download, CheckCircle2, ShieldCheck, Scale, Sparkles, 
  Landmark, TrendingDown, Clock, AlertTriangle, MessageSquare, 
  DollarSign, FileText, ChevronRight, User, Printer, ArrowRight,
  Shield, Check, Phone, Building2, HelpCircle, Layers, Eye,
  BarChart3, Users, Home, CreditCard, Calculator, Percent, Zap
} from 'lucide-react';
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
    additionalCostsNotice?: string;
    isInstallmentAvailable: boolean;
  };
  lawyerComment?: string;
  proposalId?: string;
  createdAt?: string;
  expiresAt?: string;
  clientInput?: RehabUserInput;
  calculationResult?: RehabCalculationResult;
  specialNotes?: string[];
  recommendedStrategy?: string;
}

interface PremiumProposalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: PremiumReportData;
  reportId?: string;
  onAcceptProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onContactLawyer?: (lawyerInfo: any) => void;
}

export const PremiumProposalReportModal: React.FC<PremiumProposalReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  reportId = `RPT-${Date.now()}`,
  onAcceptProposal,
  onRejectProposal,
  onContactLawyer
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'roadmap'>('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const proposal = reportData?.diagnosis || ({} as any);
  const lawyer = reportData?.lawyerInfo || {
    name: '김회생 변호사',
    firmName: '법무법인 케어',
    avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200',
    phone: '02-1234-5678'
  };

  // Helper to normalize values in 원 (KRW).
  // If a value is < 10,000 and > 0, it was provided in 만원 (e.g. 40 -> 400,000, 160 -> 1,600,000).
  const normalizeToWon = (val: number | undefined | null): number => {
    if (!val || isNaN(val)) return 0;
    return val < 10000 ? Math.round(val * 10000) : Math.round(val);
  };

  const calculationResult = reportData?.calculationResult;
  const clientInput = reportData?.clientInput;

  const monthlyPayment = normalizeToWon(proposal.monthlyPayment || calculationResult?.monthlyPayment || 0);
  const repaymentMonths = proposal.repaymentMonths || calculationResult?.repaymentMonths || 36;
  const totalRepaymentCalculated = monthlyPayment * repaymentMonths;
  const totalDebt = normalizeToWon(proposal.totalDebt || calculationResult?.totalDebt || 0);
  const estimatedReduction = Math.max(0, totalDebt - totalRepaymentCalculated);
  const debtReductionRate = totalDebt > 0 
    ? Math.min(100, Math.max(0, Math.round((estimatedReduction / totalDebt) * 100))) 
    : (proposal.debtReductionRate || 0);

  const fees = reportData?.fees || {
    totalFee: 0,
    downPayment: 0,
    installments: 0,
    monthlyInstallment: 0,
    courtDeposit: 0,
    isInstallmentAvailable: true
  };

  const totalFeeWon = normalizeToWon(fees.totalFee);
  const downPaymentWon = normalizeToWon(fees.downPayment);
  const monthlyInstallmentWon = normalizeToWon(fees.monthlyInstallment);
  const courtDepositWon = normalizeToWon(fees.courtDeposit);

  // Financial calculations
  const activeCalcResult: RehabCalculationResult = useMemo(() => {
    if (calculationResult && calculationResult.totalDebt) {
      return calculationResult;
    }
    const debtWon = totalDebt;
    const paymentWon = monthlyPayment;
    const months = repaymentMonths;
    const reductionWon = estimatedReduction;
    const rate = debtReductionRate;
    const currentBurden = clientInput 
      ? calculateCurrentMonthlyBurden(clientInput.debtAmount, clientInput.monthlyIncome)
      : Math.round(debtWon * 0.04);

    return {
      monthlyPayment: paymentWon,
      totalPayment: paymentWon * months,
      repaymentMonths: months,
      reductionRate: rate,
      reductionAmount: reductionWon,
      totalDebt: debtWon,
      currentMonthlyBurden: currentBurden,
      court: proposal.court || '서울회생법원',
      status: (proposal.status as any) || 'safe',
      reasons: proposal.statusReason ? [proposal.statusReason] : [],
      eligibleProcedures: ['individual_rehabilitation'],
      monthlyIncome: normalizeToWon(clientInput?.monthlyIncome) || 2800000,
      recognizedLivingCost: normalizeToWon(clientInput?.monthlyIncome ? Math.round(clientInput.monthlyIncome * 0.6) : 1500000),
      dependentsCount: clientInput?.dependentsCount || 1,
      liquidationValue: 0
    };
  }, [calculationResult, totalDebt, monthlyPayment, repaymentMonths, estimatedReduction, debtReductionRate, clientInput, proposal]);

  // PDF Export
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('고해상도 진단서를 PDF로 변환하고 있습니다...');

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileName = `회생진단서_${reportData.clientName || '의뢰인'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      toast.success('진단서 PDF가 다운로드되었습니다.', { id: toastId });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const printableData = {
    client: {
      name: reportData.clientName || '의뢰인',
      monthlyIncome: activeCalcResult.monthlyIncome,
      dependentsCount: activeCalcResult.dependentsCount || 1,
      totalDebt: totalDebt,
      monthlyBurden: activeCalcResult.currentMonthlyBurden,
      totalAssets: clientInput?.totalAssets ? normalizeToWon(clientInput.totalAssets) : 0,
    },
    lawyer: {
      name: lawyer.name,
      firmName: lawyer.firmName || '법률사무소',
      phone: lawyer.phone || '02-1234-5678',
      address: '서울특별시 서초구 서초대로 250',
    },
    diagnosis: {
      status: proposal.status || 'safe',
      court: proposal.court || '서울회생법원',
      monthlyPayment: monthlyPayment,
      repaymentMonths: repaymentMonths,
      totalRepayment: totalRepaymentCalculated,
      reductionAmount: estimatedReduction,
      reductionRate: debtReductionRate,
      livingCost: activeCalcResult.recognizedLivingCost,
      opinion: reportData.lawyerComment || '의뢰인의 소득과 부양가족 수를 고려하여 산정된 최적의 변제계획입니다. 개시결정까지 신속하고 체계적인 법률 조력을 약속드립니다.',
      notes: reportData.specialNotes || [],
    },
    fees: {
      totalFee: totalFeeWon,
      downPayment: downPaymentWon,
      installments: fees.installments || 0,
      monthlyInstallment: monthlyInstallmentWon,
      courtDeposit: courtDepositWon,
      additionalNotice: fees.additionalCostsNotice || '인지대, 송달료, 부채증명발급 등 법원 공과금 실비 포함 여부는 최종 수임계약 시 확인됩니다.',
    },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      {/* 
        OFF-SCREEN PRINTABLE CONTAINER FOR PDF GENERATION
        Crucial: Kept off-screen with -99999px position to prevent visual bleed behind modal.
      */}
      <div 
        id="pdf-render-container" 
        ref={printRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-99999px',
          left: '-99999px',
          width: '794px',
          zIndex: -9999,
          pointerEvents: 'none',
          opacity: 1
        }}
      >
        <PrintableReportTemplate
          reportId={reportId}
          data={printableData}
        />
      </div>

      {/* Main Modal Container */}
      <div 
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
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
                <img 
                  src={lawyer.avatar || 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200'} 
                  alt={lawyer.name} 
                  className="w-13 h-13 rounded-full object-cover ring-2 ring-emerald-500/50 shadow-md"
                />
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full ring-2 ring-slate-950">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    전담 변호사 맞춤 진단서
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    가명 안심 보호 중
                  </span>
                </div>
                <h2 id="report-modal-title" className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                  <span>{lawyer.name}</span>
                  <span className="text-sm font-normal text-slate-400">· {lawyer.firmName}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  수신: <span className="text-slate-200 font-semibold">{reportData.clientName || '의뢰인'}</span> 님 귀하 | 관할: <span className="text-slate-200 font-semibold">{proposal.court || '서울회생법원'}</span>
                </p>
              </div>
            </div>

            {/* Quick KPI Bar & Action Buttons */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <button
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition border border-slate-700 active:scale-[0.98] disabled:opacity-50"
                title="진단서 PDF 저장"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{isGeneratingPdf ? 'PDF 생성 중...' : 'PDF 저장'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-[0.98]"
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
              <span className="text-sm sm:text-base font-bold text-slate-100 mt-0.5 block">
                {formatCurrency(totalDebt)}
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">예상 월 변제금</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 mt-0.5 block">
                {formatCurrency(monthlyPayment)}
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">예상 원금 탕감률</span>
              <span className="text-sm sm:text-base font-black text-blue-400 mt-0.5 block">
                {debtReductionRate}%
              </span>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">총 탕감 예상액</span>
              <span className="text-sm sm:text-base font-black text-amber-400 mt-0.5 block">
                {formatCurrency(estimatedReduction)}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Executive Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-8 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>핵심 진단 & 소견</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'financial'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>소득·재산 & 가계수지</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'roadmap'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>수임료 & 사건 로드맵</span>
          </button>
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 space-y-6">

          {/* TAB 1: OVERVIEW & LAWYER OPINION */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Primary Before vs After Visual Comparison Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">개인회생 신청 전후 재무 변화</h3>
                      <p className="text-xs text-slate-500">법원 인가 시 법적으로 보장받는 채무 조정 결과입니다.</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    원금 {debtReductionRate}% 감면
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before: Current Debt Burden */}
                  <div className="p-5 rounded-2xl bg-red-50/60 border border-red-200 relative overflow-hidden">
                    <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      신청 전 현재 상태
                    </div>
                    <div className="space-y-2.5 mt-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">총 원금 채무</span>
                        <span className="font-bold text-slate-900">{formatCurrency(totalDebt)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">이자 감면</span>
                        <span className="font-bold text-red-600">0% (연체이자 누적)</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">예상 월 상환 부담</span>
                        <span className="font-bold text-red-700">{formatCurrency(activeCalcResult.currentMonthlyBurden)}</span>
                      </div>
                      <div className="pt-2 border-t border-red-200/80 text-xs text-red-600 font-medium">
                        채권 추심, 압류 및 독촉 전화 노출 위험
                      </div>
                    </div>
                  </div>

                  {/* After: Rehabilitation Plan */}
                  <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-300 relative overflow-hidden shadow-sm">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      개인회생 인가 후 (법적 보호)
                    </div>
                    <div className="space-y-2.5 mt-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">월 변제금 ({repaymentMonths}개월)</span>
                        <span className="text-base font-black text-emerald-700">{formatCurrency(monthlyPayment)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">이자 감면율</span>
                        <span className="font-bold text-emerald-700">100% 전액 면제</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">총 변제 원금</span>
                        <span className="font-bold text-slate-900">{formatCurrency(totalRepaymentCalculated)}</span>
                      </div>
                      <div className="pt-2 border-t border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                        <span>총 탕감 금액 (면책)</span>
                        <span className="text-sm font-black text-emerald-700">{formatCurrency(estimatedReduction)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lawyer's Diagnosis Opinion */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 shrink-0">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {lawyer.name} 변호사의 전문 종합 소견
                      </h3>
                      <span className="text-xs font-medium text-slate-500">
                        진단 기준 법원: {proposal.court || '서울회생법원'}
                      </span>
                    </div>

                    <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                      {reportData.lawyerComment || (
                        '의뢰인님의 현재 소득 대비 부양가족 생계비와 채무 구조를 면밀히 분석한 결과, 개인회생 개시 요건을 충분히 갖추고 계십니다. ' +
                        '신청서 접수 즉시 금지·중지명령을 통해 빚 독촉과 압류를 원천 차단하고, 최적화된 변제계획안으로 인가 결정을 이끌어내겠습니다.'
                      )}
                    </div>

                    {reportData.specialNotes && reportData.specialNotes.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-bold text-slate-700">📌 사건 진행 시 핵심 주의사항</div>
                        <ul className="space-y-1.5">
                          {reportData.specialNotes.map((note, idx) => (
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

              {/* Legal Guarantees & Safe Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">금지명령 신속 신청</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">접수 후 3~7일 이내 채권 추심 및 가압류 전면 금지</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">직장 및 가족 비공개</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">회사 통보 없이 안전하고 은밀하게 서류 진행</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">기각 시 100% 환불 보증</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">귀책 없는 기각 시 수임료 전액 환불 특약 적용</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FINANCIAL & LIVING EXPENSES */}
          {activeTab === 'financial' && (
            <div className="space-y-6">

              {/* Income vs Living Cost Breakdown */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">소득 및 인정 생계비 구조</h3>
                    <p className="text-xs text-slate-500">월 소득에서 법원 기준 인정 생계비를 제외한 금액이 월 변제금으로 산정됩니다.</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    부양가족 {activeCalcResult.dependentsCount || 1}인 기준
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">월 평균 실수령 소득</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {formatCurrency(activeCalcResult.monthlyIncome)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">급여/사업 소득 공제 후</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">법원 인정 최저생계비</div>
                    <div className="text-lg font-black text-blue-600 mt-1">
                      {formatCurrency(activeCalcResult.recognizedLivingCost)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">기준 중위소득 60% 반영</div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <div className="text-xs text-emerald-700 font-medium">확정 월 가용소득 (변제금)</div>
                    <div className="text-lg font-black text-emerald-800 mt-1">
                      {formatCurrency(monthlyPayment)}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">매월 법원에 납입하는 금액</div>
                  </div>
                </div>

                {/* Formula Bar */}
                <div className="mt-5 p-4 rounded-xl bg-slate-100 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                  <span>📐 <strong>산정 공식</strong>: 월 소득({formatCurrency(activeCalcResult.monthlyIncome)}) - 최저생계비({formatCurrency(activeCalcResult.recognizedLivingCost)}) = <strong>월 변제금({formatCurrency(monthlyPayment)})</strong></span>
                  <span className="text-slate-400">※ 부양가족 추가 인정 시 월 변제금이 더 낮아질 수 있습니다.</span>
                </div>
              </div>

              {/* Monthly Repayment Burden Relief Meter */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">월 상환 부담 비교 체감치</h3>
                <p className="text-xs text-slate-500 mb-5">현재 부담 중인 매월 원리금 상환액 대비 회생 인가 후 절감 효과입니다.</p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-500">현재 예상 원리금 상환 부담</span>
                      <span className="text-red-600 font-bold">{formatCurrency(activeCalcResult.currentMonthlyBurden)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full w-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-500">개인회생 후 월 변제금 (이자 100% 면제)</span>
                      <span className="text-emerald-600 font-black">{formatCurrency(monthlyPayment)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((monthlyPayment / Math.max(1, activeCalcResult.currentMonthlyBurden)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                      <div className="text-[11px] text-emerald-700 font-bold">매월 가계 절약액</div>
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
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-purple-700 font-bold">이자 상환액</div>
                      <div className="text-sm sm:text-base font-black text-purple-900 mt-0.5">
                        0원 (완전 면제)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: LEGAL FEES & CASE ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">

              {/* Transparent Legal Fees Structure Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">투명한 수임료 및 분납 조건 안내</h3>
                    <p className="text-xs text-slate-500">숨겨진 추가 비용 없이 계약서에 명시되는 확정 수임료 체계입니다.</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    최대 {fees.installments || 4}개월 분납 가능
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">총 변호사 수임료</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {formatCurrency(totalFeeWon)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">사건 종결까지 전체 변호 비용</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">초기 착수금 (계약 시)</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {formatCurrency(downPaymentWon)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">금지명령 즉시 접수 착수</div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-xs text-emerald-700 font-medium">
                      월 분납액 ({fees.installments || 0}회 분할)
                    </div>
                    <div className="text-xl font-black text-emerald-800 mt-1">
                      {formatCurrency(monthlyInstallmentWon)}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">무이자 분납으로 부담 완화</div>
                  </div>
                </div>

                {courtDepositWon > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                    <span>🏛️ 법원 예납비용 (인지대, 송달료 등 실비)</span>
                    <span className="font-bold">{formatCurrency(courtDepositWon)}</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  * {fees.additionalCostsNotice || '법원 예납비용 및 송달료 실비는 채권자 수에 따라 결정되며, 추가 수임료 요구는 일체 없습니다.'}
                </p>
              </div>

              {/* 5-Step Procedure Timeline */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">개인회생 5단계 진행 로드맵</h3>
                <p className="text-xs text-slate-500 mb-6">신청서 접수부터 최종 탕감(면책)까지 전담 변호사가 밀착 동행합니다.</p>

                <ProcedureTimeline currentStage={1} />
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-5 sm:px-8 py-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>변호사법 제23조 및 비밀유지 서약에 따라 안전하게 보호됩니다.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {lawyer.phone && (
              <a
                href={`tel:${lawyer.phone}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>전화 상담</span>
              </a>
            )}

            {onContactLawyer && (
              <button
                onClick={() => onContactLawyer(lawyer)}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>변호사 1:1 메시지</span>
              </button>
            )}

            {onAcceptProposal && reportData.proposalId && (
              <button
                onClick={() => onAcceptProposal(reportData.proposalId!)}
                className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>수임 제안 수락하기</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PremiumProposalReportModal;
