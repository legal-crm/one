import React, { useState, useMemo } from 'react';
import { 
  X, Users, Briefcase, Home, AlertTriangle, 
  FileText, CheckCircle2, ShieldAlert, Sparkles, 
  Copy, ChevronRight, FileCheck2, Printer, 
  Scale
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../types';
import { detectClientIncomeType } from '../../utils/incomeTypeHelper';

interface ClientIntakeDetailModalProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onClose: () => void;
  onOpenProposalDraft?: () => void;
}

type TabType = 'all' | 'personal' | 'income' | 'debt' | 'asset' | 'story';

export default function ClientIntakeDetailModal({
  clientRequest,
  crmExt,
  onClose,
  onOpenProposalDraft,
}: ClientIntakeDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fp: any = clientRequest.financialProfile || {};
  const incomeTypeInfo = useMemo(() => {
    return detectClientIncomeType(fp, crmExt?.incomeExpenseD5103, clientRequest);
  }, [fp, crmExt, clientRequest]);

  // 1. 기본 인적 & 가족 정보
  const clientName = clientRequest.clientName || fp.clientName || '의뢰인';
  const age = fp.age || (fp.birthDate ? 2026 - parseInt(fp.birthDate.split('-')[0]) : null);
  const gender = fp.gender === 'male' ? '남성' : fp.gender === 'female' ? '여성' : (fp.gender || '미기재');
  const birthDate = fp.birthDate || (age ? `${2026 - age}년생 (만 ${age}세)` : '-');
  const phone = clientRequest.phone || fp.phoneNumber || '미공개';
  const residence = fp.residenceRegion || fp.address || fp.residence || clientRequest.region || '미기재';
  const workLocation = fp.workLocation || fp.workplace || fp.companyName || '미기재';
  const courtName = fp.selectedCourt || clientRequest.court || crmExt?.courtCase?.courtName || '서울회생법원';

  // 가족
  const maritalStatusMap: Record<string, string> = {
    SINGLE: '미혼 (1인 가구)',
    single: '미혼 (1인 가구)',
    MARRIED: '기혼 (배우자 동거)',
    married: '기혼 (배우자 동거)',
    DIVORCED: '이혼 (단독/한부모)',
    divorced: '이혼 (단독/한부모)',
    divorced_receiving: '이혼 (양육비 수령 중)',
    divorced_sending: '이혼 (양육비 지급 중)',
    WIDOWED: '사별',
    widowed: '사별',
    other: '기타'
  };
  const maritalStatusText = maritalStatusMap[fp.maritalStatus] || fp.maritalStatus || '미기재';
  const minorChildren = fp.minorChildren || 0;
  const otherDependents = fp.otherDependents || 0;
  const totalDependents = fp.dependents || (minorChildren + otherDependents);
  const familySize = fp.familySize || (totalDependents + 1);

  // 특수 조건
  const specialCondMap: Record<string, string> = {
    basic_recipient: '기초생활수급자 (취약계층 특례)',
    severe_disability: '중증 장애인 (취약계층 특례)',
    elderly: '65세 이상 고령자 (취약계층 특례)',
    single_parent: '한부모 가족 (취약계층 특례)',
    rent_fraud: '전세사기 피해자 (특별법 지원 대상)',
    youth: '만 29세 이하 청년특례 (24개월 단기변제)',
    none: '일반 대상'
  };
  const isYouth = (age && age <= 29);
  const specialConditionKey = fp.specialCondition || (isYouth ? 'youth' : 'none');
  const specialConditionText = specialCondMap[specialConditionKey] || (isYouth ? '만 29세 이하 청년특례 유력' : '일반 대상');

  // 2. 소득 및 생계비 지출
  const income = fp.income || 0;
  const spouseIncome = fp.spouseIncome || 0;
  const monthlyRent = fp.rentCost || fp.monthlyRent || 0;
  const medicalCost = fp.extraLivingCost?.medical || fp.monthlyMedical || 0;
  const educationCost = fp.extraLivingCost?.education || fp.monthlyEducation || 0;
  const specialEducationCost = fp.extraLivingCost?.specialEducation || 0;
  const hasRecentJobChange = !!fp.hasRecentJobChange;

  // 인정 생계비 및 가용소득
  const depCount = totalDependents || 0;
  const minLivingCost = depCount === 0 ? 133 : depCount === 1 ? 220 : depCount === 2 ? 282 : 343;
  const recognizedLiving = fp.recognizedLivingCost ? Math.round(fp.recognizedLivingCost / 10000) : minLivingCost;
  const monthlyDisposable = Math.max(0, income - recognizedLiving);

  // 3. 주거 및 자산
  const housingTypeMap: Record<string, string> = {
    rent: '월세 (임차 거주)',
    jeonse: '전세 (임차 거주)',
    owned: '자가 (본인/배우자 소유)',
    free: '무상 거주 (가족/친척 집)',
    dormitory: '기숙사 / 고시원'
  };
  const housingTypeText = housingTypeMap[fp.housingType] || fp.housingType || '임차(전/월세)';
  const rentalDeposit = fp.rentalDeposit || fp.deposit || 0;
  const depositLoan = fp.depositLoan || 0;
  const housingContractHolder = fp.housingContractHolder === 'spouse' ? '배우자 명의' : fp.housingContractHolder === 'others' ? '가족/타인 명의' : '본인 명의';
  const spouseAsset = fp.spouseAsset || fp.spouseAssets || 0;
  const retirementPay = fp.retirementPay || 0;
  const retirementPensionTypeMap: Record<string, string> = {
    pension: '퇴직연금 가입 (압류금지 채권, 청산가치 제외 0%)',
    none: '퇴직연금 미가입 (일반퇴직금, 청산가치 50% 반영)',
    unknown: '퇴직연금 가입여부 모름 (확인 필요, 실무 50% 반영)'
  };
  const retirementPensionText = retirementPensionTypeMap[fp.retirementPensionType] || (retirementPay > 0 ? '일반 퇴직금' : '해당 없음');
  const assetsTotal = fp.assetsTotal || 0;
  const individualAssets = fp.assets || [];

  // 4. 채무 구성 및 위험도
  const debtTotal = fp.debtTotal || 0;
  const creditorCount = fp.creditorCount || (fp.debts ? fp.debts.length : 0) || 4;
  const banks = fp.debtTypes?.banks || 0;
  const cards = fp.debtTypes?.cards || 0;
  const personals = fp.debtTypes?.personals || 0;
  const recentLoans = fp.debtTypes?.recentLoans || (fp.debts ? fp.debts.filter((d: any) => d.isRecent).reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0) : 0);
  const coinCrypto = fp.debtTypes?.coinCrypto || fp.speculativeLoss || fp.gamblingLoss || 0;
  const priorityDebt = fp.priorityDebt || (fp.debts ? fp.debts.find((d: any) => d.type === 'tax')?.amount || 0 : 0);
  const speculativeLoss = fp.speculativeLoss || 0;
  const gamblingLoss = fp.gamblingLoss || 0;

  const debtCauseMap: Record<string, string> = {
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
  const debtCauseText = debtCauseMap[fp.debtCause] || (speculativeLoss > 0 ? '주식/코인 투자 손실' : gamblingLoss > 0 ? '도박 채무' : '생계비 / 생활고 부족');

  // DTI
  const dtiRatio = income > 0 ? (debtTotal / income).toFixed(1) : '-';

  // 회생 실무 계산 (36개월 기준)
  const repaymentMonths = isYouth ? 24 : 36;
  const totalRepayment = monthlyDisposable * repaymentMonths;
  const expectedReliefPercent = debtTotal > 0 ? Math.max(0, Math.min(100, Math.round((1 - (totalRepayment / debtTotal)) * 100))) : 0;
  const expectedReliefAmount = Math.max(0, debtTotal - totalRepayment);
  const liquidationCheckPassed = totalRepayment >= assetsTotal;

  // 법적 조치 현황
  const legalActionLabels: Record<string, string> = {
    collection_call: '독촉 전화 및 문자',
    court_order: '지급명령 / 법원 소장 수령',
    seizure: '통장 계좌 및 급여 압류',
    property_seizure: '부동산 가압류',
    credit_drop: '신용점수 급락 통보',
    none: '현재 진행 중인 법적 조치 없음'
  };
  const legalActions: string[] = fp.legalActions || [];

  // 5. 의뢰인 전달 사연 및 메모
  const title = clientRequest.title || '자가진단 상담 신청서';
  const content = clientRequest.content || '';
  const clientNotes: string[] = fp.clientNotes || (fp.clientNote ? [fp.clientNote] : []);

  // 전체 요약문 클립보드 복사
  const handleCopySummary = () => {
    const summaryText = `[${clientName}님 자가진단 종합 팩트시트]
• 성별/나이: ${gender} / 만 ${age || '-'}세 (${residence} • 관할: ${courtName})
• 소득 구분: ${incomeTypeInfo.label} (세후 월 ${income.toLocaleString()}만원)
• 최저 생계비: ${recognizedLiving.toLocaleString()}만원 (부양가족 ${totalDependents}명)
• 월 가용소득: ${monthlyDisposable.toLocaleString()}만원 (${repaymentMonths}개월 변제 총액: ${totalRepayment.toLocaleString()}만원)
• 총 채무: ${debtTotal.toLocaleString()}만원 (채권자 ${creditorCount}곳 / DTI: ${dtiRatio}배)
• 원금 감면율 추정: 약 ${expectedReliefPercent}% (약 ${expectedReliefAmount.toLocaleString()}만원 감면)
• 금융권 비중: 은행 ${banks}만 / 카드 ${cards}만 / 사채·세금 ${personals}만
• 특이 채무: 최근 대출 ${recentLoans}만 / 코인·도박 ${coinCrypto}만 / 우선세금 ${priorityDebt}만
• 총 자산(청산가치): ${assetsTotal.toLocaleString()}만원 (보증금 ${rentalDeposit}만, 퇴직금 ${retirementPay}만)
• 청산가치 보장 여부: ${liquidationCheckPassed ? '36개월 변제금으로 충족' : '총자산 초과 (보증금 공제 확인 or 60개월 검토)'}
• 부양가족: 미성년 ${minorChildren}명 / 총 ${totalDependents}명 부양
• 법적조치: ${legalActions.length > 0 ? legalActions.map(a => legalActionLabels[a] || a).join(', ') : '진행 중인 강제집행 없음'}
• 상담 제목: ${title}
• 상담 내용 요약: ${content}`;

    navigator.clipboard.writeText(summaryText);
    toast.success('의뢰인 핵심 요약 팩트시트가 클립보드에 복사되었습니다.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-xs px-3 sm:px-6 py-4 sm:py-8 flex items-start justify-center animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl 2xl:max-w-7xl h-[86vh] max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden my-auto shrink-0 print:m-0 print:h-auto print:max-h-none print:w-full print:border-none print:shadow-none">
        
        {/* ── 1. Modal Top Bar (헤더 - 컴팩트 & 고대비) ── */}
        <div className="rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-[#1e293b] px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg shrink-0 border border-white/15">
              📋
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  {clientName}님의 사전 자가진단 전수 리포트
                </h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${incomeTypeInfo.badgeClass}`}>
                  {incomeTypeInfo.badgeLabel}
                </span>
                {isYouth && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    24개월 청년특례 대상
                  </span>
                )}
                {Number(dtiRatio) >= 25 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                    DTI {dtiRatio}배 (초고위험군)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>📍 {residence}</span>
                <span className="text-slate-500">•</span>
                <span>{gender} 만 {age || '-'}세 ({birthDate})</span>
                <span className="text-slate-500">•</span>
                <span className="text-indigo-300 font-semibold">관할: {courtName}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">신청: {new Date(clientRequest.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 print:hidden">
            <button
              onClick={handleCopySummary}
              className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              title="전체 팩트 요약문 복사"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">요약 복사</span>
            </button>
            <button
              onClick={handlePrint}
              className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer press-scale hidden sm:flex"
              title="인쇄 및 PDF 저장"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer press-scale ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 2. Top KPI & Legal Insights Bar (슬림 통합 스트립) ── */}
        <div className="shrink-0 border-b border-slate-200 bg-white">
          {/* Row 1: 4 Core Metric Segments */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 bg-slate-50/60 text-xs">
            {/* 채무 */}
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-rose-600 block">총 채무 원금</span>
                <span className="text-base sm:text-lg font-black text-rose-700 font-mono tracking-tight block mt-0.5">
                  {debtTotal.toLocaleString()}<span className="text-xs font-bold ml-0.5">만원</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  채권자 {creditorCount}곳
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">DTI {dtiRatio}배</span>
              </div>
            </div>

            {/* 소득 */}
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-blue-600 block">세후 월 소득</span>
                <span className="text-base sm:text-lg font-black text-blue-700 font-mono tracking-tight block mt-0.5">
                  {income.toLocaleString()}<span className="text-xs font-bold ml-0.5">만원</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {incomeTypeInfo.shortTag}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {spouseIncome > 0 ? `배우자 +${spouseIncome}만` : '단독 소득'}
                </span>
              </div>
            </div>

            {/* 가용소득 */}
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-600 block">월 예상 가용소득</span>
                <span className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight block mt-0.5">
                  {monthlyDisposable.toLocaleString()}<span className="text-xs font-bold ml-0.5">만원</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  생계비 {recognizedLiving}만 차감
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">부양 {totalDependents}인 기준</span>
              </div>
            </div>

            {/* 자산 */}
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-indigo-600 block">총 자산 (청산가치)</span>
                <span className="text-base sm:text-lg font-black text-indigo-700 font-mono tracking-tight block mt-0.5">
                  {assetsTotal.toLocaleString()}<span className="text-xs font-bold ml-0.5">만원</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  보증금 {rentalDeposit}만
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {retirementPay > 0 ? `퇴직금 ${retirementPay}만` : '기타 자산'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: 회생 실무 퀵 진단 인사이트 바 */}
          <div className="bg-slate-900 text-white px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">📊 {repaymentMonths}개월 변제 총액:</span>
                <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                  {totalRepayment.toLocaleString()}만원
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">📉 원금 탕감률 추정:</span>
                <span className="font-mono font-black text-amber-300 text-xs sm:text-sm">
                  약 {expectedReliefPercent}%
                </span>
                <span className="text-[10px] text-slate-400">
                  (약 {expectedReliefAmount.toLocaleString()}만원 감면)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">⚖️ 청산가치 원칙:</span>
                {liquidationCheckPassed ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    충족 (변제총액 {totalRepayment}만 ≥ 자산 {assetsTotal}만)
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1" title="자산이 36개월 변제 총액보다 큽니다. 보증금 최우선변제액 공제나 변제기간 연장(최장 60개월)이 필요할 수 있습니다.">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    초과 주의 (보증금 공제 / 60개월 연장 검토 필요)
                  </span>
                )}
              </div>
            </div>

            {/* 빠른 경고 칩 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {recentLoans > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  최근대출 {recentLoans}만(소명요)
                </span>
              )}
              {coinCrypto > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  투자손실 {coinCrypto}만
                </span>
              )}
              {priorityDebt > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  우선세금 {priorityDebt}만
                </span>
              )}
              {legalActions.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700/60">
                  법적조치 {legalActions.length}건
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. Tab Filter Bar (컴팩트 탭 내비게이션) ── */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2 bg-slate-100/80 border-b border-slate-200 text-xs overflow-x-auto shrink-0 scrollbar-none print:hidden">
          {[
            { id: 'all', label: '📊 전수 대시보드', badge: '통합' },
            { id: 'personal', label: '👤 인적·가족', badge: `${familySize}인 가구` },
            { id: 'income', label: '💼 소득·생계비', badge: `${income}만원` },
            { id: 'debt', label: '⚠️ 채무·법적조치', badge: `${creditorCount}곳` },
            { id: 'asset', label: '🏠 자산·청산가치', badge: `${assetsTotal}만원` },
            { id: 'story', label: '💬 사연 & 메모', badge: clientNotes.length > 0 ? `${clientNotes.length}건` : undefined },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 press-scale ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 4. Main Scrollable Content Body ── */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 text-slate-800 space-y-4">

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE A: 전수 대시보드 ('all') ➔ 2-컬럼 고밀도 스마트 그리드
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">

              {/* ── [LEFT COLUMN: lg:col-span-6] 인적/가족 + 소득/생계비 ── */}
              <div className="lg:col-span-6 space-y-3.5">
                
                {/* 1. 인적 사항 및 가구·부양 구조 */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <h3 className="text-xs font-black text-slate-900">1. 인적 사항 & 가구·부양 구조</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                      {familySize}인 가구
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-200 text-xs">
                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">성명 / 성별 / 나이</span>
                      <div className="font-bold text-slate-900 text-xs">
                        {clientName} <span className="text-slate-500 font-normal">({gender} · 만 {age || '-'}세)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{birthDate}</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">혼인 상태</span>
                      <span className="font-bold text-slate-900 block text-xs">{maritalStatusText}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">가구원: {familySize}인</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">부양가족 상세</span>
                      <span className="font-bold text-blue-700 block text-xs">미성년 {minorChildren}명 {otherDependents > 0 && `· 기타 ${otherDependents}명`}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">인정 부양: 총 {totalDependents}명</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">거주지 / 관할 법원</span>
                      <span className="font-bold text-slate-900 block text-xs truncate">{residence}</span>
                      <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">관할: {courtName}</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">근무지 / 사업장</span>
                      <span className="font-bold text-slate-900 block text-xs truncate">{workLocation}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">연락처: {phone}</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">법원 특례 및 우대 요건</span>
                      <span className={`text-[10px] font-bold inline-block px-1.5 py-0.5 rounded ${
                        isYouth || specialConditionKey !== 'none'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {specialConditionText}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. 고용·소득 현황 및 생계비 지출 구조 */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <h3 className="text-xs font-black text-slate-900">2. 고용·소득 현황 및 생계비 구조</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${incomeTypeInfo.badgeClass}`}>
                      {incomeTypeInfo.badgeLabel}
                    </span>
                  </div>

                  {/* 소득 차감 & 가용소득 산출 인라인 플로우 */}
                  <div className="bg-slate-50/80 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 text-slate-600 flex-wrap font-mono">
                      <span>세후 <strong className="text-blue-700">{income.toLocaleString()}만</strong></span>
                      <span className="text-slate-400">─</span>
                      <span>생계비 <strong className="text-slate-800">{recognizedLiving.toLocaleString()}만</strong></span>
                      {monthlyRent > 0 && (
                        <>
                          <span className="text-slate-400">─</span>
                          <span>월세 <strong className="text-slate-800">{monthlyRent}만</strong></span>
                        </>
                      )}
                      <span className="text-slate-400">═</span>
                      <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        가용소득 {monthlyDisposable.toLocaleString()}만원/월
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      36개월 총 {totalRepayment.toLocaleString()}만원
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-200 text-xs">
                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">고용 형태 (소득 분류)</span>
                      <span className="font-bold text-slate-900 block text-xs">{incomeTypeInfo.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {hasRecentJobChange ? '⚠️ 1년 내 이직/변동' : '✓ 고용 안정'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">본인 세후 월 소득</span>
                      <span className="font-mono font-black text-blue-700 text-sm">{income.toLocaleString()}만원</span>
                      {spouseIncome > 0 && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">배우자: {spouseIncome.toLocaleString()}만</span>
                      )}
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">법정 인정 생계비</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{recognizedLiving}만원</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">중위소득 60% ({totalDependents}명)</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">주거 임차비 (월세)</span>
                      <span className="font-bold text-slate-900 block text-xs">
                        {monthlyRent > 0 ? `${monthlyRent.toLocaleString()}만원` : '월세 없음 (전세/자가)'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">월 정기 추가 생계비</span>
                      <div className="text-[10px] text-slate-700 space-y-0.5">
                        <span>의료비 {medicalCost}만 · 교육비 {educationCost}만</span>
                        {specialEducationCost > 0 && <span className="block text-purple-700 font-bold">특수교육 {specialEducationCost}만</span>}
                      </div>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">월 예상 가용소득</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">{monthlyDisposable.toLocaleString()}만원</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {monthlyDisposable > 0 ? '✓ 변제금 납입 가능' : '⚠️ 가용소득 부족'}
                      </span>
                    </div>
                  </div>

                  {/* 소득 유형별 필수 서류 안내 팁 */}
                  <div className="bg-slate-50/70 p-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-1.5 text-slate-600 truncate">
                      <span className="font-bold text-[#1E3A5F]">📄 필수 서류:</span>
                      <span className="truncate text-slate-700">{incomeTypeInfo.documentSummary}</span>
                    </div>
                    {incomeTypeInfo.requiresD5103 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                        12개월 수지표(D5103) 필수
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* ── [RIGHT COLUMN: lg:col-span-6] 채무/법적조치 + 자산/청산가치 ── */}
              <div className="lg:col-span-6 space-y-3.5">
                
                {/* 3. 채무 구성 및 금융권별 세부 비중 */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <h3 className="text-xs font-black text-slate-900">3. 채무 구성·금융권 비중 & 위험도</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      총 {debtTotal.toLocaleString()}만원 ({creditorCount}곳)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-200 text-xs">
                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">총 채무 원금</span>
                      <span className="font-mono font-black text-rose-700 text-sm">{debtTotal.toLocaleString()}만원</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">채권자 {creditorCount}곳</span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">채무 배율 (DTI)</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{dtiRatio}배</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {Number(dtiRatio) >= 25 ? '🚨 초고위험군' : '상환 불능 상태'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">채무 발생 원인</span>
                      <span className="font-bold text-slate-900 block text-xs truncate">{debtCauseText}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        과거 이력: {fp.prevHistory?.exists ? '기신청' : '최초 신청'}
                      </span>
                    </div>
                  </div>

                  {/* 5대 금융권별 채무 세부 비중 스트립 */}
                  <div className="p-2.5 bg-slate-50/50 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1.5">금융권별 비중 및 특이 채무</span>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[9px] text-slate-400 block">1금융 은행</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">{banks.toLocaleString()}만</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[9px] text-slate-400 block">2금융/카드</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">{cards.toLocaleString()}만</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[9px] text-slate-400 block">대부/사채</span>
                        <span className="font-mono font-bold text-slate-800 text-[11px]">{personals.toLocaleString()}만</span>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${recentLoans > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <span className="text-[9px] block">최근 6개월</span>
                        <span className="font-mono font-bold text-[11px]">{recentLoans.toLocaleString()}만</span>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${coinCrypto > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <span className="text-[9px] block">코인/도박</span>
                        <span className="font-mono font-bold text-[11px]">{coinCrypto.toLocaleString()}만</span>
                      </div>
                    </div>

                    {/* 위험 채무 경고 인라인 칩 */}
                    {(recentLoans > 0 || coinCrypto > 0 || priorityDebt > 0) && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                        {recentLoans > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            ⚠️ 최근 대출 {recentLoans.toLocaleString()}만원 (사용처 소명 준비 필수)
                          </span>
                        )}
                        {coinCrypto > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                            🚨 주식/가상화폐 손실 {coinCrypto.toLocaleString()}만원 (청산가치 반영 여부 검토)
                          </span>
                        )}
                        {priorityDebt > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                            ⚖️ 우선세금 체납 {priorityDebt.toLocaleString()}만원 (변제계획 우선배정)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. 주거 형태 & 자산·청산가치 평가 */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <h3 className="text-xs font-black text-slate-900">4. 주거 형태 & 자산·청산가치 평가</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      총 자산 {assetsTotal.toLocaleString()}만원
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-200 text-xs">
                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">주거 형태 및 보증금</span>
                      <span className="font-bold text-slate-900 block text-xs">{housingTypeText}</span>
                      <span className="font-mono font-bold text-indigo-700 block mt-0.5 text-xs">
                        보증금 {rentalDeposit.toLocaleString()}만원
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {housingContractHolder} {depositLoan > 0 ? `(대출 ${depositLoan}만)` : ''}
                      </span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">예상 퇴직금 및 연금</span>
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {retirementPay > 0 ? `${retirementPay.toLocaleString()}만원` : '해당 없음'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 line-clamp-2 leading-tight">
                        {retirementPensionText}
                      </span>
                    </div>

                    <div className="bg-white p-2.5">
                      <span className="text-[10px] text-slate-400 block mb-0.5">배우자 명의 자산</span>
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {spouseAsset > 0 ? `${spouseAsset.toLocaleString()}만원` : '해당 없음'}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">실무상 1/2 반영</span>
                    </div>
                  </div>

                  {/* 개별 등록 자산 목록 */}
                  {individualAssets.length > 0 && (
                    <div className="p-2.5 bg-slate-50/50 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-500 block mb-1">개별 등록 자산 목록</span>
                      <div className="space-y-1">
                        {individualAssets.map((asset: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center px-2 py-1 rounded bg-white border border-slate-200 text-[11px]">
                            <span className="text-slate-700 truncate">
                              {asset.description || asset.type} ({asset.owner === 'spouse' ? '배우자' : '본인'})
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {(asset.marketValue || 0).toLocaleString()}만원
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. 채권 추심 & 법적 조치 현황 (컴팩트 카드) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <h4 className="text-xs font-black text-slate-900">5. 채권 추심 & 진행 중인 법적 조치</h4>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {legalActions.length > 0 ? `${legalActions.length}건 진행 중` : '진행 없음'}
                    </span>
                  </div>

                  {legalActions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {legalActions.map((action, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {legalActionLabels[action] || action}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      현재 진행 중인 강제집행/계좌압류 없음 (상담 대기 상태)
                    </span>
                  )}
                </div>

              </div>

              {/* ── [FULL-WIDTH BOTTOM: lg:col-span-12] 의뢰인 사연 & 전달 메모 ── */}
              <div className="lg:col-span-12">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-50/90 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <h3 className="text-xs font-black text-slate-900">6. 의뢰인 직접 작성 사연 & 특이사항 메모</h3>
                    </div>
                    {clientNotes.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        변호사 확인 메모 {clientNotes.length}건
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 space-y-3">
                    {/* 의뢰인 특이사항/문의사항 메모 (있을 경우 최우선 하이라이트) */}
                    {clientNotes.length > 0 && (
                      <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs">
                        <span className="font-bold text-amber-900 flex items-center gap-1.5 mb-1.5">
                          <span>📌 변호사에게 남긴 문의사항 / 특이사항</span>
                        </span>
                        <ul className="space-y-1 text-amber-950 font-medium">
                          {clientNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="text-amber-600 font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 상담 신청 제목 및 전문 */}
                    {title && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="font-bold text-slate-500 shrink-0 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                          신청 제목
                        </span>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {title}
                        </span>
                      </div>
                    )}

                    {content && (
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto font-mono text-[11px]">
                        {content}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE B: 인적·가족 집중 뷰 ('personal')
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'personal' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1E3A5F]" />
                    <h3 className="text-base font-black text-slate-900">인적 사항 & 가족·부양 현황 상세</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                    {familySize}인 가구
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">성명 및 생년월일</span>
                    <span className="font-bold text-slate-900 text-sm">{clientName}</span>
                    <span className="text-slate-600 ml-2">({gender} · 만 {age || '-'}세)</span>
                    <span className="text-slate-400 block text-[11px] mt-1">{birthDate}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">혼인 상태 및 가구원 구성</span>
                    <span className="font-bold text-slate-900 text-sm">{maritalStatusText}</span>
                    <span className="text-slate-500 block text-[11px] mt-1">총 가구원수: {familySize}인 가구</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">부양가족 상세 내역</span>
                    <span className="font-bold text-blue-700 text-sm">미성년 자녀 {minorChildren}명</span>
                    {otherDependents > 0 && <span className="text-slate-600 ml-1.5">/ 기타 부양 {otherDependents}명</span>}
                    <span className="text-slate-500 block text-[11px] mt-1">법정 인정 부양가족 수: 총 {totalDependents}명</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">거주지 주소 및 관할 법원</span>
                    <span className="font-bold text-slate-900 text-sm block">{residence}</span>
                    <span className="text-indigo-600 font-bold text-xs mt-1 block">관할: {courtName}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">직장 및 근무지</span>
                    <span className="font-bold text-slate-900 text-sm block">{workLocation}</span>
                    <span className="text-slate-400 text-[11px] mt-1 block">전화번호: {phone}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">법원 특례 및 우대 요건 판정</span>
                    <span className={`font-bold inline-block px-2.5 py-1 rounded-md text-xs mt-1 ${
                      isYouth || specialConditionKey !== 'none'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {specialConditionText}
                    </span>
                    {isYouth && (
                      <span className="text-[11px] text-amber-800 block mt-1.5 font-medium">
                        ✓ 서울/수원/부산회생법원 청년특례 준칙에 따라 24개월 단기변제 신청이 유력합니다.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE C: 소득·생계비 집중 뷰 ('income')
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'income' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#1E3A5F]" />
                    <h3 className="text-base font-black text-slate-900">고용·소득 현황 및 생계비 지출 구조 상세</h3>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${incomeTypeInfo.badgeClass}`}>
                    {incomeTypeInfo.badgeLabel}
                  </span>
                </div>

                {/* 소득 산출 공식 배너 */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-blue-800 block">월 가용소득 산출 공식</span>
                    <div className="font-mono text-sm text-blue-950 font-bold mt-1">
                      월 실수령액({income}만) ─ 법정 최저생계비({recognizedLiving}만) = <span className="text-emerald-700 text-base">{monthlyDisposable}만원/월</span>
                    </div>
                  </div>
                  <div className="text-right sm:border-l sm:border-blue-200 sm:pl-4">
                    <span className="text-[11px] text-blue-700 block">{repaymentMonths}개월 변제 총액</span>
                    <span className="text-base font-black font-mono text-emerald-700">{totalRepayment.toLocaleString()}만원</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">고용 형태 및 직업 분류</span>
                    <span className="font-bold text-slate-900 text-sm">{incomeTypeInfo.label}</span>
                    <span className="text-slate-500 block text-[11px] mt-1">
                      {hasRecentJobChange ? '⚠️ 최근 1년 이내 이직/직장 변동 있음 (변동 내역 소명 준비)' : '✓ 고용 상태 안정'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">월 실수령 소득 (세후)</span>
                    <span className="font-black text-blue-700 text-base font-mono">{income.toLocaleString()}만원</span>
                    {spouseIncome > 0 && (
                      <span className="text-slate-600 block text-[11px] mt-1">배우자 소득: {spouseIncome.toLocaleString()}만원</span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">법정 인정 최저생계비 ({totalDependents}명 기준)</span>
                    <span className="font-black text-slate-900 text-base font-mono">{recognizedLiving}만원</span>
                    <span className="text-slate-400 block text-[11px] mt-1">2026년 기준 보건복지부 기준 중위소득 60%</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">주거 임차비 (월세)</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {monthlyRent > 0 ? `${monthlyRent.toLocaleString()}만원` : '월세 없음 (전세/자가/무상거주)'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">월 정기 추가 생계비</span>
                    <div className="space-y-1 text-xs">
                      <span className="block text-slate-700">의료비 지출: {medicalCost}만원</span>
                      <span className="block text-slate-700">자녀 교육비: {educationCost}만원</span>
                      {specialEducationCost > 0 && <span className="block text-purple-700 font-bold">특수 교육비: {specialEducationCost}만원</span>}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">월 예상 가용소득 (변제 재원)</span>
                    <span className="font-black text-emerald-700 text-base font-mono">{monthlyDisposable.toLocaleString()}만원</span>
                    <span className="text-slate-500 block text-[11px] mt-1">
                      {monthlyDisposable > 0 ? '✓ 변제금 납입 가능 상태' : '⚠️ 가용소득 부족 (개인파산 검토 권장)'}
                    </span>
                  </div>
                </div>

                {/* 필수 서류 안내 박스 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>📄 소득 유형별 법원 필수 제출 서류 가이드</span>
                  </span>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {incomeTypeInfo.rationale}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                    {incomeTypeInfo.keyRequiredDocuments?.map((doc: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 p-2 rounded bg-white border border-slate-200 text-[11px] text-slate-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE D: 채무·법적조치 집중 뷰 ('debt')
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'debt' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <h3 className="text-base font-black text-slate-900">채무 구성·금융권별 비중 및 법적 조치 현황</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    총 채무 {debtTotal.toLocaleString()}만원
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200">
                    <span className="text-rose-500 block text-[11px] font-bold mb-1">총 채무 원금</span>
                    <span className="text-xl font-black text-rose-800 font-mono">{debtTotal.toLocaleString()}만원</span>
                    <span className="text-slate-600 block text-[11px] mt-1">채권자 수: {creditorCount}곳</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-1">주된 채무 발생 원인</span>
                    <span className="font-bold text-slate-900 text-sm">{debtCauseText}</span>
                    <span className="text-slate-500 block text-[11px] mt-1">
                      과거 이력: {fp.prevHistory?.exists ? '기신청 (확인요망)' : '최초 신청'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px] mb-1">채무 배율 (DTI)</span>
                    <span className="font-black text-slate-900 text-sm font-mono">
                      {dtiRatio}배
                    </span>
                    <span className="text-slate-500 block text-[11px] mt-1">
                      {Number(dtiRatio) >= 25 ? '🚨 초고위험군 (지체없는 회생 권장)' : '상환 불능 상태'}
                    </span>
                  </div>
                </div>

                {/* 금융권별 세부 내역 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
                  <span className="font-bold text-slate-800 text-xs block">금융권별 채무 세부 비중</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">1금융 은행</span>
                      <span className="font-bold font-mono text-slate-800 text-xs">{banks.toLocaleString()}만</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">2금융/카드</span>
                      <span className="font-bold font-mono text-slate-800 text-xs">{cards.toLocaleString()}만</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">대부·사채·개인</span>
                      <span className="font-bold font-mono text-slate-800 text-xs">{personals.toLocaleString()}만</span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${recentLoans > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <span className="text-[10px] block font-medium">최근 6개월 대출</span>
                      <span className="font-bold font-mono text-xs">{recentLoans.toLocaleString()}만</span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${coinCrypto > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <span className="text-[10px] block font-medium">코인/주식/도박</span>
                      <span className="font-bold font-mono text-xs">{coinCrypto.toLocaleString()}만</span>
                    </div>
                  </div>

                  {/* 특이 위험 지표 배너 */}
                  {(recentLoans > 0 || coinCrypto > 0 || priorityDebt > 0) && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {recentLoans > 0 && (
                        <div className="p-2 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium">
                          ⚠️ 최근 6개월 대출 {recentLoans.toLocaleString()}만원: 대출금 사용처(기존 채무 대환, 생활비 등) 계좌 내역 소명이 필수입니다.
                        </div>
                      )}
                      {coinCrypto > 0 && (
                        <div className="p-2 rounded bg-rose-50 text-rose-900 border border-rose-200 text-xs font-medium">
                          🚨 주식/가상화폐 손실 {coinCrypto.toLocaleString()}만원: 관할 법원(서울/수원/부산 외 지방 법원)에 따라 청산가치 반영 여부를 사전에 철저히 검토해야 합니다.
                        </div>
                      )}
                      {priorityDebt > 0 && (
                        <div className="p-2 rounded bg-purple-50 text-purple-900 border border-purple-200 text-xs font-medium">
                          ⚖️ 우선변제 세금체납 {priorityDebt.toLocaleString()}만원: 변제기간 전반부에 전액 우선 변제되도록 변제계획안을 편성해야 합니다.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 법적 조치 현황 */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 text-xs block">현재 진행 중인 채권 추심 및 법적 조치</span>
                  {legalActions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {legalActions.map((action, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          {legalActionLabels[action] || action}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500">진행 중인 강제집행/압류 없음 (상담 대기 상태)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE E: 자산·청산가치 집중 뷰 ('asset')
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'asset' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-[#1E3A5F]" />
                    <h3 className="text-base font-black text-slate-900">주거 형태 & 자산·청산가치 평가 상세</h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                    총 자산 {assetsTotal.toLocaleString()}만원
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">주거 형태 및 보증금</span>
                    <span className="font-bold text-slate-900 text-sm">{housingTypeText}</span>
                    <span className="font-mono font-bold text-indigo-700 block mt-1 text-base">
                      보증금 {rentalDeposit.toLocaleString()}만원
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-1">
                      명의: {housingContractHolder} {depositLoan > 0 ? `(보증금대출: ${depositLoan}만)` : ''}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">예상 퇴직금 및 퇴직연금</span>
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {retirementPay > 0 ? `${retirementPay.toLocaleString()}만원` : '해당 없음'}
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-1 leading-relaxed">
                      {retirementPensionText}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-1">배우자 명의 자산</span>
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {spouseAsset > 0 ? `${spouseAsset.toLocaleString()}만원` : '해당 없음'}
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-1">실무상 1/2(50%) 청산가치 반영</span>
                  </div>
                </div>

                {/* 청산가치 보장의 원칙 비교 카드 */}
                <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  liquidationCheckPassed 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}>
                  <span className="font-bold flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    <span>청산가치 보장의 원칙 검토 요약</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                    <div>총 자산 평가액(청산가치): <strong>{assetsTotal.toLocaleString()}만원</strong></div>
                    <div>{repaymentMonths}개월 변제금 합계: <strong>{totalRepayment.toLocaleString()}만원</strong></div>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed">
                    {liquidationCheckPassed 
                      ? '✓ 변제금 합계액이 청산가치를 초과하므로 청산가치 보장의 원칙을 원활하게 충족합니다.'
                      : '⚠️ 청산가치가 36개월 변제금보다 큽니다. 주택임대차보호법상 소액임차보증금(서울 5,500만원 등) 공제액을 산정하여 실질 청산가치를 낮추거나, 변제기간을 최장 60개월로 연장하는 방안을 상담 시 검토해야 합니다.'}
                  </p>
                </div>

                {/* 개별 등록 자산 목록 */}
                {individualAssets.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-800 text-xs block">개별 자산 상세 등록 내역</span>
                    <div className="space-y-1.5">
                      {individualAssets.map((asset: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white border border-slate-200">
                          <span className="font-medium text-slate-800">
                            {asset.description || asset.type} ({asset.owner === 'spouse' ? '배우자' : '본인'})
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {(asset.marketValue || 0).toLocaleString()}만원
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW MODE F: 사연 & 메모 집중 뷰 ('story')
             ══════════════════════════════════════════════════════════ */}
          {activeTab === 'story' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#1E3A5F]" />
                    <h3 className="text-base font-black text-slate-900">의뢰인 직접 작성 사연 & 특이사항 메모</h3>
                  </div>
                  {clientNotes.length > 0 && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
                      특이사항 {clientNotes.length}건
                    </span>
                  )}
                </div>

                {/* 변호사 확인 메모 */}
                {clientNotes.length > 0 && (
                  <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span>📌 변호사에게 남긴 문의사항 / 특이사항</span>
                    </span>
                    <ul className="space-y-1.5 text-amber-950 font-medium">
                      {clientNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {title && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">상담 신청 제목</span>
                    <p className="font-black text-slate-900 text-sm sm:text-base leading-snug">{title}</p>
                  </div>
                )}

                {content && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">자가진단 리포트 전문</span>
                    <div className="text-slate-800 whitespace-pre-line leading-relaxed font-mono text-xs bg-white p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                      {content}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── 5. Modal Bottom Action Bar ── */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer press-scale"
            >
              닫기
            </button>
            <button
              onClick={handleCopySummary}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>전체 팩트 복사</span>
            </button>
          </div>

          {/* 메인 액션: 제안서 작성하기 버튼 */}
          {onOpenProposalDraft && (
            <button
              onClick={() => {
                onClose();
                onOpenProposalDraft();
              }}
              className="px-6 py-2 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale whitespace-nowrap"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>이 정보로 제안서 작성하기</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
