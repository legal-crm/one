import React, { useState } from 'react';
import { 
  Trophy, CheckCircle2, Copy, Check, Calendar, CreditCard, 
  Sparkles, Edit3, Save, AlertTriangle, ShieldCheck, PieChart
} from 'lucide-react';
import { toast } from 'sonner';
import type { DecisionSummaryData } from '../../../types';

interface DecisionSummaryCardProps {
  clientName: string;
  data?: DecisionSummaryData;
  onSave?: (updatedData: DecisionSummaryData) => void;
  readOnly?: boolean;
}

export default function DecisionSummaryCard({
  clientName,
  data,
  onSave,
  readOnly = false,
}: DecisionSummaryCardProps) {
  // 기본 Mock/초기 데이터 산출
  const defaultTotalDebt = data?.totalDebt || 12000; // 만 원 (1억 2천만 원)
  const defaultTotalRepay = data?.totalRepayment || 2160; // 만 원 (2,160만 원)
  const defaultMonths = data?.repaymentMonths || 36;
  const defaultMonthly = data?.monthlyPayment || Math.round((defaultTotalRepay / defaultMonths) * 10000); // 60만 원
  const defaultDischarged = Math.max(0, defaultTotalDebt - defaultTotalRepay); // 9,840만 원
  const defaultDischargeRate = defaultTotalDebt > 0 ? Math.round((defaultDischarged / defaultTotalDebt) * 100) : 82;
  const defaultRepayRate = 100 - defaultDischargeRate;

  const [form, setForm] = useState<DecisionSummaryData>({
    courtName: data?.courtName || '서울회생법원',
    caseNumber: data?.caseNumber || '2025개회104921',
    commencementDate: data?.commencementDate || new Date().toISOString().slice(0, 10),
    totalDebt: defaultTotalDebt,
    totalRepayment: defaultTotalRepay,
    repaymentRate: defaultRepayRate,
    totalDischarged: defaultDischarged,
    dischargeRate: defaultDischargeRate,
    monthlyPayment: defaultMonthly,
    repaymentMonths: defaultMonths,
    virtualAccountBank: data?.virtualAccountBank || '신한은행',
    virtualAccountNumber: data?.virtualAccountNumber || '562-901-883921 (서울회생법원)',
    firstPaymentDate: data?.firstPaymentDate || '2025-04-25',
    specialMemo: data?.specialMemo || '1회차 납입일 전 유선 해피콜 완료. 자동이체 등록 확인 필요.',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleCopyAccount = () => {
    const text = `${form.virtualAccountBank} ${form.virtualAccountNumber}`;
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    toast.success('법원 가상계좌번호가 복사되었습니다.');
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(form);
    }
    setIsEditing(false);
    toast.success('개시결정 요약 정보가 저장되었습니다.');
  };

  // SVG 원형 도넛 게이지 파라미터
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (form.dischargeRate / 100) * circumference;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl border border-slate-700/80 shadow-xl overflow-hidden">
      {/* 카드 헤더 */}
      <div className="px-6 py-4.5 border-b border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-lg text-white tracking-tight">개시결정 핵심 요약본</h3>
              <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                개시결정 완료
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {form.courtName} · 사건번호: <span className="font-mono text-slate-200 font-bold">{form.caseNumber}</span>
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer press-scale ${
              isEditing 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black' 
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
          >
            {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? '저장 완료' : '결정 수정'}</span>
          </button>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* 좌측: 대형 원형 도넛 게이지 차트 (탕감률 & 변제율) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* 배경 원 (변제율) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-slate-700 stroke-current"
                strokeWidth="10"
                fill="transparent"
              />
              {/* 탕감률 원 */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-emerald-500 stroke-current transition-all duration-1000 ease-out"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">탕감률</span>
              <span className="text-3xl font-black text-emerald-400 tracking-tight tabular-nums">
                {form.dischargeRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">변제율 {form.repaymentRate}%</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              면책 탕감: {(form.totalDischarged / 10000 >= 1 ? `${(form.totalDischarged / 10000).toFixed(1)}억` : `${form.totalDischarged.toLocaleString()}만`)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              변제: {(form.totalRepayment / 10000 >= 1 ? `${(form.totalRepayment / 10000).toFixed(1)}억` : `${form.totalRepayment.toLocaleString()}만`)}
            </span>
          </div>
        </div>

        {/* 우측: 핵심 결정 지표 그리드 (변제금, 변제기간, 가상계좌, 메모) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 총 채무액 */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">원금 총 채무액</span>
              <span className="text-base sm:text-lg font-black text-white tabular-nums">
                {form.totalDebt.toLocaleString()}만 원
              </span>
            </div>

            {/* 총 변제 예정액 */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-emerald-400 font-bold block mb-1">총 변제 예정액</span>
              <span className="text-base sm:text-lg font-black text-emerald-300 tabular-nums">
                {form.totalRepayment.toLocaleString()}만 원
              </span>
            </div>

            {/* 변제 기간 */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">변제 기간</span>
              <span className="text-base sm:text-lg font-black text-white tabular-nums">
                {form.repaymentMonths}개월 (3년)
              </span>
            </div>

            {/* 월 변제금 */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 sm:col-span-2">
              <span className="text-[11px] text-amber-400 font-bold block mb-1">확정 월 변제금</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-amber-300 tabular-nums">
                  월 {Number(form.monthlyPayment).toLocaleString()}원
                </span>
                <span className="text-xs text-slate-400">매월 지정일 납부</span>
              </div>
            </div>

            {/* 첫 회차 납입일 */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[11px] text-slate-400 font-bold block mb-1">1회차 납입 개시일</span>
              <span className="text-sm font-bold text-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {form.firstPaymentDate}
              </span>
            </div>
          </div>

          {/* 법원 가상계좌 원클릭 바 */}
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">법원 변제금 전용 가상계좌</span>
                <p className="text-xs sm:text-sm font-mono font-bold text-white truncate">
                  {form.virtualAccountBank} {form.virtualAccountNumber}
                </p>
              </div>
            </div>
            <button
              onClick={handleCopyAccount}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 press-scale active:scale-95"
            >
              {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAccount ? '복사됨' : '계좌 복사'}</span>
            </button>
          </div>

          {/* 특이사항 & 관리 메모 */}
          <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/40 text-xs">
            <span className="text-slate-400 font-bold block mb-1">의뢰인 특이사항 및 변제 유의 메모:</span>
            {isEditing ? (
              <textarea
                value={form.specialMemo}
                onChange={e => setForm(prev => ({ ...prev, specialMemo: e.target.value }))}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-slate-300 leading-relaxed">
                {form.specialMemo || '등록된 메모가 없습니다.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
