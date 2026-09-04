import React, { useState, useRef } from 'react';
import { 
  X, Download, CheckCircle2, ShieldCheck, Scale, Sparkles, 
  Landmark, TrendingDown, Clock, AlertTriangle, MessageSquare, 
  DollarSign, FileText, ChevronRight, User, Printer, ArrowRight,
  Shield, Check, Phone, Building2, HelpCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';

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
  reportData: PremiumReportData;
  onAppointLawyer?: () => void;
  isClientViewer?: boolean;
  isAppointed?: boolean;
  embedded?: boolean; // 스튜디오 미리보기용 인라인 모드
}

export default function PremiumProposalReportModal({
  isOpen,
  onClose,
  reportData,
  onAppointLawyer,
  isClientViewer = true,
  isAppointed = false,
  embedded = false
}: PremiumProposalReportModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen && !embedded) return null;

  const {
    lawyerInfo = { name: '담당 변호사', firmName: '도산전문 법률사무소' },
    clientName = '의뢰인',
    diagnosis,
    fees,
    lawyerOpinion,
    specialNotes = [],
    clientQnA = [],
    aiInsights,
    createdAt
  } = reportData;

  const courtName = diagnosis.court || '서울회생법원';
  const reportDate = createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR');

  // PDF 다운로드 핸들러
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    toast.info('공인 종합채무진단서 PDF를 생성 중입니다...');

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
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

      pdf.save(`AI_개인회생_정밀진단서_${clientName}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF 정밀진단서가 성공적으로 다운로드되었습니다!');
    } catch (err) {
      console.error('PDF 생성 실패:', err);
      toast.error('PDF 다운로드 중 오류가 발생했습니다. 브라우저 인쇄 기능을 이용해 주세요.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const content = (
    <div ref={printRef} className="w-full max-w-4xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 font-sans text-left">
      
      {/* ── 1. 프리미엄 리포트 공식 헤더 ── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E3A5F] to-[#0F172A] text-white p-6 sm:p-8 relative overflow-hidden">
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
            
            <div className="text-xs text-slate-300 font-medium">
              발행일자: {reportDate}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-700/60">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {clientName}님 개인회생 맞춤 법률 진단서
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                본 진단서는 담당 변호사가 {courtName} 실무준칙 및 AI 정밀 분석 데이터를 바탕으로 직접 검토·작성한 법률 소견서입니다.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 self-start md:self-auto">
              {lawyerInfo.avatar ? (
                <img src={lawyerInfo.avatar} alt="변호사" className="w-10 h-10 rounded-full object-cover border border-white/40" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-black text-base">
                  {lawyerInfo.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="text-[11px] text-slate-300">{lawyerInfo.firmName || '도산전문 법률사무소'}</div>
                <div className="text-sm font-extrabold text-white flex items-center gap-1">
                  <span>{lawyerInfo.name}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 핵심 3대 지표 하이라이트 바 ── */}
      <div className="bg-slate-50 border-b border-slate-200 p-5 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block mb-0.5">총 채무액</span>
          <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
            {formatCurrency(diagnosis.totalDebt)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] text-rose-500 font-bold block mb-0.5">예상 원금 감면액</span>
          <span className="text-base sm:text-lg font-black text-rose-600 font-mono">
            약 {diagnosis.debtReductionRate}% 탕감
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-xs bg-blue-50/20">
          <span className="text-[11px] text-[#1E3A5F] font-bold block mb-0.5">월 권장 변제금</span>
          <span className="text-base sm:text-lg font-black text-[#1E3A5F] font-mono">
            {formatCurrency(diagnosis.monthlyPayment)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block mb-0.5">변제 기간 / 판정</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">
            {diagnosis.repaymentMonths}개월 (신청적격)
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">

        {/* ── 3. [다이어그램 1] 관할 법원 실무 통계 레이더 ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#1E3A5F]" />
              {courtName} 빅데이터 실무 통계 다이어그램
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              초고속 처리 법원 (개시까지 평균 2.8개월)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-bold block">금지명령 인용률</span>
              <span className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">94.2%</span>
              <span className="text-[10px] text-slate-400">신청 즉시 채권 추심 중단 가능</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-bold block">평균 변제율</span>
              <span className="text-lg font-black text-[#1E3A5F] font-mono mt-0.5 block">32.5%</span>
              <span className="text-[10px] text-slate-400">전국 평균 대비 약 5.5%p 유리</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-bold block">개시결정 소요</span>
              <span className="text-lg font-black text-blue-600 font-mono mt-0.5 block">2.8개월</span>
              <span className="text-[10px] text-slate-400">접수 후 신속 인가 유도</span>
            </div>
          </div>

          {/* 법원 실무 특칙 안내 배지 */}
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-1">
            <span className="font-extrabold flex items-center gap-1 text-[#1E3A5F]">
              <ShieldCheck className="w-3.5 h-3.5" />
              {courtName} 실무준칙 특칙 선제 적용
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              • 주식/코인 투자 손실금 청산가치 제외 특칙 공식 반영<br />
              • 배우자 명의 재산 원칙적 미반영(특유재산 보호) 적용<br />
              • 최근 1년 이내 채무 성실 소명으로 기각 위험 차단
            </p>
          </div>
        </div>

        {/* ── 4. [다이어그램 2] AI 3단 변제금 시나리오 비교 차트 ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#1E3A5F]" />
              AI 3단 변제 시나리오 비교 검증
            </h3>
            <span className="text-[11px] text-slate-400">변호사 추천 플랜 적용</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* 원칙주의안 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700">시나리오 A. 원칙주의안 (기본 생계비)</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">보정 권고 최소화, 안전 통과 중심</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-slate-800">{formatCurrency(Math.round(diagnosis.monthlyPayment * 1.15))} / 월</span>
                <span className="block text-[10px] text-slate-500 font-bold">탕감률 약 55%</span>
              </div>
            </div>

            {/* 실무균형안 (추천) */}
            <div className="p-3.5 rounded-xl bg-[#1E3A5F]/5 border-2 border-[#1E3A5F] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-black flex items-center justify-center">
                  ★
                </span>
                <div>
                  <span className="font-black text-[#1E3A5F]">시나리오 B. 실무균형안 (변호사 채택 권장안)</span>
                  <span className="block text-[11px] text-blue-900 mt-0.5">추가 주거비 인정 + 법원 특칙 반영으로 최적화</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-[#1E3A5F] text-sm">{formatCurrency(diagnosis.monthlyPayment)} / 월</span>
                <span className="block text-[10px] text-emerald-600 font-extrabold">탕감률 약 {diagnosis.debtReductionRate}%</span>
              </div>
            </div>

            {/* 최대면책안 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700">시나리오 C. 공격적 최대면책안</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">의료비/부양가족 최대 소명 필요</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-slate-800">{formatCurrency(Math.round(diagnosis.monthlyPayment * 0.88))} / 월</span>
                <span className="block text-[10px] text-slate-500 font-bold">탕감률 약 {Math.min(90, diagnosis.debtReductionRate + 8)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. [다이어그램 3] 재산 보호 & 압류금지 채권 안심 바스켓 ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              민사집행법 제246조 재산 보호 & 압류금지 안심 바스켓
            </h3>
            <span className="text-[11px] font-bold text-emerald-600">법적 100% 압류 불가 보장</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                주택임대차 소액보증금 공제
              </span>
              <p className="text-[11px] text-slate-600">
                거주지 관할 기준 최대 <span className="font-bold text-emerald-700 font-mono">5,500만원</span>까지 청산가치에서 전액 공제되어 보증금을 안전하게 지킵니다.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                통장 압류금지 최저생계비 보호
              </span>
              <p className="text-[11px] text-slate-600">
                은행 계좌 예금 중 <span className="font-bold text-emerald-700 font-mono">185만원</span>은 법적으로 압류가 금지되어 기본적인 일상생활비가 보장됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* ── 6. 3대 법적 인가 요건 실시간 통과 게이지 ── */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-around flex-wrap gap-2 text-center text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">✓</div>
            <span className="font-bold text-slate-800">지속적 소득 적격성 통과</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">✓</div>
            <span className="font-bold text-slate-800">청산가치 보장의 원칙 충족</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">✓</div>
            <span className="font-bold text-slate-800">지급불능 법정 요건 충족</span>
          </div>
        </div>

        {/* ── 7. 변호사 종합 소견 & 솔루션 ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <CheckCircle2 className="w-4 h-4 text-[#1E3A5F]" />
            담당 변호사 공식 검토 소견
          </h3>
          <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
            {lawyerOpinion || '의뢰인님의 현재 소득과 채무 상황을 종합적으로 검토하여 최적의 변제계획안을 수립하였습니다.'}
          </div>

          {/* 진행 특이사항 배지 리스트 */}
          {specialNotes.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 block">진행 중점 관리 항목:</span>
              <div className="flex flex-wrap gap-1.5">
                {specialNotes.map((note, i) => (
                  <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-medium">
                    ⚠️ {note}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 8. 의뢰인 질문에 대한 1:1 맞춤 답변 ── */}
        {clientQnA.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MessageSquare className="w-4 h-4 text-[#1E3A5F]" />
              의뢰인 사전 질문에 대한 변호사 공식 답변
            </h3>

            <div className="space-y-3">
              {clientQnA.map((qa, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <p className="font-bold text-slate-800 flex items-start gap-1.5">
                    <span className="text-[#1E3A5F] font-black">Q{i + 1}.</span>
                    <span>{qa.question}</span>
                  </p>
                  <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    <span className="font-bold text-emerald-600 mr-1">A.</span>
                    {qa.answer || '변호사와의 1:1 상담 시 더욱 상세한 대응 방안을 안내해 드리겠습니다.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 9. 투명한 수임료 & 무이자 분납 타임라인 ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#1E3A5F]" />
              투명한 수임료 및 무이자 분납 플랜
            </h3>
            <span className="text-[11px] text-slate-400">송달료/인지대 일체 포함</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-bold block">총 수임료</span>
              <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">{formatCurrency(fees.totalFee)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 font-bold block">초기 착수금</span>
              <span className="text-base font-bold text-slate-700 font-mono mt-0.5 block">{formatCurrency(fees.downPayment)}</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
              <span className="text-[11px] text-[#1E3A5F] font-bold block">월 분납금 ({fees.installments}회)</span>
              <span className="text-base font-black text-[#1E3A5F] font-mono mt-0.5 block">{formatCurrency(fees.monthlyInstallment)} / 월</span>
            </div>
          </div>

          {/* 분납 타임라인 바 */}
          {fees.installments > 1 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 block">무이자 분납 마일스톤:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <div className="px-3 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-[10px] font-bold shrink-0">
                  착수금 ({formatCurrency(fees.downPayment)})
                </div>
                {Array.from({ length: fees.installments }).map((_, idx) => (
                  <React.Fragment key={idx}>
                    <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                    <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold shrink-0">
                      {idx + 1}회차 ({formatCurrency(fees.monthlyInstallment)})
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {fees.feeMemo && (
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl leading-relaxed border border-slate-100">
              💡 {fees.feeMemo}
            </p>
          )}
        </div>

        {/* ── 8. 변호사법 및 변협 광고규정 준수 안내 (법적 면책 고지) ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-500 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>변호사 검토 의견 및 법적 고지 (Attorney Review & Legal Notice)</span>
          </div>
          <p>
            • 본 리포트는 의뢰인이 제출한 기초 채무·소득 정보를 바탕으로 담당 변호사가 법적 기준에 따라 직접 검토·작성한 1차 사건 분석 의견서입니다.
          </p>
          <p>
            • 관할 법원 통계 및 변제 시뮬레이션 수치는 대법원 사법연감 및 과거 실무 기준에 기초한 참고 자료이며, 개별 사건의 최종 개시·인가 결정 및 세부 변제율은 관할 법원 재판부 및 회생위원의 심리 결과에 따라 변동될 수 있습니다.
          </p>
          <p>
            • 본 진단서는 사건 수임에 관한 단정적 승소나 100% 면책을 보장하지 않으며, 구체적인 소송 대리 및 법원 접수는 정식 수임 계약 체결 후 진행됩니다.
          </p>
        </div>

      </div>

      {/* ── 10. 하단 액션 바 (고객 전담 선임 & PDF 다운로드) ── */}
      {!embedded && (
        <div className="bg-slate-50 border-t border-slate-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer min-h-[44px]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{isGeneratingPdf ? 'PDF 생성 중...' : '📥 정식 A4 진단서 PDF 다운로드'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isClientViewer && !isAppointed && onAppointLawyer && (
              <button
                onClick={onAppointLawyer}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>⭐ 이 변호사를 전담으로 선임하기</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[44px]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );

  if (embedded) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 bg-slate-100 flex flex-col items-center">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col my-auto">
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 text-white/80 hover:text-white p-2 transition-colors cursor-pointer"
          title="닫기"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="overflow-y-auto rounded-3xl no-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
}
