// 회생동행 › 개인파산·면책: 주요 날짜와 법정 기한 (BK-8)
// 법원·관재인 안내문의 날짜(파산선고일·채권자집회일·면책 결정일)를 옮겨 적으면 법정 기한을 계산해 보여 준다.
// 계산은 변호사 사건 화면과 같은 규칙(bankruptcyDeadlines: 초일 불산입·말일이 토요일·공휴일이면 다음 날).
// 판단은 하지 않는다 — 안내문의 날짜가 기준이고, 다르면 안내문을 따른다.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock } from 'lucide-react';
import type { BankruptcyCompanionCase } from '../../../types';
import { Badge, Button } from '../ui';
import { saveBankruptcyCase } from '../../../services/companionService';
import { bankruptcyDeadlines } from '../../../services/cases/bankruptcyCaseService';
import { parseLocalYmd } from '../../../utils/localDate';

type KeyDates = NonNullable<BankruptcyCompanionCase['keyDates']>;
const field = 'w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';

const dday = (ymd: string): number | null => {
  const d = parseLocalYmd(ymd);
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

export default function BankruptcyKeyDates({ caseData, clientId, onCaseUpdated }: {
  caseData: BankruptcyCompanionCase;
  clientId?: string;
  onCaseUpdated?: (c: BankruptcyCompanionCase) => void;
}) {
  const [v, setV] = useState<KeyDates>(() => ({ ...(caseData.keyDates || {}) }));
  const [busy, setBusy] = useState(false);
  const saved = caseData.keyDates || {};
  const changed = JSON.stringify(v) !== JSON.stringify(saved);

  const deadlines = useMemo(() => bankruptcyDeadlines({
    declaredOn: saved.declaredOn, creditorsMeetingOn: saved.creditorsMeetingOn,
    dischargeDecidedOn: saved.dischargeDecidedOn, dischargeResult: saved.dischargeResult,
  }), [saved.declaredOn, saved.creditorsMeetingOn, saved.dischargeDecidedOn, saved.dischargeResult]);

  const save = () => {
    setBusy(true);
    const clean: KeyDates = {
      declaredOn: v.declaredOn || undefined,
      creditorsMeetingOn: v.creditorsMeetingOn || undefined,
      dischargeDecidedOn: v.dischargeDecidedOn || undefined,
      dischargeResult: v.dischargeDecidedOn ? (v.dischargeResult || 'granted') : undefined,
    };
    const updated = { ...caseData, keyDates: clean };
    saveBankruptcyCase(updated, clientId);
    onCaseUpdated?.(updated);
    setBusy(false);
    toast.success('날짜를 저장하고 기한을 다시 계산했어요.');
  };

  return (
    <section aria-labelledby="bk-dates-title" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h2 id="bk-dates-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-brand" aria-hidden="true" />
          주요 날짜와 기한
        </h2>
        <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">
          법원·파산관재인이 보낸 안내문의 날짜를 옮겨 적으면 법에 정해진 기한을 계산해 드려요. 안내문에 다른 날짜가 적혀 있으면 안내문을 따르세요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="space-y-1 text-sm font-bold text-slate-700">파산선고일
          <input type="date" className={field} value={v.declaredOn || ''} onChange={e => setV(p => ({ ...p, declaredOn: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-700">채권자집회일
          <input type="date" className={field} value={v.creditorsMeetingOn || ''} onChange={e => setV(p => ({ ...p, creditorsMeetingOn: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm font-bold text-slate-700">면책 결정일
          <input type="date" className={field} value={v.dischargeDecidedOn || ''} onChange={e => setV(p => ({ ...p, dischargeDecidedOn: e.target.value }))} />
        </label>
      </div>
      {v.dischargeDecidedOn && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-bold text-slate-700">면책 결정 내용</legend>
          <div className="flex flex-wrap gap-2">
            {([['granted', '면책 허가'], ['partial', '일부 면책'], ['denied', '면책 불허가']] as const).map(([k, l]) => (
              <label key={k} className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-sm font-semibold cursor-pointer ${(v.dischargeResult || 'granted') === k ? 'border-brand bg-brand-light text-brand' : 'border-slate-300 bg-white text-slate-700'}`}>
                <input type="radio" name="bk-discharge-result" className="sr-only" checked={(v.dischargeResult || 'granted') === k} onChange={() => setV(p => ({ ...p, dischargeResult: k }))} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {changed && (
        <Button onClick={save} loading={busy} className="w-full sm:w-auto">날짜 저장</Button>
      )}

      {deadlines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
          날짜를 저장하면 서류 제출·면제재산 신청 같은 기한이 여기에 나와요.
        </p>
      ) : (
        <ul className="space-y-2">
          {deadlines.map(d => {
            const left = dday(d.date);
            return (
              <li key={d.key} className="rounded-2xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{d.label}</p>
                  <p className="text-xs text-slate-600 break-keep">{d.basis}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{d.date}</span>
                  {left !== null && (
                    <Badge tone={left < 0 ? 'neutral' : left <= 3 ? 'warning' : 'brand'}>
                      {left > 0 ? `D-${left}` : left === 0 ? '오늘' : '지남'}
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
