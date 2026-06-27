import React, { useState } from 'react';
import { MessageSquare, Edit2, Check, X, Shield, AlertTriangle, Users, DollarSign, Home, CreditCard, Scale, Sparkles, HelpCircle, Save, ArrowLeft } from 'lucide-react';
import { ConsultRequest } from '../../types';
import { RehabCalculationResult } from '../../rehab-chatbot-package/services/calculationService';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface MyPageViewProps {
  userAlias: string;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  
  // 동적 진단 데이터 연동
  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: any) => void;
  onStartDiagnosis?: () => void;
  
  requests: ConsultRequest[];
  onNavigateToChat: (reqId?: string) => void;
  isCompact?: boolean;
}

export default function MyPageView({
  userAlias, setUserAlias,
  isEditingAlias, setIsEditingAlias,
  tempAlias, setTempAlias,
  activeRequest,
  activeResult,
  onUpdateFinancialProfile,
  onStartDiagnosis,
  requests,
  onNavigateToChat,
  isCompact = false
}: MyPageViewProps) {

  // 자가진단 데이터가 아예 없는 경우
  if (!activeRequest || !activeRequest.financialProfile || !activeResult) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 animate-fadeIn text-center space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800 dark:text-white">아직 자가진단 기록이 없습니다</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              1분 만에 빚 탕감 비율과 월 예상 변제금을 시뮬레이션할 수 있는 무료 자가진단을 시작해 보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartDiagnosis}
            className="px-6 py-3.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>무료 자가진단 시작하기</span>
          </button>
        </div>
      </div>
    );
  }

  const profile = activeRequest.financialProfile;

  // 세부 데이터 핸들러
  const handleFieldChange = (field: string, value: any) => {
    onUpdateFinancialProfile({
      ...profile,
      [field]: value
    });
  };

  const handleDebtChange = (debtTypeField: string, val: number) => {
    const updatedDebtTypes = {
      ...profile.debtTypes,
      [debtTypeField]: val
    };
    
    // 총 채무액 합산
    const totalDebt = (updatedDebtTypes.banks || 0) + (updatedDebtTypes.cards || 0) + (updatedDebtTypes.personals || 0) + (profile.priorityDebt || 0);

    onUpdateFinancialProfile({
      ...profile,
      debtTypes: updatedDebtTypes,
      debtTotal: totalDebt
    });
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined) return '0원';
    if (amount === 0) return '0원';
    const absAmount = Math.abs(amount);
    
    // 세션 저장/화면 만원단위 호환
    let valInWon = absAmount;
    if (absAmount < 100000) {
      // 만원 단위인 경우 원 단위로 보정해 포맷
      valInWon = absAmount * 10000;
    }
    
    const eok = Math.floor(valInWon / 100000000);
    const remainder = valInWon % 100000000;
    const man = Math.floor(remainder / 10000);

    let res = '';
    if (eok > 0) res += `${eok}억 `;
    if (man > 0) res += `${man.toLocaleString()}만`;
    return `${res}원`.trim();
  };

  const totalDebtValue = (profile.debtTypes?.banks || 0) + (profile.debtTypes?.cards || 0) + (profile.debtTypes?.personals || 0) + (profile.priorityDebt || 0);

  return (
    <div className={isCompact ? "space-y-6 animate-fadeIn text-left" : "max-w-5xl mx-auto space-y-6 animate-fadeIn text-left"}>
      {/* compact 모드일 때만 최상단에 자가진단 요약 카드 노출 */}
      {isCompact && (
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-3 shadow-sm">
          <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] text-brand dark:text-brand-light">
            📝 실시간 자가진단서 접수 데이터 (변호사 검토용)
          </span>
          <div className="grid grid-cols-2 gap-2 text-slate-500 dark:text-slate-400 font-semibold">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-slate-400 block text-[9px] mb-0.5">월 실수령액</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold text-xs">{profile.income}만 원</strong>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-slate-400 block text-[9px] mb-0.5">총 채무액</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold text-xs">{profile.debtTotal.toLocaleString()}만 원</strong>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-slate-400 block text-[9px] mb-0.5">가구 부양가족</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold text-xs">{profile.dependents}명</strong>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-slate-400 block text-[9px] mb-0.5">결혼 여부</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold text-xs">
                {profile.maritalStatus === 'SINGLE' ? '미혼' : '기혼'}
              </strong>
            </div>
          </div>
          {profile.riskFlags && profile.riskFlags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              {profile.riskFlags.map(rf => (
                <span key={rf} className="bg-red-500/5 border border-red-500/15 text-red-600 dark:text-red-400 text-[9px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-500"></span>
                  🚨 {rf}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header / Stealth Badge & Assigned Lawyer */}
      {!isCompact && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              안전한 가명 보호 적용 중
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              변호사 실시간 연결됨
            </span>
          </div>
          {isEditingAlias ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (tempAlias.trim()) {
                  setUserAlias(tempAlias.trim());
                }
                setIsEditingAlias(false);
              }}
              className="flex items-center gap-2 pt-1 animate-fadeIn"
            >
              <span className="text-xl md:text-2xl">👤</span>
              <input 
                type="text" 
                value={tempAlias}
                onChange={(e) => setTempAlias(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-base md:text-lg font-bold focus:ring-1 focus:ring-brand focus:outline-none w-44 md:w-52 text-slate-850 dark:text-white"
                placeholder="새 가명 입력"
                maxLength={12}
                autoFocus
              />
              <button 
                type="submit"
                className="bg-brand text-white font-bold p-2.5 rounded-xl text-xs hover:bg-brand-hover transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-sm"
                title="저장"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setIsEditingAlias(false)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center cursor-pointer border border-slate-200 dark:border-slate-700"
                title="취소"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
              <span>👤 <span className="text-brand dark:text-brand-light">{userAlias || '새출발'}</span> 님의 안심 마이페이지</span>
              <button 
                type="button"
                onClick={() => {
                  setTempAlias(userAlias || '새출발');
                  setIsEditingAlias(true);
                }}
                className="text-slate-400 hover:text-brand dark:hover:text-brand-light p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-880 transition-all shrink-0 cursor-pointer"
                title="가명(이름) 수정"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
            </h2>
          )}
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
            채무 사실 노출 방지를 위해 의뢰인 정보는 암호화 가명으로 처리되며, 변호사단과의 1:1 비밀 매칭 대화방이 실시간 보호받고 있습니다.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 shrink-0 flex flex-col justify-between gap-3 w-full md:w-[280px]">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">전담 지정 변호인</span>
            <div className="flex items-center gap-2">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256" 
                alt="이소민 변호사" 
                className="w-8 h-8 rounded-lg object-cover" 
              />
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-white block">이소민 변호사</span>
                <span className="text-[9px] text-[#7e7e8f] font-semibold block">서울/경기 도산 전문</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const req = requests[0];
              onNavigateToChat(req?.id);
            }}
            className="w-full text-center py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>1:1 비공개 상담방 입장</span>
          </button>
        </div>
      </div>
      )}

      {/* LIVE DIAGNOSTICS DASHBOARD - 상하 스택 레이아웃 */}
      <div className="flex flex-col gap-5">
        
        {/* TOP: 실시간 채무조정 상태 (가로 배치) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="space-y-0.5">
              <span className="text-[10px] text-brand-light font-bold uppercase tracking-wider block">
                ⚙️ 나의 예상 감면액 실시간 분석
              </span>
              <h3 className="font-extrabold text-base md:text-lg">나의 실시간 채무조정 상태</h3>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed max-w-md">
              하단 진단 폼에서 항목을 수정하면, 법원 기준 최우선변제금 공제와 가구원 생계비가 즉시 다시 연산됩니다.
            </p>
          </div>

          {/* 주요 3대 지표 카드 - 가로 배치 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-slate-450 font-bold block">나의 총 채무액</span>
                <span className="text-[10px] text-slate-350 font-medium">원금 합계</span>
              </div>
              <span className="font-black text-amber-400 text-base md:text-lg">
                {formatCurrency(totalDebtValue)}
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-slate-450 font-bold block">매달 법원에 갚는 돈 (월 변제금)</span>
                <span className="text-[10px] text-slate-350 font-medium">생계비 제외 후 월 납입금</span>
              </div>
              <span className="font-black text-brand-light text-base md:text-lg">
                {formatCurrency(activeResult.monthlyPayment)} / 월
              </span>
            </div>

            <div className="bg-brand/10 border border-brand/20 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-brand-light font-bold block">최종 감면받을 금액 (탕감 혜택)</span>
                <span className="text-[10px] text-slate-300 font-medium">법적으로 면제되는 빚 액수</span>
              </div>
              <div className="text-right">
                <span className="font-black text-emerald-400 text-base md:text-lg block">
                  ★ {formatCurrency(activeResult.totalDebtReduction)}
                </span>
                <span className="text-[10px] text-emerald-350/80 font-bold">
                  전체 채무의 {activeResult.debtReductionRate}% 면제!
                </span>
              </div>
            </div>
          </div>

          {/* 실시간 프로그레스 그래프 - 가로 2열 배치 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/5">
            {/* 1. 청산가치 충족성 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-350">
                <span className="flex items-center gap-1">⚖️ 청산가치 보장율 (재산 대비 변제 비율)</span>
                <span className="font-bold text-[#10B981]">{Math.round((activeResult.totalRepayment / Math.max(1, activeResult.liquidationValue)) * 100)}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round((activeResult.totalRepayment / Math.max(1, activeResult.liquidationValue)) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 block leading-normal">
                * 법상 내 재산({formatCurrency(activeResult.liquidationValue)})보다 3년 총 상환액({formatCurrency(activeResult.totalRepayment)})이 많아야 하므로 기준을 초과하면 안전합니다.
              </span>
            </div>

            {/* 2. 소득 대비 인정 생계비 비율 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-350">
                <span className="flex items-center gap-1">📊 소득 대비 생활비 확보율</span>
                <span className="font-bold text-brand-light">{Math.round((activeResult.recognizedLivingCost / Math.max(1, activeResult.availableIncome + activeResult.recognizedLivingCost)) * 100)}%</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-brand-light to-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.round((activeResult.recognizedLivingCost / Math.max(1, activeResult.availableIncome + activeResult.recognizedLivingCost)) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 block leading-normal">
                * 월 평균 실수령액 중 의뢰인 가구의 의식주를 위해 법적으로 확보된 금액({formatCurrency(activeResult.recognizedLivingCost)})의 비중입니다.
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-normal text-left pt-3 border-t border-white/5 mt-3 flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>이 시뮬레이션 결과는 법원 실무 기준을 근거로 계산된 가상 수치이며, 실제 법원의 인가 결정 및 세부 변제율 조정을 위해 변호사 서류 소명이 수반되어야 합니다.</span>
          </div>
        </div>

        {/* BOTTOM: 상세 진단 정보 조회 및 수정 (전체 너비) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 text-left">
          <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-1.5">
                <Scale className="w-5 h-5 text-brand" />
                나의 상세 진단 정보 조회 및 수정
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isCompact ? "내용을 자유롭게 수정해 보세요. 상단의 채무조정 상태 및 변제금이 실시간으로 갱신됩니다." : "내용을 자유롭게 수정해 보세요. 왼쪽의 채무조정 상태 및 변제금이 실시간으로 갱신됩니다."}
              </p>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-650 dark:bg-slate-950 dark:text-slate-400 px-2 py-0.5 rounded font-bold">
              단위: 만 원
            </span>
          </div>

          <div className="space-y-5">
            
            {/* 0. 기본 인적 사항 */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">0. 기본 인적 사항</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">이름</label>
                  <input 
                    type="text" 
                    value={profile.clientName || ''} 
                    onChange={(e) => handleFieldChange('clientName', e.target.value)} 
                    placeholder="홍길동"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">연락처</label>
                  <input 
                    type="tel" 
                    value={profile.clientPhone || ''} 
                    onChange={(e) => handleFieldChange('clientPhone', e.target.value)} 
                    placeholder="010-1234-5678"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">나이</label>
                  <input 
                    type="number" 
                    value={profile.age || 0} 
                    onChange={(e) => handleFieldChange('age', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">거주지 주소</label>
                  <input 
                    type="text" 
                    value={profile.address || ''} 
                    onChange={(e) => handleFieldChange('address', e.target.value)} 
                    placeholder="서울특별시 강남구..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">근무지/사업장 주소</label>
                  <input 
                    type="text" 
                    value={profile.workLocation || ''} 
                    onChange={(e) => handleFieldChange('workLocation', e.target.value)} 
                    placeholder="서울특별시 서초구..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>
            </div>

            {/* 1. 소득 및 고용 정보 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">1. 소득 및 고용 형태</h4>
              
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">고용 형태</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { label: '직장인', value: 'salary' },
                    { label: '사업자', value: 'business' },
                    { label: '프리랜서', value: 'freelancer' },
                    { label: '직장+사업', value: 'both' },
                    { label: '일용직', value: 'daily' },
                    { label: '무직/수급', value: 'none' },
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleFieldChange('employmentType', item.value)}
                      className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                        profile.employmentType === item.value
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">세후 실수령 소득 (월급, 만 원)</label>
                  <input 
                    type="number" 
                    value={profile.income || 0} 
                    onChange={(e) => handleFieldChange('income', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">월 고정 지출 (통신/보험/교통 등, 만 원)</label>
                  <input 
                    type="number" 
                    value={profile.monthlyFixedExpenses || 0} 
                    onChange={(e) => handleFieldChange('monthlyFixedExpenses', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>
            </div>

            {/* 2. 가족 구성 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">2. 가족 구성</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">결혼 상태</label>
                  <select
                    value={profile.maritalStatus || 'SINGLE'}
                    onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    <option value="SINGLE">미혼 (1인가구 기준)</option>
                    <option value="MARRIED">기혼 (부부 자산 공동산정 기준)</option>
                    <option value="DIVORCED">이혼 (양육/양육비 공제 기준)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">미성년 자녀 수 (명)</label>
                  <input 
                    type="number" 
                    value={profile.minorChildren || 0} 
                    onChange={(e) => handleFieldChange('minorChildren', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">나를 제외하고 실제로 부양하는 가족 수 (명)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleFieldChange('dependents', num)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        profile.dependents === num
                        ? 'bg-brand border-brand text-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
                      }`}
                    >
                      {num}명 ({num + 1}인 생계)
                    </button>
                  ))}
                </div>
                {profile.dependents === 2 && (
                  <span className="text-[10px] text-brand block mt-1">
                    💡 부양가족 2명 ➡️ 본인 포함 3인 가구로 인정되어 2026 기준 최저 생계비 {formatCurrency(301.2)}이 자동 공제됩니다.
                  </span>
                )}
              </div>

              {/* 기혼 시 배우자 소득 */}
              {profile.maritalStatus === 'MARRIED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">배우자 월 소득 (만 원)</label>
                    <input 
                      type="number" 
                      value={profile.spouseIncome || 0} 
                      onChange={(e) => handleFieldChange('spouseIncome', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                    <input 
                      type="number" 
                      value={profile.spouseAsset || 0} 
                      onChange={(e) => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                    <span className="text-[9px] text-slate-400 block">※ 법원 실무준칙에 따라 기혼 시 배우자 자산의 50%가 반영될 수 있습니다.</span>
                  </div>
                </div>
              )}

              {/* 이혼 시 양육비 */}
              {profile.maritalStatus === 'DIVORCED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">양육비 수령액 (월, 만 원)</label>
                    <input 
                      type="number" 
                      value={profile.childSupportReceived || 0} 
                      onChange={(e) => handleFieldChange('childSupportReceived', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">양육비 지급액 (월, 만 원)</label>
                    <input 
                      type="number" 
                      value={profile.childSupportPaid || 0} 
                      onChange={(e) => handleFieldChange('childSupportPaid', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. 주거 및 자산 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">3. 주거 유형 및 재산 가치 설정</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">거주 주택 유형</label>
                  <select
                    value={profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 ? 'rent' : 'free'}
                    onChange={(e) => {
                      if (e.target.value === 'free') {
                        handleFieldChange('rentalDeposit', 0);
                      } else {
                        handleFieldChange('rentalDeposit', 1000); // Default placeholder
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    <option value="rent">임차 (전세/월세 보증금 있음)</option>
                    <option value="free">자가 또는 무상 거주 (보증금 없음)</option>
                  </select>
                </div>

                {profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">임차 보증금 (만 원)</label>
                    <input 
                      type="number" 
                      value={profile.rentalDeposit || 0} 
                      onChange={(e) => handleFieldChange('rentalDeposit', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">월세 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.rentCost || 0} 
                    onChange={(e) => handleFieldChange('rentCost', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">보증금 대출금 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.depositLoan || 0} 
                    onChange={(e) => handleFieldChange('depositLoan', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">본인 재산 총액 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.myAssets || 0} 
                    onChange={(e) => handleFieldChange('myAssets', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                  <span className="text-[9px] text-slate-400 block">※ 예금, 보험 해지환급금, 자동차 시세 등 본인 명의 자산 합계</span>
                </div>

                {profile.maritalStatus !== 'MARRIED' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                    <input 
                      type="number" 
                      value={profile.spouseAsset || 0} 
                      onChange={(e) => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">예상 퇴직금 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.retirementPay || 0} 
                    onChange={(e) => handleFieldChange('retirementPay', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">퇴직연금 가입 종류</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '퇴직연금 (DB/DC)', value: 'pension' },
                    { label: '일반 퇴직금', value: 'none' },
                    { label: '잘 모름', value: 'unknown' }
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleFieldChange('retirementPensionType', item.value)}
                      className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                        profile.retirementPensionType === item.value
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {profile.retirementPensionType === 'pension' && (
                  <span className="text-[10px] text-[#10B981] block mt-1">
                    🛡️ 법률 보호 확인: 퇴직연금 가입 상태이므로 자산 반영에서 완전히 배제(0% 가산)됩니다.
                  </span>
                )}
              </div>
            </div>

            {/* 4. 추가 생계비 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">4. 추가 생계비 (월 기준)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">의료비 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.medicalCost || 0} 
                    onChange={(e) => handleFieldChange('medicalCost', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">교육비 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.educationCost || 0} 
                    onChange={(e) => handleFieldChange('educationCost', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">특수교육비 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.specialEducationCost || 0} 
                    onChange={(e) => handleFieldChange('specialEducationCost', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                  <span className="text-[9px] text-slate-400 block">※ 장애인 자녀 등 특수교육 관련 지출</span>
                </div>
              </div>
            </div>

            {/* 5. 채무 구성 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">5. 채무 구성 설정</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">은행/1금융권 대출 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.debtTypes?.banks || 0} 
                    onChange={(e) => handleDebtChange('banks', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">카드 대금 및 카드론 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.debtTypes?.cards || 0} 
                    onChange={(e) => handleDebtChange('cards', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">캐피탈/대부/기타 채무 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.debtTypes?.personals || 0} 
                    onChange={(e) => handleDebtChange('personals', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">국세/지방세/체납세금 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.priorityDebt || 0} 
                    onChange={(e) => handleFieldChange('priorityDebt', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                  <span className="text-[9px] text-[#EF4444] block">※ 국세 체납 채무는 우선변제 채무에 해당하여 회생 변제금에서 우선 순위 공제됩니다.</span>
                </div>
              </div>
            </div>

            {/* 6. 투자/도박 리스크 및 특수조건 */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
              <h4 className="text-xs font-bold text-slate-400 border-l-2 border-brand pl-2">6. 투자/사행성 채무 및 특수 조건</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">주식/코인 투자 손실액 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.speculativeLoss || 0} 
                    onChange={(e) => handleFieldChange('speculativeLoss', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">도박/사행성 손실 채무액 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.gamblingLoss || 0} 
                    onChange={(e) => handleFieldChange('gamblingLoss', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">24개월 특례 조건</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: '해당 없음', value: 'none' },
                    { label: '기초수급자', value: 'basic_recipient' },
                    { label: '중증장애인', value: 'severe_disability' },
                    { label: '65세 이상 고령', value: 'elderly' },
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleFieldChange('specialCondition', item.value)}
                      className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                        (profile.specialCondition || 'none') === item.value
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {profile.specialCondition && profile.specialCondition !== 'none' && (
                  <span className="text-[10px] text-[#10B981] block mt-1">
                    ✅ 24개월 특례 조건 해당: 변제기간이 36개월에서 24개월로 단축됩니다.
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">현재 법적 조치 상황</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: '추심 전화/문자', value: 'collection_call' },
                    { label: '법원 지급명령', value: 'court_order' },
                    { label: '재산 압류', value: 'seizure' },
                    { label: '급여 압류', value: 'wage_garnishment' },
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        const current = profile.legalActions || [];
                        const updated = current.includes(item.value)
                          ? current.filter(v => v !== item.value)
                          : [...current, item.value];
                        handleFieldChange('legalActions', updated);
                      }}
                      className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                        (profile.legalActions || []).includes(item.value)
                        ? 'bg-red-500 border-red-500 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="text-[9px] text-slate-400 block">※ 해당 항목을 클릭하여 선택/해제합니다. 복수 선택 가능합니다.</span>
              </div>
            </div>

            {/* 저장 완료 & 채팅방 이동 버튼 */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onNavigateToChat()}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                상담 채팅방으로 돌아가기
              </button>
              <button
                type="button"
                onClick={() => {
                  // 꽃가루 이펙트
                  confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.8 },
                    colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#10b981', '#f59e0b']
                  });
                  // 토스트 알림
                  toast.success('진단서가 성공적으로 저장되었습니다!', {
                    description: '상단 채무조정 상태 지표가 실시간으로 갱신되었습니다.',
                    duration: 4000,
                  });
                }}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-sm font-extrabold shadow-lg hover:shadow-brand-sm transition-all cursor-pointer transform active:scale-[0.97]"
              >
                <Save className="w-4.5 h-4.5" />
                진단서 수정 저장 완료
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
