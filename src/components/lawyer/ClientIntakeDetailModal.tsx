import React, { useState, useMemo } from 'react';
import { 
  X, User, Users, Briefcase, Calculator, Home, AlertTriangle, 
  FileText, CheckCircle2, DollarSign, ShieldAlert, Sparkles, 
  CreditCard, Landmark, Flame, Heart, Info, Copy, ExternalLink,
  ChevronRight, Building2, Gavel, FileCheck2, Scale, Clock, ShieldCheck
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
  const specialConditionText = specialCondMap[specialConditionKey] || (isYouth ? '만 29세 이하 청년특례 유력' : '일반');

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
  const creditorCount = fp.creditorCount || (fp.debts ? fp.debts.length : 0) || 5;
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
  const debtCauseText = debtCauseMap[fp.debtCause] || (speculativeLoss > 0 ? '주식/코인 투자 손실' : gamblingLoss > 0 ? '도박 채무' : '생계형 채무');

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
• 성별/나이: ${gender} / 만 ${age || '-'}세 (${residence})
• 소득 구분: ${incomeTypeInfo.label} (세후 월 ${income.toLocaleString()}만원)
• 총 채무: ${debtTotal.toLocaleString()}만원 (채권자 ${creditorCount}곳)
• 1금융/카드/사채: 은행 ${banks}만 / 카드 ${cards}만 / 사채·세금 ${personals}만
• 최근 6개월 대출: ${recentLoans}만원 ${recentLoans > 0 ? '(소명 필요)' : ''}
• 코인/도박 손실: ${coinCrypto}만원
• 총 자산: ${assetsTotal.toLocaleString()}만원 (보증금 ${rentalDeposit}만, 퇴직금 ${retirementPay}만)
• 부양가족: 미성년자녀 ${minorChildren}명 / 총 ${totalDependents}명 부양
• 법적조치: ${legalActions.length > 0 ? legalActions.map(a => legalActionLabels[a] || a).join(', ') : '없음'}
• 신청 사연: ${title}
${content}`;

    navigator.clipboard.writeText(summaryText);
    toast.success('고객 종합 팩트시트가 클립보드에 복사되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 flex items-start sm:items-center justify-center animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl h-[86vh] max-h-[86vh] flex flex-col overflow-hidden my-auto shrink-0">
        
        {/* ── 1. Modal Top Bar (헤더) ── */}
        <div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-[#0F172A] px-5 py-4 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0 border border-white/10">
              📋
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  {clientName}님의 사전 자가진단 전수 리포트
                </h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${incomeTypeInfo.badgeClass}`}>
                  {incomeTypeInfo.badgeLabel}
                </span>
                {isYouth && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    24개월 청년특례 대상
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span>📍 {residence}</span>
                <span>•</span>
                <span>{gender} 만 {age || '-'}세</span>
                <span>•</span>
                <span className="text-slate-400">신청일시: {new Date(clientRequest.createdAt).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySummary}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              title="전체 팩트 요약문 복사"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">요약 복사</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer press-scale"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. Top KPI Highlights (핵심 4대 지표 바) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-4 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
          <div className="bg-white p-3 rounded-2xl border border-rose-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-500 block">총 채무 원금</span>
            <span className="text-lg font-black text-rose-700 font-mono tracking-tight mt-0.5 block">
              {debtTotal.toLocaleString()}만원
            </span>
            <span className="text-[10px] text-slate-400 font-medium">채권자 {creditorCount}곳</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-blue-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-500 block">세후 월 소득</span>
            <span className="text-lg font-black text-blue-700 font-mono tracking-tight mt-0.5 block">
              {income.toLocaleString()}만원
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{incomeTypeInfo.shortTag}</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-600 block">월 예상 가용소득</span>
            <span className="text-lg font-black text-emerald-700 font-mono tracking-tight mt-0.5 block">
              {monthlyDisposable.toLocaleString()}만원
            </span>
            <span className="text-[10px] text-slate-400 font-medium">인정 생계비 {recognizedLiving}만 차감</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-indigo-200/80 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-600 block">총 자산 (청산가치)</span>
            <span className="text-lg font-black text-indigo-700 font-mono tracking-tight mt-0.5 block">
              {assetsTotal.toLocaleString()}만원
            </span>
            <span className="text-[10px] text-slate-400 font-medium">보증금 {rentalDeposit}만 포함</span>
          </div>
        </div>

        {/* ── 3. Tab Filter Bar ── */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-white border-b border-slate-200 text-xs overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'all', label: '📋 전체 전수 보기' },
            { id: 'personal', label: '👤 인적·가족 현황' },
            { id: 'income', label: '💼 소득·생계비 지출' },
            { id: 'debt', label: '⚠️ 채무 구성·법적조치' },
            { id: 'asset', label: '🏠 자산·청산가치' },
            { id: 'story', label: '💬 의뢰인 사연 & 조언' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 4. Main Scrollable Content Body (11개 영역 전수 표기) ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-800">

          {/* ══════════ SECTION 1: 인적 & 가족·부양가족 현황 ══════════ */}
          {(activeTab === 'all' || activeTab === 'personal') && (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <Users className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-sm font-black text-slate-900">1. 인적 사항 & 가족·부양 현황</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">성명 및 나이</span>
                  <span className="font-bold text-slate-900 text-sm">{clientName}</span>
                  <span className="text-slate-600 ml-1.5">({gender} · 만 {age || '-'}세)</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">혼인 상태 및 가구원</span>
                  <span className="font-bold text-slate-900">{maritalStatusText}</span>
                  <span className="text-slate-500 ml-1 font-mono">({familySize}인 가구)</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">부양가족 상세</span>
                  <span className="font-bold text-blue-700">미성년 자녀 {minorChildren}명</span>
                  {otherDependents > 0 && <span className="text-slate-600 ml-1">/ 기타 부양 {otherDependents}명</span>}
                  <span className="text-slate-500 block text-[10px] mt-0.5">총 인정 부양가족: {totalDependents}명</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">거주지 주소 / 관할 법원</span>
                  <span className="font-bold text-slate-900 block">{residence}</span>
                  <span className="text-indigo-600 text-[11px] font-bold mt-0.5 block">관할: {courtName}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">근무지 / 사업장</span>
                  <span className="font-bold text-slate-900">{workLocation}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">법원 특례 및 우대 요건</span>
                  <span className={`font-black inline-block px-2 py-0.5 rounded text-[11px] ${
                    isYouth || specialConditionKey !== 'none'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {specialConditionText}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ SECTION 2: 고용 & 소득 및 생계비 구조 ══════════ */}
          {(activeTab === 'all' || activeTab === 'income') && (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <Briefcase className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-sm font-black text-slate-900">2. 고용·소득 현황 및 생계비 지출 구조</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">고용 형태 (소득 분류)</span>
                  <span className="font-bold text-slate-900 text-sm">{incomeTypeInfo.label}</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">
                    {hasRecentJobChange ? '⚠️ 최근 1년 이내 이직/변동 있음' : '✓ 고용 상태 안정'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">월 실수령 소득 (세후)</span>
                  <span className="font-black text-slate-900 text-base font-mono">{income.toLocaleString()}만원</span>
                  {spouseIncome > 0 && (
                    <span className="text-slate-600 block text-[11px] mt-0.5">배우자 소득: {spouseIncome.toLocaleString()}만원</span>
                  )}
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">법정 인정 생계비 ({totalDependents}명 기준)</span>
                  <span className="font-black text-blue-700 text-base font-mono">{recognizedLiving}만원</span>
                  <span className="text-slate-400 block text-[10px]">2026년 기준 중위소득 60%</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">주거 임차비 (월세)</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {monthlyRent > 0 ? `${monthlyRent.toLocaleString()}만원` : '월세 없음 (전세/자가)'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">월 정기 추가 생계비</span>
                  <div className="space-y-0.5 text-[11px]">
                    <span className="block text-slate-700">의료비: {medicalCost}만원</span>
                    <span className="block text-slate-700">자녀 교육비: {educationCost}만원</span>
                    {specialEducationCost > 0 && <span className="block text-purple-700 font-bold">특수교육: {specialEducationCost}만원</span>}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">월 예상 가용소득 (변제 재원)</span>
                  <span className="font-black text-emerald-700 text-base font-mono">{monthlyDisposable.toLocaleString()}만원</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">
                    {monthlyDisposable > 0 ? '변제금 납입 가능' : '⚠️ 가용소득 부족 (파산 검토 권장)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ SECTION 3: 채무 구성 & 법적 조치 현황 ══════════ */}
          {(activeTab === 'all' || activeTab === 'debt') && (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-black text-slate-900">3. 채무 구성·금융권별 비중 및 법적 조치 현황</h3>
              </div>

              {/* 채무 총괄 & 원인 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200">
                  <span className="text-rose-500 block text-[11px] font-bold mb-0.5">총 채무 원금</span>
                  <span className="text-lg font-black text-rose-800 font-mono">{debtTotal.toLocaleString()}만원</span>
                  <span className="text-slate-600 block text-[10px] mt-0.5">채권자 수: {creditorCount}곳</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">주된 채무 발생 원인</span>
                  <span className="font-bold text-slate-900 text-sm">{debtCauseText}</span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">
                    과거 회생/파산/워크아웃 이력: {fp.prevHistory?.exists ? '있음 (확인요망)' : '없음 (최초 신청)'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">채무 배율 (DTI)</span>
                  <span className="font-black text-slate-900 text-sm font-mono">
                    {income > 0 ? (debtTotal / income).toFixed(1) : '-'}배
                  </span>
                  <span className="text-slate-500 block text-[10px] mt-0.5">
                    {debtTotal / income >= 25 ? '🚨 초고위험군' : '상환 불능 상태'}
                  </span>
                </div>
              </div>

              {/* 금융권별 세부 내역 칩 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
                <span className="font-bold text-slate-800 text-xs block">금융권별 채무 세부 비중</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">1금융 은행</span>
                    <span className="font-bold font-mono text-slate-800 text-xs">{banks.toLocaleString()}만</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">2금융/카드</span>
                    <span className="font-bold font-mono text-slate-800 text-xs">{cards.toLocaleString()}만</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">대부·사채·개인</span>
                    <span className="font-bold font-mono text-slate-800 text-xs">{personals.toLocaleString()}만</span>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${recentLoans > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-800'}`}>
                    <span className="text-[10px] block font-medium">최근 6개월 대출</span>
                    <span className="font-bold font-mono text-xs">{recentLoans.toLocaleString()}만</span>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${coinCrypto > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-100 text-slate-800'}`}>
                    <span className="text-[10px] block font-medium">코인/주식/도박</span>
                    <span className="font-bold font-mono text-xs">{coinCrypto.toLocaleString()}만</span>
                  </div>
                </div>

                {/* 특이 위험 지표 배너 */}
                {(recentLoans > 0 || coinCrypto > 0 || priorityDebt > 0) && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    {recentLoans > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠️ 최근 6개월 대출 {recentLoans.toLocaleString()}만원 (사용처 소명 필수)
                      </span>
                    )}
                    {coinCrypto > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                        🚨 주식/가상화폐 손실 {coinCrypto.toLocaleString()}만원 (청산가치 반영 여부 검토)
                      </span>
                    )}
                    {priorityDebt > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                        ⚖️ 우선변제 세금체납 {priorityDebt.toLocaleString()}만원 (변제계획안 우선배정)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 현재 법적 조치 현황 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-800 text-xs block">현재 진행 중인 채권 추심 & 법적 조치</span>
                {legalActions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {legalActions.map((action, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        {legalActionLabels[action] || action}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">진행 중인 강제집행/압류 없음 (상담 대기 상태)</span>
                )}
              </div>
            </div>
          )}

          {/* ══════════ SECTION 4: 자산 및 청산가치 ══════════ */}
          {(activeTab === 'all' || activeTab === 'asset') && (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <Home className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-sm font-black text-slate-900">4. 주거 형태 & 자산·청산가치 평가</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">주거 형태 및 보증금</span>
                  <span className="font-bold text-slate-900">{housingTypeText}</span>
                  <span className="font-mono font-bold text-slate-900 block mt-0.5">
                    보증금 {rentalDeposit.toLocaleString()}만원
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">
                    명의: {housingContractHolder} {depositLoan > 0 ? `(보증금대출: ${depositLoan}만)` : ''}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">예상 퇴직금 및 퇴직연금</span>
                  <span className="font-mono font-bold text-slate-900">
                    {retirementPay > 0 ? `${retirementPay.toLocaleString()}만원` : '없음 (사업자/미발생)'}
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5 leading-relaxed">
                    {retirementPensionText}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">배우자 명의 자산</span>
                  <span className="font-mono font-bold text-slate-900">
                    {spouseAsset > 0 ? `${spouseAsset.toLocaleString()}만원` : '없음 (미혼/무자산)'}
                  </span>
                  <span className="text-slate-500 text-[10px] block mt-0.5">실무상 1/2(50%) 청산가치 반영</span>
                </div>
              </div>

              {/* 개별 등록 자산 목록 */}
              {individualAssets.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 text-xs block">개별 자산 상세 등록 내역</span>
                  <div className="space-y-1.5">
                    {individualAssets.map((asset: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
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
          )}

          {/* ══════════ SECTION 5: 의뢰인 직접 작성 사연 및 문의 메모 ══════════ */}
          {(activeTab === 'all' || activeTab === 'story') && (
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <FileText className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-sm font-black text-slate-900">5. 의뢰인 직접 작성 사연 & 특이사항 메모</h3>
              </div>

              {title && (
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">상담 신청 제목</span>
                  <p className="font-black text-slate-900 text-sm leading-snug">{title}</p>
                </div>
              )}

              {content && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">자가진단 리포트 전문</span>
                  <div className="text-slate-700 whitespace-pre-line leading-relaxed font-mono text-[11px] max-h-60 overflow-y-auto bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    {content}
                  </div>
                </div>
              )}

              {/* 의뢰인 특이사항/문의사항 메모 */}
              {clientNotes.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-xs space-y-2">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>📌 변호사에게 남긴 문의사항/특이사항</span>
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
            </div>
          )}

        </div>

        {/* ── 5. Modal Bottom Action Bar (하단 액션 바) ── */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer press-scale"
            >
              닫기
            </button>
            <button
              onClick={handleCopySummary}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale"
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale"
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
