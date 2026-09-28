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
import { ProcedureTimeline } from '../../rehab-chatbot-package/components/rehab/ProcedureTimeline';
import { StatComparisonCard, DistributionBar } from '../../rehab-chatbot-package/components/rehab/StatisticalComparison';
import { 
  calculateIncomePercentile, 
  calculateDebtPercentile, 
  calculateReductionRatePercentile 
} from '../../rehab-chatbot-package/utils/statisticsUtils';
import { REHAB_STATISTICS_2025, AVERAGE_VALUES } from '../../rehab-chatbot-package/config/rehabStatistics2025';
import PrintableReportTemplate from '../client/PrintableReportTemplate';
import PrintableLawyerOpinionTemplate from '../client/PrintableLawyerOpinionTemplate';
import ModalPortal from './ModalPortal';
import { getRecognizedLivingCost2026 } from '../../services/repayment/rehabLegalCore';

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
    isInstallmentAvailable?: boolean;
    feeMemo?: string;
  };
  lawyerComment?: string;
  lawyerOpinion?: string;
  proposalId?: string;
  createdAt?: string;
  expiresAt?: string;
  clientInput?: RehabUserInput;
  calculationResult?: RehabCalculationResult;
  specialNotes?: string[];
  recommendedStrategy?: string;
  clientQnA?: Array<{ question: string; answer: string; }>;
  aiInsights?: any;
}

export interface PremiumProposalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: PremiumReportData;
  proposal?: any;
  clientInfo?: any;
  userInput?: RehabUserInput;
  calcResult?: RehabCalculationResult;
  reportId?: string;
  onAcceptProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
  onContactLawyer?: (lawyerInfo: any) => void;
  onAppointLawyer?: () => void;
  isClientViewer?: boolean;
  isAppointed?: boolean;
  embedded?: boolean;
  isLawyerEditor?: boolean;
  onApplyChanges?: (updatedData: {
    monthlyPayment: number;
    repaymentMonths: number;
    debtReductionRate: number;
    lawyerOpinion: string;
    specialNotes?: string[];
  }) => void;
}

