import React, { useMemo, useState } from 'react';
import { CalendarClock, AlertTriangle, CalendarX2 } from 'lucide-react';
import { localYmd } from '../../../../utils/localDate';
import {
  computeCourtDeadline, daysUntil, formatYmdWithDow, DeadlineUnit,
} from '../../../../services/court/deadlineCalculator';
import { HOLIDAY_DATA_LAST_YEAR } from '../../../../utils/koreanHolidays';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

const UNIT_LABEL: Record<DeadlineUnit, string> = { day: '일', week: '주', month: '개월' };

const PRESETS: { label: string; amount: number; unit: DeadlineUnit }[] = [
  { label: '7일', amount: 7, unit: 'day' },
  { label: '14일', amount: 14, unit: 'day' },
  { label: '1개월', amount: 1, unit: 'month' },
];

function ddayLabel(diff: number | null): { text: string; tone: string } {
  if (diff === null) return { text: '', tone: '' };
  if (diff > 0) return { text: `D-${diff}`, tone: diff <= 3 ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white' };
  if (diff === 0) return { text: 'D-day', tone: 'bg-rose-600 text-white' };
  return { text: `기한 경과 ${-diff}일`, tone: 'bg-slate-700 text-white' };
}

/**
 * 기한·기일 계산기
 * - 송달일(고지일) 기준 N일·N주·N개월 만료일을 민법 제157·160·161조로 계산하고
 *   말일이 토요일·일요일·공휴일이면 다음 날로 연장한다.
 * - 입력값은 저장하지 않는다.
 */
export default function DeadlineCalcTool() {
  const [baseDate, setBaseDate] = useState(() => localYmd());
  const [amountText, setAmountText] = useState('7');
  const [unit, setUnit] = useState<DeadlineUnit>('day');
  const { copied, copy } = useCopyFeedback();

  const amount = Number(amountText);
  const amountValid = Number.isInteger(amount) && amount >= 1 && amount <= (unit === 'day' ? 365 : unit === 'week' ? 52 : 24);

  const result = useMemo(
    () => (baseDate && amountValid ? computeCourtDeadline(baseDate, amount, unit) : null),
    [baseDate, amount, unit, amountValid],
  );
  const dday = ddayLabel(result ? daysUntil(result.date) : null);

  const handleCopy = () => {
    if (!result) return;
    const extended = result.extendedOver.length > 0
      ? `\n• 연장: 말일 ${formatYmdWithDow(result.rawEndDate)} (${result.extendedOver.map(x => `${x.date.slice(5)} ${x.reason}`).join(', ')}) → 다음 평일 만료`
      : '';
    const text = `[기한 계산 (참고)]
• 기준일(송달·고지): ${formatYmdWithDow(baseDate)}
• 기간: ${amount}${UNIT_LABEL[unit]} (초일 불산입, ${formatYmdWithDow(result.startDate)}부터 기산)
• 만료일: ${formatYmdWithDow(result.date)}${extended}
※ 민법 제157·160·161조 기준 계산입니다. 기산일과 기간은 재판서·공고 내용으로 확인해 주세요.`;
    copy(text, '기한 계산 결과가 복사되었습니다.');
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      {/* 입력 */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="deadline-base" className="text-[11px] font-bold text-slate-700 block mb-1">
              기준일 (송달·고지일)
            </label>
            <input
              id="deadline-base"
              type="date"
              value={baseDate}
              onChange={e => setBaseDate(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>
          <div>
            <label htmlFor="deadline-amount" className="text-[11px] font-bold text-slate-700 block mb-1">
              기간
            </label>
            <div className="flex gap-1">
              <input
                id="deadline-amount"
                type="number"
                inputMode="numeric"
                min={1}
                value={amountText}
                onChange={e => setAmountText(e.target.value)}
                aria-invalid={!amountValid || undefined}
                aria-describedby={!amountValid ? 'deadline-amount-error' : undefined}
                className={`w-full min-w-0 px-2 py-1.5 bg-white border rounded-xl text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 ${
                  amountValid ? 'border-slate-300 focus:ring-sky-500/40' : 'border-rose-400 focus:ring-rose-500/40'
                }`}
              />
              <select
                value={unit}
                onChange={e => setUnit(e.target.value as DeadlineUnit)}
                aria-label="기간 단위"
                className="px-1.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                <option value="day">일</option>
                <option value="week">주</option>
                <option value="month">개월</option>
              </select>
            </div>
          </div>
        </div>
        {!amountValid && (
          <p id="deadline-amount-error" className="text-[11px] font-bold text-rose-700">
            기간은 1 이상의 정수로 입력하세요 (일 365·주 52·개월 24 이하).
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500">빠른 선택</span>
          {PRESETS.map(p => {
            const selected = amountValid && amount === p.amount && unit === p.unit;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setAmountText(String(p.amount));
                  setUnit(p.unit);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer press-scale ${
                  selected ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setBaseDate(localYmd())}
            className="ml-auto px-2 py-1 rounded-lg text-[11px] font-bold text-sky-700 hover:bg-sky-50 cursor-pointer"
          >
            기준일 오늘로
          </button>
        </div>
      </div>

      {/* 결과 */}
      {result ? (
        <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 p-3.5 rounded-2xl border border-sky-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-sky-700" aria-hidden="true" />
              만료일
            </span>
            {dday.text && (
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg tabular-nums ${dday.tone}`}>{dday.text}</span>
            )}
          </div>
          <p className="text-lg font-black text-sky-800 tabular-nums">{formatYmdWithDow(result.date)}</p>
          <div className="text-[11px] text-slate-600 space-y-0.5 pt-1.5 border-t border-sky-200/70">
            <p>기산일 {formatYmdWithDow(result.startDate)} (초일 불산입)</p>
            {result.extendedOver.length > 0 ? (
              <p>
                말일 {formatYmdWithDow(result.rawEndDate)} → 연장:{' '}
                {result.extendedOver.map(x => `${x.date.slice(5)} ${x.reason}`).join(', ')}
              </p>
            ) : (
              <p>말일이 평일이라 연장 없음</p>
            )}
          </div>
          {result.holidayDataMissing && (
            <p className="flex items-start gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              {HOLIDAY_DATA_LAST_YEAR}년 이후 설·추석·대체공휴일 자료가 없어 주말과 고정 공휴일만 반영했습니다. 달력으로 직접 확인하세요.
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-600 border border-slate-200 space-y-1">
          <CalendarX2 className="w-5 h-5 mx-auto text-slate-500" aria-hidden="true" />
          <p className="font-bold">기준일과 기간을 입력하면 만료일을 계산합니다.</p>
          <p className="text-[11px] text-slate-500">빠른 선택 버튼으로 7일·14일·1개월을 바로 넣을 수 있습니다.</p>
        </div>
      )}

      {/* 계산 기준 */}
      <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1 leading-relaxed">
        <p className="font-bold text-slate-700">계산 기준</p>
        <p>• 초일 불산입(민법 제157조), 주·월은 역에 따라 계산(제160조), 말일이 토요일·공휴일이면 익일 만료(제161조). 민사소송법 제170조가 민법을 따르도록 정합니다.</p>
        <p>• 참고: 즉시항고는 재판을 고지받은 날부터 1주(민사소송법 제444조), 채무자회생법상 공고된 재판은 공고일부터 14일(같은 법 제13조). 기산일·적용 조문은 재판서와 공고로 확인하세요.</p>
        <p>• 임시공휴일은 지정 후 공휴일 표에 추가해야 반영됩니다.</p>
      </div>

      <CopyButton copied={copied} onClick={handleCopy} disabled={!result} label="기한 안내 복사" />
    </div>
  );
}
