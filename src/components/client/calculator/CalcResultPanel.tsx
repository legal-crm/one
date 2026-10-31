import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Callout } from '../ui';
import { formatMan, type PublicCalcRange } from '../../../services/repayment/publicCalculator';

export const CALC_DISCLAIMER = '공개된 기준을 적용한 참고용 일반 계산이며, 개인 사건의 결과를 판단하지 않습니다. 입력한 값은 저장하거나 보내지 않습니다.';

/**
 * 제도 이해용 계산기 결과 (B-7): 범위 + 계산 과정 펼치기 + 결과를 바꾸는 요인 + 근거
 * 감면율·감면액·'가능/불가' 표현과 상담 요청 연결 버튼은 두지 않는다.
 */
export default function CalcResultPanel({
  range, year, onStartCheck, onFindLawyer, extraAction,
}: {
  range: PublicCalcRange | null;
  year: number;
  onStartCheck: () => void;
  onFindLawyer?: () => void;
  /** 빠른 모드의 '자세히 계산하기' 같은 추가 버튼 */
  extraAction?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!range) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 leading-relaxed">
        월 소득과 총 채무를 넣으면 공개 기준으로 계산한 월 변제금·변제기간의 대략적인 범위가 여기에 나와요.
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {range.noDisposable ? (
        <Callout tone="warning" title="입력한 소득이 기본 생계비보다 적거나 같아요">
          이 경우 매달 갚을 돈이 계산되지 않아요. 개인회생 대신 개인파산 절차를 살펴볼 수 있는지는 변호사와 확인해 보세요.
        </Callout>
      ) : range.liquidationExceeds ? (
        <Callout tone="warning" title="입력한 재산 가치가 채무 이상이에요">
          이 경우 개인회생 계산 방식이 맞지 않을 수 있어요. 어떤 절차가 맞는지는 변호사와 확인해 보세요.
        </Callout>
      ) : (
        <div className="rounded-2xl border border-brand/20 bg-brand-light p-5 space-y-3">
          <p className="text-xs font-bold text-brand">공개 기준 참고 범위 ({year}년 기준표)</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-slate-600">월 변제금</dt>
              <dd className="text-xl md:text-2xl font-black text-slate-900 tabular-nums break-keep">
                {range.monthlyLow === range.monthlyHigh ? `약 ${formatMan(range.monthlyLow)} 안팎` : `약 ${formatMan(range.monthlyLow)} ~ ${formatMan(range.monthlyHigh)}`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">변제기간</dt>
              <dd className="text-xl md:text-2xl font-black text-slate-900 tabular-nums">
                {range.monthsLow === range.monthsHigh ? `${range.monthsLow}개월` : `${range.monthsLow} ~ ${range.monthsHigh}개월`}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-slate-700">
            이 기간 동안 갚는 돈은 모두 약 {range.totalLow === range.totalHigh ? formatMan(range.totalLow) : `${formatMan(range.totalLow)} ~ ${formatMan(range.totalHigh)}`}이에요.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="w-full min-h-11 px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-800 cursor-pointer active:scale-[0.99]"
        >
          <span>어떻게 계산했나요?</span>
          {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3">
            <ol className="space-y-2">
              {range.steps.map((s, idx) => (
                <li key={s.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-700 break-keep">
                    {idx + 1}. {s.label}
                    {s.note && <span className="block text-xs text-slate-500">{s.note}</span>}
                  </span>
                  <span className="shrink-0 font-bold text-slate-900 tabular-nums text-right">{s.value}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 leading-relaxed">
              근거: 보건복지부 기준 중위소득 고시(생계비는 개시신청 당시 기준, 회생법원 실무준칙 제405호), 각 회생법원 생계비 검토 위원회 의결(추가 생계비), 민사집행법 시행령(압류금지 예금·보험 환급금 250만 원), 채무자회생법(변제기간 3년 원칙·최장 5년).
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-bold text-slate-800">결과를 바꾸는 요인</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 leading-relaxed">
          {range.factors.map(f => <li key={f} className="break-keep">{f}</li>)}
        </ul>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed break-keep">{CALC_DISCLAIMER}</p>

      <div className="flex flex-col sm:flex-row gap-2">
        {extraAction}
        <Button variant={extraAction ? 'secondary' : 'primary'} onClick={onStartCheck}>내 상황 체크하기</Button>
        {onFindLawyer && <Button variant="ghost" onClick={onFindLawyer}>변호사 찾기</Button>}
      </div>
    </div>
  );
}
