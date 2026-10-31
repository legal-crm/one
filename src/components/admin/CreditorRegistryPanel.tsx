// 통합어드민 › 플랫폼 설정: 공용 채권자 정보 (NF-5)
// 금융회사·공공기관 공개 정보만. 항목마다 확인일·출처, 1년 지나면 '확인 필요'. 사무소 수정 제안을 확인해 반영한다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Landmark, RefreshCw } from 'lucide-react';
import {
  adminListCreditorRegistry, adminListCreditorSuggestions, adminReviewCreditorSuggestion, adminSetCreditorActive, adminUpsertCreditor,
  makeCreditorId, CREDITOR_FIELD_LABELS, type CreditorRegistryRow, type CreditorSuggestion, type CreditorChanges,
} from '../../services/court/creditorRegistryService';
import { creditorNeedsCheck } from '../../services/court/creditorAddressDirectory';
import { useDialog } from '../common/DialogProvider';

const EDIT_KEYS: Array<keyof CreditorChanges> = ['official_name', 'category', 'category_label', 'representative', 'biz_number', 'zip_code', 'address', 'service_address', 'phone', 'fax', 'cert_desk', 'source', 'verified_on'];
const CATEGORIES = ['BANK', 'CARD', 'CAPITAL', 'SAVINGS_BANK', 'LOAN_NPL', 'PUBLIC_AGENCY', 'INSURANCE', 'MUTUAL', 'OTHER'];
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function CreditorRegistryPanel() {
  const dialog = useDialog();
  const [rows, setRows] = useState<CreditorRegistryRow[] | null>(null);
  const [suggestions, setSuggestions] = useState<CreditorSuggestion[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [editing, setEditing] = useState<{ id: string; isNew: boolean; values: Record<string, string> } | null>(null);
  const [aliasText, setAliasText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([adminListCreditorRegistry(), adminListCreditorSuggestions('pending')]);
    if (r.ok === false) { setError(r.message); setRows([]); return; }
    setError('');
    setRows(r.data);
    setSuggestions(s.ok ? s.data : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter(r => {
      if (onlyCheck && !creditorNeedsCheck({ verifiedOn: r.verified_on })) return false;
      if (!t) return true;
      return r.official_name.toLowerCase().includes(t) || (r.aliases || []).some(a => a.toLowerCase().includes(t)) || r.biz_number.includes(t);
    });
  }, [rows, q, onlyCheck]);
  const needCheckCount = useMemo(() => (rows || []).filter(r => r.is_active && creditorNeedsCheck({ verifiedOn: r.verified_on })).length, [rows]);

  const openEdit = (r: CreditorRegistryRow | null) => {
    setFormError('');
    if (!r) {
      setEditing({ id: '', isNew: true, values: { category: 'OTHER', verified_on: today() } });
      setAliasText('');
      return;
    }
    const v: Record<string, string> = {};
    EDIT_KEYS.forEach(k => { v[k] = String((r as any)[k] ?? ''); });
    setEditing({ id: r.id, isNew: false, values: v });
    setAliasText((r.aliases || []).join(', '));
  };

  const save = async () => {
    if (!editing) return;
    const v = editing.values;
    if (!(v.official_name || '').trim()) { setFormError('정식 이름을 입력해 주세요.'); return; }
    if (!(v.source || '').trim()) { setFormError('출처를 입력해 주세요. 예: 법인등기사항증명서, 회사 공시'); return; }
    const values: CreditorChanges = {};
    EDIT_KEYS.forEach(k => { (values as any)[k] = (v[k] || '').trim(); });
    values.aliases = aliasText.split(',').map(s => s.trim()).filter(Boolean);
    const id = editing.isNew ? makeCreditorId(v.official_name) : editing.id;
    setSaving(true);
    const r = await adminUpsertCreditor(id, values);
    setSaving(false);
    if (r.ok === false) { setFormError(r.message); return; }
    toast.success('채권자 정보를 저장했어요.');
    setEditing(null);
    void load();
  };

  const review = async (s: CreditorSuggestion, accept: boolean) => {
    let note = '';
    if (!accept) {
      note = (await dialog.prompt({ title: '제안 반려', message: '반영하지 않는 이유를 적어 주세요. 제안한 사무소에 보여요.', placeholder: '예: 법인등기사항증명서와 다름' })) || '';
      if (!note.trim()) return;
    }
    const newId = !s.registry_id && accept ? makeCreditorId(String(s.changes.official_name || 'creditor')) : undefined;
    const r = await adminReviewCreditorSuggestion(s.id, accept, note, newId);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(accept ? '제안을 반영했어요.' : '제안을 반려했어요.');
    void load();
  };

  const toggleActive = async (r: CreditorRegistryRow) => {
    const res = await adminSetCreditorActive(r.id, !r.is_active);
    if (res.ok === false) { toast.error(res.message); return; }
    void load();
  };

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 space-y-4 text-left">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white"><Landmark className="w-4 h-4 text-indigo-400" aria-hidden="true" />공용 채권자 정보</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => openEdit(null)} className="min-h-9 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold whitespace-nowrap active:scale-[0.98]">채권자 추가</button>
          <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
        </div>
      </div>
      <p className="text-xs text-slate-400">모든 사무소의 채권자 검색·채권자목록 자동 채움·발송 문서가 이 표를 씁니다. 금융회사·공공기관 공개 정보만 넣고, 개인 채권자는 넣지 않아요. 확인일이 없거나 1년 지난 항목은 사무소 화면에 '확인 필요'로 보입니다.</p>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <p className="text-sm font-bold text-amber-200">사무소 수정 제안 {suggestions.length}건</p>
          {suggestions.map(s => (
            <div key={s.id} className="rounded-lg bg-[#0B0F19] border border-[#1E293B] p-3 text-xs text-slate-300 space-y-1.5">
              <p className="font-bold text-white">{s.current?.official_name || `새 채권자: ${String(s.changes.official_name || '')}`} <span className="font-normal text-slate-400">· {s.office_name || '사무소'} · {new Date(s.created_at).toLocaleDateString('ko-KR')}</span></p>
              <ul className="space-y-0.5">
                {Object.entries(s.changes).map(([k, v]) => (
                  <li key={k}><span className="text-slate-400">{CREDITOR_FIELD_LABELS[k] || k}:</span> {s.current ? <><span className="line-through text-slate-500">{String((s.current as any)[k] ?? '')}</span> → </> : null}<span className="text-emerald-300">{Array.isArray(v) ? v.join(', ') : String(v)}</span></li>
                ))}
              </ul>
              {s.note && <p className="text-slate-400">메모: {s.note}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => void review(s, true)} className="min-h-9 px-3 rounded-lg bg-emerald-600 text-white font-bold whitespace-nowrap active:scale-[0.98]">반영</button>
                <button type="button" onClick={() => void review(s, false)} className="min-h-9 px-3 rounded-lg bg-slate-700 text-slate-200 font-bold whitespace-nowrap active:scale-[0.98]">반려</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·검색어·사업자번호" className="flex-1 min-w-[180px] rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 outline-none" />
        <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={onlyCheck} onChange={e => setOnlyCheck(e.target.checked)} />확인 필요만 ({needCheckCount})</label>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : rows === null ? (
        <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">조건에 맞는 채권자가 없어요.</p>
      ) : (
        <ul className="divide-y divide-[#1E293B]/50 text-sm max-h-[420px] overflow-y-auto">
          {filtered.map(r => {
            const check = creditorNeedsCheck({ verifiedOn: r.verified_on });
            return (
              <li key={r.id} className={`py-2 flex items-start justify-between gap-3 ${r.is_active ? '' : 'opacity-60'}`}>
                <div className="min-w-0">
                  <p className="font-bold text-slate-100 truncate">{r.official_name}{!r.is_active && ' (숨김)'}</p>
                  <p className="text-xs text-slate-400 truncate">{r.representative || '대표자 미입력'} · {r.service_address || r.address || '주소 미입력'}{r.fax ? ` · 팩스 ${r.fax}` : ''}</p>
                  <p className={`text-xs ${check ? 'text-amber-300' : 'text-slate-500'}`}>{check ? '확인 필요' : '확인'} {r.verified_on ? `(${r.verified_on})` : '(확인일 없음)'} · v{r.version} · {r.source || '출처 없음'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => openEdit(r)} className="min-h-9 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold whitespace-nowrap active:scale-[0.98]">고치기</button>
                  <button type="button" onClick={() => void toggleActive(r)} className="min-h-9 px-3 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold whitespace-nowrap active:scale-[0.98]">{r.is_active ? '숨기기' : '다시 보이기'}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div className="rounded-xl border border-indigo-500/40 bg-[#0B0F19] p-4 space-y-2.5">
          <p className="text-sm font-bold text-white">{editing.isNew ? '채권자 추가' : '채권자 정보 고치기'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EDIT_KEYS.map(k => (
              <label key={k} className="block text-xs text-slate-400">
                {CREDITOR_FIELD_LABELS[k] || k}
                {k === 'category' ? (
                  <select value={editing.values[k] || 'OTHER'} onChange={e => setEditing(ed => ed && ({ ...ed, values: { ...ed.values, [k]: e.target.value } }))} className="mt-1 w-full rounded-lg bg-[#111622] border border-[#1E293B] px-2.5 py-2 text-sm text-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type={k === 'verified_on' ? 'date' : 'text'} value={editing.values[k] || ''} onChange={e => setEditing(ed => ed && ({ ...ed, values: { ...ed.values, [k]: e.target.value } }))} className="mt-1 w-full rounded-lg bg-[#111622] border border-[#1E293B] px-2.5 py-2 text-sm text-white" />
                )}
              </label>
            ))}
            <label className="block text-xs text-slate-400 md:col-span-2">검색어 (쉼표로 구분)
              <input value={aliasText} onChange={e => setAliasText(e.target.value)} className="mt-1 w-full rounded-lg bg-[#111622] border border-[#1E293B] px-2.5 py-2 text-sm text-white" />
            </label>
          </div>
          {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void save()} className="min-h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{saving ? '저장 중…' : '저장'}</button>
            <button type="button" onClick={() => setEditing(null)} className="min-h-10 px-4 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold whitespace-nowrap active:scale-[0.98]">취소</button>
          </div>
        </div>
      )}
    </section>
  );
}
