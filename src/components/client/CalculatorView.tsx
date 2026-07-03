import React, { useState } from 'react';
import { Activity, FileText, AlertTriangle } from 'lucide-react';

interface CalculatorViewProps {
  onNavigateToRequest: (data: {
    income: number;
    debtTotal: number;
    dependents: number;
    title: string;
    content: string;
    step: number;
    requestType?: 'direct' | 'open';
  }) => void;
}

export default function CalculatorView({ onNavigateToRequest }: CalculatorViewProps) {
  const [calcIncome, setCalcIncome] = useState<number>(250);
  const [calcDebt, setCalcDebt] = useState<number>(7000);
  const [calcDependents, setCalcDependents] = useState<number>(0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn text-left">
      <div className="dark bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-2xl border border-slate-800 p-6 sm:p-8 md:p-10 space-y-8 shadow-glow relative overflow-hidden transition-all duration-300">
        {/* Background glow effects */}
        <div className="absolute left-1/3 top-1/4 w-[350px] h-[350px] bg-brand/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute right-1/4 bottom-1/4 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[90px] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
          <div className="space-y-1.5">
            <span className="text-[10px] text-brand-light font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand-light" />
              채무관리 사전 체크 계산기
            </span>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">나의 예상 변제 부담 시뮬레이션</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm font-medium">
            소득과 채무, 부양가족 수에 따른 최저생계비를 대입하여 예상 변제 부담을 단순 시뮬레이션합니다. 실제 결과는 달라질 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
          {/* Sliders */}
          <div className="lg:col-span-7 space-y-8 flex flex-col justify-between">
            {/* Income Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">월 평균 세후 실수령 소득</span>
                <span className="font-bold text-brand-light text-base bg-brand/10 px-3 py-1 rounded-lg border border-brand/20 shadow-sm">{calcIncome}만 원</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="800" 
                step="10" 
                value={calcIncome} 
                onChange={(e) => setCalcIncome(Number(e.target.value))} 
                className="w-full my-2" 
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>100만 원</span><span>450만 원</span><span>800만 원</span>
              </div>
            </div>

            {/* Debt Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">총 채무액 (대출, 카드론, 주식/코인 손실 등)</span>
                <span className="font-bold text-amber-400 text-base bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20 shadow-sm">
                  {calcDebt >= 10000 ? `${(calcDebt / 10000).toFixed(2)}억 원` : ''} ({calcDebt.toLocaleString()}만 원)
                </span>
              </div>
              <input 
                type="range" 
                min="1000" 
                max="30000" 
                step="500" 
                value={calcDebt} 
                onChange={(e) => setCalcDebt(Number(e.target.value))} 
                className="w-full my-2 slider-amber" 
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                <span>1,000만 원</span><span>1.5억 원</span><span>3억 원</span>
              </div>
            </div>

            {/* Dependents Select */}
            <div className="space-y-3">
              <label className="block text-xs text-slate-300 font-semibold">부양 가족 수 (본인 제외)</label>
              <div className="grid grid-cols-4 gap-2.5">
                {[0, 1, 2, 3].map(num => (
                  <button 
                    key={num} 
                    type="button" 
                    onClick={() => setCalcDependents(num)} 
                    className={`py-3 rounded-2xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                      calcDependents === num 
                        ? 'bg-brand border-brand text-white shadow-[0_4px_15px_rgba(114,100,255,0.3)] scale-[1.03]' 
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {num === 0 ? '0명 (1인 가구)' : `${num}명 (${num+1}인 가구)`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculation Results */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900/80 to-brand/10 border border-brand/20 p-6 rounded-3xl flex flex-col justify-between space-y-6 shadow-premium relative overflow-hidden">
            {/* Subtle glow layer */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-brand/10 rounded-full blur-2xl pointer-events-none"></div>
            
            {(() => {
              const minLivingCost = calcDependents === 0 ? 133 : calcDependents === 1 ? 221 : calcDependents === 2 ? 282 : 343;
              const monthlyRepayment = Math.max(0, calcIncome - minLivingCost);
              const totalRepayment = Math.min(calcDebt, monthlyRepayment * 36);
              const totalReduction = Math.max(0, calcDebt - totalRepayment);
              const reductionRate = calcDebt > 0 ? Math.round((totalReduction / calcDebt) * 100) : 0;
              const isBankruptcyApplicable = monthlyRepayment <= 0;

              return (
                <>
                  <div className="space-y-4 text-left relative z-10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-brand-light block border-b border-white/10 pb-2">
                      🔍 1차 사전 체크 리포트
                    </span>
                    <div className="space-y-3.5 text-xs text-slate-300 font-medium">
                      <div className="flex justify-between items-center">
                        <span>보건복지부 고시 최저생계비:</span>
                        <strong className="text-white text-sm">{ minLivingCost}만 원</strong>
                      </div>
                      {isBankruptcyApplicable ? (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-[11px] text-red-300 font-semibold leading-relaxed shadow-sm">
                          ⚠️ 월 소득이 법정 최저생계비보다 적습니다. 이 경우 개인파산 면책 신청을 검토해 볼 수 있는 상황입니다. 정확한 가능 여부는 변호사 검토가 필요합니다.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span>예상 월 가용 변제금 (36개월):</span>
                            <strong className="text-brand-light text-sm">{monthlyRepayment.toLocaleString()}만 원 / 월</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>예상 총 변제액:</span>
                            <strong className="text-white text-sm">{Math.round(totalRepayment).toLocaleString()}만 원</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isBankruptcyApplicable && (
                    <div className="bg-gradient-to-r from-brand/10 to-indigo-600/15 border border-brand/35 p-5 rounded-2xl text-center space-y-1.5 shadow-sm relative z-10">
                      <span className="text-[10px] text-brand-light uppercase tracking-widest font-bold">입력값 기준 예상 조정 비율</span>
                      <div className="text-3xl font-bold text-brand-light tracking-tight">
                        약 {reductionRate}% 조정 가능성
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        (총 채무 중 약 <strong className="text-white font-bold">{Math.round(totalReduction).toLocaleString()}만 원</strong> 감면)
                      </p>
                    </div>
                  )}

                  <div className="pt-2 relative z-10">
                    <button
                      onClick={() => onNavigateToRequest({
                        income: calcIncome,
                        debtTotal: calcDebt,
                        dependents: calcDependents,
                        title: `시뮬레이션 결과 검토 요청`,
                        content: `채무 시뮬레이션 결과:\n- 월 세후 소득: ${calcIncome}만 원\n- 총 부채액: ${calcDebt}만 원\n- 부양가족 수: ${calcDependents}명 (${calcDependents + 1}인 가구)\n\n위 입력값 기준 시뮬레이션 결과를 바탕으로 변호사의 검토 의견을 받아보고 싶습니다.`,
                        step: 3
                      })}
                      className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-brand-sm transform hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
                    >
                      <FileText className="w-4 h-4" />
                      <span>이 결과로 변호사 검토 요청하기</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Banner Notice */}
      <div className="bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/20 p-5 rounded-3xl text-xs space-y-3 shadow-premium">
        <h4 className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>시뮬레이션 이용 시 유의사항</span>
        </h4>
        <div className="text-slate-400 dark:text-slate-400 leading-relaxed font-medium space-y-2">
          <p>
            본 결과는 입력값 기준 예상 변제 부담을 단순 시뮬레이션한 <strong>참고자료</strong>이며, 법률 판단이 아닙니다.
            실제 변제금과 조정 가능성은 법원, 소득, 재산, 채무 발생 원인, 최근 채무 비율, 세금체납 여부 등에 따라 달라질 수 있습니다.
          </p>
          <p>
            정확한 진행 가능성과 예상 변제금은 변호사의 개별 검토를 통해 확인하시기 바랍니다.
          </p>
        </div>
        <div className="pt-2 flex justify-end">
          <button 
            onClick={() => onNavigateToRequest({
              income: calcIncome,
              debtTotal: calcDebt,
              dependents: calcDependents,
              title: '',
              content: '',
              step: 1,
              requestType: 'open'
            })}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
          >
            내 조건으로 전문 변호사 매칭받기 &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
