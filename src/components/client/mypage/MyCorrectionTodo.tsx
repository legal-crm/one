// 의뢰인 '내 사건' › 보정 할 일 (CR-5·CR-6)
// 법원이 보완 자료를 요청하면 사무소가 정리한 항목이 쉬운 말 카드로 온다. 서류 올리기·표 채우기·질문 답·'낼 수 없어요'.
// 보낸 답은 사무소가 확인하고, 보정서 문장은 변호사가 쓴다. 월 변제금·감면율은 보여 주지 않는다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileText, Plus, Trash2, Upload } from 'lucide-react';
import {
  CANNOT_REASON_LABEL, CORRECTIONS_CHANGED_EVENT, KIND_LABEL, loadCaseFilesByIds, loadClientCorrections, respondCorrectionItem,
  type CannotReason, type ClientCorrectionItem, type ClientCorrectionOrder,
} from '../../../services/corrections/correctionService';
import { CORRECTION_TABLES, cleanRows } from '../../../services/corrections/correctionTables';
import { getCaseFileUrl, uploadCaseFile } from '../../../services/files/caseFileService';
import { localYmd } from '../../../utils/localDate';
import type { DocumentFile } from '../../../types';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const btn = 'min-h-[44px] px-3 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: '해야 해요', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  in_progress: { label: '작성 중', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  submitted: { label: '보냈어요', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  needs_fix: { label: '보완이 필요해요', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
  confirmed: { label: '확인됐어요', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cannot_submit: { label: '낼 수 없다고 알렸어요', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
};

function dday(ymd?: string): string {
  if (!ymd) return '';
  const d = Math.round((new Date(`${ymd}T00:00:00`).getTime() - new Date(`${localYmd()}T00:00:00`).getTime()) / 86400000);
  return d === 0 ? '오늘까지' : d > 0 ? `${d}일 남음` : `${-d}일 지남`;
}

async function openFile(fileId: string) {
  const [f] = await loadCaseFilesByIds([fileId]);
  const url = f ? await getCaseFileUrl({ storagePath: f.storagePath }) : null;
  if (url) window.open(url, '_blank', 'noopener'); else toast.error('파일을 열지 못했어요.');
}

export default function MyCorrectionTodo({ caseKey }: { caseKey: string }) {
  const [orders, setOrders] = useState<ClientCorrectionOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadClientCorrections(caseKey);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setOrders(r.data);
  }, [caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener(CORRECTIONS_CHANGED_EVENT, h);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener(CORRECTIONS_CHANGED_EVENT, h); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  if (error) return <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>;
  if (!orders || orders.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {orders.map(o => o.status === 'submitted' ? (
        <div key={o.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
          <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> 사무소가 법원에 {o.round}차 보정서를 냈어요 ({o.submittedOn})</p>
          <p className="text-xs text-emerald-900">법원이 더 요청하면 다시 알려 드릴게요.</p>
          {o.briefFileId && <button type="button" onClick={() => void openFile(o.briefFileId!)} className="min-h-[44px] text-xs font-bold text-emerald-900 underline underline-offset-2">제출한 보정서 사본 보기</button>}
        </div>
      ) : (
        <OrderCard key={o.id} order={o} caseKey={caseKey} reload={load} />
      ))}
    </div>
  );
}

function OrderCard({ order, caseKey, reload }: { order: ClientCorrectionOrder; caseKey: string; reload: () => Promise<void> }) {
  const open = order.items.filter(i => !['confirmed', 'submitted', 'cannot_submit'].includes(i.status)).length;
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-3 sm:p-4 space-y-3" aria-label={`${order.round}차 보정 할 일`}>
      <div className="space-y-1">
        <p className="text-sm font-black text-slate-900">법원에서 보완 자료를 요청했어요</p>
        <p className="text-base font-black text-amber-800">사무소 마감 {order.officeDue} · {dday(order.officeDue)}</p>
        <p className="text-xs text-slate-600">
          {order.courtName ? `${order.courtName} ` : ''}{order.round}차 {KIND_LABEL[order.kind]} · 법원 기한 {order.courtDue} · 남은 항목 {open}개.
          기한 안에 내야 법원 심사가 이어져요. 사무소가 확인하고 보정서를 써요.
        </p>
        {order.sourceFileId && <button type="button" onClick={() => void openFile(order.sourceFileId!)} className="min-h-[44px] text-xs font-bold text-blue-700 underline underline-offset-2">법원 원문 보기</button>}
      </div>
      <ul className="space-y-2">
        {order.items.map(it => <ItemCard key={it.id} item={it} caseKey={caseKey} reload={reload} />)}
      </ul>
    </section>
  );
}

function ItemCard({ item, caseKey, reload }: { item: ClientCorrectionItem; caseKey: string; reload: () => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, string>>(item.answers);
  const [rows, setRows] = useState<Array<Record<string, string>>>(item.tableRows.length ? item.tableRows : []);
  const [fileIds, setFileIds] = useState<string[]>(item.fileIds);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showCannot, setShowCannot] = useState(false);
  const [cannotReason, setCannotReason] = useState<CannotReason>('delayed');
  const [cannotNote, setCannotNote] = useState('');
  const [expectedOn, setExpectedOn] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const def = item.tableType ? CORRECTION_TABLES[item.tableType] : null;
  const done = item.status === 'confirmed';
  const st = STATUS[item.status] || STATUS.requested;

  useEffect(() => {
    let cancelled = false;
    if (fileIds.length) void loadCaseFilesByIds(fileIds).then(fs => { if (!cancelled) setFileNames(Object.fromEntries(fs.map(f => [f.id, f.name]))); });
    return () => { cancelled = true; };
  }, [fileIds]);

  const payload = () => ({ answers, tableRows: def ? cleanRows(item.tableType!, rows) : [], fileIds });

  const save = async (action: 'save' | 'submit') => {
    if (action === 'submit') {
      const hasSomething = fileIds.length > 0 || Object.values(answers).some(v => v.trim()) || (def && cleanRows(item.tableType!, rows).length > 0);
      if (!hasSomething) { toast.error('서류를 올리거나 내용을 채운 뒤 보내 주세요. 낼 수 없다면 "이 자료를 낼 수 없어요"를 눌러 주세요.'); return; }
    }
    setBusy(true);
    const r = await respondCorrectionItem(item.id, action, payload());
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(action === 'submit' ? '사무소에 보냈어요. 확인되면 알려 드릴게요.' : '임시 저장했어요.');
    void reload();
  };

  const sendCannot = async () => {
    setBusy(true);
    const r = await respondCorrectionItem(item.id, 'cannot', { cannotReason, cannotNote: cannotNote.trim() || undefined, expectedOn: expectedOn || undefined });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('사무소에 알렸어요. 사무소가 사유를 적거나 기간 연장을 검토해요.');
    setShowCannot(false);
    void reload();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (list.length === 0) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of list) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: 20MB를 넘어요.`); continue; }
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(f); });
      const up = await uploadCaseFile({
        source: 'client', clientKey: caseKey,
        file: { id: '', name: f.name, category: 'correction', uploadedAt: new Date().toISOString(), uploadedBy: '의뢰인', mimeType: f.type, dataUrl, uploadSource: 'client', reviewStatus: 'submitted' } as DocumentFile,
      });
      if (up.ok && up.file) added.push(up.file.id); else toast.error(`${f.name}: ${up.message}`);
    }
    if (added.length > 0) {
      const next = [...fileIds, ...added];
      const r = await respondCorrectionItem(item.id, 'save', { ...payload(), fileIds: next });
      if (r.ok === false) toast.error(r.message);
      else { setFileIds(r.data.fileIds); toast.success(`파일 ${added.length}개를 올렸어요. 다 채웠으면 "사무소에 보내기"를 눌러 주세요.`); }
    }
    setBusy(false);
  };

  return (
    <li className="rounded-xl border border-slate-200 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{item.title || '보완 자료'}</p>
        <span className={`text-xs font-bold border rounded-lg px-2 py-0.5 shrink-0 ${st.cls}`}>{st.label}</span>
      </div>
      {item.status === 'needs_fix' && item.fixReason && (
        <p className="text-xs text-rose-800 bg-rose-50 rounded-lg px-2.5 py-2 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /> 사무소: {item.fixReason}</p>
      )}
      {item.guide && <p className="text-xs text-slate-700 leading-relaxed">{item.guide}</p>}
      {item.neededDocs.length > 0 && (
        <ul className="text-xs text-slate-700 list-disc pl-5 space-y-0.5">{item.neededDocs.map(d => <li key={d}>{d}</li>)}</ul>
      )}
      {item.photoCount && <p className="text-xs text-slate-700">사진 {item.photoCount}장이 필요해요. 휴대폰 카메라로 찍어 올려도 돼요.</p>}
      {item.status === 'cannot_submit' && <p className="text-xs text-slate-700">알린 사유: {CANNOT_REASON_LABEL[item.cannotReason || 'other']}{item.cannotNote ? ` · ${item.cannotNote}` : ''}</p>}

      {!done && item.questions.map(q => (
        <label key={q} className="block space-y-1">
          <span className="text-xs font-bold text-slate-800">{q}</span>
          <textarea value={answers[q] || ''} rows={2} onChange={e => setAnswers(a => ({ ...a, [q]: e.target.value.slice(0, 2000) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>
      ))}

      {!done && def && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-800">{def.title} (한 줄씩 채워 주세요)</p>
          {rows.map((r, idx) => (
            <div key={idx} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">{idx + 1}번째</span>
                <button type="button" onClick={() => setRows(rs => rs.filter((_, i) => i !== idx))} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-500" aria-label={`${idx + 1}번째 줄 지우기`}><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {def.columns.map(c => (
                  <label key={c.key} className="space-y-0.5">
                    <span className="text-xs text-slate-600">{c.label}</span>
                    {c.kind === 'select' ? (
                      <select value={r[c.key] || ''} onChange={e => setRows(rs => rs.map((x, i) => (i === idx ? { ...x, [c.key]: e.target.value } : x)))} className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm bg-white">
                        <option value="">선택</option>{(c.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={c.kind === 'date' ? 'date' : 'text'} inputMode={c.kind === 'money' ? 'numeric' : undefined} placeholder={c.hint}
                        value={r[c.key] || ''} onChange={e => setRows(rs => rs.map((x, i) => (i === idx ? { ...x, [c.key]: c.kind === 'money' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value } : x)))}
                        className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm bg-white" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setRows(rs => [...rs, {}])} className={`${btn} border border-slate-300 text-slate-800`}><Plus className="w-4 h-4" aria-hidden="true" /> 줄 더하기</button>
        </div>
      )}

      {fileIds.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {fileIds.map(id => (
            <li key={id}><button type="button" onClick={() => void openFile(id)} className="min-h-[44px] px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" aria-hidden="true" /> {fileNames[id] || '올린 파일'}</button></li>
          ))}
        </ul>
      )}

      {!done && (
        <div className="flex flex-wrap gap-2 pt-1">
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onPick} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`${btn} border border-slate-300 text-slate-800`}><Upload className="w-4 h-4" aria-hidden="true" /> 서류·사진 올리기</button>
          {(item.questions.length > 0 || def) && <button type="button" disabled={busy} onClick={() => void save('save')} className={`${btn} border border-slate-300 text-slate-800`}>임시 저장</button>}
          <button type="button" disabled={busy} onClick={() => void save('submit')} className={`${btn} bg-[#1E3A5F] text-white`}>사무소에 보내기</button>
          <button type="button" disabled={busy} onClick={() => setShowCannot(v => !v)} className={`${btn} text-slate-600 underline underline-offset-2`}>이 자료를 낼 수 없어요</button>
        </div>
      )}

      {showCannot && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
          <fieldset className="space-y-1">
            <legend className="text-xs font-bold text-slate-800">사유</legend>
            {(Object.keys(CANNOT_REASON_LABEL) as CannotReason[]).map(k => (
              <label key={k} className="flex items-center gap-2 min-h-[44px] text-sm"><input type="radio" checked={cannotReason === k} onChange={() => setCannotReason(k)} /> {CANNOT_REASON_LABEL[k]}</label>
            ))}
          </fieldset>
          {cannotReason === 'delayed' && (
            <label className="block space-y-1 text-xs font-bold text-slate-800">발급 예정일 (아는 경우)
              <input type="date" value={expectedOn} min={localYmd()} onChange={e => setExpectedOn(e.target.value)} className="w-full min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm bg-white" />
            </label>
          )}
          <label className="block space-y-1 text-xs font-bold text-slate-800">설명
            <textarea value={cannotNote} rows={2} onChange={e => setCannotNote(e.target.value.slice(0, 1000))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
          </label>
          <button type="button" disabled={busy} onClick={() => void sendCannot()} className={`${btn} bg-slate-800 text-white`}>사무소에 알리기</button>
        </div>
      )}
    </li>
  );
}
