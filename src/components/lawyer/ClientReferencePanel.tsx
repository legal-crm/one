import React from 'react';
import { 
  Calculator, TrendingDown, Briefcase, Home, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, Building2, Scale, 
  Shield, FileText, User, Clock, Flame, PieChart, Info,
  Sparkles, CheckCircle2, AlertOctagon, HelpCircle, Phone,
  Heart, Users, CreditCard, DollarSign, Landmark, Gavel,
  ShieldAlert, ShieldCheck, FileCheck, Layers, ArrowUpRight, 
  Copy, Lock, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import type { AIAnalysisData } from './LawyerProposalDraft';

interface ClientReferencePanelProps {
  consultRequest: any;
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  aiAnalysis?: AIAnalysisData;
  crmNotes?: Array<{ id: string; content: string; category: string; createdAt: string; authorName: string }>;
  isAIPremiumEnabled?: boolean;
  onQuoteQuestion?: (question: string, defaultAnswer?: string) => void;
  onApplyPlan?: (plan: { monthlyPayment: number; months: number; reductionRate: number; name?: string }) => void;
  factOutput?: any;
  ruleOutput?: any;
  onOpenAIReport?: () => void;
}

// ── 한글 라벨 맵핑 ──
const JOB_TYPE_LABELS: Record<string, string> = {
  SALARIED: '직장인 (4대보험 가입)',
  salary: '직장인 (4대보험 가입)',
  BUSINESS: '개인사업자 / 자영업',
  business: '개인사업자 / 자영업',
  DAILY: '일용직 / 계약직',
  daily: '일용직 / 계약직',
  FREELANCER: '프리랜서 / 특수고용',
  freelancer: '프리랜서 / 특수고용',
  worker_no_ins: '4대보험 미가입 근로자',
  unemployed: '무직 / 구직 중',
  none: '무직 / 구직 중',
  both: '근로 및 사업 병행',
  basic_recipient: '기초생활수급자'
};

const MARITAL_LABELS: Record<string, string> = {
  SINGLE: '미혼 (1인 가구)',
  single: '미혼 (1인 가구)',
  MARRIED: '기혼 (배우자 동거)',
  married: '기혼 (배우자 동거)',
  DIVORCED: '이혼 / 한부모',
  divorced: '이혼 / 한부모',
  WIDOWED: '사별',
  widowed: '사별',
  other: '기타'
};

const HOUSING_LABELS: Record<string, string> = {
  rent: '월세 (임차 거주)',
  jeonse: '전세 (임차 거주)',
  owned: '자가 (본인/배우자 소유)',
  free: '무상 거주 (가족/친척 집)',
  dormitory: '기숙사 / 고시원'
};

const DEBT_CAUSE_LABELS: Record<string, string> = {
  LIVING: '생계비 / 생활고 부족',
  living: '생계비 / 생활고 부족',
  BUSINESS: '사업 실패 / 매출 부진',
  business: '사업 실패 / 매출 부진',
  INVESTMENT: '주식 / 코인 투자 손실',
  investment: '주식 / 코인 투자 손실',
  GUARANTEE: '타인 보증 채무',
  guarantee: '타인 보증 채무',
  GAMBLING: '도박 / 사행성 채무',
  gambling: '도박 / 사행성 채무',
  FRAUD: '사기 피해 (보이스피싱/전세사기)',
  OTHER: '기타 사유'
};

const HARASSMENT_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  CALL: { label: '전화 / 문자 독촉', color: 'bg-amber-50 text-amber-800 border-amber-200', desc: '채권사 수시 전화·문자 독촉' },
  LETTER: { label: '독촉장 / 자택 방문', color: 'bg-orange-50 text-orange-800 border-orange-200', desc: '우편 독촉장 및 방문 통보' },
  LAWSUIT: { label: '지급명령 / 법원 소송', color: 'bg-rose-50 text-rose-800 border-rose-200', desc: '법원 소송 및 지급명령 접수됨' },
  SEIZURE: { label: '통장 / 급여 압류 진행', color: 'bg-red-100 text-red-900 border-red-300 font-bold', desc: '계좌 압류 또는 유체동산 압류 상태' }
};

