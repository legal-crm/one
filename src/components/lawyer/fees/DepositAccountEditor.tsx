// 수임료 입금 계좌 (서버): 사무소 기본 계좌 또는 사건별 계좌. 의뢰인 '내 사건' 수임료 칸에 그대로 보인다
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Landmark } from 'lucide-react';
import {
  loadDepositAccount,
  loadOfficeDepositAccount,
  saveDepositAccount,
  type DepositAccount,
} from '../../../services/fees/feeService';

type Account = { bankName: string; accountNumber: string; accountHolder: string };
const EMPTY: Account = { bankName: '', accountNumber: '', accountHolder: '' };

export default function DepositAccountEditor({ officeId, caseId, canEdit }: { officeId: string; caseId: string | null; canEdit: boolean }) {
  const [current, setCurrent] = useState<(Account & { scope?: DepositAccount['scope'] }) | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Account>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const r = caseId ? await loadDepositAccount(caseId) : await loadOfficeDepositAccount(officeId);
    if (r.ok === false) { setError(r.message); setCurrent(null); return; }
    setCurrent(r.data);
  }, [officeId, caseId]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = () => {
    // 사건 계좌가 없으면 빈 칸에서 시작 (사무소 기본 계좌를 사건 계좌로 복사하지 않음)
    setForm(current && (!caseId || current.scope === 'case') ? { bankName: current.bankName, accountNumber: current.accountNumber, accountHolder: current.accountHolder } : EMPTY);
    setFormError('');
    setEditing(true);
  };

  const save = async (clear = false) => {
    setFormError('');
    const a = clear ? EMPTY : { bankName: form.bankName.trim(), accountNumber: form.accountNumber.replace(/\s/g, ''), accountHolder: form.accountHolder.trim() };
    if (!clear && (!a.bankName || !a.accountNumber || !a.accountHolder)) { setFormError('은행·계좌번호·예금주를 모두 입력해 주세요.'); return; }
    if (!clear && !/^[0-9][0-9-]{4,28}[0-9]$/.test(a.accountNumber)) { setFormError('계좌번호는 숫자와 - 만 입력해 주세요.'); return; }
    setSaving(true);
    const r = await saveDepositAccount(officeId, caseId, a);
    setSaving(false);
    if (r.ok === false) { setFormError(r.message); return; }
    toast.success(clear ? (caseId ? '사건 계좌를 지웠습니다. 사무소 기본 계좌가 안내됩니다.' : '사무소 기본 계좌를 지웠습니다.') : '입금 계좌를 저장했습니다. 의뢰인 화면에 바로 보입니다.');
    setEditing(false);
    void load();
  };

  const field = 'w-full p-2.5 rounded-xl border border-slate-200 text-sm';
  const title = caseId ? '이 사건 입금 계좌' : '사무소 기본 입금 계좌';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Landmark className="w-4 h-4 text-slate-600" />{title}</span>
        {canEdit && !editing && current !== undefined && (
          <button onClick={startEdit} className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold whitespace-nowrap cursor-pointer active:scale-[0.98]">
            {caseId ? (current?.scope === 'case' ? '바꾸기' : '사건 계좌 따로 정하기') : (current ? '바꾸기' : '등록하기')}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {current === undefined && !error && <div className="h-6 rounded-lg bg-slate-200 animate-pulse" aria-busy="true" />}
      {current !== undefined && !editing && (
        current ? (
          <p className="text-sm text-slate-800 break-all">
            {current.bankName} <span className="font-mono">{current.accountNumber}</span> ({current.accountHolder})
            {caseId && <span className="ml-1 text-xs text-slate-500">{current.scope === 'case' ? '· 사건 계좌' : '· 사무소 기본 계좌'}</span>}
          </p>
        ) : (
          <p className="text-xs text-slate-600">{caseId ? '등록된 계좌가 없어 의뢰인에게 계좌가 안내되지 않습니다. 사무소 기본 계좌를 등록하거나 이 사건 계좌를 정해 주세요.' : '등록하면 수납 일정이 있는 모든 사건의 의뢰인 화면에 이 계좌가 안내됩니다.'}</p>
        )
      )}
      {editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">은행</span><input value={form.bankName} maxLength={30} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className={field} /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">계좌번호</span><input value={form.accountNumber} inputMode="numeric" maxLength={30} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} className={field} /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-slate-700">예금주</span><input value={form.accountHolder} maxLength={40} onChange={e => setForm(f => ({ ...f, accountHolder: e.target.value }))} className={field} /></label>
          </div>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(false)} className="px-4 min-h-[40px] rounded-xl border border-slate-300 bg-white text-sm font-bold whitespace-nowrap cursor-pointer">취소</button>
            <button onClick={() => save(false)} disabled={saving} className="px-4 min-h-[40px] rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{saving ? '저장 중…' : '저장'}</button>
            {((caseId && current?.scope === 'case') || (!caseId && current)) && (
              <button onClick={() => save(true)} disabled={saving} className="px-4 min-h-[40px] rounded-xl border border-rose-200 bg-white text-sm font-bold text-rose-600 whitespace-nowrap disabled:opacity-50 cursor-pointer">{caseId ? '사건 계좌 지우기' : '지우기'}</button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">저장하면 의뢰인 '내 사건' 수임료 칸에 바로 보입니다. 바꾼 기록은 사무소 활동 기록에 남습니다(계좌번호 끝 4자리).</p>
        </div>
      )}
    </div>
  );
}
