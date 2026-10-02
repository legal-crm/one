import React, { useState } from 'react';
import { calcCourtFees, DELIVERY_UNIT_FEE_KRW } from '../../../../services/court/courtFees';
import { setDockShared, useDockShared } from '../dockShared';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

/** 채권자 수를 아직 입력하지 않았을 때 슬라이더 시작값 */
const DEFAULT_CREDITORS = 5;

export default function CalculatorTool() {
  const shared = useDockShared();
  const [caseType, setCaseType] = useState<'rehab' | 'bankruptcy'>('rehab');
  const [hasProhibition, setHasProhibition] = useState<boolean>(true); // 금지명령
  const [hasStay, setHasStay] = useState<boolean>(false); // 중지명령
  const [isElectronic, setIsElectronic] = useState<boolean>(true); // 전자소송 10% 감액
  const { copied, copy } = useCopyFeedback();

  // 채권자 수는 퀵독 공유값 (채권자 송달주소록에서 담은 수를 반영할 수 있음)
  const creditorCount = shared.creditorCount > 0 ? shared.creditorCount : DEFAULT_CREDITORS;
  const basketCount = shared.creditorBasket.length;
  const setCreditorCount = (v: number) =>
    setDockShared({ creditorCount: Math.min(100, Math.max(1, Math.floor(Number(v)) || 1)) });

  // 전자계약 법원비용과 같은 공용 산식 (services/court/courtFees.ts)
  const withProhibition = caseType === 'rehab' && hasProhibition;
  const withStay = caseType === 'rehab' && hasStay;
  const r = calcCourtFees({ caseType, creditorCount, withProhibition, withStay, electronic: isElectronic });

  const handleCopy = () => {
    const extras = [withProhibition ? '금지명령' : '', withStay ? '중지명령' : ''].filter(Boolean).join('·');
    const text = `[법원비용 안내]
• 구분: ${caseType === 'rehab' ? '개인회생' : '개인파산·면책'}${extras ? ` (동시 신청: ${extras})` : ''}
• 채권자수: ${creditorCount}곳
• 총 송달료(${r.deliveryRounds}회): ${r.deliveryFee.toLocaleString()}원
• 인지대: ${r.stampFee.toLocaleString()}원 (${isElectronic ? '전자소송 10% 감액' : '서면'})
• 합계: ${r.total.toLocaleString()}원
※ 송달료 1회분 ${DELIVERY_UNIT_FEE_KRW.toLocaleString()}원 기준 예상액이며, 관할 법원 예납명령 금액이 우선합니다.`;
    copy(text, '법원비용 안내가 복사되었습니다. 상담창에 바로 붙여넣으세요.');
  };

  return (
    <div className="space-y-4 p-4 text-slate-800">
      {/* 사건 구분 */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl" role="radiogroup" aria-label="사건 구분">
        {([
          ['rehab', '개인회생 (10회+8C)'],
          ['bankruptcy', '개인파산·면책 (8회+6C)'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={caseType === value}
            onClick={() => setCaseType(value)}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              caseType === value ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 채권자 수 입력 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <label htmlFor="fee-creditor-count">채권자 수</label>
          <span className="text-blue-700 font-extrabold">{creditorCount}곳</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={30}
            value={Math.min(30, creditorCount)}
            onChange={e => setCreditorCount(Number(e.target.value))}
            aria-label="채권자 수 슬라이더"
            className="flex-1 accent-blue-600 cursor-pointer"
          />
          <input
            id="fee-creditor-count"
            type="number"
            min={1}
            max={100}
            value={creditorCount}
            onChange={e => setCreditorCount(Number(e.target.value))}
            className="w-16 px-2 py-1 border border-slate-300 rounded-xl text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        {basketCount > 0 && basketCount !== creditorCount && (
          <button
            type="button"
            onClick={() => setCreditorCount(basketCount)}
            className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
          >
            채권자 주소록에 담은 {basketCount}곳으로 맞추기
          </button>
        )}
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3.5 rounded-2xl border border-blue-200/70 space-y-2" aria-live="polite">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>송달료 ({r.deliveryRounds}회분 × {DELIVERY_UNIT_FEE_KRW.toLocaleString()}원)</span>
          <span className="font-bold text-slate-900 tabular-nums">{r.deliveryFee.toLocaleString()}원</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>인지대 ({isElectronic ? '전자소송' : '서면'})</span>
          <span className="font-bold text-slate-900 tabular-nums">{r.stampFee.toLocaleString()}원</span>
        </div>
        <div className="pt-1.5 border-t border-blue-200/60 flex items-center justify-between">
          <span className="font-black text-slate-800 text-xs">법원 보관금 합계</span>
          <span className="font-black text-base text-blue-700 tabular-nums">{r.total.toLocaleString()}원</span>
        </div>
        <p className="text-xs text-slate-600 leading-snug">송달 회차는 일반적인 예납 기준입니다. 실제 금액은 관할 법원 예납명령을 따르세요.</p>
      </div>

      <CopyButton copied={copied} onClick={handleCopy} label="비용 안내문 복사" />
    </div>
  );
}
