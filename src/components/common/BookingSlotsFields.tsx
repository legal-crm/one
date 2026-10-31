// 상담 예약 입력 공용 칸 (NF-3): 상담 방식 + 편한 시간 최대 3개 (사무소·의뢰인 화면이 함께 씀)
import { Plus, Trash2 } from 'lucide-react';
import { BOOKING_METHOD_LABEL, type BookingMethod } from '../../services/consult/consultBookingService';

const field = 'w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';

export default function BookingSlotsFields({
  method, onMethodChange, slots, onSlotsChange, idPrefix,
}: {
  method: BookingMethod;
  onMethodChange: (m: BookingMethod) => void;
  /** datetime-local 값 (사용자 기기 시간) */
  slots: string[];
  onSlotsChange: (s: string[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-bold text-slate-700">상담 방식</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BOOKING_METHOD_LABEL) as BookingMethod[]).map(m => (
            <label
              key={m}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-sm font-semibold cursor-pointer whitespace-nowrap ${method === m ? 'border-brand bg-brand-light text-brand' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              <input type="radio" name={`${idPrefix}-method`} className="sr-only" checked={method === m} onChange={() => onMethodChange(m)} />
              {BOOKING_METHOD_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-slate-700">가능한 시간 (최대 3개)</p>
        {slots.map((s, i) => (
          <div key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`${idPrefix}-slot-${i}`}>{i + 1}번째 시간</label>
            <input
              id={`${idPrefix}-slot-${i}`}
              type="datetime-local"
              step={600}
              className={field}
              value={s}
              onChange={e => onSlotsChange(slots.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => onSlotsChange(slots.filter((_, j) => j !== i))}
                aria-label={`${i + 1}번째 시간 지우기`}
                className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {slots.length < 3 && (
          <button
            type="button"
            onClick={() => onSlotsChange([...slots, ''])}
            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />시간 더하기
          </button>
        )}
        <p className="text-xs text-slate-500">지금부터 30분 뒤 ~ 60일 안에서 고를 수 있어요. 상대가 이 중 하나를 고르면 확정돼요.</p>
      </div>
    </div>
  );
}
