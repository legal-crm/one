// 부채증명 발급 대행사 설정 (DC-9) — 사무소가 거래하는 대행사·건당 비용·평균 소요 영업일·의뢰인 금액 공개
// 서버 office_debt_agencies (쓰기 = 사무소 설정 권한). 대행사 계정·로그인은 만들지 않는다.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { loadDebtAgencies, saveDebtAgency, type DebtAgency } from '../../../services/debt/debtLedgerService';

const field = 'mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm bg-white';
const empty = (): Omit<DebtAgency, 'id'> & { id?: string } => ({ name: '', phone: '', email: '', feePer: undefined, issueFeePer: undefined, avgBusinessDays: 7, showAmountsToClient: false });

export default function DebtAgencySettingsModal({ officeId, onClose, onSaved }: { officeId: string; onClose: () => void; onSaved: (list: DebtAgency[]) => void }) {
  const [list, setList] = useState<DebtAgency[] | null>(null);
  const [draft, setDraft] = useState(empty());
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadDebtAgencies(officeId).then(setList); }, [officeId]);
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/\D/g, '')) || 0);

  const save = async () => {
    if (!draft.name.trim()) { toast.error('대행사 이름을 적어 주세요.'); return; }
    setBusy(true);
    const r = await saveDebtAgency(officeId, draft);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    const next = await loadDebtAgencies(officeId);
    setList(next); onSaved(next); setDraft(empty());
    toast.success('대행사를 저장했어요.');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="debt-agency-title" className="w-full max-w-xl rounded-3xl bg-white shadow-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 id="debt-agency-title" className="text-base font-black text-slate-900">부채증명 발급 대행사</h3>
            <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4 text-sm">
            {!list && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />}
            {list && list.length === 0 && <p className="text-slate-500">아직 등록한 대행사가 없어요.</p>}
            {list && list.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {list.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span><b>{a.name}</b><span className="block text-xs text-slate-500">건당 대행비 {a.feePer?.toLocaleString('ko-KR') ?? '-'}원 · 발급비 {a.issueFeePer?.toLocaleString('ko-KR') ?? '-'}원 · 평균 {a.avgBusinessDays}영업일{a.showAmountsToClient ? ' · 의뢰인에게 금액 보임' : ''}</span></span>
                    <button type="button" onClick={() => setDraft({ ...a })} className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-xs font-bold">고치기</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="font-bold text-slate-900">{draft.id ? '대행사 고치기' : <><Plus className="w-4 h-4 inline" /> 대행사 등록</>}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-700">이름<input value={draft.name} maxLength={80} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={field} /></label>
                <label className="text-xs font-semibold text-slate-700">연락처<input value={draft.phone || ''} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} className={field} /></label>
                <label className="text-xs font-semibold text-slate-700">이메일<input value={draft.email || ''} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className={field} /></label>
                <label className="text-xs font-semibold text-slate-700">평균 소요 영업일<input type="number" min={1} max={60} value={draft.avgBusinessDays} onChange={e => setDraft(d => ({ ...d, avgBusinessDays: Math.min(60, Math.max(1, Number(e.target.value) || 7)) }))} className={field} /></label>
                <label className="text-xs font-semibold text-slate-700">건당 대행비(원, 실제 견적)<input inputMode="numeric" value={draft.feePer ?? ''} onChange={e => setDraft(d => ({ ...d, feePer: num(e.target.value) }))} className={field} /></label>
                <label className="text-xs font-semibold text-slate-700">건당 발급비(원)<input inputMode="numeric" value={draft.issueFeePer ?? ''} onChange={e => setDraft(d => ({ ...d, issueFeePer: num(e.target.value) }))} className={field} /></label>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-4 h-4" checked={draft.showAmountsToClient} onChange={e => setDraft(d => ({ ...d, showAmountsToClient: e.target.checked }))} /> 의뢰인 '내 사건'에 증명서 금액도 보여 주기 (기본: 진행만)</label>
              <div className="flex justify-end gap-2">
                {draft.id && <button type="button" onClick={() => setDraft(empty())} className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-sm font-bold">새로 등록</button>}
                <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[40px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '저장 중…' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
