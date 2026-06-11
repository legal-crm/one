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
      <div className="dark bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[32px] shadow-2xl border border-slate-800 p-6 sm:p-8 md:p-10 space-y-8 shadow-glow relative overflow-hidden transition-all duration-300">
        {/* Background glow effects */}
        <div className="absolute left-1/3 top-1/4 w-[350px] h-[350px] bg-brand/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute right-1/4 bottom-1/4 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[90px] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
          <div className="space-y-1.5">
            <span className="text-[10px] text-brand-light font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand-light animate-pulse" />
              실시간 자가진단 계산기
            </span>
            <h3 className="text-xl md:text-2xl font-black tracking-tight">나의 예상 개인회생 탕감액 조회</h3>
          </div>
          <p className="text-xs text-slate-450 leading-relaxed max-w-sm font-medium">
            소득과 채무, 부양가족 수에 따른 최저생계비를 대입하여 법원에서 인정받을 수 있는 최적의 예상 탕감액과 변제율을 가계산합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
          {/* Sliders */}
          <div className="lg:col-span-7 space-y-8 flex flex-col justify-between">
            {/* Income Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">월 평균 세후 실수령 소득</span>
                <span className="font-extrabold text-brand-light text-base bg-brand/10 px-3 py-1 rounded-lg border border-brand/20 shadow-sm">{calcIncome}만 원</span>
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
                <span className="font-extrabold text-amber-400 text-base bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/20 shadow-sm">
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
                    className={`py-3 rounded-2xl border text-xs font-black transition-all duration-200 cursor-pointer ${
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
                    <span className="text-[10px] uppercase font-black tracking-wider text-brand-light block border-b border-white/10 pb-2">
                      🔍 1차 자격 진단 리포트
                    </span>
                    <div className="space-y-3.5 text-xs text-slate-300 font-medium">
                      <div className="flex justify-between items-center">
                        <span>보건복지부 고시 최저생계비:</span>
                        <strong className="text-white text-sm">{minLivingCost}만 원</strong>
                      </div>
                      {isBankruptcyApplicable ? (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-[11px] text-red-300 font-semibold leading-relaxed shadow-sm">
                          ⚠️ 월 소득이 법정 최저생계비보다 적습니다. 이 경우 변제금 납부 대신 채무 전액을 탕감받는 **개인파산 면책 신청**이 가장 유리합니다!
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
                      <span className="text-[10px] text-brand-light uppercase tracking-widest font-black">법적 예상 탕감 비율</span>
                      <div className="text-3xl font-black text-brand-light tracking-tight">
                        약 {reductionRate}% 탕감 예정
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        (총 채무 중 약 <strong className="text-white font-extrabold">{Math.round(totalReduction).toLocaleString()}만 원</strong> 감면)
                      </p>
                    </div>
                  )}

                  <div className="pt-2 relative z-10">
                    <button
                      onClick={() => onNavigateToRequest({
                        income: calcIncome,
                        debtTotal: calcDebt,
                        dependents: calcDependents,
                        title: `탕감액 계산기 연동 상담 신청`,
                        content: `탕감액 계산기 실행 결과:\n- 월 세후 소득: ${calcIncome}만 원\n- 총 부채액: ${calcDebt}만 원\n- 부양가족 수: ${calcDependents}명 (${calcDependents + 1}인 가구)\n\n상기 수치 데이터를 기반으로 법정 개시가 안전하게 가능한 구조인지, 추가적인 탕감율 극대화 전략에 대한 도산 전문 변호사의 상담을 신청합니다.`,
                        step: 3
                      })}
                      className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl text-xs transition-all duration-300 flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(114,100,255,0.3)] hover:shadow-[0_4px_30px_rgba(114,100,255,0.5)] transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>이 계산 결과로 바로 상담 신청하기</span>
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
        <h4 className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 animate-bounce" />
          <span>탕감액 계산기 이용 시 유의사항 (변호사 전문 소명의 중요성)</span>
        </h4>
        <div className="text-[#7e7e8f] dark:text-slate-400 leading-relaxed font-semibold space-y-2">
          <p>
            위 계산기는 보건복지부 기준 최저생계비를 대입한 <strong>가계산(가상 결과)</strong>입니다. 
            실제 법원 접수 시에는 채무 형성 경로(최근 대출 비율, 사행성 투자 손실 유무) 및 의뢰인의 개별 소득 형태, 재산 가치(청산가치)에 따라 법원이 인정해주는 생계비의 보정 폭이 매우 크게 달라집니다.
          </p>
          <p>
            따라서, 계산 결과를 토대로 반드시 **도산 전문 변호사와의 1:1 상담 및 매칭**을 진행하여 적법하게 생계비를 극대화하고 변제금을 최소화하는 전략적 계획서를 수립하셔야 합니다.
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
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
          >
            내 조건으로 전문 변호사 매칭받기 &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