export const PremiumProposalReportModal: React.FC<PremiumProposalReportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  proposal: proposalProp,
  clientInfo,
  userInput: userInputProp,
  calcResult: calcResultProp,
  reportId = `RPT-${Date.now()}`,
  onAcceptProposal,
  onRejectProposal,
  onContactLawyer,
  onAppointLawyer,
  embedded = false,
  isLawyerEditor = false,
  onApplyChanges
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'statistics' | 'roadmap'>('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || embedded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, embedded, onClose]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen && !embedded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, embedded]);

  // 1. AI 정밀 진단서 여부 감지 (isAIPremium)
  const rawAiInsights = 
    proposalProp?.proposalData?.aiInsights || 
    proposalProp?.aiInsights || 
    reportData?.aiInsights || 
    (reportData as any)?.rawAiInsights;
  const isAIPremium = Boolean(rawAiInsights?.isAIPremium);

  // AI 전용 탭에서 일반 제안서로 바뀔 때 overview로 리셋
  useEffect(() => {
    if (!isAIPremium && activeTab === 'statistics') {
      setActiveTab('overview');
    }
  }, [isAIPremium, activeTab]);

  // 2. Unify and normalize props across reportData & proposal & clientInfo
  const lawyerName = 
    reportData?.lawyerInfo?.name || 
    proposalProp?.attorneyReview?.reviewerName || 
    proposalProp?.lawyerName || 
    proposalProp?.lawyer?.name || 
    '담당 변호사';

  // 가짜 사무소명·사진·전화번호로 채우지 않는다 — 변호사가 입력한 정보만 표시
  const lawyerFirmName: string = 
    reportData?.lawyerInfo?.firmName || 
    proposalProp?.attorneyReview?.firmName || 
    proposalProp?.firmName || 
    proposalProp?.lawyer?.firmName || 
    '';

  const lawyerAvatar: string = 
    reportData?.lawyerInfo?.avatar || 
    proposalProp?.lawyerAvatar || 
    proposalProp?.lawyer?.avatar || 
    '';

  const lawyerPhone: string = 
    reportData?.lawyerInfo?.phone || 
    proposalProp?.lawyerPhone || 
    proposalProp?.lawyer?.phone || 
    '';

  const clientName = 
    reportData?.clientName || 
    proposalProp?.clientName || 
    clientInfo?.clientName || 
    clientInfo?.name || 
    '의뢰인';

  const rawCourt = 
    reportData?.diagnosis?.court || 
    proposalProp?.diagnosis?.court || 
    proposalProp?.court || 
    clientInfo?.court || 
    '서울회생법원';
  const courtName = rawCourt.includes('법원') ? rawCourt : `${rawCourt}회생법원`;

  // Currency normalizer:
  const normalizeToWon = (val: number | undefined | null): number => {
    if (!val || isNaN(val)) return 0;
    return val < 10000 ? Math.round(val * 10000) : Math.round(val);
  };

  const rawTotalDebt = 
    reportData?.diagnosis?.totalDebt ?? 
    proposalProp?.diagnosis?.totalDebt ?? 
    proposalProp?.totalDebt ?? 
    clientInfo?.totalDebt ?? 
    clientInfo?.financialProfile?.debtTotal ?? 
    0;

  const rawMonthlyPayment = 
    reportData?.diagnosis?.monthlyPayment ?? 
    proposalProp?.diagnosis?.monthlyPayment ?? 
    proposalProp?.monthlyPayment ?? 
    clientInfo?.monthlyPayment ?? 
    0;

  const repaymentMonths = 
    reportData?.diagnosis?.repaymentMonths || 
    proposalProp?.diagnosis?.repaymentMonths || 
    proposalProp?.repaymentMonths || 
    clientInfo?.repaymentMonths || 
    36;

  const rawEstimatedReduction = 
    reportData?.diagnosis?.estimatedReduction ?? 
    proposalProp?.diagnosis?.estimatedReduction ?? 
    proposalProp?.estimatedReduction;

  const rawDebtReductionRate = 
    reportData?.diagnosis?.debtReductionRate ?? 
    proposalProp?.diagnosis?.debtReductionRate ?? 
    proposalProp?.debtReductionRate ?? 
    0;

  const totalDebt = normalizeToWon(rawTotalDebt);
  const monthlyPayment = normalizeToWon(rawMonthlyPayment);
  const totalRepaymentCalculated = monthlyPayment * repaymentMonths;
  const estimatedReduction = rawEstimatedReduction !== undefined && rawEstimatedReduction > 0
    ? normalizeToWon(rawEstimatedReduction)
    : Math.max(0, totalDebt - totalRepaymentCalculated);

  const debtReductionRate = totalDebt > 0 
    ? Math.min(100, Math.max(0, Math.round((estimatedReduction / totalDebt) * 100))) 
    : (rawDebtReductionRate || 0);

  // Fees
  const rawFees = reportData?.fees || proposalProp?.fees || proposalProp || {};
  // 변호사가 입력하지 않은 수임료 항목은 0(미정)으로 두고 화면에서 '협의'로 표시한다
  const rawTotalFee = rawFees.totalFee ?? proposalProp?.totalFee ?? proposalProp?.fee ?? 0;
  const rawDownPayment = rawFees.downPayment ?? proposalProp?.downPayment ?? 0;
  const rawMonthlyInstallment = rawFees.monthlyInstallment ?? proposalProp?.monthlyInstallment ?? 0;
  const rawCourtDeposit = rawFees.courtDeposit ?? proposalProp?.courtDeposit ?? 0;
  const installments = rawFees.installments ?? proposalProp?.installments ?? 0;
  const additionalCostsNotice = rawFees.additionalCostsNotice || proposalProp?.additionalCostsNotice || proposalProp?.feeMemo;

  const totalFeeWon = normalizeToWon(rawTotalFee);
  const downPaymentWon = normalizeToWon(rawDownPayment);
  const monthlyInstallmentWon = normalizeToWon(rawMonthlyInstallment);
  const courtDepositWon = normalizeToWon(rawCourtDeposit);

  // Lawyer Comments & Notes
  const lawyerComment = 
    reportData?.lawyerComment || 
    reportData?.lawyerOpinion || 
    proposalProp?.lawyerComment || 
    proposalProp?.lawyerOpinion || 
    proposalProp?.opinion || 
    proposalProp?.remark || 
    '제출해 주신 소득·부양가족·채무 정보를 기준으로 개인회생 진행 방향을 검토했습니다. 신청 시 금지·중지명령을 함께 신청해 추심 부담을 줄이는 방안을 검토하고, 관할법원 실무에 맞는 변제계획안을 준비하겠습니다. 실제 개시·인가 여부는 법원 심리와 제출 서류에 따라 결정됩니다.';

  // Lawyer Editing State (isLawyerEditor mode)
  const [editMonthlyPayment, setEditMonthlyPayment] = useState(monthlyPayment);
  const [editRepaymentMonths, setEditRepaymentMonths] = useState(repaymentMonths);
  const [editLawyerComment, setEditLawyerComment] = useState(lawyerComment);
  const [isEditingOpen, setIsEditingOpen] = useState(false);

  useEffect(() => {
    setEditMonthlyPayment(monthlyPayment);
  }, [monthlyPayment]);

  useEffect(() => {
    setEditRepaymentMonths(repaymentMonths);
  }, [repaymentMonths]);

  useEffect(() => {
    setEditLawyerComment(lawyerComment);
  }, [lawyerComment]);

  // 계산된 수정 탕감률
  const editTotalRepayment = editMonthlyPayment * editRepaymentMonths;
  const editEstimatedReduction = Math.max(0, totalDebt - editTotalRepayment);
  const editDebtReductionRate = totalDebt > 0 
    ? Math.min(100, Math.max(0, Math.round((editEstimatedReduction / totalDebt) * 100))) 
    : 0;

  const handleApplyChangesToDraft = () => {
    if (onApplyChanges) {
      onApplyChanges({
        monthlyPayment: editMonthlyPayment,
        repaymentMonths: editRepaymentMonths,
        debtReductionRate: editDebtReductionRate,
        lawyerOpinion: editLawyerComment,
        specialNotes
      });
      toast.success('수정된 AI 분석 및 변제 조건이 제안서에 반영되었습니다.');
      onClose();
    }
  };

  const specialNotes: string[] = 
    reportData?.specialNotes || 
    proposalProp?.specialNotes || [
      '서류가 준비되는 대로 신청서와 금지명령 신청을 함께 준비합니다.',
      '최근 대출금 사용처 소명 자료(금융거래내역 등) 준비를 안내해 드립니다.',
      '법원의 보정권고에는 담당 변호사가 검토 후 대응합니다.'
    ];

  const clientQnA: Array<{ question: string; answer: string }> = 
    proposalProp?.clientQnA || [];

  const proposalId = 
    reportData?.proposalId || 
    proposalProp?.id || 
    proposalProp?.proposalId;

  // Calculation Result Fallback
  const clientInput = reportData?.clientInput || userInputProp;
  const calculationResult = reportData?.calculationResult || calcResultProp;

  // 계산 결과가 없을 때의 보조값 — 2026 법원 인정 생계비 기준표(가구원 수) 사용
  const fallbackFamilySize = Math.max(1, Number((clientInput as any)?.familySize) || 1);
  const fallbackLivingCost = getRecognizedLivingCost2026(fallbackFamilySize);
  const fallbackAdvice = useMemo(() => [
    `${courtName} 실무준칙을 참고해 변제계획을 검토했습니다.`,
    `예상 월 변제금 ${formatCurrency(monthlyPayment)}원, ${repaymentMonths}개월 기준 원금 약 ${debtReductionRate}%(${formatCurrency(estimatedReduction)}원) 감면이 예상됩니다. 실제 금액은 법원 심리에 따라 달라질 수 있습니다.`
  ], [courtName, monthlyPayment, repaymentMonths, debtReductionRate, estimatedReduction]);

  const activeCalcResult: RehabCalculationResult = useMemo(() => {
    const cr = calculationResult as any;
    if (cr && (cr.totalDebt || cr.monthlyPayment)) {
      return {
        ...cr,
        monthlyPayment: cr.monthlyPayment || monthlyPayment,
        totalRepayment: cr.totalRepayment || cr.totalPayment || totalRepaymentCalculated,
        totalPayment: cr.totalPayment || cr.totalRepayment || totalRepaymentCalculated,
        repaymentMonths: cr.repaymentMonths || repaymentMonths,
        debtReductionRate: cr.debtReductionRate ?? cr.reductionRate ?? debtReductionRate,
        reductionRate: cr.reductionRate ?? cr.debtReductionRate ?? debtReductionRate,
        totalDebtReduction: cr.totalDebtReduction ?? cr.reductionAmount ?? estimatedReduction,
        reductionAmount: cr.reductionAmount ?? cr.totalDebtReduction ?? estimatedReduction,
        totalDebt: cr.totalDebt || totalDebt,
        courtName: cr.courtName || courtName,
        court: cr.court || courtName,
        courtDescription: cr.courtDescription || `${courtName} 실무준칙 종합 적용`,
        status: cr.status || 'POSSIBLE',
        statusReason: cr.statusReason || '변호사 제안 조건 기준 예상치',
        availableIncome: cr.availableIncome || monthlyPayment,
        recognizedLivingCost: cr.recognizedLivingCost || fallbackLivingCost,
        baseLivingCost: cr.baseLivingCost || fallbackLivingCost,
        additionalLivingCost: cr.additionalLivingCost || 0,
        liquidationValue: cr.liquidationValue || 0,
        processingMonths: cr.processingMonths || 6,
        aiAdvice: cr.aiAdvice || fallbackAdvice,
        riskWarnings: cr.riskWarnings || [],
        exemptDeposit: cr.exemptDeposit || 0,
        regionGroup: cr.regionGroup || 'etc',
        alerts: cr.alerts || [],
      } as RehabCalculationResult;
    }
    const currentBurden = clientInput 
      ? calculateCurrentMonthlyBurden(clientInput as any)
      : Math.round(totalDebt * 0.04);

    // 소득 미입력 시 임의 금액(280만)을 넣지 않는다. 생계비는 2026 법원 기준표(가구원 수)로만 산정.
    const monthlyIncome = normalizeToWon(clientInput?.monthlyIncome);
    const recognizedLivingCost = fallbackLivingCost;
    const availableIncome = monthlyIncome > 0 ? Math.max(0, monthlyIncome - recognizedLivingCost) : monthlyPayment;

    return {
      monthlyPayment: monthlyPayment,
      totalPayment: totalRepaymentCalculated,
      totalRepayment: totalRepaymentCalculated,
      repaymentMonths: repaymentMonths,
      debtReductionRate: debtReductionRate,
      reductionRate: debtReductionRate,
      totalDebtReduction: estimatedReduction,
      reductionAmount: estimatedReduction,
      totalDebt: totalDebt,
      currentMonthlyBurden: currentBurden,
      court: courtName,
      courtName: courtName,
      courtDescription: `${courtName} 실무준칙 종합 적용`,
      status: 'POSSIBLE',
      statusReason: '변호사 제안 조건 기준 예상치',
      reasons: [],
      eligibleProcedures: ['individual_rehabilitation'],
      monthlyIncome: monthlyIncome,
      recognizedLivingCost: recognizedLivingCost,
      baseLivingCost: recognizedLivingCost,
      additionalLivingCost: 0,
      availableIncome: availableIncome,
      dependentsCount: clientInput?.dependentsCount || 1,
      liquidationValue: 0,
      processingMonths: 6,
      aiAdvice: fallbackAdvice,
      riskWarnings: [],
      exemptDeposit: 0,
      regionGroup: 'etc',
      alerts: [],
    } as RehabCalculationResult;
  }, [calculationResult, totalDebt, monthlyPayment, repaymentMonths, estimatedReduction, debtReductionRate, clientInput, courtName, totalRepaymentCalculated, fallbackLivingCost, fallbackAdvice]);

  const activeUserInput: RehabUserInput = useMemo(() => {
    if (clientInput) {
      return {
        ...clientInput,
        name: clientInput.name || clientName,
        totalDebt: clientInput.totalDebt || totalDebt,
        monthlyIncome: clientInput.monthlyIncome || (activeCalcResult as any).monthlyIncome || 0,
        familySize: clientInput.familySize || ((activeCalcResult as any).dependentsCount || 1),
      };
    }
    return {
      address: '서울특별시',
      employmentType: 'salary',
      isMarried: false,
      deposit: 0,
      myAssets: 0,
      spouseAssets: 0,
      monthlyIncome: (activeCalcResult as any).monthlyIncome || 0,
      familySize: (activeCalcResult as any).dependentsCount || 1,
      totalDebt: totalDebt,
      name: clientName,
    };
  }, [clientInput, clientName, activeCalcResult, totalDebt]);

  // PDF Export - 격리된 Sandbox Iframe / Clean Body-Mount 하이브리드 엔진
  // "Unable to find element in cloned iframe" 및 React 전역 트리 간섭 원천 방지
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('고해상도 진단서를 PDF로 변환하고 있습니다...');

    try {
      // 1. 폰트 및 DOM 렌더링 완료 대기
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      // 2. 페이지 요소 수집 (.pdf-page-item 우선, fallback id 기반)
      const container = printRef.current;
      let pageElements = Array.from(container.querySelectorAll<HTMLElement>('.pdf-page-item'));

      if (pageElements.length === 0) {
        if (isAIPremium) {
          for (let p = 1; p <= 7; p++) {
            const el = document.getElementById(`pdf-page-${p}`);
            if (el) pageElements.push(el);
          }
        } else {
          for (let p = 1; p <= 2; p++) {
            const el = document.getElementById(`pdf-lawyer-page-${p}`);
            if (el) pageElements.push(el);
          }
        }
      }

      if (pageElements.length === 0) {
        const directChildren = Array.from(container.firstElementChild?.children || []);
        if (directChildren.length > 0) {
          pageElements = directChildren as HTMLElement[];
        }
      }

      if (pageElements.length === 0) {
        throw new Error('진단서 페이지 요소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      // 3. jsPDF 인스턴스 초기화 (A4: 210mm x 297mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const imgWidth = 210;
      const imgHeight = 297;

      // 4. 격리 Sandbox 렌더러 함수
      const capturePage = async (pageEl: HTMLElement): Promise<HTMLCanvasElement> => {
        // Strategy 1: Isolated sandbox iframe (100% immune to React DOM & extensions interference)
        try {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.top = '-99999px';
          iframe.style.left = '-99999px';
          iframe.style.width = '850px';
          iframe.style.height = '1250px';
          iframe.style.border = '0';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          iframe.setAttribute('aria-hidden', 'true');
          document.body.appendChild(iframe);

          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;"></body></html>');
              iframeDoc.close();

              // Copy styles from main document
              Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).forEach(styleEl => {
                try {
                  iframeDoc.head.appendChild(styleEl.cloneNode(true));
                } catch {}
              });

              // Clone page into iframe body
              const clonedPage = pageEl.cloneNode(true) as HTMLElement;
              clonedPage.style.position = 'static';
              clonedPage.style.margin = '0';
              clonedPage.style.boxSizing = 'border-box';
              iframeDoc.body.appendChild(clonedPage);

              if (iframeDoc.fonts && iframeDoc.fonts.ready) {
                await iframeDoc.fonts.ready;
              }
              await new Promise(r => setTimeout(r, 60));

              const canvas = await html2canvas(clonedPage, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 850,
                ignoreElements: (el) => el.tagName === 'IFRAME'
              });

              return canvas;
            }
          } finally {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }
        } catch (iframeErr) {
          console.warn('[PDF Export] Sandbox iframe capture failed, trying direct body mount:', iframeErr);
        }

        // Strategy 2: Direct Body Mount Fallback
        const tempHost = document.createElement('div');
        tempHost.style.position = 'fixed';
        tempHost.style.top = '-99999px';
        tempHost.style.left = '-99999px';
        tempHost.style.width = '850px';
        tempHost.style.zIndex = '-9999';
        tempHost.style.backgroundColor = '#ffffff';
        document.body.appendChild(tempHost);

        try {
          const clonedPage = pageEl.cloneNode(true) as HTMLElement;
          clonedPage.style.position = 'static';
          clonedPage.style.margin = '0';
          tempHost.appendChild(clonedPage);

          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
          await new Promise(r => setTimeout(r, 60));

          const canvas = await html2canvas(clonedPage, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 850,
            ignoreElements: (el) => el.tagName === 'IFRAME'
          });

          return canvas;
        } finally {
          if (tempHost.parentNode) {
            tempHost.parentNode.removeChild(tempHost);
          }
        }
      };

      // 5. 각 페이지별 격리 캡처 및 PDF 삽입
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        const canvas = await capturePage(pageEl);

        if (i > 0) {
          pdf.addPage();
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      const filePrefix = isAIPremium ? 'AI_7p_정밀진단서' : '변호사_직접검토의견서';
      const sanitizedName = (clientName || '의뢰인').replace(/[^a-zA-Z0-9가-힣_]/g, '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `${filePrefix}_${sanitizedName}_${dateStr}.pdf`;

      pdf.save(fileName);

      toast.success(
        isAIPremium 
          ? `AI 7p 정밀 진단서 PDF가 저장되었습니다. (${pageElements.length}p)` 
          : `변호사 직접 검토 의견서 PDF가 저장되었습니다. (${pageElements.length}p)`, 
        { id: toastId }
      );
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      toast.error(`PDF 생성 중 오류가 발생했습니다: ${error?.message || error || '다시 시도해주세요.'}`, { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleAccept = () => {
    if (onAcceptProposal && proposalId) {
      onAcceptProposal(proposalId);
    } else if (onAppointLawyer) {
      onAppointLawyer();
    } else {
      toast.success('수임 제안이 수락되었습니다. 변호사가 곧 연락드립니다.');
      onClose();
    }
  };

  if (!isOpen && !embedded) return null;

  const modalContent = (
    <div className={embedded ? "w-full" : "fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"}>
      {/* 
        OFF-SCREEN PRINTABLE CONTAINER FOR PDF GENERATION
        Rendered at left: -9999px to ensure clean html2canvas capture without visible backdrop bleed.
      */}
      <div 
        id="pdf-render-container" 
        ref={printRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: '794px',
          zIndex: -9999,
          pointerEvents: 'none',
        }}
      >
        {isAIPremium ? (
          <PrintableReportTemplate
            result={activeCalcResult}
            userInput={activeUserInput}
          />
        ) : (
          <PrintableLawyerOpinionTemplate
            result={activeCalcResult}
            userInput={activeUserInput}
            proposal={proposalProp}
            lawyerName={lawyerName}
            lawyerFirmName={lawyerFirmName}
            clientName={clientName}
            courtName={courtName}
            totalDebt={totalDebt}
            monthlyPayment={monthlyPayment}
            debtReductionRate={debtReductionRate}
            estimatedReduction={estimatedReduction}
            repaymentMonths={repaymentMonths}
            totalRepayment={totalRepaymentCalculated}
            lawyerOpinion={lawyerComment}
            specialNotes={specialNotes}
            totalFeeWon={totalFeeWon}
            downPaymentWon={downPaymentWon}
            monthlyInstallmentWon={monthlyInstallmentWon}
            installments={installments}
            additionalCostsNotice={additionalCostsNotice}
            documentId={proposalId}
            issuedAt={proposalProp?.createdAt || reportData?.createdAt}
          />
        )}
      </div>

      {/* Main Modal Container */}
      <div 
        className={`relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${embedded ? '' : 'max-h-[calc(100vh-2.5rem)]'} animate-in fade-in zoom-in-95 duration-200`}
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
                {lawyerAvatar ? (
                  <img 
                    src={lawyerAvatar} 
                    alt={lawyerName} 
                    className={`w-13 h-13 rounded-full object-cover ring-2 shadow-md ${
                      isAIPremium ? 'ring-amber-400/80' : 'ring-blue-500/60'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-13 h-13 rounded-full bg-gradient-to-br from-blue-600 to-[#1E3A5F] text-white flex items-center justify-center font-black text-lg ring-2 shadow-md ${
                      isAIPremium ? 'ring-amber-400/80' : 'ring-blue-500/60'
                    }`}
                    aria-hidden="true"
                  >
                    {lawyerName.charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ring-2 ring-slate-950 ${
                  isAIPremium ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-slate-950'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAIPremium ? (
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 shadow-sm flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                      AI 정밀 진단 & 변호사 제안서
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-400" />
                      변호사 검토 제안서
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    가명 안심 보호 중
                  </span>
                </div>
                
                <h2 id="report-modal-title" className="text-lg sm:text-xl font-black text-white mt-1.5 flex items-center gap-2">
                  <span>{isAIPremium ? `${clientName}님의 개인회생 정밀 진단서` : `${clientName}님을 위한 변호사 제안서`}</span>
                  <span className="text-sm font-normal text-slate-300">· {lawyerName}{lawyerFirmName ? ` (${lawyerFirmName})` : ''}</span>
                </h2>
                
                <p className="text-xs text-slate-400 mt-0.5">
                  수신: <span className="text-slate-200 font-semibold">{clientName}</span> 님 귀하 | 관할: <span className="text-slate-200 font-semibold">{courtName}</span>
                  {isAIPremium ? (
                    <span className="text-amber-300 font-semibold ml-2">✦ 규칙 기반 참고 진단 포함</span>
                  ) : (
                    <span className="text-emerald-300 font-semibold ml-2">⚖️ 담당 변호사 검토 의견</span>
                  )}
                </p>

                {/* 관할 법원 표시 (이전: 근거 없는 인용률·탕감률·속도등급을 의뢰인에게 표시 — 저장된 옛 제안서의 수치도 표시하지 않음) */}
                {isAIPremium && rawAiInsights?.courtStats?.courtName && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      🏛️ 관할 {rawAiInsights.courtStats.courtName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick KPI Bar & Action Buttons */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <button
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border active:scale-[0.98] disabled:opacity-50 whitespace-nowrap ${
                  isAIPremium 
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 font-bold shadow-md shadow-amber-400/20' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold'
                }`}
                title="진단서 PDF 저장"
              >
                <Download className={`w-4 h-4 ${isAIPremium ? 'text-slate-950' : 'text-blue-400'}`} />
                <span>{isGeneratingPdf ? 'PDF 생성 중...' : isAIPremium ? 'AI 7p 리포트 PDF 저장' : '변호사 의견서 PDF 저장 (2p)'}</span>
              </button>

              {isLawyerEditor && (
                <button
                  onClick={() => setIsEditingOpen(!isEditingOpen)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition border active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                    isEditingOpen
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 hover:bg-indigo-500/30'
                  }`}
                  title="변호사 직접 수정"
                >
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                  <span>{isEditingOpen ? '수정창 닫기' : '변호사 직접 수정'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-[0.98] cursor-pointer"
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

          {/* Lawyer Direct Edit Panel (Collapsible) */}
          {isLawyerEditor && isEditingOpen && (
            <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-indigo-500/40 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    담당 변호사 AI 분석 보고서 직접 수정 및 제안서 연동
                  </h4>
                </div>
                <span className="text-[11px] text-indigo-300 font-mono font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  실시간 탕감률 계산: 약 {editDebtReductionRate}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">추천 월 변제금 (원)</label>
                  <input
                    type="number"
                    step="10000"
                    value={editMonthlyPayment}
                    onChange={(e) => setEditMonthlyPayment(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:border-indigo-400 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-400">
                    현재: {editMonthlyPayment.toLocaleString()}원 / 월
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">변제 기간 (개월)</label>
                  <select
                    value={editRepaymentMonths}
                    onChange={(e) => setEditRepaymentMonths(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-400 focus:outline-none cursor-pointer"
                  >
                    <option value={24}>24개월 (청년/취약계층 특례)</option>
                    <option value={36}>36개월 (표준 변제기간)</option>
                    <option value={48}>48개월 (연장 변제)</option>
                    <option value={60}>60개월 (최대 변제기간)</option>
                  </select>
                  <div className="text-[10px] text-slate-400">
                    총 변제액: {(editTotalRepayment).toLocaleString()}원
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">예상 원금 감면액</label>
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 flex items-center justify-between">
                    <span>{editEstimatedReduction.toLocaleString()}원</span>
                    <span className="text-[11px] text-slate-400 font-sans font-normal">감면</span>
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    탕감률: 약 {editDebtReductionRate}%
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">변호사 종합 검토 소견 및 전략 (의뢰인 제안서 연동)</label>
                <textarea
                  rows={2}
                  value={editLawyerComment}
                  onChange={(e) => setEditLawyerComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed focus:border-indigo-400 focus:outline-none font-sans"
                  placeholder="의뢰인의 상황에 맞춘 변호사 종합의견을 입력하세요."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleApplyChangesToDraft}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>수정 내용 제안서에 즉시 반영하기</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs (Distinct for AI Premium vs Standard) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-8 py-2.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'overview'
                ? isAIPremium 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            {isAIPremium ? <Sparkles className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
            <span>{isAIPremium ? 'AI 종합 진단' : '변호사 직접 검토의견 (전문)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'financial'
                ? isAIPremium 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isAIPremium ? '소득·재산 & 가계수지' : '채무조정 변제계획안'}</span>
          </button>

          {/* AI 7p 정밀 진단서 전용 탭: 사법연감 통계 백분위 */}
          {isAIPremium && (
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
                activeTab === 'statistics'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Percent className="w-4 h-4 text-purple-600" />
              <span>통계 비교 (참고용)</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
              activeTab === 'roadmap'
                ? isAIPremium 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{isAIPremium ? '수임료 & 사건 로드맵' : '수임료 및 사건 진행 절차'}</span>
          </button>
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* [변호사 직접 검토 전용 서식] 공인 법률의견서 정식 서면 */}
              {!isAIPremium ? (
                <div className="space-y-6">
                  {/* 1. 담당 변호사 직접 심사 총괄 소견 카드 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              변호사 검토의견
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              관할: <strong className="text-slate-700">{courtName}</strong>
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                            {lawyerName} 변호사의 검토 소견
                          </h3>
                        </div>
                      </div>

                      {/* 작성 사무소 (가짜 인장 표시 없음) */}
                      {lawyerFirmName && (
                        <div className="flex items-center gap-2 self-end sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <span className="text-xs font-semibold text-slate-700">{lawyerFirmName}</span>
                        </div>
                      )}
                    </div>

                    {/* 핵심 변호사 코멘트 및 소견 */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 text-slate-800 leading-relaxed space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-blue-600 text-2xl font-serif font-black leading-none select-none">“</span>
                        <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                          제출해 주신 소득 요건과 부채 규모를 관할법원 실무 기준에 맞추어 검토한 변제 계획안입니다.
                        </p>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed pl-5 whitespace-pre-line">
                        {lawyerComment}
                      </p>
                    </div>
                  </div>

                  {/* 2. 법원 보정명령 방어 및 직접 소명 3대 전략 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                          보정 대응 및 소명 준비 계획
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {specialNotes.map((note, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-slate-900 font-extrabold">계획 {idx + 1}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. 의뢰인 안내 사항 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">상담 비밀 보호</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">계약 전까지 가명으로 상담하며, 상담 내용은 변호사 비밀유지의무로 보호됩니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">담당 변호사 책임 수행</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">수임 후 사건은 계약서에 기재된 담당 변호사가 책임지고 진행합니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">환불 조건 사전 확인</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">중도 해지 시 환불 조건은 서명 전에 위임계약서에서 확인하실 수 있습니다</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. 법적 신뢰 인증 씰 바 */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-800">
                        상담 내용은 변호사법 제26조(비밀유지의무)에 따라 보호됩니다. 본 제안서는 수임 전 참고 의견입니다.
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-medium">
                      작성: {lawyerFirmName ? `${lawyerFirmName} · ` : ''}{lawyerName}{lawyerName.endsWith('변호사') ? '' : ' 변호사'}
                    </span>
                  </div>
                </div>
              ) : (
                /* [AI 프리미엄 특화] AI 정밀 진단서 기존 뷰 */
                <>
                  {/* [AI 프리미엄 특화] AI 정밀 사건 브리핑: 부채 구조 3분류 & 사전 위험 플래그 진단 */}
                  {rawAiInsights && (
                    <div className="bg-gradient-to-br from-amber-50/60 via-blue-50/40 to-slate-50 border border-amber-200/80 shadow-sm rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-amber-200/60">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-900 font-bold">
                            <Sparkles className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900">
                              AI 정밀 사건 브리핑: 부채 구조 및 사전 위험 진단
                            </h4>
                            <p className="text-xs text-slate-600">입력하신 부채 정보를 자동 분류한 결과와 검토가 필요한 위험 요인입니다.</p>
                          </div>
                        </div>
                        {rawAiInsights.reviewGrade && (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            검토 수준: {rawAiInsights.reviewGrade === 'ENHANCED_REVIEW' ? '강화 검토' : rawAiInsights.reviewGrade === 'NORMAL_REVIEW' ? '일반 검토' : '정밀 검토'}
                          </span>
                        )}
                      </div>

                      {/* 부채 구성 3대 분류 */}
                      {rawAiInsights.debtBreakdown && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">무담보 신용 채무</div>
                            <div className="text-base font-black text-slate-900">{formatCurrency(rawAiInsights.debtBreakdown.unsecured)}</div>
                            <div className="text-xs text-emerald-700 font-bold mt-1">변제계획에 따른 감면 대상</div>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">담보 대출 채무</div>
                            <div className="text-base font-black text-slate-900">{formatCurrency(rawAiInsights.debtBreakdown.secured)}</div>
                            <div className="text-xs text-slate-500 mt-1">별제권 별도 보호 관리</div>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <div className="text-xs text-slate-500 font-medium mb-1">우선변제 (조세·공과금)</div>
                            <div className="text-base font-black text-amber-600">{formatCurrency(rawAiInsights.debtBreakdown.tax)}</div>
                            <div className="text-xs text-amber-700 font-bold mt-1">변제계획 1순위 변제</div>
                          </div>
                        </div>
                      )}

                      {/* AI 위험 플래그 진단 */}
                      {rawAiInsights.riskFlags && rawAiInsights.riskFlags.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span>사전 검토가 필요한 위험 요인</span>
                          </div>
                          <div className="space-y-2">
                            {rawAiInsights.riskFlags.map((flag: any, idx: number) => (
                              <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200/70 text-xs text-slate-700 flex items-start gap-2.5 shadow-xs">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">!</span>
                                <span className="leading-relaxed">{flag.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Primary Before vs After Visual Comparison Card */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                          <TrendingDown className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">개인회생 신청 전후 재무 변화</h3>
                          <p className="text-xs text-slate-600">제안 조건대로 인가될 경우의 예상 채무 조정 결과입니다. 실제 결과는 법원 심리에 따라 달라질 수 있습니다.</p>
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
                          개인회생 인가 시 (예상)
                        </div>
                        <div className="space-y-2.5 mt-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">월 변제금 ({repaymentMonths}개월)</span>
                            <span className="text-base font-black text-emerald-700">{formatCurrency(monthlyPayment)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">이자</span>
                            <span className="font-bold text-emerald-700">원칙적으로 원금 기준 변제</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">총 변제 원금</span>
                            <span className="font-bold text-slate-900">{formatCurrency(totalRepaymentCalculated)}</span>
                          </div>
                          <div className="pt-2 border-t border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
                            <span>예상 탕감 금액 (변제 완료·면책 시)</span>
                            <span className="text-sm font-black text-emerald-700">{formatCurrency(estimatedReduction)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lawyer's Diagnosis Opinion */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-2xl shrink-0 ${isAIPremium ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
                        <Scale className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {lawyerName} 변호사의 종합 소견
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            진단 기준 법원: {courtName}
                          </span>
                        </div>

                        <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                          {lawyerComment}
                        </div>

                        {specialNotes && specialNotes.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="text-xs font-bold text-slate-700">📌 사건 진행 시 주의사항</div>
                            <ul className="space-y-1.5">
                              {specialNotes.map((note, idx) => (
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

                  {/* 의뢰인 안내 사항 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">금지명령 함께 신청</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">법원이 금지명령을 내리면 채권자의 추심·강제집행이 제한됩니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">상담 비밀 보호</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">상담 내용은 변호사 비밀유지의무로 보호됩니다. 직장·가족 관련 유의사항은 상담 시 안내합니다</p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">환불 조건 사전 확인</h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">중도 해지 시 환불 조건은 서명 전에 위임계약서에서 확인하실 수 있습니다</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

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
                    부양가족 {(activeCalcResult as any).dependentsCount || 1}인 기준
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">월 평균 실수령 소득</div>
                    <div className="text-lg font-black text-slate-900 mt-1">
                      {(activeCalcResult as any).monthlyIncome ? formatCurrency((activeCalcResult as any).monthlyIncome) : '미입력'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">세금·4대보험 공제 후</div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">법원 인정 생계비</div>
                    <div className="text-lg font-black text-blue-600 mt-1">
                      {formatCurrency(activeCalcResult.recognizedLivingCost)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">2026 기준 중위소득 60% 기준</div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <div className="text-xs text-emerald-700 font-medium">예상 월 변제금</div>
                    <div className="text-lg font-black text-emerald-800 mt-1">
                      {formatCurrency(monthlyPayment)}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">매월 법원에 납입하는 금액</div>
                  </div>
                </div>

                {/* Formula Bar */}
                <div className="mt-5 p-4 rounded-xl bg-slate-100 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                  <span>📐 <strong>산정 원리</strong>: 월 소득 − 인정 생계비 = 월 가용소득. 월 변제금은 가용소득을 기준으로 청산가치·최저변제액 요건을 함께 고려해 정해집니다.</span>
                  <span className="text-slate-500">※ 추가 생계비(주거·의료 등) 인정 여부에 따라 달라질 수 있습니다.</span>
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
                      <span className="text-slate-500">개인회생 인가 시 예상 월 변제금</span>
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
                      <div className="text-[11px] text-purple-700 font-bold">변제 기간</div>
                      <div className="text-sm sm:text-base font-black text-purple-900 mt-0.5">
                        {repaymentMonths}개월
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: STATISTICS (AI 7p 정밀 진단서 전용 탭) */}
          {isAIPremium && activeTab === 'statistics' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        공개 통계 기준 참고 비교
                      </h3>
                      <p className="text-xs text-slate-600">공개된 개인회생 통계와 입력하신 소득·채무·예상 탕감률을 비교한 참고 자료입니다. 법원의 판단 기준이 아닙니다.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                    참고용
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeUserInput.monthlyIncome > 0 && (
                    <StatComparisonCard
                      title="월 소득 비교"
                      userValue={activeUserInput.monthlyIncome}
                      averageValue={AVERAGE_VALUES.monthlyIncome}
                      percentile={calculateIncomePercentile(activeUserInput.monthlyIncome)}
                      icon={<DollarSign className="w-4 h-4" />}
                      unit="원"
                    />
                  )}
                  {totalDebt > 0 && (
                    <StatComparisonCard
                      title="총 채무 비교"
                      userValue={totalDebt}
                      averageValue={AVERAGE_VALUES.totalDebt}
                      percentile={calculateDebtPercentile(totalDebt)}
                      icon={<CreditCard className="w-4 h-4" />}
                      unit="원"
                    />
                  )}
                  <StatComparisonCard
                    title="예상 탕감률 비교"
                    userValue={debtReductionRate}
                    averageValue={AVERAGE_VALUES.debtReductionRate}
                    percentile={calculateReductionRatePercentile(debtReductionRate)}
                    icon={<Percent className="w-4 h-4" />}
                    unit="%"
                  />
                </div>

                <DistributionBar
                  title="개인회생 원금 탕감률 분포 내 예상 위치 (참고)"
                  userValue={debtReductionRate}
                  distribution={REHAB_STATISTICS_2025.debtReductionRateDistribution || []}
                  highlightRange={(() => {
                    const rate = debtReductionRate;
                    if (rate < 10) return '10% 미만';
                    if (rate >= 90) return '90% 이상';
                    const lower = Math.floor(rate / 10) * 10;
                    const upper = lower + 10;
                    return `${lower}% 이상 ${upper}% 미만`;
                  })()}
                />

                <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-purple-900 leading-relaxed">
                  💡 <strong>참고</strong>: 예상 탕감률({debtReductionRate}%)을 공개 통계 분포와 비교한 위치입니다. 
                  통계 비교는 사건의 개시·인가 가능성을 보장하지 않으며, 실제 결과는 {courtName}의 심리와 제출 서류에 따라 달라집니다.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEGAL FEES & CASE ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">

              {/* Transparent Legal Fees Structure Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">수임료 및 분납 조건 안내</h3>
                    <p className="text-xs text-slate-600">변호사가 제안한 수임료입니다. 최종 금액과 납부 일정은 위임계약서에 기재됩니다.</p>
                  </div>
                  {installments > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      {installments}회 분납
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">총 변호사 수임료</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {totalFeeWon > 0 ? formatCurrency(totalFeeWon) : '상담 후 확정'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">변호사 제안 기준</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">착수금 (계약 시)</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {downPaymentWon > 0 ? formatCurrency(downPaymentWon) : '협의'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">계약서에 기재된 일정에 따라 납부</div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-xs text-emerald-700 font-medium">
                      월 분납액{installments > 0 ? ` (${installments}회 분할)` : ''}
                    </div>
                    <div className="text-xl font-black text-emerald-800 mt-1">
                      {monthlyInstallmentWon > 0 ? formatCurrency(monthlyInstallmentWon) : '협의'}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">분납 조건은 변호사마다 다릅니다</div>
                  </div>
                </div>

                {courtDepositWon > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                    <span>🏛️ 법원 예납비용 (인지대, 송달료 등 실비)</span>
                    <span className="font-bold">{formatCurrency(courtDepositWon)}</span>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  * {additionalCostsNotice || '인지대·송달료 등 법원 실비는 채권자 수에 따라 별도로 정해집니다. 계약서에 없는 비용 요구가 있으면 고객센터로 알려 주세요.'}
                </p>
              </div>

              {/* 5-Step Procedure Timeline */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">개인회생 5단계 진행 로드맵</h3>
                <p className="text-xs text-slate-600 mb-6">신청서 접수부터 면책 결정까지의 일반적인 진행 순서입니다.</p>

                <ProcedureTimeline currentStage={1} />
              </div>

              {/* 1:1 맞춤 Q&A (있는 경우) */}
              {clientQnA && clientQnA.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-brand" />
                    <span>의뢰인 맞춤 핵심 Q&A</span>
                  </h3>
                  <div className="space-y-3">
                    {clientQnA.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="text-xs font-bold text-slate-900 flex items-start gap-2">
                          <span className="text-brand font-black">Q.</span>
                          <span>{item.question}</span>
                        </div>
                        <div className="text-xs text-slate-600 pl-4 leading-relaxed">
                          <span className="text-emerald-600 font-bold mr-1.5">A.</span>
                          {item.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-5 sm:px-8 py-4 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>상담 내용은 변호사법 제26조(비밀유지의무)에 따라 보호됩니다.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isLawyerEditor && onApplyChanges && (
              <button
                type="button"
                onClick={handleApplyChangesToDraft}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>수정 내용 제안서에 반영하기</span>
              </button>
            )}

            {lawyerPhone && !isLawyerEditor && (
              <a
                href={`tel:${lawyerPhone}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>전화 상담</span>
              </a>
            )}

            {onContactLawyer && (
              <button
                onClick={() => onContactLawyer({ name: lawyerName, firmName: lawyerFirmName, phone: lawyerPhone })}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>변호사 1:1 메시지</span>
              </button>
            )}

            {(onAcceptProposal || onAppointLawyer) && (
              <button
                onClick={handleAccept}
                type="button"
                className={`flex items-center justify-center gap-1.5 px-6 min-h-[44px] whitespace-nowrap rounded-xl text-xs sm:text-sm font-bold transition active:scale-[0.98] w-full sm:w-auto shadow-md cursor-pointer ${
                  isAIPremium 
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>이 조건으로 전자계약 진행</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return embedded ? modalContent : <ModalPortal>{modalContent}</ModalPortal>;
};

export default PremiumProposalReportModal;
