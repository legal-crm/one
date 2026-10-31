import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { FormField, MoneyInput, inputClass } from './ui';
import CalcResultPanel from './calculator/CalcResultPanel';
import {
  computePublicRange, emptyPublicCalcInput, type HousingKind, type PublicCalcInput,
} from '../../services/repayment/publicCalculator';
import { REVIEW_REGION_LABEL, type ReviewRegion } from '../../services/cases/caseReviewCalc';

/**
 * 변제금 계산기 (참고용) — 제도 이해용 일반 계산 (B-7, 고객 기획서 9번)
 *  * 변호사 '사건 검토'와 같은 통합 엔진·같은 기준표, 결과는 범위
 *  * 감면율·감면액·'가능성' 표현 없음, 상담 요청에 결과를 붙이지 않음, 입력·결과 저장·전송 없음
 *  * 통합어드민 '플랫폼 설정 › 기능 표시'에서 켜야 보인다 (외부 변호사 검토 뒤)
 */
interface CalculatorViewProps {
  /** 홈 빠른 계산기에서 넘어온 입력 (그대로 이어서 계산) */
  initial?: Partial<PublicCalcInput>;
  onStartCheck: () => void;
  onFindLawyer: () => void;
}

const HOUSING_LABEL: Record<HousingKind, string> = { rent: '월세', jeonse: '전세', own: '자가', free: '무상 거주' };
const YEARS = [2025, 2026, 2027];

