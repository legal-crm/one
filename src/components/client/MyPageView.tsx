import React from 'react';
import { MessageSquare, Edit2, Check, X } from 'lucide-react';
import { ConsultRequest } from '../../types';

interface MyPageViewProps {
  userAlias: string;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  income: number;
  setIncome: (v: number) => void;
  dependents: number;
  setDependents: (v: number) => void;
  debtBanks: number;
  setDebtBanks: (v: number) => void;
  debtCards: number;
  setDebtCards: (v: number) => void;
  debtPersonals: number;
  setDebtPersonals: (v: number) => void;
  requests: ConsultRequest[];
  onNavigateToChat: (reqId?: string) => void;
}

export default function MyPageView({
  userAlias, setUserAlias,
  isEditingAlias, setIsEditingAlias,
  tempAlias, setTempAlias,
  income, setIncome,
  dependents, setDependents,
  debtBanks, setDebtBanks,
  debtCards, setDebtCards,
  debtPersonals, setDebtPersonals,
  requests,
  onNavigateToChat
}: MyPageViewProps) {
  const totalDebtValue = debtBanks + debtCards + debtPersonals;
  const minLivingCost = dependents === 0 ? 133 : dependents === 1 ? 221 : dependents === 2 ? 282 : 343;
  const monthlyRepayment = Math.max(0, income - minLivingCost);
  const totalRepayment = Math.min(totalDebtValue, monthlyRepayment * 36);
  const totalReduction = Math.max(0, totalDebtValue - totalRepayment);
  const reductionRate = totalDebtValue > 0 ? Math.round((totalReduction / totalDebtValue) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left">
      {/* Header / Stealth Badge & Assigned Lawyer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              안전한 가명 보호 적용 중
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              변호사 실시간 연결됨
            </span>
          </div>
          {isEditingAlias ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (tempAlias.trim()) {
                  setUserAlias(tempAlias.trim());
                }
                setIsEditingAlias(false);
              }}
              className="flex items-center gap-2 pt-1 animate-fadeIn"
            >
              <span className="text-xl md:text-2xl">👤</span>
              <input 
                type="text" 
                value={tempAlias}
                onChange={(e) => setTempAlias(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-base md:text-lg font-bold focus:ring-1 focus:ring-brand focus:outline-none w-44 md:w-52 text-slate-850 dark:text-white"
                placeholder="새 가명 입력"
                maxLength={12}
                autoFocus
              />
              <button 
                type="submit"
                className="bg-brand text-white font-bold p-2.5 rounded-xl text-xs hover:bg-brand-hover transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-sm"
                title="저장"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setIsEditingAlias(false)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center cursor-pointer border border-slate-200 dark:border-slate-700"
                title="취소"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
              <span>👤 <span className="text-brand dark:text-brand-light">{userAlias || '새출발'}</span> 님의 안심 마이페이지</span>
              <button 
                type="button"
                onClick={() => {
                  setTempAlias(userAlias || '새출발');
                  setIsEditingAlias(true);
                }}
                className="text-slate-400 hover:text-brand dark:hover:text-brand-light p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                title="가명(이름) 수정"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
            </h2>
          )}
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
            채무 사실 노출 방지를 위해 의뢰인 정보는 암호화 가명으로 처리되며, 변호사단과의 1:1 비밀 매칭 대화방이 실시간 보호받고 있습니다.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 shrink-0 flex flex-col justify-between gap-3 w-full md:w-[280px]">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">전담 지정 변호인</span>
            <div className="flex items-center gap-2">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256" 
                alt="이소민 변호사" 
                className="w-8 h-8 rounded-lg object-cover" 
              />
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800 dark:text-white block">이소민 변호사</span>
                <span className="text-[9px] text-[#7e7e8f] font-semibold block">서울/경기 도산 전문</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const req = requests[0];
              onNavigateToChat(req?.id);
            }}
            className="w-full text-center py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>1:1 비공개 상담방 입장</span>
          </button>
        </div>
      </div>

      {/* LIVE DIAGNOSTICS DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Recalculated live metrics */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-850 space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] text-brand-light font-bold uppercase tracking-wider block">
              ⚙️ 나의 예상 감면액 분석
            </span>
            <h3 className="font-extrabold text-lg">한눈에 보는 나의 부채 상황</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              아래에서 소득이나 채무를 바꾸면, 감면 비율과 한 달 납부액이 즉시 다시 계산됩니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-slate-400 font-bold block">나의 총 빚(채무액)</span>
                <span className="text-xs text-slate-300 font-medium">빌린 돈의 원금 합계</span>
              </div>
              <span className="font-black text-amber-400 text-lg">
                {totalDebtValue.toLocaleString()}만 원
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-slate-400 font-bold block">한 달에 갚을 돈(예상)</span>
                <span className="text-xs text-slate-300 font-medium">생계비 제외 후 한 달 납부액</span>
              </div>
              <span className="font-black text-brand-light text-lg">
                월 {monthlyRepayment.toLocaleString()}만 원
              </span>
            </div>

            <div className="bg-brand/10 border border-brand/20 rounded-2xl p-4 flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-[9px] text-brand-light font-bold block">최종 감면받을 금액</span>
                <span className="text-xs text-slate-300 font-medium">법적으로 없어지는 빚의 액수</span>
              </div>
              <div className="text-right">
                <span className="font-black text-emerald-400 text-lg block">
                  ★ {totalReduction.toLocaleString()}만 원
                </span>
                <span className="text-[10px] text-emerald-300/80 font-bold">
                  원금의 {reductionRate}% 없어집니다!
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-normal text-left pt-2 border-t border-white/5">
            ※ 이 결과는 법원의 생계비 기준을 바탕으로 계산해 본 수치이며, 변호사가 서류를 꼼꼼히 보강해 주면 실제로 감면되는 액수가 더 늘어날 수 있습니다.
          </div>
        </div>

        {/* Right Column: Live Debt Editor Input Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5 text-left">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-black text-base text-slate-800 dark:text-white">⚖️ 나의 빚 현황 & 직접 조정해보기</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">금액을 직접 변경해 보시면 왼쪽의 감면 금액이 실시간으로 바뀝니다.</p>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400 px-2 py-0.5 rounded font-bold">
              단위: 만 원
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">매달 실제로 통장에 들어오는 세후 월급 (만 원)</label>
              <input type="number" value={income} onChange={(e) => setIncome(Math.max(0, Number(e.target.value)))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">내가 책임져야 하는 부양 가족 수 (나를 제외한 가족 수, 명)</label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDependents(num)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      dependents === num
                      ? 'bg-brand border-brand text-white shadow-md'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
                    }`}
                  >
                    {num}명 ({num + 1}인 가구)
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-150 dark:border-slate-800 my-4 pt-4">
              <span className="text-[10px] text-slate-400 font-bold block mb-3 uppercase tracking-wider">나의 부채 내역 & 해결 방안</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">은행 신용대출 (만 원)</label>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">🛡️ 월급 압류 & 강제 인출 즉시 차단</span>
              </div>
              <input type="number" value={debtBanks} onChange={(e) => setDebtBanks(Math.max(0, Number(e.target.value)))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">신용카드 대금 및 카드론 (만 원)</label>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">🛡️ 밀린 이자 100% 면제 및 원금 감면</span>
              </div>
              <input type="number" value={debtCards} onChange={(e) => setDebtCards(Math.max(0, Number(e.target.value)))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">대부업 / 사채 채무 (만 원)</label>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">🛡️ 불법 대부업/사채 빚 독촉 및 전화 강제 금지</span>
              </div>
              <input type="number" value={debtPersonals} onChange={(e) => setDebtPersonals(Math.max(0, Number(e.target.value)))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
