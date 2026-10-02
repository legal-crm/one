import React, { useState } from 'react';
import { Scale, ArrowDownToLine, Info } from 'lucide-react';
import { toast } from 'sonner';
import { setDockShared, useDockShared } from '../dockShared';
import { computeQuickExtraExpense, formatHousehold, HOUSEHOLD_OPTIONS } from '../quickCalc';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import RegionSelect from '../ui/RegionSelect';
import { won } from '../ui/money';
import { REGION_CONFIG_2026 } from '../../../../services/repayment/repaymentConstants2026';

/**
 * 추가생계비 검토 참고
 * - 이전 버전의 근거 없는 주거비 금액표('서울 1~2인 최대 월 38~45만 원' 등), 확인되지 않은 준칙 번호,
 *   '양육비 전액 가산' 같은 단정 문구를 없애고,
 *   변제계획안 엔진(calculateLivingExpenseAndDisposableIncome)과 같은 산식으로 추가 인정 예상액을 계산한다.
 * - 실제 인정 여부·금액은 소명 자료와 관할 법원 판단에 따른다.
 */
export default function ExtraExpenseTool() {
  const shared = useDockShared();
  const [housing, setHousing] = useState(0);
  const [medical, setMedical] = useState(0);
  const [children, setChildren] = useState(0);
  const [educationPerChild, setEducationPerChild] = useState(0);
  const [special, setSpecial] = useState(false);
  const { copied, copy } = useCopyFeedback();

  const r = computeQuickExtraExpense({
    householdSize: shared.householdSize,
    region: shared.region,
    housing,
    medical,
    children,
    educationPerChild,
    special,
  });
  const hasInput = housing > 0 || medical > 0 || (children > 0 && educationPerChild > 0);

  const handleApply = () => {
    setDockShared({ extraLivingCost: r.total });
    toast.success(`추가생계비 ${won(r.total)}을 가용소득 계산에 반영했습니다. (중위소득표 도구)`);
  };

  const handleCopy = () => {
    const text = `[추가생계비 검토 (참고, 관할 법원 기준 확인 필요)]
• 가구원 ${formatHousehold(shared.householdSize)} · ${REGION_CONFIG_2026[shared.region].name}
• 주거비: 월 ${won(housing)} → 추가 인정 예상 ${won(r.housing)} (지역 한도 ${won(r.housingLimit)}, 생계비 포함분 ${won(r.housingIncluded)})
• 의료비: 월 ${won(medical)} → 추가 인정 예상 ${won(r.medical)} (기초의료비 ${won(r.medicalBase)} 초과분)
• 교육비: 자녀 ${children}명 × 월 ${won(educationPerChild)} → 추가 인정 예상 ${won(r.education)}
• 합계: 월 ${won(r.total)}
※ 소명 자료: 주거비(임대차계약서·월세 이체내역), 의료비(진단서·최근 영수증), 교육비(재학증명서·납입영수증). 인정 여부와 금액은 법원이 판단합니다.`;
    copy(text, '추가생계비 검토 내용이 복사되었습니다.');
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      <p className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-700" aria-hidden="true" />
        변제계획안 화면과 같은 산식으로 추가 인정 예상액을 계산합니다. 인정 여부와 금액은 소명 자료와 관할 법원 판단에 따릅니다.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="extra-household" className="text-xs text-slate-600 font-semibold block mb-0.5">가구원 수</label>
          <select
            id="extra-household"
            value={shared.householdSize}
            onChange={e => setDockShared({ householdSize: Number(e.target.value) })}
            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            {HOUSEHOLD_OPTIONS.map(n => (
              <option key={n} value={n}>{Number.isInteger(n) ? `${n}인` : `${n}인 (공동부양)`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="extra-region" className="text-xs text-slate-600 font-semibold block mb-0.5">거주 지역</label>
          <RegionSelect id="extra-region" value={shared.region} onChange={region => setDockShared({ region })} />
        </div>
      </div>

      {/* 1. 주거비 */}
      <div className="border border-slate-200 rounded-2xl p-3 space-y-1.5 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <label htmlFor="extra-housing" className="font-bold text-slate-900">주거비 (월세·주담대 이자 등)</label>
          <span className="text-xs bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded-lg">
            추가 {won(r.housing)}
          </span>
        </div>
        <MoneyInput id="extra-housing" value={housing} onChange={setHousing} placeholder="월 실제 주거비" />
        <p className="text-xs text-slate-600 leading-snug">
          지역 한도 {won(r.housingLimit)}까지 인정 대상으로 보고, 기준생계비에 포함된 주거비 {won(r.housingIncluded)}를 뺀 금액입니다.
          소명: 임대차계약서, 월세 이체내역.
        </p>
      </div>

      {/* 2. 의료비 */}
      <div className="border border-slate-200 rounded-2xl p-3 space-y-1.5 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <label htmlFor="extra-medical" className="font-bold text-slate-900">지속적 의료비</label>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-lg">
            추가 {won(r.medical)}
          </span>
        </div>
        <MoneyInput id="extra-medical" value={medical} onChange={setMedical} placeholder="월 평균 본인부담 의료비" />
        <p className="text-xs text-slate-600 leading-snug">
          기초의료비 {won(r.medicalBase)}를 넘는 금액입니다. 소명: 진단서, 최근 진료비 영수증.
        </p>
      </div>

      {/* 3. 교육비 */}
      <div className="border border-slate-200 rounded-2xl p-3 space-y-1.5 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">자녀 교육비</span>
          <span className="text-xs bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-lg">
            추가 {won(r.education)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="extra-children" className="text-xs text-slate-600 font-semibold block mb-0.5">자녀 수</label>
            <input
              id="extra-children"
              type="number"
              min={0}
              max={10}
              value={children}
              onChange={e => setChildren(Math.min(10, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="extra-education" className="text-xs text-slate-600 font-semibold block mb-0.5">1인당 월 교육비</label>
            <MoneyInput id="extra-education" value={educationPerChild} onChange={setEducationPerChild} placeholder="예: 30만" />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={special} onChange={e => setSpecial(e.target.checked)} className="rounded accent-blue-600" />
          특수교육·발달치료 (의사소견서 등 소명)
        </label>
        <p className="text-xs text-slate-600 leading-snug">
          1인당 생계비 포함분 {won(r.educationIncluded)}를 넘는 금액을 1인당 {won(r.educationCap)} 한도로 봅니다.
          양육비는 판결문·양육비부담조서 등 소명 자료에 따라 판단됩니다.
        </p>
      </div>

      {/* 합계 */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 p-3 rounded-2xl border border-purple-200 space-y-2" aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-purple-700" aria-hidden="true" />
            추가생계비 인정 예상 합계
          </span>
          <span className="text-base font-black text-purple-800 tabular-nums">월 {won(r.total)}</span>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasInput}
          className="w-full min-h-[36px] py-1.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer press-scale flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
          가용소득 계산에 반영
        </button>
      </div>

      <CopyButton copied={copied} onClick={handleCopy} disabled={!hasInput} label="추가생계비 검토 복사" />
    </div>
  );
}