export default function CalculatorView({ initial, onStartCheck, onFindLawyer }: CalculatorViewProps) {
  const thisYear = new Date().getFullYear();
  const [v, setV] = useState<PublicCalcInput>(() => ({
    ...emptyPublicCalcInput(YEARS.includes(thisYear) ? thisYear : 2026),
    ...(initial || {}),
  }));
  const set = <K extends keyof PublicCalcInput>(k: K, val: PublicCalcInput[K]) => setV(p => ({ ...p, [k]: val }));
  const money = (k: keyof PublicCalcInput) => (n: number | null) => set(k, (n ?? 0) as any);

  const result = useMemo(() => {
    if (!(v.monthlyIncome > 0) || !(v.totalDebt > 0)) return null;
    return computePublicRange(v).range;
  }, [v]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left">
      <header className="space-y-2">
        <p className="text-sm font-bold text-brand flex items-center gap-1.5">
          <Calculator className="w-4 h-4" aria-hidden="true" /> 변제금 계산기 (참고용)
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight break-keep">
          공개 기준으로 보는 개인회생 변제금 범위
        </h1>
        <p className="text-sm md:text-base text-slate-600 leading-relaxed break-keep max-w-3xl">
          기준 중위소득 생계비·추가 생계비 기준·재산 가치·변제기간 원칙을 적용해 대략적인 범위를 보여 드려요. 내 사건에서 실제로 얼마를 갚게 되는지는 자료를 확인한 변호사와 법원이 정해요.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section aria-label="입력" className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 md:p-6 space-y-5 shadow-sm">
          <fieldset className="space-y-4">
            <legend className="text-base font-extrabold text-slate-900">소득과 채무</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="월 실수령 소득" required hint="세금·4대보험을 뺀 금액">
                {p => <MoneyInput {...p} value={v.monthlyIncome || null} onChange={money('monthlyIncome')} />}
              </FormField>
              <FormField label="총 채무" required hint="대출·카드·개인 빚 원금 합계">
                {p => <MoneyInput {...p} value={v.totalDebt || null} onChange={money('totalDebt')} />}
              </FormField>
              <FormField label="그중 세금·4대보험 체납" optional>
                {p => <MoneyInput {...p} value={v.priorityDebt || null} onChange={money('priorityDebt')} />}
              </FormField>
              <FormField label="적용 연도" hint="신청 예정 연도의 기준표">
                {p => (
                  <select {...p} value={v.year} onChange={e => set('year', Number(e.target.value))} className={inputClass}>
                    {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                )}
              </FormField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-extrabold text-slate-900">가족과 사는 곳</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="가구원 수 (본인 포함)">
                {p => (
                  <select {...p} value={v.householdSize} onChange={e => set('householdSize', Number(e.target.value))} className={inputClass}>
                    {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}인</option>)}
                  </select>
                )}
              </FormField>
              <FormField label="그중 미성년 자녀">
                {p => (
                  <select {...p} value={v.minorChildren} onChange={e => set('minorChildren', Number(e.target.value))} className={inputClass}>
                    {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}명</option>)}
                  </select>
                )}
              </FormField>
              <FormField label="사는 지역">
                {p => (
                  <select {...p} value={v.region} onChange={e => set('region', e.target.value as ReviewRegion)} className={inputClass}>
                    {(Object.keys(REVIEW_REGION_LABEL) as ReviewRegion[]).map(r => <option key={r} value={r}>{REVIEW_REGION_LABEL[r]}</option>)}
                  </select>
                )}
              </FormField>
              <FormField label="주거 형태">
                {p => (
                  <select {...p} value={v.housing} onChange={e => set('housing', e.target.value as HousingKind)} className={inputClass}>
                    {(Object.keys(HOUSING_LABEL) as HousingKind[]).map(h => <option key={h} value={h}>{HOUSING_LABEL[h]}</option>)}
                  </select>
                )}
              </FormField>
              {v.housing === 'rent' && (
                <FormField label="월세" optional>
                  {p => <MoneyInput {...p} value={v.monthlyRent || null} onChange={money('monthlyRent')} />}
                </FormField>
              )}
              {(v.housing === 'rent' || v.housing === 'jeonse') && (
                <FormField label="보증금" optional>
                  {p => <MoneyInput {...p} value={v.housingDeposit || null} onChange={money('housingDeposit')} />}
                </FormField>
              )}
              <FormField label="매달 의료비" optional>
                {p => <MoneyInput {...p} value={v.medicalExpense || null} onChange={money('medicalExpense')} />}
              </FormField>
              {v.minorChildren > 0 && (
                <FormField label="자녀 1명당 매달 교육비" optional>
                  {p => <MoneyInput {...p} value={v.educationPerChild || null} onChange={money('educationPerChild')} />}
                </FormField>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-base font-extrabold text-slate-900">주요 재산 <span className="text-sm font-medium text-slate-500">(있는 것만)</span></legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="예금·적금">
                {p => <MoneyInput {...p} value={v.savings || null} onChange={money('savings')} />}
              </FormField>
              <FormField label="보험 해약환급금 합계">
                {p => <MoneyInput {...p} value={v.insuranceRefund || null} onChange={money('insuranceRefund')} />}
              </FormField>
              <FormField label="자동차 (시세 − 할부 잔액)">
                {p => <MoneyInput {...p} value={v.carNet || null} onChange={money('carNet')} />}
              </FormField>
              <FormField label="부동산 (시세 − 담보 대출)">
                {p => <MoneyInput {...p} value={v.realEstateNet || null} onChange={money('realEstateNet')} />}
              </FormField>
            </div>
          </fieldset>

          <label className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
            <input type="checkbox" className="mt-1 w-4 h-4" checked={v.shortPlanReason} onChange={e => set('shortPlanReason', e.target.checked)} />
            <span className="break-keep">
              65세 이상, 중증장애, 30세 미만, 미성년 자녀 2명 이상, 한부모, 전세사기 피해 중 하나에 해당해요
              <span className="block text-xs text-slate-500">회생법원 실무준칙의 3년 미만 변제기간 검토 사유예요. 해당하는지는 변호사가 확인해요.</span>
            </span>
          </label>
        </section>

        <section aria-label="계산 결과" className="lg:col-span-5 lg:sticky lg:top-24">
          <CalcResultPanel range={result} year={v.year} onStartCheck={onStartCheck} onFindLawyer={onFindLawyer} />
        </section>
      </div>
    </div>
  );
}
