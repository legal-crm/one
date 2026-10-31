import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import { FormField, MoneyInput, inputClass } from './ui';
import CalcResultPanel from './calculator/CalcResultPanel';
import {
  computePublicRange, emptyPublicCalcInput, type CourtKind, type HousingKind, type IncomeKind, type PublicCalcInput,
} from '../../services/repayment/publicCalculator';
import { trackEvent } from '../../services/marketing/attribution';
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
  /** 'intake' = 정리 확인 화면에서 직접 불러온 값 (안내 문구 표시) */
  seedSource?: 'quick' | 'intake';
  onStartCheck: () => void;
  onFindLawyer: () => void;
}

const HOUSING_LABEL: Record<HousingKind, string> = { rent: '월세', jeonse: '전세', own: '자가', free: '무상 거주' };
const INCOME_LABEL: Record<IncomeKind, string> = { salary: '급여', business: '영업(자영업)', freelance: '프리랜서·일용' };
const COURT_LABEL: Record<CourtKind, string> = {
  unknown: '모르겠어요', seoul_rehab: '서울회생법원', rehab_court: '수원·부산·대전·대구·광주회생법원', district: '그 밖의 지방법원',
};
const YEARS = [2025, 2026, 2027];

export default function CalculatorView({ initial, seedSource, onStartCheck, onFindLawyer }: CalculatorViewProps) {
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
  const setFact = (k: keyof NonNullable<PublicCalcInput['shortFacts']>, on: boolean) => setV(prev => ({ ...prev, shortFacts: { ...(prev.shortFacts || {}), [k]: on } }));
  // 방문 분석: 결과를 처음 본 때 한 번 (입력값은 보내지 않음)
  const tracked = useRef(false);
  useEffect(() => { if (result && !tracked.current) { tracked.current = true; trackEvent('calculator_used'); } }, [result]);

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

      {seedSource === 'intake' && (
        <p role="status" className="rounded-2xl border border-brand/20 bg-brand-light px-4 py-3 text-sm text-slate-700 break-keep">
          '내 상황 체크하기'에서 정리한 내용에서 불러온 값이에요. 직접 바꿔 볼 수 있고, 여기서 바꾼 값과 결과는 저장하거나 변호사에게 보내지 않아요.
        </p>
      )}

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
              <FormField label="소득 형태">
                {p => (
                  <select {...p} value={v.incomeKind || 'salary'} onChange={e => set('incomeKind', e.target.value as IncomeKind)} className={inputClass}>
                    {(Object.keys(INCOME_LABEL) as IncomeKind[]).map(k => <option key={k} value={k}>{INCOME_LABEL[k]}</option>)}
                  </select>
                )}
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
              {v.householdSize > 1 && (
                <FormField label="배우자 소득">
                  {p => (
                    <select {...p} value={v.spouseIncome || 'none'} onChange={e => set('spouseIncome', e.target.value as any)} className={inputClass}>
                      <option value="none">없음 또는 배우자 없음</option>
                      <option value="yes">있음</option>
                      <option value="unknown">모르겠어요</option>
                    </select>
                  )}
                </FormField>
              )}
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

          <fieldset className="space-y-4">
            <legend className="text-base font-extrabold text-slate-900">변제기간에 영향을 주는 사정 <span className="text-sm font-medium text-slate-500">(선택)</span></legend>
            <p className="text-xs text-slate-500 leading-relaxed break-keep">
              회생법원 실무준칙 제424호는 일부 사정이 있으면 3년보다 짧은 변제기간을 검토할 수 있게 해요. 입력하면 짧은 기간도 범위에 넣어 보여 드려요. 실제로 줄일지는 변호사가 서류를 보고 검토해요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="출생연도" optional hint="만 65세 이상·만 30세 미만 확인용">
                {p => (
                  <input {...p} inputMode="numeric" maxLength={4} className={inputClass} placeholder="예: 1985"
                    value={v.birthYear ? String(v.birthYear) : ''}
                    onChange={e => { const n = Number(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); set('birthYear', n >= 1900 && n <= thisYear ? n : undefined); }} />
                )}
              </FormField>
              <FormField label="관할 법원">
                {p => (
                  <select {...p} value={v.court || 'unknown'} onChange={e => set('court', e.target.value as CourtKind)} className={inputClass}>
                    {(Object.keys(COURT_LABEL) as CourtKind[]).map(k => <option key={k} value={k}>{COURT_LABEL[k]}</option>)}
                  </select>
                )}
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2">
              {([['severeDisability', '장애의 정도가 심한 장애인'], ['singleParent', '한부모 가족'], ['rentFraud', '전세사기피해자 결정을 받음']] as const).map(([k, label]) => (
                <label key={k} className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm cursor-pointer">
                  <input type="checkbox" checked={!!v.shortFacts?.[k]} onChange={e => setFact(k, e.target.checked)} />{label}
                </label>
              ))}
              {v.court === 'seoul_rehab' && (
                <label className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm cursor-pointer">
                  <input type="checkbox" checked={!!v.shortFacts?.vulnerableSeoul} onChange={e => setFact('vulnerableSeoul', e.target.checked)} />
                  최근 2년 급여가 최저임금 수준이고 채무 5천만 원 이하·개인 채권자 없음·1년 안 새 채무 없음
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500">미성년 자녀 2명 이상은 위 가족 칸으로 확인해요. 여기 입력한 사정은 이 화면에서만 쓰고 저장하지 않아요.</p>
          </fieldset>
        </section>

        <section aria-label="계산 결과" className="lg:col-span-5 lg:sticky lg:top-24">
          <CalcResultPanel range={result} year={v.year} onStartCheck={() => { trackEvent('calculator_to_check'); onStartCheck(); }} onFindLawyer={onFindLawyer} />
        </section>
      </div>
    </div>
  );
}
