import React, { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { setDockShared, useDockShared } from '../dockShared';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import { formatWonKorean, won } from '../ui/money';

/**
 * 대출이자 vs 회생 변제금 비교
 * - 원금·월 변제금은 퀵독 공유값 (변제율 도구와 같은 값)
 * - 현재 실제 월 상환액을 알면 그 값으로, 모르면 '이자만' 추정값으로 비교한다.
 */
export default function InterestCompareTool() {
  const shared = useDockShared();
  const [rateText, setRateText] = useState('');
  const [currentMonthlyActual, setCurrentMonthlyActual] = useState(0);
  const { copied, copy } = useCopyFeedback();

  const rate = Math.max(0, Math.min(100, Number(rateText) || 0));
  const principal = shared.totalDebt;
  const rehabMonthly = shared.monthlyPay;

  // 기존 월 이자 부담액 = 원금 × (이자율 / 100) / 12
  const monthlyInterestOnly = Math.round((principal * (rate / 100)) / 12);
  const totalInterest36 = monthlyInterestOnly * 36;
  const currentMonthly = currentMonthlyActual > 0 ? currentMonthlyActual : monthlyInterestOnly;
  const monthlySaving = Math.max(0, currentMonthly - rehabMonthly);
  const hasInput = principal > 0 && (rate > 0 || currentMonthlyActual > 0);

  const handleCopy = () => {
    const text = `[기존 대출 상환 부담 vs 개인회생 변제금 비교 (참고)]
• 채무 원금: ${formatWonKorean(principal)}${rate > 0 ? ` (연 평균 금리 ${rate}%)` : ''}
${rate > 0 ? `• 현재 월 이자 부담: 약 ${won(monthlyInterestOnly)} (원금은 그대로 유지)\n• 36개월간 이자 합계: 약 ${formatWonKorean(totalInterest36)}\n` : ''}${currentMonthlyActual > 0 ? `• 현재 실제 월 상환액: ${won(currentMonthlyActual)}\n` : ''}-------------------------------------------
• 개인회생 예상 월 변제금: ${won(rehabMonthly)}
• 월 납입 차이: 약 ${won(monthlySaving)}
• 참고: 변제계획 인가 후 성실히 변제하고 면책결정을 받으면 잔존 채무(비면책채권 제외)의 책임이 면제됩니다. 실제 변제금은 법원 인가 내용에 따릅니다.`;
    copy(text, '금융비용 비교 브리핑이 복사되었습니다.');
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <div className="space-y-2">
        <div>
          <label htmlFor="interest-principal" className="text-[10px] text-slate-600 font-semibold block mb-0.5">기존 총 대출 원금 (변제율 도구와 공유)</label>
          <MoneyInput id="interest-principal" value={principal} onChange={v => setDockShared({ totalDebt: v })} placeholder="예: 6000만" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="interest-rate" className="text-[10px] text-slate-600 font-semibold block mb-0.5">기존 대출 평균금리 (%)</label>
            <input
              id="interest-rate"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.1}
              value={rateText}
              onChange={e => setRateText(e.target.value)}
              placeholder="예: 15"
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 tabular-nums placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div>
            <label htmlFor="interest-rehab" className="text-[10px] text-slate-600 font-semibold block mb-0.5">회생 예상 월 변제금</label>
            <MoneyInput id="interest-rehab" value={rehabMonthly} onChange={v => setDockShared({ monthlyPay: v })} placeholder="예: 45만" />
          </div>
          <div className="col-span-2">
            <label htmlFor="interest-actual" className="text-[10px] text-slate-600 font-semibold block mb-0.5">현재 실제 월 상환액 (알면 입력, 원리금 합계)</label>
            <MoneyInput id="interest-actual" value={currentMonthlyActual} onChange={setCurrentMonthlyActual} placeholder="모르면 비워두세요 — 이자만으로 추정" />
          </div>
        </div>
      </div>

      {hasInput ? (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50/50 p-3 rounded-2xl border border-cyan-200 space-y-2" aria-live="polite">
          {rate > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">현재 월 이자 (원금 유지)</span>
                <span className="font-extrabold text-rose-700 tabular-nums">월 약 {won(monthlyInterestOnly)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">36개월 이자 합계</span>
                <span className="font-extrabold text-rose-800 tabular-nums">약 {formatWonKorean(totalInterest36)}</span>
              </div>
            </>
          )}
          {currentMonthlyActual > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">현재 실제 월 상환액</span>
              <span className="font-extrabold text-rose-800 tabular-nums">{won(currentMonthlyActual)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-cyan-200 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-cyan-950 block">개인회생 인가 후 월 변제금</span>
              <span className="text-[10px] text-cyan-900">변제계획에 따른 분할 변제 (면책 시 잔존채무 면제)</span>
            </div>
            <span className="text-base font-black text-cyan-800 tabular-nums">월 {won(rehabMonthly)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              월 납입 차이
            </span>
            <span className="tabular-nums">약 {won(monthlySaving)}</span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-600 border border-slate-200 space-y-1">
          <TrendingDown className="w-5 h-5 mx-auto text-slate-500" aria-hidden="true" />
          <p className="font-bold">원금과 금리(또는 현재 월 상환액)를 입력하세요.</p>
          <p className="text-[11px] text-slate-500">현재 상환 부담과 개인회생 월 변제금을 나란히 비교합니다.</p>
        </div>
      )}

      <CopyButton copied={copied} onClick={handleCopy} disabled={!hasInput} label="상환 부담 비교 복사" />
    </div>
  );
}
