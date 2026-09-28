import React, { useState } from 'react';
import { Calculator, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { calcCourtFees, DELIVERY_UNIT_FEE_KRW } from '../../../../services/court/courtFees';

export default function CalculatorTool() {
  const [caseType, setCaseType] = useState<'rehab' | 'bankruptcy'>('rehab');
  const [creditorCount, setCreditorCount] = useState<number>(5);
  const [hasProhibition, setHasProhibition] = useState<boolean>(true); // 금지명령
  const [hasStay, setHasStay] = useState<boolean>(false); // 중지명령
  const [isElectronic, setIsElectronic] = useState<boolean>(true); // 전자소송 10% 감액
  const [copied, setCopied] = useState(false);

  // 전자계약 법원비용과 같은 공용 산식 (services/court/courtFees.ts)
  const r = calcCourtFees({
    caseType,
    creditorCount,
    withProhibition: caseType === 'rehab' && hasProhibition,
    withStay: caseType === 'rehab' && hasStay,
    electronic: isElectronic,
  });
  const fees = { deliveryRounds: r.deliveryRounds, totalDeliveryFee: r.deliveryFee, stampFee: r.stampFee, totalCost: r.total };

  const handleCopy = () => {
    const text = `[법원비용 안내]
• 구분: ${caseType === 'rehab' ? '개인회생' : '개인파산·면책'}
• 채권자수: ${creditorCount}곳
• 총 송달료(${fees.deliveryRounds}회): ${fees.totalDeliveryFee.toLocaleString()}원
• 인지대: ${fees.stampFee.toLocaleString()}원 (${isElectronic ? '전자소송 10% 감액' : '서면'})
• 합계: ${fees.totalCost.toLocaleString()}원
※ 송달료 1회분 ${DELIVERY_UNIT_FEE_KRW.toLocaleString()}원 기준 예상액이며, 관할 법원 예납명령 금액이 우선합니다.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('법원비용 안내가 복사되었습니다. 상담창에 바로 붙여넣으세요.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 p-4 text-slate-800">
      {/* 사건 구분 */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setCaseType('rehab')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            caseType === 'rehab' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          개인회생 (10회+8C)
        </button>
        <button
          onClick={() => setCaseType('bankruptcy')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            caseType === 'bankruptcy' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          개인파산·면책 (8회+6C)
        </button>
      </div>

      {/* 채권자 수 입력 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>채권자 수</span>
          <span className="text-blue-600 font-extrabold">{creditorCount}곳</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={30}
            value={creditorCount}
            onChange={e => setCreditorCount(Number(e.target.value))}
            className="flex-1 accent-blue-600 cursor-pointer"
          />
          <input
            type="number"
            min={1}
            max={100}
            value={creditorCount}
            onChange={e => setCreditorCount(Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
            className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-900"
          />
        </div>
      </div>

      {/* 부가 옵션 */}
      {caseType === 'bankruptcy' && (
        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <input
            type="checkbox"
            checked={isElectronic}
            onChange={e => setIsElectronic(e.target.checked)}
            className="rounded accent-blue-600"
          />
          전자소송 접수 (인지대 10% 감액)
        </label>
      )}
      {caseType === 'rehab' && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          <span className="font-bold text-slate-700 block">부가 신청 및 전자소송</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input 
                type="checkbox" 
                checked={hasProhibition} 
                onChange={e => setHasProhibition(e.target.checked)}
                className="rounded accent-blue-600" 
              />
              금지명령 (+2C회)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input 
                type="checkbox" 
                checked={hasStay} 
                onChange={e => setHasStay(e.target.checked)}
                className="rounded accent-blue-600" 
              />
              중지명령 (+2C회)
            </label>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 pt-1.5 border-t border-slate-200">
            <input 
              type="checkbox" 
              checked={isElectronic} 
              onChange={e => setIsElectronic(e.target.checked)}
              className="rounded accent-blue-600" 
            />
            전자소송 접수 (인지대 10% 감액)
          </label>
        </div>
      )}

      {/* 계산 결과 카드 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3.5 rounded-xl border border-blue-200/70 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>송달료 ({fees.deliveryRounds}회분)</span>
          <span className="font-bold text-slate-900 tabular-nums">{fees.totalDeliveryFee.toLocaleString()}원</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>인지대 ({isElectronic ? '전자소송' : '서면'})</span>
          <span className="font-bold text-slate-900 tabular-nums">{fees.stampFee.toLocaleString()}원</span>
        </div>
        <div className="pt-1.5 border-t border-blue-200/60 flex items-center justify-between">
          <span className="font-black text-slate-800 text-xs">법원 보관금 합계</span>
          <span className="font-black text-base text-blue-700 tabular-nums">{fees.totalCost.toLocaleString()}원</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">송달 회차는 일반적인 예납 기준입니다. 실제 금액은 관할 법원 예납명령을 따르세요.</p>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '비용 안내문 원클릭 복사'}</span>
      </button>
    </div>
  );
}
