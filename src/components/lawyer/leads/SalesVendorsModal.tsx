// 거래처(광고대행사) (SL-15·SL-16·SL-17, 15 기획서 5-8)
// 리드를 보내 주는 쪽이에요. 대행사에 마이김변 계정·열람 권한은 주지 않고, 거래처별 접수 주소로 보내기만 해요.
// 계약 방식에 성과(수임·계약·입금) 연동 지급은 없어요 (SL-Q8).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Download, Plus, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { useDialog } from '../../common/DialogProvider';
import type { SalesLead } from '../../../types/leadTypes';
import { LEAD_CLOSE_REASON_LABEL } from '../../../types/leadTypes';
import {
  PER_LEAD_NOTICE, REPLACEMENT_REASON_OPTIONS, VENDOR_CONTRACT_LABEL, deleteVendor, listBillings, listReplacementCandidates, listReplacements,
  listVendors, replacementCsv, requestReplacements, saveBilling, saveVendor, setReplacementResult, setSourceVendor,
  type Replacement, type ReplacementCandidate, type SalesVendor, type VendorBilling, type VendorContractType,
} from '../../../services/sales/salesVendorService';
import { listIntakeSources, type LeadIntakeSource } from '../../../services/sales/leadIntakeService';

const btn = 'min-h-[40px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50';
const field = 'mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm bg-white';
const won = (n?: number | null) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '-');
const emptyVendor = (): Partial<SalesVendor> & { name: string } => ({ name: '', status: 'active', contractType: 'monthly_fixed', collectionMode: 'entrusted', replacementDays: 7, replacementReasons: REPLACEMENT_REASON_OPTIONS.map(o => o.key), consentNamesOffice: false, privacyPolicyChecked: false });
const thisMonth = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7) + '-01';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function SalesVendorsModal({ officeId, canManage, leads, onClose }: { officeId: string; canManage: boolean; leads: SalesLead[]; onClose: () => void }) {
  const dialog = useDialog();
  const [vendors, setVendors] = useState<SalesVendor[] | null>(null);
  const [error, setError] = useState('');
  const [selId, setSelId] = useState<string | 'new' | null>(null);
  const [tab, setTab] = useState<'info' | 'replace' | 'billing'>('info');
  const [draft, setDraft] = useState(emptyVendor());
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<LeadIntakeSource[]>([]);

  const load = useCallback(async () => {
    const [v, s] = await Promise.all([listVendors(officeId), listIntakeSources(officeId)]);
    if (v.ok === false) { setError(v.message); return; }
    setError('');
    setVendors(v.data);
    if (s.ok) setSources(s.data.filter(x => !x.revokedAt));
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);

  const sel = vendors?.find(v => v.id === selId) || null;
  useEffect(() => { setDraft(sel ? { ...sel } : emptyVendor()); setTab('info'); }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadCount = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach(l => { if (l.vendorId) m.set(l.vendorId, (m.get(l.vendorId) || 0) + 1); });
    return m;
  }, [leads]);

  const pickContract = async (t: VendorContractType) => {
    if ((t === 'per_lead' || t === 'mixed') && !draft.perLeadAckAt) {
      const ok = await dialog.confirm({ title: '리드 건당 단가 계약', message: PER_LEAD_NOTICE + ' 이 안내를 확인했고 사무소가 정한다는 기록이 남아요.', confirmText: '확인하고 고르기' });
      if (!ok) return;
      setDraft(d => ({ ...d, contractType: t, perLeadAckAt: new Date().toISOString() }));
      return;
    }
    setDraft(d => ({ ...d, contractType: t }));
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error('상호를 입력해 주세요.'); return; }
    if (draft.bizNo && draft.bizNo.replace(/\D/g, '').length !== 10) { toast.error('사업자등록번호는 숫자 10자리예요.'); return; }
    setBusy(true);
    const r = await saveVendor(officeId, draft);
    setBusy(false);
    if (r.ok === false) { toast.error(`저장하지 못했어요: ${r.message}`); return; }
    toast.success(selId === 'new' ? '거래처를 등록했어요. 사무소 개인정보 처리방침에 이 업체를 넣었는지 확인해 주세요.' : '저장했어요.');
    if (draft.collectionMode === 'third_party' && !draft.consentNamesOffice) toast.warning('제3자 제공 방식인데 대행사 동의 문구에 사무소 이름이 있다고 확인되지 않았어요.');
    await load();
    setSelId(r.data.id);
  };

  const remove = async () => {
    if (!sel) return;
    const ok = await dialog.confirm({ title: '거래처 삭제', message: `${sel.name}을(를) 지울까요? 교체 요청·청구 기록도 같이 지워지고, 리드에는 거래처 표시만 남아요. 계약이 끝났으면 상태를 '계약 종료'로 바꾸는 쪽을 권해요.`, confirmText: '삭제', variant: 'danger' });
    if (!ok) return;
    const r = await deleteVendor(officeId, sel.id);
    if (r.ok === false) { toast.error(r.message); return; }
    setSelId(null);
    await load();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="vendors-title" className="w-full max-w-5xl rounded-3xl bg-white shadow-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 id="vendors-title" className="text-base font-black text-slate-900">거래처(광고대행사)</h3>
              <p className="text-xs text-slate-500">리드를 보내 주는 대행사를 관리해요. 대행사에는 계정을 주지 않고 거래처별 접수 주소로 보내기만 해요.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[260px_1fr]">
            <aside className="border-r border-slate-100 overflow-y-auto p-4 space-y-2">
              {canManage && <button type="button" onClick={() => setSelId('new')} className={`${btn} w-full bg-[#1E3A5F] text-white`}><Plus className="w-4 h-4 inline" /> 거래처 등록</button>}
              {error && <p role="alert" className="text-xs text-rose-700">{error} <button type="button" onClick={() => void load()} className="underline">다시</button></p>}
              {!vendors && !error && [0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
              {vendors && vendors.length === 0 && <p className="text-xs text-slate-500 p-2">아직 거래처가 없어요. 광고대행사와 계약해 리드를 받는다면 등록해 주세요.</p>}
              {vendors?.map(v => (
                <button key={v.id} type="button" onClick={() => setSelId(v.id)} className={`w-full text-left rounded-xl border p-3 active:scale-[0.98] ${selId === v.id ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-slate-200'}`}>
                  <span className="block text-sm font-bold text-slate-900">{v.name}</span>
                  <span className="block text-xs text-slate-500">{VENDOR_CONTRACT_LABEL[v.contractType]} · {v.status === 'ended' ? '계약 종료' : '계약 중'} · 리드 {leadCount.get(v.id) || 0}건</span>
                </button>
              ))}
            </aside>
            <section className="overflow-y-auto p-6">
              {!selId && <p className="text-sm text-slate-500">왼쪽에서 거래처를 고르거나 새로 등록해 주세요.</p>}
              {selId && (
                <div className="space-y-4">
                  {sel && (
                    <div className="flex gap-1.5" role="tablist">
                      {([['info', '정보·계약'], ['replace', '불량 리드 교체'], ['billing', '청구·지급']] as const).map(([k, l]) => (
                        <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap ${tab === k ? 'bg-[#1E3A5F] text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>{l}</button>
                      ))}
                    </div>
                  )}
                  {tab === 'info' && (
                    <fieldset disabled={!canManage} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-slate-700">상호<input value={draft.name} maxLength={60} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">사업자등록번호<input value={draft.bizNo || ''} inputMode="numeric" onChange={e => setDraft(d => ({ ...d, bizNo: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">담당자<input value={draft.contactName || ''} maxLength={40} onChange={e => setDraft(d => ({ ...d, contactName: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">연락처<input value={draft.contactPhone || ''} maxLength={20} onChange={e => setDraft(d => ({ ...d, contactPhone: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">이메일<input value={draft.contactEmail || ''} maxLength={120} onChange={e => setDraft(d => ({ ...d, contactEmail: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">상태
                          <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as SalesVendor['status'] }))} className={field}><option value="active">계약 중</option><option value="ended">계약 종료 (접수 막힘)</option></select>
                        </label>
                        <label className="text-xs font-semibold text-slate-700">계약 시작<input type="date" value={draft.contractStart || ''} onChange={e => setDraft(d => ({ ...d, contractStart: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">계약 끝 (지나면 접수 자동 차단)<input type="date" value={draft.contractEnd || ''} onChange={e => setDraft(d => ({ ...d, contractEnd: e.target.value }))} className={field} /></label>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-900">계약 방식</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(VENDOR_CONTRACT_LABEL) as VendorContractType[]).map(t => (
                            <button key={t} type="button" onClick={() => void pickContract(t)} className={`min-h-[40px] px-3 rounded-xl border text-sm font-bold text-left ${draft.contractType === t ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]' : 'border-slate-200 text-slate-700'}`}>{VENDOR_CONTRACT_LABEL[t]}</button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500">수임·계약·입금 결과에 따라 대행사에 지급하는 방식은 변호사법상 쓸 수 없어 선택지에 없어요.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {(draft.contractType === 'monthly_fixed' || draft.contractType === 'mixed') && <label className="text-xs font-semibold text-slate-700">월 대행료(원)<input inputMode="numeric" value={draft.monthlyFee ?? ''} onChange={e => setDraft(d => ({ ...d, monthlyFee: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined }))} className={field} /></label>}
                          {(draft.contractType === 'media_plus_fee' || draft.contractType === 'mixed') && <label className="text-xs font-semibold text-slate-700">대행 수수료(%)<input inputMode="decimal" value={draft.feePercent ?? ''} onChange={e => setDraft(d => ({ ...d, feePercent: e.target.value ? Math.min(100, Number(e.target.value)) : undefined }))} className={field} /></label>}
                          {(draft.contractType === 'per_lead' || draft.contractType === 'mixed') && <label className="text-xs font-semibold text-slate-700">리드 건당 단가(원)<input inputMode="numeric" value={draft.perLeadPrice ?? ''} onChange={e => setDraft(d => ({ ...d, perLeadPrice: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined }))} className={field} /></label>}
                        </div>
                        {(draft.contractType === 'per_lead' || draft.contractType === 'mixed') && <p className="text-[11px] text-amber-800 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{PER_LEAD_NOTICE}</p>}
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-900">개인정보 수집 구조</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button type="button" onClick={() => setDraft(d => ({ ...d, collectionMode: 'entrusted' }))} className={`min-h-[40px] p-3 rounded-xl border text-sm text-left ${draft.collectionMode === 'entrusted' ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-slate-200'}`}><b>위탁 수집</b><span className="block text-xs text-slate-500">대행사 폼에 사무소 이름으로 수집 (대행사 = 수탁자)</span></button>
                          <button type="button" onClick={() => setDraft(d => ({ ...d, collectionMode: 'third_party' }))} className={`min-h-[40px] p-3 rounded-xl border text-sm text-left ${draft.collectionMode === 'third_party' ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-slate-200'}`}><b>제3자 제공</b><span className="block text-xs text-slate-500">대행사가 자기 이름으로 수집한 뒤 사무소에 제공</span></button>
                        </div>
                        <label className="text-xs font-semibold text-slate-700">동의 문구 버전·적용일<input value={draft.consentVersion || ''} maxLength={60} placeholder="예: v3 (2026-11-01)" onChange={e => setDraft(d => ({ ...d, consentVersion: e.target.value }))} className={field} /></label>
                        <label className="text-xs font-semibold text-slate-700">동의 문구 원문<textarea rows={3} maxLength={5000} value={draft.consentText || ''} onChange={e => setDraft(d => ({ ...d, consentText: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                        {draft.collectionMode === 'third_party' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.consentNamesOffice} onChange={e => setDraft(d => ({ ...d, consentNamesOffice: e.target.checked }))} className="w-4 h-4" /> 동의 문구의 '제공받는 자'에 우리 사무소 이름이 있어요</label>}
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.privacyPolicyChecked} onChange={e => setDraft(d => ({ ...d, privacyPolicyChecked: e.target.checked }))} className="w-4 h-4" /> 사무소 개인정보 처리방침에 이 업체(수탁자)를 넣었어요</label>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-900">불량 리드 교체 규칙 (계약서 기준)</p>
                        <label className="text-xs font-semibold text-slate-700">교체 기간 (접수 뒤 며칠 안에 종료된 리드)<input type="number" min={0} max={90} value={draft.replacementDays ?? 7} onChange={e => setDraft(d => ({ ...d, replacementDays: Math.min(90, Math.max(0, Number(e.target.value) || 0)) }))} className={field} /></label>
                        <div className="flex flex-wrap gap-2">
                          {REPLACEMENT_REASON_OPTIONS.map(o => {
                            const on = (draft.replacementReasons || []).includes(o.key);
                            return <button key={o.key} type="button" aria-pressed={on} onClick={() => setDraft(d => ({ ...d, replacementReasons: on ? (d.replacementReasons || []).filter(x => x !== o.key) : [...(d.replacementReasons || []), o.key] }))} className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold ${on ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]' : 'border-slate-200 text-slate-600'}`}>{o.label}</button>;
                          })}
                        </div>
                      </div>
                      {sel && sources.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                          <p className="text-sm font-bold text-slate-900">이 거래처 접수 주소</p>
                          <p className="text-xs text-slate-500">접수 주소를 거래처에 연결하면 그 주소로 들어온 리드가 이 거래처 리드가 돼요. 대행사 쪽 리드 번호는 <code>vendorLeadRef</code> 칸으로 받아요.</p>
                          {sources.map(s => (
                            <label key={s.id} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="w-4 h-4" checked={s.vendorId === sel.id} onChange={e => void setSourceVendor(s.id, e.target.checked ? sel.id : null).then(r => { if (r.ok === false) toast.error(r.message); else void load(); })} />
                              {s.name} <span className="text-xs text-slate-500">(…{s.keyHint}){s.vendorId && s.vendorId !== sel.id ? ' · 다른 거래처에 연결됨' : ''}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <label className="block text-xs font-semibold text-slate-700">메모<textarea rows={2} maxLength={2000} value={draft.memo || ''} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                      {canManage && (
                        <div className="flex justify-between gap-2">
                          {sel ? <button type="button" onClick={() => void remove()} className={`${btn} border border-rose-300 bg-white text-rose-700`}>삭제</button> : <span />}
                          <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}>{busy ? '저장 중…' : '저장'}</button>
                        </div>
                      )}
                    </fieldset>
                  )}
                  {tab === 'replace' && sel && <ReplacementPanel vendor={sel} canManage={canManage} />}
                  {tab === 'billing' && sel && <BillingPanel officeId={officeId} vendor={sel} canManage={canManage} leads={leads} />}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

const reasonLabel = (k: string) => LEAD_CLOSE_REASON_LABEL[k] || k;
const REP_STATUS: Record<Replacement['status'], string> = { requested: '요청함', replaced: '교체됨', refused: '거절', refunded: '환불' };

function ReplacementPanel({ vendor, canManage }: { vendor: SalesVendor; canManage: boolean }) {
  const [cands, setCands] = useState<ReplacementCandidate[] | null>(null);
  const [reps, setReps] = useState<Replacement[]>([]);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [c, r] = await Promise.all([listReplacementCandidates(vendor.id), listReplacements(vendor.id)]);
    if (c.ok === false) { setErr(c.message); return; }
    setErr(''); setCands(c.data); setPick(new Set(c.data.map(x => x.leadId)));
    if (r.ok) setReps(r.data);
  }, [vendor.id]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    const ids = [...pick];
    if (ids.length === 0) return;
    const r = await requestReplacements(vendor.id, ids);
    if (r.ok === false) { toast.error(r.message); return; }
    download(`교체요청_${vendor.name}_${new Date().toISOString().slice(0, 10)}.csv`, replacementCsv(r.data, reasonLabel));
    toast.success(`${r.data.length}건 교체 요청 파일을 내려받았어요. 이름·전화번호는 들어 있지 않아요. 대행사에 보내 주세요.`);
    void load();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">접수 뒤 {vendor.replacementDays}일 안에 {vendor.replacementReasons.map(reasonLabel).join('·')}(으)로 종료된 리드를 모았어요. 요청 파일에는 대행사 리드 번호·접수 일시·사유만 들어가요(번호가 없으면 전화번호 끝 4자리).</p>
      {err && <p role="alert" className="text-xs text-rose-700">{err}</p>}
      {!cands && !err && <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />}
      {cands && cands.length === 0 && <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-4 text-center">지금 교체를 요청할 리드가 없어요.</p>}
      {cands && cands.length > 0 && (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 w-10" /><th className="p-2 text-left">대행사 리드 번호</th><th className="p-2 text-left">접수</th><th className="p-2 text-left">사유</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cands.map(c => (
                <tr key={c.leadId}>
                  <td className="p-2 text-center"><input type="checkbox" aria-label="요청에 넣기" className="w-4 h-4" checked={pick.has(c.leadId)} onChange={e => setPick(p => { const n = new Set(p); if (e.target.checked) n.add(c.leadId); else n.delete(c.leadId); return n; })} /></td>
                  <td className="p-2">{c.vendorLeadRef || `번호 끝 ${c.phoneLast4 || '-'}`}</td>
                  <td className="p-2 text-xs">{new Date(c.receivedAt).toLocaleDateString('ko-KR')}</td>
                  <td className="p-2 text-xs">{reasonLabel(c.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage && cands && cands.length > 0 && <div className="flex justify-end"><button type="button" disabled={pick.size === 0} onClick={() => void send()} className={`${btn} bg-[#1E3A5F] text-white`}><Download className="w-4 h-4 inline" /> 교체 요청 파일 만들기 ({pick.size}건)</button></div>}
      {reps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-900">요청 기록</p>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {reps.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 min-w-0">{r.vendorLeadRef || `끝 ${r.phoneLast4 || '-'}`} · {reasonLabel(r.reason)} · {new Date(r.requestedAt).toLocaleDateString('ko-KR')}</span>
                <select aria-label="결과" disabled={!canManage} value={r.status} onChange={e => void setReplacementResult(r.id, e.target.value as Replacement['status']).then(x => { if (x.ok === false) toast.error(x.message); else void load(); })} className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-xs bg-white">
                  {(Object.keys(REP_STATUS) as Replacement['status'][]).map(k => <option key={k} value={k}>{REP_STATUS[k]}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BillingPanel({ officeId, vendor, canManage, leads }: { officeId: string; vendor: SalesVendor; canManage: boolean; leads: SalesLead[] }) {
  const [rows, setRows] = useState<VendorBilling[] | null>(null);
  const [draft, setDraft] = useState<VendorBilling>({ vendorId: vendor.id, month: thisMonth(), mediaCost: 0, feeAmount: 0, otherAmount: 0 });
  const load = useCallback(async () => { const r = await listBillings(vendor.id); if (r.ok) setRows(r.data); else toast.error(r.message); }, [vendor.id]);
  useEffect(() => { void load(); }, [load]);

  // 건당 단가 계약: 그 달 유효 리드 수 (결번·중복·본인 아님·허위 제외) × 단가 — 대행사 청구서와 맞춰 보기용
  const month = draft.month.slice(0, 7);
  const monthLeads = leads.filter(l => l.vendorId === vendor.id && (l.createdAt || '').slice(0, 7) === month);
  const invalid = new Set(['wrong_number', 'duplicate', 'not_self', 'false_info']);
  const valid = monthLeads.filter(l => !(l.status === 'closed' && l.closeReason && invalid.has(l.closeReason))).length;
  const expected = vendor.perLeadPrice ? valid * vendor.perLeadPrice : null;

  const save = async () => {
    const r = await saveBilling(officeId, draft);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('청구 기록을 저장했어요. 통계의 광고비에 들어가요.');
    void load();
  };
  const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

  return (
    <div className="space-y-4">
      <fieldset disabled={!canManage} className="rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-slate-700">월<input type="month" value={month} onChange={e => setDraft(d => ({ ...d, month: `${e.target.value}-01` }))} className={field} /></label>
          <label className="text-xs font-semibold text-slate-700">매체비(원)<input inputMode="numeric" value={draft.mediaCost || ''} onChange={e => setDraft(d => ({ ...d, mediaCost: num(e.target.value) }))} className={field} /></label>
          <label className="text-xs font-semibold text-slate-700">대행료·수수료(원)<input inputMode="numeric" value={draft.feeAmount || ''} onChange={e => setDraft(d => ({ ...d, feeAmount: num(e.target.value) }))} className={field} /></label>
          <label className="text-xs font-semibold text-slate-700">기타(원)<input inputMode="numeric" value={draft.otherAmount || ''} onChange={e => setDraft(d => ({ ...d, otherAmount: num(e.target.value) }))} className={field} /></label>
          <label className="text-xs font-semibold text-slate-700">세금계산서 번호<input value={draft.invoiceNo || ''} maxLength={60} onChange={e => setDraft(d => ({ ...d, invoiceNo: e.target.value }))} className={field} /></label>
          <label className="text-xs font-semibold text-slate-700">지급일<input type="date" value={draft.paidOn || ''} onChange={e => setDraft(d => ({ ...d, paidOn: e.target.value }))} className={field} /></label>
        </div>
        <p className="text-xs text-slate-600">이 달 이 거래처 리드 {monthLeads.length}건 · 유효 {valid}건{expected !== null ? ` · 건당 단가 기준 예상 청구액 ${won(expected)} (대행사 청구서와 맞춰 보기용)` : ''}</p>
        <div className="flex justify-end"><button type="button" onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}>저장</button></div>
      </fieldset>
      {!rows && <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">아직 청구 기록이 없어요.</p>}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm rounded-2xl border border-slate-200 overflow-hidden">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">월</th><th className="p-2 text-right">합계</th><th className="p-2 text-left">지급일</th><th className="p-2 text-left">계산서</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(b => (
              <tr key={b.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDraft(b)}>
                <td className="p-2">{b.month.slice(0, 7)}</td>
                <td className="p-2 text-right tabular-nums">{won(b.mediaCost + b.feeAmount + b.otherAmount)}</td>
                <td className="p-2 text-xs">{b.paidOn || '-'}</td>
                <td className="p-2 text-xs">{b.invoiceNo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
