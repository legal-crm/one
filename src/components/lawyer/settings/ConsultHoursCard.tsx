// 설정 › 사무소 설정 › 상담 가능 시간 (NF-3 나머지)
// 요일별 상담 가능 시간을 열어 두면 상담 예약을 보낼 때 의뢰인·사무소가 그 안에서 바로 고를 수 있어요.
// 공휴일·쉬는 날·이미 확정된 예약 시간은 자동으로 빠지고, 확정은 지금처럼 상대가 고를 때 돼요.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Plus, Save, Trash2 } from 'lucide-react';
import {
  DEFAULT_CONSULT_HOURS, WEEKDAY_ORDER, loadConsultHours, saveConsultHours, validateWeekly,
  type ConsultHours, type WeeklyHours,
} from '../../../services/consult/consultHoursService';
import { BOOKING_METHOD_LABEL, type BookingMethod } from '../../../services/consult/consultBookingService';

const field = 'min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-800 bg-white disabled:bg-slate-50';
const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

export default function ConsultHoursCard({ officeId, canEdit }: { officeId: string; canEdit: boolean }) {
  const [h, setH] = useState<ConsultHours | null>(null);
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newClosed, setNewClosed] = useState('');

  useEffect(() => {
    void loadConsultHours(officeId).then(r => {
      if (r.ok === false) { setError(r.message); setH(DEFAULT_CONSULT_HOURS); return; }
      setSaved(!!r.data);
      setH(r.data || DEFAULT_CONSULT_HOURS);
    });
  }, [officeId]);

  if (!h) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3" aria-hidden="true">{[0, 1, 2].map(i => <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />)}</div>;
  }

  const setDay = (key: keyof WeeklyHours, wins: Array<[string, string]> | undefined) =>
    setH(p => {
      if (!p) return p;
      const weekly = { ...p.weekly };
      if (wins && wins.length) weekly[key] = wins; else delete weekly[key];
      return { ...p, weekly };
    });

  const save = async () => {
    const bad = validateWeekly(h.weekly);
    if (bad) { setError(bad); return; }
    if (!h.methods.length) { setError('받는 상담 방식을 하나 이상 골라 주세요.'); return; }
    setError('');
    setBusy(true);
    const r = await saveConsultHours(officeId, h);
    setBusy(false);
    if (r.ok === false) { setError(r.message); return; }
    setH(r.data);
    setSaved(true);
    toast.success('상담 가능 시간을 저장했어요. 상담 예약 창에서 바로 보여요.');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label="상담 가능 시간">
      <div>
        <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-slate-600" aria-hidden="true" /> 상담 가능 시간</h3>
        <p className="text-sm text-slate-600 mt-1 break-keep">
          열어 둔 시간은 상담 예약을 보낼 때 의뢰인과 사무소 모두에게 '고를 수 있는 시간'으로 보여요. 공휴일·쉬는 날·이미 확정된 예약 시간은 빠져요. 예약 확정은 지금처럼 상대가 시간을 고를 때 돼요.
          {!saved && ' 아직 저장한 시간표가 없어 아래는 기본값이에요.'}
        </p>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
        <input type="checkbox" checked={h.enabled} disabled={!canEdit} onChange={e => setH({ ...h, enabled: e.target.checked })} />
        시간표 쓰기 (끄면 예약 창에 열어 둔 시간을 보여 주지 않아요)
      </label>

      <div className="space-y-2">
        {WEEKDAY_ORDER.map(({ key, label }) => {
          const wins = h.weekly[key] || [];
          return (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-200">
              <label className="inline-flex items-center gap-2 w-20 shrink-0 text-sm font-bold text-slate-800">
                <input type="checkbox" checked={wins.length > 0} disabled={!canEdit} onChange={e => setDay(key, e.target.checked ? [['10:00', '18:00']] : undefined)} />
                {label}
              </label>
              {wins.length === 0 ? <span className="text-sm text-slate-500">쉬는 날</span> : (
                <div className="flex flex-wrap items-center gap-2">
                  {wins.map(([s, e], i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <input type="time" step={600} className={field} value={s} disabled={!canEdit} aria-label={`${label}요일 ${i + 1}번째 시작`}
                        onChange={ev => setDay(key, wins.map((w, j) => (j === i ? [ev.target.value, w[1]] : w)) as Array<[string, string]>)} />
                      <span className="text-slate-500">~</span>
                      <input type="time" step={600} className={field} value={e} disabled={!canEdit} aria-label={`${label}요일 ${i + 1}번째 끝`}
                        onChange={ev => setDay(key, wins.map((w, j) => (j === i ? [w[0], ev.target.value] : w)) as Array<[string, string]>)} />
                      {canEdit && wins.length > 1 && (
                        <button type="button" onClick={() => setDay(key, wins.filter((_, j) => j !== i))} aria-label={`${label}요일 ${i + 1}번째 시간 지우기`}
                          className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-[0.98]">
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  ))}
                  {canEdit && wins.length < 3 && (
                    <button type="button" onClick={() => setDay(key, [...wins, ['14:00', '18:00']])}
                      className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap active:scale-[0.98]">
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />시간 더하기
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1 text-sm font-bold text-slate-700">한 칸 길이
          <select className={`${field} w-full`} value={h.slotMinutes} disabled={!canEdit} onChange={e => setH({ ...h, slotMinutes: Number(e.target.value) as ConsultHours['slotMinutes'] })}>
            {[20, 30, 40, 60].map(m => <option key={m} value={m}>{m}분</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-700">최소 여유
          <select className={`${field} w-full`} value={h.leadHours} disabled={!canEdit} onChange={e => setH({ ...h, leadHours: Number(e.target.value) })}>
            {[1, 2, 4, 12, 24, 48, 72].map(n => <option key={n} value={n}>{n < 24 ? `${n}시간 뒤부터` : `${n / 24}일 뒤부터`}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-700">보여 줄 기간
          <select className={`${field} w-full`} value={h.horizonDays} disabled={!canEdit} onChange={e => setH({ ...h, horizonDays: Number(e.target.value) })}>
            {[7, 14, 21, 30].map(n => <option key={n} value={n}>앞으로 {n}일</option>)}
          </select>
        </label>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-bold text-slate-700">받는 상담 방식</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BOOKING_METHOD_LABEL) as BookingMethod[]).map(m => (
            <label key={m} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm">
              <input type="checkbox" checked={h.methods.includes(m)} disabled={!canEdit}
                onChange={e => setH({ ...h, methods: e.target.checked ? [...h.methods, m] : h.methods.filter(x => x !== m) })} />
              {BOOKING_METHOD_LABEL[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <p className="text-sm font-bold text-slate-700">쉬는 날 (공휴일은 자동으로 빠져요)</p>
        <div className="flex flex-wrap gap-2">
          {h.closedDates.map(d => (
            <span key={d} className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
              {d}
              {canEdit && (
                <button type="button" onClick={() => setH({ ...h, closedDates: h.closedDates.filter(x => x !== d) })} aria-label={`${d} 쉬는 날 지우기`}
                  className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center hover:bg-slate-100"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
              )}
            </span>
          ))}
          {h.closedDates.length === 0 && <span className="text-sm text-slate-500">없음</span>}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <input type="date" className={field} value={newClosed} onChange={e => setNewClosed(e.target.value)} aria-label="쉬는 날 날짜" />
            <button type="button" disabled={!newClosed}
              onClick={() => { if (newClosed && !h.closedDates.includes(newClosed)) setH({ ...h, closedDates: [...h.closedDates, newClosed].sort() }); setNewClosed(''); }}
              className={`${btn} border border-slate-200 text-slate-700`}>쉬는 날 더하기</button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {canEdit && (
        <button type="button" disabled={busy} onClick={save} className={`${btn} bg-slate-900 text-white`}>
          <Save className="w-4 h-4" aria-hidden="true" />{busy ? '저장 중…' : '저장'}
        </button>
      )}
    </section>
  );
}
