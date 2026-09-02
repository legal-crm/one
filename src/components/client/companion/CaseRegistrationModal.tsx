import React, { useState } from 'react';
import { X, Check, Building2, UserCheck, ShieldCheck, Upload, FileText, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { CompanionSourceType } from '../../../types';
import { registerNewCompanionCase } from '../../../services/companionService';
import { toast } from 'sonner';

interface CaseRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAlias?: string;
}

const COURTS = [
  '서울회생법원', '수원회생법원', '부산회생법원',
  '의정부지방법원', '인천지방법원', '춘천지방법원',
  '대전지방법원', '청주지방법원', '대구지방법원',
  '부산지방법원', '울산지방법원', '창원지방법원',
  '광주지방법원', '전주지방법원', '제주지방법원'
];

export default function CaseRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  initialAlias = '회원'
}: CaseRegistrationModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceType, setSourceType] = useState<CompanionSourceType>('external_office');
  const [externalOfficeName, setExternalOfficeName] = useState('');
  const [caseType, setCaseType] = useState<'individual_rehab' | 'bankruptcy'>('individual_rehab');
  
  // 사건 정보
  const [courtName, setCourtName] = useState('서울회생법원');
  const [caseNumber, setCaseNumber] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  
  // 변제 조건
  const [monthlyRepaymentAmount, setMonthlyRepaymentAmount] = useState<number>(480000);
  const [repaymentDay, setRepaymentDay] = useState<number>(10);
  const [totalRounds, setTotalRounds] = useState<number>(36);
  const [completedRounds, setCompletedRounds] = useState<number>(14);
  const [startRepaymentDate, setStartRepaymentDate] = useState<string>('2025-07');
  const [courtVirtualAccount, setCourtVirtualAccount] = useState<string>('신한은행 110-***-849201');
  
  // 소득/생계비
  const [monthlyIncome, setMonthlyIncome] = useState<number>(2800000);
  const [essentialLivingCost, setEssentialLivingCost] = useState<number>(1750000);
  const [otherFixedExpenses, setOtherFixedExpenses] = useState<number>(320000);

  if (!isOpen) return null;

  // OCR 시뮬레이션
  const handleOcrUpload = (file: File) => {
    setIsOcrProcessing(true);
    toast.info('문서에서 사건번호와 변제계획을 분석하고 있습니다...');
    
    setTimeout(() => {
      setIsOcrProcessing(false);
      setCourtName('서울회생법원');
      setCaseNumber('2024개회108492');
      setMonthlyRepaymentAmount(480000);
      setTotalRounds(36);
      setStartRepaymentDate('2025-07');
      toast.success('결정문에서 사건정보 5건이 자동 입력되었습니다. 내용을 확인해 주세요.');
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) {
      toast.error('사건번호를 입력해 주세요 (예: 2024개회123456)');
      return;
    }

    try {
      registerNewCompanionCase({
        alias: initialAlias,
        sourceType,
        externalOfficeName: sourceType === 'external_office' ? externalOfficeName : undefined,
        caseType,
        courtName,
        caseNumber: caseNumber.trim(),
        monthlyRepaymentAmount: Number(monthlyRepaymentAmount) || 0,
        repaymentDay: Number(repaymentDay) || 10,
        totalRounds: Number(totalRounds) || 36,
        completedRounds: Number(completedRounds) || 0,
        startRepaymentDate,
        courtVirtualAccount: courtVirtualAccount.trim(),
        monthlyIncome: Number(monthlyIncome) || 0,
        essentialLivingCost: Number(essentialLivingCost) || 0,
        otherFixedExpenses: Number(otherFixedExpenses) || 0,
      });

      toast.success('🎉 회생동행 사건이 성공적으로 등록되었습니다!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('사건 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <span className="text-[11px] font-bold text-brand bg-brand/10 dark:bg-brand/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              전국 모든 회생·파산인 무료 지원
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
              마이김변 2.0 회생동행 간편 등록
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 스텝 바 */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
          {[
            { num: 1, label: '진행 방식' },
            { num: 2, label: '사건 정보' },
            { num: 3, label: '변제 & 생계' }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.num ? 'bg-brand text-white shadow-sm' :
                step > s.num ? 'bg-emerald-500 text-white' :
                'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={`text-xs font-bold ${step === s.num ? 'text-brand dark:text-brand-light' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {s.num < 3 && <div className="flex-1 h-0.5 bg-slate-100 dark:bg-slate-800 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* 모달 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          
          {/* STEP 1: 진행 방식 선택 */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  현재 어떤 방식으로 사건을 진행하고 계신가요?
                </h4>
                <p className="text-xs text-slate-500">
                  타 법무법인/법무사 또는 나홀로 전자소송으로 진행 중이셔도 모든 일정을 무료로 관리해 드립니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSourceType('external_office')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'external_office'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 w-fit">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">타 법률사무소 / 법무사</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">외부 사무소에서 수임 진행 중</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('self_litigant')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'self_litigant'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 w-fit">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">나홀로 전자소송</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">본인이 직접 법원에 접수·진행</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('mykim_lawyer')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'mykim_lawyer'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 w-fit">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">마이김변 전담 변호사</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">마이김변 플랫폼 매칭 수임</span>
                  </div>
                </button>
              </div>

              {sourceType === 'external_office' && (
                <div className="space-y-1.5 pt-2 animate-fadeIn">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    진행 중인 법무법인 / 법무사 상호명 (선택)
                  </label>
                  <input
                    type="text"
                    value={externalOfficeName}
                    onChange={(e) => setExternalOfficeName(e.target.value)}
                    placeholder="예: 법무법인 율*, 서초 종합법률사무소 등"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    * 입력하신 상호명은 본인 캘린더 메모용으로만 활용되며 외부에 노출되지 않습니다.
                  </p>
                </div>
              )}

              {/* 사건 구분 */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">사건 유형</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCaseType('individual_rehab')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      caseType === 'individual_rehab'
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🌱 개인회생 (3~5년 월 분할변제)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaseType('bankruptcy')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      caseType === 'bankruptcy'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🕊️ 개인파산·면책 (서류/기일 관리)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 사건 번호 및 관할 법원 */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* OCR 업로드 지원 배너 */}
              <div className="p-4 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-brand text-white shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">결정문 사진으로 1초 자동 완성</h5>
                    <p className="text-[11px] text-slate-500">
                      인가결정문 또는 변제계획안을 올리시면 사건번호와 변제금액을 자동으로 읽어옵니다.
                    </p>
                  </div>
                </div>
                <label className="px-3.5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-[0.98]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>문서 사진 올리기</span>
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleOcrUpload(e.target.files[0]);
                    }} 
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">관할 법원</label>
                  <select
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    {COURTS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    사건번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="예: 2024개회108492"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  법원 변제금 전용 가상계좌 (선택)
                </label>
                <input
                  type="text"
                  value={courtVirtualAccount}
                  onChange={(e) => setCourtVirtualAccount(e.target.value)}
                  placeholder="예: 신한은행 110-***-849201 (서울회생법원)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  * 가상계좌를 등록해 두시면 변제일마다 앱에서 바로 계좌번호를 복사해 송금하실 수 있습니다.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 flex items-start gap-2 text-slate-500">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  마이김변은 법원 데이터를 임의로 확정하지 않으며, 입력하신 사건번호는 암호화 가명 시스템으로 안전하게 보호됩니다.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: 변제 일정 및 생계 밸런서 설정 */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">매월 변제금 (원)</label>
                  <input
                    type="number"
                    value={monthlyRepaymentAmount}
                    onChange={(e) => setMonthlyRepaymentAmount(Number(e.target.value))}
                    step={10000}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <span className="text-[11px] text-brand font-bold block">
                    {(monthlyRepaymentAmount || 0).toLocaleString()}원 / 월
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">매월 납부일</label>
                  <select
                    value={repaymentDay}
                    onChange={(e) => setRepaymentDay(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>매월 {day}일</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">총 변제 회차</label>
                  <select
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    <option value={24}>24회 (청년/취약 특례 2년)</option>
                    <option value={36}>36회 (기본 3년)</option>
                    <option value={48}>48회 (4년)</option>
                    <option value={60}>60회 (최대 5년)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">현재까지 납부 완료 회차</label>
                  <input
                    type="number"
                    value={completedRounds}
                    onChange={(e) => setCompletedRounds(Number(e.target.value))}
                    min={0}
                    max={totalRounds}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    진행률: {totalRounds > 0 ? ((completedRounds / totalRounds) * 100).toFixed(1) : 0}%
                  </span>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">변제 시작 년월</label>
                  <input
                    type="month"
                    value={startRepaymentDate}
                    onChange={(e) => setStartRepaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* 월 생계 밸런서 설정 */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span>💡 30일 생계 밸런서 기준값 (선택)</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">월 실수령 소득</label>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      step={100000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">필수 생계비</label>
                    <input
                      type="number"
                      value={essentialLivingCost}
                      onChange={(e) => setEssentialLivingCost(Number(e.target.value))}
                      step={50000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">기타 고정지출</label>
                    <input
                      type="number"
                      value={otherFixedExpenses}
                      onChange={(e) => setOtherFixedExpenses(Number(e.target.value))}
                      step={10000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 모달 하단 액션 버튼 */}
          <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                이전 단계
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
              >
                다음 단계로 ➔
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>회생동행 시작하기</span>
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
}
