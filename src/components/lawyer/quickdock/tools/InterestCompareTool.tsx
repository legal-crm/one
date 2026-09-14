import React, { useState } from 'react';
import { TrendingDown, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function InterestCompareTool() {
  const [loanPrincipal, setLoanPrincipal] = useState<number>(60000000); // 6,000만원
  const [interestRate, setInterestRate] = useState<number>(16.5); // 연 16.5%
  const [rehabMonthly, setRehabMonthly] = useState<number>(450000); // 회생 월 변제금 45만원
  const [copied, setCopied] = useState(false);

  // 기존 월 이자 부담액 = 원금 * (이자율 / 100) / 12
  const monthlyInterestOnly = Math.round((loanPrincipal * (interestRate / 100)) / 12);
  // 36개월간 기존 이자 총액
  const totalInterest36 = monthlyInterestOnly * 36;
  // 월 절감 체감액
  const monthlySaving = Math.max(0, monthlyInterestOnly - rehabMonthly);

  const handleCopy = () => {
    const text = `[기존 대출이자 vs 개인회생 변제금 비교]
• 채무 원금: ${(loanPrincipal / 10000).toLocaleString()}만 원 (연 평균 금리 ${interestRate}%)
• 현재 월 이자 부담: 약 ${(monthlyInterestOnly / 10000).toLocaleString()}만 원 (원금은 그대로 유지)
• 36개월간 순수 이자 총액: 약 ${(totalInterest36 / 10000).toLocaleString()}만 원 발생 예정
-------------------------------------------
• 개인회생 신청 시 월 변제금: ${(rehabMonthly / 10000).toLocaleString()}만 원 (원금만 분할상환)
• 혜택: 향후 모든 이자 100% 면제 + 원금 일부 탕감
• 매월 실질 납입 절감: 월 약 ${(monthlySaving / 10000).toLocaleString()}만 원 절감 효과`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('금융비용 비교 브리핑이 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">기존 총 대출 원금 (원)</label>
          <input
            type="number"
            step={1000000}
            value={loanPrincipal}
            onChange={e => setLoanPrincipal(Math.max(0, Number(e.target.value)))}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">기존 대출 평균금리 (%)</label>
            <input
              type="number"
              step={0.5}
              value={interestRate}
              onChange={e => setInterestRate(Math.max(0, Number(e.target.value)))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">회생 예상 월변제금 (원)</label>
            <input
              type="number"
              step={50000}
              value={rehabMonthly}
              onChange={e => setRehabMonthly(Math.max(0, Number(e.target.value)))}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* 비교 지표 카드 */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50/50 p-3 rounded-xl border border-cyan-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">현재 납부 중인 월 이자</span>
          <span className="font-extrabold text-rose-600 font-mono">
            월 약 {(monthlyInterestOnly / 10000).toLocaleString()}만 원
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">36개월 유지 시 납부 이자</span>
          <span className="font-extrabold text-rose-700 font-mono">
            총 {(totalInterest36 / 10000).toLocaleString()}만 원 (원금 미포함)
          </span>
        </div>

        <div className="pt-2 border-t border-cyan-200 flex items-center justify-between">
          <div>
            <span className="font-extrabold text-cyan-950 block">개인회생 인가 후</span>
            <span className="text-[10px] text-cyan-800">이자 100% 면책 & 원금 상환</span>
          </div>
          <span className="text-base font-black text-cyan-700 font-mono">
            월 {(rehabMonthly / 10000).toLocaleString()}만 원
          </span>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '이자 절감 브리핑 복사'}</span>
      </button>
    </div>
  );
}
