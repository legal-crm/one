import React, { useState } from 'react';
import { Coins, CheckCircle, AlertTriangle, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function LiquidationCalcTool() {
  // 자산 항목들 (만원 단위)
  const [realEstate, setRealEstate] = useState<number>(0);
  const [vehicle, setVehicle] = useState<number>(300);
  const [severance, setSeverance] = useState<number>(500); // 퇴직금 예상액의 1/2
  const [savingsInsurance, setSavingsInsurance] = useState<number>(200); // 185만원 초과분
  const [otherAssets, setOtherAssets] = useState<number>(0);

  // 변제 계획 (만원 단위)
  const [monthlyPay, setMonthlyPay] = useState<number>(60);
  const [periodMonths, setPeriodMonths] = useState<number>(36);
  const [copied, setCopied] = useState(false);

  const totalLiquidationValue = realEstate + vehicle + severance + savingsInsurance + otherAssets;
  const totalRepayment = monthlyPay * periodMonths;
  const isSatisfied = totalRepayment >= totalLiquidationValue;
  const diff = Math.abs(totalRepayment - totalLiquidationValue);

  const handleCopy = () => {
    const text = `[청산가치 보장의 원칙 점검 결과]
• 총 청산가치(순자산): ${totalLiquidationValue.toLocaleString()}만 원
  - 부동산 순자산: ${realEstate.toLocaleString()}만 원
  - 차량 가액: ${vehicle.toLocaleString()}만 원
  - 퇴직금(1/2): ${severance.toLocaleString()}만 원
  - 예금/보험(공제후): ${savingsInsurance.toLocaleString()}만 원
• 총 변제예정액(${periodMonths}개월): ${totalRepayment.toLocaleString()}만 원 (월 ${monthlyPay.toLocaleString()}만 원)
• 결과: ${isSatisfied ? '✅ 청산가치 보장요건 충족' : `⚠️ 청산가치 ${diff.toLocaleString()}만 원 미달 (월 변제금 상향 또는 변제기간 연장 필요)`}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('청산가치 점검 결과가 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-800 block mb-2">1. 보유 자산 입력 (청산가치 반영액, 만원)</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">부동산 순자산</label>
            <input
              type="number"
              step={50}
              value={realEstate}
              onChange={e => setRealEstate(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              placeholder="시세-대출"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">차량 중고가액</label>
            <input
              type="number"
              step={10}
              value={vehicle}
              onChange={e => setVehicle(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">예상 퇴직금 (1/2)</label>
            <input
              type="number"
              step={10}
              value={severance}
              onChange={e => setSeverance(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">예금·보험(185만 초과)</label>
            <input
              type="number"
              step={10}
              value={savingsInsurance}
              onChange={e => setSavingsInsurance(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* 변제 계획 대비 */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-800 block mb-2">2. 변제 계획 (만원)</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">월 변제금</label>
            <input
              type="number"
              step={5}
              value={monthlyPay}
              onChange={e => setMonthlyPay(Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">변제 기간</label>
            <select
              value={periodMonths}
              onChange={e => setPeriodMonths(Number(e.target.value))}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              <option value={36}>36개월</option>
              <option value={48}>48개월</option>
              <option value={60}>60개월</option>
            </select>
          </div>
        </div>
      </div>

      {/* 판정 결과 */}
      <div className={`p-3 rounded-xl border ${
        isSatisfied ? 'bg-emerald-50/80 border-emerald-300' : 'bg-rose-50/80 border-rose-300'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {isSatisfied ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span className={`font-bold ${isSatisfied ? 'text-emerald-900' : 'text-rose-900'}`}>
              {isSatisfied ? '청산가치 보장 충족 (인가 가능)' : '청산가치 미달 (보정명령 위험)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
          <div>
            <span className="text-slate-500 block">총 청산가치:</span>
            <span className="font-extrabold text-slate-900 font-mono">{totalLiquidationValue.toLocaleString()}만 원</span>
          </div>
          <div>
            <span className="text-slate-500 block">총 변제예정액:</span>
            <span className={`font-extrabold font-mono ${isSatisfied ? 'text-emerald-700' : 'text-rose-700'}`}>
              {totalRepayment.toLocaleString()}만 원
            </span>
          </div>
        </div>
        {!isSatisfied && (
          <p className="text-[10px] text-rose-700 mt-2 font-medium">
            💡 최소 월 {Math.ceil(totalLiquidationValue / periodMonths).toLocaleString()}만 원 이상 변제하거나 변제기간을 60개월로 늘려야 합니다.
          </p>
        )}
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '점검 결과 복사'}</span>
      </button>
    </div>
  );
}