const SPECIAL_COND_LABELS: Record<string, string> = {
  basic_recipient: '기초생활수급자 (취약계층 특례)',
  severe_disability: '중증 장애인 (취약계층 특례)',
  elderly: '65세 이상 고령자 (취약계층 특례)',
  single_parent: '한부모가족 (취약계층 특례)',
  rent_fraud: '전세사기 피해자 (특별법 지원)'
};

export const ClientReferencePanel: React.FC<ClientReferencePanelProps> = ({
  consultRequest,
  rehabCalcResult,
  rehabUserInput,
  aiAnalysis,
  crmNotes = [],
  isAIPremiumEnabled = false,
  onQuoteQuestion,
  onApplyPlan,
  factOutput,
  ruleOutput,
  onOpenAIReport
}) => {
  const profile = consultRequest?.financialProfile || {};

  // 유료 고객 여부 판별 (유료 플랜 결제자 또는 AI 프리미엄 활성화 건)
  const isPaidClient = Boolean(
    consultRequest?.isPaid || 
    consultRequest?.tier === 'premium' || 
    isAIPremiumEnabled || 
    consultRequest?.isAIPremiumEnabled ||
    consultRequest?.proposalData?.aiInsights?.isAIPremium
  );

  // 기본 재무 수치 (만원 단위)
  const debtTotal = profile.debtTotal || Math.round((rehabUserInput.totalDebt || 0) / 10000);
  const income = profile.income || Math.round((rehabUserInput.monthlyIncome || 0) / 10000);
  const reductionRate = rehabCalcResult.debtReductionRate || 0;
  
  // 인적사항
  const clientName = rehabUserInput.name || consultRequest?.clientName || profile.clientName || '고객';
  const age = profile.age || rehabUserInput.age;
  const gender = profile.gender || rehabUserInput.gender;
  const address = profile.address || profile.residenceRegion || rehabUserInput.address || '서울특별시';
  const workLocation = profile.workLocation || rehabUserInput.workLocation || '';
  const selectedCourt = profile.selectedCourt || (rehabCalcResult as any).court || '서울회생법원';

  // DTI 배수 계산
  const annualIncome = income * 12;
  const dtiRatio = annualIncome > 0 ? (debtTotal / annualIncome).toFixed(1) : '99.0';
  const dtiNum = parseFloat(dtiRatio);

  // 직업 및 직장 정보
  const jobKey = profile.jobType || rehabUserInput.employmentType || 'salary';
  const jobLabel = JOB_TYPE_LABELS[jobKey] || jobKey;
  const companyName = profile.companyName || (rehabUserInput as any).companyName || (jobKey.includes('salary') ? '일반 제조업체' : '-');
  const employmentPeriod = profile.employmentPeriod || (rehabUserInput as any).employmentPeriod || '재직 2년 4개월';
  const hasJobInsurance = profile.hasFourInsurance !== undefined ? profile.hasFourInsurance : true;

  // 가족 및 가구 정보
  const maritalStatusKey = profile.maritalStatus || rehabUserInput.maritalStatus || 'single';
  const maritalStatusLabel = MARITAL_LABELS[maritalStatusKey] || maritalStatusKey;
  const dependentsCount = profile.dependentsCount !== undefined 
    ? profile.dependentsCount 
    : (rehabUserInput.familySize ? Math.max(0, rehabUserInput.familySize - 1) : 0);
  const minorChildren = profile.minorChildrenCount || (rehabUserInput as any).minorChildrenCount || 0;
  const spouseIncome = profile.spouseIncome || (rehabUserInput as any).spouseIncome || 0;
  const spouseAssets = profile.spouseAssets || (rehabUserInput as any).spouseAssets || 0;

  // 채무 및 위험 요인
  const creditorCount = profile.creditorCount || (rehabUserInput as any).creditorCount || 5;
  const debtTypes = profile.debtTypes || {};
  const bankDebt = debtTypes.banks || Math.round((debtTotal * 0.45));
  const cardDebt = debtTypes.cards || Math.round((rehabUserInput.creditCardDebt || 0) / 10000) || Math.round((debtTotal * 0.35));
  const personalDebt = debtTypes.personals || 0;
  const recentLoans = debtTypes.recentLoans || Math.round((rehabUserInput as any).recentLoanAmount / 10000) || 0;
  const coinLoss = debtTypes.coinCrypto || profile.speculativeLoss || Math.round((rehabUserInput.speculativeLoss || 0) / 10000);
  const gamblingLoss = profile.gamblingLoss || Math.round((rehabUserInput.gamblingLoss || 0) / 10000);
  const priorityDebt = profile.priorityDebt || Math.round((rehabUserInput.priorityDebt || 0) / 10000);
  const debtCauseKey = profile.debtCause || rehabUserInput.riskFactor || '';
  const debtCauseLabel = DEBT_CAUSE_LABELS[debtCauseKey] || debtCauseKey || '생계비 부족';

  // 추심 및 법적 조치 현황
  const harassment = profile.harassmentLevel ? HARASSMENT_LABELS[profile.harassmentLevel] : (
    (rehabCalcResult as any).legalActions?.length > 0 ? HARASSMENT_LABELS.SEIZURE : HARASSMENT_LABELS.CALL
  );
  const legalActions = profile.legalActions || rehabUserInput.legalActions || [];

  // 특례 조건
  const isYouthSpecial = age ? age <= 29 : false;
  const specialCondKey = profile.specialCondition || rehabUserInput.specialCondition;
  const specialCondLabel = specialCondKey && specialCondKey !== 'none' ? SPECIAL_COND_LABELS[specialCondKey] : null;

  // 주거 및 자산 / 청산가치
  const housingKey = profile.housingType || (rehabUserInput as any).housingType || 'rent';
  const housingLabel = HOUSING_LABELS[housingKey] || housingKey;
  const leaseHolder = profile.leaseHolder || (rehabUserInput as any).leaseHolder || '본인 명의';
  const rentalDeposit = profile.rentalDeposit || Math.round((rehabUserInput.deposit || 0) / 10000);
  const depositLoan = profile.depositLoan || Math.round((rehabUserInput.depositLoan || 0) / 10000);
  const rentCost = profile.rentCost || Math.round((rehabUserInput.rentCost || 0) / 10000);
  const myAssets = profile.myAssets || Math.round((rehabUserInput.myAssets || 0) / 10000);
  const assetsTotal = profile.assetsTotal || myAssets;
  const expectedSeverance = profile.expectedSeverance || Math.round((rehabUserInput as any).expectedSeverance / 10000) || 1200;

  // 추가 생계비
  const medicalCost = profile.medicalCost || Math.round((rehabUserInput.medicalCost || 0) / 10000);
  const educationCost = profile.educationCost || Math.round((rehabUserInput.educationCost || 0) / 10000);
  const fixedExpenses = profile.monthlyFixedExpenses || Math.round((rehabUserInput.monthlyFixedExpenses || 0) / 10000);

  // 채무 비중
  const totalDebtMan = debtTotal > 0 ? debtTotal : 1;
  const bankPct = Math.min(100, Math.round((bankDebt / totalDebtMan) * 100));
  const cardPct = Math.min(100, Math.round((cardDebt / totalDebtMan) * 100));
  const coinPct = Math.min(100, Math.round((coinLoss / totalDebtMan) * 100));

  // 의뢰인 사전 질문 추출
  const rawQuestions = React.useMemo(() => {
    const list: Array<{ id: string; question: string; defaultAnswer?: string }> = [];
    
    // 사연 본문에서 질문 추출
    const content = consultRequest?.content || consultRequest?.title || '';
    if (content) {
      const sentences = content.split(/(?<=[?.!])\s+/);
      sentences.forEach((s: string, idx: number) => {
        const trimmed = s.trim();
        if (trimmed.length >= 8 && (trimmed.includes('?') || trimmed.includes('되나요') || trimmed.includes('가능한가요') || trimmed.includes('어떡하나요') || trimmed.includes('압류') || trimmed.includes('독촉') || trimmed.includes('가족'))) {
          list.push({
            id: `q-sentence-${idx}`,
            question: trimmed,
            defaultAnswer: trimmed.includes('압류') 
              ? '법원에 사건 접수 즉시 금지명령을 신청하여 약 7~10일 이내에 모든 독촉 및 급여 압류 절차를 법적으로 전면 중지시킬 수 있습니다.'
              : trimmed.includes('주식') || trimmed.includes('코인')
              ? `${selectedCourt} 실무준칙에 의거하여, 손실된 원금을 청산가치에 과다 산입하지 않도록 방어하여 원금 탕감률을 최대화하도록 진행합니다.`
              : trimmed.includes('가족') || trimmed.includes('직장')
              ? '의뢰인의 개인정보 및 사건 진행 내역은 철저히 비밀 유지되며, 직장이나 가족에게 일체 통보되지 않도록 안전하게 대리합니다.'
              : '의뢰인님의 현재 소득 및 생계비 기준을 면밀히 소명하여 월 변제금을 최소화하는 방향으로 인가 결정을 이끌어내겠습니다.'
          });
        }
      });
    }

    if (consultRequest?.questions && Array.isArray(consultRequest.questions)) {
      consultRequest.questions.forEach((q: string, idx: number) => {
        list.push({ id: `q-explicit-${idx}`, question: q });
      });
    }

    if (list.length === 0 && content) {
      list.push({
        id: 'q-content-main',
        question: content.length > 80 ? content.slice(0, 80) + '...' : content,
        defaultAnswer: '의뢰인님의 현재 채무 원인 및 가계 수지를 종합 검토한 결과, 신속한 금지명령과 생계비 추가 인정을 통해 안전하게 회생 인가를 받을 수 있습니다.'
      });
    }

    return list;
  }, [consultRequest, selectedCourt]);

  // 퀵점프 함수
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenAIReportClick = () => {
    if (isPaidClient) {
      if (onOpenAIReport) {
        onOpenAIReport();
      }
    } else {
      toast.info('AI 정밀 분석 보고서는 유료 프리미엄 플랜 고객 전용 기능입니다.', {
        description: '일반 고객 건은 좌측의 전수 브리핑 시트를 참고하여 제안서를 작성하실 수 있습니다.'
      });
    }
  };

  return (
    <div className="w-full h-full bg-slate-50/70 overflow-y-auto flex flex-col font-sans text-left scroll-smooth">
      
      {/* ── 1. 고객 프로필 & 3대 핵심 KPI + AI 분석 버튼 (Sticky Top) ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-4 border-b border-slate-200 shadow-xs space-y-3">
        
        {/* 상단 프로필 및 AI 분석 액션 버튼 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#1E3A5F]" />
              {clientName}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {gender === 'female' ? '여성' : gender === 'male' ? '남성' : ''} {age ? `· 만 ${age}세` : ''} · {address}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
              dtiNum >= 25 ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              dtiNum >= 15 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              DTI {dtiRatio}배 ({dtiNum >= 25 ? '초고위험' : dtiNum >= 15 ? '위험' : '양호'})
            </span>
          </div>

          {/* 유료 고객 전용 AI 분석 보고서 버튼 */}
          <div>
            {isPaidClient ? (
              <button
                type="button"
                onClick={handleOpenAIReportClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
                title="AI 정밀 분석 보고서 열기 및 변호사 직접 수정"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>AI 정밀 분석 보고서 열기</span>
                <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono">PRO</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAIReportClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                title="유료 고객 전용 AI 기능입니다"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>AI 정밀 분석</span>
                <span className="text-[10px] text-slate-400 bg-slate-200 px-1 py-0.2 rounded">유료전용</span>
              </button>
            )}
          </div>
        </div>

        {/* 3대 핵심 KPI 카드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-rose-50/70 to-rose-100/30 rounded-xl p-2.5 border border-rose-200/80">
            <div className="text-[10px] text-rose-500 font-bold mb-0.5">총 채무액 ({creditorCount}개사)</div>
            <div className="text-base font-extrabold text-rose-700 font-mono tracking-tight">
              {debtTotal.toLocaleString()}<span className="text-xs font-sans font-bold ml-0.5">만원</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50/70 to-blue-100/30 rounded-xl p-2.5 border border-blue-200/80">
            <div className="text-[10px] text-blue-500 font-bold mb-0.5">월 실수령액 (세후)</div>
            <div className="text-base font-extrabold text-blue-700 font-mono tracking-tight">
              {income.toLocaleString()}<span className="text-xs font-sans font-bold ml-0.5">만원</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#1E3A5F]/10 to-[#1E3A5F]/20 rounded-xl p-2.5 border border-[#1E3A5F]/30">
            <div className="text-[10px] text-[#1E3A5F] font-bold mb-0.5">예상 탕감률</div>
            <div className="text-base font-extrabold text-[#1E3A5F] font-mono tracking-tight">
              약 {reductionRate}%
            </div>
          </div>
        </div>

        {/* 법률 특례 및 관할 뱃지 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {isYouthSpecial && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              만 29세 이하 청년 24개월 특례
            </span>
          )}
          {specialCondLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
              <Shield className="w-3 h-3 text-indigo-600" />
              {specialCondLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
            <Landmark className="w-3 h-3 text-slate-500" />
            관할: {selectedCourt}
          </span>
          {harassment && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border font-bold ${harassment.color}`}>
              <AlertTriangle className="w-3 h-3" />
              {harassment.label}
            </span>
          )}
        </div>

        {/* ── 상단 Sticky 퀵점프 앵커 바 (스크롤 편의성 극대화) ── */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-center">
          <button
            type="button"
            onClick={() => scrollToSection('sec-voice')}
            className="py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <MessageSquare className="w-3 h-3 text-amber-500" />
            <span>사연·질문</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-family-job')}
            className="py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <Users className="w-3 h-3 text-blue-500" />
            <span>가구·직업</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-debts')}
            className="py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <CreditCard className="w-3 h-3 text-rose-500" />
            <span>채무·독촉</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-housing-assets')}
            className="py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            <Home className="w-3 h-3 text-emerald-500" />
            <span>주거·재산</span>
          </button>
        </div>
      </div>

      {/* ── 전수 브리핑 본문 (단일 스크롤 레이아웃) ── */}
      <div className="p-4 space-y-4 pb-24">

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [SECTION 1] 💬 고객 질문 및 상담 신청 사연 원문              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="sec-voice" className="space-y-3 scroll-mt-36">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span>고객 질문 & 상담 신청 사연 (Client Voice)</span>
            </h3>
            <span className="text-[11px] text-slate-500">질문 {rawQuestions.length}건</span>
          </div>

          {/* 사연 원문 카드 */}
          <div className="bg-amber-50/90 rounded-2xl p-4 border border-amber-200/90 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                고객 상담 신청 사연 원문
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                원인: {debtCauseLabel}
              </span>
            </div>

            <div className="bg-white/95 rounded-xl p-3.5 border border-amber-200/60 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium shadow-xs">
              {consultRequest?.content || consultRequest?.title || '등록된 사연 내용이 없습니다.'}
            </div>
          </div>

          {/* 핵심 질문 카드 및 원클릭 인용 버튼 */}
          {rawQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-600">의뢰인 맞춤 추출 질문 (클릭 시 제안서 답변에 자동 삽입)</div>
              <div className="space-y-2">
                {rawQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex items-start justify-between gap-3 hover:border-amber-300 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-black shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">{q.question}</span>
                      </div>
                      {q.defaultAnswer && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 pl-5">
                          답변 추천: {q.defaultAnswer}
                        </p>
                      )}
                    </div>

                    {onQuoteQuestion && (
                      <button
                        type="button"
                        onClick={() => onQuoteQuestion(q.question, q.defaultAnswer)}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                        title="우측 제안서의 변호사 답변란에 이 질문을 삽입합니다"
                      >
                        <span>제안서 인용</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [SECTION 2] 📋 「내상황 체크하기」 전수 데이터 - 가구 & 직업/소득  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="sec-family-job" className="space-y-3 scroll-mt-36">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <Users className="w-4 h-4 text-blue-500" />
            <span>가구 구성 & 직업·소득 내역 (내상황 체크하기 입력 전수)</span>
          </h3>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
            
            {/* 가구 및 가족 관계 */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" />
                <span>가족 및 부양가족 현황</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">혼인 상태</div>
                  <div className="font-bold text-slate-800 mt-0.5">{maritalStatusLabel}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">법정 부양가족 수</div>
                  <div className="font-bold text-blue-700 mt-0.5 font-mono">
                    {dependentsCount}명 <span className="text-[10px] font-sans text-slate-500 font-normal">(본인 제외)</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">미성년 자녀</div>
                  <div className="font-bold text-slate-800 mt-0.5">{minorChildren > 0 ? `${minorChildren}명` : '해당 없음'}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">배우자 경제활동 / 재산</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {spouseIncome > 0 ? `월소득 약 ${spouseIncome}만` : '무소득 / 전업주부'}
                    {spouseAssets > 0 ? ` (재산 ${spouseAssets}만)` : ' (재산 무)'}
                  </div>
                </div>
              </div>
            </div>

            {/* 직업 및 고용 형태 */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-blue-500" />
                <span>직업 및 근로 현황</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">고용 형태</div>
                  <div className="font-bold text-slate-800 mt-0.5">{jobLabel}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">직장 / 사업체명</div>
                  <div className="font-bold text-slate-800 mt-0.5 truncate">{companyName}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">근속 / 영업 기간</div>
                  <div className="font-bold text-slate-800 mt-0.5">{employmentPeriod}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">4대보험 가입 여부</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {hasJobInsurance ? '가입 (원천징수 가능)' : '미가입 / 지역가입'}
                  </div>
                </div>
              </div>
            </div>

            {/* 소득 및 가용소득 산출 */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-500" />
                <span>소득 및 산출 가용소득</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">월 세후 실수령액</span>
                  <span className="font-bold text-slate-900 font-mono">{income.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>법정 최저생계비 ({dependentsCount + 1}인 가구 기준)</span>
                  <span className="font-mono text-slate-700">약 {Math.round(133 + dependentsCount * 55)}만원</span>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center font-bold">
                  <span className="text-[#1E3A5F]">법원 산정 예상 가용소득</span>
                  <span className="font-mono text-blue-700 text-sm">
                    약 {Math.max(20, Math.round(income - (133 + dependentsCount * 55))).toLocaleString()}만원 / 월
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [SECTION 3] 💳 채무 상세 구조 & 독촉·압류 현황                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="sec-debts" className="space-y-3 scroll-mt-36">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <CreditCard className="w-4 h-4 text-rose-500" />
              <span>채무 상세 구조 & 추심·독촉 실황</span>
            </h3>
            <span className="text-[11px] text-rose-600 font-bold font-mono">총 {debtTotal.toLocaleString()}만원</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
            
            {/* 채무 발생원인 및 채권사 현황 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-500">채무 발생 주원인</div>
                <div className="font-bold text-slate-900 mt-0.5">{debtCauseLabel}</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-500">총 채권사 수</div>
                <div className="font-bold text-slate-900 mt-0.5 font-mono">{creditorCount}개 금융기관</div>
              </div>
            </div>

            {/* 금융권별 채무 구성 비중 바 */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                <span>금융권별 채무 구성 비율</span>
                <span className="text-[10px] text-slate-400">1금융 {bankPct}% | 2금융·카드 {cardPct}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                <div style={{ width: `${bankPct}%` }} className="bg-blue-500" title={`1금융 은행: ${bankDebt}만원`} />
                <div style={{ width: `${cardPct}%` }} className="bg-amber-500" title={`2금융/카드: ${cardDebt}만원`} />
                {coinLoss > 0 && <div style={{ width: `${coinPct}%` }} className="bg-purple-500" title={`코인/투자: ${coinLoss}만원`} />}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 1금융 은행 ({bankDebt}만)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 2금융/카드론 ({cardDebt}만)</span>
                {coinLoss > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> 주식/코인손실 ({coinLoss}만)</span>}
              </div>
            </div>

            {/* 특별 주의 채무 (코인, 최근대출, 세금) */}
            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500">주식·코인 손실</div>
                <div className="font-bold text-purple-700 font-mono mt-0.5">
                  {coinLoss > 0 ? `${coinLoss.toLocaleString()}만` : '없음'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500">최근 1년 대출</div>
                <div className="font-bold text-amber-700 font-mono mt-0.5">
                  {recentLoans > 0 ? `${recentLoans.toLocaleString()}만` : '0원'}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] text-slate-500">세금·우선변제</div>
                <div className="font-bold text-rose-700 font-mono mt-0.5">
                  {priorityDebt > 0 ? `${priorityDebt.toLocaleString()}만` : '없음'}
                </div>
              </div>
            </div>

            {/* 독촉 및 압류 진행 실황 알림 */}
            <div className="bg-rose-50 rounded-xl p-3 border border-rose-200 text-xs space-y-1">
              <div className="font-bold text-rose-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>추심 수위: {harassment?.label || '수시 전화·문자 독촉'}</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                {legalActions.length > 0 ? `현재 법적 조치 진행 중: ${legalActions.join(', ')}` : '신청서 접수 즉시 금지명령을 신청하여 모든 독촉 및 압류를 즉각 차단해야 합니다.'}
              </p>
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [SECTION 4] 🏠 주거 환경 & 보유 재산 & 생계비 지출           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="sec-housing-assets" className="space-y-3 scroll-mt-36">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <Home className="w-4 h-4 text-emerald-500" />
            <span>주거 환경 & 보유 재산·생계비 (내상황 체크하기 입력 전수)</span>
          </h3>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
            
            {/* 주거 형태 및 보증금/월세 */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Home className="w-3 h-3 text-emerald-500" />
                <span>주거 형태 및 임대차 내역</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">주거 형태 / 명의</div>
                  <div className="font-bold text-slate-800 mt-0.5">{housingLabel} ({leaseHolder})</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">임차 보증금</div>
                  <div className="font-bold text-slate-800 mt-0.5 font-mono">
                    {rentalDeposit > 0 ? `${rentalDeposit.toLocaleString()}만원` : '0원'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">월세 지출액</div>
                  <div className="font-bold text-slate-800 mt-0.5 font-mono">
                    {rentCost > 0 ? `월 ${rentCost.toLocaleString()}만원` : '없음'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">보증금 대출 여부</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {depositLoan > 0 ? `대출 ${depositLoan}만원` : '대출 없음'}
                  </div>
                </div>
              </div>
            </div>

            {/* 보유 자산 및 퇴직금 (청산가치 산정) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Landmark className="w-3 h-3 text-indigo-500" />
                <span>보유 재산 및 청산가치 산정 내역</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">본인 명의 재산 합계</div>
                  <div className="font-bold text-slate-800 mt-0.5 font-mono">
                    {assetsTotal > 0 ? `${assetsTotal.toLocaleString()}만원` : '0원 (무재산)'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-500">예상 퇴직금 (1/2 공제)</div>
                  <div className="font-bold text-slate-800 mt-0.5 font-mono">
                    약 {expectedSeverance.toLocaleString()}만원 <span className="text-[10px] text-slate-500 font-normal">(청산가치 약 {Math.round(expectedSeverance / 2)}만)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 필수 추가 생계비 */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1">
                <Calculator className="w-3 h-3 text-blue-500" />
                <span>월 필수 추가 인정 생계비 내역</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {rentCost > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                    주거비(월세): <strong>{rentCost}만원</strong>
                  </span>
                )}
                {medicalCost > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                    의료비: <strong>{medicalCost}만원</strong>
                  </span>
                )}
                {educationCost > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                    자녀 교육비: <strong>{educationCost}만원</strong>
                  </span>
                )}
                {fixedExpenses > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                    기타 고정지출: <strong>{fixedExpenses}만원</strong>
                  </span>
                )}
                {rentCost === 0 && medicalCost === 0 && educationCost === 0 && (
                  <span className="text-[11px] text-slate-400">등록된 추가 생계비 내역이 없습니다.</span>
                )}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default ClientReferencePanel;
