// 설정 › 사무소 설정 › 사건 검토 기준 (CV-5)
// 사건 검토 패널이 이 기준으로 '확인할 점'을 붙이고, 확인 목록을 사건마다 체크하게 한다. 판정은 하지 않는다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { loadCaseReviewRules, saveCaseReviewRules, type CaseReviewRules } from '../../../services/cases/caseReviewRules';

const field = 'mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-800 disabled:bg-slate-50 text-right tabular-nums';

export default function CaseReviewRulesCard({ officeId, canEdit }: { officeId: string; canEdit: boolean }) {
  const [rules, setRules] = useState<CaseReviewRules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const r = await loadCaseReviewRules(officeId);
    if (r.ok === false) { setError(r.message); return; }
    setRules(r.rules);
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div role="alert" className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-rose-700">사건 검토 기준을 불러오지 못했어요. {error}</p>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold inline-flex items-center gap-1.5 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /> 다시 불러오기</button>
      </div>
    );
  }
  if (!rules) {
    return <section aria-busy="true" className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"><div className="h-5 w-40 rounded-lg bg-slate-100 animate-pulse" /><div className="h-24 rounded-xl bg-slate-100 animate-pulse" /></section>;
  }

  const setNum = (k: keyof Omit<CaseReviewRules, 'checklist'>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value.replace(/[^0-9.]/g, '')) || 0;
    setRules(p => (p ? { ...p, [k]: n } : p));
  };
  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    if (rules.checklist.includes(t)) { toast.error('이미 있는 항목이에요.'); return; }
    if (rules.checklist.length >= 20) { toast.error('확인 목록은 20개까지예요.'); return; }
    setRules({ ...rules, checklist: [...rules.checklist, t.slice(0, 80)] });
    setNewItem('');
  };
  const save = async () => {
    setBusy(true);
    const r = await saveCaseReviewRules(officeId, rules);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('사건 검토 기준을 저장했어요. 사건 검토 화면에 바로 반영돼요.');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label="사건 검토 기준">
      <div>
        <h3 className="font-extrabold text-slate-900">사건 검토 기준</h3>
        <p className="text-sm text-slate-600 mt-1">사건 검토 화면에서 아래 기준에 걸리면 '확인할 점'을 보여 줘요. 신청 가능 여부를 판정하지 않아요. 0으로 두면 그 기준은 쓰지 않아요.</p>
      </div>
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">월 변제금이 이 금액보다 적으면 (원)
          <input inputMode="numeric" value={rules.minMonthlyPayment ? rules.minMonthlyPayment.toLocaleString('ko-KR') : ''} placeholder="0" onChange={setNum('minMonthlyPayment')} className={field} />
        </label>
        <label className="text-sm font-semibold text-slate-700">총 채무가 연 소득의 몇 배를 넘으면 (배)
          <input inputMode="decimal" value={rules.maxDebtToAnnualIncome || ''} placeholder="0" onChange={setNum('maxDebtToAnnualIncome')} className={field} />
        </label>
        <label className="text-sm font-semibold text-slate-700">총 변제액이 청산가치보다 최소 몇 % 많아야 하는지 (%)
          <input inputMode="decimal" value={rules.minLiquidationMarginPct || ''} placeholder="0" onChange={setNum('minLiquidationMarginPct')} className={field} />
        </label>
        <label className="text-sm font-semibold text-slate-700">우선채권이 전체 채무의 몇 %를 넘으면 (%)
          <input inputMode="decimal" value={rules.priorityShareWarnPct || ''} placeholder="0" onChange={setNum('priorityShareWarnPct')} className={field} />
        </label>
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">사무소 확인 목록 <span className="font-normal text-slate-500">(사건마다 체크, 20개까지)</span></p>
        {rules.checklist.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">아직 항목이 없어요. 예: '최근 1년 새 채무 사용처 확인', '배우자 소득 자료 받음'.</p>
        ) : (
          <ul className="space-y-1.5">
            {rules.checklist.map(item => (
              <li key={item} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">
                <span>{item}</span>
                {canEdit && (
                  <button type="button" aria-label={`${item} 지우기`} onClick={() => setRules({ ...rules, checklist: rules.checklist.filter(x => x !== item) })} className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:scale-[0.98]"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <input value={newItem} maxLength={80} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="확인할 항목" className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm" />
            <button type="button" onClick={addItem} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold whitespace-nowrap inline-flex items-center gap-1 active:scale-[0.98]"><Plus className="w-4 h-4" aria-hidden="true" /> 넣기</button>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"><Save className="w-4 h-4" aria-hidden="true" /> {busy ? '저장 중…' : '저장'}</button>
        </div>
      )}
      {!rules.minMonthlyPayment && !rules.maxDebtToAnnualIncome && !rules.minLiquidationMarginPct && !rules.priorityShareWarnPct && rules.checklist.length === 0 && (
        <p className="text-xs text-slate-500">기준이 비어 있으면 사건 검토는 계산 결과와 계산 안내만 보여 줘요.</p>
      )}
    </section>
  );
}
