import React, { useState } from 'react';
import { Percent, Copy, Check, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function RehabPayCalcTool() {
  const [totalDebt, setTotalDebt] = useState<number>(80000000); // 8,000만원
  const [monthlyPay, setMonthlyPay] = useState<number>(500000); // 월 50만원
  const [periodMonths, setPeriodMonths] = useState<number>(36); // 36개월
  const [copied, setCopied] = useState(false);

  const totalRepayment = monthlyPay * periodMonths;
  const forgivenAmount = Math.max(0, totalDebt - totalRepayment);
  const repaymentRate = totalDebt > 0 ? Math.min(100, (totalRepayment / totalDebt) * 100) : 0;
  const forgivenessRate = Math.max(0, 100 - repaymentRate);

  const handleCopy = () => {
    const text = `[개인회생 변제율 & 탕감 브리핑]
• 총 원금 채무액: ${(totalDebt / 10000).toLocaleString()}만 원
• 월 변제금: ${(monthlyPay / 10000).toLocaleString()}만 원 × ${periodMonths}개월
• 총 변제액: ${(totalRepayment / 10000).toLocaleString()}만 원 (변제율: ${repaymentRate.toFixed(1)}%)
• 원금 탕감액: ${(forgivenAmount / 10000).toLocaleString()}만 원 (탕감률: ${forgivenessRate.toFixed(1)}% 탕감)
* 이자는 전액(100%) 면책 처리됩니다.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('변제율 및 탕감 브리핑 문구가 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <div className="space-y-2">
        <div>
          <div className="flex justify-between font-bold text-slate-700 mb-1">
            <span>총 원금 채무액</span>
            <span className="text-indigo-600 font-extrabold font-mono">{(totalDebt / 10000).toLocaleString()}만 원</span>
          </div>
          <input
            type="number"
            step={1000000}
            value={totalDebt}
            onChange={e => setTotalDebt(Math.max(0, Number(e.target.value)))}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between font-bold text-slate-700 mb-1">
              <span>월 예상 변제금</span>
              <span className="text-slate-900 font-bold font-mono">{(monthlyPay / 10000).toLocaleString()}만</span>
            </div>
            <input
              type="number"
              step={50000}
              value={monthlyPay}
              onChange={e => setMonthlyPay(Math.max(0, Number(e.target.value)))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
            />
          </div>

          <div>
            <span className="font-bold text-slate-700 block mb-1">변제 기간</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setPeriodMonths(36)}
                className={`py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-center ${
                  periodMonths === 36 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                36개월 (원칙)
              </button>
              <button
                type="button"
                onClick={() => setPeriodMonths(60)}
                className={`py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-center ${
                  periodMonths === 60 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                60개월 (청산가치)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 결과 지표 카드 */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-3 rounded-xl border border-indigo-200/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">총 납입 변제액 ({periodMonths}개월)</span>
          <span className="font-bold text-slate-900 font-mono">{(totalRepayment / 10000).toLocaleString()}만 원</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">원금 탕감 총액</span>
          <span className="font-bold text-indigo-700 font-mono">{(forgivenAmount / 10000).toLocaleString()}만 원</span>
        </div>

        <div className="pt-2 border-t border-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span className="font-extrabold text-slate-800">원금 탕감률</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-indigo-700 font-mono">{forgivenessRate.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-500 block">변제율: {repaymentRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '변제율 브리핑 문구 복사'}</span>
      </button>
    </div>
  );
}
