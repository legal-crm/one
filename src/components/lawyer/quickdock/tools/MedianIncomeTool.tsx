import React, { useState } from 'react';
import { Users, Calculator, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// 2026년도 기준중위소득 및 60% 법정 최저생계비 고시 기준
const MEDIAN_INCOME_2026 = [
  { size: 1, full: 2392013, min60: 1435208 },
  { size: 2, full: 3932828, min60: 2359697 },
  { size: 3, full: 5025354, min60: 3015212 },
  { size: 4, full: 6097773, min60: 3658664 },
  { size: 5, full: 7114976, min60: 4268986 },
  { size: 6, full: 8079849, min60: 4847909 },
];

export default function MedianIncomeTool() {
  const [familySize, setFamilySize] = useState<number>(1);
  const [myIncome, setMyIncome] = useState<number>(2500000);
  const [copied, setCopied] = useState(false);

  const selectedMedian = MEDIAN_INCOME_2026.find(m => m.size === familySize) || MEDIAN_INCOME_2026[0];
  const calculatedDisposable = Math.max(0, myIncome - selectedMedian.min60);

  const handleCopy = () => {
    const text = `[2026 가용소득 산정 기준]
• 가구원수: ${familySize}인 가구
• 법정 최저생계비(60%): ${selectedMedian.min60.toLocaleString()}원
• 의뢰인 월 소득: ${myIncome.toLocaleString()}원
• 예상 월 가용소득(변제금): ${calculatedDisposable.toLocaleString()}원`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('생계비 및 가용소득 산출 결과가 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800">
      {/* 기준표 테이블 */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
        <table className="w-full text-[11px] text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
            <tr>
              <th className="py-2 px-2.5">가구원수</th>
              <th className="py-2 px-2.5">중위소득(100%)</th>
              <th className="py-2 px-2.5 text-teal-700 bg-teal-50/70">인정생계비(60%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MEDIAN_INCOME_2026.map(item => (
              <tr 
                key={item.size} 
                onClick={() => setFamilySize(item.size)}
                className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                  familySize === item.size ? 'bg-teal-50/80 font-bold' : ''
                }`}
              >
                <td className="py-1.5 px-2.5 flex items-center gap-1">
                  {familySize === item.size && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                  <span>{item.size}인 가구</span>
                </td>
                <td className="py-1.5 px-2.5 text-slate-600 tabular-nums">{item.full.toLocaleString()}원</td>
                <td className="py-1.5 px-2.5 text-teal-700 font-extrabold tabular-nums bg-teal-50/30">
                  {item.min60.toLocaleString()}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 가용소득 즉시 시뮬레이터 */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-teal-600" />
          월 가용소득(예상 월 변제금) 즉시 계산
        </span>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">부양가족 수</label>
            <select
              value={familySize}
              onChange={e => setFamilySize(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer"
            >
              {MEDIAN_INCOME_2026.map(m => (
                <option key={m.size} value={m.size}>{m.size}인 가구</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">실수령 월 소득 (원)</label>
            <input
              type="number"
              step={50000}
              value={myIncome}
              onChange={e => setMyIncome(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 tabular-nums"
            />
          </div>
        </div>

        <div className="p-2.5 bg-white rounded-lg border border-teal-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">소득 - 60% 생계비</span>
            <span className="text-xs font-bold text-slate-700">예상 월 변제금</span>
          </div>
          <span className="text-sm font-black text-teal-700 tabular-nums">
            월 {calculatedDisposable.toLocaleString()}원
          </span>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '산출 결과 복사하기'}</span>
      </button>
    </div>
  );
}
