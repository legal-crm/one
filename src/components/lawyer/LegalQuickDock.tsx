import React, { useState } from 'react';
import { 
  Calculator, Users, Scale, CreditCard, Send, X, Copy, Check, 
  Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface LegalQuickDockProps {
  onOpenAlimtok?: () => void;
}

// 2026년도 기준중위소득 및 60% 법정 최저생계비 고시 기준
const MEDIAN_INCOME_2026 = [
  { size: 1, full: 2392013, min60: 1435208 },
  { size: 2, full: 3932828, min60: 2359697 },
  { size: 3, full: 5025354, min60: 3015212 },
  { size: 4, full: 6097773, min60: 3658664 },
  { size: 5, full: 7114976, min60: 4268986 },
  { size: 6, full: 8079849, min60: 4847909 },
];

export default function LegalQuickDock({ onOpenAlimtok }: LegalQuickDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'calculator' | 'median' | 'extraExpense' | 'virtualAccount' | null>(null);

  // 1. 송달료 계산기 상태
  const [caseType, setCaseType] = useState<'rehab' | 'bankruptcy'>('rehab');
  const [creditorCount, setCreditorCount] = useState<number>(5);
  const [hasProhibition, setHasProhibition] = useState<boolean>(true); // 금지명령
  const [hasStay, setHasStay] = useState<boolean>(false); // 중지명령
  const [isElectronic, setIsElectronic] = useState<boolean>(true); // 전자소송 10% 감액

  // 송달료 계산 공식 (2025/2026 법원 송달료 1회분 = 5,200원)
  const UNIT_DELIVERY_FEE = 5200;
  const calculateFees = () => {
    const c = Math.max(1, creditorCount || 1);
    let deliveryRounds = 0;
    let stampFee = 0;

    if (caseType === 'rehab') {
      // 회생: 기본 10회 + (채권자수 × 8회)
      deliveryRounds = 10 + (c * 8);
      // 금지명령 2회 + 중지명령 2회 (필요 시)
      if (hasProhibition) deliveryRounds += (c * 2);
      if (hasStay) deliveryRounds += (c * 2);
      
      // 인지대: 회생 30,000원 + 금지명령 2,000원 + 중지명령 2,000원
      stampFee = 30000;
      if (hasProhibition) stampFee += 2000;
      if (hasStay) stampFee += 2000;
    } else {
      // 파산: 파산 4회분 + (채권자수 × 3회) + 면책 4회분 + (채권자수 × 3회) = 기본 8회 + (채권자수 × 6회)
      deliveryRounds = 8 + (c * 6);
      // 인지대: 파산 1,000원 + 면책 1,000원
      stampFee = 2000;
    }

    if (isElectronic) {
      stampFee = Math.floor(stampFee * 0.9); // 전자소송 10% 감액
    }

    const totalDeliveryFee = deliveryRounds * UNIT_DELIVERY_FEE;
    return {
      deliveryRounds,
      totalDeliveryFee,
      stampFee,
      totalCost: totalDeliveryFee + stampFee,
    };
  };

  const fees = calculateFees();

  // 2. 기준중위소득 가용소득 시뮬레이터 상태
  const [familySize, setFamilySize] = useState<number>(1);
  const [myIncome, setMyIncome] = useState<number>(2500000); // 250만 원

  const selectedMedian = MEDIAN_INCOME_2026.find(m => m.size === familySize) || MEDIAN_INCOME_2026[0];
  const calculatedDisposable = Math.max(0, myIncome - selectedMedian.min60);

  // 3. 가상계좌 모달 상태
  const mockAccountNumber = '신한은행 562-901-883921 (예금주: 서울회생법원)';
  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    toast.success('법원 가상계좌가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  return (
    <>
      {/* ── 우측 하단 플로팅 퀵 독 트리거 ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 select-none">
        {isOpen && (
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 mb-2 w-64 animate-in fade-in slide-in-from-bottom-3 duration-200 text-slate-100">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5 text-blue-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                리걸 실무 퀵툴 (Quick Dock)
              </span>
              <button 
                onClick={() => setIsOpen(false)}
                className="hover:text-white p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              {/* 1. 송달료 / 인지대 계산기 */}
              <button
                onClick={() => { setActiveModal('calculator'); setIsOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 group-hover:text-white leading-tight">송달료·인지대 계산기</p>
                  <p className="text-[11px] text-slate-400 leading-tight">채권자수별 실비 즉시 산출</p>
                </div>
              </button>

              {/* 2. 2026 기준중위소득 조회 */}
              <button
                onClick={() => { setActiveModal('median'); setIsOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 group-hover:text-white leading-tight">2026 기준중위소득표</p>
                  <p className="text-[11px] text-slate-400 leading-tight">가구별 60% 생계비 & 가용소득</p>
                </div>
              </button>

              {/* 3. 추가생계비 인정 기준 */}
              <button
                onClick={() => { setActiveModal('extraExpense'); setIsOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Scale className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 group-hover:text-white leading-tight">추가생계비 실무준칙</p>
                  <p className="text-[11px] text-slate-400 leading-tight">주거비·의료비·교육비 한도</p>
                </div>
              </button>

              {/* 4. 변제금 가상계좌 확인 */}
              <button
                onClick={() => { setActiveModal('virtualAccount'); setIsOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 group-hover:text-white leading-tight">변제금 납입계좌 뷰어</p>
                  <p className="text-[11px] text-slate-400 leading-tight">법원 가상계좌 복사 & 안내</p>
                </div>
              </button>

              {/* 5. 의뢰인 알림톡/앱 퀵 발송 */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenAlimtok) {
                    onOpenAlimtok();
                  } else {
                    toast.info('알림톡 발송 센터를 확인하세요.');
                  }
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer group border-t border-slate-800/80 mt-1"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-200 group-hover:text-white leading-tight">모바일 알림톡 전송</p>
                  <p className="text-[11px] text-slate-400 leading-tight">의뢰인 서류/진행상황 안내</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 독 메인 플로팅 토글 버튼 */}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold shadow-xl transition-all press-scale cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] text-white hover:shadow-blue-500/30 shadow-lg'
          }`}
          title="변호사 실무 플로팅 퀵툴"
        >
          <div className="relative">
            <Calculator className="w-5 h-5 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#1E3A5F] animate-pulse" />
          </div>
          <span className="text-sm tracking-tight font-extrabold hidden sm:inline">실무 퀵툴</span>
          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full font-mono font-bold">5</span>
        </button>
      </div>

      {/* ════ 1. 송달료 / 인지대 계산기 모달 ════ */}
      {activeModal === 'calculator' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">송달료 & 인지대 즉시 계산기</h3>
                  <p className="text-xs text-slate-400">대법원 예규 기준 (송달료 1회 5,200원)</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 사건 구분 */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setCaseType('rehab')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    caseType === 'rehab' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  개인회생 (10회+8C)
                </button>
                <button
                  onClick={() => setCaseType('bankruptcy')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                    onChange={e => setCreditorCount(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-xl text-center text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* 부가 옵션 (금지명령, 중지명령, 전자소송) */}
              {caseType === 'rehab' && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block">부가 신청 및 접수 방식</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={hasProhibition} 
                        onChange={e => setHasProhibition(e.target.checked)}
                        className="rounded accent-blue-600" 
                      />
                      금지명령 포함 (+2C회)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={hasStay} 
                        onChange={e => setHasStay(e.target.checked)}
                        className="rounded accent-blue-600" 
                      />
                      중지명령 포함 (+2C회)
                    </label>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 pt-1 border-t border-slate-200">
                    <input 
                      type="checkbox" 
                      checked={isElectronic} 
                      onChange={e => setIsElectronic(e.target.checked)}
                      className="rounded accent-blue-600" 
                    />
                    전자소송 10% 감액 적용 (인지대)
                  </label>
                </div>
              )}

              {/* 계산 결과 카드 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4.5 rounded-2xl border border-blue-200/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>총 송달료 ({fees.deliveryRounds}회분)</span>
                  <span className="font-bold text-slate-900 tabular-nums">{fees.totalDeliveryFee.toLocaleString()}원</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>인지대 ({isElectronic ? '전자 10% 할인' : '서면 접수'})</span>
                  <span className="font-bold text-slate-900 tabular-nums">{fees.stampFee.toLocaleString()}원</span>
                </div>
                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between">
                  <span className="font-black text-slate-800 text-sm">예상 법원 보관금 합계</span>
                  <span className="font-black text-xl text-blue-700 tabular-nums">{fees.totalCost.toLocaleString()}원</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`[법원비용 안내]\n- 채권자수: ${creditorCount}명\n- 송달료(${fees.deliveryRounds}회): ${fees.totalDeliveryFee.toLocaleString()}원\n- 인지대: ${fees.stampFee.toLocaleString()}원\n- 합계: ${fees.totalCost.toLocaleString()}원`);
                    toast.success('계산 결과가 클립보드에 복사되었습니다.');
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>비용 안내 복사하기</span>
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ 2. 2026 기준중위소득 및 가용소득 시뮬레이터 ════ */}
      {activeModal === 'median' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">2026 기준중위소득 & 법정 최저생계비</h3>
                  <p className="text-xs text-emerald-300">보건복지부 고시 (법정 생계비: 중위소득의 60%)</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 기준중위소득 표 요약 */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">가구원수</th>
                      <th className="py-2.5 px-3">기준중위소득 (100%)</th>
                      <th className="py-2.5 px-3 text-emerald-700 bg-emerald-50/50">회생 인정생계비 (60%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MEDIAN_INCOME_2026.map(item => (
                      <tr 
                        key={item.size} 
                        onClick={() => setFamilySize(item.size)}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          familySize === item.size ? 'bg-emerald-50 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 flex items-center gap-1.5">
                          {familySize === item.size && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          <span>{item.size}인 가구</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 tabular-nums">{item.full.toLocaleString()}원</td>
                        <td className="py-2 px-3 text-emerald-700 font-extrabold tabular-nums bg-emerald-50/30">
                          {item.min60.toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 가용소득 즉시 시뮬레이션 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  월 가용소득(예상 월 변제금) 즉시 계산
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">인정 부양가족 수</label>
                    <select
                      value={familySize}
                      onChange={e => setFamilySize(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      {MEDIAN_INCOME_2026.map(m => (
                        <option key={m.size} value={m.size}>{m.size}인 가구 (생계비 {m.min60.toLocaleString()}원)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium block mb-1">의뢰인 실수령 월 소득</label>
                    <input
                      type="number"
                      step={50000}
                      value={myIncome}
                      onChange={e => setMyIncome(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 tabular-nums"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">소득 - 법정 최저생계비</span>
                    <span className="text-xs font-bold text-slate-700">기본 가용소득</span>
                  </div>
                  <span className="text-lg font-black text-emerald-600 tabular-nums">
                    월 {calculatedDisposable.toLocaleString()}원
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ 3. 회생법원 실무준칙 추가생계비 인정 기준표 ════ */}
      {activeModal === 'extraExpense' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-purple-950 to-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">회생법원 실무준칙 추가생계비 가이드</h3>
                  <p className="text-xs text-purple-300">서울회생법원 실무준칙 제402호·403호 기준</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* 1. 주거비 한도 */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    🏠 주거비 추가 인정 (실무준칙 제402호)
                  </span>
                  <span className="text-[11px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md">
                    임차인 월세 한도
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  기준중위소득 60% 생계비에 기본 주거비가 일부 포함되어 있으나, 실질 월세가 이를 초과할 경우 법원 심사를 통해 추가 인정 가능합니다.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">서울 기준 (1~2인 가구)</span>
                    <span className="font-bold text-slate-800">최대 월 38만 ~ 45만 원 추가 인정</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">서울 기준 (3~4인 가구)</span>
                    <span className="font-bold text-slate-800">최대 월 55만 ~ 68만 원 추가 인정</span>
                  </div>
                </div>
              </div>

              {/* 2. 의료비 */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    💊 지속적 의료비 (실무준칙 제403호)
                  </span>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    진단서 & 영수증 필수
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  본인 또는 부양가족의 만성질환, 암, 희귀난치병 등으로 매월 고정 발생하는 본인부담금은 지출 내역 1년치 영수증 소명 시 전액 인정 가능.
                </p>
              </div>

              {/* 3. 교육비 및 양육비 */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    🎓 공교육비 & 이혼 양육비
                  </span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                    사교육비 제한적
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  • <strong>미성년 자녀 교육비</strong>: 일반 학원비 등 사교육비는 원칙상 불인정되나, 특수학급/발달치료는 의사 소견서 첨부 시 인정.<br/>
                  • <strong>양육비</strong>: 가정법원 양육비 부담조서 또는 판결문이 있는 경우 매월 지급액 전액 생계비 가산.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ 4. 변제금 납입계좌 뷰어 ════ */}
      {activeModal === 'virtualAccount' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-amber-950 to-slate-900 text-white px-6 py-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">변제금 납입 가상계좌 확인</h3>
                  <p className="text-xs text-amber-300">법원 개시결정 시 부여된 전용 계좌</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                개인회생 개시결정이 내려지면 회생위원 명의의 법원 가상계좌(주로 신한은행)가 발급됩니다. 의뢰인에게 본 계좌로 변제금을 입금하도록 안내하세요.
              </p>

              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">법원 납부 전용 계좌</span>
                <p className="text-sm font-black text-slate-900 break-all select-all font-mono">
                  {mockAccountNumber}
                </p>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => handleCopyAccount(mockAccountNumber)}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAccount ? '복사 완료' : '계좌번호 복사'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p>⚠️ <strong>유의사항</strong>: 다른 사람 명의로 입금 시 사건번호 또는 본인 성명이 정확히 기재되어야 합니다.</p>
                <p>• 통상 3회 이상 연체 시 채권자의 폐지신청 및 법원 직권 폐지 결정이 내려질 수 있습니다.</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
