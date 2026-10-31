import { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '../../../services/marketing/attribution';
import { FormField, MoneyInput, SectionHeader, inputClass, Button } from '../ui';
import CalcResultPanel from '../calculator/CalcResultPanel';
import { computePublicRange, emptyPublicCalcInput, type HousingKind, type PublicCalcInput } from '../../../services/repayment/publicCalculator';

const HOUSING: { v: HousingKind; label: string }[] = [
  { v: 'rent', label: '월세' }, { v: 'jeonse', label: '전세' }, { v: 'own', label: '자가' }, { v: 'free', label: '무상 거주' },
];

/**
 * 홈 '1분 변제금 계산기' (1-G 빠른 모드): 입력 4개 → 넓은 범위
 * 같은 엔진으로 계산하고, '자세히 계산하기'는 입력값을 전체 계산기로 넘긴다 (브라우저 안에서만).
 * 통합어드민 '기능 표시'에서 계산기를 켰을 때만 보인다.
 */
export default function QuickCalcSection({
  onOpenFull, onStartCheck,
}: {
  onOpenFull: (seed: Partial<PublicCalcInput>) => void;
  onStartCheck: () => void;
}) {
  const [v, setV] = useState<PublicCalcInput>(() => emptyPublicCalcInput(new Date().getFullYear()));
  const set = <K extends keyof PublicCalcInput>(k: K, val: PublicCalcInput[K]) => setV(p => ({ ...p, [k]: val }));
  const range = useMemo(() => (v.monthlyIncome > 0 && v.totalDebt > 0 ? computePublicRange(v, true).range : null), [v]);
  // 방문 분석: 결과를 처음 본 때 한 번 (입력값은 보내지 않음)
  const tracked = useRef(false);
  useEffect(() => { if (range && !tracked.current) { tracked.current = true; trackEvent('calculator_used'); } }, [range]);

  return (
    <section id="quick-calculator" aria-labelledby="quick-calc-title" className="bg-white py-14 md:py-20 border-t border-slate-100 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="quick-calc-title"
          title="1분이면 대략적인 변제금 범위를 볼 수 있어요"
          description="공개된 생계비 기준으로 계산한 참고 범위예요. 이름이나 로그인 없이 쓰고, 입력한 값은 저장하지 않아요."
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 md:p-6 space-y-4">
            <FormField label="월 실수령 소득">
              {p => <MoneyInput {...p} unit="manwon" value={v.monthlyIncome ? v.monthlyIncome / 10_000 : null} onChange={n => set('monthlyIncome', (n ?? 0) * 10_000)} />}
            </FormField>
            <FormField label="총 채무">
              {p => <MoneyInput {...p} unit="manwon" value={v.totalDebt ? v.totalDebt / 10_000 : null} onChange={n => set('totalDebt', (n ?? 0) * 10_000)} />}
            </FormField>
            <FormField label="가구원 수 (본인 포함)">
              {p => (
                <select {...p} value={v.householdSize} onChange={e => set('householdSize', Number(e.target.value))} className={inputClass}>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}인</option>)}
                </select>
              )}
            </FormField>
            <fieldset>
              <legend className="text-sm font-bold text-slate-800 mb-1.5">주거 형태</legend>
              <div className="grid grid-cols-4 gap-2" role="radiogroup">
                {HOUSING.map(h => (
                  <button
                    key={h.v}
                    type="button"
                    role="radio"
                    aria-checked={v.housing === h.v}
                    onClick={() => set('housing', h.v)}
                    className={`min-h-11 rounded-xl text-sm font-bold border cursor-pointer whitespace-nowrap active:scale-[0.98] ${v.housing === h.v ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="lg:col-span-7">
            <CalcResultPanel
              range={range}
              year={v.year}
              onStartCheck={() => { trackEvent('calculator_to_check'); onStartCheck(); }}
              extraAction={<Button onClick={() => { trackEvent('calculator_to_full'); onOpenFull({ monthlyIncome: v.monthlyIncome, totalDebt: v.totalDebt, householdSize: v.householdSize, housing: v.housing }); }}>자세히 계산하기</Button>}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
